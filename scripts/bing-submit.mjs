/**
 * Submit changed URLs to Bing for reindexing.
 *
 * Bing, unlike Google, accepts direct reindex requests via API (100/day,
 * 1,500/month). Google has no equivalent for ordinary pages, so those still
 * need a manual Request Indexing in Search Console.
 *
 * Reads keyword-data/change-log.md and submits every page changed in the last
 * WINDOW_DAYS. Safe to re-run: Bing tolerates repeat submissions and we stay far
 * under quota.
 *
 * Two gotchas found Aug 17 2026:
 *   - The verified Bing property is https://www.scalehaven.io/ (with www) even
 *     though our canonical is the apex. Submitted URLs stay apex (canonical);
 *     only the siteUrl parameter uses www.
 *   - SubmitUrlBatch returns {"d":null} on SUCCESS. Confirm by reading the quota
 *     before and after rather than by the response body.
 *
 * Run: node --env-file=.env scripts/bing-submit.mjs [--dry] [--days N]
 */
import { readFileSync } from "node:fs";

const KEY = process.env.BING_WEBMASTER_API_KEY;
if (!KEY) { console.error("BING_WEBMASTER_API_KEY not set"); process.exit(1); }

const SITE = "https://www.scalehaven.io/";       // verified property
const ORIGIN = "https://scalehaven.io";           // canonical origin
const dry = process.argv.includes("--dry");
const dIdx = process.argv.indexOf("--days");
const WINDOW_DAYS = dIdx > -1 ? Number(process.argv[dIdx + 1]) : 14;

const api = (m, q = "") => `https://ssl.bing.com/webmaster/api.svc/json/${m}?apikey=${KEY}&siteUrl=${encodeURIComponent(SITE)}${q}`;
const quota = async () => (await (await fetch(api("GetUrlSubmissionQuota"))).json())?.d ?? null;

const cutoff = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
const md = readFileSync("keyword-data/change-log.md", "utf8");
const pages = [...new Set(
  [...md.matchAll(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*`([^`]+)`/gm)]
    .filter((m) => m[1] >= cutoff && m[2].startsWith("/"))
    .map((m) => `${ORIGIN}${m[2].trim()}`)
)];

if (!pages.length) { console.log(`No pages changed since ${cutoff}. Nothing to submit.`); process.exit(0); }

console.log(`Pages changed since ${cutoff}:`);
for (const p of pages) console.log(`  ${p}`);

const before = await quota();
console.log(`\nQuota before: ${before?.DailyQuota}/day, ${before?.MonthlyQuota}/month`);

if (dry) { console.log("\n--dry: nothing submitted."); process.exit(0); }
if (before && pages.length > before.DailyQuota) {
  console.error(`\nRefusing to submit: ${pages.length} URLs exceeds the ${before.DailyQuota} remaining today.`);
  process.exit(1);
}

const res = await fetch(api("SubmitUrlBatch"), {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ siteUrl: SITE, urlList: pages }),
});
const text = await res.text();
if (text.trimStart().startsWith("<")) { console.error(`\nBing returned HTML (outage or bad key): ${text.slice(0, 120)}`); process.exit(1); }

const after = await quota();
const used = before && after ? before.DailyQuota - after.DailyQuota : null;
console.log(`Quota after:  ${after?.DailyQuota}/day, ${after?.MonthlyQuota}/month`);
console.log(
  used === pages.length ? `\n✅ Submitted ${pages.length} URL(s) to Bing.`
  : used > 0 ? `\n⚠ Submitted, but quota moved by ${used} for ${pages.length} URL(s) (duplicates are not recharged).`
  : `\n⚠ Quota did not move. Response: ${text.slice(0, 200)}`
);
