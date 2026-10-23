/* ==========================================================================
   ملاحظاتي — محرر الملاحظات
   ========================================================================== */

import { api } from '../api.js';
import { esc, on, toast, confirmDialog, openModal, timeAgo, formatDateTime } from '../utils.js';
import { icon } from '../icons.js';
import { state, loadNotes, loadStats } from '../store.js';

const COLORS = [
  { id: 'default', label: 'افتراضي', hex: '#FFFFFF' },
  { id: 'blue', label: 'أزرق', hex: '#4F6BED' },
  { id: 'green', label: 'أخضر', hex: '#12A150' },
  { id: 'purple', label: 'بنفسجي', hex: '#8B5CF6' },
  { id: 'amber', label: 'كهرماني', hex: '#E0950B' },
  { id: 'rose', label: 'وردي', hex: '#E11D48' },
  { id: 'teal', label: 'أزرق مخضر', hex: '#0D9488' },
  { id: 'slate', label: 'رمادي', hex: '#64748B' },
];

let onSaved = () => {};
let current = null;
let saveTimer = null;
let dirty = false;

export function initEditor({ onAfterSave }) {
  onSaved = onAfterSave;
}

/* ------------------------- فتح المحرر ------------------------- */

export async function openEditor(noteId) {
  let note;
  try {
    if (noteId) {
      const res = await api.getNote(noteId);
      note = res.note;
    } else {
      const res = await api.createNote({ title: '', content: '', tags: [] });
      note = res.note;
    }
  } catch (err) {
    toast(err.message, 'error');
    return;
  }

  current = { ...note, tags: note.tags.map((t) => t.name) };
  dirty = false;

  const { el, close } = openModal({
    size: 'xl',
    header: `
      <header class="modal__header editor__header">
        <div class="editor__header-title">
          ${icon('note')}
          <span>تحرير الملاحظة</span>
        </div>
        <div class="editor__header-actions">
          <span class="editor__save-state" id="save-state">
            <span class="editor__save-dot"></span>
            <span id="save-text">محفوظ</span>
          </span>
          <button class="btn btn--ghost btn--icon" data-modal-close aria-label="إغلاق المحرر">${icon('close')}</button>
        </div>
      </header>`,
    body: template(current),
    onMount: (modal, closeModal) => {
      bind(modal, closeModal);
      setTimeout(() => modal.querySelector('.editor__title')?.focus(), 150);
    },
  });

  el.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal__backdrop')) close();
  });
}

/* ------------------------- القالب ------------------------- */

function template(note) {
  return `
    <div class="editor">
      <div class="editor__main">
        <div class="editor__toolbar">
          <button class="editor__tool" data-tool="bold" title="عريض (Ctrl+B)">${icon('bold')}</button>
          <button class="editor__tool" data-tool="italic" title="مائل (Ctrl+I)">${icon('italic')}</button>
          <button class="editor__tool" data-tool="heading" title="عنوان">${icon('text')}</button>
          <button class="editor__tool" data-tool="list" title="قائمة نقطية">${icon('listIcon')}</button>
          <button class="editor__tool" data-tool="link" title="إدراج رابط">${icon('link')}</button>
          <span style="flex:1"></span>
          <span class="editor__hint">Ctrl+S للحفظ • Esc للإغلاق</span>
        </div>

        <input class="editor__title" id="ed-title" placeholder="عنوان الملاحظة…" value="${esc(note.title)}" />
        <textarea class="editor__content" id="ed-content" placeholder="ابدأ الكتابة هنا…">${esc(note.content)}</textarea>
      </div>

      <aside class="editor__side">
        <div class="editor__group">
          <span class="editor__group-title">اللون</span>
          <div class="color-swatches" id="ed-colors">
            ${COLORS.map(
              (c) => `
              <button class="color-swatch ${note.color === c.id ? 'is-active' : ''}"
                      data-color="${c.id}" style="background:${c.hex}" title="${esc(c.label)}" aria-label="${esc(c.label)}"></button>`,
            ).join('')}
          </div>
        </div>

        <div class="editor__group">
          <span class="editor__group-title">المجلد</span>
          <select class="select" id="ed-folder">
            <option value="">بدون مجلد</option>
            ${state.folders
              .map(
                (f) =>
                  `<option value="${f.id}" ${note.folderId === f.id ? 'selected' : ''}>${esc(f.name)}</option>`,
              )
              .join('')}
          </select>
        </div>

        <div class="editor__group">
          <span class="editor__group-title">الوسوم</span>
          <div class="tag-editor" id="ed-tags">
            ${note.tags.map((t) => tagChip(t)).join('')}
            <input class="tag-input" id="ed-tag-input" placeholder="أضف وسماً…" />
          </div>
        </div>

        <div class="editor__group">
          <span class="editor__group-title">الحالة</span>
          <button class="btn ${note.isPinned ? 'btn--soft' : ''} btn--block" id="ed-pin">
            ${icon('pin')} ${note.isPinned ? 'مثبّتة — إلغاء التثبيت' : 'تثبيت الملاحظة'}
          </button>
          <button class="btn btn--block" id="ed-archive">
            ${icon('archive')} ${note.isArchived ? 'إلغاء الأرشفة' : 'أرشفة'}
          </button>
        </div>

        <div class="editor__group">
          <span class="editor__group-title">التاريخ</span>
          <div class="editor__meta">
            <span>أُنشئت: ${formatDateTime(note.createdAt)}</span>
            <span>آخر تعديل: ${timeAgo(note.updatedAt)}</span>
          </div>
          <button class="btn btn--ghost btn--sm" id="ed-versions">${icon('history')} سجل الإصدارات</button>
        </div>

        <div class="editor__group">
          <button class="btn btn--danger-soft btn--block" id="ed-delete">${icon('trash')} نقل إلى سلة المحذوفات</button>
        </div>
      </aside>
    </div>
  `;
}

