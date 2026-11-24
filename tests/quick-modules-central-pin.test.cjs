const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const quick = read("mira-quick-modules.js");
const portal = read("activity-portal.js");
const html = read("index.html");
const activityHtml = read("actividad.html");
const data = read("mira-data.js");

test("Módulos es el único punto que solicita y valida el PIN", () => {
  assert.match(quick, /MIRA_DATA\.verifyParticipantAccessPin\(verifier\)/);
  assert.match(quick, /PBKDF2/);
  assert.match(quick, /PIN_ITERATIONS\s*=\s*310000/);
  assert.match(html, /id="miraModulePinGate"/);
  assert.doesNotMatch(portal, /pubPinSubmit|pubGate|pubPinStatus|derivePinVerifier|verifyParticipantAccessPin|PIN_SALT_HEX|PIN_ITERATIONS/);
  assert.doesNotMatch(activityHtml, /id="pubGate"|id="pubPinSubmit"|id="pubLock"|type="password"/);
});

test("el portal reutiliza el mismo JWT que validó el PIN central; no crea otra identidad", () => {
  assert.match(data, /sessionStorage\.setItem\("miraParticipantAuthJwt",authToken\)/);
  assert.match(data, /miraRequest\([^\n]+authToken,body:/);
  assert.match(data, /authToken=null/);
  assert.match(portal, /getJWTToken: \(\) => sessionStorage\.getItem\("miraParticipantAuthJwt"\)/);
  assert.doesNotMatch(portal, /createInternalNeonAuth|PUBLIC_AUTH_URL|new PIN|PIN de acceso/);
  assert.match(portal, /sessionStorage\.getItem\(MODULE_ACCESS_TOKEN_KEY\)/);
  assert.match(portal, /accessToken = sharedToken/);
});

test("Registrar participante conserva el token central entre páginas y no solicita otro PIN", () => {
  assert.match(quick, /sessionStorage\.setItem\(TOKEN_KEY/);
  assert.match(quick, /window\.location\.assign\("actividad\.html/);
  assert.match(quick, /sessionStorage\.getItem\(TOKEN_KEY\)/);
  assert.match(portal, /sessionStorage\.getItem\(MODULE_ACCESS_TOKEN_KEY\)/);
  assert.match(portal, /sessionStorage\.removeItem\("miraParticipantAuthJwt"\)/);
  assert.match(data, /access_token:access_token/);
});

test("revocar o vencer la autorización limpia ambos tokens y Testigos sigue bloqueado", () => {
  assert.match(quick, /sessionStorage\.removeItem\(TOKEN_KEY\)/);
  assert.match(quick, /sessionStorage\.removeItem\("miraParticipantAuthJwt"\)/);
  assert.match(quick, /miraQuickModulesLockBtn/);
  assert.match(quick, /mira:signed-out/);
  assert.match(quick, /testigos\.disabled\s*=\s*true/);
  assert.match(html, /id="miraQuickTestigosBtn"[^>]*disabled/);
  assert.match(html, /id="miraQuickRegisterParticipantBtn"/);
});

test("el registro comprueba duplicados y guarda usando la autorización central", () => {
  assert.match(portal, /checkPublicActivityParticipant\(cedula, actividadId, accessToken\)/);
  assert.match(portal, /currentPersonAlreadyRegistered/);
  assert.match(portal, /currentPersonAlreadyRegistered \|\| !personLookupCompleted/);
  assert.match(data, /p_cedula:"__MIRA_ACTIVITY_CHECK__"/);
  assert.match(data, /registerPublicActivityParticipant/);
  assert.match(data, /rpc\/public_register_activity_participant/);
});

test("las páginas QA cargan la misma versión del cliente de datos y no hay PIN secundario en el HTML", () => {
  assert.match(html, /mira-data\.js\?v=20261124-single-pin-6/);
  assert.match(html, /mira-quick-modules\.js\?v=20261124-single-pin-6/);
  assert.match(activityHtml, /activity-portal\.js\?v=20261124-single-pin-6/);
  assert.match(portal, /mira-data\.js\?v=20261124-single-pin-6/);
  assert.doesNotMatch(activityHtml, /miraModulePin|miraModulePinGate|pubPinSubmit/);
});
