/* =========================================================================
   سجل التعديلات — Version Control / Audit Trail (Phase 1، النظام الأول)
   ---------------------------------------------------------------------------
   يسجّل تلقائياً كل تعديل حقيقي على أي حقل في أي فرصة: القيمة قبل، القيمة بعد،
   من عدَّل، متى، ولماذا (سبب اختياري يكتبه المستخدم في خطوة "المراجعة والحفظ").
   بنية علائقية مستقلة: مجموعة Firestore خاصة (oppAuditLog) مرتبطة بمعرّف الفرصة
   (oppId) فقط — لا تُضاف أي حقول تدقيق داخل مستند الفرصة نفسها (باستثناء حقل
   إدخال السبب المؤقت audit.changeReason الذي يُصفَّر بعد كل حفظ).
   لا تعديل هنا على منطق core.js الداخلي — كل شيء عبر نقاط التوسّع المُصدَّرة:
     registerDataCollection، registerOpportunitySchemaExtender،
     registerBeforeOpportunitySave، registerDetailSection، registerWizardStepExtra.
   ========================================================================= */

const AUDIT_COLLECTION = 'oppAuditLog';

// تسميات عربية لأشهر مسارات الحقول — أي مسار غير مُدرَج يُعرَض كما هو (fallback).
const FIELD_LABELS = {
  'meta.name': 'اسم الفرصة', 'meta.city': 'المدينة', 'meta.neighborhood': 'الحي', 'meta.tier': 'الفئة',
  'meta.oppType': 'نوع الفرصة', 'meta.useType': 'نوع الاستخدام', 'meta.analyst': 'المحلل المسؤول',
  'land.area': 'مساحة الأرض', 'land.price': 'سعر متر الأرض', 'land.far': 'معامل البناء (FAR)', 'land.bar': 'نسبة البناء (BAR)',
  'strategy.exitStrategy': 'استراتيجية الخروج', 'strategy.salePct': 'نسبة البيع',
  'income.rent': 'الإيجار السنوي/م²', 'income.occupancy': 'نسبة الإشغال', 'income.opex': 'نسبة المصاريف التشغيلية',
  'development.salePrice': 'سعر البيع المتوقع/م²', 'development.buildCost': 'تكلفة البناء/م²',
  'development.constructionYears': 'مدة الإنشاء (سنوات)', 'development.exitCapRate': 'معدل رسملة الخروج',
  'landbank.appreciation': 'معدل نمو قيمة الأرض', 'landbank.holdingYears': 'مدة الاحتفاظ',
  'financing.ltc': 'نسبة التمويل إلى التكلفة (LTC)', 'financing.saibor': 'السايبور', 'financing.margin': 'هامش البنك',
  'financing.shariahStructure': 'الهيكل الشرعي للتمويل',
  'criteria.irrMin': 'الحد الأدنى لـ Equity IRR', 'criteria.moicMin': 'الحد الأدنى لـ MOIC',
  'subscription.minInvestment': 'الحد الأدنى للاستثمار', 'economics.hurdle': 'العائد التفضيلي (Hurdle)', 'economics.carry': 'حصة الأرباح (Carry)',
};
// مسارات نتجاهلها في الفرق (إدارية/مؤقتة، لا تمثّل تعديلاً حقيقياً يستحق التسجيل)
const IGNORE_PATHS = new Set(['meta.updatedAt', 'meta.updatedBy', 'meta.createdAt', 'meta.createdBy', 'id', 'audit.changeReason']);

function fieldLabel(path){ return FIELD_LABELS[path] || path; }

function isPlainObject(v){ return v!=null && typeof v==='object' && !Array.isArray(v); }

/* فرق عميق بين نسختين من نفس الفرصة (بعد تطبيعهما عبر withDefaults حتى لا تظهر حقول Schema
   جديدة كـ "تغييرات وهمية" لمجرد أن الفرصة القديمة أُنشئت قبل إضافتها). يُرجع مصفوفة
   {path, before, after} لكل قيمة ورقية (leaf) اختلفت فعلياً. */
