# Builds the customer user manual (Arabic and English) as HTML, printed to PDF by Chromium.
import html, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
VERSION = '6.0'

CSS = open(os.path.join(HERE, 'cairo-local.css')).read()

def esc(s): return html.escape(s, quote=False)

# ---------------------------------------------------------------- content
# Each section: (id, title, blocks). Block types:
#   ('p', text) ('ul', [items]) ('ol', [items]) ('table', [header], [[row]...]) ('tip', text) ('warn', text) ('h3', text)
AR = {
 'dir': 'rtl', 'lang': 'ar', 'tipw': 'ملاحظة:', 'warnw': 'تنبيه:',
 'title': 'دليل المستخدم',
 'product': 'التشريح ثلاثي الأبعاد',
 'product2': 'Human Anatomy 3D – نسخة الشاشة والواقع الافتراضي',
 'cover_sub': 'برنامج تعليمي تفاعلي لتشريح جسم الإنسان كاملاً بالأبعاد الثلاثية، على الكمبيوتر والشاشات التفاعلية ونظارات الواقع الافتراضي',
 'version': 'الإصدار ' + VERSION,
 'toc': 'المحتويات',
 'contact': 'الدعم الفني والاشتراكات',
 'page': 'صفحة',
 'sections': [
  ('intro', 'مقدمة', [
    ('p', 'مرحباً بك في برنامج «التشريح ثلاثي الأبعاد» من شركة أصفان. يعرض البرنامج جسم الإنسان كاملاً – للرجل وللمرأة – بأكثر من 2,200 جزء تشريحي حقيقي موزعة على 12 جهازاً، بأسماء ووصف بالعربية والإنجليزية ونطق صوتي عربي للأسماء.'),
    ('ul', ['استكشاف حر للجسم بالفأرة أو اللمس أو نظارة الواقع الافتراضي.',
            'مقاطع تشريحية، وضع الأشعة السينية، تفكيك الأجزاء، ومحاكاة نبض القلب والتنفس وجريان الدم.',
            'مركز تعلّم فيه دروس موجّهة، اختبارات، امتحانات بشهادة PDF، ومتابعة للتقدّم.',
            'وضع المعلّم لإعداد دروس خاصة وعرضها على شاشة الصف.',
            'يعمل دون إنترنت، ويحدّث نفسه تلقائياً عند توفر الإنترنت.']),
    ('fig', [('male', 'جسم الرجل كاملاً'), ('female', 'جسم المرأة كاملاً')]),
  ]),
  ('req', 'متطلبات التشغيل', [
    ('table', ['البند', 'الحد الأدنى', 'الموصى به'], [
      ['نظام التشغيل', 'Windows 10 (64-bit)', 'Windows 11 (64-bit)'],
      ['الذاكرة', '8 GB', '16 GB'],
      ['كرت الشاشة', 'يدعم DirectX 11', 'NVIDIA GTX 1070 / RTX 2060 أو أعلى (للنظارة)'],
      ['المساحة', '2 GB', '4 GB'],
      ['الواقع الافتراضي (اختياري)', 'Meta Quest 2 / 3 / Pro مع كابل Link أو Air Link', 'Quest 3 مع كابل USB-C عالي السرعة'],
    ]),
    ('tip', 'الشاشات التفاعلية (اللمسية) مدعومة بالكامل: التدوير بإصبع واحد والتكبير بإصبعين.'),
  ]),
  ('install', 'التثبيت', [
    ('ol', ['شغّل ملف التثبيت HumanAnatomy3D-VR-Setup.exe بالنقر المزدوج.',
            'إذا ظهرت رسالة ويندوز الزرقاء «Windows protected your PC» اضغط More info ثم Run anyway.',
            'وافق على اتفاقية ترخيص المستخدم واضغط Next حتى ينتهي التثبيت.',
            'يظهر اختصار البرنامج على سطح المكتب وفي قائمة ابدأ باسم Human Anatomy 3D.']),
    ('p', 'لإزالة البرنامج: الإعدادات ← التطبيقات ← Human Anatomy 3D ← إلغاء التثبيت.'),
  ]),
  ('start', 'التشغيل الأول والترخيص', [
    ('h3', 'الفترة التجريبية'),
    ('p', 'عند أول تشغيل تبدأ فترة تجريبية مجانية مدتها 5 أيام بكامل المزايا. يظهر الزر البرتقالي في أعلى الشاشة «نسخة تجريبية · عدد الأيام المتبقية».'),
    ('h3', 'طلب الاشتراك'),
    ('ol', ['اضغط زر الترخيص البرتقالي في الأعلى.',
            'انسخ «معرّف الجهاز» بزر «نسخ» – أو اضغط زر «واتساب» لإرساله مباشرة.',
            'أرسل المعرّف إلى أصفان مع نوع الاشتراك المطلوب (شهري أو سنوي أو ترخيص مؤسسة لعدة أجهزة).',
            'ستصلك رسالة فيها مفتاح ترخيص يبدأ بـ HA3D1- أو ملف بامتداد .lic.']),
    ('h3', 'تفعيل الترخيص'),
    ('ul', ['الطريقة الأسهل: انسخ المفتاح ثم اضغط «لصق المفتاح وتفعيله» في نافذة الترخيص.',
            'أو ألصق المفتاح في الخانة (Ctrl+V) واضغط «تفعيل الترخيص».',
            'أو اضغط «تحميل ملف .lic» واختر الملف الذي وصلك.']),
    ('p', 'بعد التفعيل يظهر «الاشتراك مفعّل ✓» مع اسم المرخّص له وتاريخ الانتهاء والأيام المتبقية. يتحقق البرنامج من الترخيص دون إنترنت.'),
    ('warn', 'المفتاح مرتبط بالجهاز الذي أُرسل معرّفه. عند تغيير الجهاز تواصل معنا للحصول على مفتاح جديد.'),
  ]),
  ('ui', 'واجهة البرنامج', [
    ('p', 'عند فتح البرنامج اختر الجسم: رجل أو امرأة (يمكن التبديل في أي وقت).'),
    ('uifig', 'واجهة البرنامج – الوضع الفاتح مع اختيار عضو من «تصفح الأعضاء»'),
    ('table', ['المنطقة', 'المحتوى'], [
      ['الشريط العلوي', 'الشعار، البحث عن أي عضو، الترخيص، الإعدادات، المساعدة، تكبير/تصغير الخط A+ / A−، تبديل اللغة'],
      ['لوحة الأدوات', 'الجسم (رجل/امرأة)، الأجهزة الـ12 مع شفافية كل جهاز، الأدوات (أشعة، إظهار الكل، النبض، التنفس، جريان الدم، التفكيك)، المقاطع الثلاثة'],
      ['لوحة المعلومات', 'اسم العضو المختار بالعربية والإنجليزية، الجهاز والمنطقة، الوصف، النطق، الإخفاء، العزل، التركيز، المفضلة، ملاحظاتك، وتصفح كل الأعضاء حسب المنطقة'],
      ['الشريط السفلي', 'زوايا العرض (أمامي، خلفي، أيسر، أيمن، علوي)، الدوران، التسميات، صورة، تراجع، إعادة الضبط، اختبار سريع، مركز التعلّم، وضع العرض، الواقع الافتراضي'],
    ], 'numbered'),
  ]),
  ('nav', 'التحكم والتنقل', [
    ('table', ['الحركة', 'بالفأرة', 'باللمس'], [
      ['تدوير الجسم 360°', 'سحب بالزر الأيسر', 'سحب بإصبع واحد'],
      ['تحريك المشهد', 'سحب بالزر الأيمن', 'سحب بإصبعين'],
      ['تكبير / تصغير', 'عجلة الفأرة', 'تقريب أو تبعيد إصبعين'],
      ['اختيار عضو', 'نقرة', 'لمسة'],
      ['التركيز على عضو', 'نقرة مزدوجة', 'لمستان سريعتان'],
      ['إخفاء عضو مباشرة', 'Alt + نقرة', '—'],
    ]),
    ('h3', 'اختصارات لوحة المفاتيح'),
    ('table', ['المفتاح', 'الوظيفة'], [
      ['1 – 5', 'زوايا العرض'], ['R', 'إعادة الضبط'], ['A', 'إظهار الكل'], ['X', 'الأشعة السينية'], ['L', 'التسميات'],
      ['C / B / N', 'مقطع / نبض القلب / التنفس'], ['Delete أو H', 'إخفاء العضو المختار'], ['I / F / S', 'عزل / تركيز / نطق'],
      ['Ctrl+F / Ctrl+Z', 'بحث / تراجع'], ['Q / T / P', 'اختبار سريع / مركز التعلّم / صورة'], ['F11', 'ملء الشاشة'], ['Esc', 'إلغاء الاختيار'],
    ]),
  ]),
  ('explore', 'استكشاف الجسم', [
    ('h3', 'الأجهزة والشفافية'),
    ('p', 'اضغط اسم أي جهاز لإظهاره أو إخفائه، واستخدم الشريط بجانبه لتغيير شفافيته. أزرار «الكل / الأحشاء / الهيكل» تعطي عروضاً جاهزة.'),
    ('h3', 'اختيار عضو والتركيز عليه'),
    ('p', 'عند اختيار عضو يظهر اسمه ووصفه ويُنطق اسمه بالعربية. عند اختياره من «تصفح الأعضاء» أو من البحث يتحول باقي الجسم إلى ظل خفيف ليبقى التركيز على العضو. اضغط مكاناً فارغاً أو Esc للرجوع.'),
    ('h3', 'أدوات العرض'),
    ('ul', ['الأشعة السينية: يجعل الجلد والعضلات شفافة لرؤية ما تحتها.',
            'التفكيك: يباعد الأعضاء عن بعضها تدريجياً.',
            'المقاطع: سهمي (يمين/يسار)، أفقي (أعلى/أسفل)، جبهي (أمام/خلف) مع زر «عكس».',
            'العزل: يُبقي العضو ومجموعته ويخفف الباقي. الإخفاء: يخفي العضو، و«تراجع» يعيده.',
            'التسميات: تكتب أسماء الأعضاء الظاهرة على الشاشة تلقائياً.',
            'صورة: تحفظ صورة للعرض في مجلد الصور ← ASFAN Anatomy.']),
    ('fig', [('xray', 'الأشعة السينية'), ('organs', 'عرض الأحشاء'), ('skeleton', 'الهيكل العظمي'),
             ('explode', 'التفكيك'), ('section', 'مقطع سهمي'), ('female-organs', 'أحشاء جسم المرأة')], 3),
    ('h3', 'محاكاة وظائف الأعضاء'),
    ('ul', ['نبض القلب: انقباض وانبساط القلب بمعدل 72 نبضة في الدقيقة.',
            'التنفس: تمدد الرئتين وحركة الحجاب الحاجز.',
            'جريان الدم: موجات حمراء في الشرايين بعيداً عن القلب، وزرقاء في الأوردة عائدة إليه، مع موجة التوصيل الكهربائي في القلب.']),
    ('fig', [('heart', 'درس «القلب ومسار الدم»: إبراز حجرات القلب'), ('flow', 'محاكاة جريان الدم')]),
  ]),
  ('learn', 'مركز التعلّم', [
    ('p', 'افتحه من زر «مركز التعلّم» في الشريط السفلي. فيه أربعة أقسام:'),
    ('h3', 'الدروس'),
    ('p', 'دروس موجّهة بمستوى مدرسي وجامعي (القلب، الدماغ، التنفس، الهضم، الهيكل، الجهاز اللمفاوي، البولي، العين، الغدد، الجهاز التناسلي الأنثوي، الأطراف، التروية التاجية…). كل خطوة تُبرز الأعضاء المقصودة وتشرحها، مع شرح صوتي اختياري. أزرار «السابق / التالي» للتنقل.'),
    ('h3', 'الاختبار السريع'),
    ('p', 'من زر «اختبار سريع»: «سمِّ الجزء» يضيء عضواً بالأخضر لتختار اسمه، و«أوجد الجزء» يطلب منك الضغط على العضو المطلوب.'),
    ('h3', 'الامتحان الشامل والشهادة'),
    ('ol', ['اكتب اسم الطالب واختر المستوى والأجهزة وعدد الأسئلة والوقت.',
            'يجمع الامتحان أسئلة مفاهيمية وأسئلة تعرّف على الأجزاء ووصفها.',
            'تظهر النتيجة مع الدقة لكل جهاز ومراجعة الأخطاء.',
            'عند النجاح (70% فأكثر) اضغط «شهادة الإتمام» لحفظ شهادة PDF باسم الطالب.']),
    ('h3', 'تقدّمي والمفضلة'),
    ('p', 'يعرض نسبة ما استكشفته من الجسم، الدروس المكتملة، نتائج الامتحانات، والأجهزة التي يُنصح بمراجعتها. قسم المفضلة يجمع الأعضاء المفضلة وملاحظاتك والمناظر المحفوظة.'),
  ]),
  ('teacher', 'وضع المعلّم ووضع العرض', [
    ('ol', ['من مركز التعلّم ← الدروس ← «إنشاء درس».',
            'جهّز المنظر (الأجهزة، الزاوية، العضو المختار، المقطع)، اكتب الشرح واضغط «إضافة المنظر الحالي كخطوة».',
            'كرر لكل خطوة، ثم «تشغيل» للتجربة أو «حفظ الدرس في ملف» لمشاركته مع الطلاب.',
            'لفتح درس محفوظ: «فتح درس من ملف».']),
    ('p', 'وضع العرض يخفي الواجهة ويعرض شرح الخطوة بخط كبير مع أزرار التنقل – مناسب لشاشات الصف والشاشات التفاعلية.'),
  ]),
  ('vr', 'الواقع الافتراضي (Meta Quest)', [
    ('h3', 'التجهيز (مرة واحدة)'),
    ('ol', ['ثبّت تطبيق Meta Quest Link على الكمبيوتر من موقع Meta وسجّل الدخول.',
            'في التطبيق: Settings ← General ← OpenXR Runtime ← Set Meta Quest Link as active.',
            'في نفس الصفحة فعّل Unknown sources.']),
    ('h3', 'الدخول'),
    ('ol', ['وصّل النظارة بالكابل وشغّل Link من داخل النظارة (أو Air Link لاسلكياً).',
            'في البرنامج يظهر بالأسفل «النظارة متصلة وجاهزة» – اضغط «دخول الواقع الافتراضي» وضع النظارة.',
            'للخروج: «الخروج من الواقع الافتراضي» من الشاشة أو من قائمة اليد.']),
    ('h3', 'التحكم داخل النظارة'),
    ('table', ['الزر', 'الوظيفة'], [
      ['الزناد الأيمن', 'اختيار عضو بالليزر – يظهر اسمه بجانب الجسم مع سهم يشير إليه، أو الضغط على أزرار القائمة'],
      ['القبضة (يد واحدة)', 'إمساك الجسم وتحريكه وتدويره'],
      ['القبضتان معاً', 'تكبير / تصغير الجسم وتدويره'],
      ['عصا اليسار', 'المشي'], ['عصا اليمين', 'الالتفاف'],
      ['X', 'إظهار / إخفاء قائمة اليد اليسرى'], ['Y', 'إعادة الجسم لمكانه'],
      ['A', 'نطق اسم العضو'], ['B', 'إخفاء العضو'], ['الضغط على عصا اليمين', 'تثبيت المقطع اليدوي'],
    ]),
    ('p', 'قائمة اليد فيها الأجهزة، رجل/امرأة، الأشعة، النبض، التنفس، جريان الدم، التفكيك، الدروس، المقطع باليد، التكبير والتصغير، واللغة.'),
  ]),
  ('settings', 'الإعدادات والتحديثات', [
    ('ul', ['جودة العرض: عالية، أو منخفضة للأجهزة الضعيفة.',
            'الوضع الفاتح / الداكن، ملء الشاشة، حجم الخط، واللغة.',
            'التحديثات: يتحقق البرنامج تلقائياً عند الفتح، ويعرض نافذة «يتوفر تحديث جديد». اضغط «تحديث الآن» لينزل ويُثبَّت ويُعاد فتح البرنامج. يمكن التحقق يدوياً من «التحقق من وجود تحديث».']),
    ('tip', 'كل التحديثات موقّعة رقمياً من أصفان، ولا يثبّت البرنامج أي ملف غير موقّع.'),
  ]),
  ('trouble', 'حل المشاكل', [
    ('table', ['المشكلة', 'الحل'], [
      ['رسالة «Windows protected your PC»', 'More info ← Run anyway'],
      ['«النظارة غير متصلة» مع أنها موصولة', 'شغّل Link داخل النظارة، وتأكد أن OpenXR Runtime = Meta Quest Link، ثم اضغط «بحث»'],
      ['الصورة بطيئة في النظارة', 'خفّض جودة العرض من الإعدادات، أو Refresh rate إلى 72Hz من تطبيق Link'],
      ['لا يُنطق شرح الدروس بالعربية', 'ثبّت صوتاً عربياً: إعدادات ويندوز ← الوقت واللغة ← الكلام ← إضافة أصوات'],
      ['«هذا المفتاح مخصّص لجهاز آخر»', 'أرسل معرّف الجهاز الحالي لنا للحصول على مفتاح جديد'],
      ['انتهى الاشتراك', 'تواصل معنا للتجديد، ثم فعّل المفتاح الجديد'],
      ['الشريط السفلي مخفي خلف شريط ويندوز', 'اضغط F11 مرتين أو من الإعدادات «ملء الشاشة»'],
    ]),
  ]),
 ],
 'credits': 'النماذج التشريحية: BodyParts3D © The Database Center for Life Science – CC BY 4.0. استخدام البرنامج يخضع لاتفاقية ترخيص المستخدم النهائي (قوانين المملكة الأردنية الهاشمية – محاكم عمّان).',
}

