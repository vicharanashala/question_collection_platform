class SarvamProvider {
  constructor(options = {}) {
    const baseUrl = (options.baseUrl || process.env.I18N_API_BASE_URL || "http://localhost:3000/api/v1").replace(/\/+$/, "");
    this.bulkTranslateUrl = options.bulkTranslateUrl || process.env.I18N_BULK_TRANSLATE_URL ||
      `${baseUrl}/speech/translate/bulk`;
    this.timeoutMs = options.timeoutMs || 60000;
  }

  async translateBatch(items, targetLanguage, sourceLanguage = "en-IN") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.bulkTranslateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: items.map(({ key, text }) => ({ key, text })),
          targetLanguage,
          sourceLanguage,
        }),
        signal: controller.signal,
      });

      const responseText = await response.text();
      let payload;
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = { message: responseText };
      }

      if (!response.ok) {
        const error = new Error(payload?.message || payload?.error || `Bulk translation API returned HTTP ${response.status}`);
        error.status = response.status;
        error.retryAfter = response.headers.get("retry-after");
        throw error;
      }

      const results = payload?.results ?? payload?.data?.results;
      if (!Array.isArray(results)) {
        throw new Error(`Unexpected bulk translation response: ${JSON.stringify(payload).slice(0, 700)}`);
      }
      return results;
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error(`Bulk translation request timed out after ${this.timeoutMs}ms`);
        timeoutError.retryable = true;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { SarvamProvider };
