const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");
const quick = read("mira-quick-modules.js");
const portal = read("activity-portal.js");
const data = read("mira-data.js");
const auth = read("mira-auth.js");
const home = read("index.html");
const portalHtml = read("actividad.html");

test("solo el menú Módulos solicita y verifica el PIN central", () => {
  assert.ok(quick.includes("verifyParticipantAccessPin"));
  assert.ok(quick.includes("derivePinVerifier"));
  assert.doesNotMatch(portal, /createInternalNeonAuth|PUBLIC_AUTH_URL|derivePinVerifier|verifyParticipantAccessPin|PIN_SALT_HEX|PIN_ITERATIONS/);
  assert.doesNotMatch(portalHtml, /pubPinSubmit|pubGate|type="password"/);
});

test("el portal reutiliza el JWT anónimo y el token temporal autorizados desde Módulos", () => {
  assert.ok(data.includes('sessionStorage.setItem("miraParticipantAuthJwt",authToken)'));
  assert.ok(data.includes("authToken=null"));
  assert.ok(portal.includes('getJWTToken: () => sessionStorage.getItem("miraParticipantAuthJwt")'));
  assert.ok(portal.includes("sessionStorage.getItem(MODULE_ACCESS_TOKEN_KEY)"));
  assert.ok(quick.includes('sessionStorage.removeItem("miraParticipantAuthJwt")'));
});

test("las páginas cargan clientes de datos y portal con versiones explícitas", () => {
  assert.match(home, /mira-data\.js\?v=[^"']+/);
  assert.match(home, /mira-auth\.js\?v=[^"']+/);
  assert.match(home, /mira-quick-modules\.js\?v=[^"']+/);
  assert.match(portalHtml, /activity-portal\.js\?v=[^"']+/);
  assert.ok(portal.includes("./mira-data.js?v="));
  assert.ok(quick.includes("./mira-data.js?v="));
});

test("los errores de permisos no provocan una segunda solicitud de PIN", () => {
  assert.doesNotMatch(portal, /permission denied\/i\.test\(message\)\s*lockModule/);
  assert.ok(portal.includes("sessionStorage.getItem(MODULE_ACCESS_TOKEN_KEY)"));
  assert.ok(portal.includes("window.location.replace(\"index.html?openModules=1&authorization=expired\")"));
});

test("el Centro de Operaciones se activa antes de notificar autenticación", () => {
  const activation = auth.indexOf("window.activarPMUAutenticado();");
  const authenticated = auth.indexOf('window.dispatchEvent(new Event("mira:authenticated"));');
  assert.ok(activation >= 0 && authenticated > activation);
  assert.ok(auth.includes("window.MIRA_SHOW_MOBILE_MODULES();"));
});

test("la lista de actividades valida el tipo de respuesta y maneja el caso vacío", () => {
  assert.ok(portal.includes("MIRA_DATA.listPublicActivityOptions()"));
  assert.ok(portal.includes("Array.isArray(rows)"));
  assert.ok(portal.includes("if (!activities.length)"));
  assert.ok(portal.includes("No hay actividades abiertas para inscripción"));
  assert.ok(portal.includes("restoreCentralModuleAuthorization"));
});

test("la entrada al Centro de Operaciones difiere el trabajo pesado del mapa", () => {
  const app = read("app.js");
  assert.ok(app.includes("window.requestIdleCallback(initializeMapAfterEntry"));
  assert.ok(app.includes("window.requestAnimationFrame(scheduleMapInitialization)"));
});
