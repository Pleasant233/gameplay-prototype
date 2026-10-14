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
    const bagCount=s=>Game.bagCount(s);
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
      const node=document.createElement('span');node.className='token toon'+(f.hero?' pure-hero':'');node.style.setProperty('--token-color',f.color);
      const icon=document.createElement('i');icon.textContent=f.icon;node.appendChild(icon);
      const count=document.createElement('small');count.textContent=Math.abs(f.count)>1?'×'+Math.abs(f.count):'';node.appendChild(count);
      if(f.hero){const label=document.createElement('b');label.textContent='至纯'+GameData.ELEMENTS.find(e=>e.key===f.el).name+'元素结晶';node.appendChild(label);count.textContent='对应魔法覆盖 +1 格 · 上限 5 格';}layer.appendChild(node);f.node=node;return node;
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
        if(!to||age>=(f.hero?(reduced.matches?1100:3200):1050)){active.splice(i,1);arrive(f);continue;}
        let x,y,scale=1;
        if(f.hero){
          const cx=innerWidth/2,cy=innerHeight*.44;
          if(reduced.matches){x=cx;y=cy;scale=1.3;}
          else if(age<650){const u=age/650;x=-120+(cx+120)*u;y=-180+(cy+180)*u;scale=.5+u*.9;}
          else if(age<2400){x=cx;y=cy;scale=1.4;}
          else {const u=Math.min(1,(age-2400)/800);x=cx+(to.x-cx)*u*u;y=cy+(to.y-cy)*u*u;scale=1.4*(1-u)+.25*u;}
        }
        else if(age<180&&!f.down){const t=age/180;x=f.from.x+(f.scatter.x-f.from.x)*t;y=f.from.y+(f.scatter.y-f.from.y)*(1-(1-t)**2);scale=.6+t*.5;}
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
        const existing=queue.find(x=>x.target===f.target&&!x.down&&!x.hero)||active.find(x=>x.target===f.target&&!x.down&&!x.hero);
        if(existing){existing.delta+=f.delta;existing.count+=f.count;if(existing.node)existing.node.querySelector('small').textContent='×'+Math.abs(existing.count);return;}
        arrive(f);return;
      }
      queue.push(f);if(!raf)raf=requestAnimationFrame(tick);
    }
    function enqueue(events) {
      const cells=new Map(),now=performance.now();
      events.forEach(e=> {
        if(['achievement','purify','cancer','infection','meteor','shield','predation','upgrade','guardianMerge','guardianMove','guardian','pureCrystal','spell','vanish','degrade','range','mapComplete','stageClear','relation','memory','autoMerge','animalAwaken'].includes(e.kind))return;
        if(!cells.has(e.cell))cells.set(e.cell,cells.size);
        const count=e.n==null?1:e.n,color=COLORS[e.el]||'#ffe14a';
        let target='score',delta=e.score||0,icon='✦';
        if(e.kind==='place'){target='left';delta=-count;icon='⬢';}
        if(['crystal','bigCrystal','inverseCrystal','item'].includes(e.kind)){target='bag';delta=count;icon=e.kind==='item'?'🎒':'◆';}
        if(e.kind==='plant')icon='🌱';
        if(e.kind==='animal')icon='🐾';
        if(e.kind==='attr'){delta=count;icon=(count<0?'−':'+')+Math.abs(count);}
        schedule({cell:e.cell,target,delta,count,icon,color,due:now+cells.get(e.cell)*40,arc:(Math.random()-.5)*120});
      });
    }
    function revealPure(e){
      pending.bag+=e.n;
      if(queue.length+active.length>=40){if(queue.length)arrive(queue.shift());else arrive(active.shift());}
      queue.push({hero:true,el:e.el,from:{x:innerWidth/2,y:innerHeight*.44},target:'bag',delta:e.n,count:e.n,icon:'✧',color:COLORS[e.el],due:performance.now()+(reduced.matches?0:1600)});
      numbers(options.state());
      if(!raf)raf=requestAnimationFrame(tick);
    }
    function down(cell,el,done) {
      schedule({cell,from:center(targets.bag),down:true,done,delta:0,count:1,icon:'◆',color:COLORS[el]||'#fff',due:performance.now(),arc:30});
    }
    function reset() {
      cancelAnimationFrame(raf);raf=0;queue=[];active=[];layer.replaceChildren();
      pending.score=pending.left=pending.bag=0;sequence=0;
    }
    return {enqueue,revealPure,down,numbers,reset};
  }
  root.TokenFlights={create};
})(this);
