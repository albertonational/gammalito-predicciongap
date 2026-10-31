const SLOT='gammalito-gap-tab-session-v1',DAY=24*60*60*1000;
// Only a random tab handle is stored in sessionStorage. IndexedDB stores a
// non-extractable CryptoKey, never the password or decrypted dashboard.
function vault(){
 const opened=new Promise((resolve,reject)=>{
  const request=indexedDB.open('gammalito-gap-access',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('keys');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 async function action(mode,fn){
  const db=await opened;
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('keys',mode),request=fn(tx.objectStore('keys'));
   tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
 }
 return {get:id=>action('readonly',s=>s.get(id)),put:(id,value)=>action('readwrite',s=>s.put(value,id)),remove:id=>action('readwrite',s=>s.delete(id)),async prune(now){
  const db=await opened;
  await new Promise((resolve,reject)=>{const tx=db.transaction('keys','readwrite'),request=tx.objectStore('keys').openCursor();request.onsuccess=()=>{const c=request.result;if(c){if(c.value.expires<=now)c.delete();c.continue();}};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
 }};
}
export function createSessionStore({storage=globalThis.sessionStorage,keys=vault(),now=()=>Date.now(),id=()=>crypto.randomUUID()}={}){
 return {
  async read(){await keys.prune(now());const token=storage.getItem(SLOT);if(!token)return null;const record=await keys.get(token);if(!record||record.expires<=now()){storage.removeItem(SLOT);return null;}return record.key;},
  async remember(key){if(key.extractable)throw Error('Extractable keys cannot be remembered');const token=storage.getItem(SLOT)||id();await keys.put(token,{key,expires:now()+DAY});storage.setItem(SLOT,token);},
  async clear(){const token=storage.getItem(SLOT);storage.removeItem(SLOT);if(token)await keys.remove(token);}
 };
}
