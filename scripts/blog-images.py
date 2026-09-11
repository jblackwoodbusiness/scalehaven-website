#!/usr/bin/env python3
"""Blog image pipeline for scalehaven.io: Pexels photo -> hero + card WebP.

  python3 scripts/blog-images.py pick   <slug>[:theme] ... | --all   choose one photo per post, write hero + card WebP
  python3 scripts/blog-images.py sheet  <out.png> <slug> ...         contact sheet for visual QA before inserting
  python3 scripts/blog-images.py reject <slug> ...                   ban the chosen photo so the next pick re-chooses
  python3 scripts/blog-images.py insert <slug> ...                   hero figure + og/twitter image + schema image on the post
  python3 scripts/blog-images.py cards  [slug ...]                   card images on /blog/ (all posts that have one if no slugs)

New posts: generate the queue file, then `pick <slug>:<theme>`, `sheet`, look at it,
then `insert <slug>` and `cards <slug>` is NOT needed (the publisher adds the card).

Needs PEXELS_API_KEY in .env (ScaleHaven's own key, never another project's).
Pools and the pick manifest live in keyword-data/ (local only, gitignored).
Pexels licence needs no attribution. Rules baked in below: landscape only, no
before/after, no injection shown on a person, no children, one photo per post
site-wide. Downloads use curl because Python SSL is broken on this machine.
"""
import html
import json
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "images" / "blog"
POOL_DIR = ROOT / "keyword-data" / "pexels-pools"
MANIFEST = ROOT / "keyword-data" / "blog-images-manifest.json"
SITE = "https://scalehaven.io"

QUERIES = {
    "laptop_analytics": "marketing analytics dashboard laptop",
    "phone_social": "smartphone social media app",
    "search_laptop": "person typing laptop search",
    "clinic_room": "aesthetic clinic treatment room",
    "skincare": "skincare products serum bottles",
    "syringe": "medical syringe vial",
    "laser_device": "laser skin device clinic",
    "consultation": "doctor consultation desk",
    "reception": "clinic reception desk",
    "planning": "business planning notebook desk",
    "meeting": "business team meeting office",
    "website": "website design laptop screen",
    "iv": "iv drip bag",
    "email": "email inbox laptop",
    "wellness": "wellness spa stones candles",
    "money": "calculator financial documents",
    "branding": "brand identity mockup stationery",
    "content_camera": "smartphone tripod filming content",
    "charts": "business charts graphs report",
    "medical_office": "modern medical office interior",
    "derm": "dermatology skin examination magnifier",
    "weight": "measuring tape healthy lifestyle",
    "reviews": "five star rating smartphone",
    "map_phone": "map navigation smartphone",
    "calendar": "appointment calendar planner",
    "equipment": "medical equipment clinic",
    "hiring": "job interview handshake office",
    "insurance": "signing contract documents",
    "storefront": "boutique storefront",
    "event": "champagne celebration event",
    "facial_device": "hydrafacial skincare device",
    "body_device": "body contouring machine clinic",
}

