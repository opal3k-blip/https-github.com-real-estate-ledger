/* =========================================================================
   السياق الاقتصادي الكلي ومشاريع رؤية ٢٠٣٠ الكبرى — Macro Context Layer
   (المرحلة ٦، النظام الثالث)
   ---------------------------------------------------------------------------
   طلب المستخدم: "طبقة السياق الاقتصادي الكلي على الخريطة". هذا الملف يوفّر:
   (أ) قائمة مواقع تقريبية لأكبر مشاريع رؤية ٢٠٣٠ (MEGAPROJECTS، مُصدَّرة)
       تُرسَم كطبقة إضافية اختيارية فوق خريطة الفرص (opportunities-map.js
       يستوردها ويرسمها — انظر التعليق في رأس ذلك الملف لسبب فصلها هنا بدل
       تعريفها مباشرة هناك: تفادي استيراد دائري مع geo-utils.js المشترك)،
   (ب) قسم تفصيلي على صفحة كل فرصة يحسب "أقرب مشروع رؤية ٢٠٣٠" فعلياً (خط
       مباشر بصيغة Haversine من geo-utils.js) — قرب فرصة من مشروع كبرى عامل
       سوقي حقيقي يرفع الطلب المتوقع على العقار (سكني/تجاري/فندقي) في محيطه.

   ⚠️ الإحداثيات هنا تقريبية بالضرورة (مواقع عامة لمشاريع تنموية شاسعة المساحة
   أحياناً، لا نقطة واحدة دقيقة) — تُستخدَم كسياق جغرافي/تسويقي فقط، ولا تدخل
   في أي حساب مالي فعلي (IRR/MOIC/Cap Rate...). لا تُعرَض كإحداثية GPS دقيقة
   لأي غرض هندسي أو قانوني.

   لا يُضاف أي حقل جديد لنموذج بيانات الفرصة في هذا الملف (بخلاف opportunities-
   map.js/sustainability-mostadam.js) — بيانات ثابتة بالكامل + قسم عرض واحد.
   ========================================================================= */

import { resolveOpportunityLatLng, haversineKm } from './geo-utils.js';

export const MEGAPROJECTS = [
  {
    key:'neom', lat:27.9833, lng:35.6667,
    ar:'نيوم', en:'NEOM',
    sectorAr:'مخطط إقليمي متكامل (سياحة، صناعة متقدمة، تقنية، طاقة متجددة)', sectorEn:'Integrated regional development (tourism, advanced industry, tech, renewable energy)',
    descAr:'أحد أكبر مشاريع رؤية ٢٠٣٠ مساحة — منطقة تنموية شاسعة شمال غرب المملكة على ساحل البحر الأحمر، تضم مشاريع فرعية معروفة مثل THE LINE وOxagon وtrojena.', descEn:'One of the largest-footprint Vision 2030 projects — a vast development region in the northwest on the Red Sea coast, including well-known sub-projects such as THE LINE, Oxagon, and Trojena.',
  },
  {
    key:'qiddiya', lat:24.6333, lng:46.2667,
    ar:'القدية', en:'Qiddiya',
    sectorAr:'مدينة الترفيه والرياضة والثقافة', sectorEn:'Entertainment, sports & culture city',
    descAr:'غرب الرياض بنحو ٤٠ كم — وجهة ترفيهية/رياضية/ثقافية كبرى تضم حلبات ومنتجعات ومرافق رياضية، من أقرب المشاريع الكبرى لمدينة الرياض جغرافياً.', descEn:'~40km west of Riyadh — a major entertainment/sports/cultural destination including race tracks, resorts, and sports facilities; among the megaprojects geographically closest to Riyadh.',
  },
  {
    key:'red_sea', lat:25.6, lng:36.9,
    ar:'مشروع البحر الأحمر', en:'The Red Sea Project',
    sectorAr:'سياحة فاخرة ومنتجعات جزرية', sectorEn:'Luxury tourism & island resorts',
    descAr:'وجهة سياحية فاخرة على ساحل البحر الأحمر (منطقة أملج تقريباً) تضم عشرات الجزر والمنتجعات المطوَّرة بمعايير استدامة بيئية عالية.', descEn:'A luxury tourism destination on the Red Sea coast (near Umluj) spanning dozens of islands and resorts developed to high environmental sustainability standards.',
  },
  {
    key:'amaala', lat:26.0, lng:36.5,
    ar:'أمالا', en:'AMAALA',
    sectorAr:'سياحة علاجية وصحية فائقة الفخامة', sectorEn:'Ultra-luxury wellness & healthy-living tourism',
    descAr:'وجهة سياحية فائقة الفخامة على الساحل الشمالي الغربي، تركّز على السياحة الصحية والعافية والفنون.', descEn:'An ultra-luxury destination on the northwest coast focused on wellness, healthy-living tourism, and the arts.',
  },
  {
    key:'diriyah', lat:24.7345, lng:46.5750,
    ar:'بوابة الدرعية', en:'Diriyah Gate',
    sectorAr:'تراث ثقافي وسياحة وضيافة', sectorEn:'Cultural heritage, tourism & hospitality',
    descAr:'حول موقع الطريف التاريخي (مسجَّل في اليونسكو) في الدرعية شمال غرب الرياض — مشروع ضخم للتراث والضيافة والتجزئة والسكن الفاخر.', descEn:'Centered on the historic At-Turaif site (a UNESCO World Heritage listing) in Diriyah, northwest Riyadh — a large-scale heritage, hospitality, retail, and luxury residential development.',
  },
  {
    key:'new_murabba', lat:24.75, lng:46.61,
    ar:'نيو مربع', en:'New Murabba',
    sectorAr:'وسط مدينة جديد (سكني/تجاري/ثقافي)', sectorEn:'New downtown district (residential/commercial/cultural)',
    descAr:'شمال الرياض — مركز حضري جديد يضم "المكعب" (Mukaab) كمعلم مركزي، ومساحات سكنية وتجارية وثقافية وترفيهية واسعة.', descEn:'North Riyadh — a new downtown urban core anchored by "The Mukaab" landmark structure, with extensive residential, commercial, cultural, and entertainment space.',
  },
  {
    key:'king_salman_park', lat:24.73, lng:46.63,
    ar:'حديقة الملك سلمان', en:'King Salman Park',
    sectorAr:'حديقة حضرية كبرى + تطوير عقاري محيط', sectorEn:'Major urban park + surrounding real estate development',
    descAr:'على أرض مطار الرياض القديم (مطار الملك خالد الدولي القديم) وسط الرياض — من أكبر الحدائق الحضرية في العالم عند اكتمالها، مع تطوير عقاري وتجاري وثقافي على محيطها يرفع قيمة الأصول القريبة منها.', descEn:'On the site of Riyadh\'s former airport, in central Riyadh — set to be one of the largest urban parks in the world on completion, with surrounding residential/commercial/cultural development lifting nearby asset values.',
  },
  {
    key:'jeddah_central', lat:21.48, lng:39.17,
    ar:'جدة سنترال', en:'Jeddah Central',
    sectorAr:'واجهة بحرية متكاملة (سكني/ترفيهي/رياضي)', sectorEn:'Integrated waterfront district (residential/entertainment/sports)',
    descAr:'على واجهة جدة البحرية — يضم أوشنريوم ومتحف رياضي وملعباً ومرسى يخوت ومساحات سكنية وتجارية.', descEn:'On Jeddah\'s waterfront — includes an oceanarium, a sports museum, a stadium, a marina, and residential/commercial space.',
  },
  {
    key:'roshn', lat:24.6, lng:46.72,
    ar:'روشن (تطوير سكني متعدد المدن)', en:'ROSHN (multi-city residential developer)',
    sectorAr:'تطوير سكني وطني (مجتمعات متكاملة)', sectorEn:'National residential developer (integrated communities)',
    descAr:'أحد أذرع صندوق الاستثمارات العامة العقارية — مطوّر مجتمعات سكنية متكاملة في عدة مدن سعودية (لا موقع واحد؛ الدبوس هنا تقريبي عند أحد أبرز مشاريعه بمحيط الرياض).', descEn:'A PIF real estate arm developing integrated residential communities across multiple Saudi cities (not a single site — this pin approximates one of its most prominent Riyadh-area projects).',
  },
];