function deepDiff(oldObj, newObj, prefix, out){
  out = out || [];
  const keys = new Set([...(oldObj?Object.keys(oldObj):[]), ...(newObj?Object.keys(newObj):[])]);
  for(const k of keys){
    const path = prefix ? prefix+'.'+k : k;
    if(IGNORE_PATHS.has(path)) continue;
    const ov = oldObj ? oldObj[k] : undefined;
    const nv = newObj ? newObj[k] : undefined;
    if(isPlainObject(ov) || isPlainObject(nv)){
      deepDiff(isPlainObject(ov)?ov:{}, isPlainObject(nv)?nv:{}, path, out);
      continue;
    }
    const ovs = Array.isArray(ov) ? JSON.stringify(ov) : ov;
    const nvs = Array.isArray(nv) ? JSON.stringify(nv) : nv;
    if(ovs !== nvs){
      out.push({ path, before: ov, after: nv });
    }
  }
  return out;
}

function fmtDiffValue(core, v){
  if(v==null || v==='') return '—';
  if(typeof v==='boolean') return v? '✓' : '✗';
  if(typeof v==='number') return Math.abs(v)>=1000 ? core.fmtNum(v,0) : (Number.isInteger(v)? String(v) : v.toFixed(3));
  if(Array.isArray(v)) return `[${v.length} ${v.length===1?'عنصر':'عناصر'}]`;
  if(typeof v==='object') return '{…}';
  return String(v);
}

