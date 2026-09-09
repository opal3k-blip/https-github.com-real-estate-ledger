/* =========================================================================
   مكتبة الأنظمة واللوائح العقارية السعودية المرجعية — Saudi Real Estate
   Regulatory & Fee Reference Library (المرحلة ٦، النظام الأول)
   ---------------------------------------------------------------------------
   طلب المستخدم: إضافة ما يميّزنا محلياً عن البرامج العالمية الكبرى (Argus/
   Yardi/MRI) التي لا تُغطّي الأنظمة السعودية إطلاقاً — ضريبة التصرفات
   العقارية (RETT)، رسوم الأراضي البيضاء، نظام البيع على الخارطة "وافي"،
   الزكاة، وتنظيم عمولة السمسرة العقارية.

   **لا يُضيف أي حساب جديد وليس نموذج بيانات جديداً** — كل الحقول المُقارَنة
   هنا (`exitCosts.rett`, `exitCosts.broker`, `landbank.whiteLandFeePct`,
   `zakat.ratePct`, `criteria.preSaleMin`) موجودة ومُستخدَمة فعلاً في حسابات
   core.js؛ هذا الملف مرجعي بالكامل: يشرح الأساس النظامي لكل رقم، يقارنه
   بالقيمة المُدخَلة، ويوثّق الاستثناءات الشائعة — تماماً بفلسفة fund-fees-
   opex-library.js لكن على مستوى "الأنظمة الحكومية" لا "اقتصاديات الصندوق".

   ⚠️ الأنظمة والنسب المذكورة هنا معلوماتية/مرجعية فقط وقد تتغيّر بتحديثات
   تنظيمية لاحقة — لا تُعتبر استشارة قانونية أو ضريبية رسمية؛ يُنصَح دائماً
   بالتحقق من آخر تحديث لدى الجهة المختصة (هيئة الزكاة والضريبة والجمارك،
   الهيئة العامة للعقار، وزارة الشؤون البلدية والقروية والإسكان) قبل الاعتماد
   على أي رقم هنا في قرار استثماري فعلي — نفس تحذير core.js نفسه على حقل
   رسوم الأراضي البيضاء ("تحقق من آخر تحديث لدى الجهة المختصة").
   ========================================================================= */

import { canManageLibraries, certifyBadge } from './roles-permissions.js';

const OVERRIDES_COLLECTION = 'saudiRegOverrides';

/* كل بند مرتبط — عند توفّر path — بحقل حقيقي في core.js يُقرأ ويُقارَن. kind:
   'fixed' = قيمة نظامية واحدة محددة (لا نطاق) — أي انحراف عنها يستدعي تحققاً
   من الأساس النظامي/استثناء مطبَّق لا اعتباره خطأً بالضرورة. */
