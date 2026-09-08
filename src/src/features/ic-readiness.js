/* =========================================================================
   جاهزية لجنة الاستثمار + مصفوفة القرار
   ---------------------------------------------------------------------------
   طبقة تجميعية للقراءة فقط. لا تعيد حساب العوائد أو التقييم؛ بل تستهلك
   مخرجات المحركات القائمة (compute / data quality / DD / risk / valuation /
   max acquisition / IC checklist) وتحوّلها إلى راية جاهزية قابلة للتدقيق
   وأسباب قرار منفصلة للاستثمار والسعر والتنفيذ.
   ========================================================================= */

import { dataQualityStats } from './data-quality.js';
import { ddStats, defaultItemsDict } from './due-diligence.js';
import { riskStats, defaultRiskItems } from './risk-engine.js';
import { comparableValue, dcfLandValue } from './valuation-engine.js';
import { maxAcquisitionPrice } from './max-acquisition-price.js';

function median(values){
  const nums = values.filter(v=>v!=null && isFinite(v)).sort((a,b)=>a-b);
  if(!nums.length) return null;
  const mid = Math.floor(nums.length/2);
  return nums.length%2 ? nums[mid] : (nums[mid-1]+nums[mid])/2;
}

function blocker(key, ar, en, detailAr, detailEn){
  return { key, ar, en, detailAr, detailEn };
}

function valuationSnapshot(core, d){
  const targetIRR = d.criteria && d.criteria.irrMin || 0.15;
  const residual = maxAcquisitionPrice(core, d, targetIRR);
  const dcf = dcfLandValue(core, d);
  const comparable = comparableValue(core, d);
  const marketValue = median([
    comparable,
    residual.infeasible ? null : residual.maxPrice,
    dcf.infeasible ? null : dcf.value,
  ]);
  const asking = d.negotiation && d.negotiation.askingPrice;
  const gap = marketValue!=null && asking!=null && marketValue>0
    ? (asking-marketValue)/marketValue
    : null;
  return { targetIRR, residual, dcf, comparable, marketValue, asking, gap };
}

export function evaluateICReadiness(core, d, c){
  const dq = dataQualityStats(core, d);
  const dd = ddStats((d.dd && d.dd.items) || defaultItemsDict());
  const risk = riskStats((d.risk && d.risk.items) || defaultRiskItems());
  const valuation = valuationSnapshot(core, d);
  const checklist = core.icRecommendations(d, c);
  const financing = d.financing || {};
  const financingDD = d.dd && d.dd.items && d.dd.items.financing_termsheet;
  const financingComplete = [financing.ltc, financing.saibor, financing.margin]
    .every(v=>v!=null && isFinite(Number(v))) &&
    (!financingDD || financingDD.status==='completed');
  const criteria = d.criteria || {};
  const decisions = (d.ic && d.ic.decisions) || [];
  const latestDecision = decisions.length ? decisions[decisions.length-1] : null;
  const returns = {
    equityIRR: Number(c.equityIRR),
    projectIRR: Number(c.projectIRR),
    moic: Number(c.MOIC),
    dscr: Number(c.dscrMin),
  };
  const returnHurdles = {
    equityIRR: isFinite(returns.equityIRR) && returns.equityIRR >= Number(criteria.irrMin||0),
    moic: isFinite(returns.moic) && returns.moic >= Number(criteria.moicMin||0),
    dscr: criteria.dscrMin==null || (isFinite(returns.dscr) && returns.dscr >= Number(criteria.dscrMin||0)),
  };

  const blockers = [];
  if(dq.criticalMissing.length){
    blockers.push(blocker(
      'data-quality',
      'جودة البيانات غير مكتملة',
      'Critical data quality inputs are missing',
      `${dq.criticalMissing.length} مُدخل حرج مفقود`,
      `${dq.criticalMissing.length} critical input(s) are missing`,
    ));
  }
  if(dd.criticalPending){
    blockers.push(blocker(
      'critical-dd',
      'العناية الواجبة الحرجة معلّقة',
      'Critical due diligence is pending',
      `${dd.criticalPending} بند حرج لم يكتمل`,
      `${dd.criticalPending} critical DD item(s) are not complete`,
    ));
  }
  if(risk.maxScore>=15){
    blockers.push(blocker(
      'risk',
      'يوجد خطر مرتفع',
      'High risk requires mitigation',
      `أعلى درجة مخاطر ${risk.maxScore}/25`,
      `Highest risk score is ${risk.maxScore}/25`,
    ));
  }
  if(valuation.gap!=null && valuation.gap>0.10){
    blockers.push(blocker(
      'valuation-gap',
      'فجوة التقييم تتجاوز ١٠٪',
      'Valuation gap exceeds 10%',
      `سعر الطلب أعلى من القيمة المرجعية بنسبة ${(valuation.gap*100).toFixed(1)}٪`,
      `Asking price is ${(valuation.gap*100).toFixed(1)}% above the supported value`,
    ));
  }
  if(valuation.residual.infeasible || (valuation.residual.maxPrice!=null && d.land.price>valuation.residual.maxPrice)){
    blockers.push(blocker(
      'price-hurdle',
      'السعر الحالي لا يحقق العائد المستهدف',
      'Current price misses the return hurdle',
      `السعر الحالي يتجاوز الحد الأقصى لتحقيق ${core.fmtPct(valuation.targetIRR)}`,
      `Current price is above the maximum price for ${core.fmtPct(valuation.targetIRR)}`,
    ));
  }
  if(!financingComplete){
    blockers.push(blocker(
      'financing',
      'بيانات التمويل غير مكتملة',
      'Financing information is incomplete',
      'أكمل LTC وSAIBOR والهامش وتحقق من مذكرة الشروط',
      'Complete LTC, SAIBOR, margin, and the financing term sheet',
    ));
  }
  if(checklist.length){
    blockers.push(blocker(
      'ic-checklist',
      'قائمة تحقق اللجنة غير مكتملة',
      'IC checklist has open items',
      `${checklist.length} معيار يحتاج إجراءً`,
      `${checklist.length} acceptance criterion/criteria need action`,
    ));
  }
  if(!returnHurdles.equityIRR || !returnHurdles.moic || !returnHurdles.dscr){
    const failed = [
      !returnHurdles.equityIRR ? 'Equity IRR' : '',
      !returnHurdles.moic ? 'MOIC' : '',
      !returnHurdles.dscr ? 'DSCR' : '',
    ].filter(Boolean).join(', ');
    blockers.push(blocker(
      'return-hurdles',
      'العوائد دون عتبات القبول',
      'Returns are below acceptance hurdles',
      `المؤشرات غير المستوفاة: ${failed}`,
      `Failed metrics: ${failed}`,
    ));
  }

  const dimensions = [
    dq.criticalMissing.length===0,
    dd.criticalPending===0,
    risk.maxScore<15,
    valuation.gap==null || valuation.gap<=0.10,
    financingComplete,
    checklist.length===0,
    returnHurdles.equityIRR && returnHurdles.moic && returnHurdles.dscr,
  ];
  const percentage = Math.round(dimensions.filter(Boolean).length/dimensions.length*100);
  return {
    ready: blockers.length===0,
    status: blockers.length===0 ? 'READY FOR IC' : 'NOT READY FOR IC',
    percentage,
    blockers,
    warnings: risk.maxScore>=7 && risk.maxScore<15 ? ['Medium risk should have an owner and mitigation before approval.'] : [],
    details: { dq, dd, risk, valuation, financingComplete, checklist, returns, returnHurdles, latestDecision },
  };
}

