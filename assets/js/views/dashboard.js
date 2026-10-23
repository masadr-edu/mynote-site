/* ==========================================================================
   ملاحظاتي — لوحة التحكم
   ========================================================================== */

import { esc, on } from '../utils.js';
import { icon } from '../icons.js';
import { state } from '../store.js';

const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'ليلة موفقة';
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'نهارك سعيد';
  if (h < 21) return 'مساء الخير';
  return 'مساء الخير';
}

export function renderDashboard(host, { onNavigate, onNewNote }) {
  const stats = state.stats?.stats || {
    notes: 0, pinned: 0, archived: 0, trashed: 0, folders: 0, tags: 0, total: 0, words: 0,
  };
  const timeline = state.stats?.timeline || [];
  const topFolders = state.stats?.topFolders || [];
  const topTags = state.stats?.topTags || [];

  const now = new Date();
  const dateLabel = `${AR_DAYS[now.getDay()]} ${now.getDate()} ${AR_MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const maxCount = Math.max(...timeline.map((t) => t.c), 1);

  const cards = [
    { key: 'notes', label: 'ملاحظات نشطة', value: stats.notes, icon: 'notes', tone: 'primary' },
    { key: 'pinned', label: 'ملاحظات مثبّتة', value: stats.pinned, icon: 'pin', tone: 'warning' },
    { key: 'words', label: 'كلمة مكتوبة', value: stats.words.toLocaleString('ar-EG'), icon: 'text', tone: 'info' },
    { key: 'folders', label: 'مجلدات', value: stats.folders, icon: 'folder', tone: 'success' },
  ];

  host.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-head__title">${greeting()}، ${esc(state.user?.displayName?.split(' ')[0] || '')} 👋</h1>
        <p class="page-head__desc">${esc(dateLabel)}</p>
      </div>
      <div class="page-head__actions">
        <button class="btn btn--primary btn--sm" id="dash-new">${icon('plus')} ملاحظة جديدة</button>
      </div>
    </div>

    <div class="stats-grid">
      ${cards
        .map(
          (c) => `
        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--${c.tone}">${icon(c.icon)}</div>
          <div class="stat-card__value">${c.value}</div>
          <div class="stat-card__label">${esc(c.label)}</div>
        </div>`,
        )
        .join('')}
    </div>

    <div class="dash-grid">
      <section class="card">
        <header class="card__header">
          <h2 class="card__title">${icon('trending')} نشاط آخر 7 أيام</h2>
          <span class="text-sm text-muted">${timeline.reduce((a, b) => a + b.c, 0)} ملاحظة</span>
        </header>
        <div class="card__body">
          ${
            timeline.length
              ? `<div class="chart">
                  ${timeline
                    .map((t) => {
                      const d = new Date(t.day);
                      return `<div class="chart__col" title="${t.c} ملاحظة">
                        <span class="chart__value">${t.c}</span>
                        <div class="chart__bar ${t.c ? '' : 'chart__bar--empty'}" style="height:${Math.max(
                          (t.c / maxCount) * 100,
                          4,
                        )}%"></div>
                        <span class="chart__label">${AR_DAYS[d.getDay()].slice(0, 3)}</span>
                      </div>`;
                    })
                    .join('')}
                </div>`
              : `<div class="empty" style="padding:2rem 0">
                   <div class="empty__icon">${icon('trending')}</div>
                   <p class="empty__text">لا يوجد نشاط بعد. أنشئ أول ملاحظة لتبدأ!</p>
                 </div>`
          }
        </div>
      </section>

      <section class="card">
        <header class="card__header">
          <h2 class="card__title">${icon('folder')} المجلدات الأكثر استخداماً</h2>
        </header>
        <div class="card__body">
          ${
            topFolders.length
              ? `<div class="progress-list">
                  ${topFolders
                    .map(
                      (f) => `
                    <div class="progress-item">
                      <div class="progress-item__head">
                        <span class="progress-item__name">${esc(f.name)}</span>
                        <span class="progress-item__count">${f.count}</span>
                      </div>
                      <div class="progress-item__track">
                        <div class="progress-item__fill" style="width:${stats.notes ? (f.count / stats.notes) * 100 : 0}%;background:${esc(f.color)}"></div>
                      </div>
                    </div>`,
                    )
                    .join('')}
                </div>`
              : `<p class="text-sm text-muted">لم تنشئ أي مجلدات بعد.</p>`
          }
        </div>
      </section>
    </div>

    <div class="dash-grid">
      <section class="card">
        <header class="card__header">
          <h2 class="card__title">${icon('tag')} الوسوم</h2>
          <button class="btn btn--ghost btn--sm" data-go-tags>عرض الكل</button>
        </header>
        <div class="card__body">
          ${
            topTags.length
              ? `<div style="display:flex;flex-wrap:wrap;gap:.4375rem">
                  ${topTags
                    .map(
                      (t) => `<button class="tag-pill" data-go-tag="${t.id}"
                        style="--tag-color:${esc(t.color)};background:${esc(t.color)}1f;color:${esc(t.color)}">
                        ${esc(t.name)} <span style="opacity:.6">(${t.count})</span></button>`,
                    )
                    .join('')}
                </div>`
              : `<p class="text-sm text-muted">لا توجد وسوم بعد — أضف وسوماً لملاحظاتك لتسهيل الوصول إليها.</p>`
          }
        </div>
      </section>

      <section class="card">
        <header class="card__header">
          <h2 class="card__title">${icon('sparkle')} إجراءات سريعة</h2>
        </header>
        <div class="card__body">
          <div class="quick-grid" style="grid-template-columns:1fr">
            <button class="quick-card" data-quick="new">
              <span class="quick-card__icon" style="background:var(--primary-50);color:var(--primary-600)">${icon('plus')}</span>
              <span><span class="quick-card__title">ملاحظة جديدة</span><span class="quick-card__desc">ابدأ تدوين فكرة الآن</span></span>
            </button>
            <button class="quick-card" data-quick="pinned">
              <span class="quick-card__icon" style="background:var(--warning-soft);color:var(--warning)">${icon('pin')}</span>
              <span><span class="quick-card__title">الملاحظات المثبّتة</span><span class="quick-card__desc">${stats.pinned} ملاحظة مثبّتة</span></span>
            </button>
            <button class="quick-card" data-quick="trash">
              <span class="quick-card__icon" style="background:var(--danger-soft);color:var(--danger)">${icon('trash')}</span>
              <span><span class="quick-card__title">سلة المحذوفات</span><span class="quick-card__desc">${stats.trashed} عنصر محذوف</span></span>
            </button>
          </div>
        </div>
      </section>
    </div>
  `;

  host.querySelector('#dash-new')?.addEventListener('click', onNewNote);

  on(host, '[data-quick]', 'click', (e) => {
    const action = e.currentTarget.dataset.quick;
    if (action === 'new') onNewNote();
    else onNavigate({ name: 'notes', params: { filter: action, folderId: null, tagId: null, q: '' } });
  });

  on(host, '[data-go-tag]', 'click', (e) => {
    const id = Number(e.currentTarget.dataset.goTag);
    onNavigate({ name: 'notes', params: { tagId: id, filter: 'all', folderId: null, q: '' } });
  });

  host.querySelector('[data-go-tags]')?.addEventListener('click', () => {
    onNavigate({ name: 'notes', params: { filter: 'all', tagId: null, folderId: null, q: '' } });
  });
}
