import { createInternalNeonAuth } from "https://esm.sh/@neondatabase/auth@0.7.0-beta";
import { MIRA_DATA } from "./mira-data.js?v=20261123-participant-pin-2";

const PUBLIC_AUTH_URL = "https://ep-mute-grass-b7qan4n6.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth";
const publicNeonAuth = createInternalNeonAuth(PUBLIC_AUTH_URL,{allowAnonymous:true});
const publicAuthAdapter = publicNeonAuth.adapter;
window.MIRA_AUTH = {
  getJWTToken: () => publicNeonAuth.getJWTToken(),
  getAnonymousToken: (...args) => publicAuthAdapter.getAnonymousToken(...args)
};

const $ = id => document.getElementById(id);
const cleanCedula = value => String(value || "").replace(/\D/g, "");
const PIN_SALT_HEX = "29a690124de6919817cc26c444b99359";
const PIN_ITERATIONS = 310000;
let busy = false;
let activities = [];
let accessToken = null;
let currentPersonBlocked = false;

function status(message, kind = "success") {
  const node = $("pubStatus");
  node.textContent = message;
  node.dataset.kind = kind;
  node.style.display = "block";
}
function pinStatus(message, kind = "error") {
  const node = $("pubPinStatus");
  node.textContent = message;
  node.dataset.kind = kind;
  node.style.display = "block";
}
function setAvailable(enabled) {
  $("pubSubmit").disabled = !enabled || busy || currentPersonBlocked || !accessToken;
  $("pubActivity").disabled = !enabled || !accessToken;
}
function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte,16)));
}
async function derivePinVerifier(pin) {
  if (!/^\d{10}$/.test(pin)) throw new Error("El PIN debe contener exactamente 10 dígitos.");
  if (!globalThis.crypto?.subtle) throw new Error("Este navegador no permite verificar el PIN de forma segura. Abre el sitio mediante HTTPS o localhost.");
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {name:"PBKDF2",salt:hexToBytes(PIN_SALT_HEX),iterations:PIN_ITERATIONS,hash:"SHA-256"},
    key,256
  );
  return [...new Uint8Array(bits)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
function showPersonDetails(person) {
  const fields = {
    pubEmailValue: person.correo || "No registrado",
    pubBarrioValue: person.barrio || "No registrado",
    pubPollingPlaceValue: person.puesto_votacion || "No registrado",
    pubPollingTableValue: person.mesa_votacion || "No registrada",
    pubAgeValue: person.edad == null ? "No registrada" : String(person.edad),
    pubTransportValue: person.requiere_transporte == null ? "No registrado" : (person.requiere_transporte ? "Sí" : "No"),
    pubStateValue: person.inactivo || person.activo === false ? "Inactiva · requiere revisión" : "Activa"
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
  currentPersonBlocked = false;
  $("pubGate").hidden = false;
  $("pubFormArea").hidden = true;
  $("pubPin").value = "";
  $("pubPinStatus").style.display = message ? "block" : "none";
  $("pubPinStatus").textContent = message;
  $("pubPinStatus").dataset.kind = "error";
  $("pubPinSubmit").disabled = false;
  $("pubLock").hidden = true;
  $("publicActivityForm").reset();
  clearPersonDetails();
  $("pubStatus").style.display = "none";
  setAvailable(false);
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

$("pubPinSubmit").addEventListener("click", async () => {
  const pin = $("pubPin").value.trim();
  $("pubPinSubmit").disabled = true;
  try {
    pinStatus("Verificando código de acceso…","success");
    const verifier = await derivePinVerifier(pin);
    const result = await MIRA_DATA.verifyParticipantAccessPin(verifier);
    if (result?.status !== "ok" || !result?.access_token) throw new Error("No fue posible validar el código de acceso.");
    accessToken = result.access_token;
    $("pubGate").hidden = true;
    $("pubFormArea").hidden = false;
    $("activityAvailability").hidden = false;
    $("publicActivityForm").hidden = false;
    $("pubLock").hidden = false;
    $("pubPinStatus").style.display = "none";
    await refreshActivities();
  } catch (error) {
    pinStatus(error.message || "No fue posible validar el PIN.");
  } finally {
    $("pubPinSubmit").disabled = false;
  }
});
$("pubPin").addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); $("pubPinSubmit").click(); }
});
$("pubLock").addEventListener("click", () => lockModule("El módulo quedó bloqueado. Ingresa nuevamente el PIN para continuar."));

$("pubLookup").addEventListener("click", async () => {
  const cedula = cleanCedula($("pubCedula").value);
  if (!accessToken) return lockModule("La autorización venció. Ingresa nuevamente el PIN.");
  if (cedula.length < 5 || cedula.length > 15) return status("Escribe una cédula válida para buscar la ficha.", "error");
  const button = $("pubLookup");
  button.disabled = true;
  currentPersonBlocked = false;
  try {
    const person = await MIRA_DATA.lookupPublicPerson(cedula,accessToken);
    if (!person) {
      $("pubNames").value = "";
      $("pubSurnames").value = "";
      $("pubPhone").value = "";
      $("pubInfoMira").value = "";
      $("pubType").value = "";
      clearPersonDetails();
      setAvailable(activities.length > 0);
      status("No encontramos una ficha con esta cédula. Completa los datos para crearla al guardar la asistencia.","success");
      return;
    }
    $("pubNames").value = person.nombres || "";
    $("pubSurnames").value = person.apellidos || "";
    $("pubPhone").value = person.telefono || "";
    $("pubInfoMira").value = person.info_mira == null ? "" : (person.info_mira ? "si" : "no");
    $("pubType").value = ["interno","externo"].includes(String(person.tipo_participacion||"").toLowerCase())
      ? String(person.tipo_participacion).toLowerCase() : "";
    showPersonDetails(person);
    if (person.inactivo || person.activo === false) {
      currentPersonBlocked = true;
      setAvailable(activities.length > 0);
      status("La ficha existe, pero está marcada como inactiva. No se puede registrar asistencia hasta que sea revisada por un administrador.","error");
      return;
    }
    setAvailable(activities.length > 0);
    status("Ficha recuperada correctamente. Verifica los datos, selecciona la actividad y confirma el consentimiento para registrar la asistencia.","success");
  } catch (error) {
    const message = error.message || "No fue posible consultar la ficha.";
    if (/autorización venció|PIN de acceso|no es válida/i.test(message)) lockModule(message);
    else status(message,"error");
  } finally { button.disabled = false; }
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
  const tipo_participacion = $("pubType").value;
  if (!info_mira || !tipo_participacion) return status("Selecciona InfoMIRA y el tipo de participante.","error");
  if (!$("pubConsent").checked) return status("Debes aceptar el tratamiento de datos para continuar.","error");
  if (currentPersonBlocked) return status("La ficha está inactiva y requiere revisión administrativa.","error");
  busy = true;
  setAvailable(false);
  status("Guardando la asistencia…");
  try {
    const result = await MIRA_DATA.registerPublicActivityParticipant({
      cedula,nombres,apellidos,telefono:$("pubPhone").value.trim()||null,
      actividad_id,info_mira,tipo_participacion,consentimiento:true,access_token:accessToken
    });
    if (result?.status === "duplicate") {
      status(result.message || "Esta cédula ya tiene asistencia registrada en la actividad seleccionada.","error");
      return;
    }
    if (result?.status !== "ok") throw new Error(result?.message || "No se pudo confirmar la inscripción.");
    $("publicActivityForm").reset();
    clearPersonDetails();
    currentPersonBlocked = false;
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
  },0);
});
lockModule();
