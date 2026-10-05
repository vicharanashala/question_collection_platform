import { ConfigService } from '@nestjs/config';
import { AnveshanScoringService } from './anveshan-scoring.service';

// Trimmed copy of a real GET /score/{job_id} response where the model checks failed.
const failedJobResponse = {
  jobId: 'job-1',
  status: 'failed',
  systemScore: 10,
  maxScore: 11,
  percentage: 90.9,
  needsHumanReview: true,
  reviewReasons: ['page_number_present FAILED: 1 source(s) have no page number.'],
  checks: [
    { parameter: 'banned_chemical', category: 'chemical', result: 'PASS', mark: 1, reason: 'No banned chemical found' },
    { parameter: 'source_fidelity', category: 'chemical', result: 'NOT_EVALUATED', mark: null, reason: 'No page is cited' },
  ],
  notApplicable: ['source_fidelity'],
  notEvaluated: ['answer_structure'],
  checkedAt: '2026-10-03T07:00:06.615038+00:00',
};

describe('AnveshanScoringService', () => {
  const config = { get: jest.fn().mockReturnValue('http://vm:8011') } as unknown as ConfigService;
  const service = new AnveshanScoringService(config);
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  // Makes fetch resolve with a 200 JSON response.
  const respondWith = (body: unknown) =>
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) });

  it('sends the answer in the scoring request format and returns the job id', async () => {
    respondWith({ job_id: 'job-1', status: 'processing' });

    const jobId = await service.startJob({
      answerId: 'a-1',
      question: 'Q',
      answer: 'A',
      crop: 'Paddy',
      state: 'Kerala',
      sources: [],
    });

    expect(jobId).toBe('job-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://vm:8011/score');
    expect(JSON.parse(init.body)).toEqual({ answer_id: 'a-1', question: 'Q', answer: 'A', crop: 'Paddy', state: 'Kerala', sources: [] });
  });

  it('keeps the partial score, null marks and full response of a failed job', async () => {
    respondWith(failedJobResponse);

    const job = await service.getJob('job-1');

    expect(job.status).toBe('failed');
    if (job.status !== 'failed') throw new Error('unexpected');
    expect(job.score).toEqual(
      expect.objectContaining({ status: 'failed', systemScore: 10, maxScore: 11, percentage: 90.9, needsHumanReview: true }),
    );
    expect(job.score.checks[1]).toEqual(expect.objectContaining({ result: 'NOT_EVALUATED', mark: null }));
    expect(job.score.response).toEqual(failedJobResponse);
  });

  it('reports a processing job without score fields', async () => {
    respondWith({ jobId: 'job-1', status: 'processing' });

    await expect(service.getJob('job-1')).resolves.toEqual({ status: 'processing' });
  });

  it('reports a job the scoring service does not know as missing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('Job not found') });

    await expect(service.getJob('job-1')).resolves.toEqual({ status: 'missing' });
  });

  it('throws when the scoring service returns an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, text: () => Promise.resolve('bad') });

    await expect(service.getJob('job-1')).rejects.toThrow('Scoring service responded with 422');
  });
});
