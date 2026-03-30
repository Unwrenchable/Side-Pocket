/* ===================================
   Side Pocket Apparel — Main JS
   Delegates cart state to SPCart (scripts/cart.js).
   Handles nav, cart UI, toasts, and page interactions.
   =================================== */

'use strict';

/* ---------- Sticky Nav ---------- */
const header = document.querySelector('.site-header');
if (header) {
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

/* ---------- Mobile Menu ---------- */
const hamburger  = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
  });
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---------- Active Nav Link ---------- */
(function highlightNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

/* ---------- Toast ---------- */
function showToast(msg) {
  const container = document.querySelector('.toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
    <span class="toast-msg">${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}
window.showToast = showToast;

/* ---------- Cart Sidebar ---------- */
const cartOverlay = document.querySelector('.cart-overlay');
const cartSidebar = document.querySelector('.cart-sidebar');

function renderCartSidebar() {
  const body   = document.querySelector('.cart-body');
  const footer = document.querySelector('.cart-footer');
  if (!body) return;

  const cart  = window.SPCart ? window.SPCart.getCart() : { items: [] };
  const items = cart.items || [];

  if (!items.length) {
    body.innerHTML = `
      <div class="cart-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <p>Your cart is empty</p>
        <a href="shop.html" class="btn btn-outline" onclick="closeCart()">Browse Collection</a>
      </div>`;
    if (footer) footer.style.display = 'none';
    return;
  }

  if (footer) footer.style.display = 'block';
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  body.innerHTML = `<div class="cart-items">${items.map(item => `
    <div class="cart-item">
      <div class="cart-item-img" style="background:url('${item.image || ''}') center/cover no-repeat;background-color:#1e1e1e"></div>
      <div class="cart-item-details">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price-row">
          <span class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</span>
          <div class="cart-qty">
            <button class="qty-btn" onclick="SPCart.updateQty(${item.id},${item.qty - 1});renderCartSidebar()">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" onclick="SPCart.updateQty(${item.id},${item.qty + 1});renderCartSidebar()">+</button>
          </div>
        </div>
      </div>
    </div>`).join('')}</div>`;

  const subtotalEl = document.querySelector('.cart-subtotal-value');
  if (subtotalEl) subtotalEl.textContent = `$${total.toFixed(2)}`;
}

function openCart() {
  cartOverlay?.classList.add('open');
  cartSidebar?.classList.add('open');
  renderCartSidebar();
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartOverlay?.classList.remove('open');
  cartSidebar?.classList.remove('open');
  document.body.style.overflow = '';
}

window.openCart          = openCart;
window.closeCart         = closeCart;
window.renderCartSidebar = renderCartSidebar;

cartOverlay?.addEventListener('click', closeCart);
document.querySelector('.cart-close')?.addEventListener('click', closeCart);
document.querySelector('.nav-icon-btn[aria-label="Cart"]')?.addEventListener('click', openCart);

document.querySelector('.cart-checkout-btn')?.addEventListener('click', async () => {
  if (!window.SPCart || !window.SPCart.getCount()) return;
  await window.SPCart.checkout();
});

/* Update cart badge whenever cart changes */
function updateCartBadge() {
  const count = window.SPCart ? window.SPCart.getCount() : 0;
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}
window.addEventListener('cart:updated', updateCartBadge);
document.addEventListener('DOMContentLoaded', updateCartBadge);

/* ---------- Quick Add (static product cards) ---------- */
document.addEventListener('click', e => {
  const btn = e.target.closest('.quick-add-btn');
  if (!btn || !window.SPCart) return;
  const card = btn.closest('.product-card');
  if (!card) return;
  const product = {
    id:    card.dataset.id,
    sku:   card.dataset.sku || card.dataset.id,
    name:  card.dataset.name,
    price: parseFloat(card.dataset.price),
    image: card.dataset.image || ''
  };
  window.SPCart.addItem(product, 1);
  showToast(`"${product.name}" added to cart 🎱`);
});

/* ---------- Shop Filter Tabs (static grids) ---------- */
const filterTabs  = document.querySelectorAll('.filter-tab');
const staticCards = document.querySelectorAll('.product-card[data-category]');

filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const cat = tab.dataset.filter;
    staticCards.forEach(card => {
      card.style.display = (cat === 'all' || card.dataset.category === cat) ? '' : 'none';
    });
  });
});

/* ---------- Sort Select (static grids) ---------- */
const sortSelect = document.querySelector('.sort-select');
if (sortSelect) {
  sortSelect.addEventListener('change', () => {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;
    const cards = [...grid.querySelectorAll('.product-card')];
    cards.sort((a, b) => {
      const pa = parseFloat(a.dataset.price || 0);
      const pb = parseFloat(b.dataset.price || 0);
      if (sortSelect.value === 'price-asc')  return pa - pb;
      if (sortSelect.value === 'price-desc') return pb - pa;
      return 0;
    });
    cards.forEach(c => grid.appendChild(c));
  });
}

/* ---------- Contact Form ---------- */
const contactForm = document.querySelector('.contact-form-el');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    showToast("Message sent! We'll get back to you within 24 hours.");
    contactForm.reset();
  });
}

/* ---------- Intersection Observer (fade-in) ---------- */
if ('IntersectionObserver' in window) {
  const fadeTargets = document.querySelectorAll(
    '.product-card, .testimonial-card, .category-card, .timeline-item, .team-card, .contact-info-card'
  );
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  fadeTargets.forEach(el => {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}
