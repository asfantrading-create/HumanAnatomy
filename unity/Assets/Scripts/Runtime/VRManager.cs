using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.XR;
using UnityEngine.XR.Management;

namespace Asfan.Anatomy
{
    /// <summary>
    /// Detects a PC VR headset (Meta Quest through Quest Link / Air Link, or any OpenXR headset),
    /// starts and stops XR on demand and implements the VR interaction:
    /// laser selection, grabbing / scaling the body, walking, snap turn, a hand menu and a hand-held section plane.
    /// </summary>
    public class VRManager : MonoBehaviour
    {
        public enum Status { Searching, NotFound, Available, Starting, Running, Failed }
        public AnatomyApp app;
        public Status State { get; private set; } = Status.Searching;
        public bool InVR => State == Status.Running;
        public Camera HeadCamera => headCam;

        class Hand
        {
            public XRNode node;
            public Transform t;
            public InputDevice dev;
            public bool tracked;
            public Vector3 pos, pointerPos;
            public Quaternion rot, pointerRot;
            public bool trigger, grip, primary, secondary, stickClick;
            public bool triggerPrev, gripPrev, primaryPrev, secondaryPrev, stickClickPrev;
            public Vector2 stick;
            public bool Down(bool now, bool prev) => now && !prev;
        }

        static readonly InputFeatureUsage<Vector3> PointerPosition = new InputFeatureUsage<Vector3>("PointerPosition");
        static readonly InputFeatureUsage<Quaternion> PointerRotation = new InputFeatureUsage<Quaternion>("PointerRotation");

        Transform rig, head;
        Camera headCam;
        Hand left, right;
        LineRenderer laser;
        Transform hitDot, sectionQuad;
        Canvas menu, label;
        Text labelText, menuTitle, menuDesc;
        readonly List<Button> menuButtons = new List<Button>();
        readonly Dictionary<string, Button> menuByKey = new Dictionary<string, Button>();
        Button hoverButton;
        Material unlit;
        Color background = new Color(0.045f, 0.07f, 0.11f);
        float nextProbe, lostFor, lastPick;
        bool placed, sectionFrozen, turnReady = true;
        Part pointed;
        Vector3 pointedAt, labelAt;

        // grab state
        int grabMode;            // 0 none, 1 left, 2 right, 3 both
        Vector3 g0HandPos, g0BodyPos, g0Mid;
        float g0Yaw, g0Scale, g0Dist, g0Angle;
        Quaternion g0BodyRot;

        static XRManagerSettings Manager => XRGeneralSettings.Instance != null ? XRGeneralSettings.Instance.Manager : null;

        IEnumerator Start()
        {
            var m = Manager;
            if (m != null && m.activeLoader != null)
            {
                // XR was started automatically ("Initialize XR on Startup"): the program starts on the desktop instead
                m.StopSubsystems();
                m.DeinitializeLoader();
            }
            yield return null;
            Probe();
        }

        void OnApplicationQuit() { if (InVR) ShutdownXR(); }

        // ------------------------------------------------------------------ detection
        public void Probe()
        {
            if (State == Status.Starting || State == Status.Running || probing) return;
            StartCoroutine(ProbeRoutine());
        }
        bool probing;
        static bool warned;

        IEnumerator ProbeRoutine()
        {
            probing = true;
            State = Status.Searching;
            var m = Manager;
            if (m == null)
            {
                if (!warned) Debug.LogWarning("XR Plug-in Management is not configured (run Tools > ASFAN Anatomy > Setup Project).");
                warned = true;
                nextProbe = Time.unscaledTime + 10;
                State = Status.NotFound;
                probing = false;
                yield break;
            }
            // initialising the OpenXR loader only succeeds when a runtime reports a connected headset
            yield return m.InitializeLoader();
            bool found = m.activeLoader != null;
            if (found) m.DeinitializeLoader();
            State = found ? Status.Available : Status.NotFound;
            nextProbe = Time.unscaledTime + 10;
            probing = false;
        }

        void ShutdownXR()
        {
            var m = Manager;
            if (m == null) return;
            if (m.activeLoader != null)
            {
                m.StopSubsystems();
                m.DeinitializeLoader();
            }
        }

