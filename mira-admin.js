// MIRA TU TERRITORIO — Control Administrativo: permisos granulares.
const ACTIONS = [
  ["view","Consultar"],["create","Crear"],["edit","Editar"],
  ["delete","Eliminar"],["export","Exportar"],["manage","Administrar"]
];
const $ = (id) => document.getElementById(id);
let users = [], modules = [], selectedProfile = null, permissionRows = [];
let busy = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function notice(message, error=false) {
  const node=$("adminPermissionsNotice");
  if(!node)return;
  node.textContent=message;
  node.classList.remove("hidden","is-error","is-success");
  node.classList.add(error?"is-error":"is-success");
}
function clearNotice(){const n=$("adminPermissionsNotice");if(n){n.textContent="";n.classList.add("hidden");}}
const PRIMARY_ADMIN_AUTH_ID="beef5bf3-82a8-4c35-a12c-17771be59da1";
function isAdmin(){const user=window.MIRA_CURRENT_USER;return user?.role==="admin"&&user?.authUserId===PRIMARY_ADMIN_AUTH_ID;}
function openPanel(){
  if(!isAdmin())return;
  $("adminPermissionsPanel")?.classList.remove("hidden");
  $("adminPermissionsPanel")?.setAttribute("aria-hidden","false");
  document.body.classList.add("admin-permissions-open");
  loadUsers();
}
function closePanel(){
  $("adminPermissionsPanel")?.classList.add("hidden");
  $("adminPermissionsPanel")?.setAttribute("aria-hidden","true");
  document.body.classList.remove("admin-permissions-open");
}
async function loadUsers(){
  if(!isAdmin()||busy)return;
  busy=true;clearNotice();
  $("adminUsersList").innerHTML='<p class="admin-permissions-loading">Consultando perfiles…</p>';
  try{
    const [profileRows,moduleRows]=await Promise.all([window.MIRA_DATA.listUserProfiles(),window.MIRA_DATA.listModuleCatalog()]);
    users=Array.isArray(profileRows)?profileRows:[];
    modules=Array.isArray(moduleRows)?moduleRows:[];
    renderUsers();
    if(selectedProfile){
      const stillThere=users.find(u=>u.id===selectedProfile.id);
      if(stillThere){selectedProfile=stillThere;await selectUser(stillThere.id,false);}
      else {selectedProfile=null;$("adminPermissionsMatrix").innerHTML='<p class="admin-permissions-empty">Selecciona un usuario.</p>';}
    }
  }catch(error){
    $("adminUsersList").innerHTML='<p class="admin-permissions-error">'+escapeHtml(error.message||"No fue posible consultar los usuarios.")+'</p>';
  }finally{busy=false;}
}
function renderUsers(){
  if(!users.length){$("adminUsersList").innerHTML='<p class="admin-permissions-empty">No hay perfiles de usuario vinculados todavía.</p>';return;}
  $("adminUsersList").innerHTML=users.map(u=>{
    const selected=selectedProfile?.id===u.id;
    const label=u.display_name||u.email||"Usuario";
    return '<button type="button" class="admin-user-row '+(selected?"is-selected":"")+'" data-profile-id="'+escapeHtml(u.id)+'" '+(u.role==="admin"?'data-is-admin="true"':'')+'>'+
      '<span class="admin-user-avatar">'+escapeHtml((label.trim()[0]||"U").toUpperCase())+'</span>'+
      '<span class="admin-user-copy"><strong>'+escapeHtml(label)+'</strong><small>'+escapeHtml(u.email||"Sin correo")+'</small><em>'+(u.role==="admin"?"Administradora":u.role==="operator"?"Operador":u.role==="viewer"?"Consulta":u.role==="witness"?"Testigo":escapeHtml(u.role||"Sin rol"))+' · '+(u.email_verified?(u.active?"Activo":"Pendiente de aprobación"):"Correo sin confirmar")+'</em></span>'+
      (u.role==="admin"?'<span class="admin-user-lock" title="Cuenta protegida">🔒</span>':'<span class="admin-user-arrow">›</span>')+'</button>';
  }).join("");
}
async function selectUser(profileId,show=true){
  const user=users.find(u=>u.id===profileId);
  if(!user)return;
  selectedProfile=user;clearNotice();renderUsers();
  $("adminSelectedUser").innerHTML='<strong>'+escapeHtml(user.display_name||user.email||"Usuario")+'</strong><span>'+escapeHtml(user.email||"")+' · '+(user.email_verified?"Correo confirmado":"Correo sin confirmar")+' · '+(user.active?"Cuenta activa":"Pendiente de aprobación")+'</span>';
  if(user.role==="admin"){
    $("adminPermissionsMatrix").innerHTML='<div class="admin-permissions-protected"><strong>🔒 Cuenta administradora protegida</strong><p>Esta cuenta conserva todos los permisos y no puede modificarse desde este panel.</p></div>';
    return;
  }
  $("adminPermissionsMatrix").innerHTML='<p class="admin-permissions-loading">Cargando permisos…</p>';
  try{
    permissionRows=await window.MIRA_DATA.listModulePermissions(user.id);
    renderMatrix();
  }catch(error){
    $("adminPermissionsMatrix").innerHTML='<p class="admin-permissions-error">'+escapeHtml(error.message||"No fue posible cargar los permisos.")+'</p>';
  }
}
function renderApprovalControls(user){
  const roles=[["viewer","Consulta"],["operator","Operador"],["witness","Testigo"]];
  const options=roles.map(([value,label])=>'<option value="'+value+'" '+(user.role===value?"selected":"")+'>'+label+'</option>').join("");
  const canApprove=user.email_verified===true;
  const action=user.active?"suspend":"activate";
  const label=user.active?"Desaprobar cuenta":"Aprobar cuenta";
  const hint=canApprove?(user.active?"La cuenta está aprobada. Puedes desaprobarla para retirar su acceso.":"El correo está confirmado. Puedes aprobar la cuenta y asignar un rol."):"La persona debe confirmar su correo antes de que puedas activar la cuenta.";
  return '<section class="admin-approval-card"><div><strong>Estado y aprobación</strong><small>'+hint+'</small></div><label class="admin-role-picker"><span>Rol de la cuenta</span><select id="adminRoleSelect">'+options+'</select></label><button type="button" class="admin-approval-button" data-profile-approval="'+action+'" '+(!canApprove&&!user.active?"disabled":"")+'>'+label+'</button><button type="button" class="admin-approval-button admin-role-save" data-profile-approval="save-role">Guardar rol</button></section><div class="admin-approval-divider"></div>';
}
async function changeUserApproval(button){
  if(!isAdmin()||!selectedProfile||selectedProfile.role==="admin")return;
  const action=button.dataset.profileApproval;
  const activate=action==="activate";
  if(activate&&!selectedProfile.email_verified){notice("No puedes activar una cuenta cuyo correo no está confirmado.",true);return;}
  const nextActive=action==="save-role"?selectedProfile.active:activate;
  const role=$("adminRoleSelect")?.value||selectedProfile.role;
  button.disabled=true;
  try{
    const updated=await window.MIRA_DATA.updateUserProfile(selectedProfile.id,{active:nextActive,role});
    const row=Array.isArray(updated)?updated[0]:updated;
    selectedProfile={...selectedProfile,...(row||{}),active:nextActive,role};
    users=users.map(u=>u.id===selectedProfile.id?selectedProfile:u);
    renderUsers();
    $("adminSelectedUser").innerHTML='<strong>'+escapeHtml(selectedProfile.display_name||selectedProfile.email||"Usuario")+'</strong><span>'+escapeHtml(selectedProfile.email||"")+' · '+(selectedProfile.email_verified?"Correo confirmado":"Correo sin confirmar")+' · '+(selectedProfile.active?"Cuenta activa":"Pendiente de aprobación")+'</span>';
    renderMatrix();
    notice(action==="save-role"?"Rol actualizado. Los permisos de los módulos se conservan.":activate?"Cuenta aprobada y activada. Ahora asigna los permisos de cada módulo.":"Cuenta desaprobada. Sus permisos se conservan, pero el acceso queda bloqueado.");
  }catch(error){notice(error.message||"No fue posible actualizar el estado de la cuenta.",true);}
  finally{button.disabled=false;}
}
function renderMatrix(){
  const allowed=new Set(permissionRows.filter(p=>p.allowed).map(p=>p.module_key+"::"+p.action_key));
  const visibleModules=modules.filter(m=>m.module_key!=="control_administrativo");
  const approval = selectedProfile && selectedProfile.role!=="admin" ? renderApprovalControls(selectedProfile) : "";
  $("adminPermissionsMatrix").innerHTML=approval+visibleModules.map(m=>{
    return '<article class="admin-module-permission"><div class="admin-module-permission-title"><strong>'+escapeHtml(m.module_name)+'</strong><small>'+escapeHtml(m.description||"Permisos del módulo")+'</small></div><div class="admin-action-checks">'+ACTIONS.map(([key,label])=>{
      const checked=allowed.has(m.module_key+"::"+key);
      return '<label class="admin-action-check"><input type="checkbox" data-module="'+escapeHtml(m.module_key)+'" data-action="'+key+'" '+(checked?"checked":"")+'><span>'+label+'</span></label>';
    }).join("")+'</div></article>';
  }).join("")||'<p class="admin-permissions-empty">No hay módulos configurados.</p>';
}
async function changePermission(input){
  if(!isAdmin()||!selectedProfile||selectedProfile.role==="admin")return;
  const moduleKey=input.dataset.module,actionKey=input.dataset.action;
  input.disabled=true;
  try{
    await window.MIRA_DATA.setModulePermission(selectedProfile.id,moduleKey,actionKey,input.checked);
    const existing=permissionRows.find(p=>p.module_key===moduleKey&&p.action_key===actionKey);
    if(existing)existing.allowed=input.checked;
    else permissionRows.push({user_profile_id:selectedProfile.id,module_key:moduleKey,action_key:actionKey,allowed:input.checked});
    notice("Permiso actualizado: "+(input.checked?"habilitado":"retirado")+".");
  }catch(error){
    input.checked=!input.checked;
    notice(error.message||"No fue posible guardar el permiso.",true);
  }finally{input.disabled=false;}
}
const MODULE_TARGETS = {
  infomira:["dropdown-infomira"],
  logistica:["dropdown-logistica"],
  testigos:["dropdown-testigos"],
  centro_operaciones:["dropdown-puestos","dropdown-barrios-puestos"],
  actividades:["dropdown-actividades"],
  concejal:["dropdown-concejal"]
};
async function applyModuleAccess(){
  const current=window.MIRA_CURRENT_USER;
  if(!current)return;
  const allTargets=Object.values(MODULE_TARGETS).flat();
  if(current.role==="admin"){
    allTargets.forEach(id=>$(id)?.classList.remove("hidden"));
    return;
  }
  allTargets.forEach(id=>$(id)?.classList.add("hidden"));
  try{
    const rows=await window.MIRA_DATA.listMyModulePermissions();
    const canView=new Set((rows||[]).filter(p=>p.allowed&&p.action_key==="view").map(p=>p.module_key));
    Object.entries(MODULE_TARGETS).forEach(([moduleKey,ids])=>{
      if(canView.has(moduleKey))ids.forEach(id=>$(id)?.classList.remove("hidden"));
    });
  }catch(error){
    console.warn("[MIRA permisos] No fue posible cargar permisos de módulos; se mantiene acceso cerrado.",error);
  }
}
function init(){
  const launch=$("openAdminPermissionsBtn");
  if(launch)launch.addEventListener("click",openPanel);
  $("closeAdminPermissionsBtn")?.addEventListener("click",closePanel);
  $("refreshAdminUsersBtn")?.addEventListener("click",()=>{selectedProfile=null;$("adminSelectedUser").innerHTML='<strong>Selecciona un usuario</strong><span>Sus permisos aparecerán aquí.</span>';$("adminPermissionsMatrix").innerHTML='<p class="admin-permissions-empty">Selecciona un usuario.</p>';loadUsers();});
  $("adminUsersList")?.addEventListener("click",event=>{
    const button=event.target.closest("[data-profile-id]");
    if(button)selectUser(button.dataset.profileId);
  });
  $("adminPermissionsMatrix")?.addEventListener("click",event=>{
    const button=event.target.closest("[data-profile-approval]");
    if(button)changeUserApproval(button);
  });
  $("adminPermissionsMatrix")?.addEventListener("change",event=>{
    const input=event.target.closest('input[type="checkbox"][data-module]');
    if(input)changePermission(input);
  });
  $("adminPermissionsPanel")?.addEventListener("click",event=>{if(event.target.id==="adminPermissionsPanel")closePanel();});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("adminPermissionsPanel")?.classList.contains("hidden"))closePanel();});
  const syncVisibility=()=>{
    if(launch)launch.classList.toggle("hidden",!isAdmin());
    if(!isAdmin())closePanel();
  };
  window.addEventListener("mira:authenticated",()=>{syncVisibility();applyModuleAccess();});
  window.addEventListener("mira:signed-out",syncVisibility);
  syncVisibility();
  applyModuleAccess();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
