/* =========================================================================
   تصنيف الاستدامة (مستدام/ESG) — Sustainability & Green Building
   Certification Tracking (المرحلة ٦، النظام الرابع والأخير)
   ---------------------------------------------------------------------------
   طلب المستخدم: تتبّع هدف/حالة تصنيف الاستدامة (مستدام السعودي أو LEED) لكل
   فرصة — عامل تنافسي متزايد الأهمية في السوق السعودي (رؤية ٢٠٣٠، متطلبات
   بعض المستثمرين المؤسسيين وصناديق التمويل الأخضر) لا تُغطّيه البرامج
   العالمية الكبرى بسياق محلي واضح.

   حقل جذر جديد بالكامل (`sustainability`) عبر registerOpportunitySchemaExtender
   — لا يُغيِّر أي حساب فعلي في core.js ولا يدخل في IRR/MOIC/Cap Rate تلقائياً؛
   المستخدم قد يعكس أثر الشهادة يدوياً عبر رفع إيجار income.rent (علاوة
   الإيجار) أو خفض income.opex (وفورات تشغيل) بنفسه، بالاستناد لمعطيات
   ESG_BENEFITS أدناه — لا حساب آلي مباشر (تجنّباً لافتراض علاوة/وفورات
   على فرصة لم تُصنَّف فعلياً أو لم تكتمل شهادتها بعد).

   ⚠️ مستويات "مستدام" ومتطلباتها التفصيلية الدقيقة قد تتغيّر بتحديثات لاحقة
   من الجهة المشغِّلة للبرنامج (وزارة الشؤون البلدية والقروية والإسكان) —
   الأسماء هنا (أساسي/فضي/ذهبي/بلاتيني) تُقدَّم كبنية عامة معروفة ومستقرة
   نسبياً (مطابقة لبنية LEED المتدرجة)، لا كنص لائحي رسمي دقيق. تحقّق دائماً
   من آخر تحديث لدى الجهة المختصة قبل تحديد هدف تصنيف فعلي لمشروع حقيقي —
   نفس تحذير saudi-regulatory-library.js بالضبط.

   لا مجموعة Firestore جديدة ولا صلاحيات CRUD هنا (بعمد، تبسيطاً) — المكتبة
   المرجعية (Main View) عرض ثابت بالكامل، وحقل الفرصة الوحيد يُحفَظ داخل
   وثيقة الفرصة نفسها (نفس نمط geo/rentRoll) فيُحمى بقاعدة opportunities
   الموجودة أصلاً بلا أي تعديل على firestore.rules.
   ========================================================================= */

const SUSTAINABILITY_PATH = 'sustainability';

/* مستويات برنامج "مستدام" السعودي — بنية عامة معروفة (متدرجة كـLEED)، لا نصاً
   لائحياً دقيقاً (انظر تحذير رأس الملف). */
const MOSTADAM_TIERS = [
  { key:'mostadam_certified', ar:'مستدام — أساسي (Certified)', en:'Mostadam — Certified' },
  { key:'mostadam_silver',    ar:'مستدام — فضي (Silver)',      en:'Mostadam — Silver' },
  { key:'mostadam_gold',      ar:'مستدام — ذهبي (Gold)',       en:'Mostadam — Gold' },
  { key:'mostadam_platinum',  ar:'مستدام — بلاتيني (Platinum)', en:'Mostadam — Platinum' },
];
/* LEED — معيار دولي معروف، يُستخدَم كبديل مُعتمَد دولياً في السوق السعودي
   أيضاً، خصوصاً لمستثمرين/مستأجرين مؤسسيين أجانب. */
