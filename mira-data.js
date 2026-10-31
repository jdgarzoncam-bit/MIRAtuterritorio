// MIRA TU TERRITORIO — cliente REST de Neon Data API
// No contiene contraseñas ni cadenas de conexión. Los permisos se aplican en PostgreSQL RLS.
const MIRA_DATA_API_URL = "https://ep-round-dawn-b7l3ya3h.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1";

async function miraToken({anonymous=false}={}) {
  const auth = window.MIRA_AUTH;
  if (!auth) throw new Error("El servicio de autenticación aún no está inicializado.");
  const result = anonymous ? await auth.getAnonymousToken() : await auth.token();
  if (result?.error) throw new Error(result.error.message || "No fue posible obtener el token.");
  const token = result?.data?.token;
  if (!token) throw new Error("No se recibió un token válido.");
  return token;
}

async function miraRequest(table, {method="GET", query="", body, anonymous=false, prefer}={}) {
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
  return data;
}

const qs = (params) => new URLSearchParams(params).toString();
const cleanCedula = (value) => String(value || "").replace(/\D/g, "");

export const MIRA_DATA = {
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
  async listPeople({cedula="", search="", limit=100}={}) {
    const params = {select:"id,cedula,cedula_normalizada,nombres,apellidos,telefono,correo,info_mira,puesto_votacion,mesa_votacion,requiere_transporte,edad,tipo_participacion,activo,created_at,updated_at",order:"updated_at.desc",limit:String(Math.min(Math.max(limit,1),1000))};
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
    return miraRequest("personas",{method:"POST",body:{...personData,cedula}});
  },
  updatePerson(id,payload) { const {cedula_normalizada, ...personData} = payload; const cedula=personData.cedula===undefined?undefined:cleanCedula(personData.cedula); return miraRequest("personas",{method:"PATCH",query:qs({id:`eq.${id}`}),body:{...personData,...(cedula!==undefined?{cedula}:{})}}); },
  archivePerson(id) { return this.updatePerson(id,{activo:false}); },
  async listActivities({limit=100}={}) {
    return miraRequest("actividades",{query:qs({select:"*",order:"fecha.desc",limit:String(Math.min(Math.max(limit,1),100))})});
  },
  createActivity(payload) {
    if (!payload.nombre?.trim() || !payload.fecha) throw new Error("Nombre y fecha son obligatorios.");
    return miraRequest("actividades",{method:"POST",body:payload});
  },
  updateActivity(id,payload) { return miraRequest("actividades",{method:"PATCH",query:qs({id:`eq.${id}`}),body:payload}); },
  cancelActivity(id) { return this.updateActivity(id,{estado:"cancelada"}); },
  async listAttendances({activityId,limit=100}={}) {
    const params={select:"*",order:"fecha_registro.desc",limit:String(Math.min(Math.max(limit,1),1000))};
    if(activityId) params.actividad_id=`eq.${activityId}`;
    return miraRequest("asistencias",{query:qs(params)});
  },
  createAttendance(payload) {
    if (!payload.persona_id || !payload.actividad_id) throw new Error("Selecciona una persona y una actividad.");
    return miraRequest("asistencias",{method:"POST",body:payload});
  },
  updateAttendance(id,payload) { return miraRequest("asistencias",{method:"PATCH",query:qs({id:`eq.${id}`}),body:payload}); },
  deleteAttendance(id) { return miraRequest("asistencias",{method:"DELETE",query:qs({id:`eq.${id}`})}); },
  async listOperationalReports({limit=100}={}) {
    return miraRequest("reportes_operativos",{query:qs({select:"*",order:"created_at.desc",limit:String(Math.min(Math.max(limit,1),100))})});
  },
  async listPublicWitnesses({limit=100}={}) {
    return miraRequest("testigos_publicos",{query:qs({select:"*",order:"created_at.desc",limit:String(Math.min(Math.max(limit,1),100))})});
  },
  updatePublicWitness(id,payload) { return miraRequest("testigos_publicos",{method:"PATCH",query:qs({id:`eq.${id}`}),body:payload}); },
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
    const params={select:"*",order:"created_at.desc",limit:String(Math.min(Math.max(limit,1),100))};
    if(witnessId) params.testigo_id=`eq.${witnessId}`;
    return miraRequest("testigo_archivos",{query:qs(params)});
  },
  submitPublicReport(payload) {
    const allowed={puesto_votacion:String(payload.puesto_votacion||"").trim(),mesa_votacion:String(payload.mesa_votacion||"").trim(),tipo_reporte:payload.tipo_reporte,descripcion:String(payload.descripcion||"").trim()};
    if(allowed.puesto_votacion.length<3 || allowed.mesa_votacion.length<1 || allowed.descripcion.length<5) throw new Error("Completa puesto, mesa y descripción.");
    return miraRequest("reportes_operativos",{method:"POST",body:allowed,anonymous:true});
  },
  async listUserProfiles() {
    return miraRequest("user_profiles",{query:qs({select:"id,auth_user_id,email,display_name,role,active,email_verified,created_at",order:"created_at.asc",limit:"500"})});
  },
  updateUserProfile(profileId, changes) {
    const allowed = {};
    if (typeof changes.active === "boolean") allowed.active = changes.active;
    if (["operator","viewer","witness"].includes(changes.role)) allowed.role = changes.role;
    if (!Object.keys(allowed).length) throw new Error("No hay cambios de perfil válidos.");
    return miraRequest("user_profiles",{method:"PATCH",query:qs({id:"eq."+profileId}),body:allowed,prefer:"return=representation"});
  },
  async listModuleCatalog() {
    return miraRequest("module_catalog",{query:qs({select:"module_key,module_name,description,sort_order,active",active:"eq.true",order:"sort_order.asc"})});
  },
  async listModulePermissions(profileId) {
    return miraRequest("module_permissions",{query:qs({select:"id,user_profile_id,module_key,action_key,allowed",user_profile_id:"eq."+profileId,limit:"500"})});
  },
  async listMyModulePermissions() {
    return miraRequest("module_permissions",{query:qs({select:"module_key,action_key,allowed",limit:"500"})});
  },
  setModulePermission(profileId,moduleKey,actionKey,allowed) {
    return miraRequest("module_permissions",{method:"POST",query:qs({on_conflict:"user_profile_id,module_key,action_key"}),prefer:"resolution=merge-duplicates,return=representation",body:{user_profile_id:profileId,module_key:moduleKey,action_key:actionKey,allowed:Boolean(allowed)}});
  },

  async listPQRS({tipo="",limit=500}={}) {
    const params={select:"id,tipo,modulo_key,asunto,descripcion,estado,created_by,created_at,updated_at",order:"created_at.desc",limit:String(Math.min(Math.max(limit,1),1000))};
    if(tipo) params.tipo="eq."+tipo;
    return miraRequest("pqrs",{query:qs(params)});
  },
  createPQRS(payload) {
    if(!["peticion","queja","reclamo","sugerencia"].includes(payload.tipo)) throw new Error("Selecciona un tipo de PQRS válido.");
    if(!payload.modulo_key?.trim()||!payload.asunto?.trim()||payload.asunto.trim().length<4||!payload.descripcion?.trim()||payload.descripcion.trim().length<10) throw new Error("Completa el módulo, asunto y descripción.");
    return miraRequest("pqrs",{method:"POST",body:{tipo:payload.tipo,modulo_key:payload.modulo_key,asunto:payload.asunto.trim(),descripcion:payload.descripcion.trim()}});
  },
  updatePQRS(id,payload) {
    const allowed={}; if(["recibida","en_revision","respondida","cerrada"].includes(payload.estado)) allowed.estado=payload.estado;
    if(!Object.keys(allowed).length) throw new Error("No hay cambios válidos para guardar.");
    return miraRequest("pqrs",{method:"PATCH",query:qs({id:"eq."+id}),body:{...allowed,updated_at:new Date().toISOString()}});
  },
  async listAdminAudit({limit=30}={}) {
    return miraRequest("admin_audit_log",{query:qs({select:"id,actor_auth_user_id,target_auth_user_id,action_key,details,created_at",order:"created_at.desc",limit:String(Math.min(Math.max(limit,1),100))})});
  }
};
window.MIRA_DATA = MIRA_DATA;
window.dispatchEvent(new Event("mira:data-ready"));
