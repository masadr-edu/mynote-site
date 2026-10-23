/* ==========================================================================
   ملاحظاتي — عميل Supabase الوحيد (Singleton)
   --------------------------------------------------------------------------
   يُنشأ مرة واحدة ويُشارك بين طبقة البيانات وطبقة المصادقة.

   المفتاح المستخدم هنا هو "publishable / anon" وهو مفتاح علني بطبيعته،
   والحماية الحقيقية تأتي من سياسات RLS في قاعدة البيانات.
   لا يوضع هنا أبداً مفتاح service_role / secret.
   ========================================================================== */

let client = null;

/** هل الإعدادات مكتملة؟ */
export function isConfigured() {
  const cfg = globalThis.MYNOTE_SUPABASE || {};
  return Boolean(cfg.url && cfg.anonKey);
}

/** يعيد عميل Supabase (ويُنشئه عند أول استخدام) */
export function getClient() {
  if (client) return client;

  const cfg = globalThis.MYNOTE_SUPABASE || {};

  if (!cfg.url || !cfg.anonKey) {
    const err = new Error(
      'لم يتم إعداد اتصال Supabase بعد. أضف Project URL و anon key في ملف supabase-config.js',
    );
    err.status = 503;
    throw err;
  }

  if (!globalThis.supabase?.createClient) {
    const err = new Error(
      'تعذّر تحميل مكتبة Supabase. تحقّق من اتصالك بالإنترنت ثم أعد تحميل الصفحة.',
    );
    err.status = 503;
    throw err;
  }

  client = globalThis.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'mynote.auth',
    },
  });

  return client;
}
