/**
 * ScaleHaven weekly SEO report — pulls GSC, Bing, and GA4 and prints a
 * markdown digest: WoW trend, rising queries, top pages, money-page watch,
 * CTR outliers, and GA4 conversions (calendly_click primary,
 * lead_form_submit secondary). Ported from the ClinicCompass report.
 *
 * Run: node --env-file=.env scripts/seo-report.mjs
 */
import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: [
    // Full webmasters (not .readonly): the URL Inspection API needs it to report
    // lastCrawlTime, which is how we verify Google has actually seen a change
    // before we try to measure it.
    "https://www.googleapis.com/auth/webmasters",
    "https://www.googleapis.com/auth/analytics.readonly",
  ],
});
const token = (await (await auth.getClient()).getAccessToken()).token;
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const SITE = "sc-domain:scalehaven.io";
const GSC = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;

const day = (offset) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);
// GSC data lags ~2 days; compare the freshest full week to the one before it.
const q = async (body) => (await (await fetch(GSC, { method: "POST", headers: H, body: JSON.stringify(body) })).json()).rows ?? [];

const thisWeek = { startDate: day(9), endDate: day(2) };
const lastWeek = { startDate: day(16), endDate: day(9) };

const sum = (rows) => rows.reduce((a, r) => ({ imp: a.imp + r.impressions, clk: a.clk + r.clicks }), { imp: 0, clk: 0 });
const [tw, lw] = await Promise.all([q({ ...thisWeek }), q({ ...lastWeek })]);
const T = sum(tw), L = sum(lw);
const pct = (a, b) => (b === 0 ? "new" : `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%`);

console.log(`# ScaleHaven SEO report — week ending ${thisWeek.endDate}\n`);
console.log(`## Google`);
console.log(`- Impressions: **${T.imp.toLocaleString()}** (${pct(T.imp, L.imp)} vs prior week)`);
console.log(`- Clicks: **${T.clk}** (${pct(T.clk, L.clk)})`);

// Rising queries
const [qtw, qlw] = await Promise.all([
  q({ ...thisWeek, dimensions: ["query"], rowLimit: 250 }),
  q({ ...lastWeek, dimensions: ["query"], rowLimit: 250 }),
]);
const prev = new Map(qlw.map((r) => [r.keys[0], r.impressions]));
const rising = qtw
  .map((r) => ({ q: r.keys[0], imp: r.impressions, delta: r.impressions - (prev.get(r.keys[0]) ?? 0), pos: r.position }))
  .sort((a, b) => b.delta - a.delta).slice(0, 10);
console.log(`\n### Rising queries`);
for (const r of rising) console.log(`- "${r.q}" — ${r.imp} imp (+${r.delta}), pos ${r.pos.toFixed(0)}`);

// Top pages
const pages = await q({ ...thisWeek, dimensions: ["page"], rowLimit: 500 });
console.log(`\n### Top pages (impressions)`);
for (const r of pages.slice(0, 10)) console.log(`- ${r.keys[0].replace("https://scalehaven.io", "")} — ${r.impressions} imp, ${r.clicks} clicks`);

// Money-page watch: the service pages that sell (agency lens replaces expansion cities)
const MONEY = [
  "/med-spa-lead-generation/", "/med-spa-facebook-ads/", "/med-spa-google-ads/",
  "/med-spa-seo/", "/med-spa-advertising/", "/med-spa-web-design/",
  "/botox-clinic-marketing/", "/aesthetic-clinic-marketing/", "/dermatology-marketing/",
  "/plastic-surgery-marketing/", "/med-spa-marketing-near-me/",
  "/med-spa-marketing-scorecard/", "/med-spa-roi-calculator/",
];
const [ptw, plw] = [pages, await q({ ...lastWeek, dimensions: ["page"], rowLimit: 500 })];
const prevP = new Map(plw.map((r) => [r.keys[0], r]));
console.log(`\n### Money-page watch (service pages)`);
for (const m of MONEY) {
  const url = `https://scalehaven.io${m}`;
  const now = ptw.find((r) => r.keys[0] === url);
  const was = prevP.get(url);
  const imp = now?.impressions ?? 0, clk = now?.clicks ?? 0;
  const d = imp - (was?.impressions ?? 0);
  console.log(`- ${m} — ${imp} imp (${d >= 0 ? "+" : ""}${d}), ${clk} clicks, pos ${(now?.position ?? 0).toFixed(0) || "—"}`);
}

