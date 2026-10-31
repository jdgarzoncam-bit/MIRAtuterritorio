/* MIRA TU TERRITORIO — Centro de Operaciones móvil tipo carrusel.
   Solo se activa en pantallas de hasta 600px; no altera la navegación de escritorio. */
(() => {
  const MOBILE_QUERY = '(max-width: 600px)';
  const cards = [
    {id:'dropdown-infomira',icon:'💙',title:'InfoMIRA',desc:'Red de cuidadores y líderes',tone:'blue'},
    {id:'dropdown-logistica',icon:'🚐',title:'Logística',desc:'Transporte y operación Día D',tone:'orange'},
    {id:'dropdown-testigos',icon:'🗳️',title:'Auditoría de testigos',desc:'Actas y evidencias E-14',tone:'violet'},
    {id:'dropdown-puestos',icon:'📊',title:'Info Electoral',desc:'Resultados y estadísticas',tone:'cyan'},
    {id:'dropdown-barrios-puestos',icon:'🏘️',title:'Barrios y puestos',desc:'Consulta territorial',tone:'green'},
    {id:'dropdown-actividades',icon:'📋',title:'Actividades',desc:'Registro y participación',tone:'gold'},
    {id:'dropdown-concejal',icon:'🗓️',title:'Concejal',desc:'Gestión y compromisos',tone:'pink'},
    {id:'mobile-map',icon:'🗺️',title:'Mapa',desc:'Explorar el territorio en pantalla completa',tone:'map',map:true}
  ];
  const init = () => {
    const app = document.getElementById('app-container');
    const sidebar = document.getElementById('mainSidebar');
    const map = document.getElementById('map');
    if (!app || !sidebar || !map || document.getElementById('mobileOperationsHome')) return;
    const home = document.createElement('section');
    home.id = 'mobileOperationsHome';
    home.className = 'mobile-operations-home';
    home.setAttribute('aria-label','Centro de Operaciones móvil');
    home.innerHTML = `
      <header class="mobile-ops-header">
        <div class="mobile-ops-brand"><span class="mobile-ops-brand-mark">TF</span><div><small>TERRITORIO FACA</small><h1>Centro de Operaciones</h1></div></div>
        <span class="mobile-ops-live"><i></i> EN LÍNEA</span>
      </header>
      <div class="mobile-ops-intro"><span>PLATAFORMA DE GESTIÓN TERRITORIAL</span><h2>¿Qué necesitas gestionar?</h2><p>Desliza las tarjetas para explorar los módulos.</p></div>
      <div class="mobile-ops-carousel-wrap">
        <button class="mobile-ops-arrow mobile-ops-prev" type="button" aria-label="Módulo anterior">‹</button>
        <div class="mobile-ops-carousel" id="mobileOpsCarousel" tabindex="0" aria-label="Carrusel de módulos">
          ${cards.map((card,i)=>`<button class="mobile-ops-card tone-${card.tone}" type="button" data-target="${card.id}" data-index="${i}" aria-label="Abrir ${card.title}">
            <span class="mobile-ops-card-top"><span class="mobile-ops-card-icon">${card.icon}</span><span class="mobile-ops-card-number">${String(i+1).padStart(2,'0')} / 08</span></span>
            <span class="mobile-ops-card-content"><small>${card.map?'ACCESO TERRITORIAL':'MÓDULO DE GESTIÓN'}</small><strong>${card.title}</strong><span>${card.desc}</span></span>
            <span class="mobile-ops-card-open">Tocar para abrir <b>↗</b></span>
          </button>`).join('')}
        </div>
        <button class="mobile-ops-arrow mobile-ops-next" type="button" aria-label="Módulo siguiente">›</button>
      </div>
      <div class="mobile-ops-pagination" id="mobileOpsPagination">${cards.map((_,i)=>`<button type="button" data-index="${i}" aria-label="Ir al módulo ${i+1}"></button>`).join('')}</div>
      <footer class="mobile-ops-footer"><span>Desliza para cambiar de módulo</span><span>● ● ●</span></footer>
    `;
    app.insertBefore(home, app.firstChild);
    const back = document.createElement('button');
    back.id='mobileOpsBack';
    back.className='mobile-ops-back';
    back.type='button';
    back.innerHTML='<span>‹</span><b>Centro de Operaciones</b>';
    back.setAttribute('aria-label','Volver al Centro de Operaciones');
    app.appendChild(back);

    const carousel=home.querySelector('#mobileOpsCarousel');
    const cardEls=[...carousel.querySelectorAll('.mobile-ops-card')];
    const dots=[...home.querySelectorAll('#mobileOpsPagination button')];
    const isMobile=()=>window.matchMedia(MOBILE_QUERY).matches;
    let active=0;
    let observer=null;
    const setActive=(index)=>{
      active=Math.max(0,Math.min(cards.length-1,index));
      cardEls.forEach((el,i)=>{el.classList.toggle('is-active',i===active);el.setAttribute('aria-current',i===active?'true':'false');});
      dots.forEach((el,i)=>el.classList.toggle('is-active',i===active));
    };
    const goTo=(index)=>{
      const target=Math.max(0,Math.min(cards.length-1,index));
      cardEls[target].scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
      setActive(target);
    };
    const enterModule=(card)=>{
      if(!isMobile()) return;
      home.hidden=true;
      app.classList.remove('mobile-operations-home-active','mobile-operations-map-active');
      if(card.map){
        sidebar.hidden=true;
        app.classList.add('mobile-operations-map-active');
        back.classList.add('is-visible');
        back.querySelector('b').textContent='Volver a módulos';
        const floating=document.getElementById('floatingPuestoWidget');
        if(floating) floating.classList.add('hidden');
        requestAnimationFrame(()=>{if(window.map && typeof window.map.invalidateSize==='function')window.map.invalidateSize({pan:false,animate:false});});
        return;
      }
      sidebar.hidden=false;
      app.classList.add('mobile-operations-module-active');
      const selected=document.getElementById(card.id);
      if(selected){
        document.querySelectorAll('#mainSidebar details.custom-dropdown').forEach(d=>{d.open=d===selected;});
        document.querySelectorAll('#mainSidebar details.custom-dropdown').forEach(d=>d.querySelector(':scope > summary')?.setAttribute('aria-expanded',String(d===selected)));
      }
      back.classList.add('is-visible');
      back.querySelector('b').textContent='Volver a módulos';
      const moduleTop=sidebar.querySelector('.neo-tactile-sidebar');
      if(moduleTop) moduleTop.scrollTop=0;
      requestAnimationFrame(()=>{if(window.map && typeof window.map.invalidateSize==='function')window.map.invalidateSize({pan:false,animate:false});});
    };
    cardEls.forEach((el,i)=>{
      el.addEventListener('click',()=>{
        if(i!==active){goTo(i);return;}
        enterModule(cards[i]);
      });
    });
    dots.forEach((dot,i)=>dot.addEventListener('click',()=>goTo(i)));
    home.querySelector('.mobile-ops-prev').addEventListener('click',()=>goTo(active-1));
    home.querySelector('.mobile-ops-next').addEventListener('click',()=>goTo(active+1));
    carousel.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight'){e.preventDefault();goTo(active+1);}
      if(e.key==='ArrowLeft'){e.preventDefault();goTo(active-1);}
      if(e.key==='Enter') enterModule(cards[active]);
    });
    if('IntersectionObserver' in window){
      observer=new IntersectionObserver(entries=>{
        const best=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
        if(best) setActive(Number(best.target.dataset.index));
      },{root:carousel,threshold:[.45,.6,.75,.9]});
      cardEls.forEach(el=>observer.observe(el));
    }
    back.addEventListener('click',()=>{
      app.classList.remove('mobile-operations-module-active','mobile-operations-map-active');
      sidebar.hidden=false;
      home.hidden=false;
      back.classList.remove('is-visible');
      document.querySelectorAll('#mainSidebar details.custom-dropdown').forEach(d=>{d.open=false;d.querySelector(':scope > summary')?.setAttribute('aria-expanded','false');});
      requestAnimationFrame(()=>{if(window.map && typeof window.map.invalidateSize==='function')window.map.invalidateSize({pan:false,animate:false});});
    });
    const applyViewport=()=>{
      if(isMobile()){
        if(!app.classList.contains('mobile-operations-module-active')&&!app.classList.contains('mobile-operations-map-active')){
          home.hidden=false;sidebar.hidden=true;app.classList.add('mobile-operations-home-active');
        }
      }else{
        app.classList.remove('mobile-operations-home-active','mobile-operations-module-active','mobile-operations-map-active');
        home.hidden=true;sidebar.hidden=false;back.classList.remove('is-visible');
        document.querySelectorAll('#mainSidebar details.custom-dropdown').forEach(d=>d.open=false);
      }
    };
    window.addEventListener('resize',applyViewport,{passive:true});
    setActive(0);
    applyViewport();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
