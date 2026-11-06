import {passwordMaterial,decryptWithMaterial} from './crypto.mjs?v=20261031-3';
import {createSessionStore} from './session.mjs?v=20261031-3';
const form=document.querySelector('#unlock'),field=document.querySelector('#password'),button=document.querySelector('#submit'),status=document.querySelector('#status');
const entry=document.querySelector('#entry'),viewer=document.querySelector('#viewer'),frame=document.querySelector('#frame');
const safeScript=text=>text.replace(/<\/script/gi,'<\\/script');
let session;try{session=createSessionStore();}catch{}
let attempt=0,liveMaterial=null,liveExpires=0,pollTimer=null,pollBusy=false,lastEnvelope=null,lastPublicationTag=null;
const rawRoot='https://raw.githubusercontent.com/albertonational/gammalito-predicciongap/main/';
let liveHash=null, latestRegistryTime=0, latestCut=0, lastProbe=0;
function readCut(registry){
 return (registry?.intraday_sessions||[]).reduce((last,s)=>Math.max(last,Date.parse(s.cutoff_at)||0),0);
}
function cadence(now){
 const quarter=900000, elapsed=now%quarter;
 return !document.hidden && elapsed<180000 && latestCut<now-elapsed ? 2000 : 15000;
}
const stamp=registry=>Date.parse(registry?.collector?.checked_at)||0;
async function repositoryUpdate(){
 const options={cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(8000)};
 const compact=typeof DecompressionStream==='function';
 const name=compact?'fast':'live';
 const pointer=await fetch(rawRoot+name+'.sha256?t='+Math.floor(Date.now()/cadence(Date.now())),options);
 if(!pointer.ok)throw Error('POINTER_UNAVAILABLE');
 const hash=(await pointer.text()).trim();
 if(!/^[a-f0-9]{64}$/.test(hash))throw Error('INVALID_POINTER');
 if(hash===liveHash)return null;
 const bytes=await fetch(rawRoot+(compact?'fast.enc':'site.enc')+'?v='+hash,{...options,signal:AbortSignal.timeout(15000)});
 if(!bytes.ok)throw Error('FEED_UNAVAILABLE');
 const body=await bytes.arrayBuffer();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',body)),byte=>byte.toString(16).padStart(2,'0')).join('');
 if(digest!==hash)throw Error('INCOMPLETE_PUBLICATION');
 return {envelope:JSON.parse(new TextDecoder().decode(body)),hash};
}
const sessionNote=document.querySelector('#session-note');
function stopUpdates(){if(pollTimer!==null)clearInterval(pollTimer);pollTimer=null;liveHash=null;latestRegistryTime=0;liveMaterial=null;lastEnvelope=null;lastPublicationTag=null;}
async function closeAccess(message='Acceso cerrado.'){
 ++attempt;stopUpdates();frame.replaceChildren();viewer.hidden=true;entry.hidden=false;field.value='';status.textContent=message;button.disabled=false;field.focus();
 try{await session?.clear();}catch{}
}
async function refreshPublication(){
 if(!liveMaterial||pollBusy||viewer.hidden)return;
 if(Date.now()>=liveExpires){await closeAccess('El acceso de 24 horas venció. Introduce tu contraseña.');return;}
 const turn=attempt;pollBusy=true;let phase='download';
 try{
  let envelope,hash,tag;
  try {
   const update=await repositoryUpdate();
   if(!update||turn!==attempt)return;
   ({envelope,hash}=update);
  } catch {
   if(turn!==attempt)return;
   const head=await fetch('./site.enc',{method:'HEAD',cache:'no-store'});
   tag=head.headers?.get('etag')||head.headers?.get('last-modified');
   if(head.ok&&tag&&tag===lastPublicationTag)return;
   const response=await fetch('./site.enc',{cache:'no-store'});
   if(!response.ok)throw Error('SOURCE_UNAVAILABLE');
   envelope=await response.json();
   tag=response.headers?.get('etag')||response.headers?.get('last-modified');
  }
  if(turn!==attempt)return;
  if(envelope.ciphertext===lastEnvelope){if(hash)liveHash=hash;return;}
  phase='decrypt';
  const payload=await decryptWithMaterial(envelope,liveMaterial);
  if(payload.registry_gzip){
   phase='unpack';
   const compressed=Uint8Array.from(atob(payload.registry_gzip),c=>c.charCodeAt(0));
   const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
   payload.registry=await new Response(stream).json();
  }
  if(turn!==attempt)return;
  if(stamp(payload.registry)<latestRegistryTime)return;
  latestRegistryTime=stamp(payload.registry);latestCut=readCut(payload.registry);
  if(hash)liveHash=hash;
  frame.firstElementChild?.contentWindow.postMessage({type:'gap-registry-update',registry:payload.registry},location.origin);
  lastEnvelope=envelope.ciphertext;lastPublicationTag=tag||null;sessionNote.textContent='Publicación actualizada · '+new Date().toLocaleTimeString('es-MX',{timeZone:'America/New_York'})+' NY';
 }catch{
  if(turn!==attempt)return;
  if(phase==='decrypt')await closeAccess('El acceso guardado ya no abre esta publicación. Introduce tu contraseña.');
  else sessionNote.textContent='No se pudo comprobar una publicación nueva; se conservan las horas visibles.';
 }finally{pollBusy=false;}
}
function startUpdates(material,envelope,tag,registry){
 stopUpdates();liveMaterial=material;liveExpires=Date.now()+24*60*60*1000;lastEnvelope=envelope.ciphertext;lastPublicationTag=tag;
 latestRegistryTime=stamp(registry);latestCut=readCut(registry);lastProbe=0;
 pollTimer=setInterval(()=>{
  const now=Date.now();
  if(!pollBusy && now-lastProbe>=cadence(now)){lastProbe=now;void refreshPublication();}
 },1000);
 frame.firstElementChild?.addEventListener?.('load',()=>void refreshPublication(),{once:true});
}
function resumeUpdates(){
 if(document.hidden || !liveMaterial)return;
 lastProbe=0;
 void refreshPublication();
}
document.addEventListener?.('visibilitychange',resumeUpdates);
globalThis.addEventListener?.('pageshow',resumeUpdates);
globalThis.addEventListener?.('online',resumeUpdates);
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
  render(payload);startUpdates(material,envelope,response.headers?.get('etag')||response.headers?.get('last-modified')||null,payload.registry);
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
