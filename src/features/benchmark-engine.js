/* =========================================================================
   مكتبة أوبال المرجعية — OPAL Benchmark Library / Benchmark Engine
   (Phase 3، النظام الثالث)
   ---------------------------------------------------------------------------
   قاعدة بيانات مرجعية مستقلة (مجموعة عامة عبر core.registerDataCollection،
   بنفس نمط comparables.js) لمعايير السوق مصنَّفة حسب المدينة × نوع الفرصة:
   نطاق IRR، نطاق معدل الرسملة، الحد الأدنى لـDSCR، الحد الأدنى لعائد التكلفة
   (Yield on Cost)، وأسعار مرجعية للإيجار/سعر البيع/تكلفة البناء لكل م² —
   قابلة للإضافة/التحديث يدوياً من لوحة إدارة كاملة (Main View). كل فرصة
   تعرض تلقائياً قسم "الفرصة مقابل المعيار المرجعي" (Your Deal vs Benchmark)
   بمطابقة المدينة+النوع (أو النوع فقط كبديل)، مع تجميع (متوسط/أدنى/أقصى)
   لو وُجد أكثر من سجل مطابق. لا علاقة له بـMARKET_BENCH/USE_TYPES الثابتة
   الموجودة أصلاً في core.js (تلك نصوص عامة أو NIY فقط لفرص الدخل)— هذا نظام
   أوسع وقابل للتحرير من الواجهة دون لمس الكود. لا تعديل على منطق core.js
   الداخلي — فقط عبر نقاط التوسّع المُصدَّرة.
   ========================================================================= */

const BENCH_COLLECTION = 'benchmarks';

function oppTypeOptions(core){
  return Object.keys(core.OPP_TYPE_INFO).map(k=>[core.T(core.OPP_TYPE_INFO[k].t, core.OPP_TYPE_INFO[k].en), k]);
}
function oppTypeLabel(core, key){
  const ti = core.OPP_TYPE_INFO[key];
  return ti? core.T(ti.t, ti.en) : (key||'—');
}
function avg(nums){ const v = nums.filter(n=>n!=null && isFinite(n)); return v.length? v.reduce((a,b)=>a+b,0)/v.length : null; }
function minOf(nums){ const v = nums.filter(n=>n!=null && isFinite(n)); return v.length? Math.min(...v) : null; }
function maxOf(nums){ const v = nums.filter(n=>n!=null && isFinite(n)); return v.length? Math.max(...v) : null; }

function matchBenchmarks(core, city, oppType){
  const all = (core.STORE[BENCH_COLLECTION]||[]).map(r=>r.data);
  const exact = all.filter(b=> b.oppType===oppType && b.city && city && b.city.trim()===city.trim());
  if(exact.length) return { rows: exact, scope: 'exact' };
  const typeOnly = all.filter(b=> b.oppType===oppType);
  if(typeOnly.length) return { rows: typeOnly, scope: 'type' };
  return { rows: [], scope: 'none' };
}
function aggregateBench(rows){
  return {
    irrMin: minOf(rows.map(r=>r.irrMin)), irrMax: maxOf(rows.map(r=>r.irrMax)),
    capRateMin: minOf(rows.map(r=>r.capRateMin)), capRateMax: maxOf(rows.map(r=>r.capRateMax)),
    dscrMin: avg(rows.map(r=>r.dscrMin)),
    yocMin: avg(rows.map(r=>r.yocMin)),
    rentPerM2: avg(rows.map(r=>r.rentPerM2)),
    salePricePerM2: avg(rows.map(r=>r.salePricePerM2)),
    buildCostPerM2: avg(rows.map(r=>r.buildCostPerM2)),
  };
}

