using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UI;
using Object = UnityEngine.Object;

namespace ElementHabitat.Editor
{
    // Runs only in a separately opened verification project. Default domain reload is
    // deliberate: SessionState restores the runner, so scene serialization is exercised.
    [InitializeOnLoad]
    public static class HabitatInterfaceValidation
    {
        const string SessionPrefix = "Habitat.InterfaceValidation.";
        [Serializable] public sealed class Bounds { public string name, text; public float x, y, width, height; }
        [Serializable] public sealed class Frame { public string image, viewport, scenario; public int width, height; public List<Bounds> bounds = new List<Bounds>(); }
        [Serializable] public sealed class Report { public bool passed, defaultDomainReload = true, physicalDeviceTested; public string input = "Queued native InputSystem Mouse/Keyboard/Touchscreen states, normal Update and EventSystem raycasts"; public List<string> checks = new List<string>(), errors = new List<string>(); public List<Frame> frames = new List<Frame>(); }
        [Serializable] sealed class FileCopy { public string path, bytes; public bool exists; }
        [Serializable] sealed class Pref { public string key, value; public bool exists, text; }
        [Serializable] sealed class Backup { public List<FileCopy> files = new List<FileCopy>(); public List<Pref> prefs = new List<Pref>(); public bool oldPlayEnabled; public int oldPlayOptions; }
        sealed class Step { public string name; public Action run; public double delay; }
        static Report report;
        static HabitatApp app;
        static Mouse mouse;
        static Keyboard keyboard;
        static Touchscreen touches;
        static readonly List<Step> steps = new List<Step>();
        static int step, viewport;
        static double next, started;
        static Vector2 point, dragStart, baselineProjected;
        static float baselineYaw, baselinePitch, baselineDistance;
        static Vector3 baselineGoal;
        static int round, ap, cells;
        static string selected, inspectionState;
        static HashSet<string> exportsBefore;
        static EditorWindow gameView;
        static string DirectoryPath => Path.Combine(HabitatValidationPaths.Artifacts, "unity-interface");
        static string ReportPath => Path.Combine(DirectoryPath, "interface-validation.json");
        static string BackupPath => Path.Combine(DirectoryPath, "storage-backup.json");
        static bool Active => SessionState.GetBool(SessionPrefix + "active", false);

        static HabitatInterfaceValidation()
        {
            if (!Active) return;
            Application.logMessageReceived += OnLog;
            EditorApplication.playModeStateChanged += PlayState;
            EditorApplication.delayCall += Resume;
        }

        public static void Validate()
        {
            if (!Application.isBatchMode) throw new InvalidOperationException("Run interface acceptance through unity-check.ps1 -Interface in a separate verification project.");
            if (EditorApplication.isPlayingOrWillChangePlaymode) throw new InvalidOperationException("Interface validation must start from edit mode in the verification project.");
            Directory.CreateDirectory(DirectoryPath);
            report = new Report(); Save();
            // A fresh verification checkout has no UserSettings/Search.index. Unity 6000.3
            // skips first-use index creation after isPlayingOrWillChangePlaymode becomes
            // true, yet startup indexing immediately enumerates database[0]. Initialize
            // through the public API while still in edit mode, before requesting Play.
            Check(UnityEditor.Search.SearchService.EnumerateDatabases().Any(), "default Editor Search index initialized before entering Play");
            var backup = new Backup { oldPlayEnabled = EditorSettings.enterPlayModeOptionsEnabled, oldPlayOptions = (int)EditorSettings.enterPlayModeOptions };
            foreach (string path in new[] { HabitatApp.SavePath, HabitatApp.SavePath + ".bak", HabitatApp.SavePath + ".tmp" })
            {
                backup.files.Add(new FileCopy { path = path, exists = File.Exists(path), bytes = File.Exists(path) ? Convert.ToBase64String(File.ReadAllBytes(path)) : null });
                if (File.Exists(path)) File.Delete(path);
            }
            foreach (string key in new[] { "habitat.achievements", "habitat.atmosphere", "habitat.reducedMotion", "habitat.sound", "habitat.music" }.Concat(Catalog.Achievements.SelectMany(a => new[] { "habitat.progress." + a.id, "habitat.achievement." + a.id })))
                backup.prefs.Add(new Pref { key = key, exists = PlayerPrefs.HasKey(key), text = key == "habitat.achievements", value = key == "habitat.achievements" ? PlayerPrefs.GetString(key) : PlayerPrefs.GetInt(key).ToString() });
            File.WriteAllText(BackupPath, JsonUtility.ToJson(backup, true));
            PlayerPrefs.SetInt("habitat.sound", 0); PlayerPrefs.SetInt("habitat.music", 0); PlayerPrefs.SetInt("habitat.reducedMotion", 1); PlayerPrefs.Save();
            SessionState.SetBool(SessionPrefix + "active", true); SessionState.SetBool(SessionPrefix + "finishing", false);
            EditorSettings.enterPlayModeOptionsEnabled = false;
            EditorSceneManager.OpenScene(HabitatTools.Scene);
            var pending = typeof(HabitatApp).GetField("pending", BindingFlags.NonPublic | BindingFlags.Instance);
            Check(pending != null && pending.IsNotSerialized, "pending intent is excluded from Unity serialization");
            Check(new SerializedObject(Object.FindFirstObjectByType<HabitatApp>()).FindProperty("pending") == null, "SerializedObject does not unfold recursive GameAction upgrades");
            Application.logMessageReceived += OnLog; EditorApplication.playModeStateChanged += PlayState;
            EditorApplication.isPlaying = true;
        }

