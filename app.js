let map = null;
let geojsonLayer = null;
let datosOriginales = null;
let baseVotantes = [];
let puestosLayerGroup = L.layerGroup();
let searchMarkersGroup = L.layerGroup();
let miraMarkersGroup = L.layerGroup();
let poligonosBorradorLayerGroup = L.layerGroup();
let barriosFiltroEstado = {};
let puestosFiltroEstado = {};
let poligonosKmlVisibles = true;
let poligonoSeleccionadoNombre = null;
let poligonosCoincidenciaActiva = new Set();
let poligonosPorNombre = Object.create(null);

let imagenBase64Seleccionada = "";
let listaEvidenciasTestigos = JSON.parse(localStorage.getItem('faca_evidencias_testigos')) || [];

// IDENTIDAD VISUAL FIJA: modo oscuro y español como idioma único.
// Se conservan las funciones de compatibilidad para los módulos existentes.
let currentTheme = 'dark';
let currentLang = 'es';

function aplicarTema() {
    currentTheme = 'dark';
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.lang = 'es';
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
    try { localStorage.setItem('mira_theme', 'dark'); localStorage.setItem('mira_lang', 'es'); } catch (_) {}
}
function aplicarIdioma() {
    currentLang = 'es';
    document.documentElement.lang = 'es';
    try { localStorage.setItem('mira_lang', 'es'); } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
    aplicarTema();
    aplicarIdioma();
});

function normalizarTexto(str) {
    return (str || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
}

function coincidePuesto(v, puesto) {
    if (!v || !puesto) return false;
    const vPuesto = normalizarTexto(v['PUESTO DE VOTACION']);
    const vOrig = normalizarTexto(v['PuestoOriginal']);
    const pMatch = normalizarTexto(puesto.matchName);
    const pNom = normalizarTexto(puesto.nombre);

    return (vPuesto && (vPuesto === pMatch || vPuesto === pNom)) ||
           (vOrig && (vOrig === pMatch || vOrig === pNom));
}

const listaPuestosVotacion = [
    {
        "id": "z1-p1",
        "zona": 1,
        "numero": 1,
        "nombre": "COLEGIO DEPTAL CARTAGENITA",
        "matchName": "COLEGIO DEPTAL CARTAGENITA",
        "direccion": "TV. 2 SUR NO 1A - 105",
        "lat": 4.78466695167,
        "lon": -74.3352500086
    },
    {
        "id": "z1-p2",
        "zona": 1,
        "numero": 2,
        "nombre": "COLEGIO MANABLANCA",
        "matchName": "COLEGIO MANABLANCA",
        "direccion": "SECTOR 2 MANABLANCA",
        "lat": 4.79798086691,
        "lon": -74.34513239511
    },
    {
        "id": "z1-p3",
        "zona": 1,
        "numero": 3,
        "nombre": "COLEGIO JOHN F. KENNEDY",
        "matchName": "COLEGIO JOHN F. KENNEDY",
        "direccion": "KR 2 ESTE NO 1-70",
        "lat": 4.80497,
        "lon": -74.352733
    },
    {
        "id": "z1-p4",
        "zona": 1,
        "numero": 4,
        "nombre": "CENTRO DE DESARROLLO SOCIAL",
        "matchName": "CENTRO DE DESARROLLO SOCIAL",
        "direccion": "KR 2 CL 1 EQ",
        "lat": 4.805636,
        "lon": -74.350336
    },
    {
        "id": "z1-p5",
        "zona": 1,
        "numero": 5,
        "nombre": "COLEGIO SAN AGUSTIN",
        "matchName": "COLEGIO SAN AGUSTIN",
        "direccion": "KR 4 # 1 - 87",
        "lat": 4.80811001596,
        "lon": -74.35056916931
    },
    {
        "id": "z1-p6",
        "zona": 1,
        "numero": 6,
        "nombre": "COLEGIO SILVERIA ESPINOSA",
        "matchName": "COLEGIO SILVERIA ESPINOSA",
        "direccion": "CL 18B NO 4 - 21",
        "lat": 4.82104786836,
        "lon": -74.3632226211
    },
    {
        "id": "z1-p7",
        "zona": 1,
        "numero": 7,
        "nombre": "EL PORTAL DE TUS SUEÑOS",
        "matchName": "EL PORTAL DE TUS SUEÃ‘OS",
        "direccion": "CALLE 21C  # 1 -25  SUR",
        "lat": 4.79013455238,
        "lon": -74.33662258842
    },
    {
        "id": "z1-p8",
        "zona": 1,
        "numero": 8,
        "nombre": "COLEGIO JOHN F KENNEDY SD SAN CRISTOBAL",
        "matchName": "COLEGIO JOHN F KENNEDY SD SAN CRISTOBAL",
        "direccion": "Carrera 1 a sur Numero 10 a 04",
        "lat": 4.81223,
        "lon": -74.36004
    },
    {
        "id": "z1-p9",
        "zona": 1,
        "numero": 9,
        "nombre": "COL. MANUELA AYALA DE GAITAN SD MOLINOS",
        "matchName": "COL. MANUELA AYALA DE GAITAN SD MOLINOS",
        "direccion": "Carrera 4 Numero 14 40",
        "lat": 4.817533,
        "lon": -74.360466
    },
    {
        "id": "z1-p10",
        "zona": 1,
        "numero": 10,
        "nombre": "COLEGIO CARTAGENITA SEDE PRIMARIA",
        "matchName": "COLEGIO CARTAGENITA SEDE PRIMARIA",
        "direccion": "TRANSVERSAL 3 SUR NUMERO 3 A SUR  15",
        "lat": 4.78499786736,
        "lon": -74.33523726814
    },
    {
        "id": "z2-p1",
        "zona": 2,
        "numero": 1,
        "nombre": "INSTITUTO  TECNICO  INDUSTRIAL",
        "matchName": "INSTITUTO  TECNICO  INDUSTRIAL",
        "direccion": "KR 5 # 9 - 45",
        "lat": 4.814387,
        "lon": -74.355527
    },
    {
        "id": "z2-p2",
        "zona": 2,
        "numero": 2,
        "nombre": "ESCUELA RAFAEL POMBO",
        "matchName": "ESCUELA RAFAEL POMBO",
        "direccion": "CARRERA 3 No. 8 - 134",
        "lat": 4.81299479548,
        "lon": -74.35688413625
    },
    {
        "id": "z2-p3",
        "zona": 2,
        "numero": 3,
        "nombre": "COLEGIO MANUELA AYALA DE GAITAN",
        "matchName": "COLEGIO MANUELA AYALA DE GAITAN",
        "direccion": "KR 10 CL 15 ESQ",
        "lat": 4.823145,
        "lon": -74.356602
    },
    {
        "id": "z2-p4",
        "zona": 2,
        "numero": 4,
        "nombre": "COLEGIO SANTA RITA",
        "matchName": "COLEGIO SANTA RITA",
        "direccion": "KR 10 # 9 - 50",
        "lat": 4.81801483559,
        "lon": -74.35279835582
    },
    {
        "id": "z2-p5",
        "zona": 2,
        "numero": 5,
        "nombre": "COLISEO CUBIERTO",
        "matchName": "COLISEO CUBIERTO",
        "direccion": "CL 5 NO 7 - 18",
        "lat": 4.813547,
        "lon": -74.350511
    },
    {
        "id": "z2-p6",
        "zona": 2,
        "numero": 6,
        "nombre": "INDUSTRIAL SEDE TALLERES",
        "matchName": "INDUSTRIAL SEDE TALLERES",
        "direccion": "PIEDRAS DEL TUNJO SECTOR 19 SECTOR 800",
        "lat": 4.814075,
        "lon": -74.346833
    },
    {
        "id": "z2-p7",
        "zona": 2,
        "numero": 7,
        "nombre": "CTRO EDU LA CONCEPCION",
        "matchName": "CTRO EDU LA CONCEPCION",
        "direccion": "CARRERA 14 CALLE 13 ESQ",
        "lat": 4.8224014542900004,
        "lon": -74.35312558895
    },
    {
        "id": "z2-p8",
        "zona": 2,
        "numero": 8,
        "nombre": "UNIVERSIDAD CUNDINAMARCA",
        "matchName": "UNIVERSIDAD CUNDINAMARCA",
        "direccion": "CALLE 15 Numero 17  44",
        "lat": 4.82874285081,
        "lon": -74.35482494974
    },
    {
        "id": "z2-p9",
        "zona": 2,
        "numero": 9,
        "nombre": "COLEGIO ARBOLEDA SEDE ARBOLEDA",
        "matchName": "COLEGIO ARBOLEDA SEDE ARBOLEDA",
        "direccion": "Carrera 7 a Numero 3  22 este",
        "lat": 4.80782633626,
        "lon": -74.34425136442
    },
    {
        "id": "z90-p1",
        "zona": 90,
        "numero": 1,
        "nombre": "COLEGIO ARBOLEDA S  JUAN PABLO II",
        "matchName": "COLEGIO ARBOLEDA S  JUAN PABLO II",
        "direccion": "DIAGONAL 5 ESTE No. 9 - 16",
        "lat": 4.80881608931,
        "lon": -74.34151773743
    },
    {
        "id": "z98-p1",
        "zona": 98,
        "numero": 1,
        "nombre": "CTRO RECLUSION POLICIA NAL",
        "matchName": "CTRO RECLUSION POLICIA NAL",
        "direccion": "VEREDA SANTA MARTA",
        "lat": 4.79565225723,
        "lon": -74.32664813303
    },
    {
        "id": "z99-p1",
        "zona": 99,
        "numero": 1,
        "nombre": "COLEGIO JUAN XXIII",
        "matchName": "COLEGIO JUAN XXIII",
        "direccion": "VEREDA EL PRADO - KM 4 VIA FACATATIVA EL ROSAL",
        "lat": 4.80977764819,
        "lon": -74.32366982102
    },
    {
        "id": "z99-p2",
        "zona": 99,
        "numero": 2,
        "nombre": "ESCUELA ANTIGUA MANCILLA",
        "matchName": "ESCUELA ANTIGUA MANCILLA",
        "direccion": "VEREDA MANCILLAÂ - KM 3 VIA ECOPETROL",
        "lat": 4.85001761466,
        "lon": -74.34636793099
    }
];

// NAVEGACIÓN DESDE LA LANDING
document.getElementById('btnSelectTestigo').addEventListener('click', function() {
    document.getElementById('landing-hero-overlay').style.display = 'none';
    document.getElementById('landingHeaderControls').style.display = 'none';
    document.getElementById('testigoStandaloneContainer').classList.remove('hidden');
    inicializarDropdownPuestosCustom();
});

// ACCESO ADMINISTRADOR DESDE EL BOTÓN SUPERIOR (se conserva la autenticación existente)
const adminCardContainer = document.getElementById('adminCardContainer');
const adminDefaultView = document.getElementById('adminCardDefaultView');
const adminLoginFormInline = document.getElementById('adminLoginFormInline');
const cancelAdminBtn = document.getElementById('cancelAdminInlineBtn');
const landingLoginBtn = document.getElementById('landingLoginBtn');
const adminLoginBackdrop = document.getElementById('adminLoginBackdrop');

// Los elementos fixed no deben permanecer dentro de la cuadrícula/hero:
// algunos navegadores convierten ese ancestro en bloque contenedor y recortan
// el desenfoque a un rectángulo. Se elevan al body para cubrir el viewport real.
if (adminLoginBackdrop && adminLoginBackdrop.parentElement !== document.body) {
    document.body.appendChild(adminLoginBackdrop);
}
if (adminCardContainer && adminCardContainer.parentElement !== document.body) {
    document.body.appendChild(adminCardContainer);
}

function abrirLoginAdmin() {
    if (adminCardContainer.classList.contains('is-open')) {
        cerrarLoginAdmin();
        return;
    }
    // El acceso se presenta como una vista modal centrada que cubre toda la pantalla.
    adminCardContainer.style.display = '';
    adminLoginBackdrop.style.display = '';
    adminCardContainer.classList.remove('hidden');
    adminLoginBackdrop.classList.remove('hidden');
    adminLoginBackdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('admin-login-active');
    adminLoginFormInline.classList.remove('hidden');
    if (adminDefaultView) adminDefaultView.classList.add('hidden');
    requestAnimationFrame(() => adminCardContainer.classList.add('is-open'));
    setTimeout(() => document.getElementById('username').focus(), 220);
}
function cerrarLoginAdmin() {
    adminCardContainer.classList.remove('is-open');
    adminLoginBackdrop.classList.add('hidden');
    adminLoginBackdrop.setAttribute('aria-hidden', 'true');
    adminLoginBackdrop.style.display = 'none';
    document.body.classList.remove('admin-login-active');
    adminCardContainer.style.display = 'none';
    adminCardContainer.classList.add('hidden');
    adminLoginFormInline.classList.remove('hidden');
    if (adminDefaultView) adminDefaultView.classList.add('hidden');
}
landingLoginBtn.addEventListener('click', abrirLoginAdmin);
cancelAdminBtn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); cerrarLoginAdmin(); });
adminLoginBackdrop.addEventListener('click', cerrarLoginAdmin);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && adminCardContainer.classList.contains('is-open')) cerrarLoginAdmin(); });

// RECUPERACIÓN DE CONTRASEÑA — interfaz visual únicamente.
// La validación real y el cambio de credenciales requieren conectar el proveedor de autenticación.
(function configurarInterfazRecuperacion() {
    const loginView = document.getElementById('adminLoginFormInline');
    const recoveryView = document.getElementById('passwordRecoveryView');
    const forgotBtn = document.getElementById('forgotPasswordBtn');
    const closeRecoveryBtn = document.getElementById('closePasswordRecoveryBtn');
    const backBtn = document.getElementById('backToLoginBtn');
    const continueBtn = document.getElementById('recoveryContinueBtn');
    const notice = document.getElementById('recoveryActionNotice');

    function showLogin() {
        if (!loginView || !recoveryView) return;
        recoveryView.classList.add('hidden');
        loginView.classList.remove('hidden');
        if (notice) { notice.classList.add('hidden'); notice.textContent = ''; }
    }

    function showRecovery() {
        if (!loginView || !recoveryView) return;
        loginView.classList.add('hidden');
        recoveryView.classList.remove('hidden');
        if (notice) { notice.classList.add('hidden'); notice.textContent = ''; }
        const nameField = document.getElementById('recoveryFullName');
        if (nameField) nameField.focus();
    }

    if (forgotBtn) forgotBtn.addEventListener('click', showRecovery);
    if (closeRecoveryBtn) closeRecoveryBtn.addEventListener('click', showLogin);
    if (backBtn) backBtn.addEventListener('click', showLogin);

    if (continueBtn) continueBtn.addEventListener('click', () => {
        const name = document.getElementById('recoveryFullName')?.value.trim() || '';
        const email = document.getElementById('recoveryEmail')?.value.trim() || '';
        const password = document.getElementById('recoveryNewPassword')?.value || '';
        const confirmation = document.getElementById('recoveryConfirmPassword')?.value || '';
        const emailValid = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);

        let message = '';
        if (!name || !email || !password || !confirmation) {
            message = 'Completa todos los campos para continuar.';
        } else if (!emailValid) {
            message = 'Escribe un correo electrónico válido.';
        } else if (password.length < 8) {
            message = 'La nueva contraseña debe tener al menos 8 caracteres.';
        } else if (password !== confirmation) {
            message = 'Las contraseñas no coinciden.';
        } else {
            message = 'La interfaz está lista. El cambio de contraseña aún no está conectado al servicio de autenticación, por lo que tus credenciales actuales no se han modificado.';
        }

        if (notice) {
            notice.textContent = message;
            notice.classList.remove('hidden');
        }
    });
})();

