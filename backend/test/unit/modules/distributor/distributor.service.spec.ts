import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import axios from 'axios';
import { Types } from 'mongoose';
import { DistributorService } from '../../../../src/modules/distributor/services/distributor.service';
import { AuditAction, QuestionStatus, UserRole } from '../../../../src/shared/classes/enums';
import { REPOSITORY_TOKENS } from '../../../../src/shared/database/repositories';
import { INDIAN_STATES } from '../../../../src/shared/constants/indian-states.constant';
import { createMockRepository } from '../../../helpers/mock-repository';
import { objectId } from '../../../helpers/factories';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const REVIEWER_URL = 'https://reviewer.test/ingest';
const REVIEWER_KEY = 'reviewer-key';

describe('DistributorService', () => {
  const finalQuestionRepo = createMockRepository('findReferenceByQuestionId', 'findByReferenceQuestionId', 'countByDistributionState');
  const questionRepo = createMockRepository();
  const auditRepo = createMockRepository();
  const userRepo = createMockRepository();
  let service: DistributorService;

  const questionId = objectId();
  const distributorId = objectId();
  const [stateA, stateB] = INDIAN_STATES as unknown as string[];

  const approvedQuestion = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(questionId),
    status: QuestionStatus.APPROVED,
    questionText: 'How do I control stem borer in paddy?',
    userId: objectId(),
    state: 'Kerala',
    district: 'Palakkad',
    cropType: 'Paddy',
    season: 'Kharif',
    domains: ['Pest Management'],
    ...overrides,
  });

  beforeEach(async () => {
    const config = { 'reviewSystem.reviewerUri': REVIEWER_URL, 'reviewSystem.apiKey': REVIEWER_KEY } as Record<string, string>;
    const moduleRef = await Test.createTestingModule({
      providers: [
        DistributorService,
        { provide: REPOSITORY_TOKENS.FinalQuestion, useValue: finalQuestionRepo },
        { provide: REPOSITORY_TOKENS.Question, useValue: questionRepo },
        { provide: REPOSITORY_TOKENS.AuditLog, useValue: auditRepo },
        { provide: REPOSITORY_TOKENS.User, useValue: userRepo },
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
      ],
    }).compile();
    service = moduleRef.get(DistributorService);

    userRepo.findAll.mockResolvedValue([]);
    finalQuestionRepo.findReferenceByQuestionId.mockResolvedValue(null);
    finalQuestionRepo.findByReferenceQuestionId.mockResolvedValue([]);
    finalQuestionRepo.create.mockImplementation(async (row: Record<string, unknown>) => ({ id: objectId(), ...row }));
    mockedAxios.post.mockResolvedValue({ data: { success: true, message: 'Ingested', count: 1, questionIds: ['x'] } });
  });

  describe('getApprovedQuestion', () => {
    it('returns approved questions', async () => {
      const question = approvedQuestion();
      questionRepo.findById.mockResolvedValue(question);

      await expect(service.getApprovedQuestion(questionId)).resolves.toBe(question);
    });

    it('returns 404 when the question does not exist', async () => {
      questionRepo.findById.mockResolvedValue(null);

      await expect(service.getApprovedQuestion(questionId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 400 once the question has left the approved queue', async () => {
      questionRepo.findById.mockResolvedValue(approvedQuestion({ status: QuestionStatus.MOVED_TO_FINAL }));

      await expect(service.getApprovedQuestion(questionId)).rejects.toThrow('no longer in approved status');
    });
  });

  describe('assignStates', () => {
    it('returns 404 for a missing question', async () => {
      questionRepo.findById.mockResolvedValue(null);

      await expect(service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA] })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it.each([QuestionStatus.PENDING, QuestionStatus.REJECTED, QuestionStatus.MOVED_TO_FINAL])(
      'refuses to distribute a %s question',
      async (status) => {
        questionRepo.findById.mockResolvedValue(approvedQuestion({ status }));

        await expect(service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA] })).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(finalQuestionRepo.create).not.toHaveBeenCalled();
      },
    );

    it('rejects an actor id that is not an ObjectId before writing anything', async () => {
      questionRepo.findById.mockResolvedValue(approvedQuestion());

      await expect(service.assignStates('not-an-id', UserRole.DISTRIBUTOR, questionId, { states: [stateA] })).rejects.toThrow(
        'Invalid distributorId',
      );
      expect(finalQuestionRepo.create).not.toHaveBeenCalled();
    });

    it('creates one reference row plus one row per state and moves the question to final', async () => {
      questionRepo.findById.mockResolvedValue(approvedQuestion());

      await service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA, stateB], notes: 'Urgent' });

      const rows = finalQuestionRepo.create.mock.calls.map(([row]) => row as Record<string, unknown>);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual(expect.objectContaining({ isReference: true, distributionState: null, parentReferenceId: null, notes: 'Urgent' }));
      expect(rows.slice(1).map((row) => row.distributionState)).toEqual([stateA, stateB]);
      expect(rows[1].parentReferenceId).toBeInstanceOf(Types.ObjectId);
      expect(rows[1].referenceQuestionId).toEqual(new Types.ObjectId(questionId));
      expect(rows[1].distributorId).toEqual(new Types.ObjectId(distributorId));
      expect(questionRepo.update).toHaveBeenCalledWith(questionId, { status: QuestionStatus.MOVED_TO_FINAL });
    });

    it('snapshots question fields and keeps the submitter as an ObjectId', async () => {
      const question = approvedQuestion();
      questionRepo.findById.mockResolvedValue(question);

      await service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA] });

      const stateRow = finalQuestionRepo.create.mock.calls[1][0] as Record<string, unknown>;
      expect(stateRow).toEqual(expect.objectContaining({ questionText: question.questionText, cropType: 'Paddy', state: 'Kerala' }));
      expect(stateRow.userId).toEqual(new Types.ObjectId(question.userId as string));
      expect(stateRow).not.toHaveProperty('_id');
    });

    it('writes an audit entry for each created row and for the status change', async () => {
      questionRepo.findById.mockResolvedValue(approvedQuestion());

      await service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA] });

      expect(auditRepo.create).toHaveBeenCalledTimes(3);
      expect(auditRepo.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          action: AuditAction.QUESTION_DISTRIBUTED,
          entityType: 'question',
          oldValue: { status: QuestionStatus.APPROVED },
          newValue: { status: QuestionStatus.MOVED_TO_FINAL, assignedStates: [stateA] },
        }),
      );
    });

    it('skips states that were already assigned and reuses the existing reference row', async () => {
      const referenceId = new Types.ObjectId();
      questionRepo.findById.mockResolvedValue(approvedQuestion());
      finalQuestionRepo.findReferenceByQuestionId.mockResolvedValue({ _id: referenceId });
      finalQuestionRepo.findByReferenceQuestionId.mockResolvedValue([{ distributionState: null }, { distributionState: stateA }]);

      await service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA, stateB] });

      const rows = finalQuestionRepo.create.mock.calls.map(([row]) => row as Record<string, unknown>);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(expect.objectContaining({ distributionState: stateB, parentReferenceId: referenceId }));
    });

    it('does not call the reviewer when nothing new was inserted', async () => {
      questionRepo.findById.mockResolvedValue(approvedQuestion());
      finalQuestionRepo.findReferenceByQuestionId.mockResolvedValue({ _id: new Types.ObjectId() });
      finalQuestionRepo.findByReferenceQuestionId.mockResolvedValue([{ distributionState: stateA }]);

      await expect(service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA] })).resolves.toEqual({
        success: true,
        message: 'No new state assignments to ingest.',
        count: 0,
        questionIds: [],
      });
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('recovers when a concurrent request created the reference row first (E11000)', async () => {
      const winnerId = new Types.ObjectId();
      questionRepo.findById.mockResolvedValue(approvedQuestion());
      finalQuestionRepo.findReferenceByQuestionId.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: winnerId });
      finalQuestionRepo.create.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: 11000 }));

      await service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA] });

      const stateRow = finalQuestionRepo.create.mock.calls[1][0] as Record<string, unknown>;
      expect(stateRow.parentReferenceId).toBe(winnerId);
    });

    it('rethrows other database errors', async () => {
      questionRepo.findById.mockResolvedValue(approvedQuestion());
      finalQuestionRepo.create.mockRejectedValueOnce(new Error('disk full'));

      await expect(service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA] })).rejects.toThrow('disk full');
    });

    it('sends the question to the reviewer with the internal API key and returns its response', async () => {
      questionRepo.findById.mockResolvedValue(approvedQuestion());

      const result = await service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA] });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        REVIEWER_URL,
        {
          question_collection_questions: [
            {
              question: 'How do I control stem borer in paddy?',
              priority: 'medium',
              details: { state: 'Kerala', district: 'Palakkad', crop: 'Paddy', season: 'Kharif', domain: ['Pest Management'] },
            },
          ],
        },
        expect.objectContaining({ headers: expect.objectContaining({ 'x-internal-api-key': REVIEWER_KEY }) }),
      );
      expect(result).toEqual({ success: true, message: 'Ingested', count: 1, questionIds: ['x'] });
    });

    it('keeps the local distribution and reports failure when the reviewer is down', async () => {
      questionRepo.findById.mockResolvedValue(approvedQuestion());
      mockedAxios.post.mockRejectedValue(Object.assign(new Error('Request failed'), { response: { status: 503 } }));

      const result = await service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA, stateB] });

      expect(result.success).toBe(false);
      expect(result.count).toBe(2);
      expect(result.message).toContain('reviewer ingestion failed (HTTP 503)');
      expect(questionRepo.update).toHaveBeenCalledWith(questionId, { status: QuestionStatus.MOVED_TO_FINAL });
    });

    it('describes network errors by their code', async () => {
      questionRepo.findById.mockResolvedValue(approvedQuestion());
      mockedAxios.post.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));

      const result = await service.assignStates(distributorId, UserRole.DISTRIBUTOR, questionId, { states: [stateA] });

      expect(result.message).toContain('ECONNREFUSED');
    });
  });

  describe('getDistributionsForQuestion', () => {
    it('separates the reference row from the state rows', async () => {
      const reference = { id: 'ref-1', distributionState: null };
      const kerala = { id: 'row-1', distributionState: stateA };
      finalQuestionRepo.findByReferenceQuestionId.mockResolvedValue([reference, kerala]);

      await expect(service.getDistributionsForQuestion(questionId)).resolves.toEqual({
        questionId,
        states: [stateA],
        entries: [kerala],
        referenceDocId: 'ref-1',
        referenceDoc: reference,
      });
      expect(finalQuestionRepo.findByReferenceQuestionId).toHaveBeenCalledWith(questionId, ['-embedding', '-deviceInfo']);
    });

    it('handles questions without a reference row', async () => {
      finalQuestionRepo.findByReferenceQuestionId.mockResolvedValue([]);

      await expect(service.getDistributionsForQuestion(questionId)).resolves.toEqual(
        expect.objectContaining({ referenceDocId: null, referenceDoc: null, states: [] }),
      );
    });
  });

  describe('listDistributions', () => {
    it('adds the distributor name and tester flag to each row with one user lookup', async () => {
      const distributor = new Types.ObjectId();
      const testerId = objectId();
      userRepo.findAll.mockImplementation(async (filter: Record<string, unknown>) =>
        filter.is_tester ? [{ _id: { toString: () => testerId } }] : [],
      );
      finalQuestionRepo.findAndCount.mockResolvedValue({
        data: [
          { id: 'a', distributorId: distributor, userId: testerId },
          { id: 'b', distributorId: distributor, userId: objectId() },
          { id: 'c', distributorId: null, userId: objectId() },
        ],
        total: 3,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      userRepo.findByIds.mockResolvedValue([{ id: distributor.toHexString(), name: 'Asha', username: 'asha' }]);

      const result = await service.listDistributions(distributorId, UserRole.DISTRIBUTOR, {});

      expect(userRepo.findByIds).toHaveBeenCalledWith([distributor.toHexString()]);
      expect(result.items.map((row) => row.distributor)).toEqual([
        { id: distributor.toHexString(), name: 'Asha', username: 'asha' },
        { id: distributor.toHexString(), name: 'Asha', username: 'asha' },
        null,
      ]);
      expect(result.items.map((row) => row.submitterIsTester)).toEqual([true, false, false]);
    });

    it.each([
      [{ questionType: 'original' as const }, { distributionState: null }],
      [{ questionType: 'distributed' as const }, { distributionState: { $ne: null } }],
      [{ distributionState: 'Kerala' }, { distributionState: 'Kerala' }],
    ])('filters by %p', async (dto, expected) => {
      finalQuestionRepo.findAndCount.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      userRepo.findByIds.mockResolvedValue([]);

      await service.listDistributions(distributorId, UserRole.DISTRIBUTOR, dto);

      expect(finalQuestionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining(expected), expect.anything());
    });
  });

  describe('getStats', () => {
    it('returns counts per state alongside the number of Indian states', async () => {
      finalQuestionRepo.countByDistributionState.mockResolvedValue([{ state: stateA, count: 4 }]);

      await expect(service.getStats()).resolves.toEqual({ indianStatesTotal: INDIAN_STATES.length, byState: [{ state: stateA, count: 4 }] });
    });
  });
});
