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
            ["undo"] = new[] { "تراجع", "Undo" },
            ["shotSaved"] = new[] { "تم حفظ الصورة في: {path}", "Screenshot saved to: {path}" },
            ["certSaved"] = new[] { "تم حفظ الشهادة في: {path}", "Certificate saved to: {path}" },
            ["certFailed"] = new[] { "تعذّر حفظ الشهادة.", "Could not save the certificate." },
            ["lessonSaved"] = new[] { "تم حفظ الدرس في: {path}", "Lesson saved to: {path}" },
            ["openFolder"] = new[] { "فتح المجلد", "Open folder" },
            ["lessonsIn"] = new[] { "ملفات الدروس المحفوظة في: {dir}", "Lesson files in: {dir}" },
            ["browseFile"] = new[] { "استعراض…", "Browse…" },
            ["noFiles"] = new[] { "لا توجد ملفات دروس في هذا المجلد بعد.", "There are no lesson files in this folder yet." },
            ["fav"] = new[] { "إضافة للمفضلة", "Add to favourites" },
            ["unfav"] = new[] { "في المفضلة ✓", "In favourites ✓" },
            ["version"] = new[] { "الإصدار", "Version" },
            ["aboutText"] = new[] { "برنامج تعليمي تفاعلي لتشريح جسم الإنسان كاملاً بالأبعاد الثلاثية، على الشاشة وبنظارات الواقع الافتراضي، من شركة أصفان – عمّان، الأردن.",
                                    "An interactive 3D anatomy program for the whole human body, on screen and in VR headsets, by ASFAN – Amman, Jordan." },
            ["vrLocked"] = new[] { "فعّل الترخيص لاستخدام الواقع الافتراضي", "Activate a licence to use VR" },
            ["fullscreen"] = new[] { "ملء الشاشة", "Full screen" },
            ["needSystems"] = new[] { "اختر جهازاً واحداً على الأقل.", "Choose at least one system." },
            ["vrControls"] = new[] { "التحكم في النظارة", "VR controls" },
            ["learnBtn"] = new[] { "مركز التعلّم", "Learning centre" },
            ["quizBtn"] = new[] { "اختبار سريع", "Quick quiz" },
            ["licenseBtn"] = new[] { "الترخيص", "Licence" },
            ["trialChip"] = new[] { "نسخة تجريبية · {d} يوم", "Trial · {d} days" },
            ["activeChip"] = new[] { "الترخيص مفعّل", "Licensed" },
            ["presets"] = new[] { "عرض سريع", "Presets" },
            ["remove"] = new[] { "حذف", "Delete" },
            ["timeLeft"] = new[] { "الوقت المتبقي {t}", "Time left {t}" },
            ["contactWa"] = new[] { "واتساب", "WhatsApp" },
            ["contactMail"] = new[] { "البريد الإلكتروني", "E-mail" },
            ["licLocked"] = new[] { "انتهت الفترة التجريبية. أدخل مفتاح الترخيص للمتابعة.", "The trial has ended. Enter a licence key to continue." },
            ["quitApp"] = new[] { "إغلاق البرنامج", "Quit" },
            ["updAvail"] = new[] { "يتوفر تحديث جديد للبرنامج – الإصدار {v}", "A new version of the program is available – version {v}" },
            ["updCurrent"] = new[] { "الإصدار المثبّت لديك: {v}", "Installed version: {v}" },
            ["updWhatsNew"] = new[] { "ما الجديد", "What's new" },
            ["updNow"] = new[] { "تحديث الآن", "Update now" },
            ["updLater"] = new[] { "لاحقاً", "Later" },
            ["updSize"] = new[] { "حجم التنزيل: {mb} ميغابايت", "Download size: {mb} MB" },
            ["updMandatory"] = new[] { "هذا التحديث ضروري لمتابعة استخدام البرنامج.", "This update is required to keep using the program." },
            ["updDownloading"] = new[] { "جارٍ تنزيل التحديث… {p}%", "Downloading the update… {p}%" },
            ["updInstalling"] = new[] { "تم التحقق من التحديث. سيُغلق البرنامج الآن ويُثبَّت الإصدار الجديد ثم يُفتح تلقائياً.", "The update was verified. The program will close, install the new version and open again." },
            ["updBad"] = new[] { "ملف التحديث غير سليم ولم يُثبَّت. حاول مرة أخرى لاحقاً.", "The update file is damaged and was not installed. Please try again later." },
            ["licPaste"] = new[] { "لصق المفتاح وتفعيله", "Paste key & activate" },
            ["licClipEmpty"] = new[] { "لا يوجد مفتاح منسوخ. انسخ المفتاح أولاً ثم اضغط «لصق المفتاح وتفعيله».", "Nothing has been copied. Copy the key first, then press “Paste key & activate”." },
            ["hint"] = new[] { "زر الفأرة الأيسر: تدوير   •   الأيمن: تحريك   •   العجلة: تكبير   •   نقرة مزدوجة: تركيز", "Left mouse: rotate   •   Right: pan   •   Wheel: zoom   •   Double-click: focus" },
        };

        /// <summary>Interface string; falls back to the desktop edition's strings (learning.dat). Variables: T("score", "s", 3, "t", 5).</summary>
        public static string T(string key, params object[] vars)
        {
            string s;
            if (S.TryGetValue(key, out var v)) s = v[Ar ? 0 : 1];
            else if (LearningData.Strings[Ar ? 0 : 1].TryGetValue(key, out var w)) s = w;
            else return key;
            for (int i = 0; i + 1 < vars.Length; i += 2) s = s.Replace("{" + vars[i] + "}", System.Convert.ToString(vars[i + 1], System.Globalization.CultureInfo.InvariantCulture));
            return Clean(s);
        }

        /// <summary>Removes markup and characters the legacy text renderer cannot draw (colour emoji, direction marks).</summary>
        public static string Clean(string s)
        {
            if (string.IsNullOrEmpty(s)) return s ?? "";
            s = s.Replace("<br>", "\n").Replace("<b>", "").Replace("</b>", "").Replace("✅", "✓").Replace("❌", "✗").Replace("\u200e", "").Replace("\u200f", "");
            var sb = new System.Text.StringBuilder(s.Length);
            for (int i = 0; i < s.Length; i++)
            {
                char c = s[i];
                if (char.IsHighSurrogate(c)) { i++; continue; }      // emoji outside the BMP
                if (c == '\ufe0f') continue;
                sb.Append(c);
            }
            return sb.ToString().Trim();
        }

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