const REG_ITEMS = [
  {
    key:'rett', path:'exitCosts.rett', kind:'fixed', standard:0.05, icon:'🧾', step:8,
    ar:'ضريبة التصرفات العقارية (RETT)', en:'Real Estate Transaction Tax (RETT)',
    basisAr:'٥٪ من قيمة التصرف (البيع/النقل) — نظام ضريبة التصرفات العقارية، تحل محل ضريبة القيمة المضافة على معاملات العقار السكني/التجاري المُتصرَّف فيه.', basisEn:'5% of the transaction (sale/transfer) value — the Real Estate Transaction Tax regime, which replaces VAT on real estate disposal transactions.',
    exemptionsAr:'استثناءات شائعة تستدعي مراجعة قانونية/ضريبية مختصة: النقل بالوراثة أو الهبة بين الأصول والفروع والزوجين، بعض معاملات الوقف، وبعض إعادة الهيكلة الداخلية للمنشآت وفق شروط محدَّدة — لا تُطبَّق تلقائياً، ويجب توثيقها رسمياً لدى الجهة المختصة.', exemptionsEn:'Common exemptions that require dedicated legal/tax review: transfer by inheritance or gift between ascendants/descendants/spouses, certain waqf transactions, and certain internal corporate restructurings under specific conditions — none apply automatically and each must be formally documented with the competent authority.',
  },
  {
    key:'broker', path:'exitCosts.broker', kind:'fixed', standard:0.025, icon:'🤝', step:8,
    ar:'تنظيم عمولة السمسرة العقارية', en:'Real estate brokerage commission regulation',
    basisAr:'٢.٥٪ من قيمة الصفقة هي النسبة الأكثر شيوعاً واعتماداً في السوق السعودي كعمولة سمسرة قياسية (Standard Practice) — وليست بالضرورة سقفاً نظامياً ملزِماً في كل الحالات؛ صفقات كبيرة/مؤسسية قد تُفاوَض لأقل من ذلك.', basisEn:'2.5% of transaction value is the most common and widely-adopted rate in the Saudi market as a standard brokerage commission — not necessarily a binding regulatory ceiling in every case; large/institutional deals can often negotiate below it.',
    exemptionsAr:'يشترط تنظيم الوساطة العقارية أن يكون الوسيط مرخّصاً من الهيئة العامة للعقار — التعامل مع وسيط غير مرخّص يُعرِّض الصفقة لمخاطر قانونية وليس فقط سعرية.', exemptionsEn:'Real estate brokerage regulation requires the broker to be licensed by the General Real Estate Authority — dealing with an unlicensed broker exposes the transaction to legal risk, not just pricing risk.',
  },
  {
    key:'white_land', path:'landbank.whiteLandFeePct', kind:'fixed', standard:0.025, icon:'🏜️', step:1,
    ar:'رسوم الأراضي البيضاء', en:'White Land Fee',
    basisAr:'٢.٥٪ سنوياً من قيمة الأرض هي النسبة المعتادة تاريخياً على الأراضي الفضاء داخل النطاق العمراني للمدن الكبرى المستهدفة بالنظام — تهدف لتحفيز التطوير وتقليل احتكار الأراضي الفضاء. صدرت تعديلات/توسعات نطاق لهذا النظام مع الوقت — تحقّق دائماً من آخر تحديث ونطاق التطبيق الحالي لمدينة الفرصة.', basisEn:'2.5% per year of land value is the historically standard rate on idle ("white") land within the urban boundary of the targeted major cities — intended to encourage development and reduce idle-land hoarding. This regime has seen amendments/scope expansions over time — always verify the current update and applicability scope for the opportunity\'s city.',
    exemptionsAr:'أراضٍ تحت التطوير الفعلي (بتصريح بناء ساري ومراحل تنفيذ حقيقية)، أراضٍ لا تتجاوز مساحات معينة، وأراضٍ خارج النطاق العمراني المُستهدَف عادة تكون مستثناة أو غير خاضعة أصلاً — النموذج هنا يوفّر حقل `landbank.whiteLandFeeExempt` لتعليم الإعفاء صريحاً عند انطباقه.', exemptionsEn:'Land under genuine active development (a valid building permit with real execution phases), land below certain area thresholds, and land outside the targeted urban boundary are typically exempt or not subject to the fee at all — the model provides a `landbank.whiteLandFeeExempt` field to explicitly flag the exemption when it applies.',
  },
  {
    key:'zakat', path:'zakat.ratePct', kind:'fixed', standard:0.025, icon:'🕌', step:6,
    ar:'تقدير الزكاة الشرعية', en:'Estimated Sharia Zakat',
    basisAr:'٢.٥٪ (رُبع العُشر) سنوياً هي النسبة الزكوية الشائعة على الوعاء الزكوي القابل للتطبيق — النموذج هنا (`zakat.ratePct`) تقدير مبسّط جداً على رأس المال المستثمر فقط، وليس احتساباً زكوياً معتمداً يعتمد على الوعاء الزكوي الفعلي (يختلف بحسب طبيعة الأصول والمطلوبات ونوع الصندوق) — لا يُعتَدّ به كإخراج زكاة رسمي.', basisEn:'2.5% per year is the common zakat rate on the applicable zakat base — the `zakat.ratePct` model here is a deliberately simplified estimate on invested capital only, not an accredited zakat calculation dependent on the actual zakat base (which varies by asset/liability composition and fund type) — it must not be relied on as an official zakat discharge figure.',
    exemptionsAr:'لا ينطبق على مستثمر غير سعودي/خليجي (يخضع لضريبة استقطاع مختلفة تماماً بدل الزكاة) — النموذج يترك هذا اختيارياً (`zakat.enabled`) بالضبط لهذا السبب.', exemptionsEn:'Does not apply to a non-Saudi/non-Gulf investor (who is subject to an entirely different withholding tax instead of zakat) — the model leaves this optional (`zakat.enabled`) for exactly this reason.',
  },
  {
    key:'wafi_presale', path:'criteria.preSaleMin', kind:'fixed', standard:0.30, icon:'🏗️', step:4,
    ar:'الحد الأدنى للبيع/الجاهزية المسبقة (نظام "وافي")', en:'Minimum pre-sale/readiness threshold ("WAFI" system)',
    basisAr:'نظام البيع والتأجير على الخارطة ("وافي") يشترط على المطوّر استيفاء حد أدنى من متطلبات الترخيص والجاهزية (وضمان مالي عبر حساب ضمان مصرفي مخصَّص للمشروع) قبل جواز تحصيل دفعات المشترين على الخارطة — القيمة الافتراضية هنا (٣٠٪) اجتهاد نموذجي توضيحي لتمثيل عتبة الجاهزية، وليست بالضرورة الرقم النظامي الدقيق الحالي لكل فئة مشاريع؛ تحقّق من مركز إدارة حسابات الضمان (المستفيد) لمتطلبات مشروعك بالضبط.', basisEn:'The off-plan sale and lease system ("WAFI") requires the developer to meet a minimum licensing/readiness threshold (with funds secured via a project-dedicated escrow/guarantee account) before collecting buyer installments on an off-plan basis — the default value here (30%) is an illustrative modeling assumption representing a readiness threshold, not necessarily the precise current regulatory figure for every project category; verify the exact requirement for your project with the escrow account management center ("Al-Mostafeed").',
    exemptionsAr:'كل مبالغ المشترين تحت هذا النظام تُحصَّل حصراً عبر حساب الضمان المخصَّص للمشروع (لا حساب المطوّر المباشر) وتُصرَف على مراحل مرتبطة بتقدّم الإنشاء الفعلي المُعتمَد — إجراء حماية للمشتري جوهري، لا مجرد نسبة رقمية.', exemptionsEn:'Under this system all buyer funds are collected exclusively through the project\'s dedicated escrow/guarantee account (never the developer\'s own account) and released in stages tied to certified actual construction progress — a substantive buyer-protection mechanism, not merely a numeric threshold.',
  },
];

