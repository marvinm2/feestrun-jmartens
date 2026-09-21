const fs=require('fs'); const src=fs.readFileSync('solve_final.js','utf8');
const head=src.slice(0,src.indexOf('function solve('));
const inner=src.slice(src.indexOf('function solve('),src.indexOf('  const results={};'))+'\n  return {stepState,L,tileAt,PERIOD,nearMover,overlap};\n}\n';
const mod=new Function('require','process',head+inner+'\nreturn {solve,ctx};')(require,process);
const T=32,PW=32,PH=38;
const {stepState,L,PERIOD,nearMover,overlap}=mod.solve('L2',mod.ctx.SEGS2);
function search(cur,g,budget){
  const gx=g.x+g.w/2, gy=g.y+g.h/2;
  const key=s=>{ const yq=Math.round(s[1]/4)+10, vxq=Math.round(s[2]*2)+10, vyq=Math.round(s[3])+20, tq=nearMover(s[0])?Math.floor(((s[4]%PERIOD)+PERIOD)%PERIOD/4):0; return ((((Math.round(s[0]/4)*160+yq)*24+vxq)*40+vyq)*100+tq)*2+s[5]; };
  const seen=new Set([key(cur)]); const heap=[];
  const push=(pr,st)=>{ heap.push([pr,st]); let i=heap.length-1; while(i>0){ const p=(i-1)>>1; if(heap[p][0]<=heap[i][0]) break; [heap[p],heap[i]]=[heap[i],heap[p]]; i=p; } };
  const pop=()=>{ const top=heap[0]; const last=heap.pop(); if(heap.length){ heap[0]=last; let i=0; for(;;){ const l=2*i+1,r=l+1; let m=i; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===i) break; [heap[m],heap[i]]=[heap[i],heap[m]]; i=m; } } return top; };
  const h=s=>Math.abs(s[0]+PW/2-gx)+Math.abs(s[1]+PH/2-gy)*1.5+s[4]*0.02;
  push(h(cur),cur); let n=0;
  while(heap.length&&n<budget){ const [pr,s]=pop(); n++;
    if(overlap(s[0],s[1],PW,PH,g.x,g.y,g.w,g.h)&&(!g.grounded||s[5])) return {s,n};
    for(const inL of [0,1]) for(const inR of [0,1]){ if(inL&&inR) continue; for(const inJ of [0,1]){ const ns=stepState(s,inL,inR,inJ); if(!ns) continue; const k=key(ns); if(seen.has(k)) continue; seen.add(k); push(h(ns),ns); } } }
  return {s:null,n};
}
// waypoint: stand on top surface of tile row R at column range [c0,c1]: feet box just above row R
const stand=(c0,c1,R,name)=>({name,x:c0*T,y:R*T-PH-2,w:(c1-c0+1)*T,h:PH+2,grounded:true});
const WP=[
  stand(183,187,10,'schap rij 10 (seg6 col 3-7)'),
  stand(186,190,6,'schap rij 6 (seg6 col 6-10)'),
  {name:'op N-platform (seg6 col 15)',x:195*T,y:6*T,w:3*T,h:6*T,grounded:true},
  stand(198,202,4,'schap rij 4 met item 9'),
  stand(203,206,13,'blokje met springplank (col 203-206)'),
  stand(210,216,7,'hoog schap seg7 rij 7'),
  stand(219,225,9,'schap seg7 rij 9'),
  stand(227,232,11,'schap seg7 rij 11'),
  stand(233,239,13,'grond bij kassa'),
  {name:'KASSA',x:L.kassa.x+8,y:L.kassa.y,w:T*2-16,h:T*2},
];
for(const ph of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
  L.movers.forEach(m=>m.ph=ph);
  let cur=[182*T,13*T-PH,0,0,0,1,0,0,0,-1,0]; console.log('phase',ph.toFixed(2));
  for(const g of WP){ const r=search(cur,g,600000); console.log('  ',g.name,':',r.s?`OK (frame ${r.s[4]}, explored ${r.n})`:`NOT FOUND (explored ${r.n})`); if(!r.s) break; cur=r.s; }
}
