// Guided lessons: each step selects structures (matched on English name) and explains them.
export const TOURS = [
  {
    id: 'heart', ar: 'القلب ومسار الدم', en: 'The heart and blood flow', systems: ['circulatory'],
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
    id: 'brain', ar: 'فصوص الدماغ ووظائفها', en: 'Lobes of the brain', systems: ['nervous'],
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
    id: 'breathing', ar: 'رحلة الهواء في الجهاز التنفسي', en: 'The path of air', systems: ['respiratory', 'skeletal'],
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
    id: 'digestion', ar: 'رحلة الطعام في الجهاز الهضمي', en: 'The journey of food', systems: ['digestive'],
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
    id: 'skeleton', ar: 'الهيكل العظمي الأساسي', en: 'Main bones of the skeleton', systems: ['skeletal'],
    steps: [
      { group: 'skull', ar: 'الجمجمة: تحمي الدماغ وتتكون من عظام قحفية ووجهية ملتحمة بدروز.', en: 'Skull: protects the brain; cranial and facial bones joined by sutures.' },
      { group: 'vertebral column', ar: 'العمود الفقري: 7 فقرات عنقية و12 صدرية و5 قطنية، ثم العجز والعصعص، ويحمي الحبل الشوكي.', en: 'Vertebral column: 7 cervical, 12 thoracic and 5 lumbar vertebrae plus sacrum and coccyx; it protects the spinal cord.' },
      { group: 'rib cage', ar: 'القفص الصدري: 12 زوجاً من الأضلاع مع القص، يحمي القلب والرئتين ويشارك في التنفس.', en: 'Rib cage: 12 pairs of ribs and the sternum protect the heart and lungs and move with breathing.' },
      { match: /^(left|right) (humerus|radius|ulna)$/i, ar: 'عظام الطرف العلوي: العضد في الذراع، والكعبرة والزند في الساعد.', en: 'Upper limb bones: humerus in the arm, radius and ulna in the forearm.' },
      { match: /^(left|right) (hip bone|femur|patella|tibia|fibula)$/i, ar: 'عظام الطرف السفلي: عظم الورك، والفخذ أطول عظام الجسم، والرضفة، والظنبوب والشظية.', en: 'Lower limb bones: hip bone, femur (the longest bone), patella, tibia and fibula.' }
    ]
  },
  {
    id: 'lymph', ar: 'الجهاز اللمفاوي والمناعة', en: 'Lymphatic system and immunity', systems: ['lymphatic', 'circulatory'],
    steps: [
      { match: /cervical lymph|axillary lymph|inguinal lymph/i, ar: 'العقد اللمفاوية محطات ترشيح للّمف، تحتوي على خلايا مناعية تلتقط الجراثيم، وتتضخم عند الالتهاب.', en: 'Lymph nodes filter lymph; their immune cells trap microbes and they swell during infection.' },
      { match: /thoracic duct/i, ar: 'القناة الصدرية تجمع اللمف من معظم الجسم وتعيده إلى الدم عند الزاوية الوريدية اليسرى.', en: 'The thoracic duct collects lymph from most of the body and returns it to the blood at the left venous angle.' },
      { match: /^spleen$/i, ar: 'الطحال أكبر عضو لمفاوي، يرشح الدم ويزيل الكريات الحمراء الهرمة.', en: 'The spleen is the largest lymphoid organ; it filters blood and removes old red cells.' },
      { match: /thymus/i, ar: 'الغدة الزعترية مكان نضوج الخلايا التائية، وتكون كبيرة في الطفولة.', en: 'The thymus is where T cells mature; it is large in childhood.' }
    ]
  }
];
