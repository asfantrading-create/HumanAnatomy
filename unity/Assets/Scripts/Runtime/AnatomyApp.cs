using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Asfan.Anatomy
{
    /// <summary>Entry point: creates the camera, model, interface, learning tools, licensing and the VR manager.</summary>
    [DefaultExecutionOrder(-100)]
    public class AnatomyApp : MonoBehaviour
    {
        public static AnatomyApp Instance { get; private set; }
        public AnatomyModel model;
        public VoicePlayer voice;
        public DesktopUI ui;
        public OrbitCamera orbit;
        public VRManager vr;
        public Lessons lessons;
        public IdLabels labels;
        public LicenseManager license;
        public Camera desktopCam;
        public bool autoRotate, highQuality = true;
        Material floorMat;
        float lastHoverPick, lastClickTime;
        Vector2 lastMouse;
        Part lastClicked;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindAnyObjectByType<AnatomyApp>() == null) new GameObject("Anatomy App").AddComponent<AnatomyApp>();
        }

        void Awake()
        {
            Instance = this;
            QualitySettings.vSyncCount = 1;
            Application.targetFrameRate = -1;
            L.Ar = PlayerPrefs.GetInt("lang_ar", 1) == 1;
            UIKit.dark = PlayerPrefs.GetInt("dark", 1) == 1;
            DesktopUI.FontScale = PlayerPrefs.GetFloat("fontScale", 1);
            highQuality = PlayerPrefs.GetInt("quality_high", 1) == 1;
            QualitySettings.antiAliasing = highQuality ? 4 : 0;

            desktopCam = Camera.main;
            if (desktopCam == null)
            {
                var cgo = new GameObject("Desktop Camera");
                cgo.tag = "MainCamera";
                desktopCam = cgo.AddComponent<Camera>();
                cgo.AddComponent<AudioListener>();
            }
            desktopCam.clearFlags = CameraClearFlags.SolidColor;
            desktopCam.nearClipPlane = 0.02f;
            desktopCam.farClipPlane = 100;
            desktopCam.fieldOfView = 40;
            desktopCam.allowMSAA = true;
            desktopCam.stereoTargetEye = StereoTargetEyeMask.None;   // the desktop camera never renders to the headset
            orbit = desktopCam.gameObject.GetComponent<OrbitCamera>();
            if (orbit == null) orbit = desktopCam.gameObject.AddComponent<OrbitCamera>();
            foreach (var l in FindObjectsByType<Light>(FindObjectsSortMode.None)) l.enabled = false;  // lighting is done by the shader

            BuildFloor();
            model = new GameObject("Anatomy").AddComponent<AnatomyModel>();
            voice = gameObject.AddComponent<VoicePlayer>();
            lessons = gameObject.AddComponent<Lessons>();
            lessons.app = this;
            lessons.autoVoice = PlayerPrefs.GetInt("tourVoice", 1) == 1;
            labels = gameObject.AddComponent<IdLabels>();
            labels.app = this;
            vr = gameObject.AddComponent<VRManager>();
            vr.app = this;
            ui = gameObject.AddComponent<DesktopUI>();
            ui.app = this;
            license = new LicenseManager();
            license.Changed += s => { ui.OnLicense(s); };
            ApplyTheme();
        }

        IEnumerator Start()
        {
            ui.Build();
            yield return model.Load();
            if (model.loaded)
            {
                voice.Init(model.manifest);
                SetView("front", true);
                ui.Build();   // the systems list and the learning data are known now
                if (license.Current.allowed) ui.ShowChooser();
            }
            // re-check the subscription hourly while the program stays open
            while (true)
            {
                yield return new WaitForSecondsRealtime(3600);
                license.Refresh();
            }
        }

        public static string SystemName(string id)
        {
            var m = Instance != null ? Instance.model : null;
            if (m != null && m.systems.TryGetValue(id, out var s)) return L.Ar ? s.def.ar : s.def.en;
            return id;
        }

        void BuildFloor()
        {
            var go = new GameObject("Floor");
            var mesh = new Mesh { name = "Floor" };
            const float r = 8;
            mesh.vertices = new[] { new Vector3(-r, 0, -r), new Vector3(r, 0, -r), new Vector3(r, 0, r), new Vector3(-r, 0, r) };
            mesh.triangles = new[] { 0, 2, 1, 0, 3, 2 };
            mesh.RecalculateBounds();
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            floorMat = new Material(Shader.Find("Anatomy/Floor"));
            mr.sharedMaterial = floorMat;
            go.transform.position = new Vector3(0, -0.002f, 0);
        }

        // ------------------------------------------------------------------ preferences
        void ApplyTheme()
        {
            var bg = UIKit.dark ? new Color(0.045f, 0.07f, 0.11f) : Color.white;
            desktopCam.backgroundColor = bg;
            if (vr != null) vr.SetBackground(bg);
            floorMat.SetColor("_Glow", UIKit.dark ? new Color(0.30f, 0.79f, 0.94f, 0.28f) : new Color(0.30f, 0.6f, 0.9f, 0.18f));
            floorMat.SetColor("_Line", UIKit.dark ? new Color(0.17f, 0.29f, 0.42f, 0.8f) : new Color(0.75f, 0.82f, 0.9f, 0.9f));
        }

        public void ToggleTheme()
        {
            UIKit.dark = !UIKit.dark;
            PlayerPrefs.SetInt("dark", UIKit.dark ? 1 : 0);
            ApplyTheme();
            ui.Build();
        }

        public void ToggleLanguage()
        {
            L.Ar = !L.Ar;
            PlayerPrefs.SetInt("lang_ar", L.Ar ? 1 : 0);
            ui.Build();
            vr.RebuildMenu();
        }

        public void SetFontScale(float s)
        {
            DesktopUI.FontScale = Mathf.Clamp(Mathf.Round(s * 10) / 10f, 0.8f, 1.5f);
            PlayerPrefs.SetFloat("fontScale", DesktopUI.FontScale);
            ui.Build();
        }

        public void SetQuality(bool high)
        {
            highQuality = high;
            PlayerPrefs.SetInt("quality_high", high ? 1 : 0);
            QualitySettings.antiAliasing = high ? 4 : 0;
        }

        // ------------------------------------------------------------------ selection and camera
        /// <summary>Selects a structure (null clears), says its name and updates both interfaces.</summary>
        public void SelectPart(Part p, bool focus = false)
        {
            // picked from a list or search: the rest of the body becomes a faint shadow
            if (focus || p != model.focusPart) model.focusPart = focus ? p : null;   // clicking the focused part again keeps the focus
            model.Select(p);
            if (p == null || focus) model.ApplyAll();
            if (p != null)
            {
                Progress.MarkViewed(p.def.id);
                if (L.Ar) voice.Speak(p);
            }
            if (p != null && ui.learnOpen && lessons.exam == null) ui.learnOpen = false;
            RefreshAll();
            if (focus && p != null && !vr.InVR) FocusParts(new List<Part> { p });
        }

        /// <summary>
        /// Full screen ⇄ maximised window. A maximised window keeps the Windows taskbar visible,
        /// so the bottom toolbar is never hidden behind it.
        /// </summary>
        public void ToggleFullScreen()
        {
            bool full = Screen.fullScreenMode == FullScreenMode.FullScreenWindow || Screen.fullScreenMode == FullScreenMode.ExclusiveFullScreen;
            if (full)
            {
                Screen.fullScreenMode = FullScreenMode.MaximizedWindow;
                if (Application.platform != RuntimePlatform.WindowsPlayer)
                {
                    // other platforms: a window a little smaller than the desktop
                    int w = Display.main.systemWidth, h = Display.main.systemHeight;
                    Screen.SetResolution(Mathf.RoundToInt(w * 0.9f), Mathf.RoundToInt(h * 0.85f), FullScreenMode.Windowed);
                }
            }
            else Screen.SetResolution(Display.main.systemWidth, Display.main.systemHeight, FullScreenMode.FullScreenWindow);
        }

        public void RefreshAll()
        {
            ui.Refresh();
            vr.RefreshMenu();
        }

        public void FocusParts(List<Part> list, float minDist = 0.12f)
        {
            if (list == null || list.Count == 0 || vr.InVR) return;
            var b = model.WorldBounds(list[0]);
            foreach (var p in list) b.Encapsulate(model.WorldBounds(p));
            orbit.Focus(b, minDist);
        }

        /// <summary>Preset views (same angles as the desktop edition).</summary>
        public void SetView(string name, bool instant = false)
        {
            var target = new Vector3(0, 0.9f, 0);
            switch (name)
            {
                case "back": orbit.SetGoal(target, 180, 11.3f, 3.35f); break;
                case "left": orbit.SetGoal(target, -90, 8.5f, 3.35f); break;
                case "right": orbit.SetGoal(target, 90, 8.5f, 3.35f); break;
                case "top": orbit.SetGoal(target, 0, 85f, 2.4f); break;
                default: orbit.SetGoal(target, 0, 11.3f, 3.35f); break;
            }
        }

        public void Preset(string which)
        {
            model.PushUndo();
            foreach (var s in model.systemList)
            {
                var id = s.def.id;
                if (which == "organs") { s.visible = id != "muscular"; s.opacity = id == "skin" ? 0.1f : id == "skeletal" ? 0.3f : 1; }
                else if (which == "skeleton") { s.visible = id == "skeletal" || id == "skin"; s.opacity = id == "skin" ? 0.1f : 1; }
                else { s.visible = true; s.opacity = s.def.opacity; }
            }
            model.ApplyAll();
            RefreshAll();
        }

        public void ResetAll()
        {
            lessons.EndTour();
            lessons.EndQuiz();
            model.xray = false; model.explode = 0; model.heartbeat = model.breathing = model.flow = false;
            for (int a = 0; a < 3; a++) model.secOn[a] = false;
            foreach (var p in model.parts) p.hidden = false;
            model.isolated = null;
            model.focusPart = null;
            foreach (var s in model.systemList) { s.visible = true; s.opacity = s.def.opacity; }
            autoRotate = false;
            model.Select(null);
            model.ApplyAll();
            SetView("front");
            ui.Build();
        }

        // ------------------------------------------------------------------ saved views (same format as the desktop edition)
        static List<object> V3(Vector3 v) => new List<object> { (double)Mathf.Round(v.x * 1e4f) / 1e4, (double)Mathf.Round(v.y * 1e4f) / 1e4, (double)Mathf.Round(-v.z * 1e4f) / 1e4 };
        static Vector3 V3(List<object> l) => l != null && l.Count >= 3 ? new Vector3(System.Convert.ToSingle(l[0]), System.Convert.ToSingle(l[1]), -System.Convert.ToSingle(l[2])) : Vector3.zero;

        public Dictionary<string, object> CaptureView()
        {
            orbit.GoalPose(out var pos, out var tgt);
            var systems = new Dictionary<string, object>();
            foreach (var s in model.systemList) systems[s.def.id] = new List<object> { s.visible, (double)Mathf.Round(s.opacity * 100) / 100 };
            var hidden = new List<object>();
            foreach (var p in model.parts) if (p.hidden) hidden.Add(p.def.id);
            return new Dictionary<string, object>
            {
                ["camera"] = V3(pos), ["target"] = V3(tgt), ["sex"] = model.female ? "f" : "m", ["systems"] = systems, ["hidden"] = hidden,
                ["selected"] = model.selected != null ? model.selected.def.id : null, ["xray"] = model.xray, ["explode"] = (double)model.explode
            };
        }

        public void RestoreView(Dictionary<string, object> v, bool withSelection)
        {
            if (v == null) return;
            var sex = MiniJson.Str(v, "sex", "");
            if (sex == "f" && !model.female) model.SetSex(true);
            else if (sex == "m" && model.female) model.SetSex(false);
            var systems = MiniJson.Obj(v, "systems");
            if (systems != null)
                foreach (var s in model.systemList)
                    if (systems.TryGetValue(s.def.id, out var o) && o is List<object> l && l.Count >= 2)
                    {
                        s.visible = l[0] is bool b && b;
                        s.opacity = System.Convert.ToSingle(l[1]);
                    }
            var hidden = new HashSet<string>();
            foreach (var h in MiniJson.Arr(v, "hidden") ?? new List<object>()) hidden.Add(System.Convert.ToString(h));
            foreach (var p in model.parts) p.hidden = hidden.Contains(p.def.id);
            model.isolated = null;
            model.focusPart = null;
            model.xray = MiniJson.Bool(v, "xray");
            model.explode = (float)MiniJson.Num(v, "explode");
            var cam = V3(MiniJson.Arr(v, "camera"));
            var tgt = V3(MiniJson.Arr(v, "target"));
            var dir = tgt - cam;
            if (dir.sqrMagnitude > 1e-6f)
            {
                float d = dir.magnitude;
                orbit.SetGoal(tgt, Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg, -Mathf.Asin(Mathf.Clamp(dir.y / d, -1, 1)) * Mathf.Rad2Deg, d);
            }
            if (withSelection) model.selected = model.ById(MiniJson.Str(v, "selected", ""));
            model.ApplyAll();
            RefreshAll();
        }

        // ------------------------------------------------------------------ files
        public void Screenshot() => StartCoroutine(ScreenshotRoutine());

        IEnumerator ScreenshotRoutine()
        {
            var list = FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            foreach (var c in list) if (c.renderMode == RenderMode.ScreenSpaceOverlay) c.enabled = false;
            yield return new WaitForEndOfFrame();
            // read the back buffer directly (no dependency on the Screen Capture module)
            var tex = new Texture2D(Screen.width, Screen.height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, Screen.width, Screen.height), 0, 0);
            tex.Apply();
            foreach (var c in list) if (c) c.enabled = true;
            var dir = Path.Combine(System.Environment.GetFolderPath(System.Environment.SpecialFolder.MyPictures), "ASFAN Anatomy");
            if (string.IsNullOrEmpty(System.Environment.GetFolderPath(System.Environment.SpecialFolder.MyPictures))) dir = FileDialogs.Folder("Screenshots");
            Directory.CreateDirectory(dir);
            var path = Path.Combine(dir, "anatomy-" + System.DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".png");
            File.WriteAllBytes(path, tex.EncodeToPNG());
            Destroy(tex);
            ui.ShowToast(L.T("shotSaved", "path", path), 6);
            FileDialogs.Reveal(path);
        }

        public void MakeCertificate(Lessons.Exam ex)
        {
            StartCoroutine(Certificate.Create(this, ex.name, ex.pct, ex.correct, ex.qs.Count, ex.level, ex.systems, path =>
            {
                if (path == null) { ui.ShowToast(L.T("certFailed")); return; }
                ui.ShowToast(L.T("certSaved", "path", path), 6);
                FileDialogs.OpenFile(path);
            }));
        }

        public void OnVR(bool on)
        {
            desktopCam.enabled = !on;
            orbit.enabled = !on;
            var listener = desktopCam.GetComponent<AudioListener>();
            if (listener) listener.enabled = !on;
            model.Hover(null);
            if (on) UnityEngine.XR.XRSettings.eyeTextureResolutionScale = highQuality ? 1.2f : 0.9f;
        }

        // ------------------------------------------------------------------ per frame
        void Update()
        {
            // head-light: key light from above-left of the viewer, fill from the lower right
            var cam = vr.InVR ? vr.HeadCamera : desktopCam;
            if (cam != null)
            {
                var r = cam.transform.rotation;
                Shader.SetGlobalVector("_AnatKeyDir", r * new Vector3(-0.45f, 0.65f, -1f));
                Shader.SetGlobalVector("_AnatFillDir", r * new Vector3(0.7f, -0.15f, -0.6f));
            }
            Shader.SetGlobalVector("_AnatKeyColor", new Vector4(0.86f, 0.84f, 0.80f, 1));
            Shader.SetGlobalVector("_AnatFillColor", new Vector4(0.22f, 0.25f, 0.32f, 1));
            Shader.SetGlobalVector("_AnatSky", new Vector4(0.36f, 0.38f, 0.43f, 1));
            Shader.SetGlobalVector("_AnatGround", new Vector4(0.16f, 0.14f, 0.13f, 1));

            if (!model.loaded || vr.InVR) return;
            if (autoRotate) orbit.AddYaw(Time.deltaTime * 12);
            if (license.Current.allowed && !ui.ModalOpen) DesktopInteraction();
        }

        void DesktopInteraction()
        {
            var mouse = DesktopInput.MousePosition;
            bool overUI = orbit.PointerOverUI;
            bool dragging = DesktopInput.Held(0) || DesktopInput.Held(1) || DesktopInput.Held(2);
            if (!overUI && !dragging && (mouse - lastMouse).sqrMagnitude > 1 && Time.unscaledTime - lastHoverPick > 0.05f)
            {
                lastHoverPick = Time.unscaledTime;
                lastMouse = mouse;
                model.Hover(Picker.Pick(model, desktopCam.ScreenPointToRay(mouse), out _));
            }
            if (overUI && model.hovered != null) model.Hover(null);

            if (DesktopInput.Up(0) && !overUI && !orbit.Dragged)
            {
                var p = Picker.Pick(model, desktopCam.ScreenPointToRay(mouse), out _);
                var q = lessons.quiz;
                if (q != null && q.findMode && !q.answered && p != null) lessons.AnswerFind(p);
                else if (DesktopInput.Alt && p != null) { model.Hide(p); RefreshAll(); }
                else
                {
                    bool dbl = p != null && p == lastClicked && Time.unscaledTime - lastClickTime < 0.35f;
                    lastClicked = p;
                    lastClickTime = Time.unscaledTime;
                    if (dbl && lessons.quiz == null) FocusParts(new List<Part> { p });
                    else if (lessons.quiz == null && lessons.exam == null) SelectPart(p);
                }
            }
            Keys();
        }

        void Keys()
        {
            if (UIKit.Typing) return;
            var M = model;
            if (DesktopInput.Ctrl)
            {
                if (DesktopInput.Key(KeyCode.F)) ui.FocusSearch();
                if (DesktopInput.Key(KeyCode.Z) && M.Undo()) RefreshAll();
                return;
            }
            if (DesktopInput.Key(KeyCode.Escape))
            {
                if (ui.presenting) ui.SetPresenting(false);
                else SelectPart(null);
            }
            if (ui.presenting)
            {
                if (DesktopInput.Key(KeyCode.Space)) lessons.NextStep();
                if (DesktopInput.Key(KeyCode.F11)) ToggleFullScreen();
                return;
            }
            if (DesktopInput.Key(KeyCode.Alpha1)) SetView("front");
            if (DesktopInput.Key(KeyCode.Alpha2)) SetView("back");
            if (DesktopInput.Key(KeyCode.Alpha3)) SetView("left");
            if (DesktopInput.Key(KeyCode.Alpha4)) SetView("right");
            if (DesktopInput.Key(KeyCode.Alpha5)) SetView("top");
            if (DesktopInput.Key(KeyCode.R)) ResetAll();
            if (DesktopInput.Key(KeyCode.A)) { M.ShowAll(); RefreshAll(); }
            if (DesktopInput.Key(KeyCode.X)) { M.xray = !M.xray; M.ApplyAll(); RefreshAll(); }
            if (DesktopInput.Key(KeyCode.L)) { labels.Set(!labels.on); RefreshAll(); }
            if (DesktopInput.Key(KeyCode.C)) { bool any = M.secOn[0] || M.secOn[1] || M.secOn[2]; M.secOn[0] = !any; M.secOn[1] = false; M.secOn[2] = false; RefreshAll(); }
            if (DesktopInput.Key(KeyCode.B)) { M.heartbeat = !M.heartbeat; RefreshAll(); }
            if (DesktopInput.Key(KeyCode.N)) { M.breathing = !M.breathing; RefreshAll(); }
            if ((DesktopInput.Key(KeyCode.Delete) || DesktopInput.Key(KeyCode.H)) && M.selected != null) { M.Hide(M.selected); RefreshAll(); }
            if (DesktopInput.Key(KeyCode.I) && M.selected != null) { M.Isolate(M.isolated == null ? M.selected : null); RefreshAll(); }
            if (DesktopInput.Key(KeyCode.F) && M.selected != null) FocusParts(new List<Part> { M.selected });
            if (DesktopInput.Key(KeyCode.S) && M.selected != null) voice.SpeakText(M.selected.Name, M.selected.Desc);
            if (DesktopInput.Key(KeyCode.Q)) { if (lessons.quiz != null) lessons.EndQuiz(); else lessons.StartQuiz(); }
            if (DesktopInput.Key(KeyCode.T)) { ui.learnOpen = !ui.learnOpen; ui.Refresh(); }
            if (DesktopInput.Key(KeyCode.P)) Screenshot();
            if (DesktopInput.Key(KeyCode.F11)) ToggleFullScreen();
        }
    }
}
