# Decisions

This document captures key product and technical decisions made during the development of Encore Atlas, along with the reasoning behind them.

---

## 1. Shift from Search Tool → Discovery Experience

**Decision**
Introduce Recommended Videos to extend user sessions beyond a single search interaction.

**Why**
- Users had no clear next step after watching a video
- Sessions ended prematurely despite clear intent to continue exploring
- Live music consumption is associative and benefits from guided discovery

**Impact**
- Transforms the product from utility → experience
- Enables longer, more immersive sessions
- Creates foundation for future personalization

---

## 2. Two-Entry Recommendation Strategy

**Decision**
Surface recommendations in two places:
- Contextual: “You Might Also Like” below video results
- Dedicated: “For You” tab in navigation

**Why**
- Contextual recommendations support passive discovery
- Dedicated tab supports intentional exploration
- Prevents over-reliance on search as the only entry point

**Tradeoff**
- Increased UI complexity
- Landing experience still search-first, which may limit visibility of recommendations for new users

---

## 3. Limit Recommendations to 4 Videos

**Decision**
Display only 4 recommended videos per context

**Why**
- API limitations restrict how many videos can be fetched efficiently
- Smaller set improves clarity and reduces noise
- Easier to maintain perceived relevance

**Tradeoff**
- Less depth in early discovery
- May feel constrained if users want to browse more

---

## 4. Start with Heuristic + Tag-Based Recommendations

**Decision**
Use artist tags and similarity heuristics before relying on user behavior

**Why**
- No meaningful user data exists at early stage
- Need recommendations to work immediately
- Tag-based approach is simple, explainable, and reliable

**Tradeoff**
- Less personalized initially
- “Vibe” matching may be imperfect

---

## 5. Plan for Hybrid Recommendation System

**Decision**
Combine:
- genre/tag similarity
- collaborative filtering (“users who searched for X also searched for Y”)

**Why**
- Tag-based recommendations provide immediate coverage
- Collaborative filtering improves with scale
- Blended approach avoids cold start problem

**Impact**
- System improves naturally over time without needing ML infrastructure

---

## 6. Use Supabase as Backend Foundation

**Decision**
Adopt Supabase (Postgres + Auth + API) for backend

**Why**
- Provides database, auth, and API in one system
- Supports anonymous → authenticated user model
- Integrates cleanly with Vercel
- Free tier sufficient for early stage

**Tradeoff**
- Requires learning backend concepts
- Free tier has limitations (pausing, storage limits)

---

## 7. Use Claude API for Artist Tagging

**Decision**
Automatically generate artist tags using Claude API

**Why**
- Manual tagging is not scalable
- Tags enable recommendation system
- Lightweight AI integration adds meaningful capability

**Tradeoff**
- Tag quality may vary
- Requires validation and possible future overrides

---

## 8. Maintain Frontend Simplicity (for Now)

**Decision**
Keep most logic client-side initially

**Why**
- Faster iteration
- Lower complexity
- No need for full backend early on

**Tradeoff**
- Limited personalization
- Some logic duplicated or constrained by client environment
- Requires careful handling of environment variables

---

## 9. Use PR + Preview Workflow (After Early Issues)

**Decision**
Adopt branch → PR → Vercel preview → merge workflow

**Why**
- Direct pushes to main caused regressions
- Preview environments allow validation before going live
- Reduces risk of breaking production

**Impact**
- More stable development process
- Better visibility into changes

---

## 10. Separate Git Control from Claude

**Decision**
Restrict Claude from performing Git operations

**Why**
- AI-assisted Git commands introduced risk (merges, force pushes, branch confusion)
- Maintaining manual control ensures predictable repo state

**Impact**
- Cleaner workflow
- Reduced risk of unintended changes

---

## 11. Prioritize Immersive Experience Over Feature Breadth

**Decision**
Focus on features that deepen engagement (e.g., recommendations) rather than expanding surface area too quickly

**Why**
- Core value is emotional and experiential
- Too many features risks diluting the product
- Strong sessions matter more than feature count

