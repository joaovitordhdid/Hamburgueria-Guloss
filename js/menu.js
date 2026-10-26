/* Gulos — cardápio do cliente (agente de design).
   Renderiza em #app-menu: hero, busca, categorias fixas com scroll-spy, destaques,
   grade de produtos, detalhe do produto (bottom sheet / modal) e barra do carrinho.
   Conversa com o resto do site apenas por GulosStore (leitura) e GulosBus (eventos). */
(function () {
  'use strict';

  const S = window.GulosStore;
  const B = window.GulosBus;
  const root = document.getElementById('app-menu');
  if (!root || !S || !B) return;

  const reduceMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => reduceMQ.matches;
  const brl = v => S.brl(v);

  const ui = {
    q: '',
    active: null,
    spyLock: 0,
    cart: { count: 0, total: 0 },
    sawCartChanged: false,
    local: { count: 0, total: 0 },
    sheet: null
  };

  /* ---------- utilidades ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const num = v => Number(v) || 0;
  const $ = (sel, el) => (el || root).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || root).querySelectorAll(sel));

  function data() {
    const st = S.get() || {};
    return {
      store: st.store || {},
      config: st.config || {},
      categories: Array.isArray(st.categories) ? st.categories : [],
      products: Array.isArray(st.products) ? st.products : []
    };
  }
  const visible = p => p && p.active !== false;
  const soldOut = p => p.stock != null && num(p.stock) <= 0;
  const hasDiscount = p => p.oldPrice != null && num(p.oldPrice) > num(p.price);
  const needsChoice = p => (p.options || []).some(g => num(g.min) >= 1);
  const groupMax = g => (num(g.max) > 0 ? num(g.max) : Infinity);

  function catName(id) {
    const c = data().categories.find(x => x.id === id);
    return c ? c.name : '';
  }

  /* ---------- arte de fallback (nunca imagem quebrada) ---------- */
  function artKind(p) {
    const t = norm(catName(p.categoryId) + ' ' + p.name);
    if (/bebida|refri|suco|drink|cerveja|agua|milk ?shake|shake|coca|guarana|soda|cha |limonada|lata|600ml|2l\b/.test(t)) return 'drink';
    if (/batata|frita|porc|onion|nugget|acompanh|aneis|anel|mandioca|polenta|chips/.test(t)) return 'fries';
    if (/burger|hamb|lanche|smash|combo|sanduich|x-|cheese|bacon|blend|artesana/.test(t)) return 'burger';
    if ((p.ingredients || []).some(i => /blend|hamb|pao|brioche/.test(norm(i)))) return 'burger';
    return 'mono';
  }
  function initials(name) {
    const w = String(name || 'G').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    return ((w[0] || 'G')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
  }
  const SVG = {
    burger: '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false"><ellipse cx="100" cy="172" rx="70" ry="9" fill="rgba(0,0,0,.28)"/><path d="M36 140h128a6 6 0 0 1 6 6v2a16 16 0 0 1-16 16H46a16 16 0 0 1-16-16v-2a6 6 0 0 1 6-6z" fill="#e0913a"/><rect x="30" y="113" width="140" height="27" rx="13.5" fill="#4a2312"/><path d="M42 122h14M76 128h18M120 121h16M146 130h10" stroke="#6b3a1f" stroke-width="3" stroke-linecap="round"/><path d="M30 108h140l-9 17-10-10-13 16-12-15H83l-13 13-11-13-12 10z" fill="#ffc23d"/><path d="M26 104q8 10 16 0t16 0 16 0 16 0 16 0 16 0 16 0 16 0 16 0 16 0v7H26z" fill="#68b33a"/><rect x="34" y="96" width="132" height="9" rx="4.5" fill="#e8452c"/><path d="M28 98c0-38 32-62 72-62s72 24 72 62a4 4 0 0 1-4 4H32a4 4 0 0 1-4-4z" fill="url(#menuBun)"/><g fill="#fff1d6"><ellipse cx="72" cy="58" rx="4" ry="2.2" transform="rotate(-25 72 58)"/><ellipse cx="96" cy="50" rx="4" ry="2.2" transform="rotate(10 96 50)"/><ellipse cx="122" cy="57" rx="4" ry="2.2" transform="rotate(30 122 57)"/><ellipse cx="84" cy="72" rx="4" ry="2.2" transform="rotate(-8 84 72)"/><ellipse cx="110" cy="74" rx="4" ry="2.2" transform="rotate(18 110 74)"/><ellipse cx="140" cy="76" rx="4" ry="2.2" transform="rotate(40 140 76)"/><ellipse cx="58" cy="78" rx="4" ry="2.2" transform="rotate(-35 58 78)"/></g><path d="M50 70c8-16 24-24 38-26" stroke="rgba(255,255,255,.35)" stroke-width="5" stroke-linecap="round" fill="none"/><defs><linearGradient id="menuBun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6b25a"/><stop offset="1" stop-color="#d77a26"/></linearGradient></defs></svg>',
    drink: '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false"><ellipse cx="100" cy="178" rx="44" ry="7" fill="rgba(0,0,0,.28)"/><path d="M106 54l18-36" stroke="#fff4e8" stroke-width="8" stroke-linecap="round"/><path d="M106 54l18-36" stroke="#ff7a1a" stroke-width="8" stroke-linecap="round" stroke-dasharray="6 7"/><path d="M62 62h76l-10 106a8 8 0 0 1-8 7H80a8 8 0 0 1-8-7z" fill="#e8452c"/><path d="M66 100q17 10 34 0t34 0l-3 30q-15 9-31 0t-31 0z" fill="#fff4e8"/><rect x="56" y="50" width="88" height="14" rx="7" fill="#fff4e8"/><path d="M78 72l4 86" stroke="rgba(255,255,255,.3)" stroke-width="6" stroke-linecap="round"/><circle cx="150" cy="90" r="5" fill="rgba(255,255,255,.35)"/><circle cx="160" cy="70" r="3" fill="rgba(255,255,255,.3)"/><circle cx="44" cy="110" r="4" fill="rgba(255,255,255,.3)"/></svg>',
    fries: '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false"><ellipse cx="100" cy="178" rx="52" ry="8" fill="rgba(0,0,0,.28)"/><g fill="#ffc23d" stroke="#e39a1c" stroke-width="2"><rect x="66" y="40" width="12" height="80" rx="3" transform="rotate(-12 72 80)"/><rect x="84" y="28" width="12" height="90" rx="3" transform="rotate(-4 90 70)"/><rect x="102" y="32" width="12" height="88" rx="3" transform="rotate(5 108 76)"/><rect x="118" y="42" width="12" height="80" rx="3" transform="rotate(14 124 82)"/><rect x="94" y="46" width="12" height="70" rx="3" transform="rotate(-20 100 80)"/><rect x="110" y="50" width="12" height="70" rx="3" transform="rotate(24 116 84)"/></g><path d="M54 96h92l-12 76a6 6 0 0 1-6 5H72a6 6 0 0 1-6-5z" fill="#e8452c"/><path d="M54 96q23 16 46 0t46 0" fill="none" stroke="#fff4e8" stroke-width="6"/><text x="100" y="152" text-anchor="middle" font-family="Bricolage Grotesque, system-ui, sans-serif" font-weight="800" font-size="30" fill="#fff4e8">G</text></svg>'
  };
  function art(p, extraCls) {
    const h = hash(String(p.id || p.name));
    const h1 = 12 + (h % 34);           /* laranjas/âmbar */
    const h2 = 4 + ((h >> 8) % 20);
    const kind = artKind(p);
    const inner = kind === 'mono'
      ? `<span class="menu-art-mono" aria-hidden="true">${esc(initials(p.name))}</span>`
      : SVG[kind];
    return `<div class="menu-art menu-art--${kind} ${extraCls || ''}" style="--a1:hsl(${h1} 92% 56%);--a2:hsl(${h2} 75% 16%)">${inner}</div>`;
  }
  function media(p, w, h, eager) {
    if (p.image) {
      return `<div class="menu-media" data-pid="${esc(p.id)}"><img src="${esc(p.image)}" alt="" width="${w}" height="${h}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`;
    }
    return `<div class="menu-media" data-pid="${esc(p.id)}">${art(p)}</div>`;
  }
  /* imagens que falham viram arte, inclusive as que já falharam antes do listener */
  function fixBroken(img) {
    const wrap = img.closest('.menu-media');
    if (!wrap) return;
    const p = S.product(wrap.dataset.pid) || { id: wrap.dataset.pid, name: '' };
    wrap.innerHTML = art(p);
  }
  root.addEventListener('error', e => { if (e.target && e.target.tagName === 'IMG') fixBroken(e.target); }, true);
  function sweepBroken(scope) {
    $$('.menu-media img', scope).forEach(img => { if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fixBroken(img); });
  }

  /* ---------- horário de funcionamento ---------- */
  const DAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const DAY_LABEL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function parseHours(str) {
    if (!str || typeof str !== 'string') return null;
    const s = norm(str);
    const t = s.match(/(\d{1,2})\s*(?:[:h]\s*(\d{2}))?\s*h?\s*(?:as|a|-|–|—|ate)\s*(\d{1,2})\s*(?:[:h]\s*(\d{2}))?/);
    if (!t) return null;
    const o = +t[1] * 60 + (+t[2] || 0), c = +t[3] * 60 + (+t[4] || 0);
    if (+t[1] > 24 || +t[3] > 24) return null;
    let days = null;
    const dayRe = '(dom|seg|ter|qua|qui|sex|sab)[a-z-]*\\.?';
    const r = s.match(new RegExp(dayRe + '\\s*(?:a|-|–|ate)\\s*' + dayRe));
    if (r) {
      days = new Set();
      let i = DAYS.indexOf(r[1]); const j = DAYS.indexOf(r[2]);
      for (let k = 0; k < 7; k++) { days.add(i); if (i === j) break; i = (i + 1) % 7; }
    } else if (!/todos|diariamente|todo dia/.test(s)) {
      const found = (s.match(/\b(dom|seg|ter|qua|qui|sex|sab)/g) || []).map(d => DAYS.indexOf(d));
      if (found.length) days = new Set(found);
    }
    if (!days) days = new Set([0, 1, 2, 3, 4, 5, 6]);
    return { open: o, close: c % 1440, days };
  }
  const fmtTime = m => { const h = Math.floor(m / 60) % 24, mm = m % 60; return h + 'h' + (mm ? String(mm).padStart(2, '0') : ''); };
  function hoursStatus(str, now) {
    const hrs = parseHours(str);
    if (!hrs) return null;
    now = now || new Date();
    const d = now.getDay(), m = now.getHours() * 60 + now.getMinutes();
    const { open, close, days } = hrs;
    const overnight = close <= open;
    let isOpen;
    if (overnight) isOpen = (days.has(d) && m >= open) || (days.has((d + 6) % 7) && m < close);
    else isOpen = days.has(d) && m >= open && m < close;
    if (isOpen) return { open: true, text: 'Aberto agora', sub: 'fecha às ' + fmtTime(close) };
    if (days.has(d) && m < open) return { open: false, text: 'Fechado', sub: 'abre hoje às ' + fmtTime(open) };
    for (let k = 1; k <= 7; k++) {
      const dd = (d + k) % 7;
      if (days.has(dd)) return { open: false, text: 'Fechado', sub: 'abre ' + (k === 1 ? 'amanhã' : DAY_LABEL[dd]) + ' às ' + fmtTime(open) };
    }
    return { open: false, text: 'Fechado', sub: '' };
  }

  /* ---------- esqueleto ---------- */
  root.classList.add('menu-root');
  root.innerHTML = `
    <header class="menu-hero" id="menu-hero"></header>
    <div class="menu-ticker" aria-hidden="true"><div class="menu-ticker-track"></div></div>
    <nav class="menu-nav" aria-label="Categorias do cardápio">
      <div class="menu-nav-in">
        <div class="menu-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
          <label class="sr-only" for="menu-q">Buscar no cardápio</label>
          <input id="menu-q" type="search" placeholder="Buscar burger, bebida, ingrediente…" autocomplete="off" enterkeyhint="search">
          <button type="button" class="menu-search-clear" aria-label="Limpar busca" hidden>&times;</button>
        </div>
        <div class="menu-chips" id="menu-chips"></div>
      </div>
    </nav>
    <main class="menu-main">
      <section class="menu-featured" id="menu-featured" aria-labelledby="menu-featured-h"></section>
      <div id="menu-sections"></div>
      <div class="menu-empty" id="menu-empty" hidden></div>
    </main>
    <div class="menu-cartwrap">
      <button type="button" class="menu-cartbar" id="menu-cartbar" aria-label="Ver carrinho">
        <span class="menu-cartbar-count" aria-hidden="true">0</span>
        <span class="menu-cartbar-label">Ver carrinho</span>
        <span class="menu-cartbar-total">R$ 0,00</span>
      </button>
    </div>
    <div class="menu-sheet-root" id="menu-sheet-root" hidden></div>
    <div class="sr-only" aria-live="polite" id="menu-live"></div>`;

  const elHero = $('#menu-hero'), elChips = $('#menu-chips'), elFeat = $('#menu-featured'),
    elSections = $('#menu-sections'), elEmpty = $('#menu-empty'), elQ = $('#menu-q'),
    elClear = $('.menu-search-clear'), elBar = $('#menu-cartbar'), elSheetRoot = $('#menu-sheet-root'),
    elLive = $('#menu-live'), elNav = $('.menu-nav');

  $('.menu-ticker-track').innerHTML = (() => {
    const words = ['Feito na hora', 'Direto da chapa', 'Queijo derretendo', 'Peça em poucos toques', 'Hamburgueria Gulos'];
    const one = words.map(w => `<span>${w}</span><i>✦</i>`).join('');
    return `<div class="menu-ticker-row">${one}${one}</div>`;
  })();

  /* ---------- hero ---------- */
  const TAGS = ['suculento', 'artesanal', 'feito na hora', 'do seu jeito'];
  let lastHeroHtml = '';
  function renderHero() {
    const { store, config } = data();
    const name = store.name || 'Hamburgueria Gulos';
    const words = name.split(/\s+/);
    const big = words.length > 1 ? words[words.length - 1] : name;
    const pre = words.length > 1 ? words.slice(0, -1).join(' ') : '';
    const fee = config.deliveryFee != null ? config.deliveryFee : store.deliveryFee;
    const minOrder = config.minOrder != null ? config.minOrder : store.minOrder;
    const st = hoursStatus(store.hours);
    const meta = [];
    if (st) meta.push(`<li class="menu-pill menu-pill--status ${st.open ? 'is-open' : 'is-closed'}"><span class="menu-dot" aria-hidden="true"></span><b>${st.text}</b>${st.sub ? `<span>· ${esc(st.sub)}</span>` : ''}</li>`);
    else if (store.hours) meta.push(`<li class="menu-pill"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>${esc(store.hours)}</li>`);
    if (fee != null) meta.push(`<li class="menu-pill"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="7" cy="17" r="2" fill="currentColor"/><circle cx="17" cy="17" r="2" fill="currentColor"/></svg>${num(fee) > 0 ? 'Entrega ' + brl(fee) : 'Entrega grátis'}</li>`);
    if (num(minOrder) > 0) meta.push(`<li class="menu-pill">Pedido mín. ${brl(minOrder)}</li>`);
    if (st && store.hours) meta.push(`<li class="menu-pill menu-pill--soft">${esc(store.hours)}</li>`);
    if (store.address) meta.push(`<li class="menu-pill menu-pill--soft"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.5" fill="currentColor"/></svg>${esc(store.address)}</li>`);

    const logo = store.logo
      ? `<img class="menu-logo" src="${esc(store.logo)}" alt="" width="72" height="72" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'menu-logo menu-logo--mono',textContent:'${esc(initials(big)[0])}'}))">`
      : `<span class="menu-logo menu-logo--mono" aria-hidden="true">${esc(initials(big)[0])}</span>`;

    elHero.classList.toggle('has-banner', !!store.banner);
    const html = `
      ${store.banner ? `<img class="menu-hero-banner" src="${esc(store.banner)}" alt="" fetchpriority="high" onerror="this.remove();document.getElementById('menu-hero').classList.remove('has-banner')">` : ''}
      <div class="menu-hero-glow" aria-hidden="true"></div>
      ${store.banner ? `<div class="menu-steam" aria-hidden="true">${'<i></i>'.repeat(3)}</div>` : ''}
      <div class="menu-embers" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
      ${store.banner ? '' : `<div class="menu-hero-burger" aria-hidden="true">${SVG.burger}</div>`}
      <div class="menu-hero-in">
        <div class="menu-hero-brand">${logo}<span class="menu-eyebrow">${esc(pre || 'Hamburgueria')}</span></div>
        <h1 class="menu-hero-title"><span class="sr-only">${esc(name)}</span><span aria-hidden="true">${esc(big)}<em>.</em></span></h1>
        <p class="menu-tagline">Burger <span class="menu-rot" aria-hidden="true"><span class="menu-rot-track">${TAGS.concat(TAGS[0]).map(t => `<span>${t}.</span>`).join('')}</span></span><span class="sr-only">${TAGS[0]}.</span></p>
        <ul class="menu-hero-meta">${meta.join('')}</ul>
        <a class="menu-hero-cta" href="#menu-sections">Ver cardápio <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
      </div>`;
    // só redesenha quando algo muda, para não reiniciar as animações do topo
    if (html !== lastHeroHtml) { elHero.innerHTML = html; lastHeroHtml = html; }
  }
  setInterval(() => { if (data().store.hours) renderHero(); }, 60000);

  /* ---------- agrupamento ---------- */
  function grouped() {
    const { categories, products } = data();
    const q = norm(ui.q.trim());
    const match = p => !q || norm([p.name, p.description, (p.ingredients || []).join(' '), catName(p.categoryId)].join(' ')).includes(q);
    const vis = products.filter(visible);
    const known = new Set(categories.map(c => c.id));
    const out = categories.map(c => ({ id: c.id, name: c.name, items: vis.filter(p => p.categoryId === c.id && match(p)) }));
    const orphans = vis.filter(p => !known.has(p.categoryId) && match(p));
    if (orphans.length) out.push({ id: '__outros', name: 'Outros', items: orphans });
    return out.filter(g => g.items.length);
  }
  const secId = id => 'menu-cat-' + String(id).replace(/[^a-zA-Z0-9_-]/g, '_');

  /* ---------- chips ---------- */
  function renderChips(groups) {
    elChips.innerHTML = groups.map(g => `<button type="button" class="menu-chip" data-cat="${esc(g.id)}" aria-controls="${secId(g.id)}">${esc(g.name)}<span class="menu-chip-n">${g.items.length}</span></button>`).join('');
    markChip(ui.active && groups.some(g => g.id === ui.active) ? ui.active : (groups[0] && groups[0].id), false);
  }
  function markChip(id, scrollChip) {
    ui.active = id;
    $$('.menu-chip', elChips).forEach(b => {
      const on = b.dataset.cat === id;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      if (on && scrollChip !== false) {
        const left = b.offsetLeft - (elChips.clientWidth - b.offsetWidth) / 2;
        elChips.scrollTo({ left: Math.max(0, left), behavior: reduced() ? 'auto' : 'smooth' });
      }
    });
  }

  /* ---------- cards ---------- */
  function priceHTML(p, cls) {
    return `<span class="menu-price ${cls || ''}">${hasDiscount(p) ? `<s><span class="sr-only">De </span>${brl(p.oldPrice)}</s> <span class="sr-only">por </span>` : ''}<b>${brl(p.price)}</b></span>`;
  }
  function badges(p) {
    const b = [];
    if (soldOut(p)) b.push('<span class="menu-badge menu-badge--out">Esgotado</span>');
    else {
      if (hasDiscount(p)) b.push(`<span class="menu-badge menu-badge--deal">-${Math.round((1 - num(p.price) / num(p.oldPrice)) * 100)}%</span>`);
      if (p.stock != null && num(p.stock) <= 5) b.push('<span class="menu-badge menu-badge--low">Últimas</span>');
    }
    return b.length ? `<span class="menu-badges">${b.join('')}</span>` : '';
  }
  const plusSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  function addBtn(p) {
    const out = soldOut(p);
    return `<button type="button" class="menu-add" data-add="${esc(p.id)}" ${out ? 'disabled' : ''} aria-label="${out ? esc(p.name) + ' esgotado' : (needsChoice(p) ? 'Escolher opções de ' : 'Adicionar ') + esc(p.name)}">${plusSVG}</button>`;
  }
  function card(p) {
    return `<article class="menu-card${soldOut(p) ? ' is-out' : ''}" data-pid="${esc(p.id)}">
      <div class="menu-card-body">
        <h3 class="menu-card-name"><button type="button" class="menu-open" data-open="${esc(p.id)}">${esc(p.name)}</button></h3>
        ${p.description ? `<p class="menu-card-desc">${esc(p.description)}</p>` : ''}
        <div class="menu-card-foot">${priceHTML(p)}${needsChoice(p) && !soldOut(p) ? '<span class="menu-card-hint">monte o seu</span>' : ''}</div>
      </div>
      <div class="menu-card-media">${media(p, 240, 240)}${badges(p)}${addBtn(p)}</div>
    </article>`;
  }
  function featCard(p, i) {
    return `<article class="menu-feat${soldOut(p) ? ' is-out' : ''}" data-pid="${esc(p.id)}" style="--i:${i}">
      <div class="menu-feat-media">${media(p, 480, 560, i < 2)}</div>
      <div class="menu-feat-shade" aria-hidden="true"></div>
      ${badges(p)}
      <span class="menu-feat-rank" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <div class="menu-feat-body">
        <h3 class="menu-feat-name"><button type="button" class="menu-open" data-open="${esc(p.id)}">${esc(p.name)}</button></h3>
        <div class="menu-feat-foot">${priceHTML(p, 'menu-price--light')}${addBtn(p)}</div>
      </div>
    </article>`;
  }

  function renderFeatured() {
    const { categories, products } = data();
    if (ui.q.trim()) { elFeat.hidden = true; return; }
    const vis = products.filter(p => visible(p) && !soldOut(p));
    const list = vis.filter(hasDiscount);
    const firstCat = categories.find(c => vis.some(p => p.categoryId === c.id));
    if (firstCat) vis.filter(p => p.categoryId === firstCat.id).forEach(p => { if (list.length < 6 && !list.includes(p)) list.push(p); });
    if (list.length < 2) { elFeat.hidden = true; elFeat.innerHTML = ''; return; }
    elFeat.hidden = false;
    const deals = list.some(hasDiscount);
    elFeat.innerHTML = `
      <div class="menu-sec-head">
        <span class="menu-sec-kicker">${deals ? 'Ofertas &amp; queridinhos' : 'Mais pedidos'}</span>
        <h2 class="menu-sec-title" id="menu-featured-h">Destaques <span>da casa</span></h2>
      </div>
      <div class="menu-feat-track" role="list">${list.map((p, i) => `<div role="listitem" class="menu-feat-cell">${featCard(p, i)}</div>`).join('')}</div>`;
    sweepBroken(elFeat);
  }

  function renderSections(groups) {
    elSections.innerHTML = groups.map((g, i) => `
      <section class="menu-sec" id="${secId(g.id)}" data-cat="${esc(g.id)}" aria-labelledby="${secId(g.id)}-h">
        <div class="menu-sec-head">
          <span class="menu-sec-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <h2 class="menu-sec-title" id="${secId(g.id)}-h">${esc(g.name)}</h2>
          <span class="menu-sec-count">${g.items.length} ${g.items.length === 1 ? 'item' : 'itens'}</span>
        </div>
        <div class="menu-grid">${g.items.map(card).join('')}</div>
      </section>`).join('');
    if (!groups.length) {
      elEmpty.hidden = false;
      elEmpty.innerHTML = ui.q.trim()
        ? `<div class="menu-empty-art" aria-hidden="true">${SVG.burger}</div><p><b>Nada com “${esc(ui.q.trim())}”.</b></p><p>Tente outro nome ou ingrediente.</p><button type="button" class="menu-ghost" data-clearq>Limpar busca</button>`
        : `<div class="menu-empty-art" aria-hidden="true">${SVG.burger}</div><p><b>Cardápio em preparação.</b></p><p>Volte daqui a pouco!</p>`;
    } else elEmpty.hidden = true;
    sweepBroken(elSections);
    observeSections();
  }

  function renderAll() {
    renderHero();
    const groups = grouped();
    renderChips(groups);
    renderFeatured();
    renderSections(groups);
    if (ui.sheet) refreshSheet();
  }

  /* ---------- scroll-spy ---------- */
  let io = null;
  function observeSections() {
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const top = Math.round(elNav.getBoundingClientRect().height + 8);
    const bottom = Math.max(0, window.innerHeight - top - 2);
    io = new IntersectionObserver(entries => {
      if (Date.now() < ui.spyLock) return;
      const hit = entries.filter(e => e.isIntersecting).map(e => e.target);
      if (hit.length) markChip(hit[0].dataset.cat);
    }, { rootMargin: `-${top}px 0px -${bottom}px 0px`, threshold: 0 });
    $$('.menu-sec', elSections).forEach(s => io.observe(s));
  }
  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(observeSections, 150); });

  /* ---------- busca ---------- */
  let qT;
  elQ.addEventListener('input', () => {
    clearTimeout(qT);
    qT = setTimeout(() => {
      ui.q = elQ.value;
      elClear.hidden = !ui.q;
      const groups = grouped();
      renderChips(groups);
      renderFeatured();
      renderSections(groups);
      const n = groups.reduce((a, g) => a + g.items.length, 0);
      announce(ui.q.trim() ? (n ? n + (n === 1 ? ' produto encontrado' : ' produtos encontrados') : 'Nenhum produto encontrado') : '');
    }, 120);
  });
  elQ.addEventListener('keydown', e => { if (e.key === 'Escape' && elQ.value) { e.stopPropagation(); clearSearch(); } });
  function clearSearch() {
    elQ.value = ''; ui.q = ''; elClear.hidden = true;
    const groups = grouped(); renderChips(groups); renderFeatured(); renderSections(groups);
    elQ.focus();
  }
  elClear.addEventListener('click', clearSearch);

  function announce(t) { elLive.textContent = ''; if (t) setTimeout(() => { elLive.textContent = t; }, 30); }

  /* ---------- cliques ---------- */
  root.addEventListener('click', e => {
    const t = e.target.closest('button, a');
    if (!t || !root.contains(t)) return;
    if (t.dataset.cat && t.classList.contains('menu-chip')) {
      const sec = document.getElementById(secId(t.dataset.cat));
      if (sec) {
        ui.spyLock = Date.now() + 900;
        markChip(t.dataset.cat);
        sec.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      }
      return;
    }
    if (t.classList.contains('menu-hero-cta')) {
      e.preventDefault();
      const first = $('.menu-sec') || elSections;
      (elFeat.hidden ? first : elFeat).scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (t.hasAttribute('data-clearq')) { clearSearch(); return; }
    if (t.dataset.open) { openSheet(t.dataset.open, t); return; }
    if (t.dataset.add) {
      const p = S.product(t.dataset.add);
      if (!p || soldOut(p)) return;
      if (needsChoice(p)) { openSheet(p.id, t); return; }
      const src = t.closest('.menu-card, .menu-feat');
      addToCart(p, { qty: 1, options: [], removed: [], note: '' }, src && src.querySelector('.menu-media'));
      t.classList.remove('is-pop'); void t.offsetWidth; t.classList.add('is-pop');
      return;
    }
    if (t === elBar) { B.emit('cart:open'); return; }
  });

  /* ---------- carrinho ---------- */
  function cartKey(p, options, removed, note) {
    const sig = [p.id, options.map(o => o.groupName + ':' + o.name).sort().join(','), removed.slice().sort().join(','), note.trim()].join('|');
    return p.id + '-' + hash(sig).toString(36);
  }
  function addToCart(p, sel, fromEl) {
    const optTotal = sel.options.reduce((a, o) => a + num(o.price), 0);
    const unitPrice = Math.round((num(p.price) + optTotal) * 100) / 100;
    const item = {
      key: cartKey(p, sel.options, sel.removed, sel.note),
      productId: p.id,
      name: p.name,
      image: p.image || '',
      qty: sel.qty,
      unitPrice,
      options: sel.options,
      removed: sel.removed,
      note: sel.note.trim()
    };
    const before = ui.sawCartChanged;
    B.emit('cart:add', item);
    if (!ui.sawCartChanged && !before) {
      /* checkout ainda não respondeu: mostra uma prévia local até o primeiro cart:changed */
      ui.local.count += item.qty;
      ui.local.total += item.qty * unitPrice;
      setBar(ui.local.count, ui.local.total);
    }
    announce(`${item.qty}× ${p.name} adicionado ao carrinho`);
    fly(fromEl, p);
    return item;
  }
  function setBar(count, total) {
    ui.cart = { count, total };
    const on = count > 0;
    elBar.classList.toggle('is-on', on);
    elBar.setAttribute('aria-hidden', on ? 'false' : 'true');
    elBar.tabIndex = on ? 0 : -1;
    document.body.classList.toggle('menu-has-cartbar', on);
    $('.menu-cartbar-count', elBar).textContent = count;
    $('.menu-cartbar-total', elBar).textContent = brl(total);
    elBar.setAttribute('aria-label', `Ver carrinho: ${count} ${count === 1 ? 'item' : 'itens'}, total ${brl(total)}`);
  }
  B.on('cart:changed', d => {
    ui.sawCartChanged = true;
    d = d || {};
    let count = d.count;
    if (count == null && Array.isArray(d.items)) count = d.items.reduce((a, i) => a + num(i.qty), 0);
    const prev = ui.cart.count;
    setBar(num(count), num(d.total));
    if (num(count) > prev) bump();
  });
  function bump() {
    if (reduced()) return;
    elBar.classList.remove('is-bump'); void elBar.offsetWidth; elBar.classList.add('is-bump');
  }

  /* voo do item até a barra do carrinho */
  function fly(fromEl, p) {
    if (!fromEl || reduced() || !elBar.animate) { bump(); return; }
    const a = fromEl.getBoundingClientRect();
    if (!a.width) { bump(); return; }
    requestAnimationFrame(() => {
      /* posição final da bolinha de contagem, ignorando a transformação da barra (que pode estar entrando) */
      const wrap = elBar.parentElement.getBoundingClientRect();
      const cnt = $('.menu-cartbar-count', elBar);
      const target = { left: wrap.left + elBar.offsetLeft + cnt.offsetLeft, top: wrap.top + elBar.offsetTop + cnt.offsetTop, width: cnt.offsetWidth, height: cnt.offsetHeight };
      const size = Math.min(a.width, a.height, 160);
      const ghost = document.createElement('div');
      ghost.className = 'menu-fly';
      ghost.innerHTML = fromEl.innerHTML;
      Object.assign(ghost.style, { width: size + 'px', height: size + 'px', left: (a.left + a.width / 2 - size / 2) + 'px', top: (a.top + a.height / 2 - size / 2) + 'px' });
      root.appendChild(ghost);
      const dx = target.left + target.width / 2 - (a.left + a.width / 2);
      const dy = target.top + target.height / 2 - (a.top + a.height / 2);
      const anim = ghost.animate([
        { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1, borderRadius: '24%' },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(.6) rotate(-14deg)`, opacity: 1, borderRadius: '50%', offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(.12) rotate(10deg)`, opacity: .4, borderRadius: '50%' }
      ], { duration: 700, easing: 'cubic-bezier(.5,0,.3,1)' });
      anim.onfinish = () => { ghost.remove(); bump(); };
    });
  }

  /* ---------- detalhe do produto ---------- */
  function openSheet(pid, opener) {
    const p = S.product(pid);
    if (!p || !visible(p)) return;
    ui.sheet = { pid, qty: 1, removed: new Set(), sel: {}, note: '', opener: opener || document.activeElement };
    (p.options || []).forEach(g => { ui.sheet.sel[g.id] = {}; });
    elSheetRoot.innerHTML = sheetHTML(p);
    elSheetRoot.hidden = false;
    document.body.classList.add('menu-lock');
    root.classList.add('is-sheet');
    sweepBroken(elSheetRoot);
    requestAnimationFrame(() => {
      elSheetRoot.classList.add('is-open');
      const dlg = $('.menu-sheet', elSheetRoot);
      dlg.focus({ preventScroll: true });
    });
    updateSheet();
    document.addEventListener('keydown', sheetKeys, true);
  }
  function closeSheet(restore) {
    if (!ui.sheet) return;
    const opener = ui.sheet.opener;
    ui.sheet = null;
    document.removeEventListener('keydown', sheetKeys, true);
    document.body.classList.remove('menu-lock');
    root.classList.remove('is-sheet');
    elSheetRoot.classList.remove('is-open');
    const done = () => { if (!ui.sheet) { elSheetRoot.hidden = true; elSheetRoot.innerHTML = ''; } };
    if (reduced()) done(); else setTimeout(done, 260);
    if (restore !== false && opener && document.contains(opener)) opener.focus({ preventScroll: true });
    else if (restore !== false && opener && opener.dataset) {
      const again = root.querySelector(`[data-open="${CSS.escape(opener.dataset.open || opener.dataset.add || '')}"]`);
      if (again) again.focus({ preventScroll: true });
    }
  }
  function sheetKeys(e) {
    if (!ui.sheet) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
    if (e.key === 'Tab') {
      const dlg = $('.menu-sheet', elSheetRoot);
      const f = $$('button:not([disabled]), input:not([disabled]), textarea, [tabindex="0"]', dlg).filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function groupRule(g) {
    const min = num(g.min), max = groupMax(g);
    if (max === 1) return min >= 1 ? 'Escolha 1' : 'Escolha até 1';
    if (min >= 1 && max === Infinity) return `Escolha pelo menos ${min}`;
    if (min >= 1 && min === max) return `Escolha ${min}`;
    if (min >= 1) return `Escolha de ${min} a ${max}`;
    return max === Infinity ? 'Escolha quantos quiser' : `Escolha até ${max}`;
  }
  function sheetHTML(p) {
    const out = soldOut(p);
    const ing = (p.ingredients || []).filter(Boolean);
    const groups = (p.options || []).filter(g => (g.items || []).length);
    return `
      <div class="menu-sheet-backdrop" data-close></div>
      <div class="menu-sheet" role="dialog" aria-modal="true" aria-labelledby="menu-sheet-title" tabindex="-1">
        <button type="button" class="menu-sheet-x" data-close aria-label="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
        <div class="menu-sheet-scroll">
          <div class="menu-sheet-media">${media(p, 800, 600, true)}${badges(p)}</div>
          <div class="menu-sheet-content">
            <span class="menu-sec-kicker">${esc(catName(p.categoryId) || 'Cardápio')}</span>
            <h2 class="menu-sheet-title" id="menu-sheet-title">${esc(p.name)}</h2>
            ${p.description ? `<p class="menu-sheet-desc">${esc(p.description)}</p>` : ''}
            ${priceHTML(p, 'menu-price--big')}
            ${ing.length ? `
            <fieldset class="menu-group" data-ing>
              <legend class="menu-group-head"><span class="menu-group-name">Ingredientes</span><span class="menu-group-rule">Toque para tirar o que não quiser</span></legend>
              <div class="menu-ings">${ing.map((x, i) => `<button type="button" class="menu-ing" data-ing="${i}" aria-pressed="false"><span class="menu-ing-x" aria-hidden="true"></span><span class="menu-ing-sem">sem </span>${esc(x)}</button>`).join('')}</div>
            </fieldset>` : ''}
            ${groups.map(g => groupHTML(g)).join('')}
            <div class="menu-group menu-note">
              <label class="menu-group-name" for="menu-note">Alguma observação?</label>
              <textarea id="menu-note" maxlength="140" rows="2" placeholder="Ex.: ponto da carne, molho à parte…"></textarea>
              <span class="menu-note-n" aria-hidden="true">0/140</span>
            </div>
          </div>
        </div>
        <div class="menu-sheet-foot">
          <div class="menu-stepper" role="group" aria-label="Quantidade">
            <button type="button" class="menu-step" data-qty="-1" aria-label="Diminuir quantidade">−</button>
            <output class="menu-step-n" aria-live="polite">1</output>
            <button type="button" class="menu-step" data-qty="1" aria-label="Aumentar quantidade" ${out ? 'disabled' : ''}>+</button>
          </div>
          <button type="button" class="menu-cta" data-confirm ${out ? 'disabled' : ''}>
            <span class="menu-cta-label">${out ? 'Esgotado' : 'Adicionar'}</span><span class="menu-cta-total"></span>
          </button>
        </div>
      </div>`;
  }
  function groupHTML(g) {
    const min = num(g.min), max = groupMax(g);
    const req = min >= 1;
    const head = `<legend class="menu-group-head"><span class="menu-group-name">${esc(g.name)}</span><span class="menu-group-rule">${groupRule(g)}</span><span class="menu-group-badge ${req ? 'is-req' : ''}">${req ? 'Obrigatório' : 'Opcional'}</span></legend>`;
    let rows;
    if (max === 1) {
      const type = req ? 'radio' : 'checkbox';
      rows = g.items.map(it => `
        <label class="menu-opt">
          <input type="${type}" name="menu-g-${esc(g.id)}" data-g="${esc(g.id)}" data-it="${esc(it.id)}" class="menu-opt-input">
          <span class="menu-opt-mark" aria-hidden="true"></span>
          <span class="menu-opt-name">${esc(it.name)}</span>
          <span class="menu-opt-price">${num(it.price) ? '+ ' + brl(it.price) : 'grátis'}</span>
        </label>`).join('');
    } else {
      rows = g.items.map(it => `
        <div class="menu-opt menu-opt--step" data-g="${esc(g.id)}" data-it="${esc(it.id)}">
          <span class="menu-opt-name">${esc(it.name)}<span class="menu-opt-price">${num(it.price) ? '+ ' + brl(it.price) : 'grátis'}</span></span>
          <span class="menu-ministep">
            <button type="button" class="menu-ministep-b" data-step="-1" aria-label="Remover ${esc(it.name)}">−</button>
            <output class="menu-ministep-n" aria-label="Quantidade de ${esc(it.name)}">0</output>
            <button type="button" class="menu-ministep-b menu-ministep-plus" data-step="1" aria-label="Adicionar ${esc(it.name)}">+</button>
          </span>
        </div>`).join('');
    }
    return `<fieldset class="menu-group" data-group="${esc(g.id)}">${head}<div class="menu-opts">${rows}</div></fieldset>`;
  }

  function sheetSelection(p) {
    const sh = ui.sheet;
    const options = [];
    let missing = null;
    (p.options || []).forEach(g => {
      const sel = sh.sel[g.id] || {};
      let count = 0;
      (g.items || []).forEach(it => {
        const n = num(sel[it.id]);
        if (n > 0) {
          count += n;
          options.push({ groupName: g.name, name: n > 1 ? `${n}× ${it.name}` : it.name, price: Math.round(num(it.price) * n * 100) / 100 });
        }
      });
      if (count < num(g.min) && (g.items || []).length && !missing) missing = g;
    });
    const removed = (p.ingredients || []).filter((_, i) => sh.removed.has(i));
    return { options, removed, missing };
  }
  function updateSheet() {
    const sh = ui.sheet; if (!sh) return;
    const p = S.product(sh.pid); if (!p) return;
    const dlg = $('.menu-sheet', elSheetRoot);
    const { options, missing } = sheetSelection(p);
    const unit = num(p.price) + options.reduce((a, o) => a + num(o.price), 0);
    const out = soldOut(p);
    const maxQty = p.stock != null && num(p.stock) > 0 ? Math.min(99, num(p.stock)) : 99;
    if (sh.qty > maxQty) sh.qty = maxQty;
    $('.menu-step-n', dlg).textContent = sh.qty;
    $('[data-qty="-1"]', dlg).disabled = sh.qty <= 1;
    $('[data-qty="1"]', dlg).disabled = out || sh.qty >= maxQty;
    const cta = $('[data-confirm]', dlg);
    cta.disabled = out;
    cta.classList.toggle('is-blocked', !!missing && !out);
    cta.setAttribute('aria-disabled', missing || out ? 'true' : 'false');
    $('.menu-cta-label', dlg).textContent = out ? 'Esgotado' : (missing ? 'Escolha: ' + missing.name : 'Adicionar');
    $('.menu-cta-total', dlg).textContent = out || missing ? '' : brl(unit * sh.qty);
    /* estados dos grupos */
    (p.options || []).forEach(g => {
      const fs = dlg.querySelector(`[data-group="${CSS.escape(String(g.id))}"]`);
      if (!fs) return;
      const sel = sh.sel[g.id] || {};
      const count = Object.values(sel).reduce((a, n) => a + num(n), 0);
      const max = groupMax(g);
      fs.classList.toggle('is-done', num(g.min) >= 1 && count >= num(g.min));
      if (max > 1) {
        $$('.menu-opt--step', fs).forEach(row => {
          const n = num(sel[row.dataset.it]);
          row.classList.toggle('has-n', n > 0);
          $('.menu-ministep-n', row).textContent = n;
          $('[data-step="-1"]', row).disabled = n <= 0;
          $('[data-step="1"]', row).disabled = count >= max;
        });
      }
    });
  }
  function refreshSheet() {
    const sh = ui.sheet;
    const p = sh && S.product(sh.pid);
    if (!p || !visible(p)) { closeSheet(false); return; }
    updateSheet();
  }

  elSheetRoot.addEventListener('click', e => {
    const sh = ui.sheet; if (!sh) return;
    const p = S.product(sh.pid); if (!p) return;
    if (e.target.closest('[data-close]')) { closeSheet(); return; }
    const ing = e.target.closest('.menu-ing');
    if (ing) {
      const i = +ing.dataset.ing;
      if (sh.removed.has(i)) sh.removed.delete(i); else sh.removed.add(i);
      ing.setAttribute('aria-pressed', sh.removed.has(i) ? 'true' : 'false');
      return;
    }
    const step = e.target.closest('[data-step]');
    if (step) {
      const row = step.closest('.menu-opt--step');
      const g = (p.options || []).find(x => String(x.id) === row.dataset.g);
      const sel = sh.sel[g.id];
      const count = Object.values(sel).reduce((a, n) => a + num(n), 0);
      const d = +step.dataset.step;
      if (d > 0 && count >= groupMax(g)) return;
      sel[row.dataset.it] = Math.max(0, num(sel[row.dataset.it]) + d);
      updateSheet();
      if (step.disabled) $('[data-step]:not([disabled])', row) && $('[data-step]:not([disabled])', row).focus();
      return;
    }
    const q = e.target.closest('[data-qty]');
    if (q) { sh.qty = Math.max(1, sh.qty + +q.dataset.qty); updateSheet(); return; }
    if (e.target.closest('[data-confirm]')) {
      const { options, removed, missing } = sheetSelection(p);
      if (soldOut(p)) return;
      if (missing) {
        const fs = elSheetRoot.querySelector(`[data-group="${CSS.escape(String(missing.id))}"]`);
        if (fs) {
          fs.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
          fs.classList.remove('is-shake'); void fs.offsetWidth; fs.classList.add('is-shake');
          const first = fs.querySelector('input, button:not([disabled])');
          if (first) setTimeout(() => first.focus({ preventScroll: true }), reduced() ? 0 : 350);
        }
        announce('Escolha uma opção em ' + missing.name);
        return;
      }
      const mediaEl = $('.menu-sheet-media .menu-media', elSheetRoot);
      const opener = sh.opener;
      addToCart(p, { qty: sh.qty, options, removed, note: sh.note }, mediaEl);
      closeSheet(false);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    }
  });
  elSheetRoot.addEventListener('change', e => {
    const sh = ui.sheet; if (!sh) return;
    const inp = e.target.closest('.menu-opt-input');
    if (!inp) return;
    const sel = sh.sel[inp.dataset.g] = {};
    if (inp.type === 'checkbox') {
      $$(`.menu-opt-input[data-g="${CSS.escape(inp.dataset.g)}"]`, elSheetRoot).forEach(x => { if (x !== inp) x.checked = false; });
      if (inp.checked) sel[inp.dataset.it] = 1;
    } else if (inp.checked) sel[inp.dataset.it] = 1;
    updateSheet();
  });
  elSheetRoot.addEventListener('input', e => {
    if (e.target.id === 'menu-note' && ui.sheet) {
      ui.sheet.note = e.target.value;
      $('.menu-note-n', elSheetRoot).textContent = e.target.value.length + '/140';
    }
  });

  /* ---------- boot ---------- */
  setBar(0, 0);
  renderAll();
  S.subscribe(() => renderAll());

  /* API mínima para outros módulos/testes */
  window.GulosMenu = { open: openSheet, close: closeSheet, render: renderAll, parseHours, hoursStatus };
})();
