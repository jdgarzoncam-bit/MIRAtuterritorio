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
    portal.indexOf("lookupPublicPerson(cedula, accessToken)", portal.indexOf("checkPublicActivityParticipant(cedula, actividadId, accessToken)")));
  assert.match(portal, /currentPersonAlreadyRegistered/);
  assert.match(portal, /Esta persona YA ESTÁ INSCRITA/);
  assert.match(portal, /currentPersonAlreadyRegistered \|\| !personLookupCompleted/);
  assert.match(data, /rpc\/public_check_activity_participant/);
});

test("el retorno a módulos restaura el panel después de volver desde el portal", () => {
  const quick = read("mira-quick-modules.js");
  const html = read("actividad.html");
  assert.match(html, /index\.html\?openModules=1/);
  assert.match(quick, /get\("openModules"\) === "1"/);
  assert.match(quick, /panel\.classList\.remove\("hidden"\)/);
});

test("la navegación móvil usa flecha y las transiciones evitan clip-path animado", () => {
  const mobile = read("mobile-operations.js");
  const css = read("mira-mobile-performance.css");
  assert.match(mobile, /aria-hidden="true">←/);
  assert.match(css, /clip-path: none !important/);
  assert.match(css, /transition: opacity \.16s ease-out, transform \.18s/);
});
