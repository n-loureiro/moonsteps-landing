import test from 'node:test';
import assert from 'node:assert/strict';
import {parseListing, detectMedia} from '../src/collect.mjs';
import {validateListingUrl, validateAssetUrl} from '../src/network.mjs';
const url = 'https://www.portadafrente.com/pt/imoveis/house-a0c123';
const property = {id:'a0c123',code:'PF1',title:'Test house',photos:[{sequence:1,url:'https://static.portadafrente.com/PF1/a.jpg'}],gross_build_area:327,plan_url:'',description:'$64'};
const ld = {'@type':'RealEstateListing',name:'Test house',description:'A real description',numberOfBedrooms:5};
const flight = '9:'+JSON.stringify(['$',null,null,{property}]);
const chunk = t => '<script>self.__next_f.push('+JSON.stringify([1,t])+')</script>';
const html = '<script type="application/ld+json">'+JSON.stringify(ld)+'</script>'+chunk(flight.slice(0,90))+chunk(flight.slice(90));
test('joins split flight chunks without evaluating JavaScript and resolves description',()=>{
 const p=parseListing(html,url);assert.equal(p.code,'PF1');assert.equal(p.description,'A real description');assert.equal(p.photos.length,1);assert.equal(p.facts.grossBuildArea,327);
});
test('rejects a property record belonging to a different URL ID',()=>{
 assert.throws(()=>parseListing(html,url.replace('a0c123','a0cOTHER')),/match|identity/i);
});
test('JSON-LD-only pages preserve missing geometry inputs rather than inventing them',()=>{
 const p=parseListing('<script type="application/ld+json">'+JSON.stringify({...ld,url,image:['https://static.portadafrente.com/PF1/a.jpg']})+'</script>',url);
 assert.equal(p.title,'Test house');assert.equal(p.facts.grossBuildArea,null);assert.equal(p.photos.length,1);assert.equal(p.planUrl,null);
});
test('listing and media validation reject attacker hosts, credentials, nonstandard ports and localhost',()=>{
 for(const u of ['http://www.portadafrente.com/pt/imoveis/a','https://www.portadafrente.com.evil.com/pt/imoveis/a','https://x@www.portadafrente.com/pt/imoveis/a','https://www.portadafrente.com:444/pt/imoveis/a']) assert.throws(()=>validateListingUrl(u));
 assert.throws(()=>validateAssetUrl('https://127.0.0.1/a.jpg'));
 assert.equal(validateListingUrl(url).hostname,'www.portadafrente.com');
});
test('HTML masquerading as a PDF is never treated as an inspected floor plan',()=>{
 assert.equal(detectMedia(Buffer.from('<html>Salesforce</html>'),'application/pdf'),null);
 assert.equal(detectMedia(Buffer.from('%PDF-1.7\n'),'text/html'),'pdf');
 assert.equal(detectMedia(Buffer.from([255,216,255,224,0,0]),'application/octet-stream'),'jpg');
});
test('refresh replaces remote material but retains manually supplied plans and video frames',async()=>{
 const fs=await import('node:fs/promises');const os=await import('node:os');const path=await import('node:path');const {createHash}=await import('node:crypto');const {collect}=await import('../src/collect.mjs');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'porta-refresh-'));const originalFetch=globalThis.fetch;
 try{
 await fs.mkdir(path.join(dir,'assets'));const bytes=Buffer.from([255,216,255]);
 const assets=[];for(const kind of ['supplement','video-frame']){const id=kind+'-001',file='assets/'+id+'.jpg';await fs.writeFile(path.join(dir,file),bytes);assets.push({id,kind,status:'downloaded',format:'jpg',file,sha256:createHash('sha256').update(bytes).digest('hex')});}
 await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({assets,video:{status:'sampled-local-video',note:'Local frames sampled'}}));
 globalThis.fetch=async()=>new Response('<script type="application/ld+json">'+JSON.stringify({...ld,url})+'</script>',{headers:{'content-type':'text/html'}});
 const m=await collect(url,dir,{refresh:true,browser:false});assert.deepEqual(m.assets.map(a=>a.id),['supplement-001','video-frame-001']);assert.equal(m.video.status,'sampled-local-video');
 }finally{globalThis.fetch=originalFetch;await fs.rm(dir,{recursive:true,force:true});}
});
test('adding evidence after a missing sequence number never overwrites an existing source',async()=>{
 const fs=await import('node:fs/promises');const os=await import('node:os');const path=await import('node:path');const {addLocalAsset}=await import('../src/collect.mjs');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'porta-id-'));try{
 await fs.mkdir(path.join(dir,'assets'));const original=Buffer.from([255,216,255,1]),next=Buffer.from([255,216,255,2]);await fs.writeFile(path.join(dir,'assets/supplement-002.jpg'),original);await fs.writeFile(path.join(dir,'new.jpg'),next);
 const m={assets:[{id:'supplement-002',kind:'supplement',status:'downloaded',file:'assets/supplement-002.jpg'}]};await addLocalAsset(m,dir,path.join(dir,'new.jpg'));
 assert.equal(m.assets[1].id,'supplement-003');assert.deepEqual(await fs.readFile(path.join(dir,'assets/supplement-002.jpg')),original);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
