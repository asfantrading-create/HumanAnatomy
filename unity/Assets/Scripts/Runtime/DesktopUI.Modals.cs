using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Asfan.Anatomy
{
    /// <summary>Dialogs: licence, about, help, EULA, settings, body chooser, lesson files, confirmation.</summary>
    public partial class DesktopUI
    {
        RectTransform modal;
        bool modalLocked;
        string modalKind;

        /// <summary>Opens a centred dialog; <paramref name="locked"/> dialogs cannot be closed (expired trial).</summary>
        RectTransform Modal(string kind, string title, float width, float height, bool locked = false)
        {
            CloseModal(true);
            modalKind = kind;
            modalLocked = locked;
            var shade = UIKit.Panel(modalLayer, "Modal", new Color(0, 0, 0, 0.55f), false);
            modal = (RectTransform)shade.transform;
            modal.Anchor(Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var close = shade.gameObject.AddComponent<Button>();
            close.transition = Selectable.Transition.None;
            close.onClick.AddListener(() => CloseModal());
            var box = UIKit.Panel(modal, "Box", UIKit.dark ? new Color(0.09f, 0.12f, 0.18f, 1) : Color.white);
            var brt = (RectTransform)box.transform;
            brt.anchorMin = brt.anchorMax = new Vector2(0.5f, 0.5f);
            brt.sizeDelta = new Vector2(width, height);
            box.gameObject.AddComponent<Button>().transition = Selectable.Transition.None;   // swallow clicks inside the box
            var t = UIKit.Label(brt, title, 20, UIKit.Accent, FontStyle.Bold);
            ((RectTransform)t.transform).Anchor(new Vector2(0, 1), Vector2.one, new Vector2(20, -52), new Vector2(-60, -12));
            if (L.Ar) ((RectTransform)t.transform).Anchor(new Vector2(0, 1), Vector2.one, new Vector2(60, -52), new Vector2(-20, -12));
            if (!locked)
            {
                var x = UIKit.Button(brt, "✕", () => CloseModal(), null, 15);
                var xr = (RectTransform)x.transform;
                xr.anchorMin = xr.anchorMax = new Vector2(L.Ar ? 0 : 1, 1);
                xr.pivot = new Vector2(L.Ar ? 0 : 1, 1);
                xr.anchoredPosition = new Vector2(L.Ar ? 12 : -12, -12);
                xr.sizeDelta = new Vector2(36, 34);
            }
            var content = UIKit.Scroll(brt, "Scroll");
            ((RectTransform)content.parent.parent).Anchor(Vector2.zero, Vector2.one, new Vector2(12, 12), new Vector2(-12, -60));
            return content;
        }

        public void CloseModal(bool force = false)
        {
            if (!modal) return;
            if (modalLocked && !force) return;
            Destroy(modal.gameObject);
            modal = null;
            modalKind = null;
        }

        public bool ModalOpen => modal != null;

        void Confirm(string text, Action yes)
        {
            var c = Modal("confirm", L.T("title"), 520, 220);
            UIKit.Para(c, text, 16, null);
            var r = UIKit.Row(c, 38);
            Btn(r, L.T("close"), () => CloseModal());
            Btn(r, "OK", () => { CloseModal(); yes(); }, new Color(0.72f, 0.2f, 0.2f));
        }

        // ------------------------------------------------------------------ body chooser (start)
        public void ShowChooser()
        {
            var c = Modal("chooser", L.T("chooseBody"), 620, 330);
            var r = UIKit.Row(c, 120, 16);
            var m = Btn(r, "♂  " + L.T("male"), () => { M.SetSex(false); CloseModal(); app.RefreshAll(); }, new Color(0.16f, 0.45f, 0.8f), 22);
            var f = Btn(r, "♀  " + L.T("female"), () => { M.SetSex(true); CloseModal(); app.RefreshAll(); }, new Color(0.72f, 0.3f, 0.6f), 22);
            foreach (var b in new[] { m, f }) b.GetComponentInChildren<Text>().color = Color.white;
            Muted(c, L.T("chooseHint"));
            Muted(c, L.T("femaleNote"), 12);
        }

        // ------------------------------------------------------------------ about
        void ShowAbout()
        {
            var c = Modal("about", L.T("aboutTitle"), 640, 560);
            if (Logo != null)
            {
                var holder = UIKit.Rect(c, "Logo");
                holder.gameObject.AddComponent<LayoutElement>().preferredHeight = 70;
                var raw = UIKit.Rect(holder, "Img").gameObject.AddComponent<RawImage>();
                raw.texture = Logo;
                var r = (RectTransform)raw.transform;
                r.anchorMin = r.anchorMax = new Vector2(0.5f, 0.5f);
                r.sizeDelta = new Vector2(64f * Logo.width / Logo.height, 64);
            }
            var t = UIKit.Para(c, L.T("appTitle") + " – Human Anatomy 3D", 20, null); t.fontStyle = FontStyle.Bold; t.alignment = TextAnchor.MiddleCenter;
            var v = Muted(c, L.T("version") + " " + Application.version, 13); v.alignment = TextAnchor.MiddleCenter;
            UIKit.Para(c, L.T("aboutText"), 15, null);
            UIKit.Para(c, "ASFAN – Amman, Jordan   •   +962776140404   •   info@asfanco.com", 14, UIKit.Accent).alignment = TextAnchor.MiddleCenter;
            var row = UIKit.Row(c, 36);
            Btn(row, L.T("contactWa"), () => Application.OpenURL("https://wa.me/962776140404"), new Color(0.13f, 0.6f, 0.33f));
            Btn(row, L.T("contactMail"), () => Application.OpenURL("mailto:info@asfanco.com"));
            Btn(row, L.T("eula"), ShowEula);
            Muted(c, "BodyParts3D © The Database Center for Life Science, licensed under CC Attribution 4.0 International (CC BY 4.0).", 12);
        }

        // ------------------------------------------------------------------ help
        void ShowHelp()
        {
            var c = Modal("help", L.T("helpTitle"), 700, 640);
            foreach (var row in LearningData.Help[L.Ar ? 0 : 1])
            {
                var r = UIKit.Row(c, 26);
                var k = UIKit.Label(r, row[0], 14, UIKit.Accent, FontStyle.Bold);
                k.gameObject.AddComponent<LayoutElement>().flexibleWidth = 0.8f;
                UIKit.Label(r, row[1], 14, null);
            }
            UIKit.Heading(c, L.T("vrControls"));
            UIKit.Para(c, L.T("vrHelp"), 14, null);
        }

        // ------------------------------------------------------------------ EULA
        void ShowEula()
        {
            var c = Modal("eula", L.T("eula"), 900, 720);
            var path = Path.Combine(Application.streamingAssetsPath, "EULA.txt");
            var text = File.Exists(path) ? File.ReadAllText(path) : "EULA.txt";
            // the Arabic text comes first, the English one after a line of "="
            var halves = System.Text.RegularExpressions.Regex.Split(text, @"\n=+\n");
            var order = L.Ar || halves.Length < 2 ? halves : halves.Reverse().ToArray();
            foreach (var half in order)
                foreach (var para in half.Replace("\r", "").Split(new[] { "\n\n" }, StringSplitOptions.RemoveEmptyEntries))
                {
                    var t = UIKit.Para(c, para.Trim(), 13, null);
                    t.alignment = ArabicShaper.HasArabic(para) ? TextAnchor.UpperRight : TextAnchor.UpperLeft;
                }
        }

        // ------------------------------------------------------------------ settings
        void ShowSettings()
        {
            var c = Modal("settings", L.T("settings"), 560, 480);
            UIKit.Heading(c, L.T("quality"));
            var q = UIKit.Row(c, 34);
            UIKit.SetOn(Btn(q, L.T("qHigh"), () => { app.SetQuality(true); ShowSettings(); }), app.highQuality);
            UIKit.SetOn(Btn(q, L.T("qLow"), () => { app.SetQuality(false); ShowSettings(); }), !app.highQuality);
            Muted(c, L.T("qualityHint"), 12);
            UIKit.Heading(c, L.T("theme"));
            var th = UIKit.Row(c, 34);
            Btn(th, L.T("theme"), app.ToggleTheme);
            Btn(th, L.T("fullscreen"), app.ToggleFullScreen);
            UIKit.Heading(c, L.T("fontUp") + " / " + L.T("fontDown"));
            var f = UIKit.Row(c, 34);
            Btn(f, "A−", () => app.SetFontScale(FontScale - 0.1f));
            Btn(f, Mathf.RoundToInt(FontScale * 100) + "%", null);
            Btn(f, "A+", () => app.SetFontScale(FontScale + 0.1f));
            UIKit.Heading(c, L.T("lang"));
            Btn(c, L.T("lang"), app.ToggleLanguage);
            UIKit.Heading(c, L.T("updates"));
            Muted(c, L.T("updCurrent", "v", Application.version), 12);
            Btn(c, L.T("checkUpdates"), () => { CloseModal(); app.updater.Check(true); });
        }

        // ------------------------------------------------------------------ teacher lesson files
        void ShowOpenLesson()
        {
            var dir = FileDialogs.Folder("Lessons");
            if (FileDialogs.Available)
            {
                var path = FileDialogs.Open(L.T("lessonOpen"), "Lesson (*.ha3d.json;*.json)|*.ha3d.json;*.json|All files (*.*)|*.*", dir);
                if (path != null) { OpenLessonFile(path); return; }
            }
            var c = Modal("lessons", L.T("lessonOpen"), 640, 560);
            Muted(c, L.T("lessonsIn", "dir", dir), 12);
            var files = Directory.Exists(dir) ? Directory.GetFiles(dir, "*.json").OrderByDescending(File.GetLastWriteTime).ToList() : new List<string>();
            if (files.Count == 0) Muted(c, L.T("noFiles"));
            foreach (var f in files)
            {
                var path = f;
                var b = Btn(c, Path.GetFileName(f).Replace(".ha3d.json", ""), () => OpenLessonFile(path), UIKit.Card);
                b.GetComponentInChildren<Text>().alignment = L.Ar ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft;
            }
            var r = UIKit.Row(c, 34);
            Btn(r, L.T("openFolder"), () => FileDialogs.Reveal(dir));
            if (FileDialogs.Available) Btn(r, L.T("browseFile"), () =>
            {
                var path = FileDialogs.Open(L.T("lessonOpen"), "Lesson (*.ha3d.json;*.json)|*.ha3d.json;*.json|All files (*.*)|*.*", dir);
                if (path != null) OpenLessonFile(path);
            });
        }

        // ------------------------------------------------------------------ automatic update
        public void ShowUpdate(UpdateChecker.Info info)
        {
            var c = Modal("update", L.T("updAvail", "v", info.version), 680, 560, info.mandatory);
            Muted(c, L.T("updCurrent", "v", Application.version), 13);
            if (info.size > 0) Muted(c, L.T("updSize", "mb", (info.size / 1048576f).ToString("0")), 13);
            if (info.mandatory) UIKit.Para(c, L.T("updMandatory"), 14, new Color(0.95f, 0.55f, 0.2f));
            if (info.Notes.Length > 0)
            {
                UIKit.Heading(c, L.T("updWhatsNew"));
                UIKit.Para(c, info.Notes, 14, null);
            }
            var status = UIKit.Para(c, "", 14, UIKit.Accent);
            var bar = UIKit.Bar(c, 0, UIKit.Accent, 10);
            bar.gameObject.SetActive(false);
            var row = UIKit.Row(c, 40);
            Button now = null, later = null;
            now = Btn(row, L.T("updNow"), () =>
            {
                now.interactable = false;
                if (later) later.interactable = false;
                bar.gameObject.SetActive(true);
                app.updater.Install(info, p =>
                {
                    UIKit.SetText(status, p >= 1 ? L.T("updInstalling") : L.T("updDownloading", "p", Mathf.RoundToInt(p * 100)));
                    var fill = (RectTransform)bar.GetChild(0);
                    if (L.Ar) fill.anchorMin = new Vector2(1 - p, 0); else fill.anchorMax = new Vector2(p, 1);
                }, err =>
                {
                    UIKit.SetText(status, err);
                    now.interactable = true;
                    if (later) later.interactable = true;
                });
            }, new Color(0.12f, 0.6f, 0.36f), 15);
            if (!info.mandatory) later = Btn(row, L.T("updLater"), () => CloseModal(), null, 15);
        }

        // ------------------------------------------------------------------ licence
        string licMsg = "";
        Color licMsgColor;

        public void OnLicense(LicenseManager.Status s)
        {
            if (s == null || !licenseChip) return;
            UIKit.SetText(licenseChipText, s.active ? L.T("activeChip") : L.T("trialChip", "d", s.trialDaysLeft));
            licenseChip.GetComponent<Image>().color = s.active ? UIKit.Btn : s.allowed ? new Color(0.85f, 0.55f, 0.12f) : new Color(0.75f, 0.2f, 0.2f);
            licenseChipText.color = s.active ? UIKit.Fg : Color.white;
            if (!s.allowed) ShowLicense();
            else if (modalKind == "license") ShowLicense();
        }

        public void ShowLicense()
        {
            var s = app.license.Current;
            bool locked = !s.allowed;
            var c = Modal("license", L.T("licTitle"), 720, 720, locked);
            var status = s.active ? (MiniJson.Str(s.license, "type") == "staff" ? L.T("staffLic") + " ✓" : L.T("licActive"))
                : s.allowed ? L.T("licTrial", "d", s.trialDaysLeft, "n", LicenseManager.TrialDays)
                : s.error == "expired" ? L.T("err_expired") : L.T("licLocked");
            var st = UIKit.Panel(c, "Status", s.active ? new Color(0.1f, 0.5f, 0.3f) : s.allowed ? new Color(0.8f, 0.5f, 0.1f) : new Color(0.65f, 0.18f, 0.18f));
            st.gameObject.AddComponent<LayoutElement>().preferredHeight = 44;
            var stt = UIKit.Label(st.transform, status, 16, Color.white, FontStyle.Bold, TextAnchor.MiddleCenter);
            ((RectTransform)stt.transform).Anchor(Vector2.zero, Vector2.one, new Vector2(10, 0), new Vector2(-10, 0));

            var lic = s.license;
            if (lic != null)
            {
                void Row(string k, string v)
                {
                    var r = UIKit.Row(c, 24);
                    var kl = UIKit.Label(r, k, 13, UIKit.Muted);
                    kl.gameObject.AddComponent<LayoutElement>().flexibleWidth = 0.6f;
                    UIKit.Label(r, v, 13, null, FontStyle.Bold);
                }
                Row(L.T("licName"), MiniJson.Str(lic, "name"));
                var plan = MiniJson.Str(lic, "plan");
                Row(L.T("licPlan"), MiniJson.Str(lic, "type") == "staff" ? L.T("staffLic") : L.T(plan == "monthly" ? "monthly" : plan == "yearly" ? "yearly" : "customPlan"));
                if (MiniJson.Str(lic, "expires").Length > 0) Row(L.T("licExpires"), MiniJson.Str(lic, "expires"));
                if (s.daysLeft >= 0) Row(L.T("licDaysLeft"), s.daysLeft.ToString());
                if (MiniJson.Str(lic, "issued").Length > 0) Row(L.T("licIssued"), MiniJson.Str(lic, "issued"));
                var machines = MiniJson.Arr(lic, "machines");
                Row(L.T("licMachineBound"), machines != null ? L.T("licInstitution", "n", machines.Count) : MiniJson.Str(lic, "machine", L.T("notBound")));
                if (!s.active && s.error != null) UIKit.Para(c, L.T("err_" + s.error), 13, new Color(0.95f, 0.4f, 0.4f));
            }

            UIKit.Heading(c, L.T("licMachineTitle"));
            var mr = UIKit.Row(c, 36);
            var mid = UIKit.Label(mr, s.machine, 20, UIKit.Accent, FontStyle.Bold, TextAnchor.MiddleCenter);
            mid.gameObject.AddComponent<LayoutElement>().flexibleWidth = 3;
            Btn(mr, L.T("copy"), () => { GUIUtility.systemCopyBuffer = s.machine; ShowToast("✓ " + s.machine, 2); });
            Muted(c, L.T("licMachineHint"), 12);

            UIKit.Heading(c, L.T("licKey"));
            string key = "";
            UIKit.Input(c, "", "HA3D1-…", null, true, 70, v => key = v);
            var ar = UIKit.Row(c, 36);
            Btn(ar, L.T("licActivate"), () => Activate(key), new Color(0.12f, 0.6f, 0.36f), 14);
            Btn(ar, L.T("licLoadFile"), () =>
            {
                var path = FileDialogs.Open(L.T("licLoadFile"), "License (*.lic;*.txt)|*.lic;*.txt|All files (*.*)|*.*", Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments));
                if (path != null) Activate(File.ReadAllText(path).Trim());
            });
            if (licMsg.Length > 0) UIKit.Para(c, licMsg, 14, licMsgColor);

            UIKit.Heading(c, L.T("licBuyTitle"));
            Muted(c, L.T("licBuyHint"), 12);
            var br = UIKit.Row(c, 36);
            var msg = Uri.EscapeDataString(L.T("appTitle") + " – " + L.T("licBuyTitle") + "\n" + L.T("licMachineTitle") + ": " + s.machine);
            Btn(br, L.T("contactWa"), () => Application.OpenURL("https://wa.me/962776140404?text=" + msg), new Color(0.13f, 0.6f, 0.33f));
            Btn(br, L.T("contactMail"), () => Application.OpenURL("mailto:info@asfanco.com?subject=" + Uri.EscapeDataString(L.T("appTitle")) + "&body=" + msg));
            Btn(br, L.T("eula"), ShowEula);
            if (s.license != null && s.active) Btn(c, L.T("licDeactivate"), () => Confirm(L.T("licDeactivate") + "?", () => app.license.Deactivate()));
            if (locked) Btn(c, L.T("quitApp"), Application.Quit, new Color(0.4f, 0.4f, 0.45f));
        }

        void Activate(string key)
        {
            if (string.IsNullOrWhiteSpace(key)) return;
            bool ok = app.license.Activate(key, out var err);
            licMsg = ok ? L.T("licOk") : L.T("err_" + (err ?? "format"));
            licMsgColor = ok ? new Color(0.3f, 0.85f, 0.5f) : new Color(0.95f, 0.4f, 0.4f);
            ShowLicense();
            if (ok) licMsg = "";
        }
    }
}
