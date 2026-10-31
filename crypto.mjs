const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const context=new TextEncoder().encode('GAMMAlito-PrediccionGAP-v1');
export async function decryptEnvelope(envelope,password,subtle=globalThis.crypto.subtle){
 if(envelope.version!==1||envelope.iterations!==600000||bytes(envelope.salt).length!==32||bytes(envelope.iv).length!==12)throw Error('Formato no admitido');
 const material=await subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const key=await subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:bytes(envelope.salt),iterations:envelope.iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);
 const plaintext=await subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),additionalData:context,tagLength:128},key,bytes(envelope.ciphertext));
 return JSON.parse(new TextDecoder().decode(plaintext));
}
