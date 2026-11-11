// MIRA TU TERRITORIO — Control Administrativo: permisos granulares.
const MODULE_ACTIONS = {
  actividades:[["view","Consulta"],["create","Crear"],["edit","Editar"],["annul","Anular asistencia"],["export","Exportar Excel"],["delete","Eliminar"]],
  personas:[["view","Consultar personas"],["create","Incorporar personas"],["edit","Completar / editar fichas"]],
  concejal:[["view","Consulta"],["create","Crear"],["edit","Editar"],["delete","Eliminar"]],
  infomira:[["view","Consulta"],["create","Crear"],["edit","Editar"],["delete","Eliminar"]],
  centro_operaciones:[["view","Consulta"]], pqrs:[["view","Consulta"]]
};
const $ = (id) => document.getElementById(id);
let users = [], modules = [], selectedProfile = null, permissionRows = [], allPermissionRows = [];
let activeUserTab = "pending";
let activePanelView = "users";
let selectionRequestVersion = 0;
let auditRequestVersion = 0;
let auditOffset = 0;
let auditHasMore = false;
const AUDIT_PAGE_SIZE = 50;
let busy = false;
let reloadUsersAfterBusy = false;

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
function roleAllowsAction(role,action){
  if(role==="operator")return ["view","create","edit","export","annul"].includes(action);
  if(role==="viewer")return action==="view";
  return false;
}
function hasUsableModuleAccess(rows,role="operator"){
  const activeModules=new Set(modules.filter(module=>module.active===true).map(module=>module.module_key));
  return roleAllowsAction(role,"view")&&Array.isArray(rows)&&rows.some(p=>
    p.allowed===true &&
    p.action_key==="view" &&
    activeModules.has(p.module_key) &&
    p.module_key!=="testigos" &&
    p.module_key!=="control_administrativo"
  );
}
function userApprovalStatus(user){
  const ownPermissions=allPermissionRows.filter(row=>row.user_profile_id===user.id);
  if(user.email_verified!==true)return {bucket:"pending",key:"email",label:"Correo sin confirmar"};
  if(user.active!==true)return {bucket:"pending",key:"inactive",label:"Cuenta inactiva · acceso bloqueado"};
  if(!hasUsableModuleAccess(ownPermissions,user.role))return {bucket:"pending",key:"no_access",label:"Activo · sin acceso efectivo"};
  return {bucket:"approved",key:"approved",label:"Aprobado · acceso habilitado"};
}
const PRIMARY_ADMIN_AUTH_ID="beef5bf3-82a8-4c35-a12c-17771be59da1";
function isAdmin(){const user=window.MIRA_CURRENT_USER;return user?.role==="admin"&&user?.authUserId===PRIMARY_ADMIN_AUTH_ID;}
function openPanel(){
  if(!isAdmin())return;
  $("adminPermissionsPanel")?.classList.remove("hidden");
  $("adminPermissionsPanel")?.setAttribute("aria-hidden","false");
  document.body.classList.add("admin-permissions-open");
  switchPanelView("users");
  if(window.MIRA_CURRENT_USER && window.MIRA_DATA) loadUsers();
  else $("adminUsersList").innerHTML='<p class="admin-permissions-loading">Esperando la sesión y los servicios de datos…</p>';
}
function closePanel(){
  selectionRequestVersion++;auditRequestVersion++;
  $("adminPermissionsPanel")?.classList.add("hidden");
  $("adminPermissionsPanel")?.setAttribute("aria-hidden","true");
  document.body.classList.remove("admin-permissions-open");
}
async function loadUsers(){
  if(!isAdmin())return;
  if(busy){reloadUsersAfterBusy=true;return;}
  if(!window.MIRA_DATA){$("adminUsersList").innerHTML='<p class="admin-permissions-loading">Esperando conexión con Neon…</p>';return;}
  busy=true;clearNotice();
  $("adminUsersList").innerHTML='<p class="admin-permissions-loading">Consultando perfiles…</p>';
  try{
    const timeout=(promise,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error("Tiempo de espera agotado al consultar "+label+". Intenta actualizar nuevamente.")),15000))]);
    const [profileRows,moduleRows,permissionRowsAll]=await Promise.all([
      timeout(window.MIRA_DATA.listUserProfiles(),"perfiles"),
      timeout(window.MIRA_DATA.listModuleCatalog(),"catálogo de módulos"),
      timeout(window.MIRA_DATA.listAllModulePermissions(),"permisos asignados")
    ]);
    users=Array.isArray(profileRows)?profileRows:[];
    modules=Array.isArray(moduleRows)?moduleRows:[];
    allPermissionRows=Array.isArray(permissionRowsAll)?permissionRowsAll:[];
    renderUsers();
    if(selectedProfile){
      const stillThere=users.find(u=>u.id===selectedProfile.id);
      if(stillThere){selectedProfile=stillThere;await selectUser(stillThere.id,false);}
      else {selectedProfile=null;$("adminPermissionsMatrix").innerHTML='<p class="admin-permissions-empty">Selecciona un usuario.</p>';}
    }
  }catch(error){
    $("adminUsersList").innerHTML='<p class="admin-permissions-error">'+escapeHtml(error.message||"No fue posible consultar los usuarios.")+'</p>';
  }finally{
    busy=false;
    if(reloadUsersAfterBusy){reloadUsersAfterBusy=false;queueMicrotask(()=>loadUsers());}
  }
}
function renderUsers(){
  const candidates=users.filter(u=>u.role!=="admin");
  const pending=candidates.filter(u=>userApprovalStatus(u).bucket==="pending");
  const approved=candidates.filter(u=>userApprovalStatus(u).bucket==="approved");
  const shown=activeUserTab==="approved"?approved:pending;
  const pendingTab=$("adminUsersPendingTab"), approvedTab=$("adminUsersApprovedTab");
  if(pendingTab){pendingTab.classList.toggle("is-active",activeUserTab==="pending");pendingTab.setAttribute("aria-selected",String(activeUserTab==="pending"));pendingTab.textContent="Pendientes / sin acceso · "+pending.length;}
  if(approvedTab){approvedTab.classList.toggle("is-active",activeUserTab==="approved");approvedTab.setAttribute("aria-selected",String(activeUserTab==="approved"));approvedTab.textContent="Aprobados · "+approved.length;}
  if(!shown.length){$("adminUsersList").innerHTML=activeUserTab==="approved"?'<p class="admin-permissions-empty">Todavía no hay cuentas aprobadas y activas.</p>':'<p class="admin-permissions-empty">No hay solicitudes pendientes de aprobación.</p>';return;}
  $("adminUsersList").innerHTML=shown.map(u=>{
    const selected=selectedProfile?.id===u.id;
    const label=u.display_name||u.email||"Usuario";
    return '<button type="button" class="admin-user-row '+(selected?"is-selected":"")+'" data-profile-id="'+escapeHtml(u.id)+'" '+(u.role==="admin"?'data-is-admin="true"':'')+'>'+
      '<span class="admin-user-avatar">'+escapeHtml((label.trim()[0]||"U").toUpperCase())+'</span>'+
      '<span class="admin-user-copy"><strong>'+escapeHtml(label)+'</strong><small>'+escapeHtml(u.email||"Sin correo")+'</small><em>'+(u.role==="admin"?"Administradora":u.role==="operator"?"Operador":u.role==="viewer"?"Consulta":u.role==="witness"?"Testigo":escapeHtml(u.role||"Sin rol"))+' · '+escapeHtml(userApprovalStatus(u).label)+'</em></span>'+
      (u.role==="admin"?'<span class="admin-user-lock" title="Cuenta protegida">🔒</span>':'<span class="admin-user-arrow">›</span>')+'</button>';
  }).join("");
}
async function selectUser(profileId){
 const user=users.find(u=>u.id===profileId); if(!user)return;
 const version=++selectionRequestVersion;
 selectedProfile=user;permissionRows=[];clearNotice();renderUsers();
 $("adminSelectedUser").innerHTML='<strong>'+escapeHtml(user.display_name||user.email||"Usuario")+'</strong><span>'+escapeHtml(user.email||"")+' · '+escapeHtml(userApprovalStatus(user).label)+'</span>';
 if(user.role==="admin"){
  $("adminPermissionsMatrix").innerHTML='<div class="admin-permissions-protected"><strong>🔒 Cuenta administradora protegida</strong><p>Esta cuenta conserva todos los permisos y no puede modificarse desde este panel.</p></div>';return;
 }
 $("adminPermissionsMatrix").innerHTML='<p class="admin-permissions-loading">Cargando permisos…</p>';
 try{
  const rows=await window.MIRA_DATA.listModulePermissions(user.id);
  if(version!==selectionRequestVersion||selectedProfile?.id!==user.id)return;
  permissionRows=Array.isArray(rows)?rows:[];renderMatrix();
 }catch(error){
  if(version!==selectionRequestVersion||selectedProfile?.id!==user.id)return;
  $("adminPermissionsMatrix").innerHTML='<p class="admin-permissions-error">'+escapeHtml(error.message||"No fue posible cargar los permisos.")+'</p>';
 }
}
function renderApprovalControls(user){
  const roles=[["viewer","Consulta"],["operator","Operador"]];
  if(user.role==="witness")roles.push(["witness","Testigo (reservado; no asignable)"]);
  const options=roles.map(([value,label])=>'<option value="'+value+'" '+(user.role===value?"selected ":"")+(value==="witness"?"disabled":"")+'>'+label+'</option>').join("");
  const hasModuleAccess=hasUsableModuleAccess(permissionRows,user.role);
  const canApprove=user.email_verified===true&&hasModuleAccess;
  const action=user.active?"suspend":"activate";
  const label=user.active?"Desaprobar cuenta":"Aprobar y habilitar cuenta";
  let hint;
  if(!user.email_verified)hint="La persona debe confirmar su correo electrónico antes de continuar.";
  else if(!hasModuleAccess&&!user.active)hint="Asigna al menos un módulo activo y disponible con permiso Consulta.";
  else if(user.active&&!hasModuleAccess)hint="La cuenta está activa, pero no tiene módulos autorizados. El ingreso permanece bloqueado.";
  else hint="Correo confirmado y módulos asignados. La cuenta puede habilitarse.";
  return '<section class="admin-approval-card"><div><strong>Estado y aprobación</strong><small>'+hint+'</small></div><label class="admin-role-picker"><span>Rol de la cuenta</span><select id="adminRoleSelect">'+options+'</select></label><button type="button" class="admin-approval-button" data-profile-approval="'+action+'" '+(!user.active&&!canApprove?"disabled":"")+'>'+label+'</button><button type="button" class="admin-approval-button admin-role-save" data-profile-approval="save-role">Guardar rol</button></section><div class="admin-approval-divider"></div>';
}
async function changeUserApproval(button){
 if(!isAdmin()||!selectedProfile||selectedProfile.role==="admin")return;
 const target={...selectedProfile},targetId=selectedProfile.id,action=button.dataset.profileApproval;
 const activate=action==="activate";
 if(activate&&!target.email_verified){notice("No puedes activar una cuenta cuyo correo no está confirmado.",true);return;}
 const hasModuleAccess=hasUsableModuleAccess(permissionRows,target.role);
 if(activate&&!hasModuleAccess){notice("No puedes aprobar esta cuenta: asigna al menos un módulo activo y disponible con Consulta.",true);return;}
 const nextActive=action==="save-role"?target.active:activate;
 const role=$("adminRoleSelect")?.value||target.role;
 if(!["viewer","operator"].includes(role)){notice("El rol Testigo está reservado. Selecciona Consulta u Operador para reemplazarlo.",true);return;}
 button.disabled=true;
 try{
  const updated=await window.MIRA_DATA.updateUserProfile(targetId,{active:nextActive,role});
  const row=Array.isArray(updated)?updated[0]:null;
  if(!row||row.id!==targetId||row.active!==nextActive||row.role!==role)throw new Error("Neon no confirmó el estado y rol solicitados. No se mostrará el cambio como exitoso.");
  const merged={...target,...row};users=users.map(u=>u.id===targetId?merged:u);
  if(selectedProfile?.id===targetId){
   selectedProfile=merged;
   $("adminSelectedUser").innerHTML='<strong>'+escapeHtml(merged.display_name||merged.email||"Usuario")+'</strong><span>'+escapeHtml(merged.email||"")+' · '+escapeHtml(userApprovalStatus(merged).label)+'</span>';
   renderUsers();renderMatrix();
   notice(action==="save-role"?"Rol guardado. Se conservan los permisos existentes; el rol limita las acciones efectivas.":activate?"Cuenta aprobada y habilitada con los módulos autorizados.":"Cuenta desaprobada. Sus permisos se conservan, pero el acceso queda bloqueado.");
  }
 }catch(error){if(selectedProfile?.id===targetId)notice(error.message||"No fue posible actualizar el estado de la cuenta.",true);}
 finally{if(button.isConnected)button.disabled=false;}
}
function renderMatrix(){
 const allowed=new Set(permissionRows.filter(p=>p.allowed).map(p=>p.module_key+"::"+p.action_key));
 const visibleModules=modules.filter(m=>m.module_key!=="control_administrativo"&&m.module_key!=="testigos"&&m.active!==false);
 const approval=selectedProfile&&selectedProfile.role!=="admin"?renderApprovalControls(selectedProfile):"";
 const roleNote=selectedProfile&&selectedProfile.role!=="admin"
  ? '<p class="admin-permissions-hint">El rol limita las acciones efectivas: Consulta solo permite ver; Operador permite consultar, crear, editar y anular cuando se autoriza. La exportación requiere autorización independiente. Eliminar y administrar no están habilitados para estos roles. Los permisos guardados se conservan si cambias el rol, pero las acciones fuera de su límite no tendrán efecto.</p>'
  : "";
 $("adminPermissionsMatrix").innerHTML=approval+roleNote+visibleModules.map(m=>{
  const actions=MODULE_ACTIONS[m.module_key]||[["view","Consulta"]];
  const controls=actions.map(([key,label])=>{
   const checked=allowed.has(m.module_key+"::"+key);
   const roleAllowed=roleAllowsAction(selectedProfile?.role,key);
   const hasView=allowed.has(m.module_key+"::view");
   const effective=roleAllowed&&(key==="view"||hasView);
   const disabled=effective?"":"disabled";
   const suffix=effective?"":'<small class="admin-role-restriction">'+(roleAllowed?"Requiere permiso Consulta":"No permitido por el rol")+'</small>';
   return '<label class="admin-action-check"><input type="checkbox" data-module="'+escapeHtml(m.module_key)+'" data-action="'+escapeHtml(key)+'" '+(checked?"checked ":"")+disabled+'><span>'+escapeHtml(label)+'</span>'+suffix+'</label>';
  }).join("");
  const activeCount=actions.filter(([key])=>allowed.has(m.module_key+"::"+key)&&roleAllowsAction(selectedProfile?.role,key)&&(key==="view"||allowed.has(m.module_key+"::view"))).length;
  return '<article class="admin-module-permission"><div class="admin-module-permission-title"><strong>'+escapeHtml(m.module_name)+'</strong><small>'+escapeHtml(m.description||"Permisos del módulo")+'</small><small class="admin-permission-summary">'+activeCount+' de '+actions.length+' acciones habilitadas</small></div><div class="admin-module-access-control"><div class="admin-action-checks">'+controls+'</div></div></article>';
 }).join("")||'<p class="admin-permissions-empty">No hay módulos configurados.</p>';
}
async function changePermission(input){
 if(!isAdmin()||!selectedProfile||selectedProfile.role==="admin")return;
 const targetProfileId=selectedProfile.id,moduleKey=input.dataset.module,actionKey=input.dataset.action,nextValue=input.checked;
 if(!roleAllowsAction(selectedProfile.role,actionKey)){input.checked=!nextValue;notice("El rol "+(selectedProfile.role==="viewer"?"Consulta":"actual")+" no permite esta acción. Cambia el rol para habilitarla.",true);return;}
 if(moduleKey==="actividades"&&actionKey==="export"&&nextValue&&!permissionRows.some(p=>p.module_key===moduleKey&&p.action_key==="view"&&p.allowed===true)){input.checked=false;notice("Para autorizar exportaciones primero debes conceder Consulta en Actividades.",true);return;}
 if(moduleKey==="actividades"&&actionKey==="view"&&!nextValue&&permissionRows.some(p=>p.module_key===moduleKey&&p.action_key==="export"&&p.allowed===true)){input.checked=true;notice("Retira primero el permiso Exportar Excel antes de retirar Consulta.",true);return;}
 input.disabled=true;
 try{
  const saved=await window.MIRA_DATA.setModulePermission(targetProfileId,moduleKey,actionKey,nextValue);
  const row=Array.isArray(saved)?saved[0]:null;
  if(!row||row.user_profile_id!==targetProfileId||row.module_key!==moduleKey||row.action_key!==actionKey||row.allowed!==nextValue)throw new Error("Neon no confirmó el permiso solicitado. Se restaurará el estado anterior.");
  if(selectedProfile?.id!==targetProfileId)return;
  const existing=permissionRows.find(p=>p.module_key===moduleKey&&p.action_key===actionKey);
  if(existing)Object.assign(existing,row);else permissionRows.push(row);
  const globalExisting=allPermissionRows.find(p=>p.user_profile_id===targetProfileId&&p.module_key===moduleKey&&p.action_key===actionKey);
  if(globalExisting)Object.assign(globalExisting,row);else allPermissionRows.push(row);
  renderUsers();
  notice(nextValue?"Permiso habilitado.":"Permiso retirado; la base de datos bloqueará esa acción.");renderMatrix();
 }catch(error){
  if(input.isConnected)input.checked=!nextValue;
  if(selectedProfile?.id===targetProfileId)notice(error.message||"No fue posible guardar el permiso.",true);
 }finally{if(input.isConnected)input.disabled=false;}
}
function switchPanelView(view){
 if(!isAdmin())return;
 activePanelView=view==="audit"?"audit":"users";
 $("adminPermissionsBody")?.classList.toggle("hidden",activePanelView!=="users");
 $("adminAuditPanel")?.classList.toggle("hidden",activePanelView!=="audit");
 $("adminAuditPanel")?.setAttribute("aria-hidden",String(activePanelView!=="audit"));
 const toggle=$("adminViewToggleBtn");
 if(toggle){toggle.textContent=activePanelView==="audit"?"Volver a usuarios y permisos":"Ver historial de auditoría";toggle.setAttribute("aria-label",toggle.textContent);}
 if(activePanelView==="audit")loadAudit();
}
function auditActionLabel(action){
 const labels={profile_created:"Cuenta creada",profile_updated:"Cuenta actualizada",profile_deleted:"Cuenta eliminada",permission_created:"Permiso asignado",permission_updated:"Permiso actualizado",permission_deleted:"Permiso retirado"};
 return labels[action]||action||"Evento";
}
function renderAudit(rows){
 const node=$("adminAuditList");if(!node)return;
 if(!rows.length){node.innerHTML='<p class="admin-permissions-empty">Todavía no hay eventos de auditoría.</p>';return;}
 node.innerHTML=rows.map(item=>{
  const date=new Date(item.created_at);
  const dateLabel=Number.isNaN(date.getTime())?escapeHtml(item.created_at||"Fecha no disponible"):escapeHtml(new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(date));
  return '<article class="admin-audit-event"><div class="admin-audit-event-heading"><strong>'+escapeHtml(auditActionLabel(item.action_key))+'</strong><time>'+dateLabel+'</time></div><div class="admin-audit-identities"><span><b>Actor:</b> '+escapeHtml(item.actor_auth_user_id||"Sistema")+'</span><span><b>Objetivo:</b> '+escapeHtml(item.target_auth_user_id||"—")+'</span></div><details><summary>Ver detalles del evento</summary><pre>'+escapeHtml(JSON.stringify(item.details||{},null,2))+'</pre></details></article>';
 }).join("");
}
function renderAuditPagination(){
 const node=$("adminAuditPagination");if(!node)return;
 const page=Math.floor(auditOffset/AUDIT_PAGE_SIZE)+1;
 node.innerHTML='<button type="button" data-audit-page="previous" '+(auditOffset===0?"disabled":"")+'>Anterior</button><span>Página '+page+'</span><button type="button" data-audit-page="next" '+(!auditHasMore?"disabled":"")+'>Siguiente</button>';
}
async function loadAudit(reset=false){
 if(!isAdmin()||!window.MIRA_DATA?.listAdminAudit)return;
 if(reset)auditOffset=0;
 const version=++auditRequestVersion,node=$("adminAuditList");
 if(node)node.innerHTML='<p class="admin-permissions-loading">Consultando historial…</p>';
 try{
  const rows=await window.MIRA_DATA.listAdminAudit({limit:AUDIT_PAGE_SIZE+1,offset:auditOffset});
  if(version!==auditRequestVersion||activePanelView!=="audit")return;
  const pageRows=Array.isArray(rows)?rows.slice(0,AUDIT_PAGE_SIZE):[];
  auditHasMore=Array.isArray(rows)&&rows.length>AUDIT_PAGE_SIZE;
  renderAudit(pageRows);
  renderAuditPagination();
 }catch(error){
  if(version!==auditRequestVersion||activePanelView!=="audit")return;
  if(node)node.innerHTML='<p class="admin-permissions-error">'+escapeHtml(error.message||"No fue posible consultar el historial de auditoría.")+'</p>';
  const pager=$("adminAuditPagination");if(pager)pager.innerHTML="";
 }
}

