/* ==========================================================================
   ملاحظاتي — طبقة الاتصال بالـ API
   ========================================================================== */

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(method, path, body, options = {}) {
  const init = {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    ...options,
  };

  if (body !== undefined && body !== null) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError('تعذّر الاتصال بالخادم. تحقّق من اتصالك بالإنترنت.', 0);
  }

  if (res.status === 204) return null;

  let data = null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = data?.error || 'حدث خطأ غير متوقع';
    throw new ApiError(message, res.status, data?.details);
  }

  return data;
}

const qs = (params) => {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
  });
  const str = usp.toString();
  return str ? `?${str}` : '';
};

const liveApi = {
  /* ----------------------------- المصادقة ----------------------------- */
  register: (payload) => request('POST', '/api/auth/register', payload),
  login: (payload) => request('POST', '/api/auth/login', payload),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/auth/me'),
  changePassword: (payload) => request('POST', '/api/auth/password', payload),

  /* ------------------------------ الملاحظات ------------------------------ */
  listNotes: (params) => request('GET', `/api/notes${qs(params)}`),
  getNote: (id) => request('GET', `/api/notes/${id}`),
  createNote: (payload) => request('POST', '/api/notes', payload),
  updateNote: (id, payload) => request('PATCH', `/api/notes/${id}`, payload),
  trashNote: (id) => request('DELETE', `/api/notes/${id}`),
  restoreNote: (id) => request('POST', `/api/notes/${id}/restore`),
  deleteNote: (id) => request('DELETE', `/api/notes/${id}/permanent`),
  pinNote: (id) => request('POST', `/api/notes/${id}/pin`),
  archiveNote: (id) => request('POST', `/api/notes/${id}/archive`),
  emptyTrash: () => request('POST', '/api/notes/trash/empty'),
  listVersions: (id) => request('GET', `/api/notes/${id}/versions`),
  restoreVersion: (id, versionId) => request('POST', `/api/notes/${id}/versions/${versionId}/restore`),

  /* ------------------------------ المجلدات ------------------------------ */
  listFolders: () => request('GET', '/api/folders'),
  createFolder: (payload) => request('POST', '/api/folders', payload),
  updateFolder: (id, payload) => request('PATCH', `/api/folders/${id}`, payload),
  deleteFolder: (id) => request('DELETE', `/api/folders/${id}`),

  /* ------------------------------- الوسوم ------------------------------- */
  listTags: () => request('GET', '/api/tags'),
  createTag: (payload) => request('POST', '/api/tags', payload),
  updateTag: (id, payload) => request('PATCH', `/api/tags/${id}`, payload),
  deleteTag: (id) => request('DELETE', `/api/tags/${id}`),

  /* ------------------------------ المستخدم ------------------------------ */
  stats: () => request('GET', '/api/user/stats'),
  updateProfile: (payload) => request('PATCH', '/api/user/profile', payload),
  sessions: () => request('GET', '/api/user/sessions'),
  activity: () => request('GET', '/api/user/activity'),
  exportData: () => request('GET', '/api/user/export'),
  deleteAccount: () => request('DELETE', '/api/user/account'),
};

/* ==========================================================================
   النسخة السحابية (GitHub Pages + Supabase)
   --------------------------------------------------------------------------
   عند فتح الصفحة المنشورة ثابتاً لا يوجد خادم Node، لذلك نوجّه كل استدعاء
   إلى طبقة Supabase التي تعمل في المتصفح (مع RLS على مستوى قاعدة البيانات).
   التطبيق المحلي (Node + SQLite) لا يتأثر بهذا الفرع إطلاقاً.
   ========================================================================== */

const IS_CLOUD = typeof window !== 'undefined' && window.__MYNOTE_CLOUD__ === true;

function cloudApiProxy() {
  let ready = null;
  const resolve = () => {
    if (!ready) ready = import('./supabase-api.js').then((mod) => mod.getCloudApi(ApiError));
    return ready;
  };

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'ApiError') return ApiError;
        if (typeof prop !== 'string') return undefined;
        return (...args) => resolve().then((impl) => impl[prop](...args));
      },
    },
  );
}

export const api = IS_CLOUD ? cloudApiProxy() : { ApiError, ...liveApi };
