# Production adoption completion record

**Final verdict: COMPLETE. DO NOT rerun repair or archived migrations.**

Recorded 2026-10-11 from operator-supplied verified completion evidence. Execution time
was not supplied; this is the documentation date, not an inferred operation timestamp.
No production connection or SQL execution was performed to prepare this record.

## Identity and approved artifacts

- Approved baseline package commit: `023c57cdb16e52a58570305e4005795a075db3a0`.
- Production project ref: `inmcvfyhsrwhznbjlnit`.
- Baseline version: `20261010120000`.
- Baseline SHA-256: `ed6a2878faaf90d9f500d29b19bdfb3950b9f67c685f1d1d1c847e68d786f103`.
- Bootstrap SHA-256: `a71ce8982b848fd1c3bee24a6d7909f1a27952837eb713ab5cb3074d2514e567`.
- Pinned Supabase CLI: `2.120.0`.

## Completed operation — historical record only

The separately authorized command was executed exactly once:

```text
npx supabase@2.120.0 migration repair 20261010120000 --status applied --linked
```

Result: `Repaired migration history: [20261010120000] => applied`.
Before: remote history absent. After: Local = Remote = `20261010120000`;
history_row_count = 1; history_versions = ["20261010120000"];
history_names = ["production_state_baseline"]. All 11 archived legacy versions remain absent.
The one-time authorization is consumed; it grants no permission to repeat or revert repair.

Production baseline SQL and bootstrap SQL were NOT executed. Only migration-history
metadata was added; application schema/security semantics remained unchanged.

## Identical pre/post semantic fingerprints

Overall MD5: `84eabb2aa7f0cf161bfdc0c83ddab171`; canonical object count: `323`.

| Section | Count | Identical before/after MD5 |
|---|---:|---|
| 01_table | 12 | f1ed0040198d74e69526424702915351 |
| 02_column | 161 | e3688e3a134438673135f1405185219c |
| 03_constraint | 83 | 1b16d7fc8c573946e9489ea6c6dcd03c |
| 04_index | 26 | fc67d63ebcc83a37165a92907bd0558c |
| 05_function | 2 | 88af365ec745707dcea1c69c839b3deb |
| 06_trigger | 4 | d7f10e84b50b6d72de42c545c2403bd8 |
| 07_policy | 18 | 4b30503ee8501942821c8e4d52924da8 |
| 08_relation_acl | 13 | b9feb2f0cda39bee28b8d69649eb8c19 |
| 09_default_acl | 3 | 8f048499b26ef3ac6dcbdd8c325b453a |
| 10_sequence | 1 | 205f28577f2c5eba9e5dc7cd5d036e90 |

Bootstrap post-check: bootstrap_definition_match = true; ensure_rls_exact = true.
career-cvs and profile-avatars buckets remain absent. These tables remain absent:
university_intelligence_catalog, city_intelligence_catalog, career_event_recommendations,
student_career_roadmaps. No excluded product schema was activated.

## Continuing constraints

Future schema/security changes require NEW separately reviewed forward migrations.
Unattended db reset / normal fresh migration-runner replay remains unsupported.
Bootstrap remains separate provenance-uncertain compatibility behavior.
This completion record authorizes no SQL execution, production operation or Git push.
Preserve this evidence; document any later correction in a separate reviewed record.
