using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Rendering;

namespace Asfan.Anatomy
{
    [Serializable]
    public class SystemDef { public string id, ar, en, color; public float opacity; }

    [Serializable]
    public class PartDef
    {
        public string id, en, ar, descEn, descAr, system, group, color, sex, anim;
        public float alpha;
        public int vessel, nv, ni, pos, idx, fpos, col, fcol;
        public bool wide;
        public float[] min, max, fmin, fmax;
    }

    [Serializable]
    public class Manifest
    {
        public int version;
        public string source;
        public SystemDef[] systems;
        public float[] heart, sa;
        public string[] voiceKeys, voiceIds;
        public PartDef[] parts;
    }

    /// <summary>One anatomical structure.</summary>
    public class Part
    {
        public int index;
        public PartDef def;
        public string Name => L.Ar ? def.ar : def.en;
        public string OtherName => L.Ar ? def.en : def.ar;
        public string Desc => L.Ar ? def.descAr : def.descEn;
        public GameObject go;
        public Mesh mesh;
        public MeshRenderer mr;
        public Material mat;
        public Color baseColor;
        public Vector3[] male, female, current;
        public Vector3[] maleN, femaleN;
        public Color32[] maleCol, femaleCol;
        public int[] tris;
        public Bounds bounds;            // body frame
        public Vector3 explodeDir;
        public bool hidden;
        public float opacity = 1;
    }

    public class SystemState { public SystemDef def; public bool visible = true; public float opacity; public Color color; }

    /// <summary>Loads the exported model and owns its rendering state (visibility, opacity, sex, animation, sections).</summary>
    public class AnatomyModel : MonoBehaviour
    {
        public readonly List<Part> parts = new List<Part>();
        public readonly Dictionary<string, SystemState> systems = new Dictionary<string, SystemState>();
        public readonly List<SystemState> systemList = new List<SystemState>();
        public Manifest manifest;
        public bool loaded;
        public string error;
        public float progress;

        public bool female, xray, heartbeat, breathing, flow;
        public float explode;
        public Part selected, hovered;
        public event Action Changed;

        // sections in the body frame: normal (pointing to the kept side) and offset; enabled flags
        public readonly bool[] secOn = new bool[3];
        public readonly bool[] secFlip = new bool[3];
        public readonly float[] secValue = { 0f, 1.2f, 0f };
        /// <summary>Optional free plane (VR hand section) in world space; w = offset.</summary>
        public bool freePlaneOn;
        public Plane freePlane;

        static readonly Vector3 BodyCenter = new Vector3(0, 1.08f, 0);
        static readonly Dictionary<string, float> XRay = new Dictionary<string, float> { ["skin"] = 0.08f, ["muscular"] = 0.15f, ["skeletal"] = 0.5f };
        Shader shader;
        Vector3 heartPivot, lungPivot;
        readonly List<Part> heartSet = new List<Part>(), lungSet = new List<Part>(), diaphragmSet = new List<Part>();

        static readonly int IdBaseColor = Shader.PropertyToID("_BaseColor"), IdEmission = Shader.PropertyToID("_Emission"),
            IdSrc = Shader.PropertyToID("_SrcBlend"), IdDst = Shader.PropertyToID("_DstBlend"), IdZWrite = Shader.PropertyToID("_ZWrite"),
            IdZTest = Shader.PropertyToID("_ZTest"), IdPick = Shader.PropertyToID("_PickId");

        public static Color Hex(string hex) => ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.gray;

