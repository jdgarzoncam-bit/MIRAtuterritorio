const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const admin = fs.readFileSync(path.join(__dirname, "..", "mira-admin.js"), "utf8");
const auth = fs.readFileSync(path.join(__dirname, "..", "mira-auth.js"), "utf8");
const data = fs.readFileSync(path.join(__dirname, "..", "mira-data.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("una revalidación de la misma cuenta no bloquea visualmente todos los módulos antes de consultar permisos", () => {
  assert.match(admin, /const sameIdentity=lastAppliedModuleAccessUserId===current\.authUserId/);
  assert.match(admin, /if\(!sameIdentity\)allTargets\.forEach\(id=>setModuleRestricted/);
  assert.doesNotMatch(admin, /allTargets\.forEach\(id=>setModuleRestricted\(\$\(id\),true\)\);\s*if\(current\.role/);
});

test("las respuestas de permisos antiguas no pueden sobrescribir el estado de otra sesión", () => {
  assert.match(admin, /moduleAccessRequestVersion/);
  assert.match(admin, /requestVersion!==moduleAccessRequestVersion\|\|window\.MIRA_CURRENT_USER\?\.authUserId!==current\.authUserId/);
});

test("un fallo temporal al actualizar permisos conserva el último estado de la misma sesión", () => {
  assert.match(admin, /if\(!sameIdentity\)\{\s*allTargets\.forEach/);
  assert.match(admin, /se conserva el último estado seguro de esta sesión/);
  assert.match(admin, /mira:module-access-refresh-failed/);
});

test("un fallo temporal de autenticación no cierra la sesión automáticamente", () => {
  assert.match(auth, /function isDefinitiveAuthorizationFailure/);
  assert.match(auth, /if\(isDefinitiveAuthorizationFailure\(error\)\)\{[\s\S]*?await signOutCompletely\(\);\s*\} else \{/);
  assert.match(auth, /Falló temporalmente la revalidación\. Se conserva la sesión/);
  assert.match(auth, /error\.status=response\.status/);
});

test("el navegador carga las versiones corregidas de autenticación y permisos", () => {
  assert.ok(index.includes("mira-auth.js?v=20261114-auth-wrapper-2"));
  assert.ok(index.includes("mira-admin.js?v=20261114-module-refresh-safe-1"));
});

test("el cliente Better Auth y el wrapper interno Neon Auth comparten el JWT correcto", () => {
  assert.match(auth, /createInternalNeonAuth\(AUTH_URL/);\n  assert.match(auth, /const auth = neonAuth\.adapter/);\n  assert.match(auth, /neonAuth\.getJWTToken\(\)/);
  assert.match(data, /auth\.getJWTToken\(\)/);
  assert.doesNotMatch(data, /await auth\.token\(\)/);
  assert.match(data, /NEON_AUTH_JWT_MISSING/);
});

test("la exportación comunica explícitamente la denegación por falta de permiso", () => {
  assert.match(app, /Exportación bloqueada — No tienes permiso para exportar desde Base de datos general/);
  assert.match(app, /Puedes seguir consultando los registros si conservas el permiso Consulta/);
});