// MÓDULO ACTIVIDADES — registro compacto, vista en vivo y archivo tipo Drive.
const activitiesPlaceholder = document.getElementById('activitiesPlaceholder');
const ACTIVITY_STORE_KEY = 'mira_territorio_activities_v1';
let activitiesState = {activities:[],people:[],attendances:[],currentActivityId:null};
let editingParticipantId = null;
let editingPersonId = null;
let detailActivityId = null;
let returnToRecentAfterEdit = false;
let activitiesBackendReady = false;
let activitiesLoading = false;
async function loadActivitiesFromNeon(){
  if(activitiesLoading)return;
  activitiesLoading=true;
  try{
    if(!window.MIRA_DATA)throw new Error('El cliente de Neon todavía no está disponible.');
    const result=await Promise.all([
      window.MIRA_DATA.listPeople({limit:1000}),
      window.MIRA_DATA.listActivities({limit:100}),
      window.MIRA_DATA.listAttendances({limit:1000})
    ]);
    activitiesState.people=(result[0]||[]).map(p=>{const parsed=splitLegacyPersonName(p.nombres,p.apellidos);return {id:p.id,cedula:p.cedula||p.cedula_normalizada||'',names:parsed.names,surnames:parsed.surnames,phone:p.telefono||'',infoMira:p.info_mira===true?'si':p.info_mira===false?'no':''};});
    activitiesState.activities=(result[1]||[]).map(a=>({id:a.id,name:a.nombre,date:a.fecha,place:a.lugar||'',status:a.estado==='activa'?'active':a.estado==='finalizada'?'finished':a.estado,createdAt:a.created_at}));
    activitiesState.attendances=(result[2]||[]).map(a=>({id:a.id,personId:a.persona_id,activityId:a.actividad_id,createdAt:a.fecha_registro||a.created_at}));
    const active=activitiesState.activities.find(a=>a.status==='active');
    activitiesState.currentActivityId=active?.id||activitiesState.activities[0]?.id||null;
    activitiesBackendReady=true;
    renderActivities();
    console.info('[MIRA] Datos de Actividades cargados desde Neon:',{personas:activitiesState.people.length,actividades:activitiesState.activities.length,asistencias:activitiesState.attendances.length});
  }catch(error){
    activitiesBackendReady=false;
    console.error('[MIRA] Error cargando datos desde Neon:',error);
    const notice=document.getElementById('duplicateNotice');
    if(notice){notice.textContent='No se pudieron cargar los datos desde Neon: '+(error.message||'Error de conexión');notice.classList.remove('hidden');}
  }finally{activitiesLoading=false;}
}
window.addEventListener('mira:authenticated',loadActivitiesFromNeon);
function normActivityText(v){return (v||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function normalizeCedula(v){return (v||'').replace(/\D/g,'');}
function splitLegacyPersonName(nombres,apellidos){
  const full=String(nombres||'').trim();
  const surnames=String(apellidos||'').trim();
  if(surnames || !full.includes(' ')) return {names:full,surnames};
  const parts=full.split(/\s+/).filter(Boolean);
  if(parts.length>=3) return {names:parts.slice(0,-2).join(' '),surnames:parts.slice(-2).join(' ')};
  return {names:full,surnames:''};
}
function escapeActivityHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function currentActivity(){return activitiesState.activities.find(a=>a.id===activitiesState.currentActivityId&&a.status==='active')||null;}
let activitiesReturnContext = 'landing';
function openActivities(view='registration'){activitiesReturnContext=(document.getElementById('landing-hero-overlay').style.display==='none')?'platform':'landing';activitiesPlaceholder.classList.remove('hidden');document.getElementById('landing-hero-overlay').style.display='none';document.getElementById('landingHeaderControls').style.display='none';if(!activitiesBackendReady)loadActivitiesFromNeon();renderActivities();showActivityView(view);}
function closeActivities(){activitiesPlaceholder.classList.add('hidden');if(activitiesReturnContext==='platform'){document.getElementById('landing-hero-overlay').style.display='none';document.getElementById('landingHeaderControls').style.display='none';}else{document.getElementById('landing-hero-overlay').style.display='flex';document.getElementById('landingHeaderControls').style.display='flex';}}
function showActivityView(view){['activityRegistrationView','activityRecentPanel','activityAllView','activityDetailView'].forEach(id=>document.getElementById(id).classList.toggle('hidden',id!==({registration:'activityRegistrationView',recent:'activityRecentPanel',all:'activityAllView',detail:'activityDetailView'}[view]||'activityRegistrationView')));document.getElementById('activityScreenSubtitle').textContent=({registration:'Registro de participación territorial.',recent:'Consulta en vivo y rectificación de registros.',all:'Archivo de actividades y sus hojas de cálculo.',detail:'Registros guardados en esta actividad.'})[view]||'Registro de participación territorial.';}
document.getElementById('btnSelectActividades').addEventListener('click',()=>openActivities('registration'));
document.getElementById('btnSelectActividades').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openActivities('registration');}});
document.getElementById('closeActivitiesPlaceholder').addEventListener('click',closeActivities);document.getElementById('returnFromActivities').addEventListener('click',closeActivities);
document.getElementById('sideRecentActivitiesBtn').addEventListener('click',()=>openActivities('recent'));
document.getElementById('sideAllActivitiesBtn').addEventListener('click',()=>openActivities('all'));
document.getElementById('sideOpenActivityModuleBtn').addEventListener('click',()=>openActivities('registration'));
document.getElementById('goRecentFromForm').addEventListener('click',()=>openActivities('recent'));
document.getElementById('backToActivityRegistration').addEventListener('click',()=>showActivityView('registration'));
document.getElementById('backToActivityHomeFromAll').addEventListener('click',()=>showActivityView('registration'));
document.getElementById('backToAllActivities').addEventListener('click',()=>showActivityView('all'));
document.getElementById('cancelNewActivityBtn').addEventListener('click',()=>document.getElementById('newActivityForm').classList.add('hidden'));
function showNewActivity(){document.getElementById('newActivityForm').classList.remove('hidden');document.getElementById('activityName').focus();}
document.getElementById('newActivityBtnAll').addEventListener('click',()=>{showActivityView('registration');showNewActivity();});
document.getElementById('saveActivityBtn').addEventListener('click',async()=>{
  if(!activitiesBackendReady){alert('No hay conexión confirmada con Neon. No se guardó la actividad.');return;}
  const name=document.getElementById('activityName').value.trim();
  if(!name){alert('Escribe el nombre de la actividad.');return;}
  const button=document.getElementById('saveActivityBtn');button.disabled=true;
  try{
    const date=document.getElementById('activityDate').value||new Date().toISOString().slice(0,10);
    const place=document.getElementById('activityPlace').value.trim();
    await Promise.all(activitiesState.activities.filter(a=>a.status==='active').map(a=>window.MIRA_DATA.updateActivity(a.id,{estado:'finalizada'})));
    await window.MIRA_DATA.createActivity({nombre:name,fecha:date,lugar:place||null,estado:'activa',creado_por:window.MIRA_CURRENT_USER?.email||null});
    await loadActivitiesFromNeon();
    document.getElementById('newActivityForm').classList.add('hidden');
    ['activityName','activityDate','activityPlace'].forEach(id=>document.getElementById(id).value='');
    showActivityView('registration');
  }catch(error){console.error(error);alert('No fue posible guardar la actividad en Neon: '+(error.message||'Error desconocido'));}
  finally{button.disabled=false;}
});
function clearParticipantForm(){editingParticipantId=null;editingPersonId=null;['participantCedula','participantNames','participantSurnames','participantPhone'].forEach(id=>document.getElementById(id).value='');document.getElementById('participantInfoMira').value='';document.getElementById('duplicateNotice').classList.add('hidden');document.getElementById('saveParticipantBtn').textContent='Guardar asistencia';}
document.getElementById('clearParticipantBtn').addEventListener('click',clearParticipantForm);
async function lookupPerson(){
  const ced=normalizeCedula(document.getElementById('participantCedula').value);
  const notice=document.getElementById('duplicateNotice');notice.classList.add('hidden');
  if(!ced){notice.textContent='Introduce una cédula para buscar.';notice.classList.remove('hidden');return;}
  if(!activitiesBackendReady){notice.textContent='El módulo aún no ha conectado con Neon.';notice.classList.remove('hidden');return;}
  try{
    const rows=await window.MIRA_DATA.listPeople({cedula:ced,limit:1});
    const found=rows?.[0];
    if(found){
      const parsed=splitLegacyPersonName(found.nombres,found.apellidos);
      const person={id:found.id,cedula:found.cedula||found.cedula_normalizada||'',names:parsed.names,surnames:parsed.surnames,phone:found.telefono||'',infoMira:found.info_mira===true?'si':found.info_mira===false?'no':''};
      const i=activitiesState.people.findIndex(p=>p.id===person.id);if(i>=0)activitiesState.people[i]=person;else activitiesState.people.push(person);
      document.getElementById('participantNames').value=person.names;
      document.getElementById('participantSurnames').value=person.surnames;
      document.getElementById('participantPhone').value=person.phone;
      document.getElementById('participantInfoMira').value=person.infoMira;
      notice.textContent='Ficha encontrada en Neon. Se cargaron los datos existentes.';
    }else notice.textContent='No se encontró esa cédula en Neon. Completa los datos para crear una ficha nueva.';
    notice.classList.remove('hidden');
  }catch(error){notice.textContent='Error consultando Neon: '+(error.message||'No fue posible buscar.');notice.classList.remove('hidden');}
}
document.getElementById('lookupParticipantBtn').addEventListener('click',lookupPerson);
document.getElementById('participantCedula').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupPerson();}});
document.getElementById('saveParticipantBtn').addEventListener('click',async()=>{
  if(!activitiesBackendReady){alert('No hay conexión confirmada con Neon. No se guardó el registro.');return;}
  const wasEditing=!!editingParticipantId;
  const actId=document.getElementById('participantActivity').value||activitiesState.currentActivityId;
  const act=activitiesState.activities.find(a=>a.id===actId);
  if(!act){alert('Primero crea una actividad desde Todas las actividades.');return;}
  const ced=normalizeCedula(document.getElementById('participantCedula').value);
  const names=document.getElementById('participantNames').value.trim();
  const surnames=document.getElementById('participantSurnames').value.trim();
  const info=document.getElementById('participantInfoMira').value;
  if(!ced||!names||!surnames||!info){alert('Completa cédula, nombres, apellidos e InfoMIRA.');return;}
  const button=document.getElementById('saveParticipantBtn');button.disabled=true;
  try{
    const found=editingPersonId?[]:await window.MIRA_DATA.listPeople({cedula:ced,limit:1});
    let personRow=editingPersonId?activitiesState.people.find(p=>p.id===editingPersonId)||null:found?.[0]||null;
    const sameName=activitiesState.people.find(p=>normActivityText(p.names+' '+p.surnames)===normActivityText(names+' '+surnames)&&normalizeCedula(p.cedula)!==ced&&p.id!==editingPersonId);
    if(!personRow&&sameName&&!confirm('Existe una ficha con el mismo nombre y otra cédula. ¿Confirmas que es otra persona?'))return;
    const payload={cedula:ced,nombres:names,apellidos:surnames,telefono:document.getElementById('participantPhone').value.trim()||null,info_mira:info==='si',actualizado_por:window.MIRA_CURRENT_USER?.email||null};
    if(personRow){
      const updated=await window.MIRA_DATA.updatePerson(personRow.id,payload);
      personRow=updated?.[0]||{...personRow,...payload,cedula};
    }else{
      const created=await window.MIRA_DATA.createPerson({...payload,creado_por:window.MIRA_CURRENT_USER?.email||null});
      personRow=created?.[0];
      if(!personRow)throw new Error('Neon no devolvió la persona creada.');
    }
    const duplicate=activitiesState.attendances.find(x=>x.personId===personRow.id&&x.activityId===act.id&&x.id!==editingParticipantId);
    if(duplicate)throw new Error('Esta persona ya tiene asistencia registrada en esta actividad.');
    const attendancePayload={persona_id:personRow.id,actividad_id:act.id,registrado_por:window.MIRA_CURRENT_USER?.email||null};
    if(editingParticipantId){
      const updated=await window.MIRA_DATA.updateAttendance(editingParticipantId,attendancePayload);
      if(!updated?.length)throw new Error('No se encontró la asistencia que intentas rectificar.');
    }else await window.MIRA_DATA.createAttendance(attendancePayload);
    await loadActivitiesFromNeon();
    clearParticipantForm();
    const notice=document.getElementById('duplicateNotice');
    if(notice){notice.textContent='Persona y asistencia guardadas correctamente en Neon.';notice.classList.remove('hidden');}
    if(wasEditing&&returnToRecentAfterEdit){returnToRecentAfterEdit=false;openActivityFolder(detailActivityId);}
  }catch(error){console.error('[MIRA] Error guardando en Neon:',error);alert('No fue posible guardar en Neon: '+(error.message||'Error desconocido'));}
  finally{button.disabled=false;}
});
document.getElementById('activitySearch').addEventListener('input',renderActivityTable);
function activityRows(activityId=null,query=''){return activitiesState.attendances.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).map(a=>({a,p:activitiesState.people.find(p=>p.id===a.personId)||{},act:activitiesState.activities.find(x=>x.id===a.activityId)||{}})).filter(x=>(!activityId||x.a.activityId===activityId)&&(!query||normActivityText([x.p.names,x.p.surnames,x.p.cedula,x.act.name].join(' ')).includes(query)));}
function editAttendance(id){returnToRecentAfterEdit=true;const a=activitiesState.attendances.find(x=>x.id===id),p=a&&activitiesState.people.find(x=>x.id===a.personId);if(!a||!p)return;editingParticipantId=a.id;editingPersonId=p.id;document.getElementById('participantCedula').value=p.cedula;document.getElementById('participantNames').value=p.names;document.getElementById('participantSurnames').value=p.surnames;document.getElementById('participantPhone').value=p.phone||'';document.getElementById('participantInfoMira').value=p.infoMira||'';document.getElementById('participantActivity').value=a.activityId;document.getElementById('saveParticipantBtn').textContent='Guardar rectificación';showActivityView('registration');document.getElementById('participantWorkspace').scrollIntoView({behavior:'smooth',block:'start'});}
function renderActivityTable(){const body=document.getElementById('activityParticipantsBody');const q=normActivityText(document.getElementById('activitySearch').value);const allRows=activityRows(null,q);const rows=allRows.slice(0,10);document.getElementById('liveActivityCount').textContent='Mostrando '+rows.length+' de '+activitiesState.attendances.length+' registros';body.innerHTML=rows.length?rows.map(({a,p,act})=>`<tr><td>${escapeActivityHtml((p.names||'')+' '+(p.surnames||''))}</td><td>${escapeActivityHtml(p.cedula||'')}</td><td>${escapeActivityHtml(act.name||'—')}</td><td>${p.infoMira==='si'?'Sí':'No'}</td><td>${a.createdAt?new Date(a.createdAt).toLocaleString('es-CO'):''}</td><td><button class="activity-row-btn" data-edit="${a.id}" type="button">Editar</button></td></tr>`).join(''):'<tr><td colspan="6">No hay registros recientes para mostrar.</td></tr>';body.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editAttendance(b.dataset.edit)));}
function exportActivityExcel(activityId){if(!window.XLSX){alert('No se pudo cargar la herramienta de Excel.');return;}const rows=activityRows(activityId).map(({a,p,act})=>({'Actividad':act.name||'','Fecha actividad':act.date||'','Lugar':act.place||'','Cédula':p.cedula||'','Nombres':p.names||'','Apellidos':p.surnames||'','Teléfono':p.phone||'','InfoMIRA':p.infoMira==='si'?'Sí':'No','Fecha registro':a.createdAt||''}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Registros');const act=activitiesState.activities.find(a=>a.id===activityId);XLSX.writeFile(wb,(act?act.name:'Mira_Tu_Territorio').replace(/[^a-z0-9_-]/gi,'_')+'.xlsx');}
document.getElementById('exportSingleActivityBtn').addEventListener('click',()=>exportActivityExcel(detailActivityId));
function openActivityFolder(id){const act=activitiesState.activities.find(a=>a.id===id);if(!act)return;detailActivityId=id;document.getElementById('activityDetailTitle').textContent=act.name;document.getElementById('activityDetailMeta').textContent=[act.date,act.place,activitiesState.attendances.filter(x=>x.activityId===id).length+' registros'].filter(Boolean).join(' · ');const rows=activityRows(id);document.getElementById('activityDetailBody').innerHTML=rows.length?rows.map(({a,p})=>`<tr><td>${escapeActivityHtml((p.names||'')+' '+(p.surnames||''))}</td><td>${escapeActivityHtml(p.cedula||'')}</td><td>${escapeActivityHtml(p.phone||'—')}</td><td>${p.infoMira==='si'?'Sí':'No'}</td><td>${a.createdAt?new Date(a.createdAt).toLocaleString('es-CO'):''}</td><td><button class="activity-row-btn" data-edit="${a.id}" type="button">Editar</button></td></tr>`).join(''):'<tr><td colspan="6">Esta actividad aún no tiene registros.</td></tr>';const body=document.getElementById('activityDetailBody');body.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editAttendance(b.dataset.edit)));showActivityView('detail');}
function renderActivities(){const select=document.getElementById('participantActivity'),old=select.value;select.innerHTML='<option value="">Seleccionar actividad…</option>'+activitiesState.activities.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(a=>`<option value="${a.id}">${escapeActivityHtml(a.name)}${a.status==='active'?' · En curso':''}</option>`).join('');if(old&&activitiesState.activities.some(a=>a.id===old))select.value=old;else if(currentActivity())select.value=currentActivity().id;const folders=document.getElementById('activitiesFolders');folders.innerHTML=activitiesState.activities.length?activitiesState.activities.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(a=>`<article class="activity-folder"><div class="folder-icon">📁</div><h3>${escapeActivityHtml(a.name)}</h3><p>${escapeActivityHtml(a.date||'Sin fecha')} · ${activitiesState.attendances.filter(x=>x.activityId===a.id).length} registros</p><div class="activity-folder-actions"><button class="activity-row-btn" data-folder-open="${a.id}" type="button">📂 Abrir</button></div></article><button class="activity-file-card" data-folder-export="${a.id}" type="button" aria-label="Descargar Excel de ${escapeActivityHtml(a.name)}"><span class="file-icon">📊</span><strong>${escapeActivityHtml(a.name)}.xlsx</strong><small>Archivo de registros · ${activitiesState.attendances.filter(x=>x.activityId===a.id).length} filas</small><span class="file-type">EXCEL · DESCARGAR</span></button>`).join(''):'<div class="activity-empty-drive"><div>📂</div><h3>Aún no hay actividades</h3><p>Crea una actividad para que aparezca aquí su carpeta y su archivo Excel.</p></div>';folders.querySelectorAll('[data-folder-open]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openActivityFolder(b.dataset.folderOpen);}));folders.querySelectorAll('[data-folder-export]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();exportActivityExcel(b.dataset.folderExport);}));document.getElementById('sideActivityPeople').textContent=activitiesState.people.length;document.getElementById('sideActivityAttendances').textContent=activitiesState.attendances.length;document.getElementById('sideActivityCount').textContent=activitiesState.activities.length+' actividades guardadas';renderActivityTable();}
renderActivities();

document.getElementById('logoutTestigoBtn').addEventListener('click', function() {
    document.getElementById('testigoStandaloneContainer').classList.add('hidden');
    document.getElementById('landing-hero-overlay').style.display = 'flex';
    document.getElementById('landingHeaderControls').style.display = 'flex';
});

// AUTENTICACIÓN ADMINISTRATIVA LOCAL.
function cerrarCapaAccesoPMU() {
    // La capa de desenfoque pertenece exclusivamente al login. Si permanece
    // activa al cambiar al PMU, cubre el mapa y deja toda la interfaz borrosa.
    const backdrop = document.getElementById('adminLoginBackdrop');
    const card = document.getElementById('adminCardContainer');
    if (backdrop) {
        backdrop.classList.add('hidden');
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.style.display = 'none';
    }
    if (card) {
        card.classList.remove('is-open');
        card.classList.add('hidden');
        card.style.display = 'none';
    }
    document.body.classList.remove('admin-login-active');
}

function activarPMUAutenticado() {
    // Retirar primero el backdrop del login: no debe cubrir ni desenfocar el PMU.
    cerrarCapaAccesoPMU();
    // Transición visual del portal al PMU tras validar la sesión de Neon Auth.
    document.body.classList.add('pmu-neomorphic');
    const overlay = document.getElementById('landing-hero-overlay');
    const controls = document.getElementById('landingHeaderControls');
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.style.display = 'block';
        appContainer.style.position = 'fixed';
        appContainer.style.inset = '0';
        appContainer.style.width = '100vw';
        appContainer.style.height = '100vh';
        appContainer.style.height = '100dvh';
    }
    if (overlay) overlay.style.display = 'none';
    if (controls) controls.style.display = 'none';
    const card = document.getElementById('adminCardContainer');
    if (card) { card.classList.remove('is-open'); card.classList.add('hidden'); }
    try {
        if (typeof inicializarSistemaMapa === 'function') inicializarSistemaMapa();
        // Recalcular Leaflet después de que el contenedor pase de oculto a visible.
        [120, 350, 700].forEach(delay => setTimeout(() => {
            const mapElement = document.getElementById('map');
            if (map && mapElement && mapElement.clientWidth > 0 && mapElement.clientHeight > 0) {
                map.invalidateSize({ pan: false, animate: false });
            }
        }, delay));
    } catch (err) {
        console.error('[MIRA TU TERRITORIO] Error al inicializar el mapa tras autenticar:', err);
    }
}

// La autenticación y autorización se gestionan exclusivamente mediante Neon Auth.
// Se limpian únicamente las claves de sesión/credencial del acceso temporal anterior;
// no se toca ningún registro de personas, actividades ni otros datos de la plataforma.
try {
    ['mtt_local_admin_v1','mtt_temp_admin_initialized_v1'].forEach(key => localStorage.removeItem(key));
} catch (error) {
    console.warn('[MIRA TU TERRITORIO] No se pudieron limpiar las claves antiguas de acceso local.', error);
}

