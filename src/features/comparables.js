/* =========================================================================
   قاعدة المقارنات العقارية — Comparable Transactions (Phase 2، النظام الرابع)
   ---------------------------------------------------------------------------
   قاعدة بيانات مقارنات مستقلة (مجموعة Firestore/localStorage عامة عبر
   core.registerDataCollection — البنية العامة المُعدَّة أصلاً لأي مجموعة
   جديدة)، وليست مرتبطة بفرصة واحدة — يمكن أن تخدم أكثر من فرصة بنفس المدينة/
   الحي. كل مقارنة: المدينة، الحي، نوع العقار، مساحة الأرض، GFA، السعر الكلي،
   السعر/م²، التاريخ، المصدر، المسافة عن الفرصة (كم). لوحة كاملة (Main View)
   لإدارة القاعدة + قسم تفصيلي في كل فرصة يُصفّي المقارنات حسب مدينة الفرصة
   ويحسب "X% أعلى/أقل من الوسيط" تلقائياً مقابل سعر متر الأرض المُدخَل.
   لا تعديل على منطق core.js الداخلي — فقط عبر نقاط التوسّع المُصدَّرة.
   ========================================================================= */

const COMPARABLES_COLLECTION = 'comparables';
const PROPERTY_TYPES = ['سكني','تجاري','مكاتب','بنك أراضٍ','متعدد الاستخدام'];

function median(nums){
  if(!nums.length) return null;
  const s = nums.slice().sort((a,b)=>a-b);
  const mid = Math.floor(s.length/2);
  return s.length%2 ? s[mid] : (s[mid-1]+s[mid])/2;
}

