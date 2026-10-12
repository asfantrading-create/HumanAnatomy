using System.Collections;
using UnityEngine;

namespace Asfan.Anatomy
{
    /// <summary>Entry point: creates the camera, model, interface and VR manager.</summary>
    [DefaultExecutionOrder(-100)]
    public class AnatomyApp : MonoBehaviour
    {
        public AnatomyModel model;
        public VoicePlayer voice;
        public DesktopUI ui;
        public OrbitCamera orbit;
        public VRManager vr;
        public Camera desktopCam;
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
            QualitySettings.vSyncCount = 1;
            QualitySettings.antiAliasing = 4;
            Application.targetFrameRate = -1;
            L.Ar = PlayerPrefs.GetInt("lang_ar", 1) == 1;
            UIKit.dark = PlayerPrefs.GetInt("dark", 1) == 1;

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
            vr = gameObject.AddComponent<VRManager>();
            vr.app = this;
            ui = gameObject.AddComponent<DesktopUI>();
            ui.app = this;
            ApplyTheme();
        }

        IEnumerator Start()
        {
            ui.Build();
            yield return model.Load();
            if (model.loaded)
            {
                voice.Init(model.manifest);
                ui.Build();   // the systems list is known now
            }
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

        /// <summary>Selects a structure (null clears), says its name and updates both interfaces.</summary>
        public void SelectPart(Part p, bool focus = false)
        {
            model.Select(p);
            if (p != null && L.Ar) voice.Speak(p);
            ui.Refresh();
            vr.RefreshMenu();
            if (focus && p != null && !vr.InVR) orbit.Focus(model.WorldBounds(p));
        }

        public void RefreshAll()
        {
            ui.Refresh();
            vr.RefreshMenu();
        }

        public void OnVR(bool on)
        {
            desktopCam.enabled = !on;
            orbit.enabled = !on;
            var listener = desktopCam.GetComponent<AudioListener>();
            if (listener) listener.enabled = !on;
            model.Hover(null);
        }

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
            DesktopInteraction();
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
                bool dbl = p != null && p == lastClicked && Time.unscaledTime - lastClickTime < 0.35f;
                lastClicked = p;
                lastClickTime = Time.unscaledTime;
                if (dbl) orbit.Focus(model.WorldBounds(p));
                else SelectPart(p);
            }
            if (DesktopInput.Key(KeyCode.Escape)) SelectPart(null);
            if (DesktopInput.Key(KeyCode.H) && model.selected != null) { model.Hide(model.selected); RefreshAll(); }
            if (DesktopInput.Key(KeyCode.F) && model.selected != null) orbit.Focus(model.WorldBounds(model.selected));
            if (DesktopInput.Key(KeyCode.X)) { model.xray = !model.xray; model.ApplyAll(); RefreshAll(); }
            if (DesktopInput.Key(KeyCode.R)) orbit.ResetView();
        }
    }
}
