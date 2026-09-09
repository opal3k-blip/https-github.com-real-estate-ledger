/* =========================================================================
   المصادر والأدلة — Source & Evidence Tracking (Phase 2، ثم توسعة حوكمية
   في المرحلة السابعة: Source Tier + التحقق (Verification) + مؤشرات
   "غير موثَّق" / "عائق أمام اللجنة")
   ---------------------------------------------------------------------------
   لكل رقم رئيسي في الفرصة: القيمة الحالية (تُقرأ حياً من بيانات الفرصة، لا
   تُكرَّر) + المصدر + التاريخ + مستوى الثقة (عالية/متوسطة/منخفضة) + مستوى
   المصدر (Source Tier) + من تحقق منه ومتى (Verified By/At — يتطلب صلاحية
   canApproveIC، مستقلة عمداً عن "من أدخل البيانات") — حتى تكون الإجابة عن
   "من أين أتى هذا الرقم؟ وهل تحقق منه أحد بصلاحية كافية؟" ضغطة واحدة بدل
   بحث. مخزَّنة في قاموس evidence مفتاحه مسار الحقل (نفس نمط المفاتيح
   الثابتة لتفادي مشكلة إعادة توليد المعرّفات العشوائية بين كل
   withDefaults()). لا تعديل على core.js.

   evidenceCoverageStats(core, d) مُصدَّرة لإعادة استخدامها من
   ic-decision-gate.js (بوابة الحوكمة) دون تكرار المنطق.
   ========================================================================= */
import { canApproveIC } from './roles-permissions.js';

const CONFIDENCE = [
  { key:'high',   ar:'عالية',   en:'High',   color:'#34d399' },
  { key:'medium', ar:'متوسطة',  en:'Medium', color:'#fbbf24' },
  { key:'low',    ar:'منخفضة',  en:'Low',    color:'#f87171' },
];
const CONF_BY_KEY = Object.fromEntries(CONFIDENCE.map(c=>[c.key,c]));

// Source Hierarchy — Tier 1 (رسمي/عقد موقّع/تقييم) أقوى من Tier 4 (تقدير محلل).
// "Benchmark عمره سنتان ليس Benchmarkًا صالحًا لمشروع جديد" — لهذا لكل رقم
// أيضاً تاريخ (date) يُستخدَم كـ As-of Date لتقدير مدى قِدَم المصدر.
const SOURCE_TIERS = [
  { key:'tier1', ar:'Tier 1 — مصدر رسمي/أساسي',    en:'Tier 1 — Primary',       color:'#34d399', hint:'حكومي / عقد بيع موقّع / تقييم معتمد / قوائم مالية مدقَّقة' },
  { key:'tier2', ar:'Tier 2 — مؤسسي',              en:'Tier 2 — Institutional', color:'#60a5fa', hint:'CBRE / JLL / Knight Frank / Colliers / Cushman & Wakefield' },
  { key:'tier3', ar:'Tier 3 — سوقي',               en:'Tier 3 — Market',        color:'#fbbf24', hint:'وسيط / إعلان بيع / مطوّر / مسح ميداني' },
  { key:'tier4', ar:'Tier 4 — تقدير محلل',          en:'Tier 4 — Analyst Estimate', color:'#f87171', hint:'افتراض داخلي بلا مصدر خارجي' },
];
const TIER_BY_KEY = Object.fromEntries(SOURCE_TIERS.map(t=>[t.key,t]));

