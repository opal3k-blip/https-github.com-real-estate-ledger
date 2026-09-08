/* =========================================================================
   خط الأنابيب الاستثماري — Investment Pipeline (Phase 1، النظام الثاني)
   ---------------------------------------------------------------------------
   يتتبّع كل فرصة عبر مراحل واضحة من "عميل محتمل" حتى "الأرشفة"، مع: المرحلة
   الحالية، المرحلة السابقة، المسؤول (Owner)، تاريخ الدخول للمرحلة، عدد الأيام
   في المرحلة الحالية، سبب الانتقال، من قام بالانتقال، الإجراء التالي المطلوب
   وموعده النهائي — بالإضافة إلى سجل انتقالات كامل لكل فرصة.
   لوحة كاملة (Kanban) عبر registerMainView تعرض كل الفرص مجمّعة حسب المرحلة.
   لا تعديل هنا على منطق core.js الداخلي — فقط عبر نقاط التوسّع المُصدَّرة.
   ========================================================================= */

const PIPELINE_STAGES = [
  { key:'lead',          ar:'عميل محتمل',            en:'Lead',                    color:'#94a3b8' },
  { key:'screening',     ar:'الفرز الأولي',           en:'Screening',               color:'#60a5fa' },
  { key:'underwriting',  ar:'التحليل المالي',         en:'Underwriting',            color:'#38bdf8' },
  { key:'dd',            ar:'العناية الواجبة',        en:'Due Diligence',           color:'#22d3ee' },
  { key:'ic_review',     ar:'مراجعة لجنة الاستثمار',   en:'IC Review',               color:'#a78bfa' },
  { key:'approved',      ar:'معتمدة',                en:'Approved',                color:'#34d399' },
  { key:'negotiation',   ar:'التفاوض',                en:'Negotiation',             color:'#fbbf24' },
  { key:'closing',       ar:'الإغلاق',                en:'Closing',                 color:'#fb923c' },
  { key:'dev_ops',       ar:'التطوير / التشغيل',      en:'Development / Operation', color:'#818cf8' },
  { key:'exit',          ar:'الخروج',                 en:'Exit',                    color:'#4ade80' },
  { key:'archived',      ar:'مؤرشفة',                 en:'Archived',                color:'#9ca3af' },
];
const STAGE_BY_KEY = Object.fromEntries(PIPELINE_STAGES.map(s=>[s.key,s]));
const DEFAULT_STAGE = 'lead';

function stageLabel(core, key){
  const s = STAGE_BY_KEY[key];
  if(!s) return key||'—';
  return core.T(s.ar, s.en);
}
function daysSince(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr+'T00:00:00');
  if(isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms/86400000));
}

