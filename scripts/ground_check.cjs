// Test-only scene inspection and before/after rendering for ground z-fighting.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','ground');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],screenshots:[],samples:[]};
function check(name,value){assert.ok(value,name);report.checks.push(name);console.log('ok - '+name);}
function instrument(source){return source.replace('  root.View = {',`
  root.__groundTest={
    prepare(){
      intro=0;shake=0;hoverK=null;selectedK=null;modeRef=null;
      Object.values(tileMap).forEach(n=>{n.rise=0;n.pop=0;n.lift=0;n.impact=0;n.group.position.y=0;n.group.scale.setScalar(1);});
      const base=scene.children.find(o=>o.material&&o.material.color&&o.material.color.getHex()===0x805838);
      base.geometry.computeBoundingBox();
      const minWall=Math.min(...Object.values(pads).map(p=>{p.geometry.computeBoundingBox();return p.geometry.boundingBox.min.y;}));
      return {overlap:Math.max(0,base.geometry.boundingBox.max.y-minWall),bottom:base.geometry.boundingBox.min.y,visiblePads:Object.values(pads).filter(p=>p.visible).length};
    },
    draw(time,theta,atmosphere){
      camera.position.setFromSpherical(new THREE.Spherical(18,.95,theta)).add(new THREE.Vector3(0,.2,0));camera.lookAt(0,.2,0);camera.updateMatrixWorld();
      updateHighlights(0,time);if(post){post.enabled=atmosphere;post.render(scene,camera,new THREE.Vector3(0,.2,0),0);}else renderer.render(scene,camera);
      const gl=renderer.getContext();gl.finish();
      const pixels=[];
      // Sample centers of the front exterior walls that previously overlapped.
      for(const [x,z] of G.SHAPE)for(const [dx,dz] of [[1,0],[0,1]])if(!G.SHAPE_KEYS.has(G.key(x+dx,z+dz))){
        const p=wp(G.key(x,z),-.16);p.x+=dx*T/2;p.z+=dz*T/2;p.project(camera);
        const px=Math.round((p.x*.5+.5)*gl.drawingBufferWidth),py=Math.round((p.y*.5+.5)*gl.drawingBufferHeight);
        if(px>1&&py>1&&px<gl.drawingBufferWidth-2&&py<gl.drawingBufferHeight-2){const rgb=new Uint8Array(36);gl.readPixels(px-1,py-1,3,3,gl.RGBA,gl.UNSIGNED_BYTE,rgb);pixels.push(...rgb);}
      }
      return {pixels,error:gl.getError(),near:camera.near,far:camera.far};
    },
    pick(k){const n=tileMap[k],p=wp(k,surfaceHeight(k,0,0)+.005);if(n)p.y+=n.group.position.y;p.project(camera);const r=renderer.domElement.getBoundingClientRect();return pickCell((p.x*.5+.5)*r.width+r.left,(-p.y*.5+.5)*r.height+r.top);}
  };
  root.View = {`);}
const server=http.createServer((req,res)=>{
  const f=path.resolve(root,'.'+((req.url||'/').split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(f).pipe(res);
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    const options={headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.PLAYWRIGHT_BROWSER_CHANNEL)options.channel=process.env.PLAYWRIGHT_BROWSER_CHANNEL;
    browser=await chromium.launch(options);report.browser=browser.version();
    const variants=process.env.GROUND_BASELINE_SOURCE?['before','fixed']:['fixed'];
    for(const mobile of [false,true])for(const variant of variants){
      const label=(mobile?'phone':'desktop')+'-'+variant;
      const ctx=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 iPhone Mobile'}:{viewport:{width:1200,height:800}});
      const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(label+': '+e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(label+': '+m.text());});
      const source=fs.readFileSync(variant==='before'?process.env.GROUND_BASELINE_SOURCE:path.join(root,'view.js'),'utf8');
      await page.route('**/view.js',r=>r.fulfill({body:instrument(source),contentType:'application/javascript'}));
      await page.clock.install();await page.goto('http://127.0.0.1:'+server.address().port);
      await page.waitForFunction('typeof S!=="undefined"&&S&&window.__groundTest');
      await page.clock.pauseAt(new Date(await page.evaluate('Date.now()')+60000));
      await page.evaluate(`start(37);S.mode='endless';for(let i=0;i<14;i++){G.act(S,{type:'place',offer:0,cell:G.legalPlacements(S).find(k=>G.SHAPE_KEYS.has(k))});G.endRound(S);}S.mode='challenge';S.events=[];selected=null;mode=null;Tokens.reset();render();`);
      const state=await page.evaluate('__groundTest.prepare()');report.samples.push({label,...state});
      if(variant==='before')check(label+' reproduces overlapping exterior walls',state.overlap>.3);
      else{check(label+' base never overlaps terrain side walls',state.overlap<1e-6);check(label+' preserves bottom and empty cells',Math.abs(state.bottom+.34)<1e-6&&state.visiblePads===66);}
      for(const [angle,theta] of [['front',.78],['rear',3.92]]){
        for(const atmosphere of [false,true]){
          const frames=[];for(const time of [0,.4,.8])frames.push(await page.evaluate(({time,theta,atmosphere})=>__groundTest.draw(time,theta,atmosphere),{time,theta,atmosphere}));
          check(label+' '+angle+' '+(atmosphere?'post':'plain')+' renders without GL errors',frames.every(f=>f.error===0&&f.pixels.length));
          if(variant==='fixed')check(label+' '+angle+' '+(atmosphere?'post':'plain')+' static wall pixels stay identical',frames.every(f=>JSON.stringify(f.pixels)===JSON.stringify(frames[0].pixels)));
          if(atmosphere){const name='ground-'+label+'-'+angle+'.png';await page.screenshot({path:path.join(out,name),animations:'disabled'});report.screenshots.push(name);}
        }
      }
      if(variant==='fixed'){
        await page.evaluate('__groundTest.draw(0,.78,true)');const empty=await page.evaluate('G.legalPlacements(S)[0]');
        check(label+' empty ground and occupied terrain remain pickable',await page.evaluate(k=>__groundTest.pick(k)===k&&__groundTest.pick('3,3')==='3,3',empty));
        const score=await page.evaluate(`Number(document.querySelector('#score').textContent)===G.score(S).total`);check(label+' preserves game score and HUD',score);
      }
      await ctx.close();
    }
    check('No console, JavaScript or shader errors',!report.errors.length);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'ground-report.json'),JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
