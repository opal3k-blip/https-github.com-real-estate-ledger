/* =========================================================================
   قنوات الخروج المؤسسية للصندوق — Fund-Level Exit Channels (المرحلة ٤، النظام الثالث)
   ---------------------------------------------------------------------------
   ⚠️ تمييز مهم لا يجب الخلط فيه: core.js يحتوي أصلاً على حقلين متعلقين بـ"الخروج"
   لكنهما بمعنى مختلف تماماً عن هذا الطلب:
     • strategy.exitStrategy (فرص التطوير) — EXIT_STRATEGIES: بيع كامل / تأجير
       وإبقاء / مختلط / إعادة تمويل — هذا "شكل التخارج على مستوى الأصل نفسه"
       (نسبة البيع مقابل التأجير) ويدخل مباشرة في compute() لحساب الإيراد.
     • income.holdStrategy (فرص الدخل) — exit_sale / refinance_close /
       perpetual_hold — نفس الفكرة (هل يُباع الأصل أم يُعاد تمويله أم يُحتفَظ
       به للأبد) وتدخل أيضاً في compute().
   الطلب الجديد هنا مختلف: "من هو المشتري/القناة التي يخرج الصندوق من خلالها"
   (REIT بالجملة، بيع بالوحدة، إدراج علني، تصفية كاملة عند إغلاق الصندوق...) —
   بُعد تسعيري/تشغيلي إضافي (Buyer Channel) فوق ما سبق، لا بديلاً عنه. فرصة
   واحدة قد تُخطَّط لتُباع "بيعاً كاملاً" (exitStrategy) والقناة المخطَّطة لهذا
   البيع هي "REIT بالجملة" مثلاً — الحقلان يتكاملان، لا يتعارضان.

   لذلك أضفنا حقلاً جديداً تماماً (exit.channel) عبر registerOpportunitySchemaExtender،
   دون لمس EXIT_STRATEGIES/holdStrategy الحالية إطلاقاً. القناة تُضيف طبقة تحليل
   إضافية إعلامية (علاوة/خصم سعري نمطي، تكلفة صفقة، جدول زمني، حد أدنى لحجم
   الصفقة) — تُعرَض كـ"تحليل استكشافي" (Indicative Overlay) بجانب الرقم الرسمي
   المحسوب من compute() في core.js، ولا تُعدِّله أو تستبدله — احتراماً لقاعدة
   "لا تعديل على منطق core.js الداخلي".

   التسميات المُعتمَدة (بعد مراجعة طلب المستخدم الخماسي واقتراح قناة سادسة):
     1. individual_sale   — بيع مباشر لمشتر واحد (خارج السوق) / Off-Market Single-Buyer Sale [الافتراضي — يطابق الاحتساب الحالي دون أي تعديل]
     2. reit_bulk_sale    — بيع بالجملة لصندوق REIT / REIT Bulk (Portfolio) Sale
     3. strata_sale       — بيع جزئي بالوحدة (Strata) / Strata / Unit-by-Unit Sale
     4. refinance_hold    — إعادة تمويل والاحتفاظ / Refinance & Hold [يوثّق نية القناة — احتساب الأثر الفعلي فعلاً عبر income.holdStrategy/refinance_close أو perpetual_hold أعلى — انظر الملاحظة الإرشادية أدناه]
     5. reit_ipo          — تحويل لصندوق مُدرَج (طرح عام) / IPO — Public REIT Listing
     6. fund_winddown     — إغلاق الصندوق وبيع كامل الوحدات / Full Fund Wind-Down (Forced Liquidation)
   ========================================================================= */

