(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const ADMIN_ID = "beef5bf3-82a8-4c35-a12c-17771be59da1";
  const state = { rows: [], filtered: [], query: "", type: "", loading: false, authorized: false };
  const labels = { novedad: "Novedad", acta: "Acta", logistica: "Logística", otro: "Otro" };
  const dateLabel = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Fecha no disponible" :
      new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
  };
  const isPrimaryAdmin = () => window.MIRA_CURRENT_USER?.role === "admin" &&
    window.MIRA_CURRENT_USER?.authUserId === ADMIN_ID;
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  function notice(message, error = false) {
    const node = $("operationalReportsNotice");
    if (!node) return;
    node.textContent = message;
    node.classList.remove("hidden", "is-error", "is-success");
    node.classList.add(error ? "is-error" : "is-success");
  }
  function applyFilters() {
    const q = state.query.trim().toLocaleLowerCase("es");
    state.filtered = state.rows.filter(row => {
      const matchesQuery = !q || [row.puesto_votacion, row.mesa_votacion, row.descripcion, row.estado, labels[row.tipo_reporte] || row.tipo_reporte]
        .some(value => String(value ?? "").toLocaleLowerCase("es").includes(q));
      return matchesQuery && (!state.type || row.tipo_reporte === state.type);
    });
    render();
  }
  function render() {
    const root = $("operationalReportsList");
    const count = $("operationalReportsCount");
    if (!root || !count) return;
    count.textContent = state.filtered.length + (state.filtered.length === 1 ? " reporte" : " reportes");
    if (!state.filtered.length) {
      root.innerHTML = '<div class="activity-empty-drive"><h3>No hay reportes coincidentes</h3><p>Ajusta los filtros o actualiza la bandeja.</p></div>';
      return;
    }
    root.innerHTML = state.filtered.map(row => {
      const type = labels[row.tipo_reporte] || row.tipo_reporte || "Sin tipo";
      return '<article class="pqrs-record operational-report-card">' +
        '<div class="pqrs-record-head"><span class="pqrs-type-tag">' + escape(type) + '</span>' +
        '<h3>' + escape(row.puesto_votacion) + '</h3><span class="pqrs-record-meta">' + escape(dateLabel(row.created_at)) + '</span></div>' +
        '<div class="operational-report-meta"><span><strong>Mesa:</strong> ' + escape(row.mesa_votacion) + '</span>' +
        '<span><strong>Estado:</strong> ' + escape(row.estado) + '</span></div>' +
        '<p class="pqrs-record-description">' + escape(row.descripcion) + '</p>' +
        '<small class="operational-report-readonly">Consulta · Solo lectura</small></article>';
    }).join("");
  }
  async function checkAccess() {
    if (isPrimaryAdmin()) return true;
    if (!["operator", "viewer"].includes(window.MIRA_CURRENT_USER?.role)) return false;
    if (!window.MIRA_DATA?.listMyModulePermissions) return false;
    try {
      const permissions = await window.MIRA_DATA.listMyModulePermissions();
      return Array.isArray(permissions) && permissions.some(item =>
        item.module_key === "reportes" && item.action_key === "view" && item.allowed === true);
    } catch (error) {
      console.warn("[MIRA Reportes Operativos] No fue posible verificar el permiso.", error);
      return false;
    }
  }
  async function load() {
    if (state.loading) return;
    const root = $("operationalReportsList");
    if (!root) return;
    state.loading = true;
    root.textContent = "Consultando reportes operativos…";
    $("refreshOperationalReportsBtn").disabled = true;
    try {
      if (!window.MIRA_CURRENT_USER?.authUserId) throw new Error("Inicia sesión para consultar esta bandeja.");
      state.authorized = await checkAccess();
      if (!state.authorized) throw new Error("No tienes asignado el permiso de consulta de Reportes Operativos.");
      if (!window.MIRA_DATA?.listOperationalReports) throw new Error("El servicio de consulta no está disponible.");
      const rows = await window.MIRA_DATA.listOperationalReports({ limit: 100 });
      if (!Array.isArray(rows)) throw new Error("La respuesta de Reportes Operativos no es válida.");
      state.rows = rows;
      applyFilters();
      notice("Información actualizada. Esta bandeja no permite modificar ni eliminar reportes.");
    } catch (error) {
      state.rows = []; state.filtered = [];
      root.textContent = error.message || "No fue posible consultar los reportes.";
      $("operationalReportsCount").textContent = "Sin datos";
      notice(root.textContent, true);
    } finally {
      state.loading = false;
      $("refreshOperationalReportsBtn").disabled = false;
    }
  }
  function open() {
    const panel = $("dropdown-reportes-operativos");
    if (!panel || panel.classList.contains("module-access-restricted")) return;
    panel.open = true;
    load();
  }
  function init() {
    $("openOperationalReportsBtn")?.addEventListener("click", open);
    $("refreshOperationalReportsBtn")?.addEventListener("click", load);
    $("operationalReportsSearch")?.addEventListener("input", event => { state.query = event.target.value; applyFilters(); });
    $("operationalReportsType")?.addEventListener("change", event => { state.type = event.target.value; applyFilters(); });
    $("dropdown-reportes-operativos")?.addEventListener("toggle", event => {
      if (event.target.open && !state.rows.length && !state.loading) load();
    });
    window.addEventListener("mira:authenticated", () => {
      state.rows = []; state.filtered = [];
      const panel = $("dropdown-reportes-operativos");
      if (panel && !panel.classList.contains("module-access-restricted")) load();
    });
    window.addEventListener("mira:signed-out", () => {
      state.rows = []; state.filtered = []; state.authorized = false;
      $("operationalReportsList").textContent = "Inicia sesión para consultar los reportes.";
      $("operationalReportsCount").textContent = "Sin sesión";
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