        public IEnumerator Load()
        {
            string dir = Application.streamingAssetsPath;
            string jsonPath = Path.Combine(dir, "anatomy.idx"), binPath = Path.Combine(dir, "anatomy.dat");
            if (!File.Exists(jsonPath) || !File.Exists(binPath)) { error = L.T("missing"); yield break; }
            shader = Shader.Find("Anatomy/Lit");

            byte[] bin = null;
            var read = Task.Run(() =>
            {
                manifest = JsonUtility.FromJson<Manifest>(AssetCrypto.ReadText(jsonPath));
                bin = AssetCrypto.ReadBytes(binPath);
                LearningData.Load();
            });
            while (!read.IsCompleted) { progress = 0.05f; yield return null; }
            if (read.IsFaulted) { error = read.Exception?.GetBaseException().Message; yield break; }

            foreach (var s in manifest.systems)
            {
                var st = new SystemState { def = s, opacity = s.opacity, color = Hex(s.color) };
                systems[s.id] = st;
                systemList.Add(st);
                var g = new GameObject(s.id);
                g.transform.SetParent(transform, false);
            }

            // decode vertex data on a worker thread
            var defs = manifest.parts;
            var decoded = new Part[defs.Length];
            var work = Task.Run(() =>
            {
                for (int i = 0; i < defs.Length; i++) decoded[i] = Decode(defs[i], bin, i);
            });
            while (!work.IsCompleted) { progress = 0.1f; yield return null; }
            if (work.IsFaulted) { error = work.Exception?.GetBaseException().Message; yield break; }

            var sw = System.Diagnostics.Stopwatch.StartNew();
            for (int i = 0; i < decoded.Length; i++)
            {
                Build(decoded[i]);
                parts.Add(decoded[i]);
                byId[decoded[i].def.id] = decoded[i];
                if (sw.ElapsedMilliseconds > 30) { progress = 0.15f + 0.85f * i / decoded.Length; sw.Restart(); yield return null; }
            }
            bin = null;

            heartSet.AddRange(parts.FindAll(p => p.def.anim == "heart"));
            lungSet.AddRange(parts.FindAll(p => p.def.anim == "lung"));
            diaphragmSet.AddRange(parts.FindAll(p => p.def.anim == "diaphragm"));
            heartPivot = V(manifest.heart);
            lungPivot = Center(lungSet) + new Vector3(0, 0.06f, 0);
            Shader.SetGlobalVector("_AnatHeart", heartPivot);
            Shader.SetGlobalVector("_AnatSA", V(manifest.sa));
            progress = 1;
            loaded = true;
            ApplyAll();
        }

        static Vector3 V(float[] a) => a != null && a.Length >= 3 ? new Vector3(a[0], a[1], a[2]) : Vector3.zero;
        static Vector3 Center(List<Part> list)
        {
            var s = Vector3.zero;
            foreach (var p in list) s += p.bounds.center;
            return list.Count > 0 ? s / list.Count : Vector3.zero;
        }

        static Vector3[] Positions(byte[] bin, int offset, int n, float[] min, float[] max)
        {
            var v = new Vector3[n];
            float sx = (max[0] - min[0]) / 65535f, sy = (max[1] - min[1]) / 65535f, sz = (max[2] - min[2]) / 65535f;
            for (int i = 0, o = offset; i < n; i++, o += 6)
            {
                v[i] = new Vector3(
                    min[0] + BitConverter.ToUInt16(bin, o) * sx,
                    min[1] + BitConverter.ToUInt16(bin, o + 2) * sy,
                    min[2] + BitConverter.ToUInt16(bin, o + 4) * sz);
            }
            return v;
        }
        static Color32[] Colors(byte[] bin, int offset, int n)
        {
            var c = new Color32[n];
            for (int i = 0, o = offset; i < n; i++, o += 3) c[i] = new Color32(bin[o], bin[o + 1], bin[o + 2], 255);
            return c;
        }

        static Part Decode(PartDef d, byte[] bin, int index)
        {
            var p = new Part { index = index, def = d };
            p.male = Positions(bin, d.pos, d.nv, d.min, d.max);
            if (d.fpos >= 0 && d.fmin != null && d.fmin.Length == 3) p.female = Positions(bin, d.fpos, d.nv, d.fmin, d.fmax);
            p.tris = new int[d.ni];
            if (d.wide) for (int i = 0; i < d.ni; i++) p.tris[i] = (int)BitConverter.ToUInt32(bin, d.idx + i * 4);
            else for (int i = 0; i < d.ni; i++) p.tris[i] = BitConverter.ToUInt16(bin, d.idx + i * 2);
            if (d.col >= 0) p.maleCol = Colors(bin, d.col, d.nv);
            if (d.fcol >= 0) p.femaleCol = Colors(bin, d.fcol, d.nv);
            p.current = p.male;
            return p;
        }

