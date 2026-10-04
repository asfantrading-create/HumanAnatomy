// UI strings in Arabic and English.
export const STRINGS = {
  ar: {
    appTitle: 'التشريح ثلاثي الأبعاد', loading: 'جارٍ تحميل النماذج التشريحية...', loadError: 'حدث خطأ أثناء التحميل: ',
    search: 'ابحث عن عضو أو عظمة أو عضلة... (Ctrl+F)', noResults: 'لا توجد نتائج',
    front: 'أمامي', back: 'خلفي', left: 'أيسر', right: 'أيمن', top: 'علوي',
    systems: 'أجهزة الجسم', all: 'الكل', organs: 'الأحشاء', skeleton: 'الهيكل', parts: 'الأجزاء', partsCount: '{n} جزءاً',
    focus: 'تركيز', isolate: 'عزل', hide: 'إخفاء', speak: 'نطق', close: 'إغلاق',
    reset: 'إعادة الضبط', showAll: 'إظهار الكل', xray: 'أشعة', rotate: 'دوران', explode: 'تفكيك', labels: 'التسميات',
    section: 'مقطع', heartbeat: 'نبض القلب', breathing: 'التنفس', tours: 'دروس', quiz: 'اختبار', shot: 'صورة', help: 'مساعدة',
    sectionTitle: 'المقاطع التشريحية', sagittal: 'سهمي (يمين/يسار)', coronal: 'إكليلي (أمام/خلف)', transverse: 'مستعرض (أعلى/أسفل)', flip: 'عكس',
    quizTitle: 'اختبر معلوماتك', quizName: 'ما اسم الجزء المضيء باللون الأخضر؟', quizFind: 'انقر على: {name}', modeName: 'سمِّ الجزء', modeFind: 'أوجد الجزء',
    correct: '✅ إجابة صحيحة! أحسنت', wrong: '❌ الإجابة الصحيحة: {name}', wrongFind: '❌ هذا {got}. الجزء المطلوب مضاء الآن.', score: 'النتيجة: {s} / {t}', next: 'التالي', needMore: 'أظهر مزيداً من الأجهزة لبدء الاختبار.',
    toursTitle: 'الدروس التفاعلية', step: 'الخطوة {i} من {n}', prev: 'السابق', finish: 'إنهاء',
    autoSpeak: 'نطق تلقائي عند التحديد', voiceMissing: 'لا يتوفر صوت عربي على هذا الجهاز؛ ثبّت حزمة اللغة العربية في إعدادات ويندوز (الوقت واللغة > الكلام).',
    helpTitle: 'طريقة الاستخدام', aboutTitle: 'حول البرنامج', license: 'الترخيص',
    licTitle: 'تفعيل الاشتراك', licKey: 'مفتاح الترخيص', licActivate: 'تفعيل', licTrial: 'متبقٍ من الفترة التجريبية: {d} يوم', licActive: 'الاشتراك مفعّل ✓', licExpired: 'انتهت الفترة التجريبية. يرجى الاشتراك للمتابعة.', licBuy: 'اشترك الآن', licChecking: 'جارٍ التحقق...', licInvalid: 'المفتاح غير صالح أو الاشتراك منتهٍ.', licDeactivate: 'إلغاء التفعيل على هذا الجهاز',
    lang: 'English', group_other: 'أخرى',
    help: [
      ['الزر الأيسر + سحب', 'تدوير النموذج'], ['الزر الأيمن + سحب', 'تحريك العرض'], ['العجلة', 'تكبير وتصغير'],
      ['نقرة / نقرة مزدوجة', 'تحديد الجزء / التركيز عليه'], ['Alt + نقرة', 'إخفاء الجزء مباشرة'],
      ['1 - 5', 'زوايا العرض'], ['R / A / X / L', 'إعادة الضبط / إظهار الكل / أشعة / تسميات'],
      ['C / B / N', 'مقطع / نبض / تنفس'], ['Delete / I / F / S', 'إخفاء / عزل / تركيز / نطق'],
      ['Ctrl+F / Ctrl+Z', 'بحث / تراجع'], ['Q / T / P / F11', 'اختبار / دروس / صورة / ملء الشاشة']
    ]
  },
  en: {
    appTitle: 'Human Anatomy 3D', loading: 'Loading anatomical models...', loadError: 'Failed to load: ',
    search: 'Search an organ, bone or muscle... (Ctrl+F)', noResults: 'No results',
    front: 'Front', back: 'Back', left: 'Left', right: 'Right', top: 'Top',
    systems: 'Body systems', all: 'All', organs: 'Organs', skeleton: 'Skeleton', parts: 'Structures', partsCount: '{n} structures',
    focus: 'Focus', isolate: 'Isolate', hide: 'Hide', speak: 'Speak', close: 'Close',
    reset: 'Reset', showAll: 'Show all', xray: 'X-ray', rotate: 'Rotate', explode: 'Explode', labels: 'Labels',
    section: 'Section', heartbeat: 'Heartbeat', breathing: 'Breathing', tours: 'Lessons', quiz: 'Quiz', shot: 'Screenshot', help: 'Help',
    sectionTitle: 'Anatomical sections', sagittal: 'Sagittal (left/right)', coronal: 'Coronal (front/back)', transverse: 'Transverse (up/down)', flip: 'Flip',
    quizTitle: 'Test yourself', quizName: 'What is the structure highlighted in green?', quizFind: 'Click on: {name}', modeName: 'Name it', modeFind: 'Find it',
    correct: '✅ Correct! Well done', wrong: '❌ Correct answer: {name}', wrongFind: '❌ That is {got}. The target is now highlighted.', score: 'Score: {s} / {t}', next: 'Next', needMore: 'Show more systems to start the quiz.',
    toursTitle: 'Interactive lessons', step: 'Step {i} of {n}', prev: 'Previous', finish: 'Finish',
    autoSpeak: 'Speak names automatically', voiceMissing: 'No voice is installed for this language. Add one in Windows Settings > Time & Language > Speech.',
    helpTitle: 'How to use', aboutTitle: 'About', license: 'License',
    licTitle: 'Activate subscription', licKey: 'License key', licActivate: 'Activate', licTrial: 'Trial days left: {d}', licActive: 'Subscription active ✓', licExpired: 'Your trial has ended. Please subscribe to continue.', licBuy: 'Subscribe now', licChecking: 'Checking...', licInvalid: 'Invalid key or expired subscription.', licDeactivate: 'Deactivate on this computer',
    lang: 'العربية', group_other: 'Other',
    help: [
      ['Left drag', 'Rotate'], ['Right drag', 'Pan'], ['Wheel', 'Zoom'],
      ['Click / double-click', 'Select / focus a structure'], ['Alt + click', 'Hide a structure'],
      ['1 - 5', 'Preset views'], ['R / A / X / L', 'Reset / show all / X-ray / labels'],
      ['C / B / N', 'Section / heartbeat / breathing'], ['Delete / I / F / S', 'Hide / isolate / focus / speak'],
      ['Ctrl+F / Ctrl+Z', 'Search / undo'], ['Q / T / P / F11', 'Quiz / lessons / screenshot / full screen']
    ]
  }
};