---

## 12. Accept Early Imperfection in Recommendation Quality

**Decision**
Ship recommendations before they are “perfect”

**Why**
- Learning requires real usage
- Quality improves with data
- Waiting for perfection delays feedback

**Tradeoff**
- Some recommendations may feel irrelevant
- Requires iteration based on real usage

---

## Guiding Principle

Favor decisions that:
- extend user sessions
- deepen emotional engagement
- support discovery without friction

while staying realistic about:
- API limits
- early-stage data quality
- solo developer workflow constraints

---

## 2026-06-13 — Distinguish "synced but empty" from "never searched" for video categories

**Context:** Interview and music video categories were only searched for artists with ≥3 concert videos, and a category with zero results looked identical (empty array) to a category that was never attempted. This caused the frontend to repeatedly trigger live YouTube searches for artists who genuinely have no interviews/music videos, wasting API quota.

**Decision:** Persist a `video_types_synced` array on the artist record marking which secondary categories (interview, music_video) were successfully searched and written, regardless of whether any relevant results were found. The frontend trusts a cached-but-empty category only if it's marked synced, and falls back to a live search only for categories never attempted.

**Rationale:** Avoids repeated wasted YouTube API calls for artists with no interview/music-video content, while still allowing legacy/never-attempted artists to get a live fallback. Required widening the `artist_videos` unique constraint to `(artist_id, youtube_video_id, video_type)` so the same video can legitimately appear in multiple categories (e.g. a clip that's both a live performance and shows up in an interview search).

## 2026-06-13 — Filter concert search results for relevance, consolidate artist aliases

**Context:** Concert search results were never filtered for relevance (unlike the interview/music-video searches added previously), so common-word or ambiguous artist names could surface unrelated "live concert full set" videos. Separately, `build-artist-page` kept its own copy of the `ARTIST_ALIASES` map, duplicating `src/data/artistAliases.ts`, and relevance matching only checked video titles, not channel names.

**Decision:** Apply `isRelevantResult` filtering to concert search results (capped at 25) the same way it's applied to interviews/music videos. Have `build-artist-page` import `getAliases` from the shared `src/data/artistAliases.ts` instead of maintaining a separate alias map, and extend relevance matching to also check `channel_title` (decoded via a new shared `decodeHtml` util) in addition to the title.

**Rationale:** Reduces irrelevant videos for artists whose names collide with common phrases, removes a duplicated/drifting alias list, and channel-name matching gives another relevance signal for official artist/band channels without being a hard requirement. Accepted trade-off: the common-word false-positive problem (e.g. "Destroyer") isn't fully solved — see backlog.

## 2026-06-13 — Admin Content Refresh: preview-then-publish for single-artist curation

**Context:** Automated artist pages occasionally have stale, incomplete, or low-quality metadata/videos, but there was no safe way for an admin to regenerate and correct a single artist's content without risking accidental overwrites of curated data or manually-added videos.

**Decision:** Add an unlinked `/admin/content-refresh` route, gated by Supabase magic-link auth plus an `admin_users` allowlist checked server-side by the `admin-content-refresh` edge function. The flow always generates a preview (artist metadata, same-vibe artists, and/or live videos, selectable per-scope) and requires an explicit publish step, applied atomically via `publish_admin_content_refresh`. Manually-added videos (`is_manually_added = true`) are protected from automatic replacement unless the admin explicitly confirms a "replace protected" action. Every preview/publish is logged in `admin_content_refreshes`. The public lazy-build path (`build-artist-page`) was also hardened to treat curated artist rows as complete and to lock/recheck the artist immediately before writing videos, so it can't race with or undo an admin refresh.

**Rationale:** Preview-then-publish avoids accidental data loss from a single click, and scoping refreshes to one artist at a time keeps the blast radius small for a solo-developer workflow. Explicitly deferring batch refreshes, bulk cache invalidation, drag-and-drop ordering, interview/music-video persistence, and a rollback UI keeps the initial version small enough to validate before expanding — see backlog.

## 2026-06-13 — Add Scene Explorer as a curated discovery surface

**Context:** Discovery on Encore Atlas was previously driven by per-artist "Same Vibe" suggestions and search; there was no way to browse music by scene/era/place (e.g. "D.C. Revolution Summer", "Bay Area Ska-Punk", "Manchester After Dark").

**Decision:** Add a `SceneExplorerPage` backed by a hardcoded `src/data/scenes.ts` list of scene definitions (name, place, era, accent color, introduction, significance, traits, and a fixed `artistNames` list). `getSceneArtists` (`src/services/scenes.ts`) resolves each scene's artist names against the `artists` table and attaches a representative video per artist. Also restored the legacy "Same Vibe" artists behavior on `LiveShowsPage` that had been affected by the admin-content-refresh changes.

**Rationale:** A curated, editorial entry point supports discovery without relying on per-artist algorithmic suggestions, and ties into the "deepen emotional engagement" / "support discovery without friction" goals. Hardcoding scenes in code (rather than a `scenes` table) was the fastest way to ship a first version; see backlog for moving this to data if scenes need to be editable without a deploy.

## 2026-06-16 — Prefer Wikipedia "(band)" disambiguation page for artist metadata

**Context:** For artists whose bare name is the primary Wikipedia topic for something unrelated (e.g. "Destroyer" resolves to the naval warship article, not the Dan Bejar band), `fetchWikipedia` was silently returning the wrong article's extract, thumbnail, and URL — which then fed incorrect factual context to Claude for genre/location/years-active tagging and the bio blurb.

**Decision:** Try `{Artist} (band)` first via the Wikipedia REST summary API; fall back to plain `{Artist}` if the band-qualified page returns 404 or is a disambiguation page. Consolidated the three duplicated `fetchWikipedia` implementations (`src/services/wikipedia.ts`, `build-artist-page`, `admin-content-refresh`) into a single shared `fetchWikipediaSummary` helper in `src/utils/wikipedia.ts`. The Wikipedia REST API follows redirects, so for artists without a separate `(band)` article (e.g. New Found Glory), the `(band)` request transparently resolves to the correct primary article.

**Rationale:** Fixes the Destroyer case definitively without requiring content analysis or external disambiguation signals. Accepted trade-off: for solo artists who share a stage name with a former band (e.g. Alice Cooper), `Alice Cooper (band)` is a distinct Wikipedia article and would be preferred incorrectly. This was judged low-severity because (a) the artist photo is no longer displayed in the UI, (b) the `wikipedia_url` mismatch is only visible to admins in the refresh diff view, and (c) the extract-to-Claude impact on tags/blurb is minor and admin-reviewable via the preview-then-publish flow. A keyword-heuristic fix (checking both in parallel and preferring whichever extract mentions music-related terms) was identified but deferred — see backlog.

## 2026-07-04 — Validate LLM-suggested related artists before persisting (PR #36)

**Context:** Claude's `relatedArtists` suggestions in `build-artist-page` were persisted unvalidated, so hallucinated or malformed names — including mixed-script mashups like "راديو head" — ended up in artist rows and rendered as "Same Vibe" tiles linking to garbage pages.

**Decision:** Two validation layers. Deterministic filters in `src/utils/artistNameFilters.ts` (`hasMixedScript`, `normalizeArtistName`, `filterRelatedArtists`) drop mixed-script names, self-references, empties, and duplicates — applied server-side on fresh builds and client-side in `normalizeArtistContext` for rows cached before validation existed. Then each surviving name is checked against MusicBrainz (`_shared/musicbrainz.ts`, `verifyArtistNames`): a definitive miss drops the name, a match swaps in MusicBrainz's canonical spelling ("radio head" → "Radiohead"), and a transport failure fails open (keeps the name). Lookups run sequentially at ~1/s (MusicBrainz's anonymous rate limit), capped at `MAX_LOOKUPS = 12` per build, started early and awaited after the video writes to hide latency.

