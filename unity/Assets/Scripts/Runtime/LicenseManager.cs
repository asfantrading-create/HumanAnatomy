using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Asfan.Anatomy
{
    /// <summary>
    /// Offline subscription licensing, compatible with the keys of the desktop (Electron) edition
    /// and tools/license-generator.html: HA3D1-&lt;base64url(JSON payload)&gt;.&lt;base64url(ECDSA P-256 signature)&gt;.
    /// A key carries the customer name, plan, expiry date and optionally the machine ID(s) it is bound to.
    /// </summary>
    public class LicenseManager
    {
        public const int TrialDays = 5;
        const string Prefix = "HA3D1-";
        // publisher public key (license-public.jwk.json), compiled in so it cannot be swapped
        const string JwkX = "EqWPQiGGd6wy3KvIL3tAHXd0vMQ8AonR0CrnPGFqJMA";
        const string JwkY = "bCECyXPicJtK6ltIslolTvbHC2aTMObF5Q0nnWh6DnM";
        const double Day = 24 * 60 * 60 * 1000.0;

        public class Status
        {
            public bool active, allowed;
            public Dictionary<string, object> license;   // payload (also when invalid, for display)
            public string error;                          // format | signature | machine | expired
            public int trialDaysLeft, daysLeft = -1;
            public string machine;
        }

        readonly string file;
        Dictionary<string, object> data;
        public string Machine { get; }
        public Status Current { get; private set; }
        public event Action<Status> Changed;

        public LicenseManager()
        {
            file = Path.Combine(Application.persistentDataPath, "license.json");
            try { data = MiniJson.Parse(File.ReadAllText(file)) as Dictionary<string, object>; } catch { }
            if (data == null) data = new Dictionary<string, object>();
            Machine = MachineId();
            double now = Now();
            // the first run is also kept in the registry (PlayerPrefs) so deleting the file does not restart the trial
            double first = MiniJson.Num(data, "firstRun", 0);
            double reg = double.TryParse(PlayerPrefs.GetString("ha3d_fr", ""), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var r) ? r : 0;
            first = first > 0 && reg > 0 ? Math.Min(first, reg) : Math.Max(first, reg);
            if (first <= 0) first = now;
            data["firstRun"] = first;
            PlayerPrefs.SetString("ha3d_fr", first.ToString("R", System.Globalization.CultureInfo.InvariantCulture));
            PlayerPrefs.Save();
            double last = MiniJson.Num(data, "lastSeen", 0);
            // protect the trial against moving the clock backwards
            if (last > 0 && now < last - Day) data["clockTampered"] = true;
            data["lastSeen"] = Math.Max(now, last);
            Write();
            Refresh();
        }

        static double Now() => (DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;

        void Write()
        {
            try { Directory.CreateDirectory(Path.GetDirectoryName(file)); File.WriteAllText(file, MiniJson.Serialize(data, true)); } catch { }
        }

        public void Refresh()
        {
            var s = new Status { machine = Machine };
            var key = MiniJson.Str(data, "key", "");
            if (key.Length > 0)
            {
                var v = Verify(key, out var payload, out var err);
                s.license = payload;
                if (v) s.active = true; else s.error = err;
            }
            double trialEnd = MiniJson.Num(data, "firstRun", Now()) + TrialDays * Day;
            s.trialDaysLeft = MiniJson.Bool(data, "clockTampered") ? 0 : Math.Max(0, (int)Math.Ceiling((trialEnd - Now()) / Day));
            if (s.active)
            {
                var exp = MiniJson.Str(s.license, "expires", "");
                if (exp.Length > 0 && TryDate(exp, out var d)) s.daysLeft = Math.Max(0, (int)Math.Ceiling((d.AddDays(1) - DateTime.Now).TotalDays));
            }
            s.allowed = s.active || s.trialDaysLeft > 0;
            Current = s;
            Changed?.Invoke(s);
        }

        static bool TryDate(string s, out DateTime d) => DateTime.TryParseExact(s, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out d);

        public bool Activate(string key, out string error)
        {
            key = Regex.Replace(key ?? "", @"\s+", "");
            bool ok = Verify(key, out _, out error);
            if (ok) { data["key"] = key; Write(); }
            Refresh();
            return ok;
        }

        public void Deactivate()
        {
            data.Remove("key");
            Write();
            Refresh();
        }

        /// <summary>Verifies a key; returns the payload even when it is bound to another machine or expired.</summary>
        public bool Verify(string key, out Dictionary<string, object> payload, out string error)
        {
            payload = null; error = "format";
            try
            {
                var raw = Regex.Replace(key ?? "", @"\s+", "");
                if (!raw.StartsWith(Prefix, StringComparison.Ordinal)) return false;
                var parts = raw.Substring(Prefix.Length).Split('.');
                if (parts.Length != 2) return false;
                var body = B64u(parts[0]);
                var sig = B64u(parts[1]);
                if (!P256.Verify(B64u(JwkX), B64u(JwkY), body, sig)) { error = "signature"; return false; }
                payload = MiniJson.Parse(Encoding.UTF8.GetString(body)) as Dictionary<string, object>;
                if (payload == null) return false;
                var machines = new List<string>();
                var list = MiniJson.Arr(payload, "machines");
                if (list != null) foreach (var m in list) machines.Add(Convert.ToString(m).ToUpperInvariant());
                else if (MiniJson.Str(payload, "machine", "").Length > 0) machines.Add(MiniJson.Str(payload, "machine").ToUpperInvariant());
                if (machines.Count > 0 && !machines.Contains(Machine)) { error = "machine"; return false; }
                var exp = MiniJson.Str(payload, "expires", "");
                if (MiniJson.Str(payload, "type", "") != "staff" && exp.Length > 0 && TryDate(exp, out var d) && d.AddDays(1) <= DateTime.Now) { error = "expired"; return false; }
                error = null;
                return true;
            }
            catch { error = "format"; return false; }
        }

        static byte[] B64u(string s)
        {
            s = s.Replace('-', '+').Replace('_', '/');
            switch (s.Length % 4) { case 2: s += "=="; break; case 3: s += "="; break; }
            return Convert.FromBase64String(s);
        }

        /// <summary>Stable per-computer ID shown to the customer (XXXX-XXXX-XXXX-XXXX), same as the desktop edition.</summary>
        static string MachineId()
        {
            string raw = "";
            try
            {
                if (Application.platform == RuntimePlatform.WindowsPlayer || Application.platform == RuntimePlatform.WindowsEditor)
                {
                    var psi = new ProcessStartInfo("reg", "query \"HKLM\\SOFTWARE\\Microsoft\\Cryptography\" /v MachineGuid")
                    { UseShellExecute = false, RedirectStandardOutput = true, CreateNoWindow = true };
                    using (var p = Process.Start(psi))
                    {
                        var output = p.StandardOutput.ReadToEnd();
                        p.WaitForExit(3000);
                        var m = Regex.Match(output, @"MachineGuid\s+REG_SZ\s+([\w-]+)", RegexOptions.IgnoreCase);
                        if (m.Success) raw = m.Groups[1].Value;
                    }
                }
                else if (File.Exists("/etc/machine-id")) raw = File.ReadAllText("/etc/machine-id").Trim();
            }
            catch { }
            if (raw.Length == 0) raw = SystemInfo.deviceUniqueIdentifier;
            using (var sha = SHA256.Create())
            {
                var h = sha.ComputeHash(Encoding.UTF8.GetBytes("human-anatomy-3d|" + raw));
                var hex = BitConverter.ToString(h).Replace("-", "").ToUpperInvariant().Substring(0, 16);
                return hex.Substring(0, 4) + "-" + hex.Substring(4, 4) + "-" + hex.Substring(8, 4) + "-" + hex.Substring(12, 4);
            }
        }
    }

    /// <summary>ECDSA P-256 / SHA-256 signature verification (raw r||s signatures as produced by WebCrypto).</summary>
    public static class P256
    {
        static readonly BigInteger P = Hex("FFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF");
        static readonly BigInteger A = P - 3;
        static readonly BigInteger N = Hex("FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551");
        static readonly BigInteger Gx = Hex("6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296");
        static readonly BigInteger Gy = Hex("4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5");
        static readonly BigInteger B = Hex("5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B");

        static BigInteger Hex(string h) => BigInteger.Parse("0" + h, System.Globalization.NumberStyles.HexNumber);
        static BigInteger U(byte[] be, int off, int len)
        {
            var le = new byte[len + 1];
            for (int i = 0; i < len; i++) le[i] = be[off + len - 1 - i];
            return new BigInteger(le);
        }
        static BigInteger Mod(BigInteger a, BigInteger m) { var r = a % m; return r.Sign < 0 ? r + m : r; }
        static BigInteger Inv(BigInteger a, BigInteger m) => BigInteger.ModPow(Mod(a, m), m - 2, m);

        // Jacobian coordinates (X, Y, Z); Z = 0 is the point at infinity
        struct J { public BigInteger X, Y, Z; }

        static J Double(J p)
        {
            if (p.Z.IsZero || p.Y.IsZero) return new J { X = 1, Y = 1, Z = 0 };
            var yy = Mod(p.Y * p.Y, P);
            var s = Mod(4 * p.X * yy, P);
            var zz = Mod(p.Z * p.Z, P);
            var m = Mod(3 * (p.X - zz) * (p.X + zz), P);   // a = -3
            var x = Mod(m * m - 2 * s, P);
            var y = Mod(m * (s - x) - 8 * yy * yy, P);
            var z = Mod(2 * p.Y * p.Z, P);
            return new J { X = x, Y = y, Z = z };
        }

        static J Add(J p, J q)
        {
            if (p.Z.IsZero) return q;
            if (q.Z.IsZero) return p;
            var z1z1 = Mod(p.Z * p.Z, P);
            var z2z2 = Mod(q.Z * q.Z, P);
            var u1 = Mod(p.X * z2z2, P);
            var u2 = Mod(q.X * z1z1, P);
            var s1 = Mod(p.Y * q.Z * z2z2, P);
            var s2 = Mod(q.Y * p.Z * z1z1, P);
            if (u1 == u2) return s1 == s2 ? Double(p) : new J { X = 1, Y = 1, Z = 0 };
            var h = Mod(u2 - u1, P);
            var r = Mod(s2 - s1, P);
            var hh = Mod(h * h, P);
            var hhh = Mod(h * hh, P);
            var v = Mod(u1 * hh, P);
            var x = Mod(r * r - hhh - 2 * v, P);
            var y = Mod(r * (v - x) - s1 * hhh, P);
            var z = Mod(h * p.Z * q.Z, P);
            return new J { X = x, Y = y, Z = z };
        }

        static J Mul(J p, BigInteger k)
        {
            var r = new J { X = 1, Y = 1, Z = 0 };
            var bytes = k.ToByteArray();   // little endian
            for (int i = bytes.Length - 1; i >= 0; i--)
                for (int b = 7; b >= 0; b--)
                {
                    r = Double(r);
                    if (((bytes[i] >> b) & 1) != 0) r = Add(r, p);
                }
            return r;
        }

        public static bool Verify(byte[] qx, byte[] qy, byte[] message, byte[] signature)
        {
            if (signature.Length != 64 || qx.Length != 32 || qy.Length != 32) return false;
            var r = U(signature, 0, 32);
            var s = U(signature, 32, 32);
            if (r.Sign <= 0 || r >= N || s.Sign <= 0 || s >= N) return false;
            var x = U(qx, 0, 32); var y = U(qy, 0, 32);
            // the public key must lie on the curve
            if (Mod(y * y - (x * x * x + A * x + B), P) != 0) return false;
            byte[] hash;
            using (var sha = SHA256.Create()) hash = sha.ComputeHash(message);
            var e = U(hash, 0, 32);
            var w = Inv(s, N);
            var u1 = Mod(e * w, N);
            var u2 = Mod(r * w, N);
            var pt = Add(Mul(new J { X = Gx, Y = Gy, Z = 1 }, u1), Mul(new J { X = x, Y = y, Z = 1 }, u2));
            if (pt.Z.IsZero) return false;
            var zi = Inv(pt.Z, P);
            var ax = Mod(pt.X * zi * zi, P);
            return Mod(ax, N) == r;
        }
    }
}
