import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {allowedRequest,projectPath} from '../src/server.mjs';
import {runBatch} from '../src/pipeline.mjs';
test('loopback API rejects cross-origin requests and forged hosts',()=>{
 assert.equal(allowedRequest({host:'127.0.0.1:4318',origin:'http://127.0.0.1:4318'}),true);
 assert.equal(allowedRequest({host:'127.0.0.1:4318',origin:'https://evil.example'}),false);
 assert.equal(allowedRequest({host:'evil.example',origin:'https://evil.example'}),false);
});
test('project paths reject traversal and unrecognized IDs',()=>{
 assert.throws(()=>projectPath('/tmp/data','../../etc'));
 assert.throws(()=>projectPath('/tmp/data','%2e%2e'));
 assert.equal(projectPath('/tmp/data','abcdef1234567890'),'/tmp/data/abcdef1234567890');
});
test('batch continues after invalid URL and produces a resumable report without fabricating models',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'porta-batch-'));try{
 const good='https://www.portadafrente.com/pt/imoveis/house-a0c123';
 // A real cached listing avoids external I/O and exercises the same pipeline as the app.
 const {listingKey}=await import('../src/collect.mjs');const sub=path.join(dir,listingKey(good));await fs.mkdir(sub);
 await fs.writeFile(path.join(sub,'listing.html'),'<script type="application/ld+json">'+JSON.stringify({'@type':'RealEstateListing',name:'House',url:good,description:'No media available'})+'</script>');
 const report=await runBatch(['https://evil.example/a',good],dir,{generate:false});
 assert.equal(report.length,2);assert.equal(report[0].status,'failed');assert.equal(report[1].status,'collected');assert.equal(await fs.readFile(path.join(sub,'state.json'),'utf8').then(JSON.parse).then(s=>s.status),'collected');
 await assert.rejects(fs.access(path.join(sub,'house.html')));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('unfinished jobs become resumable interruptions after a server restart',async()=>{
 const {displayState}=await import('../src/server.mjs');
 assert.equal(displayState({status:'interpreting',message:'Working'},false).status,'interrupted');
 assert.equal(displayState({status:'ready',message:'Ready'},false).status,'ready');
});
