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
import { evidenceCoverageStats, KEY_FIELDS } from './evidence-tracking.js';
import { maxAcquisitionPrice } from './max-acquisition-price.js';

const GOV_DATA_QUALITY_MIN = 0.85;   // Governance Gate: جودة البيانات ≥ 85%
const GOV_EVIDENCE_MIN     = 0.80;   // Governance Gate: تغطية المصادر ≥ 80%
const DD_COMPLETION_MIN     = 0.80;   // DD Gate: لا يكفي غياب critical؛ يلزم إنجاز فعلي
const EVIDENCE_VERIFIED_MIN = 0.60;   // Governance Gate: نسبة تحقق دنيا للأرقام الرئيسية

function evidenceQuality(core, d){
  const evidence = (d && d.evidence) || {};
  const critical = KEY_FIELDS.filter(f=>f.critical && (!f.appliesTo || f.appliesTo===d.meta.oppType));
  const weak = [];
  const stale = [];
  critical.forEach(f=>{
    const ev = evidence[f.path] || {};
    if(!ev.source) return;
    if(ev.tier === 'tier4' || ev.confidence === 'low' || !ev.verifiedBy){
      weak.push(f);
    }
    if(ev.date){
      const ageDays = Math.floor((Date.now() - new Date(ev.date+'T00:00:00').getTime())/86400000);
      if(isFinite(ageDays) && ageDays > 730) stale.push(f);
    }
  });
  return { weak, stale };
}

