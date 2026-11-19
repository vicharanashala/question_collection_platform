const fs = require("node:fs");
const path = require("node:path");

const { LANGUAGES } = require("./config.cjs");
const {
  NAMESPACE,
  localeFile,
  readLocale,
  serializeLocale,
} = require("../locales.cjs");

// Backups go to the git-ignored reports folder so they never land next to source files.
const backupRoot = path.resolve(__dirname, "../reports");

// Key segments that would reach Object.prototype instead of creating a normal property.
const UNSAFE_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Adds one dotted key to a parsed locale under the common namespace. Never overwrites an existing value.
function addMissingValue(locale, dottedKey, value) {
  const parts = dottedKey.split(".");
  if (parts.some((part) => UNSAFE_SEGMENTS.has(part))) {
    return { added: false, reason: "unsafe-key" };
  }
  if (!isPlainObject(locale[NAMESPACE])) {
    return { added: false, reason: `missing-${NAMESPACE}-namespace` };
  }

  let node = locale[NAMESPACE];
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];
    if (!Object.hasOwn(node, part)) {
      node[part] = {};
    } else if (!isPlainObject(node[part])) {
      return { added: false, reason: `path-conflict-at-${parts.slice(0, index + 1).join(".")}` };
    }
    node = node[part];
  }

  const leaf = parts[parts.length - 1];
  if (Object.hasOwn(node, leaf)) {
    return typeof node[leaf] === "string"
      ? { added: false, reason: "already-exists" }
      : { added: false, reason: `key-is-a-group-${dottedKey}` };
  }

  node[leaf] = value;
  return { added: true };
}

// Writes validated translations into every locale file. All checks run before any write,
// so a failure leaves every file untouched.
function applyTranslations(report) {
  const items = Array.isArray(report?.translations) ? report.translations : [];
  if (
    !report?.summary?.readyToApply ||
    items.length === 0 ||
    items.some((item) => item.status !== "valid")
  ) {
    throw new Error(
      "Refusing to update the locale files: one or more translations failed validation."
    );
  }

  const targetLanguages = Object.keys(LANGUAGES);
  const locales = new Map();
  for (const language of ["en", ...targetLanguages]) {
    const locale = readLocale(language);
    if (!locale) throw new Error(`Locale file not found: ${localeFile(language)}`);
    locales.set(language, locale);
  }

  const additions = [];
  for (const item of items) {
    const values = { en: item.sourceText };
    for (const language of targetLanguages) {
      const translation = item.translations?.[language];
      if (translation?.status !== "valid" || !translation.text) {
        throw new Error(`Invalid or missing ${language} translation for ${item.key}.`);
      }
      values[language] = translation.text;
    }

    for (const [language, value] of Object.entries(values)) {
      const result = addMissingValue(locales.get(language), item.key, value);
      if (result.added) {
        additions.push({ language, key: item.key });
      } else if (result.reason !== "already-exists") {
        throw new Error(`Could not add ${language}.${NAMESPACE}.${item.key}: ${result.reason}`);
      }
    }
  }

  const changedLanguages = [...new Set(additions.map(({ language }) => language))];
  if (changedLanguages.length === 0) {
    return { added: 0, additions, files: [], backupDir: undefined };
  }

  const backupDir = path.join(backupRoot, `locales-backup-${Date.now()}`);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const language of changedLanguages) {
    fs.copyFileSync(localeFile(language), path.join(backupDir, `${language}.json`));
  }
  for (const language of changedLanguages) {
    fs.writeFileSync(localeFile(language), serializeLocale(locales.get(language)), "utf8");
  }

  return {
    added: additions.length,
    additions,
    files: changedLanguages.map(localeFile),
    backupDir,
  };
}

module.exports = { applyTranslations };
