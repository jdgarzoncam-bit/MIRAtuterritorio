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

test("solo el menú Módulos solicita y verifica el PIN", () => {
  assert.ok(quick.includes("verifyParticipantAccessPin"));
  assert.ok(quick.includes("derivePinVerifier"));
  assert.doesNotMatch(portal, /createInternalNeonAuth|PUBLIC_AUTH_URL|derivePinVerifier|verifyParticipantAccessPin|PIN_SALT_HEX|PIN_ITERATIONS/);
  assert.doesNotMatch(portalHtml, /pubPinSubmit|pubGate|type="password"/);
});

test("el portal reutiliza el JWT de Neon y el token temporal autorizados desde Módulos", () => {
  assert.ok(data.includes('sessionStorage.setItem("miraParticipantAuthJwt",authToken)'));
  assert.ok(data.includes("authToken=null"));
  assert.ok(portal.includes('getJWTToken: () => sessionStorage.getItem("miraParticipantAuthJwt")'));
  assert.ok(portal.includes("sessionStorage.getItem(MODULE_ACCESS_TOKEN_KEY)"));
  assert.ok(quick.includes('sessionStorage.removeItem("miraParticipantAuthJwt")'));
});

test("las páginas cargan las versiones coordinadas del flujo de PIN único", () => {
  assert.ok(home.includes("mira-data.js?v=20261124-activity-retry-8"));
  assert.ok(home.includes("mira-quick-modules.js?v=20261124-activity-retry-8"));
  assert.ok(portalHtml.includes("activity-portal.js?v=20261124-activity-retry-8"));
  assert.ok(portal.includes('mira-data.js?v=20261124-activity-retry-8'));
});

test("un error genérico de permisos no borra la autorización ni provoca otro PIN", () => {
  assert.equal(portal.includes('permission denied/i.test(message)) lockModule'), false);
  assert.ok(portal.includes('if (/autorización venció|PIN de acceso|token de acceso.*(venc|inválid)|no es válida/i.test(message)) lockModule(message);'));
  assert.ok(quick.includes("actividad.html?v=20261124-activity-retry-8"));
});

test("el Centro de Operaciones se activa antes de notificar autenticación", () => {
  const activation = auth.indexOf("window.activarPMUAutenticado();");
  const authenticated = auth.indexOf('window.dispatchEvent(new Event("mira:authenticated"));');
  assert.ok(activation >= 0 && authenticated > activation);
  assert.ok(auth.includes("window.MIRA_SHOW_MOBILE_MODULES();"));
});

test("el registro carga actividades con respuesta validada y ofrece reintento si falla", () => {
  assert.ok(portal.includes("MIRA_DATA.listPublicActivityOptions()"));
  assert.ok(portal.includes("Array.isArray(response?.data)"));
  assert.ok(portal.includes("No fue posible cargar las actividades:"));
  assert.ok(portal.includes("Reintentar consulta"));
  assert.ok(portal.includes("syncLookupButton();"));
});

test("la entrada al Centro de Operaciones no espera la carga de personas y asistencias", () => {
  const app = read("app.js");
  assert.doesNotMatch(app, /addEventListener\(['"]mira:authenticated['"],\s*loadActivitiesFromNeon/);
  assert.ok(app.includes("window.requestIdleCallback(initializeMapAfterEntry"));
  assert.ok(app.includes("window.requestAnimationFrame(scheduleMapInitialization)"));
});

test("el botón de reintento no ejecuta recursión y sirve también para lista vacía", () => {
  const helper = portal.match(/const addRetry = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(helper, "debe existir el helper addRetry");
  assert.doesNotMatch(helper[1], /\baddRetry\s*\(/, "el helper no debe llamarse a sí mismo");
  assert.ok(helper[1].includes('document.createElement("button")'));
  assert.ok(helper[1].includes('retry.addEventListener("click", () => refreshActivities())'));
  assert.ok(portal.includes("if (!activities.length)"));
  assert.ok(portal.includes("addRetry();"));
});
