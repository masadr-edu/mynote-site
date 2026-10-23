/* ============================================================================
   ملاحظاتي — إعدادات الاتصال بـ Supabase
   ============================================================================

   كيف تحصل على القيمتين:
     1) افتح  https://supabase.com/dashboard  واختر مشروعك
     2) Settings  →  API
     3) انسخ:
          • Project URL          →  url
          • Project API keys → anon / public  →  anonKey

   ملاحظة أمنية مهمة:
     مفتاح anon مصمَّم ليكون علنياً في المتصفح، وهو آمن للنشر.
     الحماية الحقيقية تأتي من سياسات RLS الموجودة في supabase/schema.sql.
     لا تضع هنا أبداً مفتاح service_role (فهو يتجاوز كل السياسات).

   بعد التعديل: أعد بناء النسخة المنشورة بالأمر
     node scripts/build-docs.mjs
   ========================================================================== */

window.MYNOTE_SUPABASE = {
  url: 'https://xkgpjsdcsaazzprcrzxj.supabase.co',
  anonKey: 'sb_publishable_bDdhpjlWmBw7itwCiYI8Ug_48gGYQ7d',
};
