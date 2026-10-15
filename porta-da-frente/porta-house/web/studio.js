const $=s=>document.querySelector(s);let configured=false,currentId=null,currentProject=null,polling=false;
async function api(url,options){const r=await fetch(url,options);const body=await r.json();if(!r.ok)throw new Error(body.error||'Request failed');return body;}
function text(node,value){node.textContent=value;}
async function status(){const s=await api('/api/status');configured=s.apiConfigured;$('#generate').disabled=!configured;text($('#configuration'),configured?`Automatic generation is configured · ${s.model}. Each generated property uses your API account.`:'Automatic generation needs an API key. You can collect sources, explore the example, and import scene JSON now.');}
async function submit(generate){
 const urls=$('#urls').value.split(/\r?\n/).map(u=>u.trim()).filter(Boolean);if(!urls.length){text($('#feedback'),'Paste at least one property URL.');return;}
 try{const r=await api('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({urls,generate})});text($('#feedback'),`${r.ids.length} property job(s) queued. Progress appears in your library.`);await library();}catch(e){text($('#feedback'),e.message);}
}
$('#generate-form').onsubmit=e=>{e.preventDefault();submit(true);};$('#collect').onclick=()=>submit(false);
async function library(){
 if(polling)return;polling=true;
 try{const entries=await api('/api/library');const list=$('#library-list');list.replaceChildren();if(!entries.length){const p=document.createElement('p');p.className='small';p.textContent='No properties collected yet. Paste a listing above to start.';list.append(p);}
 for(const e of entries){const row=document.createElement('div');row.className='library-row';const desc=document.createElement('div');const title=document.createElement('strong');title.textContent=e.title;const state=document.createElement('span');state.className='state';state.textContent=e.status;const note=document.createElement('span');note.textContent=e.message;desc.append(title,state,note);const actions=document.createElement('div');const b=document.createElement('button');b.textContent='Inspect sources';b.disabled=['queued','collecting'].includes(e.status);b.onclick=()=>review(e.id);actions.append(b);
 if(e.hasViewer){const a=document.createElement('a');a.className='pill';a.href='/api/projects/'+e.id+'/viewer';a.target='_blank';a.textContent='Open 3D ↗';a.style.marginLeft='6px';actions.append(a);}row.append(desc,actions);list.append(row);}
 }catch(e){text($('#feedback'),e.message);}finally{polling=false;}
}
async function review(id){
 try{const p=await api('/api/projects/'+id);currentId=id;currentProject=p;const m=p.manifest;text($('#review-code'),m.listing.code||id);text($('#review-title'),m.listing.title);text($('#review-summary'),m.listing.description.slice(0,600));text($('#review-warnings'),[...(m.warnings||[]),m.video?.note].filter(Boolean).join(' '));const assets=$('#review-assets');assets.replaceChildren();
 for(const a of [...m.assets].sort((a,b)=>(a.kind==='plan'?-1:0)-(b.kind==='plan'?-1:0))){const b=document.createElement('button');b.className=a.kind==='plan'?'plan':'';const s=document.createElement('span');s.textContent=a.id+' · '+a.kind+(a.status==='failed'?' · '+a.error:'');if(a.status==='downloaded'){
 const url='/api/projects/'+id+'/asset?id='+encodeURIComponent(a.id);if(a.format!=='pdf'){const im=document.createElement('img');im.src=url;im.alt=a.id;im.loading='lazy';b.append(im);}b.onclick=()=>{text($('#source-caption'),a.id+' · '+a.kind);const body=$('#source-body');body.replaceChildren();const el=document.createElement(a.format==='pdf'?'iframe':'img');el.src=url;if(el.tagName==='IMG')el.alt=a.id;else el.title=a.id;body.append(el);$('#source-dialog').showModal();};}else b.disabled=true;b.append(s);assets.append(b);}
 $('#scene-editor').value=p.scene?JSON.stringify(p.scene,null,2):'';text($('#scene-feedback'),p.scene?'Edit then rebuild to update the viewer.':'No scene yet. Generate a model with the API, or import a manually prepared scene.');$('#open-viewer').hidden=!p.scene;$('#open-viewer').href='/api/projects/'+id+'/viewer';setTab('sources');$('#review-dialog').showModal();
 }catch(e){text($('#feedback'),e.message);}
}
function setTab(tab){$('#sources-tab').setAttribute('aria-pressed',String(tab==='sources'));$('#scene-tab').setAttribute('aria-pressed',String(tab==='scene'));$('#source-view').hidden=tab!=='sources';$('#scene-view').hidden=tab!=='scene';}
$('#sources-tab').onclick=()=>setTab('sources');$('#scene-tab').onclick=()=>setTab('scene');$('#close-review').onclick=()=>$('#review-dialog').close();$('#close-source').onclick=()=>$('#source-dialog').close();
$('#scene-file').onchange=async e=>{const f=e.target.files?.[0];if(f){if(f.size>2*1024*1024){text($('#scene-feedback'),'Scene exceeds 2 MB.');return;}$('#scene-editor').value=await f.text();}};
$('#render-scene').onclick=async()=>{
 try{const scene=JSON.parse($('#scene-editor').value);text($('#scene-feedback'),'Validating geometry and rebuilding…');const r=await api('/api/projects/'+currentId+'/scene',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(scene)});text($('#scene-feedback'),'Viewer rebuilt. Open the 3D viewer to check it.');$('#open-viewer').href=r.viewer;$('#open-viewer').hidden=false;await library();}catch(e){text($('#scene-feedback'),e.message);}
};
status().catch(e=>text($('#configuration'),e.message));library();setInterval(library,2500);
