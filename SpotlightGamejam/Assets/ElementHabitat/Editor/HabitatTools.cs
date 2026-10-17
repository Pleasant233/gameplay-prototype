using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UI;

namespace ElementHabitat.Editor
{
    public static class HabitatTools
    {
        public const string Scene = "Assets/Scenes/ElementHabitat.unity";
        [MenuItem("元素生境/打开游戏场景")]
        public static void OpenGame() { if (EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) EditorSceneManager.OpenScene(Scene); }

        [MenuItem("元素生境/构建 Windows 试玩版")]
        public static void BuildWindows()
        {
            ValidateShaders();
            string target = Path.GetFullPath(Path.Combine(Application.dataPath, "../../artifacts/unity-player/ElementHabitat.exe"));
            Directory.CreateDirectory(Path.GetDirectoryName(target));
            var result = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { Scene }, locationPathName = target, target = BuildTarget.StandaloneWindows64, options = BuildOptions.None });
            if (result.summary.result != BuildResult.Succeeded) throw new Exception("Unity build failed: " + result.summary.result);
            Debug.Log("Native Unity player: " + target);
        }

        // -batchmode -projectPath ... -executeMethod ElementHabitat.Editor.HabitatTools.Validate
        // Do not add -quit: the update callback closes Unity after real play-mode frames.
        public static void Validate()
        {
            try
            {
                Directory.CreateDirectory(ArtifactDirectory);
                File.WriteAllText(Path.Combine(ArtifactDirectory, "runtime-errors.txt"), "");
                ValidateShaders();
                CaptureOriginalStorage();
                oldPlayOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
                oldPlayOptions = EditorSettings.enterPlayModeOptions;
                settingsCaptured = true;
                EditorSettings.enterPlayModeOptionsEnabled = true;
                EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload;
                Application.logMessageReceived += OnLog;
                EditorSceneManager.OpenScene(Scene);
                started = EditorApplication.timeSinceStartup;
                EditorApplication.update += Tick;
                EditorApplication.isPlaying = true;
            }
            catch (Exception e) { Fail(e); }
        }
        static string ArtifactDirectory => Path.GetFullPath(Path.Combine(Application.dataPath, "../../artifacts/unity"));
        static double started, next;
        static int step;
        static bool failed;
        static string[] storageFiles;
        static byte[][] previousStorage;
        static string[] prefKeys = { "habitat.achievements", "habitat.atmosphere", "habitat.reducedMotion", "habitat.sound", "habitat.music" };
        static string[] prefValues;
        static bool[] prefExists;
        static int checks;
        static bool oldPlayOptionsEnabled;
        static EnterPlayModeOptions oldPlayOptions;
        static bool settingsCaptured;

        static void CaptureOriginalStorage()
        {
            storageFiles = new[] { HabitatApp.SavePath, HabitatApp.SavePath + ".bak", HabitatApp.SavePath + ".tmp" };
            previousStorage = storageFiles.Select(p => File.Exists(p) ? File.ReadAllBytes(p) : null).ToArray();
            if (File.Exists(HabitatApp.SavePath)) File.Delete(HabitatApp.SavePath);
            prefKeys = prefKeys.Concat(Catalog.Achievements.SelectMany(a => new[] { "habitat.progress." + a.id, "habitat.achievement." + a.id })).ToArray();
            prefExists = prefKeys.Select(PlayerPrefs.HasKey).ToArray();
            prefValues = prefKeys.Select((p, i) => i == 0 ? PlayerPrefs.GetString(p) : PlayerPrefs.GetInt(p).ToString()).ToArray();
            PlayerPrefs.SetInt("habitat.sound", 0); PlayerPrefs.SetInt("habitat.music", 0);
        }
        static void RestoreOriginalStorage()
        {
            if (storageFiles != null) for (int i = 0; i < storageFiles.Length; i++)
            {
                if (previousStorage[i] != null) File.WriteAllBytes(storageFiles[i], previousStorage[i]);
                else if (File.Exists(storageFiles[i])) File.Delete(storageFiles[i]);
            }
            if (prefValues != null) for (int i = 0; i < prefKeys.Length; i++)
            {
                if (!prefExists[i]) PlayerPrefs.DeleteKey(prefKeys[i]);
                else if (i == 0) PlayerPrefs.SetString(prefKeys[i], prefValues[i]);
                else PlayerPrefs.SetInt(prefKeys[i], int.Parse(prefValues[i]));
            }
            PlayerPrefs.Save();
            if (settingsCaptured)
            {
                EditorSettings.enterPlayModeOptionsEnabled = oldPlayOptionsEnabled;
                EditorSettings.enterPlayModeOptions = oldPlayOptions;
            }
        }
        static void OnLog(string message, string trace, LogType type)
        {
            if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert)
            {
                failed = true;
                File.AppendAllText(Path.Combine(ArtifactDirectory, "runtime-errors.txt"), message + "\n" + trace + "\n");
            }
        }
        static void Check(bool condition, string description) { if (!condition) throw new Exception(description); checks++; Debug.Log("UNITY CHECK: " + description); }

        static void ValidateShaders()
        {
            foreach (var name in new[] { "HabitatTerrain", "HabitatShield", "HabitatFeedback" })
            {
                var shader = Resources.Load<Shader>(name);
                if (shader == null || ShaderUtil.ShaderHasError(shader))
                    throw new Exception("Shader import failed: " + name);
            }
        }

        static void Tick()
        {
            try
            {
                if (EditorApplication.timeSinceStartup - started > 180) throw new TimeoutException("Unity play validation timed out");
                if (EditorApplication.timeSinceStartup < next) return;
                if (step == 0)
                {
                    if (!EditorApplication.isPlaying || EditorApplication.isCompiling) return;
                    var app = UnityEngine.Object.FindFirstObjectByType<HabitatApp>();
                    if (app == null || app.Current == null) return;
                    Check(app.Current.cells.Count == 5, "native scene starts with five terrain cells");
                    Check(Catalog.Tiles.Count(t => !string.IsNullOrEmpty(t.family)) == 80, "80 current terrain definitions imported");
                    Check(Camera.main != null && app.Board != null && app.UI != null, "native camera, board and UI initialized");
                    Check(Resources.Load<Font>("HabitatChinese") != null, "offline Chinese font included");
                    app.Dispatch(new GameAction { type = "save" });
                    Check(!File.Exists(HabitatApp.SavePath), "saving a menu preview cannot overwrite a real game save");
                    Capture(app, 1440, 900, "desktop-menu.png");
                    step++; next = EditorApplication.timeSinceStartup + 1;
                }
                else if (step == 1)
                {
                    var app = UnityEngine.Object.FindFirstObjectByType<HabitatApp>();
                    // Real UI callbacks start the game; all further game changes go through the controller.
                    var begin = UnityEngine.Object.FindObjectsByType<Button>(FindObjectsInactive.Exclude, FindObjectsSortMode.None)
                        .FirstOrDefault(b => b.GetComponentsInChildren<Text>().Any(t => t.text.Contains("初醒") || t.text.Contains("开始旅程")));
                    Check(begin != null, "main-menu journey button exists"); begin.onClick.Invoke();
                    Check(!app.UI.IsMenuOpen && app.Current.journey != null, "journey button enters native game");
                    Capture(app, 1440, 900, "desktop-start.png");
                    app.Dispatch(new GameAction { type = "tutorial" });
                    app.SelectCell("3,2");
                    app.Dispatch(new GameAction { type = "selectOffer", offer = 0 });
                    app.SelectCell("5,3");
                    Check(app.Current.cells.Count == 6 && app.Current.ap == 2, "card mode plus board selection places one tile and spends one AP");
                    app.SelectCell("2,2"); app.Dispatch(new GameAction { type = "cast", magic = "purify", cell = "2,2" });
                    Check(app.Current.cells["3,2"].attrs[1] == 4, "native purification restores neighboring corrupted woodland");
                    app.Dispatch(new GameAction { type = "endRound" });
                    Check(app.Current.round == 2, "round settles ecology and advances");
                    app.SelectCell("3,2");
                    app.Dispatch(new GameAction { type = "upgrade", cell = "3,2", tileType = "woodland_t2" });
                    Check(app.Current.cells["3,2"].type == "woodland_t2", "native terrain upgrade automatically pays missing attributes with crystals");
                    var beforeWaterCrystals = app.Current.inv.crystal.water;
                    app.SelectCell("2,2"); app.Dispatch(new GameAction { type = "useCrystal", el = "water", cell = "2,2" }); app.Dispatch(new GameAction { type = "useCrystal", el = "water", cell = "2,2" });
                    Check(app.Current.inv.crystal.water == beforeWaterCrystals - 2 && app.Current.ap == 3 && app.Current.round == 2, "repeated crystals consume only matching stock");
                    Check(Game.Restore(File.ReadAllText(HabitatApp.SavePath)) != null, "native autosave can be restored");
                    Capture(app, 1440, 900, "desktop-playing.png");
                    Capture(app, 390, 844, "phone-playing.png");
                    step++; next = EditorApplication.timeSinceStartup + 1;
                }
                else if (step == 2)
                {
                    var app = UnityEngine.Object.FindFirstObjectByType<HabitatApp>();
                    // Fill a deterministic landscape to exercise every model family and all 85 colliders.
                    var defs = Catalog.Tiles.Where(t => !string.IsNullOrEmpty(t.family)).ToArray();
                    int i = 0;
                    foreach (var cell in Game.EmptyKeys(app.Current).ToArray()) app.Current.cells[cell] = Game.MakeTile(defs[(i++ * 11) % defs.Length].id);
                    app.Refresh();
                    // This fixture replaces the whole landscape at once. Seam checks use settled
                    // transforms; real action landing curves are checked by HabitatMotionValidation.
                    app.Board.ClearFeedback(); app.UI.ResetFeedback();
                    Check(app.Current.cells.Count == 84, "84 native terrain models and central tower render");
                    Check(app.Board.GetComponentsInChildren<MeshCollider>().Length == 85, "every initial square including the tower has a native picking collider");
                    ValidateSharedEdges(app.Board);
                    Capture(app, 1440, 900, "desktop-full-map.png");
                    Capture(app, 390, 844, "phone-full-map.png");
                    app.UI.ShowTower();
                    Capture(app, 1440, 900, "desktop-tower.png");
                    Capture(app, 390, 844, "phone-tower.png");
                    app.UI.CloseModal();
                    var atlas = UnityEngine.Object.FindObjectsByType<Button>(FindObjectsInactive.Exclude, FindObjectsSortMode.None)
                        .FirstOrDefault(b => b.GetComponentsInChildren<Text>().Any(t => t.text == "图鉴"));
                    Check(atlas != null, "native atlas toolbar button exists"); atlas.onClick.Invoke();
                    Capture(app, 390, 844, "phone-atlas.png");
                    app.UI.CloseModal();
                    app.Current.completedMap = true;
                    app.Dispatch(new GameAction { type = "enterEndless" });
                    var outside = Game.LegalPlacements(app.Current).FirstOrDefault(k => !Game.ShapeKeys.Contains(k));
                    Check(outside != null, "endless mode offers placements beyond the initial shape");
                    app.Dispatch(new GameAction { type = "place", offer = 0, cell = outside });
                    Check(app.Current.cells.ContainsKey(outside), "native endless board accepts and renders an outside tile");
                    app.Dispatch(new GameAction { type = "photoMode" });
                    Capture(app, 1440, 900, "desktop-photo-mode.png");
                    var photoRound = app.Current.round; var photoAP = app.Current.ap;
                    app.SelectCell("2,2");
                    Check(app.Current.round == photoRound && app.Current.ap == photoAP, "photography inspection does not spend actions or advance rounds");
                    app.Dispatch(new GameAction { type = "exitPhoto" });
                    app.Board.SetReducedMotion(true); app.Board.SetAtmosphere(false);
                    Capture(app, 1440, 900, "desktop-atmosphere-off.png");
                    app.Board.SetAtmosphere(true);
                    Capture(app, 1440, 900, "desktop-atmosphere-on.png");
                    EditorApplication.isPlaying = false;
                    step++; next = EditorApplication.timeSinceStartup + 2;
                }
                else if (!EditorApplication.isPlaying)
                {
                    RestoreOriginalStorage();
                    File.WriteAllText(Path.Combine(ArtifactDirectory, "validation.json"), "{\"checks\":" + checks + ",\"runtimeErrors\":" + (failed ? "true" : "false") + ",\"screenshots\":12,\"physicalDeviceTested\":false}");
                    EditorApplication.update -= Tick; Application.logMessageReceived -= OnLog;
                    EditorApplication.Exit(failed ? 1 : 0);
                }
            }
            catch (Exception e) { Fail(e); }
        }

        static void ValidateSharedEdges(HabitatBoard board)
        {
            var meshes = board.GetComponentsInChildren<MeshFilter>().Where(f => f.name == "Shared terrain").ToDictionary(f => f.transform.parent.name.Substring(5));
            int samples = 0;
            foreach (var entry in meshes)
            {
                var p = Game.Parse(entry.Key);
                for (int axis = 0; axis < 2; axis++)
                {
                    string neighbor = (p[0] + (axis == 0 ? 1 : 0)) + "," + (p[1] + (axis == 1 ? 1 : 0));
                    if (!meshes.TryGetValue(neighbor, out var other)) continue;
                    var a = entry.Value.sharedMesh; var b = other.sharedMesh;
                    for (int n = 0; n <= 8; n++)
                    {
                        int ia = axis == 0 ? n * 9 + 8 : 72 + n, ib = axis == 0 ? n * 9 : n;
                        var wa = entry.Value.transform.TransformPoint(a.vertices[ia]); var wb = other.transform.TransformPoint(b.vertices[ib]);
                        if (Vector3.Distance(wa, wb) > .0001f || Vector4.Distance(a.colors[ia], b.colors[ib]) > .0001f || Vector3.Distance(a.normals[ia], b.normals[ib]) > .0001f)
                            throw new Exception("Native terrain seam at " + entry.Key + " / " + neighbor);
                        samples++;
                    }
                }
            }
            Check(samples > 500, "native shared terrain edges match in position, color and normal (" + samples + " samples)");
        }

        static void Capture(HabitatApp app, int width, int height, string filename)
        {
            var camera = Camera.main;
            var target = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
            var oldTarget = camera.targetTexture;
            var canvases = UnityEngine.Object.FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None).Where(c => c.isRootCanvas).ToArray();
            var modes = canvases.Select(c => c.renderMode).ToArray();
            var cameras = canvases.Select(c => c.worldCamera).ToArray();
            var distances = canvases.Select(c => c.planeDistance).ToArray();
            var objects = canvases.SelectMany(c => c.GetComponentsInChildren<Transform>(true)).Distinct().Select(t => t.gameObject).ToArray();
            var layers = objects.Select(o => o.layer).ToArray();
            var oldMask = camera.cullingMask;
            var baseData = camera.GetUniversalAdditionalCameraData();
            var uiTarget = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
            var uiObject = new GameObject("Capture UI camera");
            var uiCamera = uiObject.AddComponent<Camera>();
            uiCamera.enabled = true;
            uiCamera.cullingMask = 1 << 5;
            uiCamera.clearFlags = CameraClearFlags.SolidColor;
            uiCamera.backgroundColor = Color.clear;
            uiCamera.allowHDR = false;
            uiCamera.nearClipPlane = .01f; uiCamera.farClipPlane = 5;
            var uiData = uiObject.AddComponent<UniversalAdditionalCameraData>();
            uiData.renderType = CameraRenderType.Base;
            uiData.renderPostProcessing = false;
            uiData.antialiasing = AntialiasingMode.None;
            uiData.volumeLayerMask = 0;
            try
            {
                camera.targetTexture = target;
                camera.cullingMask &= ~(1 << 5);
                foreach (var item in objects) item.layer = 5;
                uiCamera.targetTexture = uiTarget;
                foreach (var canvas in canvases) { canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = uiCamera; canvas.planeDistance = 1; }
                Canvas.ForceUpdateCanvases();
                app.UI.RefreshLayout();
                app.Board.FitCameraToViewport();
                Canvas.ForceUpdateCanvases();
                VolumeManager.instance.Update(camera.transform, baseData.volumeLayerMask);
                var request = new UniversalRenderPipeline.SingleCameraRequest { destination = target };
                RenderPipeline.SubmitRenderRequest(camera, request);
                // Render UGUI after atmosphere in an independent transparent camera, like the
                // real ScreenSpaceOverlay canvas. It must never inherit world depth of field.
                RenderPipeline.SubmitRenderRequest(uiCamera, new UniversalRenderPipeline.SingleCameraRequest { destination = uiTarget });
                var previous = RenderTexture.active; RenderTexture.active = target;
                var texture = new Texture2D(width, height, TextureFormat.RGBA32, false);
                texture.ReadPixels(new Rect(0, 0, width, height), 0, 0); texture.Apply();
                RenderTexture.active = uiTarget;
                var interfaceTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
                interfaceTexture.ReadPixels(new Rect(0, 0, width, height), 0, 0); interfaceTexture.Apply();
                var worldPixels = texture.GetPixels(); var uiPixels = interfaceTexture.GetPixels();
                for (int i = 0; i < worldPixels.Length; i++)
                {
                    var foreground = uiPixels[i].linear; var background = worldPixels[i].linear;
                    var mixed = foreground + background * (1 - uiPixels[i].a); mixed.a = 1;
                    worldPixels[i] = mixed.gamma;
                }
                texture.SetPixels(worldPixels); texture.Apply();
                File.WriteAllBytes(Path.Combine(ArtifactDirectory, filename), texture.EncodeToPNG());
                UnityEngine.Object.DestroyImmediate(texture); UnityEngine.Object.DestroyImmediate(interfaceTexture); RenderTexture.active = previous;
            }
            finally
            {
                camera.targetTexture = oldTarget;
                camera.cullingMask = oldMask;
                for (int i = 0; i < canvases.Length; i++) { canvases[i].renderMode = modes[i]; canvases[i].worldCamera = cameras[i]; canvases[i].planeDistance = distances[i]; }
                for (int i = 0; i < objects.Length; i++) objects[i].layer = layers[i];
                UnityEngine.Object.DestroyImmediate(uiObject);
                target.Release(); UnityEngine.Object.DestroyImmediate(target);
                uiTarget.Release(); UnityEngine.Object.DestroyImmediate(uiTarget);
                Canvas.ForceUpdateCanvases();
                app.UI.RefreshLayout(); app.Board.FitCameraToViewport();
            }
        }

        static void Fail(Exception e)
        {
            failed = true; Debug.LogException(e);
            try { RestoreOriginalStorage(); } catch (Exception restore) { Debug.LogException(restore); }
            EditorApplication.update -= Tick;
            EditorApplication.Exit(1);
        }
    }
}
