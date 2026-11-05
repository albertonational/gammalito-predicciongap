import {passwordMaterial,decryptWithMaterial} from './crypto.mjs?v=20261031-3';
import {createSessionStore} from './session.mjs?v=20261031-3';
const form=document.querySelector('#unlock'),field=document.querySelector('#password'),button=document.querySelector('#submit'),status=document.querySelector('#status');
const entry=document.querySelector('#entry'),viewer=document.querySelector('#viewer'),frame=document.querySelector('#frame');
const safeScript=text=>text.replace(/<\/script/gi,'<\\/script');
let session;try{session=createSessionStore();}catch{}
let attempt=0,liveMaterial=null,liveExpires=0,pollTimer=null,pollBusy=false,lastEnvelope=null,lastPublicationTag=null;
const sessionNote=document.querySelector('#session-note');
function stopUpdates(){if(pollTimer!==null)clearInterval(pollTimer);pollTimer=null;liveMaterial=null;lastEnvelope=null;lastPublicationTag=null;}
async function closeAccess(message='Acceso cerrado.'){
 ++attempt;stopUpdates();frame.replaceChildren();viewer.hidden=true;entry.hidden=false;field.value='';status.textContent=message;button.disabled=false;field.focus();
 try{await session?.clear();}catch{}
}
async function refreshPublication(){
 if(!liveMaterial||pollBusy||viewer.hidden)return;
 if(Date.now()>=liveExpires){await closeAccess('El acceso de 24 horas venció. Introduce tu contraseña.');return;}
 const turn=attempt;pollBusy=true;let phase='download';
 try{
  if(lastPublicationTag){const head=await fetch('./site.enc',{method:'HEAD',cache:'no-store'});if(head.ok&&(head.headers?.get('etag')||head.headers?.get('last-modified'))===lastPublicationTag){sessionNote.textContent='Publicación comprobada · acceso conservado en esta pestaña.';return;}}
  const response=await fetch('./site.enc',{cache:'no-store'});if(!response.ok)throw Error('SOURCE_UNAVAILABLE');
  const envelope=await response.json();if(envelope.ciphertext===lastEnvelope)return;phase='decrypt';
  const payload=await decryptWithMaterial(envelope,liveMaterial);if(turn!==attempt)return;
  frame.firstElementChild?.contentWindow.postMessage({type:'gap-registry-update',registry:payload.registry},location.origin);
  lastEnvelope=envelope.ciphertext;lastPublicationTag=response.headers?.get('etag')||response.headers?.get('last-modified')||null;sessionNote.textContent='Publicación actualizada · '+new Date().toLocaleTimeString('es-MX',{timeZone:'America/New_York'})+' NY';
 }catch{
  if(turn!==attempt)return;
  if(phase==='decrypt')await closeAccess('El acceso guardado ya no abre esta publicación. Introduce tu contraseña.');
  else sessionNote.textContent='No se pudo comprobar una publicación nueva; se conservan las horas visibles.';
 }finally{pollBusy=false;}
}
function startUpdates(material,envelope,tag){
 stopUpdates();liveMaterial=material;liveExpires=Date.now()+24*60*60*1000;lastEnvelope=envelope.ciphertext;lastPublicationTag=tag;
 pollTimer=setInterval(()=>void refreshPublication(),60000);
}
function render(payload){
 const registryText=JSON.stringify(payload.registry).replace(/</g,'\\u003c');
 const bridge='let registry='+registryText+';window.addEventListener("message",event=>{if(event.source!==parent||event.origin!=='+JSON.stringify(location.origin)+'||event.data?.type!=="gap-registry-update")return;registry=event.data.registry;window.dispatchEvent(new Event("gap-registry-update"));});window.fetch=async(input)=>{const path=new URL(typeof input==="string"?input:input.url,document.baseURI).pathname;if(path.endsWith("/data/registry.json"))return new Response(JSON.stringify(registry),{headers:{"Content-Type":"application/json"}});throw new Error("Recurso no disponible en esta publicación");};';
 const html=payload.html.replace('<link rel="stylesheet" href="./styles.css">',()=>'<style>'+payload.css+'</style>')
  .replace('<link rel="icon" href="./favicon.svg">','')
  .replace('<script type="module" src="./app.js"></script>',()=>'<script>'+safeScript(bridge)+'</script><script type="module">'+safeScript(payload.js)+'</script>');
 const iframe=document.createElement('iframe');iframe.title='Pronósticos y resultados de GAMMAlito';iframe.srcdoc=html;
 frame.replaceChildren(iframe);entry.hidden=true;viewer.hidden=false;status.textContent='';
}
async function open(material,{restoring=false}={}){
 const turn=++attempt;button.disabled=true;status.textContent=restoring?'Restaurando acceso…':'Abriendo…';let phase='download';
 try{
  if(!globalThis.crypto?.subtle)throw Error('HTTPS_REQUIRED');
  const response=await fetch('./site.enc',{cache:'no-store'});if(!response.ok)throw Error('SOURCE_UNAVAILABLE');
  const envelope=await response.json();phase='decrypt';
  const payload=await decryptWithMaterial(envelope,material);phase='render';
  if(turn!==attempt)return;
  render(payload);startUpdates(material,envelope,response.headers?.get('etag')||response.headers?.get('last-modified')||null);
  try{if(!session)throw Error("Storage unavailable");await session.remember(material);}catch{document.querySelector('#session-note').textContent='Este navegador no permitió conservar el acceso. Al recargar pedirá la contraseña.';}
  if(turn!==attempt)await session?.clear();
 }catch(error){
  if(turn!==attempt)return;
  if(phase==='decrypt'){try{await session?.clear();}catch{}}
  status.textContent=error.message==='HTTPS_REQUIRED'?'Abre esta página mediante HTTPS.':phase==='download'?'No se pudo descargar el registro. Recarga la página.':phase==='decrypt'?(restoring?'El acceso guardado ya no abre esta publicación. Introduce tu contraseña.':'La contraseña no coincide con esta publicación. Usa el valor guardado en GAP_SITE_PASSWORD.'):'La contraseña abrió el registro, pero falló la carga del panel. Código: PANEL.';
  field.focus();
 }finally{if(turn===attempt)button.disabled=false;}
}
form.addEventListener('submit',async event=>{
 event.preventDefault();let password=field.value;field.value='';
 try{const material=await passwordMaterial(password);password='';await open(material);}
 catch{status.textContent='No se pudo iniciar el acceso seguro. Usa HTTPS y recarga.';}
 finally{password='';}
});
document.querySelector('#lock').addEventListener('click',()=>closeAccess());
async function restore(){
 button.disabled=true;
 try{const material=await session?.read();if(material)await open(material,{restoring:true});}
 catch{try{await session?.clear();}catch{}}
 finally{button.disabled=false;}
}
void restore();
