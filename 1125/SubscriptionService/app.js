/**
 * SubPulse — Subscription & Fixed Expense Dashboard
 * Pure Vanilla JavaScript (ES6+), Web Storage API, Chart.js, Blob API, FileReader API
 */

(() => {
  'use strict';

  /* =========================================================================
     1. Constants, Category Metadata & Preset / Sample Data
     ========================================================================= */
  const STORAGE_KEY = 'subpulse_subscriptions_v1';
  const PRESETS_STORAGE_KEY = 'subpulse_presets_v1';
  const BUDGET_STORAGE_KEY = 'subpulse_budget_v1';
  const THEME_KEY = 'subpulse_theme_v1';

  const CATEGORIES = ['영상/음악', '쇼핑/배달', 'AI/생산성', '클라우드/기타'];

  const CATEGORY_META = {
    '영상/음악': { color: '#6366f1', short: '영상·음악' },
    '쇼핑/배달': { color: '#f59e0b', short: '쇼핑·배달' },
    'AI/생산성': { color: '#10b981', short: 'AI·생산성' },
    '클라우드/기타': { color: '#0ea5e9', short: '클라우드·기타' }
  };

  // Default Popular 1-Click Presets (Korean university / young adult services)
  const DEFAULT_PRESETS = [
    { name: '넷플릭스', category: '영상/음악', price: 13500, billingDay: 15, badge: 'N', color: '#E50914' },
    { name: '유튜브 프리미엄', category: '영상/음악', price: 14900, billingDay: 10, badge: 'YT', color: '#FF0000' },
    { name: '쿠팡와우', category: '쇼핑/배달', price: 7890, billingDay: 5, badge: 'C', color: '#0074E9' },
    { name: 'Spotify', category: '영상/음악', price: 10900, billingDay: 20, badge: 'SP', color: '#1DB954' },
    { name: 'ChatGPT Plus', category: 'AI/생산성', price: 29000, billingDay: 12, badge: 'AI', color: '#10A37F' },
    { name: 'iCloud+ 200GB', category: '클라우드/기타', price: 4400, billingDay: 25, badge: 'iC', color: '#0EA5E9' },
    { name: '티빙 스탠다드', category: '영상/음악', price: 13500, billingDay: 18, badge: 'TV', color: '#FF153C' },
    { name: '배민클럽', category: '쇼핑/배달', price: 3990, billingDay: 8, badge: '배', color: '#2AC1BC' },
    { name: '밀리의 서재', category: 'AI/생산성', price: 9900, billingDay: 22, badge: '밀', color: '#8B5CF6' },
    { name: 'Notion Plus', category: 'AI/생산성', price: 14000, billingDay: 1, badge: 'No', color: '#334155' }
  ];

  /**
   * Generates lively sample data relative to today's date so the D-Day KPI
   * always shows imminent upcoming billing during live presentations.
   */
  function buildSampleData() {
    const today = new Date();
    const makeSampleDates = (offsetDays, monthsAgo) => {
      const nextTarget = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays);
      const billingDay = nextTarget.getDate();
      const startObj = getClampedDate(nextTarget.getFullYear(), nextTarget.getMonth() - monthsAgo, billingDay);
      return { billingDay, startDate: formatIsoDate(startObj) };
    };

    const s1 = makeSampleDates(2, 8);
    const s2 = makeSampleDates(5, 14);
    const s3 = makeSampleDates(9, 4);
    const s4 = makeSampleDates(12, 11);
    const s5 = makeSampleDates(17, 6);
    const s6 = makeSampleDates(21, 18);
    const s7 = makeSampleDates(26, 2);

    return [
      { id: generateId(), name: '넷플릭스', category: '영상/음악', price: 13500, billingCycle: 'monthly', splitCount: 2, paymentMethod: '토스뱅크', memo: '친구와 2인 1/2 정산', billingDay: s1.billingDay, startDate: s1.startDate, isActive: true },
      { id: generateId(), name: '유튜브 프리미엄', category: '영상/음악', price: 14900, billingCycle: 'monthly', splitCount: 1, paymentMethod: '카카오페이', memo: '', billingDay: s2.billingDay, startDate: s2.startDate, isActive: true },
      { id: generateId(), name: 'ChatGPT Plus', category: 'AI/생산성', price: 29000, billingCycle: 'monthly', splitCount: 1, paymentMethod: '신한카드', memo: '과제·프로젝트용', billingDay: s3.billingDay, startDate: s3.startDate, isActive: true },
      { id: generateId(), name: '쿠팡와우', category: '쇼핑/배달', price: 7890, billingCycle: 'monthly', splitCount: 1, paymentMethod: '계좌이체', memo: '', billingDay: s4.billingDay, startDate: s4.startDate, isActive: true },
      { id: generateId(), name: 'Spotify', category: '영상/음악', price: 10900, billingCycle: 'monthly', splitCount: 1, paymentMethod: '네이버페이', memo: '', billingDay: s5.billingDay, startDate: s5.startDate, isActive: true },
      { id: generateId(), name: 'iCloud+ 200GB', category: '클라우드/기타', price: 4400, billingCycle: 'monthly', splitCount: 1, paymentMethod: '애플페이', memo: '', billingDay: s6.billingDay, startDate: s6.startDate, isActive: true },
      { id: generateId(), name: '밀리의 서재', category: 'AI/생산성', price: 99000, billingCycle: 'yearly', splitCount: 1, paymentMethod: '삼성카드', memo: '연간 구독 (월 환산)', billingDay: s7.billingDay, startDate: s7.startDate, isActive: true }
    ];
  }

  /* =========================================================================
     2. Application State
     ========================================================================= */
  const nowInit = new Date();
  const state = {
    subscriptions: [], // Array<{ id, name, category, price, billingCycle, splitCount, paymentMethod, memo, billingDay, startDate, isActive }>
    presets: [], // Array<{ name, category, price, billingCycle, splitCount, billingDay, badge, color }>
    presetsCustomized: false,
    budgetLimit: 0,
    filterCategory: 'all',
    filterStatus: 'all', // 'all' | 'active' | 'inactive'
    searchQuery: '',
    sortBy: 'dday',
    viewMode: 'list', // 'list' | 'calendar'
    calendarYear: nowInit.getFullYear(),
    calendarMonth: nowInit.getMonth(),
    barMode: 'compare', // 'compare' | 'period'
    modalMode: 'subscription', // 'subscription' | 'preset'
    selectedPresetColor: '#2563EB',
    editingId: null,
    dateInputMode: 'startDate', // 'startDate' | 'billingDay'
    splitInputMode: 'ratio', // 'ratio' | 'custom'
    confirmAction: 'resetAll', // 'resetAll' | 'purgeInactive'
    chartInstance: null,
    barChartInstance: null
  };

  /* =========================================================================
     3. DOM Element Cache
     ========================================================================= */
  const el = {
    btnSample: document.getElementById('btn-sample'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnImportJson: document.getElementById('btn-import-json'),
    inputImportJson: document.getElementById('input-import-json'),
    btnReset: document.getElementById('btn-reset'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),

    simBanner: document.getElementById('sim-banner'),
    simBannerText: document.getElementById('sim-banner-text'),
    btnSimRestoreAll: document.getElementById('btn-sim-restore-all'),
    btnSimPurgeOff: document.getElementById('btn-sim-purge-off'),

    btnBudgetToggle: document.getElementById('btn-budget-toggle'),
    btnBudgetLabel: document.getElementById('btn-budget-label'),
    budgetEditor: document.getElementById('budget-editor'),
    fieldBudget: document.getElementById('field-budget'),
    btnBudgetClear: document.getElementById('btn-budget-clear'),
    monthProgressWrap: document.getElementById('month-progress-wrap'),
    monthPaidLabel: document.getElementById('month-paid-label'),
    monthRemainLabel: document.getElementById('month-remain-label'),
    monthProgressFill: document.getElementById('month-progress-fill'),
    budgetGaugeWrap: document.getElementById('budget-gauge-wrap'),
    budgetTargetLabel: document.getElementById('budget-target-label'),
    budgetStatusPill: document.getElementById('budget-status-pill'),
    budgetGaugeFill: document.getElementById('budget-gauge-fill'),

    kpiMonthly: document.getElementById('kpi-monthly'),
    kpiMonthlyOriginal: document.getElementById('kpi-monthly-original'),
    kpiMonthlyMeta: document.getElementById('kpi-monthly-meta'),
    kpiAnnual: document.getElementById('kpi-annual'),
    kpiAnalogyEmoji: document.getElementById('kpi-analogy-emoji'),
    kpiAnalogyText: document.getElementById('kpi-analogy-text'),
    kpiAnalogySub: document.getElementById('kpi-analogy-sub'),
    kpiDdayBadge: document.getElementById('kpi-dday-badge'),
    kpiDdayService: document.getElementById('kpi-dday-service'),
    kpiDdayMeta: document.getElementById('kpi-dday-meta'),

    presetGrid: document.getElementById('preset-grid'),
    mobilePresetSelect: document.getElementById('mobile-preset-select'),
    btnMobilePresetAdd: document.getElementById('btn-mobile-preset-add'),
    btnMobilePresetRemove: document.getElementById('btn-mobile-preset-remove'),
    btnRestorePresets: document.getElementById('btn-restore-presets'),
    btnOpenPresetModal: document.getElementById('btn-open-preset-modal'),
    btnOpenAddModal: document.getElementById('btn-open-add-modal'),

    categoryChartCanvas: document.getElementById('category-chart'),
    chartCenter: document.getElementById('chart-center'),
    chartCenterLabel: document.getElementById('chart-center-label'),
    chartCenterValue: document.getElementById('chart-center-value'),
    chartEmpty: document.getElementById('chart-empty'),
    categoryBreakdown: document.getElementById('category-breakdown'),

    barChartCanvas: document.getElementById('bar-chart'),
    barChartSub: document.getElementById('bar-chart-sub'),
    barChartEmpty: document.getElementById('bar-chart-empty'),
    barModeToggle: document.getElementById('bar-mode-toggle'),

    btnExportAllIcs: document.getElementById('btn-export-all-ics'),

    listCountBadge: document.getElementById('list-count-badge'),
    viewModeToggle: document.getElementById('view-mode-toggle'),
    searchInput: document.getElementById('search-input'),
    btnSearchClear: document.getElementById('btn-search-clear'),
    statusFilters: document.getElementById('status-filters'),
    categoryFilters: document.getElementById('category-filters'),
    sortSelect: document.getElementById('sort-select'),
    subscriptionList: document.getElementById('subscription-list'),
    calendarView: document.getElementById('calendar-view'),
    btnCalPrev: document.getElementById('btn-cal-prev'),
    btnCalNext: document.getElementById('btn-cal-next'),
    btnCalToday: document.getElementById('btn-cal-today'),
    calMonthLabel: document.getElementById('cal-month-label'),
    calMonthSummary: document.getElementById('cal-month-summary'),
    calendarGrid: document.getElementById('calendar-grid'),
    emptyState: document.getElementById('empty-state'),
    emptyTitle: document.getElementById('empty-title'),
    emptyDesc: document.getElementById('empty-desc'),
    emptyActions: document.getElementById('empty-actions'),
    btnEmptySample: document.getElementById('btn-empty-sample'),
    btnEmptyAdd: document.getElementById('btn-empty-add'),

    subModal: document.getElementById('sub-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalSubtitle: document.getElementById('modal-subtitle'),
    subForm: document.getElementById('sub-form'),
    fieldId: document.getElementById('field-id'),
    fieldName: document.getElementById('field-name'),
    fieldCategory: document.getElementById('field-category'),
    fieldCycle: document.getElementById('field-cycle'),
    fieldPriceLabel: document.getElementById('field-price-label'),
    fieldPrice: document.getElementById('field-price'),
    dateModeToggle: document.getElementById('date-mode-toggle'),
    wrapStartDate: document.getElementById('wrap-start-date'),
    wrapBillingDay: document.getElementById('wrap-billing-day'),
    fieldStartDate: document.getElementById('field-start-date'),
    fieldBillingDay: document.getElementById('field-billing-day'),
    splitModeToggle: document.getElementById('split-mode-toggle'),
    wrapSplitRatio: document.getElementById('wrap-split-ratio'),
    wrapSplitCustom: document.getElementById('wrap-split-custom'),
    fieldSplit: document.getElementById('field-split'),
    fieldCustomShare: document.getElementById('field-custom-share'),
    paymentFieldGroup: document.getElementById('payment-field-group'),
    fieldPayment: document.getElementById('field-payment'),
    memoFieldGroup: document.getElementById('memo-field-group'),
    fieldMemo: document.getElementById('field-memo'),
    presetColorGroup: document.getElementById('preset-color-group'),
    presetColorPicker: document.getElementById('preset-color-picker'),
    formPreview: document.getElementById('form-preview'),
    formError: document.getElementById('form-error'),
    btnModalClose: document.getElementById('btn-modal-close'),
    btnModalCancel: document.getElementById('btn-modal-cancel'),
    btnModalSubmit: document.getElementById('btn-modal-submit'),

    confirmModal: document.getElementById('confirm-modal'),
    confirmTitle: document.getElementById('confirm-title'),
    confirmDesc: document.getElementById('confirm-desc'),
    btnConfirmCancel: document.getElementById('btn-confirm-cancel'),
    btnConfirmOk: document.getElementById('btn-confirm-ok'),

    toastContainer: document.getElementById('toast-container')
  };

  /* =========================================================================
     4. Utility Functions (Formatting, Dates, D-Day, Analogy, Brand Visuals)
     ========================================================================= */
  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function formatKRW(amount) {
    return `${Math.round(amount).toLocaleString('ko-KR')}원`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Returns a Date clamped to the last valid day of a given year/month
   * (e.g., billingDay=31 in Feb -> Feb 28/29).
   */
  function getClampedDate(year, monthIndex, billingDay) {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return new Date(year, monthIndex, Math.min(billingDay, lastDay));
  }

  /**
   * Formats a local Date into YYYY-MM-DD.
   */
  function formatIsoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Strictly parses a YYYY-MM-DD string into a local Date (or null if invalid).
   */
  function parseIsoDate(isoStr) {
    if (typeof isoStr !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoStr.trim());
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
      return null;
    }
    return dt;
  }

  function formatKoreanDateShort(isoStr) {
    const dt = parseIsoDate(isoStr);
    if (!dt) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }

  /**
   * Computes elapsed (or upcoming) subscription duration label from startDate.
   */
  function getSubscriptionDurationText(startDateStr) {
    const startDate = parseIsoDate(startDateStr);
    if (!startDate) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((today - startDate) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `${Math.abs(diffDays)}일 후 시작`;
    }
    if (diffDays === 0) {
      return '오늘 시작';
    }

    let months =
      (today.getFullYear() - startDate.getFullYear()) * 12 +
      (today.getMonth() - startDate.getMonth());
    if (today.getDate() < startDate.getDate()) {
      months -= 1;
    }

    if (months < 1) {
      return `${diffDays + 1}일째`;
    }
    if (months < 12) {
      return `${months}개월째`;
    }
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths > 0 ? `${years}년 ${remMonths}개월째` : `${years}년째`;
  }

  /**
   * Computes the user's share per billing charge (monthly or yearly),
   * supporting both 1/N ratio splitting and manual custom personal amount.
   */
  function getPersonalCyclePrice(sub) {
    if (sub.splitMode === 'custom' && Number.isFinite(Number(sub.customShare)) && Number(sub.customShare) > 0) {
      return Math.round(Number(sub.customShare));
    }
    const split = Math.max(1, parseInt(sub.splitCount, 10) || 1);
    return Math.round(sub.price / split);
  }

  /**
   * Computes the user's effective monthly burden (accounting for yearly cycle & share mode).
   */
  function getEffectiveMonthlyPrice(sub) {
    const personalCharge = getPersonalCyclePrice(sub);
    return sub.billingCycle === 'yearly' ? Math.round(personalCharge / 12) : personalCharge;
  }

  /**
   * Checks whether this month's billing date has already occurred on or before today.
   */
  function isPaidThisMonth(sub, today) {
    const thisMonthBilling = getClampedDate(today.getFullYear(), today.getMonth(), sub.billingDay);
    const parsedStart = parseIsoDate(sub.startDate);
    if (parsedStart && parsedStart > thisMonthBilling) {
      return false;
    }
    return thisMonthBilling <= today;
  }

  /**
   * Computes next upcoming billing date & D-Day count from today's local date.
   * If startDate is in the future, the next billing date is startDate itself.
   */
  function getNextBillingInfo(billingDay, startDate = null, billingCycle = 'monthly') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const parsedStart = parseIsoDate(startDate);
    let nextDate;

    if (parsedStart && parsedStart > today) {
      nextDate = parsedStart;
    } else if (billingCycle === 'yearly' && parsedStart) {
      let candidate = getClampedDate(today.getFullYear(), parsedStart.getMonth(), billingDay);
      if (candidate < today) {
        candidate = getClampedDate(today.getFullYear() + 1, parsedStart.getMonth(), billingDay);
      }
      nextDate = candidate;
    } else {
      nextDate = getClampedDate(today.getFullYear(), today.getMonth(), billingDay);
      if (nextDate < today) {
        nextDate = getClampedDate(today.getFullYear(), today.getMonth() + 1, billingDay);
      }
    }

    const diffDays = Math.round((nextDate - today) / (1000 * 60 * 60 * 24));
    const label = diffDays === 0 ? 'D-Day' : `D-${diffDays}`;
    const dateText =
      billingCycle === 'yearly'
        ? `${nextDate.getFullYear()}.${nextDate.getMonth() + 1}.${nextDate.getDate()}`
        : `${nextDate.getMonth() + 1}월 ${nextDate.getDate()}일`;

    let urgencyClass = 'dday-pill-normal';
    if (diffDays <= 1) urgencyClass = 'dday-pill-urgent';
    else if (diffDays <= 5) urgencyClass = 'dday-pill-soon';

    return { nextDate, diffDays, label, dateText, urgencyClass };
  }

  /**
   * Returns relatable Korean analogy copy based on annual spend brackets.
   */
  function getAnnualAnalogy(annualAmount) {
    if (annualAmount <= 0) {
      return {
        emoji: '💡',
        main: '활성 구독이 아직 없어요',
        sub: '구독을 추가하면 연간 체감 규모를 알려드려요'
      };
    }
    if (annualAmount < 300000) {
      const chickens = Math.max(1, Math.round(annualAmount / 22000));
      return {
        emoji: '🍗',
        main: `치킨 약 ${chickens}마리 값`,
        sub: '30만 원 미만 · 가볍지만 쌓이면 커지는 소액 구독 구간'
      };
    }
    if (annualAmount < 600000) {
      return {
        emoji: '🎧',
        main: '에어팟 프로 1대 값',
        sub: '연 30~60만 원 구간 · 1년 모으면 무선 이어폰을 살 수 있어요'
      };
    }
    if (annualAmount < 1200000) {
      return {
        emoji: '📱',
        main: '최신 아이패드 1대 값',
        sub: '연 60~120만 원 구간 · 안 쓰는 구독 1~2개 점검을 추천해요'
      };
    }
    const trips = Math.max(1, Math.floor(annualAmount / 1200000));
    return {
      emoji: '✈️',
      main: trips > 1 ? `해외여행 왕복 항공권 약 ${trips}장 값` : '해외여행 왕복 항공권 1장 값',
      sub: '연 120만 원 이상 · 해지 시뮬레이션으로 절약 포인트를 찾아보세요'
    };
  }

  /**
   * Looks up brand color & short emblem from presets or falls back to category color.
   */
  function getServiceVisual(sub) {
    const lowerName = sub.name.trim().toLowerCase();
    const matched =
      state.presets.find((p) => p.name.toLowerCase() === lowerName) ||
      DEFAULT_PRESETS.find((p) => p.name.toLowerCase() === lowerName);
    if (matched) {
      return { badge: matched.badge, color: matched.color };
    }
    const catColor = (CATEGORY_META[sub.category] && CATEGORY_META[sub.category].color) || '#64748b';
    const trimmed = sub.name.trim();
    const badge = trimmed ? trimmed.slice(0, 2).toUpperCase() : '?';
    return { badge, color: catColor };
  }

  /* =========================================================================
     5. Persistence (localStorage) & Theme Management
     ========================================================================= */
  function savePresetsToStorage() {
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(state.presets));
    } catch (err) {
      console.error('Preset localStorage save failed:', err);
    }
  }

  function sanitizePresets(list) {
    if (!Array.isArray(list)) return [];
    const sanitized = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const category = CATEGORIES.includes(item.category) ? item.category : '클라우드/기타';
      const price = Number(item.price);
      const billingDay = parseInt(item.billingDay, 10);
      if (!name || !Number.isFinite(price) || price <= 0) continue;
      if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) continue;
        const customShareRaw = Number(item.customShare);
      const splitMode =
        item.splitMode === 'custom' && Number.isFinite(customShareRaw) && customShareRaw > 0
          ? 'custom'
          : 'ratio';
      sanitized.push({
        name: name.slice(0, 32),
        category,
        price: Math.round(price),
        billingCycle: item.billingCycle === 'yearly' ? 'yearly' : 'monthly',
        splitMode,
        splitCount: Math.min(10, Math.max(1, parseInt(item.splitCount, 10) || 1)),
        customShare: splitMode === 'custom' ? Math.round(customShareRaw) : null,
        billingDay,
        badge:
          typeof item.badge === 'string' && item.badge.trim()
            ? item.badge.trim().slice(0, 2)
            : name.slice(0, 2).toUpperCase(),
        color:
          typeof item.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(item.color)
            ? item.color
            : CATEGORY_META[category]?.color || '#2563EB'
      });
    }
    return sanitized;
  }

  function saveBudgetToStorage() {
    try {
      if (state.budgetLimit > 0) {
        localStorage.setItem(BUDGET_STORAGE_KEY, String(state.budgetLimit));
      } else {
        localStorage.removeItem(BUDGET_STORAGE_KEY);
      }
    } catch (err) {
      console.error('Budget localStorage save failed:', err);
    }
  }

  function loadBudgetFromStorage() {
    try {
      const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
      const val = Number(raw);
      return Number.isFinite(val) && val > 0 ? Math.round(val) : 0;
    } catch (err) {
      console.error('Budget localStorage load failed:', err);
      return 0;
    }
  }

  function loadPresetsFromStorage() {
    try {
      const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (!raw) {
        state.presetsCustomized = false;
        return DEFAULT_PRESETS.map((p) => ({ ...p }));
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        state.presetsCustomized = false;
        return DEFAULT_PRESETS.map((p) => ({ ...p }));
      }
      state.presetsCustomized = true;
      return sanitizePresets(parsed);
    } catch (err) {
      console.error('Preset localStorage load failed:', err);
      state.presetsCustomized = false;
      return DEFAULT_PRESETS.map((p) => ({ ...p }));
    }
  }
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subscriptions));
    } catch (err) {
      console.error('localStorage save failed:', err);
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return sanitizeSubscriptions(parsed);
    } catch (err) {
      console.error('localStorage load failed:', err);
      return [];
    }
  }

  function sanitizeSubscriptions(list) {
    if (!Array.isArray(list)) return [];
    const valid = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const category = CATEGORIES.includes(item.category) ? item.category : '클라우드/기타';
      const price = Number(item.price);
      const parsedStart = parseIsoDate(item.startDate);
      const startDate = parsedStart ? formatIsoDate(parsedStart) : null;
      let billingDay = parseInt(item.billingDay, 10);
      if ((!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) && parsedStart) {
        billingDay = parsedStart.getDate();
      }
      if (!name || !Number.isFinite(price) || price <= 0) continue;
      if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) continue;

      const customShareRaw = Number(item.customShare);
      const splitMode =
        item.splitMode === 'custom' && Number.isFinite(customShareRaw) && customShareRaw > 0
          ? 'custom'
          : 'ratio';
      valid.push({
        id: typeof item.id === 'string' && item.id.trim() ? item.id : generateId(),
        name: name.slice(0, 32),
        category,
        price: Math.round(price),
        billingCycle: item.billingCycle === 'yearly' ? 'yearly' : 'monthly',
        splitMode,
        splitCount: Math.min(10, Math.max(1, parseInt(item.splitCount, 10) || 1)),
        customShare: splitMode === 'custom' ? Math.round(customShareRaw) : null,
        paymentMethod: typeof item.paymentMethod === 'string' ? item.paymentMethod.trim().slice(0, 20) : '',
        memo: typeof item.memo === 'string' ? item.memo.trim().slice(0, 60) : '',
        billingDay,
        startDate,
        isActive: item.isActive !== false
      });
    }
    return valid;
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const theme = saved === 'dark' || saved === 'light' ? saved : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    renderChart();
    renderBarChart();
  }

  /* =========================================================================
     6. Toast Feedback System
     ========================================================================= */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    el.toastContainer.appendChild(toast);

    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'opacity 180ms ease, transform 180ms ease';
      window.setTimeout(() => toast.remove(), 200);
    }, 2800);
  }

  /* =========================================================================
     7. Core Rendering Pipeline: renderAll()
        KPI -> Simulation Banner -> Presets -> Donut & Bar Charts -> List/Calendar -> Save
     ========================================================================= */
  function renderAll() {
    renderKPIsAndBanner();
    renderPresets();
    renderChart();
    renderBarChart();
    renderSubscriptionList();
    saveToStorage();
  }

  function renderKPIsAndBanner() {
    const allSubs = state.subscriptions;
    const activeSubs = allSubs.filter((s) => s.isActive);
    const inactiveSubs = allSubs.filter((s) => !s.isActive);

    const activeMonthly = activeSubs.reduce((sum, s) => sum + getEffectiveMonthlyPrice(s), 0);
    const totalMonthlyAll = allSubs.reduce((sum, s) => sum + getEffectiveMonthlyPrice(s), 0);
    const savedMonthly = totalMonthlyAll - activeMonthly;
    const activeAnnual = activeMonthly * 12;
    const savedAnnual = savedMonthly * 12;

    // 1. Dynamic Simulation Banner
    if (inactiveSubs.length > 0 && savedMonthly > 0) {
      el.simBanner.hidden = false;
      el.simBannerText.textContent = `${inactiveSubs.length}개 구독 해지 가정 시 월 ${formatKRW(savedMonthly)} · 연 ${formatKRW(savedAnnual)} 절약 중!`;
    } else {
      el.simBanner.hidden = true;
    }

    // 2. KPI 1 — Monthly Total + Paid vs Remaining Progress + Budget Gauge
    el.kpiMonthly.textContent = formatKRW(activeMonthly);
    if (savedMonthly > 0) {
      el.kpiMonthlyOriginal.hidden = false;
      el.kpiMonthlyOriginal.textContent = formatKRW(totalMonthlyAll);
      el.kpiMonthlyMeta.innerHTML = `
        <span>활성 ${activeSubs.length}개 / 전체 ${allSubs.length}개</span>
        <span class="savings-inline-pill">월 ${formatKRW(savedMonthly)} 절약 중</span>
      `;
    } else {
      el.kpiMonthlyOriginal.hidden = true;
      el.kpiMonthlyMeta.textContent =
        allSubs.length > 0
          ? `활성 구독 ${activeSubs.length}개 정상 결제 중`
          : '활성 구독 0개 · 아래 프리셋으로 1초 만에 추가해보세요';
    }

    // Monthly Cashflow Progress (Already Paid vs Remaining)
    if (activeSubs.length > 0 && activeMonthly > 0) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let paidAmount = 0;
      activeSubs.forEach((sub) => {
        if (isPaidThisMonth(sub, today)) {
          paidAmount += getEffectiveMonthlyPrice(sub);
        }
      });
      const remainAmount = Math.max(0, activeMonthly - paidAmount);
      const paidPct = Math.min(100, Math.round((paidAmount / activeMonthly) * 100));

      el.monthProgressWrap.hidden = false;
      el.monthPaidLabel.textContent = `결제 완료 ${formatKRW(paidAmount)}`;
      el.monthRemainLabel.textContent = `남은 예정 ${formatKRW(remainAmount)}`;
      el.monthProgressFill.style.width = `${paidPct}%`;
    } else {
      el.monthProgressWrap.hidden = true;
    }

    // Target Budget Gauge
    if (state.budgetLimit > 0) {
      el.btnBudgetLabel.textContent = `예산 ${formatKRW(state.budgetLimit)}`;
      el.budgetGaugeWrap.hidden = false;
      const pct = Math.round((activeMonthly / state.budgetLimit) * 100);
      const clampedPct = Math.min(100, pct);
      el.budgetTargetLabel.textContent = `목표 예산 ${formatKRW(state.budgetLimit)}`;
      el.budgetGaugeFill.style.width = `${clampedPct}%`;

      if (activeMonthly > state.budgetLimit) {
        const over = activeMonthly - state.budgetLimit;
        el.budgetStatusPill.textContent = `${formatKRW(over)} 초과`;
        el.budgetStatusPill.className = 'budget-status-pill is-over';
        el.budgetGaugeFill.className = 'meter-fill meter-fill-danger';
      } else if (pct >= 80) {
        el.budgetStatusPill.textContent = `${pct}% 사용 (주의)`;
        el.budgetStatusPill.className = 'budget-status-pill is-warn';
        el.budgetGaugeFill.className = 'meter-fill meter-fill-amber';
      } else {
        el.budgetStatusPill.textContent = `${pct}% 사용 (여유)`;
        el.budgetStatusPill.className = 'budget-status-pill is-ok';
        el.budgetGaugeFill.className = 'meter-fill meter-fill-emerald';
      }
    } else {
      el.btnBudgetLabel.textContent = '예산 설정';
      el.budgetGaugeWrap.hidden = true;
    }

    // 3. KPI 2 — Annual Projection & Relatable Analogy
    el.kpiAnnual.textContent = formatKRW(activeAnnual);
    const analogy = getAnnualAnalogy(activeAnnual);
    el.kpiAnalogyEmoji.textContent = analogy.emoji;
    el.kpiAnalogyText.textContent = analogy.main;
    el.kpiAnalogySub.textContent =
      savedAnnual > 0
        ? `시뮬레이션으로 연간 ${formatKRW(savedAnnual)}을 아끼고 있어요`
        : analogy.sub;

    // 4. KPI 3 — Next Upcoming Payment D-Day
    if (activeSubs.length === 0) {
      el.kpiDdayBadge.textContent = '일정 없음';
      el.kpiDdayBadge.className = 'dday-pill dday-pill-neutral';
      el.kpiDdayService.textContent = allSubs.length > 0 ? '활성 결제 없음' : '예정된 결제 없음';
      el.kpiDdayMeta.textContent =
        allSubs.length > 0
          ? '모든 구독이 해지 시뮬레이션(OFF) 상태입니다'
          : '구독을 등록하면 D-Day가 자동 계산됩니다';
      return;
    }

    const withBilling = activeSubs
      .map((sub) => ({
        sub,
        billing: getNextBillingInfo(sub.billingDay, sub.startDate, sub.billingCycle)
      }))
      .sort(
        (a, b) =>
          a.billing.diffDays - b.billing.diffDays ||
          getPersonalCyclePrice(b.sub) - getPersonalCyclePrice(a.sub)
      );

    const nearest = withBilling[0];
    const sameDayItems = withBilling.filter((item) => item.billing.diffDays === nearest.billing.diffDays);
    const sameDayTotal = sameDayItems.reduce((sum, item) => sum + getPersonalCyclePrice(item.sub), 0);

    el.kpiDdayBadge.textContent = nearest.billing.label;
    el.kpiDdayBadge.className = `dday-pill ${nearest.billing.urgencyClass}`;
    el.kpiDdayService.textContent =
      sameDayItems.length > 1
        ? `${nearest.sub.name} 외 ${sameDayItems.length - 1}건`
        : nearest.sub.name;
    el.kpiDdayMeta.textContent = `${nearest.billing.dateText} 결제 예정 · ${formatKRW(sameDayTotal)}`;
  }

  function renderPresets() {
    const existingNames = new Set(state.subscriptions.map((s) => s.name.trim().toLowerCase()));
    el.btnRestorePresets.hidden = !state.presetsCustomized;

    if (state.presets.length === 0) {
      el.presetGrid.innerHTML = `
        <div class="preset-empty">
          <span>등록된 1초 컷 프리셋이 없습니다. <strong>프리셋 등록</strong>으로 나만의 구독을 추가하거나 기본 목록을 복원해보세요.</span>
          <button type="button" class="btn btn-sm btn-accent-soft" data-action="restore-presets-inline">기본 프리셋 복원</button>
        </div>
      `;
      el.mobilePresetSelect.innerHTML = '<option value="">등록된 프리셋이 없습니다</option>';
      el.mobilePresetSelect.disabled = true;
      el.btnMobilePresetAdd.disabled = true;
      el.btnMobilePresetRemove.disabled = true;
      return;
    }

    el.mobilePresetSelect.disabled = false;
    el.btnMobilePresetAdd.disabled = false;
    el.btnMobilePresetRemove.disabled = false;

    const prevSelected = el.mobilePresetSelect.value;
    el.mobilePresetSelect.innerHTML = state.presets
      .map((preset, index) => {
        const isAdded = existingNames.has(preset.name.toLowerCase());
        const effPrice = getEffectiveMonthlyPrice(preset);
        return `<option value="${index}">${isAdded ? '✓ ' : ''}${escapeHtml(preset.name)} (${formatKRW(effPrice)})</option>`;
      })
      .join('');
    if (prevSelected !== '' && Number(prevSelected) < state.presets.length) {
      el.mobilePresetSelect.value = prevSelected;
    }

    el.presetGrid.innerHTML = state.presets
      .map((preset, index) => {
        const isAdded = existingNames.has(preset.name.toLowerCase());
        const effPrice = getEffectiveMonthlyPrice(preset);
        return `
          <div class="preset-chip ${isAdded ? 'is-added' : ''}" role="listitem">
            <button
              type="button"
              class="preset-chip-main"
              data-preset-index="${index}"
              title="${escapeHtml(preset.name)} (월 ${formatKRW(effPrice)}) 바로 추가"
            >
              <span class="preset-dot" style="background:${preset.color}">${escapeHtml(preset.badge)}</span>
              <span class="preset-info">
                <span class="preset-name">${escapeHtml(preset.name)}</span>
                <span class="preset-price">${formatKRW(effPrice)}</span>
              </span>
              <span class="preset-plus" aria-hidden="true">${isAdded ? '✓' : '+'}</span>
            </button>
            <button
              type="button"
              class="preset-chip-remove"
              data-remove-preset-index="${index}"
              aria-label="${escapeHtml(preset.name)} 프리셋 제거"
              title="1초 컷 프리셋에서 제거"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 7L17 17M17 7L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        `;
      })
      .join('');
  }

  function addCustomPreset({ name, category, price, billingCycle = 'monthly', splitMode = 'ratio', splitCount = 1, customShare = null, billingDay, color }) {
    const cleanName = name.trim();
    const badge = cleanName.slice(0, 2).toUpperCase();
    const resolvedMode = splitMode === 'custom' && Number(customShare) > 0 ? 'custom' : 'ratio';
    state.presets.push({
      name: cleanName,
      category,
      price: Math.round(Number(price)),
      billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
      splitMode: resolvedMode,
      splitCount: Math.min(10, Math.max(1, parseInt(splitCount, 10) || 1)),
      customShare: resolvedMode === 'custom' ? Math.round(Number(customShare)) : null,
      billingDay: parseInt(billingDay, 10),
      badge,
      color: color || CATEGORY_META[category]?.color || '#2563EB'
    });
    state.presetsCustomized = true;
    savePresetsToStorage();
    renderPresets();
    showToast(`'${cleanName}' 항목을 1초 컷 프리셋에 등록했습니다.`, 'success');
  }

  function removeCustomPreset(index) {
    const target = state.presets[index];
    if (!target) return;
    state.presets.splice(index, 1);
    state.presetsCustomized = true;
    savePresetsToStorage();
    renderPresets();
    showToast(`'${target.name}' 프리셋을 목록에서 제거했습니다.`, 'info');
  }

  function restoreDefaultPresets() {
    state.presets = DEFAULT_PRESETS.map((p) => ({ ...p }));
    state.presetsCustomized = false;
    try {
      localStorage.removeItem(PRESETS_STORAGE_KEY);
    } catch (err) {
      console.error('Preset localStorage clear failed:', err);
    }
    renderPresets();
    showToast('기본 인기 구독 프리셋 10종을 복원했습니다.', 'info');
  }

  function renderChart() {
    const activeSubs = state.subscriptions.filter((s) => s.isActive);
    const totalsByCat = {};
    const countsByCat = {};
    CATEGORIES.forEach((cat) => {
      totalsByCat[cat] = 0;
      countsByCat[cat] = 0;
    });

    activeSubs.forEach((sub) => {
      const cat = CATEGORIES.includes(sub.category) ? sub.category : '클라우드/기타';
      totalsByCat[cat] += getEffectiveMonthlyPrice(sub);
      countsByCat[cat] += 1;
    });

    const totalActive = activeSubs.reduce((sum, s) => sum + getEffectiveMonthlyPrice(s), 0);

    // Center Label Update
    el.chartCenterLabel.textContent = `활성 ${activeSubs.length}개 월 합계`;
    el.chartCenterValue.textContent = formatKRW(totalActive);

    // Category Breakdown Rows (always rendered cleanly)
    el.categoryBreakdown.innerHTML = CATEGORIES.map((cat) => {
      const amount = totalsByCat[cat];
      const count = countsByCat[cat];
      const pct = totalActive > 0 ? Math.round((amount / totalActive) * 100) : 0;
      const color = CATEGORY_META[cat].color;

      return `
        <li class="cat-row">
          <div class="cat-row-top">
            <span class="cat-name-wrap">
              <span class="cat-swatch" style="background:${color}"></span>
              <span>${escapeHtml(cat)}</span>
              <span class="cat-count">${count}건</span>
            </span>
            <span class="cat-amount-wrap">
              <span class="cat-amount">${formatKRW(amount)}</span>
              <span class="cat-percent">${pct}%</span>
            </span>
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${pct}%; background:${color}"></div>
          </div>
        </li>
      `;
    }).join('');

    // Empty Chart Toggle
    const canvasWrap = el.categoryChartCanvas.parentElement;
    if (totalActive <= 0) {
      canvasWrap.style.display = 'none';
      el.chartEmpty.hidden = false;
      if (state.chartInstance) {
        state.chartInstance.destroy();
        state.chartInstance = null;
      }
      return;
    }

    canvasWrap.style.display = 'block';
    el.chartEmpty.hidden = true;

    // Guard in case Chart.js CDN is unavailable offline
    if (typeof window.Chart === 'undefined') {
      return;
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const borderColor = isDark ? '#111827' : '#ffffff';
    const dataValues = CATEGORIES.map((cat) => totalsByCat[cat]);
    const colors = CATEGORIES.map((cat) => CATEGORY_META[cat].color);

    // Reuse existing instance cleanly to prevent duplicate rendering bugs
    if (state.chartInstance) {
      state.chartInstance.data.labels = CATEGORIES;
      state.chartInstance.data.datasets[0].data = dataValues;
      state.chartInstance.data.datasets[0].backgroundColor = colors;
      state.chartInstance.data.datasets[0].borderColor = borderColor;
      state.chartInstance.update();
      return;
    }

    state.chartInstance = new window.Chart(el.categoryChartCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: CATEGORIES,
        datasets: [
          {
            data: dataValues,
            backgroundColor: colors,
            borderColor,
            borderWidth: 3,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '71%',
        animation: {
          duration: 380
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            padding: 10,
            cornerRadius: 10,
            displayColors: true,
            callbacks: {
              label(ctx) {
                const value = ctx.parsed || 0;
                const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = sum > 0 ? ((value / sum) * 100).toFixed(1) : '0.0';
                return ` ${ctx.label}: ${formatKRW(value)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  function renderBarChart() {
    const allSubs = state.subscriptions;
    const isEmpty = allSubs.length === 0;

    if (isEmpty) {
      el.barChartCanvas.style.display = 'none';
      el.barChartEmpty.hidden = false;
      if (state.barChartInstance) {
        state.barChartInstance.destroy();
        state.barChartInstance = null;
      }
      return;
    }

    el.barChartCanvas.style.display = 'block';
    el.barChartEmpty.hidden = true;

    if (typeof window.Chart === 'undefined') {
      return;
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.06)';

    let labels;
    let datasets;

    if (state.barMode === 'period') {
      el.barChartSub.textContent = '월초(1~10일) · 월중(11~20일) · 월말(21~31일) 활성 지출';
      const buckets = [0, 0, 0];
      allSubs
        .filter((s) => s.isActive)
        .forEach((sub) => {
          const eff = getEffectiveMonthlyPrice(sub);
          if (sub.billingDay <= 10) buckets[0] += eff;
          else if (sub.billingDay <= 20) buckets[1] += eff;
          else buckets[2] += eff;
        });

      labels = ['월초 (1~10일)', '월중 (11~20일)', '월말 (21~31일)'];
      datasets = [
        {
          label: '구간별 월 지출',
          data: buckets,
          backgroundColor: ['#3b82f6', '#6366f1', '#10b981'],
          borderRadius: 8,
          maxBarThickness: 44
        }
      ];
    } else {
      el.barChartSub.textContent = '해지 시뮬레이션 전(기존) vs 적용 후 카테고리 비교';
      const originalByCat = {};
      const activeByCat = {};
      CATEGORIES.forEach((cat) => {
        originalByCat[cat] = 0;
        activeByCat[cat] = 0;
      });

      allSubs.forEach((sub) => {
        const cat = CATEGORIES.includes(sub.category) ? sub.category : '클라우드/기타';
        const eff = getEffectiveMonthlyPrice(sub);
        originalByCat[cat] += eff;
        if (sub.isActive) activeByCat[cat] += eff;
      });

      labels = CATEGORIES.map((cat) => CATEGORY_META[cat].short);
      datasets = [
        {
          label: '기존 지출',
          data: CATEGORIES.map((cat) => originalByCat[cat]),
          backgroundColor: isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.45)',
          borderRadius: 6,
          maxBarThickness: 26
        },
        {
          label: '시뮬 적용 후',
          data: CATEGORIES.map((cat) => activeByCat[cat]),
          backgroundColor: '#2563eb',
          borderRadius: 6,
          maxBarThickness: 26
        }
      ];
    }

    if (state.barChartInstance) {
      state.barChartInstance.destroy();
      state.barChartInstance = null;
    }

    state.barChartInstance = new window.Chart(el.barChartCanvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 320 },
        plugins: {
          legend: {
            display: state.barMode === 'compare',
            position: 'bottom',
            labels: {
              color: tickColor,
              boxWidth: 12,
              boxHeight: 12,
              padding: 12,
              font: { size: 11.5, weight: '600' }
            }
          },
          tooltip: {
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label(ctx) {
                return ` ${ctx.dataset.label}: ${formatKRW(ctx.parsed.y || 0)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tickColor, font: { size: 11.5, weight: '600' } }
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { size: 11 },
              callback(value) {
                if (value >= 10000) return `${Math.round(value / 1000) / 10}만`;
                return value.toLocaleString('ko-KR');
              }
            }
          }
        }
      }
    });
  }

  function getFilteredSubscriptions() {
    const query = state.searchQuery.trim().toLowerCase();

    return state.subscriptions.filter((sub) => {
      if (state.filterCategory !== 'all' && sub.category !== state.filterCategory) return false;
      if (state.filterStatus === 'active' && !sub.isActive) return false;
      if (state.filterStatus === 'inactive' && sub.isActive) return false;
      if (query) {
        const hay = `${sub.name} ${sub.category} ${sub.paymentMethod || ''} ${sub.memo || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }

  function renderCalendarView(filteredSubs) {
    const year = state.calendarYear;
    const month = state.calendarMonth;
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
    const todayDate = now.getDate();

    el.calMonthLabel.textContent = `${year}년 ${month + 1}월`;

    // Map clamped day -> subscriptions occurring in this month
    const byDay = new Map();
    let activeMonthTotal = 0;

    filteredSubs.forEach((sub) => {
      if (sub.billingCycle === 'yearly' && sub.startDate) {
        const parsed = parseIsoDate(sub.startDate);
        if (parsed && parsed.getMonth() !== month) return;
      }
      const clampedDay = Math.min(sub.billingDay, daysInMonth);
      if (!byDay.has(clampedDay)) byDay.set(clampedDay, []);
      byDay.get(clampedDay).push(sub);
      if (sub.isActive) {
        activeMonthTotal += getPersonalCyclePrice(sub);
      }
    });

    el.calMonthSummary.textContent = `${month + 1}월 예정 합계 ${formatKRW(activeMonthTotal)}`;

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push('<div class="cal-cell is-empty" aria-hidden="true"></div>');
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const items = byDay.get(day) || [];
      const activeDaySum = items
        .filter((s) => s.isActive)
        .reduce((sum, s) => sum + getPersonalCyclePrice(s), 0);
      const isToday = isCurrentMonth && day === todayDate;

      const pillsHtml = items
        .map((sub) => {
          const visual = getServiceVisual(sub);
          const charge = getPersonalCyclePrice(sub);
          return `
            <button
              type="button"
              class="cal-pill ${sub.isActive ? '' : 'is-inactive'}"
              data-cal-id="${escapeHtml(sub.id)}"
              style="border-left-color:${visual.color}"
              title="${escapeHtml(sub.name)} · ${formatKRW(charge)} (클릭하여 수정)"
            >
              <span class="cal-pill-name">${escapeHtml(sub.name)}</span>
            </button>
          `;
        })
        .join('');

      cells.push(`
        <div class="cal-cell ${isToday ? 'is-today' : ''}" role="gridcell">
          <div class="cal-day-head">
            <span class="cal-day-num">${day}</span>
            ${activeDaySum > 0 ? `<span class="cal-day-sum">${Math.round(activeDaySum / 1000)}k</span>` : ''}
          </div>
          <div class="cal-pills">${pillsHtml}</div>
        </div>
      `);
    }

    el.calendarGrid.innerHTML = cells.join('');
  }

  function renderSubscriptionList() {
    const allCount = state.subscriptions.length;
    const activeCount = state.subscriptions.filter((s) => s.isActive).length;
    el.listCountBadge.textContent = `${allCount}개`;
    el.btnExportAllIcs.disabled = activeCount === 0;
    el.btnSearchClear.hidden = !state.searchQuery;

    let filtered = getFilteredSubscriptions();

    // Sorting
    filtered = filtered.slice().sort((a, b) => {
      if (state.sortBy === 'price-desc') return getEffectiveMonthlyPrice(b) - getEffectiveMonthlyPrice(a);
      if (state.sortBy === 'price-asc') return getEffectiveMonthlyPrice(a) - getEffectiveMonthlyPrice(b);
      if (state.sortBy === 'name') return a.name.localeCompare(b.name, 'ko');
      const diffA = getNextBillingInfo(a.billingDay, a.startDate, a.billingCycle).diffDays;
      const diffB = getNextBillingInfo(b.billingDay, b.startDate, b.billingCycle).diffDays;
      return diffA - diffB || getEffectiveMonthlyPrice(b) - getEffectiveMonthlyPrice(a);
    });

    if (state.viewMode === 'calendar') {
      el.subscriptionList.hidden = true;
      el.emptyState.hidden = true;
      el.calendarView.hidden = false;
      renderCalendarView(filtered);
      return;
    }

    el.calendarView.hidden = true;
    el.subscriptionList.hidden = false;

    if (filtered.length === 0) {
      el.subscriptionList.innerHTML = '';
      el.emptyState.hidden = false;

      if (allCount === 0) {
        el.emptyTitle.textContent = '아직 등록된 구독이 없어요';
        el.emptyDesc.textContent =
          '상단의 인기 구독 버튼을 눌러 1초 만에 추가하거나, 샘플 데이터로 대시보드를 바로 체험해보세요.';
        el.emptyActions.hidden = false;
      } else {
        el.emptyTitle.textContent = '조건에 맞는 구독 항목이 없어요';
        el.emptyDesc.textContent = '검색어나 상태·카테고리 필터를 초기화하면 전체 목록을 볼 수 있습니다.';
        el.emptyActions.hidden = true;
      }
      return;
    }

    el.emptyState.hidden = true;

    el.subscriptionList.innerHTML = filtered
      .map((sub) => {
        const visual = getServiceVisual(sub);
        const billing = getNextBillingInfo(sub.billingDay, sub.startDate, sub.billingCycle);
        const monthlyEff = getEffectiveMonthlyPrice(sub);
        const annualEff = monthlyEff * 12;
        const split = Math.max(1, parseInt(sub.splitCount, 10) || 1);
        const isCustomShare = sub.splitMode === 'custom' && Number(sub.customShare) > 0;
        const hasSplit = isCustomShare || split > 1;
        const isYearly = sub.billingCycle === 'yearly';

        const startMetaHtml = sub.startDate
          ? `<span class="sub-start-tag">${formatKoreanDateShort(sub.startDate)} 시작 (${getSubscriptionDurationText(sub.startDate)})</span><span>·</span>`
          : '';
        const paymentTagHtml = sub.paymentMethod
          ? `<span class="payment-tag">💳 ${escapeHtml(sub.paymentMethod)}</span>`
          : '';
        const memoHtml = sub.memo
          ? `<p class="sub-memo-line" title="${escapeHtml(sub.memo)}">📝 ${escapeHtml(sub.memo)}</p>`
          : '';
        const cycleNote = isYearly
          ? `매년 (원금 ${formatKRW(sub.price)})`
          : `매월 ${sub.billingDay}일 결제`;
        const splitBadgeHtml = isCustomShare
          ? `<span class="split-badge">직접 분담</span>`
          : split > 1
            ? `<span class="split-badge">1/${split} 공유</span>`
            : '';

        return `
          <li class="sub-item ${sub.isActive ? '' : 'is-inactive'}" data-id="${escapeHtml(sub.id)}">
            <div class="sub-avatar" style="background:${visual.color}" aria-hidden="true">${escapeHtml(visual.badge)}</div>

            <div class="sub-main">
              <div class="sub-title-row">
                <span class="sub-name">${escapeHtml(sub.name)}</span>
                <span class="cat-badge">${escapeHtml(sub.category)}</span>
                ${isYearly ? `<span class="cycle-badge">연간 환산</span>` : ''}
                ${splitBadgeHtml}
                ${
                  sub.isActive
                    ? `<span class="dday-pill ${billing.urgencyClass}">${billing.label}</span>`
                    : `<span class="saving-badge">연 ${formatKRW(annualEff)} 절약 중</span>`
                }
              </div>
              <div class="sub-meta-row">
                ${startMetaHtml}
                <span>${cycleNote}</span>
                <span>·</span>
                <span>${sub.isActive ? `다음 결제 ${billing.dateText}` : '해지 시뮬레이션 OFF 상태'}</span>
                ${paymentTagHtml}
              </div>
              ${memoHtml}
            </div>

            <div class="sub-right">
              <div class="sub-price-col">
                <span class="sub-price">${formatKRW(monthlyEff)}<small style="font-size:11px;font-weight:600;color:var(--text-muted)">/월</small></span>
                <span class="sub-price-year">${hasSplit ? `총 ${formatKRW(sub.price)} · ` : ''}연 ${formatKRW(annualEff)}</span>
              </div>

              <div class="sub-actions">
                <button
                  type="button"
                  class="toggle-switch"
                  role="switch"
                  aria-checked="${sub.isActive ? 'true' : 'false'}"
                  aria-label="${escapeHtml(sub.name)} 해지 시뮬레이션 스위치"
                  data-action="toggle"
                  title="${sub.isActive ? '끄면 해지 시 절약 금액 시뮬레이션' : '다시 켜서 지출에 포함'}"
                >
                  <span class="toggle-thumb"></span>
                </button>

                <button
                  type="button"
                  class="icon-action-btn ics-btn"
                  data-action="ics"
                  aria-label="${escapeHtml(sub.name)} 결제일 캘린더(.ics) 다운로드"
                  title="결제 3일 전 캘린더 알림(.ics) 받기"
                >
                  <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" stroke-width="1.8" />
                    <path d="M8 2V6M16 2V6M3 10H21M12 14V18M10 16H14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  </svg>
                </button>

                <button
                  type="button"
                  class="icon-action-btn edit-btn"
                  data-action="edit"
                  aria-label="${escapeHtml(sub.name)} 수정"
                  title="수정"
                >
                  <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 20H21M16.5 3.5A2.12 2.12 0 0 1 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>

                <button
                  type="button"
                  class="icon-action-btn delete-btn"
                  data-action="delete"
                  aria-label="${escapeHtml(sub.name)} 삭제"
                  title="삭제"
                >
                  <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 7H20M10 11V17M14 11V17M6 7L7 19C7 20.1 7.9 21 9 21H15C16.1 21 17 20.1 17 19L18 7M9 7V4H15V7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        `;
      })
      .join('');
  }

  /* =========================================================================
     8. CRUD Operations & Simulation Handlers
     ========================================================================= */
  function addSubscription({
    name,
    category,
    price,
    billingCycle = 'monthly',
    splitMode = 'ratio',
    splitCount = 1,
    customShare = null,
    paymentMethod = '',
    memo = '',
    billingDay,
    startDate = null
  }) {
    const resolvedMode = splitMode === 'custom' && Number(customShare) > 0 ? 'custom' : 'ratio';
    const newSub = {
      id: generateId(),
      name: name.trim(),
      category,
      price: Math.round(Number(price)),
      billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
      splitMode: resolvedMode,
      splitCount: Math.min(10, Math.max(1, parseInt(splitCount, 10) || 1)),
      customShare: resolvedMode === 'custom' ? Math.round(Number(customShare)) : null,
      paymentMethod: typeof paymentMethod === 'string' ? paymentMethod.trim().slice(0, 20) : '',
      memo: typeof memo === 'string' ? memo.trim().slice(0, 60) : '',
      billingDay: parseInt(billingDay, 10),
      startDate: startDate || null,
      isActive: true
    };
    state.subscriptions.unshift(newSub);
    renderAll();
    showToast(`'${newSub.name}' 구독이 추가되었습니다.`, 'success');
  }

  function updateSubscription(
    id,
    { name, category, price, billingCycle = 'monthly', splitMode = 'ratio', splitCount = 1, customShare = null, paymentMethod = '', memo = '', billingDay, startDate = null }
  ) {
    const target = state.subscriptions.find((s) => s.id === id);
    if (!target) return;
    const resolvedMode = splitMode === 'custom' && Number(customShare) > 0 ? 'custom' : 'ratio';
    target.name = name.trim();
    target.category = category;
    target.price = Math.round(Number(price));
    target.billingCycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    target.splitMode = resolvedMode;
    target.splitCount = Math.min(10, Math.max(1, parseInt(splitCount, 10) || 1));
    target.customShare = resolvedMode === 'custom' ? Math.round(Number(customShare)) : null;
    target.paymentMethod = typeof paymentMethod === 'string' ? paymentMethod.trim().slice(0, 20) : '';
    target.memo = typeof memo === 'string' ? memo.trim().slice(0, 60) : '';
    target.billingDay = parseInt(billingDay, 10);
    target.startDate = startDate || null;
    renderAll();
    showToast(`'${target.name}' 정보가 수정되었습니다.`, 'success');
  }

  function toggleSubscription(id) {
    const target = state.subscriptions.find((s) => s.id === id);
    if (!target) return;
    target.isActive = !target.isActive;
    renderAll();

    if (!target.isActive) {
      const annualSaved = getEffectiveMonthlyPrice(target) * 12;
      showToast(
        `'${target.name}' 해지 시뮬레이션 ON · 연 ${formatKRW(annualSaved)} 절약!`,
        'success'
      );
    } else {
      showToast(`'${target.name}' 구독을 다시 활성화했습니다.`, 'info');
    }
  }

  function deleteSubscription(id) {
    const target = state.subscriptions.find((s) => s.id === id);
    if (!target) return;
    state.subscriptions = state.subscriptions.filter((s) => s.id !== id);
    renderAll();
    showToast(`'${target.name}' 항목이 삭제되었습니다.`, 'info');
  }

  function restoreAllSimulations() {
    state.subscriptions.forEach((sub) => {
      sub.isActive = true;
    });
    renderAll();
    showToast('모든 구독을 다시 활성화했습니다.', 'info');
  }

  function purgeInactiveSubscriptions() {
    const offCount = state.subscriptions.filter((s) => !s.isActive).length;
    if (offCount === 0) return;
    state.subscriptions = state.subscriptions.filter((s) => s.isActive);
    renderAll();
    closeConfirmModal();
    showToast(`해지 시뮬레이션(OFF) ${offCount}개 구독을 정리했습니다.`, 'success');
  }

  function loadSampleData() {
    state.subscriptions = buildSampleData();
    state.filterCategory = 'all';
    state.filterStatus = 'all';
    state.searchQuery = '';
    el.searchInput.value = '';
    syncFilterChipUI();
    syncStatusFilterUI();
    renderAll();
    showToast('발표 시연용 샘플 구독 7개가 채워졌습니다!', 'success');
  }

  function resetAllData() {
    state.subscriptions = [];
    state.filterCategory = 'all';
    state.filterStatus = 'all';
    state.searchQuery = '';
    el.searchInput.value = '';
    syncFilterChipUI();
    syncStatusFilterUI();
    renderAll();
    closeConfirmModal();
    showToast('모든 구독 데이터가 초기화되었습니다.', 'info');
  }

  /* =========================================================================
     9. RFC 5545 iCalendar (.ics) Export with VALARM (3 Days Before)
     ========================================================================= */
  function escapeIcsText(text) {
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function formatIcsDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  function formatIcsTimestamp(date) {
    return (
      date.getUTCFullYear() +
      String(date.getUTCMonth() + 1).padStart(2, '0') +
      String(date.getUTCDate()).padStart(2, '0') +
      'T' +
      String(date.getUTCHours()).padStart(2, '0') +
      String(date.getUTCMinutes()).padStart(2, '0') +
      String(date.getUTCSeconds()).padStart(2, '0') +
      'Z'
    );
  }

  function buildIcsEventLines(sub) {
    const { nextDate } = getNextBillingInfo(sub.billingDay, sub.startDate, sub.billingCycle);
    const nextDay = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate() + 1);
    const dtStart = formatIcsDate(nextDate);
    const dtEnd = formatIcsDate(nextDay);
    const dtStamp = formatIcsTimestamp(new Date());
    const safeName = escapeIcsText(sub.name);
    const monthlyEff = getEffectiveMonthlyPrice(sub);
    const priceLabel = formatKRW(getPersonalCyclePrice(sub));
    const startNote = sub.startDate ? ` / 구독 시작일 ${sub.startDate}` : '';
    const rrule =
      sub.billingCycle === 'yearly'
        ? `RRULE:FREQ=YEARLY;BYMONTH=${nextDate.getMonth() + 1};BYMONTHDAY=${sub.billingDay}`
        : `RRULE:FREQ=MONTHLY;BYMONTHDAY=${sub.billingDay}`;

    return [
      'BEGIN:VEVENT',
      `UID:${sub.id}@subpulse.local`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      rrule,
      `SUMMARY:[구독 결제] ${safeName} (${priceLabel})`,
      `DESCRIPTION:${safeName} 정기 결제일입니다. (월 환산 ${formatKRW(monthlyEff)} / 연 ${formatKRW(monthlyEff * 12)}${startNote})\\n해지 여부를 결제 3일 전에 점검해보세요.`,
      'BEGIN:VALARM',
      'TRIGGER:-P3D',
      'ACTION:DISPLAY',
      `DESCRIPTION:결제 3일 전 해지 검토 - ${safeName} (${priceLabel})`,
      'END:VALARM',
      'END:VEVENT'
    ];
  }

  function downloadIcsFile(subs, filename) {
    if (!subs || subs.length === 0) {
      showToast('내보낼 활성 구독이 없습니다.', 'error');
      return;
    }

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SubPulse//Subscription Dashboard//KO',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    subs.forEach((sub) => {
      lines.push(...buildIcsEventLines(sub));
    });

    lines.push('END:VCALENDAR', '');

    // Strict RFC 5545 CRLF (\r\n) line endings
    const icsContent = lines.join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    triggerDownload(blob, filename);
    showToast(`캘린더 알림 파일(${filename})을 다운로드했습니다.`, 'success');
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* =========================================================================
     10. JSON Backup & Restore (Blob API & FileReader API)
     ========================================================================= */
  function exportJsonBackup() {
    if (state.subscriptions.length === 0 && !state.presetsCustomized && state.budgetLimit <= 0) {
      showToast('백업할 구독 또는 설정 데이터가 없습니다.', 'error');
      return;
    }

    const payload = {
      app: 'SubPulse',
      version: 3,
      exportedAt: new Date().toISOString(),
      subscriptions: state.subscriptions,
      presets: state.presets,
      presetsCustomized: state.presetsCustomized,
      budgetLimit: state.budgetLimit
    };

    const todayStr = formatIcsDate(new Date());
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    triggerDownload(blob, `subpulse-backup-${todayStr}.json`);
    showToast('구독 목록·프리셋·예산 설정을 JSON으로 백업했습니다.', 'success');
  }

  function handleJsonImport(file) {
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target.result));
        const isObjectPayload = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
        const hasSubsField = Array.isArray(parsed) || (isObjectPayload && Array.isArray(parsed.subscriptions));
        const hasPresetsField = isObjectPayload && Array.isArray(parsed.presets);
        const hasBudgetField = isObjectPayload && Number.isFinite(Number(parsed.budgetLimit));

        const rawSubs = Array.isArray(parsed) ? parsed : isObjectPayload ? parsed.subscriptions : [];
        const sanitizedSubs = hasSubsField ? sanitizeSubscriptions(rawSubs) : [];
        const sanitizedPresets = hasPresetsField ? sanitizePresets(parsed.presets) : [];

        if (sanitizedSubs.length === 0 && !hasPresetsField && !hasBudgetField) {
          showToast('유효한 구독 또는 프리셋 데이터가 없는 JSON 파일입니다.', 'error');
          return;
        }

        if (hasSubsField) {
          state.subscriptions = sanitizedSubs;
        }

        if (hasPresetsField) {
          state.presets = sanitizedPresets;
          state.presetsCustomized =
            typeof parsed.presetsCustomized === 'boolean' ? parsed.presetsCustomized : true;
          if (state.presetsCustomized) {
            savePresetsToStorage();
          } else {
            try {
              localStorage.removeItem(PRESETS_STORAGE_KEY);
            } catch (err) {
              console.error('Preset localStorage clear failed:', err);
            }
          }
        }

        if (hasBudgetField) {
          const val = Number(parsed.budgetLimit);
          state.budgetLimit = val > 0 ? Math.round(val) : 0;
          saveBudgetToStorage();
        }

        state.filterCategory = 'all';
        state.filterStatus = 'all';
        state.searchQuery = '';
        el.searchInput.value = '';
        syncFilterChipUI();
        syncStatusFilterUI();
        renderAll();

        if (hasSubsField && hasPresetsField) {
          showToast(
            `구독 ${sanitizedSubs.length}개와 1초 컷 프리셋 ${sanitizedPresets.length}개를 복원했습니다.`,
            'success'
          );
        } else if (hasPresetsField) {
          showToast(`1초 컷 프리셋 ${sanitizedPresets.length}개를 복원했습니다.`, 'success');
        } else {
          showToast(`JSON 파일에서 ${sanitizedSubs.length}개의 구독을 복원했습니다.`, 'success');
        }
      } catch (err) {
        console.error('JSON import error:', err);
        showToast('JSON 형식을 읽을 수 없습니다. 올바른 백업 파일인지 확인해주세요.', 'error');
      }
    };

    reader.onerror = () => {
      showToast('파일을 읽는 중 오류가 발생했습니다.', 'error');
    };

    reader.readAsText(file, 'utf-8');
  }

  /* =========================================================================
     11. Modals & Form Validation
     ========================================================================= */
  function setDateInputMode(mode, { syncValues = true } = {}) {
    state.dateInputMode = mode === 'billingDay' ? 'billingDay' : 'startDate';
    const isStartDate = state.dateInputMode === 'startDate';

    el.dateModeToggle.querySelectorAll('.segment-btn').forEach((btn) => {
      const active = btn.dataset.mode === state.dateInputMode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    el.wrapStartDate.hidden = !isStartDate;
    el.wrapBillingDay.hidden = isStartDate;

    if (syncValues) {
      if (!isStartDate) {
        const parsed = parseIsoDate(el.fieldStartDate.value);
        if (parsed) {
          el.fieldBillingDay.value = String(parsed.getDate());
        }
      } else if (!el.fieldStartDate.value) {
        const day = parseInt(el.fieldBillingDay.value, 10);
        const now = new Date();
        if (Number.isInteger(day) && day >= 1 && day <= 31) {
          el.fieldStartDate.value = formatIsoDate(getClampedDate(now.getFullYear(), now.getMonth(), day));
        } else {
          el.fieldStartDate.value = formatIsoDate(now);
        }
      }
    }

    el.formError.hidden = true;
    updateFormPreview();
  }

  function syncPresetColorUI(color) {
    state.selectedPresetColor = color;
    el.presetColorPicker.querySelectorAll('.color-swatch').forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.color === color);
    });
  }

  function syncPriceLabel() {
    const isYearly = el.fieldCycle.value === 'yearly';
    el.fieldPriceLabel.innerHTML = `${isYearly ? '연 결제 금액' : '월 결제 금액'} <span class="required">*</span>`;
  }

  function setSplitInputMode(mode, { syncPlaceholder = true } = {}) {
    state.splitInputMode = mode === 'custom' ? 'custom' : 'ratio';
    const isRatio = state.splitInputMode === 'ratio';

    el.splitModeToggle.querySelectorAll('.segment-btn').forEach((btn) => {
      const active = btn.dataset.splitMode === state.splitInputMode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    el.wrapSplitRatio.hidden = !isRatio;
    el.wrapSplitCustom.hidden = isRatio;

    if (syncPlaceholder && !isRatio && !el.fieldCustomShare.value) {
      const price = Number(el.fieldPrice.value);
      const split = Math.max(1, parseInt(el.fieldSplit.value, 10) || 1);
      if (Number.isFinite(price) && price > 0) {
        el.fieldCustomShare.value = String(Math.round(price / split));
      }
    }

    el.formError.hidden = true;
    updateFormPreview();
  }

  function openSubModal(subToEdit = null, { mode = 'subscription' } = {}) {
    el.formError.hidden = true;
    el.formError.textContent = '';
    state.modalMode = mode === 'preset' ? 'preset' : 'subscription';
    const isPresetMode = state.modalMode === 'preset';
    el.presetColorGroup.hidden = !isPresetMode;
    el.paymentFieldGroup.hidden = isPresetMode;
    el.memoFieldGroup.hidden = isPresetMode;

    if (isPresetMode) {
      state.editingId = null;
      el.modalTitle.textContent = '1초 컷 프리셋 등록';
      el.modalSubtitle.textContent = '자주 쓰는 구독을 상단 1초 컷 바에 추가합니다';
      el.btnModalSubmit.textContent = '프리셋 등록';
      el.subForm.reset();
      el.fieldId.value = '';
      el.fieldCycle.value = 'monthly';
      el.fieldSplit.value = '1';
      el.fieldCustomShare.value = '';
      const today = new Date();
      el.fieldStartDate.value = formatIsoDate(today);
      el.fieldBillingDay.value = String(today.getDate());
      syncPresetColorUI('#2563EB');
      setDateInputMode('billingDay', { syncValues: false });
      setSplitInputMode('ratio', { syncPlaceholder: false });
    } else if (subToEdit) {
      state.editingId = subToEdit.id;
      el.modalTitle.textContent = '구독 정보 수정';
      el.modalSubtitle.textContent = '등록된 구독 서비스의 정보와 결제 수단을 수정하세요';
      el.btnModalSubmit.textContent = '변경사항 저장';
      el.fieldId.value = subToEdit.id;
      el.fieldName.value = subToEdit.name;
      el.fieldCategory.value = subToEdit.category;
      el.fieldCycle.value = subToEdit.billingCycle === 'yearly' ? 'yearly' : 'monthly';
      el.fieldPrice.value = String(subToEdit.price);
      el.fieldSplit.value = String(Math.min(6, Math.max(1, parseInt(subToEdit.splitCount, 10) || 1)));
      el.fieldCustomShare.value =
        subToEdit.splitMode === 'custom' && subToEdit.customShare ? String(subToEdit.customShare) : '';
      el.fieldPayment.value = subToEdit.paymentMethod || '';
      el.fieldMemo.value = subToEdit.memo || '';
      el.fieldBillingDay.value = String(subToEdit.billingDay);
      el.fieldStartDate.value = subToEdit.startDate || '';
      setDateInputMode(subToEdit.startDate ? 'startDate' : 'billingDay', { syncValues: false });
      setSplitInputMode(subToEdit.splitMode === 'custom' ? 'custom' : 'ratio', { syncPlaceholder: false });
    } else {
      state.editingId = null;
      el.modalTitle.textContent = '새 구독 서비스 추가';
      el.modalSubtitle.textContent = '매달·매년 정기 결제되는 서비스 정보를 입력하세요';
      el.btnModalSubmit.textContent = '추가하기';
      el.subForm.reset();
      el.fieldId.value = '';
      el.fieldCycle.value = 'monthly';
      el.fieldSplit.value = '1';
      el.fieldCustomShare.value = '';
      const today = new Date();
      el.fieldStartDate.value = formatIsoDate(today);
      el.fieldBillingDay.value = String(today.getDate());
      setDateInputMode('startDate', { syncValues: false });
      setSplitInputMode('ratio', { syncPlaceholder: false });
    }

    syncPriceLabel();
    updateFormPreview();
    el.subModal.hidden = false;
    el.fieldName.focus();
  }

  function closeSubModal() {
    el.subModal.hidden = true;
    state.editingId = null;
  }

  function openConfirmModal(action = 'resetAll') {
    if (action === 'purgeInactive') {
      const offCount = state.subscriptions.filter((s) => !s.isActive).length;
      if (offCount === 0) return;
      state.confirmAction = 'purgeInactive';
      el.confirmTitle.textContent = `시뮬레이션 OFF ${offCount}개를 실제로 해지(삭제)할까요?`;
      el.confirmDesc.innerHTML =
        '해지 시뮬레이션 상태인 구독들이 목록에서 영구 제거됩니다. 나중에 다시 쓰고 싶다면 <strong>JSON 백업</strong>을 먼저 진행해주세요.';
      el.btnConfirmOk.textContent = `${offCount}개 일괄 해지`;
    } else {
      if (state.subscriptions.length === 0) {
        showToast('초기화할 구독 데이터가 이미 비어 있습니다.', 'info');
        return;
      }
      state.confirmAction = 'resetAll';
      el.confirmTitle.textContent = '모든 구독 내역을 초기화할까요?';
      el.confirmDesc.innerHTML =
        '브라우저에 저장된 모든 구독 목록이 삭제됩니다. 필요하다면 초기화 전에 <strong>JSON 백업</strong>을 먼저 진행해주세요.';
      el.btnConfirmOk.textContent = '전체 초기화';
    }
    el.confirmModal.hidden = false;
    el.btnConfirmCancel.focus();
  }

  function closeConfirmModal() {
    el.confirmModal.hidden = true;
  }

  function updateFormPreview() {
    const price = Number(el.fieldPrice.value);
    const validPrice = Number.isFinite(price) && price > 0;
    const billingCycle = el.fieldCycle.value === 'yearly' ? 'yearly' : 'monthly';
    const splitMode = state.splitInputMode;
    const splitCount = Math.max(1, parseInt(el.fieldSplit.value, 10) || 1);
    const customShare = Number(el.fieldCustomShare.value);
    const validCustom = splitMode === 'custom' && Number.isFinite(customShare) && customShare > 0;

    let billingDay = null;
    let startDate = null;

    if (state.dateInputMode === 'startDate') {
      const parsed = parseIsoDate(el.fieldStartDate.value);
      if (parsed) {
        startDate = formatIsoDate(parsed);
        billingDay = parsed.getDate();
      }
    } else {
      const day = parseInt(el.fieldBillingDay.value, 10);
      if (Number.isInteger(day) && day >= 1 && day <= 31) {
        billingDay = day;
      }
    }

    const validDate = billingDay !== null;

    if (!validPrice && !validDate && !validCustom) {
      el.formPreview.textContent =
        '금액과 시작일(또는 결제일)을 입력하면 내 월 부담금과 다음 결제 D-Day를 미리 보여드려요.';
      return;
    }

    const parts = [];
    if (validPrice || validCustom) {
      const effectiveInput = {
        price: validPrice ? price : customShare,
        billingCycle,
        splitMode: validCustom ? 'custom' : 'ratio',
        splitCount,
        customShare: validCustom ? customShare : null
      };
      const monthlyEff = getEffectiveMonthlyPrice(effectiveInput);
      parts.push(`내 월 부담 <strong>${formatKRW(monthlyEff)}</strong> (연 ${formatKRW(monthlyEff * 12)})`);
    }
    if (validDate) {
      const info = getNextBillingInfo(billingDay, startDate, billingCycle);
      if (startDate) {
        const duration = getSubscriptionDurationText(startDate);
        parts.push(`${billingCycle === 'yearly' ? '매년' : `매월 ${billingDay}일`} (${duration})`);
      }
      parts.push(`다음 결제 <strong>${info.dateText} (${info.label})</strong>`);
    }
    el.formPreview.innerHTML = parts.join(' · ');
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    const name = el.fieldName.value.trim();
    const category = el.fieldCategory.value;
    const billingCycle = el.fieldCycle.value === 'yearly' ? 'yearly' : 'monthly';
    const price = Number(el.fieldPrice.value);
    const splitMode = state.splitInputMode === 'custom' ? 'custom' : 'ratio';
    const splitCount = Math.min(10, Math.max(1, parseInt(el.fieldSplit.value, 10) || 1));
    const customShare = splitMode === 'custom' ? Number(el.fieldCustomShare.value) : null;
    const paymentMethod = el.fieldPayment.value.trim();
    const memo = el.fieldMemo.value.trim();

    // Strict input validation
    if (!name) {
      return showFormError('서비스 이름을 입력해주세요.');
    }
    if (!CATEGORIES.includes(category)) {
      return showFormError('올바른 카테고리를 선택해주세요.');
    }
    if (!Number.isFinite(price) || price <= 0) {
      return showFormError('결제 금액은 0원보다 큰 숫자로 입력해주세요.');
    }
    if (price > 100000000) {
      return showFormError('결제 금액은 1억 원 이하로 입력해주세요.');
    }
    if (splitMode === 'custom') {
      if (!Number.isFinite(customShare) || customShare <= 0) {
        return showFormError('내가 부담하는 금액은 0원보다 큰 숫자로 입력해주세요.');
      }
      if (customShare > price) {
        return showFormError('내 부담 금액은 전체 결제 금액보다 클 수 없습니다.');
      }
    }

    let billingDay;
    let startDate = null;

    if (state.dateInputMode === 'startDate') {
      const parsed = parseIsoDate(el.fieldStartDate.value);
      if (!parsed) {
        return showFormError('구독 시작일을 올바르게 선택해주세요.');
      }
      startDate = formatIsoDate(parsed);
      billingDay = parsed.getDate();
    } else {
      billingDay = Number(el.fieldBillingDay.value);
      if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
        return showFormError('결제일은 1일부터 31일 사이의 정수로 입력해주세요.');
      }
    }

    if (state.modalMode === 'preset') {
      addCustomPreset({
        name,
        category,
        price,
        billingCycle,
        splitMode,
        splitCount,
        customShare,
        billingDay,
        color: state.selectedPresetColor
      });
    } else if (state.editingId) {
      updateSubscription(state.editingId, {
        name,
        category,
        price,
        billingCycle,
        splitMode,
        splitCount,
        customShare,
        paymentMethod,
        memo,
        billingDay,
        startDate
      });
    } else {
      addSubscription({
        name,
        category,
        price,
        billingCycle,
        splitMode,
        splitCount,
        customShare,
        paymentMethod,
        memo,
        billingDay,
        startDate
      });
    }

    closeSubModal();
  }

  function showFormError(message) {
    el.formError.textContent = message;
    el.formError.hidden = false;
  }

  function syncFilterChipUI() {
    el.categoryFilters.querySelectorAll('.filter-chip').forEach((chip) => {
      const isMatch = chip.dataset.filter === state.filterCategory;
      chip.classList.toggle('is-active', isMatch);
      chip.setAttribute('aria-selected', String(isMatch));
    });
  }

  function syncStatusFilterUI() {
    el.statusFilters.querySelectorAll('.segment-btn').forEach((btn) => {
      const active = btn.dataset.status === state.filterStatus;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function syncViewModeUI() {
    el.viewModeToggle.querySelectorAll('.segment-btn').forEach((btn) => {
      const active = btn.dataset.view === state.viewMode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function syncBarModeUI() {
    el.barModeToggle.querySelectorAll('.segment-btn').forEach((btn) => {
      const active = btn.dataset.barMode === state.barMode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /* =========================================================================
     12. Event Bindings
     ========================================================================= */
  function bindEvents() {
    // Header toolbar
    el.btnSample.addEventListener('click', loadSampleData);
    el.btnExportJson.addEventListener('click', exportJsonBackup);
    el.btnImportJson.addEventListener('click', () => el.inputImportJson.click());
    el.inputImportJson.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      handleJsonImport(file);
      e.target.value = ''; // Allow re-importing the same file
    });
    el.btnReset.addEventListener('click', () => openConfirmModal('resetAll'));
    el.btnThemeToggle.addEventListener('click', toggleTheme);

    // Target Budget Inline Editor
    el.btnBudgetToggle.addEventListener('click', () => {
      el.budgetEditor.hidden = !el.budgetEditor.hidden;
      if (!el.budgetEditor.hidden) {
        el.fieldBudget.value = state.budgetLimit > 0 ? String(state.budgetLimit) : '';
        el.fieldBudget.focus();
      }
    });

    el.budgetEditor.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = Number(el.fieldBudget.value);
      if (!Number.isFinite(val) || val < 1000) {
        showToast('목표 예산은 1,000원 이상으로 입력해주세요.', 'error');
        return;
      }
      state.budgetLimit = Math.round(val);
      saveBudgetToStorage();
      el.budgetEditor.hidden = true;
      renderKPIsAndBanner();
      showToast(`월 구독 목표 예산을 ${formatKRW(state.budgetLimit)}으로 설정했습니다.`, 'success');
    });

    el.btnBudgetClear.addEventListener('click', () => {
      state.budgetLimit = 0;
      saveBudgetToStorage();
      el.budgetEditor.hidden = true;
      renderKPIsAndBanner();
      showToast('목표 예산 설정을 해제했습니다.', 'info');
    });

    // Simulation Banner
    el.btnSimRestoreAll.addEventListener('click', restoreAllSimulations);
    el.btnSimPurgeOff.addEventListener('click', () => openConfirmModal('purgeInactive'));

    // Bar Chart Mode Switcher
    el.barModeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.segment-btn');
      if (!btn) return;
      state.barMode = btn.dataset.barMode === 'period' ? 'period' : 'compare';
      syncBarModeUI();
      renderBarChart();
    });

    // 1-Click Presets (Add Subscription / Remove Preset / Restore Default Presets)
    el.presetGrid.addEventListener('click', (e) => {
      const restoreBtn = e.target.closest('[data-action="restore-presets-inline"]');
      if (restoreBtn) {
        restoreDefaultPresets();
        return;
      }

      const removeBtn = e.target.closest('[data-remove-preset-index]');
      if (removeBtn) {
        removeCustomPreset(Number(removeBtn.dataset.removePresetIndex));
        return;
      }

      const mainBtn = e.target.closest('[data-preset-index]');
      if (!mainBtn) return;
      const preset = state.presets[Number(mainBtn.dataset.presetIndex)];
      if (!preset) return;
      addSubscription(preset);
    });

    el.btnMobilePresetAdd.addEventListener('click', () => {
      const idx = Number(el.mobilePresetSelect.value);
      const preset = state.presets[idx];
      if (!preset) return;
      addSubscription(preset);
    });

    el.btnMobilePresetRemove.addEventListener('click', () => {
      const idx = Number(el.mobilePresetSelect.value);
      if (!Number.isInteger(idx) || !state.presets[idx]) return;
      removeCustomPreset(idx);
    });

    el.btnRestorePresets.addEventListener('click', restoreDefaultPresets);
    el.btnOpenPresetModal.addEventListener('click', () => openSubModal(null, { mode: 'preset' }));
    el.presetColorPicker.addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (!swatch) return;
      syncPresetColorUI(swatch.dataset.color);
    });

    // Open Add Modal triggers
    el.btnOpenAddModal.addEventListener('click', () => openSubModal(null, { mode: 'subscription' }));
    el.btnEmptyAdd.addEventListener('click', () => openSubModal(null, { mode: 'subscription' }));
    el.btnEmptySample.addEventListener('click', loadSampleData);

    // Export All Active .ics
    el.btnExportAllIcs.addEventListener('click', () => {
      const activeSubs = state.subscriptions.filter((s) => s.isActive);
      downloadIcsFile(activeSubs, 'subpulse-all-reminders.ics');
    });

    // View Mode, Search, Status & Category Filter & Sort
    el.viewModeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.segment-btn');
      if (!btn) return;
      state.viewMode = btn.dataset.view === 'calendar' ? 'calendar' : 'list';
      syncViewModeUI();
      renderSubscriptionList();
    });

    el.btnCalPrev.addEventListener('click', () => {
      state.calendarMonth -= 1;
      if (state.calendarMonth < 0) {
        state.calendarMonth = 11;
        state.calendarYear -= 1;
      }
      renderSubscriptionList();
    });

    el.btnCalNext.addEventListener('click', () => {
      state.calendarMonth += 1;
      if (state.calendarMonth > 11) {
        state.calendarMonth = 0;
        state.calendarYear += 1;
      }
      renderSubscriptionList();
    });

    el.btnCalToday.addEventListener('click', () => {
      const today = new Date();
      state.calendarYear = today.getFullYear();
      state.calendarMonth = today.getMonth();
      renderSubscriptionList();
    });

    el.calendarGrid.addEventListener('click', (e) => {
      const pill = e.target.closest('[data-cal-id]');
      if (!pill) return;
      const sub = state.subscriptions.find((s) => s.id === pill.dataset.calId);
      if (sub) openSubModal(sub);
    });

    el.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderSubscriptionList();
    });

    el.btnSearchClear.addEventListener('click', () => {
      state.searchQuery = '';
      el.searchInput.value = '';
      renderSubscriptionList();
      el.searchInput.focus();
    });

    el.statusFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.segment-btn');
      if (!btn) return;
      state.filterStatus = btn.dataset.status || 'all';
      syncStatusFilterUI();
      renderSubscriptionList();
    });

    el.categoryFilters.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      state.filterCategory = chip.dataset.filter;
      syncFilterChipUI();
      renderSubscriptionList();
    });

    el.sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderSubscriptionList();
    });

    // Subscription List Delegation (Toggle, .ics, Edit, Delete)
    el.subscriptionList.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      const itemEl = actionBtn.closest('.sub-item');
      if (!itemEl) return;

      const id = itemEl.dataset.id;
      const action = actionBtn.dataset.action;
      const sub = state.subscriptions.find((s) => s.id === id);
      if (!sub) return;

      if (action === 'toggle') {
        toggleSubscription(id);
      } else if (action === 'ics') {
        const safeFile = sub.name.replace(/[^a-zA-Z0-9가-힣_-]+/g, '_');
        downloadIcsFile([sub], `subpulse-${safeFile}.ics`);
      } else if (action === 'edit') {
        openSubModal(sub);
      } else if (action === 'delete') {
        deleteSubscription(id);
      }
    });

    // Add / Edit Modal
    el.subForm.addEventListener('submit', handleFormSubmit);
    el.dateModeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.segment-btn');
      if (!btn) return;
      setDateInputMode(btn.dataset.mode);
    });
    el.splitModeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.segment-btn');
      if (!btn) return;
      setSplitInputMode(btn.dataset.splitMode);
    });
    el.fieldCycle.addEventListener('change', () => {
      syncPriceLabel();
      updateFormPreview();
    });
    el.fieldPrice.addEventListener('input', updateFormPreview);
    el.fieldSplit.addEventListener('change', updateFormPreview);
    el.fieldCustomShare.addEventListener('input', updateFormPreview);
    el.fieldStartDate.addEventListener('input', updateFormPreview);
    el.fieldStartDate.addEventListener('change', updateFormPreview);
    el.fieldBillingDay.addEventListener('input', updateFormPreview);
    el.btnModalClose.addEventListener('click', closeSubModal);
    el.btnModalCancel.addEventListener('click', closeSubModal);
    el.subModal.addEventListener('click', (e) => {
      if (e.target === el.subModal) closeSubModal();
    });

    // Confirm Modal (Reset All / Purge OFF)
    el.btnConfirmCancel.addEventListener('click', closeConfirmModal);
    el.btnConfirmOk.addEventListener('click', () => {
      if (state.confirmAction === 'purgeInactive') {
        purgeInactiveSubscriptions();
      } else {
        resetAllData();
      }
    });
    el.confirmModal.addEventListener('click', (e) => {
      if (e.target === el.confirmModal) closeConfirmModal();
    });

    // Global ESC to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!el.subModal.hidden) closeSubModal();
        if (!el.confirmModal.hidden) closeConfirmModal();
      }
    });
  }

  /* =========================================================================
     13. Bootstrap
     ========================================================================= */
  function init() {
    initTheme();
    state.budgetLimit = loadBudgetFromStorage();
    state.presets = loadPresetsFromStorage();
    state.subscriptions = loadFromStorage();
    bindEvents();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
