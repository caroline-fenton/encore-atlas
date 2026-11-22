import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleVideoCuration } from './video-curation.ts'

const actor = '00000000-0000-0000-0000-000000000001'
const artist = '00000000-0000-0000-0000-000000000002'
function client(rpc: (name: string, args: Record<string, unknown>) => unknown) {
  return { rpc } as unknown as Parameters<typeof handleVideoCuration>[0]
}
test('preview uses authenticated actor and pinned policy; removal clears destination', async () => {
  let payload: Record<string, unknown> = {}
  await handleVideoCuration(client((_name, args) => { payload = args; return { data: { id: artist } } }), actor, {
    action: 'curation_preview', artist_id: artist, youtube_video_id: 'ImQ1i1fBEA0',
    decision: 'remove', target_type: 'concert', reason: '  audio only  ', p_actor: 'forged', policy_version: 'forged',
  })
  assert.equal(payload.p_actor, actor)
  assert.equal(payload.p_policy, '2026-11-07.v1')
  assert.equal(payload.p_target, null)
  assert.equal(payload.p_reason, 'audio only')
})
test('malformed proposals and duplicate approval IDs never reach database', async () => {
  const service = client(() => { throw new Error('unexpected database call') })
  for (const body of [
    { action: 'curation_preview', artist_id: artist, youtube_video_id: 'ImQ1i1fBEA0', decision: 'keep', target_type: 'wrong', reason: 'test' },
    { action: 'curation_preview', artist_id: artist, youtube_video_id: 'ImQ1i1fBEA0', decision: 'remove', reason: '' },
    { action: 'curation_approve', ids: [artist, artist] },
    { action: 'curation_apply', ids: [] },
  ]) await assert.rejects(handleVideoCuration(service, actor, body), error => !String(error).includes('unexpected database'))
})
test('application groups one artist atomically and reports independent failures', async () => {
  const calls: unknown[] = []
  const service = {
    from: () => ({ select: () => ({ eq: (column: string, value: string) => {
      assert.equal(column, 'requested_by'); assert.equal(value, actor)
      return { in: async () => ({ data: [{ id: actor, artist_id: 'a' }, { id: artist, artist_id: 'b' }] }) }
    } }) }),
    rpc: async (_name: string, args: Record<string, unknown>) => {
      calls.push(args)
      return (args.p_ids as string[])[0] === actor ? { data: { status: 'applied' } } : { error: { message: 'Conflict in second artist' } }
    },
  } as unknown as Parameters<typeof handleVideoCuration>[0]
  const result = await handleVideoCuration(service, actor, { action: 'curation_apply', ids: [actor, artist] })
  assert.equal(calls.length, 2)
  assert.deepEqual(result.results?.map(r => r.status), ['applied', 'failed'])
})
