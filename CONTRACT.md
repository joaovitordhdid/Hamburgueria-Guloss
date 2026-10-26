# Contrato entre módulos — site Hamburgueria Gulos

Static site, vanilla HTML/CSS/JS, no build step, no frameworks. All UI text in Brazilian Portuguese.
Root: /home/claude/gulos. Open index.html directly. Must work at phone width (360px) with no horizontal scroll, and on desktop.
Only external resources allowed: Google Fonts (already linked) and scripts from cdnjs.cloudflare.com / cdn.jsdelivr.net/npm with exact pinned versions (e.g. chart.js@4.4.1). Everything else inline/local.

## Shared files (DO NOT edit; owned by the lead)
- index.html: mounts #app-menu, #app-checkout, #app-admin; loads css/base.css, css/menu.css, css/checkout.css, css/admin.css and js/data.js, store.js, bus.js, menu.js, nfe.js, checkout.js, admin.js in that order (plain <script>, no modules).
- css/base.css: color/radius/font tokens (--bg, --surface, --surface-2, --line, --text, --muted, --brand, --brand-2, --danger, --ok, --radius, --radius-sm, --shadow, --font-display, --font-body). Use these tokens; light/dark already handled.
- js/data.js: window.GULOS_SEED (currently a 3-product placeholder; will be replaced with ~real menu of same shape, maybe 40+ products, images as relative paths "img/xxx.jpg" or '' when missing — always handle missing image gracefully with a nice fallback).
- js/store.js: window.GulosStore — get(), save(), subscribe(fn), reset(), brl(v), product(id), activeProducts(), updateProduct(id,patch), addProduct(p), removeProduct(id), placeOrder(order), updateOrder(id,patch). Read the file for details.
- js/bus.js: window.GulosBus.on(evt, fn) / emit(evt, data).

## Data shapes
store: {name, logo, banner, address, phone, hours, deliveryFee, minOrder}
category: {id, name}
product: {id, categoryId, name, description, price, oldPrice|null, image, ingredients:[string], options:[{id,name,min,max,items:[{id,name,price}]}], stock, minStock, cost, active}
state.config: {deliveryFee, minOrder, admin:{email, passHash}, fiscal:{provider, apiToken, cnpj, ie, ambiente, serie, proximoNumero}}
order: {id, createdAt, status, mode:'entrega'|'retirada', customer:{name, cpf, phone, email?, address:{cep, street, number, complement, district, city, reference}, geo:{lat,lng,accuracy}|null}, items:[cartItem], subtotal, deliveryFee, discount, total, payment:{method:'pix'|'credito'|'debito'|'dinheiro', changeFor?}, invoice:{...}|null}
cartItem: {key, productId, name, image, qty, unitPrice (base + options), options:[{groupName, name, price}], removed:[ingredient], note}

## Events on GulosBus
- 'cart:add' (cartItem)  — emitted by menu when the customer adds a product. Checkout owns the cart.
- 'cart:changed' ({count, total, items}) — emitted by checkout whenever the cart changes. Menu shows a floating cart bar / badge using it.
- 'cart:open' () — anyone can emit; checkout opens the cart drawer.
- 'order:placed' (order) — emitted by checkout after GulosStore.placeOrder.
- 'admin:open' () — opens owner login/panel.
- GulosStore.subscribe(fn) fires after every save(): menu must re-render when the owner edits products/prices/stock (products with active=false or stock<=0 show as "Esgotado"/hidden).

## Ownership (each agent edits ONLY its own files)
- Design agent: js/menu.js, css/menu.css. Renders into #app-menu.
- Payment agent: js/checkout.js, js/nfe.js, css/checkout.css. Renders into #app-checkout.
- Panel agent: js/admin.js, css/admin.css. Renders into #app-admin.
Prefix all your CSS classes with your module (menu-, co-, adm-) so nothing collides. Do not style bare elements globally.
Z-index layers: menu content 1–50, menu floating cart bar 60, checkout drawer/modals 100–199, admin overlay 200–299, toasts 300.
