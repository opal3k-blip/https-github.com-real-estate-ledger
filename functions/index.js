/* =========================================================================
   Cloud Function — سجل التدقيق غير القابل للتلاعب (Immutable Audit Trail)
   المرحلة السابعة، P0 #3: "الـ Audit Trail ليس Immutable بالكامل"
   ---------------------------------------------------------------------------
   السياق: كانت firestore.rules تسمح لأي عميل مصرَّح له بالكتابة المباشرة على
   مجموعة oppAuditLog (allow read, create: if isAuthorized()) — أي أن العميل
   (حتى لو مطابقاً لعمليته الحقيقية) هو من يكتب "دليل" سلوكه بنفسه، وهذا يُبطل
   قيمة السجل كإثبات موثوق. القاعدة الآن (../../firestore.rules):

       match /oppAuditLog/{id} {
         allow read: if isAuthorized();
         allow write: if false;   // لا كتابة عميل نهائياً — ولا حتى الأدمن
       }

   الكتابة الوحيدة المسموحة هي من هذه الدالة، التي تعمل بصلاحيات Admin SDK —
   والتي تتجاوز Security Rules تماماً بتصميم Firebase نفسه (هذا ليس التفافاً
   حول الحماية، بل هو "الخادم الموثوق" الذي تتحدث عنه الحوكمة: User →
   Application → Server Function → Immutable Audit Event). أي تعديل على وثيقة
   فرصة عبر أي طريق (الواجهة، سكربت لاحق، استيراد بيانات) سيُنتج سجل تدقيق
   تلقائياً — العميل لا يتحكم بذلك ولا يمكنه منعه أو تزييفه.

   ---------------------------------------------------------------------------
   ⚠️ نشر هذه الدالة يتطلب:
     ١. مشروع Firebase على خطة Blaze (الدفع بحسب الاستخدام) — Cloud Functions
        من الجيل الثاني (v2، onDocumentWritten) لا تعمل على خطة Spark المجانية.
        التكلفة المتوقعة لحجم استخدام معتاد لصندوق عقاري (عشرات-مئات الفرص،
        تعديلات يومية محدودة) ضئيلة جداً (ضِمن الحد المجاني لـ Blaze نفسه في
        الغالب: أول مليونَي استدعاء شهرياً مجانية).
     ٢. تسجيل الدخول عبر Firebase CLI (firebase login) وربط المشروع الصحيح
        (firebase use real-estate-ledger-f85a6 — أو أي مشروع آخر لديك بحسب
        .firebaserc).
     ٣. من داخل مجلد functions/: npm install، ثم من جذر المستودع:
        firebase deploy --only functions
     لا يمكنني (Claude) نشر هذه الدالة نيابةً عنك على مشروع Firebase الحقيقي —
     الكود مكتمل ومُختبَر بنيوياً هنا، لكن النشر الفعلي يتطلب صلاحياتك أنت على
     حسابك السحابي. راجع README.md في هذا المجلد لخطوات مفصَّلة.
   ========================================================================= */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const AUDIT_COLLECTION = 'oppAuditLog';

// نفس FIELD_LABELS بالضبط من src/features/audit-trail.js — أي إضافة/تعديل
// هناك يجب أن يُنسَخ هنا أيضاً (بيئتان منفصلتان: المتصفح ES module هنا Node
// CommonJS، لا استيراد مشترك ممكن بين bundle العميل ودالة الخادم بلا أداة
// بناء إضافية — النسخ المتعمَّد هنا أبسط وأوضح من تعقيد مشاركة كود لملف واحد
// صغير نسبياً).
const FIELD_LABELS = {
  'meta.name': 'اسم الفرصة', 'meta.city': 'المدينة', 'meta.neighborhood': 'الحي', 'meta.tier': 'الفئة',
  'meta.oppType': 'نوع الفرصة', 'meta.useType': 'نوع الاستخدام', 'meta.analyst': 'المحلل المسؤول',
  'land.area': 'مساحة الأرض', 'land.price': 'سعر متر الأرض', 'land.far': 'معامل البناء (FAR)', 'land.bar': 'نسبة البناء (BAR)',
  'strategy.exitStrategy': 'استراتيجية الخروج', 'strategy.salePct': 'نسبة البيع',
  'income.rent': 'الإيجار السنوي/م²', 'income.occupancy': 'نسبة الإشغال', 'income.opex': 'نسبة المصاريف التشغيلية',
  'development.salePrice': 'سعر البيع المتوقع/م²', 'development.buildCost': 'تكلفة البناء/م²',
  'development.constructionYears': 'مدة الإنشاء (سنوات)', 'development.exitCapRate': 'معدل رسملة الخروج',
  'landbank.appreciation': 'معدل نمو قيمة الأرض', 'landbank.holdingYears': 'مدة الاحتفاظ',
  'financing.ltc': 'نسبة التمويل إلى التكلفة (LTC)', 'financing.saibor': 'السايبور', 'financing.margin': 'هامش البنك',
  'financing.shariahStructure': 'الهيكل الشرعي للتمويل',
  'criteria.irrMin': 'الحد الأدنى لـ Equity IRR', 'criteria.moicMin': 'الحد الأدنى لـ MOIC',
  'subscription.minInvestment': 'الحد الأدنى للاستثمار', 'economics.hurdle': 'العائد التفضيلي (Hurdle)', 'economics.carry': 'حصة الأرباح (Carry)',
};
// نفس IGNORE_PATHS بالضبط من audit-trail.js.
const IGNORE_PATHS = new Set(['meta.updatedAt', 'meta.updatedBy', 'meta.createdAt', 'meta.createdBy', 'id', 'audit.changeReason']);

