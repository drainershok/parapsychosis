/* Акцентный цвет кнопок: палитра, рандом при заходе, сохранение выбора.
   Без неона и свечений — только плоская заливка. */

const PALETTE = [
  { name: 'pink',  rgb: [255, 33, 125] },
  { name: 'ink',   rgb: [ 26,  26,  28] },
  { name: 'white', rgb: [255, 255, 255] }
];

const STORE = {
  accent: 'shop.accent',
  pinned: 'shop.accent.pinned',
  mode: 'shop.mode',
  contacts: 'shop.contacts',
  cart: 'shop.cart'
};

function clamp255(n) { return Math.max(0, Math.min(255, Math.round(Number(n) || 0))); }

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => clamp255(v).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/* текст на кнопке: на светлом акценте — чёрный, на тёмном — белый */
function readableOn(rgb) {
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.4 ? '#111111' : '#ffffff';
}

const Theme = {
  rgb: [255, 33, 125],
  mode: 'auto',        /* auto | light | dark */
  resolved: 'light',   /* что реально применено */

  random() {
    return PALETTE[Math.floor(Math.random() * PALETTE.length)].rgb;
  },

  systemPref() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  },

  apply(rgb) {
    this.rgb = [clamp255(rgb[0]), clamp255(rgb[1]), clamp255(rgb[2])];
    const root = document.documentElement;
    root.style.setProperty('--accent', rgbToHex(this.rgb));
    root.style.setProperty('--accent-ink', readableOn(this.rgb));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', rgbToHex(this.rgb));
  },

  /* Старт: закреплённый цвет сохраняется, иначе — рандом на каждое посещение */
  init() {
    const saved = localStorage.getItem(STORE.mode);
    this.setMode(saved === 'light' || saved === 'dark' ? saved : 'auto', true);

    const pinned = hexToRgb(localStorage.getItem(STORE.accent));
    if (localStorage.getItem(STORE.pinned) === '1' && pinned) {
      this.apply(pinned);
      return 'pinned';
    }
    this.apply(this.random());
    return 'random';
  },

  setManual(rgb) {
    this.apply(rgb);
    localStorage.setItem(STORE.accent, rgbToHex(this.rgb));
    localStorage.setItem(STORE.pinned, '1');
  },

  clearPinned() {
    localStorage.removeItem(STORE.accent);
    localStorage.removeItem(STORE.pinned);
    this.apply(this.random());
  },

  setMode(mode, skipSave) {
    this.mode = mode === 'dark' || mode === 'light' ? mode : 'auto';
    this.resolved = this.mode === 'auto' ? this.systemPref() : this.mode;
    document.documentElement.setAttribute('data-theme', this.resolved);
    if (!skipSave) localStorage.setItem(STORE.mode, this.mode);
  },

  /* переключить светлая/тёмную, не трогая режим «как в системе» */
  toggleMode() {
    this.setMode(this.resolved === 'dark' ? 'light' : 'dark');
    return this.resolved;
  },

  /* следить за сменой темы в системе, пока выбран режим auto */
  watchSystem() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (this.mode === 'auto') this.setMode('auto', true); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  },

  currentHex() { return rgbToHex(this.rgb); }
};

window.Theme = Theme;