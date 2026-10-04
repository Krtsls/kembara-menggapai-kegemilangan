import { blocked, clearPassage, normalizePosition, obstacleAt, deltaX } from './geography.js';
import { straitAt } from './straits.js';

// Hull is ~4.8 world units long; collision footprint shrinks with the artwork.
export const SHIP_SCALE = .10;
export const HULL_RADIUS = 2.5;
export function moveVessel(state, dx, dy) {
  const end={x:state.x+dx,y:state.y+dy};
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.75));
  let safe={x:state.x,y:state.y};
  for(let i=1;i<=steps;i++){
    const point={x:state.x+dx*i/steps,y:state.y+dy*i/steps};
    if(blocked(point.x,point.y,HULL_RADIUS)){
      state.x=normalizePosition(safe.x,safe.y).x;state.y=safe.y;
      state.vx=0;state.vy=0;state.anchored=true;state.stoppedBy=obstacleAt(point.x,point.y,HULL_RADIUS)||'land';
      return {hit:true,reason:state.stoppedBy};
    }
    safe=point;
  }
  Object.assign(state,normalizePosition(end.x,end.y));
  return {hit:false};
}
export function canDepart(state,angle){
  return clearPassage(state,{x:state.x+Math.cos(angle)*10,y:state.y+Math.sin(angle)*10},HULL_RADIUS);
}
export function courseAngle(a,b){return Math.atan2(b.y-a.y,deltaX(a.x,b.x));}

// A local pilot warps/tows the vessel slowly through confined water. This
// gameplay assist avoids wide upwind tacks and overshooting channel bends.
export function pilotChannel(state,waypoint,dt){
  if(!straitAt(state.x,state.y,16))return false;
  const dx=deltaX(state.x,waypoint.x),dy=waypoint.y-state.y,distance=Math.hypot(dx,dy);
  const angle=Math.atan2(dy,dx);
  const error=Math.atan2(Math.sin(angle-state.angle),Math.cos(angle-state.angle));
  const turn=Math.max(-dt*1.5,Math.min(dt*1.5,error));state.angle+=turn;
  const speed=Math.abs(error)>.15?0:Math.min(5,distance/Math.max(dt,.001));
  state.vx=distance?dx/distance*speed:0;state.vy=distance?dy/distance*speed:0;
  return true;
}
