# Architecture

## Current Architecture

Encore Atlas is a React/TypeScript SPA backed by Supabase (Postgres + Edge Functions). Artist pages are built lazily: the `build-artist-page` Edge Function fetches artist metadata (Wikipedia/Claude-tagged context) and searches YouTube for concert videos, persisting results to `artist_videos` keyed by `(artist_id, youtube_video_id, video_type)`. For artists with ≥3 concert videos, it also searches for interviews and official music videos, filters results for relevance (artist name/alias matching), and persists them under their respective `video_type`. The `artists` table tracks `video_types_synced` (text[]) so the frontend (`useVideos.ts`, `LiveShowsPage.tsx`) can distinguish "category searched but genuinely empty" from "category never attempted," falling back to a live YouTube search only in the latter case. Cached reads go through `getCachedArtistPage` in `artistPage.ts`, which treats a failed `artist_videos` query as a cache miss rather than an empty result.

The `LiveShowsPage` (artist detail page) also surfaces a "Same Vibe" section of related/similar artists for discovery, and a `MerchSidebar`/`MerchPage` for artist merchandise. A separate `WatchHistoryPage` tracks the user's viewing history.

## Changelog

### 2026-06-13 — Persist interviews/music videos with sync tracking and channel titles
- Added migration 009 follow-up: widened the `artist_videos` uniqueness constraint to `(artist_id, youtube_video_id, video_type)` so the same video can appear under multiple categories (e.g. concert + interview) without one upsert overwriting another.
- Added migration 010: widened `artist_videos.view_count` to `bigint` to support official music videos with 2B+ views.
- Added migration 011: added `artists.video_types_synced text[]` and `artist_videos.channel_title text`.
- `build-artist-page` now filters secondary (interview/music video) search results for relevance against the artist name and known aliases (`ARTIST_ALIASES`) before persisting, and records which secondary categories were successfully searched in `video_types_synced`.
- Frontend (`useVideos.ts`, `LiveShowsPage.tsx`, `artistPage.ts`) uses `video_types_synced` (via `interviews_synced`/`music_videos_synced`) to decide whether to trust a cached-but-empty category or fall back to a live YouTube search, and now displays `channel_title` on video cards.
- `getCachedArtistPage` now treats a failed `artist_videos` query as a cache miss rather than an empty result, preventing a transient DB error from being mistaken for "synced and empty."

### 2026-06-13 — Relevance filtering on concert search, shared aliases, channel-name matching
- `build-artist-page` now filters concert search results through `isRelevantResult` (same as interviews/music videos), capping at 25 after filtering.
- `build-artist-page` imports `getAliases` from `src/data/artistAliases.ts` instead of maintaining its own `ARTIST_ALIASES` map.
- Relevance matching (`isRelevantResult` in the edge function, `isRelevantVideo` in `src/services/youtube.ts`) now checks `channel_title` in addition to title, using a shared `decodeHtml` util to handle HTML-entity-encoded titles/channel names.

### 2026-06-13 — Admin Content Refresh workflow
- Added `/admin/content-refresh` (`AdminContentRefreshPage.tsx`, unlinked from public nav), gated by Supabase magic-link auth and an `admin_users` allowlist enforced by the new `admin-content-refresh` edge function (`adminContentRefresh.ts` service).
- The function supports per-scope preview/publish for artist metadata, same-vibe artists, and live videos; publishing runs through `publish_admin_content_refresh` in one transaction and is logged in `admin_content_refreshes` (migrations 012-016).
- Manually-added videos (`is_manually_added = true`) are protected from automatic replacement; metadata/same-vibe-only publishes preserve the "incomplete artist" build marker.
- `build-artist-page` now locks and rechecks the artist row immediately before writing videos so it can't overwrite a curated/admin-refreshed artist (migration 016). Removed `ArtistLocationMap.tsx` (no longer used on `LiveShowsPage`).
- See [admin-content-refresh.md](admin-content-refresh.md) for the full operator workflow.

### 2026-06-13 — Scene Explorer
- Added `SceneExplorerPage.tsx`, routed and linked from `AppLayout`, presenting a grid of curated music "scenes" defined in `src/data/scenes.ts` (name, place, era, accent color, narrative copy, traits, and a fixed `artistNames` list).
- `src/services/scenes.ts` (`getSceneArtists`) resolves each scene's artist names against the `artists` table, attaching tags/blurb/context plus one representative video per artist.
- Restored the legacy "Same Vibe" related-artists section on `LiveShowsPage` (`artistNames`-based), which had regressed during the admin-content-refresh work.
