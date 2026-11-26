#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { DEFAULTS, LANGUAGES } = require("./config.cjs");
const { style, step, detail, createProgress, countdown, formatDuration, languageName } = require("./progress.cjs");
const { SarvamProvider } = require("./providers/sarvam.cjs");
const { validateApprovedEntries } = require("./validator.cjs");
const { translateEntries } = require("./translator.cjs");
const { applyTranslations } = require("./resource-writer.cjs");

const repoRoot = path.resolve(__dirname, "../../..");
const scannerFile = path.join(repoRoot, "scripts/i18n/scan-web-i18n.cjs");
const scanReportFile = path.join(repoRoot, "scripts/i18n/reports/incremental-scan.json");
const defaultInput = path.join(__dirname, "generated/approved-translations.json");
const defaultOutput = path.join(
  repoRoot,
  "scripts/i18n/reports/translation-preview.json"
);
const resourceFile = path.join(repoRoot, "web/src/i18n/resources.ts");

// Used only for the up-front time estimate; the progress bar switches to measured speed.
// The backend translates 5 items at a time per request (speech.controller.ts), and one
// round of Sarvam calls takes roughly this long.
const BACKEND_PARALLEL_TRANSLATIONS = 5;
const ESTIMATED_MS_PER_ROUND = 2500;
const ESTIMATED_MS_PER_RETRY = 4000;
const STEPS = 3;

function getArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value after ${name}.`);
  }
  return value;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function runScanner(baseRef) {
  if (!fs.existsSync(scannerFile)) {
    throw new Error(`Scanner not found: ${scannerFile}`);
  }

  fs.mkdirSync(path.dirname(scanReportFile), { recursive: true });
  try {
    execFileSync(
      process.execPath,
      [scannerFile, "scan", "--base", baseRef, "--out", path.relative(repoRoot, scanReportFile)],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`.trim();
    throw new Error(`Scanner failed${error.status ? ` (exit ${error.status})` : ""}.${output ? `\n${output}` : ""}`);
  }

  if (!fs.existsSync(scanReportFile)) {
    throw new Error(`Scanner did not generate its report: ${scanReportFile}`);
  }
  return JSON.parse(fs.readFileSync(scanReportFile, "utf8"));
}

function getPropertyName(ts, name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function findObjectProperty(ts, objectNode, wantedName) {
  if (!objectNode || !ts.isObjectLiteralExpression(objectNode)) return undefined;
  return objectNode.properties.find((property) =>
    ts.isPropertyAssignment(property) &&
    getPropertyName(ts, property.name) === wantedName
  );
}

// Reads every English key under resources.en.common with its text, so new strings can reuse existing keys.
function getExistingEnglishEntries() {
  const tsPath = path.join(repoRoot, "web/node_modules/typescript");
  if (!fs.existsSync(tsPath)) {
    throw new Error("TypeScript dependency not found at web/node_modules/typescript.");
  }
  const ts = require(tsPath);
  const sourceText = fs.readFileSync(resourceFile, "utf8");
  const source = ts.createSourceFile(resourceFile, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let resourcesNode;

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "resources") {
      resourcesNode = node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  const englishProperty = findObjectProperty(ts, resourcesNode, "en");
  const commonProperty = findObjectProperty(ts, englishProperty?.initializer, "common");
  const existing = new Map();

  function flatten(node, prefix = []) {
    if (!node || !ts.isObjectLiteralExpression(node)) return;
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = getPropertyName(ts, property.name);
      if (!name) continue;
      const next = [...prefix, name];
      if (ts.isObjectLiteralExpression(property.initializer)) flatten(property.initializer, next);
      else if (ts.isStringLiteralLike(property.initializer)) existing.set(next.join("."), property.initializer.text);
      else existing.set(next.join("."), undefined);
    }
  }
  flatten(commonProperty?.initializer);
  return existing;
}

// Turns scanner findings into unique key/text entries, skipping text that already has an English key.
function createGeneratedEntries(scanReport) {
  const findings = Array.isArray(scanReport.highConfidenceFindings)
    ? scanReport.highConfidenceFindings
    : [];
  const existingEntries = getExistingEnglishEntries();
  const usedKeys = new Set(existingEntries.keys());
  const keyByText = new Map();
  for (const [key, text] of existingEntries) {
    if (typeof text === "string" && !keyByText.has(text)) keyByText.set(text, key);
  }
  const byKey = new Map();
  const skipped = [];

  for (const finding of findings) {
    const text = String(finding.text || "").trim();
    const baseKey = String(finding.suggestedKey || "").trim();

    if (!text || !baseKey || !/^[\w-]+(?:\.[\w-]+)*$/.test(baseKey)) {
      skipped.push({ finding, reason: "Missing or invalid suggested translation key/text." });
      continue;
    }

    const existingKey = keyByText.get(text);
    if (existingKey) {
      if (!byKey.has(existingKey)) {
        skipped.push({ finding, reason: `Text already exists under key "${existingKey}". Reuse that key.` });
      }
      continue;
    }

    // Keep generated keys unique and never replace an existing English key.
    let key = baseKey;
    let suffix = 2;
    while (usedKeys.has(key)) key = `${baseKey}${suffix++}`;
    usedKeys.add(key);
    keyByText.set(text, key);
    byKey.set(key, { key, text, source: { file: finding.file, line: finding.line } });
  }

  return { entries: [...byKey.values()], skipped };
}

function writeGeneratedInput(entries, scanReport) {
  fs.mkdirSync(path.dirname(defaultInput), { recursive: true });
  const output = entries.map(({ key, text }) => ({ key, text }));
  fs.writeFileSync(defaultInput, JSON.stringify(output, null, 2) + "\n", "utf8");
  fs.writeFileSync(
    `${defaultInput}.meta.json`,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      sourceReport: path.relative(repoRoot, scanReportFile),
      baseRef: scanReport.baseRef,
      eligibleFindings: entries,
      ambiguousFindings: scanReport.ambiguousFindings || [],
      dynamicKeys: scanReport.dynamicKeys || [],
    }, null, 2) + "\n",
    "utf8"
  );
}

