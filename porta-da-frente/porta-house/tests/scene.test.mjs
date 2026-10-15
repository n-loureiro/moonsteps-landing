import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScene} from '../src/scene.mjs';
import {readResponse,buildRequest} from '../src/interpret.mjs';
import {scene} from './fixtures.mjs';
const manifest={listing:{url:'https://www.portadafrente.com/pt/imoveis/a',description:'test',facts:{}},assets:[{id:'plan-001',status:'downloaded',file:'assets/plan.jpg',format:'jpg',kind:'plan'}],warnings:[],video:{status:'linked-only'}};
test('accepts grounded model but rejects negative dimensions and duplicate IDs',()=>{
 assert.equal(validateScene(scene(),manifest).objects.length,1);
 let s=scene();s.objects[0].size[0]=-1;assert.throws(()=>validateScene(s,manifest));
 s=scene();s.objects.push({...s.objects[0]});assert.throws(()=>validateScene(s,manifest),/duplicate/i);
});
test('rejects uninspected evidence and overlapping or out-of-bounds wall openings',()=>{
 let s=scene();s.objects[0].sources=['photo-999'];assert.throws(()=>validateScene(s,manifest),/evidence|source/i);
 s=scene();s.objects[0].openings[0].width=9;assert.throws(()=>validateScene(s,manifest),/opening/i);
 s=scene();s.objects[0].openings.push({offset:.2,width:1,height:2,sill:0,type:'window'});assert.throws(()=>validateScene(s,manifest),/overlap/i);
});
test('rejects nonfinite coordinates, self-crossing floor polygons and unknown levels',()=>{
 let s=scene();s.objects[0].position[0]=Infinity;assert.throws(()=>validateScene(s,manifest));
 s=scene();s.objects[0].level='missing';assert.throws(()=>validateScene(s,manifest),/level/i);
 s=scene();Object.assign(s.objects[0],{kind:'slab',openings:[],points:[[0,0],[2,2],[0,2],[2,0]]});assert.throws(()=>validateScene(s,manifest),/polygon/i);
});
test('rejects refused or incomplete API output and reads completed JSON only',()=>{
 assert.throws(()=>readResponse({status:'incomplete',output:[]}),/incomplete/i);
 assert.throws(()=>readResponse({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]}),/refus/i);
 assert.deepEqual(readResponse({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"version":1}'}]}]}),{version:1});
});
test('multimodal request uses explicit evidence IDs and strict output schema',async()=>{
 const r=await buildRequest(manifest,async()=>Buffer.from([255,216,255]),{model:'test-model'});
 assert.equal(r.model,'test-model');assert.equal(r.store,false);assert.equal(r.text.format.strict,true);
 assert.ok(r.input[0].content.some(c=>c.type==='input_image'&&c.image_url.startsWith('data:image/jpeg;base64,')));
 assert.ok(r.input[0].content.some(c=>c.type==='input_text'&&c.text.includes('plan-001')));
});
test('request cap records omitted evidence so it cannot be presented as inspected',async()=>{
 const m={...manifest,assets:[...manifest.assets,{id:'photo-001',kind:'photo',status:'downloaded',file:'assets/photo.jpg',format:'jpg'}]};
 const r=await buildRequest(m,async()=>Buffer.from([255,216,255]),{maxImages:1});
 const prompt=JSON.parse(r.input[0].content[0].text);assert.deepEqual(prompt.omitted,['photo-001']);assert.equal(r.input[0].content.filter(x=>x.type==='input_image').length,1);
});
test('interpretation cannot cite a downloaded image that was omitted from the API input',async()=>{
 const {validateInterpretation}=await import('../src/interpret.mjs');
 const m={...manifest,assets:[...manifest.assets,{id:'photo-001',status:'downloaded'}]};const s=scene();s.objects[0].sources=['photo-001'];
 assert.throws(()=>validateInterpretation(s,m,['plan-001']),/source|evidence/i);
});
test('rejects site-only scenes that have no building to frame in the viewer',()=>{
 const s=scene();Object.assign(s.objects[0],{kind:'box',layer:'site',level:'site',openings:[]});assert.throws(()=>validateScene(s,manifest),/building/i);
});
test('a full allowed model limitations list still exports with a deterministic omission notice',async()=>{
 const {validateInterpretation}=await import('../src/interpret.mjs');
 const m={...manifest,assets:[...manifest.assets,{id:'photo-001',status:'downloaded'}]};const s=scene();s.limitations=Array.from({length:39},(_,i)=>'Estimated detail '+i);
 const result=validateInterpretation(s,m,['plan-001']);assert.equal(result.limitations.length,40);assert.match(result.limitations.at(-1),/photo-001/);assert.doesNotThrow(()=>validateScene(result,m));
});
test('accepts traced roof triangles and rejects incomplete or degenerate roof faces',()=>{
 const s=scene();Object.assign(s.objects[0],{kind:'roof_mesh',layer:'roof',openings:[],position:[0,3,0],size:[4,1,4],points:[[-2,0,-2],[0,1,0],[2,0,-2]]});assert.doesNotThrow(()=>validateScene(s,manifest));
 s.objects[0].points.pop();assert.throws(()=>validateScene(s,manifest),/roof|triangle/i);
 s.objects[0].points=[[0,0,0],[1,0,0],[2,0,0]];assert.throws(()=>validateScene(s,manifest),/roof|triangle/i);
});
