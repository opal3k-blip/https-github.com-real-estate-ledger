/* =========================================================================
   سجل عقود الإيجار التفصيلي (Rent Roll) — المرحلة ٦، النظام الثاني
   ---------------------------------------------------------------------------
   طلب المستخدم — نقطة قوة Argus الأساسية التي لا يوفّرها نموذجنا الحالي: بدل
   نسبة إشغال/إيجار إجمالية واحدة (income.occupancy/income.rent)، سجل عقود
   إيجار فردي — عقد بعقد، بتاريخ انتهاء وتصاعد إيجار وتصنيف ائتماني للمستأجر —
   يرفع دقة WALE وتركّز المستأجرين وجدول مخاطر التجديد (Rollover Risk) بشكل
   جوهري عن الافتراض الإجمالي المُدخَل يدوياً.

   **لا يُغيِّر أي حساب فعلي في core.js** — income.wale/income.tenantConc
   المُدخَلان يدوياً يبقيان هما ما يُستخدَم في compute() كما هو تماماً (بلا أي
   تعديل على core.js). هذا الملف يضيف سجلاً تفصيلياً اختيارياً بجانبهما، يحسب
   القيم المكافئة من العقود الفعلية (WALE محسوب/تركّز محسوب) كـ"تحقّق تصالبي"
   (Cross-check) معلوماتي بحت يقارنها بالقيمة المُدخَلة يدوياً — تماماً بفلسفة
   priceCrosscheck في benchmark-engine.js لكن هنا بين "افتراض مُدخَل" و"واقع
   تفصيلي مُدخَل".

   البيانات: حقل جذر جديد بالكامل (`rentRoll.leases`، مصفوفة) عبر
   registerOpportunitySchemaExtender — يُحفَظ داخل وثيقة الفرصة نفسها (لا
   مجموعة Firestore منفصلة، بنفس نمط evidence-tracking.js تماماً: بيانات
   عملياتية خاصة بفرصة واحدة، لا مرجعاً مشتركاً بين الفريق) — فلا حاجة لأي
   قاعدة Firestore جديدة (تُحمى بقاعدة opportunities الموجودة أصلاً). الصلاحية:
   core.canEditOpp(rec) — نفس صلاحية تعديل الفرصة نفسها، لا canManageLibraries
   (هذه بيانات صفقة لا مكتبة مرجعية للفريق).
   ========================================================================= */

const LEASES_PATH = 'rentRoll.leases';

/* أيام/سنوات متبقية من عقد اعتباراً من تاريخ اليوم (todayStr، YYYY-MM-DD) —
   عقد منتهٍ فعلاً (leaseEnd <= اليوم) يُستبعَد من حسابات WALE (لا "سنوات
   متبقية سالبة" منطقياً). دالة نقية. */
function yearsRemaining(leaseEnd, todayStr){
  if(!leaseEnd) return null;
  const end = new Date(leaseEnd+'T00:00:00').getTime();
  const today = new Date(todayStr+'T00:00:00').getTime();
  if(isNaN(end) || isNaN(today)) return null;
  const yrs = (end-today)/86400000/365;
  return yrs>0? yrs : 0;
}

/* WALE محسوب من العقود الفعلية — مُرجَّح بالإيجار السنوي (المعيار المؤسسي
   القياسي: WALE by Income، لا by Area) على العقود السارية فقط. */
export function computeWaleFromLeases(leases, todayStr){
  const active = (leases||[]).filter(l=> l.leaseEnd && (l.rentAnnual||0)>0 && yearsRemaining(l.leaseEnd, todayStr) > 0);
  if(!active.length) return null;
  const totalRent = active.reduce((s,l)=> s+(l.rentAnnual||0), 0);
  if(totalRent<=0) return null;
  const weighted = active.reduce((s,l)=> s + (l.rentAnnual||0)*yearsRemaining(l.leaseEnd, todayStr), 0);
  return weighted/totalRent;
}

/* تركّز أكبر مستأجر محسوب — أكبر عقد منفرد (برته الإيجار السنوي) ÷ إجمالي
   الإيجار السنوي لكل العقود السارية. */
