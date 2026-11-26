const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const migration = fs.readFileSync("migrations/20261126_restore_public_operational_reports.sql", "utf8");
const publicClient = fs.readFileSync("reporte-publico.js", "utf8");

test("Reportes Operativos conserva la tabla requerida por el formulario público", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS mira\.reportes_operativos/);
  assert.match(migration, /INSERT INTO mira\.module_catalog/);
  assert.match(publicClient, /\/reportes_operativos/);
});

test("el formulario público solo obtiene permiso de inserción anónima", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE mira\.reportes_operativos FROM PUBLIC, anonymous, authenticated/);
  assert.match(migration, /GRANT INSERT ON TABLE mira\.reportes_operativos TO anonymous/);
  assert.match(migration, /FOR INSERT TO anonymous/);
  assert.doesNotMatch(migration, /GRANT SELECT|GRANT UPDATE|GRANT DELETE/);
});