const LEED_TIERS = [
  { key:'leed_certified', ar:'LEED — أساسي (Certified)', en:'LEED — Certified' },
  { key:'leed_silver',    ar:'LEED — فضي (Silver)',      en:'LEED — Silver' },
  { key:'leed_gold',      ar:'LEED — ذهبي (Gold)',       en:'LEED — Gold' },
  { key:'leed_platinum',  ar:'LEED — بلاتيني (Platinum)', en:'LEED — Platinum' },
];
const CERT_TARGET_OPTIONS = [
  { key:'none', ar:'بدون هدف تصنيف حالياً', en:'No certification target currently' },
  ...MOSTADAM_TIERS,
  ...LEED_TIERS,
  { key:'other', ar:'أخرى (يُحدَّد في الملاحظات)', en:'Other (specify in notes)' },
];
function certLabel(key){
  const found = CERT_TARGET_OPTIONS.find(o=>o.key===key);
  return found || CERT_TARGET_OPTIONS[0];
}

/* فوائد اقتصادية مرجعية للمباني المُصنَّفة — نفس الأرقام المُستخدَمة أصلاً في
   SECTOR_KNOWLEDGE.office بـspace-efficiency-library.js (المرحلة ٤/٥) على
   علاوة الإيجار، بالإضافة لبنود إضافية (وفورات تشغيل، متطلبات مستثمرين
   مؤسسيين، تمويل أخضر) — إثراء واحد متسق عبر الملفات لا تكرار متعارض. */
const ESG_BENEFITS = [
  {
    key:'rent_premium', icon:'💰',
    ar:'علاوة الإيجار', en:'Rent premium',
    valAr:'٥–١٥٪ إيجار أعلى مقارنة بمبنى غير مُصنَّف من نفس الفئة والموقع', valEn:'5–15% higher rent vs. an uncertified building of the same grade and location',
    noteAr:'الأوضح في مكاتب الفئة "أ" ومراكز البيانات — "الهروب نحو الجودة" (Flight to Quality) يجعل المباني غير المُصنَّفة أضعف إشغالاً حتى مع تخفيض السعر.', noteEn:'Most pronounced in Grade A office and data centers — the "flight to quality" trend leaves uncertified stock with weaker occupancy even at a rent discount.',
  },
  {
    key:'opex_savings', icon:'💡',
    ar:'وفورات التشغيل', en:'Operating cost savings',
    valAr:'١٠–٣٠٪ خفض في استهلاك الطاقة/المياه مقارنة بمبنى تقليدي مماثل', valEn:'10–30% lower energy/water consumption vs. a comparable conventional building',
    noteAr:'أثر مباشر على income.opex — وفورات تراكمية طوال عمر الأصل، لا مرة واحدة فقط عند الإنشاء.', noteEn:'Direct effect on income.opex — cumulative savings across the asset\'s life, not a one-time construction-time effect only.',
  },
  {
    key:'institutional_demand', icon:'🏛️',
    ar:'متطلبات المستثمرين المؤسسيين', en:'Institutional investor requirements',
    valAr:'عدد متزايد من صناديق التقاعد وصناديق الاستثمار المؤسسية الكبرى يشترط حداً أدنى من تصنيف الاستدامة كشرط استثمار (ESG Mandate)', valEn:'A growing number of pension funds and large institutional investment vehicles require a minimum sustainability rating as an investment condition (ESG mandate)',
    noteAr:'غياب الشهادة قد يستثني الفرصة كلياً من قاعدة مستثمرين مؤسسيين معيّنة، بصرف النظر عن جودة العائد المالي البحت.', noteEn:'Lacking certification can exclude an opportunity entirely from certain institutional investor pools, regardless of pure financial-return quality.',
  },
  {
    key:'green_financing', icon:'🏦',
    ar:'أهلية التمويل الأخضر', en:'Green financing eligibility',
    valAr:'أهلية لمنتجات تمويل أخضر/صكوك خضراء، وأحياناً هامش تمويل (Spread) أفضل من التمويل التقليدي', valEn:'Eligibility for green loans/green sukuk products, sometimes at a better financing spread than conventional debt',
    noteAr:'يعتمد على سياسة الممول المحدَّدة ومستوى التصنيف المُستهدَف/المُحقَّق فعلياً — ليس تلقائياً لكل تصنيف.', noteEn:'Depends on the specific lender\'s policy and the actual achieved/targeted rating tier — not automatic for every certification level.',
  },
];

