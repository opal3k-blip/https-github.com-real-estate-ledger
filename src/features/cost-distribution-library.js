/* =========================================================================
   مكتبة منحنيات التوزيع الإحصائي للتكاليف والافتراضات — Cost & Assumption
   Distribution Curve Library (المرحلة ٤، النظام الخامس)
   ---------------------------------------------------------------------------
   إجابة على سؤال المستخدم: "هل من المستحسن أن نضيف مكتبة منحنيات لكل تكلفة/
   مصروف، تُعرَض كمؤشر معايري عند الإدخال، تُظهر المنحنى المتوقع والبديل المقبول؟"
   — نعم، وهذا تطبيقها. لكل بند تحته: الشكل الإحصائي الأنسب لمحاكاة Monte Carlo/
   تحليل حساسية احترافي (Normal/Lognormal/Triangular/PERT/Beta/Uniform)، سبب
   اختياره فنياً، بديل مقبول إن كانت البيانات التاريخية محدودة، وطريقة معايرة
   عملية بثلاث نقاط (متشائم/الأرجح/متفائل) قابلة للتطبيق فوراً بدون أي أداة
   Monte Carlo متخصصة — فقط توعية المحلل لحظة إدخال الرقم بأن "رقماً واحداً
   ثابتاً" هو دوماً تبسيط لواقع عشوائي، وبأي شكل يوزّع هذا الواقع فعلياً.

   هذا النظام معلوماتي/تثقيفي بالكامل (Static Reference — بلا محاكاة فعلية ولا
   قاعدة بيانات Firestore) — لا يُغيّر أي حساب، تماماً كمكتبة الكفاءة المعمارية.
   يُعرَض في: (أ) صندوق مضغوط في خطوات المعالج التي تحتوي الحقل المعني فعلياً
   (الأرض=خطوة١، الإيراد والخروج=خطوة٤، رسوم الصندوق=خطوة٧، التمويل=خطوة٨)، (ب)
   مكتبة كاملة قابلة للتصفح من زر شريط الأدوات.

   إضافتا المرحلة ٥ (طلب المستخدم "كلاهما" — إغناء المكتبات القائمة بالمصاريف
   إلى جانب المكتبة الجديدة المخصّصة fund-fees-opex-library.js): opex_ratio
   (خطوة٤) وmgmt_fee_drag (خطوة٧) — بلا أي استيراد جديد، بيانات ثابتة بالكامل
   بنفس نمط كل بند سابق في هذا الملف.
   ========================================================================= */

