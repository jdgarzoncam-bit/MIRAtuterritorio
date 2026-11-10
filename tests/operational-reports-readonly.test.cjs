const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const js = fs.readFileSync(path.join(__dirname, "..", "reportes-operativos.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const admin = fs.readFileSync(path.join(__dirname, "..", "mira-admin.js"), "utf8");
const data = fs.readFileSync(path.join(__dirname, "..", "mira-data.js"), "utf8");

test("Reportes Operativos tiene una bandeja independiente dentro del Centro de Operaciones", () => {
  assert.match(html, /id="dropdown-reportes-operativos"/);
  assert.match(html, /id="operationalReportsList"/);
  assert.match(admin, /reportes:\["dropdown-reportes-operativos"\]/);
});

test("la bandeja exige reportes:view y falla cerrada si no puede comprobar el permiso", () => {
  assert.match(js, /item\.module_key === "reportes" && item\.action_key === "view" && item\.allowed === true/);
  assert.match(js, /if \(!state\.authorized\) throw new Error/);
  assert.match(js, /catch \(error\)[\s\S]*?return false/);
});

test("la bandeja solo consulta reportes operativos y no implementa escritura", () => {
  assert.match(js, /listOperationalReports\(\{ limit: 100 \}\)/);
  assert.doesNotMatch(js, /updateOperationalReport|deleteOperationalReport|method:\s*["'](PATCH|DELETE|POST)["']/);
  assert.match(data, /listOperationalReports\(/);
});

test("la pantalla identifica expresamente el modo de solo lectura", () => {
  assert.match(js, /Consulta · Solo lectura/);
  assert.match(html, /no permite modificar ni eliminar reportes/i);
});