        // ------------------------------------------------------------------ enter / exit
        public void EnterVR()
        {
            if (State == Status.Available || State == Status.Failed) StartCoroutine(EnterRoutine());
        }

        IEnumerator EnterRoutine()
        {
            State = Status.Starting;
            var m = Manager;
            if (m == null) { State = Status.Failed; yield break; }
            if (m.activeLoader == null) yield return m.InitializeLoader();
            if (m.activeLoader == null) { State = Status.Failed; yield break; }
            m.StartSubsystems();
            SetFloorOrigin();
            BuildRig();
            app.OnVR(true);
            placed = false;
            lostFor = 0;
            State = Status.Running;
            RefreshMenu();
        }

        public void ExitVR()
        {
            if (!InVR) return;
            ShutdownXR();
            Application.onBeforeRender -= OnBeforeRender;
            if (rig) Destroy(rig.gameObject);
            rig = null;
            var mt = app.model.transform;
            if (sectionQuad && sectionQuad.parent == mt) Destroy(sectionQuad.gameObject);
            mt.position = Vector3.zero; mt.rotation = Quaternion.identity; mt.localScale = Vector3.one;
            app.model.freePlaneOn = false;
            sectionFrozen = false;
            grabMode = 0;
            app.OnVR(false);
            State = Status.Available;
            app.RefreshAll();
        }

        static void SetFloorOrigin()
        {
            var list = new List<XRInputSubsystem>();
            SubsystemManager.GetSubsystems(list);
            foreach (var s in list) s.TrySetTrackingOriginMode(TrackingOriginModeFlags.Floor);
        }

        public void SetBackground(Color c)
        {
            background = c;
            if (headCam) headCam.backgroundColor = c;
        }

        // ------------------------------------------------------------------ rig
        void BuildRig()
        {
            unlit = new Material(Shader.Find("Anatomy/Unlit"));
            rig = new GameObject("XR Rig").transform;
            rig.position = new Vector3(0, 0, -1.3f);
            head = new GameObject("Head").transform;
            head.SetParent(rig, false);
            head.localPosition = new Vector3(0, 1.6f, 0);
            headCam = head.gameObject.AddComponent<Camera>();
            headCam.clearFlags = CameraClearFlags.SolidColor;
            headCam.backgroundColor = background;
            headCam.nearClipPlane = 0.02f;
            headCam.farClipPlane = 100;
            headCam.stereoTargetEye = StereoTargetEyeMask.Both;
            head.gameObject.AddComponent<AudioListener>();

            left = MakeHand(XRNode.LeftHand, new Color(0.3f, 0.75f, 1f));
            right = MakeHand(XRNode.RightHand, new Color(1f, 0.85f, 0.3f));

            laser = new GameObject("Laser").AddComponent<LineRenderer>();
            laser.transform.SetParent(rig, false);
            laser.sharedMaterial = unlit;
            laser.positionCount = 2;
            laser.widthMultiplier = 0.004f;
            laser.useWorldSpace = true;
            laser.startColor = new Color(0.4f, 0.85f, 1f, 0.9f);
            laser.endColor = new Color(0.4f, 0.85f, 1f, 0.25f);
            hitDot = Primitive(PrimitiveType.Sphere, rig, Vector3.one * 0.012f, new Color(1, 1, 1, 0.95f));

            BuildMenu();
            BuildLabel();
            Application.onBeforeRender += OnBeforeRender;
        }

        Transform Primitive(PrimitiveType type, Transform parent, Vector3 scale, Color color)
        {
            var go = GameObject.CreatePrimitive(type);
            var col = go.GetComponent<Collider>();
            if (col) Destroy(col);
            go.transform.SetParent(parent, false);
            go.transform.localScale = scale;
            var mat = new Material(unlit);
            mat.SetColor("_Color", color);
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return go.transform;
        }

        Hand MakeHand(XRNode node, Color color)
        {
            var h = new Hand { node = node };
            h.t = new GameObject(node.ToString()).transform;
            h.t.SetParent(rig, false);
            var body = Primitive(PrimitiveType.Cube, h.t, new Vector3(0.035f, 0.03f, 0.11f), color * 0.8f);
            body.localPosition = new Vector3(0, -0.01f, -0.03f);
            var tip = Primitive(PrimitiveType.Sphere, h.t, Vector3.one * 0.02f, color);
            tip.localPosition = new Vector3(0, 0, 0.03f);
            return h;
        }

