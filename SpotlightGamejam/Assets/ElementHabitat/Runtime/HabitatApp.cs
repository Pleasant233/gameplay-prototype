using System;
using System.Collections.Generic;
using System.Collections;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;

namespace ElementHabitat
{
    /// <summary>Native scene entry point. Rules remain independent of Unity and presentation.</summary>
    public sealed class HabitatApp : MonoBehaviour
    {
        public State Current { get; private set; }
        public HabitatBoard Board { get; private set; }
        public HabitatUI UI { get; private set; }
        public string SelectedCell { get; private set; }
        public string Message { get; private set; } = "选择一张地块，再点击相邻空位；中央守护塔将庇护土地。";
        public int SelectedOffer { get; private set; } = -1;
        // Transient input intent, not scene data. Hot reload also serializes private fields;
        // exclude this root so Unity never unfolds GameAction.upgrades recursively.
        [NonSerialized] GameAction pending;
        bool atmosphere, reducedMotion, sound;
        HabitatAudio audioFeedback;
        HabitatMusic musicFeedback;
        Coroutine completionFeedback;
        string storageWarning;
        bool photoMode;
        public static string SavePath => Path.Combine(Application.persistentDataPath, "element-habitat-unity-v1.json");

        void Awake()
        {
            Application.targetFrameRate = Application.isMobilePlatform ? 30 : 60;
            QualitySettings.vSyncCount = 0;
            atmosphere = PlayerPrefs.GetInt("habitat.atmosphere", 1) != 0;
            reducedMotion = PlayerPrefs.GetInt("habitat.reducedMotion", 0) != 0;
            sound = PlayerPrefs.GetInt("habitat.sound", 1) != 0;
            if (EventSystem.current == null)
                new GameObject("Habitat Input", typeof(EventSystem), typeof(InputSystemUIInputModule)).transform.SetParent(transform, false);
            Board = new GameObject("Habitat Board").AddComponent<HabitatBoard>();
            Board.transform.SetParent(transform, false);
            Board.Initialize(SelectCell);
            Board.SetAtmosphere(atmosphere);
            Board.SetReducedMotion(reducedMotion);
            UI = new GameObject("Habitat Interface").AddComponent<HabitatUI>();
            UI.transform.SetParent(transform, false);
            UI.Initialize(Dispatch, NewGame, ContinueGame, SelectCell);
            UI.RangePreviewChanged = (keys, element) => Board.SetRangePreview(keys, element);
            Board.OnMiss = () => { if (pending == null && SelectedOffer < 0) ClearSelection(); };
            Board.OnHover = (cell, position) =>
            {
                UI.ShowHover(cell, position);
                if (pending != null && pending.type == "cast")
                {
                    if (!string.IsNullOrEmpty(cell) && Current.cells.ContainsKey(cell))
                        Board.SetRangePreview(Game.MagicArea(Current, cell, pending.magic), Catalog.Magics.First(m => m.id == pending.magic).element);
                    else Board.ClearRangePreview();
                }
                else if (pending != null && pending.type == "deployShield")
                {
                    var shield = Current.inv.shields.FirstOrDefault(s => s.id == pending.shieldId);
                    if (shield != null && !string.IsNullOrEmpty(cell) && Current.cells.ContainsKey(cell))
                        Board.SetRangePreview(Game.Region(Current, cell, shield.coverage), "water");
                    else Board.ClearRangePreview();
                }
            };
            UI.SetSessionActive(false);
            audioFeedback = gameObject.AddComponent<HabitatAudio>();
            audioFeedback.Enabled = sound;
            UI.TokenArrived = audioFeedback.Ding;
            musicFeedback = gameObject.AddComponent<HabitatMusic>();
            musicFeedback.Enabled = PlayerPrefs.GetInt("habitat.music", 1) != 0;
            // A fresh preview world decorates the menu; a saved game is loaded only by Continue.
            Current = Game.NewGame(20261017, true);
            Refresh();
            UI.ShowMainMenu(File.Exists(SavePath));
        }

        public void NewGame(bool tutorial)
        { StartGame(tutorial, "challenge"); }

