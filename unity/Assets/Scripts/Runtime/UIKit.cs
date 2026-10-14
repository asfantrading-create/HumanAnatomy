using System;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

namespace Asfan.Anatomy
{
    /// <summary>Text component helper that shapes Arabic and wraps it to the rect width.</summary>
    [RequireComponent(typeof(Text))]
    public class RtlText : MonoBehaviour
    {
        string logical = "";
        Text text;
        float lastWidth = -1;
        bool refreshing;

        public string Value { get => logical; set { logical = value ?? ""; lastWidth = -2; Refresh(); } }

        void OnEnable() { lastWidth = -2; Refresh(); }
        void OnRectTransformDimensionsChange() { if (isActiveAndEnabled) Refresh(); }

        public void Refresh()
        {
            if (refreshing) return;
            if (text == null) text = GetComponent<Text>();
            float w = ((RectTransform)transform).rect.width;
            if (Mathf.Abs(w - lastWidth) < 0.5f) return;
            lastWidth = w;
            refreshing = true;
            if (!ArabicShaper.HasArabic(logical))
            {
                text.horizontalOverflow = HorizontalWrapMode.Wrap;
                text.text = logical;
            }
            else
            {
                text.horizontalOverflow = HorizontalWrapMode.Overflow;
                var settings = text.GetGenerationSettings(new Vector2(100000, 100000));
                var gen = text.cachedTextGeneratorForLayout;
                float ppu = text.pixelsPerUnit <= 0 ? 1 : text.pixelsPerUnit;
                text.text = ArabicShaper.Display(logical, w - 4, s => gen.GetPreferredWidth(s, settings) / ppu);
            }
            refreshing = false;
        }
    }

    /// <summary>Builds uGUI elements in code.</summary>
    public static class UIKit
    {
        public static Font font;
        public static Sprite rounded;
        public static bool dark = true;

        public static Color Bg => dark ? new Color(0.07f, 0.10f, 0.15f, 0.92f) : new Color(1f, 1f, 1f, 0.96f);
        public static Color Card => dark ? new Color(0.12f, 0.16f, 0.23f, 1f) : new Color(0.95f, 0.96f, 0.98f, 1f);
        public static Color Fg => dark ? new Color(0.92f, 0.95f, 1f) : new Color(0.03f, 0.05f, 0.09f);
        public static Color Muted => dark ? new Color(0.62f, 0.68f, 0.78f) : new Color(0.20f, 0.25f, 0.33f);
        public static Color Accent => dark ? new Color(0.16f, 0.62f, 0.96f) : new Color(0.02f, 0.36f, 0.72f);
        public static Color Btn => dark ? new Color(0.17f, 0.22f, 0.31f) : new Color(0.84f, 0.88f, 0.94f);
        public static Color BtnOn => new Color(0.16f, 0.55f, 0.90f);

        public static void Init()
        {
            if (font == null) font = Font.CreateDynamicFontFromOSFont(new[] { "Tahoma", "Segoe UI", "Segoe UI Symbol", "Arial", "Noto Sans Arabic", "DejaVu Sans" }, 16);
            if (rounded == null)
            {
                const int n = 32, r = 10;
                var tex = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
                var px = new Color32[n * n];
                for (int y = 0; y < n; y++)
                    for (int x = 0; x < n; x++)
                    {
                        float dx = Mathf.Max(0, Mathf.Max(r - x - 0.5f, x + 0.5f - (n - r)));
                        float dy = Mathf.Max(0, Mathf.Max(r - y - 0.5f, y + 0.5f - (n - r)));
                        float a = Mathf.Clamp01(r - Mathf.Sqrt(dx * dx + dy * dy) + 0.5f);
                        px[y * n + x] = new Color32(255, 255, 255, (byte)(a * 255));
                    }
                tex.SetPixels32(px);
                tex.Apply();
                rounded = Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(r, r, r, r));
            }
        }