EN = {
 'dir': 'ltr', 'lang': 'en', 'tipw': 'Tip:', 'warnw': 'Important:',
 'title': 'User Manual',
 'product': 'Human Anatomy 3D',
 'product2': 'Desktop, interactive display and virtual reality edition',
 'cover_sub': 'An interactive educational program covering the whole human body in 3D, on computers, interactive displays and virtual-reality headsets',
 'version': 'Version ' + VERSION,
 'toc': 'Contents',
 'contact': 'Support & subscriptions',
 'page': 'Page',
 'sections': [
  ('intro', 'Introduction', [
    ('p', 'Welcome to Human Anatomy 3D by ASFAN. The program shows the complete human body – male and female – with more than 2,200 real anatomical structures in 12 body systems, with names and descriptions in Arabic and English and recorded Arabic pronunciation.'),
    ('ul', ['Free exploration with a mouse, touch or a VR headset.',
            'Cross-sections, X-ray mode, exploded view, and heartbeat, breathing and blood-flow simulations.',
            'A learning centre with guided lessons, quizzes, exams with PDF certificates and progress tracking.',
            'Teacher mode to build your own lessons and present them in class.',
            'Works offline and updates itself automatically when online.']),
    ('fig', [('male', 'The complete male body'), ('female', 'The complete female body')]),
  ]),
  ('req', 'System requirements', [
    ('table', ['Item', 'Minimum', 'Recommended'], [
      ['Operating system', 'Windows 10 (64-bit)', 'Windows 11 (64-bit)'],
      ['Memory', '8 GB', '16 GB'],
      ['Graphics', 'DirectX 11 capable', 'NVIDIA GTX 1070 / RTX 2060 or better (for VR)'],
      ['Disk space', '2 GB', '4 GB'],
      ['Virtual reality (optional)', 'Meta Quest 2 / 3 / Pro with Link cable or Air Link', 'Quest 3 with a high-speed USB-C cable'],
    ]),
    ('tip', 'Interactive (touch) displays are fully supported: one finger rotates, two fingers zoom and pan.'),
  ]),
  ('install', 'Installation', [
    ('ol', ['Double-click HumanAnatomy3D-VR-Setup.exe.',
            'If the blue “Windows protected your PC” message appears, click More info, then Run anyway.',
            'Accept the end-user licence agreement and click Next until the installation finishes.',
            'A Human Anatomy 3D shortcut appears on the desktop and in the Start menu.']),
    ('p', 'To uninstall: Settings → Apps → Human Anatomy 3D → Uninstall.'),
  ]),
  ('start', 'First start & licensing', [
    ('h3', 'Trial period'),
    ('p', 'The first start begins a free 5-day trial with every feature. The orange button at the top shows “Trial · days left”.'),
    ('h3', 'Ordering a subscription'),
    ('ol', ['Click the orange licence button at the top.',
            'Copy the “Machine ID” with the Copy button – or press WhatsApp to send it directly.',
            'Send the ID to ASFAN with the plan you want (monthly, yearly, or an institution licence for several computers).',
            'You receive a licence key starting with HA3D1- or a .lic file.']),
    ('h3', 'Activating'),
    ('ul', ['Easiest: copy the key, then click “Paste key & activate” in the licence window.',
            'Or paste the key into the field (Ctrl+V) and click “Activate license”.',
            'Or click “Load .lic file” and choose the file you received.']),
    ('p', 'Once activated the window shows “Subscription active ✓” with the licensee, expiry date and days left. The licence is checked offline.'),
    ('warn', 'A key is bound to the computer whose ID was sent. If you change computers, contact us for a new key.'),
  ]),
  ('ui', 'The interface', [
    ('p', 'When the program opens, choose the male or female body (you can switch at any time).'),
    ('uifig', 'The interface – light theme with a structure chosen from “Browse structures” (Arabic interface)'),
    ('table', ['Area', 'Contents'], [
      ['Top bar', 'Logo, search for any structure, licence, settings, help, text size A+ / A−, language'],
      ['Tools panel', 'Body (male/female), the 12 systems with an opacity slider each, tools (X-ray, show all, heartbeat, breathing, blood flow, explode) and the three section planes'],
      ['Information panel', 'Name of the selected structure in Arabic and English, system and region, description, pronounce, hide, isolate, focus, favourites, your notes, and a browser of all structures by region'],
      ['Bottom toolbar', 'Views (front, back, left, right, top), rotate, labels, screenshot, undo, reset, quick quiz, learning centre, presentation mode, virtual reality'],
    ], 'numbered'),
  ]),
  ('nav', 'Navigation', [
    ('table', ['Action', 'Mouse', 'Touch'], [
      ['Rotate 360°', 'Left-drag', 'One-finger drag'],
      ['Pan', 'Right-drag', 'Two-finger drag'],
      ['Zoom', 'Mouse wheel', 'Pinch'],
      ['Select a structure', 'Click', 'Tap'],
      ['Focus on a structure', 'Double-click', 'Double tap'],
      ['Hide a structure', 'Alt + click', '—'],
    ]),
    ('h3', 'Keyboard shortcuts'),
    ('table', ['Key', 'Function'], [
      ['1 – 5', 'Preset views'], ['R', 'Reset'], ['A', 'Show all'], ['X', 'X-ray'], ['L', 'Labels'],
      ['C / B / N', 'Section / heartbeat / breathing'], ['Delete or H', 'Hide the selected structure'], ['I / F / S', 'Isolate / focus / speak'],
      ['Ctrl+F / Ctrl+Z', 'Search / undo'], ['Q / T / P', 'Quick quiz / learning centre / screenshot'], ['F11', 'Full screen'], ['Esc', 'Clear the selection'],
    ]),
  ]),
  ('explore', 'Exploring the body', [
    ('h3', 'Systems and opacity'),
    ('p', 'Click a system name to show or hide it, and use the slider next to it to change its opacity. “All / Organs / Skeleton” give ready-made views.'),
    ('h3', 'Selecting and focusing'),
    ('p', 'Selecting a structure shows its name and description and says its name in Arabic. When you pick it from “Browse structures” or the search, the rest of the body turns into a faint shadow so you can concentrate on it. Click an empty spot or press Esc to bring the body back.'),
    ('h3', 'Viewing tools'),
    ('ul', ['X-ray: makes skin and muscles transparent to see what lies beneath.',
            'Explode: gradually moves the structures apart.',
            'Sections: sagittal (left/right), transverse (up/down), coronal (front/back), each with a Flip button.',
            'Isolate keeps the structure and its group and fades the rest. Hide removes a structure; Undo brings it back.',
            'Labels: writes the names of the visible structures on screen automatically.',
            'Screenshot: saves an image in Pictures → ASFAN Anatomy.']),
    ('fig', [('xray', 'X-ray'), ('organs', 'Organs view'), ('skeleton', 'Skeleton'),
             ('explode', 'Exploded view'), ('section', 'Sagittal section'), ('female-organs', 'Female organs')], 3),
    ('h3', 'Physiology'),
    ('ul', ['Heartbeat: the heart contracts and relaxes at 72 beats per minute.',
            'Breathing: the lungs expand and the diaphragm moves.',
            'Blood flow: red waves travel away from the heart in arteries, blue waves back towards it in veins, plus the electrical conduction wave in the heart.']),
    ('fig', [('heart', 'Lesson “The heart and blood flow”: heart chambers highlighted'), ('flow', 'Blood-flow simulation')]),
  ]),
  ('learn', 'Learning centre', [
    ('p', 'Open it with “Learning centre” in the bottom toolbar. It has four tabs:'),
    ('h3', 'Lessons'),
    ('p', 'Guided lessons at school and university level (heart, brain, breathing, digestion, skeleton, lymphatic, urinary, eye, glands, female reproductive system, limbs, coronary circulation…). Each step highlights and explains the structures, with optional narration. Use Previous / Next to move.'),
    ('h3', 'Quick quiz'),
    ('p', 'From “Quick quiz”: “Name it” lights a structure in green for you to name; “Find it” asks you to click the requested structure.'),
    ('h3', 'Comprehensive exam & certificate'),
    ('ol', ['Enter the student name and choose the level, systems, number of questions and time.',
            'The exam mixes conceptual questions with identifying structures and matching descriptions.',
            'The result shows the accuracy per system and a review of wrong answers.',
            'If passed (70% or more) click “Certificate (PDF)” to save a certificate in the student’s name.']),
    ('h3', 'My progress & favourites'),
    ('p', 'Shows how much of the body you have explored, completed lessons, exam results and the systems worth reviewing. Favourites collects your favourite structures, notes and saved views.'),
  ]),
  ('teacher', 'Teacher mode & presentation mode', [
    ('ol', ['Learning centre → Lessons → “New lesson”.',
            'Set up the view (systems, angle, selected structure, section), type the explanation and click “Add current view as a step”.',
            'Repeat for each step, then “Play” to try it or “Save lesson to file” to share it with students.',
            'To open a saved lesson: “Open lesson file”.']),
    ('p', 'Presentation mode hides the interface and shows each step’s explanation in large text with navigation buttons – ideal for classroom screens and interactive displays.'),
  ]),
  ('vr', 'Virtual reality (Meta Quest)', [
    ('h3', 'One-time setup'),
    ('ol', ['Install the Meta Quest Link app on the PC from Meta’s website and sign in.',
            'In the app: Settings → General → OpenXR Runtime → Set Meta Quest Link as active.',
            'On the same page enable Unknown sources.']),
    ('h3', 'Entering VR'),
    ('ol', ['Connect the headset with the cable and start Link inside the headset (or Air Link wirelessly).',
            'The program shows “Headset connected” at the bottom – click “Enter VR” and put the headset on.',
            'To leave: “Exit VR” on the screen or in the hand menu.']),
    ('h3', 'Controls in the headset'),
    ('table', ['Button', 'Function'], [
      ['Right trigger', 'Select a structure with the laser – its name appears beside the body with an arrow pointing to it – or press menu buttons'],
      ['Grip (one hand)', 'Grab, move and turn the body'],
      ['Both grips', 'Scale and rotate the body'],
      ['Left stick', 'Walk'], ['Right stick', 'Turn'],
      ['X', 'Show / hide the left-hand menu'], ['Y', 'Reset the body position'],
      ['A', 'Pronounce the name'], ['B', 'Hide the structure'], ['Right stick press', 'Freeze the hand section'],
    ]),
    ('p', 'The hand menu holds the systems, male/female, X-ray, heartbeat, breathing, blood flow, explode, lessons, hand section, scale and language.'),
  ]),
  ('settings', 'Settings & updates', [
    ('ul', ['Rendering quality: high, or low for older computers.',
            'Light / dark theme, full screen, text size and language.',
            'Updates: the program checks automatically when it opens and shows “A new version is available”. Click “Update now” to download, install and reopen. You can also check manually with “Check for updates”.']),
    ('tip', 'Every update is digitally signed by ASFAN; the program never installs an unsigned file.'),
  ]),
  ('trouble', 'Troubleshooting', [
    ('table', ['Problem', 'Solution'], [
      ['“Windows protected your PC”', 'More info → Run anyway'],
      ['“No headset” although it is connected', 'Start Link inside the headset, make sure OpenXR Runtime = Meta Quest Link, then click Detect'],
      ['Slow image in the headset', 'Lower the rendering quality in Settings, or set the refresh rate to 72 Hz in the Link app'],
      ['Lesson narration is not spoken in Arabic', 'Install an Arabic voice: Windows Settings → Time & Language → Speech → Add voices'],
      ['“This key belongs to another computer”', 'Send us the current machine ID for a new key'],
      ['Subscription expired', 'Contact us to renew, then activate the new key'],
      ['Bottom toolbar hidden behind the taskbar', 'Press F11 twice or use “Full screen” in Settings'],
    ]),
  ]),
 ],
 'credits': 'Anatomical models: BodyParts3D © The Database Center for Life Science – CC BY 4.0. Use of the program is subject to the end-user licence agreement (laws of the Hashemite Kingdom of Jordan – courts of Amman).',
}