        // ------------------------------------------------------------------ tracking
        void OnBeforeRender() { if (InVR) ReadPoses(); }

        void ReadPoses()
        {
            if (!rig) return;
            if (ReadHead(out var hp, out var hr)) { head.localPosition = hp; head.localRotation = hr; }
            ReadHand(left);
            ReadHand(right);
        }

        static bool ReadHead(out Vector3 p, out Quaternion r)
        {
            p = Vector3.zero; r = Quaternion.identity;
            foreach (var node in new[] { XRNode.CenterEye, XRNode.Head })
            {
                var d = InputDevices.GetDeviceAtXRNode(node);
                if (!d.isValid) continue;
                if (d.TryGetFeatureValue(CommonUsages.centerEyePosition, out p) && d.TryGetFeatureValue(CommonUsages.centerEyeRotation, out r)) return true;
                if (d.TryGetFeatureValue(CommonUsages.devicePosition, out p) && d.TryGetFeatureValue(CommonUsages.deviceRotation, out r)) return true;
            }
            return false;
        }

        static void ReadHand(Hand h)
        {
            h.dev = InputDevices.GetDeviceAtXRNode(h.node);
            h.tracked = h.dev.isValid && h.dev.TryGetFeatureValue(CommonUsages.devicePosition, out h.pos) && h.dev.TryGetFeatureValue(CommonUsages.deviceRotation, out h.rot);
            if (!h.tracked) { h.t.gameObject.SetActive(false); return; }
            h.t.gameObject.SetActive(true);
            h.t.localPosition = h.pos;
            h.t.localRotation = h.rot;
            if (!(h.dev.TryGetFeatureValue(PointerPosition, out h.pointerPos) && h.dev.TryGetFeatureValue(PointerRotation, out h.pointerRot)))
            {
                h.pointerPos = h.pos;
                h.pointerRot = h.rot;
            }
        }

        static void ReadButtons(Hand h)
        {
            h.triggerPrev = h.trigger; h.gripPrev = h.grip; h.primaryPrev = h.primary; h.secondaryPrev = h.secondary; h.stickClickPrev = h.stickClick;
            if (!h.dev.isValid) { h.trigger = h.grip = h.primary = h.secondary = h.stickClick = false; h.stick = Vector2.zero; return; }
            h.trigger = h.dev.TryGetFeatureValue(CommonUsages.trigger, out float tv) ? tv > (h.triggerPrev ? 0.35f : 0.6f)
                : h.dev.TryGetFeatureValue(CommonUsages.triggerButton, out bool tb) && tb;
            h.grip = h.dev.TryGetFeatureValue(CommonUsages.grip, out float gv) ? gv > (h.gripPrev ? 0.35f : 0.6f)
                : h.dev.TryGetFeatureValue(CommonUsages.gripButton, out bool gb) && gb;
            h.primary = h.dev.TryGetFeatureValue(CommonUsages.primaryButton, out bool pb) && pb;
            h.secondary = h.dev.TryGetFeatureValue(CommonUsages.secondaryButton, out bool sb) && sb;
            h.stickClick = h.dev.TryGetFeatureValue(CommonUsages.primary2DAxisClick, out bool sc) && sc;
            if (!h.dev.TryGetFeatureValue(CommonUsages.primary2DAxis, out h.stick)) h.stick = Vector2.zero;
        }

        static void Haptic(Hand h, float amp = 0.35f, float dur = 0.04f)
        {
            if (h.dev.isValid) h.dev.SendHapticImpulse(0u, amp, dur);
        }

        // ------------------------------------------------------------------ per frame
        void Update()
        {
            if (State == Status.NotFound && Time.unscaledTime > nextProbe) Probe();
            if (!InVR) return;

            // the headset was disconnected or the runtime stopped the session
            var m = Manager;
            var disp = m != null && m.activeLoader != null ? m.activeLoader.GetLoadedSubsystem<XRDisplaySubsystem>() : null;
            lostFor = disp != null && disp.running ? 0 : lostFor + Time.unscaledDeltaTime;
            if (lostFor > 2f) { ExitVR(); return; }

            ReadPoses();
            ReadButtons(left);
            ReadButtons(right);
            if (!placed && ReadHead(out _, out _)) { PlaceUser(); placed = true; }

            Locomotion();
            Grab();
            Pointer();
            Buttons();
            UpdateSection();
            UpdateLabel();
        }

