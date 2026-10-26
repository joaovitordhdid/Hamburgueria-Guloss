/* Gulos — rodapé + painel do dono (login, produtos, estoque, financeiro, pedidos, configurações).
   Tudo roda no navegador em cima do GulosStore (localStorage). Classes prefixadas com adm-. */
(function () {
  'use strict';
  if (window.__gulosAdminLoaded) return;
  window.__gulosAdminLoaded = true;

  const root = document.getElementById('app-admin');
  if (!root) return;

  /* ------------------------------------------------------------------ util */
  const SESSION_KEY = 'gulos:adm-session';
  const LOCK_KEY = 'gulos:adm-lock';
  const TAB_KEY = 'gulos:adm-tab';
  const SESSION_MS = 8 * 3600 * 1000;
  const MAX_FAILS = 5;
  const LOCK_MS = 30 * 1000;
  const CHART_SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
  const DAY = 86400000;

  const Store = () => window.GulosStore;
  const st = () => ensureState();
  const brl = v => (Store() && Store().brl) ? Store().brl(v) : 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, d = 0) => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : d; };
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ts = o => new Date(o.createdAt || o.at || 0).getTime() || 0;
  const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const dayKey = t => { const x = new Date(t); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
  const fmtDT = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const fmtD = t => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const pct = v => (isFinite(v) ? (v * 100).toFixed(0) : '0') + '%';
  const ssGet = k => { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat';

  function ensureState() {
    const S = Store();
    if (!S) return null;
    const s = S.get();
    if (!Array.isArray(s.orders)) s.orders = [];
    if (!Array.isArray(s.products)) s.products = [];
    if (!Array.isArray(s.categories)) s.categories = [];
    if (!Array.isArray(s.stockLog)) s.stockLog = [];
    if (!Array.isArray(s.expenses)) s.expenses = [];
    if (!s.store) s.store = {};
    if (!s.config) s.config = {};
    if (!s.config.admin) s.config.admin = { email: 'dono@gulos.com', passHash: null };
    if (!s.config.pix || typeof s.config.pix !== 'object') s.config.pix = { key: '', name: '', city: '' };
    if (!s.config.fiscal) s.config.fiscal = { provider: 'simulado', apiToken: '', cnpj: '', ie: '', ambiente: 'homologacao', serie: 1, proximoNumero: 1 };
    return s;
  }
  function save() {
    Store().save();
    try {
      const size = JSON.stringify(Store().get()).length;
      if (size > 4.5e6) toast('Atenção: os dados estão perto do limite do navegador. Use fotos por URL ou menores.', 'warn');
    } catch (e) {}
  }
  const catName = id => { const c = (st().categories || []).find(x => x.id === id); return c ? c.name : 'Sem categoria'; };

  const ICONS = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    burger: '<path d="M4 11h16a8 8 0 0 0-16 0z"/><path d="M3 15h18"/><path d="M4 19h16v-1H4z"/>',
    box: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
    chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    up: '<path d="M18 15l-6-6-6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    spark: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/>',
    back: '<path d="M15 18l-6-6 6-6"/>'
  };
  const ic = (n, cls = '') => `<svg class="adm-ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

  const field = (label, input, hint = '', cls = '') =>
    `<label class="adm-field ${cls}"><span class="adm-label">${label}</span>${input}${hint ? `<small class="adm-hint">${hint}</small>` : ''}</label>`;
  const thumb = (img, name, cls = '') => {
    const initial = esc((String(name || '?').trim()[0] || '?').toUpperCase());
    return img
      ? `<span class="adm-thumb ${cls}" data-initial="${initial}"><img class="adm-img" src="${esc(img)}" alt="" loading="lazy"></span>`
      : `<span class="adm-thumb adm-thumb-fb ${cls}" data-initial="${initial}"></span>`;
  };
  // Imagem quebrada vira o fallback com a inicial.
  root.addEventListener('error', e => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.classList.contains('adm-img')) {
      const th = t.closest('.adm-thumb, .adm-photo');
      if (th) th.classList.add(th.classList.contains('adm-photo') ? 'adm-photo-empty' : 'adm-thumb-fb');
    }
  }, true);

  /* --------------------------------------------------------------- SHA-256 */
  function sha256Fallback(str) {
    const msg = Array.from(new TextEncoder().encode(str));
    const K = [], H = [];
    const frac = x => ((x - Math.floor(x)) * 4294967296) >>> 0;
    for (let cand = 2, cnt = 0; cnt < 64; cand++) {
      let prime = true;
      for (let f = 2; f * f <= cand; f++) if (cand % f === 0) { prime = false; break; }
      if (prime) { if (cnt < 8) H[cnt] = frac(Math.sqrt(cand)); K[cnt] = frac(Math.cbrt(cand)); cnt++; }
    }
    const bitLen = msg.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    const hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
    [hi, lo].forEach(v => msg.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255));
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    const w = new Array(64);
    for (let i = 0; i < msg.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = ((msg[i + 4 * t] << 24) | (msg[i + 4 * t + 1] << 16) | (msg[i + 4 * t + 2] << 8) | msg[i + 4 * t + 3]) >>> 0;
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map(x => x.toString(16).padStart(8, '0')).join('');
  }
  async function sha256Hex(str) {
    try {
      if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {}
    return sha256Fallback(str);
  }
  const normEmail = e => String(e || '').trim().toLowerCase();
  const hashPass = (email, pass) => sha256Hex('gulos:' + normEmail(email) + ':' + pass);
  const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());

  /* --------------------------------------------------------------- sessão */
  function sessionValid() {
    const s = st(); if (!s) return false;
    const a = s.config.admin;
    const sess = ssGet(SESSION_KEY);
    return !!(a.passHash && sess && sess.exp > Date.now() && sess.sig === a.passHash.slice(0, 16) && normEmail(sess.email) === normEmail(a.email));
  }
  function startSession() {
    const a = st().config.admin;
    ssSet(SESSION_KEY, { email: a.email, exp: Date.now() + SESSION_MS, sig: a.passHash.slice(0, 16) });
  }
  function endSession() { ssSet(SESSION_KEY, null); }
  function lockInfo() { return lsGet(LOCK_KEY) || { fails: 0, until: 0 }; }

  /* ------------------------------------------------------------ camadas */
  const footerEl = document.createElement('footer');
  footerEl.className = 'adm-footer';
  const layer = document.createElement('div');
  layer.className = 'adm-layer';
  const toastHost = document.createElement('div');
  toastHost.className = 'adm-toasts';
  toastHost.setAttribute('role', 'status');
  toastHost.setAttribute('aria-live', 'polite');
  root.append(footerEl, layer, toastHost);

  let lastFocus = null;
  function lockScroll(on) { document.documentElement.style.overflow = on ? 'hidden' : ''; }

  function toast(msg, type = 'ok') {
    const t = document.createElement('div');
    t.className = 'adm-toast adm-toast-' + type;
    t.innerHTML = `<span class="adm-toast-dot"></span><span>${esc(msg)}</span>`;
    toastHost.appendChild(t);
    requestAnimationFrame(() => t.classList.add('adm-in'));
    setTimeout(() => { t.classList.remove('adm-in'); setTimeout(() => t.remove(), 300); }, 2800);
  }

  /* ---------------------------------------------------------- modais */
  const modals = [];
  function openModal({ title, body, footer = '', wide = false, onClose, focus }) {
    const wrap = document.createElement('div');
    wrap.className = 'adm-modal-wrap';
    const tid = uid('adm-mt-');
    wrap.innerHTML = `<div class="adm-modal ${wide ? 'adm-modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${tid}">
        <header class="adm-modal-head"><h3 id="${tid}">${title}</h3><button type="button" class="adm-iconbtn" data-close aria-label="Fechar">${ic('x')}</button></header>
        <div class="adm-modal-body">${body}</div>
        ${footer ? `<footer class="adm-modal-foot">${footer}</footer>` : ''}
      </div>`;
    const prevFocus = document.activeElement;
    const m = {
      el: wrap,
      close() {
        const i = modals.indexOf(m); if (i >= 0) modals.splice(i, 1);
        wrap.classList.remove('adm-in');
        setTimeout(() => wrap.remove(), 180);
        if (onClose) onClose();
        if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {}
      }
    };
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) m.close(); });
    wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) m.close(); });
    layer.appendChild(wrap);
    modals.push(m);
    requestAnimationFrame(() => wrap.classList.add('adm-in'));
    const f = (focus && wrap.querySelector(focus)) || wrap.querySelector('.adm-modal-body input:not([type=hidden]):not([type=file]), .adm-modal-body select, .adm-modal-body textarea');
    try { (f || wrap.querySelector('[data-close]')).focus({ preventScroll: true }); } catch (e) {}
    return m;
  }
  function confirmBox(msg, { ok = 'Confirmar', danger = false, title = 'Confirmar' } = {}) {
    return new Promise(res => {
      let done = false;
      const m = openModal({
        title, body: `<p class="adm-confirm-msg">${msg}</p>`,
        footer: `<button type="button" class="adm-btn adm-btn-ghost" data-close>Cancelar</button><button type="button" class="adm-btn ${danger ? 'adm-btn-danger' : 'adm-btn-primary'}" data-ok>${ok}</button>`,
        onClose: () => { if (!done) { done = true; res(false); } }
      });
      m.el.querySelector('[data-ok]').addEventListener('click', () => { done = true; res(true); m.close(); });
      m.el.querySelector('[data-ok]').focus();
    });
  }

  /* ---------------------------------------------------------- rodapé */
  function renderFooter() {
    const s = st();
    const store = (s && s.store) || {};
    const name = store.name || 'Hamburgueria Gulos';
    const phoneDigits = String(store.phone || '').replace(/\D/g, '');
    const wa = String(store.whatsapp || store.phone || '').replace(/\D/g, '');
    const waNum = wa ? (wa.length <= 11 ? '55' + wa : wa) : '';
    const cols = [];
    if (store.address) cols.push(`<div class="adm-fcol"><h3 class="adm-fh">${ic('pin')} Endereço</h3><a class="adm-flink" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}" target="_blank" rel="noopener">${esc(store.address)}</a></div>`);
    if (store.phone || store.whatsapp) cols.push(`<div class="adm-fcol"><h3 class="adm-fh">${ic('phone')} Contato</h3>
        ${store.phone ? `<a class="adm-flink" href="tel:${phoneDigits}">${esc(store.phone)}</a>` : ''}
        ${waNum ? `<a class="adm-flink" href="https://wa.me/${waNum}" target="_blank" rel="noopener">Chamar no WhatsApp</a>` : ''}</div>`);
    if (store.hours) cols.push(`<div class="adm-fcol"><h3 class="adm-fh">${ic('clock')} Horário</h3><p class="adm-ftext">${esc(store.hours).replace(/\n/g, '<br>')}</p></div>`);
    footerEl.innerHTML = `
      <div class="adm-finner">
        <div class="adm-fbrand">
          ${store.logo ? `<span class="adm-thumb adm-flogo" data-initial="🍔"><img class="adm-img" src="${esc(store.logo)}" alt=""></span>` : `<span class="adm-fmark" aria-hidden="true">🍔</span>`}
          <div><strong class="adm-fname">${esc(name)}</strong><p class="adm-ftag">Peça online e receba quentinho.</p></div>
        </div>
        ${cols.length ? `<div class="adm-fcols">${cols.join('')}</div>` : ''}
      </div>
      <div class="adm-fbottom">
        <span>© ${new Date().getFullYear()} ${esc(name)}</span>
        <span class="adm-fsep" aria-hidden="true">·</span>
        <span>Feito com 🔥</span>
        <button type="button" class="adm-ownerlink" data-adm-open>${ic('lock')} Painel do dono</button>
      </div>`;
  }
  footerEl.addEventListener('click', e => { if (e.target.closest('[data-adm-open]')) openAdmin(); });

  /* ------------------------------------------------------------ login */
  let authEl = null;
  function closeAuth() { if (authEl) { authEl.remove(); authEl = null; } if (!panelEl) lockScroll(false); }

  function openAdmin() {
    if (!Store()) { toast('Dados da loja indisponíveis.', 'err'); return; }
    lastFocus = document.activeElement;
    if (sessionValid()) openPanel();
    else openAuth();
  }

  function openAuth() {
    closeAuth();
    const a = st().config.admin;
    const setup = !a.passHash;
    authEl = document.createElement('div');
    authEl.className = 'adm-auth';
    authEl.setAttribute('role', 'dialog');
    authEl.setAttribute('aria-modal', 'true');
    authEl.setAttribute('aria-labelledby', 'adm-auth-title');
    authEl.innerHTML = `
      <form class="adm-authcard" novalidate>
        <button type="button" class="adm-iconbtn adm-auth-x" data-auth-close aria-label="Fechar">${ic('x')}</button>
        <div class="adm-authlogo" aria-hidden="true">${ic('lock')}</div>
        <h2 id="adm-auth-title" class="adm-authtitle">${setup ? 'Criar acesso do dono' : 'Painel do dono'}</h2>
        <p class="adm-authsub">${setup ? 'Primeiro acesso: defina o e-mail e a senha que vão proteger o painel.' : 'Entre com o e-mail e a senha da conta.'}</p>
        ${field('E-mail', `<input class="adm-input" type="email" name="email" autocomplete="username" required value="${esc(setup ? a.email || '' : '')}">`)}
        ${field('Senha', `<span class="adm-passwrap"><input class="adm-input" type="password" name="pass" autocomplete="${setup ? 'new-password' : 'current-password'}" required minlength="${setup ? 8 : 1}"><button type="button" class="adm-peek" data-peek aria-label="Mostrar senha">${ic('eye')}</button></span>`, setup ? 'Mínimo de 8 caracteres.' : '')}
        ${setup ? field('Confirmar senha', `<input class="adm-input" type="password" name="pass2" autocomplete="new-password" required>`) : ''}
        <p class="adm-autherr" role="alert" aria-live="assertive"></p>
        <button type="submit" class="adm-btn adm-btn-primary adm-btn-block">${setup ? 'Criar acesso e entrar' : 'Entrar'}</button>
        ${setup ? '' : `<details class="adm-forgot"><summary>Esqueci a senha</summary><p>Sem servidor não existe recuperação por e-mail. Se perdeu a senha, é preciso limpar os dados do site neste navegador (isso também apaga cardápio editado e pedidos) ou restaurar um backup.</p></details>`}
      </form>`;
    layer.appendChild(authEl);
    lockScroll(true);
    const form = authEl.querySelector('form');
    const err = authEl.querySelector('.adm-autherr');
    const btn = form.querySelector('[type=submit]');
    authEl.addEventListener('mousedown', e => { if (e.target === authEl) closeAuth(); });
    authEl.querySelector('[data-auth-close]').addEventListener('click', closeAuth);
    authEl.querySelector('[data-peek]').addEventListener('click', e => {
      const inp = form.pass; const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      if (form.pass2) form.pass2.type = inp.type;
      e.currentTarget.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    });
    let timer = null;
    function refreshLock() {
      const L = lockInfo();
      const left = Math.ceil((L.until - Date.now()) / 1000);
      if (left > 0) {
        btn.disabled = true;
        err.textContent = `Muitas tentativas erradas. Tente novamente em ${left}s.`;
        clearTimeout(timer); timer = setTimeout(refreshLock, 500);
      } else if (btn.disabled) { btn.disabled = false; err.textContent = ''; }
    }
    if (!setup) refreshLock();
    setTimeout(() => (setup || !form.email.value ? form.email : form.pass).focus(), 30);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      err.textContent = '';
      const email = form.email.value.trim();
      const pass = form.pass.value;
      if (setup) {
        if (!validEmail(email)) { err.textContent = 'Informe um e-mail válido.'; form.email.focus(); return; }
        if (pass.length < 8) { err.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; form.pass.focus(); return; }
        if (pass !== form.pass2.value) { err.textContent = 'As senhas não conferem.'; form.pass2.focus(); return; }
        btn.disabled = true;
        const h = await hashPass(email, pass);
        const s = st();
        s.config.admin = Object.assign({}, s.config.admin, { email, passHash: h });
        save();
        startSession();
        closeAuth();
        openPanel();
        toast('Acesso do dono criado!');
        return;
      }
      const L = lockInfo();
      if (L.until > Date.now()) { refreshLock(); return; }
      btn.disabled = true;
      const a2 = st().config.admin;
      const h = await hashPass(email, pass);
      if (normEmail(email) === normEmail(a2.email) && h === a2.passHash) {
        lsSet(LOCK_KEY, null);
        startSession();
        closeAuth();
        openPanel();
        toast('Bem-vindo de volta!');
      } else {
        const fails = (L.fails || 0) + 1;
        if (fails >= MAX_FAILS) {
          lsSet(LOCK_KEY, { fails: 0, until: Date.now() + LOCK_MS });
          refreshLock();
        } else {
          lsSet(LOCK_KEY, { fails, until: 0 });
          btn.disabled = false;
          const left = MAX_FAILS - fails;
          err.textContent = 'E-mail ou senha incorretos.' + (left <= 3 ? ` ${left} tentativa${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}.` : '');
          form.pass.select();
        }
      }
    });
  }

  /* ------------------------------------------------------------ painel */
  const TABS = [
    { id: 'overview', label: 'Visão geral', short: 'Início', icon: 'home' },
    { id: 'products', label: 'Produtos', short: 'Produtos', icon: 'burger' },
    { id: 'stock', label: 'Estoque', short: 'Estoque', icon: 'box' },
    { id: 'finance', label: 'Financeiro', short: 'Finanças', icon: 'chart' },
    { id: 'orders', label: 'Pedidos', short: 'Pedidos', icon: 'receipt' },
    { id: 'settings', label: 'Configurações', short: 'Ajustes', icon: 'gear' }
  ];
  let panelEl = null, content = null, tab = ssGet(TAB_KEY) || 'overview';
  let dirty = false;

  function openPanel() {
    if (panelEl) { renderTab(); return; }
    panelEl = document.createElement('div');
    panelEl.className = 'adm-panel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-modal', 'true');
    panelEl.setAttribute('aria-label', 'Painel do dono');
    const s = st();
    panelEl.innerHTML = `
      <aside class="adm-side">
        <div class="adm-brand">
          ${s.store.logo ? `<span class="adm-thumb adm-brandlogo" data-initial="🍔"><img class="adm-img" src="${esc(s.store.logo)}" alt=""></span>` : `<span class="adm-brandmark" aria-hidden="true">🍔</span>`}
          <div><strong>${esc(s.store.name || 'Gulos')}</strong><small>Painel do dono</small></div>
        </div>
        <nav class="adm-nav" aria-label="Seções do painel">
          ${TABS.map(t => `<button type="button" class="adm-navbtn" data-tab="${t.id}">${ic(t.icon)}<span class="adm-navlabel">${t.label}</span><span class="adm-navshort">${t.short}</span><span class="adm-navbadge" data-badge="${t.id}" hidden></span></button>`).join('')}
        </nav>
        <div class="adm-sidefoot">
          <span class="adm-sideemail" title="${esc(s.config.admin.email)}">${esc(s.config.admin.email)}</span>
          <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-logout>${ic('out')} Sair</button>
        </div>
      </aside>
      <div class="adm-main">
        <header class="adm-top">
          <h2 class="adm-title" id="adm-title"></h2>
          <div class="adm-topacts">
            <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm adm-top-logout" data-logout aria-label="Sair">${ic('out')}<span>Sair</span></button>
            <button type="button" class="adm-btn adm-btn-soft adm-btn-sm" data-close-panel aria-label="Fechar painel e voltar ao site">${ic('x')}<span>Ver site</span></button>
          </div>
        </header>
        <div class="adm-content" id="adm-content" tabindex="-1"></div>
      </div>`;
    layer.appendChild(panelEl);
    toastHost.classList.add('adm-toasts-up');
    content = panelEl.querySelector('#adm-content');
    lockScroll(true);
    panelEl.querySelector('.adm-nav').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab);
    });
    panelEl.addEventListener('click', e => {
      if (e.target.closest('[data-logout]')) logout();
      else if (e.target.closest('[data-close-panel]')) closePanel();
    });
    requestAnimationFrame(() => panelEl.classList.add('adm-in'));
    renderTab();
    setTimeout(() => { const b = panelEl.querySelector('.adm-navbtn[aria-current="page"]'); if (b) b.focus({ preventScroll: true }); }, 50);
  }
  function closePanel() {
    if (!panelEl) return;
    destroyCharts();
    while (modals.length) modals[modals.length - 1].close();
    panelEl.remove(); panelEl = null; content = null;
    toastHost.classList.remove('adm-toasts-up');
    const back = layer.querySelector('.adm-backpill'); if (back) back.remove();
    lockScroll(false);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  function logout() { endSession(); closePanel(); toast('Você saiu do painel.'); }
  function setTab(id) {
    if (!TABS.some(t => t.id === id)) id = 'overview';
    tab = id; ssSet(TAB_KEY, id);
    renderTab();
    content.scrollTop = 0;
  }
  function updateBadges() {
    if (!panelEl) return;
    const s = st();
    const open = s.orders.filter(o => ['recebido', 'preparando', 'saiu', 'pronto'].includes(o.status)).length;
    const low = s.products.filter(p => p.active !== false && (Number(p.stock) || 0) <= (Number(p.minStock) || 0)).length;
    const set = (id, n) => { const b = panelEl.querySelector(`[data-badge="${id}"]`); if (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; } };
    set('orders', open); set('stock', low);
  }
  function renderTab() {
    if (!panelEl) return;
    if (!sessionValid()) { closePanel(); openAuth(); return; }
    dirty = false;
    destroyCharts();
    const t = TABS.find(x => x.id === tab) || TABS[0];
    tab = t.id;
    panelEl.querySelectorAll('.adm-navbtn').forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('adm-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    panelEl.querySelector('#adm-title').textContent = t.label;
    content.onclick = content.oninput = content.onchange = content.onsubmit = content.onkeydown = null;
    ({ overview: renderOverview, products: renderProducts, stock: renderStock, finance: renderFinance, orders: renderOrders, settings: renderSettings })[tab]();
    updateBadges();
  }

  /* --------------------------------------------------------- métricas */
  const isValid = o => o.status !== 'cancelado';
  function itemCost(it) {
    const p = Store().product(it.productId);
    const c = p && p.cost != null ? Number(p.cost) : (Number(it.unitPrice) || 0) * 0.42;
    return c * (Number(it.qty) || 0);
  }
  const orderCost = o => (o.items || []).reduce((a, it) => a + itemCost(it), 0);
  function aggregate(list) {
    const v = list.filter(isValid);
    const revenue = v.reduce((a, o) => a + (Number(o.total) || 0), 0);
    const cost = v.reduce((a, o) => a + orderCost(o), 0);
    return { revenue, cost, count: v.length, ticket: v.length ? revenue / v.length : 0, profit: revenue - cost };
  }
  const ordersSince = (from, to = Infinity) => st().orders.filter(o => { const t = ts(o); return t >= from && t < to; });
  const delta = (cur, prev) => {
    if (!prev) return cur ? '<span class="adm-delta adm-up">novo</span>' : '';
    const d = (cur - prev) / prev;
    return `<span class="adm-delta ${d >= 0 ? 'adm-up' : 'adm-down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d * 100).toFixed(0)}%</span>`;
  };
  const STATUS = { recebido: 'Recebido', preparando: 'Preparando', saiu: 'Saiu para entrega', pronto: 'Pronto para retirada', entregue: 'Entregue', cancelado: 'Cancelado' };
  const PAY = { pix: 'Pix', credito: 'Cartão de crédito', debito: 'Cartão de débito', dinheiro: 'Dinheiro' };
  const statusPill = s => `<span class="adm-pill adm-st-${esc(s || 'recebido')}">${esc(STATUS[s] || s || 'Recebido')}</span>`;
  const stockStatus = p => { const sk = Number(p.stock) || 0; return sk <= 0 ? 'esgotado' : sk <= (Number(p.minStock) || 0) ? 'baixo' : 'ok'; };
  const stockPill = p => { const k = stockStatus(p); return `<span class="adm-pill adm-sk-${k}">${{ ok: 'OK', baixo: 'Baixo', esgotado: 'Esgotado' }[k]}</span>`; };

  /* ------------------------------------------------------ visão geral */
  function renderOverview() {
    const s = st();
    const now = Date.now();
    const today = startOfDay(now);
    const d7 = today - 6 * DAY, d30 = today - 29 * DAY;
    const A = aggregate(ordersSince(today));
    const B = aggregate(ordersSince(d7)), Bp = aggregate(ordersSince(d7 - 7 * DAY, d7));
    const C = aggregate(ordersSince(d30)), Cp = aggregate(ordersSince(d30 - 30 * DAY, d30));
    const open = s.orders.filter(o => ['recebido', 'preparando', 'saiu', 'pronto'].includes(o.status)).length;
    const low = s.products.filter(p => p.active !== false && stockStatus(p) !== 'ok').sort((a, b) => (a.stock || 0) - (b.stock || 0));
    const latest = s.orders.slice().sort((a, b) => ts(b) - ts(a)).slice(0, 6);
    const hasDemo = s.orders.some(o => o.demo);
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const margin = C.revenue ? C.profit / C.revenue : 0;

    content.innerHTML = `
      <div class="adm-hello">
        <div><h3 class="adm-h3">${greet}! 👋</h3><p class="adm-muted">Resumo da ${esc(s.store.name || 'loja')} em ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}.</p></div>
        ${open ? `<button type="button" class="adm-btn adm-btn-primary" data-go="orders">${ic('receipt')} ${open} pedido${open > 1 ? 's' : ''} em aberto</button>` : ''}
      </div>
      ${s.orders.length < 5 ? `
        <div class="adm-demo">
          <div class="adm-demo-ic">${ic('spark')}</div>
          <div><strong>Ainda sem pedidos por aqui</strong><p>Gere cerca de 60 pedidos de demonstração dos últimos 30 dias para ver os gráficos e indicadores funcionando. O estoque não é alterado e você pode apagá-los depois.</p></div>
          <button type="button" class="adm-btn adm-btn-primary" data-act="demo">Gerar pedidos de demonstração</button>
        </div>` : ''}
      ${hasDemo ? `<div class="adm-demobar">${ic('spark')}<span>Você está vendo <strong>dados de demonstração</strong>.</span><button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-act="cleardemo">Limpar dados de demonstração</button></div>` : ''}
      <div class="adm-kpis adm-kpis-6">
        ${kpi('Faturamento hoje', brl(A.revenue), `${A.count} pedido${A.count === 1 ? '' : 's'}`, 'adm-kpi-hero')}
        ${kpi('Últimos 7 dias', brl(B.revenue), `${B.count} pedidos ${delta(B.revenue, Bp.revenue)}`)}
        ${kpi('Últimos 30 dias', brl(C.revenue), `${C.count} pedidos ${delta(C.revenue, Cp.revenue)}`)}
        ${kpi('Ticket médio', brl(C.ticket), 'últimos 30 dias')}
        ${kpi('Lucro estimado', brl(C.profit), `margem ${pct(margin)} · 30 dias`, C.profit >= 0 ? 'adm-kpi-ok' : 'adm-kpi-bad')}
        ${kpi('Pedidos em aberto', String(open), open ? 'aguardando você' : 'tudo em dia')}
      </div>
      <div class="adm-grid2">
        <section class="adm-card">
          <div class="adm-cardhead"><h3 class="adm-h4">${ic('alert')} Alertas de estoque</h3><button type="button" class="adm-link" data-go="stock">Ver estoque</button></div>
          ${low.length ? `<ul class="adm-list">${low.slice(0, 8).map(p => `
            <li class="adm-li">${thumb(p.image, p.name, 'adm-thumb-sm')}<span class="adm-li-main"><strong>${esc(p.name)}</strong><small>${Number(p.stock) || 0} em estoque · mínimo ${Number(p.minStock) || 0}</small></span>${stockPill(p)}</li>`).join('')}</ul>
            ${low.length > 8 ? `<p class="adm-muted adm-small">+ ${low.length - 8} outros itens</p>` : ''}`
            : `<p class="adm-empty">Nenhum produto com estoque baixo. 👌</p>`}
        </section>
        <section class="adm-card">
          <div class="adm-cardhead"><h3 class="adm-h4">${ic('receipt')} Últimos pedidos</h3><button type="button" class="adm-link" data-go="orders">Ver todos</button></div>
          ${latest.length ? `<ul class="adm-list">${latest.map(o => `
            <li><button type="button" class="adm-li adm-li-btn" data-order="${esc(o.id)}">
              <span class="adm-li-main"><strong>#${esc(o.id)} · ${esc((o.customer && o.customer.name) || 'Cliente')}</strong><small>${fmtDT(ts(o))} · ${(n => n + (n === 1 ? ' item' : ' itens'))((o.items || []).reduce((a, i) => a + (i.qty || 0), 0))}</small></span>
              <span class="adm-li-end"><strong>${brl(o.total)}</strong>${statusPill(o.status)}</span>
            </button></li>`).join('')}</ul>`
            : `<p class="adm-empty">Os pedidos feitos no site aparecem aqui.</p>`}
        </section>
      </div>`;
    content.onclick = async e => {
      const go = e.target.closest('[data-go]'); if (go) return setTab(go.dataset.go);
      const ob = e.target.closest('[data-order]'); if (ob) { orderOpen = ob.dataset.order; orderFilter = 'todos'; return setTab('orders'); }
      const act = e.target.closest('[data-act]'); if (!act) return;
      if (act.dataset.act === 'demo') { genDemo(); renderTab(); }
      if (act.dataset.act === 'cleardemo') clearDemo();
    };
  }
  const kpi = (label, value, sub, cls = '') => `<div class="adm-kpi ${cls}"><span class="adm-kpi-l">${label}</span><strong class="adm-kpi-v">${value}</strong><span class="adm-kpi-s">${sub}</span></div>`;

  async function clearDemo() {
    const s = st(); const n = s.orders.filter(o => o.demo).length;
    if (!n) return;
    if (!await confirmBox(`Apagar ${n} pedidos de demonstração? Pedidos reais não são afetados.`, { ok: 'Apagar demonstração', danger: true })) return;
    s.orders = s.orders.filter(o => !o.demo);
    save(); renderTab(); toast('Dados de demonstração removidos.');
  }

  /* ---------------------------------------------- pedidos de demonstração */
  function genCPF() {
    const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    const dv = arr => { const s = arr.reduce((a, d, i) => a + d * (arr.length + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    n.push(dv(n)); n.push(dv(n));
    const d = n.join('');
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  function genDemo() {
    const s = st();
    const prods = s.products.filter(p => p.active !== false && Number(p.price) > 0);
    if (!prods.length) { toast('Cadastre produtos antes de gerar pedidos.', 'err'); return; }
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const wpick = (arr, w) => { const tot = w.reduce((a, b) => a + b, 0); let r = Math.random() * tot; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; };
    const first = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Larissa', 'Lucas', 'Mariana', 'Mateus', 'Natália', 'Otávio', 'Paula', 'Rafael', 'Sofia', 'Thiago', 'Vitória', 'Gustavo', 'Beatriz', 'Caio', 'Letícia', 'Pedro'];
    const last = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Lima', 'Costa', 'Ferreira', 'Rodrigues', 'Almeida', 'Carvalho', 'Gomes', 'Ribeiro', 'Martins', 'Rocha'];
    const streets = ['Rua das Palmeiras', 'Av. Brasil', 'Rua XV de Novembro', 'Rua São João', 'Av. Getúlio Vargas', 'Rua Sete de Setembro', 'Rua das Flores', 'Av. Independência'];
    const districts = ['Centro', 'Jardim América', 'Vila Nova', 'Boa Vista', 'Santa Mônica', 'São José'];
    const hours = [11, 11, 12, 12, 12, 13, 13, 14, 15, 17, 18, 18, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 22, 22, 23];
    const pop = {}; prods.forEach((p, i) => { pop[p.id] = (i % 7 === 0 ? 6 : 1) + Math.random() * 5; });
    const weights = prods.map(p => pop[p.id]);
    const ddd = (String(s.store.phone || '').replace(/\D/g, '').slice(0, 2)) || '11';
    const fee = Number(s.config.deliveryFee != null ? s.config.deliveryFee : s.store.deliveryFee) || 0;
    const now = new Date();
    const out = [];
    let tries = 0;
    while (out.length < 60 && tries < 2000) {
      tries++;
      const forceToday = out.length < 4;
      const d = forceToday ? 0 : Math.floor(Math.pow(Math.random(), 1.15) * 30);
      const date = new Date(startOfDay(now.getTime() - d * DAY));
      const dow = date.getDay();
      if (!forceToday && !(dow === 5 || dow === 6 || dow === 0) && Math.random() < 0.38) continue;
      date.setHours(pick(hours), rnd(0, 59), rnd(0, 59));
      if (date.getTime() > now.getTime()) {
        const sinceMid = now.getTime() - startOfDay(now);
        date.setTime(now.getTime() - Math.random() * Math.min(sinceMid, 6 * 3600e3));
      }
      const items = [];
      const nItems = wpick([1, 2, 3, 4], [35, 38, 18, 9]);
      for (let k = 0; k < nItems; k++) {
        const p = wpick(prods, weights);
        const opts = [];
        (p.options || []).forEach(g => {
          if (!(g.items || []).length) return;
          if ((g.min || 0) > 0 || Math.random() < 0.3) {
            const n = Math.max(g.min || 0, 1);
            for (let z = 0; z < Math.min(n, (g.items || []).length); z++) { const it = pick(g.items); if (!opts.some(o => o.name === it.name)) opts.push({ groupName: g.name, name: it.name, price: Number(it.price) || 0 }); }
          }
        });
        const removed = (p.ingredients || []).length && Math.random() < 0.15 ? [pick(p.ingredients)] : [];
        const unit = r2(Number(p.price) + opts.reduce((a, o) => a + o.price, 0));
        const qty = Math.random() < 0.18 ? 2 : 1;
        items.push({ key: uid('k'), productId: p.id, name: p.name, image: p.image || '', qty, unitPrice: unit, options: opts, removed, note: '' });
      }
      const subtotal = r2(items.reduce((a, i) => a + i.unitPrice * i.qty, 0));
      const mode = Math.random() < 0.7 ? 'entrega' : 'retirada';
      const deliveryFee = mode === 'entrega' ? fee : 0;
      const total = r2(subtotal + deliveryFee);
      const method = wpick(['pix', 'credito', 'debito', 'dinheiro'], [46, 28, 16, 10]);
      const name = pick(first) + ' ' + pick(last);
      out.push({
        id: '', demo: true, createdAt: date.toISOString(), status: 'entregue', mode,
        customer: {
          name, cpf: genCPF(), phone: `(${ddd}) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}`, email: '',
          address: mode === 'entrega' ? { cep: '', street: pick(streets), number: String(rnd(10, 1999)), complement: Math.random() < 0.3 ? 'Apto ' + rnd(11, 304) : '', district: pick(districts), city: '', reference: '' } : null,
          geo: null
        },
        items, subtotal, deliveryFee, discount: 0, total,
        payment: method === 'dinheiro' ? { method, changeFor: Math.ceil(total / 50) * 50 } : { method },
        invoice: null
      });
    }
    out.sort((a, b) => ts(a) - ts(b)).forEach((o, i) => { o.id = 'DEMO-' + pad(i + 1, 3); });
    s.orders.push(...out);
    save();
    toast(`${out.length} pedidos de demonstração criados.`);
  }

  /* ---------------------------------------------------------- produtos */
  const prodFilter = { q: '', cat: '' };
  function renderProducts() {
    const s = st();
    content.innerHTML = `
      <div class="adm-toolbar">
        <label class="adm-search">${ic('search')}<span class="sr-only">Buscar produto</span><input class="adm-input" type="search" placeholder="Buscar produto…" data-f="q" value="${esc(prodFilter.q)}"></label>
        <label class="adm-selwrap"><span class="sr-only">Filtrar por categoria</span><select class="adm-input" data-f="cat">
          <option value="">Todas as categorias</option>
          ${s.categories.map(c => `<option value="${esc(c.id)}" ${prodFilter.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select></label>
        <div class="adm-toolbar-acts">
          <button type="button" class="adm-btn adm-btn-soft" data-act="cats">${ic('tag')} Categorias</button>
          <button type="button" class="adm-btn adm-btn-soft" data-act="bulk">% Reajuste</button>
          <button type="button" class="adm-btn adm-btn-primary" data-act="new">${ic('plus')} Novo produto</button>
        </div>
      </div>
      <div class="adm-prodlist" id="adm-prodlist"></div>`;
    renderProductList();
    content.oninput = e => {
      const f = e.target.dataset.f;
      if (f === 'q') { prodFilter.q = e.target.value; renderProductList(); }
    };
    content.onchange = e => {
      const t = e.target;
      if (t.dataset.f === 'cat') { prodFilter.cat = t.value; renderProductList(); return; }
      const row = t.closest('[data-pid]'); if (!row) return;
      const id = row.dataset.pid;
      if (t.dataset.inline === 'price') {
        const v = r2(num(t.value, NaN));
        if (!(v > 0)) { toast('Preço inválido.', 'err'); t.value = Store().product(id).price; return; }
        Store().updateProduct(id, { price: v });
        t.value = v.toFixed(2);
        toast('Preço atualizado: ' + brl(v));
      }
      if (t.dataset.inline === 'active') {
        Store().updateProduct(id, { active: t.checked });
        renderProductList();
        toast(t.checked ? 'Produto visível no cardápio.' : 'Produto oculto do cardápio.');
      }
    };
    content.onkeydown = e => { if (e.key === 'Enter' && e.target.dataset.inline === 'price') e.target.blur(); };
    content.onclick = async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const row = b.closest('[data-pid]'); const id = row && row.dataset.pid;
      const act = b.dataset.act;
      if (act === 'new') openProductForm(null);
      else if (act === 'cats') openCategories();
      else if (act === 'bulk') openBulk();
      else if (act === 'edit') openProductForm(id);
      else if (act === 'dup') {
        const p = clone(Store().product(id)); delete p.id;
        p.name = p.name + ' (cópia)';
        p.options = (p.options || []).map(g => Object.assign(g, { id: uid('g'), items: (g.items || []).map(i => Object.assign(i, { id: uid('o') })) }));
        Store().addProduct(p);
        renderProductList(); toast('Produto duplicado.');
      } else if (act === 'del') {
        const p = Store().product(id);
        if (await confirmBox(`Excluir <strong>${esc(p.name)}</strong> do cardápio? Esta ação não pode ser desfeita.`, { ok: 'Excluir', danger: true, title: 'Excluir produto' })) {
          Store().removeProduct(id); renderProductList(); toast('Produto excluído.');
        }
      }
    };
  }
  function renderProductList() {
    const host = content && content.querySelector('#adm-prodlist'); if (!host) return;
    const s = st();
    const q = prodFilter.q.trim().toLowerCase();
    const list = s.products.filter(p => (!prodFilter.cat || p.categoryId === prodFilter.cat) && (!q || (p.name + ' ' + (p.description || '')).toLowerCase().includes(q)));
    if (!list.length) { host.innerHTML = `<p class="adm-empty">Nenhum produto encontrado.</p>`; return; }
    const catOrder = s.categories.map(c => c.id);
    list.sort((a, b) => (catOrder.indexOf(a.categoryId) - catOrder.indexOf(b.categoryId)) || 0);
    host.innerHTML = `<p class="adm-muted adm-small">${list.length} produto${list.length > 1 ? 's' : ''} · edite o preço direto na lista ou toque em Editar para o cadastro completo.</p>` + list.map(p => {
      const promo = p.oldPrice && Number(p.oldPrice) > Number(p.price);
      const marg = Number(p.price) ? (Number(p.price) - Number(p.cost || 0)) / Number(p.price) : 0;
      return `
      <article class="adm-prod ${p.active === false ? 'adm-prod-off' : ''}" data-pid="${esc(p.id)}">
        ${thumb(p.image, p.name)}
        <div class="adm-prod-info">
          <strong class="adm-prod-name">${esc(p.name)}</strong>
          <span class="adm-prod-meta">${esc(catName(p.categoryId))} · custo ${brl(p.cost || 0)} · margem ${pct(marg)}</span>
          <span class="adm-prod-tags">
            ${p.active === false ? '<span class="adm-pill adm-pill-mute">Oculto</span>' : ''}
            ${promo ? `<span class="adm-pill adm-pill-promo">Promo · de ${brl(p.oldPrice)}</span>` : ''}
            ${stockStatus(p) !== 'ok' ? stockPill(p) : ''}
          </span>
        </div>
        <label class="adm-prod-price"><span class="adm-label">Preço</span><span class="adm-money"><span>R$</span><input class="adm-input" type="number" inputmode="decimal" step="0.01" min="0" value="${Number(p.price || 0).toFixed(2)}" data-inline="price" aria-label="Preço de ${esc(p.name)}"></span></label>
        <label class="adm-switch" title="Mostrar no cardápio"><input type="checkbox" data-inline="active" ${p.active !== false ? 'checked' : ''} aria-label="Mostrar ${esc(p.name)} no cardápio"><span class="adm-switch-ui"></span><span class="adm-switch-t">${p.active !== false ? 'Ativo' : 'Oculto'}</span></label>
        <div class="adm-prod-acts">
          <button type="button" class="adm-btn adm-btn-soft adm-btn-sm" data-act="edit">${ic('edit')} Editar</button>
          <button type="button" class="adm-iconbtn" data-act="dup" aria-label="Duplicar ${esc(p.name)}" title="Duplicar">${ic('copy')}</button>
          <button type="button" class="adm-iconbtn adm-iconbtn-danger" data-act="del" aria-label="Excluir ${esc(p.name)}" title="Excluir">${ic('trash')}</button>
        </div>
      </article>`;
    }).join('');
  }

  function downscale(file, max = 800, quality = 0.8) {
    return new Promise((res, rej) => {
      if (!file || !/^image\//.test(file.type)) return rej(new Error('Arquivo não é imagem'));
      const fr = new FileReader();
      fr.onerror = () => rej(fr.error);
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => rej(new Error('Imagem inválida'));
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', quality));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  // Campo de imagem: URL ou envio do aparelho.
  function photoField(key, value, label, hint) {
    const isData = /^data:/.test(value || '');
    return `<div class="adm-field adm-photofield" data-photo="${key}">
      <span class="adm-label">${label}</span>
      <div class="adm-photorow">
        <div class="adm-photo ${value ? '' : 'adm-photo-empty'}">${value ? `<img class="adm-img" src="${esc(value)}" alt="Pré-visualização">` : ''}<span class="adm-photo-ph">${ic('upload')}<small>Sem imagem</small></span></div>
        <div class="adm-photoctl">
          <input class="adm-input" type="url" data-photo-url placeholder="${isData ? 'Imagem enviada do aparelho' : 'https://… ou img/arquivo.jpg'}" value="${isData ? '' : esc(value || '')}" aria-label="${label}: endereço da imagem">
          <div class="adm-btnrow">
            <label class="adm-btn adm-btn-soft adm-btn-sm adm-filebtn">${ic('upload')} Enviar foto<input type="file" accept="image/*" data-photo-file class="sr-only"></label>
            <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-photo-clear>Remover</button>
          </div>
          ${hint ? `<small class="adm-hint">${hint}</small>` : ''}
        </div>
      </div>
    </div>`;
  }
  function bindPhoto(el, key, get, set, max = 800) {
    const box = el.querySelector(`[data-photo="${key}"]`); if (!box) return;
    const prev = box.querySelector('.adm-photo');
    const url = box.querySelector('[data-photo-url]');
    const show = v => {
      prev.classList.toggle('adm-photo-empty', !v);
      const old = prev.querySelector('img'); if (old) old.remove();
      if (v) { const i = document.createElement('img'); i.className = 'adm-img'; i.alt = 'Pré-visualização'; i.src = v; prev.prepend(i); }
    };
    url.addEventListener('input', () => { set(url.value.trim()); show(url.value.trim()); });
    box.querySelector('[data-photo-file]').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = await downscale(f, max);
        set(data); show(data); url.value = ''; url.placeholder = 'Imagem enviada do aparelho';
        toast(`Foto otimizada (${Math.round(data.length * 0.75 / 1024)} KB).`);
      } catch (err) { toast('Não foi possível ler a imagem.', 'err'); }
      e.target.value = '';
    });
    box.querySelector('[data-photo-clear]').addEventListener('click', () => { set(''); show(''); url.value = ''; url.placeholder = 'https://… ou img/arquivo.jpg'; });
    void get;
  }

  function openProductForm(id) {
    const s = st();
    const orig = id ? Store().product(id) : null;
    const d = orig ? clone(orig) : { name: '', categoryId: prodFilter.cat || (s.categories[0] || {}).id || '', description: '', price: '', oldPrice: null, cost: '', image: '', ingredients: [], options: [], stock: 50, minStock: 10, active: true };
    d.ingredients = Array.isArray(d.ingredients) ? d.ingredients : [];
    d.options = Array.isArray(d.options) ? d.options : [];
    const v = x => x == null ? '' : esc(x);
    const body = `
      <form class="adm-form" novalidate>
        <div class="adm-formgrid">
          ${field('Nome do produto *', `<input class="adm-input" name="name" required value="${v(d.name)}" maxlength="80">`, '', 'adm-span2')}
          ${field('Categoria', `<select class="adm-input" name="categoryId">${s.categories.map(c => `<option value="${esc(c.id)}" ${c.id === d.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`)}
          <label class="adm-field adm-field-switch"><span class="adm-label">Visível no cardápio</span><span class="adm-switch"><input type="checkbox" name="active" ${d.active !== false ? 'checked' : ''}><span class="adm-switch-ui"></span><span class="adm-switch-t">Ativo</span></span></label>
          ${field('Descrição', `<textarea class="adm-input" name="description" rows="3" maxlength="400">${v(d.description)}</textarea>`, '', 'adm-span2')}
          ${field('Preço de venda (R$) *', `<input class="adm-input" name="price" type="number" inputmode="decimal" step="0.01" min="0" value="${v(d.price)}">`)}
          ${field('Preço antigo / “de” (R$)', `<input class="adm-input" name="oldPrice" type="number" inputmode="decimal" step="0.01" min="0" value="${v(d.oldPrice)}" placeholder="Opcional">`, 'Se preenchido, aparece riscado como promoção.')}
          ${field('Custo (R$)', `<input class="adm-input" name="cost" type="number" inputmode="decimal" step="0.01" min="0" value="${v(d.cost)}">`, '<span data-margin></span>')}
          <div class="adm-formgrid adm-formgrid-in">
            ${field('Estoque', `<input class="adm-input" name="stock" type="number" inputmode="numeric" step="1" value="${v(d.stock)}">`)}
            ${field('Mínimo', `<input class="adm-input" name="minStock" type="number" inputmode="numeric" step="1" min="0" value="${v(d.minStock)}">`)}
          </div>
        </div>
        ${photoField('image', d.image, 'Foto do produto', 'A foto enviada é reduzida para até 800px para não pesar.')}
        <fieldset class="adm-fieldset">
          <legend class="adm-label">Ingredientes</legend>
          <p class="adm-hint">O cliente poderá pedir para retirar. Remover um ingrediente aqui tira ele do produto.</p>
          <div class="adm-chips" data-ings></div>
          <div class="adm-inline">
            <input class="adm-input" data-ing-new placeholder="Ex.: Cebola caramelizada" aria-label="Novo ingrediente" maxlength="40">
            <button type="button" class="adm-btn adm-btn-soft" data-ing-add>${ic('plus')} Adicionar</button>
          </div>
        </fieldset>
        <fieldset class="adm-fieldset">
          <legend class="adm-label">Opções e adicionais</legend>
          <p class="adm-hint">Grupos como “Ponto da carne” (mín. 1, máx. 1) ou “Adicionais” (mín. 0, máx. 5), com preço extra por item.</p>
          <div data-opts></div>
          <button type="button" class="adm-btn adm-btn-soft" data-grp-add>${ic('plus')} Novo grupo de opções</button>
        </fieldset>
        <p class="adm-formerr" role="alert"></p>
      </form>`;
    const m = openModal({
      title: orig ? 'Editar produto' : 'Novo produto', wide: true, body,
      footer: `<button type="button" class="adm-btn adm-btn-ghost" data-close>Cancelar</button><button type="button" class="adm-btn adm-btn-primary" data-save>Salvar produto</button>`
    });
    const el = m.el, form = el.querySelector('form');
    const errEl = el.querySelector('.adm-formerr');
    const marginEl = el.querySelector('[data-margin]');
    const updMargin = () => {
      const p = num(form.price.value), c = num(form.cost.value);
      marginEl.textContent = p > 0 ? `Margem: ${pct((p - c) / p)} (${brl(p - c)} por unidade)` : '';
      marginEl.className = p > 0 && c > p ? 'adm-neg' : '';
    };
    updMargin();
    form.addEventListener('input', e => { if (e.target.name === 'price' || e.target.name === 'cost') updMargin(); });
    bindPhoto(el, 'image', () => d.image, val => { d.image = val; });

    const ingHost = el.querySelector('[data-ings]');
    const renderIngs = () => {
      ingHost.innerHTML = d.ingredients.length
        ? d.ingredients.map((g, i) => `<span class="adm-chip">${esc(g)}<button type="button" data-ing-del="${i}" aria-label="Remover ${esc(g)}">${ic('x')}</button></span>`).join('')
        : '<span class="adm-muted adm-small">Nenhum ingrediente.</span>';
    };
    const addIng = () => {
      const inp = el.querySelector('[data-ing-new]');
      const val = inp.value.trim(); if (!val) return;
      if (d.ingredients.some(x => x.toLowerCase() === val.toLowerCase())) { toast('Ingrediente já existe.', 'warn'); return; }
      d.ingredients.push(val); inp.value = ''; renderIngs(); inp.focus();
    };
    renderIngs();

    const optHost = el.querySelector('[data-opts]');
    const renderOpts = () => {
      optHost.innerHTML = d.options.map((g, gi) => `
        <div class="adm-grp" data-gi="${gi}">
          <div class="adm-grphead">
            ${field('Nome do grupo', `<input class="adm-input" data-g="name" value="${esc(g.name)}" placeholder="Ex.: Adicionais">`, '', 'adm-grow')}
            ${field('Mín.', `<input class="adm-input adm-input-xs" type="number" min="0" step="1" data-g="min" value="${Number(g.min) || 0}">`)}
            ${field('Máx.', `<input class="adm-input adm-input-xs" type="number" min="1" step="1" data-g="max" value="${Number(g.max) || 1}">`)}
            <button type="button" class="adm-iconbtn adm-iconbtn-danger" data-grp-del aria-label="Remover grupo ${esc(g.name)}">${ic('trash')}</button>
          </div>
          <div class="adm-optitems">
            ${(g.items || []).map((it, ii) => `
              <div class="adm-optitem" data-ii="${ii}">
                <input class="adm-input" data-i="name" value="${esc(it.name)}" placeholder="Nome do item" aria-label="Nome do item">
                <span class="adm-money adm-money-sm"><span>+R$</span><input class="adm-input" type="number" inputmode="decimal" step="0.01" min="0" data-i="price" value="${Number(it.price || 0).toFixed(2)}" aria-label="Preço extra de ${esc(it.name || 'item')}"></span>
                <button type="button" class="adm-iconbtn" data-item-del aria-label="Remover item ${esc(it.name)}">${ic('x')}</button>
              </div>`).join('')}
          </div>
          <button type="button" class="adm-link" data-item-add>${ic('plus')} Adicionar item</button>
        </div>`).join('') || '<p class="adm-muted adm-small">Nenhum grupo de opções.</p>';
    };
    renderOpts();

    el.addEventListener('input', e => {
      const t = e.target;
      const gEl = t.closest('[data-gi]'); if (!gEl) return;
      const g = d.options[+gEl.dataset.gi];
      if (t.dataset.g) g[t.dataset.g] = t.dataset.g === 'name' ? t.value : Math.max(0, parseInt(t.value, 10) || 0);
      if (t.dataset.i) { const it = g.items[+t.closest('[data-ii]').dataset.ii]; it[t.dataset.i] = t.dataset.i === 'name' ? t.value : r2(num(t.value)); }
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-ing-new]')) { e.preventDefault(); addIng(); } });
    el.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-ing-add]')) return addIng();
      const di = t.closest('[data-ing-del]');
      if (di) { d.ingredients.splice(+di.dataset.ingDel, 1); renderIngs(); return; }
      if (t.closest('[data-grp-add]')) { d.options.push({ id: uid('g'), name: '', min: 0, max: 3, items: [{ id: uid('o'), name: '', price: 0 }] }); renderOpts(); const ins = optHost.querySelectorAll('[data-g="name"]'); ins[ins.length - 1].focus(); return; }
      const gEl = t.closest('[data-gi]'); if (!gEl) {
        if (t.closest('[data-save]')) doSave();
        return;
      }
      const gi = +gEl.dataset.gi;
      if (t.closest('[data-grp-del]')) { d.options.splice(gi, 1); renderOpts(); return; }
      if (t.closest('[data-item-add]')) { d.options[gi].items = d.options[gi].items || []; d.options[gi].items.push({ id: uid('o'), name: '', price: 0 }); renderOpts(); const its = optHost.querySelectorAll(`[data-gi="${gi}"] [data-i="name"]`); its[its.length - 1].focus(); return; }
      const idel = t.closest('[data-item-del]');
      if (idel) { d.options[gi].items.splice(+idel.closest('[data-ii]').dataset.ii, 1); renderOpts(); }
    });
    form.addEventListener('submit', e => { e.preventDefault(); doSave(); });

    function doSave() {
      errEl.textContent = '';
      const name = form.name.value.trim();
      const price = r2(num(form.price.value, NaN));
      const oldRaw = form.oldPrice.value.trim();
      const oldPrice = oldRaw ? r2(num(oldRaw, NaN)) : null;
      const fail = (msg, inp) => { errEl.textContent = msg; if (inp) inp.focus(); };
      if (!name) return fail('Informe o nome do produto.', form.name);
      if (!(price > 0)) return fail('Informe um preço de venda válido.', form.price);
      if (oldPrice != null && !(oldPrice > price)) return fail('O preço antigo deve ser maior que o preço atual (ou deixe em branco).', form.oldPrice);
      if (!form.categoryId.value) return fail('Crie uma categoria antes (botão Categorias).');
      const options = d.options.map(g => ({
        id: g.id || uid('g'), name: String(g.name || '').trim() || 'Opções',
        min: Math.max(0, parseInt(g.min, 10) || 0),
        max: Math.max(1, parseInt(g.max, 10) || 1, parseInt(g.min, 10) || 0),
        items: (g.items || []).filter(i => String(i.name || '').trim()).map(i => ({ id: i.id || uid('o'), name: String(i.name).trim(), price: r2(num(i.price)) }))
      })).filter(g => g.items.length);
      const patch = {
        name, categoryId: form.categoryId.value, description: form.description.value.trim(),
        price, oldPrice, cost: r2(num(form.cost.value)), image: d.image || '',
        ingredients: d.ingredients.slice(), options,
        stock: parseInt(form.stock.value, 10) || 0, minStock: Math.max(0, parseInt(form.minStock.value, 10) || 0),
        active: form.active.checked
      };
      if (orig) {
        const deltaStock = patch.stock - (Number(orig.stock) || 0);
        if (deltaStock) st().stockLog.push({ at: new Date().toISOString(), productId: orig.id, delta: deltaStock, reason: 'Ajuste no cadastro do produto' });
        Store().updateProduct(orig.id, patch);
        toast('Produto salvo.');
      } else {
        Store().addProduct(patch);
        toast('Produto criado.');
      }
      m.close();
      if (tab === 'products') renderProductList(); else renderTab();
    }
  }

  function openCategories() {
    const m = openModal({ title: 'Categorias', focus: '[name=cname]', body: '<div data-cats></div>', footer: '<button type="button" class="adm-btn adm-btn-primary" data-close>Concluir</button>', onClose: () => { if (tab === 'products') renderTab(); } });
    const host = m.el.querySelector('[data-cats]');
    const render = () => {
      const s = st();
      host.innerHTML = `
        <ul class="adm-catlist">${s.categories.map((c, i) => {
          const n = s.products.filter(p => p.categoryId === c.id).length;
          return `<li class="adm-catrow" data-ci="${i}">
            <input class="adm-input" value="${esc(c.name)}" data-cname aria-label="Nome da categoria ${esc(c.name)}">
            <small class="adm-muted adm-catn">${n} prod.</small>
            <button type="button" class="adm-iconbtn" data-cup aria-label="Subir ${esc(c.name)}" ${i === 0 ? 'disabled' : ''}>${ic('up')}</button>
            <button type="button" class="adm-iconbtn" data-cdown aria-label="Descer ${esc(c.name)}" ${i === s.categories.length - 1 ? 'disabled' : ''}>${ic('down')}</button>
            <button type="button" class="adm-iconbtn adm-iconbtn-danger" data-cdel aria-label="Remover ${esc(c.name)}" ${n ? `disabled title="Mova ou exclua os ${n} produtos antes"` : ''}>${ic('trash')}</button>
          </li>`; }).join('')}</ul>
        <form class="adm-inline" data-cadd>
          <input class="adm-input" name="cname" placeholder="Nova categoria (ex.: Sobremesas)" aria-label="Nova categoria" maxlength="40">
          <button type="submit" class="adm-btn adm-btn-soft">${ic('plus')} Adicionar</button>
        </form>
        <p class="adm-hint">A ordem aqui é a ordem das seções no cardápio. Só é possível remover categorias vazias.</p>`;
    };
    render();
    host.querySelector('[name=cname]').focus();
    host.addEventListener('change', e => {
      if (!e.target.matches('[data-cname]')) return;
      const s = st(); const c = s.categories[+e.target.closest('[data-ci]').dataset.ci];
      const v = e.target.value.trim(); if (!v) { e.target.value = c.name; return; }
      c.name = v; save(); toast('Categoria renomeada.');
    });
    host.addEventListener('click', e => {
      const s = st();
      const row = e.target.closest('[data-ci]'); if (!row) return;
      const i = +row.dataset.ci;
      const swap = j => { const a = s.categories; [a[i], a[j]] = [a[j], a[i]]; save(); render(); const b = host.querySelector(`[data-ci="${j}"] ${j < i ? '[data-cup]' : '[data-cdown]'}`); if (b && !b.disabled) b.focus(); };
      if (e.target.closest('[data-cup]') && i > 0) swap(i - 1);
      else if (e.target.closest('[data-cdown]') && i < s.categories.length - 1) swap(i + 1);
      else if (e.target.closest('[data-cdel]')) {
        const c = s.categories[i];
        if (s.products.some(p => p.categoryId === c.id)) return;
        s.categories.splice(i, 1);
        if (prodFilter.cat === c.id) prodFilter.cat = '';
        save(); render(); toast('Categoria removida.');
      }
    });
    host.addEventListener('submit', e => {
      e.preventDefault();
      const s = st(); const inp = e.target.cname; const name = inp.value.trim(); if (!name) return;
      let id = slug(name), k = 2; while (s.categories.some(c => c.id === id)) id = slug(name) + '-' + k++;
      s.categories.push({ id, name }); save(); render(); toast('Categoria criada.');
      host.querySelector('[name=cname]').focus();
    });
  }

  function openBulk() {
    const s = st();
    const body = `
      <form class="adm-form" novalidate>
        <div class="adm-formgrid">
          ${field('Aplicar em', `<select class="adm-input" name="cat"><option value="">Todas as categorias</option>${s.categories.map(c => `<option value="${esc(c.id)}" ${prodFilter.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`)}
          ${field('Tipo', `<select class="adm-input" name="mode"><option value="pct">Percentual (%)</option><option value="abs">Valor fixo (R$)</option></select>`)}
          ${field('Ajuste', `<input class="adm-input" name="amount" type="number" step="0.01" value="10">`, 'Use valor negativo para baixar (ex.: -5).')}
          <label class="adm-field adm-check"><input type="checkbox" name="r90"> <span>Arredondar para final ,90</span></label>
        </div>
        <div class="adm-bulkprev" data-prev></div>
      </form>`;
    const m = openModal({ title: 'Reajuste de preços em massa', body, footer: `<button type="button" class="adm-btn adm-btn-ghost" data-close>Cancelar</button><button type="button" class="adm-btn adm-btn-primary" data-apply>Aplicar reajuste</button>` });
    const f = m.el.querySelector('form');
    const calc = () => {
      const amt = num(f.amount.value);
      return st().products.filter(p => !f.cat.value || p.categoryId === f.cat.value).map(p => {
        let n = f.mode.value === 'pct' ? Number(p.price) * (1 + amt / 100) : Number(p.price) + amt;
        if (f.r90.checked) n = Math.max(0.9, Math.floor(n) + 0.9);
        return { p, n: Math.max(0.01, r2(n)) };
      });
    };
    const prev = () => {
      const list = calc();
      m.el.querySelector('[data-prev]').innerHTML = `<p class="adm-label">Prévia (${list.length} produtos)</p><ul class="adm-list">${list.slice(0, 6).map(x => `<li class="adm-li"><span class="adm-li-main">${esc(x.p.name)}</span><span class="adm-li-end"><s class="adm-muted">${brl(x.p.price)}</s> → <strong>${brl(x.n)}</strong></span></li>`).join('')}</ul>${list.length > 6 ? `<p class="adm-muted adm-small">e mais ${list.length - 6}…</p>` : ''}`;
    };
    f.addEventListener('input', prev); f.addEventListener('change', prev); prev();
    m.el.querySelector('[data-apply]').addEventListener('click', async () => {
      const list = calc(); if (!list.length) return;
      if (!await confirmBox(`Alterar o preço de ${list.length} produto${list.length > 1 ? 's' : ''}?`, { ok: 'Aplicar' })) return;
      list.forEach(x => { x.p.price = x.n; if (x.p.oldPrice && Number(x.p.oldPrice) <= x.n) x.p.oldPrice = null; });
      save(); m.close(); renderProductList(); toast(`Preços de ${list.length} produtos atualizados.`);
    });
  }

  /* ----------------------------------------------------------- estoque */
  const stockFilter = { q: '', st: 'todos' };
  function logStock(productId, deltaQ, reason) {
    st().stockLog.push({ at: new Date().toISOString(), productId, delta: deltaQ, reason });
  }
  function setStock(id, newVal, reason) {
    const p = Store().product(id); if (!p) return;
    newVal = Math.max(0, Math.round(newVal));
    const dq = newVal - (Number(p.stock) || 0); if (!dq) return;
    logStock(id, dq, reason);
    Store().updateProduct(id, { stock: newVal });
  }
  function renderStock() {
    const s = st();
    const prods = s.products;
    const cnt = { todos: prods.length, baixo: prods.filter(p => stockStatus(p) === 'baixo').length, esgotado: prods.filter(p => stockStatus(p) === 'esgotado').length };
    content.innerHTML = `
      <div data-stockkpis>${stockKpisHtml()}</div>
      <div class="adm-toolbar">
        <label class="adm-search">${ic('search')}<span class="sr-only">Buscar no estoque</span><input class="adm-input" type="search" placeholder="Buscar…" data-f="q" value="${esc(stockFilter.q)}"></label>
        <div class="adm-seg" role="group" aria-label="Filtrar por situação">
          ${['todos', 'baixo', 'esgotado'].map(k => `<button type="button" class="adm-segbtn ${stockFilter.st === k ? 'adm-on' : ''}" data-sf="${k}" aria-pressed="${stockFilter.st === k}">${{ todos: 'Todos', baixo: 'Baixo', esgotado: 'Esgotado' }[k]} <span>${cnt[k]}</span></button>`).join('')}
        </div>
        <div class="adm-toolbar-acts"><button type="button" class="adm-btn adm-btn-primary" data-act="entry">${ic('plus')} Entrada de mercadoria</button></div>
      </div>
      <div class="adm-tablewrap" id="adm-stocktable"></div>
      <section class="adm-card adm-mt">
        <div class="adm-cardhead"><h3 class="adm-h4">${ic('clock')} Movimentações</h3><span class="adm-muted adm-small">Saídas de pedidos são lançadas automaticamente</span></div>
        <div class="adm-tablewrap">${stockHistoryHtml()}</div>
      </section>`;
    renderStockTable();
    content.oninput = e => { if (e.target.dataset.f === 'q') { stockFilter.q = e.target.value; renderStockTable(); } };
    content.onchange = e => {
      const t = e.target; const row = t.closest('[data-pid]'); if (!row) return;
      const id = row.dataset.pid;
      if (t.dataset.sk === 'stock') { setStock(id, num(t.value), 'Ajuste de inventário'); toast('Estoque ajustado.'); rerenderStockRow(id); }
      if (t.dataset.sk === 'min') { Store().updateProduct(id, { minStock: Math.max(0, Math.round(num(t.value))) }); toast('Mínimo atualizado.'); rerenderStockRow(id); }
    };
    content.onkeydown = e => { if (e.key === 'Enter' && e.target.dataset.sk) e.target.blur(); };
    content.onclick = e => {
      const sf = e.target.closest('[data-sf]'); if (sf) { stockFilter.st = sf.dataset.sf; renderStock(); return; }
      const b = e.target.closest('[data-act]'); if (!b) return;
      const row = b.closest('[data-pid]'); const id = row && row.dataset.pid;
      if (b.dataset.act === 'entry') openEntry(id);
      if (b.dataset.act === 'inc' || b.dataset.act === 'dec') {
        const p = Store().product(id);
        setStock(id, (Number(p.stock) || 0) + (b.dataset.act === 'inc' ? 1 : -1), 'Ajuste rápido');
        renderStock();
        const nb = content.querySelector(`[data-pid="${CSS.escape(id)}"] [data-act="${b.dataset.act}"]`); if (nb) nb.focus();
      }
    };
  }
  function stockKpisHtml() {
    const prods = st().products;
    const baixo = prods.filter(p => stockStatus(p) === 'baixo').length, esg = prods.filter(p => stockStatus(p) === 'esgotado').length;
    const value = prods.reduce((a, p) => a + Math.max(0, Number(p.stock) || 0) * (Number(p.cost) || 0), 0);
    return `<div class="adm-kpis adm-kpis-3">
        ${kpi('Itens cadastrados', String(prods.length), `${prods.reduce((a, p) => a + Math.max(0, Number(p.stock) || 0), 0)} unidades`)}
        ${kpi('Estoque baixo', String(baixo), 'no mínimo ou abaixo', baixo ? 'adm-kpi-warn' : '')}
        ${kpi('Esgotados', String(esg), `valor em estoque ${brl(value)}`, esg ? 'adm-kpi-bad' : '')}
      </div>`;
  }
  function rerenderStockRow(id) {
    const k = content && content.querySelector('[data-stockkpis]'); if (k) k.innerHTML = stockKpisHtml();
    const row = content && content.querySelector(`#adm-stocktable [data-pid="${CSS.escape(id)}"]`);
    const p = Store().product(id); if (!row || !p) return;
    row.className = 'adm-row-' + stockStatus(p);
    const cells = row.querySelectorAll('td');
    if (cells[3]) cells[3].innerHTML = stockPill(p);
    const si = row.querySelector('[data-sk="stock"]'); if (si && document.activeElement !== si) si.value = Number(p.stock) || 0;
    updateBadges();
  }
  function renderStockTable() {
    const host = content.querySelector('#adm-stocktable'); if (!host) return;
    const s = st(); const q = stockFilter.q.trim().toLowerCase();
    const list = s.products.filter(p => (stockFilter.st === 'todos' || stockStatus(p) === stockFilter.st) && (!q || p.name.toLowerCase().includes(q)))
      .sort((a, b) => ({ esgotado: 0, baixo: 1, ok: 2 }[stockStatus(a)] - { esgotado: 0, baixo: 1, ok: 2 }[stockStatus(b)]) || a.name.localeCompare(b.name));
    host.innerHTML = list.length ? `
      <table class="adm-table adm-table-stock">
        <thead><tr><th scope="col">Produto</th><th scope="col">Estoque atual</th><th scope="col">Mínimo</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
        <tbody>${list.map(p => `
          <tr data-pid="${esc(p.id)}" class="adm-row-${stockStatus(p)}">
            <td><div class="adm-cellprod">${thumb(p.image, p.name, 'adm-thumb-sm')}<span><strong>${esc(p.name)}</strong><small>${esc(catName(p.categoryId))}${p.active === false ? ' · oculto' : ''}</small></span></div></td>
            <td data-label="Estoque"><div class="adm-stepper">
              <button type="button" class="adm-iconbtn adm-iconbtn-sm" data-act="dec" aria-label="Diminuir estoque de ${esc(p.name)}">${ic('minus')}</button>
              <input class="adm-input adm-input-num" type="number" inputmode="numeric" step="1" min="0" value="${Number(p.stock) || 0}" data-sk="stock" aria-label="Estoque de ${esc(p.name)}">
              <button type="button" class="adm-iconbtn adm-iconbtn-sm" data-act="inc" aria-label="Aumentar estoque de ${esc(p.name)}">${ic('plus')}</button>
            </div></td>
            <td data-label="Mínimo"><input class="adm-input adm-input-num" type="number" inputmode="numeric" step="1" min="0" value="${Number(p.minStock) || 0}" data-sk="min" aria-label="Estoque mínimo de ${esc(p.name)}"></td>
            <td>${stockPill(p)}</td>
            <td><button type="button" class="adm-btn adm-btn-soft adm-btn-sm" data-act="entry">Entrada</button></td>
          </tr>`).join('')}</tbody>
      </table>` : '<p class="adm-empty">Nenhum produto neste filtro.</p>';
  }
  function stockHistoryHtml() {
    const s = st();
    const manual = s.stockLog.map(l => ({ at: ts(l), name: (Store().product(l.productId) || {}).name || 'Produto removido', delta: Number(l.delta) || 0, reason: l.reason || '' }));
    const fromOrders = [];
    s.orders.filter(o => !o.demo).forEach(o => (o.items || []).forEach(it => fromOrders.push({ at: ts(o), name: it.name || (Store().product(it.productId) || {}).name || 'Produto', delta: -(Number(it.qty) || 0), reason: 'Pedido #' + o.id, auto: true })));
    const all = manual.concat(fromOrders).sort((a, b) => b.at - a.at).slice(0, 60);
    if (!all.length) return '<p class="adm-empty">Nenhuma movimentação ainda. Use “Entrada de mercadoria” quando chegar reposição.</p>';
    return `<table class="adm-table adm-table-compact"><thead><tr><th scope="col">Quando</th><th scope="col">Produto</th><th scope="col">Qtd.</th><th scope="col">Motivo</th></tr></thead><tbody>
      ${all.map(l => `<tr><td class="adm-nowrap">${fmtDT(l.at)}</td><td>${esc(l.name)}</td><td class="adm-nowrap ${l.delta > 0 ? 'adm-pos' : 'adm-neg'}"><strong>${l.delta > 0 ? '+' : ''}${l.delta}</strong></td><td>${esc(l.reason)}${l.auto ? ' <span class="adm-pill adm-pill-mute">auto</span>' : ''}</td></tr>`).join('')}
    </tbody></table>`;
  }
  function openEntry(preId) {
    const s = st();
    const opts = s.products.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${esc(p.id)}" ${p.id === preId ? 'selected' : ''}>${esc(p.name)} (${Number(p.stock) || 0} em estoque)</option>`).join('');
    const m = openModal({
      title: 'Entrada de mercadoria',
      body: `<form class="adm-form" novalidate><div class="adm-formgrid">
        ${field('Produto', `<select class="adm-input" name="pid">${opts}</select>`, '', 'adm-span2')}
        ${field('Quantidade recebida', `<input class="adm-input" name="qty" type="number" inputmode="numeric" min="1" step="1" value="10" required>`)}
        ${field('Novo custo unitário (R$)', `<input class="adm-input" name="cost" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Opcional">`, 'Atualiza o custo do produto.')}
        ${field('Observação', `<input class="adm-input" name="note" placeholder="Ex.: NF 1234 — Fornecedor Pão & Cia" maxlength="120">`, '', 'adm-span2')}
      </div><p class="adm-formerr" role="alert"></p></form>`,
      footer: `<button type="button" class="adm-btn adm-btn-ghost" data-close>Cancelar</button><button type="button" class="adm-btn adm-btn-primary" data-ok>Registrar entrada</button>`
    });
    const f = m.el.querySelector('form');
    const go = () => {
      const qty = Math.round(num(f.qty.value));
      if (!(qty > 0)) { m.el.querySelector('.adm-formerr').textContent = 'Informe uma quantidade maior que zero.'; f.qty.focus(); return; }
      const p = Store().product(f.pid.value); if (!p) return;
      const note = f.note.value.trim();
      logStock(p.id, qty, 'Entrada de mercadoria' + (note ? ' — ' + note : ''));
      const patch = { stock: (Number(p.stock) || 0) + qty };
      if (f.cost.value.trim()) patch.cost = r2(num(f.cost.value));
      Store().updateProduct(p.id, patch);
      m.close(); toast(`+${qty} ${p.name}`); if (tab === 'stock') renderStock();
    };
    f.addEventListener('submit', e => { e.preventDefault(); go(); });
    m.el.querySelector('[data-ok]').addEventListener('click', go);
  }

  /* ------------------------------------------------------- financeiro */
  let finPeriod = '30';
  const charts = [];
  let chartPromise = null, chartState = window.Chart ? 'ready' : 'idle';
  function destroyCharts() { charts.forEach(c => { try { c.destroy(); } catch (e) {} }); charts.length = 0; }
  function loadChartJs() {
    if (window.Chart) { chartState = 'ready'; return Promise.resolve(true); }
    if (chartPromise) return chartPromise;
    chartState = 'loading';
    chartPromise = new Promise(res => {
      const sc = document.createElement('script');
      sc.src = CHART_SRC; sc.async = true;
      const done = ok => { clearTimeout(to); chartState = ok && window.Chart ? 'ready' : 'failed'; if (chartState === 'failed') { chartPromise = null; sc.remove(); } res(chartState === 'ready'); };
      const to = setTimeout(() => done(false), 8000);
      sc.onload = () => done(true);
      sc.onerror = () => done(false);
      document.head.appendChild(sc);
    });
    return chartPromise;
  }
  function tokens() {
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim();
    return { brand: g('--brand') || '#ff7a1a', brand2: g('--brand-2') || '#ffc23d', text: g('--text') || '#fff4e8', muted: g('--muted') || '#b9a693', line: g('--line') || 'rgba(255,255,255,.1)', ok: g('--ok') || '#3ddc84', danger: g('--danger') || '#ff4d4d', surface: g('--surface') || '#1a140f', font: g('--font-body') || 'Inter, sans-serif' };
  }
  const palette = T => [T.brand, T.brand2, T.ok, '#5aa9ff', '#ff6fa8', '#a98bff', '#4dd6c7', T.danger, T.muted];

  function finRange() {
    const today = startOfDay(Date.now());
    if (finPeriod === 'all') {
      const first = st().orders.reduce((m, o) => Math.min(m, ts(o)), today);
      return { from: 0, days: Math.min(90, Math.max(1, Math.round((today - startOfDay(first)) / DAY) + 1)) };
    }
    const n = parseInt(finPeriod, 10);
    return { from: today - (n - 1) * DAY, days: n };
  }
  function finData() {
    const s = st();
    const { from, days } = finRange();
    const list = ordersSince(from);
    const valid = list.filter(isValid);
    const agg = aggregate(list);
    const expenses = s.expenses.filter(x => ts(x) >= from);
    const expTotal = expenses.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    // por dia
    const today = startOfDay(Date.now());
    const dayLabels = [], dayVals = [], idx = {};
    for (let i = days - 1; i >= 0; i--) { const t = today - i * DAY; idx[dayKey(t)] = dayLabels.length; dayLabels.push(new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })); dayVals.push(0); }
    valid.forEach(o => { const k = idx[dayKey(ts(o))]; if (k != null) dayVals[k] += Number(o.total) || 0; });
    // por categoria / produto
    const byCat = {}, byProd = {};
    valid.forEach(o => (o.items || []).forEach(it => {
      const p = Store().product(it.productId);
      const rev = (Number(it.unitPrice) || 0) * (Number(it.qty) || 0);
      const cn = p ? catName(p.categoryId) : 'Outros';
      byCat[cn] = (byCat[cn] || 0) + rev;
      const pn = (p && p.name) || it.name || 'Produto';
      const e = byProd[pn] || (byProd[pn] = { rev: 0, qty: 0 }); e.rev += rev; e.qty += Number(it.qty) || 0;
    }));
    let cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    if (cats.length > 7) cats = cats.slice(0, 6).concat([['Outras', cats.slice(6).reduce((a, x) => a + x[1], 0)]]);
    const top = Object.entries(byProd).sort((a, b) => b[1].rev - a[1].rev).slice(0, 10);
    const byPay = {}; valid.forEach(o => { const m = PAY[(o.payment || {}).method] || 'Outro'; byPay[m] = (byPay[m] || 0) + (Number(o.total) || 0); });
    const pays = Object.entries(byPay).sort((a, b) => b[1] - a[1]);
    const hours = Array(24).fill(0); valid.forEach(o => { hours[new Date(ts(o)).getHours()]++; });
    let h0 = hours.findIndex(v => v > 0), h1 = 23 - hours.slice().reverse().findIndex(v => v > 0);
    if (h0 < 0) { h0 = 10; h1 = 23; }
    h0 = Math.min(h0, 10); h1 = Math.max(h1, 23);
    return { list, agg, expenses, expTotal, dayLabels, dayVals, cats, top, pays, hours: hours.slice(h0, h1 + 1), hourLabels: Array.from({ length: h1 - h0 + 1 }, (_, i) => (h0 + i) + 'h') };
  }

  function renderFinance() {
    const D = finData();
    const A = D.agg;
    const net = A.revenue - A.cost - D.expTotal;
    const periods = [['7', '7 dias'], ['14', '14 dias'], ['30', '30 dias'], ['90', '90 dias'], ['all', 'Tudo']];
    const expCats = ['Insumos', 'Embalagens', 'Aluguel', 'Funcionários', 'Contas (água, luz, gás)', 'Marketing', 'Taxas e impostos', 'Outros'];
    content.innerHTML = `
      <div class="adm-toolbar">
        <div class="adm-seg" role="group" aria-label="Período">
          ${periods.map(([v, l]) => `<button type="button" class="adm-segbtn ${finPeriod === v ? 'adm-on' : ''}" data-period="${v}" aria-pressed="${finPeriod === v}">${l}</button>`).join('')}
        </div>
        <div class="adm-toolbar-acts"><button type="button" class="adm-btn adm-btn-soft" data-act="csv">${ic('download')} Exportar pedidos (CSV)</button></div>
      </div>
      <div class="adm-chartnote" data-chartnote hidden></div>
      <div class="adm-kpis">
        ${kpi('Receita', brl(A.revenue), `${A.count} pedidos`)}
        ${kpi('Ticket médio', brl(A.ticket), 'por pedido')}
        ${kpi('Custo dos produtos', brl(A.cost), A.revenue ? pct(A.cost / A.revenue) + ' da receita' : '—')}
        ${kpi('Despesas', brl(D.expTotal), `${D.expenses.length} lançamento${D.expenses.length === 1 ? '' : 's'}`)}
        ${kpi('Lucro', brl(net), A.revenue ? 'margem ' + pct(net / A.revenue) : '—', net >= 0 ? 'adm-kpi-ok' : 'adm-kpi-bad')}
      </div>
      <div class="adm-charts">
        <section class="adm-card adm-chartcard adm-span-all"><h3 class="adm-h4">Faturamento por dia</h3><div class="adm-chart adm-chart-tall" data-chart="days"></div></section>
        <section class="adm-card adm-chartcard"><h3 class="adm-h4">Vendas por categoria</h3><div class="adm-chart" data-chart="cats"></div></section>
        <section class="adm-card adm-chartcard"><h3 class="adm-h4">Formas de pagamento</h3><div class="adm-chart" data-chart="pay"></div></section>
        <section class="adm-card adm-chartcard"><h3 class="adm-h4">Top 10 produtos</h3><div class="adm-chart adm-chart-tall" data-chart="top"></div></section>
        <section class="adm-card adm-chartcard"><h3 class="adm-h4">Pedidos por horário</h3><div class="adm-chart adm-chart-tall" data-chart="hours"></div></section>
      </div>
      <div class="adm-grid2 adm-mt">
        <section class="adm-card">
          <h3 class="adm-h4">Resultado do período (DRE simplificada)</h3>
          <table class="adm-dre">
            <tr><th scope="row">Receita de vendas</th><td>${brl(A.revenue)}</td></tr>
            <tr class="adm-dre-sub"><th scope="row">(−) Custo dos produtos vendidos</th><td>${brl(-A.cost)}</td></tr>
            <tr class="adm-dre-tot"><th scope="row">= Lucro bruto</th><td>${brl(A.revenue - A.cost)}</td></tr>
            <tr class="adm-dre-sub"><th scope="row">(−) Despesas</th><td>${brl(-D.expTotal)}</td></tr>
            <tr class="adm-dre-final ${net >= 0 ? 'adm-pos' : 'adm-neg'}"><th scope="row">= Lucro líquido</th><td>${brl(net)}</td></tr>
          </table>
          <p class="adm-hint">O custo usa o “custo” cadastrado em cada produto. Pedidos cancelados não entram.</p>
        </section>
        <section class="adm-card">
          <h3 class="adm-h4">Despesas</h3>
          <form class="adm-expform" data-expform novalidate>
            ${field('Descrição', `<input class="adm-input" name="desc" placeholder="Ex.: Compra de carne" maxlength="80" required>`, '', 'adm-span2')}
            ${field('Valor (R$)', `<input class="adm-input" name="amount" type="number" inputmode="decimal" min="0" step="0.01" required>`)}
            ${field('Data', `<input class="adm-input" name="date" type="date" value="${dayKey(Date.now())}">`)}
            ${field('Categoria', `<select class="adm-input" name="category">${expCats.map(c => `<option>${c}</option>`).join('')}</select>`)}
            <button type="submit" class="adm-btn adm-btn-primary adm-expbtn">${ic('plus')} Lançar</button>
          </form>
          ${D.expenses.length ? `<ul class="adm-list adm-explist">${D.expenses.slice().sort((a, b) => ts(b) - ts(a)).map(x => `
            <li class="adm-li"><span class="adm-li-main"><strong>${esc(x.desc)}</strong><small>${fmtD(ts(x))} · ${esc(x.category || 'Outros')}</small></span><span class="adm-li-end"><strong class="adm-neg">${brl(-x.amount)}</strong><button type="button" class="adm-iconbtn adm-iconbtn-sm adm-iconbtn-danger" data-expdel="${esc(x.id || x.at)}" aria-label="Excluir despesa ${esc(x.desc)}">${ic('trash')}</button></span></li>`).join('')}</ul>`
            : '<p class="adm-empty">Nenhuma despesa no período.</p>'}
        </section>
      </div>`;
    drawAllCharts(D);
    if (chartState !== 'ready') {
      const note = content.querySelector('[data-chartnote]');
      const showNote = () => {
        if (!note) return;
        if (chartState === 'loading') { note.hidden = false; note.innerHTML = '<span class="adm-spin" aria-hidden="true"></span> Carregando gráficos interativos…'; }
        else if (chartState === 'failed') { note.hidden = false; note.innerHTML = `${ic('alert')} <span>Sem conexão com a biblioteca de gráficos — exibindo a versão simplificada.</span> <button type="button" class="adm-link" data-act="retrychart">Tentar de novo</button>`; }
        else note.hidden = true;
      };
      loadChartJs().then(() => { if (tab === 'finance' && content && content.contains(note)) { showNote(); if (chartState === 'ready') { destroyCharts(); drawAllCharts(D); } } });
      showNote();
    }
    content.onclick = async e => {
      const pb = e.target.closest('[data-period]'); if (pb) { finPeriod = pb.dataset.period; renderFinance(); return; }
      const b = e.target.closest('[data-act]');
      if (b && b.dataset.act === 'csv') exportCSV(D.list);
      if (b && b.dataset.act === 'retrychart') { chartState = 'idle'; renderFinance(); }
      const del = e.target.closest('[data-expdel]');
      if (del) {
        const s = st(); const key = del.dataset.expdel;
        const x = s.expenses.find(y => String(y.id || y.at) === key);
        if (x && await confirmBox(`Excluir a despesa “${esc(x.desc)}” (${brl(x.amount)})?`, { ok: 'Excluir', danger: true })) {
          s.expenses = s.expenses.filter(y => y !== x); save(); renderFinance(); toast('Despesa excluída.');
        }
      }
    };
    content.onsubmit = e => {
      if (!e.target.matches('[data-expform]')) return;
      e.preventDefault();
      const f = e.target;
      const desc = f.desc.value.trim(); const amount = r2(num(f.amount.value));
      if (!desc) { toast('Informe a descrição da despesa.', 'err'); f.desc.focus(); return; }
      if (!(amount > 0)) { toast('Informe o valor da despesa.', 'err'); f.amount.focus(); return; }
      const dt = f.date.value ? new Date(f.date.value + 'T12:00:00') : new Date();
      st().expenses.push({ id: uid('e'), at: dt.toISOString(), desc, amount, category: f.category.value });
      save(); renderFinance(); toast('Despesa lançada.');
    };
  }
  function drawAllCharts(D) {
    const q = k => content.querySelector(`[data-chart="${k}"]`);
    drawChart(q('days'), { type: 'bar', labels: D.dayLabels, data: D.dayVals, money: true, label: 'Faturamento' });
    drawChart(q('cats'), { type: 'doughnut', labels: D.cats.map(x => x[0]), data: D.cats.map(x => r2(x[1])), money: true });
    drawChart(q('pay'), { type: 'doughnut', labels: D.pays.map(x => x[0]), data: D.pays.map(x => r2(x[1])), money: true });
    drawChart(q('top'), { type: 'hbar', labels: D.top.map(x => x[0]), data: D.top.map(x => r2(x[1].rev)), extra: D.top.map(x => x[1].qty + ' un.'), money: true, label: 'Receita' });
    drawChart(q('hours'), { type: 'bar', labels: D.hourLabels, data: D.hours, money: false, label: 'Pedidos', color: 'brand2' });
  }
  function drawChart(host, spec) {
    if (!host) return;
    host.innerHTML = '';
    if (!spec.data.length || spec.data.every(v => !v)) { host.innerHTML = '<p class="adm-empty adm-chartempty">Sem dados no período.</p>'; return; }
    if (window.Chart && chartState === 'ready') {
      try { return drawChartJs(host, spec); } catch (e) { console.error(e); host.innerHTML = ''; }
    }
    drawFallback(host, spec);
  }
  const fmtVal = (v, money) => money ? brl(v) : String(v);
  const shortMoney = v => v >= 1000 ? 'R$ ' + (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',') + ' mil' : 'R$ ' + Math.round(v);
  function drawChartJs(host, spec) {
    const T = tokens();
    const Chart = window.Chart;
    const cv = document.createElement('canvas');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', (spec.label || 'Gráfico') + ': ' + spec.labels.map((l, i) => l + ' ' + fmtVal(spec.data[i], spec.money)).slice(0, 12).join(', '));
    host.appendChild(cv);
    Chart.defaults.font.family = T.font;
    Chart.defaults.color = T.muted;
    const tooltip = {
      backgroundColor: T.surface, titleColor: T.text, bodyColor: T.text, borderColor: T.line, borderWidth: 1, padding: 10, cornerRadius: 10,
      callbacks: { label: c => ' ' + fmtVal(c.parsed.y != null && spec.type !== 'hbar' ? c.parsed.y : (spec.type === 'hbar' ? c.parsed.x : c.parsed), spec.money) + (spec.extra ? ' · ' + spec.extra[c.dataIndex] : '') }
    };
    let cfg;
    if (spec.type === 'doughnut') {
      const P = palette(T);
      cfg = {
        type: 'doughnut',
        data: { labels: spec.labels, datasets: [{ data: spec.data, backgroundColor: spec.labels.map((_, i) => P[i % P.length]), borderColor: T.surface, borderWidth: 3, hoverOffset: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: T.text, boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 12 } }, tooltip: Object.assign({}, tooltip, { callbacks: { label: c => { const tot = c.dataset.data.reduce((a, b) => a + b, 0); return ` ${c.label}: ${fmtVal(c.parsed, spec.money)} (${pct(c.parsed / tot)})`; } } }) } }
      };
    } else {
      const horizontal = spec.type === 'hbar';
      const color = spec.color === 'brand2' ? T.brand2 : T.brand;
      const valueAxis = { beginAtZero: true, grid: { color: T.line }, border: { display: false }, ticks: { color: T.muted, callback: v => spec.money ? shortMoney(v) : v, maxTicksLimit: 6, precision: spec.money ? undefined : 0 } };
      const catAxis = { grid: { display: false }, border: { color: T.line }, ticks: { color: horizontal ? T.text : T.muted, autoSkip: true, maxRotation: 0, callback: function (v) { const l = this.getLabelForValue(v); return horizontal && l.length > 18 ? l.slice(0, 17) + '…' : l; } } };
      cfg = {
        type: 'bar',
        data: { labels: spec.labels, datasets: [{ label: spec.label, data: spec.data, backgroundColor: color, hoverBackgroundColor: T.brand2, borderRadius: 6, maxBarThickness: horizontal ? 22 : 28 }] },
        options: { indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip }, scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis } }
      };
    }
    charts.push(new Chart(cv, cfg));
  }
  function drawFallback(host, spec) {
    const T = tokens();
    const max = Math.max(...spec.data, 0) || 1;
    if (spec.type === 'doughnut') {
      const P = palette(T);
      const tot = spec.data.reduce((a, b) => a + b, 0) || 1;
      const R = 15.9155; let acc = 0;
      const segs = spec.data.map((v, i) => { const p = v / tot * 100; const s = `<circle r="${R}" cx="21" cy="21" fill="none" stroke="${P[i % P.length]}" stroke-width="6" stroke-dasharray="${Math.max(0, p - 0.6).toFixed(2)} ${(100 - Math.max(0, p - 0.6)).toFixed(2)}" stroke-dashoffset="${(25 - acc).toFixed(2)}"><title>${esc(spec.labels[i])}: ${esc(fmtVal(v, spec.money))}</title></circle>`; acc += p; return s; }).join('');
      host.innerHTML = `<div class="adm-fb-donut">
        <svg viewBox="0 0 42 42" role="img" aria-label="${esc(spec.labels.map((l, i) => l + ' ' + pct(spec.data[i] / tot)).join(', '))}"><circle r="${R}" cx="21" cy="21" fill="none" stroke="${T.line}" stroke-width="6"/>${segs}<text x="21" y="20.5" text-anchor="middle" class="adm-fb-dt">${esc(spec.money ? shortMoney(tot) : tot)}</text><text x="21" y="25" text-anchor="middle" class="adm-fb-ds">total</text></svg>
        <ul class="adm-fb-legend">${spec.labels.map((l, i) => `<li><span class="adm-fb-sw" style="background:${P[i % P.length]}"></span><span class="adm-fb-ll">${esc(l)}</span><strong>${pct(spec.data[i] / tot)}</strong></li>`).join('')}</ul>
      </div>`;
      return;
    }
    if (spec.type === 'hbar') {
      host.innerHTML = `<ul class="adm-fb-hbars" aria-label="${esc(spec.label || '')}">${spec.labels.map((l, i) => `
        <li><span class="adm-fb-hl" title="${esc(l)}">${esc(l)}</span><span class="adm-fb-track"><span class="adm-fb-hbar" style="width:${(spec.data[i] / max * 100).toFixed(1)}%"></span></span><span class="adm-fb-hv">${esc(fmtVal(spec.data[i], spec.money))}${spec.extra ? `<small>${esc(spec.extra[i])}</small>` : ''}</span></li>`).join('')}</ul>`;
      return;
    }
    const n = spec.labels.length;
    const every = n > 20 ? Math.ceil(n / 7) : n > 12 ? 2 : 1;
    const color = spec.color === 'brand2' ? 'var(--brand-2)' : 'var(--brand)';
    host.innerHTML = `<div class="adm-fb-bars-wrap">
      <span class="adm-fb-max">${esc(spec.money ? shortMoney(max) : max)}</span>
      <div class="adm-fb-bars" role="img" aria-label="${esc((spec.label || '') + ': ' + spec.labels.map((l, i) => l + ' ' + fmtVal(spec.data[i], spec.money)).join(', '))}">
        ${spec.data.map((v, i) => `<span class="adm-fb-col" title="${esc(spec.labels[i])}: ${esc(fmtVal(v, spec.money))}"><span class="adm-fb-bar" style="height:${Math.max(v ? 2 : 0, v / max * 100).toFixed(1)}%;background:${color}"></span></span>`).join('')}
      </div>
      <div class="adm-fb-axis">${spec.labels.map((l, i) => `<span>${i % every === 0 ? esc(l) : ''}</span>`).join('')}</div>
    </div>`;
  }
  function exportCSV(list) {
    const rows = [['Pedido', 'Data', 'Status', 'Modo', 'Cliente', 'CPF', 'Telefone', 'Pagamento', 'Itens', 'Subtotal', 'Entrega', 'Desconto', 'Total', 'Demonstração']];
    const money = v => (Number(v) || 0).toFixed(2).replace('.', ',');
    list.slice().sort((a, b) => ts(a) - ts(b)).forEach(o => {
      const c = o.customer || {};
      rows.push([o.id, new Date(ts(o)).toLocaleString('pt-BR'), STATUS[o.status] || o.status, o.mode === 'retirada' ? 'Retirada' : 'Entrega', c.name || '', c.cpf || '', c.phone || '', PAY[(o.payment || {}).method] || '',
        (o.items || []).map(i => `${i.qty}x ${i.name}`).join(' | '), money(o.subtotal), money(o.deliveryFee), money(o.discount), money(o.total), o.demo ? 'sim' : '']);
    });
    const csv = '﻿' + rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
    download(`pedidos-gulos-${dayKey(Date.now())}.csv`, csv, 'text/csv;charset=utf-8');
    toast(`${list.length} pedidos exportados.`);
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ------------------------------------------------------------ pedidos */
  let orderFilter = 'todos', orderQ = '', orderOpen = null, orderLimit = 30;
  const FLOW_OPEN = ['recebido', 'preparando', 'saiu', 'pronto'];
  function nextStatus(o) {
    const s = o.status || 'recebido';
    if (s === 'recebido') return 'preparando';
    if (s === 'preparando') return o.mode === 'retirada' ? 'pronto' : 'saiu';
    if (s === 'saiu' || s === 'pronto') return 'entregue';
    return null;
  }
  const NEXT_LABEL = { preparando: 'Começar preparo', saiu: 'Saiu para entrega', pronto: 'Pronto para retirada', entregue: 'Marcar como entregue' };
  function renderOrders() {
    const s = st();
    const groups = { todos: () => true, abertos: o => FLOW_OPEN.includes(o.status || 'recebido'), recebido: o => (o.status || 'recebido') === 'recebido', preparando: o => o.status === 'preparando', saiu: o => o.status === 'saiu' || o.status === 'pronto', entregue: o => o.status === 'entregue', cancelado: o => o.status === 'cancelado' };
    const labels = { todos: 'Todos', abertos: 'Em aberto', recebido: 'Recebidos', preparando: 'Preparando', saiu: 'Saiu/Pronto', entregue: 'Entregues', cancelado: 'Cancelados' };
    const q = orderQ.trim().toLowerCase();
    const list = s.orders.filter(groups[orderFilter] || groups.todos).filter(o => !q || [o.id, (o.customer || {}).name, (o.customer || {}).phone, (o.customer || {}).cpf].join(' ').toLowerCase().includes(q)).sort((a, b) => ts(b) - ts(a));
    content.innerHTML = `
      <div class="adm-toolbar">
        <label class="adm-search">${ic('search')}<span class="sr-only">Buscar pedido</span><input class="adm-input" type="search" placeholder="Buscar por nº, nome, telefone ou CPF" data-f="q" value="${esc(orderQ)}"></label>
      </div>
      <div class="adm-chipsbar" role="group" aria-label="Filtrar por status">
        ${Object.keys(groups).map(k => `<button type="button" class="adm-segbtn ${orderFilter === k ? 'adm-on' : ''}" data-of="${k}" aria-pressed="${orderFilter === k}">${labels[k]} <span>${s.orders.filter(groups[k]).length}</span></button>`).join('')}
      </div>
      <div class="adm-orders">${list.length ? list.slice(0, orderLimit).map(orderCard).join('') + (list.length > orderLimit ? `<button type="button" class="adm-btn adm-btn-soft adm-btn-block" data-more>Mostrar mais (${list.length - orderLimit})</button>` : '') : '<p class="adm-empty">Nenhum pedido aqui ainda.</p>'}</div>`;
    if (orderOpen) { const el = content.querySelector(`[data-oid="${CSS.escape(orderOpen)}"]`); if (el) setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 30); }
    let qTimer;
    content.oninput = e => { if (e.target.dataset.f === 'q') { orderQ = e.target.value; clearTimeout(qTimer); qTimer = setTimeout(() => { renderOrders(); const i = content.querySelector('[data-f="q"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 200); } };
    content.onchange = e => {
      if (e.target.dataset.setstatus != null) { const id = e.target.closest('[data-oid]').dataset.oid; changeStatus(id, e.target.value); }
    };
    content.onclick = async e => {
      const of = e.target.closest('[data-of]'); if (of) { orderFilter = of.dataset.of; orderLimit = 30; renderOrders(); return; }
      if (e.target.closest('[data-more]')) { orderLimit += 30; renderOrders(); return; }
      const card = e.target.closest('[data-oid]'); if (!card) return;
      const id = card.dataset.oid;
      if (e.target.closest('[data-toggle]')) { orderOpen = orderOpen === id ? null : id; renderOrders(); const t = content.querySelector(`[data-oid="${CSS.escape(id)}"] [data-toggle]`); if (t) t.focus(); return; }
      const nx = e.target.closest('[data-next]'); if (nx) return changeStatus(id, nx.dataset.next);
      if (e.target.closest('[data-cancel]')) return changeStatus(id, 'cancelado');
      if (e.target.closest('[data-receipt]')) return showReceipt(id);
      if (e.target.closest('[data-reissue]')) return reissue(id);
    };
  }
  function orderCard(o) {
    const c = o.customer || {};
    const open = orderOpen === o.id;
    const nItems = (o.items || []).reduce((a, i) => a + (Number(i.qty) || 0), 0);
    const summary = (o.items || []).map(i => `${i.qty}× ${i.name}`).join(', ');
    const nx = nextStatus(o);
    const ad = c.address || {};
    const addr = [ad.street && (ad.street + (ad.number ? ', ' + ad.number : '')), ad.complement, ad.district, ad.city, ad.cep && 'CEP ' + ad.cep].filter(Boolean).join(' · ');
    const geo = c.geo && c.geo.lat != null && c.geo.lng != null ? c.geo : null;
    const phoneD = String(c.phone || '').replace(/\D/g, '');
    const nfe = window.GulosNFe;
    const inv = o.invoice;
    return `
    <article class="adm-order ${open ? 'adm-open' : ''} adm-order-${esc(o.status || 'recebido')}" data-oid="${esc(o.id)}">
      <button type="button" class="adm-orderhead" data-toggle aria-expanded="${open}">
        <span class="adm-orderid">#${esc(o.id)}${o.demo ? ' <span class="adm-pill adm-pill-mute">demo</span>' : ''}</span>
        <span class="adm-ordermain"><strong>${esc(c.name || 'Cliente')}</strong><small>${fmtDT(ts(o))} · ${o.mode === 'retirada' ? 'Retirada' : 'Entrega'} · ${nItems} ${nItems === 1 ? 'item' : 'itens'}</small><small class="adm-ordersum">${esc(summary)}</small></span>
        <span class="adm-orderend"><strong>${brl(o.total)}</strong>${statusPill(o.status)}</span>
        ${ic('down', 'adm-chev')}
      </button>
      ${open ? `
      <div class="adm-orderbody">
        <div class="adm-flow">
          ${nx ? `<button type="button" class="adm-btn adm-btn-primary" data-next="${nx}">${NEXT_LABEL[nx]}</button>` : ''}
          <label class="adm-selwrap adm-flowsel"><span class="sr-only">Alterar status</span><select class="adm-input" data-setstatus>${Object.keys(STATUS).map(k => `<option value="${k}" ${k === (o.status || 'recebido') ? 'selected' : ''}>${STATUS[k]}</option>`).join('')}</select></label>
          ${o.status !== 'cancelado' && o.status !== 'entregue' ? '<button type="button" class="adm-btn adm-btn-ghost adm-btn-dangertext" data-cancel>Cancelar pedido</button>' : ''}
        </div>
        <div class="adm-ordergrid">
          <section class="adm-ordersec">
            <h4 class="adm-label">Cliente</h4>
            <dl class="adm-dl">
              <dt>Nome</dt><dd>${esc(c.name || '—')}</dd>
              <dt>CPF</dt><dd>${esc(c.cpf || '—')}</dd>
              <dt>Telefone</dt><dd>${c.phone ? `<a href="tel:${phoneD}">${esc(c.phone)}</a> · <a href="https://wa.me/${phoneD.length <= 11 ? '55' + phoneD : phoneD}" target="_blank" rel="noopener">WhatsApp</a>` : '—'}</dd>
              ${c.email ? `<dt>E-mail</dt><dd>${esc(c.email)}</dd>` : ''}
              ${o.mode !== 'retirada' ? `<dt>Endereço</dt><dd>${esc(addr || '—')}${ad.reference ? `<br><small class="adm-muted">Ref.: ${esc(ad.reference)}</small>` : ''}</dd>` : '<dt>Modo</dt><dd>Retirada no balcão</dd>'}
              ${geo ? `<dt>Localização</dt><dd><a class="adm-maplink" href="https://www.google.com/maps?q=${encodeURIComponent(geo.lat + ',' + geo.lng)}" target="_blank" rel="noopener">${ic('pin')} Abrir no mapa</a>${geo.accuracy ? ` <small class="adm-muted">(±${Math.round(geo.accuracy)} m)</small>` : ''}</dd>` : ''}
            </dl>
          </section>
          <section class="adm-ordersec">
            <h4 class="adm-label">Itens</h4>
            <ul class="adm-items">${(o.items || []).map(i => `
              <li><span class="adm-iq">${i.qty}×</span><span class="adm-iname"><strong>${esc(i.name)}</strong>
                ${(i.options || []).length ? `<small>${i.options.map(op => esc(op.name) + (op.price ? ' (+' + brl(op.price) + ')' : '')).join(', ')}</small>` : ''}
                ${(i.removed || []).length ? `<small class="adm-neg">Sem: ${i.removed.map(esc).join(', ')}</small>` : ''}
                ${i.note ? `<small class="adm-note">“${esc(i.note)}”</small>` : ''}</span>
                <span class="adm-ip">${brl((Number(i.unitPrice) || 0) * (Number(i.qty) || 0))}</span></li>`).join('')}</ul>
            <dl class="adm-totals">
              <dt>Subtotal</dt><dd>${brl(o.subtotal)}</dd>
              ${Number(o.deliveryFee) ? `<dt>Entrega</dt><dd>${brl(o.deliveryFee)}</dd>` : ''}
              ${Number(o.discount) ? `<dt>Desconto</dt><dd>${brl(-o.discount)}</dd>` : ''}
              <dt class="adm-tot">Total</dt><dd class="adm-tot">${brl(o.total)}</dd>
              <dt>Pagamento</dt><dd>${esc(PAY[(o.payment || {}).method] || (o.payment || {}).method || '—')}${(o.payment || {}).changeFor ? ` · troco para ${brl(o.payment.changeFor)}` : ''}</dd>
            </dl>
          </section>
        </div>
        <div class="adm-nfebar">
          <span>${ic('receipt')} ${inv ? `Nota ${esc(inv.numero || inv.number || '')} ${inv.status ? '· ' + esc(inv.status) : ''}` : 'Sem nota fiscal emitida'}</span>
          <span class="adm-btnrow">
            ${nfe && inv ? '<button type="button" class="adm-btn adm-btn-soft adm-btn-sm" data-receipt>Ver nota</button>' : ''}
            ${nfe && typeof nfe.emit === 'function' ? `<button type="button" class="adm-btn adm-btn-soft adm-btn-sm" data-reissue>${inv ? 'Reemitir nota' : 'Emitir nota'}</button>` : ''}
            ${!nfe ? '<small class="adm-muted">Módulo de nota fiscal não carregado.</small>' : ''}
          </span>
        </div>
      </div>` : ''}
    </article>`;
  }
  async function changeStatus(id, status) {
    const s = st(); const o = s.orders.find(x => x.id === id); if (!o || o.status === status) return;
    if (status === 'cancelado') {
      if (!await confirmBox(`Cancelar o pedido <strong>#${esc(id)}</strong>?${o.demo ? '' : ' Os itens voltam para o estoque.'}`, { ok: 'Cancelar pedido', danger: true, title: 'Cancelar pedido' })) { renderOrders(); return; }
      if (!o.demo) (o.items || []).forEach(it => { const p = Store().product(it.productId); if (p) { p.stock = (Number(p.stock) || 0) + (Number(it.qty) || 0); logStock(p.id, Number(it.qty) || 0, 'Devolução — pedido #' + id + ' cancelado'); } });
    }
    const hist = (o.statusHistory || []).concat([{ status, at: new Date().toISOString() }]);
    Store().updateOrder(id, { status, statusHistory: hist });
    GulosBusEmit('order:updated', Store().get().orders.find(x => x.id === id));
    toast(`Pedido #${id}: ${STATUS[status] || status}`);
    renderOrders(); updateBadges();
  }
  function GulosBusEmit(evt, data) { try { if (window.GulosBus) window.GulosBus.emit(evt, data); } catch (e) {} }
  function showReceipt(id) {
    const o = st().orders.find(x => x.id === id); const nfe = window.GulosNFe;
    if (!o || !o.invoice) { toast('Este pedido ainda não tem nota.', 'warn'); return; }
    if (!nfe || typeof nfe.renderReceipt !== 'function') { toast('Módulo de nota fiscal não carregado.', 'err'); return; }
    let r;
    try { r = nfe.renderReceipt(o.invoice, o); } catch (e) { console.error(e); toast('Não foi possível abrir a nota.', 'err'); return; }
    if (typeof r === 'string' || r instanceof Node) {
      const m = openModal({ title: `Nota do pedido #${esc(id)}`, wide: true, body: '<div class="adm-receipt"></div>', footer: '<button type="button" class="adm-btn adm-btn-soft" data-print>Imprimir</button><button type="button" class="adm-btn adm-btn-primary" data-close>Fechar</button>' });
      const box = m.el.querySelector('.adm-receipt');
      if (typeof r === 'string') box.innerHTML = r; else box.appendChild(r);
      m.el.querySelector('[data-print]').addEventListener('click', () => {
        const w = window.open('', '_blank', 'width=420,height=700'); if (!w) return;
        w.document.write(`<!doctype html><meta charset="utf-8"><title>Nota #${esc(id)}</title><body style="font-family:monospace">${box.innerHTML}</body>`);
        w.document.close(); w.focus(); w.print();
      });
    } else {
      // O módulo de nota abriu a própria janela (camada abaixo do painel): escondemos o painel temporariamente.
      hidePanelTemporarily();
    }
  }
  function hidePanelTemporarily() {
    if (!panelEl) return;
    panelEl.classList.add('adm-hidden');
    lockScroll(false);
    const pill = document.createElement('button');
    pill.type = 'button'; pill.className = 'adm-backpill';
    pill.innerHTML = `${ic('back')} Voltar ao painel`;
    pill.addEventListener('click', () => { pill.remove(); if (panelEl) { panelEl.classList.remove('adm-hidden'); lockScroll(true); } });
    layer.appendChild(pill);
    pill.focus();
  }
  async function reissue(id) {
    const nfe = window.GulosNFe; const o = st().orders.find(x => x.id === id);
    if (!nfe || typeof nfe.emit !== 'function' || !o) { toast('Módulo de nota fiscal não carregado.', 'err'); return; }
    if (o.invoice && !await confirmBox(`Reemitir a nota do pedido #${esc(id)}?`, { ok: 'Reemitir' })) return;
    try {
      const res = await nfe.emit(o);
      if (res && typeof res === 'object') Store().updateOrder(id, { invoice: res });
      else Store().save();
      toast('Nota emitida.');
    } catch (e) { console.error(e); toast('Falha ao emitir: ' + (e && e.message ? e.message : 'erro'), 'err'); }
    renderOrders();
  }

  /* ------------------------------------------------------ configurações */
  function cnpjMask(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 14);
    return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  function validCNPJ(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const calc = len => { let sum = 0, pos = len - 7; for (let i = len; i >= 1; i--) { sum += +d[len - i] * pos--; if (pos < 2) pos = 9; } const r = sum % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +d[12] && calc(13) === +d[13];
  }
  function renderSettings() {
    const s = st();
    const S = s.store, F = s.config.fiscal, A = s.config.admin, P = s.config.pix;
    const fee = s.config.deliveryFee != null ? s.config.deliveryFee : S.deliveryFee;
    const minO = s.config.minOrder != null ? s.config.minOrder : S.minOrder;
    const demoN = s.orders.filter(o => o.demo).length;
    content.innerHTML = `
      <div class="adm-settings">
      <section class="adm-card" aria-labelledby="adm-s-store">
        <h3 class="adm-h4" id="adm-s-store">Dados da loja</h3>
        <form class="adm-form" data-form="store" novalidate>
          <div class="adm-formgrid">
            ${field('Nome da loja', `<input class="adm-input" name="name" value="${esc(S.name)}" maxlength="60">`, '', 'adm-span2')}
            ${field('Endereço', `<input class="adm-input" name="address" value="${esc(S.address)}" placeholder="Rua, número — bairro, cidade">`, '', 'adm-span2')}
            ${field('Telefone', `<input class="adm-input" name="phone" type="tel" value="${esc(S.phone)}" placeholder="(11) 3333-4444">`)}
            ${field('WhatsApp', `<input class="adm-input" name="whatsapp" type="tel" value="${esc(S.whatsapp || '')}" placeholder="(11) 99999-8888">`, 'Usado no botão “Chamar no WhatsApp”.')}
            ${field('Horário de funcionamento', `<textarea class="adm-input" name="hours" rows="2" placeholder="Ter a Dom, 18h às 23h30">${esc(S.hours)}</textarea>`, '', 'adm-span2')}
            ${field('Taxa de entrega (R$)', `<input class="adm-input" name="deliveryFee" type="number" inputmode="decimal" min="0" step="0.01" value="${Number(fee) || 0}">`)}
            ${field('Pedido mínimo (R$)', `<input class="adm-input" name="minOrder" type="number" inputmode="decimal" min="0" step="0.01" value="${Number(minO) || 0}">`)}
          </div>
          ${photoField('logo', S.logo, 'Logo', 'Quadrada, reduzida para até 400px.')}
          ${photoField('banner', S.banner, 'Banner / capa', 'Horizontal, reduzida para até 1200px.')}
          <div class="adm-formactions"><button type="submit" class="adm-btn adm-btn-primary">Salvar dados da loja</button></div>
        </form>
      </section>

      <section class="adm-card" aria-labelledby="adm-s-pix">
        <h3 class="adm-h4" id="adm-s-pix">Pix</h3>
        <form class="adm-form" data-form="pix" novalidate>
          <div class="adm-formgrid">
            ${field('Chave Pix', `<input class="adm-input" name="key" value="${esc(P.key)}" placeholder="CNPJ, e-mail, telefone (+55…) ou chave aleatória" maxlength="77" autocomplete="off">`, 'Usada para gerar o Pix copia-e-cola no checkout.', 'adm-span2')}
            ${field('Nome do recebedor', `<input class="adm-input" name="name" value="${esc(P.name)}" maxlength="25" placeholder="Ex.: Hamburgueria Gulos">`, 'Até 25 caracteres, como no banco.')}
            ${field('Cidade', `<input class="adm-input" name="city" value="${esc(P.city)}" maxlength="15" placeholder="Ex.: Aracaju">`, 'Até 15 caracteres.')}
          </div>
          <div class="adm-formactions"><button type="submit" class="adm-btn adm-btn-primary">Salvar Pix</button></div>
        </form>
      </section>

      <section class="adm-card" aria-labelledby="adm-s-fiscal">
        <h3 class="adm-h4" id="adm-s-fiscal">Nota fiscal (NFC-e)</h3>
        <form class="adm-form" data-form="fiscal" novalidate>
          <div class="adm-formgrid">
            ${field('Provedor', `<select class="adm-input" name="provider">${[['simulado', 'Simulado (teste, sem valor fiscal)'], ['focusnfe', 'Focus NFe'], ['enotas', 'eNotas']].map(([v, l]) => `<option value="${v}" ${F.provider === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
            ${field('Ambiente', `<select class="adm-input" name="ambiente"><option value="homologacao" ${F.ambiente !== 'producao' ? 'selected' : ''}>Homologação (testes)</option><option value="producao" ${F.ambiente === 'producao' ? 'selected' : ''}>Produção</option></select>`)}
            ${field('CNPJ', `<input class="adm-input" name="cnpj" inputmode="numeric" value="${esc(cnpjMask(F.cnpj))}" placeholder="00.000.000/0000-00" maxlength="18">`, '<span data-cnpjmsg></span>')}
            ${field('Inscrição Estadual', `<input class="adm-input" name="ie" value="${esc(F.ie)}" maxlength="20">`)}
            ${field('Série', `<input class="adm-input" name="serie" type="number" min="1" step="1" value="${Number(F.serie) || 1}">`)}
            ${field('Próximo número', `<input class="adm-input" name="proximoNumero" type="number" min="1" step="1" value="${Number(F.proximoNumero) || 1}">`)}
            ${field('URL do backend fiscal', `<input class="adm-input" name="backendUrl" type="url" value="${esc(F.backendUrl || '')}" placeholder="https://sua-api.exemplo.com/nfce">`, 'Seu servidor guarda o token do provedor e repassa a emissão. O token nunca deve ficar no navegador.', 'adm-span2')}
          </div>
          <div class="adm-infobox">
            <strong>${ic('alert')} O que é preciso para emitir NFC-e de verdade</strong>
            <ul>
              <li><b>CNPJ ativo</b> com atividade de restaurante/lanchonete e regime tributário definido com seu contador.</li>
              <li><b>Inscrição Estadual</b> ativa e credenciamento para NFC-e na SEFAZ do seu estado.</li>
              <li><b>Certificado digital A1</b> (arquivo .pfx) do CNPJ.</li>
              <li><b>CSC e ID do token</b> (Código de Segurança do Contribuinte), gerados no portal da SEFAZ.</li>
              <li><b>Contrato com um provedor de API fiscal</b> (ex.: Focus NFe, eNotas), que assina e transmite as notas.</li>
              <li><b>Um pequeno backend</b> (ex.: Supabase Edge Function) para guardar o token do provedor e o certificado com segurança.</li>
            </ul>
            <p>Enquanto isso não estiver pronto, use o modo <b>Simulado</b>: o cupom é gerado para conferência, sem valor fiscal.</p>
          </div>
          <div class="adm-formactions"><button type="submit" class="adm-btn adm-btn-primary">Salvar nota fiscal</button></div>
        </form>
      </section>

      <section class="adm-card" aria-labelledby="adm-s-acc">
        <h3 class="adm-h4" id="adm-s-acc">Acesso do dono</h3>
        <p class="adm-muted">Conta atual: <strong>${esc(A.email)}</strong></p>
        <form class="adm-form" data-form="account" novalidate>
          <div class="adm-formgrid">
            ${field('Senha atual *', `<input class="adm-input" name="cur" type="password" autocomplete="current-password" required>`, '', 'adm-span2')}
            ${field('Novo e-mail', `<input class="adm-input" name="email" type="email" autocomplete="username" value="${esc(A.email)}">`, '', 'adm-span2')}
            ${field('Nova senha', `<input class="adm-input" name="p1" type="password" autocomplete="new-password" placeholder="Deixe em branco para manter">`, 'Mínimo de 8 caracteres.')}
            ${field('Confirmar nova senha', `<input class="adm-input" name="p2" type="password" autocomplete="new-password">`)}
          </div>
          <p class="adm-formerr" role="alert"></p>
          <div class="adm-formactions"><button type="submit" class="adm-btn adm-btn-primary">Atualizar acesso</button></div>
        </form>
        <div class="adm-honest">${ic('lock')}<p>Este login protege o painel neste navegador. Para várias pessoas/aparelhos e segurança total, conecte um servidor (ex.: Supabase).</p></div>
      </section>

      <section class="adm-card" aria-labelledby="adm-s-data">
        <h3 class="adm-h4" id="adm-s-data">Dados e backup</h3>
        <p class="adm-muted">Tudo fica salvo neste navegador. Faça backups com frequência.</p>
        <div class="adm-btnrow adm-wrap">
          <button type="button" class="adm-btn adm-btn-soft" data-act="export">${ic('download')} Exportar backup (JSON)</button>
          <label class="adm-btn adm-btn-soft adm-filebtn">${ic('upload')} Importar backup<input type="file" accept="application/json,.json" class="sr-only" data-import></label>
          ${demoN ? `<button type="button" class="adm-btn adm-btn-ghost" data-act="cleardemo">Limpar dados de demonstração (${demoN})</button>` : ''}
        </div>
        <div class="adm-danger">
          <div><strong>Restaurar cardápio original</strong><p class="adm-muted adm-small">Volta produtos, preços, fotos e categorias ao cardápio inicial. Pedidos, despesas, dados da loja e o acesso do dono são mantidos.</p></div>
          <button type="button" class="adm-btn adm-btn-danger" data-act="reset">Restaurar cardápio</button>
        </div>
      </section>
      </div>`;

    const storeForm = content.querySelector('[data-form="store"]');
    const imgs = { logo: S.logo || '', banner: S.banner || '' };
    bindPhoto(storeForm, 'logo', () => imgs.logo, v => { imgs.logo = v; }, 400);
    bindPhoto(storeForm, 'banner', () => imgs.banner, v => { imgs.banner = v; }, 1200);
    const fiscalForm = content.querySelector('[data-form="fiscal"]');
    const cnpjMsg = content.querySelector('[data-cnpjmsg]');
    const checkCnpj = () => {
      const v = fiscalForm.cnpj.value; const d = v.replace(/\D/g, '');
      if (!d) { cnpjMsg.textContent = ''; cnpjMsg.className = ''; return true; }
      const ok = validCNPJ(v);
      cnpjMsg.textContent = d.length < 14 ? 'Digite os 14 números.' : ok ? '✓ CNPJ válido' : '✗ CNPJ inválido (dígitos verificadores não conferem)';
      cnpjMsg.className = ok ? 'adm-pos' : 'adm-neg';
      fiscalForm.cnpj.setAttribute('aria-invalid', String(!ok && d.length === 14));
      return ok;
    };
    checkCnpj();
    content.oninput = e => {
      if (e.target === fiscalForm.cnpj) { const pos = e.target.value.length; e.target.value = cnpjMask(e.target.value); if (pos === e.target.value.length) {} checkCnpj(); }
    };
    content.onsubmit = async e => {
      e.preventDefault();
      const f = e.target; const s2 = st();
      if (f.dataset.form === 'store') {
        Object.assign(s2.store, { name: f.name.value.trim() || 'Hamburgueria Gulos', address: f.address.value.trim(), phone: f.phone.value.trim(), whatsapp: f.whatsapp.value.trim(), hours: f.hours.value.trim(), logo: imgs.logo, banner: imgs.banner, deliveryFee: r2(num(f.deliveryFee.value)), minOrder: r2(num(f.minOrder.value)) });
        s2.config.deliveryFee = s2.store.deliveryFee; s2.config.minOrder = s2.store.minOrder;
        save(); toast('Dados da loja salvos.');
        const br = panelEl.querySelector('.adm-brand strong'); if (br) br.textContent = s2.store.name;
      } else if (f.dataset.form === 'pix') {
        const key = f.key.value.trim();
        if (!key) { toast('Informe a chave Pix.', 'err'); f.key.focus(); return; }
        s2.config.pix = { key, name: f.name.value.trim().slice(0, 25), city: f.city.value.trim().slice(0, 15) };
        save(); toast('Dados do Pix salvos.');
      } else if (f.dataset.form === 'fiscal') {
        const d = f.cnpj.value.replace(/\D/g, '');
        if (d && !validCNPJ(d)) { toast('CNPJ inválido. Confira os números.', 'err'); f.cnpj.focus(); return; }
        if (f.provider.value !== 'simulado' && f.ambiente.value === 'producao' && (!d || !f.ie.value.trim() || !f.backendUrl.value.trim())) { toast('Para produção informe CNPJ, Inscrição Estadual e a URL do backend.', 'err'); return; }
        Object.assign(s2.config.fiscal, { provider: f.provider.value, ambiente: f.ambiente.value, cnpj: d, ie: f.ie.value.trim(), serie: Math.max(1, parseInt(f.serie.value, 10) || 1), proximoNumero: Math.max(1, parseInt(f.proximoNumero.value, 10) || 1), backendUrl: f.backendUrl.value.trim() });
        save(); toast('Configuração fiscal salva.');
      } else if (f.dataset.form === 'account') {
        const err = f.querySelector('.adm-formerr'); err.textContent = '';
        const A2 = s2.config.admin;
        const curH = await hashPass(A2.email, f.cur.value);
        if (curH !== A2.passHash) { err.textContent = 'Senha atual incorreta.'; f.cur.focus(); return; }
        const email = f.email.value.trim();
        if (!validEmail(email)) { err.textContent = 'Informe um e-mail válido.'; f.email.focus(); return; }
        const np = f.p1.value;
        if (np && np.length < 8) { err.textContent = 'A nova senha precisa ter pelo menos 8 caracteres.'; f.p1.focus(); return; }
        if (np && np !== f.p2.value) { err.textContent = 'As novas senhas não conferem.'; f.p2.focus(); return; }
        if (!np && normEmail(email) === normEmail(A2.email)) { err.textContent = 'Nada para alterar.'; return; }
        A2.passHash = await hashPass(email, np || f.cur.value);
        A2.email = email;
        save(); startSession();
        const se = panelEl.querySelector('.adm-sideemail'); if (se) { se.textContent = email; se.title = email; }
        toast('Acesso atualizado.');
        renderSettings();
      }
    };
    content.onchange = async e => {
      if (!e.target.matches('[data-import]')) return;
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const payload = data && data.gulosBackup ? data.state : data;
        if (!payload || !Array.isArray(payload.products) || !Array.isArray(payload.categories)) throw new Error('Arquivo não parece um backup da Gulos.');
        if (!await confirmBox(`Importar backup com ${payload.products.length} produtos e ${(payload.orders || []).length} pedidos? Os dados atuais deste navegador serão substituídos (o acesso do dono atual é mantido).`, { ok: 'Importar', danger: true })) return;
        const cur = Store().get();
        const admin = clone(cur.config.admin);
        Object.keys(cur).forEach(k => delete cur[k]);
        Object.assign(cur, payload);
        ensureState();
        cur.config.admin = admin;
        save(); renderFooter(); renderSettings(); toast('Backup importado.');
      } catch (err) { toast(err.message || 'Não foi possível importar.', 'err'); }
    };
    content.onclick = async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'export') {
        const data = clone(Store().get());
        if (data.config && data.config.admin) data.config.admin = { email: data.config.admin.email, passHash: null };
        download(`backup-gulos-${dayKey(Date.now())}.json`, JSON.stringify({ gulosBackup: 1, exportedAt: new Date().toISOString(), state: data }, null, 2), 'application/json');
        toast('Backup exportado.');
      }
      if (b.dataset.act === 'cleardemo') clearDemo();
      if (b.dataset.act === 'reset') {
        if (!await confirmBox('Restaurar o cardápio original? Produtos, preços, fotos e categorias editados serão substituídos. Pedidos, despesas e configurações são mantidos.', { ok: 'Restaurar cardápio', danger: true, title: 'Restaurar cardápio original' })) return;
        const cur = Store().get();
        const keep = { store: clone(cur.store), orders: clone(cur.orders), config: clone(cur.config), stockLog: clone(cur.stockLog || []), expenses: clone(cur.expenses || []) };
        Store().reset();
        const fresh = Store().get();
        Object.assign(fresh, keep);
        save(); prodFilter.cat = ''; renderTab(); toast('Cardápio original restaurado.');
      }
    };
  }

  /* ------------------------------------------------------- integração */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (modals.length) { e.preventDefault(); modals[modals.length - 1].close(); return; }
    if (authEl) { e.preventDefault(); closeAuth(); return; }
    if (panelEl && !panelEl.classList.contains('adm-hidden')) { e.preventDefault(); closePanel(); }
  });
  // Mantém o foco dentro da camada aberta.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const top = modals.length ? modals[modals.length - 1].el : authEl || (panelEl && !panelEl.classList.contains('adm-hidden') ? panelEl : null);
    if (!top) return;
    const f = Array.from(top.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])')).filter(x => x.offsetParent !== null || x.closest('.adm-filebtn'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!top.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  let subTimer = null;
  function onStoreChange() {
    clearTimeout(subTimer);
    subTimer = setTimeout(() => {
      renderFooter();
      if (!panelEl) return;
      updateBadges();
      const ae = document.activeElement;
      const typing = ae && panelEl.contains(ae) && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName);
      if (modals.length || typing) { dirty = true; return; }
      if (tab === 'overview' || tab === 'orders') renderTab();
    }, 80);
  }

  function init() {
    if (!Store()) { renderFooter(); return; }
    ensureState();
    renderFooter();
    Store().subscribe(onStoreChange);
    if (window.GulosBus) {
      window.GulosBus.on('admin:open', openAdmin);
      window.GulosBus.on('order:placed', () => { if (panelEl) { updateBadges(); if (tab === 'overview' || tab === 'orders') renderTab(); } });
    }
    if (/^#(painel|admin|dono)$/i.test(location.hash)) setTimeout(openAdmin, 50);
    window.addEventListener('hashchange', () => { if (/^#(painel|admin|dono)$/i.test(location.hash)) openAdmin(); });
    try {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (panelEl && tab === 'finance') renderFinance(); });
    } catch (e) {}
  }
  init();

  window.GulosAdmin = { open: openAdmin, close: closePanel, _sha256Fallback: sha256Fallback, _validCNPJ: validCNPJ };
})();