export function computeTenantConcentration(leases){
  const active = (leases||[]).filter(l=>(l.rentAnnual||0)>0);
  if(!active.length) return null;
  const total = active.reduce((s,l)=> s+(l.rentAnnual||0), 0);
  if(total<=0) return null;
  const maxRent = Math.max(...active.map(l=>l.rentAnnual||0));
  return maxRent/total;
}

/* إجمالي المساحة المؤجَّرة المُسجَّلة في السجل التفصيلي (مجموع GLA لكل عقد). */
export function sumLeasesGLA(leases){
  return (leases||[]).reduce((s,l)=> s+(l.gla||0), 0);
}

/* جدول مخاطر التجديد (Rollover Risk) — تجميع العقود حسب سنة الانتهاء، مع نسبة
   كل سنة من إجمالي الإيراد السنوي الحالي لكل العقود السارية. مُرتَّب زمنياً. */
export function expirationScheduleByYear(leases, todayStr){
  const active = (leases||[]).filter(l=> l.leaseEnd && (l.rentAnnual||0)>0 && yearsRemaining(l.leaseEnd, todayStr) > 0);
  const totalRent = active.reduce((s,l)=> s+(l.rentAnnual||0), 0);
  const buckets = {};
  active.forEach(l=>{
    const yr = l.leaseEnd.slice(0,4);
    if(!buckets[yr]) buckets[yr] = { year:yr, count:0, rent:0 };
    buckets[yr].count += 1;
    buckets[yr].rent += (l.rentAnnual||0);
  });
  return Object.values(buckets).sort((a,b)=> a.year.localeCompare(b.year))
    .map(b=> ({ ...b, pctOfRent: totalRent>0? b.rent/totalRent : 0 }));
}

function fmtDate(core, s){ return s? core.esc(s) : '—'; }

function leaseRow(core, l, canEdit){
  return `<tr>
    <td style="font-size:11px;">${core.esc(l.tenantName||'—')}</td>
    <td style="font-size:11px;">${core.esc(l.unit||'—')}</td>
    <td class="num mono" style="font-size:11px;">${l.gla!=null? core.fmtNum(l.gla) : '—'}</td>
    <td class="num mono" style="font-size:11px;">${l.rentAnnual!=null? core.fmtSAR(l.rentAnnual) : '—'}</td>
    <td class="mono" style="font-size:10.5px;">${fmtDate(core,l.leaseStart)}</td>
    <td class="mono" style="font-size:10.5px;">${fmtDate(core,l.leaseEnd)}</td>
    <td class="num mono" style="font-size:11px;">${l.escalationPct!=null? core.fmtPct(l.escalationPct,1) : '—'}</td>
    <td style="font-size:10.5px;">${core.esc(l.creditTier||'—')}</td>
    <td>${canEdit? `<button class="btn btn-sm btn-ghost" data-action="rentroll-delete-lease" data-id="${core.esc(l.id)}">🗑️</button>` : ''}</td>
  </tr>`;
}

