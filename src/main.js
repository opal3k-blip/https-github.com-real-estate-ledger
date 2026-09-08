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
// المذكرة التنفيذية الآلية (automated-ic-memo.js) تُسجَّل أولاً عمداً — قبل كل الوحدات الأخرى —
// حتى يظهر قسمها ("الملخص التنفيذي الآلي") في أعلى قائمة الأقسام الإضافية داخل مذكرة كل فرصة
// (مباشرة بعد محتوى core.js الأساسي، قبل بقية الأقسام). لا يعتمد على ترتيب استيراد ai-analyst.js
// (الذي تستورد منه generateAnalystNarrative) — استيراد ES modules يُحل عند التحميل بصرف النظر
// عن ترتيب استدعاء دوال register*.
import { registerAutomatedICMemo } from './features/automated-ic-memo.js';
registerAutomatedICMemo(core);

import { registerAuditTrail } from './features/audit-trail.js';
registerAuditTrail(core);

import { registerPipeline } from './features/pipeline.js';
registerPipeline(core);

import { registerDueDiligence } from './features/due-diligence.js';
registerDueDiligence(core);

import { registerDataQuality } from './features/data-quality.js';
registerDataQuality(core);

import { registerRiskEngine } from './features/risk-engine.js';
registerRiskEngine(core);

import { registerInvestmentScore } from './features/investment-score.js';
registerInvestmentScore(core);

import { registerICWorkflow } from './features/ic-workflow.js';
registerICWorkflow(core);

/* ---------------- المرحلة ٢ ---------------- */
import { registerMaxAcquisitionPrice } from './features/max-acquisition-price.js';
registerMaxAcquisitionPrice(core);

import { registerNegotiation } from './features/negotiation.js';
registerNegotiation(core);

import { registerScenarioManager } from './features/scenario-manager.js';
registerScenarioManager(core);

import { registerComparables } from './features/comparables.js';
registerComparables(core);

import { registerValuationEngine } from './features/valuation-engine.js';
registerValuationEngine(core);

import { registerEvidenceTracking } from './features/evidence-tracking.js';
registerEvidenceTracking(core);

/* ---------------- المرحلة ٣ ---------------- */
import { registerPortfolio } from './features/portfolio.js';
registerPortfolio(core);

import { registerConcentrationRisk } from './features/concentration-risk.js';
registerConcentrationRisk(core);

import { registerBenchmarkEngine } from './features/benchmark-engine.js';
registerBenchmarkEngine(core);

import { registerAlerts } from './features/alerts.js';
registerAlerts(core);

import { registerCommandCenter } from './features/command-center.js';
registerCommandCenter(core);

import { registerAIAnalyst } from './features/ai-analyst.js';
registerAIAnalyst(core);

import { registerDataRoom } from './features/data-room.js';
registerDataRoom(core);

/* ---------------- إعادة هيكلة التقارير (Print / Excel / PowerPoint) ---------------- */
// كتاب لجنة الاستثمار الكامل (٢١ قسماً) — طريقة عرض رئيسية جديدة مستقلة عن renderDetail
// الحالية في core.js (انظر التعليق التفصيلي في رأس ic-book-print.js لسبب هذا القرار).
import { registerICBookPrint } from './features/ic-book-print.js';
registerICBookPrint(core);

// دفتر الاكتتاب الاستثماري الكامل (٢١ ورقة Excel) — تصدير مستقل عن exportOpportunityExcel
// الحالية في core.js (تبقى كما هي، لا تزال متاحة كتصدير سريع من زر "⬇️ Excel" الأصلي).
import { registerExcelWorkbook } from './features/excel-workbook.js';
registerExcelWorkbook(core);

// عرض لجنة الاستثمار (١٢ شريحة PowerPoint) — تصدير مستقل عن exportOpportunityPptx
// الحالية في core.js (تبقى كما هي، لا تزال متاحة كتصدير سريع من زر "⬇️ PowerPoint" الأصلي).
import { registerICPresentation } from './features/ic-presentation.js';
registerICPresentation(core);

/* ---------------- التهيئة ---------------- */
core.initDb();
