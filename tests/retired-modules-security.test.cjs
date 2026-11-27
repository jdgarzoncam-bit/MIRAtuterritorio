const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "migrations", "20261127_remove_logistics_module.sql"), "utf8");

test("Logística queda retirada del catálogo y de sus permisos", () => {
  assert.match(migration, /DELETE FROM mira\.module_permissions WHERE module_key = 'logistica'/);
  assert.match(migration, /DELETE FROM mira\.module_catalog WHERE module_key = 'logistica'/);
});

test("PQRS conserva su canal público pero no admite la clave Logística", () => {
  const policy = migration.slice(migration.indexOf("CREATE POLICY pqrs_public_submit_anonymous"), migration.indexOf("DELETE FROM mira.module_permissions"));
  assert.match(policy, /CREATE POLICY pqrs_public_submit_anonymous/);
  assert.doesNotMatch(policy, /'logistica'/i);
});

test("se elimina la función heredada de registro de seis argumentos", () => {
  assert.match(migration, /DROP FUNCTION IF EXISTS mira\.public_register_activity_participant\(/);
  assert.match(migration, /uuid, boolean/);
});

test("la migración histórica que restauraba Reportes Operativos ya no existe", () => {
  assert.equal(
    fs.existsSync(path.join(root, "migrations", "20261126_restore_public_operational_reports.sql")),
    false
  );
  assert.equal(fs.existsSync(path.join(root, "reporte-publico.html")), false);
  assert.equal(fs.existsSync(path.join(root, "reporte-publico.js")), false);
});

test("las tablas de personas y asistencias no permiten borrado directo por roles de aplicación", () => {
  const hardening = fs.readFileSync(
    path.join(root, "migrations", "20261127_harden_personal_data_delete_grants.sql"),
    "utf8"
  );
  assert.match(hardening, /REVOKE DELETE ON TABLE mira\.asistencias FROM PUBLIC, anonymous, authenticated/);
  assert.match(hardening, /REVOKE DELETE ON TABLE mira\.personas FROM PUBLIC, anonymous, authenticated/);
});
