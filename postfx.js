// Offline post processing: soft highlight bloom and depth-driven aperture blur.
(function(root) {
  const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
  function create(renderer, options) {
    const low=!!options.low;
    const depthSupported=renderer.capabilities.isWebGL2||renderer.extensions.has('WEBGL_depth_texture');
    const Target=!low&&renderer.capabilities.isWebGL2?THREE.WebGLMultisampleRenderTarget:THREE.WebGLRenderTarget;
    const sceneTarget=new Target(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true,stencilBuffer:!depthSupported});
    if(sceneTarget.isWebGLMultisampleRenderTarget)sceneTarget.samples=2;
    // 24-bit depth keeps thin terrain outlines and liquid surfaces from fighting.
    // r128 matches its MSAA depth renderbuffer to this texture type.
    if(depthSupported)sceneTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    const makeTarget=()=>new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false});
    const bright=makeTarget(),blurA=makeTarget(),blurB=makeTarget();
    const material=(uniforms,fragmentShader,defines)=>new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader,uniforms,defines:defines||{},depthTest:false,depthWrite:false,toneMapped:false});
    const extract=material({source:{value:sceneTarget.texture}},`
      varying vec2 vUv;uniform sampler2D source;
      void main(){
        vec3 c=texture2D(source,vUv).rgb;float hi=max(c.r,max(c.g,c.b));float lo=min(c.r,min(c.g,c.b));
        // Keep white cloud banks from washing out the entire scene.
        float mask=smoothstep(0.76,1.05,hi)*mix(0.12,1.0,smoothstep(0.05,0.35,hi-lo));
        gl_FragColor=vec4(c*mask,1.0);
      }`);
    const blur=material({source:{value:bright.texture},stepUv:{value:new THREE.Vector2()}},`
      varying vec2 vUv;uniform sampler2D source;uniform vec2 stepUv;
      void main(){
        vec3 c=texture2D(source,vUv).rgb*0.227027;
        c+=(texture2D(source,vUv+stepUv*1.384615).rgb+texture2D(source,vUv-stepUv*1.384615).rgb)*0.316216;
        c+=(texture2D(source,vUv+stepUv*3.230769).rgb+texture2D(source,vUv-stepUv*3.230769).rgb)*0.070270;
        gl_FragColor=vec4(c,1.0);
      }`);
    const combine=material({
      source:{value:sceneTarget.texture},depth:{value:sceneTarget.depthTexture||sceneTarget.texture},bloom:{value:blurB.texture},
      texel:{value:new THREE.Vector2(1,1)},near:{value:.1},far:{value:400},focusDepth:{value:15},focusRange:{value:1.7},
      aperture:{value:5.0},maxBlur:{value:low?4.0:7.5},bloomStrength:{value:low?.14:.18},
      aspect:{value:1},focusUv:{value:new THREE.Vector2(.5,.6)},depthEnabled:{value:depthSupported?1:0},vignette:{value:.065}
    },`
      varying vec2 vUv;uniform sampler2D source;uniform sampler2D depth;uniform sampler2D bloom;
      uniform vec2 texel;uniform vec2 focusUv;uniform float near;uniform float far;uniform float focusDepth;
      uniform float focusRange;uniform float aperture;uniform float maxBlur;uniform float bloomStrength;uniform float aspect;uniform float depthEnabled;uniform float vignette;
      float distanceAt(vec2 uv){float d=texture2D(depth,uv).x;return near*far/(far-(far-near)*d);}
      float coc(float z){return clamp(max(0.0,abs(z-focusDepth)-focusRange)/max(1.0,z)*aperture,0.0,1.0);}
      void main(){
        vec3 color=texture2D(source,vUv).rgb;
        if(depthEnabled>0.5){
          float z=distanceAt(vUv),circle=coc(z);
          // Selection and the pointer target retain a small sharp region.
          circle*=smoothstep(0.045,0.105,length((vUv-focusUv)*vec2(aspect,1.0)));
          if(circle>0.015){
            vec3 sum=color;float weight=1.0;
            for(int i=0;i<SAMPLES;i++){
              float f=float(i)+0.5,angle=f*2.399963;
              vec2 offset=vec2(cos(angle),sin(angle))*sqrt(f/float(SAMPLES))*circle*maxBlur*texel;
              vec2 uv=clamp(vUv+offset,texel,vec2(1.0)-texel);
              float sampleZ=distanceAt(uv),sampleCoc=coc(sampleZ);
              float w=mix(0.05,1.0,smoothstep(circle-0.15,circle+0.15,sampleCoc));
              sum+=texture2D(source,uv).rgb*w;weight+=w;
            }
            color=sum/weight;
          }
        }
        vec3 glow=texture2D(bloom,vUv).rgb*bloomStrength;
        color=1.0-(1.0-color)*(1.0-glow);
        // A quiet lens vignette puts the miniature landscape in the foreground.
        float edge=smoothstep(0.32,0.8,length((vUv-vec2(.5,.58))*vec2(1.0,.86)));
        color*=1.0-edge*vignette;
        gl_FragColor=vec4(color,1.0);
      }`,{SAMPLES:low?10:18});
    const screenScene=new THREE.Scene(),screenCamera=new THREE.Camera(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),extract);
    quad.frustumCulled=false;screenScene.add(quad);
    let cssWidth=1,cssHeight=1,pixelRatio=1,focusInitialized=false;
    const api={enabled:true,depthSupported,resize,render,dispose};
    function resize(width,height) {
      cssWidth=Math.max(1,width);cssHeight=Math.max(1,height);
      pixelRatio=Math.min(renderer.getPixelRatio(),low?1.25:1.5);
      const w=Math.max(1,Math.round(cssWidth*pixelRatio)),h=Math.max(1,Math.round(cssHeight*pixelRatio));
      sceneTarget.setSize(w,h);
      for(const target of [bright,blurA,blurB])target.setSize(Math.max(1,Math.ceil(w/4)),Math.max(1,Math.ceil(h/4)));
      combine.uniforms.texel.value.set(1/w,1/h);combine.uniforms.aspect.value=cssWidth/cssHeight;
      combine.uniforms.maxBlur.value=(low?4.0:7.5)*pixelRatio;
    }
    function pass(mat,target) {quad.material=mat;renderer.setRenderTarget(target);renderer.render(screenScene,screenCamera);}
    function render(scene,camera,focus,dt) {
      if(!api.enabled){renderer.render(scene,camera);focusInitialized=false;return;}
      const previousTarget=renderer.getRenderTarget();
      renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera);
      const desired=-focus.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const u=combine.uniforms;
      u.focusDepth.value=focusInitialized?THREE.MathUtils.lerp(u.focusDepth.value,desired,1-Math.exp(-dt*7)):desired;
      focusInitialized=true;u.focusRange.value=Math.max(1.45,desired*.115);u.near.value=camera.near;u.far.value=camera.far;
      const projected=focus.clone().project(camera);u.focusUv.value.set(projected.x*.5+.5,projected.y*.5+.5);
      pass(extract,bright);
      blur.uniforms.source.value=bright.texture;blur.uniforms.stepUv.value.set(1.8/bright.width,0);pass(blur,blurA);
      blur.uniforms.source.value=blurA.texture;blur.uniforms.stepUv.value.set(0,1.8/bright.height);pass(blur,blurB);
      pass(combine,previousTarget);
    }
    function dispose() {
      for(const target of [sceneTarget,bright,blurA,blurB])target.dispose();
      for(const mat of [extract,blur,combine])mat.dispose();quad.geometry.dispose();
    }
    return api;
  }
  root.ScenePostFX={create};
})(this);
