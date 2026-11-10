// MIRA TU TERRITORIO — autenticación Neon Auth (Better Auth administrado)
import { createAuthClient } from "https://esm.sh/@neondatabase/auth@0.7.0-beta";

const AUTH_URL = "https://ep-round-dawn-b7l3ya3h.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth";
const DATA_API_URL = "https://ep-round-dawn-b7l3ya3h.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1";
const PRIMARY_ADMIN_AUTH_ID = "beef5bf3-82a8-4c35-a12c-17771be59da1";
const auth = createAuthClient(AUTH_URL,{allowAnonymous:true});
window.MIRA_AUTH = auth;

async function bearerToken() {
  const result=await auth.token();
  if(result?.error) throw new Error(result.error.message || "No se pudo validar la sesión.");
  const token=result?.data?.token;
  if(!token) throw new Error("No se recibió el token de acceso.");
  return token;
}
async function getOwnProfile(token,authUserId) {
  if(!authUserId) throw new Error("No fue posible identificar la cuenta autenticada.");
  const response=await fetch(`${DATA_API_URL}/user_profiles?select=auth_user_id,role,active,email_verified,email,display_name&auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`,{
    headers:{Authorization:`Bearer ${token}`,"Accept-Profile":"mira"}
  });
  if(!response.ok) throw new Error("No fue posible validar los permisos de esta cuenta.");
  const rows=await response.json();
  return rows?.[0] || null;
}
async function getOwnModulePermissions(token) {
  const headers={Authorization:`Bearer ${token}`,"Accept-Profile":"mira"};
  const [permissionsResponse,catalogResponse]=await Promise.all([
    fetch(`${DATA_API_URL}/module_permissions?select=module_key,action_key,allowed&limit=500`,{headers}),
    fetch(`${DATA_API_URL}/module_catalog?select=module_key&active=eq.true`,{headers})
  ]);
  if(!permissionsResponse.ok||!catalogResponse.ok) {
    throw new Error("No fue posible comprobar los permisos o módulos activos. El acceso se mantendrá bloqueado.");
  }
  const [rows,catalog]=await Promise.all([permissionsResponse.json(),catalogResponse.json()]);
  if(!Array.isArray(rows)||!Array.isArray(catalog)) throw new Error("La respuesta de permisos y módulos no es válida. El acceso se mantendrá bloqueado.");
  const activeModules=new Set(catalog.map(item=>item.module_key));
  return rows.filter(permission=>
    activeModules.has(permission.module_key) &&
    permission.module_key!=="testigos" &&
    permission.module_key!=="control_administrativo"
  );
}
function clearAuthenticatedState() {
  window.MIRA_CURRENT_USER=null;
  window.dispatchEvent(new Event("mira:signed-out"));
}
async function establishAuthenticatedUser(authUser) {
  if(!authUser?.id) throw new Error("No fue posible identificar la cuenta autenticada.");
  if(authUser.emailVerified!==true) throw new Error("Primero confirma tu correo electrónico. Revisa tu bandeja de entrada y Spam.");
  const token=await bearerToken();
  const profile=await getOwnProfile(token,authUser.id);
  if(!profile || profile.auth_user_id!==authUser.id) throw new Error("La identidad de la cuenta no coincide con su perfil. El acceso fue bloqueado.");
  if(profile.role==="admin" && profile.auth_user_id!==PRIMARY_ADMIN_AUTH_ID) throw new Error("La cuenta administradora no corresponde al administrador principal autorizado.");
  if(profile.active!==true || profile.email_verified!==true || !["admin","operator","viewer"].includes(profile.role)) {
    throw new Error("Tu cuenta todavía no está aprobada. Solicita al administrador que habilite tu perfil.");
  }
  let permissions=[];
  if(profile.role!=="admin") {
    permissions=await getOwnModulePermissions(token);
    if(!permissions.some(permission=>permission.allowed===true && permission.action_key==="view" && permission.module_key!=="testigos" && permission.module_key!=="control_administrativo")) {
      throw new Error("Tu cuenta está aprobada, pero todavía no tiene módulos autorizados. Solicita al administrador que habilite al menos uno.");
    }
  }
  window.MIRA_CURRENT_USER={role:profile.role,authUserId:profile.auth_user_id,displayName:profile.display_name||authUser.name||profile.email,email:profile.email||authUser.email};
  window.dispatchEvent(new Event("mira:authenticated"));
  if(typeof window.activarPMUAutenticado!=="function") throw new Error("No se pudo iniciar la interfaz principal.");
  window.activarPMUAutenticado();
}
async function restoreExistingSession() {
  try {
    const result=await auth.getSession();
    if(result?.error) throw result.error;
    const sessionData=result?.data;
    const authUser=sessionData?.user||sessionData?.session?.user||null;
    if(!authUser) { clearAuthenticatedState(); return; }
    await establishAuthenticatedUser(authUser);
  } catch(error) {
    clearAuthenticatedState();
    try { await auth.signOut(); } catch(signOutError) { console.warn("[MIRA Auth] No se pudo limpiar una sesión inválida.",signOutError); }
    console.warn("[MIRA Auth] La sesión guardada no superó la validación; se requiere iniciar sesión.",error);
  }
}
async function signOutCompletely() {
  try { await auth.signOut(); }
  finally { clearAuthenticatedState(); }
}
function showLoginError(message) {
  const error=document.getElementById("loginError");
  if(error){error.textContent=message;error.style.display="block";}
}
async function loginWithNeon() {
  const email=document.getElementById("username")?.value.trim();
  const password=document.getElementById("password")?.value;
  const button=document.getElementById("loginBtn");
  if(!email || !password){showLoginError("Escribe tu correo electrónico y contraseña.");return;}
  if(button) button.disabled=true;
  try {
    const result=await auth.signIn.email({email,password});
    if(result?.error) {
      const code=String(result.error.code||"").toUpperCase();
      const status=Number(result.error.status||result.error.statusCode||0);
      if(code.includes("EMAIL_NOT_VERIFIED")||status===403) throw new Error("Primero confirma tu correo electrónico. Revisa tu bandeja de entrada y Spam.");
      throw new Error("No fue posible iniciar sesión. Verifica tus credenciales.");
    }
    await establishAuthenticatedUser(result?.data?.user);
    const error=document.getElementById("loginError");
    if(error) error.style.display="none";
    const pass=document.getElementById("password"); if(pass) pass.value="";
  } catch(error) {
    clearAuthenticatedState();
    try { await auth.signOut(); } catch(signOutError) { console.warn("[MIRA Auth] No se pudo limpiar la sesión tras un acceso rechazado.",signOutError); }
    showLoginError(error?.message || "No fue posible iniciar sesión.");
  } finally { if(button) button.disabled=false; }
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
        redirectTo:"https://jdgarzoncam-bit.github.io/MIRAtuterritorio/reset-password.html"
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
  restoreExistingSession();
});
