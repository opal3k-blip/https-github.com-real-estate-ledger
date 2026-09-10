/* =========================================================================
   محلل الاستثمار الآلي — AI Investment Analyst (Phase 3، النظام السادس)
   ---------------------------------------------------------------------------
   زر "🧠 تحليل الفرصة" داخل كل فرصة يُولِّد مذكرة تحليلية مركَّبة (Synthesis)
   من الأنظمة الموثَّقة القائمة فعلياً فقط — بلا أي استدعاء لنموذج ذكاء
   اصطناعي خارجي وبلا أي رقم أو استنتاج غير مبني على بيانات محسوبة داخل
   التطبيق نفسه (تحديداً ما طلبه المستخدم: "مقيَّد باستخدام بيانات التطبيق
   الموثَّقة فقط"). يجمع: الدرجة الاستثمارية المركّبة (investment-score.js)،
   جاهزية جودة البيانات والعناية الواجبة (data-quality.js/due-diligence.js)،
   أعلى المخاطر تسجيلاً (risk-engine.js)، توصيات لجنة الاستثمار ونقاط القوة/
   التفاوض (icRecommendations/dealStrengthsAndNegotiationPoints — موجودة أصلاً
   في core.js ومُصدَّرة)، ومقارنة المعيار المرجعي (benchmark-engine.js) —
   كلها حسابات موجودة ومُتحقَّق منها مسبقاً، هذا الملف فقط يؤلِّف نصاً موجَّهاً
   منها، دون أي حساب مالي جديد. generateAnalystNarrative() مُصدَّرة ليُعاد
   استخدامها من automated-ic-memo.js (بلا أي تكرار). لا تعديل على منطق
   core.js الداخلي.
   ========================================================================= */

import { computeInvestmentScore, scoreBand } from './investment-score.js';
import { dataQualityStats } from './data-quality.js';
import { ddStats, defaultItemsDict } from './due-diligence.js';
import { RISK_CATEGORIES, defaultRiskItems, scoreOf as riskScoreOf, bandOf as riskBandOf } from './risk-engine.js';
import { matchBenchmarks, aggregateBench } from './benchmark-engine.js';
import { computeDecisionConfidence } from './decision-confidence.js';

const expandedIds = new Set(); // حالة واجهة محلية فقط (مفتوح/مغلق) — لا علاقة لها ببيانات الفرصة

