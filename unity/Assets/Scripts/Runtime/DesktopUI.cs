using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Asfan.Anatomy
{
    /// <summary>The desktop window interface (built in code, rebuilt when language or theme changes).</summary>
    public class DesktopUI : MonoBehaviour
    {
        public AnatomyApp app;
        AnatomyModel M => app.model;
        Canvas canvas;
        RectTransform root;
        Text infoName, infoOther, infoMeta, infoDesc, tooltip, vrStatus, loadingText;
        Button vrButton, detectButton, maleBtn, femaleBtn, xrayBtn, heartBtn, breathBtn, flowBtn, speakBtn;
        readonly Button[] secBtn = new Button[3];
        readonly Dictionary<SystemState, Button> sysBtn = new Dictionary<SystemState, Button>();
        RectTransform browse, loading, vrOverlay;
        Image loadingBar;
        string expandedGroup;
        static Texture2D logo;

        public void Build()
        {
            UIKit.Init();
            if (canvas) Destroy(canvas.gameObject);
            sysBtn.Clear();
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
            var scaler = cgo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 0.5f;
            cgo.AddComponent<GraphicRaycaster>();
            root = (RectTransform)cgo.transform;

            TopBar();
            SidePanels();
            Footer();
            tooltip = UIKit.Label(root, "", 15, Color.white, FontStyle.Bold, TextAnchor.MiddleCenter);
            var tb = tooltip.gameObject.AddComponent<Outline>();
            tb.effectColor = new Color(0, 0, 0, 0.85f);
            tb.effectDistance = new Vector2(1.5f, -1.5f);
            ((RectTransform)tooltip.transform).sizeDelta = new Vector2(600, 30);
            LoadingOverlay();
            VROverlay();
            Refresh();
        }

        // ------------------------------------------------------------------ layout
        void TopBar()
        {
            var bar = UIKit.Panel(root, "Top", UIKit.Bg, false);
            ((RectTransform)bar.transform).Anchor(new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, -60), Vector2.zero);
            if (logo == null)
            {
                var path = Path.Combine(Application.streamingAssetsPath, "asfan-logo.png");
                if (File.Exists(path)) { logo = new Texture2D(2, 2); logo.LoadImage(File.ReadAllBytes(path)); }
            }
            float lx = L.Ar ? -1 : 1;
            if (logo != null)
            {
                var raw = UIKit.Rect(bar.transform, "Logo").gameObject.AddComponent<RawImage>();
                raw.texture = logo;
                var rt = (RectTransform)raw.transform;
                float h = 40, w = h * logo.width / logo.height;
                rt.anchorMin = rt.anchorMax = new Vector2(L.Ar ? 1 : 0, 0.5f);
                rt.pivot = new Vector2(L.Ar ? 1 : 0, 0.5f);
                rt.anchoredPosition = new Vector2(16 * lx, 0);
                rt.sizeDelta = new Vector2(w, h);
            }
            var title = UIKit.Label(bar.transform, L.T("title"), 22, null, FontStyle.Bold);
            var trt = (RectTransform)title.transform;
            trt.anchorMin = trt.anchorMax = new Vector2(L.Ar ? 1 : 0, 0.5f);
            trt.pivot = new Vector2(L.Ar ? 1 : 0, 0.5f);
            trt.anchoredPosition = new Vector2(200 * lx, 0);
            trt.sizeDelta = new Vector2(520, 40);

            var right = UIKit.Rect(bar.transform, "Actions");
            right.anchorMin = right.anchorMax = new Vector2(L.Ar ? 0 : 1, 0.5f);
            right.pivot = new Vector2(L.Ar ? 0 : 1, 0.5f);
            right.anchoredPosition = new Vector2(-16 * lx, 0);
            right.sizeDelta = new Vector2(880, 40);
            var h2 = right.gameObject.AddComponent<HorizontalLayoutGroup>();
            h2.spacing = 8; h2.childControlWidth = true; h2.childControlHeight = true; h2.childForceExpandWidth = false;
            h2.childAlignment = L.Ar ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight;
            h2.reverseArrangement = L.Ar;
            vrStatus = UIKit.Label(right, "", 14, UIKit.Muted, FontStyle.Normal, L.Ar ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight);
            Pref(vrStatus.gameObject, 300);
            detectButton = UIKit.Button(right, L.T("vrRetry"), () => app.vr.Probe());
            Pref(detectButton.gameObject, 80);
            vrButton = UIKit.Button(right, L.T("vrEnter"), () => app.vr.EnterVR(), new Color(0.12f, 0.62f, 0.36f), 15);
            Pref(vrButton.gameObject, 210);
            var theme = UIKit.Button(right, L.T("theme"), () => app.ToggleTheme());
            Pref(theme.gameObject, 140);
            var lang = UIKit.Button(right, L.T("lang"), () => app.ToggleLanguage());
            Pref(lang.gameObject, 90);
        }

        static void Pref(GameObject go, float w)
        {
            var le = go.GetComponent<LayoutElement>();
            if (le == null) le = go.AddComponent<LayoutElement>();
            le.preferredWidth = w; le.minWidth = w;
        }

        void SidePanels()
        {
            // tools panel on the reading side, information on the other
            bool toolsLeft = !L.Ar;
            var tools = UIKit.Panel(root, "Tools", UIKit.Bg);
            Side((RectTransform)tools.transform, toolsLeft, 330);
            var c = UIKit.Scroll(tools.transform, "Scroll");
            ((RectTransform)c.parent.parent).Anchor(Vector2.zero, Vector2.one, new Vector2(4, 4), new Vector2(-4, -4));

            UIKit.Heading(c, L.T("body"));
            var sexRow = UIKit.Row(c, 34);
            maleBtn = UIKit.Button(sexRow, L.T("male"), () => { M.SetSex(false); Refresh(); });
            femaleBtn = UIKit.Button(sexRow, L.T("female"), () => { M.SetSex(true); Refresh(); });

            UIKit.Heading(c, L.T("systems"));
            foreach (var s in M.systemList)
            {
                var row = UIKit.Row(c, 30);
                var st = s;
                var b = UIKit.Button(row, L.Ar ? s.def.ar : s.def.en, () => { st.visible = !st.visible; M.ApplyAll(); Refresh(); }, null, 13);
                var dot = UIKit.Panel(b.transform, "Dot", s.color);
                var drt = (RectTransform)dot.transform;
                drt.anchorMin = drt.anchorMax = new Vector2(L.Ar ? 1 : 0, 0.5f);
                drt.sizeDelta = new Vector2(10, 10);
                drt.anchoredPosition = new Vector2(L.Ar ? -10 : 10, 0);
                sysBtn[s] = b;
                var le = b.GetComponent<LayoutElement>(); le.flexibleWidth = 1.4f;
                var sl = UIKit.Slider(row, 0, 1, s.opacity, v => { st.opacity = v; M.ApplyAll(); });
                sl.GetComponent<LayoutElement>().flexibleWidth = 1;
            }

            UIKit.Heading(c, L.T("tools"));
            var r1 = UIKit.Row(c, 34);
            xrayBtn = UIKit.Button(r1, L.T("xray"), () => { M.xray = !M.xray; M.ApplyAll(); Refresh(); });
            UIKit.Button(r1, L.T("showAll"), () => { M.ShowAll(); Refresh(); });
            var r2 = UIKit.Row(c, 34);
            heartBtn = UIKit.Button(r2, L.T("heart"), () => { M.heartbeat = !M.heartbeat; Refresh(); });
            breathBtn = UIKit.Button(r2, L.T("breath"), () => { M.breathing = !M.breathing; Refresh(); });
            flowBtn = UIKit.Button(r2, L.T("flow"), () => { M.flow = !M.flow; Refresh(); });
            var r3 = UIKit.Row(c, 26);
            var el = UIKit.Label(r3, L.T("explode"), 13, UIKit.Muted);
            el.gameObject.AddComponent<LayoutElement>().flexibleWidth = 0.6f;
            UIKit.Slider(r3, 0, 1, M.explode, v => M.explode = v);
            UIKit.Button(c, L.T("resetView"), () => app.orbit.ResetView());

            UIKit.Heading(c, L.T("section"));
            string[] keys = { "secX", "secY", "secZ" };
            float[] lo = { -0.3f, 0f, -0.25f }, hi = { 0.3f, 1.9f, 0.25f };
            for (int a = 0; a < 3; a++)
            {
                int ax = a;
                var lab = UIKit.Row(c, 30);
                secBtn[a] = UIKit.Button(lab, L.T(keys[a]), () => { M.secOn[ax] = !M.secOn[ax]; Refresh(); }, null, 13);
                secBtn[a].GetComponent<LayoutElement>().flexibleWidth = 3;
                var flip = UIKit.Button(lab, L.T("flip"), () => M.secFlip[ax] = !M.secFlip[ax], null, 13);
                flip.GetComponent<LayoutElement>().flexibleWidth = 1;
                var sr = UIKit.Row(c, 22);
                UIKit.Slider(sr, lo[a], hi[a], M.secValue[a], v => { M.secValue[ax] = v; if (!M.secOn[ax]) { M.secOn[ax] = true; Refresh(); } });
            }
            UIKit.Para(c, L.T("hint"), 12, UIKit.Muted);

            // information + browser
            var info = UIKit.Panel(root, "Info", UIKit.Bg);
            Side((RectTransform)info.transform, !toolsLeft, 370);
            var ic = UIKit.Scroll(info.transform, "Scroll");
            ((RectTransform)ic.parent.parent).Anchor(Vector2.zero, Vector2.one, new Vector2(4, 4), new Vector2(-4, -4));
            UIKit.Heading(ic, L.T("info"));
            infoName = UIKit.Para(ic, "", 21, null); infoName.fontStyle = FontStyle.Bold;
            infoOther = UIKit.Para(ic, "", 14, UIKit.Muted);
            infoMeta = UIKit.Para(ic, "", 13, UIKit.Accent);
            infoDesc = UIKit.Para(ic, "", 14, null);
            var ar = UIKit.Row(ic, 32);
            speakBtn = UIKit.Button(ar, L.T("speak"), () => app.voice.Speak(M.selected), null, 13);
            UIKit.Button(ar, L.T("hide"), () => { M.Hide(M.selected); Refresh(); }, null, 13);
            UIKit.Button(ar, L.T("isolate"), () => { M.Isolate(M.isolated == null ? M.selected : null); Refresh(); }, null, 13);
            UIKit.Button(ar, L.T("focus"), () => { if (M.selected != null) app.orbit.Focus(M.WorldBounds(M.selected)); }, null, 13);
            UIKit.Heading(ic, L.T("browse"));
            browse = UIKit.Rect(ic, "Browse");
            UIKit.Column(browse, 4, 0);
            var bfit = browse.gameObject.AddComponent<ContentSizeFitter>();
            bfit.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        }

        void Side(RectTransform rt, bool left, float width)
        {
            rt.anchorMin = new Vector2(left ? 0 : 1, 0);
            rt.anchorMax = new Vector2(left ? 0 : 1, 1);
            rt.pivot = new Vector2(left ? 0 : 1, 0.5f);
            rt.offsetMin = new Vector2(left ? 12 : -12 - width, 52);
            rt.offsetMax = new Vector2(left ? 12 + width : -12, -70);
        }

        void Footer()
        {
            var bar = UIKit.Panel(root, "Footer", UIKit.Bg, false);
            ((RectTransform)bar.transform).Anchor(Vector2.zero, new Vector2(1, 0), Vector2.zero, new Vector2(0, 40));
            var t = UIKit.Label(bar.transform, L.T("footer"), 13, UIKit.Muted, FontStyle.Normal, TextAnchor.MiddleCenter);
            ((RectTransform)t.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(12, 0), new Vector2(-12, 0));
        }

        void LoadingOverlay()
        {
            var o = UIKit.Panel(root, "Loading", UIKit.dark ? new Color(0.04f, 0.06f, 0.10f, 0.97f) : new Color(1, 1, 1, 0.97f), false);
            loading = (RectTransform)o.transform;
            loading.Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
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

        // ------------------------------------------------------------------ state
        public void Refresh()
        {
            if (!canvas) return;
            UIKit.SetOn(maleBtn, !M.female);
            UIKit.SetOn(femaleBtn, M.female);
            UIKit.SetOn(xrayBtn, M.xray);
            UIKit.SetOn(heartBtn, M.heartbeat);
            UIKit.SetOn(breathBtn, M.breathing);
            UIKit.SetOn(flowBtn, M.flow);
            for (int a = 0; a < 3; a++) UIKit.SetOn(secBtn[a], M.secOn[a]);
            foreach (var kv in sysBtn) UIKit.SetOn(kv.Value, kv.Key.visible);
            var p = M.selected;
            UIKit.SetText(infoName, p != null ? p.Name : "");
            UIKit.SetText(infoOther, p != null ? p.OtherName : "");
            if (p != null && M.systems.TryGetValue(p.def.system, out var s))
                UIKit.SetText(infoMeta, L.T("system") + ": " + (L.Ar ? s.def.ar : s.def.en) + "   •   " + L.T("region") + ": " + L.Group(p.def.group));
            else UIKit.SetText(infoMeta, "");
            UIKit.SetText(infoDesc, p != null ? p.Desc : L.T("noSel"));
            speakBtn.interactable = app.voice.Has(p);
            RebuildBrowse();
        }

        void RebuildBrowse()
        {
            for (int i = browse.childCount - 1; i >= 0; i--) Destroy(browse.GetChild(i).gameObject);
            var byGroup = new Dictionary<string, List<Part>>();
            foreach (var p in M.parts)
            {
                if (!M.SexOk(p) || p.def.system == "skin") continue;
                if (!byGroup.TryGetValue(p.def.group, out var list)) byGroup[p.def.group] = list = new List<Part>();
                list.Add(p);
            }
            foreach (var g in L.GroupOrder)
            {
                if (!byGroup.TryGetValue(g, out var list)) continue;
                string key = g;
                var b = UIKit.Button(browse, (expandedGroup == g ? "− " : "+ ") + L.Group(g) + "  (" + list.Count + ")",
                    () => { expandedGroup = expandedGroup == key ? null : key; RebuildBrowse(); }, expandedGroup == g ? UIKit.BtnOn : (Color?)null, 13);
                if (expandedGroup != g) continue;
                list.Sort((x, y) => string.CompareOrdinal(x.Name, y.Name));
                foreach (var p in list)
                {
                    var part = p;
                    var pb = UIKit.Button(browse, p.Name, () => app.SelectPart(part, true), M.selected == p ? UIKit.Accent : UIKit.Card, 12);
                    var le = pb.GetComponent<LayoutElement>(); le.minHeight = 26; le.preferredHeight = 26;
                    var t = pb.GetComponentInChildren<Text>();
                    t.alignment = L.Ar ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft;
                    if (!M.IsVisible(p)) t.color = UIKit.Muted;
                }
            }
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
            var st = app.vr.State;
            UIKit.SetText(vrStatus, st == VRManager.Status.Searching ? L.T("vrSearching") : st == VRManager.Status.Starting ? L.T("vrStarting")
                : st == VRManager.Status.Failed ? L.T("vrFailed") : st == VRManager.Status.NotFound ? L.T("vrNone") : L.T("vrReady"));
            vrButton.interactable = st == VRManager.Status.Available || st == VRManager.Status.Failed;
            detectButton.gameObject.SetActive(st == VRManager.Status.NotFound || st == VRManager.Status.Failed);

            // hover label
            var h = M.hovered;
            tooltip.gameObject.SetActive(h != null && !app.orbit.PointerOverUI);
            if (h != null)
            {
                UIKit.SetText(tooltip, h.Name);
                RectTransformUtility.ScreenPointToLocalPointInRectangle(root, DesktopInput.MousePosition, null, out var lp);
                ((RectTransform)tooltip.transform).anchoredPosition = lp + new Vector2(0, 28);
            }
        }
    }
}
