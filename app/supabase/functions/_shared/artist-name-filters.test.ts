import assert from "node:assert/strict"
import test from "node:test"
import {
  filterRelatedArtists,
  hasMixedScript,
  isSameArtistName,
  normalizeArtistName,
} from "../../../src/utils/artistNameFilters.ts"

test("hasMixedScript rejects Latin mixed with Arabic", () => {
  assert.equal(hasMixedScript("راديو head"), true)
})

test("hasMixedScript rejects Latin mixed with Cyrillic", () => {
  assert.equal(hasMixedScript("Кино Band"), true)
})

test("hasMixedScript allows single-script names", () => {
  assert.equal(hasMixedScript("Radiohead"), false)
  assert.equal(hasMixedScript("Sigur Rós"), false)
  assert.equal(hasMixedScript("Мумий Тролль"), false)
  assert.equal(hasMixedScript("فيروز"), false)
})

test("hasMixedScript treats CJK scripts as one group", () => {
  // Kanji + Katakana is normal for Japanese artist names
  assert.equal(hasMixedScript("宇多田ヒカル"), false)
})

test("hasMixedScript ignores digits and punctuation", () => {
  assert.equal(hasMixedScript("blink-182"), false)
  assert.equal(hasMixedScript("!!! (Chk Chk Chk)"), false)
})

test("normalizeArtistName collapses case, diacritics, 'the', punctuation", () => {
  assert.equal(normalizeArtistName("The Beach Boys"), "beachboys")
  assert.equal(normalizeArtistName("beach-boys"), "beachboys")
  assert.equal(normalizeArtistName("Béach Bóys"), "beachboys")
  assert.equal(normalizeArtistName("Radio Head"), "radiohead")
})

test("isSameArtistName matches across formatting variants", () => {
  assert.equal(isSameArtistName("The Beatles", "beatles"), true)
  assert.equal(isSameArtistName("Radiohead", "Radio Head"), true)
  assert.equal(isSameArtistName("Radiohead", "Portishead"), false)
})

test("isSameArtistName never matches empty names", () => {
  assert.equal(isSameArtistName("", ""), false)
  assert.equal(isSameArtistName("...", "!!!"), false)
})

test("filterRelatedArtists drops self, mixed-script, dupes, empties", () => {
  const result = filterRelatedArtists("Radiohead", [
    { name: "Portishead", reason: "trip-hop adjacency" },
    { name: "The Radiohead", reason: "self reference variant" },
    { name: "راديو head", reason: "mixed script" },
    { name: "portishead", reason: "duplicate" },
    { name: "  ", reason: "empty" },
    { name: "Massive Attack", reason: "Bristol scene" },
  ])

  assert.deepEqual(
    result.map((r) => r.name),
    ["Portishead", "Massive Attack"],
  )
})

test("filterRelatedArtists skips self-check when subject is empty", () => {
  const result = filterRelatedArtists("", [
    { name: "Radiohead", reason: "" },
  ])
  assert.equal(result.length, 1)
})
