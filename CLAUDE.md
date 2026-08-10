# CLAUDE.md — Frontend Website Rules

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves the project root at `http://localhost:3000`)
- `serve.mjs` lives in the project root. Start it in the background before taking any screenshots.
- If the server is already running, do not start a second instance.

## Screenshot Workflow
- Puppeteer is installed at `C:/Users/nateh/AppData/Local/Temp/puppeteer-test/`. Chrome cache is at `C:/Users/nateh/.cache/puppeteer/`.
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 label` → saves as `screenshot-N-label.png`
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

## Output Defaults
- Single `index.html` file, all styles inline, unless user says otherwise
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive

## Brand Assets
- Always check the `brand_assets/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- If a logo is present, use it. If a color palette is defined, use those exact values — do not invent brand colors.

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Pick a custom brand color and derive from it.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating), not all sit at the same z-plane.

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color

---

# SEO & Content Strategy (follow for ALL content + pages)

ScaleHaven's goal is a BUSINESS goal — book consultations / capture leads from
med spas, aesthetic / cosmetic clinics, and (now) plastic surgery practices.
SEO is how we reach buyers at the moment they search. Follow this framework.

## Local strategy docs (LOCAL ONLY — gitignored, never deployed)
Read these in `keyword-data/` before SEO work (they hold the data + the moat):
- `seo-master-reference.md` — the full playbook (chapters 1–8 + 30-day plan)
- `SEO-PLAN.md` — our locked plan (money pages + clusters + priorities)
- `content-map.md` / `master-keywords.csv` — validated US keywords (vol/KD/intent)
- `differentiation-inputs.md` — **John's real material (the moat). Inject into content.**
- DataForSEO API creds live in `.env` (gitignored). Validation via curl (Python SSL is blocked).

## The order of operations (don't skip)
1. **Money pages first** (transactional/commercial intent) — they convert + pay the bills.
2. **Build ONE cluster at a time, bottom-to-top** (money page → commercial/MOF → educational/TOF), all internally linked UP to the money page.
3. **Repeat cluster by cluster** — finish one before the next. This builds **topical authority** (covering a topic fully makes every keyword in it easier to rank).

## The 4-phase content process (every post/page)
1. **Research** — pull the top-ranking pages for the keyword (DataForSEO SERP API) → note topics they cover (table stakes), gaps (our opportunity), length benchmark, angles.
2. **Structure** — outline before writing; match intent; cover comprehensively.
3. **Write** — AI scaffolds; then **add the differentiation layer** (the moat).
4. **Optimize** — beat the top results on coverage; apply the on-page checklist.

## The differentiation layer (THE MOAT — non-negotiable)
The bar is **5× better than what exists**, not "good." AI scaffolding alone = invisible
(96% of pages get zero Google traffic because they're the same as everything else).
Inject John's real material from `differentiation-inputs.md`:
- His **case study** (a GTA med spa: $12.5K from $1K ad budget, ~$10 CPL, 100+ leads, PRP offer)
- His **thesis**: build a real NAMED offer — never discount / "$10 Botox" price-shopper bait
- His **take**: put clinic staff on camera (authenticity breaks the cold ad barrier)
- His **founder story**: grew a cosmetic clinic to one of the largest in its region, sold to PE
- His **speed-to-lead system**: instant text/voice on form fill → 5-min call → AI nurture

## Writing style (every page and post)
- **No em dashes** (— or &amp;mdash;) anywhere in copy, metas, or excerpts. Restructure the sentence: period, comma, colon, or parentheses. Hyphen ranges ($3-12) are fine. This is John's standing rule.
- Author is always John Blackwood, Founder (visible byline linked to /about/ + Person schema; both are wired into the templates).

## On-page checklist (apply to every page)
- **Title:** keyword front-loaded, <60 chars, click-worthy
- **One H1** (mirrors the title intent); H2/H3 hierarchy with natural keywords
- **URL:** short, descriptive, includes keyword (we use `/slug/`)
- **Meta description:** ~155 chars, ad-copy style, includes keyword + the outcome
- **Internal linking:** contextual links to related posts AND to the money page (best ROI in SEO — never skip). Cluster spokes link UP to their money page with keyword-rich anchors.
- **Images:** descriptive filenames, real alt text, WebP, compressed
- **Schema:** JSON-LD (BreadcrumbList + BlogPosting/Service + FAQPage where relevant)

## Link building (Ch 6) — once 10–15 pieces are live (we're past that)
- **Be the source:** original-data assets earn links (our stats posts + the case study).
- **Linkable assets:** free tools/calculators (we have the Scorecard; a CPL calculator is a natural next one).
- **Journalist platforms:** Source of Sources (free HARO successor) / Featured.com — John, ~15 min/day. This is the top backlink lever right now.

## AI search (Ch 8) — same fundamentals win
Authoritative comprehensive content + clusters + schema + citations also drive
visibility in ChatGPT/Perplexity/Gemini. AI favors "best of" / roundup articles.
Our schema + cluster structure already help; keep direct, clearly-structured answers.

## Auto-publisher
- Queue: `blog/_queue/NNN-slug.html` — lowest number publishes next (Tue/Thu/Sat, 3×/week).
- New posts via `.github/scripts/generate-post.py` (carries nav, footer, schema, hub CTA).
- To prioritize a cluster, number its posts low so they publish first.
