(function initElectoralDashboard() {
  const root = document.getElementById('electoralDashboard');
  if (!root) return;
  const datasets = {2019: window.MTT_ELECTORAL_2019, 2023: window.MTT_ELECTORAL_2023};
  const fmt = n => Number(n || 0).toLocaleString('es-CO');
  const year = document.getElementById('electoralYearFilter');
  const kpis = document.getElementById('electoralGlobalKpis');
  const zone = document.getElementById('electoralZoneFilter');
  const post = document.getElementById('electoralPostFilter');
  const list = document.getElementById('electoralPostList');
  if (!year || !kpis || !zone || !post || !list) return;
  let data;
  function render() {
    const z = zone.value, p = post.value;
    const filtered = data.puestos.filter(x => (!z || String(x.zona)===z) && (!p || `${x.zona}-${x.puesto}`===p));
    list.innerHTML = filtered.map(x => `<article class="electoral-post-card"><div class="electoral-post-card-head"><strong>Z${x.zona} · P${x.puesto} — ${x.nombre}</strong><span>${x.mesas} mesas</span></div><div class="electoral-post-card-total">${fmt(x.votosTotales)} <small>votos totales</small></div><div class="electoral-post-card-stats"><span>Nulos <b>${fmt(x.votosNulos)}</b></span><span>Blanco <b>${fmt(x.votosBlanco)}</b></span><span>No marcados <b>${fmt(x.votosNoMarcados)}</b></span><span>Diana <b>${fmt(x.votosDiana)}</b></span></div></article>`).join('') || '<p class="placeholder-text">No hay puestos para los filtros seleccionados.</p>';
  }
  function refreshPostOptions() {
    const z = zone.value, old = post.value;
    post.innerHTML = '<option value="">Todos los puestos</option>';
    data.puestos.filter(x => !z || String(x.zona)===z).forEach(x => post.add(new Option(`Puesto ${x.puesto} · ${x.nombre}`, `${x.zona}-${x.puesto}`)));
    if ([...post.options].some(o=>o.value===old)) post.value=old;
    render();
  }
  function loadYear() {
    data = datasets[year.value];
    if (!data) { list.innerHTML='<p class="placeholder-text">No hay datos disponibles para este año.</p>'; return; }
    const sum = key => data.puestos.reduce((acc, p) => acc + Number(p[key] || 0), 0);
    kpis.innerHTML = [['Votos totales',sum('votosTotales')],['Votos nulos',sum('votosNulos')],['Votos en blanco',sum('votosBlanco')],['No marcados',sum('votosNoMarcados')],['Diana Marcela Morales Gutiérrez',sum('votosDiana')]].map(([label,value])=>`<div class="electoral-global-kpi"><strong>${fmt(value)}</strong><small>${label}</small></div>`).join('');
    zone.innerHTML='<option value="">Todas las zonas</option>';
    [...new Set(data.puestos.map(p=>p.zona))].sort((a,b)=>a-b).forEach(z=>zone.add(new Option(`Zona ${z}`,String(z))));
    post.innerHTML='<option value="">Todos los puestos</option>';
    refreshPostOptions();
    const note=root.querySelector('.electoral-source-note'); if(note) note.textContent=`Fuente: base electoral suministrada · Hoja Elecciones_${year.value}. Se excluyen filas de agrupaciones para evitar doble conteo.`;
  }
  year.addEventListener('change',loadYear); zone.addEventListener('change',refreshPostOptions); post.addEventListener('change',render); loadYear();
})();
