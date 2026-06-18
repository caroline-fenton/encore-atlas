# Eval: claude-tag

Planning doc for an eval of the `claudeTag` function in `app/supabase/functions/build-artist-page/index.ts`.

## What we're evaluating

The `claudeTag` function (line 127) takes `(artistName, videoTitles, wikipediaExtract)` and calls Claude Haiku to return structured artist metadata:

```typescript
{
  tags: string[]           // genre labels
  blurb: string | null     // scene summary
  related_artists: string[] // names only
  artist_context: ArtistContext | null  // full structured object
}
```

The three checks we care about are:

1. **Output validity** — did the JSON parse? are all fields present, correctly typed, and within the expected cardinality?
2. **Genre accuracy** — do the returned genre labels match what we'd expect for a known artist?
3. **Related artists quality** — do the suggested related artists include expected names?

## Proposed structure

```
app/evals/
  claude-tag/
    run.ts          ← eval runner (Deno script, requires ANTHROPIC_API_KEY)
    fixtures.json   ← static inputs + expectations per artist
```

The runner calls the real Anthropic API. Inputs (video titles + Wikipedia extract) are frozen as static fixtures so we're not also testing YouTube/Wikipedia fetching.

## Check 1 — Validity (deterministic)

- `artist_context` is not null (i.e. JSON parse succeeded)
- `genre` array has 2–5 items
- `knownFor` array has 3–5 items
- `relatedArtists` has 8–12 entries, each with non-empty `name` and `reason`
- `sceneSummary` is a non-empty string
- each `reason` is ≤12 words (per the prompt guideline)

## Check 2 — Genre accuracy (fuzzy)

- Normalise both actual and expected genres (lowercase, strip punctuation)
- Pass if ≥50% of the expected tags appear in the output
- Loose thresholds to allow synonym variation (`"indie rock"` vs `"alternative rock"`)

## Check 3 — Related artists (fuzzy)

- Pass if ≥2 of the expected related artists appear in the output (case-insensitive)
- Guards against degenerate outputs (hallucinated names, same 12 artists for everyone)

## Fixture format

```json
{
  "artists": [
    {
      "name": "Radiohead",
      "videoTitles": [
        "Radiohead Live at Glastonbury 2017 Full Set",
        "..."
      ],
      "wikipediaExtract": "Radiohead are an English rock band...",
      "expected": {
        "genreContains": ["rock", "alternative"],
        "relatedArtistsInclude": ["Thom Yorke", "Portishead", "Björk"]
      }
    }
  ]
}
```

## Scoring

Report per-artist (`3/3 checks passed`) and a total (`24/30`) rather than binary pass/fail. This makes it useful for tracking regression across prompt changes.

## Golden dataset (to be assembled)

Target ~8–10 artists. Suggested mix:
- 2–3 very mainstream, clearly-genred artists (e.g. Radiohead, Beyoncé)
- 2–3 niche but well-documented acts
- 1 non-English language artist
- 1 genuinely obscure artist (to test graceful degradation with thin input)

**Next step before writing code:** pick the golden dataset and record static video titles + Wikipedia extracts per artist. Can be done by running the function once per artist and capturing the inputs, or hand-curating from memory.

## Design decisions

- **Live API, static inputs.** Run against real Claude (not mocks) so output quality is actually tested. Freeze inputs as fixtures to avoid YouTube/Wikipedia API calls in the eval.
- **Fuzzy, not exact.** Claude's outputs vary run to run. Every check uses tolerances.
- **No framework.** A standalone Deno script is sufficient — no test runner needed.