// critical:true — حقول ذات أثر مباشر وكبير على IRR/MOIC؛ عدم توثيقها هو
// "🔴 IC BLOCKER" لا مجرد تحذير، تماشياً مع مبدأ المستخدم "NO SILENT
// ASSUMPTIONS" (الأرقام المؤثرة جداً غير المُسنَدة تمنع جهوزية اللجنة).
const KEY_FIELDS = [
  { path:'land.price',              ar:'سعر متر الأرض',              en:'Land price/m²',           appliesTo:null,          fmt:'sar', critical:true  },
  { path:'land.far',                ar:'معامل البناء (FAR)',         en:'FAR',                     appliesTo:null,          fmt:'num', critical:false },
  { path:'financing.saibor',        ar:'السايبور',                   en:'SAIBOR',                  appliesTo:null,          fmt:'pct', critical:false },
  { path:'financing.margin',        ar:'هامش البنك',                 en:'Bank margin',             appliesTo:null,          fmt:'pct', critical:false },
  { path:'income.rent',             ar:'الإيجار السنوي/م²',          en:'Annual rent/m²',          appliesTo:'income',      fmt:'sar', critical:true  },
  { path:'income.occupancy',        ar:'نسبة الإشغال',                en:'Occupancy',               appliesTo:'income',      fmt:'pct', critical:true  },
  { path:'wacc.marketCap',          ar:'معدل الرسملة عند الخروج',      en:'Exit cap rate',           appliesTo:'income',      fmt:'pct', critical:true  },
  { path:'development.salePrice',   ar:'سعر البيع المتوقع/م²',        en:'Expected sale price/m²',  appliesTo:'development', fmt:'sar', critical:true  },
  { path:'development.buildCost',   ar:'تكلفة البناء/م²',             en:'Build cost/m²',           appliesTo:'development', fmt:'sar', critical:true  },
  { path:'development.exitCapRate', ar:'معدل الرسملة عند الخروج',      en:'Exit cap rate',           appliesTo:'development', fmt:'pct', critical:false },
  { path:'landbank.appreciation',   ar:'معدل نمو قيمة الأرض',          en:'Land appreciation rate',  appliesTo:'landbank',    fmt:'pct', critical:false },
];

function fieldsFor(oppType){ return KEY_FIELDS.filter(f=>f.appliesTo===null || f.appliesTo===oppType); }
function fmtVal(core, fmt, v){
  if(v==null) return '—';
  if(fmt==='sar') return core.fmtSAR(v);
  if(fmt==='pct') return core.fmtPct(v);
  return core.fmtNum(v);
}

// evidenceCoverageStats(core, d) — يُعاد استخدامها من ic-decision-gate.js.
// لا تُعدِّل أي شيء، تقرأ فقط. تُرجع: عدد/نسبة التوثيق، الحقول الحرجة غير
// الموثَّقة (unsourcedCritical → "🔴 IC BLOCKER")، والحقول غير الحرجة غير
// الموثَّقة (unsourcedMinor → "⚠️ UNSOURCED").
export function evidenceCoverageStats(core, d){
  const evidence = (d && d.evidence) || {};
  const fields = fieldsFor(d && d.meta && d.meta.oppType);
  const sourced = [], unsourcedCritical = [], unsourcedMinor = [], verified = [];
  fields.forEach(f=>{
    const ev = evidence[f.path];
    const hasSource = !!(ev && ev.source);
    if(hasSource){
      sourced.push(f.path);
      if(ev.verifiedBy) verified.push(f.path);
    } else if(f.critical){
      unsourcedCritical.push(f);
    } else {
      unsourcedMinor.push(f);
    }
  });
  const total = fields.length;
  const pct = total? Math.round((sourced.length/total)*100) : 100;
  const verifiedPct = total? Math.round((verified.length/total)*100) : 100;
  return { total, sourcedCount: sourced.length, pct, verifiedCount: verified.length, verifiedPct, unsourcedCritical, unsourcedMinor };
}

