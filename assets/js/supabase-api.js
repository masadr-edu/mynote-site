/* ==========================================================================
   ملاحظاتي — طبقة البيانات السحابية (Supabase)
   --------------------------------------------------------------------------
   تحلّ هذه الطبقة محل محرك localStorage السابق.
   تُستخدم فقط في النسخة المنشورة ثابتاً (GitHub Pages) عندما تكون
   window.__MYNOTE_CLOUD__ === true.
   التطبيق المحلي (Node + SQLite) لا يتأثر بها إطلاقاً.

   الأمان: كل الجداول محمية بـ Row Level Security، وكل استعلام مقيّد
   بـ auth.uid() — لا يمكن لأي مستخدم قراءة بيانات غيره حتى مع معرفة
   مفتاح anon (المفتاح علني بطبيعته في تطبيقات Supabase).
   ========================================================================== */

import { getClient, isConfigured } from './supabase-client.js';
import { toApiError } from './errors.js';
import { createAuthService } from './auth-service.js';

export { isConfigured };

const NOTE_SELECT =
  'id,title,content,color,folder_id,is_pinned,is_archived,is_trashed,created_at,updated_at,' +
  'note_tags(tags(id,name,color))';

const NOTE_COLORS = ['default', 'blue', 'green', 'purple', 'amber', 'rose', 'teal', 'slate'];
const TAG_PALETTE = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#EF4444', '#6366F1'];
const MAX_VERSIONS = 20;

/* ------------------------------- أدوات ------------------------------- */

function normalizeText(text) {
  return String(text || '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

const excerptOf = (content) => String(content || '').replace(/\s+/g, ' ').trim().slice(0, 220);

/* ------------------------------ الأخطاء ------------------------------ */

let ApiErrorRef = Error;

function fail(error, fallbackMessage) {
  throw toApiError(error, ApiErrorRef, fallbackMessage);
}

/* ----------------------------- التحويلات ----------------------------- */

function mapUser(profile, authUser) {
  return {
    id: profile?.id || authUser?.id,
    email: profile?.email || authUser?.email || '',
    displayName: profile?.display_name || authUser?.user_metadata?.display_name || '',
    avatarColor: profile?.avatar_color || '#4F6BED',
    theme: profile?.theme || 'light',
    createdAt: profile?.created_at || authUser?.created_at || new Date().toISOString(),
    lastLoginAt: profile?.last_login_at || null,
  };
}

function mapNote(row) {
  return {
    id: row.id,
    title: row.title || '',
    content: row.content || '',
    excerpt: excerptOf(row.content),
    color: row.color || 'default',
    folderId: row.folder_id,
    isPinned: !!row.is_pinned,
    isArchived: !!row.is_archived,
    isTrashed: !!row.is_trashed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: (row.note_tags || [])
      .map((nt) => nt.tags)
      .filter(Boolean)
      .map((t) => ({ id: t.id, name: t.name, color: t.color }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
  };
}

const mapFolder = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  icon: row.icon,
  position: row.position,
  createdAt: row.created_at,
  noteCount: 0,
});

const mapTag = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  noteCount: 0,
});

/* ------------------------------ مساعدات ------------------------------ */

async function requireAuth() {
  const sb = getClient();
  const { data, error } = await sb.auth.getSession();
  if (error) fail(error);
  const user = data?.session?.user;
  if (!user) throw new ApiErrorRef('يجب تسجيل الدخول للمتابعة', 401);
  return { sb, uid: user.id, authUser: user };
}

async function fetchProfile(sb, authUser) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
  if (error) fail(error);
  return mapUser(data, authUser);
}

/** جلب ملاحظة واحدة بالشكل الكامل */
async function fetchNoteRow(sb, id) {
  const { data, error } = await sb
    .from('notes')
    .select(NOTE_SELECT)
    .eq('id', Number(id))
    .maybeSingle();
  if (error) fail(error);
  return data;
}

