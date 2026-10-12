using System;
using System.Collections.Generic;
using System.Text;

namespace Asfan.Anatomy
{
    /// <summary>
    /// Minimal Arabic text shaping for Unity's legacy text renderer, which draws characters
    /// left to right without joining: letters are replaced by their presentation forms
    /// (isolated / final / initial / medial, lam-alef ligatures) and each line is reordered
    /// for display while runs of Latin letters and digits keep their direction.
    /// </summary>
    public static class ArabicShaper
    {
        // isolated, final, initial, medial (0 = form does not exist) for U+0621..U+064A
        static readonly ushort[,] Forms =
        {
            { 0xFE80, 0, 0, 0 },                     // 0621 hamza
            { 0xFE81, 0xFE82, 0, 0 },                // 0622 alef madda
            { 0xFE83, 0xFE84, 0, 0 },                // 0623 alef hamza above
            { 0xFE85, 0xFE86, 0, 0 },                // 0624 waw hamza
            { 0xFE87, 0xFE88, 0, 0 },                // 0625 alef hamza below
            { 0xFE89, 0xFE8A, 0xFE8B, 0xFE8C },      // 0626 yeh hamza
            { 0xFE8D, 0xFE8E, 0, 0 },                // 0627 alef
            { 0xFE8F, 0xFE90, 0xFE91, 0xFE92 },      // 0628 beh
            { 0xFE93, 0xFE94, 0, 0 },                // 0629 teh marbuta
            { 0xFE95, 0xFE96, 0xFE97, 0xFE98 },      // 062A teh
            { 0xFE99, 0xFE9A, 0xFE9B, 0xFE9C },      // 062B theh
            { 0xFE9D, 0xFE9E, 0xFE9F, 0xFEA0 },      // 062C jeem
            { 0xFEA1, 0xFEA2, 0xFEA3, 0xFEA4 },      // 062D hah
            { 0xFEA5, 0xFEA6, 0xFEA7, 0xFEA8 },      // 062E khah
            { 0xFEA9, 0xFEAA, 0, 0 },                // 062F dal
            { 0xFEAB, 0xFEAC, 0, 0 },                // 0630 thal
            { 0xFEAD, 0xFEAE, 0, 0 },                // 0631 reh
            { 0xFEAF, 0xFEB0, 0, 0 },                // 0632 zain
            { 0xFEB1, 0xFEB2, 0xFEB3, 0xFEB4 },      // 0633 seen
            { 0xFEB5, 0xFEB6, 0xFEB7, 0xFEB8 },      // 0634 sheen
            { 0xFEB9, 0xFEBA, 0xFEBB, 0xFEBC },      // 0635 sad
            { 0xFEBD, 0xFEBE, 0xFEBF, 0xFEC0 },      // 0636 dad
            { 0xFEC1, 0xFEC2, 0xFEC3, 0xFEC4 },      // 0637 tah
            { 0xFEC5, 0xFEC6, 0xFEC7, 0xFEC8 },      // 0638 zah
            { 0xFEC9, 0xFECA, 0xFECB, 0xFECC },      // 0639 ain
            { 0xFECD, 0xFECE, 0xFECF, 0xFED0 },      // 063A ghain
            { 0, 0, 0, 0 }, { 0, 0, 0, 0 }, { 0, 0, 0, 0 }, { 0, 0, 0, 0 }, { 0, 0, 0, 0 }, // 063B..063F
            { 0x0640, 0x0640, 0x0640, 0x0640 },      // 0640 tatweel
            { 0xFED1, 0xFED2, 0xFED3, 0xFED4 },      // 0641 feh
            { 0xFED5, 0xFED6, 0xFED7, 0xFED8 },      // 0642 qaf
            { 0xFED9, 0xFEDA, 0xFEDB, 0xFEDC },      // 0643 kaf
            { 0xFEDD, 0xFEDE, 0xFEDF, 0xFEE0 },      // 0644 lam
            { 0xFEE1, 0xFEE2, 0xFEE3, 0xFEE4 },      // 0645 meem
            { 0xFEE5, 0xFEE6, 0xFEE7, 0xFEE8 },      // 0646 noon
            { 0xFEE9, 0xFEEA, 0xFEEB, 0xFEEC },      // 0647 heh
            { 0xFEED, 0xFEEE, 0, 0 },                // 0648 waw
            { 0xFEEF, 0xFEF0, 0, 0 },                // 0649 alef maksura
            { 0xFEF1, 0xFEF2, 0xFEF3, 0xFEF4 },      // 064A yeh
        };

