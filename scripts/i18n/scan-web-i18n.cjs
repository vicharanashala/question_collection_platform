const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "../..");
const webRoot = path.join(repoRoot, "web");
const resourceFile = path.join(webRoot, "src/i18n/resources.ts");
const defaultReport = path.join(__dirname, "reports", "incremental-scan.json");
const ts = require(path.join(webRoot, "node_modules/typescript"));

const expectedLanguages = [
  "en", "as", "bn", "brx", "doi", "gu", "hi", "kn", "ks", "kok",
  "mai", "ml", "mni", "mr", "ne", "or", "pa", "sa", "sat", "sd",
  "ta", "te", "ur",
];

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
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const details = error.stderr ? String(error.stderr).trim() : error.message;
    throw new Error(`Git command failed (${args.join(" ")}): ${details}`);
  }
}

function isInScope(file) {
  const relative = path.relative(webRoot, file).replace(/\\/g, "/");
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

  if (segments.some((segment) => excludedSegments.has(segment))) return false;

  if (/\.(spec|test|stories|generated)\.[jt]sx?$/i.test(relative)) {
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

function getChangedFiles(baseRef) {
  // Includes committed, staged and unstaged changes relative to the base ref.
  const changed = git([
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    baseRef,
    "--",
    "web/src",
  ]);

  // Include new, untracked files that are not ignored by Git.
  const untracked = git([
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    "web/src",
  ]);

  const files = new Set([...changed.split("\n"), ...untracked.split("\n")]);

  return [...files]
    .filter(Boolean)
    .map((file) => path.resolve(repoRoot, file))
    .filter((file) => fs.existsSync(file) && fs.statSync(file).isFile())
    .filter(isInScope)
    .sort();
}

function getUntrackedFiles() {
  const output = git([
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    "web/src",
  ]);

  return new Set(output.split("\n").filter(Boolean));
}

function mergeLineRanges(ranges) {
  const sorted = ranges
    .filter((range) => range.start <= range.end)
    .sort((a, b) => a.start - b.start);
  const merged = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ start: range.start, end: range.end });
    }
  }

  return merged;
}

function getChangedLineRanges(file, baseRef, untrackedFiles) {
  const relativeFile = path.relative(repoRoot, file).replace(/\\/g, "/");

  // New, untracked files have no Git diff hunks: every source line is new.
  if (untrackedFiles.has(relativeFile)) {
    const lineCount = fs.readFileSync(file, "utf8").split(/\r?\n/).length;
    return lineCount ? [{ start: 1, end: lineCount }] : [];
  }

  const diff = git([
    "diff",
    "--no-ext-diff",
    "--no-color",
    "--unified=0",
    baseRef,
    "--",
    relativeFile,
  ]);

  const ranges = [];
  const hunkPattern = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
  let match;

  while ((match = hunkPattern.exec(diff)) !== null) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);

    // A deletion has a zero-length new-side range and contains no source
    // lines that can produce a translation finding.
    if (count > 0) {
      ranges.push({ start, end: start + count - 1 });
    }
  }

  return mergeLineRanges(ranges);
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

// Flattens nested resource objects without executing resources.ts.
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
    throw new Error("Could not find const resources = { ... } in resources.ts");
  }

  const parsedLanguages = new Map();

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

    parsedLanguages.set(language, commonValues);
  }

  // Always validate against the complete expected language set. A missing
  // language is represented by an empty map, so its keys are reported missing.
  const languages = new Map(
    expectedLanguages.map((language) => [
      language,
      parsedLanguages.get(language) || new Map(),
    ])
  );

  const missingLanguages = expectedLanguages.filter(
    (language) => !parsedLanguages.has(language)
  );

  return { languages, missingLanguages };
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

  return words.length ? `${prefix}.${words.join("")}` : undefined;
}

function isTranslationCall(node) {
  if (!ts.isCallExpression(node)) return false;

  if (ts.isIdentifier(node.expression) && node.expression.text === "t") {
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
  if (ts.isJsxElement(node)) {
    return jsxName(node.openingElement.tagName) === "Trans";
  }

  if (ts.isJsxSelfClosingElement(node)) {
    return jsxName(node.tagName) === "Trans";
  }

  return false;
}

function getStaticString(node) {
  if (!node) return undefined;

  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }

  return undefined;
}

