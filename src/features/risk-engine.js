/* =========================================================================
   محرك المخاطر — Risk Engine (Phase 1، النظام الخامس)
   ---------------------------------------------------------------------------
   سجل مخاطر (Risk Register) لكل فرصة عبر ١١ فئة ثابتة، كل فئة: احتمالية (١-٥)
   × أثر (١-٥) = درجة (١-٢٥)، مع إجراء تخفيف ومسؤول وموعد نهائي. المخاطر
   الإجمالية = أعلى درجة فئة (Overall Risk = Low/Medium/High) — نهج متحفّظ
   قياسي: أخطر بند فردي هو ما يحكم التصنيف الكلي، لا المتوسط.
   نفس نمط المفاتيح الثابتة المستخدَم في العناية الواجبة (فئة = مفتاح القاموس)
   لتفادي مشكلة تجدد أي معرّف عشوائي بين كل withDefaults(). لا تعديل على
   منطق core.js الداخلي — فقط عبر نقاط التوسّع المُصدَّرة.
   ========================================================================= */

const RISK_CATEGORIES = [
  { key:'acquisition',  ar:'الاستحواذ',        en:'Acquisition' },
  { key:'construction', ar:'الإنشاء',           en:'Construction' },
  { key:'market',       ar:'السوق',             en:'Market' },
  { key:'leasing',      ar:'التأجير',           en:'Leasing' },
  { key:'financing',    ar:'التمويل',           en:'Financing' },
  { key:'interestRate', ar:'معدل الفائدة',       en:'Interest Rate' },
  { key:'exit',         ar:'الخروج',            en:'Exit' },
  { key:'regulatory',   ar:'تنظيمية',           en:'Regulatory' },
  { key:'legal',        ar:'قانونية',           en:'Legal' },
  { key:'contractor',   ar:'المقاول',           en:'Contractor' },
  { key:'liquidity',    ar:'السيولة',           en:'Liquidity' },
];

function defaultRiskItems(){
  const out = {};
  RISK_CATEGORIES.forEach(c=>{ out[c.key] = { probability:1, impact:1, mitigation:'', owner:'', dueDate:'' }; });
  return out;
}
function scoreOf(it){ return (it.probability||1) * (it.impact||1); }
function bandOf(score){
  if(score>=15) return { key:'high',   ar:'مرتفعة', en:'High',   color:'#f87171' };
  if(score>=7)  return { key:'medium', ar:'متوسطة', en:'Medium', color:'#fbbf24' };
  return { key:'low', ar:'منخفضة', en:'Low', color:'#34d399' };
}
function riskStats(items){
  const scores = RISK_CATEGORIES.map(c=> scoreOf(items[c.key] || {probability:1,impact:1}));
  const maxScore = Math.max(0, ...scores);
  const highCount = scores.filter(s=>bandOf(s).key==='high').length;
  return { maxScore, overall: bandOf(maxScore), highCount };
}

