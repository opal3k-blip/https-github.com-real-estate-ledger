/* =========================================================================
   مكتبة رسوم الصندوق والمصاريف التشغيلية المرجعية — Fund Fees & Opex
   Benchmark Library (المرحلة ٥، النظام الأول)
   ---------------------------------------------------------------------------
   طلب المستخدم: "أضف كل خبرتك في الصناديق العقارية للاستثمار والتطوير من حيث
   الاستخدامات والكفاءات والمصاريف — بشكل احترافي" ("كلاهما": مكتبة جديدة مخصّصة
   + إثراء المكتبات القائمة). هذا الملف هو المكتبة الجديدة المخصّصة؛ الإثراء
   المتبادل موجود في space-efficiency-library.js (OPEX_BY_SECTOR أدناه، مُصدَّرة
   ومُستورَدة من هناك) وفي cost-distribution-library.js (بندا "استنزاف رسوم
   الإدارة التراكمي" و"نسبة المصاريف التشغيلية" الجديدان).

   لا يُضيف هذا الملف أي حساب جديد — الرسوم (fees.mgmt/structuring/arrangement/
   acquisition/disposition/assetMgmt/propMgmt/...) ونموذج Waterfall الكامل
   (economics.hurdle/carry/lpShare/gpShare/devShare) موجودان فعلاً ويُحسَبان
   حقاً في core.js (انظر compute(): PIC/roc/pref/catchup/carryPool/lpBonus/
   gpManager/devPromote/lpTotal/gpTotal/devTotal). هذا الملف مرجعي/معياري فقط:
   يعرض نطاقات مؤسسية معتادة (Benchmark) لكل حقل من هذه الحقول الحقيقية،
   يقارن قيمة الفرصة المُدخَلة بها، ويشرح بنية الـWaterfall الفعلية بالأرقام
   الحقيقية المحسوبة لحظة العرض — تماماً بنفس فلسفة benchmark-engine.js لكن
   لمستوى "اقتصاديات الصندوق" لا "مستوى الأصل".

   نقاط العرض الثلاث (بنفس نمط المكتبات المرجعية الأخرى في المرحلة ٤):
     أ. registerWizardStepExtra(7, ...) — لحظة إدخال "رسوم الصندوق" (خطوة ٧):
        صندوق مقارنة فوري لكل حقل رسوم مُدخَل مقابل نطاقه المؤسسي المعتاد.
     ب. registerDetailSection — نفس المقارنة + شرح Waterfall بالأرقام الحقيقية
        (c.roc/c.pref/c.catchup/...) + نطاق OPEX المرجعي لقطاع الفرصة.
     ج. Main View كاملة (تبويبات: رسوم / Waterfall / OPEX حسب القطاع) + طبقة
        تجاوزات محلية (fundFeeOverrides، بنفس نمط comparables.js/benchmark-
        engine.js)، محمية بـcanManageLibraries (مدير صندوق فأعلى).
   ========================================================================= */

import { SECTORS, USE_TYPE_TO_SECTORS } from './space-efficiency-data.js';
import { canManageLibraries, certifyBadge } from './roles-permissions.js';

const OVERRIDES_COLLECTION = 'fundFeeOverrides';

/* =========================================================================
   نطاقات الرسوم المؤسسية المعتادة — كل بند مرتبط بحقل حقيقي في core.js
   (path) يُقرأ ويُقارَن فعلياً، لا نص وصفي معلّق في الهواء.
   ========================================================================= */
