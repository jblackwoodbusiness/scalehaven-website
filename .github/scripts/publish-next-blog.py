#!/usr/bin/env python3
"""
publish-next-blog.py

Picks the next queued blog post from /blog/_queue/, publishes it to /blog/{slug}/index.html,
updates /blog/index.html and /sitemap.xml, then deletes it from the queue.

Queue file format:
- Filename: NNN-slug.html (e.g. 001-how-to-market-a-med-spa.html)
- First line of file is a META block:
  <!--META tag="Med Spa Marketing" excerpt="Short blurb." read_time="9"-->
- File content is otherwise a complete blog post HTML page.
- Any occurrence of {{TODAY}} in the file is replaced with today's ISO date.
- Any occurrence of {{TODAY_HUMAN}} is replaced with "Month Day, Year".

Run with no arguments. Exits 0 on success, 1 on no posts to publish, 2 on error.
"""

from __future__ import annotations
import os
import re
import sys
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUEUE_DIR = ROOT / "blog" / "_queue"
BLOG_DIR = ROOT / "blog"
BLOG_INDEX = BLOG_DIR / "index.html"
SITEMAP = ROOT / "sitemap.xml"

META_RE = re.compile(
    r'<!--META\s+tag="(?P<tag>[^"]+)"\s+excerpt="(?P<excerpt>[^"]+)"\s+read_time="(?P<read_time>\d+)"\s*-->'
)
TITLE_RE = re.compile(r"<title>(?P<title>[^<]+)</title>")


def today_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def today_human() -> str:
    return datetime.now(timezone.utc).strftime("%B %-d, %Y")


def find_next_queued() -> Path | None:
    if not QUEUE_DIR.exists():
        return None
    files = sorted(p for p in QUEUE_DIR.glob("*.html") if not p.name.startswith("_"))
    return files[0] if files else None


def parse_meta(content: str) -> dict:
    m = META_RE.search(content)
    if not m:
        raise ValueError("Queue file missing <!--META ... --> block")
    return m.groupdict()


def parse_title(content: str) -> str:
    m = TITLE_RE.search(content)
    if not m:
        raise ValueError("Queue file missing <title> tag")
    raw = m.group("title")
    # Strip the " | ScaleHaven" suffix to get the human title
    return raw.split("|")[0].strip()


def slug_from_filename(path: Path) -> str:
    # 001-how-to-market-a-med-spa.html -> how-to-market-a-med-spa
    stem = path.stem
    return re.sub(r"^\d+-", "", stem)


def write_post(queue_file: Path, slug: str, today: str, today_h: str) -> Path:
    content = queue_file.read_text(encoding="utf-8")
    content = content.replace("{{TODAY}}", today).replace("{{TODAY_HUMAN}}", today_h)

    target_dir = BLOG_DIR / slug
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / "index.html"
    target.write_text(content, encoding="utf-8")
    return target


def update_blog_index(slug: str, title: str, tag: str, excerpt: str, read_time: str, today_h: str) -> None:
    index_html = BLOG_INDEX.read_text(encoding="utf-8")

    # Build new card markup matching existing style.
    card = (
        f'        <a href="/blog/{slug}" class="blog-card reveal" style="position:relative;">\n'
        f'          <div class="blog-card-body">\n'
        f'            <span class="blog-card-tag">{tag}</span>\n'
        f'            <h2 class="blog-card-title">{title}</h2>\n'
        f'            <p class="blog-card-excerpt">{excerpt}</p>\n'
        f'            <div style="display:flex; justify-content:space-between; align-items:center;">\n'
        f'              <span class="blog-card-meta">{today_h} &middot; {read_time} min read</span>\n'
        f'              <span class="read-more">Read &rarr;</span>\n'
        f'            </div>\n'
        f'          </div>\n'
        f'        </a>\n\n'
    )

    # Insert immediately after the opening <div class="blog-grid"> line so newest is first.
    grid_open = re.search(r'(<div[^>]*class="[^"]*blog-grid[^"]*"[^>]*>\s*\n)', index_html)
    if not grid_open:
        # Fallback: try the inline grid style used in the current index.
        grid_open = re.search(
            r'(<div style="display:grid; grid-template-columns:repeat\(3,1fr\);[^"]*"[^>]*class="blog-grid"[^>]*>\s*\n)',
            index_html,
        )
    if not grid_open:
        raise ValueError("Could not find blog grid container in blog/index.html")

    insert_at = grid_open.end()
    new_index = index_html[:insert_at] + card + index_html[insert_at:]
    BLOG_INDEX.write_text(new_index, encoding="utf-8")


def update_sitemap(slug: str, today: str) -> None:
    sm = SITEMAP.read_text(encoding="utf-8")
    new_url = (
        f"  <url>\n"
        f"    <loc>https://scalehaven.io/blog/{slug}</loc>\n"
        f"    <lastmod>{today}</lastmod>\n"
        f"    <changefreq>monthly</changefreq>\n"
        f"    <priority>0.7</priority>\n"
        f"  </url>\n"
    )
    if f"https://scalehaven.io/blog/{slug}" in sm:
        return  # already present
    sm = sm.replace("</urlset>", new_url + "</urlset>")
    SITEMAP.write_text(sm, encoding="utf-8")


def main() -> int:
    queue_file = find_next_queued()
    if queue_file is None:
        sys.stdout.write("No queued blog posts to publish. Queue is empty.\n")
        return 1

    sys.stdout.write(f"Publishing: {queue_file.name}\n")

    content = queue_file.read_text(encoding="utf-8")
    meta = parse_meta(content)
    title = parse_title(content)
    slug = slug_from_filename(queue_file)
    today = today_iso()
    today_h = today_human()

    target = write_post(queue_file, slug, today, today_h)
    sys.stdout.write(f"  Wrote: {target.relative_to(ROOT)}\n")

    update_blog_index(slug, title, meta["tag"], meta["excerpt"], meta["read_time"], today_h)
    sys.stdout.write("  Updated: blog/index.html\n")

    update_sitemap(slug, today)
    sys.stdout.write("  Updated: sitemap.xml\n")

    queue_file.unlink()
    sys.stdout.write(f"  Removed from queue: {queue_file.name}\n")

    sys.stdout.write(f"Published successfully: /blog/{slug}\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        sys.stderr.write(f"ERROR: {exc}\n")
        sys.exit(2)