export function registerRiskEngine(core){
  core.registerOpportunitySchemaExtender(()=>({
    risk: { items: defaultRiskItems() },
  }));

  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec) return '';
    const items = (d.risk && d.risk.items) || defaultRiskItems();
    const stats = riskStats(items);
    const canEdit = core.canEditOpp(rec);

    const rows = RISK_CATEGORIES.map(cat=>{
      const it = items[cat.key] || {probability:1, impact:1, mitigation:'', owner:'', dueDate:''};
      const score = scoreOf(it);
      const band = bandOf(score);
      if(!canEdit){
        return `<tr>
          <td style="font-size:12px;">${core.T(cat.ar,cat.en)}</td>
          <td class="num">${it.probability}</td><td class="num">${it.impact}</td>
          <td class="num"><b style="color:${band.color};">${score}</b></td>
          <td><span class="tag" style="background:${band.color}22; color:${band.color}; font-size:10.5px;">${core.T(band.ar,band.en)}</span></td>
          <td style="font-size:11.5px;">${core.esc(it.mitigation||'—')}</td>
        </tr>`;
      }
      const opts = [1,2,3,4,5];
      return `<tr data-risk-item="${cat.key}">
        <td style="font-size:12px; min-width:110px;">${core.T(cat.ar,cat.en)}</td>
        <td><select name="probability" style="padding:5px 6px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;">
          ${opts.map(n=>`<option value="${n}" ${n===it.probability?'selected':''}>${n}</option>`).join('')}
        </select></td>
        <td><select name="impact" style="padding:5px 6px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;">
          ${opts.map(n=>`<option value="${n}" ${n===it.impact?'selected':''}>${n}</option>`).join('')}
        </select></td>
        <td class="num" data-risk-score style="font-weight:700; color:${band.color};">${score}</td>
        <td><input type="text" name="mitigation" value="${core.esc(it.mitigation||'')}" placeholder="${core.T('إجراء التخفيف','Mitigation')}" style="width:150px; padding:5px 7px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;"></td>
        <td><input type="text" name="owner" value="${core.esc(it.owner||'')}" placeholder="${core.T('المسؤول','Owner')}" style="width:90px; padding:5px 7px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;"></td>
        <td><input type="date" name="dueDate" value="${core.esc(it.dueDate||'')}" style="padding:5px 6px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;"></td>
      </tr>`;
    }).join('');

    return `
    <div class="section">
      <h3>⚠️ ${core.T('محرك المخاطر','Risk Engine')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(Risk Register)</span></h3>
      <div class="kv" style="margin-bottom:12px;">
        <div class="k">${core.T('المخاطر الإجمالية','Overall Risk')}</div><div class="v"><span class="tag" style="background:${stats.overall.color}22; color:${stats.overall.color}; font-weight:700;">${core.T(stats.overall.ar,stats.overall.en)} (${stats.maxScore}/25)</span></div>
        ${stats.highCount>0? `<div class="k">${core.T('عدد فئات المخاطر المرتفعة','High-Risk Categories')}</div><div class="v" style="color:var(--bad); font-weight:700;">${stats.highCount}</div>` : ''}
      </div>
      <div class="tablewrap"><table class="db" style="font-size:11px;">
        <thead><tr>
          <th>${core.T('الفئة','Category')}</th><th>${core.T('احتمالية','Probability')}</th><th>${core.T('أثر','Impact')}</th><th>${core.T('الدرجة','Score')}</th>
          <th>${core.T('إجراء التخفيف','Mitigation')}</th>
          ${canEdit? `<th>${core.T('المسؤول','Owner')}</th><th>${core.T('الموعد النهائي','Due Date')}</th>` : ''}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${canEdit? `<button type="button" class="btn btn-sm btn-primary" style="margin-top:10px;" data-action="risk-save" data-id="${oppId}">💾 ${core.T('حفظ سجل المخاطر','Save Risk Register')}</button>` : ''}
    </div>`;
  });

  // إعادة حساب الدرجة مباشرة في الواجهة عند تغيير احتمالية/أثر أي فئة، دون انتظار الحفظ الكامل —
  // تفاعل بصري بسيط عبر مستمع تفويض عام (لا يعدّل بيانات core.js، فقط عرض مؤقت في الجدول).
  document.addEventListener('change', (e)=>{
    const t = e.target;
    if(!(t && t.name==='probability' || t.name==='impact')) return;
    const row = t.closest('tr[data-risk-item]');
    if(!row) return;
    const p = Number(row.querySelector('[name="probability"]').value)||1;
    const im = Number(row.querySelector('[name="impact"]').value)||1;
    const cell = row.querySelector('[data-risk-score]');
    if(cell){
      const band = bandOf(p*im);
      cell.textContent = p*im;
      cell.style.color = band.color;
    }
  });

  core.registerActionHandler(async (action, el)=>{
    if(action!=='risk-save') return false;
    const oppId = el.dataset.id;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec || !core.canEditOpp(rec)) return true;

    const draft = core.withDefaults(rec.data);
    const items = draft.risk.items || (draft.risk.items = defaultRiskItems());
    document.querySelectorAll('tr[data-risk-item]').forEach(row=>{
      const key = row.dataset.riskItem;
      if(!items[key]) items[key] = { probability:1, impact:1, mitigation:'', owner:'', dueDate:'' };
      const get = (name)=>{ const inp = row.querySelector(`[name="${name}"]`); return inp ? inp.value : undefined; };
      items[key].probability = Number(get('probability')) || items[key].probability;
      items[key].impact = Number(get('impact')) || items[key].impact;
      items[key].mitigation = (get('mitigation') ?? items[key].mitigation ?? '').trim();
      items[key].owner = (get('owner') ?? items[key].owner ?? '').trim();
      items[key].dueDate = get('dueDate') ?? items[key].dueDate;
    });
    draft.meta.updatedAt = core.todayStr();
    draft.meta.updatedBy = core.currentUser ? core.currentUser.email : (draft.meta.updatedBy||null);

    await core.persistOpportunity({ id: oppId, data: draft });
    await core.loadAll();
    core.render();
    return true;
  });
}

export { riskStats, RISK_CATEGORIES, defaultRiskItems, scoreOf, bandOf };
