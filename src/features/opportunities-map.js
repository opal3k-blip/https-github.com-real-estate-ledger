/* =========================================================================
   خريطة الفرص العقارية — Opportunities Map (المرحلة ٥، النظام الثاني)
   ---------------------------------------------------------------------------
   طلب المستخدم: خريطة للمملكة العربية السعودية تُظهر الفرص بعناوينها، يمكن
   النقر عليها أو التقريب إليها لرؤية بيانات الفرصة وتفاصيلها في الداشبورد.
   القرار المُتَّخَذ (سؤال المستخدم عبر AskUserQuestion): إضافة حقل موقع دقيق
   (Lat/Lng) لكل فرصة — لا الاعتماد على مركز المدينة فقط — عبر
   registerOpportunitySchemaExtender حقيقي (لا نموذج بيانات كامل بمعنى إضافة
   حقول أخرى، فقط geo.lat/geo.lng/geo.source).

   ⚠️ حقل الجذر الجديد اسمه geo (لا meta.geo) عمداً: registerOpportunitySchemaExtender
   في core.js يُطبَّق بـObject.assign(base, fn()) على مستوى الجذر فقط (سطحي/
   Shallow) — لو أعدنا { meta: { geo: {...} } } لكان هذا يستبدل meta بالكامل
   (بما فيها city/name/oppType/useType/tier الموجودة) لا يدمجها. كل التوسعات
   الأخرى في المشروع (pipeline/risk/exit/evidence/...) تستخدم بالفعل مفاتيح
   جذر فريدة تماماً لهذا السبب بالضبط — نتبع نفس القاعدة هنا.

   تقنية الخريطة: Leaflet.js + بلاطات OpenStreetMap (سكربتات CDN في
   index.html، تصبح window.L عاماً). core.js لا يملك أي نقطة توسّع "بعد
   الرسم" عامة (render() يستدعي فقط initCharts() الداخلية الخاصة بـChart.js) —
   ولأن render() يستبدل innerHTML لـ#app بالكامل في كل استدعاء (حتى مجرد
   مزامنة Firestore خلفية)، أي عنصر Leaflet قديم مربوط بعقدة DOM سابقة يصبح
   "معلَّقاً" (Detached) فوراً. الحل هنا (بلا أي لمس لـcore.js): مراقب DOM
   عام (MutationObserver) على #app نفسها، يتحقق بعد كل تغيير من وجود
   #opp-map-canvas ويُعيد تهيئة خريطة Leaflet جديدة إن لزم — نفس فلسفة
   initDetailCharts(id) الحالية (فحص وجود العنصر قبل التهيئة) لكن بمراقبة
   عامة بدل استدعاء مُدمَج في core.js. مركز/تقريب الخريطة السابق يُحفَظ
   ويُستعاد عند كل إعادة تهيئة لتقليل الإحساس بـ"الارتداد" البصري.

   إثراء المرحلة ٦ (طلب المستخدم: "طبقة السياق الاقتصادي الكلي على الخريطة")
   — الدوال الجغرافية النقية (CITY_COORDS/KSA_CENTER/resolveOpportunityLatLng/
   parseLatLngFromText) انتقلت إلى geo-utils.js (ملف ورقي بلا أي استيراد)
   لتفادي استيراد دائري مع macro-context.js الجديد (الذي يحتاجها أيضاً لحساب
   "أقرب مشروع رؤية ٢٠٣٠" لكل فرصة)؛ هذا الملف يستورد MEGAPROJECTS منه
   (باتجاه واحد فقط) لرسمها كطبقة إضافية قابلة للتبديل على نفس خريطة Leaflet.
   ========================================================================= */

import {
  CITY_COORDS, KSA_CENTER, KSA_DEFAULT_ZOOM, resolveOpportunityLatLng, parseLatLngFromText,
} from './geo-utils.js';
import { MEGAPROJECTS } from './macro-context.js';

/* =========================================================================
   حالة/تهيئة خريطة Leaflet — كل ما يلي يلمس DOM/window.L مباشرة (غير قابل
   للاختبار في Node بلا متصفح حقيقي) لذا يبقى معزولاً في دوال منفصلة صغيرة عن
   الدوال النقية أعلاه، ومحمياً بفحوصات وجود قبل أي استخدام.
   ========================================================================= */
let _mapInstance = null;
let _markersLayer = null;
let _megaLayer = null;
let _showMega = false; // مطفأة افتراضياً — طبقة إضافية اختيارية لا تُثقل الخريطة الأساسية
let _lastView = { center: KSA_CENTER, zoom: KSA_DEFAULT_ZOOM };
let _pendingCheck = false;

