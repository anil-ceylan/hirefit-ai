# Entitlement authority: reviewed local model

Production rollout completed 2026-10-11. Phase A and Phase B were first verified on the reviewed disposable project hirefit-baseline-replay (nddfpwqrfgcddzjwjrsw), including sequential verification, two-session concurrency verification, Phase B privilege postconditions, and post-cutover regressions. The reviewed production project hirefit-ai (inmcvfyhsrwhznbjlnit) now has both guarded entitlement migrations installed. Post-deploy database verification, authenticated /api/entitlements runtime smoke testing, and authenticated server-side /api/career-profile smoke testing passed. Payment/provider reconciliation remains a separate authority source concern and is not implied by this rollout.

## Accepted product semantics

Free: two successful normal analyses in a reset-anchored 720-hour window. Pro: unlimited. Onboarding: a separate one-time benefit for a new eligible authenticated account, always using the existing Free-tier first-analysis output. No browser flag, plan row, profile field or clock grants an entitlement.

The authority account's initialization/review supplies the first window anchor. A database operation samples clock_timestamp AFTER obtaining the per-user lock. At elapsed time >=720 hours it resets completed normal count to zero and anchors a new 720-hour window at that operation. Idle time does not create banked windows. Settlement time determines the charged window; unexpired pending normal holds count against admission across reset. This retains the existing reset algorithm and quota, not a rolling event-history algorithm.

## Runtime call graph and trust

Browser App -> GET entitlements (UX snapshot only) -> POST analyze-v2 -> shared server authority -> verified Supabase bearer -> service-only hirefit_analysis_entitlement reserve -> server Career Memory -> engine with authoritative tier -> complete -> successful response. Express registers the shared handlers through registerEntitlementRoutes; Vercel dispatches the same authority operations. Neither accepts body identity, isPro, plan or onboarding flags as authority.

Browser first-analysis flow -> POST onboarding-analysis -> same authority with server-selected onboarding kind. Normal requests cannot select that kind. CV/description are not stored in entitlement tables: only a SHA-256 digest of operation inputs is stored. This digest is not public API data or a log.

| Call site | Previous trust/operation | Current local replacement |
| --- | --- | --- |
| App.syncUserPlanForUser | Browser plan SELECT/INSERT/reset UPDATE | No-store authenticated server snapshot |
| App.analyze | Browser quota/paid gate, body isPro, increment after success | Presentation gate, server reservation/settlement, memory-only retry key |
| App/HireFitSections/PersonalizedRoadmap | UI isPro/admin CTA gates | UI only; engine authorization remains server-owned |
| firstCareerAnalysis / FirstCareerAnalysisFlow | Normal endpoint, client isPro:false, no credit increment | Authenticated separate benefit endpoint; same key on ambiguous retry |
| Express and Vercel analysis entrypoints | Client isPro passed to engine | Shared authority, verified identity, allowlisted engine fields |
| verifySupabaseJwt.getUserFromRequest | Bearer validated by auth.getUser | Retained; req.authUser/body IDs cannot shortcut analysis verification |
| careerMemory.getServiceClient | Server credential and RLS bypass | Server-only; never imported into browser clients |
| withCompanyIntel -> analyze-v2 -> tierGate | Internal paid output flag | Receives only server-derived admission tier |
| admin pro-access, both backends | Configured admin assignment | Confirmed verified admin; authoritative account required |
| Railway Lemon webhook | Signed event/email mapping | Payment grants BLOCKED pending authority review |
| increment_user_plan_analysis | Auth-checked increment without quota ceiling | Body preserved; Phase B removes client/service EXECUTE |
| Career Memory analysis_count | History/progression count | Unrelated to quota; unchanged |

## Architecture and function security

Server authority fits the two existing backends and auth flow. An authenticated SECURITY DEFINER RPC could derive auth.uid() for admission but would also need protected server settlement/refunds. Chosen design: verified server identity plus service-only SECURITY INVOKER operations and PostgreSQL transactions. No caller-controlled UUID is trusted at a browser-executable definer boundary.

| Function | Security / search_path | Executable roles | Identity / required access |
| --- | --- | --- | --- |
| hirefit_analysis_entitlement(uuid,text,uuid,boolean,text,text,text) | INVOKER; pg_catalog, pg_temp | service_role; postgres owner | Verified UUID/admin bit supplied by server; new account/request tables SIU, legacy user_plans SIU, career_profiles/analyses SELECT for historical presence |
| hirefit_set_authoritative_plan(uuid,text,text) | INVOKER; pg_catalog, pg_temp | service_role; postgres owner | Existing authority account; source admin only; account SELECT/UPDATE and legacy projection SIU |

