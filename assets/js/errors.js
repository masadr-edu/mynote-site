/* ==========================================================================
   ملاحظاتي — تحويل أخطاء Supabase إلى رسائل عربية واضحة
   ========================================================================== */

/** ترجمة رسائل Supabase/GoTrue الشائعة إلى العربية */
export function friendlyMessage(raw) {
  const m = String(raw || '');
  if (/Invalid login credentials/i.test(m)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  if (/User already registered|already been registered/i.test(m)) return 'هذا البريد الإلكتروني مسجّل بالفعل';
  if (/Email not confirmed/i.test(m)) return 'يجب تأكيد بريدك الإلكتروني أولاً — تحقّق من صندوق الوارد.';
  if (/Password should be at least/i.test(m)) return 'كلمة المرور قصيرة جداً';
  if (/rate limit|too many requests|Too Many Requests/i.test(m)) {
    return 'عدد كبير من المحاولات. يرجى المحاولة بعد قليل.';
  }
  if (/duplicate key value/i.test(m)) return 'هذا العنصر موجود بالفعل';
  if (/JWT expired|invalid claim|refresh_token|session_not_found/i.test(m)) {
    return 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.';
  }
  if (/Failed to fetch|NetworkError|Load failed|network error/i.test(m)) {
    return 'تعذّر الاتصال بالخادم. تحقّق من اتصالك بالإنترنت.';
  }
  if (/permission denied|row-level security/i.test(m)) return 'لا تملك صلاحية لهذا الإجراء';
  if (/relation .* does not exist|schema cache/i.test(m)) {
    return 'قاعدة البيانات غير مهيأة. نفّذ ملف supabase/schema.sql أولاً.';
  }
  return m || 'حدث خطأ غير متوقع';
}

/** يحوّل خطأ Supabase إلى ApiError بالرسالة العربية المناسبة */
export function toApiError(error, ApiError, fallbackMessage) {
  const raw = error?.message || error?.error_description || fallbackMessage;
  let status = Number(error?.status) || 400;
  if (/duplicate key value/i.test(String(raw))) status = 409;
  if (/Invalid login credentials|Email not confirmed/i.test(String(raw))) status = 401;
  return new ApiError(friendlyMessage(raw), status);
}
