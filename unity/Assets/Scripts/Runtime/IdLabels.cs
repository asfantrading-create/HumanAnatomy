using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Asfan.Anatomy
{
    /// <summary>
    /// Automatic on-screen labels: an object-id render of the view tells which structures are really
    /// visible (not hidden behind others); the largest ones get a name at the centre of their visible area.
    /// </summary>
    public class IdLabels : MonoBehaviour
    {
        public AnatomyApp app;
        public RectTransform layer;
        public bool on;
        const int RW = 384, RH = 216, MaxLabels = 18;
        RenderTexture rt;
        Texture2D read;
        Camera idCam;
        Shader idShader;
        readonly List<Text> pool = new List<Text>();
        float next;
        Vector3 lastPos; Quaternion lastRot;
        readonly Dictionary<int, int[]> acc = new Dictionary<int, int[]>();   // id -> count, sumX, sumY

        public void Set(bool v)
        {
            on = v;
            next = 0;
            if (!on) Hide(0);
        }

        void Hide(int from) { for (int i = from; i < pool.Count; i++) if (pool[i]) pool[i].gameObject.SetActive(false); }

        void LateUpdate()
        {
            if (!on || layer == null || !app.model.loaded || app.vr.InVR) { if (pool.Count > 0 && (!on || app.vr.InVR)) Hide(0); return; }
            var cam = app.desktopCam;
            bool moved = (cam.transform.position - lastPos).sqrMagnitude > 1e-8f || Quaternion.Angle(cam.transform.rotation, lastRot) > 0.01f;
            lastPos = cam.transform.position; lastRot = cam.transform.rotation;
            if (moved) { Hide(0); next = Time.unscaledTime + 0.15f; return; }   // relabel when the view settles
            if (Time.unscaledTime < next) return;
            next = Time.unscaledTime + (app.model.heartbeat || app.model.breathing || app.model.explode > 0 ? 0.6f : 2f);
            Relabel(cam);
        }

        void Relabel(Camera cam)
        {
            if (rt == null)
            {
                rt = new RenderTexture(RW, RH, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Linear) { filterMode = FilterMode.Point, antiAliasing = 1 };
                read = new Texture2D(RW, RH, TextureFormat.RGBA32, false, true);
                idShader = Shader.Find("Anatomy/Id");
                var go = new GameObject("Id Camera");
                go.hideFlags = HideFlags.HideAndDontSave;
                idCam = go.AddComponent<Camera>();
                idCam.enabled = false;
            }
            idCam.CopyFrom(cam);
            idCam.targetTexture = rt;
            idCam.clearFlags = CameraClearFlags.SolidColor;
            idCam.backgroundColor = Color.clear;
            idCam.allowMSAA = false;
            idCam.stereoTargetEye = StereoTargetEyeMask.None;
            idCam.cullingMask = ~(1 << 5);
            idCam.RenderWithShader(idShader, "");
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            read.ReadPixels(new Rect(0, 0, RW, RH), 0, 0);
            read.Apply(false);
            RenderTexture.active = prev;

            acc.Clear();
            var px = read.GetPixels32();
            for (int y = 0; y < RH; y++)
                for (int x = 0; x < RW; x++)
                {
                    var c = px[y * RW + x];
                    if (c.a == 0) continue;
                    int id = c.r | (c.g << 8) | (c.b << 16);
                    if (id == 0) continue;
                    if (!acc.TryGetValue(id, out var a)) acc[id] = a = new int[3];
                    a[0]++; a[1] += x; a[2] += y;
                }
            var list = new List<KeyValuePair<int, int[]>>(acc);
            list.Sort((a, b) => b.Value[0].CompareTo(a.Value[0]));

            var placed = new List<Rect>();
            int n = 0;
            float sx = (float)Screen.width / RW, sy = (float)Screen.height / RH;
            foreach (var kv in list)
            {
                if (n >= MaxLabels || kv.Value[0] < 40) break;
                int idx = kv.Key - 1;
                if (idx < 0 || idx >= app.model.parts.Count) continue;
                var p = app.model.parts[idx];
                var screen = new Vector2(kv.Value[1] / (float)kv.Value[0] * sx, kv.Value[2] / (float)kv.Value[0] * sy);
                if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(layer, screen, null, out var local)) continue;
                var t = Get(n);
                UIKit.SetText(t, p.Name);
                var w = Mathf.Min(260, t.preferredWidth + 14);
                var r = new Rect(local.x - w / 2, local.y - 12, w, 24);
                bool overlap = false;
                foreach (var o in placed) if (o.Overlaps(r)) { overlap = true; break; }
                if (overlap) continue;
                placed.Add(r);
                var trt = (RectTransform)t.transform;
                trt.anchoredPosition = local;
                trt.sizeDelta = new Vector2(w, 24);
                t.gameObject.SetActive(true);
                n++;
            }
            Hide(n);
        }

        Text Get(int i)
        {
            while (pool.Count <= i || pool[i] == null)
            {
                var t = UIKit.Label(layer, "", 13, Color.white, FontStyle.Bold, TextAnchor.MiddleCenter);
                var bg = t.gameObject.AddComponent<Outline>();
                bg.effectColor = new Color(0, 0, 0, 0.9f);
                bg.effectDistance = new Vector2(1.2f, -1.2f);
                var rt2 = (RectTransform)t.transform;
                rt2.anchorMin = rt2.anchorMax = new Vector2(0.5f, 0.5f);
                if (pool.Count <= i) pool.Add(t); else pool[i] = t;
            }
            return pool[i];
        }

        void OnDestroy()
        {
            if (rt) rt.Release();
            if (idCam) Destroy(idCam.gameObject);
        }
    }
}
