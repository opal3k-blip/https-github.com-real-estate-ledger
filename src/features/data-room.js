/* =========================================================================
   غرفة البيانات — Data Room (Phase 3، النظام الثامن والأخير)
   ---------------------------------------------------------------------------
   بيانات وصفية (Metadata) لمستندات كل فرصة — بلا تخزين ملفات فعلية (لا يوجد
   Firebase Storage مُهيَّأ لهذا المشروع، وإضافته قرار منفصل يحتاج تفعيلاً
   وتكلفة إضافية) — بل اسم المستند + الفئة + نوع الملف + رابط خارجي اختياري
   (مكان الملف الفعلي: Google Drive/SharePoint/إلخ) + ملاحظات + من أضافه ومتى.
   هذا يطابق حرفياً طلب المستخدم: "Data Room (per-opportunity document
   metadata)". يُخزَّن داخل بيانات الفرصة نفسها (dataRoom.documents، قاموس
   مفتاحه معرّف المستند الفعلي المُولَّد عند الإضافة — لا افتراضات مسبقة،
   فلا خطر من إعادة توليد withDefaults() كما هو موثَّق في due-diligence.js).
   لا تعديل على منطق core.js الداخلي.
   ========================================================================= */

const CATEGORIES = [
  { key:'legal',      ar:'قانونية',        en:'Legal' },
  { key:'technical',  ar:'فنية/هندسية',    en:'Technical / Engineering' },
  { key:'financial',  ar:'مالية',          en:'Financial' },
  { key:'marketing',  ar:'تسويقية',        en:'Marketing' },
  { key:'correspondence', ar:'مراسلات',    en:'Correspondence' },
  { key:'other',      ar:'أخرى',           en:'Other' },
];
const CAT_BY_KEY = Object.fromEntries(CATEGORIES.map(c=>[c.key,c]));

