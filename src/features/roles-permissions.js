/* =========================================================================
   الأدوار والصلاحيات — Roles & Permissions Layer (المرحلة ٤، النظام الأول)
   ---------------------------------------------------------------------------
   نظام صلاحيات مستقل تماماً فوق نظام الأدمن/العضو الحالي في core.js (الذي يبقى دون أي
   تعديل: core.ADMIN_EMAILS + core.isAdmin منطق داخلي، team_members = قائمة الوصول المؤقت
   الحالية بلا تغيير). هذا الملف يضيف *فئة* إضافية فوق "عضو الفريق" — مجموعة بيانات جديدة
   مستقلة (team_roles، عبر core.registerDataCollection، بنفس نمط comparables.js/
   benchmark-engine.js) تربط كل بريد عضو بدور واحد من أربعة:

     • محلل (analyst)        — الدور الافتراضي لأي عضو فريق جديد. يدخل/يعدّل فرصه، يشوف
                                كل المكتبات المرجعية ويستخدمها في المقارنة، لكن لا يضيف/يعدّل/
                                يعتمد أي سجل مرجعي.
     • عضو لجنة استثمار أول (senior_ic) — كل صلاحيات المحلل + يعتمد قرارات لجنة الاستثمار
                                (IC Workflow) رسمياً.
     • مدير صندوق (fund_manager) — كل صلاحيات عضو اللجنة الأول + يدير المكتبات المرجعية
                                (يضيف/يعدّل/يحذف/يُصدِّق Certify سجلات: Benchmark Library،
                                مكتبة الكفاءة المعمارية، مكتبة توزيعات التكلفة، ...).
     • أدمن (admin)           — نفس core.ADMIN_EMAILS الحالية بالضبط (بريدان مُثبَّتان في
                                الكود) — صلاحيات كاملة دائماً، لا تُدار من هذا الملف ولا تُخزَّن
                                في team_roles (تُحسَب مباشرة من core.ADMIN_EMAILS).

   الفكرة المعمارية: هذا الملف *يُصدِّر دوال فحص صلاحيات* (getUserRole/canManageLibraries/
   canApproveIC/isCertified...) تستخدمها ملفات الميزات الأخرى (benchmark-engine.js، وأي مكتبة
   مرجعية جديدة لاحقاً) لتقييد أزراء الإضافة/التعديل/الحذف/التصديق — دون أي حاجة للمس core.js.
   التطبيق الفعلي الأول لهذه الدوال هو على benchmark-engine.js (انظر التعديل هناك) — أي ملف
   ميزة جديد يتبع نفس النمط ببساطة عبر استيراد الدوال من هنا.

   الحماية الحقيقية (لا الواجهة فقط) في firestore.rules: قاعدة جديدة على مجموعة team_roles
   (قراءة لأي عضو مصرَّح له، كتابة للأدمن فقط)، بالإضافة لتعديل قواعد opportunities/benchmarks
   وما شابه لاحقاً لتتحقق من الدور الفعلي في قاعدة البيانات نفسها لا من واجهة العميل فقط —
   واجهة العميل (الأزرار المخفية) تجربة استخدام أفضل، لكن الحارس الحقيقي هو Firestore Rules.
   ========================================================================= */

const ROLES_COLLECTION = 'team_roles';

const ROLES = {
  analyst:      { ar:'محلل',                 en:'Analyst',           level:1, icon:'🧮' },
  senior_ic:    { ar:'عضو لجنة استثمار أول',  en:'Senior IC Member',  level:2, icon:'🏛️' },
  fund_manager: { ar:'مدير صندوق',            en:'Fund Manager',      level:3, icon:'🗂️' },
  admin:        { ar:'أدمن',                  en:'Admin',             level:4, icon:'🛡️' },
};
const ROLE_ORDER = ['analyst','senior_ic','fund_manager','admin'];

function roleLabel(core, key){
  const r = ROLES[key];
  return r? `${r.icon} ${core.T(r.ar, r.en)}` : (key||'—');
}

