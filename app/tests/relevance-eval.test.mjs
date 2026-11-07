import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evidence, requestFor, parseAnswer, validateCases, classify, summarize } from '../scripts/relevance/core.mjs'
const c = { id:'fixture', artist:{name:'Fixture',genres:[],context:'A test band',identity_reviewed:true},video:{title:'Fixture live',channel:null,description:'Test'},label:'relevant',review_note:'Do not send' }
test('providers receive identical evidence without reference labels or review notes',()=>{
 assert.equal(requestFor('jev',c).body.state,requestFor('decisions',c).body.input)
 assert.equal(evidence(c).includes('Do not send'),false)
 assert.equal(evidence(c).includes('identity_reviewed'),false)
})
test('unreviewed identities, missing labels and duplicate IDs block runs',()=>{
 assert.throws(()=>validateCases([{...c,artist:{...c.artist,identity_reviewed:false}}]))
 assert.throws(()=>validateCases([{...c,label:null}]))
 assert.throws(()=>validateCases([c,c]))
 validateCases([c])
})
test('typed probabilities are validated; malformed answers never become rejection',()=>{
 assert.equal(parseAnswer('jev',{answers:{relevant:{type:'noul',noul:0.8}}}),0.8)
 assert.equal(parseAnswer('decisions',{answers:[{name:'relevant',type:'predicate',probability:0.3}]}),0.3)
 for(const p of [-1,2,'0.5',null,NaN]) assert.throws(()=>parseAnswer('jev',{answers:{relevant:{type:'noul',noul:p}}}))
 assert.throws(()=>parseAnswer('decisions',{answers:[]}))
 assert.equal(classify(.5),'review')
})
test('errors and uncertain labels do not inflate accuracy metrics',()=>{
 const base={error:null,probability:0,decision:'irrelevant',latency_ms:10}
 const s=summarize([{...base,label:'relevant'},{...base,label:'uncertain'},{...base,label:'irrelevant',error:'HTTP 500',probability:null}])
 assert.equal(s.mistaken_rejections,1);assert.equal(s.errors,1);assert.equal(s.brier,1)
})
