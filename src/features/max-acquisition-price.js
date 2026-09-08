/* =========================================================================
   الحد الأقصى لسعر الاستحواذ — Maximum Acquisition Price (Phase 2، النظام الأول)
   ---------------------------------------------------------------------------
   بدل "البائع يطلب ١٢٠م" → النظام يقول "الحد الأقصى = ١٠٦٫٤م حتى تتحقق Equity
   IRR ≥ ١٥٪". بحث ثنائي (Binary Search) على سعر متر الأرض (land.price) باستخدام
   محرك الحساب core.compute() نفسه دون أي تكرار لمنطقه — نفس المعادلات المُتحقَّق
   منها بالضبط، فقط نبحث عكسياً عن السعر الذي يُنتج target IRR بدل حساب IRR من
   سعر معطى. غير مخزَّن كحقل ثابت في بيانات الفرصة (لا داعي: يُعاد حسابه حياً في
   كل عرض من land.price/criteria.irrMin الحاليين) — يُصدَّر كدالة يستخدمها أيضاً
   negotiation.js لحساب Walk-away Price الافتراضي. لا تعديل على core.js.
   ========================================================================= */

function irrAtPrice(core, d, price){
  const trial = JSON.parse(JSON.stringify(d));
  trial.land.price = price;
  try{ return core.compute(trial).equityIRR; }catch(e){ return -1; }
}

/* يُعيد: maxPrice (الحد الأقصى)، targetIRR، currentPrice، currentIRR، infeasible (true لو حتى
   أرض مجانية "٠" لا تحقق الهدف — عندها القرار المالي لا علاقة له بسعر الأرض إطلاقاً). */
function maxAcquisitionPrice(core, d, targetIRR){
  targetIRR = targetIRR!=null ? targetIRR : (d.criteria.irrMin || 0.15);
  const currentPrice = d.land.price || 0;
  const currentIRR = irrAtPrice(core, d, currentPrice);

  const irrAtZero = irrAtPrice(core, d, 0);
  if(irrAtZero < targetIRR){
    return { maxPrice: 0, targetIRR, currentPrice, currentIRR, infeasible: true };
  }

  let lo = 0, hi = Math.max(currentPrice, 100) * 3;
  let guard = 0;
  while(irrAtPrice(core, d, hi) >= targetIRR && guard < 40){ hi *= 1.6; guard++; }

  for(let i=0;i<50;i++){
    const mid = (lo+hi)/2;
    if(irrAtPrice(core, d, mid) >= targetIRR) lo = mid; else hi = mid;
  }
  return { maxPrice: lo, targetIRR, currentPrice, currentIRR, infeasible: false };
}

export function registerMaxAcquisitionPrice(core){
  core.registerDetailSection((d, c)=>{
    const targetIRR = d.criteria.irrMin || 0.15;
    const res = maxAcquisitionPrice(core, d, targetIRR);
    const gap = res.maxPrice - res.currentPrice;
    const gapPct = res.currentPrice>0 ? gap/res.currentPrice : 0;
    const canPay = !res.infeasible && gap >= 0;

    return `
    <div class="section">
      <h3>💰 ${core.T('الحد الأقصى لسعر الاستحواذ','Maximum Acquisition Price')}</h3>
      ${res.infeasible? `
      <p class="note" style="color:var(--bad);">🚫 ${core.T('حتى بأرض مجانية (سعر = صفر)، الفرصة لا تحقق الحد الأدنى لـ Equity IRR','Even at zero land cost, the opportunity does not reach the minimum Equity IRR')} (${core.fmtPct(targetIRR)}) — ${core.T('المشكلة ليست في سعر الأرض؛ راجع الافتراضات الأساسية (التكلفة/الإيراد/التمويل).','the issue is not the land price; review the core assumptions (cost/revenue/financing).')}</p>
      ` : `
      <div class="kv" style="margin-bottom:10px;">
        <div class="k">${core.T('السعر الحالي المُدخَل','Current Entered Price')}</div><div class="v">${core.fmtSAR(res.currentPrice)}/م² <span style="color:var(--ink-faint); font-size:11px;">(Equity IRR ${core.fmtPct(res.currentIRR)})</span></div>
        <div class="k">${core.T('الحد الأقصى المسموح به','Maximum Payable')}</div><div class="v"><b style="color:${canPay?'var(--good)':'var(--bad)'}; font-size:15px;">${core.fmtSAR(res.maxPrice)}/م²</b> <span style="color:var(--ink-faint); font-size:11px;">${core.T('حتى تتحقق','to reach')} Equity IRR ≥ ${core.fmtPct(targetIRR)}</span></div>
        <div class="k">${core.T('الهامش المتبقي','Remaining Headroom')}</div><div class="v" style="color:${gap>=0?'var(--good)':'var(--bad)'};">${gap>=0?'+':''}${core.fmtSAR(gap)}/م² (${core.fmtPct(gapPct,1)})</div>
      </div>
      <p class="note">${gap>=0
        ? core.T('السعر الحالي ضمن الحد المسموح — لا يزال هناك هامش تفاوضي متاح للبائع دون المساس بالعائد المستهدف.','Current price is within the payable limit — there is still negotiation headroom before hitting the target return.')
        : core.T('السعر الحالي يتجاوز الحد الأقصى المسموح به — العائد المستهدف لن يتحقق بهذا السعر.','Current price exceeds the maximum payable — the target return will not be met at this price.')}</p>
      `}
    </div>`;
  });
}

export { maxAcquisitionPrice, irrAtPrice };
