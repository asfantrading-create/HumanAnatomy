using System.Collections.Generic;

namespace Asfan.Anatomy
{
    /// <summary>Interface strings in Arabic and English.</summary>
    public static class L
    {
        public static bool Ar = true;

        static readonly Dictionary<string, string[]> S = new Dictionary<string, string[]>
        {
            ["title"] = new[] { "تشريح جسم الإنسان ثلاثي الأبعاد", "Human Anatomy 3D" },
            ["loading"] = new[] { "جارٍ تحميل النموذج التشريحي…", "Loading the anatomical model…" },
            ["missing"] = new[] { "ملف النموذج غير موجود في StreamingAssets. شغّل أداة التصدير أولاً.", "Model file not found in StreamingAssets. Run the exporter first." },
            ["systems"] = new[] { "الأجهزة", "Systems" },
            ["body"] = new[] { "الجسم", "Body" },
            ["male"] = new[] { "رجل", "Male" },
            ["female"] = new[] { "امرأة", "Female" },
            ["tools"] = new[] { "الأدوات", "Tools" },
            ["xray"] = new[] { "أشعة سينية", "X-ray" },
            ["explode"] = new[] { "تفكيك", "Explode" },
            ["section"] = new[] { "المقاطع", "Sections" },
            ["secX"] = new[] { "سهمي (يمين/يسار)", "Sagittal (L/R)" },
            ["secY"] = new[] { "أفقي (أعلى/أسفل)", "Transverse (up/down)" },
            ["secZ"] = new[] { "جبهي (أمام/خلف)", "Coronal (front/back)" },
            ["flip"] = new[] { "عكس", "Flip" },
            ["heart"] = new[] { "نبض القلب", "Heartbeat" },
            ["breath"] = new[] { "التنفس", "Breathing" },
            ["flow"] = new[] { "جريان الدم", "Blood flow" },
            ["showAll"] = new[] { "إظهار الكل", "Show all" },
            ["resetView"] = new[] { "إعادة العرض", "Reset view" },
            ["theme"] = new[] { "الوضع الفاتح/الداكن", "Light/Dark" },
            ["lang"] = new[] { "English", "العربية" },
            ["info"] = new[] { "معلومات العضو", "Structure" },
            ["noSel"] = new[] { "انقر على أي جزء من الجسم لعرض اسمه ووصفه.", "Click any part of the body to see its name and description." },
            ["speak"] = new[] { "نطق الاسم", "Pronounce" },
            ["hide"] = new[] { "إخفاء", "Hide" },
            ["isolate"] = new[] { "عزل", "Isolate" },
            ["focus"] = new[] { "تكبير عليه", "Focus" },
            ["browse"] = new[] { "تصفح الأعضاء", "Browse structures" },
            ["system"] = new[] { "الجهاز", "System" },
            ["region"] = new[] { "المنطقة", "Region" },
            ["vrEnter"] = new[] { "دخول الواقع الافتراضي", "Enter VR" },
            ["vrNone"] = new[] { "النظارة غير متصلة", "No headset" },
            ["vrSearching"] = new[] { "جارٍ البحث عن النظارة…", "Looking for headset…" },
            ["vrReady"] = new[] { "النظارة متصلة وجاهزة", "Headset connected" },
            ["vrRetry"] = new[] { "بحث", "Detect" },
            ["vrStarting"] = new[] { "جارٍ التشغيل على النظارة…", "Starting in the headset…" },
            ["vrRunning"] = new[] { "البرنامج يعمل الآن على النظارة. ضع النظارة للتجول حول الجسم.", "The program is running in the headset. Put it on to walk around the body." },
            ["vrExit"] = new[] { "الخروج من الواقع الافتراضي", "Exit VR" },
            ["vrHelp"] = new[] {
                "الزناد: اختيار عضو   •   القبضة: إمساك الجسم وتحريكه (بيدين للتكبير والتدوير)\nعصا اليسار: المشي   •   عصا اليمين: الالتفاف   •   X: القائمة   •   A: نطق الاسم   •   B: إخفاء العضو",
                "Trigger: select   •   Grip: grab the body (two hands to scale/rotate)\nLeft stick: walk   •   Right stick: turn   •   X: menu   •   A: pronounce   •   B: hide part" },
            ["vrFailed"] = new[] { "تعذّر تشغيل الواقع الافتراضي. تأكد من تشغيل Quest Link وأن Meta هو بيئة OpenXR الافتراضية.", "Could not start VR. Make sure Quest Link is running and Meta is the active OpenXR runtime." },
            ["vrSection"] = new[] { "مقطع باليد", "Hand section" },
            ["vrFreeze"] = new[] { "تثبيت المقطع", "Freeze section" },
            ["vrResetBody"] = new[] { "إعادة الجسم", "Reset body" },
            ["vrScaleUp"] = new[] { "تكبير +", "Larger +" },
            ["vrScaleDown"] = new[] { "تصغير −", "Smaller −" },
            ["footer"] = new[] { "© ASFAN — عمّان، الأردن   |   واتساب +962776140404   |   info@asfanco.com   |   النماذج: BodyParts3D © DBCLS (CC BY 4.0)",
                                 "© ASFAN — Amman, Jordan   |   WhatsApp +962776140404   |   info@asfanco.com   |   Models: BodyParts3D © DBCLS (CC BY 4.0)" },
            ["hint"] = new[] { "زر الفأرة الأيسر: تدوير   •   الأيمن: تحريك   •   العجلة: تكبير   •   نقرة مزدوجة: تركيز", "Left mouse: rotate   •   Right: pan   •   Wheel: zoom   •   Double-click: focus" },
        };

