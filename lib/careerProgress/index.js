/**
 * Career Progress — extract pillar scores, career score, timeline, and growth insights.
 */

const PRODUCT_KW = ["product", "roadmap", "prd", "user research", "product owner", "ürün", "urun"];
const METRIC_KEYS = [
  { key: "ats_score", labelEn: "ATS", labelTr: "ATS" },
  { key: "recruiter_confidence", labelEn: "Recruiter Confidence", labelTr: "Recruiter Güveni" },
  { key: "product_readiness", labelEn: "Product Language", labelTr: "Ürün Dili" },
  { key: "interview_readiness", labelEn: "Interview Readiness", labelTr: "Mülakat Hazırlığı" },
];

function clamp(n, min = 0, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function normalizeConfidence(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 50;
  if (n > 0 && n <= 1) return clamp(n * 100);
  return clamp(n);
}

export function extractProgressMetrics({ engineV2 = null, score = null, cvText = "" } = {}) {
  const cv = String(cvText || "").toLowerCase();
  const ats = clamp(
    engineV2?.ATS?.ats_score ??
      engineV2?.ATS?.keyword_match ??
      (Array.isArray(engineV2?.ATS?.matched_skills) ? engineV2.ATS.matched_skills.length * 8 : 0)
  );
  const recruiter = clamp(
    normalizeConfidence(engineV2?.Decision?.confidence) ||
      (engineV2?.Decision?.final_verdict === "apply_now" ? 78 : engineV2?.Decision?.final_verdict === "do_not_apply" ? 32 : 52)
  );
  const matched = (engineV2?.ATS?.matched_skills || engineV2?.ATS?.matched_keywords || []).map((x) =>
    String(x).toLowerCase()
  );
  let product = 38;
  if (matched.some((s) => PRODUCT_KW.some((k) => s.includes(k)))) product += 28;
  if (/product management|product owner|ürün yönetimi|product manager/i.test(cv)) product += 22;
  if ((engineV2?.Recruiter?.strengths || []).some((s) => /product|ownership|ürün/i.test(String(s)))) product += 12;
  product = clamp(product);

  const alignment = clamp(score ?? engineV2?.["Final Alignment Score"] ?? 50);
  let interview = alignment;
  const verdict = String(engineV2?.Decision?.final_verdict || "");
  if (verdict === "apply_now") interview = Math.max(interview, 74);
  if (verdict === "do_not_apply") interview = Math.min(interview, 42);
  if (verdict === "maybe") interview = Math.round(interview * 0.92);
  interview = clamp(interview);

  const career_score = clamp(Math.round(ats * 0.28 + recruiter * 0.26 + product * 0.24 + interview * 0.22));

  return {
    career_score,
    ats_score: ats,
    recruiter_confidence: recruiter,
    product_readiness: product,
    interview_readiness: interview,
  };
}

export function computeMetricDeltas(previous, current, lang = "TR") {
  const tr = String(lang || "").toUpperCase() === "TR";
  if (!previous || !current) return [];
  return METRIC_KEYS.map(({ key, labelEn, labelTr }) => ({
    key,
    label: tr ? labelTr : labelEn,
    delta: clamp(current[key]) - clamp(previous[key]),
    before: clamp(previous[key]),
    after: clamp(current[key]),
  })).filter((d) => d.delta !== 0);
}

export function pickBiggestImprovement(deltas, lang = "TR") {
  const tr = String(lang || "").toUpperCase() === "TR";
  const positive = [...deltas].filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta);
  return positive.slice(0, 2).map((d) => ({
    text: `+${d.delta} ${d.label}`,
    key: d.key,
    delta: d.delta,
    label: d.label,
  }));
}

export function pickBiggestWeakness({ engineV2 = null, metrics = null, lang = "TR" } = {}) {
  const tr = String(lang || "").toUpperCase() === "TR";
  const missing = (engineV2?.ATS?.missing_keywords || []).map((x) => String(x).trim()).filter(Boolean);
  if (missing.length) {
    const top = missing[0];
    const formatted = top.replace(/\b\w/g, (c) => c.toUpperCase());
    return formatted;
  }
  if (!metrics) return tr ? "Kanıt netliği" : "Evidence clarity";
  const pillars = [
    { key: "ats_score", label: tr ? "ATS" : "ATS", value: metrics.ats_score },
    { key: "recruiter_confidence", label: tr ? "Recruiter güveni" : "Recruiter confidence", value: metrics.recruiter_confidence },
    { key: "product_readiness", label: tr ? "Ürün dili" : "Product language", value: metrics.product_readiness },
    { key: "interview_readiness", label: tr ? "Mülakat" : "Interview", value: metrics.interview_readiness },
  ];
  const weakest = [...pillars].sort((a, b) => a.value - b.value)[0];
  if (weakest?.key === "product_readiness") return tr ? "User Research" : "User Research";
  return weakest?.label || (tr ? "ATS uyumu" : "ATS fit");
}

