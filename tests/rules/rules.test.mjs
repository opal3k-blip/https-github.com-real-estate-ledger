// اختبار حقيقي لقواعد Firestore (firestore.rules) عبر محاكي Firestore الفعلي (Firebase Local
// Emulator Suite) + @firebase/rules-unit-testing — لا محاكاة يدوية للمنطق، بل تنفيذ حقيقي
// لمحرك تقييم القواعد نفسه الذي يستخدمه Firebase في الإنتاج. يُشغَّل عبر:
//   npx firebase-tools emulators:exec --only firestore "node rules.test.mjs"
// يغطي بالضبط ما طلبه المستخدم: اختبار كل قاعدة ضد Analyst/Senior IC/Fund Manager/Admin كلٌ
// على حدة، بدل الاعتماد على إخفاء الأزرار في الواجهة.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

let failures = 0;
function assert(cond, msg){ if(!cond){ console.error('FAIL:', msg); failures++; } else { console.log('ok  :', msg); } }

// ملاحظة اكتُشفت عملياً عند التشغيل الحقيقي: firebase-tools يرفض أن يشير firebase.json إلى
// ملف قواعد خارج مجلد المشروع الحالي ("is outside of project directory") — فلا يمكن لـ
// firebase.json هنا الإشارة مباشرة إلى ../../firestore.rules. الحل: سكربت npm "pretest"
// (انظر package.json) ينسخ firestore.rules الحقيقي الوحيد من جذر المستودع إلى نسخة محلية هنا
// تلقائياً قبل كل تشغيل — فلا "نسخة يدوية قد تنحرف بمرور الوقت"، فقط نسخة مولَّدة طازجة دائماً.
const rules = readFileSync('./firestore.rules', 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: 'demo-test',
  firestore: { rules, host: 'localhost', port: 8180 },
});

// --- تمهيد بيانات السياق (team_members/team_roles) بصلاحية أدمن مباشرة (تتجاوز القواعد) ---
const ANALYST_OWNER = 'analyst-owner@x.com';       // محلل، صاحب الفرصة التجريبية
const ANALYST_OTHER  = 'analyst-other@x.com';      // محلل آخر، لا يملك أي فرصة
const SENIOR_IC      = 'senior-ic@x.com';          // عضو لجنة استثمار أول
const FUND_MANAGER   = 'fund-manager@x.com';       // مدير صندوق
const ADMIN          = 'opal3k@gmail.com';         // أدمن (من isAdminEmail() في القواعد نفسها)
const OUTSIDER       = 'outsider@x.com';           // بريد غير مُدرَج في team_members إطلاقاً

await testEnv.withSecurityRulesDisabled(async (ctx)=>{
  const db = ctx.firestore();
  for(const email of [ANALYST_OWNER, ANALYST_OTHER, SENIOR_IC, FUND_MANAGER]){
    await setDoc(doc(db, 'team_members', email), { expiresAt: null });
  }
  await setDoc(doc(db, 'team_roles', SENIOR_IC), { role:'senior_ic' });
  await setDoc(doc(db, 'team_roles', FUND_MANAGER), { role:'fund_manager' });
  // فرصة تجريبية أساسية يملكها ANALYST_OWNER، بالبنية الحقيقية (meta.* + ic.decisions[])
  await setDoc(doc(db, 'opportunities', 'OPP-1'), baseOpp(ANALYST_OWNER, []));
});

function baseOpp(createdBy, decisions){
  return {
    meta: { name:'برج تجريبي', city:'الرياض', oppType:'income', createdBy, updatedBy: createdBy, createdAt:'2026-01-01', updatedAt:'2026-01-01' },
    land: { area: 1000, price: 2000 },
    ic: { decisions: decisions||[] },
  };
}

function ctxFor(email){ return testEnv.authenticatedContext(email, { email }); }