        public static string T(string key) => S.TryGetValue(key, out var v) ? v[Ar ? 0 : 1] : key;

        // regions / organ groups (same keys as the desktop application)
        static readonly Dictionary<string, string[]> G = new Dictionary<string, string[]>
        {
            ["frontal lobe"] = new[] { "الفص الجبهي", "Frontal lobe" }, ["parietal lobe"] = new[] { "الفص الجداري", "Parietal lobe" },
            ["temporal lobe"] = new[] { "الفص الصدغي", "Temporal lobe" }, ["occipital lobe"] = new[] { "الفص القذالي", "Occipital lobe" },
            ["limbic lobe"] = new[] { "الفص الحوفي", "Limbic lobe" }, ["insula"] = new[] { "الفص الجزيري", "Insula" },
            ["cerebellum"] = new[] { "المخيخ", "Cerebellum" }, ["brainstem"] = new[] { "جذع الدماغ", "Brainstem" },
            ["diencephalon"] = new[] { "الدماغ البيني", "Diencephalon" }, ["brain"] = new[] { "الدماغ (أخرى)", "Brain (other)" },
            ["heart"] = new[] { "القلب", "Heart" }, ["lung"] = new[] { "الرئتان", "Lungs" }, ["liver"] = new[] { "الكبد", "Liver" },
            ["skull"] = new[] { "الجمجمة", "Skull" }, ["vertebral column"] = new[] { "العمود الفقري", "Vertebral column" },
            ["rib cage"] = new[] { "القفص الصدري", "Rib cage" }, ["small intestine"] = new[] { "الأمعاء الدقيقة", "Small intestine" },
            ["large intestine"] = new[] { "الأمعاء الغليظة", "Large intestine" }, ["stomach"] = new[] { "المعدة", "Stomach" },
            ["pancreas"] = new[] { "البنكرياس", "Pancreas" }, ["larynx"] = new[] { "الحنجرة", "Larynx" }, ["mouth"] = new[] { "الفم", "Mouth" },
            ["nose"] = new[] { "الأنف", "Nose" }, ["eye"] = new[] { "العين", "Eye" }, ["teeth"] = new[] { "الأسنان", "Teeth" },
            ["head"] = new[] { "الرأس والوجه", "Head & face" }, ["neck"] = new[] { "العنق", "Neck" }, ["thorax"] = new[] { "الصدر", "Thorax" },
            ["abdomen"] = new[] { "البطن", "Abdomen" }, ["pelvis"] = new[] { "الحوض والعجان", "Pelvis & perineum" },
            ["upper limb"] = new[] { "الطرف العلوي", "Upper limb" }, ["lower limb"] = new[] { "الطرف السفلي", "Lower limb" },
            ["lymph"] = new[] { "العقد والقنوات اللمفاوية", "Lymph nodes & ducts" },
        };
        public static readonly string[] GroupOrder =
        {
            "head", "skull", "eye", "nose", "mouth", "teeth", "frontal lobe", "parietal lobe", "temporal lobe", "occipital lobe", "limbic lobe",
            "insula", "diencephalon", "brainstem", "cerebellum", "brain", "neck", "larynx", "thorax", "rib cage", "heart", "lung",
            "abdomen", "stomach", "liver", "pancreas", "small intestine", "large intestine", "vertebral column", "pelvis",
            "upper limb", "lower limb", "lymph"
        };
        public static string Group(string key) => G.TryGetValue(key, out var v) ? v[Ar ? 0 : 1] : key;
    }
}