export function evaluateDecisionMatrix(core, d, c, readiness){
  readiness = readiness || evaluateICReadiness(core, d, c);
  const details = readiness.details;
  const investmentReasons = [];
  let investment = 'YES';
  if(details.latestDecision && details.latestDecision.decision==='reject'){
    investment = 'NO';
    investmentReasons.push('The latest IC workflow decision is Reject.');
  } else if(details.dd.criticalPending || details.dq.criticalMissing.length || !details.returnHurdles.equityIRR || !details.returnHurdles.moic){
    investment = 'NO';
    investmentReasons.push('Documentation or return hurdles are not complete.');
  } else if((details.latestDecision && ['hold','revise'].includes(details.latestDecision.decision)) || readiness.blockers.length){
    investment = 'REVIEW';
    investmentReasons.push(details.latestDecision && ['hold','revise'].includes(details.latestDecision.decision)
      ? 'The latest IC workflow decision requests a hold or resubmission.'
      : 'Resolve the readiness blockers before approval.');
  } else {
    investmentReasons.push('Core returns, documentation, and risk gates pass.');
  }
  if(details.risk.maxScore>=15) investmentReasons.push(`High risk score ${details.risk.maxScore}/25.`);

  const maxPrice = details.valuation.residual.infeasible ? null : details.valuation.residual.maxPrice;
  const currentPrice = Number(d.land && d.land.price);
  const asking = details.valuation.asking;
  let price = 'ACCEPT';
  const priceReasons = [];
  if(maxPrice==null || !isFinite(currentPrice) || currentPrice>maxPrice){
    price = 'NO';
    priceReasons.push('Underwritten price is above the maximum acquisition price.');
  } else if((asking!=null && asking>maxPrice) || (details.valuation.gap!=null && details.valuation.gap>0.10)){
    price = 'NEGOTIATE';
    priceReasons.push('Seller pricing is above the supported value or hurdle price.');
  } else {
    priceReasons.push('Current price is within the supported acquisition range.');
  }

  const stage = d.pipeline && d.pipeline.stage || 'lead';
  let execution = 'CONDITIONAL';
  const executionReasons = [];
  if(stage==='archived' || details.dd.criticalPending || details.dq.criticalMissing.length){
    execution = 'NO';
    executionReasons.push('Pipeline is archived or critical readiness items remain open.');
  } else if(['approved','negotiation','closing','dev_ops','exit'].includes(stage) &&
    readiness.blockers.length===0 &&
    details.latestDecision &&
    ['approve','approve_conditions'].includes(details.latestDecision.decision)){
    execution = 'READY';
    executionReasons.push('Pipeline stage and readiness gates support execution.');
  } else {
    executionReasons.push(`Pipeline stage is ${stage}; complete open gates before execution.`);
  }
  return {
    investment: { status:investment, reasons:investmentReasons },
    price: { status:price, reasons:priceReasons },
    execution: { status:execution, reasons:executionReasons },
  };
}

