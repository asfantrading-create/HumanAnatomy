using System;
using System.IO;
using System.Runtime.InteropServices;
using UnityEngine;

namespace Asfan.Anatomy
{
    /// <summary>Native Windows open/save dialogs (comdlg32). Returns null when cancelled or unavailable.</summary>
    public static class FileDialogs
    {
        /// <summary>Documents\ASFAN Anatomy\&lt;sub&gt; (created on demand).</summary>
        public static string Folder(string sub)
        {
            var root = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            if (string.IsNullOrEmpty(root)) root = Application.persistentDataPath;
            var dir = Path.Combine(root, "ASFAN Anatomy", sub);
            try { Directory.CreateDirectory(dir); } catch { }
            return dir;
        }

        public static void Reveal(string path)
        {
            try
            {
                if (Application.platform == RuntimePlatform.WindowsPlayer || Application.platform == RuntimePlatform.WindowsEditor)
                    System.Diagnostics.Process.Start("explorer.exe", File.Exists(path) ? "/select,\"" + path + "\"" : "\"" + path + "\"");
                else Application.OpenURL("file://" + (File.Exists(path) ? Path.GetDirectoryName(path) : path));
            }
            catch { }
        }

        public static void OpenFile(string path)
        {
            try { Application.OpenURL("file:///" + path.Replace('\\', '/').TrimStart('/')); } catch { }
        }

#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        class OpenFileName
        {
            public int lStructSize = Marshal.SizeOf(typeof(OpenFileName));
            public IntPtr hwndOwner = IntPtr.Zero;
            public IntPtr hInstance = IntPtr.Zero;
            public string lpstrFilter;
            public string lpstrCustomFilter;
            public int nMaxCustFilter;
            public int nFilterIndex;
            public string lpstrFile;
            public int nMaxFile;
            public string lpstrFileTitle;
            public int nMaxFileTitle;
            public string lpstrInitialDir;
            public string lpstrTitle;
            public int Flags;
            public short nFileOffset;
            public short nFileExtension;
            public string lpstrDefExt;
            public IntPtr lCustData = IntPtr.Zero;
            public IntPtr lpfnHook = IntPtr.Zero;
            public string lpTemplateName;
            public IntPtr pvReserved = IntPtr.Zero;
            public int dwReserved;
            public int FlagsEx;
        }
        [DllImport("comdlg32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool GetOpenFileName([In, Out] OpenFileName ofn);
        [DllImport("comdlg32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool GetSaveFileName([In, Out] OpenFileName ofn);
        [DllImport("user32.dll")] static extern IntPtr GetActiveWindow();

        const int OFN_FILEMUSTEXIST = 0x1000, OFN_PATHMUSTEXIST = 0x800, OFN_OVERWRITEPROMPT = 0x2, OFN_NOCHANGEDIR = 0x8, OFN_EXPLORER = 0x80000;

        static string Run(bool save, string title, string filter, string dir, string defName, string defExt)
        {
            try
            {
                var o = new OpenFileName
                {
                    hwndOwner = GetActiveWindow(),
                    lpstrFilter = filter.Replace('|', '\0') + "\0",
                    lpstrFile = (defName ?? "") + new string('\0', 1024),
                    lpstrFileTitle = new string('\0', 256),
                    lpstrInitialDir = dir,
                    lpstrTitle = title,
                    lpstrDefExt = defExt,
                    Flags = OFN_EXPLORER | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR | (save ? OFN_OVERWRITEPROMPT : OFN_FILEMUSTEXIST)
                };
                o.nMaxFile = o.lpstrFile.Length;
                o.nMaxFileTitle = o.lpstrFileTitle.Length;
                bool ok = save ? GetSaveFileName(o) : GetOpenFileName(o);
                if (!ok) return null;
                var f = o.lpstrFile;
                int z = f.IndexOf('\0');
                return z >= 0 ? f.Substring(0, z) : f;
            }
            catch (Exception e) { Debug.LogWarning("File dialog unavailable: " + e.Message); return null; }
        }
        public static bool Available => true;
#else
        static string Run(bool save, string title, string filter, string dir, string defName, string defExt) => null;
        public static bool Available => false;
#endif

        /// <param name="filter">"Lessons|*.ha3d.json;*.json|All files|*.*"</param>
        public static string Open(string title, string filter, string dir) => Run(false, title, filter, dir, null, null);
        public static string Save(string title, string filter, string dir, string defName, string defExt) => Run(true, title, filter, dir, defName, defExt);
    }
}