THEMES = {
    "how-to-fill-med-spa-calendar": "calendar", "how-to-get-more-med-spa-clients": "clinic_room",
    "med-spa-lead-follow-up-system": "reception", "med-spa-roi-marketing": "charts",
    "med-spa-social-media-marketing": "phone_social", "how-to-market-a-med-spa": "laptop_analytics",
    "med-spa-marketing-strategies": "planning", "med-spa-marketing-cost": "money",
    "how-to-market-a-dermatology-clinic": "derm", "med-spa-industry-statistics": "charts",
    "med-spa-cost-per-lead-benchmarks": "laptop_analytics", "botox-marketing-guide": "syringe",
    "aesthetic-clinic-marketing-playbook": "meeting", "aesthetic-clinic-lead-generation": "search_laptop",
    "glp1-semaglutide-marketing-med-spas": "weight", "cosmetic-clinic-lead-generation": "consultation",
    "facebook-ads-for-med-spas": "phone_social", "morpheus8-marketing-guide": "laser_device",
    "coolsculpting-marketing": "clinic_room", "instagram-ads-aesthetic-clinics": "content_camera",
    "aesthetic-industry-statistics-2026": "charts", "filler-clinic-marketing": "syringe",
    "how-to-get-more-patients-aesthetic-practice": "medical_office", "how-to-market-a-skincare-clinic": "skincare",
    "botox-advertising": "phone_social", "best-med-spa-websites": "website",
    "how-to-get-more-google-reviews-med-spa": "reviews", "how-to-get-more-med-spa-patients": "clinic_room",
    "how-to-get-more-plastic-surgery-consultations": "consultation", "how-to-market-a-plastic-surgery-practice": "medical_office",
    "local-seo-for-med-spas": "map_phone", "med-spa-google-business-profile": "map_phone",
    "med-spa-near-me-searches": "map_phone", "med-spa-seo": "search_laptop",
    "med-spa-seo-cost": "money", "med-spa-seo-vs-paid-ads": "laptop_analytics",
    "plastic-surgery-advertising": "laptop_analytics", "plastic-surgery-lead-generation": "consultation",
    "plastic-surgery-seo": "search_laptop", "med-spa-marketing-budget": "money",
    "med-spa-marketing-ideas": "planning", "med-spa-marketing-plan": "planning",
    "botox-marketing-ideas": "syringe", "digital-marketing-for-aesthetic-clinics": "laptop_analytics",
    "how-to-advertise-botox-legally": "insurance", "how-to-start-a-med-spa": "clinic_room",
    "med-spa-business-plan": "planning", "med-spa-equipment": "laser_device",
    "new-med-spa-marketing-first-90-days": "calendar", "med-spa-patient-acquisition": "reception",
    "chemical-peel-marketing": "skincare", "google-ads-for-med-spas": "search_laptop",
    "why-isnt-my-med-spa-growing": "money", "how-to-compete-with-bigger-med-spas": "medical_office",
    "how-to-fill-aesthetic-nurse-calendar": "calendar", "med-spa-patient-retention": "reception",
    "best-crm-for-med-spas": "laptop_analytics", "how-to-build-a-7-figure-med-spa": "money",
    "aesthetic-clinic-marketing-solo-providers": "content_camera", "med-spa-revenue-ceiling-50k": "charts",
    "med-spa-franchise": "clinic_room", "how-much-do-med-spa-owners-make": "planning",
    "botox-party": "clinic_room", "med-spa-insurance": "insurance",
    "med-spa-medical-director": "medical_office", "med-spa-open-house-ideas": "event",
    "med-spa-pricing": "money", "med-spa-consultant": "meeting",
    "med-spa-name-ideas": "branding", "iv-therapy-marketing": "iv",
    "hydrafacial-marketing": "skincare", "weight-loss-clinic-marketing": "weight",
    "laser-hair-removal-marketing": "laser_device", "med-spa-branding": "branding",
    "med-spa-ads": "phone_social", "wellness-clinic-marketing": "wellness",
    "med-spa-email-marketing": "email", "hipaa-compliant-med-spa-marketing": "insurance",
    "emsculpt-marketing": "medical_office", "med-spa-visibility-system": "search_laptop",
    "esthetician-marketing-ideas": "skincare", "med-spa-membership-programs": "reception",
    "med-spa-staffing": "hiring", "healthcare-facebook-ads": "phone_social",
    "dermatology-seo": "derm", "med-spa-content-ideas": "content_camera",
    "medical-spa-marketing": "clinic_room", "best-med-spa-marketing-companies": "meeting",
    "how-to-get-more-patients": "consultation", "botox-promotion-ideas": "syringe",
    "medical-practice-marketing": "consultation", "skincare-marketing": "skincare",
    "beauty-clinic-names": "branding",
    # queued
    "clinic-marketing-ideas": "planning", "beauty-clinic-branding": "branding",
    "plastic-surgery-website-design": "website", "best-med-spa-software": "laptop_analytics",
    "dermatology-website-design": "website", "plastic-surgery-statistics": "charts",
}

