import { createAuthClient } from "https://esm.sh/@neondatabase/auth@0.7.0-beta";
const auth=createAuthClient("https://ep-round-dawn-b7l3ya3h.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth",{allowAnonymous:true});
const API="https://ep-round-dawn-b7l3ya3h.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1";
const form=document.getElementById("witnessForm"),status=document.getElementById("status"),button=document.getElementById("submitBtn");
form.addEventListener("submit",async e=>{
 e.preventDefault();if(!form.reportValidity())return;
 if(form.elements.website.value){status.textContent="No fue posible procesar el registro.";return;}
 if(!document.getElementById("consent").checked){status.textContent="Debes autorizar el tratamiento para continuar.";return;}
 button.disabled=true;status.textContent="Enviando registro…";
 try{
  const tokenResult=await auth.getAnonymousToken(),token=tokenResult?.data?.token;
  if(!token)throw new Error("No se pudo iniciar el envío.");
  const payload={nombres:form.elements.nombres.value.trim(),apellidos:form.elements.apellidos.value.trim(),telefono:form.elements.telefono.value.trim()||null,correo:form.elements.correo.value.trim()||null,puesto_votacion:form.elements.puesto_votacion.value.trim(),mesa_votacion:form.elements.mesa_votacion.value.trim()||null,consentimiento_datos:true,consentimiento_version:"2026-10-30-v1"};
  const response=await fetch(API+"/testigos_publicos",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","Content-Profile":"mira",Prefer:"return=minimal"},body:JSON.stringify(payload)});
  if(!response.ok){const err=await response.json().catch(()=>({}));throw new Error(err.message||"No se pudo guardar el registro.");}
  form.reset();status.textContent="Registro recibido. Quedó pendiente de validación por el equipo autorizado.";
 }catch(err){status.textContent=err.message||"Error de conexión. Intenta nuevamente.";}
 finally{button.disabled=false;}
});