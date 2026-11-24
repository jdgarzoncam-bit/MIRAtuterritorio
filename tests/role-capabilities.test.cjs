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
const block5Migration = fs.readFileSync(path.join(__dirname, "..", "migrations", "20261118_block5_export_quality.sql"), "utf8");
const leastPrivilegeMigration = fs.readFileSync(path.join(__dirname, "..", "migrations", "20261111_security_least_privilege_qa.sql"), "utf8");
const commonMapApprovalMigration = fs.readFileSync(path.join(__dirname, "..", "migrations", "20261117_common_map_account_approval.sql"), "utf8");
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

test("el menú rápido conserva Testigos bloqueado y centraliza el PIN de Registrar participante", () => {
  const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const quickSource = fs.readFileSync(path.join(__dirname, "..", "mira-quick-modules.js"), "utf8");
  assert.ok(appSource.includes("landingVisible=Boolean(landing&&getComputedStyle(landing).display!=='none')"));
  assert.ok(appSource.includes("root.classList.toggle('hidden',!landingVisible)"));
  assert.match(indexSource, /id="miraQuickTestigosBtn"[^>]*disabled/);
  assert.match(indexSource, /id="miraQuickRegisterParticipantBtn"/);
  assert.match(quickSource, /MIRA_DATA\.verifyParticipantAccessPin\(verifier\)/);
  assert.match(quickSource, /miraQuickModulesLockBtn/);
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

test("el mapa común no se administra mediante permisos privados de módulo", () => {
  assert.doesNotMatch(adminSource, /centro_operaciones:\[\[/);
  assert.match(adminSource, /includes\(m\.module_key\)\&\&m\.active!==false/);
  assert.match(adminSource, /Mapa común:[\s\S]*toda cuenta activa y con correo verificado/);
});

test("la aprobación de una cuenta verificada no exige permisos de módulos privados", () => {
  const approval = adminSource.slice(adminSource.indexOf("function renderApprovalControls"), adminSource.indexOf("function renderMatrix"));
  assert.match(approval, /const canApprove=user\.email_verified===true/);
  assert.doesNotMatch(approval, /canApprove=user\.email_verified===true&&hasModuleAccess/);
  assert.doesNotMatch(approval, /if\(activate&&!hasModuleAccess\)/);
  assert.match(adminSource, /Aprobado · acceso común al mapa/);
});

test("Base de datos general solo ofrece permisos con operación real", () => {
  assert.match(adminSource, /base_datos_general:\[\["view","Consultar bases autorizadas"\],\["export","Exportar información"\]\]/);
  assert.doesNotMatch(adminSource, /base_datos_general:\[\[[^\]]*create/);
  assert.doesNotMatch(adminSource, /base_datos_general:\[\[[^\]]*manage/);
});

test("la migración permite activar cuentas verificadas sin permiso privado y elimina el bloqueo del último view", () => {
  const start = commonMapApprovalMigration.indexOf("CREATE OR REPLACE FUNCTION mira.enforce_profile_activation_requirements()");
  const end = commonMapApprovalMigration.indexOf("$function$;", start);
  const activationFunction = commonMapApprovalMigration.slice(start, end);
  assert.ok(start >= 0);
  assert.match(activationFunction, /NEW\.email_verified IS DISTINCT FROM true/);
  assert.doesNotMatch(activationFunction, /module_permissions|module_catalog|action_key/);
  assert.match(commonMapApprovalMigration, /DROP TRIGGER IF EXISTS guard_last_active_module_view_permission/);
  assert.match(commonMapApprovalMigration, /BEGIN;[\s\S]*COMMIT;/);
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

test("el portal independiente de Actividades usa el wrapper oficial de Neon Auth y la autorización PIN", () => {
  assert.match(activityPortalSource, /createInternalNeonAuth\(PUBLIC_AUTH_URL/);
  assert.match(activityPortalSource, /publicNeonAuth\.getJWTToken\(\)/);
  assert.match(activityPortalSource, /MIRA_DATA\.verifyParticipantAccessPin\(verifier\)/);
  assert.doesNotMatch(activityPortalSource, /createAuthClient|auth\.token\(\)|"witness"/);
});

test("la interfaz interna de Actividades respeta los límites efectivos de cada rol y el portal público exige token PIN", () => {
  assert.match(appSource, /function effectiveActivityPermissions\(rows\)/);
  assert.match(appSource, /role==="operator"[\s\S]*?\["view","create","edit","export","annul"\]/);
  assert.match(appSource, /role==="viewer"\?\["view"\]/);
  assert.match(activityPortalSource, /if \(!accessToken\) return lockModule/);
  assert.match(activityPortalSource, /lookupPublicPerson\(cedula,accessToken\)/);
});

test("la bandeja de reportes solo habilita edición para Operador o administrador principal", () => {
  assert.match(reportesSource, /canEdit=window\.MIRA_CURRENT_USER\.role==="operator"&&p\.some/);
});

test("las funciones exclusivas de triggers no conservan EXECUTE para clientes API", () => {
  for (const fn of ["audit_actividad_changes","audit_asistencia_changes","audit_persona_changes","audit_row_change","set_updated_at","audit_admin_changes","sync_auth_user_profile"]) {
    assert.match(leastPrivilegeMigration, new RegExp("revoke execute on function mira\\."+fn+"\\(\\) from public, anonymous, authenticated", "i"), fn);
  }
});


test("Personas exige confirmación de una fila en altas y ediciones", () => {
  assert.match(dataSource, /createPerson\(payload\)[\s\S]*requireRows:true/);
  assert.match(dataSource, /updatePerson\(id,payload\)[\s\S]*requireRows:true/);
  assert.match(dataSource, /No se identificó la persona que deseas actualizar/);
});

test("la migración de Personas normaliza cédula en PostgreSQL y garantiza consistencia y unicidad", () => {
  const migration = fs.readFileSync(path.join(__dirname, "..", "migrations", "20261118_personas_cedula_integrity.sql"), "utf8");
  assert.match(migration, /CREATE OR REPLACE FUNCTION mira\.normalize_person_cedula/);
  assert.match(migration, /regexp_replace\(coalesce\(NEW\.cedula, ''\), '\[\^0-9\]', '', 'g'\)/);
  assert.match(migration, /BEFORE INSERT OR UPDATE ON mira\.personas/);
  assert.match(migration, /ALTER COLUMN cedula_normalizada SET NOT NULL/);
  assert.match(migration, /personas_cedula_normalizada_consistente/);
  assert.match(migration, /VALIDATE CONSTRAINT/);
  assert.match(migration, /personas_cedula_unica/);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION mira\.normalize_person_cedula\(\) FROM PUBLIC, anonymous, authenticated/);
});


test("Bloque 2: fichas pendientes se consultan y paginan desde Neon",()=>{assert.match(dataSource,/async listPendingPeople\(\{limit=25,offset=0\}/);assert.match(dataSource,/datos_pendientes\.eq\.true/);assert.match(dataSource,/telefono\.is\.null/);assert.match(dataSource,/barrio\.is\.null/);assert.match(appSource,/listPendingPeople\(\{limit:26,offset:page\*25\}\)/);assert.doesNotMatch(appSource,/listPeople\(\{limit:1000\}\)[\s\S]{0,250}rows\.filter\(p=>p\.datos_pendientes/);assert.match(appSource,/databasePendingNext/);});
test("Bloque 2: explorador Personas busca por cédula original y normalizada",()=>{assert.match(dataSource,/cedula_normalizada.*nombres.*apellidos/);assert.match(dataSource,/const documentDigits=dataset\.key==="personas"\?cleanCedula\(search\):""[\s\S]*cedula_normalizada\.eq\./);});
test("Bloque 2: explorador controla carga, error, vacío y evita respuestas fuera de orden",()=>{assert.match(appSource,/let page=0,more=false,lastRows=\[\],dataset=datasets\[0\],requestVersion=0/);assert.match(appSource,/No se encontraron registros para los filtros seleccionados/);assert.match(appSource,/No fue posible consultar los registros/);assert.match(appSource,/if\(version!==requestVersion\)return/);});


test("Bloque 4: el historial maneja errores de consulta y respuestas fuera de orden", () => {
  assert.match(appSource, /No fue posible cargar el historial/);
  assert.match(appSource, /Neon devolvió una respuesta de auditoría inválida/);
  assert.match(appSource, /let offset=0,hasMore=false,requestVersion=0/);
  assert.match(appSource, /if\(version!==requestVersion\)return/);
});

test("Bloque 4: auditoría central aplica RLS de lectura por módulo y no concede escritura API", () => {
  assert.match(auditMigration, /CREATE POLICY audit_events_read_authorized[\s\S]*mira\.has_module_permission\('base_datos_general','view'\)[\s\S]*mira\.has_module_permission\(module_key,'view'\)/);
  assert.match(auditMigration, /STABLE SECURITY INVOKER/);
  assert.match(auditMigration, /REVOKE ALL ON mira\.audit_events FROM PUBLIC, anonymous/);
  assert.match(auditMigration, /CREATE TRIGGER central_audit_module_permissions[\s\S]*ON mira\.module_permissions/);
  assert.match(auditMigration, /CREATE TRIGGER central_audit_user_profiles[\s\S]*ON mira\.user_profiles/);
});


test("Bloque 5: la exportación informa truncamiento y conserva el estado Activas/Archivadas/Todas", () => {
  assert.match(dataSource, /p_person_status:datasetKey==="personas"\?\(personStatus==="inactive"\?"archived":personStatus\):"all"/);
  assert.match(appSource, /personStatus:dataset\.key==="personas"\?personStatus\.value:"all"/);
  assert.match(appSource, /if\(result\.truncated\)[\s\S]*No se generó un archivo parcial/);
  assert.match(block5Migration, /'total_count',v_total_count,'truncated',v_total_count>v_count/);
  assert.match(block5Migration, /ORDER BY %I DESC,id DESC/);
  assert.match(block5Migration, /cedula_normalizada=/);
});

test("Bloque 5: el diagnóstico de calidad es agregado, de solo lectura y protegido por permisos", () => {
  assert.match(dataSource, /getDataQualitySummary\(\)[\s\S]*rpc\/get_data_quality_summary/);
  assert.match(appSource, /Revisar calidad de datos/);
  assert.match(appSource, /Este diagnóstico es de solo lectura/);
  assert.match(block5Migration, /CREATE OR REPLACE FUNCTION mira\.get_data_quality_summary\(\)/);
  assert.match(block5Migration, /LANGUAGE plpgsql[\s\S]*STABLE[\s\S]*SECURITY INVOKER/);
  assert.match(block5Migration, /REVOKE ALL ON FUNCTION mira\.get_data_quality_summary\(\) FROM PUBLIC,anonymous/);
});


test("Bloque 6: el panel de calidad tiene región accesible y estados anunciables", () => {
  assert.match(appSource, /id="databaseQualityReport"[^>]*role="region"/);
  assert.match(appSource, /aria-live="polite"/);
  assert.match(appSource, /aria-label="Diagnóstico de calidad de datos"/);
});

test("Bloque 6: Base de datos general tiene ajustes responsivos y foco visible", () => {
  assert.match(styleSource, /Bloque 6 · cierre visual accesible y adaptable de Base de datos general/);
  assert.match(styleSource, /@media\(max-width:560px\)[\s\S]*database-workspace \.activity-toolbar/);
  assert.match(styleSource, /database-workspace button:focus-visible/);
  assert.match(styleSource, /database-workspace #databaseQualityReport \.activity-table\{width:100%;min-width:100%/);
});


test("InfoMIRA: consulta normaliza documentos, limita la consulta y pagina con orden estable",()=>{
  assert.match(dataSource,/async listInfoMiraDirectory\(\{cedula="",search="",limit=100,offset=0\}/);
  assert.match(dataSource,/const documentDigits=isDocumentSearch\?cleanCedula\(cedula\|\|term\):""/);
  assert.match(dataSource,/order:"fila_origen.asc,id.asc"/);
  assert.match(dataSource,/Math\.min\(Math\.max\(Number\(limit\)\|\|100,1\),100\)/);
  assert.match(dataSource,/params\.cedula_original = `eq\.\$\{documentDigits\}`/);
  assert.match(dataSource,/cedula_normalizada,nombres,apellidos/);
});
test("InfoMIRA: el buscador recorre páginas y evita pintar respuestas obsoletas",()=>{
  assert.match(appSource,/loadAllInfoMiraPages = async/);
  assert.match(appSource,/offset\+=pageSize/);
  assert.match(appSource,/requestId!==searchRequest \|\| inputCuidador\.value\.trim\(\)!==query/);
  assert.match(appSource,/if\(requestId!==searchRequest\) return/);
  assert.match(appSource,/searchRequest\+\+/);
});
test("InfoMIRA: las fichas y exportación escapan texto y el mapa usa puestos existentes",()=>{
  const info=appSource.slice(appSource.indexOf("function inicializarModuloInfoMIRA"),appSource.indexOf("function obtenerUltimaActividadPorBarrio"));
  assert.match(info,/escInfo\(name\)/);
  assert.match(info,/mostrarValor\(value\)/);
  assert.match(info,/listaPuestosVotacion\.forEach/);
  assert.match(info,/miraMarkersGroup\.clearLayers\(\)/);
  assert.match(info,/if \(map\.hasLayer\(puestosLayerGroup\)\) puestosLayerGroup\.remove\(\)/);
  assert.match(info,/XLSX\.utils\.json_to_sheet\(exportRows\)/);
});

test("InfoMIRA: el filtro Activo no incluye registros Inactivos por coincidencia parcial",()=>{
  assert.match(appSource,/person\?\.activo !== false && role === 'ACTIVO'/);
  assert.match(appSource,/role\.includes\('LIDER'\) \|\| role\.includes\('CUIDADOR'\)/);
  assert.match(appSource,/role\.includes\('REFERIDO'\)/);
  assert.doesNotMatch(appSource,/role\.includes\('ACTIVO'\)/);
});

test("InfoMIRA: los nombres de puestos se normalizan para tolerar tildes, signos y espacios",()=>{
  const info=appSource.slice(appSource.indexOf("function inicializarModuloInfoMIRA"),appSource.indexOf("function obtenerUltimaActividadPorBarrio"));
  assert.match(info,/normalizarPuestoInfoMira = value => String\(value \|\| ''\)\.normalize\('NFD'\)/);
  assert.match(info,/replace\(\/\[\^A-Z0-9\]\+\/g,' '\)/);
  assert.match(info,/agrupados\.get\(normalizarPuestoInfoMira\(puesto\.matchName\)\)/);
});


test("InfoMIRA is consultation-only in the administrative matrix and client", () => {
  assert.match(adminSource, /infomira:\[\["view","Consulta"\]\]/);
  assert.doesNotMatch(adminSource, /infomira:\[[^\n]*"(create|edit|delete)"/);
  assert.match(dataSource, /params\.inactivo="eq\."/);
});

test("Personas keeps activo and inactivo synchronized in client actions", () => {
  assert.match(dataSource, /updatePerson\(id,\{activo:false,inactivo:true\}\)/);
  assert.match(dataSource, /updatePerson\(id,\{activo:true,inactivo:false\}\)/);
  assert.match(dataSource, /personStatus==="inactive"\?"true":"false"/);
});

test("the Logistics module and its routing integration are absent from the QA interface", () => {
  const mobileSource = fs.readFileSync(path.join(__dirname, "..", "mobile-operations.js"), "utf8");
  const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.doesNotMatch(appSource, /inicializarModuloLogistica|logisticaRouteLayer|obtenerDirectorioLogistica/);
  assert.doesNotMatch(mobileSource, /dropdown-logistica/);
  assert.doesNotMatch(indexSource, /infomiraMobilityFilters|logisticaBtn|logisticaSelect/);
  assert.doesNotMatch(indexSource, /concejalPersonTransport|Requiere transporte/);
  assert.doesNotMatch(appSource, /requiere_transporte|row\\.movilidad/);
  assert.doesNotMatch(dataSource, /requiere_transporte|movilidad,"Movilidad"/);
});


test("the landing routes participant registration through the central PIN-protected modules menu", () => {
  const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const activityPage = fs.readFileSync(path.join(__dirname, "..", "actividad.html"), "utf8");
  const signupPage = fs.readFileSync(path.join(__dirname, "..", "registro-usuario.html"), "utf8");
  assert.doesNotMatch(indexSource, /id="btnSelectActividadesPublic"/);
  assert.match(indexSource, /id="miraQuickRegisterParticipantBtn"/);
  assert.match(indexSource, /id="miraModulePinGate"/);
  assert.match(activityPage, /id="pubPin"/);
  assert.match(signupPage, /id="signupForm"/);
});
