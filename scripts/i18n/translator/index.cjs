#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { DEFAULTS } = require("./config.cjs");
const { SarvamProvider } = require("./providers/sarvam.cjs");
const { validateApprovedEntries } = require("./validator.cjs");
const { translateEntries } = require("./translator.cjs");
const { applyTranslations } = require("./resource-writer.cjs");
const { localesDir, readLocale, flattenNamespace } = require("../locales.cjs");

const repoRoot = path.resolve(__dirname, "../../..");
const scannerFile = path.join(repoRoot, "scripts/i18n/scan-web-i18n.cjs");
const scanReportFile = path.join(repoRoot, "scripts/i18n/reports/incremental-scan.json");
const defaultInput = path.join(__dirname, "generated/approved-translations.json");
const defaultOutput = path.join(
  repoRoot,
  "scripts/i18n/reports/translation-preview.json"
);

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
      { cwd: repoRoot, stdio: "inherit" }
    );
  } catch (error) {
    throw new Error(`Scanner failed${error.status ? ` (exit ${error.status})` : ""}.`);
  }

  if (!fs.existsSync(scanReportFile)) {
    throw new Error(`Scanner did not generate its report: ${scanReportFile}`);
  }
  return JSON.parse(fs.readFileSync(scanReportFile, "utf8"));
}

// Reads every English key in en.json with its text, so new strings can reuse existing keys.
function getExistingEnglishEntries() {
  const english = readLocale("en");
  if (!english) {
    throw new Error(`English locale not found in ${path.relative(repoRoot, localesDir)}.`);
  }
  return flattenNamespace(english);
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

// Writes a validated translation report into the locale files and prints what changed.
function applyReport(report) {
  const result = applyTranslations(report);
  if (result.added === 0) {
    console.log("\nNothing to apply: every key already exists in the locale files.");
    return;
  }
  console.log(`\nApplied ${result.added} missing values across ${result.files.length} locale files in ${path.relative(repoRoot, localesDir)}.`);
  console.log(`Backup created: ${path.relative(repoRoot, result.backupDir)}`);
}

async function main() {
  const command = process.argv[2];
  if (command !== "translate") {
    console.log(`
Usage:
  node scripts/i18n/translator/index.cjs translate [--base origin/develop]
  node scripts/i18n/translator/index.cjs translate --apply
  node scripts/i18n/translator/index.cjs translate [--base origin/develop] --and-apply

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
    applyReport(report);
    console.log("No translation API requests were made during apply.");
    return;
  }

  if (typeof fetch !== "function") {
    throw new Error("Node.js 18 or newer is required (global fetch is unavailable).");
  }

  const baseRef = getArgument("--base", process.env.I18N_BASE || "develop");
  const scanReport = runScanner(baseRef);
  const { entries: generatedEntries, skipped } = createGeneratedEntries(scanReport);
  writeGeneratedInput(generatedEntries, scanReport);

  console.log(`\nGenerated translation input: ${path.relative(repoRoot, defaultInput)}`);
  console.log(`Eligible high-confidence strings: ${generatedEntries.length}`);
  console.log(`Ambiguous strings held for review: ${(scanReport.ambiguousFindings || []).length}`);
  console.log(`Dynamic keys held for review: ${(scanReport.dynamicKeys || []).length}`);
  if (skipped.length) {
    console.log(`Skipped findings: ${skipped.length}`);
    for (const { finding, reason } of skipped) {
      console.log(`  - ${finding.file ?? "unknown"}:${finding.line ?? "?"} ${reason}`);
    }
  }

  if (generatedEntries.length === 0) {
    console.log("No new high-confidence strings to translate. No API requests were made.");
    return;
  }

  const entries = validateApprovedEntries(generatedEntries.map(({ key, text }) => ({ key, text })));
  const provider = new SarvamProvider();
  const report = await translateEntries(entries, provider, DEFAULTS);
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

  console.log("\nTranslation run completed.");
  console.log(`Planned bulk requests: ${report.summary.bulkRequests} (batch size: ${report.summary.batchSize})`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Preview report: ${outputFile}`);
  if (!report.summary.readyToApply) {
    console.log("Some translations failed or are invalid. Review the preview; the locale files were not changed.");
    process.exitCode = 2;
    return;
  }

  if (shouldApplyAfterTranslate) {
    applyReport(report);
    return;
  }

  console.log("Review the preview, then run translate --apply to update the locale files.");
}

main().catch((error) => {
  console.error("i18n translator failed:", error.message);
  process.exitCode = 1;
});