EXCLUDE = re.compile(
    r"\b(before|after|surgery|surgical|operation|operating|blood|bloody|scar|scars|nude|naked|bikini|"
    r"lingerie|underwear|topless|shirtless|child|children|kid|kids|baby|toddler|cigarette|smoking|"
    r"tattoo|dental|dentist|teeth|tooth|x-ray|wound|injury|divorce|covid|vaccine|vaccines|veterinary|pandemic|"
    r"argue|argues|arguing|tension|liposuction|wuhan)\b", re.I)
INJECT = re.compile(r"inject|botox|filler", re.I)
ON_PERSON = re.compile(r"\b(face|facial|lip|lips|forehead|cheek|woman|man|patient|person|girl|boy|model|client)\b", re.I)
# A person shown mid-treatment implies they had the procedure: never use it.
TREATED = re.compile(r"\b(receiving|undergoing|lying|lies|performing|performs|during|under lasers)\b", re.I)
LEAD_VERB = re.compile(r"^(explore|discover|capture|experience|enjoy|embrace|witness|admire|see|view)\s+", re.I)
PROPER = {"botox": "Botox", "google": "Google", "instagram": "Instagram", "facebook": "Facebook",
          "seo": "SEO", "crm": "CRM", "glp": "GLP", "hydrafacial": "HydraFacial", "coolsculpting": "CoolSculpting",
          "morpheus8": "Morpheus8", "emsculpt": "EMSculpt", "iv": "IV", "roi": "ROI", "hipaa": "HIPAA",
          "chatgpt": "ChatGPT", "meta": "Meta", "$50k/month": "$50K/month", "us": "US"}


def env_key():
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("PEXELS_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("PEXELS_API_KEY is missing from .env")


def curl(url, out=None, headers=()):
    cmd = ["curl", "-sSL", "--fail", "--max-time", "90"]
    for h in headers:
        cmd += ["-H", h]
    if out:
        cmd += ["-o", str(out)]
    cmd.append(url)
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode:
        raise RuntimeError(f"curl exit {r.returncode}: {r.stderr.decode()[:160]}")
    return r.stdout


def load_manifest():
    return json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"_banned": []}


def save_manifest(m):
    MANIFEST.write_text(json.dumps(m, indent=1, sort_keys=True))


def load_pool(theme):
    f = POOL_DIR / f"{theme}.json"
    if not f.exists():
        raw = curl(f"https://api.pexels.com/v1/search?query={quote(QUERIES[theme])}&per_page=80&orientation=landscape",
                   headers=[f"Authorization: {env_key()}"])
        photos = json.loads(raw).get("photos", [])
        POOL_DIR.mkdir(parents=True, exist_ok=True)
        f.write_text(json.dumps({"query": QUERIES[theme], "photos": [
            {"id": p["id"], "w": p["width"], "h": p["height"], "alt": p.get("alt") or "",
             "photographer": p.get("photographer"), "url": p.get("url"), "src": p["src"]["original"]}
            for p in photos]}))
    return json.loads(f.read_text())


def post_file(slug):
    f = ROOT / "blog" / slug / "index.html"
    if f.exists():
        return f
    q = sorted((ROOT / "blog" / "_queue").glob(f"[0-9]*-{slug}.html"))
    return q[0] if q else None


def topic(slug):
    f = post_file(slug)
    m = re.search(r"<title>([^<]+)</title>", f.read_text()) if f else None
    t = re.split(r"\s*[|:(?]", m.group(1))[0].strip() if m else slug.replace("-", " ")
    out = []
    for word in t.split():
        parts = []
        for part in word.split("-"):
            core = part.lower()
            parts.append(PROPER.get(core.strip("“”\"',."), core))
        out.append("-".join(parts))
    return " ".join(out)


