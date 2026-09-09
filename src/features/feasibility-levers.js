/* =========================================================================
   رافعات الجدوى القابلة للتفعيل — Actionable Feasibility Levers (المرحلة ٤، النظام الرابع)
   ---------------------------------------------------------------------------
   الفرق الجوهري عن أي "توصية" نصية موجودة أصلاً (مثل ai-analyst.js): كل رافعة هنا
   تُعاد حسابها فعلياً عبر core.compute() على نسخة مُعدَّلة من بيانات الفرصة (نفس
   الآلية المستخدمة في core.js لجدول الحساسية sensitivityRows ولمدير السيناريوهات
   scenario-manager.js — getPath/setPath/compute، بلا أي تكرار لمنطق core.js الداخلي)
   لتُعرض المقارنة الحقيقية (قبل/بعد: Equity IRR، MOIC، DSCR) — وليست وصفاً عاماً.
   وعند الضغط على "تطبيق" فعلاً (وبصلاحية تعديل الفرصة نفسها — canEditOpp)، يُكتَب
   نفس التعديل على السجل الحقيقي عبر core.persistOpportunity() ثم core.render() —
   فيتغيّر IRR/DSCR/MOIC المعروضان في كل مكان آخر بالتطبيق فوراً (وليس فقط هنا)،
   وتُسجَّل العملية تلقائياً في سجل التدقيق (audit-trail.js يستمع لكل حفظ فرصة عبر
   نفس الـhook الموجود أصلاً — لا حاجة لأي عمل إضافي).

   كل رافعة أحادية المتغيّر ولا تلمس حقولاً ذات قيد مجموع (كتوزيع التكلفة الإنشائية
   development.costBreakdown الذي يجب أن يساوي ١٠٠٪) تجنباً لكسر أي قيد بيانات ضمنيّ.
   رافعة "رفع الإيجار لمطابقة المعيار المرجعي" تُعيد استخدام matchBenchmarks/
   aggregateBench من benchmark-engine.js مباشرة (Request 1 يُغذّي Request 4 هنا
   فعلياً — إثراء متبادل بين المكتبات كما طلب المستخدم). لا تعديل على core.js.
   ========================================================================= */

import { matchBenchmarks, aggregateBench } from './benchmark-engine.js';

function clone(o){ return JSON.parse(JSON.stringify(o)); }

