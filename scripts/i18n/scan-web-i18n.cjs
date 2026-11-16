#!/usr/bin/env node
/*
 * Read-only audit for end-user web i18n coverage.
 *
 * Usage:
 *   node scripts/i18n/scan-web-i18n.cjs
 *   node scripts/i18n/scan-web-i18n.cjs --json report.json
 *
 * This intentionally never writes to source files.  It uses the TypeScript
 * Compiler API rather than regexes so JSX text, attributes, and t() calls can
 * be classified without scanning backend, mobile, or staff-only areas.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "../..");
const webRoot = path.join(repoRoot, "web");
const resourceFile = path.join(
  webRoot,
  "src/i18n/resources.ts"
);

const manifestFile = path.join(__dirname, "scan-manifest.json");
const defaultReport = path.join(
  __dirname,
  "reports/incremental-scan.json"
);

const ts = require(
  path.join(webRoot, "node_modules/typescript")
);

const publicLayouts = new Set([
  "PublicLayout.tsx",
  "PublicHeader.tsx",
  "PublicSidebar.tsx",
  "PublicMobileNav.tsx",
  "PublicBottomNav.tsx",
]);

const excludedSegments = new Set([
  "admin",
  "audit-logs",
  "dashboard",
  "distributions",
  "feedbacks",
  "reports",
  "reviews",
  "settings",
  "users",
  "wallets",
  "withdrawals",
]);

const userFacingAttributes = new Set([
  "title",
  "placeholder",
  "alt",
  "aria-label",
  "aria-description",
  "aria-valuetext",
  "label",
  "description",
  "emptyMessage",
  "helperText",
  "errorMessage",
]);

const ignoredAttributes = new Set([
  "className",
  "id",
  "key",
  "name",
  "value",
  "type",
  "role",
  "href",
  "to",
  "src",
  "target",
  "rel",
  "data-testid",
  "data-state",
  "data-slot",
]);

const extensions = /\.(ts|tsx|js|jsx)$/i;

function git(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

function currentCommit() {
  return git(["rev-parse", "HEAD"]);
}

function readManifest() {
  if (!fs.existsSync(manifestFile)) {
    throw new Error(
      "No scan baseline found. Run: node scripts/i18n/scanner.cjs init"
    );
  }

  return JSON.parse(fs.readFileSync(manifestFile, "utf8"));
}

function writeManifest(data) {
  fs.mkdirSync(path.dirname(manifestFile), {
    recursive: true,
  });

  fs.writeFileSync(
    manifestFile,
    JSON.stringify(data, null, 2) + "\n"
  );
}

function isInScope(file) {
  const relative = path
    .relative(webRoot, file)
    .replace(/\\/g, "/");

  const segments = relative.split("/");

  if (!extensions.test(relative)) return false;

  if (
    !(
      relative.startsWith("src/pages/public/") ||
      relative.startsWith("src/components/") ||
      relative === "src/pages/auth/LoginPage.tsx"
    )
  ) {
    return false;
  }

  if (segments.some((segment) => excludedSegments.has(segment))) {
    return false;
  }

  if (
    /\.(spec|test|stories|generated)\.[jt]sx?$/i.test(relative)
  ) {
    return false;
  }

  if (
    relative.startsWith("src/components/layout/") &&
    !publicLayouts.has(path.basename(relative))
  ) {
    return false;
  }

  if (path.basename(relative) === "StaffAnveshanAnswerSection.tsx") {
    return false;
  }

  return true;
}

function getChangedFiles(baseline) {
  // Includes committed, staged and unstaged changes relative
  // to the saved baseline.
  const changed = git([
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    baseline,
    "--",
    "web/src",
  ]);

  // Git diff does not include untracked files.
  const untracked = git([
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    "web/src",
  ]);

  const files = new Set([
    ...changed.split("\n"),
    ...untracked.split("\n"),
  ]);

  return [...files]
    .filter(Boolean)
    .map((file) => path.resolve(repoRoot, file))
    .filter((file) => fs.existsSync(file))
    .filter((file) => isInScope(file))
    .sort();
}

function propertyName(node) {
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text;
  }

  return undefined;
}

// Reads nested resource objects without executing resources.ts.
function flattenObject(node, prefix = [], result = new Map()) {
  if (!ts.isObjectLiteralExpression(node)) return result;

  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;

    const name = propertyName(property.name);
    if (!name) continue;

    const currentPath = [...prefix, name];

    if (ts.isObjectLiteralExpression(property.initializer)) {
      flattenObject(property.initializer, currentPath, result);
      continue;
    }

    if (
      ts.isStringLiteral(property.initializer) ||
      ts.isNoSubstitutionTemplateLiteral(property.initializer)
    ) {
      result.set(currentPath.join("."), property.initializer.text);
    }
  }

  return result;
}

function readResources() {
  if (!fs.existsSync(resourceFile)) {
    throw new Error(`Resource file not found: ${resourceFile}`);
  }

  const source = ts.createSourceFile(
    resourceFile,
    fs.readFileSync(resourceFile, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  let resourcesNode;

  source.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;

    for (const declaration of node.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "resources"
      ) {
        resourcesNode = declaration.initializer;
      }
    }
  });

  if (!resourcesNode || !ts.isObjectLiteralExpression(resourcesNode)) {
    throw new Error("Could not find const resources = { ... }");
  }

  const languages = new Map();

  for (const property of resourcesNode.properties) {
    if (!ts.isPropertyAssignment(property)) continue;

    const language = propertyName(property.name);
    if (!language || !ts.isObjectLiteralExpression(property.initializer)) {
      continue;
    }

    const allValues = flattenObject(property.initializer);
    const commonValues = new Map();

    for (const [key, value] of allValues) {
      if (key.startsWith("common.")) {
        commonValues.set(key.slice("common.".length), value);
      }
    }

    languages.set(language, commonValues);
  }

  if (!languages.has("en")) {
    throw new Error("English resources are missing.");
  }

  return languages;
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikeUiText(value) {
  if (value.length < 2 || value.length > 280) return false;
  if (!/[A-Za-z\p{L}]/u.test(value)) return false;

  if (
    /^(https?:|\/|#)/i.test(value) ||
    /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+)+$/.test(value)
  ) {
    return false;
  }

  return true;
}

function suggestedKey(file, value) {
  const basename = path.basename(file, path.extname(file));
  const prefix = basename.charAt(0).toLowerCase() + basename.slice(1);

  const words = normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean)
    .slice(0, 6);

  return words.length
    ? `${prefix}.${words.join("")}`
    : undefined;
}

function isTranslationCall(node) {
  if (!ts.isCallExpression(node)) return false;

  if (
    ts.isIdentifier(node.expression) &&
    node.expression.text === "t"
  ) {
    return true;
  }

  return (
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "t" &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "i18n"
  );
}

function jsxName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return undefined;
}

function isTransElement(node) {
  if (
    ts.isJsxElement(node) ||
    ts.isJsxSelfClosingElement(node)
  ) {
    const tag = node.openingElement
      ? node.openingElement.tagName
      : node.tagName;

    return jsxName(tag) === "Trans";
  }

  return false;
}

function getStaticString(node) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }

  return undefined;
}

function scanFile(file, languages) {
  const text = fs.readFileSync(file, "utf8");

  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    /\.(tsx|jsx)$/i.test(file)
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  );

  const findings = [];
  const references = [];
  const dynamicKeys = [];

  const relativeFile = path
    .relative(repoRoot, file)
    .replace(/\\/g, "/");

  function location(node) {
    return {
      file: relativeFile,
      line:
        source.getLineAndCharacterOfPosition(
          node.getStart(source)
        ).line + 1,
    };
  }

  function addFinding(node, rawText, confidence, classification) {
    const value = normalizeText(rawText);

    if (!looksLikeUiText(value)) return;

    findings.push({
      ...location(node),
      text: value,
      confidence,
      classification,
      suggestedKey: suggestedKey(file, value),
    });
  }

  function recordReference(key, node, pattern) {
    const english = languages.get("en");
    const missingLanguages = [...languages.entries()]
      .filter(([, values]) => !values.has(key))
      .map(([language]) => language);

    references.push({
      ...location(node),
      key,
      pattern,
      existsInEnglish: english.has(key),
      missingLanguages,
    });
  }

  function visitVisibleExpression(expression) {
    if (!expression) return;

    const value = getStaticString(expression);

    if (value !== undefined) {
      addFinding(
        expression,
        value,
        "medium",
        "static-jsx-expression"
      );
      return;
    }

    // Only inspect rendered branches, not the condition.
    if (ts.isConditionalExpression(expression)) {
      visitVisibleExpression(expression.whenTrue);
      visitVisibleExpression(expression.whenFalse);
      return;
    }

    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind ===
        ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      visitVisibleExpression(expression.right);
      return;
    }

    // Do not interpret callback arguments, object values or
    // function implementation strings as visible copy.
    if (
      ts.isCallExpression(expression) ||
      ts.isArrowFunction(expression) ||
      ts.isFunctionExpression(expression) ||
      ts.isObjectLiteralExpression(expression)
    ) {
      return;
    }

    visit(expression);
  }

  function visit(node) {
    if (isTransElement(node)) {
      const attributes = node.openingElement
        ? node.openingElement.attributes.properties
        : node.attributes.properties;

      const keyAttribute = attributes.find(
        (item) =>
          ts.isJsxAttribute(item) &&
          item.name.text === "i18nKey"
      );

      const key = keyAttribute?.initializer
        ? ts.isStringLiteral(keyAttribute.initializer)
          ? keyAttribute.initializer.text
          : ts.isJsxExpression(keyAttribute.initializer)
            ? getStaticString(keyAttribute.initializer.expression)
            : undefined
        : undefined;

      if (key) {
        recordReference(key, node, "Trans");
      } else {
        dynamicKeys.push({
          ...location(node),
          pattern: "Trans",
          expression: keyAttribute?.getText(source) || "missing i18nKey",
        });
      }

      return;
    }

    if (isTranslationCall(node)) {
      const key = getStaticString(node.arguments[0]);
      const pattern = ts.isIdentifier(node.expression)
        ? "t"
        : "i18n.t";

      if (key !== undefined) {
        recordReference(key, node, pattern);
      } else {
        dynamicKeys.push({
          ...location(node),
          pattern,
          expression:
            node.arguments[0]?.getText(source) || "missing argument",
        });
      }

      return;
    }

    if (ts.isJsxText(node)) {
      addFinding(
        node,
        node.getText(source),
        "high",
        "hardcoded-jsx-text"
      );
      return;
    }

    if (ts.isJsxExpression(node) && node.expression) {
      visitVisibleExpression(node.expression);
      return;
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.text;

      if (
        ignoredAttributes.has(name) ||
        !userFacingAttributes.has(name)
      ) {
        return;
      }

      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        addFinding(
          node.initializer,
          node.initializer.text,
          "high",
          "hardcoded-jsx-attribute"
        );
        return;
      }

      if (
        node.initializer &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression
      ) {
        visitVisibleExpression(node.initializer.expression);
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);

  return { findings, references, dynamicKeys };
}

function uniqueBy(items, getKey) {
  const map = new Map();

  for (const item of items) {
    map.set(getKey(item), item);
  }

  return [...map.values()];
}

function initBaseline() {
  const commit = currentCommit();

  writeManifest({
    lastSuccessfulCommit: commit,
    initializedAt: new Date().toISOString(),
  });

  console.log(`Translation scan baseline initialized: ${commit}`);
}

function markSuccess() {
  const manifest = readManifest();

  manifest.lastSuccessfulCommit = currentCommit();
  manifest.lastSuccessfulAt = new Date().toISOString();

  writeManifest(manifest);

  console.log(
    `Translation scan baseline updated: ${manifest.lastSuccessfulCommit}`
  );
}

function scan() {
  const manifest = readManifest();
  const baseline = manifest.lastSuccessfulCommit;

  const files = getChangedFiles(baseline);
  const languages = readResources();

  const findings = [];
  const references = [];
  const dynamicKeys = [];

  for (const file of files) {
    const result = scanFile(file, languages);

    findings.push(...result.findings);
    references.push(...result.references);
    dynamicKeys.push(...result.dynamicKeys);
  }

  const uniqueFindings = uniqueBy(
    findings,
    (item) => `${item.file}:${item.line}:${item.text}`
  );

  const uniqueReferences = uniqueBy(
    references,
    (item) => `${item.file}:${item.line}:${item.key}`
  );

  const missingReferences = uniqueReferences.filter(
    (item) => !item.existsInEnglish || item.missingLanguages.length
  );

  const highConfidence = uniqueFindings.filter(
    (item) => item.confidence === "high"
  );

  const ambiguous = uniqueFindings.filter(
    (item) => item.confidence !== "high"
  );

  const report = {
    generatedAt: new Date().toISOString(),
    baselineCommit: baseline,
    currentCommit: currentCommit(),

    summary: {
      changedFilesScanned: files.length,
      hardcodedStrings: uniqueFindings.length,
      highConfidence: highConfidence.length,
      ambiguous: ambiguous.length,
      translationReferences: uniqueReferences.length,
      missingTranslationReferences: missingReferences.length,
      dynamicTranslationKeys: dynamicKeys.length,
      languages: [...languages.keys()],
    },

    files: files.map((file) =>
      path.relative(repoRoot, file).replace(/\\/g, "/")
    ),

    findings: uniqueFindings,
    highConfidenceFindings: highConfidence,
    ambiguousFindings: ambiguous,
    references: uniqueReferences,
    missingReferences,
    dynamicKeys,

    nextBaselineCommit: currentCommit(),

    note:
      "This is a read-only scan. The baseline is not advanced automatically.",
  };

  const outputIndex = process.argv.indexOf("--out");
  const output = outputIndex >= 0
    ? path.resolve(repoRoot, process.argv[outputIndex + 1])
    : defaultReport;

  fs.mkdirSync(path.dirname(output), { recursive: true });

  fs.writeFileSync(
    output,
    JSON.stringify(report, null, 2) + "\n"
  );

  console.log("\nIncremental i18n scan completed.");
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nReport written to: ${output}`);
}

try {
  const command = process.argv[2];

  if (command === "init") {
    initBaseline();
  } else if (command === "scan") {
    scan();
  } else if (command === "mark-success") {
    markSuccess();
  } else {
    console.log(`
Usage:

  node scripts/i18n/scanner.cjs init
  node scripts/i18n/scanner.cjs scan
  node scripts/i18n/scanner.cjs mark-success

Optional:

  node scripts/i18n/scanner.cjs scan --out path/to/report.json
`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error("i18n scanner failed:", error.message);
  process.exitCode = 1;
}
