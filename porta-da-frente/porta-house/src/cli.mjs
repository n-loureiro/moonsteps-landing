#!/usr/bin/env node
import fs from 'node:fs/promises';import path from 'node:path';import {parseArgs} from 'node:util';
import {ROOT,start} from './server.mjs';import {runBatch,runProject} from './pipeline.mjs';import {exportViewer} from './export.mjs';import {SCENE_SCHEMA} from './scene.mjs';
const usage=`Porta House — URL to an interactive house model

node src/cli.mjs collect URL [--out ./data] [--asset plan.jpg] [--video tour.mp4]
node src/cli.mjs generate URL [--out ./data] [--model gpt-4.1]
node src/cli.mjs batch urls.txt [--generate] [--out ./data]
node src/cli.mjs render PROJECT_DIR [--scene corrected.json] [--out house.html]
node src/cli.mjs schema [--out scene.schema.json]
node src/cli.mjs serve [--port 4318]

--refresh re-downloads sources. --no-browser skips HTML floor-plan viewers.
Generation sends collected evidence to OpenAI; OPENAI_API_KEY is required.
Collection and rendering existing scenes do not require a key.`;
try{
 const {values:v,positionals:p}=parseArgs({allowPositionals:true,options:{out:{type:'string'},model:{type:'string'},port:{type:'string'},scene:{type:'string'},asset:{type:'string',multiple:true},video:{type:'string'},generate:{type:'boolean'},refresh:{type:'boolean'},'no-browser':{type:'boolean'},help:{type:'boolean'}}});
 const [cmd,arg]=p;if(v.help||!cmd){console.log(usage);}else{
 const options={model:v.model,generate:cmd==='generate'||Boolean(v.generate),refresh:v.refresh,browser:!v['no-browser'],assets:v.asset||[],video:v.video,onState:s=>console.log(s.status+': '+s.message)};
 if(['collect','generate'].includes(cmd)){if(!arg)throw new Error('A property URL is required.');console.log(JSON.stringify(await runProject(arg,path.resolve(v.out||path.join(ROOT,'data')),options),null,2));}
 else if(cmd==='batch'){if(!arg)throw new Error('A URL list file is required.');const urls=(await fs.readFile(arg,'utf8')).split(/\r?\n/).filter(u=>u.trim()&&!u.trim().startsWith('#'));const report=await runBatch(urls,path.resolve(v.out||path.join(ROOT,'data')),options);console.table(report.map(({url,status,message})=>({url,status,message})));if(report.some(r=>r.status==='failed'))process.exitCode=1;}
 else if(cmd==='render'){if(!arg)throw new Error('A project directory is required.');const directory=path.resolve(arg);const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));const scene=JSON.parse(await fs.readFile(path.resolve(v.scene||path.join(directory,'scene.json')),'utf8'));console.log(await exportViewer(scene,manifest,directory,path.resolve(v.out||path.join(directory,'house.html'))));}
 else if(cmd==='schema'){const out=path.resolve(v.out||'scene.schema.json');await fs.writeFile(out,JSON.stringify(SCENE_SCHEMA,null,2));console.log(out);}
 else if(cmd==='serve')await start({port:Number(v.port||4318),dataDir:v.out?path.resolve(v.out):undefined});
 else throw new Error('Unknown command.\n'+usage);
 }
}catch(e){console.error(e.message);process.exitCode=1;}