const LEVERS = [
  {
    key: 'cut_contingency',
    ar: 'تقليص احتياطي الطوارئ الإنشائي', en: 'Trim construction contingency',
    icon: '✂️',
    rationaleAr: 'احتياطي طوارئ أعلى من ٧٪ مبرَّر فقط قبل استقرار التصميم/التراخيص. بعد اعتماد المخططات التنفيذية ورخصة البناء، تقليصه إلى ٥٪ يُحرِّر رأس مال دون زيادة مخاطرة إنشائية حقيقية.',
    rationaleEn: 'A contingency above 7% is only justified before design/permits are locked. Once construction drawings and the building permit are approved, trimming it to 5% frees capital without adding real construction risk.',
    appliesWhen: (core, d)=> d.meta.oppType==='development' && (d.development.contingency||0) > 0.07,
    path: 'development.contingency',
    newValue: (core, d)=> Math.max(0.05, (d.development.contingency||0) - 0.03),
    fmt: (core, v)=> core.fmtPct(v),
  },
  {
    key: 'increase_leverage',
    ar: 'زيادة الرافعة المالية (LTC) ضمن هامش DSCR المتاح', en: 'Increase leverage (LTC) within available DSCR headroom',
    icon: '📈',
    rationaleAr: 'نسبة تمويل حالية أقل من ٦٠٪ مع هامش DSCR مريح (أعلى من ١.٤×) تعني أن الصندوق يمتص مخاطرة تمويل أقل من اللازم — رفع LTC يرفع عائد حقوق الملكية (Equity IRR) عبر أثر الرافعة، على حساب هامش DSCR (يبقى معروضاً في المقارنة أدناه لاتخاذ قرار مطّلع، لا تلقائي).',
    rationaleEn: 'Current financing under 60% with comfortable DSCR headroom (above 1.4×) means the fund is absorbing less financing risk than it could. Raising LTC lifts equity IRR via leverage, at the cost of DSCR headroom (shown transparently below — an informed choice, not an automatic one).',
    appliesWhen: (core, d, c)=> d.meta.oppType!=='landbank' && (d.financing.ltc||0) < 0.60 && c && c.dscrMin!=null && c.dscrMin > 1.40,
    path: 'financing.ltc',
    newValue: (core, d)=> Math.min(0.70, (d.financing.ltc||0) + 0.10),
    fmt: (core, v)=> core.fmtPct(v),
  },
  {
    key: 'extend_amortization',
    ar: 'تمديد مدة استهلاك الدين الافتراضية', en: 'Extend the notional debt amortization period',
    icon: '⏳',
    rationaleAr: 'جدول استهلاك قصير (أقل من ١٥ سنة) يرفع القسط السنوي وضغط خدمة الدين على التدفق النقدي التشغيلي. تمديده ٥ سنوات إضافية يخفّف القسط السنوي فوراً (بضريبة رصيد بالون أكبر عند الخروج/إعادة التمويل — مقايضة سيولة اليوم مقابل التزام آجل).',
    rationaleEn: 'A short amortization schedule (under 15 years) raises the annual installment and debt-service pressure on operating cash flow. Extending it 5 more years eases the annual installment immediately (at the cost of a larger balloon balance at exit/refinance — a today-liquidity-for-later-obligation trade-off).',
    appliesWhen: (core, d)=> d.meta.oppType!=='landbank' && (d.financing.amortYears||0) > 0 && (d.financing.amortYears||0) < 15,
    path: 'financing.amortYears',
    newValue: (core, d)=> (d.financing.amortYears||10) + 5,
    fmt: (core, v)=> core.fmtNum(v)+' '+core.T('سنة','yrs'),
  },
  {
    key: 'raise_rent_to_benchmark',
    ar: 'رفع الإيجار الأساسي لمطابقة المعيار المرجعي', en: 'Raise base rent to match the benchmark reference',
    icon: '🏷️',
    rationaleAr: 'الإيجار الأساسي المُدخَل أقل من متوسط مكتبة أوبال المرجعية لنفس المدينة/النوع بأكثر من ٨٪ — قد يكون تحفظاً غير مبرَّر أو فرصة تموضع/تسويق لم تُستغَل. الرفع لمستوى المعيار (بعد تحقق فعلي من قابلية التنفيذ سوقياً) يرفع NOI وEquity IRR مباشرة.',
    rationaleEn: 'The entered base rent is more than 8% below the OPAL Benchmark Library average for the same city/type — this may be unwarranted conservatism or an untapped positioning/marketing opportunity. Raising it to the benchmark (after real market verification) directly lifts NOI and equity IRR.',
    appliesWhen: (core, d)=>{
      if(d.meta.oppType!=='income') return false;
      const { rows } = matchBenchmarks(core, d.meta.city, d.meta.oppType);
      if(!rows.length) return false;
      const b = aggregateBench(rows);
      return b.rentPerM2!=null && (d.income.rent||0) < b.rentPerM2*0.92;
    },
    path: 'income.rent',
    newValue: (core, d)=>{
      const { rows } = matchBenchmarks(core, d.meta.city, d.meta.oppType);
      const b = aggregateBench(rows);
      return b.rentPerM2;
    },
    fmt: (core, v)=> core.fmtSAR(v)+'/'+core.T('م²','m²'),
  },
  {
    key: 'reduce_basements',
    ar: 'تقليص عدد أدوار البدروم بمقدار دور واحد', en: 'Cut one basement level',
    icon: '🕳️',
    rationaleAr: 'كل دور بدروم إضافي يحمل علاوة تكلفة متصاعدة (حفر أعمق، عزل مائي، خفض منسوب مياه). بدرومان أو أكثر مع نسبة تصاعد علاوة مرتفعة يستحق مراجعة: هل الدور الأعمق يُبرَّر بعدد مواقف/مساحة تخزين إضافية تكفي تكلفته الحقيقية؟ التقليص بدور واحد يخفّض تكلفة البناء الإجمالية (Hard Cost) فوراً — على حساب سعة مواقف أقل، وهو ما يجب تقييمه مقابل معيار المواقف المطلوب للاستخدام (انظر مكتبة الكفاءة المعمارية).',
    rationaleEn: 'Each extra basement level carries an escalating cost premium (deeper excavation, waterproofing, dewatering). Two or more basements with a high escalation rate deserves scrutiny: does the deeper level\'s parking/storage capacity actually justify its real cost? Cutting one level lowers total hard cost immediately — at the cost of less parking capacity, which should be weighed against the parking ratio required for the use type (see the Space Efficiency Library).',
    appliesWhen: (core, d)=> d.meta.oppType!=='landbank' && (d.land.basements||0) >= 2,
    path: 'land.basements',
    newValue: (core, d)=> Math.max(0, (d.land.basements||0) - 1),
    fmt: (core, v)=> core.fmtNum(v)+' '+core.T('بدروم','level(s)'),
  },
];

function metricsRow(core, label, before, after, fmtFn, higherIsBetter=true){
  if(before==null || after==null || !isFinite(before) || !isFinite(after)) return '';
  const delta = after - before;
  const good = higherIsBetter? delta>=0 : delta<=0;
  const color = Math.abs(delta)<1e-9? 'var(--ink-faint)' : (good? 'var(--good, #22c55e)' : 'var(--bad, #ef4444)');
  const arrow = Math.abs(delta)<1e-9? '→' : (delta>0? '▲':'▼');
  return `<tr>
    <td>${label}</td>
    <td class="num mono">${fmtFn(before)}</td>
    <td class="num mono" style="font-weight:700;">${fmtFn(after)}</td>
    <td class="num" style="color:${color}; font-weight:700;">${arrow} ${fmtFn(Math.abs(delta))}</td>
  </tr>`;
}