        public static RectTransform Rect(Transform parent, string name)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.layer = parent != null ? parent.gameObject.layer : 5;
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            return rt;
        }

        public static RectTransform Anchor(this RectTransform rt, Vector2 min, Vector2 max, Vector2 offMin, Vector2 offMax)
        {
            rt.anchorMin = min; rt.anchorMax = max; rt.offsetMin = offMin; rt.offsetMax = offMax;
            return rt;
        }

        public static Image Panel(Transform parent, string name, Color color, bool round = true)
        {
            var rt = Rect(parent, name);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color;
            if (round) { img.sprite = rounded; img.type = Image.Type.Sliced; }
            return img;
        }

        public static Text Label(Transform parent, string text, int size = 15, Color? color = null, FontStyle style = FontStyle.Normal, TextAnchor? align = null)
        {
            var rt = Rect(parent, "Label");
            var t = rt.gameObject.AddComponent<Text>();
            if (!dark && rt.GetComponentInParent<Canvas>() != null && rt.GetComponentInParent<Canvas>().renderMode == RenderMode.ScreenSpaceOverlay)
            {
                // the light theme uses heavier, slightly larger text so it reads well on white
                if (style == FontStyle.Normal) style = FontStyle.Bold;
                size += 1;
            }
            t.font = font;
            t.fontSize = size;
            t.fontStyle = style;
            t.color = color ?? Fg;
            t.alignment = align ?? (L.Ar ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft);
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            var r = rt.gameObject.AddComponent<RtlText>();
            r.Value = text;
            return t;
        }

        public static void SetText(Text t, string s)
        {
            var r = t.GetComponent<RtlText>();
            if (r) { if (r.Value != (s ?? "")) r.Value = s; }
            else t.text = s;
        }

        public static Button Button(Transform parent, string text, UnityAction onClick, Color? color = null, int size = 14)
        {
            var img = Panel(parent, "Button", color ?? Btn);
            var b = img.gameObject.AddComponent<Button>();
            var colors = b.colors;
            colors.highlightedColor = new Color(1.15f, 1.15f, 1.15f, 1);
            colors.pressedColor = new Color(0.8f, 0.8f, 0.8f, 1);
            colors.colorMultiplier = 1;
            b.colors = colors;
            if (onClick != null) b.onClick.AddListener(onClick);
            var t = Label(img.transform, text, size, null, FontStyle.Normal, TextAnchor.MiddleCenter);
            ((RectTransform)t.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(6, 2), new Vector2(-6, -2));
            var le = img.gameObject.AddComponent<LayoutElement>();
            le.minHeight = 32; le.preferredHeight = 32;
            return b;
        }

        public static void SetOn(Button b, bool on)
        {
            var img = b.GetComponent<Image>();
            img.color = on ? BtnOn : Btn;
            var t = b.GetComponentInChildren<Text>();
            if (t) t.color = on ? Color.white : Fg;
        }

        public static Slider Slider(Transform parent, float min, float max, float value, UnityAction<float> onChange)
        {
            var root = Rect(parent, "Slider");
            var le = root.gameObject.AddComponent<LayoutElement>();
            le.minHeight = 22; le.preferredHeight = 22; le.flexibleWidth = 1;
            var bg = Panel(root, "Background", dark ? new Color(0.22f, 0.27f, 0.36f) : new Color(0.82f, 0.86f, 0.91f));
            ((RectTransform)bg.transform).Anchor(new Vector2(0, 0.35f), new Vector2(1, 0.65f), Vector2.zero, Vector2.zero);
            var fillArea = Rect(root, "Fill Area").Anchor(new Vector2(0, 0.35f), new Vector2(1, 0.65f), new Vector2(4, 0), new Vector2(-8, 0));
            var fill = Panel(fillArea, "Fill", Accent);
            ((RectTransform)fill.transform).Anchor(Vector2.zero, new Vector2(0, 1), new Vector2(-4, 0), new Vector2(4, 0));
            var handleArea = Rect(root, "Handle Slide Area").Anchor(Vector2.zero, Vector2.one, new Vector2(8, 0), new Vector2(-8, 0));
            var handle = Panel(handleArea, "Handle", Color.white);
            var hrt = (RectTransform)handle.transform;
            hrt.Anchor(new Vector2(0, 0), new Vector2(0, 1), new Vector2(-8, 1), new Vector2(8, -1));
            var s = root.gameObject.AddComponent<Slider>();
            s.fillRect = (RectTransform)fill.transform;
            s.handleRect = hrt;
            s.targetGraphic = handle;
            s.direction = L.Ar ? UnityEngine.UI.Slider.Direction.RightToLeft : UnityEngine.UI.Slider.Direction.LeftToRight;
            s.minValue = min; s.maxValue = max; s.value = value;
            if (onChange != null) s.onValueChanged.AddListener(onChange);
            return s;
        }

        public static RectTransform Row(Transform parent, float height, float spacing = 6)
        {
            var rt = Rect(parent, "Row");
            var h = rt.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = spacing;
            h.childControlWidth = true; h.childControlHeight = true;
            h.childForceExpandWidth = true; h.childForceExpandHeight = true;
            h.reverseArrangement = L.Ar;
            var le = rt.gameObject.AddComponent<LayoutElement>();
            le.minHeight = height; le.preferredHeight = height;
            return rt;
        }

        public static VerticalLayoutGroup Column(RectTransform rt, float spacing = 6, int pad = 10)
        {
            var v = rt.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = spacing;
            v.padding = new RectOffset(pad, pad, pad, pad);
            v.childControlWidth = true; v.childControlHeight = true;
            v.childForceExpandWidth = true; v.childForceExpandHeight = false;
            return v;
        }

        /// <summary>Vertical scroll view; returns the content transform (vertical layout).</summary>
        public static RectTransform Scroll(Transform parent, string name)
        {
            var root = Rect(parent, name);
            var sr = root.gameObject.AddComponent<ScrollRect>();
            var vp = Rect(root, "Viewport").Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            vp.gameObject.AddComponent<RectMask2D>();
            var img = vp.gameObject.AddComponent<Image>();
            img.color = new Color(0, 0, 0, 0);
            var content = Rect(vp, "Content");
            content.anchorMin = new Vector2(0, 1); content.anchorMax = new Vector2(1, 1); content.pivot = new Vector2(0.5f, 1);
            content.offsetMin = Vector2.zero; content.offsetMax = Vector2.zero;
            Column(content, 6, 8);
            var fit = content.gameObject.AddComponent<ContentSizeFitter>();
            fit.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            sr.viewport = vp; sr.content = content;
            sr.horizontal = false; sr.vertical = true;
            sr.movementType = ScrollRect.MovementType.Clamped;
            sr.scrollSensitivity = 30;
            return content;
        }

        /// <summary>Text input; Arabic is shown shaped through an overlay label (the field itself only knows logical order).</summary>
        public static InputField Input(Transform parent, string value, string placeholder, UnityAction<string> onEnd, bool multiline = false, float height = 34, UnityAction<string> onChange = null)
        {
            var img = Panel(parent, "Input", dark ? new Color(0.09f, 0.12f, 0.18f) : new Color(1, 1, 1));
            var outline = img.gameObject.AddComponent<Outline>();
            outline.effectColor = dark ? new Color(0.25f, 0.31f, 0.42f) : new Color(0.78f, 0.82f, 0.88f);
            var le = img.gameObject.AddComponent<LayoutElement>();
            le.minHeight = height; le.preferredHeight = height; le.flexibleWidth = 1;
            var align = multiline ? (L.Ar ? TextAnchor.UpperRight : TextAnchor.UpperLeft) : (L.Ar ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft);
            var trt = Rect(img.transform, "Text").Anchor(Vector2.zero, Vector2.one, new Vector2(9, 5), new Vector2(-9, -5));
            var text = trt.gameObject.AddComponent<Text>();
            text.font = font; text.fontSize = 14; text.color = Fg; text.alignment = align; text.supportRichText = false;
            var ph = Label(img.transform, placeholder, 14, Muted, FontStyle.Italic, align);
            ((RectTransform)ph.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(9, 5), new Vector2(-9, -5));
            if (multiline) ph.horizontalOverflow = HorizontalWrapMode.Wrap;
            var shown = Label(img.transform, "", 14, Fg, FontStyle.Normal, align);
            ((RectTransform)shown.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(9, 5), new Vector2(-9, -5));
            if (multiline) shown.horizontalOverflow = HorizontalWrapMode.Wrap;
            var f = img.gameObject.AddComponent<InputField>();
            f.textComponent = text;
            f.placeholder = ph;
            f.lineType = multiline ? InputField.LineType.MultiLineNewline : InputField.LineType.SingleLine;
            f.customCaretColor = true;
            f.caretColor = Accent;
            f.selectionColor = new Color(0.16f, 0.62f, 0.96f, 0.35f);
            f.text = value ?? "";
            void Sync(string v)
            {
                bool ar = ArabicShaper.HasArabic(v);
                text.color = ar ? new Color(0, 0, 0, 0) : Fg;
                shown.gameObject.SetActive(ar);
                if (ar) SetText(shown, v);
            }
            f.onValueChanged.AddListener(v => { Sync(v); onChange?.Invoke(v); });
            if (onEnd != null) f.onEndEdit.AddListener(onEnd);
            Sync(f.text);
            return f;
        }

        /// <summary>True while the user is typing in a text field (keyboard shortcuts are then ignored).</summary>
        public static bool Typing
        {
            get
            {
                var es = UnityEngine.EventSystems.EventSystem.current;
                var go = es != null ? es.currentSelectedGameObject : null;
                var f = go != null ? go.GetComponent<InputField>() : null;
                return f != null && f.isFocused;
            }
        }

        /// <summary>Thin progress bar (0..1).</summary>
        public static RectTransform Bar(Transform parent, float value, Color color, float height = 8)
        {
            var track = Panel(parent, "Bar", dark ? new Color(0.2f, 0.25f, 0.33f) : new Color(0.86f, 0.89f, 0.93f));
            var le = track.gameObject.AddComponent<LayoutElement>();
            le.minHeight = height; le.preferredHeight = height; le.flexibleWidth = 1;
            var fill = Panel(track.transform, "Fill", color);
            ((RectTransform)fill.transform).Anchor(Vector2.zero, new Vector2(Mathf.Clamp01(value), 1), Vector2.zero, Vector2.zero);
            if (L.Ar) { var r = (RectTransform)fill.transform; r.anchorMin = new Vector2(1 - Mathf.Clamp01(value), 0); r.anchorMax = Vector2.one; }
            return (RectTransform)track.transform;
        }

        public static Text Heading(Transform parent, string text)
        {
            var t = Label(parent, text, 15, Accent, FontStyle.Bold);
            var le = t.gameObject.AddComponent<LayoutElement>();
            le.minHeight = 26; le.preferredHeight = 26;
            return t;
        }

        public static Text Para(Transform parent, string text, int size = 14, Color? color = null)
        {
            var t = Label(parent, text, size, color, FontStyle.Normal, L.Ar ? TextAnchor.UpperRight : TextAnchor.UpperLeft);
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.gameObject.AddComponent<ContentSizeFitterProxy>();
            return t;
        }
    }

    /// <summary>Gives a wrapped Text a preferred height so it can live in a vertical layout.</summary>
    [RequireComponent(typeof(Text))]
    public class ContentSizeFitterProxy : MonoBehaviour, ILayoutElement
    {
        Text t;
        Text T => t ? t : (t = GetComponent<Text>());
        public float minWidth => 0;
        public float preferredWidth => 0;
        public float flexibleWidth => 1;
        public float minHeight => preferredHeight;
        public float preferredHeight
        {
            get
            {
                var rt = (RectTransform)transform;
                var s = T.GetGenerationSettings(new Vector2(Mathf.Max(10, rt.rect.width), 0));
                return T.cachedTextGeneratorForLayout.GetPreferredHeight(T.text, s) / Mathf.Max(0.01f, T.pixelsPerUnit) + 4;
            }
        }
        public float flexibleHeight => 0;
        public int layoutPriority => 2;
        public void CalculateLayoutInputHorizontal() { }
        public void CalculateLayoutInputVertical() { }
    }
}
