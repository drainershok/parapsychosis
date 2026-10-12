/* ============================================================
   Наличие + корзина + оформление + панель настроек
   ============================================================ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const money = n => n.toLocaleString('ru-RU') + ' ₽';

const Store = {
  read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
};

/* ---------------- состояние ---------------- */
const state = {
  cat: 'all',
  sort: 'new',
  search: '',
  cart: Store.read(STORE.cart, []),
  shipMethod: 'cdek',
  promo: null
};

/* промокод: применяем и считаем скидку от суммы товаров */
function promoLookup(code) {
  return (typeof PROMOCODES !== 'undefined' && PROMOCODES[String(code || '').trim().toUpperCase()]) || null;
}
function promoDiscount(sum) {
  if (!state.promo || !sum) return 0;
  const d = state.promo.type === 'percent' ? sum * state.promo.value / 100 : state.promo.value;
  return Math.max(0, Math.min(Math.round(d), sum));
}

/* ---------------- всплывашки ---------------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-show'), 2200);
}

function openPanel(el) {
  el.classList.add('is-open');
  $('#overlay').classList.add('is-open');
}
function closePanels() {
  $$('.settings, .drawer').forEach(el => el.classList.remove('is-open'));
  $('#gearBtn').classList.remove('is-open');
  $('#overlay').classList.remove('is-open');
}
function closeSettingsOnly() {
  $('#settings').classList.remove('is-open');
  $('#gearBtn').classList.remove('is-open');
  if (!$('#cartDrawer').classList.contains('is-open') && !$('#checkoutDrawer').classList.contains('is-open')) {
    $('#overlay').classList.remove('is-open');
  }
}

/* ============================================================
   ПАНЕЛЬ НАСТРОЕК — цвет кнопок
   ============================================================ */
function renderSwatches() {
  const box = $('#swatches');
  box.innerHTML = '';
  PALETTE.forEach(p => {
    const hex = rgbToHex(p.rgb);
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = hex;
    b.title = p.name;
    b.dataset.hex = hex;
    b.addEventListener('click', () => {
      Theme.setManual(p.rgb);
      $('#randomToggle').checked = false;
      syncSettingsUI();
      toast('цвет кнопок: ' + hex);
    });
    box.appendChild(b);
  });
}

function syncSettingsUI() {
  if (!$('#hexOut')) return;
  const hex = Theme.currentHex();
  $('#hexOut').textContent = hex.toUpperCase();
  $('#colorPicker').value = hex;
  if (document.activeElement !== $('#colorHex')) $('#colorHex').value = hex.toUpperCase();
  $$('#swatches .swatch').forEach(s => s.classList.toggle('is-active', s.dataset.hex.toLowerCase() === hex.toLowerCase()));
}

function initSettings() {
  $('#randomToggle').checked = localStorage.getItem(STORE.pinned) !== '1';

  $('#colorPicker').addEventListener('input', e => {
    const rgb = hexToRgb(e.target.value);
    if (rgb) { Theme.setManual(rgb); $('#randomToggle').checked = false; syncSettingsUI(); }
  });

  $('#applyHex').addEventListener('click', () => {
    const rgb = hexToRgb($('#colorHex').value);
    if (rgb) {
      Theme.setManual(rgb);
      $('#randomToggle').checked = false;
      syncSettingsUI();
      toast('цвет применён');
    } else {
      toast('не похоже на цвет');
    }
  });
  $('#colorHex').addEventListener('keydown', e => { if (e.key === 'Enter') $('#applyHex').click(); });

  $('#randomToggle').addEventListener('change', e => {
    if (e.target.checked) {
      Theme.clearPinned();
      toast('цвет случайный при заходе');
    }
    syncSettingsUI();
  });

  $('#randomizeNow').addEventListener('click', () => {
    Theme.apply(Theme.random(), Theme.glow);
    syncSettingsUI();
    toast('новый случайный цвет');
  });

  $('#resetTheme').addEventListener('click', () => {
    localStorage.removeItem(STORE.mode);
    Theme.setMode('auto');
    Theme.clearPinned();
    $('#randomToggle').checked = true;
    syncThemeUI();
    syncSettingsUI();
    toast('тема сброшена');
  });

  /* тема: светлая / тёмная / как в системе.
     без всплывашки — смена темы видна сразу, а тост выпирал из-под низа экрана */
  $$('#themeRow [data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      Theme.setMode(btn.dataset.mode);
      syncThemeUI();
    });
  });
  Theme.watchSystem();
}

