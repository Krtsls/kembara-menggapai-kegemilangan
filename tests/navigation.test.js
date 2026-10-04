import { project, unproject, WORLD, rocks, blocked, isLand, planRoute, clearPassage, nauticalMiles, nearestWater, straits, deltaX } from '../src/geography.js';
import { moveVessel, HULL_RADIUS, SHIP_SCALE, pilotChannel } from '../src/navigation-physics.js';

export function runNavigationTests() {
  const passed=[];
  function check(name,condition){if(!condition)throw new Error(name);passed.push(name);}
  check('Full world extent',WORLD.w===7200&&WORLD.h===3600);
  for(const [name,lon,lat,land] of [['North America',-100,40,true],['South America',-60,-10,true],['Australia',135,-25,true],['Pacific',-150,0,false],['Atlantic',-30,0,false]]){
    const p=project(lon,lat);check(`${name} geographic coverage`,isLand(p.x,p.y)===land);
  }
  for(const direction of [1,-1]){
    const s={...project(direction*179.9,0),vx:direction*20,vy:0,anchored:false};
    const result=moveVessel(s,direction*8,0);
    check(`Dateline crossing ${direction}`,!result.hit&&Math.sign(unproject(s.x,s.y).lon)===-direction&&s.vx===direction*20);
  }
  const rock=rocks[0],rockShip={x:rock.x-20,y:rock.y,vx:100,vy:0,anchored:false};
  const hit=moveVessel(rockShip,40,0);
  check('Swept movement detects rock instead of tunneling',hit.hit&&hit.reason==='rocks');
  check('Rock collision stops and anchors vessel',rockShip.vx===0&&rockShip.vy===0&&rockShip.anchored);
  check('Entire hull remains offshore',!blocked(rockShip.x,rockShip.y,HULL_RADIUS));
  const ship={...project(-10.5,38.5),vx:200,vy:0,anchored:false};
  check('Land collision stops vessel',moveVessel(ship,100,0).reason==='land'&&ship.anchored&&ship.vx===0);
  check('Land collision leaves hull outside land',!blocked(ship.x,ship.y,HULL_RADIUS));
  const polar={...project(0,84),vx:0,vy:-100,anchored:false};
  check('Visible polar sea ice stops vessel',moveVessel(polar,0,-80).reason==='sea ice'&&polar.anchored);
  const a=project(179,0),b=project(-179,0),route=planRoute(a,b);
  check('Route planner crosses Pacific seam directly',route?.length===1&&clearPassage(a,b));
  check('Distance takes short dateline crossing',nauticalMiles(a,b)>119&&nauticalMiles(a,b)<121);
  const from=project(-10.1,38.3),to=nearestWater(project(129.9,-4.52)),passage=planRoute(from,to);
  check('Spice Lands remain reachable',!!passage);
  check('Every planned segment avoids obstacles',passage.every((point,i)=>clearPassage(i?passage[i-1]:from,point,HULL_RADIUS)));
  check('Vessel is less than half its previous size',SHIP_SCALE<.11&&HULL_RADIUS===SHIP_SCALE*25);
  for(const channel of straits){
    const start=channel.points[0],end=channel.points.at(-1),route=planRoute(start,end);
    check(`${channel.name}: route available`,!!route);
    check(`${channel.name}: whole hull fits`,route.every((p,i)=>clearPassage(i?route[i-1]:start,p,HULL_RADIUS)));
    const vessel={...start,vx:0,vy:0,angle:0,anchored:false};let next=0,collision=false;
    for(let tick=0;tick<20000&&next<route.length;tick++){
      const waypoint=route[next];
      if(Math.hypot(deltaX(vessel.x,waypoint.x),vessel.y-waypoint.y)<.3){next++;continue;}
      pilotChannel(vessel,waypoint,.05);
      if(moveVessel(vessel,vessel.vx*.05,vessel.vy*.05).hit){collision=true;break;}
    }
    check(`${channel.name}: pilot completes passage without grounding`,!collision&&next===route.length);
  }
  return {passed:passed.length,checks:passed};
}
