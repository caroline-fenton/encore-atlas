import assert from "node:assert/strict"
import test from "node:test"
import {
  escapeLucene,
  MAX_LOOKUPS,
  pickCanonicalName,
  verifyArtistNames,
  verifySubjectArtist,
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

test("pickCanonicalName matches punctuation-only names raw", () => {
  // "!!!" normalizes to the empty string, so matching falls back to a raw
  // case-insensitive comparison instead of rejecting outright.
  const candidates: MusicBrainzArtist[] = [
    { name: "!!!", aliases: [{ name: "Chk Chk Chk" }] },
  ]
  assert.equal(pickCanonicalName("!!!", candidates), "!!!")
  assert.equal(pickCanonicalName("!!! ", candidates), "!!!")

  // Raw matching is exact — different punctuation is not the same artist.
  assert.equal(pickCanonicalName("!!?", candidates), null)
  // Whitespace-only queries still match nothing.
  assert.equal(pickCanonicalName("   ", candidates), null)
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
    0,
  )

  assert.equal(results.get("Portishead"), "Portishead") // verified
  assert.equal(results.get("Fake Band"), null) // definitively absent → drop
  assert.equal(results.get("Unreachable"), "Unreachable") // fail open
})

test("verifySubjectArtist verifies a known artist with its canonical name", async () => {
  const fakeFetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ artists: [{ name: "Radiohead" }] }), {
        status: 200,
      }),
    )) as typeof fetch

  assert.deepEqual(await verifySubjectArtist("radio head", fakeFetch), {
    status: "verified",
    canonicalName: "Radiohead",
  })
})

test("verifySubjectArtist verifies punctuation-only artists like !!!", async () => {
  const fakeFetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ artists: [{ name: "!!!" }] }), {
        status: 200,
      }),
    )) as typeof fetch

  assert.deepEqual(await verifySubjectArtist("!!!", fakeFetch), {
    status: "verified",
    canonicalName: "!!!",
  })
})

test("verifySubjectArtist reports a definitive MusicBrainz miss", async () => {
  const fakeFetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ artists: [] }), { status: 200 }),
    )) as typeof fetch

  assert.deepEqual(await verifySubjectArtist("The Velvet Underworld", fakeFetch), {
    status: "not_found",
  })
})

test("verifySubjectArtist reports transport failures as unavailable", async () => {
  const networkDown = (() =>
    Promise.reject(new Error("network down"))) as typeof fetch
  assert.deepEqual(await verifySubjectArtist("Radiohead", networkDown), {
    status: "unavailable",
  })

  const serverError = (() =>
    Promise.resolve(new Response("oops", { status: 503 }))) as typeof fetch
  assert.deepEqual(await verifySubjectArtist("Radiohead", serverError), {
    status: "unavailable",
  })
})

test("verifyArtistNames drops names beyond the lookup cap", async () => {
  const fakeFetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ artists: [] }), { status: 200 }),
    )) as typeof fetch

  const names = Array.from({ length: MAX_LOOKUPS + 2 }, (_, i) => `Band ${i}`)
  const results = await verifyArtistNames(names, fakeFetch, 0)

  // Everything gets an entry, but nothing past the cap sneaks through
  // unverified.
  assert.equal(results.size, names.length)
  assert.equal(results.get(`Band ${MAX_LOOKUPS}`), null)
  assert.equal(results.get(`Band ${MAX_LOOKUPS + 1}`), null)
})