export function registerComparables(core){
  core.registerDataCollection(COMPARABLES_COLLECTION);

  core.registerTopbarButton(()=>{
    return `<button class="btn btn-sm" data-action="comps-open">📊 ${core.T('قاعدة المقارنات','Comparables')}</button>`;
  });

  core.registerMainView('comparables', ()=>{
    const comps = core.STORE[COMPARABLES_COLLECTION] || [];
    return `
    <div class="section" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 style="margin:0;">📊 ${core.T('قاعدة المقارنات العقارية','Comparable Transactions Database')}</h2>
        <p class="note" style="margin:4px 0 0;">${core.T('عدد المقارنات المسجَّلة','Recorded comparables')}: <b>${comps.length}</b></p>
      </div>
      <button class="btn btn-sm btn-ghost" data-action="comps-close">✖ ${core.T('إغلاق ورجوع للوحة الفرص','Close & return to dashboard')}</button>
    </div>

    <div class="section" style="margin-bottom:14px; background:var(--surface-2); border:1px dashed var(--border);">
      <p class="step-sub" style="margin:0 0 10px;">${core.T('إضافة مقارنة جديدة','Add a new comparable')}</p>
      <form id="comp-add-form" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px,1fr)); gap:8px;">
        <input type="text" name="city" placeholder="${core.T('المدينة','City')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="text" name="neighborhood" placeholder="${core.T('الحي','Neighborhood')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <select name="propertyType" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          ${PROPERTY_TYPES.map(t=>`<option value="${t}">${t}</option>`).join('')}
        </select>
        <input type="number" name="landSize" placeholder="${core.T('مساحة الأرض م²','Land size m²')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="gfa" placeholder="GFA م²" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="price" placeholder="${core.T('السعر الكلي','Total price')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="date" name="date" value="${core.todayStr()}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="text" name="source" placeholder="${core.T('المصدر','Source')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="distanceKm" placeholder="${core.T('المسافة (كم)','Distance (km)')}" step="0.1" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
      </form>
      <button type="button" class="btn btn-sm btn-primary" style="margin-top:8px;" data-action="comps-add">➕ ${core.T('إضافة','Add')}</button>
    </div>

    <div class="tablewrap"><table class="db" style="font-size:12px;">
      <thead><tr>
        <th>${core.T('المدينة','City')}</th><th>${core.T('الحي','Neighborhood')}</th><th>${core.T('النوع','Type')}</th>
        <th>${core.T('مساحة الأرض','Land Size')}</th><th>GFA</th><th>${core.T('السعر الكلي','Total Price')}</th>
        <th>${core.T('السعر/م² أرض','Price/m² Land')}</th><th>${core.T('التاريخ','Date')}</th><th>${core.T('المصدر','Source')}</th>
        <th>${core.T('المسافة','Distance')}</th><th></th>
      </tr></thead>
      <tbody>
        ${comps.slice().sort((a,b)=> (b.data.date||'').localeCompare(a.data.date||'')).map(rec=>{
          const c = rec.data;
          const perM2 = c.landSize>0 ? c.price/c.landSize : 0;
          const distStr = c.distanceKm!=null ? `${c.distanceKm} ${core.T('كم','km')}` : '—';
          return `<tr>
            <td>${core.esc(c.city||'—')}</td><td>${core.esc(c.neighborhood||'—')}</td><td>${core.esc(c.propertyType||'—')}</td>
            <td class="num">${core.fmtNum(c.landSize)}</td><td class="num">${core.fmtNum(c.gfa)}</td>
            <td class="num">${core.fmtSAR(c.price)}</td><td class="num" style="font-weight:700;">${core.fmtSAR(perM2)}</td>
            <td class="mono">${core.esc(c.date||'')}</td><td style="font-size:11px;">${core.esc(c.source||'—')}</td>
            <td class="num">${distStr}</td>
            <td><button class="btn btn-sm btn-ghost" data-action="comps-delete" data-id="${rec.id}">🗑️</button></td>
          </tr>`;
        }).join('') || `<tr><td colspan="11" style="text-align:center; padding:16px;">${core.T('لا توجد مقارنات مسجَّلة بعد','No comparables recorded yet')}</td></tr>`}
      </tbody>
    </table></div>`;
  });

  core.registerDetailSection((d, c)=>{
    const comps = (core.STORE[COMPARABLES_COLLECTION] || []).map(r=>r.data).filter(cm=> cm.city && d.meta.city && cm.city.trim()===d.meta.city.trim());
    if(comps.length===0) return '';
    const perM2s = comps.filter(cm=>cm.landSize>0).map(cm=>cm.price/cm.landSize);
    const med = median(perM2s);
    const subjectPrice = d.land.price;
    const diffPct = med? (subjectPrice-med)/med : null;

    return `
    <div class="section">
      <h3>📊 ${core.T('مقارنات السوق','Market Comparables')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(${comps.length} ${core.T('مقارنة في','comparable(s) in')} ${core.esc(d.meta.city)})</span></h3>
      ${med!=null? `
      <div class="kv" style="margin-bottom:12px;">
        <div class="k">${core.T('الوسيط (سعر/م² أرض)','Median (price/m² land)')}</div><div class="v">${core.fmtSAR(med)}</div>
        <div class="k">${core.T('سعر الفرصة الحالي','Subject Opportunity Price')}</div><div class="v">${core.fmtSAR(subjectPrice)}</div>
        <div class="k">${core.T('الفرق عن الوسيط','Difference vs. Median')}</div><div class="v" style="color:${diffPct>0.05?'var(--bad)':diffPct<-0.05?'var(--good)':'var(--ink)'}; font-weight:700;">${diffPct>=0?'+':''}${core.fmtPct(diffPct,1)}</div>
      </div>` : ''}
      <div class="tablewrap"><table class="db" style="font-size:11.5px;">
        <thead><tr><th>${core.T('الحي','Neighborhood')}</th><th>${core.T('النوع','Type')}</th><th>${core.T('مساحة الأرض','Land Size')}</th><th>${core.T('السعر/م²','Price/m²')}</th><th>${core.T('التاريخ','Date')}</th><th>${core.T('المصدر','Source')}</th></tr></thead>
        <tbody>${comps.map(cm=>`<tr>
          <td>${core.esc(cm.neighborhood||'—')}</td><td>${core.esc(cm.propertyType||'—')}</td>
          <td class="num">${core.fmtNum(cm.landSize)}</td><td class="num">${core.fmtSAR(cm.landSize>0?cm.price/cm.landSize:0)}</td>
          <td class="mono">${core.esc(cm.date||'')}</td><td style="font-size:11px;">${core.esc(cm.source||'—')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='comps-open'){ core.setCoreState({ mainView:'comparables', openDetailId:null, render:true }); return true; }
    if(action==='comps-close'){ core.setCoreState({ mainView:null, render:true }); return true; }
    if(action==='comps-add'){
      const form = document.getElementById('comp-add-form');
      if(!form) return true;
      const price = Number(form.querySelector('[name="price"]').value)||0;
      const landSize = Number(form.querySelector('[name="landSize"]').value)||0;
      if(price<=0 || landSize<=0) return true;
      const rec = { id: core.uid('CMP'), data: {
        city: form.querySelector('[name="city"]').value.trim(),
        neighborhood: form.querySelector('[name="neighborhood"]').value.trim(),
        propertyType: form.querySelector('[name="propertyType"]').value,
        landSize, gfa: Number(form.querySelector('[name="gfa"]').value)||0, price,
        date: form.querySelector('[name="date"]').value || core.todayStr(),
        source: form.querySelector('[name="source"]').value.trim(),
        distanceKm: form.querySelector('[name="distanceKm"]').value===''? null : Number(form.querySelector('[name="distanceKm"]').value),
        enteredBy: core.currentUser? core.currentUser.email : (core.DEMO_MODE? 'زائر تجريبي':'محلي'),
      }};
      await core.persistIfRecord(COMPARABLES_COLLECTION, rec);
      core.render();
      return true;
    }
    if(action==='comps-delete'){
      await core.deleteIfRecord(COMPARABLES_COLLECTION, el.dataset.id);
      core.render();
      return true;
    }
    return false;
  });
}
