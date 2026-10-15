const LISTING_HOSTS = new Set(['www.portadafrente.com','portadafrente.com']);
const ASSET_HOSTS = new Set([...LISTING_HOSTS,'static.portadafrente.com','portadafrente.my.salesforce.com','portadafrente.file.force.com','portadafrente.my.site.com']);
export function validateListingUrl(value) {
 const u = new URL(value);
 if(u.protocol !== 'https:' || !LISTING_HOSTS.has(u.hostname) || u.username || u.password || u.port || !/^\/(pt|en|fr)\/imoveis\/[^/]+\/?$/.test(u.pathname)) throw new Error('Use an HTTPS Porta da Frente property URL.');
 u.hash='';u.search='';return u;
}
export function validateAssetUrl(value) {
 const u = new URL(value);
 if(u.protocol !== 'https:' || !ASSET_HOSTS.has(u.hostname) || u.username || u.password || u.port) throw new Error('Unsupported media host: '+u.hostname);
 return u;
}
export async function safeFetch(value,{maxBytes=40*1024*1024,timeout=45000,method='GET',body,headers={}}={}) {
 let url=validateAssetUrl(value);
 for(let hop=0;hop<6;hop++) {
  const r=await fetch(url,{redirect:'manual',method,body,headers:{'User-Agent':'PortaHouse/0.1 (local property visualization)',...headers},signal:AbortSignal.timeout(timeout)});
  if([301,302,303,307,308].includes(r.status)) {
   await r.body?.cancel();url=validateAssetUrl(new URL(r.headers.get('location'),url).href);
   if(r.status===303){method='GET';body=undefined;}continue;
  }
  if(!r.ok){await r.body?.cancel();throw new Error('Source returned HTTP '+r.status);}
  const chunks=[];let length=0;
  try {for await(const c of r.body){length+=c.length;if(length>maxBytes)throw new Error('Source exceeds download limit');chunks.push(c);}}
  catch(e){await r.body?.cancel().catch(()=>{});throw e;}
  return {bytes:Buffer.concat(chunks),type:r.headers.get('content-type')||'',url:url.href};
 }
 throw new Error('Too many source redirects');
}