        /// <summary>Puts the user 1.3 m in front of the body, facing it.</summary>
        void PlaceUser()
        {
            var hp = head.localPosition;
            float yaw = head.localRotation.eulerAngles.y;
            // look along the body's backward axis (+Z of the body frame), i.e. at its front
            rig.rotation = Quaternion.Euler(0, Yaw(app.model.transform.rotation) - yaw, 0);
            var flat = rig.rotation * new Vector3(hp.x, 0, hp.z);
            var bodyFront = app.model.transform.position + app.model.transform.rotation * new Vector3(0, 0, -1.3f);
            rig.position = new Vector3(bodyFront.x, 0, bodyFront.z) - flat;
        }

        void Locomotion()
        {
            var s = left.stick;
            if (s.sqrMagnitude > 0.04f && grabMode == 0)
            {
                var f = head.forward; f.y = 0; f.Normalize();
                var r = head.right; r.y = 0; r.Normalize();
                rig.position += (f * s.y + r * s.x) * (1.4f * Time.deltaTime);
            }
            float x = right.stick.x;
            if (Mathf.Abs(x) < 0.3f) turnReady = true;
            else if (turnReady && Mathf.Abs(x) > 0.75f)
            {
                turnReady = false;
                rig.RotateAround(head.position, Vector3.up, Mathf.Sign(x) * 30f);
            }
        }

        static float Yaw(Quaternion q) { var f = q * Vector3.forward; return Mathf.Atan2(f.x, f.z) * Mathf.Rad2Deg; }

        void Grab()
        {
            int mode = (left.tracked && left.grip ? 1 : 0) | (right.tracked && right.grip ? 2 : 0);
            var body = app.model.transform;
            var lp = left.t.position; var rp = right.t.position;
            if (mode != grabMode)
            {
                grabMode = mode;
                g0BodyPos = body.position; g0BodyRot = body.rotation; g0Scale = body.localScale.x;
                if (mode == 1 || mode == 2)
                {
                    var h = mode == 1 ? left : right;
                    g0HandPos = h.t.position; g0Yaw = Yaw(h.t.rotation);
                    Haptic(h, 0.2f, 0.03f);
                }
                else if (mode == 3)
                {
                    g0Mid = (lp + rp) / 2; g0Dist = Mathf.Max(0.02f, Vector3.Distance(lp, rp));
                    var v = rp - lp; g0Angle = Mathf.Atan2(v.x, v.z) * Mathf.Rad2Deg;
                }
            }
            if (mode == 1 || mode == 2)
            {
                var h = mode == 1 ? left : right;
                var rot = Quaternion.Euler(0, Mathf.DeltaAngle(g0Yaw, Yaw(h.t.rotation)), 0);
                body.position = h.t.position + rot * (g0BodyPos - g0HandPos);
                body.rotation = rot * g0BodyRot;
            }
            else if (mode == 3)
            {
                var mid = (lp + rp) / 2;
                float s = Mathf.Clamp(g0Scale * Vector3.Distance(lp, rp) / g0Dist, 0.15f, 6f);
                var v = rp - lp;
                var rot = Quaternion.Euler(0, Mathf.DeltaAngle(g0Angle, Mathf.Atan2(v.x, v.z) * Mathf.Rad2Deg), 0);
                body.position = mid + rot * (g0BodyPos - g0Mid) * (s / g0Scale);
                body.rotation = rot * g0BodyRot;
                body.localScale = Vector3.one * s;
            }
        }

