/* =========================================================================
   لجنة الاستثمار — Investment Committee Workflow (Phase 1، النظام السابع
   والأخير في هذه المرحلة)
   ---------------------------------------------------------------------------
   سجل قرارات لجنة الاستثمار لكل فرصة (وقد تجتمع اللجنة أكثر من مرة على نفس
   الفرصة — Revise/Hold ثم إعادة عرض): القرار (اعتماد / اعتماد بشروط / رفض /
   مراجعة / تعليق) + الأسباب + الشروط (كل شرط: نص + مسؤول + موعد نهائي + حالة
   إنجاز يمكن تحديثها لاحقاً) + من قرَّر ومتى.
   سجل إضافة فقط (Append-only) مطابق لنمط سجل التعديلات — لا حاجة لمعرّفات
   عشوائية لأن الإدخالات لا تُنشأ إلا بعد الحفظ الفعلي (لا قيم افتراضية مسبقة)،
   فمواضع المصفوفة (index) مستقرة تماماً بخلاف حقول العناية الواجبة/المخاطر.
   يعرض في أعلى القسم ملخص جاهزية سريع من نظامي جودة البيانات والعناية الواجبة
   (Data Quality + Due Diligence) — استيراد مباشر من ملفيهما (لا حاجة للمرور
   عبر core.js لإعادة استخدام منطق مُصدَّر من ملف ميزة آخر). لا تعديل على
   منطق core.js الداخلي — فقط عبر نقاط التوسّع المُصدَّرة.
   ========================================================================= */

import { dataQualityStats } from './data-quality.js';
import { ddStats, defaultItemsDict as ddDefaultItemsDict } from './due-diligence.js';

const DECISIONS = [
  { key:'approve',            ar:'اعتماد',            en:'Approve',                 color:'#34d399' },
  { key:'approve_conditions', ar:'اعتماد بشروط',      en:'Approve with Conditions', color:'#a3e635' },
  { key:'revise',             ar:'مراجعة وإعادة عرض', en:'Revise & Resubmit',       color:'#fbbf24' },
  { key:'hold',               ar:'تعليق',              en:'Hold',                    color:'#fb923c' },
  { key:'reject',             ar:'رفض',                en:'Reject',                  color:'#f87171' },
];
const DEC_BY_KEY = Object.fromEntries(DECISIONS.map(d=>[d.key,d]));

function splitLines(text){
  return String(text||'').split('\n').map(s=>s.trim()).filter(Boolean);
}

