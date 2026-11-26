// Reutiliza el JWT anónimo exacto con el que se validó el PIN en Módulos.
// No crear una segunda identidad de Neon Auth en esta página.
import { MIRA_DATA } from "./mira-data.js?v=20261125-connected-1";
window.MIRA_AUTH = {
  getJWTToken: () => sessionStorage.getItem("miraParticipantAuthJwt")
};

const $ = id => document.getElementById(id);
const cleanCedula = value => String(value || "").replace(/\D/g, "");
const MODULE_ACCESS_TOKEN_KEY = "miraParticipantAccessToken";
const MODULE_ACCESS_TOKEN_EXPIRY_KEY = "miraParticipantAccessTokenExpiresAt";
let busy = false;
let activities = [];
let accessToken = null;
let currentPersonAlreadyRegistered = false;
let personLookupCompleted = false;

function status(message, kind = "success") {
  const node = $("pubStatus");
  node.textContent = message;
  node.dataset.kind = kind;
  node.style.display = "block";
}
function setEnrollmentStatus(message, kind = "info") {
  const node = $("pubEnrollmentStatus");
  node.textContent = message;
  node.dataset.kind = kind;
  node.hidden = !message;
}
function clearEnrollmentStatus() { setEnrollmentStatus(""); }
function syncLookupButton() {
  $("pubLookup").disabled = !accessToken || !$("pubActivity").value || busy;
}
function setAvailable(enabled) {
  $("pubSubmit").disabled = !enabled || busy || currentPersonAlreadyRegistered || !personLookupCompleted || !accessToken;
  $("pubActivity").disabled = !enabled || !accessToken;
  syncLookupButton();
}
function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte,16)));
}
function showPersonDetails(person) {
  const fields = {
    pubEmailValue: person.correo || "No registrado",
    pubBarrioValue: person.barrio || "No registrado",
    pubPollingPlaceValue: person.puesto_votacion || "No registrado",
    pubPollingTableValue: person.mesa_votacion || "No registrada",
    pubAgeValue: person.edad == null ? "No registrada" : String(person.edad),
    pubTransportValue: person.requiere_transporte == null ? "No registrado" : (person.requiere_transporte ? "Sí" : "No"),
    pubStateValue: person.inactivo || person.activo === false ? "Sin InfoMIRA" : "Activa"
  };
  for (const [id,value] of Object.entries(fields)) $(id).textContent = value;
  $("pubPersonDetails").hidden = false;
}
function clearPersonDetails() {
  $("pubPersonDetails").hidden = true;
  for (const id of ["pubEmailValue","pubBarrioValue","pubPollingPlaceValue","pubPollingTableValue","pubAgeValue","pubTransportValue","pubStateValue"]) $(id).textContent = "—";
}
function lockModule(message = "") {
  accessToken = null;
  sessionStorage.removeItem(MODULE_ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(MODULE_ACCESS_TOKEN_EXPIRY_KEY);
  sessionStorage.removeItem("miraParticipantAuthJwt");
    currentPersonAlreadyRegistered = false;

  personLookupCompleted = false;
  window.location.replace("index.html?openModules=1&authorization=expired");
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

$("pubActivity").addEventListener("change", () => {
  currentPersonAlreadyRegistered = false;

  personLookupCompleted = false;
  clearEnrollmentStatus();
  clearPersonDetails();
  setAvailable(activities.length > 0);
  if ($("pubCedula").value.trim()) $("pubLookup").click();
});
$("pubCedula").addEventListener("input", () => {
  currentPersonAlreadyRegistered = false;

  personLookupCompleted = false;
    clearEnrollmentStatus();
  clearPersonDetails();
  setAvailable(activities.length > 0);
});

$("pubLookup").addEventListener("click", async () => {
  const cedula = cleanCedula($("pubCedula").value);
  const actividadId = $("pubActivity").value;
  if (!accessToken) return lockModule("La autorización venció. Ingresa nuevamente desde Módulos.");
  if (!actividadId) return status("Primero selecciona la actividad en la que deseas consultar la inscripción.", "error");
  if (cedula.length < 5 || cedula.length > 15) return status("Escribe una cédula válida para buscar la ficha.", "error");
  const button = $("pubLookup");
  button.disabled = true;
    currentPersonAlreadyRegistered = false;

  personLookupCompleted = false;
  clearPersonDetails();
  clearEnrollmentStatus();
  try {
    const enrollment = await MIRA_DATA.checkPublicActivityParticipant(cedula, actividadId, accessToken);
    const person = enrollment?.person || null;
    personLookupCompleted = true;
    currentPersonAlreadyRegistered = Boolean(enrollment?.already_registered);
    if (currentPersonAlreadyRegistered) {
      setEnrollmentStatus(enrollment.attendance_status === "anulada"
        ? "Existe un registro ANULADO de esta persona en la actividad. No se puede volver a inscribir hasta que el registro sea revisado administrativamente."
        : "Esta persona YA ESTÁ INSCRITA en la actividad seleccionada. No es necesario registrar otra asistencia.", "warning");
    } else {
      setEnrollmentStatus("Esta persona NO está inscrita en la actividad seleccionada. Puedes continuar con el registro.", "success");
    }
    if (!person) {
      $("pubNames").value = "";
      $("pubSurnames").value = "";
      $("pubPhone").value = "";
      $("pubInfoMira").value = "";
      $("pubHasApp").value = "";
      $("pubType").value = "";
      setAvailable(activities.length > 0);
      status(currentPersonAlreadyRegistered
        ? "La asistencia ya existe; no se permite duplicarla."
        : "No encontramos una ficha con esta cédula. Completa los datos para crearla al guardar la asistencia.", currentPersonAlreadyRegistered ? "error" : "success");
      return;
    }
    $("pubNames").value = person.nombres || "";
    $("pubSurnames").value = person.apellidos || "";
    $("pubPhone").value = person.telefono || "";
    $("pubInfoMira").value = (person.inactivo || person.activo === false) ? "no" : (person.info_mira == null ? "" : (person.info_mira ? "si" : "no"));
    $("pubHasApp").value = person.tiene_app_infomira == null ? "" : (person.tiene_app_infomira ? "si" : "no");
    $("pubType").value = ["interno","externo"].includes(String(person.tipo_participacion||"").toLowerCase())
      ? String(person.tipo_participacion).toLowerCase() : "";
    showPersonDetails(person);
    if (person.inactivo || person.activo === false) {
      status("Ficha recuperada. No está inscrita a InfoMIRA; puede registrarse en esta actividad.", "success");
    }
setAvailable(activities.length > 0);
    status(currentPersonAlreadyRegistered
      ? "Ficha recuperada. La asistencia de esta persona ya existe para esta actividad."
      : "Ficha recuperada. Verifica los datos y confirma el consentimiento para registrar la asistencia.",
      currentPersonAlreadyRegistered ? "error" : "success");
  } catch (error) {
    const message = error.message || "No fue posible consultar la inscripción.";
    if (/autorización venció|PIN de acceso|no es válida/i.test(message)) lockModule(message);
    else status(message, "error");
  } finally {
    button.disabled = false;
    syncLookupButton();
  }
});

$("publicActivityForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;
  if (!accessToken) return lockModule("La autorización venció. Ingresa nuevamente el PIN.");
  const cedula = cleanCedula($("pubCedula").value);
  const nombres = $("pubNames").value.trim();
  const apellidos = $("pubSurnames").value.trim();
  const actividad_id = $("pubActivity").value;
  if (cedula.length < 5 || cedula.length > 15) return status("Verifica el número de cédula. Debe contener entre 5 y 15 dígitos.","error");
  if (nombres.length < 2 || apellidos.length < 2) return status("Escribe los nombres y apellidos completos.","error");
  if (!actividad_id || !activities.some(a => String(a.activity_id) === actividad_id)) return status("Selecciona una actividad que esté abierta para inscripción.","error");
  const info_mira = $("pubInfoMira").value;
  const tiene_app_infomira = $("pubHasApp").value;
  const tipo_participacion = $("pubType").value;
  if (!info_mira || !tiene_app_infomira || !tipo_participacion) return status("Indica si está inscrito a InfoMIRA, si tiene la App InfoMIRA y el tipo de participante.","error");
  if (!$("pubConsent").checked) return status("Debes aceptar el tratamiento de datos para continuar.","error");
  if (!personLookupCompleted) return status("Selecciona una actividad y busca la cédula antes de diligenciar el registro.", "error");
  if (currentPersonAlreadyRegistered) return status("Esta persona ya tiene una asistencia registrada en la actividad seleccionada.", "error");
  busy = true;
  setAvailable(false);
  status("Guardando la asistencia…");
  try {
    const result = await MIRA_DATA.registerPublicActivityParticipant({
      cedula,nombres,apellidos,telefono:$("pubPhone").value.trim()||null,
      actividad_id,info_mira,tiene_app_infomira,tipo_participacion,consentimiento:true,access_token:accessToken
    });
    if (result?.status === "duplicate") {
      status(result.message || "Esta cédula ya tiene asistencia registrada en la actividad seleccionada.","error");
      return;
    }
    if (result?.status !== "ok") throw new Error(result?.message || "No se pudo confirmar la inscripción.");
    $("publicActivityForm").reset();
    clearPersonDetails();
        currentPersonAlreadyRegistered = false;

    personLookupCompleted = false;
    clearEnrollmentStatus();
    status("¡Asistencia registrada correctamente! La participación quedó guardada.");
  } catch (error) {
    const message = error.message || "No fue posible guardar la asistencia.";
    if (/autorización venció|PIN de acceso|no es válida/i.test(message)) lockModule(message);
    else status(message,"error");
  } finally {
    busy = false;
    setAvailable(activities.length > 0);
  }
});
$("publicActivityForm").addEventListener("reset", () => {
  setTimeout(() => {
    if ($("pubStatus")) { $("pubStatus").style.display = "none"; $("pubStatus").textContent = ""; }
    clearPersonDetails();
        currentPersonAlreadyRegistered = false;

    personLookupCompleted = false;
    clearEnrollmentStatus();
    setAvailable(activities.length > 0);
  },0);
});
async function restoreCentralModuleAuthorization() {
  const sharedToken = sessionStorage.getItem(MODULE_ACCESS_TOKEN_KEY);
  const expiresAt = Number(sessionStorage.getItem(MODULE_ACCESS_TOKEN_EXPIRY_KEY) || 0);
  if (!sharedToken || expiresAt <= Date.now()) {
    lockModule(sharedToken ? "La autorización venció." : "");
    return;
  }
  accessToken = sharedToken;
  $("pubFormArea").hidden = false;
  $("activityAvailability").hidden = false;
  $("publicActivityForm").hidden = false;
  try {
    await refreshActivities();
  } catch (error) {
    const message = error?.message || "No fue posible consultar las actividades.";
    if (/autorización venció|PIN de acceso|no es válida|permission denied/i.test(message)) lockModule(message);
    else status(message, "error");
  }
}
restoreCentralModuleAuthorization();