/** إنشاء الوسوم غير الموجودة وإرجاع معرفاتها */
async function ensureTags(sb, uid, names) {
  const unique = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))].slice(0, 20);
  const ids = [];

  for (const name of unique) {
    const { data: existing, error: findErr } = await sb
      .from('tags')
      .select('id')
      .eq('user_id', uid)
      .ilike('name', name)
      .maybeSingle();
    if (findErr) fail(findErr);

    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const color = TAG_PALETTE[ids.length % TAG_PALETTE.length];
    const { data: created, error: insErr } = await sb
      .from('tags')
      .insert({ user_id: uid, name, color })
      .select('id')
      .single();

    if (insErr) {
      // قد يكون أُنشئ بالتوازي — نحاول القراءة مرة أخرى
      const { data: again } = await sb.from('tags').select('id').eq('user_id', uid).ilike('name', name).maybeSingle();
      if (again) ids.push(again.id);
      continue;
    }
    ids.push(created.id);
  }
  return ids;
}

/** استبدال وسوم ملاحظة */
async function replaceNoteTags(sb, noteId, tagIds) {
  const { error: delErr } = await sb.from('note_tags').delete().eq('note_id', noteId);
  if (delErr) fail(delErr);
  if (!tagIds.length) return;
  const { error: insErr } = await sb
    .from('note_tags')
    .insert(tagIds.map((tag_id) => ({ note_id: noteId, tag_id })));
  if (insErr) fail(insErr);
}

/** حفظ نسخة سابقة والاحتفاظ بآخر 20 فقط */
async function saveVersion(sb, uid, noteRow) {
  await sb.from('note_versions').insert({
    note_id: noteRow.id,
    user_id: uid,
    title: noteRow.title || '',
    content: noteRow.content || '',
  });

  const { data: old } = await sb
    .from('note_versions')
    .select('id')
    .eq('note_id', noteRow.id)
    .order('created_at', { ascending: false })
    .range(MAX_VERSIONS, MAX_VERSIONS + 200);

  if (old?.length) {
    await sb.from('note_versions').delete().in('id', old.map((r) => r.id));
  }
}

/** تسجيل نشاط (لا يفشل العملية إن تعذّر) */
async function logActivity(sb, uid, action, meta = {}) {
  try {
    await sb.from('activity_log').insert({ user_id: uid, action, meta });
  } catch {
    /* تجاهل */
  }
}

/* ==========================================================================
   الواجهة العامة
   ========================================================================== */