def build_alt(raw, slug):
    a = re.sub(r"\s+", " ", (raw or "").strip()).rstrip(".")
    a = LEAD_VERB.sub("", a)
    if len(a.split()) > 16:
        cut = a.find(",", 40)
        a = a[:cut] if 0 < cut < 140 else " ".join(a.split()[:16])
    a = a[:1].upper() + a[1:]
    return f"{a}, illustrating {topic(slug)}"


def usable(p, used):
    alt = p.get("alt") or ""
    return (p["id"] not in used and p["w"] >= 2000 and p["w"] / p["h"] >= 1.3
            and len(alt.split()) >= 3 and not EXCLUDE.search(alt)
            and not (INJECT.search(alt) and ON_PERSON.search(alt))
            and not (TREATED.search(alt) and ON_PERSON.search(alt))
            # Pexels ids from one photo shoot are sequential; skip siblings so the /blog/ grid never repeats a scene.
            and not any(abs(p["id"] - u) <= 40 for u in used))


def render(slug, e):
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".jpg") as tmp:
        curl(e["src"] + "?auto=compress&cs=tinysrgb&w=1920", out=tmp.name)
        im = Image.open(tmp.name).convert("RGB")
    w, h = im.size
    ratio = 16 / 9
    if w / h > ratio:
        nw = int(h * ratio)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / ratio)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    hero, card = IMG_DIR / f"{slug}-hero.webp", IMG_DIR / f"{slug}-card.webp"
    for q in (74, 66, 58):
        im.resize((1200, 675), Image.LANCZOS).save(hero, "WEBP", quality=q, method=6)
        if hero.stat().st_size <= 110_000:
            break
    im.resize((800, 450), Image.LANCZOS).save(card, "WEBP", quality=68, method=6)
    return hero.stat().st_size, card.stat().st_size


def cmd_pick(args):
    m = load_manifest()
    used = {v["id"] for k, v in m.items() if k != "_banned"} | set(m["_banned"])
    items = [f"{s}:{t}" for s, t in THEMES.items()] if args == ["--all"] else args
    todo = []
    for item in items:
        slug, _, theme = item.partition(":")
        theme = theme or THEMES.get(slug)
        if theme not in QUERIES:
            sys.exit(f"unknown theme for {slug}. Themes: {', '.join(QUERIES)}")
        if slug in m or not post_file(slug):
            continue
        photo = next((p for p in load_pool(theme)["photos"] if usable(p, used)), None)
        if not photo:
            print(f"  ! {slug}: pool '{theme}' has no usable photo left")
            continue
        used.add(photo["id"])
        m[slug] = {"id": photo["id"], "theme": theme, "alt": build_alt(photo["alt"], slug),
                   "pexels_alt": photo["alt"], "photographer": photo["photographer"],
                   "url": photo["url"], "src": photo["src"]}
        todo.append(slug)
    save_manifest(m)

    def go(slug):
        try:
            hs, cs = render(slug, m[slug])
            return f"  {slug:<46} {m[slug]['theme']:<16} hero {hs // 1024}KB  card {cs // 1024}KB"
        except Exception as ex:
            return f"  ! {slug}: {ex}"

    with ThreadPoolExecutor(6) as pool:
        for line in pool.map(go, todo):
            print(line)
    for slug in todo:
        if not (IMG_DIR / f"{slug}-hero.webp").exists():
            m.pop(slug, None)
    save_manifest(m)
    print(f"picked {len(todo)}")


def cmd_reject(args):
    m = load_manifest()
    for slug in args:
        e = m.pop(slug, None)
        if e:
            m["_banned"].append(e["id"])
            for kind in ("hero", "card"):
                (IMG_DIR / f"{slug}-{kind}.webp").unlink(missing_ok=True)
            print(f"  rejected {slug} (photo {e['id']})")
    save_manifest(m)


