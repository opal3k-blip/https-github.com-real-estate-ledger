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
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const AUDIT_COLLECTION = 'oppAuditLog';
const APPROVAL_DECISIONS = new Set(['approve', 'approve_conditions']);

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

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function roleRank(role) {
  return { analyst: 1, senior_ic: 2, fund_manager: 3, admin: 4 }[role] || 0;
}

function requireEmail(request) {
  const email = request.auth && request.auth.token && request.auth.token.email;
  if (!email) throw new HttpsError('unauthenticated', 'Authentication required.');
  return String(email).toLowerCase();
}

async function roleForEmail(email) {
  if (email === 'opal3k@gmail.com' || email === 'ggocss@gmail.com') return 'admin';
  const snap = await db.collection('team_roles').doc(email).get();
  return snap.exists ? ((snap.data() || {}).role || 'analyst') : 'analyst';
}

async function requireRole(email, minRole) {
  const role = await roleForEmail(email);
  if (roleRank(role) < roleRank(minRole)) {
    throw new HttpsError('permission-denied', `Requires ${minRole} role.`);
  }
  return role;
}

function basicReadinessOk(readiness) {
  if (!readiness || readiness.ready !== true) return false;
  const gates = readiness.gates || {};
  return Object.keys(gates).every((k) => !gates[k] || gates[k].ok !== false);
}

function decisionConditionsMet(decision) {
  if (!decision || decision.decision !== 'approve_conditions') return true;
  const conditions = Array.isArray(decision.conditions) ? decision.conditions : [];
  return conditions.length > 0 && conditions.every((c) => c && c.status === 'met');
}

function assertLedgerAmount(data, fieldName) {
  const amount = n(data && data[fieldName]);
  if ((data && data.reversalOfId) ? amount >= 0 : amount < 0) {
    throw new HttpsError('failed-precondition', 'Negative ledger entries must be linked reversals only.');
  }
}

async function committedForInvestorTx(tx, fundId, investorId) {
  const snap = await tx.get(db.collection('commitments').where('fundId', '==', fundId).where('investorId', '==', investorId));
  let total = 0;
  snap.forEach((doc) => { total += n((doc.data() || {}).commitmentAmount); });
  return total;
}

async function paidCallsForInvestorTx(tx, fundId, investorId) {
  const snap = await tx.get(db.collection('capitalCalls').where('fundId', '==', fundId).where('investorId', '==', investorId).where('status', '==', 'paid'));
  let total = 0;
  snap.forEach((doc) => { total += n((doc.data() || {}).amount); });
  return total;
}

async function allocatedElsewhereTx(tx, fund, excludeOppId) {
  const ids = (fund.assetIds || []).filter((id) => id !== excludeOppId);
  let total = 0;
  for (const id of ids) {
    const oppSnap = await tx.get(db.collection('opportunities').doc(id));
    if (!oppSnap.exists) continue;
    const alloc = ((oppSnap.data() || {}).capitalAllocation) || {};
    total += n(alloc.targetEquity);
  }
  return total;
}

exports.approveOpportunity = onCall(async (request) => {
  const email = requireEmail(request);
  await requireRole(email, 'senior_ic');
  const { oppId, decision, readiness, reasons, conditions, override } = request.data || {};
  if (!oppId || !decision || !decision.decision) throw new HttpsError('invalid-argument', 'oppId and decision are required.');
  if (APPROVAL_DECISIONS.has(decision.decision) && !basicReadinessOk(readiness)) {
    const hasJustifiedOverride = override === true && Array.isArray(reasons) && reasons.length > 0;
    if (!hasJustifiedOverride) throw new HttpsError('failed-precondition', 'Approval requires passing IC readiness or a justified override.');
  }

  const oppRef = db.collection('opportunities').doc(oppId);
  const icRef = db.collection('icDecisions').doc();
  await db.runTransaction(async (tx) => {
    const oppSnap = await tx.get(oppRef);
    if (!oppSnap.exists) throw new HttpsError('not-found', 'Opportunity not found.');
    const opp = oppSnap.data() || {};
    const icDecision = Object.assign({}, decision, {
      reasons: Array.isArray(reasons) ? reasons : [],
      conditions: Array.isArray(conditions) ? conditions : [],
      decidedBy: email,
      decidedAt: new Date().toISOString(),
      readiness: readiness || null,
      overridden: override === true,
    });
    const ic = opp.ic || {};
    const decisions = Array.isArray(ic.decisions) ? ic.decisions.slice() : [];
    decisions.push(icDecision);
    tx.update(oppRef, {
      ic: Object.assign({}, ic, { decisions }),
      'meta.updatedBy': email,
      'meta.updatedAt': new Date().toISOString().slice(0, 10),
    });
    tx.set(icRef, {
      oppId,
      decision: icDecision,
      readiness: readiness || null,
      recordedBy: email,
      recordedAt: FieldValue.serverTimestamp(),
      source: 'approveOpportunity',
      version: 1,
    });
  });
  return { ok: true, decisionId: icRef.id };
});

