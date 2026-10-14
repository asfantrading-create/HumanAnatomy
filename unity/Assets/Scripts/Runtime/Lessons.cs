using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Asfan.Anatomy
{
    /// <summary>Guided lessons, the quick quiz and the comprehensive exam (logic shared by the desktop interface and VR).</summary>
    public class Lessons : MonoBehaviour
    {
        public AnatomyApp app;
        AnatomyModel M => app.model;
        static readonly System.Random rnd = new System.Random();
        static readonly Regex BadQuiz = new Regex("branch|tributary|set of|part of|segment|division|region|zone", RegexOptions.IgnoreCase);
        static readonly Regex BadExam = new Regex("branch|tributary|set of|part of|segment|division|region|zone|digital|phalan|lumbrical|interosse|perforating|wall of|cavity of|cusp|leaflet", RegexOptions.IgnoreCase);
        static readonly Regex SideAr = new Regex(@"\s+(الأيسر|الأيمن|اليسرى|اليمنى)$");
        static readonly Regex SideEn1 = new Regex(@"^(left|right) ", RegexOptions.IgnoreCase), SideEn2 = new Regex(@" \((left|right)\)$", RegexOptions.IgnoreCase);
        public static readonly string[] ExamSystems = { "skeletal", "muscular", "nervous", "circulatory", "respiratory", "digestive", "urinary", "endocrine", "lymphatic", "reproductive", "sensory", "skin" };

        public static List<T> Shuffle<T>(List<T> a)
        {
            for (int i = a.Count - 1; i > 0; i--) { int j = rnd.Next(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
            return a;
        }
        public static string BaseName(Part p) => SideEn2.Replace(SideEn1.Replace(SideAr.Replace(p.Name, ""), ""), "");
        static float Radius(Part p) => p.bounds.extents.magnitude;

        // ================================================================== guided lessons
        public Tour tour;
        public int step;
        public bool autoVoice = true;
        public bool Running => tour != null;
        public TourStep Step => tour?.steps[step];

        public void StartTour(Tour t)
        {
            EndQuiz();
            EndExam();
            app.SelectPart(null);
            if (t.sex == "f" && !M.female) M.SetSex(true);
            else if (t.sex == "m" && M.female) M.SetSex(false);
            foreach (var p in M.parts) p.hidden = false;
            M.isolated = null;
            if (t.systems.Count > 0) M.ShowOnlySystems(t.systems);
            tour = t;
            GotoStep(0);
        }

        public void GotoStep(int i)
        {
            if (tour == null) return;
            step = Mathf.Clamp(i, 0, tour.steps.Count - 1);
            var s = tour.steps[step];
            if (s.view != null)
            {
                // teacher lesson step: restore the recorded view and highlight its selected structure
                app.RestoreView(s.view, false);
                var sel = M.ById(MiniJson.Str(s.view, "selected", ""));
                M.tourHighlight = new HashSet<Part>();
                if (sel != null) M.tourHighlight.Add(sel);
            }
            else
            {
                var matches = M.parts.Where(p => s.group.Length > 0 ? p.def.group == s.group : s.match != null && s.match.IsMatch(p.def.en)).Where(M.SexOk).ToList();
                M.tourHighlight = new HashSet<Part>(matches);
                foreach (var p in matches) { p.hidden = false; if (M.systems.TryGetValue(p.def.system, out var st)) st.visible = true; }
                M.ApplyAll();
                if (matches.Count > 0) app.FocusParts(matches);
            }
            M.ApplyAll();
            if (autoVoice) app.voice.SpeakText(s.Text);
            app.RefreshAll();
        }

        public void NextStep()
        {
            if (tour == null) return;
            if (step >= tour.steps.Count - 1)
            {
                if (!tour.custom) Progress.LessonDone(tour.id);
                EndTour();
            }
            else GotoStep(step + 1);
        }
        public void PrevStep() { if (tour != null) GotoStep(step - 1); }

        public void EndTour()
        {
            if (tour == null) return;
            app.voice.Stop();
            tour = null;
            M.tourHighlight = null;
            M.ApplyAll();
            app.RefreshAll();
        }

        // ================================================================== quick quiz
        public class Quiz
        {
            public bool findMode;
            public Part target;
            public bool answered;
            public List<string> options = new List<string>();
            public string correct, picked, feedback = "";
            public int score, total;
            public bool empty;
            public Dictionary<string, int[]> bySystem = new Dictionary<string, int[]>();
        }
        public Quiz quiz;

        public void StartQuiz()
        {
            EndTour();
            EndExam();
            quiz = new Quiz { findMode = quiz != null && quiz.findMode };
            app.SelectPart(null);
            NextQuestion();
        }

        public void SetQuizMode(bool find)
        {
            if (quiz == null) return;
            quiz.findMode = find;
            NextQuestion();
        }

        public void NextQuestion()
        {
            var q = quiz;
            if (q == null) return;
            var prev = q.target;
            M.quizTarget = null;   // clear first so the ghosting of the previous question does not shrink the pool
            M.ApplyAll();
            var pool = M.parts.Where(p => p.def.system != "skin" && p.go.activeSelf && M.EffectiveOpacity(p) >= 0.45f && Radius(p) > 0.02f && !BadQuiz.IsMatch(p.def.en)).ToList();
            q.empty = pool.Count < 4;
            q.answered = false; q.feedback = ""; q.picked = null;
            if (q.empty) { q.target = null; app.RefreshAll(); return; }
            Part target;
            do target = pool[rnd.Next(pool.Count)]; while (pool.Count > 1 && target == prev);
            q.target = target;
            M.quizTarget = target;
            M.quizName = !q.findMode;
            M.quizRevealed = false;
            M.ApplyAll();
            if (!q.findMode) app.FocusParts(new List<Part> { target }, 0.35f);
            q.correct = BaseName(target);
            var opts = new List<string> { q.correct };
            var same = Shuffle(M.parts.Where(p => p.def.system == target.def.system && p.def.group == target.def.group).Select(BaseName).Where(n => n != q.correct).Distinct().ToList());
            var other = Shuffle(M.parts.Where(p => p.def.system == target.def.system).Select(BaseName).Where(n => n != q.correct).Distinct().ToList());
            foreach (var n in same.Concat(other)) { if (opts.Count >= 4) break; if (!opts.Contains(n)) opts.Add(n); }
            q.options = Shuffle(opts);
            app.RefreshAll();
        }

        void Tally(Quiz q, bool ok)
        {
            var sys = q.target.def.system;
            if (!q.bySystem.TryGetValue(sys, out var s)) q.bySystem[sys] = s = new int[2];
            s[1]++;
            if (ok) s[0]++;
        }

        public void AnswerName(string n)
        {
            var q = quiz;
            if (q == null || q.answered || q.target == null) return;
            q.answered = true; q.total++; q.picked = n;
            bool ok = n == q.correct;
            if (ok) q.score++;
            Tally(q, ok);
            q.feedback = ok ? L.T("correct") : L.T("wrong", "name", q.target.Name);
            app.RefreshAll();
        }

        /// <summary>"Find it" mode: the structure the user clicked.</summary>
        public void AnswerFind(Part p)
        {
            var q = quiz;
            if (q == null || q.answered || q.target == null || p == null) return;
            q.answered = true; q.total++;
            bool ok = p == q.target || BaseName(p) == BaseName(q.target);
            if (ok) q.score++;
            Tally(q, ok);
            M.quizRevealed = true;
            M.ApplyAll();
            if (!ok) app.FocusParts(new List<Part> { q.target }, 0.35f);
            q.feedback = ok ? L.T("correct") : L.T("wrongFind", "got", p.Name);
            app.RefreshAll();
        }

        public void EndQuiz()
        {
            if (quiz == null) return;
            if (quiz.total > 0) Progress.AddExam("quiz", "", Progress.Student, quiz.total, quiz.score, quiz.bySystem);
            quiz = null;
            M.quizTarget = null;
            M.ApplyAll();
            app.RefreshAll();
        }

        // ================================================================== comprehensive exam
        public class Option { public string text; public bool ok; }
        public class Question
        {
            public string kind, sys, prompt, explain;
            public List<Option> options;
            public Part part;
        }
        public class Exam
        {
            public string name, level;
            public List<string> systems;
            public List<Question> qs;
            public int i, correct;
            public int[] answers;           // chosen option, -1 = none
            public float started, deadline; // realtime seconds; deadline 0 = no limit
            public Dictionary<string, int[]> bySystem = new Dictionary<string, int[]>();
            public bool finished;
            public int pct, seconds;
        }
        public Exam exam;
        public string examLevel = "school";
        public List<string> examSystems = new List<string> { "skeletal", "muscular", "nervous", "circulatory", "respiratory", "digestive" };
        public int examCount = 20, examMinutes;

        List<Question> BuildQuestions()
        {
            var parts = M.parts.Where(p => examSystems.Contains(p.def.system) && !BadExam.IsMatch(p.def.en) && Radius(p) > 0.012f && M.SexOk(p)).ToList();
            var names = new Dictionary<Part, string>();
            string bn(Part p) { if (!names.TryGetValue(p, out var n)) names[p] = n = BaseName(p); return n; }
            var outList = new List<Question>();
            int li = L.Ar ? 0 : 1;
            // conceptual questions (school level only takes school questions; university takes both)
            var concept = Shuffle(LearningData.Questions.Where(q => examSystems.Contains(q.sys) && (examLevel == "uni" || q.level == "school")).ToList());
            int nConcept = Math.Min(concept.Count, (int)Math.Round(examCount * 0.4));
            foreach (var q in concept.Take(nConcept))
                outList.Add(new Question
                {
                    kind = "concept", sys = q.sys, prompt = q.q[li], explain = q.explain[li],
                    options = Shuffle(q.options.Select((o, k) => new Option { text = o[li], ok = k == 0 }).ToList())
                });
            List<Option> optionsFor(Part p)
            {
                var correct = bn(p);
                var set = new List<string> { correct };
                foreach (var n in Shuffle(parts.Where(x => x.def.system == p.def.system).Select(bn).Where(n => n != correct).Distinct().ToList()))
                {
                    if (set.Count >= 4) break;
                    set.Add(n);
                }
                return Shuffle(set.Select(n => new Option { text = n, ok = n == correct }).ToList());
            }
            var used = new HashSet<string>();
            foreach (var p in Shuffle(parts.ToList()))
            {
                if (outList.Count >= examCount) break;
                if (!used.Add(bn(p))) continue;
                var desc = p.Desc ?? "";
                bool describe = outList.Count % 2 == 0 && desc.Length > 40 && !Regex.IsMatch(desc, @"\(.*(مبسط|simplified).*\)", RegexOptions.IgnoreCase);
                if (describe)
                {
                    // hide the structure's own name inside its description
                    foreach (var w in bn(p).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)) if (w.Length > 3) desc = desc.Replace(w, "…");
                    outList.Add(new Question { kind = "describe", sys = p.def.system, prompt = desc, options = optionsFor(p), part = p, explain = p.Name });
                }
                else outList.Add(new Question { kind = "identify", sys = p.def.system, prompt = L.T("quizName"), options = optionsFor(p), part = p, explain = p.Name });
            }
            return Shuffle(outList).Take(examCount).ToList();
        }

        /// <summary>Returns false when there are not enough structures for an exam.</summary>
        public bool StartExam(string name)
        {
            EndTour();
            EndQuiz();
            Progress.Student = name;
            M.focusPart = null;
            var qs = BuildQuestions();
            if (qs.Count < 3) return false;
            M.ShowOnlySystems(examSystems);
            foreach (var p in M.parts) p.hidden = false;
            M.isolated = null;
            M.ApplyAll();
            exam = new Exam
            {
                name = name, level = examLevel, systems = new List<string>(examSystems), qs = qs, answers = Enumerable.Repeat(-1, qs.Count).ToArray(),
                started = Time.realtimeSinceStartup, deadline = examMinutes > 0 ? Time.realtimeSinceStartup + examMinutes * 60 : 0
            };
            ShowExamQuestion();
            return true;
        }

        void ShowExamQuestion()
        {
            var q = exam.qs[exam.i];
            SetExamTarget(q.kind == "identify" ? q.part : null, false);
            if (q.kind == "identify") app.FocusParts(new List<Part> { q.part }, 0.35f);
            app.RefreshAll();
        }

        void SetExamTarget(Part p, bool reveal)
        {
            M.quizTarget = p;
            M.quizName = true;
            M.quizRevealed = reveal;
            M.ApplyAll();
        }

        public void ExamAnswer(int k)
        {
            if (exam == null || exam.finished || exam.answers[exam.i] >= 0) return;
            var q = exam.qs[exam.i];
            bool ok = q.options[k].ok;
            exam.answers[exam.i] = k;
            if (!exam.bySystem.TryGetValue(q.sys, out var s)) exam.bySystem[q.sys] = s = new int[2];
            s[1]++;
            if (ok) { exam.correct++; s[0]++; }
            if (q.part != null) SetExamTarget(q.part, true);
            app.RefreshAll();
        }

        public void ExamNext()
        {
            if (exam == null) return;
            if (exam.i < exam.qs.Count - 1) { exam.i++; ShowExamQuestion(); }
            else FinishExam();
        }

        public string TimeLeft
        {
            get
            {
                if (exam == null || exam.deadline <= 0 || exam.finished) return "";
                int left = Mathf.Max(0, Mathf.CeilToInt(exam.deadline - Time.realtimeSinceStartup));
                return $"{left / 60}:{left % 60:00}";
            }
        }

        void FinishExam()
        {
            SetExamTarget(null, false);
            exam.finished = true;
            exam.pct = Mathf.RoundToInt(100f * exam.correct / exam.qs.Count);
            exam.seconds = Mathf.RoundToInt(Time.realtimeSinceStartup - exam.started);
            Progress.AddExam("exam", exam.level, exam.name, exam.qs.Count, exam.correct, exam.bySystem);
            app.RefreshAll();
        }

        public void EndExam()
        {
            if (exam == null) return;
            exam = null;
            SetExamTarget(null, false);
            app.RefreshAll();
        }

        float nextTick;
        void Update()
        {
            if (exam != null && !exam.finished && exam.deadline > 0 && Time.realtimeSinceStartup >= nextTick)
            {
                nextTick = Time.realtimeSinceStartup + 1;
                if (Time.realtimeSinceStartup >= exam.deadline) FinishExam();
                else app.ui.UpdateTimer(TimeLeft);
            }
        }
    }
}
