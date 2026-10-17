using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UI;

namespace ElementHabitat.Editor
{
    /// <summary>
    /// Real play-mode motion acceptance. Each viewport replays the same native actions, then
    /// records successive rendered frames and their actual elapsed times. No simulated pictures
    /// or edits to a production clock are used. The user's saves and preferences are restored.
    /// </summary>
    public static class HabitatMotionValidation
    {
        [Serializable] public sealed class Frame
        {
            public string image, viewport, scenario;
            public float seconds, landingY, scaleY;
            public bool hasVisibleToken;
            public float tokenX, tokenY;
            public int effects, queuedEffects, tokens;
            public bool measuredPureGlyph;
            public int pureGlyphSaturatedPixels, pureGlyphSamplePixels;
            public double displayedScore, actualScore;
            public int displayedBag, actualBag, displayedCells, actualCells;
        }
        [Serializable] public sealed class Report
        {
            public string reference = "2026-10-17 production web snapshot";
            public bool passed, physicalDeviceTested;
            public List<string> checks = new List<string>(), errors = new List<string>();
            public List<Frame> frames = new List<Frame>();
        }
        sealed class PendingImage { public string path; public Texture2D texture; }
        static readonly string[] ScenarioNames = { "placement", "crystal", "shield-deploy", "meteor", "guardian-merge", "guardian-move", "reset-reduced" };
        static readonly double[][] Times = {
            new[] { 0d, .10, .22, .42, .60, .90, 1.30, 1.80, 2.50 },
            new[] { 0d, .16, .36, .60, .82, 1.10, 1.50, 1.90, 2.60 },
            new[] { 0d, .16, .38, .65, 1.0, 1.60, 2.10 },
            new[] { 0d, .20, .48, .75, 1.05, 1.30, 1.65, 2.20, 3.20, 4.80, 6.50 },
            new[] { 0d, .15, .35, .60, .90, 1.40, 2.0 },
            new[] { 0d, .10, .23, .40, .60, 1.0, 1.80 },
            new[] { 0d, .15, .40, .80, 1.20 }
        };
        static readonly List<PendingImage> images = new List<PendingImage>();
        static readonly List<string> storagePaths = new List<string>();
        static readonly List<byte[]> storageBytes = new List<byte[]>();
        static readonly Dictionary<string, object> prefs = new Dictionary<string, object>();
        static Report report;
        static HabitatApp app;
        static double started, scenarioStarted, waitUntil;
        static int scenario, viewport, nextFrame, state;
        static bool failed, settingsCaptured, finishing;
        static bool oldPlayEnabled;
        static EnterPlayModeOptions oldPlayOptions;
        static EditorWindow gameView;
        static int previousGameViewSize = -1;
        static string trackedCell;
        static double scoreBefore;
        static int bagBefore, roundBefore, apBefore, attrsBefore;
        static string ArtifactDirectory => Path.GetFullPath(Path.Combine(Application.dataPath, "../../artifacts/unity-motion"));

        // Unity -batchmode -projectPath SpotlightGamejam -executeMethod
        // ElementHabitat.Editor.HabitatMotionValidation.Validate -logFile ...
        // Do not pass -quit; completion follows actual play-mode frames.
        [MenuItem("元素生境/验证网页动效还原")]
        public static void Validate()
        {
            try
            {
                report = new Report(); failed = finishing = false; scenario = viewport = nextFrame = state = 0;
                images.Clear(); storagePaths.Clear(); storageBytes.Clear(); prefs.Clear();
                Directory.CreateDirectory(ArtifactDirectory);
                PreserveStorage();
                oldPlayEnabled = EditorSettings.enterPlayModeOptionsEnabled;
                oldPlayOptions = EditorSettings.enterPlayModeOptions;
                settingsCaptured = true;
                EditorSettings.enterPlayModeOptionsEnabled = true;
                EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload;
                Application.logMessageReceived += OnLog;
                EditorSceneManager.OpenScene(HabitatTools.Scene);
                started = EditorApplication.timeSinceStartup;
                EditorApplication.update += Tick;
                EditorApplication.isPlaying = true;
            }
            catch (Exception error) { Fail(error); }
        }

