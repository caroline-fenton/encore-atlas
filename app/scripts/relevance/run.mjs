import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { baseline, requestFor, parseAnswer, classify, validateCases, summarize } from './core.mjs'

const [file, mode = 'dry-run'] = process.argv.slice(2)
if (!file || !['dry-run', 'live'].includes(mode)) throw new Error('Usage: node scripts/relevance/run.mjs <reviewed-dataset.json> [dry-run|live]')
const source = await readFile(file, 'utf8')
const { cases } = JSON.parse(source)
validateCases(cases)
if (cases.length > 100) throw new Error('Pilot capped at 100 cases / 200 API requests')
if (mode === 'dry-run') {
  console.log(JSON.stringify({ cases: cases.length, requests: cases.length*2, providers: ['jev','decisions'], dataset_sha256: createHash('sha256').update(source).digest('hex') }))
  process.exit(0)
}
for (const key of ['TYPESAFE_API_KEY','OPENAI_API_KEY']) if (!process.env[key]) throw new Error(`Configure ${key} in the local environment; never paste it into chat`)
const directory = `evals/relevance/results/${Date.now()}`
await mkdir(directory, { recursive: true })
const results = []
for (const [index,c] of cases.entries()) {
  results.push({ id:c.id, provider:'baseline', label:c.label, probability:baseline(c)?1:0, decision:baseline(c)?'relevant':'irrelevant', error:null, latency_ms:0 })
  // Alternate provider order to reduce ordering bias; no retries or parallel bursts.
  for (const provider of index%2 ? ['decisions','jev'] : ['jev','decisions']) {
    const request = requestFor(provider,c)
    const started = performance.now()
    const row = { id:c.id, provider, requested_model:request.body.model, label:c.label, probability:null, decision:'review', error:null }
    let stop = false
    try {
      const response = await fetch(request.url, { method:'POST', redirect:'error', signal:AbortSignal.timeout(30000), headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env[request.key]}` }, body:JSON.stringify(request.body) })
      if (!response.ok) {
        stop = [401,403,429].includes(response.status)
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      row.probability = parseAnswer(provider,data)
      row.decision = classify(row.probability)
      row.returned_model = data.model
      row.usage = data.usage
    } catch (error) { row.error = error instanceof Error ? error.message : 'Request failed' }
    row.latency_ms = Math.round(performance.now()-started)
    results.push(row)
    await writeFile(`${directory}/results.json`, JSON.stringify({ dataset_sha256:createHash('sha256').update(source).digest('hex'), results },null,2))
    if (stop) throw new Error(`Stopped on ${provider} authentication/rate limit error; partial results: ${directory}`)
  }
}
const summary = Object.fromEntries(['baseline','jev','decisions'].map(p => [p,summarize(results.filter(r=>r.provider===p))]))
await writeFile(`${directory}/summary.json`,JSON.stringify(summary,null,2))
console.log(JSON.stringify({directory,summary},null,2))
