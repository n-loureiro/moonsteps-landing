import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {listingKey,writeJson} from './collect.mjs';import {validateListingUrl} from './network.mjs';import {SCENE_SCHEMA,validateScene} from './scene.mjs';import {runProject} from './pipeline.mjs';import {exportViewer} from './export.mjs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function allowedRequest({host,origin}){
 if(!/^127\.0\.0\.1:\d+$/.test(host||''))return false;
 return !origin||origin==='http://'+host;
}
export function displayState(state,isActive){
 if(!isActive&&['queued','collecting','interpreting','rendering'].includes(state.status))return {...state,status:'interrupted',message:'Previous run stopped. Submit this URL again to resume from collected sources.'};return state;
}
export function projectPath(root,id){if(!/^[a-f0-9]{16}$/.test(id))throw new Error('Invalid project ID');return path.join(root,id);}
const exists=f=>fs.access(f).then(()=>true,()=>false);
export function createApp({dataDir=path.join(ROOT,'data')}={}){
 const active=new Map();let queue=Promise.resolve();
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 async function readJson(req){if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Use application/json');let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>2*1024*1024)throw new Error('Request too large');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString());}
 async function file(res,file,type){const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(body);}
 const server=http.createServer(async(req,res)=>{
  try{
   if(!allowedRequest({host:req.headers.host,origin:req.headers.origin})){json(res,403,{error:'Only the local app can access this service.'});return;}
   const url=new URL(req.url,'http://'+req.headers.host),p=url.pathname;
   if(req.method==='GET'&&p==='/'){let html=await fs.readFile(path.join(ROOT,'web/studio.html'),'utf8');html=html.replace('{{EDITORIAL_CSS}}',await fs.readFile(path.join(ROOT,'web/editorial.css'),'utf8'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return;}
   if(req.method==='GET'&&p==='/studio.js'){await file(res,path.join(ROOT,'web/studio.js'),'text/javascript');return;}
   if(req.method==='GET'&&p==='/example'){await file(res,path.join(ROOT,'examples/PF39051/house.html'),'text/html; charset=utf-8');return;}
   if(req.method==='GET'&&p==='/api/status'){json(res,200,{apiConfigured:Boolean(process.env.OPENAI_API_KEY),model:process.env.OPENAI_MODEL||'gpt-4.1'});return;}
   if(req.method==='GET'&&p==='/api/schema'){json(res,200,SCENE_SCHEMA);return;}
   if(req.method==='GET'&&p==='/api/library'){
    await fs.mkdir(dataDir,{recursive:true});const entries=[];
    for(const id of (await fs.readdir(dataDir)).filter(id=>/^[a-f0-9]{16}$/.test(id))){
     const directory=projectPath(dataDir,id);try{const state=active.get(id)||JSON.parse(await fs.readFile(path.join(directory,'state.json'),'utf8'));let title=id;try{title=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8')).listing.title;}catch{}
      entries.push({...displayState(state,active.has(id)),title,hasViewer:await exists(path.join(directory,'house.html'))});}catch{}
    }json(res,200,entries.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));return;
   }
   if(req.method==='POST'&&p==='/api/jobs'){
    const body=await readJson(req);if(!Array.isArray(body.urls)||body.urls.length<1||body.urls.length>30)throw new Error('Provide 1–30 property URLs.');
    const urls=[...new Set(body.urls.map(u=>validateListingUrl(u).href))];if(body.generate&&!process.env.OPENAI_API_KEY)throw new Error('Set OPENAI_API_KEY before automatic generation. You can collect and review sources now.');
    const ids=[];
    for(const u of urls){const id=listingKey(u);ids.push(id);if(active.has(id))continue;
     const state={id,url:u,status:'queued',message:'Waiting to start',updatedAt:new Date().toISOString()};active.set(id,state);await writeJson(path.join(projectPath(dataDir,id),'state.json'),state);
     queue=queue.then(async()=>{try{await runProject(u,dataDir,{generate:Boolean(body.generate),onState:s=>active.set(id,s)});}catch{}finally{active.delete(id);}});
    }
    json(res,202,{ids});return;
   }
   const m=p.match(/^\/api\/projects\/([a-f0-9]{16})(?:\/(scene|viewer|asset))?$/);
   if(m){const id=m[1],action=m[2],directory=projectPath(dataDir,id);const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
    if(req.method==='GET'&&!action){let scene=null;try{scene=JSON.parse(await fs.readFile(path.join(directory,'scene.json'),'utf8'));}catch{}json(res,200,{manifest,scene,state:displayState(active.get(id)||JSON.parse(await fs.readFile(path.join(directory,'state.json'),'utf8')),active.has(id))});return;}
    if(req.method==='GET'&&action==='viewer'){await file(res,path.join(directory,'house.html'),'text/html; charset=utf-8');return;}
    if(req.method==='GET'&&action==='asset'){
     const asset=manifest.assets.find(a=>a.id===url.searchParams.get('id')&&a.status==='downloaded');
     if(!asset||!/^assets\/[\w.-]+$/.test(asset.file))throw new Error('Unknown asset');
     const realRoot=await fs.realpath(directory),real=await fs.realpath(path.join(directory,asset.file));if(!real.startsWith(realRoot+path.sep))throw new Error('Invalid asset path');
     const mime=asset.format==='pdf'?'application/pdf':`image/${asset.format==='jpg'?'jpeg':asset.format}`;await file(res,real,mime);return;
    }
    if(req.method==='PUT'&&action==='scene'){
     if(active.has(id))throw new Error('Wait for this property’s current job to finish.');
     const scene=validateScene(await readJson(req),manifest);await exportViewer(scene,manifest,directory,path.join(directory,'house.html'));await writeJson(path.join(directory,'scene.json'),scene);
     await writeJson(path.join(directory,'state.json'),{id,url:manifest.listing.url,status:'ready',message:'Imported scene rendered',updatedAt:new Date().toISOString()});json(res,200,{viewer:'/api/projects/'+id+'/viewer'});return;
    }
   }
   json(res,404,{error:'Not found'});
  }catch(e){json(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'Project or output not found':e.message});}
 });
 return server;
}
export async function start({port=Number(process.env.PORT||4318),dataDir}={}){
 const app=createApp({dataDir});await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});console.log(`Porta House is ready: http://127.0.0.1:${app.address().port}`);return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)start().catch(e=>{console.error(e.message);process.exitCode=1;});
