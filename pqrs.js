import { MIRA_DATA } from "./mira-data.js";
(() => {
 const $=id=>document.getElementById(id),ADMIN_ID="beef5bf3-82a8-4c35-a12c-17771be59da1";
 const types={peticion:"Petición",queja:"Queja",reclamo:"Reclamo",sugerencia:"Sugerencia"};
 const modules={infomira:"InfoMIRA",logistica:"Logística & Transporte",testigos:"Auditoría Testigos",info_electoral:"Info Electoral",barrios_puestos:"Barrios y puestos",actividades:"Actividades",concejal:"Concejal · Gestión territorial",centro_operaciones:"Centro de Operaciones",pqrs:"PQRS",otro:"Otro / General"};
 let returnContext="landing",records=[],filter="todas",loading=false,accessCheckVersion=0,inboxAllowed=false;
 const currentUser=()=>window.MIRA_CURRENT_USER||null;
 const isAdmin=()=>currentUser()?.role==="admin"&&currentUser()?.authUserId===ADMIN_ID;
 const isSignedIn=()=>Boolean(currentUser()?.authUserId);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const date=v=>v?new Date(v).toLocaleString("es-CO",{dateStyle:"medium",timeStyle:"short"}):"—";
 function setContext(){returnContext=$("landing-hero-overlay")?.style.display==="none"?"platform":"landing";}
 function closeWorkspace(id){$(id)?.classList.add("hidden");if(returnContext==="platform"){$("landing-hero-overlay").style.display="none";$("landingHeaderControls").style.display="none";}else{$("landing-hero-overlay").style.display="flex";$("landingHeaderControls").style.display="flex";}}
 async function hasInboxAccess(){
  if(isAdmin())return true;
  const user=currentUser();
  if(!user||!["viewer","operator"].includes(user.role))return false;
  if(!MIRA_DATA?.listMyModulePermissions)return false;
  const rows=await MIRA_DATA.listMyModulePermissions();
  return Array.isArray(rows)&&rows.some(p=>p.module_key==="pqrs"&&p.action_key==="view"&&p.allowed===true);
 }
 async function syncAdminVisibility(){
  const version=++accessCheckVersion,item=$("dropdown-pqrs-admin");
  if(!isSignedIn()){inboxAllowed=false;if(item){item.classList.add("hidden");item.open=false;}return;}
  try{
   const allowed=await hasInboxAccess();
   if(version!==accessCheckVersion)return;
   inboxAllowed=allowed;
   if(item){item.classList.toggle("hidden",!allowed);if(!allowed)item.open=false;}
   if(!allowed)$("pqrsAdminWorkspace")?.classList.add("hidden");
  }catch(error){
   if(version!==accessCheckVersion)return;
   inboxAllowed=false;
   if(item){item.classList.add("hidden");item.open=false;}
   $("pqrsAdminWorkspace")?.classList.add("hidden");
   console.warn("[MIRA PQRS] No fue posible validar el permiso de consulta.",error);
  }
 }
 function openSubmit(){setContext();$("landing-hero-overlay").style.display="none";$("landingHeaderControls").style.display="none";$("pqrsSubmitWorkspace").classList.remove("hidden");$("pqrsSubmitNotice").classList.add("hidden");}
 function submitNotice(msg,error=false){const n=$("pqrsSubmitNotice");n.textContent=msg;n.classList.remove("hidden");n.style.borderColor=error?"rgba(248,113,113,.55)":"rgba(45,212,191,.4)";}
 async function submit(event){event.preventDefault();const button=$("pqrsSendBtn");button.disabled=true;try{await MIRA_DATA.createPQRS({tipo:$("pqrsType").value,modulo_key:$("pqrsModule").value,asunto:$("pqrsSubject").value,descripcion:$("pqrsDescription").value});$("pqrsSubmitForm").reset();submitNotice("Tu PQRS fue registrada correctamente. Gracias por ayudarnos a mejorar.");}catch(err){submitNotice(err.message||"No fue posible guardar tu PQRS. Intenta nuevamente.",true);}finally{button.disabled=false;}}
 function adminNotice(msg,error=false){const n=$("pqrsAdminNotice");if(!n)return;n.textContent=msg;n.classList.remove("hidden");n.style.borderColor=error?"rgba(248,113,113,.55)":"rgba(45,212,191,.4)";}
 function renderStats(){const count=t=>records.filter(r=>t==="todas"||r.tipo===t).length;$("pqrsAdminStats").innerHTML=[["Total recibidas",count("todas")],["Peticiones",count("peticion")],["Quejas",count("queja")],["Reclamos y sugerencias",count("reclamo")+count("sugerencia")]].map(([l,n])=>'<div class="pqrs-stat"><small>'+l+'</small><strong>'+n+'</strong></div>').join("");$("pqrsCountAll").textContent=count("todas");Object.keys(types).forEach(t=>{const el=$("pqrsCount"+t[0].toUpperCase()+t.slice(1));if(el)el.textContent=count(t);});$("pqrsSidebarCount").textContent=count("todas")+" solicitudes recibidas";}
 function renderRecords(){
  renderStats();const list=$("pqrsAdminList"),visible=records.filter(r=>filter==="todas"||r.tipo===filter),canManage=isAdmin();
  $("pqrsAdminSubtitle").textContent=visible.length+" registros · "+(canManage?"consulta y gestión administrativa":"consulta delegada · solo lectura")+" · ordenados del más reciente al más antiguo";
  if(!visible.length){list.innerHTML='<div class="pqrs-empty"><div style="font-size:2rem">💬</div><strong>No hay registros en esta categoría</strong><p>Cuando llegue una nueva solicitud, aparecerá aquí.</p></div>';return;}
  list.innerHTML=visible.map(r=>'<article class="pqrs-record"><div class="pqrs-record-head"><div><span class="pqrs-type-tag">'+esc(types[r.tipo]||r.tipo)+'</span><h3>'+esc(r.asunto)+'</h3></div><span class="pqrs-record-meta">'+esc(date(r.created_at))+'</span></div><div class="pqrs-record-meta"><span>▦ '+esc(modules[r.modulo_key]||r.modulo_key)+'</span><span>Estado: '+esc(r.estado)+'</span><span>ID: '+esc(r.id.slice(0,8))+'</span></div><p class="pqrs-record-description">'+esc(r.descripcion)+'</p><div class="pqrs-record-actions"><small class="pqrs-record-meta">Remitente: '+(r.created_by===currentUser()?.authUserId?"Tu cuenta":"Usuario registrado")+'</small>'+(canManage?'<label>Actualizar estado<select data-pqrs-status="'+esc(r.id)+'"><option value="recibida" '+(r.estado==="recibida"?"selected":"")+'>Recibida</option><option value="en_revision" '+(r.estado==="en_revision"?"selected":"")+'>En revisión</option><option value="respondida" '+(r.estado==="respondida"?"selected":"")+'>Respondida</option><option value="cerrada" '+(r.estado==="cerrada"?"selected":"")+'>Cerrada</option></select></label>':'<span class="pqrs-readonly-label">Consulta delegada · solo lectura</span>')+'</div></article>').join("");
  if(canManage)list.querySelectorAll("[data-pqrs-status]").forEach(select=>select.addEventListener("change",async()=>{select.disabled=true;try{await MIRA_DATA.updatePQRS(select.dataset.pqrsStatus,{estado:select.value});const row=records.find(x=>x.id===select.dataset.pqrsStatus);if(row)row.estado=select.value;renderRecords();}catch(err){adminNotice(err.message||"No se pudo actualizar el estado.",true);select.disabled=false;}}));
 }
 async function loadRecords(){
  if(!await hasInboxAccess()){inboxAllowed=false;await syncAdminVisibility();$("pqrsAdminWorkspace")?.classList.add("hidden");adminNotice("No tienes autorización para consultar la bandeja administrativa.",true);return;}
  if(loading)return;loading=true;$("pqrsAdminList").innerHTML='<div class="pqrs-empty">Consultando Neon…</div>';
  try{records=await MIRA_DATA.listPQRS({limit:1000})||[];renderRecords();}
  catch(err){$("pqrsAdminList").innerHTML='<div class="pqrs-empty">No fue posible consultar las PQRS: '+esc(err.message)+'</div>';}
  finally{loading=false;}
 }
 async function openAdmin(){
  if(!await hasInboxAccess()){inboxAllowed=false;await syncAdminVisibility();adminNotice("No tienes autorización para consultar la bandeja administrativa.",true);return;}
  inboxAllowed=true;setContext();$("landing-hero-overlay").style.display="none";$("landingHeaderControls").style.display="none";$("pqrsAdminWorkspace").classList.remove("hidden");filter="todas";document.querySelectorAll(".pqrs-filter").forEach(b=>b.classList.toggle("is-active",b.dataset.pqrsFilter==="todas"));loadRecords();
 }
 document.addEventListener("DOMContentLoaded",()=>{$("btnSelectPQRS")?.addEventListener("click",openSubmit);$("btnSelectPQRS")?.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openSubmit();}});$("closePqrsSubmit")?.addEventListener("click",()=>closeWorkspace("pqrsSubmitWorkspace"));$("returnFromPqrsSubmit")?.addEventListener("click",()=>closeWorkspace("pqrsSubmitWorkspace"));$("pqrsSubmitForm")?.addEventListener("submit",submit);$("pqrsSubmitForm")?.addEventListener("reset",()=>setTimeout(()=>$("pqrsSubmitNotice").classList.add("hidden"),0));$("openPqrsAdminBtn")?.addEventListener("click",openAdmin);$("closePqrsAdmin")?.addEventListener("click",()=>closeWorkspace("pqrsAdminWorkspace"));$("returnFromPqrsAdmin")?.addEventListener("click",()=>closeWorkspace("pqrsAdminWorkspace"));$("pqrsRefreshBtn")?.addEventListener("click",loadRecords);document.querySelectorAll(".pqrs-filter").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.pqrsFilter;document.querySelectorAll(".pqrs-filter").forEach(x=>x.classList.toggle("is-active",x===b));renderRecords();}));syncAdminVisibility();});
 window.addEventListener("mira:authenticated",syncAdminVisibility);
 window.addEventListener("mira:signed-out",()=>{syncAdminVisibility();records=[];filter="todas";$("pqrsAdminWorkspace")?.classList.add("hidden");});
})();