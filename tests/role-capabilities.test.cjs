const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const adminSource = fs.readFileSync(path.join(__dirname, "..", "mira-admin.js"), "utf8");
const dataSource = fs.readFileSync(path.join(__dirname, "..", "mira-data.js"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const exportMigration = fs.readFileSync(path.join(__dirname, "..", "migrations", "20261111_activities_granular_export_permission.sql"), "utf8");
const atomicMigration = exportMigration;

function loadRolePolicy() {
  const context = vm.createContext({
    window: {},
    document: {
      readyState: "loading",
      addEventListener() {}
    },
    console,
    setTimeout,
    queueMicrotask
  });
  vm.runInContext(adminSource + "\nglobalThis.__roleAllowsAction = roleAllowsAction;", context, {
    filename: "mira-admin.js"
  });
  return context.__roleAllowsAction;
}

test("el menú rápido de Actividades y Testigos se muestra en la portada pública y exige sesión", () => {
  assert.ok(appSource.includes("landingVisible=Boolean(landing&&getComputedStyle(landing).display!=='none')"));
  assert.ok(appSource.includes("root.classList.toggle('hidden',!landingVisible)"));
  assert.ok(appSource.includes("Inicia sesión para acceder"));
  assert.ok(appSource.includes("document.getElementById('landingLoginBtn')?.click()"));
  assert.ok(appSource.includes("miraQuickTestigosBtn"));
});

test("Consulta solo permite view", () => {
  const allows = loadRolePolicy();
  assert.equal(allows("viewer", "view"), true);
  for (const action of ["create", "edit", "delete", "export", "manage"]) {
    assert.equal(allows("viewer", action), false, action);
  }
});

test("Operador permite view, create, edit y export, pero no delete/manage", () => {
  const allows = loadRolePolicy();
  for (const action of ["view", "create", "edit", "export"]) {
    assert.equal(allows("operator", action), true, action);
  }
  for (const action of ["delete", "manage"]) {
    assert.equal(allows("operator", action), false, action);
  }
});

test("Testigo y roles desconocidos no reciben capacidades operativas", () => {
  const allows = loadRolePolicy();
  for (const role of ["witness", "unknown", "admin"]) {
    for (const action of ["view", "create", "edit", "delete"]) {
      assert.equal(allows(role, action), false, role + ":" + action);
    }
  }
});

test("el cliente no permite asignar Testigo desde updateUserProfile", () => {
  assert.match(dataSource, /\["operator","viewer"\]\.includes\(changes\.role\)/);
  assert.doesNotMatch(dataSource, /\["operator","viewer","witness"\]\.includes\(changes\.role\)/);
});

test("Guardar rol usa la actualización de perfil y valida la respuesta de Neon", () => {
  assert.match(adminSource, /data-profile-approval="save-role"/);
  assert.match(adminSource, /window\.MIRA_DATA\.updateUserProfile\(targetId,\{active:nextActive,role\}\)/);
  assert.match(adminSource, /row\.role!==role/);
  assert.match(adminSource, /action==="save-role"\?"Rol guardado/);
});

test("la matriz deshabilita acciones fuera del límite del rol y no borra permisos existentes", () => {
  assert.match(adminSource, /const roleAllowed=roleAllowsAction\(selectedProfile\?\.role,key\)/);
  assert.match(adminSource, /const effective=roleAllowed&&\(key==="view"\|\|hasView\)/);
  assert.match(adminSource, /const disabled=effective\?"":"disabled"/);
  assert.match(adminSource, /Los permisos guardados se conservan/);
});

test("Centro de Operaciones mantiene únicamente Consulta", () => {
  assert.match(adminSource, /centro_operaciones:\[\["view","Consulta"\]\]/);
});

test("el inicio de sesión no acepta el rol Testigo reservado", () => {
  assert.match(fs.readFileSync(path.join(__dirname, "..", "mira-auth.js"), "utf8"),
    /!\["admin","operator","viewer"\]\.includes\(profile\.role\)/);
});

test("Guardar rol exige seleccionar un rol asignable y evita falso éxito con Testigo", () => {
  assert.match(adminSource, /if\(!\["viewer","operator"\]\.includes\(role\)\)/);
  assert.match(adminSource, /El rol Testigo está reservado/);
});

test("la matriz exige permiso Consulta antes de habilitar acciones de escritura", () => {
  assert.match(adminSource, /const hasView=allowed\.has\(m\.module_key\+"::view"\)/);
  assert.match(adminSource, /restrictionLabel=roleAllowed\?"Requiere permiso Consulta":selectedProfile\?\.role==="viewer"\?"Requiere rol Operador":"Reservado al administrador"/);
});

test("la exportación de Actividades se define como permiso granular", () => {
  assert.match(adminSource, /actividades:\[\["view","Consulta"\],\["create","Crear"\],\["edit","Editar"\],(?:\["annul","Anular asistencia"\],)?\["export","Exportar Excel"\]/);
  assert.match(adminSource, /actionKey==="export"&&nextValue/);
  assert.match(adminSource, /actionKey==="view"&&!nextValue/);
});

test("el cliente de datos pagina personas y asistencias", () => {
  assert.match(dataSource, /listPeople\(\{cedula="", search="", limit=100, offset=0/);
  assert.match(dataSource, /listAttendances\(\{activityId,limit=100,offset=0/);
});

test("la exportación está bloqueada sin view y export", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(appSource, /!canManageActivities\("view"\)\|\|!canManageActivities\("export"\)/);
  assert.match(appSource, /const exportAllowed=canManageActivities\("view"\)&&canManageActivities\("export"\)/);
});

test("Neon autoriza exportación solo a operadores con permiso explícito", () => {
  assert.match(exportMigration, /u\.role = 'operator' and p_action_key in \('view','create','edit','export'\)/);
  assert.match(exportMigration, /p_action_key = 'view'/);
});

test("crear actividad utiliza una función transaccional y no finaliza actividades antes del INSERT", () => {
  assert.match(dataSource, /rpc\/create_activity_atomic/);
  assert.match(atomicMigration, /security invoker/);
  assert.match(atomicMigration, /has_module_permission\('actividades','create'\)/);
  assert.match(atomicMigration, /has_module_permission\('actividades','edit'\)/);
  assert.match(atomicMigration, /update mira\.actividades[\s\S]*insert into mira\.actividades/);
  assert.doesNotMatch(appSource, /Promise\.all\(activitiesState\.activities\.filter\(a=>a\.status==='active'\)/);
});

test("el catálogo de actividades también admite paginación", () => {
  assert.match(dataSource, /listActivities\(\{limit=100,offset=0\}/);
  assert.match(appSource, /loadAllPages\(\(\{limit,offset\}\)=>window\.MIRA_DATA\.listActivities/);
});

test("anular asistencia es una capacidad separada y no habilita UPDATE directo por RLS", () => {
  const allows = loadRolePolicy();
  assert.equal(allows("operator", "annul"), true);
  assert.equal(allows("viewer", "annul"), false);
  assert.ok(exportMigration.includes("drop policy if exists asistencias_permission_delete on mira.asistencias"));
  assert.ok(exportMigration.includes("create policy asistencias_permission_edit on mira.asistencias for update to authenticated using (mira.has_module_permission('actividades','edit'))"));
  assert.ok(exportMigration.includes("security definer"));
  assert.ok(exportMigration.includes("has_module_permission('actividades','annul')"));
});
test("la auditoría contempla Actividades y cambios de estado en Asistencias", () => {
  assert.ok(exportMigration.includes("create table if not exists mira.actividades_change_audit"));
  assert.ok(exportMigration.includes("trg_audit_actividad_changes"));
  assert.ok(exportMigration.includes("after insert or update or delete on mira.asistencias"));
  assert.ok(dataSource.includes("listActivitiesAudit"));
  assert.ok(dataSource.includes("listAttendanceAudit"));
});

test("la restricción SQL acepta annul y Base de datos general controla su propia exportación", () => {
  assert.ok(exportMigration.includes("array['view','create','edit','delete','export','manage','annul']"));
  assert.match(adminSource, /pqrs:\[\["view","Consulta"\]\]/);
  assert.ok(appSource.includes('No tienes permiso para exportar estos registros.'));
  assert.ok(appSource.includes('no tienes permiso de Consulta en Base de datos general'));
  assert.ok(appSource.includes('no tienes permiso de Consulta en el módulo de origen'));
});
test("la incorporación marca datos pendientes si falta teléfono o barrio", () => {
  assert.ok(dataSource.includes("missingFollowup=!String(payload.telefono||\"\").trim()||!String(payload.barrio||\"\").trim()"));
});