const CHANNELS = {
  individual_sale: {
    ar:'بيع مباشر لمشتر واحد (خارج السوق)', en:'Off-Market Single-Buyer Sale', icon:'🤝',
    capRateAdjustBps: 0, exitCostPct: 0.02, timeline:'3-6 ' + 'م',
    notesAr: 'القناة الافتراضية (تطابق تماماً ما يحسبه النموذج الرسمي دون أي تعديل). تكلفة صفقة نمطية ٢٪ (سمسرة+قانوني). أسرع القنوات تنفيذاً لكنها الأضيق من ناحية عدد المشترين المحتملين (سعر تفاوضي فردي، لا سعر سوق مُكتشَف عبر منافسة).',
    notesEn: 'The default channel (matches the official model exactly, no adjustment). Typical transaction cost ~2% (brokerage+legal). Fastest to execute but the narrowest buyer pool (a negotiated single price, not a competition-discovered market price).',
  },
  reit_bulk_sale: {
    ar:'بيع بالجملة لصندوق REIT', en:'REIT Bulk (Portfolio) Sale', icon:'🏦',
    capRateAdjustBps: -50, exitCostPct: 0.015, timeline:'4-8 ' + 'م',
    notesAr: 'صناديق REIT تدفع غالباً علاوة سعرية (معدل رسملة أضيق بحوالي ٢٥-٧٥ نقطة أساس) على الأصول المُستقرة ذات دخل تشغيلي موثّق (٢-٣ سنوات تاريخ إشغال/تحصيل) وWALE مريح — لكنها تطلب عناية واجبة (Due Diligence) أعمق ووقتاً أطول نسبياً، وتفضّل حجم صفقة أكبر (كفاءة تكلفة العناية الواجبة). تكلفة صفقة أقل من البيع الفردي (لا تسويق تجزيء، مفاوض واحد مؤسسي).',
    notesEn: 'REITs often pay a price premium (roughly 25-75bps tighter cap rate) for stabilized assets with a documented 2-3yr occupancy/collection history and comfortable WALE — but require deeper due diligence and a longer process, and prefer larger deal sizes (DD-cost efficiency). Lower transaction cost than an individual sale (no fragmented marketing, one institutional counterparty).',
  },
  strata_sale: {
    ar:'بيع جزئي بالوحدة (Strata)', en:'Strata / Unit-by-Unit Sale', icon:'🧩',
    capRateAdjustBps: null, exitCostPct: 0.065, timeline:'12-36 ' + 'م',
    notesAr: 'لا تُقارَن بمعدل رسملة — تُسعَّر بجمع أسعار الوحدات الفردية، وهي عادة أعلى إجمالاً من سعر البيع بالجملة بنسبة "علاوة التجزئة" (Strata Premium) ١٥-٣٠٪ تقريباً — لكن بمقابل: جدول زمني أطول بكثير (بيع تدريجي وليس دفعة واحدة، امتصاص السوق يحدد السرعة)، وتكلفة صفقة أعلى (تسويق وحدة بوحدة، سمسرة متكررة، رسوم تسجيل ملكية لكل وحدة) — وتعرّض التدفق النقدي لمخاطر امتصاص السوق (Absorption Risk) بدل تحقق القيمة كاملة في يوم واحد.',
    notesEn: "Not comparable via cap rate — priced as the sum of individual unit prices, typically exceeding the bulk (wholesale) value by a ~15-30% \"strata premium\" — at the cost of a much longer timeline (gradual sale, paced by market absorption, not a single closing) and higher transaction cost (unit-by-unit marketing, repeated brokerage, per-unit title registration) — and exposes cash flow to absorption risk instead of realizing full value on one day.",
  },
  refinance_hold: {
    ar:'إعادة تمويل والاحتفاظ', en:'Refinance & Hold', icon:'🔄',
    capRateAdjustBps: null, exitCostPct: 0.01, timeline:'—',
    notesAr: 'ليست بيعاً فعلياً — الصندوق يحتفظ بالملكية ويستخرج جزءاً من رأس المال عبر قرض جديد (إعادة تمويل)، ويستمر الدخل التشغيلي. الأثر الفعلي على IRR/MOIC يُحتسَب رسمياً في core.js عبر income.holdStrategy="refinance_close" (إغلاق الصندوق بعد إعادة تمويل واحدة) أو "perpetual_hold" (إعادة تمويل دورية بلا بيع نهائي) — اختيار هذه القناة هنا وثيقة نية تخطيطية فقط؛ فعّل التأثير الحسابي الحقيقي من حقل "استراتيجية الاحتفاظ" في خطوة "الإيراد والخروج".',
    notesEn: 'Not an actual sale — the fund retains ownership and extracts a portion of capital via a new loan (refinance), while operating income continues. The real IRR/MOIC impact is computed officially in core.js via income.holdStrategy="refinance_close" (fund closes after one refinance) or "perpetual_hold" (recurring refinance, never sold) — selecting this channel here is a planning-intent note only; activate the real computational effect from the "Hold strategy" field in the Revenue & Exit step.',
  },
  reit_ipo: {
    ar:'تحويل لصندوق مُدرَج (طرح عام)', en:'IPO — Public REIT Listing', icon:'📈',
    capRateAdjustBps: -25, exitCostPct: 0.045, timeline:'12-24 ' + 'م',
    notesAr: 'قناة على مستوى محفظة كاملة لا أصل منفرد — تتطلب حجم أصول مُدارة (AUM) كبيراً غالباً (مئات الملايين للمليار ريال+) ودخلاً موثقاً ومتنوعاً عبر أصول متعددة. الأسواق العامة غالباً تُسعِّر دخلاً مستقراً ومتنوعاً بعلاوة (معدل رسملة أضيق نسبياً ٢٥ نقطة أساس تقريباً) — لكن تكاليف الإدراج (استشارات قانونية، هيئة السوق المالية، متعهد التغطية، تسويق للمستثمرين) مرتفعة (~٤-٥٪ من القيمة) وأطول القنوات زمنياً، مع أعباء إفصاح وحوكمة مستمرة بعد الإدراج لا تنتهي بإغلاق الصفقة.',
    notesEn: 'A whole-portfolio channel, not a single-asset one — typically needs substantial AUM (hundreds of millions to billions SAR) and documented, diversified income across multiple assets. Public markets often price stable, diversified income at a premium (cap rate roughly 25bps tighter) — but listing costs (legal counsel, market regulator, underwriter, investor roadshow) are high (~4-5% of value) and it is the longest channel, with ongoing disclosure/governance burden that continues well past closing.',
  },
  fund_winddown: {
    ar:'إغلاق الصندوق وبيع كامل الوحدات', en:'Full Fund Wind-Down (Forced Liquidation)', icon:'🏁',
    capRateAdjustBps: 100, exitCostPct: 0.03, timeline:'6-12 ' + 'م',
    notesAr: 'يحدث عادة عند نهاية العمر الافتراضي للصندوق (Fund Term) — بيع كل الأصول المتبقية دفعة واحدة أو ضمن نافذة زمنية قصيرة محددة. المشترون يعلمون بضغط الوقت على البائع (Known Deadline Leverage) فيطلبون خصماً (معدل رسملة أوسع ~٥٠-١٥٠ نقطة أساس، وأحياناً أكثر لمحفظة كبيرة يجب تصفيتها سريعاً) — من أهم أسباب التخطيط المبكر لمدة الصندوق وعدم ترك التخارج لآخر لحظة. يستحق إفصاحاً واضحاً للمستثمرين (LPs) عن هذا الخصم المتوقع ضمن أي مذكرة تمديد/إغلاق.',
    notesEn: "Typically happens at the end of the fund's term — selling all remaining assets at once or within a short mandated window. Buyers know the seller is under a deadline (\"known deadline leverage\") and price in a discount (cap rate widens ~50-150bps, sometimes more for a large portfolio needing fast liquidation) — a key reason to plan fund term and exit timing early rather than leaving it to the last moment. Deserves clear LP disclosure of this expected discount in any extension/wind-down memo.",
  },
};
const CHANNEL_ORDER = ['individual_sale','reit_bulk_sale','strata_sale','refinance_hold','reit_ipo','fund_winddown'];

