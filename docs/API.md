# API Documentation

## طبيعة الواجهة البرمجية

المنصة حالياً لا تمتلك REST API عامة. الواجهة البرمجية الفعلية هي:

1. Firestore Collections التي يقرأها/يكتبها العميل مباشرة تحت قواعد أمان صارمة.
2. Cloud Functions التي تعمل كتريجرات خلفية موثوقة.
3. مسارات التصدير داخل المتصفح لـPDF/Excel/PowerPoint.

## Firestore API Surface

| المورد | العملية | المستهلك |
|---|---|---|
| `opportunities` | create/read/update/delete حسب الدور | التطبيق الرئيسي |
| `icDecisions` | create/read | IC Workflow وDecision Replay |
| `underwritingVersions` | create/read | Versioned Underwriting وInvestment Passport |
| `assetActuals` | create/read | Actual Performance وKnowledge Engine |
| `funds`, `investors`, ledger collections | read/write حسب Fund Manager | Portfolio/Fund Ledger |
| `mondayTaskQueue` | create/read | Monday integration client + Cloud Function |
| `oppAuditLog` | read فقط من العميل | Audit Trail |

## Cloud Functions

| Function | Trigger | الغرض |
|---|---|---|
| `mirrorOpportunityAuditLog` | `onDocumentWritten('opportunities/{oppId}')` | إنشاء سجل تدقيق غير قابل لتلاعب العميل |
| `processMondayTaskQueue` | `onDocumentCreated('mondayTaskQueue/{queueId}')` | إرسال مهمة إلى Monday.com باستخدام Secret Manager |

## Export APIs داخل المتصفح

| الملف | الوظيفة |
|---|---|
| `src/features/ic-book-print.js` | كتاب لجنة الاستثمار/طباعة PDF |
| `src/features/excel-workbook.js` | دفتر اكتتاب Excel |
| `src/features/ic-presentation.js` | عرض لجنة الاستثمار PowerPoint |

## سياسة الإصدارات

- أي Collection جديد يجب أن يوثق هنا وفي `DATA_DICTIONARY.md`.
- أي Function جديدة يجب أن تضيف اختبار syntax على الأقل في CI.
- أي API خارجي يجب أن يستخدم Secret Manager أو OAuth backend، وليس العميل.