/* التوليد الفعلي للنص التحليلي — مُصدَّر لإعادة الاستخدام من automated-ic-memo.js */
function generateAnalystNarrative(core, d, c){
  const scoreRes = computeInvestmentScore(core, d, c);
  const band = scoreBand(scoreRes.composite);
  const decisionConfidence = computeDecisionConfidence(core, d);
  const dq = dataQualityStats(core, d);
  const dd = ddStats((d.dd && d.dd.items) || defaultItemsDict());
  const riskItems = (d.risk && d.risk.items) || defaultRiskItems();
  const topRisks = RISK_CATEGORIES.map(cat=>{
    const score = riskScoreOf(riskItems[cat.key] || {probability:1,impact:1});
    return { label: core.T(cat.ar,cat.en), score, band: riskBandOf(score) };
  }).filter(r=>r.score>=7).sort((a,b)=>b.score-a.score).slice(0,3);
  const icRecs = core.icRecommendations(d, c);
  const { strengths, negotiations } = core.dealStrengthsAndNegotiationPoints(d, c);
  const { rows: benchRows, scope: benchScope } = matchBenchmarks(core, d.meta.city, d.meta.oppType);
  const bench = benchRows.length? aggregateBench(benchRows) : null;

  const paras = [];
  paras.push(core.T(
    `الدرجة الاستثمارية المركّبة لهذه الفرصة ${scoreRes.composite.toFixed(0)}/100 (${core.T(band.ar,band.en)}). هذه الدرجة تعبّر عن جاذبية الفرصة وفق الافتراضات الحالية، وليست مقياساً لثقة القرار.`,
    `This opportunity's composite Investment Score is ${scoreRes.composite.toFixed(0)}/100 (${band.en}). This score reflects relative attractiveness under the current underwriting inputs; it is not a confidence measure.`
  ));
  paras.push(core.T(
    `ثقة القرار الحالية ${decisionConfidence.score.toFixed(0)}/100 (${core.T(decisionConfidence.band.ar,decisionConfidence.band.en)}). وهي مقياس منفصل لمدى اكتمال المدخلات وتوثيق المصادر والتحقق المؤسسي وتقدّم العناية الواجبة.`,
    `Current Decision Confidence is ${decisionConfidence.score.toFixed(0)}/100 (${decisionConfidence.band.en}). It is a separate measure of input completeness, source coverage, institutional verification, and due-diligence progress.`
  ));
  if(decisionConfidence.blockers.length){
    paras.push(core.T(
      `⚠️ يجب قراءة أي توصية بحذر في هذه المرحلة لأن ثقة القرار ما تزال محدودة بسبب: ${decisionConfidence.blockers.map(b=>b.ar).join('، ')}.`,
      `⚠️ Any recommendation should be read cautiously at this stage because Decision Confidence remains constrained by: ${decisionConfidence.blockers.map(b=>b.en).join(', ')}.`
    ));
  }
  if(dq.criticalMissing.length || dd.criticalPending){
    paras.push(core.T(
      `⚠️ الجاهزية للعرض على اللجنة غير مكتملة: ${dq.criticalMissing.length? dq.criticalMissing.length+' مُدخل حرج مفقود في جودة البيانات' : ''}${dq.criticalMissing.length&&dd.criticalPending? '، و':''}${dd.criticalPending? dd.criticalPending+' بند حرج معلّق في العناية الواجبة' : ''}.`,
      `⚠️ Not yet IC-ready: ${dq.criticalMissing.length? dq.criticalMissing.length+' critical data-quality input(s) missing' : ''}${dq.criticalMissing.length&&dd.criticalPending? ', and ':''}${dd.criticalPending? dd.criticalPending+' critical DD item(s) pending' : ''}.`
    ));
  } else {
    paras.push(core.T('✅ جودة البيانات والعناية الواجبة الحرجة مكتملتان — وتبدو الفرصة جاهزة توثيقياً للعرض على اللجنة بحسب السجلات الحالية.','✅ Critical data quality and due diligence are complete — the opportunity appears documentation-ready for IC presentation based on the current records.'));
  }
  if(topRisks.length){
    paras.push(core.T(
      `أبرز المخاطر المسجَّلة (متوسطة فأعلى): ${topRisks.map(r=>`${r.label} (${core.T(r.band.ar,r.band.en)})`).join('، ')}.`,
      `Top recorded risks (medium or higher): ${topRisks.map(r=>`${r.label} (${r.band.en})`).join(', ')}.`
    ));
  }
  if(icRecs.length){
    paras.push(core.T(
      `معايير لم تُستوفَ بعد: ${icRecs.map(r=>r.k).join('، ')} — راجع قسم "توصيات لجنة الاستثمار" في المذكرة للتفاصيل والإجراء المقترح لكل معيار.`,
      `Criteria not yet met: ${icRecs.map(r=>r.k).join(', ')} — see the "IC Recommendations" section of the memo for detail and suggested action per criterion.`
    ));
  } else {
    paras.push(core.T('جميع معايير القبول المالية الأساسية مستوفاة حسب آخر حساب وبناءً على الافتراضات المُدخلة حالياً.','All core financial acceptance criteria are currently met on the present underwriting assumptions.'));
  }
  if(strengths.length){
    paras.push(core.T(`نقاط قوة قابلة للعرض: ${strengths.length} نقطة موثَّقة (التفاصيل في قسم "نقاط القوة والتفاوض").`, `${strengths.length} presentable strength(s) documented (see "Strengths & Negotiation Points").`));
  }
  if(negotiations.length){
    paras.push(core.T(`نقاط تفاوض مقترحة: ${negotiations.length} نقطة قابلة للتنفيذ مع الأطراف المقابلة.`, `${negotiations.length} actionable negotiation point(s) with counterparties.`));
  }
  if(bench){
    const irrOk = bench.irrMin==null || (isFinite(c.equityIRR) && c.equityIRR>=bench.irrMin);
    paras.push(core.T(
      `مقابل المعيار المرجعي الحالي (${benchScope==='exact'?'مدينة ونوع مطابقان':'نوع الفرصة فقط، بلا مدينة مطابقة'}): يبدو Equity IRR ${irrOk? 'ضمن النطاق المرجعي أو أعلى منه':'دون النطاق المرجعي'}${bench.irrMin!=null?` (${core.fmtPct(bench.irrMin)}–${bench.irrMax!=null?core.fmtPct(bench.irrMax):'—'})`:''}.`,
      `Against the current benchmark (${benchScope==='exact'?'matching city & type':'type-only, no matching city'}): Equity IRR currently screens ${irrOk? 'within or above':'below'} the benchmark range${bench.irrMin!=null?` (${core.fmtPct(bench.irrMin)}–${bench.irrMax!=null?core.fmtPct(bench.irrMax):'—'})`:''}.`
    ));
  } else {
    paras.push(core.T('لا يوجد معيار مرجعي مسجَّل بعد لمقارنة هذه الفرصة به.','No benchmark recorded yet to compare this opportunity against.'));
  }

  const verdictIcon = c.verdict==='good'?'🟢':c.verdict==='warn'?'🟡':'🔴';
  paras.push(core.T(`الخلاصة: ${verdictIcon} ${c.verdict==='good'?'استناداً إلى الافتراضات الحالية والبيانات الموثَّقة المتاحة، تبدو الفرصة جاهزة نسبياً للانتقال إلى الخطوة التالية مع بقاء الحاجة إلى تحقق مستقل قبل أي التزام نهائي.':c.verdict==='warn'?'استناداً إلى الافتراضات الحالية، ما تزال الفرصة تحت المراجعة وتحتاج تحسين عناصر محددة قبل العرض النهائي أو الالتزام.':'استناداً إلى النموذج الحالي، تبقى الفرصة دون معايير القبول وتحتاج إعادة هيكلة جوهرية قبل التقدّم.'}`,
    `Bottom line: ${verdictIcon} ${c.verdict==='good'?'Based on the current underwriting and documented support, the opportunity appears relatively ready for the next step, while still requiring independent validation before any final commitment.':c.verdict==='warn'?'Based on the current assumptions, the opportunity remains under review and needs specific improvements before final presentation or commitment.':'On the current model, the opportunity remains below acceptance standards and needs substantial restructuring before proceeding.'}`));

  return { paras, scoreRes, band, decisionConfidence, dq, dd, topRisks, icRecs, strengths, negotiations, bench, benchScope };
}

