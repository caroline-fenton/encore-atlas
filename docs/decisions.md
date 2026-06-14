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