// PUESTOS DE VOTACIÓN: DESPLEGABLE PERSONALIZADO EN GLASSMORPHISM
function inicializarDropdownPuestosCustom() {
    const inputPuesto = document.getElementById('testigoPuestoInput');
    const dropdownMenu = document.getElementById('puestosDropdownList');
    if (!inputPuesto || !dropdownMenu) return;

    function renderOptions(filtro = "") {
        dropdownMenu.innerHTML = '';
        const query = filtro.trim().toLowerCase();
        const filtrados = listaPuestosVotacion.filter(p => p.nombre.toLowerCase().includes(query));

        if (filtrados.length === 0) {
            dropdownMenu.innerHTML = `<div class="puesto-dropdown-item no-res">No se encontraron puestos.</div>`;
            return;
        }

        filtrados.forEach(puesto => {
            const item = document.createElement('div');
            item.className = 'puesto-dropdown-item';
            item.innerHTML = `<strong>📍 Zona ${puesto.zona} · Puesto ${puesto.numero}: ${puesto.nombre}</strong><small>${puesto.direccion}</small>`;

            item.addEventListener('click', function() {
                inputPuesto.value = puesto.nombre;
                dropdownMenu.classList.add('hidden');
            });

            dropdownMenu.appendChild(item);
        });
    }

    inputPuesto.addEventListener('focus', function() {
        renderOptions(this.value);
        dropdownMenu.classList.remove('hidden');
    });

    inputPuesto.addEventListener('input', function() {
        renderOptions(this.value);
        dropdownMenu.classList.remove('hidden');
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-puesto-select-wrapper')) {
            dropdownMenu.classList.add('hidden');
        }
    });
}

let listaFotosSeleccionadas = [];

function procesarYComprimirImagen(file) {
    return new Promise((resolve) => {
        if (!file || !file.type.startsWith('image/')) {
            return resolve(null);
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                try {
                    const maxDim = 1280;
                    let width = img.width;
                    let height = img.height;

                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                    resolve(dataUrl);
                } catch (err) {
                    resolve(e.target.result);
                }
            };
            img.onerror = function() {
                resolve(e.target.result);
            };
            img.src = e.target.result;
        };
        reader.onerror = function() {
            resolve(null);
        };
        reader.readAsDataURL(file);
    });
}

function inicializarEventosArchivosTestigo() {
    const btnCamara = document.getElementById('btnTomarFotoCamara');
    const btnGaleria = document.getElementById('btnSubirGaleria');
    const cameraInput = document.getElementById('testigoCameraInput');
    const galleryInput = document.getElementById('testigoGalleryInput');
    const previewContainer = document.getElementById('testigoPreviewContainer');
    const thumbnailsGrid = document.getElementById('testigoThumbnailsGrid');
    const fotosCountSpan = document.getElementById('testigoFotosCount');
    const btnLimpiar = document.getElementById('btnLimpiarFotos');
    const uploadBtn = document.getElementById('uploadEvidenciaBtn');

    if (!cameraInput || !galleryInput || !uploadBtn) return;

    if (btnCamara) {
        btnCamara.addEventListener('click', function() {
            cameraInput.value = '';
            cameraInput.click();
        });
    }

    if (btnGaleria) {
        btnGaleria.addEventListener('click', function() {
            galleryInput.value = '';
            galleryInput.click();
        });
    }

    function renderizarMiniaturas() {
        if (!previewContainer || !thumbnailsGrid) return;

        if (listaFotosSeleccionadas.length === 0) {
            previewContainer.classList.add('hidden');
            thumbnailsGrid.innerHTML = '';
            if (fotosCountSpan) fotosCountSpan.textContent = '0';
            imagenBase64Seleccionada = '';
            return;
        }

        previewContainer.classList.remove('hidden');
        if (fotosCountSpan) fotosCountSpan.textContent = listaFotosSeleccionadas.length;
        imagenBase64Seleccionada = listaFotosSeleccionadas[0];

        thumbnailsGrid.innerHTML = listaFotosSeleccionadas.map((src, idx) => `
            <div class="testigo-thumb-item" title="Foto ${idx + 1}">
                <img src="${src}" alt="Foto ${idx + 1}">
                <button type="button" class="testigo-thumb-remove" data-index="${idx}" title="Eliminar foto">✕</button>
            </div>
        `).join('');

        thumbnailsGrid.querySelectorAll('.testigo-thumb-remove').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const index = parseInt(this.getAttribute('data-index'), 10);
                if (!isNaN(index)) {
                    listaFotosSeleccionadas.splice(index, 1);
                    renderizarMiniaturas();
                }
            });
        });
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', function() {
            listaFotosSeleccionadas = [];
            cameraInput.value = '';
            galleryInput.value = '';
            renderizarMiniaturas();
        });
    }

    async function agregarArchivos(archivos) {
        if (!archivos || archivos.length === 0) return;
        for (let i = 0; i < archivos.length; i++) {
            const dataUrl = await procesarYComprimirImagen(archivos[i]);
            if (dataUrl) {
                listaFotosSeleccionadas.push(dataUrl);
            }
        }
        renderizarMiniaturas();
    }

    cameraInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
            agregarArchivos(e.target.files);
        }
    });

    galleryInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
            agregarArchivos(e.target.files);
        }
    });

    uploadBtn.addEventListener('click', function() {
        const puesto = document.getElementById('testigoPuestoInput').value.trim();
        const mesa = document.getElementById('testigoMesaInput').value.trim();
        const nota = document.getElementById('testigoNotaInput').value.trim();

        if (!puesto) {
            alert("Por favor escribe o selecciona tu Puesto de Votación.");
            return;
        }
        if (!mesa) {
            alert("Por favor escribe la mesa o rango de mesas a cargo.");
            return;
        }
        if (listaFotosSeleccionadas.length === 0) {
            alert("Por favor toma una foto con la cámara o selecciona fotos desde tu galería.");
            return;
        }

        const ahora = new Date();
        const horaFormato = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const totalFotos = listaFotosSeleccionadas.length;

        listaFotosSeleccionadas.forEach((imgData, idx) => {
            const sufijoFoto = totalFotos > 1 ? ` (Foto ${idx + 1} de ${totalFotos})` : '';
            const nuevaEvidencia = {
                id: Date.now() + idx,
                puesto: puesto,
                mesa: mesa,
                nota: nota ? `${nota}${sufijoFoto}` : (totalFotos > 1 ? `Foto ${idx + 1} de ${totalFotos}` : "Sin observaciones"),
                imgData: imgData,
                hora: horaFormato
            };
            listaEvidenciasTestigos.push(nuevaEvidencia);
        });

        localStorage.setItem('faca_evidencias_testigos', JSON.stringify(listaEvidenciasTestigos));

        document.getElementById('testigoMesaInput').value = '';
        document.getElementById('testigoNotaInput').value = '';
        document.getElementById('testigoPuestoInput').value = '';
        cameraInput.value = '';
        galleryInput.value = '';
        listaFotosSeleccionadas = [];
        renderizarMiniaturas();

        const mensajeExito = totalFotos === 1
            ? "✅ ¡Acta E-14 transmitida con éxito al Centro de Operaciones!"
            : `✅ ¡${totalFotos} actas/fotos transmitidas con éxito al Centro de Operaciones!`;
        alert(mensajeExito);
    });
}

inicializarEventosArchivosTestigo();

/* LÓGICA DEL MAPA Y MÓDULOS DEL PMU */
document.getElementById('sidebarToggleBtn').addEventListener('click', function() {
    const sidebarGroup = document.getElementById('mainSidebar');
    const isCollapsed = sidebarGroup.classList.toggle('collapsed');
    this.setAttribute('aria-expanded', !isCollapsed);
    manejarBotonFlotanteReapertura(isCollapsed);
    setTimeout(() => { if (map) map.invalidateSize(); }, 350);
});

function manejarBotonFlotanteReapertura(estaContraido) {
    let floatBtn = document.getElementById('floatingReopenBtn');
    if (estaContraido) {
        if (!floatBtn) {
            floatBtn = document.createElement('button');
            floatBtn.id = 'floatingReopenBtn';
            floatBtn.title = 'Mostrar Menú';
            floatBtn.setAttribute('aria-label', 'Abrir menú lateral');
            floatBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12h18M3 6h18M3 18h18"/></svg>`;
            floatBtn.className = 'floating-reopen-neo-btn';
            floatBtn.addEventListener('click', function() {
                const sidebarGroup = document.getElementById('mainSidebar');
                sidebarGroup.classList.remove('collapsed');
                document.getElementById('sidebarToggleBtn').setAttribute('aria-expanded', 'true');
                floatBtn.remove();
                setTimeout(() => { if (map) map.invalidateSize(); }, 350);
            });
            document.body.appendChild(floatBtn);
        } else {
            floatBtn.style.display = 'flex';
        }
    } else {
        if (floatBtn) floatBtn.style.display = 'none';
    }
}

// Mantener el mapa sincronizado con el tamaño real del viewport.
if (!window.__miraMapResizeHandlersInstalled) {
    window.__miraMapResizeHandlersInstalled = true;
    const actualizarTamanoMapa = () => {
        const el = document.getElementById('map');
        if (map && el && el.clientWidth > 0 && el.clientHeight > 0) {
            map.invalidateSize({ pan: false, animate: false });
        }
    };
    window.addEventListener('resize', () => requestAnimationFrame(actualizarTamanoMapa), { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(actualizarTamanoMapa, 250), { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) setTimeout(actualizarTamanoMapa, 180);
    });
}

