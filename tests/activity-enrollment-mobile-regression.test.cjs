const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("el portal exige autorización central y no contiene un segundo PIN", () => {
  const html = read("actividad.html");
  const portal = read("activity-portal.js");
  assert.doesNotMatch(html, /id="pubGate"|id="pubPinSubmit"|id="pubLock"/);
  assert.doesNotMatch(portal, /pubPinSubmit|pubGate|pubPinStatus/);
  assert.match(portal, /sessionStorage\.getItem\(MODULE_ACCESS_TOKEN_KEY\)/);
  assert.match(portal, /index\.html\?openModules=1/);
});

test("la actividad se selecciona antes de consultar cédula y el botón se bloquea sin actividad", () => {
  const html = read("actividad.html");
  const portal = read("activity-portal.js");
  assert.ok(html.indexOf('id="pubActivity"') < html.indexOf('id="pubCedula"'));
  assert.match(html, /id="pubLookup" type="button" disabled/);
  assert.match(portal, /if \(!actividadId\) return status/);
  assert.match(portal, /checkPublicActivityParticipant\(cedula, actividadId, accessToken\)/);
});

test("el estado de inscripción se consulta antes de recuperar la ficha y bloquea duplicados", () => {
  const portal = read("activity-portal.js");
  const data = read("mira-data.js");
  assert.ok(portal.indexOf("checkPublicActivityParticipant(cedula, actividadId, accessToken)") <
    portal.indexOf("const person = enrollment?.person || null;"));
  assert.match(portal, /const person = enrollment\?\.person \|\| null/);
  assert.match(portal, /currentPersonAlreadyRegistered/);
  assert.match(portal, /Esta persona YA ESTÁ INSCRITA/);
  assert.match(portal, /currentPersonAlreadyRegistered \|\| !personLookupCompleted/);
  assert.match(data, /p_cedula:"__MIRA_ACTIVITY_CHECK__"/);
  assert.match(data, /rpc\/public_register_activity_participant/);
  assert.doesNotMatch(portal, /lookupPublicPerson\(cedula, accessToken\)/);
});

test("el retorno a módulos restaura el panel después de volver desde el portal", () => {
  const quick = read("mira-quick-modules.js");
  const html = read("actividad.html");
  assert.match(html, /index\.html\?openModules=1/);
  assert.match(quick, /get\("openModules"\) === "1"/);
  assert.match(quick, /addEventListener\("pageshow", restoreModulesFromNavigation\)/);
  assert.match(quick, /miraReturnToModules:true/);
  assert.match(quick, /history\.replaceState\(\{miraReturnToModules:true\}/);
  assert.match(quick, /menu\.classList\.add\("hidden"\)/);
  assert.doesNotMatch(quick, /label\.textContent = open \? "Inicio"/);
  assert.doesNotMatch(quick, /lockAuthorization\("La sesión se cerró/);
  assert.match(quick, /panel\.classList\.remove\("hidden"\)/);
});

test("la navegación móvil usa flecha y las transiciones evitan clip-path animado", () => {
  const mobile = read("mobile-operations.js");
  const css = read("mira-mobile-performance.css");
  assert.match(mobile, /aria-hidden="true">☰/);
  assert.match(mobile, /<b>Módulos<\/b>/);
  assert.match(mobile, /mira:pmu-ready/);
  assert.match(mobile, /mira:mobile-login-requested/);
  assert.match(css, /clip-path: none !important/);
  assert.match(css, /transition: opacity \.16s ease-out, transform \.18s/);
});

test("el selector de barrios no despliega todo el listado al enfocar", () => {
  const app = read("app.js");
  assert.match(app, /Escribe el nombre de un barrio o sector para buscarlo/);
  assert.match(app, /slice\(0,30\)/);
});

test("la restauración anónima de Neon no cancela el intento de login móvil", () => {
  const mobile = read("mobile-operations.js");
  const auth = read("mira-auth.js");
  assert.match(mobile, /admin-login-active.*MIRA_CURRENT_USER/);
  assert.match(auth, /interfaceReady/);
  assert.match(auth, /if\(interfaceReady\)/);
});

test("el menú rápido solo se muestra en la portada pública", () => {
  const app = read("app.js");
  assert.match(app, /pmuVisible/);
  assert.match(app, /!landingVisible \|\| pmuVisible \|\| Boolean\(user\)/);
});

test("el portal de actividades fuerza una nueva versión del cliente de Neon", () => {
  const html = read("actividad.html");
  const portal = read("activity-portal.js");
  assert.match(html, /activity-portal\.js\?v=20261124-activity-hotfix-3/);
  assert.match(portal, /mira-data\.js\?v=20261124-activity-hotfix-3/);
  assert.doesNotMatch(portal, /public_check_activity_participant/);
});

test("el inicio de sesión móvil abre el Centro de Operaciones cuando el PMU está listo", () => {
  const auth = read("mira-auth.js");
  const app = read("app.js");
  const mobile = read("mobile-operations.js");
  assert.match(auth, /mira:mobile-login-requested/);
  assert.match(app, /mira:pmu-ready/);
  assert.match(mobile, /mira:pmu-ready/);
  assert.match(mobile, /if\(document\.body\.classList\.contains\('admin-login-active'\)\)return/);
});
