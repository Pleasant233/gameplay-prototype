using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace ElementHabitat
{
    /// <summary>The production WebAudio oscillators, envelopes and action cues synthesized locally.</summary>
    public sealed class HabitatAudio : MonoBehaviour
    {
        sealed class Voice {public AudioSource source;public double until;}
        sealed class Cue {public double at;public Action play;}
        readonly List<Voice> voices=new List<Voice>();
        readonly List<Cue> cues=new List<Cue>();
        readonly Dictionary<string,AudioClip> clips=new Dictionary<string,AudioClip>();
        bool enabledFeedback=true;
        public bool Enabled {get=>enabledFeedback;set{enabledFeedback=value;if(!value)ClearFeedback();}}
        public int PendingCueCount => cues.Count;
        public int CachedClipCount => clips.Count;
        public int ActiveVoiceCount {get{int n=0;double now=AudioSettings.dspTime;foreach(var voice in voices)if(voice.until>now)n++;return n;}}
        void Awake(){enabledFeedback=PlayerPrefs.GetInt("habitat.sound",1)!=0;}
        void Update()
        {
            double now=Time.realtimeSinceStartupAsDouble;
            for(int i=cues.Count-1;i>=0;i--)if(cues[i].at<=now){var cue=cues[i];cues.RemoveAt(i);if(enabledFeedback)cue.play();}
        }
        void After(float seconds,Action callback)
        {
            if(!enabledFeedback)return;if(seconds<=0){callback();return;}
            if(cues.Count>=160)cues.RemoveAt(0);cues.Add(new Cue{at=Time.realtimeSinceStartupAsDouble+seconds,play=callback});
        }
        void Tone(float frequency,float duration,string waveform,float volume,float slide=0)
        {
            if(!enabledFeedback)return;
            string key=frequency.ToString("R",CultureInfo.InvariantCulture)+"/"+duration.ToString("R",CultureInfo.InvariantCulture)+"/"+waveform+"/"+volume.ToString("R",CultureInfo.InvariantCulture)+"/"+slide.ToString("R",CultureInfo.InvariantCulture);
            if(!clips.TryGetValue(key,out var clip)){
                clip=MakeTone(frequency,duration,waveform,volume,slide);clips.Add(key,clip);
            }
            double now=AudioSettings.dspTime;Voice selected=null;
            foreach(var voice in voices)if(voice.until<=now){selected=voice;break;}
            if(selected==null&&voices.Count<24){var source=gameObject.AddComponent<AudioSource>();source.playOnAwake=false;source.spatialBlend=0;source.volume=1;source.priority=90;selected=new Voice{source=source};voices.Add(selected);}
            if(selected==null){selected=voices[0];foreach(var voice in voices)if(voice.until<selected.until)selected=voice;selected.source.Stop();}
            selected.source.clip=clip;selected.source.Play();selected.until=now+clip.length;
        }
        static AudioClip MakeTone(float frequency,float duration,string waveform,float volume,float slide)
        {
            const int rate=44100;int count=Mathf.CeilToInt(rate*(duration+.008f));var samples=new float[count];double phase=0;
            for(int i=0;i<count;i++){
                double t=(double)i/rate,u=Math.Min(1,t/duration);if(t>=duration)break;
                double hz=slide>0?frequency*Math.Pow(slide/frequency,u):frequency;phase+=Math.PI*2*hz/rate;
                double envelope=volume*Math.Pow(.001/volume,u);
                samples[i]=(float)(Oscillator(phase,waveform,hz,rate)*envelope);
            }
            var clip=AudioClip.Create("Web oscillator "+waveform+" "+frequency,count,1,rate,false);clip.SetData(samples,0);return clip;
        }
        internal static double Oscillator(double phase,string waveform,double frequency,int rate)
        {
            if(waveform=="sine")return Math.Sin(phase);
            // WebAudio oscillators are band limited. A bounded harmonic sum retains their timbre
            // without aliasing the square error cue or turning every cue into the same sine tone.
            int harmonics=Math.Min(31,Math.Max(1,(int)(rate*.45/frequency)));double value=0;
            if(waveform=="square"){for(int h=1;h<=harmonics;h+=2)value+=Math.Sin(phase*h)/h;return value*4/Math.PI;}
            for(int h=1;h<=harmonics;h+=2)value+=((h%4==1)?1:-1)*Math.Sin(phase*h)/(h*h);
            return value*8/(Math.PI*Math.PI);
        }
        public void Pick(){Tone(520,.08f,"triangle",.1f);After(.05f,()=>Tone(780,.1f,"triangle",.1f));}
        public void Error(){Tone(220,.12f,"square",.06f);After(.09f,()=>Tone(160,.16f,"square",.06f));}
        public void Ding(int index){int note=((index%12)+12)%12;Tone(740*Mathf.Pow(2,note/12f),.1f,"sine",.045f);}
        void Link(int count){int n=Mathf.Min(3,count);float[] f={660,880,1100};for(int i=0;i<n;i++){float hz=f[i];After(i*.065f,()=>Tone(hz,.18f,"triangle",.055f));}}
        void Guard(){Tone(420,.22f,"sine",.09f,1000);After(.12f,()=>Tone(1320,.3f,"triangle",.04f));}
        void Impact(bool blocked){Tone(blocked?980:95,blocked?.18f:.22f,blocked?"triangle":"sine",blocked?.045f:.065f,blocked?1500:45);}
        public void Play(string action)
        {
            if(!enabledFeedback)return;
            switch(action){
                case "place":Tone(180,.18f,"sine",.22f,90);After(.06f,()=>Tone(880,.12f,"triangle",.08f));break;
                case "cast":case "magic":Tone(400,.35f,"sine",.12f,1200);After(.12f,()=>Tone(1200,.25f,"triangle",.06f));break;
                case "pick":Pick();break;case "error":case "err":Error();break;
                case "mergeGuardian":case "guardianMerge":case "guard":case "deployShield":Guard();break;
                case "meteor":Tone(320,.65f,"sine",.065f,75);break;
                case "endRound":case "round":
                    Sequence(new float[]{523,659,784,1046},.09f,.18f,.1f);break;
                case "win":Sequence(new float[]{523,659,784,1046,1318},.13f,.3f,.12f);break;
                default:Tone(660,.07f,"triangle",.08f);break;
            }
        }
        void Sequence(float[] notes,float interval,float duration,float volume)
        {
            for(int i=0;i<notes.Length;i++){float note=notes[i];After(i*interval,()=>Tone(note,duration,"triangle",volume));}
        }
        public void PlayAction(GameAction action,IReadOnlyList<GameEvent> receipts,Func<GameEvent,float> effectDelay,int connectedCount=0)
        {
            if(!enabledFeedback||action==null)return;
            Play(action.type);
            if(connectedCount>1&&(action.type=="place"||action.type=="upgrade"||action.type=="upgradeBatch"))After(action.type=="place"?.4f:0,()=>Link(connectedCount));
            if(receipts==null)return;bool meteorStarted=false,guardianPlayed=action.type=="mergeGuardian";
            foreach(var receipt in receipts){
                if(receipt.kind=="meteor"){
                    if(!meteorStarted){Play("meteor");meteorStarted=true;}
                    bool blocked=receipt.damage<receipt.strength;float delay=effectDelay?.Invoke(receipt)??0;After(delay,()=>Impact(blocked));
                }
                if(receipt.kind=="guardianMerge"&&!guardianPlayed){Guard();guardianPlayed=true;}
                if(receipt.kind=="mapComplete"||receipt.kind=="stageClear")After(.16f,()=>Play("win"));
            }
        }
        public void ClearFeedback()
        {
            cues.Clear();foreach(var voice in voices){voice.source.Stop();voice.until=0;}
        }
        void OnDestroy(){ClearFeedback();foreach(var clip in clips.Values)if(clip!=null)Destroy(clip);clips.Clear();}
    }
}