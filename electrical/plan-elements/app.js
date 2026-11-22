(() => {
'use strict';
const $ = id => document.getElementById(id);
const kinds = {lamp:'Ponto de luz',wall:'Luminária de parede',btn:'Comando',blind:'Estor',fan:'Ventilador',sock:'Tomada',tr:'Toalheiro',ev:'Carregador VE',hvac:'Equipamento AVAC',ac:'Unidade AC',data:'Dados RJ45',tv:'TV / coaxial',ms:'Sensor',ap:'Ponto de acesso'};
const layers = {lamp:'light',wall:'light',btn:'light',blind:'light',fan:'light',sock:'power',tr:'power',ev:'power',hvac:'power',ac:'power',data:'ited',tv:'ited',ms:'ited',ap:'ited'};
const colors = {light:'#174ca4',power:'#b52525',ited:'#087643'};
const key = 'casa-plan-editor-v3';
const copy = value => JSON.parse(JSON.stringify(value));
let points = copy(PLAN_DATA.points), selected = null, adding = false, drag = null;
try { const saved = JSON.parse(localStorage.getItem(key)); if (Array.isArray(saved) && saved.every(valid)) points = saved; } catch (_) {}
function valid(p) { return p && typeof p.id === 'string' && ['g','s'].includes(p.floor) && kinds[p.kind] && Number.isFinite(p.x) && Number.isFinite(p.y); }
function persist() { try { localStorage.setItem(key, JSON.stringify(points)); } catch (_) { $('hint').textContent = 'Não foi possível guardar no navegador. Guarde o ficheiro de projeto.'; } }
for (const [key, name] of Object.entries(kinds)) $('kind').add(new Option(name,key));
const svgNS = 'http://www.w3.org/2000/svg';
function node(name,attrs) { const el = document.createElementNS(svgNS,name); for(const [k,v] of Object.entries(attrs)) el.setAttribute(k,v); return el; }
function render() {
 $('background').setAttribute('href', $('floor').value + '.png'); $('points').replaceChildren();
 // sancas por baixo, para não taparem os elementos pequenos que ficam dentro do seu contorno
 const order=[...points].sort((a,b)=>(b.svg&&Number.isFinite(b.length)?1:0)-(a.svg&&Number.isFinite(a.length)?1:0));
 for (const p of order) {
  if (p.floor !== $('floor').value || ($('origin').value === 'arq' && !String(p.origin).startsWith('arquitetura')) || ($('origin').value === 'add' && p.origin !== 'projeto') || ($('origin').value === 'div' && p.origin !== 'projeto-divergente') || ($('origin').value === 'base' && p.origin === 'projeto-divergente') || ($('layer').value !== 'all' && layers[p.kind] !== $('layer').value)) continue;
  const g = node('g',{class:'point'+(p === selected?' selected':''),transform:`translate(${p.x} ${p.y})`,tabindex:'0',role:'button','aria-label':`${kinds[p.kind]} ${p.id}`});
  const color=colors[layers[p.kind]];
  if (p.svg) {
   // elemento da arquitetura: símbolo, etiqueta e letra do DWG, agrupados
   const art=node('g',{stroke:'#e8141c',fill:'none'}); art.innerHTML=p.svg; g.append(art);
   if (Number.isFinite(p.length)) { const grip=node('g',{class:'grip'}); grip.innerHTML=p.svg; g.append(grip); }   // sanca: agarra-se pela linha
   const extra=String(p.ref||'').split(' / ')[1];
   if (extra) { const t=node('text',{x:6,y:12,fill:color,'font-size':5}); t.textContent=extra; g.append(t); }
  } else {
   if (Number.isFinite(p.length) && Number.isFinite(p.angle)) g.append(node('line',{x1:-p.length/2,y1:0,x2:p.length/2,y2:0,transform:`rotate(${p.angle})`,stroke:color,'stroke-width':3}));
   g.append(node('circle',{r:8,fill:'white',stroke:color,'stroke-width':2,'stroke-dasharray':!String(p.origin).startsWith('arquitetura')?'3 2':'none'}));
   const symbol=node('text',{x:0,y:3,'text-anchor':'middle',fill:color,'font-size':8}); symbol.textContent=({lamp:'×',wall:'AP',btn:'B',blind:'M',fan:'F',sock:'T',tr:'TR',ev:'VE',hvac:'A',ac:'AC',data:'D',tv:'C',ms:'S',ap:'AP'})[p.kind]; g.append(symbol);
   const text=node('text',{x:10,y:-6,fill:color}); text.textContent=p.ref || p.id; g.append(text);
  }
  g.addEventListener('pointerdown', e => { if(adding) return; e.preventDefault(); e.stopPropagation(); selected=p; show(); render(); const at=position(e); drag={p, pointer:e.pointerId, dx:p.x-at.x, dy:p.y-at.y}; $('plan').setPointerCapture(e.pointerId); });
  g.addEventListener('keydown', e => { if(e.key==='Enter' || e.key===' ') {e.preventDefault(); selected=p; show(); render();} });
  $('points').append(g);
  if (p.svg && !Number.isFinite(p.length)) {   // área de seleção = caixa do grupo
   const b=g.getBBox(); g.prepend(node('rect',{x:b.x-1.5,y:b.y-1.5,width:b.width+3,height:b.height+3,class:'hit'}));
  }
 }
}
function show() {
 $('empty').hidden=!!selected; $('properties').hidden=!selected;
 if (!selected) return;
 $('kind').value=selected.kind; $('ref').value=selected.ref || selected.id; $('circ').value=selected.circ || ''; $('height').value=selected.h ?? ''; $('description').value=selected.label || ''; $('origin-info').textContent=({arquitetura:'Origem: desenho de arquitetura 01.02/01.03.','arquitetura+projeto':'Origem: arquitetura, completado com os dados do projeto ELE/ITED.','projeto-divergente':'Origem: projeto ELE/ITE, mas a arquitetura desenha outra posição nesta divisão (oculto por defeito).',projeto:'Origem: acrescentado do projeto ELE.5 / ITE.4 (não existe no desenho de arquitetura).',utilizador:'Origem: criado por si.'})[selected.origin]||'';
}
function position(e) { const pt=$('plan').createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY; const p=pt.matrixTransform($('plan').getScreenCTM().inverse()); return {x:Math.round(Math.max(0,Math.min(815,p.x))*10)/10,y:Math.round(Math.max(0,Math.min(1270,p.y))*10)/10}; }
$('plan').addEventListener('pointerdown', e => {
 if(!adding) return;
 const kind=({light:'lamp',power:'sock',ited:'data'})[$('layer').value] || 'lamp';
 const p={id:'novo-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),ref:'Novo ponto',origin:'utilizador',floor:$('floor').value,kind,label:'',circ:'',h:null,...position(e)};
 points.push(p); selected=p; adding=false; $('add').classList.remove('active'); $('hint').textContent='Selecione ou arraste um ponto para alterar a posição.'; persist(); show(); render();
});
$('plan').addEventListener('pointermove', e => { if(!drag || e.pointerId!==drag.pointer) return; const at=position(e); drag.p.x=Math.round((at.x+drag.dx)*10)/10; drag.p.y=Math.round((at.y+drag.dy)*10)/10; render(); });
$('plan').addEventListener('pointerup', e => { if(drag && e.pointerId===drag.pointer) {drag=null; persist();} });
$('plan').addEventListener('pointercancel', () => { if(drag) {drag=null; persist();} });
$('properties').addEventListener('submit',e => {e.preventDefault(); if(!selected)return; selected.kind=$('kind').value; selected.ref=$('ref').value.trim(); selected.circ=$('circ').value.trim(); selected.h=$('height').value===''?null:Number($('height').value); selected.label=$('description').value.trim(); persist(); render(); });
$('delete').addEventListener('click',()=>{if(!selected)return; if(!confirm('Apagar este elemento (símbolo, etiqueta e letra)?'))return; points=points.filter(p=>p!==selected);selected=null;persist();show();render();});
$('add').addEventListener('click',()=>{adding=!adding;$('add').classList.toggle('active',adding);$('hint').textContent=adding?'Clique na planta para colocar o novo ponto. O tipo pode ser alterado nas propriedades.':'Selecione ou arraste um ponto para alterar a posição.';});
for(const id of ['floor','layer','origin']) $(id).addEventListener('change',()=>{selected=null;adding=false;$('add').classList.remove('active');show();render();});
$('save').addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({version:1,points},null,2)],{type:'application/json'}));a.download='plantas-ele-ited.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
$('load').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.points)||!data.points.every(valid))throw Error();points=data.points;selected=null;persist();show();render();}catch(_){alert('Ficheiro de projeto inválido.');}e.target.value='';});
$('reset').addEventListener('click',()=>{if(!confirm('Repor os pontos originais? Guarde primeiro o seu projeto se quiser conservar as alterações.'))return;points=copy(PLAN_DATA.points);selected=null;persist();show();render();});
$('download').addEventListener('click',()=>window.exportPlan(points,{g:new URL('g.png',location.href).href,s:new URL('s.png',location.href).href}));
show();render();
})();