function fmtPctVal(core, v){ return v==null? '—' : core.fmtPct(v, 2); }

function statusBadge(core, val, item){
  if(val==null || !isFinite(val)) return `<span class="tag" style="background:var(--surface-2); color:var(--ink-faint);">—</span>`;
  if(Math.abs(val - item.standard) < 1e-9) return `<span class="tag" style="background:var(--good-soft); color:var(--good);">✅ ${core.T('مطابق للنسبة النظامية المعتادة','Matches the standard rate')}</span>`;
  return `<span class="tag" style="background:var(--warn-soft); color:var(--warn);" title="${core.T('قد يكون استثناءً مشروعاً — راجع الأساس النظامي أدناه','May be a legitimate exception — see the legal basis below')}">🔶 ${core.T('يختلف عن المعتاد — تحقّق من السبب','Differs from standard — verify why')}</span>`;
}

function regItemCard(core, item, d, compact){
  const val = d? core.getPath(d, item.path) : null;
  return `
  <div class="section" style="margin-bottom:10px; background:var(--surface-2); border:1px dashed var(--border);">
    <p class="step-sub" style="margin:0 0 4px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
      <span>${item.icon} ${core.T(item.ar, item.en)}</span>
      ${d? `<span>${core.T('المُدخَل','Entered')}: <b>${fmtPctVal(core, val)}</b> &nbsp; ${statusBadge(core, val, item)}</span>` : `<b>${core.fmtPct(item.standard, 2)}</b>`}
    </p>
    <p class="note" style="margin:0; font-size:${compact?'11px':'11.5px'}; line-height:1.8;"><b>${core.T('الأساس النظامي','Legal basis')}:</b> ${core.T(item.basisAr, item.basisEn)}</p>
    ${!compact? `<p class="note" style="margin:6px 0 0; font-size:11px; line-height:1.8; color:var(--ink-faint);"><b>${core.T('استثناءات/ملاحظات','Exceptions/notes')}:</b> ${core.T(item.exemptionsAr, item.exemptionsEn)}</p>` : ''}
  </div>`;
}

