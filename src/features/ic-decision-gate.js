/* =========================================================================
   بوابة قرار لجنة الاستثمار — IC Decision Gate (المرحلة السابعة، P0 #2)
   ---------------------------------------------------------------------------
   "الـ IC يجب ألا يكون مجرد 'تسجيل قرار'" — هذا الملف يحوِّل صفحة اللجنة من
   نموذج تسجيل حرّ إلى بوابة جهوزية حقيقية بأربع بوابات فرعية، تُركَّب كلها
   من نتائج محسوبة سلفاً في ملفات أخرى (لا تكرار منطق، لا حقل جديد في
   المخطط):

     • البوابة المالية (Financial Gate)   ← core.compute(d) × d.criteria
     • بوابة العناية الواجبة (DD Gate)     ← ddStats() من due-diligence.js
     • بوابة الحوكمة (Governance Gate)     ← dataQualityStats() من
                                             data-quality.js +
                                             evidenceCoverageStats() من
                                             evidence-tracking.js
     • بوابة التسعير (Pricing Gate)        ← maxAcquisitionPrice() من
                                             max-acquisition-price.js

   النتيجة: "✅ IC READY" أو "🔴 NOT READY" + أسباب مُفصَّلة — تُعرَض كقسم
   تفاصيل مستقل (مفيد حتى قبل أي قرار)، وتُستورَد أيضاً من ic-workflow.js
   لمنع اعتماد قرار "موافقة" بلا تجاوز صريح مُبرَّر عند عدم الجهوزية.
   لا تعديل على core.js — قراءة فقط لنتائج محسوبة سلفاً.
   ========================================================================= */
import { ddStats, defaultItemsDict } from './due-diligence.js';
import { dataQualityStats } from './data-quality.js';
import { evidenceCoverageStats } from './evidence-tracking.js';
import { maxAcquisitionPrice } from './max-acquisition-price.js';

const GOV_DATA_QUALITY_MIN = 0.85;   // Governance Gate: جودة البيانات ≥ 85%
const GOV_EVIDENCE_MIN     = 0.80;   // Governance Gate: تغطية المصادر ≥ 80%

/* icReadiness(core, d, c) — c اختيارية (core.compute(d) لو لم تُمرَّر، لتفادي
   إعادة الحساب لو استُدعيت من مكان يملكه أصلاً). لا تُعدِّل أي شيء، تقرأ فقط.
   تُرجع: { ready, gates:{financial,dd,governance,pricing}، reasons:[] } */
export function icReadiness(core, d, c){
  c = c || core.compute(d);
  const crit = d.criteria || {};
  const reasons = [];

  // --- البوابة المالية ---
  const finChecks = [
    { label:'Equity IRR', ok: isFinite(c.equityIRR) && crit.irrMin!=null && c.equityIRR >= crit.irrMin,
      detail: `${core.fmtPct?core.fmtPct(c.equityIRR):c.equityIRR} / min ${crit.irrMin!=null?core.fmtPct?core.fmtPct(crit.irrMin):crit.irrMin:'—'}` },
    { label:'MOIC', ok: isFinite(c.MOIC) && crit.moicMin!=null && c.MOIC >= crit.moicMin,
      detail: `${isFinite(c.MOIC)?c.MOIC.toFixed(2)+'×':'—'} / min ${crit.moicMin!=null?crit.moicMin.toFixed(2)+'×':'—'}` },
    { label:'DSCR', ok: (c.dscrMin==null) || (crit.dscrMin==null) || (isFinite(c.dscrMin) && c.dscrMin >= crit.dscrMin),
      detail: c.dscrMin==null? 'n/a' : `${isFinite(c.dscrMin)?c.dscrMin.toFixed(2)+'×':'—'} / min ${crit.dscrMin!=null?crit.dscrMin.toFixed(2)+'×':'—'}` },
  ];
  const financialOk = finChecks.every(x=>x.ok);
  finChecks.forEach(x=>{ if(!x.ok) reasons.push({ gate:'financial', ar:`${x.label} دون الحد الأدنى (${x.detail})`, en:`${x.label} below minimum (${x.detail})` }); });

  // --- بوابة العناية الواجبة ---
  const dd = ddStats((d.dd && d.dd.items) || defaultItemsDict());
  const ddOk = dd.criticalPending === 0;
  if(!ddOk) reasons.push({ gate:'dd', ar:`${dd.criticalPending} بند حرج معلّق في العناية الواجبة`, en:`${dd.criticalPending} critical DD item(s) still pending` });

  // --- بوابة الحوكمة (جودة البيانات + تغطية المصادر) ---
  const dq = dataQualityStats(core, d);
  const ev = evidenceCoverageStats(core, d);
  const dqOk = dq.criticalMissing.length === 0 && dq.pct >= GOV_DATA_QUALITY_MIN;
  const evOk = ev.unsourcedCritical.length === 0 && (ev.pct/100) >= GOV_EVIDENCE_MIN;
  const governanceOk = dqOk && evOk;
  if(dq.criticalMissing.length) reasons.push({ gate:'governance', ar:`${dq.criticalMissing.length} حقل حرج غير مُدخَل`, en:`${dq.criticalMissing.length} critical field(s) not entered` });
  else if(dq.pct < GOV_DATA_QUALITY_MIN) reasons.push({ gate:'governance', ar:`جودة البيانات ${Math.round(dq.pct*100)}% دون الحد ${Math.round(GOV_DATA_QUALITY_MIN*100)}%`, en:`Data quality ${Math.round(dq.pct*100)}% below ${Math.round(GOV_DATA_QUALITY_MIN*100)}% threshold` });
  if(ev.unsourcedCritical.length) reasons.push({ gate:'governance', ar:`${ev.unsourcedCritical.length} رقماً حرجاً بلا مصدر (🔴 IC BLOCKER)`, en:`${ev.unsourcedCritical.length} critical figure(s) unsourced (🔴 IC BLOCKER)` });
  else if((ev.pct/100) < GOV_EVIDENCE_MIN) reasons.push({ gate:'governance', ar:`تغطية المصادر ${ev.pct}% دون الحد ${Math.round(GOV_EVIDENCE_MIN*100)}%`, en:`Source coverage ${ev.pct}% below ${Math.round(GOV_EVIDENCE_MIN*100)}% threshold` });

  // --- بوابة التسعير ---
  const map = maxAcquisitionPrice(core, d, crit.irrMin);
  const pricingOk = !map.infeasible && map.currentPrice <= map.maxPrice;
  if(map.infeasible) reasons.push({ gate:'pricing', ar:`حتى بأرض مجانية لا تتحقق Equity IRR ≥ ${core.fmtPct?core.fmtPct(map.targetIRR):map.targetIRR}`, en:`Even at zero land cost, target Equity IRR is not reached` });
  else if(!pricingOk) reasons.push({ gate:'pricing', ar:`السعر الحالي (${core.fmtSAR?core.fmtSAR(map.currentPrice):map.currentPrice}) يتجاوز الحد الأقصى للاستحواذ (${core.fmtSAR?core.fmtSAR(map.maxPrice):map.maxPrice})`, en:`Current price exceeds max acquisition price` });

  const gates = {
    financial:  { ok: financialOk, checks: finChecks },
    dd:         { ok: ddOk, criticalPending: dd.criticalPending, pct: dd.pct },
    governance: { ok: governanceOk, dataQualityPct: dq.pct, evidencePct: ev.pct/100, criticalMissing: dq.criticalMissing.length, unsourcedCritical: ev.unsourcedCritical.length },
    pricing:    { ok: pricingOk, maxPrice: map.maxPrice, currentPrice: map.currentPrice, infeasible: map.infeasible },
  };
  const ready = financialOk && ddOk && governanceOk && pricingOk;
  return { ready, gates, reasons };
}

