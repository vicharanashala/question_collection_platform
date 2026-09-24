import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosHeaders } from 'axios';
import { BrpsTokenService } from './brps-token.service';
import { SmsBsnlBrpsService } from './sms-bsnl-brps.service';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, __esModule: true, default: { ...actual.default, post: jest.fn() } };
});

const mockedPost = axios.post as jest.Mock;

// Builds an axios error carrying the given HTTP status.
const httpError = (status: number): AxiosError =>
  new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: '',
  });

describe('SmsBsnlBrpsService', () => {
  let service: SmsBsnlBrpsService;
  let tokenService: { getValidToken: jest.Mock; invalidateToken: jest.Mock };

  beforeEach(() => {
    mockedPost.mockReset();
    tokenService = {
      getValidToken: jest.fn().mockResolvedValueOnce('stale').mockResolvedValueOnce('fresh'),
      invalidateToken: jest.fn(),
    };
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    service = new SmsBsnlBrpsService(config, tokenService as unknown as BrpsTokenService);
    jest.spyOn(service['logger'], 'error').mockImplementation();
    jest.spyOn(service['logger'], 'warn').mockImplementation();
    jest.spyOn(service['logger'], 'log').mockImplementation();
  });

  it('refreshes the token and retries once on 401', async () => {
    mockedPost.mockRejectedValueOnce(httpError(401)).mockResolvedValueOnce({ data: { Error: null, Message_Id: '1' } });

    await service.sendOtp('+919876543210', '123456');

    expect(tokenService.invalidateToken).toHaveBeenCalledWith('stale');
    expect(mockedPost).toHaveBeenCalledTimes(2);
    expect(mockedPost.mock.calls[1][2].headers.Authorization).toBe('Bearer fresh');
  });

  it('does not retry on other errors and throws a plain error', async () => {
    mockedPost.mockRejectedValueOnce(httpError(500));

    const error = await service.sendOtp('9876543210', '123456').catch((e: unknown) => e);

    expect(axios.isAxiosError(error)).toBe(false);
    expect((error as Error).message).toBe('BRPS send failed: HTTP 500');
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry also returns 401', async () => {
    mockedPost.mockRejectedValue(httpError(401));

    await expect(service.sendOtp('9876543210', '123456')).rejects.toThrow('BRPS send failed: HTTP 401');
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });
});
