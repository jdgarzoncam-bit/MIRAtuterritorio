const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sources = fs
  .readdirSync(root)
  .filter((name) => /\.(html|js)$/.test(name))
  .map((name) => ({ name, text: fs.readFileSync(path.join(root, name), "utf8") }));

// Cada URL distinta de un módulo ES crea una instancia separada. mira-data.js
// publica window.MIRA_DATA al evaluarse; si se carga con versiones distintas, la
// última instancia (posiblemente una copia vieja en caché) sobrescribe a las demás.
test("mira-data.js se carga siempre con una única versión explícita", () => {
  const refs = [];
  for (const { name, text } of sources) {
    const re = /mira-data\.js(\?v=[^"'\s)]+)?/g;
    let m;
    while ((m = re.exec(text))) {
      const before = text.slice(Math.max(0, m.index - 12), m.index);
      // Solo importaciones y etiquetas <script>, no menciones dentro de mensajes de texto.
      if (/(["'])\.?\/?$/.test(before) || /src="$/.test(before)) {
        refs.push({ name, version: m[1] || "(sin versión)" });
      }
    }
  }
  assert.ok(refs.length >= 4, "se esperaban al menos 4 referencias a mira-data.js");
  const versions = new Set(refs.map((r) => r.version));
  assert.equal(
    versions.size,
    1,
    "mira-data.js debe usar una sola versión; encontradas: " + JSON.stringify(refs)
  );
  assert.ok(![...versions][0].startsWith("(sin"), "mira-data.js debe llevar ?v=");
});
