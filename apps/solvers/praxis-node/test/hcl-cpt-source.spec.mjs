import { requestFor, checkSummary } from './hcl-source-helpers.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
const addon = createRequire(import.meta.url)('..');
const fixture = JSON.parse(readFileSync(new URL('../../praxis/tests/fixtures/hcl_mh_cpt/reference.json', import.meta.url)));

const invoke=(method,request)=>JSON.parse(addon[method](JSON.stringify(request)));
for(const c of fixture.cases) test(`native CPT source: ${c.name}`,()=>{
  const request=requestFor(c);
  assert.equal(invoke('validate',request).result?.valid,true);
  const output=invoke('execute',request);
  if(c.nonfinite){assert.ok(output.error);return;}
  assert.equal(output.error,undefined,JSON.stringify(output));
  const count=c.settings.sample_count;
  const n=c.variables.find(v=>v.name==='N');
  const samples=Array.from({length:count},(_,i)=>{
    if(!n.parents.length)return .2*c.cpts.N[i];
    const p=c.variables.find(v=>v.name==='P');
    return .2*(p.probabilities[0]*c.cpts.N[i]+p.probabilities[1]*c.cpts.N[n.states.length*count+i]);
  });
  checkSummary(output.result.uncertainty,samples);
});
for(const c of fixture.mixed) for(const scenario of c.outputs) test(`native mixed ${c.name}, evidence ${JSON.stringify(scenario.evidence)}`,()=>{
  const request=requestFor(c,true);
  request.modelSnapshots[0].baseEvidence.observations=Object.entries(scenario.evidence).map(([nodeId,state])=>({nodeId,stateId:state?'True':'False'}));
  const output=invoke('execute',request);
  assert.equal(output.error,undefined,JSON.stringify(output));
  checkSummary(output.result.uncertainty,scenario.samples);
});
test('native CPT rejects removed or invalid definitions before execution',()=>{
  for(const prior of [{family:'DIRICHLET',alpha:[0,0]},{family:'DIRICHLET',alpha:[1,2,3]},{family:'BETA',alpha:2,beta:8,trueStateId:'missing'}]) {
    const request=requestFor(fixture.cases[0]);request.modelSnapshots[0].solverSettings.uncertainty.cptRowDistributions[0].prior=prior;
    assert.ok(invoke('validate',request).error);
  }
  const request=requestFor(fixture.cases[0]);
  const row=request.modelSnapshots[0].solverSettings.uncertainty.cptRowDistributions[0];delete row.prior;row.equivalentSampleSize=20;
  assert.ok(invoke('validate',request).error);
});
test('native accepts the legacy FT sampler field without changing FT sampling',()=>{
  const request=requestFor(fixture.mixed[1],true);
  const settings=request.modelSnapshots[0].solverSettings.uncertainty;
  settings.basicEventSampler=settings.sampler;delete settings.sampler;
  const result=invoke('execute',request);assert.equal(result.error,undefined,JSON.stringify(result));
  checkSummary(result.result.uncertainty,fixture.mixed[1].outputs[0].samples);
});
