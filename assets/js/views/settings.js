/* ==========================================================================
   ملاحظاتي — الإعدادات
   ========================================================================== */

import { api } from '../api.js';
import { esc, on, toast, confirmDialog, initials, formatDateTime, timeAgo } from '../utils.js';
import { icon } from '../icons.js';
import { state, loadFolders, loadTags, loadStats } from '../store.js';

const AVATAR_COLORS = [
  '#4F6BED', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#06B6D4', '#3B82F6',
];

let tab = 'profile';
let onRefresh = () => {};

export function initSettings({ onAfterChange }) {
  onRefresh = onAfterChange;
}

const TABS = [
  { id: 'profile', label: 'الملف الشخصي', icon: 'user' },
  { id: 'appearance', label: 'المظهر', icon: 'palette' },
  { id: 'security', label: 'الأمان', icon: 'shield' },
  { id: 'organize', label: 'التنظيم', icon: 'folder' },
  { id: 'data', label: 'البيانات', icon: 'download' },
];

export function renderSettings(host, { onLogout, onDeleteAccount }) {
  host.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-head__title">الإعدادات</h1>
        <p class="page-head__desc">تحكّم في حسابك ومظهرك وبياناتك</p>
      </div>
    </div>

    <div class="settings-layout">
      <nav class="settings-nav" id="settings-nav">
        ${TABS.map(
          (t) => `<button class="settings-nav__item ${tab === t.id ? 'is-active' : ''}" data-tab="${t.id}">
            ${icon(t.icon)} <span>${esc(t.label)}</span>
          </button>`,
        ).join('')}
      </nav>

      <div id="settings-panel">${panel()}</div>
    </div>
  `;

  on(host, '[data-tab]', 'click', (e) => {
    tab = e.currentTarget.dataset.tab;
    host.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    host.querySelector('#settings-panel').innerHTML = panel();
    bindPanel(host, { onLogout, onDeleteAccount });
  });

  bindPanel(host, { onLogout, onDeleteAccount });
}

function panel() {
  switch (tab) {
    case 'profile':
      return profilePanel();
    case 'appearance':
      return appearancePanel();
    case 'security':
      return securityPanel();
    case 'organize':
      return organizePanel();
    case 'data':
      return dataPanel();
    default:
      return '';
  }
}

/* ---------------------------- الملف الشخصي ---------------------------- */

function profilePanel() {
  const u = state.user;
  return `
    <section class="card">
      <div class="card__body">
        <h2 class="settings-section__title">الملف الشخصي</h2>
        <p class="settings-section__desc">معلوماتك الأساسية داخل التطبيق</p>

        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
          <span class="avatar avatar--xl" style="background:${esc(u.avatarColor)}">${initials(u.displayName)}</span>
          <div>
            <div style="font-weight:700;font-size:1.0625rem">${esc(u.displayName)}</div>
            <div class="text-sm text-muted">${esc(u.email)}</div>
          </div>
        </div>

        <form id="profile-form" style="display:flex;flex-direction:column;gap:1rem;max-width:420px">
          <div class="field">
            <label class="field__label" for="st-name">الاسم الكامل</label>
            <input class="input" id="st-name" value="${esc(u.displayName)}" maxlength="60" />
          </div>

          <div class="field">
            <label class="field__label" for="st-email">البريد الإلكتروني</label>
            <input class="input" id="st-email" value="${esc(u.email)}" disabled dir="ltr" />
            <span class="field__hint">لا يمكن تغيير البريد الإلكتروني بعد إنشاء الحساب.</span>
          </div>

          <div class="field">
            <span class="field__label">لون الصورة الرمزية</span>
            <div class="color-swatches" id="st-colors">
              ${AVATAR_COLORS.map(
                (c) =>
                  `<button class="color-swatch ${u.avatarColor === c ? 'is-active' : ''}" data-avatar="${c}" style="background:${c}" aria-label="لون"></button>`,
              ).join('')}
            </div>
          </div>

          <div>
            <button class="btn btn--primary" type="submit">${icon('check')} حفظ التغييرات</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

/* ------------------------------ المظهر ------------------------------ */

function appearancePanel() {
  const current = localStorage.getItem('mn:theme') || document.documentElement.getAttribute('data-theme') || 'light';
  const themes = [
    { id: 'light', label: 'فاتح', cls: 'tp-light' },
    { id: 'dark', label: 'داكن', cls: 'tp-dark' },
    { id: 'system', label: 'حسب النظام', cls: 'tp-system' },
  ];

  return `
    <section class="card">
      <div class="card__body">
        <h2 class="settings-section__title">المظهر</h2>
        <p class="settings-section__desc">اختر المظهر المفضّل لتطبيقك</p>

        <div class="theme-options" id="st-themes">
          ${themes
            .map(
              (t) => `<button class="theme-option ${current === t.id ? 'is-active' : ''}" data-theme-opt="${t.id}">
                <span class="theme-option__preview ${t.cls}"><span class="tp-side"></span><span class="tp-main"></span></span>
                <span>${esc(t.label)}</span>
              </button>`,
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

/* ------------------------------ الأمان ------------------------------ */

function securityPanel() {
  return `
    <section class="card" style="margin-bottom:1rem">
      <div class="card__body">
        <h2 class="settings-section__title">تغيير كلمة المرور</h2>
        <p class="settings-section__desc">استخدم كلمة مرور قوية لا تستخدمها في مواقع أخرى</p>

        <form id="password-form" style="display:flex;flex-direction:column;gap:1rem;max-width:420px">
          <div class="field">
            <label class="field__label" for="pw-current">كلمة المرور الحالية</label>
            <input class="input" id="pw-current" type="password" autocomplete="current-password" />
          </div>
          <div class="field">
            <label class="field__label" for="pw-new">كلمة المرور الجديدة</label>
            <input class="input" id="pw-new" type="password" autocomplete="new-password" />
            <span class="field__hint">8 أحرف على الأقل، وتحتوي على حرف ورقم.</span>
          </div>
          <div class="field">
            <label class="field__label" for="pw-confirm">تأكيد كلمة المرور الجديدة</label>
            <input class="input" id="pw-confirm" type="password" autocomplete="new-password" />
          </div>
          <div>
            <button class="btn btn--primary" type="submit">${icon('lock')} تحديث كلمة المرور</button>
          </div>
        </form>
      </div>
    </section>

    <section class="card">
      <div class="card__body">
        <h2 class="settings-section__title">الجلسات النشطة</h2>
        <p class="settings-section__desc">الأجهزة التي سجّلت الدخول إلى حسابك</p>
        <div id="sessions-list" class="progress-list"><span class="text-sm text-muted">جارٍ التحميل…</span></div>
      </div>
    </section>

    <section class="card" style="margin-top:1rem">
      <div class="card__body">
        <h2 class="settings-section__title">سجل النشاط</h2>
        <p class="settings-section__desc">آخر الأحداث المسجلة على حسابك</p>
        <div id="activity-list" class="progress-list"><span class="text-sm text-muted">جارٍ التحميل…</span></div>
      </div>
    </section>
  `;
}

/* ------------------------------ التنظيم ------------------------------ */

function organizePanel() {
  return `
    <section class="card" style="margin-bottom:1rem">
      <div class="card__body">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem">
          <div>
            <h2 class="settings-section__title">المجلدات</h2>
            <p class="settings-section__desc">نظّم ملاحظاتك في مجموعات</p>
          </div>
          <button class="btn btn--soft btn--sm" id="add-folder-2">${icon('folderPlus')} مجلد جديد</button>
        </div>
        <div id="folders-manage" class="progress-list"></div>
      </div>
    </section>

    <section class="card">
      <div class="card__body">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem">
          <div>
            <h2 class="settings-section__title">الوسوم</h2>
            <p class="settings-section__desc">أضف كلمات مفتاحية للوصول السريع</p>
          </div>
          <button class="btn btn--soft btn--sm" id="add-tag-2">${icon('tagPlus')} وسم جديد</button>
        </div>
        <div id="tags-manage" style="display:flex;flex-wrap:wrap;gap:.4375rem"></div>
      </div>
    </section>
  `;
}

/* ------------------------------ البيانات ------------------------------ */

function dataPanel() {
  const s = state.stats?.stats || {};
  return `
    <section class="card" style="margin-bottom:1rem">
      <div class="card__body">
        <h2 class="settings-section__title">تصدير البيانات</h2>
        <p class="settings-section__desc">حمّل نسخة من جميع ملاحظاتك ومجلداتك ووسومك بصيغة JSON</p>
        <button class="btn btn--primary" id="export-btn">${icon('download')} تصدير بياناتي</button>
      </div>
    </section>

    <section class="card danger-zone">
      <div class="card__body">
        <h2 class="settings-section__title" style="color:var(--danger)">منطقة الخطر</h2>
        <p class="settings-section__desc">
          حذف الحساب يزيل ${s.total ?? 0} من ملاحظاتك و${s.folders ?? 0} من مجلداتك نهائياً ولا يمكن التراجع عنه.
        </p>
        <button class="btn btn--outline-danger" id="delete-account">${icon('trash2')} حذف حسابي نهائياً</button>
      </div>
    </section>
  `;
}

/* ------------------------------ الربط ------------------------------ */

function bindPanel(host, { onLogout, onDeleteAccount }) {
  // الملف الشخصي
  const profileForm = host.querySelector('#profile-form');
  if (profileForm) {
    let pickedColor = state.user.avatarColor;

    on(host, '[data-avatar]', 'click', (e) => {
      pickedColor = e.currentTarget.dataset.avatar;
      host.querySelectorAll('[data-avatar]').forEach((b) => b.classList.toggle('is-active', b === e.currentTarget));
      const av = host.querySelector('.avatar--xl');
      if (av) av.style.background = pickedColor;
    });

    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const displayName = host.querySelector('#st-name').value.trim();
      if (displayName.length < 2) {
        toast('الاسم يجب أن يكون حرفين على الأقل', 'error');
        return;
      }
      try {
        const res = await api.updateProfile({ displayName, avatarColor: pickedColor });
        state.user = { ...state.user, ...res.user };
        onRefresh();
        toast('تم حفظ التغييرات');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  // المظهر
  on(host, '[data-theme-opt]', 'click', (e) => {
    const choice = e.currentTarget.dataset.themeOpt;
    localStorage.setItem('mn:theme', choice);
    const resolved =
      choice === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : choice;
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.style.colorScheme = resolved;
    host.querySelectorAll('[data-theme-opt]').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.themeOpt === choice),
    );
    toast('تم تحديث المظهر');
  });

  // كلمة المرور
  const pwForm = host.querySelector('#password-form');
  if (pwForm) {
    pwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = host.querySelector('#pw-current').value;
      const newPassword = host.querySelector('#pw-new').value;
      const confirmPassword = host.querySelector('#pw-confirm').value;

      if (newPassword !== confirmPassword) {
        toast('كلمتا المرور غير متطابقتين', 'error');
        return;
      }
      if (newPassword.length < 8) {
        toast('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 'error');
        return;
      }

      const btn = pwForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api.changePassword({ currentPassword, newPassword });
        pwForm.reset();
        toast('تم تغيير كلمة المرور بنجاح');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // الجلسات والنشاط
  if (host.querySelector('#sessions-list')) {
    loadSessions(host);
    loadActivity(host);
  }

  // التنظيم
  if (host.querySelector('#folders-manage')) {
    renderFoldersManage(host);
    renderTagsManage(host);
    host.querySelector('#add-folder-2')?.addEventListener('click', () => createFolder(host));
    host.querySelector('#add-tag-2')?.addEventListener('click', () => createTag(host));
  }

  // البيانات
  host.querySelector('#export-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mynote-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('تم تصدير بياناتك بنجاح');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  host.querySelector('#delete-account')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'حذف الحساب نهائياً؟',
      message:
        'سيتم حذف حسابك وجميع ملاحظاتك ومجلداتك ووسومك نهائياً. لا يمكن استرجاع البيانات بعد الحذف.',
      confirmText: 'حذف حسابي نهائياً',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteAccount();
      toast('تم حذف الحساب');
      onDeleteAccount();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  host.querySelector('#logout-2')?.addEventListener('click', onLogout);
}

/* --------------------------- دوال مساعدة --------------------------- */

async function loadSessions(host) {
  const box = host.querySelector('#sessions-list');
  try {
    const { sessions } = await api.sessions();
    if (!sessions.length) {
      box.innerHTML = '<span class="text-sm text-muted">لا توجد جلسات</span>';
      return;
    }
    box.innerHTML = sessions
      .map(
        (s) => `<div class="setting-row" style="padding:.75rem 0">
          <div style="display:flex;align-items:center;gap:.625rem">
            <span class="stat-card__icon stat-card__icon--primary" style="width:32px;height:32px;margin:0">${icon('monitor')}</span>
            <div>
              <div style="font-size:.8125rem;font-weight:600">${esc((s.userAgent || 'جهاز غير معروف').slice(0, 70))}</div>
              <div class="text-sm text-muted">آخر نشاط: ${timeAgo(s.lastSeenAt)}${s.ip ? ` • ${esc(s.ip)}` : ''}</div>
            </div>
          </div>
          <span class="badge badge--success">نشط</span>
        </div>`,
      )
      .join('');
  } catch (err) {
    box.innerHTML = `<span class="text-sm" style="color:var(--danger)">${esc(err.message)}</span>`;
  }
}

async function loadActivity(host) {
  const box = host.querySelector('#activity-list');
  const LABELS = {
    register: 'إنشاء حساب',
    login: 'تسجيل دخول',
    logout: 'تسجيل خروج',
    failed_login: 'محاولة دخول فاشلة',
    password_change: 'تغيير كلمة المرور',
    note_trashed: 'نقل ملاحظة إلى سلة المحذوفات',
    note_deleted: 'حذف ملاحظة نهائياً',
    trash_emptied: 'إفراغ سلة المحذوفات',
    account_deleted: 'حذف الحساب',
  };
  try {
    const { activity } = await api.activity();
    if (!activity.length) {
      box.innerHTML = '<span class="text-sm text-muted">لا يوجد نشاط مسجّل</span>';
      return;
    }
    box.innerHTML = activity
      .map(
        (a) => `<div class="setting-row" style="padding:.6rem 0">
          <div>
            <div style="font-size:.8125rem;font-weight:600">${esc(LABELS[a.action] || a.action)}</div>
            <div class="text-sm text-muted">${formatDateTime(a.createdAt)}${a.ip ? ` • ${esc(a.ip)}` : ''}</div>
          </div>
        </div>`,
      )
      .join('');
  } catch (err) {
    box.innerHTML = `<span class="text-sm" style="color:var(--danger)">${esc(err.message)}</span>`;
  }
}

function renderFoldersManage(host) {
  const box = host.querySelector('#folders-manage');
  if (!state.folders.length) {
    box.innerHTML = '<span class="text-sm text-muted">لا توجد مجلدات</span>';
    return;
  }
  box.innerHTML = state.folders
    .map(
      (f) => `<div class="setting-row" style="padding:.7rem 0">
        <div style="display:flex;align-items:center;gap:.625rem">
          <span class="nav-item__dot" style="background:${esc(f.color)};width:11px;height:11px"></span>
          <div>
            <div style="font-size:.875rem;font-weight:600">${esc(f.name)}</div>
            <div class="text-sm text-muted">${f.noteCount} ملاحظة</div>
          </div>
        </div>
        <button class="btn btn--ghost btn--icon btn--sm" data-del-folder="${f.id}" title="حذف المجلد">${icon('trash2')}</button>
      </div>`,
    )
    .join('');

  on(box, '[data-del-folder]', 'click', async (e) => {
    const id = Number(e.currentTarget.dataset.delFolder);
    const ok = await confirmDialog({
      title: 'حذف المجلد؟',
      message: 'لن تُحذف الملاحظات الموجودة داخله، لكنها ستصبح بدون مجلد.',
      confirmText: 'حذف المجلد',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteFolder(id);
      await loadFolders();
      await loadStats();
      renderFoldersManage(host);
      toast('تم حذف المجلد');
      onRefresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function renderTagsManage(host) {
  const box = host.querySelector('#tags-manage');
  if (!state.tags.length) {
    box.innerHTML = '<span class="text-sm text-muted">لا توجد وسوم</span>';
    return;
  }
  box.innerHTML = state.tags
    .map(
      (t) => `<span class="tag-pill" style="--tag-color:${esc(t.color)};background:${esc(t.color)}1f;color:${esc(t.color)}">
        ${esc(t.name)} (${t.noteCount})
        <button data-del-tag="${t.id}" style="margin-inline-start:.25rem;display:grid;place-items:center;color:inherit">${icon('close')}</button>
      </span>`,
    )
    .join('');

  on(box, '[data-del-tag]', 'click', async (e) => {
    const id = Number(e.currentTarget.dataset.delTag);
    try {
      await api.deleteTag(id);
      await loadTags();
      await loadStats();
      renderTagsManage(host);
      toast('تم حذف الوسم');
      onRefresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

export async function createFolder(host) {
  const { openModal } = await import('../utils.js');
  const { el, close } = openModal({
    title: 'مجلد جديد',
    body: `
      <form id="folder-form" style="display:flex;flex-direction:column;gap:1rem">
        <div class="field">
          <label class="field__label" for="fd-name">اسم المجلد</label>
          <input class="input" id="fd-name" placeholder="مثال: مشاريع العمل" maxlength="60" required />
        </div>
        <div class="field">
          <span class="field__label">اللون</span>
          <div class="color-swatches" id="fd-colors">
            ${AVATAR_COLORS.map(
              (c, i) => `<button class="color-swatch ${i === 0 ? 'is-active' : ''}" data-fcolor="${c}" style="background:${c}"></button>`,
            ).join('')}
          </div>
        </div>
      </form>`,
    footer: `
      <button class="btn" data-modal-close>إلغاء</button>
      <button class="btn btn--primary" id="fd-save">إنشاء</button>`,
    onMount(modal) {
      let color = AVATAR_COLORS[0];
      on(modal, '[data-fcolor]', 'click', (e) => {
        color = e.currentTarget.dataset.fcolor;
        modal.querySelectorAll('[data-fcolor]').forEach((b) => b.classList.toggle('is-active', b === e.currentTarget));
      });
      modal.querySelector('#fd-save').addEventListener('click', async () => {
        const name = modal.querySelector('#fd-name').value.trim();
        if (!name) {
          toast('يرجى إدخال اسم المجلد', 'error');
          return;
        }
        try {
          await api.createFolder({ name, color });
          await loadFolders();
          await loadStats();
          close();
          toast('تم إنشاء المجلد');
          onRefresh();
          if (host) renderFoldersManage(host);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      setTimeout(() => modal.querySelector('#fd-name')?.focus(), 100);
    },
  });
  return el;
}

export async function createTag(host) {
  const { openModal } = await import('../utils.js');
  const { close } = openModal({
    title: 'وسم جديد',
    body: `
      <form id="tag-form" style="display:flex;flex-direction:column;gap:1rem">
        <div class="field">
          <label class="field__label" for="tg-name">اسم الوسم</label>
          <input class="input" id="tg-name" placeholder="مثال: مهم" maxlength="40" required />
        </div>
      </form>`,
    footer: `
      <button class="btn" data-modal-close>إلغاء</button>
      <button class="btn btn--primary" id="tg-save">إضافة</button>`,
    onMount(modal) {
      modal.querySelector('#tg-save').addEventListener('click', async () => {
        const name = modal.querySelector('#tg-name').value.trim();
        if (!name) {
          toast('يرجى إدخال اسم الوسم', 'error');
          return;
        }
        try {
          await api.createTag({ name });
          await loadTags();
          await loadStats();
          close();
          toast('تمت إضافة الوسم');
          onRefresh();
          if (host) renderTagsManage(host);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      setTimeout(() => modal.querySelector('#tg-name')?.focus(), 100);
    },
  });
}