def block(b):
    k = b[0]
    if k == 'p': return f'<p>{esc(b[1])}</p>'
    if k == 'h3': return f'<h3>{esc(b[1])}</h3>'
    if k in ('ul', 'ol'): return f'<{k}>' + ''.join(f'<li>{esc(i)}</li>' for i in b[1]) + f'</{k}>'
    if k == 'table':
        head = ''.join(f'<th>{esc(h)}</th>' for h in b[1])
        rows = ''.join('<tr>' + ''.join(f'<td>{esc(c)}</td>' for c in r) + '</tr>' for r in b[2])
        if len(b) > 3 and b[3] == 'numbered':
            rows = ''.join('<tr>' + ''.join((f'<td><span class="pin s">{i+1}</span> {esc(c)}</td>' if j == 0 else f'<td>{esc(c)}</td>') for j, c in enumerate(r)) + '</tr>' for i, r in enumerate(b[2]))
        return f'<table><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>'
    if k == 'fig':
        cols = b[2] if len(b) > 2 else len(b[1])
        items = ''.join(f'<figure><img src="img/{f}.png"><figcaption>{esc(c)}</figcaption></figure>' for f, c in b[1])
        return f'<div class="figs c{cols}">{items}</div>'
    if k == 'uifig':
        pins = [(1, 50, 3), (2, 91, 30), (3, 11, 13), (4, 50, 95)]
        badges = ''.join(f'<span class="pin" style="left:{x}%;top:{y}%">{n}</span>' for n, x, y in pins)
        return f'<figure class="ui"><div class="shot"><img src="img/ui.png">{badges}</div><figcaption>{esc(b[1])}</figcaption></figure>'
    if k == 'tip': return f'<div class="note tip"><b>{CUR["tipw"]}</b> {esc(b[1])}</div>'
    if k == 'warn': return f'<div class="note warn"><b>{CUR["warnw"]}</b> {esc(b[1])}</div>'
    raise ValueError(k)

