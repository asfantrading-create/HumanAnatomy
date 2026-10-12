using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Asfan.Anatomy
{
    /// <summary>Right panel content: structure card, learning centre (lessons, teacher mode, exam, progress, favourites), quiz and lesson player.</summary>
    public partial class DesktopUI
    {
        string learnTab = "lessons", levelFilter = "all";
        class LessonDraft { public string title = "", author = "", text = ""; public List<Dictionary<string, object>> steps = new List<Dictionary<string, object>>(); }
        LessonDraft editor;
        string newViewName = "";

        void Clear(RectTransform rt) { for (int i = rt.childCount - 1; i >= 0; i--) Destroy(rt.GetChild(i).gameObject); }

        void RebuildRight()
        {
            if (!rightContent) return;
            examTimer = null;
            Clear(rightContent);
            var c = rightContent;
            if (Le.tour != null) { UIKit.SetText(rightTitle, L.T("toursTitle")); TourView(c); }
            else if (Le.quiz != null) { UIKit.SetText(rightTitle, L.T("quizTitle")); QuizView(c); }
            else if (learnOpen) { UIKit.SetText(rightTitle, L.T("learn")); LearnView(c); }
            else { UIKit.SetText(rightTitle, L.T("info")); InfoView(c); }
            rightClose.gameObject.SetActive(Le.tour != null || Le.quiz != null || learnOpen || M.selected != null);
        }

        Text Muted(Transform c, string s, int size = 13) => UIKit.Para(c, s, size, UIKit.Muted);
        Button Btn(Transform c, string s, UnityEngine.Events.UnityAction a, Color? col = null, int size = 13) => UIKit.Button(c, s, a, col, size);

        // ================================================================== structure card + browser
        void InfoView(RectTransform c)
        {
            var p = M.selected;
            if (p == null) Muted(c, L.T("noSel"), 14);
            else
            {
                var n = UIKit.Para(c, p.Name, 21, null); n.fontStyle = FontStyle.Bold;
                Muted(c, p.OtherName, 14);
                if (M.systems.TryGetValue(p.def.system, out var s))
                    UIKit.Para(c, L.T("system") + ": " + (L.Ar ? s.def.ar : s.def.en) + "   •   " + L.T("region") + ": " + L.Group(p.def.group), 13, UIKit.Accent);
                UIKit.Para(c, string.IsNullOrEmpty(p.Desc) ? "" : p.Desc, 14, null);
                var r = UIKit.Row(c, 32);
                Btn(r, L.T("speak"), () => app.voice.SpeakText(p.Name, p.Desc));
                Btn(r, L.T("hide"), () => { M.Hide(p); app.RefreshAll(); });
                Btn(r, L.T("isolate"), () => { M.Isolate(M.isolated == null ? p : null); app.RefreshAll(); });
                Btn(r, L.T("focus"), () => app.FocusParts(new List<Part> { p }));
                bool fav = Progress.IsFav(p.def.id);
                var fb = Btn(c, fav ? L.T("unfav") : "☆ " + L.T("fav"), () => { Progress.ToggleFav(p.def.id); Refresh(); });
                UIKit.SetOn(fb, fav);
                UIKit.Heading(c, L.T("myNote"));
                var id = p.def.id;
                UIKit.Input(c, Progress.Note(id), L.T("notePh"), v => Progress.SetNote(id, v), true, 70);
            }
            UIKit.Heading(c, L.T("browse"));
            var byGroup = new Dictionary<string, List<Part>>();
            foreach (var q in M.parts)
            {
                if (!M.SexOk(q) || q.def.system == "skin") continue;
                if (!byGroup.TryGetValue(q.def.group, out var list)) byGroup[q.def.group] = list = new List<Part>();
                list.Add(q);
            }
            foreach (var g in L.GroupOrder)
            {
                if (!byGroup.TryGetValue(g, out var list)) continue;
                string key = g;
                var b = Btn(c, (expandedGroup == g ? "− " : "+ ") + L.Group(g) + "  (" + list.Count + ")",
                    () => { expandedGroup = expandedGroup == key ? null : key; RebuildRight(); }, expandedGroup == g ? UIKit.BtnOn : (Color?)null);
                b.GetComponentInChildren<Text>().alignment = L.Ar ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft;
                if (expandedGroup != g) continue;
                list.Sort((x, y) => string.CompareOrdinal(x.Name, y.Name));
                foreach (var q in list)
                {
                    var part = q;
                    var pb = Btn(c, (Progress.Viewed.ContainsKey(q.def.id) ? "✓ " : "") + q.Name, () => app.SelectPart(part, true), M.selected == q ? UIKit.Accent : UIKit.Card, 12);
                    var le = pb.GetComponent<LayoutElement>(); le.minHeight = 26; le.preferredHeight = 26;
                    var t = pb.GetComponentInChildren<Text>();
                    t.alignment = L.Ar ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft;
                    if (!M.IsVisible(q)) t.color = UIKit.Muted;
                }
            }
        }

        // ================================================================== lesson player
        void TourView(RectTransform c)
        {
            var t = Le.tour;
            var title = UIKit.Para(c, t.Title, 18, null); title.fontStyle = FontStyle.Bold;
            Muted(c, L.T("step", "i", Le.step + 1, "n", t.steps.Count));
            UIKit.Bar(c, (Le.step + 1f) / t.steps.Count, UIKit.Accent, 6);
            UIKit.Para(c, Le.Step.Text, 16, null);
            var r = UIKit.Row(c, 36);
            Btn(r, L.T("prev"), Le.PrevStep);
            Btn(r, Le.step == t.steps.Count - 1 ? L.T("finish") : L.T("next"), Le.NextStep, UIKit.BtnOn);
            var r2 = UIKit.Row(c, 32);
            Btn(r2, L.T("speak"), () => app.voice.SpeakText(Le.Step.Text));
            var av = Btn(r2, L.T("tourVoice"), () => { Le.autoVoice = !Le.autoVoice; PlayerPrefs.SetInt("tourVoice", Le.autoVoice ? 1 : 0); Refresh(); }, null, 12);
            UIKit.SetOn(av, Le.autoVoice);
            Btn(c, L.T("present"), () => SetPresenting(true));
        }

        // ================================================================== quick quiz
        void QuizView(RectTransform c)
        {
            var q = Le.quiz;
            var modes = UIKit.Row(c, 32);
            UIKit.SetOn(Btn(modes, L.T("modeName"), () => Le.SetQuizMode(false)), !q.findMode);
            UIKit.SetOn(Btn(modes, L.T("modeFind"), () => Le.SetQuizMode(true)), q.findMode);
            UIKit.Para(c, L.T("score", "s", q.score, "t", q.total), 14, UIKit.Accent);
            if (q.empty || q.target == null) { UIKit.Para(c, L.T("needMore"), 15, null); return; }
            if (q.findMode)
            {
                var pr = UIKit.Para(c, L.T("quizFind", "name", q.target.Name), 17, null); pr.fontStyle = FontStyle.Bold;
            }
            else
            {
                UIKit.Para(c, L.T("quizName"), 16, null);
                foreach (var n in q.options)
                {
                    var name = n;
                    Color? col = null;
                    if (q.answered && n == q.correct) col = new Color(0.12f, 0.6f, 0.32f);
                    else if (q.answered && n == q.picked) col = new Color(0.72f, 0.2f, 0.2f);
                    var b = Btn(c, n, () => Le.AnswerName(name), col, 14);
                    b.GetComponent<LayoutElement>().preferredHeight = 38;
                }
            }
            if (q.feedback.Length > 0) UIKit.Para(c, q.feedback, 15, null);
            var r = UIKit.Row(c, 36);
            Btn(r, L.T("next"), Le.NextQuestion, UIKit.BtnOn);
            Btn(r, L.T("close"), Le.EndQuiz);
        }

        // ================================================================== learning centre
        void LearnView(RectTransform c)
        {
            if (Le.exam != null) { ExamView(c); return; }
            if (editor != null) { EditorView(c); return; }
            var tabs = UIKit.Row(c, 34, 4);
            foreach (var (k, label) in new[] { ("lessons", "tabLessons"), ("exam", "tabExam"), ("progress", "tabProgress"), ("favs", "tabFavs") })
            {
                var key = k;
                UIKit.SetOn(Btn(tabs, L.T(label), () => { learnTab = key; RebuildRight(); }, null, 12), learnTab == k);
            }
            switch (learnTab)
            {
                case "exam": ExamSetup(c); break;
                case "progress": ProgressView(c); break;
                case "favs": FavsView(c); break;
                default: LessonsView(c); break;
            }
        }

        void LessonsView(RectTransform c)
        {
            var seg = UIKit.Row(c, 30);
            foreach (var l in new[] { "all", "school", "uni" })
            {
                var lv = l;
                UIKit.SetOn(Btn(seg, L.T("lvl_" + l), () => { levelFilter = lv; RebuildRight(); }, null, 12), levelFilter == l);
            }
            foreach (var t in LearningData.Tours.Where(x => levelFilter == "all" || x.level == levelFilter))
            {
                var tour = t;
                var done = Progress.Lessons.ContainsKey(t.id) ? "✓ " : "";
                var b = Btn(c, done + t.Title + "   ·   " + L.T("lvl_" + t.level) + " · " + t.steps.Count + " " + L.T("steps"), () => { learnOpen = false; Le.StartTour(tour); }, UIKit.Card, 13);
                b.GetComponent<LayoutElement>().preferredHeight = 40;
                b.GetComponentInChildren<Text>().alignment = L.Ar ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft;
            }
            UIKit.Heading(c, L.T("teacherTitle"));
            Muted(c, L.T("teacherHint"));
            var r = UIKit.Row(c, 34);
            Btn(r, L.T("lessonNew"), () => { editor = new LessonDraft { author = Progress.Student }; RebuildRight(); }, null, 12);
            Btn(r, L.T("lessonOpen"), ShowOpenLesson, null, 12);
            Btn(c, L.T("present"), () => SetPresenting(true));
        }

        // ------------------------------------------------------------------ teacher lesson editor
        void EditorView(RectTransform c)
        {
            var e = editor;
            UIKit.Heading(c, L.T("lessonNew"));
            Muted(c, L.T("lessonTitle"));
            UIKit.Input(c, e.title, L.T("lessonTitle"), null, false, 34, v => e.title = v);
            Muted(c, L.T("lessonAuthor"));
            UIKit.Input(c, e.author, L.T("lessonAuthor"), null, false, 34, v => e.author = v);
            Muted(c, L.T("lessonStepHint"));
            UIKit.Input(c, e.text, L.T("lessonStepText"), null, true, 90, v => e.text = v);
            Btn(c, L.T("lessonAddStep"), () =>
            {
                if (string.IsNullOrWhiteSpace(e.text)) return;
                e.steps.Add(new Dictionary<string, object> { ["text"] = e.text.Trim(), ["view"] = app.CaptureView() });
                e.text = "";
                RebuildRight();
            }, UIKit.BtnOn);
            for (int i = 0; i < e.steps.Count; i++)
            {
                int k = i;
                var r = UIKit.Row(c, 30);
                var t = UIKit.Label(r, (i + 1) + ". " + MiniJson.Str(e.steps[i], "text"), 13, null);
                t.gameObject.AddComponent<LayoutElement>().flexibleWidth = 5;
                Btn(r, "✕", () => { e.steps.RemoveAt(k); RebuildRight(); }, null, 12).GetComponent<LayoutElement>().flexibleWidth = 0.6f;
            }
            var r2 = UIKit.Row(c, 34);
            var play = Btn(r2, L.T("lessonPlay"), () =>
            {
                var tour = LearningData.ParseLessonFile(LessonJson(e), "draft");
                learnOpen = false;
                Le.StartTour(tour);
            });
            play.interactable = e.steps.Count > 0;
            var save = Btn(r2, L.T("lessonSave"), () => SaveLesson(e));
            save.interactable = e.steps.Count > 0;
            Btn(r2, L.T("close"), () => { editor = null; RebuildRight(); });
        }

        static string LessonJson(LessonDraft e) => MiniJson.Serialize(new Dictionary<string, object>
        {
            ["app"] = "HA3D", ["type"] = "lesson", ["version"] = 1, ["title"] = string.IsNullOrWhiteSpace(e.title) ? "lesson" : e.title,
            ["author"] = e.author ?? "", ["created"] = DateTime.UtcNow.ToString("o"), ["steps"] = e.steps.Cast<object>().ToList()
        }, true);

        void SaveLesson(LessonDraft e)
        {
            var name = string.Join("_", (string.IsNullOrWhiteSpace(e.title) ? "lesson" : e.title).Split(Path.GetInvalidFileNameChars())) + ".ha3d.json";
            var dir = FileDialogs.Folder("Lessons");
            var path = FileDialogs.Save(L.T("lessonSave"), "Lesson (*.ha3d.json)|*.ha3d.json", dir, name, "json") ?? Path.Combine(dir, name);
            try
            {
                File.WriteAllText(path, LessonJson(e));
                ShowToast(L.T("lessonSaved", "path", path), 6);
            }
            catch (Exception ex) { ShowToast(ex.Message); }
        }

        public void OpenLessonFile(string path)
        {
            try
            {
                var tour = LearningData.ParseLessonFile(File.ReadAllText(path), Path.GetFileNameWithoutExtension(path));
                CloseModal();
                learnOpen = false;
                Le.StartTour(tour);
            }
            catch { ShowToast(L.T("lessonBadFile")); }
        }

        // ------------------------------------------------------------------ exam
        void ExamSetup(RectTransform c)
        {
            UIKit.Heading(c, L.T("examTitle"));
            Muted(c, L.T("studentName"));
            var name = Progress.Student;
            UIKit.Input(c, name, L.T("studentNamePh"), null, false, 34, v => name = v);
            Muted(c, L.T("level"));
            var lv = UIKit.Row(c, 30);
            foreach (var l in new[] { "school", "uni" })
            {
                var x = l;
                UIKit.SetOn(Btn(lv, L.T("lvl_" + l), () => { Le.examLevel = x; Progress.Student = name; RebuildRight(); }, null, 12), Le.examLevel == l);
            }
            Muted(c, L.T("examSystems"));
            var grid = UIKit.Rect(c, "Systems");
            var gl = grid.gameObject.AddComponent<GridLayoutGroup>();
            gl.cellSize = new Vector2(176, 30); gl.spacing = new Vector2(4, 4);
            gl.constraint = GridLayoutGroup.Constraint.FixedColumnCount; gl.constraintCount = 2;
            gl.startCorner = L.Ar ? GridLayoutGroup.Corner.UpperRight : GridLayoutGroup.Corner.UpperLeft;
            grid.gameObject.AddComponent<LayoutElement>().preferredHeight = 34 * ((Lessons.ExamSystems.Length + 1) / 2);
            foreach (var s in Lessons.ExamSystems)
            {
                var id = s;
                var b = Btn(grid, AnatomyApp.SystemName(s), () =>
                {
                    if (!Le.examSystems.Remove(id)) Le.examSystems.Add(id);
                    Progress.Student = name;
                    RebuildRight();
                }, null, 12);
                UIKit.SetOn(b, Le.examSystems.Contains(s));
            }
            Muted(c, L.T("examCount"));
            var cr = UIKit.Row(c, 30);
            foreach (var n in new[] { 10, 20, 30, 50 })
            {
                var x = n;
                UIKit.SetOn(Btn(cr, n.ToString(), () => { Le.examCount = x; Progress.Student = name; RebuildRight(); }, null, 12), Le.examCount == n);
            }
            Muted(c, L.T("examTime"));
            var tr = UIKit.Row(c, 30);
            foreach (var m in new[] { 0, 10, 20, 30, 45 })
            {
                var x = m;
                UIKit.SetOn(Btn(tr, m == 0 ? L.T("noLimit") : m + " " + L.T("minutes"), () => { Le.examMinutes = x; Progress.Student = name; RebuildRight(); }, null, 11), Le.examMinutes == m);
            }
            var start = Btn(c, L.T("examStart"), () =>
            {
                if (Le.examSystems.Count == 0) { ShowToast(L.T("needSystems")); return; }
                if (!Le.StartExam(name.Trim())) ShowToast(L.T("needMore"));
            }, new Color(0.12f, 0.6f, 0.36f), 15);
            start.GetComponent<LayoutElement>().preferredHeight = 42;
            Muted(c, L.T("examHint"));
        }

        void ExamView(RectTransform c)
        {
            var ex = Le.exam;
            if (ex.finished) { ExamResult(c); return; }
            var q = ex.qs[ex.i];
            var head = UIKit.Row(c, 26);
            UIKit.Label(head, L.T("question") + " " + (ex.i + 1) + " / " + ex.qs.Count, 14, null, FontStyle.Bold);
            UIKit.Label(head, AnatomyApp.SystemName(q.sys), 13, UIKit.Accent);
            if (ex.deadline > 0) { examTimer = UIKit.Label(c, L.T("timeLeft", "t", Le.TimeLeft), 13, UIKit.Muted); examTimer.gameObject.AddComponent<LayoutElement>().minHeight = 22; }
            UIKit.Bar(c, (float)ex.i / ex.qs.Count, UIKit.Accent, 6);
            if (q.kind == "describe") Muted(c, L.T("whichStructure"));
            UIKit.Para(c, q.prompt, 16, null);
            int ans = ex.answers[ex.i];
            for (int k = 0; k < q.options.Count; k++)
            {
                int kk = k;
                var o = q.options[k];
                Color? col = null;
                if (ans >= 0 && o.ok) col = new Color(0.12f, 0.6f, 0.32f);
                else if (ans == k) col = new Color(0.72f, 0.2f, 0.2f);
                var b = Btn(c, o.text, () => Le.ExamAnswer(kk), col, 14);
                b.GetComponent<LayoutElement>().preferredHeight = 40;
            }
            if (ans >= 0) UIKit.Para(c, (q.options[ans].ok ? "✓ " : "✗ ") + q.explain, 14, null);
            var r = UIKit.Row(c, 36);
            Btn(r, L.T("examQuit"), () => { Le.EndExam(); Refresh(); });
            if (q.kind != "concept") Btn(r, L.T("speak"), () => app.voice.SpeakText(q.kind == "identify" ? q.part.Name : q.prompt));
            var next = Btn(r, ex.i == ex.qs.Count - 1 ? L.T("finish") : L.T("next"), Le.ExamNext, UIKit.BtnOn);
            next.interactable = ans >= 0;
        }

        void ExamResult(RectTransform c)
        {
            var ex = Le.exam;
            bool passed = ex.pct >= 70;
            var card = UIKit.Panel(c, "Score", passed ? new Color(0.1f, 0.55f, 0.32f) : new Color(0.62f, 0.2f, 0.2f));
            card.gameObject.AddComponent<LayoutElement>().preferredHeight = 90;
            var big = UIKit.Label(card.transform, ex.pct + "%", 36, Color.white, FontStyle.Bold, TextAnchor.MiddleCenter);
            ((RectTransform)big.transform).Anchor(new Vector2(0, 0.35f), Vector2.one, Vector2.zero, Vector2.zero);
            var sub = UIKit.Label(card.transform, ex.correct + " / " + ex.qs.Count + "  ·  " + (passed ? L.T("examPassed") : L.T("examFailed")), 15, Color.white, FontStyle.Normal, TextAnchor.MiddleCenter);
            ((RectTransform)sub.transform).Anchor(Vector2.zero, new Vector2(1, 0.4f), Vector2.zero, Vector2.zero);
            foreach (var kv in ex.bySystem)
            {
                var r = UIKit.Row(c, 22);
                var l = UIKit.Label(r, AnatomyApp.SystemName(kv.Key) + "  " + kv.Value[0] + "/" + kv.Value[1], 13, null);
                l.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1.2f;
                UIKit.Bar(r, (float)kv.Value[0] / Mathf.Max(1, kv.Value[1]), UIKit.Accent, 10);
            }
            var wrong = new List<Lessons.Question>();
            for (int i = 0; i < ex.qs.Count; i++) if (ex.answers[i] < 0 || !ex.qs[i].options[ex.answers[i]].ok) wrong.Add(ex.qs[i]);
            if (wrong.Count > 0)
            {
                UIKit.Heading(c, L.T("reviewWrong") + " (" + wrong.Count + ")");
                foreach (var q in wrong)
                {
                    var prompt = q.kind == "concept" ? q.prompt : q.kind == "describe" ? (q.prompt.Length > 90 ? q.prompt.Substring(0, 90) + "…" : q.prompt) : L.T("quizName");
                    Muted(c, prompt, 12);
                    var a = UIKit.Para(c, q.options.First(o => o.ok).text, 13, null); a.fontStyle = FontStyle.Bold;
                }
            }
            var row = UIKit.Row(c, 38);
            if (passed) Btn(row, L.T("certificate"), () => app.MakeCertificate(ex), new Color(0.12f, 0.6f, 0.36f));
            Btn(row, L.T("examAgain"), () => { var n = ex.name; Le.exam = null; if (!Le.StartExam(n)) ShowToast(L.T("needMore")); });
            Btn(row, L.T("close"), () => { Le.EndExam(); Refresh(); });
        }

        // ------------------------------------------------------------------ progress
        void ProgressView(RectTransform c)
        {
            var parts = M.parts;
            var viewed = Progress.Viewed;
            int seen = parts.Count(p => viewed.ContainsKey(p.def.id));
            var stats = UIKit.Row(c, 64);
            void Stat(string big, string label)
            {
                var card = UIKit.Panel(stats, "Stat", UIKit.Card);
                var b = UIKit.Label(card.transform, big, 22, UIKit.Accent, FontStyle.Bold, TextAnchor.MiddleCenter);
                ((RectTransform)b.transform).Anchor(new Vector2(0, 0.4f), Vector2.one, Vector2.zero, Vector2.zero);
                var l = UIKit.Label(card.transform, label, 11, UIKit.Muted, FontStyle.Normal, TextAnchor.MiddleCenter);
                ((RectTransform)l.transform).Anchor(Vector2.zero, new Vector2(1, 0.45f), new Vector2(2, 0), new Vector2(-2, 0));
            }
            Stat(Mathf.RoundToInt(100f * seen / Mathf.Max(1, parts.Count)) + "%", L.T("explored"));
            Stat(Progress.Lessons.Count.ToString(), L.T("lessonsDone"));
            Stat(Progress.Exams.Count.ToString(), L.T("examsTaken"));
            var acc = Progress.Accuracy();
            var head = UIKit.Row(c, 20);
            UIKit.Label(head, "", 12, UIKit.Muted);
            UIKit.Label(head, L.T("explored"), 12, UIKit.Muted);
            UIKit.Label(head, L.T("accuracy"), 12, UIKit.Muted);
            foreach (var s in Lessons.ExamSystems)
            {
                var list = parts.Where(p => p.def.system == s).ToList();
                if (list.Count == 0) continue;
                int v = list.Count(p => viewed.ContainsKey(p.def.id));
                var r = UIKit.Row(c, 22);
                UIKit.Label(r, AnatomyApp.SystemName(s), 12, null);
                UIKit.Bar(r, (float)v / list.Count, UIKit.Accent, 10);
                if (acc.TryGetValue(s, out var a) && a[1] > 0) UIKit.Bar(r, (float)a[0] / a[1], new Color(0.12f, 0.65f, 0.4f), 10);
                else UIKit.Label(r, "—", 12, UIKit.Muted, FontStyle.Normal, TextAnchor.MiddleCenter);
            }
            var weak = acc.Where(kv => kv.Value[1] >= 3 && (float)kv.Value[0] / kv.Value[1] < 0.6f).Select(kv => AnatomyApp.SystemName(kv.Key)).ToList();
            if (weak.Count > 0) UIKit.Para(c, L.T("weakAreas") + ": " + string.Join(L.Ar ? "، " : ", ", weak), 13, new Color(0.95f, 0.65f, 0.2f));
            UIKit.Heading(c, L.T("recentExams"));
            if (Progress.Exams.Count == 0) Muted(c, L.T("noExams"));
            foreach (var e in Progress.Exams.Take(8))
            {
                var r = UIKit.Row(c, 22);
                DateTime.TryParse(MiniJson.Str(e, "date"), out var d);
                UIKit.Label(r, d.ToLocalTime().ToString("yyyy/MM/dd"), 12, UIKit.Muted);
                UIKit.Label(r, MiniJson.Str(e, "kind") == "exam" ? L.T("examTitle") : L.T("quiz"), 12, null);
                double total = MiniJson.Num(e, "total", 1), correct = MiniJson.Num(e, "correct");
                UIKit.Label(r, Mathf.RoundToInt((float)(100 * correct / Math.Max(1, total))) + "%  (" + correct + "/" + total + ")", 12, UIKit.Accent, FontStyle.Bold);
            }
            Btn(c, L.T("resetProgress"), () => Confirm(L.T("resetConfirm"), () => { Progress.Reset(); Refresh(); }));
        }

        // ------------------------------------------------------------------ favourites, notes, saved views
        void FavsView(RectTransform c)
        {
            UIKit.Heading(c, L.T("savedViews"));
            var r = UIKit.Row(c, 34);
            var input = UIKit.Input(r, newViewName, L.T("viewNamePh"), null, false, 34, v => newViewName = v);
            input.GetComponent<LayoutElement>().flexibleWidth = 2;
            Btn(r, L.T("saveView"), () =>
            {
                var v = app.CaptureView();
                v["name"] = string.IsNullOrWhiteSpace(newViewName) ? L.T("view") + " " + (Progress.Views.Count + 1) : newViewName.Trim();
                newViewName = "";
                Progress.AddView(v);
                RebuildRight();
            }, UIKit.BtnOn, 12);
            if (Progress.Views.Count == 0) Muted(c, L.T("none"));
            for (int i = 0; i < Progress.Views.Count; i++)
            {
                int k = i;
                var v = Progress.Views[i] as Dictionary<string, object>;
                var row = UIKit.Row(c, 30);
                var b = Btn(row, MiniJson.Str(v, "name"), () => app.RestoreView(v, true), UIKit.Card, 13);
                b.GetComponent<LayoutElement>().flexibleWidth = 5;
                Btn(row, "✕", () => { Progress.RemoveView(k); RebuildRight(); }, null, 12).GetComponent<LayoutElement>().flexibleWidth = 0.6f;
            }
            UIKit.Heading(c, L.T("favorites"));
            var favs = Progress.Favs.Select(id => M.ById(Convert.ToString(id))).Where(p => p != null).ToList();
            if (favs.Count == 0) Muted(c, L.T("favHint"));
            foreach (var p in favs) { var part = p; Btn(c, p.Name, () => app.SelectPart(part, true), UIKit.Card); }
            UIKit.Heading(c, L.T("myNotes"));
            var notes = Progress.Notes.Keys.Select(M.ById).Where(p => p != null).ToList();
            if (notes.Count == 0) Muted(c, L.T("notesHint"));
            foreach (var p in notes)
            {
                var part = p;
                Btn(c, p.Name, () => app.SelectPart(part, true), UIKit.Card);
                Muted(c, Progress.Note(p.def.id), 12);
            }
        }
    }
}
