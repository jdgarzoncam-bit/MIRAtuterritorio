const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("Control Administrativo usa una versión de caché nueva", () => {
  assert.match(html, /mira-admin\.js\?v=20261127-control-admin-refresh-1/);
  assert.doesNotMatch(html, /mira-admin\.js\?v=20261124-mobile-fixes-2/);
});

test("el panel administrativo mantiene cargados los servicios de datos y autenticación", () => {
  assert.match(html, /mira-data\.js\?/);
  assert.match(html, /mira-auth\.js\?/);
  assert.match(html, /mira-admin\.js\?/);
});
