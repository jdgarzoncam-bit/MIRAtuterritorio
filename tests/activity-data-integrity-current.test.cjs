const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");
const app = read("app.js");
const data = read("mira-data.js");
const portal = read("activity-portal.js");
const index = read("index.html");
const joinSql = read("migrations/20261126_activity_attendance_person_join.sql");

test("el archivo de Actividades pagina con límite de 100 y recupera asistencias con su ficha mediante JOIN", () => {
  const loader = app.slice(app.indexOf("async function loadActivitiesFromNeon"), app.indexOf("function normActivityText"));
  assert.match(loader, /const pageSize=100,all=\[\]/);
  assert.match(loader, /for\(let offset=0;offset<100000;offset\+=pageSize\)/);
  assert.match(loader, /listActivityAttendanceDetails\(\{limit,offset\}\)/);
  assert.doesNotMatch(loader, /listAttendances\(\{limit,offset\}\)|listPeople\(\{limit,offset\}\)/);
});

test("el cliente Neon limita cada página del RPC y mantiene el offset", () => {
  const method = data.slice(data.indexOf("async listActivityAttendanceDetails"), data.indexOf("createAttendance", data.indexOf("async listActivityAttendanceDetails")));
  assert.match(method, /rpc\/list_activity_attendance_details/);
  assert.match(method, /Math\.min\(Math\.max\(Number\(limit\)\|\|100,1\),100\)/);
  assert.match(method, /p_offset:Math\.max\(Number\(offset\)\|\|0,0\)/);
});

test("la función SQL une asistencias con personas y actividades y pagina en orden determinista", () => {
  assert.match(joinSql, /LEFT JOIN mira\.personas p ON p\.id=a\.persona_id/);
  assert.match(joinSql, /LEFT JOIN mira\.actividades act ON act\.id=a\.actividad_id/);
  assert.match(joinSql, /ORDER BY a\.fecha_registro DESC,a\.id ASC/);
  assert.match(joinSql, /LIMIT LEAST\(GREATEST\(COALESCE\(p_limit,100\),1\),100\)/);
  assert.match(joinSql, /mira\.has_module_permission\('actividades', 'view'\)/);
});

test("el archivo conserva asistencias aunque falten datos de la ficha y muestra una advertencia", () => {
  assert.match(app, /const joinedMissing=attendanceDetailRows\.filter/);
  assert.match(app, /se conservó el registro para revisión/);
  assert.match(app, /activitiesState\.attendances=attendanceDetailRows\.map/);
  assert.match(app, /personId:row\.person_id\?String\(row\.person_id\):null/);
});

test("los nombres históricos sin apellidos explícitos no se dividen por inferencia", () => {
  const fn = app.slice(app.indexOf("function splitLegacyPersonName"), app.indexOf("function escapeActivityHtml"));
  assert.match(fn, /if\(surnames\) return \{names:full,surnames\}/);
  assert.match(fn, /No inferir apellidos por posición/);
  assert.match(fn, /return \{names:full,surnames:''\}/);
});

test("el Excel se bloquea si falta la ficha y conserva campos de inscripción", () => {
  const fn = app.slice(app.indexOf("function exportActivityExcel"), app.indexOf("document.getElementById('exportSingleActivityBtn')"));
  assert.match(fn, /const missingRows=sourceRows\.filter/);
  assert.match(fn, /No se generó el Excel porque faltan/);
  assert.match(fn, /'Inscrito a InfoMIRA'/);
  assert.match(fn, /'Tiene la App InfoMIRA'/);
  assert.match(fn, /'Tipo de participante'/);
  assert.match(fn, /p\.hasApp==='si'\?'Sí':p\.hasApp==='no'\?'No':''/);
});

test("la tabla y el historial no recortan registros ni ocultan actividades finalizadas", () => {
  assert.match(app, /function activityRows\(activityId=null,query=''\)/);
  assert.doesNotMatch(app, /activityRows\(null,q\),rows=allRows\.slice\(0,10\)/);
  assert.match(app, /const archiveActivities=activitiesState\.activities\.slice\(\)\.sort/);
  assert.doesNotMatch(app, /const archiveActivities=activitiesState\.activities\.slice\(\)\.filter\(a=>a\.status==='active'\)/);
});

test("los clientes publicados en main apuntan a Neon de producción", () => {
  assert.match(data, /https:\/\/ep-round-dawn-b7l3ya3h\.apirest\.c-13\.us-east-1\.aws\.neon\.tech/);
  assert.match(portal, /mira-data\.js\?v=/);
  assert.match(index, /mira-data\.js\?v=/);
  assert.doesNotMatch(data, /ep-mute-grass-b7qan4n6/);
});
