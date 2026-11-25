const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("InfoMIRA normaliza puestos con espacios y tildes para enlazar el catálogo geográfico", () => {
  const match = app.match(/const normalizarPuestoInfoMira = value =>[\\s\\S]*?;(?=\\s*function actualizarMapaInfoMira)/);
  assert.ok(match, "Debe existir la función de normalización usada por el mapa");
  const normalize = vm.runInNewContext("(function(){ " + match[0] + " return normalizarPuestoInfoMira; })()");
  assert.equal(normalize("INDUSTRIAL SEDE TALLERES"), "INDUSTRIAL SEDE TALLERES");
  assert.equal(normalize("  INDUSTRIAL   SEDE TALLERES "), "INDUSTRIAL SEDE TALLERES");
  assert.equal(normalize("Colegio San Agustín"), "COLEGIO SAN AGUSTIN");
});

test("InfoMIRA enlaza resultados con el catálogo de puestos y sustituye marcadores generales", () => {
  assert.match(app, /"nombre": "INDUSTRIAL SEDE TALLERES"/);
  assert.match(app, /const nombrePuesto = row\\.puesto_votacion \\|\\| row\\.puesto_original \\|\\| personaDe\\(row\\)\\?\\.puesto_votacion/);
  assert.match(app, /puestosLayerGroup\\.remove\\(\\)/);
  assert.match(app, /map\\.setView\\(bounds\\[0\\],16\\)/);
});

test("GitHub Pages carga la nueva versión de app.js y evita reutilizar el archivo anterior en caché", () => {
  assert.match(index, /app\\.js\\?v=20261125-infomira-polling-place-2/);
});