def cmd_sheet(args):
    out, slugs = args[0], args[1:]
    m = load_manifest()
    tw, th, pad, lab, cols = 360, 203, 14, 36, 3
    rows = (len(slugs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + lab + pad) + pad), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=13)
    except TypeError:
        font = ImageFont.load_default()
    for i, slug in enumerate(slugs):
        x, y = pad + (i % cols) * (tw + pad), pad + (i // cols) * (th + lab + pad)
        card = IMG_DIR / f"{slug}-card.webp"
        if card.exists():
            sheet.paste(Image.open(card).convert("RGB").resize((tw, th)), (x, y))
        e = m.get(slug, {})
        draw.text((x, y + th + 3), f"{i + 1}. {slug[:46]}", fill="black", font=font)
        draw.text((x, y + th + 19), f"{e.get('theme', '?')}  #{e.get('id', '')}", fill=(115, 115, 115), font=font)
    sheet.save(out)
    print(f"sheet {out}")


def cmd_insert(args):
    m = load_manifest()
    for slug in args:
        f, e = post_file(slug), m.get(slug)
        hero = f"/images/blog/{slug}-hero.webp"
        if not f or not e or not (ROOT / hero.lstrip("/")).exists():
            print(f"  ! {slug}: missing post, pick, or image file")
            continue
        s = f.read_text()
        if hero in s:
            print(f"  = {slug}: already has a hero")
            continue
        alt = html.escape(e["alt"], quote=True)
        fig = (f'        <figure style="margin:0 0 2.25rem;">\n'
               f'          <img src="{hero}" width="1200" height="675" alt="{alt}" fetchpriority="high" decoding="async" '
               f'style="display:block; width:100%; height:auto; border-radius:10px;" />\n'
               f'        </figure>\n')
        s, n1 = re.subn(r'(<article class="article-body[^"]*"[^>]*>\n)', lambda mm: mm.group(1) + "\n" + fig, s, count=1)
        if not n1:
            print(f"  ! {slug}: no <article> element, skipped")
            continue
        url = SITE + hero
        s, n2 = re.subn(r'(<meta property="og:image" content=")[^"]*(")', lambda mm: mm.group(1) + url + mm.group(2), s, count=1)
        s, n3 = re.subn(r'(<meta name="twitter:image" content=")[^"]*(")', lambda mm: mm.group(1) + url + mm.group(2), s, count=1)
        s, n4 = re.subn(r'("@type": "BlogPosting",\n(\s*)"headline": "(?:[^"\\\n]|\\.)*",\n)',
                        lambda mm: mm.group(1) + f'{mm.group(2)}"image": "{url}",\n', s, count=1)
        f.write_text(s)
        print(f"  + {slug:<46} og {n2}  twitter {n3}  schema {n4}")


def cmd_cards(args):
    idx = ROOT / "blog" / "index.html"
    s, only, added = idx.read_text(), set(args), 0

    def add(mm):
        nonlocal added
        slug = mm.group(2)
        if (only and slug not in only) or not (IMG_DIR / f"{slug}-card.webp").exists():
            return mm.group(0)
        added += 1
        return (mm.group(1) + f'\n          <img class="blog-card-img" src="/images/blog/{slug}-card.webp" '
                f'width="800" height="450" alt="" loading="lazy" decoding="async" />')

    s = re.sub(r'(<a href="/blog/([^"/]+)/?"[^>]*class="blog-card reveal"[^>]*>)(?!\s*<img class="blog-card-img")', add, s)
    idx.write_text(s)
    print(f"card images added: {added}")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in {"pick", "sheet", "reject", "insert", "cards"}:
        sys.exit(__doc__)
    globals()[f"cmd_{sys.argv[1]}"](sys.argv[2:])