export function registerAuditTrail(core){
  core.registerDataCollection(AUDIT_COLLECTION);

  core.registerOpportunitySchemaExtender(()=>({
    audit: { changeReason: '' },
  }));

  core.registerBeforeOpportunitySave(async (oldData, newData, oppId)=>{
    const reason = (newData.audit && newData.audit.changeReason) ? String(newData.audit.changeReason).trim() : '';
    // نصفّر حقل السبب المؤقت فور قراءته حتى لا يبقى ملصقاً بكل حفظ لاحق.
    if(newData.audit) newData.audit.changeReason = '';

    const changedBy = core.currentUser ? core.currentUser.email : (core.DEMO_MODE ? 'زائر تجريبي' : 'محلي');
    const changedAt = new Date().toISOString();

    if(!oldData){
      // فرصة جديدة بالكامل — نسجّل حدث "إنشاء" واحد بدل فرق حقول تفصيلي (لا معنى لمقارنتها بلا شيء).
      const rec = { id: core.uid('AUD'), data: {
        oppId, changedBy, changedAt, reason, action:'created', changes: [],
      }};
      await core.persistIfRecord(AUDIT_COLLECTION, rec);
      return;
    }

    let diffs;
    try{
      diffs = deepDiff(core.withDefaults(oldData), newData, '', []);
    }catch(e){ console.error('audit diff error:', e); diffs = []; }
    if(diffs.length===0) return; // لا تغييرات حقيقية — لا داعي لتسجيل شيء (مثلاً حفظ بدون أي تعديل)

    const rec = { id: core.uid('AUD'), data: {
      oppId, changedBy, changedAt, reason, action:'updated',
      changes: diffs.map(d=>({ field:d.path, label: fieldLabel(d.path), before:d.before===undefined?null:d.before, after:d.after===undefined?null:d.after })),
    }};
    await core.persistIfRecord(AUDIT_COLLECTION, rec);
  });

  // حقل "سبب التعديل" الاختياري — يظهر فقط عند تعديل فرصة موجودة (لا معنى له عند الإنشاء الأول)،
  // في آخر خطوة (المراجعة والحفظ). يُلتقَط تلقائياً عبر آلية ربط حقول المعالج العامة في core.js
  // (أي عنصر بخاصية name داخل #wizard-modal) دون أي وصلة إضافية.
  core.registerWizardStepExtra(core.STEPS.length-1, (d)=>{
    if(!core.wizard || !core.wizard.editId) return '';
    return `
      <div class="section" style="margin-top:16px; background:var(--surface-2); border-style:dashed;">
        <p class="step-sub" style="margin:0 0 10px;">${core.T('سبب التعديل (اختياري)','Reason for this change (optional)')}</p>
        <textarea name="audit.changeReason" rows="2" placeholder="${core.T('مثال: تعديل سعر الأرض بعد عرض مضاد من البائع','e.g. Updated land price after seller counteroffer')}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-size:13px; font-family:inherit; direction:rtl;">${core.esc(d.audit && d.audit.changeReason || '')}</textarea>
        <p class="note" style="margin-top:6px;">${core.T('يُسجَّل مع كل حقل تغيّر في هذا الحفظ ضمن سجل التعديلات أدناه في شاشة تفاصيل الفرصة.','Recorded against every field that changed in this save, in the Version History section on the opportunity detail screen.')}</p>
      </div>`;
  });

  // قسم "سجل التعديلات" داخل شاشة تفاصيل الفرصة.
  // ملاحظة: renderDetailExtensions(d,c) يمرّر فقط بيانات الفرصة (d = rec.data أو نسخة
  // withDefaults منها) بلا معرّف — معرّف الفرصة المعروضة حالياً متاح عبر الحالة العامة
  // core.openDetailId (يُضبط قبل استدعاء renderDetail مباشرة)، وليس عبر d.id (غير موجود).
  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    const entries = core.STORE[AUDIT_COLLECTION]
      .filter(a=>a.data.oppId===oppId)
      .slice()
      .sort((a,b)=> (a.data.changedAt < b.data.changedAt) ? 1 : -1);
    if(entries.length===0) return '';
    return `
    <div class="section">
      <h3>🕒 ${core.T('سجل التعديلات','Version History')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">— Audit Trail</span></h3>
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${entries.map(a=>{
          const dt = a.data.changedAt ? new Date(a.data.changedAt) : null;
          const dtStr = dt && !isNaN(dt.getTime()) ? dt.toLocaleString(core.LANG==='ar'?'ar-SA':'en-US', {dateStyle:'medium', timeStyle:'short'}) : '';
          if(a.data.action==='created'){
            return `<div style="padding:10px 12px; border:1px solid var(--border); border-radius:8px; background:var(--surface-2);">
              <div style="font-size:12.5px; font-weight:700;">🆕 ${core.T('إنشاء الفرصة','Opportunity created')}</div>
              <div style="font-size:11px; color:var(--ink-faint); margin-top:2px;">${core.esc(a.data.changedBy)} · ${dtStr}</div>
            </div>`;
          }
          return `<div style="padding:10px 12px; border:1px solid var(--border); border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px;">
              <div style="font-size:12.5px; font-weight:700;">✏️ ${core.esc(a.data.changedBy)}</div>
              <div style="font-size:11px; color:var(--ink-faint);">${dtStr}</div>
            </div>
            ${a.data.reason? `<div style="font-size:12px; color:var(--ink-soft); margin-top:4px; font-style:italic;">"${core.esc(a.data.reason)}"</div>` : ''}
            <div class="tablewrap" style="margin-top:8px;"><table class="db" style="font-size:12px;">
              <thead><tr><th>${core.T('الحقل','Field')}</th><th>${core.T('قبل','Before')}</th><th>${core.T('بعد','After')}</th></tr></thead>
              <tbody>
                ${(a.data.changes||[]).map(ch=>`<tr><td>${core.esc(ch.label||ch.field)}</td><td class="num mono">${fmtDiffValue(core, ch.before)}</td><td class="num mono">${fmtDiffValue(core, ch.after)}</td></tr>`).join('')}
              </tbody>
            </table></div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });
}
