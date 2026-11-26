const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const portal = fs.readFileSync("activity-portal.js", "utf8");
const migration = fs.readFileSync("migrations/20261126_inactive_people_not_infomira.sql", "utf8");

test("una ficha inactiva no queda bloqueada por su estado histórico", () => {
  assert.doesNotMatch(portal, /currentPersonBlocked|No se puede registrar asistencia hasta|requiere revisión administrativa/);
  assert.match(portal, /const inactiveWithoutInfoMira = person\.inactivo \|\| person\.activo === false/);
  assert.match(portal, /No está inscrita a InfoMIRA; puede registrarse en esta actividad/);
});

test("una ficha inactiva se muestra como no inscrita a InfoMIRA", () => {
  assert.match(portal, /pubInfoMira.*?person\.inactivo \|\| person\.activo === false\) \? "no"/s);
  assert.match(portal, /pubStateValue: person\.inactivo \|\| person\.activo === false \? "Sin InfoMIRA"/);
});

test("el backend devuelve InfoMIRA falso y permite el registro de inactivos", () => {
  assert.match(migration, /v_info_mira := false/);
  assert.match(migration, /CASE WHEN p\.inactivo OR NOT p\.activo THEN false ELSE p\.info_mira END/);
  assert.match(migration, /SET info_mira=false/);
  assert.doesNotMatch(migration, /\bactivo\s*=\s*true|\binactivo\s*=\s*false/);
});

test("el estado histórico de la persona no se borra ni se transforma", () => {
  assert.match(migration, /Keep activo\/inactivo, attendance history and all other person fields unchanged/);
  assert.match(migration, /WHERE \(inactivo=true OR activo=false\)/);
});
