/* =============================================================================
   Gulos — carrinho, checkout, confirmação e cupom  (renderiza em #app-checkout)
   -----------------------------------------------------------------------------
   Eventos (GulosBus):
     ouve   'cart:add' (cartItem)  → soma qty se a key já existir
     ouve   'cart:open' ()         → abre a gaveta do carrinho
     emite  'cart:changed' {count,total,items}  (em toda mudança e uma vez ao carregar)
     emite  'order:placed' (order)
   localStorage: 'gulos:cart' (itens do carrinho), 'gulos:customer' (dados do cliente
   para o próximo pedido — nunca a localização).
   Extra (depuração/testes): window.GulosCheckout = { openCart, openCheckout, close, cart, clear }
   ============================================================================= */
(function () {
  'use strict';

  const CART_KEY = 'gulos:cart';
  const CUST_KEY = 'gulos:customer';
  const S = () => window.GulosStore.get();
  const brl = v => window.GulosStore.brl(v);
  const cfg = () => S().config || {};
  const shop = () => S().store || {};
  const digits = s => String(s || '').replace(/\D/g, '');
  const money = v => Math.round((Number(v) || 0) * 100) / 100;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  let root = document.getElementById('app-checkout');
  if (!root) { root = document.createElement('div'); root.id = 'app-checkout'; document.body.appendChild(root); }

  /* ------------------------------ ícones ------------------------------ */
  const I = {
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="currentColor"/><circle cx="12" cy="10" r="2.6" fill="var(--bg)"/></svg>',
    target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" fill="none"/></svg>',
    moto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="17" r="3" stroke="currentColor" stroke-width="1.9" fill="none"/><circle cx="18.5" cy="17" r="3" stroke="currentColor" stroke-width="1.9" fill="none"/><path d="M8.5 17h6l3-6h-4l-2-4H9M14 7h3l1.5 4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    store: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M10 20v-6h4v6" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" fill="none"/></svg>',
    pix: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l3.4 3.4a2.4 2.4 0 0 0-1.7.7L12 8.3l-1.7-1.7a2.4 2.4 0 0 0-1.7-.7L12 2.5zM5.9 8.6h1.3c.4 0 .8.2 1.1.4L10.6 11a2 2 0 0 0 2.8 0l2.3-2c.3-.3.7-.4 1.1-.4h1.3L21.5 12l-3.4 3.4h-1.3c-.4 0-.8-.2-1.1-.4L13.4 13a2 2 0 0 0-2.8 0l-2.3 2c-.3.3-.7.4-1.1.4H5.9L2.5 12l3.4-3.4zM12 15.7l1.7 1.7c.5.5 1.1.7 1.7.7L12 21.5l-3.4-3.4c.6 0 1.2-.2 1.7-.7l1.7-1.7z" fill="currentColor"/></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" stroke-width="1.9" fill="none"/><path d="M2.5 10h19M6 15h4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    cash: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2" stroke="currentColor" stroke-width="1.9" fill="none"/><circle cx="12" cy="12" r="2.8" stroke="currentColor" stroke-width="1.9" fill="none"/><path d="M6 9.5v5M18 9.5v5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h12v19l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5v-19zM9 7.5h6M9 11h6M9 14.5h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.9" fill="none"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" stroke-width="1.9" fill="none"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    burger: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 20c0-7 7.2-12 16-12s16 5 16 12H8z" fill="currentColor" opacity=".95"/><rect x="6" y="23" width="36" height="5" rx="2.5" fill="currentColor" opacity=".55"/><path d="M8 31h32v2a7 7 0 0 1-7 7H15a7 7 0 0 1-7-7v-2z" fill="currentColor" opacity=".85"/></svg>'
  };

  /* =============================== CARRINHO =============================== */
  let cart = (ls.get(CART_KEY, []) || []).filter(it => it && it.productId && it.qty > 0);

  function keyOf(it) {
    return it.key || [it.productId,
      (it.options || []).map(o => (o.groupName || '') + ':' + o.name).sort().join(','),
      (it.removed || []).slice().sort().join(','), (it.note || '').trim()].join('|');
  }
  const totals = () => {
    const count = cart.reduce((s, it) => s + it.qty, 0);
    const subtotal = money(cart.reduce((s, it) => s + it.unitPrice * it.qty, 0));
    return { count, subtotal };
  };
  const productQty = pid => cart.reduce((s, it) => s + (it.productId === pid ? it.qty : 0), 0);
  function stockOf(pid) {
    const p = window.GulosStore.product(pid);
    if (!p || p.active === false) return 0;
    return p.stock == null ? Infinity : Math.max(0, p.stock);
  }

  function emitChanged() {
    const t = totals();
    window.GulosBus.emit('cart:changed', { count: t.count, total: t.subtotal, items: cart.map(it => Object.assign({}, it)) });
  }
  function cartChanged() {
    ls.set(CART_KEY, cart);
    emitChanged();
    if (isOpen('drawer')) renderDrawer();
    if (isOpen('checkout') && view === 'form') { if (!cart.length) closeAll(); else renderSummary(); }
  }
  function addItem(raw) {
    if (!raw || !raw.productId) return;
    const it = {
      key: '', productId: raw.productId, name: raw.name || (window.GulosStore.product(raw.productId) || {}).name || 'Item',
      image: raw.image || '', qty: Math.max(1, parseInt(raw.qty, 10) || 1), unitPrice: money(raw.unitPrice),
      options: (raw.options || []).map(o => ({ groupName: o.groupName || '', name: o.name, price: money(o.price) })),
      removed: (raw.removed || []).slice(), note: raw.note || ''
    };
    it.key = keyOf(raw);
    const ex = cart.find(c => c.key === it.key);
    if (ex) ex.qty += it.qty; else cart.push(it);
    cartChanged();
  }
  function setQty(key, qty) {
    const it = cart.find(c => c.key === key);
    if (!it) return;
    if (qty <= 0) { cart = cart.filter(c => c !== it); cartChanged(); return; }
    const max = stockOf(it.productId) - (productQty(it.productId) - it.qty);
    if (qty > it.qty && qty > max) { toast(max > 0 ? 'Só temos ' + max + ' unidade(s) de ' + it.name + ' agora.' : it.name + ' esgotou.'); return; }
    it.qty = qty;
    cartChanged();
  }
  function clearCart() { cart = []; cartChanged(); }

  /* ============================ CAMADAS / UI ============================ */
  root.innerHTML =
    '<div class="co-layer co-layer--drawer" data-layer="drawer" hidden>' +
    '  <div class="co-backdrop" data-act="close"></div>' +
    '  <aside class="co-drawer" role="dialog" aria-modal="true" aria-labelledby="co-drawer-title" tabindex="-1"></aside>' +
    '</div>' +
    '<div class="co-layer co-layer--checkout" data-layer="checkout" hidden>' +
    '  <div class="co-screen" role="dialog" aria-modal="true" aria-labelledby="co-screen-title" tabindex="-1"></div>' +
    '</div>' +
    '<div class="co-layer co-layer--receipt" data-layer="receipt" hidden>' +
    '  <div class="co-backdrop" data-act="close"></div>' +
    '  <div class="co-receipt-modal" role="dialog" aria-modal="true" aria-label="Cupom do pedido" tabindex="-1"></div>' +
    '</div>' +
    '<div class="co-toast" role="status" aria-live="polite"></div>';

  const L = name => root.querySelector('[data-layer="' + name + '"]');
  const drawerEl = root.querySelector('.co-drawer');
  const screenEl = root.querySelector('.co-screen');
  const receiptEl = root.querySelector('.co-receipt-modal');
  const toastEl = root.querySelector('.co-toast');
  const openers = {};
  let view = 'form';
  let toastTimer = 0;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('co-toast--on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('co-toast--on'), 3200);
  }
  const isOpen = n => !L(n).hidden;
  function openLayer(n, focusEl) {
    const el = L(n);
    if (el.hidden) openers[n] = document.activeElement;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('co-layer--in'));
    document.documentElement.classList.add('co-lock');
    setTimeout(() => { (focusEl || el.querySelector('[tabindex="-1"]')).focus({ preventScroll: true }); }, 30);
  }
  function closeLayer(n) {
    const el = L(n);
    if (el.hidden) return;
    el.classList.remove('co-layer--in');
    setTimeout(() => {
      el.hidden = true;
      if (!root.querySelector('.co-layer:not([hidden])')) document.documentElement.classList.remove('co-lock');
    }, 220);
    const o = openers[n];
    if (o && o.focus && document.contains(o)) setTimeout(() => o.focus({ preventScroll: true }), 230);
  }
  function closeAll() { ['receipt', 'checkout', 'drawer'].forEach(closeLayer); }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (isOpen('receipt')) closeLayer('receipt');
    else if (isOpen('checkout')) { if (view === 'done') closeLayer('checkout'); else backToCart(); }
    else if (isOpen('drawer')) closeLayer('drawer');
  });
  // prende o foco dentro da camada do topo
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const top = ['receipt', 'checkout', 'drawer'].find(isOpen);
    if (!top) return;
    const box = L(top);
    const f = Array.from(box.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea,select,[tabindex="0"]')).filter(x => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  });

  function thumb(it) {
    const fb = '<span class="co-thumb-fb">' + I.burger + '</span>';
    if (!it.image) return '<span class="co-thumb">' + fb + '</span>';
    return '<span class="co-thumb">' + fb + '<img src="' + esc(it.image) + '" alt="" loading="lazy" onerror="this.remove()"></span>';
  }
  function itemMeta(it) {
    const out = [];
    if (it.options && it.options.length) out.push('<span class="co-meta-add">' + it.options.map(o => '+ ' + esc(o.name) + (o.price ? ' (' + brl(o.price) + ')' : '')).join(' · ') + '</span>');
    if (it.removed && it.removed.length) out.push('<span class="co-meta-rem">Sem ' + it.removed.map(esc).join(', ') + '</span>');
    if (it.note) out.push('<span class="co-meta-note">“' + esc(it.note) + '”</span>');
    return out.join('');
  }

  /* ------------------------------ GAVETA ------------------------------ */
  function deliveryFee(mode) { return mode === 'retirada' ? 0 : money(cfg().deliveryFee != null ? cfg().deliveryFee : shop().deliveryFee); }
  const minOrder = () => money(cfg().minOrder != null ? cfg().minOrder : shop().minOrder);

  function renderDrawer() {
    const t = totals();
    const mode = (saved() || {}).mode === 'retirada' ? 'retirada' : 'entrega';
    const fee = deliveryFee(mode);
    const min = minOrder();
    const lacking = money(min - t.subtotal);
    const unavailable = cart.filter(it => stockOf(it.productId) < productQty(it.productId));
    let html = '<header class="co-drawer-head"><span class="co-grip" aria-hidden="true"></span>' +
      '<h2 id="co-drawer-title" class="co-h2">Seu pedido</h2>' +
      (t.count ? '<span class="co-pill" aria-label="' + t.count + ' itens">' + t.count + (t.count === 1 ? ' item' : ' itens') + '</span>' : '') +
      '<button type="button" class="co-icon-btn" data-act="close" aria-label="Fechar carrinho">' + I.close + '</button></header>';
    if (!cart.length) {
      html += '<div class="co-empty"><span class="co-empty-ico">' + I.bag + '</span><p class="co-empty-t">Seu carrinho está vazio</p>' +
        '<p class="co-muted">Escolha um burger no cardápio e ele aparece aqui.</p>' +
        '<button type="button" class="co-btn co-btn--ghost" data-act="close">Ver cardápio</button></div>';
      drawerEl.innerHTML = html;
      return;
    }
    html += '<ul class="co-items" aria-label="Itens do carrinho">' + cart.map(it => {
      const out = stockOf(it.productId) < productQty(it.productId);
      return '<li class="co-item' + (out ? ' co-item--out' : '') + '">' + thumb(it) +
        '<div class="co-item-main"><div class="co-item-top"><span class="co-item-name">' + esc(it.name) + '</span>' +
        '<span class="co-item-price">' + brl(it.unitPrice * it.qty) + '</span></div>' +
        '<div class="co-item-meta">' + itemMeta(it) + (out ? '<span class="co-meta-out">' + (stockOf(it.productId) ? 'Só restam ' + stockOf(it.productId) + ' unidade(s)' : 'Esgotado — remova para continuar') + '</span>' : '') + '</div>' +
        '<div class="co-item-actions">' +
        '<div class="co-stepper" role="group" aria-label="Quantidade de ' + esc(it.name) + '">' +
        '<button type="button" class="co-step" data-act="dec" data-key="' + esc(it.key) + '" aria-label="' + (it.qty === 1 ? 'Remover ' : 'Diminuir ') + esc(it.name) + '">' + (it.qty === 1 ? I.trash : I.minus) + '</button>' +
        '<output class="co-qty" aria-live="polite">' + it.qty + '</output>' +
        '<button type="button" class="co-step" data-act="inc" data-key="' + esc(it.key) + '" aria-label="Aumentar ' + esc(it.name) + '">' + I.plus + '</button></div>' +
        '<span class="co-unit">' + brl(it.unitPrice) + ' cada</span>' +
        '<button type="button" class="co-link co-link--danger" data-act="rm" data-key="' + esc(it.key) + '">Remover</button>' +
        '</div></div></li>';
    }).join('') + '</ul>';
    html += '<footer class="co-drawer-foot" aria-live="polite">' +
      (min > 0 ? '<div class="co-min' + (lacking > 0 ? '' : ' co-min--ok') + '"><div class="co-min-bar"><span style="width:' + Math.min(100, t.subtotal / min * 100).toFixed(1) + '%"></span></div>' +
        '<small>' + (lacking > 0 ? 'Faltam <b>' + brl(lacking) + '</b> para o pedido mínimo de ' + brl(min) : 'Pedido mínimo atingido ✓') + '</small></div>' : '') +
      '<dl class="co-sums"><div><dt>Subtotal</dt><dd>' + brl(t.subtotal) + '</dd></div>' +
      '<div><dt>Taxa de entrega</dt><dd>' + (fee ? brl(fee) : 'Grátis') + '</dd></div>' +
      '<div class="co-sums-total"><dt>Total</dt><dd>' + brl(t.subtotal + fee) + '</dd></div></dl>' +
      '<p class="co-fine">Retirando no balcão você não paga entrega.</p>' +
      '<button type="button" class="co-btn co-btn--primary co-btn--block" data-act="checkout"' + (lacking > 0 || unavailable.length ? ' disabled' : '') + '>' +
      '<span>Finalizar pedido</span><span class="co-btn-amt">' + brl(t.subtotal + fee) + '</span></button>' +
      '<button type="button" class="co-link co-link--center" data-act="close">Continuar comprando</button></footer>';
    drawerEl.innerHTML = html;
  }

  drawerEl.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const k = b.dataset.key, it = k && cart.find(c => c.key === k);
    switch (b.dataset.act) {
      case 'close': closeLayer('drawer'); break;
      case 'inc': if (it) setQty(k, it.qty + 1); refocus(k, 'inc'); break;
      case 'dec': if (it) setQty(k, it.qty - 1); refocus(k, 'dec'); break;
      case 'rm': setQty(k, 0); break;
      case 'checkout': openCheckout(); break;
    }
  });
  function refocus(key, act) {
    const b = drawerEl.querySelector('[data-act="' + act + '"][data-key="' + CSS.escape(key) + '"]') || drawerEl.querySelector('[data-act="' + (act === 'dec' ? 'inc' : 'dec') + '"][data-key="' + CSS.escape(key) + '"]');
    if (b) b.focus({ preventScroll: true }); else drawerEl.focus({ preventScroll: true });
  }
  L('drawer').querySelector('.co-backdrop').addEventListener('click', () => closeLayer('drawer'));

  function openCart() { renderDrawer(); openLayer('drawer'); }

  /* ============================== CHECKOUT ============================== */
  const saved = () => ls.get(CUST_KEY, null);
  const st = { mode: 'entrega', geo: null, geoStatus: 'idle', geoMsg: '', manualLoc: false, pay: 'pix', card: 'credito', noChange: false, touched: {}, busy: false, cepAuto: {} };

  const VALID_DDD = [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99];

  function cpfValid(v) {
    const d = digits(v);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (let t = 9; t < 11; t++) {
      let s = 0;
      for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
      const dv = ((s * 10) % 11) % 10;
      if (dv !== Number(d[t])) return false;
    }
    return true;
  }
  const maskCpf = v => { const d = digits(v).slice(0, 11); return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2'); };
  const maskPhone = v => {
    const d = digits(v).replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  };
  const maskCep = v => { const d = digits(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; };
  const parseMoney = v => { const s = String(v || '').replace(/[^\d,.]/g, ''); if (!s) return 0; const n = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s; return money(parseFloat(n)); };

  function phoneError(v) {
    const d = digits(v);
    if (!d) return 'Informe seu WhatsApp para avisarmos sobre o pedido.';
    if (d.length < 10) return 'Número incompleto. Use DDD + número, ex.: (11) 98765-4321.';
    if (d.length > 11) return 'Número longo demais. Use DDD + número.';
    if (VALID_DDD.indexOf(Number(d.slice(0, 2))) < 0) return 'DDD ' + d.slice(0, 2) + ' não existe. Confira o código da sua cidade.';
    if (d.length === 11 && d[2] !== '9') return 'Celular deve começar com 9 depois do DDD.';
    if (d.length === 10 && !/[2-5]/.test(d[2])) return 'Para celular, inclua o 9 na frente do número.';
    return '';
  }

  // valida cada campo; '' = ok
  const V = {
    name: v => { const p = v.trim().split(/\s+/).filter(Boolean); if (!v.trim()) return 'Como podemos te chamar? Informe seu nome completo.'; if (p.length < 2 || v.trim().length < 5) return 'Digite nome e sobrenome.'; return ''; },
    phone: phoneError,
    cpf: v => { if (!digits(v)) return 'Informe seu CPF — ele vai na nota do pedido.'; if (digits(v).length < 11) return 'CPF incompleto: são 11 números.'; return cpfValid(v) ? '' : 'CPF inválido. Confira os números digitados.'; },
    cep: v => { const d = digits(v); return d && d.length !== 8 ? 'CEP tem 8 números.' : ''; },
    street: v => v.trim().length < 3 ? 'Informe a rua ou avenida.' : '',
    number: v => !v.trim() ? 'Informe o número (ou S/N).' : '',
    district: v => v.trim().length < 2 ? 'Informe o bairro.' : '',
    city: () => '',
    loc: () => (st.geo || st.manualLoc) ? '' : st.geoStatus === 'error'
      ? 'Sem localização: tente de novo ou marque “Não consigo compartilhar a localização”.'
      : 'Toque em “Usar minha localização” para o entregador te achar rápido.',
    change: v => {
      if (st.pay !== 'dinheiro' || st.noChange) return '';
      const n = parseMoney(v), total = orderTotals().total;
      if (!n) return 'Informe para quanto precisa de troco ou marque “Não preciso de troco”.';
      if (n < total) return 'O valor precisa ser maior que o total (' + brl(total) + ').';
      return '';
    }
  };
  const ENTREGA_ONLY = ['cep', 'street', 'number', 'district', 'city', 'loc'];
  const ORDER = ['name', 'phone', 'cpf', 'loc', 'cep', 'street', 'number', 'district', 'city', 'change'];
  const LABEL = { name: 'nome', phone: 'WhatsApp', cpf: 'CPF', loc: 'localização', cep: 'CEP', street: 'rua', number: 'número', district: 'bairro', city: 'cidade', change: 'troco' };

  function orderTotals() {
    const t = totals();
    const fee = deliveryFee(st.mode);
    return { count: t.count, subtotal: t.subtotal, deliveryFee: fee, discount: 0, total: money(t.subtotal + fee) };
  }

  function field(o) {
    const id = 'co-f-' + o.name;
    return '<div class="co-field' + (o.cls ? ' ' + o.cls : '') + '" data-field="' + o.name + '">' +
      '<label class="co-label" for="' + id + '">' + o.label + (o.req ? ' <span class="co-req" aria-hidden="true">*</span>' : ' <span class="co-opt">(opcional)</span>') + '</label>' +
      '<div class="co-input-wrap">' +
      '<input class="co-input" id="' + id + '" name="' + o.name + '" type="' + (o.type || 'text') + '"' +
      (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') + (o.ac ? ' autocomplete="' + o.ac + '"' : '') +
      (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') +
      (o.req ? ' required aria-required="true"' : '') + (o.enter ? ' enterkeyhint="' + o.enter + '"' : '') +
      (o.cap ? ' autocapitalize="' + o.cap + '"' : '') + ' spellcheck="false"' +
      ' aria-describedby="co-e-' + o.name + '" value="' + esc(o.value || '') + '">' +
      (o.after || '') + '</div>' +
      '<p class="co-err" id="co-e-' + o.name + '" aria-live="polite"></p></div>';
  }

  function renderCheckout() {
    view = 'form';
    const sv = saved();
    const c = sv || {};
    const a = c.address || {};
    st.mode = c.mode === 'retirada' ? 'retirada' : 'entrega';
    st.pay = ['pix', 'cartao', 'dinheiro'].indexOf(c.pay) >= 0 ? c.pay : 'pix';
    st.card = c.card === 'debito' ? 'debito' : 'credito';
    st.noChange = false; st.manualLoc = false; st.touched = {}; st.busy = false; st.cepAuto = {};
    if (!st.geo) { st.geoStatus = 'idle'; st.geoMsg = ''; }
    const first = (c.name || '').trim().split(/\s+/)[0];
    const s = shop();

    screenEl.innerHTML =
      '<header class="co-top">' +
      '<button type="button" class="co-icon-btn" data-act="back" aria-label="Voltar ao carrinho">' + I.back + '</button>' +
      '<div class="co-top-t"><h2 id="co-screen-title" class="co-h2">Finalizar pedido</h2>' +
      '<ol class="co-progress" aria-label="Progresso"><li data-step="dados"><span></span>Dados</li><li data-step="entrega"><span></span><em>Entrega</em></li><li data-step="pagamento"><span></span>Pagamento</li></ol></div>' +
      '<span class="co-secure" title="Seus dados ficam só neste aparelho e com a loja">' + I.lock + '<span>Seguro</span></span>' +
      '</header>' +
      '<div class="co-body"><div class="co-grid">' +
      '<form class="co-form" id="co-form" novalidate autocomplete="on">' +
      (sv && first ? '<div class="co-welcome" role="status"><span class="co-welcome-ico">👋</span><div><b>Bem-vindo de volta, ' + esc(first) + '!</b><br><span class="co-muted">Seus dados já estão preenchidos.</span></div>' +
        '<button type="button" class="co-link" data-act="forget">Não é você?</button></div>' : '') +

      // 1. modo
      '<section class="co-sec" aria-labelledby="co-s-mode"><h3 class="co-h3" id="co-s-mode">Como você quer receber?</h3>' +
      '<div class="co-seg" role="radiogroup" aria-labelledby="co-s-mode">' +
      '<label class="co-seg-opt"><input type="radio" name="mode" value="entrega"' + (st.mode === 'entrega' ? ' checked' : '') + '><span>' + I.moto + '<b>Entrega</b><small>' + (deliveryFee('entrega') ? '+ ' + brl(deliveryFee('entrega')) : 'Grátis') + '</small><small>40–60 min</small></span></label>' +
      '<label class="co-seg-opt"><input type="radio" name="mode" value="retirada"' + (st.mode === 'retirada' ? ' checked' : '') + '><span>' + I.store + '<b>Retirada</b><small>Sem taxa</small><small>20–30 min</small></span></label>' +
      '</div></section>' +

      // 2. dados
      '<section class="co-sec" aria-labelledby="co-s-dados"><h3 class="co-h3" id="co-s-dados"><span class="co-num">1</span>Seus dados</h3>' +
      field({ name: 'name', label: 'Nome completo', req: 1, ac: 'name', ph: 'Ex.: João da Silva', cap: 'words', enter: 'next', max: 80, value: c.name }) +
      '<div class="co-row">' +
      field({ name: 'phone', label: 'WhatsApp', req: 1, type: 'tel', inputmode: 'tel', ac: 'tel-national', ph: '(11) 98765-4321', enter: 'next', max: 16, value: c.phone ? maskPhone(c.phone) : '' }) +
      field({ name: 'cpf', label: 'CPF <span class="co-opt">(vai na nota)</span>', req: 1, inputmode: 'numeric', ac: 'off', ph: '000.000.000-00', enter: 'next', max: 14, value: c.cpf ? maskCpf(c.cpf) : '' }) +
      '</div></section>' +

      // 3. entrega
      '<section class="co-sec co-sec--entrega" aria-labelledby="co-s-ent"' + (st.mode === 'retirada' ? ' hidden' : '') + '><h3 class="co-h3" id="co-s-ent"><span class="co-num">2</span>Onde entregar?</h3>' +
      '<div class="co-field co-loc" data-field="loc"><div class="co-loc-card" id="co-loc-card"></div><p class="co-err" id="co-e-loc" aria-live="polite"></p></div>' +
      '<div class="co-addr">' +
      field({ name: 'cep', label: 'CEP', inputmode: 'numeric', ac: 'postal-code', ph: '00000-000', max: 9, enter: 'next', value: a.cep ? maskCep(a.cep) : '', after: '<span class="co-spin" aria-hidden="true"></span>' }) +
      field({ name: 'street', label: 'Rua / Avenida', req: 1, ac: 'address-line1', ph: 'Ex.: Rua das Flores', enter: 'next', max: 120, value: a.street, cls: 'co-span2' }) +
      '<div class="co-row co-row--num">' +
      field({ name: 'number', label: 'Número', req: 1, inputmode: 'text', ac: 'address-line2', ph: '123', max: 10, enter: 'next', value: a.number }) +
      field({ name: 'complement', label: 'Complemento', ac: 'address-line3', ph: 'Apto, bloco, casa…', max: 60, enter: 'next', value: a.complement }) +
      '</div><div class="co-row">' +
      field({ name: 'district', label: 'Bairro', req: 1, ac: 'address-level3', ph: 'Bairro', max: 60, enter: 'next', value: a.district }) +
      field({ name: 'city', label: 'Cidade', ac: 'address-level2', ph: 'Cidade - UF', max: 60, enter: 'next', value: a.city }) +
      '</div>' +
      field({ name: 'reference', label: 'Ponto de referência', ac: 'off', ph: 'Ex.: em frente à padaria, portão azul', max: 120, enter: 'done', value: a.reference }) +
      '</div></section>' +
      '<section class="co-sec co-sec--retirada" aria-labelledby="co-s-ret"' + (st.mode === 'entrega' ? ' hidden' : '') + '><h3 class="co-h3" id="co-s-ret"><span class="co-num">2</span>Retirada no balcão</h3>' +
      '<div class="co-pickup">' + I.store + '<div><b>' + esc(s.name || 'Hamburgueria Gulos') + '</b><br><span class="co-muted">' + esc(s.address || 'Retire no balcão da loja.') + '</span>' +
      (s.hours ? '<br><span class="co-muted">' + esc(s.hours) + '</span>' : '') + '<br><span class="co-ok">Pronto em ~20–30 min · sem taxa de entrega</span></div></div></section>' +

      // 4. pagamento
      '<section class="co-sec" aria-labelledby="co-s-pay"><h3 class="co-h3" id="co-s-pay"><span class="co-num">3</span>Pagamento</h3>' +
      '<div class="co-pay" role="radiogroup" aria-labelledby="co-s-pay">' +
      '<label class="co-pay-opt co-pay-opt--pix"><input type="radio" name="pay" value="pix"' + (st.pay === 'pix' ? ' checked' : '') + '>' +
      '<span class="co-pay-box"><span class="co-pay-ico">' + I.pix + '</span><span class="co-pay-txt"><b>PIX <em class="co-badge">Mais rápido</em></b><small>Pague agora pelo app do banco. QR Code e copia e cola na próxima tela.</small></span><span class="co-radio" aria-hidden="true"></span></span></label>' +
      '<label class="co-pay-opt"><input type="radio" name="pay" value="cartao"' + (st.pay === 'cartao' ? ' checked' : '') + '>' +
      '<span class="co-pay-box"><span class="co-pay-ico">' + I.card + '</span><span class="co-pay-txt"><b>Cartão na entrega</b><small>Crédito ou débito na maquininha.</small></span><span class="co-radio" aria-hidden="true"></span></span></label>' +
      '<div class="co-pay-extra co-pay-extra--cartao"' + (st.pay === 'cartao' ? '' : ' hidden') + '><div class="co-chips" role="radiogroup" aria-label="Tipo de cartão">' +
      '<label class="co-chip"><input type="radio" name="card" value="credito"' + (st.card === 'credito' ? ' checked' : '') + '><span>Crédito</span></label>' +
      '<label class="co-chip"><input type="radio" name="card" value="debito"' + (st.card === 'debito' ? ' checked' : '') + '><span>Débito</span></label></div></div>' +
      '<label class="co-pay-opt"><input type="radio" name="pay" value="dinheiro"' + (st.pay === 'dinheiro' ? ' checked' : '') + '>' +
      '<span class="co-pay-box"><span class="co-pay-ico">' + I.cash + '</span><span class="co-pay-txt"><b>Dinheiro</b><small>Pague na entrega ou no balcão.</small></span><span class="co-radio" aria-hidden="true"></span></span></label>' +
      '<div class="co-pay-extra co-pay-extra--dinheiro"' + (st.pay === 'dinheiro' ? '' : ' hidden') + '>' +
      field({ name: 'change', label: 'Troco para quanto?', inputmode: 'decimal', ac: 'off', ph: 'Ex.: 100,00', max: 10, req: 1, after: '<span class="co-prefix" aria-hidden="true">R$</span>' }) +
      '<div class="co-chips co-chips--change" id="co-change-chips"></div>' +
      '<label class="co-check"><input type="checkbox" name="noChange"><span>Não preciso de troco</span></label></div>' +
      '</div></section>' +
      '<p class="co-legal co-muted">Ao confirmar você concorda em receber atualizações do pedido pelo WhatsApp. Seus dados ficam salvos só neste aparelho para agilizar o próximo pedido.</p>' +
      '</form>' +

      // resumo
      '<aside class="co-summary" aria-labelledby="co-sum-title">' +
      '<button type="button" class="co-sum-toggle" data-act="sum" aria-expanded="false" aria-controls="co-sum-body">' +
      '<span><b id="co-sum-title">Resumo do pedido</b><small class="co-sum-count"></small></span><span class="co-sum-amt" aria-live="polite"></span>' + I.chev + '</button>' +
      '<div class="co-sum-body" id="co-sum-body"></div>' +
      '<div class="co-sum-cta"><button type="submit" form="co-form" class="co-btn co-btn--primary co-btn--block co-confirm"></button><p class="co-err-sum" aria-live="assertive"></p></div>' +
      '</aside>' +
      '</div></div>' +
      '<div class="co-bar"><p class="co-err-sum" aria-live="assertive"></p><button type="submit" form="co-form" class="co-btn co-btn--primary co-btn--block co-confirm"></button></div>';

    renderSummary();
    renderLoc();
    renderChangeChips();
    if (sv) ORDER.forEach(n => { const el = inp(n); if (el && el.value) { st.touched[n] = true; validate(n); } });
    updateProgress();
    autoLocateIfGranted();
  }

  const form = () => screenEl.querySelector('#co-form');
  const inp = n => screenEl.querySelector('[name="' + n + '"]');
  const val = n => { const el = inp(n); return el ? el.value : ''; };

  function renderSummary() {
    const box = screenEl.querySelector('#co-sum-body');
    if (!box) return;
    const t = orderTotals();
    box.innerHTML = '<ul class="co-sum-items">' + cart.map(it =>
      '<li><span class="co-sum-q">' + it.qty + '×</span><span class="co-sum-n">' + esc(it.name) +
      '<span class="co-item-meta">' + itemMeta(it) + '</span></span><span class="co-sum-p">' + brl(it.unitPrice * it.qty) + '</span></li>').join('') + '</ul>' +
      '<button type="button" class="co-link" data-act="edit-cart">Editar itens</button>' +
      '<dl class="co-sums"><div><dt>Subtotal</dt><dd>' + brl(t.subtotal) + '</dd></div>' +
      '<div><dt>Entrega</dt><dd>' + (st.mode === 'retirada' ? 'Retirada · grátis' : (t.deliveryFee ? brl(t.deliveryFee) : 'Grátis')) + '</dd></div>' +
      '<div class="co-sums-total"><dt>Total</dt><dd aria-live="polite">' + brl(t.total) + '</dd></div></dl>';
    screenEl.querySelector('.co-sum-count').textContent = ' · ' + t.count + (t.count === 1 ? ' item' : ' itens');
    screenEl.querySelector('.co-sum-amt').textContent = brl(t.total);
    screenEl.querySelectorAll('.co-confirm').forEach(b => {
      b.disabled = st.busy;
      b.innerHTML = st.busy ? '<span class="co-busy" aria-hidden="true"></span><span>Enviando pedido…</span>'
        : '<span>Confirmar pedido</span><span class="co-btn-amt">' + brl(t.total) + '</span>';
    });
    renderChangeChips();
  }

  function renderChangeChips() {
    const box = screenEl.querySelector('#co-change-chips');
    if (!box) return;
    const total = orderTotals().total;
    const opts = [];
    [20, 50, 100, 200].forEach(v => { if (v > total && opts.length < 3) opts.push(v); });
    box.innerHTML = opts.map(v => '<button type="button" class="co-chip co-chip--btn" data-act="change" data-v="' + v + '">' + brl(v) + '</button>').join('');
  }

  /* ---------------------------- validação ---------------------------- */
  function isActive(n) {
    if (ENTREGA_ONLY.indexOf(n) >= 0) return st.mode === 'entrega';
    if (n === 'change') return st.pay === 'dinheiro' && !st.noChange;
    return true;
  }
  function errorOf(n) { return isActive(n) && V[n] ? V[n](val(n)) : ''; }
  function validate(n, force) {
    const msg = errorOf(n);
    const box = screenEl.querySelector('[data-field="' + n + '"]');
    if (!box) return msg;
    const show = (st.touched[n] || force) && msg;
    box.classList.toggle('co-field--err', !!show);
    box.classList.toggle('co-field--ok', !msg && !!st.touched[n] && n !== 'loc' && !!val(n));
    const el = inp(n);
    if (el) el.setAttribute('aria-invalid', show ? 'true' : 'false');
    const e = screenEl.querySelector('#co-e-' + n);
    if (e && !e.dataset.hint) e.textContent = show ? msg : '';
    return msg;
  }
  function setHint(n, text, kind) {
    const e = screenEl.querySelector('#co-e-' + n);
    if (!e) return;
    if (text) { e.dataset.hint = '1'; e.textContent = text; e.className = 'co-err co-hint co-hint--' + (kind || 'info'); }
    else { delete e.dataset.hint; e.className = 'co-err'; validate(n); }
  }
  function updateProgress() {
    const ok = list => list.every(n => !errorOf(n));
    const steps = {
      dados: ok(['name', 'phone', 'cpf']),
      entrega: st.mode === 'retirada' || ok(['loc', 'cep', 'street', 'number', 'district']),
      pagamento: ok(['change'])
    };
    Object.keys(steps).forEach(k => {
      const li = screenEl.querySelector('[data-step="' + k + '"]');
      if (li) li.classList.toggle('co-step-ok', steps[k]);
    });
    const em = screenEl.querySelector('[data-step="entrega"] em');
    if (em) em.textContent = st.mode === 'retirada' ? 'Retirada' : 'Entrega';
  }
  const firstInvalid = () => ORDER.find(n => errorOf(n));

  /* --------------------------- localização --------------------------- */
  function renderLoc() {
    const box = screenEl.querySelector('#co-loc-card');
    if (!box) return;
    const g = st.geo;
    let html = '';
    if (g) {
      const d = 0.0035;
      const bbox = [g.lng - d, g.lat - d * 0.75, g.lng + d, g.lat + d * 0.75].map(n => n.toFixed(6)).join(',');
      const src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + '&layer=mapnik&marker=' + g.lat.toFixed(6) + ',' + g.lng.toFixed(6);
      html = '<div class="co-map"><div class="co-map-ph" aria-hidden="true">' + I.pin + '</div>' +
        '<iframe title="Mapa com sua localização" src="' + src + '" loading="lazy" referrerpolicy="no-referrer"></iframe></div>' +
        '<div class="co-loc-row"><span class="co-loc-ok">' + I.check + '</span><div class="co-loc-txt"><b>Localização capturada</b>' +
        '<small>Precisão de ±' + Math.round(g.accuracy) + ' m · ' + g.lat.toFixed(5) + ', ' + g.lng.toFixed(5) + '</small></div>' +
        '<button type="button" class="co-btn co-btn--ghost co-btn--sm" data-act="locate">Atualizar</button></div>';
    } else {
      const loading = st.geoStatus === 'loading';
      html = '<button type="button" class="co-loc-btn' + (loading ? ' co-loc-btn--loading' : '') + '" data-act="locate"' + (loading ? ' aria-busy="true"' : '') + '>' +
        '<span class="co-loc-btn-ico">' + (loading ? '<span class="co-busy"></span>' : I.target) + '</span>' +
        '<span class="co-loc-btn-txt"><b>' + (loading ? 'Obtendo sua localização…' : 'Usar minha localização') + '</b>' +
        '<small>' + (loading ? 'Pode levar alguns segundos. Aceite o pedido do navegador.' : 'Recomendado · o entregador chega direto até você') + '</small></span></button>' +
        (st.geoStatus === 'error' ? '<div class="co-loc-alert" role="alert">' + esc(st.geoMsg) + '</div>' : '') +
        '<label class="co-check co-check--manual' + (st.geoStatus === 'error' ? ' co-check--hl' : '') + '"><input type="checkbox" name="manualLoc"' + (st.manualLoc ? ' checked' : '') + '>' +
        '<span>Não consigo compartilhar a localização — confirmo o endereço digitado abaixo</span></label>';
    }
    box.innerHTML = html;
  }

  function locate() {
    if (st.geoStatus === 'loading') return;
    if (!('geolocation' in navigator)) { geoFail('Seu navegador não oferece localização. Confirme o endereço abaixo.'); return; }
    if (window.isSecureContext === false) { geoFail('A localização só funciona em conexão segura (https). Confirme o endereço abaixo.'); return; }
    st.geoStatus = 'loading';
    renderLoc();
    navigator.geolocation.getCurrentPosition(pos => {
      st.geo = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy || 0) };
      st.geoStatus = 'ok'; st.manualLoc = false; st.touched.loc = true;
      renderLoc(); validate('loc'); updateProgress();
      toast('Localização capturada ✓');
      reverseGeocode(st.geo);
    }, err => {
      const msg = err && err.code === 1
        ? 'Você não permitiu a localização. Para ativar, toque no cadeado ao lado do endereço do site e permita “Localização” — ou marque a opção abaixo e confira o endereço.'
        : err && err.code === 3
          ? 'Demorou demais para achar sua localização. Tente de novo em um lugar aberto ou confirme o endereço abaixo.'
          : 'Não conseguimos detectar sua localização (GPS desligado?). Ative a localização do aparelho e tente de novo, ou confirme o endereço abaixo.';
      geoFail(msg);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }
  function geoFail(msg) {
    st.geoStatus = 'error'; st.geoMsg = msg; st.geo = null;
    renderLoc(); validate('loc'); updateProgress();
  }
  function autoLocateIfGranted() {
    if (st.mode !== 'entrega' || st.geo || !navigator.permissions || !navigator.permissions.query) return;
    navigator.permissions.query({ name: 'geolocation' }).then(p => { if (p.state === 'granted') locate(); }).catch(() => {});
  }

  function fetchJSON(url, ms) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctrl && ctrl.abort(), ms || 6000);
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: 'application/json' } })
      .then(r => { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }, e => { clearTimeout(t); throw e; });
  }
  function fillIfEmpty(n, v, force) {
    const el = inp(n);
    if (!el || !v) return false;
    if (el.value.trim() && !force && !st.cepAuto[n]) return false;
    el.value = n === 'cep' ? maskCep(v) : v;
    st.cepAuto[n] = true; st.touched[n] = true;
    validate(n);
    el.classList.add('co-flash'); setTimeout(() => el.classList.remove('co-flash'), 900);
    return true;
  }
  function reverseGeocode(g) {
    fetchJSON('https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=pt-BR&lat=' + g.lat + '&lon=' + g.lng, 7000).then(r => {
      const a = (r && r.address) || {};
      let n = 0;
      n += fillIfEmpty('street', a.road || a.pedestrian || a.residential) ? 1 : 0;
      n += fillIfEmpty('number', a.house_number) ? 1 : 0;
      n += fillIfEmpty('district', a.suburb || a.neighbourhood || a.quarter || a.city_district) ? 1 : 0;
      const city = a.city || a.town || a.village || a.municipality;
      n += fillIfEmpty('city', city ? city + (a['ISO3166-2-lvl4'] ? ' - ' + a['ISO3166-2-lvl4'].split('-')[1] : '') : '') ? 1 : 0;
      n += fillIfEmpty('cep', digits(a.postcode).length === 8 ? digits(a.postcode) : '') ? 1 : 0;
      if (n) { toast('Endereço sugerido pela localização — confira o número.'); updateProgress(); }
    }).catch(() => { /* bloqueado/offline: segue só com lat/lng */ });
  }

  let cepSeq = 0;
  function lookupCep() {
    const d = digits(val('cep'));
    if (d.length !== 8) return;
    const seq = ++cepSeq;
    const wrap = screenEl.querySelector('[data-field="cep"]');
    wrap.classList.add('co-field--loading');
    setHint('cep', 'Buscando endereço…', 'info');
    fetchJSON('https://viacep.com.br/ws/' + d + '/json/', 6000).then(r => {
      if (seq !== cepSeq) return;
      wrap.classList.remove('co-field--loading');
      if (!r || r.erro) { setHint('cep', 'CEP não encontrado. Confira ou preencha o endereço abaixo.', 'warn'); return; }
      setHint('cep', '');
      fillIfEmpty('street', r.logradouro, true);
      fillIfEmpty('district', r.bairro, true);
      fillIfEmpty('city', r.localidade ? r.localidade + (r.uf ? ' - ' + r.uf : '') : '', true);
      updateProgress();
      const next = !val('street') ? inp('street') : inp('number');
      if (next && !next.value) next.focus();
    }).catch(() => {
      if (seq !== cepSeq) return;
      wrap.classList.remove('co-field--loading');
      setHint('cep', 'Não deu para buscar o CEP agora. Preencha o endereço abaixo.', 'warn');
    });
  }

  /* --------------------------- eventos do form --------------------------- */
  const MASK = { cpf: maskCpf, phone: maskPhone, cep: maskCep };
  function applyMask(el, fn) {
    const pos = el.selectionStart == null ? el.value.length : el.selectionStart;
    const before = digits(el.value.slice(0, pos)).length;
    const out = fn(el.value);
    if (out === el.value) return;
    el.value = out;
    let i = 0, seen = 0;
    while (i < out.length && seen < before) { if (/\d/.test(out[i])) seen++; i++; }
    try { if (document.activeElement === el) el.setSelectionRange(i, i); } catch (e) {}
  }

  screenEl.addEventListener('input', e => {
    const el = e.target, n = el.name;
    if (MASK[n]) applyMask(el, MASK[n]);
    if (n === 'cep') { st.cepAuto = {}; if (screenEl.querySelector('#co-e-cep').dataset.hint) setHint('cep', ''); if (digits(el.value).length === 8) lookupCep(); }
    if (n in st.cepAuto) delete st.cepAuto[n];
    if (n && V[n]) {
      if (st.touched[n]) validate(n);
      // valida assim que o campo fica completo, sem esperar o blur
      if ((n === 'cpf' && digits(el.value).length === 11) || (n === 'phone' && digits(el.value).length === 11)) { st.touched[n] = true; validate(n); }
    }
    updateProgress();
  });
  screenEl.addEventListener('focusout', e => {
    const n = e.target.name;
    if (n && V[n] && e.target.value !== '') { st.touched[n] = true; validate(n); }
    else if (n && V[n] && st.touched[n]) validate(n);
  });
  screenEl.addEventListener('change', e => {
    const el = e.target;
    if (el.name === 'mode') {
      st.mode = el.value;
      screenEl.querySelector('.co-sec--entrega').hidden = st.mode !== 'entrega';
      screenEl.querySelector('.co-sec--retirada').hidden = st.mode !== 'retirada';
      renderSummary(); updateProgress(); clearSumErr();
      if (st.mode === 'entrega') autoLocateIfGranted();
    } else if (el.name === 'pay') {
      st.pay = el.value;
      screenEl.querySelector('.co-pay-extra--cartao').hidden = st.pay !== 'cartao';
      screenEl.querySelector('.co-pay-extra--dinheiro').hidden = st.pay !== 'dinheiro';
      validate('change'); updateProgress(); clearSumErr();
    } else if (el.name === 'card') {
      st.card = el.value;
    } else if (el.name === 'noChange') {
      st.noChange = el.checked;
      const ch = inp('change');
      ch.disabled = el.checked;
      screenEl.querySelector('[data-field="change"]').classList.toggle('co-field--disabled', el.checked);
      validate('change'); updateProgress();
    } else if (el.name === 'manualLoc') {
      st.manualLoc = el.checked; st.touched.loc = true;
      validate('loc'); updateProgress();
      if (el.checked && !val('street')) inp(val('cep') ? 'street' : 'cep').focus();
    }
  });
  screenEl.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'back': backToCart(); break;
      case 'edit-cart': backToCart(); break;
      case 'locate': locate(); break;
      case 'sum': {
        const sum = screenEl.querySelector('.co-summary');
        const open = !sum.classList.contains('co-summary--open');
        sum.classList.toggle('co-summary--open', open);
        b.setAttribute('aria-expanded', String(open));
        break;
      }
      case 'change': {
        const ch = inp('change');
        ch.value = String(b.dataset.v) + ',00';
        st.touched.change = true; validate('change'); updateProgress();
        break;
      }
      case 'forget':
        ls.del(CUST_KEY); st.geo = null; renderCheckout(); inp('name').focus(); toast('Dados apagados deste aparelho.');
        break;
      case 'close-done': closeLayer('checkout'); break;
      case 'receipt': openReceipt(b.dataset.id); break;
      case 'copy-pix': copyPix(b); break;
      case 'new': closeLayer('checkout'); break;
    }
  });
  screenEl.addEventListener('submit', e => { e.preventDefault(); submit(); });
  // Enter em um campo leva ao próximo (mais rápido no celular)
  screenEl.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox' || e.target.type === 'radio') return;
    const fields = Array.from(screenEl.querySelectorAll('.co-form input.co-input')).filter(x => x.offsetParent !== null && !x.disabled);
    const i = fields.indexOf(e.target);
    if (i >= 0 && i < fields.length - 1) { e.preventDefault(); fields[i + 1].focus(); }
  });

  function clearSumErr() { screenEl.querySelectorAll('.co-err-sum').forEach(p => { p.textContent = ''; }); }
  function sumErr(msg) { screenEl.querySelectorAll('.co-err-sum').forEach(p => { p.textContent = msg; }); }

  function backToCart() { closeLayer('checkout'); openCart(); }

  function openCheckout() {
    if (!cart.length) { toast('Seu carrinho está vazio.'); return; }
    renderCheckout();
    closeLayer('drawer');
    openLayer('checkout');
    screenEl.querySelector('.co-body').scrollTop = 0;
  }

  /* ------------------------------ envio ------------------------------ */
  async function submit() {
    if (st.busy) return;
    ORDER.forEach(n => { st.touched[n] = true; validate(n, true); });
    updateProgress();
    const bad = ORDER.filter(n => errorOf(n));
    if (bad.length) {
      sumErr('Falta ' + (bad.length === 1 ? '' : 'completar: ') + bad.map(n => LABEL[n]).join(', ') + '.');
      const n = bad[0];
      const target = n === 'loc' ? screenEl.querySelector('#co-loc-card [data-act="locate"]') || screenEl.querySelector('[data-field="loc"]') : inp(n);
      const box = screenEl.querySelector('[data-field="' + n + '"]');
      if (box) box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      if (target) setTimeout(() => target.focus({ preventScroll: true }), 250);
      return;
    }
    const t = orderTotals();
    if (!cart.length) { sumErr('Seu carrinho está vazio.'); return; }
    if (minOrder() > 0 && t.subtotal < minOrder()) { sumErr('Pedido mínimo de ' + brl(minOrder()) + '.'); return; }
    const out = cart.find(it => stockOf(it.productId) < productQty(it.productId));
    if (out) { sumErr(out.name + (stockOf(out.productId) ? ' tem só ' + stockOf(out.productId) + ' unidade(s).' : ' acabou de esgotar.') + ' Ajuste o carrinho.'); return; }
    clearSumErr();

    st.busy = true; renderSummary();
    const ent = st.mode === 'entrega';
    const payMethod = st.pay === 'cartao' ? st.card : st.pay;
    const order = {
      mode: st.mode,
      customer: {
        name: val('name').trim().replace(/\s+/g, ' '),
        cpf: maskCpf(val('cpf')),
        phone: maskPhone(val('phone')),
        address: ent ? {
          cep: maskCep(val('cep')), street: val('street').trim(), number: val('number').trim(), complement: val('complement').trim(),
          district: val('district').trim(), city: val('city').trim(), reference: val('reference').trim()
        } : { cep: '', street: '', number: '', complement: '', district: '', city: '', reference: '' },
        geo: ent && st.geo ? { lat: st.geo.lat, lng: st.geo.lng, accuracy: st.geo.accuracy } : null
      },
      items: cart.map(it => ({
        key: it.key, productId: it.productId, name: it.name, image: it.image, qty: it.qty, unitPrice: it.unitPrice,
        options: it.options.map(o => Object.assign({}, o)), removed: it.removed.slice(), note: it.note
      })),
      subtotal: t.subtotal,
      deliveryFee: t.deliveryFee,
      discount: t.discount,
      total: t.total,
      payment: payMethod === 'dinheiro' ? { method: 'dinheiro', changeFor: st.noChange ? null : parseMoney(val('change')) } : { method: payMethod },
      invoice: null
    };

    try {
      window.GulosStore.placeOrder(order);
    } catch (err) {
      console.error(err);
      st.busy = false; renderSummary();
      sumErr('Não foi possível registrar o pedido. Tente de novo.');
      return;
    }
    let invoice = null;
    try { invoice = await window.GulosNFe.emit(order); } catch (err) { console.error(err); }
    window.GulosStore.updateOrder(order.id, { invoice });
    order.invoice = invoice;

    ls.set(CUST_KEY, {
      name: order.customer.name, cpf: order.customer.cpf, phone: order.customer.phone, mode: st.mode,
      address: ent ? order.customer.address : ((saved() || {}).address || null), pay: st.pay, card: st.card
    });
    st.busy = false;
    st.geo = null;
    renderDone(order);           // define view='done' antes de esvaziar o carrinho
    window.GulosBus.emit('order:placed', order);
    clearCart();
  }

  /* ---------------------------- confirmação ---------------------------- */
  function pixPayload(order) {
    const c = cfg(), s = shop();
    const key = (c.pix && c.pix.key) || s.pixKey || 'chave-pix-da-loja@exemplo.com';
    const norm = (v, n) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, n).trim() || 'NA';
    const f = (id, v) => id + String(v.length).padStart(2, '0') + v;
    const mai = f('00', 'br.gov.bcb.pix') + f('01', key);
    const txid = norm(order.id, 25).replace(/ /g, '');
    let p = f('00', '01') + f('01', '12') + f('26', mai) + f('52', '0000') + f('53', '986') + f('54', money(order.total).toFixed(2)) +
      f('58', 'BR') + f('59', norm(s.name || 'Hamburgueria Gulos', 25)) + f('60', norm((c.pix && c.pix.city) || 'SAO PAULO', 15)) + f('62', f('05', txid)) + '6304';
    let crc = 0xFFFF;
    new TextEncoder().encode(p).forEach(b => { crc ^= b << 8; for (let i = 0; i < 8; i++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF; });
    return p + crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function waLink(order) {
    let ph = digits(shop().phone);
    if (!ph) return '';
    if (ph.length <= 11) ph = '55' + ph;
    const c = order.customer, a = c.address;
    const lines = ['*Pedido #' + order.id + '* — ' + (shop().name || 'Hamburgueria Gulos'), ''];
    order.items.forEach(it => {
      const det = [].concat((it.options || []).map(o => '+ ' + o.name), (it.removed || []).map(r => 'sem ' + r), it.note ? ['obs: ' + it.note] : []);
      lines.push(it.qty + 'x ' + it.name + (det.length ? ' (' + det.join(', ') + ')' : '') + ' — ' + brl(it.unitPrice * it.qty));
    });
    lines.push('', 'Subtotal: ' + brl(order.subtotal));
    if (order.mode === 'entrega') lines.push('Entrega: ' + (order.deliveryFee ? brl(order.deliveryFee) : 'grátis'));
    lines.push('*Total: ' + brl(order.total) + '*');
    const p = order.payment;
    lines.push('Pagamento: ' + window.GulosNFe.paymentLabel(p.method) + (p.method === 'dinheiro' ? (p.changeFor ? ' (troco para ' + brl(p.changeFor) + ')' : ' (sem troco)') : ''), '');
    if (order.mode === 'entrega') {
      lines.push('*Entrega:* ' + a.street + ', ' + a.number + (a.complement ? ' - ' + a.complement : '') + ' - ' + a.district + (a.city ? ', ' + a.city : '') + (a.cep ? ' - CEP ' + a.cep : ''));
      if (a.reference) lines.push('Referência: ' + a.reference);
      if (c.geo) lines.push('Localização: https://maps.google.com/?q=' + c.geo.lat.toFixed(6) + ',' + c.geo.lng.toFixed(6));
    } else lines.push('*Retirada no balcão*');
    lines.push('', 'Cliente: ' + c.name + ' · ' + c.phone + ' · CPF ' + c.cpf);
    return 'https://wa.me/' + ph + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  const STATUS_STEPS = {
    entrega: [['recebido', 'Recebido'], ['preparo', 'Em preparo'], ['saiu', 'Saiu para entrega'], ['entregue', 'Entregue']],
    retirada: [['recebido', 'Recebido'], ['preparo', 'Em preparo'], ['pronto', 'Pronto para retirar'], ['entregue', 'Retirado']]
  };
  function statusIndex(status) {
    const s = String(status || '').toLowerCase();
    if (/entreg|retirad|conclu|finaliz/.test(s)) return 3;
    if (/saiu|rota|pronto|caminho/.test(s)) return 2;
    if (/prepar|cozinha|produ|aceit|confirm/.test(s)) return 1;
    return 0;
  }
  function timeline(order) {
    const steps = STATUS_STEPS[order.mode] || STATUS_STEPS.entrega;
    const cancelled = /cancel/.test(String(order.status));
    const idx = statusIndex(order.status);
    if (cancelled) return '<p class="co-loc-alert" role="status">Pedido cancelado pela loja. Fale com a gente pelo WhatsApp.</p>';
    return '<ol class="co-timeline">' + steps.map((s, i) =>
      '<li class="' + (i < idx ? 'co-tl-done' : i === idx ? 'co-tl-now' : '') + '"' + (i === idx ? ' aria-current="step"' : '') + '><span class="co-tl-dot">' + (i < idx ? I.check : '') + '</span>' + s[1] + '</li>').join('') + '</ol>';
  }

  let doneUnsub = null;
  function renderDone(order) {
    view = 'done';
    toastEl.classList.remove('co-toast--on');
    const ent = order.mode === 'entrega';
    const created = new Date(order.createdAt);
    const add = m => new Date(created.getTime() + m * 60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const eta = ent ? add(40) + ' – ' + add(60) : add(20) + ' – ' + add(30);
    const wa = waLink(order);
    const p = order.payment;
    let payBlock = '';
    if (p.method === 'pix') {
      const code = pixPayload(order);
      payBlock = '<section class="co-pixbox" aria-labelledby="co-pix-t"><h3 class="co-h3" id="co-pix-t">' + I.pix + ' Pague com PIX</h3>' +
        '<p class="co-muted">Abra o app do seu banco, escolha <b>Pix → Ler QR Code</b> ou <b>Pix copia e cola</b>.</p>' +
        '<div class="co-pix-grid"><div class="co-pix-qr">' + window.GulosNFe.qrSvg(code, { className: 'co-qr', label: 'QR Code PIX de ' + brl(order.total) }) + '</div>' +
        '<div class="co-pix-side"><div class="co-pix-amt"><small>Valor</small><b>' + brl(order.total) + '</b></div>' +
        '<label class="co-label" for="co-pix-code">PIX copia e cola</label><textarea id="co-pix-code" class="co-pix-code" readonly rows="4">' + esc(code) + '</textarea>' +
        '<button type="button" class="co-btn co-btn--primary co-btn--block" data-act="copy-pix">' + I.copy + '<span>Copiar código PIX</span></button></div></div>' +
        '<p class="co-fine">Código de demonstração. A chave e a cobrança PIX reais (QR dinâmico, confirmação automática) vêm do provedor de pagamento configurado pelo dono da loja.</p></section>';
    } else if (p.method === 'dinheiro') {
      payBlock = '<div class="co-paynote">' + I.cash + '<div><b>Pagamento em dinheiro</b><br><span class="co-muted">' +
        (p.changeFor ? 'Levaremos troco para ' + brl(p.changeFor) + ' (troco de ' + brl(p.changeFor - order.total) + ').' : 'Sem troco: tenha ' + brl(order.total) + ' certinho.') + '</span></div></div>';
    } else {
      payBlock = '<div class="co-paynote">' + I.card + '<div><b>Cartão de ' + (p.method === 'debito' ? 'débito' : 'crédito') + '</b><br><span class="co-muted">' +
        (ent ? 'O entregador leva a maquininha.' : 'Pague no balcão ao retirar.') + '</span></div></div>';
    }
    const inv = order.invoice;
    screenEl.innerHTML =
      '<header class="co-top co-top--done"><span></span><h2 id="co-screen-title" class="co-h2">Pedido confirmado</h2>' +
      '<button type="button" class="co-icon-btn" data-act="close-done" aria-label="Fechar e voltar ao cardápio">' + I.close + '</button></header>' +
      '<div class="co-body"><div class="co-done">' +
      '<div class="co-hero"><div class="co-confetti" aria-hidden="true">' + Array.from({ length: 14 }, (_, i) => '<i style="--i:' + i + '"></i>').join('') + '</div>' +
      '<span class="co-hero-check">' + I.check + '</span>' +
      '<h3 class="co-hero-t">Oba! Pedido recebido 🎉</h3>' +
      '<p class="co-hero-num">Pedido <b>#' + esc(order.id) + '</b></p>' +
      '<p class="co-muted">Valeu, ' + esc(order.customer.name.split(' ')[0]) + '! Já estamos cuidando de tudo.</p></div>' +
      '<div class="co-eta"><div>' + (ent ? I.moto : I.store) + '<span><small>' + (ent ? 'Previsão de entrega' : 'Pronto para retirar') + '</small><b>' + eta + '</b></span></div>' +
      '<div><span><small>Total</small><b>' + brl(order.total) + '</b></span></div></div>' +
      (p.method === 'pix' ? payBlock : '') +
      '<div class="co-status" aria-live="polite"><h3 class="co-h3">Status</h3><div class="co-status-tl">' + timeline(order) + '</div></div>' +
      (p.method !== 'pix' ? payBlock : '') +
      '<div class="co-done-actions">' +
      (wa ? '<a class="co-btn co-btn--wa co-btn--block" href="' + esc(wa) + '" target="_blank" rel="noopener">' + I.wa + '<span>Enviar pedido no WhatsApp</span></a>' : '') +
      (inv ? '<button type="button" class="co-btn co-btn--ghost co-btn--block" data-act="receipt" data-id="' + esc(order.id) + '">' + I.receipt + '<span>Ver nota / cupom</span></button>' : '') +
      '<button type="button" class="co-link co-link--center" data-act="new">Voltar ao cardápio</button></div>' +
      (inv && inv.status === 'pendente' ? '<p class="co-fine">A nota fiscal está sendo processada e pode chegar em alguns minutos.</p>' : '') +
      '</div></div>';
    screenEl.querySelector('.co-body').scrollTop = 0;
    screenEl.focus({ preventScroll: true });
    if (doneUnsub) doneUnsub();
    doneUnsub = window.GulosStore.subscribe(state => {
      if (view !== 'done') { doneUnsub && doneUnsub(); doneUnsub = null; return; }
      const o = (state.orders || []).find(x => x.id === order.id);
      const tl = screenEl.querySelector('.co-status-tl');
      if (o && tl) tl.innerHTML = timeline(o);
    });
  }

  function copyPix(btn) {
    const ta = screenEl.querySelector('#co-pix-code');
    const ok = () => { btn.querySelector('span').textContent = 'Código copiado ✓'; btn.classList.add('co-btn--ok'); toast('Código PIX copiado. Cole no app do banco.'); setTimeout(() => { btn.querySelector('span').textContent = 'Copiar código PIX'; btn.classList.remove('co-btn--ok'); }, 2500); };
    const fallback = () => { ta.focus(); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Selecione o código e copie manualmente.'); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, fallback); else fallback();
  }

  /* ------------------------------- cupom ------------------------------- */
  function openReceipt(orderId) {
    const o = (S().orders || []).find(x => x.id === orderId);
    receiptEl.innerHTML = '<div class="co-receipt-head"><h2 class="co-h2">Nota / cupom</h2>' +
      '<button type="button" class="co-icon-btn" data-act="close" aria-label="Fechar cupom">' + I.close + '</button></div>' +
      '<div class="co-receipt-body">' + window.GulosNFe.renderReceipt(o && o.invoice) + '</div>';
    openLayer('receipt');
  }
  L('receipt').addEventListener('click', e => { if (e.target.closest('[data-act="close"]')) closeLayer('receipt'); });

  /* ------------------------------ ligação ------------------------------ */
  window.GulosBus.on('cart:add', addItem);
  window.GulosBus.on('cart:open', openCart);
  window.GulosStore.subscribe(() => { if (isOpen('drawer')) renderDrawer(); });
  if (window.GulosNFe && window.GulosNFe.loadQRLib) window.GulosNFe.loadQRLib();

  window.GulosCheckout = { openCart, openCheckout, close: closeAll, cart: () => cart.map(it => Object.assign({}, it)), clear: clearCart, cpfValid };
  emitChanged();
})();