function benefitsListHtml(core, compact){
  return ESG_BENEFITS.map(b=>`
    <div class="li">${b.icon} ${core.T(b.ar, b.en)}
      <b style="font-size:${compact?'11px':'12px'};">${core.T(b.valAr, b.valEn)}</b>
      ${!compact? `<div style="font-size:10.5px; color:var(--ink-faint); margin-top:2px; line-height:1.6;">${core.T(b.noteAr, b.noteEn)}</div>` : ''}
    </div>`).join('');
}

export function registerSustainabilityMostadam(core){
  core.registerOpportunitySchemaExtender(()=>({ sustainability: { certificationTarget:'none', currentRating:null, notes:'' } }));

  core.registerTopbarButton(()=>{
    return `<button class="btn btn-sm" data-action="esg-open">🌿 ${core.T('الاستدامة (مستدام/ESG)','Sustainability (Mostadam/ESG)')}</button>`;
  });

  core.registerWizardStepExtra(2, (d)=>{
    const s = d.sustainability || { certificationTarget:'none', currentRating:'none', notes:'' };
    return `
    <div class="section" style="margin-top:16px; background:var(--surface-2); border:1px dashed var(--border);">
      <p class="step-sub" style="margin:0 0 8px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <span>🌿 ${core.T('تصنيف الاستدامة (اختياري)','Sustainability certification (optional)')}</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="esg-open">📚 ${core.T('دليل مرجعي','Reference guide')}</button>
      </p>
      <div class="grid3">
        ${core.F.select('sustainability.certificationTarget','هدف/حالة التصنيف','Certification target/status', s.certificationTarget, CERT_TARGET_OPTIONS.map(o=>[core.T(o.ar,o.en),o.key]), {span2:true})}
      </div>
      ${s.certificationTarget && s.certificationTarget!=='none'? `<p class="note" style="margin:4px 0 0; font-size:11px; line-height:1.7;">${core.T('لا يُغيِّر هذا الاختيار أي حساب في IRR/MOIC/الإيجار تلقائياً — استخدم الدليل المرجعي أعلاه لتقدير علاوة إيجار/وفورات تشغيل محتملة، وعكسها يدوياً في خطوة "الإيراد والخروج" إن رغبت.','This selection does not automatically change any IRR/MOIC/rent calculation — use the reference guide above to estimate a possible rent premium/opex savings, and reflect it manually in the "Revenue & Exit" step if you wish.')}</p>` : ''}
      ${core.F.textarea('sustainability.notes','ملاحظات الاستدامة','Sustainability notes', s.notes, {placeholder:core.T('مثال: تقديم طلب مستدام ذهبي متوقَّع الحصول عليه Q2 2027...','e.g. Mostadam Gold application submitted, expected Q2 2027...')})}
    </div>`;
  });

  core.registerDetailSection((d)=>{
    const s = d.sustainability || { certificationTarget:'none', notes:'' };
    const relevant = (d.meta && d.meta.oppType==='income') || (s.certificationTarget && s.certificationTarget!=='none');
    if(!relevant) return '';
    const cert = certLabel(s.certificationTarget||'none');
    const hasCert = s.certificationTarget && s.certificationTarget!=='none';
    return `
    <div class="section">
      <h3>🌿 ${core.T('الاستدامة (مستدام/ESG)','Sustainability (Mostadam/ESG)')}</h3>
      <div class="livebox"><div class="lg">
        <div class="li">${core.T('هدف/حالة التصنيف','Certification target/status')}
          <b>${hasCert? `${core.esc(core.T(cert.ar,cert.en))}` : core.T('بدون هدف تصنيف حالياً','No certification target currently')}</b>
        </div>
      </div></div>
      ${s.notes? `<p class="note" style="margin:8px 0; font-size:11.5px; line-height:1.8;"><b>${core.T('ملاحظات','Notes')}:</b> ${core.esc(s.notes)}</p>` : ''}
      <p class="step-sub" style="margin:10px 0 6px;">${core.T('الفوائد الاقتصادية المرجعية للتصنيف (مستدام/LEED)','Reference economic benefits of certification (Mostadam/LEED)')}</p>
      <div class="livebox"><div class="lg">${benefitsListHtml(core, true)}</div></div>
      <p class="note" style="margin-top:8px; font-size:10.5px; color:var(--ink-faint);">${core.T('أرقام مرجعية عامة للسوق، لا تقديراً خاصاً بهذه الفرصة — ولا تدخل تلقائياً في أي حساب. مستويات "مستدام" التفصيلية قد تُحدَّث من الجهة المشغِّلة للبرنامج — تحقّق دائماً من آخر تحديث قبل الاعتماد عليها في قرار فعلي.','General market-level reference figures, not an estimate specific to this opportunity — and they do not automatically feed any calculation. Detailed "Mostadam" tiers may be updated by the program operator — always verify the latest update before relying on them in a real decision.')}</p>
    </div>`;
  });

  core.registerMainView('sustainability-esg', ()=>{
    return `
    <div class="section" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 style="margin:0;">🌿 ${core.T('دليل الاستدامة المرجعي (مستدام/LEED/ESG)','Sustainability Reference Guide (Mostadam/LEED/ESG)')}</h2>
        <p class="note" style="margin:4px 0 0;">${core.T('بنية تصنيف عامة + فوائد اقتصادية مرجعية — لا استبدال لبرنامج "مستدام" الرسمي أو موقعه.','A general certification structure + reference economic benefits — not a substitute for the official "Mostadam" program or its website.')}</p>
      </div>
      <button class="btn btn-sm btn-ghost" data-action="esg-close">✖ ${core.T('إغلاق ورجوع للوحة الفرص','Close & return to dashboard')}</button>
    </div>
    <p class="note" style="margin-bottom:12px; background:var(--warn-soft); color:var(--warn); padding:8px 12px; border-radius:8px;">⚠️ ${core.T('مرجعي/معلوماتي فقط. مستويات "مستدام" وتفاصيلها الدقيقة تُدار من الجهة المختصة (وزارة الشؤون البلدية والقروية والإسكان) وقد تتغيّر — تحقّق من آخر تحديث قبل تحديد هدف تصنيف فعلي.','Informational/reference only. "Mostadam" tiers and their exact details are managed by the competent authority (Ministry of Municipal, Rural Affairs and Housing) and may change — verify the latest update before setting a real certification target.')}</p>

    <div class="section" style="margin-bottom:12px;">
      <p class="step-sub" style="margin:0 0 8px;">🇸🇦 ${core.T('برنامج "مستدام" السعودي','The Saudi "Mostadam" Program')}</p>
      <div class="tablewrap"><table class="db" style="font-size:11.5px;">
        <thead><tr><th>${core.T('المستوى','Tier')}</th></tr></thead>
        <tbody>${MOSTADAM_TIERS.map(t=>`<tr><td>${core.esc(core.T(t.ar,t.en))}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="section" style="margin-bottom:12px;">
      <p class="step-sub" style="margin:0 0 8px;">🌍 ${core.T('LEED (بديل مُعتمَد دولياً)','LEED (an internationally accredited alternative)')}</p>
      <div class="tablewrap"><table class="db" style="font-size:11.5px;">
        <thead><tr><th>${core.T('المستوى','Tier')}</th></tr></thead>
        <tbody>${LEED_TIERS.map(t=>`<tr><td>${core.esc(core.T(t.ar,t.en))}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="section">
      <p class="step-sub" style="margin:0 0 8px;">💡 ${core.T('الفوائد الاقتصادية المرجعية','Reference Economic Benefits')}</p>
      <div class="livebox"><div class="lg">${benefitsListHtml(core, false)}</div></div>
    </div>`;
  });

  core.registerActionHandler(async (action)=>{
    if(action==='esg-open'){ core.setCoreState({ mainView:'sustainability-esg', openDetailId:null, render:true }); return true; }
    if(action==='esg-close'){ core.setCoreState({ mainView:null, render:true }); return true; }
    return false;
  });
}

export { MOSTADAM_TIERS, LEED_TIERS, ESG_BENEFITS, CERT_TARGET_OPTIONS };
