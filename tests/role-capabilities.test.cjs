const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const adminSource = fs.readFileSync(path.join(__dirname, "..", "mira-admin.js"), "utf8");
const dataSource = fs.readFileSync(path.join(__dirname, "..", "mira-data.js"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const styleSource = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
const exportMigration = fs.readFileSync(path.join(__dirname, "..", "migrations", "20261111_activities_granular_export_permission.sql"), "utf8");
const auditMigration = fs.readFileSync(path.join(__dirname, "..", "migrations", "20261113_audit_export_remove_operational_reports.sql"), "utf8");
const leastPrivilegeMigration = fs.readFileSync(path.join(__dirname, "..", "migrations", "20261111_security_least_privilege_qa.sql"), "utf8");
const reportesSource = fs.readFileSync(path.join(__dirname, "..", "reportes.js"), "utf8");
const activityPortalSource = fs.readFileSync(path.join(__dirname, "..", "activity-portal.js"), "utf8");
const dataSourceCurrent = dataSource;
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

test("la matriz permite retirar permisos guardados aunque estén inactivos por rol o falta de Consulta", () => {
  assert.match(adminSource, /const roleAllowed=roleAllowsAction\(selectedProfile\?\.role,key\)/);
  assert.match(adminSource, /const canGrant=roleAllowed&&\(key==="view"\|\|hasView\)/);
  assert.match(adminSource, /const canRevoke=checked/);
  assert.match(adminSource, /const disabled=canGrant\|\|canRevoke\?"":"disabled"/);
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

test("los permisos secundarios requieren Consulta antes de concederse y deben retirarse antes de quitar Consulta", () => {
  assert.match(adminSource, /actionKey!=="view"&&nextValue&&!permissionRows\.some/);
  assert.match(adminSource, /actionKey==="view"&&!nextValue/);
  assert.match(adminSource, /const dependent=permissionRows\.filter\(p=>p\.module_key===moduleKey&&p\.action_key!=="view"&&p\.allowed===true\)/);
  assert.match(adminSource, /canRevoke=checked/);
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
  assert.ok(appSource.includes("window.MIRA_DATA.exportDataset("));
  assert.ok(auditMigration.includes("No tienes permiso de exportación en Base de datos general."));
  assert.ok(auditMigration.includes("No tienes permiso de exportación en el módulo de origen"));
  assert.ok(auditMigration.includes("mira.has_module_permission"));
  assert.ok(appSource.includes("window.MIRA_DATA.exportDataset("));
});
test("la incorporación marca datos pendientes si falta teléfono o barrio", () => {
  assert.ok(dataSource.includes("missingFollowup=!String(payload.telefono||\"\").trim()||!String(payload.barrio||\"\").trim()"));
});

test("el menú Módulos se sincroniza al cambiar la portada y se oculta en el PMU", () => {
  assert.ok(appSource.includes("miraMenuVisibilityObserver.observe(miraLandingForMenu"));
  assert.ok(appSource.includes("syncMiraQuickModules()"));
  assert.ok(styleSource.includes("body.pmu-neomorphic #miraQuickModules{display:none!important;}"));
});

test("la exportación exige permisos vigentes en Base de datos general y en el módulo de origen", () => {
  assert.ok(auditMigration.includes("IF NOT mira.has_module_permission('base_datos_general','export')"));
  assert.ok(auditMigration.includes("IF NOT mira.has_module_permission(v_module,'export')"));
  assert.ok(!auditMigration.includes("mira.has_module_permission('base_datos_general','export') OR mira.has_module_permission(v_module,'export')"));
  assert.ok(appSource.includes("await refreshPermissions();"));
  assert.ok(appSource.includes('No tienes permiso para exportar desde Base de datos general.'));
  assert.ok(appSource.includes('No tienes permiso para exportar los datos del módulo '));
  assert.ok(dataSource.includes('cache: "no-store"'));
});
test("la auditoría central registra cambios y exportaciones en PostgreSQL", () => {
  assert.ok(auditMigration.includes("CREATE TABLE IF NOT EXISTS mira.audit_events"));
  assert.ok(auditMigration.includes("CREATE OR REPLACE FUNCTION mira.audit_row_change()"));
  assert.ok(auditMigration.includes("CREATE OR REPLACE FUNCTION mira.export_dataset("));
  assert.ok(auditMigration.includes("CREATE OR REPLACE FUNCTION mira.list_audit_events("));
  assert.ok(dataSource.includes("listAuditEvents"));
  assert.ok(dataSource.includes("exportDataset"));
  assert.ok(appSource.includes("auditModuleFilter"));
  assert.ok(appSource.includes("auditActorFilter"));
  assert.ok(appSource.includes("auditOperationFilter"));
  assert.ok(appSource.includes("window.MIRA_DATA.exportDataset("));
});

test("Reportes Operativos se retira de la plataforma y de Neon", () => {
  assert.ok(auditMigration.includes("DELETE FROM mira.module_catalog WHERE module_key='reportes'"));
  assert.ok(auditMigration.includes("DROP TABLE mira.reportes_operativos"));
  assert.ok(!dataSource.includes('key:"reportes_operativos"'));
  assert.ok(!appSource.includes("reportes_operativos"));
});

test("la sesión abierta revalida perfil y permisos al volver a la ventana", () => {
  const authSource = fs.readFileSync(path.join(__dirname, "..", "mira-auth.js"), "utf8");
  const adminSource = fs.readFileSync(path.join(__dirname, "..", "mira-admin.js"), "utf8");
  assert.ok(authSource.includes("revalidateCurrentAuthorization"));
  assert.ok(authSource.includes("document.addEventListener(\"visibilitychange\""));
  assert.ok(authSource.includes("window.addEventListener(\"focus\""));
  assert.ok(authSource.includes("mira:permissions-refreshed"));
  assert.ok(adminSource.includes("mira:permissions-refreshed"));
});

test("Reportes ciudadanos utiliza el cliente central y no una segunda instancia Neon", () => {
  assert.doesNotMatch(reportesSource, /createAuthClient|ep-round-dawn|auth\.token\(/);
  assert.match(reportesSource, /createCitizenReport/);
  assert.match(reportesSource, /listCitizenReports/);
  assert.match(reportesSource, /updateCitizenReportStatus/);
  assert.match(dataSourceCurrent, /async listCitizenReports/);
  assert.match(dataSourceCurrent, /createCitizenReport\(payload/);
  assert.match(dataSourceCurrent, /updateCitizenReportStatus\(id,status\)/);
});

test("el portal independiente de Actividades obtiene el JWT desde el wrapper oficial de Neon Auth", () => {
  assert.match(activityPortalSource, /createInternalNeonAuth\(AUTH_URL/);
  assert.match(activityPortalSource, /neonAuth\.getJWTToken\(\)/);
  assert.match(activityPortalSource, /profile\.auth_user_id !== PRIMARY_ADMIN_AUTH_ID/);
  assert.doesNotMatch(activityPortalSource, /createAuthClient|auth\.token\(\)|"witness"/);
});

test("la interfaz de Actividades respeta los límites efectivos de cada rol", () => {
  assert.match(appSource, /function effectiveActivityPermissions\(rows\)/);
  assert.match(appSource, /role==="operator"[\s\S]*?\["view","create","edit","export","annul"\]/);
  assert.match(appSource, /role==="viewer"\?\["view"\]/);
  assert.match(activityPortalSource, /profile\.role !== "operator"\) throw new Error/);
});

test("la bandeja de reportes solo habilita edición para Operador o administrador principal", () => {
  assert.match(reportesSource, /canEdit=window\.MIRA_CURRENT_USER\.role==="operator"&&p\.some/);
});

test("las funciones exclusivas de triggers no conservan EXECUTE para clientes API", () => {
  for (const fn of ["audit_actividad_changes","audit_asistencia_changes","audit_persona_changes","audit_row_change","set_updated_at","audit_admin_changes","sync_auth_user_profile"]) {
    assert.match(leastPrivilegeMigration, new RegExp("revoke execute on function mira\\."+fn+"\\(\\) from public, anonymous, authenticated", "i"), fn);
  }
});