**Rationale:** Deterministic filters catch what's detectable without a network call; MusicBrainz catches plausible-looking inventions. Fail-open on transport errors means MusicBrainz downtime degrades validation rather than blocking builds. The prompt was also tightened (real, established acts only; one consistent script) but prompt guidance alone was judged insufficient.

## 2026-07-04 — Validate the subject artist name; don't swap in MusicBrainz canonical names (PR #37)

**Context:** PR #36 validated related-artist *suggestions*, but `build-artist-page` still built and cached a page for any `artist_name` string it received — so junk pages deleted from the DB could be recreated via stale links or search history.

**Decision:** On cache misses only (curated/cached artists are never re-validated), the edge function rejects mixed-script names via `hasMixedScript` and names with no MusicBrainz match via a new single-lookup `verifySubjectArtist` helper, returning a 404 with an `artist_not_found` code. MusicBrainz transport failures fail open and build anyway. The frontend parses the 404 into a typed `ArtistNotFoundError`, `useArtistPage` exposes it as a `notFound` flag distinct from `error`, and `LiveShowsPage` renders a friendly "we couldn't find that artist" state while suppressing all YouTube live-search fallbacks for rejected names.

**Rationale:** Validating after the cache check keeps existing curated/cached artists unaffected. The MusicBrainz canonical name is deliberately **not** swapped into the stored row: the edge function's `ilike` cache check and `artistNameLookupVariants` in `src/services/artistPage.ts` both match on the user's normalized lowercase input, and `ilike` is case-insensitive but not diacritic-insensitive — storing "sigur rós" for input "sigur ros" would make the row unfindable and trigger a rebuild on every visit. Suppressing the YouTube fallbacks for rejected names avoids burning quota surfacing unrelated videos for junk searches. Accepted trade-offs: junk names can still build pages during MusicBrainz downtime (fail-open), and stored names keep the user's input casing rather than canonical spelling.