// ==================== ١) attributionHonest + ownsOpp: تعديل عادي على فرصة ====================
{
  const db = ctxFor(ANALYST_OWNER).firestore();
  await assertSucceeds(updateDoc(doc(db,'opportunities','OPP-1'), { 'land.price': 2100, 'meta.updatedBy': ANALYST_OWNER, 'meta.updatedAt':'2026-09-09' }));
  assert(true, 'صاحب الفرصة (محلل) يقدر يعدّل حقولها العادية بنزاهة نِسبة صحيحة (meta.updatedBy = بريده الحقيقي)');
}
{
  const db = ctxFor(ANALYST_OWNER).firestore();
  await assertFails(updateDoc(doc(db,'opportunities','OPP-1'), { 'land.price': 9999, 'meta.updatedBy': 'someone-else@x.com', 'meta.updatedAt':'2026-09-09' }));
  assert(true, '🔒 attributionHonest تمنع صاحب الفرصة نفسه من تزييف meta.updatedBy ببريد شخص آخر');
}
{
  const db = ctxFor(ANALYST_OTHER).firestore();
  await assertFails(updateDoc(doc(db,'opportunities','OPP-1'), { 'land.price': 9999, 'meta.updatedBy': ANALYST_OTHER, 'meta.updatedAt':'2026-09-09' }));
  assert(true, '🔒 محلل آخر (لا يملك الفرصة، ليس عضو لجنة) لا يقدر يعدّل أي حقل عادي فيها — لا ownsOpp ولا icOnlyChange تنطبق عليه');
}

// ==================== ٢) الثغرة الأصلية المرصودة: هل يقدر عضو لجنة استثمار غير المالك يعتمد قراراً؟ ====================
{
  // إعادة الفرصة لحالتها الأساسية أولاً (أزلنا تعديلات الاختبار السابقة عبر تجاوز القواعد)
  await testEnv.withSecurityRulesDisabled(async (ctx)=>{
    await setDoc(doc(ctx.firestore(),'opportunities','OPP-1'), baseOpp(ANALYST_OWNER, []));
  });
  const db = ctxFor(SENIOR_IC).firestore();
  const newDecisions = [{ decision:'approve', reasons:['جيدة'], conditions:[], decidedBy:SENIOR_IC, decidedAt:'2026-09-09T10:00:00Z' }];
  await assertSucceeds(setDoc(doc(db,'opportunities','OPP-1'), {
    ...baseOpp(ANALYST_OWNER, newDecisions),
    meta: { ...baseOpp(ANALYST_OWNER, newDecisions).meta, updatedBy: SENIOR_IC, updatedAt:'2026-09-09' },
  }));
  assert(true, '✅ الإصلاح الجوهري: عضو لجنة استثمار أول (senior_ic)، وهو *ليس* مالك الفرصة، يقدر الآن يسجّل قرار لجنة (ic فقط) — هذا كان مستحيلاً تماماً بالقاعدة القديمة (ownsOpp فقط)، وهو جوهر الثغرة رقم ١ التي رصدها المستخدم');
}
{
  // نفس عضو اللجنة، لكن يحاول (في نفس الطلب) تغيير حقل مالي غير ic — يجب أن يُرفض بالكامل
  await testEnv.withSecurityRulesDisabled(async (ctx)=>{
    await setDoc(doc(ctx.firestore(),'opportunities','OPP-1'), baseOpp(ANALYST_OWNER, []));
  });
  const db = ctxFor(SENIOR_IC).firestore();
  const sneaky = baseOpp(ANALYST_OWNER, [{ decision:'approve', reasons:[], conditions:[], decidedBy:SENIOR_IC, decidedAt:'x' }]);
  sneaky.land.price = 1; // محاولة تغيير حقل مالي بجانب قرار اللجنة
  sneaky.meta.updatedBy = SENIOR_IC;
  await assertFails(setDoc(doc(db,'opportunities','OPP-1'), sneaky));
  assert(true, '🔒 icOnlyChange تمنع عضو اللجنة (غير المالك) من تمرير أي تغيير مالي/تشغيلي آخر (land.price هنا) "مُخبَّأً" بجانب قرار اللجنة في نفس الطلب — الصلاحية الجديدة ضيّقة تماماً كما صُمِّمت');
}
{
  // محلل عادي (غير لجنة، غير مالك) يحاول محاكاة نفس مسار "قرار لجنة" بلا أي دور — يجب أن يُرفض
  await testEnv.withSecurityRulesDisabled(async (ctx)=>{
    await setDoc(doc(ctx.firestore(),'opportunities','OPP-1'), baseOpp(ANALYST_OWNER, []));
  });
  const db = ctxFor(ANALYST_OTHER).firestore();
  const attempt = baseOpp(ANALYST_OWNER, [{ decision:'approve', reasons:[], conditions:[], decidedBy:ANALYST_OTHER, decidedAt:'x' }]);
  attempt.meta.updatedBy = ANALYST_OTHER;
  await assertFails(setDoc(doc(db,'opportunities','OPP-1'), attempt));
  assert(true, '🔒 محلل عادي بلا دور لجنة استثمار (currentRole=analyst الافتراضي) لا يقدر يسجّل "قرار لجنة" على فرصة لا يملكها — icOnlyChange تتطلب دوراً حقيقياً في team_roles، لا مجرد تنسيق الحقول');
}