function planningFeasibility(core, d, c){
  const land = d.land || {};
  const allowedFloors = Number(land.floorsAllowed || 0);
  const setback = Math.max(0, Math.min(0.8, Number(land.setbacks || 0)));
  const allowedFootprint = Number(land.area || 0) * Math.max(0, 1-setback) * Number(land.bar || 0);
  const requiredFloors = allowedFootprint > 0 ? Math.ceil((c.gfa || 0) / allowedFootprint) : (c.floorsNeeded || 0);
  const floorsOk = !allowedFloors || !requiredFloors || requiredFloors <= allowedFloors;
  const footprintOk = allowedFootprint > 0 || (d.meta && d.meta.oppType === 'landbank');
  return { ok: floorsOk && footprintOk, allowedFloors, requiredFloors, setback, allowedFootprint };
}

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
    { label:'Project IRR', ok: isFinite(c.projectIRR) && crit.projIrrMin!=null && c.projectIRR >= crit.projIrrMin,
      detail: `${core.fmtPct?core.fmtPct(c.projectIRR):c.projectIRR} / min ${crit.projIrrMin!=null?core.fmtPct?core.fmtPct(crit.projIrrMin):crit.projIrrMin:'—'}` },
    { label:'MOIC', ok: isFinite(c.MOIC) && crit.moicMin!=null && c.MOIC >= crit.moicMin,
      detail: `${isFinite(c.MOIC)?c.MOIC.toFixed(2)+'×':'—'} / min ${crit.moicMin!=null?crit.moicMin.toFixed(2)+'×':'—'}` },
    { label:'DSCR', ok: (c.dscrMin==null) || (crit.dscrMin==null) || (isFinite(c.dscrMin) && c.dscrMin >= crit.dscrMin),
      detail: c.dscrMin==null? 'n/a' : `${isFinite(c.dscrMin)?c.dscrMin.toFixed(2)+'×':'—'} / min ${crit.dscrMin!=null?crit.dscrMin.toFixed(2)+'×':'—'}` },
  ];
  const financialOk = finChecks.every(x=>x.ok);
  finChecks.forEach(x=>{ if(!x.ok) reasons.push({ gate:'financial', ar:`${x.label} دون الحد الأدنى (${x.detail})`, en:`${x.label} below minimum (${x.detail})` }); });

  // --- بوابة العناية الواجبة ---
  const dd = ddStats((d.dd && d.dd.items) || defaultItemsDict());
  const ddOk = dd.criticalPending === 0 && dd.pct >= DD_COMPLETION_MIN;
  if(dd.criticalPending) reasons.push({ gate:'dd', ar:`${dd.criticalPending} بند حرج معلّق في العناية الواجبة`, en:`${dd.criticalPending} critical DD item(s) still pending` });
  if(dd.pct < DD_COMPLETION_MIN) reasons.push({ gate:'dd', ar:`اكتمال العناية الواجبة ${Math.round(dd.pct*100)}% دون الحد ${Math.round(DD_COMPLETION_MIN*100)}%`, en:`DD completion ${Math.round(dd.pct*100)}% below ${Math.round(DD_COMPLETION_MIN*100)}% threshold` });

  // --- بوابة الحوكمة (جودة البيانات + تغطية المصادر) ---
  const dq = dataQualityStats(core, d);
  const ev = evidenceCoverageStats(core, d);
  const evQuality = evidenceQuality(core, d);
  const dqOk = dq.criticalMissing.length === 0 && dq.pct >= GOV_DATA_QUALITY_MIN;
  const evOk = ev.unsourcedCritical.length === 0 && (ev.pct/100) >= GOV_EVIDENCE_MIN && (ev.verifiedPct/100) >= EVIDENCE_VERIFIED_MIN && evQuality.weak.length===0 && evQuality.stale.length===0;
  const governanceOk = dqOk && evOk;
  if(dq.criticalMissing.length) reasons.push({ gate:'governance', ar:`${dq.criticalMissing.length} حقل حرج غير مُدخَل`, en:`${dq.criticalMissing.length} critical field(s) not entered` });
  else if(dq.pct < GOV_DATA_QUALITY_MIN) reasons.push({ gate:'governance', ar:`جودة البيانات ${Math.round(dq.pct*100)}% دون الحد ${Math.round(GOV_DATA_QUALITY_MIN*100)}%`, en:`Data quality ${Math.round(dq.pct*100)}% below ${Math.round(GOV_DATA_QUALITY_MIN*100)}% threshold` });
  if(ev.unsourcedCritical.length) reasons.push({ gate:'governance', ar:`${ev.unsourcedCritical.length} رقماً حرجاً بلا مصدر (🔴 IC BLOCKER)`, en:`${ev.unsourcedCritical.length} critical figure(s) unsourced (🔴 IC BLOCKER)` });
  else if((ev.pct/100) < GOV_EVIDENCE_MIN) reasons.push({ gate:'governance', ar:`تغطية المصادر ${ev.pct}% دون الحد ${Math.round(GOV_EVIDENCE_MIN*100)}%`, en:`Source coverage ${ev.pct}% below ${Math.round(GOV_EVIDENCE_MIN*100)}% threshold` });
  if((ev.verifiedPct/100) < EVIDENCE_VERIFIED_MIN) reasons.push({ gate:'governance', ar:`تحقق الأدلة ${ev.verifiedPct}% دون الحد ${Math.round(EVIDENCE_VERIFIED_MIN*100)}%`, en:`Evidence verification ${ev.verifiedPct}% below ${Math.round(EVIDENCE_VERIFIED_MIN*100)}% threshold` });
  if(evQuality.weak.length) reasons.push({ gate:'governance', ar:`${evQuality.weak.length} دليل حرج ضعيف الجودة/غير محقق`, en:`${evQuality.weak.length} critical evidence item(s) are weak or unverified` });
  if(evQuality.stale.length) reasons.push({ gate:'governance', ar:`${evQuality.stale.length} دليل حرج قديم يحتاج تحديث`, en:`${evQuality.stale.length} critical evidence item(s) are stale` });

  // --- بوابة التخطيط/الاشتراطات العمرانية ---
  const planning = planningFeasibility(core, d, c);
  const planningOk = planning.ok;
  if(!planningOk) reasons.push({ gate:'planning', ar:`الاشتراطات التخطيطية غير متحققة: مطلوب ${planning.requiredFloors} دور مقابل مسموح ${planning.allowedFloors || '—'}، وبصمة مسموحة بعد الارتدادات ${Math.round(planning.allowedFootprint||0)} م²`, en:`Planning feasibility failed: requires ${planning.requiredFloors} floors vs allowed ${planning.allowedFloors || '—'}, allowed footprint after setbacks ${Math.round(planning.allowedFootprint||0)} sqm` });

  // --- بوابة التسعير ---
  const map = maxAcquisitionPrice(core, d, crit.irrMin);
  const pricingOk = !map.infeasible && map.currentPrice <= map.maxPrice;
  if(map.infeasible) reasons.push({ gate:'pricing', ar:`حتى بأرض مجانية لا تتحقق Equity IRR ≥ ${core.fmtPct?core.fmtPct(map.targetIRR):map.targetIRR}`, en:`Even at zero land cost, target Equity IRR is not reached` });
  else if(!pricingOk) reasons.push({ gate:'pricing', ar:`السعر الحالي (${core.fmtSAR?core.fmtSAR(map.currentPrice):map.currentPrice}) يتجاوز الحد الأقصى للاستحواذ (${core.fmtSAR?core.fmtSAR(map.maxPrice):map.maxPrice})`, en:`Current price exceeds max acquisition price` });

  const gates = {
    financial:  { ok: financialOk, checks: finChecks },
    dd:         { ok: ddOk, criticalPending: dd.criticalPending, pct: dd.pct },
    governance: { ok: governanceOk, dataQualityPct: dq.pct, evidencePct: ev.pct/100, evidenceVerifiedPct: ev.verifiedPct/100, criticalMissing: dq.criticalMissing.length, unsourcedCritical: ev.unsourcedCritical.length, weakEvidence: evQuality.weak.length, staleEvidence: evQuality.stale.length },
    planning:   planning,
    pricing:    { ok: pricingOk, maxPrice: map.maxPrice, currentPrice: map.currentPrice, infeasible: map.infeasible },
  };
  const ready = financialOk && ddOk && governanceOk && planningOk && pricingOk;
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
          ${gateRow(core, core.T('الحوكمة (جودة بيانات + جودة/تحقق الأدلة)','Governance (data quality + evidence quality/verification)'), gates.governance)}
          ${gateRow(core, core.T('التخطيط (الأدوار والارتدادات والبصمة)','Planning (floors, setbacks, footprint)'), gates.planning)}
          ${gateRow(core, core.T('التسعير (السعر ≤ الحد الأقصى للاستحواذ)','Pricing (price ≤ max acquisition price)'), gates.pricing)}
        </tbody>
      </table></div>
      ${!res.ready? `<div class="note" style="margin-top:10px; color:var(--bad);">${core.T('أسباب عدم الجهوزية:','Reasons not ready:')}${reasonsList}</div>` : `<p class="note" style="margin-top:10px; color:var(--good);">${core.T('كل البوابات الأربع مُستوفاة — الفرصة جاهزة تقنياً للعرض على اللجنة.','All four gates satisfied — technically ready for IC submission.')}</p>`}
    </div>`;
  });
}
