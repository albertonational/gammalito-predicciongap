import {passwordMaterial,decryptWithMaterial} from './crypto.mjs?v=20261031-3';
import {createSessionStore} from './session.mjs?v=20261031-3';
const form=document.querySelector('#unlock'),field=document.querySelector('#password'),button=document.querySelector('#submit'),status=document.querySelector('#status');
const entry=document.querySelector('#entry'),viewer=document.querySelector('#viewer'),frame=document.querySelector('#frame');
const historyFrame=document.querySelector('#history-frame'),historyToggle=document.querySelector('#history-toggle');
const safeScript=text=>text.replace(/<\/script/gi,'<\\/script');
let session;try{session=createSessionStore();}catch{}
let attempt=0,liveMaterial=null,liveExpires=0,pollTimer=null,pollBusy=false,lastEnvelope=null,lastPublicationTag=null,activeUiVersion='legacy';
const rawRoot='https://raw.githubusercontent.com/albertonational/gammalito-predicciongap/main/';
let liveHash=null, latestRegistryTime=0, latestCut=0, lastProbe=0;
function readCut(registry){
 return (registry?.intraday_sessions||[]).reduce((last,s)=>Math.max(last,Date.parse(s.cutoff_at)||0),Date.parse(registry?.intraday_close?.cutoff_at)||0);
}
function cadence(now){
 const quarter=900000, elapsed=now%quarter;
 return !document.hidden && elapsed<180000 && latestCut<now-elapsed ? 2000 : 15000;
}
let pendingView=null, nextBackupCheck=0, seenDirect=null, seenBackup=null;
function deliver(registry){
 const panel=frame.firstElementChild;
 if(!panel?.contentWindow)return;
 panel.contentWindow.postMessage({type:'gap-registry-update',registry},location.origin);
 historyFrame.firstElementChild?.contentWindow?.postMessage({type:'gap-registry-update',registry},location.origin);
}
function checkVisibleCut(){
 if(!pendingView)return;
 const panel=frame.firstElementChild;
 const shown=panel?.contentDocument?.querySelector('[data-live-cut]');
 if(shown && Date.parse(shown.getAttribute('data-live-cut'))<latestCut)deliver(pendingView);
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
 if(hash===seenDirect || hash===liveHash)return null;
 const bytes=await fetch(rawRoot+(compact?'fast.enc':'site.enc')+'?v='+hash,{...options,signal:AbortSignal.timeout(15000)});
 if(!bytes.ok)throw Error('FEED_UNAVAILABLE');
 const body=await bytes.arrayBuffer();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',body)),byte=>byte.toString(16).padStart(2,'0')).join('');
 if(digest!==hash)throw Error('INCOMPLETE_PUBLICATION');
 return {envelope:JSON.parse(new TextDecoder().decode(body)),hash};
}
const sessionNote=document.querySelector('#session-note');
function stopUpdates(){if(pollTimer!==null)clearInterval(pollTimer);pollTimer=null;pendingView=null;nextBackupCheck=0;seenDirect=null;seenBackup=null;liveHash=null;latestRegistryTime=0;liveMaterial=null;lastEnvelope=null;lastPublicationTag=null;}
async function closeAccess(message='Acceso cerrado.'){
 ++attempt;stopUpdates();frame.replaceChildren();historyFrame.replaceChildren();historyFrame.hidden=true;frame.hidden=false;historyToggle.hidden=true;historyToggle.textContent='Historial';viewer.hidden=true;entry.hidden=false;field.value='';status.textContent=message;button.disabled=false;field.focus();
 try{await session?.clear();}catch{}
}
async function refreshPublication(){
 if(!liveMaterial||pollBusy||viewer.hidden)return;
 if(Date.now()>=liveExpires){await closeAccess('El acceso de 24 horas venció. Introduce tu contraseña.');return;}
 const turn=attempt;pollBusy=true;let phase='download';
 try{
  let envelope,hash,tag,fromDirect=false;
  try {
   const update=await repositoryUpdate();
   if(turn!==attempt)return;
   if(update){({envelope,hash}=update);fromDirect=true;}
  }catch{ /* Keep the last valid registry while checking Pages. */ }
  if(turn!==attempt)return;
  if(!envelope){
   checkVisibleCut();
   const now=Date.now();
   if(now<nextBackupCheck)return;
   nextBackupCheck=now+15000;
   // Pages can already contain a new cut even when the raw feed still returns its previous hash.
   const nonce=Math.floor(now/15000);
   const options={cache:'no-store',signal:AbortSignal.timeout(8000)};
   const marker=await fetch('./fast.sha256?check='+nonce,options);
   if(marker.ok && typeof DecompressionStream==='function' && typeof marker.text==='function'){
    const checksum=(await marker.text()).trim();
    if(checksum===liveHash || checksum===seenBackup)return;
    if(/^[a-f0-9]{64}$/.test(checksum)){
     const body=await fetch('./fast.enc?v='+checksum,{cache:'no-store',signal:AbortSignal.timeout(15000)});
     if(!body.ok)throw Error('SOURCE_UNAVAILABLE');
     const bytes=await body.arrayBuffer();
     const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
     if(actual!==checksum)throw Error('INCOMPLETE_PUBLICATION');
     envelope=JSON.parse(new TextDecoder().decode(bytes));hash=checksum;
    }
   }
   if(!envelope){
    const response=await fetch('./site.enc?check='+nonce,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('SOURCE_UNAVAILABLE');
    envelope=await response.json();
   }
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
  // A fast update normally carries registry data only. When the app bundle changes,
  // fetch the full encrypted site and replace the iframe, not just its registry.
  if(payload.ui_version && payload.ui_version!==activeUiVersion){
   const material=liveMaterial;
   const options={cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(18000)};
   let fullEnvelope;
   try{
    const res=await fetch(rawRoot+'site.enc?ui='+Date.now(),options);
    if(!res.ok)throw Error('FULL_FEED_UNAVAILABLE');
    fullEnvelope=await res.json();
   }catch{
    const res=await fetch('./site.enc?ui='+Date.now(),options);
    if(!res.ok)throw Error('FULL_FEED_UNAVAILABLE');
    fullEnvelope=await res.json();
   }
   const full=await decryptWithMaterial(fullEnvelope,material);
   if(full.ui_version!==payload.ui_version)throw Error('UI_FEED_NOT_CURRENT');
   if(turn!==attempt)return;
   render(full);
   startUpdates(material,fullEnvelope,null,full.registry);
   sessionNote.textContent='Interfaz y datos actualizados · '+new Date().toLocaleTimeString('es-MX',{timeZone:'America/New_York'})+' NY';
   return;
  }
  if(hash){if(fromDirect)seenDirect=hash;else seenBackup=hash;}
  if(readCut(payload.registry)<latestCut || stamp(payload.registry)<latestRegistryTime)return;
  latestRegistryTime=stamp(payload.registry);latestCut=readCut(payload.registry);
  if(hash)liveHash=hash;
  pendingView=payload.registry;deliver(pendingView);
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
 activeUiVersion=payload.ui_version||'legacy';
 const registryText=JSON.stringify(payload.registry).replace(/</g,'\\u003c');
 const bridge='let registry='+registryText+';window.addEventListener("message",event=>{if(event.source!==parent||event.origin!=='+JSON.stringify(location.origin)+'||event.data?.type!=="gap-registry-update")return;registry=event.data.registry;window.dispatchEvent(new Event("gap-registry-update"));});window.fetch=async(input)=>{const path=new URL(typeof input==="string"?input:input.url,document.baseURI).pathname;if(path.endsWith("/data/registry.json"))return new Response(JSON.stringify(registry),{headers:{"Content-Type":"application/json"}});throw new Error("Recurso no disponible en esta publicación");};';
 const html=payload.html.replace('<link rel="stylesheet" href="./styles.css">',()=>'<style>'+payload.css+'</style>')
  .replace('<link rel="icon" href="./favicon.svg">','')
  .replace('<script type="module" src="./app.js"></script>',()=>'<script>'+safeScript(bridge)+'</script><script type="module">'+safeScript(payload.js)+'</script>');
 const iframe=document.createElement('iframe');iframe.title='Pronósticos y resultados de GAMMAlito';iframe.srcdoc=html;
 frame.replaceChildren(iframe);historyFrame.replaceChildren();historyFrame.hidden=true;frame.hidden=false;historyToggle.textContent='Historial';historyToggle.hidden=!payload.history_js;
 if(payload.history_js){
  const h=document.createElement('iframe');h.title='Historial de entradas destacadas';
  const style=`body{margin:0;background:#f4f5f1;color:#233e33;font:15px Arial,sans-serif}main{max-width:1000px;margin:auto;padding:25px}h1{font-size:25px}.filters{display:flex;gap:12px;align-items:end;flex-wrap:wrap;background:white;padding:16px;border-radius:12px}.filters label{display:grid;gap:5px;font-size:13px}.filters input,.filters select,.filters button{font:inherit;padding:8px;border:1px solid #bccbb5;border-radius:6px;background:white;color:#233e33}.notice{font-size:13px;color:#64746b;line-height:1.5}.day,.entry{background:white;border:1px solid #dce3d4;border-radius:10px;margin:10px 0;padding:12px}.entry{background:#f9fbf8;margin-left:10px}summary{cursor:pointer;line-height:1.6}summary span{font-size:12px;color:#607065;margin-left:10px}.call{color:#17804e}.put{color:#b44040}.detail{overflow:auto}.detail p{font-size:14px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px;border-bottom:1px solid #e1e7de;text-align:left}td small{display:block;color:#65736b;margin-top:3px}.empty{padding:20px;background:white;border-radius:8px}@media(max-width:600px){main{padding:14px}th,td{padding:7px;min-width:65px}}`;
  h.srcdoc='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style></head><body><main id="history-root"><p>Cargando historial…</p></main><script>'+safeScript(bridge)+'</script><script>'+safeScript(payload.history_js)+'</script></body></html>';
  historyFrame.replaceChildren(h);
 }
 entry.hidden=true;viewer.hidden=false;status.textContent='';
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
historyToggle.addEventListener('click',()=>{const show=historyFrame.hidden;historyFrame.hidden=!show;frame.hidden=show;historyToggle.textContent=show?'Inicio':'Historial';});
document.querySelector('#lock').addEventListener('click',()=>closeAccess());
async function restore(){
 button.disabled=true;
 try{const material=await session?.read();if(material)await open(material,{restoring:true});}
 catch{try{await session?.clear();}catch{}}
 finally{button.disabled=false;}
}
void restore();

