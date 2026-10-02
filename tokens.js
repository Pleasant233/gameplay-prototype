// Cosmetic flights own HUD delays; the game state always changes immediately.
(function(root) {
  const COLORS={metal:'#f2c230',wood:'#5ccf3a',water:'#3fa6ff',fire:'#ff6a3a',earth:'#d09a5a'};
  function create(options) {
    const $=id=>document.getElementById(id);
    const layer=$('tokens'), targets={score:$('pillScore'),left:$('pillLeft'),bag:$('btnBag')};
    const pending={score:0,left:0,bag:0};
    let queue=[],active=[],raf=0,sequence=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const center=el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
    const bagCount=s=>Object.values(s.inv.crystal).reduce((a,b)=>a+b,0)+Object.values(s.inv.bigCrystal).reduce((a,b)=>a+b,0)+Object.values(s.inv.ore).reduce((a,b)=>a+b,0)+s.inv.wood+s.inv.bucket+s.inv.charm;
    function numbers(s) {
      $('score').textContent=options.score(s)-pending.score;
      $('left').textContent=options.left(s)-pending.left;
      $('bagCount').textContent=Math.max(0,bagCount(s)-pending.bag);
    }
    function arrive(f) {
      if(f.target){pending[f.target]-=f.delta;options.bump(targets[f.target]);options.ding(sequence++%12);}
      if(f.done)f.done();
      if(f.node)f.node.remove();
      if(options.state())numbers(options.state());
    }
    function makeNode(f) {
      const node=document.createElement('span');node.className='token toon';node.style.setProperty('--token-color',f.color);
      const icon=document.createElement('i');icon.textContent=f.icon;node.appendChild(icon);
      const count=document.createElement('small');count.textContent=Math.abs(f.count)>1?'×'+Math.abs(f.count):'';node.appendChild(count);
      layer.appendChild(node);f.node=node;return node;
    }
    function tick(now) {
      raf=0;
      for(let i=queue.length-1;i>=0;i--) {
        const f=queue[i];if(now<f.due)continue;queue.splice(i,1);
        f.from=f.from||options.project(f.cell);
        if(!f.from){arrive(f);continue;}
        f.start=now;f.scatter={x:f.from.x+(Math.random()-.5)*48,y:f.from.y-36-Math.random()*20};
        makeNode(f);if(f.cell&&!f.down)options.burstAt(f.cell);active.push(f);
      }
      for(let i=active.length-1;i>=0;i--){
        const f=active[i],age=now-f.start,to=f.down?options.project(f.cell):center(targets[f.target]);
        if(!to||age>=1050){active.splice(i,1);arrive(f);continue;}
        let x,y,scale=1;
        if(age<180&&!f.down){const t=age/180;x=f.from.x+(f.scatter.x-f.from.x)*t;y=f.from.y+(f.scatter.y-f.from.y)*(1-(1-t)**2);scale=.6+t*.5;}
        else if(age<330&&!f.down){x=f.scatter.x;y=f.scatter.y;scale=1.1;}
        else {
          const u=Math.max(0,Math.min(1,(age-(f.down?0:330))/(f.down?700:720))),t=u*u;
          const a=f.down?f.from:f.scatter;
          const control={x:(a.x+to.x)/2+(f.arc||0),y:Math.min(a.y,to.y)-70};
          x=(1-t)**2*a.x+2*(1-t)*t*control.x+t*t*to.x;
          y=(1-t)**2*a.y+2*(1-t)*t*control.y+t*t*to.y;scale=1.1-.65*u;
          if(f.down&&u===1){active.splice(i,1);arrive(f);continue;}
        }
        f.node.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) scale(${scale})`;
      }
      if(queue.length||active.length)raf=requestAnimationFrame(tick);
    }
    function schedule(f) {
      if(f.target)pending[f.target]+=f.delta;
      if(reduced.matches){arrive(f);return;}
      if(queue.length+active.length>=40) {
        const existing=queue.find(x=>x.target===f.target&&!x.down)||active.find(x=>x.target===f.target&&!x.down);
        if(existing){existing.delta+=f.delta;existing.count+=f.count;if(existing.node)existing.node.querySelector('small').textContent='×'+Math.abs(existing.count);return;}
        arrive(f);return;
      }
      queue.push(f);if(!raf)raf=requestAnimationFrame(tick);
    }
    function enqueue(events) {
      const cells=new Map(),now=performance.now();
      events.forEach(e=> {
        if(!cells.has(e.cell))cells.set(e.cell,cells.size);
        const count=e.n==null?1:e.n,color=COLORS[e.el]||'#ffe14a';
        let target='score',delta=e.score||0,icon='✦';
        if(e.kind==='place'){target='left';delta=-count;icon='⬢';}
        if(['crystal','bigCrystal','ore','wood','item'].includes(e.kind)){target='bag';delta=count;icon=e.kind==='wood'?'🪵':e.kind==='item'?'🎒':'◆';}
        if(e.kind==='plant')icon='🌱';
        if(e.kind==='animal')icon='🐾';
        if(e.kind==='oreSpawn')icon='◆';
        if(e.kind==='attr'){delta=count;icon=(count<0?'−':'+')+Math.abs(count);}
        schedule({cell:e.cell,target,delta,count,icon,color,due:now+cells.get(e.cell)*40,arc:(Math.random()-.5)*120});
      });
    }
    function down(cell,el,done) {
      schedule({cell,from:center(targets.bag),down:true,done,delta:0,count:1,icon:'◆',color:COLORS[el]||'#fff',due:performance.now(),arc:30});
    }
    function reset() {
      cancelAnimationFrame(raf);raf=0;queue=[];active=[];layer.replaceChildren();
      pending.score=pending.left=pending.bag=0;sequence=0;
    }
    return {enqueue,down,numbers,reset};
  }
  root.TokenFlights={create};
})(this);
