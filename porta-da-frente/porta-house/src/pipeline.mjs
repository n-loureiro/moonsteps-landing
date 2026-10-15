import fs from 'node:fs/promises';import path from 'node:path';
import {collect,listingKey,writeJson,addLocalAsset} from './collect.mjs';import {interpret} from './interpret.mjs';import {exportViewer} from './export.mjs';import {addVideoFrames} from './video.mjs';
export async function runProject(url,dataDir,options={}){
 const id=listingKey(url),directory=path.join(dataDir,id);let state={id,url,status:'collecting',message:'Reading source material',updatedAt:new Date().toISOString()};
 const update=async(status,message)=>{state={...state,status,message,updatedAt:new Date().toISOString()};await writeJson(path.join(directory,'state.json'),state);options.onState?.(state);};
 try{
  await update('collecting','Collecting listing sources');
  let manifest=await collect(url,directory,{...options,log:message=>{state.message=message;options.onState?.({...state});}});
  for(const f of options.assets||[])manifest=await addLocalAsset(manifest,directory,f);
  if(options.video)manifest=await addVideoFrames(manifest,directory,options.video);
  if(!options.generate){await update('collected','Sources collected. Import scene JSON or generate a model.');return {...state,directory};}
  await update('interpreting','Interpreting photos and floor plans');
  const scene=await interpret(manifest,directory,{...options,log:message=>options.onState?.({...state,message})});
  await update('rendering','Building portable viewer');await exportViewer(scene,manifest,directory,path.join(directory,'house.html'));
  await update('ready','House model ready for review');return {...state,directory};
 }catch(e){await update('failed',e.message);throw e;}
}
export async function runBatch(urls,dataDir,options={}){
 const report=[];
 for(const url of [...new Set(urls.map(u=>u.trim()).filter(Boolean))]){
  try{report.push(await runProject(url,dataDir,options));}catch(e){report.push({url,status:'failed',message:e.message});}
 }
 await writeJson(path.join(dataDir,'batch-report.json'),report);return report;
}
