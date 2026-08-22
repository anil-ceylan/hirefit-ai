# Identity Engine V3 — Sprint Report

## 1. Files changed

| File | Change |
|------|--------|
| `lib/careerIntelligence/evidenceDimensions.js` | **New** — evidence dimension constants + trait normalization |
| `lib/careerIntelligence/cvEvidenceLayer.js` | **New** — multi-source evidence extraction |
| `lib/careerIntelligence/identityEngineV3.js` | **New** — composite identity, explanations, strength profile |
| `lib/careerOnboarding/persistence.js` | Persists `identity_v3`, `evidence` on `career_dna` + `career_gps` |
| `lib/careerOnboarding/careerSnapshot.js` | Uses V3 for identity title + explanation; exports `detectRoleFamiliesFromProfile` |
| `lib/careerOnboarding/dnaResult.js` | Adds `archetypeRanked` (top 3) |
| `lib/careerIntelligence/buildIntelligence.js` | Fixes readiness inference to use normalized **trait** scores |
| `lib/careerOnboarding/weightedFitEngine.js` | Fixes candidate signals to use trait normalization |
| `scripts/validate-identity-v3.mjs` | **New** — 50 synthetic persona validation |

No UI pages or new user-facing modules added.

---

## 2. Identity architecture (V3)

```
Career DNA Likert → traitScores (8 dims)
Readiness benchmarks → pillar scores
Profile text / CV / roles / industries
        ↓
CV Evidence Layer (15 normalized dimensions, 0–100)
        ↓
┌─────────────────────┬──────────────────────┐
│ Domain modifier     │ Core archetype       │
│ (15 identities)     │ (10 identities)      │
│ Product Builder     │ Builder, Strategist  │
│ Technical Builder   │ Operator, Analyst    │
│ Startup Builder     │ Creator, Leader      │
│ Growth Builder      │ Connector, Innovator │
│ Business Strategist │ Executor, Researcher │
│ Data Analyst        │                      │
│ …                   │                      │
└─────────────────────┴──────────────────────┘
        ↓
Composite title: "Startup Builder + Strategist"
Evidence-based explanation (3 top signals)
Internal strengthProfile (top / emerging / growth)
```

Stored on profile as:

```js
career_dna.identity_v3 = { title, evidence, strengthProfile, explanation, … }
career_gps.identity_v3 = { … }
```

---

## 3. Evidence architecture

**Dimensions:** ownership, leadership, execution, analytics, communication, technical_depth, business_acumen, startup_exposure, customer_exposure, project_complexity, innovation, collaboration, strategic_thinking, research_orientation, networking.

**Sources (weighted merge):**

| Source | Signals |
|--------|---------|
| Career DNA traits | All dimensions via trait→evidence mapping |
| Readiness benchmarks | projects, leadership, experience, english, network |
| Profile / CV text | founder, technical, product, data, growth, strategy keywords |
| Goals | industry boosts (entrepreneurship, technology, finance) |

Not exposed raw to users; powers identity composition and internal strength profile.

---

## 4. Before vs After

| Aspect | Before (V2) | After (V3) |
|--------|-------------|------------|
| Identity model | Single archetype winner-take-all | Domain modifier + core composite |
| Distinct labels | ~6 recurring (Builder, Strategist, Product Builder + X) | 15+ domain × 10 core combinations |
| Evidence | Implicit in traits only | 15-dimension normalized layer |
| Explanations | Generic role-family copy | Signal-specific paragraphs |
| Schema bug | `scores.builder` read on trait keys (always 0) | Normalized `traitNorm` everywhere |
| Strength profile | Static archetype copy | Ranked from evidence |
| CV / projects | Ignored in onboarding identity | Text + benchmark extraction |

---

## 5. Diversity results (50 synthetic personas)

Run: `node scripts/validate-identity-v3.mjs`

**Measured (2026-05-27):**

| Metric | Result |
|--------|--------|
| Unique identity titles | **22** (goal: ≥15) |
| Unique DNA archetypes | 4 |
| Unique role families | 7 |
| Unique explanation prefixes | 27 |
| Unique evidence signatures | 27 |
| Identity collapse rate | 56% (down from ~83% in V2) |
| Archetype collapse rate | 92% (DNA layer unchanged; V3 composes on top) |

Sample composites: `Execution Operator + Analyst`, `Technical Builder + Executor`, `Startup Builder + Executor`, `Product Builder + Executor`, `Financial Analyst + Researcher`, `Business Strategist + Analyst`.

---

## 6. Remaining weaknesses

1. **DNA Likert still 10 items** — limited psychometric spread; evidence layer compensates but more items would help.
2. **CV evidence in onboarding** — only when CV text is present on profile; full PDF parse not wired into evidence layer yet.
3. **Analysis `buildIdentityEngine` (CV/JD regex)** — still separate from V3; unification is a future sprint.
4. **MBTI** — collected but not fed into evidence.
5. **No confidence scores** on composite identity — top-2 scores stored internally but not surfaced.

---

## 7. Recommended next sprint

1. **Unify analysis identity** — feed `buildIdentityEngine` (normalizeAnalysisForUI) from `identity_v3.evidence`.
2. **CV PDF → evidence** — pipe extracted CV text into `buildCvEvidenceLayer` on upload.
3. **Confidence + secondary identity** — expose “also strong in X” internally for role matching.
4. **Expand Likert bank** — 15–20 items mapped to evidence dimensions.
5. **A/B diversity monitor** — log unique identity counts in production telemetry.

---

## Audit summary (Part 1)

**Why only ~6 identities across 36 profiles?**

1. Winner-take-all archetype resolution (9 → 1).
2. Overlapping trait weights (builder/founder/operator share execution).
3. **Schema mismatch:** consumers read `scores.builder` but DB stores `traitScores.execution`.
4. Role-family fallback to `BUSINESS` → “Business Strategist”.
5. Composite dedup collapsed second blocks.
6. Default `"Product-Oriented Generalist"` absorbed unmatched profiles.

**Missing signals:** CV text, project/internship benchmarks (partial), founder leadership benchmark, ranked archetypes, secondary composition, MBTI, analysis pipeline merge.

**Collapse cause:** Evidence-poor path → role regex + broken DNA thresholds → small label vocabulary.
