# Backlog

Opportunities discovered during development — not prioritized.

## 2026-06-13
- ~~`build-artist-page`'s `ARTIST_ALIASES` map ... worth consolidating into a shared source~~ — done 2026-06-13: `build-artist-page` now imports `getAliases` from `src/data/artistAliases.ts` instead of keeping its own copy.
- ~~Relevance filtering ... doesn't use channel name~~ — done 2026-06-13: `isRelevantResult`/`isRelevantVideo` now also match against `channel_title`.
- Artists whose name is a common word (e.g. "Destroyer") get irrelevant music videos through `isRelevantResult`/`isRelevantVideo`: a video titled "<Other Artist> - <Song> (Destroyer)" passes the title-substring check even though it's unrelated. Tightening the title-only match (e.g. requiring the artist name near the start of the title, or requiring a channel match as a secondary signal) risks rejecting legitimate interviews/music videos from non-official channels, which is especially common for smaller artists. The new channel-name matching (above) helps but doesn't fully resolve this — still needs a confidence-based approach rather than a hard filter change.

## 2026-06-13 (later session)
- Concert search results are now also filtered through `isRelevantResult` (previously only interviews/music videos were filtered), which should reduce irrelevant "live concert full set" results for common-word artist names — but the common-word false-positive problem above likely still applies to concert search too.
- Scene Explorer (`src/data/scenes.ts`) is a hardcoded list of curated music scenes (D.C. Revolution Summer, Bay Area Ska-Punk, Manchester After Dark, etc.), each with a fixed `artistNames` list resolved against the `artists` table via `getSceneArtists`. Adding a scene currently requires a code change/deploy; could eventually move to a `scenes` table for editability via the admin tooling.
- Admin Content Refresh (`/admin/content-refresh`, see [admin-content-refresh.md](../app/docs/admin-content-refresh.md)) intentionally excludes: batch/scheduled refreshes, bulk cache invalidation, drag-and-drop video ordering, interview/music-video persistence, and a rollback UI. These are explicit candidates for a v2 once the one-artist workflow has been used enough to validate the review steps.