const FEE_BENCHMARKS = [
  {
    key:'mgmt', path:'fees.mgmt', icon:'🗂️', min:0.010, max:0.020,
    ar:'رسوم إدارة الصندوق (سنوي)', en:'Fund management fee (annual)',
    basisAr:'٪ سنوياً — عادة من رأس المال المُلتزَم (Committed Capital) خلال فترة الاستثمار، وقد تتحوّل لاحقاً لتُحسَب من صافي قيمة الأصول (NAV) أو التكلفة المتبقية بعد بدء التشغيل.',
    basisEn:'% per year — typically on committed capital during the investment period, sometimes shifting to NAV or remaining invested cost once the fund is operating.',
    rationaleAr:'الرسم الأكثر شيوعاً في صناديق الأسهم العقارية الخاصة (Private Real Estate Equity) عالمياً وخليجياً هو ١.٥٪ سنوياً؛ صناديق أصغر أو أقل تنافسية قد تصل ٢٪، وصناديق كبيرة/مؤسسية جداً (Core/Core-Plus بحجم كبير) قد تنزل لـ١-١.٢٥٪. رسم أعلى من ٢٪ سنوياً يستدعي تبريراً واضحاً في مذكرة اللجنة (نطاق استثماري متخصص جداً، أو صندوق صغير الحجم لا يغطي التكاليف التشغيلية الثابتة بدون ذلك).',
    rationaleEn:'The most common rate globally and regionally for private real estate equity funds is 1.5%/yr; smaller or less competitive funds can reach 2%, while very large institutional Core/Core-Plus vehicles can drop to 1-1.25%. Anything above 2%/yr needs a clear justification in the IC memo (a highly specialized strategy, or a small fund whose fixed operating costs otherwise wouldn\'t be covered).',
  },
  {
    key:'structuring', path:'fees.structuring', icon:'🧾', min:0.005, max:0.015,
    ar:'رسوم الهيكلة (لمرة واحدة)', en:'Structuring fee (one-time)',
    basisAr:'٪ لمرة واحدة من رأس المال المُلتزَم عند إقفال الصندوق (Fund Closing).', basisEn:'% one-time, of committed capital at fund closing.',
    rationaleAr:'تغطّي تكاليف التأسيس القانوني والتنظيمي (اعتماد هيئة السوق المالية، الصياغة القانونية، مذكرة المعلومات). النطاق المعتاد ٠.٥-١.٥٪ من رأس المال المُلتزَم — صناديق أصغر تميل للحد الأعلى (تكلفة تأسيس ثابتة تُوزَّع على قاعدة رأسمالية أصغر).',
    rationaleEn:'Covers legal/regulatory setup (CMA approval, legal drafting, the information memorandum). Typical range 0.5-1.5% of committed capital — smaller funds trend toward the higher end (fixed setup cost spread over a smaller capital base).',
  },
  {
    key:'arrangement', path:'fees.arrangement', icon:'🏦', min:0.005, max:0.010,
    ar:'رسوم ترتيب التمويل', en:'Financing arrangement fee',
    basisAr:'٪ لمرة واحدة من مبلغ التمويل بالدين (لا من إجمالي التكلفة).', basisEn:'% one-time, of the debt amount (not total project cost).',
    rationaleAr:'رسم البنك/الجهة المموّلة لترتيب وتوثيق التسهيل الائتماني — معتاد ٠.٥-١.٠٪ من مبلغ القرض في السوق السعودي والخليجي؛ هياكل تمويل مُعقَّدة (Senior + Mezzanine) قد تحمل رسوماً منفصلة لكل شريحة تُجمَع هنا كرقم واحد مبسَّط.',
    rationaleEn:'The lender/arranger\'s one-time fee for structuring and documenting the credit facility — typically 0.5-1.0% of the loan amount in the Saudi/Gulf market; complex structures (senior + mezzanine) may carry a separate fee per tranche, simplified here into one blended figure.',
  },
  {
    key:'acquisition', path:'fees.acquisition', icon:'🤝', min:0.010, max:0.020,
    ar:'رسوم الاستحواذ', en:'Acquisition fee',
    basisAr:'٪ لمرة واحدة من سعر شراء الأرض/الأصل الإجمالي.', basisEn:'% one-time, of the gross land/asset purchase price.',
    rationaleAr:'مقابل جهد المصدر (Sourcing)، التقييم، والعناية الواجبة (Due Diligence) قبل الإغلاق. المعتاد مؤسسياً ١.٠-٢.٠٪ من سعر الشراء الإجمالي — صناديق الاستحواذ المباشر (لا عبر وسيط) قد تُخفِّضها للحد الأدنى تعزيزاً لجاذبية الطرح للمستثمرين.',
    rationaleEn:'Compensation for deal sourcing, appraisal, and due diligence pre-closing. Institutionally typical is 1.0-2.0% of gross purchase price — funds with direct (non-brokered) sourcing sometimes trim toward the low end to make the offering more attractive to investors.',
  },
  {
    key:'disposition', path:'fees.disposition', icon:'🚪', min:0.005, max:0.015,
    ar:'رسوم البيع / الخروج', en:'Disposition (exit) fee',
    basisAr:'٪ لمرة واحدة من سعر البيع الإجمالي عند الخروج.', basisEn:'% one-time, of gross sale value at exit.',
    rationaleAr:'مقابل تجهيز الأصل للبيع وتنفيذ عملية الخروج (تسويق، تفاوض، إغلاق قانوني). المعتاد ٠.٥-١.٥٪ من قيمة البيع — يميل نحو الحد الأعلى في عمليات البيع المعقّدة (Strata/بيع جزئي لمستثمرين متعددين، أو IPO/تحويل لصندوق مُقيَّد) ونحو الحد الأدنى في بيع مباشر لمشتر واحد مؤسسي جاهز.',
    rationaleEn:'Compensation for preparing the asset for sale and executing the exit (marketing, negotiation, legal closing). Typically 0.5-1.5% of sale value — trending higher for complex exits (strata/partial sale to multiple buyers, or an IPO/listed-fund conversion) and lower for a straightforward single institutional buyer sale.',
  },
  {
    key:'assetMgmt', path:'fees.assetMgmt', icon:'📈', min:0.005, max:0.010,
    ar:'رسوم إدارة الأصول (سنوي)', en:'Asset management fee (annual)',
    basisAr:'٪ سنوياً من التكلفة الإجمالية للمشروع (TPC) أو قيمة الأصل الحالية.', basisEn:'% per year, of total project cost (TPC) or current asset value.',
    rationaleAr:'منفصل عن رسم إدارة الصندوق (الذي يغطي إدارة المحفظة/المستثمرين ككل) — هذا يغطي القرارات الاستراتيجية على مستوى الأصل نفسه (إعادة تموضع، تجديد، قرارات تأجير كبرى). المعتاد ٠.٥-١.٠٪ سنوياً من TPC أو القيمة الحالية، وقد يتصاعد مع تعقيد الأصل (فندقي/مركز بيانات أعلى من سكني بسيط).',
    rationaleEn:'Distinct from the fund management fee (which covers portfolio/investor administration) — this covers strategic asset-level decisions (repositioning, renovation, major leasing calls). Typically 0.5-1.0%/yr of TPC or current value, trending higher for more complex assets (hospitality/data center vs. simple residential).',
  },
  {
    key:'propMgmt', path:'fees.propMgmt', icon:'🧰', min:0.030, max:0.060,
    ar:'رسوم إدارة العقارات (من الإيجار)', en:'Property management fee (of collected rent)',
    basisAr:'٪ من الإيراد الفعلي المُحصَّل (EGI) — تشغيلي يومي، لا استراتيجي.', basisEn:'% of effective gross income (EGI) collected — day-to-day operational, not strategic.',
    rationaleAr:'إدارة المرافق اليومية، تحصيل الإيجار، صيانة روتينية، علاقات المستأجرين. المعتاد ٣-٦٪ من الإيجار المُحصَّل — الحد الأدنى للأصول الكبيرة أحادية المستأجر (مستودع مؤجَّر بالكامل NNN لمستأجر واحد)، والحد الأعلى للأصول متعددة المستأجرين كثيفة التشغيل (تجزئة/سكني تأجير قصير).',
    rationaleEn:'Day-to-day facilities management, rent collection, routine maintenance, tenant relations. Typically 3-6% of collected rent — the low end for large single-tenant NNN assets (a fully-leased warehouse to one tenant), the high end for multi-tenant, operationally-intensive assets (retail/short-term residential rental).',
  },
  {
    key:'hurdle', path:'economics.hurdle', icon:'🎯', min:0.06, max:0.10,
    ar:'معدل العائد المستهدف (Hurdle Rate)', en:'Preferred return / hurdle rate',
    basisAr:'٪ سنوياً مُركَّب — الحد الذي يجب أن يستلمه المستثمرون (LP) كاملاً قبل مشاركة المدير في أي أرباح أداء.', basisEn:'% per year, compounded — the return LPs must receive in full before the manager shares in any performance profit.',
    rationaleAr:'النطاق المؤسسي المعتاد لصناديق الأسهم العقارية الخاصة ٦-١٠٪ سنوياً؛ استراتيجيات الدخل المستقر (Core) تميل لـ٦-٧٪، واستراتيجيات التطوير/القيمة المضافة (Value-Add/Opportunistic) الأعلى مخاطرة تُبرِّر Hurdle أعلى (٨-١٠٪ أو حتى أكثر) لتعويض المستثمر عن المخاطرة الإضافية قبل مشاركة المدير في الأداء.',
    rationaleEn:'The typical institutional range for private real estate equity is 6-10%/yr; stable-income (Core) strategies trend toward 6-7%, while development/value-add/opportunistic strategies justify a higher hurdle (8-10% or more) to compensate investors for the added risk before the manager shares in performance.',
  },
  {
    key:'carry', path:'economics.carry', icon:'🥇', min:0.15, max:0.20,
    ar:'إجمالي حصة الأداء (Carried Interest)', en:'Total carried interest (promote)',
    basisAr:'٪ من الأرباح المتبقية بعد استرداد رأس المال والعائد المفضّل (Hurdle) بالكامل.', basisEn:'% of profit remaining after full return of capital and the preferred return (hurdle).',
    rationaleAr:'المعيار المؤسسي الأكثر انتشاراً عالمياً هو ٢٠٪ ("٢-و-٢٠" Two-and-Twenty، وإن كان رسم الإدارة هنا أقرب لـ١.٥٪ لا ٢٪ في أغلب السوق العقاري الإقليمي). صناديق كبيرة/مؤسسية جداً قد تتفاوض على ١٥-١٧.٥٪، وبعض الهياكل المتدرّجة (Tiered Promote) ترفعه لـ٢٥-٣٠٪ فقط عند تجاوز عائد ثانٍ أعلى (Super Hurdle) — هذا النموذج الحالي يستخدم معدلاً واحداً مسطّحاً لا متدرّجاً.',
    rationaleEn:'The most globally common institutional standard is 20% ("two-and-twenty", though the management fee side of that convention runs closer to 1.5% rather than a full 2% in most of the regional real estate market). Very large/institutional funds can negotiate 15-17.5%, while some tiered-promote structures raise it to 25-30% only above a second, higher hurdle (a "super hurdle") — this model currently uses one flat rate rather than a tiered one.',
  },
];

