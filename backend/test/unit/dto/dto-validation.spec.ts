import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestOtpDto } from '../../../src/modules/auth/dto/request-otp.dto';
import { VerifyOtpDto } from '../../../src/modules/auth/dto/verify-otp.dto';
import { CreateReportDto } from '../../../src/modules/reports/dto/create-report.dto';
import { ReplyReportDto } from '../../../src/modules/reports/dto/reply-report.dto';
import { ListReportsDto } from '../../../src/modules/reports/dto/list-reports.dto';
import { AddPaymentDetailDto } from '../../../src/modules/wallets/dto/payment-details.dto';
import { AssignStatesDto } from '../../../src/modules/distributor/dto/assign-states.dto';
import { INDIAN_STATES } from '../../../src/shared/constants/indian-states.constant';

// Mirrors the global ValidationPipe: transform with implicit conversion, then validate with whitelisting.
async function check<T extends object>(dto: ClassConstructor<T>, payload: Record<string, unknown>) {
  const instance = plainToInstance(dto, payload, { enableImplicitConversion: true });
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  return { instance, failed: errors.map((e) => e.property) };
}

describe('DTO validation', () => {
  describe('RequestOtpDto', () => {
    it.each(['9876543210', '+919876543210'])('accepts the Indian mobile number %p', async (mobileNumber) => {
      expect((await check(RequestOtpDto, { mobileNumber })).failed).toEqual([]);
    });

    it.each(['12345', '0000000000', 'abcdefghij', ''])('rejects %p', async (mobileNumber) => {
      expect((await check(RequestOtpDto, { mobileNumber })).failed).toContain('mobileNumber');
    });

    it('rejects unknown fields', async () => {
      expect((await check(RequestOtpDto, { mobileNumber: '9876543210', role: 'admin' })).failed).toContain('role');
    });
  });

  describe('VerifyOtpDto', () => {
    it('accepts a 6 digit OTP', async () => {
      expect((await check(VerifyOtpDto, { mobileNumber: '+919876543210', otp: '123456' })).failed).toEqual([]);
    });

    it.each(['12345', '1234567', ''])('rejects OTP %p', async (otp) => {
      expect((await check(VerifyOtpDto, { mobileNumber: '+919876543210', otp })).failed).toContain('otp');
    });
  });

  describe('CreateReportDto', () => {
    const valid = { title: 'Payout missing', description: 'My withdrawal never arrived.', category: 'payout_issue' };

    it('accepts a valid report', async () => {
      expect((await check(CreateReportDto, valid)).failed).toEqual([]);
    });

    it.each([
      ['title', { title: 'Hey' }],
      ['title', { title: 'x'.repeat(101) }],
      ['description', { description: 'short' }],
      ['description', { description: 'x'.repeat(2001) }],
      ['category', { category: 'complaint' }],
      ['relatedEntityId', { relatedEntityId: '' }],
    ])('rejects an invalid %s', async (field, override) => {
      expect((await check(CreateReportDto, { ...valid, ...override })).failed).toContain(field);
    });
  });

  describe('ReplyReportDto', () => {
    it('rejects an empty reply and replies over 5000 characters', async () => {
      expect((await check(ReplyReportDto, { message: '' })).failed).toContain('message');
      expect((await check(ReplyReportDto, { message: 'x'.repeat(5001) })).failed).toContain('message');
    });
  });

  describe('ListReportsDto', () => {
    it('converts query strings to numbers and applies defaults', async () => {
      const { instance, failed } = await check(ListReportsDto, { page: '2' });

      expect(failed).toEqual([]);
      expect(instance.page).toBe(2);
      expect(instance.limit).toBe(20);
    });

    it.each([{ limit: '101' }, { page: '0' }, { tester: 'maybe' }, { anveshanScope: 'all' }])('rejects %p', async (query) => {
      expect((await check(ListReportsDto, query)).failed.length).toBeGreaterThan(0);
    });
  });

  describe('AddPaymentDetailDto', () => {
    it('accepts a UPI id', async () => {
      expect((await check(AddPaymentDetailDto, { payoutMethod: 'upi', upiId: 'ramesh.k@okaxis' })).failed).toEqual([]);
    });

    it.each(['ramesh', '@okaxis', 'r@1', 'ramesh@ok axis'])('rejects the UPI id %p', async (upiId) => {
      expect((await check(AddPaymentDetailDto, { payoutMethod: 'upi', upiId })).failed).toContain('upiId');
    });

    const bank = {
      payoutMethod: 'bank_transfer',
      accountNumber: '123456789012',
      confirmAccountNumber: '123456789012',
      ifsc: 'SBIN0001234',
      accountHolderName: 'Ramesh Kumar',
      bankName: 'State Bank of India',
    };

    it('accepts valid bank details without requiring a UPI id', async () => {
      expect((await check(AddPaymentDetailDto, bank)).failed).toEqual([]);
    });

    it.each([
      ['accountNumber', { accountNumber: '12345678' }],
      ['accountNumber', { accountNumber: '12345678901A' }],
      ['ifsc', { ifsc: 'sbin0001234' }],
      ['ifsc', { ifsc: 'SBIN1001234' }],
      ['accountHolderName', { accountHolderName: 'R' }],
    ])('rejects an invalid %s', async (field, override) => {
      expect((await check(AddPaymentDetailDto, { ...bank, ...override })).failed).toContain(field);
    });

    it('rejects unsupported payout methods', async () => {
      expect((await check(AddPaymentDetailDto, { payoutMethod: 'cash' })).failed).toContain('payoutMethod');
    });
  });

  describe('AssignStatesDto', () => {
    const [first, second] = INDIAN_STATES as unknown as string[];

    it('accepts known Indian states', async () => {
      expect((await check(AssignStatesDto, { states: [first, second] })).failed).toEqual([]);
    });

    it.each([[['Atlantis']], [[first, first]], ['Kerala']])('rejects %p', async (states) => {
      expect((await check(AssignStatesDto, { states })).failed).toContain('states');
    });
  });
});