function channelLabel(core, key){
  const c = CHANNELS[key];
  return c? `${c.icon} ${core.T(c.ar, c.en)}` : (key||'—');
}

function overlayBox(core, d, c){
  const chKey = (d.exit && d.exit.channel) || 'individual_sale';
  const ch = CHANNELS[chKey];
  if(!ch) return '';
  const isDev = d.meta.oppType==='development';
  const officialCap = isDev? d.development.exitCapRate : d.wacc.marketCap;
  // قيمة الخروج الرسمية ليست حقلاً مباشراً على c — هي آخر سنة خروج ضمن c.pnlRows (نفس المصدر
  // الذي يستخدمه core.js نفسه في مذكرة/تصدير الفرصة — انظر renderDetail/excel-workbook.js).
  const exitRows = (c && Array.isArray(c.pnlRows))? c.pnlRows.filter(r=>r.isExitYear && r.exitValue>0) : [];
  const officialVal = exitRows.length? exitRows[exitRows.length-1].exitValue : null;
  let adjustedNote = '';
  if(ch.capRateAdjustBps!=null && officialCap!=null && officialCap - ch.capRateAdjustBps/10000 > 0){
    const adjCap = officialCap - (ch.capRateAdjustBps/10000); // نقصان معدل الرسملة = ارتفاع سعر — bps موجبة تعني خصماً (توسيع الرسملة) هنا حسب علامة القناة أعلاه
    const ratio = officialCap / adjCap;
    adjustedNote = `<div class="li">${core.T('معدل رسملة مُعدَّل استكشافياً (Indicative)','Indicative adjusted cap rate')}<b>${core.fmtPct(adjCap)}</b> <span style="color:var(--ink-faint); font-size:11px;">(${ch.capRateAdjustBps>0?'+':''}${ch.capRateAdjustBps} bps ${core.T('vs. الأساسي','vs. baseline')})</span></div>
    ${officialVal!=null? `<div class="li">${core.T('قيمة خروج مُعدَّلة استكشافياً','Indicative adjusted exit value')}<b>${core.fmtSAR(officialVal*ratio)}</b> <span style="color:var(--ink-faint); font-size:11px;">${core.T('(الرسمي','(official')} ${core.fmtSAR(officialVal)})</span></div>` : ''}`;
  }
  return `
  <div class="section" style="margin-top:10px; background:var(--surface-2); border:1px dashed var(--border);">
    <p class="step-sub" style="margin:0 0 6px;">${ch.icon} ${core.T('قناة الخروج المخطَّطة','Planned exit channel')}: ${core.T(ch.ar, ch.en)}</p>
    <div class="livebox">
      <div class="lg">
        <div class="li">${core.T('تكلفة صفقة نمطية','Typical transaction cost')}<b>${core.fmtPct(ch.exitCostPct)}</b></div>
        <div class="li">${core.T('الجدول الزمني النمطي','Typical timeline')}<b>${core.esc(ch.timeline)}</b></div>
        ${adjustedNote}
      </div>
    </div>
    <p class="note" style="margin-top:8px; line-height:1.8;">${core.T(ch.notesAr, ch.notesEn)}</p>
    <p class="note" style="margin-top:6px; font-size:11px; color:var(--ink-faint);">${core.T('⚠️ تحليل استكشافي إعلامي (Indicative Overlay) — لا يُعدِّل أي رقم رسمي محسوب من محرك الاكتتاب؛ الأرقام الرسمية (IRR/MOIC/DSCR) تبقى كما تحسبها بيانات الفرصة الفعلية دائماً.','⚠️ Indicative informational overlay — does not alter any officially-computed figure from the underwriting engine; official numbers (IRR/MOIC/DSCR) always remain exactly as computed from the opportunity\'s actual data.')}</p>
  </div>`;
}

