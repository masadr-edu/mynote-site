/* ==========================================================================
   ملاحظاتي — نقطة الدخول والتوجيه
   ========================================================================== */

import { api } from './api.js';
import { state, setFilters, loadFolders, loadTags, loadStats, loadNotes } from './store.js';
import { esc, toast, setTheme, on } from './utils.js';
import { icon } from './icons.js';
import { renderAuth } from './views/auth.js';
import {
  mountShell,
  setRenderContent,
  renderNav,
  refreshUser,
  setTopbar,
  setSearchValue,
  setContent,
  getContentRoot,
  bindStoreUpdates,
  closeSidebar,
} from './views/shell.js';
import { renderNotes, initNotesView } from './views/notes.js';
import { renderDashboard } from './views/dashboard.js';
import { renderSettings, initSettings, createFolder, createTag } from './views/settings.js';
import { openEditor, initEditor } from './views/editor.js';

const authRoot = document.getElementById('auth-root');
const appRoot = document.getElementById('app-root');
const bootScreen = document.getElementById('boot');

/* في النسخة السحابية المنشورة ثابتاً نستخدم توجيهاً بالهاش
   حتى تعمل الروابط على GitHub Pages دون خادم. */
const IS_CLOUD = typeof window !== 'undefined' && window.__MYNOTE_CLOUD__ === true;

/** المسار الحالي (مع الهاش في الوضع السحابي) */
function currentLocation() {
  if (!IS_CLOUD) return location.pathname + location.search;
  const hash = location.hash.replace(/^#/, '');
  return hash || '/';
}

/* ============================== الإقلاع ============================== */

async function boot() {
  applyStoredTheme();

  initNotesView({
    onOpenEditor: (id) => openEditor(id),
    onRerender: () => render(),
  });

  initEditor({
    onAfterSave: () => {
      refreshNotes();
      refreshSidebarCounts();
    },
  });

  initSettings({
    onAfterChange: () => {
      refreshUser();
      renderNav();
      render();
    },
  });

  try {
    const { user } = await api.me();
    if (user) {
      state.user = user;
      await startApp();
    } else {
      showAuth();
    }
  } catch {
    showAuth();
  } finally {
    bootScreen?.remove();
  }
}

function applyStoredTheme() {
  const stored = localStorage.getItem('mn:theme');
  if (stored === 'system') {
    setTheme('system');
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTheme('system'));
  } else {
    setTheme(stored || 'light');
  }
}

/* ============================== المصادقة ============================== */

function showAuth() {
  appRoot.hidden = true;
  authRoot.hidden = false;
  renderAuth(authRoot, {
    onSuccess: async (user) => {
      state.user = user;
      authRoot.hidden = true;
      appRoot.hidden = false;
      await startApp();
      toast('تم تسجيل الدخول بنجاح');
    },
  });
}

async function logout() {
  try {
    await api.logout();
  } catch {
    /* تجاهل */
  }
  state.user = null;
  state.notes = [];
  state.folders = [];
  state.tags = [];
  appRoot.hidden = true;
  document.querySelectorAll('.sidebar-overlay').forEach((el) => el.remove());
  showAuth();
}

/* ============================== التطبيق ============================== */

async function startApp() {
  mountShell(appRoot, {
    onNavigate: (route, opts) => navigate(route, opts),
    onNewNote: () => openEditor(null),
    onUserMenu: (anchor, placement) => openUserMenu(anchor, placement),
  });

  setRenderContent(() => render());
  bindStoreUpdates(() => render());
  // في الوضع السحابي كل التنقّل يتم عبر الهاش، وحدث hashchange يغطي
  // أيضاً زر الرجوع/التقدّم في المتصفح.
  window.addEventListener(IS_CLOUD ? 'hashchange' : 'popstate', () => {
    syncFromUrl();
    render();
  });

  await Promise.allSettled([loadFolders(), loadTags(), loadStats()]);
  await syncFromUrl();
  render();
}

function navigate(route, opts = {}) {
  const url = buildUrl(route);
  const target = IS_CLOUD ? `#${url}` : url;
  if (opts.replace) history.replaceState({}, '', target);
  else history.pushState({}, '', target);
  state.route = route;
  applyRoute(route);
  render();
  if (!opts.silent) closeSidebar();
}

function buildUrl(route) {
  if (route.name === 'dashboard') return '/';
  if (route.name === 'settings') return '/settings';
  const params = new URLSearchParams();
  const f = route.params || {};
  if (f.q) params.set('q', f.q);
  if (f.filter && f.filter !== 'all') params.set('filter', f.filter);
  if (f.folderId) params.set('folder', String(f.folderId));
  if (f.tagId) params.set('tag', String(f.tagId));
  if (f.sort) params.set('sort', f.sort);
  if (f.order) params.set('order', f.order);
  const qs = params.toString();
  return `/notes${qs ? `?${qs}` : ''}`;
}

