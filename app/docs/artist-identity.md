# Artist identity and the Touché Amoré repair

Artist creation previously compared only case-insensitive display names.
Search and watch-history tracking could insert unvalidated artist rows, while
the stronger name filters applied only to related-artist suggestions. This
allowed `touché amoré`, `touché amore`, and `touché amoreé` to become separate
pages.

The `artist_identity_lookup` migration adds an indexed identity key and the
read-only, RLS-respecting `resolve_artist` RPC. It ignores case, accents,
spacing, and punctuation, and includes the explicitly reviewed Touché Amoré
typo. It does not guess arbitrary misspellings. Punctuation-only artists keep
their names. A leading `the` is a lookup fallback, not a uniqueness rule;
when both identities exist, the exact identity wins.

Cached pages, the edge builder, and history links all use this RPC. History
tracking no longer creates artist records. Searches for unresolved artists
are still recorded with no artist association; watch history requires a
resolved artist. The database index also prevents concurrent inserts with
equivalent identities.

## Production rollout

Merge the migration-history recovery PR #44 first. Production already has
`20260925222337_artist_identity_lookup.sql`; do not apply the checkpoint's
older `20260925205558` copy or the competing `019_artist_name_normalized.sql`.
The deployed resolver preserves punctuation-only identities and treats a leading
`the` as a fallback rather than collapsing distinct artists into one unique key.

After this app change is reviewed and merged, deploy `build-artist-page` from
updated main and publish the frontend. Frontend previews use production Edge
Functions: cached-artist lookup can be tested in preview, but the changed builder
requires its own deployment. No new production migration is required here.

The migration merges only the reviewed Touché Amoré records into the original
`touché amoré` page. It preserves that page's ID and metadata, moves unique
videos, relinks search/watch history, and removes the duplicate artist rows.
It aborts on duplicate curated content, admin refresh history, conflicting
manual video selections, or unrelated identity collisions instead of deciding
how to merge those records automatically.

Before merging, full artist/video snapshots and the original history-row IDs
are stored in `artist_identity_merge_backups`. The table has RLS enabled and
no app-user privileges. Recovery requires administrator access: drop the
identity index before restoring duplicate artist rows, restore their videos
from the snapshots, and restore history associations using the saved IDs.
Review any edits made after the merge before restoring data.

## Verification

Run `supabase/tests/artist_identity.sql` after the migration inside a
transaction, then roll back. It checks normalized lookups, uniqueness,
punctuation-only names, exact-name priority, snapshot access restrictions,
and preservation of videos and history links. Run fixture-writing tests only
against a disposable/local database; the file wraps its assertions in BEGIN /
ROLLBACK. Read-only production verification confirmed `Radiohead` and `radio head`
resolve to the same ID, and accented/unaccented Touché Amoré share one ID.

For frontend smoke testing, search `Radiohead`, `radio head`, `Touché Amoré`,
and `Touche Amore`; confirm each pair shows the same videos without a build.
Check that watch history links to the stored artist name. Unknown search terms
may be logged but must not create empty artists through history tracking.