// ==================== ٣) دفتر الصندوق (investors/funds/...) — مدير صندوق فأعلى فقط للكتابة ====================
const LEDGER_COLLECTIONS = ['investors','funds','commitments','capitalCalls','distributions','transactions'];
for(const coll of LEDGER_COLLECTIONS){
  {
    const db = ctxFor(ANALYST_OWNER).firestore();
    await assertFails(setDoc(doc(db, coll, 'X1'), { name:'test' }));
    assert(true, `🔒 محلل عادي لا يقدر يكتب في ${coll} (دفتر الصندوق) — كانت مفتوحة لأي عضو مصرَّح له قبل هذا التعديل`);
  }
  {
    const db = ctxFor(SENIOR_IC).firestore();
    await assertFails(setDoc(doc(db, coll, 'X2'), { name:'test' }));
    assert(true, `🔒 عضو لجنة استثمار أول (senior_ic) لا يقدر يكتب في ${coll} أيضاً (دون دور مدير صندوق) — الحماية على مستوى الدور لا الفرصة`);
  }
  {
    const db = ctxFor(FUND_MANAGER).firestore();
    await assertSucceeds(setDoc(doc(db, coll, 'X3'), { name:'test' }));
    assert(true, `✅ مدير صندوق (fund_manager) يقدر يكتب في ${coll} بنجاح`);
  }
  {
    const db = ctxFor(ANALYST_OWNER).firestore();
    await assertSucceeds(getDoc(doc(db, coll, 'X3')));
    assert(true, `✅ القراءة في ${coll} تبقى متاحة لأي عضو مصرَّح له (محلل عادي هنا)`);
  }
}

// ==================== ٤) سجل التدقيق (oppAuditLog) — ممنوع تماماً على العميل، حتى الأدمن ====================
{
  const db = ctxFor(ANALYST_OWNER).firestore();
  await assertFails(setDoc(doc(db,'oppAuditLog','A1'), { oppId:'OPP-1', changedBy:ANALYST_OWNER, action:'created' }));
  assert(true, '🔒 محلل عادي لا يقدر يكتب سجل تدقيق مباشرة من العميل');
}
{
  const db = ctxFor(FUND_MANAGER).firestore();
  await assertFails(setDoc(doc(db,'oppAuditLog','A2'), { oppId:'OPP-1', changedBy:FUND_MANAGER, action:'created' }));
  assert(true, '🔒 مدير صندوق لا يقدر يكتب سجل تدقيق مباشرة من العميل أيضاً — لا كتابة من العميل إطلاقاً بصرف النظر عن الدور');
}
{
  const db = ctxFor(ADMIN).firestore();
  await assertFails(setDoc(doc(db,'oppAuditLog','A3'), { oppId:'OPP-1', changedBy:ADMIN, action:'created' }));
  assert(true, '🔒 حتى الأدمن لا يقدر يكتب سجل تدقيق مباشرة من العميل (write: if false مطلقة، بلا استثناء أدمن) — الكتابة الحقيقية الوحيدة عبر Cloud Function بصلاحية Admin SDK التي تتجاوز هذه القاعدة تصميمياً');
}
{
  const db = ctxFor(ANALYST_OWNER).firestore();
  await testEnv.withSecurityRulesDisabled(async (ctx)=>{ await setDoc(doc(ctx.firestore(),'oppAuditLog','A4'), { oppId:'OPP-1' }); });
  await assertSucceeds(getDoc(doc(db,'oppAuditLog','A4')));
  assert(true, '✅ القراءة في oppAuditLog تبقى متاحة لأي عضو مصرَّح له (لعرض سجل التعديلات في واجهة الفرصة)');
}

