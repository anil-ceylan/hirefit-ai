/**
 * Career Memory — extract, merge, and compare user career profiles across analyses.
 */

const PRODUCT_SIGNALS = [
  "product management",
  "product manager",
  "ürün yönetimi",
  "roadmap",
  "prd",
  "user research",
  "product owner",
  "product ownership",
];

const FOUNDER_SIGNALS = ["founder", "co-founder", "kurucu", "co founder"];

function cleanList(items, max = 12) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const t = String(item || "").trim();
    if (!t || t.length < 2 || t.length > 80) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function inferCareerLevel(cvText, score) {
  const cv = String(cvText || "").toLowerCase();
  const n = Number(score) || 0;
  if (/\b(director|head of|vp |chief|müdür|direktör)\b/i.test(cv)) return "Senior+";
  if (/\b(senior|lead|principal|kıdemli)\b/i.test(cv) || n >= 72) return "Senior";
  if (/\b(junior|intern|staj|graduate|yeni mezun)\b/i.test(cv) || n < 48) return "Junior";
  return "Mid";
}

function inferCareerIdentity(cvText, engineV2, identityEngine) {
  const id = identityEngine?.primaryIdentity?.label || identityEngine?.primaryIdentity?.id || "";
  if (id === "FounderBuilder" || /founder|builder|kurucu/i.test(id)) {
    return "Product / Founder";
  }
  if (/product|ürün|urun/i.test(`${cvText} ${engineV2?.Context?.career_area || ""}`)) {
    return "Product / Strategy";
  }
  if (/strategy|strateji/i.test(cvText)) return "Strategy";
  if (/data|analiz|analytics/i.test(cvText)) return "Data & Analytics";
  return engineV2?.Context?.career_area || "General Professional";
}

export function extractSignalsFromCv(cvText) {
  const cv = String(cvText || "").toLowerCase();
  const strong = [];
  const weak = [];
  if (FOUNDER_SIGNALS.some((k) => cv.includes(k))) strong.push("Founder");
  if (/launch|shipped|canlıya|live product|mvp/i.test(cv)) strong.push("Live Product");
  if (/ownership|sahiplen|led |owned |yönettim/i.test(cv)) strong.push("Product Ownership");
  if (/metric|%\s*\d|revenue|growth|kpi|ölçülebilir/i.test(cv)) strong.push("Measurable Impact");
  for (const kw of PRODUCT_SIGNALS) {
    if (cv.includes(kw)) strong.push(kw.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40));
  }
  if (!/roadmap/i.test(cv)) weak.push("Roadmap");
  if (!/user research|kullanıcı araştırma/i.test(cv)) weak.push("User Research");
  if (!/prd|product requirements/i.test(cv)) weak.push("PRD");
  if (!/product management|ürün yönetimi/i.test(cv)) weak.push("Product Management");
  return { strong: cleanList(strong, 8), weak: cleanList(weak, 8) };
}

export function extractCareerProfileSnapshot({
  cvText = "",
  engineV2 = null,
  identityEngine = null,
  atsIntelligence = null,
  roleSuggestions = [],
  score = null,
  lang = "TR",
}) {
  const cv = String(cvText || "");
  const fromCv = extractSignalsFromCv(cv);
  const matched = (engineV2?.ATS?.matched_skills || engineV2?.ATS?.matched_keywords || [])
    .map((x) => String(x).trim())
    .filter(Boolean);
  const missing = (atsIntelligence?.displayMissingCritical ||
    engineV2?.ATS?.missing_keywords ||
    [])
    .map((x) => String(x).trim())
    .filter(Boolean);
  const roles = (roleSuggestions || [])
    .map((r) => r.role || r)
    .filter(Boolean);
  const strong = cleanList([
    ...fromCv.strong,
    ...(engineV2?.Recruiter?.strengths || []),
    ...matched.slice(0, 4),
  ]);
  const weak = cleanList([...fromCv.weak, ...missing.slice(0, 6), ...(engineV2?.Recruiter?.weaknesses || [])]);
  return {
    career_identity: inferCareerIdentity(cv, engineV2, identityEngine),
    career_level: inferCareerLevel(cv, score),
    strong_signals: strong,
    weak_signals: weak,
    skills: cleanList([...matched, ...(engineV2?.ATS?.top_keywords || [])], 15),
    experience: cleanList(extractExperienceLines(cv), 6),
    projects: cleanList(extractProjectLines(cv), 6),
    target_roles: cleanList(roles, 5),
    industries: cleanList([engineV2?.Context?.sector].filter(Boolean), 4),
    strengths: strong.slice(0, 5),
    weaknesses: weak.slice(0, 5),
    captured_at: new Date().toISOString(),
    alignment_score: Number(score) || null,
  };
}