        void Build(Part p)
        {
            var d = p.def;
            var mesh = new Mesh { name = d.id, indexFormat = d.nv > 65535 ? IndexFormat.UInt32 : IndexFormat.UInt16 };
            mesh.vertices = p.male;
            mesh.SetTriangles(p.tris, 0, true);
            mesh.RecalculateNormals();
            p.maleN = mesh.normals;
            if (p.maleCol != null) mesh.colors32 = p.maleCol;
            mesh.RecalculateBounds();
            p.mesh = mesh;
            p.bounds = mesh.bounds;
            p.explodeDir = Vector3.Scale(p.bounds.center - BodyCenter, new Vector3(1, 0.6f, 1));

            var go = new GameObject(d.id);
            var parent = transform.Find(d.system);
            if (parent == null) parent = transform;
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.shadowCastingMode = ShadowCastingMode.Off;
            mr.receiveShadows = false;
            mr.lightProbeUsage = LightProbeUsage.Off;
            mr.reflectionProbeUsage = ReflectionProbeUsage.Off;
            var mat = new Material(shader) { name = d.id };
            p.baseColor = Hex(d.color);
            mat.SetColor(IdBaseColor, p.baseColor);
            mat.SetFloat("_Gloss", d.system == "skeletal" ? 0.25f : d.system == "skin" ? 0.3f : 0.55f);
            mat.SetFloat("_UseVColor", p.maleCol != null ? 1 : 0);
            mat.SetFloat("_Muscle", d.system == "muscular" && !d.en.ToLowerInvariant().Contains("tendon") ? 1 : 0);
            mat.SetFloat("_Vessel", d.vessel);
            mr.sharedMaterial = mat;
            p.go = go; p.mr = mr; p.mat = mat;
        }

        // ------------------------------------------------------------------ state
        public bool SexOk(Part p) => p.def.sex == "f" ? female : p.def.sex == "m" ? !female : true;

        public float EffectiveOpacity(Part p)
        {
            var sys = systems.TryGetValue(p.def.system, out var s) ? s : null;
            float op = Mathf.Min(1, (sys?.opacity ?? 1) * (p.def.alpha <= 0 ? 1 : p.def.alpha));
            if (xray && XRay.TryGetValue(p.def.system, out var x)) op = Mathf.Min(op, x);
            if (isolated != null && !isolated.Contains(p)) op = Mathf.Min(op, p.def.system == "skin" ? 0.04f : 0.08f);
            // during a quiz question everything except the structure asked about is ghosted
            if (quizTarget != null && quizTarget != p && (quizName || quizRevealed)) op = Mathf.Min(op, p.def.system == "skin" ? 0.03f : 0.07f);
            if (tourHighlight != null && tourHighlight.Count > 0 && !tourHighlight.Contains(p)) op = Mathf.Min(op, p.def.system == "skin" ? 0.05f : 0.12f);
            return op;
        }

        /// <summary>Quiz/exam target drawn in green on top of everything (name mode, or after a "find" answer).</summary>
        public Part quizTarget;
        public bool quizName = true, quizRevealed;
        public HashSet<Part> tourHighlight;
        public bool QuizShown(Part p) => quizTarget == p && (quizName || quizRevealed);

        public HashSet<Part> isolated;

        public bool IsVisible(Part p)
        {
            var sys = systems.TryGetValue(p.def.system, out var s) ? s : null;
            return SexOk(p) && (sys == null || sys.visible) && !p.hidden && EffectiveOpacity(p) > 0.01f;
        }

        public void ApplyPart(Part p)
        {
            float op = EffectiveOpacity(p);
            bool onTop = QuizShown(p);
            bool vis = IsVisible(p) || onTop;
            if (onTop) op = 1;
            p.opacity = op;
            if (p.go.activeSelf != vis) p.go.SetActive(vis);
            if (!vis) return;
            var m = p.mat;
            var c = p.baseColor;
            c.a = op;
            m.SetColor(IdBaseColor, c);
            bool transparent = op < 0.999f;
            if (transparent)
            {
                m.SetFloat(IdSrc, (float)BlendMode.SrcAlpha);
                m.SetFloat(IdDst, (float)BlendMode.OneMinusSrcAlpha);
                m.SetFloat(IdZWrite, op > 0.5f ? 1 : 0);
                // skin is drawn after the translucent organs
                m.renderQueue = p.def.system == "skin" ? 3020 : 3010;
            }
            else
            {
                m.SetFloat(IdSrc, (float)BlendMode.One);
                m.SetFloat(IdDst, (float)BlendMode.Zero);
                m.SetFloat(IdZWrite, 1);
                m.renderQueue = 2000;
            }
            m.SetFloat(IdZTest, (float)(onTop ? CompareFunction.Always : CompareFunction.LessEqual));
            if (onTop) { m.renderQueue = 4000; m.SetColor(IdBaseColor, new Color(0.07f, 0.76f, 0.35f, 1)); }
            // labels / id pass: only clearly visible structures take part
            m.SetVector(IdPick, new Vector4(((p.index + 1) & 255) / 255f, (((p.index + 1) >> 8) & 255) / 255f, (((p.index + 1) >> 16) & 255) / 255f,
                op >= 0.45f && p.def.system != "skin" ? 1 : 0));
            Color e = Color.black;
            if (onTop) e = new Color(0f, 0.55f, 0.22f);
            else if (selected == p || (tourHighlight != null && tourHighlight.Contains(p))) e = new Color(0.10f, 0.38f, 0.75f);
            else if (hovered == p) e = new Color(0.20f, 0.24f, 0.32f);
            m.SetColor(IdEmission, e);
        }

