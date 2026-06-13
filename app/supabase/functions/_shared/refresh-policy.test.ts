import assert from "node:assert/strict"
import test from "node:test"
import {
  applyManualArtistEdits,
  concertVideos,
  normalizeVideoOrder,
  parseYouTubeVideoId,
  validatePublishRequest,
  type RefreshVideo,
} from "./refresh-policy.ts"

function video(id: string, manual = false): RefreshVideo {
  return {
    youtube_video_id: id,
    title: id,
    description: null,
    thumbnail_url: null,
    published_at: null,
    view_count: null,
    duration: null,
    search_query: "test",
    is_manually_added: manual,
    display_order: 9,
    video_type: "concert",
    channel_title: null,
  }
}

test("parses supported YouTube URL formats", () => {
  assert.equal(parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(parseYouTubeVideoId("https://youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(parseYouTubeVideoId("not a video"), null)
})

test("blocks curated metadata publishing", () => {
  const errors = validatePublishRequest({
    scopes: ["metadata"],
    isCurated: true,
    existingVideos: [],
    proposedVideos: [],
    manualVideoReplacements: [],
  })

  assert.deepEqual(errors, [
    "Curated artist metadata and same-vibe artists are protected.",
  ])
})

test("manual metadata edits are normalized and detected", () => {
  const generated = {
    tags: ["rock"],
    blurb: "Generated summary",
    related_artists: ["Peer"],
    artist_context: {
      genre: ["rock"],
      city: "Boston",
      yearsActive: "1990-present",
      sceneSummary: "Generated summary",
      relatedArtists: [{ name: "Peer", reason: "Similar sound" }],
    },
  }
  const submitted = structuredClone(generated)
  submitted.tags = [" post-rock ", "post-rock"]
  submitted.blurb = "  Revised summary. "
  submitted.artist_context.city = "  Chicago "
  submitted.artist_context.relatedArtists = [{
    name: " New Peer ",
    reason: " Shared scene ",
  }]

  const result = applyManualArtistEdits(generated, submitted, [
    "metadata",
    "same_vibe",
  ])

  assert.equal(result.manualMetadataEdit, true)
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.artist.tags, ["post-rock"])
  assert.equal(result.artist.blurb, "Revised summary.")
  assert.equal(result.artist.artist_context?.sceneSummary, "Revised summary.")
  assert.deepEqual(result.artist.related_artists, ["New Peer"])
})

test("manual metadata edits cannot clear required generated content", () => {
  const artist = {
    tags: ["rock"],
    blurb: "Summary",
    related_artists: ["Peer"],
    artist_context: {
      genre: ["rock"],
      city: null,
      yearsActive: null,
      sceneSummary: "Summary",
      relatedArtists: [{ name: "Peer", reason: "" }],
    },
  }

  const result = applyManualArtistEdits(
    artist,
    { ...artist, tags: [], blurb: "", related_artists: [] },
    ["metadata"],
  )

  assert.ok(result.errors.includes("Artist metadata requires at least one genre."))
  assert.ok(result.errors.includes("Artist metadata requires a summary."))
})

test("an untouched generated metadata preview is not marked manual", () => {
  const artist = {
    tags: ["rock"],
    blurb: "Summary",
    related_artists: ["Peer"],
    artist_context: {
      genre: ["rock"],
      city: null,
      yearsActive: null,
      sceneSummary: "Summary",
      relatedArtists: [{ name: "Peer", reason: "Similar sound" }],
    },
  }

  const result = applyManualArtistEdits(
    artist,
    structuredClone(artist),
    ["metadata", "same_vibe"],
  )

  assert.equal(result.manualMetadataEdit, false)
})

test("requires manually added videos to survive a refresh", () => {
  const errors = validatePublishRequest({
    scopes: ["videos"],
    isCurated: false,
    existingVideos: [video("manualvideo", true)],
    proposedVideos: [video("generated01")],
    manualVideoReplacements: [],
  })

  assert.ok(errors.includes("Manually added videos must be preserved or explicitly replaced."))
})

test("allows an explicitly confirmed manual video replacement", () => {
  const existing = video("manualvideo", true)
  existing.display_order = 0
  const replacement = video("replacement", true)
  replacement.display_order = 0

  assert.deepEqual(validatePublishRequest({
    scopes: ["videos"],
    isCurated: false,
    existingVideos: [existing],
    proposedVideos: [replacement],
    manualVideoReplacements: ["manualvideo"],
  }), [])
})

test("rejects a manual replacement without a protected successor", () => {
  const existing = video("manualvideo", true)
  existing.display_order = 0

  const errors = validatePublishRequest({
    scopes: ["videos"],
    isCurated: false,
    existingVideos: [existing],
    proposedVideos: [video("replacement")],
    manualVideoReplacements: ["manualvideo"],
  })

  assert.ok(errors.includes(
    "A protected manual video replacement must remain manual and keep its position.",
  ))
})

test("blocks empty and duplicate video refreshes", () => {
  assert.ok(validatePublishRequest({
    scopes: ["videos"],
    isCurated: false,
    existingVideos: [],
    proposedVideos: [],
    manualVideoReplacements: [],
  }).includes("A video refresh cannot publish an empty video list."))

  assert.ok(validatePublishRequest({
    scopes: ["videos"],
    isCurated: false,
    existingVideos: [],
    proposedVideos: [video("duplicate01"), video("duplicate01")],
    manualVideoReplacements: [],
  }).includes("The proposed video list contains duplicates."))
})

test("normalizes display order after preview edits", () => {
  assert.deepEqual(
    normalizeVideoOrder([video("firstvideo1"), video("secondvideo")])
      .map((item) => item.display_order),
    [0, 1],
  )
})

test("normalization preserves a protected replacement position after an earlier exclusion", () => {
  const beforeReplacement = video("generated01")
  beforeReplacement.display_order = 0
  const replacement = video("replacement", true)
  replacement.display_order = 2
  const afterReplacement = video("generated03")
  afterReplacement.display_order = 3

  const normalized = normalizeVideoOrder(
    [beforeReplacement, replacement, afterReplacement],
    [2],
  )

  assert.deepEqual(
    normalized.map((item) => item.display_order),
    [0, 2, 3],
  )
  assert.deepEqual(validatePublishRequest({
    scopes: ["videos"],
    isCurated: false,
    existingVideos: [{ ...video("manualvideo", true), display_order: 2 }],
    proposedVideos: normalized,
    manualVideoReplacements: ["manualvideo"],
  }), [])
})

test("live refresh policy leaves secondary video categories out of scope", () => {
  const interview = { ...video("interview01", true), video_type: "interview" }
  assert.deepEqual(concertVideos([video("concert001"), interview]), [
    video("concert001"),
  ])
})
