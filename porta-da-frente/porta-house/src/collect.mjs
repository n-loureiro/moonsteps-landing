import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateListingUrl,validateAssetUrl,safeFetch} from './network.mjs';

export const listingKey = url => createHash('sha256').update(validateListingUrl(url).href).digest('hex').slice(0,16);
export async function writeJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(value,null,2));await fs.rename(tmp,file);}
function jsonObjectAt(text,start) {
 let depth=0,quote=false,escape=false;
 for(let i=start;i<text.length;i++) {
  const c=text[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}
  if(c==='"')quote=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return JSON.parse(text.slice(start,i+1));
 }
 throw new Error('Incomplete property record');
}
export function parseListing(html,url) {
 const u=validateListingUrl(url);const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
 const linked=[];let flight='';let legacy='';
 for(const [,attrs,text] of scripts) {
  if(/application\/ld\+json/i.test(attrs)){try{const d=JSON.parse(text);linked.push(...(Array.isArray(d)?d:d['@graph']||[d]));}catch{}}
  if(/__NEXT_DATA__/.test(attrs))legacy=text;
  const m=text.match(/self\.__next_f\.push\(([\s\S]*)\)\s*;?\s*$/);
  if(m){try{const d=JSON.parse(m[1]);if(d[0]===1&&typeof d[1]==='string')flight+=d[1];}catch{}}
 }
 const ld=linked.find(x=>[x['@type']].flat().some(t=>['RealEstateListing','House','Residence','Apartment'].includes(t)))||{};
 const candidates=[];
 for(const text of [flight,legacy]) for(const m of text.matchAll(/"property"\s*:\s*\{/g)) {
  try {const p=jsonObjectAt(text,m.index+m[0].lastIndexOf('{'));if(p.id&&p.title)candidates.push(p);}catch{}
 }
 const p=candidates.find(p=>u.pathname.endsWith(p.id)||u.pathname.endsWith(p.id+'/'))||{};
 if(candidates.length&&!p.id)throw new Error('Listing identity does not match the URL.');
 if(!p.id&&!ld.name)throw new Error('No property data found. The listing may have moved or changed format.');
 if(!p.id&&ld.url&&validateListingUrl(ld.url).pathname.replace(/\/$/,'')!==u.pathname.replace(/\/$/,''))throw new Error('Listing identity does not match the URL.');
 const images=(p.photos||[ld.image].flat().filter(Boolean).map((x,i)=>({url:typeof x==='string'?x:x.url,sequence:i+1}))).filter(x=>x.url);
 const number=(...values)=>values.find(x=>typeof x==='number'&&Number.isFinite(x)&&x>0)??null;
 return {url:u.href,id:p.id||u.pathname.split('-').at(-1),code:p.code||null,title:p.title||ld.name,description:p.description&&!p.description.startsWith('$')?p.description:ld.description||'',location:[p.zone,p.county].filter(Boolean).join(', '),
  facts:{bedrooms:number(p.rooms,ld.numberOfBedrooms),bathrooms:number(p.bathrooms,ld.numberOfBathroomsTotal),grossBuildArea:number(p.gross_build_area),privateArea:number(p.gross_private_area),landArea:number(p.land_area),price:number(p.price),parking:number(p.parking_spaces,ld.numberOfParkingSpaces)},
  photos:images.sort((a,b)=>(a.sequence||0)-(b.sequence||0)).map((x,i)=>({id:`photo-${String(i+1).padStart(3,'0')}`,url:x.url})),planUrl:p.plan_url||null,videoUrls:[p.video_url,ld.video?.embedUrl,ld.video?.contentUrl,p.virtual_tour_url].filter((x,i,a)=>x&&a.indexOf(x)===i)};
}
export function detectMedia(bytes) {
 if(bytes.subarray(0,5).toString()==='%PDF-')return 'pdf';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'webp';
 return null;
}
async function resolvePlan(url,{browser=true}={}) {
 let result=await safeFetch(url);if(detectMedia(result.bytes))return [result];
 if(!browser)throw new Error('Floor plan is an HTML viewer. Enable browser resolution or add the downloaded plan with --asset.');
 const {chromium}=await import('playwright');let engine;
 try {engine=await chromium.launch({headless:true});}catch {
  try {engine=await chromium.launch({headless:true,channel:'chrome'});}catch {throw new Error('Install the plan browser: npx playwright install chromium, or supply the plan with --asset.');}
 }
 try {
  const page=await engine.newPage();
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());
   const ok=u.protocol==='https:'&&(['salesforce.com','force.com','salesforce-sites.com','portadafrente.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d)));
   return ok?route.continue():route.abort();
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('img[src*="renditionDownload"]').first().waitFor({timeout:45000});
  const urls=await page.locator('img[src*="renditionDownload"]').evaluateAll(imgs=>imgs.map(i=>i.src));
  const results=[];
  for(const src of [...new Set(urls)].slice(0,20)) {validateAssetUrl(src);const r=await safeFetch(src);if(detectMedia(r.bytes))results.push(r);}
  if(!results.length)throw new Error('Floor-plan viewer exposed no downloadable image.');return results;
 } finally {await engine.close();}
}
export async function addLocalAsset(manifest,directory,file,kind='supplement') {
 const bytes=await fs.readFile(file);const ext=detectMedia(bytes);if(!ext)throw new Error('Supplement must be a JPEG, PNG, WebP or PDF.');
 let sequence=Math.max(0,...manifest.assets.filter(a=>a.kind===kind).map(a=>Number(a.id.split('-').at(-1))||0))+1;
 let id,relative,handle;await fs.mkdir(path.join(directory,'assets'),{recursive:true});
 // Exclusive creation also protects files left behind by an interrupted manifest write.
 while(!handle){id=`${kind}-${String(sequence++).padStart(3,'0')}`;relative=`assets/${id}.${ext}`;try{handle=await fs.open(path.join(directory,relative),'wx');}catch(e){if(e.code!=='EEXIST')throw e;}}
 try{await handle.writeFile(bytes);}finally{await handle.close();}
 manifest.assets.push({id,kind,status:'downloaded',file:relative,format:ext,url:null,sha256:createHash('sha256').update(bytes).digest('hex')});
 await writeJson(path.join(directory,'manifest.json'),manifest);return manifest;
}
export async function collect(url,directory,{refresh=false,browser=true,log=()=>{}}={}) {
 validateListingUrl(url);await fs.mkdir(path.join(directory,'assets'),{recursive:true});
 let html;
 try{if(!refresh)html=await fs.readFile(path.join(directory,'listing.html'),'utf8');}catch{}
 if(!html){log('Reading listing');html=(await safeFetch(url,{maxBytes:8*1024*1024})).bytes.toString('utf8');await fs.writeFile(path.join(directory,'listing.html'),html);}
 const listing=parseListing(html,url);let previous;
 try{previous=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));}catch{}
 const manifest={version:1,collectedAt:new Date().toISOString(),listing,assets:[],warnings:[],video:{status:listing.videoUrls.length?'linked-only':'not-provided',urls:listing.videoUrls,note:listing.videoUrls.length?'Video and virtual-tour links have not been visually inspected. Supply extracted frames with --asset, or a local video with --video.':'No video link was provided.'}};
 async function save(id,kind,result) {
  const ext=detectMedia(result.bytes);if(!ext)throw new Error('Server returned HTML or unsupported media instead of an image/PDF.');
  const file=`assets/${id}.${ext}`;await fs.writeFile(path.join(directory,file),result.bytes);
  return {id,kind,status:'downloaded',file,format:ext,url:result.url,sha256:createHash('sha256').update(result.bytes).digest('hex')};
 }
 async function cached(id,local=false) {
  const a=(local||!refresh)&&previous?.assets.find(x=>x.id===id&&(local||x.status==='downloaded'));
  if(a&&/^assets\/[\w.-]+$/.test(a.file)){try{const b=await fs.readFile(path.join(directory,a.file));if(detectMedia(b)&&createHash('sha256').update(b).digest('hex')===a.sha256){const {error,...rest}=a;return {...rest,status:'downloaded'};}}catch{}}
 }
 const photos=listing.photos.slice(0,120);if(listing.photos.length>120)manifest.warnings.push('Gallery exceeds 120-photo safety limit; remainder not downloaded.');
 for(let start=0;start<photos.length;start+=3) {
  const group=await Promise.all(photos.slice(start,start+3).map(async a=>{
   try{log('Collecting '+a.id);return await cached(a.id)||await save(a.id,'photo',await safeFetch(a.url));}
   catch(e){return {id:a.id,kind:'photo',status:'failed',url:a.url,error:e.message};}
  }));manifest.assets.push(...group);
 }
 if(listing.planUrl) {
  log('Resolving floor-plan document');
  const plans=previous?.assets.filter(x=>x.kind==='plan'&&x.status==='downloaded')||[];const existing=[];
  for(const a of plans){const c=await cached(a.id);if(c)existing.push(c);}
  if(existing.length===plans.length&&existing.length)manifest.assets.push(...existing);
  else try {const results=await resolvePlan(listing.planUrl,{browser});for(const [i,r] of results.entries())manifest.assets.push(await save(`plan-${String(i+1).padStart(3,'0')}`,'plan',r));}
  catch(e){manifest.assets.push({id:'plan-001',kind:'plan',status:'failed',url:listing.planUrl,error:e.message});manifest.warnings.push('Floor plan was not inspected: '+e.message);}
 } else manifest.warnings.push('No floor-plan link was exposed by this listing. Internal layout will require inference.');
 for(const a of previous?.assets.filter(x=>['supplement','video-frame'].includes(x.kind))||[]){
  const c=await cached(a.id,true);
  manifest.assets.push(c||{...a,status:'failed',error:'Local evidence file is missing or failed its integrity check. Add a replacement explicitly.'});
  if(!c)manifest.warnings.push('Local evidence unavailable: '+a.id);
 }
 if(manifest.assets.some(a=>a.kind==='video-frame'&&a.status==='downloaded')&&previous?.video)manifest.video={...previous.video,urls:listing.videoUrls};
 const failures=manifest.assets.filter(a=>a.status==='failed');if(failures.length)manifest.warnings.push(`${failures.length} source asset(s) could not be downloaded. See asset errors.`);
 await writeJson(path.join(directory,'manifest.json'),manifest);return manifest;
}
