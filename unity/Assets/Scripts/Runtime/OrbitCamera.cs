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

        void LateUpdate()
        {
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
