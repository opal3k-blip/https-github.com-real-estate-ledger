/* =========================================================================
   ثقة القرار — Decision Confidence
   ---------------------------------------------------------------------------
   مقياس منفصل عمداً عن Investment Score. الدرجة الاستثمارية المركّبة تعبّر عن
   "جاذبية/قابلية الصفقة" حسب الافتراضات الحالية، بينما Decision Confidence
   تعبّر عن "مدى دعم هذه الافتراضات" عبر جودة البيانات + تغطية المصادر +
   التحقق المؤسسي + تقدم العناية الواجبة. لا تُجمل قيمة الفرصة نفسها، بل قوة
   السند الذي يقف خلف القرار الحالي.
   ========================================================================= */

import { dataQualityStats } from './data-quality.js';
import { ddStats, defaultItemsDict } from './due-diligence.js';
import { evidenceCoverageStats } from './evidence-tracking.js';

const DECISION_CONFIDENCE_WEIGHTS = {
  dataQuality: 0.35,
  evidenceCoverage: 0.30,
  evidenceVerification: 0.20,
  dueDiligence: 0.15,
};

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function decisionConfidenceBand(score){
  if(score >= 80) return { key:'high', ar:'مرتفعة', en:'High', color:'#34d399' };
  if(score >= 60) return { key:'moderate', ar:'متوسطة', en:'Moderate', color:'#fbbf24' };
  return { key:'low', ar:'منخفضة', en:'Low', color:'#f87171' };
}

function computeDecisionConfidence(core, d){
  const dq = dataQualityStats(core, d);
  const dd = ddStats((d.dd && d.dd.items) || defaultItemsDict());
  const ev = evidenceCoverageStats(core, d);

  const components = {
    dataQuality: Math.round((dq.pct || 0) * 100),
    evidenceCoverage: ev.pct || 0,
    evidenceVerification: ev.verifiedPct || 0,
    dueDiligence: Math.round((dd.pct || 0) * 100),
  };

  let score =
    components.dataQuality * DECISION_CONFIDENCE_WEIGHTS.dataQuality +
    components.evidenceCoverage * DECISION_CONFIDENCE_WEIGHTS.evidenceCoverage +
    components.evidenceVerification * DECISION_CONFIDENCE_WEIGHTS.evidenceVerification +
    components.dueDiligence * DECISION_CONFIDENCE_WEIGHTS.dueDiligence;

  const blockers = [];
  if(dq.criticalMissing.length){
    blockers.push({
      key:'critical-inputs-missing',
      ar:`${dq.criticalMissing.length} مُدخل حرج مفقود`,
      en:`${dq.criticalMissing.length} critical input(s) missing`,
    });
  }
  if(ev.unsourcedCritical.length){
    blockers.push({
      key:'critical-sources-missing',
      ar:`${ev.unsourcedCritical.length} رقم حرج بلا مصدر`,
      en:`${ev.unsourcedCritical.length} critical figure(s) unsourced`,
    });
  }
  if(dd.criticalPending){
    blockers.push({
      key:'critical-dd-pending',
      ar:`${dd.criticalPending} بند عناية واجبة حرج معلّق`,
      en:`${dd.criticalPending} critical DD item(s) pending`,
    });
  }

  if(blockers.length >= 3) score = Math.min(score, 25);
  else if(blockers.length === 2) score = Math.min(score, 39);
  else if(blockers.length === 1) score = Math.min(score, 49);

  score = clamp(score, 0, 100);
  return { score, band: decisionConfidenceBand(score), components, dq, dd, ev, blockers };
}

export { computeDecisionConfidence, decisionConfidenceBand, DECISION_CONFIDENCE_WEIGHTS };