export async function createCloudApi(ApiError) {
  ApiErrorRef = ApiError;

  /* ------------------------------ المصادقة ------------------------------ */

  // كل عمليات المصادقة تمرّ عبر وحدة واحدة بسيطة: cloud/auth-service.js
  const authService = createAuthService({ ApiError });

  const auth = {
    async me() {
      const sb = getClient();
      const authUser = await authService.getCurrentUser();
      if (!authUser) return { user: null };
      return { user: await fetchProfile(sb, authUser) };
    },

    async register(payload = {}) {
      const sb = getClient();

      const { user, needsConfirmation } = await authService.signUp({
        email: payload.email,
        password: payload.password,
        displayName: payload.displayName,
      });

      if (needsConfirmation) {
        throw new ApiErrorRef(
          'تم إنشاء حسابك ✓ — افتح رسالة التأكيد في بريدك ثم سجّل الدخول.',
          202,
        );
      }

      logActivity(sb, user.id, 'register');
      return { user: await fetchProfile(sb, user) };
    },

    async login(payload = {}) {
      const sb = getClient();
      const { user } = await authService.signIn({
        email: payload.email,
        password: payload.password,
      });

      await sb.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
      logActivity(sb, user.id, 'login');

      return { user: await fetchProfile(sb, user) };
    },

    async logout() {
      const sb = getClient();
      const authUser = await authService.getCurrentUser();
      if (authUser) logActivity(sb, authUser.id, 'logout');
      await authService.signOut();
      return { ok: true };
    },

    async changePassword(payload = {}) {
      const { uid } = await requireAuth();

      // التحقق من كلمة المرور الحالية بإعادة تسجيل الدخول
      await authService.verifyPassword(payload.currentPassword);
      await authService.updatePassword(payload.newPassword);

      logActivity(getClient(), uid, 'password_change');
      return { ok: true, message: 'تم تغيير كلمة المرور بنجاح' };
    },
  };

  /* ------------------------------ الملاحظات ------------------------------ */

  const notes = {
    async listNotes(params = {}) {
      const { sb, uid } = await requireAuth();

      const filter = params.filter || 'all';
      const sort = params.sort || 'updated';
      const ascending = params.order === 'asc';
      const limit = Math.min(Number(params.limit) || 60, 200);
      const offset = Math.max(Number(params.offset) || 0, 0);

      let query = sb.from('notes').select(NOTE_SELECT, { count: 'exact' }).eq('user_id', uid);

      if (filter === 'trashed') {
        query = query.eq('is_trashed', true);
      } else {
        query = query.eq('is_trashed', false);
        if (filter === 'pinned') query = query.eq('is_pinned', true);
        else if (filter === 'archived') query = query.eq('is_archived', true);
        else query = query.eq('is_archived', false);
      }

      const folderId =
        params.folderId === undefined || params.folderId === null || params.folderId === 'null'
          ? null
          : Number(params.folderId);
      if (folderId !== null) query = query.eq('folder_id', folderId);

      if (params.tagId) {
        const { data: links, error: linkErr } = await sb
          .from('note_tags')
          .select('note_id')
          .eq('tag_id', Number(params.tagId));
        if (linkErr) fail(linkErr);
        const ids = (links || []).map((l) => l.note_id);
        if (!ids.length) return { notes: [], total: 0, limit, offset };
        query = query.in('id', ids);
      }

      const terms = normalizeText(params.q).split(/\s+/).filter(Boolean);
      for (const term of terms) {
        query = query.like('search_text', `%${term}%`);
      }

      const column = sort === 'title' ? 'title' : sort === 'created' ? 'created_at' : 'updated_at';

      const { data, error, count } = await query
        .order(column, { ascending, nullsFirst: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) fail(error);

      return {
        notes: (data || []).map(mapNote),
        total: count ?? (data || []).length,
        limit,
        offset,
      };
    },

    async getNote(id) {
      const { sb } = await requireAuth();
      const row = await fetchNoteRow(sb, id);
      if (!row) throw new ApiErrorRef('الملاحظة غير موجودة', 404);
      return { note: mapNote(row) };
    },

    async createNote(payload = {}) {
      const { sb, uid } = await requireAuth();

      const color = NOTE_COLORS.includes(payload.color) ? payload.color : 'default';
      const folderId = payload.folderId == null ? null : Number(payload.folderId);

      const { data: created, error } = await sb
        .from('notes')
        .insert({
          user_id: uid,
          title: String(payload.title || '').slice(0, 300),
          content: String(payload.content || ''),
          color,
          folder_id: folderId,
        })
        .select('id')
        .single();
      if (error) fail(error);

      if (payload.tags?.length) {
        const tagIds = await ensureTags(sb, uid, payload.tags);
        await replaceNoteTags(sb, created.id, tagIds);
      }

      return { note: mapNote(await fetchNoteRow(sb, created.id)) };
    },

    async updateNote(id, payload = {}) {
      const { sb, uid } = await requireAuth();
      const current = await fetchNoteRow(sb, id);
      if (!current) throw new ApiErrorRef('الملاحظة غير موجودة', 404);

      const patch = {};
      if (payload.title !== undefined) patch.title = String(payload.title).slice(0, 300);
      if (payload.content !== undefined) patch.content = String(payload.content);
      if (payload.color !== undefined && NOTE_COLORS.includes(payload.color)) patch.color = payload.color;
      if (payload.folderId !== undefined) patch.folder_id = payload.folderId == null ? null : Number(payload.folderId);
      if (payload.isPinned !== undefined) patch.is_pinned = !!payload.isPinned;
      if (payload.isArchived !== undefined) patch.is_archived = !!payload.isArchived;

      const contentChanged =
        (patch.title !== undefined && patch.title !== current.title) ||
        (patch.content !== undefined && patch.content !== current.content);

      if (contentChanged) await saveVersion(sb, uid, current);

      if (Object.keys(patch).length) {
        const { error } = await sb.from('notes').update(patch).eq('id', Number(id));
        if (error) fail(error);
      }

      if (payload.tags !== undefined) {
        const tagIds = await ensureTags(sb, uid, payload.tags);
        await replaceNoteTags(sb, Number(id), tagIds);
      }

      return { note: mapNote(await fetchNoteRow(sb, id)) };
    },

    async trashNote(id) {
      const { sb } = await requireAuth();
      const { error } = await sb
        .from('notes')
        .update({ is_trashed: true, trashed_at: new Date().toISOString() })
        .eq('id', Number(id));
      if (error) fail(error);
      return { ok: true };
    },

    async restoreNote(id) {
      const { sb } = await requireAuth();
      const { error } = await sb
        .from('notes')
        .update({ is_trashed: false, trashed_at: null })
        .eq('id', Number(id));
      if (error) fail(error);
      return { ok: true };
    },

    async deleteNote(id) {
      const { sb } = await requireAuth();
      const { error } = await sb.from('notes').delete().eq('id', Number(id));
      if (error) fail(error);
      return { ok: true };
    },

    async pinNote(id) {
      const { sb } = await requireAuth();
      const { data, error } = await sb.rpc('toggle_note_pin', { p_note_id: Number(id) });
      if (error) fail(error);
      return { ok: true, isPinned: !!data };
    },

    async archiveNote(id) {
      const { sb } = await requireAuth();
      const { data, error } = await sb.rpc('toggle_note_archive', { p_note_id: Number(id) });
      if (error) fail(error);
      return { ok: true, isArchived: !!data };
    },

    async emptyTrash() {
      const { sb, uid } = await requireAuth();
      const { data, error } = await sb
        .from('notes')
        .delete()
        .eq('user_id', uid)
        .eq('is_trashed', true)
        .select('id');
      if (error) fail(error);
      return { ok: true, deleted: (data || []).length };
    },

    async listVersions(id) {
      const { sb } = await requireAuth();
      const { data, error } = await sb
        .from('note_versions')
        .select('id,title,content,created_at')
        .eq('note_id', Number(id))
        .order('created_at', { ascending: false })
        .limit(MAX_VERSIONS);
      if (error) fail(error);

      return {
        versions: (data || []).map((v) => ({
          id: v.id,
          title: v.title,
          excerpt: excerptOf(v.content),
          content: v.content,
          createdAt: v.created_at,
        })),
      };
    },

    async restoreVersion(id, versionId) {
      const { sb, uid } = await requireAuth();

      const current = await fetchNoteRow(sb, id);
      if (!current) throw new ApiErrorRef('الملاحظة غير موجودة', 404);

      const { data: version, error: vErr } = await sb
        .from('note_versions')
        .select('id,title,content')
        .eq('id', Number(versionId))
        .eq('note_id', Number(id))
        .maybeSingle();
      if (vErr) fail(vErr);
      if (!version) throw new ApiErrorRef('النسخة غير موجودة', 404);

      await saveVersion(sb, uid, current);

      const { error } = await sb
        .from('notes')
        .update({ title: version.title, content: version.content })
        .eq('id', Number(id));
      if (error) fail(error);

      return { note: mapNote(await fetchNoteRow(sb, id)) };
    },
  };

  /* ------------------------------ المجلدات ------------------------------ */

  const folders = {
    async listFolders() {
      const { sb, uid } = await requireAuth();

      const [{ data: rows, error }, { data: noteRows }] = await Promise.all([
        sb.from('folders').select('*').eq('user_id', uid).order('position').order('created_at'),
        sb.from('notes').select('folder_id').eq('user_id', uid).eq('is_trashed', false),
      ]);
      if (error) fail(error);

      const counts = new Map();
      for (const n of noteRows || []) {
        if (n.folder_id != null) counts.set(n.folder_id, (counts.get(n.folder_id) || 0) + 1);
      }

      return {
        folders: (rows || []).map((r) => ({ ...mapFolder(r), noteCount: counts.get(r.id) || 0 })),
      };
    },

    async createFolder(payload = {}) {
      const { sb, uid } = await requireAuth();

      const { data: last } = await sb
        .from('folders')
        .select('position')
        .eq('user_id', uid)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data, error } = await sb
        .from('folders')
        .insert({
          user_id: uid,
          name: String(payload.name || '').trim().slice(0, 60),
          color: /^#[0-9a-fA-F]{6}$/.test(payload.color || '') ? payload.color : '#4F6BED',
          icon: String(payload.icon || 'folder').slice(0, 30),
          position: (last?.position || 0) + 1,
        })
        .select('*')
        .single();
      if (error) fail(error);

      return { folder: mapFolder(data) };
    },

    async updateFolder(id, payload = {}) {
      const { sb } = await requireAuth();
      const patch = {};
      if (payload.name !== undefined) patch.name = String(payload.name).trim().slice(0, 60);
      if (payload.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(payload.color)) patch.color = payload.color;
      if (payload.icon !== undefined) patch.icon = String(payload.icon).slice(0, 30);

      const { data, error } = await sb.from('folders').update(patch).eq('id', Number(id)).select('*').single();
      if (error) fail(error);
      return { folder: mapFolder(data) };
    },

    async deleteFolder(id) {
      const { sb } = await requireAuth();
      const { error } = await sb.from('folders').delete().eq('id', Number(id));
      if (error) fail(error);
      return { ok: true };
    },
  };

  /* ------------------------------- الوسوم ------------------------------- */

  const tags = {
    async listTags() {
      const { sb, uid } = await requireAuth();

      const [{ data: rows, error }, { data: links }] = await Promise.all([
        sb.from('tags').select('*').eq('user_id', uid),
        sb.from('note_tags').select('tag_id,notes(is_trashed)'),
      ]);
      if (error) fail(error);

      const counts = new Map();
      for (const l of links || []) {
        if (l.notes?.is_trashed) continue;
        counts.set(l.tag_id, (counts.get(l.tag_id) || 0) + 1);
      }

      const list = (rows || [])
        .map((r) => ({ ...mapTag(r), noteCount: counts.get(r.id) || 0 }))
        .sort((a, b) => b.noteCount - a.noteCount || a.name.localeCompare(b.name, 'ar'));

      return { tags: list };
    },

    async createTag(payload = {}) {
      const { sb, uid } = await requireAuth();
      const { data, error } = await sb
        .from('tags')
        .insert({
          user_id: uid,
          name: String(payload.name || '').trim().slice(0, 40),
          color: /^#[0-9a-fA-F]{6}$/.test(payload.color || '') ? payload.color : '#8B5CF6',
        })
        .select('*')
        .single();
      if (error) {
        if (/duplicate key/i.test(error.message || '')) {
          throw new ApiErrorRef('هذا الوسم موجود بالفعل', 409);
        }
        fail(error);
      }
      return { tag: mapTag(data) };
    },

    async updateTag(id, payload = {}) {
      const { sb } = await requireAuth();
      const patch = {};
      if (payload.name !== undefined) patch.name = String(payload.name).trim().slice(0, 40);
      if (payload.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(payload.color)) patch.color = payload.color;

      const { data, error } = await sb.from('tags').update(patch).eq('id', Number(id)).select('*').single();
      if (error) {
        if (/duplicate key/i.test(error.message || '')) throw new ApiErrorRef('هذا الوسم موجود بالفعل', 409);
        fail(error);
      }
      return { tag: mapTag(data) };
    },

    async deleteTag(id) {
      const { sb } = await requireAuth();
      const { error } = await sb.from('tags').delete().eq('id', Number(id));
      if (error) fail(error);
      return { ok: true };
    },
  };

  /* ------------------------------ المستخدم ------------------------------ */

  const userApi = {
    async stats() {
      const { sb } = await requireAuth();
      const { data, error } = await sb.rpc('user_stats');
      if (error) fail(error);

      return (
        data || {
          stats: { notes: 0, pinned: 0, trashed: 0, archived: 0, folders: 0, tags: 0, total: 0, words: 0 },
          timeline: [],
          topFolders: [],
          topTags: [],
        }
      );
    },

    async updateProfile(payload = {}) {
      const { sb, uid, authUser } = await requireAuth();
      const patch = {};
      if (payload.displayName !== undefined) patch.display_name = String(payload.displayName).trim().slice(0, 60);
      if (payload.avatarColor !== undefined) patch.avatar_color = payload.avatarColor;
      if (payload.theme !== undefined) patch.theme = payload.theme;

      const { data, error } = await sb.from('profiles').update(patch).eq('id', uid).select('*').single();
      if (error) fail(error);
      return { user: mapUser(data, authUser) };
    },

    async sessions() {
      const { sb } = await requireAuth();
      const { data } = await sb.auth.getSession();
      const session = data?.session;
      if (!session) return { sessions: [] };

      return {
        sessions: [
          {
            id: String(session.access_token || '').slice(-12) || 'current',
            createdAt: new Date((session.expires_at || 0) * 1000 - 3600 * 1000).toISOString(),
            expiresAt: new Date((session.expires_at || 0) * 1000).toISOString(),
            lastSeenAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            ip: '',
          },
        ],
      };
    },

    async activity() {
      const { sb } = await requireAuth();
      const { data, error } = await sb
        .from('activity_log')
        .select('action,meta,ip,created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) fail(error);

      return {
        activity: (data || []).map((a) => ({
          action: a.action,
          meta: a.meta || {},
          ip: a.ip || '',
          createdAt: a.created_at,
        })),
      };
    },

    async exportData() {
      const { sb, uid, authUser } = await requireAuth();

      const [{ data: noteRows }, { data: folders }, { data: tags }] = await Promise.all([
        sb.from('notes').select(NOTE_SELECT).eq('user_id', uid).order('created_at', { ascending: false }),
        sb.from('folders').select('*').eq('user_id', uid),
        sb.from('tags').select('*').eq('user_id', uid),
      ]);

      return {
        exportedAt: new Date().toISOString(),
        user: {
          email: authUser.email,
          displayName: (await fetchProfile(sb, authUser)).displayName,
        },
        folders: (folders || []).map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
          icon: f.icon,
          position: f.position,
        })),
        tags: (tags || []).map((t) => ({ id: t.id, name: t.name, color: t.color })),
        notes: (noteRows || []).map((n) => {
          const note = mapNote(n);
          return {
            id: note.id,
            title: note.title,
            content: note.content,
            color: note.color,
            folderId: note.folderId,
            isPinned: note.isPinned,
            isArchived: note.isArchived,
            isTrashed: note.isTrashed,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            tags: note.tags.map((t) => t.name),
          };
        }),
      };
    },

    async deleteAccount() {
      const { sb } = await requireAuth();
      const { error } = await sb.rpc('delete_own_account');
      if (error) fail(error);
      await authService.signOut({ local: true });
      return { ok: true };
    },
  };

  return { ...auth, ...notes, ...folders, ...tags, ...userApi };
}

/* ------------------------------ الواجهة ------------------------------ */

let instance = null;

export async function getCloudApi(ApiError) {
  if (!instance) instance = await createCloudApi(ApiError);
  return instance;
}
