/* ==========================================================================
   ملاحظاتي — هيكل التطبيق (الشريط الجانبي + الشريط العلوي)
   ========================================================================== */

import { esc, on, initials, toast, timeAgo } from '../utils.js';
import { icon } from '../icons.js';
import { state, setView, on as storeOn } from '../store.js';

let root;
let navigate;
let openUserMenu;
let openNoteDialog;
let renderContent = () => {};

/** تسجيل دالة إعادة رسم المحتوى (يستخدمها التطبيق الرئيسي) */
export function setRenderContent(fn) {
  renderContent = fn;
}

export function mountShell(appRoot, { onNavigate, onNewNote, onUserMenu }) {
  root = appRoot;
  navigate = onNavigate;
  openUserMenu = onUserMenu;
  openNoteDialog = onNewNote;

  appRoot.hidden = false;
  appRoot.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar__brand">
        <span class="sidebar__logo">${icon('logo')}</span>
        <div>
          <div class="sidebar__title">ملاحظاتي</div>
          <div class="sidebar__subtitle">مساحتك الخاصة</div>
        </div>
      </div>

      <div class="sidebar__body">
        <button class="btn btn--primary btn--block" id="new-note-btn" style="gap:.5rem">
          ${icon('plus')}
          <span>ملاحظة جديدة</span>
        </button>

        <nav class="sidebar__section" id="main-nav" aria-label="التنقل الرئيسي"></nav>

        <div class="sidebar__section">
          <div class="sidebar__heading">
            <span>المجلدات</span>
            <button data-add-folder aria-label="مجلد جديد" class="tip" data-tip="مجلد جديد">${icon('folderPlus')}</button>
          </div>
          <div id="folders-nav"></div>
        </div>

        <div class="sidebar__section">
          <div class="sidebar__heading">
            <span>الوسوم</span>
            <button data-add-tag aria-label="وسم جديد" class="tip" data-tip="وسم جديد">${icon('tagPlus')}</button>
          </div>
          <div id="tags-nav"></div>
        </div>
      </div>

      <div class="sidebar__footer">
        <button class="user-chip" id="user-chip" aria-haspopup="menu">
          <span class="avatar avatar--md" id="user-avatar"></span>
          <span class="user-chip__info">
            <span class="user-chip__name" id="user-name"></span>
            <span class="user-chip__mail" id="user-mail"></span>
          </span>
          ${icon('more')}
        </button>
      </div>
    </aside>

    <header class="topbar">
      <button class="btn btn--ghost btn--icon sidebar-toggle" id="sidebar-toggle" aria-label="القائمة">
        ${icon('menu')}
      </button>

      <div class="topbar__title">
        <span class="topbar__heading" id="topbar-heading">لوحة التحكم</span>
        <span class="topbar__meta" id="topbar-meta"></span>
      </div>

      <div class="search">
        <span class="search__icon">${icon('search')}</span>
        <input class="search__input" id="global-search" type="search" placeholder="ابحث في ملاحظاتك…"
               autocomplete="off" aria-label="بحث" />
        <button class="search__clear" id="search-clear" hidden aria-label="مسح البحث">${icon('close')}</button>
      </div>

      <div class="topbar__actions">
        <div class="view-toggle" id="view-toggle" role="group" aria-label="طريقة العرض">
          <button data-view="grid" aria-label="عرض شبكي" class="tip" data-tip="عرض شبكي">${icon('grid')}</button>
          <button data-view="list" aria-label="عرض قائمة" class="tip" data-tip="عرض قائمة">${icon('list')}</button>
        </div>
        <button class="btn btn--ghost btn--icon" id="theme-toggle" aria-label="تبديل المظهر">${icon('sun')}</button>
        <button class="btn btn--ghost btn--icon" id="topbar-avatar" aria-label="الحساب" aria-haspopup="menu">
          <span class="avatar avatar--sm" id="topbar-avatar-inner"></span>
        </button>
      </div>
    </header>

    <main class="content" id="content" tabindex="-1"></main>

    <button class="fab" id="fab" aria-label="ملاحظة جديدة">${icon('plus')}</button>
  `;

  bindShellEvents();
  refreshUser();
  renderNav();
}

/* ------------------------------ الأحداث ------------------------------ */

function bindShellEvents() {
  root.querySelector('#new-note-btn').addEventListener('click', () => openNoteDialog());
  root.querySelector('#fab').addEventListener('click', () => openNoteDialog());

  root.querySelector('#sidebar-toggle').addEventListener('click', toggleSidebar);

  // البحث
  const search = root.querySelector('#global-search');
  const clearBtn = root.querySelector('#search-clear');
  let searchTimer;
  search.addEventListener('input', () => {
    clearBtn.hidden = !search.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      navigate({ name: 'notes', params: { q: search.value } }, { replace: true, silent: true });
    }, 320);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      search.value = '';
      clearBtn.hidden = true;
      navigate({ name: 'notes', params: { q: '' } }, { replace: true });
    }
  });
  clearBtn.addEventListener('click', () => {
    search.value = '';
    clearBtn.hidden = true;
    navigate({ name: 'notes', params: { q: '' } }, { replace: true });
    search.focus();
  });

  // طريقة العرض
  on(root, '[data-view]', 'click', (e) => {
    setView(e.currentTarget.dataset.view);
    updateViewToggle();
    renderContent();
  });

  // المظهر
  root.querySelector('#theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next;
    localStorage.setItem('mn:theme', next);
    updateThemeIcon();
  });

  // قائمة المستخدم
  root.querySelector('#user-chip').addEventListener('click', (e) => openUserMenu(e.currentTarget, 'bottom-end'));
  root.querySelector('#topbar-avatar').addEventListener('click', (e) => openUserMenu(e.currentTarget, 'bottom-end'));

  // إغلاق القائمة الجانبية عند النقر في الخلفية (على الجوال)
  document.addEventListener('click', (e) => {
    if (!state.sidebarOpen) return;
    if (e.target.closest('#sidebar') || e.target.closest('#sidebar-toggle')) return;
    toggleSidebar(false);
  });

  updateViewToggle();
  updateThemeIcon();
}

function toggleSidebar(force) {
  const open = typeof force === 'boolean' ? force : !state.sidebarOpen;
  state.sidebarOpen = open;
  const sidebar = root.querySelector('#sidebar');
  sidebar.classList.toggle('is-open', open);

  let overlay = document.querySelector('.sidebar-overlay');
  if (open && !overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', () => toggleSidebar(false));
    document.body.appendChild(overlay);
  } else if (!open && overlay) {
    overlay.remove();
  }
}

export function closeSidebar() {
  toggleSidebar(false);
}

/* ------------------------------ العرض ------------------------------ */

export function updateViewToggle() {
  root.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === state.view);
  });
}

export function updateThemeIcon() {
  const btn = root.querySelector('#theme-toggle');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.innerHTML = icon(isDark ? 'moon' : 'sun');
}

export function refreshUser() {
  const u = state.user;
  if (!u) return;
  const av = root.querySelector('#user-avatar');
  const avTop = root.querySelector('#topbar-avatar-inner');
  if (av) {
    av.style.background = u.avatarColor;
    av.textContent = initials(u.displayName);
  }
  if (avTop) {
    avTop.style.background = u.avatarColor;
    avTop.textContent = initials(u.displayName);
  }
  root.querySelector('#user-name').textContent = u.displayName;
  root.querySelector('#user-mail').textContent = u.email;
}

export function setTopbar(heading, meta = '') {
  const h = root.querySelector('#topbar-heading');
  const m = root.querySelector('#topbar-meta');
  if (h) h.textContent = heading;
  if (m) m.textContent = meta;
}

export function setSearchValue(value) {
  const search = root.querySelector('#global-search');
  const clearBtn = root.querySelector('#search-clear');
  if (!search) return;
  if (search.value !== value) search.value = value;
  if (clearBtn) clearBtn.hidden = !value;
}

/* --------------------------- شريط التنقل --------------------------- */

export function renderNav() {
  const nav = root.querySelector('#main-nav');
  if (!nav) return;

  const { route } = state;
  const active = route.name;

  const items = [
    { key: 'dashboard', label: 'لوحة التحكم', icon: 'dashboard' },
    { key: 'notes', label: 'كل الملاحظات', icon: 'notes', filter: 'all' },
    { key: 'pinned', label: 'المثبّتة', icon: 'pin', filter: 'pinned' },
    { key: 'archived', label: 'المؤرشفة', icon: 'archive', filter: 'archived' },
    { key: 'trash', label: 'سلة المحذوفات', icon: 'trash', filter: 'trashed' },
  ];

  nav.innerHTML = items
    .map((it) => {
      const isActive = it.filter
        ? active === 'notes' &&
          state.filters.filter === it.filter &&
          !state.filters.folderId &&
          !state.filters.tagId
        : active === it.key;
      return `
        <button class="nav-item ${isActive ? 'is-active' : ''}" data-nav="${it.key}">
          ${icon(it.icon)}
          <span class="nav-item__label">${esc(it.label)}</span>
          ${
            it.key === 'trash' && state.stats?.stats?.trashed
              ? `<span class="nav-item__count">${state.stats.stats.trashed}</span>`
              : ''
          }
        </button>`;
    })
    .join('');

  on(nav, '[data-nav]', 'click', (e) => {
    const key = e.currentTarget.dataset.nav;
    closeSidebar();
    if (key === 'dashboard') navigate({ name: 'dashboard', params: {} });
    else navigate({ name: 'notes', params: { filter: items.find((i) => i.key === key)?.filter || 'all', folderId: null, tagId: null, q: '' } });
  });

  renderFoldersNav();
  renderTagsNav();
}

function renderFoldersNav() {
  const host = root.querySelector('#folders-nav');
  if (!host) return;

  if (!state.folders.length) {
    host.innerHTML = `<p style="padding:.5rem .6875rem;font-size:.75rem;color:var(--text-muted)">لا توجد مجلدات بعد</p>`;
    return;
  }

  host.innerHTML = state.folders
    .map(
      (f) => `
      <button class="nav-item ${state.filters.folderId === f.id ? 'is-active' : ''}" data-folder="${f.id}">
        <span class="nav-item__dot" style="background:${esc(f.color)}"></span>
        <span class="nav-item__label">${esc(f.name)}</span>
        <span class="nav-item__count">${f.noteCount}</span>
      </button>`,
    )
    .join('');

  on(host, '[data-folder]', 'click', (e) => {
    const id = Number(e.currentTarget.dataset.folder);
    closeSidebar();
    navigate({ name: 'notes', params: { folderId: id, filter: 'all', tagId: null, q: '' } });
  });
}

function renderTagsNav() {
  const host = root.querySelector('#tags-nav');
  if (!host) return;

  if (!state.tags.length) {
    host.innerHTML = `<p style="padding:.5rem .6875rem;font-size:.75rem;color:var(--text-muted)">لا توجد وسوم بعد</p>`;
    return;
  }

  host.innerHTML = state.tags
    .map(
      (t) => `
      <button class="nav-item ${state.filters.tagId === t.id ? 'is-active' : ''}" data-tag="${t.id}">
        ${icon('tag')}
        <span class="nav-item__label">${esc(t.name)}</span>
        <span class="nav-item__count">${t.noteCount}</span>
      </button>`,
    )
    .join('');

  on(host, '[data-tag]', 'click', (e) => {
    const id = Number(e.currentTarget.dataset.tag);
    closeSidebar();
    navigate({ name: 'notes', params: { tagId: id, filter: 'all', folderId: null, q: '' } });
  });
}

/* ------------------------- ربط أحداث المتجر ------------------------- */

export function bindStoreUpdates(renderContent) {
  storeOn('notes', () => {
    renderFoldersNav();
    renderTagsNav();
    renderNav();
  });
  storeOn('folders', () => {
    renderFoldersNav();
    renderNav();
  });
  storeOn('tags', () => {
    renderTagsNav();
    renderNav();
  });
  storeOn('stats', () => renderNav());
  storeOn('change', () => updateViewToggle());
}

export function getContentRoot() {
  return root.querySelector('#content');
}

export function setContent(html) {
  const c = root.querySelector('#content');
  c.innerHTML = `<div class="content__inner">${html}</div>`;
  return c.querySelector('.content__inner');
}
