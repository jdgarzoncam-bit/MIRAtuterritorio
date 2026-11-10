const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(path.join(__dirname, "..", "migrations", "20261110_guard_last_view_permission.sql"), "utf8");

test("retirar el último permiso view de una cuenta activa está protegido por trigger", () => {
  assert.match(migration, /CREATE TRIGGER module_permissions_preserve_last_view/);
  assert.match(migration, /BEFORE UPDATE OF user_profile_id, module_key, action_key, allowed OR DELETE/);
  assert.match(migration, /No puedes retirar el último permiso de Consulta de una cuenta activa/);
});

test("desactivar un módulo no puede dejar cuentas activas sin otro módulo de consulta", () => {
  assert.match(migration, /CREATE TRIGGER module_catalog_preserve_active_user_access/);
  assert.match(migration, /BEFORE UPDATE OF active ON mira\.module_catalog/);
  assert.match(migration, /No puedes desactivar este módulo: dejaría una o más cuentas activas sin un módulo de Consulta/);
});

test("los triggers excluyen Testigos y Control Administrativo como permisos de acceso efectivo", () => {
  assert.equal((migration.match(/NOT IN \('testigos', 'control_administrativo'\)/g)||[]).length, 2);
});
