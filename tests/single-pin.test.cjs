const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");
const quick = read("mira-quick-modules.js");
const portal = read("activity-portal.js");
const data = read("mira-data.js");
const home = read("index.html");
const portalHtml = read("actividad.html");

test("solo el menú Módulos solicita y verifica el PIN", () => {
  assert.match(quick, /verifyParticipantAccessPin/);
  assert.match(quick, /derivePinVerifier/);
  assert.doesNotMatch(portal, /createInternalNeonAuth|PUBLIC_AUTH_URL|derivePinVerifier|verifyParticipantAccessPin|PIN_SALT_HEX|PIN_ITERATIONS/);
  assert.doesNotMatch(portalHtml, /pubPinSubmit|pubGate|type="password"/);
});

test("el portal usa el mismo JWT de Neon que autorizó el PIN central", () => {
  assert.match(data, /sessionStorage\.setItem\("miraParticipantAuthJwt",authToken\)/);
  assert.match(data, /authToken=null/);
  assert.match(portal, /getJWTToken: \(\) => sessionStorage\.getItem\("miraParticipantAuthJwt"\)/);
  assert.match(portal, /sessionStorage\.getItem\(MODULE_ACCESS_TOKEN_KEY\)/);
  assert.match(quick, /sessionStorage\.removeItem\("miraParticipantAuthJwt"\)/);
});

test("las páginas cargan las versiones coordinadas del flujo de PIN único", () => {
  assert.match(home, /mira-data\.js\?v=20261124-single-pin-6/);
  assert.match(home, /mira-quick-modules\.js\?v=20261124-single-pin-6/);
  assert.match(portalHtml, /activity-portal\.js\?v=20261124-single-pin-6/);
  assert.match(portal, /mira-data\.js\?v=20261124-single-pin-6/);
});
