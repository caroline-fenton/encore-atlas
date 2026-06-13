# Admin Content Refresh

Encore Atlas has a deliberately small administrative workflow for refreshing
one existing artist at a time. It lives at `/admin/content-refresh` and is not
linked from the public application.

The workflow generates a preview first and never writes generated content
until an administrator explicitly publishes it. Refresh history and preview
snapshots are stored in `admin_content_refreshes`; this document is not a
refresh log.

## Admin Setup

The route uses Supabase email magic-link authentication. Access is controlled
server-side through `admin_users`, not by whether someone knows the route.

After the admin has signed in at least once, provision their Supabase auth user
ID:

```sql
insert into public.admin_users (user_id)
values ('SUPABASE_AUTH_USER_UUID');
```

The `admin-content-refresh` edge function checks this allowlist for every
search, preview, replacement, and publish operation. Anonymous and non-admin
users cannot access artist data through the function.

## Deployment

Apply migration `012_admin_content_refresh.sql` before deploying the
`admin-content-refresh` edge function. The function reuses the existing
`YOUTUBE_API_KEY` and `ANTHROPIC_API_KEY` edge-function secrets, plus the
Supabase-provided URL, anon key, and service-role key.

Add the production `/admin/content-refresh` URL to the Supabase Auth redirect
allowlist so email magic links can return to the route.

## Refresh Workflow

1. Open `/admin/content-refresh` and sign in with the provisioned admin email.
2. Search for and select an existing artist.
3. Choose one or more scopes:
   - **Artist metadata:** genres, summary, location, active years, and
     Wikipedia source.
   - **Same-vibe artists:** related artist names and reasons.
   - **Live video content:** persisted live-performance videos. Interview and
     music-video categories are left unchanged.
4. Select **Generate preview**.
5. Review current and proposed metadata. Proposed summary, genres, city, years
   active, and same-vibe artist names and reasons may be edited before publish.
   The Wikipedia source remains read-only.
6. Exclude unwanted generated videos or replace a video with a preferred
   YouTube URL.
7. Select **Publish** to apply only the selected scopes.

Generating a preview calls the external content sources but does not modify the
published artist or video rows.

## Replacing A Video

Each proposed video shows its title, thumbnail, normal YouTube watch URL, and
derived embed URL.

To replace one:

1. Find the preferred video on YouTube and copy its URL.
2. Select **Replace** beside the unwanted proposed video.
3. Paste the URL and select **Preview replacement**.
4. Review the title and thumbnail returned by YouTube.
5. Publish the overall artist preview when the list is ready.

Standard watch URLs, `youtu.be` URLs, Shorts URLs, live URLs, embed URLs, and
bare 11-character video IDs are supported. Invalid, unavailable, and duplicate
videos are rejected.

A replacement is marked `is_manually_added = true` when published. Later
automatic refreshes must preserve it. Existing manual selections cannot be
removed by an automatic refresh, but an administrator may select **Replace
protected** and confirm the stronger warning. The replacement remains manual,
protected, and in the same display position. Canceling before publish leaves
the current artist page unchanged. Excluding a generated suggestion affects
only the current preview; a later refresh may suggest it again.

## Curated Data Protections

The first version intentionally uses a strict curated-content lock:

- Publishing any manual metadata or same-vibe edit marks the artist as curated.
- Artists with `is_curated = true` may preview metadata and same-vibe changes,
  but those scopes cannot be published.
- Video refreshes may be published for curated artists. Curated status does not
  prevent refreshing YouTube titles, thumbnails, view counts, durations, or
  other persisted video metadata.
- Metadata-only and same-vibe-only publishes preserve an incomplete artist
  page's build marker. Only a successful video publish marks it fully built.
- Existing videos with `is_manually_added = true` cannot be removed by an
  automatic refresh. They can only be replaced through the explicit protected
  replacement workflow.
- A video refresh that proposes zero videos cannot be published.
- A preview cannot publish if the artist or video rows changed after the
  preview was generated.
- The public lazy-build function treats curated artist rows as complete and
  never overwrites them, including when a build was already in progress before
  the artist became curated.

Publishing runs through `publish_admin_content_refresh`, which applies all
selected changes in one database transaction.

## Refresh History

Every generated preview creates one `admin_content_refreshes` row containing:

- The artist and selected scopes.
- The requesting admin.
- The complete before and proposed snapshots.
- The status: `preview`, `published`, `failed`, or `conflict`.
- The final published snapshot when successful.
- Error details when publishing fails.

This database table is the refresh history. Do not add individual refresh
events to this document.

## Intentional Limits

This is not a generalized admin dashboard. The initial version does not
include:

- Batch refreshes or scheduled refreshes.
- Bulk cache invalidation.
- Drag-and-drop video ordering.
- Interview or music-video persistence.
- A rollback UI.

Use the one-artist workflow enough to learn which review steps are consistently
safe before considering batching.

## Validation

Run the focused refresh-policy checks with:

```sh
npm test
```

They cover supported YouTube URL parsing, curated metadata locks, manual-video
preservation, empty and duplicate video rejection, and video-order
normalization. Build and lint should also pass before deployment:

```sh
npm run build
npm run lint
```