export function registerDataRoom(core){
  core.registerOpportunitySchemaExtender(()=>({
    dataRoom: { documents: {} }, // { [docId]: {name, category, fileType, link, sizeNote, notes, uploadedBy, uploadedAt} }
  }));

  core.registerDetailSection((d, c)=>{
    const oppId = core.openDetailId;
    const rec = core.opportunities.find(o=>o.id===oppId);
    if(!rec) return '';
    const canEdit = core.canEditOpp(rec);
    const docs = Object.entries((d.dataRoom && d.dataRoom.documents) || {}).sort((a,b)=> (b[1].uploadedAt||'').localeCompare(a[1].uploadedAt||''));

    return `
    <div class="section">
      <h3>🗂️ ${core.T('غرفة البيانات','Data Room')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(${docs.length} ${core.T('مستنداً','document(s)')})</span></h3>
      <div class="tablewrap"><table class="db" style="font-size:11.5px;">
        <thead><tr>
          <th>${core.T('الاسم','Name')}</th><th>${core.T('الفئة','Category')}</th><th>${core.T('النوع','Type')}</th>
          <th>${core.T('الرابط','Link')}</th><th>${core.T('أضافه','Uploaded by')}</th><th>${core.T('التاريخ','Date')}</th>${canEdit?'<th></th>':''}
        </tr></thead>
        <tbody>
          ${docs.length? docs.map(([id,doc])=>`<tr>
            <td>${core.esc(doc.name||'—')}${doc.notes? `<div style="font-size:10.5px; color:var(--ink-faint);">${core.esc(doc.notes)}</div>`:''}</td>
            <td>${CAT_BY_KEY[doc.category]? core.T(CAT_BY_KEY[doc.category].ar,CAT_BY_KEY[doc.category].en) : (doc.category||'—')}</td>
            <td class="mono">${core.esc(doc.fileType||'—')}</td>
            <td>${doc.link? `<a href="${core.esc(doc.link)}" target="_blank" rel="noopener" style="color:var(--accent, #3b82f6);">🔗 ${core.T('فتح','Open')}</a>` : '—'}</td>
            <td style="font-size:11px;">${core.esc(doc.uploadedBy||'—')}</td>
            <td class="mono">${core.esc(doc.uploadedAt||'—')}</td>
            ${canEdit? `<td><button class="btn btn-sm btn-ghost" data-action="dr-delete" data-id="${oppId}" data-doc="${id}">🗑️</button></td>`:''}
          </tr>`).join('') : `<tr><td colspan="${canEdit?7:6}" style="text-align:center; color:var(--ink-faint); padding:16px;">${core.T('لا توجد مستندات مسجَّلة بعد','No documents recorded yet')}</td></tr>`}
        </tbody>
      </table></div>
      ${canEdit? `
      <div style="background:var(--surface-2); border:1px dashed var(--border); border-radius:10px; padding:12px; margin-top:10px;">
        <p class="step-sub" style="margin:0 0 10px;">${core.T('إضافة مستند جديد','Add a new document')}</p>
        <form data-dr-form="${oppId}" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px,1fr)); gap:8px;">
          <input type="text" name="name" placeholder="${core.T('اسم المستند','Document name')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <select name="category" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
            ${CATEGORIES.map(cat=>`<option value="${cat.key}">${core.T(cat.ar,cat.en)}</option>`).join('')}
          </select>
          <input type="text" name="fileType" placeholder="${core.T('نوع الملف (PDF/XLSX...)','File type (PDF/XLSX...)')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="url" name="link" placeholder="${core.T('رابط الملف (Drive/SharePoint...)','File link (Drive/SharePoint...)')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
          <input type="text" name="notes" placeholder="${core.T('ملاحظات (اختياري)','Notes (optional)')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
        </form>
        <button type="button" class="btn btn-sm btn-primary" style="margin-top:8px;" data-action="dr-add" data-id="${oppId}">➕ ${core.T('إضافة','Add')}</button>
      </div>
      <p class="note" style="margin:8px 0 0;">${core.T('ملاحظة: هذه بيانات وصفية فقط (اسم/فئة/رابط) — لا يوجد تخزين ملفات فعلي داخل التطبيق حالياً؛ الرابط يوجّه لمكان الملف الحقيقي (Drive/SharePoint وغيرها).','Note: metadata only (name/category/link) — no actual file storage inside the app yet; the link points to where the real file lives (Drive/SharePoint, etc.).')}</p>
      ` : ''}
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='dr-add'){
      const oppId = el.dataset.id;
      const form = document.querySelector(`form[data-dr-form="${oppId}"]`);
      if(!form) return true;
      const rec = core.opportunities.find(o=>o.id===oppId);
      if(!rec || !core.canEditOpp(rec)) return true;
      const name = form.querySelector('[name="name"]').value.trim();
      if(!name) return true;

      const draft = core.withDefaults(rec.data);
      const docs = draft.dataRoom.documents || (draft.dataRoom.documents = {});
      const docId = core.uid('DOC');
      docs[docId] = {
        name,
        category: form.querySelector('[name="category"]').value,
        fileType: form.querySelector('[name="fileType"]').value.trim(),
        link: form.querySelector('[name="link"]').value.trim(),
        notes: form.querySelector('[name="notes"]').value.trim(),
        uploadedBy: core.currentUser? core.currentUser.email : (core.DEMO_MODE? 'زائر تجريبي':'محلي'),
        uploadedAt: core.todayStr(),
      };
      draft.meta.updatedAt = core.todayStr();
      draft.meta.updatedBy = docs[docId].uploadedBy;

      await core.persistOpportunity({ id: oppId, data: draft });
      await core.loadAll();
      core.render();
      return true;
    }
    if(action==='dr-delete'){
      const oppId = el.dataset.id;
      const docId = el.dataset.doc;
      const rec = core.opportunities.find(o=>o.id===oppId);
      if(!rec || !core.canEditOpp(rec)) return true;

      const draft = core.withDefaults(rec.data);
      if(draft.dataRoom && draft.dataRoom.documents) delete draft.dataRoom.documents[docId];
      draft.meta.updatedAt = core.todayStr();
      draft.meta.updatedBy = core.currentUser? core.currentUser.email : (draft.meta.updatedBy||null);

      await core.persistOpportunity({ id: oppId, data: draft });
      await core.loadAll();
      core.render();
      return true;
    }
    return false;
  });
}
