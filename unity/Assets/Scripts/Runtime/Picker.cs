using System.Collections.Generic;
using UnityEngine;

namespace Asfan.Anatomy
{
    /// <summary>CPU ray picking against the visible meshes (no colliders needed).</summary>
    public static class Picker
    {
        struct Candidate { public Part part; public float enter; }
        static readonly List<Candidate> candidates = new List<Candidate>();

        /// <param name="minOpacity">Translucent structures below this opacity are looked through.</param>
        public static Part Pick(AnatomyModel model, Ray worldRay, out Vector3 hitPoint, float minOpacity = 0.3f, float maxDistance = 100f)
        {
            hitPoint = Vector3.zero;
            if (model == null || !model.loaded) return null;
            candidates.Clear();
            foreach (var p in model.parts)
            {
                if (!p.go.activeInHierarchy || p.opacity < minOpacity) continue;
                var t = p.go.transform;
                var local = new Ray(t.InverseTransformPoint(worldRay.origin), t.InverseTransformDirection(worldRay.direction));
                var b = p.bounds;
                b.Expand(0.002f);
                if (b.IntersectRay(local, out float enter)) candidates.Add(new Candidate { part = p, enter = enter });
            }
            candidates.Sort((a, b) => a.enter.CompareTo(b.enter));

            Part best = null;
            float bestWorld = maxDistance;
            foreach (var c in candidates)
            {
                var t = c.part.go.transform;
                var o = t.InverseTransformPoint(worldRay.origin);
                var dirLocal = t.InverseTransformDirection(worldRay.direction);
                // local distances are scaled relative to world distances
                float scale = dirLocal.magnitude;
                if (scale < 1e-8f) continue;
                if (c.enter / scale > bestWorld) break;
                var d = dirLocal / scale;
                var v = c.part.current;
                var tr = c.part.tris;
                for (int i = 0; i < tr.Length; i += 3)
                {
                    if (!Intersect(o, d, v[tr[i]], v[tr[i + 1]], v[tr[i + 2]], out float dist)) continue;
                    float wd = dist / scale;
                    if (wd >= bestWorld) continue;
                    var wp = t.TransformPoint(o + d * dist);
                    if (model.Clipped(wp)) continue;
                    bestWorld = wd;
                    best = c.part;
                    hitPoint = wp;
                }
            }
            return best;
        }

        // Möller–Trumbore, double sided
        static bool Intersect(Vector3 o, Vector3 d, Vector3 a, Vector3 b, Vector3 c, out float t)
        {
            t = 0;
            Vector3 e1 = b - a, e2 = c - a;
            Vector3 p = Vector3.Cross(d, e2);
            float det = Vector3.Dot(e1, p);
            if (det > -1e-12f && det < 1e-12f) return false;
            float inv = 1f / det;
            Vector3 s = o - a;
            float u = Vector3.Dot(s, p) * inv;
            if (u < 0 || u > 1) return false;
            Vector3 q = Vector3.Cross(s, e1);
            float w = Vector3.Dot(d, q) * inv;
            if (w < 0 || u + w > 1) return false;
            t = Vector3.Dot(e2, q) * inv;
            return t > 1e-6f;
        }
    }
}
