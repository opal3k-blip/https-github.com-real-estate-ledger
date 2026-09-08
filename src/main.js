/* =========================================================================
   نقطة الدخول — Opal Real Estate Intelligence Platform
   ---------------------------------------------------------------------------
   core.js يبقى المحرك الأساسي (الفرص/التمويل/المستثمرين والصناديق) دون أي
   تغيير في منطقه الداخلي. أي نظام جديد (Investment Pipeline، Due Diligence،
   Investment Committee Workflow، Risk Engine، Investment Score، Data Quality
   Score، Audit Trail، وغيرها لاحقاً) يُبنى في ملف مستقل تحت src/features/
   ويُسجَّل نفسه هنا عبر نقاط التوسّع المُصدَّرة من core.js
   (registerTopbarButton / registerBodyView / registerDetailSection /
   registerActionHandler / registerWizardStepExtra / registerOpportunitySchemaExtender /
   registerDataCollection / registerBeforeOpportunitySave).
   هذا هو المكان الوحيد الذي يُفترض تعديله لإضافة/إزالة وحدة كاملة.

   ⚠️ ترتيب مهم: كل التسجيلات (register*) يجب أن تحدث هنا قبل استدعاء core.initDb() في
   نهاية هذا الملف — initDb() هي التي تبدأ تحميل/مزامنة البيانات لأول مرة (محلياً أو عبر
   Firestore)، فأي مجموعة بيانات إضافية (registerDataCollection) يجب أن تكون مُسجَّلة قبلها
   حتى تُحمَّل من أول تشغيل.
   ========================================================================= */
import * as core from './core.js';

// إتاحة كل صادرات core.js على window — للتوافق الخلفي الكامل مع كل سكربتات
// الاختبار (Playwright) المكتوبة طوال هذا المشروع (تستدعي
// blankOpportunity()/compute()/render()/... كمتغيرات عامة في صفحة المتصفح)،
// ولسهولة التصحيح المباشر من Console المتصفح. core.js نفسه لا يعتمد على هذا
// (يستخدم أسماءه الداخلية مباشرة)، فهذا لا يؤثر على تسلسل التهيئة الداخلي.
//
// ⚠️ ملاحظة هندسية مهمة: لا نستخدم Object.assign(window, core) هنا عمداً.
// Object.assign ينسخ القيمة الحالية لكل خاصية *لحظة التنفيذ فقط* (نسخة
// جامدة/snapshot)، بينما خاصيات كائن وحدة ES (Module Namespace Object) هي
// "live bindings" فعلياً — قيمتها الحقيقية تتغيّر لاحقاً كلما أعاد core.js
// تعيين متغير let مُصدَّر داخلياً (مثال: opportunities تُعاد كتابتها بالكامل
// داخل initDb()/loadAll() بعد أن ينفَّذ هذا السطر بلحظات، بشكل غير متزامن).
// نسخ Object.assign كان سيجمّد window.opportunities على القيمة الأولى (مصفوفة
// فارغة) إلى الأبد، بينما التطبيق نفسه (عبر render() الداخلية) يعمل بشكل
// صحيح — تناقض صامت بين ما يُعرض فعلياً وما تراه أي سكربتات اختبار خارجية.
// الحل: نُعرِّف كل خاصية على window كـ getter حي يقرأ من core[key] في كل
// مرة — يعكس القيمة الحقيقية اللحظية دائماً. الكتابة المباشرة لمتغير عام
// (مثل `wizard = {...}` من خارج core.js) تبقى غير مدعومة كما كانت (استخدم
// core.setCoreState() بدلاً من ذلك) — هذا التغيير يُصلح جهة القراءة فقط.
for (const key of Object.keys(core)) {
  try {
    Object.defineProperty(window, key, {
      get(){ return core[key]; },
      configurable: true,
      enumerable: true,
    });
  } catch(e) {
    console.warn('تعذّر ربط', key, 'كخاصية حيّة على window:', e);
  }
}

/* ---------------- تسجيل الوحدات الإضافية (Phase 1+) ---------------- */
import { registerAuditTrail } from './features/audit-trail.js';
registerAuditTrail(core);

import { registerPipeline } from './features/pipeline.js';
registerPipeline(core);

/* ---------------- التهيئة ---------------- */
core.initDb();
