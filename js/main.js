/* ===================================
   Side Pocket Apparel — Main JS
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
const hamburger   = document.querySelector('.hamburger');
const mobileMenu  = document.querySelector('.mobile-menu');

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close on link click
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
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

/* ---------- Cart State ---------- */
const cart = {
  items: JSON.parse(localStorage.getItem('sp_cart') || '[]'),

  save() {
    localStorage.setItem('sp_cart', JSON.stringify(this.items));
    this.updateBadge();
  },

  add(product) {
    const existing = this.items.find(
      i => i.id === product.id && i.size === product.size
    );
    if (existing) {
      existing.qty += 1;
    } else {
      this.items.push({ ...product, qty: 1 });
    }
    this.save();
    this.render();
    showToast(`"${product.name}" added to cart`);
  },

  remove(id, size) {
    this.items = this.items.filter(i => !(i.id === id && i.size === size));
    this.save();
    this.render();
  },

  changeQty(id, size, delta) {
    const item = this.items.find(i => i.id === id && i.size === size);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) this.remove(id, size);
    else { this.save(); this.render(); }
  },

  total() {
    return this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  },

  updateBadge() {
    const total = this.items.reduce((s, i) => s + i.qty, 0);
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = total;
      el.style.display = total > 0 ? 'flex' : 'none';
    });
  },

  render() {
    const body = document.querySelector('.cart-body');
    if (!body) return;

    if (!this.items.length) {
      body.innerHTML = `
        <div class="cart-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <p>Your cart is empty</p>
          <a href="shop.html" class="btn btn-outline" onclick="closeCart()">Browse Collection</a>
        </div>`;
      document.querySelector('.cart-footer').style.display = 'none';
      return;
    }

    document.querySelector('.cart-footer').style.display = 'block';
    body.innerHTML = `<div class="cart-items">${this.items.map(item => `
      <div class="cart-item">
        <div class="cart-item-img">${item.emoji || '👕'}</div>
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-variant">Size: ${item.size}</div>
          <div class="cart-item-price-row">
            <span class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</span>
            <div class="cart-qty">
              <button class="qty-btn" onclick="cart.changeQty('${item.id}','${item.size}',-1)">−</button>
              <span class="qty-num">${item.qty}</span>
              <button class="qty-btn" onclick="cart.changeQty('${item.id}','${item.size}',1)">+</button>
            </div>
          </div>
        </div>
      </div>`).join('')}
    </div>`;

    const subtotalEl = document.querySelector('.cart-subtotal-value');
    if (subtotalEl) subtotalEl.textContent = `$${this.total().toFixed(2)}`;
  }
};

/* Init badge */
cart.updateBadge();

/* ---------- Cart Sidebar ---------- */
const cartOverlay = document.querySelector('.cart-overlay');
const cartSidebar = document.querySelector('.cart-sidebar');

function openCart() {
  cartOverlay?.classList.add('open');
  cartSidebar?.classList.add('open');
  cart.render();
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartOverlay?.classList.remove('open');
  cartSidebar?.classList.remove('open');
  document.body.style.overflow = '';
}

window.openCart  = openCart;
window.closeCart = closeCart;
window.cart      = cart;

document.querySelector('.cart-overlay')?.addEventListener('click', closeCart);
document.querySelector('.cart-close')?.addEventListener('click', closeCart);
document.querySelector('.nav-icon-btn[aria-label="Cart"]')?.addEventListener('click', openCart);

document.querySelector('.cart-checkout-btn')?.addEventListener('click', () => {
  if (cart.items.length === 0) return;
  showToast('Checkout coming soon! Stay tuned.');
});

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

/* ---------- Quick Add to Cart ---------- */
document.addEventListener('click', e => {
  const btn = e.target.closest('.quick-add-btn');
  if (!btn) return;
  const card = btn.closest('.product-card');
  if (!card) return;

  cart.add({
    id:    card.dataset.id,
    name:  card.dataset.name,
    price: parseFloat(card.dataset.price),
    size:  'M',
    emoji: card.dataset.emoji || '👕'
  });
});

/* ---------- Shop Filter Tabs ---------- */
const filterTabs = document.querySelectorAll('.filter-tab');
const productCards = document.querySelectorAll('.product-card[data-category]');

filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const cat = tab.dataset.filter;
    productCards.forEach(card => {
      const show = cat === 'all' || card.dataset.category === cat;
      card.style.display = show ? '' : 'none';
    });
  });
});

/* ---------- Sort Select ---------- */
const sortSelect = document.querySelector('.sort-select');
if (sortSelect) {
  sortSelect.addEventListener('change', () => {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;
    const cards = [...grid.querySelectorAll('.product-card')];
    cards.sort((a, b) => {
      const val = sortSelect.value;
      const pa  = parseFloat(a.dataset.price || 0);
      const pb  = parseFloat(b.dataset.price || 0);
      if (val === 'price-asc')  return pa - pb;
      if (val === 'price-desc') return pb - pa;
      return 0; // default / featured
    });
    cards.forEach(c => grid.appendChild(c));
  });
}

/* ---------- Newsletter Form ---------- */
const newsletterForms = document.querySelectorAll('.newsletter-form');
newsletterForms.forEach(form => {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = form.querySelector('.newsletter-input');
    if (!input?.value) return;
    showToast(`You're subscribed! Check ${input.value} for a welcome email.`);
    input.value = '';
  });
});

/* ---------- Contact Form ---------- */
const contactForm = document.querySelector('.contact-form-el');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    showToast('Message sent! We\'ll get back to you within 24 hours.');
    contactForm.reset();
  });
}

/* ---------- Intersection Observer (fade-in) ---------- */
const fadeTargets = document.querySelectorAll('.product-card, .testimonial-card, .category-card, .timeline-item, .team-card');
if (fadeTargets.length && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
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