## 2026-07-04 — Upcoming shows as a self-hiding sidebar section (PR #38)

**Context:** We wanted to represent upcoming live shows (Ticketmaster) on artist pages. The question was where this belongs in the layout and how it behaves for the large share of Encore Atlas artists — classic-era, disbanded, or deceased — who will never have tour dates.

**Decision:** A new `UpcomingShowsSection` renders in the sidebar between "Same Vibe" and "Merch" in both artist page layouts (above Merch in the mobile flow). It caps at 4 nearest dates as ticket-stub rows (mono date block, venue, city, link out) plus an "All tour dates" link to the artist's Ticketmaster page. Each layout calls `useUpcomingShows(artistName)` once and passes the result to both responsive copies of the presentational section — `ArtistPageLayoutProps` is untouched — and the section renders nothing while loading or when there are no shows.

**Rationale:** Shows are action-oriented external-link content like merch, so they belong in the sidebar rather than competing with the video column. Hiding rather than showing an empty state matters here more than usual: most catalog artists aren't touring, and a permanent "no upcoming shows" box would read as an epitaph, whereas an occasional populated section is a pleasant surprise. Fetching in the layout (not the section) keeps the change out of `LiveShowsPage`'s already-busy data assembly while avoiding a double fetch: the desktop and mobile copies are both mounted with only CSS (`lg:hidden` / `hidden lg:block`) hiding one, so a self-fetching section would invoke the edge function twice per cache miss (caught in Codex review). A "On tour" header badge was deferred (see backlog) to keep the PR contained.

## 2026-07-04 — Ticketmaster via edge function: attraction-first resolution, client-only caching (PR #38)

**Context:** Ticketmaster Discovery API keys can't ship in the client bundle (same lesson as the exposed `VITE_YOUTUBE_API_KEY`), and keyword-based event search is dangerously fuzzy — "Chicago" the band would match every event in the city of Chicago.

