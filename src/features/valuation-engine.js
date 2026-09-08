/* =========================================================================
   محرك التقييم — Valuation Engine (Phase 2، النظام الخامس)
   ---------------------------------------------------------------------------
   تقييم الأرض بثلاث طرق مؤسسية قياسية، وكلها تُعاد استخدام محرك الحساب
   core.compute() نفسه دون أي تكرار لمنطقه المالي (بحث ثنائي على سعر الأرض
   كما في max-acquisition-price.js، فقط بهدف مختلف):
   1) نهج المقارنات (Comparable Approach) — من قاعدة المقارنات (comparables.js،
      نفس مجموعة البيانات STORE.comparables، بلا اعتماد كود مباشر عليه).
   2) نهج القيمة المتبقية (Residual Approach) — هو حرفياً نفس "الحد الأقصى
      لسعر الاستحواذ" من max-acquisition-price.js (السعر الذي يحقق Hurdle
      Rate المستهدف) — إعادة استخدام مباشرة، صفر تكرار.
   3) نهج التدفقات النقدية المخصومة (DCF) — سعر الأرض الذي يجعل NPV المشروع
      (بمعدل WACC) يساوي صفراً بالضبط — بحث ثنائي جديد لكن بنفس النمط تماماً.
   القيمة السوقية المُقترَحة = وسيط الطرق الثلاث الصالحة (أكثر متانة من
   المتوسط أمام أي طريقة شاذة القيمة). الفجوة = القيمة السوقية مقابل سعر طلب
   البائع (negotiation.js، negotiation.askingPrice، بلا اعتماد كود مباشر).
   لا تعديل على منطق core.js الداخلي — فقط عبر نقاط التوسّع المُصدَّرة.
   ========================================================================= */

import { maxAcquisitionPrice } from './max-acquisition-price.js';

function median(nums){
  const s = nums.filter(n=>n!=null && isFinite(n)).sort((a,b)=>a-b);
  if(!s.length) return null;
  const mid = Math.floor(s.length/2);
  return s.length%2 ? s[mid] : (s[mid-1]+s[mid])/2;
}
function npvAtPrice(core, d, price){
  const trial = JSON.parse(JSON.stringify(d));
  trial.land.price = price;
  try{ return core.compute(trial).npvProject; }catch(e){ return null; }
}
function dcfLandValue(core, d){
  const currentPrice = d.land.price || 0;
  if(npvAtPrice(core, d, 0) < 0) return { value: 0, infeasible: true };
  let lo=0, hi=Math.max(currentPrice,100)*3, guard=0;
  while(npvAtPrice(core, d, hi) >= 0 && guard<40){ hi *= 1.6; guard++; }
  for(let i=0;i<50;i++){ const mid=(lo+hi)/2; if(npvAtPrice(core,d,mid) >= 0) lo=mid; else hi=mid; }
  return { value: lo, infeasible: false };
}
function comparableValue(core, d){
  const comps = (core.STORE['comparables']||[]).map(r=>r.data).filter(cm=> cm.city && d.meta.city && cm.city.trim()===d.meta.city.trim() && cm.landSize>0);
  if(!comps.length) return null;
  return median(comps.map(cm=>cm.price/cm.landSize));
}

export function registerValuationEngine(core){
  core.registerDetailSection((d, c)=>{
    const targetIRR = d.criteria.irrMin || 0.15;
    const compPerM2 = comparableValue(core, d);
    const residual = maxAcquisitionPrice(core, d, targetIRR);
    const dcf = dcfLandValue(core, d);

    const approaches = [
      { key:'comparable', ar:'نهج المقارنات', en:'Comparable Approach', value: compPerM2, note: compPerM2==null? core.T('لا توجد مقارنات مسجَّلة لهذه المدينة','No comparables recorded for this city') : null },
      { key:'residual',   ar:'القيمة المتبقية', en:'Residual Approach', value: residual.infeasible? null : residual.maxPrice, note: residual.infeasible? core.T('الفرصة لا تحقق العائد المستهدف حتى بأرض مجانية','Opportunity does not reach target return even at zero land cost') : core.T('السعر الذي يحقق Hurdle Rate المستهدف','Price yielding the target hurdle rate') },
      { key:'dcf',        ar:'التدفقات النقدية المخصومة (DCF)', en:'DCF Approach', value: dcf.infeasible? null : dcf.value, note: dcf.infeasible? core.T('حتى بأرض مجانية NPV سالب','NPV negative even at zero land cost') : core.T('السعر الذي يجعل NPV المشروع (بمعدل WACC) = صفر','Price at which project NPV (at WACC) = zero') },
    ];
    const validValues = approaches.map(a=>a.value).filter(v=>v!=null);
    const marketValue = median(validValues);
    const asking = d.negotiation && d.negotiation.askingPrice;
    const gap = (marketValue!=null && asking!=null) ? (asking-marketValue)/marketValue : null;

    return `
    <div class="section">
      <h3>🏷️ ${core.T('محرك التقييم','Valuation Engine')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(Land Valuation)</span></h3>
      <div class="tablewrap" style="margin-bottom:12px;"><table class="db" style="font-size:12px;">
        <thead><tr><th>${core.T('النهج','Approach')}</th><th>${core.T('القيمة (سعر/م² أرض)','Value (SAR/m² land)')}</th><th>${core.T('ملاحظة','Note')}</th></tr></thead>
        <tbody>
          ${approaches.map(a=>`<tr>
            <td>${core.T(a.ar,a.en)}</td>
            <td class="num" style="font-weight:700;">${a.value!=null? core.fmtSAR(a.value) : '—'}</td>
            <td style="font-size:11px; color:var(--ink-faint);">${a.note||''}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      <div class="kv" style="margin-bottom:8px;">
        <div class="k">${core.T('القيمة السوقية المُقترَحة (وسيط الطرق)','Suggested Market Value (median of approaches)')}</div><div class="v"><b style="font-size:15px;">${marketValue!=null? core.fmtSAR(marketValue) : '—'}</b>${marketValue!=null?'/م²':''}</div>
        <div class="k">${core.T('سعر طلب البائع','Seller Asking Price')}</div><div class="v">${asking!=null? core.fmtSAR(asking)+'/م²' : `<span style="color:var(--ink-faint);">${core.T('لم يُسجَّل بعد (قسم التفاوض)','Not recorded yet (Negotiation section)')}</span>`}</div>
        ${gap!=null? `<div class="k">${core.T('فجوة القيمة','Value Gap')}</div><div class="v" style="color:${gap>0.1?'var(--bad)':gap<-0.1?'var(--good)':'var(--ink)'}; font-weight:700;">${gap>=0?'+':''}${core.fmtPct(gap,1)} ${core.T('(سعر الطلب مقابل القيمة السوقية)','(asking vs. market value)')}</div>` : ''}
      </div>
      ${validValues.length<2? `<p class="note">${core.T('يُنصح بتوفر نهجين على الأقل (مثال: إضافة مقارنات سوقية للمدينة) لزيادة موثوقية القيمة السوقية المُقترَحة.','Recommended to have at least two approaches available (e.g. add market comparables for this city) to increase confidence in the suggested market value.')}</p>` : ''}
    </div>`;
  });
}

export { comparableValue, dcfLandValue };
