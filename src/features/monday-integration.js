/* =========================================================================
   تكامل Monday.com — Monday.com Integration Layer (إعداد جانب التطبيق فقط)
   ---------------------------------------------------------------------------
   طلب المستخدم: ربط Monday.com بحيث تتركّز ملكية/إسناد المهام على
   saeed@opalco.sa، مع كون حساب/مساحة عمل Monday نفسها مرتبطة بتسجيل دخول
   opal3k@gmail.com (أدمن هذا التطبيق الأول أصلاً — core.ADMIN_EMAILS[0])
   على https://opal3ks-team-company.monday.com، ومستخدم Monday محدَّد بالضبط
   عبر https://opal3ks-team-company.monday.com/users/115387628، بالإضافة إلى
   "لوحة صلاحيات" في Monday تعكس نظام الأدوار الحالي (roles-permissions.js).

   ⚠️ الحاجز الحقيقي (Blocker) المكتشَف: أي استدعاء فعلي لواجهة Monday.com API
   (REST أو GraphQL) يتطلب رمز مصادقة (Personal API Token) أو تسجيل تطبيق
   OAuth (Client ID/Secret) من داخل حساب Monday.com نفسه — لا يوجد أي منهما في
   هذا المستودع، ولا يمكن لأي كود توليدهما أو افتراضهما. هذا التطبيق (index.html
   + src/) صفحة ثابتة بالكامل (Static SPA) تعمل من متصفح العميل مباشرة بلا أي
   خادم HTTP خاص بها (المكوّن الخلفي الوحيد هو Cloud Functions في ../../functions،
   يعمل حالياً بمنطق مختلف تماماً: مراقب Firestore Trigger لسجل التدقيق) — فوضع
   أي رمز API هنا (متغيّر جافاسكريبت، حقل Firestore، أو حتى Local Storage) يعني
   أنه يصبح قابلاً للقراءة من أي شخص يفتح أدوات المطوّر في متصفحه، بصرف النظر عن
   صلاحيات حسابه داخل التطبيق — هذا غير آمن مهما بدا "مخفياً" في الواجهة.

   الحل المعماري المطبَّق هنا (آمن، وقابل للتفعيل لاحقاً بلا إعادة كتابة):
     1. لوحة إعداد للأدمن فقط (لا رمز API فيها إطلاقاً) تُخزِّن فقط بيانات غير
        سرّية: معرّفات لوحات Monday (المهام/الصلاحيات)، وبريد "مالك المهام
        الافتراضي" (saeed@opalco.sa) — مجموعة Firestore mondayConfig.
     2. قائمة انتظار مزامنة (mondayTaskQueue) يكتب فيها العميل طلب "أرسل هذه
        المهمة لـMonday" (مرحلة/إجراء تالٍ من pipeline.js لفرصة معيّنة) بحالة
        pending فقط — العميل لا يتصل بـMonday.com أبداً ولا يعرف حتى عنوان
        API الخاص بها.
     3. دالة سحابية جديدة (../../functions/monday-sync.js، مُسجَّلة في
        functions/index.js) تُشغَّل عند إنشاء أي وثيقة في mondayTaskQueue،
        تقرأ رمز API من Secret Manager التابع لمشروع Firebase نفسه (لا من أي
        مكان قابل للقراءة من العميل) عبر defineSecret('MONDAY_API_TOKEN').
        إن لم يكن الرمز مُعدّاً بعد (وهو غير مُعدّ حالياً — لم يُخترَع هنا أي
        رمز)، تُحدِّث الدالة حالة الطلب إلى blocked_missing_secret بوضوح بدل أي
        محاولة اتصال وهمية أو فاشلة صامتة. راجع ../../functions/README.md
        لخطوات التفعيل الكاملة — تتطلب صلاحية مالك/محرِّر حقيقية على مشروع
        Firebase (حالياً opal3k@gmail.com / ggocss@gmail.com فقط) لا يملكها
        هذا الكود ولا يمكن لأي جلسة مساعد تنفيذها نيابة عن أحد.

   الحماية الحقيقية في firestore.rules (../../firestore.rules): mondayConfig
   قراءة لأي عضو مصرَّح له، كتابة للأدمن فقط (نفس نمط settings)؛ mondayTaskQueue
   قراءة لأي عضو مصرَّح له، إنشاء لمدير صندوق فأعلى فقط بشرط نزاهة الناشر
   (queuedBy = بريده الحقيقي) وحالة ابتدائية pending فقط، وتعديل/حذف من العميل
   ممنوعان بالكامل (نفس فلسفة oppAuditLog: append-only، لا يُعدِّل حالة المزامنة
   إلا الدالة الخلفية عبر Admin SDK التي تتجاوز هذه القواعد تصميماً).

   لا تعديل هنا على منطق core.js الداخلي — فقط عبر نقاط التوسّع المُصدَّرة:
   registerDataCollection، registerTopbarButton، registerMainView،
   registerDetailSection، registerActionHandler. يستورد canManageRoles/
   canManageLibraries من roles-permissions.js (نفس نمط استيراد الملفات
   الأخرى في هذا المجلد، مذكور في تعليق رأس src/main.js).
   ========================================================================= */

