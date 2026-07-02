# Epic Artist Template

The Epic Artist template is a reusable Artist page treatment controlled from the Admin Content Refresh workflow. It is not hardcoded to a specific artist.

## Enable for an Artist

1. Open `/admin/content-refresh`.
2. Search for and select the artist.
3. In Metadata Preview, edit the Epic template section.
4. Check `Enable Epic Artist template`.
5. Optionally add:
   - Hero/background image URL
   - Tagline
   - Featured era
   - Featured live moment
   - Curated intro copy
6. Publish the preview.

Publishing Epic template edits marks the artist as curated, so automated public rebuilds will not overwrite the manual metadata.

## Image URLs

Upload curated images to Supabase Storage or another approved host, then paste the public image URL into the admin field. Avoid album art, logos, posters, or photos unless the project has permission to use them.

If no hero image URL is set, the Epic page falls back in this order:

1. Existing artist bio image
2. Featured YouTube video thumbnail
3. Designed non-image background

## Data Shape

Epic settings are stored on `artists.artist_context.epicTemplate`:

```json
{
  "enabled": true,
  "heroImageUrl": "https://...",
  "tagline": "A short editorial line",
  "featuredEra": "1977-1978",
  "featuredLiveMoment": "Winterland / late-era live fire",
  "introCopy": "Curated intro copy for the hero."
}
```
