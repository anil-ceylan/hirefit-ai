/**
 * Shared action_plan parsing, priority handling, and "do this next" enrichment
 * (used by decisionEngine and the client UI).
 */

/**
 * @param {unknown} raw
 * @returns {{ priority_callout: string | null, fixes: Array<{ issue: string, severity: string, priority: string, steps: string[], resource: { label: string, url: string | null } | null }>, interview_note: string | null }}
 */
export function parseActionPlan(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const normNote = (v) => {
      if (v == null) return null;
      const s = String(v).trim();
      if (!s || /^null$/i.test(s)) return null;
      return s;
    };
    const normFixResource = (v) => {
      if (v == null) return null;
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        const label = String(v.label ?? "").trim();
        const urlRaw = v.url == null ? "" : String(v.url).trim();
        const url = !urlRaw || /^null$/i.test(urlRaw) ? null : urlRaw;
        if (!label && !url) return null;
        return { label: label || "Resource", url };
      }
      const s = String(v).trim();
      if (!s || /^null$/i.test(s)) return null;
      return { label: s, url: null };
    };
    const normSeverity = (v) => {
      const s = String(v || "").toLowerCase();
      if (s === "critical") return "critical";
      if (s === "major" || s === "high") return "major";
      if (s === "minor" || s === "low" || s === "medium") return "minor";
      return "major";
    };
    const normPriority = (v, severity) => {
      const s = String(v || "").toLowerCase();
      if (s === "high") return "high";
      if (s === "medium") return "medium";
      if (s === "low") return "low";
      if (severity === "critical") return "high";
      if (severity === "minor") return "low";
      return "medium";
    };
    const normFixItem = (f) => {
      const issue = f && f.issue != null ? String(f.issue).trim() : "";
      let steps = Array.isArray(f?.steps)
        ? f.steps.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 5)
        : [];
      const legacyFix = f && f.fix != null ? String(f.fix).trim() : "";
      if (!steps.length && legacyFix) steps = [legacyFix];
      const severity = normSeverity(f?.severity);
      return {
        issue,
        severity,
        priority: normPriority(f?.priority, severity),
        steps,
        resource: normFixResource(f?.resource),
      };
    };
    return {
      priority_callout: parsed?.priority_callout?.trim() || null,
      fixes: Array.isArray(parsed?.fixes) ? parsed.fixes.slice(0, 3).map(normFixItem) : [],
      interview_note: normNote(parsed?.interview_note),
    };
  } catch {
    return { priority_callout: null, fixes: [], interview_note: null };
  }
}

function normalizePriorities(fixes) {
  const out = fixes.map((f) => ({ ...f }));
  if (!out.length) return out;
  let hi = out.findIndex((f) => f.priority === "high");
  if (hi === -1) {
    const crit = out.findIndex((f) => f.severity === "critical");
    hi = crit >= 0 ? crit : 0;
    out[hi] = { ...out[hi], priority: "high" };
  }
  let seenHigh = false;
  return out.map((f) => {
    if (f.priority === "high") {
      if (seenHigh) return { ...f, priority: "medium" };
      seenHigh = true;
    }
    return f;
  });
}

function buildFallbackStep({ lang, roleFit, gaps, priority_callout, verdict }) {
  const tr = lang === "tr";
  const v = String(verdict || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (v === "do_not_apply") {
    return tr
      ? `Bu ilanı bırakın ve profilinize daha yakın bir rol için özeti yeniden yazın.`
      : `Pass on this posting and refit your summary toward a role that matches your profile.`;
  }
  const callout = (priority_callout || "").trim();
  if (callout) {
    return tr ? `Bu hafta öncelik: ${callout}` : `Prioritize this before your next application: ${callout}`;
  }
  const roles = roleFit?.role_fit || [];
  const best = String(roleFit?.best_role || roles[0]?.role || "").trim();
  if (best) {
    return tr
      ? `"${best}" rol hattına kaydırın ve özetinize taşınabilir bir başarı satırı ekleyin.`
      : `Pivot toward "${best}" roles: add one transferable win line to your summary.`;
  }
  const gapIssue = String(gaps?.rejection_reasons?.[0]?.issue || gaps?.biggest_gap || "").trim();
  if (gapIssue) {
    const short = gapIssue.length > 72 ? gapIssue.slice(0, 69) + "…" : gapIssue;
    return tr
      ? `Deneyim bölümünüze bu boşluğu kapatacak somut bir metrik satırı ekleyin: ${short}`
      : `Add one proof line in your experience that closes this gap: ${short}`;
  }
  return tr
    ? `Aksiyon planındaki bitirilebilir adımlardan birini bugün tamamlayın.`
    : `Complete one finishable step from the Action plan today.`;
}

/**
 * Ensures at least one high-priority fix with a concrete step and never an empty plan.
 * @param {ReturnType<typeof parseActionPlan>} plan
 * @param {{ lang?: string, roleFit?: object, gaps?: object, verdict?: string }} ctx
 */
export function enrichActionPlan(plan, ctx = {}) {
  const lang = ctx.lang === "tr" ? "tr" : "en";
  const roleFit = ctx.roleFit || {};
  const gaps = ctx.gaps || {};
  const verdict = ctx.verdict || "";
  const priority_callout = plan.priority_callout || null;
  let fixes = Array.isArray(plan.fixes) ? plan.fixes.map((f) => ({ ...f })) : [];
  fixes = normalizePriorities(fixes);
  fixes = fixes.map((f) => {
    const hasStep = Array.isArray(f.steps) && f.steps.some((s) => String(s || "").trim());
    if (f.priority === "high" && !hasStep) {
      const fb = buildFallbackStep({ lang, roleFit, gaps, priority_callout, verdict });
      return {
        ...f,
        issue: (f.issue && f.issue.trim()) || (lang === "tr" ? "Acil sonraki adım" : "Immediate next step"),
        steps: [fb],
      };
    }
    return f;
  });
  if (!fixes.length) {
    fixes = [
      {
        issue: lang === "tr" ? "Sonraki hamle" : "Next move",
        severity: "major",
        priority: "high",
        steps: [buildFallbackStep({ lang, roleFit, gaps, priority_callout, verdict })],
        resource: null,
      },
    ];
  }
  return {
    priority_callout: plan.priority_callout,
    fixes,
    interview_note: plan.interview_note,
  };
}

/** First step of the first fix with priority === "high", else first available step. */
export function pickDoThisNextStep(fixes) {
  if (!Array.isArray(fixes) || !fixes.length) return "";
  const highFirst = fixes.find((f) => f.priority === "high" && f.steps?.length && String(f.steps[0] || "").trim());
  if (highFirst) return String(highFirst.steps[0]).trim();
  const any = fixes.find((f) => f.steps?.length && String(f.steps[0] || "").trim());
  return any ? String(any.steps[0]).trim() : "";
}