const MODULE_TARGETS = {
  infomira:["dropdown-infomira"],
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
      overlay.innerHTML=element.id==="dropdown-testigos"
        ? '<span class="module-access-lock-icon" aria-hidden="true">🔒</span><strong>Módulo temporalmente inactivo · En renovación</strong>'
        : '<span class="module-access-lock-icon" aria-hidden="true">🔒</span><strong>No tienes acceso a este módulo</strong>';
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
    allTargets.forEach(id=>{
      const temporaryLock=id==="dropdown-testigos";
      setModuleRestricted($(id),temporaryLock);
      $(id)?.classList.remove("hidden");
    });
    return;
  }
  if(!["operator","viewer"].includes(current.role)){
    allTargets.forEach(id=>{setModuleRestricted($(id),true);$(id)?.classList.remove("hidden");});
    console.warn("[MIRA permisos] El rol no tiene capacidades operativas asignables.");
    return;
  }
  try{
    if(!window.MIRA_DATA?.listMyModulePermissions) throw new Error("El servicio de permisos no está disponible.");
    const rows=await window.MIRA_DATA.listMyModulePermissions();
    if(!Array.isArray(rows)) throw new Error("La respuesta de permisos no es válida.");
    const canView=new Set(rows.filter(p=>p.allowed===true&&p.action_key==="view").map(p=>p.module_key));
    Object.entries(MODULE_TARGETS).forEach(([moduleKey,ids])=>ids.forEach(id=>{
      const element=$(id);
      // Auditoría Testigos: restricción temporal única por rol de administrador.
      // No se habilita mediante permisos granulares mientras el módulo está en ejecución.
      const allowed=moduleKey==="testigos"?false:canView.has(moduleKey);
      setModuleRestricted(element,!allowed);
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
    selectionRequestVersion++;
    activeUserTab=tab;selectedProfile=null;permissionRows=[];
    $("adminSelectedUser").innerHTML='<strong>Selecciona un usuario</strong><span>Sus permisos aparecerán aquí.</span>';
    $("adminPermissionsMatrix").innerHTML='<p class="admin-permissions-empty">Selecciona un usuario para consultar sus permisos.</p>';
    renderUsers();
    const first=users.find(u=>u.role!=="admin"&&userApprovalStatus(u).bucket===tab);
    if(first)selectUser(first.id);
  };
  $("adminUsersPendingTab")?.addEventListener("click",()=>switchUserTab("pending"));
  $("adminUsersApprovedTab")?.addEventListener("click",()=>switchUserTab("approved"));
  $("closeAdminPermissionsBtn")?.addEventListener("click",closePanel);
  $("adminViewToggleBtn")?.addEventListener("click",()=>switchPanelView(activePanelView==="audit"?"users":"audit"));
  $("refreshAdminAuditBtn")?.addEventListener("click",()=>loadAudit(true));
  $("adminAuditPagination")?.addEventListener("click",event=>{
    const button=event.target.closest("[data-audit-page]");if(!button||button.disabled)return;
    if(button.dataset.auditPage==="previous")auditOffset=Math.max(0,auditOffset-AUDIT_PAGE_SIZE);
    else if(button.dataset.auditPage==="next"&&auditHasMore)auditOffset+=AUDIT_PAGE_SIZE;
    loadAudit();
  });
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
  window.addEventListener("mira:authenticated",()=>{
    syncVisibility();applyModuleAccess();
    if(!$("adminPermissionsPanel")?.classList.contains("hidden"))loadUsers();
  });
  window.addEventListener("mira:signed-out",()=>{syncVisibility();applyModuleAccess();});
  syncVisibility();
  applyModuleAccess();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