export function registerAIAnalyst(core){
  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    if(!oppId) return '';
    const isOpen = expandedIds.has(oppId);

    if(!isOpen){
      return `<div class="section">
        <button type="button" class="btn btn-sm btn-primary" data-action="ai-toggle" data-id="${oppId}">🧠 ${core.T('تحليل الفرصة (محلل الاستثمار الآلي)','Analyze Opportunity (AI Investment Analyst)')}</button>
      </div>`;
    }

    const { paras } = generateAnalystNarrative(core, d, c);

    return `
    <div class="section">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h3 style="margin:0;">🧠 ${core.T('تحليل محلل الاستثمار الآلي','AI Investment Analyst')}</h3>
        <button type="button" class="btn btn-sm btn-ghost" data-action="ai-toggle" data-id="${oppId}">✖ ${core.T('إغلاق','Close')}</button>
      </div>
      <p class="note" style="margin:0 0 10px;">${core.T('تركيب آلي (Rule-based) من البيانات الحالية والمسارات التوثيقية داخل التطبيق فقط — ليس استدعاءً لنموذج ذكاء اصطناعي خارجي، ولا يضيف أي رقم جديد، كما أنه لا يُجري تحققاً مستقلاً أو تدقيقاً بديلاً عن المراجعة المؤسسية.','Rule-based synthesis of the current app data and tracked evidence only — not a call to an external AI model, adds no new number, and does not independently validate or audit the underlying inputs.')}</p>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${paras.map(p=>`<p style="margin:0; font-size:12.5px; line-height:1.9;">${core.esc(p)}</p>`).join('')}
      </div>
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action!=='ai-toggle') return false;
    const id = el.dataset.id;
    if(expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id);
    core.render();
    return true;
  });
}

export { generateAnalystNarrative };
