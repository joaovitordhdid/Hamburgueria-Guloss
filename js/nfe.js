/* =============================================================================
   Gulos — window.GulosNFe — ponto de integração da nota fiscal / cupom automático
   -----------------------------------------------------------------------------
   API PÚBLICA (usada pelo checkout e pelo painel do dono):

   GulosNFe.emit(order) -> Promise<invoice>
       Emite o documento do pedido conforme GulosStore.get().config.fiscal:
       • provider 'simulado' (ou sem apiToken/cnpj): gera localmente um
         "Cupom de pedido (não é documento fiscal)", status 'simulada',
         com numeração sequencial (fiscal.proximoNumero é incrementado e salvo).
       • provider 'focusnfe' | 'enotas': monta o payload real da NFC-e e envia
         para o SEU backend (fiscal.backendUrl). O backend é quem fala com o
         provedor usando o token. Se o envio falhar, devolve o cupom local com
         status 'pendente' e guarda o payload em invoice.payload para reenvio.
       Nunca rejeita: sempre resolve com um invoice (para o pedido não travar).
       Não grava no pedido — quem chama faz GulosStore.updateOrder(id,{invoice}).

   GulosNFe.renderReceipt(invoice) -> string (HTML)
       Cupom estilo bobina térmica 80mm, com botão "Imprimir" (window.print com
       folha de impressão restrita ao cupom) e QR Code da consulta SEFAZ.
       Pode ser inserido em qualquer lugar (innerHTML). O botão funciona por
       delegação de eventos, sem precisar de JS extra.

   GulosNFe.buildFocusPayload(order, fiscal?) -> object  (corpo de POST /v2/nfce?ref=REF)
   GulosNFe.buildEnotasPayload(order, fiscal?) -> object (corpo da NFC-e na eNotas)
   GulosNFe.sendToBackend(url, payload) -> Promise<object> (POST JSON; rejeita em erro/timeout)
   GulosNFe.print(element)          imprime só aquele cupom
   GulosNFe.qrSvg(text, opts?)      SVG de QR Code (usa qrcode-generator do cdnjs se
                                    carregado; senão um codificador local, offline)
   GulosNFe.loadQRLib() -> Promise  carrega qrcode-generator@1.4.4 do cdnjs (opcional)
   GulosNFe.paymentLabel(method)    'pix' -> 'PIX', etc.

   Formato do invoice:
   { tipo:'cupom'|'nfce', status:'simulada'|'pendente'|'autorizada'|'erro',
     provider, ambiente, numero, serie, ref, orderId, emitidaEm (ISO),
     chave (44 dígitos), chaveFormatada ('0000 0000 ...'), urlConsulta, qrcode,
     protocolo?, mensagem, emitente:{nome,cnpj,ie,endereco,telefone},
     consumidor:{nome,cpf}, itens:[{descricao,detalhes,qtd,unitario,total}],
     subtotal, deliveryFee, discount, total, modo,
     pagamento:{method,label,valor,changeFor?,troco?}, payload?, erro? }

   ⚠️ SEGURANÇA: o token da Focus NFe / eNotas NUNCA pode ficar no navegador.
   Qualquer pessoa veria o token no código da página e poderia emitir notas no
   CNPJ da loja. Por isso a emissão real é feita por um backend (ex.: função
   serverless/Supabase Edge Function) que recebe { provider, ambiente, ref,
   payload }, chama o provedor com o token guardado no servidor e devolve
   { status, numero, serie, chave_nfe, url_consulta / qrcode_url, protocolo }.
   ============================================================================= */
