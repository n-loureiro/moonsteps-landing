import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {safeJson,exportViewer} from '../src/export.mjs';
import {scene} from './fixtures.mjs';
test('embedded JSON cannot escape its script and preserves its data',()=>{
 const raw={title:'</script><script>alert(1)</script>',note:'a\u2028b'};
 const encoded=safeJson(raw);assert.ok(!encoded.includes('</script>'));assert.deepEqual(JSON.parse(encoded),raw);
});
test('offline viewer carries its scene, local source bytes and bundled renderer',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'porta-export-'));
 try{
 await mkdir(path.join(dir,'assets'));await writeFile(path.join(dir,'assets/plan.jpg'),Buffer.from([255,216,255]));
 const manifest={listing:{url:'https://www.portadafrente.com/pt/imoveis/a',title:'House',facts:{}},assets:[{id:'plan-001',kind:'plan',status:'downloaded',format:'jpg',file:'assets/plan.jpg'}],warnings:[],video:{status:'not-provided'}};
 const target=path.join(dir,'house.html');await exportViewer(scene(),manifest,dir,target);const html=await readFile(target,'utf8');
 // Parse the actual embedded payload and verify it contains portable source media.
 const match=html.match(/<script id="project-data" type="application\/json">([\s\S]*?)<\/script>/);
 assert.ok(match);const payload=JSON.parse(match[1]);assert.equal(payload.scene.objects[0].id,'wall-1');assert.equal(payload.evidence[0].data,'data:image/jpeg;base64,/9j/');
 assert.ok(!/<script[^>]+src=/.test(html));assert.ok(html.includes('WebGLRenderer'));assert.ok(!html.includes('https://cdn.'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
