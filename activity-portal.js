import { createAuthClient } from "https://esm.sh/@neondatabase/auth@0.7.0-beta";
import { MIRA_DATA } from "./mira-data.js?v=20261103-activity-auth-2";

const AUTH_URL = "https://ep-mute-grass-b7qan4n6.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth";
const DATA_API_URL = "https://ep-mute-grass-b7qan4n6.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1";
const auth = createAuthClient(AUTH_URL);\nwindow.MIRA_AUTH = auth;
const $ = (id) => document.getElementById(id);
const cleanCedula = value => String(value || "").replace(/\D/g, "");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let currentUser = null;
let activities = [];
let busy = false;

function status(message, error = false) {
  const node = $("pubStatus");
  node.textContent = message;
  node.style.display = "block";
  node.style.background = error ? "#b4231820" : "#1bbe8920";
  node.style.borderColor = error ? "#ef444470" : "#1bbe8970";
  node.style.color = error ? "#ffb4ae" : "#8ff0cb";
}
function showAuthenticated(show) {
  $("activityLogin").hidden = show;
  $("activityWorkspace").hidden = !show;
  $("activityIdentity").textContent = show ? (currentUser?.displayName || currentUser?.email || "Personal autorizado") : "";
}
async function token() {
  const result = await auth.token();
  if (result?.error || !result?.data?.token) throw new Error("La sesión no es válida. Inicia sesión nuevamente.");
  return result.data.token;
}
async function validateSession(user) {
  if (!user?.id || user.emailVerified !== true) throw new Error("La cuenta debe tener el correo confirmado.");
  const jwt = await token();
  const response = await fetch(`${DATA_API_URL}/user_profiles?select=auth_user_id,role,active,email_verified,email,display_name&auth_user_id=eq.${encodeURIComponent(user.id)}&limit=1`, {
    headers: { Authorization: `Bearer ${jwt}`, "Accept-Profile": "mira" }
  });
  if (!response.ok) throw new Error("No fue posible validar el perfil institucional.");
  const rows = await response.json();
  const profile = rows?.[0];
  if (!profile || profile.active !== true || profile.email_verified !== true || !["admin","operator","viewer","witness"].includes(profile.role)) {
    throw new Error("La cuenta no está activa o no ha sido autorizada por el administrador.");
  }
  if (profile.role !== "admin") {
    const permissionsResponse = await fetch(`${DATA_API_URL}/module_permissions?select=module_key,action_key,allowed&limit=500`, {
      headers: { Authorization: `Bearer ${jwt}`, "Accept-Profile": "mira" }
    });
    if (!permissionsResponse.ok) throw new Error("No fue posible comprobar los permisos. El acceso permanece bloqueado.");
    const permissions = await permissionsResponse.json();
    const allowed = (action) => permissions.some(p => p.module_key === "actividades" && p.action_key === action && p.allowed === true);
    if (!allowed("view") || !allowed("create")) throw new Error("Tu cuenta necesita permisos de consulta y registro en el módulo Actividades.");
  }
  currentUser = { id: user.id, role: profile.role, email: profile.email || user.email, displayName: profile.display_name || user.name || profile.email };
  showAuthenticated(true);
  await refreshActivities();
}
async function refreshActivities() {
  activities = await MIRA_DATA.listActivities({limit:100});
  const select = $("pubActivity");
  const previous = select.value;
  select.innerHTML = '<option value="">Seleccionar actividad…</option>' + activities
    .filter(a => a.estado === "activa")
    .sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)))
    .map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.nombre)} · ${escapeHtml(String(a.fecha).slice(0,10))}${a.estado === "activa" ? " · En curso" : ""}</option>`).join("");
  if (activities.some(a => a.id === previous)) select.value = previous;
}
async function login(event) {
  event.preventDefault();
  if (busy) return;
  busy = true;
  $("activityLoginBtn").disabled = true;
  try {
    const email = $("activityEmail").value.trim();
    const password = $("activityPassword").value;
    const result = await auth.signIn.email({email,password});
    if (result?.error) throw new Error("No fue posible iniciar sesión. Verifica tus credenciales y el estado de tu cuenta.");
    await validateSession(result?.data?.user);
    $("activityPassword").value = "";
    $("activityLoginError").textContent = "";
  } catch (error) {
    currentUser = null;
    showAuthenticated(false);
    try { await auth.signOut(); } catch {}
    $("activityLoginError").textContent = error.message || "Acceso no autorizado.";
  } finally {
    busy = false;
    $("activityLoginBtn").disabled = false;
  }
}
async function restoreSession() {
  try {
    const result = await auth.getSession();
    if (result?.error) throw result.error;
    const data = result?.data;
    const user = data?.user || data?.session?.user || null;
    if (user) await validateSession(user);
    else showAuthenticated(false);
  } catch (error) {
    currentUser = null;
    showAuthenticated(false);
    try { await auth.signOut(); } catch {}
    $("activityLoginError").textContent = error.message || "Inicia sesión para continuar.";
  }
}
$("activityLoginForm").addEventListener("submit", login);
$("activityLogoutBtn").addEventListener("click", async () => {
  try { await auth.signOut(); } finally { currentUser = null; showAuthenticated(false); $("activityLoginError").textContent = "Sesión cerrada."; }
});
$("pubLookup").addEventListener("click", async () => {
  try {
    const id = cleanCedula($("pubCedula").value);
    if (!id) return status("Escribe una cédula para buscar.", true);
    const rows = await MIRA_DATA.listPeople({cedula:id,limit:2});
    const person = rows?.[0];
    if (!person) return status("No existe ficha previa. Completa los datos para crearla.");
    $("pubNames").value = person.nombres || "";
    $("pubSurnames").value = person.apellidos || "";
    $("pubPhone").value = person.telefono || "";
    $("pubInfo").value = person.info_mira === true ? "si" : person.info_mira === false ? "no" : "";
    status("Ficha encontrada en la base central. Datos cargados.");
  } catch (error) { status(error.message || "No fue posible consultar la ficha.", true); }
});
$("publicActivityForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  const submit = $("pubSubmit");
  submit.disabled = true;
  try {
    if (!currentUser) throw new Error("La sesión expiró. Inicia sesión nuevamente.");
    const cedula = cleanCedula($("pubCedula").value);
    const firstNames = $("pubNames").value.trim();
    const apellidos = $("pubSurnames").value.trim();
    const actividad_id = $("pubActivity").value;
    const info_mira = $("pubInfo").value === "si";
    if (!cedula || !firstNames || !apellidos || !actividad_id || !$("pubInfo").value) throw new Error("Completa los campos obligatorios.");
    if (!activities.some(a => a.id === actividad_id && a.estado !== "cancelada")) throw new Error("La actividad ya no está disponible. Actualiza la página.");
    let matches = await MIRA_DATA.listPeople({cedula,limit:2});
    let person = matches?.[0];
    if (matches?.length > 1) throw new Error("Hay más de una ficha con esa cédula. Se requiere revisión administrativa; no se registró la asistencia.");
    const personData = {cedula,nombres:firstNames,apellidos,telefono:$("pubPhone").value.trim() || null,info_mira};
    if (!person) {
      status("Guardando ficha de la persona en Neon…");
      const created = await MIRA_DATA.createPerson(personData);
      person = created?.[0];
      if (!person?.id) {
        const confirmed = await MIRA_DATA.listPeople({cedula,limit:2});
        if (confirmed?.length !== 1) throw new Error("La ficha no fue confirmada en la base central.");
        person = confirmed[0];
      }
    }
    try {
      status("Ficha validada. Guardando asistencia en Neon…");
      await MIRA_DATA.createAttendance({persona_id:person.id,actividad_id,registrado_por:currentUser.id});
    } catch (error) {
      if (/duplicate|unique|asistencias_unicas|409/i.test(error.message || "")) throw new Error("Esta persona ya tiene asistencia registrada en esta actividad; no se duplicó.");
      throw error;
    }
    status("Asistencia guardada y confirmada en la base central.");
    $("publicActivityForm").reset();
    await refreshActivities();
  } catch (error) { status("No fue posible guardar el registro: " + (error.message || "Error desconocido."), true); }
  finally { busy = false; submit.disabled = false; }
});
restoreSession();