/* =========================================================================
   بنية توزيع الأرباح (Distribution Waterfall) — شرح المراحل الأربع الفعلية
   المُحسَبة في core.js (compute()، قسم "Waterfall") بأسمائها الحقيقية، مع أرقام
   حقيقية عند توفّر c (نتيجة compute) في نقطة العرض على صفحة الفرصة.
   ========================================================================= */
const WATERFALL_TIERS = [
  {
    order:1, key:'roc', icon:'1️⃣',
    ar:'استرداد رأس المال (Return of Capital)', en:'Return of Capital',
    descAr:'أول كل التوزيعات تعود لتغطية رأس المال المُستثمَر (PIC) بالكامل — دون أي عائد أو ربح، مجرّد استرداد لما دُفع بالضبط. لا يبدأ حساب أي عائد للمدير قبل اكتمال هذه المرحلة كاملة.',
    descEn:'Every distribution first goes toward returning the fully invested capital (PIC) — no return or profit yet, just a dollar-for-dollar return of what was paid in. No manager compensation begins accruing until this tier is fully satisfied.',
  },
  {
    order:2, key:'pref', icon:'2️⃣',
    ar:'العائد المفضّل (Preferred Return / Hurdle)', en:'Preferred Return (Hurdle)',
    descAr:'بعد استرداد رأس المال بالكامل، يستمر التوزيع للمستثمرين (LP) حتى يحققوا العائد المُركَّب المستهدف (economics.hurdle) كاملاً على مدة الاستثمار — المدير لا يشارك في هذه المرحلة إطلاقاً.',
    descEn:'After full capital return, distributions continue to LPs until they achieve the full compounded target return (economics.hurdle) over the hold period — the manager receives nothing at this tier at all.',
  },
  {
    order:3, key:'catchup', icon:'3️⃣',
    ar:'استرداد المدير (GP Catch-up)', en:'GP Catch-up',
    descAr:'بعد استكمال العائد المفضّل، يحصل المدير على ١٠٠٪ من التوزيعات التالية (Full/100% Catch-up — النمط الأكثر شيوعاً مؤسسياً) حتى تصل حصته الفعلية من إجمالي الأرباح فوق رأس المال لنسبة الأداء الكاملة المتفَق عليها (economics.carry) — لا أكثر ولا أقل، بالضبط بمعادلة carry/(1-carry)×العائد المفضّل.',
    descEn:'Once the preferred return is fully paid, the manager receives 100% of the next distributions (a "full" or "100% catch-up" — the most common institutional pattern) until their share of total profit above capital exactly equals the agreed carry rate — no more, no less, via the carry/(1-carry)×preferred-return formula.',
  },
  {
    order:4, key:'residual', icon:'4️⃣',
    ar:'التوزيع النهائي (Residual Carry Split)', en:'Residual Split',
    descAr:'أي أرباح متبقية بعد ذلك تُقسَّم: economics.carry منها يذهب لمجمّع الأداء (Carry Pool) — الذي يُوزَّع بدوره ثلاثياً حسب lpShare/gpShare/devShare (عادة مستثمرون/مدير الصندوق/المطوّر) — والباقي (١-economics.carry) يعود مباشرة للمستثمرين كحصتهم القياسية من الأرباح.',
    descEn:'Any remaining profit after that splits: economics.carry of it goes into the "carry pool" — itself further split three ways via lpShare/gpShare/devShare (typically investors/fund manager/developer) — and the rest (1-economics.carry) flows directly back to LPs as their standard share of profit.',
  },
];

