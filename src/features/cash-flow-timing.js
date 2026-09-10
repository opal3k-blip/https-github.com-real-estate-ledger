/* =========================================================================
   دقة زمنية للتدفقات النقدية — Cash Flow Timing Precision (المرحلة الثامنة،
   الطلب الأول للمستخدم)
   ---------------------------------------------------------------------------
   السياق: محرك compute() في core.js يُخرِج projectCF/equityCF كمصفوفة سنوية
   بحتة فقط (سنة 0 = الدفعة الأولية، ثم سنة 1..totalYears) — لا يوجد أي مفهوم
   شهري أو ربع سنوي، ولا أي افتراض لتوقيت الصرف داخل السنة. طلب المستخدم
   الحرفي: "التدفقات النقدية اريدها شهرية افضل وربع سنويه وسنويه بحيث تحسب
   بدقة متى ذروة الاحتياج النقدي الفعلي للمشروع".

   المنهجية (بموافقة المستخدم على الخيار المُوصى به — منحنى S):
   - سنة 0 (الدفعة الأولية/الالتزام الأول): نقطة زمنية واحدة (Day 0) — لا تُوزَّع
     على 12 شهراً لأنها فعلياً دفعة لحظية عند البداية.
   - سنوات الإنشاء (1..constructionYears): تُوزَّع على 12 شهراً بمنحنى S واقعي
     (تباطؤ في البداية، تسارع في الوسط، تباطؤ قبل التسليم) — مُقارَب هنا بدالة
     جيبية متماثلة الشكل تُطبَّع لمجموع = 1، وهي أقرب تمثيل لمنحنى إنفاق إنشائي
     حقيقي من التوزيع الخطي المتساوي.
   - آخر سنة (سنة الخروج/البيع/التصفية — totalYears): تُعامَل كحدث إغلاق واحد
     يقع في الشهر الأخير (12) بالكامل، بدل توزيعه — لأن عائد البيع/الخروج في
     الواقع يهبط دفعة واحدة عند إغلاق الصفقة، لا يتوزّع شهرياً. هذا افتراض
     مبسِّط مُعلَن بوضوح في الواجهة (انظر التعليق التوضيحي هناك).
   - أي سنوات تشغيل وسيطة (بين نهاية الإنشاء وسنة الخروج): توزيع خطي متساوٍ على
     12 شهراً (الإيجار/التشغيل غالباً شبه منتظم شهرياً).

   ذروة الاحتياج النقدي الفعلي = أدنى نقطة (الأكثر سالبية) في المجموع التراكمي
   الشهري لـ equityCF بدءاً من سنة 0 — أي أعلى رصيد سالب تراكمي يجب على حقوق
   الملكية تغطيته في أي لحظة، وهو ما يحدِّد إجمالي رأس المال المطلوب فعلياً وفي
   أي شهر بالضبط يحدث ذلك (نفس السؤال الحرفي: "متى ذروة الاحتياج").

   الإجابة على سؤال المستخدم الثاني ("هل المستثمر النقدي والعيني في نفس
   الصندوق؟ وكم نحتاجه من النقدي؟"): نعم — أُضيف نوع مساهمة (نقدي/عيني) لكل
   التزام مستثمر (انظر CONTRIBUTION_TYPES في core.js). صافي المبلغ النقدي
   المطلوب فعلياً من "المستثمرين النقديين" = ذروة الاحتياج النقدي (أعلى) − إجمالي
   قيمة المساهمات العينية المتفَق عليها في الصندوق (الأرض مثلاً) — بحد أدنى صفر.
   هذا تحديداً ما اقترحه المستخدم بنفسه ("الفرق في حقوق الملكية أو الحساب
   الصحيح ... فرق التكلفة عن ذروة الاحتياج في التمويل والصندوق والرسوم").

   لا تعديل على core.js في هذا الملف إطلاقاً — كل شيء مُشتَق فقط من مخرجات
   compute() الموجودة أصلاً (equityCF/projectCF/constructionYears/totalYears)
   عبر نقطتي التوسّع registerDetailSection/registerActionHandler.
   ========================================================================= */

function n(v){ return (v==null || isNaN(v)) ? 0 : Number(v); }

// منحنى S تقريبي: جرس جيبي متماثل حول وسط السنة، يُطبَّع لمجموع = 1
export function sCurveWeights(months=12){
  const raw = Array.from({length:months}, (_,i)=> Math.sin(Math.PI*(i+0.5)/months));
  const sum = raw.reduce((a,b)=>a+b,0) || 1;
  return raw.map(w=>w/sum);
}
export function evenWeights(months=12){ return Array.from({length:months}, ()=>1/months); }
export function lumpEndWeights(months=12){ return Array.from({length:months}, (_,i)=> i===months-1 ? 1 : 0); }

