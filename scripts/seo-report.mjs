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
    "https://www.googleapis.com/auth/webmasters.readonly",
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

// Bing
if (process.env.BING_WEBMASTER_API_KEY) {
  try {
    const b = await (await fetch(`https://ssl.bing.com/webmaster/api.svc/json/GetRankAndTrafficStats?apikey=${process.env.BING_WEBMASTER_API_KEY}&siteUrl=${encodeURIComponent("https://scalehaven.io/")}`)).json();
    const rows = (b.d ?? []).slice(-7);
    const bi = rows.reduce((a, r) => a + (r.Impressions ?? 0), 0);
    const bc = rows.reduce((a, r) => a + (r.Clicks ?? 0), 0);
    console.log(`\n## Bing (last 7 days)\n- Impressions: **${bi.toLocaleString()}** · Clicks: **${bc}**`);
  } catch (e) { console.log(`\n## Bing\n- fetch failed: ${e.message}`); }
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