        void Pointer()
        {
            if (!right.tracked) { laser.enabled = false; hitDot.gameObject.SetActive(false); return; }
            var origin = rig.TransformPoint(right.pointerPos);
            var dir = rig.rotation * right.pointerRot * Vector3.forward;
            var ray = new Ray(origin, dir);
            float len = 4f;
            bool dot = false;

            // the hand menu first
            Button hb = null;
            if (menu && menu.gameObject.activeInHierarchy)
            {
                var mrt = (RectTransform)menu.transform;
                var plane = new Plane(mrt.forward, mrt.position);
                if (plane.Raycast(ray, out float enter) && enter < 2f)
                {
                    var wp = ray.GetPoint(enter);
                    if (mrt.rect.Contains((Vector2)mrt.InverseTransformPoint(wp)))
                    {
                        len = enter; dot = true;
                        foreach (var b in menuButtons)
                        {
                            var rt = (RectTransform)b.transform;
                            if (b.gameObject.activeInHierarchy && rt.rect.Contains((Vector2)rt.InverseTransformPoint(wp))) { hb = b; break; }
                        }
                    }
                }
            }
            if (hb != hoverButton)
            {
                if (hoverButton) hoverButton.transform.localScale = Vector3.one;
                hoverButton = hb;
                if (hb) { hb.transform.localScale = Vector3.one * 1.06f; Haptic(right, 0.1f, 0.015f); }
            }

            if (!dot)
            {
                // throttle the CPU picking a little
                if (Time.unscaledTime - lastPick > 0.04f)
                {
                    lastPick = Time.unscaledTime;
                    pointed = Picker.Pick(app.model, ray, out pointedAt, 0.3f, 6f);
                    app.model.Hover(pointed);
                }
                if (pointed != null) { len = Vector3.Distance(origin, pointedAt); dot = true; }
            }
            else app.model.Hover(null);

            laser.enabled = true;
            laser.SetPosition(0, origin);
            laser.SetPosition(1, origin + dir * len);
            hitDot.gameObject.SetActive(dot);
            if (dot) hitDot.position = origin + dir * len;

            if (right.Down(right.trigger, right.triggerPrev))
            {
                if (hoverButton) { hoverButton.onClick.Invoke(); Haptic(right, 0.4f, 0.04f); }
                else
                {
                    if (pointed != null) labelAt = pointedAt;
                    app.SelectPart(pointed);
                    Haptic(right, pointed != null ? 0.5f : 0.15f, 0.05f);
                }
            }
        }

        void Buttons()
        {
            if (left.Down(left.primary, left.primaryPrev) && menu) { menu.gameObject.SetActive(!menu.gameObject.activeSelf); Haptic(left); }
            if (left.Down(left.secondary, left.secondaryPrev)) ResetBody();
            if (right.Down(right.primary, right.primaryPrev) && app.model.selected != null) app.voice.Speak(app.model.selected);
            if (right.Down(right.secondary, right.secondaryPrev) && app.model.selected != null) { app.model.Hide(app.model.selected); app.RefreshAll(); }
            if (right.Down(right.stickClick, right.stickClickPrev) && app.model.freePlaneOn) ToggleFreeze();
        }

        void ResetBody()
        {
            var b = app.model.transform;
            b.position = Vector3.zero; b.rotation = Quaternion.identity; b.localScale = Vector3.one;
            grabMode = -1;
            PlaceUser();
        }

        // ------------------------------------------------------------------ hand section
        void ToggleSection()
        {
            var m = app.model;
            m.freePlaneOn = !m.freePlaneOn;
            if (m.freePlaneOn && sectionQuad == null)
            {
                sectionQuad = Primitive(PrimitiveType.Quad, right.t, new Vector3(0.45f, 0.45f, 1), new Color(0.35f, 0.8f, 1f, 0.18f));
                sectionFrozen = false;
                sectionQuad.localPosition = new Vector3(0, 0, 0.1f);
            }
            if (sectionQuad) sectionQuad.gameObject.SetActive(m.freePlaneOn);
            RefreshMenu();
        }

        void ToggleFreeze()
        {
            if (sectionQuad == null) return;
            sectionFrozen = !sectionFrozen;
            if (sectionFrozen) sectionQuad.SetParent(app.model.transform, true);
            else
            {
                sectionQuad.SetParent(right.t, false);
                sectionQuad.localPosition = new Vector3(0, 0, 0.1f);
                sectionQuad.localRotation = Quaternion.identity;
                sectionQuad.localScale = new Vector3(0.45f, 0.45f, 1);
            }
            Haptic(right);
            RefreshMenu();
        }

