# DecisionOS Reflection Intelligence Foundation

Reflection Intelligence is a reusable DecisionOS layer that helps users think about themselves while making important decisions.

It does not score, rank, or change evidence-based recommendations.

## Position In Architecture

```text
Evidence Intelligence
-> Reasoning Intelligence
-> Decision Intelligence
-> Reflection Intelligence
-> Memory Intelligence
```

Reflection sits after decision intelligence. It can explain internal motivations, values, tensions, possible bias prompts, and journaling questions, but it never overrides the evidence-backed decision.

## Public API

```js
import { generateReflection } from "../lib/decisionOS/reflection/index.js";

const reflection = generateReflection({
  decision,
  context,
  evidence,
  memory,
  optionalPacks: ["decision_style"],
});
```

## Output Contract

The output uses `schemaVersion: "reflection.v1"` and includes:

- `summary`
- `motivations`
- `reflectionQuestions`
- `potentialBiases`
- `valueAlignment`
- `decisionJournalPrompt`
- `optionalInsightPacks`
- `safety`
- `validation`

Every output also includes:

- `mode: "reflection_only"`
- `influencesRecommendations: false`
- `recommendationOverride: null`

## Bias Library

Biases are prompts, not diagnoses. The library includes:

- Loss Aversion
- Confirmation Bias
- Status Quo Bias
- Authority Bias
- Recency Bias
- Sunk Cost Fallacy
- Availability Bias
- Optimism Bias
- Planning Fallacy
- Imposter Syndrome
- Perfectionism
- Need for Control
- Fear of Judgment

Copy must remain tentative, such as "You may want to consider..."

## Values Library

Values are reflection dimensions, not fixed personality claims. Initial dimensions:

- Growth
- Security
- Freedom
- Recognition
- Impact
- Creativity
- Learning
- Community
- Stability
- Achievement

The layer can surface possible value tensions, such as Growth vs Security, without claiming certainty.

## Decision Journal

Decision Journal entries use `schemaVersion: "decision-journal.v1"` and support:

- Decision
- Reason
- Expected Outcome
- Biggest Fear
- Biggest Hope
- Confidence
- Reflection
- Future Review Date
- Outcome
- Lessons Learned

## Optional Insight Packs

Optional packs are reflection-only modules. They never modify scores or recommendations.

Supported interface fields:

- `id`
- `label`
- `category`
- `notice`
- `prompts`
- `influencesRecommendations`

Every optional pack must include:

> This insight is optional and intended for personal reflection. It does not change your evidence-based recommendations.

Astrology and numerology are included only as optional symbolic reflection prompts. They are not predictors and must never be represented as factual reasoning.

## Safety Rules

Reflection Intelligence must never:

- predict the future
- claim certainty
- make medical statements
- make psychological diagnoses
- replace professional advice
- claim optional symbolic packs are factual predictors
- change evidence-based recommendations

## Validation

Run:

```bash
node scripts/validate-reflection-intelligence.mjs
```

The validation checks:

- reflection-only mode
- recommendation independence
- optional pack disclaimer enforcement
- journal schema validity
- safety failure detection
- deterministic output for identical input

## Future Integration Notes

HireFit can consume this layer after production decisions are computed. The recommended integration point is after Decision Observatory or after any finalized production recommendation object, not inside scoring or role matching.

Future products such as FundKit, CompanyKit, or MarketKit should pass their own decision context and evidence objects through the same API.