        public void ApplyAll()
        {
            foreach (var p in parts) ApplyPart(p);
            Changed?.Invoke();
        }

        public void SetSex(bool f)
        {
            if (female == f) return;
            female = f;
            foreach (var p in parts)
            {
                if (p.female == null) continue;
                var pos = f ? p.female : p.male;
                p.mesh.vertices = pos;
                p.current = pos;
                if (f && p.femaleN == null) { p.mesh.RecalculateNormals(); p.femaleN = p.mesh.normals; }
                else p.mesh.normals = f ? p.femaleN : p.maleN;
                if (p.femaleCol != null) p.mesh.colors32 = f ? p.femaleCol : p.maleCol;
                p.mesh.RecalculateBounds();
                p.bounds = p.mesh.bounds;
                p.explodeDir = Vector3.Scale(p.bounds.center - BodyCenter, new Vector3(1, 0.6f, 1));
            }
            heartPivot = Center(heartSet);
            lungPivot = Center(lungSet) + new Vector3(0, 0.06f, 0);
            Shader.SetGlobalVector("_AnatHeart", heartPivot);
            if (selected != null && !SexOk(selected)) selected = null;
            ApplyAll();
        }

        public void Select(Part p)
        {
            var old = selected;
            selected = p;
            if (old != null) ApplyPart(old);
            if (p != null) ApplyPart(p);
            Changed?.Invoke();
        }

        public void Hover(Part p)
        {
            if (hovered == p) return;
            var old = hovered;
            hovered = p;
            if (old != null) ApplyPart(old);
            if (p != null) ApplyPart(p);
        }

        public void Hide(Part p) { if (p == null) return; PushUndo(); p.hidden = true; if (selected == p) selected = null; ApplyAll(); }

        // ------------------------------------------------------------------ undo (hide / isolate / show all / systems)
        readonly Stack<Action> undo = new Stack<Action>();
        public void PushUndo()
        {
            var hidden = parts.FindAll(q => q.hidden);
            var iso = isolated;
            var vis = systemList.ConvertAll(s => s.visible);
            undo.Push(() =>
            {
                foreach (var q in parts) q.hidden = false;
                foreach (var q in hidden) q.hidden = true;
                isolated = iso;
                for (int i = 0; i < vis.Count; i++) systemList[i].visible = vis[i];
            });
            if (undo.Count > 50) { var keep = undo.ToArray(); undo.Clear(); for (int i = 39; i >= 0; i--) undo.Push(keep[i]); }
        }
        public bool Undo()
        {
            if (undo.Count == 0) return false;
            undo.Pop()();
            ApplyAll();
            return true;
        }

        /// <summary>Shows only the given systems (skin faint), as lessons and exams do.</summary>
        public void ShowOnlySystems(ICollection<string> ids)
        {
            foreach (var s in systemList)
            {
                s.visible = ids.Contains(s.def.id) || s.def.id == "skin";
                s.opacity = s.def.id == "skin" ? 0.08f : 1;
            }
        }

        public Part ById(string id) { byId.TryGetValue(id ?? "", out var p); return p; }
        readonly Dictionary<string, Part> byId = new Dictionary<string, Part>();

        public void Isolate(Part p)
        {
            PushUndo();
            isolated = p == null ? null : new HashSet<Part>(parts.FindAll(q => q == p || (q.def.group == p.def.group && q.def.system == p.def.system)));
            ApplyAll();
        }