// Writes a validated translation report into resources.ts and prints what changed.
function applyReport(report) {
  const result = applyTranslations(resourceFile, report);
  detail(style.green(`✓ Added ${result.added} values to ${path.relative(repoRoot, resourceFile)}`));
  detail(style.dim(`Backup: ${path.relative(repoRoot, result.backupFile)}`));
}

// Reads the parallel request count from --concurrency or I18N_CONCURRENCY, so a run can go slower.
function getConcurrency() {
  const value = Number(getArgument("--concurrency", process.env.I18N_CONCURRENCY || DEFAULTS.requestConcurrency));
  if (!Number.isInteger(value) || value < 1) throw new Error("Concurrency must be a whole number of 1 or more.");
  return value;
}

// Rough time for the whole run, shown before the first request.
function estimateDurationMs(entryCount) {
  const languageCount = Object.keys(LANGUAGES).length;
  return languageCount * Math.ceil(entryCount / BACKEND_PARALLEL_TRANSLATIONS) * ESTIMATED_MS_PER_ROUND;
}

// Prints the scan in a few lines instead of the scanner's full JSON summary.
function printScanSummary(scanReport, entries, skipped) {
  const summary = scanReport.summary || {};
  detail(`${summary.changedFilesScanned ?? 0} changed files, ${summary.changedLinesScanned ?? 0} changed lines`);
  detail(`${style.bold(entries.length)} new strings to translate` +
    style.dim(` · ${(scanReport.ambiguousFindings || []).length} held for review · ${(scanReport.dynamicKeys || []).length} dynamic keys`));
  const reusable = skipped.filter(({ reason }) => reason.startsWith("Text already exists"));
  if (reusable.length) {
    detail(style.yellow(`${reusable.length} strings already have keys. Use these instead of translating again:`));
    for (const { finding, reason } of reusable) {
      const key = reason.match(/"([^"]+)"/)?.[1] ?? "?";
      detail(`  • ${path.basename(finding.file ?? "unknown")}:${finding.line ?? "?"}  "${finding.text}" → ${style.cyan(key)}`);
    }
  }
  for (const { finding, reason } of skipped.filter(({ reason }) => !reason.startsWith("Text already exists"))) {
    detail(style.dim(`  • ${finding.file ?? "unknown"}:${finding.line ?? "?"} ${reason}`));
  }
}

// Runs the translation with a live progress bar, countdown and retry pass.
async function translateWithProgress(entries, provider, settings) {
  const languageCount = Object.keys(LANGUAGES).length;
  const total = entries.length * languageCount;
  step(2, STEPS, `Translating ${entries.length} strings into ${languageCount} languages (${total} translations)`);
  detail(style.dim(`Estimated time: about ${formatDuration(estimateDurationMs(entries.length))} · ${settings.requestConcurrency} parallel request(s)`));

  const startedAt = Date.now();
  const progress = createProgress(total, estimateDurationMs(entries.length));
  let retryProgress;
  const report = await translateEntries(entries, provider, settings, (event) => {
    if (event.phase === "translate") {
      progress.update(event.completed, `${languageName(event.language)} done`);
    } else if (event.phase === "cooldown") {
      progress.stop();
      detail(style.yellow(`${event.total} translations failed, probably a rate limit. Retrying them one at a time.`));
      void countdown(event.waitMs, "Pausing before the retry");
    } else if (event.phase === "retry") {
      retryProgress ??= createProgress(event.total, event.total * ESTIMATED_MS_PER_RETRY);
      retryProgress.update(event.completed, `${languageName(event.language)} retried`);
    }
  });
  (retryProgress ?? progress).stop();
  return { report, elapsed: Date.now() - startedAt };
}