export function snapshotToRow(userId, payload) {
  return {
    user_id: userId,
    analysis_id: payload.analysis_id || null,
    role: String(payload.role || "").slice(0, 200),
    career_score: clamp(payload.career_score),
    ats_score: clamp(payload.ats_score),
    recruiter_confidence: clamp(payload.recruiter_confidence),
    product_readiness: clamp(payload.product_readiness),
    interview_readiness: clamp(payload.interview_readiness),
    biggest_improvement: payload.biggest_improvement || [],
    biggest_weakness: String(payload.biggest_weakness || "").slice(0, 120),
  };
}

function monthLabel(dateInput, lang) {
  const tr = String(lang || "").toUpperCase() === "TR";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(tr ? "tr-TR" : "en-US", { month: "long" });
}

export function buildTimelineFromSnapshots(snapshots = [], lang = "TR") {
  const sorted = [...snapshots].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const byMonth = new Map();
  for (const s of sorted) {
    const d = new Date(s.created_at || Date.now());
    const bucket = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(bucket, {
      monthKey: bucket,
      month: monthLabel(d, lang),
      score: clamp(s.career_score),
      ats_score: clamp(s.ats_score),
      recruiter_confidence: clamp(s.recruiter_confidence),
      product_readiness: clamp(s.product_readiness),
      interview_readiness: clamp(s.interview_readiness),
      created_at: s.created_at,
    });
  }
  return Array.from(byMonth.values()).slice(-8);
}

export function buildCareerGrowthView({ snapshots = [], current = null, lang = "TR" } = {}) {
  const tr = String(lang || "").toUpperCase() === "TR";
  const timeline = buildTimelineFromSnapshots(snapshots, lang);
  const latest = current || snapshots[0] || null;
  const previous = snapshots.length > 1 ? snapshots[1] : null;
  const deltas = computeMetricDeltas(previous, latest, lang);
  const improvements = pickBiggestImprovement(deltas, lang);
  const weakness =
    latest?.biggest_weakness ||
    pickBiggestWeakness({ engineV2: null, metrics: latest, lang });

  const careerScore = clamp(latest?.career_score ?? current?.career_score ?? 0);
  const priorScore = clamp(previous?.career_score ?? timeline[timeline.length - 2]?.score ?? careerScore);
  const scoreDelta = careerScore - priorScore;

  return {
    title: tr ? "CAREER GROWTH" : "CAREER GROWTH",
    subtitle: tr
      ? "Her analiz Career Score'unu günceller — ilerlemen görünür kalır."
      : "Every analysis updates your Career Score — progress stays visible.",
    careerScore,
    scoreDelta,
    timeline,
    pillars: latest
      ? [
          { key: "ats", label: "ATS", value: latest.ats_score, color: "#38bdf8" },
          { key: "recruiter", label: tr ? "Recruiter" : "Recruiter", value: latest.recruiter_confidence, color: "#a78bfa" },
          { key: "product", label: tr ? "Ürün" : "Product", value: latest.product_readiness, color: "#34d399" },
          { key: "interview", label: tr ? "Mülakat" : "Interview", value: latest.interview_readiness, color: "#fbbf24" },
        ]
      : [],
    biggestImprovement: {
      title: tr ? "En büyük gelişim" : "Biggest improvement",
      items: improvements.length
        ? improvements.map((i) => i.text)
        : tr
          ? ["İlk ölçüm kaydedildi"]
          : ["First baseline recorded"],
    },
    biggestWeakness: {
      title: tr ? "En büyük zayıflık" : "Biggest weakness",
      label: weakness,
    },
    hasHistory: snapshots.length > 0 || timeline.length > 1,
  };
}

export function rowToSnapshot(row) {
  if (!row) return null;
  return {
    id: row.id,
    career_score: row.career_score,
    ats_score: row.ats_score,
    recruiter_confidence: row.recruiter_confidence,
    product_readiness: row.product_readiness,
    interview_readiness: row.interview_readiness,
    biggest_improvement: row.biggest_improvement || [],
    biggest_weakness: row.biggest_weakness || "",
    role: row.role || "",
    created_at: row.created_at,
  };
}

export function recordSnapshotPayload({ engineV2, score, cvText, role, lang, previous = null, analysis_id = null }) {
  const metrics = extractProgressMetrics({ engineV2, score, cvText });
  const deltas = computeMetricDeltas(previous, metrics, lang);
  const biggest_improvement = pickBiggestImprovement(deltas, lang);
  const biggest_weakness = pickBiggestWeakness({ engineV2, metrics, lang });
  return {
    ...metrics,
    analysis_id,
    role,
    biggest_improvement,
    biggest_weakness,
    created_at: new Date().toISOString(),
  };
}
