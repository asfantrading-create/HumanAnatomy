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
        }

        public void Stop()
        {
            if (running != null) StopCoroutine(running);
            running = null;
            if (source) source.Stop();
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
            running = null;
        }
    }
}
