const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const data = fs.readFileSync(path.join(root, "mira-data.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "migrations", "20261127_restore_control_admin_workflows.sql"), "utf8");

test("Control Administrativo actualiza cuentas mediante RPC de alcance limitado", () => {
  assert.match(data, /rpc\/admin_update_user_profile/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION mira\.admin_update_user_profile/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION mira\.admin_update_user_profile\(uuid,boolean,text\) TO authenticated/);
  assert.match(migration, /mira\.is_active_admin\(\)/);
  assert.match(migration, /p_role NOT IN \('viewer','operator'\)/);
});

test("Control Administrativo asigna permisos mediante RPC con validación de módulo, rol y Consulta", () => {
  assert.match(data, /rpc\/admin_set_module_permission/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION mira\.admin_set_module_permission/);
  assert.match(migration, /p_action_key NOT IN \('view','create','edit','export','annul'\)/);
  assert.match(migration, /module_key = p_module_key AND active IS TRUE/);
  assert.match(migration, /v_role <> 'operator'/);
  assert.match(migration, /action_key = 'view'/);
});

test("las funciones administrativas no se exponen a usuarios anónimos ni a PUBLIC", () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION mira\.admin_update_user_profile\(uuid,boolean,text\) FROM PUBLIC, anonymous, authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION mira\.admin_set_module_permission\(uuid,text,text,boolean\) FROM PUBLIC, anonymous, authenticated/);
});