        static bool IsLetter(char c) => c >= 0x0621 && c <= 0x064A && Forms[c - 0x0621, 0] != 0;
        static bool IsMark(char c) => (c >= 0x064B && c <= 0x065F) || c == 0x0670;
        static bool JoinsForward(char c) => IsLetter(c) && Forms[c - 0x0621, 2] != 0;

        public static bool HasArabic(string s)
        {
            if (string.IsNullOrEmpty(s)) return false;
            foreach (char c in s) if ((c >= 0x0600 && c <= 0x06FF) || (c >= 0xFB50 && c <= 0xFEFF)) return true;
            return false;
        }

        /// <summary>Replaces letters by their contextual presentation forms (logical order is kept).</summary>
        public static string Shape(string s)
        {
            var src = new StringBuilder(s.Length);
            foreach (char c in s) if (!IsMark(c)) src.Append(c);   // diacritics cannot be positioned by the legacy renderer
            var t = src.ToString();
            var sb = new StringBuilder(t.Length);
            for (int i = 0; i < t.Length; i++)
            {
                char c = t[i];
                if (!IsLetter(c)) { sb.Append(c); continue; }
                bool prev = i > 0 && JoinsForward(t[i - 1]);
                char next = i + 1 < t.Length ? t[i + 1] : '\0';
                if (c == 0x0644 && (next == 0x0622 || next == 0x0623 || next == 0x0625 || next == 0x0627))
                {
                    int lig = next == 0x0622 ? 0xFEF5 : next == 0x0623 ? 0xFEF7 : next == 0x0625 ? 0xFEF9 : 0xFEFB;
                    sb.Append((char)(prev ? lig + 1 : lig));
                    i++;
                    continue;
                }
                bool nxt = JoinsForward(c) && IsLetter(next);
                int k = c - 0x0621;
                ushort form;
                if (prev && nxt && Forms[k, 3] != 0) form = Forms[k, 3];
                else if (prev && Forms[k, 1] != 0) form = Forms[k, 1];
                else if (nxt && Forms[k, 2] != 0) form = Forms[k, 2];
                else form = Forms[k, 0];
                sb.Append((char)form);
            }
            return sb.ToString();
        }

        static bool IsLtr(char c) => (c < 0x0590 && char.IsLetterOrDigit(c)) || (c >= 0x2070 && c <= 0x209F);
        static bool IsWeak(char c) => c == ' ' || c == '.' || c == ',' || c == '-' || c == '/' || c == ':' || c == '%' || c == '+' || c == '\'';

        static char Mirror(char c)
        {
            switch (c)
            {
                case '(': return ')';
                case ')': return '(';
                case '[': return ']';
                case ']': return '[';
                case '{': return '}';
                case '}': return '{';
                case '<': return '>';
                case '>': return '<';
                case '«': return '»';
                case '»': return '«';
                default: return c;
            }
        }

        /// <summary>Converts one shaped logical line into left-to-right display order.</summary>
        public static string Visual(string line)
        {
            var a = line.ToCharArray();
            Array.Reverse(a);
            // restore the direction of Latin/number runs (weak characters between two strong ones join the run)
            int i = 0;
            while (i < a.Length)
            {
                if (!IsLtr(a[i])) { a[i] = Mirror(a[i]); i++; continue; }
                int j = i, last = i;
                while (j < a.Length && (IsLtr(a[j]) || IsWeak(a[j]))) { if (IsLtr(a[j])) last = j; j++; }
                if (last + 1 < a.Length && a[last + 1] == '+') last++;   // a leading plus sign of a phone number
                Array.Reverse(a, i, last - i + 1);
                i = last + 1;
            }
            return new string(a);
        }

        /// <summary>Shapes and reorders text, wrapping it to <paramref name="width"/> with <paramref name="measure"/>.</summary>
        public static string Display(string logical, float width, Func<string, float> measure)
        {
            if (!HasArabic(logical)) return logical;
            var outLines = new List<string>();
            foreach (var para in logical.Replace("\r", "").Split('\n'))
            {
                var shaped = Shape(para);
                if (width <= 1 || measure == null) { outLines.Add(Visual(shaped)); continue; }
                var words = shaped.Split(' ');
                var line = new StringBuilder();
                foreach (var w in words)
                {
                    string candidate = line.Length == 0 ? w : line + " " + w;
                    if (line.Length > 0 && measure(candidate) > width)
                    {
                        outLines.Add(Visual(line.ToString()));
                        line.Clear();
                        line.Append(w);
                    }
                    else { line.Clear(); line.Append(candidate); }
                }
                outLines.Add(Visual(line.ToString()));
            }
            return string.Join("\n", outLines);
        }
    }
}
