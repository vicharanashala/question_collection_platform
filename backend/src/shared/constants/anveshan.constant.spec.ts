import { isAnswerScoringEnabled } from './anveshan.constant';

describe('isAnswerScoringEnabled', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Sets the two variables the flag depends on.
  const given = (nodeEnv: string, flag?: string) => {
    process.env.NODE_ENV = nodeEnv;
    if (flag === undefined) delete process.env.ANSWER_SCORING_ENABLED;
    else process.env.ANSWER_SCORING_ENABLED = flag;
  };

  it('is on only in production with the flag set to true', () => {
    given('production', 'true');
    expect(isAnswerScoringEnabled()).toBe(true);
  });

  it.each([
    ['production', 'false'],
    ['production', undefined],
    ['staging', 'true'],
    ['development', 'true'],
  ])('is off for NODE_ENV=%s with ANSWER_SCORING_ENABLED=%s', (nodeEnv, flag) => {
    given(nodeEnv, flag);
    expect(isAnswerScoringEnabled()).toBe(false);
  });
});
