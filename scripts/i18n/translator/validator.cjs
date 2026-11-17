const PLACEHOLDER_PATTERN = /\{\{\s*[\w.-]+\s*\}\}|\{\s*[\w.-]+\s*\}/g;

function extractPlaceholders(value) {
  return (String(value).match(PLACEHOLDER_PATTERN) || []).sort();
}

function validateTranslation(sourceText, translatedText) {
  const errors = [];

  if (typeof translatedText !== "string" || !translatedText.trim()) {
    errors.push("Translation is empty.");
    return { valid: false, errors, placeholders: [] };
  }

  const sourcePlaceholders = extractPlaceholders(sourceText);
  const translatedPlaceholders = extractPlaceholders(translatedText);

  if (
    JSON.stringify(sourcePlaceholders) !==
    JSON.stringify(translatedPlaceholders)
  ) {
    errors.push(
      `Placeholder mismatch. Expected ${JSON.stringify(sourcePlaceholders)}, received ${JSON.stringify(translatedPlaceholders)}.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    placeholders: translatedPlaceholders,
  };
}

function validateApprovedEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("The approved translations input must be a non-empty JSON array.");
  }

  const seen = new Set();

  return entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Entry ${index + 1} must be an object.`);
    }

    const key = String(entry.key || "").trim();
    const text = String(entry.text || "");

    if (!key || !/^[\w-]+(?:\.[\w-]+)*$/.test(key)) {
      throw new Error(
        `Entry ${index + 1} has an invalid dotted key: ${JSON.stringify(entry.key)}`
      );
    }

    if (!text.trim()) {
      throw new Error(`Entry "${key}" has empty English text.`);
    }

    if (seen.has(key)) {
      throw new Error(`Duplicate translation key in input: "${key}".`);
    }

    seen.add(key);
    return { key, text };
  });
}

module.exports = {
  extractPlaceholders,
  validateTranslation,
  validateApprovedEntries,
};
