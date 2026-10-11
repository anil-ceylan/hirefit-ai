import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createEntitlementAuthority, registerEntitlementRoutes } from "../lib/entitlements/authority.js";
import { ledger, USER_A as A } from "./fixtures/entitlement-ledger.mjs";

const fixtureKey = "__entitlementRouteFixture";
const model = ledger();
const fixture = { authority: null, completed: [], failProfileWrite: false,
  profile: { user_id: A, basic_profile: {}, career_gps: {}, onboarding_completed: true } };
fixture.authority = createEntitlementAuthority({ verify: async req => req.headers?.authorization === "Bearer synthetic"
  ? { ok:true,user:{id:A} } : { ok:false,status:401 }, getClient: () => model.client,
loadMemory: async () => null, adminEmail: () => "", analyze: async value => ({ Output:{tier:value.isPro?"pro":"free"} }) });
fixture.client = { rpc: (...args) => model.client.rpc(...args), from(table) {
  assert.equal(table,"career_profiles");
  let mutation = null;
  const query = { select() { return query; }, eq(column,id) { assert.equal(column,"user_id"); assert.equal(id,A); return query; },
    async maybeSingle() { return {data:fixture.profile,error:null}; },
    update(value) { mutation=value; return query; }, upsert(value) { mutation=value; return query; },
    async single() {
      const state=model.accounts.get(A)?.state;
      fixture.completed.push({state,mutation});
      if (fixture.failProfileWrite) return {data:null,error:{message:"synthetic failure"}};
      fixture.profile={...fixture.profile,...mutation}; return {data:fixture.profile,error:null};
    } };
  return query;
} };
globalThis[fixtureKey]=fixture;
const originalEnv = ["VITE_SUPABASE_URL","VITE_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY"].map(name=>[name,process.env[name]]);
process.env.VITE_SUPABASE_URL="https://entitlement-runtime.invalid";
process.env.VITE_SUPABASE_ANON_KEY="synthetic";
process.env.SUPABASE_SERVICE_ROLE_KEY="synthetic";
const root=new URL("../",import.meta.url);
const routerURL=new URL("lib/vercelApi/careerApiRouter.js",root).href;
const authorityURL=new URL("lib/entitlements/authority.js",root).href;
const virtual=code=>`data:text/javascript,${encodeURIComponent(code)}`;
const hooks=registerHooks({resolve(specifier,context,nextResolve) {
  if(specifier==="@supabase/supabase-js") return {url:virtual(`export const createClient=()=>globalThis.${fixtureKey}.client;`),shortCircuit:true};
  if(context.parentURL===routerURL && specifier.startsWith(".") && new URL(specifier,context.parentURL).href===authorityURL) {
    return {url:virtual(`export const entitlementAuthority=globalThis.${fixtureKey}.authority;export const setTrustedPlan=()=>{throw new Error('Unexpected grant')};`),shortCircuit:true};
  }
  return nextResolve(specifier,context);
}});
try {
  const {handleCareerApi}=await import(routerURL);
  const routes=new Map();
  registerEntitlementRoutes({get:(path,handler)=>routes.set(`GET ${path}`,handler),post:(path,handler)=>routes.set(`POST ${path}`,handler)},fixture.authority);
  async function invoke(backend,path,body,authorized=true) {
    let output; const response={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},
      json(value){output=value;return this;},end(text){output=JSON.parse(text);} };
    const request={url:path,path,method:path==="/api/entitlements"?"GET":"POST",headers:authorized?{authorization:"Bearer synthetic"}:{},body};
    if(backend==="Express") await routes.get(`${request.method} ${path}`)(request,response);
    else await handleCareerApi(request,response,path);
    return {status:response.statusCode,body:output};
  }
  for(const backend of ["Express","Vercel"]) {
    assert.equal((await invoke(backend,"/api/analyze-v2",{cvText:"CV",jobDescription:"JD",isPro:true,user_id:"other"})).body.Output.tier,"free");
    assert.equal((await invoke(backend,"/api/analyze-v2",{},false)).status,401);
    assert.equal((await invoke(backend,"/api/entitlements",{})).status,200);
  }
  for(const backend of ["Express","Vercel"]) assert.equal((await invoke(backend,"/api/analyze-v2",{cvText:"CV",jobDescription:"JD"})).status,403);
  // Import real persistence after SDK interception: every mutation must observe closure first.
  const {saveFirstAnalysis,completeOnboarding}=await import("../lib/careerOnboarding/persistence.js?entitlement-fixture");
  await saveFirstAnalysis(A,{firstAnalysis:{completedAt:"synthetic"},completionKind:"skipped"});
  assert.equal(model.accounts.get(A).state,"closed"); assert.equal(fixture.completed.at(-1).state,"closed");
  // Clearing editable evidence and preparing again cannot reopen the authoritative state.
  await saveFirstAnalysis(A,{firstAnalysis:{}}); assert.equal(model.accounts.get(A).state,"closed");
  fixture.failProfileWrite=true;
  const originalError=console.error; console.error=()=>{};
  try { assert.equal((await saveFirstAnalysis(A,{firstAnalysis:{}})).storageUnavailable,true); }
  finally { console.error=originalError; }
  assert.equal(model.accounts.get(A).state,"closed"); fixture.failProfileWrite=false;
  await completeOnboarding(A,{basic:{},goals:{},dnaAnswers:{},readinessAnswers:{}},{finalize:false});
  assert.equal(model.accounts.get(A).state,"closed");
  await completeOnboarding(A,{basic:{},goals:{},dnaAnswers:{},readinessAnswers:{}});
  assert.equal(fixture.completed.at(-1).state,"closed");
} finally {
  hooks.deregister(); delete globalThis[fixtureKey];
  for(const [name,value] of originalEnv) { if(value===undefined)delete process.env[name];else process.env[name]=value; }
}
// eslint-disable-next-line no-console
console.log("PASS: Express/Vercel authority parity and real onboarding persistence closure ordering; no network or SQL executed.");
