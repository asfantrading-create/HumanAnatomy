// Per-user learning data kept in localStorage: viewed structures, quiz/exam
// history, finished lessons, notes, favourites and saved views.
const KEY = 'ha3d.progress.v1';

function load() {
  try { return { viewed: {}, exams: [], lessons: {}, notes: {}, favs: [], views: [], student: '', ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {
    return { viewed: {}, exams: [], lessons: {}, notes: {}, favs: [], views: [], student: '' };
  }
}

export const progress = {
  data: load(),
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ } },

  markViewed(id) {
    if (!this.data.viewed[id]) { this.data.viewed[id] = Date.now(); this.save(); }
  },
  /** result: { kind, title, total, correct, bySystem: { sys: [correct, total] } } */
  addExam(result) {
    this.data.exams.unshift({ date: new Date().toISOString(), ...result });
    this.data.exams = this.data.exams.slice(0, 200);
    this.save();
  },
  /** Running per-system accuracy from all quizzes and exams. */
  accuracy() {
    const acc = {};
    for (const e of this.data.exams) {
      for (const [sys, [c, n]] of Object.entries(e.bySystem || {})) {
        acc[sys] = acc[sys] || [0, 0];
        acc[sys][0] += c; acc[sys][1] += n;
      }
    }
    return acc;
  },
  lessonDone(id) { this.data.lessons[id] = Date.now(); this.save(); },

  note(id) { return this.data.notes[id] || ''; },
  setNote(id, text) {
    if (text.trim()) this.data.notes[id] = text; else delete this.data.notes[id];
    this.save();
  },
  isFav(id) { return this.data.favs.includes(id); },
  toggleFav(id) {
    const i = this.data.favs.indexOf(id);
    if (i >= 0) this.data.favs.splice(i, 1); else this.data.favs.push(id);
    this.save();
    return i < 0;
  },
  addView(view) { this.data.views.unshift(view); this.save(); },
  removeView(i) { this.data.views.splice(i, 1); this.save(); },
  setStudent(name) { this.data.student = name; this.save(); },
  reset() { this.data = { viewed: {}, exams: [], lessons: {}, notes: {}, favs: [], views: [], student: this.data.student }; this.save(); }
};
