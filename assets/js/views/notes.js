/* ==========================================================================
   ملاحظاتي — عرض قائمة الملاحظات
   ========================================================================== */

import { esc, on, timeAgo, shortDate, toast, confirmDialog } from '../utils.js';
import { icon } from '../icons.js';
import { state, setFilters, loadNotes } from '../store.js';
import { api } from '../api.js';

let openEditor;
let rerender;

const NOTE_CLASS = {
  default: 'note-card--default',
  blue: 'note-card--blue',
  green: 'note-card--green',
  purple: 'note-card--purple',
  amber: 'note-card--amber',
  rose: 'note-card--rose',
  teal: 'note-card--teal',
  slate: 'note-card--slate',
};

export function initNotesView({ onOpenEditor, onRerender }) {
  openEditor = onOpenEditor;
  rerender = onRerender;
}

export function renderNotes(host) {
  const { filters, notes, view, loading } = state;

  const titles = {
    all: 'كل الملاحظات',
    pinned: 'الملاحظات المثبّتة',
    archived: 'الملاحظات المؤرشفة',
    trashed: 'سلة المحذوفات',
  };
  let title = titles[filters.filter] || 'كل الملاحظات';
  if (filters.folderId) {
    const f = state.folders.find((x) => x.id === filters.folderId);
    if (f) title = f.name;
  }
  if (filters.tagId) {
    const t = state.tags.find((x) => x.id === filters.tagId);
    if (t) title = `#${t.name}`;
  }
  if (filters.q) title = `نتائج البحث عن "${filters.q}"`;

  host.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-head__title">${esc(title)}</h1>
        <p class="page-head__desc">${state.total} ملاحظة</p>
      </div>
      <div class="page-head__actions">
        ${
          filters.filter === 'trashed' && notes.length
            ? `<button class="btn btn--danger-soft btn--sm" id="empty-trash">${icon('trash2')} إفراغ السلة</button>`
            : ''
        }
        <button class="btn btn--primary btn--sm" id="page-new-note">${icon('plus')} ملاحظة جديدة</button>
      </div>
    </div>

    <div class="toolbar">
      <div class="chips">
        ${chip('all', 'كل الملاحظات', state.stats?.stats?.notes)}
        ${chip('pinned', 'المثبّتة', state.stats?.stats?.pinned)}
        ${chip('archived', 'المؤرشفة', state.stats?.stats?.archived)}
        ${chip('trashed', 'المحذوفات', state.stats?.stats?.trashed)}
      </div>

      <div style="margin-inline-start:auto;display:flex;gap:.5rem;align-items:center">
        <select class="select" id="sort-select" style="width:auto;padding-block:.4375rem;font-size:.8125rem">
          <option value="updated" ${filters.sort === 'updated' ? 'selected' : ''}>الأحدث تعديلاً</option>
          <option value="created" ${filters.sort === 'created' ? 'selected' : ''}>الأحدث إنشاءً</option>
          <option value="title" ${filters.sort === 'title' ? 'selected' : ''}>العنوان (أ-ي)</option>
        </select>
        <button class="btn btn--ghost btn--icon" id="order-toggle" aria-label="عكس الترتيب"
                title="${filters.order === 'desc' ? 'تصاعدي' : 'تنازلي'}">
          ${icon('arrowLeft')}
        </button>
      </div>
    </div>

    <div id="notes-container">
      ${loading && !notes.length ? skeletons() : notes.length ? (view === 'grid' ? grid(notes) : list(notes)) : emptyState()}
    </div>
  `;

  bind(host);
}

function chip(key, label, count) {
  const active = state.filters.filter === key && !state.filters.folderId && !state.filters.tagId;
  return `
    <button class="filter-chip ${active ? 'is-active' : ''}" data-filter="${key}">
      ${esc(label)}
      ${count !== undefined && count !== null ? `<span class="filter-chip__count">${count}</span>` : ''}
    </button>`;
}

function skeletons() {
  return `<div class="notes-grid">
    ${Array.from({ length: 6 })
      .map(
        () => `<div class="note-card" style="cursor:default">
          <div class="skeleton" style="height:1.1rem;width:65%"></div>
          <div class="skeleton" style="height:.8rem;width:100%"></div>
          <div class="skeleton" style="height:.8rem;width:80%"></div>
          <div class="skeleton" style="height:.7rem;width:40%;margin-top:auto"></div>
        </div>`,
      )
      .join('')}
  </div>`;
}

function grid(notes) {
  const isTrash = state.filters.filter === 'trashed';
  return `<div class="notes-grid">${notes.map((n) => card(n, isTrash)).join('')}</div>`;
}

function card(n, isTrash) {
  const cls = NOTE_CLASS[n.color] || NOTE_CLASS.default;
  return `
    <article class="note-card ${cls}" data-note="${n.id}" tabindex="0" role="button"
             aria-label="${esc(n.title || 'ملاحظة بدون عنوان')}">
      <div class="note-card__top">
        <h3 class="note-card__title ${n.title ? '' : 'is-empty'} clamp-2">${esc(n.title || 'بدون عنوان')}</h3>
        <div class="note-card__actions">
          ${
            isTrash
              ? `<button class="note-card__btn" data-act="restore" data-id="${n.id}" title="استرجاع">${icon('restore')}</button>
                 <button class="note-card__btn" data-act="delete" data-id="${n.id}" title="حذف نهائي">${icon('trash2')}</button>`
              : `<button class="note-card__btn ${n.isPinned ? 'is-active' : ''}" data-act="pin" data-id="${n.id}" title="تثبيت">${icon('pin')}</button>
                 <button class="note-card__btn" data-act="archive" data-id="${n.id}" title="أرشفة">${icon('archive')}</button>
                 <button class="note-card__btn" data-act="trash" data-id="${n.id}" title="حذف">${icon('trash')}</button>`
          }
        </div>
      </div>

      ${n.excerpt ? `<p class="note-card__excerpt clamp-3">${esc(n.excerpt)}</p>` : '<p class="note-card__excerpt" style="opacity:.45">لا يوجد نص في هذه الملاحظة</p>'}

      <div class="note-card__foot">
        ${n.tags
          .slice(0, 3)
          .map(
            (t) =>
              `<span class="tag-pill" style="--tag-color:${esc(t.color)};background:${esc(t.color)}1f;color:${esc(t.color)}">${esc(t.name)}</span>`,
          )
          .join('')}
        ${n.isPinned ? `<span class="badge badge--primary">${icon('pin')} مثبّتة</span>` : ''}
        <span class="note-card__time">${timeAgo(n.updatedAt)}</span>
      </div>
    </article>`;
}

function list(notes) {
  const isTrash = state.filters.filter === 'trashed';
  return `<div class="notes-list">
    ${notes
      .map(
        (n) => `
      <article class="note-row" data-note="${n.id}" tabindex="0" role="button">
        <span class="note-row__icon" style="background:${esc(n.tags[0]?.color || 'var(--surface-3)')}22;color:${esc(n.tags[0]?.color || 'var(--text-muted)')}">
          ${icon('note')}
        </span>
        <div class="note-row__main">
          <div class="note-row__title truncate">${esc(n.title || 'بدون عنوان')}</div>
          <div class="note-row__excerpt truncate">${esc(n.excerpt || 'لا يوجد نص')}</div>
        </div>
        <div class="note-row__meta">
          ${
            isTrash
              ? `<button class="btn btn--ghost btn--icon btn--sm" data-act="restore" data-id="${n.id}" title="استرجاع">${icon('restore')}</button>
                 <button class="btn btn--ghost btn--icon btn--sm" data-act="delete" data-id="${n.id}" title="حذف نهائي">${icon('trash2')}</button>`
              : `<button class="btn btn--ghost btn--icon btn--sm ${n.isPinned ? 'is-active' : ''}" data-act="pin" data-id="${n.id}" title="تثبيت">${icon('pin')}</button>
                 <button class="btn btn--ghost btn--icon btn--sm" data-act="archive" data-id="${n.id}" title="أرشفة">${icon('archive')}</button>
                 <button class="btn btn--ghost btn--icon btn--sm" data-act="trash" data-id="${n.id}" title="حذف">${icon('trash')}</button>`
          }
          <span class="text-sm text-muted" style="white-space:nowrap">${shortDate(n.updatedAt)}</span>
        </div>
      </article>`,
      )
      .join('')}
  </div>`;
}

function emptyState() {
  const isTrash = state.filters.filter === 'trashed';
  const searching = !!state.filters.q;

  if (searching) {
    return `<div class="empty">
      <div class="empty__icon">${icon('search')}</div>
      <h3 class="empty__title">لا توجد نتائج</h3>
      <p class="empty__text">لم نعثر على أي ملاحظة تطابق «${esc(state.filters.q)}». جرّب كلمات مختلفة.</p>
    </div>`;
  }

  if (isTrash) {
    return `<div class="empty">
      <div class="empty__icon">${icon('trash')}</div>
      <h3 class="empty__title">سلة المحذوفات فارغة</h3>
      <p class="empty__text">لا توجد ملاحظات محذوفة. كل شيء في مكانه.</p>
    </div>`;
  }

  return `<div class="empty">
    <div class="empty__icon">${icon('sparkle')}</div>
    <h3 class="empty__title">ابدأ تدوين أفكارك</h3>
    <p class="empty__text">لم تكتب أي ملاحظة بعد. اضغط «ملاحظة جديدة» لتبدأ بتسجيل أفكارك ومشاريعك.</p>
    <div class="empty__action">
      <button class="btn btn--primary" data-create-first>${icon('plus')} إنشاء أول ملاحظة</button>
    </div>
  </div>`;
}

/* ------------------------------ الأحداث ------------------------------ */

function bind(host) {
  host.querySelector('#page-new-note')?.addEventListener('click', () => openEditor(null));
  host.querySelector('[data-create-first]')?.addEventListener('click', () => openEditor(null));

  on(host, '[data-filter]', 'click', (e) => {
    setFilters({ filter: e.currentTarget.dataset.filter, folderId: null, tagId: null });
    rerender();
  });

  host.querySelector('#sort-select')?.addEventListener('change', (e) => {
    setFilters({ sort: e.target.value });
    rerender();
  });

  host.querySelector('#order-toggle')?.addEventListener('click', () => {
    setFilters({ order: state.filters.order === 'desc' ? 'asc' : 'desc' });
    rerender();
  });

  host.querySelector('#empty-trash')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'إفراغ سلة المحذوفات؟',
      message: 'سيتم حذف جميع الملاحظات المحذوفة نهائياً ولا يمكن التراجع عن ذلك.',
      confirmText: 'حذف نهائي',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.emptyTrash();
      toast(`تم حذف ${res.deleted} ملاحظة نهائياً`);
      await loadNotes();
      rerender();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // فتح الملاحظة
  on(host, '[data-note]', 'click', (e) => {
    if (e.target.closest('[data-act]')) return;
    const id = Number(e.currentTarget.dataset.note);
    openEditor(id);
  });

  on(host, '[data-note]', 'keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openEditor(Number(e.currentTarget.dataset.note));
    }
  });

  // إجراءات البطاقة
  on(host, '[data-act]', 'click', async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const id = Number(btn.dataset.id);
    const act = btn.dataset.act;

    try {
      if (act === 'pin') {
        const res = await api.pinNote(id);
        toast(res.isPinned ? 'تم تثبيت الملاحظة' : 'تم إلغاء التثبيت', 'info');
      } else if (act === 'archive') {
        const res = await api.archiveNote(id);
        toast(res.isArchived ? 'تمت أرشفة الملاحظة' : 'تم إلغاء الأرشفة', 'info');
      } else if (act === 'trash') {
        await api.trashNote(id);
        toast('نُقلت الملاحظة إلى سلة المحذوفات', 'info');
      } else if (act === 'restore') {
        await api.restoreNote(id);
        toast('تمت استعادة الملاحظة');
      } else if (act === 'delete') {
        const ok = await confirmDialog({
          title: 'حذف الملاحظة نهائياً؟',
          message: 'سيتم حذف الملاحظة ومحتواها نهائياً. لا يمكن التراجع عن هذا الإجراء.',
          confirmText: 'حذف نهائي',
          danger: true,
        });
        if (!ok) return;
        await api.deleteNote(id);
        toast('تم حذف الملاحظة نهائياً');
      }
      await loadNotes();
      rerender();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
