const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

// El portal de actividades es público (sin sesión): lo que llega de la base de datos
// nunca debe interpretarse como HTML.
test("el portal público de actividades no inyecta datos en innerHTML", () => {
  const portal = read("activity-portal.js");
  assert.doesNotMatch(portal, /innerHTML\s*=[^;]*\$\{/, "no se debe interpolar en innerHTML");
  assert.doesNotMatch(portal, /innerHTML\s*=[^;]*activit/i, "las actividades no se pintan con innerHTML");
  assert.match(portal, /new Option\(/, "las opciones deben crearse con la API del DOM");
});

// Detecta archivos locales mal escritos o borrados que dejarían una página rota en producción.
test("todas las referencias locales de scripts, estilos y datos existen", () => {
  const sources = fs
    .readdirSync(root)
    .filter((name) => /\.(html|js)$/.test(name))
    .map((name) => ({ name, text: read(name) }));
  const missing = [];
  const attr = /(?:src|href)=["']([^"'#?]+\.(?:js|css|json|geojson|html|png|jpe?g|svg|ico|webmanifest))/g;
  const dyn = /(?:fetch|import)\(?\s*["'](\.?\/?[\w./-]+\.(?:json|geojson|js))/g;
  for (const { name, text } of sources) {
    for (const re of [attr, dyn]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const ref = m[1];
        if (/^(https?:)?\/\//.test(ref) || ref.startsWith("data:")) continue;
        if (!fs.existsSync(path.join(root, ref.replace(/^\.?\//, "")))) missing.push(`${name} -> ${ref}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

// Un ZIP con una copia antigua del proyecto no debe volver a versionarse.
test("no se versionan copias empaquetadas del proyecto", () => {
  const ignore = read(".gitignore");
  assert.match(ignore, /MIRAtuterritorio-preview-/);
  const tracked = fs.readdirSync(root).filter((n) => /^MIRAtuterritorio-preview-/.test(n));
  assert.deepEqual(tracked, []);
});