export function registerExitChannels(core){
  core.registerOpportunitySchemaExtender(()=>({ exit: { channel: 'individual_sale' } }));

  /* لحظة الإدخال — نفس خطوة "الإيراد والخروج" (Step 4) حيث يوجد exitStrategy/holdStrategy
     أصلاً، ليظهر اختيار القناة في سياقه الطبيعي. نستخدم data-action="choose" الموجودة أصلاً
     في core.js (تُنفِّذ setPath(wizard.draft, path, value) ثم render() لأي مسار) — بدون أي
     إجراء مخصّص جديد، ودون الاعتماد على أي عنصر <select> (تجنّباً لمشكلة عدم استماع core.js
     لحدث change على أي data-action مخصّص — انظر ملاحظة roles-permissions.js). */
  core.registerWizardStepExtra(4, (d)=>{
    const chKey = (d.exit && d.exit.channel) || 'individual_sale';
    return `
    <div class="section" style="margin-top:16px; background:var(--surface-2); border:1px dashed var(--border);">
      <p class="step-sub" style="margin:0 0 8px;">🚪 ${core.T('قناة الخروج المخطَّطة للصندوق (اختياري — تحليل استكشافي إضافي)','Planned fund exit channel (optional — additional indicative analysis)')}</p>
      <div class="small-btns" style="flex-wrap:wrap;">
        ${CHANNEL_ORDER.map(k=>`<button type="button" class="btn btn-sm ${k===chKey?'btn-primary':'btn-ghost'}" data-action="choose" data-path="exit.channel" data-value="${k}">${channelLabel(core,k)}</button>`).join('')}
      </div>
      ${overlayBox(core, d, null)}
    </div>`;
  });

  /* صفحة الفرصة المحفوظة — نفس التحليل الاستكشافي، هذه المرة مع c (النتائج المحسوبة رسمياً)
     لعرض قيمة الخروج المُعدَّلة استكشافياً مقارنةً بالرسمية. */
  core.registerDetailSection((d, c)=>{
    const chKey = (d.exit && d.exit.channel) || 'individual_sale';
    return `
    <div class="section">
      <h3>🚪 ${core.T('قناة الخروج وتحليلها الاستكشافي','Exit Channel & Indicative Analysis')}</h3>
      ${overlayBox(core, d, c)}
    </div>`;
  });
}

export { CHANNELS, CHANNEL_ORDER, channelLabel };
