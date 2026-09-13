# مراجعة Security Rules والصلاحيات

## ملخص تنفيذي

قواعد Firestore الحالية منشورة لحماية قاعدة البيانات الحقيقية. آخر اختبار محلي عبر Firestore Emulator انتهى بنتيجة:

```text
ALL PASSED (against a real Firestore emulator, not a mock)
```

هذه المراجعة تحول القواعد إلى مصفوفة صلاحيات واضحة يمكن مراجعتها من الفريق الفني والمحللين.

## الأدوار

| الدور | المصدر | المعنى |
|---|---|---|
| Admin | البريد داخل `isAdminEmail()` | صلاحية كاملة تقريباً وإدارة الفريق والإعدادات |
| Allowlisted member | وثيقة `team_members/{email}` | مستخدم مصرح له ضمن مدة الوصول |
| Senior IC | `team_roles/{email}.role == senior_ic` | تسجيل قرارات لجنة الاستثمار |
| Fund Manager | `team_roles/{email}.role == fund_manager` | إدارة الصناديق، المستثمرين، رأس المال، المكتبات المرجعية |
| Owner Analyst | `opportunities/{id}.meta.createdBy` | مالك فرصة محددة، يحق له تعديلها دون لمس حقول حوكمة رأس المال |

## مصفوفة Collections

| Collection | Read | Create | Update | Delete | ملاحظة حوكمة |
|---|---|---|---|---|---|
| `opportunities` | Authorized | Authorized + attribution honest | Admin، owner بدون capitalAllocation، Senior IC لـ`ic` فقط، Fund Manager لـ`capitalAllocation` فقط | Admin أو owner | حماية `meta.updatedBy` وقيود IC/Capital |
| `team_members` | Admin | Admin | Admin | Admin | بوابة الدخول الأساسية |
| `team_roles` | Authorized | Admin | Admin | Admin | تعيين الأدوار لا يتم من المستخدمين |
| `settings` | Authorized | Admin | Admin | Admin | إعدادات branding |
| `mondayConfig` | Authorized | Admin | Admin | Admin | لا يحتوي secrets |
| `mondayTaskQueue` | Authorized | Fund Manager فقط، status=`pending`, `queuedBy` مطابق | ممنوع | ممنوع | التحديث يتم من Cloud Function |
| `presence` | Authorized | المستخدم لوثيقته فقط | المستخدم لوثيقته فقط | المستخدم لوثيقته فقط | حضور لحظي |
| `investors` | Authorized | Fund Manager | Fund Manager | Fund Manager | دفتر المستثمرين |
| `funds` | Authorized | Fund Manager | Fund Manager | Fund Manager | دفتر الصناديق |
| `commitments` | Authorized | Fund Manager؛ المبلغ موجب إلا لو `reversalOfId` موجود | ممنوع | ممنوع | append-only، لا التزامات سالبة عادية |
| `capitalCalls` | Authorized | Fund Manager بشروط status/reversal؛ المبلغ موجب إلا لو قيد عكسي | Fund Manager عبر transitions فقط وبنفس قيد المبلغ | فقط draft `pending` | قفل محاسبي بعد الاعتماد/الترحيل |
| `distributions` | Authorized | Fund Manager بشروط؛ المبلغ موجب إلا لو قيد عكسي | Fund Manager عبر transitions فقط وبنفس قيد المبلغ | فقط draft `declared` | قفل محاسبي بعد الاعتماد/الترحيل |
| `transactions` | Authorized | Fund Manager | ممنوع | ممنوع | سجل append-only |
| `comparables` | Authorized | Fund Manager | Fund Manager | Fund Manager | مكتبة مرجعية |
| `benchmarks` | Authorized | Fund Manager | Fund Manager | Fund Manager | مكتبة مرجعية |
| `spaceEffOverrides` | Authorized | Fund Manager | Fund Manager | Fund Manager | تجاوزات مكتبة الكفاءة |
| `fundFeeOverrides` | Authorized | Fund Manager | Fund Manager | Fund Manager | تجاوزات رسوم الصندوق |
| `saudiRegOverrides` | Authorized | Fund Manager | Fund Manager | Fund Manager | تجاوزات الأنظمة السعودية |
| `oppAuditLog` | Authorized | ممنوع من العميل | ممنوع | ممنوع | يكتب فقط عبر Cloud Functions Admin SDK |
| `underwritingVersions` | Authorized | عبر `underwritingVersionCreateAllowed()` | ممنوع | ممنوع | يمنع `v4_ic_approved` المزيفة |
| `assetActuals` | Authorized | Authorized + فرصة موجودة + `enteredBy` مطابق | ممنوع | ممنوع | سجل أداء فعلي append-only |
| `icDecisions` | Authorized | Senior IC أو Admin | ممنوع | ممنوع | قرارات لجنة استثمار append-only |

## قواعد حرجة يجب عدم التراجع عنها

| القاعدة | السبب |
|---|---|
| `oppAuditLog allow write: if false` | يمنع العميل من تزوير سجل التدقيق |
| `underwritingVersionCreateAllowed()` | يمنع baseline مزيف للأداء الفعلي |
| `recordedBy/savedBy/enteredBy` تطابق المستخدم | يمنع انتحال الهوية |
| قفل `transactions`, `icDecisions`, `assetActuals` | يحافظ على التاريخ المؤسسي |
| بوابة `capitalCalls` و`distributions` | تمنع تجاوز اعتماد رأس المال |
| منع القيود السالبة العادية | يجعل التصحيحات قابلة للتتبع فقط عبر `reversalOfId` |

## اختبارات مطلوبة في CI

- تشغيل `npm --prefix tests/rules test`.
- رفض analyst لإنشاء `mondayTaskQueue`.
- رفض `v4_ic_approved` بدون `sourceDecisionId`.
- قبول `v4_ic_approved` فقط بعد قرار IC صحيح.
- رفض تعديل `oppAuditLog` من أي عميل.
- رفض update/delete للسجلات append-only.
- رفض الالتزامات/النداءات/التوزيعات السالبة إذا لم تكن قيوداً عكسية.

## توصيات إضافية

1. إضافة مراجعة دورية شهرية للقواعد قبل أي نشر.
2. عدم نسخ قواعد من Firebase Console إلى المشروع يدوياً؛ المصدر الوحيد هو `firestore.rules`.
3. إضافة اختبارات لكل Collection جديد قبل نشره.
4. نشر Cloud Functions حتى يكتمل سجل التدقيق الحقيقي.
5. العمليات الحساسة الجديدة يجب نقل واجهتها تدريجياً إلى Cloud Functions: `approveOpportunity`, `linkAssetToFund`, و`postCapitalCall`. القواعد الحالية ما زالت تحمي الصلاحيات والـappend-only، بينما الدوال تضيف إعادة تحقق business invariants داخل transactions خادمية عند نشرها وربط العميل بها.