const COST_LINES = [
  {
    key:'land_price', ar:'سعر شراء الأرض', en:'Land purchase price', icon:'🗺️', step:1,
    shape:{ar:'PERT (Beta-PERT)', en:'PERT (Beta-PERT)'},
    shapeRationaleAr:'سعر تفاوضي واحد نادراً ما يمثّل الواقع — تقدير بثلاث نقاط (أدنى تفاوضي، الأرجح، أعلى قبل الانسحاب) عبر PERT يعطي منحنى أكثر واقعية من التوزيع الطبيعي (Bell Curve متماثل حول رقم واحد) ولا يفرض حدوداً قاطعة كالتوزيع المثلثي (Triangular).',
    shapeRationaleEn:'A single negotiated price rarely reflects reality — a three-point estimate (negotiable floor, most-likely, ceiling before walking away) via PERT gives a more realistic curve than a Normal distribution (symmetric bell around one number) without the hard cutoffs of a pure Triangular.',
    alt:{ar:'مثلثي (Triangular)', en:'Triangular'},
    altRationaleAr:'أبسط للتقدير اليدوي السريع بلا أدوات (٣ نقاط فقط، بلا حساب وزن) — مقبول عند نقص وقت/بيانات المعايرة الدقيقة.',
    altRationaleEn:'Simpler for a quick manual estimate without tools (just 3 points, no weighting math) — acceptable when time/data for finer calibration is limited.',
    calibrationAr:'قدِّر ٣ أرقام: (متشائم = أعلى سعر تقبل الشراء به تحت ضغط) / (الأرجح = سعرك المُدخَل حالياً) / (متفائل = أدنى سعر تتوقعه بعد تفاوض ناجح). متوسط PERT المرجّح = (متشائم + ٤×الأرجح + متفائل)÷٦.',
    calibrationEn:'Estimate 3 numbers: (pessimistic = highest price you would still accept under pressure) / (most likely = your currently entered price) / (optimistic = lowest price after successful negotiation). PERT weighted mean = (pessimistic + 4×likely + optimistic) ÷ 6.',
  },
  {
    key:'build_cost', ar:'تكلفة البناء/م² (Hard Cost)', en:'Build cost/m² (Hard Cost)', icon:'🏗️', step:4,
    shape:{ar:'لوجاريتمي طبيعي (Lognormal)', en:'Lognormal'},
    shapeRationaleAr:'تجاوزات التكلفة الإنشائية غير متماثلة بطبيعتها — احتمال/حجم التجاوز للأعلى (تأخير، تضخم مدخلات، تعديلات تصميم) أكبر بكثير من احتمال/حجم النزول تحت التقدير. التوزيع اللوجاريتمي الطبيعي يعكس هذا الانحراف الموجب (Right-Skew) بخلاف التوزيع الطبيعي المتماثل الذي يُعطي فرصاً غير واقعية للتوفير الكبير.',
    shapeRationaleEn:"Construction cost overruns are inherently asymmetric — the probability/magnitude of overshooting (delays, input inflation, design changes) is far larger than undershooting. A lognormal distribution captures this positive (right) skew, unlike a symmetric Normal distribution that unrealistically allows large savings just as easily as large overruns.",
    alt:{ar:'مثلثي (Triangular)', en:'Triangular'},
    altRationaleAr:'مقبول كتبسيط عملي إذا كانت بيانات المشاريع المشابهة السابقة محدودة أو غير موثّقة كفاية لمعايرة توزيع لوجاريتمي دقيق.',
    altRationaleEn:'Acceptable as a practical simplification when comparable-project historical data is too limited or undocumented to calibrate an accurate lognormal fit.',
    calibrationAr:'راجع ٣-٥ مشاريع سابقة مشابهة (نفس نوع الاستخدام والمدينة): معامل التجاوز الوسيط (الأرجح) عادة +٥ إلى +١٠٪ عن التقدير الأولي، والتجاوز الأسوأ (الذيل الأيمن) قد يبلغ +٢٥-٤٠٪ في حالات تأخير/تضخم مدخلات حاد — نادراً ما ينخفض التنفيذ الفعلي عن التقدير.',
    calibrationEn:'Review 3-5 similar past projects (same use type/city): the median (most-likely) overrun is typically +5 to +10% over the initial estimate, while the worst-case (right tail) can reach +25-40% under severe delay/input-inflation scenarios — actual execution rarely comes in below the estimate.',
  },
  {
    key:'exit_cap_rate', ar:'معدل الرسملة عند الخروج (Exit Cap Rate)', en:'Exit Cap Rate', icon:'📉', step:4,
    shape:{ar:'طبيعي مقيَّد بحد أدنى (Bounded Normal)', en:'Bounded Normal'},
    shapeRationaleAr:'معدلات الرسملة تتأثر بعوامل كثيرة مستقلة نسبياً (سعر الفائدة، شهية المستثمرين، جودة الأصل) تدعم افتراض التوزيع الطبيعي تقريبياً حول متوسط السوق — لكن يجب تقييده بحد أدنى موجب (لا يمكن أن يكون معدل الرسملة صفراً أو سالباً) لتجنّب تقدير قيمة خروج غير منطقي في محاكاة الذيل الأيسر المتطرف.',
    shapeRationaleEn:"Cap rates are driven by many relatively independent factors (interest rates, investor appetite, asset quality), supporting an approximately Normal distribution around the market average — but it must be floored at a positive minimum (a cap rate cannot be zero or negative) to avoid an implausible exit value in extreme left-tail simulation.",
    alt:{ar:'مثلثي (Triangular)', en:'Triangular'},
    altRationaleAr:'مقبول لعرض تفاعلي سريع بسيناريوهين/ثلاثة (كما في scenario-manager.js الحالي: متشائم/أساسي/متفائل) بدل توزيع احتمالي كامل.',
    altRationaleEn:'Acceptable for a quick interactive 2-3 scenario view (exactly as the existing scenario-manager.js does: pessimistic/base/optimistic) instead of a full probability distribution.',
    calibrationAr:'استخدم مكتبة أوبال المرجعية (نطاق capRateMin–capRateMax الفعلي لنفس المدينة/النوع) كحدود ٩٠٪ من التوزيع (P5–P95 تقريباً) حول القيمة الأساسية المُدخَلة — لا تفترض توزيعاً أوسع من النطاق السوقي الموثَّق فعلياً.',
    calibrationEn:'Use the OPAL Benchmark Library (the actual capRateMin–capRateMax range for the same city/type) as the ~P5-P95 bounds of the distribution around the entered base value — never assume a wider spread than the actually-documented market range.',
  },
  {
    key:'financing_rate', ar:'سعر الفائدة (SAIBOR + الهامش)', en:'Interest rate (SAIBOR + margin)', icon:'🏦', step:8,
    shape:{ar:'طبيعي (Normal) قصير الأفق / عملية ارتداد للمتوسط طويل الأفق', en:'Normal (short horizon) / mean-reverting process (long horizon)',},
    shapeRationaleAr:'على أفق قصير (سنة-سنتين) التقلبات صغيرة نسبياً ويكفي افتراض طبيعي حول التوقع الحالي؛ على أفق أطول (٥+ سنوات) أسعار الفائدة تميل تاريخياً للارتداد نحو متوسط طويل الأمد (Mean Reversion) بدل الانحراف العشوائي البسيط — نماذج متقدمة تستخدم عمليات Vasicek/CIR، لكنها تتجاوز نطاق نموذج اكتتاب عملي.',
    shapeRationaleEn:"Over a short horizon (1-2 years) volatility is relatively small and a Normal assumption around the current forward view is adequate; over a longer horizon (5+ years) interest rates historically tend to mean-revert rather than drift as simple random noise — advanced models use Vasicek/CIR processes, though that is beyond a practical underwriting model's scope.",
    alt:{ar:'مثلثي/سيناريوهات ثابتة (Triangular / fixed scenarios)', en:'Triangular / fixed rate-shock scenarios'},
    altRationaleAr:'الأسلوب العملي الأكثر شيوعاً في الاكتتاب العقاري: سيناريو "صعود ١٠٠ نقطة أساس" وسيناريو "نزول ١٠٠ نقطة أساس" (تماماً كما يفعل جدول الحساسية الحالي في النظام) بدل توزيع احتمالي كامل.',
    altRationaleEn:'The most common practical real-estate underwriting approach: a "+100bps" and a "-100bps" shock scenario (exactly what the existing sensitivity table already does in this system) instead of a full probability distribution.',
    calibrationAr:'استخدم منحنى العائد الحالي (Forward Curve) لتقدير "الأرجح"، وأضف/اطرح ١٠٠-١٥٠ نقطة أساس للمتشائم/المتفائل حسب دورة السياسة النقدية الحالية.',
    calibrationEn:'Use the current forward curve for the "most likely" value, and add/subtract 100-150bps for the pessimistic/optimistic cases depending on the current monetary policy cycle.',
  },
  {
    key:'occupancy', ar:'نسبة الإشغال', en:'Occupancy rate', icon:'🏢', step:4,
    shape:{ar:'بيتا (Beta)', en:'Beta'},
    shapeRationaleAr:'نسبة الإشغال محصورة رياضياً بين ٠٪ و١٠٠٪ — توزيع Beta هو المعيار الإحصائي القياسي لأي نسبة/احتمال محدود بحدين (بخلاف التوزيع الطبيعي الذي يسمح رياضياً بقيم خارج [٠٪،١٠٠٪]، وهو خطأ منطقي واضح هنا).',
    shapeRationaleEn:'Occupancy is mathematically bounded between 0% and 100% — Beta is the standard statistical distribution for any bounded proportion/probability (unlike Normal, which mathematically allows values outside [0%,100%] — a clear logical error here).',
    alt:{ar:'مثلثي مقيَّد (Bounded Triangular)', en:'Bounded Triangular'},
    altRationaleAr:'أسهل معايرة بثلاث نقاط دون الحاجة لمعاملي شكل Beta (α، β) — مقبول تماماً لمعظم أغراض تحليل الحساسية العملي.',
    altRationaleEn:'Easier to calibrate with three points without needing Beta shape parameters (α, β) — perfectly acceptable for most practical sensitivity-analysis purposes.',
    calibrationAr:'استخدم بيانات الإشغال التاريخية الفعلية لأصول مشابهة (آخر ٣-٥ سنوات) لتحديد المتوسط والانحراف، وليس افتراضاً نظرياً بحتاً — الإشغال من أكثر المتغيرات التي تتوفر لها بيانات تاريخية موثوقة عادة.',
    calibrationEn:'Use actual historical occupancy data for comparable assets (last 3-5 years) to set the mean and spread, not a purely theoretical assumption — occupancy is one of the variables for which reliable historical data is usually most available.',
  },
  {
    key:'rent_sale_growth', ar:'تصاعد الإيجار/سعر البيع', en:'Rent / sale price escalation', icon:'📈', step:4,
    shape:{ar:'طبيعي (Normal)', en:'Normal'},
    shapeRationaleAr:'معدلات النمو السنوية للإيجار/الأسعار تتأثر بعوامل تراكمية مستقلة كثيرة (تضخم عام، نمو الطلب المحلي، عرض منافس) تدعم تقارب التوزيع نحو الشكل الطبيعي حول متوسط السوق حسب نظرية الحد المركزي.',
    shapeRationaleEn:'Annual rent/price growth rates are driven by many cumulative, relatively independent factors (general inflation, local demand growth, competing supply) that support convergence toward a Normal shape around the market average, per the central limit theorem.',
    alt:{ar:'لوجاريتمي طبيعي مقيَّد بحد أدنى صفر (Lognormal, floored at 0)', en:'Lognormal, floored at zero'},
    altRationaleAr:'أنسب لو كان النمو السلبي (تراجع الأسعار) غير مطروح إطلاقاً في السوق المستهدف (بعض الأسواق الناشئة القوية) — يمنع محاكاة سيناريو تراجع أسعار غير واقعي للسوق المحدد.',
    altRationaleEn:"More suitable if negative growth (price decline) is essentially never observed in the target market (some strong emerging markets) — it prevents simulating an implausible price-decline scenario for that specific market.",
    calibrationAr:'استخدم متوسط ٣-٥ سنوات فعلية لنفس الحي/المدينة كـ"الأرجح"، والانحراف المعياري التاريخي لتحديد عرض التوزيع — تجنّب افتراض نمو ثابت "معقول" بلا سند بيانات فعلي.',
    calibrationEn:"Use the actual 3-5 year average for the same district/city as the \"most likely\" value, and the historical standard deviation to set the distribution's spread — avoid assuming a flat \"reasonable-sounding\" growth rate with no actual data backing it.",
  },
  {
    key:'contingency_drawdown', ar:'استخدام احتياطي الطوارئ الفعلي (Contingency Drawdown)', en:'Actual contingency drawdown', icon:'🧯', step:4,
    shape:{ar:'بيتا/PERT محصور [٠، الحد الأقصى المرصود]', en:'Beta/PERT bounded [0, observed max]'},
    shapeRationaleAr:'الاستخدام الفعلي للطوارئ محصور منطقياً بين صفر (لم يُستخدَم شيء) والحد الأقصى المرصود تاريخياً في مشاريع مشابهة — Beta/PERT يحترم هذين الحدين، بخلاف التوزيع الطبيعي الذي يسمح رياضياً باستخدام سالب (غير منطقي).',
    shapeRationaleEn:"Actual contingency usage is logically bounded between zero (none used) and the historically-observed maximum in comparable projects — Beta/PERT respects both bounds, unlike Normal, which mathematically allows a negative usage (nonsensical).",
    alt:{ar:'مثلثي (Triangular)', en:'Triangular'},
    altRationaleAr:'كافٍ عملياً عند غياب بيانات كافية لمعايرة Beta الدقيقة.',
    altRationaleEn:'Practically sufficient when there isn\'t enough data to calibrate a precise Beta fit.',
    calibrationAr:'راجع نسبة الطوارئ المُستخدَمة فعلياً (لا المرصودة فقط) في آخر ٣-٥ مشاريع مشابهة — المتوسط الفعلي التاريخي غالباً أقل من النسبة المرصودة بالكامل (٥-٧٪ فعلي مقابل ١٠٪ مرصود نموذجياً)، وهذا أساس رافعة "تقليص احتياطي الطوارئ" في قسم رافعات الجدوى.',
    calibrationEn:'Review the actually-used contingency (not just the reserved amount) in the last 3-5 comparable projects — the historical actual average is often lower than the fully-reserved percentage (typically 5-7% actual vs. 10% reserved), which is exactly the basis for the "trim contingency" lever in the Feasibility Levers section.',
  },
  {
    key:'opex_ratio', ar:'نسبة المصاريف التشغيلية (OPEX)', en:'Operating expense ratio (OPEX)', icon:'🧾', step:4,
    shape:{ar:'بيتا (Beta)', en:'Beta'},
    shapeRationaleAr:'نسبة مصاريف التشغيل محصورة رياضياً بين ٠٪ و١٠٠٪ من الإيراد الفعلي — تماماً كنسبة الإشغال، Beta هو المعيار الإحصائي القياسي لأي نسبة محدودة بحدين، ويعكس عادة انحرافاً بسيطاً نحو الأعلى (تجاوزات الصيانة أكثر شيوعاً من التوفير غير المخطَّط).',
    shapeRationaleEn:'The OPEX ratio is mathematically bounded between 0% and 100% of EGI — exactly like occupancy, Beta is the standard distribution for any bounded proportion, and typically shows a mild upward skew (maintenance overruns are more common than unplanned savings).',
    alt:{ar:'مثلثي (Triangular)', en:'Triangular'},
    altRationaleAr:'مقبول عملياً عند غياب بيانات تاريخية كافية لمعايرة Beta الدقيقة — استخدم نطاق مكتبة رسوم الصندوق والمصاريف المرجعية (OPEX_BY_SECTOR) حسب قطاع الفرصة كحدود ٩٠٪ تقريباً.',
    altRationaleEn:'Practically acceptable when there isn\'t enough historical data for a precise Beta fit — use the Fund Fees & Opex Library\'s sector benchmark range as the approximate 90% bounds.',
    calibrationAr:'راجع البيانات التشغيلية الفعلية (لا المُقدَّرة) لأصول مشابهة في نفس القطاع والمدينة آخر ٣ سنوات على الأقل — نسبة OPEX من أكثر المتغيرات التي تتوفر لها بيانات تاريخية موثوقة، فتجنّب افتراضاً نظرياً بلا سند.',
    calibrationEn:'Review actual (not budgeted) operating data for comparable assets in the same sector/city over at least the last 3 years — OPEX ratio is one of the variables with usually-reliable historical data, so avoid a purely theoretical assumption.',
  },
  {
    key:'mgmt_fee_drag', ar:'استنزاف رسوم الإدارة التراكمي', en:'Cumulative management-fee drag', icon:'🗂️', step:7,
    shape:{ar:'ثابت شبه-حتمي مع هامش تفاوضي ضيق (Near-Deterministic + narrow negotiation band)', en:'Near-deterministic, with a narrow negotiation band'},
    shapeRationaleAr:'على عكس تكلفة البناء أو معدل الرسملة، رسوم الإدارة نسبة تعاقدية تُحدَّد صراحة في وثائق الصندوق (لا تخضع لعشوائية السوق بعد التوقيع) — أقرب لثابت مع هامش تفاوضي ضيق وقت التأسيس فقط (عادة ±٠.٢٥-٠.٥٪) لا توزيعاً احتمالياً كاملاً بعد الإقفال.',
    shapeRationaleEn:'Unlike build cost or cap rate, the management fee is a contractual rate fixed explicitly in the fund documents (not subject to market randomness once signed) — closer to a constant with only a narrow negotiation band at formation time (typically ±0.25-0.5%), not a full probability distribution post-closing.',
    alt:{ar:'سيناريوهين ثابتين (تفاوضي منخفض / معياري)', en:'Two fixed scenarios (negotiated-low / standard)'},
    altRationaleAr:'الأسلوب العملي الأشيع: قارن الأثر التراكمي على IRR/MOIC بين السعر التفاوضي المستهدف (مثلاً ١.٢٥٪) والسعر المؤسسي المعياري (١.٥-٢.٠٪) — راجع مكتبة رسوم الصندوق والمصاريف للنطاق المرجعي الكامل.',
    altRationaleEn:'The most common practical approach: compare the cumulative IRR/MOIC impact between your negotiation target (e.g. 1.25%) and the standard institutional rate (1.5-2.0%) — see the Fund Fees & Opex Library for the full benchmark range.',
    calibrationAr:'اضرب رسوم الإدارة السنوية × إجمالي سنوات مدة الاستثمار لتقدير الاستنزاف التراكمي الإجمالي كنسبة من رأس المال — فارق ٠.٥٪ سنوياً على مدى ٧ سنوات يعني ٣.٥٪ من رأس المال المُلتزَم بالكامل تقريباً، أثر ليس هامشياً على MOIC النهائي.',
    calibrationEn:'Multiply the annual management fee by the total hold period to estimate total cumulative drag as a share of capital — a 0.5%/yr difference over a 7-year hold means roughly 3.5% of committed capital, a non-trivial impact on final MOIC.',
  },
  {
    key:'construction_duration', ar:'مدة الإنشاء', en:'Construction duration', icon:'📅', step:4,
    shape:{ar:'PERT (أصل تسمية PERT: Program Evaluation and Review Technique — طُوِّرت أصلاً لتقدير مدد المشاريع)', en:'PERT (its very name — Program Evaluation and Review Technique — comes from project-duration estimation)'},
    shapeRationaleAr:'PERT صُمِّم أصلاً وتاريخياً لهذا الاستخدام بالضبط (تقدير مدة الأنشطة الهندسية/الإنشائية بثلاث نقاط) قبل أن يُستعمَل لاحقاً في أي سياق آخر — أنسب اختيار افتراضي هنا من كل بند في هذه المكتبة.',
    shapeRationaleEn:"PERT was originally and historically designed for exactly this use case (three-point estimation of engineering/construction activity durations) before being applied elsewhere — the single most naturally-fitting default in this entire library.",
    alt:{ar:'مثلثي (Triangular)', en:'Triangular'},
    altRationaleAr:'إذا كانت الأوزان الافتراضية لـPERT (٤× للأرجح) لا تلائم حكم الفريق الهندسي — Triangular يعطي وزناً متساوياً لكل نقطة.',
    altRationaleEn:"If PERT's default weighting (4× for the most-likely value) doesn't match the engineering team's judgment — Triangular gives equal weight to each point.",
    calibrationAr:'اسأل فريق التنفيذ: أسرع مدة ممكنة واقعياً (متفائل)، المدة المتوقعة بلا مفاجآت (الأرجح)، وأطول مدة معقولة مع تأخيرات معتادة (متشائم) — متوسط PERT = (متفائل + ٤×الأرجح + متشائم)÷٦.',
    calibrationEn:'Ask the delivery team: the realistically fastest possible duration (optimistic), the expected duration with no surprises (most likely), and the longest reasonable duration with typical delays (pessimistic) — PERT mean = (optimistic + 4×likely + pessimistic) ÷ 6.',
  },
];

