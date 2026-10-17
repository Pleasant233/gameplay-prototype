using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace ElementHabitat
{
    /// <summary>Native, responsive UGUI presentation. Only the controller mutates game state.</summary>
    public sealed class HabitatUI : MonoBehaviour
    {
        public int SelectedOffer { get; private set; } = -1;
        public bool IsMenuOpen { get; private set; }
        public bool AtmosphereEnabled { get; private set; } = true;
        public bool ReducedMotion { get; private set; }
        public bool SoundEnabled { get; private set; } = true;
        public bool MusicEnabled { get; private set; } = true;
        public Action<IEnumerable<string>, string> RangePreviewChanged;
        public Action<int> TokenArrived;

        Action<GameAction> dispatch;
        Action<bool> newGame;
        Action continueGame;
        Action<string> selectCell;
        State state;
        string selected;
        string message;
        bool hasSave;
        bool detailOpen = true;
        bool hasPlayed;
        bool photoMode;
        bool photoInspection;
        bool compact;
        Canvas canvas;
        CanvasScaler scaler;
        Font font;
        Sprite roundSprite;
        RectTransform root, hud, toolbar, detail, tutorial, dock, status, menu, modal, photoBar;
        RectTransform detailBody, tutorialBody, cards, menuBody, modalBody;
        Text roundText, scoreText, formulaText, attrsText, weatherText, statusText, dockTitle, menuSubtitle;
        Button endButton;
        Button bagButton;
        HabitatFeedbackHUD feedbackHUD;
        string offersKey;
        readonly List<Button> offerButtons = new List<Button>();
        readonly Dictionary<string, int> shieldMix = new Dictionary<string, int>();
        readonly Dictionary<string, int> shieldBigMix = new Dictionary<string, int>();
        readonly Dictionary<string, int> crystalMix = new Dictionary<string, int>();
        readonly Dictionary<string, string> batchUpgrades = new Dictionary<string, string>();
        string crystalTarget;
        readonly HashSet<int> guardianChoice = new HashSet<int>();
        string guardianCell;
        string activeModal;
        Vector2 lastSize;
        static readonly Color Cream = Hex("FFF8E7");
        static readonly Color Ink = Hex("35483C");
        static readonly Color Muted = Hex("71806D");
        static readonly Color Green = Hex("548B64");
        static readonly Color Gold = Hex("DDBA64");
        static readonly Color Line = Hex("DFE7D3");
        static readonly string[] ElementKeys = { "metal", "wood", "water", "fire", "earth" };
        static readonly string[] ElementNames = { "金", "木", "水", "火", "土" };
        static readonly string[] ElementColors = { "BB9429", "438956", "3985B7", "C86942", "94713F" };
        static readonly string[] LessonTitles = { "五格初醒", "看懂土地", "让地脉相连", "第一次净化", "等待新的生命", "土地长成新的样子", "结晶可以连续使用", "继续接上地脉", "旅程由你决定" };
        static readonly string[] LessonCopy = {
            "你不记得名字，只记得金、木、水、火、土。去荒芜之地，把环接上。",
            "点选北侧腐化枯林，查看木 −1。负值，是土地的伤口。",
            "选择碎矿地，铺在东侧矿地的外侧。同系列相连，属性上限从 9 提升到 12。",
            "选择西北草原，施放净化。初始覆盖中心与四邻，负属性会逐渐恢复。",
            "结束本轮，观察新的生命。元素灵每 3 轮凝成结晶，同属性 3 灵自动合兽。",
            "选择北侧枯林，直接选择疏林升级。系统自动消耗所缺的水结晶，现有生物会保留。",
            "从背包选择普通水晶，再点西北草原使用，重复 2 次。选结晶不会立即消耗，不耗行动点，也不会换轮。",
            "第 2 轮正常铺地，第 3 轮试着把疏林接到北侧林地，建立你的第一个系列。",
            "经营土地，唤醒元素兽。新能力会随资源与生命逐渐出现。" };
        static readonly string[] MemoryKeys = { "purify", "mine", "spring", "rich", "burn", "beast", "guardian", "meteor", "crystal", "life", "ending" };
        static readonly string[] MemoryTitles = { "第一道回声", "还它一座山", "河床的歌", "未到的春天", "火的边界", "三灵同源", "五兽同誓", "这一次", "凝成结晶", "生灵归巢", "老师归来" };
        static readonly string[] MemoryCopy = {
            "“先让腐化停下来。”你听见一声很轻的“老师”。土地似乎比你更早记得。",
            "“大地会疼吗？”你忽然记起回答：“所以我们要记得还它一座山。”",
            "你想起一首歌。唱歌的人已经不在，河床却仍在应和。",
            "“老师，土会把死亡收好，再长出春天。”",
            "“火不是毁灭。火是炉，是暖，是边界。”",
            "三灵同源，凝为一兽。你仿佛又看见围坐在身旁的孩子。",
            "五兽聚力，同誓一地。“老师，我们守住了吗？”你把它留在土地上，继续完成未竟的春天。",
            "五道模糊的身影撑住碎裂的光。“这一次，我不会再让你们独自面对。”",
            "普通结晶来自元素灵的三轮孕育；每轮使用不限次数，库存仍会消耗。",
            "土地能养活什么，取决于它拥有什么。动物自动元素化，之后每轮滋养对应属性；植物每 3 轮自动滋养。",
            "你终于记起：你是最初的灵脉师，是五贤之师。你曾以名字与记忆，保住元素之环最后一线生机。五贤者没有归来，但他们的老师回来了。" };

        public void Initialize(Action<GameAction> action, Action<bool> start, Action resume, Action<string> onSelect)
        {
            dispatch = action;
            newGame = start;
            continueGame = resume;
            selectCell = onSelect;
            AtmosphereEnabled = PlayerPrefs.GetInt("habitat.atmosphere", 1) != 0;
            ReducedMotion = PlayerPrefs.GetInt("habitat.reducedMotion", 0) != 0;
            SoundEnabled = PlayerPrefs.GetInt("habitat.sound", 1) != 0;
            MusicEnabled = PlayerPrefs.GetInt("habitat.music", 1) != 0;
            font = Resources.Load<Font>("HabitatChinese");
            if (font == null) font = Font.CreateDynamicFontFromOSFont(new[] { "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", "Arial Unicode MS", "Arial" }, 20);
            roundSprite = RoundedSprite();
            Build();
            feedbackHUD = root.gameObject.AddComponent<HabitatFeedbackHUD>();
            feedbackHUD.Initialize(root, font, roundSprite, scoreText.rectTransform,
                bagButton.GetComponent<RectTransform>(), roundText.rectTransform,
                () => ReducedMotion || IsMenuOpen || photoMode, RefreshFeedbackNumbers);
            feedbackHUD.ReceiptArrived = index => TokenArrived?.Invoke(index);
            Layout();
        }

        public void Render(State value, string selectedCell, string feedback, bool saveExists)
        {
            state = value;
            if (feedbackHUD != null) feedbackHUD.SetAuthoritative(value);
            if (selected != selectedCell) detailOpen = true;
            selected = selectedCell;
            message = feedback;
            hasSave = saveExists;
            if (state == null || root == null) return;
            if (SelectedOffer >= state.offers.Count) SelectedOffer = -1;
            var score = Game.Score(state);
            RefreshFeedbackNumbers();
            formulaText.text = "属性×0.5 + 塔" + score.tower + " + 生态" + score.ecology;
            attrsText.text = ColoredAttrs(GlobalAttrs()) + (compact ? "" : "   " + ChallengeHint());
            weatherText.text = ChallengeHint() + " · " + WeatherHint();
            statusText.text = !string.IsNullOrWhiteSpace(message) ? message : (state.over ? state.endReason : SelectedOffer >= 0 ? "点击高亮空格铺地 · 每次 1 行动，可连续铺地" : state.ap == 0 ? "行动用尽 · 仍可使用结晶和升级，准备好后结束本轮" : "自由分配行动：铺地、施法、刷新或铲除 · 每次 1 行动");
            endButton.interactable = !state.over;
            endButton.GetComponentInChildren<Text>().text = state.over ? "挑战已结束" : "结束本轮";
            dockTitle.text = "地块供给 T" + Game.SupplyLevel(state) + " · 铺地 1 行动";
            BuildOffers();
            BuildDetail();
            BuildTutorial();
            ArchiveAchievements();
            if (!string.IsNullOrEmpty(activeModal) && activeModal != "confirm" && activeModal != "help") RefreshModal();
            Layout();
        }

        public void ShowMainMenu(bool saveExists)
        {
            ResetFeedback();
            hasSave = saveExists;
            IsMenuOpen = true;
            SelectedOffer = -1;
            CloseModal();
            menu.gameObject.SetActive(true);
            BuildMenu();
            menu.SetAsLastSibling();
            Layout();
        }

        public void HideMainMenu()
        {
            IsMenuOpen = false;
            if (menu != null) menu.gameObject.SetActive(false);
        }

        public void SetSelectedOffer(int index)
        {
            SelectedOffer = index;
            for (int i = 0; i < offerButtons.Count; i++)
                if (offerButtons[i] != null) offerButtons[i].GetComponent<HabitatButtonMotion>()?.SetSelected(i == index);
        }
        public void SetReducedMotion(bool enabled)
        {
            ReducedMotion = enabled;
            if (enabled) ResetFeedback();
        }
        public void SetMusicEnabled(bool enabled) { MusicEnabled = enabled; }
        public void SetSessionActive(bool active) { hasPlayed = active; }
        public void RefreshLayout() { Layout(); }
        public void SetPhotoMode(bool enabled)
        {
            photoMode = enabled;
            if (enabled) ResetFeedback();
            photoInspection = false;
            if (enabled) { HideMainMenu(); CloseModal(); RangePreviewChanged?.Invoke(Array.Empty<string>(), "water"); }
            Layout();
        }

        public bool IsPointerOverUI(Vector2 position)
        {
            if (EventSystem.current == null) return IsMenuOpen;
            var results = new List<RaycastResult>();
            EventSystem.current.RaycastAll(new PointerEventData(EventSystem.current) { position = position }, results);
            return results.Any(r => r.gameObject.GetComponentInParent<Canvas>() == canvas);
        }

        void Build()
        {
            root = Rect("Element Habitat UI", transform);
            canvas = root.gameObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 30;
            canvas.pixelPerfect = true;
            scaler = root.gameObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1600, 1000);
            scaler.matchWidthOrHeight = 0.5f;
            root.gameObject.AddComponent<GraphicRaycaster>();

            hud = Panel("HUD", root, Cream);
            Label(hud, "元素生境", 27, Ink, "Game Title");
            roundText = Label(hud, "", 19, Ink, "Round and AP");
            scoreText = Label(hud, "", 28, Green, "Score");
            formulaText = Label(hud, "", 14, Muted, "Score Formula");
            attrsText = Label(hud, "", 18, Muted, "Elements");
            weatherText = Label(hud, "", 16, Green, "Weather Forecast");
            toolbar = Rect("Toolbar", root);
            Horizontal(toolbar, 8);
            bagButton = Button(toolbar, "背包 0", OpenInventory, Green, 75);
            Button(toolbar, "图鉴", OpenAtlas, Green, 75);
            Button(toolbar, "成就", OpenAchievements, Green, 75);
            Button(toolbar, "守护塔", ShowTower, Green, 85);
            Button(toolbar, "菜单", () => Emit(new GameAction { type = "mainMenu" }), Green, 75);

            detail = Panel("Selected Terrain", root, Cream);
            detailBody = ScrollBody(detail, "Detail Scroll");
            tutorial = Panel("Journey", root, Cream);
            tutorialBody = VerticalBody(tutorial, 16);
            dock = Panel("Placement Cards", root, Cream);
            dockTitle = Label(dock, "本轮铺地", 18, Ink, "Offer Title");
            cards = Rect("Three Offers", dock);
            Horizontal(cards, 10);
            endButton = Button(dock, "结束本轮", () => { SelectedOffer = -1; Emit(new GameAction { type = "endRound" }); }, Green);
            status = Panel("Status", root, new Color(.99f, .99f, .94f, .96f));
            statusText = Label(status, "", 18, Ink, "Status Text");
            statusText.alignment = TextAnchor.MiddleCenter;

            photoBar = Panel("Photography Controls", root, Cream);
            var photoButtons = Rect("Photo Buttons", photoBar);
            Horizontal(photoButtons, 9);
            Button(photoButtons, "保存照片", () => Emit(new GameAction { type = "savePhoto" }), Green);
            Button(photoButtons, "导出地图", () => Emit(new GameAction { type = "exportSave" }), Gold);
            Button(photoButtons, "返回经营", () => Emit(new GameAction { type = "exitPhoto" }), Line);
            var photoHint = Label(photoBar, "拖动旋转 · 双指/滚轮缩放 · 自由欣赏你的生境", 15, Muted, "Photo Hint");
            photoHint.alignment = TextAnchor.MiddleCenter;
            photoBar.gameObject.SetActive(false);

            menu = Overlay("Main Menu", root);
            var menuPanel = Panel("Menu Card", menu, Cream);
            menuBody = VerticalBody(menuPanel, 30);
            menu.gameObject.SetActive(false);
            modal = Overlay("Dialog", root);
            var modalPanel = Panel("Dialog Card", modal, Cream);
            modalBody = ScrollBody(modalPanel, "Dialog Scroll", 72);
            modal.gameObject.SetActive(false);
        }

        void Layout()
        {
            if (root == null) return;
            bool portrait = canvas.pixelRect.width < canvas.pixelRect.height * 1.25f;
            // Keep Chinese text readable on narrow displays; using a desktop reference
            // width in portrait would shrink ordinary 17-point labels to eight pixels.
            scaler.referenceResolution = portrait ? new Vector2(480, 1000) : new Vector2(1600, 1000);
            scaler.matchWidthOrHeight = portrait ? 0 : .5f;
            canvas.scaleFactor = Mathf.Max(.1f, portrait ? canvas.pixelRect.width / 480f : Mathf.Sqrt(canvas.pixelRect.width / 1600f * canvas.pixelRect.height / 1000f));
            Canvas.ForceUpdateCanvases();
            var size = root.rect.size;
            if (size.x <= 0 || size.y <= 0) size = new Vector2(1600, 1000);
            compact = size.x / size.y < 1.25f;
            if (state != null)
            {
                attrsText.text = ColoredAttrs(GlobalAttrs()) + (compact ? "" : "   " + ChallengeHint());
                weatherText.text = ChallengeHint() + " · " + WeatherHint();
            }
            var w = size.x;
            var h = size.y;
            hud.gameObject.SetActive(!IsMenuOpen && !photoMode);
            toolbar.gameObject.SetActive(!IsMenuOpen && !photoMode);
            dock.gameObject.SetActive(!IsMenuOpen && !photoMode);
            status.gameObject.SetActive(!IsMenuOpen);
            tutorial.gameObject.SetActive(!IsMenuOpen && !photoMode && state != null && state.journey != null && !state.journey.skipped && !state.over);
            photoBar.gameObject.SetActive(photoMode);
            float photoWidth = Mathf.Min(640, w - 24);
            Place(photoBar, (w - photoWidth) * .5f, h - 96, photoWidth, 80);
            Place((RectTransform)photoBar.GetChild(0), 12, 9, photoWidth - 24, 42);
            Place((RectTransform)photoBar.GetChild(1), 12, 54, photoWidth - 24, 20);
            float margin = compact ? 12 : 24;
            Place(hud, margin, margin, w - 2 * margin, compact ? 175 : 100);
            var texts = hud.GetComponentsInChildren<Text>();
            Place(texts[0].rectTransform, 18, 12, compact ? 170 : 180, 36);
            Place(roundText.rectTransform, compact ? 18 : 220, compact ? 70 : 13, compact ? w - 65 : 525, compact ? 26 : 30);
            Place(scoreText.rectTransform, compact ? 180 : 750, 12, compact ? 230 : 345, 36);
            Place(formulaText.rectTransform, compact ? 180 : 750, compact ? 43 : 53, compact ? 230 : 345, 24);
            Place(attrsText.rectTransform, 18, compact ? 108 : 57, compact ? w - 68 : 700, compact ? 24 : 28);
            weatherText.gameObject.SetActive(compact);
            Place(weatherText.rectTransform, 18, 139, w - 68, 26);
            Place(toolbar, compact ? margin : w - 468, compact ? 196 : 38, compact ? w - 2 * margin : 420, 42);
            float dockHeight = compact ? 202 : 176;
            float dockWidth = compact ? w - 2 * margin : Mathf.Min(800, w - 2 * margin - 375);
            Place(dock, compact ? margin : (w - dockWidth) * .5f, h - dockHeight - margin, dockWidth, dockHeight);
            Place(dockTitle.rectTransform, 16, 12, dockWidth - 160, 27);
            Place(cards, 14, 47, dockWidth - 28, compact ? 94 : 93);
            Place(endButton.GetComponent<RectTransform>(), dockWidth - 166, compact ? 150 : 130, 150, 39);
            var cancel = dock.Find("Cancel Operation");
            if (cancel == null)
            {
                var cancelButton = Button(dock, "取消选择", () => { SelectedOffer = -1; Emit(new GameAction { type = "cancel" }); }, Hex("E7EAD9"));
                cancelButton.name = "Cancel Operation";
                cancel = cancelButton.transform;
            }
            Place((RectTransform)cancel, 16, compact ? 150 : 130, 130, 39);
            var refresh = dock.Find("Refresh Offers");
            if (refresh == null)
            {
                var refreshButton = Button(dock, "刷新 · 1 行动", () => { SelectedOffer = -1; Emit(new GameAction { type = "reroll" }); }, Gold);
                refreshButton.name = "Refresh Offers";
                refresh = refreshButton.transform;
            }
            refresh.GetComponent<Button>().interactable = state != null && !state.over && state.ap > 0;
            Place((RectTransform)refresh, dockWidth * .5f - 62, compact ? 150 : 130, 124, 39);
            float statusWidth = compact ? w - 2 * margin : Mathf.Min(760, w - 440);
            Place(status, compact ? margin : (w - statusWidth) * .5f, photoMode ? margin : h - dockHeight - margin - 54, statusWidth, 43);
            Inset(statusText.rectTransform, 13, 5, 13, 5);
            float detailWidth = compact ? Mathf.Min(340, w - 24) : 330;
            float detailY = compact ? 250 : 124;
            float detailHeight = Mathf.Max(180, h - detailY - dockHeight - margin - 68);
            Place(detail, margin, detailY, detailWidth, Mathf.Min(detailHeight, compact ? 485 : 640));
            detail.gameObject.SetActive(state != null && !string.IsNullOrEmpty(selected) && state.cells.ContainsKey(selected) && detailOpen && !IsMenuOpen && (!photoMode || photoInspection));
            float journeyWidth = compact ? Mathf.Min(340, w - 24) : 300;
            Place(tutorial, w - journeyWidth - margin, compact ? 250 : 125, journeyWidth, compact ? 170 : 185);
            if (compact && detail.gameObject.activeSelf) tutorial.gameObject.SetActive(false);
            var menuPanel = (RectTransform)menu.GetChild(0);
            float menuWidth = Mathf.Min(620, w - 36), menuHeight = Mathf.Min(805, h - 32);
            Place(menuPanel, (w - menuWidth) * .5f, (h - menuHeight) * .5f, menuWidth, menuHeight);
            var modalPanel = (RectTransform)modal.GetChild(0);
            float modalWidth = Mathf.Min(880, w - 32), modalHeight = Mathf.Min(800, h - 36);
            Place(modalPanel, (w - modalWidth) * .5f, (h - modalHeight) * .5f, modalWidth, modalHeight);
            var close = modalPanel.Find("Close Dialog");
            if (close != null) Place((RectTransform)close, modalWidth - 106, 17, 88, 38);
            var title = modalPanel.Find("Dialog Title");
            if (title != null) Place((RectTransform)title, 22, 14, modalWidth - 140, 44);
            lastSize = size;
        }

        void Update()
        {
            if (root != null && root.rect.size != lastSize) Layout();
        }

        void BuildOffers()
        {
            string key = state.round + ":" + string.Join(",", state.offers);
            bool fresh = key != offersKey && state.offers.Count >= 3;
            offersKey = key;
            Clear(cards);
            offerButtons.Clear();
            if (state.offers.Count == 0)
            {
                var done = Label(cards, "土地已落下，新的生命正在酝酿。", 18, Muted);
                done.alignment = TextAnchor.MiddleCenter;
                done.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;
                return;
            }
            for (int i = 0; i < state.offers.Count; i++)
            {
                int offerIndex = i;
                var type = Catalog.Types[state.offers[i]];
                var tint = TerrainTint(type.family, type.look);
                var card = Button(cards, "", () => { SelectedOffer = offerIndex; Emit(new GameAction { type = "selectOffer", offer = offerIndex }); BuildOffers(); }, i == SelectedOffer ? Gold : tint);
                card.interactable = !state.over && state.ap > 0;
                card.GetComponent<LayoutElement>().flexibleWidth = 1;
                card.GetComponent<HabitatButtonMotion>().SetCard(i == SelectedOffer, fresh, i * .09f);
                var label = card.GetComponentInChildren<Text>();
                label.text = type.name + "  T" + type.level + "\n" + ColoredAttrs(type.attrs);
                label.fontSize = compact ? 16 : 18;
                label.lineSpacing = 1.35f;
                label.supportRichText = true;
                offerButtons.Add(card);
            }
        }

        void BuildDetail()
        {
            Clear(detailBody);
            if (string.IsNullOrEmpty(selected) || !state.cells.TryGetValue(selected, out var tile)) return;
            var type = Catalog.Types[tile.type];
            var title = Row(detailBody);
            Label(title, type.name + "  T" + type.level, 24, Ink, null, 1);
            Button(title, "收起", () => { detailOpen = false; Layout(); }, Line, 65);
            Small(detailBody, "坐标 " + selected + "  ·  " + type.familyName + " / " + type.branch);
            Body(detailBody, ColoredAttrs(tile.attrs), 21);
            Small(detailBody, "连片 " + Game.Cluster(state, selected).Count + " 格  ·  属性上限 " + Game.AttrCap(state, selected));
            Body(detailBody, type.effect, 15, Muted);
            if (!string.IsNullOrEmpty(type.trigger)) Small(detailBody, type.trigger + " · " + type.cost);
            if (Game.Relations.TryGetValue(type.family, out var rule))
            {
                var relations = Game.TileRelations(state, selected);
                string partners = string.Join(" / ", rule.targets.Select(f => Catalog.Tiles.First(t => t.family == f).familyName));
                Section(detailBody, "四邻互作 · " + rule.name);
                Small(detailBody, "每个相邻" + partners + "，轮末使本格" + ElementName(rule.el) + " +" + Mathf.Max(1, type.level - 2));
                Small(detailBody, "当前匹配 " + relations.Count + " 格" + (relations.Count > 0 ? " · " + string.Join(" / ", relations.Select(r => r.neighbor)) : ""));
            }

            Section(detailBody, "土地成长 · 自动补齐结晶缺口");
            foreach (var child in Catalog.Tiles.Where(t => t.parent == tile.type))
            {
                var reasons = Game.UpgradeReasons(state, selected, child);
                Body(detailBody, child.name + "  T" + child.level, 17);
                Small(detailBody, child.effect);
                var payment = Game.UpgradeCost(state, selected, child);
                Small(detailBody, "消耗普通：" + (BagText(payment.normal) == "" ? "无" : BagText(payment.normal)) + "；大型：" + (BagText(payment.big) == "" ? "无" : BagText(payment.big)));
                var destination = child.id;
                Button(detailBody, reasons.Count == 0 ? "升级为「" + child.name + "」" : string.Join(" · ", reasons), () => Emit(new GameAction { type = "upgrade", cell = selected, tileType = destination }), reasons.Count == 0 ? Green : Line).interactable = reasons.Count == 0 && !state.over;
            }
            if (!Catalog.Tiles.Any(t => t.parent == tile.type)) Small(detailBody, type.level >= 5 ? "这片土地已长成最高阶段。" : "通过结晶与连片培养地块。");

            Section(detailBody, "施放魔法  ·  每次 1 行动");
            foreach (var magic in Catalog.Magics)
            {
                var id = magic.id;
                bool unlocked = Game.MagicUnlocked(state, id);
                bool used = Used(state.magicUsed, id);
                var castButton = Button(detailBody, magic.name + " · " + state.magicRange[id] + " 格" + (used ? " · 本轮已用" : !unlocked ? " · 尚未解锁" : ""), () => Emit(new GameAction { type = "cast", magic = id, cell = selected }), unlocked ? Green : Line);
                castButton.interactable = unlocked && !used && state.ap > 0 && !state.over;
                Preview(castButton, () => Game.MagicArea(state, selected, id), magic.element);
                Small(detailBody, magic.desc);
                if (Count(state.inv.pureCrystal, magic.element) > 0) Button(detailBody, "至纯" + ElementName(magic.element) + "晶 · 范围 +4", () => Emit(new GameAction { type = "usePureCrystal", magic = id }), Gold).interactable = !state.over;
            }
            Button(detailBody, "结晶背包 · 免费连续使用", OpenInventory, Gold);
            Button(detailBody, "批量结晶 · 预览属性与统一使用", OpenCrystalBatch, Line);
            Button(detailBody, "批量地块升级", OpenUpgradeBatch, Line);

            Section(detailBody, "灵与生灵");
            Small(detailBody, "元素灵 " + tile.spirits.Count + " / " + Game.SpiritCap(tile) + " · 同属性 3 灵轮末自动合兽");
            foreach (var el in ElementKeys)
            {
                var list = tile.spirits.Where(s => s.el == el).ToList();
                if (list.Count == 0) continue;
                Body(detailBody, ElementName(el) + "元素灵 × " + list.Count, 16);
                var spirit = list[0];
                var row = Row(detailBody);
                Button(row, "移动灵", () => Emit(new GameAction { type = "moveSpirit", from = selected, spiritId = spirit.id }), Line).interactable = !state.over && !Used(state.interactionUsed, "spirit:" + spirit.id);
                Button(row, "免费合兽", () => Emit(new GameAction { type = "merge", cell = selected, el = el }), Gold).interactable = !state.over && list.Count >= 3;
            }
            foreach (var beast in tile.beasts)
            {
                int id = beast.id;
                var row = Row(detailBody);
                Label(row, ElementName(beast.el) + "元素兽", 16, Ink, null, 1);
                Button(row, "移动", () => Emit(new GameAction { type = "moveBeast", from = selected, beastId = id }), Line, 70).interactable = !state.over && !Used(state.interactionUsed, "beast:" + id);
            }
            if (tile.beasts.Count > 0)
            {
                Small(detailBody, "元素兽每 2 轮产出 1 颗大结晶。");
                Button(detailBody, "选择 5 兽 · 唤醒守护灵", () => OpenGuardian(selected), Gold).interactable = !state.over && tile.beasts.Count >= 5;
            }
            foreach (var guardian in tile.guardians)
            {
                int id = guardian.id;
                Body(detailBody, "守护灵  ·  " + BagText(guardian.power), 17);
                Small(detailBody, "每轮滋养本格和已放置四邻，不自动移动。");
                Button(detailBody, "移动守护灵 · 1 行动", () => Emit(new GameAction { type = "moveGuardian", from = selected, guardianId = id }), Gold).interactable = !state.over && state.ap > 0;
            }
            foreach (var group in tile.plants.GroupBy(p => p.kind)) Small(detailBody, UnitName(group.Key) + " × " + group.Count() + " · 每 3 轮自动滋养");
            foreach (var group in tile.animals.GroupBy(a => new { a.kind, a.el })) Small(detailBody, ElementName(group.Key.el) + (string.IsNullOrEmpty(group.Key.el) ? "" : "元素") + UnitName(group.Key.kind) + " × " + group.Count() + " · 自动吸收与滋养");
            if (tile.cancers.Count > 0) Body(detailBody, "癌元 × " + tile.cancers.Count + " · 使用净化或焚尽清除", 16, Hex("B86155"));

            var shields = state.shields.Where(s => s.cells.Contains(selected)).ToList();
            foreach (var shield in shields)
            {
                Body(detailBody, "元素盾 " + BagText(shield.defense), 16);
                Small(detailBody, "覆盖区内共享防护，抵御预告的元素星雨。");
            }
            Section(detailBody, "地块交互");
            Small(detailBody, "生态分 " + (tile.plants.Count + tile.animals.Count) + " · 植物与动物各 +1，属性每点 +0.5");
            Button(detailBody, "铲除地块 · 1 行动", ConfirmDemolish, Hex("ECD5C2")).interactable = !state.over && state.ap > 0;
            Button(detailBody, "查看回声与操作记录", OpenEchoes, Line);
            if (photoMode) foreach (var button in detailBody.GetComponentsInChildren<Button>()) button.interactable = button.name == "Button 收起";
        }

        public void RevealSelection()
        {
            detailOpen = true;
            if (photoMode) photoInspection = true;
            Layout();
        }

        void BuildTutorial()
        {
            Clear(tutorialBody);
            bool visible = state.journey != null && !state.journey.skipped && !state.over;
            tutorial.gameObject.SetActive(visible && !IsMenuOpen);
            if (!visible) return;
            int step = Mathf.Clamp(state.journey.step, 0, 8);
            Body(tutorialBody, LessonTitles[step], 21, Green);
            Body(tutorialBody, step >= 8 ? ChallengeHint() + "。升级中央塔、搭配土地，保护生境的成长。" : LessonCopy[step], 15);
            var controls = Row(tutorialBody);
            Button(controls, step == 0 ? "开始旅程" : step >= 8 ? "回声册" : "指引目标", () =>
            {
                if (step == 0) Emit(new GameAction { type = "tutorial" });
                else if (step >= 8) OpenEchoes();
                else
                {
                    var target = step == 1 || step == 5 || step == 7 ? "3,2" : step == 2 ? "5,3" : "2,2";
                    Emit(new GameAction { type = "cancel" });
                    selectCell?.Invoke(target);
                    detailOpen = true;
                }
            }, Green);
            if (step < 8) Button(controls, "跳过", () => Emit(new GameAction { type = "tutorial", skip = true }), Line, 65);
        }

        void BuildMenu()
        {
            Clear(menuBody);
            Body(menuBody, "元素生境", 48, Green, TextAnchor.MiddleCenter);
            Body(menuBody, "守护元素之塔，完成四十轮复苏。", 19, Muted, TextAnchor.MiddleCenter);
            var elements = Body(menuBody, ColoredAttrs(new[] { 1, 1, 1, 1, 1 }, false), 26, Ink, TextAnchor.MiddleCenter);
            elements.GetComponent<LayoutElement>().preferredHeight = 48;
            if (state != null)
            {
                bool saveError = !string.IsNullOrEmpty(message) && (message.StartsWith("未能读取存档", StringComparison.Ordinal) || message.StartsWith("存档失败", StringComparison.Ordinal));
                string subtitle = saveError ? message : "第 " + state.round + " 轮  ·  " + (state.mode == "endless" ? "无尽生境" : "40 轮挑战") + "  ·  灵力 " + ScoreNumber(Game.Score(state).total);
                menuSubtitle = Body(menuBody, subtitle, 17, saveError ? Hex("AD6049") : Muted, TextAnchor.MiddleCenter);
            }
            Button(menuBody, hasPlayed ? "回到生境" : "继续上次旅程", () => { HideMainMenu(); detailOpen = true; continueGame?.Invoke(); Layout(); }, Green, 0, 54).interactable = hasPlayed || hasSave;
            Button(menuBody, "初醒之旅  ·  教学与四十轮挑战", () => RequestNewGame(true), Gold, 0, 54);
            Button(menuBody, "复苏挑战  ·  10/20/30/40 轮达标", () => RequestNewGame(false), Line, 0, 54);
            Button(menuBody, hasPlayed && state != null && state.completedMap && state.mode != "endless" && state.result != "failed" ? "转入无尽生境 · 初始地图已完成" : "无尽生境  ·  自由扩建", () =>
            {
                if (hasPlayed && state != null && state.completedMap && state.mode != "endless" && state.result != "failed") { HideMainMenu(); Emit(new GameAction { type = "enterEndless" }); }
                else RequestNewGame(false, true);
            }, Line, 0, 48);
            var row = Row(menuBody, 45);
            Button(row, "地脉图鉴", OpenAtlas, Line);
            Button(row, "成就愿景", OpenAchievements, Line);
            Button(row, "设置", OpenSettings, Line);
            var tools = Row(menuBody, 43);
            Button(tools, "玩法说明", OpenHelp, Line);
            Button(tools, "回声册", OpenEchoes, Line);
            Button(tools, "保存进度", () => { Emit(new GameAction { type = "save" }); BuildMenu(); }, Line).interactable = hasPlayed;
            var keepsakes = Row(menuBody, 41);
            Button(keepsakes, "摄影", () => { HideMainMenu(); Emit(new GameAction { type = "photoMode" }); }, Line).interactable = hasPlayed && state != null && state.completedMap;
            Button(keepsakes, "保存地图", () => Emit(new GameAction { type = "exportSave" }), Line).interactable = hasPlayed && state != null && state.completedMap;
            Button(keepsakes, "检视生境", () => { HideMainMenu(); Emit(new GameAction { type = "inspect" }); }, Line).interactable = hasPlayed && state != null && state.completedMap;
            Small(menuBody, "单人离线 · 本机自动存档\n行动可自由分配 · 每轮可多次铺地\n挑战目标：500 / 1500 / 3000 / 6000", TextAnchor.MiddleCenter);
        }

        void RequestNewGame(bool tutorialMode, bool endless = false)
        {
            if (!hasPlayed && !hasSave) { StartGame(tutorialMode, endless); return; }
            OpenModal("重新开始", "confirm");
            Body(modalBody, "要开启新的生境吗？", 26);
            Body(modalBody, "当前对局会被新旅程替换。已解锁的本机成就保留。", 18, Muted);
            Button(modalBody, "开启" + (endless ? "无尽生境" : tutorialMode ? "初醒之旅" : "复苏挑战"), () => StartGame(tutorialMode, endless), Green, 0, 52);
            Button(modalBody, "保留当前旅程", CloseModal, Line, 0, 48);
        }

        void StartGame(bool tutorialMode, bool endless = false)
        {
            CloseModal();
            HideMainMenu();
            SelectedOffer = -1;
            selected = null;
            detailOpen = true;
            hasPlayed = true;
            if (endless) Emit(new GameAction { type = "newEndless" });
            else newGame?.Invoke(tutorialMode);
        }

        void OpenInventory() { OpenModal("结晶与背包", "inventory"); BuildInventory(); }
        void BuildInventory()
        {
            Clear(modalBody);
            if (!RequireGame()) return;
            Body(modalBody, "选择结晶后点击地图目标。批量结晶使用当前选中地块。", 18, Green);
            if (!string.IsNullOrEmpty(selected) && state.cells.TryGetValue(selected, out var target)) Small(modalBody, "当前选中：" + Catalog.Types[target.type].name + " · " + selected);
            if (!string.IsNullOrWhiteSpace(message)) Small(modalBody, message);
            Small(modalBody, "普通 +1 / 大型 +2 / 逆结晶 −1。结晶不耗行动点，每轮不限次数；正向属性仍受连片上限限制。");
            foreach (var el in ElementKeys)
            {
                var key = el;
                var row = Row(modalBody, 51);
                Label(row, ElementName(el), 23, ElementColor(el), null, 0, 38);
                InventoryButton(row, "普通", "crystal", key, state.inv.crystal, () => Crystal(key, false, false));
                InventoryButton(row, "大型", "bigCrystal", key, state.inv.bigCrystal, () => Crystal(key, true, false));
                InventoryButton(row, "逆晶", "inverseCrystal", key, state.inv.inverseCrystal, () => Crystal(key, false, true));
            }
            Button(modalBody, "批量结晶 · 选择数量并预览", OpenCrystalBatch, Gold).interactable = !state.over && !string.IsNullOrEmpty(selected) && state.cells.ContainsKey(selected);
            Button(modalBody, "批量地块升级 · 自动计算结晶缺口", OpenUpgradeBatch, Line).interactable = !state.over;
            Section(modalBody, "至纯结晶 · 魔法范围每颗 +4 格");
            foreach (var magic in Catalog.Magics)
            {
                var id = magic.id;
                string prefix = ElementName(magic.element) + "至纯晶";
                string suffix = " → " + magic.name + " " + state.magicRange[id] + " → " + (state.magicRange[id] + 4) + " 格";
                int count = Count(state.inv.pureCrystal, magic.element);
                var pure = Button(modalBody, prefix + " ×" + (feedbackHUD == null ? count : feedbackHUD.DisplayInventory("pureCrystal", magic.element, count)) + suffix,
                    () => Emit(new GameAction { type = "usePureCrystal", magic = id }), Line);
                pure.interactable = !state.over && count > 0;
                inventoryLabels[pure.GetComponentInChildren<Text>()] = "pureCrystal:" + magic.element + ":" + prefix + ":" + suffix;
            }
            Small(modalBody, "每次元素星雨后，获得同属性至纯结晶。范围升级不消耗行动点。");
            Section(modalBody, "元素盾 · 普通 1 点 / 大型 2 点");
            Button(modalBody, "选择五行配比 · 制造元素盾", OpenShield, Gold).interactable = !state.over && !Used(state.interactionUsed, "craft:shield");
            if (state.inv.shields.Count == 0) Small(modalBody, "暂无待部署的元素盾。每 4 轮触发自然事件，提前为预告的元素星雨准备庇护。");
            foreach (var shield in state.inv.shields)
            {
                var id = shield.id;
                Button(modalBody, "部署 " + shield.coverage + " 格盾 · " + BagText(shield.defense), () => { CloseModal(); Emit(new GameAction { type = "deployShield", shieldId = id }); }, Green).interactable = !state.over;
            }
            Button(modalBody, "刷新候选地块 · 1 行动", () => Emit(new GameAction { type = "reroll" }), Line).interactable = !state.over && state.ap > 0;
        }

        void Crystal(string element, bool big, bool inverse)
        {
            CloseModal();
            Emit(new GameAction { type = "useCrystal", el = element, big = big, inverse = inverse });
        }

        public void ShowTower()
        {
            OpenModal("中央守护塔", "tower");
            BuildTower();
        }

        void BuildTower()
        {
            Clear(modalBody);
            if (!RequireGame()) return;
            Body(modalBody, "五行庇护与灵力涌泉", 26, Green);
            Small(modalBody, "守护塔位于中央，所有支路初始 1 级，最高 7 级。范围按到中央的曼哈顿距离计算。升级不耗行动点；普通结晶 1 点，大型 2 点，优先消耗普通结晶。");
            foreach (var feature in new[] { "shelter", "spring" })
            {
                Section(modalBody, feature == "shelter" ? "元素庇护 · 覆盖范围内免受对应星雨伤害" : "灵力涌泉 · 每轮为范围内土地滋养对应属性");
                foreach (var el in ElementKeys)
                {
                    var key = el;
                    var branch = feature;
                    int level = feature == "shelter" ? state.tower.shelter[el] : state.tower.spring[el];
                    var payment = Game.TowerPayment(state, feature, el);
                    Body(modalBody, ElementName(el) + " · 等级 " + level + " · 覆盖 " + Game.TowerArea(state, level).Count + " 格" + (feature == "spring" ? " · 每轮 +" + level : ""), 19, ElementColor(el));
                    Small(modalBody, "库存 普通 " + Count(state.inv.crystal, el) + " / 大型 " + Count(state.inv.bigCrystal, el));
                    var upgradeButton = Button(modalBody, level >= 7 ? "已达最高等级" : "升级至 " + (level + 1) + " 级 · 普通 " + payment.normal + " + 大型 " + payment.big, () => Emit(new GameAction { type = "upgradeTower", feature = branch, el = key }), payment.ok ? Green : Line);
                    upgradeButton.interactable = !photoMode && !state.over && level < 7 && payment.ok;
                    Preview(upgradeButton, () => Game.TowerArea(state, Mathf.Min(7, level + 1)), el);
                    if (level < 7 && !payment.ok) Small(modalBody, "升级需要 " + Game.TowerCost(level) + " 点对应元素结晶。");
                }
            }
            Section(modalBody, "守护塔灵力 " + state.tower.spent);
            Small(modalBody, "塔分按实际消耗的普通与大型结晶颗数累计。");
        }

        void OpenCrystalBatch()
        {
            crystalTarget = selected;
            crystalMix.Clear();
            OpenModal("批量结晶 · 属性预览", "crystals");
            BuildCrystalBatch();
        }

        List<CrystalUse> CrystalSelection()
        {
            return crystalMix.Where(p => p.Value > 0).Select(p => new CrystalUse { kind = p.Key.Split(':')[0], el = p.Key.Split(':')[1], count = p.Value }).ToList();
        }

        ElementBag CrystalStock(string kind)
        {
            return kind == "bigCrystal" ? state.inv.bigCrystal : kind == "inverseCrystal" ? state.inv.inverseCrystal : state.inv.crystal;
        }

        void BuildCrystalBatch()
        {
            Clear(modalBody);
            if (!RequireGame()) return;
            if (string.IsNullOrEmpty(crystalTarget) || !state.cells.TryGetValue(crystalTarget, out var tile))
            {
                Body(modalBody, "先关闭背包，点击地图选择一块土地。", 22, Muted);
                return;
            }
            Body(modalBody, Catalog.Types[tile.type].name + "  ·  " + crystalTarget, 23, Green);
            Small(modalBody, "按普通 +1 / 大型 +2 / 逆晶 −1 同时计算。不限次数，不耗行动点；超过正向上限的投入仍会消耗。");
            foreach (var kind in new[] { "crystal", "bigCrystal", "inverseCrystal" })
            {
                Section(modalBody, kind == "crystal" ? "普通结晶" : kind == "bigCrystal" ? "大型结晶" : "逆结晶");
                var stock = CrystalStock(kind);
                foreach (var el in ElementKeys)
                {
                    string id = kind + ":" + el;
                    int have = Count(stock, el);
                    crystalMix[id] = Mathf.Clamp(Count(crystalMix, id), 0, have);
                    var row = Row(modalBody, 43);
                    Label(row, ElementName(el) + " · 库存 " + have, 18, ElementColor(el), null, 1);
                    Button(row, "−", () => { crystalMix[id]--; BuildCrystalBatch(); }, Line, 44).interactable = crystalMix[id] > 0;
                    Label(row, crystalMix[id].ToString(), 22, Ink, null, 0, 40).alignment = TextAnchor.MiddleCenter;
                    Button(row, "+", () => { crystalMix[id]++; BuildCrystalBatch(); }, Line, 44).interactable = crystalMix[id] < have;
                    Button(row, "全选", () => { crystalMix[id] = have; BuildCrystalBatch(); }, Line, 60).interactable = have > 0;
                }
            }
            var selection = CrystalSelection();
            var plan = Game.PlanCrystals(state, crystalTarget, selection);
            Section(modalBody, "属性变化预览");
            Body(modalBody, "当前：" + ColoredAttrs(tile.attrs), 20);
            if (plan.ok)
            {
                Body(modalBody, "之后：" + ColoredAttrs(plan.attrs), 20);
                Small(modalBody, "消耗 " + plan.count + " 颗 · 属性净变化 " + plan.gain + (plan.capped ? " · 部分增量超过连片上限" : ""));
            }
            else Small(modalBody, plan.msg);
            Button(modalBody, "统一使用所选结晶", () =>
            {
                var action = new GameAction { type = "useCrystals", cell = crystalTarget, crystals = CrystalSelection() };
                CloseModal(); Emit(action); OpenInventory();
            }, Green, 0, 52).interactable = plan.ok && !state.over;
            Button(modalBody, "清空所选数量", () => { crystalMix.Clear(); BuildCrystalBatch(); }, Line);
        }

        void OpenUpgradeBatch()
        {
            batchUpgrades.Clear();
            OpenModal("批量地块升级", "upgrades");
            BuildUpgradeBatch();
        }

        void BuildUpgradeBatch()
        {
            Clear(modalBody);
            if (!RequireGame()) return;
            Small(modalBody, "为不同地块各选择一个升级方向。系统按顺序计算所有结晶支出，满足条件后统一升级，不消耗行动点。");
            foreach (var pair in state.cells)
            {
                var children = Catalog.Tiles.Where(t => t.parent == pair.Value.type).ToList();
                if (children.Count == 0) continue;
                string cell = pair.Key;
                Section(modalBody, Catalog.Types[pair.Value.type].name + " · " + cell);
                foreach (var child in children)
                {
                    string destination = child.id;
                    bool chosen = batchUpgrades.TryGetValue(cell, out string choice) && choice == destination;
                    var cost = Game.UpgradeCost(state, cell, child);
                    Button(modalBody, (chosen ? "已选  " : "选择  ") + child.name + " T" + child.level, () =>
                    {
                        if (batchUpgrades.TryGetValue(cell, out string current) && current == destination) batchUpgrades.Remove(cell);
                        else batchUpgrades[cell] = destination;
                        BuildUpgradeBatch();
                    }, chosen ? Gold : Line);
                    Small(modalBody, "普通 " + BagText(cost.normal) + " / 大型 " + BagText(cost.big));
                }
            }
            var changes = batchUpgrades.Select(p => new GameAction { type = "upgrade", cell = p.Key, tileType = p.Value }).ToList();
            var plan = Game.PlanUpgrades(state, changes);
            Section(modalBody, "已选 " + changes.Count + " 块地形");
            if (plan.ok) Small(modalBody, "合计 普通 " + BagText(plan.normal) + " / 大型 " + BagText(plan.big));
            else Small(modalBody, plan.msg);
            Button(modalBody, "统一升级 " + changes.Count + " 块地形", () => { CloseModal(); Emit(new GameAction { type = "upgradeBatch", upgrades = changes }); }, Green, 0, 52).interactable = plan.ok && !state.over;
        }

        void ConfirmDemolish()
        {
            if (string.IsNullOrEmpty(selected) || !state.cells.TryGetValue(selected, out var tile)) return;
            string cell = selected;
            OpenModal("铲除地块", "confirm");
            Body(modalBody, "铲除「" + Catalog.Types[tile.type].name + "」？", 26);
            Body(modalBody, "消耗 1 行动，土地上的生灵一并移除。正属性返还为普通结晶：", 18, Muted);
            Body(modalBody, ColoredAttrs(tile.attrs.Select(v => Mathf.Max(0, v)).ToArray()), 24);
            Button(modalBody, "确认铲除 · 1 行动", () => { CloseModal(); Emit(new GameAction { type = "demolish", cell = cell }); }, Hex("E7C8B1"), 0, 52);
            Button(modalBody, "保留土地", CloseModal, Line);
        }

        void OpenShield()
        {
            foreach (var key in ElementKeys) { shieldMix[key] = 0; shieldBigMix[key] = 0; }
            FillShield(state.inv.crystal.Values.Any(n => n > 0) ? 5 : 10);
            OpenModal("元素盾配比", "shield");
            BuildShield();
        }

        void FillShield(int total, string primary = null)
        {
            foreach (var key in ElementKeys) { shieldMix[key] = 0; shieldBigMix[key] = 0; }
            ShieldAdd(Mathf.Min(total, ShieldMax()), primary);
        }

        void ShieldAdd(int points, string primary = null)
        {
            if (!string.IsNullOrEmpty(primary))
            {
                int amount = Mathf.Min(points / 2, Count(state.inv.bigCrystal, primary) - shieldBigMix[primary]);
                shieldBigMix[primary] += amount;
                points -= amount * 2;
            }
            int normal = Mathf.Min(points, ElementKeys.Sum(e => Count(state.inv.crystal, e) - shieldMix[e]));
            if ((points - normal) % 2 != 0) normal--;
            normal = Mathf.Max(0, normal);
            int big = (points - normal) / 2;
            foreach (var kind in new[] { "normal", "big" })
            {
                var mix = kind == "normal" ? shieldMix : shieldBigMix;
                var stock = kind == "normal" ? state.inv.crystal : state.inv.bigCrystal;
                int remaining = kind == "normal" ? normal : big;
                var order = !string.IsNullOrEmpty(primary) ? new[] { primary }.Concat(ElementKeys.Where(e => e != primary)) : ElementKeys;
                foreach (var key in order)
                {
                    int amount = Mathf.Min(remaining, Count(stock, key) - mix[key]);
                    mix[key] += amount;
                    remaining -= amount;
                }
            }
        }

        int ShieldStockPoints() { return state.inv.crystal.Values.Sum() + 2 * state.inv.bigCrystal.Values.Sum(); }
        int ShieldPoints() { return shieldMix.Values.Sum() + 2 * shieldBigMix.Values.Sum(); }
        int ShieldMax() { int unit = state.inv.crystal.Values.Any(n => n > 0) ? 5 : 10; return ShieldStockPoints() / unit * unit; }
        int ShieldMissing()
        {
            int n = ShieldPoints();
            int missing = n < 5 ? 5 - n : (5 - n % 5) % 5;
            if (missing % 2 != 0 && !ElementKeys.Any(e => Count(state.inv.crystal, e) > shieldMix[e])) missing += 5;
            return missing;
        }

        void BuildShield()
        {
            Clear(modalBody);
            if (!RequireGame()) return;
            Body(modalBody, "各元素防护在覆盖区域内共享。", 21, Green);
            Small(modalBody, "普通结晶每颗 1 点，大型每颗 2 点；每 5 点防护覆盖 1 格。总点数需为 5 的倍数，每轮可制造 1 次，不消耗行动点。");
            var presets = Row(modalBody, 45);
            foreach (int preset in new[] { 5, 10, 15 })
            {
                int amount = preset;
                Button(presets, preset + " 点", () => { FillShield(amount); BuildShield(); }, Line).interactable = ShieldStockPoints() >= amount && (amount % 2 == 0 || state.inv.crystal.Values.Any(n => n > 0));
            }
            Button(presets, "清空", () => { FillShield(0); BuildShield(); }, Line);
            foreach (var el in ElementKeys)
            {
                var key = el;
                if (!shieldMix.ContainsKey(el)) shieldMix[el] = 0;
                shieldMix[el] = Mathf.Clamp(shieldMix[el], 0, Count(state.inv.crystal, el));
                var row = Row(modalBody, 49);
                Button(row, ElementName(el) + "优先", () => { FillShield(Mathf.Max(5, ShieldPoints()), key); BuildShield(); }, Line, 90);
                Label(row, "普通 " + Count(state.inv.crystal, el), 16, Muted, null, 1);
                Button(row, "−", () => { shieldMix[key]--; BuildShield(); }, Line, 46).interactable = shieldMix[el] > 0;
                Label(row, shieldMix[el].ToString(), 23, ElementColor(el), null, 0, 48).alignment = TextAnchor.MiddleCenter;
                Button(row, "+", () => { shieldMix[key]++; BuildShield(); }, Line, 46).interactable = shieldMix[el] < Count(state.inv.crystal, el);
                if (!shieldBigMix.ContainsKey(el)) shieldBigMix[el] = 0;
                shieldBigMix[el] = Mathf.Clamp(shieldBigMix[el], 0, Count(state.inv.bigCrystal, el));
                var bigRow = Row(modalBody, 44);
                Label(bigRow, ElementName(el) + "大型 · 库存 " + Count(state.inv.bigCrystal, el), 16, Muted, null, 1);
                Button(bigRow, "−", () => { shieldBigMix[key]--; BuildShield(); }, Line, 46).interactable = shieldBigMix[el] > 0;
                Label(bigRow, shieldBigMix[el].ToString(), 23, ElementColor(el), null, 0, 48).alignment = TextAnchor.MiddleCenter;
                Button(bigRow, "+", () => { shieldBigMix[key]++; BuildShield(); }, Line, 46).interactable = shieldBigMix[el] < Count(state.inv.bigCrystal, el);
            }
            int total = ShieldPoints();
            int missing = ShieldMissing();
            Section(modalBody, total / 5 + " 格覆盖   ·   " + total + " 点防护");
            Body(modalBody, "普通 " + BagText(shieldMix) + "\n大型 " + BagText(shieldBigMix), 21);
            if (missing > 0)
            {
                Small(modalBody, "还需补齐 " + missing + " 点防护。");
                Button(modalBody, "自动补齐 " + missing + " 点", () =>
                {
                    ShieldAdd(missing);
                    BuildShield();
                }, Line).interactable = ShieldStockPoints() - total >= missing;
            }
            Button(modalBody, "制造元素盾 · " + total + " 点防护", () =>
            {
                var mix = new Dictionary<string, int>(shieldMix);
                CloseModal();
                Emit(new GameAction { type = "craftShield", crystals = mix, bigCrystals = new Dictionary<string, int>(shieldBigMix) });
                OpenInventory();
            }, Green, 0, 52).interactable = total >= 5 && missing == 0 && !state.over && !Used(state.interactionUsed, "craft:shield");
        }

        void OpenGuardian(string cell)
        {
            guardianCell = cell;
            guardianChoice.Clear();
            foreach (var beast in state.cells[cell].beasts.Take(5)) guardianChoice.Add(beast.id);
            OpenModal("五兽同誓 · 唤醒守护灵", "guardian");
            BuildGuardian();
        }

        void BuildGuardian()
        {
            Clear(modalBody);
            if (state == null || !state.cells.TryGetValue(guardianCell, out var tile)) return;
            Small(modalBody, "从同一地块选择任意 5 只元素兽，免费合成一个守护灵。混合配比决定每轮滋养的五行属性。");
            var power = new Dictionary<string, int>();
            foreach (var beast in tile.beasts)
            {
                int id = beast.id;
                bool chosen = guardianChoice.Contains(id);
                if (chosen) power[beast.el] = Count(power, beast.el) + 1;
                Button(modalBody, (chosen ? "已选  " : "选择  ") + ElementName(beast.el) + "元素兽  #" + id, () =>
                {
                    if (!guardianChoice.Remove(id) && guardianChoice.Count < 5) guardianChoice.Add(id);
                    BuildGuardian();
                }, chosen ? Gold : Line).interactable = chosen || guardianChoice.Count < 5;
            }
            Section(modalBody, "已选择 " + guardianChoice.Count + " / 5");
            Body(modalBody, BagText(power), 22, Green);
            Small(modalBody, "每轮结束：所在地块及已放置四邻，共 " + Game.GuardianArea(state, guardianCell).Count + " 格。移动每步消耗 1 行动，可重复移动。");
            Button(modalBody, "免费唤醒守护灵", () =>
            {
                var action = new GameAction { type = "mergeGuardian", cell = guardianCell, beastIds = guardianChoice.ToList() };
                CloseModal();
                Emit(action);
            }, Green, 0, 52).interactable = guardianChoice.Count == 5 && !state.over;
        }

        void OpenAtlas() { OpenModal("地脉图鉴 · 80 种地块", "atlas"); BuildAtlas(); }
        void BuildAtlas()
        {
            Clear(modalBody);
            Body(modalBody, "十个系列 · 两条成长方向", 24, Green);
            Small(modalBody, "同系列连片共享上限。阶段属性和为 1 / 5 / 12 / 24 / 40。T4 需要元素兽经历，T5 需要 5 格连片与守护灵覆盖。");
            foreach (var family in Catalog.Tiles.Where(t => !string.IsNullOrEmpty(t.family)).GroupBy(t => t.family))
            {
                Section(modalBody, family.First().familyName);
                foreach (var type in family)
                {
                    var card = Panel("Atlas " + type.id, modalBody, TerrainTint(type.family, type.look));
                    var body = VerticalBody(card, 12, true);
                    Body(body, "T" + type.level + "  " + type.name + "  ·  " + type.branch, 20);
                    Body(body, ColoredAttrs(type.attrs), 17);
                    Small(body, type.effect);
                    if (!string.IsNullOrEmpty(type.trigger)) Small(body, type.trigger + " · " + type.cost);
                }
            }
        }

        void OpenAchievements() { OpenModal("成就与本局愿景", "achievements"); BuildAchievements(); }
        void BuildAchievements()
        {
            Clear(modalBody);
            if (state != null)
            {
                Section(modalBody, "本局愿景 · 记录生境的成长");
                foreach (var vision in state.visions)
                {
                    var definition = Catalog.Visions.FirstOrDefault(v => v.id == vision.id);
                    if (definition == null) continue;
                    Body(modalBody, (vision.done ? "已完成  " : "进行中  ") + definition.name, 21, vision.done ? Green : Ink);
                    Small(modalBody, definition.desc);
                    Progress(modalBody, vision.done ? definition.target : Metric(definition.metric), definition.target, vision.done);
                }
            }
            Section(modalBody, "旅途成就 · 本机永久记录");
            var global = new HashSet<string>(PlayerPrefs.GetString("habitat.achievements", "").Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries));
            int unlocked = Catalog.Achievements.Count(a => global.Contains(a.id) || PlayerPrefs.GetInt("habitat.achievement." + a.id, 0) > 0);
            Small(modalBody, "已解锁 " + unlocked + " / " + Catalog.Achievements.Count + " · 新的生境也会记得你的足迹");
            foreach (var achievement in Catalog.Achievements)
            {
                bool done = global.Contains(achievement.id) || PlayerPrefs.GetInt("habitat.achievement." + achievement.id, 0) > 0;
                Body(modalBody, (done ? "已解锁  " : "未解锁  ") + achievement.name, 20, done ? Green : Ink);
                Small(modalBody, achievement.desc);
                Progress(modalBody, PlayerPrefs.GetInt("habitat.progress." + achievement.id, 0), achievement.target, done);
            }
        }

        void OpenEchoes() { OpenModal("回声册与旅程记录", "echoes"); BuildEchoes(); }
        void BuildEchoes()
        {
            Clear(modalBody);
            if (!RequireGame()) return;
            Small(modalBody, "土地记得你走过的每一步。首次完成对应行动，会找回新的回声；铺满初始生境后解封全部残卷。");
            var known = KnownMemories();
            for (int i = 0; i < MemoryKeys.Length; i++)
            {
                if (!known.Contains(MemoryKeys[i]) && !state.completedMap) continue;
                Section(modalBody, MemoryTitles[i]);
                Body(modalBody, MemoryCopy[i], 18);
            }
            if (known.Count == 0) Body(modalBody, "第一道回声藏在净化之后。", 20, Muted);
            Section(modalBody, "近期旅程记录");
            foreach (var entry in state.log.Take(80)) Small(modalBody, entry);
        }

        HashSet<string> KnownMemories()
        {
            // Memories are serialized by the pure rules core. Reflection keeps presentation
            // compatible with older save editions that stored them on Journey instead of Story.
            var result = new HashSet<string>();
            foreach (var owner in new object[] { ReadMember(state, "story"), state.journey })
            {
                var memories = ReadMember(owner, "memories") as IEnumerable<string>;
                if (memories != null) foreach (var key in memories) result.Add(key);
            }
            return result;
        }

        static object ReadMember(object owner, string name)
        {
            if (owner == null) return null;
            var field = owner.GetType().GetField(name);
            if (field != null) return field.GetValue(owner);
            return owner.GetType().GetProperty(name)?.GetValue(owner, null);
        }

        void OpenSettings() { OpenModal("生境设置", "settings"); BuildSettings(); }
        void BuildSettings()
        {
            Clear(modalBody);
            Section(modalBody, "画面与交互");
            Button(modalBody, "柔和氛围  " + (AtmosphereEnabled ? "开启" : "关闭"), () =>
            {
                AtmosphereEnabled = !AtmosphereEnabled;
                PlayerPrefs.SetInt("habitat.atmosphere", AtmosphereEnabled ? 1 : 0);
                Emit(new GameAction { type = "settingsAtmosphere", skip = AtmosphereEnabled });
                BuildSettings();
            }, AtmosphereEnabled ? Green : Line, 0, 52);
            Small(modalBody, "柔和泛光与景深让微缩景观更温暖，界面文字保持清晰。");
            Button(modalBody, "减少动态效果  " + (ReducedMotion ? "开启" : "关闭"), () =>
            {
                SetReducedMotion(!ReducedMotion);
                PlayerPrefs.SetInt("habitat.reducedMotion", ReducedMotion ? 1 : 0);
                Emit(new GameAction { type = "settingsReducedMotion", skip = ReducedMotion });
                BuildSettings();
            }, ReducedMotion ? Green : Line, 0, 52);
            Small(modalBody, "减少飘动、镜头与粒子动画，保留必要的行动反馈。");
            Button(modalBody, "环境音效  " + (SoundEnabled ? "开启" : "关闭"), () =>
            {
                SoundEnabled = !SoundEnabled;
                PlayerPrefs.SetInt("habitat.sound", SoundEnabled ? 1 : 0);
                Emit(new GameAction { type = "settingsSound", skip = SoundEnabled });
                BuildSettings();
            }, SoundEnabled ? Green : Line, 0, 52);
            Button(modalBody, "背景音乐  " + (MusicEnabled ? "开启" : "关闭"), () =>
            {
                MusicEnabled = !MusicEnabled;
                PlayerPrefs.SetInt("habitat.music", MusicEnabled ? 1 : 0);
                Emit(new GameAction { type = "settingsMusic", skip = MusicEnabled });
                BuildSettings();
            }, MusicEnabled ? Green : Line, 0, 52);
            Section(modalBody, "本机进度");
            Small(modalBody, "每次成功行动后自动保存；关闭游戏后可继续。设置和成就独立保存。");
            Button(modalBody, "立即保存", () => Emit(new GameAction { type = "save" }), Gold).interactable = state != null;
        }

        void OpenHelp()
        {
            OpenModal("玩法说明", "help");
            Body(modalBody, "围绕中央守护塔，复苏五行生境。", 25, Green);
            Section(modalBody, "每一轮");
            Body(modalBody, "自由分配行动点：铺地、施法、刷新候选、铲除地块与移动守护灵，每次各消耗 1 行动。每轮可以多次铺地，也可以不铺地。\n行动用尽不会自动换轮。仍可使用结晶、升级土地或守护塔，准备好后点击结束本轮。", 18);
            Section(modalBody, "成长与评分");
            Body(modalBody, "灵力 = 全图属性和 × 0.5 + 守护塔投入结晶颗数 + 生态分。每株植物、每只动物各提供 1 生态分。元素灵、元素兽与守护灵通过产出和滋养帮助成长，不直接加分。\n峰值灵力每达到 500 的新阶段，行动上限从 3 提升到 5 / 7 / 9。同系列连片提高正向属性上限；升级可自动消耗普通与大型结晶补齐属性缺口，也可批量升级。", 18);
            Section(modalBody, "生命与守护");
            Body(modalBody, "同属性 3 个元素灵轮末自动合兽；同格 5 兽会自动合成守护灵，也可在详情中手动选择五兽配比。元素灵每 3 轮产普通结晶，元素兽每 2 轮产大型结晶。动物自动元素化并滋养土地。\n守护灵按配比在轮末滋养本格与四邻，不会自动移动；移动到已放置四邻每步 1 行动，可重复。中央塔的涌泉每轮滋养范围内土地，庇护抵御对应元素星雨。", 18);
            Section(modalBody, "结晶与陨星雨");
            Body(modalBody, "普通 +1，大型 +2，逆结晶 −1；批量使用可先预览最终属性。结晶不消耗行动点，每轮不限次数。普通与大型结晶还可混合制造元素盾，每 5 点防护覆盖 1 格。\n每 4 轮会触发预告的自然事件。元素星雨后获得对应至纯结晶，可使对应魔法覆盖范围永久 +4。全属性为负的地块会消散，属性不足也会使土地退化。", 18);
            Section(modalBody, "四十轮挑战与无尽模式");
            Body(modalBody, "挑战须在第 10 / 20 / 30 / 40 轮分别达到 500 / 1500 / 3000 / 6000 灵力。未达目标即挑战失败。守护塔周围初始地图有 84 块可建设土地，铺满后可转入无尽模式，继续向外扩建。也可以从主菜单直接开启无尽生境。", 18);
            Section(modalBody, "操作");
            Body(modalBody, "鼠标点选地块，拖动旋转，滚轮缩放。触屏点选，双指缩放与平移。选择卡片或移动操作后，按取消选择可返回浏览。", 18);
        }

        public void ShowCompletion()
        {
            if (state == null) return;
            OpenModal(state.result == "failed" ? "复苏挑战结束" : state.result == "won" ? "复苏挑战完成" : "初始生境完成", "completion");
            BuildCompletion();
        }

        void BuildCompletion()
        {
            Clear(modalBody);
            var score = Game.Score(state);
            Body(modalBody, state.result == "failed" ? "旅程暂歇" : state.result == "won" ? "四十轮复苏完成" : "初始生境已完成", 36, Green, TextAnchor.MiddleCenter);
            Body(modalBody, "最终灵力  " + ScoreNumber(score.total), 35, Ink, TextAnchor.MiddleCenter);
            Body(modalBody, "第 " + state.round + " 轮 · " + state.cells.Count + " 块土地", 20, Muted, TextAnchor.MiddleCenter);
            Body(modalBody, "属性 " + score.attrs + " ×0.5  +  塔 " + score.tower + "  +  生态 " + score.ecology, 18, Ink, TextAnchor.MiddleCenter);
            Body(modalBody, string.IsNullOrEmpty(state.endReason) ? MemoryCopy[10] : state.endReason, 20);
            Button(modalBody, "继续进入无尽生境", () => { CloseModal(); Emit(new GameAction { type = "enterEndless" }); }, Green, 0, 52).interactable = state.completedMap && state.result != "failed";
            Button(modalBody, "回望旅途回声", OpenEchoes, Gold, 0, 52);
            Button(modalBody, "回到生境", CloseModal, Line, 0, 48);
            Button(modalBody, "开启新的复苏挑战", () => RequestNewGame(false), Green, 0, 48);
        }

        void OpenModal(string title, string kind)
        {
            activeModal = kind;
            modal.gameObject.SetActive(true);
            modal.SetAsLastSibling();
            // Resource receipts and the pure-crystal reveal stay visible when a bag is reopened.
            // They never intercept input, so the dialog underneath remains fully interactive.
            if (feedbackHUD != null) feedbackHUD.BringToFront();
            var panel = (RectTransform)modal.GetChild(0);
            var heading = panel.Find("Dialog Title");
            if (heading == null) heading = Label(panel, title, 27, Ink, "Dialog Title").transform;
            heading.GetComponent<Text>().text = title;
            if (panel.Find("Close Dialog") == null) Button(panel, "关闭", CloseModal, Line).name = "Close Dialog";
            Clear(modalBody);
            Layout();
        }

        void RefreshModal()
        {
            switch (activeModal)
            {
                case "inventory": BuildInventory(); break;
                case "tower": BuildTower(); break;
                case "crystals": BuildCrystalBatch(); break;
                case "upgrades": BuildUpgradeBatch(); break;
                case "shield": BuildShield(); break;
                case "guardian": BuildGuardian(); break;
                case "atlas": BuildAtlas(); break;
                case "achievements": BuildAchievements(); break;
                case "echoes": BuildEchoes(); break;
                case "settings": BuildSettings(); break;
                case "completion": BuildCompletion(); break;
            }
        }

        public void CloseModal()
        {
            activeModal = null;
            if (modal != null) modal.gameObject.SetActive(false);
            RangePreviewChanged?.Invoke(Array.Empty<string>(), "water");
        }

        void Preview(Button button, Func<IEnumerable<string>> cells, string element)
        {
            var events = button.gameObject.AddComponent<EventTrigger>();
            var enter = new EventTrigger.Entry { eventID = EventTriggerType.PointerEnter };
            enter.callback.AddListener(_ => RangePreviewChanged?.Invoke(cells(), element));
            events.triggers.Add(enter);
            var leave = new EventTrigger.Entry { eventID = EventTriggerType.PointerExit };
            leave.callback.AddListener(_ => RangePreviewChanged?.Invoke(Array.Empty<string>(), element));
            events.triggers.Add(leave);
        }

        bool RequireGame()
        {
            if (state != null) return true;
            Body(modalBody, "开启一段新的旅程后，就可以在这里查看你的生境。", 21, Muted);
            return false;
        }

        void Emit(GameAction action)
        {
            if (action.type == "cast" || action.type.StartsWith("move", StringComparison.Ordinal) || action.type == "deployShield") SelectedOffer = -1;
            dispatch?.Invoke(action);
        }

        public void PresentAction(State before, State after, GameAction action, IList<GameEvent> events,
            Func<string, Vector3> cellScreenPosition, Func<GameEvent, float> effectDelay = null)
        {
            if (compact && action != null && action.type != "tutorial" && events != null && events.Count > 0)
            {
                // Keep the target and its feedback visible below the narrow detail sheet.
                // Selection remains available; tapping the terrain reveals the same details again.
                detailOpen = false;
                Layout();
            }
            if (feedbackHUD != null) feedbackHUD.PresentAction(before, after, action, events, cellScreenPosition, effectDelay);
        }

        public void ResetFeedback() { if (feedbackHUD != null) feedbackHUD.ResetFeedback(); }

        void RefreshFeedbackNumbers()
        {
            if (state == null || roundText == null || scoreText == null) return;
            int cellCount = feedbackHUD == null ? state.cells.Count : feedbackHUD.DisplayCells;
            double score = feedbackHUD == null ? Game.Score(state).total : feedbackHUD.DisplayScore;
            roundText.text = "第 " + state.round + (state.mode == "endless" ? " 轮 · 无尽" : "/40 轮") + "   行动 " + state.ap + "/" + state.roundAP + "   地块 " + cellCount + (state.mode == "endless" ? "" : "/84");
            scoreText.text = "灵力  " + ScoreNumber(score);
            if (bagButton != null) bagButton.GetComponentInChildren<Text>().text = "背包 " + (feedbackHUD == null ? Game.BagCount(state) : feedbackHUD.DisplayBag);
            foreach (var item in inventoryLabels.ToArray())
            {
                if (item.Key == null) { inventoryLabels.Remove(item.Key); continue; }
                var parts = item.Value.Split(':');
                var bag = parts[0] == "crystal" ? state.inv.crystal : parts[0] == "bigCrystal" ? state.inv.bigCrystal
                    : parts[0] == "pureCrystal" ? state.inv.pureCrystal : state.inv.inverseCrystal;
                int count = Count(bag, parts[1]);
                item.Key.text = parts[2] + " ×" + (feedbackHUD == null ? count : feedbackHUD.DisplayInventory(parts[0], parts[1], count)) + (parts.Length > 3 ? parts[3] : "");
            }
        }

        readonly Dictionary<Text, string> inventoryLabels = new Dictionary<Text, string>();
        void InventoryButton(RectTransform row, string copy, string kind, string element, ElementBag bag, Action clicked)
        {
            int count = Count(bag, element);
            var button = Button(row, copy + " ×" + (feedbackHUD == null ? count : feedbackHUD.DisplayInventory(kind, element, count)), clicked, Line);
            button.interactable = !state.over && count > 0;
            inventoryLabels[button.GetComponentInChildren<Text>()] = kind + ":" + element + ":" + copy;
        }

        int[] GlobalAttrs()
        {
            var result = new int[5];
            foreach (var tile in state.cells.Values) for (int i = 0; i < 5; i++) result[i] += tile.attrs[i];
            return result;
        }

        static string ScoreNumber(double value) { return value.ToString("0.#", System.Globalization.CultureInfo.InvariantCulture); }

        string ChallengeHint()
        {
            if (state == null) return "";
            var target = Game.Checkpoint(state);
            string goal = state.mode == "challenge" && target != null ? "目标 " + target.round + "轮 " + target.score : "无尽生境";
            if (compact || state.nextEvent == null) return goal;
            var weather = Game.EventForRound(state);
            int turns = 4 - (state.round - 1) % 4;
            return goal + " · " + turns + "轮后 " + (state.nextEvent.id == "meteor" ? ElementName(state.nextEvent.el) : "") + (weather == null ? "自然事件" : weather.name);
        }

        string WeatherHint()
        {
            if (state == null || state.nextEvent == null) return "每 4 轮会发生一次自然事件";
            var weather = Game.EventForRound(state);
            int turns = 4 - (state.round - 1) % 4;
            return turns + "轮后 " + (state.nextEvent.id == "meteor" ? ElementName(state.nextEvent.el) + "星雨" : weather == null ? "自然事件" : weather.name) + (state.nextEvent.id == "meteor" ? " 伤害" + Game.MeteorStrength(state).damage : "");
        }

        int Metric(string key)
        {
            if (state == null) return 0;
            if (state.stats.TryGetValue(key, out int result)) return result;
            switch (key)
            {
                case "tiles": return state.cells.Count;
                case "cluster": return state.cells.Count == 0 ? 0 : state.cells.Keys.Max(k => Game.Cluster(state, k).Count);
                case "peakScore": return (int)Math.Floor(state.peakScore);
                case "beastElements": return state.cells.Values.SelectMany(t => t.beasts).Select(b => b.el).Distinct().Count();
                case "plants": return state.cells.Values.Sum(t => t.plants.Count);
                case "visions": return state.visions.Count(v => v.done);
                case "clean": return Count(state.stats, "purified") > 0 && state.cells.Values.All(t => t.attrs.All(v => v >= 0) && t.cancers.Count == 0) ? 1 : 0;
                default: return 0;
            }
        }

        void ArchiveAchievements()
        {
            bool changed = false;
            var global = new HashSet<string>(PlayerPrefs.GetString("habitat.achievements", "").Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries));
            foreach (var achievement in Catalog.Achievements)
            {
                int progress = Mathf.Max(PlayerPrefs.GetInt("habitat.progress." + achievement.id, 0), Metric(achievement.metric));
                if (progress != PlayerPrefs.GetInt("habitat.progress." + achievement.id, 0))
                {
                    PlayerPrefs.SetInt("habitat.progress." + achievement.id, progress);
                    changed = true;
                }
                if (progress >= achievement.target && PlayerPrefs.GetInt("habitat.achievement." + achievement.id, 0) == 0)
                {
                    PlayerPrefs.SetInt("habitat.achievement." + achievement.id, 1);
                    global.Add(achievement.id);
                    changed = true;
                }
            }
            if (changed)
            {
                PlayerPrefs.SetString("habitat.achievements", string.Join(",", global.OrderBy(x => x)));
                PlayerPrefs.Save();
            }
        }

        void Progress(RectTransform parent, int value, int target, bool done)
        {
            var bar = Panel("Progress", parent, Line);
            bar.gameObject.AddComponent<LayoutElement>().preferredHeight = 10;
            var fill = Panel("Fill", bar, done ? Gold : Green);
            fill.anchorMin = Vector2.zero;
            fill.anchorMax = new Vector2(done ? 1 : Mathf.Clamp01((float)value / Mathf.Max(1, target)), 1);
            fill.offsetMin = Vector2.zero;
            fill.offsetMax = Vector2.zero;
            Small(parent, done ? "已完成" : Mathf.Min(value, target) + " / " + target);
        }

        RectTransform Rect(string name, Transform parent)
        {
            var item = new GameObject(name, typeof(RectTransform));
            item.transform.SetParent(parent, false);
            return item.GetComponent<RectTransform>();
        }

        RectTransform Panel(string name, Transform parent, Color color)
        {
            var rect = Rect(name, parent);
            var image = rect.gameObject.AddComponent<Image>();
            image.sprite = roundSprite;
            image.type = Image.Type.Sliced;
            image.color = color;
            image.raycastTarget = true;
            return rect;
        }

        RectTransform Overlay(string name, Transform parent)
        {
            var rect = Rect(name, parent);
            Inset(rect, 0, 0, 0, 0);
            var image = rect.gameObject.AddComponent<Image>();
            image.color = new Color(.13f, .22f, .18f, .56f);
            return rect;
        }

        RectTransform VerticalBody(RectTransform parent, int padding, bool preferred = false)
        {
            var body = Rect("Content", parent);
            if (preferred)
            {
                var contentLayout = parent.gameObject.AddComponent<VerticalLayoutGroup>();
                contentLayout.childControlHeight = true;
                contentLayout.childForceExpandHeight = false;
                contentLayout.childControlWidth = true;
                contentLayout.childForceExpandWidth = true;
                var element = parent.gameObject.AddComponent<LayoutElement>();
                element.flexibleWidth = 1;
            }
            else Inset(body, padding, padding, padding, padding);
            var layout = body.gameObject.AddComponent<VerticalLayoutGroup>();
            layout.spacing = 8;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            if (preferred) layout.padding = new RectOffset(padding, padding, padding, padding);
            return body;
        }

        RectTransform ScrollBody(RectTransform parent, string name, int top = 13)
        {
            var scroll = Rect(name, parent);
            Inset(scroll, 13, top, 13, 13);
            var scrollRect = scroll.gameObject.AddComponent<ScrollRect>();
            scrollRect.horizontal = false;
            scrollRect.movementType = ScrollRect.MovementType.Clamped;
            scrollRect.scrollSensitivity = 35;
            var viewport = Rect("Viewport", scroll);
            Inset(viewport, 0, 0, 0, 0);
            viewport.gameObject.AddComponent<RectMask2D>();
            var viewportImage = viewport.gameObject.AddComponent<Image>();
            viewportImage.color = new Color(1, 1, 1, .005f);
            var content = Rect("Content", viewport);
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = Vector2.one;
            content.pivot = new Vector2(.5f, 1);
            content.anchoredPosition = Vector2.zero;
            content.sizeDelta = Vector2.zero;
            var layout = content.gameObject.AddComponent<VerticalLayoutGroup>();
            layout.spacing = 9;
            layout.padding = new RectOffset(3, 6, 3, 12);
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            var fitter = content.gameObject.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            scrollRect.viewport = viewport;
            scrollRect.content = content;
            return content;
        }

        RectTransform Row(RectTransform parent, float height = 42)
        {
            var row = Rect("Row", parent);
            Horizontal(row, 7);
            var layout = row.gameObject.AddComponent<LayoutElement>();
            layout.preferredHeight = height;
            layout.minHeight = height;
            return row;
        }

        static void Horizontal(RectTransform target, int spacing)
        {
            var layout = target.gameObject.AddComponent<HorizontalLayoutGroup>();
            layout.spacing = spacing;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = true;
        }

        Text Label(Transform parent, string copy, int size, Color color, string name = null, float flex = 0, float width = 0)
        {
            var rect = Rect(name ?? "Text", parent);
            var text = rect.gameObject.AddComponent<Text>();
            text.font = font;
            text.fontSize = size;
            text.color = color;
            text.text = copy ?? "";
            text.supportRichText = true;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.alignment = TextAnchor.MiddleLeft;
            text.raycastTarget = false;
            text.lineSpacing = 1.12f;
            if (flex > 0 || width > 0)
            {
                var layout = rect.gameObject.AddComponent<LayoutElement>();
                layout.flexibleWidth = flex;
                if (width > 0) layout.preferredWidth = width;
            }
            return text;
        }

        Text Body(RectTransform parent, string copy, int size = 18, Color? color = null, TextAnchor alignment = TextAnchor.MiddleLeft)
        {
            var text = Label(parent, copy, size, color ?? Ink);
            text.alignment = alignment;
            var layout = text.gameObject.AddComponent<LayoutElement>();
            layout.minHeight = size + 10;
            return text;
        }

        void Small(RectTransform parent, string copy, TextAnchor alignment = TextAnchor.MiddleLeft) { Body(parent, copy, 15, Muted, alignment); }

        void Section(RectTransform parent, string title)
        {
            var text = Body(parent, title, 21, Green);
            text.gameObject.GetComponent<LayoutElement>().minHeight = 42;
        }

        Button Button(Transform parent, string copy, Action clicked, Color color, float width = 0, float height = 42)
        {
            var rect = Panel("Button " + copy, parent, color);
            var button = rect.gameObject.AddComponent<Button>();
            var colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1.06f, 1.06f, 1.03f);
            colors.pressedColor = new Color(.85f, .9f, .84f);
            colors.selectedColor = Color.white;
            colors.disabledColor = new Color(.8f, .81f, .76f, .5f);
            button.colors = colors;
            rect.gameObject.AddComponent<HabitatButtonMotion>().Initialize(() => ReducedMotion);
            button.onClick.AddListener(() => clicked?.Invoke());
            var layout = rect.gameObject.AddComponent<LayoutElement>();
            layout.preferredHeight = height;
            layout.minHeight = Mathf.Min(height, 42);
            if (width > 0) { layout.preferredWidth = width; layout.flexibleWidth = 0; }
            else layout.flexibleWidth = 1;
            var text = Label(rect, copy, 17, color == Green ? Color.white : Ink);
            text.alignment = TextAnchor.MiddleCenter;
            text.resizeTextForBestFit = true;
            text.resizeTextMinSize = 12;
            text.resizeTextMaxSize = 18;
            text.verticalOverflow = VerticalWrapMode.Truncate;
            Inset(text.rectTransform, 9, 4, 9, 4);
            return button;
        }

        static void Place(RectTransform target, float x, float y, float width, float height)
        {
            target.anchorMin = new Vector2(0, 1);
            target.anchorMax = new Vector2(0, 1);
            target.pivot = new Vector2(0, 1);
            target.anchoredPosition = new Vector2(x, -y);
            target.sizeDelta = new Vector2(Mathf.Max(0, width), Mathf.Max(0, height));
        }

        static void Inset(RectTransform target, float left, float top, float right, float bottom)
        {
            target.anchorMin = Vector2.zero;
            target.anchorMax = Vector2.one;
            target.offsetMin = new Vector2(left, bottom);
            target.offsetMax = new Vector2(-right, -top);
        }

        static void Clear(Transform parent)
        {
            for (int i = parent.childCount - 1; i >= 0; i--)
            {
                var child = parent.GetChild(i).gameObject;
                child.SetActive(false);
                Destroy(child);
            }
        }

        static int Count(IDictionary<string, int> values, string key) { return values != null && key != null && values.TryGetValue(key, out int value) ? value : 0; }
        static bool Used(IDictionary<string, bool> values, string key) { return values != null && values.TryGetValue(key, out bool value) && value; }
        static Color Hex(string value) { ColorUtility.TryParseHtmlString("#" + value.TrimStart('#'), out var color); return color; }
        static string ElementName(string key) { int index = Array.IndexOf(ElementKeys, key); return index >= 0 ? ElementNames[index] : ""; }
        static Color ElementColor(string key) { int index = Array.IndexOf(ElementKeys, key); return index >= 0 ? Hex(ElementColors[index]) : Ink; }
        static string ColoredAttrs(int[] values, bool showValue = true)
        {
            return string.Join("   ", Enumerable.Range(0, 5).Select(i => "<color=#" + ElementColors[i] + ">" + ElementNames[i] + (showValue ? " " + values[i] : "") + "</color>"));
        }
        static string BagText(IDictionary<string, int> values) { return string.Join(" · ", ElementKeys.Where(k => Count(values, k) > 0).Select(k => ElementName(k) + " " + Count(values, k))); }

        static Color TerrainTint(string family, string look)
        {
            switch (family ?? look)
            {
                case "woodland": case "forest": return Hex("D9E9C9");
                case "ice": return Hex("DDEDF0");
                case "ocean": case "water": return Hex("D0E6ED");
                case "river": case "valley": return Hex("D8ECE1");
                case "wetland": return Hex("D5E9D6");
                case "desert": case "sand": return Hex("F1DEAD");
                case "volcano": case "lava": return Hex("F1D5BB");
                case "mine": return Hex("E4DFC9");
                case "ruins": case "ruin": return Hex("E5E3D5");
                default: return Hex("E2ECCB");
            }
        }

        static string UnitName(string key)
        {
            switch (key)
            {
                case "grass": return "草"; case "shrub": return "灌木"; case "tree": return "树"; case "weed": return "水草"; case "crop": return "水稻";
                case "wheat": return "小麦"; case "corn": return "玉米"; case "rabbit": return "兔子"; case "fish": return "鱼"; case "bird": return "鸟";
                case "bear": return "熊"; case "deer": return "鹿"; case "leopard": return "豹子"; case "cow": return "牛"; case "sheep": return "羊";
                default: return key;
            }
        }

        static Sprite RoundedSprite()
        {
            const int size = 32, radius = 9;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false) { name = "Habitat Rounded Panel", filterMode = FilterMode.Bilinear };
            var pixels = new Color[size * size];
            for (int y = 0; y < size; y++) for (int x = 0; x < size; x++)
            {
                float cx = Mathf.Clamp(x, radius, size - radius - 1), cy = Mathf.Clamp(y, radius, size - radius - 1);
                float distance = Vector2.Distance(new Vector2(x, y), new Vector2(cx, cy));
                pixels[y * size + x] = new Color(1, 1, 1, Mathf.Clamp01(radius - distance + .5f));
            }
            texture.SetPixels(pixels);
            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(.5f, .5f), 100, 0, SpriteMeshType.FullRect, new Vector4(radius, radius, radius, radius));
        }

        void OnDestroy()
        {
            ResetFeedback();
            if (roundSprite != null) { Destroy(roundSprite.texture); Destroy(roundSprite); }
        }
    }
}