/* =========================================================================
   نسبة المصاريف التشغيلية المرجعية حسب القطاع (OPEX Ratio Benchmark) — ٪ من
   الإيراد الفعلي (EGI) يستبقيه المالك كمصاريف تشغيل، مُصدَّرة ليُستخدَمها
   space-efficiency-library.js أيضاً (إثراء متبادل حسب قرار المستخدم "كلاهما")
   — مفاتيحها مطابقة تماماً لمفاتيح SECTORS في space-efficiency-data.js.
   قيمة null = قطاع داعم/بنية عامة لا يُنتج إيراداً مستقلاً، فلا نطاق OPEX له.
   ========================================================================= */
export const OPEX_BY_SECTOR = {
  residential:     { min:0.30, max:0.40, ar:'إشغال/صيانة/رسوم جمعية ملاك متكررة — الحد الأدنى للأبراج الفاخرة المُدارة بكفاءة، الأعلى للسكني الاقتصادي كثيف الدوران.', en:'Recurring occupancy/maintenance/HOA-style costs — low end for efficiently-managed luxury towers, high end for affordable housing with heavier tenant turnover.' },
  office:          { min:0.30, max:0.45, ar:'مكاتب Grade A مُدارة جيداً تقترب من الحد الأدنى؛ مباني B/C أقدم (صيانة أعلى، إشغال أضعف يرفع نسبة المصاريف الثابتة من الإيراد) تقترب من الحد الأعلى.', en:'Well-managed Grade A trends toward the low end; older B/C stock (higher maintenance, weaker occupancy inflating the fixed-cost ratio) trends toward the high end.' },
  retail:          { min:0.20, max:0.30, ar:'عقود NNN تُحمِّل معظم مصاريف التشغيل على المستأجرين مباشرة — النسبة المتبقية على المالك هي غالباً إدارة عامة وتسويق المول والصيانة الرأسمالية غير القابلة للاستراد.', en:'NNN leases push most operating cost directly to tenants — the landlord-retained share is mostly general mall management, marketing, and non-recoverable capital maintenance.' },
  hospitality:     { min:0.55, max:0.70, ar:'الأعلى بين كل القطاعات — يشمل تكلفة تشغيل الغرف والمطاعم والرواتب الكثيفة؛ يعادل هامش ربح تشغيلي إجمالي (GOP Margin) ٣٠-٤٥٪ فقط من الإيراد.', en:'The highest of any sector — includes room/F&B operating cost and heavy payroll; equivalent to a Gross Operating Profit (GOP) margin of only 30-45% of revenue.' },
  logistics:       { min:0.10, max:0.20, ar:'الأدنى بين كل القطاعات — عقود NNN صناعية طويلة الأجل تحمّل شبه كل مصاريف التشغيل على المستأجر؛ من أهم أسباب جاذبية القطاع للمستثمرين المؤسسيين الباحثين عن دخل مستقر منخفض المخاطر.', en:'The lowest of any sector — long-term industrial NNN leases pass almost all operating cost to the tenant; a key reason this sector attracts institutional investors seeking stable, low-risk income.' },
  datacenter:      { min:0.35, max:0.45, ar:'كهرباء وتبريد وأمن وصيانة أنظمة حرجة تشغّل باستمرار على مدار الساعة — مرتفعة لكن مصحوبة بإيراد للمتر أعلى بكثير من أي قطاع آخر، فالهامش الصافي غالباً يبقى مرتفعاً.', en:'Power, cooling, security, and continuous critical-systems maintenance run around the clock — high in absolute terms, but paired with a per-m² revenue far above any other sector, so the net margin usually stays strong.' },
  healthcare:      { min:0.35, max:0.50, ar:'العيادات/المكاتب الطبية عند الحد الأدنى، المستشفيات المتكاملة (تشمل معدات طبية وصيانة متخصصة مكلفة) عند الحد الأعلى.', en:'Medical office/clinics at the low end, full-service hospitals (specialized, costly medical-equipment maintenance) at the high end.' },
  education:       { min:0.25, max:0.35, ar:'مصاريف تشغيل تعليمي عادة أقل تقلباً من التجاري — عقود إيجار طويلة الأجل مع مؤسسات تعليمية مستقرة الإشغال.', en:'Educational operating cost is typically less volatile than commercial retail — long-term leases with occupationally-stable educational institutions.' },
  entertainment:   { min:0.45, max:0.60, ar:'منشآت ترفيه ومطاعم/مناسبات كثيفة العمالة والصيانة الفنية (معدات، سلامة، تنظيف مكثف) — أقرب لهامش الضيافة من هامش التجزئة العادي.', en:'Entertainment/F&B/events venues are staffing- and technical-maintenance-heavy (equipment, safety, intensive cleaning) — closer to hospitality-grade margins than standard retail.' },
  parking:         { min:0.30, max:0.40, ar:'مواقف مُدارة تجارياً (تذاكر/اشتراكات) تحمل تكلفة تشغيل وتقنية وصيانة إنشائية حقيقية، لا تكلفة رمزية — تُقيَّم كمصدر إيراد مستقل عند وجود نظام تحصيل فعلي.', en:'Commercially-operated parking (ticketing/subscriptions) carries real operating, technology, and structural-maintenance cost, not a token cost — treated as an independent revenue source only when an actual collection system exists.' },
  mep_infra:       null,
  site_masterplan: null,
  fuel_highway:    { min:0.15, max:0.25, ar:'تشغيل محطات الوقود وخدمة الطرق نموذج حجم مرتفع/هامش منخفض شبيه بـNNN — مصاريف تشغيل محدودة نسبياً مقابل حجم الإيراد.', en:'Fuel/highway-service operations are a high-volume, low-margin, NNN-like model — relatively contained operating cost against revenue volume.' },
  amenities:       null,
};

