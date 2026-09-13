# Monitoring & Observability

## ما يجب مراقبته

| المجال | المؤشر | الأداة |
|---|---|---|
| Firestore | reads/writes/deletes، denied requests، latency | Firebase Console / Google Cloud Monitoring |
| Rules | PERMISSION_DENIED spikes | Cloud Logging |
| Functions | errors، retries، duration، memory | Cloud Functions logs |
| Monday sync | `blocked_missing_secret`, `blocked_missing_board`, `failed` | Firestore `mondayTaskQueue` + Cloud Logging |
| Hosting | Pages deployment success/failure | GitHub Actions |
| التكلفة | Firestore operations، Functions invocations، Storage | Google Cloud Billing alerts |
| جودة الإصدار | CI pass/fail | GitHub Actions |

## Alerts مقترحة

1. Function error count > 0 خلال 15 دقيقة.
2. Firestore denied writes spike بعد نشر قواعد جديدة.
3. Budget alert عند 50%, 80%, 100%.
4. GitHub Pages deployment failure.
5. Monday queue فيها `failed` أو `blocked_*` أكثر من 30 دقيقة.

## Logs مفيدة

```powershell
firebase functions:log --project real-estate-ledger-f85a6
```

أو من Google Cloud Logging:

```text
resource.type="cloud_function"
severity>=ERROR
```

## تشغيل صحي يومي

- افتح الرابط الحقيقي بدون `demo=1`.
- سجل دخول بحساب أدمن.
- اقرأ فرصة محفوظة.
- نفذ حفظ صغير على فرصة اختبار.
- تأكد أن `oppAuditLog` يتحدث إذا كانت Functions منشورة.
- راجع GitHub Actions آخر run.
