import { WORLD, project, unproject, coastlines, isLand, blocked, clearPassage, nearestWater, planRoute, nauticalMiles, wrapX, deltaX, normalizePosition, rocks, iceAt } from './geography.js';
import { SHIP_SCALE, HULL_RADIUS, moveVessel, canDepart, courseAngle } from './navigation-physics.js';
import { createOceanLife, drawLocalWater, drawSeabirds, atmosphere, drawAtmosphere } from './ocean-life.js';
import { straits, straitAt, carveStraits, traceStrait } from './straits.js';
import { pilotChannel } from './navigation-physics.js';
import { cloudStatus } from './supabase.js';
import { queueCloudSave, loadCloudVoyage } from './cloud-save.js';

const icons = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>',
  helm: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v7m0 6v7M2 12h7m6 0h7M5 5l5 5m4 4 5 5M5 19l5-5m4-4 5-5"/>',
  book: '<path d="M12 5C8 2 4 3 2 4v15c3-1.5 7-1 10 1 3-2 7-2.5 10-1V4c-2-1-6-2-10 1Zm0 0v15M5 7l4 1M5 11l4 1m6-4 4-1m-4 5 4-1"/>',
  'sound-off': '<path d="m11 4-5 4H3v8h3l5 4V4Zm5 5 5 6m0-6-5 6"/>',
  sound: '<path d="m11 4-5 4H3v8h3l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  settings: '<path d="m10 2-.7 3-2 .9L4.5 5l-2 3.5 2.3 2v3l-2.3 2 2 3.5 2.8-.9 2 .9.7 3h4l.7-3 2-.9 2.8.9 2-3.5-2.3-2v-3l2.3-2-2-3.5-2.8.9-2-.9L14 2Z"/><circle cx="12" cy="12" r="3"/>',
  stars: '<path d="m10 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Zm9-2 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Zm0 15 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"/>',
  ship: '<path d="m3 16 3 5h12l3-5H3Zm9-14v14M10 4 4 13h6V4Zm4 1 5 8h-5V5ZM2 23c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v15M8 10h8M3 14v3c0 3 5 4 9 5 4-1 9-2 9-5v-3M1 16l2-3 3 3m12 0 3-3 2 3"/>',
  flag: '<path d="M5 22V3c5-5 9 5 15 0v11c-6 5-10-5-15 0"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7"/>',
  locate: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  route: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M9 5h6a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h5"/>',
  gem: '<path d="m3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18M7 8l5-5 5 5"/>',
  island: '<path d="M2 20c4-4 16-4 20 0H2Zm11-3V7m0 1c-6-7-9 0-9 0l9-1m0 1c6-7 9 0 9 0l-9-1m0 0c-3-8-6-5-6-5l6 5m0 0c2-8 6-5 6-5l-6 5"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.compass}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = svg(el.dataset.icon));
