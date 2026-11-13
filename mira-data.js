// MIRA TU TERRITORIO — cliente REST de Neon Data API
// No contiene contraseñas ni cadenas de conexión. Los permisos se aplican en PostgreSQL RLS.
const MIRA_DATA_API_URL = "https://ep-mute-grass-b7qan4n6.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1";

async function miraToken({anonymous=false}={}) {
  const auth = window.MIRA_AUTH;
  if (!auth) throw new Error("El servicio de autenticación aún no está inicializado.");
  const result = anonymous ? await auth.getAnonymousToken() : await auth.token();
  if (result?.error) throw new Error(result.error.message || "No fue posible obtener el token.");
  const token = result?.data?.token;
  if (!token) throw new Error("No se recibió un token válido.");
  return token;
}

async function miraRequest(table, {method="GET", query="", body, anonymous=false, prefer, requireRows=false}={}) {
  const token = await miraToken({anonymous});
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    "Accept-Profile": "mira",
    Accept: "application/json"
  });
  if (method !== "GET") headers.set("Content-Profile", "mira");
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (method !== "GET") headers.set("Prefer", prefer || "return=representation");
  const response = await fetch(`${MIRA_DATA_API_URL}/${table}${query ? `?${query}` : ""}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.details || data?.hint || `Error HTTP ${response.status}`;
    throw new Error(message);
  }
  if (requireRows && (!Array.isArray(data) || data.length !== 1)) {
    throw new Error("La base de datos no confirmó el cambio. No se actualizará la interfaz.");
  }
  return data;
}

const qs = (params) => new URLSearchParams(params).toString();
const cleanCedula = (value) => String(value || "").replace(/\D/g, "");

function assertTestigosEnabled() {
  if (window.MIRA_TESTIGOS_TEMP_DISABLED !== false) {
    throw new Error("El módulo Testigos / Auditoría E-14 está temporalmente inactivo.");
  }
}

const EXPLORER_DATASETS = Object.freeze([
  {key:"personas",label:"Personas",table:"personas",module:"personas",select:"id,cedula,nombres,apellidos,telefono,correo,barrio,puesto_votacion,mesa_votacion,activo,datos_pendientes,created_at,updated_at",search:["cedula","nombres","apellidos","barrio"],columns:[["cedula","Cédula"],["nombres","Nombres"],["apellidos","Apellidos"],["telefono","Teléfono"],["correo","Correo"],["barrio","Barrio"],["activo","Estado"],["datos_pendientes","Datos pendientes"]]},
  {key:"actividades",label:"Actividades",table:"actividades",module:"actividades",select:"id,nombre,fecha,lugar,estado,created_at",search:["nombre","lugar","estado"],columns:[["nombre","Actividad"],["fecha","Fecha"],["lugar","Lugar"],["estado","Estado"],["created_at","Creación"]]},
  {key:"asistencias",label:"Asistencias",table:"asistencias",module:"actividades",select:"id,persona_id,actividad_id,fecha_registro,estado,motivo_anulacion",search:["estado","motivo_anulacion"],columns:[["persona_id","Persona ID"],["actividad_id","Actividad ID"],["fecha_registro","Fecha de registro"],["estado","Estado"],["motivo_anulacion","Motivo de anulación"]]},
  {key:"pqrs",label:"PQRS",table:"pqrs",module:"pqrs",select:"id,tipo,modulo_key,asunto,descripcion,estado,created_at,updated_at",search:["tipo","modulo_key","asunto","descripcion","estado"],columns:[["tipo","Tipo"],["modulo_key","Módulo"],["asunto","Asunto"],["descripcion","Descripción"],["estado","Estado"],["created_at","Radicación"]]},
  {key:"reportes_ciudadanos",label:"Reportes ciudadanos",table:"reportes_ciudadanos",module:"concejal",select:"id,categoria,sector,ubicacion,descripcion,estado,created_at,updated_at",search:["categoria","sector","ubicacion","descripcion","estado"],columns:[["categoria","Categoría"],["sector","Sector"],["ubicacion","Ubicación"],["descripcion","Descripción"],["estado","Estado"],["created_at","Creación"]]},
  {key:"concejal_actividades",label:"Gestión territorial · Actividades",table:"concejal_actividades",module:"concejal",select:"id,barrio,descripcion,fecha,created_at,updated_at",search:["barrio","descripcion"],columns:[["barrio","Barrio"],["descripcion","Descripción"],["fecha","Fecha"],["created_at","Creación"]]},
  {key:"concejal_compromisos",label:"Gestión territorial · Compromisos",table:"concejal_compromisos",module:"concejal",select:"id,barrio,compromiso,adquirido_con,fecha,fecha_limite,estado,resultado,logrado,created_at,updated_at",search:["barrio","compromiso","adquirido_con","estado","resultado"],columns:[["barrio","Barrio"],["compromiso","Compromiso"],["adquirido_con","Adquirido con"],["fecha","Fecha"],["fecha_limite","Fecha límite"],["estado","Estado"],["logrado","Logrado"]]},
  {key:"infomira_red",label:"InfoMIRA · Red",table:"infomira_red",module:"infomira",select:"id,nombre_original,barrio,estado_original,cuidador_nombre,puesto_votacion,mesa_votacion,movilidad,asistencia,created_at",search:["nombre_original","barrio","estado_original","cuidador_nombre","puesto_votacion"],columns:[["nombre_original","Nombre"],["barrio","Barrio"],["estado_original","Estado"],["cuidador_nombre","Cuidador / líder"],["puesto_votacion","Puesto"],["mesa_votacion","Mesa"],["movilidad","Movilidad"],["asistencia","Asistencia"]]}
]);
function getExplorerDataset(key){return EXPLORER_DATASETS.find(item=>item.key===key)||null;}
export const MIRA_DATA = {
  getExplorerDatasets() { return EXPLORER_DATASETS.map(({key,label,module,columns})=>({key,label,module,columns})); },
  async listExplorerRows({datasetKey,search="",filterField="",filterValue="",limit=25,offset=0}={}) {
    const dataset=getExplorerDataset(datasetKey);
    if(!dataset) throw new Error("Conjunto de datos no autorizado para el explorador.");
    const safeLimit=Math.min(Math.max(Number(limit)||25,1),100);
    const params={select:dataset.select,order:"created_at.desc",limit:String(safeLimit),offset:String(Math.max(0,Number(offset)||0))};
    const term=String(search||"").trim().replace(/[,*()]/g," ").slice(0,80);
    if(term){
      const clauses=dataset.search.map(column=>column+".ilike.*"+term+"*");
      params.or="("+clauses.join(",")+")";
    }
    if(filterField&&filterValue!==undefined&&String(filterValue).trim()){
      const allowedFields=new Set(dataset.columns.map(column=>column[0]));
      if(!allowedFields.has(filterField)) throw new Error("El campo de filtro no está permitido para este conjunto.");
      const value=String(filterValue).trim().replace(/[,*()]/g," ").slice(0,100);
      params[filterField]="eq."+value;
    }
    return miraRequest(dataset.table,{query:qs(params)});
  },

  async listInfoMiraDirectory({cedula="", search="", limit=100, offset=0}={}) {
    const params = {
      select:"id,fila_origen,cedula_original,nombre_original,telefono,barrio,estado_original,cuidador_nombre,puesto_votacion,puesto_original,mesa_votacion,movilidad,asistencia,persona_id,personas(id,cedula,nombres,apellidos,telefono,correo,info_mira,puesto_votacion,mesa_votacion,requiere_transporte,edad,tipo_participacion,activo)",
      order:"fila_origen.asc",
      limit:String(Math.min(Math.max(limit,1),100)),
      offset:String(Math.max(0,Number(offset)||0))
    };
    if (cedula) params.cedula_original = `eq.${cleanCedula(cedula)}`;
    else if (search.trim()) {
      const term = search.trim().replace(/[,*()]/g," ");
      params.or = `(nombre_original.ilike.*${term}*,cuidador_nombre.ilike.*${term}*,cedula_original.eq.${cleanCedula(term) || term})`;
    }
    return miraRequest("infomira_red",{query:qs(params)});
  },
  async listPeople({cedula="", search="", limit=100, offset=0, tipoParticipacion=""}={}) {
    const params = {select:"id,cedula,cedula_normalizada,nombres,apellidos,telefono,correo,info_mira,barrio,puesto_votacion,mesa_votacion,requiere_transporte,edad,tipo_participacion,observaciones,activo,datos_pendientes,fuente_registro,created_at,updated_at",order:"updated_at.desc",limit:String(Math.min(Math.max(limit,1),1000)),offset:String(Math.max(0,Number(offset)||0))};
    if (tipoParticipacion) params.tipo_participacion = `eq.${tipoParticipacion}`;
    if (cedula) params.cedula_normalizada = `eq.${cleanCedula(cedula)}`;
    else if (search.trim()) {
      const term = search.trim().replace(/[,*()]/g," ");
      params.or = `(nombres.ilike.*${term}*,apellidos.ilike.*${term}*)`;
    }
    return miraRequest("personas",{query:qs(params)});
  },
  createPerson(payload) {
    const cedula=cleanCedula(payload.cedula);
    if (!cedula || !payload.nombres?.trim() || !payload.apellidos?.trim()) throw new Error("Cédula, nombres y apellidos son obligatorios.");
    const {cedula_normalizada, ...personData} = payload;
    const missingFollowup=!String(payload.telefono||"").trim()||!String(payload.barrio||"").trim();
    return miraRequest("personas",{method:"POST",body:{...personData,cedula,datos_pendientes:missingFollowup}});
  },
  updatePerson(id,payload) { const {cedula_normalizada, ...personData} = payload; const cedula=personData.cedula===undefined?undefined:cleanCedula(personData.cedula); return miraRequest("personas",{method:"PATCH",query:qs({id:`eq.${id}`}),body:{...personData,...(cedula!==undefined?{cedula}:{})}}); },
  archivePerson(id) { return this.updatePerson(id,{activo:false}); },
  async listActivities({limit=100,offset=0}={}) {
    return miraRequest("actividades",{query:qs({select:"*",order:"fecha.desc",limit:String(Math.min(Math.max(limit,1),1000)),offset:String(Math.max(0,Number(offset)||0))})});
  },
  createActivity(payload) {
    if (!payload.nombre?.trim() || !payload.fecha) throw new Error("Nombre y fecha son obligatorios.");
    return miraRequest("rpc/create_activity_atomic",{
      method:"POST",
      body:{
        p_nombre:payload.nombre.trim(),
        p_fecha:payload.fecha,
        p_lugar:payload.lugar||null,
        p_creado_por:payload.creado_por||null
      },
      requireRows:true
    });
  },
  updateActivity(id,payload) { return miraRequest("actividades",{method:"PATCH",query:qs({id:`eq.${id}`}),body:payload}); },
  cancelActivity(id) { return this.updateActivity(id,{estado:"cancelada"}); },
  deleteActivity(id) { if(!id) throw new Error("Identificador de actividad no válido."); return miraRequest("actividades",{method:"DELETE",query:qs({id:`eq.${id}`}),prefer:"return=representation",requireRows:true}); },
  async listAttendances({activityId,limit=100,offset=0}={}) {
    const params={select:"*",order:"fecha_registro.desc",limit:String(Math.min(Math.max(limit,1),1000)),offset:String(Math.max(0,Number(offset)||0))};
    if(activityId) params.actividad_id=`eq.${activityId}`;
    return miraRequest("asistencias",{query:qs(params)});
  },
  createAttendance(payload) {
    if (!payload.persona_id || !payload.actividad_id) throw new Error("Selecciona una persona y una actividad.");
    return miraRequest("asistencias",{method:"POST",body:payload});
  },
  updateAttendance(id,payload) { return miraRequest("asistencias",{method:"PATCH",query:qs({id:`eq.${id}`}),body:payload}); },
  deleteAttendance(id) { return miraRequest("asistencias",{method:"DELETE",query:qs({id:`eq.${id}`}),prefer:"return=representation",requireRows:true}); },
  annulAttendance(id,reason) { if(!id||!reason?.trim()) throw new Error("Selecciona la asistencia e indica el motivo."); return miraRequest("rpc/annul_attendance",{method:"POST",body:{p_attendance_id:id,p_reason:reason.trim()},requireRows:true}); },
  async listPeopleAudit({personaId,limit=100,offset=0}={}) { const params={select:"*",order:"created_at.desc",limit:String(Math.min(Math.max(limit,1),500)),offset:String(Math.max(0,Number(offset)||0))}; if(personaId) params.persona_id=`eq.${personaId}`; return miraRequest("personas_change_audit",{query:qs(params)}); },
  async listAttendanceAudit({attendanceId,limit=100,offset=0}={}) { const params={select:"*",order:"created_at.desc",limit:String(Math.min(Math.max(limit,1),500)),offset:String(Math.max(0,Number(offset)||0))}; if(attendanceId) params.asistencia_id=`eq.${attendanceId}`; return miraRequest("asistencias_change_audit",{query:qs(params)}); },
  async listActivitiesAudit({activityId,limit=100,offset=0}={}) { const params={select:"*",order:"created_at.desc",limit:String(Math.min(Math.max(limit,1),500)),offset:String(Math.max(0,Number(offset)||0))}; if(activityId) params.actividad_id=`eq.${activityId}`; return miraRequest("actividades_change_audit",{query:qs(params)}); },
  async listPublicWitnesses({limit=100}={}) {
    assertTestigosEnabled();
    return miraRequest("testigos_publicos",{query:qs({select:"*",order:"created_at.desc",limit:String(Math.min(Math.max(limit,1),100))})});
  },
  updatePublicWitness(id,payload) {
    assertTestigosEnabled();
    return miraRequest("testigos_publicos",{method:"PATCH",query:qs({id:`eq.${id}`}),body:payload});
  },
  async listConcejalActivities({limit=500}={}) {
    return miraRequest("concejal_actividades",{query:qs({select:"*",order:"fecha.desc,created_at.desc",limit:String(Math.min(Math.max(limit,1),500))})});
  },
  createConcejalActivity(payload) {
    if(!payload.barrio?.trim()||!payload.descripcion?.trim()||!payload.fecha) throw new Error("Barrio, descripción y fecha son obligatorios.");
    return miraRequest("concejal_actividades",{method:"POST",body:payload});
  },
  updateConcejalActivity(id,payload) { return miraRequest("concejal_actividades",{method:"PATCH",query:qs({id:`eq.${id}`}),body:payload}); },
  deleteConcejalActivity(id) { return miraRequest("concejal_actividades",{method:"DELETE",query:qs({id:`eq.${id}`})}); },
  async listConcejalCommitments({limit=500}={}) {
    return miraRequest("concejal_compromisos",{query:qs({select:"*",order:"fecha.desc,created_at.desc",limit:String(Math.min(Math.max(limit,1),500))})});
  },
  createConcejalCommitment(payload) {
    if(!payload.barrio?.trim()||!payload.compromiso?.trim()||!payload.adquirido_con?.trim()||!payload.fecha) throw new Error("Completa barrio, compromiso, con quién y fecha.");
    return miraRequest("concejal_compromisos",{method:"POST",body:payload});
  },
  updateConcejalCommitment(id,payload) { return miraRequest("concejal_compromisos",{method:"PATCH",query:qs({id:`eq.${id}`}),body:payload}); },
  deleteConcejalCommitment(id) { return miraRequest("concejal_compromisos",{method:"DELETE",query:qs({id:`eq.${id}`})}); },
  async listWitnessFiles({witnessId,limit=100}={}) {
    assertTestigosEnabled();
    const params={select:"*",order:"created_at.desc",limit:String(Math.min(Math.max(limit,1),100))};
    if(witnessId) params.testigo_id=`eq.${witnessId}`;
    return miraRequest("testigo_archivos",{query:qs(params)});
  },
  async listUserProfiles() {
    return miraRequest("user_profiles",{query:qs({select:"id,auth_user_id,email,display_name,role,active,email_verified,created_at",order:"created_at.asc",limit:"500"})});
  },
  updateUserProfile(profileId, changes) {
    const allowed = {};
    if (typeof changes.active === "boolean") allowed.active = changes.active;
    if (["operator","viewer"].includes(changes.role)) allowed.role = changes.role;
    if (!Object.keys(allowed).length) throw new Error("No hay cambios de perfil válidos.");
    return miraRequest("user_profiles",{method:"PATCH",query:qs({id:"eq."+profileId}),body:allowed,prefer:"return=representation",requireRows:true});
  },
  async listModuleCatalog() {
    return miraRequest("module_catalog",{query:qs({select:"module_key,module_name,description,sort_order,active",active:"eq.true",order:"sort_order.asc"})});
  },
  async listModulePermissions(profileId) {
    return miraRequest("module_permissions",{query:qs({select:"id,user_profile_id,module_key,action_key,allowed",user_profile_id:"eq."+profileId,limit:"500"})});
  },
  async listAllModulePermissions() {
    return miraRequest("module_permissions",{query:qs({select:"user_profile_id,module_key,action_key,allowed",limit:"1000"})});
  },
  async listMyModulePermissions() {
    return miraRequest("module_permissions",{query:qs({select:"module_key,action_key,allowed",limit:"500"})});
  },
  setModulePermission(profileId,moduleKey,actionKey,allowed) {
    return miraRequest("module_permissions",{method:"POST",query:qs({on_conflict:"user_profile_id,module_key,action_key"}),prefer:"resolution=merge-duplicates,return=representation",requireRows:true,body:{user_profile_id:profileId,module_key:moduleKey,action_key:actionKey,allowed:Boolean(allowed)}});
  },

  async listPQRS({tipo="",limit=500}={}) {
    const params={select:"id,tipo,modulo_key,asunto,descripcion,estado,created_by,created_at,updated_at",order:"created_at.desc",limit:String(Math.min(Math.max(limit,1),1000))};
    if(tipo) params.tipo="eq."+tipo;
    return miraRequest("pqrs",{query:qs(params)});
  },
  createPQRS(payload) {
    if(!["peticion","queja","reclamo","sugerencia"].includes(payload.tipo)) throw new Error("Selecciona un tipo de PQRS válido.");
    if(!payload.asunto?.trim()||payload.asunto.trim().length<4||!payload.descripcion?.trim()||payload.descripcion.trim().length<10) throw new Error("Completa el asunto y la descripción.");
    return miraRequest("pqrs",{method:"POST",anonymous:true,prefer:"return=minimal",body:{tipo:payload.tipo,modulo_key:"pqrs",asunto:payload.asunto.trim(),descripcion:payload.descripcion.trim()}});
  },
  updatePQRS(id,payload) {
    const user=window.MIRA_CURRENT_USER;
    if(user?.role!=="admin"||user?.authUserId!=="beef5bf3-82a8-4c35-a12c-17771be59da1") throw new Error("La consulta delegada de PQRS es de solo lectura. No tienes autorización para modificar solicitudes.");
    const allowed={}; if(["recibida","en_revision","respondida","cerrada"].includes(payload.estado)) allowed.estado=payload.estado;
    if(!Object.keys(allowed).length) throw new Error("No hay cambios válidos para guardar.");
    return miraRequest("pqrs",{method:"PATCH",query:qs({id:"eq."+id}),body:{...allowed,updated_at:new Date().toISOString()}});
  },
  async listAdminAudit({limit=50,offset=0}={}) {
    const safeLimit=Math.min(Math.max(Number(limit)||50,1),51);
    const safeOffset=Math.max(Number(offset)||0,0);
    return miraRequest("admin_audit_log",{query:qs({select:"id,actor_auth_user_id,target_auth_user_id,action_key,details,created_at",order:"created_at.desc,id.desc",limit:String(safeLimit),offset:String(safeOffset)})});
  },
  async e14Request(action, payload={}) {
    assertTestigosEnabled();
    const token=await miraToken();
    const endpoint="https://br-winter-night-b758ke2j-e14secure.compute.c-13.us-east-1.aws.neon.tech/";
    const response=await fetch(endpoint+(action==="list"?"?action=list":""),{
      method:action==="list"?"GET":"POST",
      headers:{Authorization:`Bearer ${token}`,...(action==="list"?{}:{"Content-Type":"application/json"})},
      body:action==="list"?undefined:JSON.stringify({action,...payload}),
      cache:"no-store"
    });
    const text=await response.text(); let data={}; try{data=text?JSON.parse(text):{};}catch{}
    if(!response.ok) {
      const message=String(data.error||data.message||`Servicio E-14: HTTP ${response.status}`);
      if(message.includes("E14_LIMIT_REACHED")) throw new Error("Se alcanzó el máximo seguro de 70 evidencias para esta jornada. La imagen no se registró.");
      throw new Error(message);
    }
    return data;
  },
  async listE14Evidence() {
    assertTestigosEnabled();
    // Consulta la tabla directamente mediante Neon Data API. PostgreSQL RLS
    // exige Testigos · Consulta; evita el listado roto del endpoint e14secure.
    const params = {
      select:"id,puesto,mesa,nota,object_key,nombre_original,mime_type,size_bytes,uploaded_by,created_at,legacy_id,hora_original",
      order:"created_at.desc",
      limit:"100"
    };
    return miraRequest("evidencias_e14",{query:qs(params)});
  },
  async uploadE14Evidence({file,puesto,mesa,nota="",legacy_id=null,hora_original=null}) {
    assertTestigosEnabled();
    if(!(file instanceof Blob)) throw new Error("Selecciona una imagen válida.");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Formato no permitido. Usa JPG, PNG o WebP.");
    if(file.size<1||file.size>12*1024*1024) throw new Error("La imagen debe pesar máximo 12 MB.");
    const signed=await this.e14Request("presign-upload",{puesto,mesa,mime_type:file.type,size_bytes:file.size});
    const uploaded=await fetch(signed.upload_url,{method:"PUT",headers:signed.required_headers,body:file});
    if(!uploaded.ok) throw new Error("Neon Storage rechazó la carga de la imagen.");
    const confirmed=await this.e14Request("confirm-upload",{
      object_key:signed.object_key,puesto,mesa,nota,nombre_original:file.name||"evidencia",mime_type:file.type,size_bytes:file.size,legacy_id,hora_original
    });
    if(!confirmed.item?.id) throw new Error("El archivo se cargó, pero no se confirmó su registro. Conserva el respaldo y solicita revisión.");
    return confirmed.item;
  },
  async getE14Download(id) {
    assertTestigosEnabled();
    const result=await this.e14Request("download",{id});
    if(!result.download_url) throw new Error("No se pudo generar la descarga autorizada.");
    return result;
  }
};
window.MIRA_DATA = MIRA_DATA;
window.dispatchEvent(new Event("mira:data-ready"));
