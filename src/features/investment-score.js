/* =========================================================================
   الدرجة الاستثمارية المركّبة — Investment Score (Phase 1، النظام السادس)
   ---------------------------------------------------------------------------
   درجة واحدة مركّبة من ٠-١٠٠ بأوزان: العائد المالي ٣٠٪، الموقع ١٥٪، السوق ١٥٪،
   سعر الاستحواذ ١٠٪، جدوى التطوير ١٠٪، المخاطر ١٠٪، السيولة/الخروج ٥٪،
   العناية الواجبة القانونية/الفنية ٥٪.
   ثلاث فئات (العائد المالي، المخاطر، العناية الواجبة) تُحسَب تلقائياً من بيانات
   موجودة فعلاً (محرك الحساب المالي + محرك المخاطر [الملف الآخر] + قائمة العناية
   الواجبة)، وتُعاد حسابها حياً في كل عرض — أي تغيير على افتراضات الفرصة ينعكس
   فوراً بلا أي حفظ. الفئات الأربع المتبقية (الموقع، السوق، سعر الاستحواذ، جدوى
   التطوير) تعتمد على تقدير المحلل صراحة (٠-١٠٠ لكل منها) لعدم توفّر محرك سوق/
   مقارنات مبني بعد (Market Intelligence Engine — مُخطَّط له في المرحلة ٢) —
   تقدير صريح ومُعلَّم كذلك أفضل من رقم آلي وهمي بلا مصدر حقيقي.
   لا تعديل على منطق core.js الداخلي — فقط عبر نقاط التوسّع المُصدَّرة.
   ========================================================================= */

const WEIGHTS = {
  financial: 0.30,
  location: 0.15,
  market: 0.15,
  acquisitionPrice: 0.10,
  developmentFeasibility: 0.10,
  risk: 0.10,
  liquidityExit: 0.05,
  legalTechnicalDD: 0.05,
};
const MANUAL_KEYS = ['location','market','acquisitionPrice','developmentFeasibility','liquidityExit'];
const LABELS = {
  financial:               { ar:'العائد المالي',              en:'Financial Returns' },
  location:                { ar:'الموقع',                      en:'Location' },
  market:                  { ar:'السوق',                       en:'Market' },
  acquisitionPrice:        { ar:'سعر الاستحواذ',                en:'Acquisition Price' },
  developmentFeasibility:  { ar:'جدوى التطوير',                 en:'Development Feasibility' },
  risk:                    { ar:'المخاطر',                      en:'Risk' },
  liquidityExit:           { ar:'السيولة / الخروج',             en:'Liquidity / Exit' },
  legalTechnicalDD:        { ar:'العناية الواجبة القانونية/الفنية', en:'Legal / Technical DD' },
};

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function financialSubScore(d, c){
  const irrMin = d.criteria.irrMin || 0.12;
  const moicMin = d.criteria.moicMin || 1.3;
  const irrScore = isFinite(c.equityIRR) ? clamp(70 + (c.equityIRR - irrMin) * 1000, 0, 100) : 0;
  const moicScore = isFinite(c.MOIC) ? clamp(70 + (c.MOIC - moicMin) * 50, 0, 100) : 0;
  return (irrScore + moicScore) / 2;
}
function riskSubScore(d){
  // يعتمد على core.riskStats(d.risk.items) إن كان محرك المخاطر مُسجَّلاً — قد لا يكون
  // متاحاً لو أُعيد ترتيب تسجيل الوحدات مستقبلاً، لذا نحسبه محلياً هنا مباشرة كنسخة احتياطية
  // مطابقة لنفس منطق risk-engine.js (Overall Risk = أعلى درجة فئة من ١١، ١-٢٥).
  const items = (d.risk && d.risk.items) || {};
  const scores = Object.values(items).map(it=> (it.probability||1)*(it.impact||1));
  const maxScore = scores.length? Math.max(...scores) : 1;
  return clamp(100 - ((maxScore-1)/24)*100, 0, 100);
}
function ddSubScore(d){
  const items = (d.dd && d.dd.items) || {};
  const keys = Object.keys(items);
  if(keys.length===0) return 0;
  const completed = keys.filter(k=>items[k].status==='completed').length;
  const criticalPending = keys.filter(k=>items[k].severity==='critical' && items[k].status!=='completed').length;
  let score = (completed/keys.length)*100;
  if(criticalPending>0) score = Math.min(score, 40);
  return score;
}

function computeInvestmentScore(core, d, c){
  const manual = Object.assign({ location:50, market:50, acquisitionPrice:50, developmentFeasibility:50, liquidityExit:50 }, d.score && d.score.manual);
  const sub = {
    financial: financialSubScore(d, c),
    risk: riskSubScore(d),
    legalTechnicalDD: ddSubScore(d),
    location: manual.location,
    market: manual.market,
    acquisitionPrice: manual.acquisitionPrice,
    developmentFeasibility: manual.developmentFeasibility,
    liquidityExit: manual.liquidityExit,
  };
  let composite = 0;
  Object.keys(WEIGHTS).forEach(k=>{ composite += (isFinite(sub[k]) ? sub[k] : 0) * WEIGHTS[k]; });
  return { composite: clamp(composite,0,100), sub, manual };
}
function scoreBand(composite){
  if(composite>=75) return { key:'strong', ar:'قوية', en:'Strong', color:'#34d399' };
  if(composite>=55) return { key:'acceptable', ar:'مقبولة', en:'Acceptable', color:'#fbbf24' };
  return { key:'weak', ar:'ضعيفة', en:'Weak', color:'#f87171' };
}