exports.linkAssetToFund = onCall(async (request) => {
  const email = requireEmail(request);
  await requireRole(email, 'fund_manager');
  const { fundId, oppId, unlink } = request.data || {};
  if (!fundId || !oppId) throw new HttpsError('invalid-argument', 'fundId and oppId are required.');
  const fundRef = db.collection('funds').doc(fundId);
  const oppRef = db.collection('opportunities').doc(oppId);
  await db.runTransaction(async (tx) => {
    const [fundSnap, oppSnap] = await Promise.all([tx.get(fundRef), tx.get(oppRef)]);
    if (!fundSnap.exists || !oppSnap.exists) throw new HttpsError('not-found', 'Fund or opportunity not found.');
    const fund = fundSnap.data() || {};
    const opp = oppSnap.data() || {};
    const assetIds = Array.isArray(fund.assetIds) ? fund.assetIds.slice() : [];
    const existing = assetIds.includes(oppId);
    if (unlink) {
      tx.update(fundRef, { assetIds: assetIds.filter((id) => id !== oppId), updatedAt: new Date().toISOString().slice(0, 10) });
      return;
    }
    if (existing) return;
    const decisions = (((opp.ic || {}).decisions) || []);
    const latest = decisions.length ? decisions[decisions.length - 1] : null;
    if (!latest || !APPROVAL_DECISIONS.has(latest.decision) || !decisionConditionsMet(latest)) {
      throw new HttpsError('failed-precondition', 'Asset linking requires approved IC decision with conditions met.');
    }
    const allocation = opp.capitalAllocation || {};
    const targetEquity = n(allocation.targetEquity);
    const maxAllocation = n(allocation.maxAllocation);
    if (!(targetEquity > 0)) throw new HttpsError('failed-precondition', 'Target equity allocation is required.');
    if (maxAllocation > 0 && targetEquity > maxAllocation) throw new HttpsError('failed-precondition', 'Target allocation exceeds maxAllocation.');
    const paidSnap = await tx.get(db.collection('capitalCalls').where('fundId', '==', fundId).where('status', '==', 'paid'));
    const distSnap = await tx.get(db.collection('distributions').where('fundId', '==', fundId).where('status', '==', 'paid'));
    let paidIn = 0; let distPaid = 0;
    paidSnap.forEach((doc) => { paidIn += n((doc.data() || {}).amount); });
    distSnap.forEach((doc) => { distPaid += n((doc.data() || {}).amount); });
    const allocated = await allocatedElsewhereTx(tx, fund, oppId);
    const deployable = Math.max(0, paidIn - distPaid - allocated);
    if (targetEquity > deployable) throw new HttpsError('failed-precondition', 'Insufficient deployable fund cash.');
    assetIds.push(oppId);
    tx.update(fundRef, { assetIds, updatedAt: new Date().toISOString().slice(0, 10) });
    tx.set(db.collection('transactions').doc(), { type: 'assetLink', action: 'create', relatedId: oppId, fundId, amount: targetEquity, by: email, at: FieldValue.serverTimestamp(), version: 1 });
  });
  return { ok: true };
});

exports.postCapitalCall = onCall(async (request) => {
  const email = requireEmail(request);
  await requireRole(email, 'fund_manager');
  const data = request.data || {};
  assertLedgerAmount(data, 'amount');
  if (!data.fundId || !data.investorId || !data.callDate) throw new HttpsError('invalid-argument', 'fundId, investorId and callDate are required.');
  await db.runTransaction(async (tx) => {
    if (data.status === 'paid' && !data.reversalOfId) {
      const committed = await committedForInvestorTx(tx, data.fundId, data.investorId);
      const paid = await paidCallsForInvestorTx(tx, data.fundId, data.investorId);
      if (paid + n(data.amount) > committed) {
        throw new HttpsError('failed-precondition', 'Capital call exceeds investor commitment.');
      }
    }
    tx.set(db.collection('capitalCalls').doc(), Object.assign({}, data, {
      status: data.status || 'pending',
      approvedBy: data.approvedBy || email,
      approvedAt: data.approvedAt || new Date().toISOString(),
      createdBy: email,
      createdAt: FieldValue.serverTimestamp(),
    }));
  });
  return { ok: true };
});

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
exports._internal = { deepDiff, fieldLabel, FIELD_LABELS, IGNORE_PATHS, actorFromData, basicReadinessOk, decisionConditionsMet, assertLedgerAmount, roleRank };

// تكامل Monday.com الخلفي الآمن: يعالج mondayTaskQueue من الخادم فقط، بعد ضبط
// MONDAY_API_TOKEN في Secret Manager. لا يوجد أي رمز API في واجهة العميل.
Object.assign(exports, require('./monday-sync'));
