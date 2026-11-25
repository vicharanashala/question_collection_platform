const fs = require("node:fs");
const path = require("node:path");

const typescriptPath = path.resolve(
  __dirname,
  "../../../web/node_modules/typescript"
);
const ts = require(typescriptPath);

function getPropertyName(name) {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return undefined;
}

function findProperty(objectNode, name) {
  if (!ts.isObjectLiteralExpression(objectNode)) return undefined;

  return objectNode.properties.find((property) => {
    return (
      ts.isPropertyAssignment(property) &&
      getPropertyName(property.name) === name
    );
  });
}

function findResourcesObject(sourceFile) {
  let resourcesNode;

  function visit(node) {
    if (ts.isVariableDeclaration(node)) {
      if (
        ts.isIdentifier(node.name) &&
        node.name.text === "resources" &&
        node.initializer &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        resourcesNode = node.initializer;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return resourcesNode;
}

function insertObjectProperty(source, objectNode, propertyName, valueSource) {
  const closeBrace = objectNode.getEnd() - 1;
  const lineStart = source.lastIndexOf("\n", closeBrace - 1) + 1;
  const closeLinePrefix = source.slice(lineStart, closeBrace);
  const closeIndent = /^\s*$/.test(closeLinePrefix) ? closeLinePrefix : "";
  const childIndent = `${closeIndent}  `;

  const edits = [];

  if (objectNode.properties.length > 0) {
    const lastProperty = objectNode.properties[objectNode.properties.length - 1];
    const between = source.slice(lastProperty.getEnd(), closeBrace);

    if (!/^\s*,/.test(between)) {
      edits.push({ position: lastProperty.getEnd(), text: "," });
    }
  }

  const propertyText = `${childIndent}${JSON.stringify(propertyName)}: ${valueSource},\n`;

  if (closeIndent) {
    edits.push({ position: lineStart, text: propertyText });
  } else {
    edits.push({
      position: closeBrace,
      text: `\n${propertyText}${closeIndent}`,
    });
  }

  edits.sort((a, b) => b.position - a.position);

  let updated = source;
  for (const edit of edits) {
    updated =
      updated.slice(0, edit.position) +
      edit.text +
      updated.slice(edit.position);
  }

  return updated;
}

function makeNestedObject(parts, value) {
  let result = JSON.stringify(value);

  for (let index = parts.length - 1; index >= 0; index--) {
    result = `{ ${JSON.stringify(parts[index])}: ${result} }`;
  }

  return result;
}

function addMissingResourceValue(source, language, dottedKey, value) {
  const sourceFile = ts.createSourceFile(
    "resources.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const resourcesNode = findResourcesObject(sourceFile);
  if (!resourcesNode) {
    throw new Error("Could not locate the resources object in resources.ts.");
  }

  const languageProperty = findProperty(resourcesNode, language);
  if (!languageProperty || !ts.isObjectLiteralExpression(languageProperty.initializer)) {
    throw new Error(`Language "${language}" is missing or is not an object in resources.ts.`);
  }

  const commonProperty = findProperty(languageProperty.initializer, "common");
  if (!commonProperty || !ts.isObjectLiteralExpression(commonProperty.initializer)) {
    throw new Error(`Language "${language}" does not contain a common object.`);
  }

  const parts = dottedKey.split(".");
  let currentObject = commonProperty.initializer;

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const existing = findProperty(currentObject, part);

    if (index === parts.length - 1) {
      if (existing) {
        return { source, added: false, reason: "already-exists" };
      }

      const valueSource = JSON.stringify(value);
      const updated = insertObjectProperty(
        source,
        currentObject,
        part,
        valueSource
      );

      return { source: updated, added: true };
    }

    if (existing) {
      if (!ts.isObjectLiteralExpression(existing.initializer)) {
        return {
          source,
          added: false,
          reason: `path-conflict-at-${parts.slice(0, index + 1).join(".")}`,
        };
      }
      currentObject = existing.initializer;
      continue;
    }

    const nestedValue = makeNestedObject(parts.slice(index + 1), value);
    const updated = insertObjectProperty(
      source,
      currentObject,
      part,
      nestedValue
    );

    return { source: updated, added: true };
  }

  return { source, added: false, reason: "not-added" };
}

function applyTranslations(resourceFile, report) {
  const invalidItems = report.translations.filter(
    (item) => item.status !== "valid"
  );

  if (invalidItems.length > 0 || !report.summary.readyToApply) {
    throw new Error(
      "Refusing to update resources.ts: one or more translations failed validation."
    );
  }

  let source = fs.readFileSync(resourceFile, "utf8");
  const additions = [];

  for (const item of report.translations) {
    const allValues = {
      en: item.sourceText,
    };

    for (const [language, translation] of Object.entries(item.translations)) {
      if (translation.status !== "valid" || !translation.text) {
        throw new Error(`Invalid translation for ${item.key} (${language}).`);
      }
      allValues[language] = translation.text;
    }

    for (const [language, value] of Object.entries(allValues)) {
      const result = addMissingResourceValue(
        source,
        language,
        item.key,
        value
      );

      source = result.source;

      if (result.added) {
        additions.push({ language, key: item.key });
      } else if (result.reason && result.reason !== "already-exists") {
        throw new Error(
          `Could not add ${language}.common.${item.key}: ${result.reason}`
        );
      }
    }
  }

  // Backups go to the git-ignored reports folder so they never land next to source files.
  const backupDir = path.resolve(__dirname, "../reports");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(
    backupDir,
    `${path.basename(resourceFile)}.i18n-backup-${Date.now()}`
  );
  fs.copyFileSync(resourceFile, backupFile);
  fs.writeFileSync(resourceFile, source, "utf8");

  return {
    backupFile,
    added: additions.length,
    additions,
  };
}

module.exports = { applyTranslations };