        void UpdateSection()
        {
            var m = app.model;
            if (!m.freePlaneOn || sectionQuad == null) return;
            // keeps what lies beyond the plane (away from the hand), cutting the body open towards the viewer
            m.freePlane = new Plane(sectionQuad.forward, sectionQuad.position);
        }

        // ------------------------------------------------------------------ name label
        void BuildLabel()
        {
            var go = new GameObject("VR Label", typeof(RectTransform));
            go.transform.SetParent(rig, false);
            label = go.AddComponent<Canvas>();
            label.renderMode = RenderMode.WorldSpace;
            label.worldCamera = headCam;
            go.AddComponent<CanvasScaler>().dynamicPixelsPerUnit = 4;
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = new Vector2(900, 90);
            rt.localScale = Vector3.one * 0.0005f;
            var bg = UIKit.Panel(rt, "Bg", new Color(0.05f, 0.08f, 0.13f, 0.85f));
            ((RectTransform)bg.transform).Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            labelText = UIKit.Label(rt, "", 46, Color.white, FontStyle.Bold, TextAnchor.MiddleCenter);
            ((RectTransform)labelText.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(12, 0), new Vector2(-12, 0));
            go.SetActive(false);
        }

        void UpdateLabel()
        {
            var p = app.model.selected;
            bool show = p != null && label != null;
            if (label) label.gameObject.SetActive(show);
            if (!show) return;
            UIKit.SetText(labelText, p.Name);
            var b = app.model.WorldBounds(p);
            var at = (labelAt != Vector3.zero && b.Contains(labelAt)) ? labelAt : b.center;
            var pos = at + Vector3.up * 0.07f * Mathf.Max(0.5f, app.model.transform.localScale.x);
            label.transform.position = pos;
            label.transform.rotation = Quaternion.LookRotation(pos - head.position, Vector3.up);
        }

        // ------------------------------------------------------------------ hand menu
        public void RebuildMenu()
        {
            if (!InVR || left == null) return;
            if (menu) Destroy(menu.gameObject);
            BuildMenu();
        }

