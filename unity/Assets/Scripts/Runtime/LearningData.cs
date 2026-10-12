using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Asfan.Anatomy
{
    public class TourStep
    {
        public string ar, en, group;
        public Regex match;
        public Dictionary<string, object> view;   // teacher lessons: recorded view
        public string Text => L.Ar ? ar : en;
    }

    public class Tour
    {
        public string id, level, sex, ar, en;
        public List<string> systems = new List<string>();
        public List<TourStep> steps = new List<TourStep>();
        public bool custom;
        public string Title => L.Ar ? ar : en;
    }

    public class ConceptQuestion
    {
        public string sys, level;
        public string[] q = new string[2], explain = new string[2];
        public List<string[]> options = new List<string[]>();   // first option is the correct one
    }

    /// <summary>Interface strings, guided lessons and the question bank shared with the desktop edition (StreamingAssets/learning.dat).</summary>
    public static class LearningData
    {
        public static readonly List<Tour> Tours = new List<Tour>();
        public static readonly List<ConceptQuestion> Questions = new List<ConceptQuestion>();
        public static readonly Dictionary<string, string>[] Strings = { new Dictionary<string, string>(), new Dictionary<string, string>() };
        public static readonly List<string[]>[] Help = { new List<string[]>(), new List<string[]>() };
        public static bool Loaded;

        public static void Load()
        {
            if (Loaded) return;
            var path = Path.Combine(Application.streamingAssetsPath, "learning.dat");
            if (!File.Exists(path)) return;
            var root = MiniJson.Parse(AssetCrypto.ReadText(path));
            var strings = MiniJson.Obj(root, "strings");
            string[] langs = { "ar", "en" };
            for (int li = 0; li < 2; li++)
            {
                var d = MiniJson.Obj(strings, langs[li]);
                if (d == null) continue;
                foreach (var kv in d)
                {
                    if (kv.Value is string s) Strings[li][kv.Key] = s;
                    else if (kv.Key == "help" && kv.Value is List<object> rows)
                        foreach (var r in rows) if (r is List<object> pair && pair.Count == 2) Help[li].Add(new[] { Convert.ToString(pair[0]), Convert.ToString(pair[1]) });
                }
            }
            foreach (var t in MiniJson.Arr(root, "tours") ?? new List<object>())
            {
                var tour = new Tour
                {
                    id = MiniJson.Str(t, "id"), level = MiniJson.Str(t, "level", "school"), sex = MiniJson.Str(t, "sex"),
                    ar = MiniJson.Str(t, "ar"), en = MiniJson.Str(t, "en")
                };
                foreach (var s in MiniJson.Arr(t, "systems") ?? new List<object>()) tour.systems.Add(Convert.ToString(s));
                foreach (var s in MiniJson.Arr(t, "steps") ?? new List<object>())
                {
                    var src = MiniJson.Str(s, "match");
                    var flags = MiniJson.Str(s, "flags");
                    tour.steps.Add(new TourStep
                    {
                        ar = MiniJson.Str(s, "ar"), en = MiniJson.Str(s, "en"), group = MiniJson.Str(s, "group"),
                        match = src.Length > 0 ? new Regex(src, (flags.Contains("i") ? RegexOptions.IgnoreCase : RegexOptions.None) | RegexOptions.CultureInvariant) : null
                    });
                }
                Tours.Add(tour);
            }
            foreach (var q in MiniJson.Arr(root, "questions") ?? new List<object>())
            {
                var cq = new ConceptQuestion { sys = MiniJson.Str(q, "sys"), level = MiniJson.Str(q, "level", "school") };
                var qq = MiniJson.Obj(q, "q"); cq.q[0] = MiniJson.Str(qq, "ar"); cq.q[1] = MiniJson.Str(qq, "en");
                var ex = MiniJson.Obj(q, "explain"); cq.explain[0] = MiniJson.Str(ex, "ar"); cq.explain[1] = MiniJson.Str(ex, "en");
                foreach (var o in MiniJson.Arr(q, "options") ?? new List<object>()) cq.options.Add(new[] { MiniJson.Str(o, "ar"), MiniJson.Str(o, "en") });
                Questions.Add(cq);
            }
            Loaded = true;
        }

        /// <summary>Reads a teacher lesson file (.ha3d.json) made by either edition.</summary>
        public static Tour ParseLessonFile(string json, string fileName)
        {
            var d = MiniJson.Parse(json) as Dictionary<string, object>;
            if (d == null || MiniJson.Str(d, "app") != "HA3D") throw new FormatException("format");
            var steps = MiniJson.Arr(d, "steps");
            if (steps == null) throw new FormatException("format");
            var title = MiniJson.Str(d, "title", fileName);
            var tour = new Tour { id = "file-" + title, ar = title, en = title, level = MiniJson.Str(d, "level", "school"), custom = true };
            foreach (var s in steps)
            {
                var text = MiniJson.Str(s, "text");
                tour.steps.Add(new TourStep { ar = text, en = text, view = MiniJson.Obj(s, "view") });
            }
            return tour;
        }
    }

    /// <summary>Per-user learning data: viewed structures, results, finished lessons, notes, favourites, saved views.</summary>
    public static class Progress
    {
        static Dictionary<string, object> d;
        static string File_ => Path.Combine(Application.persistentDataPath, "progress.json");

        public static Dictionary<string, object> Data
        {
            get
            {
                if (d == null)
                {
                    try { d = MiniJson.Parse(File.ReadAllText(File_)) as Dictionary<string, object>; } catch { }
                    if (d == null) d = new Dictionary<string, object>();
                    Ensure();
                }
                return d;
            }
        }

        static void Ensure()
        {
            foreach (var k in new[] { "viewed", "lessons", "notes" }) if (!(d.TryGetValue(k, out var v) && v is Dictionary<string, object>)) d[k] = new Dictionary<string, object>();
            foreach (var k in new[] { "exams", "favs", "views" }) if (!(d.TryGetValue(k, out var v) && v is List<object>)) d[k] = new List<object>();
            if (!(d.TryGetValue("student", out var s) && s is string)) d["student"] = "";
        }

        public static void Save()
        {
            try { Directory.CreateDirectory(Path.GetDirectoryName(File_)); File.WriteAllText(File_, MiniJson.Serialize(Data)); } catch { }
        }

        static double Now => (DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds;
        public static Dictionary<string, object> Viewed => (Dictionary<string, object>)Data["viewed"];
        public static Dictionary<string, object> Lessons => (Dictionary<string, object>)Data["lessons"];
        public static Dictionary<string, object> Notes => (Dictionary<string, object>)Data["notes"];
        public static List<object> Exams => (List<object>)Data["exams"];
        public static List<object> Favs => (List<object>)Data["favs"];
        public static List<object> Views => (List<object>)Data["views"];
        public static string Student { get => (string)Data["student"]; set { Data["student"] = value ?? ""; Save(); } }

        public static void MarkViewed(string id) { if (!Viewed.ContainsKey(id)) { Viewed[id] = Now; Save(); } }
        public static void LessonDone(string id) { Lessons[id] = Now; Save(); }
        public static string Note(string id) => Notes.TryGetValue(id, out var v) ? v as string ?? "" : "";
        public static void SetNote(string id, string text)
        {
            if (string.IsNullOrWhiteSpace(text)) Notes.Remove(id); else Notes[id] = text;
            Save();
        }
        public static bool IsFav(string id) => Favs.Contains(id);
        public static bool ToggleFav(string id)
        {
            bool had = Favs.Remove(id);
            if (!had) Favs.Add(id);
            Save();
            return !had;
        }
        public static void AddView(Dictionary<string, object> v) { Views.Insert(0, v); Save(); }
        public static void RemoveView(int i) { if (i >= 0 && i < Views.Count) { Views.RemoveAt(i); Save(); } }

        /// <summary>kind: exam | quiz; bySystem: sys -> [correct, total].</summary>
        public static void AddExam(string kind, string level, string name, int total, int correct, Dictionary<string, int[]> bySystem)
        {
            var bs = new Dictionary<string, object>();
            foreach (var kv in bySystem) bs[kv.Key] = new List<object> { (double)kv.Value[0], (double)kv.Value[1] };
            Exams.Insert(0, new Dictionary<string, object>
            {
                ["date"] = DateTime.UtcNow.ToString("o"), ["kind"] = kind, ["level"] = level ?? "", ["name"] = name ?? "",
                ["total"] = (double)total, ["correct"] = (double)correct, ["bySystem"] = bs
            });
            while (Exams.Count > 200) Exams.RemoveAt(Exams.Count - 1);
            Save();
        }

        /// <summary>Running per-system accuracy from all quizzes and exams.</summary>
        public static Dictionary<string, int[]> Accuracy()
        {
            var acc = new Dictionary<string, int[]>();
            foreach (var e in Exams)
            {
                var bs = MiniJson.Obj(e, "bySystem");
                if (bs == null) continue;
                foreach (var kv in bs)
                {
                    if (!(kv.Value is List<object> l) || l.Count < 2) continue;
                    if (!acc.TryGetValue(kv.Key, out var a)) acc[kv.Key] = a = new int[2];
                    a[0] += (int)Convert.ToDouble(l[0]); a[1] += (int)Convert.ToDouble(l[1]);
                }
            }
            return acc;
        }

        public static void Reset()
        {
            var student = Student;
            d = new Dictionary<string, object> { ["student"] = student };
            Ensure();
            Save();
        }
    }
}