function gateRow(core, label, g){
  return `<tr>
    <td style="font-size:12.5px; font-weight:600;">${label}</td>
    <td>${g.ok
      ? `<span class="tag" style="background:#34d39922; color:#34d399; font-weight:700;">✅ ${core.T('جاهزة','Pass')}</span>`
      : `<span class="tag" style="background:#ef444422; color:#ef4444; font-weight:700;">🔴 ${core.T('غير جاهزة','Fail')}</span>`}</td>
  </tr>`;
}

export function registerICDecisionGate(core){
  core.registerDetailSection((d, c)=>{
    const res = icReadiness(core, d, c);
    const gates = res.gates;

    const reasonsList = res.reasons.length
      ? `<ul style="margin:8px 0 0; padding-inline-start:20px; font-size:12px;">${res.reasons.map(r=>`<li style="margin-bottom:4px;">${core.T(r.ar,r.en)}</li>`).join('')}</ul>`
      : '';

    return `
    <div class="section">
      <h3>🚦 ${core.T('بوابة قرار لجنة الاستثمار','IC Decision Gate')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(IC Readiness)</span></h3>
      <div style="margin:6px 0 14px;">
        ${res.ready
          ? `<span class="tag" style="background:#34d39922; color:#34d399; font-weight:700; font-size:13px; padding:6px 12px;">✅ IC READY</span>`
          : `<span class="tag" style="background:#ef444422; color:#ef4444; font-weight:700; font-size:13px; padding:6px 12px;">🔴 NOT READY</span>`}
      </div>
      <div class="tablewrap"><table class="db" style="font-size:12px;">
        <thead><tr><th>${core.T('البوابة','Gate')}</th><th>${core.T('الحالة','Status')}</th></tr></thead>
        <tbody>
          ${gateRow(core, core.T('البوابة المالية (IRR/MOIC/DSCR)','Financial (IRR/MOIC/DSCR)'), gates.financial)}
          ${gateRow(core, core.T('العناية الواجبة (بلا بنود حرجة معلّقة)','Due Diligence (no critical pending)'), gates.dd)}
          ${gateRow(core, core.T('الحوكمة (جودة بيانات + تغطية مصادر)','Governance (data quality + source coverage)'), gates.governance)}
          ${gateRow(core, core.T('التسعير (السعر ≤ الحد الأقصى للاستحواذ)','Pricing (price ≤ max acquisition price)'), gates.pricing)}
        </tbody>
      </table></div>
      ${!res.ready? `<div class="note" style="margin-top:10px; color:var(--bad);">${core.T('أسباب عدم الجهوزية:','Reasons not ready:')}${reasonsList}</div>` : `<p class="note" style="margin-top:10px; color:var(--good);">${core.T('كل البوابات الأربع مُستوفاة — الفرصة جاهزة تقنياً للعرض على اللجنة.','All four gates satisfied — technically ready for IC submission.')}</p>`}
    </div>`;
  });
}