// CTR outliers: real impressions, page 1-2 positions, zero clicks
const ctrIssues = qtw.filter((r) => r.impressions >= 50 && r.position <= 20 && r.clicks === 0).slice(0, 5);
if (ctrIssues.length) {
  console.log(`\n### CTR outliers (ranking but not clicked — meta/desc candidates)`);
  for (const r of ctrIssues) console.log(`- "${r.keys[0]}" — ${r.impressions} imp at pos ${r.position.toFixed(0)}, 0 clicks`);
}

// Bing. Two gotchas, both found Aug 17 2026:
//   1. The verified property is https://www.scalehaven.io/ (with www). Querying
//      the apex silently returns nothing useful.
//   2. ssl.bing.com intermittently serves an HTML outage page instead of JSON,
//      which used to surface as a bare "Unexpected token '<'" and lost the week's
//      data. Retry instead of giving up on the first blip.
if (process.env.BING_WEBMASTER_API_KEY) {
  const BING_SITE = "https://www.scalehaven.io/";
  const bing = async (method, extra = "") => {
    let last;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/${method}?apikey=${process.env.BING_WEBMASTER_API_KEY}&siteUrl=${encodeURIComponent(BING_SITE)}${extra}`);
        const text = await res.text();
        if (text.trimStart().startsWith("<")) { last = new Error(`Bing returned HTML (outage or bad key), attempt ${i + 1}`); continue; }
        return JSON.parse(text);
      } catch (e) { last = e; }
    }
    throw last;
  };
  try {
    const b = await bing("GetRankAndTrafficStats");
    const rows = (b.d ?? []).slice(-7);
    const bi = rows.reduce((a, r) => a + (r.Impressions ?? 0), 0);
    const bc = rows.reduce((a, r) => a + (r.Clicks ?? 0), 0);
    console.log(`\n## Bing (last 7 days)\n- Impressions: **${bi.toLocaleString()}** · Clicks: **${bc}**`);
    const qta = await bing("GetUrlSubmissionQuota").catch(() => null);
    if (qta?.d) console.log(`- URL submission quota available: ${qta.d.DailyQuota}/day, ${qta.d.MonthlyQuota}/month (Bing accepts direct reindex requests, unlike Google)`);
  } catch (e) { console.log(`\n## Bing\n- fetch failed after 3 attempts: ${e.message}`); }
}

// GA4 conversions: calendly_click (primary), lead_form_submit (secondary)
if (process.env.GA4_PROPERTY_ID) {
  try {
    const ga = await (await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA4_PROPERTY_ID}:runReport`, {
      method: "POST", headers: H,
      body: JSON.stringify({
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: ["calendly_click", "lead_form_submit"] } } },
      }),
    })).json();
    console.log(`\n## GA4 conversions (last 7 days)`);
    for (const r of ga.rows ?? []) console.log(`- ${r.dimensionValues[0].value}: **${r.metricValues[0].value}**`);
    if (!ga.rows?.length) console.log("- no conversion events recorded this week (GA4 was installed July 28 — data builds from here)");
  } catch (e) { console.log(`\n## GA4\n- fetch failed: ${e.message}`); }
} else {
  console.log(`\n## GA4\n- pending: set GA4_PROPERTY_ID in .env`);
}

