# Encore Atlas — Strategic Analysis
## YouTube API, Discovery Layer, and Value Expansion

---

## 1. YouTube API Limitations — What's Actually Happening

### The quota math is more fragile than it looks

The YouTube Data API v3 gives 10,000 units per day on the default quota. Here's what Encore Atlas spends per artist search:

| Action | Cost | Notes |
|---|---|---|
| Search (Live Shows) | 100 units | `searchVideos()` call |
| Search (Music Videos) | 100 units | separate call per content type |
| Search (Interviews) | 100 units | separate call per content type |
| Video detail (batch, ~15 IDs) | ~15 units | cheap, one batch call |
| Duration fallback retry | 100 units | if live search returns < 3 results |

**Estimated cost per artist view: ~315–415 units.** That means the app exhausts its daily quota after roughly **24–31 unique artists**, with zero cross-user cache sharing. After that, every user sees empty content until midnight Pacific.

### The structural problem: the API key is in the browser

Because `VITE_YOUTUBE_API_KEY` is a client-side environment variable, it's baked into the JavaScript bundle and visible to anyone who opens DevTools. This means:

- All users share a single quota pool
- One user refreshing obsessively can exhaust it for everyone
- There is no per-user rate limiting
- The cache in `cache.ts` uses `localStorage`, which is siloed per device and per browser — two users searching for the same artist each burn 300+ units independently

### What's working well despite this

The existing caching is well-designed for what it is: a 7-day TTL, per-session prevention of duplicate calls, graceful quota error handling with a `QuotaWarning` component. The `isQuotaExhausted()` check stores the quota-exceeded state in localStorage until midnight PT, so the app at least fails gracefully for the same user rather than hammering the API.

### Near-term options, roughly ordered by effort

**Option A: Server-side proxy (highest leverage)**
Route all YouTube API calls through a Supabase Edge Function or a lightweight API route. Store responses in Postgres or Redis with the same TTL logic. One cache entry benefits every user. This is the only fix that actually solves the cross-user quota problem. It's also where the Claude API for artist tagging has to live anyway — so this server layer is needed regardless.

**Option B: Lean harder into curated content**
`curatedVideos.ts` already has the right structure — a list of artists with pre-selected YouTube video IDs. Serving known IDs to `getVideoDetails()` (1 unit per video) instead of using `searchVideos()` (100 units per call) would reduce quota consumption by ~99% for curated artists. The file currently has placeholder IDs. Populating it for the initial artist pool (16 artists in `suggestedArtists.ts`) would make the core experience essentially quota-free.

**Option C: YouTube Channel RSS feeds**
The `artists` table already has a `youtube_channel_id` column — it's just never populated. YouTube publishes free RSS feeds for every channel (`https://www.youtube.com/feeds/videos.xml?channel_id=...`). These require no API key and return the 15 most recent uploads for a channel. This could replace search entirely for known artists, at zero quota cost. The gap is that someone has to populate `youtube_channel_id` for each artist in the database.

**Option D: Request a quota increase from Google**
Google allows quota increase requests through the API Console. Requires a completed OAuth consent screen and a description of your use case. Takes days to weeks. Not a near-term fix, but worth doing eventually regardless of other choices.

---

## 2. Value Beyond YouTube Search

YouTube is the right starting point — it has the most live concert footage of any platform — but it's a fragile single point of failure and a poor content metadata layer. Here's where significant value can be added without touching YouTube at all.

### Setlist.fm — the highest-priority addition

Setlist.fm has a free, well-documented API and indexes millions of concerts with actual song-by-song setlists. This is extraordinarily well-aligned with Encore Atlas's core premise of reliving shows. A few things it enables:

- Search for every show an artist has played, by year, city, or venue
- Surface the actual setlist from a specific concert (not just the video)
- Connect users to the show they actually attended
- Provide temporal context ("the 1987 Smiths UK tour") that enriches video watching

This is the kind of data that makes Encore Atlas feel like a music companion rather than a video search engine. It's also zero-cost to add.

### Archive.org / Live Music Archive

The Internet Archive hosts thousands of legally shareable live recordings — particularly strong for Grateful Dead, Phish, and the broader jam band world, but also punk, folk, and various genres with strong taper communities. These recordings are free, require no API key, and would let Encore Atlas serve actual audio for select artists without touching YouTube at all. For the nostalgia use case, there's something powerful about hearing a 1978 recording rather than a 2019 YouTube upload of a 1978 recording.

### Last.fm

Last.fm's free API returns similar artists, artist tags, listener counts, and play counts. This is a cleaner and cheaper source for the recommendation layer than running every artist through Claude for tagging. Tags like "post-punk," "shoegaze," "80s alternative" already exist in Last.fm for essentially every major artist. Using Last.fm tags as the primary recommendation signal would let Encore Atlas skip the Claude tagging pipeline entirely for cold-start recommendations, reserving Claude for nuanced vibe matching where Last.fm falls short.

### MusicBrainz

MusicBrainz is a free, open music encyclopedia with artist relationships, band member history, and release timelines. No API key required. It's especially useful for building the "scene" and "era" dimensions of discovery — you can query which artists were associated with a specific scene, city, or decade, and build editorial pages around those clusters without manual curation.

