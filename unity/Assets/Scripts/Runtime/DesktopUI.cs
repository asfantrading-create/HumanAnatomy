using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Asfan.Anatomy
{
    /// <summary>
    /// The desktop window interface, built in code and rebuilt when the language, theme or text size changes.
    /// Layout: top bar (logo, title, search, licence, settings…), tools panel, right panel
    /// (structure info / learning centre / quiz / lesson player), bottom toolbar and footer.
    /// </summary>
    public partial class DesktopUI : MonoBehaviour
    {
        public AnatomyApp app;
        AnatomyModel M => app.model;
        Lessons Le => app.lessons;
        Canvas canvas;
        CanvasScaler scaler;
        RectTransform root, mainUI, rightContent, presentUI, modalLayer, searchResults, toastRt;
        public RectTransform LabelsLayer { get; private set; }
        Text tooltip, vrStatus, loadingText, rightTitle, licenseChipText, presentText, presentStep, toastText, examTimer;
        Button vrButton, detectButton, maleBtn, femaleBtn, xrayBtn, heartBtn, breathBtn, flowBtn, rotateBtn, labelsBtn, learnBtn, quizBtn, licenseChip, rightClose;
        readonly Button[] secBtn = new Button[3];
        readonly Dictionary<SystemState, Button> sysBtn = new Dictionary<SystemState, Button>();
        readonly Dictionary<SystemState, Slider> sysSlider = new Dictionary<SystemState, Slider>();
        RectTransform loading, vrOverlay;
        Image loadingBar;
        InputField search;
        string expandedGroup;
        float toastUntil;
        static Texture2D logo;
        public bool learnOpen, presenting;

        public static float FontScale = 1;

        public static Texture2D Logo
        {
            get
            {
                if (logo == null)
                {
                    var path = Path.Combine(Application.streamingAssetsPath, "asfan-logo.png");
                    if (File.Exists(path)) { logo = new Texture2D(2, 2); logo.LoadImage(File.ReadAllBytes(path)); }
                }
                return logo;
            }
        }

        public void Build()
        {
            UIKit.Init();
            if (canvas) Destroy(canvas.gameObject);
            sysBtn.Clear();
            sysSlider.Clear();
            if (EventSystem.current == null)
            {
                var es = new GameObject("EventSystem", typeof(EventSystem));
#if ENABLE_INPUT_SYSTEM
                es.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();
#else
                es.AddComponent<StandaloneInputModule>();
#endif
            }
            var cgo = new GameObject("Desktop UI", typeof(RectTransform));
            cgo.layer = 5;
            canvas = cgo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            scaler = cgo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.matchWidthOrHeight = 0.5f;
            ApplyFontScale();
            cgo.AddComponent<GraphicRaycaster>();
            root = (RectTransform)cgo.transform;

            LabelsLayer = UIKit.Rect(root, "Labels").Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            app.labels.layer = LabelsLayer;
            mainUI = UIKit.Rect(root, "Main").Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            TopBar();
            ToolsPanel();
            RightPanel();
            BottomBar();
            Footer();
            searchResults = UIKit.Panel(mainUI, "Search results", UIKit.Bg).rectTransform;
            searchResults.anchorMin = searchResults.anchorMax = new Vector2(0.5f, 1);
            searchResults.pivot = new Vector2(0.5f, 1);
            searchResults.anchoredPosition = new Vector2(0, -56);
            searchResults.sizeDelta = new Vector2(460, 10);
            UIKit.Column(searchResults, 2, 6);
            searchResults.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            searchResults.gameObject.SetActive(false);

            PresentationBar();
            tooltip = UIKit.Label(root, "", 15, Color.white, FontStyle.Bold, TextAnchor.MiddleCenter);
            var tb = tooltip.gameObject.AddComponent<Outline>();
            tb.effectColor = new Color(0, 0, 0, 0.85f);
            tb.effectDistance = new Vector2(1.5f, -1.5f);
            ((RectTransform)tooltip.transform).sizeDelta = new Vector2(600, 30);
            Toast();
            modalLayer = UIKit.Rect(root, "Modals").Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            LoadingOverlay();
            VROverlay();
            Refresh();
            if (app.license != null) OnLicense(app.license.Current);
        }

        public void ApplyFontScale()
        {
            if (scaler) scaler.referenceResolution = new Vector2(1920, 1080) / Mathf.Clamp(FontScale, 0.7f, 1.6f);
        }

        // ------------------------------------------------------------------ top bar
        void TopBar()
        {
            var bar = UIKit.Panel(mainUI, "Top", UIKit.Bg, false);
            ((RectTransform)bar.transform).Anchor(new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, -60), Vector2.zero);
            float lx = L.Ar ? -1 : 1;
            float x = 16;
            if (Logo != null)
            {
                var btn = UIKit.Rect(bar.transform, "Logo");
                var raw = btn.gameObject.AddComponent<RawImage>();
                raw.texture = Logo;
                float h = 38, w = h * Logo.width / Logo.height;
                btn.anchorMin = btn.anchorMax = new Vector2(L.Ar ? 1 : 0, 0.5f);
                btn.pivot = new Vector2(L.Ar ? 1 : 0, 0.5f);
                btn.anchoredPosition = new Vector2(x * lx, 0);
                btn.sizeDelta = new Vector2(w, h);
                var b = btn.gameObject.AddComponent<Button>();
                b.targetGraphic = raw;
                b.onClick.AddListener(ShowAbout);
                x += w + 14;
            }
            var title = UIKit.Label(bar.transform, L.T("title"), 19, null, FontStyle.Bold);
            var trt = (RectTransform)title.transform;
            trt.anchorMin = trt.anchorMax = new Vector2(L.Ar ? 1 : 0, 0.5f);
            trt.pivot = new Vector2(L.Ar ? 1 : 0, 0.5f);
            trt.anchoredPosition = new Vector2(x * lx, 0);
            trt.sizeDelta = new Vector2(330, 40);

            // search (centre)
            var sr = UIKit.Rect(bar.transform, "Search");
            sr.anchorMin = sr.anchorMax = new Vector2(0.5f, 0.5f);
            sr.sizeDelta = new Vector2(460, 36);
            UIKit.Column(sr, 0, 0);
            search = UIKit.Input(sr, "", L.T("search"), null, false, 36, RunSearch);

            var right = UIKit.Rect(bar.transform, "Actions");
            right.anchorMin = right.anchorMax = new Vector2(L.Ar ? 0 : 1, 0.5f);
            right.pivot = new Vector2(L.Ar ? 0 : 1, 0.5f);
            right.anchoredPosition = new Vector2(-16 * lx, 0);
            right.sizeDelta = new Vector2(560, 38);
            var h2 = right.gameObject.AddComponent<HorizontalLayoutGroup>();
            h2.spacing = 6; h2.childControlWidth = true; h2.childControlHeight = true; h2.childForceExpandWidth = false;
            h2.childAlignment = L.Ar ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight;
            h2.reverseArrangement = L.Ar;
            licenseChip = UIKit.Button(right, "", ShowLicense, null, 13);
            licenseChipText = licenseChip.GetComponentInChildren<Text>();
            Pref(licenseChip.gameObject, 150);
            Pref(UIKit.Button(right, L.T("settings"), ShowSettings, null, 13).gameObject, 90);
            Pref(UIKit.Button(right, L.T("help"), ShowHelp, null, 13).gameObject, 70);
            Pref(UIKit.Button(right, "A−", () => app.SetFontScale(FontScale - 0.1f), null, 13).gameObject, 40);
            Pref(UIKit.Button(right, "A+", () => app.SetFontScale(FontScale + 0.1f), null, 13).gameObject, 40);
            Pref(UIKit.Button(right, L.T("lang"), app.ToggleLanguage, null, 13).gameObject, 80);
        }

        static void Pref(GameObject go, float w)
        {
            var le = go.GetComponent<LayoutElement>();
            if (le == null) le = go.AddComponent<LayoutElement>();
            le.preferredWidth = w; le.minWidth = w;
        }

        // ------------------------------------------------------------------ tools panel
        void ToolsPanel()
        {
            bool toolsLeft = !L.Ar;
            var tools = UIKit.Panel(mainUI, "Tools", UIKit.Bg);
            Side((RectTransform)tools.transform, toolsLeft, 330);
            var c = UIKit.Scroll(tools.transform, "Scroll");
            ((RectTransform)c.parent.parent).Anchor(Vector2.zero, Vector2.one, new Vector2(4, 4), new Vector2(-4, -4));

            UIKit.Heading(c, L.T("body"));
            var sexRow = UIKit.Row(c, 34);
            maleBtn = UIKit.Button(sexRow, L.T("male"), () => { M.SetSex(false); app.RefreshAll(); });
            femaleBtn = UIKit.Button(sexRow, L.T("female"), () => { M.SetSex(true); app.RefreshAll(); });

            UIKit.Heading(c, L.T("systems"));
            var pre = UIKit.Row(c, 30);
            UIKit.Button(pre, L.T("all"), () => app.Preset("all"), null, 12);
            UIKit.Button(pre, L.T("organs"), () => app.Preset("organs"), null, 12);
            UIKit.Button(pre, L.T("skeleton"), () => app.Preset("skeleton"), null, 12);
            foreach (var s in M.systemList)
            {
                var row = UIKit.Row(c, 30);
                var st = s;
                var b = UIKit.Button(row, L.Ar ? s.def.ar : s.def.en, () => { M.PushUndo(); st.visible = !st.visible; M.ApplyAll(); app.RefreshAll(); }, null, 13);
                var dot = UIKit.Panel(b.transform, "Dot", s.color);
                var drt = (RectTransform)dot.transform;
                drt.anchorMin = drt.anchorMax = new Vector2(L.Ar ? 1 : 0, 0.5f);
                drt.sizeDelta = new Vector2(10, 10);
                drt.anchoredPosition = new Vector2(L.Ar ? -10 : 10, 0);
                sysBtn[s] = b;
                b.GetComponent<LayoutElement>().flexibleWidth = 1.4f;
                var sl = UIKit.Slider(row, 0, 1, s.opacity, v => { st.opacity = v; if (!st.visible && v > 0) { st.visible = true; UIKit.SetOn(sysBtn[st], true); } M.ApplyAll(); });
                sl.GetComponent<LayoutElement>().flexibleWidth = 1;
                sysSlider[s] = sl;
            }

            UIKit.Heading(c, L.T("tools"));
            var r1 = UIKit.Row(c, 34);
            xrayBtn = UIKit.Button(r1, L.T("xray"), () => { M.xray = !M.xray; M.ApplyAll(); app.RefreshAll(); });
            UIKit.Button(r1, L.T("showAll"), () => { M.ShowAll(); app.RefreshAll(); });
            var r2 = UIKit.Row(c, 34);
            heartBtn = UIKit.Button(r2, L.T("heart"), () => { M.heartbeat = !M.heartbeat; app.RefreshAll(); });
            breathBtn = UIKit.Button(r2, L.T("breath"), () => { M.breathing = !M.breathing; app.RefreshAll(); });
            flowBtn = UIKit.Button(r2, L.T("flow"), () => { M.flow = !M.flow; app.RefreshAll(); });
            var r3 = UIKit.Row(c, 26);
            var el = UIKit.Label(r3, L.T("explode"), 13, UIKit.Muted);
            el.gameObject.AddComponent<LayoutElement>().flexibleWidth = 0.6f;
            UIKit.Slider(r3, 0, 1, M.explode, v => M.explode = v);

            UIKit.Heading(c, L.T("section"));
            string[] keys = { "secX", "secY", "secZ" };
            float[] lo = { -0.3f, 0f, -0.25f }, hi = { 0.3f, 1.9f, 0.25f };
            for (int a = 0; a < 3; a++)
            {
                int ax = a;
                var lab = UIKit.Row(c, 30);
                secBtn[a] = UIKit.Button(lab, L.T(keys[a]), () => { M.secOn[ax] = !M.secOn[ax]; app.RefreshAll(); }, null, 13);
                secBtn[a].GetComponent<LayoutElement>().flexibleWidth = 3;
                var flip = UIKit.Button(lab, L.T("flip"), () => M.secFlip[ax] = !M.secFlip[ax], null, 13);
                flip.GetComponent<LayoutElement>().flexibleWidth = 1;
                var sr = UIKit.Row(c, 22);
                UIKit.Slider(sr, lo[a], hi[a], M.secValue[a], v => { M.secValue[ax] = v; if (!M.secOn[ax]) { M.secOn[ax] = true; UIKit.SetOn(secBtn[ax], true); } });
            }
            UIKit.Para(c, L.T("hint"), 12, UIKit.Muted);
        }

        void Side(RectTransform rt, bool left, float width)
        {
            rt.anchorMin = new Vector2(left ? 0 : 1, 0);
            rt.anchorMax = new Vector2(left ? 0 : 1, 1);
            rt.pivot = new Vector2(left ? 0 : 1, 0.5f);
            rt.offsetMin = new Vector2(left ? 12 : -12 - width, 98);
            rt.offsetMax = new Vector2(left ? 12 + width : -12, -70);
        }

        // ------------------------------------------------------------------ right panel
        void RightPanel()
        {
            var info = UIKit.Panel(mainUI, "Right", UIKit.Bg);
            Side((RectTransform)info.transform, L.Ar, 390);
            var head = UIKit.Rect(info.transform, "Head").Anchor(new Vector2(0, 1), Vector2.one, new Vector2(10, -46), new Vector2(-10, -6));
            rightTitle = UIKit.Label(head, "", 17, UIKit.Accent, FontStyle.Bold);
            ((RectTransform)rightTitle.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(L.Ar ? 40 : 4, 0), new Vector2(L.Ar ? -4 : -40, 0));
            rightClose = UIKit.Button(head, "✕", CloseRight, null, 14);
            var crt = (RectTransform)rightClose.transform;
            crt.anchorMin = crt.anchorMax = new Vector2(L.Ar ? 0 : 1, 0.5f);
            crt.pivot = new Vector2(L.Ar ? 0 : 1, 0.5f);
            crt.sizeDelta = new Vector2(34, 32);
            crt.anchoredPosition = Vector2.zero;
            rightContent = UIKit.Scroll(info.transform, "Scroll");
            ((RectTransform)rightContent.parent.parent).Anchor(Vector2.zero, Vector2.one, new Vector2(4, 4), new Vector2(-4, -50));
        }

        void CloseRight()
        {
            if (Le.tour != null) Le.EndTour();
            else if (Le.quiz != null) Le.EndQuiz();
            else if (learnOpen) { if (Le.exam != null) Le.EndExam(); editor = null; learnOpen = false; }
            else app.SelectPart(null);
            Refresh();
        }

        // ------------------------------------------------------------------ bottom toolbar
        void BottomBar()
        {
            var bar = UIKit.Panel(mainUI, "Toolbar", UIKit.Bg, false);
            ((RectTransform)bar.transform).Anchor(Vector2.zero, new Vector2(1, 0), new Vector2(0, 30), new Vector2(0, 86));
            var row = UIKit.Rect(bar.transform, "Row").Anchor(Vector2.zero, Vector2.one, new Vector2(12, 8), new Vector2(-12, -8));
            var h = row.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = 6; h.childControlWidth = true; h.childControlHeight = true; h.childForceExpandWidth = false;
            h.childAlignment = TextAnchor.MiddleCenter;
            h.reverseArrangement = L.Ar;
            void B(string text, UnityEngine.Events.UnityAction a, float w, ref Button store, Color? color = null)
            {
                store = UIKit.Button(row, text, a, color, 13);
                Pref(store.gameObject, w);
            }
            Button dummy = null;
            B(L.T("front"), () => app.SetView("front"), 70, ref dummy);
            B(L.T("back"), () => app.SetView("back"), 70, ref dummy);
            B(L.T("left"), () => app.SetView("left"), 70, ref dummy);
            B(L.T("right"), () => app.SetView("right"), 70, ref dummy);
            B(L.T("top"), () => app.SetView("top"), 70, ref dummy);
            Gap(row, 10);
            B(L.T("rotate"), () => { app.autoRotate = !app.autoRotate; Refresh(); }, 80, ref rotateBtn);
            B(L.T("labels"), () => { app.labels.Set(!app.labels.on); Refresh(); }, 90, ref labelsBtn);
            B(L.T("shot"), app.Screenshot, 70, ref dummy);
            B(L.T("undo"), () => { if (M.Undo()) app.RefreshAll(); }, 70, ref dummy);
            B(L.T("reset"), app.ResetAll, 100, ref dummy);
            Gap(row, 10);
            B(L.T("quizBtn"), () => { if (Le.quiz != null) Le.EndQuiz(); else Le.StartQuiz(); }, 110, ref quizBtn);
            B(L.T("learnBtn"), () => { learnOpen = !learnOpen; if (!learnOpen) { Le.EndExam(); editor = null; } Refresh(); }, 130, ref learnBtn);
            B(L.T("present"), () => SetPresenting(true), 110, ref dummy);
            Gap(row, 16);
            vrStatus = UIKit.Label(row, "", 13, UIKit.Muted, FontStyle.Normal, TextAnchor.MiddleCenter);
            Pref(vrStatus.gameObject, 190);
            B(L.T("vrRetry"), () => app.vr.Probe(), 70, ref detectButton);
            B(L.T("vrEnter"), () => app.vr.EnterVR(), 190, ref vrButton, new Color(0.12f, 0.62f, 0.36f));
        }

        static void Gap(Transform row, float w)
        {
            var g = UIKit.Rect(row, "Gap");
            var le = g.gameObject.AddComponent<LayoutElement>();
            le.minWidth = w; le.preferredWidth = w;
        }

        void Footer()
        {
            var bar = UIKit.Panel(mainUI, "Footer", UIKit.dark ? new Color(0.04f, 0.06f, 0.1f, 0.95f) : new Color(0.95f, 0.96f, 0.98f, 1), false);
            ((RectTransform)bar.transform).Anchor(Vector2.zero, new Vector2(1, 0), Vector2.zero, new Vector2(0, 30));
            var t = UIKit.Label(bar.transform, L.T("footer"), 12, UIKit.Muted, FontStyle.Normal, TextAnchor.MiddleCenter);
            ((RectTransform)t.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(12, 0), new Vector2(-12, 0));
        }

        // ------------------------------------------------------------------ presentation mode (classroom projector)
        void PresentationBar()
        {
            presentUI = UIKit.Rect(root, "Presentation").Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var bar = UIKit.Panel(presentUI, "Caption", new Color(0.03f, 0.05f, 0.09f, 0.88f));
            ((RectTransform)bar.transform).Anchor(new Vector2(0.08f, 0), new Vector2(0.92f, 0), new Vector2(0, 24), new Vector2(0, 230));
            presentStep = UIKit.Label(bar.transform, "", 18, new Color(0.55f, 0.75f, 1f), FontStyle.Bold);
            ((RectTransform)presentStep.transform).Anchor(new Vector2(0, 1), Vector2.one, new Vector2(24, -40), new Vector2(-24, -8));
            presentText = UIKit.Label(bar.transform, "", 30, Color.white, FontStyle.Normal, L.Ar ? TextAnchor.UpperRight : TextAnchor.UpperLeft);
            presentText.horizontalOverflow = HorizontalWrapMode.Wrap;
            ((RectTransform)presentText.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(24, 64), new Vector2(-24, -44));
            var row = UIKit.Rect(bar.transform, "Buttons").Anchor(Vector2.zero, new Vector2(1, 0), new Vector2(24, 10), new Vector2(-24, 54));
            var h = row.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = 10; h.childControlWidth = true; h.childControlHeight = true; h.childForceExpandWidth = false;
            h.childAlignment = TextAnchor.MiddleCenter; h.reverseArrangement = L.Ar;
            Pref(UIKit.Button(row, L.T("prev"), Le.PrevStep, null, 16).gameObject, 140);
            Pref(UIKit.Button(row, L.T("next"), Le.NextStep, UIKit.BtnOn, 16).gameObject, 140);
            Pref(UIKit.Button(row, L.T("speak"), () => { if (Le.Step != null) app.voice.SpeakText(Le.Step.Text); }, null, 16).gameObject, 120);
            Pref(UIKit.Button(row, L.T("fullscreen"), app.ToggleFullScreen, null, 16).gameObject, 140);
            Pref(UIKit.Button(row, L.T("presentExit"), () => SetPresenting(false), new Color(0.7f, 0.2f, 0.2f), 16).gameObject, 170);
            presentUI.gameObject.SetActive(false);
        }

        public void SetPresenting(bool on)
        {
            presenting = on;
            if (on) learnOpen = false;
            Refresh();
        }

        // ------------------------------------------------------------------ overlays
        void Toast()
        {
            var t = UIKit.Panel(root, "Toast", new Color(0.05f, 0.08f, 0.13f, 0.95f));
            toastRt = (RectTransform)t.transform;
            toastRt.anchorMin = toastRt.anchorMax = new Vector2(0.5f, 0);
            toastRt.pivot = new Vector2(0.5f, 0);
            toastRt.anchoredPosition = new Vector2(0, 110);
            toastRt.sizeDelta = new Vector2(820, 46);
            toastText = UIKit.Label(toastRt, "", 15, Color.white, FontStyle.Normal, TextAnchor.MiddleCenter);
            ((RectTransform)toastText.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(14, 0), new Vector2(-14, 0));
            toastRt.gameObject.SetActive(false);
        }

        public void ShowToast(string text, float seconds = 4)
        {
            if (!toastRt) return;
            UIKit.SetText(toastText, text);
            toastRt.gameObject.SetActive(true);
            toastRt.SetAsLastSibling();
            toastUntil = Time.unscaledTime + seconds;
        }

        void LoadingOverlay()
        {
            var o = UIKit.Panel(root, "Loading", UIKit.dark ? new Color(0.04f, 0.06f, 0.10f, 0.97f) : new Color(1, 1, 1, 0.97f), false);
            loading = (RectTransform)o.transform;
            loading.Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            if (Logo != null)
            {
                var raw = UIKit.Rect(loading, "Logo").gameObject.AddComponent<RawImage>();
                raw.texture = Logo;
                var r = (RectTransform)raw.transform;
                r.anchorMin = r.anchorMax = new Vector2(0.5f, 0.62f);
                r.sizeDelta = new Vector2(70f * Logo.width / Logo.height, 70);
            }
            loadingText = UIKit.Label(loading, L.T("loading"), 20, null, FontStyle.Normal, TextAnchor.MiddleCenter);
            ((RectTransform)loadingText.transform).Anchor(new Vector2(0.2f, 0.5f), new Vector2(0.8f, 0.5f), new Vector2(0, 10), new Vector2(0, 60));
            var track = UIKit.Panel(loading, "Track", UIKit.Btn);
            ((RectTransform)track.transform).Anchor(new Vector2(0.35f, 0.5f), new Vector2(0.65f, 0.5f), new Vector2(0, -16), new Vector2(0, -6));
            loadingBar = UIKit.Panel(track.transform, "Bar", UIKit.Accent);
            ((RectTransform)loadingBar.transform).Anchor(Vector2.zero, new Vector2(0, 1), Vector2.zero, Vector2.zero);
        }

        void VROverlay()
        {
            var o = UIKit.Panel(root, "VR", new Color(0.03f, 0.05f, 0.09f, 0.96f), false);
            vrOverlay = (RectTransform)o.transform;
            vrOverlay.Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var col = UIKit.Rect(vrOverlay, "Col").Anchor(new Vector2(0.25f, 0.3f), new Vector2(0.75f, 0.7f), Vector2.zero, Vector2.zero);
            UIKit.Column(col, 16, 10).childAlignment = TextAnchor.MiddleCenter;
            var t = UIKit.Para(col, L.T("vrRunning"), 24, Color.white); t.alignment = TextAnchor.MiddleCenter;
            var h = UIKit.Para(col, L.T("vrHelp"), 15, new Color(0.7f, 0.78f, 0.9f)); h.alignment = TextAnchor.MiddleCenter;
            var b = UIKit.Button(col, L.T("vrExit"), () => app.vr.ExitVR(), new Color(0.75f, 0.2f, 0.2f), 16);
            b.GetComponent<LayoutElement>().preferredHeight = 44;
            vrOverlay.gameObject.SetActive(false);
        }

        // ------------------------------------------------------------------ search
        void RunSearch(string q)
        {
            if (!searchResults) return;
            for (int i = searchResults.childCount - 1; i >= 0; i--) Destroy(searchResults.GetChild(i).gameObject);
            var n = Normalize(q.Trim());
            if (n.Length == 0 || !M.loaded) { searchResults.gameObject.SetActive(false); return; }
            var terms = n.Split(new[] { ' ' }, System.StringSplitOptions.RemoveEmptyEntries);
            var found = M.parts.Where(p => M.SexOk(p) && terms.All(w => SearchText(p).Contains(w))).OrderBy(p => p.Name.Length).Take(12).ToList();
            if (found.Count == 0) UIKit.Label(searchResults, L.T("noResults"), 13, UIKit.Muted).gameObject.AddComponent<LayoutElement>().minHeight = 28;
            foreach (var p in found)
            {
                var part = p;
                var b = UIKit.Button(searchResults, p.Name + "   —   " + p.OtherName, () =>
                {
                    searchResults.gameObject.SetActive(false);
                    search.text = "";
                    EventSystem.current.SetSelectedGameObject(null);
                    app.SelectPart(part, true);
                }, UIKit.Card, 13);
                b.GetComponentInChildren<Text>().alignment = L.Ar ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft;
            }
            searchResults.gameObject.SetActive(true);
            searchResults.SetAsLastSibling();
        }

        readonly Dictionary<Part, string> searchCache = new Dictionary<Part, string>();
        string SearchText(Part p)
        {
            if (!searchCache.TryGetValue(p, out var s)) searchCache[p] = s = Normalize(p.def.ar + " " + p.def.en);
            return s;
        }

        static string Normalize(string s)
        {
            var sb = new System.Text.StringBuilder(s.Length);
            foreach (var ch in s.ToLowerInvariant())
            {
                if ((ch >= 0x064B && ch <= 0x0652) || ch == 0x0640) continue;
                sb.Append(ch == 'أ' || ch == 'إ' || ch == 'آ' ? 'ا' : ch == 'ة' ? 'ه' : ch == 'ى' ? 'ي' : ch);
            }
            return System.Text.RegularExpressions.Regex.Replace(sb.ToString(), @"(^|\s)ال", "$1");
        }

        public void FocusSearch()
        {
            if (search) { search.Select(); search.ActivateInputField(); }
        }

        // ------------------------------------------------------------------ state
        public void Refresh()
        {
            if (!canvas) return;
            mainUI.gameObject.SetActive(!presenting);
            presentUI.gameObject.SetActive(presenting);
            UIKit.SetOn(maleBtn, !M.female);
            UIKit.SetOn(femaleBtn, M.female);
            UIKit.SetOn(xrayBtn, M.xray);
            UIKit.SetOn(heartBtn, M.heartbeat);
            UIKit.SetOn(breathBtn, M.breathing);
            UIKit.SetOn(flowBtn, M.flow);
            UIKit.SetOn(rotateBtn, app.autoRotate);
            UIKit.SetOn(labelsBtn, app.labels.on);
            UIKit.SetOn(quizBtn, Le.quiz != null);
            UIKit.SetOn(learnBtn, learnOpen);
            for (int a = 0; a < 3; a++) UIKit.SetOn(secBtn[a], M.secOn[a]);
            foreach (var kv in sysBtn) UIKit.SetOn(kv.Value, kv.Key.visible);
            foreach (var kv in sysSlider) kv.Value.SetValueWithoutNotify(kv.Key.opacity);
            if (presenting)
            {
                var st = Le.Step;
                UIKit.SetText(presentStep, Le.tour != null ? Le.tour.Title + "   •   " + L.T("step", "i", Le.step + 1, "n", Le.tour.steps.Count) : "");
                UIKit.SetText(presentText, st != null ? st.Text : "");
            }
            RebuildRight();
        }

        public void UpdateTimer(string t)
        {
            if (examTimer) UIKit.SetText(examTimer, L.T("timeLeft", "t", t));
        }

        void Update()
        {
            if (!canvas) return;
            loading.gameObject.SetActive(!M.loaded);
            if (!M.loaded)
            {
                UIKit.SetText(loadingText, M.error ?? L.T("loading"));
                ((RectTransform)loadingBar.transform).anchorMax = new Vector2(M.progress, 1);
            }
            vrOverlay.gameObject.SetActive(app.vr.State == VRManager.Status.Running);
            if (toastRt && toastRt.gameObject.activeSelf && Time.unscaledTime > toastUntil) toastRt.gameObject.SetActive(false);
            var st = app.vr.State;
            bool licensed = app.license == null || app.license.Current.allowed;
            UIKit.SetText(vrStatus, !licensed ? L.T("vrLocked") : st == VRManager.Status.Searching ? L.T("vrSearching") : st == VRManager.Status.Starting ? L.T("vrStarting")
                : st == VRManager.Status.Failed ? L.T("vrFailed") : st == VRManager.Status.NotFound ? L.T("vrNone") : L.T("vrReady"));
            vrButton.interactable = licensed && (st == VRManager.Status.Available || st == VRManager.Status.Failed);
            detectButton.gameObject.SetActive(st == VRManager.Status.NotFound || st == VRManager.Status.Failed);

            // hover label
            var h = M.hovered;
            tooltip.gameObject.SetActive(h != null && !app.orbit.PointerOverUI && !(Le.quiz != null && !Le.quiz.answered));
            if (tooltip.gameObject.activeSelf)
            {
                UIKit.SetText(tooltip, h.Name);
                RectTransformUtility.ScreenPointToLocalPointInRectangle(root, DesktopInput.MousePosition, null, out var lp);
                ((RectTransform)tooltip.transform).anchoredPosition = lp + new Vector2(0, 28);
            }
            if (searchResults && searchResults.gameObject.activeSelf && DesktopInput.Down(0) && !search.isFocused)
            {
                // close the results when clicking elsewhere (a click on a result is handled by its button first)
                var es = EventSystem.current;
                var over = es != null && es.IsPointerOverGameObject();
                if (!over) searchResults.gameObject.SetActive(false);
            }
        }
    }
}
