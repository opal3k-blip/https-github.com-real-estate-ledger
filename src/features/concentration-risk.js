/* =========================================================================
   تحذيرات تركّز المحفظة — Concentration Risk (Phase 3، النظام الثاني)
   ---------------------------------------------------------------------------
   تحذيرات تلقائية عندما يتجاوز صندوق واحد/مدينة واحدة/نوع فرصة واحد نسبة
   معتبرة من إجمالي المحفظة (٣٥٪ فأكثر)، بلا أي حساب مكرَّر — يستهلك مباشرة
   portfolioIntelligenceStats() المُصدَّرة من portfolio.js. بانر تحذيري على
   اللوحة الرئيسية (registerBodyView، يظهر فقط في اللوحة الافتراضية — ليس
   داخل Pipeline/Portfolio/Funds/تفاصيل فرصة، تفادياً للإزعاج)، بالإضافة إلى
   ملاحظة سياقية داخل كل فرصة (registerDetailSection) توضّح حصة مدينتها/نوعها
   الحالية من إجمالي المحفظة. لا تعديل على منطق core.js الداخلي.
   ========================================================================= */

import { portfolioIntelligenceStats, WARN_THRESHOLD } from './portfolio.js';

const HIGH_THRESHOLD = 0.50;

export function registerConcentrationRisk(core){
  core.registerBodyView(()=>{
    if(core.openDetailId || core.mainView || core.fundsViewOpen) return '';
    if(!core.STORE.funds || !core.STORE.funds.length) return '';
    const s = portfolioIntelligenceStats(core);
    const flagged = [];
    s.cityConc.forEach(r=>{ if(r.pct>=WARN_THRESHOLD) flagged.push({ kind: core.T('مدينة','city'), ...r }); });
    s.typeConc.forEach(r=>{ if(r.pct>=WARN_THRESHOLD) flagged.push({ kind: core.T('نوع فرصة','opportunity type'), ...r }); });
    s.fundConc.forEach(r=>{ if(r.pct>=WARN_THRESHOLD) flagged.push({ kind: core.T('صندوق','fund'), ...r }); });
    if(!flagged.length) return '';
    return `
    <div class="section" style="margin:14px 0;">
      <div class="panel" style="border:1px solid var(--bad);">
        <div class="panel-head"><h3 style="color:var(--bad);">⚠️ ${core.T('تحذير تركّز المحفظة (Concentration Risk)','Portfolio Concentration Warning')}</h3></div>
        <ul style="margin:0; padding-inline-start:18px; font-size:12.5px; line-height:2;">
          ${flagged.map(f=>`<li>${core.esc(f.kind)}: <b>${core.esc(f.key)}</b> ${core.T('يمثّل','represents')} <b style="color:${f.pct>=HIGH_THRESHOLD?'var(--bad)':'inherit'};">${core.fmtPct(f.pct)}</b> ${core.T('من إجمالي المحفظة','of total portfolio')}${f.pct>=HIGH_THRESHOLD? ' — '+core.T('تركّز مرتفع جداً','critically high concentration') : ''}</li>`).join('')}
        </ul>
        <p class="note" style="margin:8px 0 0;">${core.T('يُنصح بمراجعة استراتيجية التنويع الجغرافي/القطاعي قبل إضافة فرص جديدة من نفس الفئة.','Consider reviewing geographic/sector diversification before adding further opportunities in the same bucket.')}</p>
      </div>
    </div>`;
  });

  core.registerDetailSection((d)=>{
    if(!core.STORE.funds || !core.STORE.funds.length) return '';
    const s = portfolioIntelligenceStats(core);
    if(!s.cityConc.length && !s.typeConc.length) return '';
    const city = d.meta.city || core.T('غير محدد','Unspecified');
    const cityRow = s.cityConc.find(r=>r.key===city);
    const ti = core.OPP_TYPE_INFO[d.meta.oppType];
    const tlabel = ti? core.T(ti.t, ti.en) : d.meta.oppType;
    const typeRow = s.typeConc.find(r=>r.key===tlabel);
    if(!cityRow && !typeRow) return '';
    return `
    <div class="section">
      <h3>⚠️ ${core.T('تركّز المحفظة','Portfolio Concentration')}</h3>
      <div class="kv">
        ${cityRow? `<div class="k">${core.T('حصة المدينة','City Share')} (${core.esc(city)})</div><div class="v" style="${cityRow.pct>=WARN_THRESHOLD?'color:var(--bad); font-weight:700;':''}">${core.fmtPct(cityRow.pct)} ${core.T('من إجمالي TPC للمحفظة المرتبطة بصناديق','of linked-portfolio total TPC')}</div>`:''}
        ${typeRow? `<div class="k">${core.T('حصة نوع الفرصة','Type Share')} (${core.esc(tlabel)})</div><div class="v" style="${typeRow.pct>=WARN_THRESHOLD?'color:var(--bad); font-weight:700;':''}">${core.fmtPct(typeRow.pct)} ${core.T('من إجمالي TPC للمحفظة المرتبطة بصناديق','of linked-portfolio total TPC')}</div>`:''}
      </div>
    </div>`;
  });
}