function extractExperienceLines(cv) {
  return String(cv || "")
    .split(/\n/)
    .filter((line) => /\d{4}|present|günümüz|–|-/i.test(line) && line.length > 12)
    .slice(0, 8)
    .map((l) => l.trim().slice(0, 120));
}

function extractProjectLines(cv) {
  return String(cv || "")
    .split(/\n/)
    .filter((line) => /project|proje|built|developed|launch|ürün/i.test(line))
    .slice(0, 8)
    .map((l) => l.trim().slice(0, 120));
}

export function mergeCareerProfiles(existing, snapshot) {
  const prev = existing || null;
  if (!prev) {
    return {
      ...snapshot,
      analysis_count: 1,
    };
  }
  const mergeArr = (a, b, max) => cleanList([...(a || []), ...(b || [])], max);
  return {
    career_identity: snapshot.career_identity || prev.career_identity,
    career_level: snapshot.career_level || prev.career_level,
    strong_signals: mergeArr(prev.strong_signals, snapshot.strong_signals, 12),
    weak_signals: mergeArr(snapshot.weak_signals, prev.weak_signals, 12),
    skills: mergeArr(prev.skills, snapshot.skills, 20),
    experience: mergeArr(snapshot.experience, prev.experience, 8),
    projects: mergeArr(snapshot.projects, prev.projects, 8),
    target_roles: mergeArr(snapshot.target_roles, prev.target_roles, 8),
    industries: mergeArr(prev.industries, snapshot.industries, 6),
    strengths: mergeArr(prev.strengths, snapshot.strengths, 8),
    weaknesses: mergeArr(snapshot.weak_signals, prev.weaknesses, 8),
    profile_snapshot: snapshot,
    analysis_count: (Number(prev.analysis_count) || 0) + 1,
    captured_at: snapshot.captured_at,
    alignment_score: snapshot.alignment_score ?? prev.alignment_score,
  };
}

function normalizeKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ\s]/gi, "")
    .trim();
}

function compareSignalSets(before = [], after = []) {
  const beforeKeys = new Map(before.map((x) => [normalizeKey(x), x]));
  const afterKeys = new Map(after.map((x) => [normalizeKey(x), x]));
  const improved = [];
  const worse = [];
  const stayedStrong = [];
  for (const [key, label] of afterKeys) {
    if (beforeKeys.has(key)) stayedStrong.push(label);
    else improved.push(label);
  }
  for (const [key, label] of beforeKeys) {
    if (!afterKeys.has(key)) worse.push(label);
  }
  return {
    improved: cleanList(improved, 8),
    worse: cleanList(worse, 8),
    stayedStrong: cleanList(stayedStrong, 8),
  };
}

