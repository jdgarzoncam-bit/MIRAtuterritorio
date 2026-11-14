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
  assert.ok(index.includes("mira-auth.js?v=20261114-auth-wrapper-3"));
  assert.ok(index.includes("mira-admin.js?v=20261114-module-refresh-safe-1"));
});

test("el wrapper Neon Auth expone el JWT del SDK y conserva el cliente Better Auth", () => {
  assert.match(auth, /createInternalNeonAuth\(AUTH_URL/);
  assert.match(auth, /const auth = neonAuth\.adapter/);
  assert.match(auth, /getJWTToken: \(\) => neonAuth\.getJWTToken\(\)/);
  assert.match(auth, /neonAuth\.getJWTToken\(\)/);
  assert.match(data, /auth\.getJWTToken\(\)/);
  assert.match(data, /auth\.getAnonymousToken\(\)/);
  assert.doesNotMatch(data, /await auth\.token\(\)/);
  assert.match(data, /NEON_AUTH_JWT_MISSING/);
});

test("la exportación comunica explícitamente la denegación por falta de permiso", () => {
  assert.match(app, /Exportación bloqueada\\nNo tienes permiso para exportar desde Base de datos general/);
  assert.match(app, /Puedes seguir consultando los registros si conservas el permiso Consulta/);
  assert.match(app, /<strong>Exportación bloqueada<\/strong>/);
});
test("la denegación de exportación se comprueba antes de exigir la librería Excel", () => {
  const handler = app.slice(app.indexOf('$id("databaseExportBtn").addEventListener'), app.indexOf('  });', app.indexOf('$id("databaseExportBtn").addEventListener')));
  assert.ok(handler.indexOf('await refreshPermissions()') < handler.indexOf('if(!window.XLSX)'));
  assert.ok(handler.includes('allowed("base_datos_general","export")'));
  assert.ok(handler.includes('allowed(dataset.module,"export")'));
});

test("la revalidación cierra sesiones cuando Neon confirma que el perfil fue desactivado o dejó de estar autorizado", () => {
  const revalidation = auth.slice(auth.indexOf("async function revalidateCurrentAuthorization"), auth.indexOf("async function signOutCompletely"));
  assert.match(revalidation, /authUser\.emailVerified!==true\)throw markDefinitive/);
  assert.match(revalidation, /throw markDefinitive\(new Error\("La cuenta fue desactivada o sus condiciones de acceso cambiaron\."/);
  assert.match(revalidation, /if\(isDefinitiveAuthorizationFailure\(error\)\)\{[\s\S]*?await signOutCompletely\(\)/);
});

test("un error 404 de Data API no se interpreta automáticamente como sesión revocada", () => {
  assert.match(auth, /return status===401\|\|status===403/);
  assert.doesNotMatch(auth, /return status===401\|\|status===403\|\|status===404/);
});

test("el inicio de sesión conserva una sesión aceptada ante fallos temporales de validación", () => {
  assert.match(auth, /let signInCompleted=false/);
  assert.match(auth, /signInCompleted=true/);
  assert.match(auth, /else if\(signInCompleted\)[\s\S]*?conservamos la sesión e intentaremos recuperarla/);
});

test("la restauración de sesión se reintenta tras fallos transitorios y al recuperar conexión", () => {
  assert.match(auth, /function scheduleSessionRestore/);
  assert.match(auth, /restoreRetryCount>=5/);
  assert.match(auth, /window\.addEventListener\("online"/);
  assert.match(auth, /else restoreExistingSession\(\)/);
});
