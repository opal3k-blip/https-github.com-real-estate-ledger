/* =========================================================================
   مدير السيناريوهات — Scenario Manager (Phase 2، النظام الثالث)
   ---------------------------------------------------------------------------
   core.js يملك أصلاً قسم "سيناريوهات وحساسية" (سطر ~3138) بمقارنة Base/
   Optimistic/Pessimistic ثابتة (scenarioCompareRows) — جيدة لكن غير قابلة
   للتعديل (لا واجهة لضبط الافتراضات) وتفتقد سيناريو "Stress" الرابع الذي
   طلبه المستخدم صراحة (Base/Upside/Downside/Stress).
   قرار تصميم مهم: **لا نسجّل schema extender لمفتاح `scenarios`** — لأنه
   موجود أصلاً في blankOpportunity() الأساسية بقيم optimistic/pessimistic
   حقيقية، وObject.assign(base, fn()) في core.js يدمج على مستوى المفاتيح
   الجذرية فقط (shallow) — أي schema extender يُعيد {scenarios:{...}} كان
   سيستبدل الكائن بالكامل ويمحو optimistic/pessimistic الافتراضيين لكل فرصة
   جديدة. بدلاً من ذلك: نحسب افتراضي "Stress" محلياً هنا فقط عند الاستخدام
   (بلا تخزين حتى أول تعديل فعلي من المحلل)، ونعدّل scenarios.optimistic/
   pessimistic/stress مباشرة كحقول عادية ضمن draft عند الحفظ — تماماً كما
   تُعدَّل أي حقول أخرى موجودة أصلاً في مخطط الفرصة (لا فرق عن تعديل land.price
   مثلاً). نعيد استخدام core.compute(o, scenarioKey) نفسه دون أي تكرار لمنطقه
   المالي — فقط عبر كائن مؤقت (trial) لا يُحفَظ إلا بموافقة صريحة من المستخدم.
   ========================================================================= */

const DEFAULT_STRESS = { rentMult:0.80, salePriceMult:0.78, costMult:1.20, capRateDelta:0.020, rateDelta:0.015 };
const SCEN_DEFS = [
  { key:'pessimistic', ar:'متشائم (Downside)',  en:'Downside (Pessimistic)', color:'#fbbf24' },
  { key:'stress',      ar:'إجهاد (Stress)',      en:'Stress',                 color:'#f87171' },
  { key:'optimistic',  ar:'متفائل (Upside)',     en:'Upside (Optimistic)',    color:'#34d399' },
];
const FIELD_LABELS = {
  rentMult:      { ar:'مضاعف الإيجار/سعر البيع', en:'Rent/Sale Price Multiplier' },
  salePriceMult: { ar:'مضاعف سعر البيع',          en:'Sale Price Multiplier' },
  costMult:      { ar:'مضاعف التكلفة',            en:'Cost Multiplier' },
  capRateDelta:  { ar:'تغيّر معدل الرسملة (نقاط)',  en:'Cap Rate Delta (pts)' },
  rateDelta:     { ar:'تغيّر سعر الفائدة (نقاط)',   en:'Interest Rate Delta (pts)' },
};

function scenarioPreset(d, key){
  if(key==='stress') return Object.assign({}, DEFAULT_STRESS, d.scenarios && d.scenarios.stress);
  return (d.scenarios && d.scenarios[key]) || {};
}
function computeAt(core, d, key){
  const trial = JSON.parse(JSON.stringify(d));
  trial.scenarios = Object.assign({}, trial.scenarios, { [key]: scenarioPreset(d, key) });
  return core.compute(trial, key);
}

export function registerScenarioManager(core){
  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec) return '';
    const canEdit = core.canEditOpp(rec);
    const base = c; // نفس نتيجة الحساب الأساسي المُمرَّرة أصلاً لكل أقسام التفاصيل — لا حساب مكرر.

    const rows = [{ key:'base', ar:'الأساسي (Base)', en:'Base', color:'#60a5fa', c: base }]
      .concat(SCEN_DEFS.map(s=>({ ...s, c: computeAt(core, d, s.key) })));

    return `
    <div class="section">
      <h3>🧭 ${core.T('مدير السيناريوهات','Scenario Manager')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">Base / Upside / Downside / Stress</span></h3>
      <div class="tablewrap" style="margin-bottom:14px;"><table class="report">
        <thead><tr><th>${core.T('السيناريو','Scenario')}</th><th>Equity IRR</th><th>MOIC</th><th>NPV</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr ${r.key==='base'?'style="font-weight:700;"':''}>
            <td><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${r.color}; margin-inline-end:6px;"></span>${core.T(r.ar,r.en)}</td>
            <td class="num">${core.fmtPct(r.c.equityIRR)}</td><td class="num">${r.c.MOIC.toFixed(2)}×</td><td class="num">${core.fmtSAR(r.c.npvProject)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>

      ${canEdit? SCEN_DEFS.map(s=>{
        const preset = scenarioPreset(d, s.key);
        return `
        <div style="background:var(--surface-2); border:1px dashed var(--border); border-radius:10px; padding:10px 12px; margin-bottom:10px;">
          <p class="step-sub" style="margin:0 0 8px;">${core.T('تعديل افتراضات','Edit assumptions —')} ${core.T(s.ar,s.en)}</p>
          <form data-scen-form="${oppId}:${s.key}" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px,1fr)); gap:8px;">
            ${Object.keys(FIELD_LABELS).map(f=>`
              <label style="display:flex; flex-direction:column; gap:3px; font-size:10.5px; color:var(--ink-faint);">
                ${core.T(FIELD_LABELS[f].ar, FIELD_LABELS[f].en)}
                <input type="number" step="0.005" name="${f}" value="${preset[f]!=null?preset[f]:''}" style="padding:6px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:11.5px;">
              </label>`).join('')}
          </form>
          <button type="button" class="btn btn-sm" style="margin-top:8px;" data-action="scen-save" data-id="${oppId}" data-key="${s.key}">💾 ${core.T('حفظ','Save')}</button>
        </div>`;
      }).join('') : ''}
      <p class="note">${core.T('السيناريوهات المتفائل/المتشائم قائمة أصلاً في قسم "سيناريوهات وحساسية" أعلاه بنفس القيم — هذا القسم يضيف سيناريو "الإجهاد" الرابع وقابلية تعديل كل الافتراضات لكل سيناريو حسب حكم المحلل.','Upside/Downside already appear in the "Scenarios & Sensitivity" section above with the same values — this section adds the 4th "Stress" scenario and lets the analyst edit every scenario\'s assumptions.')}</p>
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action!=='scen-save') return false;
    const oppId = el.dataset.id;
    const key = el.dataset.key;
    const rec = core.opportunities.find(o=>o.id===oppId);
    const form = document.querySelector(`form[data-scen-form="${oppId}:${key}"]`);
    if(!rec || !form || !core.canEditOpp(rec)) return true;

    const draft = core.withDefaults(rec.data);
    const preset = {};
    Object.keys(FIELD_LABELS).forEach(f=>{
      const v = form.querySelector(`[name="${f}"]`).value;
      preset[f] = v===''? (DEFAULT_STRESS[f]!=null?DEFAULT_STRESS[f]:0) : Number(v);
    });
    draft.scenarios = Object.assign({}, draft.scenarios, { [key]: preset });
    draft.meta.updatedAt = core.todayStr();
    draft.meta.updatedBy = core.currentUser ? core.currentUser.email : (draft.meta.updatedBy||null);

    await core.persistOpportunity({ id: oppId, data: draft });
    await core.loadAll();
    core.render();
    return true;
  });
}