function fmtPctRange(core, min, max){ return `${core.fmtPct(min,0)} – ${core.fmtPct(max,0)}`; }

function feeStatusBadge(core, val, fb){
  if(val==null || !isFinite(val)) return `<span class="tag" style="background:var(--surface-2); color:var(--ink-faint);">—</span>`;
  if(val < fb.min) return `<span class="tag" style="background:var(--surface-2); color:var(--ink-faint);" title="${core.T('أقل من النطاق المعتاد — عادة إيجابي للصندوق، لكن تأكد أنه يغطي التكاليف التشغيلية الفعلية','Below the typical range — usually favorable to the fund, but confirm it still covers actual operating cost')}">🔵 ${core.T('أقل من المعتاد','Below typical')}</span>`;
  if(val > fb.max) return `<span class="tag" style="background:var(--warn-soft); color:var(--warn);" title="${core.T('أعلى من النطاق المؤسسي المعتاد — يستدعي تبريراً في مذكرة اللجنة','Above the typical institutional range — needs justification in the IC memo')}">⚠️ ${core.T('أعلى من المعتاد','Above typical')}</span>`;
  return `<span class="tag" style="background:var(--good-soft); color:var(--good);">✅ ${core.T('ضمن النطاق المؤسسي','Within institutional range')}</span>`;
}

function feeBenchmarkRow(core, fb, d, compact){
  const val = d? core.getPath(d, fb.path) : null;
  return `<tr>
    <td style="font-size:${compact?'10.5px':'11.5px'};">${fb.icon} ${core.T(fb.ar, fb.en)}</td>
    <td class="num mono" style="font-size:${compact?'10.5px':'11.5px'};">${fmtPctRange(core, fb.min, fb.max)}</td>
    ${d? `<td class="num mono" style="font-size:${compact?'10.5px':'11.5px'};">${val!=null? core.fmtPct(val,2) : '—'}</td><td>${feeStatusBadge(core, val, fb)}</td>` : ''}
  </tr>`;
}

