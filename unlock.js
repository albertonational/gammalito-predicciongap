import {decryptEnvelope} from './crypto.mjs';
const form=document.querySelector('#unlock'),field=document.querySelector('#password'),button=document.querySelector('#submit'),status=document.querySelector('#status');
const entry=document.querySelector('#entry'),viewer=document.querySelector('#viewer'),frame=document.querySelector('#frame');
const safeScript=text=>text.replace(/<\/script/gi,'<\\/script');
form.addEventListener('submit',async event=>{
 event.preventDefault();button.disabled=true;status.textContent='Abriendo…';
 let password=field.value;field.value='';
 try{
  if(!globalThis.crypto?.subtle)throw Error('HTTPS_REQUIRED');
  const response=await fetch('./site.enc',{cache:'no-store'});if(!response.ok)throw Error('SOURCE_UNAVAILABLE');
  const payload=await decryptEnvelope(await response.json(),password);password='';
  const registryText=JSON.stringify(payload.registry).replace(/</g,'\\u003c');
  const bridge='const registry='+registryText+';window.fetch=async(input)=>{const path=new URL(typeof input==="string"?input:input.url,document.baseURI).pathname;if(path.endsWith("/data/registry.json"))return new Response(JSON.stringify(registry),{headers:{"Content-Type":"application/json"}});throw new Error("Recurso no disponible en esta publicación");};';
  const html=payload.html.replace('<link rel="stylesheet" href="./styles.css">','<style>'+payload.css+'</style>')
   .replace('<link rel="icon" href="./favicon.svg">','')
   .replace('<script type="module" src="./app.js"></script>','<script>'+safeScript(bridge)+'</script><script type="module">'+safeScript(payload.js)+'</script>');
  const iframe=document.createElement('iframe');iframe.title='Pronósticos y resultados de GAMMAlito';iframe.srcdoc=html;
  frame.replaceChildren(iframe);entry.hidden=true;viewer.hidden=false;status.textContent='';
 }catch(error){status.textContent=error.message==='HTTPS_REQUIRED'?'Abre esta página mediante HTTPS.':error.message==='SOURCE_UNAVAILABLE'?'El registro no está disponible. Inténtalo más tarde.':'No se pudo abrir. Revisa la contraseña o recarga la página.';field.focus();}
 finally{password='';button.disabled=false;}
});
document.querySelector('#lock').addEventListener('click',()=>{frame.replaceChildren();viewer.hidden=true;entry.hidden=false;field.value='';field.focus();});
