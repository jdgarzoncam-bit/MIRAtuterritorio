/* MIRA TU TERRITORIO — navegación móvil, selección por tarjeta centrada. */
(()=> {
 const MQ='(max-width:600px)';
 const cards=[
  {id:'dropdown-infomira',icon:'💙',title:'InfoMIRA',desc:'Red de cuidadores y líderes',tone:'blue'},
  {id:'dropdown-logistica',icon:'🚐',title:'Logística',desc:'Transporte y operación Día D',tone:'orange'},
  {id:'dropdown-testigos',icon:'🗳️',title:'Auditoría de testigos',desc:'Actas y evidencias E-14',tone:'violet'},
  {id:'dropdown-puestos',icon:'📊',title:'Info Electoral',desc:'Resultados y estadísticas',tone:'cyan'},
  {id:'dropdown-barrios-puestos',icon:'🏘️',title:'Barrios y puestos',desc:'Consulta territorial',tone:'green'},
  {id:'dropdown-actividades',icon:'📋',title:'Actividades',desc:'Registro y participación',tone:'gold',workspace:'activities'},
  {id:'dropdown-concejal',icon:'🗓️',title:'Concejal',desc:'Gestión y compromisos',tone:'pink',workspace:'concejal'},
  {id:'mobile-map',icon:'🗺️',title:'Mapa',desc:'Explorar el territorio en pantalla completa',tone:'map',map:true}
 ];
 function init(){
  const app=document.getElementById('app-container'),sidebar=document.getElementById('mainSidebar'),map=document.getElementById('map');
  if(!app||!sidebar||!map||document.getElementById('mobileOperationsHome'))return;
  const home=document.createElement('section');home.id='mobileOperationsHome';home.className='mobile-operations-home';home.setAttribute('aria-label','Centro de Operaciones móvil');
  home.innerHTML=`<header class="mobile-ops-header"><div class="mobile-ops-brand"><span class="mobile-ops-brand-mark">TF</span><div><small>TERRITORIO FACA</small><h1>Centro de Operaciones</h1></div></div><span class="mobile-ops-live"><i></i> EN LÍNEA</span></header>
  <div class="mobile-ops-intro"><span>PLATAFORMA DE GESTIÓN TERRITORIAL</span><h2>¿Qué necesitas gestionar?</h2><p>Desliza las tarjetas para explorar los módulos.</p></div>
  <div class="mobile-ops-carousel-wrap"><button class="mobile-ops-arrow mobile-ops-prev" type="button" aria-label="Módulo anterior">‹</button><div class="mobile-ops-carousel" id="mobileOpsCarousel" tabindex="0" aria-label="Carrusel de módulos">${cards.map((c,i)=>`<button class="mobile-ops-card tone-${c.tone}" type="button" data-index="${i}" data-target="${c.id}" aria-label="Abrir ${c.title}"><span class="mobile-ops-card-top"><span class="mobile-ops-card-icon">${c.icon}</span><span class="mobile-ops-card-number">${String(i+1).padStart(2,'0')} / 08</span></span><span class="mobile-ops-card-content"><small>${c.map?'ACCESO TERRITORIAL':'MÓDULO DE GESTIÓN'}</small><strong>${c.title}</strong><span>${c.desc}</span></span><span class="mobile-ops-card-open">Tocar para abrir <b>↗</b></span></button>`).join('')}</div><button class="mobile-ops-arrow mobile-ops-next" type="button" aria-label="Módulo siguiente">›</button></div>
  <div class="mobile-ops-pagination" id="mobileOpsPagination">${cards.map((_,i)=>`<button type="button" data-index="${i}" aria-label="Ir al módulo ${i+1}"></button>`).join('')}</div><footer class="mobile-ops-footer"><span>Desliza para cambiar de módulo</span></footer>`;
  app.insertBefore(home,app.firstChild);
  const back=document.createElement('button');back.id='mobileOpsBack';back.className='mobile-ops-back';back.type='button';back.innerHTML='<span>‹</span><b>Volver a módulos</b>';back.setAttribute('aria-label','Volver al Centro de Operaciones');document.body.appendChild(back);
  const carousel=home.querySelector('#mobileOpsCarousel'),els=[...carousel.querySelectorAll('.mobile-ops-card')],dots=[...home.querySelectorAll('#mobileOpsPagination button')];
  const mobile=()=>matchMedia(MQ).matches;let active=0,timer=0,workspaceMode=null;
  const setActive=i=>{active=Math.max(0,Math.min(7,i));els.forEach((e,n)=>{e.classList.toggle('is-active',n===active);e.setAttribute('aria-current',n===active?'true':'false')});dots.forEach((d,n)=>d.classList.toggle('is-active',n===active))};
  const centered=()=>{const mid=carousel.getBoundingClientRect().left+carousel.clientWidth/2;let best=0,dist=Infinity;els.forEach((e,i)=>{const r=e.getBoundingClientRect(),d=Math.abs(r.left+r.width/2-mid);if(d<dist){dist=d;best=i}});return best};
  const go=i=>{i=Math.max(0,Math.min(7,i));els[i].scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});setActive(i)};
  const resizeMap=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{window.dispatchEvent(new Event('resize'));window.dispatchEvent(new CustomEvent('mira:mobile-map-visible'))}));
  const closeWorkspace=()=>{if(workspaceMode==='activities')document.getElementById('closeActivitiesPlaceholder')?.click();if(workspaceMode==='concejal')document.getElementById('closeConcejalModuleBtn')?.click();workspaceMode=null};
  const open=card=>{
   if(!mobile())return;home.hidden=true;app.classList.remove('mobile-operations-home-active','mobile-operations-map-active','mobile-operations-module-active','mobile-operations-workspace-active');
   if(card.map){sidebar.hidden=true;app.classList.add('mobile-operations-map-active');back.classList.add('is-visible');document.getElementById('floatingPuestoWidget')?.classList.add('hidden');resizeMap();return}
   sidebar.hidden=false;document.querySelectorAll('#mainSidebar details.custom-dropdown').forEach(d=>{const yes=d.id===card.id;d.open=yes;d.classList.toggle('mobile-ops-selected-module',yes);d.querySelector(':scope > summary')?.setAttribute('aria-expanded',String(yes));d.setAttribute('aria-hidden',String(!yes));});
   back.classList.add('is-visible');
   if(card.workspace){workspaceMode=card.workspace;app.classList.add('mobile-operations-workspace-active');requestAnimationFrame(()=>{if(card.workspace==='activities')document.getElementById('sideOpenActivityModuleBtn')?.click();else document.getElementById('openConcejalRegisterBtn')?.click()});return}
   app.classList.add('mobile-operations-module-active');const side=sidebar.querySelector('.neo-tactile-sidebar');if(side)side.scrollTop=0;resizeMap();
  };
  els.forEach((el,i)=>el.addEventListener('click',()=>{const r=el.getBoundingClientRect(),mid=carousel.getBoundingClientRect().left+carousel.clientWidth/2;if(Math.abs(r.left+r.width/2-mid)>Math.max(24,r.width*.16)){go(i);return}setActive(i);open(cards[i])}));
  dots.forEach((d,i)=>d.addEventListener('click',()=>go(i)));
  home.querySelector('.mobile-ops-prev').addEventListener('click',()=>go(centered()-1));home.querySelector('.mobile-ops-next').addEventListener('click',()=>go(centered()+1));
  carousel.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(()=>setActive(centered()),100)},{passive:true});carousel.addEventListener('scrollend',()=>setActive(centered()),{passive:true});
  carousel.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();go(centered()+1)}if(e.key==='ArrowLeft'){e.preventDefault();go(centered()-1)}if(e.key==='Enter'){e.preventDefault();open(cards[centered()])}});
  back.addEventListener('click',()=>{closeWorkspace();app.classList.remove('mobile-operations-module-active','mobile-operations-map-active','mobile-operations-workspace-active');sidebar.hidden=false;home.hidden=false;back.classList.remove('is-visible');document.querySelectorAll('#mainSidebar details.custom-dropdown').forEach(d=>{d.open=false;d.classList.remove('mobile-ops-selected-module');d.removeAttribute('aria-hidden');d.querySelector(':scope > summary')?.setAttribute('aria-expanded','false')});resizeMap()});
  const viewport=()=>{if(mobile()){if(!app.classList.contains('mobile-operations-module-active')&&!app.classList.contains('mobile-operations-map-active')&&!app.classList.contains('mobile-operations-workspace-active')){home.hidden=false;sidebar.hidden=true;app.classList.add('mobile-operations-home-active')}}else{app.classList.remove('mobile-operations-home-active','mobile-operations-module-active','mobile-operations-map-active','mobile-operations-workspace-active');home.hidden=true;sidebar.hidden=false;back.classList.remove('is-visible');document.querySelectorAll('#mainSidebar details.custom-dropdown').forEach(d=>{d.open=false;d.classList.remove('mobile-ops-selected-module');d.removeAttribute('aria-hidden')})}};
  window.addEventListener('resize',viewport,{passive:true});setActive(0);viewport();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();