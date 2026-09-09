/* =========================================================================
   التسعير الموثَّق بالإصدارات — Versioned Underwriting (المرحلة السابعة،
   P0 #7 — "أهم إضافة استراتيجية")
   ---------------------------------------------------------------------------
   "هل تغيرت الصفقة أم تغيّر افتراضنا؟" — لا جواب لهذا السؤال بلا لقطات مؤرَّخة
   للأرقام الرئيسية عند لحظات حاسمة: عند كل قرار لجنة استثمار جديد (تلقائياً)،
   أو يدوياً في أي وقت (مثلاً بعد نتيجة عناية واجبة، أو عرض بائع مضاد). كل نسخة
   (Version) تُخزَّن *كأرقام ثابتة وقت الحفظ*، لا كصيغة تُعاد حسابها لاحقاً —
   لأن الغاية بالتحديد هي كشف تغيّر الافتراضات نفسها (Benchmark/معدل الرسملة/
   السايبور...) بمرور الزمن، فإعادة حساب النسخ القديمة بافتراضات اليوم يُبطل
   الغاية كلياً.

   مجموعة Firestore مستقلة ومسطَّحة (underwritingVersions، بحقل oppId — نفس
   نمط oppAuditLog بالضبط لا subcollection) — append-only بتصميم firestore.rules
   (create لأي عضو مصرَّح له، update/delete للأدمن فقط — نفس فكرة "تعديل
   السجل التاريخي نادر واستثنائي، لا إجراء اعتيادي").

   حقل actuals (عبر registerOpportunitySchemaExtender) لإدخال النتائج الفعلية
   المُحقَّقة بعد الإغلاق/التنفيذ — يُمكِّن مقارنة "الفعلي vs. المُسعَّر" (Actual
   vs. Underwriting)، وهو الأساس لاحقاً لتعلّم Benchmark من الصفقات المُغلَقة
   فعلياً (خارج نطاق هذه المرحلة — P2 في خارطة الطريق).
   لا تعديل على core.js — فقط عبر نقاط التوسّع المُصدَّرة.
   ========================================================================= */

const UW_COLLECTION = 'underwritingVersions';

const STAGE_LABELS = {
  v1_asking:        { ar:'v1 — عند العرض الأولي',        en:'v1 — Initial Ask' },
  v2_post_dd:        { ar:'v2 — بعد العناية الواجبة',      en:'v2 — Post-DD' },
  v3_term_sheet:     { ar:'v3 — بعد Term Sheet',           en:'v3 — Post Term Sheet' },
  v4_ic_approved:    { ar:'v4 — معتمَدة من اللجنة',        en:'v4 — IC-Approved' },
  manual:            { ar:'لقطة يدوية',                    en:'Manual Snapshot' },
};

function snapshotMetrics(core, d){
  let c; try{ c = core.compute(d); }catch(e){ c = {}; }
  return {
    oppType: d.meta.oppType,
    price: (d.land && d.land.price!=null) ? d.land.price : null,
    equityIRR: isFinite(c.equityIRR) ? c.equityIRR : null,
    projectIRR: isFinite(c.projectIRR) ? c.projectIRR : null,
    MOIC: isFinite(c.MOIC) ? c.MOIC : null,
    dscrMin: (c.dscrMin!=null && isFinite(c.dscrMin)) ? c.dscrMin : null,
  };
}

function fmtMetric(core, key, v){
  if(v==null) return '—';
  if(key==='price') return core.fmtSAR(v);
  if(key==='equityIRR' || key==='projectIRR') return core.fmtPct(v);
  if(key==='MOIC') return v.toFixed(2)+'×';
  if(key==='dscrMin') return v.toFixed(2)+'×';
  return String(v);
}

