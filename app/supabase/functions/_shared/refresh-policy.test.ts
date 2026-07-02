import assert from "node:assert/strict"
import test from "node:test"
import {
  applyManualArtistEdits,
  concertVideos,
  editableVideos,
  mergeManualVideos,
  mergeTargetedRefreshVideos,
  normalizeEditableVideoOrder,
  normalizeVideoOrder,
  parseYouTubeVideoId,
  validatePublishRequest,
  videoKey,
  type RefreshVideo,
} from "./refresh-policy.ts"

function video(id: string, manual = false, video_type = "concert"): RefreshVideo {
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
    video_type,
    channel_title: null,
  }
}

test("parses supported YouTube URL formats", () => {
  assert.equal(parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(parseYouTubeVideoId("https://youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(parseYouTubeVideoId("not a video"), null)
})

test("allows admins to revise curated metadata", () => {
  assert.deepEqual(validatePublishRequest({
    scopes: ["metadata"],
    isCurated: true,
    existingVideos: [],
    proposedVideos: [],
    manualVideoReplacements: [],
    manualMetadataEdit: true,
  }), [])
})

test("allows all-scope curated previews when metadata was not edited", () => {
  assert.deepEqual(validatePublishRequest({
    scopes: ["metadata", "same_vibe", "videos"],
    isCurated: true,
    existingVideos: [],
    proposedVideos: [video("generated01")],
    manualVideoReplacements: [],
    manualMetadataEdit: false,
  }), [])
})

test("does not validate incomplete metadata when only videos changed", () => {
  const incompleteArtist = {
    tags: [],
    blurb: null,
    wikipedia_url: null,
    related_artists: [],
    artist_context: {
      genre: [],
      city: null,
      yearsActive: null,
      sceneSummary: "",
      relatedArtists: [],
    },
  }

  const result = applyManualArtistEdits(
    incompleteArtist,
    structuredClone(incompleteArtist),
    ["metadata", "same_vibe", "videos"],
  )

  assert.equal(result.manualMetadataEdit, false)
  assert.deepEqual(result.errors, [])
})

test("manual metadata edits are normalized and detected", () => {
  const generated = {
    tags: ["rock"],
    blurb: "Generated summary",
    wikipedia_url: null,
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
  submitted.wikipedia_url = "  https://en.wikipedia.org/wiki/Example_artist "
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
  assert.equal(result.artist.wikipedia_url, "https://en.wikipedia.org/wiki/Example_artist")
  assert.equal(result.artist.artist_context?.sceneSummary, "Revised summary.")
  assert.deepEqual(result.artist.related_artists, ["New Peer"])
})

test("epic artist template edits are normalized with metadata", () => {
  const generated = {
    tags: ["rock"],
    blurb: "Summary",
    wikipedia_url: null,
    related_artists: ["Peer"],
    artist_context: {
      genre: ["rock"],
      city: null,
      yearsActive: null,
      sceneSummary: "Summary",
      relatedArtists: [{ name: "Peer", reason: "" }],
      epicTemplate: {
        enabled: false,
        heroImageUrl: null,
        tagline: null,
        featuredEra: null,
        featuredLiveMoment: null,
        introCopy: null,
      },
    },
  }
  const submitted = structuredClone(generated)
  submitted.artist_context.epicTemplate = {
    enabled: true,
    heroImageUrl: " https://example.com/hero.jpg ",
    tagline: "  A cathedral of feedback ",
    featuredEra: "  1977-1978 ",
    featuredLiveMoment: "",
    introCopy: "  Start with the live set. ",
  }

  const result = applyManualArtistEdits(generated, submitted, ["metadata"])

  assert.equal(result.manualMetadataEdit, true)
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.artist.artist_context?.epicTemplate, {
    enabled: true,
    heroImageUrl: "https://example.com/hero.jpg",
    tagline: "A cathedral of feedback",
    featuredEra: "1977-1978",
    featuredLiveMoment: null,
    introCopy: "Start with the live set.",
  })
})

test("manual metadata edits cannot clear required generated content", () => {
  const artist = {
    tags: ["rock"],
    blurb: "Summary",
    wikipedia_url: null,
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
    wikipedia_url: "https://en.wikipedia.org/wiki/Example_artist",
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
  const manual = video("manualvideo", true)
  const errors = validatePublishRequest({
    scopes: ["videos"],
    isCurated: false,
    existingVideos: [manual],
    proposedVideos: [video("generated01")],
    manualVideoReplacements: [],
  })

  assert.ok(errors.includes("Manually added videos must be preserved or explicitly replaced."))
})

test("allows an explicitly confirmed manual video removal", () => {
  const manual = video("manualvideo", true)
  assert.deepEqual(validatePublishRequest({
    scopes: ["videos"],
    isCurated: false,
    existingVideos: [manual],
    proposedVideos: [video("generated01")],
    manualVideoRemovals: [videoKey(manual)],
    manualVideoReplacements: [],
  }), [])
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
    manualVideoReplacements: [videoKey(existing)],
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
    manualVideoReplacements: [videoKey(existing)],
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
    manualVideoReplacements: ["concert:manualvideo"],
  }), [])
})

test("editable video helpers include all artist-page video categories", () => {
  const items = [
    { ...video("music", false, "music_video"), display_order: 2 },
    { ...video("concert", false, "concert"), display_order: 1 },
    { ...video("interview", false, "interview"), display_order: 0 },
  ]

  assert.deepEqual(
    editableVideos(items).map((item) => item.youtube_video_id),
    ["concert", "interview", "music"],
  )
  assert.deepEqual(
    concertVideos(items).map((item) => item.youtube_video_id),
    ["concert"],
  )
})

test("video duplicate checks reject repeated YouTube IDs across sections", () => {
  assert.ok(validatePublishRequest({
    scopes: ["videos"],
    isCurated: false,
    existingVideos: [],
    proposedVideos: [
      video("samevideo01", false, "concert"),
      video("samevideo01", false, "interview"),
    ],
    manualVideoReplacements: [],
  }).includes("The proposed video list contains duplicates."))
})

test("normalizes display order independently for each video type", () => {
  const normalized = normalizeEditableVideoOrder([
    video("concert-a", false, "concert"),
    video("interview-a", false, "interview"),
    video("concert-b", false, "concert"),
    video("music-a", false, "music_video"),
  ])

  assert.deepEqual(
    normalized.map((item) => `${item.video_type}:${item.display_order}`),
    ["concert:0", "concert:1", "interview:0", "music_video:0"],
  )
})

test("manual video merge preserves protection while refreshing YouTube metadata", () => {
  const staleManual = {
    ...video("manualvideo", true),
    title: "Old title",
    thumbnail_url: "old-thumbnail",
    view_count: 10,
    display_order: 1,
  }
  const freshGenerated = {
    ...video("manualvideo"),
    title: "Fresh title",
    thumbnail_url: "fresh-thumbnail",
    view_count: 20,
    channel_title: "Fresh channel",
  }

  const merged = mergeManualVideos(
    [video("generated01"), freshGenerated],
    [staleManual],
  )
  const refreshedManual = merged.find(
    (item) => item.youtube_video_id === "manualvideo",
  )

  assert.equal(refreshedManual?.is_manually_added, true)
  assert.equal(refreshedManual?.display_order, 1)
  assert.equal(refreshedManual?.title, "Fresh title")
  assert.equal(refreshedManual?.thumbnail_url, "fresh-thumbnail")
  assert.equal(refreshedManual?.view_count, 20)
  assert.equal(refreshedManual?.channel_title, "Fresh channel")
})

test("manual video merge preserves protected secondary videos", () => {
  const manualInterview = {
    ...video("interview01", true, "interview"),
    display_order: 0,
  }
  const generatedInterview = video("interview02", false, "interview")
  const generatedMusicVideo = video("musicvideo1", false, "music_video")

  const merged = mergeManualVideos(
    [generatedInterview, generatedMusicVideo],
    [manualInterview],
  )

  assert.deepEqual(
    merged.map((item) => `${item.video_type}:${item.youtube_video_id}:${item.display_order}:${item.is_manually_added}`),
    [
      "interview:interview01:0:true",
      "interview:interview02:1:false",
      "music_video:musicvideo1:0:false",
    ],
  )
})

test("targeted refresh preserves omitted video sections", () => {
  const existingConcert = { ...video("oldconcert", false, "concert"), display_order: 0 }
  const existingInterview = { ...video("oldinterview", false, "interview"), display_order: 0 }
  const newConcert = { ...video("newconcert", false, "concert"), display_order: 0 }

  const merged = mergeTargetedRefreshVideos(
    [newConcert],
    [existingConcert, existingInterview],
    ["concert"],
  )

  assert.deepEqual(
    merged.map((item) => `${item.video_type}:${item.youtube_video_id}`),
    ["concert:newconcert", "interview:oldinterview"],
  )
})

test("live refresh policy orders concert videos and leaves secondary categories out of scope", () => {
  const interview = { ...video("interview01", true), video_type: "interview" }
  const laterInsertedManual = { ...video("manual0001", true), display_order: 0 }
  const generated = { ...video("concert001"), display_order: 1 }
  assert.deepEqual(concertVideos([generated, interview, laterInsertedManual]), [
    laterInsertedManual,
    generated,
  ])
})