export function registerICReadiness(core){
  core.registerDetailSection((d, c)=>{
    const rec = core.opportunities.find(o=>o.id===core.openDetailId);
    if(!rec) return '';
    const readiness = evaluateICReadiness(core, d, c);
    const matrix = evaluateDecisionMatrix(core, d, c, readiness);
    const details = readiness.details;
    const statusColor = readiness.ready ? 'var(--good)' : 'var(--bad)';
    const badge = (status, kind)=>{
      const colors = kind==='investment' ? {YES:'var(--good)', REVIEW:'var(--gold)', NO:'var(--bad)'}
        : kind==='price' ? {ACCEPT:'var(--good)', NEGOTIATE:'var(--gold)', NO:'var(--bad)'}
        : {READY:'var(--good)', CONDITIONAL:'var(--gold)', NO:'var(--bad)'};
      return `<span class="tag" style="color:${colors[status]||'var(--ink)'}; font-weight:800;">${status}</span>`;
    };
    return `
    <div class="section" style="border-inline-start:4px solid ${statusColor};">
      <h3>🧭 ${core.T('جاهزية لجنة الاستثمار','IC Readiness')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(Central evaluator)</span></h3>
      <div class="kv" style="margin-bottom:10px;">
        <div class="k">${core.T('الحالة','Status')}</div><div class="v"><b style="color:${statusColor};">${readiness.status}</b></div>
        <div class="k">${core.T('نسبة الجاهزية','Readiness')}</div><div class="v"><b>${readiness.percentage}%</b></div>
      </div>
      <div style="height:8px; background:var(--surface-2); border-radius:5px; overflow:hidden; margin-bottom:12px;"><div style="width:${readiness.percentage}%; height:100%; background:${statusColor};"></div></div>
      ${readiness.blockers.length ? `<div style="display:flex; flex-direction:column; gap:5px; margin-bottom:12px;"><b>${core.T('المعوقات الصريحة','Explicit blockers')}</b>${readiness.blockers.map(b=>`<div class="note" style="color:var(--bad);">🚫 ${core.T(b.ar,b.en)} — ${core.T(b.detailAr,b.detailEn)}</div>`).join('')}</div>` : `<p class="note" style="color:var(--good);">✅ ${core.T('لا توجد معوقات مسجّلة وفق البيانات الحالية.','No blockers are recorded from the current data.')}</p>`}
      <div class="tablewrap"><table class="db" style="font-size:11.5px;">
        <thead><tr><th>${core.T('محور القرار','Decision axis')}</th><th>${core.T('الحالة','Status')}</th><th>${core.T('السبب','Reason')}</th></tr></thead>
        <tbody>
          <tr><td>${core.T('الاستثمار','Investment')}</td><td>${badge(matrix.investment.status,'investment')}</td><td>${matrix.investment.reasons.map(r=>core.esc(r)).join(' · ')}</td></tr>
          <tr><td>${core.T('السعر','Price')}</td><td>${badge(matrix.price.status,'price')}</td><td>${matrix.price.reasons.map(r=>core.esc(r)).join(' · ')}</td></tr>
          <tr><td>${core.T('التنفيذ','Execution')}</td><td>${badge(matrix.execution.status,'execution')}</td><td>${matrix.execution.reasons.map(r=>core.esc(r)).join(' · ')}</td></tr>
        </tbody>
      </table></div>
      <details style="margin-top:10px;"><summary style="cursor:pointer; font-weight:700;">${core.T('تفاصيل التقييم','Evaluator detail')}</summary>
        <div class="kv" style="margin-top:8px;">
          <div class="k">Data Quality</div><div class="v">${details.dq.filled}/${details.dq.total}</div>
          <div class="k">Critical DD</div><div class="v">${details.dd.criticalPending}</div>
          <div class="k">Highest Risk</div><div class="v">${details.risk.maxScore}/25</div>
          <div class="k">Valuation Gap</div><div class="v">${details.valuation.gap==null?'—':core.fmtPct(details.valuation.gap,1)}</div>
          <div class="k">Return Hurdles</div><div class="v">${details.returnHurdles.equityIRR&&details.returnHurdles.moic&&details.returnHurdles.dscr?'Pass':'Review'}</div>
        </div>
      </details>
    </div>`;
  });
}
