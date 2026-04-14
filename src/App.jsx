import "./App.css";
import { parseActionPlan, enrichActionPlan, pickDoThisNextStep } from "../lib/analyze-v2/actionPlanNormalize.js";
import supabase from "./supabaseClient";
import PersonalizedRoadmapPage from "./PersonalizedRoadmapPage.jsx";
import { TrustSection, ComparisonSection } from "./HireFitSections";
import { useNavigate, useLocation, Outlet, useOutletContext } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles, FileText, Briefcase, AlertCircle, Loader2,
  Upload, Copy, Wand2, Target, Search, History, Trash2,
  CheckCircle2, ArrowRight, LogIn, LogOut, Download, Mail,
  Zap, Star, TrendingUp, Crown, Linkedin, Instagram, Link2, Workflow,
  ChevronRight, Eye, Layers, ListChecks, KeyRound, LineChart,
  Cpu, FileUp, Lock,
} from "lucide-react";

import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const HF_API_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : "https://hirefit-ai-production.up.railway.app";
const ADMIN_EMAIL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_ADMIN_EMAIL
    ? String(import.meta.env.VITE_ADMIN_EMAIL).trim().toLowerCase()
    : "";

/** 30-day rolling window for free-tier analysis_count reset (user_plans.last_reset_at). */
const USER_PLAN_RESET_MS = 30 * 24 * 60 * 60 * 1000;