### Editorial / Claude-generated context

Once a server layer exists (Edge Functions or similar), Claude can generate short contextual essays for each artist — not just tags, but things like "Why this artist's live performances matter," "The three shows that defined their career," or "The era you should start with." This is the kind of curation that feels human and editorially intentional, which is what differentiates Encore Atlas from a raw search result. It's cheap to generate, cacheable, and deeply aligned with the product's emotional tone.

---

## 3. Discovery Layer Presentations

The current experience is entirely search-initiated. Users must already know who they want to find. This limits the product to people who already have an artist in mind, which cuts out ambient discovery and returning-user engagement.

Here are four distinct discovery modes worth considering, roughly from lowest to highest implementation complexity.

### The Editorial Frame ("The Moment")

A weekly or daily editorially-selected artist or concert moment, hand-curated or Claude-assisted, featured at the top of the landing page before the search bar. Think: "This week: Joy Division at the Factory, 1979." One artist, one context, one video — not algorithmic, not personalized, just a confident editorial statement. This requires essentially no new infrastructure (just a CMS or a static config file) and immediately gives the app an ambient, magazine-like quality. It also fills the gap for users who arrive without an artist in mind.

### Timeline View

For a given artist, display their concert history as a scrollable timeline — decades across the top, individual shows or eras in rows. Populated by Setlist.fm data with YouTube videos attached where they exist. This transforms the current "list of videos" into a richer exploration of an artist's arc over time. A fan who saw Radiohead in 2001 could find and watch shows from that specific tour period. This is a medium-lift feature that requires Setlist.fm integration but would be genuinely differentiated.

### Era / Scene Explorer

A browse mode not organized by artist but by cultural moment: "Post-punk Manchester," "NYC No Wave 1978–1982," "Britpop 1994–1997," "LA hardcore." Each scene is a cluster of related artists with editorial framing and curated entry videos. Users explore laterally rather than searching vertically. MusicBrainz and Last.fm provide the underlying artist relationships; editorial framing gives it character. This is the highest-lift option but would make Encore Atlas feel more like a music cultural guide than a search tool.

### Mood / Vibe Navigation

A set of entry points defined by emotional context rather than genre or era: "Ecstatic and euphoric," "Intimate and raw," "Cinematic and sweeping," "Chaotic and urgent." Each mood maps to a curated playlist of live moments. This is low-data (works with purely editorial curation) and maps well to the "evening, nostalgic, headphone-based" use context noted in the constraints document. It doesn't require behavioral data or recommendations to be meaningful.

---

## 4. Architecture Assumptions to Stress-Test with Codex

The `architecture.mermaid` file captures these visually. In plain terms, the ten most important assumptions baked into the current design are:

**1. The quota assumption** — The entire system assumes 10,000 units/day is enough. It isn't, at any real scale. The proxy layer needs to come before the "For You" tab, not after.

**2. The cross-user cache gap** — localStorage helps the same user on the same device avoid redundant calls. It doesn't help when 50 people search for Radiohead in the same day. This needs to be a shared cache.

**3. The server layer chicken-and-egg** — Phase 4 (Claude API for artist tagging) requires a server. There is no server today. Supabase Edge Functions are the likely answer, but they haven't been created. This blocks the entire recommendation roadmap.

**4. The `youtube_channel_id` ghost column** — This field exists in the `artists` schema and would unlock free RSS-based content fetching for known artists. But it's never set anywhere. It's architectural intent without implementation.

**5. The `watch_history` gap** — The schema exists, the types are defined, but the video player doesn't write to this table. Phases 5 and beyond (personalization) are entirely blocked by this missing wire.

**6. The cold-start assumption for collaborative filtering** — The roadmap assumes collaborative filtering improves "as users generate data." But what does that actually require? A reasonable floor is probably 500–1,000 search events with meaningful artist selection before co-occurrence signals become useful. Below that, the recommendations will feel arbitrary. There's no fallback strategy defined for the period between zero data and meaningful data.

**7. The curated content gap** — `curatedVideos.ts` is the right idea: a hand-selected set of video IDs that bypasses search and quota entirely. But it has placeholder IDs for every entry. Until this is populated, the curated path is inert.

**8. The Supabase free tier reliability assumption** — Free Supabase projects pause after 7 days of inactivity. For a product in early development where usage may be intermittent, this could cause auth and persistence to silently fail. Worth upgrading or setting up a keep-alive ping before the backend becomes load-bearing.

**9. The discovery entry point assumption** — The entire experience assumes users arrive with an artist in mind. The `suggestedArtists.ts` weekly rotation is a gesture toward ambient discovery, but it surfaces 4 chip buttons below a search bar — it's easy to miss. There's no editorial frame, no "here's where to start," no reason for a new user to feel oriented before they type.

**10. The Vercel Analytics assumption** — The app uses Vercel Analytics for page views, but there are no custom events: no "user clicked a recommended video," no "user played a video past 30 seconds," no "user loaded more results." The success metrics in the PRD (2%+ recommended video click rate, longer sessions) can't be measured with the current instrumentation.
