const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("retirar Exportar no cierra Base de datos general si se conserva Consulta", () => {
  assert.match(app, /const stillCanView=admin\(\)\|\|allowed\("base_datos_general","view"\)/);
  assert.doesNotMatch(app, /const revoked=\[\.\.\.before\]\.some\(key=>!permissions\.has\(key\)\);if\(revoked\)back\(\)/);
});

test("los cambios de permisos actualizan la vista activa sin cerrar la sesión", () => {
  assert.match(app, /if\(activeView\)\{try\{await render\(activeView\);/);
  assert.match(app, /La sesión permanece activa/);
});

test("la pérdida de Consulta sí cierra únicamente el espacio de Base de datos general", () => {
  assert.match(app, /if\(!stillCanView\)\{back\(\);say\("Tu permiso de consulta en Base de datos general fue retirado/);
});

test("el HTML solicita la versión nueva de app.js para evitar caché del navegador", () => {
  assert.match(index, /app\.js\?v=20261113-export-revoke-live-3/);
});