export function registerPipeline(core){
  // خط الأنابيب يُخزَّن داخل بيانات الفرصة نفسها (pipeline.*) — لا يحتاج مجموعة Firestore مستقلة.
  core.registerOpportunitySchemaExtender(()=>({
    pipeline: {
      stage: DEFAULT_STAGE,
      enteredStageAt: core.todayStr(),
      owner: '',
      nextAction: '',
      nextActionDeadline: '',
      history: [], // {fromStage, toStage, at, by, reason}
    },
  }));

  /* ---------------- زر شريط علوي لفتح لوحة خط الأنابيب ---------------- */
  core.registerTopbarButton(()=>{
    return `<button class="btn btn-sm" data-action="pipeline-open">🧭 ${core.T('خط الأنابيب الاستثماري','Investment Pipeline')}</button>`;
  });

  /* ---------------- اللوحة الكاملة (Kanban) ---------------- */
  core.registerMainView('pipeline', ()=>{
    const opps = core.opportunities.map(rec=>({ rec, d: core.withDefaults(rec.data) }));
    const groups = PIPELINE_STAGES.map(s=>({
      stage: s,
      items: opps.filter(o => (o.d.pipeline && o.d.pipeline.stage || DEFAULT_STAGE) === s.key),
    }));
    const totalActive = opps.filter(o=> (o.d.pipeline && o.d.pipeline.stage) !== 'archived').length;

    return `
    <div class="section" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 style="margin:0;">🧭 ${core.T('خط الأنابيب الاستثماري','Investment Pipeline')}</h2>
        <p class="note" style="margin:4px 0 0;">${core.T('عدد الفرص النشطة (بدون المؤرشفة)','Active opportunities (excluding archived)')}: <b>${totalActive}</b></p>
      </div>
      <button class="btn btn-sm btn-ghost" data-action="pipeline-close">✖ ${core.T('إغلاق ورجوع للوحة الفرص','Close & return to dashboard')}</button>
    </div>
    <div class="tablewrap" style="overflow-x:auto;">
      <div style="display:flex; gap:12px; min-width:${PIPELINE_STAGES.length*230}px; padding-bottom:8px;">
        ${groups.map(g=>`
          <div style="flex:0 0 218px; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:10px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
              <span style="width:9px; height:9px; border-radius:50%; background:${g.stage.color}; flex:0 0 auto;"></span>
              <div style="font-weight:700; font-size:12.5px;">${stageLabel(core, g.stage.key)}</div>
              <span class="tag" style="margin-inline-start:auto; font-size:10.5px;">${g.items.length}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; min-height:24px;">
              ${g.items.map(o=>{
                const p = o.d.pipeline || {};
                const days = daysSince(p.enteredStageAt);
                const overdue = p.nextActionDeadline && p.nextActionDeadline < core.todayStr();
                return `
                <div class="card" style="padding:9px 10px; cursor:pointer; border:1px solid var(--border); border-radius:8px; background:var(--surface);" data-action="open-detail" data-id="${o.rec.id}">
                  <div style="font-weight:700; font-size:12px; line-height:1.4;">${core.esc(o.d.meta.name||core.T('بدون اسم','Untitled'))}</div>
                  <div style="font-size:10.5px; color:var(--ink-faint); margin-top:2px;">${core.esc(o.d.meta.city||'')}</div>
                  <div style="font-size:10px; color:var(--ink-faint); margin-top:6px; display:flex; justify-content:space-between;">
                    <span>⏱ ${days==null?'—':days} ${core.T('يوم في المرحلة','days in stage')}</span>
                  </div>
                  ${p.owner? `<div style="font-size:10px; color:var(--ink-soft); margin-top:3px;">👤 ${core.esc(p.owner)}</div>` : ''}
                  ${p.nextAction? `<div style="font-size:10.5px; margin-top:5px; padding:5px 7px; border-radius:6px; background:${overdue?'var(--bad-soft)':'var(--surface-2)'}; color:${overdue?'var(--bad)':'var(--ink-soft)'};">
                    ➡ ${core.esc(p.nextAction)}${p.nextActionDeadline? ' — '+p.nextActionDeadline : ''}${overdue? ' ⚠️':''}
                  </div>` : ''}
                </div>`;
              }).join('') || `<div class="note" style="font-size:11px; text-align:center; padding:10px 0;">${core.T('لا توجد فرص','No opportunities')}</div>`}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='pipeline-open'){ core.setCoreState({ mainView:'pipeline', openDetailId:null, render:true }); return true; }
    if(action==='pipeline-close'){ core.setCoreState({ mainView:null, render:true }); return true; }
    return false;
  });

  /* ---------------- قسم داخل تفاصيل الفرصة: المرحلة الحالية + التحويل ---------------- */
  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec) return '';
    const p = d.pipeline || { stage: DEFAULT_STAGE, history: [] };
    const days = daysSince(p.enteredStageAt);
    const canEdit = core.canEditOpp(rec);
    return `
    <div class="section">
      <h3>🧭 ${core.T('خط الأنابيب الاستثماري','Investment Pipeline')}</h3>
      <div class="kv" style="margin-bottom:12px;">
        <div class="k">${core.T('المرحلة الحالية','Current Stage')}</div><div class="v"><span class="tag" style="background:${(STAGE_BY_KEY[p.stage]||{}).color||'#999'}22; color:${(STAGE_BY_KEY[p.stage]||{}).color||'#666'}; font-weight:700;">${stageLabel(core, p.stage)}</span></div>
        <div class="k">${core.T('أيام في هذه المرحلة','Days in this Stage')}</div><div class="v">${days==null?'—':days}</div>
        <div class="k">${core.T('المسؤول','Owner')}</div><div class="v">${core.esc(p.owner||'—')}</div>
        <div class="k">${core.T('الإجراء التالي','Next Action')}</div><div class="v">${core.esc(p.nextAction||'—')}${p.nextActionDeadline? ' — '+p.nextActionDeadline:''}</div>
      </div>
      ${canEdit? `
      <div style="background:var(--surface-2); border:1px dashed var(--border); border-radius:10px; padding:12px;">
        <p class="step-sub" style="margin:0 0 10px;">${core.T('نقل الفرصة لمرحلة جديدة','Move to a new stage')}</p>
        <form data-pipeline-form="${oppId}" style="display:flex; flex-direction:column; gap:8px;">
          <select name="toStage" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
            ${PIPELINE_STAGES.map(s=>`<option value="${s.key}" ${s.key===p.stage?'selected':''}>${stageLabel(core,s.key)}</option>`).join('')}
          </select>
          <input type="text" name="owner" placeholder="${core.T('المسؤول (اختياري)','Owner (optional)')}" value="${core.esc(p.owner||'')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="text" name="reason" placeholder="${core.T('سبب الانتقال (اختياري)','Transition reason (optional)')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <div style="display:flex; gap:8px;">
            <input type="text" name="nextAction" placeholder="${core.T('الإجراء التالي المطلوب','Next required action')}" value="${core.esc(p.nextAction||'')}" style="flex:1; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
            <input type="date" name="nextActionDeadline" value="${core.esc(p.nextActionDeadline||'')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          </div>
          <button type="button" class="btn btn-sm btn-primary" data-action="pipeline-transition" data-id="${oppId}">✅ ${core.T('تحديث المرحلة','Update Stage')}</button>
        </form>
      </div>` : ''}
      ${(p.history&&p.history.length)? `
      <div class="tablewrap" style="margin-top:12px;"><table class="db" style="font-size:12px;">
        <thead><tr><th>${core.T('من','From')}</th><th>${core.T('إلى','To')}</th><th>${core.T('بواسطة','By')}</th><th>${core.T('التاريخ','Date')}</th><th>${core.T('السبب','Reason')}</th></tr></thead>
        <tbody>
          ${p.history.slice().reverse().map(h=>`<tr>
            <td>${stageLabel(core,h.fromStage)}</td><td>${stageLabel(core,h.toStage)}</td>
            <td>${core.esc(h.by||'—')}</td><td class="mono">${core.esc((h.at||'').slice(0,16).replace('T',' '))}</td>
            <td>${core.esc(h.reason||'—')}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>` : ''}
    </div>`;
  });

  /* ---------------- معالج زر "تحديث المرحلة" — يقرأ الفورم يدوياً ويحفظ عبر persistOpportunity ---------------- */
  core.registerActionHandler(async (action, el)=>{
    if(action!=='pipeline-transition') return false;
    const oppId = el.dataset.id;
    const form = document.querySelector(`form[data-pipeline-form="${oppId}"]`);
    if(!form) return true;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec || !core.canEditOpp(rec)) return true;

    const toStage = form.querySelector('[name="toStage"]').value;
    const owner = form.querySelector('[name="owner"]').value.trim();
    const reason = form.querySelector('[name="reason"]').value.trim();
    const nextAction = form.querySelector('[name="nextAction"]').value.trim();
    const nextActionDeadline = form.querySelector('[name="nextActionDeadline"]').value;

    const draft = core.withDefaults(rec.data);
    const fromStage = draft.pipeline.stage || DEFAULT_STAGE;
    const by = core.currentUser ? core.currentUser.email : (core.DEMO_MODE ? 'زائر تجريبي' : 'محلي');
    const now = new Date().toISOString();

    if(toStage !== fromStage){
      draft.pipeline.history = (draft.pipeline.history||[]).concat([{ fromStage, toStage, at: now, by, reason }]);
      draft.pipeline.stage = toStage;
      draft.pipeline.enteredStageAt = core.todayStr();
    }
    draft.pipeline.owner = owner;
    draft.pipeline.nextAction = nextAction;
    draft.pipeline.nextActionDeadline = nextActionDeadline;
    draft.meta.updatedAt = core.todayStr();
    draft.meta.updatedBy = by;

    await core.persistOpportunity({ id: oppId, data: draft });
    await core.loadAll();
    core.render();
    return true;
  });
}
