# Cleanup before the relevance comparison

## Completed

- PRs #44–45: reconcile deployed migration history and use shared artist identity lookup.
- PR #46: serialize cross-category public-builder writes against stored videos.
- PR #47: pin the deployment CLI to the project version.
- PR #48: guarded admin deletion with audit history. Production preview smoke test passed.

## Remaining saved work: reviewed disposition

`codex/checkpoint-relevance-admin-cleanup` (`d61c2ea`) remains a preservation checkpoint, not a branch to merge wholesale.

- The alternate normalization migration and its callers are superseded by #44–45. Do not apply `019_artist_name_normalized.sql`.
- Admin deletion was recovered and tested in #48. Do not apply the old `020_admin_artist_delete.sql` draft.
- Keep the five render-time `decodeHtml` calls. A read-only production query on November 7, 2026 found 606 of 7,517 stored video titles matching common HTML entity patterns. The prerequisite historical data cleanup is incomplete. Removing these calls now risks displaying encoded text. The count is an audit signal, not proof every match is erroneous: literal entity strings can also be intentional.
- Defer the saved Claude relevance classifier and genre-augmented retrieval to the relevance experiment. These are unvalidated changes to candidate selection, not housekeeping prerequisites. The draft changes retrieval queries and judgment together, adds a second model request for secondary videos, and couples concert filtering to biography generation. Evaluate retrieval and judgment separately so differences can be attributed correctly. Preserve the draft as a potential Claude comparison baseline; do not silently enable its candidate rejection in production.
- The saved `claude/jolly-wilbur-02d601` optimization (`3595b06`) is recovered on current main: fetch interview/music-video candidates concurrently, retain sequential database writes and independent failure handling. This replaces the old commit rather than merging its stale branch.

## Remaining operations

After the search optimization merges, deploy `build-artist-page`; no database migration is needed. Existing duplicate videos need a separate complete artist inventory and reviewed admin preview/publish cleanup. Old local checkpoints/worktrees should be removed only after confirming no remaining uncommitted work; remote merged feature branches are optional housekeeping.

The comparison can then start from the current production relevance behavior, with candidate retrieval held constant for the initial judgment comparison. Provider integration and the evaluation dataset are separate work; this cleanup does not choose a provider or implement that experiment.
