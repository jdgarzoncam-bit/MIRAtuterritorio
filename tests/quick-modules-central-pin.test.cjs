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

test("Módulos es el único punto que solicita el PIN y lo valida con el RPC protegido de Neon", () => {
  assert.match(quick, /MIRA_DATA\.verifyParticipantAccessPin\(verifier\)/);
  assert.match(quick, /PBKDF2/);
  assert.match(quick, /PIN_ITERATIONS\s*=\s*310000/);
  assert.match(quick, /sessionStorage\.setItem\(TOKEN_KEY/);
  assert.doesNotMatch(portal, /pubPinSubmit|pubGate|pubPinStatus|derivePinVerifier|verifyParticipantAccessPin/);
  assert.doesNotMatch(activityHtml, /id="pubGate"|id="pubPinSubmit"|id="pubLock"/);
});

test("Registrar participante reutiliza el mismo token de la sesión y no vuelve a pedir el PIN", () => {
  assert.match(quick, /sessionStorage\.getItem\(TOKEN_KEY\)/);
  assert.match(quick, /window\.location\.assign\("actividad\.html/);
  assert.match(portal, /sessionStorage\.getItem\(MODULE_ACCESS_TOKEN_KEY\)/);
  assert.match(portal, /accessToken = sharedToken/);
  assert.match(portal, /sessionStorage\.removeItem\(MODULE_ACCESS_TOKEN_KEY\)/);
  assert.match(data, /access_token:access_token/);
  assert.match(data, /Ingresa el PIN de acceso antes de registrar la asistencia/);
});

test("la autorización central se mantiene revocable y Testigos sigue bloqueado", () => {
  assert.match(quick, /sessionStorage\.removeItem\(TOKEN_KEY\)/);
  assert.match(quick, /miraQuickModulesLockBtn/);
  assert.match(quick, /mira:signed-out/);
  assert.match(quick, /testigos\.disabled\s*=\s*true/);
  assert.match(html, /id="miraQuickTestigosBtn"[^>]*disabled/);
  assert.match(html, /id="miraQuickRegisterParticipantBtn"/);
});

test("el registro consulta inscripción previa y exige token antes de guardar en Neon", () => {
  assert.match(portal, /checkPublicActivityParticipant\(cedula, actividadId, accessToken\)/);
  assert.match(portal, /currentPersonAlreadyRegistered/);
  assert.match(portal, /currentPersonAlreadyRegistered \|\| !personLookupCompleted/);
  assert.match(data, /p_cedula:"__MIRA_ACTIVITY_CHECK__"/);
  assert.match(data, /registerPublicActivityParticipant/);
  assert.match(data, /rpc\/public_register_activity_participant/);
});

test("el portal no muestra ningún PIN secundario por estilos móviles", () => {
  assert.match(activityHtml, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(portal, /if \(!sharedToken \|\| expiresAt <= Date\.now\(\)\)/);
  assert.match(portal, /index\.html\?openModules=1&authorization=expired/);
});

test("el token de autorización central sigue siendo válido entre identidades Neon de páginas distintas", () => {
  const migration = read("migrations/20261124_participant_access_token_actor_independent.sql");
  assert.equal((migration.match(/s\\.token=v_access_token AND s\\.expires_at>now\\(\\)/g) || []).length, 3);
  assert.doesNotMatch(migration, /s\\.token=v_access_token AND s\\.actor_uid=v_actor/);
  assert.match(migration, /credencial bearer/);
  assert.match(migration, /expires_at>now\\(\\)/);
});