function previewLever(core, lever, d, cBefore){
  const trial = clone(d);
  const oldVal = core.getPath(trial, lever.path);
  const newVal = lever.newValue(core, trial, cBefore);
  if(newVal==null || !isFinite(newVal)) return null;
  core.setPath(trial, lever.path, newVal);
  let cAfter;
  try{ cAfter = core.compute(trial, 'base'); } catch(e){ console.error('feasibility lever preview error:', lever.key, e); return null; }
  return { oldVal, newVal, cAfter, trial };
}

function leverCardHtml(core, lever, d, c, rec, canEdit){
  const preview = previewLever(core, lever, d, c);
  if(!preview) return '';
  const { oldVal, newVal, cAfter } = preview;
  return `
  <div class="section" style="margin-bottom:10px; background:var(--surface-2); border:1px dashed var(--border);">
    <p class="step-sub" style="margin:0 0 4px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
      <span>${lever.icon} ${core.T(lever.ar, lever.en)}</span>
      <span style="font-size:11px; color:var(--ink-faint);">${core.esc(lever.fmt(core, oldVal))} ← → <b>${core.esc(lever.fmt(core, newVal))}</b></span>
    </p>
    <p class="note" style="line-height:1.8; font-size:12px;">${core.T(lever.rationaleAr, lever.rationaleEn)}</p>
    <div class="tablewrap"><table class="db" style="font-size:11.5px;">
      <thead><tr><th>${core.T('المقياس','Metric')}</th><th>${core.T('قبل','Before')}</th><th>${core.T('بعد التطبيق','After applying')}</th><th>${core.T('الأثر','Impact')}</th></tr></thead>
      <tbody>
        ${metricsRow(core, 'Equity IRR', c && c.equityIRR, cAfter.equityIRR, v=>core.fmtPct(v), true)}
        ${metricsRow(core, 'MOIC', c && c.MOIC, cAfter.MOIC, v=>v.toFixed(2)+'×', true)}
        ${metricsRow(core, 'DSCR (min)', c && c.dscrMin, cAfter.dscrMin, v=>v.toFixed(2)+'×', true)}
      </tbody>
    </table></div>
    ${canEdit? `<button type="button" class="btn btn-sm btn-primary" style="margin-top:8px;" data-action="lever-apply" data-key="${lever.key}" data-id="${rec.id}">✅ ${core.T('تطبيق هذه الرافعة على الفرصة فعلياً','Apply this lever to the opportunity')}</button>`
      : `<p class="note" style="margin-top:6px; font-size:11px;">🔒 ${core.T('تطبيق الرافعة يتطلب صلاحية تعديل هذه الفرصة.','Applying a lever requires edit permission on this opportunity.')}</p>`}
  </div>`;
}

export function registerFeasibilityLevers(core){
  core.registerDetailSection((d, c)=>{
    const rec = core.opportunities.find(o=>o.id===core.openDetailId);
    if(!rec) return '';
    const canEdit = core.canEditOpp(rec);
    const applicable = LEVERS.filter(lv=>{
      try{ return lv.appliesWhen(core, d, c); } catch(e){ console.error('lever appliesWhen error:', lv.key, e); return false; }
    });
    if(!applicable.length){
      return `<div class="section">
        <h3>⚡ ${core.T('رافعات الجدوى القابلة للتفعيل','Actionable Feasibility Levers')}</h3>
        <p class="note">${core.T('لا توجد رافعات مقترحة حالياً لهذه الفرصة حسب بياناتها الفعلية — كل رافعة تظهر فقط عندما تنطبق شروطها الفعلية على بيانات الفرصة (لا اقتراحات عامة).','No levers currently apply to this opportunity given its actual data — each lever only appears when its real condition is met by the opportunity\'s data (never generic suggestions).')}</p>
      </div>`;
    }
    return `<div class="section">
      <h3>⚡ ${core.T('رافعات الجدوى القابلة للتفعيل','Actionable Feasibility Levers')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(${applicable.length})</span></h3>
      <p class="note" style="margin-bottom:10px;">${core.T('كل رافعة أعيد حسابها فعلياً على نسخة تجريبية من بيانات الفرصة (Equity IRR/MOIC/DSCR أدناه محسوبة حقيقياً، وليست تقديراً) — "تطبيق" يكتب التعديل على الفرصة الفعلية فوراً ويُعاد حساب كل الفرصة.','Every lever below is genuinely recomputed on a trial copy of the opportunity\'s data (the Equity IRR/MOIC/DSCR figures are real computed values, not estimates) — "Apply" writes the change to the actual opportunity immediately and the whole deal recomputes.')}</p>
      ${applicable.map(lv=> leverCardHtml(core, lv, d, c, rec, canEdit)).join('')}
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action!=='lever-apply') return false;
    const lever = LEVERS.find(l=>l.key===el.dataset.key);
    const rec = core.opportunities.find(o=>o.id===el.dataset.id);
    if(!lever || !rec || !core.canEditOpp(rec)) return true;
    const mutated = clone(rec.data);
    const newVal = lever.newValue(core, mutated, null);
    if(newVal==null || !isFinite(newVal)) return true;
    core.setPath(mutated, lever.path, newVal);
    await core.persistOpportunity({ id: rec.id, data: mutated });
    core.render();
    return true;
  });
}

export { LEVERS };
