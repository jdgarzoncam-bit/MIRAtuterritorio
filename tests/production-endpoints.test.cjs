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

test("el formulario y cliente de Reportes Operativos no forman parte del sitio", () => {
  for (const obsoletePath of ["reporte-publico.html", "reporte-publico.js"]) {
    assert.equal(fs.existsSync(path.join(root, obsoletePath)), false, obsoletePath + " debe estar retirado");
  }
  const landing = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.doesNotMatch(landing, /reporte-publico\\.(?:html|js)/i);
});

test("la migración de retiro elimina solo Reportes Operativos y la sobrecarga heredada", () => {
  const migrationPath = path.join(root, "migrations", "20261126_remove_operational_reports_and_legacy_registration.sql");
  assert.equal(fs.existsSync(migrationPath), true);
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert.match(migration, /DELETE FROM mira\\.module_catalog WHERE module_key = 'reportes'/);
  assert.match(migration, /DROP TABLE IF EXISTS mira\\.reportes_operativos/);
  assert.match(migration, /DROP FUNCTION IF EXISTS mira\\.public_register_activity_participant_v2/);
  assert.doesNotMatch(migration, /CASCADE/i);
});