PUBLIC/anon/authenticated EXECUTE is revoked. New tables have RLS, no browser policies and no browser privileges. Both functions serialize through the same advisory lock and account FOR UPDATE. Platform role attributes/memberships and schema CREATE restrictions are guarded. Escalation is prevented within this boundary by verified server identity and client denial of service privileges; service credential or configured admin compromise remains privileged access, not a browser entitlement.

## Authoritative onboarding lifecycle

Persisted account state is available, reserved, consumed or closed. Separate onboarding_prepared records the server preparation transition. Table default is closed. Only an account initialized cleanly with no legacy plan/profile/analysis footprint starts available. Historical accounts require explicit reconciliation.

- available + server prepare -> available/prepared; preparation cannot reopen terminal state.
- available/prepared + admitted request -> reserved.
- reserved + successful unexpired settlement -> consumed permanently.
- reserved + known failure or lease expiry -> available (retry permitted with a new request key).
- available/reserved + explicit completion or skip -> closed permanently; pending benefit is released and late settlement denied.
- consumed/closed + prepare, profile edits, repeated completion/skip -> unchanged terminal state.

No Career Memory field is read for benefit admission. Neither clearing completedAt nor editing onboarding_completed can reopen it. The partial unique index also prevents another pending/completed benefit execution.

### Actual completion/skip integration

The UI saves core Career DNA before optional first analysis. The new POST /api/career-onboarding/prepare uses the existing core profile builder with finalize:false. Server preparation changes only trusted prepared state, never lifecycle eligibility.

The existing POST /api/career-onboarding/complete remains final: completeOnboarding defaults finalize:true and closes the benefit BEFORE persisting profile changes. PATCH /api/career-onboarding/first-analysis calls saveFirstAnalysis, which also closes before profile mutation; FirstCareerAnalysisFlow.onSkip sends completionKind:skipped through that existing endpoint. Other first-analysis completion/fallback sends completed. Client input can request closure of its own benefit; it cannot request reopening. Both routes derive UUID through verified auth.

The flow's dashboard/Weekly Move and normal-analysis exit actions also await this completion persistence before navigation. Closure failure keeps the user in the flow with a retryable message. Weekly Action calculation and persistence remain unchanged after the completion gate.

Profile persistence and closure are two transactions in deliberate fail-closed order. If closure succeeds and profile persistence fails, the benefit stays closed; retry saves the profile and never restores eligibility. UI waits for successful remote persistence before caching/claiming completion. First-analysis persistence failure is structured 503 on both backends. Ambiguous analysis failures preserve the retry key and do not automatically fall back into completion. Known AI failure may finish the existing snapshot flow and close the unused benefit.

Onboarding draft persistence initializes clean new authority state BEFORE creating a profile footprint. Other historical/pre-existing footprints still fail closed rather than being guessed to be new users; this must be covered during reconciliation/cutover.

## Requests, recovery and retry

No analysis idempotency key existed previously. New clients send a memory-only UUID Idempotency-Key, reused for the same input/account after an ambiguous response. Servers validate UUID/string shape. Legacy clients missing the header receive a server UUID; their HTTP retries cannot claim the same execution, but quota and one-time benefit still constrain them. Hash mismatch, kind mismatch or owner mismatch with an existing key fails with IDEMPOTENCY_CONFLICT.

| Request event | State/result | Quota and benefit |
| --- | --- | --- |
| Admitted | pending, lease=15 minutes from DB time | Reserves normal slot or benefit |
| Same key pending | 409 ANALYSIS_IN_PROGRESS | No engine execution or new reservation |
| Successful settlement before lease end | completed | Count increment once; benefit consumed |
| Same key completed | 409 ANALYSIS_ALREADY_COMPLETED | No re-execution; output is not retained in quota ledger |
| Clearly failed/malformed analysis | released; 502 ANALYSIS_FAILED | No charge; reserved benefit available unless explicitly closed |
| Server analysis timeout, 5 minutes | released; 504 ANALYSIS_TIMEOUT | No charge; late underlying promise cannot return/settle |
| Crash, client timeout or unknown RPC result | Pending until resolved/expired | Retain key and hold; no blind refund or rerun |
| Lease reached (expires_at<=DB clock) | expired on next authority operation | No charge; late complete rejected; new key can retry if eligible |
| Close while benefit running | released/onboarding_closed; account closed | Late output cannot settle; terminal closure preserved |
| Repeated same settlement | Idempotent same destination | No second increment/release |
| Conflicting terminal settlement | Error, no result returned | No state reversal |

Expiry uses database time and is checked under the lock before any completion. Recovery is lazy on the next authority operation, including snapshot. No scheduled worker or privileged expiry endpoint is required for this pilot. Expired/released keys never execute again; intentional retry uses a new key. Successful responses return only AFTER confirmed settlement. A lost successful response is charged once; replay returns already-completed because prompt/output retention is intentionally absent. Refresh loses the in-memory client key; normal quota still bounds another request, and consumed/closed onboarding cannot be reused. This limitation is documented, not claimed to provide durable result recovery.

