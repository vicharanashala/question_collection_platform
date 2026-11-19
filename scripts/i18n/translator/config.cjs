const LANGUAGES = {
  as: "as-IN",
  bn: "bn-IN",
  brx: "brx-IN",
  doi: "doi-IN",
  gu: "gu-IN",
  hi: "hi-IN",
  kn: "kn-IN",
  ks: "ks-IN",
  kok: "kok-IN",
  mai: "mai-IN",
  ml: "ml-IN",
  mni: "mni-IN",
  mr: "mr-IN",
  ne: "ne-IN",
  or: "od-IN", // Sarvam uses od-IN for Odia, not the ISO or-IN
  pa: "pa-IN",
  sa: "sa-IN",
  sat: "sat-IN",
  sd: "sd-IN",
  ta: "ta-IN",
  te: "te-IN",
  ur: "ur-IN",
};

const DEFAULTS = {
  sourceLanguage: "en-IN",
  requestConcurrency: 3,
  batchSize: 50,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
};

module.exports = { LANGUAGES, DEFAULTS };
