using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Asfan.Anatomy
{
    /// <summary>
    /// Automatic updates. On start the program reads update.json from the latest GitHub release of the
    /// public updates repository. The file is signed with the publisher key (tools/license-generator.html,
    /// section 4), so only updates made by ASFAN are accepted; the downloaded installer is checked against
    /// its SHA-256 before it runs. The installer then replaces the program and opens it again.
    /// </summary>
    public class UpdateChecker : MonoBehaviour
    {
        /// <summary>Always points at update.json of the newest release.</summary>
        public const string UpdateUrl = "https://github.com/asfantrading-create/HumanAnatomy-Updates/releases/latest/download/update.json";

        public class Info
        {
            public string version, url, sha256, notesAr, notesEn, minVersion;
            public long size;
            public bool mandatory;
            public string Notes => L.Ar ? (notesAr.Length > 0 ? notesAr : notesEn) : (notesEn.Length > 0 ? notesEn : notesAr);
        }

        public AnatomyApp app;
        public bool busy;
        bool offeredThisRun;

        public static string CurrentVersion => Application.version;

        static Version V(string s) => Version.TryParse((s ?? "").Trim().TrimStart('v', 'V'), out var v) ? v : new Version(0, 0);

        /// <summary>Checks for a newer version. <paramref name="manual"/>: also report "up to date" and errors.</summary>
        public void Check(bool manual) { if (!busy) StartCoroutine(CheckRoutine(manual)); }

        IEnumerator CheckRoutine(bool manual)
        {
            busy = true;
            if (manual) app.ui.ShowToast(L.T("updateChecking"), 3);
            Info info = null;
            string error = null;
            using (var req = UnityWebRequest.Get(UpdateUrl))
            {
                req.timeout = 20;
                yield return req.SendWebRequest();
                if (req.result != UnityWebRequest.Result.Success) error = req.error;
                else
                {
                    try { info = Parse(req.downloadHandler.text); }
                    catch (Exception e) { error = e.Message; }
                }
            }
            busy = false;
            if (info == null)
            {
                Debug.Log("[Update] " + error);
                if (manual) app.ui.ShowToast(L.T("updateErr"), 5);
                yield break;
            }
            if (V(info.version) <= V(CurrentVersion))
            {
                if (manual) app.ui.ShowToast(L.T("upToDate") + "  (" + CurrentVersion + ")", 4);
                yield break;
            }
            if (!manual && offeredThisRun) yield break;
            offeredThisRun = true;
            app.ui.ShowUpdate(info);
        }

        static Info Parse(string json)
        {
            var d = MiniJson.Parse(json) as Dictionary<string, object>;
            if (d == null || MiniJson.Str(d, "app") != "HA3D-UNITY") throw new FormatException("not an update file");
            var info = new Info
            {
                version = MiniJson.Str(d, "version"), url = MiniJson.Str(d, "url"), sha256 = MiniJson.Str(d, "sha256").ToLowerInvariant(),
                notesAr = MiniJson.Str(d, "notesAr"), notesEn = MiniJson.Str(d, "notesEn"), minVersion = MiniJson.Str(d, "minVersion"),
                size = (long)MiniJson.Num(d, "size")
            };
            // only updates signed with the publisher key are accepted
            var message = Encoding.UTF8.GetBytes(info.version + "\n" + info.url + "\n" + info.sha256);
            if (!LicenseManager.VerifyPublisher(message, MiniJson.Str(d, "sig"))) throw new FormatException("bad signature");
            if (!info.url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) throw new FormatException("bad url");
            info.mandatory = info.minVersion.Length > 0 && V(CurrentVersion) < V(info.minVersion);
            return info;
        }

        /// <summary>Downloads, verifies and runs the installer; reports progress 0..1 and errors.</summary>
        public void Install(Info info, Action<float> progress, Action<string> failed)
        {
            if (!busy) StartCoroutine(InstallRoutine(info, progress, failed));
        }

        IEnumerator InstallRoutine(Info info, Action<float> progress, Action<string> failed)
        {
            busy = true;
            var dir = Path.Combine(Path.GetTempPath(), "ASFAN-Anatomy-Update");
            Directory.CreateDirectory(dir);
            var file = Path.Combine(dir, "HumanAnatomy3D-Setup-" + info.version + ".exe");
            using (var req = new UnityWebRequest(info.url, UnityWebRequest.kHttpVerbGET))
            {
                req.downloadHandler = new DownloadHandlerFile(file) { removeFileOnAbort = true };
                var op = req.SendWebRequest();
                while (!op.isDone) { progress?.Invoke(req.downloadProgress); yield return null; }
                if (req.result != UnityWebRequest.Result.Success) { busy = false; failed?.Invoke(L.T("updateErr")); yield break; }
            }
            progress?.Invoke(1);
            yield return null;
            string hash;
            using (var sha = SHA256.Create())
            using (var fs = File.OpenRead(file))
                hash = BitConverter.ToString(sha.ComputeHash(fs)).Replace("-", "").ToLowerInvariant();
            if (hash != info.sha256)
            {
                try { File.Delete(file); } catch { }
                busy = false;
                failed?.Invoke(L.T("updBad"));
                yield break;
            }
            if (Application.isEditor)
            {
                busy = false;
                failed?.Invoke("Editor: the installer was downloaded and verified but is not run (" + file + ")");
                yield break;
            }
            try
            {
                // silent install over the current one; the installer closes and reopens the program
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(file, "/SILENT /SP- /NOCANCEL /CLOSEAPPLICATIONS")
                { UseShellExecute = true });
            }
            catch (Exception e) { busy = false; failed?.Invoke(e.Message); yield break; }
            yield return new WaitForSecondsRealtime(1.5f);
            Application.Quit();
        }
    }
}
