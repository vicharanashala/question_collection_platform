import axios, { AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';
import { LgdService } from './lgd.service';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});

const mockedGet = axios.get as jest.Mock;
const village = (code: number, name: string) => ({ villageCode: code, villageNameEnglish: name, blockCode: 10, pincode: '800001' });
const timeoutError = () => new AxiosError('timeout', 'ECONNABORTED');

// Builds the service with a short retry budget so tests run quickly.
function buildService(overrides: Record<string, number> = {}) {
  const values: Record<string, unknown> = {
    'lgd.lgdReviewerUri': 'http://reviewer',
    'lgd.cacheTtlDays': 7,
    'lgd.maxRetries': 2,
    'lgd.initialBackoffMs': 1,
    'lgd.totalTimeoutMs': 5_000,
    'lgd.attemptTimeoutMs': 1_000,
    ...overrides,
  };
  return new LgdService({ get: (key: string) => values[key] } as unknown as ConfigService);
}

describe('LgdService', () => {
  beforeEach(() => mockedGet.mockReset());

  it('shares one upstream request between concurrent callers for the same block', async () => {
    let resolve!: (value: unknown) => void;
    mockedGet.mockReturnValue(new Promise((r) => (resolve = r)));
    const service = buildService();

    const first = service.getVillages('10');
    const second = service.getVillages('10');
    resolve({ data: [village(2, 'Beta'), village(1, 'Alpha')] });

    const [a, b] = await Promise.all([first, second]);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(a.map((v) => v.villageNameEnglish)).toEqual(['Alpha', 'Beta']);
    expect(b).toBe(a);
  });

  it('retries a timed-out request and then caches the result', async () => {
    mockedGet.mockRejectedValueOnce(timeoutError()).mockResolvedValueOnce({ data: [village(1, 'Alpha')] });
    const service = buildService();

    await expect(service.getVillages('10')).resolves.toHaveLength(1);
    await expect(service.getVillages('10')).resolves.toHaveLength(1);
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it('does not cache an empty list', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [village(1, 'Alpha')] });
    const service = buildService();

    await expect(service.getVillages('10')).resolves.toHaveLength(0);
    await expect(service.getVillages('10')).resolves.toHaveLength(1);
  });

  it('serves the expired cached list when the upstream fails', async () => {
    mockedGet.mockResolvedValueOnce({ data: [village(1, 'Alpha')] });
    const service = buildService({ 'lgd.cacheTtlDays': 0 });
    await service.getVillages('10');

    mockedGet.mockRejectedValue(timeoutError());
    await expect(service.getVillages('10')).resolves.toEqual([
      expect.objectContaining({ villageNameEnglish: 'Alpha' }),
    ]);
  });

  it('fails once retries are exhausted and nothing is cached', async () => {
    mockedGet.mockRejectedValue(timeoutError());
    const service = buildService();

    await expect(service.getVillages('10')).rejects.toBeInstanceOf(AxiosError);
    expect(mockedGet).toHaveBeenCalledTimes(3);
  });
});
