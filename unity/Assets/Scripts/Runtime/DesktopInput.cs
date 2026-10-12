using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace Asfan.Anatomy
{
    /// <summary>Mouse and keyboard access that works with either input backend.</summary>
    public static class DesktopInput
    {
#if ENABLE_INPUT_SYSTEM
        public static Vector2 MousePosition => Mouse.current != null ? Mouse.current.position.ReadValue() : Vector2.zero;
        public static bool Held(int b) => Btn(b)?.isPressed ?? false;
        public static bool Down(int b) => Btn(b)?.wasPressedThisFrame ?? false;
        public static bool Up(int b) => Btn(b)?.wasReleasedThisFrame ?? false;
        public static float Scroll
        {
            get
            {
                if (Mouse.current == null) return 0;
                float y = Mouse.current.scroll.ReadValue().y;
                return Mathf.Abs(y) > 20 ? y / 120f : y;   // Windows reports 120 per notch
            }
        }
        public static bool Key(KeyCode k)
        {
            var kb = Keyboard.current;
            if (kb == null) return false;
            switch (k)
            {
                case KeyCode.Escape: return kb.escapeKey.wasPressedThisFrame;
                case KeyCode.F: return kb.fKey.wasPressedThisFrame;
                case KeyCode.H: return kb.hKey.wasPressedThisFrame;
                case KeyCode.R: return kb.rKey.wasPressedThisFrame;
                case KeyCode.X: return kb.xKey.wasPressedThisFrame;
                case KeyCode.Space: return kb.spaceKey.wasPressedThisFrame;
                default: return false;
            }
        }
        public static bool Shift => Keyboard.current != null && Keyboard.current.shiftKey.isPressed;
        static UnityEngine.InputSystem.Controls.ButtonControl Btn(int b)
        {
            var m = Mouse.current;
            if (m == null) return null;
            return b == 0 ? m.leftButton : b == 1 ? m.rightButton : m.middleButton;
        }
#else
        public static Vector2 MousePosition => Input.mousePosition;
        public static bool Held(int b) => Input.GetMouseButton(b);
        public static bool Down(int b) => Input.GetMouseButtonDown(b);
        public static bool Up(int b) => Input.GetMouseButtonUp(b);
        public static float Scroll => Input.mouseScrollDelta.y;
        public static bool Key(KeyCode k) => Input.GetKeyDown(k);
        public static bool Shift => Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
#endif
    }
}