function tagChip(name) {
  return `<span class="tag-chip" data-tag-name="${esc(name)}">${esc(name)}
    <button type="button" data-remove-tag="${esc(name)}" aria-label="حذف الوسم">${icon('close')}</button>
  </span>`;
}

/* ------------------------- الأحداث ------------------------- */

function bind(modal, close) {
  const titleEl = modal.querySelector('#ed-title');
  const contentEl = modal.querySelector('#ed-content');
  const saveState = modal.querySelector('#save-state');
  const saveText = modal.querySelector('#save-text');

  const markDirty = () => {
    dirty = true;
    saveState.classList.add('is-saving');
    saveText.textContent = 'جارٍ الحفظ…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(), 900);
  };

  async function save() {
    if (!current) return;
    try {
      const res = await api.updateNote(current.id, {
        title: titleEl.value,
        content: contentEl.value,
        folderId: modal.querySelector('#ed-folder').value ? Number(modal.querySelector('#ed-folder').value) : null,
        color: current.color,
        tags: current.tags,
        isPinned: current.isPinned,
        isArchived: current.isArchived,
      });
      current = { ...res.note, tags: res.note.tags.map((t) => t.name) };
      dirty = false;
      saveState.classList.remove('is-saving');
      saveText.textContent = 'محفوظ';
      await loadNotes();
      await loadStats();
      onSaved();
    } catch (err) {
      saveState.classList.remove('is-saving');
      saveText.textContent = 'تعذّر الحفظ';
      toast(err.message, 'error');
    }
  }

  titleEl.addEventListener('input', () => {
    autoGrow(titleEl);
    markDirty();
  });
  contentEl.addEventListener('input', markDirty);

  //'expanding' textarea
  contentEl.addEventListener('input', () => autoGrow(contentEl));

  // أدوات التنسيق
  on(modal, '[data-tool]', 'click', (e) => {
    const tool = e.currentTarget.dataset.tool;
    applyTool(tool, contentEl);
    markDirty();
  });

  // اختصارات
  modal.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      clearTimeout(saveTimer);
      save();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyTool('bold', contentEl);
      markDirty();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyTool('italic', contentEl);
      markDirty();
    }
  });

  // الألوان
  on(modal, '[data-color]', 'click', async (e) => {
    const color = e.currentTarget.dataset.color;
    current.color = color;
    modal.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('is-active', b === e.currentTarget));
    try {
      await api.updateNote(current.id, { color });
      await loadNotes();
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // المجلد
  modal.querySelector('#ed-folder').addEventListener('change', (e) => {
    current.folderId = e.target.value ? Number(e.target.value) : null;
    markDirty();
  });

  // الوسوم
  const tagInput = modal.querySelector('#ed-tag-input');
  const tagHost = modal.querySelector('#ed-tags');

  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = tagInput.value.trim().replace(/^#/, '');
      if (value && !current.tags.includes(value)) {
        current.tags.push(value);
        tagHost.insertAdjacentHTML('beforeend', tagChip(value));
        markDirty();
      }
      tagInput.value = '';
    } else if (e.key === 'Backspace' && !tagInput.value && current.tags.length) {
      const removed = current.tags.pop();
      tagHost.querySelector(`[data-tag-name="${CSS.escape(removed)}"]`)?.remove();
      markDirty();
    }
  });

  on(modal, '[data-remove-tag]', 'click', (e) => {
    e.preventDefault();
    const name = e.currentTarget.dataset.removeTag;
    current.tags = current.tags.filter((t) => t !== name);
    e.currentTarget.closest('.tag-chip')?.remove();
    markDirty();
  });

  // التثبيت والأرشفة
  modal.querySelector('#ed-pin').addEventListener('click', async () => {
    try {
      const res = await api.pinNote(current.id);
      current.isPinned = res.isPinned;
      const btn = modal.querySelector('#ed-pin');
      btn.className = `btn btn--block ${res.isPinned ? 'btn--soft' : ''}`;
      btn.innerHTML = `${icon('pin')} ${res.isPinned ? 'مثبّتة — إلغاء التثبيت' : 'تثبيت الملاحظة'}`;
      await loadNotes();
      onSaved();
      toast(res.isPinned ? 'تم تثبيت الملاحظة' : 'تم إلغاء التثبيت', 'info');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  modal.querySelector('#ed-archive').addEventListener('click', async () => {
    try {
      const res = await api.archiveNote(current.id);
      current.isArchived = res.isArchived;
      const btn = modal.querySelector('#ed-archive');
      btn.innerHTML = `${icon('archive')} ${res.isArchived ? 'إلغاء الأرشفة' : 'أرشفة'}`;
      await loadNotes();
      onSaved();
      toast(res.isArchived ? 'تمت أرشفة الملاحظة' : 'تم إلغاء الأرشفة', 'info');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // الإصدارات
  modal.querySelector('#ed-versions').addEventListener('click', () => openVersions(current, modal, save));

  // الحذف
  modal.querySelector('#ed-delete').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'نقل الملاحظة إلى سلة المحذوفات؟',
      message: 'يمكنك استرجاعها لاحقاً من سلة المحذوفات.',
      confirmText: 'نقل إلى السلة',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.trashNote(current.id);
      clearTimeout(saveTimer);
      current = null;
      close();
      toast('نُقلت الملاحظة إلى سلة المحذوفات', 'info');
      await loadNotes();
      await loadStats();
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // حفظ عند الإغلاق
  modal.closest('.modal-root')?.addEventListener(
    'click',
    (e) => {
      if (e.target.classList.contains('modal__backdrop')) {
        if (dirty) {
          clearTimeout(saveTimer);
          save();
        }
      }
    },
    true,
  );
}

/* ------------------------- أدوات ------------------------- */

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function applyTool(tool, textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);

  const wrap = {
    bold: ['**', '**'],
    italic: ['_', '_'],
    heading: ['## ', ''],
    list: ['- ', ''],
    link: ['[', '](https://)'],
  };

  const [before, after] = wrap[tool] || ['', ''];
  textarea.value = value.slice(0, start) + before + selected + after + value.slice(end);
  textarea.focus();
  const caret = start + before.length + selected.length;
  textarea.setSelectionRange(caret, caret);
  autoGrow(textarea);
}

/* ------------------------- الإصدارات ------------------------- */

async function openVersions(note, parentModal, onRestore) {
  let versions = [];
  try {
    const res = await api.listVersions(note.id);
    versions = res.versions;
  } catch (err) {
    toast(err.message, 'error');
    return;
  }

  const { close } = openModal({
    title: 'سجل الإصدارات',
    subtitle: versions.length ? `${versions.length} نسخة محفوظة` : 'لا توجد نسخ محفوظة',
    size: 'md',
    body: versions.length
      ? `<div class="version-list">
          ${versions
            .map(
              (v) => `
            <button class="version-item" data-version="${v.id}">
              <div class="version-item__time">${formatDateTime(v.createdAt)}</div>
              <div class="version-item__text">${esc(v.title || 'بدون عنوان')}</div>
              <div class="version-item__text" style="opacity:.7">${esc(v.excerpt || '')}</div>
            </button>`,
            )
            .join('')}
        </div>`
      : `<div class="empty" style="padding:2rem 0">
           <div class="empty__icon">${icon('history')}</div>
           <h3 class="empty__title">لا توجد إصدارات</h3>
           <p class="empty__text">تُحفظ النسخ السابقة تلقائياً عند كل تعديل على نص الملاحظة.</p>
         </div>`,
    onMount(modal, closeModal) {
      on(modal, '[data-version]', 'click', async (e) => {
        const versionId = Number(e.currentTarget.dataset.version);
        const ok = await confirmDialog({
          title: 'استرجاع هذه النسخة؟',
          message: 'سيتم استبدال النص الحالي بمحتوى النسخة المختارة. تُحفظ نسختك الحالية قبل الاسترجاع.',
          confirmText: 'استرجاع',
        });
        if (!ok) return;
        try {
          await api.restoreVersion(note.id, versionId);
          closeModal();
          toast('تم استرجاع النسخة');
          await loadNotes();
          onSaved();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    },
  });
}