export function registerICWorkflow(core){
  core.registerOpportunitySchemaExtender(()=>({
    ic: { decisions: [] }, // {decision, reasons:[string], conditions:[{text,owner,dueDate,status}], decidedBy, decidedAt}
  }));

  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec) return '';
    const canEdit = core.canEditOpp(rec);
    const decisions = (d.ic && d.ic.decisions) || [];
    const latest = decisions.length? decisions[decisions.length-1] : null;

    // ملخص جاهزية سريع
    const dq = dataQualityStats(core, d);
    const dd = ddStats((d.dd && d.dd.items) || ddDefaultItemsDict());
    const readinessOk = dq.criticalMissing.length===0 && dd.criticalPending===0;

    return `
    <div class="section">
      <h3>🏛️ ${core.T('لجنة الاستثمار','Investment Committee')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(IC Workflow)</span></h3>

      <div class="kv" style="margin-bottom:12px;">
        <div class="k">${core.T('جودة البيانات','Data Quality')}</div><div class="v">${dq.criticalMissing.length===0? `✅ ${core.T('مكتملة','Complete')}` : `<span style="color:var(--bad);">⚠️ ${dq.criticalMissing.length} ${core.T('مُدخل حرج مفقود','critical input(s) missing')}</span>`}</div>
        <div class="k">${core.T('العناية الواجبة','Due Diligence')}</div><div class="v">${dd.criticalPending===0? `✅ ${core.T('لا بنود حرجة معلّقة','No critical items pending')}` : `<span style="color:var(--bad);">⚠️ ${dd.criticalPending} ${core.T('بند حرج معلّق','critical item(s) pending')}</span>`} (${dd.completed}/${dd.total})</div>
        <div class="k">${core.T('الحالة الحالية','Current Decision')}</div><div class="v">${latest? `<span class="tag" style="background:${DEC_BY_KEY[latest.decision].color}22; color:${DEC_BY_KEY[latest.decision].color}; font-weight:700;">${core.T(DEC_BY_KEY[latest.decision].ar, DEC_BY_KEY[latest.decision].en)}</span>` : `<span class="tag">${core.T('لم يُتخَذ قرار بعد','No decision yet')}</span>`}</div>
      </div>
      ${!readinessOk? `<p class="note" style="color:var(--bad); margin:0 0 12px;">🚫 ${core.T('يُنصح بإكمال جودة البيانات والعناية الواجبة الحرجة قبل رفع الفرصة للجنة.','Recommended to complete critical data quality and due diligence items before IC submission.')}</p>` : ''}

      ${decisions.length? `
      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:${canEdit?'16px':'0'};">
        ${decisions.slice().reverse().map((dec, revIdx)=>{
          const idx = decisions.length-1-revIdx;
          const band = DEC_BY_KEY[dec.decision] || DEC_BY_KEY.hold;
          return `
          <div style="padding:12px; border:1px solid var(--border); border-radius:10px; ${idx===decisions.length-1?'background:var(--surface-2);':''}">
            <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px;">
              <span class="tag" style="background:${band.color}22; color:${band.color}; font-weight:700;">${core.T(band.ar,band.en)}</span>
              <span style="font-size:11px; color:var(--ink-faint);">${core.esc(dec.decidedBy||'')} · ${core.esc((dec.decidedAt||'').slice(0,16).replace('T',' '))}</span>
            </div>
            ${(dec.reasons&&dec.reasons.length)? `<ul style="margin:8px 0 0; padding-inline-start:20px;">${dec.reasons.map(r=>`<li style="font-size:12px; line-height:1.6;">${core.esc(r)}</li>`).join('')}</ul>` : ''}
            ${(dec.conditions&&dec.conditions.length)? `
            <div style="margin-top:8px;">
              <p style="font-size:11.5px; font-weight:700; margin:0 0 4px;">${core.T('الشروط','Conditions')}</p>
              <div style="display:flex; flex-direction:column; gap:4px;">
                ${dec.conditions.map((cond,ci)=>`
                <div style="display:flex; align-items:center; gap:6px; font-size:12px;" data-ic-condition="${idx}:${ci}">
                  ${canEdit && idx===decisions.length-1? `<input type="checkbox" ${cond.status==='met'?'checked':''} data-action="ic-toggle-condition" data-idx="${idx}" data-ci="${ci}" data-oppid="${oppId}">` : (cond.status==='met'? '✅' : '⬜')}
                  <span style="${cond.status==='met'?'text-decoration:line-through; color:var(--ink-faint);':''}">${core.esc(cond.text)}${cond.owner? ` — <b>${core.esc(cond.owner)}</b>`:''}${cond.dueDate? ` (${cond.dueDate})`:''}</span>
                </div>`).join('')}
              </div>
            </div>` : ''}
          </div>`;
        }).join('')}
      </div>` : ''}

      ${canEdit? `
      <div style="background:var(--surface-2); border:1px dashed var(--border); border-radius:10px; padding:12px;">
        <p class="step-sub" style="margin:0 0 10px;">${core.T('تسجيل قرار جديد للجنة الاستثمار','Record a new IC decision')}</p>
        <form data-ic-form="${oppId}" style="display:flex; flex-direction:column; gap:8px;">
          <select name="decision" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
            ${DECISIONS.map(dc=>`<option value="${dc.key}">${core.T(dc.ar,dc.en)}</option>`).join('')}
          </select>
          <textarea name="reasons" rows="3" placeholder="${core.T('الأسباب — سطر لكل سبب','Reasons — one per line')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;"></textarea>
          <textarea name="conditions" rows="3" placeholder="${core.T('الشروط (اختياري) — سطر لكل شرط، مثال: تأكيد سعر الأرض ≤ ٢٠٠٠ ر.س/م²','Conditions (optional) — one per line')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;"></textarea>
          <button type="button" class="btn btn-sm btn-primary" data-action="ic-decide" data-id="${oppId}">✅ ${core.T('تسجيل القرار','Record Decision')}</button>
        </form>
      </div>` : ''}
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='ic-decide'){
      const oppId = el.dataset.id;
      const form = document.querySelector(`form[data-ic-form="${oppId}"]`);
      if(!form) return true;
      const rec = core.opportunities.find(o=>o.id===oppId);
      if(!rec || !core.canEditOpp(rec)) return true;

      const decision = form.querySelector('[name="decision"]').value;
      const reasons = splitLines(form.querySelector('[name="reasons"]').value);
      const conditions = splitLines(form.querySelector('[name="conditions"]').value).map(text=>({ text, owner:'', dueDate:'', status:'pending' }));
      const decidedBy = core.currentUser ? core.currentUser.email : (core.DEMO_MODE ? 'زائر تجريبي' : 'محلي');

      const draft = core.withDefaults(rec.data);
      draft.ic.decisions = (draft.ic.decisions||[]).concat([{ decision, reasons, conditions, decidedBy, decidedAt: new Date().toISOString() }]);
      draft.meta.updatedAt = core.todayStr();
      draft.meta.updatedBy = decidedBy;

      await core.persistOpportunity({ id: oppId, data: draft });
      await core.loadAll();
      core.render();
      return true;
    }
    if(action==='ic-toggle-condition'){
      const oppId = el.dataset.oppid;
      const idx = Number(el.dataset.idx);
      const ci = Number(el.dataset.ci);
      const rec = core.opportunities.find(o=>o.id===oppId);
      if(!rec || !core.canEditOpp(rec)) return true;

      const draft = core.withDefaults(rec.data);
      const dec = draft.ic.decisions && draft.ic.decisions[idx];
      if(dec && dec.conditions && dec.conditions[ci]){
        dec.conditions[ci].status = (dec.conditions[ci].status==='met') ? 'pending' : 'met';
      }
      draft.meta.updatedAt = core.todayStr();
      draft.meta.updatedBy = core.currentUser ? core.currentUser.email : (draft.meta.updatedBy||null);

      await core.persistOpportunity({ id: oppId, data: draft });
      await core.loadAll();
      core.render();
      return true;
    }
    return false;
  });
}
