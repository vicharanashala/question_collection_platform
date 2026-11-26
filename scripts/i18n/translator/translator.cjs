const { LANGUAGES, DEFAULTS } = require("./config.cjs");
const { validateTranslation } = require("./validator.cjs");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error) {
  return error.status === 429 || error.status >= 500 || error.status === undefined || error.retryable === true;
}

// Errors caused by setup (bad URL, key or method) will fail for every request, so the run stops early.
function isConfigurationError(error) {
  return [401, 403, 404, 405].includes(error.status);
}

async function withRetry(operation, options) {
  let lastError;
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === options.maxRetries) break;
      const retryAfterMs = Number(error.retryAfter) * 1000;
      const delay = Number.isFinite(retryAfterMs) && retryAfterMs > 0
        ? retryAfterMs
        : options.retryBaseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function normalizeBatchResult(result, expectedItem) {
  const translatedText = result?.translatedText ?? result?.translated_text ?? result?.output;
  if (result?.status === "failed" || result?.error) {
    throw new Error(result.error || result.message || `Translation failed for ${expectedItem.key}`);
  }
  if (typeof translatedText !== "string" || !translatedText.trim()) {
    throw new Error(`Bulk response did not contain translatedText for key: ${expectedItem.key}`);
  }
  return translatedText.trim();
}

// onProgress receives { phase, completed, total, language } as languages finish and failures are retried.
async function translateEntries(entries, provider, options = {}, onProgress = () => {}) {
  const settings = { ...DEFAULTS, ...options };
  const batchSize = settings.batchSize;
  const results = [];
  const totalItems = entries.length * Object.keys(LANGUAGES).length;

  for (const [language, targetLanguage] of Object.entries(LANGUAGES)) {
    const languageBatches = chunk(entries, batchSize).map((items) => ({
      language,
      targetLanguage,
      items,
    }));

    const batchResults = await mapWithConcurrency(
      languageBatches,
      settings.requestConcurrency,
      async (batch) => {
        let responseItems;
        try {
          responseItems = await withRetry(
            () => provider.translateBatch(batch.items, batch.targetLanguage, settings.sourceLanguage),
            settings
          );
        } catch (batchError) {
          if (isConfigurationError(batchError)) {
            throw new Error(`Bulk translation endpoint rejected the request (HTTP ${batchError.status}): ${batchError.message}`);
          }
          // If a batch fails as a whole, retry its items individually through the same bulk endpoint.
          // This isolates problematic items and preserves successful results from other batches.
          return mapWithConcurrency(batch.items, settings.requestConcurrency, async (item) => {
            try {
              return await translateSingleItem(provider, item, batch, settings);
            } catch (error) {
              return makeFailedResult(item, batch, error);
            }
          });
        }

        const byKey = new Map(responseItems.map((row) => [row.key, row]));
        return mapWithConcurrency(batch.items, settings.requestConcurrency, async (item) => {
          try {
            const row = byKey.get(item.key);
            if (!row || row.status === "failed" || row.error) {
              // Retry only the failed/missing item; don't repeat successful translations.
              return await translateSingleItem(provider, item, batch, settings);
            }
            const translatedText = normalizeBatchResult(row, item);
            const validation = validateTranslation(item.text, translatedText);
            return makeResult(item, batch, translatedText, validation);
          } catch (error) {
            return makeFailedResult(item, batch, error);
          }
        });
      }
    );

    for (const batchResult of batchResults) results.push(...batchResult);
    onProgress({ phase: "translate", completed: results.length, total: totalItems, language });
  }

  await retryFailedResults(results, entries, provider, settings, onProgress);

  const resultByKey = new Map();
  for (const result of results) {
    if (!resultByKey.has(result.key)) resultByKey.set(result.key, {});
    resultByKey.get(result.key)[result.language] = {
      languageCode: result.targetLanguage,
      text: result.translatedText,
      status: result.status,
      errors: result.validationErrors,
    };
  }

  const translations = entries.map((entry) => {
    const languageResults = resultByKey.get(entry.key) || {};
    const allValid = Object.keys(LANGUAGES).every((language) => languageResults[language]?.status === "valid");
    return {
      key: entry.key,
      sourceText: entry.text,
      status: allValid ? "valid" : "needs-review",
      translations: languageResults,
    };
  });

  const total = results.length;
  const valid = results.filter((item) => item.status === "valid").length;
  const failed = results.filter((item) => item.status === "failed").length;
  const invalid = results.filter((item) => item.status === "invalid").length;
  const batchCount = Object.keys(LANGUAGES).reduce((sum) => sum + Math.ceil(entries.length / batchSize), 0);

  return {
    generatedAt: new Date().toISOString(),
    provider: "sarvam-via-backend-bulk",
    sourceLanguage: settings.sourceLanguage,
    expectedTargetLanguages: Object.keys(LANGUAGES),
    summary: {
      inputKeys: entries.length,
      targetLanguages: Object.keys(LANGUAGES).length,
      batchSize,
      bulkRequests: batchCount,
      translationItems: total,
      valid,
      invalid,
      failed,
      readyToApply: valid === total && total > 0,
    },
    translations,
  };
}

