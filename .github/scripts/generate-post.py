#!/usr/bin/env python3
"""
generate-post.py — Generates a queue-ready blog post HTML file from a content dict.
Usage: Called programmatically or via stdin JSON.
"""

import json, sys, textwrap
from pathlib import Path

TEMPLATE = '''<!--META tag="{tag}" excerpt="{excerpt}" read_time="{read_time}"-->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} | ScaleHaven</title>
  <meta name="description" content="{excerpt}" />
  <meta name="robots" content="index, follow" />
  <meta name="author" content="John Blackwood, ScaleHaven" />
  <link rel="canonical" href="https://scalehaven.io/blog/{slug}/" />

  <meta property="og:type" content="article" />
  <meta property="og:title" content="{title} | ScaleHaven" />
  <meta property="og:description" content="{excerpt}" />
  <meta property="og:url" content="https://scalehaven.io/blog/{slug}/" />
  <meta property="og:site_name" content="ScaleHaven" />
  <meta property="og:image" content="https://scalehaven.io/brand_assets/scalehaven_logo_transparent.webp" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title} | ScaleHaven" />
  <meta name="twitter:description" content="{twitter_desc}" />
  <meta name="twitter:image" content="https://scalehaven.io/brand_assets/scalehaven_logo_transparent.webp" />

  <link rel="icon" type="image/png" href="/brand_assets/scalehaven_mark_transparent.webp" />
  <link rel="apple-touch-icon" href="/brand_assets/scalehaven_mark_transparent.webp" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preconnect" href="https://widgets.leadconnectorhq.com" />
  <link rel="preconnect" href="https://services.leadconnectorhq.com" />
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Work+Sans:wght@300;400;500;600;700&display=swap" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Work+Sans:wght@300;400;500;600;700&display=swap" media="print" onload="this.media='all'" />
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Work+Sans:wght@300;400;500;600;700&display=swap" /></noscript>
  <link rel="preload" as="style" href="/styles/main.css" />
  <link rel="stylesheet" href="/styles/main.css" />

  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "BreadcrumbList",
        "itemListElement": [
          {{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://scalehaven.io/" }},
          {{ "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://scalehaven.io/blog/" }},
          {{ "@type": "ListItem", "position": 3, "name": "{breadcrumb_name}", "item": "https://scalehaven.io/blog/{slug}/" }}
        ]
      }},
      {{
        "@type": "BlogPosting",
        "headline": "{title}",
        "description": "{excerpt}",
        "author": {{ "@type": "Organization", "name": "ScaleHaven", "url": "https://scalehaven.io" }},
        "publisher": {{ "@type": "Organization", "name": "ScaleHaven", "url": "https://scalehaven.io", "logo": {{ "@type": "ImageObject", "url": "https://scalehaven.io/brand_assets/scalehaven_logo_transparent.webp" }} }},
        "datePublished": "{{{{TODAY}}}}",
        "dateModified": "{{{{TODAY}}}}",
        "mainEntityOfPage": {{ "@type": "WebPage", "@id": "https://scalehaven.io/blog/{slug}/" }}
      }}
    ]
  }}
  </script>
</head>
<body>

  <!-- NAV -->
  <nav>
    <div class="nav-inner">
      <a href="/" aria-label="ScaleHaven"><img src="/brand_assets/scalehaven_logo_transparent.webp" alt="ScaleHaven — Med Spa & Aesthetic Clinic Marketing" width="96" height="60" style="height:60px;" /></a>
      <div class="nav-links">
        <a href="/med-spa-lead-generation" class="nav-link">Lead Generation</a>
        <a href="/med-spa-facebook-ads" class="nav-link">Meta Ads</a>
        <a href="/botox-clinic-marketing" class="nav-link">Treatments</a>
        <a href="/blog" class="nav-link" style="color:var(--navy);">Blog</a>
      </div>
      <button class="hamburger" onclick="toggleMobileMenu()" aria-label="Open menu"><span></span><span></span><span></span></button>
      <a href="https://calendly.com/john-scalehaven/30min" target="_blank" rel="noopener noreferrer" class="btn-nav">Book a Free Call</a>
    </div>
  </nav>
  <div class="mobile-menu" id="mobileMenu">
    <a href="/med-spa-lead-generation" onclick="toggleMobileMenu()">Lead Generation</a>
    <a href="/med-spa-facebook-ads" onclick="toggleMobileMenu()">Meta Ads</a>
    <a href="/botox-clinic-marketing" onclick="toggleMobileMenu()">Treatments</a>
    <a href="/dermatology-marketing" onclick="toggleMobileMenu()">Dermatology</a>
    <a href="/aesthetic-clinic-marketing" onclick="toggleMobileMenu()">Aesthetic Clinics</a>
    <a href="/blog" onclick="toggleMobileMenu()">Blog</a>
    <a href="https://calendly.com/john-scalehaven/30min" target="_blank" rel="noopener noreferrer" class="btn-gold" style="margin-top:1rem;">Book a Free Call</a>
  </div>


  <!-- HERO -->
  <section class="page-hero">
    <div class="ghost-text" aria-hidden="true">{ghost_text}</div>
    <div class="container" style="position:relative; z-index:1;">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a><span>/</span><a href="/blog">Blog</a><span>/</span><span class="current">{breadcrumb_name}</span>
      </nav>
      <div style="max-width:680px;">
        <span class="eyebrow" style="color:rgba(192,149,64,0.85); margin-bottom:1rem;">{eyebrow}</span>
        <div class="gold-rule" style="margin-bottom:1.5rem; background:linear-gradient(90deg,var(--gold),transparent); width:3rem;"></div>
        <h1 style="font-family:'Cormorant Garamond',Georgia,serif; font-size:clamp(2.25rem,4.5vw,3.75rem); font-weight:600; line-height:1.08; letter-spacing:-0.03em; color:#fff; margin-bottom:1.25rem;">
          {h1_html}
        </h1>
        <p style="font-size:0.875rem; color:rgba(255,255,255,0.5); letter-spacing:0.04em;"><time datetime="{{{{TODAY}}}}">{{{{TODAY_HUMAN}}}}</time> &middot; {read_time} min read</p>
      </div>
    </div>
  </section>


  <!-- ARTICLE -->
  <section style="background:var(--cream); padding:5rem 0 4rem;">
    <div class="container">
      <article class="article-body reveal">
{body_html}
      </article>

      <div class="author-box reveal">
        <h3>About ScaleHaven</h3>
        <p>{author_bio}</p>
        <a href="/">Learn more about ScaleHaven &rarr;</a>
      </div>
    </div>
  </section>


  <!-- RELATED POSTS -->
  <section style="background:var(--cream-light); padding:5rem 0 6rem;">
    <div class="container">
      <div style="text-align:center; margin-bottom:3rem;">
        <span class="eyebrow" style="margin-bottom:1rem;">Keep Reading</span>
        <h2 class="section-h reveal">Related <em>Articles</em></h2>
      </div>
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; max-width:1100px; margin:0 auto;" class="responsive-3col">
{related_html}
      </div>
    </div>
  </section>


  <!-- CTA -->
  <section class="section-cta">
    <div class="container">
      <div style="max-width:2.5rem; margin:0 auto 2rem;">
        <img src="/brand_assets/scalehaven_mark_transparent.webp" alt="" width="40" height="40" style="width:100%;" />
      </div>
      <h2 class="cta-h reveal" style="margin-bottom:1.5rem;">
        {cta_h2}
      </h2>
      <p class="reveal reveal-d1" style="font-size:1.0625rem; color:var(--text-muted); line-height:1.75; max-width:520px; margin:0 auto 2.75rem;">
        {cta_p}
      </p>
      <div class="reveal reveal-d2" style="display:flex; justify-content:center; gap:1rem; flex-wrap:wrap;">
        <a href="{cta_link}" {cta_attrs} class="btn-gold" style="font-size:0.9375rem; padding:1.0625rem 2.5rem;">
          {cta_btn}
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 6.5h10M7 2l4.5 4.5L7 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
      </div>
      <p class="reveal reveal-d3" style="font-size:0.75rem; color:var(--text-muted); margin-top:1.25rem; letter-spacing:0.06em;">{cta_sub}</p>
    </div>
  </section>


  <!-- FOOTER -->
  <footer class="footer">
    <div class="container">
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:3rem; padding:3rem 0 2rem; border-bottom:1px solid rgba(192,149,64,0.15); margin-bottom:2rem;" class="footer-grid">
        <div>
          <a href="/" aria-label="ScaleHaven"><img src="/brand_assets/scalehaven_logo_white.webp" alt="ScaleHaven" width="77" height="48" style="height:48px; margin-bottom:1rem;" /></a>
          <p style="font-size:0.875rem; color:rgba(255,255,255,0.5); line-height:1.7; max-width:280px;">Done-for-you Meta Ads, automation, and lead follow-up for med spas and aesthetic clinics across the US &amp; Canada.</p>
        </div>
        <div>
          <p style="font-family:'Work Sans',sans-serif; font-size:0.6875rem; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.25rem;">Services</p>
          <div style="display:flex; flex-direction:column; gap:0.625rem;">
            <a href="/med-spa-lead-generation" style="font-size:0.875rem; color:rgba(255,255,255,0.6); text-decoration:none;">Lead Generation</a>
            <a href="/med-spa-facebook-ads" style="font-size:0.875rem; color:rgba(255,255,255,0.6); text-decoration:none;">Meta Ads Management</a>
            <a href="/botox-clinic-marketing" style="font-size:0.875rem; color:rgba(255,255,255,0.6); text-decoration:none;">Botox &amp; Injectables</a>
            <a href="/dermatology-marketing" style="font-size:0.875rem; color:rgba(255,255,255,0.6); text-decoration:none;">Dermatology Marketing</a>
            <a href="/aesthetic-clinic-marketing" style="font-size:0.875rem; color:rgba(255,255,255,0.6); text-decoration:none;">Aesthetic Clinics</a>
            <a href="/med-spa-marketing-near-me" style="font-size:0.875rem; color:rgba(255,255,255,0.6); text-decoration:none;">Local Med Spa Marketing</a>
          </div>
        </div>
        <div>
          <p style="font-family:'Work Sans',sans-serif; font-size:0.6875rem; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.25rem;">Get Started</p>
          <div style="display:flex; flex-direction:column; gap:0.625rem;">
            <a href="https://calendly.com/john-scalehaven/30min" target="_blank" rel="noopener noreferrer" style="font-size:0.875rem; color:rgba(255,255,255,0.6); text-decoration:none;">Book a Free Call</a>
            <a href="mailto:john@scalehaven.io" style="font-size:0.875rem; color:rgba(255,255,255,0.6); text-decoration:none;">john@scalehaven.io</a>
            <a href="/blog" style="font-size:0.875rem; color:rgba(255,255,255,0.6); text-decoration:none;">Blog</a>
          </div>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:2rem; flex-wrap:wrap; gap:1rem;">
        <p style="font-size:0.75rem; color:rgba(255,255,255,0.35);">&copy; 2026 ScaleHaven. All rights reserved.</p>
        <a href="https://calendly.com/john-scalehaven/30min" target="_blank" rel="noopener noreferrer" class="btn-nav" style="font-size:0.6875rem;">Book a Call</a>
      </div>
    </div>
  </footer>

  <script src="/js/main.js" defer></script>

  <!-- LeadConnector Chat Widget (deferred to reduce TBT) -->
  <script>
    window.addEventListener('load', function() {{
      setTimeout(function() {{
        var s = document.createElement('script');
        s.src = 'https://widgets.leadconnectorhq.com/loader.js';
        s.setAttribute('data-resources-url', 'https://widgets.leadconnectorhq.com/chat-widget/loader.js');
        s.setAttribute('data-widget-id', '69d8eeb79f3b6fe7cf078e64');
        document.body.appendChild(s);
      }}, 2000);
    }});
  </script>

</body>
</html>'''


