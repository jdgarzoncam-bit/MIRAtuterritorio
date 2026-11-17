// MIRA TU TERRITORIO — autenticación Neon Auth (Better Auth administrado)
import { createInternalNeonAuth } from "https://esm.sh/@neondatabase/auth@0.7.0-beta";

const AUTH_URL = "https://ep-mute-grass-b7qan4n6.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth";
const DATA_API_URL = "https://ep-mute-grass-b7qan4n6.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1";
const PRIMARY_ADMIN_AUTH_ID = "beef5bf3-82a8-4c35-a12c-17771be59da1";
const neonAuth = createInternalNeonAuth(AUTH_URL,{allowAnonymous:true});
const auth = neonAuth.adapter;
// Exponer al cliente de datos las dos operaciones de token del wrapper oficial,
// sin perder los métodos Better Auth usados por el flujo de inicio/cierre de sesión.
window.MIRA_AUTH = {
  getJWTToken: () => neonAuth.getJWTToken(),
  getAnonymousToken: (...args) => auth.getAnonymousToken(...args)
};

async function bearerToken() {
  // getJWTToken() devuelve el JWT de la sesión (o anónimo si está permitido).
  if(typeof neonAuth.getJWTToken!=="function"){
    throw new Error("La versión cargada de Neon Auth no expone getJWTToken(). Actualiza el cliente de autenticación.");
  }
  const token=await neonAuth.getJWTToken();
  if(typeof token!=="string"||!token.trim()){
    const error=new Error("Neon Auth no entregó un JWT válido para consultar el perfil.");
    error.code="NEON_AUTH_JWT_MISSING";
    throw error;
  }
  return token;
}
async function getOwnProfile(token,authUserId) {
  if(!authUserId) throw new Error("No fue posible identificar la cuenta autenticada.");
  const response=await fetch(`${DATA_API_URL}/user_profiles?select=auth_user_id,role,active,email_verified,email,display_name&auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`,{
    headers:{Authorization:`Bearer ${token}`,"Accept-Profile":"mira"}
  });
  if(!response.ok) {
    const error=new Error("No fue posible validar los permisos de esta cuenta.");
    error.status=response.status;
    throw error;
  }
  const rows=await response.json();
  return rows?.[0] || null;
}
function finishAuthBootstrap() {
  document.documentElement.classList.remove("mira-auth-restoring");
}
function clearAuthenticatedState() {
  window.MIRA_CURRENT_USER=null;
  window.dispatchEvent(new Event("mira:signed-out"));
}
function isDefinitiveAuthorizationFailure(error) {
  if(error?.definitive===true)return true;
  const status=Number(error?.status||error?.statusCode||0);
  // Un 404 puede indicar una ruta, vista o recurso mal configurado; no demuestra
  // que la sesión sea inválida. La ausencia del perfil se marca explícitamente.
  return status===401||status===403;
}
function markDefinitive(error) {
  error.definitive=true;
  return error;
}
async function establishAuthenticatedUser(authUser,expectedRevision=null) {
  if(expectedRevision!==null && authFlowIsStale(expectedRevision)) return false;
  if(!authUser?.id) throw markDefinitive(new Error("No fue posible identificar la cuenta autenticada."));
  if(authUser.emailVerified!==true) throw markDefinitive(new Error("Primero confirma tu correo electrónico. Revisa tu bandeja de entrada y Spam."));
  const token=await bearerToken();
  if(expectedRevision!==null && authFlowIsStale(expectedRevision)) return false;
  const profile=await getOwnProfile(token,authUser.id);
  if(expectedRevision!==null && authFlowIsStale(expectedRevision)) return false;
  if(!profile || profile.auth_user_id!==authUser.id) throw markDefinitive(new Error("La identidad de la cuenta no coincide con su perfil. El acceso fue bloqueado."));
  if(profile.role==="admin" && profile.auth_user_id!==PRIMARY_ADMIN_AUTH_ID) throw markDefinitive(new Error("La cuenta administradora no corresponde al administrador principal autorizado."));
  if(profile.active!==true || profile.email_verified!==true || !["admin","operator","viewer"].includes(profile.role)) {
    throw markDefinitive(new Error("Tu cuenta todavía no está aprobada. Solicita al administrador que habilite tu perfil."));
  }
  // Una cuenta activa, verificada y aprobada puede entrar al Centro de Operaciones
  // y utilizar el mapa territorial común. Los permisos de cada módulo se aplican
  // después, en la interfaz y en PostgreSQL/RLS; no se exige un permiso de módulo
  // para autenticar ni para consultar la cartografía base.
  window.MIRA_CURRENT_USER={role:profile.role,authUserId:profile.auth_user_id,displayName:profile.display_name||authUser.name||profile.email,email:profile.email||authUser.email};
  window.dispatchEvent(new Event("mira:authenticated"));
  if(typeof window.activarPMUAutenticado!=="function") throw new Error("No se pudo iniciar la interfaz principal.");
  window.activarPMUAutenticado();
  return true;
}
async function restoreExistingSession() {
  if(restoreRunning || loginInProgress || authSignOutInProgress)return;
  const revision=authFlowRevision;
  restoreRunning=true;
  try {
    if(restoreRetryTimer){window.clearTimeout(restoreRetryTimer);restoreRetryTimer=null;}
    const result=await auth.getSession();
    if(authFlowIsStale(revision)) return;
    if(result?.error) throw result.error;
    const sessionData=result?.data;
    const authUser=sessionData?.user||sessionData?.session?.user||null;
    if(!authUser) { restoreRetryCount=0; clearAuthenticatedState(); finishAuthBootstrap(); return; }
    const established=await establishAuthenticatedUser(authUser,revision);
    if(!established || authFlowIsStale(revision)) return;
    restoreRetryCount=0;
    finishAuthBootstrap();
  } catch(error) {
    if(authFlowIsStale(revision)) return;
    if(isDefinitiveAuthorizationFailure(error)){
      clearAuthenticatedState();
      authFlowRevision++;
      authSignOutInProgress=true;
      try { await auth.signOut(); } catch(signOutError) { console.warn("[MIRA Auth] No se pudo limpiar una sesión inválida.",signOutError); }
      finally { authSignOutInProgress=false; }
      console.warn("[MIRA Auth] La sesión guardada no superó la validación; se requiere iniciar sesión.",error);
      finishAuthBootstrap();
    } else {
      console.warn("[MIRA Auth] No fue posible validar la sesión por un problema temporal. Se conserva la sesión y se mantienen bloqueadas las acciones que no puedan verificarse.",error);
      showLoginError("No fue posible comprobar la conexión con el servicio de autenticación. Verifica tu conexión; conservamos la sesión y volveremos a intentarlo.");
      scheduleSessionRestore();
      if(restoreRetryCount>=5) finishAuthBootstrap();
    }
  } finally {
    restoreRunning=false;
  }
}
let revalidationRunning=false,lastRevalidationAt=0;
let restoreRunning=false,restoreRetryTimer=null,restoreRetryCount=0;
let authFlowRevision=0,loginInProgress=false,authSignOutInProgress=false;
function authFlowIsStale(revision) {
  return revision !== authFlowRevision || loginInProgress || authSignOutInProgress;
}
function scheduleSessionRestore(){
  if(restoreRetryTimer||restoreRetryCount>=5||!navigator.onLine)return;
  const delay=Math.min(1000*(2**restoreRetryCount),15000);
  restoreRetryCount++;
  restoreRetryTimer=window.setTimeout(()=>{
    restoreRetryTimer=null;
    restoreExistingSession();
  },delay);
}
async function revalidateCurrentAuthorization(force=false) {
  if(revalidationRunning||loginInProgress||!window.MIRA_CURRENT_USER)return;
  if(!force&&Date.now()-lastRevalidationAt<15000)return;
  const revision=authFlowRevision;
  revalidationRunning=true;lastRevalidationAt=Date.now();
  try {
    const result=await auth.getSession();
    if(authFlowIsStale(revision))return;
    if(result?.error)throw result.error;
    const sessionData=result?.data;
    const authUser=sessionData?.user||sessionData?.session?.user||null;
    if(!authUser?.id){clearAuthenticatedState();return;}
    if(authUser.emailVerified!==true)throw markDefinitive(new Error("La verificación de correo ya no está vigente."));
    const token=await bearerToken();
    if(authFlowIsStale(revision))return;
    const profile=await getOwnProfile(token,authUser.id);
    if(authFlowIsStale(revision))return;
    if(!profile||profile.auth_user_id!==authUser.id||profile.active!==true||profile.email_verified!==true||
       !["admin","operator","viewer"].includes(profile.role)||
       (profile.role==="admin"&&profile.auth_user_id!==PRIMARY_ADMIN_AUTH_ID)){
      // La cuenta existe pero su perfil ya no autoriza el acceso: no es un fallo de red.
      throw markDefinitive(new Error("La cuenta fue desactivada o sus condiciones de acceso cambiaron."));
    }
    // La revalidación de identidad no depende de la matriz de módulos:
    // una revocación de un módulo no debe cerrar el Centro de Operaciones ni
    // retirar el mapa común. applyModuleAccess vuelve a consultar permisos y
    // bloquea únicamente los módulos específicos que correspondan.
    const previous=window.MIRA_CURRENT_USER;
    window.MIRA_CURRENT_USER={role:profile.role,authUserId:profile.auth_user_id,displayName:profile.display_name||authUser.name||profile.email,email:profile.email||authUser.email};
    // La interfaz vuelve a consultar sus permisos en cada revalidación.
    window.dispatchEvent(new Event("mira:permissions-refreshed"));
  } catch(error) {
    if(authFlowIsStale(revision))return;
    if(isDefinitiveAuthorizationFailure(error)){
      console.warn("[MIRA Auth] La revalidación detectó una sesión o autorización inválida; se cerrará el acceso.",error);
      await signOutCompletely();
    } else {
      console.warn("[MIRA Auth] Falló temporalmente la revalidación. Se conserva la sesión y se reintentará en la siguiente comprobación.",error);
      window.dispatchEvent(new CustomEvent("mira:authorization-check-failed",{detail:{message:"No fue posible verificar temporalmente la sesión. Comprueba tu conexión."}}));
    }
  } finally { revalidationRunning=false; }
}
async function signOutCompletely() {
  authFlowRevision++;
  loginInProgress=false;
  authSignOutInProgress=true;
  try { await auth.signOut(); }
  finally {
    authSignOutInProgress=false;
    clearAuthenticatedState();
  }
}
function showLoginError(message) {
  const error=document.getElementById("loginError");
  if(error){error.textContent=message;error.style.display="block";}
}
async function loginWithNeon() {
  if(loginInProgress || authSignOutInProgress){
    showLoginError("Estamos finalizando la validación de la sesión anterior. Intenta nuevamente en unos segundos.");
    return;
  }
  let signInCompleted=false;
  const email=document.getElementById("username")?.value.trim();
  const password=document.getElementById("password")?.value;
  const button=document.getElementById("loginBtn");
  if(!email || !password){showLoginError("Escribe tu correo electrónico y contraseña.");return;}
  const loginRevision=++authFlowRevision;
  loginInProgress=true;
  if(button) button.disabled=true;
  try {
    const result=await auth.signIn.email({email,password});
    if(result?.error) {
      const code=String(result.error.code||"").toUpperCase();
      const status=Number(result.error.status||result.error.statusCode||0);
      if(code.includes("EMAIL_NOT_VERIFIED")||status===403) throw new Error("Primero confirma tu correo electrónico. Revisa tu bandeja de entrada y Spam.");
      throw new Error("No fue posible iniciar sesión. Verifica tus credenciales.");
    }
    signInCompleted=true;
    await establishAuthenticatedUser(result?.data?.user);
    const error=document.getElementById("loginError");
    if(error) error.style.display="none";
    const pass=document.getElementById("password"); if(pass) pass.value="";
  } catch(error) {
    if(isDefinitiveAuthorizationFailure(error)){
      clearAuthenticatedState();
      if(signInCompleted){
        try { await auth.signOut(); } catch(signOutError) { console.warn("[MIRA Auth] No se pudo limpiar una sesión no autorizada.",signOutError); }
      }
    } else if(signInCompleted) {
      // Neon ya aceptó las credenciales: no destruir una sesión por un fallo
      // temporal al recuperar el JWT, consultar el perfil o activar la interfaz.
      showLoginError("La autenticación fue aceptada, pero no pudimos completar la validación. Conservamos la sesión e intentaremos recuperarla.");
      scheduleSessionRestore();
    } else {
      clearAuthenticatedState();
    }
    showLoginError(error?.message || "No fue posible completar el inicio de sesión.");
  } finally {
    if(loginRevision===authFlowRevision) loginInProgress=false;
    if(button) button.disabled=false;
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  const loginForm=document.getElementById("adminLoginFormInline");
  if(loginForm) loginForm.addEventListener("submit",event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    loginWithNeon();
  },true);
  const reset=document.getElementById("forgotPasswordBtn");
  if(reset) reset.addEventListener("click",async event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    const email=document.getElementById("username")?.value.trim();
    if(!email){showLoginError("Escribe primero tu correo electrónico.");return;}
    reset.disabled=true;
    try{
      const result=await auth.requestPasswordReset({
        email,
        redirectTo:new URL("reset-password.html",window.location.href).href
      });
      if(result?.error) throw new Error(result.error.message||"No fue posible solicitar el restablecimiento.");
      showLoginError("Si el correo está registrado, Neon Auth enviará un enlace para crear una contraseña nueva. Revisa también Spam.");
    }catch(error){
      showLoginError(error?.message||"No fue posible enviar el enlace de recuperación.");
    }finally{reset.disabled=false;}
  },true);
  const create=document.getElementById("createUserBtn");
  if(create) create.addEventListener("click",event=>{
    event.preventDefault();event.stopImmediatePropagation();
    window.location.href="registro-usuario.html";
  },true);
  const logout=document.getElementById("platformHomeBtn");
  if(logout) logout.addEventListener("click",event=>{
    event.preventDefault();
    signOutCompletely().catch(err=>console.warn("[MIRA Auth] Error al cerrar sesión.",err));
  },true);
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden){
      if(window.MIRA_CURRENT_USER)revalidateCurrentAuthorization(true);
      else restoreExistingSession();
    }
  });
  window.addEventListener("focus",()=>{
    if(window.MIRA_CURRENT_USER)revalidateCurrentAuthorization(true);
    else restoreExistingSession();
  });
  window.addEventListener("online",()=>{
    restoreRetryCount=0;
    if(window.MIRA_CURRENT_USER)revalidateCurrentAuthorization(true);
    else restoreExistingSession();
  });
  window.setInterval(()=>{
    if(window.MIRA_CURRENT_USER)revalidateCurrentAuthorization(true);
    else restoreExistingSession();
  },30000);
  restoreExistingSession();
});
