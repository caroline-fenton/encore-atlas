# Backlog

Opportunities discovered during development — not prioritized.

## 2026-06-13
- `build-artist-page`'s `ARTIST_ALIASES` map (Freddie Mercury/Queen, Beyoncé/Destiny's Child, etc.) is a small hardcoded list duplicated from `src/data/artistAliases.ts`. Worth consolidating into a shared source and expanding coverage so more artists with band/solo-act aliases get relevant interview and music video results.
- Relevance filtering for secondary searches (interviews/music videos) only checks title text against artist name/aliases — doesn't use channel name, which is now persisted (`channel_title`) and could improve match precision for ambiguous artist names.
- Artists whose name is a common word (e.g. "Destroyer") get irrelevant music videos through `isRelevantResult`/`isRelevantVideo`: a video titled "<Other Artist> - <Song> (Destroyer)" passes the title-substring check even though it's unrelated. Tightening the title-only match (e.g. requiring the artist name near the start of the title, or requiring a channel match as a secondary signal) risks rejecting legitimate interviews/music videos from non-official channels, which is especially common for smaller artists. No clear fix identified yet — needs a confidence-based approach rather than a hard filter change.
