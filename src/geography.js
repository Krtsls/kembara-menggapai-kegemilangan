import landURL from './data/land.json?url';
import { carveStraits, straitAt } from './straits.js';
export { straits, straitAt } from './straits.js';
export const NAV_CLEARANCE=3;
const response=await fetch(landURL);
if(!response.ok)throw new Error('Unable to load geographic coastlines. Reload to retry.');
const land=await response.json();

export const bounds = { west: -180, east: 180, north: 90, south: -90 };
export const WORLD = { w: 7200, h: 3600 };
export const wrapX = x => ((x % WORLD.w) + WORLD.w) % WORLD.w;
export const deltaX = (from, to) => ((to - from + WORLD.w * 1.5) % WORLD.w + WORLD.w) % WORLD.w - WORLD.w / 2;
export function normalizePosition(x,y) {
  while(y<0||y>WORLD.h){if(y<0){y=-y;x+=WORLD.w/2;}if(y>WORLD.h){y=WORLD.h*2-y;x+=WORLD.w/2;}}
  return {x:wrapX(x),y};
}
export const project = (lon, lat) => ({ x: (lon - bounds.west) * 20, y: (bounds.north - lat) * 20 });
export const unproject = (x, y) => ({ lon: wrapX(x) / 20 + bounds.west, lat: bounds.north - y / 20 });
// Local gameplay hazards. Coastline islands themselves come from Natural Earth.
export const rocks = [[-10.0,37.5,2.4],[-11.5,34,2],[-24.4,15.2,2.5],[18,-35.4,3],[41,-16,2.8],[128,-6,2.3]].map(([lon,lat,radius])=>({...project(lon,lat),radius}));
export const iceAt = (x,y) => y < 80 + 12*Math.sin(wrapX(x)/90) || y > WORLD.h - 65;
export function obstacleAt(x,y,margin=0){
  if(iceAt(x,y-margin)||iceAt(x,y+margin))return 'sea ice';
  if(rocks.some(r=>Math.hypot(deltaX(x,r.x),y-r.y)<=r.radius+margin))return 'rocks';
  return null;
}
export const coastlines = land.map(polygon => {
  const rings = polygon.map(ring => ring.map(([lon, lat]) => project(lon, lat)));
  const points = rings[0];
  const box=points.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minY:Math.min(b.minY,p.y),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity});
  return { rings, ...box };
});
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function containsLand(x, y) {
  x=wrapX(x);
  if(straitAt(x,y))return false;
  return coastlines.some(p => x >= p.minX && x <= p.maxX && y >= p.minY && y <= p.maxY && inRing(x, y, p.rings[0]) && !p.rings.slice(1).some(r => inRing(x, y, r)));
}
let landMask, clearance;
export function isLand(x, y) {
  x=wrapX(x);
  if (y < 0 || y >= WORLD.h) return false;
  if (typeof document === 'undefined') return containsLand(x,y);
  if (!landMask) {
    const canvas = document.createElement('canvas');canvas.width=WORLD.w;canvas.height=WORLD.h;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.beginPath();
    for(const polygon of coastlines)for(const ring of polygon.rings){ring.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));context.closePath();}
    context.fill('evenodd');
    carveStraits(context);
    const pixels=context.getImageData(0,0,WORLD.w,WORLD.h).data;
    landMask=new Uint8Array(WORLD.w*WORLD.h);
    for(let i=0;i<landMask.length;i++)landMask[i]=pixels[i*4+3]>50?1:0;
    canvas.width=canvas.height=0;
  }
  return landMask[Math.floor(y)*WORLD.w+Math.floor(x)]===1;
}
export function blocked(x, y, margin = 4) {
  x=wrapX(x);
  if(obstacleAt(x,y,margin))return true;
  if(typeof document !== 'undefined'){
    if(!clearance){
      isLand(x,y);
      const width=WORLD.w,height=WORLD.h;
      clearance=new Uint16Array(width*height);
      for(let i=0;i<clearance.length;i++)clearance[i]=landMask[i]?0:16000;
      // Conservative chamfer distance field: constant-time coastline clearance.
      for(let yy=1;yy<height;yy++)for(let xx=0;xx<width;xx++){
        const i=yy*width+xx,l=(xx+width-1)%width,r=(xx+1)%width;clearance[i]=Math.min(clearance[i],clearance[yy*width+l]+3,clearance[i-width]+3,clearance[(yy-1)*width+l]+4,clearance[(yy-1)*width+r]+4);
      }
      for(let yy=height-2;yy>=0;yy--)for(let xx=width-1;xx>=0;xx--){
        const i=yy*width+xx,l=(xx+width-1)%width,r=(xx+1)%width;clearance[i]=Math.min(clearance[i],clearance[yy*width+r]+3,clearance[i+width]+3,clearance[(yy+1)*width+l]+4,clearance[(yy+1)*width+r]+4);
      }
    }
    return clearance[Math.floor(y)*WORLD.w+Math.floor(x)]<=margin*3+3;
  }
  if (isLand(x, y)) return true;
  for (let radius = 1; radius <= margin; radius++) for (let i = 0; i < 8; i++) if (isLand(x + Math.cos(i * Math.PI / 4) * radius, y + Math.sin(i * Math.PI / 4) * radius)) return true;
  return false;
}
export function clearPassage(a, b, margin = NAV_CLEARANCE) {
  const dx=deltaX(a.x,b.x);
  const steps = Math.ceil(Math.hypot(dx, b.y - a.y));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    if (blocked(a.x + dx * t, a.y + (b.y - a.y) * t, margin)) return false;
  }
  return true;
}
export function nearestWater(point) {
  point=normalizePosition(point.x,point.y);
  if (!blocked(point.x, point.y, NAV_CLEARANCE)) return point;
  for (let radius = 2; radius < 900; radius += 2) {
    for (let i = 0; i < 40; i++) {
      const p = { x: point.x + Math.cos(i / 40 * Math.PI * 2) * radius, y: point.y + Math.sin(i / 40 * Math.PI * 2) * radius };
      if (!blocked(p.x, p.y, NAV_CLEARANCE)) return normalizePosition(p.x,p.y);
    }
  }
  return null;
}

