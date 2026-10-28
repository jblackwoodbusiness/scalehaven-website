
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

/* ── INLINE BOOK-A-CALL CTA (blog posts) ─────────────────── */
/* Sits in the article flow and never blocks reading. Oct 2026: the call is now
   the primary action and the scorecard the fallback. As a scorecard-first card
   it drew 3 clicks from 124 views. Leads with the Texas case study. */
(function () {
  if (location.pathname.indexOf('/blog/') !== 0) return;
  var article = document.querySelector('.article-body');
  if (!article) return;

  var heads = Array.prototype.filter.call(article.querySelectorAll('h2'), function (h) { return h.parentNode === article; });
  if (heads.length < 4) return;
  var i = Math.ceil(heads.length / 2);
  while (i > 1 && /frequently asked|faq/i.test(heads[i].textContent)) i--;

  var el = document.createElement('aside');
  el.className = 'sh-inline-cta';
  el.setAttribute('aria-label', 'Book a free strategy call');
  el.innerHTML =
    '<div class="sh-inline-dial sh-inline-dial--stat" aria-hidden="true">' +
      '<svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="27" class="sh-dial-track"/><circle cx="32" cy="32" r="27" class="sh-dial-fill"/></svg>' +
      '<span>11x</span>' +
    '</div>' +
    '<div class="sh-inline-copy">' +
      '<span class="sh-inline-eyebrow">Real result &middot; a Texas med spa</span>' +
      '<p class="sh-inline-h">$2,500 in ads. <em>$28,000</em> in first-visit revenue.</p>' +
      '<p class="sh-inline-p">30 days, Google and Meta together, about $50 per new patient. Want the plan for your clinic? We guarantee 15+ booked consultations in month one, or we work free until you hit it.</p>' +
      '<div class="sh-inline-actions">' +
        '<a href="https://calendly.com/john-scalehaven/30min" target="_blank" rel="noopener noreferrer" class="btn-gold sh-inline-btn">Book a Free Call &rarr;</a>' +
        '<a href="/med-spa-marketing-scorecard/" class="sh-inline-alt">Not ready? Score your marketing first</a>' +
      '</div>' +
    '</div>';
  article.insertBefore(el, heads[i]);

  el.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    window.shTrack('inline_cta_click', { page_path: location.pathname, cta_target: a.classList.contains('sh-inline-btn') ? 'call' : 'scorecard' });
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

/* ── CLICK-TO-PLAY VIDEO (.sh-video) ──────────────────────
   The markup ships a poster + play button only. On tap we create the
   <video>, pick 720p on phones or Save-Data, and play with native controls.
   Nothing autoplays and no video bytes load before the tap. */
document.addEventListener('click', function (e) {
  var btn = e.target && e.target.closest ? e.target.closest('.sh-video-play') : null;
  if (!btn) return;
  var box = btn.closest('.sh-video');
  if (!box || box.querySelector('video')) return;
  var conn = navigator.connection || {};
  var small = window.innerWidth <= 768 || conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');
  var src = (small && box.getAttribute('data-src-720')) || box.getAttribute('data-src-1080');
  var name = box.getAttribute('data-video') || 'video';
  var v = document.createElement('video');
  v.src = src;
  v.poster = box.getAttribute('data-poster') || '';
  v.controls = true;
  v.preload = 'auto';
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.setAttribute('controlslist', 'nodownload');
  box.appendChild(v);
  box.classList.add('is-playing');
  var p = v.play();
  if (p && typeof p.catch === 'function') p.catch(function () {});
  window.shTrack('video_play', { video_name: name, page_path: location.pathname, quality: /720/.test(src) ? '720p' : '1080p' });
  var fired = {};
  v.addEventListener('timeupdate', function () {
    if (!v.duration) return;
    var pct = v.currentTime / v.duration;
    [25, 50, 75].forEach(function (m) {
      if (pct * 100 >= m && !fired[m]) { fired[m] = true; window.shTrack('video_progress', { video_name: name, percent: m, page_path: location.pathname }); }
    });
  });
  v.addEventListener('ended', function () { window.shTrack('video_complete', { video_name: name, page_path: location.pathname }); });
});
