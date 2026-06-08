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

/* ── RESPONSIVE GRID ────────────────────────────────────── */
/* Handled entirely via CSS media queries in main.css.
   No JS layout reads needed — eliminates forced reflow. */

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

/* ── SCORECARD SCROLL POP-UP ─────────────────────────────── */
(function() {
  var KEY = 'sh_popup_dismissed';
  var DAYS = 7;
  // Never show on the scorecard page itself
  if (location.pathname.indexOf('med-spa-marketing-scorecard') !== -1) return;
  // Respect a recent dismissal
  try {
    var ts = parseInt(localStorage.getItem(KEY) || '0', 10);
    if (ts && (Date.now() - ts) < DAYS * 86400000) return;
  } catch (e) {}

  var shown = false;

  function remember() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }

  function build() {
    var o = document.createElement('div');
    o.className = 'sh-popup-overlay';
    o.innerHTML =
      '<div class="sh-popup" role="dialog" aria-modal="true" aria-label="Free Med Spa Marketing Scorecard">' +
        '<button class="sh-popup-close" aria-label="Close">&times;</button>' +
        '<span class="sh-popup-eyebrow">Free 2-Minute Scorecard</span>' +
        '<h3>How healthy is your <em>clinic\'s marketing?</em></h3>' +
        '<p>Answer 12 quick questions and get an instant score — plus a personalized action plan to book more consultations.</p>' +
        '<a href="/med-spa-marketing-scorecard/" class="btn-gold">Take the Free Scorecard &rarr;</a>' +
        '<button class="sh-popup-dismiss">No thanks, maybe later</button>' +
      '</div>';
    document.body.appendChild(o);

    function dismiss() {
      o.classList.remove('show');
      remember();
      document.removeEventListener('keydown', onEsc);
      setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 400);
    }
    function onEsc(e) { if (e.key === 'Escape') dismiss(); }

    o.querySelector('.sh-popup-close').addEventListener('click', dismiss);
    o.querySelector('.sh-popup-dismiss').addEventListener('click', dismiss);
    o.querySelector('.btn-gold').addEventListener('click', remember); // don't reshow after they click through
    o.addEventListener('click', function (e) { if (e.target === o) dismiss(); });
    document.addEventListener('keydown', onEsc);

    requestAnimationFrame(function () { o.classList.add('show'); });
  }

  function trigger() {
    if (shown) return;
    shown = true;
    window.removeEventListener('scroll', onScroll);
    build();
  }

  function onScroll() {
    var st = window.pageYOffset || document.documentElement.scrollTop;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h > 0 && (st / h) > 0.45) trigger();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  setTimeout(trigger, 35000); // fallback: show after 35s even without deep scroll
})();
