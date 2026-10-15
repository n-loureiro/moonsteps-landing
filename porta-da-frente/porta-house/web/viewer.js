import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const project=JSON.parse(document.querySelector('#project-data').textContent);
const data=project.scene, manifest=project.manifest;
const $=s=>document.querySelector(s);
const txt=(s,v)=>$(s).textContent=v;
txt('#reference',(manifest.listing.code||'Property study')+' / '+(manifest.listing.location||''));txt('#title',data.title);txt('#summary',data.summary);
const sourceLink=$('#listing-link');try{const u=new URL(manifest.listing.url);if(u.protocol==='https:')sourceLink.href=u.href;}catch{sourceLink.hidden=true;}
for(const [key,label,unit] of [['bedrooms','Bedrooms',''],['privateArea','Private area',' m²'],['grossBuildArea','Built area',' m²'],['landArea','Plot',' m²']]){
 const n=manifest.listing.facts?.[key];if(n){const el=document.createElement('div');const b=document.createElement('strong');b.textContent=n.toLocaleString()+unit;const s=document.createElement('span');s.textContent=label;el.append(b,s);$('#facts').append(el);}
}
for(const l of data.limitations){const li=document.createElement('li');li.textContent=l;$('#limitations').append(li);}
for(const l of data.levels){const opt=document.createElement('option');opt.value=l.id;opt.textContent=l.name;$('#level').append(opt);}
const visibleLayers={site:true,floors:true,walls:true,roof:true,furniture:true};
for(const [key,label] of Object.entries({roof:'Roof',walls:'Walls',floors:'Floor slabs',furniture:'Furniture',site:'Garden & site'})){
 const row=document.createElement('label');row.className='layer-row';row.textContent=label;const check=document.createElement('input');check.type='checkbox';check.checked=true;check.id='layer-'+key;check.addEventListener('change',()=>{visibleLayers[key]=check.checked;refreshVisibility();});row.append(check);$('#layers').append(row);
}
const evidence=new Map(project.evidence.map(a=>[a.id,a]));
function showEvidence(id){
 const e=evidence.get(id);if(!e)return;txt('#image-caption',(e.label||e.id)+' · '+e.kind);const body=$('#image-body');body.replaceChildren();
 if(e.data?.startsWith('data:image/')){const im=document.createElement('img');im.src=e.data;im.alt=e.id;body.append(im);}
 else if(e.data?.startsWith('data:application/pdf;')){const f=document.createElement('iframe');f.src=e.data;f.title=e.id;body.append(f);}
 if(e.url){try{const u=new URL(e.url);if(u.protocol==='https:'){const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noreferrer';a.textContent='Open original source ↗';body.append(a);}}catch{}}
 $('#image-dialog').showModal();
}
$('#close-image').onclick=()=>$('#image-dialog').close();
const sourceButtons=[...document.querySelectorAll('[data-open-sources]')];let sourceOpener;
for(const button of sourceButtons)button.onclick=()=>{sourceOpener=button;$('#evidence-panel').hidden=false;$('#evidence-panel').scrollTop=0;sourceButtons.forEach(b=>b.setAttribute('aria-expanded','true'));};
$('#close-sources').onclick=()=>{$('#evidence-panel').hidden=true;sourceButtons.forEach(b=>b.setAttribute('aria-expanded','false'));sourceOpener?.focus();};
const downloads=manifest.assets.filter(a=>a.status==='downloaded').length;
const plans=project.evidence.filter(a=>a.kind==='plan').length,photos=project.evidence.filter(a=>a.kind==='photo').length;
txt('#source-count',`${plans} blueprint${plans===1?'':'s'} · ${photos} photos`);
txt('#source-note',`${downloads} collected assets. ${manifest.video?.note||''} ${(manifest.warnings||[]).join(' ')}`);
const sourceRank={plan:0,supplement:1,photo:2,'video-frame':3};
for(const e of [...project.evidence].sort((a,b)=>(sourceRank[a.kind]??4)-(sourceRank[b.kind]??4))){
 const button=document.createElement('button');button.className='evidence-item '+(e.kind==='plan'?'plan':'');button.onclick=()=>showEvidence(e.id);
 if(e.data?.startsWith('data:image/')){const im=document.createElement('img');im.src=e.data;im.loading='lazy';im.alt=e.id;button.append(im);}
 const span=document.createElement('span');span.textContent=(e.label||e.id)+' · '+e.kind+(e.format==='pdf'?' · PDF':'');button.append(span);$('#evidence-list').append(button);
}
function download(value,name,type){const url=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#download-scene').onclick=()=>download(JSON.stringify(data,null,2),(manifest.listing.code||'house')+'-scene.json','application/json');

const wrap=$('#canvas-wrap'),world=new THREE.Scene();world.background=new THREE.Color('#f6f7f3');
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:false});}
catch{txt('#load-status','This browser could not start WebGL. Try a browser with 3D acceleration enabled.');throw new Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;wrap.append(renderer.domElement);
world.add(new THREE.HemisphereLight('#fcfff5','#b4b39f',2.5));
const sun=new THREE.DirectionalLight('#fff4d9',3.4);sun.position.set(-25,45,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;sun.shadow.camera.far=150;sun.shadow.bias=-.0002;sun.shadow.normalBias=.04;world.add(sun);
const fill=new THREE.DirectionalLight('#e8f0ff',1);fill.position.set(20,15,-30);world.add(fill);
const camera=new THREE.OrthographicCamera(-25,25,20,-20,.1,500);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.maxPolarAngle=Math.PI*.49;controls.minZoom=.3;controls.maxZoom=15;controls.target.set(0,1,0);
const roots=[];let selected=null;const highlight=new THREE.BoxHelper(undefined,'#7c9471');highlight.visible=false;world.add(highlight);
const materials=new Map();
function mat(color,{glass=false}={}){const key=color+glass;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:glass?.18:.82,metalness:glass?.08:0,transparent:glass,opacity:glass?.42:1,side:THREE.DoubleSide}));return materials.get(key);}
function box(g,w,h,d,x,y,z,color,glass=false){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,{glass}));m.position.set(x,y+h/2,z);m.castShadow=!glass;m.receiveShadow=true;g.add(m);return m;}
function cylinder(g,r1,r2,h,x,y,z,color,n=16){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,n),mat(color));m.position.set(x,y+h/2,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function sphere(g,x,y,z,sx,sy,sz,color){const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function slab(g,points,h,color){const shape=new THREE.Shape();shape.moveTo(points[0][0],-points[0][1]);for(const p of points.slice(1))shape.lineTo(p[0],-p[1]);shape.closePath();const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false}),mat(color));mesh.rotation.x=-Math.PI/2;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
function wall(g,o){
 const [w,h,t]=o.size,ops=o.openings;
 const xs=[-w/2,w/2,...ops.flatMap(a=>[a.offset-a.width/2,a.offset+a.width/2])].sort((a,b)=>a-b);
 for(let i=0;i<xs.length-1;i++){
  const left=xs[i],right=xs[i+1];if(right-left<.001)continue;const active=ops.filter(a=>(left+right)/2>a.offset-a.width/2-.001&&(left+right)/2<a.offset+a.width/2+.001).sort((a,b)=>a.sill-b.sill);let y=0;
  for(const a of active){if(a.sill>y+.001)box(g,right-left,a.sill-y,t,(left+right)/2,y,0,o.color);y=a.sill+a.height;}
  if(y<h-.001)box(g,right-left,h-y,t,(left+right)/2,y,0,o.color);
 }
 for(const a of ops){
  const frame='#c5c8bd',fw=.045;
  for(const x of [a.offset-a.width/2+fw/2,a.offset+a.width/2-fw/2])box(g,fw,a.height,t+.025,x,a.sill,0,frame);
  for(const y of [a.sill,a.sill+a.height-fw])box(g,a.width,fw,t+.025,a.offset,y,0,frame);
  if(a.type==='window'){
   box(g,a.width-2*fw,a.height-2*fw,.025,a.offset,a.sill+fw,0,'#8ba9ab',true);
   if(a.width>1.4)box(g,fw,a.height,t+.03,a.offset,a.sill,0,frame);
  }
 }
}
function roof(g,o){
 const [w,h,d]=o.size,verts=[];const a=[-w/2,0,-d/2],b=[w/2,0,-d/2],c=[w/2,0,d/2],e=[-w/2,0,d/2];
 let r1,r2;if(w>=d){r1=[-w/2+Math.min(d/2,w*.45),h,0];r2=[w/2-Math.min(d/2,w*.45),h,0];}else{r1=[0,h,-d/2+Math.min(w/2,d*.45)];r2=[0,h,d/2-Math.min(w/2,d*.45)];}
 const tri=(...v)=>verts.push(...v.flat());
 if(o.kind==='gable_roof'){if(w>=d){r1=[-w/2,h,0];r2=[w/2,h,0];tri(a,b,r2,a,r2,r1,e,r1,r2,e,r2,c,a,r1,e,b,c,r2);}else{r1=[0,h,-d/2];r2=[0,h,d/2];tri(a,r1,r2,a,r2,e,b,c,r2,b,r2,r1,a,b,r1,e,r2,c);}}
 else if(w>=d)tri(a,b,r2,a,r2,r1,e,r1,r2,e,r2,c,a,r1,e,b,c,r2);else tri(a,r1,r2,a,r2,e,b,c,r2,b,r2,r1,a,b,r1,e,r2,c);
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geom.computeVertexNormals();const mesh=new THREE.Mesh(geom,mat(o.color));mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);box(g,w,.13,d,0,-.13,0,'#e6dec9');
 // Tile courses follow each sloping surface. They make roof structure legible without external textures.
 if(o.kind==='hip_roof'){
  const lines=[];const n=Math.max(4,Math.round(h/.14));
  for(let i=1;i<n;i++){const t=i/n;const corners=[a,b,c,e].map(v=>[v[0]*(1-t),h*t,v[2]*(1-t)]);if(w>=d){corners[0][0]+=r1[0]*t;corners[1][0]+=r2[0]*t;corners[2][0]+=r2[0]*t;corners[3][0]+=r1[0]*t;}else{corners[0][2]+=r1[2]*t;corners[1][2]+=r1[2]*t;corners[2][2]+=r2[2]*t;corners[3][2]+=r2[2]*t;}
   for(let j=0;j<4;j++)lines.push(...corners[j].map((v,k)=>k===1?v+.008:v),...corners[(j+1)%4].map((v,k)=>k===1?v+.008:v));}
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));g.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:'#804d39',transparent:true,opacity:.23})));
 }
}
function tracedRoof(g,o){
 const positions=o.points.flat();const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geom.computeVertexNormals();
 const mesh=new THREE.Mesh(geom,mat(o.color));mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
 g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom,2),new THREE.LineBasicMaterial({color:'#704633',transparent:true,opacity:.23})));
 if(o.size[1]<.4)return;
 const lines=[];
 for(let y=.12;y<o.size[1];y+=.12)for(let i=0;i<o.points.length;i+=3){
  const face=o.points.slice(i,i+3),hits=[];
  for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3];if((a[1]<y&&b[1]>=y)||(b[1]<y&&a[1]>=y)){const t=(y-a[1])/(b[1]-a[1]);hits.push([a[0]+t*(b[0]-a[0]),y+.008,a[2]+t*(b[2]-a[2])]);}}
  if(hits.length===2)lines.push(...hits.flat());
 }
 const courses=new THREE.BufferGeometry();courses.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));g.add(new THREE.LineSegments(courses,new THREE.LineBasicMaterial({color:'#804d39',transparent:true,opacity:.18})));
}
function furniture(g,o){
 const [w,h,d]=o.size,col=o.color,wood='#a9825e',cream='#eee7db';
 if(o.kind==='bed'){box(g,w,h*.35,d,0,0,0,wood);box(g,w*.98,h*.5,d*.97,0,h*.35,0,cream);box(g,w,.95,.13,0,0,-d/2,wood);for(const x of [-w*.24,w*.24])box(g,w*.42,.13,d*.23,x,h*.85,-d*.28,'#fffaf0');box(g,w*.99,.025,d*.36,0,h*.86,d*.25,col);}
 if(o.kind==='sofa'){box(g,w,h*.4,d,0,.12,0,col);box(g,w,h*.72,d*.22,0,h*.28,-d*.39,col);for(const x of [-w*.46,w*.46])box(g,w*.08,h*.65,d,x,h*.15,0,col);for(const x of [-w*.24,w*.24])box(g,w*.42,h*.12,d*.7,x,h*.5,d*.04,cream);}
 if(o.kind==='table'||o.kind==='chair'){
  box(g,w,.09,d,0,h-.09,0,col);const leg=o.kind==='chair'?.055:.09;for(const x of [-w*.39,w*.39])for(const z of [-d*.37,d*.37])box(g,leg,h-.08,leg,x,0,z,wood);
  if(o.kind==='chair')box(g,w,h*.7,.07,0,h,-d*.44,col);
 }
 if(o.kind==='kitchen'){
  box(g,w,h-.05,d,0,0,0,col);box(g,w+.05,.05,d+.06,0,h-.05,0,cream);
  const n=Math.max(1,Math.round(w/.55));for(let i=1;i<n;i++)box(g,.012,h*.9,.012,-w/2+w*i/n,.02,d/2+.008,'#715b45');
  box(g,.48,.012,.32,-w*.22,h+.005,0,'#697875');box(g,.06,.2,.06,-w*.22,h,0,'#c0c8c3');
 }
}
function build(o){
 const g=new THREE.Group();g.userData.object=o;const [w,h,d]=o.size;
 if(o.kind==='wall')wall(g,o);
 else if(o.kind==='roof_mesh')tracedRoof(g,o);
 else if(['hip_roof','gable_roof'].includes(o.kind))roof(g,o);
 else if(o.kind==='slab')o.points.length?slab(g,o.points,h,o.color):box(g,w,h,d,0,0,0,o.color);
 else if(o.kind==='pool'){
  const p=o.points.length?o.points:[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];slab(g,p,h,'#d5d8c9');const inner=p.map(([x,z])=>[x*.89,z*.89]);const water=slab(g,inner,.035,'#6bafb8');water.position.y=h+.012;
 }
 else if(o.kind==='tree'){cylinder(g,.12,.2,h*.8,0,0,0,'#8a7961',10);for(const [x,z,s] of [[0,0,1],[-.2,.14,.72],[.22,.05,.73]])sphere(g,w*x,h*.86,d*z,w*.48*s,h*.14*s,d*.48*s,o.color);}
 else if(['sofa','bed','table','chair','kitchen'].includes(o.kind))furniture(g,o);
 else if(o.kind==='stairs'){const n=Math.max(2,Math.ceil(h/.17));for(let i=0;i<n;i++)box(g,w,h*(i+1)/n,d/n,0,0,-d/2+d*(i+.5)/n,o.color);}
 else if(o.kind==='cylinder')cylinder(g,w/2,w/2,h,0,0,0,o.color);
 else box(g,w,h,d,0,0,0,o.color);
 g.position.fromArray(o.position);g.rotation.y=THREE.MathUtils.degToRad(o.rotation);world.add(g);roots.push(g);return g;
}
for(const o of data.objects)build(o);
const houseBox=new THREE.Box3();for(const g of roots.filter(g=>g.userData.object.layer!=='site'))houseBox.expandByObject(g);
const siteBox=new THREE.Box3();for(const g of roots)siteBox.expandByObject(g);
const centre=houseBox.getCenter(new THREE.Vector3()),span=houseBox.getSize(new THREE.Vector3());let view='exterior';let scale=Math.max(span.x,span.z)*.9;
const mainLevel=[...data.levels].sort((a,b)=>b.elevation-a.elevation)[0];
function refreshVisibility(){
 const floor=$('#level').value;
 for(const g of roots){const o=g.userData.object;g.visible=visibleLayers[o.layer]&&(floor==='all'||o.level===floor||o.level==='site');}
 if(selected&&!selected.visible){highlight.visible=false;$('#object-info').hidden=true;selected=null;}
}
function setView(next){
 view=next;for(const el of document.querySelectorAll('[data-view]'))el.setAttribute('aria-pressed',String(el.dataset.view===next));
 txt('#view-name',next==='plan'?'Floor plan / approximate':next==='roof'?'Roof / overhead':next==='garden'?'Garden & site':'Exterior');
 controls.enableRotate=!['plan','roof'].includes(next);camera.zoom=1;
 const c=centre.clone();scale=Math.max(span.x,span.z)*.82;
 if(['plan','roof'].includes(next)){
  visibleLayers.roof=next==='roof';$('#layer-roof').checked=visibleLayers.roof;$('#level').value=next==='plan'?mainLevel.id:'all';c.y=mainLevel.elevation;camera.position.set(c.x,c.y+70,c.z+.001);controls.target.copy(c);scale=Math.max(span.x,span.z)*.65;
 }else{
  if(next==='exterior'){visibleLayers.roof=true;$('#layer-roof').checked=true;}
  $('#level').value='all';
  if(next==='garden'){const site=siteBox.getCenter(new THREE.Vector3());c.copy(site);scale=Math.max(siteBox.getSize(new THREE.Vector3()).x,siteBox.getSize(new THREE.Vector3()).z)*.68;}
  camera.position.copy(c).add(new THREE.Vector3(35,29,38));controls.target.copy(c);
 }
 resize();refreshVisibility();controls.update();
}
function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;renderer.setSize(w,h);const aspect=w/h;camera.left=-scale*aspect;camera.right=scale*aspect;camera.top=scale;camera.bottom=-scale;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(wrap);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);$('#reset').onclick=()=>setView(view);$('#level').onchange=()=>{refreshVisibility();};
$('#close-object').onclick=()=>{selected=null;highlight.visible=false;$('#object-info').hidden=true;};
function select(g){selected=g;const o=g.userData.object;highlight.setFromObject(g);highlight.visible=true;txt('#object-confidence',o.confidence+' feature · '+o.layer);txt('#object-title',o.label);txt('#object-notes',o.notes);$('#object-sources').replaceChildren();for(const id of o.sources){if(!evidence.has(id))continue;const b=document.createElement('button');b.textContent=id;b.onclick=()=>showEvidence(id);$('#object-sources').append(b);}$('#object-info').hidden=false;}
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let down;
renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{
 if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);
 const hits=ray.intersectObjects(roots.filter(g=>g.visible),true);if(!hits.length)return;let g=hits[0].object;while(g&&!g.userData.object)g=g.parent;if(g)select(g);
});
setView('exterior');$('#load-status').hidden=true;
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(world,camera);}animate();
