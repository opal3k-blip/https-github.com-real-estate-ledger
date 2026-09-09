/* =========================================================================
   أدوات جغرافية مشتركة — Geo Utilities (المرحلة ٦)
   ---------------------------------------------------------------------------
   استُخرجت من opportunities-map.js (المرحلة ٥) إلى ملف مستقل هنا لسبب واحد:
   macro-context.js (المرحلة ٦، طبقة السياق الاقتصادي/مشاريع رؤية ٢٠٣٠ على
   الخريطة) يحتاج resolveOpportunityLatLng لحساب "أقرب مشروع كبرى" لكل فرصة،
   وopportunities-map.js يحتاج بيانات macro-context.js (MEGAPROJECTS) لرسمها
   كطبقة إضافية على نفس الخريطة — لو بقيت هذه الدوال داخل opportunities-map.js
   لكان ذلك استيراداً دائرياً (opportunities-map.js ↔ macro-context.js). الحل:
   كل الدوال/البيانات النقية المشتركة هنا (بلا أي استيراد من أي ملف آخر —
   ورقة/Leaf module)، وكل من opportunities-map.js وmacro-context.js يستوردان
   منها باتجاه واحد فقط. لا تغيير في أي منطق — نقل حرفي بالكامل.
   ========================================================================= */

/* إحداثيات مرجعية تقريبية لمركز كل مدينة من CITIES في core.js (نفس القيم
   بالضبط، مُكرَّرة هنا عمداً بدل استيراد CITIES من core.js لتفادي أي ارتباط
   بترتيب/تنسيق تصدير داخلي — القيم الجغرافية ثابتة عالمياً بأي حال). تُستخدَم
   فقط كموقع افتراضي (Fallback) للفرص التي لم يُدخَل لها موقع دقيق بعد — لا
   تتطلب أي ترحيل بيانات إجباري للفرص القديمة. "أخرى" بلا إحداثية مدينة محدّدة
   → مركز المملكة تقريباً، ويُعلَّم كـ"غير محدَّد بدقة" في الخريطة. */
export const CITY_COORDS = {
  'الرياض':        [24.7136, 46.6753],
  'جدة':           [21.4858, 39.1925],
  'مكة المكرمة':   [21.3891, 39.8579],
  'المدينة المنورة':[24.5247, 39.5692],
  'الدمام':        [26.4207, 50.0888],
  'الخبر':         [26.2172, 50.1971],
  'الأحساء':       [25.3838, 49.5922],
};
export const KSA_CENTER = [23.8859, 45.0792];
export const KSA_DEFAULT_ZOOM = 6;

/* موقع الفرصة الفعلي المُستخدَم على الخريطة: دقيق (geo.lat/lng) إن وُجد، وإلا
   مركز مدينتها تقريبياً، وإلا مركز المملكة (معلَّم "غير محدَّد"). دالة نقية
   بلا أي أثر جانبي — قابلة للاختبار المباشر دون DOM أو Leaflet. */
export function resolveOpportunityLatLng(d){
  const g = d && d.geo;
  if(g && g.lat!=null && g.lng!=null && isFinite(g.lat) && isFinite(g.lng)){
    return { lat:Number(g.lat), lng:Number(g.lng), precise:true, unmapped:false };
  }
  const city = d && d.meta && d.meta.city;
  const c = city && CITY_COORDS[city];
  if(c) return { lat:c[0], lng:c[1], precise:false, unmapped:false };
  return { lat:KSA_CENTER[0], lng:KSA_CENTER[1], precise:false, unmapped:true };
}

/* استخراج Lat/Lng من نص مُلصَق (رابط خرائط جوجل بأي صيغة شائعة، أو رقمين
   مفصولين بفاصلة مباشرة). يُجرَّب الأدق أولاً (!3d/!4d — إحداثية الدبوس
   الفعلي في روابط "المكان" لا مركز الخريطة العام)، ثم @lat,lng (نمط رابط
   المتصفح الأكثر شيوعاً)، ثم q=lat,lng، ثم رقمين مباشرين. دالة نقية أيضاً. */
export function parseLatLngFromText(text){
  if(!text || typeof text!=='string') return null;
  const candidates = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
  ];
  for(const re of candidates){
    const m = text.match(re);
    if(m){
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if(isFinite(lat) && isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180) return { lat, lng };
    }
  }
  return null;
}

/* المسافة بالخط المباشر (كم) بين نقطتين — صيغة Haversine القياسية. تُستخدَم
   من macro-context.js لحساب "أقرب مشروع رؤية ٢٠٣٠" لكل فرصة. دالة نقية. */
export function haversineKm(lat1, lng1, lat2, lng2){
  const R = 6371; // نصف قطر الأرض التقريبي بالكيلومتر
  const toRad = (v)=> v*Math.PI/180;
  const dLat = toRad(lat2-lat1), dLng = toRad(lng2-lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
