/* Gulos — camada de dados compartilhada (cardápio, estoque, pedidos, config).
   Tudo fica em localStorage para rodar sem servidor. Para produção, troque
   load/save por chamadas a um backend (ex.: Supabase) mantendo esta mesma API. */
(function () {
  const KEY = 'gulos:v1';
  const listeners = new Set();

  function seed() {
    const base = JSON.parse(JSON.stringify(window.GULOS_SEED));
    base.products.forEach(p => {
      if (p.stock == null) p.stock = 50;
      if (p.minStock == null) p.minStock = 10;
      if (p.cost == null) p.cost = Math.round(p.price * 0.42 * 100) / 100;
      if (p.active == null) p.active = true;
    });
    return {
      store: base.store,
      categories: base.categories,
      products: base.products,
      orders: [],
      config: {
        deliveryFee: base.store.deliveryFee ?? 5,
        minOrder: base.store.minOrder ?? 0,
        // Credenciais padrão do painel: troque no primeiro acesso.
        admin: { email: 'dono@gulos.com', passHash: null },
        fiscal: { provider: 'simulado', apiToken: '', cnpj: '', ie: '', ambiente: 'homologacao', serie: 1, proximoNumero: 1 }
      }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return seed();
  }

  let state = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
  }

  const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  window.GulosStore = {
    get: () => state,
    save,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    reset() { state = seed(); save(); },
    brl,
    product: id => state.products.find(p => p.id === id),
    activeProducts: () => state.products.filter(p => p.active),
    updateProduct(id, patch) {
      const p = state.products.find(x => x.id === id);
      if (p) Object.assign(p, patch);
      save();
      return p;
    },
    addProduct(p) {
      p.id = p.id || 'p' + Date.now().toString(36);
      state.products.push(Object.assign({ stock: 50, minStock: 10, cost: 0, active: true, options: [], ingredients: [] }, p));
      save();
      return p;
    },
    removeProduct(id) {
      state.products = state.products.filter(p => p.id !== id);
      save();
    },
    /* order = { items:[{productId,name,qty,unitPrice,options:[...],removed:[...],note}], customer:{...},
                 subtotal, deliveryFee, total, payment, mode:'entrega'|'retirada' } */
    placeOrder(order) {
      order.id = 'G' + String(state.orders.length + 1).padStart(5, '0');
      order.createdAt = new Date().toISOString();
      order.status = 'recebido';
      order.items.forEach(it => {
        const p = state.products.find(x => x.id === it.productId);
        if (p) p.stock = Math.max(0, (p.stock || 0) - it.qty);
      });
      state.orders.push(order);
      save();
      return order;
    },
    updateOrder(id, patch) {
      const o = state.orders.find(x => x.id === id);
      if (o) Object.assign(o, patch);
      save();
      return o;
    }
  };
})();