// Summarises the outcome, listing failures by language with their reasons.
function printTranslationSummary(report, elapsed) {
  const { valid, failed, invalid, translationItems } = report.summary;
  if (report.summary.readyToApply) {
    detail(style.green(`✓ ${valid}/${translationItems} translated`) + style.dim(` in ${formatDuration(elapsed)}`));
    return;
  }

  detail(style.red(`✗ ${failed + invalid} of ${translationItems} translations did not succeed`) +
    style.dim(` (${valid} succeeded, ${formatDuration(elapsed)})`));
  const byLanguage = new Map();
  const reasons = new Map();
  for (const item of report.translations) {
    for (const [language, result] of Object.entries(item.translations)) {
      if (result.status === "valid") continue;
      byLanguage.set(language, (byLanguage.get(language) || 0) + 1);
      const reason = result.errors?.[0] || "Unknown error";
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
    }
  }
  detail([...byLanguage].map(([language, count]) => `${languageName(language)} ${count}`).join(" · "));
  for (const [reason, count] of reasons) detail(style.dim(`Reason (${count}): ${reason}`));
}

async function main() {
  const command = process.argv[2];
  if (command !== "translate") {
    console.log(`
Usage:
  node scripts/i18n/translator/index.cjs translate [--base origin/develop]
  node scripts/i18n/translator/index.cjs translate --apply
  node scripts/i18n/translator/index.cjs translate [--base origin/develop] --and-apply
  Add --concurrency 1 (or set I18N_CONCURRENCY=1) to send fewer requests at once.

The normal translate command runs the scanner, generates approved-translations.json
from high-confidence findings, and sends those entries to the backend translator.

Environment:
  I18N_BULK_TRANSLATE_URL=http://localhost:3000/api/v1/speech/translate/bulk (optional)
  The backend must run locally with NODE_ENV=development.
`);
    process.exitCode = 1;
    return;
  }

  const outputFile = path.resolve(repoRoot, getArgument("--out", defaultOutput));
  const shouldApply = hasFlag("--apply");
  const shouldApplyAfterTranslate = hasFlag("--and-apply");

  if (shouldApply) {
    if (!fs.existsSync(outputFile)) {
      throw new Error(`Translation preview not found: ${outputFile}. Run translate first.`);
    }
    const report = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    step(1, 1, "Applying the reviewed preview to resources.ts");
    applyReport(report);
    detail(style.dim("No translation API requests were made."));
    return;
  }

  if (typeof fetch !== "function") {
    throw new Error("Node.js 18 or newer is required (global fetch is unavailable).");
  }

  const baseRef = getArgument("--base", process.env.I18N_BASE || "develop");
  const settings = { ...DEFAULTS, requestConcurrency: getConcurrency() };
  console.log(`${style.bold("i18n translate")} ${style.dim(`· compared with ${baseRef}`)}`);

  step(1, STEPS, "Scanning changed files");
  const scanReport = runScanner(baseRef);
  const { entries: generatedEntries, skipped } = createGeneratedEntries(scanReport);
  writeGeneratedInput(generatedEntries, scanReport);
  printScanSummary(scanReport, generatedEntries, skipped);

  if (generatedEntries.length === 0) {
    console.log(`\n${style.green("✓ Nothing new to translate.")} No API requests were made.`);
    return;
  }

  const entries = validateApprovedEntries(generatedEntries.map(({ key, text }) => ({ key, text })));
  const { report, elapsed } = await translateWithProgress(entries, new SarvamProvider(), settings);
  report.sourceScan = {
    baseRef: scanReport.baseRef,
    reportFile: path.relative(repoRoot, scanReportFile),
    generatedInputFile: path.relative(repoRoot, defaultInput),
    findings: generatedEntries,
    ambiguousCount: (scanReport.ambiguousFindings || []).length,
    dynamicKeyCount: (scanReport.dynamicKeys || []).length,
  };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + "\n", "utf8");
  printTranslationSummary(report, elapsed);
  detail(style.dim(`Preview: ${path.relative(repoRoot, outputFile)}`));

  if (!report.summary.readyToApply) {
    step(3, STEPS, "Applying to resources.ts");
    detail(style.yellow("Skipped: resources.ts was not changed, because every translation must succeed first."));
    detail(`Run the command again. To go slower: ${style.cyan("I18N_CONCURRENCY=1 npm run i18n:translate:apply")}`);
    process.exitCode = 2;
    return;
  }

  step(3, STEPS, "Applying to resources.ts");
  if (shouldApplyAfterTranslate) {
    applyReport(report);
    console.log(`\n${style.green("Done.")} Replace the translated strings in the code with t("key") using the keys in the preview.`);
    return;
  }

  detail(`Review the preview, then run ${style.cyan("npm run i18n:apply")} to update resources.ts.`);
}

main().catch((error) => {
  console.error(`\n${style.red("✗ i18n translator failed:")} ${error.message}`);
  process.exitCode = 1;
});
