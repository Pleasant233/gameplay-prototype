using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace ElementHabitat
{
    /// <summary>
    /// Cosmetic receipts mirror the web token layer. Rules settle immediately; only the displayed
    /// numbers wait for their receipt. Queued and visible nodes share one bounded budget.
    /// </summary>
    public sealed class HabitatFeedbackHUD : MonoBehaviour
    {
        const int TokenBudget = 40;
        const float UpDuration = 1.05f, DownDuration = .70f;
        sealed class Flight
        {
            public string cell, target, element, inventory, icon;
            public double score;
            public int bag, cells, count;
            public float due, started = -1, arc;
            public bool down, pure;
            public Vector2 from, scatter;
            public RectTransform node;
            public Text label;
            public CanvasGroup opacity;
        }
        readonly List<Flight> flights = new List<Flight>();
        readonly Dictionary<string, int> inventoryPending = new Dictionary<string, int>();
        readonly Dictionary<RectTransform, float> bumps = new Dictionary<RectTransform, float>();
        static readonly HashSet<string> WorldOnlyEvents = new HashSet<string> {
            "weather", "naturalEvent", "achievement", "purify", "cancer", "infection", "meteor", "shield",
            "predation", "upgrade", "towerUpgrade", "guardianMerge", "guardianMove", "guardian", "spell",
            "vanish", "degrade", "range", "mapComplete", "stageClear", "relation", "memory", "autoMerge", "animalAwaken"
        };
        RectTransform layer, scoreTarget, bagTarget, cellsTarget;
        Font font;
        Sprite panel;
        State authoritative;
        Func<bool> reduced;
        Func<string, Vector3> project;
        Action changed;
        double pendingScore;
        int pendingBag, pendingCells, sequence;
        public Action<int> ReceiptArrived;

        public int ActiveTokenCount { get { return flights.Count; } }
        public int ActiveFlightCount { get { return flights.Count(f => f.started >= 0); } }
        public int QueuedFlightCount { get { return flights.Count(f => f.started < 0); } }
        public double DisplayScore { get { return authoritative == null ? 0 : Game.Score(authoritative).total - pendingScore; } }
        public int DisplayBag { get { return authoritative == null ? 0 : Math.Max(0, Game.BagCount(authoritative) - pendingBag); } }
        public int DisplayCells { get { return authoritative == null ? 0 : authoritative.cells.Count - pendingCells; } }
        public double DisplayedScore { get { return DisplayScore; } }
        public int DisplayedBag { get { return DisplayBag; } }
        public int DisplayedLeft { get { return authoritative == null ? 0 : Game.EmptyKeys(authoritative).Count + pendingCells; } }

        public void Initialize(RectTransform parent, Font textFont, Sprite background, RectTransform score,
            RectTransform bag, RectTransform cells, Func<bool> reducedMotion, Action refresh)
        {
            font = textFont; panel = background; scoreTarget = score; bagTarget = bag;
            cellsTarget = cells; reduced = reducedMotion; changed = refresh;
            layer = NewRect("Resource Flights", parent, Vector2.zero);
            layer.anchorMin = Vector2.zero; layer.anchorMax = Vector2.one;
            layer.offsetMin = layer.offsetMax = Vector2.zero;
            var group = layer.gameObject.AddComponent<CanvasGroup>();
            group.blocksRaycasts = false; group.interactable = false;
        }

        public void SetAuthoritative(State value) { authoritative = value; }
        public void BringToFront() { if (layer != null) layer.SetAsLastSibling(); }

        public int DisplayInventory(string kind, string element, int actual)
        {
            int n; inventoryPending.TryGetValue(kind + ":" + element, out n);
            return Math.Max(0, actual - n);
        }

        public void PresentAction(State before, State after, GameAction action, IList<GameEvent> events,
            Func<string, Vector3> screenPoint, Func<GameEvent, float> effectDelay = null)
        {
            authoritative = after; project = screenPoint;
            if (layer == null || after == null || reduced != null && reduced()) { ResetFeedback(); return; }
            layer.SetAsLastSibling();
            float now = Time.unscaledTime;
            bool crystal = action != null && (action.type == "useCrystal" || action.type == "useCrystals");
            string actionCell = action == null ? null : action.cell ?? action.to ?? action.from;
            if (crystal && !string.IsNullOrEmpty(actionCell))
            {
                foreach (var el in ConsumedElements(before, after, action))
                    Schedule(new Flight { cell = actionCell, element = el, icon = "◆", count = 1,
                        target = "", down = true, from = Center(bagTarget), due = now, arc = 30 });
            }

            // Aggregate repeated receipts on the same tile before creating any UGUI objects.
            var batches = new Dictionary<string, Flight>();
            var cellOrder = new Dictionary<string, int>();
            double accounted = 0;
            foreach (var receipt in events ?? Array.Empty<GameEvent>())
            {
                accounted += receipt.score;
                if (WorldOnlyEvents.Contains(receipt.kind)) continue;
                string key = receipt.cell ?? actionCell ?? Game.TOWER_CELL;
                bool pure = receipt.kind == "pureCrystal";
                if (!pure && !cellOrder.ContainsKey(key)) cellOrder[key] = cellOrder.Count;
                // Web receipts fly alongside board effects. Only their source-cell order staggers them;
                // crystal impacts and the meteor sequence do not postpone the HUD flight.
                string target = "score", inventory = null;
                int bag = 0, cells = 0;
                int count = receipt.n == 0 ? 1 : (int)Math.Round(receipt.n);
                string icon = "✦";
                switch (receipt.kind)
                {
                    case "place": target = "cells"; cells = 1; icon = "⬡"; break;
                    case "crystal": case "bigCrystal": case "inverseCrystal": case "pureCrystal":
                        target = "bag"; bag = count; inventory = receipt.kind; icon = "◆"; break;
                    case "item": target = "bag"; bag = count; icon = "◆"; break;
                    case "plant": icon = "✿"; break;
                    case "animal": icon = "♣"; break;
                    case "spirit": icon = "✧"; break;
                    case "beast": icon = "✦"; break;
                    case "attr":
                        icon = (receipt.score >= 0 ? "+" : "−") + Number(Math.Abs(receipt.score)); break;
                    default: if (receipt.score == 0) continue; break;
                }
                string batchKey = key + ":" + target + ":" + receipt.kind + ":" + receipt.el;
                Flight flight;
                if (!batches.TryGetValue(batchKey, out flight))
                {
                    flight = new Flight { cell = key, target = target, element = receipt.el,
                        inventory = inventory, icon = icon, due = now + (pure ? 0 : cellOrder[key] * .04f),
                        arc = StableNoise(key + receipt.el) * 60, pure = pure };
                    // Exact production tokens.js: 1600ms delay, then a 3200ms hero reveal.
                    if (flight.pure) flight.due = now + 1.6f;
                    batches.Add(batchKey, flight);
                }
                flight.score += receipt.score; flight.bag += bag; flight.cells += cells; flight.count += count;
            }
            double actual = before == null ? accounted : Game.Score(after).total - Game.Score(before).total;
            if (Math.Abs(actual - accounted) > .0001)
            {
                string key = actionCell ?? Game.TOWER_CELL;
                batches["unaccounted"] = new Flight { cell = key, target = "score", icon = "✦", count = 1,
                    score = actual - accounted, due = now, arc = 30 };
            }
            foreach (var flight in batches.Values) Schedule(flight);
            changed?.Invoke();
        }

        static IEnumerable<string> ConsumedElements(State before, State after, GameAction action)
        {
            if (action.type == "useCrystal" && !string.IsNullOrEmpty(action.el)) return new[] { action.el };
            if (before == null || after == null) return Array.Empty<string>();
            return Game.EL.Where(el => before.inv.crystal[el] > after.inv.crystal[el]
                || before.inv.bigCrystal[el] > after.inv.bigCrystal[el]
                || before.inv.inverseCrystal[el] > after.inv.inverseCrystal[el]).ToArray();
        }

        void Schedule(Flight flight)
        {
            pendingScore += flight.score; pendingBag += flight.bag; pendingCells += flight.cells;
            AddInventory(flight, flight.bag);
            if (flights.Count >= TokenBudget)
            {
                if (flight.pure)
                {
                    var displaced = flights[0]; flights.RemoveAt(0); Arrive(displaced);
                    flights.Add(flight); return;
                }
                // A saturated settlement folds into an existing destination without adding a node.
                var existing = flights.FirstOrDefault(f => !f.down && !f.pure && f.target == flight.target
                    && f.inventory == flight.inventory && f.element == flight.element);
                if (existing != null && !flight.down && !flight.pure)
                {
                    existing.score += flight.score; existing.bag += flight.bag;
                    existing.cells += flight.cells; existing.count += flight.count;
                    UpdateLabel(existing); return;
                }
                Arrive(flight, false); return;
            }
            flights.Add(flight);
        }

        void AddInventory(Flight flight, int n)
        {
            if (string.IsNullOrEmpty(flight.inventory) || string.IsNullOrEmpty(flight.element)) return;
            string key = flight.inventory + ":" + flight.element;
            int previous; inventoryPending.TryGetValue(key, out previous);
            inventoryPending[key] = previous + n;
        }

        void Update()
        {
            if (reduced != null && reduced() && (flights.Count != 0 || bumps.Count != 0)) { ResetFeedback(); return; }
            float now = Time.unscaledTime;
            for (int i = flights.Count - 1; i >= 0; i--)
            {
                var flight = flights[i];
                if (now < flight.due) continue;
                if (flight.started < 0)
                {
                    if (!flight.down && !flight.pure && !TryProject(flight.cell, out flight.from))
                    { flights.RemoveAt(i); Arrive(flight); continue; }
                    flight.started = now;
                    flight.scatter = flight.from + new Vector2(StableNoise(flight.cell + flight.icon) * 24, 36 + Mathf.Abs(flight.arc) * .34f);
                    MakeNode(flight);
                }
                float age = now - flight.started;
                Vector2 destination = Center(Target(flight.target));
                if (flight.down && !TryProject(flight.cell, out destination))
                { flights.RemoveAt(i); Arrive(flight); continue; }
                float duration = flight.pure ? 3.2f : flight.down ? DownDuration : UpDuration;
                if (age >= duration) { flights.RemoveAt(i); Arrive(flight); continue; }
                float scale = 1;
                Vector2 position;
                if (flight.pure)
                {
                    Vector2 center = new Vector2(0, layer.rect.height * .06f);
                    if (age < .65f)
                    {
                        float u = age / .65f;
                        Vector2 outside = new Vector2(-layer.rect.width * .5f - 120, layer.rect.height * .5f + 180);
                        position = Vector2.LerpUnclamped(outside, center, u); scale = .5f + u * .9f;
                    }
                    else if (age < 2.4f) { position = center; scale = 1.4f; }
                    else
                    {
                        float u = Mathf.Clamp01((age - 2.4f) / .8f);
                        position = Vector2.LerpUnclamped(center, destination, u * u); scale = 1.4f * (1 - u) + .25f * u;
                    }
                }
                else
                {
                    float travelAge = age;
                    if (travelAge < .18f && !flight.down)
                    {
                        float t = travelAge / .18f;
                        position = new Vector2(Mathf.Lerp(flight.from.x, flight.scatter.x, t),
                            Mathf.Lerp(flight.from.y, flight.scatter.y, 1 - (1 - t) * (1 - t)));
                        scale = .6f + t * .5f;
                    }
                    else if (travelAge < .33f && !flight.down) { position = flight.scatter; scale = 1.1f; }
                    else
                    {
                        float u = Mathf.Clamp01((travelAge - (flight.down ? 0 : .33f)) / (flight.down ? DownDuration : .72f));
                        float t = u * u;
                        Vector2 origin = flight.down ? flight.from : flight.scatter;
                        Vector2 control = new Vector2((origin.x + destination.x) * .5f + flight.arc,
                            Mathf.Max(origin.y, destination.y) + 70);
                        position = (1 - t) * (1 - t) * origin + 2 * (1 - t) * t * control + t * t * destination;
                        scale = 1.1f - .65f * u;
                    }
                }
                flight.node.anchoredPosition = position;
                flight.node.localScale = Vector3.one * scale;
            }
            foreach (var pair in bumps.ToArray())
            {
                if (pair.Key == null) { bumps.Remove(pair.Key); continue; }
                float t = (now - pair.Value) / .5f;
                pair.Key.localScale = Vector3.one * (1 + Mathf.Sin(Mathf.Clamp01(t) * Mathf.PI) * .16f * (1 - t));
                if (t >= 1) { pair.Key.localScale = Vector3.one; bumps.Remove(pair.Key); }
            }
        }

        void MakeNode(Flight flight)
        {
            flight.node = NewRect(flight.pure ? "Pure Crystal Receipt" : "Resource Receipt", layer, new Vector2(92, 50));
            flight.opacity = flight.node.gameObject.AddComponent<CanvasGroup>();
            flight.opacity.blocksRaycasts = false; flight.opacity.interactable = false;
            Color color = ElementColor(flight.element);
            var glow = NewRect("Soft Halo", flight.node, new Vector2(35, 35));
            var halo = glow.gameObject.AddComponent<Image>(); halo.sprite = panel; halo.color = new Color(color.r, color.g, color.b, .2f); halo.raycastTarget = false;
            glow.localRotation = Quaternion.Euler(0, 0, 45);
            bool numeric = flight.icon.StartsWith("+", StringComparison.Ordinal) || flight.icon.StartsWith("−", StringComparison.Ordinal);
            if (!numeric)
            {
                var glyphRect = NewRect("Native Element Icon", flight.node, flight.pure ? new Vector2(70, 90) : new Vector2(32, 32));
                glyphRect.anchoredPosition = flight.pure ? Vector2.zero : new Vector2(-8, 0);
                var glyph = glyphRect.gameObject.AddComponent<HabitatTokenGlyph>();
                glyph.kind = flight.icon; glyph.color = color; glyph.raycastTarget = false;
            }
            var labelRect = NewRect("Element Receipt", flight.node, new Vector2(104, 48));
            flight.label = labelRect.gameObject.AddComponent<Text>();
            flight.label.font = font; flight.label.fontSize = 26; flight.label.fontStyle = FontStyle.Bold;
            flight.label.alignment = TextAnchor.MiddleCenter; flight.label.raycastTarget = false;
            flight.label.color = color; flight.label.supportRichText = true;
            if (!numeric) { flight.label.alignment = TextAnchor.MiddleLeft; labelRect.anchoredPosition = new Vector2(64, 0); }
            var outline = labelRect.gameObject.AddComponent<Outline>();
            outline.effectColor = new Color(.13f, .2f, .18f, .55f); outline.effectDistance = new Vector2(1, -1);
            if (flight.pure)
            {
                var title = NewRect("Pure Crystal Label", flight.node, new Vector2(280, 48));
                title.anchoredPosition = new Vector2(0, -65);
                var background = title.gameObject.AddComponent<Image>(); background.sprite = panel; background.type = Image.Type.Sliced;
                background.color = new Color(.15f, .13f, .23f, .94f); background.raycastTarget = false;
                var titleText = NewRect("Name", title, new Vector2(270, 46));
                var text = titleText.gameObject.AddComponent<Text>(); text.font = font; text.fontSize = 18;
                text.alignment = TextAnchor.MiddleCenter; text.raycastTarget = false; text.color = Color.white;
                text.text = "至纯" + ElementName(flight.element) + "元素结晶";
                var caption = NewRect("Pure Crystal Effect", flight.node, new Vector2(310, 32));
                caption.anchoredPosition = new Vector2(0, -105);
                var captionText = caption.gameObject.AddComponent<Text>(); captionText.font = font; captionText.fontSize = 12;
                captionText.alignment = TextAnchor.MiddleCenter; captionText.raycastTarget = false; captionText.color = Color.white;
                captionText.text = "对应魔法覆盖 +4 格 · 可连续扩展";
                var shadow = caption.gameObject.AddComponent<Shadow>(); shadow.effectColor = new Color(0, 0, 0, .75f); shadow.effectDistance = new Vector2(1, -2);
            }
            UpdateLabel(flight);
        }

        void UpdateLabel(Flight flight)
        {
            if (flight.label == null) return;
            string icon = flight.icon;
            if (flight.target == "score" && (icon.StartsWith("+", StringComparison.Ordinal) || icon.StartsWith("−", StringComparison.Ordinal)))
                icon = (flight.score < 0 ? "−" : "+") + Number(Math.Abs(flight.score));
            bool numeric = icon.StartsWith("−", StringComparison.Ordinal) || icon.StartsWith("+", StringComparison.Ordinal);
            flight.label.text = numeric ? icon : Math.Abs(flight.count) > 1
                ? "<size=14><color=#FFFFFF>×" + Math.Abs(flight.count) + "</color></size>" : "";
        }

        void Arrive(Flight flight, bool animate = true)
        {
            pendingScore -= flight.score; pendingBag -= flight.bag; pendingCells -= flight.cells;
            if (Math.Abs(pendingScore) < .000001) pendingScore = 0;
            AddInventory(flight, -flight.bag);
            if (flight.node != null) { flight.node.gameObject.SetActive(false); Destroy(flight.node.gameObject); }
            if (animate && !flight.down)
            {
                var target = Target(flight.target);
                if (target != null) bumps[target] = Time.unscaledTime;
                ReceiptArrived?.Invoke(sequence++ % 12);
            }
            changed?.Invoke();
        }

        public void ResetFeedback()
        {
            foreach (var flight in flights) if (flight.node != null) { flight.node.gameObject.SetActive(false); Destroy(flight.node.gameObject); }
            foreach (var target in bumps.Keys) if (target != null) target.localScale = Vector3.one;
            flights.Clear(); bumps.Clear(); inventoryPending.Clear();
            pendingScore = 0; pendingBag = pendingCells = 0;
            sequence = 0;
            changed?.Invoke();
        }

        bool TryProject(string cell, out Vector2 point)
        {
            point = Vector2.zero;
            if (project == null || string.IsNullOrEmpty(cell) || layer == null) return false;
            var screen = project(cell);
            if (screen.z < 0 || float.IsNaN(screen.x) || float.IsNaN(screen.y)) return false;
            return RectTransformUtility.ScreenPointToLocalPointInRectangle(layer, screen, null, out point);
        }
        RectTransform Target(string target) { return target == "bag" ? bagTarget : target == "cells" ? cellsTarget : scoreTarget; }
        Vector2 Center(RectTransform target)
        {
            Vector2 local;
            if (target == null || layer == null) return Vector2.zero;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(layer,
                RectTransformUtility.WorldToScreenPoint(null, target.TransformPoint(target.rect.center)), null, out local);
            return local;
        }
        static RectTransform NewRect(string name, Transform parent, Vector2 size)
        {
            var rect = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rect.SetParent(parent, false); rect.anchorMin = rect.anchorMax = new Vector2(.5f, .5f);
            rect.pivot = new Vector2(.5f, .5f); rect.sizeDelta = size; return rect;
        }
        static float StableNoise(string value)
        {
            unchecked { int hash = 17; foreach (char c in value ?? "") hash = hash * 31 + c; return (hash & 1023) / 511.5f - 1; }
        }
        static Color ElementColor(string element)
        {
            string hex = element == "metal" ? "F2C230" : element == "wood" ? "5CCF3A" : element == "water" ? "3FA6FF"
                : element == "fire" ? "FF6A3A" : element == "earth" ? "D09A5A" : "FFE14A";
            Color color; ColorUtility.TryParseHtmlString("#" + hex, out color); return color;
        }
        static string ElementName(string element) { return element == "metal" ? "金" : element == "wood" ? "木" : element == "water" ? "水" : element == "fire" ? "火" : "土"; }
        static string Number(double n) { return n.ToString("0.#", System.Globalization.CultureInfo.InvariantCulture); }
        void OnDisable() { ResetFeedback(); }
        void OnDestroy() { ResetFeedback(); }
    }
}