        void StartGame(bool tutorial, string mode)
        {
            ResetFeedback();
            photoMode = false; UI.SetPhotoMode(false); Board.SetPhotoMode(false);
            hasStarted = true; UI.SetSessionActive(true);
            Current = Game.NewGame(unchecked((uint)DateTime.UtcNow.Ticks), tutorial, mode);
            musicFeedback.ResetTheme(Game.Score(Current).total);
            musicFeedback.StartMusic();
            SelectedCell = null;
            SelectedOffer = -1;
            pending = null;
            Message = tutorial ? "初醒之旅：跟随左侧提示，重新连接五行。" : "铺地、施法、刷新、铲除及守护灵移动各消耗 1 行动；可自由安排。";
            Save();
            Refresh();
        }

        public void ContinueGame()
        {
            ResetFeedback();
            musicFeedback.StartMusic();
            // Closing a menu during play resumes the same in-memory game.
            if (hasStarted) { UI.SetSessionActive(true); Refresh(); if (Current.over) UI.ShowCompletion(); return; }
            if (File.Exists(SavePath))
            {
                try
                {
                    var restored = Game.Restore(File.ReadAllText(SavePath));
                    if (restored == null) throw new InvalidDataException("存档内容或版本无效");
                    Current = restored;
                    hasStarted = true;
                    UI.SetSessionActive(true);
                    Message = "已恢复上次的生境。";
                }
                catch (Exception e)
                {
                    storageWarning = "未能读取存档：" + e.Message + "。原存档已保留，可从菜单开启新旅程。";
                    Message = storageWarning;
                    UI.SetSessionActive(false);
                    Refresh();
                    UI.ShowMainMenu(true);
                    return;
                }
            }
            else { Message = "没有可恢复的存档，请开启新的旅程。"; Refresh(); UI.ShowMainMenu(false); return; }
            Refresh();
        }

        bool hasStarted;
        public void SelectCell(string cell)
        {
            if (Current == null || string.IsNullOrEmpty(cell) || UI.IsMenuOpen || UI.HasBlockingModal) return;
            if (photoMode)
            {
                SelectedCell = cell;
                if (cell == "3,3") UI.ShowTower();
                else if (Current.cells.ContainsKey(cell)) UI.RevealSelection();
                Board.SetFocus(cell); Refresh(); return;
            }
            if (SelectedOffer >= 0)
            {
                if (Current.cells.ContainsKey(cell) || cell == Game.TOWER_CELL) return;
                Execute(new GameAction { type = "place", cell = cell, offer = SelectedOffer });
                return;
            }
            if (pending != null)
            {
                if (!Current.cells.ContainsKey(cell)) return;
                var action = pending;
                if (IsMovement(action.type)) action.to = cell;
                else action.cell = cell;
                Execute(action);
                return;
            }
            if (SelectedCell == cell || cell != Game.TOWER_CELL && !Current.cells.ContainsKey(cell)) { ClearSelection(); return; }
            SelectedCell = cell;
            if (cell == "3,3") { Board.SetFocus(cell); UI.ShowTower(); Refresh(); return; }
            if (Current.cells.ContainsKey(cell))
            {
                UI.RevealSelection();
                Board.SetFocus(cell);
                if (Current.journey != null && !Current.journey.skipped && Current.journey.step == 1 && cell == "3,2")
                    Execute(new GameAction { type = "tutorial", cell = cell });
                else Refresh();
            }
            else { Message = "选择一张候选地块，再点击高亮的相邻空位。"; Refresh(); }
        }

        static bool IsMovement(string type) => type == "moveSpirit" || type == "moveBeast" || type == "moveGuardian";
        static bool NeedsCell(string type) => type == "cast" || type == "useCrystal" || type == "useCrystals" || type == "deployShield";

        void ClearSelection()
        {
            SelectedCell = null;
            Board.SetFocus(null);
            Refresh();
        }

