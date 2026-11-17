class SarvamProvider {
  constructor(options = {}) {
    const baseUrl = (options.baseUrl || process.env.I18N_API_BASE_URL || "http://localhost:3000/api/v1").replace(/\/+$/, "");
    const explicitUrl = options.translateUrl || process.env.I18N_TRANSLATE_URL;

    this.bulkTranslateUrl = options.bulkTranslateUrl || process.env.I18N_BULK_TRANSLATE_URL ||
      (explicitUrl
        ? explicitUrl.replace(/\/translate(?:\/internal)?\/?$/, "/translate/bulk")
        : `${baseUrl}/speech/translate/bulk`);
    this.apiKey = options.apiKey || process.env.I18N_API_KEY || "";
    this.timeoutMs = options.timeoutMs || 60000;

    if (!this.apiKey) {
      throw new Error(
        "Set I18N_API_KEY to the same value configured as ANVESHAN_ANNADATHA_AUTH_KEY in the backend."
      );
    }
  }

  async translateBatch(items, targetLanguage, sourceLanguage = "en-IN") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.bulkTranslateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
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
