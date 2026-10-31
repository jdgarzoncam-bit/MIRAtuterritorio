import {createAuthClient} from "https://esm.sh/@neondatabase/auth@0.7.0-beta";
const AUTH_URL="https://ep-round-dawn-b7l3ya3h.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth";
const auth=createAuthClient(AUTH_URL);
const form=document.getElementById("signupForm");
const status=document.getElementById("status");
const signupBtn=document.getElementById("signupBtn");
const verifyBtn=document.getElementById("verifyBtn");
const resendBtn=document.getElementById("resendCodeBtn");
const signupFields=document.getElementById("signupFields");
const verificationFields=document.getElementById("verificationFields");
let registeredEmail="";
let registeredName="";
function setStatus(message,type="success"){status.textContent=message;status.className="signup-status "+type;}
function showVerification(){signupFields.classList.add("signup-hidden");verificationFields.classList.remove("signup-hidden");document.getElementById("verificationCode").focus();}
async function sendCode(){
  if(!registeredEmail)throw new Error("Primero completa el formulario de registro.");
  const result=await auth.sendVerificationEmail({email:registeredEmail,callbackURL:new URL("index.html",window.location.href).href});
  if(result?.error)throw new Error(result.error.message||"No fue posible enviar el código.");
}
form.addEventListener("submit",async event=>{
 event.preventDefault();
 if(!form.reportValidity())return;
 signupBtn.disabled=true;setStatus("Creando tu cuenta…");
 registeredName=form.elements.name.value.trim();
 registeredEmail=form.elements.email.value.trim().toLowerCase();
 try{
  const result=await auth.signUp.email({name:registeredName,email:registeredEmail,password:form.elements.password.value});
  if(result?.error)throw new Error(result.error.message||"No se pudo crear la cuenta.");
  if(result?.data?.user?.emailVerified===true){
    setStatus("Correo confirmado. Tu solicitud quedó pendiente de aprobación administrativa. No podrás ingresar hasta que el administrador active tu cuenta y asigne permisos.");
    signupFields.classList.add("signup-hidden");
    return;
  }
  await sendCode();
  form.elements.password.value="";
  showVerification();
  setStatus("Te enviamos un código de confirmación. Revisa tu correo y la carpeta de Spam. Tu cuenta seguirá pendiente de aprobación administrativa.");
 }catch(error){setStatus(error?.message||"No fue posible completar el registro.","error");}
 finally{signupBtn.disabled=false;}
});
verifyBtn.addEventListener("click",async()=>{
 const otp=document.getElementById("verificationCode").value.trim();
 if(!otp){setStatus("Escribe el código que recibiste por correo.","error");return;}
 verifyBtn.disabled=true;setStatus("Verificando correo…");
 try{
  const result=await auth.emailOtp.verifyEmail({email:registeredEmail,otp});
  if(result?.error)throw new Error(result.error.message||"El código no es válido o ya venció.");
  verificationFields.classList.add("signup-hidden");
  setStatus("¡Correo confirmado! Tu solicitud quedó pendiente de aprobación administrativa. El administrador debe activar tu cuenta y asignarte permisos antes de que puedas ingresar.");
 }catch(error){setStatus(error?.message||"No fue posible verificar el correo.","error");}
 finally{verifyBtn.disabled=false;}
});
resendBtn.addEventListener("click",async()=>{
 resendBtn.disabled=true;setStatus("Solicitando un nuevo código…");
 try{await sendCode();setStatus("Código reenviado. Revisa tu bandeja de entrada y Spam.");}
 catch(error){setStatus(error?.message||"No fue posible reenviar el código.","error");}
 finally{resendBtn.disabled=false;}
});