        public void Dispatch(GameAction action)
        {
            if (action == null || Current == null) return;
            switch (action.type)
            {
                case "selectOffer":
                    if (Current.over || Current.ap < 1 || action.offer < 0 || action.offer >= Current.offers.Count) return;
                    pending = null; SelectedOffer = SelectedOffer == action.offer ? -1 : action.offer;
                    audioFeedback.Pick(); musicFeedback.StartMusic();
                    Message = SelectedOffer < 0 ? "" : "正在放置「" + Catalog.Types[Current.offers[action.offer]].name + "」：点击高亮空格，消耗 1 行动。";
                    Refresh(); return;
                case "clearSelection": ClearSelection(); return;
                case "cameraReset": Board.ResetCamera(); return;
                case "cancel":
                    pending = null; SelectedOffer = -1; UI.CloseModal(); Message = "已取消操作。"; Refresh(); return;
                case "save":
                    if (!hasStarted) { Message = "请先开启或成功恢复一局游戏。"; Refresh(); return; }
                    Save(); Message = storageWarning ?? "已保存到本机。"; Refresh(); return;
                case "mainMenu":
                    ResetFeedback(); pending = null; SelectedOffer = -1; Refresh(); UI.ShowMainMenu(File.Exists(SavePath)); return;
                case "newEndless":
                    UI.HideMainMenu(); UI.CloseModal(); StartGame(false, "endless"); return;
                case "enterEndless":
                    var endless = Game.EnterEndless(Current); Message = endless.msg;
                    if (endless.ok) { UI.CloseModal(); UI.HideMainMenu(); Save(); }
                    Refresh(); return;
                case "photoMode":
                case "inspect":
                    if (!Current.completedMap) { Message = "完成初始地图后可进入摄影模式。"; Refresh(); return; }
                    pending = null; SelectedOffer = -1; SelectedCell = null; photoMode = true;
                    ResetFeedback();
                    Message = "摄影模式：拖动镜头欣赏生境，点选土地可只读检视。";
                    UI.HideMainMenu(); UI.CloseModal(); UI.SetPhotoMode(true); Board.SetPhotoMode(true); Refresh(); Board.FrameMap(); return;
                case "exitPhoto":
                    photoMode = false; UI.SetPhotoMode(false); Board.SetPhotoMode(false); Refresh(); return;
                case "savePhoto":
                    StartCoroutine(SavePhoto()); return;
                case "exportSave":
                    try
                    {
                        string exportPath = Path.Combine(Application.persistentDataPath, "生境地图-第" + Current.round + "轮-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".json");
                        File.WriteAllText(exportPath, Game.Serialize(Current), new System.Text.UTF8Encoding(false));
                        Message = "地图已导出：" + exportPath;
                    }
                    catch (Exception e) { Message = "地图导出失败：" + e.Message; }
                    Refresh(); return;
                case "settingsAtmosphere":
                    atmosphere = action.skip; PlayerPrefs.SetInt("habitat.atmosphere", atmosphere ? 1 : 0); Board.SetAtmosphere(atmosphere); PlayerPrefs.Save(); return;
                case "settingsReducedMotion":
                    reducedMotion = action.skip; PlayerPrefs.SetInt("habitat.reducedMotion", reducedMotion ? 1 : 0); Board.SetReducedMotion(reducedMotion); UI.SetReducedMotion(reducedMotion); if (reducedMotion) ResetFeedback(); PlayerPrefs.Save(); return;
                case "settingsSound":
                    sound = action.skip; PlayerPrefs.SetInt("habitat.sound", sound ? 1 : 0); audioFeedback.Enabled = sound; PlayerPrefs.Save(); return;
                case "settingsMusic":
                    musicFeedback.Enabled = action.skip; UI.SetMusicEnabled(action.skip); PlayerPrefs.SetInt("habitat.music", action.skip ? 1 : 0); if (action.skip) musicFeedback.StartMusic(); PlayerPrefs.Save(); return;
            }
            if (photoMode) { Message = "摄影检视中，返回经营后可继续操作。"; Refresh(); return; }
            if (IsMovement(action.type) && string.IsNullOrEmpty(action.to))
            {
                if (string.IsNullOrEmpty(action.from)) action.from = SelectedCell;
                pending = action; SelectedOffer = -1;
                if (action.type == "moveGuardian") SelectedCell = null;
                Message = action.type == "moveGuardian" ? "点击四邻已放置地块移动守护灵；每步消耗 1 行动。" : "点击相邻已放置地块完成移动。";
                Refresh(); return;
            }
            if (NeedsCell(action.type) && string.IsNullOrEmpty(action.cell))
            {
                bool same = pending != null && pending.type == action.type && pending.magic == action.magic
                    && pending.el == action.el && pending.big == action.big && pending.inverse == action.inverse
                    && pending.shieldId == action.shieldId;
                pending = same ? null : action; SelectedOffer = -1;
                Message = same ? "" : "点击一个已放置地块作为目标。";
                if (!same) audioFeedback.Pick();
                Refresh(); return;
            }
            Execute(action);
        }

        void Execute(GameAction action)
        {
            var wasOver = Current.over;
            // Presentation reads a snapshot; rules, saving and costs settle synchronously.
            var before = NativeJson.Deserialize<State>(NativeJson.Serialize(Current));
            var result = action.type == "endRound" ? Game.EndRound(Current) : Game.Apply(Current, action);
            Message = result.msg;
            if (result.ok)
            {
                hasStarted = true;
                pending = null; SelectedOffer = -1;
                if (action.type == "demolish" || action.type == "upgradeBatch") SelectedCell = null;
                if (IsMovement(action.type) && !string.IsNullOrEmpty(action.to)) SelectedCell = action.to;
                Save();
            }
            Refresh();
            if (result.ok)
            {
                var receipts = Current.events.ToList();
                // New meshes must exist before their landing and receipt timelines begin.
                Board.PlayAction(action, before, Current, receipts);
                UI.PresentAction(before, Current, action, receipts, Board.WorldToScreenPoint);
                int connected = action.type == "place" && Current.cells.ContainsKey(action.cell) ? Game.Cluster(Current, action.cell).Count : 0;
                audioFeedback.PlayAction(action, receipts, Board.FeedbackDelay, connected);
                musicFeedback.StartMusic();
            }
            else audioFeedback.Error();
            if (!wasOver && Current.over)
            {
                if (Current.events.Any(e => e.kind == "pureCrystal")) completionFeedback = StartCoroutine(ShowCompletionAfterReveal(Current));
                else UI.ShowCompletion();
            }
        }

        IEnumerator ShowCompletionAfterReveal(State completed)
        {
            // Production keeps the final pure-crystal reveal visible before opening the result.
            yield return new WaitForSecondsRealtime(5f);
            completionFeedback = null;
            if (ReferenceEquals(Current, completed) && Current.over && !UI.IsMenuOpen && !photoMode) UI.ShowCompletion();
        }

        void ResetFeedback()
        {
            if (completionFeedback != null) { StopCoroutine(completionFeedback); completionFeedback = null; }
            if (UI != null) UI.ResetFeedback();
            if (Board != null) Board.ClearFeedback();
            if (audioFeedback != null) audioFeedback.ClearFeedback();
        }

        public void Save()
        {
            if (Current == null || !hasStarted) return;
            try
            {
                WriteSaveAtomic(SavePath, Game.Serialize(Current));
                var unlocked = new HashSet<string>((PlayerPrefs.GetString("habitat.achievements", "")).Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries));
                foreach (var id in Current.achievements) unlocked.Add(id);
                PlayerPrefs.SetString("habitat.achievements", string.Join(",", unlocked.OrderBy(x => x)));
                PlayerPrefs.Save();
                storageWarning = null;
            }
            catch (Exception e) { storageWarning = "存档失败：" + e.Message; Message = storageWarning; }
        }

