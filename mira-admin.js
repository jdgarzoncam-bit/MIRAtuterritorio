// MIRA TU TERRITORIO — Control Administrativo: permisos granulares.
const ACTIONS = [["view","Consulta"]];
const $ = (id) => document.getElementById(id);
let users = [], modules = [], selectedProfile = null, permissionRows = [];
let activeUserTab = "pending";
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
  const candidates=users.filter(u=>u.role!=="admin");
  const pending=candidates.filter(u=>u.email_verified!==true||u.active!==true);
  const approved=candidates.filter(u=>u.email_verified===true&&u.active===true);
  const shown=activeUserTab==="approved"?approved:pending;
  const pendingTab=$("adminUsersPendingTab"), approvedTab=$("adminUsersApprovedTab");
  if(pendingTab){pendingTab.classList.toggle("is-active",activeUserTab==="pending");pendingTab.setAttribute("aria-selected",String(activeUserTab==="pending"));pendingTab.textContent="Por aprobar · "+pending.length;}
  if(approvedTab){approvedTab.classList.toggle("is-active",activeUserTab==="approved");approvedTab.setAttribute("aria-selected",String(activeUserTab==="approved"));approvedTab.textContent="Aprobados · "+approved.length;}
  if(!shown.length){$("adminUsersList").innerHTML=activeUserTab==="approved"?'<p class="admin-permissions-empty">Todavía no hay cuentas aprobadas y activas.</p>':'<p class="admin-permissions-empty">No hay solicitudes pendientes de aprobación.</p>';return;}
  $("adminUsersList").innerHTML=shown.map(u=>{
    const selected=selectedProfile?.id===u.id;
    const label=u.display_name||u.email||"Usuario";
    return '<button type="button" class="admin-user-row '+(selected?"is-selected":"")+'" data-profile-id="'+escapeHtml(u.id)+'" '+(u.role==="admin"?'data-is-admin="true"':'')+'>'+
      '<span class="admin-user-avatar">'+escapeHtml((label.trim()[0]||"U").toUpperCase())+'</span>'+
      '<span class="admin-user-copy"><strong>'+escapeHtml(label)+'</strong><small>'+escapeHtml(u.email||"Sin correo")+'</small><em>'+(u.role==="admin"?"Administradora":u.role==="operator"?"Operador":u.role==="viewer"?"Consulta":u.role==="witness"?"Testigo":escapeHtml(u.role||"Sin rol"))+' · '+(u.email_verified?(u.active?"Aprobado · Activo":"Pendiente de aprobación"):"Correo sin confirmar")+'</em></span>'+
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
  const hasModuleAccess=permissionRows.some(p=>p.action_key==="view"&&p.allowed===true);
  const canApprove=user.email_verified===true&&hasModuleAccess;
  const action=user.active?"suspend":"activate";
  const label=user.active?"Desaprobar cuenta":"Aprobar y habilitar cuenta";
  let hint;
  if(!user.email_verified)hint="La persona debe confirmar su correo electrónico antes de continuar.";
  else if(!hasModuleAccess&&!user.active)hint="Asigna al menos un módulo con Consulta. Los demás permanecerán restringidos.";
  else if(user.active&&!hasModuleAccess)hint="La cuenta está activa, pero no tiene módulos autorizados. El ingreso permanece bloqueado.";
  else hint="Correo confirmado y módulos asignados. La cuenta puede habilitarse.";
  return '<section class="admin-approval-card"><div><strong>Estado y aprobación</strong><small>'+hint+'</small></div><label class="admin-role-picker"><span>Rol de la cuenta</span><select id="adminRoleSelect">'+options+'</select></label><button type="button" class="admin-approval-button" data-profile-approval="'+action+'" '+(!user.active&&!canApprove?"disabled":"")+'>'+label+'</button><button type="button" class="admin-approval-button admin-role-save" data-profile-approval="save-role">Guardar rol</button></section><div class="admin-approval-divider"></div>';
}
async function changeUserApproval(button){
  if(!isAdmin()||!selectedProfile||selectedProfile.role==="admin")return;
  const action=button.dataset.profileApproval;
  const activate=action==="activate";
  if(activate&&!selectedProfile.email_verified){notice("No puedes activar una cuenta cuyo correo no está confirmado.",true);return;}
  const hasModuleAccess=permissionRows.some(p=>p.action_key==="view"&&p.allowed===true);
  if(activate&&!hasModuleAccess){notice("No puedes aprobar esta cuenta: asigna al menos un módulo con Consulta. Los demás quedarán restringidos.",true);return;}
  const nextActive=action==="save-role"?selectedProfile.active:activate;
  const role=$("adminRoleSelect")?.value||selectedProfile.role;
  button.disabled=true;
  try{
    const updated=await window.MIRA_DATA.updateUserProfile(selectedProfile.id,{active:nextActive,role});
    const row=Array.isArray(updated)?updated[0]:null;
    if(!row || row.id!==selectedProfile.id || row.active!==nextActive || row.role!==role) {
      throw new Error("Neon no confirmó el estado y rol solicitados. No se mostrará el cambio como exitoso.");
    }
    selectedProfile={...selectedProfile,...row};
    users=users.map(u=>u.id===selectedProfile.id?selectedProfile:u);
    renderUsers();
    $("adminSelectedUser").innerHTML='<strong>'+escapeHtml(selectedProfile.display_name||selectedProfile.email||"Usuario")+'</strong><span>'+escapeHtml(selectedProfile.email||"")+' · '+(selectedProfile.email_verified?"Correo confirmado":"Correo sin confirmar")+' · '+(selectedProfile.active?"Cuenta activa":"Pendiente de aprobación")+'</span>';
    renderMatrix();
    notice(action==="save-role"?"Rol actualizado. Los permisos de los módulos se conservan.":activate?"Cuenta aprobada y habilitada con los módulos autorizados.":"Cuenta desaprobada. Sus permisos se conservan, pero el acceso queda bloqueado.");
  }catch(error){notice(error.message||"No fue posible actualizar el estado de la cuenta.",true);}
  finally{button.disabled=false;}
}
function renderMatrix(){
  const allowed=new Set(permissionRows.filter(p=>p.allowed).map(p=>p.module_key+"::"+p.action_key));
  const visibleModules=modules.filter(m=>m.module_key!=="control_administrativo");
  const approval = selectedProfile && selectedProfile.role!=="admin" ? renderApprovalControls(selectedProfile) : "";
  $("adminPermissionsMatrix").innerHTML=approval+visibleModules.map(m=>{
    const checked=allowed.has(m.module_key+"::view");
    return '<article class="admin-module-permission"><div class="admin-module-permission-title"><strong>'+escapeHtml(m.module_name)+'</strong><small>'+escapeHtml(m.description||"Permisos del módulo")+'</small></div><div class="admin-module-access-control"><label class="admin-action-check"><input type="checkbox" data-module="'+escapeHtml(m.module_key)+'" data-action="view" '+(checked?"checked":"")+'><span>Consulta</span></label><span class="admin-access-state '+(checked?"is-allowed":"is-restricted")+'">'+(checked?"Acceso completo":"Restringido")+'</span></div></article>';
  }).join("")||'<p class="admin-permissions-empty">No hay módulos configurados.</p>';
}
async function changePermission(input){
  if(!isAdmin()||!selectedProfile||selectedProfile.role==="admin")return;
  const moduleKey=input.dataset.module,actionKey=input.dataset.action;
  input.disabled=true;
  try{
    const saved=await window.MIRA_DATA.setModulePermission(selectedProfile.id,moduleKey,actionKey,input.checked);
    const row=Array.isArray(saved)?saved[0]:null;
    if(!row || row.user_profile_id!==selectedProfile.id || row.module_key!==moduleKey || row.action_key!==actionKey || row.allowed!==input.checked) {
      throw new Error("Neon no confirmó el permiso solicitado. Se restaurará el estado anterior.");
    }
    const existing=permissionRows.find(p=>p.module_key===moduleKey&&p.action_key===actionKey);
    if(existing)Object.assign(existing,row);
    else permissionRows.push(row);
    const state=input.closest(".admin-module-permission")?.querySelector(".admin-access-state");
    if(state){state.textContent=input.checked?"Acceso completo":"Restringido";state.classList.toggle("is-allowed",input.checked);state.classList.toggle("is-restricted",!input.checked);}
    notice(input.checked?"Módulo habilitado con acceso completo.":"Módulo restringido; se bloquean sus operaciones.");
    renderMatrix();
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
  concejal:["dropdown-concejal"],
  pqrs:["dropdown-pqrs-admin"]
};
function setModuleRestricted(element,restricted){
  if(!element)return;
  element.classList.toggle("module-access-restricted",restricted);
  let overlay=element.querySelector(":scope > .module-access-lock-overlay");
  if(restricted){
    element.open=false;
    if(!overlay){
      overlay=document.createElement("div");
      overlay.className="module-access-lock-overlay";
      overlay.setAttribute("role","note");
      overlay.innerHTML='<span class="module-access-lock-icon" aria-hidden="true">🔒</span><strong>No tienes acceso a este módulo</strong>';
      element.appendChild(overlay);
    }
    element.setAttribute("aria-disabled","true");
  }else{
    overlay?.remove();
    element.removeAttribute("aria-disabled");
  }
}
async function applyModuleAccess(){
  const current=window.MIRA_CURRENT_USER;
  const allTargets=Object.values(MODULE_TARGETS).flat();
  if(!current){
    allTargets.forEach(id=>setModuleRestricted($(id),true));
    return;
  }
  // Cerrar todos los módulos antes de resolver permisos: nunca mostrar acceso provisional.
  allTargets.forEach(id=>setModuleRestricted($(id),true));
  if(current.role==="admin"&&current.authUserId===PRIMARY_ADMIN_AUTH_ID){
    allTargets.forEach(id=>{setModuleRestricted($(id),false);$(id)?.classList.remove("hidden");});
    return;
  }
  try{
    if(!window.MIRA_DATA?.listMyModulePermissions) throw new Error("El servicio de permisos no está disponible.");
    const rows=await window.MIRA_DATA.listMyModulePermissions();
    if(!Array.isArray(rows)) throw new Error("La respuesta de permisos no es válida.");
    const canView=new Set(rows.filter(p=>p.allowed===true&&p.action_key==="view").map(p=>p.module_key));
    Object.entries(MODULE_TARGETS).forEach(([moduleKey,ids])=>ids.forEach(id=>{
      const element=$(id);
      setModuleRestricted(element,!canView.has(moduleKey));
      if(element)element.classList.remove("hidden");
    }));
  }catch(error){
    allTargets.forEach(id=>{setModuleRestricted($(id),true);$(id)?.classList.remove("hidden");});
    console.warn("[MIRA permisos] No fue posible cargar permisos; todos los módulos quedan restringidos.",error);
  }
}
function init(){
  const launch=$("openAdminPermissionsBtn");
  if(launch)launch.addEventListener("click",openPanel);
  const switchUserTab=(tab)=>{
    activeUserTab=tab;selectedProfile=null;permissionRows=[];
    $("adminSelectedUser").innerHTML='<strong>Selecciona un usuario</strong><span>Sus permisos aparecerán aquí.</span>';
    $("adminPermissionsMatrix").innerHTML='<p class="admin-permissions-empty">Selecciona un usuario para consultar sus permisos.</p>';
    renderUsers();
    const first=users.find(u=>u.role!=="admin"&&(tab==="approved"?(u.email_verified===true&&u.active===true):(u.email_verified!==true||u.active!==true)));
    if(first)selectUser(first.id);
  };
  $("adminUsersPendingTab")?.addEventListener("click",()=>switchUserTab("pending"));
  $("adminUsersApprovedTab")?.addEventListener("click",()=>switchUserTab("approved"));
  $("closeAdminPermissionsBtn")?.addEventListener("click",closePanel);
  $("refreshAdminUsersBtn")?.addEventListener("click",()=>{selectedProfile=null;$("adminSelectedUser").innerHTML='<strong>Selecciona un usuario</strong><span>Sus permisos aparecerán aquí.</span>';$("adminPermissionsMatrix").innerHTML='<p class="admin-permissions-empty">Selecciona un usuario.</p>';loadUsers();});
  $("adminUsersList")?.addEventListener("click",event=>{
    const button=event.target.closest("[data-profile-id]");
    if(button)selectUser(button.dataset.profileId);
  });
  document.addEventListener("click",event=>{
    const locked=event.target.closest(".module-access-restricted");
    if(locked){event.preventDefault();event.stopImmediatePropagation();}
  },true);
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
    const authorized=isAdmin();
    if(launch){
      launch.classList.toggle("hidden",!authorized);
      launch.setAttribute("aria-hidden",String(!authorized));
      launch.toggleAttribute("data-admin-visible",authorized);
      if(!authorized)launch.setAttribute("tabindex","-1");
      else launch.removeAttribute("tabindex");
    }
    const panel=$("adminPermissionsPanel");
    if(panel){
      panel.classList.toggle("hidden",!authorized);
      panel.setAttribute("aria-hidden",String(!authorized));
      panel.toggleAttribute("data-admin-visible",authorized);
      if(!authorized)closePanel();
    }
  };
  window.addEventListener("mira:authenticated",()=>{syncVisibility();applyModuleAccess();});
  window.addEventListener("mira:signed-out",()=>{syncVisibility();applyModuleAccess();});
  syncVisibility();
  applyModuleAccess();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
