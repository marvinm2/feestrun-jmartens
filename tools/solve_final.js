const fs=require('fs');
const html=fs.readFileSync('artifact.html','utf8');
const segSrc=html.slice(html.indexOf('const SEGS1='),html.indexOf('const LEVELS='));
const ctx={}; new Function('with(this){'+segSrc+'; this.SEGS1=SEGS1; this.SEGS2=SEGS2;}').call(ctx);
const T=32,COLS=30,ROWS=17,W=960,H=544;
const G=0.5,JUMP=12,JUMP_CUT=4,MAXV=4.2,SPRING=19,COYOTE=10,JBUF=12;
const PW=32,PH=38;
function build(segs){
  const LW=segs.length*COLS, tiles=new Uint8Array(LW*ROWS), L={coins:[],items:[],springs:[],enemies:[],movers:[],flags:[],kassa:null,start:null};
  for(let r=0;r<ROWS;r++){ let row=''; for(const s of segs) row+=(s[r]||'').padEnd(COLS,' ').slice(0,COLS);
    for(let c=0;c<LW;c++){ const ch=row[c],px=c*T,py=r*T;
      if(ch==='#')tiles[r*LW+c]=1; else if(ch==='-')tiles[r*LW+c]=2; else if(ch==='^')tiles[r*LW+c]=3;
      else if(ch==='@')L.start={x:px,y:py+T-PH};
      else if(ch==='o')L.coins.push({x:px+16,y:py+16,c});
      else if(ch>='0'&&ch<='9')L.items.push({i:+ch,x:px+16,y:py+16,c,r});
      else if(ch==='S')L.springs.push({x:px,y:py});
      else if(ch==='P')L.enemies.push({x:px+1,y:py+T-22,c,r});
      else if(ch==='M')L.movers.push({x0:px,y0:py,axis:'x',amp:96});
      else if(ch==='N')L.movers.push({x0:px,y0:py,axis:'y',amp:64});
      else if(ch==='F')L.flags.push({x:px,y:py});
      else if(ch==='K')L.kassa={x:px,y:py-T};
    }}
  return {LW,tiles,L};
}
function solve(name,segs){
  const {LW,tiles,L}=build(segs);
  const tileAt=(cx,cy)=>{ if(cx<0||cx>=LW) return 1; if(cy<0||cy>=ROWS) return 0; return tiles[cy*LW+cx]; };
  const movers=L.movers; // phase: all movers share t (random phase in game! -> we test phase offsets separately)
  const overlap=(ax,ay,aw,ah,bx,by,bw,bh)=>ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;
  const moverPos=(m,t)=>{ const s=Math.sin(m.ph+t*0.022)*m.amp; return m.axis==='x'?{x:m.x0+s,y:m.y0}:{x:m.x0,y:m.y0+s}; };
  const nearMover=x=>movers.some(m=>Math.abs(m.x0+48-x)<260);
  const PERIOD=2*Math.PI/0.022;
  // state: [x,y,vx,vy,t,grounded,coyote,jbuf,jheld,onPlat(-1 or idx)]
  function stepState(s,inL,inR,inJ){
    let [x,y,vx,vy,t,grounded,coyote,jbuf,jheld,onPlat,jumping]=s; grounded=!!grounded; jheld=!!jheld; jumping=!!jumping;
    t++;
    let carryDx=0,carryDy=0;
    if(onPlat>=0){ const m=movers[onPlat]; const p0=moverPos(m,t-1),p1=moverPos(m,t); carryDx=p1.x-p0.x; carryDy=p1.y-p0.y; x+=carryDx; y+=carryDy; }
    onPlat=-1;
    if(inJ&&!jheld) jbuf=JBUF; jheld=inJ;
    const tv=(inR?MAXV:0)-(inL?MAXV:0);
    vx+=(tv-vx)*(grounded?0.3:0.2); if(Math.abs(vx)<0.05) vx=0;
    if(grounded) coyote=COYOTE; else if(coyote>0) coyote--;
    if(jbuf>0) jbuf--;
    if(jbuf>0&&coyote>0){ vy=-JUMP; jbuf=0; coyote=0; grounded=false; jumping=true; }
    if(!inJ&&jumping&&vy<-JUMP_CUT) vy=-JUMP_CUT;
    if(vy>=0) jumping=false;
    vy=Math.min(vy+G,14);
    x+=vx;
    const y0=Math.floor((y+1)/T),y1=Math.floor((y+PH-2)/T);
    if(vx>0){ const cx=Math.floor((x+PW-1)/T); for(let cy=y0;cy<=y1;cy++) if(tileAt(cx,cy)===1){ x=cx*T-PW; vx=0; break; } }
    else if(vx<0){ const cx=Math.floor(x/T); for(let cy=y0;cy<=y1;cy++) if(tileAt(cx,cy)===1){ x=(cx+1)*T; vx=0; break; } }
    const prevBottom=y+PH; y+=vy; grounded=false;
    const x0=Math.floor((x+4)/T),x1=Math.floor((x+PW-5)/T);
    if(vy>=0){ const cy=Math.floor((y+PH-1)/T); for(let cx=x0;cx<=x1;cx++){ const tt=tileAt(cx,cy); if(tt===1||(tt===2&&prevBottom<=cy*T+0.5)){ y=cy*T-PH; vy=0; grounded=true; break; } } }
    else { const cy=Math.floor(y/T); for(let cx=x0;cx<=x1;cx++) if(tileAt(cx,cy)===1){ y=(cy+1)*T; vy=0; break; } }
    movers.forEach((m,i)=>{ const p=moverPos(m,t),p0=moverPos(m,t-1); const dy=p.y-p0.y; if(vy>=0&&prevBottom<=p.y+Math.abs(dy)+2&&y+PH>=p.y&&x+PW-4>p.x&&x+4<p.x+96){ y=p.y-PH; vy=0; grounded=true; onPlat=i; } });
    for(const sp of L.springs){ if(vy>=0&&overlap(x+4,y,PW-8,PH,sp.x+4,sp.y+T-18,24,18)){ vy=-SPRING; grounded=false; coyote=0; jumping=false; } }
    const hx=x+8,hy=y+8,hw=PW-16,hh=PH-10;
    for(let cy=Math.floor(hy/T);cy<=Math.floor((hy+hh)/T);cy++) for(let cx=Math.floor(hx/T);cx<=Math.floor((hx+hw)/T);cx++) if(tileAt(cx,cy)===3&&overlap(hx,hy,hw,hh,cx*T+4,cy*T+8,T-8,T-8)) return null;
    if(y>H+40) return null;
    return [x,y,vx,vy,t,grounded?1:0,coyote,jbuf,jheld?1:0,onPlat,jumping?1:0];
  }
  const results={};
  // best-first search per goal (items ordered by x, then kassa), starting from the state that reached the previous goal
  const goals=[...L.items].sort((a,b)=>a.x-b.x).map(it=>({name:'item '+it.i+' (c'+it.c+',r'+it.r+')',x:it.x-20,y:it.y-20,w:40,h:40}));
  if(L.kassa) goals.push({name:'kassa',x:L.kassa.x+8,y:L.kassa.y,w:T*2-16,h:T*2});
  for(const ph of [0,Math.PI]){
    movers.forEach(m=>m.ph=ph);
    let cur=[L.start.x,L.start.y,0,0,0,1,0,0,0,-1]; const out=[]; let retried=false; const goalsLeft=[...goals];
    while(goalsLeft.length){ const g=goalsLeft.shift();
      const gx=g.x+g.w/2, gy=g.y+g.h/2;
      const key=s=>{ const yq=Math.round(s[1]/4)+10, vxq=Math.round(s[2]*2)+10, vyq=Math.round(s[3])+20, tq=nearMover(s[0])?Math.floor(((s[4]%PERIOD)+PERIOD)%PERIOD/4):0; return ((((Math.round(s[0]/4)*160+yq)*24+vxq)*40+vyq)*100+tq)*2+s[5]; };
      const seen=new Set([key(cur)]);
      // simple binary heap on heuristic
      const heap=[]; const push=(pr,st)=>{ heap.push([pr,st]); let i=heap.length-1; while(i>0){ const p=(i-1)>>1; if(heap[p][0]<=heap[i][0]) break; [heap[p],heap[i]]=[heap[i],heap[p]]; i=p; } };
      const pop=()=>{ const top=heap[0]; const last=heap.pop(); if(heap.length){ heap[0]=last; let i=0; for(;;){ const l=2*i+1,r=l+1; let m=i; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===i) break; [heap[m],heap[i]]=[heap[i],heap[m]]; i=m; } } return top; };
      const h=s=>Math.abs(s[0]+PW/2-gx)*1.0+Math.abs(s[1]+PH/2-gy)*1.5+s[4]*0.02;
      push(h(cur),cur); let n=0, found=null, best=1e9, bestS=null;
      while(heap.length&&n<2.5e6){ const [pr,s]=pop(); n++; if(pr<best){ best=pr; bestS=s; }
        if(overlap(s[0],s[1],PW,PH,g.x,g.y,g.w,g.h)){ found=s; break; }
        for(const inL of [0,1]) for(const inR of [0,1]) { if(inL&&inR) continue; for(const inJ of [0,1]){ const ns=stepState(s,inL,inR,inJ); if(!ns) continue; const k=key(ns); if(seen.has(k)) continue; seen.add(k); push(h(ns),ns); } } }
      if(!found&&!retried){ // respawn at last checkpoint passed (game keeps collected items)
        const flags=L.flags.filter(f=>f.x<cur[0]).sort((a,b)=>b.x-a.x); const rs=flags.length?{x:flags[0].x,y:flags[0].y+T-PH}:L.start;
        out.push(`${g.name}: dead-end from previous state (explored ${n}); retrying from checkpoint col ${rs.x/T}`); cur=[rs.x,rs.y,0,0,cur[4]+70,1,0,0,0,-1]; retried=true; goalsLeft.unshift(g); continue; }
      out.push(`${g.name}: ${found?'OK in '+found[4]+' frames (explored '+n+')':'NOT FOUND (explored '+n+', best dist '+Math.round(best)+') best state col '+(bestS[0]/T).toFixed(1)+' row '+((bestS[1]+PH)/T).toFixed(2)+' vx '+bestS[2].toFixed(1)+' t '+bestS[4]+' grounded '+bestS[5]}`);
      retried=false; if(found) cur=found;
    }
    results['phase '+ph.toFixed(2)]=out;
  }
  console.log(name); for(const k in results){ console.log(' ',k); for(const l of results[k]) console.log('    ',l); }
  console.log('items at cols:',L.items.map(i=>`${i.i}@c${i.c}r${i.r}`).join(' '),'| kassa col',L.kassa&&L.kassa.x/T);
}
solve('LEVEL 2',ctx.SEGS2);
solve('LEVEL 1',ctx.SEGS1);
