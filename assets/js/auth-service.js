/* ==========================================================================
   ملاحظاتي — واجهة مصادقة بسيطة (Supabase Auth)
   ==========================================================================
   تسجيل الدخول وإنشاء الحساب بالبريد الإلكتروني وكلمة المرور.

   الاستخدام في أي صفحة HTML:

     <form id="login-form">
       <input type="email"    name="email"    required />
       <input type="password" name="password" required />
       <button type="submit">تسجيل الدخول</button>
     </form>

     <script type="module">
       import { authService } from './auth-service.js';

       document.getElementById('login-form').addEventListener('submit', async (e) => {
         e.preventDefault();
         const form = new FormData(e.target);
         try {
           const { user } = await authService.signIn({
             email: form.get('email'),
             password: form.get('password'),
           });
           console.log('مرحباً', user.email);
         } catch (err) {
           alert(err.message);
         }
       });
     </script>

   ملاحظة: التطبيق الحالي يستخدم هذه الوظائف نفسها عبر `api.login` و`api.register`،
   فهي ليست نسخة موازية بل الطبقة الفعلية المستخدمة في الواجهة.
   ========================================================================== */

import { getClient } from './supabase-client.js';
import { toApiError } from './errors.js';

export function createAuthService({ ApiError }) {
  const fail = (error, fallback) => {
    throw toApiError(error, ApiError, fallback);
  };

  const service = {
    /** إنشاء حساب جديد */
    async signUp({ email, password, displayName }) {
      const sb = getClient();
      const { data, error } = await sb.auth.signUp({
        email: String(email || '').trim().toLowerCase(),
        password: String(password || ''),
        options: {
          data: { display_name: String(displayName || '').trim() },
          emailRedirectTo: `${location.origin}${location.pathname}`,
        },
      });
      if (error) fail(error);

      return {
        user: data.user,
        session: data.session,
        // إن كان تأكيد البريد مفعّلاً في إعدادات Supabase فلن توجد جلسة بعد
        needsConfirmation: !data.session,
      };
    },

    /** تسجيل الدخول */
    async signIn({ email, password }) {
      const sb = getClient();
      const { data, error } = await sb.auth.signInWithPassword({
        email: String(email || '').trim().toLowerCase(),
        password: String(password || ''),
      });
      if (error) fail(error);
      return { user: data.user, session: data.session };
    },

    /** تسجيل الخروج — local:true ينهي الجلسة محلياً دون طلب للخادم */
    async signOut({ local = false } = {}) {
      const sb = getClient();
      await sb.auth.signOut(local ? { scope: 'local' } : undefined);
      return { ok: true };
    },

    /** الجلسة الحالية أو null */
    async getSession() {
      const sb = getClient();
      const { data } = await sb.auth.getSession();
      return data?.session || null;
    },

    /** المستخدم الحالي أو null */
    async getCurrentUser() {
      const session = await service.getSession();
      return session?.user || null;
    },

    /** التحقق من كلمة المرور الحالية (بإعادة تسجيل دخول) */
    async verifyPassword(password) {
      const sb = getClient();
      const session = await service.getSession();
      const email = session?.user?.email;
      if (!email) throw new ApiError('يجب تسجيل الدخول للمتابعة', 401);

      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password: String(password || ''),
      });
      if (error) throw new ApiError('كلمة المرور الحالية غير صحيحة', 401);
      return { user: data.user, session: data.session };
    },

    /** تغيير كلمة المرور */
    async updatePassword(newPassword) {
      const sb = getClient();
      const { error } = await sb.auth.updateUser({ password: String(newPassword || '') });
      if (error) fail(error);
      return { ok: true };
    },

    /** الاستماع لتغيّر حالة المصادقة (دخول/خروج/تجديد) */
    onAuthStateChange(callback) {
      return getClient().auth.onAuthStateChange(callback);
    },
  };

  return service;
}
