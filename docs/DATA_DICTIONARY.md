# Data Dictionary

## نظرة عامة

هذا القاموس يوثق Collections وحقولها الأساسية كما تستخدمها الواجهة وقواعد Firestore. الحقول داخل `opportunities` كبيرة ومتداخلة لأنها تحمل نموذج الاكتتاب المالي الكامل.

## Collections

| Collection | المفتاح | أهم الحقول | الغرض |
|---|---|---|---|
| `opportunities` | auto/document id | `meta`, `land`, `strategy`, `income`, `development`, `financing`, `criteria`, `ic`, `capitalAllocation`, `risk`, `dd`, `evidence`, `pipeline` | السجل الرئيسي لكل فرصة |
| `team_members` | email lowercase | `expiresAt`, `addedAt`, `addedBy` | قائمة السماح بالدخول |
| `team_roles` | email lowercase | `role` | أدوار analyst/senior_ic/fund_manager |
| `settings` | doc id | `companyName`, `logoUrl`, branding fields | إعدادات عامة للتقارير |
| `presence` | Firebase UID | `email`, `name`, `online`, `lastSeen` | حضور لحظي |
| `investors` | auto/document id | `name`, `type`, `email`, `phone`, `notes` | بيانات المستثمرين |
| `funds` | auto/document id | `name`, `targetSize`, `assetIds`, `vintage`, `status` | الصناديق والمحافظ |
| `commitments` | auto/document id | `fundId`, `investorId`, `commitmentAmount`, `dateCommitted`, `contributionType`, `inKindDescription`, `inKindAssetId`, `reversalOfId` | التزامات المستثمرين؛ المساهمة العينية تُربط بأصل واحد عبر `inKindAssetId` عند خصمها من الاحتياج النقدي |
| `capitalCalls` | auto/document id | `fundId`, `investorId`, `amount`, `status`, `approvedBy`, `approvedAt`, `paidAt`, `linkedCommitmentId`, `reversalOfId` | نداءات رأس المال؛ المبالغ السالبة مسموحة فقط كقيود عكسية |
| `distributions` | auto/document id | `fundId`, `investorId`, `amount`, `status`, `approvedBy`, `approvedAt`, `paidAt`, `reversalOfId` | توزيعات المستثمرين |
| `transactions` | auto/document id | `fundId`, `investorId`, `type`, `amount`, `at`, `notes` | سجل معاملات append-only |
| `comparables` | auto/document id | `city`, `useType`, `price`, `capRate`, `source`, `date` | مقارنات السوق |
| `benchmarks` | auto/document id | `city`, `useType`, `irr`, `capRate`, `dscr`, `source` | معايير أوبال المرجعية |
| `spaceEffOverrides` | auto/document id | `city`, `useType`, `efficiency`, `cost`, `source` | تجاوزات الكفاءة والتكلفة |
| `fundFeeOverrides` | auto/document id | `feeType`, `rate`, `basis`, `source` | تجاوزات رسوم ومصاريف الصندوق |
| `saudiRegOverrides` | auto/document id | `topic`, `authority`, `summary`, `effectiveDate`, `source` | تجاوزات الأنظمة السعودية |
| `oppAuditLog` | auto/document id | `oppId`, `action`, `changedBy`, `changedAt`, `changes`, `reason` | سجل تدقيق موثوق من Cloud Functions |
| `underwritingVersions` | auto/document id | `oppId`, `stage`, `trigger`, `savedBy`, `savedAt`, `sourceDecisionId`, `metrics`, `thesisSnapshot` | نسخ اكتتاب immutable |
| `assetActuals` | auto/document id | `oppId`, `period`, `asOfDate`, `enteredBy`, `actualEquityIRR`, `actualMOIC`, `actualDSCR`, `actualPrice`, `notes` | الأداء الفعلي المتكرر |
| `icDecisions` | auto/document id | `oppId`, `recordedBy`, `recordedAt`, `decision`, `conditions`, `readiness` | قرارات لجنة الاستثمار |
| `mondayConfig` | `settings` | `tasksBoardId`, `permissionsBoardId`, `taskOwnerEmail`, `teamEmails`, `enabled` | إعدادات Monday غير السرية |
| `mondayTaskQueue` | auto/document id | `oppId`, `title`, `ownerEmail`, `status`, `queuedBy`, `queuedAt`, `syncedAt`, `syncNote` | قائمة انتظار Monday |

## حقول `opportunities.meta`

| الحقل | النوع | الوصف |
|---|---|---|
| `name` | string | اسم الفرصة |
| `city` | string | المدينة |
| `neighborhood` | string | الحي |
| `tier` | string | الفئة الاستثمارية |
| `oppType` | string | نوع الفرصة |
| `useType` | string | نوع الاستخدام |
| `analyst` | string | المحلل المسؤول |
| `createdBy` | email | منشئ الفرصة |
| `updatedBy` | email | آخر معدل، محمي بقواعد Firestore |
| `createdAt` / `updatedAt` | timestamp/string | تواريخ الإنشاء والتعديل |

## حقول مالية رئيسية

| المسار | الوصف |
|---|---|
| `land.area`, `land.price`, `land.far`, `land.bar` | مدخلات الأرض والكثافة |
| `income.rent`, `income.occupancy`, `income.opex` | مدخلات الدخل التأجيري |
| `development.salePrice`, `development.buildCost`, `development.constructionYears`, `development.exitCapRate` | مدخلات التطوير والخروج |
| `financing.ltc`, `financing.saibor`, `financing.margin`, `financing.shariahStructure` | التمويل |
| `criteria.irrMin`, `criteria.moicMin`, `criteria.dscrMin` | حدود لجنة الاستثمار |
| `economics.hurdle`, `economics.carry` | اقتصاديات الصندوق |

## حقول محسوبة رئيسية

| الحقل المحسوب | التعريف |
|---|---|
| `contributedEquity` / `PIC` | إجمالي كل التدفقات السالبة في `equityCF` بالقيمة المطلقة، وليس مساهمة السنة صفر فقط |
| `investorCashInvested` | `contributedEquity + investorSideFees` |
| `MOIC` | `totalDistrib / investorCashInvested` |
| `ROI` | `(totalDistrib - investorCashInvested) / investorCashInvested` |
| `DPI` / `TVPI` | حالياً يعكسان التوزيعات النقدية المحققة على نفس قاعدة `investorCashInvested`، مع `RVPI=0` ما لم توجد قيمة حالية موثقة |

## سياسة البيانات

1. لا تحفظ أسرار API داخل Firestore.
2. `mondayConfig` يحفظ IDs وإعدادات غير سرية فقط.
3. السجلات المحاسبية والقرارات لا تعدل بعد اعتمادها؛ التصحيح يكون بقيد عكسي/سجل جديد، والقيود السالبة العادية مرفوضة.
4. أي Collection جديد يجب أن يضاف إلى `firestore.rules`, هذا القاموس، واختبارات Rules.