An unexpired hold crossing reset remains counted; its success charges the new settlement window. An expired hold cannot settle into either window. Replaying old keys cannot manufacture credits. Existing Pro remains unlimited; configured confirmed-email admin uses server ADMIN_EMAIL, not VITE_ADMIN_EMAIL.

## Historical source classification and reconciliation

| Source audited | Classification | Consequence |
| --- | --- | --- |
| user_plans.plan/count/reset, browser body/flags/localStorage | Explicitly untrusted | Never import as paid or usage authority |
| Client-editable analyses/profile/history records | Explicitly untrusted for entitlement proof | Presence blocks fresh initialization; does not prove payment or remaining allowance |
| Railway HMAC Lemon webhook | Potentially authoritative but unverified | Signature code exists; product/store scope, durable event identity/order, stable auth-user binding and current subscription truth are unproven |
| Existing checkout links / email matching | Potentially authoritative but unverified | Purchase intent/email are not a reviewed UUID entitlement source |
| Verified confirmed-email ADMIN_EMAIL assignment | Authoritative explicit manual action under configured admin boundary | Assign existing reconciled authority account; no automatic legacy Pro adoption |
| ADMIN_EMAIL runtime override | Authoritative configured server exception if deployment config is reviewed | Server derives from verified confirmed identity; config still needs isolated/live verification |
| VITE_ADMIN_EMAIL and UI paid gates | Explicitly untrusted | No server paid decisions |
| New protected authority tables/RPCs | Authoritative after reviewed installation/reconciliation | Not evidence that old rows were legitimate |
| Synthetic ledgers, mock users/keys, isolated seeds | Development/test only | No production import |

**Payment verdict: the repository contains no verified authoritative production payment source for automatic reconciliation.** It contains integration code, not proof of production configuration/provider truth. No authoritative production payment-provider evidence was verified in this work. setTrustedPlan rejects payment without calling the RPC, and the SQL assignment function accepts admin only. The webhook now reports failure instead of acknowledging an unverified grant; payment processing must remain gated during cutover.

Reconciliation requires a separate reviewed manifest keyed by auth.users.id. Collect trusted provider/admin evidence outside this task; verify provider account/product/current status and stable UUID binding. Record reviewer, evidence reference (not secret/raw payment payload), decision, usage/window anchor and terminal onboarding state. Default plan is free; grant Pro only through explicit verified evidence/authorized manual grant. If usage or benefit history cannot be established, keep ENTITLEMENT_REVIEW_REQUIRED until a reviewer authorizes an explicit conservative resolution. Do not silently reset counts, import legacy Pro, reopen onboarding or invent a payment expiry. No backfill function or data repair is included in either phase draft.

## Production rollout completion and broader hardening

PHASE A — COMPLETE: production migration 20261011225000_entitlement_authority_phase_a.sql installed the guarded authority tables/functions over the reviewed production-state baseline and bootstrap compatibility pair. Production history was verified before and after deployment; no migration-history repair, baseline replay, or bootstrap replay occurred. The authority tables remained server-only and the reviewed authority function definitions and ACLs passed post-deploy verification.

APP RUNTIME CUTOVER — COMPLETE: the reviewed authority backends, onboarding lifecycle, idempotency flow and client entitlement path are active. Runtime source review found no remaining browser user_plans mutation path or old increment RPC dependency. Authenticated production smoke tests confirmed /api/entitlements and the server-side /api/career-profile path operate successfully after the privilege cutover.

PHASE B — COMPLETE: production migration 20261011233000_entitlement_authority_phase_b.sql removed user_plans browser mutation, anon access, identity-sequence access, old increment EXECUTE and direct browser access to career_profiles while preserving the approved server-side persistence path. RLS remains enabled, authenticated user_plans access is SELECT-only, and service-role access matches the reviewed production matrix.

security-hardening-v1.DRAFT.sql remains unchanged as an audit artifact and MUST NOT be stacked. Its vulnerable user_plans browser SIU/sequence/increment grants were superseded by Phase B and MUST NOT be reintroduced; analyses service SELECT must remain for historical checks; new tables/functions require their explicit service access. Companion cleanup, unrelated anon cleanup and default-ACL hardening keep their direction but need separately regenerated pre/postconditions after this object/grant change.

## Readiness

Entitlement authority Phase A/Phase B production hardening is COMPLETE and verified. The production migration history contains the reviewed baseline followed by Phase A and Phase B. Database privilege/RLS postchecks and authenticated runtime smoke tests passed. Remaining work outside this rollout is trusted payment/provider source validation and any future Pro reconciliation or grant workflow; legacy plan state must not be treated as authoritative payment evidence. Operational monitoring remains ongoing.
