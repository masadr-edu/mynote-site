/* ==========================================================================
   ملاحظاتي — شاشة الدخول والتسجيل
   ========================================================================== */

import { api } from '../api.js';
import { esc, on, toast } from '../utils.js';
import { icon } from '../icons.js';
import { setTheme } from '../utils.js';

let mode = 'login';
let busy = false;

const IS_CLOUD = typeof window !== 'undefined' && window.__MYNOTE_CLOUD__ === true;

const FEATURES = [
  { icon: 'lock', text: IS_CLOUD ? 'بياناتك محفوظة في حسابك السحابي ومحميّة بكلمة مرورك' : 'بياناتك محفوظة محلياً في قاعدة خاصة بك' },
  { icon: 'shield', text: 'عزل كامل — لا يمكن لأي مستخدم الوصول لماحظاتك' },
  { icon: 'search', text: 'بحث فوري وتقسيم ذكي بالمجلدات والوسوم' },
];

export function renderAuth(root, { onSuccess }) {
  root.hidden = false;
  root.innerHTML = `
    <aside class="auth__aside">
      <div class="auth__brand">
        <span class="auth__logo">${icon('logo')}</span>
        <span class="auth__brand-text">ملاحظاتي</span>
      </div>

      <div class="auth__pitch">
        <h1 class="auth__headline">أفكارك، مرتّبة<br/>ومؤمّنة بالكامل.</h1>
        <p class="auth__lead">
          مساحة خاصة لكل مستخدم لتدوين ملاحظاته ومشاريعه وأفكاره —
          بدون ضجيج، وبخصوصية تامة.
        </p>
        <ul class="auth__features">
          ${FEATURES.map(
            (f) => `<li class="auth__feature">
              <span class="auth__feature-icon">${icon(f.icon)}</span>
              <span>${esc(f.text)}</span>
            </li>`,
          ).join('')}
        </ul>
      </div>

      <p class="auth__foot">${IS_CLOUD ? 'نسخة سحابية • Supabase' : 'منتج محلي • قاعدة بيانات على جهازك'} • ${new Date().getFullYear()}</p>
    </aside>

    <section class="auth__panel">
      <div class="auth__form-wrap">
        <div class="auth__mobile-brand">
          <span class="sidebar__logo">${icon('logo')}</span>
          <strong style="font-size:1.125rem">ملاحظاتي</strong>
        </div>
        <div id="auth-form"></div>
      </div>
    </section>
  `;

  const formHost = root.querySelector('#auth-form');
  drawForm(formHost, onSuccess);
}

