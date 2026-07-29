# Brief: Build the ScaleHaven SEO Data Stack

**From:** John (via the ClinicCompass project, where this exact system is live and proven)
**Goal:** Replicate ClinicCompass's automated SEO data loop for scalehaven.io —
API access to GSC + Bing + GA4, a weekly report script, a Monday scheduled
task that digests the data and proposes concrete fixes John approves with one
word. Same architecture, agency-appropriate metrics.

**Reference implementations (read these first):**
- SOP for access setup: `~/Documents/ScaleHaven/SOPs/google-data-access-for-claude.md`
- Working report script: `/Users/johnblackwood/cliniccompass/scripts/seo-report.mjs`
- Scheduled task prompt pattern: `~/.claude/scheduled-tasks/monday-seo-report/SKILL.md`

## Step 1 — Access (follow the SOP with these specifics)

- **Service account:** create a NEW one — `scalehaven-seo` — in John's existing
  Google Cloud project (`cliniccompass` project is fine; a separate project is
  cleaner if org policy allows easily). Both APIs (Search Console API +
  Analytics Data API) are already enabled on the cliniccompass project.
  The org-policy key-creation override is already in place there too — reusing
  that project skips the SOP's ⚠️ section entirely.
- **Key handling:** install to `~/.config/scalehaven/service-account.json`
  (chmod 600), referenced from the ScaleHaven project's gitignored `.env` as
  `GOOGLE_APPLICATION_CREDENTIALS`. Never in the repo.
- **John's clicks:** add the new SA email to the scalehaven.io GSC property
  (Full) and the ScaleHaven GA4 property (Viewer). Ask him for the GA4
  property ID (GA4 Admin → Property details).
- **Bing:** John's Bing Webmaster API key works account-wide — if
  scalehaven.io is verified in his BWT account it works as-is:
  key is in the ClinicCompass `.env` as `BING_WEBMASTER_API_KEY` (John can
  paste it into this project's `.env` too). If scalehaven.io isn't in BWT
  yet, have John add it (Import from GSC, 2 min).
- **DataForSEO:** same credentials as ClinicCompass (`DATAFORSEO_LOGIN`/
  `DATAFORSEO_PASSWORD`) — John can copy those two lines into this `.env`
  for keyword research.

## Step 2 — Adapt the report script

Copy `seo-report.mjs`, change the site constant to
`sc-domain:scalehaven.io` (confirm the property type in the sites.list call
first), and adapt the sections:
- Keep: WoW impressions/clicks, rising queries, top pages, CTR outliers.
- Replace ClinicCompass's expansion-city section with: **service-page watch**
  (the money pages: med spa marketing, aesthetic clinic marketing, botox
  clinic marketing, dermatology marketing, per-city landing pages if any).
- GA4 conversions: use ScaleHaven's actual conversion events (booked calls /
  Calendly clicks / form submits — check what GA4 events exist and confirm
  the right ones with John rather than guessing).

## Step 3 — Schedule the Monday task

Clone the ClinicCompass task prompt pattern with these agency adjustments:
- Same 3-part structure: report → max 3 concrete proposals → execute only on
  John's "apply."
- Same stability rule: never propose title changes on pages that gained
  impressions; meta descriptions, internal links, and new content topics only.
- Schedule Mon 9:00am (ClinicCompass's runs 8:45 — stagger them).
- The agency lens for proposals: ScaleHaven pages sell to CLINIC OWNERS
  (B2B) — snippets should speak ROI and booked-patients outcomes, not
  patient-facing treatment language.

## Success criteria

1. A test query returns GSC rows for scalehaven.io.
2. `node --env-file=.env scripts/seo-report.mjs` prints a full digest
   including GA4 conversions.
3. Monday task created and run once manually ("Run now") to pre-approve
   permissions.

Everything here is proven — same code shape is running for ClinicCompass with
impressions +98% WoW and the loop closed. Don't redesign it; port it.
