const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");

test("mobile entry stays on the public landing until Neon Auth confirms a user", () => {
  const mobile = read("mobile-operations.js");
  assert.match(mobile, /if\(!window\.MIRA_CURRENT_USER\|\|!document\.body\.classList\.contains\('pmu-neomorphic'\)\)\{restorePublicLanding\(\);return;\}/);
  assert.match(mobile, /window\.addEventListener\('mira:authenticated',[\s\S]*showOperationsHome/);
  assert.match(mobile, /window\.addEventListener\('mira:signed-out',restorePublicLanding\)/);
});

test("exiting the mobile PMU returns to the public landing and signs out through the existing control", () => {
  const mobile = read("mobile-operations.js");
  assert.match(mobile, /platformHomeBtn'\)\?\.click\(\)/);
  assert.match(mobile, /landing-hero-overlay/);
  assert.match(mobile, /landingHeaderControls/);
});

test("mobile PIN authorization and module choices use a full-screen vertical layout", () => {
  const quick = read("mira-quick-modules.js");
  const css = read("style.css");
  assert.match(quick, /is-mobile-open/);
  assert.match(quick, /showPinGate\(\)/);
  assert.match(css, /#miraQuickModules\.is-mobile-open/);
  assert.match(css, /\.mira-quick-item\{/);
  assert.match(css, /\.mira-quick-panel\.hidden\{display:none!important\}/);
});

test("InfoMIRA mobile search panel is above a compact map and preserves the map layer", () => {
  const css = read("style.css");
  const mobile = read("mobile-operations.js");
  assert.match(mobile, /title:'InfoMIRA'.*mapPanel:true/);
  assert.match(css, /mobile-operations-map-panel-active #map\{[\s\S]*bottom:0!important/);
  assert.match(css, /mobile-operations-map-panel-active #mainSidebar\{[\s\S]*bottom:27dvh!important/);
});

test("people records include enrollment and app ownership as independent nullable booleans", () => {
  const data = read("mira-data.js");
  const app = read("app.js");
  assert.match(data, /info_mira,tiene_app_infomira/);
  assert.match(data, /\[\"info_mira\",\"Inscrito a InfoMIRA\"\]/);
  assert.match(data, /\[\"tiene_app_infomira\",\"Tiene la App InfoMIRA\"\]/);
  assert.match(app, /\[\"info_mira\",\"Inscrito a InfoMIRA\",\"boolean\",false\]/);
  assert.match(app, /\[\"tiene_app_infomira\",\"Tiene la App InfoMIRA\",\"boolean\",false\]/);
  assert.match(app, /tiene_app_infomira/);
});

test("Concejal mini-map uses the same Esri satellite imagery as the territorial map", () => {
  const app = read("app.js");
  assert.match(app, /World_Imagery\/MapServer\/tile/);
  assert.doesNotMatch(app, /World_Street_Map\/MapServer\/tile/);
});