function feeBenchmarkTable(core, d, compact){
  return `<div class="tablewrap"><table class="db" style="font-size:11px;">
    <thead><tr><th>${core.T('البند','Item')}</th><th>${core.T('النطاق المؤسسي المعتاد','Typical institutional range')}</th>
      ${d? `<th>${core.T('قيمة الفرصة','This opportunity')}</th><th>${core.T('الحالة','Status')}</th>` : ''}
    </tr></thead>
    <tbody>${FEE_BENCHMARKS.map(fb=>feeBenchmarkRow(core, fb, d, compact)).join('')}</tbody>
  </table></div>`;
}

function waterfallExplainerHtml(core, d, c){
  const amt = c? {
    roc: c.roc, pref: c.pref, catchup: c.catchup, carryPool: c.carryPool,
    lpBonus: c.lpBonus, gpManager: c.gpManager, devPromote: c.devPromote,
    lpTotal: c.lpTotal, gpTotal: c.gpTotal, devTotal: c.devTotal,
  } : null;
  return `
  <div class="section" style="margin-bottom:10px;">
    ${WATERFALL_TIERS.map(t=>`
    <div class="section" style="margin-bottom:8px; background:var(--surface-2); border:1px dashed var(--border);">
      <p class="step-sub" style="margin:0 0 4px;">${t.icon} ${core.T(t.ar, t.en)}</p>
      <p class="note" style="margin:0; font-size:11.5px; line-height:1.8;">${core.T(t.descAr, t.descEn)}</p>
      ${amt && t.key==='roc'? `<p class="note" style="margin:6px 0 0; font-weight:700;">${core.T('المبلغ الفعلي','Actual amount')}: ${core.fmtSAR(amt.roc)}</p>` : ''}
      ${amt && t.key==='pref'? `<p class="note" style="margin:6px 0 0; font-weight:700;">${core.T('المبلغ الفعلي','Actual amount')}: ${core.fmtSAR(amt.pref)}</p>` : ''}
      ${amt && t.key==='catchup'? `<p class="note" style="margin:6px 0 0; font-weight:700;">${core.T('المبلغ الفعلي (للمدير بالكامل)','Actual amount (fully to GP)')}: ${core.fmtSAR(amt.catchup)}</p>` : ''}
      ${amt && t.key==='residual'? `<p class="note" style="margin:6px 0 0; font-weight:700;">${core.T('مجمّع الأداء الإجمالي','Total carry pool')}: ${core.fmtSAR(amt.carryPool)} — ${core.T('منها للمستثمرين (Bonus)','of which to LPs (bonus)')} ${core.fmtSAR(amt.lpBonus)}، ${core.T('لمدير الصندوق','to fund manager')} ${core.fmtSAR(amt.gpManager)}، ${core.T('للمطوّر (Promote)','to developer (promote)')} ${core.fmtSAR(amt.devPromote)}</p>` : ''}
    </div>`).join('')}
    ${amt? `<div class="livebox"><div class="lg">
      <div class="li">${core.T('إجمالي عائد المستثمرين (LP Total)','Total LP return')}<b>${core.fmtSAR(amt.lpTotal)}</b></div>
      <div class="li">${core.T('إجمالي عائد المدير (GP Total)','Total GP return')}<b>${core.fmtSAR(amt.gpTotal)}</b></div>
      <div class="li">${core.T('إجمالي عائد المطوّر (Dev Total)','Total developer return')}<b>${core.fmtSAR(amt.devTotal)}</b></div>
    </div></div>` : ''}
  </div>`;
}

function opexSectorRow(core, sectorKey, actualOpex){
  const b = OPEX_BY_SECTOR[sectorKey];
  const label = SECTORS[sectorKey]? core.T(SECTORS[sectorKey].ar, SECTORS[sectorKey].en) : sectorKey;
  if(!b) return `<tr><td>${label}</td><td colspan="3" style="color:var(--ink-faint); font-size:11px;">${core.T('قطاع داعم/بنية عامة — لا نطاق OPEX مستقل له (لا يُنتج إيراداً مستقلاً)','Supporting/structural sector — no independent OPEX ratio (does not generate independent revenue)')}</td></tr>`;
  const status = actualOpex==null? '—' : (actualOpex<b.min? `🔵 ${core.T('أقل من المعتاد','Below typical')}` : actualOpex>b.max? `⚠️ ${core.T('أعلى من المعتاد','Above typical')}` : `✅ ${core.T('ضمن النطاق','Within range')}`);
  return `<tr>
    <td>${label}</td>
    <td class="num mono">${fmtPctRange(core, b.min, b.max)}</td>
    <td class="num mono">${actualOpex!=null? core.fmtPct(actualOpex,1) : '—'}</td>
    <td>${status}</td>
  </tr>`;
}

