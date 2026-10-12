using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

namespace Asfan.Anatomy
{
    /// <summary>Renders the certificate of completion (A4 landscape) off-screen and writes it as a PDF.</summary>
    public static class Certificate
    {
        const int W = 2339, H = 1654;   // A4 at 200 dpi

        public static IEnumerator Create(MonoBehaviour host, string name, int pct, int correct, int total, string level, List<string> systems, Action<string> done)
        {
            UIKit.Init();
            var rt = new RenderTexture(W, H, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            var camGo = new GameObject("Certificate Camera");
            camGo.transform.position = new Vector3(0, -5000, 0);
            var cam = camGo.AddComponent<Camera>();
            cam.enabled = false;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Color.white;
            cam.cullingMask = 1 << 30;
            cam.orthographic = true;
            cam.targetTexture = rt;
            cam.stereoTargetEye = StereoTargetEyeMask.None;

            var cgo = new GameObject("Certificate", typeof(RectTransform));
            cgo.layer = 30;
            var canvas = cgo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = cam;
            canvas.planeDistance = 1;
            var scaler = cgo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
            var root = (RectTransform)cgo.transform;
            Build(root, name, pct, correct, total, level, systems);
            SetLayer(cgo.transform, 30);

            yield return null;               // let the canvas take the camera size
            Canvas.ForceUpdateCanvases();
            foreach (var t in cgo.GetComponentsInChildren<RtlText>()) t.Refresh();
            Canvas.ForceUpdateCanvases();
            cam.Render();

            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(W, H, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, W, H), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            var jpg = tex.EncodeToJPG(92);
            UnityEngine.Object.Destroy(tex);
            UnityEngine.Object.Destroy(cgo);
            UnityEngine.Object.Destroy(camGo);
            rt.Release();
            UnityEngine.Object.Destroy(rt);

            var safe = string.Join("_", (string.IsNullOrWhiteSpace(name) ? "student" : name).Split(Path.GetInvalidFileNameChars()));
            var path = FileDialogs.Save(L.T("certificate"), "PDF|*.pdf", FileDialogs.Folder("Certificates"), "certificate-" + safe + ".pdf", "pdf")
                       ?? Path.Combine(FileDialogs.Folder("Certificates"), "certificate-" + safe + "-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".pdf");
            try { WritePdf(path, jpg, W, H); done?.Invoke(path); }
            catch (Exception e) { Debug.LogException(e); done?.Invoke(null); }
        }

        static void SetLayer(Transform t, int layer)
        {
            t.gameObject.layer = layer;
            foreach (Transform c in t) SetLayer(c, layer);
        }

        static Text Txt(RectTransform parent, string s, int size, Color c, FontStyle style, float y0, float y1)
        {
            var t = UIKit.Label(parent, s, size, c, style, TextAnchor.MiddleCenter);
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            ((RectTransform)t.transform).Anchor(new Vector2(0.06f, y0), new Vector2(0.94f, y1), Vector2.zero, Vector2.zero);
            return t;
        }

        static void Build(RectTransform root, string name, int pct, int correct, int total, string level, List<string> systems)
        {
            var bg = UIKit.Panel(root, "Bg", new Color(0.97f, 0.985f, 1f), false);
            ((RectTransform)bg.transform).Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var teal = new Color(0.06f, 0.62f, 0.54f);
            var frame = UIKit.Panel(root, "Frame", teal, false);
            ((RectTransform)frame.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(100, 100), new Vector2(-100, -100));
            var inner = UIKit.Panel(root, "Inner", new Color(0.97f, 0.985f, 1f), false);
            ((RectTransform)inner.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(112, 112), new Vector2(-112, -112));
            var line = UIKit.Panel(root, "Line", teal, false);
            ((RectTransform)line.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(132, 132), new Vector2(-132, -132));
            var inner2 = UIKit.Panel(root, "Inner2", new Color(0.97f, 0.985f, 1f), false);
            ((RectTransform)inner2.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(136, 136), new Vector2(-136, -136));

            var logoPath = Path.Combine(Application.streamingAssetsPath, "asfan-logo.png");
            if (File.Exists(logoPath))
            {
                var tex = new Texture2D(2, 2);
                tex.LoadImage(File.ReadAllBytes(logoPath));
                var raw = UIKit.Rect(root, "Logo").gameObject.AddComponent<RawImage>();
                raw.texture = tex;
                var lr = (RectTransform)raw.transform;
                lr.anchorMin = lr.anchorMax = new Vector2(0.5f, 0.86f);
                lr.sizeDelta = new Vector2(150f * tex.width / tex.height, 150);
            }
            var dark = new Color(0.06f, 0.09f, 0.16f);
            var muted = new Color(0.36f, 0.42f, 0.5f);
            Txt(root, L.T("certTitle"), 96, new Color(0.04f, 0.37f, 0.54f), FontStyle.Bold, 0.70f, 0.79f);
            Txt(root, L.T("appTitle") + "  –  Human Anatomy 3D", 40, muted, FontStyle.Normal, 0.645f, 0.70f);
            Txt(root, L.T("certGiven"), 46, dark, FontStyle.Normal, 0.57f, 0.63f);
            Txt(root, string.IsNullOrWhiteSpace(name) ? L.T("certStudent") : name, 92, dark, FontStyle.Bold, 0.465f, 0.565f);
            var rule = UIKit.Panel(root, "Rule", new Color(0.79f, 0.84f, 0.9f), false);
            ((RectTransform)rule.transform).Anchor(new Vector2(0.3f, 0.462f), new Vector2(0.7f, 0.462f), new Vector2(0, -2), new Vector2(0, 2));
            var sysNames = new List<string>();
            foreach (var s in systems) sysNames.Add(AnatomyApp.SystemName(s));
            var forText = L.T("certFor", "level", L.T("lvl_" + level), "systems", string.Join(L.Ar ? "، " : ", ", sysNames));
            Txt(root, forText, 42, dark, FontStyle.Normal, 0.30f, 0.45f);

            var pill = UIKit.Panel(root, "Score", teal);
            var pr = (RectTransform)pill.transform;
            pr.anchorMin = pr.anchorMax = new Vector2(0.5f, 0.24f);
            pr.sizeDelta = new Vector2(520, 110);
            var st = UIKit.Label(pill.transform, pct + "%  ·  " + correct + "/" + total, 52, Color.white, FontStyle.Bold, TextAnchor.MiddleCenter);
            ((RectTransform)st.transform).Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);

            var id = Guid.NewGuid().ToString("N").Substring(0, 8).ToUpperInvariant();
            var date = DateTime.Now.ToString(L.Ar ? "yyyy/MM/dd" : "d MMMM yyyy", System.Globalization.CultureInfo.InvariantCulture);
            var f1 = UIKit.Label(root, L.T("certDate") + ": " + date, 30, muted, FontStyle.Normal, TextAnchor.MiddleLeft);
            ((RectTransform)f1.transform).Anchor(new Vector2(0.1f, 0.1f), new Vector2(0.37f, 0.15f), Vector2.zero, Vector2.zero);
            var f2 = UIKit.Label(root, "ASFAN  ·  info@asfanco.com  ·  +962 77 614 0404", 30, muted, FontStyle.Normal, TextAnchor.MiddleCenter);
            ((RectTransform)f2.transform).Anchor(new Vector2(0.33f, 0.1f), new Vector2(0.67f, 0.15f), Vector2.zero, Vector2.zero);
            var f3 = UIKit.Label(root, L.T("certId") + ": " + id, 30, muted, FontStyle.Normal, TextAnchor.MiddleRight);
            ((RectTransform)f3.transform).Anchor(new Vector2(0.63f, 0.1f), new Vector2(0.9f, 0.15f), Vector2.zero, Vector2.zero);
        }

        /// <summary>Minimal single-page PDF (A4 landscape) holding one JPEG image.</summary>
        public static void WritePdf(string path, byte[] jpg, int w, int h)
        {
            using (var ms = new MemoryStream())
            {
                var offsets = new List<long>();
                void Raw(string s) { var b = Encoding.ASCII.GetBytes(s); ms.Write(b, 0, b.Length); }
                Raw("%PDF-1.4\n%âãÏÓ\n");
                void Obj(string body) { offsets.Add(ms.Position); Raw(offsets.Count + " 0 obj\n" + body + "\nendobj\n"); }
                Obj("<< /Type /Catalog /Pages 2 0 R >>");
                Obj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
                Obj("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
                offsets.Add(ms.Position);
                Raw("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + w + " /Height " + h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpg.Length + " >>\nstream\n");
                ms.Write(jpg, 0, jpg.Length);
                Raw("\nendstream\nendobj\n");
                var content = "q 842 0 0 595 0 0 cm /Im0 Do Q";
                Obj("<< /Length " + content.Length + " >>\nstream\n" + content + "\nendstream");
                long xref = ms.Position;
                Raw("xref\n0 " + (offsets.Count + 1) + "\n0000000000 65535 f \n");
                foreach (var o in offsets) Raw(o.ToString("D10") + " 00000 n \n");
                Raw("trailer\n<< /Size " + (offsets.Count + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                File.WriteAllBytes(path, ms.ToArray());
            }
        }
    }
}
