import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Natural Earth 1:10m land, public domain. Preserve islands and polygon holes.
const source = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const polygons = source.features.flatMap(feature => feature.geometry.type === 'Polygon'
  ? [feature.geometry.coordinates] : feature.geometry.coordinates);
const selected = polygons;
// Remove sub-pixel detail while retaining much finer bays and headlands than 1:50m.
function simplify(ring, tolerance=.008) {
  if(ring.length<8)return ring;
  const keep=new Uint8Array(ring.length);keep[0]=keep[ring.length-1]=1;
  const stack=[[0,ring.length-1]];
  while(stack.length){
    const [a,b]=stack.pop(),[ax,ay]=ring[a],[bx,by]=ring[b];let best=tolerance*tolerance,index=-1;
    for(let i=a+1;i<b;i++){
      const [x,y]=ring[i],dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
      const d=(x-ax-t*dx)**2+(y-ay-t*dy)**2;
      if(d>best){best=d;index=i;}
    }
    if(index>=0){keep[index]=1;stack.push([a,index],[index,b]);}
  }
  const result=ring.filter((_,i)=>keep[i]);return result.length>=4?result:ring;
}
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/land.json', JSON.stringify(selected.map(polygon => polygon.map(ring => simplify(ring).map(point => point.slice(0, 2).map(n => +n.toFixed(4)))))));
console.log(`Prepared ${selected.length} geographic land polygons.`);
