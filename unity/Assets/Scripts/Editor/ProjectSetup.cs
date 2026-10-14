using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEditor.XR.Management;
using UnityEditor.XR.Management.Metadata;
using UnityEditor.XR.OpenXR.Features;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.XR.Management;

namespace Asfan.Anatomy.EditorTools
{
    /// <summary>
    /// One-click project configuration: player settings, OpenXR for PC VR (Quest Link),
    /// the main scene and the voice recordings. Runs automatically the first time the
    /// project is opened and can be re-run from Tools > ASFAN Anatomy > Setup Project.
    /// </summary>
    [InitializeOnLoad]
    public static class ProjectSetup
    {
        const string Marker = "ProjectSettings/AsfanAnatomySetup.txt";
        const string ScenePath = "Assets/Scenes/Main.unity";
        public const string AppVersion = "6.0.0";

        static ProjectSetup()
        {
            if (!File.Exists(Marker)) EditorApplication.delayCall += () => { if (!EditorApplication.isPlayingOrWillChangePlaymode) Run(); };
        }

        [MenuItem("Tools/ASFAN Anatomy/Setup Project", priority = 1)]
        public static void Run()
        {
            var log = new System.Text.StringBuilder();
            Step(log, "Player settings", PlayerSetup);
            Step(log, "XR (OpenXR + Oculus Touch)", XRSetup);
            Step(log, "Main scene", SceneSetup);
            Step(log, "Voice recordings", CopyVoice);
            File.WriteAllText(Marker, "ASFAN Human Anatomy 3D project setup completed.\n" + log);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log("[ASFAN Anatomy] Setup finished:\n" + log);
            EditorUtility.DisplayDialog("ASFAN Human Anatomy 3D", "Setup finished:\n\n" + log + "\nPress Play to run the program.", "OK");
        }

        static void Step(System.Text.StringBuilder log, string name, System.Func<string> action)
        {
            try { log.AppendLine("✔ " + name + ": " + action()); }
            catch (System.Exception e)
            {
                log.AppendLine("✖ " + name + ": " + e.Message + "  (see the manual steps in unity/README.md)");
                Debug.LogException(e);
            }
        }