export function registerRentRoll(core){
  core.registerOpportunitySchemaExtender(()=>({ rentRoll: { leases: [] } }));

  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec) return '';
    // ذو صلة أساساً لفرص الدخل التأجيري — لكن نعرضه أيضاً لو وُجدت عقود مُسجَّلة فعلاً (مثلاً فرصة
    // مختلطة بجزء مؤجَّر) حتى لا نخفي بيانات مُدخَلة فعلاً عن مستخدمها.
    const leases = (d.rentRoll && d.rentRoll.leases) || [];
    if(d.meta.oppType!=='income' && !leases.length) return '';
    const canEdit = core.canEditOpp(rec);
    const today = core.todayStr ? core.todayStr() : new Date().toISOString().slice(0,10);

    const waleComputed = computeWaleFromLeases(leases, today);
    const concComputed = computeTenantConcentration(leases);
    const glaComputed = sumLeasesGLA(leases);
    const schedule = expirationScheduleByYear(leases, today);

    const waleEntered = d.income? d.income.wale : null;
    const concEntered = d.income? d.income.tenantConc : null;
    const glaEntered = d.income? d.income.gla : null;

    function crosscheckRow(labelAr, labelEn, entered, computed, fmt){
      if(computed==null) return '';
      const diff = (entered!=null)? Math.abs(entered-computed) : null;
      const flag = diff!=null && diff > (fmt==='pct'? 0.10 : entered*0.15+0.001);
      return `<div class="li">${core.T(labelAr,labelEn)}
        <b>${fmt==='pct'? core.fmtPct(computed,1) : core.fmtNum(computed)} <span style="font-size:10px; color:var(--ink-faint); font-weight:400;">(${core.T('مُدخَل','entered')}: ${entered!=null? (fmt==='pct'?core.fmtPct(entered,1):core.fmtNum(entered)) : '—'})</span></b>
        ${flag? `<div style="font-size:10px; color:var(--warn); margin-top:2px;">⚠️ ${core.T('فرق ملموس عن القيمة المُدخَلة يدوياً — راجع التحديث','Noticeable gap vs. the manually entered value — worth updating')}</div>` : ''}
      </div>`;
    }

    return `
    <div class="section">
      <h3>🧾 ${core.T('سجل عقود الإيجار التفصيلي (Rent Roll)','Detailed Rent Roll')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">— ${leases.length} ${core.T('عقداً مُسجَّلاً','leases recorded')}</span></h3>

      ${leases.length? `
      <div class="livebox"><div class="lg">
        ${crosscheckRow('WALE محسوب من العقود الفعلية','WALE computed from actual leases', waleEntered, waleComputed, 'num')}
        ${crosscheckRow('تركّز أكبر مستأجر محسوب','Computed largest-tenant concentration', concEntered, concComputed, 'pct')}
        ${crosscheckRow('إجمالي GLA من السجل التفصيلي','Total GLA from the detailed record', glaEntered, glaComputed, 'num')}
      </div></div>
      <p class="note" style="margin:6px 0 12px; font-size:11px;">${core.T('محسوبة من العقود المُسجَّلة أدناه فقط — لا تُغيِّر القيم اليدوية المُدخَلة في خطوة "الإيراد والخروج" (income.wale/tenantConc/gla)، وهي التي تدخل فعلياً في حساب IRR/MOIC. أضِف/حدِّث السجل التفصيلي كي تبقى المقارنة ذات معنى.','Computed only from the leases recorded below — does not change the manually entered values in the "Revenue & Exit" step (income.wale/tenantConc/gla), which are what actually feed IRR/MOIC. Keep the detailed record updated for this comparison to stay meaningful.')}</p>

      ${schedule.length? `
      <p class="step-sub" style="margin:0 0 6px;">📅 ${core.T('جدول مخاطر التجديد (انتهاء العقود حسب السنة)','Rollover risk schedule (lease expirations by year)')}</p>
      <div class="tablewrap"><table class="db" style="font-size:11px; margin-bottom:12px;">
        <thead><tr><th>${core.T('السنة','Year')}</th><th>${core.T('عدد العقود المنتهية','Leases expiring')}</th><th>${core.T('الإيجار المرتبط','Associated rent')}</th><th>${core.T('% من إجمالي الإيراد الحالي','% of current total rent')}</th></tr></thead>
        <tbody>${schedule.map(s=>`<tr>
          <td class="mono">${core.esc(s.year)}</td><td class="num">${s.count}</td><td class="num mono">${core.fmtSAR(s.rent)}</td>
          <td class="num mono" style="${s.pctOfRent>0.3? 'color:var(--warn); font-weight:700;' : ''}">${core.fmtPct(s.pctOfRent,0)}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : ''}` : `<p class="note" style="margin-bottom:12px;">${core.T('لا توجد عقود مُسجَّلة بعد — أضِف العقود أدناه لرفع دقة WALE وتركّز المستأجرين عن الافتراض الإجمالي اليدوي.','No leases recorded yet — add leases below to raise the accuracy of WALE and tenant concentration beyond the manual aggregate assumption.')}</p>`}

      <div class="tablewrap"><table class="db" style="font-size:11px;">
        <thead><tr>
          <th>${core.T('المستأجر','Tenant')}</th><th>${core.T('الوحدة','Unit')}</th><th>${core.T('المساحة (GLA)','GLA')}</th>
          <th>${core.T('الإيجار السنوي','Annual rent')}</th><th>${core.T('بداية العقد','Start')}</th><th>${core.T('نهاية العقد','End')}</th>
          <th>${core.T('التصاعد السنوي','Annual escalation')}</th><th>${core.T('التصنيف الائتماني','Credit tier')}</th><th></th>
        </tr></thead>
        <tbody>
          ${leases.map(l=>leaseRow(core,l,canEdit)).join('')}
          ${!leases.length? `<tr><td colspan="9" style="text-align:center; padding:12px; color:var(--ink-faint);">—</td></tr>` : ''}
        </tbody>
      </table></div>

      ${canEdit? `
      <div class="section" style="margin-top:10px; background:var(--surface-2); border:1px dashed var(--border);">
        <p class="step-sub" style="margin:0 0 8px;">➕ ${core.T('إضافة عقد إيجار جديد','Add a new lease')}</p>
        <form id="rentroll-add-form" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px,1fr)); gap:8px;">
          <input type="text" name="tenantName" placeholder="${core.T('اسم المستأجر','Tenant name')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="text" name="unit" placeholder="${core.T('رقم الوحدة/المحل','Unit/suite')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="number" name="gla" placeholder="${core.T('المساحة (م²)','GLA (m²)')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="number" name="rentAnnual" placeholder="${core.T('الإيجار السنوي (ر.س)','Annual rent (SAR)')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="date" name="leaseStart" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="date" name="leaseEnd" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="number" name="escalationPct" placeholder="${core.T('التصاعد السنوي %','Annual escalation %')}" step="0.1" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <select name="creditTier" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
            <option value="">${core.T('التصنيف الائتماني (اختياري)','Credit tier (optional)')}</option>
            ${Object.keys(core.CREDIT_TIERS||{}).map(k=>`<option value="${core.esc(k)}">${core.esc(k)}</option>`).join('')}
          </select>
          <input type="number" name="renewalOptionYears" placeholder="${core.T('سنوات خيار التجديد','Renewal option (years)')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="text" name="notes" placeholder="${core.T('ملاحظات','Notes')}" style="grid-column:1/-1; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        </form>
        <button type="button" class="btn btn-sm btn-primary" style="margin-top:8px;" data-action="rentroll-add-lease" data-id="${oppId}">➕ ${core.T('إضافة العقد','Add lease')}</button>
      </div>` : ''}
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='rentroll-add-lease'){
      const oppId = el.dataset.id;
      const rec = core.opportunities.find(o=>o.id===oppId);
      if(!rec || !core.canEditOpp(rec)) return true;
      const form = document.getElementById('rentroll-add-form');
      if(!form) return true;
      const g = name => form.querySelector(`[name="${name}"]`).value.trim();
      const tenantName = g('tenantName');
      if(!tenantName) return true;
      const draft = core.withDefaults(rec.data);
      if(!draft.rentRoll) draft.rentRoll = { leases: [] };
      if(!Array.isArray(draft.rentRoll.leases)) draft.rentRoll.leases = [];
      draft.rentRoll.leases.push({
        id: core.uid('LEASE'),
        tenantName, unit: g('unit')||null,
        gla: g('gla')!==''? Number(g('gla')) : null,
        rentAnnual: g('rentAnnual')!==''? Number(g('rentAnnual')) : null,
        leaseStart: g('leaseStart')||null, leaseEnd: g('leaseEnd')||null,
        escalationPct: g('escalationPct')!==''? Number(g('escalationPct'))/100 : null,
        creditTier: g('creditTier')||null,
        renewalOptionYears: g('renewalOptionYears')!==''? Number(g('renewalOptionYears')) : null,
        notes: g('notes')||null,
      });
      await core.persistOpportunity({ id: oppId, data: draft });
      core.render();
      return true;
    }
    if(action==='rentroll-delete-lease'){
      const oppId = core.openDetailId;
      const rec = core.opportunities.find(o=>o.id===oppId);
      if(!rec || !core.canEditOpp(rec)) return true;
      const draft = core.withDefaults(rec.data);
      if(draft.rentRoll && Array.isArray(draft.rentRoll.leases)){
        draft.rentRoll.leases = draft.rentRoll.leases.filter(l=>l.id!==el.dataset.id);
      }
      await core.persistOpportunity({ id: oppId, data: draft });
      core.render();
      return true;
    }
    return false;
  });
}