// يحدِّد منحنى التوزيع الشهري المناسب لسنة معيّنة من عمر المشروع
export function curveForYear(yearIndex, constructionYears, totalYears){
  if(yearIndex===totalYears) return 'lump-end'; // سنة الخروج/البيع — حدث إغلاق واحد
  if(yearIndex<=constructionYears) return 's-curve'; // سنوات الإنشاء — منحنى إنفاق واقعي
  return 'even'; // سنوات تشغيل وسيطة — شبه منتظمة شهرياً
}

/* يحوِّل مصفوفة سنوية (annualCF[0]=t0, annualCF[1..totalYears]=كل سنة) إلى مصفوفة شهرية
   مفصّلة، مع الحفاظ على أن مجموع كل 12 شهراً يساوي رقم السنة الأصلي تماماً (بلا أي فروقات
   تقريب مادية) — فتبقى السنوية القائمة صالحة كمرجعية تحقّق تقاطعي دون أي تغيير. */
export function monthlySchedule(annualCF, constructionYears, totalYears){
  const months = [];
  months.push({ yearIndex:0, monthInYear:0, globalMonthIndex:0, amount:n(annualCF[0]), curve:'t0' });
  for(let yr=1; yr<=totalYears; yr++){
    const annualAmt = n(annualCF[yr]);
    const curve = curveForYear(yr, constructionYears, totalYears);
    const weights = curve==='s-curve' ? sCurveWeights(12) : curve==='lump-end' ? lumpEndWeights(12) : evenWeights(12);
    for(let m=1; m<=12; m++){
      months.push({ yearIndex:yr, monthInYear:m, globalMonthIndex:(yr-1)*12+m, amount: annualAmt*weights[m-1], curve });
    }
  }
  return months;
}

// المجموع التراكمي شهرياً + نقطة الذروة (أدنى/أكثر سالبية) — هذه هي "ذروة الاحتياج النقدي الفعلي"
export function cumulativeAndPeak(months){
  let cum = 0, peak = null;
  const withCum = months.map(mo=>{
    cum += mo.amount;
    const row = Object.assign({}, mo, { cumulative: cum });
    if(peak===null || cum < peak.cumulative) peak = row;
    return row;
  });
  return { months: withCum, peak };
}

// تجميع ربع سنوي من المصفوفة الشهرية (سنة 0/t0 تبقى صفاً مستقلاً بلا تجميع)
export function quarterlyFromMonthly(months){
  const rows = [];
  const t0 = months.find(m=>m.yearIndex===0);
  if(t0) rows.push({ yearIndex:0, quarter:0, amount:t0.amount, cumulative:t0.cumulative });
  const byKey = new Map();
  months.filter(m=>m.yearIndex>0).forEach(mo=>{
    const q = Math.ceil(mo.monthInYear/3);
    const key = mo.yearIndex+'-'+q;
    if(!byKey.has(key)) byKey.set(key, { yearIndex:mo.yearIndex, quarter:q, amount:0, cumulative:0 });
    const row = byKey.get(key);
    row.amount += mo.amount;
    row.cumulative = mo.cumulative; // آخر شهر في الربع يحمل التراكمي الصحيح لحظتها
  });
  for(const row of byKey.values()) rows.push(row);
  return rows;
}

/* التحليل الكامل — شهري/ربع سنوي/سنوي + ذروة الاحتياج + صافي النقدي المطلوب من
   المستثمرين النقديين بعد خصم قيمة المساهمات العينية المرتبطة بنفس الفرصة. */
export function cashFlowTimingAnalysis(core, d, c, oppId){
  const constructionYears = Math.max(0, Math.round(c.constructionYears||0));
  const totalYears = Math.max(1, Math.round(c.totalYears||1));

  const equityMonthlyRaw = monthlySchedule(c.equityCF||[], constructionYears, totalYears);
  const projectMonthlyRaw = monthlySchedule(c.projectCF||[], constructionYears, totalYears);
  const { months: equityMonthly, peak } = cumulativeAndPeak(equityMonthlyRaw);
  const { months: projectMonthly } = cumulativeAndPeak(projectMonthlyRaw);

  const peakCashNeed = {
    amount: Math.max(0, -(peak? peak.cumulative : 0)),
    yearIndex: peak? peak.yearIndex : 0,
    monthInYear: peak? peak.monthInYear : 0,
    globalMonthIndex: peak? peak.globalMonthIndex : 0,
  };

  const equityQuarterly = quarterlyFromMonthly(equityMonthly);
  const projectQuarterly = quarterlyFromMonthly(projectMonthly);

  // ربط الفرصة بصندوق/صناديقها الفعلية (fund.data.assetIds) لاستخراج المساهمات العينية المرتبطة
  const linkedFunds = (core.STORE.funds||[]).filter(f=>(f.data.assetIds||[]).includes(oppId));
  let totalInKind = 0, totalCash = 0;
  linkedFunds.forEach(f=>{
    const cmts = core.commitmentsForFund(f.id);
    cmts.forEach(cm=>{
      const amt = n(cm.data.commitmentAmount);
      if(cm.data.contributionType==='in_kind') totalInKind += amt; else totalCash += amt;
    });
  });
  const netCashRequiredFromCashInvestors = Math.max(0, peakCashNeed.amount - totalInKind);

  return {
    constructionYears, totalYears,
    equityMonthly, projectMonthly, equityQuarterly, projectQuarterly,
    peakCashNeed, linkedFunds, totalInKind, totalCash, netCashRequiredFromCashInvestors,
  };
}

