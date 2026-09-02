#!/usr/bin/env node
/**
 * validate-site.mjs — static HTML linter for scalehaven.io
 *
 * Netlify publishes this repo as-is (publish = "."), so nothing between a typo
 * and production. This is that check.
 *
 *   node scripts/validate-site.mjs                 # sweep every page + queue
 *   node scripts/validate-site.mjs a.html b.html   # only these files
 *   node scripts/validate-site.mjs --quiet         # print only failures
 *   node scripts/validate-site.mjs --skip-queue    # ignore blog/_queue (CI gate)
 *
 * Exit code 0 = clean, 1 = issues found (so CI can block a bad publish).
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TITLE_MAX = 60;
const META_MAX = 160;

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'keyword-data',
  'temporary screenshots', 'brand_assets',
  'images', // asset folder — holds saved reference pages, not site pages
]);

/** Recursively collect index.html files. Queue posts are linted but never sitemap-checked. */
async function findPages(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await findPages(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const rel = (f) => path.relative(ROOT, f);

/** Strip <script>/<style> bodies so their contents never confuse tag counting. */
const stripCode = (html) =>
  html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

function checkTitle(html, issues) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return issues.push('no <title> tag');
  const title = m[1].trim();
  if (!title) return issues.push('<title> is empty');
  if (title.length > TITLE_MAX)
    issues.push(`title is ${title.length} chars (max ${TITLE_MAX}) — Google will truncate it`);
  const count = (html.match(/<title>/gi) || []).length;
  if (count > 1) issues.push(`${count} <title> tags — there must be exactly one`);
}

function checkMetaDescription(html, issues) {
  // Capture the whole tag first so a stray inner quote can't hide from us.
  const tag = html.match(/<meta[^>]*\bname=["']description["'][^>]*>/i);
  if (!tag) return issues.push('no meta description');

  // Greedy: spans first quote to last quote, so an inner " lands inside the capture.
  const content = tag[0].match(/\bcontent="(.*)"/is);
  if (!content) return issues.push('meta description has no content attribute');

  const desc = content[1];
  if (desc.includes('"'))
    issues.push('meta description contains a double quote — closes the attribute early and leaks text onto the page');
  if (desc.trim().length === 0) issues.push('meta description is empty');
  else if (desc.length > META_MAX) issues.push(`meta description is ${desc.length} chars (max ${META_MAX})`);
}

function checkTagBalance(html, issues) {
  const body = stripCode(html);
  for (const tag of ['div', 'section']) {
    const open = (body.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
    const close = (body.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (open !== close) issues.push(`unbalanced <${tag}> — ${open} open, ${close} closed`);
  }
}

function checkJsonLd(html, issues) {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  if (blocks.length === 0) return issues.push('no JSON-LD schema block');
  blocks.forEach((block, i) => {
    const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      JSON.parse(json);
    } catch (err) {
      issues.push(`JSON-LD block ${i + 1} does not parse — ${err.message} (Google silently drops rich results)`);
    }
  });
}

function checkInternalLinks(html, issues) {
  const hrefs = [...html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]);
  const broken = new Set();
  for (const href of new Set(hrefs)) {
    const target = path.join(ROOT, href);
    // A directory URL resolves to its index.html; a file URL resolves directly.
    const ok = href.endsWith('/') ? existsSync(path.join(target, 'index.html')) : existsSync(target);
    if (!ok) broken.add(href);
  }
  for (const href of broken) issues.push(`broken internal link → ${href}`);
}

async function checkSitemap(pages) {
  const issues = [];
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  if (!existsSync(sitemapPath)) return ['sitemap.xml is missing'];

  const xml = await readFile(sitemapPath, 'utf8');
  const listed = new Set(
    [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) =>
      m[1].replace(/^https?:\/\/(www\.)?scalehaven\.io/, '') || '/'
    )
  );

  const live = new Set(
    pages
      .filter((f) => f.endsWith('index.html') && !rel(f).startsWith('blog/_queue'))
      .map((f) => {
        const dir = path.dirname(rel(f));
        return dir === '.' ? '/' : `/${dir}/`;
      })
  );

  for (const url of live) {
    if (listed.has(url)) continue;
    const f = path.join(ROOT, url.replace('https://scalehaven.io/', ''), 'index.html');
    let noindex = false;
    try { noindex = /<meta[^>]+name="robots"[^>]+noindex/i.test(await readFile(f, 'utf8')); } catch {}
    if (!noindex) issues.push(`page exists but missing from sitemap → ${url}`);
  }
  for (const url of listed) if (!live.has(url)) issues.push(`sitemap lists a page that does not exist → ${url}`);
  return issues;
}

async function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  // CI gates on this: the post being published has already been moved out of
  // _queue, so a broken FUTURE queued post must not block a good publish today.
  const skipQueue = args.includes('--skip-queue');
  const explicit = args.filter((a) => !a.startsWith('--'));

  let pages = explicit.length
    ? explicit.map((f) => path.resolve(ROOT, f))
    : (await findPages(ROOT)).sort();
  if (skipQueue) pages = pages.filter((f) => !rel(f).startsWith(path.join('blog', '_queue')));

  let failed = 0;
  for (const file of pages) {
    if (!existsSync(file)) {
      console.log(`✗ ${rel(file)}\n    file not found`);
      failed++;
      continue;
    }
    const html = await readFile(file, 'utf8');
    const issues = [];
    // noindex pages (onboarding forms etc.) skip SEO checks: they are
    // deliberately invisible to search. Structure and links still checked.
    const noindex = /<meta[^>]+name="robots"[^>]+noindex/i.test(html);
    if (!noindex) {
      checkTitle(html, issues);
      checkMetaDescription(html, issues);
      checkJsonLd(html, issues);
    }
    checkTagBalance(html, issues);
    checkInternalLinks(html, issues);

    if (issues.length) {
      failed++;
      console.log(`✗ ${rel(file)}`);
      for (const i of issues) console.log(`    ${i}`);
    } else if (!quiet) {
      console.log(`✓ ${rel(file)}`);
    }
  }

  // Sitemap parity is a whole-site property — only meaningful on a full sweep.
  let sitemapIssues = [];
  if (!explicit.length) {
    sitemapIssues = await checkSitemap(pages);
    if (sitemapIssues.length) {
      console.log('✗ sitemap.xml');
      for (const i of sitemapIssues) console.log(`    ${i}`);
    }
  }

  const total = failed + (sitemapIssues.length ? 1 : 0);
  console.log('');
  if (total === 0) console.log(`✓ ${pages.length} pages checked — no issues`);
  else console.log(`${total} file(s) with issues — ${pages.length} pages checked`);
  process.exit(total === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
