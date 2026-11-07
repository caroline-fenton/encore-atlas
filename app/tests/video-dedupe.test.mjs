import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

// Run the actual Edge Function handler with network boundaries replaced.
// SQL behavior and concurrency are tested separately in real Postgres.
const rpcCalls = []
let readError = null
let interviewMode = 'overlap'
let releaseInterview
let secondaryStarted = []
const persisted = [
  { id: 'stored-1', youtube_video_id: 'overlap', video_type: 'concert', title: 'stored concert', display_order: 0 },
  { id: 'manual-1', youtube_video_id: 'manual', video_type: 'interview', title: 'manual selection', display_order: 7 },
]
const client = {
  rpc(name, args) {
    if (name === 'resolve_artist') return { maybeSingle: async () => ({ data: null, error: null }) }
    assert.equal(name, 'upsert_public_build_videos')
    rpcCalls.push(args)
    return Promise.resolve({ error: null })
  },
  from(table) {
    if (table === 'artists') {
      const result = { data: [{ id: 'artist' }], error: null }
      const query = {
        eq: () => query,
        select: () => query,
        single: async () => ({ data: { id: 'artist' }, error: null }),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      }
      return { insert: () => query, update: () => query }
    }
    assert.equal(table, 'artist_videos')
    return { select: () => ({ eq: () => ({ order: async () => ({ data: persisted, error: readError }) }) }) }
  },
}
globalThis.__videoDedupeClient = client
const mocks = new Map([
  ['https://esm.sh/@supabase/supabase-js@2.100.0', 'export const createClient = () => globalThis.__videoDedupeClient'],
  [new URL('../src/utils/wikipedia.ts', import.meta.url).href, 'export const fetchWikipediaSummary = async () => null'],
  [new URL('../supabase/functions/_shared/musicbrainz.ts', import.meta.url).href,
    'export const MAX_LOOKUPS = 12; export const verifySubjectArtist = async () => ({status: "found"}); export const verifyArtistNames = async () => new Map()'],
])
registerHooks({
  resolve(specifier, context, next) {
    if (mocks.has(specifier)) return { url: specifier, shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (mocks.has(url)) return { format: 'module', shortCircuit: true, source: mocks.get(url) }
    return next(url, context)
  },
})
globalThis.fetch = async (url) => {
  const parsed = new URL(url)
  if (parsed.hostname === 'api.anthropic.com') return Response.json({ content: [{ text: '{}' }] })
  assert.equal(parsed.hostname, 'www.googleapis.com')
  if (parsed.pathname.endsWith('/videos')) return Response.json({ items: [] })
  assert.ok(parsed.pathname.endsWith('/search'))
  const query = parsed.searchParams.get('q')
  if (interviewMode === 'concurrency' && !query.endsWith('full set')) {
    secondaryStarted.push(query)
    if (query.endsWith('interview')) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Music-video search waited for interview completion')), 1000)
        releaseInterview = () => { clearTimeout(timer); resolve() }
      })
    } else {
      releaseInterview()
    }
  }
  if (query.endsWith('interview') && interviewMode === 'failure') return new Response('test failure', { status: 503 })
  const ids = query.endsWith('full set') ? ['overlap', 'concert2', 'concert3']
    : query.endsWith('interview') && interviewMode === 'empty' ? [] : ['overlap']
  return Response.json({ items: ids.map(id => ({ id: { videoId: id }, snippet: {
    title: 'Radiohead ' + id, channelTitle: 'Radiohead', description: '', publishedAt: '2026-01-01',
  } })) })
}
let handler
globalThis.Deno = { env: { get: () => 'test-only' }, serve: callback => { handler = callback } }
await import('../supabase/functions/build-artist-page/index.ts')
async function build() {
  rpcCalls.length = 0
  return handler(new Request('http://localhost/build', {
    method: 'POST', body: JSON.stringify({ artist_name: 'Radiohead' }),
  }))
}

test('raw overlap reaches SQL, but first response contains only persisted rows and manual selections', async () => {
  const response = await build()
  assert.equal(response.status, 200)
  assert.deepEqual(rpcCalls.map(call => call.p_video_type), ['concert', 'interview', 'music_video'])
  assert.ok(rpcCalls.every(call => call.p_videos.some(v => v.youtube_video_id === 'overlap')))
  const body = await response.json()
  assert.deepEqual(body.videos.map(v => v.id), ['stored-1'])
  assert.deepEqual(body.interview_videos.map(v => v.id), ['manual-1'])
  assert.equal(body.interview_videos[0].title, 'manual selection')
  assert.deepEqual(body.music_videos, [])
  assert.equal(body.music_videos_synced, true)
})

test('failed category search does not clear or mark that category synced', async () => {
  interviewMode = 'failure'
  const response = await build()
  assert.equal(response.status, 200)
  assert.deepEqual(rpcCalls.map(call => call.p_video_type), ['concert', 'music_video'])
  const body = await response.json()
  assert.equal(body.interviews_synced, false)
  assert.equal(body.interview_videos[0].title, 'manual selection')
})

test('successful empty search reaches SQL so stale automatic rows can be cleared', async () => {
  interviewMode = 'empty'
  const response = await build()
  assert.equal(response.status, 200)
  assert.deepEqual(rpcCalls.find(call => call.p_video_type === 'interview').p_videos, [])
  assert.equal((await response.json()).interviews_synced, true)
})

test('persisted read failure is not disguised as successful empty content', async () => {
  interviewMode = 'overlap'
  readError = { message: 'test read failure' }
  const response = await build()
  assert.equal(response.status, 500)
  assert.match((await response.json()).error, /Failed to read built videos/)
})


test('secondary searches overlap while category writes retain their order', async () => {
  readError = null
  interviewMode = 'concurrency'
  secondaryStarted = []
  const response = await build()
  assert.equal(response.status, 200)
  assert.equal(secondaryStarted.length, 2)
  assert.deepEqual(rpcCalls.map(call => call.p_video_type), ['concert', 'interview', 'music_video'])
  interviewMode = 'overlap'
})
