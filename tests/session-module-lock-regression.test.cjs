const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const admin = fs.readFileSync(path.join(__dirname, "..", "mira-admin.js"), "utf8");
const auth = fs.readFileSync(path.join(__dirname, "..", "mira-auth.js"), "utf8");
const data = fs.readFileSync(path.join(__dirname, "..", "mira-data.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("una revalidación conserva el mapa común y evita el bloqueo visual de herramientas cartográficas", () => {
  assert.match(admin, /const sameIdentity=lastAppliedModuleAccessUserId===current\.authUserId/);
  assert.match(admin, /if\(!sameIdentity\)allTargets\.filter\(id=>!commonMapTargets\.has\(id\)\)/);
  assert.doesNotMatch(admin, /allTargets\.forEach\(id=>setModuleRestricted\(\$\(id\),true\)\);\s*if\(current\.role/);
});

test("el mapa territorial y Barrios/Puestos son comunes a todas las cuentas aprobadas", () => {
  const establishment = auth.slice(auth.indexOf("async function establishAuthenticatedUser"), auth.indexOf("async function restoreExistingSession"));
  const access = admin.slice(admin.indexOf("async function applyModuleAccess"), admin.indexOf("function init()"));
  assert.doesNotMatch(establishment, /getOwnModulePermissions/);
  assert.match(establishment, /Una cuenta activa, verificada y aprobada/);
  assert.match(access, /moduleKey==="centro_operaciones"\|\|canView\.has\(moduleKey\)/);
  assert.match(access, /commonMapTargets\.has\(id\)/);
});

test("las respuestas de permisos antiguas no pueden sobrescribir el estado de otra sesión", () => {
  assert.match(admin, /moduleAccessRequestVersion/);
  assert.match(admin, /requestVersion!==moduleAccessRequestVersion\|\|window\.MIRA_CURRENT_USER\?\.authUserId!==current\.authUserId/);
});

test("un fallo al consultar permisos bloquea módulos privados pero conserva el mapa común", () => {
  assert.match(admin, /const commonMapTargets=new Set\(MODULE_TARGETS\.centro_operaciones\)/);
  assert.match(admin, /const commonMap=commonMapTargets\.has\(id\)/);
  assert.match(admin, /setModuleRestricted\(\$\(id\),!commonMap\)/);
  assert.match(admin, /mira:module-access-refresh-failed/);
});
test("la revalidación de identidad no depende de permisos de módulos", () => {
  const revalidation = auth.slice(auth.indexOf("async function revalidateCurrentAuthorization"), auth.indexOf("async function signOutCompletely"));
  assert.doesNotMatch(revalidation, /getOwnModulePermissions/);
  assert.match(revalidation, /window\.dispatchEvent\(new Event\("mira:permissions-refreshed"\)\)/);
  assert.match(revalidation, /la matriz de módulos/);
});

test("la autenticación no realiza consultas de matriz de módulos y la API conserva códigos HTTP", () => {
  assert.doesNotMatch(auth, /getOwnModulePermissions/);
  assert.match(data, /error\.status=response\.status/);
});

test("un fallo temporal de autenticación no cierra la sesión automáticamente", () => {
  assert.match(auth, /function isDefinitiveAuthorizationFailure/);
  assert.match(auth, /if\(isDefinitiveAuthorizationFailure\(error\)\)\{[\s\S]*?await signOutCompletely\(\);\s*\} else \{/);
  assert.match(auth, /Falló temporalmente la revalidación\. Se conserva la sesión/);
  assert.match(auth, /error\.status=response\.status/);
});


test("la sincronización de autorización no vuelve a abrir el panel administrativo", () => {
  const sync = admin.slice(admin.indexOf("const syncVisibility=()=>"), admin.indexOf('window.addEventListener("mira:authenticated"'));
  assert.match(sync, /panel\.toggleAttribute\("data-admin-visible",authorized\)/);
  assert.match(sync, /if\(!authorized\)\{\s*closePanel\(\)/);
  assert.doesNotMatch(sync, /panel\.classList\.toggle\("hidden",!authorized\)/);
  assert.match(admin, /function openPanel\(\)[\s\S]*?classList\.remove\("hidden"\)/);
  assert.match(admin, /function closePanel\(\)[\s\S]*?classList\.add\("hidden"\)/);
});

test("el navegador carga las versiones corregidas de autenticación y permisos", () => {
  assert.ok(index.includes("mira-auth.js?v="));
  assert.ok(index.includes("mira-admin.js?v="));
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
  assert.match(auth, /else if\(signInCompleted\)[\s\S]*?[Cc]onservamos la sesión e intentaremos recuperarla/);
});

test("la restauración de sesión se reintenta tras fallos transitorios y al recuperar conexión", () => {
  assert.match(auth, /function scheduleSessionRestore/);
  assert.match(auth, /restoreRetryCount>=5/);
  assert.match(auth, /window\.addEventListener\("online"/);
  assert.match(auth, /else restoreExistingSession\(\)/);
});


test("una restauración antigua de Neon no puede cerrar un inicio de sesión más reciente", () => {
  assert.match(auth, /let authFlowRevision=0,loginInProgress=false/);
  assert.match(auth, /if\(restoreRunning \|\| loginInProgress \|\| authSignOutInProgress\)return/);
  assert.match(auth, /const revision=authFlowRevision/);
  assert.match(auth, /authFlowIsStale\(revision\)/);
  assert.match(auth, /establishAuthenticatedUser\(authUser,revision\)/);
  assert.match(auth, /const loginRevision=\+\+authFlowRevision/);
  assert.match(auth, /loginInProgress=true/);
  assert.match(auth, /if\(loginRevision===authFlowRevision\) loginInProgress=false/);
});

test("la revalidación no puede cerrar ni sustituir una sesión durante un nuevo login", () => {
  const revalidation = auth.slice(auth.indexOf("async function revalidateCurrentAuthorization"), auth.indexOf("async function signOutCompletely"));
  assert.match(revalidation, /if\(revalidationRunning\|\|loginInProgress\|\|!window\.MIRA_CURRENT_USER\)return/);
  assert.match(revalidation, /if\(authFlowIsStale\(revision\)\)return/);
});

test("el render territorial monta SVG explícitamente y dispone de recuperación Canvas", () => {
  assert.match(app, /miraTerritorySvgRenderer\.addTo\(map\)/);
  assert.match(app, /asegurarRenderizadorTerritorialCanvas/);
  assert.match(app, /territoryRendererMode = 'canvas'/);
  assert.match(app, /rendererReady/);
  assert.match(app, /tamanoMapa: map \? \{ ancho: map\.getSize\(\)\.x, alto: map\.getSize\(\)\.y \}/);
});

test("el GeoJSON territorial conserva los 143 polígonos y el anillo interior del KML", () => {
  const geo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "barrios_poligonos_kml_aportado.geojson"), "utf8"));
  const kml = fs.readFileSync(path.join(__dirname, "..", "ZONAS_LIDERES_MIRA_fuente.kml"), "utf8");
  assert.equal(geo.features.length, 143);
  assert.equal((kml.match(/<Placemark\b/g) || []).length, 143);
  assert.match(kml, /<innerBoundaryIs>/);
  const chico = geo.features.find(feature => feature.properties?.nombre === "CHICO I (FRENTE)");
  assert.equal(chico?.geometry?.type, "Polygon");
  assert.equal(chico?.geometry?.coordinates?.length, 2);
});

test("el cierre de una sesión anterior bloquea temporalmente un login concurrente", () => {
  assert.match(auth, /authSignOutInProgress=false/);
  assert.match(auth, /if\(restoreRunning \|\| loginInProgress \|\| authSignOutInProgress\)return/);
  assert.match(auth, /if\(loginInProgress \|\| authSignOutInProgress\)/);
  assert.match(auth, /authSignOutInProgress=true/);
  assert.match(auth, /finally \{\s*authSignOutInProgress=false;/);
});