function userPlanNeedsReset(lastResetAt) {
  if (lastResetAt == null || lastResetAt === "") return false;
  const t = new Date(lastResetAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t >= USER_PLAN_RESET_MS;
}

function isAdmin(user) {
  if (!user?.email || !ADMIN_EMAIL) return false;
  return String(user.email).trim().toLowerCase() === ADMIN_EMAIL;
}

const HF_SECTOR_VALUES = [
  "Auto-detect",
  "Tech / Startup",
  "Consulting",
  "Finance",
  "FMCG / Retail",
  "Healthcare",
  "Government",
  "Telecom / Hardware",
  "Product Design / UX",
];

const SECTOR_CHIP_THEME = {
  "Auto-detect": { dot: "#a78bfa", ring: "rgba(167,139,250,0.7)", bg: "rgba(167,139,250,0.16)" },
  "Tech / Startup": { dot: "#38bdf8", ring: "rgba(56,189,248,0.7)", bg: "rgba(56,189,248,0.14)" },
  Consulting: { dot: "#818cf8", ring: "rgba(129,140,248,0.7)", bg: "rgba(129,140,248,0.14)" },
  Finance: { dot: "#34d399", ring: "rgba(52,211,153,0.7)", bg: "rgba(52,211,153,0.14)" },
  "FMCG / Retail": { dot: "#f472b6", ring: "rgba(244,114,182,0.7)", bg: "rgba(244,114,182,0.14)" },
  Healthcare: { dot: "#2dd4bf", ring: "rgba(45,212,191,0.7)", bg: "rgba(45,212,191,0.14)" },
  Government: { dot: "#94a3b8", ring: "rgba(148,163,184,0.75)", bg: "rgba(148,163,184,0.12)" },
  "Telecom / Hardware": { dot: "#22d3ee", ring: "rgba(34,211,238,0.65)", bg: "rgba(34,211,238,0.12)" },
  "Product Design / UX": { dot: "#e879f9", ring: "rgba(232,121,249,0.65)", bg: "rgba(232,121,249,0.12)" },
};

function getSectorDisplayLabel(sectorKey, lang) {
  const idx = HF_SECTOR_VALUES.indexOf(String(sectorKey || ""));
  const tr = ["Otomatik (ilan)", "Teknoloji / Startup", "Danışmanlık", "Finans", "FMCG / Perakende", "Sağlık", "Kamu", "Telekom / Donanım", "Ürün Tasarımı / UX"];
  const en = ["Auto (from job)", "Tech / Startup", "Consulting", "Finance", "FMCG / Retail", "Healthcare", "Government", "Telecom / Hardware", "Product Design / UX"];
  if (idx >= 0) return lang === "TR" ? tr[idx] : en[idx];
  return String(sectorKey || "");
}

/** HireFit results surface — semantic colors + premium contrast. */
const RS = {
  pageGradient: "linear-gradient(165deg, #020617 0%, #0f172a 42%, #0c1222 100%)",
  bgBase: "#0b1220",
  bgSurface: "#111827",
  bgElevated: "#1e293b",
  border: "rgba(255,255,255,0.1)",
  borderSubtle: "rgba(255,255,255,0.08)",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ff4d4f",
  redDim: "#fda4a6",
  indigo: "#818cf8",
  fontUi: "'DM Sans', sans-serif",
  fontMono: "'DM Mono', ui-monospace, monospace",
};

function rsRgb(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return "0,0,0";
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function rsAlpha(hex, a) {
  return `rgba(${rsRgb(hex)},${a})`;
}

/** Guidance plus a concrete next step (empty / weak analysis states). */
function EmptyGuidance({ primary, action }) {
  return (
    <div style={{ fontSize: 14, color: RS.textSecondary, lineHeight: 1.75, fontWeight: 500 }}>
      <div>{primary}</div>
      {action ? (
        <div style={{ marginTop: 12, fontSize: 13, color: RS.textMuted, fontWeight: 500, lineHeight: 1.65 }}>{action}</div>
      ) : null}
    </div>
  );
}

const LS_PRIOR_ALIGNMENT_SCORE = "hirefit-prior-alignment-score";

function readPriorAlignmentScore() {
  try {
    const raw = localStorage.getItem(LS_PRIOR_ALIGNMENT_SCORE);
    if (raw == null || raw === "") return NaN;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  } catch {
    return NaN;
  }
}

function writePriorAlignmentScore(fs) {
  try {
    localStorage.setItem(LS_PRIOR_ALIGNMENT_SCORE, String(fs));
  } catch {
    /* ignore */
  }
}

/** Read last stored score, persist new score, return { prior, delta } for UI. */
function computeScoreRunProgress(newScore) {
  const fs = Math.round(Number(newScore) || 0);
  const priorN = readPriorAlignmentScore();
  writePriorAlignmentScore(fs);
  return {
    prior: Number.isFinite(priorN) ? priorN : null,
    delta: Number.isFinite(priorN) ? fs - priorN : null,
  };
}

function formatBlockerTransform(currentScore, impactPts, lang) {
  const cur = Math.min(100, Math.max(0, Math.round(Number(currentScore) || 0)));
  const imp = Math.max(1, Math.min(18, Math.round(Number(impactPts) || 0)));
  const nxt = Math.min(100, cur + imp);
  return lang === "TR"
    ? `Bunu düzeltmek skorunuzu ${cur} → ${nxt} (+${imp}) seviyesine taşıyabilir.`
    : `Fixing this can move your score from ${cur} → ${nxt} (+${imp}).`;
}

/** Stable key for persisting per-fix checklists for this run. */
function analysisExecutionFingerprint(cv, jd, alignmentScore) {
  const a = String(cv || "").slice(0, 2400);
  const b = String(jd || "").slice(0, 2400);
  const s = `${Math.round(Number(alignmentScore) || 0)}|${a}|${b}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `v1_${(h >>> 0).toString(16)}`;
}

const LS_FIX_PROGRESS = "hirefit-fix-progress-";

function emptyStepProofGrid(fixes) {
  return fixes.map((f) => Array(Math.max(0, f.steps?.length || 0)).fill(""));
}

function loadExecutionPlanState(fp, fixes) {
  const n = fixes.length;
  const blank = () => ({
    completed: Array.from({ length: n }, () => false),
    fixProofs: Array.from({ length: n }, () => ""),
    stepProofs: emptyStepProofGrid(fixes),
  });
  if (!fp || !n) return blank();
  try {
    const raw = localStorage.getItem(LS_FIX_PROGRESS + fp);
    if (!raw) return blank();
    const o = JSON.parse(raw);
    const completed =
      Array.isArray(o.completed) && o.completed.length === n
        ? o.completed.map(Boolean)
        : Array.from({ length: n }, () => false);
    const fixProofs =
      Array.isArray(o.fixProofs) && o.fixProofs.length === n
        ? o.fixProofs.map((x) => String(x ?? ""))
        : Array.from({ length: n }, () => "");
    let stepProofs = emptyStepProofGrid(fixes);
    if (Array.isArray(o.stepProofs) && o.stepProofs.length === n) {
      stepProofs = fixes.map((f, fi) => {
        const row = Array.isArray(o.stepProofs[fi]) ? o.stepProofs[fi] : [];
        const sn = Math.max(0, f.steps?.length || 0);
        return Array.from({ length: sn }, (_, si) => String(row[si] ?? ""));
      });
    }
    return { completed, fixProofs, stepProofs };
  } catch {
    return blank();
  }
}

function saveExecutionPlanState(fp, state) {
  if (!fp || !state?.completed || !Array.isArray(state.completed)) return;
  try {
    localStorage.setItem(
      LS_FIX_PROGRESS + fp,
      JSON.stringify({
        completed: state.completed,
        fixProofs: Array.isArray(state.fixProofs) ? state.fixProofs : [],
        stepProofs: Array.isArray(state.stepProofs) ? state.stepProofs : [],
        updatedAt: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
}

/** Cumulative projected alignment after completing fixes 0..i (inclusive). */
function cumulativeScoresAfterFixes(baseScore, fixes) {
  const base = Math.min(100, Math.max(0, Math.round(Number(baseScore) || 0)));
  const out = [];
  let run = base;
  for (const f of fixes) {
    const imp = Math.max(1, Math.min(18, Math.round(Number(f?.score_impact) || 0)));
    run = Math.min(100, run + imp);
    out.push(run);
  }
  return out;
}

function splitImpactAcrossSteps(impPts, stepCount) {
  const n = Math.max(0, Math.floor(stepCount));
  if (n <= 0) return [];
  const total = Math.max(1, Math.min(18, Math.round(Number(impPts) || 0)));
  const base = Math.floor(total / n);
  let rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

const RAW_PARSE_FAIL_RE = /\b(parsing failed|gpt parsing failed|parse failed|json parse)\b/i;

function humanizeUserFacingReason(text, lang) {
  const raw = String(text || "").trim();
  if (!raw) return raw;
  if (RAW_PARSE_FAIL_RE.test(raw)) return translations[lang]?.sanitizeParsingFailed || raw;
  return raw;
}

const HF_ANALYTICS_DEBOUNCE_MS = 900;
const hfAnalyticsLastFire = new Map();

/** Forwards to gtag, Plausible, or dataLayer when available (no-op otherwise). */
function hirefitTrack(eventName, params = {}) {
  if (typeof window === "undefined") return;
  try {
    const payload = { event: eventName, ...params };
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
    if (typeof window.plausible === "function") {
      window.plausible(eventName, { props: params });
    }
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ ...payload, ts: Date.now() });
    }
  } catch {
    /* ignore */
  }
}

function hirefitTrackDebounced(dedupeKey, eventName, params = {}) {
  const now = Date.now();
  const last = hfAnalyticsLastFire.get(dedupeKey) || 0;
  if (now - last < HF_ANALYTICS_DEBOUNCE_MS) return;
  hfAnalyticsLastFire.set(dedupeKey, now);
  hirefitTrack(eventName, params);
}

function getFallbackAnalysis(cvText, jobDescription, lang = "EN") {
  const cv = String(cvText || "");
  const jd = String(jobDescription || "");
  const cvL = cv.toLowerCase();
  const jdL = jd.toLowerCase();
  const hasMetrics = /(\d+\s?%|\$\s?\d+|\d+\s?(x|k|m|hours|days|users|clients|projects))/i.test(cv);
  const toolLexicon = ["excel", "sql", "python", "tableau", "power bi", "figma", "notion", "jira", "ga4", "google analytics", "aws", "react"];
  const visibleTools = toolLexicon.filter((t) => cvL.includes(t));
  const jdTools = toolLexicon.filter((t) => jdL.includes(t));
  const overlapTools = jdTools.filter((t) => visibleTools.includes(t));
  const mismatch = jdTools.length >= 2 && overlapTools.length === 0;

  let score;
  if (!hasMetrics || visibleTools.length === 0 || mismatch) score = 40 + Math.min(10, overlapTools.length * 2);
  else score = 56 + Math.min(14, overlapTools.length * 3 + (hasMetrics ? 4 : 0));
  score = Math.max(30, Math.min(70, Math.round(score)));

  const verdict = score < 55 ? "Stop" : "Improve";
  const keyGap = !hasMetrics
    ? "No measurable impact"
    : visibleTools.length === 0
      ? "No visible tools stack"
      : mismatch
        ? "Role targeting mismatch"
        : "Low recruiter-readable proof";

  const fixes = !hasMetrics
    ? [
        "Add 2 quantified outcome bullets with clear before/after impact.",
        "Map your strongest project to the target role using the job's tool language.",
      ]
    : visibleTools.length === 0
      ? [
          "Add concrete tools used per experience bullet (Excel, SQL, dashboards, etc.).",
          "Attach one proof link that shows execution quality (repo, case study, dashboard).",
        ]
      : [
          "Retarget the headline and top summary to this exact role and function.",
          "Show one result + one tool in each key experience bullet.",
        ];

  const bump = 12;
  const impactProjection = {
    before: score,
    after: Math.min(100, score + bump),
    delta: bump,
    narrative:
      lang === "TR"
        ? `Bu iyileştirmelerle skorun ${score} → ${Math.min(100, score + bump)} (+${bump}) olabilir.`
        : `With these fixes your score can move ${score} → ${Math.min(100, score + bump)} (+${bump}).`,
  };

  return {
    score,
    verdict,
    summary:
      lang === "TR"
        ? "Yapılandırılmış çıktı eksik olsa da mevcut sinyallere göre CV'nizin işe alım filtresindeki konumu analiz edildi."
        : "Structured output was incomplete, so we analyzed your CV using available signals.",
    keyGap,
    fixes,
    impactProjection,
  };
}

function buildFailSafeV2FromFallback(fb, cvText, jobDescription, lang) {
  const verdictRaw = fb.verdict === "Stop" ? "do_not_apply" : "apply_with_fixes";
  const topKeywordSeed = String(jobDescription || "")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/i)
    .filter((w) => w.length >= 4)
    .slice(0, 6);
  const missingKeywords = topKeywordSeed.length ? topKeywordSeed.slice(0, 4) : ["impact", "metrics", "tools", "ownership"];

  return {
    score: fb.score,
    verdict: fb.verdict,
    keyGap: fb.keyGap,
    fixes: fb.fixes,
    "Final Alignment Score": fb.score,
    Decision: {
      final_verdict: verdictRaw,
      reasoning: fb.summary,
      confidence: 0.71,
      what_to_fix_first: [fb.fixes[0], fb.fixes[1]].filter(Boolean),
      action_plan: [fb.fixes[0], fb.fixes[1]].filter(Boolean).join("\n"),
    },
    Gaps: {
      biggest_gap: fb.keyGap,
      rejection_reasons: [{ issue: fb.keyGap, impact: "high", explanation: fb.summary }],
    },
    ATS: {
      matched_skills: ["Communication"],
      missing_keywords: missingKeywords,
      top_keywords: missingKeywords.slice(0, 3),
      keyword_match: Math.max(25, Math.min(75, fb.score - 8)),
      ats_score: Math.max(25, Math.min(75, fb.score - 5)),
      formatting_score: Math.max(40, Math.min(85, fb.score + 8)),
    },
    Recruiter: {
      reasoning: fb.summary,
      strengths: [lang === "TR" ? "Temel deneyim sinyali var" : "Foundational experience signal is present"],
      weaknesses: [fb.keyGap],
    },
    RoleFit: {
      locked: false,
      best_role: lang === "TR" ? "Hedef rol (yakın eşleşme)" : "Target role (near match)",
      role_fit: [{ role: lang === "TR" ? "Hedef rol" : "Target role", score: fb.score }],
    },
    Context: { sector: "general" },
    FailSafe: true,
    impactProjection: fb.impactProjection,
    _source: { cvLen: String(cvText || "").length, jdLen: String(jobDescription || "").length },
  };
}

function ensureFailSafeV2(rawV2, cvText, jobDescription, lang) {
  const baseScore = Number(rawV2?.["Final Alignment Score"]);
  const hasCore =
    Number.isFinite(baseScore) &&
    String(rawV2?.Decision?.final_verdict || "").trim() &&
    (Array.isArray(rawV2?.Gaps?.rejection_reasons) && rawV2.Gaps.rejection_reasons.length > 0);
  if (hasCore) {
    const score = Number(rawV2?.["Final Alignment Score"]);
    const keyGap = String(rawV2?.Gaps?.biggest_gap || rawV2?.Gaps?.rejection_reasons?.[0]?.issue || "").trim();
    const verdict =
      String(rawV2?.Decision?.final_verdict || "").toLowerCase() === "do_not_apply"
        ? "Stop"
        : "Improve";
    const fixes = Array.isArray(rawV2?.Decision?.what_to_fix_first) && rawV2.Decision.what_to_fix_first.length
      ? rawV2.Decision.what_to_fix_first.slice(0, 2)
      : getFallbackAnalysis(cvText, jobDescription, lang).fixes;
    const fb = getFallbackAnalysis(cvText, jobDescription, lang);
    const safeAts = {
      ...(rawV2?.ATS || {}),
      matched_skills:
        Array.isArray(rawV2?.ATS?.matched_skills) && rawV2.ATS.matched_skills.length
          ? rawV2.ATS.matched_skills
          : ["Communication"],
      missing_keywords:
        Array.isArray(rawV2?.ATS?.missing_keywords) && rawV2.ATS.missing_keywords.length
          ? rawV2.ATS.missing_keywords
          : buildFailSafeV2FromFallback(fb, cvText, jobDescription, lang).ATS.missing_keywords,
      top_keywords:
        Array.isArray(rawV2?.ATS?.top_keywords) && rawV2.ATS.top_keywords.length
          ? rawV2.ATS.top_keywords
          : buildFailSafeV2FromFallback(fb, cvText, jobDescription, lang).ATS.top_keywords,
    };
    return {
      ...rawV2,
      ATS: safeAts,
      score: Number.isFinite(score) ? score : fb.score,
      verdict,
      keyGap: keyGap || fb.keyGap,
      fixes,
      impactProjection:
        rawV2?.impactProjection || fb.impactProjection,
    };
  }

  const fb = getFallbackAnalysis(cvText, jobDescription, lang);
  return buildFailSafeV2FromFallback(fb, cvText, jobDescription, lang);
}

/**
 * Deterministic score lift (5–20) from prioritized gaps / missing signals — not random.
 */
function computeImpactProjection(currentScore, ctx, lang) {
  const cur = Math.min(100, Math.max(0, Math.round(Number(currentScore) || 0)));
  const gaps = Array.isArray(ctx.gaps) ? ctx.gaps : [];
  const high = gaps.filter((g) => String(g.impact || "").toLowerCase() === "high");
  const med = gaps.filter((g) => String(g.impact || "").toLowerCase() === "medium");

  const topHigh = Math.min(2, high.length);
  const topMed = Math.min(Math.max(0, 2 - topHigh), med.length);
  const gapPair = topHigh + topMed;

  const mk = (ctx.missingKeywords || []).length;
  const ms = (ctx.missingSkills || []).length;
  const improvements = Array.isArray(ctx.improvements) ? ctx.improvements.length : 0;
  const rH = Array.isArray(ctx.rejectionHigh) ? ctx.rejectionHigh.length : 0;
  const rM = Array.isArray(ctx.rejectionMedium) ? ctx.rejectionMedium.length : 0;

  let delta =
    topHigh * 5 +
    topMed * 4 +
    Math.min(6, Math.ceil(mk / 4) * 2) +
    Math.min(8, Math.ceil(ms / 2) * 2) +
    (improvements >= 3 ? 5 : improvements >= 2 ? 4 : improvements >= 1 ? 3 : 0) +
    Math.min(6, rH * 2) +
    Math.min(3, rM);

  delta = Math.round(delta);
  const hasSignal = gapPair > 0 || mk > 0 || ms > 0 || improvements > 0 || rH > 0 || rM > 0;

  if (!hasSignal) {
    if (cur >= 93) return null;
    delta = Math.min(15, Math.max(5, Math.round((100 - cur) * 0.28)));
  } else {
    delta = Math.max(5, Math.min(20, delta));
  }

  const projected = Math.min(100, cur + delta);
  if (projected <= cur) return null;

  const topN = Math.min(2, Math.max(1, gapPair || (ms >= 2 ? 2 : ms === 1 || rH >= 1 ? 1 : mk >= 6 ? 2 : 1)));

  const narrative =
    lang === "TR"
      ? `Üst ${topN} boşluğu kapatırsan skorun ${cur} → ${projected} (+${delta}) seviyesine çıkabilir.`
      : `By fixing the top ${topN} gap${topN > 1 ? "s" : ""}, your score can increase from ${cur} → ${projected} (+${delta}).`;

  return { current: cur, projected, delta, narrative, topN };
}

/** Rejection risk derived from alignment score (not AI-detection score) — avoids “low score + high AI %” confusion. */
function getRejectionRiskFromAlignmentScore(rawScore, lang) {
  const s = Math.min(100, Math.max(0, Math.round(Number(rawScore) || 0)));
  let tier;
  let pct;
  if (s < 60) {
    tier = "high";
    pct = Math.min(90, Math.max(65, Math.round(68 + (60 - s) * 0.55)));
  } else if (s < 75) {
    tier = "medium";
    pct = Math.min(55, Math.max(30, Math.round(40 + (75 - s) * 0.65)));
  } else {
    tier = "low";
    pct = Math.max(8, Math.min(28, Math.round(28 - (s - 75) * 0.85)));
  }

  const color = tier === "high" ? RS.red : tier === "medium" ? RS.amber : RS.green;
  const bg = tier === "high" ? rsAlpha(RS.red, 0.08) : tier === "medium" ? rsAlpha(RS.amber, 0.08) : rsAlpha(RS.green, 0.08);
  const border = tier === "high" ? rsAlpha(RS.red, 0.22) : tier === "medium" ? rsAlpha(RS.amber, 0.22) : rsAlpha(RS.green, 0.22);
  const levelWordTr = tier === "high" ? "Yüksek" : tier === "medium" ? "Orta" : "Düşük";
  const levelWordEn = tier === "high" ? "High" : tier === "medium" ? "Medium" : "Low";

  if (lang === "TR") {
    const main =
      tier === "high"
        ? `Yüksek (${pct}% elenme riski)`
        : tier === "medium"
          ? `Orta (${pct}% elenme riski)`
          : `Düşük (${pct}% elenme riski)`;
    const sub =
      tier === "high"
        ? "Bu ilan için ilk turda çoğu recruiter bu CV'yi ilerletmez."
        : tier === "medium"
          ? "Mülakat alabilirsin; ama varsayılan ‘evet’ adayı henüz sen değilsin."
          : "Uyum sinyali güçlü — elenme riski anlamlı şekilde düşük.";
    return {
      tier,
      pct,
      title: "ELENME RİSKİ",
      mainLine: main,
      sub,
      color,
      bg,
      border,
      levelWord: levelWordTr,
      metricsLine: `${levelWordTr} — ${pct}%`,
    };
  }

  const main =
    tier === "high"
      ? `High (${pct}% rejection risk)`
      : tier === "medium"
        ? `Medium (${pct}% rejection risk)`
        : `Low (${pct}% rejection risk)`;
  const sub =
    tier === "high"
      ? "For this posting, most recruiters would not move this CV past the first screen."
      : tier === "medium"
        ? "You might still get interviews — you are not the default hire yet."
        : "Strong enough fit signal that first-round rejection risk drops meaningfully.";

  return {
    tier,
    pct,
    title: "REJECTION RISK",
    mainLine: main,
    sub,
    color,
    bg,
    border,
    levelWord: levelWordEn,
    metricsLine: `${levelWordEn} — ${pct}%`,
  };
}

function RejectionRiskPanel({ score, lang }) {
  const risk = getRejectionRiskFromAlignmentScore(score, lang);
  return (
    <div style={{ marginBottom: 16, padding: "14px 16px", background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: risk.color, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{risk.title}</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: risk.color, marginBottom: 6 }}>{risk.mainLine}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>{risk.sub}</div>
    </div>
  );
}

function CriticalSkillsGapBlock({ skills, lang }) {
  const list = (skills || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 10);
  const n = list.length;
  if (n === 0) {
    return (
      <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 17, color: "#a3a3a3", lineHeight: 1.55, marginBottom: 14 }}>
        {lang === "TR"
          ? "İlanla net örtüşen eksik beceri listesi çıkmadı. CV'ni ilanın diline ve araçlarına göre yeniden tarayın."
          : "We could not surface a concrete missing-skill list. Re-scan your CV against the job’s tools and must-haves."}
      </div>
    );
  }
  return (
    <>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, fontWeight: 700, color: "#e8e8e8", marginBottom: 12, lineHeight: 1.35 }}>
        {lang === "TR"
          ? `Bu rol için ${n} kritik beceride eksik görünüyorsun — recruiter bunları arıyor:`
          : `You are missing ${n} critical skills recruiters expect for this role:`}
      </div>
      <ul style={{ margin: "0 0 16px", paddingLeft: 18, color: "#c4c4c4", fontSize: 14, lineHeight: 1.75 }}>
        {list.map((sk, i) => (
          <li key={i} style={{ marginBottom: 4 }}>{sk}</li>
        ))}
      </ul>
      <div style={{ fontSize: 12, color: "#7a7a7a", lineHeight: 1.5, marginBottom: 8 }}>
        {lang === "TR"
          ? "Yüzde yerine net liste: önce bunları kanıtla veya öğren — sonra başvur."
          : "Skip abstract gaps — close these with proof or training, then apply."}
      </div>
    </>
  );
}

function ImpactProjectionPanel({ projection, lang }) {
  if (!projection) return null;
  const t = translations[lang];
  const { current, projected, delta, narrative } = projection;
  return (
    <div
      style={{
        marginTop: 18,
        padding: "22px 22px",
        borderRadius: 18,
        border: "1px solid rgba(52,211,153,0.4)",
        background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(59,130,246,0.1), rgba(212,175,55,0.08))",
        boxShadow: "0 0 40px rgba(52,211,153,0.16)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <TrendingUp size={20} color="#34d399" />
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", color: "#6ee7b7" }}>{t.impactProjection}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#fef08a", marginBottom: 8, letterSpacing: "-0.01em" }}>
        {t.impactFixUnlock.replace("{pts}", String(delta))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginBottom: 14, lineHeight: 1.5 }}>{t.impactMovesCloser.replace("{pts}", String(delta))}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#a7f3d0", letterSpacing: "0.08em", marginBottom: 10 }}>{t.nowAfter}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.currentScore}</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 38, fontWeight: 800, color: "#fca5a5" }}>{current}</div>
        </div>
        <motion.div
          animate={{ x: [0, 6, 0], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ fontSize: 28, color: "#94a3b8", fontWeight: 300, padding: "0 6px" }}
        >
          →
        </motion.div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.projectedScore}</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 38, fontWeight: 800, color: "#6ee7b7" }}>{projected}</div>
        </div>
        <div
          style={{
            padding: "12px 20px",
            borderRadius: 999,
            background: "linear-gradient(90deg, #d4af37, #f0d060)",
            color: "#0a0a0a",
            fontWeight: 900,
            fontSize: 17,
            boxShadow: "0 4px 24px rgba(212,175,55,0.45)",
          }}
        >
          +{delta}
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{t.scoreIncrease}</div>
      <p style={{ margin: 0, fontSize: 14, color: "#e2e8f0", lineHeight: 1.65, fontWeight: 600 }}>{narrative}</p>
    </div>
  );
}

function isUiTurkish(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

function getScoreFinalVerdict(score, lang) {
  const tr = isUiTurkish(lang);
  const tk = translations[tr ? "TR" : "EN"];
  const s = Number(score);
  if (Number.isNaN(s)) {
    return {
      icon: "—",
      verdictIcon: "—",
      verdictColor: RS.textMuted,
      title: tr ? "Skor bekleniyor" : "Score pending",
      explanation:
        tr
          ? "Analiz bitince net karar burada görünecek."
          : "Complete an analysis to see your verdict.",
      shareLabel: tr ? "Beklemede" : "Pending",
      border: rsAlpha(RS.textMuted, 0.35),
      bg: rsAlpha(RS.textMuted, 0.08),
    };
  }
  if (s < 60) {
    return {
      icon: "✕",
      verdictIcon: "🚫",
      verdictColor: RS.red,
      title: tk.verdictBadTitle,
      explanation: tk.verdictBadSub,
      shareLabel: tk.verdictBadTitle,
      border: rsAlpha(RS.red, 0.5),
      bg: rsAlpha(RS.red, 0.14),
    };
  }
  if (s < 75) {
    return {
      icon: "⚠",
      verdictIcon: "⚠️",
      verdictColor: RS.amber,
      title: tk.verdictRiskyTitle,
      explanation: tk.verdictRiskySub,
      shareLabel: tk.verdictRiskyTitle,
      border: rsAlpha(RS.amber, 0.5),
      bg: rsAlpha(RS.amber, 0.12),
    };
  }
  if (s < 85) {
    return {
      icon: "✓",
      verdictIcon: "⚡",
      verdictColor: RS.green,
      title: tk.verdictCloseTitle,
      explanation: tk.verdictCloseSub,
      shareLabel: tk.verdictCloseTitle,
      border: rsAlpha(RS.green, 0.45),
      bg: rsAlpha(RS.green, 0.1),
    };
  }
  return {
    icon: "✓",
    verdictIcon: "✅",
    verdictColor: RS.green,
    title: tk.verdictStrongTitle,
    explanation: tk.verdictStrongSub,
    shareLabel: tk.verdictStrongTitle,
    border: rsAlpha(RS.green, 0.5),
    bg: rsAlpha(RS.green, 0.14),
  };
}

function mapDecisionLabel(decision, lang) {
  const tr = isUiTurkish(lang);
  const raw = String(decision || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "do_not_apply" || raw === "başvurma" || raw === "basvurma") {
    return tr ? "Başvurma" : "Application not recommended";
  }
  if (raw === "apply_with_risk") return tr ? "Riskli başvuru" : "Apply with risk";
  if (raw === "apply_now") return tr ? "Başvur" : "Apply now";
  if (/do\s*not\s*apply/i.test(String(decision || ""))) {
    return tr ? "Başvurma" : "Application not recommended";
  }
  return String(decision || "");
}

/** If API/UI ever passes English verdict strings while UI is Turkish, normalize for share copy */
function normalizeShareVerdictLabel(verdictLabel, lang) {
  const tr = isUiTurkish(lang);
  if (!tr) return String(verdictLabel || "").trim();
  const s = String(verdictLabel || "").trim();
  if (!s) return s;
  if (/application\s+not\s+recommended/i.test(s)) return "Başvurma";
  if (/you will likely get rejected/i.test(s)) return "🚫 Büyük ihtimalle elenirsin";
  if (/strong match/i.test(s)) return "✅ Güçlü eşleşme";
  if (/competitive.*tighten/i.test(s) || /tighten proof/i.test(s)) return "⚡ Rekabetçi — kanıtı sıkılaştır";
  if (/^do\s*not\s*apply$/i.test(s)) return "Başvurma";
  if (/risky\s*apply/i.test(s)) return "Riskli başvuru";
  if (/apply\s+with\s+(fixes|risk)/i.test(s)) return s.toLowerCase().includes("risk") ? "Riskli başvuru" : "Düzeltmelerle başvur";
  if (/^strong\s*apply$/i.test(s) || /strong\s+candidate/i.test(s)) return "Güçlü başvuru";
  if (/^apply\s*now$/i.test(s)) return "Başvur";
  return s;
}

function scoreHeroLines(scoreRounded, lang) {
  const tk = translations[isUiTurkish(lang) ? "TR" : "EN"];
  if (!Number.isFinite(scoreRounded)) return null;
  if (scoreRounded < 60) {
    return { big: tk.heroStopBig, line1: tk.heroStopLine1, line2: tk.heroStopLine2 };
  }
  if (scoreRounded < 75) {
    return { big: tk.heroRiskBig, line1: tk.heroRiskLine1, line2: tk.heroRiskLine2 };
  }
  if (scoreRounded < 85) {
    return { big: tk.heroCloseBig, line1: tk.heroCloseLine1, line2: tk.heroCloseLine2 };
  }
  return { big: tk.heroStrongBig, line1: tk.heroStrongLine1, line2: tk.heroStrongLine2 };
}

function scoreInsightBlock(scoreRounded, lang) {
  const tk = translations[isUiTurkish(lang) ? "TR" : "EN"];
  if (!Number.isFinite(scoreRounded)) return { main: "", bench: "" };
  if (scoreRounded < 60) return { main: tk.scoreInsightLow, bench: tk.scoreInsightBench };
  if (scoreRounded < 75) return { main: tk.scoreInsightMid, bench: tk.scoreInsightBench };
  return { main: tk.scoreInsightHigh, bench: tk.scoreInsightBench };
}

function stepCtaFromText(step, lang) {
  const tk = translations[isUiTurkish(lang) ? "TR" : "EN"];
  const s = String(step || "");
  const url = s.match(/https?:\/\/[^\s)\]}>]+/i)?.[0] || null;
  if (url) return { label: tk.stepCtaOpenLink, href: url };
  if (/github/i.test(s)) return { label: tk.stepCtaGithub, href: null };
  if (/apply|annotation|başvur|işe|job/i.test(s)) return { label: tk.stepCtaApply, href: null };
  return { label: lang === "TR" ? "Start mission →" : "Start mission →", href: null };
}

function useScore(targetScore) {
  const [animatedScore, setAnimatedScore] = useState(
    targetScore != null && Number.isFinite(Number(targetScore)) ? Math.round(Number(targetScore)) : null,
  );
  const [floatingFeedback, setFloatingFeedback] = useState(null);
  useEffect(() => {
    if (targetScore == null || !Number.isFinite(Number(targetScore))) {
      setAnimatedScore(null);
      return undefined;
    }
    const from = animatedScore == null || !Number.isFinite(Number(animatedScore)) ? Number(targetScore) : Number(animatedScore);
    const to = Number(targetScore);
    if (Math.round(from) === Math.round(to)) {
      setAnimatedScore(Math.round(to));
      return undefined;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 520;
    const tick = (now) => {
      const u = Math.min(1, (now - t0) / dur);
      const ease = 1 - (1 - u) ** 2;
      setAnimatedScore(Math.round(from + (to - from) * ease));
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [targetScore]);

  useEffect(() => {
    if (!floatingFeedback) return undefined;
    const id = window.setTimeout(() => setFloatingFeedback(null), 1700);
    return () => window.clearTimeout(id);
  }, [floatingFeedback]);

  return { animatedScore, floatingFeedback, setFloatingFeedback };
}

function useLevel(score) {
  const levels = [
    { id: 1, min: 0, max: 20, title: "Lost Candidate" },
    { id: 2, min: 20, max: 40, title: "Direction Found" },
    { id: 3, min: 40, max: 60, title: "Structured Thinker" },
    { id: 4, min: 60, max: 80, title: "Market Ready" },
    { id: 5, min: 80, max: 100, title: "Interview Ready" },
  ];
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const current = levels.find((lvl, idx) => s >= lvl.min && (idx === levels.length - 1 || s < lvl.max)) || levels[0];
  const next = levels.find((lvl) => lvl.id === current.id + 1) || null;
  const pct = next
    ? Math.max(0, Math.min(100, Math.round(((s - current.min) / (next.min - current.min)) * 100)))
    : 100;
  return { currentLevel: current, nextLevel: next, progressToNext: pct };
}

function useStreak(seedKey, activityTick) {
  const [streakCount, setStreakCount] = useState(0);
  useEffect(() => {
    const key = `hirefit-streak-${seedKey || "global"}`;
    const today = new Date().toISOString().slice(0, 10);
    const dayMs = 24 * 60 * 60 * 1000;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : { count: 0, lastDate: "" };
      const last = parsed.lastDate ? new Date(parsed.lastDate).getTime() : null;
      const now = new Date(today).getTime();
      let nextCount = Number(parsed.count) || 0;
      if (!last) nextCount = 1;
      else if (now - last >= dayMs * 2) nextCount = 1;
      else if (parsed.lastDate !== today) nextCount += 1;
      localStorage.setItem(key, JSON.stringify({ count: nextCount, lastDate: today }));
      setStreakCount(nextCount);
    } catch {
      setStreakCount(1);
    }
  }, [seedKey, activityTick]);
  return { streakCount };
}

function useTasks(seedKey, lang, planFixes) {
  const [task, setTask] = useState(null);
  useEffect(() => {
    const key = `hirefit-daily-task-${seedKey || "global"}`;
    const today = new Date().toISOString().slice(0, 10);
    const pool = [
      { title: lang === "TR" ? "CV'ye ölçülebilir sonuç ekle" : "Add measurable results to your CV", reward: 8 },
      { title: lang === "TR" ? "Araçları netleştir (Excel, SQL vb.)" : "Add tools clearly (Excel, SQL, etc.)", reward: 6 },
      { title: lang === "TR" ? "Rol hedeflemeyi düzelt" : "Fix role targeting", reward: 10 },
      { title: lang === "TR" ? "Mini proje inşa et" : "Build a mini project", reward: 12 },
      { title: lang === "TR" ? "Kanıt yükle" : "Upload proof", reward: 7 },
    ];
    const fromFix = planFixes.find((f) => !f.done);
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.date === today && parsed?.task) {
        setTask(parsed.task);
        return;
      }
      const fallback = pool[Math.floor(Math.random() * pool.length)];
      const next = fromFix
        ? {
            title: String(fromFix.issue || fallback.title),
            reward: Math.max(4, Math.min(18, Math.round(Number(fromFix.score_impact) || fallback.reward))),
            done: false,
          }
        : { ...fallback, done: false };
      const payload = { date: today, task: next };
      localStorage.setItem(key, JSON.stringify(payload));
      setTask(next);
    } catch {
      setTask({ ...pool[0], done: false });
    }
  }, [seedKey, lang, JSON.stringify(planFixes.map((f) => ({ issue: f.issue, score_impact: f.score_impact, done: !!f.done })))]);

  const completeTask = () => {
    if (!task || task.done) return 0;
    const next = { ...task, done: true };
    setTask(next);
    try {
      const key = `hirefit-daily-task-${seedKey || "global"}`;
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(key, JSON.stringify({ date: today, task: next }));
    } catch {
      // ignore
    }
    return Math.max(1, Number(task.reward) || 0);
  };

  return { dailyTask: task, completeTask };
}

function ResultsBulletRow({ sentiment, children }) {
  const dot =
    sentiment === "positive"
      ? RS.green
      : sentiment === "warning"
        ? RS.amber
        : sentiment === "negative"
          ? RS.red
          : RS.indigo;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 14 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0, marginTop: 8 }} />
      <div style={{ fontSize: 14, color: RS.textSecondary, lineHeight: 1.6, fontFamily: RS.fontUi }}>{children}</div>
    </div>
  );
}

function ProBlurGate({ active, onUpgrade, children, unlockLabel }) {
  if (!active) return children;
  return (
    <div style={{ position: "relative", minHeight: 72 }}>
      <div style={{ filter: "blur(4px)", pointerEvents: "none", userSelect: "none" }}>{children}</div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          onClick={onUpgrade}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: RS.indigo,
            color: RS.textPrimary,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: RS.fontUi,
          }}
        >
          {unlockLabel}
        </button>
      </div>
    </div>
  );
}

function getConfidenceTierLabel(confidence, lang) {
  const n = Number(confidence);
  if (!Number.isFinite(n)) return null;
  if (n >= 85) return { label: lang === "TR" ? "Yüksek Güven" : "High Confidence", color: RS.green, tier: "high" };
  if (n >= 65) return { label: lang === "TR" ? "Orta Güven" : "Medium Confidence", color: RS.amber, tier: "medium" };
  return { label: lang === "TR" ? "Düşük Güven" : "Low Confidence", color: RS.textMuted, tier: "low" };
}

function buildShareResultText({ score, verdictLabel, biggestMistake, lang }) {
  const tr = isUiTurkish(lang);
  const v = normalizeShareVerdictLabel(verdictLabel, lang);
  const mistake = (biggestMistake && String(biggestMistake).trim()) || (tr ? "Belirtilmedi" : "Not specified");
  return tr
    ? `CV'mi HireFit'ten geçirdim.

Skor: ${score}
Karar: ${v}
Kritik boşluk: ${mistake}

Başvurmadan önce denemeye değer.
→ hirefit.ai`
    : `Just ran my CV through HireFit.

Score: ${score}
Verdict: ${v}
Key gap: ${mistake}

Worth trying before you apply.
→ hirefit.ai`;
}

function buildLinkedInShareUrl(shareText) {
  const text = String(shareText || "").trim();
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

function countCvSections(cvText) {
  const t = String(cvText || "").toLowerCase();
  let n = 0;
  if (/experience|employment|work history|professional|iş deneyimi|deneyim|tecrübe|çalışma/i.test(t)) n++;
  if (/education|university|academic|degree|üniversite|eğitim/i.test(t)) n++;
  if (/skill|competenc|yetenek|beceri|technologies|tech stack/i.test(t)) n++;
  if (/summary|profile|objective|about me|öz|profil|hakkımda/i.test(t)) n++;
  if (/project|portfolio/i.test(t)) n++;
  return n;
}

const HF_HERO_WORD_DELAY_MS = 80;
const HF_HERO_WORD_REVEAL_MS = 420;

function HeroStaggeredHeadline({ lang }) {
  const line1 =
    lang === "TR"
      ? "CV'n neden reddediliyor?".split(/\s+/).filter(Boolean)
      : "Why does your CV get rejected?".split(/\s+/).filter(Boolean);
  const line2 =
    lang === "TR"
      ? "Artık bileceksin.".split(/\s+/).filter(Boolean)
      : "Now you'll know.".split(/\s+/).filter(Boolean);
  const totalWords = line1.length + line2.length;
  const pulseDelayMs = (totalWords - 1) * HF_HERO_WORD_DELAY_MS + HF_HERO_WORD_REVEAL_MS;

  return (
    <>
      {line1.map((w, i) => (
        <span key={`h1-${i}`} className="hf-hero-word" style={{ animationDelay: `${i * HF_HERO_WORD_DELAY_MS}ms` }}>
          {w}
        </span>
      ))}
      <br />
      <span className="hf-hero-line2-wrap" style={{ ["--hf-hero-pulse-delay"]: `${pulseDelayMs}ms` }}>
        {line2.map((w, j) => {
          const idx = line1.length + j;
          return (
            <span key={`h2-${j}`} className="hf-hero-word" style={{ animationDelay: `${idx * HF_HERO_WORD_DELAY_MS}ms` }}>
              {w}
            </span>
          );
        })}
      </span>
    </>
  );
}

function AnimatedAlignmentScore({ alignmentScore, fontSize = "clamp(48px, 11vw, 88px)" }) {
  const [n, setN] = useState(0);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (alignmentScore == null) return;
    const tgt = Math.min(100, Math.max(0, Math.round(Number(alignmentScore) || 0)));
    let cancelled = false;
    setN(0);
    setPop(false);
    let start = null;
    let raf = 0;
    const duration = 1200;
    const easeOut = (t) => 1 - (1 - t) * (1 - t);
    const tick = (now) => {
      if (cancelled) return;
      if (start == null) start = now;
      const p = Math.min(1, (now - start) / duration);
      setN(Math.round(easeOut(p) * tgt));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setN(tgt);
        setPop(true);
        window.setTimeout(() => {
          if (!cancelled) setPop(false);
        }, 320);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [alignmentScore]);

  const color = n <= 40 ? "#ef4444" : n <= 69 ? "#f97316" : "#22c55e";

  return (
    <span
      className={`hf-score-animated${pop ? " hf-score-animated--pop" : ""}`}
      style={{ fontFamily: "'Syne', sans-serif", fontSize, fontWeight: 800, color, lineHeight: 1 }}
    >
      {n}
    </span>
  );
}

function AiLivePipelinePanel({ lang, loading, hasOutput, cvReady, jdReady, extractingJob }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!loading) {
      setStep(0);
      return;
    }
    setStep(0);
    const id = window.setInterval(() => setStep((s) => Math.min(3, s + 1)), 880);
    return () => window.clearInterval(id);
  }, [loading]);

  const steps =
    lang === "TR"
      ? [
          { key: "match", label: "CV ile ilan eşleştiriliyor..." },
          { key: "kw", label: "Anahtar kelimeler çıkarılıyor..." },
          { key: "rec", label: "Recruiter simülasyonu çalışıyor..." },
          { key: "dec", label: "Karar üretiliyor..." },
        ]
      : [
          { key: "match", label: "Matching CV with JD..." },
          { key: "kw", label: "Extracting keywords..." },
          { key: "rec", label: "Simulating recruiter..." },
          { key: "dec", label: "Generating decision..." },
        ];

  const idleTitle = lang === "TR" ? "Canlı analiz hattı" : "Live analysis pipeline";
  const idleSub =
    extractingJob
      ? lang === "TR"
        ? "İlan detayları linkten çekiliyor..."
        : "Extracting job details from link..."
      : !(cvReady && jdReady)
        ? lang === "TR"
          ? "CV ve iş ilanını ekleyerek motoru aktive et."
          : "Add your CV and job description to activate the engine."
        : lang === "TR"
          ? "Girdiler hazır. Analizi başlatabilirsin."
          : "Inputs ready. Start analysis when you are.";

  return (
    <div className={`hf-ai-pipeline ${loading ? "hf-ai-pipeline--running" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(99,102,241,0.2)", border: "1px solid rgba(129,140,248,0.35)" }}>
          <Cpu size={18} color="#c4b5fd" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9" }}>{idleTitle}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{idleSub}</div>
        </div>
      </div>

      {loading ? (
        <div className="hf-output-loading-bar" style={{ marginBottom: 14 }}>
          <motion.div className="hf-output-loading-progress" animate={{ x: ["-100%", "220%"] }} transition={{ repeat: Infinity, duration: 1.25, ease: "linear" }} />
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s, i) => {
          const done = hasOutput && !loading ? true : loading && step > i;
          const active = loading && step === i;
          const pending = !loading && !hasOutput && !done;
          return (
            <div
              key={`${s.key}-${done ? "1" : "0"}`}
              className={`hf-ai-pipeline-step${done ? " hf-ai-pipeline-step--done" : ""}${active ? " hf-ai-pipeline-step--active" : ""}${pending ? " hf-ai-pipeline-step--pending" : ""}`}
            >
              <div style={{ width: 22, height: 22, display: "grid", placeItems: "center" }}>
                {done ? (
                  <span className="hf-pipeline-check">
                    <CheckCircle2 size={16} color="#34d399" />
                  </span>
                ) : active ? (
                  <Loader2 size={14} color="#a78bfa" style={{ animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(148,163,184,0.35)" }} />
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: done || active ? 700 : 600, color: done ? "#a7f3d0" : active ? "#e9d5ff" : "#64748b" }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {hasOutput && !loading ? (
        <div style={{ marginTop: 12, fontSize: 11, color: "#34d399", fontWeight: 700, textAlign: "center" }}>
          {lang === "TR" ? "✓ Analiz tamamlandı — sonuçlar aşağıda" : "✓ Analysis complete — results below"}
        </div>
      ) : null}
    </div>
  );
}

function SharePromptModal({ open, lang, score, verdictLabel, biggestMistake, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const text = buildShareResultText({ score, verdictLabel, biggestMistake, lang });
  const li = buildLinkedInShareUrl(text);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.78)", zIndex: 1200, display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "min(560px, 96vw)", borderRadius: 16, border: "1px solid rgba(99,102,241,0.28)", background: "linear-gradient(160deg,#0b1220,#05070f)", padding: 20 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, color: "#f1f5f9", marginBottom: 8 }}>{lang === "TR" ? "Bu sonuç seni şaşırttı mı?" : "This result surprised you?"}</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>{lang === "TR" ? `Skor: ${score}` : `Score: ${score}`}</div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.6, color: "#cbd5e1", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>{text}</pre>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} }} style={{ flex: 1, minWidth: 120, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontWeight: 700, cursor: "pointer" }}>
            {copied ? (lang === "TR" ? "Kopyalandı!" : "Copied!") : (lang === "TR" ? "Kopyala" : "Copy")}
          </button>
          <a href={li} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 120, textDecoration: "none", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(10,102,194,0.35)", background: "rgba(10,102,194,0.12)", color: "#7dd3fc", fontWeight: 700, textAlign: "center" }}>
            {lang === "TR" ? "LinkedIn'de paylaş" : "Share to LinkedIn"}
          </a>
          <button type="button" onClick={onClose} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>
            {lang === "TR" ? "Kapat" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpandableInsightCard({
  id,
  title,
  subtitle,
  icon,
  openId,
  onToggle,
  children,
}) {
  const isOpen = openId === id;
  return (
    <motion.div
      layout
      className="hf-insight-card"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(15,23,42,0.45)", overflow: "hidden" }}
    >
      <button
        type="button"
        onClick={() => onToggle(isOpen ? null : id)}
        style={{ width: "100%", padding: "14px 14px", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "rgba(99,102,241,0.14)", border: "1px solid rgba(99,102,241,0.3)", color: "#c4b5fd" }}>
          {icon}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0" }}>{title}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{subtitle}</div>
        </div>
        <ChevronRight size={16} color="#94a3b8" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.22s ease" }} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key={`${id}-content`}
            initial={{ height: 0, opacity: 0, y: 10 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 10 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 14px 14px" }}>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                {children}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

const previewGridStyle = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
};

const PREVIEW_FREE_FIRST_MAX = 220;
const PREVIEW_FREE_REST_MAX = 130;

function truncatePreviewForFree(lines) {
  if (!lines.length) return lines;
  const cap = (s, n) => {
    const x = String(s || "").trim();
    if (x.length <= n) return x;
    return `${x.slice(0, n).trimEnd()}…`;
  };
  return [cap(lines[0], PREVIEW_FREE_FIRST_MAX), ...lines.slice(1).map((l) => cap(l, PREVIEW_FREE_REST_MAX))];
}

function gapImpactLabel(g, tr) {
  const lo = String(g?.impact || "").toLowerCase();
  if (lo === "high") return tr.previewImpactHigh;
  if (lo === "medium") return tr.previewImpactMedium;
  if (lo === "low" || g?.impact) return tr.previewImpactLow;
  return "";
}

function explainGapReason(issue, fallback, tr) {
  const raw = String(issue || "").toLowerCase();
  if (raw.includes("degree") || raw.includes("mühendislik") || raw.includes("engineering")) {
    return tr.previewGapWhyDegree;
  }
  if (raw.includes("english") || raw.includes("ingilizce") || raw.includes("language")) {
    return tr.previewGapWhyLanguage;
  }
  if (raw.includes("sector") || raw.includes("domain") || raw.includes("sektör")) {
    return tr.previewGapWhySector;
  }
  if (raw.includes("metric") || raw.includes("quant") || raw.includes("ölç") || raw.includes("impact")) {
    return tr.previewGapWhyImpact;
  }
  if (raw.includes("position") || raw.includes("headline") || raw.includes("positioning") || raw.includes("target")) {
    return tr.previewGapWhyPositioning;
  }
  return String(fallback || "").trim() || tr.previewGapWhyGeneric;
}

/** Lines for all four preview cards — always derived from this run's CV+JD payload. */
function buildV2PreviewLines(data, lang, planFixes, tr) {
  const h = (s) => humanizeUserFacingReason(String(s || "").trim(), lang);
  const reqFromGap = String(data?.Gaps?.biggest_gap || data?.Gaps?.rejection_reasons?.[0]?.issue || "").trim();
  const reqFromRole = String(data?.RoleFit?.best_role || data?.RoleFit?.role_fit?.[0]?.role || "").trim();
  const reqFromKeywords = Array.isArray(data?.ATS?.missing_keywords) && data.ATS.missing_keywords[0]
    ? String(data.ATS.missing_keywords[0]).trim()
    : "";
  const requirementSignal = reqFromGap || reqFromRole || reqFromKeywords || tr.previewFallbackRequirement;
  const cvRealityRaw =
    String(data?.Recruiter?.reasoning || data?.Decision?.reasoning || "")
      .split(/(?<=[.!?])\s+/)
      .map((x) => x.trim())
      .filter(Boolean)[0] || tr.previewFallbackReality;

  const recruiterLines = [h(tr.previewRecruiterDecisionIntro)];
  const strengths = data?.Recruiter?.strengths || [];
  const weaknesses = data?.Recruiter?.weaknesses || [];
  const gapRows = Array.isArray(data?.Gaps?.rejection_reasons) ? data.Gaps.rejection_reasons : [];
  const reasonPool = [];
  for (const g of gapRows.slice(0, 3)) {
    if (g?.issue) reasonPool.push(h(String(g.issue)));
  }
  for (const w of weaknesses.slice(0, 3)) {
    if (w) reasonPool.push(h(String(w)));
  }
  if (Array.isArray(data?.ATS?.missing_keywords)) {
    for (const kw of data.ATS.missing_keywords.slice(0, 2)) {
      if (kw) reasonPool.push(h(tr.previewRecruiterMissingKeyword.replace("{kw}", String(kw))));
    }
  }
  const dedupReasons = Array.from(new Set(reasonPool.map((x) => String(x).trim()).filter(Boolean))).slice(0, 3);
  if (!dedupReasons.length) {
    dedupReasons.push(h(tr.previewRecruiterRealityLine.replace("{reality}", cvRealityRaw)));
    dedupReasons.push(h(tr.previewRecruiterReqLine.replace("{req}", requirementSignal)));
  }
  dedupReasons.forEach((r) => recruiterLines.push(`● ${r}`));

  const roleRowsRaw = Array.isArray(data?.RoleFit?.role_fit) ? data.RoleFit.role_fit : [];
  const sortedRoles = [...roleRowsRaw].sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0));
  const bestRole = String(data?.RoleFit?.best_role || sortedRoles[0]?.role || "").trim();
  const altRoles = sortedRoles
    .filter((r) => String(r?.role || "").trim() && String(r.role).trim() !== bestRole)
    .map((r) => String(r.role).trim())
    .slice(0, 2);
  if (altRoles.length < 2) {
    const matched = Array.isArray(data?.ATS?.matched_skills) ? data.ATS.matched_skills.map((x) => String(x).toLowerCase()) : [];
    const fallbackRoles = matched.some((s) => /sql|excel|tableau|power bi|python|analytics|analysis/.test(s))
      ? [tr.previewFallbackRoleAData, tr.previewFallbackRoleBData]
      : [tr.previewFallbackRoleA, tr.previewFallbackRoleB];
    for (const fr of fallbackRoles) {
      if (altRoles.length >= 2) break;
      if (!altRoles.includes(fr)) altRoles.push(fr);
    }
  }
  recruiterLines.push(h(tr.previewRecruiterAltIntro));
  altRoles.slice(0, 2).forEach((role) => recruiterLines.push(`● ${role}`));

  recruiterLines.push(h(tr.previewRecruiterBecauseIntro));
  const becausePool = [];
  for (const s of strengths.slice(0, 2)) {
    if (s) becausePool.push(h(String(s)));
  }
  for (const m of (data?.ATS?.matched_skills || []).slice(0, 3)) {
    if (m) becausePool.push(h(tr.previewRecruiterBecauseSkill.replace("{skill}", String(m))));
  }
  const becauseRows = Array.from(new Set(becausePool.map((x) => String(x).trim()).filter(Boolean))).slice(0, 3);
  if (!becauseRows.length) becauseRows.push(h(tr.previewFallbackRecruiterFirst));
  becauseRows.forEach((r) => recruiterLines.push(`● ${r}`));

  const gapLines = [];
  for (const g of data?.Gaps?.rejection_reasons || []) {
    const imp = gapImpactLabel(g, tr);
    const issue = h(String(g.issue || "—"));
    const why = h(explainGapReason(issue, g.explanation, tr));
    gapLines.push(`● ${issue}${imp ? ` — ${imp}` : ""}`);
    gapLines.push(why);
  }
  if (!gapLines.length) gapLines.push(h(tr.previewEmptyGapsBrief));

  const rawTasks = [];
  const fixes = planFixes || [];
  fixes.forEach((f) => {
    const issueRaw = String(f.issue || "").toLowerCase();
    if ((issueRaw.includes("degree") || issueRaw.includes("engineering") || issueRaw.includes("mühendislik")) && !rawTasks.includes(h(tr.previewPlanStrategic1))) {
      rawTasks.push(h(tr.previewPlanStrategic1));
      return;
    }
    if ((issueRaw.includes("sector") || issueRaw.includes("domain") || issueRaw.includes("sektör") || issueRaw.includes("position")) && !rawTasks.includes(h(tr.previewPlanStrategic2))) {
      rawTasks.push(h(tr.previewPlanStrategic2));
      return;
    }
    if ((issueRaw.includes("metric") || issueRaw.includes("quant") || issueRaw.includes("impact") || issueRaw.includes("ölç")) && !rawTasks.includes(h(tr.previewPlanStrategic3))) {
      rawTasks.push(h(tr.previewPlanStrategic3));
      return;
    }
    const st = f.steps?.[0];
    const line = st && String(st).trim() ? String(st).trim() : String(f.issue || "").trim();
    if (line && rawTasks.length < 6) rawTasks.push(h(line));
  });
  const strategicFallbacks = [
    tr.previewPlanStrategic1,
    tr.previewPlanStrategic2,
    tr.previewPlanStrategic3,
    tr.previewPlanStrategic4,
    tr.previewPlanStrategic5,
    tr.previewPlanStrategic6,
  ].map((x) => h(x));
  for (const item of strategicFallbacks) {
    if (rawTasks.length >= 3) break;
    const hasSame = rawTasks.some((ln) => ln.toLowerCase() === item.toLowerCase());
    if (!hasSame) rawTasks.push(item);
  }
  const weekTasks = rawTasks.slice(0, 3);
  while (weekTasks.length < 3) weekTasks.push(h(tr.previewPlanStrategic3));
  const impacts = fixes
    .slice(0, 3)
    .map((f) => Math.max(1, Math.min(18, Math.round(Number(f?.score_impact) || 0))))
    .filter((n) => Number.isFinite(n));
  const impactPoints = impacts.length ? impacts.reduce((a, b) => a + b, 0) : 12;
  const interviewLiftPct = Math.max(8, Math.min(38, impactPoints * 2));
  const planLines = [
    h(tr.previewWeek1Label),
    `- ${weekTasks[0]}`,
    h(tr.previewWeek2Label),
    `- ${weekTasks[1]}`,
    h(tr.previewWeek3Label),
    `- ${weekTasks[2]}`,
    h(tr.previewExpectedImpactLabel),
    h(tr.previewInterviewImpactLine.replace("{x}", String(interviewLiftPct))),
    h(tr.previewProfileStrengthLine.replace("{y}", String(impactPoints))),
  ];

  const ex = data?.CompanyIntel?.extracted || {};
  const companyReport = data?.CompanyIntel?.report || {};
  const companyLine =
    ex.company_name && String(ex.company_name).trim()
      ? `${String(ex.company_name).trim()}${ex.sector_inferred ? ` · ${ex.sector_inferred}` : ""}`
      : ex.sector_inferred
        ? String(ex.sector_inferred)
        : "";
  const sectorPos = String(companyReport?.sector_position || "").trim();
  const valuesLine = sectorPos || tr.previewCompanyValueFallback;
  const mismatchLine = reqFromGap
    ? tr.previewCompanyMismatchLine.replace("{gap}", reqFromGap)
    : tr.previewCompanyMismatchFallback;
  const atsParts = [];
  if (data?.ATS?.ats_score != null) atsParts.push(`${tr.previewAtsScoreShort}: ${data.ATS.ats_score}%`);
  if (data?.ATS?.keyword_match != null) atsParts.push(`${tr.previewKeywordMatchShort}: ${data.ATS.keyword_match}%`);
  const atsLine = atsParts.length ? atsParts.join(" · ") : tr.previewAtsFallback;
  const best = data?.RoleFit?.best_role;
  const roles = roleRowsRaw;
  const careerLine = best || roles[0]?.role
    ? `${tr.previewCareerDirPrefix}: ${best || roles[0]?.role}`
    : tr.previewCareerDirectionFallback;
  const marketLines = [
    companyLine ? tr.previewCompanyFocusLine.replace("{company}", companyLine) : tr.previewCompanyFocusFallback,
    tr.previewCompanyValueLine.replace("{value}", valuesLine),
    mismatchLine,
    tr.previewCompanyDirectionLine.replace("{direction}", careerLine),
    atsLine,
  ].map((x) => String(x || "").trim()).filter(Boolean);
  if (!marketLines.length) marketLines.push(h(tr.previewEmptyMarket));

  return { recruiter: recruiterLines, gaps: gapLines, plan: planLines, market: marketLines };
}

function BlurPreviewCard({ title, lines, cardId, onHoverCard, t, visibleCount = 3 }) {
  const [hover, setHover] = useState(false);
  const bg = RS.bgElevated;
  const visibleLines = lines.slice(0, Math.max(2, visibleCount));
  const restLines = lines.slice(Math.max(2, visibleCount));
  const hiddenCount = restLines.length;
  return (
    <div
      role="presentation"
      onMouseEnter={() => {
        setHover(true);
        onHoverCard?.(cardId);
      }}
      onMouseLeave={() => setHover(false)}
      style={{
        background: bg,
        border: `1px solid ${hover ? rsAlpha(RS.indigo, 0.38) : RS.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        position: "relative",
        overflow: "hidden",
        minHeight: 112,
        transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover ? `0 14px 40px rgba(0,0,0,0.38), 0 0 0 1px ${rsAlpha(RS.indigo, 0.12)}` : "none",
        cursor: "default",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 500, color: RS.textPrimary, marginBottom: 8 }}>{title}</div>
      {visibleLines.map((line, i) => (
        <div key={`v-${i}`} style={{ fontSize: 12, fontWeight: i === 0 ? 500 : 400, color: RS.textSecondary, lineHeight: 1.55, marginBottom: 4 }}>
          {line}
        </div>
      ))}
      {restLines.length > 0 ? (
        <div style={{ position: "relative", marginTop: 2, minHeight: 48 }}>
          <div
            style={{
              filter: "blur(5px)",
              pointerEvents: "none",
              userSelect: "none",
              WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 100%)",
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 100%)",
            }}
          >
            {restLines.map((line, i) => (
              <div key={i} style={{ fontSize: 12, color: RS.textSecondary, lineHeight: 1.55 }}>
                {line}
              </div>
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `linear-gradient(to bottom, ${rsAlpha(bg, 0)} 0%, ${rsAlpha(bg, 0.14)} 32%, ${rsAlpha(bg, 0.92)} 78%, ${bg} 100%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "62%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 2,
              pointerEvents: "none",
            }}
            aria-hidden
          >
            <Lock size={16} color={RS.textMuted} strokeWidth={2} />
          </div>
        </div>
      ) : (
        <div style={{ position: "relative", minHeight: 40, marginTop: 4 }}>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 2,
              pointerEvents: "none",
            }}
            aria-hidden
          >
            <Lock size={16} color={RS.textMuted} strokeWidth={2} />
          </div>
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: RS.textMuted }}>
        {t.previewHiddenCountLine.replace("{n}", String(hiddenCount))}
      </div>
    </div>
  );
}

function CareerEngineProBlurPreview({ data, lang, t, onUpgrade }) {
  const previewLabelStyle = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: RS.textMuted,
    fontFamily: RS.fontUi,
    marginBottom: 14,
  };
  const derivedPlanFixes = useMemo(() => {
    const parsed = enrichActionPlan(parseActionPlan(data?.Decision?.action_plan), {
      lang: lang === "TR" ? "tr" : "en",
      roleFit: data?.RoleFit,
      gaps: data?.Gaps,
      verdict: data?.Decision?.final_verdict,
    });
    let fixes = (parsed?.fixes || []).filter((f) => f.issue || (f.steps && f.steps.length));
    if (!fixes.length && Array.isArray(data?.Decision?.what_to_fix_first)) {
      fixes = data.Decision.what_to_fix_first
        .map((line) => String(line || "").trim())
        .filter(Boolean)
        .map((line) => ({ issue: line, steps: [line] }));
    }
    return fixes;
  }, [data, lang]);
  const L = useMemo(() => buildV2PreviewLines(data, lang, derivedPlanFixes, t), [data, lang, derivedPlanFixes, t]);
  const freeRecruiter = useMemo(() => truncatePreviewForFree(L.recruiter), [L.recruiter]);
  const freeGaps = useMemo(() => truncatePreviewForFree(L.gaps), [L.gaps]);
  const freePlan = useMemo(() => truncatePreviewForFree(L.plan), [L.plan]);
  const freeMarket = useMemo(() => truncatePreviewForFree(L.market), [L.market]);

  useEffect(() => {
    hirefitTrack("v2_preview_section_view", { lang });
  }, [lang]);

  const onHoverCard = useCallback(
    (cardId) => {
      hirefitTrackDebounced(`v2_hover_${cardId}_${lang}`, "v2_preview_card_hover", { card: cardId, lang });
    },
    [lang],
  );

  const onCta = useCallback(() => {
    hirefitTrack("v2_preview_upgrade_cta", { lang, source: "preview_strip" });
    onUpgrade();
  }, [lang, onUpgrade]);
  const recruiterVisibleCount = useMemo(() => {
    const idx = freeRecruiter.findIndex((line) => String(line || "").trim() === String(t.previewRecruiterAltIntro || "").trim());
    return idx > 1 ? idx : 4;
  }, [freeRecruiter, t.previewRecruiterAltIntro]);
  const planVisibleCount = useMemo(() => {
    const idx = freePlan.findIndex((line) => String(line || "").trim() === String(t.previewWeek2Label || "").trim());
    return idx > 1 ? idx : 2;
  }, [freePlan, t.previewWeek2Label]);

  return (
    <div style={{ marginTop: 22 }}>
      <div style={previewLabelStyle}>{t.focusPreviewSectionTitle}</div>
      <div
        style={{
          background: rsAlpha(RS.indigo, 0.08),
          border: `1px solid ${rsAlpha(RS.indigo, 0.2)}`,
          borderRadius: 10,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: RS.textPrimary }}>{t.focusPreviewCtaTitle}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: RS.textSecondary, marginTop: 4, lineHeight: 1.5 }}>{t.focusPreviewCtaSubtitle}</div>
        </div>
        <button
          type="button"
          onClick={onCta}
          style={{
            flexShrink: 0,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: RS.indigo,
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: RS.fontUi,
          }}
        >
          {t.focusPreviewUpgradeBtn}
        </button>
      </div>
      <div style={previewGridStyle}>
        <BlurPreviewCard title={t.focusPreviewCardRecruiter} lines={freeRecruiter} cardId="recruiter" onHoverCard={onHoverCard} t={t} visibleCount={recruiterVisibleCount} />
        <BlurPreviewCard title={t.focusPreviewCardGaps} lines={freeGaps} cardId="gaps" onHoverCard={onHoverCard} t={t} visibleCount={3} />
        <BlurPreviewCard title={t.focusPreviewCardPlan} lines={freePlan} cardId="plan" onHoverCard={onHoverCard} t={t} visibleCount={planVisibleCount} />
        <BlurPreviewCard title={t.focusPreviewCardMarket} lines={freeMarket} cardId="market" onHoverCard={onHoverCard} t={t} visibleCount={3} />
      </div>
    </div>
  );
}

function ProDetailCard({ title, children }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="presentation"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: RS.bgElevated,
        border: `1px solid ${hover ? rsAlpha(RS.indigo, 0.35) : RS.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        minHeight: 112,
        transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
        transform: hover ? "translateY(-2px)" : "none",
        boxShadow: hover ? `0 12px 32px rgba(0,0,0,0.32)` : "none",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 500, color: RS.textPrimary, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12, color: RS.textSecondary, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function CareerEngineProDetailGrid({ data, lang, t, planFixes }) {
  const previewLabelStyle = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: RS.textMuted,
    fontFamily: RS.fontUi,
    marginBottom: 14,
  };
  const L = useMemo(() => buildV2PreviewLines(data, lang, planFixes, t), [data, lang, planFixes, t]);

  useEffect(() => {
    hirefitTrack("v2_pro_detail_section_view", { lang });
  }, [lang]);

  return (
    <div style={{ marginTop: 22 }}>
      <div style={previewLabelStyle}>{t.focusProDetailTitle}</div>
      <div style={previewGridStyle}>
        <ProDetailCard title={t.focusPreviewCardRecruiter}>
          {L.recruiter.map((line, i) => (
            <div key={i} style={{ marginBottom: i < L.recruiter.length - 1 ? 6 : 0 }}>
              {line}
            </div>
          ))}
        </ProDetailCard>
        <ProDetailCard title={t.focusPreviewCardGaps}>
          {L.gaps.map((line, i) => (
            <div key={i} style={{ marginBottom: i < L.gaps.length - 1 ? 6 : 0 }}>
              {line}
            </div>
          ))}
        </ProDetailCard>
        <ProDetailCard title={t.focusPreviewCardPlan}>
          {L.plan.map((line, i) => (
            <div key={i} style={{ marginBottom: i < L.plan.length - 1 ? 6 : 0 }}>
              {line}
            </div>
          ))}
        </ProDetailCard>
        <ProDetailCard title={t.focusPreviewCardMarket}>
          {L.market.map((line, i) => (
            <div key={i} style={{ marginBottom: i < L.market.length - 1 ? 8 : 0 }}>
              {line}
            </div>
          ))}
        </ProDetailCard>
      </div>
    </div>
  );
}

function inferCandidateBackground(cvText, lang) {
  const src = String(cvText || "").toLowerCase();
  if (!src) return lang === "TR" ? "genel profil" : "general profile";
  const hasMis = src.includes("management information systems") || src.includes("yönetim bilişim");
  const hasIndustrial = src.includes("industrial") || src.includes("endüstri");
  const hasBusiness = src.includes("business") || src.includes("işletme");
  const hasEngineering = src.includes("engineering") || src.includes("mühendis");
  if (hasMis) return lang === "TR" ? "Yönetim Bilişim odaklı profil" : "Management Information Systems profile";
  if (hasIndustrial) return lang === "TR" ? "Endüstri odaklı profil" : "Industrial profile";
  if (hasEngineering) return lang === "TR" ? "Mühendislik odaklı profil" : "Engineering-focused profile";
  if (hasBusiness) return lang === "TR" ? "İş odaklı profil" : "Business-focused profile";
  return lang === "TR" ? "analitik ağırlıklı profil" : "analytics-leaning profile";
}

function inferTargetTrack(jdText, lang) {
  const src = String(jdText || "").toLowerCase();
  if (!src) return lang === "TR" ? "hedef rol" : "target role";
  if (src.includes("data") || src.includes("analyst") || src.includes("sql")) return lang === "TR" ? "analitik odaklı rol hattı" : "analytics role track";
  if (src.includes("strategy") || src.includes("consult")) return lang === "TR" ? "strateji odaklı rol hattı" : "strategy role track";
  if (src.includes("engineer") || src.includes("mühendis")) return lang === "TR" ? "mühendislik odaklı rol hattı" : "engineering role track";
  return lang === "TR" ? "hedef ilan hattı" : "target posting track";
}

function buildPersonalizedProjectEngine({ lang, biggestGap, missingSkills, topRole, background, jdText, score }) {
  const jd = String(jdText || "").toLowerCase();
  const roleLower = String(topRole || "").toLowerCase();
  const miss = Array.isArray(missingSkills) ? missingSkills.map((x) => String(x).trim()).filter(Boolean) : [];
  const primaryMissing = miss.slice(0, 3);

  const domain = jd.includes("retail") || jd.includes("fmcg")
    ? (lang === "TR" ? "FMCG / Perakende" : "FMCG / Retail")
    : jd.includes("finance") || jd.includes("bank")
      ? (lang === "TR" ? "Finans" : "Finance")
      : jd.includes("health")
        ? (lang === "TR" ? "Sağlık" : "Healthcare")
        : jd.includes("telecom")
          ? (lang === "TR" ? "Telekom" : "Telecom")
          : (lang === "TR" ? "İş & Analitik" : "Business & Analytics");

  const preferredTool = miss.find((s) => /power bi|tableau|excel|sql|python/i.test(s)) ||
    (jd.includes("sql") ? "SQL" : jd.includes("power bi") ? "Power BI" : "Power BI");
  const dataSource = jd.includes("retail") || jd.includes("fmcg")
    ? "Kaggle retail dataset"
    : jd.includes("finance")
      ? "World Bank + Kaggle market dataset"
      : "Kaggle public business dataset";

  let title = "";
  if (roleLower.includes("data")) {
    title = lang === "TR"
      ? `${domain} için ${preferredTool} Tabanlı Karar Dashboard'u`
      : `${preferredTool}-Based ${domain} Decision Dashboard`;
  } else if (roleLower.includes("business")) {
    title = lang === "TR"
      ? `${domain} İş Süreci Optimizasyon Vaka Çalışması`
      : `${domain} Process Optimization Case Study`;
  } else {
    title = lang === "TR"
      ? `${domain} Performans Analiz Projesi`
      : `${domain} Performance Analysis Project`;
  }

  const why = lang === "TR"
    ? `${biggestGap || "En kritik boşluğun"} şu an ilk eleme riski yaratıyor. ${background} profilin analitik temel veriyor; bu proje eksik olan gerçek iş çıktısı sinyalini doğrudan üretir.`
    : `${biggestGap || "Your biggest gap"} currently drives first-screen rejection risk. Your ${background} already gives you analytical foundation; this project directly creates the missing real-world execution signal.`;

  const steps = lang === "TR"
    ? [
        `1) ${dataSource} üzerinden ${domain} odaklı bir veri seti seç.`,
        `2) Veriyi temizle, metrikleri tanımla ve ${primaryMissing[0] || "SQL/Excel"} ile analiz katmanı kur.`,
        `3) ${preferredTool} ile karar dashboard'u oluştur (en az 3 KPI).`,
        "4) 3 iş içgörüsü çıkar ve her biri için önerilen aksiyonu yaz.",
      ]
    : [
        `1) Pick a ${domain} dataset from ${dataSource}.`,
        `2) Clean/structure data and build analysis logic with ${primaryMissing[0] || "SQL/Excel"}.`,
        `3) Build a decision dashboard in ${preferredTool} with at least 3 KPIs.`,
        "4) Extract 3 business insights and attach a clear action for each.",
      ];

  const projectedGain = Math.max(12, Math.min(22, Math.round((70 - (Number(score) || 50)) / 1.8)));
  const outcome = lang === "TR"
    ? `Recruiter tarafında “gerçek problem çözümü + ölçülebilir çıktı” sinyali üretir. CV'de somut proje kanıtı açar ve eşleşme skorunu yaklaşık +${projectedGain} puan artırır.`
    : `Creates a recruiter-visible signal of real problem solving plus measurable output. It adds concrete project proof to your CV and can lift your match score by about +${projectedGain} points.`;
  const timeEstimate = lang === "TR" ? "Tahmini süre: 5–10 gün" : "Estimated time: 5–10 days";

  return { title, why, steps, outcome, timeEstimate };
}

function buildBestPathForwardModel({ data, lang, score, t, cvText, jdText }) {
  const strengths = Array.isArray(data?.Recruiter?.strengths) ? data.Recruiter.strengths.map((x) => String(x).trim()).filter(Boolean) : [];
  const matched = Array.isArray(data?.ATS?.matched_skills) ? data.ATS.matched_skills.map((x) => String(x).trim()).filter(Boolean) : [];
  const gaps = Array.isArray(data?.Gaps?.rejection_reasons) ? data.Gaps.rejection_reasons : [];
  const bigGap = String(data?.Gaps?.biggest_gap || gaps[0]?.issue || "").trim();
  const missingSkills = Array.isArray(data?.ATS?.missing_keywords) ? data.ATS.missing_keywords : [];
  const background = inferCandidateBackground(cvText, lang);
  const targetTrack = inferTargetTrack(jdText, lang);
  const originalRole = String(data?.RoleFit?.best_role || "").trim() || (lang === "TR" ? "orijinal hedef rol" : "your original target role");
  const roleRows = Array.isArray(data?.RoleFit?.role_fit) ? [...data.RoleFit.role_fit] : [];
  roleRows.sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0));

  const roleCandidates = roleRows.slice(0, 3).map((r, idx) => {
    const role = String(r?.role || "").trim() || `${lang === "TR" ? "Rol" : "Role"} ${idx + 1}`;
    const scoreNum = Math.max(40, Math.min(92, Math.round(Number(r?.score || 0))));
    const whySeed = strengths[idx] || matched[idx] || strengths[0] || matched[0] || bigGap;
    const why = whySeed
      ? (lang === "TR"
        ? `${background} içinde ${whySeed} sinyali güçlü olduğu için bu rolde daha güçlü görünüyorsun.`
        : `Your ${background} already shows ${whySeed} signal, so this role is a stronger fit.`)
      : (lang === "TR"
        ? `${background} bu role daha yakın sinyal veriyor.`
        : `Your current ${background} signal is closer to this role.`);
    return { role, score: scoreNum, why };
  });

  while (roleCandidates.length < 3) {
    const fallback = lang === "TR"
      ? [
          { role: "Veri Analisti", score: 72, why: "Analitik düşünme ve yapılandırılmış problem çözme sinyalin güçlü." },
          { role: "İş Analisti", score: 68, why: "İş ve veri yorumlama arasında köprü kuran bir profilin var." },
          { role: "Operasyon Analisti", score: 64, why: "Süreç, raporlama ve karar desteği tarafında güçlü temel var." },
        ]
      : [
          { role: "Data Analyst", score: 72, why: "You already show analytical thinking and structured problem solving." },
          { role: "Business Analyst", score: 68, why: "Your background aligns with business plus data interpretation." },
          { role: "Operations Analyst", score: 64, why: "You have strong process and reporting foundations." },
        ];
    const next = fallback.find((x) => !roleCandidates.some((r) => r.role.toLowerCase() === x.role.toLowerCase()));
    if (!next) break;
    roleCandidates.push(next);
  }

  const topRole = roleCandidates[0]?.role || (lang === "TR" ? "Analist" : "Analyst");
  const topLower = topRole.toLowerCase();
  const careerPath =
    topLower.includes("data")
      ? (lang === "TR" ? "Veri Analisti → Ürün Analisti → Ürün Yöneticisi" : "Data Analyst → Product Analyst → Product Manager")
      : topLower.includes("business")
        ? (lang === "TR" ? "İş Analisti → Strateji Analisti → Strateji Yöneticisi" : "Business Analyst → Strategy Analyst → Strategy Manager")
        : (lang === "TR" ? "Analist → Kıdemli Analist → Yönetici" : "Analyst → Senior Analyst → Manager");

  const phaseImmediate = [
    lang === "TR" ? `${topRole} odağını CV özetinin ilk iki satırına taşı.` : `Rewrite your CV summary around ${topRole}.`,
    lang === "TR" ? "Deneyim bölümüne 2 ölçülebilir sonuç ekle." : "Add 2 measurable outcomes to experience bullets.",
    lang === "TR" ? `Başlıktaki rol konumunu ${topRole} ile hizala.` : `Align headline positioning to ${topRole}.`,
  ];
  const phaseStrategic = [
    lang === "TR" ? "Yukarıdaki kişisel projeyi bitir ve tek linkte yayınla." : "Ship the personalized project and publish one proof link.",
    lang === "TR" ? `Eksik becerilere odaklı mikro öğrenme yap: ${(data?.ATS?.missing_keywords || []).slice(0, 2).join(", ") || "SQL, BI"}` : `Run focused learning on missing skills: ${(data?.ATS?.missing_keywords || []).slice(0, 2).join(", ") || "SQL, BI"}.`,
    lang === "TR" ? "Projeden 3 net bullet çıkarıp CV'ye ekle." : "Extract 3 impact bullets from project and add to CV.",
  ];
  const phaseApplication = [
    lang === "TR" ? `${topRole} ve yakın rollere odaklan; ${targetTrack} dışındaki rolleri ele.` : `Apply only to ${topRole} and adjacent roles; cut roles outside this ${targetTrack}.`,
    lang === "TR" ? "İlanlarda analitik araç sinyali olan şirketleri hedefle." : "Target postings with explicit analytics-tool demand.",
    lang === "TR" ? "Her başvuruda özeti ilana göre hızlıca özelleştir." : "Do a quick summary tailoring for each application.",
  ];

  const base = Number.isFinite(Number(score)) ? Number(score) : 45;
  const projected = Math.max(base + 20, 70);
  const project = buildPersonalizedProjectEngine({
    lang,
    biggestGap: bigGap,
    missingSkills,
    topRole,
    background,
    jdText,
    score: base,
  });
  return {
    background,
    targetTrack,
    originalRole,
    roleFitWhy: [
      lang === "TR"
        ? `CV sinyalin (${background}) ${targetTrack} için daha güçlü eşleşme üretiyor.`
        : `Your CV signal (${background}) aligns better with this ${targetTrack}.`,
      lang === "TR"
        ? `${originalRole} tarafında görülen ana mismatch: ${bigGap || "rol beklentisi ile profil sinyali ayrışıyor"}.`
        : `Main mismatch with ${originalRole}: ${bigGap || "role expectation and profile signal are not aligned"}.`,
      lang === "TR"
        ? "Bu yüzden alternatif rollerde daha yüksek kısa liste olasılığı oluşuyor."
        : "That is why these alternative roles create a stronger shortlist probability.",
    ],
    roles: roleCandidates.slice(0, 3),
    topRole,
    careerPath,
    careerPathWhy: lang === "TR"
      ? "Bu yol mevcut güçlü yanlarını büyütürken kritik boşluklarını kapatır."
      : "This path builds on your strengths while closing your key gaps.",
    project,
    phases: { immediate: phaseImmediate, strategic: phaseStrategic, application: phaseApplication },
    roadmapTop3: [phaseImmediate[0], phaseStrategic[0], phaseApplication[0]].filter(Boolean).slice(0, 3),
    transformation: {
      fit: `${Math.round(base)} → ${Math.round(projected)}+`,
      confidence: lang === "TR" ? "Mülakat olasılığı belirgin şekilde artar." : "Interview probability increases significantly.",
    },
  };
}

function BestPathForwardBlock({ data, lang, t, isPro, onUpgrade, score, cvText, jdText }) {
  const model = useMemo(() => buildBestPathForwardModel({ data, lang, score, t, cvText, jdText }), [data, lang, score, t, cvText, jdText]);
  const cardStyle = {
    border: `1px solid ${RS.border}`,
    borderRadius: 14,
    background: RS.bgElevated,
    padding: "24px",
    minHeight: 180,
  };
  return (
    <div style={{ marginTop: 24, padding: "24px", borderRadius: 16, border: `1px solid ${RS.borderSubtle}`, background: rsAlpha(RS.indigo, 0.05) }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: RS.textMuted, marginBottom: 10 }}>
        {t.bestPathForwardTitle}
      </div>
      <div style={{ fontSize: 12, color: RS.textSecondary, marginBottom: 10 }}>
        {t.bestPathSignalLine.replace("{bg}", model.background).replace("{track}", model.targetTrack)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 24 }}>
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: RS.textPrimary, marginBottom: 14 }}>
            <Target size={16} color={RS.indigo} />
            {t.bestPathRolesTitle}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {model.roles.map((r, i) => (
              <div key={`${r.role}-${i}`} style={{ border: `1px solid ${RS.border}`, borderRadius: 10, padding: "10px 12px", background: rsAlpha(RS.bgSurface, 0.55) }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: RS.textPrimary }}>{r.role}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: RS.indigo }}>{r.score}%</div>
                </div>
                <div style={{ fontSize: 12, color: RS.textSecondary, marginTop: 4 }}>{clampBullet(r.why, 88)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: RS.textPrimary, marginBottom: 12 }}>
            <AlertCircle size={16} color={RS.redDim} />
            {t.bestPathWrongRoleTitle}
          </div>
          <div style={{ fontSize: 12, color: RS.textSecondary, marginBottom: 6 }}>• {clampBullet(model.roleFitWhy?.[1] || "", 115)}</div>
          <div style={{ fontSize: 12, color: RS.textSecondary }}>• {clampBullet(model.roleFitWhy?.[0] || "", 115)}</div>
        </div>

        {isPro ? (
          <>
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: RS.textPrimary, marginBottom: 12 }}>
                <Workflow size={16} color={RS.indigo} />
                {t.bestProjectSectionTitle}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: RS.indigo, marginBottom: 8 }}>{model.project.title}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: RS.textSecondary }}>• {clampBullet(model.project.why, 120)}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: RS.textSecondary }}>• {clampBullet(model.project.steps?.[0] || "", 120)}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: RS.green }}>• {clampBullet(`${model.project.outcome} ${model.project.timeEstimate}`, 120)}</div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: RS.textPrimary, marginBottom: 12 }}>
                <Layers size={16} color={RS.indigo} />
                {t.bestPathRoadmapTitle}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: RS.indigo, marginBottom: 8 }}>{model.careerPath}</div>
              {model.roadmapTop3.map((x, i) => <div key={`r3-${i}`} style={{ fontSize: 12, color: RS.textSecondary, marginBottom: 5 }}>→ {clampBullet(x, 108)}</div>)}
            </div>

            <div style={{ ...cardStyle, minHeight: 140 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: RS.textPrimary, marginBottom: 10 }}>{t.bestPathTransformTitle}</div>
              <div style={{ fontSize: 12, color: RS.green, marginBottom: 5 }}>→ {t.bestPathTransformFit.replace("{fit}", model.transformation.fit)}</div>
              <div style={{ fontSize: 12, color: RS.green }}>→ {model.transformation.confidence}</div>
            </div>
          </>
        ) : (
          <div style={{ ...cardStyle, minHeight: 140 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: RS.textPrimary, marginBottom: 10 }}>{t.bestProjectSectionTitle}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: RS.indigo, marginBottom: 10 }}>{model.project.title}</div>
            <div style={{ fontSize: 12, color: RS.textMuted, marginBottom: 10 }}>{t.bestPathFreeHint}</div>
            <button
              type="button"
              onClick={onUpgrade}
              style={{
                border: "none",
                borderRadius: 10,
                padding: "10px 14px",
                background: RS.indigo,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: RS.fontUi,
              }}
            >
              {t.focusPreviewUpgradeBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function clampBullet(text, max = 120) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(40, max - 1)).trim()}...`;
}

function DecisionScanSections({ data, lang, t, mainProblem, singleAction, isPro, onUpgrade, bestPathLabel }) {
  const reasons = Array.isArray(data?.Gaps?.rejection_reasons) ? data.Gaps.rejection_reasons : [];
  const topGaps = reasons.slice(0, 3);
  const moreGaps = reasons.slice(3);
  const roadmapFixes = enrichActionPlan(parseActionPlan(data?.Decision?.action_plan), {
    lang: lang === "TR" ? "tr" : "en",
    roleFit: data?.RoleFit,
    gaps: data?.Gaps,
    verdict: data?.Decision?.final_verdict,
  })?.fixes || [];
  const roadmapLines = roadmapFixes
    .map((f) => clampBullet(f?.issue || f?.steps?.[0] || "", 110))
    .filter(Boolean)
    .slice(0, 3);
  const summaryLine = clampBullet(String(data?.Decision?.reasoning || data?.Recruiter?.reasoning || ""), 110);
  const rowStyle = { marginBottom: 6, fontSize: 12, color: RS.textSecondary, lineHeight: 1.55 };
  const summaryStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    color: RS.textPrimary,
    cursor: "pointer",
    listStyle: "none",
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: RS.textMuted, marginBottom: 10 }}>
        {t.scanSectionLabel}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 24, marginBottom: 24 }}>
        <div style={{ background: RS.bgElevated, border: `1px solid ${RS.border}`, borderRadius: 12, padding: "24px", minHeight: 130 }}>
          <div style={{ fontSize: 11, color: RS.textMuted, marginBottom: 4 }}>{t.scanCriticalGapTitle}</div>
          <div style={{ fontSize: 12, color: RS.textPrimary, fontWeight: 700 }}>{clampBullet(mainProblem, 90)}</div>
        </div>
        <div style={{ background: RS.bgElevated, border: `1px solid ${RS.border}`, borderRadius: 12, padding: "24px", minHeight: 130 }}>
          <div style={{ fontSize: 11, color: RS.textMuted, marginBottom: 4 }}>{t.scanOneMoveTitle}</div>
          <div style={{ fontSize: 12, color: RS.textPrimary, fontWeight: 700 }}>{clampBullet(singleAction, 90)}</div>
        </div>
        <div style={{ background: RS.bgElevated, border: `1px solid ${RS.border}`, borderRadius: 12, padding: "24px", minHeight: 130 }}>
          <div style={{ fontSize: 11, color: RS.textMuted, marginBottom: 4 }}>{t.scanBestPathTitle}</div>
          <div style={{ fontSize: 12, color: RS.textPrimary, fontWeight: 700 }}>{clampBullet(bestPathLabel, 90)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 24 }}>
      <details style={{ border: `1px solid ${RS.border}`, borderRadius: 12, padding: "24px", background: rsAlpha(RS.bgElevated, 0.65), minHeight: 170 }}>
        <summary style={summaryStyle}>
          <AlertCircle size={14} color={RS.redDim} />
          {t.scanWhyRejectedTitle}
        </summary>
        <div style={{ marginTop: 8 }}>
          {mainProblem ? <div style={rowStyle}>• {clampBullet(mainProblem)}</div> : null}
          {summaryLine ? <div style={rowStyle}>• {summaryLine}</div> : null}
          {!mainProblem && !summaryLine ? <div style={rowStyle}>• {t.previewEmptyRecruiter}</div> : null}
        </div>
      </details>

      <details style={{ border: `1px solid ${RS.border}`, borderRadius: 12, padding: "24px", background: rsAlpha(RS.bgElevated, 0.65), minHeight: 170 }}>
        <summary style={summaryStyle}>
          <ListChecks size={14} color={RS.amber} />
          {t.scanAllGapsTitle}
        </summary>
        <div style={{ marginTop: 8 }}>
          {topGaps.length ? topGaps.map((g, i) => (
            <div key={`gap-${i}`} style={rowStyle}>
              • {clampBullet(humanizeUserFacingReason(g?.issue || "", lang), 95)} {g?.impact ? `— ${gapImpactLabel(g.impact, t)}` : ""}
            </div>
          )) : <div style={rowStyle}>• {t.previewEmptyGaps}</div>}
          {moreGaps.length ? (
            <details style={{ marginTop: 8 }}>
              <summary style={{ ...summaryStyle, fontSize: 12, color: RS.textMuted }}>{t.scanMoreGaps.replace("{n}", String(moreGaps.length))}</summary>
              <div style={{ marginTop: 6 }}>
                {moreGaps.map((g, i) => (
                  <div key={`gap-more-${i}`} style={rowStyle}>• {clampBullet(humanizeUserFacingReason(g?.issue || "", lang), 95)}</div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </details>

      <details style={{ border: `1px solid ${RS.border}`, borderRadius: 12, padding: "24px", background: rsAlpha(RS.bgElevated, 0.65), minHeight: 170 }}>
        <summary style={summaryStyle}>
          <Layers size={14} color={RS.indigo} />
          {t.scanFullRoadmapTitle}
        </summary>
        <div style={{ marginTop: 8 }}>
          {isPro ? (
            roadmapLines.length ? roadmapLines.map((line, i) => (
              <div key={`rm-${i}`} style={rowStyle}>• {line}</div>
            )) : <div style={rowStyle}>• {t.previewEmptyPlan}</div>
          ) : (
            <>
              <div style={rowStyle}>• {t.scanRoadmapLocked}</div>
              <button
                type="button"
                onClick={onUpgrade}
                style={{ marginTop: 6, border: "none", borderRadius: 8, background: RS.indigo, color: "#fff", padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {t.focusPreviewUpgradeBtn}
              </button>
            </>
          )}
        </div>
      </details>
      </div>
    </div>
  );
}

function CareerEngineCard({ data, lang, isPro, onUpgrade, onFixCv, optimizing, cvText, jdText }) {
  const actionPlanMemo = useMemo(() => {
    if (!data) return { priority_callout: null, fixes: [], interview_note: null };
    return enrichActionPlan(parseActionPlan(data.Decision?.action_plan), {
      lang: lang === "TR" ? "tr" : "en",
      roleFit: data.RoleFit,
      gaps: data.Gaps,
      verdict: data.Decision?.final_verdict,
    });
  }, [data, lang]);

  const planFixesMemo = useMemo(
    () => actionPlanMemo.fixes.filter((f) => f.issue || (f.steps && f.steps.length)),
    [actionPlanMemo],
  );

  const scoreNumeric = useMemo(() => {
    if (!data) return null;
    const s = data["Final Alignment Score"];
    return s != null && Number.isFinite(Number(s)) ? Number(s) : null;
  }, [data]);

  if (!data) return null;

  const t = translations[lang];
  const score = data["Final Alignment Score"];
  const scoreRounded = score != null && Number.isFinite(Number(score)) ? Math.round(Number(score)) : NaN;
  const currentInt = Number.isFinite(scoreRounded) ? scoreRounded : scoreNumeric != null ? Math.round(scoreNumeric) : null;
  const fv = getScoreFinalVerdict(score, lang);
  const vc = fv.verdictColor || RS.textMuted;
  const rej = score != null && Number.isFinite(Number(score)) ? getRejectionRiskFromAlignmentScore(score, lang) : null;

  const gaps = data.Gaps?.rejection_reasons || [];
  const biggestRaw =
    (data.Gaps?.biggest_gap && String(data.Gaps.biggest_gap).trim()) ||
    (gaps[0]?.issue ? String(gaps[0].issue) : "");
  const mainProblemFromGap = biggestRaw ? humanizeUserFacingReason(biggestRaw, lang) : "";
  const oneLineReasonRaw = String(data.Decision?.reasoning || data.Recruiter?.reasoning || "")
    .trim()
    .split(/[.!?]/)[0]
    ?.trim();
  const mainProblemFromReason = oneLineReasonRaw ? humanizeUserFacingReason(oneLineReasonRaw, lang) : "";
  const displayedMainProblem = mainProblemFromGap || mainProblemFromReason;

  const planFixes = planFixesMemo;
  const primaryFix = planFixes.find((f) => f.priority === "high") || planFixes[0] || null;
  const gainPts = primaryFix
    ? Math.max(1, Math.min(18, Math.round(Number(primaryFix.score_impact) || 6)))
    : currentInt != null && currentInt < 72
      ? Math.min(18, Math.max(5, Math.round((72 - currentInt) / 2)))
      : 10;
  const targetScore = currentInt != null ? Math.min(100, Math.round(currentInt + gainPts)) : null;

  const stepPick = pickDoThisNextStep(planFixes);
  const singleActionRaw =
    (stepPick && String(stepPick).trim()) ||
    (primaryFix?.issue ? String(primaryFix.issue).trim() : "") ||
    (actionPlanMemo.priority_callout ? String(actionPlanMemo.priority_callout).trim() : "");
  const singleAction = singleActionRaw
    ? humanizeUserFacingReason(singleActionRaw, lang)
    : lang === "TR"
      ? "Önce bu odağı netleştir; ardından tam analizde adım adım ilerle."
      : "Clarify this focus first, then follow the full guided breakdown.";

  let extraHiddenCount = Math.max(0, gaps.length - 1);
  if (planFixes.length > 1) {
    extraHiddenCount = Math.max(extraHiddenCount, planFixes.length - 1);
  }
  if (extraHiddenCount < 1) extraHiddenCount = 3;

  const labelStyle = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: RS.textMuted,
    fontFamily: RS.fontUi,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        marginBottom: 28,
        borderRadius: 20,
        overflow: "hidden",
        border: `1px solid ${RS.border}`,
        background: RS.pageGradient,
        fontFamily: RS.fontUi,
        boxShadow: `0 24px 80px rgba(0,0,0,0.45), 0 0 0 1px ${rsAlpha(RS.indigo, 0.06)}`,
      }}
    >
      <div style={{ padding: "32px 32px 28px", background: rsAlpha(RS.bgSurface, 0.92), borderBottom: `1px solid ${RS.border}` }}>
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${rsAlpha(RS.indigo, 0.35)}`,
            background: rsAlpha(RS.indigo, 0.14),
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: RS.textMuted, marginBottom: 4 }}>
            {t.doThisFirstTitle}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: RS.textPrimary, lineHeight: 1.45 }}>{clampBullet(singleAction, 110)}</div>
        </div>
        <div style={{ ...labelStyle, marginBottom: 14 }}>{t.focusVerdictKicker}</div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <div
              style={{
                fontSize: "clamp(44px, 6vw, 64px)",
                fontWeight: 900,
                color: vc,
                lineHeight: 1,
                letterSpacing: "-0.03em",
                fontFamily: RS.fontMono,
              }}
            >
              {currentInt != null ? currentInt : "—"}
            </div>
            <div style={{ ...labelStyle, marginTop: 14, marginBottom: 6 }}>{t.focusOverallStatusLabel}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: RS.textPrimary, lineHeight: 1.45 }}>{fv.title}</div>
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 500, color: RS.textMuted, lineHeight: 1.5 }}>
              {t.focusTrustLine}
            </div>
            {rej ? (
              <>
                <div style={{ ...labelStyle, marginTop: 14, marginBottom: 6 }}>{t.focusRiskKicker}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: rej.color, lineHeight: 1.5 }}>{rej.mainLine}</div>
              </>
            ) : null}
            {displayedMainProblem ? (
              <>
                <div style={{ ...labelStyle, marginTop: 16, marginBottom: 8 }}>{t.focusMainProblemKicker}</div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: RS.textPrimary, lineHeight: 1.6, maxWidth: 560 }}>{displayedMainProblem}</p>
              </>
            ) : (
              <p style={{ margin: "16px 0 0", fontSize: 15, fontWeight: 500, color: RS.textSecondary, lineHeight: 1.65, maxWidth: 560 }}>{fv.explanation}</p>
            )}
          </div>
        </div>
      </div>

      {currentInt != null && targetScore != null ? (
        <div
          style={{
            padding: "28px 32px",
            borderBottom: `1px solid ${RS.border}`,
            background: `linear-gradient(180deg, ${rsAlpha(RS.indigo, 0.08)} 0%, ${rsAlpha(RS.bgSurface, 0.9)} 100%)`,
          }}
        >
          <div style={{ ...labelStyle, marginBottom: 12 }}>{t.focusImpactKicker}</div>
          <div
            style={{
              fontSize: "clamp(22px, 3.5vw, 30px)",
              fontWeight: 800,
              color: RS.textPrimary,
              fontFamily: RS.fontMono,
              letterSpacing: "-0.02em",
            }}
          >
            {currentInt} → {targetScore}
            <span style={{ marginLeft: 12, fontSize: "clamp(18px, 2.8vw, 24px)", color: RS.green }}>+{gainPts}</span>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 14, fontWeight: 500, color: RS.textSecondary, lineHeight: 1.65, maxWidth: 560 }}>
            {t.focusImpactExpl.replace("{pts}", String(gainPts))}
          </p>
        </div>
      ) : null}

      <div style={{ padding: "28px 32px 32px", background: RS.bgSurface }}>
        <div style={{ ...labelStyle, marginBottom: 12 }}>{t.focusActionKicker}</div>
        <p style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 600, color: RS.textPrimary, lineHeight: 1.55, maxWidth: 640 }}>{singleAction}</p>
        <button
          type="button"
          onClick={() => {
            if (!isPro) {
              hirefitTrack("v2_focus_primary_upgrade_cta", { lang, source: "verdict_block" });
              onUpgrade();
              return;
            }
            hirefitTrack("v2_focus_apply_fix_cta", { lang });
            onFixCv();
          }}
          disabled={optimizing && isPro}
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "16px 22px",
            borderRadius: 14,
            border: "none",
            background: `linear-gradient(135deg, ${RS.indigo}, #a855f7)`,
            color: "#0f172a",
            fontSize: 15,
            fontWeight: 800,
            cursor: optimizing && isPro ? "wait" : "pointer",
            fontFamily: RS.fontUi,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            opacity: optimizing && isPro ? 0.75 : 1,
            boxShadow: `0 8px 32px ${rsAlpha(RS.indigo, 0.4)}`,
          }}
        >
          {optimizing && isPro ? <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : null}
          {!isPro ? t.focusCtaSeeFull : optimizing && isPro ? t.optimizing : t.focusCtaApplyFix}
        </button>

        {!isPro ? (
          <div
            style={{
              marginTop: 22,
              padding: "16px 18px",
              borderRadius: 14,
              border: `1px solid ${RS.borderSubtle}`,
              background: rsAlpha(RS.indigo, 0.06),
            }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: RS.textSecondary, lineHeight: 1.6 }}>
              {t.focusHiddenGapsTeaser.replace("{n}", String(extraHiddenCount))}
            </p>
          </div>
        ) : null}

        <DecisionScanSections
          data={data}
          lang={lang}
          t={t}
          mainProblem={displayedMainProblem || fv.explanation}
          singleAction={singleAction}
          isPro={isPro}
          onUpgrade={onUpgrade}
          bestPathLabel={t.bestPathForwardTitle}
        />

        <BestPathForwardBlock data={data} lang={lang} t={t} isPro={isPro} onUpgrade={onUpgrade} score={scoreNumeric ?? score} cvText={cvText} jdText={jdText} />
      </div>
    </motion.div>
  );
}


