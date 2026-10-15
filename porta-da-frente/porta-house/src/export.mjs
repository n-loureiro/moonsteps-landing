import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {validateScene} from './scene.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const safeJson=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const escapeHtml=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function exportViewer(scene,manifest,directory,target){
 validateScene(scene,manifest);const evidence=[];
 for(const a of manifest.assets.filter(a=>a.status==='downloaded')){
  if(!/^assets\/[\w.-]+$/.test(a.file))throw new Error('Invalid asset file path');
  const root=await fs.realpath(directory),file=await fs.realpath(path.join(directory,a.file));if(!file.startsWith(root+path.sep))throw new Error('Asset outside project directory');
  const bytes=await fs.readFile(file);const mime=a.format==='pdf'?'application/pdf':`image/${a.format==='jpg'?'jpeg':a.format}`;
  evidence.push({id:a.id,kind:a.kind,label:a.label||null,format:a.format,url:a.url||null,data:`data:${mime};base64,${bytes.toString('base64')}`});
 }
 const files=await Promise.all(['viewer.html','editorial.css','viewer.css','viewer.bundle.js'].map(f=>fs.readFile(path.join(ROOT,'web',f),'utf8')));
 const [template,css,viewerCss,js]=files;
 const values={TITLE:escapeHtml(scene.title),EDITORIAL_CSS:css,VIEWER_CSS:viewerCss,PROJECT_DATA:safeJson({scene,manifest,evidence}),VIEWER_JS:js.replace(/<\/script/gi,'<\\/script')};
 const html=template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>values[key]??'');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target+'.tmp',html);await fs.rename(target+'.tmp',target);return target;
}
