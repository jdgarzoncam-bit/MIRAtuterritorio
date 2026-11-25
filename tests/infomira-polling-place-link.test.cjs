const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("InfoMIRA normaliza puestos con espacios y tildes para enlazar el catálogo geográfico", () => {
  const start = app.indexOf("const normalizarPuestoInfoMira =");
  const end = app.indexOf("function actualizarMapaInfoMira", start);
  assert.ok(start >= 0 && end > start, "Debe existir la función de normalización usada por el mapa");
  const declaration = app.slice(start, end).trim();
  const normalize = vm.runInNewContext("(() => { " + declaration + "; return normalizarPuestoInfoMira; })()");
  assert.equal(normalize("INDUSTRIAL SEDE TALLERES"), "INDUSTRIAL SEDE TALLERES");
  assert.equal(normalize("  INDUSTRIAL   SEDE TALLERES "), "INDUSTRIAL SEDE TALLERES");
  assert.equal(normalize("Colegio San Agustín"), "COLEGIO SAN AGUSTIN");
});

test("InfoMIRA enlaza resultados con el catálogo de puestos y sustituye marcadores generales", () => {
  assert.ok(app.includes('"nombre": "INDUSTRIAL SEDE TALLERES"'));
  assert.ok(app.includes("const nombrePuesto = row.puesto_votacion || row.puesto_original || personaDe(row)?.puesto_votacion"));
  assert.ok(app.includes("puestosLayerGroup.remove()"));
  assert.ok(app.includes("map.setView(bounds[0],16)"));
  assert.ok(app.includes("marker.bindPopup("));
  assert.ok(app.includes("infoMiraMarkers[0]?.openPopup()"));
});

test("GitHub Pages carga la nueva versión de app.js y evita reutilizar el archivo anterior en caché", () => {
  assert.ok(index.includes('app.js?v=20261125-infomira-polling-place-3'));
});