// Authority watch (DataForSEO). Referring domains is THE bottleneck metric —
// measured Aug 10, 2026: 1,442 backlinks but only 9 referring domains, and
// 1,418 of those were a single sitewide footer link from thecliniccompass.com.
// Page-1 entry in this niche costs ~60 referring domains (medspamagicmarketing.com).
// OWNED is excluded from the "real" count so a sitewide self-link can never
// flatter the number we steer by.
const OWNED = ["thecliniccompass.com"];
const dfs = async (path, body) => {
  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64");
  const res = await fetch(`https://api.dataforseo.com/v3/${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([body]),
  });
  return (await res.json())?.tasks?.[0]?.result ?? [];
};

if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
  try {
    console.log(`\n## Authority watch (the bottleneck)`);
    const [sum] = await dfs("backlinks/summary/live", { target: "scalehaven.io", internal_list_limit: 1, backlinks_status_type: "live" });
    const [rd] = await dfs("backlinks/referring_domains/live", { target: "scalehaven.io", limit: 200, order_by: ["backlinks,desc"] });
    const domains = rd?.items ?? [];
    const real = domains.filter((d) => !OWNED.includes(d.domain));
    console.log(`- Referring domains: **${sum?.referring_domains ?? "?"}** total · **${real.length}** excluding owned properties`);
    console.log(`- Backlinks: ${sum?.backlinks?.toLocaleString() ?? "?"} · target for page 1 in this niche: **~60 referring domains**`);
    for (const o of OWNED) {
      const hit = domains.find((d) => d.domain === o);
      if (hit) console.log(`- ⚠ ${o} (owned) still contributes ${hit.backlinks.toLocaleString()} links — sitewide self-links carry no ranking value`);
    }
    const fresh = real.filter((d) => d.first_seen && d.first_seen >= day(9)).map((d) => d.domain);
    console.log(fresh.length ? `- **NEW this week: ${fresh.join(", ")}**` : `- No new referring domains this week`);

    const [rk] = await dfs("dataforseo_labs/google/ranked_keywords/live", {
      target: "scalehaven.io", location_code: 2840, language_code: "en", limit: 700,
      order_by: ["ranked_serp_element.serp_item.rank_absolute,asc"],
    });
    const items = rk?.items ?? [];
    const posOf = (i) => i.ranked_serp_element?.serp_item?.rank_absolute ?? 999;
    const bands = { "1-3": 0, "4-10": 0, "11-20": 0, "21-50": 0, "51+": 0 };
    for (const i of items) {
      const p = posOf(i);
      bands[p <= 3 ? "1-3" : p <= 10 ? "4-10" : p <= 20 ? "11-20" : p <= 50 ? "21-50" : "51+"]++;
    }
    console.log(`- Keywords ranked with tracked volume: **${rk?.total_count ?? items.length}** — top3 ${bands["1-3"]} · top10 ${bands["4-10"]} · 11-20 ${bands["11-20"]} · 21-50 ${bands["21-50"]} · 51+ ${bands["51+"]}`);
    const close = items.filter((i) => posOf(i) >= 11 && posOf(i) <= 20 && (i.keyword_data?.keyword_info?.search_volume ?? 0) >= 40);
    if (close.length) {
      console.log(`- **One push from page 1** (pos 11-20, vol 40+):`);
      for (const i of close.slice(0, 8)) {
        const ki = i.keyword_data?.keyword_info ?? {};
        console.log(`  - "${i.keyword_data.keyword}" — pos ${posOf(i)}, ${ki.search_volume}/mo, $${(ki.cpc ?? 0).toFixed(2)} CPC`);
      }
    }
  } catch (e) { console.log(`- DataForSEO fetch failed: ${e.message}`); }
}

// ---------------------------------------------------------------------------
// Change tracking. Reads keyword-data/change-log.md, asks the URL Inspection
// API whether Google has actually recrawled each changed page since it shipped,
// and only then measures equal-length before/after windows.
//
// The order matters: a change Google has not crawled is UNMEASURABLE, not
// failed. Measured Aug 17 2026, two meta rewrites shipped Aug 10 sat uncrawled
// for a week while looking like they had "results". Never judge before crawl.
// ---------------------------------------------------------------------------
const EVAL_DAYS = 21; // rankings and CTR need this long to settle. 7 is not enough.

// Cached: change tracking and the crawl-age sweep inspect overlapping URLs.
const inspected = new Map();
const inspect = (url) => {
  if (!inspected.has(url)) {
    inspected.set(url, fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST", headers: H, body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE }),
    }).then((r) => r.json()).then((r) => r.inspectionResult?.indexStatusResult ?? null));
  }
  return inspected.get(url);
};
// Run fn over items with a small worker pool. Sequential inspection of ~110
// URLs took over 10 minutes on Sep 14 2026; the API allows 600/min.
const pool = async (items, n, fn) => {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch(() => null); }
  }));
  return out;
};