        public static void WriteSaveAtomic(string path, string json)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            var temporary = path + ".tmp";
            File.WriteAllText(temporary, json, new System.Text.UTF8Encoding(false));
            if (File.Exists(path)) File.Replace(temporary, path, path + ".bak");
            else File.Move(temporary, path);
        }

        public void Refresh()
        {
            ICollection<string> targets = SelectedOffer >= 0 ? Game.LegalPlacements(Current) : new List<string>();
            if (pending != null && IsMovement(pending.type) && !string.IsNullOrEmpty(pending.from))
                targets = Game.Neighbors(pending.from).Where(Current.cells.ContainsKey).ToList();
            else if (pending != null && NeedsCell(pending.type))
                targets = Current.cells.Keys.Where(k => pending.type != "cast" || pending.magic != "purify" || Game.CanPurify(Current, k)).ToList();
            Board.Render(Current, photoMode ? null : SelectedCell, photoMode ? new List<string>() : targets);
            Board.SetPlacementPreview(!photoMode && SelectedOffer >= 0 && SelectedOffer < Current.offers.Count ? Current.offers[SelectedOffer] : null);
            if (pending != null && pending.type == "cast" && !string.IsNullOrEmpty(SelectedCell) && Current.cells.ContainsKey(SelectedCell))
                Board.SetRangePreview(Game.MagicArea(Current, SelectedCell, pending.magic), Catalog.Magics.First(m => m.id == pending.magic).element);
            else Board.ClearRangePreview();
            UI.SetSelectedOffer(SelectedOffer);
            UI.SetPendingAction(pending);
            UI.Render(Current, SelectedCell, storageWarning ?? Message, File.Exists(SavePath));
            if (musicFeedback != null) musicFeedback.SetScore(Game.Score(Current).total);
        }

