/* =========================================================================
   Cloud Function — مزامنة قائمة انتظار مهام Monday.com (monday-sync)
   المرحلة التاسعة: تكامل Monday.com، الجزء الخلفي الموثوق
   ---------------------------------------------------------------------------
   السياق: src/features/monday-integration.js (العميل) لا يتصل بـMonday.com API
   مباشرة إطلاقاً — يكتب فقط طلب "أرسل هذه المهمة" في مجموعة Firestore
   mondayTaskQueue بحالة 'pending' (firestore.rules تمنع العميل من إنشاء أي حالة
   أخرى، ومن تعديل/حذف أي طلب قائم بعد إنشائه — راجع القاعدة هناك). هذه الدالة
   هي الجهة الوحيدة المخوَّلة تحديث حالة الطلب (عبر Admin SDK الذي يتجاوز
   Security Rules بتصميم Firebase نفسه — نفس نمط mirrorOpportunityAuditLog في
   ./index.js بالضبط).

   ⚠️ لا يوجد هنا أي رمز API مُخترَع أو مفترَض. رمز Monday.com API الحقيقي (Personal
   API Token من حساب Monday.com المرتبط، أو بيانات اعتماد تطبيق OAuth) **غير موجود
   في هذا المستودع إطلاقاً** ولا يمكن لأي كود توليده — يجب أن يوفّره مالك حساب
   Monday.com (opal3k@gmail.com، مساحة العمل https://opal3ks-team-company.monday.com)
   بنفسه، ثم يُخزَّن حصرياً في Secret Manager التابع لمشروع Firebase (لا في أي كود،
   لا في أي مستند Firestore، لا في أي متغيّر بيئة عادي غير سرّي) عبر:

       firebase functions:secrets:set MONDAY_API_TOKEN

   وهذا يتطلب صلاحية مالك/محرِّر حقيقية على مشروع Firebase (حالياً opal3k@gmail.com
   أو ggocss@gmail.com فقط — راجع .firebaserc) — لا يمكن لأي جلسة مساعد آلي تنفيذ
   هذه الخطوة نيابة عن أحد، ولا ينبغي لها ذلك.

   طالما لم يُضبَط السر: هذه الدالة **لا تحاول الاتصال بـMonday.com إطلاقاً** —
   تُحدِّث حالة الطلب بوضوح إلى blocked_missing_secret وتسجّل تحذيراً في السجلات
   (Cloud Logging)، بدل محاولة اتصال فاشلة أو (الأسوأ) اختلاق رمز وهمي. بمجرد ضبط
   السر ونشر الدالة، أي طلب جديد في قائمة الانتظار يُرسَل فعلياً إلى Monday.com عبر
   GraphQL API الرسمية (https://api.monday.com/v2، mutation create_item)، ثم تُحدَّث
   حالته إلى synced (مع معرّف عنصر Monday الناتج) أو failed (مع رسالة الخطأ الفعلية).

   لا تعديل هنا على src/core.js أو أي منطق عميل — دالة خلفية جديدة تماماً، بنفس
   بنية/أسلوب index.js (Cloud Functions v2، Admin SDK).
   ========================================================================= */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// السر الوحيد المطلوب — لا قيمة افتراضية، لا رمز مُضمَّن في الكود. defineSecret() تجعل القيمة
// (متى ضُبطت فعلياً عبر firebase functions:secrets:set) متاحة فقط داخل بيئة تنفيذ هذه الدالة على
// خوادم Google Cloud، لا للعميل ولا لأي طلب HTTP آخر ولا حتى لأي كود آخر في هذا المستودع.
const MONDAY_API_TOKEN = defineSecret('MONDAY_API_TOKEN');

const QUEUE_COLLECTION = 'mondayTaskQueue';
const CONFIG_DOC_PATH = 'mondayConfig/settings';
const MONDAY_API_URL = 'https://api.monday.com/v2';
const DEFAULT_TASK_OWNER_EMAIL = 'saeed@opalco.sa';

