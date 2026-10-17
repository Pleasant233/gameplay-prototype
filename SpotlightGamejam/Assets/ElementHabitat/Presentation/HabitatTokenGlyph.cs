using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace ElementHabitat
{
    /// <summary>Locally rasterized vector icons use the same Image rendering path as HUD panels.</summary>
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class HabitatTokenGlyph : Image
    {
        static readonly Dictionary<string, Sprite> sprites = new Dictionary<string, Sprite>();
        static int users;
        bool registered;
        string icon;
        public string kind
        {
            get { return icon; }
            set
            {
                icon = value;
                Sprite generated;
                if (!sprites.TryGetValue(icon ?? "", out generated))
                { generated = CreateIcon(icon); sprites[icon ?? ""] = generated; }
                sprite = generated; type = Type.Simple; preserveAspect = false; raycastTarget = false;
            }
        }
        protected override void Awake()
        {
            base.Awake(); registered = true; users++;
            useLegacyMeshGeneration = false;
        }
        protected override void OnDestroy()
        {
            base.OnDestroy();
            if (registered) { registered = false; users--; }
            if (users != 0) return;
            foreach (var value in sprites.Values)
                if (value != null) { Destroy(value.texture); Destroy(value); }
            sprites.Clear();
        }
        static Sprite CreateIcon(string shape)
        {
            const int size = 96;
            var pixels = new Color32[size * size];
            for (int y = 0; y < size; y++) for (int x = 0; x < size; x++)
            {
                float coverage = 0, shade = 0;
                for (int sy = 0; sy < 2; sy++) for (int sx = 0; sx < 2; sx++)
                {
                    var point = new Vector2((x + (sx + .5f) * .5f) / size - .5f, (y + (sy + .5f) * .5f) / size - .5f);
                    float sample = Sample(shape, point);
                    if (sample < 0) continue;
                    coverage += .25f; shade += sample * .25f;
                }
                float value = coverage > 0 ? shade / coverage : 1;
                pixels[y * size + x] = new Color(value, value, value, coverage);
            }
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false)
                { name = "Native Resource Icon " + shape, filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            texture.SetPixels32(pixels); texture.Apply(false, true);
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(.5f, .5f), 100, 0, SpriteMeshType.FullRect);
        }
        static float Sample(string shape, Vector2 p)
        {
            if (shape == "✿")
            {
                if (Ellipse(p, new Vector2(-.16f, .14f), new Vector2(.27f, .17f), -30)) return 1;
                if (Ellipse(p, new Vector2(.15f, -.02f), new Vector2(.28f, .17f), 30)) return .78f;
                return p.x > -.045f && p.x < .04f && p.y > -.42f && p.y < .2f ? .67f : -1;
            }
            if (shape == "♣")
                return Ellipse(p, new Vector2(0, -.15f), new Vector2(.28f, .24f), 0)
                    || Ellipse(p, new Vector2(-.27f, .15f), new Vector2(.12f, .15f), -20)
                    || Ellipse(p, new Vector2(0, .28f), new Vector2(.12f, .15f), 0)
                    || Ellipse(p, new Vector2(.27f, .15f), new Vector2(.12f, .15f), 20) ? 1 : -1;
            if (shape == "◆" || shape == "▰")
            {
                if (Mathf.Abs(p.x) / .47f + Mathf.Abs(p.y) / .48f > 1) return -1;
                return p.x < 0 && p.y > 0 ? 1 : p.x > 0 && p.y < 0 ? .48f : p.y < 0 ? .72f : .88f;
            }
            if (shape == "⬡")
                return Mathf.Abs(p.x) < .39f && Mathf.Abs(p.y) < .45f - Mathf.Abs(p.x) * .57735f ? 1 : -1;
            float x = Mathf.Abs(p.x), y = Mathf.Abs(p.y);
            return Mathf.Max(x, y) / .47f + Mathf.Min(x, y) / .12f < 1 ? 1 : -1;
        }
        static bool Ellipse(Vector2 point, Vector2 center, Vector2 radius, float angle)
        {
            point -= center; float a = -angle * Mathf.Deg2Rad;
            float x = (point.x * Mathf.Cos(a) - point.y * Mathf.Sin(a)) / radius.x;
            float y = (point.x * Mathf.Sin(a) + point.y * Mathf.Cos(a)) / radius.y;
            return x * x + y * y <= 1;
        }
    }
}
