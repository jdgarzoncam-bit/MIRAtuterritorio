import { createInternalNeonAuth } from "https://esm.sh/@neondatabase/auth@0.7.0-beta";
import { MIRA_DATA } from "./mira-data.js?v=20261123-public-activities-1";

const AUTH_URL = "https://ep-mute-grass-b7qan4n6.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth";
const neonAuth = createInternalNeonAuth(AUTH_URL,{allowAnonymous:true});
const auth = neonAuth.adapter;
window.MIRA_AUTH = {
  getJWTToken: () => neonAuth.getJWTToken(),
  getAnonymousToken: (...args) => auth.getAnonymousToken(...args)
};
const $ = id => document.getElementById(id);
const cleanCedula = value => String(value || "").replace(/\D/g, "");
let busy = false;
let activities = [];

function status(message, kind = "success") {
  const node = $("pubStatus");
  node.textContent = message;
  node.dataset.kind = kind;
  node.style.display = "block";
}
function setAvailable(enabled) {
  $("pubSubmit").disabled = !enabled || busy;
  $("pubActivity").disabled = !enabled;
}
async function refreshActivities() {
  const rows = await MIRA_DATA.listPublicActivityOptions();
  activities = Array.isArray(rows) ? rows : [];
  const select = $("pubActivity");
  select.innerHTML = '<option value="">Selecciona una actividad</option>' + activities.map(a =>
    `<option value="${String(a.activity_id)}">${String(a.activity_name)} · ${String(a.activity_date).slice(0,10)}${a.activity_place ? " · " + String(a.activity_place) : ""}</option>`
  ).join("");
  if (!activities.length) {
    $("activityAvailability").textContent = "En este momento no hay actividades abiertas para inscripción. Vuelve a consultar más tarde.";
    setAvailable(false);
    return;
  }
  $("activityAvailability").textContent = activities.length === 1
    ? "Hay una actividad disponible para inscripción."
    : `Hay ${activities.length} actividades disponibles. Selecciona en cuál deseas participar.`;
  setAvailable(true);
}
$("publicActivityForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;
  const cedula = cleanCedula($("pubCedula").value);
  const nombres = $("pubNames").value.trim();
  const apellidos = $("pubSurnames").value.trim();
  const actividad_id = $("pubActivity").value;
  if (cedula.length < 5 || cedula.length > 15) return status("Verifica el número de cédula. Debe contener entre 5 y 15 dígitos.", "error");
  if (nombres.length < 2 || apellidos.length < 2) return status("Escribe tus nombres y apellidos completos.", "error");
  if (!actividad_id || !activities.some(a => String(a.activity_id) === actividad_id)) return status("Selecciona una actividad que esté abierta para inscripción.", "error");
  if (!$("pubConsent").checked) return status("Debes aceptar el tratamiento de datos para continuar.", "error");
  busy = true;
  setAvailable(false);
  status("Guardando tu inscripción…");
  try {
    const result = await MIRA_DATA.registerPublicActivityParticipant({
      cedula, nombres, apellidos,
      telefono: $("pubPhone").value.trim() || null,
      actividad_id, consentimiento: true
    });
    if (result?.status === "duplicate") {
      status(result.message || "Esta cédula ya tiene asistencia registrada en la actividad seleccionada.", "error");
      return;
    }
    if (result?.status !== "ok") throw new Error(result?.message || "No se pudo confirmar la inscripción.");
    $("publicActivityForm").reset();
    status("¡Inscripción registrada correctamente! Tu participación quedó guardada.");
  } catch (error) {
    status(error.message || "No fue posible guardar la inscripción. Inténtalo nuevamente.", "error");
  } finally {
    busy = false;
    setAvailable(activities.length > 0);
  }
});
$("publicActivityForm").addEventListener("reset", () => {
  setTimeout(() => {
    $("pubStatus").style.display = "none";
    $("pubStatus").textContent = "";
  }, 0);
});
try {
  await refreshActivities();
} catch (error) {
  $("activityAvailability").textContent = "No fue posible consultar las actividades. Actualiza la página o inténtalo más tarde.";
  setAvailable(false);
  status(error.message || "Error de conexión con el servicio de registro.", "error");
}