        void Update()
        {
            if (Board == null || UI == null) return;
            Board.InputEnabled = !UI.IsMenuOpen && !UI.HasBlockingModal;
            Board.KeyboardInputEnabled = Board.InputEnabled && !UI.WantsKeyboardInput;
            var keyboard = Keyboard.current;
            if (keyboard == null) return;
            if (keyboard.escapeKey.wasPressedThisFrame)
            {
                if (photoMode) Dispatch(new GameAction { type = "exitPhoto" });
                else if (!UI.TryHandleEscape())
                {
                    if (pending != null || SelectedOffer >= 0) Dispatch(new GameAction { type = "cancel" });
                    else ClearSelection();
                }
                return;
            }
            if (UI.IsMenuOpen || UI.HasBlockingModal || UI.WantsKeyboardInput || !hasStarted) return;
            if ((keyboard.leftCtrlKey.isPressed || keyboard.rightCtrlKey.isPressed) && keyboard.sKey.wasPressedThisFrame && Current.completedMap)
            { Dispatch(new GameAction { type = "exportSave" }); return; }
            if (photoMode) return;
            if (keyboard.digit1Key.wasPressedThisFrame) Dispatch(new GameAction { type = "selectOffer", offer = 0 });
            if (keyboard.digit2Key.wasPressedThisFrame) Dispatch(new GameAction { type = "selectOffer", offer = 1 });
            if (keyboard.digit3Key.wasPressedThisFrame) Dispatch(new GameAction { type = "selectOffer", offer = 2 });
            if (keyboard.bKey.wasPressedThisFrame) UI.ToggleInventory();
            // EventSystem submits the focused button itself. Let it own Enter there;
            // dispatching the map shortcut too would end two rounds after a mouse click.
            var focused = EventSystem.current == null ? null : EventSystem.current.currentSelectedGameObject;
            bool buttonHasFocus = focused != null && focused.activeInHierarchy && focused.GetComponentInParent<UnityEngine.UI.Button>() != null;
            if (!buttonHasFocus && (keyboard.enterKey.wasPressedThisFrame || keyboard.numpadEnterKey.wasPressedThisFrame))
                Dispatch(new GameAction { type = "endRound" });
            if (keyboard.pKey.wasPressedThisFrame && Current.completedMap) Dispatch(new GameAction { type = "photoMode" });
        }

        IEnumerator SavePhoto()
        {
            UI.gameObject.SetActive(false);
            yield return new WaitForEndOfFrame();
            Texture2D picture = null;
            try
            {
                picture = ScreenCapture.CaptureScreenshotAsTexture();
                string path = Path.Combine(Application.persistentDataPath, "生境照片-第" + Current.round + "轮-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".png");
                File.WriteAllBytes(path, picture.EncodeToPNG());
                Message = "照片已保存：" + path;
            }
            catch (Exception e) { Message = "照片保存失败：" + e.Message; }
            finally
            {
                if (picture != null) Destroy(picture);
                UI.gameObject.SetActive(true);
            }
            Refresh();
        }
        void OnApplicationPause(bool paused) { if (paused && hasStarted) Save(); }
        void OnApplicationQuit() { if (hasStarted) Save(); }
    }
}