        static void PreserveStorage()
        {
            foreach (string path in new[] { HabitatApp.SavePath, HabitatApp.SavePath + ".bak", HabitatApp.SavePath + ".tmp" })
            {
                storagePaths.Add(path); storageBytes.Add(File.Exists(path) ? File.ReadAllBytes(path) : null);
            }
            if (File.Exists(HabitatApp.SavePath)) File.Delete(HabitatApp.SavePath);
            string[] names = new[] { "habitat.achievements", "habitat.atmosphere", "habitat.reducedMotion", "habitat.sound", "habitat.music" }
                .Concat(Catalog.Achievements.SelectMany(a => new[] { "habitat.progress." + a.id, "habitat.achievement." + a.id })).ToArray();
            foreach (string key in names)
                prefs[key] = !PlayerPrefs.HasKey(key) ? null : key == "habitat.achievements" ? (object)PlayerPrefs.GetString(key) : PlayerPrefs.GetInt(key);
            PlayerPrefs.SetInt("habitat.reducedMotion", 0); PlayerPrefs.SetInt("habitat.sound", 0);
            PlayerPrefs.SetInt("habitat.music", 0);
        }
        static void RestoreStorage()
        {
            for (int i = 0; i < storagePaths.Count; i++)
                if (storageBytes[i] != null) { Directory.CreateDirectory(Path.GetDirectoryName(storagePaths[i])); File.WriteAllBytes(storagePaths[i], storageBytes[i]); }
                else if (File.Exists(storagePaths[i])) File.Delete(storagePaths[i]);
            foreach (var pair in prefs)
                if (pair.Value == null) PlayerPrefs.DeleteKey(pair.Key);
                else if (pair.Value is string text) PlayerPrefs.SetString(pair.Key, text);
                else PlayerPrefs.SetInt(pair.Key, (int)pair.Value);
            PlayerPrefs.Save();
            if (settingsCaptured)
            {
                EditorSettings.enterPlayModeOptionsEnabled = oldPlayEnabled;
                EditorSettings.enterPlayModeOptions = oldPlayOptions;
            }
            if (gameView != null && previousGameViewSize >= 0)
                gameView.GetType().GetProperty("selectedSizeIndex", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)?.SetValue(gameView, previousGameViewSize);
        }
        static void OnLog(string text, string trace, LogType type)
        {
            if (type != LogType.Error && type != LogType.Exception && type != LogType.Assert) return;
            failed = true; report.errors.Add(text + "\n" + trace);
        }
        static void Check(bool value, string description)
        {
            if (!value) throw new InvalidOperationException(description);
            report.checks.Add(description); Debug.Log("MOTION CHECK: " + description);
        }
        static HabitatFeedbackHUD HUD => app == null ? null : app.UI.GetComponentInChildren<HabitatFeedbackHUD>();

        static void Tick()
        {
            try
            {
                if (finishing)
                {
                    if (EditorApplication.isPlaying) return;
                    RestoreStorage(); Finish(); return;
                }
                if (EditorApplication.timeSinceStartup - started > 480) throw new TimeoutException("Native motion validation exceeded eight minutes");
                if (!EditorApplication.isPlaying || EditorApplication.isCompiling) return;
                if (app == null) app = UnityEngine.Object.FindFirstObjectByType<HabitatApp>();
                if (app == null || app.Current == null || Camera.main == null) return;
                if (EditorApplication.timeSinceStartup < waitUntil) return;
                if (state == 0)
                {
                    Check(HUD != null, "Native receipt flight component is active");
                    Prepare(viewport == 0 ? 1440 : 390, viewport == 0 ? 900 : 844, scenario == 3);
                    state = 2; waitUntil = EditorApplication.timeSinceStartup + .35;
                }
                else if (state == 2) { StartScenario(); state = 1; }
                else if (state == 1)
                {
                    double elapsed = EditorApplication.timeSinceStartup - scenarioStarted;
                    if (nextFrame < Times[scenario].Length && elapsed >= Times[scenario][nextFrame])
                    {
                        RecordFrame(); nextFrame++;
                    }
                    if (nextFrame >= Times[scenario].Length)
                    {
                        ValidateScenario(); SaveImages(); scenario++;
                        if (scenario == ScenarioNames.Length) { scenario = 0; viewport++; }
                        if (viewport == 2)
                        {
                            foreach (string label in new[] { "desktop", "phone" })
                                Check(report.frames.Any(f => f.viewport == label && f.scenario == "meteor" && f.measuredPureGlyph && f.pureGlyphSaturatedPixels > 350),
                                    label + " includes a captured, visibly colored pure crystal glyph at the center of the screen");
                            finishing = true; EditorApplication.isPlaying = false;
                        }
                        else { state = 0; waitUntil = EditorApplication.timeSinceStartup + .15; }
                    }
                }
            }
            catch (Exception error) { Fail(error); }
        }