function shapeCard(core, cl){
  return `
  <div class="section" style="margin-bottom:10px; background:var(--surface-2); border:1px dashed var(--border);">
    <p class="step-sub" style="margin:0 0 4px;">${cl.icon} ${core.T(cl.ar, cl.en)}</p>
    <div class="livebox"><div class="lg">
      <div class="li">${core.T('المنحنى المتوقع','Expected curve')}<b>${core.T(cl.shape.ar, cl.shape.en)}</b></div>
      <div class="li">${core.T('البديل المقبول','Acceptable alternative')}<b>${core.T(cl.alt.ar, cl.alt.en)}</b></div>
    </div></div>
    <p class="note" style="margin-top:6px; font-size:11.5px; line-height:1.8;"><b>${core.T('لماذا هذا المنحنى؟','Why this curve?')}</b> ${core.T(cl.shapeRationaleAr, cl.shapeRationaleEn)}</p>
    <p class="note" style="margin-top:4px; font-size:11.5px; line-height:1.8;"><b>${core.T('البديل — متى يُستخدَم؟','The alternative — when to use it?')}</b> ${core.T(cl.altRationaleAr, cl.altRationaleEn)}</p>
    <p class="note" style="margin-top:4px; font-size:11.5px; line-height:1.8; color:var(--ink-faint);"><b>${core.T('طريقة معايرة عملية','Practical calibration method')}:</b> ${core.T(cl.calibrationAr, cl.calibrationEn)}</p>
  </div>`;
}

