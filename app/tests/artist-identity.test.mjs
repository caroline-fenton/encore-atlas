import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Exercise the real services while replacing only the network client.
const calls = []
let lookup = { data: null, error: null }
let videos = { data: [], error: null }
const client = {
  rpc(name, args) {
    calls.push({ name, args })
    assert.equal(name, 'resolve_artist')
    return { maybeSingle: async () => lookup }
  },
  from(table) {
    assert.equal(table, 'artist_videos', 'Lookup must not insert artist rows')
    return {
      select: () => ({
        eq: (column, id) => {
          calls.push({ column, id })
          return { order: async () => videos }
        },
      }),
    }
  },
}
globalThis.__artistIdentityClient = client
const clientUrl = new URL('../src/services/supabase.ts', import.meta.url).href
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'https://esm.sh/@supabase/supabase-js@2.100.0') {
      return { url: specifier, shortCircuit: true }
    }
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(specifier, context.parentURL)
      if (!/\.[a-z]+$/i.test(url.pathname) && existsSync(fileURLToPath(url) + '.ts')) {
        return nextResolve(url.href + '.ts', context)
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url === 'https://esm.sh/@supabase/supabase-js@2.100.0') return {
      format: 'module', shortCircuit: true,
      source: 'export const createClient = () => globalThis.__artistIdentityClient',
    }
    if (url === clientUrl) return {
      format: 'module', shortCircuit: true,
      source: 'export const supabase = globalThis.__artistIdentityClient',
    }
    return nextLoad(url, context)
  },
})
const { getArtistByName } = await import('../src/services/artists.ts')
const { getCachedArtistPage } = await import('../src/services/artistPage.ts')
const artist = {
  id: 'canonical-radiohead', name: 'radiohead', last_refreshed_at: '2026-07-04',
  is_curated: false, video_types_synced: ['interview', 'music_video'],
}

test('spaced input resolves through the RPC and loads videos by canonical ID', async () => {
  calls.length = 0
  lookup = { data: artist, error: null }
  videos = { data: [{ id: 'row', youtube_video_id: 'video', video_type: 'concert' }], error: null }
  const page = await getCachedArtistPage('radio head')
  assert.deepEqual(calls[0], { name: 'resolve_artist', args: { p_name: 'radio head' } })
  assert.deepEqual(calls[1], { column: 'artist_id', id: artist.id })
  assert.equal(page.artist.name, 'radiohead')
  assert.equal(page.artist.id, artist.id)
  assert.equal(page.videos[0].youtube_video_id, 'video')
  assert.equal(page.was_cache_hit, true)
})

test('curated pages are cached even without a refresh timestamp', async () => {
  lookup = { data: { ...artist, last_refreshed_at: null, is_curated: true }, error: null }
  assert.ok(await getCachedArtistPage('Radiohead'))
})

test('incomplete and unknown artists do not masquerade as cached pages', async () => {
  lookup = { data: { ...artist, last_refreshed_at: null }, error: null }
  assert.equal(await getCachedArtistPage('radio head'), null)
  lookup = { data: null, error: null }
  assert.equal(await getArtistByName('unknown'), null)
  assert.equal(await getCachedArtistPage('unknown'), null)
})

test('lookup and video errors do not return successful empty pages', async () => {
  lookup = { data: null, error: { message: 'test lookup unavailable' } }
  assert.equal(await getArtistByName('radio head'), null)
  lookup = { data: artist, error: null }
  videos = { data: null, error: { message: 'test video unavailable' } }
  assert.equal(await getCachedArtistPage('radio head'), null)
})

let handler
globalThis.Deno = {
  env: { get: () => 'test-only' },
  serve: (callback) => { handler = callback },
}
await import('../supabase/functions/build-artist-page/index.ts')

test('builder returns the canonical cached page without discovery or writes', async () => {
  calls.length = 0
  lookup = { data: artist, error: null }
  videos = { data: [], error: null }
  const response = await handler(new Request('http://localhost/build', {
    method: 'POST', body: JSON.stringify({ artist_name: 'radio head' }),
  }))
  assert.equal(response.status, 200)
  const page = await response.json()
  assert.equal(page.artist.id, artist.id)
  assert.equal(page.artist.name, artist.name)
  assert.equal(page.was_cache_hit, true)
  assert.deepEqual(calls[0], { name: 'resolve_artist', args: { p_name: 'radio head' } })
})

test('builder stops on lookup failure rather than creating a duplicate', async () => {
  lookup = { data: null, error: { message: 'test lookup unavailable' } }
  const response = await handler(new Request('http://localhost/build', {
    method: 'POST', body: JSON.stringify({ artist_name: 'radio head' }),
  }))
  assert.equal(response.status, 500)
})
