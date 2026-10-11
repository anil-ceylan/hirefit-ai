import assert from "node:assert/strict";
import { analysisAttempt, isDefinitiveAnalysisResponse } from "../src/utils/entitlementClient.js";
import { runFirstCareerAnalysis, persistFirstAnalysisRemote } from "../src/utils/firstCareerAnalysis.js";

const payload={cvText:"synthetic CV",jobDescription:"synthetic JD"};
const attempt=analysisAttempt(null,payload,"user-a");
assert.equal(analysisAttempt(attempt,payload,"user-a"),attempt);
assert.notEqual(analysisAttempt(attempt,payload,"user-b").key,attempt.key);
assert.notEqual(analysisAttempt(attempt,{...payload,cvText:"changed"},"user-a").key,attempt.key);
assert.equal(isDefinitiveAnalysisResponse(503,{error:"ENTITLEMENT_UNAVAILABLE"}),false);
assert.equal(isDefinitiveAnalysisResponse(409,{error:"ANALYSIS_IN_PROGRESS"}),false);
assert.equal(isDefinitiveAnalysisResponse(409,{error:"ANALYSIS_ALREADY_COMPLETED"}),false);
assert.equal(isDefinitiveAnalysisResponse(504,{error:"ANALYSIS_TIMEOUT"}),true);
const originalFetch=globalThis.fetch;
const calls=[]; let status=503;
const attemptRef={current:null};
const profile={basic_profile:{},career_goals:{targetRoles:[]},career_dna:{}};
const getHeaders=async options=>{assert.equal(options.requireSession,true);return {Authorization:"Bearer synthetic"};};
globalThis.fetch=async (url,options)=>{
  calls.push({url,options});
  return {ok:status===200,status,json:async()=>status===200?{success:true,profile}:{success:false,error:"ENTITLEMENT_UNAVAILABLE"}};
};
try {
  await assert.rejects(runFirstCareerAnalysis({cvText:"synthetic CV",profile,getApiAuthHeaders:getHeaders,attemptRef}),/ONBOARDING_ANALYSIS_UNAVAILABLE/);
  const key=calls[0].options.headers["Idempotency-Key"];
  await assert.rejects(runFirstCareerAnalysis({cvText:"synthetic CV",profile,getApiAuthHeaders:getHeaders,attemptRef}));
  assert.equal(calls[1].options.headers["Idempotency-Key"],key);
  assert.equal(calls.length,2); assert(calls.every(c=>c.url==="/api/onboarding-analysis"));
  assert(!("isPro" in JSON.parse(calls[0].options.body)));
  await assert.rejects(persistFirstAnalysisRemote(getHeaders,profile,"skipped"),/ONBOARDING_COMPLETION_UNAVAILABLE/);
  assert.equal(JSON.parse(calls.at(-1).options.body).completionKind,"skipped");
  status=200; assert.deepEqual(await persistFirstAnalysisRemote(getHeaders,profile),profile);
} finally {globalThis.fetch=originalFetch;}
// eslint-disable-next-line no-console
console.log("PASS: memory-only identity/input-scoped retry keys, authenticated benefit calls and completion failure propagation; no network.");