const $ = id => document.getElementById(id);
const canvas = $('ocean');
const ctx = canvas.getContext('2d');
const wrap = $('map-wrap');
const TAU = Math.PI * 2;
const start = project(-10.1, 38.3);
const islands = [
  { id: 'lisbon', name: 'LISBON', subtitle: 'Portugal · your home port', ...project(-9.14, 38.72) },
  { id: 'cape-verde', name: 'CAPE VERDE', subtitle: 'Islands of the Atlantic', ...project(-23.6, 15.1) },
  { id: 'cape', name: 'CAPE OF GOOD HOPE', subtitle: 'The passage around Africa', ...project(18.5, -34.35) },
  { id: 'mozambique', name: 'MOZAMBIQUE', subtitle: 'The East African coast', ...project(40.7, -15.0) },
  { id: 'calicut', name: 'CALICUT', subtitle: 'India · the Malabar spice coast', ...project(75.78, 11.25) },
  { id: 'malacca', name: 'MALACCA', subtitle: 'Gateway to the eastern seas', ...project(102.25, 2.2) },
  { id: 'spice', name: 'BANDA ISLANDS', subtitle: 'The Moluccas · the Spice Lands', ...project(129.9, -4.52) },
];
const treasures = [
  { id: 'chest1', ...project(-12, 32), name: 'The cartographer’s coffer', detail: 'A weathered chart traces the African coast southward. Round the Cape to reach the Indian Ocean.' },
  { id: 'chest2', ...project(16, -36.5), name: 'Silver of the southern fleet', detail: 'Lost silver off southern Africa. Beyond the Cape, the Indian Ocean opens before you.' },
  { id: 'chest3', ...project(65, 2), name: 'The stargazer’s astrolabe', detail: 'A brass instrument etched with constellations. Once, another sailor trusted these same stars.' },
  { id: 'chest4', ...project(125, -7), name: 'The amber tide', detail: 'Amber, pearls, and a pouch of fragrant cloves. The Moluccas must be close.' },
];
const defaultState = () => ({ x:start.x, y:start.y, vx:0, vy:0, angle:Math.PI / 2, sail:1, anchored:true, elapsed:0, distance:0, discovered:['lisbon'], found:[], visited:[[start.x,start.y]], departed:false, won:false, intro:true, journal:[{ day:1, place:'LISBON', title:'A new beginning', text:'Portugal falls astern. Sail south around Africa, then cross the Indian Ocean toward the spice islands of the Moluccas.' }] });
let state = defaultState();
try {
  const current=localStorage.getItem('uncharted-globe-v3');
  const saved = JSON.parse(current||localStorage.getItem('uncharted-earth-v2'));
  if (saved && [2,3].includes(saved.version) && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Array.isArray(saved.visited) && Array.isArray(saved.journal)) {
    if(saved.version===2){saved.x+=3000;saved.y+=600;saved.visited=saved.visited.map(([x,y])=>[x+3000,y+600]);}
    const safe=nearestWater(saved);
    if(safe)state={...state,...saved,...safe,vx:0,vy:0,anchored:true};
  }
} catch { /* A fresh voyage also works without browser storage. */ }
let w = 900, h = 500, dpr = 1, zoom = 2.8;
let camera = { x:state.x + 45, y:state.y - 15 };
let follow = true, target = null, night = false, reduced = false;
let route = [], atlas = false;
let time = 0, last = 0, saveTimer = 0, uiTimer = 0, toastTimer = 0, shoreTimer = 0;
let visibleFogDirty = true, fogW = WORLD.w / 5, fogH = WORLD.h / 5;
const keys = new Set();
const fog = document.createElement('canvas'); fog.width = fogW; fog.height = fogH;
const fctx = fog.getContext('2d');
const terrain = document.createElement('canvas'); terrain.width = WORLD.w; terrain.height = WORLD.h;
const tctx = terrain.getContext('2d');
let audioContext, noiseSource, audioGain, soundEnabled = false;
const random = seed => { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const rand = random(1307);
const waves = Array.from({ length:7000 }, () => ({ x:rand()*WORLD.w, y:rand()*WORLD.h, len:2+rand()*7, phase:rand()*TAU, opacity:rand()*.1+.025 }));
const clouds = Array.from({ length:450 }, () => ({ x:rand()*WORLD.w, y:rand()*WORLD.h, rx:45+rand()*100, ry:30+rand()*55, p:rand()*TAU }));
const stars = Array.from({ length:130 }, () => ({ x:rand(), y:rand(), r:rand()*1.3+.3, p:rand()*TAU }));
const wake = [];
const oceanLife=createOceanLife();
const detailedCoasts=coastlines.map(p=>{
  const path=new Path2D();for(const ring of p.rings){ring.forEach((point,i)=>i?path.lineTo(point.x,point.y):path.moveTo(point.x,point.y));path.closePath();}return {...p,path};
});
const overviewCoast=new Path2D();
for(const p of detailedCoasts)overviewCoast.addPath(p.path);
const dist = (a,b) => Math.hypot(deltaX(a.x,b.x),a.y-b.y);
const wrapAngle = a => Math.atan2(Math.sin(a),Math.cos(a));
const day = () => Math.floor((480 + state.elapsed * 8) / 1440) + 1;
const wind = () => ({ angle: -.62 + Math.sin(state.elapsed/100)*.35, speed:12 + Math.sin(state.elapsed/48)*2.5 });
const isPaused = () => document.querySelector('dialog[open]') || document.hidden;
const scale = () => Math.min(w / 920, h / 500) * zoom;
const toWorld = (x,y) => ({ x:(x-w/2)/scale()+camera.x, y:(y-h/2)/scale()+camera.y });
const toScreen = (x,y) => ({ x:deltaX(camera.x,x)*scale()+w/2, y:(y-camera.y)*scale()+h/2 });

function tree(c,x,y,size,kind='pine') {
  c.save();c.translate(x,y);
  c.fillStyle='#244d4230';c.beginPath();c.ellipse(4,4,size*.65,size*.28,0,0,TAU);c.fill();
  c.strokeStyle='#6e7950';c.lineWidth=1.7;c.beginPath();c.moveTo(0,4);c.lineTo(0,-size*.65);c.stroke();
  if(kind==='palm'){
    c.strokeStyle='#607e4d';c.lineWidth=2.8;
    for(let j=0;j<5;j++){let a=j/5*TAU;c.beginPath();c.moveTo(0,-size*.5);c.quadraticCurveTo(Math.cos(a)*size*.6,-size*.5+Math.sin(a)*size*.2,Math.cos(a)*size*.9,-size*.2+Math.sin(a)*size*.55);c.stroke();}
  } else {
    c.fillStyle='#67854f';c.beginPath();c.moveTo(0,-size);c.lineTo(size*.47,0);c.lineTo(-size*.47,0);c.closePath();c.fill();
    c.fillStyle='#557749';c.beginPath();c.moveTo(0,-size);c.lineTo(0,0);c.lineTo(-size*.47,0);c.closePath();c.fill();
    c.fillStyle='#789559';c.beginPath();c.moveTo(0,-size*1.25);c.lineTo(size*.34,-size*.38);c.lineTo(-size*.34,-size*.38);c.closePath();c.fill();
  }
  c.restore();
}
function buildTerrain() {
  const c = tctx;
  c.clearRect(0,0,WORLD.w,WORLD.h);
  const landPath = new Path2D();
  for (const polygon of coastlines) for (const ring of polygon.rings) {
    ring.forEach((p,i) => i ? landPath.lineTo(p.x,p.y) : landPath.moveTo(p.x,p.y));
    landPath.closePath();
  }
  c.lineJoin='round';
  for (const [width,color] of [[6,'#74bdb77d'],[3,'#9fd2bbcc'],[.8,'#f3ddae']]) {
    c.strokeStyle=color;c.lineWidth=width;c.stroke(landPath);
  }
  const gradient=c.createLinearGradient(0,0,0,WORLD.h);gradient.addColorStop(0,'#b8c698');gradient.addColorStop(.48,'#c8c69a');gradient.addColorStop(.65,'#aabb83');gradient.addColorStop(1,'#bac693');
  c.fillStyle=gradient;c.fill(landPath,'evenodd');
  c.save();c.clip(landPath,'evenodd');
  const r=random(120);
  for(let j=0;j<16000;j++){
    const x=r()*WORLD.w,y=r()*WORLD.h;
    c.fillStyle=j%2?'#78936913':'#ebe0b022';c.beginPath();c.ellipse(x,y,15+r()*40,8+r()*30,0,0,TAU);c.fill();
    if(j%3===0)tree(c,x,y,1.5+r()*2);
  }
  c.restore();
  // Tiny clustered buildings make ports feel inhabited at coastal zoom.
  c.save();c.clip(landPath,'evenodd');
  for(const port of islands){
    for(let j=0;j<45;j++){
      const x=port.x+(r()-.5)*16,y=port.y+(r()-.5)*12;
      c.fillStyle='#e9d7ae';c.fillRect(x,y,.8,1.1);c.fillStyle='#a87553';c.fillRect(x-.1,y-.3,1,.4);
    }
  }
  c.restore();
  // Small relief marks follow major mountain belts; coastlines remain unchanged.
  c.save();c.clip(landPath,'evenodd');
  for(const [lon,lat,count,dx,dy] of [[-72,-10,25,.1,-1],[-115,46,18,.6,-.8],[75,33,22,.8,-.1],[10,46,12,.5,.03],[31,-10,12,.1,-1]]){
    for(let j=0;j<count;j++){const p=project(lon+j*dx,lat+j*dy);c.fillStyle='#899676';c.beginPath();c.moveTo(p.x-3,p.y+3);c.lineTo(p.x,p.y-5);c.lineTo(p.x+4,p.y+3);c.closePath();c.fill();c.strokeStyle='#d4d2b2';c.lineWidth=.5;c.beginPath();c.moveTo(p.x,p.y-5);c.lineTo(p.x+4,p.y+3);c.stroke();}
  }
  c.restore();
  // Symbols are deliberately oversized; the underlying coastlines stay geographic.
  islands.forEach(port=>{c.fillStyle='#244b3b';c.beginPath();c.arc(port.x,port.y,3.5,0,TAU);c.fill();c.strokeStyle='#f3e8bc';c.lineWidth=1.5;c.stroke();});
  c.textAlign='center';c.font='17px "IM Fell English", Georgia';c.letterSpacing='3px';c.fillStyle='#526b4877';
  for(const [name,lon,lat] of [['NORTH AMERICA',-105,45],['SOUTH AMERICA',-60,-15],['GREENLAND',-42,74],['AFRICA',19,8],['EUROPE',17,51],['ASIA',90,45],['ARABIA',45,24],['INDIA',79,23],['MADAGASCAR',47,-21],['SUMATRA',101,-1],['AUSTRALIA',129,-25],['ANTARCTICA',0,-80]]) {const p=project(lon,lat);c.fillText(name,p.x,p.y);}
  c.letterSpacing='0px';
  carveStraits(c);
}
function updateFog() {
  fctx.globalCompositeOperation='source-over';fctx.clearRect(0,0,fogW,fogH);
  fctx.fillStyle=night?'#748793':'#d0dcca';fctx.fillRect(0,0,fogW,fogH);
  const r=random(349);
  for(let j=0;j<450;j++){
    const x=r()*fogW,y=r()*fogH,radius=6+r()*18;
    const g=fctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,night?'#aebdc62b':'#f5f2dc60');g.addColorStop(1,night?'#aebdc600':'#f5f2dc00');fctx.fillStyle=g;fctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  fctx.globalCompositeOperation='destination-out';
  for(const point of state.visited){
    for(const offset of [-fogW,0,fogW]){
      const x=wrapX(point[0])/5+offset,y=point[1]/5,radius=53;
      const g=fctx.createRadialGradient(x,y,radius*.65,x,y,radius);g.addColorStop(0,'#000');g.addColorStop(.74,'#000000d9');g.addColorStop(1,'#0000');fctx.fillStyle=g;fctx.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
  }
  fctx.globalCompositeOperation='source-over';visibleFogDirty=false;
}
function resize() {
  const rect=wrap.getBoundingClientRect();w=rect.width;h=rect.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
}
new ResizeObserver(resize).observe(wrap);
buildTerrain();updateFog();resize();

function drawShip(c) {
  c.save();c.translate(state.x,state.y);c.rotate(state.angle);c.scale(SHIP_SCALE,SHIP_SCALE);
  // The wake follows momentum; the hull follows the rudder.
  c.fillStyle='#133e4940';c.beginPath();c.ellipse(2,6,25,10,0,0,TAU);c.fill();
  c.fillStyle='#5b543a';c.beginPath();c.moveTo(25,0);c.quadraticCurveTo(8,-12,-20,-9);c.lineTo(-23,-6);c.lineTo(-23,6);c.lineTo(-20,9);c.quadraticCurveTo(8,12,25,0);c.fill();
  c.strokeStyle='#dfcb97';c.lineWidth=1.2;c.stroke();
  c.fillStyle='#b49c6a';c.beginPath();c.moveTo(20,0);c.quadraticCurveTo(4,-8,-17,-6);c.lineTo(-17,6);c.quadraticCurveTo(4,8,20,0);c.fill();
  c.strokeStyle='#7e734e';c.lineWidth=1;c.beginPath();c.moveTo(-17,0);c.lineTo(18,0);c.moveTo(-12,-6);c.lineTo(-12,6);c.stroke();
  c.strokeStyle='#544b34';c.lineWidth=2;c.beginPath();c.moveTo(4,-17);c.lineTo(4,16);c.moveTo(-12,-10);c.lineTo(-12,11);c.stroke();
  const fullness=state.anchored?.25:Math.max(.25,state.sail);
  c.fillStyle='#f2ead0';c.beginPath();c.moveTo(4,-17);c.quadraticCurveTo(-14*fullness,-1,4,16);c.quadraticCurveTo(13*fullness,3,4,-17);c.fill();
  c.fillStyle='#d5d6b6';c.beginPath();c.moveTo(4,-17);c.quadraticCurveTo(1,0,4,16);c.quadraticCurveTo(13*fullness,3,4,-17);c.fill();
  c.fillStyle='#e8e2c4';c.beginPath();c.moveTo(-12,-10);c.quadraticCurveTo(-22*fullness,0,-12,11);c.quadraticCurveTo(-7,1,-12,-10);c.fill();
  c.strokeStyle='#f4edd7';c.lineWidth=.5;c.beginPath();c.moveTo(4,-17);c.lineTo(22,0);c.moveTo(4,16);c.lineTo(22,0);c.stroke();
  c.fillStyle='#b58153';c.beginPath();c.moveTo(-15,-10);c.lineTo(-24,-12+Math.sin(time*2));c.lineTo(-15,-15);c.fill();
  c.restore();
}
function drawTreasure(c,t) {
  const bob=reduced?0:Math.sin(time*1.7+t.x)*2;
  c.save();c.translate(t.x,t.y+bob*.3);c.scale(.3,.3);
  c.strokeStyle='#d4dcb26a';c.lineWidth=1;c.setLineDash([2,5]);c.beginPath();c.arc(0,0,22+Math.sin(time)*2,0,TAU);c.stroke();c.setLineDash([]);
  c.fillStyle='#254d4d40';c.beginPath();c.ellipse(0,8,12,5,0,0,TAU);c.fill();
  c.fillStyle='#b6a269';c.fillRect(-9,-4,18,13);c.fillStyle='#d4bd78';c.beginPath();c.roundRect(-9,-9,18,9,[5,5,0,0]);c.fill();c.strokeStyle='#786e46';c.lineWidth=1;c.strokeRect(-9,-3,18,12);c.fillStyle='#e9d499';c.fillRect(-5,-8,2,16);c.fillRect(4,-8,2,16);c.fillStyle='#6f6745';c.fillRect(-1,-1,3,4);
  if(!reduced){c.fillStyle='#e6e8c5';const a=time*.6;c.beginPath();c.arc(Math.sin(a)*20,-15+Math.cos(a)*4,1.5,0,TAU);c.fill();}
  c.restore();
}
function draw() {
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,night?'#193b4e':'#3e8490');bg.addColorStop(.65,night?'#214756':'#438a91');bg.addColorStop(1,night?'#234c59':'#579a97');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  const s=scale();ctx.save();ctx.translate(w/2,h/2);ctx.scale(s,s);ctx.translate(-camera.x,-camera.y);
  const firstCopy=Math.floor((camera.x-w/(2*s))/WORLD.w),lastCopy=Math.floor((camera.x+w/(2*s))/WORLD.w);
  for(let copy=firstCopy;copy<=lastCopy;copy++){
  const offset=copy*WORLD.w;ctx.save();ctx.translate(offset,0);
  const left=camera.x-offset-w/(2*s),top=camera.y-h/(2*s),right=left+w/s,bottom=top+h/s;
  // Faint rhumb lines recall early portolan charts.
  ctx.strokeStyle=night?'#a5c1c80b':'#d6e6d20d';ctx.lineWidth=.7/s;
  for(let x=Math.floor(left/200)*200;x<right;x+=200){ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();}
  for(let y=Math.floor(top/200)*200;y<bottom;y+=200){ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
  const chartCenter={x:500,y:680};for(let j=0;j<12;j++){const a=j/12*TAU;ctx.beginPath();ctx.moveTo(chartCenter.x,chartCenter.y);ctx.lineTo(chartCenter.x+Math.cos(a)*2700,chartCenter.y+Math.sin(a)*2700);ctx.stroke();}
  for(const wave of waves){if(wave.x<left-20||wave.x>right+20||wave.y<top-10||wave.y>bottom+10)continue;const drift=reduced?0:Math.sin(time*.45+wave.phase)*4;ctx.strokeStyle=`rgba(218,236,211,${wave.opacity})`;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(wave.x+drift,wave.y);ctx.quadraticCurveTo(wave.x+wave.len*.5+drift,wave.y+2,wave.x+wave.len+drift,wave.y);ctx.stroke();}
  ctx.drawImage(terrain,0,0);
  // Crisp vector shorelines and visible, collidable coastal hazards at close zoom.
  if(!atlas){
    const visible=detailedCoasts.filter(p=>p.maxX>=left&&p.minX<=right&&p.maxY>=top&&p.minY<=bottom);
    ctx.save();
    for(const p of visible){
      // Layered surf, sandy edge, and a dark land contour clearly separate hull and shore.
      ctx.strokeStyle='#91d6c278';ctx.lineWidth=2.2;ctx.stroke(p.path);
      ctx.strokeStyle='#f7e2b4';ctx.lineWidth=.8;ctx.stroke(p.path);
      ctx.strokeStyle='#596e43';ctx.lineWidth=.25;ctx.stroke(p.path);
      if(!reduced){ctx.strokeStyle=`rgba(247,248,219,${.22+(Math.sin(time*.9)+1)*.12})`;ctx.lineWidth=.28;ctx.setLineDash([1.2,2]);ctx.lineDashOffset=-time*.35;ctx.stroke(p.path);ctx.setLineDash([]);}
    }
    ctx.restore();
    // Draw the widened water over the original coastal outlines as well.
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    for(const channel of straits){
      traceStrait(ctx,channel);ctx.strokeStyle='#e9d3a4';ctx.lineWidth=channel.halfWidth*2+.8;ctx.stroke();
      ctx.strokeStyle='#7abdaf';ctx.lineWidth=channel.halfWidth*2;ctx.stroke();
      ctx.strokeStyle='#438a91';ctx.lineWidth=channel.halfWidth*2-2;ctx.stroke();
      ctx.strokeStyle='#e4ebc688';ctx.lineWidth=.3;ctx.setLineDash([1,3]);ctx.stroke();ctx.setLineDash([]);
    }
    ctx.restore();
    drawLocalWater(ctx,{left,right,top,bottom,s},time,state,reduced);
    oceanLife.draw(ctx,{left,right,top,bottom},time,reduced);
  }
  for(const rock of rocks){ctx.fillStyle='#c1d9ca88';ctx.beginPath();ctx.ellipse(rock.x,rock.y,rock.radius+2,rock.radius+1,0,0,TAU);ctx.fill();ctx.fillStyle='#596963';ctx.beginPath();ctx.moveTo(rock.x-rock.radius,rock.y+1);ctx.lineTo(rock.x-1,rock.y-rock.radius);ctx.lineTo(rock.x+rock.radius,rock.y);ctx.lineTo(rock.x+1,rock.y+rock.radius);ctx.closePath();ctx.fill();ctx.strokeStyle='#d1d4bf';ctx.lineWidth=.5;ctx.stroke();}
  ctx.fillStyle='#dce8e6';ctx.beginPath();ctx.moveTo(0,-WORLD.h);ctx.lineTo(WORLD.w,-WORLD.h);for(let x=WORLD.w;x>=0;x-=10)ctx.lineTo(x,80+12*Math.sin(x/90));ctx.closePath();ctx.fill();ctx.fillRect(0,WORLD.h-65,WORLD.w,WORLD.h);
  // Coastline ripples breathe gently around the islands.
  if(!reduced){ctx.strokeStyle='#e1e8c960';ctx.lineWidth=.8;islands.forEach(i=>{ctx.beginPath();ctx.arc(i.x,i.y,9+Math.sin(time*.65)*2,0,TAU);ctx.stroke();});}
  for(const t of treasures)if(!state.found.includes(t.id)&&!atlas)drawTreasure(ctx,t);
  // Historic route, revealed as the captain sails.
  if(state.visited.length>1){ctx.strokeStyle='#e4e4be56';ctx.lineWidth=1/s;ctx.setLineDash([3/s,6/s]);ctx.beginPath();state.visited.forEach((p,i)=>i&&Math.abs(p[0]-state.visited[i-1][0])<WORLD.w/2?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();ctx.setLineDash([]);}
  if(visibleFogDirty)updateFog();
  ctx.globalAlpha=atlas?.72:1;
  ctx.drawImage(fog,0,0,WORLD.w,WORLD.h);
  ctx.globalAlpha=1;
  if(atlas){ctx.save();ctx.strokeStyle='#456a5266';ctx.lineWidth=1/s;ctx.stroke(overviewCoast);ctx.lineCap='round';for(const channel of straits){traceStrait(ctx,channel);ctx.strokeStyle='#659991';ctx.lineWidth=channel.halfWidth*2;ctx.stroke();}ctx.restore();}
  // Soft contours inside the vast bank of unexplored cloud.
  for(const cloud of clouds){
    if(cloud.x+cloud.rx<left||cloud.x-cloud.rx>right||cloud.y+cloud.ry<top||cloud.y-cloud.ry>bottom)continue;
    let near=false;for(const p of state.visited){if(Math.hypot(deltaX(cloud.x,p[0]),cloud.y-p[1])<290){near=true;break;}}if(near)continue;
    const drift=reduced?0:Math.sin(time*.08+cloud.p)*7;
    const g=ctx.createRadialGradient(cloud.x+drift,cloud.y,2,cloud.x+drift,cloud.y,cloud.rx);g.addColorStop(0,night?'#e6eaf015':'#fffbe42e');g.addColorStop(1,'#fffbe400');ctx.fillStyle=g;ctx.save();ctx.translate(cloud.x+drift,cloud.y);ctx.scale(1,cloud.ry/cloud.rx);ctx.beginPath();ctx.arc(0,0,cloud.rx,0,TAU);ctx.restore();ctx.fill();
  }
  for(const island of islands){
    if(!state.discovered.includes(island.id)&&!atlas)continue;
    ctx.save();ctx.translate(island.x,island.y);ctx.scale(1/s,1/s);
    ctx.fillStyle='#f3e7b6';ctx.strokeStyle='#365848';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,4,0,TAU);ctx.fill();ctx.stroke();
    ctx.textAlign='center';ctx.font='600 10px "DM Sans", sans-serif';
    const labelWidth=ctx.measureText(island.name).width+16;
    ctx.fillStyle='#173d35ee';ctx.beginPath();ctx.roundRect(-labelWidth/2,10,labelWidth,22,4);ctx.fill();ctx.fillStyle='#fff4d3';ctx.fillText(island.name,0,25);
    if(!atlas){ctx.font='italic 11px "IM Fell English", Georgia';ctx.strokeStyle='#234838';ctx.lineWidth=3;ctx.strokeText(island.subtitle,0,47);ctx.fillStyle='#f2eacb';ctx.fillText(island.subtitle,0,47);}
    ctx.restore();
  }
  if(atlas){ctx.save();ctx.fillStyle='#365f5b';ctx.font=`italic ${12/s}px "IM Fell English",Georgia`;ctx.textAlign='center';for(const [name,lon,lat] of [['Pacific Ocean',-140,-12],['Atlantic Ocean',-35,3],['Indian Ocean',75,-28],['Southern Ocean',-30,-60]]){const p=project(lon,lat);ctx.fillText(name,p.x,p.y);}ctx.restore();}
  if(!atlas)drawSeabirds(ctx,state,time,reduced);
  for(const p of wake){ctx.fillStyle=`rgba(219,235,211,${p.life*.22})`;ctx.beginPath();ctx.ellipse(p.x,p.y,.2+(1-p.life),.1+(1-p.life)*.3,p.a,0,TAU);ctx.fill();}
  if(target){ctx.save();ctx.strokeStyle='#e3e5b0c0';ctx.lineWidth=1.5/s;ctx.setLineDash([3/s,7/s]);ctx.beginPath();let rx=state.x;ctx.moveTo(rx,state.y);route.forEach(p=>{rx+=deltaX(rx,p.x);ctx.lineTo(rx,p.y);});ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#edf1cb';ctx.beginPath();ctx.arc(target.x,target.y,10/s,0,TAU);ctx.stroke();ctx.restore();}
  drawShip(ctx);
  ctx.restore();
  }
  const shipScreen=toScreen(state.x,state.y);
  ctx.restore();
  if(!night&&!atlas)drawAtmosphere(ctx,w,h,time,atmosphere(state.elapsed),reduced);
  if(atlas){ctx.strokeStyle='#f8e4a5';ctx.fillStyle='#254b40';ctx.lineWidth=2;ctx.beginPath();ctx.arc(shipScreen.x,shipScreen.y,7,0,TAU);ctx.fill();ctx.stroke();}
  // A screen-space vessel marker stays readable at every zoom level.
  if(!night&&!atlas){
    const labelY=shipScreen.y+Math.max(23,6*s);
    ctx.strokeStyle='#eff4d28c';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(shipScreen.x,shipScreen.y+Math.max(5,2*s));ctx.lineTo(shipScreen.x,labelY-9);ctx.stroke();
    ctx.textAlign='center';ctx.font='500 8px "DM Sans",sans-serif';ctx.letterSpacing='1px';
    ctx.fillStyle='#183f3ed9';ctx.beginPath();ctx.roundRect(shipScreen.x-50,labelY-8,100,14,3);ctx.fill();ctx.fillStyle='#edf0d9';ctx.fillText('THE WANDERER',shipScreen.x,labelY+2);ctx.letterSpacing='0px';
  }
  if(night)drawStars();
  // Quiet cartographic frame around the chart.
  ctx.strokeStyle='#e1e6c524';ctx.lineWidth=1;ctx.strokeRect(9,9,w-18,h-18);
}
function drawStars(){
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0d213cca');g.addColorStop(.6,'#142c4350');g.addColorStop(1,'#152f3b08');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  for(const star of stars){const a=.25+(Math.sin(time*.6+star.p)+1)*.24;ctx.fillStyle=`rgba(235,236,209,${a})`;ctx.beginPath();ctx.arc(star.x*w,star.y*h*.8,star.r,0,TAU);ctx.fill();}
  if(unproject(state.x,state.y).lat<0){
    const px=w*.65,py=h*.48,points=[[px,py-38],[px,py+23],[px-22,py],[px+22,py-3]];
    ctx.strokeStyle='#bbd2df99';ctx.beginPath();ctx.moveTo(...points[0]);ctx.lineTo(...points[1]);ctx.moveTo(...points[2]);ctx.lineTo(...points[3]);ctx.stroke();
    for(const p of points){ctx.fillStyle='#f3e9c8';ctx.beginPath();ctx.arc(...p,2.5,0,TAU);ctx.fill();}
    ctx.textAlign='center';ctx.font='12px "DM Sans"';ctx.fillText('CRUX · THE SOUTHERN CROSS',px,py-58);
    ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(px,py+25);ctx.lineTo(px,py+140);ctx.stroke();ctx.setLineDash([]);ctx.font='10px "DM Sans"';ctx.fillText('Toward the south celestial pole',px,py+158);return;
  }
  const px=w*.63,py=h*.21;
  const constellation=[[px,py],[px+18,py+35],[px+53,py+55],[px+71,py+84],[px+113,py+91],[px+122,py+63],[px+84,py+54],[px+71,py+84]];
  ctx.strokeStyle='#b4c9da55';ctx.lineWidth=.7;ctx.beginPath();constellation.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();
  constellation.forEach((p,i)=>{ctx.fillStyle=i?'#d6e2df':'#f5e8bc';ctx.beginPath();ctx.arc(...p,i?1.7:3.1,0,TAU);ctx.fill();});
  const glow=ctx.createRadialGradient(px,py,1,px,py,22);glow.addColorStop(0,'#f5e8bb65');glow.addColorStop(1,'#f5e8bb00');ctx.fillStyle=glow;ctx.fillRect(px-22,py-22,44,44);ctx.fillStyle='#e6dec2';ctx.font='10px "DM Sans"';ctx.textAlign='center';ctx.fillText('POLARIS · NORTH',px,py-20);
  ctx.strokeStyle='#d5dfc833';ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(px,py+8);ctx.lineTo(px,h*.84);ctx.stroke();ctx.setLineDash([]);ctx.font='italic 12px "IM Fell English",Georgia';ctx.fillStyle='#b6ccca';ctx.fillText('Ursa Minor',px+115,py+116);
}

function addJournal(place,title,text){
  state.journal.push({ day:day(),place,title,text });renderJournal();
}
function showToast(title,text,eyebrow='A NEW DISCOVERY'){
  const toast=$('discovery-toast');toast.replaceChildren();
  const small=document.createElement('small');small.textContent=eyebrow;const strong=document.createElement('strong');strong.textContent=title;const p=document.createElement('p');p.textContent=text;toast.append(small,strong,p);toast.classList.add('visible');toastTimer=6;
}
function journalArticle(entry){
  const article=document.createElement('article');article.className='journal-entry';
  const dot=document.createElement('span');dot.className='journal-dot';
  const small=document.createElement('small');small.textContent=`DAY ${String(entry.day).padStart(2,'0')} · ${entry.place}`;
  const title=document.createElement('h4');title.textContent=entry.title;const p=document.createElement('p');p.textContent=entry.text;article.append(dot,small,title,p);return article;
}
function renderJournal(){
  $('journal-count').textContent=String(state.journal.length).padStart(2,'0');
  $('journal-entries').replaceChildren(journalArticle(state.journal.at(-1)));
  $('full-journal').replaceChildren(...[...state.journal].reverse().map(journalArticle));
}
function explored(){
  // Sample the traversable ocean on a fixed grid, counting each revealed cell once.
  let total=0,seen=0;
  for(let y=50;y<WORLD.h;y+=120)for(let x=50;x<WORLD.w;x+=120){if(isLand(x,y)||iceAt(x,y))continue;total++;if(state.visited.some(p=>Math.hypot(deltaX(p[0],x),p[1]-y)<220))seen++;}
  return Math.round(seen/total*100);
}
let exploredValue=explored();
function updateUI(){
  const speed=Math.hypot(state.vx,state.vy)/6;
  $('speed').textContent=speed.toFixed(1);
  const {lat,lon}=unproject(state.x,state.y);
  const deg=(Math.atan2(Math.cos(state.angle)*Math.cos(lat*Math.PI/180),-Math.sin(state.angle))*180/Math.PI+360)%360;
  const dir=['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];
  $('heading').innerHTML=`${String(Math.round(deg)%360).padStart(3,'0')}° <em>${dir}</em>`;
  $('compass-heading').textContent=`${String(Math.round(deg)%360).padStart(3,'0')}° ${dir}`;
  $('compass-needle').style.transform=`rotate(${deg}deg)`;
  const wi=wind();$('wind-speed').textContent=wi.speed.toFixed(0);$('wind-arrow').style.transform=`rotate(${wi.angle*180/Math.PI+45}deg)`;
  const relative=Math.abs(wrapAngle(state.angle-wi.angle));
  if(audioContext&&soundEnabled){const wash=reduced?.28:.25+(Math.sin(time*.55)+1)*.04;audioGain.gain.setTargetAtTime(wash+atmosphere(state.elapsed).rain*.08,audioContext.currentTime,.6);}
  $('sailing-state').textContent=state.stoppedBy?`Stopped · ${state.stoppedBy}`:state.anchored?'At anchor':state.sail===0?'Sails furled':relative>2.42?'Into the wind · tack':speed<1?'Catching the wind':relative<.7?'Running with the wind':'A steady reach';
  $('course-state').textContent=state.anchored?'Holding position':target&&straitAt(state.x,state.y,16)?'Channel pilot · slow ahead':target?'Following your course':'Free sailing';
  $('sail-percent').textContent=`${Math.round(state.sail*100)}%`;
  $('distance').textContent=state.distance.toFixed(1);$('treasures').textContent=`${state.found.length} / 4`;$('islands').textContent=`${state.discovered.length} / 7`;
  $('explored-percent').textContent=`${exploredValue}%`;$('explored-bar').style.width=`${exploredValue}%`;
  const minutes=(480+Math.floor(state.elapsed*8))%1440;
  $('day-label').innerHTML=`Day ${String(day()).padStart(2,'0')} <span>·</span> ${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  const latMinutes=Math.round(Math.abs(lat)*60),lonMinutes=Math.round(Math.abs(lon)*60);
  const latitude=`${Math.floor(latMinutes/60)}° ${String(latMinutes%60).padStart(2,'0')}′ ${lat>=0?'N':'S'}`;
  const longitude=`${Math.floor(lonMinutes/60)}° ${String(lonMinutes%60).padStart(2,'0')}′ ${lon>=0?'E':'W'}`;
  $('coordinates').textContent=`${latitude}  ·  ${longitude}`;
  $('star-title').textContent=lat>=0?'Polaris · the North Star':'Crux · the Southern Cross';
  $('star-altitude').textContent=lat>=0?`Altitude ${lat.toFixed(1)}° above the northern horizon`:'Polaris is below the horizon in the Southern Hemisphere.';
  $('star-guide').textContent=lat>=0?'Its height gives your approximate northern latitude.':'Extend the long axis of Crux about 4½ times toward the south celestial pole.';
  $('region-label').textContent=lat>66?'Arctic Ocean':lat<-60?'Southern Ocean':lon<-70||lon>145?'Pacific Ocean':lon<20?'Atlantic Ocean':lon<100?'Indian Ocean':'East Indies';
  const barStart=toWorld(0,h/2),barEnd=toWorld(66,h/2);
  $('scale-label').textContent=`${Math.round(nauticalMiles(barStart,barEnd)/3)} leagues`;
  $('weather-label').innerHTML=`<i></i>${night?'Clear stars, a quiet sea':atmosphere(state.elapsed).label}`;
  [['depart',state.departed],['treasure',state.found.length>0],['spice',state.won]].forEach(([id,done])=>{const el=$(`objective-${id}`);el.classList.toggle('complete',done);el.querySelector('span').textContent=done?'✓':'';});
  $('anchor-button').classList.toggle('anchored',state.anchored);$('anchor-button').lastElementChild.textContent=state.anchored?'Raise anchor':'Drop anchor';
  if(!state.anchored&&state.intro)state.intro=false;
  $('map-intro').hidden=!state.intro||night;$('map-intro').style.display=state.intro&&!night?'flex':'none';
}
function save(){
  try{localStorage.setItem('uncharted-globe-v3',JSON.stringify({...state,version:3}));$('save-label').textContent=cloudStatus()==='ready'?'Voyage saved locally + cloud sync queued':'Your voyage is saved as you sail';queueCloudSave(state);}catch{$('save-label').textContent='Browser storage unavailable · voyage not saved';}
}
// If cloud is configured and local save is fresh/new, try to restore cloud voyage.
if (cloudStatus() === 'ready') {
  loadCloudVoyage().then((cloud) => {
    if (!cloud || !Number.isFinite(cloud.x)) return;
    const localRaw = (() => { try { return localStorage.getItem('uncharted-globe-v3'); } catch { return null; } })();
    if (localRaw && localRaw.length > 500) return; // keep existing local progress
    const safe = nearestWater(cloud);
    if (safe) {
      state = { ...state, ...cloud, ...safe, vx: 0, vy: 0, anchored: true };
      camera = { x: state.x + 45, y: state.y - 15 };
      renderJournal(); updateUI();
    }
  });
}
function update(dt){
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('discovery-toast').classList.remove('visible');}
  if(isPaused())return;
  if(!reduced)time+=dt;
  oceanLife.update(dt,state,reduced);
  state.elapsed+=dt;shoreTimer=Math.max(0,shoreTimer-dt);
  const wi=wind();let steering=0;
  if(keys.has('a')||keys.has('arrowleft'))steering-=1;
  if(keys.has('d')||keys.has('arrowright'))steering+=1;
  if(steering){target=null;route=[];if(!state.stoppedBy)state.anchored=false;else state.angle=wrapAngle(state.angle+steering*dt*.8);}
  if(keys.has('w')||keys.has('arrowup')){state.sail=Math.min(1,state.sail+dt*.45);if(!state.stoppedBy||canDepart(state,state.angle)){state.anchored=false;state.stoppedBy=null;}}
  if(keys.has('s')||keys.has('arrowdown'))state.sail=Math.max(0,state.sail-dt*.45);
  if(target&&!state.anchored){
    while(route.length>1&&dist(state,route[0])<3&&clearPassage(state,route[1],3))route.shift();
    const waypoint=route[0]||target;
    const distance=dist(state,target);
    if(distance<2){target=null;route=[];state.anchored=true;state.vx=0;state.vy=0;showToast('Course complete','Anchor lowered. Choose your next horizon.','A MOMENT OF STILLNESS');}
    else{
      let desired=courseAngle(state,waypoint);
      // Alternate tacks when the intended course falls inside the no-go zone.
      if(!straitAt(state.x,state.y,16)&&Math.abs(wrapAngle(desired-wi.angle))>2.42){const sign=Math.sin(state.elapsed/9)>=0?1:-1;desired=wi.angle+sign*2.3;}
      const lookAhead=Math.min(45,Math.max(12,dist(state,waypoint)));
      if(!clearPassage(state,{x:state.x+Math.cos(desired)*lookAhead,y:state.y+Math.sin(desired)*lookAhead},3)){
        for(let step=1;step<=12;step++){
          let found=false;
          for(const side of [1,-1]){const a=desired+step*.26*side;if(clearPassage(state,{x:state.x+Math.cos(a)*lookAhead,y:state.y+Math.sin(a)*lookAhead},3)){desired=a;found=true;break;}}
          if(found)break;
        }
      }
      steering=Math.max(-1,Math.min(1,wrapAngle(desired-state.angle)*2.4));
    }
  }
  const speed=Math.hypot(state.vx,state.vy);
  const channelPilot=!state.anchored&&target&&straitAt(state.x,state.y,16);
  if(!state.anchored&&!channelPilot){
    state.angle=wrapAngle(state.angle+steering*dt*(.45+Math.min(speed/40,.6)));
    const relative=Math.abs(wrapAngle(state.angle-wi.angle));
    // Simplified lateen-rig polar: a broad reach is fastest; close-hauled is slower.
    let efficiency=relative>2.52?.025:relative>1.8?.42+(2.52-relative)*.65:.8+Math.sin(relative)*.24;
    const desiredSpeed=wi.speed*3.5*state.sail*efficiency;
    const current={x:1.7+Math.sin(state.y/160)*.7,y:Math.sin(state.x/240)*.7};
    const forward=state.vx*Math.cos(state.angle)+state.vy*Math.sin(state.angle);
    const lateral=-state.vx*Math.sin(state.angle)+state.vy*Math.cos(state.angle);
    const acceleration=(desiredSpeed-forward)*.34;
    state.vx+=(Math.cos(state.angle)*acceleration+Math.sin(state.angle)*lateral*1.8+(current.x-state.vx*.025))*dt;
    state.vy+=(Math.sin(state.angle)*acceleration-Math.cos(state.angle)*lateral*1.8+(current.y-state.vy*.025))*dt;
  }else if(state.anchored){const drag=Math.exp(-dt*3);state.vx*=drag;state.vy*=drag;}
  if(channelPilot)pilotChannel(state,route[0]||target,dt);
  const previous={x:state.x,y:state.y};
  if(!state.stoppedBy){
    const movement=moveVessel(state,state.vx*dt,state.vy*dt);
    if(movement.hit){target=null;route=[];keys.clear();showToast(`Ship stopped · ${movement.reason}`,'Sails secured. Turn toward open water, then press W or choose a new sea course.','OBSTACLE AHEAD');save();}
  }
  state.distance+=nauticalMiles(previous,state)/3;
  if(follow&&Math.abs(state.x-previous.x)>WORLD.w/2)camera.x+=state.x-previous.x;
  const lastPoint=state.visited.at(-1);
  if(Math.hypot(deltaX(state.x,lastPoint[0]),state.y-lastPoint[1])>25){state.visited.push([state.x,state.y]);visibleFogDirty=true;exploredValue=explored();}
  if(!state.departed&&dist(state,start)>75){state.departed=true;state.intro=false;addJournal('THE ATLANTIC','Beyond the harbor','Lisbon fades into the distance. We sail south along Africa before turning east around the Cape.');showToast('The voyage begins','Sail south around Africa, then east to the Moluccas.','LISBON, ASTERN');save();}
  for(const island of islands){
    if(!state.discovered.includes(island.id)&&dist(state,island)<65){
      state.discovered.push(island.id);addJournal(island.name,'Land on the horizon',`${island.subtitle}. We have added ${island.name.toLowerCase()} to our chart.`);showToast(island.name.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()),island.subtitle,'LAND DISCOVERED');
      if(island.id==='spice'&&!state.won){state.won=true;addJournal('THE SPICE LANDS','A passage, at last','The air carries cinnamon and cloves. We have connected our home to a new world.');$('victory-stats').textContent=`${state.distance.toFixed(1)} leagues sailed · ${state.discovered.length} lands charted · ${state.found.length} treasures recovered`;$('victory-dialog').showModal();keys.clear();}
      save();
    }
  }
  for(const treasure of treasures){if(!state.found.includes(treasure.id)&&dist(state,treasure)<42){state.found.push(treasure.id);addJournal('TREASURE RECOVERED',treasure.name,treasure.detail);showToast(treasure.name,treasure.detail,'TREASURE RECOVERED');save();}}
  if(follow){const k=1-Math.exp(-dt*1.8);camera.x+=(state.x+Math.min(45,w/(2*scale())*.3)-camera.x)*k;camera.y+=(state.y-15-camera.y)*k;}
  if(speed>4&&!state.anchored&&!reduced&&Math.random()<dt*14){wake.push({x:wrapX(state.x-Math.cos(state.angle)*2.5+(Math.random()-.5)*.4),y:state.y-Math.sin(state.angle)*2.5+(Math.random()-.5)*.4,a:state.angle,life:1});}
  for(let i=wake.length-1;i>=0;i--){wake[i].life-=dt*.3;if(wake[i].life<=0)wake.splice(i,1);}
  uiTimer+=dt;saveTimer+=dt;
  if(uiTimer>.2){updateUI();uiTimer=0;}if(saveTimer>4){save();saveTimer=0;}
}
function frame(timestamp){const dt=last?Math.min((timestamp-last)/1000,.05):.016;last=timestamp;update(dt);draw();requestAnimationFrame(frame);}

function setCourse(event){
  if(night){showToast('The stars are your compass','Return to the geographic chart to set your next course.','READING THE HEAVENS');return;}
  const rect=canvas.getBoundingClientRect();let point=toWorld(event.clientX-rect.left,event.clientY-rect.top);
  if(point.y<0||point.y>WORLD.h){showToast('Polar waters','The chart shows the whole Earth. Choose a point within the globe’s latitudes.','GLOBAL CHART');return;}
  point=normalizePosition(point.x,point.y);
  point=nearestWater(point);
  const planned=point?planRoute(state,point):null;
  if(!planned){showToast('No open-water passage','Choose a point offshore with a navigable route from your ship.','CHARTING A COURSE');return;}
  target=point;route=planned;state.stoppedBy=null;state.anchored=false;if(state.sail<.1)state.sail=1;follow=zoom>1;canvas.focus({preventScroll:true});updateUI();
}
let drag=null,skipClick=false;
canvas.style.touchAction='none';
canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,cx:camera.x,cy:camera.y,moved:false};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved){follow=false;camera.x=drag.cx-dx/scale();camera.y=Math.max(0,Math.min(WORLD.h,drag.cy-dy/scale()));}});
canvas.addEventListener('pointerup',()=>{skipClick=!!drag?.moved;drag=null;follow=zoom>1;});
canvas.addEventListener('pointercancel',()=>{drag=null;skipClick=true;follow=zoom>1;});
canvas.addEventListener('click',event=>{if(skipClick){skipClick=false;return;}setCourse(event);});
function setZoom(value){
  const wasFollowing=follow;
  zoom=Math.max(.1,Math.min(7,value));
  follow=zoom>1;
  if(follow){
    atlas=false;
    $('atlas-button').textContent='World chart';
    // Reacquire the vessel when zooming in from a panned or global chart.
    if(!wasFollowing)camera={x:state.x+Math.min(45,w/(2*scale())*.3),y:state.y-15};
  }
}
canvas.addEventListener('wheel',event=>{event.preventDefault();setZoom(zoom*Math.exp(-event.deltaY*.001));},{passive:false});
$('zoom-in').onclick=()=>setZoom(zoom*1.3);$('zoom-out').onclick=()=>setZoom(zoom/1.3);
function centerShip(){atlas=false;follow=true;camera={x:state.x+45,y:state.y-15};zoom=2.8;$('atlas-button').textContent='World chart';}
$('recenter').onclick=centerShip;
$('atlas-button').onclick=()=>{if(atlas){centerShip();return;}atlas=true;follow=false;camera={x:WORLD.w/2,y:WORLD.h/2};zoom=Math.min((w-35)/WORLD.w,(h-35)/WORLD.h)/Math.min(w/920,h/500);$('atlas-button').textContent='Follow ship';};
function toggleAnchor(){if(state.stoppedBy&&!canDepart(state,state.angle)){showToast('Turn toward open water','Use A / D to turn, then W to sail clear of the obstacle.','VESSEL STOPPED');return;}state.stoppedBy=null;state.anchored=!state.anchored;target=null;route=[];updateUI();save();}
$('anchor-button').onclick=toggleAnchor;
$('dismiss-intro').onclick=()=>{state.intro=false;updateUI();save();};
$('dismiss-star-guide').onclick=()=>{$('celestial-info').hidden=true;};
document.addEventListener('keydown',event=>{
  if(event.target.matches('input,textarea')||event.ctrlKey||event.metaKey||event.altKey)return;
  if(document.querySelector('dialog[open]'))return;
  const key=event.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','h'].includes(key))event.preventDefault();
  if(key===' '&&!event.repeat)toggleAnchor();else if(key==='h'&&!event.repeat)openHandbook();else keys.add(key);
});
document.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();save();});
document.addEventListener('visibilitychange',()=>{keys.clear();if(document.hidden)save();});
window.addEventListener('pagehide',save);
function toggleStars(){night=!night;visibleFogDirty=true;$('celestial-info').hidden=!night;$('chart-mode').innerHTML=`${svg(night?'compass':'stars')}<span>${night?'Return to chart':'Read the stars'}</span>`;if(night){state.anchored=true;target=null;}updateUI();}
$('chart-mode').onclick=toggleStars;

const lessons={
  sailing:`<div class="lesson-visual">${svg('ship')}<span>Work with the wind.<small>A lateen sail can do more than follow it.</small></span></div><h3>The wind is your engine.</h3><p>Your caravel gathers speed gradually. Its hull resists sideways motion, but currents can still carry you off course. Turning the bow does not instantly change your momentum.</p><h4>Find a good point of sail</h4><p>The wind here blows from the southwest toward the northeast. A broad reach — wind over the rear quarter — is usually fastest. Sailing straight into the wind leaves your sails luffing.</p><h4>To go upwind, tack</h4><p>Sail diagonally across the wind, then turn your bow through it and take the opposite diagonal. This zigzag course gains ground where a straight line cannot. Click-to-sail performs these tacks for you.</p><h4>Mind your sail and your speed</h4><p><kbd>A</kbd> / <kbd>D</kbd> turn the rudder. <kbd>W</kbd> / <kbd>S</kbd> raise or shorten sail. <kbd>SPACE</kbd> lowers the anchor. The arrow keys work too. On touch screens, tap the water to sail and use the anchor button to stop.</p><div class="lesson-tip"><strong>Try it:</strong> Steer northeast and watch your speed increase. Turn southwest and feel the sail lose its power. This game uses simplified wind, inertia, drag, currents, and shoreline collisions.</div>`,
  stars:`<div class="lesson-visual">${svg('stars')}<span>A sky for each hemisphere.<small>Polaris in the north · Crux in the south</small></span></div><h3>Find your place beneath the stars.</h3><p>Select <strong>Read the stars</strong> to anchor and inspect a teaching diagram appropriate to your ship’s actual geographic latitude.</p><h4>North of the equator: Polaris</h4><p>Polaris lies close to the north celestial pole. Follow the Big Dipper’s outer bowl stars about five times their separation to find it. Its altitude above the northern horizon approximately equals your northern latitude. At Lisbon, this is about 39°.</p><h4>South of the equator: the Southern Cross</h4><p>Polaris disappears below the horizon. Extend the long axis of Crux about 4½ times from its foot to estimate the south celestial pole. Drop a line from that point to the horizon to find south. The pole’s altitude approximately equals your southern latitude.</p><h4>Longitude was the harder mystery</h4><p>In 1487, reliable marine timekeepers did not yet exist. Sailors estimated east–west travel using heading, time, and speed — dead reckoning. The game’s coordinate panel shows real chart coordinates as a learning aid; historical sailors could not read longitude this precisely.</p><div class="lesson-tip"><strong>Chart notes:</strong> The map is north-up and equirectangular, so east–west distances stretch at higher latitudes. The compass corrects the ship’s heading for latitude. Coastlines are generalized Natural Earth data; stars, travel time, and wind are simplified for play.</div>`,
  signs:`<div class="lesson-visual">${svg('island')}<span>A real coast. A new story.<small>Lisbon → the Cape → the Moluccas</small></span></div><h3>Read the coast and chart your passage.</h3><h4>A geographic route to the Spice Lands</h4><p>Leave Lisbon southward along the Atlantic coast of Africa. Round the Cape of Good Hope, then cross the Indian Ocean. Mozambique, Calicut, and Malacca are optional discoveries along the journey. Your destination is the Banda Islands in the Moluccas, eastern Indonesia.</p><h4>Plan with the world chart</h4><p>Select <strong>World chart</strong> to see real continental outlines beneath the cloud cover. Click offshore to plot a water-only course around land. Select <strong>Follow ship</strong> to return to local sailing. Clouds still mark waters you have not explored.</p><h4>Watch the birds and the water</h4><p>Coastal birds, floating vegetation, and changes in swell can suggest nearby land. Pale turquoise coastal bands on this chart mark the shoreline; slow down before approaching. Coastlines are generalized, and decorative shallow-water colors are not surveyed depths.</p><h4>Keep a careful reckoning</h4><p>The dashed trail records your passage, and the captain’s log preserves discoveries. One sea league here is three nautical miles. The scale bar updates with zoom and latitude. Sail near floating treasure chests to recover them.</p><div class="lesson-tip"><strong>Your first treasure:</strong> A lost coffer lies near 32° N, 12° W, south-southwest of Lisbon. This is an imagined expedition beginning in 1487; the complete European sea passage to the Moluccas was established later.</div>`
};
lessons.sailing+=`<h4>When the hull meets an obstacle</h4><p>Land, rocks, and polar sea ice bring the ship to a complete stop. Your course is cancelled and the anchor is secured. Turn with <kbd>A</kbd> / <kbd>D</kbd>, then press <kbd>W</kbd> when facing open sea. You can also click a safe offshore point to set a new course. The whole hull is checked along its movement, so speed cannot carry it through a narrow island.</p>`;
lessons.sailing+=`<h4>Sailing through straits</h4><p>Major straits are widened for play and marked by a pale dotted channel line. Click beyond a strait to chart a passage. A local pilot automatically takes the vessel through at slow speed, turning carefully at bends instead of making wide upwind tacks. This represents assisted towing or warping in confined waters. Manual steering remains available.</p><p>The Malacca and Singapore passage, Gibraltar, Sunda, Lombok, Bab el-Mandeb, Hormuz, the English Channel, and the Turkish straits use gameplay-adjusted widths rather than exact geographic widths.</p>`;
lessons.signs+=`<h4>A whole world, without an ocean wall</h4><p>The chart includes the Americas, Europe, Africa, Asia, Oceania, and Antarctica. Sail across 180° longitude and continue on the other side of the chart. Drag to pan and scroll to move between coastal detail and the global view. The former edge was the boundary of a regional chart; it has been removed.</p><p>At the poles, the caravel encounters visible sea ice rather than a map-edge bounce. Rock outcrops and polar ice are simplified gameplay hazards. Coastlines use Natural Earth’s generalized geographic data.</p><h4>A living ocean</h4><p>Watch for dolphin pods, surfacing whales, and circling coastal birds. Sunlight warms at dawn and dusk; passing showers sweep across the water. These atmospheric effects and animals are decorative. Pale surf and a dark coastal contour separate land from navigable sea. The small ship’s label points to its exact location.</p>`;
function selectLesson(page){$('handbook-content').innerHTML=lessons[page];document.querySelectorAll('[data-page]').forEach(button=>{const selected=button.dataset.page===page;button.classList.toggle('selected',selected);button.setAttribute('aria-selected',selected);});}
function openDialog(id){keys.clear();save();$(id).showModal();}
function openHandbook(){selectLesson('sailing');openDialog('handbook-dialog');}
$('handbook-nav').onclick=openHandbook;$('handbook-card').onclick=openHandbook;
document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>selectLesson(button.dataset.page));
document.querySelectorAll('.close-dialog').forEach(button=>button.onclick=()=>button.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});dialog.addEventListener('close',()=>{keys.clear();last=0;});});
document.querySelector('.close-handbook').onclick=()=>$('handbook-dialog').close();
$('journal-button').onclick=()=>{renderJournal();openDialog('journal-dialog');};
$('settings-button').onclick=()=>{$('reset-confirm').hidden=true;openDialog('settings-dialog');};
$('voyage-tab').onclick=()=>{wrap.scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});canvas.focus({preventScroll:true});};
$('motion-setting').onchange=event=>{reduced=event.target.checked;if(reduced)wake.length=0;};
$('reset-button').onclick=()=>{$('reset-confirm').hidden=false;};
$('confirm-reset').onclick=()=>{state=defaultState();target=null;route=[];night=false;centerShip();wake.length=0;oceanLife.clear();visibleFogDirty=true;exploredValue=explored();$('celestial-info').hidden=true;$('chart-mode').innerHTML=`${svg('stars')}<span>Read the stars</span>`;$('discovery-toast').classList.remove('visible');renderJournal();updateUI();save();$('settings-dialog').close();};
$('continue-button').onclick=()=>$('victory-dialog').close();
async function toggleSound(enabled=!soundEnabled){
  try{
    if(!audioContext){
      audioContext=new (window.AudioContext||window.webkitAudioContext)();
      const buffer=audioContext.createBuffer(1,audioContext.sampleRate*6,audioContext.sampleRate),data=buffer.getChannelData(0);let previous=0;
      for(let i=0;i<data.length;i++){previous=(previous+Math.random()*.04-.02)/1.025;data[i]=previous*3;}
      noiseSource=audioContext.createBufferSource();noiseSource.buffer=buffer;noiseSource.loop=true;
      const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;audioGain=audioContext.createGain();audioGain.gain.value=0;noiseSource.connect(filter);filter.connect(audioGain);audioGain.connect(audioContext.destination);noiseSource.start();
    }
    await audioContext.resume();soundEnabled=enabled;audioGain.gain.setTargetAtTime(enabled?.35:0,audioContext.currentTime,.8);$('sound-button').innerHTML=svg(enabled?'sound':'sound-off');$('sound-button').title=enabled?'Mute ocean sounds':'Enable ocean sounds';$('sound-button').setAttribute('aria-label',$('sound-button').title);$('sound-setting').checked=enabled;
  }catch{showToast('A quieter ocean','Ocean audio is not supported by this browser.','SOUND SETTINGS');$('sound-setting').checked=false;}
}
$('sound-button').onclick=()=>toggleSound();$('sound-setting').onchange=event=>toggleSound(event.target.checked);
reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;$('motion-setting').checked=reduced;
renderJournal();updateUI();requestAnimationFrame(frame);
