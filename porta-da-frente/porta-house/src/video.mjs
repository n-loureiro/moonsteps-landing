import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {addLocalAsset,writeJson} from './collect.mjs';
const run=promisify(execFile);
export async function addVideoFrames(manifest,directory,file){
 const input=path.resolve(file);const frameDir=await fs.mkdtemp(path.join(directory,'video-frames-'));
 try{await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-vf','fps=1/8,scale=1280:-2','-frames:v','24',path.join(frameDir,'frame-%03d.jpg')],{timeout:180000,maxBuffer:1024*1024});}
 catch{throw new Error('Could not sample local video. Install FFmpeg and supply a readable video file.');}
 const files=(await fs.readdir(frameDir)).filter(f=>/^frame-\d+\.jpg$/.test(f)).sort();if(!files.length)throw new Error('No frames could be extracted from that video.');
 for(const f of files)await addLocalAsset(manifest,directory,path.join(frameDir,f),'video-frame');
 manifest.video={...manifest.video,status:'sampled-local-video',note:`${files.length} frames sampled every 8 seconds from a supplied local video (first 192 seconds maximum). Linked online videos are not automatically downloaded; frames do not prove full video inspection.`};
 await writeJson(path.join(directory,'manifest.json'),manifest);return manifest;
}
