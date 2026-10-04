import { blocked, clearPassage, wrapX } from './geography.js';

// Decorative marine life lives in world space and respects the coastline.
export function createOceanLife() {
  let creatures=[],spawnClock=12;
  return {
    update(dt,ship,reduced){
      spawnClock+=dt;
      creatures=creatures.filter(c=>c.age<c.lifetime);
      for(const c of creatures){
        c.age+=dt;
        if(reduced)continue;
        const next={x:wrapX(c.x+Math.cos(c.angle)*c.speed*dt),y:c.y+Math.sin(c.angle)*c.speed*dt};
        if(!clearPassage(c,next,2)){c.angle+=Math.PI*.7;continue;}
        c.x=next.x;c.y=next.y;
      }
      if(spawnClock<16||creatures.length>10)return;
      spawnClock=0;
      const a=Math.random()*Math.PI*2,p={x:wrapX(ship.x+Math.cos(a)*45),y:ship.y+Math.sin(a)*40};
      if(blocked(p.x,p.y,12))return;
      const whale=Math.random()<.25;
      for(let i=0;i<(whale?1:3);i++){
        const x=wrapX(p.x+i*3),y=p.y+i*2;if(blocked(x,y,4))continue;
        creatures.push({x,y,angle:a+Math.PI/2,speed:whale?1:2.7,age:i*.5,lifetime:whale?22:18,whale});
      }
    },
    draw(ctx,view,time,reduced){
      const {left,right,top,bottom}=view;
      for(const c of creatures){
        if(c.x<left||c.x>right||c.y<top||c.y>bottom)continue;
        const phase=reduced?.6:(Math.sin(c.age*2)+1)/2;
        const opacity=Math.min(1,c.age/2,(c.lifetime-c.age)/3);
        ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);ctx.globalAlpha=Math.max(0,opacity);
        ctx.fillStyle=c.whale?'#174b5b77':'#a0c6c877';ctx.beginPath();ctx.ellipse(0,0,c.whale?4:1.8,c.whale?1.3:.5,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=c.whale?'#254e5c':'#426d79';ctx.beginPath();ctx.ellipse(0,-phase*.5,c.whale?2.8:1.3,c.whale?.9:.4,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.moveTo(-.5,0);ctx.lineTo(-1,-1.2*phase);ctx.lineTo(.8,0);ctx.fill();
        if(c.whale&&phase>.75){ctx.strokeStyle='#e1f0df99';ctx.lineWidth=.35;ctx.beginPath();ctx.moveTo(1,0);ctx.quadraticCurveTo(2,-3,3,-2);ctx.moveTo(1,0);ctx.quadraticCurveTo(0,-3,-1,-2);ctx.stroke();}
        if(phase>.6){ctx.strokeStyle='#d1e6d077';ctx.lineWidth=.2;ctx.beginPath();ctx.ellipse(-2,0,3,1,0,0,Math.PI*2);ctx.stroke();}
        ctx.restore();
      }
    },
    get count(){return creatures.length;},
    clear(){creatures=[];spawnClock=12;}
  };
}

export function drawLocalWater(ctx,view,time,ship,reduced){
  const {left,right,top,bottom,s}=view;
  if(s<.5)return;
  const spacing=13;
  ctx.lineWidth=.25;
  for(let y=Math.floor(top/spacing)*spacing;y<bottom;y+=spacing){
    for(let x=Math.floor(left/spacing)*spacing;x<right;x+=spacing){
      const seed=Math.sin(x*12.9898+y*78.233)*43758.5453,noise=seed-Math.floor(seed);
      const xx=x+noise*8,yy=y+noise*5;
      if(blocked(xx,yy,0))continue;
      const pulse=reduced?.5:(Math.sin(time*.7+noise*15)+1)/2;
      ctx.strokeStyle=`rgba(218,241,218,${.07+pulse*.13})`;
      const drift=reduced?0:Math.sin(time*.45+noise*12)*2;
      ctx.beginPath();ctx.moveTo(xx+drift,yy);ctx.quadraticCurveTo(xx+2+drift,yy+.6,xx+4+drift,yy);ctx.stroke();
      if(noise>.87){ctx.fillStyle=`rgba(255,245,206,${pulse*.45})`;ctx.fillRect(xx+2,yy-2,.35,.35);}
    }
  }
  // Bow wave makes the tiny vessel readable without enlarging the hull.
  if(!ship.anchored&&Math.hypot(ship.vx,ship.vy)>3){
    ctx.save();ctx.translate(ship.x,ship.y);ctx.rotate(ship.angle);ctx.strokeStyle='#e6f0d8aa';ctx.lineWidth=.25;
    ctx.beginPath();ctx.moveTo(-3,-2);ctx.quadraticCurveTo(1,-1.3,2.8,0);ctx.quadraticCurveTo(1,1.3,-3,2);ctx.stroke();ctx.restore();
  }
}

export function drawSeabirds(ctx,ship,time,reduced){
  if(!blocked(ship.x,ship.y,45))return;
  ctx.strokeStyle='#fff3dacc';ctx.lineWidth=.32;
  for(let i=0;i<5;i++){
    const orbit=reduced?i:time*.10+i;
    const x=ship.x+Math.cos(orbit)*24+i*2,y=ship.y-18+Math.sin(orbit)*12;
    const flap=reduced?.3:Math.sin(time*4+i)*.8;
    ctx.beginPath();ctx.moveTo(x-1.4,y+flap);ctx.quadraticCurveTo(x-.5,y-.4,x,y);ctx.quadraticCurveTo(x+.5,y-.4,x+1.4,y+flap);ctx.stroke();
  }
}

export function atmosphere(elapsed){
  const hour=(8+elapsed*8/60)%24;
  const dusk=hour>=17&&hour<20;
  const dark=hour>=20||hour<5;
  const dawn=hour>=5&&hour<8;
  const squall=(Math.sin(elapsed/39)+1)/2;
  return {hour,dusk,dark,dawn,rain:Math.max(0,(squall-.84)/.16),label:dark?'Moonlit water, stars overhead':dusk?'Golden dusk across the sea':dawn?'First light on the horizon':squall>.87?'A passing shower over the sea':'Sunlit swells, a living sea'};
}

export function drawAtmosphere(ctx,w,h,time,weather,reduced){
  if(weather.dark){ctx.fillStyle='#10254338';ctx.fillRect(0,0,w,h);}
  else if(weather.dusk||weather.dawn){const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#f7bf6330');g.addColorStop(1,'#d4856408');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
  if(weather.rain>.05){
    ctx.fillStyle=`rgba(40,65,79,${weather.rain*.13})`;ctx.fillRect(0,0,w,h);
    if(!reduced){ctx.strokeStyle=`rgba(215,237,228,${weather.rain*.32})`;ctx.lineWidth=.6;ctx.beginPath();
      for(let i=0;i<65;i++){const x=((i*137.3-time*50)%w+w)%w,y=(i*93.7+time*160)%h;ctx.moveTo(x,y);ctx.lineTo(x-3,y+8);}ctx.stroke();}
  }
}
