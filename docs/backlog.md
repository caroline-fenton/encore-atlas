# Backlog

Opportunities discovered during development — not prioritized.

## 2026-06-13
- ~~`build-artist-page`'s `ARTIST_ALIASES` map ... worth consolidating into a shared source~~ — done 2026-06-13: `build-artist-page` now imports `getAliases` from `src/data/artistAliases.ts` instead of keeping its own copy.
- ~~Relevance filtering ... doesn't use channel name~~ — done 2026-06-13: `isRelevantResult`/`isRelevantVideo` now also match against `channel_title`.
- Artists whose name is a common word (e.g. "Destroyer") get irrelevant music videos through `isRelevantResult`/`isRelevantVideo`: a video titled "<Other Artist> - <Song> (Destroyer)" passes the title-substring check even though it's unrelated. Tightening the title-only match (e.g. requiring the artist name near the start of the title, or requiring a channel match as a secondary signal) risks rejecting legitimate interviews/music videos from non-official channels, which is especially common for smaller artists. The new channel-name matching (above) helps but doesn't fully resolve this — still needs a confidence-based approach rather than a hard filter change.

## 2026-06-13 (later session)
- Concert search results are now also filtered through `isRelevantResult` (previously only interviews/music videos were filtered), which should reduce irrelevant "live concert full set" results for common-word artist names — but the common-word false-positive problem above likely still applies to concert search too.
- Scene Explorer (`src/data/scenes.ts`) is a hardcoded list of curated music scenes (D.C. Revolution Summer, Bay Area Ska-Punk, Manchester After Dark, etc.), each with a fixed `artistNames` list resolved against the `artists` table via `getSceneArtists`. Adding a scene currently requires a code change/deploy; could eventually move to a `scenes` table for editability via the admin tooling.
- Admin Content Refresh (`/admin/content-refresh`, see [admin-content-refresh.md](admin-content-refresh.md)) intentionally excludes: batch/scheduled refreshes, bulk cache invalidation, drag-and-drop video ordering, interview/music-video persistence, and a rollback UI. These are explicit candidates for a v2 once the one-artist workflow has been used enough to validate the review steps.

## 2026-06-16
- Wikipedia `(band)` disambiguation fix doesn't handle solo artists who share a stage name with a former band (e.g. "Alice Cooper (band)" is a distinct article about the 1968 group, so the fix would incorrectly prefer it over the solo artist's primary article). A keyword-heuristic approach — fetch both `{Name}` and `{Name} (band)` in parallel, prefer whichever extract contains music-related terms (`band|musician|singer|songwriter|rapper|album|rock|pop`) — would address this without requiring external signals. Accepted as low-severity for now since the artist photo is not displayed, the `wikipedia_url` mismatch is admin-only, and Claude's tagging is admin-reviewable before publish.
- After merging the Wikipedia fix, worth checking a few artists whose plain Wikipedia page is clearly off-topic (Destroyer, etc.) via Admin Content Refresh to see if blurb/city/yearsActive improved. Tags alone aren't a good signal since Claude's training data and video titles dominate that field regardless of the Wikipedia extract.
