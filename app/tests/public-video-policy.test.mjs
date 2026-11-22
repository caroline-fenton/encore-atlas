import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
let policy = { reviewed_empty_types: [], decisions: [] }
let failure = false
let lookups = []
globalThis.__policyArtist = async (name, strict) => {
  lookups.push({ name, strict })
  if (failure) throw new Error('policy lookup unavailable')
  return { video_curation_policy: policy }
}
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './artists' && context.parentURL.endsWith('/publicVideoPolicy.ts')) {
      return { url: 'test:policy-artists', shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === 'test:policy-artists') return { format: 'module', source: 'export const getArtistByName = (...args) => globalThis.__policyArtist(...args)', shortCircuit: true }
    return next(url, context)
  },
})
const { searchWithVideoPolicy } = await import('../src/services/publicVideoPolicy.ts')

test('reviewed-empty categories suppress initial, retry and paginated live requests', async () => {
  policy = { reviewed_empty_types: ['concert', 'interview', 'music_video'], decisions: [] }
  for (const category of policy.reviewed_empty_types) {
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.deepEqual(await searchWithVideoPolicy('Reviewed Artist', category, () => { throw new Error('must not search') }), { videos: [] })
    }
  }
})
test('all categories filter exclusions and misplaced keeps, preserving pagination', async () => {
  policy = { reviewed_empty_types: [], decisions: [
    { youtube_video_id: 'excluded', action: 'remove', target_type: null },
    { youtube_video_id: 'live', action: 'keep', target_type: 'concert' },
  ] }
  for (const category of ['concert', 'interview', 'music_video']) {
    const result = await searchWithVideoPolicy('Artist alias', category, async () => ({
      videos: ['excluded', 'live', 'untouched'].map(id => ({ id })), nextPageToken: 'next', effectiveDuration: 'any',
    }))
    assert.deepEqual(result.videos.map(v => v.id), category === 'concert' ? ['live', 'untouched'] : ['untouched'])
    assert.equal(result.nextPageToken, 'next')
    assert.equal(result.effectiveDuration, 'any')
  }
  assert.ok(lookups.every(l => l.strict === true))
})
test('next page reloads artist policy instead of reusing stale exclusions', async () => {
  policy = { reviewed_empty_types: [], decisions: [] }
  const search = async () => ({ videos: [{ id: 'newlyExcluded' }], nextPageToken: 'page2' })
  assert.equal((await searchWithVideoPolicy('Artist', 'concert', search)).videos.length, 1)
  policy.decisions.push({ youtube_video_id: 'newlyExcluded', action: 'remove', target_type: null })
  assert.equal((await searchWithVideoPolicy('Artist', 'concert', search)).videos.length, 0)
  // A different artist's empty policy does not exclude this YouTube ID globally.
  policy = { reviewed_empty_types: [], decisions: [] }
  assert.equal((await searchWithVideoPolicy('Different artist', 'concert', search)).videos.length, 1)
})
test('policy lookup failure cannot bypass exclusions with a live request', async () => {
  failure = true
  try {
    await assert.rejects(searchWithVideoPolicy('Artist', 'concert', () => { throw new Error('must not search') }), /policy lookup unavailable/)
  } finally { failure = false }
})
