using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace ElementHabitat
{
    /// <summary>CSS-pixel widgets following the published browser interface.</summary>
    public sealed partial class HabitatUI
    {
        Sprite capsuleSprite, circleSprite, paperSprite;
        RectTransform formulaHud, stageHud, roundPill, apPill, scorePill, leftPill, cornerL;
        RectTransform offerTray, magicTray, magicButtons, apGems, bagDrawer, bagBody, tooltip;
        Text leftText, bagBadge, goalText, tooltipText, apText;
        Button rerollButton;
        RectTransform goalFill;
        readonly Dictionary<string, Button> magicWidgets = new Dictionary<string, Button>();
        string pendingKind, pendingMagic, pendingElement;
        bool pendingBig, pendingInverse, tutorialCollapsed;
        float hintUntil;
        string hintCopy;
        bool layoutCompact;
        public bool HasBlockingModal { get { return IsMenuOpen || (modal != null && modal.gameObject.activeSelf); } }
        public bool InventoryOpen { get { return bagDrawer != null && bagDrawer.gameObject.activeSelf; } }
        public bool WantsKeyboardInput
        {
            get { var obj = EventSystem.current == null ? null : EventSystem.current.currentSelectedGameObject; return obj != null && obj.GetComponentInParent<InputField>() != null; }
        }
        public void ToggleInventory() { if (InventoryOpen) CloseModal(); else OpenInventory(); Layout(); }
        public bool TryHandleEscape()
        {
            if (!string.IsNullOrEmpty(activeModal)) { CloseModal(); Layout(); return true; }
            if (IsMenuOpen) { if (hasPlayed) HideMainMenu(); Layout(); return true; }
            return false;
        }
        public void SetPendingAction(GameAction action)
        {
            pendingKind = action == null ? null : action.type; pendingMagic = action == null ? null : action.magic;
            pendingElement = action == null ? null : action.el; pendingBig = action != null && action.big; pendingInverse = action != null && action.inverse;
            UpdateMagicStates();
        }
        public void ShowHover(string cell, Vector2 screenPosition)
        {
            if (tooltip == null) return;
            if (compact || HasBlockingModal || string.IsNullOrEmpty(cell) || state == null || !state.cells.TryGetValue(cell, out var tile)) { tooltip.gameObject.SetActive(false); return; }
            tooltipText.text = Catalog.Types[tile.type].name + " · 属性和 " + tile.attrs.Sum() + "\n" + ColoredAttrs(tile.attrs) + "\n连片 ×" + Game.Cluster(state,cell).Count + " · 上限 " + Game.AttrCap(state,cell);
            float width = Mathf.Min(root.rect.width - 20, Mathf.Max(180, tooltipText.preferredWidth + 24));
            Place(tooltip, Mathf.Clamp(screenPosition.x + 14, 8, root.rect.width - width - 8), Mathf.Clamp(root.rect.height - screenPosition.y + 18, 8, root.rect.height - 76), width, 66);
            tooltip.gameObject.SetActive(true); tooltip.SetAsLastSibling();
        }
        void BuildWebChrome()
        {
            capsuleSprite = ShapeSprite(64,20); circleSprite = ShapeSprite(64,32); paperSprite=ShapeSprite(64,14,true);
            hud = Rect("HUD", root);
            roundPill = Pill("Round Pill", hud, "轮次", "hourglass", Hex("3B8CF0"), out roundText);
            apPill = Panel("Action Points Pill", hud, new Color(.08f,.12f,.2f,.55f)); apPill.GetComponent<Image>().sprite=capsuleSprite; Edge(apPill, new Color(1,1,1,.35f), 2);
            apGems = Rect("Action Gems", apPill); apText = Label(apPill, "", 12, Color.white, "Action Points"); apText.fontStyle = FontStyle.Bold;
            scorePill = Pill("Score Pill", hud, "灵力", "star", Gold, out scoreText);
            scorePill.gameObject.AddComponent<Button>().onClick.AddListener(() => { OpenModal("灵力与挑战目标", "score"); BuildScoreDetail(); });
            leftPill = Pill("Empty Cells Pill", hud, "空位", "hex", Green, out leftText);
            formulaHud = Panel("Score Formula Panel", root, new Color(.153f,.133f,.235f,.87f)); formulaHud.GetComponent<Image>().raycastTarget = false; Edge(formulaHud, new Color(.83f,.81f,.95f,.5f), 1);
            formulaText = Label(formulaHud, "", 21, Hex("F6F3FF"), "Score Formula"); formulaText.fontStyle = FontStyle.Bold; formulaText.alignment = TextAnchor.MiddleCenter;
            goalText = Label(formulaHud, "", 13, Hex("E9D997"), "Challenge Goal"); goalText.alignment = TextAnchor.MiddleCenter;
            var goalBar = Panel("Goal Track", formulaHud, Hex("625D51")); goalFill = Panel("Goal Progress", goalBar, Hex("A7D780")); goalBar.GetComponent<Image>().raycastTarget = goalFill.GetComponent<Image>().raycastTarget = false;
            stageHud = Panel("Stage and Weather", root, new Color(.11f,.18f,.25f,.6f)); stageHud.GetComponent<Image>().raycastTarget = false; stageHud.GetComponent<Image>().sprite=capsuleSprite;
            weatherText = Label(stageHud, "", 12, Color.white, "Weather Forecast"); weatherText.alignment = TextAnchor.MiddleCenter;
            attrsText = Label(stageHud, "", 12, Color.white, "Elements"); attrsText.alignment = TextAnchor.MiddleCenter;
            cornerL = Rect("Help Corner", root); var helpButton=Button(cornerL, "?", OpenHelp, Hex("3B8CF0")); helpButton.GetComponent<Image>().sprite=circleSprite; helpButton.GetComponentInChildren<Text>().fontSize=20; helpButton.GetComponentInChildren<Text>().resizeTextForBestFit=false;
            toolbar = Rect("Toolbar", root); bagButton = Button(toolbar, "", ToggleInventory, Gold); bagButton.name = "Bag Button"; bagButton.GetComponent<Image>().sprite=circleSprite; Icon(bagButton.transform, "bag", Hex("EC5845"), 23);
            var badge = Panel("Badge Background", bagButton.transform, Hex("EC5845")); badge.GetComponent<Image>().sprite=circleSprite; Place(badge, 27, -7, 23, 23); Edge(badge, Color.white, 2);
            bagBadge = Label(bagButton.transform, "0", 11, Color.white, "Bag Count"); Place(bagBadge.rectTransform, 27, -7, 23, 23); bagBadge.alignment = TextAnchor.MiddleCenter; bagBadge.fontStyle = FontStyle.Bold;
            var menuButton = Button(toolbar, "", () => Emit(new GameAction { type = "mainMenu" }), Hex("3B8CF0")); menuButton.name = "Menu Button"; menuButton.GetComponent<Image>().sprite=circleSprite; Icon(menuButton.transform, "menu", Color.white, 21);
            dock = Rect("Placement Cards", root); offerTray = Paper("Offer Tray", dock, Cream);
            dockTitle = Label(Tag(offerTray, "", Hex("3B8CF0")), "", 12, Color.white, "Offer Title"); Inset(dockTitle.rectTransform, 7, 1, 7, 1);
            cards = Rect("Three Offers", offerTray); Horizontal(cards, 10);
            rerollButton = Button(offerTray, "刷新 · 1 AP", () => Emit(new GameAction { type = "reroll" }), Hex("3B8CF0"), 76, 23); rerollButton.name = "Refresh Offers";
            magicTray = Paper("Magic Tray", dock, Cream); Tag(magicTray, "魔法", Hex("A46CF0")); magicButtons = Rect("Five Magics", magicTray); Horizontal(magicButtons, 8);
            endButton = Button(dock, "结束本轮 ▶", () => { SelectedOffer = -1; Emit(new GameAction { type = "endRound" }); }, Green); endButton.name = "End Round";
            status = Panel("Status", root, Hex("2B6FD6")); status.GetComponent<Image>().raycastTarget = false; Edge(status, Color.white, 2);
            statusText = Label(status, "", 14, Color.white, "Status Text"); statusText.alignment = TextAnchor.MiddleCenter;
        }
        RectTransform Pill(string name, Transform parent, string title, string icon, Color tint, out Text number)
        {
            var pill = Panel(name, parent, new Color(.08f,.12f,.2f,.55f)); pill.GetComponent<Image>().sprite=capsuleSprite; Edge(pill, new Color(1,1,1,.35f), 2);
            var circle = Panel("Icon Circle", pill, tint); circle.GetComponent<Image>().sprite=circleSprite; Edge(circle, Color.white, 2); Place(circle, 5, 3, 32, 32); Icon(circle, icon, Color.white, 23);
            var caption = Label(pill, title, 10, Color.white, "Caption"); caption.fontStyle = FontStyle.Bold;
            number = Label(pill, "", 18, Color.white, "Value"); number.fontStyle = FontStyle.Bold; return pill;
        }

        void LayoutWeb()
        {
            if (root == null) return;
            canvas.scaleFactor = 1;
            var size = canvas.pixelRect.size;
            if (size.x <= 0 || size.y <= 0) size = new Vector2(Screen.width, Screen.height);
            float w = size.x, h = size.y; compact = w <= 760;
            bool changed = layoutCompact != compact; layoutCompact = compact;
            bool preview = false;
            bool tileDetail = detailOpen && state != null && ((!string.IsNullOrEmpty(selected) && state.cells.ContainsKey(selected)) || preview);
            bool shown = !photoMode;
            hud.gameObject.SetActive(shown); formulaHud.gameObject.SetActive(false);
            stageHud.gameObject.SetActive(shown); toolbar.gameObject.SetActive(shown); cornerL.gameObject.SetActive(shown && !compact);
            dock.gameObject.SetActive(shown);
            detail.gameObject.SetActive(tileDetail && !IsMenuOpen && (!photoMode || photoInspection));
            tutorial.gameObject.SetActive(shown && !tileDetail && !(compact && InventoryOpen) && state != null && state.journey != null && !state.journey.skipped && !state.over);
            bagDrawer.gameObject.SetActive(shown && activeModal == "inventory");
            status.gameObject.SetActive(shown && Time.unscaledTime < hintUntil); photoBar.gameObject.SetActive(photoMode);
            float pillHeight = compact ? 34 : 40;
            int maxAP = state == null ? 3 : state.roundAP;
            float apWidth = compact ? 39 : 24 + maxAP * 24 - 4;
            float roundWidth = compact ? 70 : 104, scoreWidth = compact ? 63 : 87, leftWidth = compact ? 59 : 86;
            float topWidth = roundWidth + apWidth + scoreWidth + leftWidth + (compact ? 12 : 30);
            Place(hud, compact ? 8 : (w - topWidth) * .5f, 10, topWidth, pillHeight);
            Place(roundPill, 0, 0, roundWidth, pillHeight); Place(apPill, roundWidth + (compact ? 4 : 10), 0, apWidth, pillHeight);
            Place(scorePill, roundWidth + apWidth + (compact ? 8 : 20), 0, scoreWidth, pillHeight);
            Place(leftPill, topWidth - leftWidth, 0, leftWidth, pillHeight); leftPill.gameObject.SetActive(true);
            LayoutPill(roundPill, roundWidth); LayoutPill(scorePill, scoreWidth); LayoutPill(leftPill, leftWidth);
            apGems.gameObject.SetActive(!compact); apText.gameObject.SetActive(compact);
            Inset(apGems, 12, 6, 12, 6); Inset(apText.rectTransform, 3, 0, 3, 0); apText.alignment = TextAnchor.MiddleCenter;
            Place(cornerL, 12, 10, 44, 44); Place((RectTransform)cornerL.GetChild(0), 0, 0, 44, 44);
            float cornerSize = compact ? 38 : 44;
            Place(toolbar, w - (compact ? 8 : 12) - cornerSize * 2 - 8, 10, cornerSize * 2 + 8, cornerSize);
            Place((RectTransform)bagButton.transform, 0, 0, cornerSize, cornerSize); Place((RectTransform)toolbar.GetChild(1), cornerSize + 8, 0, cornerSize, cornerSize);
            Place(bagBadge.rectTransform, cornerSize - 17, -7, 23, 23);
            var badge = bagButton.transform.Find("Badge Background"); if (badge != null) Place((RectTransform)badge, cornerSize - 17, -7, 23, 23);
            float formulaWidth = Mathf.Min(780, w - 24), formulaHeight = compact ? 72 : 86;
            Place(formulaHud, (w - formulaWidth) * .5f, compact ? 52 : 62, formulaWidth, formulaHeight);
            formulaText.fontSize = compact ? 15 : 21; goalText.fontSize = compact ? 11 : 13;
            Place(formulaText.rectTransform, 10, 8, formulaWidth - 20, compact ? 23 : 30); Place(goalText.rectTransform, 10, compact ? 33 : 42, formulaWidth - 20, 19);
            Place((RectTransform)goalFill.parent, 10, formulaHeight - 16, formulaWidth - 20, 3);
            weatherText.fontSize = compact ? 10 : 11; attrsText.fontSize = compact ? 10 : 11;
            float stageWidth = compact ? Mathf.Min(w-16,Mathf.Max(170,weatherText.preferredWidth+16)) : Mathf.Min(w-24,Mathf.Max(268,weatherText.preferredWidth+attrsText.preferredWidth+36));
            Place(stageHud, (w - stageWidth) * .5f, 57, stageWidth, compact ? 36 : 24);
            weatherText.fontSize = compact ? 10 : 11; attrsText.fontSize = compact ? 10 : 11;
            float attrsWidth = attrsText.preferredWidth + 12;
            Place(weatherText.rectTransform, 6, 1, compact ? stageWidth-12 : stageWidth-attrsWidth-12, compact ? 18 : 21);
            Place(attrsText.rectTransform,compact ? 6 : stageWidth-attrsWidth-6,compact ? 18 : 2,compact ? stageWidth-12 : attrsWidth,compact ? 16 : 18);
            float dockHeight = compact ? 218 : 154, dockWidth = compact ? w - 16 : Mathf.Min(836,w-24);
            Place(dock, compact ? 8 : (w - dockWidth) * .5f, h - dockHeight - 10, dockWidth, dockHeight);
            Place(offerTray, 0, 0, compact ? dockWidth : 336, compact ? 124 : 154);
            Place((RectTransform)dockTitle.transform.parent, 14, -11, 74, 25);
            Place(rerollButton.GetComponent<RectTransform>(), (compact ? dockWidth : 336) - 86, -10, 76, 23); rerollButton.interactable = state != null && !state.over && state.ap > 0;
            Place(cards, 12, 16, (compact ? dockWidth : 336) - 24, compact ? 96 : 120); cards.GetComponent<HorizontalLayoutGroup>().spacing = compact ? 6 : 10;
            Place(magicTray, compact ? 0 : 350, compact ? 136 : 54, compact ? dockWidth - 130 : 350, compact ? 82 : 100);
            Place(magicButtons, compact ? 8 : 12, 18, (compact ? dockWidth - 130 : 350) - (compact ? 16 : 24), compact ? 56 : 66); magicButtons.GetComponent<HorizontalLayoutGroup>().spacing = compact ? 5 : 8;
            Place(endButton.GetComponent<RectTransform>(), compact ? dockWidth - 116 : 714, compact ? 157 : 105, compact ? 116 : 122, compact ? 61 : 49);
            float hintWidth = Mathf.Min(w-24,Mathf.Max(120,Mathf.Min(580,statusText.preferredWidth+40)));
            Place(status,(w-hintWidth)*.5f,compact ? h-294 : 64,hintWidth,35); Inset(statusText.rectTransform, 10, 5, 10, 5);
            float detailWidth = compact ? w - 16 : 280;
            LayoutRebuilder.ForceRebuildLayoutImmediate(detailBody);
            float detailHeight = Mathf.Min(compact ? h*.3f : h-260, Mathf.Max(160,detailBody.rect.height+16));
            Place(detail, compact ? 8 : 12, compact ? h-250-detailHeight : 64, detailWidth, detailHeight);
            float journeyWidth = compact ? w - 20 : 280; Place(tutorial,compact ? 10 : 18,compact ? 103 : 110,journeyWidth,210);
            LayoutRebuilder.ForceRebuildLayoutImmediate(tutorialBody);float journeyHeight=Mathf.Min(compact ? 170 : 230,Mathf.Max(45,LayoutUtility.GetPreferredHeight(tutorialBody)+28));
            Place(tutorial,compact ? 10 : 18,compact ? 103 : 110,journeyWidth,journeyHeight);
            Place(bagDrawer,compact ? 8 : w-272,64,compact ? w-16 : 260,Mathf.Max(140,h-(compact ? 330 : 290)));
            LayoutRebuilder.ForceRebuildLayoutImmediate(bagBody);float bagHeight=Mathf.Min(Mathf.Max(140,h-(compact ? 330 : 290)),Mathf.Max(140,LayoutUtility.GetPreferredHeight(bagBody)+38));
            Place(bagDrawer,compact ? 8 : w-272,64,compact ? w-16 : 260,bagHeight);
            var menuPanel = (RectTransform)menu.GetChild(0); float menuWidth = Mathf.Min(440,w-32), menuHeight = Mathf.Min(600,h-36);
            Place(menuPanel,(w-menuWidth)*.5f,(h-menuHeight)*.5f,menuWidth,menuHeight);
            LayoutRebuilder.ForceRebuildLayoutImmediate(menuBody);menuHeight=Mathf.Min(h-36,Mathf.Max(320,menuBody.rect.height+36));Place(menuPanel,(w-menuWidth)*.5f,(h-menuHeight)*.5f,menuWidth,menuHeight);
            var menuClose=menuPanel.Find("Close Menu");if(menuClose!=null)Place((RectTransform)menuClose,menuWidth-48,10,34,34);
            var modalPanel = (RectTransform)modal.GetChild(0); float modalWidth = Mathf.Min(activeModal=="atlas"||activeModal=="upgrades" ? 680 : 440,w-32),modalHeight=Mathf.Min(720,h-36);
            Place(modalPanel,(w-modalWidth)*.5f,(h-modalHeight)*.5f,modalWidth,modalHeight);
            var close=modalPanel.Find("Close Dialog");if(close!=null)Place((RectTransform)close,modalWidth-47,8,38,38);
            var title=modalPanel.Find("Dialog Title");if(title!=null){title.GetComponent<Text>().fontSize=22;Place((RectTransform)title,22,16,modalWidth-75,34);}
            float photoWidth=Mathf.Min(600,w-20);Place(photoBar,(w-photoWidth)*.5f,h-94,photoWidth,78);
            Place((RectTransform)photoBar.GetChild(0),10,8,photoWidth-20,36);Place((RectTransform)photoBar.GetChild(1),10,50,photoWidth-20,20);
            if(changed&&state!=null){BuildWebOffers();BuildMagics();BuildTutorial();}lastSize=size;
        }
        void LayoutPill(RectTransform pill,float width)
        {
            var circle=pill.Find("Icon Circle");var caption=pill.Find("Caption");var value=pill.Find("Value");
            caption.gameObject.SetActive(!compact);circle.gameObject.SetActive(true);
            Place((RectTransform)circle,compact ? 3 : 5,compact ? 4 : 3,compact ? 24 : 32,compact ? 24 : 32);
            var icon=(RectTransform)circle.GetChild(0);icon.sizeDelta=Vector2.one*(compact ? 17 : 23);
            value.GetComponent<Text>().fontSize=compact ? 12 : 18;value.GetComponent<Text>().alignment=TextAnchor.MiddleLeft;
            Place((RectTransform)caption,44,4,width-48,11);Place((RectTransform)value,compact ? 30 : 44,compact ? 0 : 14,compact ? width-32 : width-48,compact ? 34 : 23);
        }
        void UpdateWebNumbers()
        {
            if(state==null)return;var sc=Game.Score(state);var goal=Game.Checkpoint(state);
            formulaText.text="灵力 "+ScoreNumber(sc.total)+" = 属性 "+sc.attrs+" × 0.5 + 守护塔 "+sc.tower+" + 生态 "+sc.ecology;
            goalText.text=state.over?state.endReason:state.mode=="endless"?"无尽模式 · 初始地图"+(state.completedMap?"已完成":"待复苏"):goal==null?"":"第 "+goal.round+" 轮目标 "+goal.score+" · 尚需 "+ScoreNumber(Math.Max(0,goal.score-sc.total))+" 灵力";
            goalFill.anchorMin=Vector2.zero;goalFill.anchorMax=new Vector2(Mathf.Clamp01((float)(sc.total/(goal==null?6000:goal.score))),1);goalFill.offsetMin=goalFill.offsetMax=Vector2.zero;
            weatherText.text="阶段 "+Game.Stage(state)+" · 行动 "+state.ap+"/"+state.roundAP+" · "+WeatherHint();attrsText.text=ColoredAttrs(GlobalAttrs());apText.text=state.ap+"/"+state.roundAP;
            Clear(apGems);
            for(int i=0;i<state.roundAP;i++){var gem=Icon(apGems,"crystal",i<state.ap?Hex("47C4FF"):Hex("52565F"),26);Place(gem,i*24,i<state.ap?0:3,20,i<state.ap?26:20);}
            if(message!=hintCopy){hintCopy=message;hintUntil=Time.unscaledTime+2.8f;}
        }

        void BuildWebOffers()
        {
            if(state==null)return;
            string key=state.round+":"+string.Join(",",state.offers);bool fresh=key!=offersKey&&state.offers.Count>=3;offersKey=key;
            Clear(cards);offerButtons.Clear();
            for(int i=0;i<state.offers.Count;i++)
            {
                int index=i;var type=Catalog.Types[state.offers[i]];
                var card=Button(cards,"",()=>Emit(new GameAction {type="selectOffer",offer=index}),FamilyColor(type.family));
                card.name="Offer "+(index+1)+" "+type.id;card.interactable=!state.over&&state.ap>0;
                var layout=card.GetComponent<LayoutElement>();layout.preferredWidth=96;layout.flexibleWidth=compact?1:0;
                card.GetComponent<HabitatButtonMotion>().SetCard(i==SelectedOffer,fresh,i*.09f);
                card.GetComponentInChildren<Text>().gameObject.SetActive(false);card.gameObject.AddComponent<Mask>().showMaskGraphic=true;
                var art=Rect("Terrain Illustration",card.transform);Inset(art,0,0,0,0);var illustration=art.gameObject.AddComponent<HabitatWebGraphic>();illustration.Kind="terrain";illustration.Family=type.family;illustration.color=Color.white;illustration.raycastTarget=false;
                var name=Label(card.transform,type.name+" · T"+type.level,compact?13:14,Color.white,"Card Name");name.fontStyle=FontStyle.Bold;name.alignment=TextAnchor.MiddleCenter;TextOutline(name);
                name.rectTransform.anchorMin=new Vector2(0,0);name.rectTransform.anchorMax=new Vector2(1,0);name.rectTransform.pivot=new Vector2(.5f,0);name.rectTransform.anchoredPosition=new Vector2(0,27);name.rectTransform.sizeDelta=new Vector2(-4,21);
                var gems=Panel("Attribute Gems",card.transform,new Color(0,0,0,.3f));gems.GetComponent<Image>().raycastTarget=false;gems.anchorMin=Vector2.zero;gems.anchorMax=new Vector2(1,0);gems.pivot=new Vector2(.5f,0);gems.anchoredPosition=Vector2.zero;gems.sizeDelta=new Vector2(0,27);
                Horizontal(gems,2);gems.GetComponent<HorizontalLayoutGroup>().padding=new RectOffset(5,5,4,5);
                for(int n=0;n<5;n++)
                {
                    int value=type.attrs[n];var g=Panel("Gem "+ElementKeys[n],gems,value<0?Hex("FF5A4A"):Hex(ElementColors[n]));g.GetComponent<Image>().raycastTarget=false;Edge(g,new Color(1,1,1,.8f),1);
                    if(value==0)g.GetComponent<Image>().color=new Color(.5f,.5f,.5f,.45f);
                    var number=Label(g,value.ToString(),11,Color.white);number.fontStyle=FontStyle.Bold;number.alignment=TextAnchor.MiddleCenter;Inset(number.rectTransform,0,0,0,0);TextOutline(number);
                }
                if(i==SelectedOffer)Edge(card.GetComponent<RectTransform>(),Gold,3);offerButtons.Add(card);
            }
        }
        void BuildMagics()
        {
            if(state==null)return;Clear(magicButtons);magicWidgets.Clear();
            foreach(var magic in Catalog.Magics)
            {
                string id=magic.id;var tint=id=="purify"?Hex("8FD8FF"):ElementColor(magic.element);
                var button=Button(magicButtons,"",()=>Emit(new GameAction{type="cast",magic=id}),tint);button.name="Magic "+id;button.GetComponent<LayoutElement>().preferredWidth=58;
                var label=button.GetComponentInChildren<Text>();label.text=magic.name;label.fontSize=11;label.resizeTextForBestFit=false;label.color=Color.white;TextOutline(label);Inset(label.rectTransform,0,compact?30:36,0,2);
                var symbol=Icon(button.transform,"magic-"+id,Color.white,compact?20:24);symbol.anchorMin=new Vector2(.5f,1);symbol.anchorMax=symbol.anchorMin;symbol.pivot=new Vector2(.5f,1);symbol.anchoredPosition=new Vector2(0,-9);
                bool unlocked=Game.MagicUnlocked(state,id),used=Used(state.magicUsed,id);
                var badge=Label(button.transform,used?"已用":unlocked?"":"锁",9,Hex("5A4220"),"Magic State");Place(badge.rectTransform,28,-6,25,18);
                Preview(button,()=>string.IsNullOrEmpty(selected)||!state.cells.ContainsKey(selected)?new List<string>():Game.MagicArea(state,selected,id),magic.element);
                magicWidgets[id]=button;
            }
            UpdateMagicStates();
        }
        void UpdateMagicStates()
        {
            if(state==null)return;
            foreach(var pair in magicWidgets)
            {
                pair.Value.interactable=!state.over&&state.ap>0&&Game.MagicUnlocked(state,pair.Key)&&!Used(state.magicUsed,pair.Key);
                bool on=pendingKind=="cast"&&pendingMagic==pair.Key;pair.Value.GetComponent<HabitatButtonMotion>()?.SetSelected(on);
                var outline=pair.Value.GetComponents<Outline>().FirstOrDefault();if(outline!=null)outline.effectColor=on?Gold:new Color(0,0,0,.25f);
            }
        }
        void BuildWebDetail()
        {
            Clear(detailBody);if(state==null||string.IsNullOrEmpty(selected)||!state.cells.TryGetValue(selected,out var tile))return;
            var type=Catalog.Types[tile.type];int cap=Game.AttrCap(state,selected);
            var header=Panel("Terrain Detail Header",detailBody,FamilyColor(type.family));header.gameObject.AddComponent<LayoutElement>().preferredHeight=105;
            var heading=Label(header,type.name,20,Color.white);heading.fontStyle=FontStyle.Bold;Place(heading.rectTransform,10,5,210,30);TextOutline(heading);
            var subtitle=Label(header,"元素灵 "+tile.spirits.Count+"/"+Game.SpiritCap(tile)+"\n同属性3灵轮末自动合兽 · 免费\n连片 "+Game.Cluster(state,selected).Count+" 格 · 属性上限 "+cap,12,Color.white);Place(subtitle.rectTransform,10,35,230,62);
            var close=Button(header,"×",()=>{detailOpen=false;Layout();},Hex("FF5A4A"),30,30);
            var cr=close.GetComponent<RectTransform>();cr.anchorMin=cr.anchorMax=new Vector2(1,1);cr.pivot=new Vector2(1,1);cr.anchoredPosition=new Vector2(-7,-7);cr.sizeDelta=new Vector2(30,30);
            var attrRow=Row(detailBody,82);
            for(int i=0;i<5;i++)
            {
                int value=tile.attrs[i];var box=Rect("Attribute "+ElementKeys[i],attrRow);
                var tube=Panel("Attribute Tube",box,new Color(0,0,0,.08f));tube.anchorMin=new Vector2(0,1);tube.anchorMax=Vector2.one;tube.pivot=new Vector2(.5f,1);tube.anchoredPosition=Vector2.zero;tube.sizeDelta=new Vector2(-4,46);
                var fill=Panel("Element Fill",tube,value<0?Hex("FF5A4A"):Hex(ElementColors[i]));fill.anchorMin=Vector2.zero;fill.anchorMax=new Vector2(1,Mathf.Min(1,Mathf.Abs((float)value)/cap));fill.offsetMin=fill.offsetMax=Vector2.zero;
                var number=Label(box,value+"\n"+ElementNames[i],12,Ink);number.alignment=TextAnchor.MiddleCenter;Inset(number.rectTransform,0,48,0,0);
            }
            foreach(var el in ElementKeys)
            {
                var units=tile.spirits.Where(s=>s.el==el).ToList();if(units.Count==0)continue;int id=units[0].id;string key=el;
                var row=Row(detailBody,34);Label(row,ElementName(el)+"元素灵 ×"+units.Count,12,Ink,null,1);
                Button(row,"移动",()=>Emit(new GameAction{type="moveSpirit",from=selected,spiritId=id}),Hex("3B8CF0"),45,28).interactable=!state.over&&!Used(state.interactionUsed,"spirit:"+id);
                Button(row,"合成兽",()=>Emit(new GameAction{type="merge",cell=selected,el=key}),Gold,53,28).interactable=!state.over&&units.Count>=3;
            }
            var terrain=DetailSection(type.familyName+" · "+type.branch);DetailSmall(terrain,type.effect);
            if(!string.IsNullOrEmpty(type.trigger))DetailSmall(terrain,type.trigger+" · "+type.cost);
            var relations=Game.TileRelations(state,selected);if(Game.Relations.TryGetValue(type.family,out var relation))DetailSmall(terrain,"四邻互作 · "+relation.name+"\n匹配 "+relations.Count+" 格，轮末"+ElementName(relation.el)+"＋"+relations.Count*Math.Max(1,type.level-2));
            var children=Catalog.Tiles.Where(t=>t.parent==tile.type).ToList();
            foreach(var child in children)
            {
                string destination=child.id;var reasons=Game.UpgradeReasons(state,selected,child);var pay=Game.UpgradeCost(state,selected,child);
                Body(terrain,child.name+" · T"+child.level,13);DetailSmall(terrain,ColoredAttrs(child.attrs));DetailSmall(terrain,"普通 "+(BagText(pay.normal)==""?"无":BagText(pay.normal))+" · 大型 "+(BagText(pay.big)==""?"无":BagText(pay.big)));
                Button(terrain,reasons.Count==0?child.branch+" · 升级":string.Join(" · ",reasons),()=>Emit(new GameAction{type="upgrade",cell=selected,tileType=destination}),Green,0,30).interactable=!state.over&&reasons.Count==0;
            }
            var batch=Row(terrain,30);Button(batch,"结晶加点",OpenCrystalBatch,Hex("3B8CF0"),0,28);Button(batch,"批量升级",OpenUpgradeBatch,Hex("3B8CF0"),0,28);
            foreach(var unit in tile.beasts){int id=unit.id;var row=Row(detailBody,34);Label(row,ElementName(unit.el)+"元素兽",12,Ink,null,1);Button(row,"移动",()=>Emit(new GameAction{type="moveBeast",from=selected,beastId=id}),Hex("3B8CF0"),48,28).interactable=!state.over&&!Used(state.interactionUsed,"beast:"+id);}
            if(tile.beasts.Count>0)Button(detailBody,"选5兽合成守护灵",()=>OpenGuardian(selected),Gold,0,32).interactable=tile.beasts.Count>=5&&!state.over;
            foreach(var guardian in tile.guardians)
            {
                int id=guardian.id;Small(detailBody,"守护灵 · "+BagText(guardian.power));Button(detailBody,"移动 · 1 行动",()=>Emit(new GameAction{type="moveGuardian",from=selected,guardianId=id}),Gold,0,30).interactable=!state.over&&state.ap>0;
            }
            foreach(var group in tile.plants.GroupBy(u=>u.kind))Small(detailBody,UnitName(group.Key)+" ×"+group.Count()+" · 每3轮自动滋养");
            foreach(var group in tile.animals.GroupBy(u=>new{u.kind,u.el}))Small(detailBody,ElementName(group.Key.el)+UnitName(group.Key.kind)+" ×"+group.Count());
            if(tile.cancers.Count>0)Small(detailBody,"癌元 ×"+tile.cancers.Count+" · 净化 / 焚尽可消灭");
            foreach(var shield in state.shields.Where(s=>s.cells.Contains(selected)))Small(detailBody,"元素盾 · "+BagText(shield.defense)+" · 共享");
            Button(detailBody,"铲除地块 · 1 行动",ConfirmDemolish,Hex("FF5A4A"),0,32).interactable=!state.over&&state.ap>0;
            if(photoMode)foreach(var button in detailBody.GetComponentsInChildren<Button>())button.interactable=button==close;
        }
        RectTransform DetailSection(string title,Color? color=null)
        {
            var panel=Panel("Detail Section "+title,detailBody,color??Hex("F3F5DF"));
            var layout=panel.gameObject.AddComponent<VerticalLayoutGroup>();layout.padding=new RectOffset(8,8,7,7);layout.spacing=5;layout.childControlHeight=true;layout.childControlWidth=true;layout.childForceExpandHeight=false;
            Body(panel,title,13).fontStyle=FontStyle.Bold;return panel;
        }
        void DetailSmall(RectTransform parent,string copy){var text=Body(parent,copy,compact?10:11,Muted);text.lineSpacing=1.15f;text.GetComponent<LayoutElement>().minHeight=14;}

        void BuildWebInventory()
        {
            Clear(bagBody);inventoryLabels.Clear();if(state==null)return;
            DetailSmall(bagBody,"元素结晶 · 不耗行动 · 每轮不限次数\n点击后选地块使用");bool any=false;
            foreach(var el in ElementKeys)
            {
                var row=Row(bagBody,30);int n=0;
                foreach(var kind in new[]{"crystal","bigCrystal","inverseCrystal"})
                {
                    var bag=kind=="crystal"?state.inv.crystal:kind=="bigCrystal"?state.inv.bigCrystal:state.inv.inverseCrystal;
                    int count=Count(bag,el);if(count==0)continue;any=true;n++;
                    string key=el;bool big=kind=="bigCrystal",inverse=kind=="inverseCrystal";var copy=(inverse?"逆":big?"大":"")+ElementName(el)+"晶";
                    var button=Button(row,copy+" ×"+count,()=>Crystal(key,big,inverse),ElementColor(el),0,28);button.interactable=!state.over;
                    inventoryLabels[button.GetComponentInChildren<Text>()]=kind+":"+el+":"+copy;
                }
                if(n==0)row.gameObject.SetActive(false);
            }
            if(!any)DetailSmall(bagBody,"暂无，元素灵每 3 轮产 1 颗");
            DetailSmall(bagBody,"至纯元素结晶 · 永久扩展对应魔法");
            bool anyPure = false;
            foreach(var magic in Catalog.Magics)
            {
                string id=magic.id;int count=Count(state.inv.pureCrystal,magic.element);if(count<=0)continue;anyPure=true;string prefix="至纯"+ElementName(magic.element);string suffix="\n"+magic.name+" "+state.magicRange[id]+" → "+(state.magicRange[id]+4)+" 格";
                var pure=Button(bagBody,prefix+" ×"+count+suffix,()=>Emit(new GameAction{type="usePureCrystal",magic=id}),ElementColor(magic.element),0,44);pure.interactable=!state.over&&count>0;
                inventoryLabels[pure.GetComponentInChildren<Text>()]="pureCrystal:"+magic.element+":"+prefix+":"+suffix;
            }
            if(!anyPure)DetailSmall(bagBody,"元素星雨后获得，可永久扩展对应魔法范围。");
            DetailSmall(bagBody,"元素盾");if(state.inv.shields.Count==0)DetailSmall(bagBody,"暂无可部署的盾");
            foreach(var shield in state.inv.shields){int id=shield.id;Button(bagBody,"部署 · "+shield.coverage+" 格",()=>{CloseModal();Emit(new GameAction{type="deployShield",shieldId=id});},Hex("3B8CF0"),0,30).interactable=!state.over;}
            Button(bagBody,"调配元素盾",OpenShield,Hex("3B8CF0"),0,30).interactable=!state.over;
            Button(bagBody,"批量结晶加点",OpenCrystalBatch,Gold,0,30).interactable=!state.over&&!string.IsNullOrEmpty(selected)&&state.cells.ContainsKey(selected);
            Button(bagBody,"批量地块升级",OpenUpgradeBatch,Line,0,30).interactable=!state.over;
        }
        RectTransform Paper(string name,Transform parent,Color color)
        {
            var p=Panel(name,parent,color);p.GetComponent<Image>().sprite=paperSprite;Edge(p,name=="Journey"?Hex("C2C49F"):Color.white,name=="Journey"?1:3);var shadow=p.gameObject.AddComponent<Shadow>();shadow.effectColor=name=="Journey"?new Color(.14f,.24f,.14f,.15f):Hex("A8844A");shadow.effectDistance=new Vector2(0,name=="Journey"?-3:-6);return p;
        }
        void Edge(RectTransform rect,Color color,float width){var outline=rect.gameObject.AddComponent<Outline>();outline.effectColor=color;outline.effectDistance=new Vector2(width,-width);outline.useGraphicAlpha=true;}
        void AddButtonEdge(RectTransform rect,Color color)
        {
            Edge(rect,new Color(0,0,0,.25f),2);var shadow=rect.gameObject.AddComponent<Shadow>();shadow.effectColor=new Color(color.r*.57f,color.g*.57f,color.b*.57f,1);shadow.effectDistance=new Vector2(0,-4);
            var gloss=Rect("Button Gloss",rect);Inset(gloss,2,2,2,2);var gradient=gloss.gameObject.AddComponent<HabitatWebGraphic>();gradient.Kind="gloss";gradient.color=Color.white;gradient.raycastTarget=false;
        }
        RectTransform Tag(Transform parent,string copy,Color color)
        {
            var tag=Panel("Tray Tag",parent,color);Edge(tag,Color.white,2);Place(tag,14,-11,copy=="魔法"?48:90,24);
            if(!string.IsNullOrEmpty(copy)){var text=Label(tag,copy,12,Color.white);text.fontStyle=FontStyle.Bold;text.alignment=TextAnchor.MiddleCenter;Inset(text.rectTransform,4,0,4,0);}return tag;
        }
        RectTransform Icon(Transform parent,string kind,Color color,float size)
        {
            var rect=Rect("Icon "+kind,parent);rect.anchorMin=rect.anchorMax=new Vector2(.5f,.5f);rect.sizeDelta=Vector2.one*size;
            var graphic=rect.gameObject.AddComponent<HabitatWebGraphic>();graphic.Kind=kind;graphic.color=color;graphic.raycastTarget=false;return rect;
        }
        void TextOutline(Text text){var stroke=text.gameObject.AddComponent<Shadow>();stroke.effectColor=new Color(0,0,0,.5f);stroke.effectDistance=new Vector2(0,-1);}
        static Color FamilyColor(string family)
        {
            switch(family){case "woodland":return Hex("4A965C");case "grassland":return Hex("8CB348");case "ice":return Hex("72BDD3");case "ocean":return Hex("347DB7");case "river":return Hex("4AAFAE");case "wetland":return Hex("4A9475");case "desert":return Hex("D7AC66");case "volcano":return Hex("BD6747");case "mine":return Hex("858D8A");case "ruins":return Hex("A79B87");default:return Hex("73A760");}
        }

        void BuildWebMenu()
        {
            Clear(menuBody);
            Body(menuBody,"元素生境 v1.3",24,Ink,TextAnchor.MiddleCenter).fontStyle=FontStyle.Bold;
            var panel=(RectTransform)menu.GetChild(0);
            if(panel.Find("Close Menu")==null){var close=Button(panel,"×",()=>{if(hasPlayed){HideMainMenu();Layout();}},Hex("FF5A4A"),34,34);close.name="Close Menu";close.GetComponent<Image>().sprite=circleSprite;}
            var first=Row(menuBody,36);Button(first,"回声册",OpenEchoes,Hex("3B8CF0"),0,34);Button(first,"地脉图鉴 · 80种",OpenAtlas,Hex("3B8CF0"),0,34);
            var second=Row(menuBody,36);Button(second,"成就与愿景",OpenAchievements,Gold,0,34);Button(second,"设置",OpenSettings,Hex("3B8CF0"),0,34);Button(second,"玩法说明",OpenHelp,Hex("3B8CF0"),0,34);
            var toggles=Row(menuBody,36);
            Button(toggles,"音效"+(SoundEnabled?"开":"关"),()=>{SoundEnabled=!SoundEnabled;Emit(new GameAction{type="settingsSound",skip=SoundEnabled});BuildWebMenu();},Hex("3B8CF0"),0,34);
            Button(toggles,"氛围"+(AtmosphereEnabled?"开":"关"),()=>{AtmosphereEnabled=!AtmosphereEnabled;Emit(new GameAction{type="settingsAtmosphere",skip=AtmosphereEnabled});BuildWebMenu();},Hex("3B8CF0"),0,34);
            Button(toggles,"灵力与目标",()=>{OpenModal("灵力与挑战目标","score");BuildScoreDetail();},Gold,0,34);
            if(state!=null)
            {
                bool error=!string.IsNullOrEmpty(message)&&(message.StartsWith("未能读取存档",StringComparison.Ordinal)||message.StartsWith("存档失败",StringComparison.Ordinal));
                menuSubtitle=Body(menuBody,error?message:"第 "+state.round+" 轮 · "+(state.mode=="endless"?"无尽生境":"40轮挑战")+" · 灵力 "+ScoreNumber(Game.Score(state).total),12,error?Hex("B8302A"):Muted,TextAnchor.MiddleCenter);
            }
            var resume=Row(menuBody,38);Button(resume,hasPlayed?"回到生境":"继续上次旅程",()=>{HideMainMenu();continueGame?.Invoke();Layout();},Green,0,36).interactable=hasPlayed||hasSave;
            Button(resume,"保存进度",()=>{Emit(new GameAction{type="save"});BuildWebMenu();},Gold,0,36).interactable=hasPlayed;
            Small(menuBody,"开启新的旅程");
            var games=Row(menuBody,38);Button(games,"初醒之旅",()=>RequestNewGame(true),Green,0,36);Button(games,"复苏挑战",()=>RequestNewGame(false),Gold,0,36);Button(games,"无尽生境",()=>{if(hasPlayed&&state!=null&&state.completedMap&&state.result!="failed"){HideMainMenu();Emit(new GameAction{type="enterEndless"});}else RequestNewGame(false,true);},Hex("3B8CF0"),0,36);
            var souvenirs=Row(menuBody,34);Button(souvenirs,"摄影",()=>{HideMainMenu();Emit(new GameAction{type="photoMode"});},Hex("3B8CF0"),0,32).interactable=hasPlayed&&state!=null&&state.completedMap;
            Button(souvenirs,"保存地图",()=>Emit(new GameAction{type="exportSave"}),Hex("3B8CF0"),0,32).interactable=hasPlayed&&state!=null&&state.completedMap;
            Button(souvenirs,"检视生境",()=>{HideMainMenu();Emit(new GameAction{type="inspect"});},Hex("3B8CF0"),0,32).interactable=hasPlayed&&state!=null&&state.completedMap;
            Small(menuBody,"日志");
            if(state!=null)foreach(var entry in state.log.TakeLast(3))DetailSmall(menuBody,entry);
            Small(menuBody,"单人离线 · 自动存档 · 40轮目标 500 / 1500 / 3000 / 6000");
        }
        void BuildScoreDetail()
        {
            Clear(modalBody);if(state==null)return;
            UpdateWebNumbers();Body(modalBody,formulaText.text,18,Ink);Body(modalBody,goalText.text,14,Muted);
            Small(modalBody,"全图属性每点 0.5 灵力；动植物每只 1 生态分；守护塔累计投入结晶颗数计分。峰值灵力提升行动上限。\n点击中央守护塔可查看五行庇护与灵力涌泉。");
            Button(modalBody,"中央守护塔",ShowTower,Gold,0,38);Button(modalBody,"返回生境",()=>{CloseModal();HideMainMenu();Layout();},Green,0,38);
        }
        static Sprite ShapeSprite(int size,int radius,bool paper=false)
        {
            var texture=new Texture2D(size,size,TextureFormat.RGBA32,false){name="Habitat Rounded Shape",filterMode=FilterMode.Bilinear};var pixels=new Color[size*size];
            for(int y=0;y<size;y++)for(int x=0;x<size;x++){float cx=Mathf.Clamp(x,radius,size-radius-1),cy=Mathf.Clamp(y,radius,size-radius-1);float distance=Vector2.Distance(new Vector2(x,y),new Vector2(cx,cy));float shade=paper?1-(float)y/(size-1):0;pixels[y*size+x]=new Color(1-.047f*shade,1-.081f*shade,1-.157f*shade,Mathf.Clamp01(radius-distance+.5f));}
            texture.SetPixels(pixels);texture.Apply();return Sprite.Create(texture,new Rect(0,0,size,size),new Vector2(.5f,.5f),100,0,SpriteMeshType.FullRect,new Vector4(radius,radius,radius,radius));
        }
    }
}
