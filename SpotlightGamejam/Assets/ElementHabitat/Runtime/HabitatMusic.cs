using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace ElementHabitat
{
    /// <summary>The five production music.js themes. Chord, bass and melody voices are rendered
    /// into bounded, cached bars with the original filter, echo and overlapping note tails.</summary>
    public sealed class HabitatMusic : MonoBehaviour
    {
        sealed class Theme {public int bpm;public int[][] chords;public int[] melody;}
        sealed class BarVoice {public AudioSource source;public double start,end,gainStart,fade=-1;public float fadeVolume;}
        static readonly string[] Moods={"荒芜 · 低回","初醒 · 微光","复苏 · 暖意","繁盛 · 舒缓","生境 · 宁静"};
        static readonly Theme[] Themes={
            new Theme{bpm=66,chords=new[]{new[]{45,48,52},new[]{41,45,48},new[]{43,47,50},new[]{40,43,47}},melody=new[]{72,71,69,67,69,64,65,64}},
            new Theme{bpm=68,chords=new[]{new[]{50,53,57},new[]{48,52,55},new[]{41,45,48},new[]{43,47,50}},melody=new[]{69,72,74,72,69,67,65,67}},
            new Theme{bpm=66,chords=new[]{new[]{48,52,55},new[]{45,48,52},new[]{41,45,48},new[]{43,47,50}},melody=new[]{72,76,79,76,74,72,69,72}},
            new Theme{bpm=62,chords=new[]{new[]{48,52,55,59},new[]{41,45,48,52},new[]{45,48,52,55},new[]{43,47,50,55}},melody=new[]{76,79,81,79,76,74,72,74}},
            new Theme{bpm=58,chords=new[]{new[]{48,52,55,57},new[]{41,45,48,52},new[]{48,52,55,59},new[]{43,47,50,55}},melody=new[]{79,76,74,72,76,79,76,72}},
        };
        readonly Dictionary<int,AudioClip> cache=new Dictionary<int,AudioClip>();
        readonly Dictionary<int,Task<float[]>> renderTasks=new Dictionary<int,Task<float[]>>();
        readonly CancellationTokenSource renderLifetime=new CancellationTokenSource();
        readonly SemaphoreSlim renderGate=new SemaphoreSlim(1,1);
        readonly List<BarVoice> voices=new List<BarVoice>();
        bool musicEnabled=true,requested,running;int stage,bar;double next,sessionGainStart;
        public bool Enabled
        {
            get=>musicEnabled;
            set{if(musicEnabled==value)return;musicEnabled=value;PlayerPrefs.SetInt("habitat.music",value?1:0);if(value)StartMusic();else FadeOut();}
        }
        public string Mood => Moods[stage];
        public int Stage => stage;
        public int Tempo => Themes[stage].bpm;
        public bool IsPlaying => running;
        public int CachedBarCount => cache.Count;
        public int ActiveBarCount {get{int n=0;double now=AudioSettings.dspTime;foreach(var voice in voices)if(voice.end>now)n++;return n;}}
        void Awake(){musicEnabled=PlayerPrefs.GetInt("habitat.music",1)!=0;}
        public void StartMusic()
        {
            requested=true;if(!musicEnabled||running)return;running=true;bar=0;sessionGainStart=AudioSettings.dspTime;next=sessionGainStart+.12;RequestTheme(stage);Schedule();
        }
        public void SetScore(double score)
        {
            int nextStage=ScoreStage(score);if(nextStage==stage)return;stage=nextStage;
            if(running){FadeOut();if(musicEnabled)StartMusic();}
        }
        public void ResetTheme(double score)
        {
            bool resume=requested;FadeOut();stage=ScoreStage(score);bar=0;if(resume&&musicEnabled)StartMusic();
        }
        static int ScoreStage(double score)
        {
            int result=0;foreach(var target in Catalog.StageTargets)if(score>=target.score)result++;return Mathf.Clamp(result,0,Themes.Length-1);
        }
        void Update()
        {
            double now=AudioSettings.dspTime;
            foreach(var voice in voices){
                if(voice.fade>=0){double age=now-voice.fade;voice.source.volume=(float)(voice.fadeVolume*Math.Exp(-age/.08));if(age>=.35){voice.source.Stop();voice.end=0;voice.fade=-1;}}
                else if(voice.end>now)voice.source.volume=(float)(.45*(1-Math.Exp(-Math.Max(0,now-voice.gainStart)/.25)));
            }
            if(running&&musicEnabled)Schedule();
        }
        void FadeOut()
        {
            running=false;double now=AudioSettings.dspTime;
            foreach(var voice in voices)if(voice.end>now){if(voice.start>now){voice.source.Stop();voice.end=0;voice.fade=-1;}else if(voice.fade<0){voice.fade=now;voice.fadeVolume=voice.source.volume;}}
        }
        void RequestTheme(int theme)
        {
            // Only four bars per stage are possible. Serial background rendering bounds CPU
            // pressure even when scores jump across several themes in a single action.
            for(int i=0;i<4;i++){
                int key=theme*4+i;if(cache.ContainsKey(key)||renderTasks.ContainsKey(key))continue;
                int capturedBar=i,capturedTheme=theme;CancellationToken token=renderLifetime.Token;
                renderTasks.Add(key,Task.Run(async()=>{
                    await renderGate.WaitAsync(token).ConfigureAwait(false);
                    try{return RenderBarSamples(capturedTheme,capturedBar,token);}
                    finally{renderGate.Release();}
                },token));
            }
        }
        void Schedule()
        {
            if(!running||!musicEnabled)return;
            double now=AudioSettings.dspTime;next=Math.Max(next,now+.04);
            while(next<now+.8){
                int key=stage*4+bar%4;
                if(!cache.TryGetValue(key,out var clip)){
                    RequestTheme(stage);var task=renderTasks[key];if(!task.IsCompleted)return;
                    if(task.IsCanceled)return;
                    if(task.IsFaulted){Debug.LogException(task.Exception);running=false;return;}
                    // Workers return numbers only. Unity's AudioClip upload remains on the main
                    // thread and no completion callback ever touches Unity after destruction.
                    float[] samples=task.Result;clip=AudioClip.Create("Habitat web theme "+stage+" bar "+bar%4,samples.Length,1,44100,false);clip.SetData(samples,0);cache.Add(key,clip);renderTasks.Remove(key);
                }
                now=AudioSettings.dspTime;next=Math.Max(next,now+.04);
                var voice=RentVoice(now);voice.source.clip=clip;voice.source.volume=0;voice.source.PlayScheduled(next);voice.start=next;voice.gainStart=sessionGainStart;voice.end=next+clip.length;voice.fade=-1;
                next+=240.0/Themes[stage].bpm;bar++;
            }
        }
        BarVoice RentVoice(double now)
        {
            foreach(var voice in voices)if(voice.end<=now)return voice;
            if(voices.Count<8){var source=gameObject.AddComponent<AudioSource>();source.playOnAwake=false;source.spatialBlend=0;source.loop=false;source.volume=0;source.priority=150;var voice=new BarVoice{source=source};voices.Add(voice);return voice;}
            var oldest=voices[0];foreach(var voice in voices)if(voice.end<oldest.end)oldest=voice;oldest.source.Stop();return oldest;
        }
        static float[] RenderBarSamples(int stageIndex,int barIndex,CancellationToken token)
        {
            const int rate=44100;Theme theme=Themes[stageIndex];double beat=60.0/theme.bpm,barDuration=beat*4;
            // The last melodic voice overlaps the next bar by .35 beat. The 340 ms echo feeds
            // itself at .2 gain; seven repeats leave less than .000013 of the initial amplitude.
            int length=(int)Math.Ceiling((barDuration+beat*.35+.34*7)*rate);var samples=new float[length];
            foreach(int note in theme.chords[barIndex])AddVoice(samples,rate,note,0,beat*3.9,.021-stageIndex*.002,true,token);
            AddVoice(samples,rate,theme.chords[barIndex][0]-12,0,beat*3.5,.026-stageIndex*.002,false,token);
            for(int i=0;i<4;i++){
                int note=theme.melody[(barIndex*4+i)%8];AddVoice(samples,rate,note,i*beat,beat*1.35,.036-stageIndex*.003,false,token);
                if(stageIndex>=2)AddVoice(samples,rate,note+12,i*beat,beat*.8,.009,false,token);
            }
            token.ThrowIfCancellationRequested();LowPass(samples,rate,2600,token);Echo(samples,rate,.34,.2,token);
            return samples;
        }
        static void AddVoice(float[] target,int rate,int note,double start,double duration,double volume,bool triangle,CancellationToken token)
        {
            int first=(int)Math.Round(start*rate),end=Math.Min(target.Length,first+(int)Math.Ceiling(duration*rate));double hz=440*Math.Pow(2,(note-69)/12.0),attack=triangle?.6:.05;
            // Render the same linear attack, exponential decay to .65 and final linear release
            // used by music.js. Every note retains a continuous phase within its own oscillator.
            double decayEnd=duration*.7,decayTarget=Math.Max(.0001,volume*.65),phase=0,phaseStep=Math.PI*2*hz/rate;
            for(int i=first;i<end;i++){
                if((i&8191)==0)token.ThrowIfCancellationRequested();
                double t=(double)(i-first)/rate,envelope;
                if(t<attack)envelope=volume*t/attack;
                else if(t<decayEnd)envelope=volume*Math.Pow(decayTarget/volume,(t-attack)/(decayEnd-attack));
                else envelope=decayTarget*(1-(t-decayEnd)/(duration-decayEnd));
                // A triangle oscillator has odd harmonics only; the first nine are sufficient
                // below the 2600 Hz low pass and avoid hard waveform corners in the bass strings.
                double wave;
                if(triangle){wave=0;for(int h=1;h<=17;h+=2)wave+=((h%4==1)?1:-1)*Math.Sin(phase*h)/(h*h);wave*=8/(Math.PI*Math.PI);}
                else wave=Math.Sin(phase);
                target[i]+=(float)(wave*envelope);phase+=phaseStep;
            }
        }
        static void LowPass(float[] data,int rate,double cutoff,CancellationToken token)
        {
            // Standard resonant low pass corresponding to the WebAudio filter's default Q.
            double omega=2*Math.PI*cutoff/rate,cos=Math.Cos(omega),alpha=Math.Sin(omega)/(2*Math.Pow(10,1.0/20));
            double a0=1+alpha,b0=(1-cos)*.5/a0,b1=(1-cos)/a0,b2=b0,a1=-2*cos/a0,a2=(1-alpha)/a0,x1=0,x2=0,y1=0,y2=0;
            for(int i=0;i<data.Length;i++){if((i&8191)==0)token.ThrowIfCancellationRequested();double x=data[i],y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;data[i]=(float)y;x2=x1;x1=x;y2=y1;y1=y;}
        }
        static void Echo(float[] data,int rate,double seconds,double feedback,CancellationToken token)
        {
            int delay=(int)Math.Round(seconds*rate);var wet=new float[data.Length];
            for(int i=delay;i<data.Length;i++){if((i&8191)==0)token.ThrowIfCancellationRequested();wet[i]=data[i-delay]+wet[i-delay]*(float)feedback;}
            for(int i=0;i<data.Length;i++)data[i]+=wet[i];
        }
        void OnDisable(){FadeOut();foreach(var voice in voices){voice.source.Stop();voice.end=0;}running=false;}
        void OnDestroy()
        {
            var pending=new List<Task>();foreach(var task in renderTasks.Values)pending.Add(task);
            var lifetime=renderLifetime;var gate=renderGate;lifetime.Cancel();renderTasks.Clear();
            // This continuation owns .NET objects only. It never calls Unity or captures a
            // destroyed component; the worker finishes or observes cancellation before disposal.
            Task.WhenAll(pending).ContinueWith(task=>{var observed=task.Exception;lifetime.Dispose();gate.Dispose();},CancellationToken.None,TaskContinuationOptions.ExecuteSynchronously,TaskScheduler.Default);
            foreach(var voice in voices)if(voice.source!=null)voice.source.Stop();foreach(var clip in cache.Values)if(clip!=null)Destroy(clip);cache.Clear();
        }
    }
}