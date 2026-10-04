// Guided lessons: each step selects structures (matched on English name) and explains them.
export const TOURS = [
  {
    id: 'heart', level: 'school', ar: 'القلب ومسار الدم', en: 'The heart and blood flow', systems: ['circulatory'],
    steps: [
      { match: /^(wall of|cavity of) (left|right) (atrium|ventricle)|^wall of ventricle/i, ar: 'يتكون القلب من أربع حجرات: أذينان في الأعلى يستقبلان الدم، وبطينان في الأسفل يضخانه. جدار البطين الأيسر هو الأسمك لأنه يضخ الدم إلى الجسم كله.', en: 'The heart has four chambers: two atria above that receive blood and two ventricles below that pump it. The left ventricle has the thickest wall because it pumps blood to the whole body.' },
      { match: /vena cava/i, ar: 'يعود الدم الفقير بالأكسجين من الجسم عبر الوريدين الأجوفين العلوي والسفلي إلى الأذين الأيمن.', en: 'Oxygen-poor blood returns from the body through the superior and inferior venae cavae into the right atrium.' },
      { match: /tricuspid|pulmonary valve|cusp of pulmonary/i, ar: 'يمر الدم من الأذين الأيمن عبر الصمام ثلاثي الشرف إلى البطين الأيمن، ثم عبر الصمام الرئوي إلى الشريان الرئوي.', en: 'Blood passes through the tricuspid valve into the right ventricle, then through the pulmonary valve into the pulmonary trunk.' },
      { match: /pulmonary (trunk|artery)|^(left|right) pulmonary artery/i, ar: 'تحمل الشرايين الرئوية الدم إلى الرئتين ليتخلص من ثاني أكسيد الكربون ويتشبع بالأكسجين.', en: 'The pulmonary arteries carry blood to the lungs, where it releases carbon dioxide and picks up oxygen.' },
      { match: /pulmonary vein/i, ar: 'تعيد الأوردة الرئوية الدم المؤكسج إلى الأذين الأيسر، وهي الأوردة الوحيدة التي تحمل دماً غنياً بالأكسجين.', en: 'The pulmonary veins return oxygenated blood to the left atrium; they are the only veins carrying oxygen-rich blood.' },
      { match: /mitral|cusp of aortic valve/i, ar: 'يعبر الدم الصمام التاجي إلى البطين الأيسر، ثم يُضخ عبر الصمام الأبهري إلى الأبهر.', en: 'Blood crosses the mitral valve into the left ventricle and is pumped through the aortic valve into the aorta.' },
      { match: /aorta|arch of aorta/i, ar: 'الأبهر أكبر شريان في الجسم، ومنه تتفرع كل الشرايين التي توصل الدم المؤكسج إلى الأعضاء.', en: 'The aorta is the largest artery; all systemic arteries branch from it to deliver oxygenated blood to the organs.' },
      { match: /coronary artery|branch of (left|right) coronary/i, ar: 'الشرايين التاجية تغذي عضلة القلب نفسها، وانسدادها يسبب الذبحة الصدرية أو الجلطة القلبية.', en: 'The coronary arteries supply the heart muscle itself; their blockage causes angina or a heart attack.' }
    ]
  },
  {
    id: 'brain', level: 'school', ar: 'فصوص الدماغ ووظائفها', en: 'Lobes of the brain', systems: ['nervous'],
    steps: [
      { group: 'frontal lobe', ar: 'الفص الجبهي: مركز التفكير والتخطيط واتخاذ القرار والشخصية، ويحتوي على القشرة الحركية (التلفيف أمام المركزي) ومنطقة بروكا للكلام.', en: 'Frontal lobe: reasoning, planning, decisions and personality; it contains the motor cortex (precentral gyrus) and Broca\'s speech area.' },
      { group: 'parietal lobe', ar: 'الفص الجداري: يستقبل الإحساس باللمس والحرارة والألم ووضع الجسم (التلفيف خلف المركزي)، ويدمج المعلومات المكانية.', en: 'Parietal lobe: touch, temperature, pain and body position (postcentral gyrus), and spatial integration.' },
      { group: 'temporal lobe', ar: 'الفص الصدغي: السمع وفهم اللغة (منطقة فيرنيكه) والذاكرة.', en: 'Temporal lobe: hearing, language comprehension (Wernicke\'s area) and memory.' },
      { group: 'occipital lobe', ar: 'الفص القذالي: مركز الرؤية الذي يحلل الإشارات القادمة من العينين.', en: 'Occipital lobe: the visual centre that processes signals from the eyes.' },
      { group: 'limbic lobe', ar: 'الجهاز الحوفي: العواطف والذاكرة والسلوك.', en: 'Limbic lobe: emotion, memory and behaviour.' },
      { group: 'cerebellum', ar: 'المخيخ: تنسيق الحركة والتوازن وتعلم المهارات الحركية.', en: 'Cerebellum: coordination, balance and motor learning.' },
      { group: 'brainstem', ar: 'جذع الدماغ: يتحكم في التنفس ونبض القلب وضغط الدم، ومنه تخرج معظم الأعصاب القحفية.', en: 'Brainstem: controls breathing, heart rate and blood pressure; most cranial nerves arise here.' }
    ]
  },
  {
    id: 'breathing', level: 'school', ar: 'رحلة الهواء في الجهاز التنفسي', en: 'The path of air', systems: ['respiratory', 'skeletal'],
    steps: [
      { match: /^(thyroid cartilage|cricoid cartilage|epiglottis|(left|right) arytenoid cartilage)$/i, ar: 'الحنجرة: تحمي مجرى الهواء وتحتوي على الحبال الصوتية. يغلق لسان المزمار مدخلها أثناء البلع.', en: 'Larynx: protects the airway and houses the vocal folds; the epiglottis closes it during swallowing.' },
      { match: /^trachea$/i, ar: 'القصبة الهوائية: أنبوب تدعمه حلقات غضروفية على شكل حرف C يمنع انخماصه.', en: 'Trachea: a tube held open by C-shaped cartilage rings.' },
      { match: /main bronchus/i, ar: 'تنقسم القصبة إلى شعبتين رئيسيتين. اليمنى أعرض وأكثر عمودية، لذلك تدخلها الأجسام الغريبة غالباً.', en: 'The trachea divides into two main bronchi; the right is wider and more vertical, so inhaled objects usually enter it.' },
      { match: /bronchial tree/i, ar: 'تتفرع الشعب إلى شجيرات قطعية لكل قطعة رئوية، وتنتهي بالحويصلات الهوائية حيث يتم تبادل الغازات.', en: 'The bronchi branch into segmental trees for each bronchopulmonary segment, ending in alveoli where gas exchange occurs.' },
      { match: /lobe of (left|right) lung/i, ar: 'للرئة اليمنى ثلاثة فصوص، ولليسرى فصان فقط لإفساح المجال للقلب.', en: 'The right lung has three lobes and the left only two, making room for the heart.' },
      { match: /^diaphragm$/i, ar: 'الحجاب الحاجز: العضلة الرئيسية للتنفس. ينقبض فينخفض ويتسع الصدر (شهيق)، ويرتخي فيرتفع (زفير). شغّل زر "التنفس" لرؤية ذلك.', en: 'Diaphragm: the main breathing muscle; it contracts and descends (inspiration) and relaxes upward (expiration). Turn on "Breathing" to see it.' }
    ]
  },
  {
    id: 'digestion', level: 'school', ar: 'رحلة الطعام في الجهاز الهضمي', en: 'The journey of food', systems: ['digestive'],
    steps: [
      { match: /tooth|^tongue$/i, ar: 'يبدأ الهضم في الفم: تقطع الأسنان الطعام وتطحنه، ويخلطه اللسان باللعاب.', en: 'Digestion starts in the mouth: teeth cut and grind food while the tongue mixes it with saliva.' },
      { match: /^esophagus$/i, ar: 'المريء: يدفع اللقمة إلى المعدة بحركات تمعجية.', en: 'Esophagus: carries the bolus to the stomach by peristalsis.' },
      { match: /^stomach$/i, ar: 'المعدة: تخلط الطعام بالحمض والإنزيمات وتحوله إلى كيموس.', en: 'Stomach: mixes food with acid and enzymes into chyme.' },
      { match: /duodenum|jejunum|ileum/i, ar: 'الأمعاء الدقيقة: يكتمل فيها الهضم ويتم امتصاص معظم المواد الغذائية.', en: 'Small intestine: digestion is completed and most nutrients are absorbed.' },
      { match: /hepatovenous segment|caudate lobe of liver|gallbladder/i, ar: 'الكبد والمرارة: ينتج الكبد العصارة الصفراوية التي تخزنها المرارة لهضم الدهون.', en: 'Liver and gallbladder: the liver makes bile, stored in the gallbladder, to digest fats.' },
      { match: /^pancreas$|head of pancreas|body of pancreas|tail of pancreas/i, ar: 'البنكرياس: يفرز إنزيمات هاضمة قوية، والإنسولين لتنظيم السكر.', en: 'Pancreas: secretes powerful digestive enzymes and insulin.' },
      { match: /colon|cecum|rectum|appendix/i, ar: 'الأمعاء الغليظة: تمتص الماء والأملاح وتكوّن البراز.', en: 'Large intestine: absorbs water and salts and forms faeces.' }
    ]
  },
  {
    id: 'skeleton', level: 'school', ar: 'الهيكل العظمي الأساسي', en: 'Main bones of the skeleton', systems: ['skeletal'],
    steps: [
      { group: 'skull', ar: 'الجمجمة: تحمي الدماغ وتتكون من عظام قحفية ووجهية ملتحمة بدروز.', en: 'Skull: protects the brain; cranial and facial bones joined by sutures.' },
      { group: 'vertebral column', ar: 'العمود الفقري: 7 فقرات عنقية و12 صدرية و5 قطنية، ثم العجز والعصعص، ويحمي الحبل الشوكي.', en: 'Vertebral column: 7 cervical, 12 thoracic and 5 lumbar vertebrae plus sacrum and coccyx; it protects the spinal cord.' },
      { group: 'rib cage', ar: 'القفص الصدري: 12 زوجاً من الأضلاع مع القص، يحمي القلب والرئتين ويشارك في التنفس.', en: 'Rib cage: 12 pairs of ribs and the sternum protect the heart and lungs and move with breathing.' },
      { match: /^(left|right) (humerus|radius|ulna)$/i, ar: 'عظام الطرف العلوي: العضد في الذراع، والكعبرة والزند في الساعد.', en: 'Upper limb bones: humerus in the arm, radius and ulna in the forearm.' },
      { match: /^(left|right) (hip bone|femur|patella|tibia|fibula)$/i, ar: 'عظام الطرف السفلي: عظم الورك، والفخذ أطول عظام الجسم، والرضفة، والظنبوب والشظية.', en: 'Lower limb bones: hip bone, femur (the longest bone), patella, tibia and fibula.' }
    ]
  },
  {
    id: 'lymph', level: 'school', ar: 'الجهاز اللمفاوي والمناعة', en: 'Lymphatic system and immunity', systems: ['lymphatic', 'circulatory'],
    steps: [
      { match: /cervical lymph|axillary lymph|inguinal lymph/i, ar: 'العقد اللمفاوية محطات ترشيح للّمف، تحتوي على خلايا مناعية تلتقط الجراثيم، وتتضخم عند الالتهاب.', en: 'Lymph nodes filter lymph; their immune cells trap microbes and they swell during infection.' },
      { match: /thoracic duct/i, ar: 'القناة الصدرية تجمع اللمف من معظم الجسم وتعيده إلى الدم عند الزاوية الوريدية اليسرى.', en: 'The thoracic duct collects lymph from most of the body and returns it to the blood at the left venous angle.' },
      { match: /^spleen$/i, ar: 'الطحال أكبر عضو لمفاوي، يرشح الدم ويزيل الكريات الحمراء الهرمة.', en: 'The spleen is the largest lymphoid organ; it filters blood and removes old red cells.' },
      { match: /thymus/i, ar: 'الغدة الزعترية مكان نضوج الخلايا التائية، وتكون كبيرة في الطفولة.', en: 'The thymus is where T cells mature; it is large in childhood.' }
    ]
  },
  {
    id: 'urinary', level: 'school', ar: 'الجهاز البولي وتنقية الدم', en: 'The urinary system', systems: ['urinary', 'circulatory', 'skeletal'],
    steps: [
      { match: /^(left|right) kidney$/i, ar: 'الكليتان تقعان خلف البطن على جانبي العمود الفقري، وترشحان نحو 180 لتراً من الدم يومياً.', en: 'The kidneys lie behind the abdomen on either side of the spine and filter about 180 litres of blood a day.' },
      { match: /^(left|right) renal (artery|vein)$/i, ar: 'يحمل الشريان الكلوي الدم من الأبهر إلى الكلية، ويعيد الوريد الكلوي الدم المنقّى إلى الوريد الأجوف السفلي.', en: 'The renal artery brings blood from the aorta; the renal vein returns filtered blood to the inferior vena cava.' },
      { match: /^(left|right) ureter$/i, ar: 'ينقل الحالبان البول من الكليتين إلى المثانة بحركات تمعجية، وقد تنحشر فيهما الحصوات فتسبب المغص الكلوي.', en: 'The ureters carry urine to the bladder by peristalsis; stones lodging here cause renal colic.' },
      { match: /^urinary bladder$/i, ar: 'المثانة كيس عضلي مرن يخزن البول حتى 400-600 مل.', en: 'The bladder is an elastic muscular sac storing 400-600 ml of urine.' },
      { match: /^urethra$/i, ar: 'الإحليل ينقل البول إلى خارج الجسم، وتتحكم فيه عاصرة إرادية.', en: 'The urethra carries urine out of the body and is controlled by a voluntary sphincter.' }
    ]
  },
  {
    id: 'eye', level: 'school', ar: 'العين وكيف نرى', en: 'The eye and vision', systems: ['sensory', 'nervous', 'skeletal'],
    steps: [
      { match: /^(left|right) cornea$/i, ar: 'القرنية نافذة شفافة في مقدمة العين، تكسر الضوء وتوجهه إلى الداخل.', en: 'The cornea is the clear front window of the eye that bends incoming light.' },
      { match: /^(left|right) iris$/i, ar: 'القزحية هي الجزء الملوّن، وتتحكم في حجم الحدقة وكمية الضوء الداخل.', en: 'The iris is the coloured part that controls the size of the pupil.' },
      { match: /^(left|right) lens$/i, ar: 'العدسة تغيّر شكلها لتركيز الصورة على الشبكية، وعتامتها تسمى الساد (الماء الأبيض).', en: 'The lens changes shape to focus the image on the retina; its clouding is a cataract.' },
      { match: /retina/i, ar: 'الشبكية تحتوي على العصي والمخاريط التي تحول الضوء إلى إشارات عصبية.', en: 'The retina contains rods and cones that turn light into nerve signals.' },
      { match: /^(left|right) optic nerve$/i, ar: 'العصب البصري ينقل الإشارات إلى الدماغ، حيث تُحلَّل في الفص القذالي.', en: 'The optic nerve carries the signals to the brain, where the occipital lobe interprets them.' },
      { match: /^(left|right) (superior|inferior|medial|lateral) rectus$|^(left|right) (superior|inferior) oblique$/i, ar: 'ست عضلات خارجية تحرك كل عين في جميع الاتجاهات بتناسق تام مع العين الأخرى.', en: 'Six extraocular muscles move each eye in perfect coordination with the other.' }
    ]
  },
  {
    id: 'endocrine', level: 'school', ar: 'الغدد الصماء والهرمونات', en: 'Endocrine glands and hormones', systems: ['endocrine', 'digestive', 'lymphatic', 'skeletal'],
    steps: [
      { match: /pituitary/i, ar: 'الغدة النخامية في قاعدة الدماغ هي الغدة الرئيسية التي تتحكم في معظم الغدد الأخرى.', en: 'The pituitary gland at the base of the brain is the master gland controlling most others.' },
      { match: /^thyroid gland$|parathyroid/i, ar: 'الغدة الدرقية تنظم الأيض، والغدد جارات الدرقية تنظم كالسيوم الدم.', en: 'The thyroid regulates metabolism; the parathyroids regulate blood calcium.' },
      { match: /thymus/i, ar: 'الغدة الزعترية تنضج فيها الخلايا التائية المناعية خاصة في الطفولة.', en: 'The thymus matures immune T cells, especially in childhood.' },
      { match: /^pancreas$|parenchyma of pancreas/i, ar: 'يفرز البنكرياس الإنسولين والجلوكاجون لضبط سكر الدم.', en: 'The pancreas secretes insulin and glucagon to control blood sugar.' },
      { match: /adrenal gland/i, ar: 'الغدتان الكظريتان فوق الكليتين تفرزان الأدرينالين والكورتيزول والألدوستيرون.', en: 'The adrenal glands above the kidneys secrete adrenaline, cortisol and aldosterone.' }
    ]
  },
  {
    id: 'female', level: 'school', sex: 'f', ar: 'الجهاز التناسلي الأنثوي', en: 'The female reproductive system', systems: ['reproductive', 'urinary', 'skeletal'],
    steps: [
      { match: /^uterus$/i, ar: 'الرحم عضو عضلي أجوف بين المثانة والمستقيم، يحتضن الجنين أثناء الحمل.', en: 'The uterus is a hollow muscular organ between the bladder and rectum that holds the fetus in pregnancy.' },
      { match: /^ovary/i, ar: 'المبيضان ينتجان البويضات وهرموني الإستروجين والبروجسترون.', en: 'The ovaries produce eggs and the hormones estrogen and progesterone.' },
      { match: /fallopian/i, ar: 'قناتا فالوب تلتقطان البويضة، ويحدث الإخصاب عادة في الجزء المتسع منهما.', en: 'The uterine tubes catch the egg; fertilisation usually happens in their wide part.' },
      { match: /^cervix|^vagina$/i, ar: 'عنق الرحم يصل الرحم بالمهبل، والمهبل قناة عضلية تشكل قناة الولادة.', en: 'The cervix joins the uterus to the vagina, a muscular canal that forms the birth canal.' },
      { match: /^mammary gland/i, ar: 'الغدد الثديية تتكون من فصوص تنتج الحليب بعد الولادة وتصبه عبر القنوات اللبنية.', en: 'The mammary glands are made of lobes that produce milk after birth and drain through lactiferous ducts.' }
    ]
  },
  {
    id: 'upper-limb', level: 'uni', ar: 'عضلات الطرف العلوي', en: 'Muscles of the upper limb', systems: ['muscular', 'skeletal'],
    steps: [
      { match: /part of (left|right) deltoid/i, ar: 'الدالية بأجزائها الثلاثة (الترقوي والأخرمي والشوكي) تبعد الذراع وتثنيه وتمده، ويغذيها العصب الإبطي.', en: 'The deltoid (clavicular, acromial and spinal parts) abducts, flexes and extends the arm; it is supplied by the axillary nerve.' },
      { match: /^(left|right) (supraspinatus|infraspinatus|teres minor|subscapularis)/i, ar: 'عضلات الكفة المدورة (SITS) تثبت رأس العضد في الحفرة الحقانية، وتمزقها شائع عند الرياضيين وكبار السن.', en: 'The rotator cuff muscles (SITS) hold the humeral head in the glenoid; tears are common in athletes and the elderly.' },
      { match: /head of (left|right) biceps brachii|^(left|right) brachialis$/i, ar: 'ذات الرأسين والعضدية تثنيان المرفق، وذات الرأسين تبسط الساعد أيضاً، ويغذيهما العصب العضلي الجلدي.', en: 'Biceps and brachialis flex the elbow, biceps also supinates; both are supplied by the musculocutaneous nerve.' },
      { match: /head of (left|right) triceps brachii/i, ar: 'ثلاثية الرؤوس هي الباسطة الرئيسية للمرفق، ويغذيها العصب الكعبري.', en: 'The triceps is the main extensor of the elbow, supplied by the radial nerve.' },
      { match: /flexor (carpi|digitorum)|palmaris longus/i, ar: 'قابضات الساعد تنشأ من اللقيمة الإنسية، ويغذي معظمها العصب المتوسط.', en: 'Forearm flexors arise from the medial epicondyle and are mostly supplied by the median nerve.' },
      { match: /extensor (carpi|digitorum)/i, ar: 'باسطات الساعد تنشأ من اللقيمة الوحشية، ويغذيها العصب الكعبري؛ التهاب منشئها يسمى مرفق لاعب التنس.', en: 'Forearm extensors arise from the lateral epicondyle (radial nerve); inflammation of their origin is tennis elbow.' }
    ]
  },
  {
    id: 'lower-limb', level: 'uni', ar: 'عضلات وأوعية الطرف السفلي', en: 'Muscles and vessels of the lower limb', systems: ['muscular', 'skeletal', 'circulatory'],
    steps: [
      { match: /^(left|right) gluteus (maximus|medius|minimus)$/i, ar: 'الألوية الكبرى تمد الورك، والوسطى والصغرى تبعدان الفخذ وتثبتان الحوض أثناء المشي (علامة ترندلنبرغ عند ضعفهما).', en: 'Gluteus maximus extends the hip; medius and minimus abduct it and stabilise the pelvis in gait (Trendelenburg sign when weak).' },
      { match: /^(left|right) (rectus femoris|vastus lateralis|vastus medialis|vastus intermedius)$/i, ar: 'العضلة رباعية الرؤوس تمد الركبة، ويغذيها العصب الفخذي، وتنتهي بوتر الرضفة.', en: 'The quadriceps extends the knee, is supplied by the femoral nerve and ends in the patellar tendon.' },
      { match: /biceps femoris|^(left|right) (semitendinosus|semimembranosus)$/i, ar: 'عضلات المأبض (الفخذ الخلفية) تمد الورك وتثني الركبة، ويغذيها العصب الوركي.', en: 'The hamstrings extend the hip and flex the knee, supplied by the sciatic nerve.' },
      { match: /gastrocnemius|^(left|right) soleus$/i, ar: 'عضلات بطة الساق تثني القدم للأسفل عبر وتر العرقوب، وتضخ الدم الوريدي نحو القلب.', en: 'The calf muscles plantarflex the foot through the Achilles tendon and pump venous blood towards the heart.' },
      { match: /^(left|right) (femoral|popliteal) artery$/i, ar: 'الشريان الفخذي يصبح مأبضياً خلف الركبة، ويمكن جس نبضه في المثلث الفخذي.', en: 'The femoral artery becomes the popliteal artery behind the knee; its pulse is felt in the femoral triangle.' }
    ]
  },
  {
    id: 'coronary', level: 'uni', ar: 'التروية التاجية للقلب', en: 'Coronary circulation', systems: ['circulatory'],
    steps: [
      { match: /^(left|right) coronary artery$|^trunk of left coronary artery$/i, ar: 'ينشأ الشريانان التاجيان الأيمن والأيسر من جذر الأبهر فوق الصمام الأبهري مباشرة.', en: 'The right and left coronary arteries arise from the aortic root just above the aortic valve.' },
      { match: /anterior (interventricular|descending) branch of left coronary artery$|^anterior interventricular branch/i, ar: 'الفرع الأمامي النازل (LAD) يغذي مقدمة البطين الأيسر والحاجز، وانسداده من أخطر أنواع الجلطات.', en: 'The left anterior descending artery supplies the anterior left ventricle and septum; its occlusion is among the most dangerous heart attacks.' },
      { match: /^circumflex branch of left coronary artery$/i, ar: 'الفرع المنعطف يلتف في الأخدود الأذيني البطيني ليغذي الجدار الوحشي للبطين الأيسر.', en: 'The circumflex artery runs in the atrioventricular groove to supply the lateral left ventricle.' },
      { match: /posterior interventricular branch of right coronary artery|marginal branch of right coronary/i, ar: 'الشريان التاجي الأيمن يعطي الفرع الهامشي والفرع الخلفي النازل غالباً (السيادة اليمنى)، ويغذي العقدة الجيبية.', en: 'The right coronary artery gives the marginal and usually the posterior descending branch (right dominance) and supplies the SA node.' },
      { match: /cardiac vein|coronary sinus/i, ar: 'الأوردة القلبية تتجمع في الجيب التاجي الذي يصب في الأذين الأيمن.', en: 'The cardiac veins drain into the coronary sinus, which opens into the right atrium.' }
    ]
  }
];
