const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "migrations", "20261127_fix_control_admin_profile_update.sql"), "utf8");

test("Control Administrativo puede actualizar solo active y role", () => {
  assert.match(migration, /GRANT UPDATE \(active, role\) ON TABLE mira\.user_profiles TO authenticated/);
  assert.doesNotMatch(migration, /GRANT UPDATE ON TABLE mira\.user_profiles TO authenticated/i);
});

test("la migración conserva RLS y recarga el esquema de PostgREST", () => {
  assert.match(migration, /profile_admin_update_non_admin/);
  assert.match(migration, /NOTIFY pgrst, 'reload schema'/);
});

test("el panel actualiza el perfil desde los servicios de datos", () => {
  const data = fs.readFileSync(path.join(root, "mira-data.js"), "utf8");
  const admin = fs.readFileSync(path.join(root, "mira-admin.js"), "utf8");
  assert.match(data, /updateUserProfile\(profileId, changes\)/);
  assert.match(data, /method:"PATCH"/);
  assert.match(admin, /updateUserProfile\(targetId,\{active:nextActive,role\}\)/);
});