const translations = {
  EN: {
    slogan: "AI Career Decision Engine",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    cookiePolicy: "Cookie Policy",
    heroTitle: "Why does your CV keep getting rejected?", 
    heroDesc: "HireFit analyzes your CV against any job description and tells you exactly what recruiters see — in seconds.",
    analyzeBtn: "Analyze My CV Free",
    viewDashboard: "View Dashboard",
    checkFit: "Check My Fit",
    optimizeCV: "👉 Take action on your CV",
    learningRoadmap: "Learning Roadmap",
    pasteCv: "Paste your CV text here...",
    pasteJd: "Paste the job description here...",
    candidateCV: "Candidate CV",
    jobDesc: "Job Description",
    uploadPdf: "Upload PDF",
    reading: "Reading...",
    freeToUse: "Free to use",
    analyzing: "Analyzing...",
    optimizing: "Optimizing...",
    building: "Building...",
    noAnalyses: "No analyses yet.",
    previousAnalyses: "Previous Analyses",
    freeLimitWarning: "free analysis remaining",
    noFreeLeft: "No free analyses left — Upgrade to Pro",
    upgradeBtn: "Upgrade to Pro — $9.99/mo 🚀",
    maybeLater: "Maybe later",
    paywallTitle: "You've hit your free limit",
    paywallDesc: "You've used your 2 free analyses. Upgrade to Pro for unlimited analyses, CV Rewriter, Recruiter Simulation, and full insights.",
    cvAnalyzer: "CV Alignment Analyzer",
    cvAnalyzerDesc: "Paste your CV and job description — get rejection reasons + fix suggestions in seconds.",
    extract: "Extract",
    extracting: "Extracting...",
    wordsLoaded: "words loaded",
    copyReport: "Copy Report",
    download: "Download",
    copyOptimized: "Copy Optimized",
    originalCV: "Original CV",
    optimizedCV: "Optimized CV",
    cvComparison: "✦ CV Comparison",
    learningRoadmapTitle: "✦ Learning Roadmap",
    copy: "Copy",
    clear: "Clear",
    viewReport: "View Report →",
    signOut: "Sign out",
    login: "Login",
    welcomeBack: "Welcome back",
    signInDesc: "Sign in to your HireFit account",
    continueBtn: "Continue",
    continueGoogle: "Continue with Google",
    dashboard: "Dashboard",
    dashboardDesc: "Your analysis history and performance overview.",
    totalAnalyses: "Total Analyses",
    averageScore: "Average Score",
    currentPlan: "Current Plan",
    waitlistLeads: "Waitlist Leads",
    productRoadmap: "Product Roadmap",
    openProduct: "Open Product",
    home: "Home",
    product: "Product",
    recentAnalyses: "Recent Analyses",
    allSystemsOp: "All systems operational",
    applyFix: "Take action →",
    applying: "Applying...",
    fixApplied: "Fix Applied ✓",
    copyFix: "Copy",
    proOnly: "Pro Only",
    upgradeToSee: "Upgrade to Pro to see all fixes",
    scoreProgress: "Score Progress",
    improvement: "improvement",
    latestScore: "Latest",
    careerJourneyTitle: "Your Career Journey",
    careerJourneyBlurb: "See each milestone from skill gaps to your target role—then take your HireFit analysis to the job market.",
    startApplyingNow: "Start Applying Now",
    roadmapPageEmpty: "Run an analysis in the product and generate a learning roadmap to see your personalized path here.",
    roadmapReadyBanner: "Your learning roadmap is ready.",
    openJourneyMap: "Open full journey map",
    anonSaveTitle: "Save your results",
    anonSaveDesc: "Sign in to keep your analyses in your account and sync across devices.",
    anonSaveCta: "Sign in",
    anonSaveDismiss: "Not now",
    unlockWithPro: "Unlock with Pro",
    proFeatureRoles: "See which other roles your CV fits — included in Pro.",
    proFeatureInterview: "Role-specific interview prep — included in Pro.",
    rolesEmptyPro: "No alternative roles surfaced for this CV.",
    rolesEmptyGeneric: "No cross-role matches in this report.",
    rolesEmptyGuidance: "We did not get a role matrix for this report yet.",
    rolesEmptyNext: "Upgrade to Pro for cross-role suggestions, or add clearer role titles to your CV and run Check Fit again.",
    interviewEmpty: "No interview prompts in this report.",
    interviewEmptyGuidance: "No scripted interview prompts were attached to this run.",
    interviewEmptyNext: "Use the Action plan steps above, then rehearse one answer with a metric from your CV.",
    confidenceNA: "N/A",
    confidenceUnavailableLabel: "Not scored this run",
    confidenceUnavailableNext: "Run Check Fit again after both CV and job description finish loading.",
    decisionUnavailable: "Verdict pending",
    decisionUnavailableNext: "Paste CV and job text, then run Check Fit to see your apply / risk / pass signal.",
    analysisFailedTitle: "We couldn't complete the analysis.",
    analysisFailedRecovery: "Check your connection, confirm both CV and job description are pasted (not empty), then press Check Fit again. If you use a VPN, try briefly turning it off.",
    cvOptimizeFailedTitle: "CV optimization didn't finish.",
    cvOptimizeFailedRecovery: "Wait a few seconds and try Fix My CV again. Both CV and JD need enough text for a useful rewrite.",
    roadmapFailedTitle: "Learning roadmap couldn't be generated.",
    roadmapFailedRecovery: "Run Check Fit first so we can read missing skills, then open Learning roadmap again.",
    roadmapNeedsSkillsTitle: "We need missing-skill signals from an analysis first.",
    roadmapNeedsSkillsRecovery: "Run Check Fit on this CV and job, then open Learning roadmap again.",
    pdfReadFailedTitle: "We could not read that PDF.",
    pdfReadFailedRecovery: "Try a smaller file, export PDF as text from Word, or paste the CV text directly.",
    fileReadFailedTitle: "That file could not be read.",
    fileReadFailedRecovery: "Use a .txt export or paste plain text into the CV or JD box.",
    extractionRecovery: "Paste the job description text manually — full posting text works best.",
    emptyRecruiterSignals: "Your CV currently sends weak recruiter signals in the first scan.",
    emptyRecruiterNext: "Show outcomes, tools, and ownership to make your impact readable fast.",
    emptyGapList: "Your biggest blocker is still positioning clarity for this role.",
    emptyGapNextFree: "Upgrade to Pro for the full gap list, or paste a longer job description and re-run.",
    emptyGapNextPro: "If you just edited your CV, run Check Fit again to refresh gaps.",
    emptyPlanFallback: "Start with one high-impact fix that increases recruiter readability.",
    emptyPlanNext: "Ship one fix now, then re-run analysis to confirm score movement.",
    emptySkillsMissing: "Your CV does not clearly match the job's required keywords yet.",
    emptySkillsMissingNext: "Mirror must-have tools and responsibilities from the posting in your CV wording.",
    emptySkillsMatched: "Your current CV evidence is not explicit enough for strong keyword matching.",
    emptySkillsMatchedNext: "Add role-relevant tools and quantified outcomes in each core experience bullet.",
    emptyKeywordsNone: "The job-to-CV keyword bridge is weak right now.",
    emptyKeywordsNext: "Use exact terms from the job posting in your strongest bullet points.",
    emptyMarketRoles: "We can still identify your strongest role direction from available signals.",
    emptyMarketRolesNext: "Focus one target role first, strengthen proof, then widen applications.",
    ciEmptyOverview: "No company overview text in this bundle.",
    ciEmptyOverviewNext: "Try company analysis again later, or continue with your CV vs JD Action plan.",
    ciEmptyCareer: "No career upside bullets yet.",
    ciEmptyCareerNext: "Expand the job posting or add a company name if you have one.",
    ciEmptySector: "No sector positioning blurb yet.",
    ciEmptySectorNext: "Paste a richer JD or run analysis again.",
    ciEmptyCvTrends: "No sector trend comparison yet.",
    ciEmptyCvTrendsNext: "Complete a fresh analysis or open the Skills tab to tune keywords.",
    companyIntelTitle: "Company Intelligence",
    companyIntelSectorTitle: "Sector analysis",
    ciCompanyStructure: "Company overview",
    ciEmployeeExperience: "Employee experience",
    ciCareerOpportunities: "Career upside",
    ciSectorPosition: "Sector position",
    ciCvVsTrends: "Your CV vs sector demand",
    ciPrepTitle: "Suggested steps to prepare for this role",
    ciRoadmapCta: "Open learning roadmap",
    ciUpgradeRoadmap: "Upgrade to Pro for a detailed roadmap",
    detectedSectorLabel: "Detected sector",
    sectorOverrideHint: "Override (optional)",
    orPasteLinkHint: "or paste a job URL below",
    finalVerdict: "Verdict",
    alignmentScore: "Alignment score",
    rejectionRisk: "Rejection Risk",
    confidenceLabel: "Confidence",
    recruiterView: "Recruiter view",
    whatTheyThink: "What they actually think",
    deepAnalysis: "Deep analysis",
    whyYouFail: "Gap analysis",
    actionPlan: "Action plan",
    whatToDoNext: "What to do before applying",
    skillsKeywords: "Skills & keywords",
    missingSignals: "Keyword match breakdown",
    marketInsights: "Market insights",
    careerLanes: "Career fit & market context",
    decisionReasoning: "Decision Reasoning",
    impactProjection: "IMPACT PROJECTION",
    nowAfter: "NOW → AFTER",
    currentScore: "Current Score",
    projectedScore: "Projected Score",
    scoreIncrease: "Score Increase",
    strongSignals: "Strong signals",
    weakSignals: "Weak signals",
    simulatedRecruiterPatterns: "Based on simulated recruiter patterns",
    atsStyleAnalysis: "ATS-style analysis",
    sectorLens: "Sector lens: ",
    notAvailableForAnalysis: "Limited data for this section — see the suggested next step below.",
    emptyNoneDetectedSkills: "Your CV does not clearly match the posting's keyword language yet.",
    emptyNoneDetectedSkillsNext: "Add the role's core tools and outcomes directly into your strongest bullets.",
    biggestBlockerLead: "Biggest blocker: ",
    missingFromCv: "Missing from your CV",
    detectedInCv: "Detected in your CV",
    unlockProArrow: "Unlock with Pro →",
    doThisNext: "Do this next",
    doThisNextLeverage: "Ship proof a recruiter can verify in 10 seconds: numbers, a link, a cert, a repo — not vibes.",
    fixScoreImpactApprox: "Fixing this can increase your score by about +{pts} points.",
    scoreVsLastRun: "vs last analysis: {delta} (was {prior})",
    recruiterBluntBanner: "Cold read: where they stop reading. No pep talk — just the gap.",
    seeFullPlan: "Start fixing this now →",
    primaryBlocker: "Primary blocker",
    fixFirst: "Fix first",
    priorityImportant: "Important",
    priorityOptional: "Optional",
    priorityFixes: "Priority fixes",
    interviewPrepShort: "Interview prep",
    sanitizeParsingFailed:
      "We analyzed your CV based on available signals.",
    executionProgress: "Execution",
    fixesCompletedCount: "{done}/{total} fixes marked done",
    executionLadder: "Projected alignment if you complete fixes in order",
    projectedStepHint: "{from} → {to}",
    projectedAfterFixOrder: "After this fix (and all prior in order): {score}",
    progressScoreLive: "Progress score (marked fixes): {score} ({delta})",
    proofPromptWhenDone:
      "Paste a link (portfolio, PR, cert) or one line of proof — required to mark this fix done:",
    proofRequiredShort: "Proof cannot be empty. Fix was not marked done.",
    proofStoredLabel: "Proof on file:",
    proofStepHeading: "Proof — link or upload",
    proofPasteLinkPlaceholder: "Paste link or short note…",
    proofUploadFile: "Upload proof (.txt / PDF / image)",
    proofFileLabel: "File",
    betterRoleAlternatives: "Better role alternatives (CV fit)",
    betterRoleAlternativesSub:
      "Lanes where your CV evidence scores higher than this posting alignment — use as pivot ideas, not guarantees.",
    reanalysisScoreHint: "Compared with your previous Check Fit in this browser.",
    markFixComplete: "Mark this fix done",
    markFixDoneAria: "Mark fix {n} as done",
    verdictBadTitle: "🚫 You will likely get rejected",
    verdictBadSub:
      "Reality check: this role still filters you out today. Recovery path: close the next 2 signal gaps and rerun.",
    verdictRiskyTitle: "⚠️ Risky apply",
    verdictRiskySub: "Reality check: still risky on first-pass scan. Recovery path: ship 1-2 proof lines and re-enter range.",
    verdictCloseTitle: "⚡ Competitive — tighten proof",
    verdictCloseSub: "Reality check: you're close, not done. Recovery path: tighten proof, then apply with leverage.",
    verdictStrongTitle: "✅ Strong match",
    verdictStrongSub: "Reality check: this is interview range. Recovery path: keep proof sharp and momentum high.",
    startFixingNow: "Fix your positioning →",
    takeActionBtn: "Take action →",
    startThisStep: "Start mission →",
    fixPointsIfDone: "🔥 +{pts} points if completed",
    fixProgressApplied: "✅ Progress applied: +{pts}",
    proofAddedToast: "Proof added",
    proofTrustToast: "Recruiter trust signal captured",
    proofImpactToast: "+{pts} impact applied to your progress score",
    fixMyCvRun: "Take action on your CV →",
    fixMyCvUnlock: "Take action — unlock with Pro →",
    heroStopBig: "Stop.",
    heroStopLine1: "If you apply right now → high chance of rejection.",
    heroStopLine2: "But you're closer than it looks. Fix 2 key gaps to push into interview range.",
    heroRiskBig: "Not safe yet.",
    heroRiskLine1: "Reality check: still risky for first-pass screening.",
    heroRiskLine2: "Recovery path: close the next 1-2 gaps and you'll be back in the fight.",
    heroCloseBig: "You're close.",
    heroCloseLine1: "Reality check: competitive, but not finished.",
    heroCloseLine2: "Recovery path: tighten metrics + tools proof, then send.",
    heroStrongBig: "Green light.",
    heroStrongLine1: "Reality check: you're in interview range for this posting.",
    heroStrongLine2: "Recovery path: keep proof loud and apply with confidence.",
    scoreInsightLow: "This is below the usual hiring bar for this posting.",
    scoreInsightMid: "You're close — but not default-hire competitive yet.",
    scoreInsightHigh: "You're in interview range.",
    scoreInsightBench: "Most successful candidates here score above 70.",
    yourProgressTitle: "Your progress",
    yourProgressPoints: "You've gained +{pts} points so far",
    yourProgressNext: "Next best move: {action}",
    yourProgressBarLabel: "Path to interview range (70)",
    yourProgressNudge: "Complete {n} more high-impact step(s) to cross 70.",
    yourProgressAllDone: "You're past the 70 benchmark — keep shipping proof.",
    recruiterRealLead: "Here's the real issue:",
    recruiterRealIntro:
      "Your CV doesn't scream what you actually built or shipped. From a recruiter's scan:",
    recruiterLensLine1: "→ No proof of impact",
    recruiterLensLine2: "→ No measurable outcomes",
    recruiterLensLine3: "→ No obvious tools stack",
    impactFixUnlock: "🔥 Fix your positioning → unlock +{pts} points",
    impactMovesCloser: "+{pts} moves you closer to interview range.",
    stepCtaOpenLink: "Open link →",
    stepCtaGithub: "Open GitHub guide →",
    stepCtaApply: "Enter target zone →",
    impactUnlockedLine: "Impact unlocked",
    focusVerdictKicker: "Verdict",
    focusOverallStatusLabel: "Overall status",
    focusRiskKicker: "Rejection risk",
    focusMainProblemKicker: "Main rejection reason",
    focusTrustLine: "Based on CV vs job requirement mismatch analysis",
    focusImpactKicker: "Score impact",
    focusImpactExpl: "Fixing this gap is worth about +{pts} points toward a stronger profile.",
    focusActionKicker: "Your one move",
    focusCtaSeeFull: "See exactly why you get rejected →",
    focusCtaApplyFix: "Apply this focus to my CV →",
    focusHiddenGapsTeaser: "There are {n} more gaps still affecting your score. See the full breakdown with Pro.",
    bestPathForwardTitle: "Your best path forward",
    bestPathSignalLine: "Profile signal: {bg} → target track: {track}",
    bestPathRolesTitle: "Based on your profile, you are a stronger fit for:",
    bestPathWhyRolesTitle: "Why these roles fit",
    bestPathWrongRoleTitle: "Why this role is wrong",
    bestPathFreeHint: "Free preview shows roles and project title only. Unlock Pro for the full project breakdown and roadmap.",
    bestProjectSectionTitle: "Your best project to fix this",
    bestProjectWhyTitle: "Why this project",
    bestProjectWhatTitle: "What you will do",
    bestProjectOutcomeTitle: "Expected outcome",
    bestPathCareerTitle: "Best path for you:",
    bestPathRoadmapTitle: "Execution roadmap",
    bestPathPhaseImmediate: "PHASE 1 — Immediate Fix (0–7 days)",
    bestPathPhaseStrategic: "PHASE 2 — Strategic Build (2–4 weeks)",
    bestPathPhaseApplication: "PHASE 3 — Application Strategy",
    bestPathTransformTitle: "If you follow this path:",
    bestPathTransformFit: "Fit score: {fit}",
    doThisFirstTitle: "DO THIS FIRST",
    scanSectionLabel: "Quick decision view",
    scanCriticalGapTitle: "Critical gap",
    scanOneMoveTitle: "One move",
    scanBestPathTitle: "Best path",
    scanWhyRejectedTitle: "Why you get rejected",
    scanAllGapsTitle: "All gaps",
    scanMoreGaps: "Show {n} more gaps",
    scanFullRoadmapTitle: "Full roadmap",
    scanRoadmapLocked: "Full roadmap is available in Pro only.",
    focusPreviewSectionTitle: "What's in your full analysis?",
    focusPreviewCtaTitle: "See exactly why you get screened out",
    focusPreviewCtaSubtitle: "Full recruiter read on your CV vs this JD, every gap ranked, fixes ordered by score impact, plus company and ATS context.",
    focusPreviewUpgradeBtn: "Reveal your full rejection breakdown →",
    focusPreviewCardRecruiter: "Recruiter view",
    focusPreviewCardGaps: "All gaps",
    focusPreviewCardPlan: "Action plan",
    focusPreviewCardMarket: "Company & market",
    focusProDetailTitle: "Detailed breakdown",
    previewHiddenCountLine: "+{n} more insights hidden",
    previewFallbackRequirement: "role-fit baseline requirement",
    previewFallbackReality: "Your current CV signal is not yet aligned to this requirement.",
    previewRecruiterDecisionIntro: "If I were the recruiter, I would likely reject you for this role because:",
    previewRecruiterReqLine: "This role requires: {req}",
    previewRecruiterRealityLine: "Your CV currently shows: {reality}",
    previewRecruiterConsequenceLine: "→ This mismatch creates early rejection risk in first screening.",
    previewRecruiterMissingKeyword: "Missing keyword signal for this role: {kw}",
    previewRecruiterAltIntro: "However, you are a stronger fit for:",
    previewRecruiterBecauseIntro: "Because:",
    previewRecruiterBecauseSkill: "You already show signal in: {skill}",
    previewFallbackRoleA: "Business Analyst",
    previewFallbackRoleB: "Operations Analyst",
    previewFallbackRoleAData: "Data Analyst",
    previewFallbackRoleBData: "Business Analyst",
    previewFallbackRecruiterFirst: "Recruiter signals for this CV and job will appear here after Pro.",
    previewEmptyGapsBrief: "Gap list vs this posting is available in the full analysis.",
    previewGapWhyDegree: "This posting explicitly filters for engineering-aligned education signals.",
    previewGapWhyLanguage: "Language proficiency is a hard gate in the shortlisting stage.",
    previewGapWhySector: "Domain context is expected to reduce ramp-up risk.",
    previewGapWhyImpact: "Recruiters need quantified outcomes to trust execution quality.",
    previewGapWhyPositioning: "Positioning misalignment makes your fit signal weaker than it should be.",
    previewGapWhyGeneric: "This gap weakens decision confidence during recruiter screening.",
    previewPlanStrategic1: "1. Stop applying to roles that require strict engineering credentials.",
    previewPlanStrategic2: "2. Reposition your CV toward strategy and analytics-heavy role tracks.",
    previewPlanStrategic3: "3. Add one measurable project with clear impact metrics.",
    previewPlanStrategic4: "4. Reframe your top bullets around business outcomes, not only responsibilities.",
    previewPlanStrategic5: "5. Match job-keyword language in your summary and core experience.",
    previewPlanStrategic6: "6. Re-run fit check and apply only when rejection risk drops.",
    previewWeek1Label: "Week 1:",
    previewWeek2Label: "Week 2:",
    previewWeek3Label: "Week 3:",
    previewExpectedImpactLabel: "Expected impact:",
    previewInterviewImpactLine: "Interview probability: +{x}%",
    previewProfileStrengthLine: "Profile strength: +{y} points",
    previewCompanyFocusLine: "{company}",
    previewCompanyFocusFallback: "Company context is detected from your target role and sector signals.",
    previewCompanyValueLine: "What they prioritize: {value}",
    previewCompanyValueFallback: "Technical execution and role-specific delivery proof.",
    previewCompanyMismatchLine: "→ Your current profile shows a mismatch on: {gap}",
    previewCompanyMismatchFallback: "→ Your current profile signal is weaker than the role expectation.",
    previewCompanyDirectionLine: "→ Better fit direction: {direction}",
    previewAtsFallback: "ATS fit context will be unlocked with full analysis.",
    previewCareerDirectionFallback: "strategy / analytics / business tracks",
    previewAtsScoreShort: "ATS score",
    previewKeywordMatchShort: "Keyword match",
    previewCareerDirPrefix: "Career direction",
    previewImpactHigh: "Critical",
    previewImpactMedium: "Major",
    previewImpactLow: "Minor",
    previewEmptyRecruiter: "No recruiter signals in this run.",
    previewEmptyGaps: "No gap list in this run.",
    previewEmptyPlan: "No action plan steps in this run.",
    previewEmptyMarket: "No company or market block in this run.",
  },
  TR: {
    slogan: "AI Career Decision Engine",
    privacy: "Gizlilik Politikası",
    terms: "Kullanım Şartları",
    cookiePolicy: "Çerez Politikası",
    heroTitle: "CV'niz neden sürekli reddediliyor?",
    heroDesc: "HireFit, CV'nizi iş ilanıyla karşılaştırır ve işe alım uzmanlarının tam olarak ne gördüğünü saniyeler içinde söyler.",
    analyzeBtn: "CV'mi Ücretsiz Analiz Et",
    viewDashboard: "Paneli Görüntüle",
    checkFit: "Uyumu Kontrol Et",
    optimizeCV: "👉 CV'de harekete geç",
    learningRoadmap: "Öğrenme Yol Haritası",
    pasteCv: "CV metninizi buraya yapıştırın...",
    pasteJd: "İş ilanını buraya yapıştırın...",
    candidateCV: "Aday CV'si",
    jobDesc: "İş Tanımı",
    uploadPdf: "PDF Yükle",
    reading: "Okunuyor...",
    freeToUse: "Ücretsiz kullanım",
    analyzing: "Analiz ediliyor...",
    optimizing: "Optimize ediliyor...",
    building: "Oluşturuluyor...",
    noAnalyses: "Henüz analiz yok.",
    previousAnalyses: "Önceki Analizler",
    freeLimitWarning: "ücretsiz analiz hakkın kaldı",
    noFreeLeft: "Ücretsiz hakkın bitti — Pro'ya Geç",
    upgradeBtn: "Pro'ya Geç — $9.99/ay 🚀",
    maybeLater: "Belki sonra",
    paywallTitle: "Ücretsiz limitine ulaştın",
    paywallDesc: "2 ücretsiz analizini kullandın. Sınırsız analiz, CV Yazıcı, İşe Alım Simülasyonu ve tam içgörüler için Pro'ya geç.",
    cvAnalyzer: "CV Uyum Analizörü",
    cvAnalyzerDesc: "CV'nizi ve iş ilanını yapıştırın — saniyeler içinde red nedenleri ve düzeltme önerileri alın.",
    extract: "Çıkar",
    extracting: "Çıkarılıyor...",
    wordsLoaded: "kelime yüklendi",
    copyReport: "Raporu Kopyala",
    download: "İndir",
    copyOptimized: "Optimize Edilmişi Kopyala",
    originalCV: "Orijinal CV",
    optimizedCV: "Optimize Edilmiş CV",
    cvComparison: "✦ CV Karşılaştırması",
    learningRoadmapTitle: "✦ Öğrenme Yol Haritası",
    copy: "Kopyala",
    clear: "Temizle",
    viewReport: "Raporu Gör →",
    signOut: "Çıkış Yap",
    login: "Giriş Yap",
    welcomeBack: "Tekrar Hoşgeldiniz",
    signInDesc: "HireFit hesabınıza giriş yapın",
    continueBtn: "Devam Et",
    continueGoogle: "Google ile Devam Et",
    dashboard: "Panel",
    dashboardDesc: "Analiz geçmişiniz ve performans özetiniz.",
    totalAnalyses: "Toplam Analiz",
    averageScore: "Ortalama Skor",
    currentPlan: "Mevcut Plan",
    waitlistLeads: "Bekleme Listesi",
    productRoadmap: "Ürün Yol Haritası",
    openProduct: "Ürünü Aç",
    home: "Ana Sayfa",
    product: "Ürün",
    recentAnalyses: "Son Analizler",
    allSystemsOp: "Tüm sistemler çalışıyor",
    applyFix: "Harekete geç →",
    applying: "Uygulanıyor...",
    fixApplied: "Uygulandı ✓",
    copyFix: "Kopyala",
    proOnly: "Sadece Pro",
    upgradeToSee: "Tüm düzeltmeleri görmek için Pro'ya geç",
    scoreProgress: "Skor Geçmişi",
    improvement: "iyileşme",
    latestScore: "Son",
    careerJourneyTitle: "Kariyer Yolculuğun",
    careerJourneyBlurb: "Beceri boşluklarından hedef rolünüze kadar her kilometre taşını görün—ardından HireFit analizinizi işe taşıyın.",
    startApplyingNow: "Şimdi Başvurmaya Başla",
    roadmapPageEmpty: "Üründe analiz çalıştırıp öğrenme yol haritası oluşturduğunuzda kişisel rotanız burada görünür.",
    roadmapReadyBanner: "Öğrenme yol haritanız hazır.",
    openJourneyMap: "Tam yolculuk haritasını aç",
    anonSaveTitle: "Sonuçlarını kaydet",
    anonSaveDesc: "Giriş yaparak analizlerini hesabında sakla ve cihazlar arası senkronize et.",
    anonSaveCta: "Giriş yap",
    anonSaveDismiss: "Şimdilik hayır",
    unlockWithPro: "Pro ile aç",
    proFeatureRoles: "CV'nin uyduğu diğer roller — Pro'da.",
    proFeatureInterview: "Role özel mülakat soruları — Pro'da.",
    rolesEmptyPro: "Bu CV için ek rol önerisi çıkmadı.",
    rolesEmptyGeneric: "Bu raporda çapraz rol eşleşmesi yok.",
    rolesEmptyGuidance: "Bu rapor için henüz rol matrisi üretilmedi.",
    rolesEmptyNext: "Çapraz rol önerileri için Pro'ya geçin veya CV'ye net rol başlıkları ekleyip Uyumu Kontrol Et'i yeniden çalıştırın.",
    interviewEmpty: "Bu raporda mülakat sorusu yok.",
    interviewEmptyGuidance: "Bu çalıştırmaya bağlı mülakat sorusu eklenmedi.",
    interviewEmptyNext: "Yukarıdaki aksiyon planı adımlarını kullanın; ardından CV'nizden bir metrikle tek bir cevap prova edin.",
    confidenceNA: "Yok",
    confidenceUnavailableLabel: "Bu turda skorlanmadı",
    confidenceUnavailableNext: "CV ve ilan metni tam yüklendikten sonra Uyumu Kontrol Et'i tekrar çalıştırın.",
    decisionUnavailable: "Karar bekleniyor",
    decisionUnavailableNext: "CV ve iş ilanını yapıştırıp Uyumu Kontrol Et ile başvuru / risk sinyalini görün.",
    analysisFailedTitle: "Analizi tamamlayamadık.",
    analysisFailedRecovery: "Bağlantınızı kontrol edin; CV ve iş ilanının yapıştırıldığından emin olun, ardından Uyumu Kontrol Et'e basın. VPN kullanıyorsanız kısa süre kapatıp deneyin.",
    cvOptimizeFailedTitle: "CV optimizasyonu tamamlanmadı.",
    cvOptimizeFailedRecovery: "Birkaç saniye bekleyip CV'mi düzelt'i yeniden deneyin. Her iki alanda da yeterli metin olmalı.",
    roadmapFailedTitle: "Öğrenme yol haritası oluşturulamadı.",
    roadmapFailedRecovery: "Önce Uyumu Kontrol Et çalıştırıp eksik becerileri tespit edin, sonra yol haritasını tekrar açın.",
    roadmapNeedsSkillsTitle: "Önce analizden eksik beceri sinyali gerekiyor.",
    roadmapNeedsSkillsRecovery: "Bu CV ve ilan için Uyumu Kontrol Et çalıştırın, ardından öğrenme yol haritasını açın.",
    pdfReadFailedTitle: "PDF okunamadı.",
    pdfReadFailedRecovery: "Daha küçük dosya deneyin, Word'den metin olarak dışa aktarın veya CV'yi doğrudan yapıştırın.",
    fileReadFailedTitle: "Dosya okunamadı.",
    fileReadFailedRecovery: "CV veya ilan için .txt kullanın veya düz metin yapıştırın.",
    extractionRecovery: "İş ilanı metnini elle yapıştırın — tam metin en doğru sonucu verir.",
    emptyRecruiterSignals: "CV'n ilk taramada zayıf recruiter sinyali veriyor.",
    emptyRecruiterNext: "Sonuç, araç ve sahiplik kanıtı ekleyerek etkiyi daha okunur yap.",
    emptyGapList: "Bu rol için en büyük engel hâlâ konumlanma netliği.",
    emptyGapNextFree: "Tam liste için Pro'ya geçin veya daha uzun ilan metni yapıştırıp yeniden analiz edin.",
    emptyGapNextPro: "CV'yi güncellediyseniz boşlukları yenilemek için Uyumu Kontrol Et'i tekrar çalıştırın.",
    emptyPlanFallback: "Recruiter okunabilirliğini artıracak tek bir yüksek etkili adımla başla.",
    emptyPlanNext: "Bir düzeltme uygula, sonra skordaki hareketi doğrulamak için yeniden analiz et.",
    emptySkillsMissing: "CV'n, ilanın istediği anahtar kelimeleri henüz net taşımıyor.",
    emptySkillsMissingNext: "İlandaki zorunlu araç ve sorumluluk dilini CV'ne doğrudan yansıt.",
    emptySkillsMatched: "Mevcut CV kanıtı güçlü anahtar kelime eşleşmesi için yeterince açık değil.",
    emptySkillsMatchedNext: "Ana deneyim maddelerine rol odaklı araçlar ve nicel sonuçlar ekle.",
    emptyKeywordsNone: "İlan ile CV arasındaki anahtar kelime köprüsü şu an zayıf.",
    emptyKeywordsNext: "İlandaki kritik terimleri en güçlü deneyim maddelerinde tekrar et.",
    emptyMarketRoles: "Mevcut sinyallerle yine de güçlü rol yönünü çıkarabiliriz.",
    emptyMarketRolesNext: "Önce tek hedef role odaklan, kanıtı güçlendir, sonra rol yelpazesini genişlet.",
    ciEmptyOverview: "Bu pakette şirket özeti metni yok.",
    ciEmptyOverviewNext: "Şirket analizini sonra tekrar deneyin veya CV–ilan aksiyon planıyla devam edin.",
    ciEmptyCareer: "Kariyer fırsatı maddesi henüz yok.",
    ciEmptyCareerNext: "İlanı genişletin veya bildiğiniz şirket adını ekleyin.",
    ciEmptySector: "Sektör konumu özeti henüz yok.",
    ciEmptySectorNext: "Daha zengin ilan yapıştırın veya analizi yeniden çalıştırın.",
    ciEmptyCvTrends: "Sektör trend karşılaştırması henüz yok.",
    ciEmptyCvTrendsNext: "Yeni analiz yapın veya anahtar kelimeler için Beceriler sekmesini kullanın.",
    companyIntelTitle: "Şirket Analizi",
    companyIntelSectorTitle: "Sektör analizi",
    ciCompanyStructure: "Şirket genel yapısı",
    ciEmployeeExperience: "Çalışan deneyimi",
    ciCareerOpportunities: "Kariyer fırsatları",
    ciSectorPosition: "Sektör konumu",
    ciCvVsTrends: "CV'niz ve sektör talebi",
    ciPrepTitle: "Bu role hazırlanmak için önerilen adımlar",
    ciRoadmapCta: "Öğrenme Yol Haritası",
    ciUpgradeRoadmap: "Detaylı yol haritası için Pro'ya geçin",
    detectedSectorLabel: "Algılanan sektör",
    sectorOverrideHint: "Manuel düzeltme (isteğe bağlı)",
    orPasteLinkHint: "veya iş ilanı linkini yapıştırın",
    finalVerdict: "Karar",
    alignmentScore: "Uyum skoru",
    rejectionRisk: "Elenme Riski",
    confidenceLabel: "Güven",
    recruiterView: "Recruiter Görüşü",
    whatTheyThink: "Gerçekte ne düşündükleri",
    deepAnalysis: "Derin Analiz",
    whyYouFail: "Boşluk analizi",
    actionPlan: "Aksiyon Planı",
    whatToDoNext: "Başvurmadan önce yapılacaklar",
    skillsKeywords: "Beceriler & Anahtar Kelimeler",
    missingSignals: "Anahtar kelime eşleşme dökümü",
    marketInsights: "Pazar İçgörüleri",
    careerLanes: "Kariyer uyumu ve pazar bağlamı",
    decisionReasoning: "Karar Gerekçesi",
    impactProjection: "ETKİ TAHMİNİ",
    nowAfter: "ŞİMDİ → SONRA",
    currentScore: "Mevcut Skor",
    projectedScore: "Hedef Skor",
    scoreIncrease: "Skor Artışı",
    strongSignals: "Güçlü sinyaller",
    weakSignals: "Zayıf sinyaller",
    simulatedRecruiterPatterns: "Simüle recruiter paternlerine dayalı",
    atsStyleAnalysis: "ATS-stili analiz",
    sectorLens: "Sektör analizi: ",
    notAvailableForAnalysis: "Bu bölüm için veri sınırlı — aşağıdaki sonraki adıma bakın.",
    emptyNoneDetectedSkills: "CV'n şu an ilanın anahtar kelime diliyle net eşleşmiyor.",
    emptyNoneDetectedSkillsNext: "Rolün temel araç ve sonuçlarını en güçlü maddelerine doğrudan ekle.",
    biggestBlockerLead: "En büyük engel: ",
    missingFromCv: "CV'nizde eksik",
    detectedInCv: "CV'nizde tespit edilen",
    unlockProArrow: "Pro ile aç →",
    doThisNext: "Önce bunu yap",
    doThisNextLeverage: "Recruiter 10 saniyede doğrulayacağı kanıt: rakam, link, sertifika, repo — vibe değil.",
    fixScoreImpactApprox: "Bunu düzeltmek skorunuza yaklaşık +{pts} puan ekleyebilir.",
    scoreVsLastRun: "Son analize göre: {delta} (önceki: {prior})",
    recruiterBluntBanner: "Soğuk okuma: nerede okumayı keser. Motivasyon değil — boşluk.",
    seeFullPlan: "Şimdi düzeltmeye başla →",
    primaryBlocker: "Birincil engel",
    fixFirst: "Önce bunu düzelt",
    priorityImportant: "Önemli",
    priorityOptional: "İsteğe bağlı",
    priorityFixes: "Öncelikli düzeltmeler",
    interviewPrepShort: "Mülakat hazırlığı",
    sanitizeParsingFailed:
      "CV'nizi mevcut sinyallere göre analiz ettik.",
    executionProgress: "İlerleme",
    fixesCompletedCount: "{done}/{total} düzeltme tamamlandı olarak işaretlendi",
    executionLadder: "Düzeltmeleri sırayla tamamlarsanız tahmini hizalama",
    projectedStepHint: "{from} → {to}",
    projectedAfterFixOrder: "Bu düzeltme (ve öncekiler sırayla) sonrası: {score}",
    progressScoreLive: "İlerleme skoru (işaretlenen düzeltmeler): {score} ({delta})",
    proofPromptWhenDone:
      "Portföy, PR veya sertifika linki ya da tek satır kanıt yapıştırın — düzeltmeyi tamamlamak için gerekli:",
    proofRequiredShort: "Kanıt boş olamaz. Düzeltme tamamlanmadı olarak bırakıldı.",
    proofStoredLabel: "Kayıtlı kanıt:",
    proofStepHeading: "Kanıt — link veya yükleme",
    proofPasteLinkPlaceholder: "Link veya kısa not yapıştırın…",
    proofUploadFile: "Kanıt dosyası yükle (.txt / PDF / görsel)",
    proofFileLabel: "Dosya",
    betterRoleAlternatives: "Daha iyi rol alternatifleri (CV uyumu)",
    betterRoleAlternativesSub:
      "CV kanıtınıza göre bu ilan hizalamasından daha yüksek skorlanan hatlar — pivot fikri olarak düşünün, garanti değildir.",
    reanalysisScoreHint: "Bu tarayıcıdaki önceki Uyumu Kontrol Et ile karşılaştırma.",
    markFixComplete: "Bu düzeltmeyi tamamlandı işaretle",
    markFixDoneAria: "{n}. düzeltmeyi tamamlandı olarak işaretle",
    verdictBadTitle: "🚫 Büyük ihtimalle elenirsin",
    verdictBadSub:
      "Bu senin potansiyelin değil — bu rolün filtresiyle uyum eksikliği.",
    verdictRiskyTitle: "⚠️ Riskli başvuru",
    verdictRiskySub: "Yakınsın — ama recruiter'ın ilk turda aradığı kritik sinyaller eksik.",
    verdictCloseTitle: "⚡ Rekabetçi — kanıtı sıkılaştır",
    verdictCloseSub: "Bu yığında savaşabilirsin. Her boşluk için tek net kanıt satırı, sonra gönder.",
    verdictStrongTitle: "✅ Güçlü eşleşme",
    verdictStrongSub: "İlk elemeden geçme şansın gerçek.",
    startFixingNow: "Konumlanmanı düzelt →",
    takeActionBtn: "Harekete geç →",
    startThisStep: "Misyona başla →",
    fixPointsIfDone: "🔥 Tamamlarsan +{pts} puan",
    fixProgressApplied: "✅ İlerleme işlendi: +{pts}",
    proofAddedToast: "Kanıt eklendi",
    proofTrustToast: "Recruiter güven sinyali kaydedildi",
    proofImpactToast: "İlerleme skoruna +{pts} etki uygulandı",
    fixMyCvRun: "CV'de harekete geç →",
    fixMyCvUnlock: "Harekete geç — Pro ile aç →",
    heroStopBig: "Dur.",
    heroStopLine1: "Şu an başvurursan → elenme ihtimali yüksek.",
    heroStopLine2: "Ama sandığından yakınsın. 2 kritik boşluğu kapat, mülakat bandına çık.",
    heroRiskBig: "Henüz güvenli değil.",
    heroRiskLine1: "Gerçeklik kontrolü: ilk tur için hâlâ riskli.",
    heroRiskLine2: "Toparlanma yolu: sonraki 1-2 boşluğu kapat, tekrar aralığa gir.",
    heroCloseBig: "Yakınsın.",
    heroCloseLine1: "Gerçeklik kontrolü: rekabetçisin ama bitmedi.",
    heroCloseLine2: "Toparlanma yolu: metrik + araç kanıtını sıkılaştır, sonra gönder.",
    heroStrongBig: "Yeşil ışık.",
    heroStrongLine1: "Gerçeklik kontrolü: bu ilan için mülakat aralığındasın.",
    heroStrongLine2: "Toparlanma yolu: kanıtı güçlü tut ve özgüvenle başvur.",
    scoreInsightLow: "Bu ilan için tipik işe alım barının altında.",
    scoreInsightMid: "Yakınsın — ama henüz varsayılan aday seviyesinde değilsin.",
    scoreInsightHigh: "Mülakat aralığındasın.",
    scoreInsightBench: "Burada çoğu güçlü aday 70 üstü skorlar.",
    yourProgressTitle: "İlerlemen",
    yourProgressPoints: "Şu ana +{pts} puan kazandın",
    yourProgressNext: "Sıradaki en iyi hamle: {action}",
    yourProgressBarLabel: "Mülakat bandına yol (70)",
    yourProgressNudge: "70'i geçmek için {n} yüksek etkili adım daha.",
    yourProgressAllDone: "70 barını geçtin — kanıt göndermeye devam.",
    recruiterRealLead: "Asıl mesele şu:",
    recruiterRealIntro: "CV'n ne inşa ettiğini veya teslim ettiğini bağırmıyor. Recruiter taramasında:",
    recruiterLensLine1: "→ Etki kanıtı yok",
    recruiterLensLine2: "→ Ölçülebilir sonuç yok",
    recruiterLensLine3: "→ Araç yığını net değil",
    impactFixUnlock: "🔥 Konumlanmanı düzelt → +{pts} puan aç",
    impactMovesCloser: "+{pts} seni mülakat bandına yaklaştırır.",
    stepCtaOpenLink: "Linki aç →",
    stepCtaGithub: "GitHub rehberi →",
    stepCtaApply: "Hedef bölgeye gir →",
    impactUnlockedLine: "Etki açıldı",
    focusVerdictKicker: "Sonuç",
    focusOverallStatusLabel: "Genel durum",
    focusRiskKicker: "Elenme riski",
    focusMainProblemKicker: "Ana red nedeni",
    focusImpactKicker: "Skor etkisi",
    focusImpactExpl: "Bu boşluğu kapatmak profil gücün için yaklaşık +{pts} puanlık bir kazanım demek.",
    focusActionKicker: "Tek hamlen",
    focusCtaSeeFull: "Neden elendiğini tam gör →",
    focusCtaApplyFix: "Bu odağı CV'me uygula →",
    focusHiddenGapsTeaser: "Skorunu etkileyen {n} boşluk daha var. Tüm dökümü Pro ile görebilirsin.",
    bestPathForwardTitle: "Your best path forward",
    bestPathSignalLine: "Profil sinyali: {bg} → hedef hat: {track}",
    bestPathRolesTitle: "Profiline göre daha güçlü olduğun roller:",
    bestPathWhyRolesTitle: "Bu roller neden daha uygun",
    bestPathWrongRoleTitle: "Bu rol neden yanlış eşleşme",
    bestPathFreeHint: "Ücretsiz görünüm sadece roller ve proje başlığını gösterir. Tam proje dökümü ve yol haritası için Pro'yu aç.",
    bestProjectSectionTitle: "Your best project to fix this",
    bestProjectWhyTitle: "Bu proje neden en doğru seçim",
    bestProjectWhatTitle: "Ne yapacaksın",
    bestProjectOutcomeTitle: "Beklenen çıktı",
    bestPathCareerTitle: "Senin için en iyi yol:",
    bestPathRoadmapTitle: "Yürütme yol haritası",
    bestPathPhaseImmediate: "PHASE 1 — Immediate Fix (0–7 gün)",
    bestPathPhaseStrategic: "PHASE 2 — Strategic Build (2–4 hafta)",
    bestPathPhaseApplication: "PHASE 3 — Application Strategy",
    bestPathTransformTitle: "Bu yolu uygularsan:",
    bestPathTransformFit: "Fit skoru: {fit}",
    doThisFirstTitle: "ÖNCE BUNU YAP",
    scanSectionLabel: "Hızlı karar görünümü",
    scanCriticalGapTitle: "Kritik boşluk",
    scanOneMoveTitle: "Tek hamle",
    scanBestPathTitle: "En iyi yol",
    scanWhyRejectedTitle: "Neden eleniyorsun",
    scanAllGapsTitle: "Tüm boşluklar",
    scanMoreGaps: "{n} boşluk daha göster",
    scanFullRoadmapTitle: "Tam yol haritası",
    scanRoadmapLocked: "Tam yol haritası sadece Pro'da açık.",
    focusPreviewSectionTitle: "Pro analizinde neler var?",
    focusPreviewCtaTitle: "Neden elendiğini satır satır gör",
    focusPreviewCtaSubtitle: "Bu ilana göre recruiter taraması, tüm boşluklar, skora göre sıralı düzeltmeler ve şirket ile ATS bağlamı.",
    focusPreviewUpgradeBtn: "Tam red dökümünü aç →",
    focusPreviewCardRecruiter: "Recruiter görüşü",
    focusPreviewCardGaps: "Tüm boşluklar",
    focusPreviewCardPlan: "Aksiyon planı",
    focusPreviewCardMarket: "Şirket ve pazar",
    focusProDetailTitle: "Detaylı döküm",
    focusTrustLine: "CV ve iş gerekliliği uyumsuzluk analizine dayanır",
    previewHiddenCountLine: "+{n} içgörü daha gizli",
    previewFallbackRequirement: "rol için temel gereklilik sinyali",
    previewFallbackReality: "Mevcut CV sinyalin bu gereklilikle henüz örtüşmüyor.",
    previewRecruiterDecisionIntro: "Ben recruiter olsaydım bu rol için seni büyük olasılıkla elerdim, çünkü:",
    previewRecruiterReqLine: "Bu rolün gerektirdiği sinyal: {req}",
    previewRecruiterRealityLine: "CV'nde şu sinyal öne çıkıyor: {reality}",
    previewRecruiterConsequenceLine: "→ Bu uyumsuzluk ilk elemede erken red riskini artırır.",
    previewRecruiterMissingKeyword: "Bu rol için eksik anahtar kelime sinyali: {kw}",
    previewRecruiterAltIntro: "Buna karşın daha güçlü uyduğun roller:",
    previewRecruiterBecauseIntro: "Çünkü:",
    previewRecruiterBecauseSkill: "Zaten güçlü sinyal verdiğin alan: {skill}",
    previewFallbackRoleA: "İş Analisti",
    previewFallbackRoleB: "Operasyon Analisti",
    previewFallbackRoleAData: "Veri Analisti",
    previewFallbackRoleBData: "İş Analisti",
    previewFallbackRecruiterFirst: "Bu CV ve bu ilan için işe alım uzmanı görüşü Pro’da görünür.",
    previewEmptyGapsBrief: "Bu ilana karşı boşluk listesi tam analizde yer alır.",
    previewGapWhyDegree: "Bu ilanda mühendislik odaklı eğitim sinyali açık bir eleme filtresi.",
    previewGapWhyLanguage: "Dil seviyesi kısa liste aşamasında doğrudan eşik etkisi yaratır.",
    previewGapWhySector: "Alan deneyimi, adaptasyon riskini düşürmek için beklenir.",
    previewGapWhyImpact: "İşe alım uzmanı, uygulama kalitesini sayısal sonuçlarla doğrular.",
    previewGapWhyPositioning: "Konumlanma zayıf kalınca rol uyum sinyali düşer.",
    previewGapWhyGeneric: "Bu boşluk, işe alım kararındaki güveni aşağı çeker.",
    previewPlanStrategic1: "1. Mühendislik diploması isteyen rollere başvurmayı durdur.",
    previewPlanStrategic2: "2. CV'ni strateji ve analitik rol hattına göre yeniden konumlandır.",
    previewPlanStrategic3: "3. Ölçülebilir etkisi olan tek bir proje ekle.",
    previewPlanStrategic4: "4. Üst maddeleri görev değil, iş sonucu odaklı yeniden yaz.",
    previewPlanStrategic5: "5. İlanın anahtar dilini özet ve deneyim bölümüne eşleştir.",
    previewPlanStrategic6: "6. Uyumu tekrar ölç, red riski düşmeden başvuru yapma.",
    previewWeek1Label: "1. Hafta:",
    previewWeek2Label: "2. Hafta:",
    previewWeek3Label: "3. Hafta:",
    previewExpectedImpactLabel: "Beklenen etki:",
    previewInterviewImpactLine: "Mülakat olasılığı: +%{x}",
    previewProfileStrengthLine: "Profil gücü: +{y} puan",
    previewCompanyFocusLine: "{company}",
    previewCompanyFocusFallback: "Şirket bağlamı hedef rol ve sektör sinyallerinden çıkarıldı.",
    previewCompanyValueLine: "Öncelik verdikleri alan: {value}",
    previewCompanyValueFallback: "Teknik uygulama gücü ve role özgü teslimat kanıtı.",
    previewCompanyMismatchLine: "→ Profilinde şu alanda uyumsuzluk görünüyor: {gap}",
    previewCompanyMismatchFallback: "→ Profil sinyalin, rol beklentisinin gerisinde kalıyor.",
    previewCompanyDirectionLine: "→ Daha uygun yön: {direction}",
    previewAtsFallback: "ATS uyum detayları tam analizde açılır.",
    previewCareerDirectionFallback: "strateji / analitik / iş odaklı rol hatları",
    previewAtsScoreShort: "ATS skoru",
    previewKeywordMatchShort: "Kelime eşleşmesi",
    previewCareerDirPrefix: "Kariyer yönü",
    previewImpactHigh: "Kritik",
    previewImpactMedium: "Majör",
    previewImpactLow: "Minör",
    previewEmptyRecruiter: "Bu turda recruiter metni yok.",
    previewEmptyGaps: "Bu turda boşluk listesi yok.",
    previewEmptyPlan: "Bu turda aksiyon adımı yok.",
    previewEmptyMarket: "Bu turda şirket veya pazar özeti yok.",
  },
};