        static void Prepare(int width, int height, bool broad = false)
        {
            app.UI.HideMainMenu(); app.UI.CloseModal(); app.NewGame(false); app.UI.HideMainMenu();
            // A deterministic editor fixture; gameplay actions below still use HabitatApp.Dispatch.
            typeof(HabitatApp).GetProperty(nameof(HabitatApp.Current)).SetValue(app, Game.NewGame(43, false));
            var current = app.Current; current.cells.Clear(); current.round = 1; current.ap = current.roundAP = 9;
            for (int y = 2; y <= (broad ? 6 : 4); y++) for (int x = 2; x <= (broad ? 6 : 4); x++)
                if (x != 3 || y != 3) current.cells[x + "," + y] = Game.MakeTile("woodland_t2");
            current.inv.crystal.wood = 20; current.inv.crystal.fire = 20;
            app.Dispatch(new GameAction { type = "settingsReducedMotion", skip = false });
            app.Refresh(); app.Board.ClearFeedback(); HUD.ResetFeedback(); app.Board.ResetCamera();
            Screen.SetResolution(width, height, FullScreenMode.Windowed);
            SetGameViewSize(width, height);
            trackedCell = "5,3";
        }

        static void SetGameViewSize(int width, int height)
        {
            var assembly = typeof(UnityEditor.Editor).Assembly;
            var sizesType = assembly.GetType("UnityEditor.GameViewSizes");
            var singleton = typeof(ScriptableSingleton<>).MakeGenericType(sizesType);
            var sizes = singleton.GetProperty("instance", BindingFlags.Public | BindingFlags.Static).GetValue(null);
            var groupType = assembly.GetType("UnityEditor.GameViewSizeGroupType");
            var group = sizesType.GetMethod("GetGroup").Invoke(sizes, new[] { Enum.Parse(groupType, "Standalone") });
            var getSize = group.GetType().GetMethod("GetGameViewSize");
            int count = (int)group.GetType().GetMethod("GetTotalCount").Invoke(group, null), index = -1;
            for (int i = 0; i < count; i++)
            {
                var size = getSize.Invoke(group, new object[] { i });
                if ((int)size.GetType().GetProperty("width").GetValue(size) == width && (int)size.GetType().GetProperty("height").GetValue(size) == height) { index = i; break; }
            }
            if (index < 0)
            {
                var sizeType = assembly.GetType("UnityEditor.GameViewSize");
                var kindType = assembly.GetType("UnityEditor.GameViewSizeType");
                var size = Activator.CreateInstance(sizeType, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance, null,
                    new object[] { Enum.Parse(kindType, "FixedResolution"), width, height, "Habitat motion " + width + "x" + height }, null);
                group.GetType().GetMethod("AddCustomSize").Invoke(group, new[] { size }); index = count;
            }
            var viewType = assembly.GetType("UnityEditor.GameView");
            gameView = EditorWindow.GetWindow(viewType, false, "Game", false);
            var selected = viewType.GetProperty("selectedSizeIndex", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
            if (previousGameViewSize < 0) previousGameViewSize = (int)selected.GetValue(gameView);
            selected.SetValue(gameView, index); gameView.Repaint();
        }

        static void StartScenario()
        {
            State s = app.Current; scoreBefore = Game.Score(s).total; bagBefore = Game.BagCount(s);
            roundBefore = s.round; apBefore = s.ap;
            switch (scenario)
            {
                case 0:
                    s.offers[0] = "woodland_t2"; app.Refresh();
                    app.Dispatch(new GameAction { type = "place", offer = 0, cell = trackedCell });
                    Check(s.cells.ContainsKey(trackedCell), "Placement fixture dispatches through native gameplay");
                    Check(CellRoot(trackedCell).localPosition.y > 1, "New terrain starts above the board before landing");
                    break;
                case 1:
                    trackedCell = "3,2"; s.cells[trackedCell].attrs[1] = 0; app.Refresh();
                    scoreBefore = Game.Score(s).total; attrsBefore = 0;
                    app.Dispatch(new GameAction { type = "useCrystal", cell = trackedCell, el = "wood" });
                    Check(s.inv.crystal.wood == 19 && s.cells[trackedCell].attrs[1] == attrsBefore + 1, "Crystal immediately updates native stock and attributes");
                    Check(HUD.ActiveTokenCount > 0 && HUD.DisplayScore < Game.Score(s).total, "Crystal queues bag-to-terrain flight and delays the visible score");
                    break;
                case 2:
                    trackedCell = "3,2";
                    s.inv.shields.Add(new Shield { id = 900, coverage = 8, defense = new ElementBag { fire = 30 } });
                    app.Refresh(); app.Dispatch(new GameAction { type = "deployShield", shieldId = 900, cell = trackedCell });
                    Check(s.shields.Any(sh => sh.id == 900) && app.Board.QueuedEffectCount > 0, "Shield deployment schedules its cells in batches");
                    break;
                case 3:
                    trackedCell = "4,4"; s.round = 4; s.placed = 1; s.nextEvent = new NaturalEventState { id = "meteor", el = "fire" };
                    foreach (var tile in s.cells.Values) tile.attrs[3] = 8;
                    s.shields.Add(new Shield { id = 901, cells = s.cells.Keys.Take(12).ToList(), coverage = 12, defense = new ElementBag { fire = 90 } });
                    app.Refresh(); app.Board.ClearFeedback(); HUD.ResetFeedback();
                    app.Dispatch(new GameAction { type = "endRound" });
                    Check(s.events.Count(e => e.kind == "meteor") >= 5, "Round-end native rules generate multiple meteor receipts");
                    Check(app.Board.QueuedEffectCount > 0, "Meteor impacts wait for their individual descent timelines");
                    break;
                case 4:
                    trackedCell = "3,2";
                    for (int i = 0; i < 5; i++) s.cells[trackedCell].beasts.Add(new Unit { id = 9000 + i, el = Game.EL[i] });
                    app.Refresh(); app.Dispatch(new GameAction { type = "mergeGuardian", cell = trackedCell, beastIds = Enumerable.Range(9000, 5).ToList() });
                    Check(s.cells[trackedCell].guardians.Count == 1 && s.cells[trackedCell].beasts.Count == 0, "Five selected beasts synthesize one native guardian");
                    Check(app.Board.ActiveEffectCount > 0, "Guardian synthesis has a native multi-frame visual");
                    break;
                case 5:
                    trackedCell = "3,2"; var guardian = new Guardian { id = 9500, power = new ElementBag { metal = 1, wood = 1, water = 1, fire = 1, earth = 1 } };
                    s.cells["2,2"].guardians.Add(guardian); s.placed = 1;
                    app.Refresh(); app.Dispatch(new GameAction { type = "moveGuardian", from = "2,2", to = trackedCell, guardianId = guardian.id });
                    Check(s.cells[trackedCell].guardians.Contains(guardian) && s.ap == apBefore - 1, "Guardian movement reaches the selected neighbor for one AP");
                    Check(app.Board.ActiveEffectCount > 0, "Guardian travel has a native arc visual");
                    break;
                case 6:
                    app.Board.PlayAction(null, s, s, new[] { new GameEvent { kind = "meteor", cell = "3,2", el = "water", strength = 3, damage = 0 } });
                    Check(app.Board.QueuedEffectCount > 0, "Reset test starts with a delayed meteor impact");
                    app.NewGame(false); app.UI.HideMainMenu();
                    Check(app.Board.ActiveEffectCount == 0 && app.Board.QueuedEffectCount == 0 && HUD.ActiveTokenCount == 0, "New game clears all delayed impacts and receipt flights");
                    app.Dispatch(new GameAction { type = "settingsReducedMotion", skip = true });
                    trackedCell = app.Current.cells.Keys.First(); app.Current.inv.crystal.wood = 20; app.Current.cells[trackedCell].attrs[1] = 0; app.Refresh();
                    app.Dispatch(new GameAction { type = "useCrystal", cell = trackedCell, el = "wood" });
                    Check(HUD.ActiveTokenCount == 0 && app.Board.QueuedEffectCount == 0, "Reduced motion settles crystals without flying tokens or delayed effects");
                    break;
            }
            nextFrame = 0; scenarioStarted = EditorApplication.timeSinceStartup;
            RecordFrame(); nextFrame++;
        }

        static Transform CellRoot(string key) => app.Board.GetComponentsInChildren<Transform>(true).First(t => t.name == "Cell " + key);
        static void RecordFrame()
        {
            string label = viewport == 0 ? "desktop" : "phone", name = ScenarioNames[scenario];
            int width = viewport == 0 ? 1440 : 390, height = viewport == 0 ? 900 : 844;
            double elapsed = EditorApplication.timeSinceStartup - scenarioStarted;
            string relative = label + "/" + name + "/" + nextFrame.ToString("00") + "-" + Math.Round(elapsed * 1000).ToString("0000") + "ms.png";
            var root = CellRoot(trackedCell); var hud = HUD;
            var token = hud.GetComponentsInChildren<RectTransform>().FirstOrDefault(t => t.name == "Resource Receipt" || t.name == "Pure Crystal Receipt");
            var frame = new Frame { image = relative.Replace('\\', '/'), viewport = label, scenario = name,
                seconds = (float)elapsed, landingY = root.localPosition.y, scaleY = root.localScale.y,
                hasVisibleToken = token != null, tokenX = token == null ? 0 : token.anchoredPosition.x, tokenY = token == null ? 0 : token.anchoredPosition.y,
                effects = app.Board.ActiveEffectCount, queuedEffects = app.Board.QueuedEffectCount,
                tokens = hud.ActiveTokenCount, displayedScore = hud.DisplayScore, actualScore = Game.Score(app.Current).total,
                displayedBag = hud.DisplayBag, actualBag = Game.BagCount(app.Current),
                displayedCells = hud.DisplayCells, actualCells = app.Current.cells.Count };
            Texture2D picture = Capture(width, height);
            if (scenario == 3 && nextFrame == 8)
            {
                // This fixture awards a fire pure crystal. Inspect the actual composited image,
                // rather than accepting an existing RectTransform or a generated vertex buffer.
                // The 64 x 84 center crop excludes the title/caption and most of the soft halo.
                // Old invisible-glyph screenshots yielded only 17 / 24 matching pixels here.
                frame.measuredPureGlyph = true;
                CountPureGlyphPixels(picture, out frame.pureGlyphSaturatedPixels, out frame.pureGlyphSamplePixels);
            }
            report.frames.Add(frame);
            images.Add(new PendingImage { path = Path.Combine(ArtifactDirectory, relative), texture = picture });
        }

        static void CountPureGlyphPixels(Texture2D picture, out int saturated, out int sampled)
        {
            Color32[] pixels = picture.GetPixels32();
            // Texture2D reads bottom-up; the web hero center is 44% down from the top.
            int centerX = Mathf.RoundToInt(picture.width * .5f), centerY = Mathf.RoundToInt(picture.height * .56f);
            saturated = sampled = 0;
            for (int y = Mathf.Max(0, centerY - 42); y < Mathf.Min(picture.height, centerY + 42); y++)
                for (int x = Mathf.Max(0, centerX - 32); x < Mathf.Min(picture.width, centerX + 32); x++)
                {
                    Color32 color = pixels[y * picture.width + x]; sampled++;
                    if (color.r >= 160 && color.g >= 20 && color.g <= 170 && color.b <= 110 && color.r > color.g * 1.3f && color.r - color.b > 70)
                        saturated++;
                }
        }

        static void ValidateScenario()
        {
            var frames = report.frames.Where(f => f.viewport == (viewport == 0 ? "desktop" : "phone") && f.scenario == ScenarioNames[scenario]).ToArray();
            Check(frames.Length == Times[scenario].Length && frames.Last().seconds > 1, frames[0].viewport + " " + frames[0].scenario + " records successive real play-mode frames");
            if (scenario == 0)
            {
                Check(frames[0].landingY > 1 && Math.Abs(frames.Last().landingY) < .001f, "Placed terrain travels from the air and settles onto its shared edges");
                Check(frames.Skip(1).Any(f => f.effects > 0), "Landing triggers connected-terrain wave and dust visuals");
            }
            if (scenario == 1)
            {
                Check(app.Current.round == roundBefore && app.Current.ap == apBefore, "Cosmetic crystal flights preserve round and AP");
                var tokens = frames.Where(f => f.hasVisibleToken).ToArray();
                Check(tokens.Length >= 2 && (tokens.Max(f => f.tokenX) - tokens.Min(f => f.tokenX) > 5 || tokens.Max(f => f.tokenY) - tokens.Min(f => f.tokenY) > 5),
                    "Native crystal tokens visibly travel across successive captured frames");
            }
            if (scenario == 3)
            {
                var pure = frames.Single(f => f.measuredPureGlyph);
                Check(pure.seconds >= 2.5f && pure.seconds <= 3.8f && pure.pureGlyphSaturatedPixels > 350,
                    pure.viewport + " pure crystal has visible saturated fire-colored pixels in its actual captured glyph area (" + pure.pureGlyphSaturatedPixels + "/" + pure.pureGlyphSamplePixels + ")");
            }
            Check(HUD.ActiveTokenCount <= 40, "Receipt queue and visible flights stay within the forty-token budget");
            Check(Math.Abs(HUD.DisplayScore - Game.Score(app.Current).total) < .001 && HUD.DisplayBag == Game.BagCount(app.Current)
                && HUD.DisplayCells == app.Current.cells.Count, "Delayed HUD counters converge to the authoritative state");
            Check(app.Board.ActiveTransientEffectCount == 0 && app.Board.QueuedEffectCount == 0 && HUD.ActiveTokenCount == 0,
                "Temporary geometry, impact queues and token nodes expire after " + ScenarioNames[scenario]);
        }

        static void SaveImages()
        {
            foreach (var image in images)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(image.path)); File.WriteAllBytes(image.path, image.texture.EncodeToPNG());
                UnityEngine.Object.DestroyImmediate(image.texture);
            }
            images.Clear();
            File.WriteAllText(Path.Combine(ArtifactDirectory, "motion-validation.json"), JsonUtility.ToJson(report, true));
        }

