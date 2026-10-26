/* Barramento simples entre módulos (menu → carrinho → checkout → painel). */
(function () {
  const map = {};
  window.GulosBus = {
    on(evt, fn) { (map[evt] = map[evt] || []).push(fn); },
    emit(evt, data) { (map[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }
  };
})();
