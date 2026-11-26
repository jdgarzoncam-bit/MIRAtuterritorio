const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const runtimeExtensions = new Set([".js", ".html", ".css"]);
const excludedDirectories = new Set([".git", "node_modules", "tests", "docs", "migrations"]);
const forbiddenHosts = [
  ["ep", "-mute-grass-", "b7qan4n6"].join("")
];

function collectRuntimeFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) {
        collectRuntimeFiles(path.join(directory, entry.name), files);
      }
      continue;
    }
    if (runtimeExtensions.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

test("los recursos publicados no contienen endpoints de Neon QA", () => {
  const files = collectRuntimeFiles(root);
  const violations = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const host of forbiddenHosts) {
      if (source.includes(host)) {
        violations.push(path.relative(root, file));
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    "No se puede publicar código que apunte a Neon QA: " + violations.join(", ")
  );
});

test("los clientes principales apuntan al proyecto Neon de producción", () => {
  const auth = fs.readFileSync(path.join(root, "mira-auth.js"), "utf8");
  const data = fs.readFileSync(path.join(root, "mira-data.js"), "utf8");

  assert.match(auth, /ep-round-dawn-b7l3ya3h/);
  assert.match(data, /ep-round-dawn-b7l3ya3h/);
  assert.match(data, /br-winter-night-b758ke2j/);
});
