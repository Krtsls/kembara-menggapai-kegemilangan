// Deliberately widened gameplay channels along real sea passages (not canals).
// The same geometry is used for the visible water and the collision mask.
const project = ([lon,lat]) => ({x:(lon+180)*20,y:(90-lat)*20});
export const straits = [
  {name:'Strait of Malacca',points:[[95,6],[97.5,5.1],[99,4],[100.3,3],[101.5,2.1],[102.6,1.6],[103.45,1.15],[104.4,1.15],[105.2,1.6]]},
  {name:'Strait of Gibraltar',points:[[-7,35.8],[-6,35.9],[-5.55,35.95],[-5.1,35.95],[-4.3,36.1]]},
  {name:'Sunda Strait',points:[[104.5,-5.2],[105.25,-5.8],[105.65,-6.2],[105.5,-7]]},
  {name:'Lombok Strait',points:[[115.6,-7.6],[115.75,-8.25],[115.75,-8.8],[115.7,-9.3]]},
  {name:'Bab el-Mandeb',points:[[42.4,13.7],[43,12.8],[43.45,12.5],[44,12.2]]},
  {name:'Strait of Hormuz',points:[[55.5,26.5],[56.1,26.65],[56.6,26.5],[57.2,25.7]]},
  {name:'English Channel',points:[[-2,50],[0,50.6],[1.4,51],[2.2,51.6]]},
  {name:'Bosporus & Dardanelles',points:[[25.5,39.8],[26.2,40.05],[26.7,40.45],[28,40.7],[28.95,40.95],[29.1,41.25],[29.5,41.5]]},
].map(s=>({...s,points:s.points.map(project),halfWidth:9}));

export function straitAt(x,y,extra=0){
  x=((x%7200)+7200)%7200;
  for(const strait of straits){
    for(let i=1;i<strait.points.length;i++){
      const a=strait.points[i-1],b=strait.points[i],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));
      if(Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<strait.halfWidth+extra)return strait;
    }
  }
  return null;
}

export function traceStrait(context,strait){
  context.beginPath();strait.points.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));
}

export function carveStraits(context){
  context.save();context.globalCompositeOperation='destination-out';context.lineCap='round';context.lineJoin='round';
  for(const strait of straits){traceStrait(context,strait);context.lineWidth=strait.halfWidth*2;context.stroke();}
  context.restore();
}
