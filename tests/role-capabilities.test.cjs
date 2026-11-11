const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const adminSource = fs.readFileSync(path.join(__dirname, "..", "mira-admin.js"), "utf8");
const dataSource = fs.readFileSync(path.join(__dirname, "..", "mira-data.js"), "utf8");

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
  assert.match(adminSource, /roleAllowed\?"Requiere permiso Consulta":"No permitido por el rol"/);
});

test("la exportación de Actividades se define como permiso granular", () => {
  assert.match(adminSource, /actividades:\[\["view","Consulta"\],\["create","Crear"\],\["edit","Editar"\],\["export","Exportar Excel"\]/);
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