function fieldLabel(path) { return FIELD_LABELS[path] || path; }
function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }

/* نفس منطق deepDiff بالضبط من audit-trail.js — أي تعديل على قواعد الفرق نفسها
   (حقول تُتجاهَل، طريقة مقارنة المصفوفات...) يجب أن يُطبَّق في الملفين معاً. */
function deepDiff(oldObj, newObj, prefix, out) {
  out = out || [];
  const keys = new Set([...(oldObj ? Object.keys(oldObj) : []), ...(newObj ? Object.keys(newObj) : [])]);
  for (const k of keys) {
    const path = prefix ? prefix + '.' + k : k;
    if (IGNORE_PATHS.has(path)) continue;
    const ov = oldObj ? oldObj[k] : undefined;
    const nv = newObj ? newObj[k] : undefined;
    if (isPlainObject(ov) || isPlainObject(nv)) {
      deepDiff(isPlainObject(ov) ? ov : {}, isPlainObject(nv) ? nv : {}, path, out);
      continue;
    }
    const ovs = Array.isArray(ov) ? JSON.stringify(ov) : ov;
    const nvs = Array.isArray(nv) ? JSON.stringify(nv) : nv;
    if (ovs !== nvs) {
      out.push({ path, before: ov === undefined ? null : ov, after: nv === undefined ? null : nv });
    }
  }
  return out;
}

/* من قام بالتغيير فعلياً؟ نعتمد على meta.updatedBy/createdBy في المستند نفسه —
   وهذا الحقل محمي الآن في firestore.rules بقاعدة attributionHonest() التي
   تفرض أن يطابق دائماً بريد المستخدم المصادَق عليه فعلياً (request.auth.token.
   email) وقت الكتابة، فلا يمكن لعميل تزييف هوية "مَن غيَّر ماذا" في المستند —
   وهذا بالضبط ما يجعل الاعتماد على هذا الحقل هنا (من دالة خادم موثوقة) آمناً. */
function actorFromData(data, isCreate) {
  const meta = (data && data.meta) || {};
  return (isCreate ? meta.createdBy : meta.updatedBy) || meta.updatedBy || meta.createdBy || 'unknown';
}

exports.mirrorOpportunityAuditLog = onDocumentWritten('opportunities/{oppId}', async (event) => {
  const oppId = event.params.oppId;
  const beforeSnap = event.data && event.data.before;
  const afterSnap = event.data && event.data.after;

  const afterExists = !!(afterSnap && afterSnap.exists);
  const beforeExists = !!(beforeSnap && beforeSnap.exists);

  if (!afterExists) {
    // حذف فرصة بالكامل — لا نُسجِّل "فرق حقول" له معنى؛ نسجّل حدث حذف مبسَّط
    // (وثيقة الفرصة نفسها اختفت، فسجل تدقيقها هنا هو الأثر الوحيد المتبقي).
    if (beforeExists) {
      await db.collection(AUDIT_COLLECTION).add({
        oppId, action: 'deleted', changes: [], reason: '',
        changedBy: actorFromData(beforeSnap.data(), false),
        changedAt: FieldValue.serverTimestamp(),
      });
    }
    return;
  }

  const newData = afterSnap.data();
  const oldData = beforeExists ? beforeSnap.data() : null;
  const reason = (newData.audit && newData.audit.changeReason) ? String(newData.audit.changeReason).trim() : '';

  if (!oldData) {
    await db.collection(AUDIT_COLLECTION).add({
      oppId, action: 'created', changes: [], reason,
      changedBy: actorFromData(newData, true),
      changedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  let diffs;
  try {
    diffs = deepDiff(oldData, newData, '', []);
  } catch (e) {
    console.error('audit diff error for', oppId, e);
    diffs = [];
  }
  if (diffs.length === 0) return; // لا تغييرات حقيقية (مثلاً كتابة متطابقة) — لا داعي لتسجيل شيء

  await db.collection(AUDIT_COLLECTION).add({
    oppId, action: 'updated', reason,
    changedBy: actorFromData(newData, false),
    changedAt: FieldValue.serverTimestamp(),
    changes: diffs.map(d => ({ field: d.path, label: fieldLabel(d.path), before: d.before, after: d.after })),
  });
});

// مُصدَّرة للاختبار البنيوي المباشر (test_functions.mjs) بلا الحاجة لمحاكي Functions كامل.
exports._internal = { deepDiff, fieldLabel, FIELD_LABELS, IGNORE_PATHS, actorFromData };