// Sub-groups shown inside each system in the structures tree.
export const GROUPS = {
  'frontal lobe': ['الفص الجبهي', 'Frontal lobe'], 'parietal lobe': ['الفص الجداري', 'Parietal lobe'],
  'temporal lobe': ['الفص الصدغي', 'Temporal lobe'], 'occipital lobe': ['الفص القذالي', 'Occipital lobe'],
  'limbic lobe': ['الفص الحوفي', 'Limbic lobe'], insula: ['الفص الجزيري', 'Insula'], cerebellum: ['المخيخ', 'Cerebellum'],
  brainstem: ['جذع الدماغ', 'Brainstem'], diencephalon: ['الدماغ البيني', 'Diencephalon'], brain: ['الدماغ (أخرى)', 'Brain (other)'],
  heart: ['القلب', 'Heart'], lung: ['الرئتان', 'Lungs'], liver: ['الكبد', 'Liver'], skull: ['الجمجمة', 'Skull'],
  'vertebral column': ['العمود الفقري', 'Vertebral column'], 'rib cage': ['القفص الصدري', 'Rib cage'],
  'small intestine': ['الأمعاء الدقيقة', 'Small intestine'], 'large intestine': ['الأمعاء الغليظة', 'Large intestine'],
  stomach: ['المعدة', 'Stomach'], pancreas: ['البنكرياس', 'Pancreas'], larynx: ['الحنجرة', 'Larynx'], mouth: ['الفم', 'Mouth'],
  nose: ['الأنف', 'Nose'], eye: ['العين', 'Eye'], teeth: ['الأسنان', 'Teeth'],
  head: ['الرأس والوجه', 'Head & face'], neck: ['العنق', 'Neck'], thorax: ['الصدر', 'Thorax'], abdomen: ['البطن', 'Abdomen'],
  pelvis: ['الحوض والعجان', 'Pelvis & perineum'], 'upper limb': ['الطرف العلوي', 'Upper limb'], 'lower limb': ['الطرف السفلي', 'Lower limb'],
  lymph: ['العقد والقنوات اللمفاوية', 'Lymph nodes & ducts']
};