const T = {
  bg: "#020617",
  bgCard: "rgba(255,255,255,0.03)",
  bgCardHover: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.08)",
  blue: "#3b82f6",
  blueGlow: "rgba(59,130,246,0.25)",
  cyan: "#22d3ee",
  green: "#10b981",
  text: "#f1f5f9",
  textMuted: "#64748b",
  textSub: "#94a3b8",
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: linear-gradient(165deg, #020617 0%, #0f172a 45%, #0a0f1c 100%); background-attachment: fixed; font-family: 'DM Sans', sans-serif; color: ${T.text}; -webkit-font-smoothing: antialiased; }
  .hf-btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: ${T.blue}; border: none; border-radius: 10px; cursor: pointer; color: white; font-weight: 600; font-size: 15px; font-family: 'DM Sans', sans-serif; transition: all 0.2s ease; }
  .hf-btn-primary:hover { background: #2563eb; box-shadow: 0 0 30px ${T.blueGlow}; transform: translateY(-1px); }
  .hf-btn-ghost { display: inline-flex; align-items: center; gap: 8px; padding: 11px 20px; background: transparent; border: 1px solid ${T.border}; border-radius: 10px; cursor: pointer; color: ${T.textSub}; font-weight: 500; font-size: 14px; font-family: 'DM Sans', sans-serif; transition: all 0.2s ease; }
  .hf-btn-ghost:hover { border-color: rgba(255,255,255,0.2); color: white; background: rgba(255,255,255,0.04); }
  .hf-card { background: rgba(17,24,39,0.72); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease; box-shadow: 0 18px 50px rgba(0,0,0,0.35); }
  .hf-card:hover { background: rgba(30,41,59,0.85); border-color: rgba(255,255,255,0.14); transform: translateY(-3px); box-shadow: 0 24px 60px rgba(0,0,0,0.45); }
  .hf-feature-card { background: ${T.bgCard}; border: 1px solid ${T.border}; border-radius: 20px; padding: 32px; transition: all 0.3s ease; position: relative; overflow: hidden; }
  .hf-feature-card:hover { background: ${T.bgCardHover}; border-color: rgba(59,130,246,0.2); transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${T.blueGlow}; }
  .hf-input { width: 100%; padding: 13px 16px; border-radius: 10px; border: 1px solid ${T.border}; background: rgba(255,255,255,0.03); color: white; outline: none; font-family: 'DM Sans', sans-serif; font-size: 14px; transition: border-color 0.2s; }
  .hf-input:focus { border-color: rgba(59,130,246,0.5); }
  .hf-input::placeholder { color: ${T.textMuted}; }
  .hf-textarea { width: 100%; padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.2); color: white; resize: none; outline: none; font-family: 'DM Sans', sans-serif; font-size: 13px; line-height: 1.6; transition: border-color 0.2s; flex: 1; min-height: 0; }
  .hf-textarea:focus { border-color: rgba(59,130,246,0.5); }
  .hf-textarea::placeholder { color: ${T.textMuted}; }
  .pricing-card { border-radius: 20px; padding: 32px; transition: all 0.3s ease; }
  .pricing-card:hover { transform: translateY(-4px); }
  .nav-link { padding: 8px 14px; border-radius: 8px; color: ${T.textSub}; font-size: 14px; font-weight: 500; cursor: pointer; border: none; background: transparent; font-family: 'DM Sans', sans-serif; transition: all 0.15s ease; }
  .nav-link:hover { color: white; background: rgba(255,255,255,0.06); }
  .nav-link.active { color: white; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rejectedPop { 
  0% { opacity:0; transform:scale(0.5); } 
  60% { transform:scale(1.15); } 
  100% { opacity:1; transform:scale(1); } 
}
`;

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    maxWidth: "none",
    margin: 0,
    overflowX: "hidden",
    background: "linear-gradient(165deg, #020617 0%, #0f172a 50%, #0c1222 100%)",
    color: T.text,
    fontFamily: "'DM Sans', sans-serif",
  },
  container: { maxWidth: "1500px", margin: "0 auto", padding: "0 24px", width: "100%" },
};

if (!document.getElementById("hirefit-styles")) {
  const el = document.createElement("style");
  el.id = "hirefit-styles";
  el.textContent = globalStyles;
  document.head.appendChild(el);
}

function ProgressBar({ value, color = T.blue }) {
  return (
    <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: color, borderRadius: 999, transition: "width 0.6s ease" }} />
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="hf-card" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ color: T.textMuted, fontSize: "13px", fontWeight: 500 }}>{title}</div>
        {icon}
      </div>
      <div style={{ fontSize: "28px", fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{value}</div>
    </div>
  );
}

function HistoryList({ history, onLoadItem, onClear, compact = false, lang }) {
  const t = translations[lang];
  return (
    <div className="hf-card" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: compact ? "15px" : "18px", fontWeight: 700 }}>
          <History size={16} color={T.blue} />
          {compact ? t.previousAnalyses : t.recentAnalyses}
        </h3>
        <button onClick={onClear} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 600, fontSize: "12px", fontFamily: "'DM Sans', sans-serif" }}>
          <Trash2 size={12} /> {t.clear}
        </button>
      </div>
      {history.length === 0 ? (
        <div style={{ color: T.textMuted, fontSize: "13px", textAlign: "center", padding: "24px 0" }}>{t.noAnalyses}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {history.map((item) => (
            <div key={item.id}>
              <button onClick={() => onLoadItem(item)} style={{ textAlign: "left", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, cursor: "pointer", color: "white", width: "100%", fontFamily: "'DM Sans', sans-serif" }}>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: "14px" }}>{item.role}</div>
                <div style={{ fontSize: "12px", color: T.blue, marginBottom: 2 }}>Score: {item.score}/100</div>
                <div style={{ fontSize: "11px", color: T.textMuted }}>{item.createdAt}</div>
              </button>
              <a href={`/report/${item.id}`} target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: T.cyan, textDecoration: "none", display: "block", marginTop: 4, marginLeft: 4 }}>
                {t.viewReport}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



function parseBullets(text, sectionName) {
  const regex = new RegExp(`${sectionName}:([\\s\\S]*?)(\\n[A-Z][A-Za-z ]+:|$)`, "i");
  const match = text.match(regex);
  if (!match) return [];
  return match[1].split("\n").map((l) => l.replace(/^[-•\s*]+/, "").trim()).filter(Boolean);
}

function PaywallModal({ onClose, onUpgrade, lang }) {
  const t = translations[lang];
  const features = lang === "TR"
    ? ["Sınırsız analiz", "CV Yazıcı", "İşe Alım Simülasyonu", "Maaş İçgörüsü", "ATS Uyumluluğu", "Mülakat Hazırlığı"]
    : ["Unlimited analyses", "CV Rewriter", "Recruiter Simulation", "Salary Insights", "ATS Compatibility", "Interview Prep"];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#0c0c0c", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 24, padding: 40, maxWidth: 480, width: "100%", position: "relative", textAlign: "center" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "24px 24px 0 0", background: "linear-gradient(90deg, #d4af37, #f0d060)" }} />
        <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>{t.paywallTitle}</div>
        <div style={{ fontSize: 14, color: "#7a7a7a", lineHeight: 1.7, marginBottom: 28 }}>{t.paywallDesc}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
          {features.map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#94a3b8" }}>
              <span style={{ color: "#d4af37" }}>✓</span> {f}
            </div>
          ))}
        </div>
        <button onClick={onUpgrade} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #d4af37, #f0d060)", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>
          {t.upgradeBtn}
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#475569", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
          {t.maybeLater}
        </button>
      </div>
    </div>
  );
}

function DecisionCard({ data, loading, lang, isPro, onApplyFix, applyingFix, fixResults, onUpgrade, alignmentScore, impactContext }) {
  const t = translations[lang];
  if (loading) return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #3b82f6", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: "#475569" }}>{lang === "TR" ? "Karar analizi yapılıyor..." : "Analyzing your decision..."}</span>
    </div>
  );
  if (!data) return null;

  const displayDecision = mapDecisionLabel(data.decision, lang);
  const scoreFv = alignmentScore != null ? getScoreFinalVerdict(alignmentScore, lang) : null;
  const vc = scoreFv?.verdictColor || RS.textMuted;
  const confTier = getConfidenceTierLabel(data.confidence, lang);
  const rej = alignmentScore != null && Number.isFinite(Number(alignmentScore)) ? getRejectionRiskFromAlignmentScore(alignmentScore, lang) : null;
  const dLbl = { fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: RS.textMuted, fontFamily: RS.fontUi };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
      style={{
        border: `1px solid ${RS.border}`,
        borderRadius: 20,
        background: RS.pageGradient,
        marginBottom: 24,
        overflow: "hidden",
        fontFamily: RS.fontUi,
        boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px ${rsAlpha(RS.indigo, 0.06)}`,
      }}
    >
      {scoreFv ? (
        <>
          <div style={{ padding: "28px 32px", background: rsAlpha(RS.bgSurface, 0.92), borderBottom: `1px solid ${RS.border}` }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 28, alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flex: "1 1 240px", minWidth: 0 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    fontSize: 28,
                    fontWeight: 800,
                    color: vc,
                    background: rsAlpha(vc, 0.14),
                    border: `1px solid ${rsAlpha(vc, 0.35)}`,
                    boxShadow: `0 0 24px ${rsAlpha(vc, 0.18)}`,
                  }}
                >
                  {scoreFv.verdictIcon || scoreFv.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...dLbl, marginBottom: 8 }}>{t.finalVerdict}</div>
                  <div style={{ fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 900, color: vc, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{scoreFv.title}</div>
                  <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.7, color: RS.textSecondary, fontWeight: 500 }}>{scoreFv.explanation}</p>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, minWidth: 110 }}>
                <div style={{ ...dLbl, marginBottom: 8 }}>{t.alignmentScore}</div>
                <div
                  style={{
                    fontFamily: RS.fontMono,
                    fontSize: "clamp(48px, 6vw, 64px)",
                    fontWeight: 900,
                    color: vc,
                    lineHeight: 0.95,
                    letterSpacing: "-0.03em",
                    textShadow: `0 0 40px ${rsAlpha(vc, 0.32)}`,
                  }}
                >
                  {alignmentScore}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: RS.border, borderBottom: `1px solid ${RS.border}` }}>
            <div style={{ background: RS.bgSurface, padding: "16px 32px" }}>
              <div style={{ ...dLbl, marginBottom: 8 }}>{lang === "TR" ? "Güven seviyesi" : "Confidence level"}</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: confTier?.color || RS.textSecondary }}>
                {confTier?.label || (
                  <div>
                    <div>{t.confidenceUnavailableLabel}</div>
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: RS.textMuted }}>{t.confidenceUnavailableNext}</div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ background: RS.bgSurface, padding: "16px 32px", textAlign: "right" }}>
              <div style={{ ...dLbl, marginBottom: 8 }}>{t.rejectionRisk}</div>
              {rej ? (
                <div style={{ fontSize: 15, fontWeight: 500, color: rej.color }}>{rej.metricsLine}</div>
              ) : (
                <div style={{ fontSize: 15, fontWeight: 500, color: RS.textMuted }}>—</div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: "24px 32px", background: RS.bgSurface, borderBottom: `1px solid ${RS.border}` }}>
          <div style={{ ...dLbl, marginBottom: 6 }}>{lang === "TR" ? "Karar" : "Decision"}</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: RS.textPrimary }}>
            {displayDecision || (
              <div>
                <div>{t.decisionUnavailable}</div>
                <div style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: RS.textMuted }}>{t.decisionUnavailableNext}</div>
              </div>
            )}
          </div>
          {confTier ? <div style={{ marginTop: 12, fontSize: 15, fontWeight: 500, color: confTier.color }}>{confTier.label}</div> : null}
        </div>
      )}
      {data.summary ? (
        <div style={{ padding: "24px 32px", borderBottom: `1px solid ${RS.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: RS.textMuted, marginBottom: 10 }}>{lang === "TR" ? "Özet" : "Summary"}</div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: RS.textSecondary }}>{data.summary}</div>
        </div>
      ) : null}
      {data.oneAction ? (
        <div style={{ padding: "24px 32px", background: RS.bgSurface }}>
          <div style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: RS.textMuted, marginBottom: 10 }}>
            {lang === "TR" ? "Önerilen aksiyon" : "Suggested action"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: RS.textPrimary, lineHeight: 1.45 }}>{data.oneAction}</div>
        </div>
      ) : null}
    </motion.div>
  );

}

function ScoreProgressCard({ scoreHistory, lang }) {
  const t = translations[lang];
  if (scoreHistory.length < 2) return null;

  const latest = scoreHistory[0];
  const previous = scoreHistory[1];
  const diff = latest.score - previous.score;
  const isUp = diff > 0;

  return (
    <div className="hf-card" style={{ padding: 24 }}>
      <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
        <TrendingUp size={16} color={T.cyan} />
        {t.scoreProgress}
      </h3>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{t.latestScore}</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: latest.score >= 80 ? "#10b981" : latest.score >= 60 ? "#f59e0b" : "#f87171" }}>{latest.score}</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{latest.role}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: isUp ? "#10b981" : "#f87171" }}>
              {isUp ? "+" : ""}{diff}
            </div>
            <div style={{ fontSize: 10, color: "#475569" }}>{t.improvement}</div>
          </div>
        </div>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Previous</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: "#475569" }}>{previous.score}</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{previous.role}</div>
        </div>
      </div>
      {scoreHistory.length > 2 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {scoreHistory.slice(0, 6).map((entry, i) => (
            <div key={i} style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#475569" }}>
              {entry.score} <span style={{ color: "#334155" }}>· {entry.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressStepper({ cvText, jdText, loading, analysisData, lang }) {
  const steps = [
    { label: lang === "TR" ? "CV Yapıştır" : "Paste CV", done: cvText.trim().length > 50 },
    { label: lang === "TR" ? "İlan Yapıştır" : "Paste JD", done: jdText.trim().length > 50 },
    { label: lang === "TR" ? "Analiz Et" : "Analyze", done: !!analysisData, loading: loading },
  ];
  const activeIndex = steps.findIndex(s => !s.done);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 16, padding: "12px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
              background: step.done ? "#10b981" : step.loading ? "#3b82f6" : i === activeIndex ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${step.done ? "#10b981" : step.loading ? "#3b82f6" : i === activeIndex ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
              transition: "all 0.3s ease",
            }}>
              {step.loading
                ? <div style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid #3b82f6", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                : step.done
                ? <span style={{ fontSize: 11, color: "white", fontWeight: 700 }}>✓</span>
                : <span style={{ fontSize: 11, color: i === activeIndex ? "#a78bfa" : "#334155", fontWeight: 700 }}>{i + 1}</span>}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: step.done ? "#10b981" : step.loading ? "#60a5fa" : i === activeIndex ? "#e2e8f0" : "#334155", whiteSpace: "nowrap" }}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 1, margin: "0 12px", background: step.done ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.06)", transition: "background 0.3s ease" }} />
          )}
        </div>
      ))}
    </div>
  );
}

function parseSingleLine(text, sectionName) {
  const match = text.match(new RegExp(`${sectionName}:\\s*(.+)`, "i"));
  return match ? match[1].trim() : "";
}

function firstTwoSentences(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const parts = t.match(/[^.!?]+[.!?]?/g) || [t];
  return parts.slice(0, 2).join(" ").trim();
}

/** First plausible job title line from pasted JD (labeled or heuristic). */
function extractJobTitleFromJd(jd) {
  const text = String(jd || "").trim();
  if (!text) return "";
  const labeled = text.match(
    /(?:^|\n)\s*(?:job\s*title|position|role|title|pozisyon|ünvan|iş\s*unvanı)\s*[:：\-–]\s*(.+)/i
  );
  if (labeled) {
    const t = labeled[1].trim().split(/\n|;|•|·/)[0].trim();
    if (t.length >= 2 && t.length <= 120) return t;
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 22)) {
    const L = line.replace(/^[-–—*•#]+\s*/, "").replace(/^\d+[.)]\s*/, "");
    if (L.length < 4 || L.length > 100) continue;
    if (/^https?:/i.test(L)) continue;
    if (/^(about|company|overview|summary|requirements|qualifications|responsibilities|benefits|we\s+are|apply|location|employment\s*type)/i.test(L)) continue;
    if (/^\d{4}\s*[-–]/.test(L)) continue;
    if (/^page\s+\d/i.test(L)) continue;
    return L;
  }
  return "";
}

/** LinkedIn job URLs — server-side extraction is unreliable; users should paste the JD text. */
function isLinkedInJobUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return false;
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    const h = u.hostname.toLowerCase();
    return h === "linkedin.com" || h.endsWith(".linkedin.com");
  } catch {
    return /(^|[/.])linkedin\.com(\/|$|[:?#])/i.test(s);
  }
}

function resolveSavedAnalysisRole(jdTitle, modelRole, lang) {
  const j = String(jdTitle || "").trim();
  if (j) return j.slice(0, 120);
  const m = String(modelRole || "").trim();
  if (m && !/^role$/i.test(m)) return m.slice(0, 120);
  return lang === "TR" ? "İş ilanı" : "Job posting";
}

function buildInterviewPrepFromV2(v2, lang) {
  if (!v2) return [];
  const out = [];
  const fix = (v2.Decision?.what_to_fix_first || [])[0];
  const gap = (v2.Gaps?.rejection_reasons || [])[0]?.issue;
  if (fix) {
    out.push({
      question: lang === "TR" ? `${fix} konusunda somut olarak ne yaptınız?` : `What concrete work did you do on: ${fix}?`,
      why_asked: lang === "TR" ? "HireFit'in işaret ettiği öncelikle bağlantılı." : "Tied to the top priority HireFit flagged.",
      personal_angle: lang === "TR" ? "CV'deki ölçülebilir sonuçlarla yanıt ver." : "Answer with measurable outcomes from your CV.",
    });
  }
  if (gap && out.length < 2) {
    out.push({
      question: lang === "TR" ? `"${gap}" konusunda ne söylersiniz?` : `How would you address: ${gap}?`,
      why_asked: lang === "TR" ? "Belirlenen red riskiyle doğrudan ilgili." : "Directly probes a rejection risk we surfaced.",
      personal_angle: lang === "TR" ? "STAR + rakam kullan." : "Use STAR + numbers.",
    });
  }
  return out.slice(0, 2);
}

function DashboardResults({ data, score, matchedSkills, missingSkills, topKeywords, result, optimizedCv, learningPlan, downloadText, lang, navigate, isPro = false, onUpgrade = () => {}, roleFitLocked = false, useV2Engine = false }) {
  const t = translations[lang];
  useEffect(() => {
    if (!document.getElementById("db-fonts")) {
      const el = document.createElement("style");
      el.id = "db-fonts";
      el.textContent = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');`;
      document.head.appendChild(el);
    }
  }, []);

  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    setDisplayScore(0);
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(current));
      }
    }, 1200 / steps);
    return () => clearInterval(timer);
  }, [score]);

  const fvDash = getScoreFinalVerdict(score, lang);
  const verdict = fvDash.title;

  const DB = {
    root: { background: "#080808", borderRadius: 20, padding: 28, marginBottom: 16, fontFamily: "'Space Grotesk', sans-serif" },
    hero: { border: "1px solid #1c1c1c", borderRadius: 20, padding: "28px 32px", marginBottom: 20, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 32, alignItems: "center", background: "#0c0c0c", position: "relative", overflow: "hidden" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 0 },
    grid4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 24 },
    card: { border: "1px solid #1c1c1c", borderRadius: 16, padding: 22, background: "#0c0c0c", position: "relative", overflow: "hidden" },
    statCard: { border: "1px solid #1c1c1c", borderRadius: 12, padding: "16px 18px", background: "#0c0c0c", position: "relative", overflow: "hidden" },
    sectionHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14, marginTop: 4 },
    cardTag: { fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, color: "#d4af37" },
    moreLink: { fontSize: 12, color: "#d4af37", fontWeight: 700, marginTop: 12, letterSpacing: "0.04em", opacity: 0.7 },
  };

  const statLabels = lang === "TR"
    ? ["Beceri Eşleşmesi", "Anahtar Kelimeler", "Deneyim", "Biçimlendirme"]
    : ["Skills Match", "Keywords", "Experience", "Formatting"];

  const rt = String(data.role_type || "").trim();
  const displayRoleTitle =
    rt && !/^role$/i.test(rt) ? rt : lang === "TR" ? "İş ilanı" : "Job posting";

  const cs = data.confidence_score;
  const hasConfidenceNum = typeof cs === "number" && !Number.isNaN(cs);
  const cl = String(data.confidence_level || "").trim();
  const inferredPct = cl === "High" ? 78 : cl === "Medium" ? 62 : cl === "Low" ? 45 : null;
  const confidencePct = hasConfidenceNum ? cs : inferredPct;
  const basisFromLevel =
    cl && /^(low|medium|high)$/i.test(cl)
      ? lang === "TR"
        ? `${cl} güven seviyesi`
        : `${cl} confidence level`
      : "";
  const confidenceBasisText = String(data.confidence_basis || "").trim() || basisFromLevel;

  const roleRows = (data.role_matches || []).filter((r) => r && String(r.role || "").trim());
  const showRolesProLock = !!roleFitLocked && !isPro;
  const interviewRows = Array.isArray(data.interview_prep) ? data.interview_prep : [];
  const showInterviewProLock = !isPro;
  const showInterviewCard = showInterviewProLock || interviewRows.length > 0;

  const proLockBox = (desc) => (
    <div
      style={{
        padding: 18,
        borderRadius: 12,
        border: "1px dashed rgba(212,175,55,0.35)",
        background: "rgba(212,175,55,0.04)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 13, color: "#a8a29e", lineHeight: 1.55, marginBottom: 12 }}>{desc}</div>
      <button
        type="button"
        onClick={onUpgrade}
        style={{
          padding: "8px 16px",
          borderRadius: 10,
          border: "none",
          background: "linear-gradient(135deg, #d4af37, #f0d060)",
          color: "#000",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {t.unlockWithPro}
      </button>
    </div>
  );

  return (
    <>
      <div style={DB.root}>
        <div style={DB.hero}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(180deg, #d4af37, #b8860b, #8b6914)", borderRadius: "3px 0 0 3px" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", color: "#6a6a6a", textTransform: "uppercase", marginBottom: 2 }}>{lang === "TR" ? "FİNAL KARAR" : "FINAL VERDICT"}</div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 76, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.03em", background: "linear-gradient(135deg, #f0d060, #d4af37, #b8860b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{displayScore}</div>
            <div style={{ fontSize: 11, color: "#7a7a7a", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{lang === "TR" ? "100 üzerinden" : "out of 100"}</div>
            <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 4, background: "rgba(212,175,55,0.08)", color: "#d4af37", border: "1px solid rgba(212,175,55,0.2)", marginTop: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>{verdict}</div>
            {(() => {
              const rr = getRejectionRiskFromAlignmentScore(score, lang);
              return (
                <div style={{ marginTop: 10, textAlign: "center", maxWidth: 200 }}>
                  <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.12em", color: "#6a6a6a", textTransform: "uppercase", marginBottom: 4 }}>{rr.title}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: rr.color, lineHeight: 1.35 }}>{rr.mainLine}</div>
                </div>
              );
            })()}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#d4af37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>{displayRoleTitle}</div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: "#e8e8e8", lineHeight: 1.3, marginBottom: 12, fontStyle: "italic" }}>
              <span style={{ fontStyle: "normal", color: "#cbd5e1", fontWeight: 600 }}>{fvDash.explanation}</span>
              {(data.missing_skills || []).length > 0 && score < 85 ? (
                <span style={{ display: "block", marginTop: 10, fontSize: 15, fontStyle: "normal", color: "#94a3b8" }}>
                  {lang === "TR" ? (
                    <>Ayrıca <span style={{ color: "#f87171", fontWeight: 700 }}>{(data.missing_skills || []).length} kritik boşluk</span> seni filtrede düşürüyor.</>
                  ) : (
                    <><span style={{ color: "#f87171", fontWeight: 700 }}>{(data.missing_skills || []).length} critical gaps</span> are dragging you down in the filter.</>
                  )}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 13, color: "#7a7a7a", lineHeight: 1.65 }}>{data.fit_summary || ""}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <div style={{ fontSize: 10, color: "#7a7a7a", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>{lang === "TR" ? "AI Güveni" : "AI Confidence"}</div>
            {(() => {
              const tier = getConfidenceTierLabel(confidencePct, lang);
              if (!tier) return <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: "#6a6a6a", lineHeight: 1 }}>{t.confidenceNA}</div>;
              return (
                <div
                  title={lang === "TR" ? "Analiz kalitesi CV ve JD netliğine göre değişir." : "Analysis quality can vary based on CV and JD clarity."}
                  style={{ fontSize: 18, fontWeight: 800, color: tier.color, lineHeight: 1.2 }}
                >
                  {tier.label} ⓘ
                </div>
              );
            })()}
            {confidenceBasisText ? (
              <div style={{ fontSize: 11, color: "#7a7a7a", textAlign: "right", lineHeight: 1.5, maxWidth: 200 }}>{confidenceBasisText}</div>
            ) : null}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <ImpactProjectionPanel
            projection={computeImpactProjection(score, {
              gaps: [
                ...(data.rejection_reasons?.high || []).map((issue) => ({ issue: String(issue), impact: "high", explanation: "" })),
                ...(data.rejection_reasons?.medium || []).map((issue) => ({ issue: String(issue), impact: "medium", explanation: "" })),
              ],
              missingKeywords: data.top_keywords || [],
              missingSkills: missingSkills.length ? missingSkills : data.missing_skills || [],
              improvements: data.improvements || [],
              rejectionHigh: data.rejection_reasons?.high,
              rejectionMedium: data.rejection_reasons?.medium,
            }, lang)}
            lang={lang}
          />
        </div>

        <div style={DB.grid4}>
          {[
            {
              label: statLabels[0],
              val: data.score_breakdown?.skills_match ?? score,
              color: "#60a5fa",
              ctx:
                data.score_breakdown?.skills_explanation ||
                (() => {
                  const m = (data.matched_skills || []).length;
                  const tot = m + (data.missing_skills || []).length;
                  if (lang === "TR") {
                    if (tot <= 0) return "Beceri eşleşmesi verisi yok";
                    return `${tot}'dan ${m} eşleşti`;
                  }
                  return `${m} of ${tot} matched`;
                })(),
            },
            { label: statLabels[1], val: data.score_breakdown?.keyword_match ?? 100, color: "#10b981", ctx: `${(data.top_keywords || []).length} ${lang === "TR" ? "anahtar kelime tespit edildi" : "keywords detected"}` },
            { label: statLabels[2], val: data.score_breakdown?.experience_depth ?? Math.max(35, score - 10), color: "#f59e0b", ctx: data.score_breakdown?.experience_explanation || (lang === "TR" ? "Derinlik değerlendirildi" : "Depth evaluated") },
            { label: statLabels[3], val: data.score_breakdown?.formatting ?? 75, color: "#60a5fa", ctx: data.language_analysis?.tone || (lang === "TR" ? "Biçimlendirme incelendi" : "Formatting reviewed") },
          ].map(({ label, val, color, ctx }) => (
            <div key={label} style={DB.statCard}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent)" }} />
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#d4af37", marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 30, lineHeight: 1, color, marginBottom: 3 }}>{val}</div>
              <div style={{ fontSize: 11, color: "#7a7a7a", fontWeight: 500 }}>{ctx}</div>
            </div>
          ))}
        </div>

        <div style={DB.sectionHeader}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#d4af37", fontStyle: "italic" }}>01</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d4af37", textTransform: "uppercase", letterSpacing: "0.14em" }}>{lang === "TR" ? "İşe Alım Uzmanı Görüşü" : "Recruiter View"}</div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.2), transparent)" }} />
        </div>
        <div style={DB.grid2}>
          <div style={DB.card}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "16px 16px 0 0", background: "linear-gradient(90deg, #d4af37, #f0d060)" }} />
            <div style={DB.cardTag}>{lang === "TR" ? "İşe alım uzmanının gerçekte ne düşündüğü" : "What the recruiter actually thinks"}</div>
            {(() => {
              const rr = getRejectionRiskFromAlignmentScore(score, lang);
              return (
                <div style={{ fontSize: 11, fontWeight: 700, color: rr.color, marginBottom: 10, lineHeight: 1.45 }}>
                  {rr.title}: {rr.mainLine}
                </div>
              );
            })()}
            <div style={{ borderLeft: "2px solid #d4af37", padding: "14px 16px", background: "rgba(212,175,55,0.03)", borderRadius: "0 10px 10px 0", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 15, color: "#8a8a8a", lineHeight: 1.7, fontStyle: "italic" }}>&quot;{data.recruiter_simulation?.internal_monologue || data.fit_summary || (lang === "TR" ? "Analiz tamamlandı." : "Analysis complete.")}&quot;</div>
              <div style={{ fontSize: 11, color: "#d4af37", fontWeight: 700, marginTop: 8, letterSpacing: "0.04em" }}>— {data.recruiter_simulation?.sector || (lang === "TR" ? "Sektör" : "Industry")} {lang === "TR" ? "İşe Alım Uzmanı" : "Recruiter"} · {data.seniority || (lang === "TR" ? "Belirtilmedi" : "Junior")} {lang === "TR" ? "seviye işe alım" : "level hiring"}</div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 6, background: data.recruiter_simulation?.would_interview ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${data.recruiter_simulation?.would_interview ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`, color: data.recruiter_simulation?.would_interview ? "#10b981" : "#f87171", fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: data.recruiter_simulation?.would_interview ? "#10b981" : "#f87171", display: "inline-block", flexShrink: 0 }} />
              {mapDecisionLabel(
                data.recruiter_simulation?.decision ||
                  (data.recruiter_simulation?.would_interview ? (lang === "TR" ? "Listeye alır" : "Would shortlist") : (lang === "TR" ? "İlerlemez" : "Would not proceed")),
                lang
              )}
            </div>
          </div>
          <div style={DB.card}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "16px 16px 0 0", background: "linear-gradient(90deg, #ef4444, #f97316)" }} />
            <div style={DB.cardTag}>{lang === "TR" ? "İyi sanıp aslında sorunlu olan şeyler" : "What you think is fine — but isn't"}</div>
            {(data.blind_spots || (data.rejection_reasons?.high || []).map((r) => ({ issue: r, fix: "" }))).slice(0, 3).map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: i < 2 ? "1px solid #1c1c1c" : "none" }}>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "rgba(212,175,55,0.4)", flexShrink: 0, marginTop: -2 }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 13, color: "#8a8a8a", lineHeight: 1.55, marginBottom: 6 }}>{item.issue || item}</div>
                  {item.fix && <div style={{ fontSize: 12, fontWeight: 700, color: "#d4af37", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 4, padding: "4px 10px", display: "inline-block" }}>→ {item.fix}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={DB.sectionHeader}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#d4af37", fontStyle: "italic" }}>02</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d4af37", textTransform: "uppercase", letterSpacing: "0.14em" }}>{lang === "TR" ? "Derin Analiz" : "Deep Analysis"}</div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.2), transparent)" }} />
        </div>
        <div style={DB.grid2}>
          <div style={DB.card}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "16px 16px 0 0", background: "linear-gradient(90deg, #d4af37, #10b981)" }} />
            <div style={DB.cardTag}>{lang === "TR" ? "Siz ve hayal ettikleri aday" : "You vs the candidate they're picturing"}</div>
            <CriticalSkillsGapBlock skills={missingSkills.length ? missingSkills : data.missing_skills || []} lang={lang} />
            {(data.benchmark?.dimensions || [
              {
                name: lang === "TR" ? "Beceri eşleşmesi" : "Skills match",
                candidate_level: matchedSkills.length > 2 ? (lang === "TR" ? "İyi" : "Good") : (lang === "TR" ? "Temel" : "Basic"),
                ideal_level: lang === "TR" ? "İleri" : "Advanced",
              },
              {
                name: lang === "TR" ? "Etki kanıtı" : "Impact proof",
                candidate_level: lang === "TR" ? "Eksik" : "Missing",
                ideal_level: lang === "TR" ? "Ölçümlenmiş" : "Quantified",
              },
            ]).slice(0, 4).map((dim, i) => {
              const cand = dim.candidate_level;
              const positive =
                ["Strong ✓", "Good", "Some"].includes(cand) ||
                (lang === "TR" && ["İyi", "Güçlü ✓", "Var", "Bazı"].includes(cand));
              return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: i < 3 ? "1px solid #1c1c1c" : "none" }}>
                <span style={{ fontSize: 12, color: "#7a7a7a", width: 100, flexShrink: 0, fontWeight: 500 }}>{dim.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: positive ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: positive ? "#10b981" : "#f87171", border: `1px solid ${positive ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}` }}>{dim.candidate_level}</span>
                <span style={{ fontSize: 10, color: "#5a5a5a", fontWeight: 700 }}>{lang === "TR" ? "karşı" : "vs"}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.15)" }}>{dim.ideal_level}</span>
              </div>
            );
            })}
            <div style={DB.moreLink}>{lang === "TR" ? `İlk 2'yi düzelt → tahmini skor: ${score} → ${data.benchmark?.before_after_estimate || Math.min(91, score + 9)} →` : `Fix top 2 → estimated score: ${score} → ${data.benchmark?.before_after_estimate || Math.min(91, score + 9)} →`}</div>
          </div>
          <div style={DB.card}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "16px 16px 0 0", background: "linear-gradient(90deg, #d4af37, #a78bfa)" }} />
            <div style={DB.cardTag}>{lang === "TR" ? "CV'nizin parladığı diğer roller" : "Roles where your CV also shines"}</div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#e8e8e8", marginBottom: 16, lineHeight: 1.25 }}>
              {lang === "TR" ? "CV'niz burada daha fazla kapı açabilir." : "Your CV may open more doors here."} <em style={{ color: "#8a8a8a", fontSize: 16 }}>{lang === "TR" ? "Başvurmadan önce bilin." : "Worth knowing before you apply."}</em>
            </div>
            {showRolesProLock ? (
              proLockBox(t.proFeatureRoles)
            ) : roleRows.length ? (
              roleRows.slice(0, 4).map((r, i) => {
                const colors = ["#10b981", "#60a5fa", "#f59e0b", "#555555"];
                const ms = Number(r.match_score);
                const scoreDisp = Number.isFinite(ms) ? ms : "—";
                const barW = Number.isFinite(ms) ? Math.min(90, ms * 0.6) : 0;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: colors[i], width: 36, flexShrink: 0 }}>{scoreDisp}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: i < 3 ? "#c8c8c8" : "#6a6a6a", flex: 1 }}>{r.role}</span>
                    <div style={{ width: `${barW}px`, height: 2, borderRadius: 999, background: i < 3 ? `linear-gradient(90deg, #d4af37, ${colors[i]})` : "#1c1c1c" }} />
                  </div>
                );
              })
            ) : (
              <EmptyGuidance primary={isPro ? t.rolesEmptyPro : t.rolesEmptyGeneric} action={t.rolesEmptyNext} />
            )}
          </div>
        </div>

        <div style={DB.sectionHeader}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#d4af37", fontStyle: "italic" }}>03</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d4af37", textTransform: "uppercase", letterSpacing: "0.14em" }}>{lang === "TR" ? "Aksiyon Planı" : "Action Plan"}</div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.2), transparent)" }} />
        </div>
        <div style={{ ...DB.grid2, gridTemplateColumns: showInterviewCard ? "1fr 1fr" : "1fr" }}>
          {showInterviewCard ? (
            <div style={DB.card}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "16px 16px 0 0", background: "linear-gradient(90deg, #d4af37, #7c3aed)" }} />
              <div style={DB.cardTag}>{lang === "TR" ? "Mülakat Hazırlığı" : "Interview Prep"}</div>
              {showInterviewProLock ? (
                proLockBox(t.proFeatureInterview)
              ) : (
                interviewRows.slice(0, 2).map((q, i) => (
                  <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i === 0 ? "1px solid #1c1c1c" : "none" }}>
                    <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 15, color: "#e8e8e8", lineHeight: 1.5, marginBottom: 5, fontStyle: "italic" }}>&quot;{q.question}&quot;</div>
                    <div style={{ fontSize: 11, color: "#7a7a7a", marginBottom: 4, fontWeight: 500 }}>{q.why_asked}</div>
                    <div style={{ fontSize: 12, color: "#d4af37", fontWeight: 700 }}>{q.personal_angle}</div>
                  </div>
                ))
              )}
            </div>
          ) : null}
          <div style={DB.card}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "16px 16px 0 0", background: "linear-gradient(90deg, #d4af37, #22d3ee)" }} />
            <div style={DB.cardTag}>{lang === "TR" ? "Pazar İstihbaratı" : "Market Intelligence"}</div>
            {data.salary_insight && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#d4af37", marginBottom: 8 }}>{lang === "TR" ? "Maaş Bilgisi" : "Salary Insight"}</div>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: "#e8e8e8", lineHeight: 1, marginBottom: 3 }}>
                  {data.salary_insight.currency === "TRY" ? "₺" : data.salary_insight.currency === "USD" ? "$" : "€"}{(data.salary_insight.range_min || 0).toLocaleString()} – {(data.salary_insight.range_max || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: "#7a7a7a", marginBottom: 14 }}>{data.role_type} · {data.seniority} · Mid: {data.salary_insight.currency === "TRY" ? "₺" : "$"}{(data.salary_insight.mid_point || 0).toLocaleString()}</div>
                <div style={{ height: 1, background: "#1c1c1c", marginBottom: 14 }} />
              </>
            )}
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#d4af37", marginBottom: 10 }}>{lang === "TR" ? "ATS Uyumluluğu" : "ATS Compatibility"}</div>
            {(data.ats_compatibility || [
              { system: "Workday", status: "Passes", note: lang === "TR" ? "Anahtar kelimeler tespit edildi" : "Keywords detected" },
              { system: "Greenhouse", status: "Passes", note: lang === "TR" ? "Format uyumlu" : "Format compatible" },
              { system: "Lever", status: "Review", note: lang === "TR" ? "PDF ayrıştırmasını kontrol edin" : "Check PDF parsing" },
            ]).slice(0, 3).map((ats, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 2 ? "1px solid #1c1c1c" : "none" }}>
                <span style={{ fontSize: 13, color: "#8a8a8a", fontWeight: 600 }}>{ats.system}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ats.status === "Passes" ? "#10b981" : ats.status === "Review" ? "#f59e0b" : "#f87171" }}>{ats.status === "Passes" ? "✓ Passes" : ats.status === "Review" ? "⚡ Review" : "✗ At Risk"}</div>
                  <div style={{ fontSize: 11, color: "#7a7a7a", marginTop: 1 }}>{ats.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={DB.sectionHeader}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#d4af37", fontStyle: "italic" }}>04</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d4af37", textTransform: "uppercase", letterSpacing: "0.14em" }}>{lang === "TR" ? "Beceriler & Anahtar Kelimeler" : "Skills & Keywords"}</div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.2), transparent)" }} />
        </div>
        <div style={DB.grid3}>
          {[
            { title: lang === "TR" ? "Eşleşen Beceriler" : "Matched Skills", skills: matchedSkills, bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.15)", color: "#6ee7b7", titleColor: "#10b981" },
            { title: lang === "TR" ? "Eksik Beceriler" : "Missing Skills", skills: missingSkills, bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.15)", color: "#fca5a5", titleColor: "#f87171" },
            { title: lang === "TR" ? "Önemli Anahtar Kelimeler" : "Top Keywords", skills: topKeywords, bg: "rgba(212,175,55,0.08)", border: "rgba(212,175,55,0.15)", color: "#d4af37", titleColor: "#d4af37" },
          ].map(({ title, skills, bg, border, color, titleColor }) => (
            <div key={title} style={{ border: "1px solid #1c1c1c", borderRadius: 16, padding: 18, background: "#0c0c0c" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: titleColor, marginBottom: 12 }}>{title}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {skills.length ? (
                  skills.map((s) => <span key={s} style={{ padding: "4px 10px", borderRadius: 999, background: bg, border: `1px solid ${border}`, color, fontSize: 11, fontWeight: 600 }}>{s}</span>)
                ) : (
                  <div style={{ fontSize: 12, lineHeight: 1.55 }}>
                    <div style={{ color: "#94a3b8" }}>{t.emptyNoneDetectedSkills}</div>
                    <div style={{ color: "#5a5a5a", marginTop: 6, fontWeight: 600 }}>{t.emptyNoneDetectedSkillsNext}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button className="hf-btn-ghost" onClick={() => navigator.clipboard.writeText(result)} style={{ fontSize: "12px", padding: "9px 16px", borderRadius: 8 }}><Copy size={12} />{t.copyReport}</button>
          <button className="hf-btn-ghost" onClick={() => downloadText(result, "hirefit-report.txt")} style={{ fontSize: "12px", padding: "9px 16px", borderRadius: 8 }}><Download size={12} />{t.download}</button>
        </div>
      </div>

      {optimizedCv && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(34,211,238,0.12)", borderRadius: 20, padding: 24, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: T.cyan }}>{t.cvComparison}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="hf-btn-ghost" onClick={() => navigator.clipboard.writeText(optimizedCv)} style={{ fontSize: "12px", padding: "7px 14px", borderRadius: 8 }}><Copy size={12} />{t.copyOptimized}</button>
              <button className="hf-btn-ghost" onClick={() => downloadText(optimizedCv, "hirefit-optimized-cv.txt")} style={{ fontSize: "12px", padding: "7px 14px", borderRadius: 8 }}><Download size={12} />{t.download}</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f87171", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f87171", display: "inline-block" }} />
                {t.originalCV}
              </div>
              <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)", borderRadius: 12, padding: 16, maxHeight: 400, overflowY: "auto" }}>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", lineHeight: 1.8, color: "#64748b", margin: 0 }}>{result}</pre>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#10b981", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                {t.optimizedCV}
              </div>
              <div style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.1)", borderRadius: 12, padding: 16, maxHeight: 400, overflowY: "auto" }}>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", lineHeight: 1.8, color: "#94a3b8", margin: 0 }}>{optimizedCv}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {learningPlan && (
        <div style={{ marginTop: 16, padding: 18, borderRadius: 14, border: "1px solid rgba(16,185,129,0.18)", background: "rgba(16,185,129,0.06)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 13, color: "#6ee7b7", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{t.roadmapReadyBanner}</div>
          <button type="button" className="hf-btn-primary" onClick={() => navigate("/roadmap")} style={{ fontSize: 12, padding: "9px 18px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 8 }}>
            {t.openJourneyMap} <ArrowRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}

function NavBar({ pathname, user, logout, navigate, lang, setLang }) {
  const t = translations[lang];
  const navTab = pathname === "/roadmap" ? "roadmap" : pathname === "/dashboard" ? "dashboard" : pathname === "/" ? "landing" : null;
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [navLinkHover, setNavLinkHover] = useState(null);
  const [navLinkPressed, setNavLinkPressed] = useState(null);
  const navTabsRef = useRef(null);
  const navButtonRefs = useRef([]);
  const [activeTabPosition, setActiveTabPosition] = useState({ left: 0, top: 0, width: 0, height: 0, visible: false });

  const updateActiveTabIndicator = () => {
    const container = navTabsRef.current;
    if (!container) return;
    const idx = navTab === "landing" ? 0 : navTab === "roadmap" ? 1 : navTab === "dashboard" ? 2 : -1;
    if (idx < 0) {
      setActiveTabPosition((p) => ({ ...p, width: 0, visible: false }));
      return;
    }
    const btn = navButtonRefs.current[idx];
    if (!btn) return;
    const cr = container.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setActiveTabPosition({
      left: br.left - cr.left,
      top: br.top - cr.top,
      width: br.width,
      height: br.height,
      visible: true,
    });
  };

  useLayoutEffect(() => {
    updateActiveTabIndicator();
    const container = navTabsRef.current;
    const ro = typeof ResizeObserver !== "undefined" && container ? new ResizeObserver(() => updateActiveTabIndicator()) : null;
    if (container && ro) ro.observe(container);
    window.addEventListener("resize", updateActiveTabIndicator);
    return () => {
      if (container && ro) ro.disconnect();
      window.removeEventListener("resize", updateActiveTabIndicator);
    };
  }, [pathname, lang]);

  useEffect(() => {
    const clearPress = () => setNavLinkPressed(null);
    window.addEventListener("mouseup", clearPress);
    return () => window.removeEventListener("mouseup", clearPress);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (document.getElementById("navbar-styles-v2")) return;
    const el = document.createElement("style");
    el.id = "navbar-styles-v2";
    el.textContent = `
      @keyframes logoPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); } 50% { box-shadow: 0 0 0 8px rgba(99,102,241,0); } }
      @keyframes navSlideIn { from { opacity:0; transform:translateY(-16px); } to { opacity:1; transform:translateY(0); } }
      @keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
      .hf-nav-root { animation: navSlideIn 0.5s ease both; }
      .hf-logo-wrap { animation: logoPulse 3s ease-in-out infinite; }
      .hf-logo-wrap:hover { animation: none; }
      .hf-nav-pill { padding: 9px 20px; border-radius: 10px; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; transition: all 0.25s ease; position: relative; overflow: hidden; background: transparent; color: #475569; letter-spacing: 0.01em; }
      .hf-nav-pill::before { content: ''; position: absolute; inset: 0; opacity: 0; background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.12)); transition: opacity 0.25s ease; }
      .hf-nav-pill:hover { color: #cbd5e1; }
      .hf-nav-pill:hover::before { opacity: 1; }
      .hf-nav-pill.active { color: #0f172a !important; background: rgba(255,255,255,0.92) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
      .hf-nav-pill.active::after { content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 16px; height: 2px; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 999px; }
      .hf-monogram { background: linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6, #ec4899); background-size: 300% 300%; animation: gradientShift 4s ease infinite; }
      .hf-nav-inner-row { position: relative; display: flex; align-items: center; flex-wrap: nowrap; height: 72px; min-height: 72px; box-sizing: border-box; }
      .hf-nav-logo-cluster { position: relative; z-index: 2; flex-shrink: 0; }
      .hf-nav-tabs-wrap { position: absolute; left: 50%; transform: translateX(-50%); z-index: 1; }
      .hf-nav-right-cluster { position: relative; z-index: 2; margin-left: auto; display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
      .hf-nav-sep { width: 1px; height: 26px; background: rgba(255,255,255,0.12); flex-shrink: 0; }
      @media (max-width: 900px) {
        .hf-nav-inner-row { flex-wrap: wrap; row-gap: 10px; align-items: center; padding-left: 16px !important; padding-right: 16px !important; height: auto !important; min-height: 72px !important; }
        .hf-nav-logo-cluster { order: 1; }
        .hf-nav-right-cluster { order: 2; margin-left: auto; }
        .hf-nav-tabs-wrap { position: static; transform: none; order: 3; flex-basis: 100%; width: 100%; display: flex; justify-content: center; margin-top: 2px; }
      }
    `;
    document.head.appendChild(el);
  }, []);

  return (
    <nav className="hf-nav-root" style={{ width: "100%", position: "sticky", top: 0, zIndex: 100, maxWidth: "none", overflowX: "hidden", boxSizing: "border-box", background: scrolled ? "rgba(6,9,16,0.94)" : "rgba(6,9,16,0.65)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent", transition: "all 0.4s ease" }}>
      <div
        className="hf-nav-inner-row"
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          maxWidth: "none",
          margin: 0,
          padding: "0 48px",
          boxSizing: "border-box",
          height: "72px",
        }}
      >
        <div className="hf-nav-logo-cluster" style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => navigate("/")}>
          <div className="hf-logo-wrap hf-monogram" style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", flexShrink: 0, transform: hovered === "logo" ? "scale(1.1) rotate(-5deg)" : "scale(1)", transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)" }} onMouseEnter={() => setHovered("logo")} onMouseLeave={() => setHovered(null)}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 60%)", zIndex: 1 }} />
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "18px", color: "white", letterSpacing: "-0.04em", position: "relative", zIndex: 2 }}>HF</span>
          </div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "22px", letterSpacing: "-0.03em", lineHeight: 1.05, color: hovered === "logo" ? "#a78bfa" : "#f1f5f9", transition: "all 0.3s ease" }}>HireFit</div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", lineHeight: 1, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI Career Decision Engine</div>
          </div>
        </div>
        <div
          ref={navTabsRef}
          className="hf-nav-tabs-wrap"
          style={{
            display: "flex",
            gap: 6,
            background: "rgba(255,255,255,0.04)",
            padding: "6px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset, 0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: activeTabPosition.top,
              left: activeTabPosition.left,
              width: activeTabPosition.width,
              height: activeTabPosition.height || "100%",
              borderRadius: 999,
              background: "linear-gradient(135deg, #6366f1, #3b82f6)",
              transition: "all 0.3s ease",
              boxShadow: "0 0 40px rgba(99,102,241,0.25), inset 0 0 10px rgba(255,255,255,0.05)",
              pointerEvents: "none",
              zIndex: 0,
              opacity: activeTabPosition.visible && activeTabPosition.width > 0 ? 1 : 0,
            }}
          />
          {[{ label: t.home, path: "/", viewKey: "landing" }, { label: t.product, path: "/roadmap", viewKey: "roadmap" }, { label: t.dashboard, path: "/dashboard", viewKey: "dashboard" }].map(({ label, path, viewKey }, i) => {
            const isActive = navTab === viewKey;
            const isHovered = navLinkHover === viewKey;
            const isPressed = navLinkPressed === viewKey;
            let scale = 1;
            if (isPressed) scale = 0.97;
            else if (isHovered) scale = 1.05;
            return (
              <button
                key={viewKey}
                ref={(el) => { navButtonRefs.current[i] = el; }}
                type="button"
                className="nav-link"
                onClick={() => navigate(path)}
                onMouseEnter={() => setNavLinkHover(viewKey)}
                onMouseLeave={() => {
                  setNavLinkHover((k) => (k === viewKey ? null : k));
                  setNavLinkPressed((k) => (k === viewKey ? null : k));
                }}
                onMouseDown={() => setNavLinkPressed(viewKey)}
                onMouseUp={() => setNavLinkPressed((k) => (k === viewKey ? null : k))}
                style={{
                  position: "relative",
                  zIndex: 1,
                  padding: "8px 18px",
                  borderRadius: 999,
                  fontWeight: isActive ? 700 : 600,
                  letterSpacing: isActive ? "0.02em" : "normal",
                  fontSize: 14,
                  fontFamily: "'DM Sans', sans-serif",
                  border: "none",
                  cursor: "pointer",
                  color: "#ffffff",
                  opacity: isActive ? 1 : 0.7,
                  background: "transparent",
                  transform: `scale(${scale})`,
                  transition: "all 0.2s ease",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="hf-nav-right-cluster">
          <button
            type="button"
            onClick={() => setLang(lang === "EN" ? "TR" : "EN")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 10,
              border: `1px solid ${lang === "TR" ? "rgba(248,113,113,0.45)" : "rgba(147,197,253,0.45)"}`,
              background: lang === "TR" ? "rgba(220,38,38,0.1)" : "rgba(59,130,246,0.12)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.3s ease",
            }}
          >
            {lang === "EN" ? (
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                <rect width="20" height="14" fill="#E30A17"/>
                <circle cx="7.5" cy="7" r="3" fill="white"/>
                <circle cx="8.5" cy="7" r="2.3" fill="#E30A17"/>
                <polygon points="11,7 12.5,5.5 12.5,8.5" fill="white"/>
              </svg>
            ) : (
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                <rect width="20" height="14" fill="#012169"/>
                <path d="M0,0 L20,14 M20,0 L0,14" stroke="white" strokeWidth="2.5"/>
                <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" strokeWidth="1.5"/>
                <path d="M10,0 V14 M0,7 H20" stroke="white" strokeWidth="4"/>
                <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" strokeWidth="2.5"/>
              </svg>
            )}
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", color: lang === "EN" ? "#f87171" : "#93c5fd" }}>
              {lang === "EN" ? "Türkçe" : "English"}
            </span>
          </button>
          <div className="hf-nav-sep" aria-hidden />
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "grid", placeItems: "center", fontSize: "14px", fontWeight: 800, color: "white", boxShadow: "0 0 16px rgba(99,102,241,0.5)", fontFamily: "'Syne', sans-serif" }}>
                {user.email?.[0]?.toUpperCase()}
              </div>
              <button className="hf-btn-ghost" onClick={logout} style={{ padding: "9px 18px", fontSize: "13px" }}><LogOut size={13} /> {t.signOut}</button>
            </div>
          ) : (
            <button className="hf-btn-primary" onClick={() => navigate("/login")} style={{ padding: "10px 24px", fontSize: "14px", background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 0 24px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)", borderRadius: 999 }}>
              <LogIn size={14} /> {t.login}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

const Navbar = NavBar;

function HeroSection({ navigate, lang }) {
  useEffect(() => {
    let el = document.getElementById("hero-styles");
    if (!el) {
      el = document.createElement("style");
      el.id = "hero-styles";
      document.head.appendChild(el);
    }
    el.textContent = `
        @keyframes heroFadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes floatY { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-8px);} }
        @keyframes shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
        .hf-hero-col-left { flex: 1; min-width: 0; padding-left: 0; padding-right: 0; position: relative; z-index: 1; }
        .hf-hero-col-right { flex: 0 0 400px; max-width: 400px; min-width: 0; position: relative; z-index: 1; flex-shrink: 0; }
        @media (max-width: 900px) {
          .hf-hero-inner { flex-direction: column !important; align-items: stretch !important; padding: 0 24px !important; gap: 32px !important; min-height: auto !important; }
          .hf-hero-col-right { flex: 1 1 auto !important; max-width: 100% !important; width: 100%; }
          .hf-hero-headline { font-size: clamp(28px, 7vw, 40px) !important; line-height: 1.05 !important; }
        }
        .hero-fade { animation: heroFadeUp 0.6s ease both; }
        .shimmer-text { background: linear-gradient(90deg, #f87171 0%, #fb923c 25%, #f87171 50%, #fb923c 75%, #f87171 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 3s linear infinite; }
        .shimmer-blue { background: linear-gradient(90deg, #60a5fa 0%, #a78bfa 25%, #f472b6 50%, #a78bfa 75%, #60a5fa 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 4s linear infinite; }
      `;
  }, []);

  const fakeResult = {
    EN: {
      decision: "Not Likely",
      decisionColor: "#f87171",
      decisionBg: "rgba(239,68,68,0.08)",
      decisionBorder: "rgba(239,68,68,0.2)",
      mistake: "No measurable impact. Every bullet says 'responsible for'.",
      fix: "Replace with numbers. 'Grew email list by 40% in 3 months.'",
      insight: "This CV looks like everyone else's. Nothing stands out in 7 seconds.",
    },
    TR: {
      decision: "Düşük İhtimal",
      decisionColor: "#f87171",
      decisionBg: "rgba(239,68,68,0.08)",
      decisionBorder: "rgba(239,68,68,0.2)",
      mistake: "Ölçülebilir etki yok. Her madde 'sorumlu oldum' diyor.",
      fix: "Rakam ekle. '3 ayda email listesini %40 büyüttüm.'",
      insight: "Bu CV herkesinkiyle aynı. 7 saniyede hiçbir şey öne çıkmıyor.",
    }
  };

  const r = fakeResult[lang];

  return (
    <section
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: "#0A0A0B",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "700px",
            height: "700px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(109, 40, 217, 0.1) 0%, transparent 65%)",
            top: "-200px",
            left: "-150px",
            filter: "blur(90px)",
            animation: "blobFloat1 12s ease-in-out infinite alternate",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(29, 78, 216, 0.08) 0%, transparent 65%)",
            bottom: "-150px",
            right: "-50px",
            filter: "blur(80px)",
            animation: "blobFloat2 15s ease-in-out infinite alternate",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(15, 118, 110, 0.07) 0%, transparent 65%)",
            top: "30%",
            left: "35%",
            filter: "blur(70px)",
            animation: "blobFloat1 20s ease-in-out infinite alternate-reverse",
            pointerEvents: "none",
          }}
        />
      </div>
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "#0A0A0B", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(10,10,11,0.5)", pointerEvents: "none", zIndex: 0 }} />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          opacity: 0.4,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        className="hf-hero-inner"
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          padding: "0 80px",
          gap: "80px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
          <div
            className="hero-fade hf-hero-col-left"
            style={{
              animationDelay: "0.08s",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <h1
              className="hf-hero-headline"
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "clamp(40px, 5vw, 72px)",
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.035em",
                margin: 0,
                color: "#f8fafc",
                maxWidth: "100%",
                textAlign: "left",
              }}
            >
              <HeroStaggeredHeadline lang={lang} />
            </h1>
            <button
              type="button"
              onClick={() => navigate("/app")}
              style={{
                marginTop: 24,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "flex-start",
                gap: 8,
                padding: "15px 26px",
                background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
                color: "white",
                fontWeight: 700,
                fontSize: 15,
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 0 36px rgba(99,102,241,0.32), inset 0 1px 0 rgba(255,255,255,0.12)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              {lang === "TR" ? "Kararını öğren →" : "Get your verdict →"}
            </button>
          </div>

          <div className="hf-hero-col-right">
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20,
                padding: "16px 16px 14px",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.45), transparent)",
                }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "CV", lines: [70, 90, 55, 80] },
                  { label: lang === "TR" ? "İş İlanı" : "Job Description", lines: [85, 65, 75, 50] },
                ].map(({ label, lines }) => (
                  <div
                    key={label}
                    style={{
                      background: "rgba(0,0,0,0.25)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8,
                      padding: "8px 10px",
                    }}
                  >
                    <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>{label}</div>
                    {lines.map((w, i) => (
                      <div
                        key={i}
                        style={{
                          height: 4,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.07)",
                          marginBottom: 5,
                          width: `${w}%`,
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "12px 0 10px" }} />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {lang === "TR" ? "Karar" : "Decision"}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontSize: 16,
                      fontWeight: 800,
                      color: r.decisionColor,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.decision}
                  </span>
                </div>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#e2e8f0", flexShrink: 0 }}>
                  34%
                </span>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#f87171",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {lang === "TR" ? "En büyük sorun" : "Biggest mistake"}
                </div>
                <div style={{ fontSize: 12, color: "#fca5a5", fontWeight: 500, lineHeight: 1.4 }}>{r.mistake}</div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#10b981",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {lang === "TR" ? "Düzeltme" : "Fix"}
                </div>
                <div style={{ fontSize: 12, color: "#6ee7b7", fontWeight: 500, lineHeight: 1.4 }}>{r.fix}</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#94a3b8",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {lang === "TR" ? "Recruiter içgörüsü" : "Recruiter insight"}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", lineHeight: 1.45 }}>&quot;{r.insight}&quot;</div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/app")}
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {lang === "TR" ? "Kendi CV'ni analiz et →" : "Analyze your own CV →"}
              </button>
            </div>
          </div>
      </div>
    </section>
  );
}

function FeatureCards({ lang }) {
  const features = lang === "TR" ? [
    { icon: "📊", tag: "Temel", tagColor: "#60a5fa", tagBg: "rgba(59,130,246,0.1)", title: "ATS Skor Motoru", desc: "Beceriler, anahtar kelimeler, deneyim ve biçimlendirme üzerinden çok faktörlü puanlama — gerçek ATS yazılımlarının sizi değerlendirdiği şekilde.", accent: "#3b82f6", glow: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.15)", stat: "%87 doğruluk" },
    { icon: "🚫", tag: "Fark Yaratan", tagColor: "#f87171", tagBg: "rgba(239,68,68,0.1)", title: "Red Motoru", desc: "Sizi sadece puanlamıyoruz — bir işe alım uzmanının CV'nizi geçme nedenlerini ve her birini nasıl düzelteceğinizi tam olarak söylüyoruz.", accent: "#ef4444", glow: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.15)", stat: "En büyük fark" },
    { icon: "🔍", tag: "AI Destekli", tagColor: "#22d3ee", tagBg: "rgba(34,211,238,0.1)", title: "Anahtar Kelime Zekası", desc: "İşe alım uzmanlarının taradığı tam anahtar kelimeleri çıkarır, ardından CV'nizde hangilerinin eksik olduğunu gösterir.", accent: "#22d3ee", glow: "rgba(34,211,238,0.08)", border: "rgba(34,211,238,0.15)", stat: "50+ anahtar kelime" },
    { icon: "✨", tag: "Premium", tagColor: "#a78bfa", tagBg: "rgba(139,92,246,0.1)", title: "CV Yeniden Yazıcı", desc: "AI, CV'nizi hedeflediğiniz role göre daha güçlü, daha alakalı ve tamamen optimize edilmiş şekilde yeniden yazar.", accent: "#8b5cf6", glow: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.15)", stat: "Ort. +23 puan artış" },
  ] : [
    { icon: "🎯", tag: "Core", tagColor: "#f87171", tagBg: "rgba(239,68,68,0.1)", title: "Should I apply or not?", desc: "We don't just score you. We give you a clear decision: High chance, Medium chance, or Not likely — with the exact reason why.", accent: "#f87171", glow: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.15)", stat: "Top differentiator" },
{ icon: "🔍", tag: "AI-Powered", tagColor: "#22d3ee", tagBg: "rgba(34,211,238,0.1)", title: "See what recruiters are scanning for", desc: "We extract the exact keywords recruiters look for, then show you which ones are missing. Not guesses — real job description intelligence.", accent: "#22d3ee", glow: "rgba(34,211,238,0.08)", border: "rgba(34,211,238,0.15)", stat: "50+ keywords extracted" },
{ icon: "💥", tag: "Differentiator", tagColor: "#a78bfa", tagBg: "rgba(139,92,246,0.1)", title: "Generic CV detected", desc: "We flag CVs that sound AI-written or templated. Recruiters reject them in 7 seconds. We tell you exactly which phrases are hurting you.", accent: "#8b5cf6", glow: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.15)", stat: "Key differentiator" },
{ icon: "✨", tag: "Premium", tagColor: "#d4af37", tagBg: "rgba(212,175,55,0.1)", title: "Turn weak bullets into real impact", desc: "CV Rewriter rewrites your bullets to be specific, metric-driven, and human. Not AI-sounding — recruiter-approved.", accent: "#d4af37", glow: "rgba(212,175,55,0.08)", border: "rgba(212,175,55,0.15)", stat: "+23pts avg. boost" },
  ];

  return (
    <section style={{ padding: "80px 0" }}>
      <div style={styles.container}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 999, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", fontSize: "11px", fontWeight: 700, color: "#60a5fa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
            {lang === "TR" ? "HireFit Ne Yapar?" : "What HireFit Does"}
          </div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 14, lineHeight: 1.1 }}>
            {lang === "TR" ? <>Kariyer hedefine ulaşmak için<br />ihtiyacın olan her şey</> : <>Every tool you need<br />to get hired</>}
          </h2>
          <p style={{ color: "#64748b", fontSize: "16px", maxWidth: 480, margin: "0 auto" }}>
            {lang === "TR" ? "Sadece bir ATS aracı değil — HireFit size neden reddedildiğinizi ve tam olarak nasıl düzelteceğinizi söyler." : "Not just another ATS checker — HireFit tells you why you're getting rejected and exactly how to fix it."}
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {features.map(({ icon, tag, tagColor, tagBg, title, desc, accent, glow, border, stat }) => (
            <div key={title} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, padding: 32, transition: "all 0.3s ease", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${glow}, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>{icon}</div>
                <span style={{ padding: "4px 12px", borderRadius: 999, background: tagBg, color: tagColor, fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em" }}>{tag}</span>
              </div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 700, marginBottom: 10 }}>{title}</h3>
              <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.7, marginBottom: 20 }}>{desc}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 8px ${accent}` }} />
                <span style={{ fontSize: "12px", fontWeight: 600, color: accent }}>{stat}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ navigate, lang }) {

  const freeFeatures = lang === "TR"
  ? ["Ayda 2 karar", "Temel ATS skoru", "En büyük hatanı gör", "Paylaşılabilir rapor"]
  : ["2 decisions/month", "Basic ATS score", "See your biggest mistake", "Shareable report"];

const proFeatures = lang === "TR"
  ? ["Her başvuruda karar al", "Tam red analizi", "Zayıf CV'yi interview-ready yap", "Neden reddedildiğini tam anla", "Recruiter'ın ne düşündüğünü gör", "Öncelikli destek"]
  : ["Know before every application", "Full rejection breakdown", "Turn weak CV into interview-ready", "Understand exactly why you get rejected", "See what the recruiter actually thinks", "Priority support"];

const coachFeatures = lang === "TR"
  ? ["Pro'daki her şey", "Müşterilerini doğru role yönlendir", "10 müşteri daveti", "Beyaz etiketli raporlar", "Koç paneli"]
  : ["Everything in Pro", "Guide clients to the right roles", "10 client invites", "White-label reports", "Coach dashboard"];
  

  return (
    <section style={{ padding: "80px 0" }}>
      <div style={styles.container}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 999, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", fontSize: "11px", fontWeight: 700, color: "#60a5fa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
            {lang === "TR" ? "Fiyatlandırma" : "Pricing"}
          </div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(32px,4vw,52px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12, lineHeight: 1.1 }}>
  {lang === "TR" ? "Ne kadar netlik istiyorsun?" : "How much clarity do you want?"}
</h2>
<p style={{ color: "#64748b", fontSize: "16px" }}>
  {lang === "TR" ? "Ücretsiz başla. Gerçekten hazır olduğunda yükselt." : "Free gets you started. Pro gets you hired."}
</p>
</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, maxWidth: 960, margin: "0 auto" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, padding: 32 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Free</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "48px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4 }}>$0</div>
            <div style={{ color: "#475569", fontSize: "13px", marginBottom: 24 }}>{lang === "TR" ? "Sonsuza kadar ücretsiz" : "Forever free"}</div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 24 }} />
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
              {freeFeatures.map(f => (<li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: "#94a3b8" }}><CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0 }} />{f}</li>))}
            </ul>
            <button onClick={() => navigate("/app")} className="hf-btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: "14px" }}>{lang === "TR" ? "Başla" : "Get Started"}</button>
          </div>
          <div style={{ background: "linear-gradient(145deg, rgba(59,130,246,0.1), rgba(99,102,241,0.07))", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 24, padding: 32, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent)" }} />
            <div style={{ position: "absolute", top: 16, right: -30, background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", padding: "4px 40px", transform: "rotate(45deg)" }}>POPULAR</div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#93c5fd", marginBottom: 8 }}>Pro</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "48px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4 }}>$9.99</div>
            <div style={{ color: "#93c5fd", fontSize: "13px", marginBottom: 24 }}> {lang === "TR" ? "Başvurmadan önce net ol" : "Clarity before every application"}

            </div>
            <div style={{ height: 1, background: "rgba(99,102,241,0.2)", marginBottom: 24 }} />
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
              {proFeatures.map(f => (<li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: "#cbd5e1" }}><Star size={13} color="#818cf8" style={{ flexShrink: 0 }} />{f}</li>))}
            </ul>
            <button className="hf-btn-primary" onClick={() => window.open(LEMONSQUEEZY_PRO_CHECKOUT, "_blank")} style={{ width: "100%", justifyContent: "center", fontSize: "14px", background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 0 24px rgba(99,102,241,0.3)" }}>
              {lang === "TR" ? "Pro'ya Geç" : "Upgrade to Pro"} <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, padding: 32 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Coach</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "48px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4 }}>$39</div>
            <div style={{ color: "#475569", fontSize: "13px", marginBottom: 24 }}>{lang === "TR" ? "aylık" : "per month"}</div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 24 }} />
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
              {coachFeatures.map(f => (<li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: "#94a3b8" }}><CheckCircle2 size={14} color="#8b5cf6" style={{ flexShrink: 0 }} />{f}</li>))}
            </ul>
            <button className="hf-btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: "14px", borderColor: "rgba(139,92,246,0.3)", color: "#a78bfa" }}>
              {lang === "TR" ? "Bekleme Listesine Katıl" : "Join Waitlist"} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

const LEMONSQUEEZY_PRO_CHECKOUT =
  "https://hirefit.lemonsqueezy.com/checkout/buy/0e75f4ca-0209-486d-ae5f-00d609c9e2d0";

function ProLiveSection({ navigate, lang }) {
  return (
    <section style={{ padding: "80px 0 100px" }}>
      <div style={styles.container}>
        <div
          style={{
            borderRadius: 24,
            background: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.06))",
            border: "1px solid rgba(99,102,241,0.22)",
            padding: "56px 40px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-80px",
              right: "-80px",
              width: 300,
              height: 300,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative", zIndex: 2, maxWidth: 560, margin: "0 auto" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 999,
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.28)",
                fontSize: "12px",
                fontWeight: 700,
                color: "#6ee7b7",
                letterSpacing: "0.06em",
                marginBottom: 20,
                textTransform: "uppercase",
              }}
            >
              <Zap size={12} /> {lang === "TR" ? "Karar odaklı" : "Decision-first"}
            </div>
            <h2
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                marginBottom: 16,
                lineHeight: 1.2,
              }}
            >
              {lang === "TR" ? "Rakipler skor verir. Biz karar veririz." : "Competitors give you a score. We give you a decision."}
            </h2>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "16px",
                lineHeight: 1.65,
                marginBottom: 28,
                maxWidth: 480,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {lang === "TR"
                ? "Piyasadaki benzer araçlar ortalama $49/ay. HireFit $9.99."
                : "Similar tools in the market average around $49/mo. HireFit is $9.99."}
            </p>
            <button
              type="button"
              onClick={() => navigate("/app")}
              className="hf-btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "14px 28px",
                fontSize: "15px",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                borderRadius: 12,
                background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                boxShadow: "0 0 28px rgba(99,102,241,0.35)",
                color: "#fff",
              }}
            >
              {lang === "TR" ? "Ücretsiz dene →" : "Try for free →"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ navigate, lang }) {
  const t = translations[lang];
  const productLinks = lang === "TR" ? [["CV Analiz Et", "/app"], ["Panel", "/dashboard"], ["Fiyatlandırma", "/"]] : [["Analyze CV", "/app"], ["Dashboard", "/dashboard"], ["Pricing", "/"]];

  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "48px 0 32px" }}>
      <div style={styles.container}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer" }} onClick={() => navigate("/")}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "14px", color: "white" }}>HF</span>
              </div>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "18px", letterSpacing: "-0.02em" }}>HireFit</span>
            </div>
            <p style={{ color: "#475569", fontSize: "14px", lineHeight: 1.7, maxWidth: 280 }}>
              {lang === "TR" ? "AI destekli CV analizi — neden reddedildiğinizi ve nasıl düzelteceğinizi tam olarak söyler." : "AI-powered CV analysis that tells you exactly why you're getting rejected — and how to fix it."}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <a
                href="https://www.linkedin.com/in/muhammetanilceylan/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: "12px", fontWeight: 600, color: "#64748b", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", transition: "color 0.2s, border-color 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#f1f5f9"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
              >
                <Linkedin size={16} strokeWidth={2} aria-hidden />
                LinkedIn
              </a>
              <a
                href="https://www.instagram.com/muhammetanilceylann/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: "12px", fontWeight: 600, color: "#64748b", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", transition: "color 0.2s, border-color 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#f1f5f9"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
              >
                <Instagram size={16} strokeWidth={2} aria-hidden />
                Instagram
              </a>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#334155", marginBottom: 16 }}>{lang === "TR" ? "Ürün" : "Product"}</div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {productLinks.map(([label, path]) => (<li key={label}><button onClick={() => navigate(path)} style={{ background: "none", border: "none", color: "#64748b", fontSize: "14px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }} onMouseEnter={e => e.currentTarget.style.color = "#f1f5f9"} onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>{label}</button></li>))}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#334155", marginBottom: 16 }}>{lang === "TR" ? "Hukuki" : "Legal"}</div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                [t.privacy, "/privacy"],
                [t.terms, "/terms"],
                [t.cookiePolicy, "/privacy"],
              ].map(([label, path]) => (
                <li key={path + label}>
                  <a
                    href={path}
                    onClick={(e) => { e.preventDefault(); navigate(path); }}
                    style={{ color: "#64748b", fontSize: "14px", cursor: "pointer", textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#f1f5f9"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ color: "#334155", fontSize: "13px" }}>© 2026 HireFit. {lang === "TR" ? "Tüm hakları saklıdır." : "All rights reserved."}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "#334155" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 8px #10b981" }} />
            {lang === "TR" ? "Tüm sistemler çalışıyor" : "All systems operational"}
          </div>
        </div>
      </div>
    </footer>
  );
}

function HireFitLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== "/app") return;
    if (location.hash !== "#hirefit-apply-focus") return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById("hirefit-apply-focus");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const ta = el.querySelector("textarea");
      if (ta && typeof ta.focus === "function") ta.focus({ preventScroll: true });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname]);

  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [plan] = useState("Free");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [waitlist, setWaitlist] = useState([]);
  const [cvText, setCvText] = useState("");
  const [jdText, setJdText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [extractingJob, setExtractingJob] = useState(false);
  const [result, setResult] = useState("");
  const [optimizedCv, setOptimizedCv] = useState("");
  const [learningPlan, setLearningPlan] = useState(() => {
    try { return localStorage.getItem("hirefit-learning-plan") || ""; } catch { return ""; }
  });
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [error, setError] = useState("");
  const [alignmentScore, setAlignmentScore] = useState(null);
  /** vs last completed alignment score (localStorage-backed). */
  const [scoreRunProgress, setScoreRunProgress] = useState({ prior: null, delta: null });
  const [roleType, setRoleType] = useState("");
  const [seniority, setSeniority] = useState("");
  const [matchedSkills, setMatchedSkills] = useState([]);
  const [missingSkills, setMissingSkills] = useState([]);
  const [topKeywords, setTopKeywords] = useState([]);
  const [history, setHistory] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [sector, setSector] = useState("Auto-detect");
  const [lastDetectedSector, setLastDetectedSector] = useState("");
  const [lang, setLang] = useState("EN");
  const [showPaywall, setShowPaywall] = useState(false);
  /** Logged-in users: row from user_plans (analysis_count, last_reset_at, plan). */
  const [userPlanRow, setUserPlanRow] = useState(null);
  const [adminTargetEmail, setAdminTargetEmail] = useState("");
  const [adminGrantBusy, setAdminGrantBusy] = useState(false);
  const [adminGrantError, setAdminGrantError] = useState("");
  const [adminGrantNotice, setAdminGrantNotice] = useState("");
  const [showAnonSavePrompt, setShowAnonSavePrompt] = useState(false);
  const [deadline, setDeadline] = useState("1_week");
  const [targetRole, setTargetRole] = useState("");
  const [decisionData, setDecisionData] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [engineV2, setEngineV2] = useState(null);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [reanalysisBaseline, setReanalysisBaseline] = useState(null);
  const [reanalysisResult, setReanalysisResult] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [pressedBtn, setPressedBtn] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [applyingFix, setApplyingFix] = useState(null);
  const [fixResults, setFixResults] = useState({});
  const [activeInput, setActiveInput] = useState(null);
  const [cvDragOver, setCvDragOver] = useState(false);
  const [jdDragOver, setJdDragOver] = useState(false);
  const cvPdfInputRef = useRef(null);
  const jdTxtInputRef = useRef(null);
  const [scoreHistory, setScoreHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hirefit-score-history") || "[]"); } catch { return []; }
  });

  const t = translations[lang];
  const isAdminUser = useMemo(() => isAdmin(user), [user]);
  const hasProAccess = Boolean(isPro || isAdminUser);
  const cvLoaded = cvText.trim().length > 24;
  const jdLoaded = jdText.trim().length > 40;
  const jobUrlIsLinkedIn = useMemo(() => isLinkedInJobUrl(jobUrl), [jobUrl]);
  const cvSectionCount = useMemo(() => countCvSections(cvText), [cvText]);
  const cvSectionsOk = cvSectionCount >= 2;
  const hasOutput = Boolean(
    engineV2 ||
    decisionData ||
    decisionLoading ||
    (alignmentScore !== null && analysisData)
  );

  const decisionImpactContext = useMemo(() => {
    if (!analysisData) return null;
    const gaps = [
      ...(analysisData.rejection_reasons?.high || []).map((issue) => ({
        issue: String(issue),
        impact: "high",
        explanation: "",
      })),
      ...(analysisData.rejection_reasons?.medium || []).map((issue) => ({
        issue: String(issue),
        impact: "medium",
        explanation: "",
      })),
    ];
    return {
      gaps,
      missingKeywords: analysisData.top_keywords || [],
      missingSkills: analysisData.missing_skills || [],
      improvements: analysisData.improvements || [],
      rejectionHigh: analysisData.rejection_reasons?.high,
      rejectionMedium: analysisData.rejection_reasons?.medium,
    };
  }, [analysisData]);

  const handleSharePrompt = () => {
    if (alignmentScore == null) return;
    setShowSharePrompt(true);
  };

  useEffect(() => {
    if (reanalysisBaseline == null || alignmentScore == null) return;
    const delta = Number(alignmentScore) - Number(reanalysisBaseline);
    setReanalysisResult({
      before: Number(reanalysisBaseline),
      after: Number(alignmentScore),
      delta,
    });
    setReanalysisBaseline(null);
  }, [alignmentScore, reanalysisBaseline]);

  useEffect(() => {
    try {
      if (learningPlan) {
        localStorage.setItem("hirefit-learning-plan", learningPlan);
        const prev = JSON.parse(localStorage.getItem("hirefit-roadmap-meta") || "{}");
        localStorage.setItem(
          "hirefit-roadmap-meta",
          JSON.stringify({
            roleType: roleType || prev.roleType || "",
            seniority: seniority || prev.seniority || "",
          })
        );
      } else {
        localStorage.removeItem("hirefit-learning-plan");
        localStorage.removeItem("hirefit-roadmap-meta");
      }
    } catch {}
  }, [learningPlan, roleType, seniority]);

  const syncUserPlanForUser = useCallback(async (userId) => {
    if (!userId) return null;
    const nowIso = new Date().toISOString();
    let { data: row, error } = await supabase
      .from("user_plans")
      .select("id, user_id, plan, analysis_count, last_reset_at")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      console.error("[user_plans]", error);
      return null;
    }
    if (!row) {
      const { error: upErr } = await supabase.from("user_plans").upsert(
        { user_id: userId, plan: "free", analysis_count: 0, last_reset_at: nowIso },
        { onConflict: "user_id", ignoreDuplicates: true }
      );
      if (upErr) {
        console.error("[user_plans upsert]", upErr);
        return null;
      }
      const { data: fetched, error: fetchErr } = await supabase
        .from("user_plans")
        .select("id, user_id, plan, analysis_count, last_reset_at")
        .eq("user_id", userId)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fetchErr || !fetched) {
        console.error("[user_plans refetch]", fetchErr);
        return null;
      }
      row = fetched;
    }
    if (!row) return null;

    if (!row.last_reset_at) {
      await supabase.from("user_plans").update({ last_reset_at: nowIso }).eq("user_id", userId);
      row = { ...row, last_reset_at: nowIso };
    } else if (userPlanNeedsReset(row.last_reset_at)) {
      await supabase.from("user_plans").update({ analysis_count: 0, last_reset_at: nowIso }).eq("user_id", userId);
      row = { ...row, analysis_count: 0, last_reset_at: nowIso };
    }

    setUserPlanRow(row);
    setIsPro(row.plan === "pro");
    return row;
  }, []);

  const extractDataFromReport = (text) => {
    const scoreMatch = text.match(/Final Alignment Score:\s*(\d+)/i);
    setAlignmentScore(scoreMatch ? Number(scoreMatch[1]) : null);
    setRoleType(parseSingleLine(text, "Role Type"));
    setSeniority(parseSingleLine(text, "Seniority"));
    setMatchedSkills(parseBullets(text, "Matched Skills"));
    setMissingSkills(parseBullets(text, "Missing Skills"));
    setTopKeywords(parseBullets(text, "Top Keywords"));
  };

  const fetchAnalyses = async () => {
    try {
      const clearedAt = localStorage.getItem("hirefit-cleared-at");
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) { setHistory([]); return; }
      const { data, error: fetchError } = await supabase.from("analyses").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }).limit(10);
      if (fetchError) return;
      const filtered = (data || []).filter(item => !clearedAt || new Date(item.created_at) > new Date(clearedAt));
      setHistory(filtered.map((item) => ({ id: item.id, createdAt: new Date(item.created_at).toLocaleString(), role: item.role, score: item.alignment_score, cvText: item.cv_text, jdText: item.job_description, report: item.report })));
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        syncUserPlanForUser(session.user.id);
        if (event === "SIGNED_IN" && window.location.pathname === "/login") navigate("/dashboard");
      } else {
        setUser(null);
        setIsPro(false);
        setUserPlanRow(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        syncUserPlanForUser(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, [syncUserPlanForUser, navigate]);

  useEffect(() => {
    const savedUser = localStorage.getItem("hirefit-user");
    const savedWaitlist = localStorage.getItem("hirefit-waitlist");
    if (savedUser) { try { setUser(JSON.parse(savedUser)); } catch {} }
    if (savedWaitlist) { try { setWaitlist(JSON.parse(savedWaitlist)); } catch {} }
    fetchAnalyses();
  }, []);

  useEffect(() => { localStorage.setItem("hirefit-history", JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem("hirefit-waitlist", JSON.stringify(waitlist)); }, [waitlist]);
  useEffect(() => { localStorage.setItem("hirefit-score-history", JSON.stringify(scoreHistory)); }, [scoreHistory]);
  useEffect(() => { if (user) localStorage.setItem("hirefit-user", JSON.stringify(user)); else localStorage.removeItem("hirefit-user"); }, [user]);

  const atsBreakdown = useMemo(() => {
    const keywordCoverage = topKeywords.length > 0 ? Math.round((matchedSkills.length / topKeywords.length) * 100) : 0;
    const skillsScore = alignmentScore !== null ? Math.min(100, Math.max(0, alignmentScore)) : 0;
    const keywordsScore = Math.min(100, Math.max(0, keywordCoverage));
    const experienceScore = alignmentScore !== null ? Math.max(35, alignmentScore - 10) : 0;
    const formattingScore = cvText.trim().length > 200 ? 75 : 45;
    const finalAts = Math.round(skillsScore * 0.4 + keywordsScore * 0.3 + experienceScore * 0.2 + formattingScore * 0.1);
    return { skillsScore, keywordsScore, experienceScore, formattingScore, finalAts };
  }, [alignmentScore, matchedSkills, topKeywords, cvText]);

  const averageScore = useMemo(() => {
    if (!history.length) return 0;
    const nums = history.map((i) => Number(i.score)).filter((n) => !Number.isNaN(n));
    return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
  }, [history]);

  const extractJobFromUrl = async () => {
    if (!jobUrl.trim()) { setError(lang === "TR" ? "Lütfen önce bir iş URL'si yapıştırın." : "Please paste a job URL first."); return; }
    if (isLinkedInJobUrl(jobUrl)) return;
    setExtractingJob(true); setError("");
    try {
      const normalizedUrl = /^https?:\/\//i.test(jobUrl.trim()) ? jobUrl.trim() : `https://${jobUrl.trim()}`;
      const candidates = [
        `${HF_API_BASE}/api/extract-job`,
        ...(typeof window !== "undefined" && window.location.hostname === "localhost" ? ["http://localhost:3000/api/extract-job"] : []),
      ];

      let extracted = "";
      let lastErr = null;

      for (const endpoint of candidates) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: normalizedUrl }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `Extraction failed (${res.status})`);
          extracted = String(data.jobText || data.text || "").trim();
          if (extracted) break;
          throw new Error("Empty extraction");
        } catch (e) {
          lastErr = e;
        }
      }

      if (!extracted) throw lastErr || new Error("Extraction failed");
      setJdText(extracted);
    } catch {
      setError(
        lang === "TR"
          ? `İş ilanı çıkarılamadı.\n\n${t.extractionRecovery}`
          : `Could not extract the job description.\n\n${t.extractionRecovery}`
      );
    }
    finally { setExtractingJob(false); }
  };

  const analyze = async () => {
    if (!cvText.trim() || !jdText.trim()) { setError(lang === "TR" ? "Lütfen hem CV'yi hem de iş ilanını yapıştırın." : "Please paste both the CV and the Job Description."); return; }

    if (user?.id) {
      const row = await syncUserPlanForUser(user.id);
      if (!row) {
        setError(lang === "TR" ? "Plan bilgisi yüklenemedi. Tekrar dene." : "Could not load your plan. Try again.");
        return;
      }
      const hasPaidOrAdminAccess = row.plan === "pro" || isAdmin(user);
      if (!hasPaidOrAdminAccess && (row.analysis_count ?? 0) >= 2) {
        setShowPaywall(true);
        return;
      }
    } else {
      const anonCount = Number(localStorage.getItem("hirefit-anon-count") || 0);
      if (anonCount >= 2) {
        setShowPaywall(true);
        return;
      }
    }

    setShowAnonSavePrompt(false);
    setLoading(true); 
    // Loading messages
const loadingMessages = lang === "TR"
  ? ["Şirket ve sektör çıkarılıyor...", "Şirket araştırılıyor...", "Sektör trendleri analiz ediliyor...", "CV ve ilan eşleştiriliyor...", "Rapor hazırlanıyor..."]
  : ["Extracting company & sector...", "Researching the company...", "Analyzing sector trends...", "Matching CV to the role...", "Preparing your report..."];
let msgIndex = 0;
setLoadingMessage(loadingMessages[0]);
const msgInterval = setInterval(() => {
  msgIndex++;
  if (msgIndex < loadingMessages.length) {
    setLoadingMessage(loadingMessages[msgIndex]);
  } else {
    clearInterval(msgInterval);
  }
}, 900);
    setError("");
    setFixResults({});
    setDecisionData(null);
    setEngineV2(null);
    setLastDetectedSector("");

    let v2Ok = false;
    let creditConsumed = false;
    const jdDerivedTitle = extractJobTitleFromJd(jdText);
    try {
      const v2Res = await fetch(`${HF_API_BASE}/api/analyze-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cvText,
          jobDescription: jdText,
          sector,
          lang: lang === "TR" ? "tr" : "en",
          isPro: hasProAccess,
        }),
      });
      if (v2Res.ok) {
        const v2Raw = await v2Res.json();
        const v2 = ensureFailSafeV2(v2Raw, cvText, jdText, lang);
        v2Ok = true;
        setEngineV2(v2);
        setLastDetectedSector(v2.Context?.sector || v2.detected_sector || "");
        const fs = Number(v2["Final Alignment Score"]) || getFallbackAnalysis(cvText, jdText, lang).score;
        setAlignmentScore(fs);
        setScoreRunProgress(computeScoreRunProgress(fs));
        const modelRole =
          !v2.RoleFit?.locked && v2.RoleFit?.best_role
            ? v2.RoleFit.best_role
            : v2.RoleFit?.role_fit?.[0]?.role || "";
        const savedTitle = resolveSavedAnalysisRole(jdDerivedTitle, modelRole, lang);
        setRoleType(savedTitle);
        setSeniority("");
        const atsMatchedSkills = (v2.ATS?.matched_skills ?? []).filter(Boolean);
        setMatchedSkills(atsMatchedSkills);
        setMissingSkills((v2.ATS?.missing_keywords ?? []).slice(0, 8));
        setTopKeywords((v2.ATS?.top_keywords ?? []).slice(0, 8));
        const reasons = v2.Gaps?.rejection_reasons || [];
        const high = reasons.filter((r) => r.impact === "high").map((r) => r.issue);
        const med = reasons.filter((r) => r.impact === "medium").map((r) => r.issue);
        const low = reasons.filter((r) => r.impact === "low").map((r) => r.issue);
        const reportText = `HireFit Decision Engine\nVerdict: ${mapDecisionLabel(v2.Decision?.final_verdict, lang)}\nAlignment: ${fs}\n\n${v2.Decision?.reasoning || ""}`.trim();
        setResult(reportText);
        const roleMatchesFromV2 =
          !v2.RoleFit?.locked && Array.isArray(v2.RoleFit?.role_fit) && v2.RoleFit.role_fit.length
            ? v2.RoleFit.role_fit.map((r) => ({
                role: r.role,
                match_score: typeof r.score === "number" ? r.score : Number(r.score) || 0,
              }))
            : [];
        const dc = v2.Decision?.confidence;
        const confNum = typeof dc === "number" && !Number.isNaN(dc) ? dc : undefined;
        setAnalysisData({
          alignment_score: fs,
          role_type: savedTitle,
          seniority: "",
          fit_summary: v2.Decision?.reasoning ?? "",
          strengths: v2.Recruiter?.strengths ?? [],
          improvements: v2.Decision?.what_to_fix_first ?? [],
          matched_skills: atsMatchedSkills,
          missing_skills: v2.ATS?.missing_keywords ?? [],
          top_keywords: v2.ATS?.top_keywords ?? [],
          rejection_reasons: { high, medium: med, low },
          score_breakdown: {
            skills_match: v2.ATS?.keyword_match ?? 0,
            keyword_match: v2.ATS?.keyword_match ?? 0,
            experience_depth: v2.ATS?.ats_score ?? 0,
            formatting: v2.ATS?.formatting_score ?? 0,
            skills_explanation: "",
            experience_explanation: "",
          },
          recruiter_simulation: {
            decision: v2.Decision?.final_verdict,
            would_interview: v2.Decision?.final_verdict === "apply_now",
            internal_monologue: firstTwoSentences(v2.Recruiter?.reasoning ?? ""),
            sector: v2.Context?.sector ?? "",
          },
          role_matches: roleMatchesFromV2,
          interview_prep: hasProAccess ? buildInterviewPrepFromV2(v2, lang) : [],
          confidence_score: confNum,
        });
        setScoreHistory((prev) =>
          [{ score: fs, role: savedTitle, date: new Date().toLocaleDateString() }, ...prev].slice(0, 10)
        );
        await supabase.from("analyses").insert({
          role: savedTitle,
          alignment_score: fs,
          cv_text: cvText,
          job_description: jdText,
          report: reportText,
          matched_skills: atsMatchedSkills,
          missing_skills: v2.ATS?.missing_keywords ?? [],
          top_keywords: v2.ATS?.top_keywords ?? [],
          rejection_reasons: { high, medium: med, low },
          seniority: "",
          user_id: user?.id ?? null,
        });
        await fetchAnalyses();
        setShowSharePrompt(true);
        creditConsumed = true;
      }
    } catch (e) {
      console.error("analyze-v2", e);
    }

    if (!v2Ok) {
      try {
        const res = await fetch(`${HF_API_BASE}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cvText, jobDescription: jdText, sector, lang }),
        });
        const data = await res.json();
        const fbLegacy = getFallbackAnalysis(cvText, jdText, lang);
        const safeLegacyV2 = buildFailSafeV2FromFallback(
          { ...fbLegacy, score: Number(data.alignment_score) || fbLegacy.score },
          cvText,
          jdText,
          lang,
        );
        if (Array.isArray(data?.improvements) && data.improvements.length) {
          safeLegacyV2.Decision.what_to_fix_first = data.improvements.slice(0, 3);
          safeLegacyV2.Decision.action_plan = data.improvements.slice(0, 3).join("\n");
        }
        if (Array.isArray(data?.missing_skills) && data.missing_skills.length) {
          safeLegacyV2.ATS.missing_keywords = data.missing_skills.slice(0, 8);
          safeLegacyV2.ATS.top_keywords = data.missing_skills.slice(0, 4);
        }
        if (Array.isArray(data?.matched_skills) && data.matched_skills.length) {
          safeLegacyV2.ATS.matched_skills = data.matched_skills.slice(0, 6);
        }
        if (data?.fit_summary) {
          safeLegacyV2.Decision.reasoning = String(data.fit_summary);
          safeLegacyV2.Recruiter.reasoning = String(data.fit_summary);
        }
        setEngineV2(safeLegacyV2);
        const legacyScore = Number(data.alignment_score) || 0;
        setAlignmentScore(data.alignment_score ?? null);
        setScoreRunProgress(computeScoreRunProgress(legacyScore));
        const legacySavedTitle = resolveSavedAnalysisRole(jdDerivedTitle, data.role_type, lang);
        setRoleType(legacySavedTitle);
        setSeniority(data.seniority ?? "");
        setMatchedSkills(data.matched_skills ?? []);
        setMissingSkills(data.missing_skills ?? []);
        setTopKeywords(data.top_keywords ?? []);
        const reportText = `Fit Summary:\n${data.fit_summary ?? ""}\n\nStrengths:\n${(data.strengths ?? []).map((s) => `- ${s}`).join("\n")}\n\nImprovement Suggestions:\n${(data.improvements ?? []).map((s) => `- ${s}`).join("\n")}\n\nWhy You Might Get Rejected:\nHIGH: ${(data.rejection_reasons?.high ?? []).join(", ") || "None"}\nMEDIUM: ${(data.rejection_reasons?.medium ?? []).join(", ") || "None"}`.trim();
        setResult(reportText);
        setAnalysisData({ ...data, role_type: legacySavedTitle });
        const newEntry = { score: data.alignment_score ?? 0, role: legacySavedTitle, date: new Date().toLocaleDateString() };
        setScoreHistory((prev) => [newEntry, ...prev].slice(0, 10));
        await supabase.from("analyses").insert({
          role: legacySavedTitle,
          alignment_score: data.alignment_score ?? 0,
          cv_text: cvText,
          job_description: jdText,
          report: reportText,
          matched_skills: data.matched_skills ?? [],
          missing_skills: data.missing_skills ?? [],
          top_keywords: data.top_keywords ?? [],
          rejection_reasons: data.rejection_reasons ?? {},
          seniority: data.seniority ?? "",
          user_id: user?.id ?? null,
        });
        await fetchAnalyses();
        setShowSharePrompt(true);
        creditConsumed = true;
      } catch (err) {
        console.error(err);
        const fb = getFallbackAnalysis(cvText, jdText, lang);
        const safeV2 = buildFailSafeV2FromFallback(fb, cvText, jdText, lang);
        setEngineV2(safeV2);
        setAlignmentScore(fb.score);
        setScoreRunProgress(computeScoreRunProgress(fb.score));
        setRoleType(resolveSavedAnalysisRole(jdDerivedTitle, "", lang));
        setSeniority("");
        setMatchedSkills(safeV2.ATS?.matched_skills ?? []);
        setMissingSkills(safeV2.ATS?.missing_keywords ?? []);
        setTopKeywords(safeV2.ATS?.top_keywords ?? []);
        setResult(`HireFit Decision Engine\nVerdict: ${fb.verdict}\nAlignment: ${fb.score}\n\n${fb.summary}`);
        setAnalysisData({
          alignment_score: fb.score,
          role_type: resolveSavedAnalysisRole(jdDerivedTitle, "", lang),
          seniority: "",
          fit_summary: fb.summary,
          strengths: [lang === "TR" ? "Mevcut sinyallerden analiz tamamlandı" : "Analysis completed from available signals"],
          improvements: fb.fixes,
          matched_skills: safeV2.ATS?.matched_skills ?? [],
          missing_skills: safeV2.ATS?.missing_keywords ?? [],
          top_keywords: safeV2.ATS?.top_keywords ?? [],
          rejection_reasons: { high: [fb.keyGap], medium: [], low: [] },
        });
        setError("");
        setShowSharePrompt(true);
      }
    }

    clearInterval(msgInterval);
    setLoadingMessage("");
    setLoading(false);

    if (creditConsumed) {
      if (user?.id) {
        const { error: rpcErr } = await supabase.rpc("increment_user_plan_analysis", {
          p_user_id: user.id,
        });
        if (rpcErr) console.error("[increment_user_plan_analysis]", rpcErr);
        await syncUserPlanForUser(user.id);
      } else {
        const c = Number(localStorage.getItem("hirefit-anon-count") || 0);
        localStorage.setItem("hirefit-anon-count", String(c + 1));
        setShowAnonSavePrompt(true);
      }
    }

    if (!v2Ok) {
      setDecisionLoading(true);
      try {
        const decisionRes = await fetch(`${HF_API_BASE}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cvText, jobDescription: jdText, sector, lang, deadline, targetRole }),
        });
        const decisionResult = await decisionRes.json();
        setDecisionData(decisionResult);
      } catch (err) {
        console.error("Decision engine failed:", err);
      } finally {
        setDecisionLoading(false);
      }
    } else {
      setDecisionLoading(false);
    }
  };

  const applyFix = async (fix, index) => {
    setApplyingFix(index);
    try {
      const res = await fetch(`${HF_API_BASE}/apply-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText, problem: fix.problem, fix: fix.fix, lang })
      });
      const data = await res.json();
      setFixResults(prev => ({ ...prev, [index]: data }));
    } catch (err) {
      console.error("Apply fix failed:", err);
    } finally {
      setApplyingFix(null);
    }
  };

  const optimizeCv = async () => {
    if (!cvText.trim() || !jdText.trim()) { setError(lang === "TR" ? "Lütfen önce hem CV'yi hem de iş ilanını yapıştırın." : "Please paste both the CV and JD first."); return; }
    setOptimizing(true); setError(""); setOptimizedCv("");
    try {
      const res = await fetch(`${HF_API_BASE}/optimize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cvText, jobDescription: jdText, sector, lang }) });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.message || data?.error || t.cvOptimizeFailedTitle;
        const rec = Array.isArray(data?.recovery) ? data.recovery.join(" · ") : t.cvOptimizeFailedRecovery;
        setError(`${msg}\n\n${rec}`);
        return;
      }
      const out = String(data.optimizedCv || "").trim();
      if (!out) {
        setError(`${t.cvOptimizeFailedTitle}\n\n${t.cvOptimizeFailedRecovery}`);
        return;
      }
      setOptimizedCv(out);
      setShowSharePrompt(true);
    } catch {
      setError(`${t.cvOptimizeFailedTitle}\n\n${t.cvOptimizeFailedRecovery}`);
    }
    finally { setOptimizing(false); }
  };

  const reanalyzeAfterFix = async () => {
    if (!optimizedCv.trim()) {
      setError(lang === "TR" ? "Önce CV'yi düzelt." : "Fix your CV first.");
      return;
    }
    if (alignmentScore != null) setReanalysisBaseline(alignmentScore);
    setCvText(optimizedCv);
    window.setTimeout(() => {
      analyze();
    }, 120);
  };

  const generateLearningPlan = async () => {
    if (!missingSkills.length) {
      setError(`${t.roadmapNeedsSkillsTitle}\n\n${t.roadmapNeedsSkillsRecovery}`);
      return;
    }
    setRoadmapLoading(true); setError(""); setLearningPlan("");
    try {
      const res = await fetch(`${HF_API_BASE}/roadmap`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ missingSkills, roleType, seniority }) });
      const data = await res.json();
      setLearningPlan(data.roadmap || "");
    } catch {
      setError(`${t.roadmapFailedTitle}\n\n${t.roadmapFailedRecovery}`);
    }
    finally { setRoadmapLoading(false); }
  };

  const handlePdfFile = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError(lang === "TR" ? "Lütfen bir PDF dosyası yükleyin." : "Please upload a PDF file.");
      return;
    }
    setUploadingPdf(true);
    setError("");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item, idx) => {
          const nextItem = content.items[idx + 1];
          const hasLineBreak = nextItem && Math.abs(nextItem.transform[5] - item.transform[5]) > 5;
          return item.str + (hasLineBreak ? "\n" : " ");
        }).join("");
        fullText += "\n" + pageText;
      }
      setCvText(fullText.trim());
    } catch {
      setError(`${t.pdfReadFailedTitle}\n\n${t.pdfReadFailedRecovery}`);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handlePdfUpload = (event) => {
    const file = event.target.files?.[0];
    handlePdfFile(file);
    event.target.value = "";
  };

  const handleJdTextFile = async (file) => {
    if (!file) return;
    const ok = file.type === "text/plain" || /\.txt$/i.test(file.name);
    if (!ok) {
      setError(lang === "TR" ? "İş ilanı için .txt veya yapıştırma kullanın." : "For JD, use .txt or paste text.");
      return;
    }
    try {
      const txt = await file.text();
      setJdText(txt.trim());
    } catch {
      setError(`${t.fileReadFailedTitle}\n\n${t.fileReadFailedRecovery}`);
    }
  };

  const onCvDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCvDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type === "application/pdf") handlePdfFile(file);
    else if (file.type === "text/plain" || /\.txt$/i.test(file.name)) file.text().then((t) => setCvText(t.trim())).catch(() => {});
    else setError(lang === "TR" ? "PDF veya .txt bırakın." : "Drop a PDF or .txt file.");
  };

  const onJdDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setJdDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    handleJdTextFile(file);
  };

  const clearHistory = async () => {
    setHistory([]);
    localStorage.removeItem("hirefit-history");
    localStorage.setItem("hirefit-cleared-at", new Date().toISOString());
  };

  const loadHistoryItem = (item) => { setCvText(item.cvText || ""); setJdText(item.jdText || ""); setResult(item.report || ""); extractDataFromReport(item.report || ""); setOptimizedCv(""); setLearningPlan(""); setError(""); setDecisionData(null); setFixResults({}); setEngineV2(null); setReanalysisBaseline(null); setReanalysisResult(null); setShowSharePrompt(false); navigate("/app"); };

  const login = async () => {
    if (!email.trim() || !password.trim()) { setError(lang === "TR" ? "Lütfen hem email hem de şifreyi girin." : "Please enter both email and password."); return; }
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); return; }
      setUser(data.user); setEmail(""); setPassword(""); setError(""); navigate("/dashboard");
    } catch { setError(lang === "TR" ? "Giriş başarısız." : "Login failed."); }
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://hirefit-ai.vercel.app/dashboard" }
    });
    if (error) console.error(error);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("hirefit-user");
    setUser(null);
    setIsPro(false);
    setUserPlanRow(null);
    setShowAnonSavePrompt(false);
    setCvText(""); setJdText(""); setResult(""); setAnalysisData(null);
    setAlignmentScore(null); setHistory([]); setOptimizedCv(""); setLearningPlan("");
    setDecisionData(null); setFixResults({}); setEngineV2(null); setReanalysisBaseline(null); setReanalysisResult(null); setShowSharePrompt(false);
    navigate("/");
  };

  const downloadText = (content, filename) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const openUpgrade = () => window.open(LEMONSQUEEZY_PRO_CHECKOUT, "_blank");

  const setUserProAccessByAdmin = useCallback(
    async (grantPro) => {
      if (!isAdminUser) {
        setAdminGrantError(lang === "TR" ? "Bu işlem sadece admin için açık." : "This action is admin-only.");
        return;
      }
      const targetEmail = String(adminTargetEmail || "").trim().toLowerCase();
      if (!targetEmail.includes("@")) {
        setAdminGrantError(lang === "TR" ? "Geçerli bir kullanıcı email'i gir." : "Enter a valid user email.");
        return;
      }
      setAdminGrantBusy(true);
      setAdminGrantError("");
      setAdminGrantNotice("");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken) throw new Error(lang === "TR" ? "Oturum token bulunamadı." : "Missing session token.");
        const res = await fetch(`${HF_API_BASE}/api/admin/pro-access`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ targetEmail, grantPro: Boolean(grantPro) }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || (lang === "TR" ? "Admin güncellemesi başarısız." : "Admin update failed."));
        setAdminGrantNotice(
          grantPro
            ? (lang === "TR" ? `Pro erişimi açıldı: ${targetEmail}` : `Pro access granted: ${targetEmail}`)
            : (lang === "TR" ? `Pro erişimi kaldırıldı: ${targetEmail}` : `Pro access revoked: ${targetEmail}`)
        );
        if (user?.email && String(user.email).trim().toLowerCase() === targetEmail) {
          await syncUserPlanForUser(user.id);
        }
      } catch (e) {
        setAdminGrantError(String(e?.message || (lang === "TR" ? "Admin işlemi başarısız." : "Admin action failed.")));
      } finally {
        setAdminGrantBusy(false);
      }
    },
    [adminTargetEmail, isAdminUser, lang, syncUserPlanForUser, user]
  );

  const sectorLabels = lang === "TR"
    ? ["Otomatik", "Teknoloji / Startup", "Danışmanlık", "Finans", "FMCG / Perakende", "Sağlık", "Kamu", "Telekom / Donanım", "Ürün Tasarımı / UX"]
    : ["Auto-detect", "Tech / Startup", "Consulting", "Finance", "FMCG / Retail", "Healthcare", "Government", "Telecom / Hardware", "Product Design / UX"];
  const sectorValues = HF_SECTOR_VALUES;

  const hireFitOutletContext = {
    navigate,
    location,
    lang,
    setLang,
    T,
    t,
    user,
    logout,
    email,
    setEmail,
    password,
    setPassword,
    error,
    login,
    loginWithGoogle,
    isPro: hasProAccess,
    isAdminUser,
    plan,
    waitlist,
    history,
    loadHistoryItem,
    clearHistory,
    averageScore,
    scoreHistory,
    learningPlan,
    roleType,
    seniority,
    cvText,
    setCvText,
    jdText,
    setJdText,
    jobUrl,
    setJobUrl,
    jobUrlIsLinkedIn,
    extractingJob,
    extractJobFromUrl,
    cvLoaded,
    jdLoaded,
    cvSectionCount,
    cvSectionsOk,
    hasOutput,
    cvDragOver,
    setCvDragOver,
    jdDragOver,
    setJdDragOver,
    cvPdfInputRef,
    jdTxtInputRef,
    uploadingPdf,
    handlePdfUpload,
    handleJdTextFile,
    onCvDrop,
    onJdDrop,
    activeInput,
    setActiveInput,
    showAdvanced,
    setShowAdvanced,
    lastDetectedSector,
    sector,
    setSector,
    sectorLabels,
    sectorValues,
    deadline,
    setDeadline,
    userPlanRow,
    analyze,
    loading,
    loadingMessage,
    engineV2,
    alignmentScore,
    decisionData,
    decisionLoading,
    openUpgrade,
    optimizeCv,
    optimizing,
    handleSharePrompt,
    fixResults,
    applyingFix,
    applyFix,
    showAnonSavePrompt,
    setShowAnonSavePrompt,
    analysisData,
    matchedSkills,
    missingSkills,
    topKeywords,
    result,
    optimizedCv,
    downloadText,
    reanalyzeAfterFix,
    roadmapLoading,
    generateLearningPlan,
    decisionImpactContext,
    reanalysisResult,
    setError,
    scoreRunProgress,
    adminTargetEmail,
    setAdminTargetEmail,
    adminGrantBusy,
    adminGrantError,
    adminGrantNotice,
    setUserProAccessByAdmin,
  };

  return (
    <div style={styles.page}>
      <Navbar pathname={location.pathname} user={user} logout={logout} navigate={navigate} lang={lang} setLang={setLang} />

      {showPaywall && (
        <PaywallModal
          lang={lang}
          onClose={() => setShowPaywall(false)}
          onUpgrade={() => { setShowPaywall(false); openUpgrade(); }}
        />
      )}
      <SharePromptModal
        open={showSharePrompt}
        lang={lang}
        score={alignmentScore}
        verdictLabel={alignmentScore != null ? getScoreFinalVerdict(alignmentScore, lang).shareLabel : ""}
        biggestMistake={
          engineV2?.Gaps?.biggest_gap ||
          engineV2?.Gaps?.rejection_reasons?.[0]?.issue ||
          decisionData?.biggestMistake ||
          ""
        }
        onClose={() => setShowSharePrompt(false)}
      />

      <Outlet context={hireFitOutletContext} />


</div>
  );
}


export function LandingPage() {
  const { navigate, lang } = useOutletContext();
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        overflowX: "hidden",
        background: "#0A0A0B",
      }}
    >
      <HeroSection navigate={navigate} lang={lang} />
      <FeatureCards lang={lang} />
      <TrustSection lang={lang} />
      <ComparisonSection lang={lang} />
      <PricingSection navigate={navigate} lang={lang} />
      <ProLiveSection navigate={navigate} lang={lang} />
      <Footer navigate={navigate} lang={lang} />
    </div>
  );
}

export function TermsPage() {
  const { navigate, lang, t } = useOutletContext();
  return (
        <div style={{ width: "100%", maxWidth: "none", margin: 0, padding: "60px clamp(20px, 5vw, 80px)", boxSizing: "border-box" }}>
          <button onClick={() => navigate("/")} style={{ marginBottom: 32, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{lang === "TR" ? "← Geri" : "← Back"}</button>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, marginBottom: 8 }}>{t.terms}</h1>
          <p style={{ color: "#475569", marginBottom: 40, fontSize: 14 }}>{lang === "TR" ? "Son güncelleme: Nisan 2026" : "Last updated: April 2026"}</p>
          {(lang === "TR"
            ? [
                ["1. Şartlara Onay", "HireFit'e erişerek veya kullanarak bu Şartlara bağlı kalmayı kabul edersiniz. HireFit, Kıbrıs Lefkoşa'da ikamet eden bireysel geliştirici Muhammed Anıl Ceylan tarafından işletilmektedir."],
                ["2. Hizmetin Tanımı", "HireFit, yapay zekâ destekli bir CV analiz aracıdır. Kullanıcılar CV'lerini iş ilanlarıyla karşılaştırabilir, ATS puanları alabilir, beceri açıklarını tespit edebilir, optimize edilmiş CV önerileri oluşturabilir ve işe alım simülasyonu içgörülerine erişebilir."],
                ["3. Hesaplar", "Doğru bilgi vermeniz, en az 18 yaşında olmanız ve hesabınızın güvenliğini sağlamanız gerekir. Kişi başına bir hesap."],
                ["4. Abonelik ve Ödemeler", "Ücretsiz Plan: Ayda 2 CV analizi ücretsiz. Pro Plan: 7 günlük ücretsiz deneme ile ayda 9,99 USD. Koç Planı: 39 USD/ay. Ödemeler Lemon Squeezy üzerinden işlenir. Abonelikler iptal edilmedikçe otomatik yenilenir. İade talepleri ücret tahsilinden itibaren 7 gün içinde iletilmelidir."],
                ["5. Kabul Edilebilir Kullanım", "Yasadışı veya zararlı içerik yüklememeyi, Hizmeti tersine mühendislik yapmamayı, Hizmete toplu erişim için otomatik araçlar kullanmamayı veya hesap kimlik bilgilerini paylaşmamayı kabul edersiniz."],
                ["6. Fikri Mülkiyet", "Yüklediğiniz CV ve iş ilanı içeriğinin mülkiyeti size aittir. Yükleme yaparak, Hizmeti sunma amacıyla işlememiz için bize sınırlı bir lisans vermiş olursunuz."],
                ["7. Yapay Zekâ ile Üretilen İçerik", "HireFit, çıktıları üretmek için üçüncü taraf yapay zekâ modelleri (Groq üzerinden Llama 3.1) kullanır. Bunlar yalnızca bilgilendirme amaçlıdır ve profesyonel kariyer danışmanlığının yerini tutmaz."],
                ["8. Feragatnameler", "Hizmet, herhangi bir garanti verilmeksizin \"olduğu gibi\" sunulur. Kesintisiz veya hatasız hizmet garanti etmediğimiz gibi analizin iş görüşmesi veya teklifle sonuçlanacağını da garanti etmeyiz."],
                ["9. Sorumluluğun Sınırlandırılması", "Yasaların izin verdiği azami ölçüde dolaylı, arızi veya netice kabilinden doğan zararlardan sorumlu tutulamayız. Toplam sorumluluk, talep öncesindeki 3 ay içinde ödenen tutarı aşamaz."],
                ["10. Uygulanacak Hukuk", "Bu Şartlar Kıbrıs Cumhuriyeti yasalarına tabidir."],
                ["11. İletişim", "support@hirefit.ai — hirefit-ai.vercel.app"],
              ]
            : [
                ["1. Agreement to Terms", "By accessing or using HireFit, you agree to be bound by these Terms. HireFit is operated by Muhammed Anıl Ceylan, an individual developer based in Nicosia, Cyprus."],
                ["2. Description of Service", "HireFit is an AI-powered CV analysis tool. Users can compare their CV against job descriptions, receive ATS scores, identify skill gaps, generate optimized CV suggestions, and access recruiter simulation insights."],
                ["3. Accounts", "You must provide accurate information, be at least 18 years old, and maintain the security of your account. One account per person."],
                ["4. Subscription and Payments", "Free Plan: 2 CV analyses/month at no cost. Pro Plan: $9.99/month with 7-day free trial. Coach Plan: $39/month. Payments processed via Lemon Squeezy. Subscriptions renew automatically unless cancelled. Refund requests must be submitted within 7 days of charge."],
                ["5. Acceptable Use", "You agree not to upload illegal or harmful content, reverse-engineer the Service, use automated tools to bulk-access the Service, or share account credentials."],
                ["6. Intellectual Property", "You retain ownership of your uploaded CV and job description content. By uploading, you grant us a limited license to process it for the purpose of providing the Service."],
                ["7. AI-Generated Content", "HireFit uses third-party AI models (Llama 3.1 via Groq) to generate outputs. These are for informational purposes only and are not a substitute for professional career advice."],
                ["8. Disclaimers", "The Service is provided \"as is\" without warranties of any kind. We do not guarantee uninterrupted or error-free service, or that analysis will result in job interviews or offers."],
                ["9. Limitation of Liability", "To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages. Total liability shall not exceed amounts paid in the 3 months preceding the claim."],
                ["10. Governing Law", "These Terms are governed by the laws of Cyprus."],
                ["11. Contact", "support@hirefit.ai — hirefit-ai.vercel.app"],
              ]
          ).map(([title, body]) => (
            <div key={title} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#e2e8f0" }}>{title}</h3>
              <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.8 }}>{body}</p>
            </div>
          ))}
        </div>
  );
}

export function PrivacyPage() {
  const { navigate, lang, t } = useOutletContext();
  return (
        <div style={{ width: "100%", maxWidth: "none", margin: 0, padding: "60px clamp(20px, 5vw, 80px)", boxSizing: "border-box" }}>
          <button onClick={() => navigate("/")} style={{ marginBottom: 32, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{lang === "TR" ? "← Geri" : "← Back"}</button>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, marginBottom: 8 }}>{t.privacy}</h1>
          <p style={{ color: "#475569", marginBottom: 40, fontSize: 14 }}>{lang === "TR" ? "Son güncelleme: Nisan 2026" : "Last updated: April 2026"}</p>
          {(lang === "TR"
            ? [
                ["1. Biz Kimiz", "HireFit, Kıbrıs Lefkoşa'da ikamet eden bireysel geliştirici Muhammed Anıl Ceylan tarafından işletilmektedir. İletişim: support@hirefit.ai"],
                ["2. Topladığımız Veriler", "Hesap bilgileri (e-posta, Google OAuth ile ad), yüklediğiniz CV içeriği, iş ilanları, kullanım verileri ile cihaz ve oturum verileri. Ödeme ayrıntıları yalnızca Lemon Squeezy tarafından işlenir; kart bilgilerini hiçbir şekilde saklamıyoruz."],
                ["3. Verilerinizi Nasıl Kullanıyoruz", "Hizmeti sunmak, yapay zekâ analizini yürütmek, hesabınızı ve aboneliğinizi yönetmek, işlemsel e-postalar göndermek ve dolandırıcılığı tespit etmek için. Verilerinizi satmıyoruz ve CV içeriğinizi yapay zekâ modellerini eğitmek için kullanmıyoruz."],
                ["4. Veri Saklama", "Veritabanı: Supabase (AB'de barındırılmış). Kimlik doğrulama: Google OAuth ile Supabase Auth. Veriler hesabınız etkin olduğu sürece saklanır; dilediğiniz zaman silinmesini talep edebilirsiniz."],
                ["5. Üçüncü Taraf Hizmetleri", "Supabase (veritabanı ve kimlik doğrulama), Groq (yapay zekâ analizi), Lemon Squeezy (ödemeler), Vercel (barındırma), Railway (arka uç). CV'niz işlenmek üzere API üzerinden yapay zekâ sağlayıcısına iletilir; varsayılan olarak modellerini eğitmek için kullanılmaz."],
                ["6. Çerezler", "Yalnızca oturum yönetimi için asgari düzeyde çerez kullanıyoruz. Reklam veya izleme çerezi kullanılmaz."],
                ["7. Haklarınız", "Verilerinize erişebilir, düzeltebilir, silebilir veya dışa aktarabilirsiniz. Talepte bulunmak için support@hirefit.ai adresine yazabilirsiniz."],
                ["8. GDPR", "AB/AEA kullanıcıları için verileri sözleşmenin ifası ve meşru menfaat çerçevesinde işliyoruz. Yerel veri koruma otoritenize şikâyet başvurusu yapma hakkınız vardır."],
                ["9. Güvenlik", "HTTPS/TLS, özetlenmiş (hash) şifreler ve satır düzeyi güvenlik kullanıyoruz. Hiçbir iletim yöntemi %100 güvenli değildir."],
                ["10. Çocuklar", "HireFit 18 yaşın altındaki kullanıcılar için tasarlanmamıştır. Reşit olmayanlardan bilerek kişisel veri toplamıyoruz."],
                ["11. İletişim", "support@hirefit.ai — hirefit-ai.vercel.app — Lefkoşa, Kıbrıs"],
              ]
            : [
                ["1. Who We Are", "HireFit is operated by Muhammed Anıl Ceylan, Nicosia, Cyprus. Contact: support@hirefit.ai"],
                ["2. Data We Collect", "Account info (email, name via Google OAuth), CV content you upload, job descriptions, usage data, and device/session data. Payment details are handled entirely by Lemon Squeezy — we never store card information."],
                ["3. How We Use Your Data", "To provide the Service, process AI analysis, manage your account and subscription, send transactional emails, and detect fraud. We do not sell your data or use your CV content to train AI models."],
                ["4. Data Storage", "Database: Supabase (EU-hosted). Authentication: Supabase Auth with Google OAuth. Data is retained while your account is active. You may request deletion at any time."],
                ["5. Third-Party Services", "Supabase (database/auth), Groq (AI analysis), Lemon Squeezy (payments), Vercel (hosting), Railway (backend). Your CV is sent to our AI provider via API for processing — it is not used to train their models by default."],
                ["6. Cookies", "We use minimal cookies for session management only. No advertising or tracking cookies."],
                ["7. Your Rights", "You may access, correct, delete, or export your data at any time. Email support@hirefit.ai to make a request."],
                ["8. GDPR", "For EU/EEA users, we process data under contract performance and legitimate interests. You have the right to lodge a complaint with your local data protection authority."],
                ["9. Security", "We use HTTPS/TLS, hashed passwords, and row-level security. No transmission method is 100% secure."],
                ["10. Children", "HireFit is not intended for users under 18. We do not knowingly collect data from minors."],
                ["11. Contact", "support@hirefit.ai — hirefit-ai.vercel.app — Nicosia, Cyprus"],
              ]
          ).map(([title, body]) => (
            <div key={title} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#e2e8f0" }}>{title}</h3>
              <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.8 }}>{body}</p>
            </div>
          ))}
        </div>
  );
}

export function RoadmapRoute() {
  const { navigate, lang, t, isPro, openUpgrade, analysisData, engineV2, cvText, jdText, alignmentScore } = useOutletContext();
  return (
    <PersonalizedRoadmapPage
      navigate={navigate}
      lang={lang}
      t={t}
      isPro={isPro}
      openUpgrade={openUpgrade}
      analysisData={analysisData}
      engineV2={engineV2}
      cvText={cvText}
      jdText={jdText}
      alignmentScore={alignmentScore}
    />
  );
}

export function LoginPage() {
  const { t, T: ctxTheme, lang, email, setEmail, password, setPassword, error, login, loginWithGoogle } = useOutletContext();
  const theme = ctxTheme || T;
  return (
        <div style={{ ...styles.container, padding: "80px 24px" }}>
          <div style={{ maxWidth: 440, margin: "0 auto" }}>
            <div className="hf-card" style={{ padding: 40 }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, marginBottom: 8 }}>{t.welcomeBack}</h2>
              <p style={{ color: theme.textSub, fontSize: "14px", marginBottom: 28 }}>{t.signInDesc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input className="hf-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={lang === "TR" ? "E-posta adresi" : "Email address"} />
                <input type="password" className="hf-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={lang === "TR" ? "Şifre" : "Password"} />
                {error && <div style={{ color: "#f87171", fontSize: "13px", padding: "10px 14px", background: "rgba(239,68,68,0.1)", borderRadius: 8 }}>{error}</div>}
                <button className="hf-btn-primary" onClick={login} style={{ justifyContent: "center", marginTop: 4 }}><LogIn size={15} />{t.continueBtn}</button>
                <button onClick={loginWithGoogle} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "white", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  {t.continueGoogle}
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}

export function DashboardPage() {
  const {
    t, lang, T: ctxTheme, history, loadHistoryItem, clearHistory, averageScore, isPro, isAdminUser, plan, waitlist, scoreHistory, navigate,
    adminTargetEmail, setAdminTargetEmail, adminGrantBusy, adminGrantError, adminGrantNotice, setUserProAccessByAdmin,
  } = useOutletContext();
  const theme = ctxTheme || T;
  return (
        <div style={{ ...styles.container, padding: "48px 24px" }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "42px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>{t.dashboard}</h1>
            <p style={{ color: theme.textSub, fontSize: "16px" }}>{t.dashboardDesc}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            <StatCard title={t.totalAnalyses} value={history.length} icon={<History size={16} color={T.blue} />} />
            <StatCard title={t.averageScore} value={`${averageScore}/100`} icon={<TrendingUp size={16} color={T.cyan} />} />
            <StatCard title={t.currentPlan} value={isPro ? "Pro ✨" : plan} icon={<Crown size={16} color="#fbbf24" />} />
            <StatCard title={t.waitlistLeads} value={waitlist.length} icon={<Mail size={16} color={T.green} />} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <HistoryList history={history} onLoadItem={loadHistoryItem} onClear={clearHistory} lang={lang} />
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <ScoreProgressCard scoreHistory={scoreHistory} lang={lang} />
              <div className="hf-card" style={{ padding: 28 }}>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 700, marginBottom: 20 }}>{t.productRoadmap}</h3>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                  {(lang === "TR"
                    ? ["Gerçek kimlik doğrulama (Supabase)", "Veritabanı destekli raporlar", "Paylaşılabilir rapor URL'leri", "Stripe ödeme sistemi", "İşe alım uzmanı paneli modu"]
                    : ["Real authentication (Supabase / Clerk)", "Database-backed saved reports", "Shareable public report URLs", "Stripe checkout for Pro plan", "Recruiter dashboard mode"]
                  ).map((item) => (
                    <li key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: theme.textSub }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.blue, flexShrink: 0 }} />{item}
                    </li>
                  ))}
                </ul>
                <button className="hf-btn-primary" onClick={() => navigate("/app")} style={{ marginTop: 24, fontSize: "14px" }}>{t.openProduct} <ArrowRight size={14} /></button>
              </div>
              {isAdminUser ? (
                <div className="hf-card" style={{ padding: 22 }}>
                  <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                    {lang === "TR" ? "Admin Pro Erişimi" : "Admin Pro Access"}
                  </h3>
                  <p style={{ fontSize: 13, color: theme.textSub, margin: "0 0 10px" }}>
                    {lang === "TR"
                      ? "Kullanıcıya manuel Pro aç/kapat. Bu kullanıcı için paywall anında güncellenir."
                      : "Manually toggle Pro for any user. Paywall updates immediately for that user."}
                  </p>
                  <input
                    value={adminTargetEmail}
                    onChange={(e) => setAdminTargetEmail(e.target.value)}
                    placeholder={lang === "TR" ? "kullanici@email.com" : "user@email.com"}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${theme.border}`,
                      background: "rgba(255,255,255,0.02)",
                      color: theme.text,
                      marginBottom: 10,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="hf-btn-primary" disabled={adminGrantBusy} onClick={() => setUserProAccessByAdmin(true)} style={{ fontSize: 13 }}>
                      {lang === "TR" ? "Pro Aç" : "Grant Pro"}
                    </button>
                    <button
                      disabled={adminGrantBusy}
                      onClick={() => setUserProAccessByAdmin(false)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1px solid ${theme.border}`,
                        background: "transparent",
                        color: theme.textSub,
                        fontWeight: 700,
                        cursor: adminGrantBusy ? "wait" : "pointer",
                      }}
                    >
                      {lang === "TR" ? "Pro Kapat" : "Revoke Pro"}
                    </button>
                  </div>
                  {adminGrantNotice ? <div style={{ marginTop: 10, fontSize: 12, color: "#34d399" }}>{adminGrantNotice}</div> : null}
                  {adminGrantError ? <div style={{ marginTop: 10, fontSize: 12, color: "#f87171" }}>{adminGrantError}</div> : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
  );
}

export function AnalyzerPage() {
  const {
    navigate, lang, t, activeInput, cvLoaded, uploadingPdf, cvPdfInputRef, cvDragOver, setCvDragOver,
    handlePdfUpload, onCvDrop, cvText, setCvText, setActiveInput, cvSectionsOk, jdLoaded, jdDragOver, setJdDragOver, onJdDrop,
    jdText, setJdText, jobUrl, setJobUrl, jobUrlIsLinkedIn, extractingJob, extractJobFromUrl, jdTxtInputRef, handleJdTextFile,
    showAdvanced, setShowAdvanced, lastDetectedSector, sector, setSector, sectorLabels, sectorValues,
    deadline, setDeadline, isPro, user, userPlanRow, analyze, loading, loadingMessage, error, hasOutput,
    engineV2, alignmentScore, decisionData, decisionLoading, openUpgrade, optimizeCv, optimizing,
    handleSharePrompt, fixResults, applyingFix, applyFix, showAnonSavePrompt, setShowAnonSavePrompt,
    analysisData, matchedSkills, missingSkills, topKeywords, result, optimizedCv, learningPlan,
    downloadText, reanalyzeAfterFix, roadmapLoading, generateLearningPlan, decisionImpactContext,
    reanalysisResult, history, clearHistory, loadHistoryItem, scoreRunProgress,
  } = useOutletContext();
  return (
  <div className="hf-analyzer-page" style={{ maxWidth: 1320, margin: "0 auto", padding: "48px 24px", minHeight: "calc(100vh - 80px)" }}>

    {/* HEADER */}
    <div className="hf-analyzer-hero">
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 999, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", fontSize: "11px", fontWeight: 700, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#8b5cf6", boxShadow: "0 0 6px #8b5cf6", display: "inline-block" }} />
        {lang === "TR" ? "AI Kariyer Analizi" : "AI Career Analysis"}
      </div>
      <h1 className="hf-analyzer-hero-title" style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 12 }}>
        {lang === "TR" ? "Başvurmadan önce gerçekten şansın var mı öğren." : "Know if you should apply - before you waste time."}
      </h1>
      <p className="hf-analyzer-hero-sub">
        {lang === "TR" ? "Recruiter'ların CV'ni saniyeler içinde nasıl değerlendirdiğini net gör." : "See exactly how recruiters evaluate your CV in seconds."}
      </p>
    </div>

    <div className="hf-analyzer-layout">
    <motion.div
      className={`hf-input-panel hf-analyzer-cv ${activeInput === "cv" ? "hf-input-panel--active" : ""}`}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
    >
    {/* CV INPUT — drop zone + paste */}
    <motion.div
      style={{ marginBottom: 20 }}
      animate={cvLoaded ? { boxShadow: ["0 0 0 rgba(34,197,94,0)", "0 0 22px rgba(34,197,94,0.2)", "0 0 0 rgba(34,197,94,0)"] } : {}}
      transition={{ duration: 0.85 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: "#f1f5f9" }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.2)", display: "grid", placeItems: "center" }}>
            <FileText size={12} color="#60a5fa" />
          </div>
          {lang === "TR" ? "CV'n" : "Your CV"}
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => cvPdfInputRef.current?.click()}
          disabled={uploadingPdf}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(59,130,246,0.14)", border: "1px solid rgba(59,130,246,0.35)", cursor: uploadingPdf ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 11, color: "#93c5fd" }}
        >
          <FileUp size={12} />
          {uploadingPdf ? (lang === "TR" ? "Okunuyor..." : "Reading...") : (lang === "TR" ? "PDF yükle" : "Upload PDF")}
        </motion.button>
        <input ref={cvPdfInputRef} type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: "none" }} />
      </div>

      <div
        className={`hf-dropzone ${cvDragOver ? "hf-dropzone--drag" : ""} ${uploadingPdf ? "hf-dropzone--loading" : ""} ${cvLoaded ? "hf-dropzone--loaded" : ""}`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setCvDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setCvDragOver(false); }}
        onDrop={onCvDrop}
        onClick={() => { if (!uploadingPdf && !cvText.trim()) cvPdfInputRef.current?.click(); }}
        role="presentation"
      >
        {uploadingPdf ? (
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <Loader2 size={22} color="#a78bfa" style={{ animation: "spin 0.8s linear infinite", marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 800, color: "#e9d5ff" }}>{lang === "TR" ? "CV ayrıştırılıyor..." : "Parsing CV..."}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{lang === "TR" ? "PDF metne çevriliyor" : "Extracting text from PDF"}</div>
          </div>
        ) : !cvText.trim() ? (
          <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
            <Upload size={26} color="#64748b" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f0" }}>{lang === "TR" ? "CV'ni bırak veya metin yapıştır" : "Drop your CV or paste text"}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{lang === "TR" ? "PDF sürükleyin veya aşağıya yapıştırın" : "Drag a PDF here, or paste below"}</div>
          </div>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#6ee7b7", marginBottom: 8 }}>{lang === "TR" ? "✓ CV hazır" : "✓ CV ready"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94a3b8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={14} color="#34d399" /> {lang === "TR" ? "CV yüklendi" : "CV Loaded"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={14} color={cvSectionsOk ? "#34d399" : "#64748b"} /> {cvSectionsOk ? (lang === "TR" ? "Bölümler algılandı" : "Sections detected") : (lang === "TR" ? "Bölümler: daha fazla içerik ekle" : "Sections: add more structure")}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={14} color={cvLoaded ? "#34d399" : "#64748b"} /> {lang === "TR" ? "Analize hazır" : "Ready for analysis"}
              </div>
            </div>
          </div>
        )}

        <textarea
          className="hf-textarea hf-dropzone__textarea hf-analyzer-textarea"
          placeholder={t.pasteCv}
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          onFocus={() => setActiveInput("cv")}
          onBlur={() => setActiveInput((v) => (v === "cv" ? null : v))}
          onClick={(e) => e.stopPropagation()}
          readOnly={uploadingPdf}
        />
      </div>
    </motion.div>
    </motion.div>

    <motion.div
      className={`hf-input-panel hf-analyzer-jd ${activeInput === "jd" ? "hf-input-panel--active" : ""}`}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
    >
    {/* JD INPUT — drop / paste / link */}
    <motion.div
      id="hirefit-apply-focus"
      style={{ marginBottom: 24, scrollMarginTop: 96 }}
      animate={jdLoaded ? { boxShadow: ["0 0 0 rgba(34,211,238,0)", "0 0 22px rgba(34,211,238,0.2)", "0 0 0 rgba(34,211,238,0)"] } : {}}
      transition={{ duration: 0.85 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: "#f1f5f9" }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.2)", display: "grid", placeItems: "center" }}>
            <Briefcase size={12} color="#22d3ee" />
          </div>
          {lang === "TR" ? "İş ilanı" : "Job description"}
        </label>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => jdTxtInputRef.current?.click()}
          disabled={extractingJob}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.35)", cursor: extractingJob ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 11, color: "#67e8f9" }}
        >
          <FileUp size={12} />
          {lang === "TR" ? ".txt yükle" : "Upload .txt"}
        </motion.button>
        <input ref={jdTxtInputRef} type="file" accept=".txt,text/plain" onChange={(e) => { handleJdTextFile(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
        {lang === "TR"
          ? "Yapıştır, .txt bırak veya linkten çek — en doğru sonuç için tam metin. "
          : "Paste, drop a .txt, or extract from a link — full text works best. "}
        <span style={{ color: "#67e8f9", fontWeight: 700 }}>{t.orPasteLinkHint}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          value={jobUrl}
          onChange={(e) => setJobUrl(e.target.value)}
          placeholder={lang === "TR" ? "İş ilanı URL (isteğe bağlı)" : "Job posting URL (optional)"}
          style={{ flex: 1, minWidth: 200, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#cbd5e1", outline: "none" }}
        />
        <motion.button
          type="button"
          onClick={extractJobFromUrl}
          disabled={extractingJob || jobUrlIsLinkedIn}
          whileHover={{ scale: extractingJob || jobUrlIsLinkedIn ? 1 : 1.02 }}
          whileTap={{ scale: extractingJob || jobUrlIsLinkedIn ? 1 : 0.98 }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(34,211,238,0.45)", background: jobUrlIsLinkedIn ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(59,130,246,0.16))", color: jobUrlIsLinkedIn ? "#64748b" : "#67e8f9", fontWeight: 800, cursor: extractingJob || jobUrlIsLinkedIn ? "not-allowed" : "pointer", boxShadow: jobUrlIsLinkedIn ? "none" : "0 0 18px rgba(34,211,238,0.2)" }}
        >
          <Link2 size={12} />
          {extractingJob ? (lang === "TR" ? "İlan detayları çekiliyor..." : "Extracting job details...") : (lang === "TR" ? "Linkten İlanı Analiz Et" : "Analyze Job from Link")}
        </motion.button>
      </div>
      {jobUrlIsLinkedIn ? (
        <div
          role="status"
          style={{
            marginBottom: 10,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(251,191,36,0.35)",
            background: "rgba(251,191,36,0.08)",
            fontSize: 13,
            lineHeight: 1.45,
            color: "#fde68a",
          }}
        >
          {lang === "TR"
            ? "LinkedIn ilanları tam olarak çekilemeyebilir. En iyi sonuç için ilanı LinkedIn'den kopyalayıp buraya yapıştırın."
            : "LinkedIn job posts can't be fully extracted. For best results, copy and paste the job description directly."}
        </div>
      ) : null}
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
        {lang === "TR"
          ? "Diğer siteler (Kariyer.net, Indeed, Glassdoor vb.) için link genelde çalışır; olmazsa yapıştırın."
          : "URL extraction works for many job boards (e.g. Kariyer.net, Indeed, Glassdoor); paste the text if it doesn’t."}
      </div>

      <div
        className={`hf-dropzone hf-dropzone--jd ${jdDragOver ? "hf-dropzone--drag" : ""} ${extractingJob ? "hf-dropzone--loading" : ""} ${jdLoaded ? "hf-dropzone--loaded" : ""}`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setJdDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setJdDragOver(false); }}
        onDrop={onJdDrop}
        role="presentation"
      >
        {extractingJob ? (
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <Loader2 size={22} color="#22d3ee" style={{ animation: "spin 0.8s linear infinite", marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 800, color: "#a5f3fc" }}>{lang === "TR" ? "İlan detayları çıkarılıyor..." : "Extracting job details..."}</div>
          </div>
        ) : !jdText.trim() ? (
          <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
            <Briefcase size={24} color="#64748b" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 800, color: "#e2e8f0" }}>{lang === "TR" ? "İlanı buraya bırak veya yapıştır" : "Drop or paste the job description"}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {lang === "TR" ? ".txt bırak veya aşağıya yapıştır" : "Drop a .txt or paste below"}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#67e8f9", marginBottom: 8 }}>{lang === "TR" ? "✓ İlan yüklendi" : "✓ JD loaded"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94a3b8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={14} color="#22d3ee" /> {lang === "TR" ? "İş ilanı metni alındı" : "Job description captured"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={14} color={jdLoaded ? "#22d3ee" : "#64748b"} /> {jdLoaded ? (lang === "TR" ? "Analiz için yeterli uzunluk" : "Enough text to analyze") : (lang === "TR" ? "Daha fazla ilan metni ekle" : "Add more JD text")}
              </div>
            </div>
          </div>
        )}

        <textarea
          className="hf-textarea hf-dropzone__textarea hf-analyzer-textarea"
          placeholder={t.pasteJd}
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          onFocus={() => setActiveInput("jd")}
          onBlur={() => setActiveInput((v) => (v === "jd" ? null : v))}
          readOnly={extractingJob}
        />
      </div>
    </motion.div>
    </motion.div>

    <motion.div
      className="hf-output-panel hf-analyzer-pipeline"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
    >
    <AiLivePipelinePanel
      lang={lang}
      loading={loading}
      hasOutput={hasOutput}
      cvReady={cvLoaded}
      jdReady={jdLoaded}
      extractingJob={extractingJob}
    />
    <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginTop: 14, display: "flex", alignItems: "center", gap: 8, lineHeight: 1.45 }}>
      <Workflow size={14} color="#a78bfa" />
      {lang === "TR" ? "Recruiter'ın 7 saniyede gördüğü ekran bu." : "This is what a recruiter sees in 7 seconds."}
    </div>
    </motion.div>

    <div className="hf-analyzer-post-grid">
    <div className={`hf-data-bridge${loading || (cvLoaded && jdLoaded) ? " hf-data-bridge--hot" : ""}`} aria-hidden>
      <div className="hf-data-bridge__line" />
      <motion.span
        className="hf-data-bridge__pulse"
        animate={{ x: ["0%", "98%"] }}
        transition={{ repeat: Infinity, duration: loading ? 1.35 : 2.3, ease: "linear" }}
      />
      {(loading || (cvLoaded && jdLoaded)) ? <span className="hf-data-bridge__pulse hf-data-bridge__pulse--trail" /> : null}
    </div>

    {/* ADVANCED OPTIONS */}
    <div style={{ marginBottom: 24 }}>
  <button
    onClick={() => setShowAdvanced(v => !v)}
    style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#475569", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, padding: 0, marginBottom: showAdvanced ? 16 : 0 }}
  >
    <span style={{ fontSize: 10, transition: "transform 0.2s", display: "inline-block", transform: showAdvanced ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
    {lang === "TR" ? "Gelişmiş seçenekler" : "Advanced options"}
  </button>
  {showAdvanced && (
    <div style={{ padding: "16px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t.detectedSectorLabel}</div>
        <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 10 }}>
          {lastDetectedSector ? <strong style={{ color: "#d4af37" }}>{getSectorDisplayLabel(lastDetectedSector, lang)}</strong> : "—"}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t.sectorOverrideHint}</div>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 360,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.35)",
            color: "#e2e8f0",
            fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {sectorValues.map((s, idx) => (
            <option key={s} value={s}>{sectorLabels[idx]}</option>
          ))}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>{lang === "TR" ? "Başvuru Süresi" : "Deadline"}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { value: "urgent", label: lang === "TR" ? "🔴 Acil" : "🔴 Urgent" },
            { value: "1_week", label: lang === "TR" ? "🟡 1 Hafta" : "🟡 1 Week" },
            { value: "1_month", label: lang === "TR" ? "🟢 1 Ay" : "🟢 1 Month" },
          ].map(({ value, label }) => (
            <button key={value} onClick={() => setDeadline(value)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: deadline === value ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)", border: `1px solid ${deadline === value ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.07)"}`, color: deadline === value ? "#a78bfa" : "#475569" }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )}
</div>  

    {/* FREE LIMIT WARNING */}
    {!isPro && (() => {
      let count;
      if (user?.id) {
        if (!userPlanRow) return null;
        count = Number(userPlanRow.analysis_count ?? 0);
      } else {
        count = Number(localStorage.getItem("hirefit-anon-count") || 0);
      }
      const remaining = Math.max(0, 2 - count);
      if (remaining >= 2) return null;
      return (
        <div style={{ marginBottom: 16, padding: "8px 14px", borderRadius: 8, background: remaining === 0 ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${remaining === 0 ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)"}`, fontSize: 13, color: remaining === 0 ? "#f87171" : "#fbbf24", fontWeight: 600 }}>
          {remaining === 0 ? t.noFreeLeft : `⚡ ${remaining} ${t.freeLimitWarning}`}
        </div>
      );
    })()}

    {/* PRIMARY CTA */}
    <div className="hf-analyzer-analyze-wrap">
    <button
      onClick={analyze}
      disabled={loading}
      style={{
        width: "100%", padding: "16px", borderRadius: 14, border: "none",
        background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #3b82f6, #6366f1)",
        color: "white", fontSize: 16, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        boxShadow: loading ? "none" : "0 0 32px rgba(99,102,241,0.35)",
        transition: "all 0.2s ease", marginBottom: 0,
        opacity: loading ? 0.8 : 1,
      }}
    >
      {loading ? <><Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />{lang === "TR" ? "CV + İlan uyumu analiz ediliyor..." : "Analyzing CV + Job Match..."} {loadingMessage ? `• ${loadingMessage}` : ""}</> : <>{t.checkFit} <Sparkles size={16} /></>}
    </button>
    </div>

    {/* ERROR */}
    {error && (
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "14px 16px",
          borderRadius: 12,
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.15)",
          color: "#fca5a5",
          fontSize: 14,
          marginBottom: 16,
          whiteSpace: "pre-line",
          lineHeight: 1.55,
        }}
      >
        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{error}</span>
      </div>
    )}

    </div>
    </div>

    <motion.div
      className="hf-output-panel hf-analyzer-results"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
    >
    {showAnonSavePrompt && !user && (
      <div
        style={{
          marginBottom: 14,
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(99,102,241,0.12)",
          border: "1px solid rgba(99,102,241,0.28)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#e0e7ff", marginBottom: 4 }}>{t.anonSaveTitle}</div>
          <div style={{ fontSize: 13, color: "#c7d2fe", lineHeight: 1.45 }}>{t.anonSaveDesc}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={() => navigate("/login")}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {t.anonSaveCta}
          </button>
          <button
            type="button"
            onClick={() => setShowAnonSavePrompt(false)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "#94a3b8",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {t.anonSaveDismiss}
          </button>
        </div>
      </div>
    )}
    <AnimatePresence mode="wait">
    {engineV2 && (
      <motion.div key="engineV2" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.28 }}>
        <CareerEngineCard
          data={engineV2}
          lang={lang}
          isPro={isPro}
          onUpgrade={openUpgrade}
          onFixCv={optimizeCv}
          optimizing={optimizing}
          cvText={cvText}
          jdText={jdText}
        />
      </motion.div>
    )}
    {!engineV2 && (decisionData || decisionLoading) && (
      <motion.div key="decision" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.28 }}>
        <DecisionCard
          data={decisionData}
          loading={decisionLoading}
          lang={lang}
          isPro={isPro}
          onApplyFix={applyFix}
          applyingFix={applyingFix}
          fixResults={fixResults}
          onUpgrade={openUpgrade}
          alignmentScore={alignmentScore}
          impactContext={decisionImpactContext}
        />
      </motion.div>
    )}
    </AnimatePresence>

    {!engineV2 && alignmentScore !== null && analysisData && (
      <>
        <DashboardResults
          data={analysisData}
          score={alignmentScore}
          matchedSkills={matchedSkills}
          missingSkills={missingSkills}
          topKeywords={topKeywords}
          result={result}
          optimizedCv={optimizedCv}
          learningPlan={learningPlan}
          downloadText={downloadText}
          lang={lang}
          navigate={navigate}
          isPro={isPro}
          onUpgrade={openUpgrade}
          roleFitLocked={!!engineV2?.RoleFit?.locked}
          useV2Engine={!!engineV2}
        />

        {/* SECONDARY ACTIONS — sadece analiz sonrası */}
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              if (!isPro) {
                openUpgrade();
                return;
              }
              optimizeCv();
            }}
            disabled={optimizing}
            style={{ flex: 1, minWidth: 160, padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(34,211,238,0.25)", background: "rgba(34,211,238,0.06)", color: "#22d3ee", fontSize: 14, fontWeight: 600, cursor: optimizing ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: optimizing ? 0.7 : 1 }}
          >
            {optimizing ? <><Loader2 size={14} />{t.optimizing}</> : (
              !isPro
                ? <><Wand2 size={14} />{lang === "TR" ? "👉 Fix My CV — Pro ile aç" : "👉 Fix My CV — unlock with Pro"}</>
                : <><Wand2 size={14} />{t.optimizeCV}</>
            )}
          </button>
          <button
            onClick={generateLearningPlan}
            disabled={roadmapLoading}
            style={{ flex: 1, minWidth: 160, padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.06)", color: "#10b981", fontSize: 14, fontWeight: 600, cursor: roadmapLoading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: roadmapLoading ? 0.7 : 1 }}
          >
            {roadmapLoading ? <><Loader2 size={14} />{t.building}</> : <><Target size={14} />{t.learningRoadmap}</>}
          </button>
          {optimizedCv ? (
            <button
              onClick={reanalyzeAfterFix}
              disabled={loading}
              style={{ flex: 1, minWidth: 220, padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(250,204,21,0.35)", background: "rgba(250,204,21,0.1)", color: "#fde68a", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}
            >
              <ArrowRight size={14} /> {lang === "TR" ? "Düzeltme sonrası tekrar analiz et" : "Re-analyze after fix"}
            </button>
          ) : null}
        </div>
        {reanalysisResult ? (
          <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(74,222,128,0.28)", background: "linear-gradient(135deg, rgba(74,222,128,0.1), rgba(56,189,248,0.08))", color: "#d1fae5" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", marginBottom: 6 }}>{lang === "TR" ? "FIX → RE-RUN SONUCU" : "FIX → RE-RUN RESULT"}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {lang === "TR"
                ? `Önce: ${reanalysisResult.before}  |  Sonra: ${reanalysisResult.after}  (${reanalysisResult.delta >= 0 ? "+" : ""}${reanalysisResult.delta})`
                : `Before: ${reanalysisResult.before}  |  After: ${reanalysisResult.after}  (${reanalysisResult.delta >= 0 ? "+" : ""}${reanalysisResult.delta})`}
            </div>
          </div>
        ) : null}
      </>
    )}
    </motion.div>

    {/* HISTORY — compact, en altta */}
    {history.length > 0 && (
      <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
            <History size={12} /> {t.previousAnalyses}
          </div>
          <button onClick={clearHistory} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontWeight: 600, fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
            <Trash2 size={10} /> {t.clear}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.slice(0, 3).map((item) => (
            <div key={item.id} onClick={() => loadHistoryItem(item)} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{item.role}</div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>{item.createdAt}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: item.score >= 80 ? "#10b981" : item.score >= 60 ? "#f59e0b" : "#f87171" }}>{item.score}</div>
            </div>
          ))}
        </div>
      </div>
    )}

  </div>
  );
}

export default HireFitLayout;