        static string PlayerSetup()
        {
            PlayerSettings.companyName = "ASFAN";
            PlayerSettings.productName = "Human Anatomy 3D";
            PlayerSettings.bundleVersion = AppVersion;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.runInBackground = true;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.fullScreenMode = FullScreenMode.FullScreenWindow;
            PlayerSettings.defaultScreenWidth = 1600;
            PlayerSettings.defaultScreenHeight = 900;
            var icon = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Icon/asfan-icon.png");
            if (icon) PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { icon }, IconKind.Any);
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.StandaloneWindows64)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Standalone, BuildTarget.StandaloneWindows64);
            return "company ASFAN, linear colour, Windows 64-bit";
        }

        static string XRSetup()
        {
            const BuildTargetGroup group = BuildTargetGroup.Standalone;
            // same steps as XR Plug-in Management's own settings page
            if (!EditorBuildSettings.TryGetConfigObject(XRGeneralSettings.k_SettingsKey, out XRGeneralSettingsPerBuildTarget perTarget) || perTarget == null)
            {
                var guids = AssetDatabase.FindAssets("t:XRGeneralSettingsPerBuildTarget");
                if (guids.Length > 0) perTarget = AssetDatabase.LoadAssetAtPath<XRGeneralSettingsPerBuildTarget>(AssetDatabase.GUIDToAssetPath(guids[0]));
                if (perTarget == null)
                {
                    if (!AssetDatabase.IsValidFolder("Assets/XR")) AssetDatabase.CreateFolder("Assets", "XR");
                    perTarget = ScriptableObject.CreateInstance<XRGeneralSettingsPerBuildTarget>();
                    AssetDatabase.CreateAsset(perTarget, "Assets/XR/XRGeneralSettingsPerBuildTarget.asset");
                    AssetDatabase.SaveAssets();
                }
                EditorBuildSettings.AddConfigObject(XRGeneralSettings.k_SettingsKey, perTarget, true);
            }
            if (!perTarget.HasManagerSettingsForBuildTarget(group)) perTarget.CreateDefaultManagerSettingsForBuildTarget(group);
            var general = perTarget.SettingsForBuildTarget(group);
            // the program starts on the desktop and switches to the headset on request
            general.InitManagerOnStart = false;
            EditorUtility.SetDirty(general);
            var manager = general.Manager;
            if (!XRPackageMetadataStore.AssignLoader(manager, "UnityEngine.XR.OpenXR.OpenXRLoader", group))
                throw new System.Exception("could not assign the OpenXR loader");
            EditorUtility.SetDirty(manager);

            // each eye in its own pass: reliable with the built-in render pipeline on PC VR runtimes
            var openxr = UnityEngine.XR.OpenXR.OpenXRSettings.GetSettingsForBuildTargetGroup(group);
            if (openxr != null) { openxr.renderMode = UnityEngine.XR.OpenXR.OpenXRSettings.RenderMode.MultiPass; EditorUtility.SetDirty(openxr); }

            FeatureHelpers.RefreshFeatures(group);
            int enabled = 0;
            foreach (var id in new[] { "com.unity.openxr.feature.input.oculustouch", "com.unity.openxr.feature.input.metaquestplus" })
            {
                var f = FeatureHelpers.GetFeatureWithIdForBuildTarget(group, id);
                if (f != null) { f.enabled = true; EditorUtility.SetDirty(f); enabled++; }
            }
            AssetDatabase.SaveAssets();
            return $"OpenXR loader on Windows, start on demand, {enabled} controller profile(s) enabled";
        }

        static string SceneSetup()
        {
            if (!AssetDatabase.IsValidFolder("Assets/Scenes")) AssetDatabase.CreateFolder("Assets", "Scenes");
            if (!File.Exists(ScenePath))
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                var cam = new GameObject("Desktop Camera");
                cam.tag = "MainCamera";
                var c = cam.AddComponent<Camera>();
                c.clearFlags = CameraClearFlags.SolidColor;
                c.backgroundColor = new Color(0.045f, 0.07f, 0.11f);
                cam.AddComponent<AudioListener>();
                cam.transform.position = new Vector3(0, 1, -3.2f);
                new GameObject("Anatomy App").AddComponent<AnatomyApp>();
                EditorSceneManager.SaveScene(scene, ScenePath);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            if (SceneManager.GetActiveScene().path != ScenePath) EditorSceneManager.OpenScene(ScenePath);
            return ScenePath;
        }

        static string CopyVoice()
        {
            var src = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "src", "assets", "voice"));
            var dst = Path.Combine(Application.dataPath, "StreamingAssets", "voice");
            if (!Directory.Exists(src)) return "source folder not found (" + src + "), names will not be spoken";
            Directory.CreateDirectory(dst);
            int n = 0;
            foreach (var f in Directory.GetFiles(src, "*.mp3"))
            {
                var to = Path.Combine(dst, Path.GetFileName(f));
                if (!File.Exists(to)) { File.Copy(f, to); n++; }
            }
            return $"{Directory.GetFiles(dst, "*.mp3").Length} clips ({n} copied now)";
        }

        [MenuItem("Tools/ASFAN Anatomy/Build Windows Program", priority = 20)]
        public static void BuildWindows() => Build(false);

        [MenuItem("Tools/ASFAN Anatomy/Build Windows Program (IL2CPP - protected code)", priority = 21)]
        public static void BuildWindowsIl2cpp() => Build(true);

        static string BuildsDir => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Builds"));

        /// <summary>
        /// Builds HumanAnatomy3D.exe into unity/Builds/HumanAnatomy3D and, when Inno Setup 6 is installed,
        /// the installer unity/Builds/Installer/HumanAnatomy3D-VR-Setup-x.y.z.exe.
        /// IL2CPP compiles the C# code to native code (harder to reverse engineer); it needs the
        /// "Windows Build Support (IL2CPP)" module and Visual Studio with "Desktop development with C++".
        /// </summary>
        static void Build(bool il2cpp)
        {
            if (!File.Exists(Marker)) Run();
            CopyVoice();
            // the program reports Application.version to the updater: it must always match AppVersion
            PlayerSettings.bundleVersion = AppVersion;
            AssetDatabase.SaveAssets();
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Standalone, il2cpp ? ScriptingImplementation.IL2CPP : ScriptingImplementation.Mono2x);
            var dir = Path.Combine(BuildsDir, "HumanAnatomy3D");
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
            Directory.CreateDirectory(dir);
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = Path.Combine(dir, "HumanAnatomy3D.exe"),
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None
            });
            var result = report.summary.result;
            Debug.Log("[ASFAN Anatomy] Build " + result + " -> " + dir + " (" + (report.summary.totalSize / 1048576) + " MB)");
            if (result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                EditorUtility.DisplayDialog("ASFAN Human Anatomy 3D", "Build " + result + ". See the Console window for the errors.", "OK");
                return;
            }
            var installer = MakeInstaller(dir);
            EditorUtility.DisplayDialog("ASFAN Human Anatomy 3D",
                "Build succeeded:\n" + Path.Combine(dir, "HumanAnatomy3D.exe") + "\n\n" +
                (installer != null ? "Installer:\n" + installer : "Inno Setup 6 was not found, so no installer was made.\nInstall it from https://jrsoftware.org/isdl.php and build again, or ship the whole folder."), "OK");
            EditorUtility.RevealInFinder(installer ?? Path.Combine(dir, "HumanAnatomy3D.exe"));
        }

        static string MakeInstaller(string buildDir)
        {
            string iscc = null;
            foreach (var p in new[] {
                System.Environment.GetEnvironmentVariable("ProgramFiles(x86)") + @"\Inno Setup 6\ISCC.exe",
                System.Environment.GetEnvironmentVariable("ProgramFiles") + @"\Inno Setup 6\ISCC.exe",
                System.Environment.GetEnvironmentVariable("LOCALAPPDATA") + @"\Programs\Inno Setup 6\ISCC.exe" })
                if (!string.IsNullOrEmpty(p) && File.Exists(p)) { iscc = p; break; }
            if (iscc == null) return null;
            var iss = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Installer", "HumanAnatomy3D.iss"));
            EditorUtility.DisplayProgressBar("ASFAN Human Anatomy 3D", "Creating the installer…", 0.5f);
            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo(iscc, "/Q \"/DSourceDir=" + buildDir + "\" \"/DAppVersion=" + AppVersion + "\" \"" + iss + "\"")
                { UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true };
                using (var proc = System.Diagnostics.Process.Start(psi))
                {
                    var err = proc.StandardError.ReadToEnd();
                    proc.WaitForExit();
                    if (proc.ExitCode != 0) { Debug.LogError("[ASFAN Anatomy] Inno Setup failed: " + err); return null; }
                }
            }
            finally { EditorUtility.ClearProgressBar(); }
            var setup = Path.Combine(BuildsDir, "Installer", "HumanAnatomy3D-VR-Setup-" + AppVersion + ".exe");
            return File.Exists(setup) ? setup : null;
        }
    }
}