export function registerSaudiRegulatoryLibrary(core){
  core.registerDataCollection(OVERRIDES_COLLECTION);

  core.registerTopbarButton(()=>{
    return `<button class="btn btn-sm" data-action="saudireg-open">🇸🇦 ${core.T('الأنظمة العقارية السعودية','Saudi RE Regulations')}</button>`;
  });

  for(const step of [1,4,6,8]){
    const itemsForStep = REG_ITEMS.filter(it=>it.step===step);
    if(!itemsForStep.length) continue;
    core.registerWizardStepExtra(step, (d)=>{
      return `
      <div class="section" style="margin-top:16px; background:var(--surface-2); border:1px dashed var(--border);">
        <p class="step-sub" style="margin:0 0 8px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
          <span>🇸🇦 ${core.T('مطابقة الأنظمة السعودية المعتادة','Standard Saudi regulatory match')}</span>
          <button type="button" class="btn btn-sm btn-ghost" data-action="saudireg-open">📚 ${core.T('المكتبة الكاملة','Full library')}</button>
        </p>
        ${itemsForStep.map(it=>regItemCard(core, it, d, true)).join('')}
      </div>`;
    });
  }

  core.registerDetailSection((d)=>{
    return `
    <div class="section">
      <h3>🇸🇦 ${core.T('الأنظمة واللوائح العقارية السعودية — مطابقة','Saudi Real Estate Regulations — Compliance Match')}</h3>
      ${REG_ITEMS.map(it=>regItemCard(core, it, d, false)).join('')}
    </div>`;
  });

  core.registerMainView('saudi-regulatory', ()=>{
    const overrides = core.STORE[OVERRIDES_COLLECTION] || [];
    return `
    <div class="section" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 style="margin:0;">🇸🇦 ${core.T('مكتبة الأنظمة واللوائح العقارية السعودية المرجعية','Saudi Real Estate Regulatory & Fee Reference Library')}</h2>
        <p class="note" style="margin:4px 0 0;">${core.T('بنود مرجعية','Reference items')}: <b>${REG_ITEMS.length}</b> &nbsp;·&nbsp; ${core.T('تحديثات/ملاحظات الفريق','Team updates/notes')}: <b>${overrides.length}</b></p>
      </div>
      <button class="btn btn-sm btn-ghost" data-action="saudireg-close">✖ ${core.T('إغلاق ورجوع للوحة الفرص','Close & return to dashboard')}</button>
    </div>
    <p class="note" style="margin-bottom:12px; background:var(--warn-soft); color:var(--warn); padding:8px 12px; border-radius:8px;">⚠️ ${core.T('معلوماتي/مرجعي فقط — ليس استشارة قانونية أو ضريبية رسمية. الأنظمة قد تُحدَّث؛ تحقَّق دائماً من الجهة المختصة قبل اعتماد أي رقم في قرار فعلي.','Informational/reference only — not formal legal or tax advice. Regulations can be updated; always verify with the competent authority before relying on any figure in a real decision.')}</p>
    ${REG_ITEMS.map(it=>regItemCard(core, it, null, false)).join('')}
    <div class="section" style="margin-top:14px;">
      <p class="step-sub" style="margin:0 0 8px;">📝 ${core.T('تحديثات/ملاحظات الفريق (مثل: صدور تعديل نظامي جديد)','Team updates/notes (e.g. a new regulatory amendment)')}</p>
      <div class="tablewrap"><table class="db" style="font-size:11.5px;">
        <thead><tr><th>${core.T('البند','Item')}</th><th>${core.T('ملاحظة','Note')}</th><th>${core.T('أضافها','Added by')}</th><th>${core.T('الحالة','Status')}</th></tr></thead>
        <tbody>
          ${overrides.map(rec=>{
            const o = rec.data;
            return `<tr>
              <td>${core.esc(o.label||'—')}</td>
              <td style="font-size:11px; color:var(--ink-faint);">${core.esc(o.note||'—')}</td>
              <td style="font-size:11px;">${core.esc(o.addedBy||'—')}</td>
              <td>
                ${certifyBadge(core, o)}
                ${canManageLibraries(core)? `<div class="small-btns" style="margin-top:4px;">
                  ${!o.certified? `<button class="btn btn-sm btn-ghost" data-action="saudireg-certify-override" data-id="${rec.id}">✅</button>` : ''}
                  <button class="btn btn-sm btn-ghost" data-action="saudireg-delete-override" data-id="${rec.id}">🗑️</button>
                </div>` : ''}
              </td>
            </tr>`;
          }).join('')}
          ${!overrides.length? `<tr><td colspan="4" style="text-align:center; padding:14px; color:var(--ink-faint);">${core.T('لا توجد ملاحظات محلية بعد.','No local notes yet.')}</td></tr>` : ''}
        </tbody>
      </table></div>
      ${canManageLibraries(core)? `
      <div class="section" style="margin-top:10px; background:var(--surface-2); border:1px dashed var(--border);">
        <form id="saudireg-add-form" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:8px;">
          <input type="text" name="label" placeholder="${core.T('اسم البند/التعديل','Item/amendment name')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="text" name="note" placeholder="${core.T('ملاحظة','Note')}" style="grid-column:1/-1; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        </form>
        <button type="button" class="btn btn-sm btn-primary" style="margin-top:8px;" data-action="saudireg-add-override">➕ ${core.T('إضافة','Add')}</button>
      </div>` : `
      <div class="section" style="margin-top:10px; background:var(--surface-2); border:1px dashed var(--border);">
        <p class="note" style="margin:0;">🔒 ${core.T('إضافة/تصديق/حذف الملاحظات يتطلب صلاحية مدير صندوق فأعلى.','Adding, certifying, or deleting notes requires Fund Manager tier or above.')}</p>
      </div>`}
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='saudireg-open'){ core.setCoreState({ mainView:'saudi-regulatory', openDetailId:null, render:true }); return true; }
    if(action==='saudireg-close'){ core.setCoreState({ mainView:null, render:true }); return true; }
    if(action==='saudireg-add-override'){
      if(!canManageLibraries(core)) return true;
      const form = document.getElementById('saudireg-add-form');
      if(!form) return true;
      const g = name => form.querySelector(`[name="${name}"]`).value.trim();
      const label = g('label');
      if(!label) return true;
      const rec = { id: core.uid('SREG'), data: {
        label, note: g('note') || null,
        addedBy: core.currentUser? core.currentUser.email : (core.DEMO_MODE? 'زائر تجريبي':'محلي'),
        certified: false, certifiedBy: null, certifiedAt: null,
      }};
      await core.persistIfRecord(OVERRIDES_COLLECTION, rec);
      core.render();
      return true;
    }
    if(action==='saudireg-certify-override'){
      if(!canManageLibraries(core)) return true;
      const rec = (core.STORE[OVERRIDES_COLLECTION]||[]).find(r=>r.id===el.dataset.id);
      if(!rec) return true;
      const updated = { id: rec.id, data: { ...rec.data, certified:true, certifiedBy: core.currentUser? core.currentUser.email : 'محلي', certifiedAt: new Date().toISOString() } };
      await core.persistIfRecord(OVERRIDES_COLLECTION, updated);
      core.render();
      return true;
    }
    if(action==='saudireg-delete-override'){
      if(!canManageLibraries(core)) return true;
      await core.deleteIfRecord(OVERRIDES_COLLECTION, el.dataset.id);
      core.render();
      return true;
    }
    return false;
  });
}

export { REG_ITEMS };