export function registerEvidenceTracking(core){
  core.registerOpportunitySchemaExtender(()=>({ evidence: {} }));

  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec) return '';
    const canEdit = core.canEditOpp(rec);
    const canVerify = canApproveIC(core);
    const evidence = d.evidence || {};
    const fields = fieldsFor(d.meta.oppType);
    const stats = evidenceCoverageStats(core, d);

    const rows = fields.map(f=>{
      const ev = evidence[f.path] || {};
      const val = fmtVal(core, f.fmt, core.getPath(d, f.path));
      const tier = TIER_BY_KEY[ev.tier];
      const conf = CONF_BY_KEY[ev.confidence];
      const unsourced = !ev.source;
      const flag = unsourced
        ? (f.critical
            ? `<span class="tag" style="background:#ef444422; color:#ef4444; font-size:9.5px;" title="${core.T('حرج على القرار وغير موثَّق — عائق أمام جهوزية اللجنة','Critical & unsourced — IC blocker')}">🔴 ${core.T('عائق للجنة','IC BLOCKER')}</span>`
            : `<span class="tag" style="background:#f59e0b22; color:#f59e0b; font-size:9.5px;">⚠️ ${core.T('غير موثَّق','UNSOURCED')}</span>`)
        : (ev.verifiedBy ? `<span class="tag" style="background:#34d39922; color:#34d399; font-size:9.5px;">✅ ${core.T('مُتحقَّق','Verified')}</span>` : '');

      if(!canEdit){
        return `<tr>
          <td style="font-size:12px;">${core.T(f.ar,f.en)} ${f.critical? '<span title="'+core.T('حقل حرج على القرار','Decision-critical field')+'" style="color:#ef4444;">•</span>':''}</td>
          <td class="num" style="font-weight:700;">${val}</td>
          <td style="font-size:11.5px;">${core.esc(ev.source||'—')}</td>
          <td>${tier? `<span class="tag" style="background:${tier.color}22; color:${tier.color}; font-size:10px;" title="${core.esc(tier.hint)}">${core.T(tier.ar,tier.en)}</span>` : '—'}</td>
          <td class="mono">${core.esc(ev.date||'—')}</td>
          <td>${conf? `<span class="tag" style="background:${conf.color}22; color:${conf.color}; font-size:10px;">${core.T(conf.ar,conf.en)}</span>` : '—'}</td>
          <td>${flag||'—'}</td>
        </tr>`;
      }
      return `<tr data-ev-item="${f.path}">
        <td style="font-size:12px; min-width:150px;">${core.T(f.ar,f.en)} ${f.critical? '<span title="'+core.T('حقل حرج على القرار','Decision-critical field')+'" style="color:#ef4444;">•</span>':''}</td>
        <td class="num" style="font-weight:700;">${val}</td>
        <td><input type="text" name="source" value="${core.esc(ev.source||'')}" placeholder="${core.T('المصدر','Source')}" style="width:130px; padding:5px 7px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;"></td>
        <td><select name="tier" style="padding:5px 6px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;">
          <option value="">—</option>
          ${SOURCE_TIERS.map(t=>`<option value="${t.key}" ${t.key===ev.tier?'selected':''} title="${core.esc(t.hint)}">${core.T(t.ar,t.en)}</option>`).join('')}
        </select></td>
        <td><input type="date" name="date" value="${core.esc(ev.date||'')}" style="padding:5px 6px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;"></td>
        <td><select name="confidence" style="padding:5px 6px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--ink); font-size:11px; font-family:inherit;">
          <option value="">—</option>
          ${CONFIDENCE.map(cf=>`<option value="${cf.key}" ${cf.key===ev.confidence?'selected':''}>${core.T(cf.ar,cf.en)}</option>`).join('')}
        </select></td>
        <td>${flag||''}${ev.source && canVerify? `<button type="button" class="btn btn-xs" data-action="ev-verify" data-id="${oppId}" data-path="${f.path}" style="margin-top:4px; font-size:9.5px;" title="${core.T('يتطلب صلاحية لجنة الاستثمار — مستقل عن من أدخل البيانات','Requires IC-level role — independent of who entered the data')}">${ev.verifiedBy? '🔁' : '✅'} ${core.T(ev.verifiedBy?'إعادة تحقق':'تحقّق', ev.verifiedBy?'Re-verify':'Verify')}</button>` : (ev.verifiedBy? `<div class="note" style="font-size:9.5px; margin-top:3px;">${core.T('بواسطة','by')} ${core.esc(ev.verifiedBy)}</div>` : '')}</td>
      </tr>`;
    }).join('');

    const blockerBanner = stats.unsourcedCritical.length
      ? `<p class="note" style="margin:0 0 10px; color:#ef4444; font-weight:600;">🔴 ${stats.unsourcedCritical.length} ${core.T('رقماً حرجاً بلا مصدر — عائق أمام جهوزية اللجنة (انظر بوابة قرار اللجنة)','critical figure(s) unsourced — IC blocker (see IC Decision Gate)')}</p>`
      : '';

    return `
    <div class="section">
      <h3>🔎 ${core.T('المصادر والأدلة','Source & Evidence')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(Source & Evidence Tracking)</span></h3>
      <p class="note" style="margin:0 0 6px;">${stats.sourcedCount}/${stats.total} ${core.T('رقماً رئيسياً موثَّق المصدر','key figures sourced')} · ${stats.verifiedCount}/${stats.total} ${core.T('مُتحقَّق منه بصلاحية اللجنة','verified at IC-level')}</p>
      ${blockerBanner}
      <div class="tablewrap"><table class="db" style="font-size:11.5px;">
        <thead><tr><th>${core.T('الرقم','Figure')}</th><th>${core.T('القيمة الحالية','Current Value')}</th><th>${core.T('المصدر','Source')}</th><th>${core.T('مستوى المصدر','Source Tier')}</th><th>${core.T('التاريخ','Date')}</th><th>${core.T('الثقة','Confidence')}</th><th>${core.T('الحالة','Status')}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${canEdit? `<button type="button" class="btn btn-sm btn-primary" style="margin-top:10px;" data-action="ev-save" data-id="${oppId}">💾 ${core.T('حفظ المصادر','Save Sources')}</button>` : ''}
      ${!canVerify? `<p class="note" style="margin-top:8px; font-size:11px;">${core.T('تفعيل زر "تحقّق" يتطلب صلاحية لجنة الاستثمار (Senior IC) أو أعلى — منفصل عمداً عن صلاحية إدخال البيانات.','The "Verify" action requires a Senior IC role or above — deliberately separate from data-entry permission.')}</p>` : ''}
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='ev-save'){
      const oppId = el.dataset.id;
      const rec = core.opportunities.find(o=>o.id===oppId);
      if(!rec || !core.canEditOpp(rec)) return true;

      const draft = core.withDefaults(rec.data);
      const evidence = draft.evidence || (draft.evidence = {});
      document.querySelectorAll('tr[data-ev-item]').forEach(row=>{
        const path = row.dataset.evItem;
        const source = row.querySelector('[name="source"]').value.trim();
        const tier = row.querySelector('[name="tier"]').value;
        const date = row.querySelector('[name="date"]').value;
        const confidence = row.querySelector('[name="confidence"]').value;
        if(source || tier || date || confidence){
          const prev = evidence[path] || {};
          // تغيير المصدر نفسه يُبطل أي تحقق سابق — التحقق مرتبط بالمصدر
          // المحدَّد وقت التحقق، لا بمجرد وجود قيمة في الحقل.
          const sourceChanged = (prev.source||'') !== source;
          evidence[path] = {
            source, tier: tier||null, date, confidence: confidence||null,
            verifiedBy: sourceChanged? null : (prev.verifiedBy||null),
            verifiedAt: sourceChanged? null : (prev.verifiedAt||null),
          };
        } else delete evidence[path];
      });
      draft.meta.updatedAt = core.todayStr();
      draft.meta.updatedBy = core.currentUser ? core.currentUser.email : (draft.meta.updatedBy||null);

      await core.persistOpportunity({ id: oppId, data: draft });
      await core.loadAll();
      core.render();
      return true;
    }

    if(action==='ev-verify'){
      // نقطة حوكمة: "من أدخل البيانات" (canEditOpp) مستقلة تماماً عن "من
      // تحقق منها" (canApproveIC) — تحقّق تحليل ذاتي من محلل واحد ليس
      // تحقّقاً مؤسسياً.
      if(!canApproveIC(core)) return true;
      const oppId = el.dataset.id;
      const path = el.dataset.path;
      const rec = core.opportunities.find(o=>o.id===oppId);
      if(!rec) return true;

      const draft = core.withDefaults(rec.data);
      const evidence = draft.evidence || (draft.evidence = {});
      const ev = evidence[path];
      if(!ev || !ev.source) return true; // لا تحقق من رقم بلا مصدر أصلاً
      ev.verifiedBy = core.currentUser ? core.currentUser.email : null;
      ev.verifiedAt = core.todayStr();
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