// A water-only A* graph prevents automatic courses from crossing continents.
const cell = 8, cols = WORLD.w / cell, rows = WORLD.h / cell;
const passable = new Int8Array(cols * rows);
const position = id => ({ x: (id % cols) * cell + cell / 2, y: Math.floor(id / cols) * cell + cell / 2 });
function openCell(id) {
  if (!passable[id]) { const p = position(id); passable[id] = blocked(p.x, p.y, NAV_CLEARANCE) ? -1 : 1; }
  return passable[id] === 1;
}
function closestCell(point) {
  const cx = Math.floor(wrapX(point.x) / cell), cy = Math.floor(point.y / cell);
  for (let r = 0; r < 12; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (y < 0 || y >= rows) continue;
    const id = y * cols + (x+cols)%cols;
    if (openCell(id) && clearPassage(point, position(id))) return id;
  }
  return -1;
}
export function planRoute(start, finish) {
  if (clearPassage(start, finish)) return [finish];
  const first = closestCell(start), goal = closestCell(finish);
  if (first < 0 || goal < 0) return null;
  const costs = new Float64Array(cols * rows).fill(Infinity), parent = new Int32Array(cols * rows).fill(-1), closed = new Uint8Array(cols * rows);
  const heap = [];
  const heuristic = id => {const dx=Math.abs(id%cols-goal%cols);return Math.hypot(Math.min(dx,cols-dx),Math.floor(id/cols)-Math.floor(goal/cols));};
  function push(id, score) {
    let i = heap.length; heap.push({ id, score });
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p].score <= score) break; heap[i] = heap[p]; i = p; } heap[i] = { id, score };
  }
  function pop() {
    const first = heap[0], tail = heap.pop();
    if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let j = i * 2 + 1; if (j + 1 < heap.length && heap[j + 1].score < heap[j].score) j++; if (heap[j].score >= tail.score) break; heap[i] = heap[j]; i = j; } heap[i] = tail; }
    return first.id;
  }
  costs[first] = 0; push(first, heuristic(first));
  while (heap.length) {
    const id = pop(); if (closed[id]) continue; closed[id] = 1;
    if (id === goal) {
      const raw = [finish]; let cursor = goal;
      while (cursor !== -1) { raw.push(position(cursor)); cursor = parent[cursor]; } raw.push(start); raw.reverse();
      const route = []; let i = 0;
      while (i < raw.length - 1) { let j = raw.length - 1; while (j > i + 1 && !clearPassage(raw[i], raw[j])) j--; route.push(raw[j]); i = j; }
      return route;
    }
    const x = id % cols, y = Math.floor(id / cols);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nx = (x + dx + cols)%cols, ny = y + dy; if (ny < 0 || ny >= rows) continue;
      const next = ny * cols + nx;
      if (closed[next] || !openCell(next) || !clearPassage(position(id), position(next))) continue;
      const cost = costs[id] + Math.hypot(dx, dy);
      if (cost < costs[next]) { costs[next] = cost; parent[next] = id; push(next, cost + heuristic(next)); }
    }
  }
  return null;
}
export function nauticalMiles(a, b) {
  const p = unproject(a.x, a.y), q = unproject(b.x, b.y), rad = Math.PI / 180;
  const n = Math.sin((q.lat - p.lat) * rad / 2) ** 2 + Math.cos(p.lat * rad) * Math.cos(q.lat * rad) * Math.sin((q.lon - p.lon) * rad / 2) ** 2;
  return 3440.065 * 2 * Math.asin(Math.sqrt(Math.min(1, n)));
}
