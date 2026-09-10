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
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

function safeHttpUrl(value){
  try{
    const url = new URL(value);
    return url.protocol==='https:' || url.protocol==='http:' ? url.href : '';
  }catch(e){ return ''; }
}
function isImageDocument(doc){
  return (doc.fileType||'').toLowerCase().startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)$/i.test(doc.name||'');
}

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
    const media = docs.filter(([,doc])=>isImageDocument(doc) && safeHttpUrl(doc.link));

    return `
    <div class="section">
      <h3>🗂️ ${core.T('غرفة البيانات','Data Room')} <span style="color:var(--ink-faint); font-weight:500; font-size:12px;">(${docs.length} ${core.T('مستنداً','document(s)')})</span></h3>
      ${media.length? `
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; margin:0 0 14px;">
        ${media.map(([,doc])=>`<a href="${core.esc(safeHttpUrl(doc.link))}" target="_blank" rel="noopener" style="display:block; color:inherit; text-decoration:none; border:1px solid var(--border); border-radius:9px; overflow:hidden; background:var(--surface-2);">
          <img src="${core.esc(safeHttpUrl(doc.link))}" alt="${core.esc(doc.name||'Technical render')}" style="display:block; width:100%; height:105px; object-fit:cover; background:#edf0ef;">
          <span style="display:block; padding:6px 8px; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🖼️ ${core.esc(doc.name||'—')}</span>
        </a>`).join('')}
      </div>` : ''}
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
            <td>${safeHttpUrl(doc.link)? `<a href="${core.esc(safeHttpUrl(doc.link))}" target="_blank" rel="noopener" style="color:var(--accent, #3b82f6);">🔗 ${core.T('فتح','Open')}</a>` : '—'}</td>
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
        <button type="button" class="btn btn-sm btn-primary" style="margin-top:8px;" data-action="dr-add" data-id="${oppId}">➕ ${core.T('إضافة رابط','Add link')}</button>
      </div>
      <div style="background:var(--surface-2); border:1px dashed var(--border); border-radius:10px; padding:12px; margin-top:10px;">
        <p class="step-sub" style="margin:0 0 8px;">🖼️ ${core.T('رفع رندر أو صورة أو ملف PDF فني','Upload a render, image, or technical PDF')}</p>
        <input id="dr-file-${core.esc(oppId)}" type="file" accept="image/*,application/pdf" style="max-width:100%; font-family:inherit;">
        <button type="button" class="btn btn-sm btn-primary" style="margin-inline-start:8px;" data-action="dr-upload" data-id="${oppId}">☁️ ${core.T('رفع وحفظ في ملف الفرصة','Upload to opportunity')}</button>
        <p class="hint" style="margin:8px 0 0;">${core.T('يدعم الصور (PNG/JPG/WebP...) وPDF حتى 10 MB. ستظهر الصور تلقائياً في معرض هذه الفرصة؛ أما المخططات الفنية التفصيلية فأضف وصفها في حقل الملاحظات أو أرفقها كـPDF.','Supports images (PNG/JPG/WebP...) and PDFs up to 10 MB. Images automatically appear in this opportunity gallery; add technical detail in Notes or attach it as a PDF.')}</p>
      </div>
      <p class="note" style="margin:8px 0 0;">${core.T('يمكنك أيضاً استخدام رابط خارجي من Google Drive أو SharePoint. الملفات المرفوعة هنا تُخزَّن في Firebase Storage الخاصة بالمشروع وتتطلب تسجيل الدخول لفتحها.','You can also use an external Google Drive or SharePoint link. Files uploaded here are stored in the project Firebase Storage and require sign-in to open.')}</p>
      ` : ''}
    </div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='dr-upload'){
      const oppId = el.dataset.id;
      const rec = core.opportunities.find(o=>o.id===oppId);
      const input = document.getElementById(`dr-file-${oppId}`);
      const file = input && input.files && input.files[0];
      if(!rec || !core.canEditOpp(rec)) return true;
      if(!file){ alert(core.T('اختر صورة أو ملف PDF أولاً.','Choose an image or PDF first.')); return true; }
      if(file.size>MAX_MEDIA_BYTES){ alert(core.T('حجم الملف أكبر من 10 MB.','The file is larger than 10 MB.')); return true; }
      if(!(file.type.startsWith('image/') || file.type==='application/pdf')){
        alert(core.T('نوع الملف غير مدعوم. ارفع صورة أو PDF فقط.','Unsupported file type. Upload an image or PDF only.'));
        return true;
      }
      if(!(window.firebase && window.firebase.storage)){
        alert(core.T('خدمة رفع الملفات لم تُحمّل. أعد فتح الصفحة وتحقق من اتصال الإنترنت.','File upload service did not load. Refresh the page and check your connection.'));
        return true;
      }
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const path = `opportunity-media/${oppId}/${Date.now()}-${cleanName}`;
      try{
        const ref = window.firebase.storage().ref().child(path);
        const snapshot = await ref.put(file, { contentType:file.type });
        const link = await snapshot.ref.getDownloadURL();
        const draft = core.withDefaults(rec.data);
        const docs = draft.dataRoom.documents || (draft.dataRoom.documents = {});
        const docId = core.uid('DOC');
        docs[docId] = {
          name:file.name, category:'technical', fileType:file.type, link, storagePath:path,
          sizeNote:(file.size/1024/1024).toFixed(2)+' MB',
          notes:core.T('ملف مرفوع إلى Firebase Storage','Uploaded to Firebase Storage'),
          uploadedBy:core.currentUser?core.currentUser.email:(core.DEMO_MODE?'زائر تجريبي':'محلي'),
          uploadedAt:core.todayStr(),
        };
        draft.meta.updatedAt = core.todayStr();
        draft.meta.updatedBy = docs[docId].uploadedBy;
        await core.persistOpportunity({ id:oppId, data:draft });
        await core.loadAll();
        core.render();
      }catch(e){
        console.error('Firebase Storage upload failed:',e);
        alert(core.T('تعذّر رفع الملف. تحقق من تسجيل الدخول ومن تفعيل Firebase Storage وقواعده.','Could not upload the file. Check sign-in, Firebase Storage activation, and its rules.'));
      }
      return true;
    }
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
      const doc = draft.dataRoom && draft.dataRoom.documents && draft.dataRoom.documents[docId];
      // حذف الملف في Storage قبل حذف بياناته الوصفية: لو رُفض الحذف سحابياً لا
      // نخفي السجل من الواجهة ونترك ملفاً يتيماً لا يمكن الوصول إليه لاحقاً.
      if(doc && doc.storagePath){
        try{
          if(!(window.firebase && window.firebase.storage)) throw new Error('Firebase Storage is unavailable');
          await window.firebase.storage().ref().child(doc.storagePath).delete();
        }catch(e){
          console.error('Firebase Storage delete failed:', e);
          alert(core.T('تعذّر حذف الملف السحابي؛ لم يُحذف السجل. تحقق من الصلاحيات ثم أعد المحاولة.','Could not delete the cloud file; its record was kept. Check permissions and try again.'));
          return true;
        }
      }
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
