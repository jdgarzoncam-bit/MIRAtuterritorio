import {createAuthClient} from "https://esm.sh/@neondatabase/auth@0.7.0-beta";
const auth=createAuthClient("https://ep-lucky-smoke-b73q7rl0.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth");
const form=document.getElementById("signupForm"),status=document.getElementById("status"),button=document.getElementById("signupBtn");
form.addEventListener("submit",async e=>{
 e.preventDefault();if(!form.reportValidity())return;
 button.disabled=true;status.textContent="Creando la cuenta…";
 try{
  const result=await auth.signUp.email({name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),password:form.elements.password.value});
  if(result?.error)throw new Error(result.error.message||"No se pudo crear la cuenta.");
  form.reset();status.textContent="Cuenta creada. El administrador debe asignarte un rol y activar tu perfil antes de que puedas ingresar.";
 }catch(err){status.textContent=err.message||"No se pudo crear la cuenta.";}
 finally{button.disabled=false;}
});