        public void ShowAll()
        {
            PushUndo();
            foreach (var p in parts) p.hidden = false;
            foreach (var s in systemList) s.visible = true;
            isolated = null;
            ApplyAll();
        }

        /// <summary>World-space bounds of a part (uses the current body transform).</summary>
        public Bounds WorldBounds(Part p)
        {
            var b = p.bounds;
            var t = p.go.transform;
            var c = t.TransformPoint(b.center);
            var e = Vector3.Scale(b.extents, t.lossyScale);
            return new Bounds(c, e * 2);
        }

        // ------------------------------------------------------------------ per frame
        void Update()
        {
            if (!loaded) return;
            float time = Time.time;
            float beat = heartbeat ? HeartCurve(time * (72f / 60f)) : 0;
            float breath = breathing ? (1 - Mathf.Cos(time * Mathf.PI * 2 * (14f / 60f))) / 2 : 0;
            bool animate = beat > 0 || breath > 0 || explode > 0 || animWasOn;
            animWasOn = beat > 0 || breath > 0 || explode > 0;
            if (animate)
            {
                foreach (var p in parts)
                {
                    float s = 1, sy = 1, dy = 0;
                    Vector3 pivot = Vector3.zero;
                    bool piv = false;
                    if (beat > 0 && p.def.anim == "heart") { s = 1 - 0.06f * beat; sy = s; pivot = heartPivot; piv = true; }
                    else if (breath > 0 && p.def.anim == "lung") { s = 1 + 0.05f * breath; sy = 1 + 0.08f * breath; pivot = lungPivot; piv = true; }
                    else if (breath > 0 && p.def.anim == "diaphragm") dy = -0.018f * breath;
                    var off = p.def.system == "skin" ? Vector3.zero : p.explodeDir * (explode * 1.4f);
                    if (piv) off += new Vector3(pivot.x * (1 - s), pivot.y * (1 - sy), pivot.z * (1 - s));
                    off.y += dy;
                    var t = p.go.transform;
                    t.localPosition = off;
                    t.localScale = new Vector3(s, sy, s);
                }
            }

            // section planes (body frame -> world)
            bool any = false;
            for (int a = 0; a < 3; a++)
            {
                Vector4 plane = new Vector4(0, 0, 0, 1);
                if (secOn[a])
                {
                    any = true;
                    var n = a == 0 ? Vector3.right : a == 1 ? Vector3.up : Vector3.forward;
                    // keep the side below the value (or above when flipped)
                    var nl = secFlip[a] ? n : -n;
                    var pt = n * secValue[a];
                    var wn = transform.TransformDirection(nl).normalized;
                    var wp = transform.TransformPoint(pt);
                    plane = new Vector4(wn.x, wn.y, wn.z, -Vector3.Dot(wn, wp));
                }
                if (a == 2 && freePlaneOn)
                {
                    any = true;
                    plane = new Vector4(freePlane.normal.x, freePlane.normal.y, freePlane.normal.z, freePlane.distance);
                }
                Shader.SetGlobalVector(a == 0 ? "_AnatClip0" : a == 1 ? "_AnatClip1" : "_AnatClip2", plane);
            }
            Shader.SetGlobalFloat("_AnatSection", any ? 1 : 0);
            Shader.SetGlobalFloat("_AnatFlow", flow ? 1 : 0);
            Shader.SetGlobalFloat("_AnatTime", time);
        }
        bool animWasOn = true;

        /// <summary>True when a world point is removed by an active section (used by picking).</summary>
        public bool Clipped(Vector3 world)
        {
            for (int a = 0; a < 3; a++)
            {
                var v = Shader.GetGlobalVector(a == 0 ? "_AnatClip0" : a == 1 ? "_AnatClip1" : "_AnatClip2");
                if (v.x * world.x + v.y * world.y + v.z * world.z + v.w < 0) return true;
            }
            return false;
        }

        static float HeartCurve(float phase)
        {
            float f = phase % 1;
            // atrial kick then ventricular systole
            return Mathf.Max(0, Mathf.Sin(Mathf.Min(1, f / 0.35f) * Mathf.PI)) * (f < 0.35f ? 1 : 0) * 0.9f + (f < 0.12f ? 0.25f * Mathf.Sin(f / 0.12f * Mathf.PI) : 0);
        }
    }
}
