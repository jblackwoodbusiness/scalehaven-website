#!/usr/bin/env node
/**
 * Build the machine-readable discovery files from the committed HTML:
 *   feed.xml            RSS 2.0 of every blog post (newest first)
 *   llms.txt            llmstxt.org site map: every indexable page with its description
 *   llms-full.txt       extended edition with a short excerpt per page
 *   ai/summary.json, ai/faq.json, ai/service.json, .well-known/ai.txt
 *
 * Idempotent. Run after publishing a post (the publish-blog workflow does) or
 * after hand-editing pages:  node scripts/build-ai-files.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SITE = "https://scalehaven.io";
const NAME = "ScaleHaven";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (s) => String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
const strip = (h) => unesc(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// ── pages from sitemap ─────────────────────────────────────────────────────
const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
const entries = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => ({ url: m[1], lastmod: m[2] || "" }));

const pages = [];
for (const e of entries) {
  const path = e.url.replace(SITE, "").replace(/^\//, "");
  const file = join(ROOT, path, "index.html");
  if (!existsSync(file)) continue;
  const html = readFileSync(file, "utf8");
  const title = unesc((html.match(/<title>([^<]+)<\/title>/) || [, ""])[1]).replace(/\s*\|\s*ScaleHaven\s*$/i, "").trim();
  const desc = unesc((html.match(/<meta name="description" content="([^"]*)"/) || [, ""])[1]).trim();
  const main = (html.match(/<main[\s\S]*?<\/main>/) || html.match(/<body[\s\S]*?<\/body>/) || [html])[0];
  const paras = [...main.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1])).filter((t) => t.length > 60);
  const excerpt = paras.slice(0, 2).join(" ").split(/\s+/).slice(0, 70).join(" ");
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);
  const flat = ld.flatMap((d) => (d["@graph"] ? d["@graph"] : [d]));
  const post = flat.find((n) => /Article|BlogPosting/.test(String(n["@type"])));
  pages.push({ url: e.url, path: "/" + path, lastmod: e.lastmod, title, desc, excerpt, isBlog: path.startsWith("blog/") && path !== "blog/", published: post?.datePublished || "", modified: post?.dateModified || post?.datePublished || "", faq: flat.find((n) => n["@type"] === "FAQPage") });
}
const blog = pages.filter((p) => p.isBlog).sort((a, b) => (b.published || "").localeCompare(a.published || ""));
const tools = pages.filter((p) => /scorecard|calculator/.test(p.path));
const services = pages.filter((p) => !p.isBlog && !tools.includes(p) && p.path !== "/" && !/^\/(blog|about|contact|privacy|terms|booked|thank)/.test(p.path));
const other = pages.filter((p) => !p.isBlog && !tools.includes(p) && !services.includes(p) && p.path !== "/");
const home = pages.find((p) => p.path === "/");

// ── feed.xml ───────────────────────────────────────────────────────────────
const items = blog.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${p.url}</link>
      <guid isPermaLink="true">${p.url}</guid>
      <pubDate>${new Date(p.published || p.lastmod).toUTCString()}</pubDate>
      <description>${esc(p.desc)}</description>
    </item>`).join("\n");
writeFileSync(join(ROOT, "feed.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${NAME} Blog</title>
    <link>${SITE}/blog/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Med spa and aesthetic clinic marketing: Meta Ads, Google Ads, SEO, and web design guides from ${NAME}.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`);

// ── llms.txt + llms-full.txt ───────────────────────────────────────────────
const preamble = `# ${NAME}

> ${NAME} is a done-for-you marketing agency for med spas, aesthetic clinics, and plastic surgery practices in the US and Canada. We run Meta Ads, Google Ads, and SEO that deliver financially qualified patients, with optional follow-up automation, and guarantee 15+ booked consultations in a client's first month, or we work free until they hit it. Founded by an operator who grew a cosmetic clinic into one of the largest in its region before it sold to a private equity firm.

Contact: john@scalehaven.io. Book a call: https://calendly.com/john-scalehaven/30min
`;
const line = (p, full) => `- [${p.title}](${p.url}): ${p.desc}${full && p.excerpt ? ` ${p.excerpt}` : ""}${full && p.modified ? ` (updated ${p.modified})` : ""}`;
const body = (full) => [
  preamble,
  "## Services (money pages)", ...services.map((p) => line(p, full)), "",
  "## Free tools", ...tools.map((p) => line(p, full)), "",
  "## Company", ...other.map((p) => line(p, full)), "",
  `## Blog (${blog.length} articles, newest first)`, ...blog.map((p) => line(p, full)), "",
  "## Optional", `- [Full edition](${SITE}/llms-full.txt): every page with a short excerpt`, `- [RSS feed](${SITE}/feed.xml)`, `- [Sitemap](${SITE}/sitemap.xml)`, "",
].join("\n");
writeFileSync(join(ROOT, "llms.txt"), body(false));
writeFileSync(join(ROOT, "llms-full.txt"), body(true).replace(`# ${NAME}\n`, `# ${NAME} (full)\n`));

// ── AI discovery files ─────────────────────────────────────────────────────
mkdirSync(join(ROOT, "ai"), { recursive: true }); mkdirSync(join(ROOT, ".well-known"), { recursive: true });
const description = home?.desc || "Med spa marketing agency that guarantees 15+ booked consultations in month one, or we work free. Meta Ads, Google Ads, SEO.";
const faqs = (home?.faq?.mainEntity || []).map((q) => ({ question: q.name, answer: q.acceptedAnswer?.text || "" }));
writeFileSync(join(ROOT, "ai", "summary.json"), JSON.stringify({ name: NAME, url: SITE, description, tagline: "Financially qualified patients, booked. 15+ consultations in month one or we work free.", type: "Marketing agency", industries: ["Med spas", "Aesthetic clinics", "Plastic surgery practices", "Dermatology practices"], coverage: { countries: ["United States", "Canada"] }, contact: { email: "john@scalehaven.io", booking: "https://calendly.com/john-scalehaven/30min" }, resources: { llms: `${SITE}/llms.txt`, llms_full: `${SITE}/llms-full.txt`, sitemap: `${SITE}/sitemap.xml`, feed: `${SITE}/feed.xml`, faq: `${SITE}/ai/faq.json`, services: `${SITE}/ai/service.json` } }, null, 2));
writeFileSync(join(ROOT, "ai", "faq.json"), JSON.stringify({ name: NAME, url: SITE, faqs }, null, 2));
writeFileSync(join(ROOT, "ai", "service.json"), JSON.stringify({ name: NAME, url: SITE, description, capabilities: ["Meta (Facebook and Instagram) advertising for med spas and aesthetic clinics", "Google Ads management", "Local SEO and search optimization", "Conversion-first website design", "Qualified lead generation with booking into the clinic's existing system", "Lead routing and reporting", "Optional follow-up automation"], guarantee: "15+ booked consultations in the first month, or we work free until the target is met (requires Meta at $1,500+/month ad spend)", pricing: { currency: ["USD", "CAD"], model: "Monthly retainer per channel, 3-month initial commitment" }, services: services.map((p) => ({ name: p.title, url: p.url })) }, null, 2));
writeFileSync(join(ROOT, ".well-known", "ai.txt"), `# ai.txt for ${NAME}
Name: ${NAME}
URL: ${SITE}
Description: ${description}
Contact: john@scalehaven.io
Summary: ${SITE}/ai/summary.json
FAQ: ${SITE}/ai/faq.json
Services: ${SITE}/ai/service.json
LLMs: ${SITE}/llms.txt
LLMs-Full: ${SITE}/llms-full.txt
Sitemap: ${SITE}/sitemap.xml
Feed: ${SITE}/feed.xml
Policy: Content may be cited with attribution and a link to the source page.
`);

const wc = (f) => readFileSync(join(ROOT, f), "utf8").split(/\s+/).length;
console.log(`pages=${pages.length} blog=${blog.length} services=${services.length} tools=${tools.length} other=${other.length} | llms.txt ${wc("llms.txt")} words | llms-full.txt ${wc("llms-full.txt")} words | feed items=${blog.length} | faqs=${faqs.length}`);
