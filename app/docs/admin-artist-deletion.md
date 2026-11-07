# Admin artist deletion

Select an artist in Content Refresh, open **Delete this artist page**, and review the counts. Type the stored artist name (case-insensitive, surrounding spaces ignored), then choose **Delete permanently**. Curated artists cannot be deleted.

Deletion removes the artist, videos, watch history, and admin refresh records. Past searches remain but unlink from the page. A separate audit row preserves the artist ID/name, authenticated admin ID, deletion time, and affected counts. Counts in the preview may change before deletion; the transaction records counts again. Deleted content is not recoverable through this tool. Future public searches can recreate the page; this is not a name blocklist.

Only an authenticated admin can invoke the Edge Function actions. The service-only SQL function checks admin membership, locks the artist, and rechecks its current name and curation state before deleting. No production data is deleted by deployment.

## Validation and rollout

- `npm test`: includes real Edge handler tests for authentication, admin authorization, confirmation, curated refusal, and preview counts.
- `python3 scripts/test-video-dedupe-db.py <local-postgres-container>`: replays all migrations in an isolated disposable database, tests deletion cascades/audit/permissions, and overlaps deletion with curation and rename transactions.
- `npm run build` and changed-file ESLint.

After merging, deploy the migration from main, then `admin-content-refresh`. The frontend deploy alone does not enable the new backend actions. Do not test deletion on a real artist merely to smoke-test deployment.

## Saved-work disposition

This change recovers only admin deletion from `codex/checkpoint-relevance-admin-cleanup`. The old `020_admin_artist_delete.sql` draft is replaced by the timestamped migration in this PR. Do not apply the checkpoint's `019_artist_name_normalized.sql`: artist identity was resolved in PRs #44–45.

The checkpoint's Claude relevance classifier, genre-augmented searches, and title-decoding changes remain preserved for separate review. They are not enabled here. Review those before the Jev/Decisions comparison so its baseline is explicit.
