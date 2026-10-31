// MIRA TU TERRITORIO — autenticación Neon Auth (Better Auth administrado)
import { createAuthClient } from "https://esm.sh/@neondatabase/auth@0.7.0-beta";

const AUTH_URL = "https://ep-round-dawn-b7l3ya3h.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth";
const DATA_API_URL = "https://ep-round-dawn-b7l3ya3h.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1";
const auth = createAuthClient(AUTH_URL,{allowAnonymous:true});
window.MIRA_AUTH = auth;

async function bearerToken() {
  const result=await auth.token();
  if(result?.error) throw new Error(result.error.message || "No se pudo validar la sesión.");
  const token=result?.data?.token;
  if(!token) throw new Error("No se recibió el token de acceso.");
  return token;
}
async function getOwnProfile(token) {
  const response=await fetch(`${DATA_API_URL}/user_profiles?select=role,active,email,display_name&limit=1`,{
    headers:{Authorization:`Bearer ${token}`,"Accept-Profile":"mira"}
  });
  if(!response.ok) throw new Error("No fue posible validar los permisos de esta cuenta.");
  const rows=await response.json();
  return rows?.[0] || null;
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
    if(result?.error) throw new Error("No fue posible iniciar sesión. Verifica tus credenciales.");
    const token=await bearerToken();
    const profile=await getOwnProfile(token);
    if(!profile || profile.active!==true || !["admin","operator","viewer"].includes(profile.role)) {
      await auth.signOut();
      throw new Error("Tu cuenta todavía no tiene permisos asignados. Solicita al administrador que habilite tu perfil.");
    }
    window.MIRA_CURRENT_USER={role:profile.role,displayName:profile.display_name||email,email};
    window.dispatchEvent(new Event("mira:authenticated"));
    const error=document.getElementById("loginError");
    if(error) error.style.display="none";
    const pass=document.getElementById("password"); if(pass) pass.value="";
    if(typeof window.activarPMUAutenticado==="function") window.activarPMUAutenticado();
    else throw new Error("No se pudo iniciar la interfaz principal.");
  } catch(error) {
    showLoginError(error?.message || "No fue posible iniciar sesión.");
  } finally { if(button) button.disabled=false; }
}

document.addEventListener("DOMContentLoaded",()=>{
  const button=document.getElementById("loginBtn");
  if(button) button.addEventListener("click",event=>{event.preventDefault();event.stopImmediatePropagation();loginWithNeon();},true);
  const password=document.getElementById("password");
  if(password) password.addEventListener("keydown",event=>{
    if(event.key==="Enter"){event.preventDefault();event.stopImmediatePropagation();loginWithNeon();}
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
        redirectTo:"https://jdgarzoncam-bit.github.io/reset-password.html"
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
  if(logout) logout.addEventListener("click",()=>{auth.signOut().catch(err=>console.warn("No se pudo cerrar la sesión remota",err));},true);
});
