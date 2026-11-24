/* MIRA TU TERRITORIO — navegación móvil estable y recuperación de módulos. */
(()=> {
 const MQ='(max-width:600px)';
 // La intención de ingresar es efímera: nunca se hereda de una sesión restaurada,
 // de una recarga ni de una página recuperada desde la caché del navegador.
 let mobileLoginRequested=false;
 window.MIRA_MOBILE_LOGIN_REQUESTED=false;
  const loginRequested=()=>mobileLoginRequested===true||window.MIRA_MOBILE_LOGIN_REQUESTED===true;
 const cards=[
  {id:'dropdown-infomira',icon:'💙',title:'InfoMIRA',desc:'Red de cuidadores y líderes',tone:'blue',mapPanel:true},
  {id:'dropdown-testigos',icon:'🗳️',title:'Auditoría de testigos',desc:'Actas y evidencias E-14',tone:'violet'},
  {id:'dropdown-puestos',icon:'📊',title:'Info Electoral',desc:'Resultados y estadísticas',tone:'cyan'},
  {id:'dropdown-barrios-puestos',icon:'🏘️',title:'Barrios y puestos',desc:'Consulta territorial',tone:'green',mapPanel:true},
  {id:'dropdown-actividades',icon:'📋',title:'Actividades',desc:'Registro y participación',tone:'gold',workspace:'activities'},
  {id:'dropdown-concejal',icon:'🗓️',title:'Concejal',desc:'Gestión y compromisos',tone:'pink',workspace:'concejal'},
  {id:'mobile-map',icon:'🗺️',title:'Mapa',desc:'Explorar el territorio en pantalla completa',tone:'map',map:true}
 ];
 function installKeyboardFix(){
  if(window.__MIRA_MOBILE_KEYBOARD_FIX__)return;
  window.__MIRA_MOBILE_KEYBOARD_FIX__=true;
  let savedScroll=null,keyboardBaseline=0,keyboardOpen=false,restorePending=false;
  const editable=el=>el instanceof HTMLElement&&el.matches('input:not([readonly]):not([type=checkbox]):not([type=radio]),textarea:not([readonly]),select');
  const restore=()=>{
   if(!keyboardOpen||!matchMedia(MQ).matches)return;
   const vv=window.visualViewport;
   const currentHeight=vv?.height||window.innerHeight;
   if(keyboardBaseline&&currentHeight<keyboardBaseline*.9)return;
   keyboardOpen=false;
   document.documentElement.classList.remove('mira-mobile-keyboard-open');
   if(restorePending)return;
   restorePending=true;
   const position=savedScroll;
   requestAnimationFrame(()=>{
    if(position)window.scrollTo({left:position.x,top:position.y,behavior:'auto'});
    savedScroll=null;keyboardBaseline=0;restorePending=false;
   });
  };
  document.addEventListener('focusin',event=>{
   if(!matchMedia(MQ).matches||!editable(event.target))return;
   if(!keyboardOpen){
    savedScroll={x:window.scrollX,y:window.scrollY};
    keyboardBaseline=window.visualViewport?.height||window.innerHeight;
   }
   keyboardOpen=true;
   document.documentElement.classList.add('mira-mobile-keyboard-open');
  },true);
  document.addEventListener('focusout',()=>{
   window.setTimeout(()=>{
    if(!editable(document.activeElement))restore();
    else if(window.visualViewport&&keyboardBaseline&&window.visualViewport.height>=keyboardBaseline*.9)restore();
   },180);
  },true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!editable(document.activeElement))window.setTimeout(restore,90);});
  window.addEventListener('pageshow',()=>{if(!editable(document.activeElement))window.setTimeout(restore,90);});
  window.visualViewport?.addEventListener('resize',()=>{
   if(keyboardOpen&&keyboardBaseline&&window.visualViewport.height>=keyboardBaseline*.9)window.setTimeout(restore,70);
  },{passive:true});
 }
 function init(){
  installKeyboardFix();
  const app=document.getElementById('app-container'),sidebar=document.getElementById('mainSidebar'),map=document.getElementById('map');
  if(!app||!sidebar||document.getElementById('mobileOperationsHome'))return;
  const home=document.createElement('section');home.id='mobileOperationsHome';home.className='mobile-operations-home';home.setAttribute('aria-label','Centro de Operaciones móvil');
  home.innerHTML=`<header class="mobile-ops-header"><div class="mobile-ops-brand"><span class="mobile-ops-brand-mark">TF</span><div><small>TERRITORIO FACA</small><h1>Centro de Operaciones</h1></div></div><div class="mobile-ops-header-actions"><span class="mobile-ops-live"><i></i> EN LÍNEA</span><button class="mobile-ops-exit" id="mobileOpsExit" type="button" aria-label="Salir del Centro de Operaciones">Salir <span>↗</span></button></div></header>
  <div class="mobile-ops-intro"><span>PLATAFORMA DE GESTIÓN TERRITORIAL</span><h2>¿Qué necesitas gestionar?</h2><p>Desliza las tarjetas para explorar los módulos.</p></div>
  <div class="mobile-ops-carousel-wrap"><button class="mobile-ops-arrow mobile-ops-prev" type="button" aria-label="Módulo anterior">‹</button><div class="mobile-ops-carousel" id="mobileOpsCarousel" tabindex="0" aria-label="Carrusel de módulos">${cards.map((c,i)=>`<button class="mobile-ops-card tone-${c.tone}" type="button" data-index="${i}" data-target="${c.id}" aria-label="Abrir ${c.title}"><span class="mobile-ops-card-top"><span class="mobile-ops-card-icon">${c.icon}</span><span class="mobile-ops-card-number">${String(i+1).padStart(2,'0')} / 07</span></span><span class="mobile-ops-card-content"><small>${c.map?'ACCESO TERRITORIAL':'MÓDULO DE GESTIÓN'}</small><strong>${c.title}</strong><span>${c.desc}</span></span><span class="mobile-ops-card-open">Tocar para abrir <b>↗</b></span></button>`).join('')}</div><button class="mobile-ops-arrow mobile-ops-next" type="button" aria-label="Módulo siguiente">›</button></div>
  <div class="mobile-ops-pagination" id="mobileOpsPagination">${cards.map((_,i)=>`<button type="button" data-index="${i}" aria-label="Ir al módulo ${i+1}"></button>`).join('')}</div><footer class="mobile-ops-footer"><span>Desliza para cambiar de módulo</span></footer>`;
  app.insertBefore(home,app.firstChild);
  let back=document.getElementById('mobileOpsBack');
  if(!back){back=document.createElement('button');back.id='mobileOpsBack';back.className='mobile-ops-back';back.type='button';back.innerHTML='<span aria-hidden="true">☰</span><b>Módulos</b>';back.setAttribute('aria-label','Volver al menú de módulos del Centro de Operaciones');document.body.appendChild(back);}
  back.hidden=true;
  const carousel=home.querySelector('#mobileOpsCarousel'),els=[...carousel.querySelectorAll('.mobile-ops-card')],dots=[...home.querySelectorAll('#mobileOpsPagination button')];
  const mobile=()=>matchMedia(MQ).matches;let active=0,timer=0,workspaceMode=null,historyStateActive=false,userExitedOperations=false;
  const setActive=i=>{
   active=Math.max(0,Math.min(cards.length-1,i));
   els.forEach((e,n)=>{
    const delta=n-active,depth=Math.abs(delta),side=Math.sign(delta);
    e.classList.toggle('is-active',n===active);
    e.classList.toggle('is-prev',delta<0);
    e.classList.toggle('is-next',delta>0);
    e.style.setProperty('--stack-depth',String(depth));
    e.style.setProperty('--stack-x',depth===0?'0px':(side* Math.min(depth*5,18))+'px');
    e.style.setProperty('--stack-y',depth===0?'0px':(-Math.min(depth*11,44))+'px');
    e.style.setProperty('--stack-rotate',depth===0?'0deg':(side* Math.min(depth*2.2,8))+'deg');
    e.style.setProperty('--stack-scale',String(Math.max(.82,1-depth*.045)));
    e.style.setProperty('--stack-opacity',String(Math.max(.42,1-depth*.105)));
    e.style.zIndex=String(20-depth);
    e.setAttribute('aria-current',n===active?'true':'false');
    e.tabIndex=n===active?0:-1;
   });
   dots.forEach((d,n)=>{d.classList.toggle('is-active',n===active);d.setAttribute('aria-current',n===active?'true':'false')});
  };
  const centered=()=>active;
  const go=i=>{setActive(i)};
  const resizeMap=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{window.dispatchEvent(new Event('resize'));window.dispatchEvent(new CustomEvent('mira:mobile-map-visible'))}));
  const closeWorkspace=()=>{
   if(workspaceMode==='activities'){
    if(typeof window.MIRA_CLOSE_ACTIVITIES==='function')window.MIRA_CLOSE_ACTIVITIES();
    else document.getElementById('closeActivitiesPlaceholder')?.click();
    document.getElementById('activitiesPlaceholder')?.classList.add('hidden');
   }
   if(workspaceMode==='concejal'){
    document.getElementById('closeConcejalModuleBtn')?.click();
    document.getElementById('concejalWorkspace')?.classList.add('hidden');
   }
   workspaceMode=null;
  };
  const resetDropdowns=()=>{
   document.querySelectorAll('#mainSidebar details.custom-dropdown').forEach(d=>{
    d.open=false;d.classList.remove('mobile-ops-selected-module');d.removeAttribute('aria-hidden');
    d.querySelector(':scope > summary')?.setAttribute('aria-expanded','false');
   });
  };
  const closeToHome=(fromPopstate=false)=>{
   userExitedOperations=false;
   closeWorkspace();
   app.classList.remove('mobile-operations-module-active','mobile-operations-map-active','mobile-operations-map-panel-active','mobile-operations-workspace-active');
   app.classList.add('mobile-operations-home-active');
   sidebar.hidden=true;home.hidden=false;back.hidden=true;back.classList.remove('is-visible');
   resetDropdowns();resizeMap();
   if(!fromPopstate&&historyStateActive){historyStateActive=false;window.history.back();}
  };
  const exitToPlatform=()=>{
   userExitedOperations=true;
   mobileLoginRequested=false;
   window.MIRA_MOBILE_LOGIN_REQUESTED=false;
   closeWorkspace();
   const hadHistory=historyStateActive;historyStateActive=false;
   app.classList.remove('mobile-operations-home-active','mobile-operations-module-active','mobile-operations-map-active','mobile-operations-map-panel-active','mobile-operations-workspace-active');
   home.hidden=true;back.hidden=true;back.classList.remove('is-visible');
   resetDropdowns();
   if(hadHistory)window.history.back();
   // Primero se restaura visualmente la portada y se elimina la intención de
   // acceso móvil; luego el botón existente cierra la sesión real de Neon Auth.
   restorePublicLanding();
   document.getElementById('platformHomeBtn')?.click();
   document.body.classList.remove('pmu-neomorphic');
  };
  const ensureHistory=()=>{if(!historyStateActive){window.history.pushState({miraMobileOperations:true},'','#centro-operaciones');historyStateActive=true}};
  const open=async card=>{
   if(!mobile())return;
   userExitedOperations=false;
   ensureHistory();home.hidden=true;
   app.classList.remove('mobile-operations-home-active','mobile-operations-map-active','mobile-operations-module-active','mobile-operations-map-panel-active','mobile-operations-workspace-active');
   if(card.map){sidebar.hidden=true;app.classList.add('mobile-operations-map-active');back.hidden=false;back.classList.add('is-visible');document.getElementById('floatingPuestoWidget')?.classList.add('hidden');resizeMap();return}
   sidebar.hidden=false;
   document.querySelectorAll('#mainSidebar details.custom-dropdown').forEach(d=>{const yes=d.id===card.id;d.open=yes;d.classList.toggle('mobile-ops-selected-module',yes);d.querySelector(':scope > summary')?.setAttribute('aria-expanded',String(yes));d.setAttribute('aria-hidden',String(!yes));});
   back.hidden=false;back.classList.add('is-visible');
   if(card.workspace){
    workspaceMode=card.workspace;app.classList.add('mobile-operations-workspace-active');
    requestAnimationFrame(async()=>{
     try{
      if(card.workspace==='activities'){
       if(typeof window.MIRA_OPEN_ACTIVITIES==='function')await window.MIRA_OPEN_ACTIVITIES('all');
       else document.getElementById('sideAllActivitiesBtn')?.click();
       if(document.getElementById('activitiesPlaceholder')?.classList.contains('hidden'))closeToHome(true);
      }else{
       document.getElementById('openConcejalRegisterBtn')?.click();
       if(document.getElementById('concejalWorkspace')?.classList.contains('hidden'))closeToHome(true);
      }
     }catch(error){console.error('[MIRA móvil] No fue posible abrir el módulo:',error);closeToHome(true);}
    });
    return;
   }
   if(card.mapPanel){app.classList.add('mobile-operations-map-panel-active');const side=sidebar.querySelector('.neo-tactile-sidebar');if(side)side.scrollTop=0;resizeMap();return}
   app.classList.add('mobile-operations-module-active');const side=sidebar.querySelector('.neo-tactile-sidebar');if(side)side.scrollTop=0;resizeMap();
  };
  const onBack=()=>{
   if(!mobile()||!window.MIRA_CURRENT_USER||!document.body.classList.contains('pmu-neomorphic')){
    back.hidden=true;back.classList.remove('is-visible');return;
   }
   closeToHome(false);
  };
  home.querySelector('#mobileOpsExit')?.addEventListener('click',exitToPlatform);
  const showOperationsHome=()=>{
   if(!mobile()||!window.MIRA_CURRENT_USER||!document.body.classList.contains('pmu-neomorphic'))return;
   document.body.classList.remove('mira-mobile-public-landing');
   userExitedOperations=false;
   app.style.display='block';
   app.classList.remove('mobile-operations-module-active','mobile-operations-map-active','mobile-operations-map-panel-active','mobile-operations-workspace-active');
   app.classList.add('mobile-operations-home-active');
   home.hidden=false;sidebar.hidden=true;back.hidden=true;back.classList.remove('is-visible');
   resizeMap();
  };
  window.MIRA_SHOW_MOBILE_MODULES=showOperationsHome;
  document.getElementById('landingModulesBtn')?.addEventListener('click',()=>{
   if(window.MIRA_CURRENT_USER&&document.body.classList.contains('pmu-neomorphic')){showOperationsHome();return;}
   if(typeof window.abrirLoginAdmin==='function')window.abrirLoginAdmin();
   else document.getElementById('landingLoginBtn')?.click();
  });
  const restorePublicLanding=()=>{
   // La restauración inicial de Neon puede emitir mira:signed-out antes de
   // que el usuario envíe el formulario. No cancelar la intención de login.
   if(document.body.classList.contains('admin-login-active'))return;
   mobileLoginRequested=false;
   window.MIRA_MOBILE_LOGIN_REQUESTED=false;
   userExitedOperations=true;
   document.body.classList.add('mira-mobile-public-landing');
   back.hidden=true;back.classList.remove('is-visible');
   app.classList.remove('mobile-operations-home-active','mobile-operations-module-active','mobile-operations-map-active','mobile-operations-map-panel-active','mobile-operations-workspace-active');
   home.hidden=true;sidebar.hidden=false;back.hidden=true;back.classList.remove('is-visible');
   app.style.display='none';
   document.body.classList.remove('pmu-neomorphic');
   document.getElementById('landing-hero-overlay')?.style.setProperty('display','flex');
   document.getElementById('landingHeaderControls')?.style.setProperty('display','flex');
  };
  const markMobileLoginRequested=()=>{if(!mobile())return;mobileLoginRequested=true;window.MIRA_MOBILE_LOGIN_REQUESTED=true;};
  document.getElementById('landingLoginBtn')?.addEventListener('click',markMobileLoginRequested);
  window.addEventListener('mira:mobile-login-requested',markMobileLoginRequested);
   document.getElementById('cancelAdminInlineBtn')?.addEventListener('click',()=>{if(mobile()&&!window.MIRA_CURRENT_USER){mobileLoginRequested=false;window.MIRA_MOBILE_LOGIN_REQUESTED=false;}});
  window.addEventListener('mira:authenticated',()=>requestAnimationFrame(()=>{
   if(mobile()&&!mobileLoginRequested){restorePublicLanding();return;}
   showOperationsHome();
  }));
  window.addEventListener('mira:pmu-ready',()=>{
   if(!mobile()||!loginRequested()||!window.MIRA_CURRENT_USER)return;
   // El PMU puede terminar de mostrarse un frame después de inicializar el mapa.
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(loginRequested()&&window.MIRA_CURRENT_USER)showOperationsHome();
   }));
  });
  window.addEventListener('mira:signed-out',restorePublicLanding);
  window.addEventListener('pageshow',()=>{
   if(!mobile()||document.body.classList.contains('admin-login-active'))return;
   // Una sesión restaurada no debe saltarse la portada pública ni abrir el PMU automáticamente.
   // El Centro de Operaciones solo aparece después de que el usuario pulse Ingresar.
   if(!loginRequested()){restorePublicLanding();return;}
   if(window.MIRA_CURRENT_USER&&document.body.classList.contains('pmu-neomorphic')){
    if(!app.classList.contains('mobile-operations-module-active')&&!app.classList.contains('mobile-operations-map-active')&&!app.classList.contains('mobile-operations-map-panel-active')&&!app.classList.contains('mobile-operations-workspace-active'))showOperationsHome();
   }else restorePublicLanding();
  });
  els.forEach((el,i)=>el.addEventListener('click',()=>{if(i!==active){go(i);return}open(cards[i])}));
  dots.forEach((d,i)=>d.addEventListener('click',()=>go(i)));
  home.querySelector('.mobile-ops-prev').addEventListener('click',()=>go(centered()-1));home.querySelector('.mobile-ops-next').addEventListener('click',()=>go(centered()+1));
  let swipeStartX=0,swipeStartY=0;
  carousel.addEventListener('touchstart',e=>{const t=e.touches[0];swipeStartX=t.clientX;swipeStartY=t.clientY},{passive:true});
  carousel.addEventListener('touchend',e=>{const t=e.changedTouches[0],dx=t.clientX-swipeStartX,dy=t.clientY-swipeStartY;if(Math.abs(dx)>38&&Math.abs(dx)>Math.abs(dy)*1.15)go(active+(dx<0?1:-1))},{passive:true});
  carousel.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();go(centered()+1)}if(e.key==='ArrowLeft'){e.preventDefault();go(centered()-1)}if(e.key==='Enter'){e.preventDefault();open(cards[centered()])}});
  back.addEventListener('click',onBack);
  back.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onBack();}});
  window.addEventListener('popstate',()=>{if(historyStateActive){historyStateActive=false;closeToHome(true)}});
  document.addEventListener('click',event=>{
   const close=event.target?.closest?.('#closeActivitiesPlaceholder,#returnFromActivities,#closeConcejalModuleBtn');
   if(!close||!mobile())return;
   window.setTimeout(()=>{
    const activitiesHidden=document.getElementById('activitiesPlaceholder')?.classList.contains('hidden')!==false;
    const concejalHidden=document.getElementById('concejalWorkspace')?.classList.contains('hidden')!==false;
    if((workspaceMode==='activities'&&activitiesHidden)||(workspaceMode==='concejal'&&concejalHidden))closeToHome(false);
   },0);
  },true);
  const viewport=()=>{if(document.body.classList.contains('admin-login-active'))return;if(mobile()){
   if(!mobileLoginRequested||!window.MIRA_CURRENT_USER||!document.body.classList.contains('pmu-neomorphic')){restorePublicLanding();return;}
   if(userExitedOperations)return;
   if(!app.classList.contains('mobile-operations-module-active')&&!app.classList.contains('mobile-operations-map-active')&&!app.classList.contains('mobile-operations-map-panel-active')&&!app.classList.contains('mobile-operations-workspace-active')&&!app.classList.contains('mobile-operations-home-active'))showOperationsHome();
  }else{userExitedOperations=false;document.body.classList.remove('mira-mobile-public-landing');app.classList.remove('mobile-operations-home-active','mobile-operations-module-active','mobile-operations-map-active','mobile-operations-map-panel-active','mobile-operations-workspace-active');home.hidden=true;sidebar.hidden=false;back.hidden=true;back.classList.remove('is-visible');historyStateActive=false;resetDropdowns()}};
  window.addEventListener('resize',viewport,{passive:true});setActive(0);home.hidden=true;back.hidden=true;viewport();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
