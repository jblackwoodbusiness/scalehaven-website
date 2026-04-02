/* ════════════════════════════════════════════════════════════
   ScaleHaven — Shared JavaScript
   ════════════════════════════════════════════════════════════ */

/* ── MOBILE MENU TOGGLE ─────────────────────────────────── */
function toggleMobileMenu() {
  var menu = document.getElementById('mobileMenu');
  var btn = document.querySelector('.hamburger');
  menu.classList.toggle('open');
  btn.classList.toggle('active');
  document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
}

/* ── SCROLL REVEAL (IntersectionObserver) ────────────────── */
var revealObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(function(el) {
  revealObserver.observe(el);
});

/* ── RESPONSIVE GRID HELPER ──────────────────────────────── */
function applyResponsive() {
  var w = window.innerWidth;
  document.querySelectorAll('.responsive-grid').forEach(function(el) {
    el.style.gridTemplateColumns = w < 900 ? '1fr' : '1fr 1fr';
    el.style.gap = w < 900 ? '3rem' : '5rem';
  });
  document.querySelectorAll('.responsive-3col').forEach(function(el) {
    el.style.gridTemplateColumns = w < 768 ? '1fr' : w < 1024 ? 'repeat(2,1fr)' : 'repeat(3,1fr)';
  });
}

applyResponsive();
window.addEventListener('resize', applyResponsive);

/* ── FAQ ACCORDION ───────────────────────────────────────── */
document.querySelectorAll('.faq-question').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var item = this.closest('.faq-item');
    var wasOpen = item.classList.contains('open');
    // Close all other FAQ items
    document.querySelectorAll('.faq-item.open').forEach(function(openItem) {
      openItem.classList.remove('open');
    });
    // Toggle clicked item
    if (!wasOpen) {
      item.classList.add('open');
    }
  });
});
