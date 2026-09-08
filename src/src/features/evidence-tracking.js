/* =========================================================================
   المصادر والأدلة — Source & Evidence Tracking (Phase 2، النظام السادس
   والأخير في هذه المرحلة)
   ---------------------------------------------------------------------------
   لكل رقم رئيسي في الفرصة: القيمة الحالية (تُقرأ حياً من بيانات الفرصة، لا
   تُكرَّر) + المصدر + التاريخ + مستوى الثقة (عالية/متوسطة/منخفضة) — حتى تكون
   الإجابة عن "من أين أتى هذا الرقم؟" ضغطة واحدة بدل بحث. مخزَّنة في قاموس
   evidence مفتاحه مسار الحقل (نفس نمط المفاتيح الثابتة لتفادي مشكلة إعادة
   توليد المعرّفات العشوائية بين كل withDefaults()). لا تعديل على core.js.
   ========================================================================= */

const CONFIDENCE = [
  { key:'high',   ar:'عالية',   en:'High',   color:'#34d399' },
  { key:'medium', ar:'متوسطة',  en:'Medium', color:'#fbbf24' },
  { key:'low',    ar:'منخفضة',  en:'Low',    color:'#f87171' },
];
const CONF_BY_KEY = Object.fromEntries(CONFIDENCE.map(c=>[c.key,c]));

const KEY_FIELDS = [
  { path:'land.price',              ar:'سعر متر الأرض',              en:'Land price/m²',           appliesTo:null,          fmt:'sar' },
  { path:'land.far',                ar:'معامل البناء (FAR)',         en:'FAR',                     appliesTo:null,          fmt:'num' },
  { path:'financing.saibor',        ar:'السايبور',                   en:'SAIBOR',                  appliesTo:null,          fmt:'pct' },
  { path:'financing.margin',        ar:'هامش البنك',                 en:'Bank margin',             appliesTo:null,          fmt:'pct' },
  { path:'income.rent',             ar:'الإيجار السنوي/م²',          en:'Annual rent/m²',          appliesTo:'income',      fmt:'sar' },
  { path:'income.occupancy',        ar:'نسبة الإشغال',                en:'Occupancy',               appliesTo:'income',      fmt:'pct' },
  { path:'wacc.marketCap',          ar:'معدل الرسملة عند الخروج',      en:'Exit cap rate',           appliesTo:'income',      fmt:'pct' },
  { path:'development.salePrice',   ar:'سعر البيع المتوقع/م²',        en:'Expected sale price/m²',  appliesTo:'development', fmt:'sar' },
  { path:'development.buildCost',   ar:'تكلفة البناء/م²',             en:'Build cost/m²',           appliesTo:'development', fmt:'sar' },
  { path:'development.exitCapRate', ar:'معدل الرسملة عند الخروج',      en:'Exit cap rate',           appliesTo:'development', fmt:'pct' },
  { path:'landbank.appreciation',   ar:'معدل نمو قيمة الأرض',          en:'Land appreciation rate',  appliesTo:'landbank',    fmt:'pct' },
];

function fieldsFor(oppType){ return KEY_FIELDS.filter(f=>f.appliesTo===null || f.appliesTo===oppType); }
function fmtVal(core, fmt, v){
  if(v==null) return '—';
  if(fmt==='sar') return core.fmtSAR(v);
  if(fmt==='pct') return core.fmtPct(v);
  return core.fmtNum(v);
}

export function registerEvidenceTracking(core){
  core.registerOpportunitySchemaExtender(()=>({ evidence: {} }));

  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec) return '';
    const canEdit = core.canEditOpp(rec);
    const evidence = d.evidence || {};
    const fields = fieldsFor(d.meta.oppType);
    const withEvidence = fields.filter(f=>evidence[f.path] && evidence[f.path].source).length;

    const rows = fields.map(f=>{
      const ev = evidence[f.path] || {};
      const val = fmtVal(core, f.fmt, core.getPath(d, f.path));
      if(!canEdit){
        const conf = CONF_BY_KEY[ev.confidence];
        return `<tr>
          <td style="font-size:12px;">${core.T(f.ar,f.en)}</td><td class="num" style="font-weight:700;">${val}</td>
          <td style="font-size:11.5px;">${core.esc(ev.source||'—')}</td><td class="mono">${core.esc(ev.date||'—')}</td>
          <td>${conf? `<span class="tag" style="background:${conf.color}22; color:${conf.color}; font-size:10px;">${core.T(conf.ar,conf.en)}</span>` : '—'}</td>
        </tr>`;
      }
      return `<tr data-ev-item="${f.path}">
        <td style="font-size:12px; min-width:150px;">${core.T(f.ar,f.en)}</td>
        <td class="num" style="font-weight:700;">${val}</td>
        <td><input type="text" name="source" value="${core.esc(ev.source||'')}" placeholder="${core.T('المصدر','Source')}" style="width:140px; padding:5px 7px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;"></td>
        <td><input type="date" name="date" value="${core.esc(ev.date||'')}" style="padding:5px 6px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;"></td>
        <td><select name="confidence" style="padding:5px 6px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;">
          <option value="">—</option>
          ${CONFIDENCE.map(cf=>`<option value="${cf.key}" ${cf.key===ev.confidence?'selected':''}>${core.T(cf.ar,cf.en)}</option>`).join('')}
        </select></td>
      </tr>`;
    }).join('');

    return `
    <div class="section">
      <h3>🔎 ${core.T('المصادر والأدلة','Source & Evidence')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(Source & Evidence Tracking)</span></h3>
      <p class="note" style="margin:0 0 10px;">${withEvidence}/${fields.length} ${core.T('رقماً رئيسياً موثَّق المصدر','key figures sourced')}</p>
      <div class="tablewrap"><table class="db" style="font-size:11.5px;">
        <thead><tr><th>${core.T('الرقم','Figure')}</th><th>${core.T('القيمة الحالية','Current Value')}</th><th>${core.T('المصدر','Source')}</th><th>${core.T('التاريخ','Date')}</th><th>${core.T('الثقة','Confidence')}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${canEdit? `<button type="button" class="btn btn-sm btn-primary" style="margin-top:10px;" data-action="ev-save" data-id="${oppId}">💾 ${core.T('حفظ المصادر','Save Sources')}</button>` : ''}
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action!=='ev-save') return false;
    const oppId = el.dataset.id;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec || !core.canEditOpp(rec)) return true;

    const draft = core.withDefaults(rec.data);
    const evidence = draft.evidence || (draft.evidence = {});
    document.querySelectorAll('tr[data-ev-item]').forEach(row=>{
      const path = row.dataset.evItem;
      const source = row.querySelector('[name="source"]').value.trim();
      const date = row.querySelector('[name="date"]').value;
      const confidence = row.querySelector('[name="confidence"]').value;
      if(source || date || confidence) evidence[path] = { source, date, confidence: confidence||null };
      else delete evidence[path];
    });
    draft.meta.updatedAt = core.todayStr();
    draft.meta.updatedBy = core.currentUser ? core.currentUser.email : (draft.meta.updatedBy||null);

    await core.persistOpportunity({ id: oppId, data: draft });
    await core.loadAll();
    core.render();
    return true;
  });
}