        // Render world and native UGUI separately, preserving the actual overlay's sharpness.
        // Linear alpha compositing uses a LUT to keep recording overhead low enough for motion.
        static Texture2D Capture(int width, int height)
        {
            var camera = Camera.main; var previousTarget = camera.targetTexture; var previousActive = RenderTexture.active;
            var world = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
            var overlay = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
            var canvases = UnityEngine.Object.FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None).Where(c => c.isRootCanvas).ToArray();
            var modes = canvases.Select(c => c.renderMode).ToArray(); var cameras = canvases.Select(c => c.worldCamera).ToArray();
            var distances = canvases.Select(c => c.planeDistance).ToArray();
            var objects = canvases.SelectMany(c => c.GetComponentsInChildren<Transform>(true)).Distinct().Select(t => t.gameObject).ToArray();
            var layers = objects.Select(o => o.layer).ToArray(); int previousMask = camera.cullingMask;
            var uiObject = new GameObject("Motion capture UI camera"); var uiCamera = uiObject.AddComponent<Camera>();
            uiCamera.cullingMask = 1 << 5; uiCamera.clearFlags = CameraClearFlags.SolidColor; uiCamera.backgroundColor = Color.clear;
            uiCamera.allowHDR = false; uiCamera.nearClipPlane = .01f; uiCamera.farClipPlane = 5;
            var uiData = uiObject.AddComponent<UniversalAdditionalCameraData>(); uiData.renderType = CameraRenderType.Base;
            uiData.renderPostProcessing = false; uiData.antialiasing = AntialiasingMode.None; uiData.volumeLayerMask = 0;
            Texture2D pixels = null, uiPixels = null;
            try
            {
                camera.targetTexture = world; camera.cullingMask &= ~(1 << 5); uiCamera.targetTexture = overlay;
                foreach (var item in objects) item.layer = 5;
                foreach (var canvas in canvases) { canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = uiCamera; canvas.planeDistance = 1; }
                Canvas.ForceUpdateCanvases(); app.UI.RefreshLayout(); app.Board.FitCameraToViewport(); Canvas.ForceUpdateCanvases();
                VolumeManager.instance.Update(camera.transform, camera.GetUniversalAdditionalCameraData().volumeLayerMask);
                RenderPipeline.SubmitRenderRequest(camera, new UniversalRenderPipeline.SingleCameraRequest { destination = world });
                RenderPipeline.SubmitRenderRequest(uiCamera, new UniversalRenderPipeline.SingleCameraRequest { destination = overlay });
                pixels = Read(world, width, height); uiPixels = Read(overlay, width, height);
                Color32[] background = pixels.GetPixels32(), foreground = uiPixels.GetPixels32();
                for (int i = 0; i < background.Length; i++)
                {
                    Color32 fg = foreground[i]; if (fg.a == 0) { background[i].a = 255; continue; }
                    Color32 bg = background[i]; float inv = 1 - fg.a / 255f;
                    background[i] = new Color32(Blend(fg.r, bg.r, inv), Blend(fg.g, bg.g, inv), Blend(fg.b, bg.b, inv), 255);
                }
                pixels.SetPixels32(background); pixels.Apply(); return pixels;
            }
            catch { if (pixels != null) UnityEngine.Object.DestroyImmediate(pixels); throw; }
            finally
            {
                if (uiPixels != null) UnityEngine.Object.DestroyImmediate(uiPixels);
                camera.targetTexture = previousTarget; camera.cullingMask = previousMask; RenderTexture.active = previousActive;
                for (int i = 0; i < canvases.Length; i++) { canvases[i].renderMode = modes[i]; canvases[i].worldCamera = cameras[i]; canvases[i].planeDistance = distances[i]; }
                for (int i = 0; i < objects.Length; i++) objects[i].layer = layers[i];
                UnityEngine.Object.DestroyImmediate(uiObject); world.Release(); overlay.Release();
                UnityEngine.Object.DestroyImmediate(world); UnityEngine.Object.DestroyImmediate(overlay);
                Canvas.ForceUpdateCanvases(); app.UI.RefreshLayout(); app.Board.FitCameraToViewport();
            }
        }
        static readonly float[] Linear = Enumerable.Range(0, 256).Select(i => Mathf.GammaToLinearSpace(i / 255f)).ToArray();
        static readonly byte[] Gamma = Enumerable.Range(0, 4097).Select(i => (byte)Mathf.Clamp(Mathf.RoundToInt(Mathf.LinearToGammaSpace(i / 4096f) * 255), 0, 255)).ToArray();
        static byte Blend(byte foreground, byte background, float inverseAlpha) => Gamma[Mathf.Clamp(Mathf.RoundToInt((Linear[foreground] + Linear[background] * inverseAlpha) * 4096), 0, 4096)];
        static Texture2D Read(RenderTexture target, int width, int height)
        {
            RenderTexture.active = target; var picture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            picture.ReadPixels(new Rect(0, 0, width, height), 0, 0); picture.Apply(); return picture;
        }
        static void Fail(Exception error)
        {
            failed = true; if (report == null) report = new Report(); report.errors.Add(error.ToString()); Debug.LogException(error);
            try { SaveImages(); } catch (Exception saveError) { Debug.LogException(saveError); }
            if (EditorApplication.isPlaying) { finishing = true; EditorApplication.isPlaying = false; }
            else { try { RestoreStorage(); } finally { Finish(); } }
        }
        static void Finish()
        {
            report.passed = !failed; Directory.CreateDirectory(ArtifactDirectory);
            File.WriteAllText(Path.Combine(ArtifactDirectory, "motion-validation.json"), JsonUtility.ToJson(report, true));
            EditorApplication.update -= Tick; Application.logMessageReceived -= OnLog;
            EditorApplication.Exit(failed ? 1 : 0);
        }
    }
}
