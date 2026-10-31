// MIRA — puente del módulo Actividades al CRUD remoto de Neon.
// Intercepta los controles existentes para evitar que guarden datos reales en localStorage.
(() => {
  let activities=[], people=[], attendances=[], editingAttendance=null;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const ced=v=>String(v??"").replace(/\D/g,"");
  const dateNow=()=>new Date().toISOString();
  const active=a=>a.estado==="activa";
  function message(text){const n=$("duplicateNotice");if(n){n.textContent=text;n.classList.remove("hidden");}}
  function activityName(id){return activities.find(x=>x.id===id)?.nombre||"—";}
  function personName(id){const p=people.find(x=>x.id===id);return p?[p.nombres,p.apellidos].filter(Boolean).join(" "):"";}
  async function reload(){
    const [a,p,t]=await Promise.all([MIRA_DATA.listActivities(),MIRA_DATA.listPeople({limit:100}),MIRA_DATA.listAttendances({limit:100})]);
    activities=a||[];people=p||[];attendances=t||[];
    render();
  }
  function render(){
    const select=$("participantActivity"),selected=select?.value;
    if(select){select.innerHTML='<option value="">Seleccionar actividad…</option>'+activities.slice().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).map(a=>'<option value="'+esc(a.id)+'">'+esc(a.nombre)+(active(a)?' · En curso':'')+'</option>').join("");if(selected&&activities.some(a=>a.id===selected))select.value=selected;else if(activities.find(active))select.value=activities.find(active).id;}
    const folders=$("activitiesFolders");
    if(folders){folders.innerHTML=activities.length?activities.slice().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).map(a=>{
      const count=attendances.filter(x=>x.actividad_id===a.id).length;
      return '<article class="activity-folder"><div class="folder-icon">📁</div><h3>'+esc(a.nombre)+'</h3><p>'+esc(a.fecha)+' · '+count+' registros</p><div class="activity-folder-actions"><button class="activity-row-btn" data-remote-open="'+a.id+'" type="button">📂 Abrir</button></div></article><button class="activity-file-card" data-remote-export="'+a.id+'" type="button"><span class="file-icon">📊</span><strong>'+esc(a.nombre)+'.xlsx</strong><small>'+count+' registros</small><span class="file-type">EXCEL · DESCARGAR</span></button>';
    }).join(""):'<div class="activity-empty-drive"><div>📂</div><h3>Aún no hay actividades</h3><p>Crea una actividad para que aparezca aquí su carpeta.</p></div>';}
    const body=$("activityParticipantsBody"),search=norm($("activitySearch")?.value||"");
    const rows=attendances.map(a=>({a,p:people.find(p=>p.id===a.persona_id)||{},act:activities.find(x=>x.id===a.actividad_id)||{}})).filter(x=>!search||norm([x.p.nombres,x.p.apellidos,x.p.cedula,x.act.nombre].join(" ")).includes(search)).sort((x,y)=>new Date(y.a.fecha_registro)-new Date(x.a.fecha_registro));
    if(body){const recent=rows.slice(0,10);body.innerHTML=recent.length?recent.map(({a,p,act})=>'<tr><td>'+esc((p.nombres||"")+" "+(p.apellidos||""))+'</td><td>'+esc(p.cedula||"")+'</td><td>'+esc(act.nombre||"—")+'</td><td>'+(p.info_mira===true?"Sí":"No")+'</td><td>'+esc(a.fecha_registro?new Date(a.fecha_registro).toLocaleString("es-CO"):"")+'</td><td><button class="activity-row-btn" data-remote-edit="'+a.id+'" type="button">Editar</button></td></tr>').join(""):'<tr><td colspan="6">No hay registros remotos.</td></tr>';}
    const count=$("liveActivityCount");if(count)count.textContent="Mostrando "+Math.min(rows.length,10)+" de "+rows.length+" registros remotos";
    if($("sideActivityPeople"))$("sideActivityPeople").textContent=people.length;
    if($("sideActivityAttendances"))$("sideActivityAttendances").textContent=attendances.length;
    if($("sideActivityCount"))$("sideActivityCount").textContent=activities.length+" actividades en Neon";
  }
  async function createActivity(){
    const name=$("activityName")?.value.trim(),date=$("activityDate")?.value||new Date().toISOString().slice(0,10),place=$("activityPlace")?.value.trim();
    if(!name)throw new Error("Escribe el nombre de la actividad.");
    await MIRA_DATA.createActivity({nombre:name,fecha:date,lugar:place||null,estado:"activa"});
    if($("newActivityForm"))$("newActivityForm").classList.add("hidden");
    ["activityName","activityDate","activityPlace"].forEach(id=>{if($(id))$(id).value="";});
    await reload();
  }
  async function lookup(){
    const number=ced($("participantCedula")?.value);
    if(!number){message("Introduce una cédula para buscar.");return;}
    const result=await MIRA_DATA.listPeople({cedula:number,limit:1}),p=result?.[0];
    if(!p){message("No se encontró esa cédula. Completa los datos para crear la ficha.");return;}
    $("participantNames").value=p.nombres||"";$("participantSurnames").value=p.apellidos||"";$("participantPhone").value=p.telefono||"";$("participantInfoMira").value=p.info_mira?"si":"no";
    message("Ficha encontrada en Neon. Se cargaron los datos existentes.");
  }
  async function saveAttendance(){
    const activityId=$("participantActivity")?.value,number=ced($("participantCedula")?.value);
    const names=$("participantNames")?.value.trim(),surnames=$("participantSurnames")?.value.trim();
    const phone=$("participantPhone")?.value.trim(),info=$("participantInfoMira")?.value;
    if(!activityId||!number||!names||!surnames||!info)throw new Error("Completa actividad, cédula, nombres, apellidos e InfoMIRA.");
    let person=(await MIRA_DATA.listPeople({cedula:number,limit:1}))?.[0];
    const personPayload={cedula:number,nombres:names,apellidos:surnames,telefono:phone||null,info_mira:info==="si"};
    if(person){await MIRA_DATA.updatePerson(person.id,personPayload);}
    else {const created=await MIRA_DATA.createPerson(personPayload);person=Array.isArray(created)?created[0]:created;}
    if(!person?.id){person=(await MIRA_DATA.listPeople({cedula:number,limit:1}))?.[0];}
    if(!person?.id)throw new Error("No fue posible recuperar la ficha de la persona.");
    if(editingAttendance){
      await MIRA_DATA.updateAttendance(editingAttendance,{persona_id:person.id,actividad_id:activityId});
      editingAttendance=null;
    } else {
      const exists=attendances.find(x=>x.persona_id===person.id&&x.actividad_id===activityId);
      if(exists)throw new Error("Esta persona ya tiene una asistencia en esta actividad.");
      await MIRA_DATA.createAttendance({persona_id:person.id,actividad_id:activityId});
    }
    ["participantCedula","participantNames","participantSurnames","participantPhone"].forEach(id=>{if($(id))$(id).value="";});
    if($("participantInfoMira"))$("participantInfoMira").value="";
    if($("saveParticipantBtn"))$("saveParticipantBtn").textContent="Guardar asistencia";
    message("Registro guardado correctamente en Neon.");
    await reload();
  }
  async function openFolder(id){
    const activity=activities.find(x=>x.id===id);if(!activity)return;
    if($("activityDetailTitle"))$("activityDetailTitle").textContent=activity.nombre;
    if($("activityDetailMeta"))$("activityDetailMeta").textContent=[activity.fecha,activity.lugar,attendances.filter(x=>x.actividad_id===id).length+" registros"].filter(Boolean).join(" · ");
    const body=$("activityDetailBody");
    if(body){const rows=attendances.filter(x=>x.actividad_id===id).map(a=>({a,p:people.find(p=>p.id===a.persona_id)||{}}));body.innerHTML=rows.length?rows.map(({a,p})=>'<tr><td>'+esc((p.nombres||"")+" "+(p.apellidos||""))+'</td><td>'+esc(p.cedula||"")+'</td><td>'+esc(p.telefono||"—")+'</td><td>'+(p.info_mira?"Sí":"No")+'</td><td>'+esc(a.fecha_registro?new Date(a.fecha_registro).toLocaleString("es-CO"):"")+'</td></tr>').join(""):'<tr><td colspan="5">Esta actividad aún no tiene registros.</td></tr>';}
    window.showActivityView?.("detail");
  }
  function exportActivity(id){
    if(!window.XLSX){alert("No se pudo cargar Excel.");return;}
    const rows=attendances.filter(x=>x.actividad_id===id).map(a=>{const p=people.find(x=>x.id===a.persona_id)||{},act=activities.find(x=>x.id===id)||{};return {Actividad:act.nombre,Fecha:act.fecha,Cedula:p.cedula,Nombres:p.nombres,Apellidos:p.apellidos,Telefono:p.telefono,InfoMIRA:p.info_mira?"Sí":"No",Registro:a.fecha_registro};});
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Asistencias");XLSX.writeFile(wb,"MIRA_"+id+".xlsx");
  }
  document.addEventListener("click",async e=>{
    const button=e.target.closest("button");if(!button)return;
    const id=button.id;
    const action=id==="saveActivityBtn"?"activity":id==="lookupParticipantBtn"?"lookup":id==="saveParticipantBtn"?"attendance":button.dataset.remoteOpen?"open":button.dataset.remoteEdit?"edit":button.dataset.remoteExport?"export":null;
    if(!action)return;
    e.preventDefault();e.stopImmediatePropagation();
    try{
      if(action==="activity")await createActivity();
      if(action==="lookup")await lookup();
      if(action==="attendance")await saveAttendance();
      if(action==="open")await openFolder(button.dataset.remoteOpen);
      if(action==="edit"){
        const a=attendances.find(x=>x.id===button.dataset.remoteEdit),p=a&&people.find(x=>x.id===a.persona_id);if(!a||!p)return;
        editingAttendance=a.id;$("participantCedula").value=p.cedula;$("participantNames").value=p.nombres;$("participantSurnames").value=p.apellidos;$("participantPhone").value=p.telefono||"";$("participantInfoMira").value=p.info_mira?"si":"no";$("participantActivity").value=a.actividad_id;$("saveParticipantBtn").textContent="Guardar rectificación";window.showActivityView?.("registration");
      }
      if(action==="export")exportActivity(button.dataset.remoteExport);
    }catch(err){alert(err?.message||"No fue posible completar la operación en Neon.");}
  },true);
  document.addEventListener("input",e=>{if(e.target?.id==="activitySearch")render();});
  window.addEventListener("mira:authenticated",()=>reload().catch(err=>{console.error("[MIRA Neon]",err);alert("No se pudieron cargar los registros desde Neon: "+err.message);}));
  window.MIRA_ACTIVITY_RELOAD=reload;
})();