export function registerUnderwritingVersions(core){
  core.registerDataCollection(UW_COLLECTION);

  core.registerOpportunitySchemaExtender(()=>({
    actuals: { enabled:false, asOfDate:'', actualPrice:null, actualEquityIRR:null, actualMOIC:null, notes:'' },
  }));

  // لقطة تلقائية عند كل قرار لجنة جديد — نكتشف ذلك بمقارنة عدد قرارات
  // ic.decisions قبل/بعد الحفظ (لا حاجة لأي حقل جديد أو تعديل على ic-workflow.js).
  core.registerBeforeOpportunitySave(async (oldData, newData, oppId)=>{
    const oldCount = (oldData && oldData.ic && oldData.ic.decisions) ? oldData.ic.decisions.length : 0;
    const newCount = (newData.ic && newData.ic.decisions) ? newData.ic.decisions.length : 0;
    if(newCount <= oldCount) return; // لا قرار جديد في هذا الحفظ

    const latestDecision = newData.ic.decisions[newData.ic.decisions.length-1];
    const stage = (latestDecision && (latestDecision.decision==='approve' || latestDecision.decision==='approve_conditions')) ? 'v4_ic_approved' : null;
    // نسجّل لقطة فقط عند اعتماد/اعتماد بشروط — قرارات المراجعة/التعليق/الرفض
    // ليست "تسعيراً مُعتمَداً" يستحق نسخة v4، لكنها تبقى ظاهرة في سجل قرارات
    // اللجنة (ic-workflow.js) نفسه دون تكرار.
    if(!stage) return;

    const rec = { id: core.uid('UWV'), data: {
      oppId, stage,
      label: STAGE_LABELS[stage].ar,
      savedAt: new Date().toISOString(),
      savedBy: core.currentUser ? core.currentUser.email : (core.DEMO_MODE ? 'زائر تجريبي' : 'محلي'),
      trigger: 'ic_decision',
      metrics: snapshotMetrics(core, newData),
    }};
    await core.persistIfRecord(UW_COLLECTION, rec);
  });

  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec) return '';
    const canEdit = core.canEditOpp(rec);
    const versions = (core.STORE[UW_COLLECTION]||[]).filter(v=>v.data.oppId===oppId).slice().sort((a,b)=> (a.data.savedAt<b.data.savedAt)?-1:1);
    const current = snapshotMetrics(core, d);
    const actuals = d.actuals || {};

    const metricKeys = [
      { key:'price',      ar:'سعر متر الأرض',        en:'Land price/m²' },
      { key:'equityIRR',  ar:'Equity IRR',            en:'Equity IRR' },
      { key:'MOIC',       ar:'MOIC',                  en:'MOIC' },
      { key:'dscrMin',    ar:'DSCR (أدنى)',           en:'DSCR (min)' },
    ];

    const timelineRows = versions.map(v=>`<tr>
      <td style="font-size:12px; font-weight:600;">${core.T(STAGE_LABELS[v.data.stage]? STAGE_LABELS[v.data.stage].ar : v.data.label, STAGE_LABELS[v.data.stage]? STAGE_LABELS[v.data.stage].en : v.data.label)}</td>
      ${metricKeys.map(m=>`<td class="num">${fmtMetric(core, m.key, v.data.metrics[m.key])}</td>`).join('')}
      <td class="mono" style="font-size:11px;">${core.esc((v.data.savedAt||'').slice(0,10))}</td>
      <td style="font-size:10.5px; color:var(--ink-faint);">${v.data.trigger==='ic_decision'? '🏛️ IC' : '📌 '+core.T('يدوي','manual')}</td>
    </tr>`).join('');
    const currentRow = `<tr style="background:var(--surface-2);">
      <td style="font-size:12px; font-weight:700;">${core.T('الحالي (حيّ)','Current (live)')}</td>
      ${metricKeys.map(m=>`<td class="num" style="font-weight:700;">${fmtMetric(core, m.key, current[m.key])}</td>`).join('')}
      <td colspan="2" style="font-size:10.5px; color:var(--ink-faint);">${core.T('يُعاد حسابه حياً من بيانات الفرصة الآن','recomputed live from current data')}</td>
    </tr>`;

    const actualsSection = canEdit ? `
      <div style="margin-top:14px; padding:12px; border:1px dashed var(--border); border-radius:10px;">
        <p class="step-sub" style="margin:0 0 8px;">${core.T('الأداء الفعلي (بعد الإغلاق/التنفيذ)','Actual Performance (post-close)')}</p>
        <form data-uw-actuals="${oppId}" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px,1fr)); gap:8px;">
          <label style="display:flex; align-items:center; gap:6px; font-size:12px;"><input type="checkbox" name="enabled" ${actuals.enabled?'checked':''}> ${core.T('تفعيل تتبّع الفعلي','Track actuals')}</label>
          <input type="date" name="asOfDate" value="${core.esc(actuals.asOfDate||'')}" style="padding:7px 9px; border:1px solid var(--border); border-radius:7px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12px;">
          <input type="number" name="actualPrice" placeholder="${core.T('السعر الفعلي/م²','Actual price/m²')}" value="${actuals.actualPrice??''}" style="padding:7px 9px; border:1px solid var(--border); border-radius:7px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12px;">
          <input type="number" name="actualEquityIRR" placeholder="${core.T('Equity IRR الفعلي (%)','Actual Equity IRR (%)')}" step="0.1" value="${actuals.actualEquityIRR!=null? (actuals.actualEquityIRR*100).toFixed(1):''}" style="padding:7px 9px; border:1px solid var(--border); border-radius:7px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12px;">
          <input type="number" name="actualMOIC" placeholder="${core.T('MOIC الفعلي','Actual MOIC')}" step="0.01" value="${actuals.actualMOIC??''}" style="padding:7px 9px; border:1px solid var(--border); border-radius:7px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12px;">
          <input type="text" name="notes" placeholder="${core.T('ملاحظات','Notes')}" value="${core.esc(actuals.notes||'')}" style="padding:7px 9px; border:1px solid var(--border); border-radius:7px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12px;">
        </form>
        <button type="button" class="btn btn-sm btn-primary" style="margin-top:8px;" data-action="uw-save-actuals" data-id="${oppId}">💾 ${core.T('حفظ الأداء الفعلي','Save Actuals')}</button>
        ${actuals.enabled && actuals.actualEquityIRR!=null && current.equityIRR!=null? `<p class="note" style="margin-top:8px;">${core.T('الفرق عن آخر تسعير (الحالي)','Delta vs. current underwriting')}: <b style="color:${(actuals.actualEquityIRR-current.equityIRR)>=0?'var(--good)':'var(--bad)'};">${(actuals.actualEquityIRR-current.equityIRR)>=0?'+':''}${((actuals.actualEquityIRR-current.equityIRR)*100).toFixed(1)} ${core.T('نقطة','pts')}</b></p>` : ''}
      </div>` : '';

    return `
    <div class="section">
      <h3>📌 ${core.T('التسعير الموثَّق بالإصدارات','Versioned Underwriting')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(v1→v4 + Actual)</span></h3>
      <p class="note" style="margin:0 0 10px;">${core.T('لقطة أرقام ثابتة (لا تُعاد حسابها لاحقاً) عند كل اعتماد من اللجنة — لمعرفة "هل تغيّرت الصفقة أم تغيّر افتراضنا؟"','Frozen snapshots (never recomputed later) taken at every IC approval — to answer "did the deal change, or did our assumption change?"')}</p>
      ${versions.length===0? `<p class="note">${core.T('لا توجد نسخ محفوظة بعد — تُحفَظ تلقائياً عند أول قرار اعتماد من اللجنة، أو يدوياً بالزر أدناه.','No versions saved yet — a version is captured automatically on the first IC approval, or manually below.')}</p>` : `
      <div class="tablewrap"><table class="db" style="font-size:11.5px;">
        <thead><tr><th>${core.T('المرحلة','Stage')}</th>${metricKeys.map(m=>`<th>${core.T(m.ar,m.en)}</th>`).join('')}<th>${core.T('التاريخ','Date')}</th><th>${core.T('السبب','Trigger')}</th></tr></thead>
        <tbody>${timelineRows}${currentRow}</tbody>
      </table></div>`}
      ${canEdit? `<button type="button" class="btn btn-sm btn-ghost" style="margin-top:10px;" data-action="uw-save-manual" data-id="${oppId}">📌 ${core.T('حفظ لقطة يدوية الآن','Save Manual Snapshot Now')}</button>` : ''}
      ${actualsSection}
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='uw-save-manual'){
      const oppId = el.dataset.id;
      const rec = core.opportunities.find(o=>o.id===oppId);
      if(!rec || !core.canEditOpp(rec)) return true;
      const draft = core.withDefaults(rec.data);
      const versionRec = { id: core.uid('UWV'), data: {
        oppId, stage:'manual', label: STAGE_LABELS.manual.ar,
        savedAt: new Date().toISOString(),
        savedBy: core.currentUser ? core.currentUser.email : (core.DEMO_MODE ? 'زائر تجريبي' : 'محلي'),
        trigger: 'manual',
        metrics: snapshotMetrics(core, draft),
      }};
      await core.persistIfRecord(UW_COLLECTION, versionRec);
      core.render();
      return true;
    }
    if(action==='uw-save-actuals'){
      const oppId = el.dataset.id;
      const form = document.querySelector(`form[data-uw-actuals="${oppId}"]`);
      if(!form) return true;
      const rec = core.opportunities.find(o=>o.id===oppId);
      if(!rec || !core.canEditOpp(rec)) return true;

      const draft = core.withDefaults(rec.data);
      const get = (name)=>{ const inp=form.querySelector(`[name="${name}"]`); return inp?inp.value:''; };
      const enabled = !!(form.querySelector('[name="enabled"]')||{}).checked;
      const irrPct = get('actualEquityIRR');
      draft.actuals = {
        enabled,
        asOfDate: get('asOfDate') || core.todayStr(),
        actualPrice: get('actualPrice')===''? null : Number(get('actualPrice')),
        actualEquityIRR: irrPct===''? null : Number(irrPct)/100,
        actualMOIC: get('actualMOIC')===''? null : Number(get('actualMOIC')),
        notes: get('notes').trim(),
      };
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