**Decision:** A new `upcoming-shows` edge function resolves in two steps: attraction (artist) search by keyword, strict name-match via the same normalized/punctuation-aware comparison the MusicBrainz helpers use (`pickAttraction` in `_shared/ticketmaster.ts`), then event search by attraction id only. No matching attraction means an empty result, never a fuzzy guess. Events are deduped to one row per venue-night (VIP/package listings collapse), and canceled/postponed events are dropped — postponed shows carry their original, now-wrong date; rescheduled ones are kept since Ticketmaster updates the start date. A missing `TICKETMASTER_API_KEY` secret degrades to an empty list rather than an error. Client-side, successful responses are cached in localStorage for 12 hours via the existing `cache.ts` helper; errors resolve to empty and are never cached. No new Supabase table.

**Rationale:** Attraction-first resolution trades a second API call for precision, which is the right trade for a catalog full of common-word band names. Client-only caching avoids a migration and keeps Ticketmaster traffic to ~one call per artist per browser per day — well inside the default 5k/day quota; a server-side cache table remains an option if quota becomes a problem (see backlog). Not caching errors means a transient failure can't hide a tour for 12 hours.

## 2026-07-05 — Full-catalog video audit done in-session instead of building batch audit infrastructure

**Context:** Artist pages carried two visible data-quality problems: duplicate artists predating the PR #37 name validation ("grateful dead" / "the grateful dead", "radio head" / "راديو head") and wrong-artist videos passing the string-containment `isRelevantResult` filter (KISS's *Destroyer* album on the Destroyer band page). The question was how to find the full extent of both without new machinery.