// ==================== ٥) الغرباء (بريد غير مُدرَج في team_members إطلاقاً) — لا شيء ====================
{
  const db = ctxFor(OUTSIDER).firestore();
  await assertFails(getDoc(doc(db,'opportunities','OPP-1')));
  assert(true, '🔒 بريد غير مصرَّح له إطلاقاً (ليس في team_members ولا أدمن) لا يقدر حتى يقرأ فرصة واحدة');
}

// ==================== ٦) قاعدة المقارنات (comparables) — نفس نمط دفتر الصندوق، مدير صندوق فأعلى ====================
{
  const db = ctxFor(ANALYST_OWNER).firestore();
  await assertFails(setDoc(doc(db,'comparables','C1'), { city:'الرياض', price:1000, landSize:500 }));
  assert(true, '🔒 محلل عادي لا يقدر يضيف مقارنة سوقية (comparables) — كانت الواجهة فقط ناقصة الفحص (P0 #5)؛ القاعدة نفسها كانت صحيحة أصلاً وتبقى كذلك');
}
{
  const db = ctxFor(FUND_MANAGER).firestore();
  await assertSucceeds(setDoc(doc(db,'comparables','C2'), { city:'الرياض', price:1000, landSize:500 }));
  assert(true, '✅ مدير صندوق يقدر يضيف مقارنة سوقية بنجاح');
}
{
  const db = ctxFor(ANALYST_OWNER).firestore();
  await assertSucceeds(getDoc(doc(db,'comparables','C2')));
  assert(true, '✅ القراءة في comparables تبقى متاحة لأي عضو مصرَّح له (يستخدمها في المقارنة فقط)');
}

// ==================== ٧) التسعير الموثَّق بالإصدارات (underwritingVersions) — إضافة فقط لأي عضو، بلا تعديل/حذف ====================
{
  const db = ctxFor(ANALYST_OWNER).firestore();
  await assertSucceeds(setDoc(doc(db,'underwritingVersions','UWV1'), { oppId:'OPP-1', stage:'manual', metrics:{ price:2000 } }));
  assert(true, '✅ محلل عادي يقدر يحفظ لقطة تسعير (نسخة موثَّقة) — append-only، ليست مكتبة مرجعية تتطلب مدير صندوق');
}
{
  const db = ctxFor(SENIOR_IC).firestore();
  await assertFails(updateDoc(doc(db,'underwritingVersions','UWV1'), { 'metrics.price': 9999 }));
  assert(true, '🔒 عضو لجنة استثمار أول لا يقدر يعدّل نسخة تسعير محفوظة سابقاً — append-only حقيقي، حتى لدور رفيع');
}
{
  const db = ctxFor(ADMIN).firestore();
  await assertFails(updateDoc(doc(db,'underwritingVersions','UWV1'), { 'metrics.price': 9999 }));
  assert(true, '🔒 حتى الأدمن لا يقدر يعدّل نسخة تسعير محفوظة — أي تصحيح ينشئ نسخة جديدة، للحفاظ على سجل append-only');
}

console.log(failures? `\n${failures} FAILURE(S)` : '\nALL PASSED (against a real Firestore emulator, not a mock)');
await testEnv.cleanup();
process.exit(failures?1:0);
