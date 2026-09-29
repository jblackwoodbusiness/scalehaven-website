
/* ── Event tracking: GA4 + Meta Pixel ──
   Every shTrack call goes to GA4. Named events are mirrored to the Meta
   Pixel so the ad account can build audiences and optimise. Both gtag()
   and fbq() are defined on every host but only send from production. */
var SH_FB_MAP = {
  lead_form_submit: ['track', 'Lead'],
  call_booked:      ['track', 'Schedule'],
  calendly_click:   ['trackCustom', 'CalendlyClick'],
  scorecard_start:  ['trackCustom', 'ScorecardStart'],
  roi_calc_start:   ['trackCustom', 'RoiCalcStart']
};
window.shTrack = function (name, params) {
  try { if (typeof gtag === 'function') gtag('event', name, params || {}); } catch (e) {}
  try {
    var m = SH_FB_MAP[name];
    if (m && typeof fbq === 'function') fbq(m[0], m[1], params || {});
  } catch (e) {}
};
document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest ? e.target.closest('a[href*="calendly.com"]') : null;
  if (!a) return;
  var loc = a.closest('nav') ? 'nav' : a.closest('footer') ? 'footer' : a.closest('.sh-inline-cta') ? 'inline_cta' : a.closest('.mobile-menu') ? 'mobile_menu' : 'body';
  var sec = a.closest('section'); if (loc === 'body' && sec && sec.id) loc = 'section_' + sec.id;
  window.shTrack('calendly_click', {
    link_url: a.href, page_path: location.pathname, link_location: loc,
    link_text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  });
});

/* First interaction with the two lead tools (funnel top for lead_form_submit) */
(function () {
  var fired = {};
  function once(name) { if (fired[name]) return; fired[name] = true; window.shTrack(name, { page_path: location.pathname }); }
  var quiz = document.getElementById('quizView');
  if (quiz) quiz.addEventListener('click', function (e) { if (e.target.closest('input, button, label, select')) once('scorecard_start'); }, true);
  var roi = document.querySelector('.roi-input, .roi-range');
  if (roi) document.addEventListener('input', function (e) { if (e.target.closest('.roi-input, .roi-range')) once('roi_calc_start'); }, true);
})();

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

/* ── INLINE SCORECARD CTA (blog posts) ───────────────────── */
/* Replaced the scroll pop-up (Sep 2026): 309 shows, 2 clicks, 0 from the
   US or Canada. This sits in the article flow and never blocks reading.
   Booking a call stays the primary goal, so it carries a Calendly link too. */
(function () {
  if (location.pathname.indexOf('/blog/') !== 0) return;
  var article = document.querySelector('.article-body');
  if (!article) return;
  if (article.querySelector('a[href*="/med-spa-marketing-scorecard"]')) return; // post already pitches it
  try { if (localStorage.getItem('sh_lead_captured')) return; } catch (e) {}

  var heads = Array.prototype.filter.call(article.querySelectorAll('h2'), function (h) { return h.parentNode === article; });
  if (heads.length < 4) return;
  var i = Math.ceil(heads.length / 2);
  while (i > 1 && /frequently asked|faq/i.test(heads[i].textContent)) i--;

  var el = document.createElement('aside');
  el.className = 'sh-inline-cta';
  el.setAttribute('aria-label', 'Free Med Spa Marketing Scorecard');
  el.innerHTML =
    '<div class="sh-inline-dial" aria-hidden="true">' +
      '<svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="27" class="sh-dial-track"/><circle cx="32" cy="32" r="27" class="sh-dial-fill"/></svg>' +
      '<span>?</span>' +
    '</div>' +
    '<div class="sh-inline-copy">' +
      '<span class="sh-inline-eyebrow">Free 2-minute scorecard</span>' +
      '<p class="sh-inline-h">How does your clinic\'s marketing <em>score?</em></p>' +
      '<p class="sh-inline-p">12 questions. An instant score out of 100, plus the fixes that would book you the most consultations.</p>' +
      '<div class="sh-inline-actions">' +
        '<a href="/med-spa-marketing-scorecard/" class="btn-gold sh-inline-btn">Get My Score &rarr;</a>' +
        '<a href="https://calendly.com/john-scalehaven/30min" target="_blank" rel="noopener noreferrer" class="sh-inline-alt">Or skip ahead and book a call</a>' +
      '</div>' +
    '</div>';
  article.insertBefore(el, heads[i]);

  el.querySelector('.sh-inline-btn').addEventListener('click', function () {
    window.shTrack('inline_cta_click', { page_path: location.pathname });
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      el.classList.add('seen');
      window.shTrack('inline_cta_view', { page_path: location.pathname });
    }, { threshold: 0.6 });
    io.observe(el);
  } else { el.classList.add('seen'); }
})();

/* ── CONTACT LEAD FORM (AJAX → Netlify) ──────────────── */
(function() {
  function encode(data) {
    return Object.keys(data).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
    }).join('&');
  }
  document.querySelectorAll('.sh-leadform').forEach(function (form) {
    var pageField = form.querySelector('input[name="page"]');
    if (pageField) pageField.value = location.pathname;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fields = form.querySelectorAll('input[name], select[name], textarea[name]');
      var data = {};
      var valid = true;
      fields.forEach(function (el) {
        if (el.type === 'hidden' || el.name === 'bot-field') { data[el.name] = el.value; return; }
        var v = el.value.trim();
        if (el.required && !v) valid = false;
        if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) valid = false;
        data[el.name] = v;
      });
      if (!valid) { form.classList.add('sh-leadform-invalid'); return; }
      form.classList.remove('sh-leadform-invalid');
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(data)
      }).catch(function () {})
        .finally(function () {
          try { localStorage.setItem('sh_lead_captured', '1'); } catch (e) {}
          form.classList.add('sh-leadform-done');
          window.shTrack('lead_form_submit', { form_name: form.getAttribute('name') || 'contact', page_path: location.pathname });
        });
    });
  });
})();
