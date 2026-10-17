using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace ElementHabitat.Editor
{
    /// <summary>Real play-mode audio validation. Output is muted while the DSP clock, sources,
    /// background synthesis, clip upload and cancellation remain active. User data is restored.</summary>
    public static class HabitatAudioValidation
    {
        [Serializable] public sealed class ClipResult
        {
            public string name, category; public int samples, channels, frequency;
            public double peak, rms;
        }
        [Serializable] public sealed class ThemeResult
        {
            public int stage, tempo, cachedBars, activeBars; public double score, readySeconds;
        }
        [Serializable] public sealed class Report
        {
            public string reference="2026-10-17 production Sfx and music.js";
            public bool passed, physicalAudioOutputVerified;
            public List<string> checks=new List<string>(),errors=new List<string>();
            public List<ClipResult> clips=new List<ClipResult>();
            public List<ThemeResult> themes=new List<ThemeResult>();
        }
        static readonly double[] Scores={0,500,1500,3000,6000};
        static readonly int[] Tempos={66,68,66,62,58};
        static readonly List<string> storagePaths=new List<string>();
        static readonly List<byte[]> storageBytes=new List<byte[]>();
        static readonly Dictionary<string,object> prefs=new Dictionary<string,object>();
        static readonly List<Task> cancellationTasks=new List<Task>();
        static readonly HashSet<int> recordedClips=new HashSet<int>();
        static Report report;static HabitatAudio sfx;static HabitatMusic music;
        static GameObject testObject,cancelObject;
        static bool failed,finishing,settingsCaptured,listenerCaptured,oldPlayEnabled,oldListenerPause;
        static float oldListenerVolume;static EnterPlayModeOptions oldPlayOptions;
        static int phase,theme;static double started,waitUntil,themeStarted,dspStarted;
        static string ArtifactDirectory=>Path.GetFullPath(Path.Combine(Application.dataPath,"../../artifacts/unity-audio"));

        // -executeMethod ElementHabitat.Editor.HabitatAudioValidation.Validate, without -quit.
        [MenuItem("元素生境/验证合成音效与五阶段配乐")]
        public static void Validate()
        {
            try{
                report=new Report();failed=finishing=settingsCaptured=listenerCaptured=false;phase=theme=0;
                storagePaths.Clear();storageBytes.Clear();prefs.Clear();cancellationTasks.Clear();recordedClips.Clear();
                Directory.CreateDirectory(ArtifactDirectory);PreserveStorage();
                oldPlayEnabled=EditorSettings.enterPlayModeOptionsEnabled;oldPlayOptions=EditorSettings.enterPlayModeOptions;settingsCaptured=true;
                oldListenerPause=AudioListener.pause;oldListenerVolume=AudioListener.volume;listenerCaptured=true;
                AudioListener.pause=false;AudioListener.volume=0;
                EditorSettings.enterPlayModeOptionsEnabled=true;EditorSettings.enterPlayModeOptions=EnterPlayModeOptions.DisableDomainReload;
                Application.logMessageReceived+=OnLog;EditorSceneManager.OpenScene(HabitatTools.Scene);
                started=EditorApplication.timeSinceStartup;EditorApplication.update+=Tick;EditorApplication.isPlaying=true;
            }catch(Exception error){Fail(error);}
        }
        static void PreserveStorage()
        {
            foreach(string path in new[]{HabitatApp.SavePath,HabitatApp.SavePath+".bak",HabitatApp.SavePath+".tmp"}){
                storagePaths.Add(path);storageBytes.Add(File.Exists(path)?File.ReadAllBytes(path):null);
            }
            if(File.Exists(HabitatApp.SavePath))File.Delete(HabitatApp.SavePath);
            string[] names=new[]{"habitat.achievements","habitat.atmosphere","habitat.reducedMotion","habitat.sound","habitat.music"}
                .Concat(Catalog.Achievements.SelectMany(a=>new[]{"habitat.progress."+a.id,"habitat.achievement."+a.id})).ToArray();
            foreach(string key in names)prefs[key]=!PlayerPrefs.HasKey(key)?null:key=="habitat.achievements"?(object)PlayerPrefs.GetString(key):PlayerPrefs.GetInt(key);
            PlayerPrefs.SetInt("habitat.sound",0);PlayerPrefs.SetInt("habitat.music",0);
        }
        static void RestoreStorage()
        {
            for(int i=0;i<storagePaths.Count;i++){
                if(storageBytes[i]!=null){Directory.CreateDirectory(Path.GetDirectoryName(storagePaths[i]));File.WriteAllBytes(storagePaths[i],storageBytes[i]);}
                else if(File.Exists(storagePaths[i]))File.Delete(storagePaths[i]);
            }
            foreach(var pair in prefs){if(pair.Value==null)PlayerPrefs.DeleteKey(pair.Key);else if(pair.Value is string text)PlayerPrefs.SetString(pair.Key,text);else PlayerPrefs.SetInt(pair.Key,(int)pair.Value);}
            PlayerPrefs.Save();
            if(settingsCaptured){EditorSettings.enterPlayModeOptionsEnabled=oldPlayEnabled;EditorSettings.enterPlayModeOptions=oldPlayOptions;}
            if(listenerCaptured){AudioListener.volume=oldListenerVolume;AudioListener.pause=oldListenerPause;}
        }
        static void Check(bool value,string description)
        {
            if(!value)throw new InvalidOperationException(description);report.checks.Add(description);Debug.Log("AUDIO CHECK: "+description);
        }
        static void OnLog(string text,string trace,LogType type)
        {
            if(type!=LogType.Error&&type!=LogType.Exception&&type!=LogType.Assert)return;failed=true;report.errors.Add(text+"\n"+trace);
        }
        static void Tick()
        {
            try{
                if(finishing){if(EditorApplication.isPlaying)return;RestoreStorage();Finish();return;}
                if(EditorApplication.timeSinceStartup-started>90)throw new TimeoutException("Native audio validation exceeded 90 seconds");
                if(!EditorApplication.isPlaying||EditorApplication.isCompiling)return;
                AudioListener.volume=0;AudioListener.pause=false;
                double now=EditorApplication.timeSinceStartup;if(now<waitUntil)return;
                if(phase==0){
                    if(UnityEngine.Object.FindFirstObjectByType<HabitatApp>()==null)return;
                    Check(UnityEngine.Object.FindFirstObjectByType<AudioListener>()!=null,"Native play mode has an active AudioListener");
                    testObject=new GameObject("Temporary audio validation fixture");sfx=testObject.AddComponent<HabitatAudio>();music=testObject.AddComponent<HabitatMusic>();
                    sfx.Enabled=true;dspStarted=AudioSettings.dspTime;
                    sfx.Pick();sfx.Error();sfx.Play("place");sfx.Play("cast");sfx.Play("round");sfx.Play("guard");sfx.Ding(0);sfx.Ding(11);
                    Check(sfx.PendingCueCount>0&&sfx.PendingCueCount<=160,"Composite Sfx cues use the bounded native delay queue");
                    RecordClips(SfxCache(),"sfx");Check(sfx.CachedClipCount>=8,"Distinct production oscillator clips are cached");
                    phase=1;waitUntil=now+1.35;
                }else if(phase==1){
                    Check(AudioSettings.dspTime>dspStarted+.25,"DSP time advances while listener output is muted");
                    Check(sfx.PendingCueCount==0,"Delayed Sfx cues naturally finish");Check(sfx.ActiveVoiceCount==0,"Completed Sfx voices are available for reuse");
                    RecordClips(SfxCache(),"sfx");
                    var meteors=Enumerable.Range(0,10).Select(i=>new GameEvent{kind="meteor",cell="2,2",el="fire",strength=3,damage=i%2==0?0:3,n=i}).ToList();
                    sfx.PlayAction(new GameAction{type="endRound"},meteors,e=>(float)e.n*.08f);
                    Check(sfx.PendingCueCount>0&&sfx.PendingCueCount<=160&&sfx.ActiveVoiceCount<=24,"Meteor action schedules bounded impact voices at receipt times");
                    sfx.ClearFeedback();Check(sfx.PendingCueCount==0&&sfx.ActiveVoiceCount==0,"ClearFeedback cancels pending cues and stops active Sfx voices");
                    int count=sfx.CachedClipCount;sfx.Enabled=false;sfx.Pick();sfx.Error();sfx.Play("cast");
                    Check(sfx.PendingCueCount==0&&sfx.ActiveVoiceCount==0&&sfx.CachedClipCount==count,"Disabled Sfx create no cues, voices or new clips");
                    theme=0;BeginTheme();phase=2;
                }else if(phase==2){
                    if(now-themeStarted>12)throw new TimeoutException("Music stage "+theme+" did not generate and schedule its first background bar");
                    IDictionary cache=MusicCache();if(!cache.Contains(theme*4)||music.ActiveBarCount==0||now-themeStarted<.35)return;
                    Check(music.Stage==theme&&music.Tempo==Tempos[theme],"Score "+Scores[theme]+" selects production theme "+theme+" at "+Tempos[theme]+" BPM");
                    Check(music.ActiveBarCount<=8&&music.CachedBarCount<=20,"Theme "+theme+" respects native source and cached-bar budgets");
                    Check(music.GetComponents<AudioSource>().Any(source=>source.clip!=null&&source.isPlaying),"Theme "+theme+" schedules an AudioClip on a real play-mode source");
                    RecordClips(cache,"music");report.themes.Add(new ThemeResult{stage=music.Stage,score=Scores[theme],tempo=music.Tempo,cachedBars=music.CachedBarCount,activeBars=music.ActiveBarCount,readySeconds=now-themeStarted});
                    theme++;if(theme<Scores.Length)BeginTheme();else{music.Enabled=false;phase=3;waitUntil=now+.6;}
                }else if(phase==3){
                    Check(!music.IsPlaying&&music.ActiveBarCount==0,"Muting music fades and retires its scheduled native sources");
                    music.Enabled=true;music.StartMusic();phase=4;waitUntil=now+.25;
                }else if(phase==4){
                    Check(music.IsPlaying&&music.ActiveBarCount>0&&music.ActiveBarCount<=8,"Re-enabling music reuses the cached current theme");
                    cancelObject=new GameObject("Temporary background cancellation probe");var cancelMusic=cancelObject.AddComponent<HabitatMusic>();cancelMusic.Enabled=true;cancelMusic.StartMusic();
                    CaptureTasks(cancelMusic);Check(cancellationTasks.Count>0,"Cancellation probe owns real background synthesis tasks");
                    CaptureTasks(music);UnityEngine.Object.DestroyImmediate(cancelObject);UnityEngine.Object.Destroy(testObject);phase=5;waitUntil=now+.2;
                }else if(phase==5){
                    if(cancellationTasks.Any(task=>!task.IsCompleted)){if(now-waitUntil>5)throw new TimeoutException("Music synthesis tasks did not settle after destruction");return;}
                    Check(cancellationTasks.All(task=>!task.IsFaulted),"Destroying music cancels or finishes every worker without a background exception");
                    Check(cancellationTasks.Any(task=>task.IsCanceled),"Destruction propagates cancellation to queued synthesis work");
                    phase=6;waitUntil=now+.35;
                }else if(phase==6){
                    Check(report.errors.Count==0,"Audio lifecycle completes without Unity errors or exceptions");finishing=true;EditorApplication.isPlaying=false;
                }
            }catch(Exception error){Fail(error);}
        }
        static void BeginTheme()
        {
            themeStarted=EditorApplication.timeSinceStartup;music.ResetTheme(Scores[theme]);music.Enabled=true;music.StartMusic();
        }
        static IDictionary SfxCache()=>(IDictionary)typeof(HabitatAudio).GetField("clips",BindingFlags.NonPublic|BindingFlags.Instance).GetValue(sfx);
        static IDictionary MusicCache()=>(IDictionary)typeof(HabitatMusic).GetField("cache",BindingFlags.NonPublic|BindingFlags.Instance).GetValue(music);
        static void CaptureTasks(HabitatMusic target)
        {
            var tasks=(IDictionary)typeof(HabitatMusic).GetField("renderTasks",BindingFlags.NonPublic|BindingFlags.Instance).GetValue(target);
            foreach(Task task in tasks.Values)if(!cancellationTasks.Contains(task))cancellationTasks.Add(task);
        }
        static void RecordClips(IDictionary cache,string category)
        {
            foreach(AudioClip clip in cache.Values){
                if(!recordedClips.Add(clip.GetInstanceID()))continue;var data=new float[clip.samples*clip.channels];
                Check(clip.GetData(data,0),category+" clip exposes locally generated PCM: "+clip.name);
                double peak=0,sum=0;foreach(float sample in data){if(float.IsNaN(sample)||float.IsInfinity(sample))throw new InvalidOperationException("Non-finite PCM sample: "+clip.name);peak=Math.Max(peak,Math.Abs(sample));sum+=sample*sample;}
                double rms=Math.Sqrt(sum/data.Length);Check(peak>1e-5&&peak<1&&rms>1e-6,category+" clip contains finite, nonzero, unclipped PCM: "+clip.name);
                report.clips.Add(new ClipResult{name=clip.name,category=category,samples=clip.samples,channels=clip.channels,frequency=clip.frequency,peak=peak,rms=rms});
            }
        }
        static void Fail(Exception error)
        {
            failed=true;if(report==null)report=new Report();report.errors.Add(error.ToString());Debug.LogException(error);
            if(EditorApplication.isPlaying){finishing=true;EditorApplication.isPlaying=false;}else{try{RestoreStorage();}finally{Finish();}}
        }
        static void Finish()
        {
            report.passed=!failed;Directory.CreateDirectory(ArtifactDirectory);File.WriteAllText(Path.Combine(ArtifactDirectory,"audio-validation.json"),JsonUtility.ToJson(report,true));
            EditorApplication.update-=Tick;Application.logMessageReceived-=OnLog;EditorApplication.Exit(failed?1:0);
        }
    }
}