function inicializarSistemaMapa() {
    if (map) {
        setTimeout(() => { map.invalidateSize(); }, 200);
        return;
    }

    map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([4.8123, -74.3542], 14);
    L.control.zoom({ position: 'topright' }).addTo(map);

    // V39: restaurar la cartografía base satelital. Sin esta capa Leaflet deja
    // visible únicamente el fondo negro del contenedor y los polígonos encima.
    const mapaBaseSatelital = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Tiles © Esri' }
    );
    mapaBaseSatelital.addTo(map);
    window.MIRA_MAPA_BASE = mapaBaseSatelital;

    aplicarTema(currentTheme);

    puestosLayerGroup.addTo(map);
    searchMarkersGroup.addTo(map);
    miraMarkersGroup.addTo(map);

    function colapsarPanelesDeFiltros() {
        // Cierra los desplegables del menú lateral para que la ficha tenga prioridad visual.
        document.querySelectorAll('.neo-tactile-sidebar details.custom-dropdown[open]').forEach(panel => {
            panel.open = false;
        });
    }

    function restablecerFiltrosTerritorialesActivos() {
        const modoPuestos = document.getElementById('territoryModePuestos');
        if (modoPuestos && modoPuestos.checked) {
            restablecerFiltrosPuestos();
            return;
        }
        const resetBarrios = document.getElementById('reset-barrios-filters');
        if (resetBarrios) resetBarrios.click();
    }

    document.getElementById('closeFloatingWidget').addEventListener('click', function() {
        const ficha = document.getElementById('floatingPuestoWidget');
        if (ficha) ficha.classList.add('hidden');
        restablecerFiltrosTerritorialesActivos();
        colapsarPanelesDeFiltros();
    });

    // Selector de vistas del módulo unificado Barrios y puestos.
    const territoryModeBarrios = document.getElementById('territoryModeBarrios');
    const territoryModePuestos = document.getElementById('territoryModePuestos');
    const territoryBarriosPanel = document.getElementById('territoryBarriosPanel');
    const territoryPuestosPanel = document.getElementById('territoryPuestosPanel');
    function cambiarVistaTerritorial(modo) {
        if (territoryBarriosPanel) territoryBarriosPanel.hidden = modo !== 'barrios';
        if (territoryPuestosPanel) territoryPuestosPanel.hidden = modo !== 'puestos';
        // Al entrar a cada vista se conserva su estado de filtros y se refresca su capa.
        if (modo === 'puestos') {
            cargarPuestosEnMapa();
        } else if (typeof window.actualizarMapa === 'function') {
            window.actualizarMapa();
        }
    }
    [territoryModeBarrios, territoryModePuestos].forEach(control => {
        if (control && !control.dataset.modeBound) {
            control.dataset.modeBound = '1';
            control.addEventListener('change', () => { if (control.checked) cambiarVistaTerritorial(control.value); });
        }
    });
    cambiarVistaTerritorial('barrios');

    // Inicializar los módulos que no dependen de que exista la base de electores.
    // Antes se inicializaban dentro del fetch; si el JSON no estaba disponible,
    // el panel E-14 y los listeners de los filtros nunca se activaban.
    generarListaPuestos();
    cargarPuestosEnMapa(); // muestra los puestos conocidos incluso sin la base de personas
    inicializarModuloInfoMIRA();
    inicializarModuloLogistica();
    actualizarDashboardKPIs();
    inicializarModuloTestigosPMU();

    // La base de electores no forma parte de esta distribución independiente.
    // Se mantiene vacía hasta conectar una fuente de datos autorizada.
    baseVotantes = [];
    actualizarConteoLogistica();

    // La capa territorial principal ahora usa los polígonos del KML.
    // Se dejan de dibujar los antiguos puntos de barrios para reducir el ruido visual.
    fetch('./barrios_poligonos_kml_aportado.geojson')
        .then(response => {
            if (!response.ok) throw new Error('Archivo de polígonos KML no disponible');
            return response.json();
        })
        .then(data => {
            datosOriginales = data;
            // Inicializar todos los sectores como visibles y sin selección implícita.
            barriosFiltroEstado = Object.create(null);
            (data.features || []).forEach((feature, index) => {
                barriosFiltroEstado[obtenerNombreBarrio(feature, index)] = true;
            });
            poligonoSeleccionadoNombre = null;
            poligonosCoincidenciaActiva = new Set();
            generarListaBarrios();
            actualizarMapa();
            // Primer encuadre: mostrar la extensión territorial completa, no un sector arbitrario.
            if (!window.__MIRA_INITIAL_TERRITORY_FIT_DONE && map && geojsonLayer) {
                const initialBounds = geojsonLayer.getBounds();
                if (initialBounds && initialBounds.isValid()) {
                    map.fitBounds(initialBounds, { paddingTopLeft: [410, 45], paddingBottomRight: [45, 45], maxZoom: 14 });
                    window.__MIRA_INITIAL_TERRITORY_FIT_DONE = true;
                }
            }
            console.info(`[MIRA] Polígonos territoriales cargados: ${data.features?.length || 0}`);
        })
        .catch(err => console.warn('[MIRA] No se pudo cargar la capa territorial KML:', err));

    function obtenerNombreBarrio(feature, index) {
        if (feature && feature.properties) {
            return feature.properties.nombre || feature.properties.Barrio || `Sector ${index + 1}`;
        }
        return `Sector ${index + 1}`;
    }

    function normalizarBusquedaTerritorial(valor) {
        return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
    }

    function generarListaBarrios() {
        const container = document.getElementById('barrios-checkbox-container');
        const searchInput = document.getElementById('barriosSearchInput');
        const selectAll = document.getElementById('select-all-barrios');
        const toggleLayer = document.getElementById('toggle-poligonos-kml');
        const resetFilters = document.getElementById('reset-barrios-filters');
        if (!container || !datosOriginales || !datosOriginales.features) return;

        function renderBarrios(filtro = '') {
            container.innerHTML = '';
            const query = normalizarBusquedaTerritorial(filtro);
            const matches = datosOriginales.features.map((feature, index) => ({
                feature,
                nombre: obtenerNombreBarrio(feature, index),
                index
            })).filter(item => !query || normalizarBusquedaTerritorial(item.nombre).includes(query));

            matches.forEach(item => {
                const { nombre } = item;
                const row = document.createElement('div');
                row.className = 'territory-filter-row';
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'chk-barrio';
                checkbox.dataset.nombre = nombre;
                checkbox.checked = barriosFiltroEstado[nombre] !== false;
                const name = document.createElement('span');
                name.className = 'territory-filter-name';
                name.textContent = nombre;
                label.append(checkbox, name);
                checkbox.addEventListener('change', () => {
                    barriosFiltroEstado[nombre] = checkbox.checked;
                    if (!checkbox.checked && poligonoSeleccionadoNombre === nombre) poligonoSeleccionadoNombre = null;
                    if (!checkbox.checked) poligonosCoincidenciaActiva.delete(nombre);
                    actualizarMapa();
                });
                label.addEventListener('dblclick', e => { e.preventDefault(); seleccionarPoligonoTerritorial(nombre, true); });
                const selectBtn = document.createElement('button');
                selectBtn.type = 'button';
                selectBtn.className = 'territory-select-btn';
                selectBtn.textContent = 'Ver';
                selectBtn.title = 'Centrar el mapa y abrir la ficha de ' + nombre;
                selectBtn.addEventListener('click', () => seleccionarPoligonoTerritorial(nombre, true));
                row.append(label, selectBtn);
                container.appendChild(row);
            });
            if (!container.children.length) {
                container.innerHTML = '<p class="loading-text">No se encontraron sectores con ese nombre.</p>';
            }
        }

        renderBarrios(searchInput ? searchInput.value : '');

        if (searchInput && !searchInput.dataset.v10Bound) {
            searchInput.dataset.v10Bound = '1';
            searchInput.addEventListener('input', () => {
                const query = normalizarBusquedaTerritorial(searchInput.value);
                poligonoSeleccionadoNombre = null;
                poligonosCoincidenciaActiva = new Set();
                if (!query) {
                    datosOriginales.features.forEach((feature, index) => {
                        barriosFiltroEstado[obtenerNombreBarrio(feature, index)] = true;
                    });
                    if (selectAll) selectAll.checked = true;
                } else {
                    // Búsqueda dinámica: todos los nombres que coincidan quedan seleccionados
                    // y visibles; el resto se oculta hasta limpiar/restablecer la búsqueda.
                    datosOriginales.features.forEach((feature, index) => {
                        const nombre = obtenerNombreBarrio(feature, index);
                        const coincide = normalizarBusquedaTerritorial(nombre).includes(query);
                        barriosFiltroEstado[nombre] = coincide;
                        if (coincide) poligonosCoincidenciaActiva.add(nombre);
                    });
                    if (selectAll) selectAll.checked = false;
                }
                renderBarrios(searchInput.value);
                actualizarMapa();
                if (query && poligonosCoincidenciaActiva.size && map) {
                    // Construir los límites directamente desde las geometrías coincidentes para
                    // que el foco funcione incluso al reconstruirse la capa Leaflet.
                    const bounds = L.latLngBounds([]);
                    (datosOriginales.features || []).forEach((feature, index) => {
                        const nombre = obtenerNombreBarrio(feature, index);
                        if (!poligonosCoincidenciaActiva.has(nombre)) return;
                        try {
                            const layer = L.geoJSON(feature);
                            const featureBounds = layer.getBounds();
                            if (featureBounds && featureBounds.isValid()) bounds.extend(featureBounds);
                        } catch (_) {}
                    });
                    if (bounds.isValid()) {
                        const isSingle = poligonosCoincidenciaActiva.size === 1;
                        map.fitBounds(bounds, { paddingTopLeft: [410, 55], paddingBottomRight: [55, 55], maxZoom: isSingle ? 17 : 16 });
                    }
                }
            });
        }

        if (selectAll && !selectAll.dataset.v10Bound) {
            selectAll.dataset.v10Bound = '1';
            selectAll.addEventListener('change', () => {
                poligonoSeleccionadoNombre = null;
                poligonosCoincidenciaActiva = new Set();
                datosOriginales.features.forEach((feature, index) => {
                    barriosFiltroEstado[obtenerNombreBarrio(feature, index)] = selectAll.checked;
                });
                renderBarrios(searchInput ? searchInput.value : '');
                actualizarMapa();
            });
        }
        if (toggleLayer && !toggleLayer.dataset.v10Bound) {
            toggleLayer.dataset.v10Bound = '1';
            toggleLayer.checked = poligonosKmlVisibles;
            toggleLayer.addEventListener('change', () => {
                poligonosKmlVisibles = toggleLayer.checked;
                actualizarMapa();
            });
        }
        if (resetFilters && !resetFilters.dataset.v10Bound) {
            resetFilters.dataset.v10Bound = '1';
            resetFilters.addEventListener('click', () => {
                barriosFiltroEstado = Object.create(null);
                datosOriginales.features.forEach((feature, index) => {
                    barriosFiltroEstado[obtenerNombreBarrio(feature, index)] = true;
                });
                poligonoSeleccionadoNombre = null;
                poligonosCoincidenciaActiva = new Set();
                if (searchInput) searchInput.value = '';
                if (selectAll) selectAll.checked = true;
                if (toggleLayer) {
                    poligonosKmlVisibles = true;
                    toggleLayer.checked = true;
                }
                const widget = document.getElementById('floatingPuestoWidget');
                if (widget) widget.classList.add('hidden');
                renderBarrios('');
                actualizarMapa();
                if (map) map.setView([4.8123, -74.3542], 14);
            });
        }
    }

    function puntoEnAnillo(punto, anillo) {
        const x = punto[0], y = punto[1]; let dentro = false;
        for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
            const xi = anillo[i][0], yi = anillo[i][1], xj = anillo[j][0], yj = anillo[j][1];
            const intersecta = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-15) + xi);
            if (intersecta) dentro = !dentro;
        }
        return dentro;
    }

    function geometriaContienePunto(geometry, lon, lat) {
        if (!geometry) return false;
        const point = [lon, lat];
        if (geometry.type === 'Polygon') {
            const rings = geometry.coordinates || [];
            return !!rings.length && puntoEnAnillo(point, rings[0]) && !rings.slice(1).some(r => puntoEnAnillo(point, r));
        }
        if (geometry.type === 'MultiPolygon') {
            return (geometry.coordinates || []).some(poly => poly.length && puntoEnAnillo(point, poly[0]) && !poly.slice(1).some(r => puntoEnAnillo(point, r)));
        }
        return false;
    }

    function encontrarPoligonoDePuesto(puesto) {
        if (!datosOriginales || !puesto) return null;
        const lon = Number(puesto.lon);
        const lat = Number(puesto.lat);
        const feature = datosOriginales.features.find(f => geometriaContienePunto(f.geometry, lon, lat));
        if (feature) {
            const idx = datosOriginales.features.indexOf(feature);
            return { feature, nombre: obtenerNombreBarrio(feature, idx), aproximado: false, distanciaMetros: 0 };
        }

        // Fallback para puestos ubicados justo fuera de un límite dibujado manualmente.
        // Busca el centro geométrico más cercano, con un umbral conservador de 250 m.
        // La relación se marca como aproximada y no se presenta como límite oficial.
        const centroideAproximado = geometry => {
            const rings = [];
            if (geometry?.type === 'Polygon') (geometry.coordinates || []).forEach(r => rings.push(r));
            if (geometry?.type === 'MultiPolygon') (geometry.coordinates || []).forEach(poly => (poly || []).forEach(r => rings.push(r)));
            const pts = rings[0] || [];
            if (!pts.length) return null;
            const usable = pts.slice(0, -1);
            if (!usable.length) return null;
            return [usable.reduce((sum, c) => sum + Number(c[0]), 0) / usable.length,
                    usable.reduce((sum, c) => sum + Number(c[1]), 0) / usable.length];
        };
        const distanciaMetros = (aLon, aLat, bLon, bLat) => {
            const dy = (aLat - bLat) * 111320;
            const dx = (aLon - bLon) * 111320 * Math.cos((aLat * Math.PI) / 180);
            return Math.sqrt(dx * dx + dy * dy);
        };
        let mejor = null;
        datosOriginales.features.forEach((f, idx) => {
            const c = centroideAproximado(f.geometry);
            if (!c) return;
            const distancia = distanciaMetros(lon, lat, c[0], c[1]);
            if (!mejor || distancia < mejor.distanciaMetros) {
                mejor = { feature: f, nombre: obtenerNombreBarrio(f, idx), aproximado: true, distanciaMetros: distancia };
            }
        });
        return mejor && mejor.distanciaMetros <= 250 ? mejor : null;
    }

    function seleccionarPoligonoTerritorial(nombre, abrirFicha = true) {
        if (!datosOriginales || !map) return null;
        const feature = datosOriginales.features.find((f, i) => obtenerNombreBarrio(f, i) === nombre);
        if (!feature) return null;
        // La acción Ver o la selección desde el mapa aísla un solo polígono.
        datosOriginales.features.forEach((f, i) => {
            const n = obtenerNombreBarrio(f, i);
            barriosFiltroEstado[n] = n === nombre;
        });
        const searchInput = document.getElementById('barriosSearchInput');
        const selectAll = document.getElementById('select-all-barrios');
        if (selectAll) selectAll.checked = false;
        document.querySelectorAll('.chk-barrio').forEach(chk => { chk.checked = chk.dataset.nombre === nombre; });
        poligonoSeleccionadoNombre = nombre;
        poligonosCoincidenciaActiva = new Set([nombre]);
        actualizarMapa();
        // actualiza lista si el nombre elegido estaba fuera del filtro de búsqueda
        if (searchInput && searchInput.value && !nombre.toLocaleLowerCase('es').includes(searchInput.value.trim().toLocaleLowerCase('es'))) {
            searchInput.value = '';
            generarListaBarrios();
        }
        const activeCheckbox = Array.from(document.querySelectorAll('.chk-barrio')).find(c => c.dataset.nombre === nombre);
        if (activeCheckbox) activeCheckbox.checked = true;
        const layer = poligonosPorNombre[nombre];
        if (layer && geojsonLayer && map.hasLayer(geojsonLayer)) {
            const bounds = layer.getBounds();
            if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [70, 70], maxZoom: 17 });
            layer.setStyle({ color: '#FFFFFF', weight: 3.5, fillOpacity: 0.58, dashArray: null });
        }
        // La ficha no debe depender de que Leaflet encuentre la capa visible tras
        // reconstruir el GeoJSON. Abrirla siempre que la acción lo solicite.
        if (abrirFicha) mostrarFichaBarrio(feature, nombre);
        return { feature, nombre };
    }

    function aplicarFiltroTerritorialDesdePuestos(puestosSeleccionados, aislar = true) {
        if (!datosOriginales || !Array.isArray(datosOriginales.features)) return;
        const nombres = new Set();
        puestosSeleccionados.forEach(puesto => {
            const encontrado = encontrarPoligonoDePuesto(puesto);
            if (encontrado && encontrado.nombre) nombres.add(encontrado.nombre);
        });

        // Al seleccionar puestos, aislar exclusivamente los polígonos asociados.
        // Si la relación procede del fallback por proximidad, se trata como aproximada.
        if (aislar) {
            datosOriginales.features.forEach((feature, index) => {
                const nombre = obtenerNombreBarrio(feature, index);
                barriosFiltroEstado[nombre] = nombres.has(nombre);
            });
            poligonoSeleccionadoNombre = nombres.size === 1 ? Array.from(nombres)[0] : null;
            poligonosCoincidenciaActiva = new Set(nombres);
            if (typeof window.actualizarMapa === 'function') window.actualizarMapa();

            const bounds = L.latLngBounds([]);
            nombres.forEach(nombre => {
                const layer = poligonosPorNombre[nombre];
                if (layer && layer.getBounds && layer.getBounds().isValid()) bounds.extend(layer.getBounds());
            });
            if (bounds.isValid() && map) map.fitBounds(bounds, { padding: [55, 55], maxZoom: 17 });
            nombres.forEach(nombre => {
                const layer = poligonosPorNombre[nombre];
                if (layer && layer.setStyle) layer.setStyle({ color: '#FFFFFF', weight: 4, fillOpacity: 0.62 });
            });
        }
        return nombres;
    }

    function restablecerFiltrosPuestos() {
        const searchInput = document.getElementById('puestosSearchInput');
        const selectAll = document.getElementById('select-all-puestos');
        if (searchInput) searchInput.value = '';
        const zonaFilter = document.getElementById('filtroZonaPuestos');
        const numeroFilter = document.getElementById('filtroNumeroPuesto');
        if (zonaFilter) zonaFilter.value = '';
        if (numeroFilter) numeroFilter.value = '';
        puestosFiltroEstado = Object.create(null);
        listaPuestosVotacion.forEach(puesto => { puestosFiltroEstado[puesto.id] = true; });
        if (selectAll) selectAll.checked = true;
        if (datosOriginales && Array.isArray(datosOriginales.features)) {
            barriosFiltroEstado = Object.create(null);
            datosOriginales.features.forEach((feature, index) => {
                barriosFiltroEstado[obtenerNombreBarrio(feature, index)] = true;
            });
            poligonoSeleccionadoNombre = null;
            poligonosCoincidenciaActiva = new Set();
            if (typeof window.actualizarMapa === 'function') window.actualizarMapa();
        }
        generarListaPuestos();
        if (map) map.setView([4.8123, -74.3542], 14);
    }

    function generarListaPuestos() {
        const container = document.getElementById('puestos-checkbox-container');
        const searchInput = document.getElementById('puestosSearchInput');
        const resetBtn = document.getElementById('resetPuestosFiltersBtn');
        const selectAll = document.getElementById('select-all-puestos');
        const zonaFilter = document.getElementById('filtroZonaPuestos');
        const numeroFilter = document.getElementById('filtroNumeroPuesto');
        if (!container) return;

        function renderPuestos(filtro = "") {
            container.innerHTML = '';
            const query = normalizarBusquedaTerritorial(filtro);
            const zonaElegida = zonaFilter ? zonaFilter.value : '';
            const numeroElegido = numeroFilter ? numeroFilter.value : '';
            const coincidencias = listaPuestosVotacion.filter(puesto => {
                const texto = normalizarBusquedaTerritorial(`${puesto.nombre} ${puesto.direccion} zona ${puesto.zona} puesto ${puesto.numero}`);
                return (!query || texto.includes(query)) && (!zonaElegida || String(puesto.zona) === zonaElegida) && (!numeroElegido || String(puesto.numero) === numeroElegido);
            });

            listaPuestosVotacion.forEach(puesto => {
                const coincide = coincidencias.some(p => p.id === puesto.id);
                if (!coincide) return;

                const estaActivo = puestosFiltroEstado[puesto.id] !== false;
                const itemDiv = document.createElement('div');
                itemDiv.className = 'puesto-list-item';
                itemDiv.innerHTML = `
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1; min-width:0; margin:0;">
                        <input type="checkbox" class="chk-puesto" data-id="${puesto.id}" ${estaActivo ? 'checked' : ''}>
                        <span class="puesto-name-clickable" title="${puesto.nombre}">Z${puesto.zona} · P${puesto.numero} — ${puesto.nombre}</span>
                    </label>
                    <button type="button" class="puesto-zoom-btn" title="Ver ficha y barrio asociado en el mapa" style="background:transparent; border:none; color:var(--cyan-tactile); cursor:pointer; font-size:0.9rem; padding:2px 4px; flex-shrink:0;">📍</button>
                `;
                container.appendChild(itemDiv);

                const chk = itemDiv.querySelector('.chk-puesto');
                function abrirDetallePuesto() {
                    if (puestosFiltroEstado[puesto.id] === false) puestosFiltroEstado[puesto.id] = true;
                    // Al elegir un puesto individual, aislar su marcador y el polígono
                    // que contiene sus coordenadas, si existe coincidencia espacial.
                    listaPuestosVotacion.forEach(p => { puestosFiltroEstado[p.id] = p.id === puesto.id; });
                    if (selectAll) selectAll.checked = false;
                    if (searchInput) searchInput.value = puesto.nombre;
                    renderPuestos(puesto.nombre);
                    cargarPuestosEnMapa();
                    const encontrado = encontrarPoligonoDePuesto(puesto);
                    aplicarFiltroTerritorialDesdePuestos([puesto], true);
                    if (map) map.setView([puesto.lat, puesto.lon], 16);
                    const votantesPuesto = baseVotantes.filter(v => coincidePuesto(v, puesto));
                    mostrarFichaPuesto(puesto, votantesPuesto);
                    if (!encontrado) {
                        console.info('No se encontró un polígono cercano al puesto:', puesto.nombre);
                    } else if (encontrado.aproximado) {
                        console.info(`Polígono cercano sugerido para ${puesto.nombre}: ${encontrado.nombre} (~${Math.round(encontrado.distanciaMetros)} m del centro geométrico; relación aproximada, validar).`);
                    }
                }

                chk.addEventListener('change', function(e) {
                    const checked = e.target.checked;
                    if (checked) {
                        // Selección explícita: aislar este puesto, manteniendo el filtro
                        // comprensible y su barrio resaltado.
                        listaPuestosVotacion.forEach(p => { puestosFiltroEstado[p.id] = p.id === puesto.id; });
                        if (selectAll) selectAll.checked = false;
                        if (searchInput) searchInput.value = puesto.nombre;
                        renderPuestos(puesto.nombre);
                        cargarPuestosEnMapa();
                        aplicarFiltroTerritorialDesdePuestos([puesto], true);
                        if (map) map.setView([puesto.lat, puesto.lon], 16);
                    } else {
                        puestosFiltroEstado[puesto.id] = false;
                        cargarPuestosEnMapa();
                    }
                });

                itemDiv.querySelector('.puesto-name-clickable').addEventListener('click', function(e) {
                    e.preventDefault();
                    abrirDetallePuesto();
                });
                itemDiv.querySelector('.puesto-zoom-btn').addEventListener('click', function(e) {
                    e.stopPropagation();
                    abrirDetallePuesto();
                });
            });

            if (!container.children.length) {
                container.innerHTML = '<p class="loading-text">No se encontraron puestos con ese nombre o dirección.</p>';
            }
            cargarPuestosEnMapa();
        }

        renderPuestos(searchInput ? searchInput.value : '');

        if (searchInput && !searchInput.dataset.v11Bound) {
            searchInput.dataset.v11Bound = '1';
            searchInput.addEventListener('input', function() {
                const query = normalizarBusquedaTerritorial(this.value);
                if (!query) {
                    restablecerFiltrosPuestos();
                    return;
                }

                // Búsqueda en vivo: selecciona todas las coincidencias de nombre/dirección.
                listaPuestosVotacion.forEach(p => {
                    const texto = normalizarBusquedaTerritorial(`${p.nombre} ${p.direccion} zona ${p.zona} puesto ${p.numero}`);
                    puestosFiltroEstado[p.id] = texto.includes(query) && (!zonaFilter || !zonaFilter.value || String(p.zona) === zonaFilter.value) && (!numeroFilter || !numeroFilter.value || String(p.numero) === numeroFilter.value);
                });
                if (selectAll) selectAll.checked = false;
                renderPuestos(this.value);
                const matches = listaPuestosVotacion.filter(p => puestosFiltroEstado[p.id] !== false);
                aplicarFiltroTerritorialDesdePuestos(matches, true);
                if (matches.length === 1) {
                    const p = matches[0];
                    if (map) map.setView([p.lat, p.lon], 16);
                }
            });
        }

        [zonaFilter, numeroFilter].forEach(control => {
            if (control && !control.dataset.v12Bound) {
                control.dataset.v12Bound = '1';
                control.addEventListener('change', () => {
                    const q = normalizarBusquedaTerritorial(searchInput ? searchInput.value : '');
                    listaPuestosVotacion.forEach(p => {
                        const t = normalizarBusquedaTerritorial(`${p.nombre} ${p.direccion} zona ${p.zona} puesto ${p.numero}`);
                        puestosFiltroEstado[p.id] = (!q || t.includes(q)) && (!zonaFilter || !zonaFilter.value || String(p.zona) === zonaFilter.value) && (!numeroFilter || !numeroFilter.value || String(p.numero) === numeroFilter.value);
                    });
                    if (selectAll) selectAll.checked = false;
                    renderPuestos(searchInput ? searchInput.value : '');
                    const matches = listaPuestosVotacion.filter(p => puestosFiltroEstado[p.id] !== false);
                    aplicarFiltroTerritorialDesdePuestos(matches, true);
                    if (matches.length === 1 && map) map.setView([matches[0].lat, matches[0].lon], 16);
                });
            }
        });

        if (resetBtn && !resetBtn.dataset.v11Bound) {
            resetBtn.dataset.v11Bound = '1';
            resetBtn.addEventListener('click', restablecerFiltrosPuestos);
        }

        if (selectAll && !selectAll.dataset.v11Bound) {
            selectAll.dataset.v11Bound = '1';
            selectAll.addEventListener('change', function() {
                const isChecked = this.checked;
                listaPuestosVotacion.forEach(p => { puestosFiltroEstado[p.id] = isChecked; });
                if (isChecked) {
                    if (datosOriginales && Array.isArray(datosOriginales.features)) {
                        barriosFiltroEstado = Object.create(null);
                        datosOriginales.features.forEach((feature, index) => {
                            barriosFiltroEstado[obtenerNombreBarrio(feature, index)] = true;
                        });
                        poligonoSeleccionadoNombre = null;
                        poligonosCoincidenciaActiva = new Set();
                        if (typeof window.actualizarMapa === 'function') window.actualizarMapa();
                    }
                } else {
                    cargarPuestosEnMapa();
                }
                renderPuestos(searchInput ? searchInput.value : '');
            });
        }
    }

    function actualizarDashboardKPIs() {
        const totalVotantes = baseVotantes.length;
        const metaEsperada = 1000;
        const porcentaje = Math.min(100, Math.round((totalVotantes / metaEsperada) * 100));

        let lideresCount = 0;
        let activosCount = 0;
        let referidosCount = 0;

        baseVotantes.forEach(v => {
            const estado = (v.Estado || v.ESTADO || v.ROL || 'REFERIDO').toString().toUpperCase();
            if (estado.includes('LIDER') || estado.includes('LÍDER') || estado.includes('CUIDADOR')) lideresCount++;
            else if (estado.includes('ACTIVO')) activosCount++;
            else referidosCount++;
        });

        document.getElementById('kpiMetaVal').innerText = `${porcentaje}% (${totalVotantes} / ${metaEsperada})`;
        document.getElementById('kpiBarFill').style.width = `${porcentaje}%`;
        document.getElementById('kpiLideres').innerText = lideresCount;
        document.getElementById('kpiActivos').innerText = activosCount;
        document.getElementById('kpiReferidos').innerText = referidosCount;
    }

    function cargarPuestosEnMapa() {
        puestosLayerGroup.clearLayers();

        listaPuestosVotacion.forEach(puesto => {
            if (puestosFiltroEstado[puesto.id] === false) return;

            const votantesPuesto = baseVotantes.filter(v => coincidePuesto(v, puesto));
            const totalVotantes = votantesPuesto.length;

            const pin3DIcon = L.divIcon({
                className: 'custom-pin-3d-wrapper',
                html: `
                    <div style="position: relative; width: 44px; height: 52px; display: flex; align-items: center; justify-content: center; cursor: pointer; filter: drop-shadow(0px 8px 16px rgba(56, 189, 248, 0.6));">
                        <svg width="44" height="52" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="pinGradDark_${puesto.id}" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#38BDF8" />
                                    <stop offset="100%" stop-color="#1D4ED8" />
                                </linearGradient>
                            </defs>
                            <path d="M50 0 C22.4 0 0 22.4 0 50 C0 80 50 120 50 120 C50 120 100 80 100 50 C100 22.4 77.6 0 50 0 Z" fill="url(#pinGradDark_${puesto.id})"/>
                            <circle cx="50" cy="46" r="30" fill="#050817" />
                        </svg>
                        <span style="position: absolute; top: 11px; font-size: 16px;">🗳️</span>
                    </div>
                `,
                iconSize: [44, 52],
                iconAnchor: [22, 52]
            });

            const marker = L.marker([puesto.lat, puesto.lon], { icon: pin3DIcon });

            marker.bindTooltip(`Zona ${puesto.zona} · Puesto ${puesto.numero}: ${puesto.nombre} (${totalVotantes} votantes)`, {
                permanent: false, direction: 'top', className: 'leaflet-tooltip-barrio'
            });

            marker.on('click', function() {
                map.setView([puesto.lat, puesto.lon], 16);
                mostrarFichaPuesto(puesto, votantesPuesto);
            });

            puestosLayerGroup.addLayer(marker);
        });
    }

    function mostrarFichaPuesto(puesto, votantes) {
        colapsarPanelesDeFiltros();
        let mesasCount = {};
        votantes.forEach(v => {
            let m = v.MESA || 'S/N';
            mesasCount[m] = (mesasCount[m] || 0) + 1;
        });

        const totalMesas = Object.keys(mesasCount).length;
        const maxVotantesMesa = Math.max(...Object.values(mesasCount), 1);
        const relacionTerritorial = encontrarPoligonoDePuesto(puesto);
        if (relacionTerritorial) seleccionarPoligonoTerritorial(relacionTerritorial.nombre, false);

        const mesasOrdenadas = Object.keys(mesasCount).sort((a, b) => {
            const numA = parseInt(a, 10);
            const numB = parseInt(b, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });

        let htmlMesas = mesasOrdenadas.map(m => {
            let pct = Math.max(14, Math.round((mesasCount[m] / maxVotantesMesa) * 100));
            return `
                <div class="dash-progress-row">
                    <div class="dash-progress-label">
                        <span>Mesa ${m}</span>
                        <strong>${mesasCount[m]} votante(s)</strong>
                    </div>
                    <div class="dash-bar-bg">
                        <div class="dash-bar-fill" style="width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        }).join('');

        const buscarDatosElectorales = (data) => (data?.puestos || []).find(p => Number(p.zona) === Number(puesto.zona) && Number(p.puesto) === Number(puesto.numero));
        const datosElectorales2019 = buscarDatosElectorales(window.MTT_ELECTORAL_2019);
        const datosElectorales2023 = buscarDatosElectorales(window.MTT_ELECTORAL_2023);
        const fmtVotos = n => Number(n || 0).toLocaleString('es-CO');
        const renderBloqueElectoral = (datos, anio) => datos ? `
            <details class="electoral-year-result">
              <summary>🗳️ Resultados electorales ${anio} · Concejo</summary>
              <div class="electoral-post-kpis">
                <div><strong>${fmtVotos(datos.votosNulos)}</strong><small>Votos nulos</small></div>
                <div><strong>${fmtVotos(datos.votosBlanco)}</strong><small>Votos en blanco</small></div>
                <div><strong>${fmtVotos(datos.votosNoMarcados)}</strong><small>No marcados</small></div>
                <div><strong>${fmtVotos(datos.votosDiana)}</strong><small>Diana Marcela Morales Gutiérrez</small></div>
                <div class="total"><strong>${fmtVotos(datos.votosTotales)}</strong><small>Total de votos</small></div>
              </div>
              <details class="electoral-mesa-details">
                <summary>Ver resultados por mesa (${datos.mesas})</summary>
                <div class="electoral-mesa-list">${Object.entries(datos.detalleMesas).map(([mesa,v]) => `
                  <div class="electoral-mesa-row"><strong>Mesa ${mesa}</strong><span>Total: ${fmtVotos(v.votosTotales)}</span><small>Nulos ${fmtVotos(v.votosNulos)} · Blanco ${fmtVotos(v.votosBlanco)} · No marcados ${fmtVotos(v.votosNoMarcados)} · Diana ${fmtVotos(v.votosDiana)}</small></div>`).join('')}</div>
              </details>
            </details>` : `<p class="placeholder-text">No hay resultados de ${anio} asociados a este código de zona y puesto.</p>`;
        const bloqueElectoral = datosElectorales2019 || datosElectorales2023 ? `
            <div class="dash-divider"></div><div class="dash-section-title">🗳️ Historial de resultados electorales · Concejo</div>
            ${renderBloqueElectoral(datosElectorales2019,2019)}
            ${renderBloqueElectoral(datosElectorales2023,2023)}` : '<p class="placeholder-text">No hay resultados electorales asociados a este código de zona y puesto.</p>';

        const widgetContent = document.getElementById('floatingWidgetContent');
        widgetContent.innerHTML = `
            <div class="dash-header">
                <div class="dash-title-group">
                    <h3>🗳️ ${puesto.nombre}</h3>
                    <span class="dash-badge">ZONA ${puesto.zona} · PUESTO ${puesto.numero}</span>
                    <span class="dash-badge">PUESTO OFICIAL</span>
                </div>
            </div>

            <div class="dash-circles-row">
                <div class="dash-circle-item">
                    <div class="dash-circle-ring">
                        <span>${puesto.numero}</span>
                    </div>
                    <small>N.º de puesto</small>
                </div>

                <div class="dash-circle-item active">
                    <div class="dash-circle-ring primary">
                        <span>${votantes.length}</span>
                    </div>
                    <small>Inscritos</small>
                </div>

                <div class="dash-circle-item">
                    <div class="dash-circle-ring">
                        <span>${totalMesas}</span>
                    </div>
                    <small>Mesas</small>
                </div>
            </div>

            <div class="dash-divider"></div>

            <div class="dash-info-group">
                <div class="dash-info-item">
                    <span class="dash-icon">📍</span>
                    <div>
                        <small>Ubicación / Dirección</small>
                        <strong>${puesto.direccion}</strong>
                    </div>
                </div>
            </div>

            <div class="dash-divider"></div>

            <div class="dash-info-group">
                <div class="dash-info-item">
                    <span class="dash-icon">🏘️</span>
                    <div>
                        <small>Barrio / sector asociado</small>
                        <strong>${relacionTerritorial ? escapeHtml(relacionTerritorial.nombre) : 'No se encontró una coincidencia espacial'}</strong>
                    </div>
                </div>
            </div>

            <div class="dash-divider"></div>

            ${bloqueElectoral}

            <div class="dash-section-title">
                <span class="dash-icon">📊</span> Distribución de Censo por Mesas
            </div>
            <div class="dash-progress-container">
                ${htmlMesas || '<p class="placeholder-text" style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:10px;">Sin mesas asignadas en la base.</p>'}
            </div>

            <button id="downloadExcelBtn" class="excel-download-btn">
                📥 Descargar Reporte Excel (${votantes.length})
            </button>
        `;

        const widgetContainer = document.getElementById('floatingPuestoWidget');
        if (widgetContainer) {
            widgetContainer.dataset.kind = 'post';
            widgetContainer.classList.remove('hidden');
            widgetContainer.setAttribute('aria-live', 'polite');
        }

        document.getElementById('downloadExcelBtn').addEventListener('click', function() {
            exportarExcelPuesto(puesto, votantes);
        });
    }

    function exportarExcelPuesto(puesto, votantes) {
        if (votantes.length === 0) {
            alert("No hay votantes registrados para este puesto.");
            return;
        }

        const datosExportar = votantes.map((v, index) => ({
            "N.º": index + 1,
            "Documento": v.Documento || v.CEDULA || "",
            "Nombre Completo": v.NOMBRE || "",
            "Puesto de Votación": v['PUESTO DE VOTACION'] || puesto.nombre,
            "Mesa": v.MESA || "S/N",
            "Barrio": v.Barrio || "",
            "Líder / Cuidador": v.cuidador || v.CUIDADOR || v.LIDER || "",
            "Estado / Rol": v.Estado || v.ESTADO || v.ROL || "REFERIDO",
            "Teléfono": v['Teléfono / s'] || v.Teléfono || ""
        }));

        const worksheet = XLSX.utils.json_to_sheet(datosExportar);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Votantes Puesto");

        XLSX.writeFile(workbook, `Reporte_Votantes_${puesto.nombre.replace(/\s+/g, '_')}.xlsx`);
    }

    function actualizarConteoLogistica() {
        const result = document.getElementById('logisticaResultsContainer');
        if (result) {
            const total = baseVotantes.filter(v => {
                const mov = (v.movilidad || v.MOVILIDAD || v['¿Necesita transporte?'] || '').toString().toUpperCase();
                return mov.includes('REQUIERE') || mov.includes('TRANSPORTE') || mov.includes('RUTA') || mov === 'SI' || mov === 'SÍ';
            }).length;
            const node = result.querySelector('[data-logistica-total]');
            if (node) node.textContent = total;
        }
    }

    function inicializarModuloLogistica() {
        const btnLogistica = document.getElementById('logisticaBtn');
        const selectLogistica = document.getElementById('logisticaSelect');
        const dropdownLogistica = document.getElementById('dropdown-logistica');
        if (!btnLogistica || !selectLogistica || !dropdownLogistica) return;

        let logisticaResultsBox = document.getElementById('logisticaResultsContainer');
        if (!logisticaResultsBox) {
            logisticaResultsBox = document.createElement('div');
            logisticaResultsBox.id = 'logisticaResultsContainer';
            const dropdownContent = dropdownLogistica.querySelector('.dropdown-content');
            if (dropdownContent) dropdownContent.appendChild(logisticaResultsBox);
        }

        btnLogistica.addEventListener('click', function() {
            const tipo = selectLogistica.value.toUpperCase();
            
            const filtrados = baseVotantes.filter(v => {
                const mov = (v.movilidad || v.MOVILIDAD || '').toString().toUpperCase();
                if (tipo === 'TODOS') return true;
                if (tipo === 'REQUIERE') return mov.includes('REQUIERE') || mov.includes('TRANSPORTE') || mov.includes('RUTA');
                if (tipo === 'PROPIO') return mov.includes('PROPIO') || mov.includes('AUTONOMO');
                return true;
            });

            let puestosAgrupados = {};
            filtrados.forEach(v => {
                const pNombre = (v['PUESTO DE VOTACION'] || v.PuestoOriginal || 'SIN ASIGNAR').trim();
                puestosAgrupados[pNombre] = (puestosAgrupados[pNombre] || 0) + 1;
            });

            const topPuestos = Object.entries(puestosAgrupados)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4);

            const htmlTop = topPuestos.map(([nombre, cant]) => `
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${nombre}</span>
                    <strong style="color:var(--cyan-glow);">${cant}</strong>
                </div>
            `).join('');

            logisticaResultsBox.innerHTML = `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--neo-border-subtle); border-radius: 8px; padding: 10px; margin-top: 8px;">
                    <div style="font-size:0.8rem; font-weight:700; color:var(--cyan-glow); margin-bottom:4px;">
                        🚐 Movilidad: ${tipo === 'TODOS' ? 'Todos los Registros' : tipo}
                    </div>
                    <div style="font-size:0.76rem; color:var(--text-muted); margin-bottom:6px;">
                        Total electores: <strong style="color:var(--text-main);">${filtrados.length}</strong>
                    </div>
                    <div style="margin-bottom:8px;">
                        <small style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:4px; font-weight:600;">Puestos con mayor requerimiento:</small>
                        ${htmlTop || '<span style="font-size:0.72rem; color:var(--text-muted);">Sin registros</span>'}
                    </div>
                    <button id="downloadExcelLogisticaBtn" class="excel-download-btn" style="padding:8px 10px; font-size:0.78rem; margin-top:6px;">
                        📥 Exportar Reporte Día D (${filtrados.length})
                    </button>
                </div>
            `;

            const dlBtn = document.getElementById('downloadExcelLogisticaBtn');
            if (dlBtn) {
                dlBtn.addEventListener('click', function() {
                    const datosExportar = filtrados.map((v, index) => ({
                        "N.º": index + 1,
                        "Documento": v.Documento || v.CEDULA || "",
                        "Nombre Completo": v.NOMBRE || "",
                        "Puesto de Votación": v['PUESTO DE VOTACION'] || v.PuestoOriginal || "",
                        "Mesa": v.MESA || "S/N",
                        "Barrio": v.Barrio || "",
                        "Requerimiento Movilidad": v.movilidad || v.MOVILIDAD || "PROPIO",
                        "Cuidador / Líder": v.cuidador || v.CUIDADOR || v.LIDER || "",
                        "Teléfono": v['Teléfono / s'] || v.Teléfono || ""
                    }));

                    const worksheet = XLSX.utils.json_to_sheet(datosExportar);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Logistica Transporte");
                    XLSX.writeFile(workbook, `Reporte_Logistica_Dia_D_${tipo}.xlsx`);
                });
            }
        });
    }

    function inicializarModuloTestigosPMU() {
        const modal = document.getElementById('testigosModal');
        const openBtn = document.getElementById('openTestigosModalBtn');
        const closeBtn = document.getElementById('closeTestigosModalBtn');
        const downloadAllBtn = document.getElementById('downloadAllEvidenciasBtn');
        const galleryGrid = document.getElementById('testigosGalleryGrid');

        openBtn.addEventListener('click', function() {
            modal.classList.remove('hidden');
            renderizarGaleriaTestigos();
        });

        closeBtn.addEventListener('click', function() {
            modal.classList.add('hidden');
        });

        downloadAllBtn.addEventListener('click', function() {
            const evidenciasLocales = JSON.parse(localStorage.getItem('faca_evidencias_testigos')) || [];
            if (evidenciasLocales.length === 0) {
                alert("No hay evidencias registradas para exportar.");
                return;
            }

            const resumenExportar = evidenciasLocales.map((ev, index) => ({
                "N.º": index + 1,
                "Puesto de Votación": ev.puesto,
                "Mesa(s)": ev.mesa,
                "Hora de Transmisión": ev.hora,
                "Observaciones": ev.nota
            }));

            const worksheet = XLSX.utils.json_to_sheet(resumenExportar);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Actas E14");
            XLSX.writeFile(workbook, `Reporte_Consolidado_Actas_E14_PMU.xlsx`);
        });

        const filtroPuestoActas = document.getElementById('filtroPuestoActas');
        const filtroZonaActas = document.getElementById('filtroZonaActas');
        const filtroNumeroActas = document.getElementById('filtroNumeroActas');
        const ordenMesasActas = document.getElementById('ordenMesasActas');
        function normalizarMesa(valor) {
            const nums = String(valor ?? '').match(/\d+/g);
            return nums && nums.length ? Math.min(...nums.map(Number)) : Number.MAX_SAFE_INTEGER;
        }
        function actualizarFiltroPuestos(evidencias) {
            if (!filtroPuestoActas) return;
            const anterior = filtroPuestoActas.value;
            const puestos = [...new Set(evidencias.map(ev => ev.puesto).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
            filtroPuestoActas.innerHTML = '<option value="">Todos los puestos</option>' + puestos.map(p => `<option value="${String(p).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}">${p}</option>`).join('');
            if (puestos.includes(anterior)) filtroPuestoActas.value = anterior;
        }
        if (filtroPuestoActas) filtroPuestoActas.addEventListener('change', renderizarGaleriaTestigos);
        if (filtroZonaActas) filtroZonaActas.addEventListener('change', renderizarGaleriaTestigos);
        if (filtroNumeroActas) filtroNumeroActas.addEventListener('change', renderizarGaleriaTestigos);
        if (ordenMesasActas) ordenMesasActas.addEventListener('change', renderizarGaleriaTestigos);

        function renderizarGaleriaTestigos() {
            const evidenciasLocales = JSON.parse(localStorage.getItem('faca_evidencias_testigos')) || [];
            actualizarFiltroPuestos(evidenciasLocales);
            if (evidenciasLocales.length === 0) {
                galleryGrid.innerHTML = `<p class="placeholder-text">No hay actas cargadas aún. Esperando transmisión de los testigos en campo...</p>`;
                return;
            }
            const puestoElegido = filtroPuestoActas ? filtroPuestoActas.value : '';
            const zonaElegida = filtroZonaActas ? filtroZonaActas.value : '';
            const numeroElegido = filtroNumeroActas ? filtroNumeroActas.value : '';
            const orden = ordenMesasActas ? ordenMesasActas.value : 'asc';
            const evidenciasFiltradas = evidenciasLocales.filter(ev => {
                const nombre = normalizarTexto(ev.puesto);
                const oficial = listaPuestosVotacion.find(p => normalizarTexto(p.matchName) === nombre || normalizarTexto(p.nombre) === nombre);
                return (!puestoElegido || ev.puesto === puestoElegido) && (!zonaElegida || (oficial && String(oficial.zona) === zonaElegida)) && (!numeroElegido || (oficial && String(oficial.numero) === numeroElegido));
            }).sort((a,b) => (normalizarMesa(a.mesa) - normalizarMesa(b.mesa)) * (orden === 'desc' ? -1 : 1));
            if (!evidenciasFiltradas.length) {
                galleryGrid.innerHTML = `<p class="placeholder-text">No hay actas para el puesto seleccionado.</p>`;
                return;
            }
            galleryGrid.innerHTML = evidenciasFiltradas.map(ev => `
                <div class="testigo-card-item">
                    <img src="${ev.imgData}" alt="Acta E-14 Puesto ${ev.puesto}">
                    <div class="testigo-card-info">
                        <strong>📍 ${ev.puesto}</strong>
                        <small><strong>Mesas:</strong> ${ev.mesa} | <strong>Hora:</strong> ${ev.hora}</small>
                        <small><strong>Nota:</strong> ${ev.nota}</small>
                        <a href="${ev.imgData}" download="E14_${ev.puesto.replace(/\s+/g, '_')}_Mesas_${ev.mesa}.jpg" class="testigo-download-link">
                            📥 Descargar Foto E-14
                        </a>
                    </div>
                </div>
            `).join('');
        }
    }

    function inicializarModuloInfoMIRA() {
        const inputCuidador = document.getElementById('cuidadorSearchInput');
        const btnBuscarMira = document.getElementById('miraSearchBtn');
        const selectEstado = document.getElementById('miraEstadoSelect');
        const btnResetMira = document.getElementById('miraResetBtn');
        const miraInternalContainer = document.getElementById('miraInternalResultsContainer');

        function aplicarFiltroInfoMIRA() {
            const queryCuidador = inputCuidador.value.trim().toLowerCase();
            const estadoFiltro = selectEstado.value.toUpperCase();

            if (!queryCuidador && estadoFiltro === 'TODOS') {
                miraMarkersGroup.clearLayers();
                if (!map.hasLayer(puestosLayerGroup)) map.addLayer(puestosLayerGroup);
                if (miraInternalContainer) miraInternalContainer.innerHTML = '';
                
                const dashCard = document.getElementById('adminDashboardCard');
                if (dashCard) dashCard.classList.remove('dashboard-compact');
                const dropdownMira = document.getElementById('dropdown-infomira');
                if (dropdownMira) dropdownMira.classList.remove('dropdown-expanded-full');

                return;
            }

            const redEncontrada = baseVotantes.filter(v => {
                const cuidador = (v.cuidador || v.CUIDADOR || v.LIDER || '').toString().toLowerCase();
                const docCuidador = (v.cedula_cuidador || v.DOC_CUIDADOR || '').toString().toLowerCase();
                const nombrePropio = (v.NOMBRE || '').toString().toLowerCase();
                const docPropio = (v.Documento || v.CEDULA || '').toString().toLowerCase();
                const estadoVal = (v.Estado || v.ESTADO || v.ROL || 'REFERIDO').toString().toUpperCase();

                const coincideCuidador = !queryCuidador || 
                    cuidador.includes(queryCuidador) || 
                    docCuidador.includes(queryCuidador) ||
                    nombrePropio.includes(queryCuidador) ||
                    docPropio.includes(queryCuidador);

                const coincideEstado = (estadoFiltro === 'TODOS') || estadoVal.includes(estadoFiltro);

                return coincideCuidador && coincideEstado;
            });

            if (redEncontrada.length === 0) {
                if (miraInternalContainer) {
                    miraInternalContainer.innerHTML = `<div style="font-size: 0.78rem; color: #f87171; padding: 8px; text-align: center;">No se encontraron registros para la red.</div>`;
                }
                return;
            }

            puestosLayerGroup.remove();
            miraMarkersGroup.clearLayers();

            let puestosAfectados = {};
            redEncontrada.forEach(v => {
                const pNombre = normalizarTexto(v['PUESTO DE VOTACION']);
                if (!puestosAfectados[pNombre]) puestosAfectados[pNombre] = [];
                puestosAfectados[pNombre].push(v);
            });

            let bounds = [];

            listaPuestosVotacion.forEach(puesto => {
                const votantesRedPuesto = puestosAfectados[normalizarTexto(puesto.matchName)] || [];
                if (votantesRedPuesto.length > 0) {
                    bounds.push([puesto.lat, puesto.lon]);

                    const pinMiraIcon = L.divIcon({
                        className: 'custom-pin-mira-wrapper',
                        html: `
                            <div style="position: relative; width: 46px; height: 54px; display: flex; align-items: center; justify-content: center; cursor: pointer; filter: drop-shadow(0px 8px 18px rgba(56, 189, 248, 0.9));">
                                <svg width="46" height="54" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M50 0 C22.4 0 0 22.4 0 50 C0 80 50 120 50 120 C50 120 100 80 100 50 C100 22.4 77.6 0 50 0 Z" fill="#2563EB"/>
                                    <circle cx="50" cy="46" r="32" fill="#050817" stroke="#38BDF8" stroke-width="4"/>
                                </svg>
                                <span style="position: absolute; top: 12px; font-size: 16px;">💙</span>
                            </div>
                        `,
                        iconSize: [46, 54],
                        iconAnchor: [23, 54]
                    });

                    const marker = L.marker([puesto.lat, puesto.lon], { icon: pinMiraIcon });
                    marker.bindTooltip(`Red InfoMIRA: ${votantesRedPuesto.length} asignados en ${puesto.nombre}`, {
                        permanent: false, direction: 'top', className: 'leaflet-tooltip-barrio'
                    });

                    marker.on('click', function() {
                        map.setView([puesto.lat, puesto.lon], 16);
                        mostrarFichaPuesto(puesto, votantesRedPuesto);
                    });

                    miraMarkersGroup.addLayer(marker);
                }
            });

            if (bounds.length > 0) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }

            mostrarResultadosEnModuloInfoMIRA(queryCuidador, estadoFiltro, redEncontrada, puestosAfectados);
        }

        function mostrarResultadosEnModuloInfoMIRA(query, estado, redTotal, puestosAfectados) {
            if (!miraInternalContainer) return;
            const nombreLider = query ? query.toUpperCase() : "GENERAL";
            const numPuestos = Object.keys(puestosAfectados).length;

            const dashCard = document.getElementById('adminDashboardCard');
            if (dashCard) dashCard.classList.add('dashboard-compact');

            const dropdownMira = document.getElementById('dropdown-infomira');
            if (dropdownMira) dropdownMira.classList.add('dropdown-expanded-full');

            let htmlDetalleIntegrantes = redTotal.map((v, i) => `
                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--neo-border-subtle); border-radius: 10px; padding: 10px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; color: var(--text-main); font-size: 0.85rem;">${i + 1}. ${v.NOMBRE || 'Sin Nombre'}</span>
                        <span style="font-size: 0.68rem; padding: 2px 6px; background: rgba(56, 189, 248, 0.15); color: var(--cyan-glow); border-radius: 4px; font-weight: 600;">
                            ${v.Estado || v.ESTADO || v.ROL || 'REFERIDO'}
                        </span>
                    </div>
                    <div style="font-size: 0.78rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 4px;">
                        <div><strong>Doc:</strong> ${v.Documento || v.CEDULA || 'N/A'}</div>
                        <div><strong>Tel:</strong> ${v['Teléfono / s'] || v.Teléfono || 'N/A'}</div>
                        <div><strong>Puesto:</strong> ${v['PUESTO DE VOTACION'] || 'Sin Asignar'}</div>
                        <div><strong>Mesa:</strong> ${v.MESA || 'S/N'}</div>
                    </div>
                </div>
            `).join('');

            // Reemplaza la generación del botón de WhatsApp en app.js dentro de mostrarResultadosEnModuloInfoMIRA:

let btnWhatsappHTML = "";
if (query && redTotal.length > 0) {
    const personaPrincipal = redTotal[0];
    const rawTel = personaPrincipal['Teléfono / s'] || personaPrincipal.Teléfono || personaPrincipal.telefono || "";
    const cleanTel = rawTel.toString().replace(/\D/g, '');

    if (cleanTel) {
        const fullNumber = cleanTel.length === 10 ? `57${cleanTel}` : cleanTel;
        const mensajeWa = encodeURIComponent(`Hola ${personaPrincipal.NOMBRE || ''}, te contacto desde el Centro de Operaciones PMU MIRA tu territorio.`);
        
        btnWhatsappHTML = `
            <a href="https://wa.me/${fullNumber}?text=${mensajeWa}" target="_blank" class="whatsapp-btn-action" title="Abrir chat de WhatsApp">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px;">
                    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.763.459 3.486 1.332 5.003L2 22l5.133-1.337a9.92 9.92 0 004.872 1.282h.005c5.505 0 9.988-4.478 9.989-9.984 0-2.668-1.037-5.176-2.925-7.062A9.914 9.914 0 0012.012 2zm0 18.156h-.004a8.267 8.267 0 01-4.221-1.155l-.303-.18-3.136.818.835-3.048-.198-.314a8.257 8.257 0 01-1.266-4.473c0-4.561 3.711-8.272 8.277-8.272 2.21 0 4.288.86 5.852 2.426a8.23 8.23 0 012.42 5.852c0 4.562-3.712 8.273-8.272 8.273zm4.536-6.195c-.249-.124-1.472-.726-1.7-.809-.228-.083-.394-.124-.56.124-.165.249-.643.809-.788.975-.145.166-.29.187-.539.062a6.793 6.793 0 01-2.001-1.233 7.488 7.488 0 01-1.385-1.724c-.145-.249-.015-.384.109-.508.112-.112.249-.29.373-.435.125-.145.166-.249.249-.415.083-.166.042-.311-.021-.435-.062-.125-.56-1.349-.767-1.847-.202-.486-.407-.42-.56-.428l-.477-.008c-.166 0-.435.062-.663.311-.228.249-.871.851-.871 2.075 0 1.224.892 2.406 1.016 2.572.124.166 1.756 2.682 4.254 3.761.594.257 1.058.411 1.42.526.597.19 1.14.163 1.569.099.478-.071 1.472-.602 1.679-1.183.207-.581.207-1.079.145-1.183-.062-.104-.228-.187-.477-.311z"/>
                </svg>
                WhatsApp
            </a>
        `;
    }
}

            miraInternalContainer.innerHTML = `
                <div style="border-top: 1px solid var(--neo-border-subtle); padding-top: 10px; margin-top: 6px;">
                    <div style="font-size: 0.85rem; color: var(--cyan-tactile); font-weight: 700; margin-bottom: 4px;">💙 Red InfoMIRA — ${nombreLider}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 8px;">
                        <div><strong>Estado:</strong> ${estado} | <strong>Integrantes:</strong> ${redTotal.length}</div>
                        <div><strong>Puestos Cubiertos:</strong> ${numPuestos}</div>
                    </div>
                    <div style="margin-bottom: 8px;">
                        ${htmlDetalleIntegrantes}
                    </div>
                    <div class="mira-actions-container">
                        <button id="downloadExcelRedInternalBtn" class="excel-download-btn" style="margin-top:0;">
                            📥 Exportar Excel (${redTotal.length})
                        </button>
                        ${btnWhatsappHTML}
                    </div>
                </div>
            `;

            document.getElementById('downloadExcelRedInternalBtn').addEventListener('click', function() {
                const datosExportar = redTotal.map((v, index) => ({
                    "N.º": index + 1,
                    "Documento": v.Documento || v.CEDULA || "",
                    "Nombre Completo": v.NOMBRE || "",
                    "Cuidador / Líder": v.cuidador || v.CUIDADOR || v.LIDER || nombreLider,
                    "Estado / Rol": v.Estado || v.ESTADO || v.ROL || "REFERIDO",
                    "Puesto de Votación": v['PUESTO DE VOTACION'] || "",
                    "Mesa": v.MESA || "S/N",
                    "Barrio": v.Barrio || "",
                    "Teléfono": v['Teléfono / s'] || v.Teléfono || ""
                }));

                const worksheet = XLSX.utils.json_to_sheet(datosExportar);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Red InfoMIRA");
                XLSX.writeFile(workbook, `Red_InfoMIRA_${nombreLider.replace(/\s+/g, '_')}.xlsx`);
            });
        }

        btnBuscarMira.addEventListener('click', aplicarFiltroInfoMIRA);
        inputCuidador.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') aplicarFiltroInfoMIRA();
        });
        selectEstado.addEventListener('change', aplicarFiltroInfoMIRA);

        btnResetMira.addEventListener('click', function() {
            inputCuidador.value = '';
            selectEstado.value = 'TODOS';
            miraMarkersGroup.clearLayers();
            if (!map.hasLayer(puestosLayerGroup)) map.addLayer(puestosLayerGroup);
            if (miraInternalContainer) miraInternalContainer.innerHTML = '';
            
            const dashCard = document.getElementById('adminDashboardCard');
            if (dashCard) dashCard.classList.remove('dashboard-compact');
            const dropdownMira = document.getElementById('dropdown-infomira');
            if (dropdownMira) dropdownMira.classList.remove('dropdown-expanded-full');

            map.setView([4.8123, -74.3542], 14);
        });
    }

    function obtenerUltimaActividadPorBarrio(nombreBarrio, tipo) {
        const normalizar = valor => normalizarTexto(String(valor || ''));
        const barrio = normalizar(nombreBarrio);
        let registros = [];
        if (tipo === 'partido') {
            const estado = (typeof activitiesState !== 'undefined' && activitiesState) ? activitiesState : null;
            registros = estado && Array.isArray(estado.activities) ? estado.activities : [];
            registros = registros.filter(a => {
                const lugar = normalizar(a.barrio || a.sector || a.place || a.lugar || '');
                return lugar && (lugar === barrio || lugar.includes(barrio) || barrio.includes(lugar));
            }).map(a => ({ nombre: a.name || a.actividad || a.nombre || '', fecha: a.date || a.fecha || '' }));
        } else {
            try {
                const guardados = JSON.parse(localStorage.getItem('mira_concejal_activities_v1') || '[]');
                registros = (Array.isArray(guardados) ? guardados : []).filter(a =>
                    normalizar(a.barrio || a.sector || '') === barrio
                ).map(a => ({ nombre: a.description || a.actividad || a.name || a.nombre || '', fecha: a.date || a.fecha || '' }));
            } catch (_) { registros = []; }
        }
        registros.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
        return registros[0] || null;
    }

    function htmlResumenActividad(nombreBarrio, tipo) {
        const actividad = obtenerUltimaActividadPorBarrio(nombreBarrio, tipo);
        if (!actividad || !actividad.nombre) return 'Por registrar';
        return `${escapeHtml(actividad.nombre)}${actividad.fecha ? ` · ${escapeHtml(actividad.fecha)}` : ''}`;
    }

    window.actualizarMapa = function() {
        if (!datosOriginales || !map) return;
        if (geojsonLayer && map.hasLayer(geojsonLayer)) map.removeLayer(geojsonLayer);
        poligonosPorNombre = Object.create(null);

        geojsonLayer = L.geoJSON(datosOriginales, {
            filter: function(feature) {
                const index = datosOriginales.features.indexOf(feature);
                const nombre = obtenerNombreBarrio(feature, index);
                return barriosFiltroEstado[nombre] !== false;
            },
            style: function(feature) {
                const estilo = feature.properties?.estilo_kml || {};
                const color = estilo.fill || estilo.line || '#0891B2';
                const nombreFeature = obtenerNombreBarrio(feature, datosOriginales.features.indexOf(feature));
                const seleccionado = nombreFeature === poligonoSeleccionadoNombre || poligonosCoincidenciaActiva.has(nombreFeature);
                return {
                    color: seleccionado ? '#FFFFFF' : (estilo.line || color),
                    weight: seleccionado ? 3.5 : 1.65,
                    opacity: Math.max(0.85, estilo.lineOpacity || 1),
                    fillColor: color,
                    fillOpacity: seleccionado ? 0.58 : Math.max(0.36, Math.min(0.52, (estilo.fillOpacity || 0.30) * 1.7)),
                    lineJoin: 'round'
                };
            },
            onEachFeature: function(feature, layer) {
                const index = datosOriginales.features.indexOf(feature);
                const nombre = obtenerNombreBarrio(feature, index);
                const estilo = feature.properties?.estilo_kml || {};
                const color = estilo.fill || estilo.line || '#0891B2';
                poligonosPorNombre[nombre] = layer;
                const construirFichaPopup = () => `
                    <div style="min-width:240px;max-width:310px;font-family:system-ui,sans-serif;color:#172033">
                      <strong style="display:block;font-size:14px;margin-bottom:9px">🏘️ ${escapeHtml(nombre)}</strong>
                      <div style="font-size:12px;line-height:1.65">
                        <div><b>Líder del barrio:</b> <span>${escapeHtml(feature.properties?.lider || feature.properties?.LIDER || 'Por registrar')}</span></div>
                        <div><b>JAC:</b> <span>${escapeHtml(feature.properties?.jac || feature.properties?.JAC || 'Por registrar')}</span></div>
                        <div style="margin-top:6px"><b>Actividad del partido:</b><br><span>${htmlResumenActividad(nombre, 'partido')}</span></div>
                        <div style="margin-top:6px"><b>Actividad concejal:</b><br><span>${htmlResumenActividad(nombre, 'concejal')}</span></div>
                      </div>
                      <div style="font-size:10px;color:#64748b;margin-top:8px">Los registros del partido y de la concejal se mantienen separados.</div>
                    </div>`;
                layer.bindTooltip(nombre, { sticky: true, direction: 'top', opacity: 0.98, className: 'leaflet-tooltip-barrio' });
                // La ficha completa se muestra en el panel lateral; no abrimos popup sobre el polígono.
                layer.on('mouseover', function() {
                    const isSelected = poligonoSeleccionadoNombre === nombre || poligonosCoincidenciaActiva.has(nombre);
                    layer.setStyle({ color: '#FFFFFF', weight: isSelected ? 4 : 2.8, fillOpacity: isSelected ? 0.62 : 0.52 });
                    if (layer.bringToFront) layer.bringToFront();
                });
                layer.on('mouseout', function() {
                    const isSelected = poligonoSeleccionadoNombre === nombre || poligonosCoincidenciaActiva.has(nombre);
                    layer.setStyle({
                        color: isSelected ? '#FFFFFF' : (estilo.line || color),
                        weight: isSelected ? 3.5 : 1.65,
                        opacity: Math.max(0.85, estilo.lineOpacity || 1),
                        fillColor: color,
                        fillOpacity: isSelected ? 0.58 : Math.max(0.36, Math.min(0.52, (estilo.fillOpacity || 0.30) * 1.7)),
                        lineJoin: 'round'
                    });
                });
                layer.on('click', function() {
                    seleccionarPoligonoTerritorial(nombre, false);
                    mostrarFichaBarrio(feature, nombre);
                });
            }
        });
        if (poligonosKmlVisibles) geojsonLayer.addTo(map);
    };

    function mostrarFichaBarrio(feature, nombre) {
        colapsarPanelesDeFiltros();
        const widget = document.getElementById('floatingPuestoWidget');
        const content = document.getElementById('floatingWidgetContent');
        if (!widget || !content) return;
        const propiedades = feature?.properties || {};
        const barrioNorm = normalizarTexto(nombre);
        // Solo relacionar personas cuando la base contiene un campo territorial explícito.
        const personas = baseVotantes.filter(persona => {
            const sector = persona.BARRIO || persona.Barrio || persona.barrio || persona.SECTOR || persona.Sector || persona.sector || persona.BARRIO_SECTOR || persona.barrio_sector || '';
            return sector && normalizarTexto(sector) === barrioNorm;
        });
        const nombresPersonas = personas.slice(0, 12).map(persona => {
            const nombrePersona = persona.NOMBRE_COMPLETO || persona.nombre_completo || persona.NOMBRE || persona.Nombre || persona.nombre || 'Persona sin nombre disponible';
            const rol = persona.ROL || persona.Rol || persona.Estado || persona.ESTADO || '';
            return `<div class="territory-person-row"><span>👤 ${escapeHtml(nombrePersona)}</span>${rol ? `<small>${escapeHtml(rol)}</small>` : ''}</div>`;
        }).join('');
        const ultimaConcejal = (window.MiraConcejalActivities && window.MiraConcejalActivities.getLatestForBarrio(nombre)) || null;
        const ultimaTexto = ultimaConcejal ? `${ultimaConcejal.description || ultimaConcejal.actividad || 'Actividad registrada'}${ultimaConcejal.date ? ' · ' + ultimaConcejal.date : ''}` : 'Por registrar';
        content.innerHTML = `
          <div class="territory-card-header"><div><h3>🏘️ ${escapeHtml(nombre)}</h3><span class="dash-badge">FICHA TERRITORIAL</span></div></div>
          <div class="territory-card-fields">
            <div><small>Líder del barrio</small><strong>${escapeHtml(propiedades.lider || propiedades.LIDER || 'Por registrar')}</strong></div>
            <div><small>Junta de Acción Comunal (JAC)</small><strong>${escapeHtml(propiedades.jac || propiedades.JAC || 'Por registrar')}</strong></div>
            <div><small>Última actividad de la concejal</small><strong>${escapeHtml(ultimaTexto)}</strong></div>
          </div>
          <div class="activity-actions" style="margin:10px 0"><button type="button" class="activity-secondary-btn" data-open-concejal-barrio="${escapeHtml(nombre)}">Ver historial de este barrio</button></div>
          <div class="dash-divider"></div>
          <div class="territory-people-title">👥 Personas registradas en este sector <b>${personas.length}</b></div>
          <div class="territory-people-list">${nombresPersonas || '<p class="placeholder-text">No hay personas asociadas explícitamente a este barrio en la base cargada. No se asignan personas por aproximación.</p>'}</div>
          ${personas.length > 12 ? `<small class="territory-more-people">Mostrando 12 de ${personas.length} registros.</small>` : ''}
        `;
        const historyBtn = content.querySelector('[data-open-concejal-barrio]');
        if (historyBtn) historyBtn.addEventListener('click', () => {
            const workspace = document.getElementById('concejalWorkspace');
            if (workspace) {
                workspace.classList.remove('hidden');
                document.getElementById('activitiesPlaceholder').classList.add('hidden');
                document.getElementById('landing-hero-overlay').style.display='none';
                document.getElementById('landingHeaderControls').style.display='none';
                const filter = document.getElementById('concejalFilterBarrio'); if (filter) filter.value = nombre;
                const input = document.getElementById('concejalBarrioInput'); if (input) input.value = nombre;
                window.dispatchEvent(new Event('mira:open-concejal-history'));
            }
        });
        widget.dataset.kind = 'territory';
        widget.classList.remove('hidden');
        // Asegura que la ficha territorial se muestre por encima del mapa y
        // de los módulos laterales, incluso tras una transición o un cambio de capa.
        widget.style.display = 'block';
        widget.style.visibility = 'visible';
        widget.style.opacity = '1';
        widget.setAttribute('aria-live', 'polite');
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, function(char) {
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]);
        });
    }

    setTimeout(() => { if (map) map.invalidateSize(); }, 200);
}
function limpiarEstadoVisualPMU(){
  const appContainer = document.getElementById('app-container');
  if (appContainer) appContainer.style.display = 'none';
  const activities = document.getElementById('activitiesPlaceholder');
  if (activities) activities.classList.add('hidden');
  ['testigosModal','testigoStandaloneContainer','concejalWorkspace'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.classList.add('hidden');
  });
  const widget=document.getElementById('floatingPuestoWidget');
  if(widget){widget.classList.add('hidden');widget.style.display='none';}
  const menu=document.querySelector('.neo-tactile-sidebar');
  if(menu) menu.classList.remove('menu-open','expanded','active');
  const admin=document.getElementById('adminCardContainer');
  if(admin){admin.classList.remove('is-open');admin.classList.add('hidden');}
  const backdrop=document.getElementById('adminLoginBackdrop');
  if(backdrop){backdrop.classList.add('hidden');backdrop.setAttribute('aria-hidden','true');}
  document.body.classList.remove('admin-login-active','pmu-neomorphic');
  const landing=document.getElementById('landing-hero-overlay');
  if(landing) landing.style.display='flex';
  const controls=document.getElementById('landingHeaderControls');
  if(controls) controls.style.display='flex';
  const pass=document.getElementById('password'); if(pass) pass.value='';
  const user=document.getElementById('username'); if(user) user.value='';
  const error=document.getElementById('loginError'); if(error) error.style.display='none';
  window.scrollTo({top:0,behavior:'smooth'});
}

function volverAInterfazInicial(){
  // La sesión remota se cierra desde Neon Auth (mira-auth.js).
  limpiarEstadoVisualPMU();
}
const homeReturnButton = document.getElementById('platformHomeBtn');
if(homeReturnButton){
  homeReturnButton.addEventListener('click', volverAInterfazInicial);
}



// MÓDULO CONCEJAL V14 — separado de las actividades generales del partido.
(function initConcejalModule(){
  const workspace=document.getElementById('concejalWorkspace');
  if(!workspace)return;
  const STORE_KEY='mira_concejal_activities_v1';
  const form=document.getElementById('concejalActivityForm');
  const barrioInput=document.getElementById('concejalBarrioInput');
  const descriptionInput=document.getElementById('concejalActivityDescription');
  const dateInput=document.getElementById('concejalActivityDate');
  const options=document.getElementById('concejalBarriosOptions');
  const list=document.getElementById('concejalHistoryList');
  const notice=document.getElementById('concejalFormNotice');
  let records=readRecords(); let editingId=null; let miniMap=null; let miniLayer=null; let miniTileLayer=null; let selectedFeatureLayer=null; let featureCollection=null;
  function readRecords(){try{const v=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){console.warn('No se pudo leer el historial de Concejal.',e);return[]}}
  function persist(){localStorage.setItem(STORE_KEY,JSON.stringify(records));document.getElementById('concejalSidebarCount').textContent=records.length+' actividades guardadas en este navegador (pendiente de servidor central)';renderHistory()}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
  function getNames(){return Object.keys(poligonosPorNombre||{}).sort((a,b)=>a.localeCompare(b,'es'))}
  function populateNames(){const names=getNames(); options.innerHTML=names.map(n=>'<option value="'+esc(n)+'"></option>').join(''); if(!names.length) fetch('./barrios_poligonos_kml_aportado.geojson').then(r=>r.ok?r.json():Promise.reject()).then(fc=>{featureCollection=fc;const ns=(fc.features||[]).map(f=>(f.properties&&(f.properties.name||f.properties.Name||f.properties.nombre||f.properties.NOMBRE))||'').filter(Boolean);options.innerHTML=[...new Set(ns)].sort((a,b)=>a.localeCompare(b,'es')).map(n=>'<option value="'+esc(n)+'"></option>').join('');}).catch(()=>{});else if(!featureCollection)fetch('./barrios_poligonos_kml_aportado.geojson').then(r=>r.ok?r.json():Promise.reject()).then(fc=>{featureCollection=fc;}).catch(()=>{});}
  function initMiniMap(){if(miniMap||!window.L)return;const el=document.getElementById('concejalMiniMap');if(!el)return;miniMap=L.map(el,{zoomControl:false,scrollWheelZoom:false,attributionControl:false}).setView([4.8123,-74.3542],13);L.control.zoom({position:'topright'}).addTo(miniMap);miniTileLayer=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}).addTo(miniMap);miniLayer=L.geoJSON(null,{style:f=>{const p=f.properties||{};const st=p.estilo_kml||{};return {color:st.line||p.stroke||p.color||'#36dce9',weight:st.lineWidth||2,fillColor:st.fill||p.fill||p.color||'#20c7df',fillOpacity:Math.max(.16,Math.min(.36,st.fillOpacity||.24))}},onEachFeature:(f,l)=>{const n=(f.properties&&(f.properties.name||f.properties.Name||f.properties.nombre||f.properties.NOMBRE))||'Sector';l.bindTooltip(n);}}).addTo(miniMap);if(featureCollection)miniLayer.addData(featureCollection);else fetch('./barrios_poligonos_kml_aportado.geojson').then(r=>r.json()).then(fc=>{featureCollection=fc;if(miniLayer)miniLayer.addData(fc);}).catch(()=>{});setTimeout(()=>miniMap&&miniMap.invalidateSize(),150);}
  function findFeature(name){if(!featureCollection)return null;return (featureCollection.features||[]).find(f=>{const p=f.properties||{};return (p.name||p.Name||p.nombre||p.NOMBRE)===name})||null}
  function focusBarrio(name){document.getElementById('concejalMapSelectedName').textContent=name||'Selecciona un barrio';if(!name){if(miniLayer)miniLayer.eachLayer(l=>l.setStyle({color:'#36dce9',weight:1,fillOpacity:.08}));return}initMiniMap();populateNames();let mainLayer=poligonosPorNombre&&poligonosPorNombre[name];if(mainLayer&&map){try{map.fitBounds(mainLayer.getBounds(),{padding:[50,50],maxZoom:16});}catch(e){}}
    if(miniMap&&miniLayer){let matched=null;miniLayer.eachLayer(l=>{const p=l.feature&&l.feature.properties||{};const n=p.name||p.Name||p.nombre||p.NOMBRE;const yes=n===name;l.setStyle({color:yes?'#ffffff':'#36dce9',weight:yes?4:1,fillColor:yes?'#24cde2':'#36dce9',fillOpacity:yes?.48:.035});if(yes)matched=l;});if(matched){selectedFeatureLayer=matched;try{miniMap.fitBounds(matched.getBounds(),{padding:[20,20],maxZoom:16});}catch(e){}}}
  }
  function showNotice(msg,type='success'){notice.textContent=msg;notice.classList.remove('hidden');notice.style.borderColor=type==='error'?'#fb7185':'#2dd4bf';}
  function resetForm(){editingId=null;form.reset();dateInput.value=new Date().toISOString().slice(0,10);document.getElementById('concejalFormTitle').textContent='Registrar actividad';document.getElementById('saveConcejalActivityBtn').textContent='Guardar actividad';document.getElementById('cancelEditConcejalBtn').classList.add('hidden');notice.classList.add('hidden');focusBarrio('')}
  function openModule(){document.getElementById('activitiesPlaceholder').classList.add('hidden');workspace.classList.remove('hidden');document.getElementById('landing-hero-overlay').style.display='none';document.getElementById('landingHeaderControls').style.display='none';document.getElementById('concejalStorageNotice').textContent='Los registros se guardan en este navegador. La base centralizada requiere integrar el servidor y sus permisos.';populateNames();initMiniMap();setTimeout(()=>miniMap&&miniMap.invalidateSize(),180);renderHistory()}
  function closeModule(){workspace.classList.add('hidden');if(miniMap){miniMap.remove();miniMap=null;miniLayer=null;miniTileLayer=null;selectedFeatureLayer=null;}document.getElementById('landing-hero-overlay').style.display='none';document.getElementById('landingHeaderControls').style.display='none';}
  function renderHistory(){const q=norm(document.getElementById('concejalHistorySearch').value);const from=document.getElementById('concejalFilterDateFrom').value;const to=document.getElementById('concejalFilterDateTo').value;const barrio=norm(document.getElementById('concejalFilterBarrio').value);const filtered=records.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||'')).filter(r=>(!q||norm(r.description+' '+r.barrio).includes(q))&&(!from||r.date>=from)&&(!to||r.date<=to)&&(!barrio||norm(r.barrio).includes(barrio)));document.getElementById('concejalHistoryCount').textContent=filtered.length+' de '+records.length+' registros';list.innerHTML=filtered.length?filtered.map(r=>'<article class="concejal-history-item"><h3>'+esc(r.barrio)+'</h3><div class="concejal-history-meta"><span>📅 '+esc(r.date)+'</span><span>Registro: '+esc((r.createdAt||'').slice(0,10))+'</span></div><p class="concejal-history-description">'+esc(r.description)+'</p><div class="concejal-history-actions"><button type="button" data-concejal-edit="'+esc(r.id)+'">Editar</button><button type="button" data-concejal-map="'+esc(r.barrio)+'">Ver barrio en mapa</button></div></article>').join(''):'<div class="activity-empty-drive"><h3>No hay coincidencias</h3><p>Ajusta la búsqueda o los filtros para consultar el historial.</p></div>';list.querySelectorAll('[data-concejal-edit]').forEach(b=>b.addEventListener('click',()=>editRecord(b.dataset.concejalEdit)));list.querySelectorAll('[data-concejal-map]').forEach(b=>b.addEventListener('click',()=>{barrioInput.value=b.dataset.concejalMap;focusBarrio(b.dataset.concejalMap);document.getElementById('concejalBarrioInput').scrollIntoView({behavior:'smooth',block:'center'});}));document.getElementById('concejalSidebarCount').textContent=records.length+' actividades registradas';renderHistoryCommitments(q,from,to,barrio); }
  function editRecord(id){const r=records.find(x=>x.id===id);if(!r)return;editingId=id;barrioInput.value=r.barrio;descriptionInput.value=r.description;dateInput.value=r.date;focusBarrio(r.barrio);document.getElementById('concejalFormTitle').textContent='Editar actividad';document.getElementById('saveConcejalActivityBtn').textContent='Guardar cambios';document.getElementById('cancelEditConcejalBtn').classList.remove('hidden');document.getElementById('concejalTitle').scrollIntoView({behavior:'smooth',block:'start'});}
  form.addEventListener('submit',e=>{e.preventDefault();const barrio=barrioInput.value.trim();const description=descriptionInput.value.trim();const date=dateInput.value;if(!barrio||!description||!date){showNotice('Completa el barrio, la actividad y la fecha.','error');return;}const names=getNames();if(names.length&&!names.some(n=>norm(n)===norm(barrio))){showNotice('Selecciona un barrio que exista en el listado territorial.','error');return;}const now=new Date().toISOString();if(editingId){const r=records.find(x=>x.id===editingId);if(r){r.barrio=barrio;r.description=description;r.date=date;r.updatedAt=now;}}else records.push({id:'conc_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),barrio,description,date,createdAt:now,updatedAt:now});persist();resetForm();showNotice('Actividad guardada en el historial local de pruebas.','success');});
  barrioInput.addEventListener('input',()=>{const v=barrioInput.value.trim();const exact=getNames().find(n=>norm(n)===norm(v));if(exact)focusBarrio(exact);else document.getElementById('concejalMapSelectedName').textContent=v?'Selecciona un barrio válido':'Selecciona un barrio';});
  // Presentación personalizada de sugerencias de barrio, con el mismo estilo del selector de puestos.
  // No modifica la lógica de guardado ni los filtros; solo reemplaza el desplegable nativo no estilizable.
  const barrioDropdown=document.getElementById('concejalBarrioDropdown');
  const filterBarrioInput=document.getElementById('concejalFilterBarrio');
  const filterBarrioDropdown=document.getElementById('concejalFilterBarrioDropdown');
  function renderBarrioSuggestions(input,menu,mode){
    if(!input||!menu)return;
    const query=norm(input.value.trim());
    const names=getNames().filter(n=>!query||norm(n).includes(query)).slice(0,80);
    menu.innerHTML=names.length?names.map(n=>'<button type="button" class="mira-combobox-option" role="option" data-barrio-option="'+esc(n)+'">'+esc(n)+'</button>').join(''):'<div class="mira-combobox-empty">No hay barrios coincidentes</div>';
    menu.classList.remove('hidden');input.setAttribute('aria-expanded','true');
    menu.querySelectorAll('[data-barrio-option]').forEach(option=>{
      option.addEventListener('mousedown',event=>event.preventDefault());
      option.addEventListener('click',()=>{
        const selected=option.getAttribute('data-barrio-option')||'';
        input.value=selected;menu.classList.add('hidden');input.setAttribute('aria-expanded','false');
        if(mode==='register'){focusBarrio(selected);}
        else {renderHistory();}
      });
    });
  }
  function closeBarrioSuggestions(input,menu){if(menu){menu.classList.add('hidden');}if(input)input.setAttribute('aria-expanded','false');}
  if(barrioDropdown){
    barrioInput.removeAttribute('list');
    barrioInput.addEventListener('focus',()=>renderBarrioSuggestions(barrioInput,barrioDropdown,'register'));
    barrioInput.addEventListener('input',()=>renderBarrioSuggestions(barrioInput,barrioDropdown,'register'));
    barrioInput.addEventListener('keydown',event=>{if(event.key==='Escape')closeBarrioSuggestions(barrioInput,barrioDropdown);if(event.key==='ArrowDown'){event.preventDefault();barrioDropdown.querySelector('.mira-combobox-option')?.focus();}});
    barrioInput.addEventListener('blur',()=>setTimeout(()=>closeBarrioSuggestions(barrioInput,barrioDropdown),140));
  }
  if(filterBarrioInput&&filterBarrioDropdown){
    filterBarrioInput.removeAttribute('list');
    filterBarrioInput.addEventListener('focus',()=>renderBarrioSuggestions(filterBarrioInput,filterBarrioDropdown,'filter'));
    filterBarrioInput.addEventListener('input',()=>{renderBarrioSuggestions(filterBarrioInput,filterBarrioDropdown,'filter');renderHistory();});
    filterBarrioInput.addEventListener('keydown',event=>{if(event.key==='Escape')closeBarrioSuggestions(filterBarrioInput,filterBarrioDropdown);if(event.key==='ArrowDown'){event.preventDefault();filterBarrioDropdown.querySelector('.mira-combobox-option')?.focus();}});
    filterBarrioInput.addEventListener('blur',()=>setTimeout(()=>closeBarrioSuggestions(filterBarrioInput,filterBarrioDropdown),140));
  }

  // Extensión V26: compromisos, indicadores y exportación mensual compatible con Word.
  const COMMITMENT_KEY='mira_concejal_commitments_v1';
  const commitmentForm=document.getElementById('concejalCommitmentForm');
  const commitmentList=document.getElementById('concejalCommitmentList');
  const commitmentNotice=document.getElementById('concejalCommitmentNotice');
  const commitmentBarrio=document.getElementById('concejalCommitmentBarrio');
  const commitmentDropdown=document.getElementById('concejalCommitmentBarrioDropdown');
  let commitments=readCommitments();
  function readCommitments(){try{const value=JSON.parse(localStorage.getItem(COMMITMENT_KEY)||'[]');return Array.isArray(value)?value:[]}catch(e){console.warn('No se pudieron leer los compromisos locales.',e);return[]}}
  function persistCommitments(){localStorage.setItem(COMMITMENT_KEY,JSON.stringify(commitments));renderCommitments();renderDashboard();renderHistoryCommitments()}
  function commitmentNoticeText(message,error=false){commitmentNotice.textContent=message;commitmentNotice.classList.remove('hidden');commitmentNotice.style.borderColor=error?'#fb7185':'#2dd4bf'}
  function renderDashboard(){const completed=commitments.filter(c=>c.status==='Cumplido').length;const achieved=commitments.filter(c=>c.achieved&&String(c.result||'').trim()).length;const total=commitments.length;const percent=total?Math.round(completed/total*100):0;document.getElementById('concejalKpiActivities').textContent=records.length;document.getElementById('concejalKpiCommitments').textContent=total;document.getElementById('concejalKpiCompleted').textContent=completed;document.getElementById('concejalKpiAchievements').textContent=achieved;document.getElementById('concejalProgressText').textContent=percent+'%';document.getElementById('concejalProgressBar').style.width=percent+'%';document.getElementById('concejalCommitmentCount').textContent=total+' compromiso'+(total===1?'':'s');}
  function renderCommitments(){if(!commitmentList)return;const q=norm(document.getElementById('concejalCommitmentSearch').value);const filtered=commitments.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).filter(c=>!q||norm([c.barrio,c.text,c.with,c.status,c.result].join(' ')).includes(q));commitmentList.innerHTML=filtered.length?filtered.map(c=>'<article class="concejal-history-item"><div class="concejal-commitment-card-head"><h3>'+esc(c.text)+'</h3><span class="concejal-status-pill" data-status="'+esc(c.status)+'">'+esc(c.status)+'</span></div><div class="concejal-history-meta"><span>🏘️ '+esc(c.barrio)+'</span><span>📅 '+esc(c.date)+'</span>'+(c.deadline?'<span>Vence: '+esc(c.deadline)+'</span>':'')+'</div><p class="concejal-history-description"><strong>Compromiso con:</strong> '+esc(c.with)+'</p><p class="concejal-history-description"><strong>Resultado obtenido:</strong> '+esc(c.result||'Sin resultado registrado')+'</p><p class="concejal-history-description"><strong>Se logró:</strong> '+(c.achieved?'Sí':'No marcado')+'</p><div class="concejal-history-actions"><button type="button" data-commitment-edit="'+esc(c.id)+'">Editar</button><button type="button" data-commitment-delete="'+esc(c.id)+'">Eliminar</button></div></article>').join(''):'<div class="activity-empty-drive"><h3>No hay compromisos coincidentes</h3><p>Registra un compromiso o ajusta la búsqueda.</p></div>';commitmentList.querySelectorAll('[data-commitment-edit]').forEach(b=>b.addEventListener('click',()=>editCommitment(b.dataset.commitmentEdit)));commitmentList.querySelectorAll('[data-commitment-delete]').forEach(b=>b.addEventListener('click',()=>{const item=commitments.find(c=>c.id===b.dataset.commitmentDelete);if(item&&confirm('¿Eliminar este compromiso del almacenamiento local de pruebas?')){commitments=commitments.filter(c=>c.id!==item.id);persistCommitments()}}));}
  function renderHistoryCommitments(qOverride,fromOverride,toOverride,barrioOverride){
    const target=document.getElementById('concejalHistoryCommitmentList');if(!target)return;
    const q=typeof qOverride==='string'?qOverride:norm(document.getElementById('concejalHistorySearch').value);
    const from=typeof fromOverride==='string'?fromOverride:document.getElementById('concejalFilterDateFrom').value;
    const to=typeof toOverride==='string'?toOverride:document.getElementById('concejalFilterDateTo').value;
    const barrio=typeof barrioOverride==='string'?barrioOverride:norm(document.getElementById('concejalFilterBarrio').value);
    const filtered=commitments.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||'')).filter(c=>(!q||norm([c.text,c.barrio,c.with,c.status,c.result].join(' ')).includes(q))&&(!from||((c.date||'')>=from))&&(!to||((c.date||'')<=to))&&(!barrio||norm(c.barrio).includes(barrio)));
    const count=document.getElementById('concejalHistoryCommitmentCount');if(count)count.textContent=filtered.length+' de '+commitments.length+' compromisos';
    target.innerHTML=filtered.length?filtered.map(c=>'<article class="concejal-history-item"><div class="concejal-commitment-card-head"><h3>'+esc(c.text)+'</h3><span class="concejal-status-pill" data-status="'+esc(c.status)+'">'+esc(c.status)+'</span></div><div class="concejal-history-meta"><span>🏘️ '+esc(c.barrio)+'</span><span>📅 '+esc(c.date)+'</span>'+(c.deadline?'<span>Vence: '+esc(c.deadline)+'</span>':'')+'</div><p class="concejal-history-description"><strong>Compromiso con:</strong> '+esc(c.with)+'</p><p class="concejal-history-description"><strong>Resultado obtenido:</strong> '+esc(c.result||'Sin resultado registrado')+'</p><p class="concejal-history-description"><strong>Se logró:</strong> '+(c.achieved?'Sí':'No marcado')+'</p><div class="concejal-history-actions"><button type="button" data-history-commitment-edit="'+esc(c.id)+'">Editar</button></div></article>').join(''):'<div class="activity-empty-drive"><h3>No hay compromisos coincidentes</h3><p>Ajusta la búsqueda o registra un compromiso nuevo.</p></div>';
    target.querySelectorAll('[data-history-commitment-edit]').forEach(b=>b.addEventListener('click',()=>{setConcejalView('register');setRegisterKind('commitment');editCommitment(b.dataset.historyCommitmentEdit)}));
  }
  function resetCommitmentForm(){commitmentForm.reset();document.getElementById('concejalCommitmentId').value='';document.getElementById('concejalCommitmentDate').value=new Date().toISOString().slice(0,10);document.getElementById('saveConcejalCommitmentBtn').textContent='Guardar compromiso';document.getElementById('cancelConcejalCommitmentEditBtn').classList.add('hidden');commitmentNotice.classList.add('hidden')}
  function editCommitment(id){const c=commitments.find(x=>x.id===id);if(!c)return;document.getElementById('concejalCommitmentId').value=c.id;commitmentBarrio.value=c.barrio;document.getElementById('concejalCommitmentText').value=c.text;document.getElementById('concejalCommitmentWith').value=c.with;document.getElementById('concejalCommitmentDate').value=c.date;document.getElementById('concejalCommitmentDeadline').value=c.deadline||'';document.getElementById('concejalCommitmentStatus').value=c.status;document.getElementById('concejalCommitmentResult').value=c.result||'';document.getElementById('concejalCommitmentAchieved').checked=!!c.achieved;document.getElementById('saveConcejalCommitmentBtn').textContent='Guardar cambios';document.getElementById('cancelConcejalCommitmentEditBtn').classList.remove('hidden');commitmentForm.scrollIntoView({behavior:'smooth',block:'center'})}
  commitmentForm.addEventListener('submit',e=>{e.preventDefault();const barrio=commitmentBarrio.value.trim();const validNames=getNames();if(validNames.length&&!validNames.some(n=>norm(n)===norm(barrio))){commitmentNoticeText('Selecciona un barrio válido de la lista territorial.',true);return}const achieved=document.getElementById('concejalCommitmentAchieved').checked;const result=document.getElementById('concejalCommitmentResult').value.trim();if(achieved&&!result){commitmentNoticeText('Describe el resultado obtenido antes de marcar “Se logró”.',true);return}const id=document.getElementById('concejalCommitmentId').value;const now=new Date().toISOString();const item={id:id||'com_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),barrio,text:document.getElementById('concejalCommitmentText').value.trim(),with:document.getElementById('concejalCommitmentWith').value.trim(),date:document.getElementById('concejalCommitmentDate').value,deadline:document.getElementById('concejalCommitmentDeadline').value,status:document.getElementById('concejalCommitmentStatus').value,result,achieved,createdAt:(commitments.find(c=>c.id===id)||{}).createdAt||now,updatedAt:now};if(id){commitments=commitments.map(c=>c.id===id?item:c)}else commitments.push(item);persistCommitments();resetCommitmentForm();commitmentNoticeText('Compromiso guardado en el almacenamiento local de pruebas.');});
  document.getElementById('cancelConcejalCommitmentEditBtn').addEventListener('click',resetCommitmentForm);
  document.getElementById('concejalCommitmentSearch').addEventListener('input',renderCommitments);
  function renderCommitmentSuggestions(){const query=norm(commitmentBarrio.value);const names=getNames().filter(n=>!query||norm(n).includes(query)).slice(0,80);commitmentDropdown.innerHTML=names.length?names.map(n=>'<button type="button" class="mira-combobox-option" role="option" data-commitment-barrio="'+esc(n)+'">'+esc(n)+'</button>').join(''):'<div class="mira-combobox-empty">No hay barrios coincidentes</div>';commitmentDropdown.classList.remove('hidden');commitmentBarrio.setAttribute('aria-expanded','true');commitmentDropdown.querySelectorAll('[data-commitment-barrio]').forEach(b=>b.addEventListener('mousedown',e=>e.preventDefault()));commitmentDropdown.querySelectorAll('[data-commitment-barrio]').forEach(b=>b.addEventListener('click',()=>{commitmentBarrio.value=b.dataset.commitmentBarrio;commitmentDropdown.classList.add('hidden');commitmentBarrio.setAttribute('aria-expanded','false')}))}
  commitmentBarrio.addEventListener('focus',renderCommitmentSuggestions);commitmentBarrio.addEventListener('input',renderCommitmentSuggestions);commitmentBarrio.addEventListener('blur',()=>setTimeout(()=>{commitmentDropdown.classList.add('hidden');commitmentBarrio.setAttribute('aria-expanded','false')},140));
  function downloadMonthlyReport(){
    const month=document.getElementById('concejalReportMonth').value;
    const includeActivities=document.getElementById('concejalReportIncludeActivities').checked;
    const includeCommitments=document.getElementById('concejalReportIncludeCommitments').checked;
    if(!month){alert('Selecciona el mes del informe.');return}
    if(!includeActivities&&!includeCommitments){alert('Selecciona Actividades, Compromisos y logros, o ambas opciones.');return}
    const monthActivities=includeActivities?records.filter(r=>(r.date||'').slice(0,7)===month).sort((a,b)=>(a.date||'').localeCompare(b.date||'')):[];
    const monthCommitments=includeCommitments?commitments.filter(c=>(c.date||'').slice(0,7)===month||(c.updatedAt||'').slice(0,7)===month).sort((a,b)=>(a.date||'').localeCompare(b.date||'')):[];
    const achievements=monthCommitments.filter(c=>c.achieved&&String(c.result||'').trim());
    const monthLabel=new Date(month+'-15T12:00:00').toLocaleDateString('es-CO',{month:'long',year:'numeric'});
    const rowsActivities=monthActivities.length?monthActivities.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.barrio)+'</td><td>'+esc(r.description)+'</td></tr>').join(''):'<tr><td colspan="4">Sin actividades registradas en este mes.</td></tr>';
    const rowsCommitments=monthCommitments.length?monthCommitments.map((c,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(c.barrio)+'</td><td>'+esc(c.text)+'</td><td>'+esc(c.with)+'</td><td>'+esc(c.status)+'</td><td>'+(c.achieved?'Sí':'No')+'</td><td>'+esc(c.result||'Sin resultado registrado')+'</td></tr>').join(''):'<tr><td colspan="7">Sin compromisos registrados o actualizados en este mes.</td></tr>';
    const summary='<div class="summary">'+(includeActivities?'<div><strong>Actividades</strong><br>'+monthActivities.length+'</div>':'')+(includeCommitments?'<div><strong>Compromisos</strong><br>'+monthCommitments.length+'</div><div><strong>Cumplidos</strong><br>'+monthCommitments.filter(c=>c.status==='Cumplido').length+'</div><div><strong>Logros registrados</strong><br>'+achievements.length+'</div>':'')+'</div>';
    const activitiesSection=includeActivities?'<h2>Actividades realizadas</h2><table><thead><tr><th>#</th><th>Fecha</th><th>Barrio/sector</th><th>Actividad</th></tr></thead><tbody>'+rowsActivities+'</tbody></table>':'';
    const commitmentsSection=includeCommitments?'<h2>Compromisos y seguimiento</h2><table><thead><tr><th>#</th><th>Barrio/sector</th><th>Compromiso</th><th>Adquirido con</th><th>Estado</th><th>¿Se logró?</th><th>Resultado obtenido</th></tr></thead><tbody>'+rowsCommitments+'</tbody></table><h2>Logros del periodo</h2>'+(achievements.length?'<ul>'+achievements.map(c=>'<li><strong>'+esc(c.barrio)+' — '+esc(c.text)+':</strong> '+esc(c.result)+'</li>').join('')+'</ul>':'<p>No hay logros marcados y descritos para este periodo.</p>'):'';
    const scopeLabel=includeActivities&&includeCommitments?'Actividades y compromisos':includeActivities?'Solo actividades':'Solo compromisos y logros';
    const html='<!doctype html><html><head><meta charset="utf-8"><title>Informe mensual de gestión - '+esc(monthLabel)+'</title><style>body{font-family:Arial,sans-serif;color:#1f2937;line-height:1.45}h1,h2{color:#123b5b}table{width:100%;border-collapse:collapse;margin:12px 0 24px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left;vertical-align:top;font-size:10pt}th{background:#eaf3f8}.summary{display:flex;gap:18px;flex-wrap:wrap}.summary div{border:1px solid #cbd5e1;padding:10px;min-width:130px}</style></head><body><h1>Informe mensual de gestión territorial</h1><p><strong>Periodo:</strong> '+esc(monthLabel)+'</p><p><strong>Contenido:</strong> '+scopeLabel+'</p><p>Informe generado a partir de los registros disponibles en Territorio Faca.</p>'+summary+activitiesSection+commitmentsSection+'<h2>Observaciones para revisión</h2><p>Completar aquí las conclusiones cualitativas, dificultades, articulaciones institucionales y acciones previstas para el siguiente mes.</p><p><em>Nota: este archivo se genera localmente a partir de los registros guardados en este navegador. No equivale a una base centralizada.</em></p></body></html>';
    const blob=new Blob(['\ufeff',html],{type:'application/msword'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Informe_Gestion_Concejal_'+month+'_'+(includeActivities&&includeCommitments?'completo':includeActivities?'actividades':'compromisos')+'.doc';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)
  }
  document.getElementById('downloadConcejalReportBtn').addEventListener('click',downloadMonthlyReport);
  const monthField=document.getElementById('concejalReportMonth');monthField.value=new Date().toISOString().slice(0,7);
  // Extend persistence/render callbacks without changing the existing activity model.
  const originalPersist=persist; persist=function(){originalPersist();renderDashboard()};
  renderCommitments();renderDashboard();

  function setConcejalView(view){
    const views={register:document.getElementById('concejalRegisterView'),history:document.getElementById('concejalHistoryView'),management:document.getElementById('concejalManagementView')};
    Object.entries(views).forEach(([key,node])=>{if(node)node.classList.toggle('hidden',key!==view)});
    document.querySelectorAll('#concejalWorkspace [data-concejal-view]').forEach(btn=>{const active=btn.dataset.concejalView===view;btn.classList.toggle('is-active',active);btn.setAttribute('aria-current',active?'page':'false')});
    if(view==='history'){renderHistory();const f=document.getElementById('concejalHistorySearch');if(f)setTimeout(()=>f.focus({preventScroll:true}),80)}
    if(view==='management'){renderDashboard();renderCommitments()}
    if(view==='register'){const kind=document.querySelector('#concejalWorkspace [data-register-kind].is-active')?.dataset.registerKind||'activity';setRegisterKind(kind);}
    if(miniMap)setTimeout(()=>miniMap.invalidateSize(),120);
  }
  function setRegisterKind(kind){
    const activity=kind==='activity';
    document.getElementById('concejalActivityRegisterPane').classList.toggle('hidden',!activity);
    document.getElementById('concejalCommitmentRegisterPane').classList.toggle('hidden',activity);
    document.querySelectorAll('#concejalWorkspace [data-register-kind]').forEach(btn=>{const active=btn.dataset.registerKind===kind;btn.classList.toggle('is-active',active);btn.setAttribute('aria-selected',active?'true':'false')});
    if(!activity){renderCommitmentSuggestions();setTimeout(()=>commitmentBarrio.focus({preventScroll:true}),50)}
    else if(miniMap)setTimeout(()=>miniMap.invalidateSize(),120);
  }
  function openConcejalView(view){openModule();setConcejalView(view);setTimeout(()=>{if(view==='register'&&document.querySelector('#concejalWorkspace [data-register-kind].is-active')?.dataset.registerKind==='activity'){const field=document.getElementById('concejalBarrioInput');if(field)field.focus({preventScroll:true});}if(miniMap)miniMap.invalidateSize();},180)}
  document.getElementById('openConcejalRegisterBtn').addEventListener('click',()=>openConcejalView('register'));
  document.getElementById('openConcejalHistoryBtn').addEventListener('click',()=>openConcejalView('history'));
  document.getElementById('openConcejalManagementBtn').addEventListener('click',()=>openConcejalView('management'));
  document.querySelectorAll('#concejalWorkspace [data-concejal-view]').forEach(btn=>btn.addEventListener('click',()=>setConcejalView(btn.dataset.concejalView)));
  document.querySelectorAll('#concejalWorkspace [data-register-kind]').forEach(btn=>btn.addEventListener('click',()=>setRegisterKind(btn.dataset.registerKind)));
  setConcejalView('register'); setRegisterKind('activity');
  document.getElementById('closeConcejalModuleBtn').addEventListener('click',closeModule);document.getElementById('cancelEditConcejalBtn').addEventListener('click',resetForm);
  window.addEventListener('mira:open-concejal-history',()=>{populateNames();initMiniMap();renderHistory();setTimeout(()=>miniMap&&miniMap.invalidateSize(),120)});
  ['concejalHistorySearch','concejalFilterDateFrom','concejalFilterDateTo','concejalFilterBarrio'].forEach(id=>document.getElementById(id).addEventListener('input',renderHistory));document.getElementById('resetConcejalFiltersBtn').addEventListener('click',()=>{['concejalHistorySearch','concejalFilterDateFrom','concejalFilterDateTo','concejalFilterBarrio'].forEach(id=>document.getElementById(id).value='');renderHistory()});
  // Expose a read-only accessor for the territorial popup to read the latest activity.
  window.MiraConcejalActivities={getLatestForBarrio:function(name){return records.filter(r=>norm(r.barrio)===norm(name)).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]||null;},getAll:function(){return records.slice()}};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&& !workspace.classList.contains('hidden'))miniMap&&miniMap.invalidateSize()});
  document.getElementById('concejalActivityDate').value=new Date().toISOString().slice(0,10);populateNames();persist();
})();


// V25: la casita es el único control para volver a la interfaz inicial.