export function registerInvestmentScore(core){
  core.registerOpportunitySchemaExtender(()=>({
    score: { manual: { location:50, market:50, acquisitionPrice:50, developmentFeasibility:50, liquidityExit:50 } },
  }));

  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec) return '';
    const { composite, sub } = computeInvestmentScore(core, d, c);
    const band = scoreBand(composite);
    const canEdit = core.canEditOpp(rec);

    const rows = Object.keys(WEIGHTS).map(k=>{
      const label = LABELS[k];
      const isManual = MANUAL_KEYS.includes(k);
      const val = sub[k];
      if(!isManual || !canEdit){
        return `<tr>
          <td style="font-size:12px;">${core.T(label.ar,label.en)}${isManual? ` <span style="color:var(--ink-faint); font-size:10px;">(${core.T('تقدير المحلل','analyst estimate')})</span>`:''}</td>
          <td class="num">${(WEIGHTS[k]*100).toFixed(0)}%</td>
          <td class="num" style="font-weight:700;">${val.toFixed(0)}</td>
          <td class="num">${(val*WEIGHTS[k]).toFixed(1)}</td>
        </tr>`;
      }
      return `<tr data-score-item="${k}">
        <td style="font-size:12px;">${core.T(label.ar,label.en)} <span style="color:var(--ink-faint); font-size:10px;">(${core.T('تقدير المحلل','analyst estimate')})</span></td>
        <td class="num">${(WEIGHTS[k]*100).toFixed(0)}%</td>
        <td class="num"><input type="number" name="value" min="0" max="100" value="${val}" style="width:60px; padding:4px 6px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit; text-align:center;"></td>
        <td class="num" data-score-weighted>${(val*WEIGHTS[k]).toFixed(1)}</td>
      </tr>`;
    }).join('');

    return `
    <div class="section">
      <h3>🎯 ${core.T('الدرجة الاستثمارية المركّبة','Investment Score')}</h3>
      <div class="kv" style="margin-bottom:12px;">
        <div class="k">${core.T('الدرجة الكلية','Composite Score')}</div><div class="v"><b style="color:${band.color}; font-size:16px;">${composite.toFixed(0)}/100</b> — <span class="tag" style="background:${band.color}22; color:${band.color}; font-weight:700;">${core.T(band.ar,band.en)}</span></div>
      </div>
      <div class="tablewrap"><table class="db" style="font-size:11.5px;">
        <thead><tr><th>${core.T('الفئة','Category')}</th><th>${core.T('الوزن','Weight')}</th><th>${core.T('الدرجة (٠-١٠٠)','Score (0-100)')}</th><th>${core.T('المُرجَّح','Weighted')}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${canEdit? `<button type="button" class="btn btn-sm btn-primary" style="margin-top:10px;" data-action="score-save" data-id="${oppId}">💾 ${core.T('حفظ تقديرات المحلل','Save Analyst Estimates')}</button>` : ''}
      <p class="note" style="margin-top:8px;">${core.T('العائد المالي والمخاطر والعناية الواجبة تُحسَب آلياً وتتحدّث فوراً مع أي تعديل على الفرصة. الفئات المُعلَّمة "تقدير المحلل" يدوية لعدم توفر محرك سوق/مقارنات مبني بعد.','Financial Returns, Risk and Legal/Technical DD are computed automatically and update instantly with any change to the opportunity. Categories marked "analyst estimate" are manual pending a built Market Intelligence / Comparables engine.')}</p>
    </div>`;
  });

  document.addEventListener('input', (e)=>{
    const t = e.target;
    if(!t || t.name!=='value') return;
    const row = t.closest('tr[data-score-item]');
    if(!row) return;
    const weightText = row.children[1].textContent; // e.g. "15%"
    const weight = parseFloat(weightText)/100;
    const v = clamp(Number(t.value)||0, 0, 100);
    const cell = row.querySelector('[data-score-weighted]');
    if(cell) cell.textContent = (v*weight).toFixed(1);
  });

  core.registerActionHandler(async (action, el)=>{
    if(action!=='score-save') return false;
    const oppId = el.dataset.id;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec || !core.canEditOpp(rec)) return true;

    const draft = core.withDefaults(rec.data);
    const manual = draft.score.manual || (draft.score.manual = {});
    document.querySelectorAll('tr[data-score-item]').forEach(row=>{
      const key = row.dataset.scoreItem;
      const inp = row.querySelector('[name="value"]');
      if(inp) manual[key] = clamp(Number(inp.value)||0, 0, 100);
    });
    draft.meta.updatedAt = core.todayStr();
    draft.meta.updatedBy = core.currentUser ? core.currentUser.email : (draft.meta.updatedBy||null);

    await core.persistOpportunity({ id: oppId, data: draft });
    await core.loadAll();
    core.render();
    return true;
  });
}

export { computeInvestmentScore, scoreBand, WEIGHTS };