export function registerBenchmarkEngine(core){
  core.registerDataCollection(BENCH_COLLECTION);

  core.registerTopbarButton(()=>{
    return `<button class="btn btn-sm" data-action="bench-open">📚 ${core.T('مكتبة أوبال المرجعية','OPAL Benchmark Library')}</button>`;
  });

  core.registerMainView('benchmarks', ()=>{
    const rows = core.STORE[BENCH_COLLECTION] || [];
    return `
    <div class="section" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 style="margin:0;">📚 ${core.T('مكتبة أوبال المرجعية','OPAL Benchmark Library')}</h2>
        <p class="note" style="margin:4px 0 0;">${core.T('عدد السجلات المرجعية','Recorded benchmarks')}: <b>${rows.length}</b></p>
      </div>
      <button class="btn btn-sm btn-ghost" data-action="bench-close">✖ ${core.T('إغلاق ورجوع للوحة الفرص','Close & return to dashboard')}</button>
    </div>

    <div class="section" style="margin-bottom:14px; background:var(--surface-2); border:1px dashed var(--border);">
      <p class="step-sub" style="margin:0 0 10px;">${core.T('إضافة معيار مرجعي جديد','Add a new benchmark')}</p>
      <form id="bench-add-form" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px,1fr)); gap:8px;">
        <input type="text" name="city" placeholder="${core.T('المدينة','City')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <select name="oppType" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          ${oppTypeOptions(core).map(([l,v])=>`<option value="${v}">${l}</option>`).join('')}
        </select>
        <input type="text" name="label" placeholder="${core.T('وصف/استراتيجية (اختياري)','Label / strategy (optional)')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="irrMinPct" placeholder="IRR ${core.T('أدنى %','min %')}" step="0.1" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="irrMaxPct" placeholder="IRR ${core.T('أقصى %','max %')}" step="0.1" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="capRateMinPct" placeholder="Cap Rate ${core.T('أدنى %','min %')}" step="0.1" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="capRateMaxPct" placeholder="Cap Rate ${core.T('أقصى %','max %')}" step="0.1" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="dscrMin" placeholder="DSCR min ×" step="0.01" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="yocMinPct" placeholder="Yield on Cost ${core.T('أدنى %','min %')}" step="0.1" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="rentPerM2" placeholder="${core.T('الإيجار/م² مرجعي','Ref. rent/m²')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="salePricePerM2" placeholder="${core.T('سعر البيع/م² مرجعي','Ref. sale price/m²')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="number" name="buildCostPerM2" placeholder="${core.T('تكلفة البناء/م² مرجعية','Ref. build cost/m²')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        <input type="text" name="source" placeholder="${core.T('المصدر','Source')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
      </form>
      <button type="button" class="btn btn-sm btn-primary" style="margin-top:8px;" data-action="bench-add">➕ ${core.T('إضافة','Add')}</button>
    </div>

    <div class="tablewrap"><table class="db" style="font-size:11.5px;">
      <thead><tr>
        <th>${core.T('المدينة','City')}</th><th>${core.T('النوع','Type')}</th><th>${core.T('الوصف','Label')}</th>
        <th>IRR</th><th>Cap Rate</th><th>DSCR</th><th>YoC</th>
        <th>${core.T('الإيجار/م²','Rent/m²')}</th><th>${core.T('البيع/م²','Sale/m²')}</th><th>${core.T('البناء/م²','Build/m²')}</th>
        <th>${core.T('المصدر','Source')}</th><th></th>
      </tr></thead>
      <tbody>
        ${rows.slice().sort((a,b)=> (a.data.city||'').localeCompare(b.data.city||'')).map(rec=>{
          const b = rec.data;
          return `<tr>
            <td>${core.esc(b.city||'—')}</td><td>${oppTypeLabel(core,b.oppType)}</td><td style="font-size:11px;">${core.esc(b.label||'—')}</td>
            <td class="num mono">${b.irrMin!=null?core.fmtPct(b.irrMin):'—'}–${b.irrMax!=null?core.fmtPct(b.irrMax):'—'}</td>
            <td class="num mono">${b.capRateMin!=null?core.fmtPct(b.capRateMin):'—'}–${b.capRateMax!=null?core.fmtPct(b.capRateMax):'—'}</td>
            <td class="num mono">${b.dscrMin!=null?b.dscrMin.toFixed(2)+'×':'—'}</td>
            <td class="num mono">${b.yocMin!=null?core.fmtPct(b.yocMin):'—'}</td>
            <td class="num mono">${b.rentPerM2!=null?core.fmtSAR(b.rentPerM2):'—'}</td>
            <td class="num mono">${b.salePricePerM2!=null?core.fmtSAR(b.salePricePerM2):'—'}</td>
            <td class="num mono">${b.buildCostPerM2!=null?core.fmtSAR(b.buildCostPerM2):'—'}</td>
            <td style="font-size:11px;">${core.esc(b.source||'—')}</td>
            <td><button class="btn btn-sm btn-ghost" data-action="bench-delete" data-id="${rec.id}">🗑️</button></td>
          </tr>`;
        }).join('') || `<tr><td colspan="11" style="text-align:center; padding:16px;">${core.T('لا توجد معايير مرجعية مسجَّلة بعد','No benchmarks recorded yet')}</td></tr>`}
      </tbody>
    </table></div>`;
  });

  core.registerDetailSection((d, c)=>{
    const { rows, scope } = matchBenchmarks(core, d.meta.city, d.meta.oppType);
    if(!rows.length){
      return `<div class="section">
        <h3>📚 ${core.T('الفرصة مقابل المعيار المرجعي','Your Deal vs. Benchmark')}</h3>
        <p class="note">${core.T('لا يوجد معيار مرجعي مسجَّل بعد لهذه المدينة/النوع — أضِف واحداً من مكتبة أوبال المرجعية.','No benchmark recorded yet for this city/type — add one from the OPAL Benchmark Library.')}</p>
      </div>`;
    }
    const b = aggregateBench(rows);
    const isDev = d.meta.oppType==='development';
    const dealCapRate = isDev? d.development.exitCapRate : d.wacc.marketCap;
    const dealRent = d.meta.oppType==='income'? d.income.rent : null;
    const dealSalePrice = isDev? d.development.salePrice : null;
    const dealBuildCost = isDev? d.development.buildCost : null;

    function statusRow(label, dealVal, fmtFn, benchLabel, belowIsBad, thresholdLo, thresholdHi){
      if(dealVal==null || !isFinite(dealVal)) return '';
      let status = null;
      if(thresholdLo!=null && dealVal < thresholdLo) status = belowIsBad? 'bad' : 'note';
      if(thresholdHi!=null && dealVal > thresholdHi) status = belowIsBad? 'note' : 'bad';
      const color = status==='bad'? 'var(--bad)' : (status===null? 'var(--good, #22c55e)' : 'var(--ink)');
      const icon = status==='bad'? '⚠️' : (status===null? '✅' : 'ℹ️');
      return `<tr>
        <td>${label}</td>
        <td class="num" style="font-weight:700;">${fmtFn(dealVal)}</td>
        <td class="num" style="font-size:11px; color:var(--ink-faint);">${benchLabel}</td>
        <td style="color:${color}; font-weight:700; text-align:center;">${icon}</td>
      </tr>`;
    }

    const rowsHtml = [
      statusRow('Equity IRR', c.equityIRR, v=>core.fmtPct(v), `${b.irrMin!=null?core.fmtPct(b.irrMin):'—'}–${b.irrMax!=null?core.fmtPct(b.irrMax):'—'}`, true, b.irrMin, null),
      statusRow(core.T('معدل الرسملة عند الخروج','Exit Cap Rate'), dealCapRate, v=>core.fmtPct(v), `${b.capRateMin!=null?core.fmtPct(b.capRateMin):'—'}–${b.capRateMax!=null?core.fmtPct(b.capRateMax):'—'}`, false, b.capRateMin, b.capRateMax),
      statusRow('DSCR', c.dscrMin, v=>v.toFixed(2)+'×', b.dscrMin!=null?b.dscrMin.toFixed(2)+'× '+core.T('أدنى','min'):'—', true, b.dscrMin, null),
      statusRow(core.T('عائد التكلفة (Yield on Cost)','Yield on Cost'), c.yieldOnCost, v=>core.fmtPct(v), b.yocMin!=null?core.fmtPct(b.yocMin)+' '+core.T('أدنى','min'):'—', true, b.yocMin, null),
      statusRow(core.T('الإيجار/م²','Rent/m²'), dealRent, v=>core.fmtSAR(v), b.rentPerM2!=null?core.fmtSAR(b.rentPerM2):'—', true, b.rentPerM2!=null? b.rentPerM2*0.85 : null, null),
      statusRow(core.T('سعر البيع/م²','Sale price/m²'), dealSalePrice, v=>core.fmtSAR(v), b.salePricePerM2!=null?core.fmtSAR(b.salePricePerM2):'—', true, b.salePricePerM2!=null? b.salePricePerM2*0.85 : null, null),
      statusRow(core.T('تكلفة البناء/م²','Build cost/m²'), dealBuildCost, v=>core.fmtSAR(v), b.buildCostPerM2!=null?core.fmtSAR(b.buildCostPerM2):'—', false, null, b.buildCostPerM2!=null? b.buildCostPerM2*1.15 : null),
    ].filter(Boolean).join('');

    return `
    <div class="section">
      <h3>📚 ${core.T('الفرصة مقابل المعيار المرجعي','Your Deal vs. Benchmark')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(${rows.length} ${core.T('سجلاً مرجعياً','benchmark record(s)')}${scope==='type'? ' — '+core.T('مطابقة النوع فقط (لا توجد مدينة مطابقة)','type-only match — no matching city') : ''})</span></h3>
      <div class="tablewrap"><table class="db" style="font-size:12px;">
        <thead><tr><th>${core.T('المقياس','Metric')}</th><th>${core.T('فرصتك','Your Deal')}</th><th>${core.T('المعيار المرجعي','Benchmark')}</th><th>${core.T('الحالة','Status')}</th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="4" style="text-align:center; padding:12px;">${core.T('لا توجد مقاييس قابلة للمقارنة','No comparable metrics available')}</td></tr>`}</tbody>
      </table></div>
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='bench-open'){ core.setCoreState({ mainView:'benchmarks', openDetailId:null, render:true }); return true; }
    if(action==='bench-close'){ core.setCoreState({ mainView:null, render:true }); return true; }
    if(action==='bench-add'){
      const form = document.getElementById('bench-add-form');
      if(!form) return true;
      const g = name => { const v = form.querySelector(`[name="${name}"]`).value; return v===''? null : Number(v); };
      const city = form.querySelector('[name="city"]').value.trim();
      const oppType = form.querySelector('[name="oppType"]').value;
      if(!city) return true;
      const rec = { id: core.uid('BMK'), data: {
        city, oppType, label: form.querySelector('[name="label"]').value.trim(),
        irrMin: g('irrMinPct')!=null? g('irrMinPct')/100 : null,
        irrMax: g('irrMaxPct')!=null? g('irrMaxPct')/100 : null,
        capRateMin: g('capRateMinPct')!=null? g('capRateMinPct')/100 : null,
        capRateMax: g('capRateMaxPct')!=null? g('capRateMaxPct')/100 : null,
        dscrMin: g('dscrMin'),
        yocMin: g('yocMinPct')!=null? g('yocMinPct')/100 : null,
        rentPerM2: g('rentPerM2'), salePricePerM2: g('salePricePerM2'), buildCostPerM2: g('buildCostPerM2'),
        source: form.querySelector('[name="source"]').value.trim(),
        enteredBy: core.currentUser? core.currentUser.email : (core.DEMO_MODE? 'زائر تجريبي':'محلي'),
      }};
      await core.persistIfRecord(BENCH_COLLECTION, rec);
      core.render();
      return true;
    }
    if(action==='bench-delete'){
      await core.deleteIfRecord(BENCH_COLLECTION, el.dataset.id);
      core.render();
      return true;
    }
    return false;
  });
}

export { matchBenchmarks, aggregateBench, BENCH_COLLECTION };
