// Side Pocket Apparel — Cart Module
(function() {
  'use strict';

  const CART_KEY = 'sp_cart';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || { items: [] }; }
    catch { return { items: [] }; }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
  }

  function addItem(product, qty) {
    qty = qty || 1;
    const cart = getCart();
    const existing = cart.items.find(i => i.id === product.id);
    if (existing) { existing.qty += qty; }
    else { cart.items.push({ id: product.id, sku: product.sku, name: product.name, price: product.price, image: product.image, qty }); }
    saveCart(cart);
    return cart;
  }

  function removeItem(productId) {
    const cart = getCart();
    cart.items = cart.items.filter(i => i.id !== productId);
    saveCart(cart);
    return cart;
  }

  function updateQty(productId, qty) {
    const cart = getCart();
    const item = cart.items.find(i => i.id === productId);
    if (item) {
      if (qty <= 0) return removeItem(productId);
      item.qty = qty;
    }
    saveCart(cart);
    return cart;
  }

  function clearCart() {
    const cart = { items: [] };
    saveCart(cart);
    return cart;
  }

  function getTotal() {
    return getCart().items.reduce((sum, i) => sum + (i.price * i.qty), 0);
  }

  function getCount() {
    return getCart().items.reduce((sum, i) => sum + i.qty, 0);
  }

  async function checkout() {
    const cart = getCart();
    if (!cart.items.length) { showToast('Your cart is empty'); return; }
    const items = cart.items.map(i => ({ name: i.name, price: i.price, qty: i.qty }));
    try {
      const cfg = await fetch('/api/config', { headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(r => r.json()).catch(() => ({}));
      if (cfg.stripePublishableKey) {
        const res = await fetch('/api/stripe/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ items }),
          credentials: 'include'
        });
        if (res.status === 401) { showToast('Please log in to checkout'); typeof openAuthModal !== 'undefined' && openAuthModal(); return; }
        const data = await res.json();
        if (data.url) { window.location = data.url; return; }
      }
    } catch (e) { console.warn('Stripe checkout error', e); }
    showToast('Checkout coming soon!');
  }

  function showToast(msg, type) {
    type = type || 'info';
    const existing = document.querySelector('.sp-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'sp-toast sp-toast--' + type;
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;background:#2563eb;color:#fff;padding:.75rem 1.25rem;border-radius:8px;z-index:9999;font-family:Inter,sans-serif;font-size:.875rem;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,.4);animation:fadeInUp .3s ease;';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, 2800);
  }

  // Expose globally
  window.SPCart = { getCart, addItem, removeItem, updateQty, clearCart, getTotal, getCount, checkout, showToast };
})();
