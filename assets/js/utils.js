/* ==========================================================================
   ملاحظاتي — أدوات مساعدة مشتركة
   ========================================================================== */

/** تهريب النص لمنع حقن HTML */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** استعلام + تفويض الأحداث */
export function on(root, selector, event, handler) {
  if (!root) return;
  root.querySelectorAll(selector).forEach((el) => el.addEventListener(event, handler));
}

/** تأخير التنفيذ */
export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** الحروف الأولى من الاسم */
export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

/* ----------------------------- التواريخ ----------------------------- */

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

/** وقت نسبي بالعربية */
export function timeAgo(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${mins} دقيقة`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? 'قبل ساعة' : hours === 2 ? 'قبل ساعتين' : `قبل ${hours} ساعات`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'أمس';
  if (days === 2) return 'منذ يومين';
  if (days < 7) return `منذ ${days} أيام`;

  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'قبل أسبوع';
  if (weeks < 5) return `قبل ${weeks} أسابيع`;

  return formatDate(iso);
}

/** تاريخ كامل */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** تاريخ ووقت */
export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${formatDate(iso)} — ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** اسم اليوم */
export function dayName(iso) {
  if (!iso) return '';
  return AR_DAYS[new Date(iso).getDay()];
}

/** توقيت نسبي قصير للعرض في البطاقات */
export function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
}

/* ----------------------------- إشعارات ----------------------------- */

const ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
};

export function toast(message, type = 'success', duration = 3200) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="toast__icon">${ICONS[type] || ICONS.info}</span>
    <span class="toast__msg">${esc(message)}</span>
  `;
  root.appendChild(el);

  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 250);
  }, duration);
}

/* ----------------------------- نوافذ ----------------------------- */

/**
 * فتح نافذة منبثقة.
 * @returns {{el: HTMLElement, close: () => void}}
 */
export function openModal({ title = '', subtitle = '', header = '', body = '', footer = '', size = '', onMount } = {}) {
  const root = document.getElementById('modal-root');
  root.hidden = false;
  root.innerHTML = `
    <div class="modal__backdrop" data-modal-close></div>
    <div class="modal ${size ? `modal--${size}` : ''}" role="dialog" aria-modal="true">
      ${
        header
          ? header
          : title
            ? `<header class="modal__header">
                 <div>
                   <h2 class="modal__title">${esc(title)}</h2>
                   ${subtitle ? `<p class="modal__subtitle">${esc(subtitle)}</p>` : ''}
                 </div>
                 <button class="btn btn--ghost btn--icon" data-modal-close aria-label="إغلاق">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                 </button>
               </header>`
            : ''
      }
      <div class="modal__body">${body}</div>
      ${footer ? `<footer class="modal__footer">${footer}</footer>` : ''}
    </div>
  `;

  const close = () => {
    root.hidden = true;
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
  };

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  root.querySelectorAll('[data-modal-close]').forEach((el) => el.addEventListener('click', close));
  document.addEventListener('keydown', onKey);

  const modal = root.querySelector('.modal');
  if (onMount) onMount(modal, close);

  return { el: modal, close };
}

/** نافذة تأكيد */
export function confirmDialog({ title, message, confirmText = 'تأكيد', cancelText = 'إلغاء', danger = false }) {
  return new Promise((resolve) => {
    const { close } = openModal({
      title: '',
      body: `
        <div class="modal__icon ${danger ? 'modal__icon--danger' : 'modal__icon--primary'}">
          ${
            danger
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/></svg>'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>'
          }
        </div>
        <h3 style="font-size:1.0625rem;margin-bottom:.375rem">${esc(title)}</h3>
        <p style="font-size:.875rem;line-height:1.7">${esc(message)}</p>
      `,
      footer: `
        <button class="btn" data-cancel>${esc(cancelText)}</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-confirm>${esc(confirmText)}</button>
      `,
      onMount(modal, closeModal) {
        modal.querySelector('[data-cancel]').addEventListener('click', () => {
          closeModal();
          resolve(false);
        });
        modal.querySelector('[data-confirm]').addEventListener('click', () => {
          closeModal();
          resolve(true);
        });
      },
    });

    document.addEventListener(
      'keydown',
      function esc2(e) {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', esc2);
          resolve(false);
        }
      },
      { once: true },
    );
  });
}

/* ----------------------------- misc ----------------------------- */

export function setTheme(theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0D0F17' : '#4F6BED');
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

export function hexToRgba(hex, alpha = 1) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

export function highlight(text, term) {
  if (!term) return esc(text);
  const safe = esc(text);
  const pattern = term.trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!pattern.length) return safe;
  return safe.replace(new RegExp(`(${pattern.join('|')})`, 'gi'), '<mark>$1</mark>');
}

export function wordCount(text = '') {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