export function registerCostDistributionLibrary(core){
  core.registerTopbarButton(()=>{
    return `<button class="btn btn-sm" data-action="costdist-open">📊 ${core.T('مكتبة منحنيات التوزيع','Cost Distribution Library')}</button>`;
  });

  for(const step of [1,4,7,8]){
    const linesForStep = COST_LINES.filter(cl=>cl.step===step);
    if(!linesForStep.length) continue;
    core.registerWizardStepExtra(step, ()=>{
      return `
      <div class="section" style="margin-top:16px; background:var(--surface-2); border:1px dashed var(--border);">
        <p class="step-sub" style="margin:0 0 8px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
          <span>📊 ${core.T('مؤشر معايرة إحصائي — منحنى التوزيع المتوقع لهذه الافتراضات','Calibration indicator — expected distribution curve for these assumptions')}</span>
          <button type="button" class="btn btn-sm btn-ghost" data-action="costdist-open">📚 ${core.T('المكتبة الكاملة','Full library')}</button>
        </p>
        ${linesForStep.map(cl=>shapeCard(core, cl)).join('')}
        <p class="note" style="margin:4px 0 0; font-size:11px;">${core.T('مؤشر تثقيفي فقط — لا يُشغِّل محاكاة Monte Carlo فعلية ولا يُغيِّر أي رقم؛ يساعد المحلل على معايرة "الرقم الواحد" المُدخَل بوعي بمدى عدم تيقّنه الفعلي.','Purely educational — does not run an actual Monte Carlo simulation or change any number; helps the analyst calibrate the single entered number with real awareness of its actual uncertainty.')}</p>
      </div>`;
    });
  }

  core.registerMainView('cost-distribution', ()=>{
    return `
    <div class="section" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 style="margin:0;">📊 ${core.T('مكتبة منحنيات التوزيع الإحصائي للتكاليف والافتراضات','Cost & Assumption Distribution Curve Library')}</h2>
        <p class="note" style="margin:4px 0 0;">${core.T('بنود مرجعية','Reference items')}: <b>${COST_LINES.length}</b></p>
      </div>
      <button class="btn btn-sm btn-ghost" data-action="costdist-close">✖ ${core.T('إغلاق ورجوع للوحة الفرص','Close & return to dashboard')}</button>
    </div>
    ${COST_LINES.map(cl=>shapeCard(core, cl)).join('')}`;
  });

  core.registerActionHandler(async (action)=>{
    if(action==='costdist-open'){ core.setCoreState({ mainView:'cost-distribution', openDetailId:null, render:true }); return true; }
    if(action==='costdist-close'){ core.setCoreState({ mainView:null, render:true }); return true; }
    return false;
  });
}

export { COST_LINES };
