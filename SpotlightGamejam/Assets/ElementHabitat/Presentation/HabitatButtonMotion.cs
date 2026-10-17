using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace ElementHabitat
{
    /// <summary>Small UGUI springs retain the browser's card lift and readable button presses.</summary>
    public sealed class HabitatButtonMotion : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler,
        IPointerDownHandler, IPointerUpHandler
    {
        Func<bool> reduced;
        Button button;
        RectTransform rect;
        bool hover, pressed, selected, card, resting;
        Vector2 rest, lastPosition;
        float scale = 1, velocity, lift, liftVelocity;
        float entrance = -1, entranceDelay;

        public void Initialize(Func<bool> reducedMotion)
        {
            reduced = reducedMotion; button = GetComponent<Button>(); rect = GetComponent<RectTransform>();
        }

        public void SetCard(bool value, bool fresh, float delay)
        {
            card = true; selected = value; entranceDelay = delay;
            if (fresh && (reduced == null || !reduced())) entrance = Time.unscaledTime;
            if (value && (reduced == null || !reduced())) { scale = .97f; velocity = .8f; }
        }

        public void SetSelected(bool value)
        {
            if (selected != value && value) velocity = .8f;
            selected = value;
        }

        void LateUpdate()
        {
            if (rect == null) return;
            // Layout owns the rest position; motion only adds an offset after its latest pass.
            if (!resting || (rect.anchoredPosition - lastPosition).sqrMagnitude > .05f)
            { rest = rect.anchoredPosition; resting = true; }
            bool enabled = button != null && button.interactable;
            bool noMotion = reduced != null && reduced();
            float target = enabled ? (selected ? 1.05f : hover ? (card ? 1.03f : 1.02f) : 1) * (pressed ? .96f : 1) : 1;
            float targetLift = enabled && card ? selected ? 14 : hover ? 4 : 0 : 0;
            if (noMotion) { scale = 1; lift = 0; velocity = liftVelocity = 0; entrance = -1; }
            else
            {
                float dt = Mathf.Min(Time.unscaledDeltaTime, .04f);
                // A damped spring settles quickly without large positional or scale overshoots.
                velocity += ((target - scale) * 170 - velocity * 19) * dt;
                scale += velocity * dt;
                liftVelocity += ((targetLift - lift) * 160 - liftVelocity * 20) * dt;
                lift += liftVelocity * dt;
            }
            float slide = 0, fade = 1;
            if (entrance >= 0)
            {
                float age = Time.unscaledTime - entrance - entranceDelay;
                float t = Mathf.Clamp01(age / .35f);
                slide = -18 * (1 - t) * (1 - t); fade = Mathf.Clamp01(age / .16f);
                if (t >= 1) entrance = -1;
            }
            var group = GetComponent<CanvasGroup>();
            if (group == null && entrance >= 0) group = gameObject.AddComponent<CanvasGroup>();
            if (group != null) group.alpha = fade;
            rect.localScale = Vector3.one * scale;
            lastPosition = rest + new Vector2(0, lift + slide);
            rect.anchoredPosition = lastPosition;
        }
        public void OnPointerEnter(PointerEventData _) { hover = true; }
        public void OnPointerExit(PointerEventData _) { hover = pressed = false; }
        public void OnPointerDown(PointerEventData _) { pressed = true; }
        public void OnPointerUp(PointerEventData _) { pressed = false; }
        void OnDisable()
        {
            hover = pressed = false;
            if (rect != null) { rect.localScale = Vector3.one; if (resting) rect.anchoredPosition = rest; }
            resting = false;
        }
    }
}