export function registerFundFeesOpexLibrary(core){
  core.registerDataCollection(OVERRIDES_COLLECTION);
  let currentTab = 'fees'; // 'fees' | 'waterfall' | 'opex' — حالة عرض محلية فقط، بنفس منطق currentSectorFilter في space-efficiency-library.js

  core.registerTopbarButton(()=>{
    return `<button class="btn btn-sm" data-action="feeopex-open">💰 ${core.T('رسوم ومصاريف الصندوق','Fund Fees & Opex Library')}</button>`;
  });

  /* (أ) لحظة إدخال خطوة "رسوم الصندوق" (Step 7) */
  core.registerWizardStepExtra(7, (d)=>{
    return `
    <div class="section" style="margin-top:16px; background:var(--surface-2); border:1px dashed var(--border);">
      <p class="step-sub" style="margin:0 0 8px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <span>💰 ${core.T('مقارنة فورية بالنطاقات المؤسسية المعتادة','Live comparison against typical institutional ranges')}</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="feeopex-open">📚 ${core.T('المكتبة الكاملة','Full library')}</button>
      </p>
      ${feeBenchmarkTable(core, d, true)}
      <p class="note" style="margin:8px 0 0; font-size:11px;">${core.T('مؤشر معلوماتي فقط — لا يُغيِّر أي رقم مُدخَل. معدل العائد المستهدف وحصة الأداء (Hurdle/Carry) تُدخَل في خطوة "اقتصاديات الصندوق" السابقة، وتُقارَن هنا لعرض الصورة الكاملة.','Informational only — does not change any entered value. The hurdle rate and carried interest are entered in the earlier "Fund Economics" step, and shown here too for the complete picture.')}</p>
    </div>`;
  });

  /* (ب) صفحة الفرصة المحفوظة — نفس المقارنة + Waterfall بالأرقام الحقيقية + OPEX حسب قطاع الفرصة */
  core.registerDetailSection((d,c)=>{
    const sectors = USE_TYPE_TO_SECTORS[d.meta.useType] || [];
    return `
    <div class="section">
      <h3>💰 ${core.T('رسوم الصندوق والمصاريف التشغيلية — مقارنة مؤسسية','Fund Fees & Operating Expenses — Institutional Comparison')}</h3>
      ${feeBenchmarkTable(core, d, false)}
      <div class="section" style="margin-top:12px; background:var(--surface-2);">
        <p class="step-sub" style="margin:0 0 6px;">🌊 ${core.T('بنية توزيع الأرباح (Waterfall) بالأرقام الفعلية','Distribution waterfall — actual figures')}</p>
        ${waterfallExplainerHtml(core, d, c)}
      </div>
      ${sectors.length? `
      <div class="section" style="margin-top:12px; background:var(--surface-2);">
        <p class="step-sub" style="margin:0 0 6px;">🧾 ${core.T('نسبة المصاريف التشغيلية المرجعية للقطاع','Sector OPEX ratio benchmark')}</p>
        <div class="tablewrap"><table class="db" style="font-size:11px;">
          <thead><tr><th>${core.T('القطاع','Sector')}</th><th>${core.T('النطاق المرجعي','Benchmark range')}</th><th>${core.T('قيمة الفرصة','This opportunity')}</th><th>${core.T('الحالة','Status')}</th></tr></thead>
          <tbody>${sectors.map(sk=>opexSectorRow(core, sk, d.income? d.income.opex : null)).join('')}</tbody>
        </table></div>
      </div>` : ''}
    </div>`;
  });

  /* (ج) Main View كاملة — تبويبات رسوم/Waterfall/OPEX + تجاوزات محلية (FM+) */
  core.registerMainView('fund-fees-opex', ()=>{
    const overrides = core.STORE[OVERRIDES_COLLECTION] || [];
    return `
    <div class="section" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 style="margin:0;">💰 ${core.T('مكتبة رسوم الصندوق والمصاريف التشغيلية المرجعية','Fund Fees & Opex Benchmark Library')}</h2>
        <p class="note" style="margin:4px 0 0;">${core.T('بنود رسوم مرجعية','Reference fee items')}: <b>${FEE_BENCHMARKS.length}</b> &nbsp;·&nbsp; ${core.T('تجاوزات/ملاحظات الفريق المحلية','Team local overrides/notes')}: <b>${overrides.length}</b></p>
      </div>
      <button class="btn btn-sm btn-ghost" data-action="feeopex-close">✖ ${core.T('إغلاق ورجوع للوحة الفرص','Close & return to dashboard')}</button>
    </div>

    <div class="section" style="margin-bottom:14px;">
      <div class="small-btns">
        <button type="button" class="btn btn-sm ${currentTab==='fees'?'btn-primary':'btn-ghost'}" data-action="feeopex-tab" data-tab="fees">💰 ${core.T('رسوم الصندوق','Fund fees')}</button>
        <button type="button" class="btn btn-sm ${currentTab==='waterfall'?'btn-primary':'btn-ghost'}" data-action="feeopex-tab" data-tab="waterfall">🌊 ${core.T('توزيع الأرباح (Waterfall)','Distribution waterfall')}</button>
        <button type="button" class="btn btn-sm ${currentTab==='opex'?'btn-primary':'btn-ghost'}" data-action="feeopex-tab" data-tab="opex">🧾 ${core.T('المصاريف التشغيلية حسب القطاع','Opex by sector')}</button>
      </div>
    </div>

    ${currentTab==='fees'? feeBenchmarkTable(core, null, false) : ''}
    ${currentTab==='waterfall'? waterfallExplainerHtml(core, null, null) : ''}
    ${currentTab==='opex'? `<div class="tablewrap"><table class="db" style="font-size:11px;">
      <thead><tr><th>${core.T('القطاع','Sector')}</th><th>${core.T('النطاق المرجعي','Benchmark range')}</th><th></th><th></th></tr></thead>
      <tbody>${Object.keys(SECTORS).map(sk=>opexSectorRow(core, sk, null)).join('')}</tbody>
    </table></div>` : ''}

    <div class="section" style="margin-top:14px;">
      <p class="step-sub" style="margin:0 0 8px;">📝 ${core.T('تجاوزات/ملاحظات معايرة محلية للفريق','Team local calibration overrides/notes')}</p>
      <div class="tablewrap"><table class="db" style="font-size:11.5px;">
        <thead><tr><th>${core.T('البند','Item')}</th><th>${core.T('ملاحظة','Note')}</th><th>${core.T('أضافها','Added by')}</th><th>${core.T('الحالة','Status')}</th></tr></thead>
        <tbody>
          ${overrides.map(rec=>{
            const o = rec.data;
            return `<tr>
              <td>${core.esc(o.label||'—')}</td>
              <td style="font-size:11px; color:var(--ink-faint);">${core.esc(o.note||'—')}</td>
              <td style="font-size:11px;">${core.esc(o.addedBy||'—')}</td>
              <td>
                ${certifyBadge(core, o)}
                ${canManageLibraries(core)? `<div class="small-btns" style="margin-top:4px;">
                  ${!o.certified? `<button class="btn btn-sm btn-ghost" data-action="feeopex-certify-override" data-id="${rec.id}">✅</button>` : ''}
                  <button class="btn btn-sm btn-ghost" data-action="feeopex-delete-override" data-id="${rec.id}">🗑️</button>
                </div>` : ''}
              </td>
            </tr>`;
          }).join('')}
          ${!overrides.length? `<tr><td colspan="4" style="text-align:center; padding:14px; color:var(--ink-faint);">${core.T('لا توجد ملاحظات محلية بعد.','No local notes yet.')}</td></tr>` : ''}
        </tbody>
      </table></div>
      ${canManageLibraries(core)? `
      <div class="section" style="margin-top:10px; background:var(--surface-2); border:1px dashed var(--border);">
        <form id="feeopex-add-form" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:8px;">
          <input type="text" name="label" placeholder="${core.T('اسم البند','Item name')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="text" name="note" placeholder="${core.T('ملاحظة/معايرة محلية','Note / local calibration')}" style="grid-column:1/-1; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        </form>
        <button type="button" class="btn btn-sm btn-primary" style="margin-top:8px;" data-action="feeopex-add-override">➕ ${core.T('إضافة','Add')}</button>
      </div>` : `
      <div class="section" style="margin-top:10px; background:var(--surface-2); border:1px dashed var(--border);">
        <p class="note" style="margin:0;">🔒 ${core.T('إضافة/تصديق/حذف الملاحظات المحلية يتطلب صلاحية مدير صندوق فأعلى.','Adding, certifying, or deleting local notes requires Fund Manager tier or above.')}</p>
      </div>`}
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='feeopex-open'){ core.setCoreState({ mainView:'fund-fees-opex', openDetailId:null, render:true }); return true; }
    if(action==='feeopex-close'){ core.setCoreState({ mainView:null, render:true }); return true; }
    if(action==='feeopex-tab'){ currentTab = el.dataset.tab || 'fees'; core.render(); return true; }
    if(action==='feeopex-add-override'){
      if(!canManageLibraries(core)) return true;
      const form = document.getElementById('feeopex-add-form');
      if(!form) return true;
      const g = name => form.querySelector(`[name="${name}"]`).value.trim();
      const label = g('label');
      if(!label) return true;
      const rec = { id: core.uid('FEEO'), data: {
        label, note: g('note') || null,
        addedBy: core.currentUser? core.currentUser.email : (core.DEMO_MODE? 'زائر تجريبي':'محلي'),
        certified: false, certifiedBy: null, certifiedAt: null,
      }};
      await core.persistIfRecord(OVERRIDES_COLLECTION, rec);
      core.render();
      return true;
    }
    if(action==='feeopex-certify-override'){
      if(!canManageLibraries(core)) return true;
      const rec = (core.STORE[OVERRIDES_COLLECTION]||[]).find(r=>r.id===el.dataset.id);
      if(!rec) return true;
      const updated = { id: rec.id, data: { ...rec.data, certified:true, certifiedBy: core.currentUser? core.currentUser.email : 'محلي', certifiedAt: new Date().toISOString() } };
      await core.persistIfRecord(OVERRIDES_COLLECTION, updated);
      core.render();
      return true;
    }
    if(action==='feeopex-delete-override'){
      if(!canManageLibraries(core)) return true;
      await core.deleteIfRecord(OVERRIDES_COLLECTION, el.dataset.id);
      core.render();
      return true;
    }
    return false;
  });
}

export { FEE_BENCHMARKS, WATERFALL_TIERS };
