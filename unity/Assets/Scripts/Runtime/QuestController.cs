using UnityEngine;

namespace Asfan.Anatomy
{
    /// <summary>
    /// A modelled Meta Quest Touch Plus controller (built from simple shapes in code) that follows the
    /// real controller: the trigger and grip move, the thumbstick tilts and the face buttons light up when pressed.
    /// Coordinates are in the OpenXR grip pose of the hand (Z along the handle, Y up from the hand).
    /// </summary>
    public class QuestController : MonoBehaviour
    {
        Transform trigger, grip, stick, buttonA, buttonB;
        Material buttonMat, buttonOnMat;
        Renderer aR, bR;
        Vector3 gripRest, aRest, bRest;
        static Shader lit;

        static readonly Color Shell = new Color(0.07f, 0.075f, 0.085f);
        static readonly Color Face = new Color(0.11f, 0.115f, 0.13f);
        static readonly Color Button = new Color(0.20f, 0.21f, 0.24f);

        public static QuestController Build(Transform parent, bool left)
        {
            if (lit == null) lit = Shader.Find("Anatomy/Lit");
            var root = new GameObject(left ? "Left Controller" : "Right Controller").transform;
            root.SetParent(parent, false);
            var c = root.gameObject.AddComponent<QuestController>();
            c.Make(left);
            return c;
        }

        Material Mat(Color col, float gloss)
        {
            var m = new Material(lit);
            m.SetColor("_BaseColor", col);
            m.SetFloat("_Gloss", gloss);
            m.SetFloat("_Clip", 0);   // section planes never cut the controllers
            return m;
        }

        static Transform Part(PrimitiveType type, Transform parent, Vector3 pos, Vector3 euler, Vector3 scale, Material mat)
        {
            var go = GameObject.CreatePrimitive(type);
            var col = go.GetComponent<Collider>();
            if (col) Destroy(col);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localEulerAngles = euler;
            go.transform.localScale = scale;
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go.transform;
        }

        static Transform Pivot(Transform parent, string name, Vector3 pos, Vector3 euler)
        {
            var t = new GameObject(name).transform;
            t.SetParent(parent, false);
            t.localPosition = pos;
            t.localEulerAngles = euler;
            return t;
        }

        void Make(bool left)
        {
            float sx = left ? 1 : -1;   // the thumbstick sits towards the thumb
            var shell = Mat(Shell, 0.55f);
            var face = Mat(Face, 0.45f);
            buttonMat = Mat(Button, 0.7f);
            buttonOnMat = Mat(new Color(0.25f, 0.65f, 1f), 0.7f);
            buttonOnMat.SetColor("_Emission", new Color(0.1f, 0.35f, 0.7f));
            var t = transform;

            // handle: a rounded tube along the grip axis, slightly tilted
            Part(PrimitiveType.Capsule, t, new Vector3(0, -0.004f, -0.022f), new Vector3(78, 0, 0), new Vector3(0.033f, 0.052f, 0.036f), shell);
            // the rounded bottom of the handle
            Part(PrimitiveType.Sphere, t, new Vector3(0, -0.014f, -0.07f), Vector3.zero, new Vector3(0.031f, 0.03f, 0.03f), shell);

            // head with the face plate (tilted back towards the user)
            var head = Pivot(t, "Head", new Vector3(0, 0.014f, 0.034f), new Vector3(-28, 0, 0));
            Part(PrimitiveType.Cylinder, head, Vector3.zero, Vector3.zero, new Vector3(0.068f, 0.013f, 0.062f), shell);
            Part(PrimitiveType.Cylinder, head, new Vector3(0, 0.0125f, 0), Vector3.zero, new Vector3(0.061f, 0.0015f, 0.055f), face);
            // a soft bevel around the face
            Part(PrimitiveType.Sphere, head, new Vector3(0, -0.004f, 0.004f), Vector3.zero, new Vector3(0.07f, 0.024f, 0.066f), shell);

            var top = Pivot(head, "Face", new Vector3(0, 0.014f, 0), Vector3.zero);
            // thumbstick
            Part(PrimitiveType.Cylinder, top, new Vector3(sx * 0.012f, 0.0005f, 0.006f), Vector3.zero, new Vector3(0.022f, 0.001f, 0.022f), Mat(new Color(0.03f, 0.03f, 0.035f), 0.3f));
            stick = Pivot(top, "Stick", new Vector3(sx * 0.012f, 0.001f, 0.006f), Vector3.zero);
            Part(PrimitiveType.Cylinder, stick, new Vector3(0, 0.005f, 0), Vector3.zero, new Vector3(0.0065f, 0.005f, 0.0065f), shell);
            Part(PrimitiveType.Cylinder, stick, new Vector3(0, 0.0105f, 0), Vector3.zero, new Vector3(0.017f, 0.0022f, 0.017f), Mat(new Color(0.14f, 0.145f, 0.16f), 0.4f));
            // A / B (right) or X / Y (left)
            aRest = new Vector3(-sx * 0.013f, 0.001f, -0.008f);
            bRest = new Vector3(-sx * 0.008f, 0.001f, 0.010f);
            buttonA = Part(PrimitiveType.Cylinder, top, aRest, Vector3.zero, new Vector3(0.0115f, 0.0018f, 0.0115f), buttonMat);
            buttonB = Part(PrimitiveType.Cylinder, top, bRest, Vector3.zero, new Vector3(0.0115f, 0.0018f, 0.0115f), buttonMat);
            aR = buttonA.GetComponent<Renderer>(); bR = buttonB.GetComponent<Renderer>();
            // menu / Meta button
            Part(PrimitiveType.Cylinder, top, new Vector3(sx * 0.002f, 0.0008f, -0.019f), Vector3.zero, new Vector3(0.006f, 0.0012f, 0.006f), buttonMat);

            // index trigger under the front of the head
            trigger = Pivot(t, "Trigger", new Vector3(0, -0.006f, 0.05f), new Vector3(0, 0, 0));
            Part(PrimitiveType.Capsule, trigger, new Vector3(0, -0.013f, 0.006f), new Vector3(-20, 0, 0), new Vector3(0.016f, 0.014f, 0.012f), face);

            // grip button on the side of the handle under the middle finger
            gripRest = new Vector3(-sx * 0.012f, -0.022f, -0.004f);
            grip = Part(PrimitiveType.Capsule, t, gripRest, new Vector3(78, 0, 0), new Vector3(0.012f, 0.02f, 0.014f), face);
        }

        /// <summary>Moves the trigger, grip and thumbstick and lights the pressed buttons.</summary>
        public void Animate(float triggerValue, float gripValue, Vector2 stickValue, bool primary, bool secondary)
        {
            if (trigger == null) return;
            trigger.localEulerAngles = new Vector3(-18 * Mathf.Clamp01(triggerValue), 0, 0);
            grip.localPosition = gripRest + new Vector3(Mathf.Sign(gripRest.x) * -0.003f * Mathf.Clamp01(gripValue), 0, 0);
            stick.localEulerAngles = new Vector3(stickValue.y * 16, 0, -stickValue.x * 16);
            buttonA.localPosition = aRest - new Vector3(0, primary ? 0.0012f : 0, 0);
            buttonB.localPosition = bRest - new Vector3(0, secondary ? 0.0012f : 0, 0);
            aR.sharedMaterial = primary ? buttonOnMat : buttonMat;
            bR.sharedMaterial = secondary ? buttonOnMat : buttonMat;
        }
    }
}
