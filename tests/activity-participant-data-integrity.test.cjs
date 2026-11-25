const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("Actividades pagina de acuerdo con el límite real de Neon Data API", () => {
  const app = read("app.js");
  assert.match(app, /const pageSize=100,all=\[\]/);
  assert.match(app, /page\.length<pageSize/);
  assert.match(app, /loadAllPages\(\(\{limit,offset\}\)=>window\.MIRA_DATA\.listAttendances/);
});

test("las fichas personales se recuperan por IDs y en lotes máximos de 100", () => {
  const app = read("app.js");
  const data = read("mira-data.js");
  assert.match(app, /listPeopleByIds\(personIds\)/);
  assert.match(data, /async listPeopleByIds\(ids=\[\]\)/);
  assert.match(data, /const pageSize=100/);
  assert.match(data, /id:"in\.\("\+batch\.join\(","\)\+"\)"/);
});

test("la tabla y el Excel incluyen todos los campos de inscripción sin convertir faltantes en No", () => {
  const app = read("app.js");
  const index = read("index.html");
  assert.match(index, /<th>Tiene la App InfoMIRA<\/th><th>Tipo de participante<\/th>/);
  assert.match(app, /p\.hasApp==="no"\?"No":"—"/);
  assert.match(app, /p\.hasApp==='no'\?'No':''/);
  assert.match(app, /'Tipo de participante':p\.type==='interno'\?'Interno':p\.type==='externo'\?'Externo':''/);
  assert.match(app, /Ficha no recuperada/);
  assert.match(app, /No se recuperaron '\+missingPeopleCount/);
});

test("Renombrar permanece disponible y persiste el nombre en Neon", () => {
  const app = read("app.js");
  assert.match(app, /data-activity-rename/);
  assert.match(app, /updateActivity\(item\.id,\{nombre:cleanName/);
  assert.match(app, /Nombre de la actividad actualizado correctamente/);
  assert.match(read("mira-data.js"), /updateActivity\(id,payload\)/);
});

test("el portal no tiene errores de inicialización y bloquea fichas inactivas", () => {
  const portal = read("activity-portal.js");
  assert.equal((portal.match(/^let currentPersonBlocked = false;$/gm) || []).length, 1);
  assert.doesNotMatch(portal, /^currentPersonBlocked = false;$/m);
  assert.match(portal, /person\.inactivo \|\| person\.activo === false/);
  assert.match(portal, /if \(currentPersonBlocked\) return status/);
  assert.match(portal, /currentPersonAlreadyRegistered/);
});

test("el menú y el portal comparten la misma instancia versionada de MIRA_DATA", () => {
  const index = read("index.html");
  const quick = read("mira-quick-modules.js");
  const portal = read("activity-portal.js");
  const expected = "mira-data.js?v=20261125-activity-join-fix-1";
  assert.ok(index.includes(expected));
  assert.ok(quick.includes(expected));
  assert.ok(portal.includes(expected));
});

test("el alta usa el RPC protegido por token central y la migración retira el overload inseguro", () => {
  const data = read("mira-data.js");
  const sql = read("migrations/20261125_fix_public_participant_registration_integrity.sql");
  assert.match(data, /rpc\/public_register_activity_participant_v2/);
  assert.match(data, /p_access_token:access_token/);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION mira\.public_register_activity_participant_v2\(text,text,text,text,uuid,boolean,text,boolean\)/);
  assert.match(sql, /v_person_active IS FALSE OR v_person_inactive IS TRUE/);
  assert.match(sql, /nombres = trim\(p_nombres\)/);
  assert.match(sql, /apellidos = trim\(p_apellidos\)/);
  assert.match(sql, /tiene_app_infomira = v_tiene_app_infomira/);
});