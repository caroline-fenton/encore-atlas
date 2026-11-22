# Video curation implementation assessment

Assessment date: 2026-11-07. Inspected the current local source and `origin/main` reference at `dd5ef8b` (PR #49). This is a source assessment, not verification of the currently deployed functions or schema. No runtime changes or database writes were made for this documentation task.

## Existing foundation

- `src/pages/AdminContentRefreshPage.tsx`: per-artist preview, remove/replace/add controls, manual-pick protection, and publication. Its default scopes include metadata, same-vibe, and videos; normal preview uses stored videos, while targeted search is separate. No batch decision queue or direct category-move control was found.
- `src/services/adminContentRefresh.ts`: typed preview and publish calls with explicit manual removals and replacements.
- `supabase/functions/admin-content-refresh/index.ts`: authenticated admin workflow, preview ownership checks, publish validation, and snapshot persistence before calling the publication RPC.
- `supabase/functions/_shared/refresh-policy.ts`: manual-pick validation, duplicate rejection, and order normalization. Automatic deduplication prefers manual picks, then existing types in fixed `concert`, `interview`, `music_video` order. That order is not a content classifier and must not decide editorial category conflicts.
- `supabase/migrations/018_admin_refresh_all_video_types.sql`: transactional per-artist publication, row locks, stale-snapshot rejection, explicit manual removal/replacement checks, and before/proposed/published audit snapshots. It deletes absent eligible rows and upserts retained rows; publication is not just a cosmetic preview update.
- `supabase/functions/build-artist-page/index.ts`: concert discovery searches `live concert full set`, accepts any duration, and uses YouTube relevance order. It does not implement the agreed editorial ranking or eligibility policy.
- No Jev integration references were found in `src`, `supabase`, `docs`, or `README.md` during this assessment. Do not assume an API or integration contract.

## Required changes

1. **Persist decisions and approval provenance.** Add a versioned review record keyed by artist ID and YouTube ID, with recommendation, destination, reason, evidence, reviewer, approval time, policy version, and application status. Separate approved decisions from machine suggestions. Track legacy versus new-policy approvals without removing current manual protections. Record exclusions so automatic discovery cannot re-add rejected videos.
2. **Build a batch review UI.** Show thumbnails, watch links, current placements, recommendation, destination, and uncertainty. Support keep/move/remove, explicit review approval, exception editing, and an application summary. Review approval and successful application must be separate states. Keep ranking controls out of the public browsing UI.
3. **Create previews that preserve undecided content.** Start from a fresh complete artist snapshot and apply only the approved artist/video decisions. Preserve every unrelated video and all metadata. Do not run global fixed-priority deduplication on undecided groups. Support partial artist cleanup even when other duplicates remain; existing global duplicate rejection needs a scoped invariant or a dedicated reviewed-decision publication path. Do not mark untouched duplicates resolved.
4. **Apply via an authenticated server operation.** Reuse transactional locking, snapshot conflict checks, explicit manual-override validation, and audit snapshots. Validate approved policy version and reviewer authorization on the server. Group decisions per artist, record success/conflict/failure independently, and make retries idempotent. A category move must preserve video metadata and approved protection. Avoid raw ad hoc SQL deletion and artist-page deletion.
5. **Handle empty results deliberately.** Current UI/backend/RPC reject a completely empty video list. A legitimate policy audit may reject every video for an artist. Add an explicit reviewed-empty state and prevent automatic refilling from undoing it; retain the artist page. Never bypass the existing guard without this replacement behavior.
6. **Integrate Jev as a recommendation producer.** Supply policy version and artist/video evidence, including channel, duration, description, and viewing/transcript evidence when available. Return category, action, concise rationale, evidence basis, and uncertainty. Distinguish unavailable evidence from negative evidence. Validate the response server-side; recommendations must not directly publish during calibration.
7. **Enforce discovery and ranking.** Consult exclusions and protected approvals before automated writes. Classify by primary content rather than title keywords or category priority. Track performance format and same-show identity internally for ranking/diversity. Tune weights and repetition caps against review results; these numeric settings are not yet approved. Update public/admin labels consistently while retaining existing database enum strings.

## First application: the eight examples

The [approved examples](video-curation-approved-examples.json) are an acceptance fixture, not an executable migration. Resolve names to verified artist IDs, load fresh rows, and construct exact diffs. Existing rows may already meet a keep decision because of earlier duplicate cleanup; record approval and protection rather than making unnecessary content edits. Remove rejected IDs only from the specified artist. Retain unrelated duplicate groups pending their own review.

Publish only through the reviewed-decision path once it supports partial cleanup and approval/exclusion persistence. Verify each intended category/removal, protected keep, unchanged unrelated content, and saved audit outcome. The human confirmations of audiovisual quality (#1) and audio-only content (#6) are already provided; do not ask for them again without new conflicting evidence.

## Required verification when implemented

- Approved destination wins over fixed category priority; each resolved video has exactly one placement.
- Partial cleanup leaves unrelated duplicates and metadata intact.
- Legacy manual picks require explicit individual audit approval for removal/move; new-policy approved picks resist automatic changes.
- Approved exclusions prevent rediscovery for that artist while allowing the same video for another appropriate artist.
- Stale snapshots fail without partial artist writes; retries do not duplicate application or audit events.
- Explicit reviewed-empty artists remain intact and are not automatically refilled.
- All eight approved examples produce the agreed outcomes; evaluate a fresh human-reviewed batch separately to avoid mistaking memorized examples for classifier quality.
- End-to-end UI review, authenticated application, read-only database verification, and conflict/error presentation succeed before rollout.

## Implementation order

Implement decision/provenance storage and a scoped publish path first, then the batch review UI and the eight approved changes. Connect Jev recommendations after its integration contract is available. Enable broader automation only after calibration and explicit agreement on acceptable errors and review volume.

## Implementation status — 2026-11-22

The first implementation adds `/admin/video-review`, an authenticated review API within
`admin-content-refresh`, and migration `20261122132320_video_curation_reviews.sql`.
Each saved preview snapshots only its artist/video target. Approval and application
are separate; application is atomic per artist, leaves unrelated content untouched,
and rejects changed snapshots. Pending reviews can be dismissed without changing
content. Exclusions retain source metadata for explicit human restoration. Legacy
manual picks are not retroactively approved. Existing manual protections remain;
new approvals made in Video Review additionally carry policy version and provenance.

The public builder does not call the review API or an AI classifier. A database
trigger enforces exclusions and reviewed categories across writers. Reviewed keeps
are also marked manual so existing refresh logic preserves them. Attempts to remove
or reclassify protected picks through Content Refresh fail with a message directing
the admin to Video Review. Its automatic candidates can include excluded videos in
preview, but the database suppresses their insertion; published snapshots reflect
actual stored content.

The eight examples load from the agreed fixture, resolve exact artist names, and
show missing/ambiguous matches instead of guessing. They have **not** been applied.
Jev integration, automated recommendations, confidence thresholds, and richer
ranking remain deferred until the integration contract and calibration are available.
This implementation does not claim that unreviewed discoveries meet the policy.

Verification completed locally: production frontend build; 84 Node tests; scoped
ESLint; full migration replay against disposable PostgreSQL 17; database tests for
admin authorization, approval gating, duplicate consolidation, protected picks,
artist-scoped exclusions, repeat exclusion/restoration, stale batch atomicity,
idempotence, and deletion cascades. Existing public-builder concurrency tests pass.
Local synthetic medians for 75 inserts over 25 iterations: 0.620 ms without the new
guard, 1.497 ms with it (about 0.9 ms added). This measures a small local database,
not production contention, a large decision history, or external API/page-build time.
The review screen is lazy-loaded separately from the public route bundle.

Rollout follows `../docs/workflow.md`: review/merge the PR, use an up-to-date main
checkout to push the migration, verify migration history, deploy
`admin-content-refresh`, then verify the authenticated browser flow before applying
the already-approved eight examples. Verify the eight outcomes and unrelated rows
using read-only database checks. Full authenticated browser-to-Edge verification and
production build timing remain rollout checks; no production schema/content writes
were made during implementation.
