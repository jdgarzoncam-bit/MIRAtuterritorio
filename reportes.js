import { createAuthClient } from "https://esm.sh/@neondatabase/auth@0.7.0-beta";

(() => {
  const $ = id => document.getElementById(id);
  const AUTH_URL = "https://ep-round-dawn-b7l3ya3h.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth";
  const DATA_API = "https://ep-round-dawn-b7l3ya3h.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1";
  const auth = createAuthClient(AUTH_URL,{allowAnonymous:true});
  const ADMIN_ID = "beef5bf3-82a8-4c35-a12c-17771be59da1";
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const date = v => v ? new Date(v).toLocaleString("es-CO",{dateStyle:"medium",timeStyle:"short"}) : "—";
  const categories = {seguridad:"Seguridad",movilidad:"Movilidad",servicios_publicos:"Servicios públicos",espacio_publico:"Espacio público",ambiente:"Ambiente",convivencia:"Convivencia",otro:"Otro"};
  let returnContext="landing",records=[],busy=false;

  async function token(anonymous=false){
    const result=anonymous?await auth.getAnonymousToken():await auth.token();
    if(result?.error||!result?.data?.token)throw new Error("No fue posible validar la sesión.");
    return result.data.token;
  }
  async function request(path,{method="GET",body,anonymous=false}={}){
    const jwt=await token(anonymous),headers={Authorization:"Bearer "+jwt,Accept:"application/json","Accept-Profile":"mira"};
    if(body!==undefined){headers["Content-Type"]="application/json";headers["Content-Profile"]="mira";headers.Prefer="return=representation";}
    const response=await fetch(DATA_API+"/"+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null;}catch{}
    if(!response.ok)throw new Error(data?.message||"No fue posible completar la operación (HTTP "+response.status+").");
    return data;
  }
  function showNotice(message,error=false){
    const n=$("citizenReportNotice");if(!n)return;n.textContent=message;n.classList.remove("hidden");
    n.style.borderColor=error?"rgba(248,113,113,.55)":"rgba(45,212,191,.4)";
  }
  function setContext(){returnContext=$("landing-hero-overlay")?.style.display==="none"?"platform":"landing";}
  function openPublic(){
    setContext();$("landing-hero-overlay").style.display="none";$("landingHeaderControls").style.display="none";
    $("citizenReportWorkspace").classList.remove("hidden");$("citizenReportNotice").classList.add("hidden");
  }
  function closePublic(){
    $("citizenReportWorkspace").classList.add("hidden");
    if(returnContext==="platform"){$("landing-hero-overlay").style.display="none";$("landingHeaderControls").style.display="none";}
    else{$("landing-hero-overlay").style.display="flex";$("landingHeaderControls").style.display="flex";}
  }
  async function submit(event){
    event.preventDefault();if(busy)return;busy=true;const button=$("citizenReportSend");button.disabled=true;
    try{
      await request("reportes_ciudadanos",{method:"POST",anonymous:true,body:{
        categoria:$("citizenReportCategory").value,sector:$("citizenReportSector").value.trim(),
        ubicacion:$("citizenReportLocation").value.trim(),descripcion:$("citizenReportDescription").value.trim()
      }});
      $("citizenReportForm").reset();showNotice("Reporte recibido. Gracias por compartir la situación. El equipo autorizado podrá revisarlo.");
    }catch(error){showNotice(error.message||"No fue posible enviar el reporte. Intenta nuevamente.",true);}
    finally{busy=false;button.disabled=false;}
  }
  function isAdmin(){return window.MIRA_CURRENT_USER?.role==="admin"&&window.MIRA_CURRENT_USER?.authUserId===ADMIN_ID;}
  async function loadInternal(){
    if(!window.MIRA_CURRENT_USER?.authUserId)throw new Error("Inicia sesión para consultar esta bandeja.");
    if(!isAdmin()){
      const permissions=await request("module_permissions?select=module_key,action_key,allowed&limit=500");
      if(!permissions.some(p=>p.module_key==="concejal"&&p.action_key==="view"&&p.allowed===true))throw new Error("Tu cuenta no tiene permiso de consulta en Concejal.");
    }
    records=await request("reportes_ciudadanos?select=id,categoria,sector,ubicacion,descripcion,estado,created_at&order=created_at.desc&limit=500");
    renderInternal();
  }
  function renderInternal(){
    const root=$("citizenReportsAdminList");if(!root)return;
    if(!records.length){root.innerHTML='<p class="pqrs-empty">No hay reportes ciudadanos recibidos.</p>';return;}
    root.innerHTML=records.map(r=>'<article class="pqrs-record"><div class="pqrs-record-head"><div><span class="pqrs-type-tag">'+esc(categories[r.categoria]||r.categoria)+'</span><h3>'+esc(r.sector)+'</h3></div><span class="pqrs-record-meta">'+esc(date(r.created_at))+'</span></div><p class="pqrs-record-meta">Ubicación: '+esc(r.ubicacion)+'</p><p class="pqrs-record-description">'+esc(r.descripcion)+'</p><div class="pqrs-record-actions"><label>Estado<select data-report-status="'+esc(r.id)+'"><option value="recibido" '+(r.estado==="recibido"?"selected":"")+'>Recibido</option><option value="en_revision" '+(r.estado==="en_revision"?"selected":"")+'>En revisión</option><option value="gestionado" '+(r.estado==="gestionado"?"selected":"")+'>Gestionado</option><option value="cerrado" '+(r.estado==="cerrado"?"selected":"")+'>Cerrado</option></select></label></div></article>').join("");
    root.querySelectorAll("[data-report-status]").forEach(select=>select.addEventListener("change",async()=>{
      select.disabled=true;try{await request("reportes_ciudadanos?id=eq."+encodeURIComponent(select.dataset.reportStatus),{method:"PATCH",body:{estado:select.value,updated_at:new Date().toISOString()}});const row=records.find(x=>x.id===select.dataset.reportStatus);if(row)row.estado=select.value;}
      catch(error){alert(error.message||"No se pudo actualizar el estado.");select.value=records.find(x=>x.id===select.dataset.reportStatus)?.estado||"recibido";}
      finally{select.disabled=false;}
    }));
  }
  function openInternal(){
    setContext();$("landing-hero-overlay").style.display="none";$("landingHeaderControls").style.display="none";
    let panel=$("citizenReportsAdminWorkspace");
    if(!panel){panel=document.createElement("section");panel.id="citizenReportsAdminWorkspace";panel.className="activities-workspace pqrs-workspace";panel.innerHTML='<header class="activities-header"><div><div class="brand-pill">CENTRO DE OPERACIONES · CONCEJAL</div><h1><span class="hero-title-cyan">Reportes ciudadanos</span></h1><p>Consulta y seguimiento de reportes recibidos.</p></div><button class="top-control-btn" id="closeCitizenReportsAdmin" type="button">✕</button></header><div id="citizenReportsAdminList" class="activity-view"></div><footer class="activities-footer"><button id="refreshCitizenReportsAdmin" class="activity-secondary-btn" type="button">↻ Actualizar</button><button id="returnCitizenReportsAdmin" class="activity-secondary-btn" type="button">← Volver</button></footer>';document.body.appendChild(panel);
      $("closeCitizenReportsAdmin").addEventListener("click",()=>{panel.classList.add("hidden");$("landing-hero-overlay").style.display="none";});
      $("returnCitizenReportsAdmin").addEventListener("click",()=>{panel.classList.add("hidden");});
      $("refreshCitizenReportsAdmin").addEventListener("click",()=>loadInternal().catch(e=>{$("citizenReportsAdminList").textContent=e.message;}));
    }
    panel.classList.remove("hidden");loadInternal().catch(e=>{$("citizenReportsAdminList").textContent=e.message;});
  }
  document.addEventListener("DOMContentLoaded",()=>{
    $("btnSelectReportes")?.addEventListener("click",openPublic);
    $("btnSelectReportes")?.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openPublic();}});
    $("closeCitizenReport")?.addEventListener("click",closePublic);
    $("returnFromCitizenReport")?.addEventListener("click",closePublic);
    $("citizenReportForm")?.addEventListener("submit",submit);
    $("openCitizenReportsBtn")?.addEventListener("click",openInternal);
  });
})();
