import Ajv from 'ajv';
const vec=(n,min=-500,max=500)=>({type:'array',items:{type:'number',minimum:min,maximum:max},minItems:n,maxItems:n});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const text={type:'string',maxLength:4000};
export const SCENE_SCHEMA=object({
 version:{type:'integer',const:1},title:{type:'string',minLength:1,maxLength:240},summary:text,units:{type:'string',const:'metres'},
 limitations:{type:'array',items:text,minItems:1,maxItems:40},
 levels:{type:'array',minItems:1,maxItems:12,items:object({id:{type:'string',pattern:'^[a-zA-Z0-9_-]+$',maxLength:50},name:text,elevation:{type:'number',minimum:-100,maximum:200}})},
 objects:{type:'array',minItems:1,maxItems:1200,items:object({
  id:{type:'string',pattern:'^[a-zA-Z0-9_-]+$',maxLength:80},label:{type:'string',maxLength:160},
  kind:{type:'string',enum:['box','slab','wall','hip_roof','gable_roof','roof_mesh','pool','tree','sofa','bed','table','chair','kitchen','stairs','cylinder']},
  layer:{type:'string',enum:['site','floors','walls','roof','furniture']},level:{type:'string',maxLength:50},position:vec(3),size:vec(3,.01,200),rotation:{type:'number',minimum:-360,maximum:360},color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},
  points:{type:'array',maxItems:1200,items:{anyOf:[vec(2),vec(3)]}},
  openings:{type:'array',maxItems:24,items:object({offset:{type:'number',minimum:-100,maximum:100},width:{type:'number',minimum:.1,maximum:100},height:{type:'number',minimum:.1,maximum:30},sill:{type:'number',minimum:0,maximum:30},type:{type:'string',enum:['window','door']}})},
  confidence:{type:'string',enum:['observed','inferred','unknown']},sources:{type:'array',items:{type:'string',maxLength:80},minItems:1,maxItems:40},notes:text
 })}
});
const validate=new Ajv({allErrors:true,strictNumbers:true}).compile(SCENE_SCHEMA);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function polygonValid(p){
 let area=0;
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length];if(Math.hypot(a[0]-b[0],a[1]-b[1])<.001)return false;area+=a[0]*b[1]-b[0]*a[1];
  for(let j=i+2;j<p.length;j++){
   if(i===0&&j===p.length-1)continue;
   const c=p[j],d=p[(j+1)%p.length];
   if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1])))return false;
  }
 }
 return Math.abs(area)>.01;
}
export function validateScene(scene,manifest){
 if(!validate(scene))throw new Error('Invalid scene: '+new Ajv().errorsText(validate.errors,{separator:'; '}));
 if(!scene.objects.some(o=>o.layer!=='site'&&o.level!=='site'))throw new Error('Scene needs building geometry in addition to the site.');
 const ids=new Set(),levels=new Set(scene.levels.map(l=>l.id));if(levels.size!==scene.levels.length)throw new Error('Duplicate level ID');
 const sources=new Set(['listing',...(manifest?.assets.filter(a=>a.status==='downloaded').map(a=>a.id)||[])]);
 for(const o of scene.objects){
  if(ids.has(o.id))throw new Error('Duplicate object ID: '+o.id);ids.add(o.id);
  if(o.level!=='site'&&!levels.has(o.level))throw new Error('Unknown level: '+o.level);
  if(manifest)for(const id of o.sources)if(!sources.has(id))throw new Error('Unknown or uninspected evidence source: '+id);
  if(o.kind==='roof_mesh'){
   if(o.layer!=='roof'||o.points.length<3||o.points.length%3||o.points.some(p=>p.length!==3))throw new Error('Roof mesh needs complete 3D triangles: '+o.id);
   for(let i=0;i<o.points.length;i+=3){const [a,b,c]=o.points.slice(i,i+3),u=b.map((n,k)=>n-a[k]),v=c.map((n,k)=>n-a[k]);if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-7)throw new Error('Degenerate roof triangle: '+o.id);}
  }else if(o.points.length&&(!['slab','pool'].includes(o.kind)||o.points.length<3||o.points.length>80||o.points.some(p=>p.length!==2)||!polygonValid(o.points)))throw new Error('Invalid polygon: '+o.id);
  if(o.openings.length&&o.kind!=='wall')throw new Error('Only walls can have openings');
  for(const [i,a] of o.openings.entries()){
   if(Math.abs(a.offset)+a.width/2>o.size[0]/2+.001||a.sill+a.height>o.size[1]+.001)throw new Error('Opening outside wall: '+o.id);
   for(const b of o.openings.slice(i+1))if(Math.abs(a.offset-b.offset)<(a.width+b.width)/2-.001&&Math.max(a.sill,b.sill)<Math.min(a.sill+a.height,b.sill+b.height)-.001)throw new Error('Overlapping openings: '+o.id);
  }
 }
 return scene;
}
