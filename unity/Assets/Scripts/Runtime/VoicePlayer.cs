using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.Networking;

namespace Asfan.Anatomy
{
    /// <summary>Plays the recorded Arabic pronunciations (StreamingAssets/voice/*.mp3).</summary>
    public class VoicePlayer : MonoBehaviour
    {
        static readonly Regex Side = new Regex(@"\s+(الأيسر|الأيمن|اليسرى|اليمنى)$");
        readonly Dictionary<string, string> map = new Dictionary<string, string>();
        readonly Dictionary<string, AudioClip> cache = new Dictionary<string, AudioClip>();
        AudioSource source;
        Coroutine running;

        public void Init(Manifest m)
        {
            source = gameObject.AddComponent<AudioSource>();
            source.playOnAwake = false;
            source.spatialBlend = 0;
            if (m.voiceKeys == null || m.voiceIds == null) return;
            for (int i = 0; i < m.voiceKeys.Length && i < m.voiceIds.Length; i++) map[m.voiceKeys[i]] = m.voiceIds[i];
        }

        List<string> ClipsFor(string text)
        {
            var tx = (text ?? "").Trim();
            if (map.TryGetValue(tx, out var id)) return new List<string> { id };
            var m = Side.Match(tx);
            if (m.Success)
            {
                var b = Side.Replace(tx, "").Trim();
                if (map.TryGetValue(b, out var a) && map.TryGetValue(m.Groups[1].Value, out var s)) return new List<string> { a, s };
            }
            return null;
        }

        public bool Has(Part p) => p != null && ClipsFor(p.def.ar) != null;

        /// <summary>Says the Arabic name of a structure if a recording exists.</summary>
        public void Speak(Part p)
        {
            Stop();
            var ids = p == null ? null : ClipsFor(p.def.ar);
            if (ids != null) running = StartCoroutine(Play(ids));
            else if (p != null) SystemSpeech.Speak(p.Name, L.Ar);
        }

        public void Stop()
        {
            if (running != null) StopCoroutine(running);
            running = null;
            if (source) source.Stop();
            SystemSpeech.Stop();
        }

        /// <summary>
        /// Speaks text segments in order: recorded Arabic clips where they exist (names),
        /// the Windows speech synthesiser for the rest (lesson explanations, English).
        /// </summary>
        public void SpeakText(params string[] segments)
        {
            Stop();
            var segs = new List<string>();
            foreach (var x in segments) if (!string.IsNullOrWhiteSpace(x)) segs.Add(x);
            if (segs.Count == 0) return;
            if (L.Ar)
            {
                var ids = new List<string>();
                int first = 0;
                for (; first < segs.Count; first++)
                {
                    var c = ClipsFor(segs[first]);
                    if (c == null) break;
                    ids.AddRange(c);
                }
                if (ids.Count > 0)
                {
                    var rest = string.Join(". ", segs.GetRange(first, segs.Count - first));
                    running = StartCoroutine(Play(ids, rest));
                    return;
                }
            }
            SystemSpeech.Speak(string.Join(". ", segs), L.Ar);
        }

        IEnumerator Play(List<string> ids, string then = null)
        {
            yield return Play(ids);
            if (!string.IsNullOrEmpty(then)) SystemSpeech.Speak(then, L.Ar);
        }

        IEnumerator Play(List<string> ids)
        {
            foreach (var id in ids)
            {
                if (!cache.TryGetValue(id, out var clip))
                {
                    var path = Path.Combine(Application.streamingAssetsPath, "voice", id + ".mp3");
                    if (!File.Exists(path)) yield break;
                    using (var req = UnityWebRequestMultimedia.GetAudioClip("file:///" + path.Replace('\\', '/').TrimStart('/'), AudioType.MPEG))
                    {
                        yield return req.SendWebRequest();
                        if (req.result != UnityWebRequest.Result.Success) yield break;
                        clip = DownloadHandlerAudioClip.GetContent(req);
                    }
                    cache[id] = clip;
                }
                source.clip = clip;
                source.Play();
                while (source.isPlaying) yield return null;
            }
        }
    }

    /// <summary>Windows text-to-speech (System.Speech through a hidden PowerShell process; no extra installation).</summary>
    public static class SystemSpeech
    {
        static System.Diagnostics.Process proc;

        public static void Speak(string text, bool arabic)
        {
            Stop();
            if (string.IsNullOrWhiteSpace(text)) return;
            if (Application.platform != RuntimePlatform.WindowsPlayer && Application.platform != RuntimePlatform.WindowsEditor) return;
            var b64 = System.Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(text));
            var culture = arabic ? "ar" : "en";
            var script = "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; " +
                         "$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like '" + culture + "*' } | Select-Object -First 1; " +
                         "if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }; " +
                         "$s.Speak([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + b64 + "')))";
            try
            {
                proc = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("powershell", "-NoProfile -NonInteractive -WindowStyle Hidden -Command \"" + script + "\"")
                { UseShellExecute = false, CreateNoWindow = true });
            }
            catch { proc = null; }
        }

        public static void Stop()
        {
            try { if (proc != null && !proc.HasExited) proc.Kill(); } catch { }
            proc = null;
        }
    }
}
