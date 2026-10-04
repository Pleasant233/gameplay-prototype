// Visual regions only. Nothing here mutates game state or awards resources.
(function(root){
  const FAMILIES={forest:'forest',rain:'forest',bare:'mountain',peak:'mountain',
    water:'lake',wet:'lake',pollute_water:'dirtyLake',grass:'meadow',fertile:'meadow',
    valley:'river',creek:'river',rock:'rock',pollute_rock:'dirtyRock',sand:'sand',
    barren:'dry',waste:'dry',pollute_earth:'dirty',lava:'lava',mine:'mine',ruin:'ruin'};
  const NAMES={forest:'森林',mountain:'山脉',lake:'湖泊',dirtyLake:'浊水',meadow:'草甸',
    river:'溪谷',rock:'岩地',dirtyRock:'污染山地',sand:'沙丘',dry:'荒原',dirty:'污染荒原',lava:'熔岩',mine:'矿脉',ruin:'遗迹'};
  const MILESTONES=[3,6,10];
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  function noise(key){let h=2166136261;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;}
  function plan(cells,types){
    const byCell={},regions=[],families={};
    const keys=Object.keys(cells).sort();
    for(const k of keys)families[k]=FAMILIES[types[cells[k].type].look];
    for(const k of keys){
      if(byCell[k])continue;
      const family=families[k],members=[k],seen=new Set([k]);
      for(let i=0;i<members.length;i++){
        const [x,z]=members[i].split(',').map(Number);
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const n=`${x+dx},${z+dz}`;
          if(families[n]===family&&!seen.has(n)){seen.add(n);members.push(n);}
        }
      }
      members.sort();
      const level=MILESTONES.filter(n=>members.length>=n).length;
      const boundary=[],points=members.map(k=>k.split(',').map(Number));
      for(const [x,z] of points){
        if(!seen.has(`${x+1},${z}`))boundary.push([x+.5,z-.5,x+.5,z+.5]);
        if(!seen.has(`${x-1},${z}`))boundary.push([x-.5,z-.5,x-.5,z+.5]);
        if(!seen.has(`${x},${z+1}`))boundary.push([x-.5,z+.5,x+.5,z+.5]);
        if(!seen.has(`${x},${z-1}`))boundary.push([x-.5,z-.5,x+.5,z-.5]);
      }
      const region={family,name:NAMES[family],members,points,cellSet:seen,boundary,level,size:members.length,
        signature:family+':'+members.map(k=>k+'='+cells[k].type).join('|')};
      members.forEach(k=>byCell[k]=region);regions.push(region);
    }
    return {byCell,regions};
  }
  // Distance to the exposed perimeter of a UNION, not to each tile's edges.
  // Internal seams have no shore/bank and cannot cut a ridge or forest in half.
  function clearance(region,x,z){
    let d=Infinity;
    for(const [ax,az,bx,bz] of region.boundary){
      const px=Math.max(Math.min(ax,bx),Math.min(Math.max(ax,bx),x));
      const pz=Math.max(Math.min(az,bz),Math.min(Math.max(az,bz),z));
      d=Math.min(d,Math.hypot(x-px,z-pz));
    }
    const inside=region.points.some(([cx,cz])=>Math.abs(cx-x)<=.500001&&Math.abs(cz-z)<=.500001);
    return inside?d:-d;
  }
  function ridge(region,x,z){
    const edge=smooth(clearance(region,x,z)/.24);
    if(!edge)return 0;
    let height=0;
    for(const [cx,cz] of region.points){
      if(Math.abs(cx-x)>1.9||Math.abs(cz-z)>1.9)continue;
      const seed=noise(`${cx},${cz}`),dx=x-cx-(seed-.5)*.22,dz=z-cz-(noise('z'+cx+','+cz)-.5)*.22;
      const r=Math.hypot(dx*.95,dz*1.08);
      if(r<.82)height=Math.max(height,Math.pow(Math.max(0,1-r/.82),1.12)*(.62+seed*.4));
      for(const [dx,dz] of [[1,0],[0,1]])if(region.cellSet.has(`${cx+dx},${cz+dz}`)){
        const t=Math.max(0,Math.min(1,(x-cx)*dx+(z-cz)*dz));
        const distance=Math.hypot(x-cx-t*dx,z-cz-t*dz);
        height=Math.max(height,(.31+region.level*.025)*Math.pow(Math.max(0,1-distance/.38),1.3));
      }
    }
    const folds=1+region.level*.035*Math.sin(x*13+z*9)*Math.sin(z*11-x*4);
    return height*edge*(1+region.level*.19)*folds;
  }
  function density(region,low){
    return Math.max(2,Math.round((4+region.level*2+Math.min(3,Math.floor(region.size/8)))*(low?.7:1)));
  }
  // Includes merges of old components; reports only newly joined cells.
  function growth(previous,next){
    const events=[];
    for(const r of next.regions){
      const old=new Set(r.members.map(k=>previous.byCell[k]).filter(p=>p&&p.family===r.family));
      const oldSize=Math.max(0,...[...old].map(p=>p.size));
      if(r.size<=oldSize||r.size<2)continue;
      const added=r.members.filter(k=>!previous.byCell[k]||previous.byCell[k].family!==r.family);
      if(!added.length)continue;
      const milestone=MILESTONES.some(n=>oldSize<n&&r.size>=n);
      events.push({region:r,origin:added[0],milestone,merged:old.size>1});
    }
    return events;
  }
  const api={plan,clearance,ridge,density,growth,MILESTONES};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Landscape=api;
})(this);
