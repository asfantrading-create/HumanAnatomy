using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Asfan.Anatomy
{
    /// <summary>Desktop camera: orbit (left drag), pan (right/middle drag), zoom (wheel), smooth focus.</summary>
    public class OrbitCamera : MonoBehaviour
    {
        public Vector3 target = new Vector3(0, 1.0f, 0);
        public float distance = 3.2f, yaw = 0, pitch = 5;
        Vector3 goalTarget; float goalDistance, goalYaw, goalPitch;
        Vector2 lastMouse;
        bool dragging;
        public bool PointerOverUI { get; private set; }
        public bool Dragged { get; private set; }
        Vector2 downPos;

        void Awake() { ResetView(true); }

        public void ResetView(bool instant = false)
        {
            goalTarget = new Vector3(0, 1.0f, 0); goalDistance = 3.2f; goalYaw = 0; goalPitch = 5;
            if (instant) { target = goalTarget; distance = goalDistance; yaw = goalYaw; pitch = goalPitch; Apply(); }
        }

        public void Focus(Bounds b, float minDistance = 0.12f)
        {
            goalTarget = b.center;
            goalDistance = Mathf.Clamp(Mathf.Max(minDistance, b.extents.magnitude * 2.8f), 0.12f, 6f);
        }

        public void SetGoal(Vector3 tgt, float yawDeg, float pitchDeg, float dist)
        {
            goalTarget = tgt; goalYaw = yawDeg; goalPitch = Mathf.Clamp(pitchDeg, -85, 85); goalDistance = Mathf.Clamp(dist, 0.12f, 8f);
            // take the short way round
            yaw = goalYaw + Mathf.DeltaAngle(goalYaw, yaw);
        }

        /// <summary>Camera position and target of the goal pose (used for saved views).</summary>
        public void GoalPose(out Vector3 pos, out Vector3 tgt)
        {
            tgt = goalTarget;
            pos = goalTarget - Quaternion.Euler(goalPitch, goalYaw, 0) * Vector3.forward * goalDistance;
        }

        public void AddYaw(float deg) => goalYaw += deg;

        // ------------------------------------------------------------------ touch screens
        readonly List<Vector2> touches = new List<Vector2>();
        int lastTouchCount;
        Vector2 touchStart, touchPrev;
        float pinchPrev;
        bool touchOnUI, touchMoved;
        /// <summary>Time of the last touch: mouse events Windows synthesises from touches are ignored around it.</summary>
        public float LastTouchTime { get; private set; } = -10;
        /// <summary>A single-finger tap (no drag) ended this frame at <see cref="TapPosition"/>.</summary>
        public bool Tapped { get; private set; }
        public Vector2 TapPosition { get; private set; }

        static bool OverUI(Vector2 pos)
        {
            var es = EventSystem.current;
            if (es == null) return false;
            var data = new PointerEventData(es) { position = pos };
            var hits = new List<RaycastResult>();
            es.RaycastAll(data, hits);
            return hits.Count > 0;
        }

        /// <summary>One finger orbits, two fingers pinch to zoom and drag to pan, a tap selects.</summary>
        bool TouchGestures()
        {
            Tapped = false;
            int n = DesktopInput.Touches(touches);
            if (n == 0)
            {
                if (lastTouchCount == 1 && !touchMoved && !touchOnUI) { Tapped = true; TapPosition = touchPrev; }
                bool wasTouching = lastTouchCount > 0;
                lastTouchCount = 0;
                return wasTouching;
            }
            LastTouchTime = Time.unscaledTime;
            if (n == 1)
            {
                var p = touches[0];
                if (lastTouchCount == 0) { touchStart = p; touchPrev = p; touchOnUI = OverUI(p); touchMoved = false; }
                else if (lastTouchCount == 1 && !touchOnUI)
                {
                    var d = p - touchPrev;
                    if ((p - touchStart).sqrMagnitude > 18 * 18) touchMoved = true;
                    if (touchMoved)
                    {
                        goalYaw += d.x * 0.3f;
                        goalPitch = Mathf.Clamp(goalPitch - d.y * 0.3f, -85, 85);
                    }
                }
                touchPrev = p;
            }
            else
            {
                var a = touches[0]; var b = touches[1];
                var mid = (a + b) / 2;
                float dist = Vector2.Distance(a, b);
                if (lastTouchCount != n) { pinchPrev = dist; touchPrev = mid; touchOnUI = OverUI(mid); }
                else if (!touchOnUI)
                {
                    if (pinchPrev > 1 && dist > 1) goalDistance = Mathf.Clamp(goalDistance * pinchPrev / dist, 0.12f, 8f);
                    var d = mid - touchPrev;
                    float k = distance * 0.0015f;
                    goalTarget -= Quaternion.Euler(pitch, yaw, 0) * new Vector3(d.x * k, d.y * k, 0);
                    pinchPrev = dist;
                    touchPrev = mid;
                }
                touchMoved = true;   // a two-finger gesture never selects
            }
            lastTouchCount = n;
            PointerOverUI = touchOnUI;
            return true;
        }

        void LateUpdate()
        {
            if (TouchGestures() || Time.unscaledTime - LastTouchTime < 0.6f)
            {
                // touch in use: ignore the mouse events Windows makes from the fingers
                dragging = false;
                Smooth();
                return;
            }
            var mouse = DesktopInput.MousePosition;
            PointerOverUI = EventSystem.current != null && EventSystem.current.IsPointerOverGameObject();
            for (int b = 0; b < 3; b++)
                if (DesktopInput.Down(b)) { dragging = !PointerOverUI; downPos = mouse; Dragged = false; lastMouse = mouse; }
            bool any = DesktopInput.Held(0) || DesktopInput.Held(1) || DesktopInput.Held(2);
            if (!any) dragging = false;
            if (dragging)
            {
                var d = mouse - lastMouse;
                if ((mouse - downPos).sqrMagnitude > 16) Dragged = true;
                if (DesktopInput.Held(0) && !DesktopInput.Shift && !DesktopInput.Alt)
                {
                    goalYaw += d.x * 0.3f;
                    goalPitch = Mathf.Clamp(goalPitch - d.y * 0.3f, -85, 85);
                }
                else
                {
                    float k = distance * 0.0015f;
                    var rot = Quaternion.Euler(pitch, yaw, 0);
                    goalTarget -= rot * new Vector3(d.x * k, d.y * k, 0);
                }
            }
            lastMouse = mouse;
            if (!PointerOverUI)
            {
                float s = DesktopInput.Scroll;
                if (Mathf.Abs(s) > 0.01f) goalDistance = Mathf.Clamp(goalDistance * Mathf.Pow(0.88f, s), 0.12f, 8f);
            }
            Smooth();
        }

        void Smooth()
        {
            float a = 1 - Mathf.Exp(-Time.unscaledDeltaTime * 10);
            target = Vector3.Lerp(target, goalTarget, a);
            distance = Mathf.Lerp(distance, goalDistance, a);
            yaw = Mathf.LerpAngle(yaw, goalYaw, a);
            pitch = Mathf.Lerp(pitch, goalPitch, a);
            Apply();
        }

        void Apply()
        {
            // the body faces -Z, so the default view looks along +Z
            var rot = Quaternion.Euler(pitch, yaw, 0);
            transform.position = target - rot * Vector3.forward * distance;
            transform.rotation = rot;
        }
    }
}
