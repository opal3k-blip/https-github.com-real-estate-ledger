# Disaster Recovery وBackup Strategy

## أهداف الاستعادة

| الهدف | القيمة المقترحة |
|---|---|
| RPO | 24 ساعة للبيانات التشغيلية، أقل إذا زادت حساسية الاستخدام |
| RTO | 4 ساعات لاستعادة Firestore وFunctions وقواعد الأمان |
| نطاق النسخ | Firestore، Storage، Firebase config، GitHub repository |

## استراتيجية النسخ الاحتياطي

1. **Firestore Export يومي** إلى Cloud Storage bucket مخصص.
2. **نسخة أسبوعية طويلة الاحتفاظ** لمدة 90 يوم.
3. **نسخة شهرية أرشيفية** لمدة 12 شهر.
4. تخزين قواعد Firestore وFunctions وواجهة GitHub Pages داخل Git كمصدر حقيقة.
5. عدم تخزين أسرار Monday أو أي API token في Git؛ تحفظ فقط في Secret Manager.

## أمر export المقترح

```powershell
gcloud firestore export gs://<backup-bucket>/firestore/$(Get-Date -Format yyyyMMdd-HHmmss) --project real-estate-ledger-f85a6
```

## أمر restore المقترح

```powershell
gcloud firestore import gs://<backup-bucket>/firestore/<backup-folder> --project real-estate-ledger-f85a6
```

## Runbook استعادة مختصر

1. أوقف أي نشر جديد مؤقتاً.
2. حدد آخر backup صالح.
3. نفذ restore إلى مشروع staging إن أمكن.
4. شغل اختبارات القراءة والصلاحيات.
5. نفذ restore للإنتاج عند الموافقة.
6. تحقق من الرابط الحقيقي بدون `demo=1`.
7. راقب Cloud Functions وFirestore errors لمدة ساعة.

## اختبارات DR دورية

- تجربة restore ربع سنوية على مشروع Firebase منفصل.
- التأكد من أن `firestore.rules` و`firestore.indexes.json` ينشران معاً.
- التأكد من أن Secrets يمكن إعادة ضبطها بدون كشفها.
