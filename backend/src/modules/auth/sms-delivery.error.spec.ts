import { AxiosError, AxiosHeaders } from 'axios';
import { SmsDeliveryError, SmsFailureReason, classifySmsError } from './sms-delivery.error';

// Builds an axios error with an optional HTTP status and error code.
function axiosError(status?: number, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = status
    ? { status, statusText: '', data: {}, headers: {}, config }
    : undefined;
  return new AxiosError('failed', code, config, undefined, response);
}

describe('classifySmsError', () => {
  it.each([
    [axiosError(401), SmsFailureReason.AUTH_FAILED],
    [axiosError(403), SmsFailureReason.AUTH_FAILED],
    [axiosError(400), SmsFailureReason.REJECTED],
    [axiosError(504), SmsFailureReason.TIMEOUT],
    [axiosError(500), SmsFailureReason.GATEWAY_ERROR],
    [axiosError(undefined, 'ECONNABORTED'), SmsFailureReason.TIMEOUT],
    [axiosError(undefined, 'ENOTFOUND'), SmsFailureReason.UNREACHABLE],
    [new Error('boom'), SmsFailureReason.UNKNOWN],
  ])('maps %p to %s', (err, expected) => {
    expect(classifySmsError(err)).toBe(expected);
  });

  it('keeps the reason carried by an SmsDeliveryError', () => {
    const err = new SmsDeliveryError('missing key', SmsFailureReason.NOT_CONFIGURED);
    expect(classifySmsError(err)).toBe(SmsFailureReason.NOT_CONFIGURED);
  });
});
