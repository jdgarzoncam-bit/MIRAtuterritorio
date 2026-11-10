const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pqrsSource = fs.readFileSync(path.join(__dirname, "..", "pqrs.js"), "utf8");
const dataSource = fs.readFileSync(path.join(__dirname, "..", "mira-data.js"), "utf8");
const adminSource = fs.readFileSync(path.join(__dirname, "..", "mira-admin.js"), "utf8");
const migration = fs.readFileSync(path.join(__dirname, "..", "migrations", "20261110_pqrs_delegated_readonly.sql"), "utf8");

test("la bandeja PQRS admite administrador principal o permiso granular pqrs:view", () => {
  assert.match(pqrsSource, /async function hasInboxAccess\(\)/);
  assert.match(pqrsSource, /if\(isAdmin\(\)\)return true/);
  assert.match(pqrsSource, /p\.module_key==="pqrs"&&p\.action_key==="view"&&p\.allowed===true/);
  assert.match(adminSource, /pqrs:\["dropdown-pqrs-admin"\]/);
});

test("la consulta delegada no muestra controles para modificar el estado", () => {
  assert.match(pqrsSource, /canManage=isAdmin\(\)/);
  assert.match(pqrsSource, /canManage\?'<label>Actualizar estado<select/);
  assert.match(pqrsSource, /Consulta delegada · solo lectura/);
});

test("la capa de datos bloquea updatePQRS para cualquier cuenta distinta al administrador principal", () => {
  assert.match(dataSource, /user\?\.role!=="admin"\|\|user\?\.authUserId!=="beef5bf3-82a8-4c35-a12c-17771be59da1"/);
  assert.match(dataSource, /consulta delegada de PQRS es de solo lectura/);
});

test("RLS concede SELECT granular y mantiene UPDATE/DELETE reservados al administrador", () => {
  assert.match(migration, /mira\.has_module_permission\('pqrs', 'view'\)/);
  assert.match(migration, /FOR SELECT\s+TO authenticated/);
  assert.match(migration, /No modificar pqrs_admin_update ni pqrs_admin_delete/);
  assert.doesNotMatch(migration, /CREATE POLICY[^;]+FOR UPDATE/i);
  assert.doesNotMatch(migration, /CREATE POLICY[^;]+FOR DELETE/i);
});

test("la matriz ofrece PQRS únicamente como permiso de consulta", () => {
  assert.match(adminSource, /pqrs:\[\["view","Consulta"\]\]/);
});
