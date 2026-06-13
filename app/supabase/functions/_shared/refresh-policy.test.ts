import assert from "node:assert/strict"
import test from "node:test"
import {
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

test("live refresh policy leaves secondary video categories out of scope", () => {
  const interview = { ...video("interview01", true), video_type: "interview" }
  assert.deepEqual(concertVideos([video("concert001"), interview]), [
    video("concert001"),
  ])
})
