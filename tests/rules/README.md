# اختبار قواعد Firestore على محاكي حقيقي

هذا اختبار **حقيقي** (لا محاكاة يدوية) لقواعد `firestore.rules` عبر Firebase Local Emulator
Suite — بالضبط ما أوصى به المراجع الأمني: "اختبار قواعد Firestore على مستوى كل Collection
واختبارها ضد مستخدم Analyst/Senior IC/Fund Manager/Admin كلٌ على حدة".

## التشغيل

```bash
cd tests/rules
npm install
npm test
```

يحتاج Java مثبَّتاً على الجهاز (لتشغيل محاكي Firestore نفسه — نفس متطلبات Firebase Local
Emulator Suite دائماً). أول تشغيل يُنزِّل ملف المحاكي (~130 ميجابايت) تلقائياً.

**ملاحظة تقنية**: `npm test` يشغّل أولاً سكربت `pretest` (مُعرَّف في `package.json`) الذي ينسخ
`../../firestore.rules` (الملف الحقيقي الوحيد في جذر المستودع) إلى نسخة محلية `firestore.rules`
هنا — هذا ليس اختياراً تصميمياً بل قيداً فعلياً في `firebase-tools` نفسه: يرفض CLI أن يشير
`firebase.json` إلى ملف قواعد خارج مجلد المشروع الحالي ("is outside of project directory"). لذا
لا تُعدِّل `tests/rules/firestore.rules` مباشرة — هي نسخة مولَّدة تُستبدَل في كل تشغيل؛ عدِّل
دائماً `firestore.rules` في جذر المستودع فقط (وهو مُتجاهَل في `.gitignore` هنا لهذا السبب بالضبط).

## ما يغطيه

- نزاهة النِّسبة (Attribution Integrity) — لا يقدر أي مستخدم يزيّف `meta.updatedBy`.
- الإصلاح الجوهري (P0 #1): عضو لجنة استثمار أول (senior_ic) يقدر الآن يسجّل قرار لجنة على فرصة
  *لا يملكها*، لكن **فقط** حقل `ic` (لا أي حقل مالي آخر "مُخبَّأ" في نفس الطلب) — ومحلل عادي بلا
  دور لجنة لا يقدر على هذا المسار إطلاقاً.
- دفتر الصندوق (investors/funds/commitments/capitalCalls/distributions/transactions، P0 #4) —
  الكتابة مقصورة على مدير صندوق فأعلى فعلياً، لا الواجهة فقط.
- سجل التدقيق (`oppAuditLog`، P0 #3) — ممنوع الكتابة من أي عميل مهما كان دوره، حتى الأدمن؛
  القراءة تبقى متاحة لعرض سجل التعديلات.
- قاعدة المقارنات (`comparables`، P0 #5) — الكتابة مقصورة على مدير صندوق فأعلى، تطابقاً مع
  إصلاح الواجهة في `comparables.js`.
- التسعير الموثَّق بالإصدارات (`underwritingVersions`، P0 #7) — أي عضو مصرَّح له يقدر يضيف نسخة
  جديدة (append-only)، لكن التعديل/الحذف مقصور على الأدمن فقط.
- بريد غير مصرَّح له إطلاقاً لا يقدر يقرأ أي شيء.

كل الحالات (٣٢ اختباراً) نُفِّذت فعلياً ضد محرك تقييم القواعد الحقيقي لـFirebase (لا افتراض
نظري)، عبر `@firebase/rules-unit-testing` — آخر تشغيل: `ALL PASSED (against a real Firestore
emulator, not a mock)`، خروج بالرمز 0.