        void BuildMenu()
        {
            menuButtons.Clear();
            menuByKey.Clear();
            var go = new GameObject("VR Menu", typeof(RectTransform));
            go.transform.SetParent(left.t, false);
            menu = go.AddComponent<Canvas>();
            menu.renderMode = RenderMode.WorldSpace;
            menu.worldCamera = headCam;
            go.AddComponent<CanvasScaler>().dynamicPixelsPerUnit = 4;
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = new Vector2(660, 900);
            rt.pivot = new Vector2(0.5f, 0);
            rt.localScale = Vector3.one * 0.00042f;
            rt.localPosition = new Vector3(0, 0.06f, 0.05f);
            rt.localRotation = Quaternion.Euler(35, 0, 0);

            var bg = UIKit.Panel(rt, "Bg", new Color(0.06f, 0.09f, 0.14f, 0.94f));
            ((RectTransform)bg.transform).Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            menuTitle = UIKit.Label(rt, "", 30, Color.white, FontStyle.Bold, L.Ar ? TextAnchor.UpperRight : TextAnchor.UpperLeft);
            ((RectTransform)menuTitle.transform).Anchor(new Vector2(0, 1), Vector2.one, new Vector2(18, -60), new Vector2(-18, -12));
            menuDesc = UIKit.Label(rt, "", 19, new Color(0.75f, 0.82f, 0.92f), FontStyle.Normal, L.Ar ? TextAnchor.UpperRight : TextAnchor.UpperLeft);
            menuDesc.horizontalOverflow = HorizontalWrapMode.Wrap;
            ((RectTransform)menuDesc.transform).Anchor(new Vector2(0, 1), Vector2.one, new Vector2(18, -190), new Vector2(-18, -64));

            var grid = UIKit.Rect(rt, "Grid").Anchor(Vector2.zero, Vector2.one, new Vector2(10, 64), new Vector2(-10, -200));
            var gl = grid.gameObject.AddComponent<GridLayoutGroup>();
            gl.cellSize = new Vector2(152, 54);
            gl.spacing = new Vector2(8, 8);
            gl.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            gl.constraintCount = 4;
            gl.startCorner = L.Ar ? GridLayoutGroup.Corner.UpperRight : GridLayoutGroup.Corner.UpperLeft;
            gl.childAlignment = TextAnchor.UpperCenter;

            var m = app.model;
            foreach (var s in m.systemList)
            {
                var st = s;
                Add(grid, "sys:" + s.def.id, L.Ar ? s.def.ar : s.def.en, () => { st.visible = !st.visible; m.ApplyAll(); app.RefreshAll(); }, 17);
            }
            Add(grid, "male", L.T("male"), () => { m.SetSex(false); app.RefreshAll(); });
            Add(grid, "female", L.T("female"), () => { m.SetSex(true); app.RefreshAll(); });
            Add(grid, "xray", L.T("xray"), () => { m.xray = !m.xray; m.ApplyAll(); app.RefreshAll(); });
            Add(grid, "showAll", L.T("showAll"), () => { m.ShowAll(); app.RefreshAll(); });
            Add(grid, "heart", L.T("heart"), () => { m.heartbeat = !m.heartbeat; app.RefreshAll(); });
            Add(grid, "breath", L.T("breath"), () => { m.breathing = !m.breathing; app.RefreshAll(); });
            Add(grid, "flow", L.T("flow"), () => { m.flow = !m.flow; app.RefreshAll(); });
            Add(grid, "explode", L.T("explode"), () => { m.explode = m.explode >= 0.99f ? 0 : Mathf.Min(1, m.explode + 0.34f); app.RefreshAll(); });
            Add(grid, "section", L.T("vrSection"), ToggleSection);
            Add(grid, "freeze", L.T("vrFreeze"), ToggleFreeze);
            Add(grid, "larger", L.T("vrScaleUp"), () => ScaleBody(1.25f));
            Add(grid, "smaller", L.T("vrScaleDown"), () => ScaleBody(0.8f));
            Add(grid, "reset", L.T("vrResetBody"), ResetBody);
            Add(grid, "speak", L.T("speak"), () => app.voice.Speak(m.selected));
            Add(grid, "lang", L.T("lang"), app.ToggleLanguage);
            Add(grid, "exit", L.T("vrExit"), ExitVR, 16, new Color(0.7f, 0.2f, 0.2f));

            var help = UIKit.Label(rt, L.T("vrHelp"), 15, new Color(0.6f, 0.68f, 0.8f), FontStyle.Normal, TextAnchor.MiddleCenter);
            help.horizontalOverflow = HorizontalWrapMode.Wrap;
            ((RectTransform)help.transform).Anchor(Vector2.zero, new Vector2(1, 0), new Vector2(12, 6), new Vector2(-12, 60));
            RefreshMenu();
        }

        void Add(Transform grid, string key, string text, UnityEngine.Events.UnityAction action, int size = 18, Color? color = null)
        {
            var b = UIKit.Button(grid, text, action, color, size);
            menuButtons.Add(b);
            menuByKey[key] = b;
        }

        void ScaleBody(float k)
        {
            var b = app.model.transform;
            float s = Mathf.Clamp(b.localScale.x * k, 0.15f, 6f);
            // scale about the body's feet so it stays on the floor
            b.localScale = Vector3.one * s;
            grabMode = -1;
        }

        public void RefreshMenu()
        {
            if (!menu) return;
            var m = app.model;
            foreach (var s in m.systemList)
                if (menuByKey.TryGetValue("sys:" + s.def.id, out var b)) UIKit.SetOn(b, s.visible);
            void On(string k, bool v) { if (menuByKey.TryGetValue(k, out var b)) UIKit.SetOn(b, v); }
            On("male", !m.female); On("female", m.female); On("xray", m.xray);
            On("heart", m.heartbeat); On("breath", m.breathing); On("flow", m.flow);
            On("explode", m.explode > 0); On("section", m.freePlaneOn); On("freeze", sectionFrozen);
            var p = m.selected;
            UIKit.SetText(menuTitle, p != null ? p.Name : L.T("title"));
            var d = p != null ? p.Desc : L.T("noSel");
            if (d != null && d.Length > 260) d = d.Substring(0, 257) + "…";
            UIKit.SetText(menuDesc, d);
        }
    }
}
