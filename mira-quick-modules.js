import { MIRA_DATA } from "./mira-data.js?v=20261124-infomira-app-field-2";

const TOKEN_KEY = "miraParticipantAccessToken";
const TOKEN_EXPIRY_KEY = "miraParticipantAccessTokenExpiresAt";
const PIN_SALT_HEX = "29a690124de6919817cc26c444b99359";
const PIN_ITERATIONS = 310000;

const $ = id => document.getElementById(id);
const menu = $("miraQuickModules");
const toggle = $("miraQuickModulesToggle");
const panel = $("miraQuickModulesPanel");
const pinGate = $("miraModulePinGate");
const pinInput = $("miraModulePin");
const pinSubmit = $("miraModulePinSubmit");
const pinStatus = $("miraModulePinStatus");
const registerButton = $("miraQuickRegisterParticipantBtn");
const lockButton = $("miraQuickModulesLockBtn");

if (!menu || !toggle || !panel || !pinGate || !pinInput || !pinSubmit || !registerButton || !lockButton) {
  console.warn("[MIRA módulos] No se encontró la estructura completa del menú.");
} else {
  let authorized = Boolean(sessionStorage.getItem(TOKEN_KEY) && Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY)) > Date.now());
  let verifying = false;

  function setStatus(message, kind = "error") {
    pinStatus.textContent = message;
    pinStatus.dataset.kind = kind;
    pinStatus.hidden = !message;
  }

  function syncAuthorization() {
    authorized = Boolean(sessionStorage.getItem(TOKEN_KEY) && Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY)) > Date.now());
    if (!authorized) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
    renderAuthorization();
  }

  function renderAuthorization() {
    registerButton.disabled = !authorized;
    registerButton.setAttribute("aria-disabled", String(!authorized));
    registerButton.classList.toggle("is-locked", !authorized);
    registerButton.querySelector("small").textContent = authorized
      ? "PIN validado · token temporal"
      : "Requiere PIN de autorización";
    lockButton.hidden = !authorized;
    const testigos = $("miraQuickTestigosBtn");
    if (testigos) {
      testigos.disabled = true;
      testigos.setAttribute("aria-disabled", "true");
      testigos.classList.add("is-locked");
      testigos.querySelector("small").textContent = "En renovación · Acceso bloqueado";
    }
  }

  const isMobileMenu = () => window.matchMedia("(max-width: 600px)").matches;

  function updateMobileMenuLabel(open) {
    toggle.setAttribute("aria-expanded", String(open));
    const icon = toggle.querySelector(".mira-quick-toggle-icon");
    const label = toggle.querySelector("span:last-child");
    if (icon) icon.textContent = open ? "×" : "☰";
    if (label) label.textContent = open ? "Cerrar" : "Módulos";
  }

  function showPinGate() {
    pinGate.hidden = false;
    if (isMobileMenu()) panel.classList.add("hidden");
    pinInput.value = "";
    setStatus("");
    window.setTimeout(() => pinInput.focus(), 40);
  }

  function hidePinGate() {
    pinGate.hidden = true;
    pinInput.value = "";
    setStatus("");
  }

  function lockAuthorization(message = "La autorización quedó bloqueada.") {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    authorized = false;
    renderAuthorization();
    hidePinGate();
    setStatus(message, "success");
  }

  function hexToBytes(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  }

  async function derivePinVerifier(pin) {
    if (!/^\d{10}$/.test(pin)) throw new Error("El PIN debe contener exactamente 10 dígitos.");
    if (!globalThis.crypto?.subtle) throw new Error("La verificación segura requiere HTTPS o localhost.");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: hexToBytes(PIN_SALT_HEX), iterations: PIN_ITERATIONS, hash: "SHA-256" },
      key, 256
    );
    return [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function authorize() {
    if (verifying) return;
    verifying = true;
    pinSubmit.disabled = true;
    pinSubmit.textContent = "Verificando…";
    try {
      setStatus("Verificando autorización…", "success");
      const verifier = await derivePinVerifier(pinInput.value.trim());
      const result = await MIRA_DATA.verifyParticipantAccessPin(verifier);
      if (result?.status !== "ok" || !result?.access_token) {
        throw new Error("No fue posible validar el PIN.");
      }
      sessionStorage.setItem(TOKEN_KEY, result.access_token);
      sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + Number(result.expires_in || 2700) * 1000));
      authorized = true;
      renderAuthorization();
      hidePinGate();
      if (isMobileMenu() && menu.classList.contains("is-mobile-open")) panel.classList.remove("hidden");
      setStatus("Acceso guardado en esta pestaña. La autorización del servidor vence a los 45 minutos; después deberás validar el PIN nuevamente.", "success");
    } catch (error) {
      setStatus(error?.message || "No fue posible validar el PIN.");
    } finally {
      verifying = false;
      pinSubmit.disabled = false;
      pinSubmit.textContent = "Autorizar módulos";
    }
  }

  // app.js conserva el control original de apertura/cierre del panel.
  // Este listener en captura solo prepara la autorización y no duplica el toggle.
  toggle.addEventListener("click", event => {
    if (isMobileMenu()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const opening = !menu.classList.contains("is-mobile-open");
      if (!opening) {
        menu.classList.remove("is-mobile-open");
        panel.classList.add("hidden");
        hidePinGate();
        updateMobileMenuLabel(false);
        return;
      }
      menu.classList.add("is-mobile-open");
      updateMobileMenuLabel(true);
      syncAuthorization();
      if (authorized) {
        hidePinGate();
        panel.classList.remove("hidden");
      } else {
        panel.classList.add("hidden");
        showPinGate();
      }
      return;
    }
    const opening = panel.classList.contains("hidden");
    if (opening && !authorized) showPinGate();
    else if (opening) renderAuthorization();
    else hidePinGate();
  }, true);

  pinSubmit.addEventListener("click", authorize);
  pinInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      authorize();
    }
    if (event.key === "Escape") hidePinGate();
  });

  registerButton.addEventListener("click", () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!authorized || !token || Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY)) <= Date.now()) {
      authorized = false;
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
      renderAuthorization();
      showPinGate();
      return;
    }
    menu.classList.remove("is-mobile-open");
    updateMobileMenuLabel(false);
    window.location.assign("actividad.html?v=20261124-central-pin-4");
  });

  lockButton.addEventListener("click", () => {
    lockAuthorization();
    if (isMobileMenu() && menu.classList.contains("is-mobile-open")) {
      panel.classList.add("hidden");
      showPinGate();
    }
  });
  document.addEventListener("mira:signed-out", () => {
    lockAuthorization("La sesión se cerró y la autorización fue retirada.");
    menu.classList.remove("is-mobile-open");
    panel.classList.add("hidden");
    updateMobileMenuLabel(false);
  });
  window.addEventListener("pagehide", () => {
    // sessionStorage se conserva entre páginas de la misma pestaña y se elimina al cerrar la pestaña.
  });

  renderAuthorization();
  window.addEventListener("pageshow", syncAuthorization);
  window.addEventListener("focus", syncAuthorization);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncAuthorization(); });
}
