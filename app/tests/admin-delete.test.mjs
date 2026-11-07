import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
let admin = true
let authenticated = true
let curated = false
let rpcCalls = []
const client = {
  auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'admin-id' } : null } }) },
  from(table) {
    const query = {
      select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: table === 'admin_users' ? (admin ? { user_id: 'admin-id' } : null) : { id: 'artist-id', name: 'Fixture', is_curated: curated } }),
      then: (resolve, reject) => Promise.resolve({ count: 2, error: null }).then(resolve, reject),
    }
    return query
  },
  rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: { artist_name: 'Fixture' }, error: null } },
}
globalThis.__adminDeleteClient = client
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('https://esm.sh/@supabase/supabase-js')) return { url: specifier, shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.startsWith('https://esm.sh/@supabase/supabase-js')) return { format: 'module', shortCircuit: true, source: 'export const createClient = () => globalThis.__adminDeleteClient' }
    return next(url, context)
  },
})
let handler
globalThis.Deno = { env: { get: () => 'fixture' }, serve: fn => { handler = fn } }
await import('../supabase/functions/admin-content-refresh/index.ts')
const request = (action, name = 'Fixture') => handler(new Request('http://localhost/admin', {
  method: 'POST', headers: { Authorization: 'Bearer test' },
  body: JSON.stringify({ action, artist_id: 'artist-id', confirm_name: name }),
}))
test('deletion rejects unauthenticated users and non-admins before RPC', async () => {
  authenticated = false
  assert.equal((await request('delete_artist')).status, 401)
  authenticated = true; admin = false
  assert.equal((await request('delete_artist')).status, 403)
  assert.equal(rpcCalls.length, 0)
  admin = true
})
test('preview discloses every affected record category without deleting', async () => {
  const response = await request('delete_preview')
  assert.deepEqual((await response.json()).blast_radius, { video_count: 2, watch_history_count: 2, search_count: 2, refresh_count: 2 })
  assert.equal(rpcCalls.length, 0)
})
test('wrong name and curated pages cannot reach the deletion RPC', async () => {
  assert.equal((await request('delete_artist', 'Wrong')).status, 400)
  curated = true
  assert.equal((await request('delete_artist')).status, 400)
  curated = false
  assert.equal(rpcCalls.length, 0)
})
test('deletion passes authenticated actor and confirmation to atomic RPC', async () => {
  assert.equal((await request('delete_artist')).status, 200)
  assert.deepEqual(rpcCalls, [{ name: 'admin_delete_artist', args: { p_artist_id: 'artist-id', p_deleted_by: 'admin-id', p_confirm_name: 'Fixture' } }])
})