def page(L):
    global CUR
    CUR = L
    rtl = L['dir'] == 'rtl'
    toc = ''.join(f'<li><a href="#{sid}"><span class="n">{i+1}</span>{esc(t)}</a></li>' for i, (sid, t, _) in enumerate(L['sections']))
    body = ''.join(f'<section id="{sid}"><h2><span class="n">{i+1}</span>{esc(t)}</h2>' + ''.join(block(b) for b in blocks) + '</section>'
                   for i, (sid, t, blocks) in enumerate(L['sections']))
    contact = f'''<div class="contact"><h2>{esc(L['contact'])}</h2>
      <div class="cgrid"><div><span>WhatsApp</span><b dir="ltr">+962 77 614 0404</b></div><div><span>E-mail</span><b>info@asfanco.com</b></div><div><span>ASFAN</span><b>{'عمّان – الأردن' if rtl else 'Amman – Jordan'}</b></div></div></div>'''
    return f'''<!doctype html><html lang="{L['lang']}" dir="{L['dir']}"><head><meta charset="utf-8"><title>{esc(L['product'])} – {esc(L['title'])}</title>
<style>{CSS}
@page {{ size: A4; margin: 16mm 15mm 16mm; }}
:root {{ --teal:#0f9d8a; --navy:#0b2a4a; --blue:#0b5f8a; --ink:#0f172a; --muted:#5b6b7f; --line:#dbe3ec; --soft:#f3f7fb; }}
* {{ box-sizing: border-box; }}
html {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{ margin: 0; font-family: 'Cairo', 'DejaVu Sans', sans-serif; color: var(--ink); font-size: 10.6pt; line-height: 1.75; }}
.cover {{ height: 263mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always;
  background: linear-gradient(160deg, #0b2a4a 0%, #0b5f8a 55%, #0f9d8a 100%); color: #fff; border-radius: 10px; padding: 22mm 18mm; position: relative; overflow: hidden; }}
.cover:before {{ content: ''; position: absolute; width: 150mm; height: 150mm; border-radius: 50%; border: 1.5px solid rgba(255,255,255,.18); {'left' if rtl else 'right'}: -40mm; top: 60mm; }}
.cover:after {{ content: ''; position: absolute; width: 95mm; height: 95mm; border-radius: 50%; border: 1.5px solid rgba(255,255,255,.14); {'left' if rtl else 'right'}: -10mm; top: 88mm; }}
.cover .logo {{ background: #fff; border-radius: 10px; padding: 7px 14px; display: inline-block; }}
.cover .logo img {{ height: 15mm; display: block; }}
.cover .kicker {{ font-weight: 600; letter-spacing: .5px; opacity: .85; font-size: 13pt; margin-top: 30mm; }}
.cover h1 {{ font-size: 34pt; font-weight: 800; margin: 2mm 0 0; line-height: 1.25; }}
.cover .p2 {{ font-size: 13pt; opacity: .9; margin-top: 2mm; }}
.cover .sub {{ font-size: 11.5pt; opacity: .88; max-width: 125mm; margin-top: 10mm; }}
.cover .foot {{ display: flex; justify-content: space-between; align-items: flex-end; font-size: 10pt; opacity: .95; position: relative; z-index: 1; }}
.cover .ver {{ background: rgba(255,255,255,.16); padding: 4px 12px; border-radius: 20px; font-weight: 600; }}
.tocpage {{ page-break-after: always; }}
h2 {{ font-size: 17pt; color: var(--navy); margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 2.5px solid var(--teal); display: flex; align-items: center; gap: 10px; font-weight: 800; }}
h2 .n {{ background: var(--teal); color: #fff; width: 9mm; height: 9mm; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12pt; flex: none; }}
h3 {{ font-size: 12.2pt; color: var(--blue); margin: 5mm 0 1.5mm; font-weight: 700; }}
section {{ margin-bottom: 9mm; }}
section + section {{ page-break-before: auto; }}
#vr, #learn, #nav, #explore {{ page-break-before: always; }}
h2, h3 {{ page-break-after: avoid; break-after: avoid; }}
.figs, figure {{ break-inside: avoid; }}
p {{ margin: 1.5mm 0 2.5mm; }}
ul, ol {{ margin: 1mm 0 3mm; padding-{'right' if rtl else 'left'}: 7mm; }}
li {{ margin: .8mm 0; }}
ol li::marker {{ color: var(--teal); font-weight: 700; }}
ul li::marker {{ color: var(--teal); }}
table {{ width: 100%; border-collapse: separate; border-spacing: 0; margin: 2mm 0 4mm; font-size: 9.8pt; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; page-break-inside: avoid; }}
th {{ background: var(--navy); color: #fff; text-align: start; padding: 2.2mm 3mm; font-weight: 700; }}
td {{ padding: 2mm 3mm; border-top: 1px solid var(--line); vertical-align: top; }}
tbody tr:nth-child(even) td {{ background: var(--soft); }}
td:first-child {{ font-weight: 600; color: var(--navy); white-space: nowrap; }}
.note {{ border-radius: 8px; padding: 3mm 4mm; margin: 3mm 0; font-size: 10pt; page-break-inside: avoid; }}
.tip {{ background: #e8f7f4; border-{'right' if rtl else 'left'}: 4px solid var(--teal); }}
.warn {{ background: #fff4e5; border-{'right' if rtl else 'left'}: 4px solid #e08a1e; }}
.toc h2 {{ margin-top: 4mm; }}
.toc ol {{ list-style: none; padding: 0; columns: 1; }}
.toc li {{ border-bottom: 1px dashed var(--line); padding: 2.4mm 0; font-size: 12pt; }}
.toc a {{ color: var(--ink); text-decoration: none; display: flex; gap: 10px; align-items: center; }}
.toc .n {{ color: #fff; background: var(--blue); width: 7mm; height: 7mm; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: 700; }}
.contact {{ margin-top: 8mm; background: var(--soft); border: 1px solid var(--line); border-radius: 10px; padding: 5mm 6mm; page-break-inside: avoid; }}
.contact h2 {{ border: 0; margin: 0 0 3mm; font-size: 14pt; }}
.cgrid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }}
.cgrid div {{ background: #fff; border-radius: 8px; padding: 3mm 4mm; border: 1px solid var(--line); }}
.cgrid span {{ display: block; font-size: 9pt; color: var(--muted); }}
.cgrid b {{ font-size: 11pt; color: var(--navy); }}
.figs {{ display: grid; gap: 4mm; margin: 3mm 0 5mm; page-break-inside: avoid; }}
.figs.c2 {{ grid-template-columns: 1fr 1fr; }} .figs.c3 {{ grid-template-columns: 1fr 1fr 1fr; }} .figs.c1 {{ grid-template-columns: 1fr; }}
figure {{ margin: 0; page-break-inside: avoid; }}
figure img {{ width: 100%; display: block; border-radius: 8px; border: 1px solid var(--line); background: #0b1220; }}
.figs.c3 img {{ height: 62mm; object-fit: cover; }} .figs.c2 img {{ height: 80mm; object-fit: cover; }}
figcaption {{ font-size: 9pt; color: var(--muted); text-align: center; margin-top: 1.2mm; }}
figure.ui {{ margin: 3mm 0 4mm; }}
.shot {{ position: relative; }}
.shot img {{ background: #fff; }}
.pin {{ position: absolute; transform: translate(-50%, -50%); width: 8mm; height: 8mm; border-radius: 50%; background: #e0452e; color: #fff; font-weight: 800; font-size: 11pt; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,.35); }}
.pin.s {{ position: static; transform: none; width: 6mm; height: 6mm; font-size: 9pt; box-shadow: none; margin-inline-end: 1.5mm; vertical-align: middle; }}
.credits {{ font-size: 8.6pt; color: var(--muted); margin-top: 6mm; }}
</style></head><body>
<div class="cover">
  <div><div class="logo"><img src="logo.png"></div>
    <div class="kicker">{esc(L['title'])}</div>
    <h1>{esc(L['product'])}</h1>
    <div class="p2">{esc(L['product2'])}</div>
    <div class="sub">{esc(L['cover_sub'])}</div></div>
  <div class="foot"><span class="ver">{esc(L['version'])}</span><span dir="ltr">ASFAN · info@asfanco.com · +962 77 614 0404</span></div>
</div>
<div class="tocpage toc"><h2>{esc(L['toc'])}</h2><ol>{toc}</ol>{contact}</div>
{body}
{contact}
<p class="credits">{esc(L['credits'])}</p>
</body></html>'''

for L, name in ((AR, 'ar'), (EN, 'en')):
    open(os.path.join(HERE, f'manual-{name}.html'), 'w', encoding='utf-8').write(page(L))
print('ok')