import { canManageRoles, canManageLibraries } from './roles-permissions.js';

const CONFIG_COLLECTION = 'mondayConfig';
const CONFIG_DOC_ID = 'settings';
const QUEUE_COLLECTION = 'mondayTaskQueue';

// معلومات ربط ثابتة وموثَّقة (زوّدنا بها المستخدم) — غير سرّية إطلاقاً، لا تحتوي أي رمز API.
const MONDAY_WORKSPACE_URL = 'https://opal3ks-team-company.monday.com';
const MONDAY_ACCOUNT_OWNER_EMAIL = 'opal3k@gmail.com'; // حساب تسجيل الدخول المالك لمساحة عمل Monday (نفس core.ADMIN_EMAILS[0])
const MONDAY_LINKED_USER_PROFILE_URL = 'https://opal3ks-team-company.monday.com/users/115387628'; // ملف مستخدم Monday المرتبط (saeed@opalco.sa بحسب طلب المستخدم)
const DEFAULT_TASK_OWNER_EMAIL = 'saeed@opalco.sa'; // مالك/مُسنَد إليه المهام الافتراضي في Monday

const STATUS_META = {
  pending:                 { ar: 'قيد الانتظار — لم تُرسَل بعد',        en: 'Pending — not sent yet',              color: 'var(--warn)' },
  blocked_missing_secret:  { ar: 'متوقفة — رمز API غير مُعدّ',          en: 'Blocked — API token not configured',  color: 'var(--bad)' },
  blocked_missing_board:   { ar: 'متوقفة — لوحة Monday غير محدَّدة',    en: 'Blocked — Monday board not set',      color: 'var(--bad)' },
  synced:                  { ar: 'أُرسِلت بنجاح',                       en: 'Synced',                              color: 'var(--good)' },
  failed:                  { ar: 'فشلت',                                en: 'Failed',                              color: 'var(--bad)' },
};

function statusBadge(core, status){
  const s = STATUS_META[status] || { ar: status || '—', en: status || '—', color: 'var(--ink-faint)' };
  return `<span class="tag" style="background:var(--surface-3); color:${s.color};">${core.T(s.ar, s.en)}</span>`;
}

function defaultConfig(){
  return {
    enabled: false, // لا يمكن تفعيلها فعلياً من الواجهة أبداً — لا معنى لها قبل نشر دالة الخادم + رمز API حقيقي
    tasksBoardId: '',
    permissionsBoardId: '',
    taskOwnerEmail: DEFAULT_TASK_OWNER_EMAIL,
    notes: '',
  };
}

function currentConfig(core){
  const rec = (core.STORE[CONFIG_COLLECTION] || []).find(r => r.id === CONFIG_DOC_ID);
  return rec ? Object.assign(defaultConfig(), rec.data) : defaultConfig();
}