function scheduleMapCheck(core){
  if(_pendingCheck) return;
  _pendingCheck = true;
  const raf = (typeof window!=='undefined' && window.requestAnimationFrame) ? window.requestAnimationFrame : (fn)=>setTimeout(fn, 30);
  raf(()=>{ _pendingCheck = false; ensureMap(core); });
}

function destroyMap(){
  if(_mapInstance){ try{ _mapInstance.remove(); }catch(e){ /* عنصر مُزال أصلاً من الـDOM أحياناً — لا خطر */ } }
  _mapInstance = null; _markersLayer = null; _megaLayer = null;
}

/* طبقة مشاريع رؤية ٢٠٣٠ الكبرى (اختيارية، مطفأة افتراضياً) — بيانات
   MEGAPROJECTS من macro-context.js، تُرسَم بأيقونة مميزة (نجمة ذهبية) لتمييزها
   بوضوح عن دبابيس الفرص الفعلية. */
function plotMegaprojects(core){
  if(!_mapInstance || typeof window==='undefined' || !window.L) return;
  if(_megaLayer){ _mapInstance.removeLayer(_megaLayer); _megaLayer = null; }
  if(!_showMega) return;
  _megaLayer = window.L.layerGroup();
  MEGAPROJECTS.forEach(mp=>{
    const marker = window.L.circleMarker([mp.lat, mp.lng], {
      radius:9, color:'#b8860b', fillColor:'#f5c518', fillOpacity:0.9, weight:2,
    });
    marker.bindPopup(`
      <div style="min-width:180px; font-family:inherit;">
        <b>⭐ ${core.esc(core.T(mp.ar, mp.en))}</b><br>
        <span style="font-size:11px; color:#666;">${core.esc(core.T(mp.sectorAr, mp.sectorEn))}</span><br>
        <span style="font-size:11px; line-height:1.6;">${core.esc(core.T(mp.descAr, mp.descEn))}</span>
      </div>`);
    marker.addTo(_megaLayer);
  });
  _megaLayer.addTo(_mapInstance);
}

function plotMarkers(core){
  if(!_mapInstance || !_markersLayer || typeof window==='undefined' || !window.L) return;
  _markersLayer.clearLayers();
  const opps = core.opportunities || [];
  opps.forEach(rec=>{
    const d = rec.data;
    const loc = resolveOpportunityLatLng(d);
    const marker = window.L.marker([loc.lat, loc.lng], {
      opacity: loc.unmapped? 0.55 : 1,
      title: d.meta && d.meta.name || rec.id,
    });
    const name = core.esc(d.meta && d.meta.name || rec.id);
    const city = core.esc(d.meta && d.meta.city || '—');
    const useType = core.esc(d.meta && d.meta.useType || '—');
    const precisionNote = loc.precise
      ? core.T('📍 موقع دقيق','📍 Precise location')
      : (loc.unmapped ? core.T('⚠️ غير محدَّد — مركز المملكة تقريبياً','⚠️ Unmapped — approximate KSA center') : core.T('🏙️ تقريبي (مركز المدينة)','🏙️ Approximate (city center)'));
    marker.bindPopup(`
      <div style="min-width:180px; font-family:inherit;">
        <b>${name}</b><br>
        <span style="font-size:11.5px; color:#666;">${city} · ${useType}</span><br>
        <span style="font-size:10.5px; color:#888;">${precisionNote}</span><br>
        <button class="btn btn-sm btn-primary" style="margin-top:6px;" data-action="oppmap-view-detail" data-id="${core.esc(rec.id)}">📂 ${core.esc(core.T('عرض التفاصيل الكاملة','Open full details'))}</button>
      </div>`);
    marker.addTo(_markersLayer);
  });
}

function ensureMap(core){
  if(typeof document==='undefined') return;
  const canvas = document.getElementById('opp-map-canvas');
  if(!canvas){ destroyMap(); return; }
  if(typeof window==='undefined' || !window.L){
    canvas.innerHTML = `<div class="note" style="padding:24px; text-align:center;">⚠️ ${core.esc(core.T('تعذّر تحميل مكتبة الخريطة (Leaflet) — تحقّق من الاتصال بالإنترنت.','Could not load the map library (Leaflet) — check your internet connection.'))}</div>`;
    return;
  }
  // canvas دائماً عنصر DOM جديد كلياً بعد أي render() (innerHTML كامل لـ#app) —
  // لا يمكن إعادة استخدام خريطة Leaflet سابقة مربوطة بعقدة قديمة معلَّقة.
  destroyMap();
  _mapInstance = window.L.map(canvas, { scrollWheelZoom:true }).setView(_lastView.center, _lastView.zoom);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 18,
  }).addTo(_mapInstance);
  _markersLayer = window.L.layerGroup().addTo(_mapInstance);
  _mapInstance.on('moveend zoomend', ()=>{
    _lastView = { center: [_mapInstance.getCenter().lat, _mapInstance.getCenter().lng], zoom: _mapInstance.getZoom() };
  });
  plotMarkers(core);
  plotMegaprojects(core);
  setTimeout(()=>{ if(_mapInstance) _mapInstance.invalidateSize(); }, 80);
}