        static void Resume()
        {
            if (!Active) return;
            report = File.Exists(ReportPath) ? JsonUtility.FromJson<Report>(File.ReadAllText(ReportPath)) : new Report();
            if (SessionState.GetBool(SessionPrefix + "finishing", false) && !EditorApplication.isPlayingOrWillChangePlaymode) Finish();
            else if (EditorApplication.isPlaying) Begin();
        }
        static void PlayState(PlayModeStateChange change)
        {
            if (!Active) return;
            if (change == PlayModeStateChange.EnteredPlayMode) Begin();
            if (change == PlayModeStateChange.EnteredEditMode && SessionState.GetBool(SessionPrefix + "finishing", false)) Finish();
        }
        static void Begin()
        {
            if (mouse != null) return;
            if (report == null) report = JsonUtility.FromJson<Report>(File.ReadAllText(ReportPath));
            mouse = InputSystem.AddDevice<Mouse>("Habitat acceptance mouse");
            keyboard = InputSystem.AddDevice<Keyboard>("Habitat acceptance keyboard");
            touches = InputSystem.AddDevice<Touchscreen>("Habitat acceptance touch");
            mouse.MakeCurrent(); keyboard.MakeCurrent(); touches.MakeCurrent();
            InputSystem.settings.backgroundBehavior = InputSettings.BackgroundBehavior.IgnoreFocus;
            InputSystem.settings.editorInputBehaviorInPlayMode = InputSettings.EditorInputBehaviorInPlayMode.AllDeviceInputAlwaysGoesToGameView;
            started = EditorApplication.timeSinceStartup; next = started + .5; viewport = 0;
            steps.Clear(); step = 0;
            Add("wait for native startup", () => { app = Object.FindFirstObjectByType<HabitatApp>(); Check(app != null && app.UI != null, "scene starts after normal domain reload"); }, 1);
            ViewportSteps(false); ViewportSteps(true);
            Add("finish", Stop);
            EditorApplication.update -= Tick; EditorApplication.update += Tick;
        }
        static void Add(string name, Action run, double delay = .22) { steps.Add(new Step { name = name, run = run, delay = delay }); }
        static void ViewportSteps(bool phone)
        {
            string v = phone ? "phone" : "desktop";
            Add(v + " resolution", () => { viewport = phone ? 1 : 0; SetSize(phone ? 390 : 1440, phone ? 844 : 900); }, 1);
            Add(v + " main menu", () => { app.UI.ShowMainMenu(File.Exists(HabitatApp.SavePath)); Capture("menu"); });
            if (!phone)
            {
                Click("challenge menu", () => FindButton(t => t.StartsWith("复苏挑战")));
                Add("new session from menu", () => Check(!app.UI.IsMenuOpen && app.Current.mode == "challenge", "main menu native pointer click starts challenge"), 3.2);
            }
            else Add("phone session setup", () => { app.NewGame(false); app.UI.HideMainMenu(); app.Refresh(); }, 3.2);
            Add(v + " reset and HUD", () => { app.Board.ResetCamera(true); Capture("hud"); Check(Screen.width == (phone ? 390 : 1440) && Screen.height == (phone ? 844 : 900), v + " real GameView resolution"); CheckChrome(); CheckRenderedGraphics(); });
            Click(v + " offer", () => FindOffer());
            Add(v + " selected offer", () => { Check(app.SelectedOffer >= 0, v + " offer selected via native pointer and EventSystem"); Capture("offer"); });
            Press(v + " escape", Key.Escape);
            Add(v + " cancel offer", () => Check(app.SelectedOffer < 0, v + " Escape cancels offer"));
            ClickPoint(v + " terrain", () => app.Board.WorldToScreenPoint("3,4"));
            Add(v + " detail", () => { Check(app.SelectedCell == "3,4", v + " real board raycast selects terrain"); Capture("detail"); });
            ClickPoint(v + " repeat terrain", () => app.Board.WorldToScreenPoint("3,4"));
            Add(v + " detail toggle", () => Check(app.SelectedCell == null, v + " same tile click closes details"));
            Click(v + " bag", () => FindNamedButton("Bag Button"));
            Add(v + " bag panel", () => { Check(app.UI.InventoryOpen, v + " bag pointer click reveals inventory"); Capture("bag"); CheckPanel("Crystal Bag Drawer", phone ? 8 : Screen.width - 272, 64, phone ? Screen.width - 16 : 260); });
            Press(v + " bag escape", Key.Escape);
            Click(v + " magic", () => FindButton(t => t.Contains("净化") && !t.Contains("升级")));
            Add(v + " magic mode", () => { var p = (GameAction)typeof(HabitatApp).GetField("pending", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(app); Check(p != null && p.type == "cast", v + " magic button enters target selection"); Capture("magic"); });
            Press(v + " magic escape", Key.Escape);
            Add(v + " camera baseline", () => { app.Board.ResetCamera(true); baselineYaw = Float("cameraYaw"); baselinePitch = Float("cameraPitch"); baselineDistance = Float("cameraDistance"); baselineGoal = Vector("cameraGoal"); selected = app.SelectedCell; cells = app.Current.cells.Count; ap = app.Current.ap; dragStart = new Vector2(Screen.width * .79f, Screen.height * .46f); });
            if (!phone)
            {
                Add("left drag begin", () => MouseState(dragStart, 0, true), .15);
                for (int i = 1; i <= 8; i++) { int n = i; Add("left drag", () => MouseState(dragStart + new Vector2(100, -40) * n / 8, 0, true), .055); }
                Add("left drag release", () => MouseState(dragStart + new Vector2(100, -40)), .4);
                Add("mouse rotation", () => { Check(Mathf.Abs(Mathf.Abs(Float("cameraYaw") - baselineYaw) - .5f) < .04f && Mathf.Abs(Float("cameraPitch") - baselinePitch + .16f) < .04f, "left drag matches browser rotation sensitivity and screen orientation"); Check(app.SelectedCell == selected && app.Current.ap == ap && app.Current.cells.Count == cells, "drag does not select or place terrain"); Capture("camera-rotated"); });
                Add("wheel in world", () => InputSystem.QueueStateEvent(mouse, new MouseState { position = dragStart, scroll = new Vector2(0, 120) }), .4);
                Add("mouse wheel zoom", () => Check(Mathf.Abs(Float("cameraDistance") - baselineDistance * .92f) < .12f, "wheel up zoom matches browser 0.92 ratio"));
                Add("right drag baseline", () => { baselineGoal = Vector("cameraGoal"); baselineYaw = Float("cameraYaw"); baselineProjected = app.Board.WorldToScreenPoint("3,4"); MouseState(dragStart, 1, true); }, .1);
                Add("right drag move", () => MouseState(dragStart + new Vector2(70, 30), 1, true), .15);
                Add("right drag release", () => MouseState(dragStart + new Vector2(70, 30)), .3);
                // The actual live browser pans vertically opposite to the drag: camera-input.json
                // records CSS dy -30 moving terrain +52.9 CSS pixels. Unity y grows upward.
                Add("right pan", () => { Check(Vector3.Distance(Vector("cameraGoal"), baselineGoal) > .2f && Mathf.Abs(Float("cameraYaw") - baselineYaw) < .01f, "right drag pans without orbiting"); Vector2 p = app.Board.WorldToScreenPoint("3,4"); Check(p.x > baselineProjected.x + 15 && p.y < baselineProjected.y - 3, "right pan matches measured live browser screen direction (horizontal follows, vertical opposes)"); Capture("camera-panned"); });
                Press("camera reset", Key.Space);
                Add("space reset check", () => Check(Mathf.Abs(Float("cameraYaw") - .78f) < .01f && Mathf.Abs(Float("cameraPitch") - .9f) < .01f && Vector3.Distance(Vector("cameraGoal"), new Vector3(0, .2f, 0)) < .02f, "Space restores browser camera pose"));
                Add("keyboard pan begin", () => { baselineGoal = Vector("cameraGoal"); InputSystem.QueueStateEvent(keyboard, new KeyboardState(Key.W)); }, .3);
                Add("keyboard pan end", () => InputSystem.QueueStateEvent(keyboard, new KeyboardState()), .1);
                Add("keyboard pan check", () => Check(Vector3.Distance(Vector("cameraGoal"), baselineGoal) > .8f, "W pans through real Keyboard state"));
            }
            else
            {
                Add("touch orbit begin", () => Touch(11, UnityEngine.InputSystem.TouchPhase.Began, dragStart), .1);
                Add("touch orbit move", () => Touch(11, UnityEngine.InputSystem.TouchPhase.Moved, dragStart + new Vector2(60, -25)), .2);
                Add("touch orbit end", () => Touch(11, UnityEngine.InputSystem.TouchPhase.Ended, dragStart + new Vector2(60, -25)), .3);
                Add("touch orbit check", () => { Check(Mathf.Abs(Mathf.Abs(Float("cameraYaw") - baselineYaw) - .3f) < .04f, "single finger drag orbits with browser sensitivity"); Check(app.SelectedCell == selected && app.Current.ap == ap, "touch drag does not trigger tile tap"); Capture("camera-rotated"); });
                Add("pinch baseline", () => { baselineDistance = Float("cameraDistance"); baselineGoal = Vector("cameraGoal"); Touch(21, UnityEngine.InputSystem.TouchPhase.Began, dragStart - Vector2.right * 35); Touch(22, UnityEngine.InputSystem.TouchPhase.Began, dragStart + Vector2.right * 35); }, .15);
                Add("pinch move", () => { Touch(21, UnityEngine.InputSystem.TouchPhase.Moved, dragStart + new Vector2(-55, 20)); Touch(22, UnityEngine.InputSystem.TouchPhase.Moved, dragStart + new Vector2(55, 20)); }, .2);
                Add("pinch end", () => { Touch(21, UnityEngine.InputSystem.TouchPhase.Ended, dragStart + new Vector2(-55, 20)); Touch(22, UnityEngine.InputSystem.TouchPhase.Ended, dragStart + new Vector2(55, 20)); }, .3);
                Add("pinch check", () => { Check(Mathf.Abs(Float("cameraDistance") - baselineDistance * 70 / 110) < .35f, "two finger pinch uses last/current span ratio"); Check(Vector3.Distance(Vector("cameraGoal"), baselineGoal) > .1f, "two finger centroid pans"); Capture("camera-pinched"); });
            }
            Add(v + " reset for shortcuts", () => app.Board.ResetCamera(true));
            // The final up event can contain displacement without an earlier move event.
            // Test both native Mouse (desktop) and Touchscreen (phone) paths.
            Add(v + " displaced release down", () => { selected = app.SelectedCell; cells = app.Current.cells.Count; ap = app.Current.ap; point = app.Board.WorldToScreenPoint("3,5"); Pointer(true); }, .12);
            Add(v + " displaced release up", () => { point = app.Board.WorldToScreenPoint("3,4"); Pointer(false); }, .3);
            Add(v + " displaced release check", () => Check(app.SelectedCell == selected && app.Current.cells.Count == cells && app.Current.ap == ap, v + " displaced pointer release without move is not a map click"));
            ClickPoint(v + " select before offer cancel", () => app.Board.WorldToScreenPoint("3,4"));
            Click(v + " offer with detail open", () => FindOffer());
            Press(v + " offer Escape with detail open", Key.Escape);
            Add(v + " cancelled offer check", () => Check(app.SelectedOffer < 0, v + " Escape cancels offer while an ordinary tile detail is open"));
            ClickPoint(v + " empty after offer cancel", () => app.Board.WorldToScreenPoint("2,4"));
            Add(v + " no placement after cancel", () => Check(!app.Current.cells.ContainsKey("2,4") && app.Current.cells.Count == cells && app.Current.ap == ap && app.SelectedCell == null, v + " map click after offer cancellation does not place a tile"));
            ClickPoint(v + " select before magic cancel", () => app.Board.WorldToScreenPoint("3,4"));
            Click(v + " magic with detail open", () => FindNamedButton("Magic purify"));
            Press(v + " magic Escape with detail open", Key.Escape);
            Add(v + " cancelled magic check", () => Check(typeof(HabitatApp).GetField("pending", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(app) == null, v + " Escape clears pending magic while an ordinary tile detail is open"));
            ClickPoint(v + " terrain after magic cancel", () => app.Board.WorldToScreenPoint("2,3"));
            Add(v + " no cast after cancel", () => Check(app.Current.cells.Count == cells && app.Current.ap == ap && app.SelectedCell == "2,3", v + " map click after magic cancellation selects another tile without casting"));
            Press(v + " close ordinary detail before placement", Key.Escape);
            Add(v + " ordinary detail close check", () => Check(app.SelectedCell == null, v + " Escape clears ordinary tile selection before placement"));
            Press(v + " numeric select", Key.Digit1);
            Add(v + " numeric check", () => Check(app.SelectedOffer == 0, v + " 1 selects first offer"));
            Add(v + " placement baseline", () => { cells = app.Current.cells.Count; ap = app.Current.ap; });
            ClickPoint(v + " placement target", () => app.Board.WorldToScreenPoint("3,5"));
            Add(v + " placement check", () => { bool placed = app.Current.cells.ContainsKey("3,5") && app.Current.cells.Count == cells + 1 && app.Current.ap == ap - 1; Check(placed, v + " card and native board tap place one tile for one AP" + (placed ? "" : "; selectedOffer=" + app.SelectedOffer + ", selectedCell=" + app.SelectedCell + ", AP=" + app.Current.ap + " (expected " + (ap - 1) + "), cells=" + app.Current.cells.Count + " (expected " + (cells + 1) + "), hasTarget=" + app.Current.cells.ContainsKey("3,5") + ", message=" + app.Message)); Capture("placed"); });
            Press(v + " numeric cancel", Key.Escape);
            Press(v + " bag shortcut", Key.B);
            Add(v + " B check", () => Check(app.UI.InventoryOpen, v + " B opens inventory"));
            Press(v + " B close", Key.Escape);
            Click(v + " menu button", () => FindNamedButton("Menu Button"));
            Add(v + " menu camera block baseline", () => { baselineYaw = Float("cameraYaw"); baselineDistance = Float("cameraDistance"); round = app.Current.round; });
            Add(v + " modal wheel", () => InputSystem.QueueStateEvent(mouse, new MouseState { position = new Vector2(Screen.width / 2, Screen.height / 2), scroll = Vector2.up * 120 }), .2);
            Press(v + " modal Enter", Key.Enter);
            Add(v + " menu blocks input", () => Check(app.Current.round == round && Mathf.Abs(Float("cameraYaw") - baselineYaw) < .01f && Mathf.Abs(Float("cameraDistance") - baselineDistance) < .01f, v + " menu blocks camera and gameplay shortcuts"));
            Click(v + " settings", () => FindButton(t => t == "设置"));
            Add(v + " settings capture", () => Capture("settings"));
            Press(v + " settings close", Key.Escape);
            Press(v + " menu close", Key.Escape);
            Add(v + " end round baseline", () => { Check(!app.UI.IsMenuOpen && !app.UI.HasBlockingModal, v + " Escape closes settings then returns from menu"); app.Refresh(); round = app.Current.round; });
            Click(v + " end button", () => FindButton(t => t.StartsWith("结束本轮")));
            Add(v + " end round check", () => { Check(app.Current.round == round + 1, v + " End round pointer button advances authoritative round"); Capture("round-end"); });
            // Keep the button selected by the real pointer click. Clearing EventSystem focus
            // here would hide a duplicate Enter submit from InputSystemUIInputModule + App.
            Add(v + " focused Enter down", () => InputSystem.QueueStateEvent(keyboard, new KeyboardState(Key.Enter)), .12);
            Add(v + " focused Enter up", () => InputSystem.QueueStateEvent(keyboard, new KeyboardState()), .35);
            Add(v + " focused Enter check", () => { Check(app.Current.round == round + 2, v + " focused End Round followed by Enter advances exactly one additional round (expected " + (round + 2) + ", actual " + app.Current.round + ", pointer baseline " + round + ")"); Capture("round-keyboard"); });
            // Only eligibility is a fixture. Entry, inspection, protected shortcuts and
            // export are exercised through the same input routes as a player.
            Add(v + " completed-map setup", () => { app.Current.completedMap = true; app.Refresh(); inspectionState = Game.Serialize(app.Current); });
            Press(v + " photo shortcut", Key.P);
            Add(v + " photo entry", () => { Check(IsPhoto() && app.UI.GetComponentsInChildren<RectTransform>().Any(r => r.name == "Photography Controls" && r.gameObject.activeInHierarchy), v + " P enters photo mode and shows native photo controls"); Capture("photo"); });
            ClickPoint(v + " photo inspect", () => app.Board.WorldToScreenPoint("3,4"));
            Add(v + " photo inspection check", () => { Check(app.SelectedCell == "3,4" && Game.Serialize(app.Current) == inspectionState, v + " photo tile raycast opens read-only inspection"); Capture("photo-detail"); });
            Press(v + " protected photo Enter", Key.Enter);
            Add(v + " protected photo check", () => Check(Game.Serialize(app.Current) == inspectionState, v + " Enter cannot mutate the game during photo inspection"));
            Add(v + " export baseline", () => { exportsBefore = new HashSet<string>(Directory.GetFiles(Application.persistentDataPath, "生境地图-*.json")); });
            Add(v + " Ctrl S down", () => InputSystem.QueueStateEvent(keyboard, new KeyboardState(Key.LeftCtrl, Key.S)), .12);
            Add(v + " Ctrl S up", () => InputSystem.QueueStateEvent(keyboard, new KeyboardState()), .3);
            Add(v + " exported map check", () =>
            {
                var files = Directory.GetFiles(Application.persistentDataPath, "生境地图-*.json").Where(p => !exportsBefore.Contains(p)).ToArray();
                Check(files.Length == 1, v + " Ctrl+S exports exactly one complete-map file");
                var loaded = Game.Restore(File.ReadAllText(files[0]));
                Check(loaded != null && loaded.completedMap && loaded.round == app.Current.round && loaded.cells.Count == app.Current.cells.Count && Game.Serialize(app.Current) == inspectionState, v + " exported map restores current state without photo mutation");
                File.Delete(files[0]);
            });
            Press(v + " photo Escape", Key.Escape);
            Add(v + " photo exit", () => Check(!IsPhoto() && Game.Serialize(app.Current) == inspectionState, v + " Escape returns from photo mode without mutation"));
        }

        static void Click(string name, Func<Button> button)
        {
            Add(name + " pointer down", () => { var b = button(); point = Center(b.GetComponent<RectTransform>()); var hits = new List<RaycastResult>(); EventSystem.current.RaycastAll(new PointerEventData(EventSystem.current) { position = point }, hits); Check(hits.Count > 0 && hits[0].gameObject.GetComponentInParent<Button>() == b, name + " is reachable by EventSystem raycast"); Pointer(true); }, .1);
            Add(name + " pointer up", () => Pointer(false), .35);
        }
        static void ClickPoint(string name, Func<Vector3> location) { Add(name + " pointer down", () => { point = location(); Check(!app.UI.IsPointerOverUI(point), name + " board target is not covered by UGUI"); Pointer(true); }, .1); Add(name + " pointer up", () => Pointer(false), .35); }
        static void Pointer(bool down) { if (viewport == 1) Touch(1, down ? UnityEngine.InputSystem.TouchPhase.Began : UnityEngine.InputSystem.TouchPhase.Ended, point); else MouseState(point, 0, down); }
        static void Press(string name, Key key) { Add(name + " down", () => { EventSystem.current.SetSelectedGameObject(null); InputSystem.QueueStateEvent(keyboard, new KeyboardState(key)); }, .12); Add(name + " up", () => InputSystem.QueueStateEvent(keyboard, new KeyboardState()), .2); }
        static void MouseState(Vector2 position, int button = 0, bool pressed = false) { var s = new UnityEngine.InputSystem.LowLevel.MouseState { position = position }; if (pressed) s = s.WithButton((MouseButton)button); InputSystem.QueueStateEvent(mouse, s); }
        static void Touch(int id, UnityEngine.InputSystem.TouchPhase phase, Vector2 p) { InputSystem.QueueStateEvent(touches, new TouchState { touchId = id, position = p, phase = phase, pressure = phase == UnityEngine.InputSystem.TouchPhase.Ended ? 0 : 1 }); }
        static Button FindButton(Func<string, bool> test) { var b = Object.FindObjectsByType<Button>(FindObjectsInactive.Exclude, FindObjectsSortMode.None).FirstOrDefault(x => x.IsActive() && x.IsInteractable() && test(string.Join("", x.GetComponentsInChildren<Text>().Select(t => t.text)).Trim())); if (b == null) throw new Exception("Visible button not found. Available: " + string.Join(" | ", Object.FindObjectsByType<Button>(FindObjectsInactive.Exclude, FindObjectsSortMode.None).Select(x => string.Join("", x.GetComponentsInChildren<Text>().Select(t => t.text))))); return b; }
        static Button FindOffer() { return FindButton(t => app.Current.offers.Any(id => t.Contains(Catalog.GetDef(id).name))); }
        static Button FindNamedButton(string name) { var b = Object.FindObjectsByType<Button>(FindObjectsInactive.Exclude, FindObjectsSortMode.None).FirstOrDefault(x => x.name == name && x.IsActive() && x.IsInteractable()); if (b == null) throw new Exception("Visible button not found: " + name); return b; }
        static void CheckPanel(string name, float x, float y, float width)
        {
            var rect = app.UI.GetComponentsInChildren<RectTransform>().First(r => r.name == name); var c = new Vector3[4]; rect.GetWorldCorners(c);
            Check(Mathf.Abs(c[0].x - x) < 3 && Mathf.Abs(Screen.height - c[2].y - y) < 3 && Mathf.Abs(c[2].x - c[0].x - width) < 3, (viewport == 1 ? "phone " : "desktop ") + name + " matches live CSS pixel anchor and width");
        }
        static void CheckChrome()
        {
            var toolbar = app.UI.GetComponentsInChildren<RectTransform>().First(r => r.name == "Toolbar"); var c = new Vector3[4]; toolbar.GetWorldCorners(c);
            Check(Mathf.Abs(Screen.height - c[2].y - 10) < 3 && Mathf.Abs(Screen.width - c[2].x - (viewport == 1 ? 8 : 12)) < 3, "toolbar matches live top/right pixel insets");
            var stage = app.UI.GetComponentsInChildren<RectTransform>().First(r => r.name == "Stage and Weather"); stage.GetWorldCorners(c);
            Check(Mathf.Abs(Screen.height - c[2].y - 57) < 3, "stage/weather matches live 57px top anchor");
            var dock = app.UI.GetComponentsInChildren<RectTransform>().First(r => r.name == "Placement Cards"); dock.GetWorldCorners(c);
            Check(Mathf.Abs(c[0].y - 10) < 3, "offers and magic dock matches live 10px bottom inset");
            Check(app.UI.GetComponentsInChildren<Button>().Count(b => b.name.StartsWith("Magic ")) == 5, "five distinct magic buttons remain reachable in the dock");
        }
        static void CheckRenderedGraphics()
        {
            var graphics = app.UI.GetComponentsInChildren<HabitatWebGraphic>().Where(g => g.enabled && g.gameObject.activeInHierarchy && g.Kind != "gloss").ToArray();
            var visible = RenderFrame(Screen.width, Screen.height); Texture2D hidden = null;
            try
            {
                foreach (var graphic in graphics) graphic.enabled = false; Canvas.ForceUpdateCanvases();
                hidden = RenderFrame(Screen.width, Screen.height); var a = visible.GetPixels32(); var b = hidden.GetPixels32();
                foreach (string kind in viewport == 1 ? new[] { "terrain", "bag", "menu", "magic-purify" } : new[] { "crystal", "terrain", "bag", "menu", "magic-purify" })
                {
                    var graphic = graphics.First(g => g.Kind == kind); var corners = new Vector3[4]; graphic.rectTransform.GetWorldCorners(corners);
                    int count = 0; for (int y = Mathf.Clamp(Mathf.CeilToInt(corners[0].y), 0, Screen.height - 1); y < Mathf.Min(Screen.height, corners[2].y); y++)
                        for (int x = Mathf.Clamp(Mathf.CeilToInt(corners[0].x), 0, Screen.width - 1); x < Mathf.Min(Screen.width, corners[2].x); x++)
                        { int i = y * Screen.width + x; if (Math.Abs(a[i].r - b[i].r) + Math.Abs(a[i].g - b[i].g) + Math.Abs(a[i].b - b[i].b) > 20) count++; }
                    Check(count > (kind == "terrain" ? 100 : 12), (viewport == 1 ? "phone " : "desktop ") + kind + " contributes visible pixels (actual URP/UGUI on-off rendering)");
                }
            }
            finally { foreach (var graphic in graphics) graphic.enabled = true; Canvas.ForceUpdateCanvases(); Object.DestroyImmediate(visible); if (hidden != null) Object.DestroyImmediate(hidden); }
        }
        static bool HasText(string value) => Object.FindObjectsByType<Text>(FindObjectsInactive.Exclude, FindObjectsSortMode.None).Any(t => t.text.Contains(value));
        static Vector2 Center(RectTransform rect) { var corners = new Vector3[4]; rect.GetWorldCorners(corners); return (corners[0] + corners[2]) / 2; }
        static float Float(string name) => (float)typeof(HabitatBoard).GetField(name, BindingFlags.NonPublic | BindingFlags.Instance).GetValue(app.Board);
        static bool IsPhoto() => (bool)typeof(HabitatApp).GetField("photoMode", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(app);
        static Vector3 Vector(string name) => (Vector3)typeof(HabitatBoard).GetField(name, BindingFlags.NonPublic | BindingFlags.Instance).GetValue(app.Board);
        static void Tick()
        {
            if (!EditorApplication.isPlaying || EditorApplication.isPaused || EditorApplication.timeSinceStartup < next) return;
            try { if (EditorApplication.timeSinceStartup - started > 300) throw new TimeoutException("Native interface acceptance exceeded five minutes at " + step); if (step >= steps.Count) return; Step s = steps[step++]; s.run(); next = EditorApplication.timeSinceStartup + s.delay; }
            catch (Exception error)
            {
                report.errors.Add("Step " + (step > 0 ? steps[step - 1].name : "startup") + ": " + error);
                try { if (app != null && Camera.main != null && EditorApplication.isPlaying) Capture("failure"); }
                catch (Exception captureError) { report.errors.Add("Failure capture: " + captureError); }
                Save(); Stop();
            }
        }
        static void Check(bool ok, string text) { if (!ok) throw new Exception("FAILED: " + text); report.checks.Add(text); Save(); }
        static void Save() { Directory.CreateDirectory(DirectoryPath); File.WriteAllText(ReportPath, JsonUtility.ToJson(report, true)); }
        static void OnLog(string message, string trace, LogType type)
        {
            if (!Active || type != LogType.Error && type != LogType.Exception && type != LogType.Assert && message.IndexOf("Serialization depth", StringComparison.OrdinalIgnoreCase) < 0) return;
            if (report == null) report = File.Exists(ReportPath) ? JsonUtility.FromJson<Report>(File.ReadAllText(ReportPath)) : new Report();
            report.errors.Add(message + "\n" + trace); Save();
        }
        static void Stop() { Save(); EditorApplication.update -= Tick; SessionState.SetBool(SessionPrefix + "finishing", true); EditorApplication.isPlaying = false; }
        static void Finish()
        {
            if (!Active) return;
            if (report == null) report = JsonUtility.FromJson<Report>(File.ReadAllText(ReportPath));
            try
            {
                var backup = JsonUtility.FromJson<Backup>(File.ReadAllText(BackupPath));
                foreach (var file in backup.files) { if (file.exists) { Directory.CreateDirectory(Path.GetDirectoryName(file.path)); File.WriteAllBytes(file.path, Convert.FromBase64String(file.bytes)); } else if (File.Exists(file.path)) File.Delete(file.path); }
                foreach (var pref in backup.prefs) { if (!pref.exists) PlayerPrefs.DeleteKey(pref.key); else if (pref.text) PlayerPrefs.SetString(pref.key, pref.value); else PlayerPrefs.SetInt(pref.key, int.Parse(pref.value)); }
                PlayerPrefs.Save(); EditorSettings.enterPlayModeOptionsEnabled = backup.oldPlayEnabled; EditorSettings.enterPlayModeOptions = (EnterPlayModeOptions)backup.oldPlayOptions;
            }
            catch (Exception e) { report.errors.Add("Storage restore: " + e); }
            report.passed = report.errors.Count == 0; Save(); SessionState.SetBool(SessionPrefix + "active", false);
            EditorApplication.update -= Tick; EditorApplication.playModeStateChanged -= PlayState; Application.logMessageReceived -= OnLog;
            EditorApplication.Exit(report.passed ? 0 : 1);
        }

        static void SetSize(int width, int height)
        {
            var assembly = typeof(UnityEditor.Editor).Assembly; var sizesType = assembly.GetType("UnityEditor.GameViewSizes");
            var sizes = typeof(ScriptableSingleton<>).MakeGenericType(sizesType).GetProperty("instance", BindingFlags.Public | BindingFlags.Static).GetValue(null);
            var group = sizesType.GetMethod("GetGroup").Invoke(sizes, new[] { Enum.Parse(assembly.GetType("UnityEditor.GameViewSizeGroupType"), "Standalone") });
            int count = (int)group.GetType().GetMethod("GetTotalCount").Invoke(group, null), index = -1;
            for (int i = 0; i < count; i++) { var size = group.GetType().GetMethod("GetGameViewSize").Invoke(group, new object[] { i }); if ((int)size.GetType().GetProperty("width").GetValue(size) == width && (int)size.GetType().GetProperty("height").GetValue(size) == height) { index = i; break; } }
            if (index < 0) { var size = Activator.CreateInstance(assembly.GetType("UnityEditor.GameViewSize"), BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance, null, new object[] { Enum.Parse(assembly.GetType("UnityEditor.GameViewSizeType"), "FixedResolution"), width, height, "Habitat interface " + width + "x" + height }, null); group.GetType().GetMethod("AddCustomSize").Invoke(group, new[] { size }); index = count; }
            var viewType = assembly.GetType("UnityEditor.GameView"); gameView = EditorWindow.GetWindow(viewType, false, "Game", false); viewType.GetProperty("selectedSizeIndex", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance).SetValue(gameView, index); gameView.Focus(); gameView.Repaint();
        }
        static void Capture(string scenario)
        {
            Canvas.ForceUpdateCanvases(); var frame = new Frame { scenario = scenario, viewport = viewport == 1 ? "phone" : "desktop", width = Screen.width, height = Screen.height };
            frame.image = frame.viewport + "-" + scenario + ".png";
            foreach (var rect in app.UI.GetComponentsInChildren<RectTransform>().Where(r => r.gameObject.activeInHierarchy && (r.GetComponent<Button>() != null || r.GetComponent<Image>() != null && r.childCount > 0)).Take(100))
            { var c = new Vector3[4]; rect.GetWorldCorners(c); frame.bounds.Add(new Bounds { name = rect.name, text = string.Join("", rect.GetComponents<Text>().Select(t => t.text)), x = c[0].x, y = Screen.height - c[2].y, width = c[2].x - c[0].x, height = c[2].y - c[0].y }); }
            var texture = RenderFrame(Screen.width, Screen.height); File.WriteAllBytes(Path.Combine(DirectoryPath, frame.image), texture.EncodeToPNG()); Object.DestroyImmediate(texture); report.frames.Add(frame); Save();
        }
        // Render the actual world and UGUI through the existing URP renderer. Keep the
        // camera pose/projection unchanged; captures must not reframe the evidence.
        static Texture2D RenderFrame(int width, int height)
        {
            var camera = Camera.main; var target = camera.targetTexture; var active = RenderTexture.active; int mask = camera.cullingMask;
            var world = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32); var overlay = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
            var canvases = Object.FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None).Where(c => c.isRootCanvas).ToArray();
            var modes = canvases.Select(c => c.renderMode).ToArray(); var cameras = canvases.Select(c => c.worldCamera).ToArray(); var distances = canvases.Select(c => c.planeDistance).ToArray();
            var objects = canvases.SelectMany(c => c.GetComponentsInChildren<Transform>(true)).Distinct().Select(t => t.gameObject).ToArray(); var layers = objects.Select(o => o.layer).ToArray();
            var uiObject = new GameObject("Interface evidence camera"); var uiCamera = uiObject.AddComponent<Camera>(); uiCamera.cullingMask = 1 << 5; uiCamera.clearFlags = CameraClearFlags.SolidColor; uiCamera.backgroundColor = Color.clear; uiCamera.allowHDR = false; uiCamera.nearClipPlane = .01f; uiCamera.farClipPlane = 5;
            var data = uiObject.AddComponent<UniversalAdditionalCameraData>(); data.renderPostProcessing = false; data.antialiasing = AntialiasingMode.None; data.volumeLayerMask = 0;
            Texture2D pixels = null, uiPixels = null;
            try
            {
                camera.targetTexture = world; camera.cullingMask &= ~(1 << 5); uiCamera.targetTexture = overlay; foreach (var item in objects) item.layer = 5;
                foreach (var canvas in canvases) { canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = uiCamera; canvas.planeDistance = 1; }
                Canvas.ForceUpdateCanvases(); VolumeManager.instance.Update(camera.transform, camera.GetUniversalAdditionalCameraData().volumeLayerMask);
                RenderPipeline.SubmitRenderRequest(camera, new UniversalRenderPipeline.SingleCameraRequest { destination = world }); RenderPipeline.SubmitRenderRequest(uiCamera, new UniversalRenderPipeline.SingleCameraRequest { destination = overlay });
                pixels = Read(world, width, height); uiPixels = Read(overlay, width, height); var bg = pixels.GetPixels32(); var fg = uiPixels.GetPixels32();
                for (int i = 0; i < bg.Length; i++) { float a = 1 - fg[i].a / 255f; bg[i] = new Color32(Blend(fg[i].r, bg[i].r, a), Blend(fg[i].g, bg[i].g, a), Blend(fg[i].b, bg[i].b, a), 255); }
                pixels.SetPixels32(bg); pixels.Apply(); return pixels;
            }
            finally
            {
                if (uiPixels != null) Object.DestroyImmediate(uiPixels); camera.targetTexture = target; camera.cullingMask = mask; RenderTexture.active = active;
                for (int i = 0; i < canvases.Length; i++) { canvases[i].renderMode = modes[i]; canvases[i].worldCamera = cameras[i]; canvases[i].planeDistance = distances[i]; } for (int i = 0; i < objects.Length; i++) objects[i].layer = layers[i];
                Object.DestroyImmediate(uiObject); world.Release(); overlay.Release(); Object.DestroyImmediate(world); Object.DestroyImmediate(overlay); Canvas.ForceUpdateCanvases();
            }
        }
        static readonly float[] Linear = Enumerable.Range(0, 256).Select(i => Mathf.GammaToLinearSpace(i / 255f)).ToArray();
        static readonly byte[] Gamma = Enumerable.Range(0, 4097).Select(i => (byte)Mathf.Clamp(Mathf.RoundToInt(Mathf.LinearToGammaSpace(i / 4096f) * 255), 0, 255)).ToArray();
        static byte Blend(byte foreground, byte background, float a) => Gamma[Mathf.Clamp(Mathf.RoundToInt((Linear[foreground] + Linear[background] * a) * 4096), 0, 4096)];
        static Texture2D Read(RenderTexture target, int width, int height) { RenderTexture.active = target; var t = new Texture2D(width, height, TextureFormat.RGBA32, false); t.ReadPixels(new Rect(0, 0, width, height), 0, 0); t.Apply(); return t; }
    }
}


