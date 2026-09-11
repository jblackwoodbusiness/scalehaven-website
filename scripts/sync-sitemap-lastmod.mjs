/**
 * Sync sitemap.xml <lastmod> to each page's real last significant edit.
 *
 * Why this exists: measured Aug 17 2026, 97 of 98 sitemap entries carried a
 * lastmod months older than the page's actual last edit (/med-spa-seo/ said
 * 2026-05-21 but was edited Aug 3). Google had no reason to recrawl, so meta
 * changes shipped Aug 10 were still uncrawled a week later and could not be
 * measured. Stale lastmod was the root cause of the uneven crawl.
 *
 * "Significant" excludes sitewide sweeps (commits touching more than
 * SWEEP_THRESHOLD files: footer swaps, analytics installs, cache-busts). Those
 * are real edits but they touch every page at once, and stamping all 98 URLs
 * with one date reads as a mass reset and teaches Google to distrust our
 * lastmod. Per-page dates keep the signal honest.
 *
 * ORDER MATTERS: this reads git history, so run it AFTER committing the week's
 * content edits, then commit the sitemap separately. Running it first leaves the
 * pages you just changed carrying their old lastmod, which is the exact problem
 * this script exists to fix.
 *
 * Run: node scripts/sync-sitemap-lastmod.mjs [--dry]
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SWEEP_THRESHOLD = 50;
const dry = process.argv.includes("--dry");
const sh = (c) => execSync(c, { encoding: "utf8", maxBuffer: 64 << 20 }).trim();

// Commits that touched more than SWEEP_THRESHOLD files are sitewide sweeps.
const sweeps = new Set(
  sh('git log --since="12 months ago" --pretty=format:"%h"').split("\n").filter((c) => {
    const n = sh(`git show --stat --pretty=format:"" ${c} | grep -c "|" || true`);
    return Number(n) > SWEEP_THRESHOLD;
  })
);

const fileFor = (path) => (path === "/" ? "index.html" : `${path.replace(/^\/|\/$/g, "")}/index.html`);

/** Most recent non-sweep commit date for a file. If every commit that touched the
 *  file was a sweep, fall back to its OLDEST commit (creation date), not its newest:
 *  otherwise each sitewide sweep re-stamps these pages with today's date, which is
 *  exactly the mass-reset signal this script exists to avoid (seen Sep 7 2026 with
 *  the GA4 hostname-guard sweep). */
function lastSignificant(file) {
  const lines = sh(`git log --format="%h %ad" --date=short -- "${file}"`).split("\n").filter(Boolean);
  for (const l of lines) {
    const [h, d] = l.split(" ");
    if (!sweeps.has(h)) return d;
  }
  return lines[lines.length - 1]?.split(" ")[1] ?? null;
}

const xml = readFileSync("sitemap.xml", "utf8");
const changes = [];
const out = xml.replace(
  /(<loc>https:\/\/scalehaven\.io(\/[^<]*)<\/loc>\s*<lastmod>)([^<]+)(<\/lastmod>)/g,
  (m, head, path, old, tail) => {
    const file = fileFor(path);
    if (!existsSync(file)) { console.warn(`  ! no file for ${path}`); return m; }
    const next = lastSignificant(file);
    if (!next || next === old) return m;
    if (next < old) return m; // never move a lastmod backwards
    changes.push([path, old, next]);
    return `${head}${next}${tail}`;
  }
);

for (const [p, o, n] of changes) console.log(`  ${o} -> ${n}  ${p}`);
console.log(`\n${changes.length} lastmod value(s) ${dry ? "would be" : ""} updated.`);
// ---- image entries --------------------------------------------------------
// One <image:image> per blog post that has a hero image, titled with the hero's
// alt text, so Google Images can tie each hero to its article (ported from the
// ClinicCompass postbuild-seo.mjs image sitemap). Rebuilt from the live page
// HTML on every run, so it is idempotent and follows alt-text edits.
const escXml = (v) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unescHtml = (v) => v.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
let images = 0;
let finalXml = out.includes("xmlns:image=")
  ? out
  : out.replace('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">');
finalXml = finalXml.replace(/<url>([\s\S]*?)<\/url>/g, (block, inner) => {
  const cleaned = inner.replace(/\s*<image:image>[\s\S]*?<\/image:image>/g, "");
  const loc = /<loc>https:\/\/scalehaven\.io(\/blog\/[^<]+\/)<\/loc>/.exec(cleaned);
  const file = loc && fileFor(loc[1]);
  const page = file && existsSync(file) ? readFileSync(file, "utf8") : "";
  const tag = /<img\b[^>]*src="(\/images\/blog\/[^"]+-hero\.webp)"[^>]*>/.exec(page);
  if (!tag) return `<url>${cleaned}</url>`;
  const alt = unescHtml((/\balt="([^"]*)"/.exec(tag[0]) || [])[1] || "");
  images++;
  return `<url>${cleaned.replace(/\s*$/, "")}\n    <image:image>\n      <image:loc>https://scalehaven.io${tag[1]}</image:loc>\n` +
    (alt ? `      <image:title>${escXml(alt)}</image:title>\n` : "") + `    </image:image>\n  </url>`;
});
console.log(`${images} blog hero image(s) listed in sitemap.xml.`);
if (!dry && finalXml !== xml) writeFileSync("sitemap.xml", finalXml);
