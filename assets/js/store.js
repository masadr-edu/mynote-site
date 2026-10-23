/* ==========================================================================
   ملاحظاتي — إدارة الحالة (Store)
   ========================================================================== */

import { api } from './api.js';

const listeners = new Map();

export const state = {
  user: null,
  route: { name: 'dashboard', params: {} },
  view: localStorage.getItem('mn:view') || 'grid',
  notes: [],
  folders: [],
  tags: [],
  stats: null,
  total: 0,
  loading: false,
  filters: {
    q: '',
    filter: 'all',
    folderId: null,
    tagId: null,
    sort: 'updated',
    order: 'desc',
  },
  sidebarOpen: false,
};

/* ------------------------------ الأحداث ------------------------------ */

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event).delete(handler);
}

export function emit(event, payload) {
  (listeners.get(event) || []).forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[store] فشل مستمع الحدث "${event}"`, err);
    }
  });
}

/* ------------------------------ الحالة ------------------------------ */

export function setState(patch) {
  Object.assign(state, patch);
  emit('change', state);
}

export function setFilters(patch) {
  Object.assign(state.filters, patch);
  emit('filters', state.filters);
}

export function setView(view) {
  state.view = view;
  localStorage.setItem('mn:view', view);
  emit('change', state);
}

/* ------------------------------ التحميل ------------------------------ */

export async function loadFolders() {
  const { folders } = await api.listFolders();
  state.folders = folders;
  emit('folders', folders);
  return folders;
}

export async function loadTags() {
  const { tags } = await api.listTags();
  state.tags = tags;
  emit('tags', tags);
  return tags;
}

export async function loadNotes() {
  state.loading = true;
  emit('loading', true);
  try {
    const params = { ...state.filters };
    const { notes, total } = await api.listNotes(params);
    state.notes = notes;
    state.total = total;
    emit('notes', notes);
    return notes;
  } finally {
    state.loading = false;
    emit('loading', false);
  }
}

export async function loadStats() {
  const data = await api.stats();
  state.stats = data;
  emit('stats', data);
  return data;
}

/** تحديث نسخة من الملاحظة داخل القائمة */
export function patchNoteLocal(note) {
  const idx = state.notes.findIndex((n) => n.id === note.id);
  if (idx >= 0) {
    state.notes[idx] = { ...state.notes[idx], ...note };
    emit('notes', state.notes);
  }
}

/** إدراج ملاحظة جديدة في أعلى القائمة */
export function prependNote(note) {
  state.notes = [note, ...state.notes];
  state.total += 1;
  emit('notes', state.notes);
}

/** إزالة ملاحظة من القائمة */
export function removeNoteLocal(id) {
  state.notes = state.notes.filter((n) => n.id !== id);
  state.total = Math.max(0, state.total - 1);
  emit('notes', state.notes);
}
