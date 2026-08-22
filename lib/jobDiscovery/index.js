import { JOB_CATALOG } from "./catalog.js";
import { extractSignalsFromCv } from "../careerMemory/index.js";

function clamp(n, min = 0, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cvHas(cv, token) {
  return norm(cv).includes(norm(token));
}

function signalMatch(cv, signal) {
  const s = norm(signal);
  if (s.includes("founder") && /\b(founder|co-founder|kurucu)\b/i.test(cv)) return true;
  if (s.includes("product ownership") && /\b(ownership|owned|sahiplen|product owner)\b/i.test(cv)) return true;
  if (s.includes("live product") && /\b(launch|shipped|mvp|canlı|live product)\b/i.test(cv)) return true;
  if (s.includes("measurable impact") && /\b(\d+\s?%|kpi|metric|revenue|growth)\b/i.test(cv)) return true;
  return cvHas(cv, signal);
}

function levelFit(cvLevel, jobLevel) {
  const cv = norm(cvLevel);
  const job = norm(jobLevel);
  if (cv === job) return 8;
  if (cv === "junior" && job === "junior") return 8;
  if (cv === "mid" && job === "mid") return 7;
  if (cv === "senior+" && (job === "senior" || job === "mid")) return 6;
  if (cv === "junior" && job === "mid") return 3;
  if (cv === "mid" && job === "senior") return 2;
  if (cv === "junior" && job === "senior") return -4;
  return 4;
}

function familyFit(identity, family) {
  const id = norm(identity);
  const fam = norm(family);
  if (id.includes("product") && fam === "product") return 10;
  if (id.includes("data") && fam === "data") return 10;
  if (id.includes("strategy") && (fam === "product" || fam === "consulting")) return 6;
  if (id.includes("founder") && fam === "product") return 8;
  if (fam === "consulting" && /consult|analist|analyst|strateji/i.test(id)) return 7;
  if (fam === "engineering" && /yazılım|software|engineer|developer/i.test(id)) return 9;
  if (fam === "operations" && /operasyon|operations|iş/i.test(id)) return 7;
  return 2;
}

function interviewChanceLabel(matchPercent, lang) {
  const tr = String(lang || "").toUpperCase() === "TR";
  const n = Number(matchPercent) || 0;
  if (n >= 78) return tr ? "Yüksek" : "High";
  if (n >= 58) return tr ? "Orta" : "Medium";
  return tr ? "Düşük" : "Low";
}

function actionFromMatch(matchPercent) {
  const n = Number(matchPercent) || 0;
  if (n >= 72) return "apply";
  if (n >= 52) return "risky";
  return "skip";
}

function formatGap(kw, lang) {
  const tr = String(lang || "").toUpperCase() === "TR";
  const map = {
    prd: "PRD",
    "user research": tr ? "User Research" : "User Research",
    roadmap: "Roadmap",
    sql: "SQL",
    python: "Python",
    react: "React",
  };
  const key = norm(kw);
  return map[key] || kw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function reasonFromSignal(signal, lang) {
  const tr = String(lang || "").toUpperCase() === "TR";
  const s = norm(signal);
  if (s.includes("founder")) return tr ? "Güçlü founder sinyali" : "Strong founder signal";
  if (s.includes("product ownership")) return tr ? "Güçlü product ownership" : "Strong product ownership";
  if (s.includes("live product")) return tr ? "Canlı ürün teslimi" : "Live product delivery";
  if (s.includes("measurable impact")) return tr ? "Ölçülebilir etki" : "Measurable impact";
  return tr ? "Profil bu role yakın" : "Profile aligns with this lane";
}

export function recommendJobs({
  cvText = "",
  careerProfile = null,
  lang = "TR",
  limit = 5,
  skippedIds = [],
} = {}) {
  const cv = String(cvText || "");
  const tr = String(lang || "").toUpperCase() === "TR";
  if (cv.trim().length < 40) {
    return { jobs: [], title: tr ? "ÖNERİLEN İLANLAR" : "RECOMMENDED JOBS", subtitle: "" };
  }

  const fromCv = extractSignalsFromCv(cv);
  const strongPool = [
    ...(careerProfile?.strong_signals || []),
    ...(careerProfile?.strengths || []),
    ...fromCv.strong,
  ];
  const weakPool = [
    ...(careerProfile?.weak_signals || []),
    ...(careerProfile?.weaknesses || []),
    ...fromCv.weak,
  ];
  const identity = careerProfile?.career_identity || "";
  const level = careerProfile?.career_level || inferLevelFromCv(cv);

  const skip = new Set((skippedIds || []).map(norm));

  const scored = JOB_CATALOG.filter((j) => !skip.has(norm(j.id))).map((job) => {
    let score = 48;
    const matchedReasons = [];
    for (const sig of job.strongSignals || []) {
      const hit =
        strongPool.some((s) => norm(s).includes(norm(sig)) || norm(sig).includes(norm(s))) ||
        signalMatch(cv, sig);
      if (hit) {
        score += 9;
        matchedReasons.push(reasonFromSignal(sig, lang));
      }
    }
    score += levelFit(level, job.level);
    score += familyFit(identity, job.family);

    const missing = [];
    for (const gap of job.gapKeywords || []) {
      const inCv = cvHas(cv, gap);
      const inWeak = weakPool.some((w) => norm(w).includes(norm(gap)) || norm(gap).includes(norm(w)));
      if (!inCv || inWeak) missing.push(formatGap(gap, lang));
    }
    if (missing.length) score -= Math.min(14, missing.length * 4);

    const matchPercent = clamp(score);
    const action = actionFromMatch(matchPercent);
    const isIntern = /intern|staj/i.test(`${job.title} ${job.id}`);
    const remote = Boolean(job.remote);
    const global = (job.regions || []).includes("global");
    return {
      id: job.id,
      company: job.company,
      title: job.title,
      displayTitle: `${job.company} ${job.title}`,
      isIntern,
      remote,
      global,
      matchPercent,
      matchLabel: tr ? `%${matchPercent} uyum` : `${matchPercent}% match`,
      reasons: matchedReasons.slice(0, 3),
      missing: [...new Set(missing)].slice(0, 3),
      interviewChance: interviewChanceLabel(matchPercent, lang),
      interviewChanceKey: matchPercent >= 78 ? "high" : matchPercent >= 58 ? "medium" : "low",
      action,
      jdText: job.jdSnippet,
      level: job.level,
      family: job.family,
    };
  });

  scored.sort((a, b) => b.matchPercent - a.matchPercent);
  const jobs = scored.slice(0, Math.max(3, Math.min(8, limit)));

  return {
    title: tr ? "ÖNERİLEN İLANLAR" : "RECOMMENDED JOBS",
    subtitle: tr
      ? "HireFit CV'ne göre aktif fırsatlar buluyor — beklemeden keşfet."
      : "HireFit surfaces opportunities from your CV — no waiting for uploads.",
    jobs,
  };
}

function inferLevelFromCv(cv) {
  const t = norm(cv);
  if (/\b(intern|staj|graduate|yeni mezun)\b/.test(t)) return "Junior";
  if (/\b(senior|lead|principal|kıdemli|director)\b/.test(t)) return "Senior";
  return "Mid";
}

export function buildRecommendedJobsView(payload, lang = "TR") {
  return payload || recommendJobs({ lang });
}
