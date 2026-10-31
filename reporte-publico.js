import { createAuthClient } from "https://esm.sh/@neondatabase/auth@0.7.0-beta";
const auth=createAuthClient("https://ep-lucky-smoke-b73q7rl0.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth",{allowAnonymous:true});
const API="https://ep-lucky-smoke-b73q7rl0.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1";
const form=document.getElementById("publicReportForm"),status=document.getElementById("reportStatus"),button=document.getElementById("sendReportBtn");
form.addEventListener("submit",async event=>{
 event.preventDefault(); if(!form.reportValidity()) return;
 if(form.elements.website.value){status.textContent="No fue posible procesar el envío.";return;}
 if(!document.getElementById("privacyAck").checked){status.textContent="Confirma que no incluyes datos personales.";return;}
 button.disabled=true;status.textContent="Enviando…";
 try{
  const tokenResult=await auth.getAnonymousToken();
  const token=tokenResult?.data?.token;
  if(!token) throw new Error("No se pudo iniciar el envío público.");
  const payload={puesto_votacion:form.elements.puesto_votacion.value.trim(),mesa_votacion:form.elements.mesa_votacion.value.trim(),tipo_reporte:form.elements.tipo_reporte.value,descripcion:form.elements.descripcion.value.trim()};
  const response=await fetch(API+"/reportes_operativos",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","Content-Profile":"mira",Prefer:"return=minimal"},body:JSON.stringify(payload)});
  if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.message||"No se pudo registrar el reporte.");}
  form.reset();status.textContent="Reporte recibido. Gracias por aportar información objetiva.";
 }catch(error){status.textContent=error.message||"Error de conexión. Intenta nuevamente.";}
 finally{button.disabled=false;}
});
