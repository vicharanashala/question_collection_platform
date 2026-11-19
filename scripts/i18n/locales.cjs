const fs = require("node:fs");
const path = require("node:path");

// Shared paths and helpers for the frontend locale files. The scanner and the
// translator both use this module, so the folder layout is defined in one place.
const repoRoot = path.resolve(__dirname, "../..");
const frontendRoot = path.join(repoRoot, "frontend");
const localesDir = path.join(frontendRoot, "src/i18n/locales");
const typescriptDir = path.join(frontendRoot, "node_modules/typescript");

// i18next namespace that holds every UI string (see frontend/src/i18n/index.ts).
const NAMESPACE = "common";

// Returns the locale file for one language, e.g. frontend/src/i18n/locales/hi.json.
function localeFile(language) {
  return path.join(localesDir, `${language}.json`);
}

// Reads one locale file. Returns undefined when that language has no file.
function readLocale(language) {
  const file = localeFile(language);
  if (!fs.existsSync(file)) return undefined;

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in ${path.relative(repoRoot, file)}: ${error.message}`);
  }
}

// Flattens the common namespace into dotted keys, e.g. "faq.retry" -> "Try again".
function flattenNamespace(locale) {
  const result = new Map();

  function walk(node, prefix) {
    for (const [name, value] of Object.entries(node)) {
      const key = prefix ? `${prefix}.${name}` : name;
      if (typeof value === "string") result.set(key, value);
      else if (value && typeof value === "object") walk(value, key);
    }
  }

  const namespace = locale?.[NAMESPACE];
  if (namespace && typeof namespace === "object") walk(namespace, "");
  return result;
}

// Formats a locale exactly like the committed files: 2-space JSON, no trailing newline.
function serializeLocale(locale) {
  return JSON.stringify(locale, null, 2);
}

// Loads the TypeScript compiler installed for the frontend. The scanner parses source files with it.
function loadFrontendTypeScript() {
  if (!fs.existsSync(typescriptDir)) {
    throw new Error(
      `TypeScript not found at ${path.relative(repoRoot, typescriptDir)}. Run "npm install" in frontend/ first.`
    );
  }
  return require(typescriptDir);
}

module.exports = {
  repoRoot,
  frontendRoot,
  localesDir,
  NAMESPACE,
  localeFile,
  readLocale,
  flattenNamespace,
  serializeLocale,
  loadFrontendTypeScript,
};
