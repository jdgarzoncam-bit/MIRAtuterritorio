const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const quick = fs.readFileSync(path.join(root, "mira-quick-modules.js"), "utf8");
const portal = fs.readFileSync(path.join(root, "activity-portal.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("central menu validates the PIN through the existing Neon RPC", () => {
  assert.match(quick, /MIRA_DATA\.verifyParticipantAccessPin\(verifier\)/);
  assert.match(quick, /PBKDF2/);
  assert.match(quick, /PIN_ITERATIONS\s*=\s*310000/);
  assert.doesNotMatch(quick, /7979502678/);
});

test("el PIN del portal de actividades se oculta realmente cuando existe autorización central", () => {
  const activityHtml = fs.readFileSync(path.join(root, "actividad.html"), "utf8");
  assert.match(activityHtml, /\.activity-pin-gate\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
  assert.match(portal, /sessionStorage\.getItem\(MODULE_ACCESS_TOKEN_KEY\)/);
  assert.match(portal, /\$\("pubGate"\)\.hidden\s*=\s*true/);
});

test("authorization is scoped to the browser tab and can be manually revoked", () => {
  assert.match(quick, /sessionStorage\.setItem\(TOKEN_KEY/);
  assert.match(quick, /sessionStorage\.removeItem\(TOKEN_KEY\)/);
  assert.match(quick, /miraQuickModulesLockBtn/);
  assert.match(quick, /mira:signed-out/);
});

test("Testigos remains blocked while participant registration uses central authorization", () => {
  assert.match(quick, /testigos\.disabled\s*=\s*true/);
  assert.match(html, /id="miraQuickTestigosBtn"[^>]*disabled/);
  assert.match(html, /id="miraQuickRegisterParticipantBtn"/);
  assert.match(portal, /sessionStorage\.getItem\(MODULE_ACCESS_TOKEN_KEY\)/);
  assert.match(portal, /sessionStorage\.removeItem\(MODULE_ACCESS_TOKEN_KEY\)/);
});