export function registerMondayIntegration(core){
  core.registerDataCollection(CONFIG_COLLECTION);
  core.registerDataCollection(QUEUE_COLLECTION);

  /* ---------------- زر شريط علوي لفتح لوحة الإعداد (أدمن فقط) ---------------- */
  core.registerTopbarButton(() => {
    if(!canManageRoles(core)) return '';
    return `<button class="btn btn-sm" data-action="monday-open">🔗 Monday.com</button>`;
  });

  /* ---------------- لوحة الإعداد الكاملة (أدمن فقط) ---------------- */
  core.registerMainView('mondayIntegration', () => {
    if(!canManageRoles(core)) return '';
    const cfg = currentConfig(core);
    const queue = (core.STORE[QUEUE_COLLECTION] || []).slice().sort((a, b) => (a.data.queuedAt < b.data.queuedAt) ? 1 : -1);

    return `
    <div class="section" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 style="margin:0;">🔗 ${core.T('تكامل Monday.com', 'Monday.com Integration')}</h2>
        <p class="note" style="margin:4px 0 0;">${core.T('إعداد جانب التطبيق فقط — لا اتصال مباشر من هذا المتصفح بـMonday.com، ولا يُخزَّن أو يُعرَض أي رمز API هنا مطلقاً.', "App-side configuration only — this browser never talks to Monday.com directly, and no API token is ever stored or shown here.")}</p>
      </div>
      <button class="btn btn-sm btn-ghost" data-action="monday-close">✖ ${core.T('إغلاق ورجوع للوحة الفرص', 'Close & return to dashboard')}</button>
    </div>

    <div class="section" style="margin-bottom:14px; background:var(--surface-2); border:1px dashed var(--border);">
      <p class="step-sub" style="margin:0 0 8px; font-weight:700;">${core.T('الربط الحالي (معلومات، غير سرّية)', 'Current linkage (informational, not secret)')}</p>
      <div class="tablewrap"><table class="db" style="font-size:12.5px;">
        <tbody>
          <tr><td>${core.T('مساحة عمل Monday', 'Monday workspace')}</td><td><a href="${MONDAY_WORKSPACE_URL}" target="_blank" rel="noopener">${MONDAY_WORKSPACE_URL}</a></td></tr>
          <tr><td>${core.T('حساب تسجيل الدخول المالك لمساحة العمل', 'Workspace login/owner account')}</td><td class="mono">${core.esc(MONDAY_ACCOUNT_OWNER_EMAIL)}</td></tr>
          <tr><td>${core.T('ملف مستخدم Monday المرتبط', 'Linked Monday user profile')}</td><td><a href="${MONDAY_LINKED_USER_PROFILE_URL}" target="_blank" rel="noopener">${MONDAY_LINKED_USER_PROFILE_URL}</a></td></tr>
          <tr><td>${core.T('مالك المهام الافتراضي', 'Default task owner')}</td><td class="mono">${core.esc(DEFAULT_TASK_OWNER_EMAIL)}</td></tr>
        </tbody>
      </table></div>
    </div>

    <div class="section" style="margin-bottom:14px; background:var(--warn-soft); border:1px solid var(--warn);">
      <p class="step-sub" style="margin:0 0 6px; font-weight:700;">⚠️ ${core.T('لماذا لا توجد مزامنة حية بعد؟', 'Why is there no live sync yet?')}</p>
      <p class="note" style="margin:0;">${core.T(
        'الاتصال الفعلي بـMonday.com يتطلب رمز API أو تسجيل تطبيق OAuth من داخل حساب Monday نفسه — لا يمكن لأي كود اختراعه أو افتراضه، ولا يوجد أي رمز من هذا النوع هنا. لن نطلب منك كتابته في هذه الصفحة أيضاً: أي رمز يُدخَل في متصفح العميل يصبح قابلاً للقراءة من أي شخص يفتح أدوات المطوّر. الحل الآمن الوحيد هو تخزينه في Secret Manager الخاص بمشروع Firebase (من طرف الخادم فقط)، وتُنفِّذ دالة سحابية موثوقة (functions/monday-sync.js) الاتصال الفعلي. راجع functions/README.md لخطوات التفعيل الكاملة — تتطلب صلاحية مالك/محرِّر حقيقية على مشروع Firebase (حالياً opal3k@gmail.com أو ggocss@gmail.com) لا تملكها هذه الجلسة.',
        "A real connection to Monday.com requires an API token or an OAuth app registration from inside the Monday account itself \u2014 no code can invent or assume one, and none exists here. This panel will never ask you to type one in either: any token entered in a client browser becomes readable by anyone opening dev tools. The only safe path is storing it in Firebase's Secret Manager (server-side only), with a trusted Cloud Function (functions/monday-sync.js) making the actual call. See functions/README.md for full activation steps \u2014 they require real owner/editor access on the Firebase project (currently opal3k@gmail.com or ggocss@gmail.com), which this session does not have."
      )}</p>
    </div>

    <div class="section" style="margin-bottom:14px;">
      <p class="step-sub" style="margin:0 0 10px; font-weight:700;">${core.T('إعدادات قابلة للتعديل (أدمن فقط، بلا أي رمز سرّي)', 'Editable settings (admin only, no secrets)')}</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; max-width:640px;">
        <label style="display:flex; flex-direction:column; gap:4px; font-size:12.5px;">
          ${core.T('معرّف لوحة المهام في Monday', 'Monday tasks board ID')}
          <input type="text" id="monday-cfg-tasks-board" value="${core.esc(cfg.tasksBoardId)}" placeholder="${core.T('مثال: 1234567890', 'e.g. 1234567890')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink);">
        </label>
        <label style="display:flex; flex-direction:column; gap:4px; font-size:12.5px;">
          ${core.T('معرّف "لوحة الصلاحيات" في Monday', 'Monday "permissions board" ID')}
          <input type="text" id="monday-cfg-permissions-board" value="${core.esc(cfg.permissionsBoardId)}" placeholder="${core.T('مثال: 1234567891', 'e.g. 1234567891')}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink);">
        </label>
        <label style="display:flex; flex-direction:column; gap:4px; font-size:12.5px;">
          ${core.T('بريد مالك المهام الافتراضي', 'Default task owner email')}
          <input type="text" id="monday-cfg-owner-email" value="${core.esc(cfg.taskOwnerEmail)}" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink);">
        </label>
        <label style="display:flex; align-items:center; gap:8px; font-size:12.5px;">
          <input type="checkbox" ${cfg.enabled ? 'checked' : ''} disabled title="${core.T('لا يمكن تفعيلها من هنا — تصبح فعلية فقط بعد نشر دالة monday-sync الخلفية مع رمز API صالح، راجع functions/README.md', 'Cannot be turned on here \u2014 only becomes real once the backend monday-sync function is deployed with a valid API token, see functions/README.md')}">
          ${core.T('تفعيل المزامنة الفعلية (يتطلب دالة خادم + رمز API)', 'Enable live sync (requires backend function + API token)')}
        </label>
        <label style="display:flex; flex-direction:column; gap:4px; font-size:12.5px; grid-column:1 / -1;">
          ${core.T('ملاحظات', 'Notes')}
          <textarea id="monday-cfg-notes" rows="2" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit;">${core.esc(cfg.notes)}</textarea>
        </label>
      </div>
      <button type="button" class="btn btn-sm btn-primary" style="margin-top:10px;" data-action="monday-save-config">\u{1F4BE} ${core.T('حفظ الإعدادات', 'Save settings')}</button>
    </div>

    <div class="section">
      <p class="step-sub" style="margin:0 0 10px; font-weight:700;">${core.T('قائمة انتظار المزامنة', 'Sync queue')}</p>
      ${queue.length ? `
      <div class="tablewrap"><table class="db" style="font-size:12px;">
        <thead><tr><th>${core.T('الفرصة', 'Opportunity')}</th><th>${core.T('المهمة', 'Task')}</th><th>${core.T('المالك', 'Owner')}</th><th>${core.T('الحالة', 'Status')}</th><th>${core.T('بواسطة', 'Queued by')}</th><th>${core.T('ملاحظة', 'Note')}</th></tr></thead>
        <tbody>
          ${queue.map(q => `<tr>
            <td>${core.esc(q.data.title || q.data.oppId || '')}</td>
            <td>${core.esc(q.data.nextAction || '')}</td>
            <td>${core.esc(q.data.ownerEmail || '')}</td>
            <td>${statusBadge(core, q.data.status)}</td>
            <td>${core.esc(q.data.queuedBy || '')}</td>
            <td style="font-size:11px; color:var(--ink-faint);">${core.esc(q.data.syncNote || '')}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>` : `<p class="note">${core.T('لا توجد أي مهام في قائمة الانتظار بعد.', 'No queued tasks yet.')}</p>`}
    </div>`;
  });

  /* ---------------- قسم داخل تفاصيل كل فرصة: إرسال المهمة الحالية إلى قائمة الانتظار ---------------- */
  core.registerDetailSection((d) => {
    const oppId = core.openDetailId;
    if(!oppId) return '';
    const cfg = currentConfig(core);
    const canQueue = canManageLibraries(core);
    const pipeline = d.pipeline || {};
    const queued = (core.STORE[QUEUE_COLLECTION] || []).filter(q => q.data.oppId === oppId).slice().sort((a, b) => (a.data.queuedAt < b.data.queuedAt) ? 1 : -1);

    return `
    <div class="section">
      <h3>\u{1F517} ${core.T('مزامنة المهام مع Monday.com', 'Monday.com Task Sync')}</h3>
      <p class="note">${core.T(
        'يضيف المرحلة/الإجراء التالي الحاليين لهذه الفرصة إلى قائمة انتظار آمنة (Firestore) — لا اتصال مباشر بـMonday.com من هذا المتصفح أبداً؛ تُرسَل المهمة فعلياً فقط بعد نشر دالة خادم موثوقة برمز API معتمد من مالك الحساب.',
        "Adds this opportunity's current stage / next action to a secure sync queue (Firestore) \u2014 this browser never contacts Monday.com directly; the task is only actually pushed once a trusted server function is deployed with an owner-provisioned API token."
      )}</p>
      <div class="tablewrap"><table class="db" style="font-size:12px;">
        <tbody>
          <tr><td>${core.T('المرحلة الحالية', 'Current stage')}</td><td>${core.esc(pipeline.stage || '—')}</td></tr>
          <tr><td>${core.T('الإجراء التالي', 'Next action')}</td><td>${core.esc(pipeline.nextAction || '—')}</td></tr>
          <tr><td>${core.T('الموعد النهائي', 'Deadline')}</td><td>${core.esc(pipeline.nextActionDeadline || '—')}</td></tr>
          <tr><td>${core.T('مالك المهمة في Monday', 'Monday task owner')}</td><td class="mono">${core.esc(cfg.taskOwnerEmail || DEFAULT_TASK_OWNER_EMAIL)}</td></tr>
        </tbody>
      </table></div>
      ${canQueue ? `<button type="button" class="btn btn-sm" style="margin-top:8px;" data-action="monday-queue-task" data-opp="${core.esc(oppId)}">\u{1F4CC} ${core.T('إرسال إلى قائمة انتظار Monday', 'Queue to Monday')}</button>` : `<p class="note" style="margin-top:8px;">${core.T('يتطلب دور مدير صندوق فأعلى.', 'Requires Fund Manager tier or above.')}</p>`}
      ${queued.length ? `
      <div style="display:flex; flex-direction:column; gap:6px; margin-top:10px;">
        ${queued.map(q => `<div style="font-size:11.5px; padding:6px 8px; border:1px solid var(--border); border-radius:6px;">
          ${statusBadge(core, q.data.status)} \u00B7 ${core.esc(q.data.queuedBy || '')} ${q.data.syncNote ? '\u2014 ' + core.esc(q.data.syncNote) : ''}
        </div>`).join('')}
      </div>` : ''}
    </div>`;
  });

  /* ---------------- معالِجات الإجراءات ---------------- */
  core.registerActionHandler(async (action, el) => {
    if(action === 'monday-open'){
      if(!canManageRoles(core)) return true;
      core.setCoreState({ mainView: 'mondayIntegration', openDetailId: null, render: true });
      return true;
    }
    if(action === 'monday-close'){
      core.setCoreState({ mainView: null, render: true });
      return true;
    }
    if(action === 'monday-save-config'){
      if(!canManageRoles(core)) return true;
      const tasksBoardEl = document.getElementById('monday-cfg-tasks-board');
      const permissionsBoardEl = document.getElementById('monday-cfg-permissions-board');
      const ownerEmailEl = document.getElementById('monday-cfg-owner-email');
      const notesEl = document.getElementById('monday-cfg-notes');
      const rec = { id: CONFIG_DOC_ID, data: {
        enabled: false, // لا تُفعَّل أبداً من الواجهة — تصبح ذات معنى فقط بعد نشر دالة الخادم بنجاح
        tasksBoardId: tasksBoardEl ? tasksBoardEl.value.trim() : '',
        permissionsBoardId: permissionsBoardEl ? permissionsBoardEl.value.trim() : '',
        taskOwnerEmail: (ownerEmailEl && ownerEmailEl.value.trim()) || DEFAULT_TASK_OWNER_EMAIL,
        notes: notesEl ? notesEl.value.trim() : '',
        updatedBy: core.currentUser ? core.currentUser.email : '\u0645\u062D\u0644\u064A',
        updatedAt: new Date().toISOString(),
      }};
      await core.persistIfRecord(CONFIG_COLLECTION, rec);
      core.render();
      return true;
    }
    if(action === 'monday-queue-task'){
      if(!canManageLibraries(core)) return true;
      const oppId = el.dataset.opp;
      const rec = core.opportunities.find(o => o.id === oppId);
      if(!rec) return true;
      const d = core.withDefaults(rec.data);
      const cfg = currentConfig(core);
      const queueRec = { id: core.uid('MND'), data: {
        oppId,
        title: (d.meta && d.meta.name) || oppId,
        stage: (d.pipeline && d.pipeline.stage) || '',
        nextAction: (d.pipeline && d.pipeline.nextAction) || '',
        ownerEmail: cfg.taskOwnerEmail || DEFAULT_TASK_OWNER_EMAIL,
        boardId: cfg.tasksBoardId || '',
        status: 'pending',
        syncNote: '',
        queuedBy: core.currentUser ? core.currentUser.email : '',
        queuedAt: new Date().toISOString(),
      }};
      await core.persistIfRecord(QUEUE_COLLECTION, queueRec);
      core.render();
      return true;
    }
    return false;
  });
}

export { CONFIG_COLLECTION, QUEUE_COLLECTION, DEFAULT_TASK_OWNER_EMAIL, MONDAY_ACCOUNT_OWNER_EMAIL, MONDAY_WORKSPACE_URL, MONDAY_LINKED_USER_PROFILE_URL };