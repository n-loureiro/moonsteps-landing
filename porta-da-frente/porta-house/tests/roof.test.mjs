import test from 'node:test';import assert from 'node:assert/strict';
import {roofEnvelope} from '../src/roof.mjs';
const roofs=[[-10.4,-7.95,.4,7.95],[-10.4,-3.45,10.45,6.25],[2.6,-3.45,10.45,10.45]];
const heightAt=(points,x,z)=>{
 const heights=[];for(let i=0;i<points.length;i+=3){const [a,b,c]=points.slice(i,i+3),den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
 if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)heights.push(u*a[1]+v*b[1]+(1-u-v)*c[1]);}
 return heights;
};
test('connected roof envelope covers the traced stepped outline once, with no stacked overlapping hips',()=>{
 const points=roofEnvelope(roofs,.34);assert.ok(points.length>0&&points.length<=1200);let area=0;
 for(let i=0;i<points.length;i+=3){const [a,b,c]=points.slice(i,i+3);area+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;}
 assert.ok(Math.abs(area-302.175)<.001,'Projected surface should equal the roof footprint union');
 for(const [x,z,want] of [[-5,0,1.836],[2,1.4,1.649],[6.5,6.5,1.326],[0,9,undefined]]){
 const h=heightAt(points,x,z);if(want===undefined)assert.equal(h.length,0);else{assert.ok(h.length>0);for(const y of h)assert.ok(Math.abs(y-want)<.002,`roof height at ${x},${z}: ${y}`);}
 }
});