/* الدور الفعلي للمستخدم الحالي. أدمن = مباشرة من core.ADMIN_EMAILS (لا يُخزَّن هنا أبداً).
   غير ذلك: يُقرأ من team_roles، والافتراضي "محلل" (أقل صلاحية) لأي عضو فريق لم يُخصَّص له
   دور بعد — دائماً نبدأ بأقل صلاحية ممكنة لا أعلاها. في وضع الديمو (لا يوجد currentUser
   حقيقي) يُعتبر الزائر "محلل" أيضاً (يشوف كل شيء، يضيف فرصاً تجريبية محلية، لا يدير مكتبات). */
function getUserRole(core){
  const user = core.currentUser;
  if(user && user.email && core.ADMIN_EMAILS.includes(user.email.toLowerCase())) return 'admin';
  if(!user || !user.email) return 'analyst';
  const rec = (core.STORE[ROLES_COLLECTION]||[]).find(r=>r.id===user.email.toLowerCase());
  return (rec && ROLES[rec.data.role]) ? rec.data.role : 'analyst';
}
function roleAtLeast(core, minRole){
  return ROLES[getUserRole(core)].level >= ROLES[minRole].level;
}
/* يدير المكتبات المرجعية (إضافة/تعديل/حذف/تصديق Certify) — مدير صندوق أو أدمن فقط. */
function canManageLibraries(core){ return roleAtLeast(core, 'fund_manager'); }
/* يعتمد قرارات لجنة الاستثمار رسمياً — عضو لجنة أول فما فوق. */
function canApproveIC(core){ return roleAtLeast(core, 'senior_ic'); }
/* يدير الأدوار نفسها (من فيه دور إيه) — أدمن فقط، مطابقة تماماً لمن يدير الفريق حالياً. */
function canManageRoles(core){ return getUserRole(core)==='admin'; }

/* شارة تصديق موحّدة تُستخدَم في أي مكتبة مرجعية (Benchmark/الكفاءة/توزيعات التكلفة) —
   دالة مساعدة عامة بدل تكرار HTML التصديق في كل ملف مكتبة على حِدة. */
function certifyBadge(core, rec){
  if(rec && rec.certified){
    return `<span class="tag" style="background:var(--good-soft); color:var(--good);" title="${core.esc(rec.certifiedBy||'')}">✅ ${core.T('مُصدَّق','Certified')}</span>`;
  }
  return `<span class="tag" style="background:var(--warn-soft); color:var(--warn);">⏳ ${core.T('مسودة — غير مُصدَّق','Draft — not certified')}</span>`;
}

