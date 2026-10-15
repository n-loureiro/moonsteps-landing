// Compose connected hipped roofs as one upper envelope. Hidden face regions are
// clipped away, so overlapping rectangles create real valleys rather than stacked roofs.
const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
const value=(q,p)=>q[0]*p[0]+q[1]*p[1]+q[2];
const minus=(a,b)=>a.map((x,i)=>x-b[i]);
function clip(poly,q){
 if(poly.length<3)return [];const out=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],va=value(q,a),vb=value(q,b),ina=va>=0,inb=vb>=0;
  if(ina)out.push(a);if(ina!==inb){const t=va/(va-vb);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
 }
 const clean=out.filter((p,i)=>Math.hypot(p[0]-out[(i+out.length-1)%out.length][0],p[1]-out[(i+out.length-1)%out.length][1])>1e-7);
 return clean.length>=3&&area(clean)>1e-9?clean:[];
}
export function roofEnvelope(rectangles,pitch=.34){
 if(!Number.isFinite(pitch)||pitch<=0)throw new Error('Roof pitch must be positive.');
 const roofs=rectangles.map(r=>{
  if(r.length!==4||!r.every(Number.isFinite)||r[2]<=r[0]||r[3]<=r[1])throw new Error('Invalid roof rectangle');
  const [x1,z1,x2,z2]=r;return {polygon:[[x1,z1],[x2,z1],[x2,z2],[x1,z2]],planes:[[1,0,-x1],[-1,0,x2],[0,1,-z1],[0,-1,z2]]};
 });
 const triangles=[];
 for(const [index,roof] of roofs.entries())for(const plane of roof.planes){
  let face=roof.polygon;for(const other of roof.planes){face=clip(face,minus(other,plane));if(!face.length)break;}if(!face.length)continue;
  let visible=[face];
  for(const [otherIndex,otherRoof] of roofs.entries()){
   if(index===otherIndex)continue;const next=[];
   for(const polygon of visible){
    let pending=polygon;
    for(const otherPlane of otherRoof.planes){
     const q=minus(otherPlane,plane);q[2]+=otherIndex<index?1e-8:-1e-8;
     const outside=clip(pending,q.map(x=>-x));if(outside.length)next.push(outside);
     pending=clip(pending,q);if(!pending.length)break;
    }
   }
   visible=next;if(!visible.length)break;
  }
  for(const polygon of visible)for(let i=1;i<polygon.length-1;i++){
   if(area([polygon[0],polygon[i],polygon[i+1]])<1e-8)continue;
   for(const p of [polygon[0],polygon[i+1],polygon[i]])triangles.push([p[0],Math.max(0,value(plane,p)*pitch),p[1]].map(n=>Math.round(n*1e6)/1e6));
  }
 }
 return triangles;
}
