# Public builder video deduplication

Overlapping incomplete artist builds previously chose video categories from
independent JavaScript search snapshots. The per-call database lock protected
writes but did not prevent a later build from writing the same YouTube ID in a
different category.

`20261107140000_live_dedupe_public_builder_video_types.sql` makes the existing
`upsert_public_build_videos` RPC compare candidates with stored rows while holding
the artist lock shared with admin publication. The first persisted category wins;
within one fresh build, writes remain concert, interview, then music video.
A later concert candidate does not move an already-stored interview.

Same-category automatic rows can refresh their metadata. Manual rows retain their
title, order, and other fields, and cleanup never removes them. Intentional manual
copies in multiple categories remain for an admin to resolve. Successful empty
searches clear stale automatic rows in that category; failed searches skip the
write. Malformed scoped payloads are rejected before cleanup. The service-role-only
permission and curated/completed-artist guards remain in place.

The builder sends unfiltered category candidates to the RPC and reads persisted
videos for its final response. This keeps the first response consistent with cache
hits and includes manual rows absent from the latest searches. It does not rewrite
all existing pages or automatically clean already-completed/curated pages.

## Rollout

1. Review and merge the PR, then use an up-to-date main checkout.
2. Apply the new timestamped migration and verify migration history.
3. Deploy `build-artist-page`. Deploy the migration before the function: removing
   JavaScript filtering against the old RPC would permit duplicate rows.
4. Validate the newly built page and its subsequent cached load have the same
   video IDs/categories. Existing cached pages alone do not exercise this fix.

Do not apply the saved `020_live_dedupe_public_builder_video_types.sql` checkpoint;
this timestamped migration replaces that unfinished draft. No production database
changes or function deployments were performed while preparing this PR.

## Verification

- `npm test`: includes handler tests for raw candidates, persisted response rows,
  preserved manual picks, failed searches, successful empty searches, and read errors.
- `npm run build`: frontend typecheck and production build.
- `python3 scripts/test-video-dedupe-db.py <local-postgres-container>`: creates a
  uniquely named database in an existing disposable PostgreSQL 17 Docker container,
  replays all repository migrations with minimal Supabase auth-role stubs, runs SQL
  assertions, then runs two independent connections with overlapping transactions.
  It verifies a second writer actually waits for the artist lock before proceeding.
  The test database is dropped on exit; the container is left under caller control.
  This does not test the full Supabase auth stack or connect to production.

`supabase/tests/public_builder_video_dedupe.sql` is the rollback-wrapped SQL fixture
suite. Never use production for fixture-writing tests.