/* подсветка активной темы */
function syncThemeUI() {
  $$('#themeRow [data-mode]').forEach(b => {
    const on = b.dataset.mode === Theme.mode;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

/* ============================================================
   НАЛИЧИЕ
   ============================================================ */
function isSold(p) { return (p.stock || 0) <= 0; }
function totalStock(p) { return Math.max(0, p.stock || 0); }

/* категории: из массива + найденные в товарах */
function allCategories() {
  const list = CATEGORIES.slice();
  PRODUCTS.forEach(p => {
    if (!list.some(c => c.id === p.cat)) {
      list.push({ id: p.cat, label: p.cat });
    }
  });
  return list;
}

function renderChips() {
  const box = $('#catChips');
  box.innerHTML = '';
  allCategories().forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip' + (state.cat === c.id ? ' is-active' : '');
    b.textContent = c.label;
    b.addEventListener('click', () => { state.cat = c.id; renderChips(); renderGrid(); });
    box.appendChild(b);
  });
}

function cardHtml(p, sold) {
  const img = productImg(p);
  const badge = sold
    ? '<span class="tag tag--sold">sold out</span>'
    : (p.tag === 'new' ? '<span class="tag">new</span>'
      : p.tag === 'хит' ? '<span class="tag">хит</span>' : '');

  return `
  <article class="card${sold ? ' is-sold' : ''}" data-id="${p.id}">
    <div class="card__media">
      <img src="${img}" alt="${p.name}" loading="lazy">
      <div class="card__badges">${badge}</div>
    </div>
    <div class="card__body">
      <div class="card__name">${p.name}</div>
      <div class="card__price">
        <b>${money(p.price)}</b>
        ${p.old ? `<s>${money(p.old)}</s>` : ''}
      </div>
      <div class="card__foot">
        <button class="btn btn--sm" style="flex:1" data-add${sold ? ' disabled' : ''}>${sold ? 'нет в наличии' : 'в корзину'}</button>
      </div>
    </div>
  </article>`;
}

function bindCards(scope) {
  $$('.card', scope).forEach(card => {
    const p = PRODUCTS.find(x => x.id === card.dataset.id);
    if (!p) return;
    const addBtn = $('[data-add]', card);
    if (addBtn && !addBtn.disabled) addBtn.addEventListener('click', () => addToCart(p.id));
  });
}

function filtered(list) {
  let out = list.slice();
  if (state.cat !== 'all') out = out.filter(p => p.cat === state.cat);
  if (state.search) {
    const q = state.search.toLowerCase();
    out = out.filter(p => p.name.toLowerCase().includes(q) || p.cat.includes(q));
  }
  switch (state.sort) {
    case 'cheap': out.sort((a, b) => a.price - b.price); break;
    case 'exp':   out.sort((a, b) => b.price - a.price); break;
    default:      out.sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

function renderGrid() {
  const grid = $('#grid');

  /* наличие пусто — прячем фильтры и заголовок */
  if (!PRODUCTS.length) {
    grid.innerHTML = '<div class="empty"><b>пока пусто</b>Добавь товары в assets/js/products.js</div>';
    $('#filters').hidden = true;
    $('#stockHead').hidden = true;
    return;
  }

  $('#filters').hidden = false;
  $('#stockHead').hidden = false;

  const main = filtered(PRODUCTS);
  grid.innerHTML = main.length
    ? main.map(p => cardHtml(p, isSold(p))).join('')
    : '<div class="empty"><b>ничего не нашлось</b>сбрось фильтры</div>';
  bindCards(grid);

  const left = main.reduce((a, p) => a + totalStock(p), 0);
  $('#stockMeta').textContent = `${main.length} моделей · ${left} штук`;
}

/* ---------- сортировка: свой список вместо нативного select ---------- */
const SORT_LABELS = { new: 'сначала новые', cheap: 'дешевле', exp: 'дороже' };

function setSort(value) {
  if (!SORT_LABELS[value]) return;
  state.sort = value;
  $('#sortLabel').textContent = SORT_LABELS[value];
  $$('#sortSelect .select__opt').forEach(o => {
    const on = o.dataset.value === value;
    o.classList.toggle('is-active', on);
    o.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  renderGrid();
}

function closeSelect() {
  const box = $('#sortSelect');
  if (!box) return;
  box.querySelector('.select__list').hidden = true;
  box.querySelector('.select__btn').setAttribute('aria-expanded', 'false');
}

function initSelect() {
  const box = $('#sortSelect');
  const btn = box.querySelector('.select__btn');
  const list = box.querySelector('.select__list');
  const opts = $$('.select__opt', list);

  setSort(state.sort);

  const open = () => {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  };

  btn.addEventListener('click', () => {
    list.hidden ? open() : closeSelect();
  });

  opts.forEach(o => o.addEventListener('click', () => {
    setSort(o.dataset.value);
    closeSelect();
    btn.focus();
  }));

  btn.addEventListener('keydown', e => {
    const i = opts.findIndex(o => o.dataset.value === state.sort);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setSort(opts[(i + step + opts.length) % opts.length].dataset.value);
    } else if (e.key === 'Escape') {
      closeSelect();
    }
  });

  document.addEventListener('click', e => {
    if (!box.contains(e.target)) closeSelect();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSelect();
  });
}

function initCatalog() {
  renderChips();

  initSelect();
  let sTimer;
  $('#searchInput').addEventListener('input', e => {
    clearTimeout(sTimer);
    sTimer = setTimeout(() => { state.search = e.target.value.trim(); renderGrid(); }, 180);
  });

  renderGrid();
}

/* ============================================================
   КОРЗИНА
   ============================================================ */
function addToCart(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) { toast('товар недоступен'); return; }
  if (isSold(p)) { toast('этого товара больше нет'); return; }
  const line = state.cart.find(l => l.id === id);
  if (line) {
    if (line.qty >= p.stock) { toast('весь остаток уже в корзине'); return; }
    line.qty++;
  } else {
    state.cart.push({ id, qty: 1 });
  }
  Store.write(STORE.cart, state.cart);
  renderCart();
  updateCartCount();
  toast(p.name + ' — в корзине');
}

function changeQty(id, delta) {
  const p = PRODUCTS.find(x => x.id === id);
  const line = state.cart.find(l => l.id === id);
  if (!line || !p) return;
  line.qty += delta;
  if (line.qty <= 0) state.cart = state.cart.filter(l => l.id !== id);
  else if (line.qty > p.stock) { line.qty = p.stock; toast('больше нет в наличии'); }
  Store.write(STORE.cart, state.cart);
  renderCart();
  updateCartCount();
}

function removeLine(id) {
  state.cart = state.cart.filter(l => l.id !== id);
  Store.write(STORE.cart, state.cart);
  renderCart();
  updateCartCount();
}

function updateCartCount() {
  const n = state.cart.reduce((a, l) => a + l.qty, 0);
  const el = $('#cartCount');
  el.textContent = n;
  el.classList.toggle('is-active', n > 0);
}

function totals() {
  let sum = 0;
  state.cart.forEach(l => {
    const p = PRODUCTS.find(x => x.id === l.id);
    if (p) sum += p.price * l.qty;
  });
  return { sum, ship: 0, total: sum };
}

function renderCart() {
  const body = $('#cartBody');
  const foot = $('#cartFoot');

  if (!state.cart.length) {
    body.innerHTML = '<div class="empty"><b>корзина пуста</b></div>';
    foot.innerHTML = '<a href="index.html#stock" class="btn btn--block">в наличие</a>';
    return;
  }

  body.innerHTML = state.cart.map(l => {
    const p = PRODUCTS.find(x => x.id === l.id);
    if (!p) return '';
    return `
    <div class="cart-item">
      <div class="cart-item__img"><img src="${productImg(p)}" alt=""></div>
      <div>
        <div class="cart-item__name">${p.name}</div>
        <div class="cart-item__meta">${money(p.price)}</div>
        <div class="qty">
          <button data-dec>−</button><span>${l.qty}</span><button data-inc>+</button>
          <button class="cart-item__del" data-del>удалить</button>
        </div>
      </div>
      <div class="cart-item__price">${money(p.price * l.qty)}</div>
    </div>`;
  }).join('');

  $$('#cartBody .cart-item').forEach((row, i) => {
    const l = state.cart[i];
    $('[data-inc]', row).addEventListener('click', () => changeQty(l.id, 1));
    $('[data-dec]', row).addEventListener('click', () => changeQty(l.id, -1));
    $('[data-del]', row).addEventListener('click', () => removeLine(l.id));
  });

  const t = totals();
  const disc = promoDiscount(t.sum);
  foot.innerHTML = `
    <div class="sum-row"><span>товары</span><span>${money(t.sum)}</span></div>
    ${disc ? `<div class="sum-row"><span>скидка${state.promo.label ? ' · ' + state.promo.label : ''}</span><span>−${money(disc)}</span></div>` : ''}
    <div class="sum-row"><span>доставка</span><span>рассчитывается отдельно</span></div>
    <div class="sum-row sum-row--total"><span>итого за товары</span><b>${money(t.sum - disc)}</b></div>
    <button class="btn btn--block" id="toCheckout">оформить заказ</button>`;

  $('#toCheckout').addEventListener('click', () => {
    closePanels();
    renderCheckout();
    openPanel($('#checkoutDrawer'));
  });
}

/* ============================================================
   ОФОРМЛЕНИЕ ЗАКАЗА
   ============================================================ */
function renderCheckout() {
  const saved = Store.read(STORE.contacts, {});
  const t = totals();
  const disc = promoDiscount(t.sum);
  const promoLabel = state.promo && state.promo.label ? ' · ' + state.promo.label : '';

  $('#checkoutBody').innerHTML = `
  <div class="form">
    <div class="form__grid">
      <div class="field field--wide">
        <label for="f-name">ФИО *</label>
        <input id="f-name" type="text" placeholder="Иванов Иван Иванович" value="${saved.name || ''}">
        <span class="field__err"></span>
      </div>
      <div class="field">
        <label for="f-phone">телефон *</label>
        <input id="f-phone" type="tel" placeholder="+7 900 000-00-00" value="${saved.phone || ''}">
        <span class="field__err"></span>
      </div>
      <div class="field">
        <label for="f-email">e-mail *</label>
        <input id="f-email" type="email" placeholder="you@mail.ru" value="${saved.email || ''}">
        <span class="field__err"></span>
      </div>
      <div class="field">
        <label for="f-index">индекс *</label>
        <input id="f-index" type="text" placeholder="101000" value="${saved.index || ''}">
        <span class="field__err"></span>
      </div>
      <div class="field">
        <label for="f-country">страна</label>
        <input id="f-country" type="text" placeholder="Россия" value="${saved.country || 'Россия'}">
      </div>
      <div class="field field--wide">
        <label for="f-addr">адрес *</label>
        <input id="f-addr" type="text" placeholder="город, улица, дом, квартира" value="${saved.addr || ''}">
        <span class="field__err"></span>
      </div>
      <div class="field field--wide">
        <label for="f-messenger">ссылка на VK или Telegram</label>
        <input id="f-messenger" type="text" placeholder="https://vk.com/..." value="${saved.messenger || ''}">
      </div>
      <div class="field field--wide">
        <label for="f-comment">комментарий к заказу</label>
        <textarea id="f-comment" placeholder="любые пожелания"></textarea>
      </div>
    </div>

    <div class="field">
      <label>доставка</label>
      <div class="form__hint">стоимость зависит от расстояния и выбранной службы. Считаем отдельно от цены товара и называем до оплаты.</div>
      <div class="radios" id="shipRadios">
        ${SHIPPING.map(s => `
          <label class="radio">
            <input type="radio" name="ship" value="${s.id}"${state.shipMethod === s.id ? ' checked' : ''}>
            <span class="radio__text">${s.label}</span>
          </label>`).join('')}
      </div>
    </div>

    <div class="field">
      <label>способ оплаты</label>
      <div class="radios">
        <label class="radio"><input type="radio" name="pay" checked><span class="radio__text">СБП</span></label>
        <label class="radio"><input type="radio" name="pay"><span class="radio__text">Банковская карта</span></label>
        <label class="radio"><input type="radio" name="pay"><span class="radio__text">Долями</span></label>
      </div>
    </div>

    <div class="field">
      <label for="f-promo">промокод</label>
      <div class="color-row">
        <input id="f-promo" type="text" placeholder="если есть" value="${state.promo ? state.promo.code : ''}">
        <button class="btn btn--sm" id="applyPromo">применить</button>
      </div>
      <span class="form__msg" id="promoMsg"></span>
    </div>

    <label class="agree">
      <input type="checkbox" id="remember">
      Запомнить данные для следующего заказа
    </label>
    <label class="agree">
      <input type="checkbox" id="agree">
      Оформляя заказ, я соглашаюсь с <a href="offer.html" target="_blank">офертой</a>,
      <a href="public-offer.html" target="_blank">публичной офертой</a> и
      <a href="privacy.html" target="_blank">политикой конфиденциальности</a>
    </label>

    <div class="sum-row" id="discRow"${disc ? '' : ' hidden'}><span id="discLabel">скидка${promoLabel}</span><span id="discVal">−${money(disc)}</span></div>
    <div class="sum-row sum-row--total"><span>к оплате</span><b id="sumTotal">${money(t.sum - disc)}</b></div>
    <button class="btn btn--block" id="placeOrder">заказать</button>
  </div>`;

  $('#shipRadios').addEventListener('change', e => {
    state.shipMethod = e.target.value;
    renderCheckout();
  });

  $('#applyPromo').addEventListener('click', () => {
    const code = ($('#f-promo').value || '').trim();
    const msg = $('#promoMsg');
    const found = promoLookup(code);
    if (!found) {
      state.promo = null;
      msg.textContent = code ? 'такого промокода нет' : 'введите промокод';
      msg.className = 'form__msg err';
      updateCheckoutTotals();
      return;
    }
    state.promo = Object.assign({ code: code.toUpperCase() }, found);
    msg.textContent = 'применён: ' + state.promo.label;
    msg.className = 'form__msg';
    updateCheckoutTotals();
    toast('промокод ' + state.promo.code + ' применён');
  });

  $('#placeOrder').addEventListener('click', placeOrder);
}

/* пересчёт итога без перерисовки всей формы (чтобы не стереть введённое) */
function updateCheckoutTotals() {
  const sum = totals().sum;
  const disc = promoDiscount(sum);
  const row = $('#discRow');
  if (row) {
    row.hidden = !disc;
    if (disc) {
      $('#discLabel').textContent = 'скидка' + (state.promo && state.promo.label ? ' · ' + state.promo.label : '');
      $('#discVal').textContent = '−' + money(disc);
    }
  }
  const total = $('#sumTotal');
  if (total) total.textContent = money(sum - disc);
}

function markError(id, msg) {
  const el = $('#' + id);
  const field = el.closest('.field');
  field.classList.add('is-error');
  field.querySelector('.field__err').textContent = msg;
}

function placeOrder() {
  $$('.field').forEach(f => { f.classList.remove('is-error'); const e = f.querySelector('.field__err'); if (e) e.textContent = ''; });

  const rules = [
    ['f-name', v => v.trim().length >= 2 || 'введите ФИО'],
    ['f-phone', v => v.replace(/\D/g, '').length >= 10 || 'проверьте телефон'],
    ['f-email', v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) || 'проверьте e-mail'],
    ['f-index', v => v.trim().length >= 3 || 'введите почтовый индекс'],
    ['f-addr', v => v.trim().length >= 4 || 'введите адрес']
  ];

  let ok = true;
  rules.forEach(([id, check]) => {
    const el = $('#' + id);
    const res = check(el.value);
    if (res !== true) { markError(id, res); ok = false; }
  });

  if (!$('#agree').checked) { toast('подтвердите согласие с офертой'); ok = false; }
  if (!ok) return;

  if ($('#remember').checked) {
    Store.write(STORE.contacts, {
      name: $('#f-name').value,
      phone: $('#f-phone').value,
      email: $('#f-email').value,
      index: $('#f-index').value,
      country: $('#f-country').value,
      addr: $('#f-addr').value,
      messenger: $('#f-messenger').value
    });
  }

  const num = 'PS-' + Date.now().toString(36).toUpperCase().slice(-6);
  const contact = $('#f-messenger').value.trim();
  state.cart = [];
  Store.write(STORE.cart, state.cart);
  updateCartCount();

  $('#checkoutBody').innerHTML = `
    <div class="success">
      <div class="success__mark">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <h3>заказ принят</h3>
      <div class="success__num">${num}</div>
      <p>Реквизиты для оплаты товара и стоимости доставки пришлём${contact ? ' в ' + escapeHtml(contact) : ' в личные сообщения'}.</p>
      <button class="btn" onclick="closePanels()">ок</button>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ============================================================
   ИСТОРИЯ
   ============================================================ */
function renderHistory() {
  const box = $('#historyList');
  if (!box) return;

  if (!HISTORY.length) {
    box.innerHTML = '<div class="empty"><b>пока пусто</b>Добавь прошлые дропы в assets/js/products.js</div>';
    return;
  }

  box.innerHTML = HISTORY.map(h => `
    <div class="history__row">
      <div class="history__date">${h.date || ''}</div>
      <div class="history__body">
        <div class="history__title">${h.title || ''}</div>
        ${h.note ? `<div class="history__note">${h.note}</div>` : ''}
      </div>
    </div>`).join('');
}

/* ============================================================
   ЗАПУСК
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  syncSettingsUI();

  /* главная страница имеет наличие и корзину — на служебных страницах их нет */
  if (!$('#swatches')) return;

  renderSwatches();
  initSettings();
  syncThemeUI();
  initCatalog();
  renderHistory();
  updateCartCount();
  renderCart();

  $('#cartBtn').addEventListener('click', () => { closeSettingsOnly(); renderCart(); openPanel($('#cartDrawer')); });
  ['#closeCart', '#closeCheckout', '#overlay', '#closeSettings', '#gearBtn'].forEach(sel => {
    const el = $(sel);
    if (el) el.addEventListener('click', sel === '#closeCart' || sel === '#closeCheckout' || sel === '#overlay' ? closePanels : closeSettingsOnly);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanels(); });

  /* ручной ввод цвета как R255 G33 B125 */
  $('#colorHex').addEventListener('input', e => {
    const m = e.target.value.match(/(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/);
    if (m) { Theme.setManual([+m[1], +m[2], +m[3]]); syncSettingsUI(); }
  });

  /* открытие/закрытие панели настроек */
  const gear = $('#gearBtn');
  if (gear) gear.addEventListener('click', () => {
    const willOpen = !$('#settings').classList.contains('is-open');
    closePanels();
    if (willOpen) {
      $('#settings').classList.add('is-open');
      gear.classList.add('is-open');
      $('#overlay').classList.add('is-open');
    }
  });

  if (location.hash === '#settings') {
    $('#settings').classList.add('is-open');
    gear.classList.add('is-open');
    $('#overlay').classList.add('is-open');
  }
});