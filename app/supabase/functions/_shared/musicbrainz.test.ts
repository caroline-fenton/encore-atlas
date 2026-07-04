import assert from "node:assert/strict"
import test from "node:test"
import {
  escapeLucene,
  pickCanonicalName,
  verifyArtistNames,
  type MusicBrainzArtist,
} from "./musicbrainz.ts"

test("pickCanonicalName matches exact names", () => {
  const candidates: MusicBrainzArtist[] = [{ name: "Radiohead" }]
  assert.equal(pickCanonicalName("Radiohead", candidates), "Radiohead")
})

test("pickCanonicalName canonicalizes spacing and casing", () => {
  const candidates: MusicBrainzArtist[] = [{ name: "Radiohead" }]
  assert.equal(pickCanonicalName("radio head", candidates), "Radiohead")
})

test("pickCanonicalName matches via aliases", () => {
  const candidates: MusicBrainzArtist[] = [
    { name: "Sigur Rós", aliases: [{ name: "Sigur Ros" }] },
  ]
  assert.equal(pickCanonicalName("Sigur Ros", candidates), "Sigur Rós")
})

test("pickCanonicalName returns null when nothing matches", () => {
  const candidates: MusicBrainzArtist[] = [
    { name: "Radiohead" },
    { name: "Portishead" },
  ]
  assert.equal(pickCanonicalName("The Velvet Underworld", candidates), null)
  assert.equal(pickCanonicalName("Anything", []), null)
})

test("pickCanonicalName prefers earlier (higher-scored) candidates", () => {
  const candidates: MusicBrainzArtist[] = [
    { name: "Nirvana" },
    { name: "Nirvana", "sort-name": "Nirvana (60s UK band)" },
  ]
  assert.equal(pickCanonicalName("Nirvana", candidates), "Nirvana")
})

test("escapeLucene escapes query syntax", () => {
  assert.equal(escapeLucene('AC/DC'), "AC\\/DC")
  assert.equal(escapeLucene('a"b'), 'a\\"b')
  assert.equal(escapeLucene("plain name"), "plain name")
})

test("verifyArtistNames maps verified, unknown, and errored lookups", async () => {
  const fakeFetch = ((url: string | URL | Request) => {
    const query = decodeURIComponent(String(url))
    if (query.includes("Portishead")) {
      return Promise.resolve(
        new Response(JSON.stringify({ artists: [{ name: "Portishead" }] }), {
          status: 200,
        }),
      )
    }
    if (query.includes("Fake")) {
      return Promise.resolve(
        new Response(JSON.stringify({ artists: [] }), { status: 200 }),
      )
    }
    return Promise.reject(new Error("network down"))
  }) as typeof fetch

  const results = await verifyArtistNames(
    ["Portishead", "Fake Band", "Unreachable"],
    fakeFetch,
  )

  assert.equal(results.get("Portishead"), "Portishead") // verified
  assert.equal(results.get("Fake Band"), null) // definitively absent → drop
  assert.equal(results.get("Unreachable"), "Unreachable") // fail open
})