function scanFile(file, languages, changedLineRanges) {
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    /\.(tsx|jsx)$/i.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const findings = [];
  const references = [];
  const dynamicKeys = [];
  const relativeFile = path.relative(repoRoot, file).replace(/\\/g, "/");

  function isChangedLine(line) {
    return changedLineRanges.some(
      (range) => line >= range.start && line <= range.end
    );
  }

  function overlapsChangedLines(node) {
    if (!node || changedLineRanges.length === 0) return false;

    const startPosition = Math.max(0, node.getStart(source));
    const endPosition = Math.max(startPosition, node.getEnd() - 1);
    const startLine = source.getLineAndCharacterOfPosition(startPosition).line + 1;
    const endLine = source.getLineAndCharacterOfPosition(endPosition).line + 1;

    return changedLineRanges.some(
      (range) => startLine <= range.end && endLine >= range.start
    );
  }

  function location(node, lineOverride) {
    return {
      file: relativeFile,
      line:
        lineOverride ??
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    };
  }

  function addFinding(node, rawText, confidence, classification, sourceLine) {
    if (
      sourceLine !== undefined
        ? !isChangedLine(sourceLine)
        : !overlapsChangedLines(node)
    ) {
      return;
    }

    const value = normalizeText(rawText);
    if (!looksLikeUiText(value)) return;

    findings.push({
      ...location(node, sourceLine),
      text: value,
      confidence,
      classification,
      suggestedKey: suggestedKey(file, value),
    });
  }

  function recordReference(key, node, pattern) {
    if (!overlapsChangedLines(node)) return;

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
      addFinding(expression, value, "medium", "static-jsx-expression");
      return;
    }

    // Inspect rendered branches, not the condition itself.
    if (ts.isConditionalExpression(expression)) {
      visitVisibleExpression(expression.whenTrue);
      visitVisibleExpression(expression.whenFalse);
      return;
    }

    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      visitVisibleExpression(expression.right);
      return;
    }

    // Do not interpret callback arguments, object values or function bodies
    // as visible copy.
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
      const attributes = ts.isJsxElement(node)
        ? node.openingElement.attributes.properties
        : node.attributes.properties;

      const keyAttribute = attributes.find(
        (item) =>
          ts.isJsxAttribute(item) && item.name.text === "i18nKey"
      );

      const key = keyAttribute?.initializer
        ? ts.isStringLiteral(keyAttribute.initializer)
          ? keyAttribute.initializer.text
          : ts.isJsxExpression(keyAttribute.initializer)
            ? getStaticString(keyAttribute.initializer.expression)
            : undefined
        : undefined;

      if (key) {
        recordReference(
          key,
          keyAttribute?.initializer || keyAttribute || node,
          "Trans"
        );
      } else {
        const dynamicNode = keyAttribute?.initializer || keyAttribute || node;
        if (overlapsChangedLines(dynamicNode)) {
          dynamicKeys.push({
            ...location(dynamicNode),
            pattern: "Trans",
            expression: keyAttribute?.getText(source) || "missing i18nKey",
          });
        }
      }
      return;
    }

    if (isTranslationCall(node)) {
      const key = getStaticString(node.arguments[0]);
      const pattern = ts.isIdentifier(node.expression) ? "t" : "i18n.t";

      const keyNode = node.arguments[0] || node;
      if (key !== undefined) {
        recordReference(key, keyNode, pattern);
      } else if (overlapsChangedLines(keyNode)) {
        dynamicKeys.push({
          ...location(keyNode),
          pattern,
          expression: keyNode.getText(source) || "missing argument",
        });
      }
      return;
    }

    if (ts.isJsxText(node)) {
      // JSXText can span several lines. Only submit the changed lines, rather
      // than the entire text node when an unchanged neighboring line exists.
      const startLine =
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const textLines = node.getText(source).split(/\r?\n/);

      textLines.forEach((lineText, index) => {
        const sourceLine = startLine + index;
        if (isChangedLine(sourceLine)) {
          addFinding(
            node,
            lineText,
            "high",
            "hardcoded-jsx-text",
            sourceLine
          );
        }
      });
      return;
    }

    if (ts.isJsxExpression(node) && node.expression) {
      visitVisibleExpression(node.expression);
      return;
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.text;
      if (ignoredAttributes.has(name) || !userFacingAttributes.has(name)) {
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
  for (const item of items) map.set(getKey(item), item);
  return [...map.values()];
}

function getCliValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Expected a value after ${flag}.`);
  }
  return value;
}

function scan() {
  const baseRef = getCliValue("--base") || process.env.I18N_BASE || "develop";
  const outputArg = getCliValue("--out");

  // Fail early with a clear message if the requested Git ref does not exist.
  git(["rev-parse", "--verify", `${baseRef}^{commit}`]);

  const files = getChangedFiles(baseRef);
  const untrackedFiles = getUntrackedFiles();
  const { languages, missingLanguages } = readResources();
  const findings = [];
  const references = [];
  const dynamicKeys = [];
  const changedLineRangesByFile = {};

  for (const file of files) {
    const relativeFile = path.relative(repoRoot, file).replace(/\\/g, "/");
    const changedLineRanges = getChangedLineRanges(
      file,
      baseRef,
      untrackedFiles
    );
    changedLineRangesByFile[relativeFile] = changedLineRanges;

    const result = scanFile(file, languages, changedLineRanges);
    findings.push(...result.findings);
    references.push(...result.references);
    dynamicKeys.push(...result.dynamicKeys);
  }

  const changedLinesScanned = Object.values(changedLineRangesByFile)
    .flat()
    .reduce((total, range) => total + range.end - range.start + 1, 0);

  const uniqueFindings = uniqueBy(
    findings,
    (item) => `${item.file}:${item.line}:${item.text}`
  );
  const uniqueReferences = uniqueBy(
    references,
    (item) => `${item.file}:${item.line}:${item.key}`
  );
  const uniqueDynamicKeys = uniqueBy(
    dynamicKeys,
    (item) => `${item.file}:${item.line}:${item.expression}`
  );

  const missingReferences = uniqueReferences.filter(
    (item) => !item.existsInEnglish || item.missingLanguages.length > 0
  );
  const highConfidence = uniqueFindings.filter(
    (item) => item.confidence === "high"
  );
  const ambiguous = uniqueFindings.filter(
    (item) => item.confidence !== "high"
  );

  const report = {
    generatedAt: new Date().toISOString(),
    baseRef,
    summary: {
      changedFilesScanned: files.length,
      changedLinesScanned,
      hardcodedStrings: uniqueFindings.length,
      highConfidence: highConfidence.length,
      ambiguous: ambiguous.length,
      translationReferences: uniqueReferences.length,
      missingTranslationReferences: missingReferences.length,
      dynamicTranslationKeys: uniqueDynamicKeys.length,
      languages: expectedLanguages,
      missingResourceLanguages: missingLanguages,
    },
    files: files.map((file) =>
      path.relative(repoRoot, file).replace(/\\/g, "/")
    ),
    changedLineRanges: changedLineRangesByFile,
    findings: uniqueFindings,
    highConfidenceFindings: highConfidence,
    ambiguousFindings: ambiguous,
    references: uniqueReferences,
    missingReferences,
    dynamicKeys: uniqueDynamicKeys,
    resourceValidation: {
      expectedLanguages,
      missingLanguages,
    },
    note: "Read-only scan against the selected Git base reference. Findings are limited to AST nodes overlapping added or modified Git diff lines. Untracked files are scanned in full. Translation strings and source files are not modified.",
  };

  const output = outputArg
    ? path.resolve(repoRoot, outputArg)
    : defaultReport;

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");

  console.log("\nIncremental i18n scan completed.");
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nReport written to: ${output}`);
}

try {
  const command = process.argv[2];

  if (command === "scan") {
    scan();
  } else {
    console.log(`
Usage:

  node scripts/i18n/scan-web-i18n.cjs scan

Optional:

  node scripts/i18n/scan-web-i18n.cjs scan --base develop
  node scripts/i18n/scan-web-i18n.cjs scan --base main
  node scripts/i18n/scan-web-i18n.cjs scan --out reports/custom.json
`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error("i18n scanner failed:", error.message);
  process.exitCode = 1;
}