exports.processMondayTaskQueue = onDocumentCreated(
  { document: `${QUEUE_COLLECTION}/{queueId}`, secrets: [MONDAY_API_TOKEN] },
  async (event) => {
    const snap = event.data;
    if (!snap || !snap.exists) return;

    const db = getFirestore();
    const docRef = snap.ref;
    const data = snap.data() || {};

    // ١) هل السر مُضبوط فعلاً؟ لا نخترع أو نفترض رمزاً — فقط نتحقق من القيمة الحقيقية.
    let token = '';
    try { token = MONDAY_API_TOKEN.value() || ''; } catch (e) { token = ''; }

    if (!token) {
      await docRef.update({
        status: 'blocked_missing_secret',
        syncNote: 'MONDAY_API_TOKEN غير مُعدّ بعد في Secret Manager. شغِّل من جهازك (بصلاحية مالك/محرِّر '
          + 'على مشروع Firebase): firebase functions:secrets:set MONDAY_API_TOKEN ثم أعد نشر الدوال. '
          + 'لم يتم أي اتصال بـMonday.com ولم يُخترَع أي رمز.',
        syncedAt: FieldValue.serverTimestamp(),
      });
      console.warn('[monday-sync] blocked: MONDAY_API_TOKEN secret not configured for', docRef.path);
      return;
    }

    // ٢) هل لدينا معرّف لوحة Monday فعلي لإرسال المهمة إليها؟ نقرأه من طلب الانتظار نفسه، وإلا من
    // إعدادات mondayConfig/settings (التي يضبطها الأدمن من لوحة "🔗 Monday.com" — لا رمز فيها أبداً).
    let boardId = data.boardId || '';
    if (!boardId) {
      try {
        const cfgSnap = await db.doc(CONFIG_DOC_PATH).get();
        if (cfgSnap.exists) boardId = (cfgSnap.data() || {}).tasksBoardId || '';
      } catch (e) { console.error('[monday-sync] failed reading mondayConfig/settings:', e); }
    }
    if (!boardId) {
      await docRef.update({
        status: 'blocked_missing_board',
        syncNote: 'لا يوجد معرّف لوحة Monday مُهيَّأ. اضبطه من لوحة "🔗 Monday.com" داخل التطبيق '
          + '(أدمن فقط) قبل تفعيل المزامنة.',
        syncedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const ownerEmail = data.ownerEmail || DEFAULT_TASK_OWNER_EMAIL;
    const itemName = data.title ? String(data.title) : `Task ${data.oppId || docRef.id}`;

    try {
      const query = 'mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON) { '
        + 'create_item (board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id } }';
      const res = await fetch(MONDAY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({
          query,
          variables: {
            boardId: String(boardId),
            itemName,
            columnValues: JSON.stringify({ text: `Owner: ${ownerEmail} | Stage: ${data.stage || ''} | Next: ${data.nextAction || ''}` }),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || json.errors) {
        throw new Error(JSON.stringify(json.errors || json));
      }
      const mondayItemId = json.data && json.data.create_item && json.data.create_item.id;
      await docRef.update({
        status: 'synced',
        mondayItemId: mondayItemId || null,
        syncNote: '',
        syncedAt: FieldValue.serverTimestamp(),
      });
      console.log('[monday-sync] synced', docRef.path, '-> monday item', mondayItemId);
    } catch (e) {
      console.error('[monday-sync] failed for', docRef.path, e);
      await docRef.update({
        status: 'failed',
        syncNote: String((e && e.message) || e).slice(0, 500),
        syncedAt: FieldValue.serverTimestamp(),
      });
    }
  }
);

// مُصدَّرة للاختبار البنيوي المباشر إن لزم لاحقاً (نفس نمط _internal في ./index.js).
exports._internal = { QUEUE_COLLECTION, CONFIG_DOC_PATH, MONDAY_API_URL, DEFAULT_TASK_OWNER_EMAIL };