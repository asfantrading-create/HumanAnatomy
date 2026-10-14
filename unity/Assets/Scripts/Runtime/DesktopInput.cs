using System.Collections.Generic;
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
            var key = Map(k);
            return key != UnityEngine.InputSystem.Key.None && kb[key].wasPressedThisFrame;
        }
        static Key Map(KeyCode k)
        {
            switch (k)
            {
                case KeyCode.Escape: return UnityEngine.InputSystem.Key.Escape;
                case KeyCode.Delete: return UnityEngine.InputSystem.Key.Delete;
                case KeyCode.F11: return UnityEngine.InputSystem.Key.F11;
                case KeyCode.Space: return UnityEngine.InputSystem.Key.Space;
                case KeyCode.Alpha1: return UnityEngine.InputSystem.Key.Digit1;
                case KeyCode.Alpha2: return UnityEngine.InputSystem.Key.Digit2;
                case KeyCode.Alpha3: return UnityEngine.InputSystem.Key.Digit3;
                case KeyCode.Alpha4: return UnityEngine.InputSystem.Key.Digit4;
                case KeyCode.Alpha5: return UnityEngine.InputSystem.Key.Digit5;
                case KeyCode.A: return UnityEngine.InputSystem.Key.A;
                case KeyCode.B: return UnityEngine.InputSystem.Key.B;
                case KeyCode.C: return UnityEngine.InputSystem.Key.C;
                case KeyCode.F: return UnityEngine.InputSystem.Key.F;
                case KeyCode.H: return UnityEngine.InputSystem.Key.H;
                case KeyCode.I: return UnityEngine.InputSystem.Key.I;
                case KeyCode.L: return UnityEngine.InputSystem.Key.L;
                case KeyCode.N: return UnityEngine.InputSystem.Key.N;
                case KeyCode.P: return UnityEngine.InputSystem.Key.P;
                case KeyCode.Q: return UnityEngine.InputSystem.Key.Q;
                case KeyCode.R: return UnityEngine.InputSystem.Key.R;
                case KeyCode.S: return UnityEngine.InputSystem.Key.S;
                case KeyCode.T: return UnityEngine.InputSystem.Key.T;
                case KeyCode.X: return UnityEngine.InputSystem.Key.X;
                case KeyCode.Z: return UnityEngine.InputSystem.Key.Z;
                default: return UnityEngine.InputSystem.Key.None;
            }
        }
        /// <summary>Fingers currently on the touch screen (interactive displays, tablets).</summary>
        public static int Touches(List<Vector2> positions)
        {
            positions.Clear();
            var ts = Touchscreen.current;
            if (ts == null) return 0;
            var all = ts.touches;
            for (int i = 0; i < all.Count; i++)
                if (all[i].press.isPressed) positions.Add(all[i].position.ReadValue());
            return positions.Count;
        }
        public static bool Shift => Keyboard.current != null && Keyboard.current.shiftKey.isPressed;
        public static bool Ctrl => Keyboard.current != null && Keyboard.current.ctrlKey.isPressed;
        public static bool Alt => Keyboard.current != null && Keyboard.current.altKey.isPressed;
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
        public static int Touches(List<Vector2> positions)
        {
            positions.Clear();
            for (int i = 0; i < Input.touchCount; i++)
            {
                var t = Input.GetTouch(i);
                if (t.phase != TouchPhase.Ended && t.phase != TouchPhase.Canceled) positions.Add(t.position);
            }
            return positions.Count;
        }
        public static bool Shift => Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
        public static bool Ctrl => Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl);
        public static bool Alt => Input.GetKey(KeyCode.LeftAlt) || Input.GetKey(KeyCode.RightAlt);
#endif
    }
}