function syncFromUrl() {
  const raw = currentLocation();
  const qIndex = raw.indexOf('?');
  const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const params = new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : '');

  if (path.startsWith('/settings')) {
    state.route = { name: 'settings', params: {} };
    applyRoute(state.route);
    return;
  }

  const route = {
    name: 'notes',
    params: {
      q: params.get('q') || '',
      filter: params.get('filter') || 'all',
      folderId: params.get('folder') ? Number(params.get('folder')) : null,
      tagId: params.get('tag') ? Number(params.get('tag')) : null,
      sort: params.get('sort') || 'updated',
      order: params.get('order') || 'desc',
    },
  };

  if (path === '/' || path === '') {
    state.route = { name: 'dashboard', params: {} };
  } else {
    state.route = route;
  }

  applyRoute(state.route);
}
function applyRoute(route) {
  if (route.name === 'notes') {
    setFilters({
      q: route.params.q || '',
      filter: route.params.filter || 'all',
      folderId: route.params.folderId ?? null,
      tagId: route.params.tagId ?? null,
      sort: route.params.sort || 'updated',
      order: route.params.order || 'desc',
    });
    setSearchValue(route.params.q || '');
  } else {
    setSearchValue('');
  }
}

/* ============================== العرض ============================== */

let renderToken = 0;

async function render() {
  const token = ++renderToken;
  const host = getContentRoot();
  if (!host) return;

  const route = state.route;

  if (route.name === 'dashboard') {
    setTopbar('لوحة التحكم', state.user?.email || '');
    if (!state.stats) await loadStats().catch(() => {});
    if (token !== renderToken) return;
    const inner = setContent('');
    renderDashboard(inner, { onNavigate: (r, o) => navigate(r, o), onNewNote: () => openEditor(null) });
  } else if (route.name === 'settings') {
    setTopbar('الإعدادات', '');
    const inner = setContent('');
    renderSettings(inner, {
      onLogout: logout,
      onDeleteAccount: async () => {
        state.user = null;
        appRoot.hidden = true;
        showAuth();
      },
    });
  } else {
    setTopbar('الملاحظات', `${state.total} ملاحظة`);
    const inner = setContent('');
    renderNotes(inner);
    await loadNotes().catch((err) => toast(err.message, 'error'));
    if (token !== renderToken) return;
    renderNotes(inner);
    setTopbar('الملاحظات', `${state.total} ملاحظة`);
  }

  renderNav();
}

function refreshSidebarCounts() {
  loadStats().catch(() => {});
}

/** تحديث قائمة الملاحظات فقط (بدون إعادة بناء الصفحة كاملة) */
async function refreshNotes() {
  if (state.route.name !== 'notes') return;
  const inner = getContentRoot()?.querySelector('.content__inner');
  if (!inner) return;
  try {
    await loadNotes();
    renderNotes(inner);
    setTopbar('الملاحظات', `${state.total} ملاحظة`);
  } catch {
    /* تجاهل */
  }
}

/* ============================== قائمة المستخدم ============================== */

function openUserMenu(anchor, placement = 'bottom-end') {
  document.querySelector('.menu[data-user-menu]')?.remove();

  const u = state.user;
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('data-user-menu', '');
  menu.innerHTML = `
    <div class="menu__label">${esc(u.email)}</div>
    <button class="menu__item" data-menu="profile">${icon('user')} الملف الشخصي</button>
    <button class="menu__item" data-menu="settings">${icon('settings')} الإعدادات</button>
    <button class="menu__item" data-menu="theme">${icon(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon')} تبديل المظهر</button>
    <div class="menu__sep"></div>
    <button class="menu__item menu__item--danger" data-menu="logout">${icon('logout')} تسجيل الخروج</button>
  `;

  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  let top = rect.bottom + 8;
  if (top + mh > window.innerHeight - 12) top = Math.max(12, rect.top - mh - 8);

  // في RTL نثبّت القائمة على جهة اليسار من الزر
  let left = rect.right - mw;
  left = Math.min(Math.max(12, left), window.innerWidth - mw - 12);

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.style.transformOrigin = 'top left';

  const closeMenu = () => {
    menu.remove();
    document.removeEventListener('click', outside, true);
    document.removeEventListener('keydown', onKey);
  };

  function outside(e) {
    if (!menu.contains(e.target) && e.target !== anchor) closeMenu();
  }
  function onKey(e) {
    if (e.key === 'Escape') closeMenu();
  }

  setTimeout(() => {
    document.addEventListener('click', outside, true);
    document.addEventListener('keydown', onKey);
  }, 10);

  on(menu, '[data-menu]', 'click', async (e) => {
    const action = e.currentTarget.dataset.menu;
    closeMenu();
    if (action === 'profile') navigate({ name: 'settings', params: {} });
    else if (action === 'settings') navigate({ name: 'settings', params: {} });
    else if (action === 'theme') {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      localStorage.setItem('mn:theme', next);
      setTheme(next);
      toast(next === 'dark' ? 'المظهر الداكن مفعّل' : 'المظهر الفاتح مفعّل', 'info');
    } else if (action === 'logout') {
      const ok = await confirmLogout();
      if (ok) logout();
    }
  });
}

async function confirmLogout() {
  const { confirmDialog } = await import('./utils.js');
  return confirmDialog({
    title: 'تسجيل الخروج؟',
    message: 'ستحتاج إلى إدخال البريد وكلمة المرور مرة أخرى للدخول.',
    confirmText: 'تسجيل الخروج',
  });
}

/* ============================== التشغيل ============================== */

document.addEventListener('click', (e) => {
  // أزرار إنشاء المجلد والوسم في الشريط الجانبي
  const addFolder = e.target.closest('[data-add-folder]');
  if (addFolder) {
    createFolder(null);
    return;
  }
  const addTag = e.target.closest('[data-add-tag]');
  if (addTag) {
    createTag(null);
  }
});

boot();