function monthLabel(core, mo){
  if(mo.yearIndex===0) return core.T('بداية المشروع (Day 0)','Project Start (Day 0)');
  return core.T('سنة '+mo.yearIndex+' — شهر '+mo.monthInYear, 'Year '+mo.yearIndex+' — Month '+mo.monthInYear);
}
function quarterLabel(core, row){
  if(row.yearIndex===0) return core.T('بداية المشروع (Day 0)','Project Start (Day 0)');
  return core.T('سنة '+row.yearIndex+' — ربع '+row.quarter, 'Year '+row.yearIndex+' — Q'+row.quarter);
}
function curveNote(core, curve){
  return { 's-curve':core.T('منحنى S (إنشاء)','S-curve (construction)'), 'even':core.T('خطي متساوٍ (تشغيل)','Even (operating)'),
    'lump-end':core.T('دفعة إغلاق واحدة (خروج/بيع)','Single closing lump (exit/sale)'), 't0':core.T('دفعة أولية','Initial outlay') }[curve] || curve;
}

const _cftTab = {}; // oppId -> 'monthly' | 'quarterly' | 'annual' — حالة واجهة محلية فقط، لا تحتاج تخزيناً

export function registerCashFlowTiming(core){
  core.registerActionHandler(async (action, el)=>{
    if(action!=='cft-tab') return false;
    _cftTab[el.dataset.oppid] = el.dataset.tab;
    core.render();
    return true;
  });

  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    if(!oppId) return '';
    const a = cashFlowTimingAnalysis(core, d, c, oppId);
    const tab = _cftTab[oppId] || 'monthly';

    const peakLabel = a.peakCashNeed.yearIndex===0
      ? core.T('بداية المشروع (Day 0)','Project Start (Day 0)')
      : core.T('سنة '+a.peakCashNeed.yearIndex+' — شهر '+a.peakCashNeed.monthInYear, 'Year '+a.peakCashNeed.yearIndex+' — Month '+a.peakCashNeed.monthInYear);

    const tabBtn = (key, ar, en) => `<button class="btn btn-sm ${tab===key?'btn-primary':'btn-ghost'}" data-action="cft-tab" data-oppid="${oppId}" data-tab="${key}">${core.T(ar,en)}</button>`;

    const rowsForTab = () => {
      if(tab==='annual'){
        const rows = [];
        for(let yr=0; yr<=a.totalYears; yr++){
          rows.push({ label: yr===0? core.T('بداية المشروع (Day 0)','Project Start (Day 0)') : core.T('سنة '+yr,'Year '+yr),
            equity: c.equityCF[yr]||0, project: c.projectCF[yr]||0, curve: curveForYear(yr, a.constructionYears, a.totalYears) });
        }
        return rows;
      }
      if(tab==='quarterly'){
        return a.equityQuarterly.map((q,i)=>({ label: quarterLabel(core,q), equity:q.amount, project:(a.projectQuarterly[i]||{}).amount||0, cumulative:q.cumulative }));
      }
      return a.equityMonthly.map((mo,i)=>({ label: monthLabel(core,mo), equity:mo.amount, project:(a.projectMonthly[i]||{}).amount||0, cumulative:mo.cumulative, curve:mo.curve }));
    };
    const rows = rowsForTab();
    const isPeakRow = (idx) => tab==='monthly' && a.equityMonthly[idx] && a.equityMonthly[idx].globalMonthIndex===a.peakCashNeed.globalMonthIndex;

    return `
    <div class="section">
      <h3>⏱️ ${core.T('دقة التدفقات النقدية — شهري / ربع سنوي / سنوي','Cash Flow Timing Precision — Monthly / Quarterly / Annual')}</h3>
      <p class="note" style="margin:0 0 12px; font-size:11.5px;">${core.T('اشتقاق شهري/ربع سنوي من مخرجات النموذج السنوية القائمة (equityCF/projectCF) دون أي تعديل عليها — سنوات الإنشاء بمنحنى S واقعي (تباطؤ↑تسارع↑تباطؤ)، سنوات التشغيل الوسيطة بتوزيع خطي متساوٍ، وسنة الخروج/البيع كدفعة إغلاق واحدة في شهرها الأخير. السنوي أعلاه يبقى المرجع التقاطعي الدقيق.','Derived monthly/quarterly from the existing annual model outputs (equityCF/projectCF) without altering them — construction years use a realistic S-curve (slow↑fast↑slow), interim operating years an even monthly split, and the exit/sale year a single closing lump in its final month. The annual figures above remain the exact cross-check.')}</p>

      <div style="background:${a.peakCashNeed.amount>0?'#ef444411':'var(--surface-2)'}; border:1px solid ${a.peakCashNeed.amount>0?'#ef444433':'var(--border)'}; border-radius:10px; padding:14px 16px; margin-bottom:14px;">
        <div class="kv" style="margin:0;">
          <div class="k" style="font-weight:700;">🔴 ${core.T('ذروة الاحتياج النقدي الفعلي (Peak Cash Need)','Actual Peak Cash Need')}</div>
          <div class="v" style="font-weight:700; color:${a.peakCashNeed.amount>0?'var(--bad)':'var(--good)'};">${core.fmtSAR(a.peakCashNeed.amount)}</div>
          <div class="k">${core.T('متى يحدث','When it occurs')}</div><div class="v">${peakLabel}</div>
        </div>
      </div>

      <div style="background:var(--surface-2); border-radius:10px; padding:14px 16px; margin-bottom:14px;">
        <div class="kv" style="margin:0;">
          <div class="k">${core.T('إجمالي الملتزَم عيني (مرتبط بصندوق/صناديق هذه الفرصة)','Total In-Kind Committed (linked fund(s))')}</div><div class="v">🏗️ ${core.fmtSAR(a.totalInKind)}</div>
          <div class="k">${core.T('إجمالي الملتزَم نقدي (نفس الصندوق/الصناديق)','Total Cash Committed (same fund(s))')}</div><div class="v">💵 ${core.fmtSAR(a.totalCash)}</div>
          <div class="k" style="font-weight:700;">${core.T('صافي النقدي المطلوب فعلياً من المستثمرين النقديين','Net Cash Actually Required From Cash Investors')}</div>
          <div class="v" style="font-weight:700;">${core.fmtSAR(a.netCashRequiredFromCashInvestors)}</div>
        </div>
        <p class="note" style="margin:8px 0 0; font-size:11px;">${core.T('= ذروة الاحتياج النقدي − إجمالي المساهمات العينية المتفَق عليها (بحد أدنى صفر) — أي الفرق الذي لا تغطيه الأرض/الحصة العينية ويجب توفيره نقداً عبر التمويل البنكي و/أو مساهمات المستثمرين النقديين ورسوم الصندوق.','= Peak Cash Need − total agreed in-kind contributions (floored at zero) — the gap not covered by land/in-kind equity that must be funded in cash via bank financing and/or cash investor contributions and fund fees.')}${a.linkedFunds.length===0? ' <b>'+core.T('⚠️ لا يوجد صندوق مرتبط بهذه الفرصة بعد — الرقم أعلاه يفترض تغطية عينية صفرية.','⚠️ No fund is linked to this opportunity yet — the figure above assumes zero in-kind coverage.')+'</b>' : ''}</p>
      </div>

      <div style="display:flex; gap:6px; margin-bottom:10px;">
        ${tabBtn('monthly','شهري','Monthly')}
        ${tabBtn('quarterly','ربع سنوي','Quarterly')}
        ${tabBtn('annual','سنوي','Annual')}
      </div>

      <div class="tablewrap"><table class="db">
        <thead><tr><th>${core.T('الفترة','Period')}</th><th>${core.T('تدفق حقوق الملكية','Equity CF')}</th><th>${core.T('تدفق المشروع','Project CF')}</th>${tab!=='annual'?`<th>${core.T('التراكمي (حقوق الملكية)','Cumulative (Equity)')}</th>`:''}${tab==='annual'?`<th>${core.T('المنحنى المفترَض','Assumed Curve')}</th>`:''}</tr></thead>
        <tbody>
          ${rows.map((r,i)=>`
          <tr style="${isPeakRow(i)?'background:#ef444422; font-weight:700;':''}">
            <td>${r.label}${isPeakRow(i)?' 🔴':''}</td>
            <td class="num mono" style="${r.equity<0?'color:var(--bad);':''}">${core.fmtSAR(r.equity)}</td>
            <td class="num mono" style="${r.project<0?'color:var(--bad);':''}">${core.fmtSAR(r.project)}</td>
            ${tab!=='annual'?`<td class="num mono" style="${r.cumulative<0?'color:var(--bad);':''}">${core.fmtSAR(r.cumulative)}</td>`:''}
            ${tab==='annual'?`<td style="font-size:11.5px;">${curveNote(core, r.curve)}</td>`:''}
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
  });
}