function watchForMapContainer(core){
  if(typeof document==='undefined' || typeof MutationObserver==='undefined') return;
  const app = document.getElementById('app');
  if(!app) return;
  const obs = new MutationObserver(()=> scheduleMapCheck(core));
  obs.observe(app, { childList:true, subtree:true });
}

/* =========================================================================
   واجهات العرض
   ========================================================================= */
function geoWizardExtraHtml(core, d){
  const g = d.geo || {};
  return `
  <div class="section" style="margin-top:16px; background:var(--surface-2); border:1px dashed var(--border);">
    <p class="step-sub" style="margin:0 0 8px;">📍 ${core.T('موقع دقيق على الخريطة (اختياري)','Precise map location (optional)')}</p>
    <div class="grid3">
      ${core.F.num('geo.lat','خط العرض (Latitude)','Latitude', g.lat, {step:0.000001, hint:'مثال: 24.7136'})}
      ${core.F.num('geo.lng','خط الطول (Longitude)','Longitude', g.lng, {step:0.000001, hint:'مثال: 46.6753'})}
    </div>
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:10px;">
      <input type="text" id="geo-link-input" placeholder="${core.T('الصق رابط خرائط جوجل هنا (أو رقمين: خط العرض، خط الطول)','Paste a Google Maps link here (or two numbers: lat, lng)')}"
        style="flex:1; min-width:220px; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:12.5px;">
      <button type="button" class="btn btn-sm" data-action="geo-parse-link">📍 ${core.T('استخراج الموقع','Extract location')}</button>
    </div>
    <p class="hint">${core.T('اتركه فارغاً لو لا تعرف الإحداثية الدقيقة — ستظهر الفرصة تقريبياً عند مركز المدينة المختارة على "خريطة الفرص".','Leave blank if you don\'t know the precise coordinate — the opportunity will appear approximately at the selected city\'s center on the "Opportunities Map".')}</p>
  </div>`;
}