export function registerRolesPermissions(core){
  core.registerDataCollection(ROLES_COLLECTION);

  core.registerTopbarButton(()=>{
    if(!canManageRoles(core)) return '';
    return `<button class="btn btn-sm" data-action="roles-open">🛡️ ${core.T('الأدوار والصلاحيات','Roles & Permissions')}</button>`;
  });

  core.registerMainView('roles', ()=>{
    const members = core.allowlistEmails || [];
    const rolesStore = core.STORE[ROLES_COLLECTION] || [];
    const roleOf = email => { const r = rolesStore.find(x=>x.id===email); return (r && ROLES[r.data.role]) ? r.data.role : 'analyst'; };

    return `
    <div class="section" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 style="margin:0;">🛡️ ${core.T('الأدوار والصلاحيات','Roles & Permissions')}</h2>
        <p class="note" style="margin:4px 0 0;">${core.T('أربع فئات: محلل (الافتراضي) ← عضو لجنة استثمار أول ← مدير صندوق ← أدمن. كل فئة تشمل صلاحيات الفئة التي قبلها.','Four tiers: Analyst (default) → Senior IC Member → Fund Manager → Admin. Each tier includes everything below it.')}</p>
      </div>
      <button class="btn btn-sm btn-ghost" data-action="roles-close">✖ ${core.T('إغلاق ورجوع للوحة الفرص','Close & return to dashboard')}</button>
    </div>

    <div class="section" style="margin-bottom:14px; background:var(--surface-2); border:1px dashed var(--border);">
      <p class="step-sub" style="margin:0 0 4px; font-weight:700;">${core.T('ماذا تسمح كل فئة؟','What can each tier do?')}</p>
      <div class="tablewrap"><table class="db" style="font-size:12px;">
        <thead><tr><th>${core.T('الفئة','Tier')}</th><th>${core.T('إدخال/تعديل فرصه','Enter / edit own deals')}</th><th>${core.T('استخدام المكتبات المرجعية للمقارنة','Use reference libraries for comparison')}</th><th>${core.T('اعتماد قرارات لجنة الاستثمار','Approve IC decisions')}</th><th>${core.T('إدارة/تصديق المكتبات المرجعية','Manage / certify reference libraries')}</th><th>${core.T('إدارة الفريق والأدوار','Manage team & roles')}</th></tr></thead>
        <tbody>
          <tr><td>${roleLabel(core,'analyst')}</td><td>✅</td><td>✅</td><td>—</td><td>—</td><td>—</td></tr>
          <tr><td>${roleLabel(core,'senior_ic')}</td><td>✅</td><td>✅</td><td>✅</td><td>—</td><td>—</td></tr>
          <tr><td>${roleLabel(core,'fund_manager')}</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td><td>—</td></tr>
          <tr><td>${roleLabel(core,'admin')}</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
        </tbody>
      </table></div>
    </div>

    <div class="tablewrap"><table class="db" style="font-size:12.5px;">
      <thead><tr><th>${core.T('البريد','Email')}</th><th>${core.T('الفئة الحالية','Current tier')}</th><th>${core.T('تغيير الفئة','Change tier')}</th></tr></thead>
      <tbody>
        ${core.ADMIN_EMAILS.map(em=>`<tr>
          <td>${core.esc(em)}</td>
          <td>${roleLabel(core,'admin')}</td>
          <td style="font-size:11px; color:var(--ink-faint);">${core.T('ثابت في الكود — لا يُدار من هنا','Fixed in code — not managed here')}</td>
        </tr>`).join('')}
        ${members.map(m=>{
          const cur = roleOf(m.email);
          return `<tr>
            <td>${core.esc(m.email)}</td>
            <td>${roleLabel(core, cur)}</td>
            <td>
              <div class="small-btns">
                ${ROLE_ORDER.filter(k=>k!=='admin').map(k=>`<button type="button" class="btn btn-sm ${k===cur?'btn-primary':'btn-ghost'}" data-action="role-set" data-email="${core.esc(m.email)}" data-role="${k}">${roleLabel(core,k)}</button>`).join('')}
              </div>
            </td>
          </tr>`;
        }).join('')}
        ${(!members.length)? `<tr><td colspan="3" style="text-align:center; padding:16px;">${core.T('لا يوجد أعضاء فريق مُضافون بعد — أضِفهم أولاً من "إدارة الفريق".','No team members added yet — add them first from "Manage Team".')}</td></tr>` : ''}
      </tbody>
    </table></div>`;
  });

  core.registerActionHandler(async (action, el)=>{
    if(action==='roles-open'){
      if(!canManageRoles(core)) return true;
      core.setCoreState({ mainView:'roles', openDetailId:null, render:true });
      return true;
    }
    if(action==='roles-close'){ core.setCoreState({ mainView:null, render:true }); return true; }
    if(action==='role-set'){
      if(!canManageRoles(core)) return true;
      const email = el.dataset.email;
      const role = el.dataset.role;
      if(!ROLES[role] || role==='admin') return true;
      const rec = { id: email, data: {
        email, role,
        setBy: core.currentUser? core.currentUser.email : 'محلي',
        setAt: new Date().toISOString(),
      }};
      await core.persistIfRecord(ROLES_COLLECTION, rec);
      core.render();
      return true;
    }
    return false;
  });
}

export { ROLES, ROLE_ORDER, ROLES_COLLECTION, roleLabel, getUserRole, roleAtLeast, canManageLibraries, canApproveIC, canManageRoles, certifyBadge };
