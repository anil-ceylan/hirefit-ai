# Separate replay compatibility bootstrap

This is NOT an active migration. Provenance of public.rls_auto_enable()/ensure_rls
remains uncertain. `rls-auto-enable.sql` is a byte-identical copy of the reviewed
`docs/database/baseline-draft-20261008/rls-bootstrap.DRAFT.sql`.

SHA-256: `a71ce8982b848fd1c3bee24a6d7909f1a27952837eb713ab5cb3074d2514e567`.

Do not run on production. A fresh disposable project requires separate execution
authorization, its explicit acknowledgement and platform permission review.
Exact existing pair: verify/preserve. Absent pair: obtain separate creation authorization.
Different/partial pair: stop. Never replace/harden automatically.

Bootstrap equivalence precedes application baseline replay. This file is not discovered
through the active migration directory and must not be moved there.
See `supabase/baseline/20261010120000/REPLAY.md` and the original bootstrap checklist.