export function registerOpportunitiesMap(core){
  /* حقل جذر جديد كلياً (geo) — لا يمس meta أو أي حقل قائم. */
  core.registerOpportunitySchemaExtender(()=>({ geo: { lat: null, lng: null, source: 'manual' } }));

  /* لحظة الإدخال — خطوة ٠ "الهوية والموقع"، حيث يوجد meta.city أصلاً. حقول
     F.num عادية بمسار name="geo.lat"/"geo.lng" داخل #wizard-modal — تُربَط
     تلقائياً بالكامل عبر مستمعي core.js العامين (input/change)، بلا أي معالج
     إجراء مخصّص لازم للحفظ نفسه (فقط لزر "استخراج الموقع" المساعد أدناه). */
  core.registerWizardStepExtra(0, (d)=> geoWizardExtraHtml(core, d));

  core.registerTopbarButton(()=>{
    return `<button class="btn btn-sm" data-action="oppmap-open">🗺️ ${core.T('خريطة الفرص','Opportunities Map')}</button>`;
  });

  core.registerMainView('opp-map', ()=>{
    const opps = core.opportunities || [];
    const preciseCount = opps.filter(r=> resolveOpportunityLatLng(r.data).precise).length;
    scheduleMapCheck(core); // الحاوية أدناه جديدة على DOM بعد هذا الرسم — تحقّق/هيّئ الخريطة بعد الرسم مباشرة
    return `
    <div class="section" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 style="margin:0;">🗺️ ${core.T('خريطة الفرص العقارية — المملكة العربية السعودية','Real Estate Opportunities Map — Saudi Arabia')}</h2>
        <p class="note" style="margin:4px 0 0;">${core.T('إجمالي الفرص','Total opportunities')}: <b>${opps.length}</b> &nbsp;·&nbsp; ${core.T('بموقع دقيق','With precise location')}: <b>${preciseCount}</b> &nbsp;·&nbsp; ${core.T('بموقع تقريبي (مركز المدينة)','Approximate (city center)')}: <b>${opps.length-preciseCount}</b></p>
      </div>
      <button class="btn btn-sm btn-ghost" data-action="oppmap-close">✖ ${core.T('إغلاق ورجوع للوحة الفرص','Close & return to dashboard')}</button>
    </div>
    <div class="section" style="margin-bottom:10px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
      <button type="button" class="btn btn-sm ${_showMega?'btn-primary':'btn-ghost'}" data-action="oppmap-toggle-mega">⭐ ${core.T('طبقة مشاريع رؤية ٢٠٣٠ الكبرى','Vision 2030 megaprojects layer')} ${_showMega? '('+core.T('مفعّلة','on')+')' : ''}</button>
      <span class="note" style="font-size:11px;">${core.T('يعرض مواقع تقريبية لأكبر مشاريع رؤية ٢٠٣٠ (نيوم، القدية، البحر الأحمر...) كسياق جغرافي/اقتصادي — لا علاقة مباشرة لها بفرصك المُدخَلة إلا كسياق موقع فقط.','Shows approximate locations of the largest Vision 2030 megaprojects (NEOM, Qiddiya, the Red Sea Project...) as geographic/economic context only — unrelated to your entered opportunities except as location context.')}</span>
    </div>
    <div style="display:grid; grid-template-columns: 2.2fr 1fr; gap:14px; align-items:stretch;">
      <div id="opp-map-canvas" style="height:520px; border-radius:12px; border:1px solid var(--border); background:var(--surface-2);"></div>
      <div class="section" style="max-height:520px; overflow:auto;">
        <p class="step-sub" style="margin:0 0 8px;">${core.T('كل الفرص','All opportunities')}</p>
        ${!opps.length? `<p class="note">${core.T('لا توجد فرص بعد.','No opportunities yet.')}</p>` : `
        <div class="tablewrap"><table class="db" style="font-size:11px;">
          <thead><tr><th>${core.T('الاسم','Name')}</th><th>${core.T('المدينة','City')}</th><th></th></tr></thead>
          <tbody>
            ${opps.map(rec=>{
              const loc = resolveOpportunityLatLng(rec.data);
              const icon = loc.precise? '📍' : (loc.unmapped? '⚠️' : '🏙️');
              return `<tr>
                <td style="font-size:10.5px;">${core.esc(rec.data.meta && rec.data.meta.name || rec.id)}</td>
                <td style="font-size:10.5px;">${core.esc(rec.data.meta && rec.data.meta.city || '—')}</td>
                <td style="text-align:center;">
                  <button class="btn btn-sm btn-ghost" title="${icon}" data-action="oppmap-view-detail" data-id="${core.esc(rec.id)}">${icon} ${core.T('عرض','View')}</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>`}
      </div>
    </div>
    <p class="note" style="margin-top:10px; font-size:11px;">${core.T('📍 = موقع دقيق مُدخَل لهذه الفرصة · 🏙️ = تقريبي عند مركز المدينة (لم يُدخَل موقع دقيق) · ⚠️ = غير محدَّد (لا مدينة معروفة) — أضِف/عدِّل الموقع الدقيق من معالج إدخال الفرصة، خطوة "الهوية والموقع".','📍 = precise location entered for this opportunity · 🏙️ = approximate at city center (no precise location entered) · ⚠️ = unmapped (no known city) — add/edit the precise location from the opportunity wizard\'s "Identity & Location" step.')}</p>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='oppmap-open'){
      core.setCoreState({ mainView:'opp-map', openDetailId:null, render:true });
      return true;
    }
    if(action==='oppmap-close'){
      destroyMap();
      core.setCoreState({ mainView:null, render:true });
      return true;
    }
    if(action==='oppmap-view-detail'){
      destroyMap();
      core.setCoreState({ mainView:null, openDetailId: el.dataset.id, render:true });
      return true;
    }
    if(action==='geo-parse-link'){
      const input = (typeof document!=='undefined') ? document.getElementById('geo-link-input') : null;
      const parsed = parseLatLngFromText(input? input.value : '');
      if(parsed){
        core.setPath(core.wizard.draft, 'geo.lat', parsed.lat);
        core.setPath(core.wizard.draft, 'geo.lng', parsed.lng);
      }
      core.render();
      return true;
    }
    if(action==='oppmap-toggle-mega'){
      _showMega = !_showMega;
      plotMegaprojects(core); // تحديث فوري للطبقة لو كانت الخريطة مُهيَّأة فعلاً، دون انتظار إعادة الرسم الكاملة
      core.render();
      return true;
    }
    return false;
  });

  /* المراقب العام — يُسجَّل مرة واحدة فقط عند التسجيل الأولي للوحدة (لا في كل
     رسم). #app موجودة في index.html من البداية (عنصر ثابت فارغ)، فالتسجيل
     هنا آمن حتى قبل أول render() فعلي. غير متاح في بيئة اختبار Node (لا DOM) —
     الحارس أعلى الدالة يجعل هذا لا-عملية بأمان في تلك البيئة. */
  watchForMapContainer(core);
}

export { CITY_COORDS, KSA_CENTER, resolveOpportunityLatLng, parseLatLngFromText };
