import { createInternalNeonAuth } from "https://esm.sh/@neondatabase/auth@0.7.0-beta";
import { MIRA_DATA } from "./mira-data.js?v=20261123-rpc-compatible-fix-3";

// Este formulario es público: inicializa su propio cliente Neon Auth anónimo.
// No depende de que el usuario abra la plataforma interna ni tenga una sesión.
const PUBLIC_AUTH_URL = "https://ep-mute-grass-b7qan4n6.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth";
const publicNeonAuth = createInternalNeonAuth(PUBLIC_AUTH_URL,{allowAnonymous:true});
const publicAuthAdapter = publicNeonAuth.adapter;
window.MIRA_AUTH = {
  getJWTToken: () => publicNeonAuth.getJWTToken(),
  getAnonymousToken: (...args) => publicAuthAdapter.getAnonymousToken(...args)
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
$("pubLookup").addEventListener("click", async () => {
  const cedula = cleanCedula($("pubCedula").value);
  if (cedula.length < 5 || cedula.length > 15) return status("Escribe una cédula válida para buscar la ficha.", "error");
  const button = $("pubLookup");
  button.disabled = true;
  try {
    const exists = await MIRA_DATA.lookupPublicPerson(cedula);
    status(exists === true
      ? "Encontramos una ficha asociada a esta cédula. Completa los datos y selecciona la actividad para registrar la asistencia. Por privacidad no mostramos información personal guardada."
      : "No encontramos una ficha con esta cédula. Completa nombres y apellidos para crearla al guardar la asistencia.", "success");
  } catch (error) {
    status(error.message || "No fue posible consultar la ficha. Inténtalo nuevamente.", "error");
  } finally { button.disabled = false; }
});
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
  const info_mira = $("pubInfoMira").value;
  const tipo_participacion = $("pubType").value;
  if (!info_mira || !tipo_participacion) return status("Selecciona InfoMIRA y el tipo de participante.", "error");
  if (!$("pubConsent").checked) return status("Debes aceptar el tratamiento de datos para continuar.", "error");
  busy = true;
  setAvailable(false);
  status("Guardando tu inscripción…");
  try {
    const result = await MIRA_DATA.registerPublicActivityParticipant({
      cedula, nombres, apellidos,
      telefono: $("pubPhone").value.trim() || null,
      actividad_id, info_mira, tipo_participacion, consentimiento: true
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
