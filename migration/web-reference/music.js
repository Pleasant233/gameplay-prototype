// Original looping score: minor piano and low strings become a calm major theme.
(function(root){
  const MOODS=['荒芜 · 低回','初醒 · 微光','复苏 · 暖意','繁盛 · 舒缓','生境 · 宁静'];
  const THEMES=[
    {bpm:66,chords:[[45,48,52],[41,45,48],[43,47,50],[40,43,47]],melody:[72,71,69,67,69,64,65,64]},
    {bpm:68,chords:[[50,53,57],[48,52,55],[41,45,48],[43,47,50]],melody:[69,72,74,72,69,67,65,67]},
    {bpm:66,chords:[[48,52,55],[45,48,52],[41,45,48],[43,47,50]],melody:[72,76,79,76,74,72,69,72]},
    {bpm:62,chords:[[48,52,55,59],[41,45,48,52],[45,48,52,55],[43,47,50,55]],melody:[76,79,81,79,76,74,72,74]},
    {bpm:58,chords:[[48,52,55,57],[41,45,48,52],[48,52,55,59],[43,47,50,55]],melody:[79,76,74,72,76,79,76,72]},
  ];
  function create(){
    let enabled=localStorage.getItem('habitat-music')!=='0',stage=0,ctx,master,filter,delay,feedback,timer=0,next=0,bar=0;
    const voices=new Set();
    function voice(note,start,duration,volume,type){
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();
      oscillator.type=type;oscillator.frequency.value=440*Math.pow(2,(note-69)/12);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+(type==='triangle'?.6:.05));gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*.65),start+duration*.7);gain.gain.linearRampToValueAtTime(0,start+duration);
      oscillator.connect(gain);gain.connect(master);voices.add(oscillator);
      oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
      oscillator.start(start);oscillator.stop(start+duration);
    }
    function schedule(){
      if(!enabled||ctx.state!=='running')return;
      const theme=THEMES[stage],beat=60/theme.bpm;
      next=Math.max(next,ctx.currentTime+.04);
      while(next<ctx.currentTime+.8){
        const chord=theme.chords[bar%4];chord.forEach(note=>voice(note,next,beat*3.9,.021-stage*.002,'triangle'));
        voice(chord[0]-12,next,beat*3.5,.026-stage*.002,'sine');
        for(let i=0;i<4;i++){const note=theme.melody[(bar*4+i)%8];voice(note,next+i*beat,beat*1.35,.036-stage*.003,'sine');if(stage>=2)voice(note+12,next+i*beat,beat*.8,.009,'sine');}
        next+=beat*4;bar++;
      }
    }
    function start(){
      if(!enabled)return;
      if(!ctx){ctx=new AudioContext();master=ctx.createGain();filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2600;delay=ctx.createDelay(1);delay.delayTime.value=.34;feedback=ctx.createGain();feedback.gain.value=.2;master.connect(filter);filter.connect(ctx.destination);filter.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(ctx.destination);}
      ctx.resume();master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(.45,ctx.currentTime,.25);
      if(!timer){next=ctx.currentTime+.12;bar=0;timer=setInterval(schedule,200);schedule();}
    }
    function silence(){if(timer){clearInterval(timer);timer=0;}if(ctx){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(0,ctx.currentTime,.08);for(const oscillator of voices)oscillator.stop(ctx.currentTime+.35);}}
    function setScore(score){const value=root.GameData.RULES.stageTargets.filter(t=>score>=t.score).length;if(value===stage)return;stage=value;if(timer){silence();start();}}
    function toggle(){enabled=!enabled;localStorage.setItem('habitat-music',enabled?'1':'0');if(enabled)start();else silence();}
    return {start,setScore,toggle,get enabled(){return enabled;},get mood(){return MOODS[stage];}};
  }
  root.HabitatMusic={create};
})(this);