export function registerMacroContext(core){
  core.registerDetailSection((d, c)=>{
    const loc = resolveOpportunityLatLng(d);
    if(loc.unmapped) return ''; // بلا موقع معروف أصلاً — لا معنى لحساب مسافة
    let nearest = null, nearestKm = Infinity;
    MEGAPROJECTS.forEach(mp=>{
      const km = haversineKm(loc.lat, loc.lng, mp.lat, mp.lng);
      if(km < nearestKm){ nearestKm = km; nearest = mp; }
    });
    if(!nearest) return '';
    return `
    <div class="section">
      <h3>⭐ ${core.T('السياق الاقتصادي الكلي — أقرب مشروع رؤية ٢٠٣٠','Macro Context — Nearest Vision 2030 Megaproject')}</h3>
      <div class="livebox"><div class="lg">
        <div class="li">${core.T('أقرب مشروع كبرى','Nearest megaproject')}<b>${core.esc(core.T(nearest.ar, nearest.en))}</b></div>
        <div class="li">${core.T('المسافة التقريبية (خط مباشر)','Approximate straight-line distance')}<b>${nearestKm.toFixed(0)} ${core.T('كم','km')}</b></div>
        <div class="li">${core.T('القطاع','Sector')}<b style="font-size:11.5px;">${core.esc(core.T(nearest.sectorAr, nearest.sectorEn))}</b></div>
      </div></div>
      <p class="note" style="margin-top:8px; font-size:11.5px; line-height:1.8;">${core.esc(core.T(nearest.descAr, nearest.descEn))}</p>
      <p class="note" style="margin-top:6px; font-size:11px; color:var(--ink-faint);">${core.T('القرب من مشروع كبرى عامل سوقي إيجابي عادة (طلب سكني/تجاري/فندقي مستقبلي متوقَّع)، لكنه لا يدخل في أي حساب مالي هنا — سياق تفاوضي/تسويقي فقط. المسافة تقريبية (خط مباشر لا مسافة طريق فعلية)، والموقع الدقيق لبعض المشاريع الشاسعة تقديري.','Proximity to a megaproject is typically a positive market factor (expected future residential/commercial/hospitality demand), but it feeds no financial calculation here — context for negotiation/marketing only. The distance is straight-line, not actual road distance, and some large projects\' exact location is approximate.')}</p>
    </div>`;
  });
}