try {
  const { readFileSync } = await import("node:fs");
  const md = readFileSync("keyword-data/change-log.md", "utf8");
  // Table rows: | date | `page` | change | hypothesis | status |
  const logged = [...md.matchAll(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*`([^`]+)`[^|]*\|\s*([^|]+?)\s*\|[^|]*\|\s*([^|]+?)\s*\|/gm)]
    .map((m) => ({ date: m[1], page: m[2].trim(), what: m[3].trim(), status: m[4].trim() }))
    .filter((c) => c.page.startsWith("/"))
    // Only open experiments. Closed (worked/no-effect/hurt), held and done rows
    // need no crawl check. Found Sep 14 2026: the old slice(0, 12) meant every
    // pending change older than the newest dozen rows was never inspected.
    .filter((c) => /pending-crawl|measuring/i.test(c.status))
    // Two rows can share a page and date (e.g. two homepage changes on Sep 8).
    .filter((c, i, all) => all.findIndex((o) => o.page === c.page && o.date === c.date) === i);

  if (logged.length) {
    console.log(`\n## Change tracking (verify crawl, then measure)\n`);
    const pending = [], fresh = [], measured = [];
    const idxs = await pool(logged, 8, (c) => inspect(`https://scalehaven.io${c.page}`));

    for (const [k, c] of logged.entries()) {
      const url = `https://scalehaven.io${c.page}`;
      const idx = idxs[k];
      const crawled = idx?.lastCrawlTime?.slice(0, 10) ?? null;
      const seen = crawled && crawled > c.date;
      // GSC data lags ~2 days, so a change shipped today reads as negative. Clamp.
      const elapsed = Math.max(0, Math.round((new Date(day(2)) - new Date(c.date)) / 864e5));

      if (!seen) { pending.push({ ...c, crawled, elapsed }); continue; }
      // Crawled after ship but too new to measure. Google HAS seen it, so it must
      // not land on the Request Indexing list (Sep 14 2026: /blog/ was listed
      // although it was crawled two days after the change).
      if (elapsed < 3) { fresh.push({ ...c, crawled, elapsed }); continue; }

      // Equal-length windows either side of the ship date, capped at EVAL_DAYS.
      const n = Math.min(elapsed, EVAL_DAYS);
      const shift = (d, k) => new Date(new Date(`${d}T00:00:00Z`).getTime() + k * 864e5).toISOString().slice(0, 10);
      const filt = { dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: url }] }] };
      const [a, b] = await Promise.all([
        q({ startDate: shift(c.date, 1), endDate: shift(c.date, n), ...filt }),
        q({ startDate: shift(c.date, -n), endDate: shift(c.date, -1), ...filt }),
      ]);
      const g = (r) => (r[0] ? { imp: r[0].impressions, clk: r[0].clicks, ctr: r[0].ctr * 100, pos: r[0].position } : { imp: 0, clk: 0, ctr: 0, pos: 0 });
      measured.push({ ...c, crawled, elapsed, n, A: g(a), B: g(b), ripe: elapsed >= EVAL_DAYS });
    }

    if (pending.length) {
      console.log(`### ⏳ Not yet crawled — DO NOT re-edit these`);
      for (const p of pending)
        console.log(`- \`${p.page}\` — shipped ${p.date} (${p.elapsed === 0 ? "today" : `${p.elapsed}d ago`}), Google last crawled ${p.crawled ?? "never"}. Unmeasurable. ${p.what}`);
      console.log(`\n**Request Indexing in GSC for these:**`);
      for (const p of pending) console.log(`- https://scalehaven.io${p.page}`);
    }

    if (fresh.length) {
      console.log(`\n### ✅ Crawled after the change, too new to measure`);
      for (const f of fresh) console.log(`- \`${f.page}\` — shipped ${f.date}, crawled ${f.crawled}. Leave it alone.`);
    }

    if (measured.length) {
      console.log(`\n### 📊 Crawled and measuring (${EVAL_DAYS}-day window)`);
      console.log(`| page | shipped | crawled | imp | clicks | CTR | position | verdict |`);
      console.log(`|---|---|---|---|---|---|---|---|`);
      for (const m of measured) {
        const arrow = (v, inv = false) => { const s = inv ? -v : v; return s > 0.05 ? "▲" : s < -0.05 ? "▼" : "="; };
        const dPos = m.A.pos - m.B.pos, dCtr = m.A.ctr - m.B.ctr;
        const verdict = !m.ripe ? `too early (${m.elapsed}/${EVAL_DAYS}d)`
          : dPos < -0.5 || dCtr > 0.1 ? "**worked**" : dPos > 0.5 || dCtr < -0.1 ? "**hurt**" : "no effect";
        console.log(`| \`${m.page}\` | ${m.date} | ${m.crawled} | ${m.B.imp}→${m.A.imp} ${arrow(m.A.imp - m.B.imp)} | ${m.B.clk}→${m.A.clk} ${arrow(m.A.clk - m.B.clk)} | ${m.B.ctr.toFixed(2)}→${m.A.ctr.toFixed(2)}% ${arrow(dCtr)} | ${m.B.pos.toFixed(1)}→${m.A.pos.toFixed(1)} ${arrow(dPos, true)} | ${verdict} |`);
      }
      console.log(`\nPosition ▲ means it moved closer to #1. Changes inside the ${EVAL_DAYS}-day window are not conclusions yet.`);
    }
  }
} catch (e) { console.log(`\n## Change tracking\n- skipped: ${e.message}`); }