function drawForm(host, onSuccess) {
  const isLogin = mode === 'login';

  host.innerHTML = `
    <h2 class="auth__title">${isLogin ? 'أهلاً بعودتك' : 'أنشئ حسابك الجديد'}</h2>
    <p class="auth__subtitle">
      ${
        isLogin
          ? 'سجّل الدخول للوصول إلى ملاحظاتك الخاصة.'
          : 'لديك بضع ثوانٍ فقط للحصول على مساحتك الخاصة.'
      }
    </p>

    <form class="auth__form" id="auth-form-el" novalidate>
      ${
        isLogin
          ? ''
          : `<div class="field">
               <label class="field__label" for="af-name">الاسم الكامل</label>
               <input class="input" id="af-name" name="displayName" type="text"
                      placeholder="مثال: سارة العتيبي" autocomplete="name" required />
               <span class="field__error" data-error="displayName" hidden></span>
             </div>`
      }

      <div class="field">
        <label class="field__label" for="af-email">البريد الإلكتروني</label>
        <input class="input" id="af-email" name="email" type="email"
               placeholder="name@example.com" autocomplete="email" dir="ltr" required />
        <span class="field__error" data-error="email" hidden></span>
      </div>

      <div class="field field--password">
        <label class="field__label" for="af-password">كلمة المرور</label>
        <input class="input" id="af-password" name="password" type="password"
               placeholder="••••••••" autocomplete="${
                 isLogin ? 'current-password' : 'new-password'
               }" required />
        <button class="field__toggle" type="button" data-toggle-pass aria-label="إظهار كلمة المرور">
          ${icon('eye')}
        </button>
        <span class="field__error" data-error="password" hidden></span>
        ${
          isLogin
            ? ''
            : `<div class="strength" id="af-strength" aria-hidden="true">
                 <span class="strength__bar"></span><span class="strength__bar"></span>
                 <span class="strength__bar"></span><span class="strength__bar"></span>
               </div>
               <span class="field__hint">8 أحرف على الأقل، وتحتوي على حرف ورقم.</span>`
        }
      </div>

      ${
        isLogin
          ? `<div class="auth__row">
               <label class="switch" style="cursor:pointer">
                 <input type="checkbox" id="af-remember" checked />
                 <span class="switch__track"></span>
                 <span style="font-size:.8125rem;color:var(--text-secondary)">تذكّرني</span>
               </label>
             </div>`
          : ''
      }

      <button class="btn btn--primary btn--lg btn--block" type="submit" id="af-submit">
        ${isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب'}
      </button>
    </form>

    <div class="auth__switch">
      ${
        isLogin
          ? `ليس لديك حساب؟ <button type="button" data-switch-mode="register">أنشئ حساباً جديداً</button>`
          : `لديك حساب بالفعل؟ <button type="button" data-switch-mode="login">سجّل الدخول</button>`
      }
    </div>

    <div class="auth__security-note">
      ${icon('shield')}
      <span>${
        IS_CLOUD
          ? 'تُخزَّن كلمة المرور مشفّرة على خادم Supabase، ولا يمكن لأحد قراءة نصها.'
          : 'تُخزَّن كلمة المرور مشفّرة بخوارزمية <strong>scrypt</strong>، ولا يمكن لأحد قراءة نصها.'
      }</span>
    </div>
  `;

  const form = host.querySelector('#auth-form-el');
  const passInput = host.querySelector('#af-password');
  const submitBtn = host.querySelector('#af-submit');

  // إظهار/إخفاء كلمة المرور
  host.querySelector('[data-toggle-pass]').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const show = passInput.type === 'password';
    passInput.type = show ? 'text' : 'password';
    btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
    btn.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
    passInput.focus();
  });

  // مؤشر قوة كلمة المرور
  const strength = host.querySelector('#af-strength');
  if (strength) {
    passInput.addEventListener('input', () => {
      const v = passInput.value;
      let score = 0;
      if (v.length >= 8) score++;
      if (/[A-Za-z؀-ۿ]/.test(v)) score++;
      if (/[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) score++;
      strength.querySelectorAll('.strength__bar').forEach((bar, i) => {
        bar.className = 'strength__bar' + (i < score ? ` is-active-${score}` : '');
      });
    });
  }

  // تبديل الوضع
  on(host, '[data-switch-mode]', 'click', (e) => {
    mode = e.currentTarget.dataset.switchMode;
    drawForm(host, onSuccess);
  });

  // إرسال النموذج
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;

    clearErrors(form);
    const fd = new FormData(form);
    const payload = {
      email: String(fd.get('email') || '').trim(),
      password: String(fd.get('password') || ''),
    };
    if (!isLogin) payload.displayName = String(fd.get('displayName') || '').trim();

    // تحقق مبدئي
    let valid = true;
    if (!payload.email || !payload.email.includes('@')) {
      setError(form, 'email', 'يرجى إدخال بريد إلكتروني صحيح');
      valid = false;
    }
    if (!payload.password) {
      setError(form, 'password', 'كلمة المرور مطلوبة');
      valid = false;
    }
    if (!isLogin && payload.displayName.length < 2) {
      setError(form, 'displayName', 'يرجى إدخال اسمك (حرفان على الأقل)');
      valid = false;
    }
    if (!isLogin && payload.password.length < 8) {
      setError(form, 'password', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      valid = false;
    }
    if (!valid) return;

    busy = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> جارٍ المعالجة…';

    try {
      const result = isLogin ? await api.login(payload) : await api.register(payload);
      toast(isLogin ? 'مرحباً بعودتك! 👋' : 'تم إنشاء حسابك بنجاح 🎉');
      onSuccess(result.user);
    } catch (err) {
      handleAuthError(err, form, isLogin);
    } finally {
      busy = false;
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب';
    }
  });

  // تركيز أول حقل
  setTimeout(() => host.querySelector('input')?.focus(), 120);
}

function handleAuthError(err, form, isLogin) {
  if (err.details?.length) {
    for (const d of err.details) setError(form, d.field, d.message);
    return;
  }
  const field = isLogin ? 'password' : 'email';
  setError(form, field, err.message);
  toast(err.message, 'error');
}

function setError(form, field, message) {
  const el = form.querySelector(`[data-error="${field}"]`);
  const input = form.querySelector(`[name="${field}"]`);
  if (el) {
    el.textContent = message;
    el.hidden = false;
  }
  if (input) input.setAttribute('aria-invalid', 'true');
}

function clearErrors(form) {
  form.querySelectorAll('[data-error]').forEach((el) => {
    el.hidden = true;
    el.textContent = '';
  });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}