**Decision:** One-time audit: export all `artist_videos` rows (artist, title, channel, type) via the Supabase SQL editor and have Claude review every row in-session. Result: 324 of 3,394 videos flagged across 51 artists, written to `~/Downloads/encore-atlas-flagged-videos.csv` with per-row reasons. Four pages turned out not to be music artists at all (a kids' YouTube channel, a venue, two zero-signal names); worst contamination was Destroyer (38/72 wrong) and Catch 22 (38/70, nearly the whole interview tab being the Heller novel / Hulu series).

**Rationale:** Title + channel is almost always enough signal to judge relevance when you know who the artist is, so a batch pipeline would have been premature — the export-review loop cost nothing and produced the worklist directly. The ongoing replacement is not a scheduled job (rejected: batch-audit machinery contradicts the prove-it-on-one-artist philosophy) but a `artist_data_health` view + "Needs attention" panel in the admin page (backlog).

## 2026-07-05 — Wrong-artist videos: Claude relevance judgment at build time, genre-augmented secondary searches

**Context:** The audit showed `isRelevantResult` (substring match on title/channel) cannot distinguish "contains the artist's name" from "is about this artist" — fatal for common-word band names (Destroyer, X, Tree, Witch, Lifetime, Catch 22, Under Oath). The interview and music-video searches are the main contamination vector: `"${artist} live concert full set"` carries enough context to rank the right act, but bare `"${artist} interview"` and `"${artist} official music video"` lose it entirely.

**Decision:** Two-layer fix, both deferred to the prevention PR. (1) Retrieval: append the artist's primary genre to the secondary search queries (`"Destroyer indie rock interview"`). In `build-artist-page` the genre comes from the `claudeTag` result, which runs before the secondary searches; in `admin-content-refresh` it comes from the stored `artist_context.genre` / `tags` already loaded for the refresh. (2) Judgment, which is **not** a single reused call — the sequencing differs per path:
- `build-artist-page`, concert videos: extend the existing `claudeTag` call (it already receives the concert `topResults` titles plus the Wikipedia extract) with per-video channel names and a new output field listing indexes of videos that don't appear to be this artist; filter before persisting. This part genuinely reuses the existing call.
- `build-artist-page`, interview/music-video candidates: these are fetched *after* `claudeTag` returns — its genre output is what builds the genre-augmented queries, so the ordering can't be inverted. They get a **second, relevance-only Haiku call** (candidate titles + channels, Wikipedia extract, genre) before persist. This call only fires on the popular-artist path where secondary searches run at all.
- `admin-content-refresh`, targeted video refresh: has **no Claude call today**; it gains the same relevance-only call, grounded in the stored `artist_context.genre`/`tags` and `wikipedia_extract` rather than a fresh tag pass.

A static `"band"` keyword was considered and rejected: wrong for solo artists and unhelpful for band-vs-band collisions (Kittie vs Kitty, Pig Destroyer vs Destroyer), which genre discriminates.

**Rationale:** For concert videos the judgment layer piggybacks on an API call that already happens on every build — no added latency or cost. Covering the main contamination vector (interviews, music videos) honestly costs one extra relevance-only Haiku call per full build and per admin video refresh; small, but not free, and worth stating so the prevention PR isn't scoped against a wrong baseline. The audit is direct evidence the check would have caught essentially every flagged video. Retrieval and judgment are complementary: better queries raise the floor, the Claude check catches the leftovers. Conservative stance where grounding is weak: null `wikipedia_extract` plus low-confidence should flag for review, not silently drop. *(Amended same-day after Codex review: the original text described the judgment layer as reusing the existing `claudeTag` call with no added cost, which only holds for concert candidates.)*

## 2026-07-05 — Duplicate/junk artist cleanup by one-time SQL; admin tool gains delete but not merge

**Context:** With dupes and junk pages identified, we needed the repair mechanism plus prevention. The admin refresh tool intentionally has no destructive operations, and the lazy-build cache lookup (`ilike` on the user's normalized input) is what allowed near-miss names to create parallel pages.

**Decision:** Repairs are hand-run SQL in the Supabase editor: merges repoint `watch_history` and `artist_searches` to the survivor then delete the loser (survivors: "the grateful dead" — it holds the manually-added videos — and "touché amoré"); pure-junk pages are deleted outright; misspelled-but-correct pages are renamed in place (radio head → radiohead, ty seagull → ty segall, under oath → underoath, white fences → white fence, etc.). Name lookups in these scripts must go through `normalize(name, NFC)` — the touché amoré row's é is stored decomposed and defeats `=` comparison. Prevention: a `name_normalized` column (diacritic-stripped, article-stripped) with a unique index, used by the build-path cache check — this supersedes the PR #37 constraint that kept stored names lookup-compatible, and unblocks the `display_name` backlog idea. The admin tool gets a page-delete action (type-the-name confirm, blast-radius display incl. watch-history count, curated-artist guard, audit row) but **not** merge — the two real merges are one-time SQL and the unique index prevents recurrence.

**Rationale:** Deleting an artist is low-risk in this architecture (pages lazy-rebuild on demand), so a guarded admin action beats raw SQL operationally; merge, by contrast, needs survivor selection and history repointing — automation would outlive its usefulness. Hard sequencing constraint recorded: all merges/renames must complete before the unique-index migration can be applied, and the search/judgment fixes should deploy before re-refreshing the worst common-word pages or they simply re-pollute.

## 2026-07-05 — Video text stored display-ready; render-time decoding to be retired (PR #39)

**Context:** YouTube's search endpoint HTML-escapes snippet fields; the edge functions persisted them raw. Public video cards masked this with render-time `decodeHtml`, but the admin refresh preview renders titles raw — which is where the `&#39;` artifacts were noticed.

**Decision:** Decode at persist time (PR #39: both edge functions decode `snippet.title` and the snippet fallbacks for description/channel; `videos.list` detail fields are unescaped and left alone; `claudeTag` now receives decoded titles). Existing rows get a one-time SQL entity cleanup (replace chain with `&amp;` decoded last), to be run after the function deploy so no stragglers are written. The five render-time `decodeHtml` calls stay for now — Codex review flagged the theoretical double-decode of titles whose visible text contains literal entities, judged unrealistic for music content — and will be removed in the prevention PR, making "the DB is display-ready" the single rule.

**Rationale:** Fixing at the source means every consumer (admin UI, Claude prompts, exports, future surfaces) gets clean text for free, instead of each one having to remember the decode. Keeping the render decodes temporarily let PR #39 stay a two-file fix with zero deploy-order risk: decoding already-clean text is a no-op.