// Crawl-age watch: every sitemap URL, not a hand-picked eight. Measured Sep 14
// 2026: 52 of 111 URLs were 14+ days uncrawled and a post had fallen out of the
// index, none of which the old eight-page watch list could show.
try {
  console.log(`\n## Crawl-age watch (stale pages cannot be measured or improved)`);
  const { readFileSync } = await import("node:fs");
  const paths = [...readFileSync("sitemap.xml", "utf8").matchAll(/<loc>https:\/\/scalehaven\.io([^<]*)<\/loc>/g)]
    .map((m) => m[1]).filter((p) => !/\.(webp|png|jpe?g)$/i.test(p));
  const now = Date.now();
  const idxs = await pool(paths, 8, (p) => inspect(`https://scalehaven.io${p}`));
  const rows = paths.map((p, k) => {
    const idx = idxs[k];
    const t = idx?.lastCrawlTime ?? null;
    return { p, t: t?.slice(0, 10) ?? "never", age: t ? Math.round((now - new Date(t)) / 864e5) : 999, state: idx?.coverageState ?? "inspection failed" };
  });
  const stale = rows.filter((r) => r.age >= 14).sort((a, b) => b.age - a.age);
  const notIndexed = rows.filter((r) => !/indexed/i.test(r.state) || /not indexed/i.test(r.state));
  console.log(`- **${stale.length} of ${rows.length}** sitemap URLs not crawled in 14+ days`);
  if (notIndexed.length) {
    console.log(`- ⚠ **Not indexed:**`);
    for (const r of notIndexed) console.log(`  - ${r.p} — ${r.state} (last crawl ${r.t})`);
  }
  for (const r of stale) console.log(`- ${r.age === 999 ? "  —" : String(r.age).padStart(3)}d  ${r.p}  (last crawl ${r.t})  ⚠ stale`);
} catch (e) { console.log(`- crawl-age check failed: ${e.message}`); }

// Change log — what we shipped and when, so movement can be attributed.
try {
  const { execSync } = await import("node:child_process");
  const log = execSync('git log --since="8 weeks ago" --date=short --pretty=format:"%ad|%s" -- . ":(exclude)blog/_queue"', { encoding: "utf8" })
    .split("\n").filter((l) => l && !/^\S+\|Auto-publish/.test(l));
  if (log.length) {
    console.log(`\n## Change log (last 8 weeks — attribute movement to these)`);
    for (const l of log.slice(0, 12)) {
      const [d, ...s] = l.split("|");
      console.log(`- ${d} — ${s.join("|")}`);
    }
  }
} catch { /* not a git checkout — skip */ }
