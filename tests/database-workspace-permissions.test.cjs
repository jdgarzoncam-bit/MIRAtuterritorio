const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("retirar Exportar no cierra Base de datos general si se conserva Consulta", () => {
  assert.ok(app.includes('const stillCanView=admin()||allowed("base_datos_general","view")'));
  assert.ok(!app.includes("const revoked=[...before].some(key=>!permissions.has(key));if(revoked)back()"));
});

test("los cambios de permisos de consulta actualizan la vista sin cerrar la sesión", () => {
  assert.ok(app.includes("const viewPermissionsChanged=wasAdmin!==admin()"));
  assert.ok(app.includes("if(viewPermissionsChanged&&activeView){try{await render(activeView);"));
  assert.ok(app.includes("La sesión permanece activa"));
});

test("la pérdida de Consulta sí cierra únicamente el espacio de Base de datos general", () => {
  assert.ok(app.includes('if(!stillCanView){back();say("Tu permiso de consulta en Base de datos general fue retirado'));
});

test("el HTML solicita la versión nueva de app.js para evitar caché del navegador", () => {
  assert.ok(index.includes("app.js?v=20261113-export-revoke-live-4"));
});
