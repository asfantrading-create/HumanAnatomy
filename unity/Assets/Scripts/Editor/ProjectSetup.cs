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
        public static void BuildWindows()
        {
            if (!File.Exists(Marker)) Run();
            var dir = EditorUtility.SaveFolderPanel("Output folder", Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Builds")), "HumanAnatomy3D");
            if (string.IsNullOrEmpty(dir)) return;
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = Path.Combine(dir, "HumanAnatomy3D.exe"),
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None
            });
            Debug.Log("[ASFAN Anatomy] Build " + report.summary.result + " -> " + dir);
            if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded) EditorUtility.RevealInFinder(Path.Combine(dir, "HumanAnatomy3D.exe"));
        }
    }
}
