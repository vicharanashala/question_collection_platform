import { ConfigService } from '@nestjs/config';
import { GdbService, isGdbDuplicateCheckEnabled } from './gdb.service';
import { SarvamService } from '../speech/sarvam.service';
import { IQuestionRepository } from '../../shared/database/repositories/IQuestion.repository';

describe('GDB duplicate check flag', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Sets NODE_ENV and the flag; an undefined flag removes it.
  const given = (nodeEnv: string, flag?: string) => {
    process.env.NODE_ENV = nodeEnv;
    if (flag === undefined) delete process.env.GDB_DUPLICATE_CHECK_ENABLED;
    else process.env.GDB_DUPLICATE_CHECK_ENABLED = flag;
  };

  it.each([
    ['production', undefined, true],
    ['staging', undefined, false],
    ['development', undefined, false],
    ['production', 'false', false],
    ['staging', 'true', true],
    ['development', 'TRUE', true],
  ])('NODE_ENV=%s with GDB_DUPLICATE_CHECK_ENABLED=%s is %s', (nodeEnv, flag, expected) => {
    given(nodeEnv, flag);
    expect(isGdbDuplicateCheckEnabled()).toBe(expected);
  });

  describe('GdbService', () => {
    const fetchMock = jest.fn();
    const config = { get: jest.fn().mockReturnValue('http://vm:8110') } as unknown as ConfigService;
    const service = new GdbService(config, {} as SarvamService, {} as IQuestionRepository);

    beforeEach(() => {
      fetchMock.mockReset();
      global.fetch = fetchMock as unknown as typeof fetch;
    });

    it('treats the question as new without calling GDB when the check is off', async () => {
      given('staging', 'false');

      const duplicate = await service.checkDuplicate({ questionText: 'Why are my paddy leaves yellow?' });
      const classified = await service.classifyQuery({ questionText: 'Why are my paddy leaves yellow?' });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(duplicate).toEqual(expect.objectContaining({ isDuplicate: false, rejection: null }));
      expect(classified).toEqual(expect.objectContaining({ isDuplicate: false, rejection: null }));
    });

    it('calls GDB when the check is on', async () => {
      given('production');
      fetchMock.mockRejectedValue(new Error('connection refused'));

      await service.classifyQuery({ questionText: 'Why are my paddy leaves yellow?', languageCode: 'en' });

      expect(fetchMock).toHaveBeenCalledWith('http://vm:8110/v1/classify-query', expect.objectContaining({ method: 'POST' }));
    });
  });
});
