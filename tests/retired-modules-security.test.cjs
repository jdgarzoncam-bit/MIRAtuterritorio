const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Guardas de regresión para evitar que módulos y permisos retirados reaparezcan.
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

test("el helper interno de seis argumentos exige token y no admite ejecución directa de roles de aplicación", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION mira\.public_register_activity_participant\(/);
  assert.match(migration, /s\.token=v_access_token AND s\.actor_uid=v_actor AND s\.expires_at>now\(\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION mira\.public_register_activity_participant\(text,text,text,text,uuid,boolean\) FROM PUBLIC, anonymous, authenticated/);
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

test("la política autenticada de PQRS también bloquea claves de módulos retirados", () => {
  const start = migration.indexOf("CREATE POLICY pqrs_submit_authenticated");
  const end = migration.indexOf("DELETE FROM mira.module_permissions", start);
  const policy = migration.slice(start, end);
  assert.ok(start >= 0, "Debe existir la política autenticada");
  assert.doesNotMatch(policy, /'logistica'/i);
  assert.match(policy, /email_verified = true/);
});

test("PQRS no conserva etiquetas de Logística en la interfaz", () => {
  const pqrs = fs.readFileSync(path.join(root, "pqrs.js"), "utf8");
  assert.doesNotMatch(pqrs, /logistica|Logística & Transporte/i);
});