export function compareCareerMemory(previousProfile, currentSnapshot, lang = "TR") {
  const tr = String(lang || "").toUpperCase() === "TR";
  if (!previousProfile) {
    return {
      isFirstProfile: true,
      title: tr ? "CAREER MEMORY" : "CAREER MEMORY",
      subtitle: tr
        ? "İlk Career Profile oluşturuldu. Sonraki analizlerde karşılaştırma yapılacak."
        : "First Career Profile created. Future analyses will compare against this baseline.",
      improved: currentSnapshot?.strong_signals || [],
      worse: [],
      stayedStrong: [],
      identity: currentSnapshot?.career_identity || "",
      level: currentSnapshot?.career_level || "",
    };
  }
  const signalDiff = compareSignalSets(
    previousProfile.strong_signals || [],
    currentSnapshot.strong_signals || []
  );
  const weakBefore = new Set((previousProfile.weak_signals || []).map(normalizeKey));
  const weakAfter = new Set((currentSnapshot.weak_signals || []).map(normalizeKey));
  const closedGaps = [...weakBefore].filter((k) => !weakAfter.has(k)).map((k) => {
    const found = (previousProfile.weak_signals || []).find((x) => normalizeKey(x) === k);
    return found || k;
  });
  const newGaps = [...weakAfter].filter((k) => !weakBefore.has(k)).map((k) => {
    const found = (currentSnapshot.weak_signals || []).find((x) => normalizeKey(x) === k);
    return found || k;
  });
  const improved = cleanList([...signalDiff.improved, ...closedGaps], 8);
  const worse = cleanList(newGaps, 8);
  const stayedStrong = signalDiff.stayedStrong;
  const scoreBefore = Number(previousProfile.alignment_score);
  const scoreAfter = Number(currentSnapshot.alignment_score);
  if (Number.isFinite(scoreBefore) && Number.isFinite(scoreAfter) && scoreAfter > scoreBefore + 2) {
    improved.push(tr ? `Uyum skoru +${scoreAfter - scoreBefore}` : `Fit score +${scoreAfter - scoreBefore}`);
  }
  if (Number.isFinite(scoreBefore) && Number.isFinite(scoreAfter) && scoreAfter < scoreBefore - 2) {
    worse.push(tr ? `Uyum skoru ${scoreAfter - scoreBefore}` : `Fit score ${scoreAfter - scoreBefore}`);
  }
  return {
    isFirstProfile: false,
    title: tr ? "CAREER MEMORY" : "CAREER MEMORY",
    subtitle: tr
      ? "Career Profile ile bu analizi karşılaştırdık."
      : "Compared this analysis to your Career Profile.",
    improved,
    worse,
    stayedStrong,
    identity: currentSnapshot.career_identity || previousProfile.career_identity,
    level: currentSnapshot.career_level || previousProfile.career_level,
    analysisCount: (Number(previousProfile.analysis_count) || 0) + 1,
  };
}

export function profileRowToMemory(row) {
  if (!row) return null;
  return {
    career_identity: row.career_identity || "",
    career_level: row.career_level || "",
    strong_signals: row.strong_signals || [],
    weak_signals: row.weak_signals || [],
    skills: row.skills || [],
    experience: row.experience || [],
    projects: row.projects || [],
    target_roles: row.target_roles || [],
    industries: row.industries || [],
    strengths: row.strengths || [],
    weaknesses: row.weaknesses || [],
    profile_snapshot: row.profile_snapshot || {},
    analysis_count: row.analysis_count || 0,
    alignment_score: row.profile_snapshot?.alignment_score ?? null,
    updated_at: row.updated_at,
  };
}

export function buildCareerMemoryPromptBlock(memory) {
  if (!memory?.career_identity && !(memory?.strong_signals?.length)) return "";
  const strong = (memory.strong_signals || []).slice(0, 8).join(", ");
  const weak = (memory.weak_signals || []).slice(0, 8).join(", ");
  const roles = (memory.target_roles || []).slice(0, 5).join(", ");
  const skills = (memory.skills || []).slice(0, 10).join(", ");
  return `
CAREER MEMORY (long-term profile — compare this CV analysis to the user's baseline, not a one-off check):
- Career identity: ${memory.career_identity || "—"}
- Level: ${memory.career_level || "—"}
- Strong signals: ${strong || "—"}
- Weak signals: ${weak || "—"}
- Target roles: ${roles || "—"}
- Core skills: ${skills || "—"}
Note gaps between this run and the profile; reinforce what stayed strong and flag regressions.`;
}

export function memoryToDbRow(userId, merged) {
  return {
    user_id: userId,
    career_identity: merged.career_identity || "",
    career_level: merged.career_level || "",
    strong_signals: merged.strong_signals || [],
    weak_signals: merged.weak_signals || [],
    skills: merged.skills || [],
    experience: merged.experience || [],
    projects: merged.projects || [],
    target_roles: merged.target_roles || [],
    industries: merged.industries || [],
    strengths: merged.strengths || [],
    weaknesses: merged.weaknesses || [],
    profile_snapshot: merged.profile_snapshot || merged,
    analysis_count: merged.analysis_count || 1,
    updated_at: new Date().toISOString(),
  };
}