// Turns a failed row inside a successful bulk response into an error that withRetry retries.
function retryableItemError(row, item) {
  const error = new Error(row?.error || row?.message || `Translation failed for ${item.key}`);
  error.retryable = true;
  return error;
}

// Translates one item through the bulk endpoint, retrying with growing pauses until it succeeds.
async function translateSingleItem(provider, item, batch, settings) {
  const row = await withRetry(async () => {
    const rows = await provider.translateBatch([item], batch.targetLanguage, settings.sourceLanguage);
    const match = rows.find((candidate) => candidate.key === item.key);
    if (!match || match.status === "failed" || match.error) throw retryableItemError(match, item);
    return match;
  }, { ...settings, retryBaseDelayMs: settings.itemRetryDelayMs });
  const translatedText = normalizeBatchResult(row, item);
  return makeResult(item, batch, translatedText, validateTranslation(item.text, translatedText));
}

// Retries what is still failing, one at a time after a cool-down, so a rate limit can reset.
async function retryFailedResults(results, entries, provider, settings, onProgress) {
  const failed = results.filter((result) => result.status === "failed");
  if (failed.length === 0 || settings.finalPassDelayMs <= 0) return;

  onProgress({ phase: "cooldown", waitMs: settings.finalPassDelayMs, total: failed.length });
  await sleep(settings.finalPassDelayMs);

  const entryByKey = new Map(entries.map((entry) => [entry.key, entry]));
  // One attempt each: the cool-down already gave the rate limit time to reset.
  const singleAttempt = { ...settings, maxRetries: 1 };
  for (const [index, previous] of failed.entries()) {
    const item = entryByKey.get(previous.key);
    const batch = { language: previous.language, targetLanguage: previous.targetLanguage };
    let retried;
    try {
      retried = await translateSingleItem(provider, item, batch, singleAttempt);
    } catch (error) {
      retried = makeFailedResult(item, batch, error);
    }
    results[results.indexOf(previous)] = retried;
    onProgress({ phase: "retry", completed: index + 1, total: failed.length, language: previous.language });
  }
}

function makeResult(item, batch, translatedText, validation) {
  return {
    key: item.key,
    language: batch.language,
    targetLanguage: batch.targetLanguage,
    translatedText,
    status: validation.valid ? "valid" : "invalid",
    validationErrors: validation.errors,
  };
}

function makeFailedResult(item, batch, error) {
  return {
    key: item.key,
    language: batch.language,
    targetLanguage: batch.targetLanguage,
    translatedText: null,
    status: "failed",
    validationErrors: [error.message],
  };
}

module.exports = { translateEntries };
