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

/** Most recent non-sweep commit date for a file, falling back to its newest commit. */
function lastSignificant(file) {
  const lines = sh(`git log --format="%h %ad" --date=short -- "${file}"`).split("\n").filter(Boolean);
  for (const l of lines) {
    const [h, d] = l.split(" ");
    if (!sweeps.has(h)) return d;
  }
  return lines[0]?.split(" ")[1] ?? null;
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
if (!dry && changes.length) writeFileSync("sitemap.xml", out);
