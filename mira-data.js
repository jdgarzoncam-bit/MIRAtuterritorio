// MIRA TU TERRITORIO — cliente REST de Neon Data API
// No contiene contraseñas ni cadenas de conexión. Los permisos se aplican en PostgreSQL RLS.
const MIRA_DATA_API_URL = "https://ep-lucky-smoke-b73q7rl0.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1";

async function miraToken({anonymous=false}={}) {
  const auth = window.MIRA_AUTH;
  if (!auth) throw new Error("El servicio de autenticación aún no está inicializado.");
  const result = anonymous ? await auth.getAnonymousToken() : await auth.token();
  if (result?.error) throw new Error(result.error.message || "No fue posible obtener el token.");
  const token = result?.data?.token;
  if (!token) throw new Error("No se recibió un token válido.");
  return token;
}

async function miraRequest(table, {method="GET", query="", body, anonymous=false}={}) {
  const token = await miraToken({anonymous});
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    "Accept-Profile": "mira",
    "Content-Profile": "mira",
    Accept: "application/json"
  });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (method !== "GET") headers.set("Prefer", "return=representation");
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
  async listPeople({cedula="", search="", limit=100}={}) {
    const params = {select:"*",order:"updated_at.desc",limit:String(Math.min(Math.max(limit,1),100))};
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
    return miraRequest("personas",{method:"POST",body:{...payload,cedula}});
  },
  updatePerson(id,payload) { return miraRequest("personas",{method:"PATCH",query:qs({id:`eq.${id}`}),body:payload}); },
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
    const params={select:"*",order:"fecha_registro.desc",limit:String(Math.min(Math.max(limit,1),100))};
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
  submitPublicReport(payload) {
    const allowed={puesto_votacion:String(payload.puesto_votacion||"").trim(),mesa_votacion:String(payload.mesa_votacion||"").trim(),tipo_reporte:payload.tipo_reporte,descripcion:String(payload.descripcion||"").trim()};
    if(allowed.puesto_votacion.length<3 || allowed.mesa_votacion.length<1 || allowed.descripcion.length<5) throw new Error("Completa puesto, mesa y descripción.");
    return miraRequest("reportes_operativos",{method:"POST",body:allowed,anonymous:true});
  }
};
window.MIRA_DATA = MIRA_DATA;
