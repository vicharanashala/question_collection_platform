import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AgriEntitiesService } from './agri-entities.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { AgriEntityStatus, AgriEntityType } from '../../shared/classes/enums';
import { SubmitAgriEntityDto } from './dto';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ownImage = `gs://bucket/staging/agri-entities/crops/${USER_ID}/2026-09/abc_tomato_1.jpg`;

// Builds a valid crop submission, optionally overriding fields.
const buildDto = (overrides: Partial<SubmitAgriEntityDto> = {}): SubmitAgriEntityDto => ({
  type: AgriEntityType.CROP,
  localName: 'Thakkali',
  englishName: 'Tomato',
  botanicalName: 'Solanum lycopersicum',
  localNameSource: 'TNAU Agritech Portal',
  alternateNames: [{ name: 'Tamatar', source: 'ICAR crop glossary' }],
  imageUrls: [ownImage],
  ...overrides,
});

describe('AgriEntitiesService', () => {
  let service: AgriEntitiesService;
  const repo = { create: jest.fn(), findAndCount: jest.fn() };
  const userRepo = { findByIds: jest.fn() };

  beforeEach(async () => {
    repo.create.mockReset();
    repo.findAndCount.mockReset();
    userRepo.findByIds.mockReset();
    repo.create.mockImplementation((data) => Promise.resolve({ id: 'entity-1', ...data }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgriEntitiesService,
        { provide: REPOSITORY_TOKENS.AgriEntity, useValue: repo },
        { provide: REPOSITORY_TOKENS.User, useValue: userRepo },
      ],
    }).compile();
    service = module.get(AgriEntitiesService);
  });

  it('saves a valid submission as pending for the user', async () => {
    const result = await service.submit(USER_ID, buildDto());

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        type: AgriEntityType.CROP,
        englishName: 'Tomato',
        imageUrls: [ownImage],
        status: AgriEntityStatus.PENDING,
      }),
    );
    expect(result).toEqual({ id: 'entity-1', status: AgriEntityStatus.PENDING, message: expect.any(String) });
  });

  it('rejects images that are not storage URIs', async () => {
    await expect(
      service.submit(USER_ID, buildDto({ imageUrls: ['https://example.com/a.jpg'] })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("rejects images from another user's folder", async () => {
    const foreign = ownImage.replace(USER_ID, '22222222-2222-2222-2222-222222222222');
    await expect(service.submit(USER_ID, buildDto({ imageUrls: [foreign] }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects images uploaded for a different entity type', async () => {
    await expect(
      service.submit(USER_ID, buildDto({ type: AgriEntityType.WEED })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lists only the user's own submissions, newest first, with filters", async () => {
    repo.findAndCount.mockResolvedValue({ data: [{ id: 'entity-1' }], total: 21, page: 2, limit: 20, totalPages: 2 });

    const result = await service.listMine(USER_ID, {
      type: AgriEntityType.WEED,
      status: AgriEntityStatus.PENDING,
      page: 2,
      limit: 20,
    });

    expect(repo.findAndCount).toHaveBeenCalledWith(
      { userId: USER_ID, type: AgriEntityType.WEED, status: AgriEntityStatus.PENDING },
      { pagination: { page: 2, limit: 20, sort: { createdAt: -1 } } },
    );
    expect(result).toEqual({ items: [{ id: 'entity-1' }], total: 21, page: 2, limit: 20, pages: 2 });
  });

  it('omits type and status from the filter when not given', async () => {
    repo.findAndCount.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    await service.listMine(USER_ID, {});

    expect(repo.findAndCount).toHaveBeenCalledWith(
      { userId: USER_ID },
      { pagination: { page: 1, limit: 20, sort: { createdAt: -1 } } },
    );
  });

  it("lists every user's submissions with the submitter attached", async () => {
    const OTHER_ID = '22222222-2222-2222-2222-222222222222';
    repo.findAndCount.mockResolvedValue({
      data: [{ id: 'e1', userId: USER_ID }, { id: 'e2', userId: OTHER_ID }],
      total: 2, page: 1, limit: 20, totalPages: 1,
    });
    userRepo.findByIds.mockResolvedValue([{ id: USER_ID, name: 'Ravi', username: 'ravi' }]);

    const result = await service.listAll({ type: AgriEntityType.PEST });

    expect(repo.findAndCount).toHaveBeenCalledWith(
      { type: AgriEntityType.PEST },
      { pagination: { page: 1, limit: 20, sort: { createdAt: -1 } } },
    );
    expect(userRepo.findByIds).toHaveBeenCalledWith([USER_ID, OTHER_ID]);
    expect(result.items).toEqual([
      { id: 'e1', userId: USER_ID, submitter: { id: USER_ID, name: 'Ravi', username: 'ravi' } },
      { id: 'e2', userId: OTHER_ID, submitter: null },
    ]);
    expect(result).toMatchObject({ total: 2, page: 1, limit: 20, pages: 1 });
  });
});