def related_card(href, tag, title, excerpt, delay=""):
    cls = f"blog-card reveal{' ' + delay if delay else ''}"
    return f'''        <a href="{href}" class="{cls}" style="position:relative;">
          <div class="blog-card-body">
            <span class="blog-card-tag">{tag}</span>
            <h3 class="blog-card-title">{title}</h3>
            <p class="blog-card-excerpt">{excerpt}</p>
            <span class="read-more">Read &rarr;</span>
          </div>
        </a>'''


def generate(data: dict) -> str:
    related = []
    for i, r in enumerate(data.get("related", [])):
        delay = ["", "reveal-d1", "reveal-d2"][i] if i < 3 else ""
        related.append(related_card(r["href"], r["tag"], r["title"], r["excerpt"], delay))

    return TEMPLATE.format(
        tag=data["tag"],
        excerpt=data["excerpt"],
        read_time=data["read_time"],
        title=data["title"],
        slug=data["slug"],
        twitter_desc=data.get("twitter_desc", data["excerpt"][:120]),
        breadcrumb_name=data["breadcrumb_name"],
        ghost_text=data["ghost_text"],
        eyebrow=data["eyebrow"],
        h1_html=data["h1_html"],
        body_html=data["body_html"],
        author_bio=data.get("author_bio", "ScaleHaven is a done-for-you marketing agency for med spas and aesthetic clinics. We run Meta Ads, automate lead follow-up, and guarantee 15+ booked consultations in month one. If we don't hit the target, we work for free until we do."),
        related_html="\n\n".join(related),
        cta_h2=data.get("cta_h2", 'Ready to <em>Get Started?</em>'),
        cta_p=data.get("cta_p", "Book a free 30-minute call and we'll show you exactly how we'd fill your calendar."),
        cta_link=data.get("cta_link", "https://calendly.com/john-scalehaven/30min"),
        cta_attrs=data.get("cta_attrs", 'target="_blank" rel="noopener noreferrer"'),
        cta_btn=data.get("cta_btn", "Book Your Free Call Today"),
        cta_sub=data.get("cta_sub", "No obligation. No pitch deck. Just a real conversation."),
    )


if __name__ == "__main__":
    data = json.load(sys.stdin)
    out_path = Path(data.pop("_output"))
    html = generate(data)
    out_path.write_text(html, encoding="utf-8")
    print(f"Generated: {out_path}")
