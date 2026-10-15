import {start} from './server.mjs';import {execFile} from 'node:child_process';
try{await start();const url='http://127.0.0.1:'+(process.env.PORT||4318);if(process.platform==='darwin')execFile('open',[url]);console.log('Keep this window open. Press Control-C to stop.');}catch(e){console.error(e.message);process.exitCode=1;}
