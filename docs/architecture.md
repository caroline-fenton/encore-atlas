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