(function () {
  'use strict';

  const QR_LIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  const PAY_LABEL = { pix: 'PIX', credito: 'Cartão de crédito', debito: 'Cartão de débito', dinheiro: 'Dinheiro' };
  // Códigos tPag da NFC-e (tabela SEFAZ): 01 dinheiro, 03 crédito, 04 débito, 17 PIX.
  const PAY_CODE = { dinheiro: '01', credito: '03', debito: '04', pix: '17' };

  const store = () => (window.GulosStore ? window.GulosStore.get() : {});
  const fiscalCfg = () => {
    const s = store();
    s.config = s.config || {};
    s.config.fiscal = s.config.fiscal || { provider: 'simulado', proximoNumero: 1, serie: 1 };
    return s.config.fiscal;
  };
  const money = v => Math.round((Number(v) || 0) * 100) / 100;
  const brl = v => (window.GulosStore ? window.GulosStore.brl(v) : 'R$ ' + money(v).toFixed(2).replace('.', ','));
  const digits = s => String(s || '').replace(/\D/g, '');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n, len) => String(n).padStart(len, '0');

  function itemDetails(it) {
    const parts = [];
    (it.options || []).forEach(o => parts.push('+ ' + o.name));
    (it.removed || []).forEach(r => parts.push('sem ' + r));
    if (it.note) parts.push('obs: ' + it.note);
    return parts.join(', ');
  }

  /* ---------- chave de acesso (44 dígitos, estrutura oficial + DV mod 11) ---------- */
  function mod11(num) {
    let sum = 0, w = 2;
    for (let i = num.length - 1; i >= 0; i--) { sum += Number(num[i]) * w; w = w === 9 ? 2 : w + 1; }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  }
  function accessKey(fiscal, numero, date) {
    const cUF = pad(fiscal.cUF || 35, 2);                     // 35 = SP (configurável em fiscal.cUF)
    const aamm = pad(date.getFullYear() % 100, 2) + pad(date.getMonth() + 1, 2);
    const cnpj = pad(digits(fiscal.cnpj).slice(0, 14), 14);
    const cNF = pad(Math.floor(Math.random() * 1e8), 8);
    const base = cUF + aamm + cnpj + '65' + pad(fiscal.serie || 1, 3) + pad(numero, 9) + '1' + cNF;
    return base + mod11(base);
  }
  const groupKey = k => String(k).replace(/(\d{4})(?=\d)/g, '$1 ');

  function nextNumber() {
    const f = fiscalCfg();
    const n = Number(f.proximoNumero) || 1;
    f.proximoNumero = n + 1;
    if (window.GulosStore) window.GulosStore.save();
    return n;
  }

  /* ---------- invoice local (simulada / pendente) ---------- */
  function buildLocalInvoice(order, status, extra) {
    const f = fiscalCfg();
    const s = store().store || {};
    const numero = nextNumber();
    const now = new Date();
    const chave = accessKey(f, numero, now);
    const urlConsulta = f.urlConsulta || 'https://www.nfce.fazenda.sp.gov.br/consulta';
    const amb = f.ambiente === 'producao' ? 1 : 2;
    const pay = order.payment || {};
    const total = money(order.total);
    const inv = {
      tipo: 'cupom',
      status,
      provider: f.provider || 'simulado',
      ambiente: f.ambiente || 'homologacao',
      numero,
      serie: f.serie || 1,
      ref: order.id,
      orderId: order.id,
      emitidaEm: now.toISOString(),
      chave,
      chaveFormatada: groupKey(chave),
      urlConsulta,
      qrcode: urlConsulta + '?p=' + chave + '|2|' + amb + '|SIMULACAO',
      mensagem: status === 'pendente'
        ? 'NFC-e pendente: o envio ao emissor fiscal falhou. Cupom provisório gerado; reemita pelo painel.'
        : 'Cupom de pedido (não é documento fiscal). SIMULAÇÃO.',
      emitente: { nome: s.name || 'Hamburgueria Gulos', cnpj: f.cnpj || '', ie: f.ie || '', endereco: s.address || '', telefone: s.phone || '' },
      consumidor: { nome: (order.customer && order.customer.name) || '', cpf: (order.customer && order.customer.cpf) || '' },
      itens: (order.items || []).map(it => ({
        descricao: it.name, detalhes: itemDetails(it), qtd: it.qty,
        unitario: money(it.unitPrice), total: money(it.unitPrice * it.qty)
      })),
      subtotal: money(order.subtotal),
      deliveryFee: money(order.deliveryFee),
      discount: money(order.discount),
      total,
      modo: order.mode,
      pagamento: {
        method: pay.method, label: PAY_LABEL[pay.method] || pay.method || '',
        valor: pay.method === 'dinheiro' && pay.changeFor ? money(pay.changeFor) : total,
        changeFor: pay.changeFor || null,
        troco: pay.method === 'dinheiro' && pay.changeFor ? money(pay.changeFor - total) : 0
      }
    };
    return Object.assign(inv, extra || {});
  }

  /* ---------- Focus NFe: corpo de POST https://api.focusnfe.com.br/v2/nfce?ref=REF ----------
     (homologação: https://homologacao.focusnfe.com.br). Autenticação HTTP Basic com o token
     como usuário — POR ISSO SÓ NO SERVIDOR. Tributação padrão de lanchonete no Simples
     Nacional (CSOSN 102, NCM 2106.90.90, CFOP 5102); confirme com o contador da loja. */
  function buildFocusPayload(order, fiscal) {
    const f = fiscal || fiscalCfg();
    const c = order.customer || {};
    const pay = order.payment || {};
    const total = money(order.total);
    const delivery = order.mode === 'entrega';
    const items = (order.items || []).map((it, i) => {
      const unit = money(it.unitPrice);
      const det = itemDetails(it);
      return {
        numero_item: i + 1,
        codigo_produto: String(it.productId || i + 1),
        descricao: (it.name + (det ? ' (' + det + ')' : '')).slice(0, 120),
        cfop: '5102',
        unidade_comercial: 'UN',
        quantidade_comercial: it.qty,
        valor_unitario_comercial: unit,
        unidade_tributavel: 'UN',
        quantidade_tributavel: it.qty,
        valor_unitario_tributavel: unit,
        valor_bruto: money(unit * it.qty),
        codigo_ncm: '21069090',
        icms_situacao_tributaria: '102',
        icms_origem: 0
      };
    });
    const forma = { forma_pagamento: PAY_CODE[pay.method] || '99', valor_pagamento: total };
    if (pay.method === 'credito' || pay.method === 'debito') forma.tipo_integracao = '2'; // maquininha não integrada
    if (pay.method === 'dinheiro' && pay.changeFor) forma.valor_pagamento = money(pay.changeFor);
    const payload = {
      natureza_operacao: 'VENDA AO CONSUMIDOR',
      data_emissao: new Date().toISOString(),
      tipo_documento: 1,
      // 1 = presencial; 4 = NFC-e em operação com entrega a domicílio
      presenca_comprador: delivery ? '4' : '1',
      consumidor_final: 1,
      finalidade_emissao: 1,
      cnpj_emitente: digits(f.cnpj),
      modalidade_frete: delivery && order.deliveryFee > 0 ? '0' : '9',
      local_destino: 1,
      items,
      formas_pagamento: [forma]
    };
    if (delivery && order.deliveryFee > 0) payload.valor_frete = money(order.deliveryFee);
    if (order.discount) payload.valor_desconto = money(order.discount);
    if (pay.method === 'dinheiro' && pay.changeFor) payload.valor_troco = money(pay.changeFor - total);
    if (digits(c.cpf)) payload.cpf_destinatario = digits(c.cpf);
    if (c.name) payload.nome_destinatario = c.name.slice(0, 60);
    return payload;
  }

  /* ---------- eNotas: corpo de POST https://api.enotasgw.com.br/v2/empresas/{empresaId}/nfc-e ----
     (cabeçalho Authorization: Basic {apiKey} — também só no servidor). Campos conforme a
     documentação pública da eNotas; revise impostos com o contador. */
  function buildEnotasPayload(order, fiscal) {
    const f = fiscal || fiscalCfg();
    const c = order.customer || {};
    const pay = order.payment || {};
    const total = money(order.total);
    const tipo = { pix: 'PagamentoInstantaneoPIX', credito: 'CartaoDeCredito', debito: 'CartaoDeDebito', dinheiro: 'Dinheiro' }[pay.method] || 'Outros';
    return {
      id: order.id,
      ambienteEmissao: f.ambiente === 'producao' ? 'Producao' : 'Homologacao',
      pedido: {
        presencaConsumidor: order.mode === 'entrega' ? 'EntregaDomicilio' : 'Presencial',
        pagamento: {
          tipo: 'PagamentoAVista',
          formas: [{ tipo, valor: pay.method === 'dinheiro' && pay.changeFor ? money(pay.changeFor) : total }],
          valorTroco: pay.method === 'dinheiro' && pay.changeFor ? money(pay.changeFor - total) : 0
        }
      },
      cliente: digits(c.cpf) ? { nome: c.name || '', cpfCnpj: digits(c.cpf) } : undefined,
      itens: (order.items || []).map((it, i) => ({
        cfop: '5102', codigo: String(it.productId || i + 1), descricao: it.name.slice(0, 120), ncm: '21069090',
        quantidade: it.qty, unidadeMedida: 'UN', valorUnitario: money(it.unitPrice),
        impostos: { icms: { situacaoTributaria: '102', origem: 0 } }
      })),
      valorFrete: order.mode === 'entrega' ? money(order.deliveryFee) : 0,
      valorDesconto: money(order.discount)
    };
  }

  /* ---------- envio ao backend da loja (stub configurável) ----------
     O backend deve responder JSON. Para Focus NFe, repasse a resposta (status 'autorizado',
     numero, serie, chave_nfe, caminho_danfe, qrcode_url, url_consulta_nf, protocolo). */
  function sendToBackend(url, payload, timeoutMs) {
    if (!url) return Promise.reject(new Error('fiscal.backendUrl não configurado'));
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctrl && ctrl.abort(), timeoutMs || 15000);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(r => {
      clearTimeout(t);
      if (!r.ok) throw new Error('Backend fiscal respondeu HTTP ' + r.status);
      return r.json();
    }, e => { clearTimeout(t); throw e; });
  }

  function emit(order) {
    return new Promise(resolve => {
      const f = fiscalCfg();
      const provider = String(f.provider || 'simulado').toLowerCase();
      const real = (provider === 'focusnfe' || provider === 'enotas') && f.apiToken && digits(f.cnpj);
      if (!real) { resolve(buildLocalInvoice(order, 'simulada')); return; }

      const payload = provider === 'enotas' ? buildEnotasPayload(order, f) : buildFocusPayload(order, f);
      // Nunca enviamos o apiToken: o backend tem o seu próprio, guardado no servidor.
      const body = { provider, ambiente: f.ambiente || 'homologacao', ref: order.id, payload };
      sendToBackend(f.backendUrl, body).then(res => {
        const st = String((res && (res.status || res.status_sefaz)) || '').toLowerCase();
        const ok = /autoriza/.test(st);
        const inv = buildLocalInvoice(order, ok ? 'autorizada' : 'pendente', { payload: ok ? undefined : body });
        inv.tipo = 'nfce';
        if (res) {
          if (res.numero) inv.numero = Number(res.numero);
          if (res.serie) inv.serie = Number(res.serie);
          const ch = digits(res.chave_nfe || res.chave || res.chaveAcesso);
          if (ch.length === 44) { inv.chave = ch; inv.chaveFormatada = groupKey(ch); }
          if (res.qrcode_url) inv.qrcode = res.qrcode_url;
          if (res.url_consulta_nf) inv.urlConsulta = res.url_consulta_nf;
          if (res.protocolo) inv.protocolo = res.protocolo;
          if (res.caminho_danfe) inv.danfeUrl = res.caminho_danfe;
        }
        inv.mensagem = ok ? 'NFC-e autorizada pela SEFAZ.' : 'NFC-e em processamento pelo emissor (' + (st || 'sem status') + ').';
        resolve(inv);
      }).catch(err => {
        resolve(buildLocalInvoice(order, 'pendente', { payload: body, erro: String(err && err.message || err) }));
      });
    });
  }

  /* =========================== QR Code =========================== */
  let qrLibPromise = null;
  function loadQRLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (qrLibPromise) return qrLibPromise;
    qrLibPromise = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = QR_LIB_URL;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve(window.qrcode || null);
      s.onerror = () => resolve(null);       // sem internet/CDN: usamos o codificador local
      document.head.appendChild(s);
      setTimeout(() => resolve(window.qrcode || null), 6000);
    });
    return qrLibPromise;
  }

  /* Codificador QR local (modo byte, correção M, versões 1–25) — fallback offline. */
  const LocalQR = (function () {
    const ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28];
    const BLK_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21];
    const rawModules = v => {
      let r = (16 * v + 128) * v + 64;
      if (v >= 2) { const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; }
      return r;
    };
    const dataCw = v => Math.floor(rawModules(v) / 8) - ECC_M[v] * BLK_M[v];
    const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; };
    function rsDivisor(deg) {
      const r = []; for (let i = 0; i < deg - 1; i++) r.push(0); r.push(1);
      let root = 1;
      for (let i = 0; i < deg; i++) {
        for (let j = 0; j < r.length; j++) { r[j] = gmul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
        root = gmul(root, 2);
      }
      return r;
    }
    function rsRem(data, div) {
      const r = div.map(() => 0);
      data.forEach(b => { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); });
      return r;
    }
    function utf8(str) { return Array.from(new TextEncoder().encode(str)); }

    function encode(text) {
      const bytes = utf8(text);
      let ver = 1;
      for (; ver <= 25; ver++) {
        const cc = ver < 10 ? 8 : 16;
        if (4 + cc + bytes.length * 8 <= dataCw(ver) * 8) break;
      }
      if (ver > 25) throw new Error('Texto longo demais para o QR local');
      const cap = dataCw(ver) * 8;
      const bits = [];
      const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
      put(0, Math.min(4, cap - bits.length));
      put(0, (8 - bits.length % 8) % 8);
      for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
      const data = [];
      for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }

      // blocos + ECC + intercalação
      const nb = BLK_M[ver], el = ECC_M[ver], raw = Math.floor(rawModules(ver) / 8);
      const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(el);
      const blocks = [];
      for (let i = 0, k = 0; i < nb; i++) {
        const dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += dat.length;
        const ecc = rsRem(dat, div);
        if (i < nShort) dat.push(0);
        blocks.push(dat.concat(ecc));
      }
      const cw = [];
      for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) cw.push(b[i]); });

      const size = ver * 4 + 17;
      const mod = [], fn = [];
      for (let y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
      const set = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
      for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
      [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
        }
      });
      if (ver > 1) {
        const na = Math.floor(ver / 7) + 2;
        const step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
        const pos = [6]; for (let p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
        pos.forEach((ay, i) => pos.forEach((ax, j) => {
          if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) return;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }));
      }
      const drawFormat = mask => {
        const d = (0 << 3) | mask; let r = d;            // nível M = 00
        for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        const b = ((d << 10) | r) ^ 0x5412, g = i => ((b >>> i) & 1) === 1;
        for (let i = 0; i <= 5; i++) set(8, i, g(i));
        set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
        for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
        for (let i = 0; i < 8; i++) set(size - 1 - i, 8, g(i));
        for (let i = 8; i < 15; i++) set(8, size - 15 + i, g(i));
        set(8, size - 8, true);
      };
      drawFormat(0);
      if (ver >= 7) {
        let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
        const b = (ver << 12) | r;
        for (let i = 0; i < 18; i++) { const bit = ((b >>> i) & 1) === 1, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bit); set(c, a, bit); }
      }
      // dados em zigue-zague
      let bi = 0;
      for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
          const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
          if (!fn[y][x] && bi < cw.length * 8) { mod[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
        }
      }
      const maskFn = [
        (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
        (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
        (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
      ];
      const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] = !mod[y][x]; };
      const penalty = () => {
        let p = 0, dark = 0;
        for (let y = 0; y < size; y++) {
          let rx = 1, ry = 1;
          for (let x = 0; x < size; x++) {
            if (mod[y][x]) dark++;
            if (x > 0) {
              if (mod[y][x] === mod[y][x - 1]) { rx++; if (rx === 5) p += 3; else if (rx > 5) p++; } else rx = 1;
              if (mod[x][y] === mod[x - 1][y]) { ry++; if (ry === 5) p += 3; else if (ry > 5) p++; } else ry = 1;
            }
            if (x > 0 && y > 0 && mod[y][x] === mod[y][x - 1] && mod[y][x] === mod[y - 1][x] && mod[y][x] === mod[y - 1][x - 1]) p += 3;
          }
        }
        p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
        return p;
      };
      let best = 0, bestP = Infinity;
      for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const pv = penalty(); if (pv < bestP) { bestP = pv; best = m; } applyMask(m); }
      applyMask(best); drawFormat(best);
      return mod;
    }
    return { encode, _rsRem: rsRem, _rsDivisor: rsDivisor };
  })();

  function matrixToSvg(get, count, opts) {
    const o = opts || {}, q = o.quiet == null ? 4 : o.quiet, dim = count + q * 2;
    let d = '';
    for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (get(y, x)) d += 'M' + (x + q) + ' ' + (y + q) + 'h1v1h-1z';
    return '<svg class="' + esc(o.className || 'nfe-qr') + '" viewBox="0 0 ' + dim + ' ' + dim + '" role="img" aria-label="' + esc(o.label || 'QR Code') +
      '" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#111"/></svg>';
  }

  function qrSvg(text, opts) {
    try {
      if (window.qrcode) {
        const qr = window.qrcode(0, 'M'); qr.addData(unescape(encodeURIComponent(text))); qr.make();
        return matrixToSvg((r, c) => qr.isDark(r, c), qr.getModuleCount(), opts);
      }
      const m = LocalQR.encode(text);
      return matrixToSvg((r, c) => m[r][c], m.length, opts);
    } catch (e) {
      return '<div class="nfe-qr nfe-qr--ph" role="img" aria-label="QR Code indisponível">QR</div>';
    }
  }

  /* =========================== Cupom (HTML) =========================== */
  function fmtDate(iso) {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function fmtCnpj(c) {
    const d = digits(c);
    return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : c;
  }

  function renderReceipt(inv) {
    if (!inv) return '<p class="nfe-empty">Nenhum cupom emitido para este pedido.</p>';
    const fiscal = inv.status === 'autorizada';
    const sim = inv.status === 'simulada';
    const e = inv.emitente || {};
    const title = fiscal
      ? 'DANFE NFC-e<br><small>Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</small>'
      : inv.status === 'pendente'
        ? 'CUPOM PROVISÓRIO<br><small>NFC-e pendente de autorização</small>'
        : 'CUPOM DE PEDIDO<br><small>Não é documento fiscal</small>';
    const rows = (inv.itens || []).map((it, i) =>
      '<tr><td class="nfe-c">' + pad(i + 1, 3) + '</td><td>' + esc(it.descricao) +
      (it.detalhes ? '<div class="nfe-det">' + esc(it.detalhes) + '</div>' : '') +
      '<div class="nfe-det">' + it.qtd + ' UN x ' + brl(it.unitario) + '</div></td><td class="nfe-r">' + brl(it.total) + '</td></tr>').join('');
    const qtd = (inv.itens || []).reduce((s, it) => s + (Number(it.qtd) || 0), 0);
    const p = inv.pagamento || {};
    const cpf = inv.consumidor && inv.consumidor.cpf;
    const modo = inv.modo === 'entrega' ? 'Entrega' : inv.modo === 'retirada' ? 'Retirada no balcão' : '';
    return '' +
      '<div class="nfe-wrap">' +
      '<article class="nfe-receipt" aria-label="Cupom do pedido ' + esc(inv.orderId) + '">' +
      (sim || inv.status === 'pendente' ? '<div class="nfe-stamp" aria-hidden="true">' + (sim ? 'SIMULAÇÃO' : 'PENDENTE') + '</div>' : '') +
      '<header class="nfe-head"><strong class="nfe-store">' + esc(e.nome) + '</strong>' +
      (e.cnpj ? '<div>CNPJ ' + esc(fmtCnpj(e.cnpj)) + (e.ie ? ' · IE ' + esc(e.ie) : '') + '</div>' : '') +
      (e.endereco ? '<div>' + esc(e.endereco) + '</div>' : '') +
      (e.telefone ? '<div>Tel. ' + esc(e.telefone) + '</div>' : '') + '</header>' +
      '<div class="nfe-title">' + title + '</div>' +
      '<div class="nfe-meta"><span>Pedido <b>#' + esc(inv.orderId) + '</b></span><span>' + esc(modo) + '</span></div>' +
      '<table class="nfe-items"><thead><tr><th class="nfe-c">#</th><th>Descrição</th><th class="nfe-r">Total</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<dl class="nfe-tot">' +
      '<div><dt>Qtd. total de itens</dt><dd>' + qtd + '</dd></div>' +
      '<div><dt>Subtotal</dt><dd>' + brl(inv.subtotal) + '</dd></div>' +
      (inv.deliveryFee ? '<div><dt>Taxa de entrega</dt><dd>' + brl(inv.deliveryFee) + '</dd></div>' : '') +
      (inv.discount ? '<div><dt>Desconto</dt><dd>-' + brl(inv.discount) + '</dd></div>' : '') +
      '<div class="nfe-big"><dt>VALOR A PAGAR</dt><dd>' + brl(inv.total) + '</dd></div>' +
      '<div><dt>Forma de pagamento</dt><dd>' + esc(p.label) + '</dd></div>' +
      '<div><dt>Valor pago</dt><dd>' + brl(p.valor) + '</dd></div>' +
      (p.troco ? '<div><dt>Troco</dt><dd>' + brl(p.troco) + '</dd></div>' : '') +
      '</dl>' +
      '<div class="nfe-sec"><b>CONSUMIDOR</b><br>' +
      (cpf ? 'CPF: ' + esc(cpf) : 'CONSUMIDOR NÃO IDENTIFICADO') +
      (inv.consumidor && inv.consumidor.nome ? '<br>' + esc(inv.consumidor.nome) : '') + '</div>' +
      '<div class="nfe-sec nfe-center">' +
      '<b>' + (fiscal ? 'NFC-e' : 'Cupom') + ' nº ' + pad(inv.numero, 6) + ' · Série ' + pad(inv.serie, 3) + '</b><br>' +
      'Emissão: ' + esc(fmtDate(inv.emitidaEm)) + '<br>' +
      (inv.protocolo ? 'Protocolo: ' + esc(inv.protocolo) + '<br>' : '') +
      (inv.ambiente !== 'producao' ? '<i>Ambiente de homologação — sem valor fiscal</i><br>' : '') +
      'Consulte pela chave de acesso em<br><span class="nfe-url">' + esc(inv.urlConsulta) + '</span>' +
      '<div class="nfe-key">' + esc(inv.chaveFormatada || groupKey(inv.chave || '')) + '</div>' +
      (sim ? '<div class="nfe-simnote">CHAVE FICTÍCIA — SIMULAÇÃO</div>' : '') +
      '</div>' +
      '<div class="nfe-qrbox">' + qrSvg(inv.qrcode || inv.urlConsulta || '', { label: 'QR Code da consulta SEFAZ' }) +
      '<small>' + (fiscal ? 'Consulta via leitor de QR Code' : 'QR Code ilustrativo (simulação)') + '</small></div>' +
      (inv.mensagem ? '<p class="nfe-msg">' + esc(inv.mensagem) + '</p>' : '') +
      '<footer class="nfe-foot">Obrigado pela preferência! 🍔</footer>' +
      '</article>' +
      '<div class="nfe-actions nfe-noprint">' +
      '<button type="button" class="nfe-print" data-nfe-print>' +
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M7 3h10v4H7zM5 8h14a3 3 0 0 1 3 3v6h-4v4H6v-4H2v-6a3 3 0 0 1 3-3zm3 8v3h8v-3zm10-5.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>' +
      'Imprimir cupom</button>' +
      (inv.danfeUrl ? '<a class="nfe-print nfe-print--ghost" href="' + esc(inv.danfeUrl) + '" target="_blank" rel="noopener">Abrir DANFE oficial</a>' : '') +
      '</div></div>';
  }

  function print(el) {
    const target = el && (el.classList.contains('nfe-receipt') ? el : el.querySelector('.nfe-receipt'));
    if (!target) { window.print(); return; }
    document.querySelectorAll('.nfe-print-target').forEach(n => n.classList.remove('nfe-print-target'));
    target.classList.add('nfe-print-target');
    document.documentElement.classList.add('nfe-printing');
    const done = () => {
      document.documentElement.classList.remove('nfe-printing');
      target.classList.remove('nfe-print-target');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  }

  document.addEventListener('click', ev => {
    const btn = ev.target.closest && ev.target.closest('[data-nfe-print]');
    if (btn) { ev.preventDefault(); print(btn.closest('.nfe-wrap') || document); }
  });

  window.GulosNFe = {
    emit, renderReceipt, buildFocusPayload, buildEnotasPayload, sendToBackend,
    print, qrSvg, loadQRLib, paymentLabel: m => PAY_LABEL[m] || m,
    _localQR: LocalQR, _accessKey: accessKey
  };
  loadQRLib();
})();
