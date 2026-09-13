# Performance وScale Review

## الوضع الحالي

الواجهة تستخدم Firestore realtime listeners وتحمّل Collections كاملة في الذاكرة. هذا مناسب للمراحل الأولى والفرق الصغيرة، لكنه يحتاج انتقالاً تدريجياً إلى pagination/query-first عند الاقتراب من 100 ألف+ سجل.

## نقاط ضغط متوقعة

| المنطقة | الخطر عند 100k+ سجل | المعالجة |
|---|---|---|
| `opportunities` | تحميل كل الفرص دفعة واحدة | pagination، بحث، فلاتر server-side |
| `oppAuditLog` | نمو سريع مع كل تعديل | query حسب `oppId` + `changedAt desc` |
| `underwritingVersions` | تراكم نسخ لكل فرصة | query حسب `oppId` + `savedAt desc` |
| `assetActuals` | سجلات دورية لكل أصل | query حسب `oppId` + `asOfDate desc` |
| `mondayTaskQueue` | queue processing | query حسب `status` + `queuedAt` |

## الفهارس المقترحة

موجودة في `firestore.indexes.json` وتشمل:

- `underwritingVersions`: `oppId + savedAt`, و`oppId + stage + savedAt`
- `assetActuals`: `oppId + asOfDate`
- `icDecisions`: `oppId + recordedAt`
- `oppAuditLog`: `oppId + changedAt`
- `mondayTaskQueue`: `status + queuedAt`
- `presence`: `online + lastSeen`

## اختبار أداء أولي

تمت إضافة:

```powershell
npm run test:performance
```

الاختبار يحسب نموذج مالي لعينة synthetic قابلة للزيادة عبر:

```powershell
$env:PERF_SMOKE_RECORDS=100000
npm run test:performance
```

هذا لا يغني عن Load Test حقيقي على Firestore Emulator/مشروع staging، لكنه يعطي baseline سريع لمحرك الحسابات.

آخر baseline محلي على محرك الحسابات:

```json
{
  "records": 100000,
  "elapsedMs": 22928,
  "perRecordMs": 0.2293
}
```

## اختبار Load/Stress على Firestore Emulator

تمت إضافة:

```powershell
npm run test:load
```

الاختبار يكتب فرصاً synthetic عبر مستخدم مصرح له، يقرأها عبر نفس المستخدم، يثبت أن outsider مرفوض، ويختبر ضغطاً مصغراً على `mondayTaskQueue` عبر Fund Manager. يمكن تكبير العينة:

```powershell
$env:LOAD_STRESS_RECORDS=5000
npm run test:load
```

## خطة 100k

1. تحويل شاشة القائمة الرئيسية إلى query/pagination.
2. تحميل سجلات التفاصيل فقط عند فتح الفرصة.
3. فصل تقارير المحفظة الثقيلة إلى materialized summaries عبر Cloud Functions.
4. قياس exports الكبيرة على عينات 10k/50k/100k.
5. تشغيل Load Tests على Emulator ثم staging قبل الإنتاج.
