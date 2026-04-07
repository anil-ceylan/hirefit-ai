import "./App.css";
import supabase from "./supabaseClient";
import RoadmapPage from "./RoadmapPage.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles, FileText, Briefcase, AlertCircle, Loader2,
  Upload, Copy, Wand2, Target, Search, History, Trash2,
  CheckCircle2, ArrowRight, LogIn, LogOut, Download, Mail,
  Zap, Star, TrendingUp, Crown, Linkedin, Instagram, Link2, Workflow,
  ChevronRight, Eye, Layers, ListChecks, KeyRound, LineChart,
  Cpu, FileUp,
} from "lucide-react";

import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const HF_API_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : "https://hirefit-ai-production.up.railway.app";

/** 30-day rolling window for free-tier analysis_count reset (user_plans.last_reset_at). */
const USER_PLAN_RESET_MS = 30 * 24 * 60 * 60 * 1000;

function userPlanNeedsReset(lastResetAt) {
  if (lastResetAt == null || lastResetAt === "") return false;
  const t = new Date(lastResetAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t >= USER_PLAN_RESET_MS;
}

const HF_SECTOR_VALUES = [
  "Auto-detect",
  "Tech / Startup",
  "Consulting",
  "Finance",
  "FMCG / Retail",
  "Healthcare",
  "Government",
];

const SECTOR_CHIP_THEME = {
  "Auto-detect": { dot: "#a78bfa", ring: "rgba(167,139,250,0.7)", bg: "rgba(167,139,250,0.16)" },
  "Tech / Startup": { dot: "#38bdf8", ring: "rgba(56,189,248,0.7)", bg: "rgba(56,189,248,0.14)" },
  Consulting: { dot: "#818cf8", ring: "rgba(129,140,248,0.7)", bg: "rgba(129,140,248,0.14)" },
  Finance: { dot: "#34d399", ring: "rgba(52,211,153,0.7)", bg: "rgba(52,211,153,0.14)" },
  "FMCG / Retail": { dot: "#f472b6", ring: "rgba(244,114,182,0.7)", bg: "rgba(244,114,182,0.14)" },
  Healthcare: { dot: "#2dd4bf", ring: "rgba(45,212,191,0.7)", bg: "rgba(45,212,191,0.14)" },
  Government: { dot: "#94a3b8", ring: "rgba(148,163,184,0.75)", bg: "rgba(148,163,184,0.12)" },
};

function getSectorDisplayLabel(sectorKey, lang) {
  const idx = HF_SECTOR_VALUES.indexOf(String(sectorKey || ""));
  const tr = ["Otomatik (ilan)", "Teknoloji / Startup", "Danışmanlık", "Finans", "FMCG / Perakende", "Sağlık", "Kamu"];
  const en = ["Auto (from job)", "Tech / Startup", "Consulting", "Finance", "FMCG / Retail", "Healthcare", "Government"];
  if (idx >= 0) return lang === "TR" ? tr[idx] : en[idx];
  return String(sectorKey || "");
}

const SHARE_RESULT_UI = {
  EN: { title: "Share your result", copy: "Copy text", linkedIn: "Share on LinkedIn", copied: "Copied!" },
  TR: { title: "Sonucunu paylaş", copy: "Metni kopyala", linkedIn: "LinkedIn'de paylaş", copied: "Kopyalandı!" },
};

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

  const color = tier === "high" ? "#f87171" : tier === "medium" ? "#fbbf24" : "#6ee7b7";
  const bg = tier === "high" ? "rgba(239,68,68,0.08)" : tier === "medium" ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)";
  const border = tier === "high" ? "rgba(239,68,68,0.22)" : tier === "medium" ? "rgba(245,158,11,0.22)" : "rgba(16,185,129,0.22)";

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
    return { tier, pct, title: "ELENME RİSKİ", mainLine: main, sub, color, bg, border };
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

  return { tier, pct, title: "REJECTION RISK", mainLine: main, sub, color, bg, border };
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
  const { current, projected, delta, narrative } = projection;
  return (
    <div
      style={{
        marginTop: 14,
        padding: "18px 20px",
        borderRadius: 16,
        border: "1px solid rgba(52,211,153,0.35)",
        background: "linear-gradient(135deg, rgba(16,185,129,0.14), rgba(59,130,246,0.08), rgba(212,175,55,0.06))",
        boxShadow: "0 0 32px rgba(52,211,153,0.12)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <TrendingUp size={18} color="#34d399" />
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: "#6ee7b7" }}>
          {lang === "TR" ? "ETKİ TAHMİNİ" : "IMPACT PROJECTION"}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#a7f3d0", letterSpacing: "0.06em", marginBottom: 8 }}>
        {lang === "TR" ? "ŞİMDİ → SONRA" : "NOW → AFTER"}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {lang === "TR" ? "Mevcut skor" : "Current score"}
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 34, fontWeight: 800, color: "#fca5a5" }}>{current}</div>
        </div>
        <div style={{ fontSize: 26, color: "#64748b", fontWeight: 300, padding: "0 4px" }}>→</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {lang === "TR" ? "Hedef skor" : "Projected score"}
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 34, fontWeight: 800, color: "#6ee7b7" }}>{projected}</div>
        </div>
        <div
          style={{
            padding: "10px 18px",
            borderRadius: 999,
            background: "linear-gradient(90deg, #d4af37, #f0d060)",
            color: "#0a0a0a",
            fontWeight: 900,
            fontSize: 16,
            boxShadow: "0 4px 20px rgba(212,175,55,0.35)",
          }}
        >
          +{delta}
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
        {lang === "TR" ? "Skor artışı" : "Score increase"}
      </div>
      <p style={{ margin: 0, fontSize: 14, color: "#e2e8f0", lineHeight: 1.6, fontWeight: 600 }}>{narrative}</p>
    </div>
  );
}

function getScoreFinalVerdict(score, lang) {
  const s = Number(score);
  if (Number.isNaN(s)) {
    return {
      icon: "—",
      title: lang === "TR" ? "Skor bekleniyor" : "Score pending",
      explanation:
        lang === "TR"
          ? "Analiz bitince net karar burada görünecek."
          : "Complete an analysis to see your verdict.",
      shareLabel: lang === "TR" ? "Beklemede" : "Pending",
      border: "rgba(148,163,184,0.35)",
      bg: "rgba(148,163,184,0.08)",
    };
  }
  if (s < 60) {
    return {
      icon: "❌",
      title: lang === "TR" ? "Başvurma" : "Do not apply",
      explanation:
        lang === "TR"
          ? "Kritik gereksinimleri karşılamıyorsun. Şimdi başvurursan büyük ihtimalle elenirsin — önce boşlukları kapat."
          : "You are missing critical requirements. Applying now will likely lead to rejection.",
      shareLabel: lang === "TR" ? "Başvurma" : "Do not apply",
      border: "rgba(239,68,68,0.45)",
      bg: "rgba(239,68,68,0.12)",
    };
  }
  if (s < 75) {
    return {
      icon: "⚠️",
      title: lang === "TR" ? "Riskli başvuru" : "Risky apply",
      explanation:
        lang === "TR"
          ? "İlk elemede çoğu recruiter seni saniyeler içinde eleyecek. Kanıt ve anahtar kelimeleri güçlendirmeden gönderme."
          : "You are not competitive on the first screen yet — most recruiters will bin this CV unless you fix the gaps first.",
      shareLabel: lang === "TR" ? "Riskli başvuru" : "Risky apply",
      border: "rgba(245,158,11,0.45)",
      bg: "rgba(245,158,11,0.1)",
    };
  }
  if (s < 85) {
    return {
      icon: "🟡",
      title: lang === "TR" ? "Düzeltmelerle başvur" : "Apply with fixes",
      explanation:
        lang === "TR"
          ? "Yakınsın ama henüz ikna edici değil. Birkaç net düzeltme — ölçülebilir etki ve ilan dili — sonra başvur."
          : "You are close but not sharp enough to win the pile. Fix the highest-impact gaps, then apply.",
      shareLabel: lang === "TR" ? "Düzeltmelerle başvur" : "Apply with fixes",
      border: "rgba(234,179,8,0.45)",
      bg: "rgba(234,179,8,0.1)",
    };
  }
  return {
    icon: "✅",
    title: lang === "TR" ? "Güçlü başvuru" : "Strong apply",
    explanation:
      lang === "TR"
        ? "Bu ilan için güçlü aday sinyali veriyorsun. Son bir sıkılaştırma ile gönder."
        : "Strong candidate signal for this role — tighten the CV once more and send it.",
    shareLabel: lang === "TR" ? "Güçlü başvuru" : "Strong apply",
    border: "rgba(16,185,129,0.45)",
    bg: "rgba(16,185,129,0.12)",
  };
}

function buildShareResultText({ score, verdictLabel, biggestMistake, lang }) {
  const mistake = (biggestMistake && String(biggestMistake).trim()) || (lang === "TR" ? "Belirtilmedi" : "Not specified");
  return lang === "TR"
    ? `HireFit ile CV'mi test ettim.

Skor: ${score}
Karar: ${verdictLabel}
En büyük hata: ${mistake}

Acımasızca dürüsttü.

→ Dene: hirefit.ai`
    : `I just tested my CV with HireFit.

Score: ${score}
Verdict: ${verdictLabel}
Biggest mistake: ${mistake}

This was brutally honest.

→ Try it: hirefit.ai`;
}

function buildLinkedInShareUrl(shareText) {
  const text = String(shareText || "").trim();
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

function ShareYourResult({ score, verdictLabel, biggestMistake, lang }) {
  const [copied, setCopied] = useState(false);
  const ui = SHARE_RESULT_UI[lang] || SHARE_RESULT_UI.EN;
  const text = buildShareResultText({ score, verdictLabel, biggestMistake, lang });
  const linkedInUrl = buildLinkedInShareUrl(text);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div
      style={{
        marginBottom: 20,
        padding: "18px 20px",
        borderRadius: 16,
        border: "1px solid rgba(99,102,241,0.28)",
        background: "linear-gradient(145deg, rgba(15,23,42,0.95), rgba(10,12,20,0.98))",
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: "#a78bfa", marginBottom: 10 }}>{ui.title.toUpperCase()}</div>
      <pre
        style={{
          margin: "0 0 14px",
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.06)",
          fontSize: 12,
          lineHeight: 1.55,
          color: "#cbd5e1",
          whiteSpace: "pre-wrap",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {text}
      </pre>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button
          type="button"
          onClick={copy}
          style={{
            flex: 1,
            minWidth: 140,
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(255,255,255,0.04)",
            color: "#e2e8f0",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Copy size={15} />
          {copied ? ui.copied : ui.copy}
        </button>
        <a
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            minWidth: 140,
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid rgba(10,102,194,0.35)",
            background: "rgba(10,102,194,0.12)",
            color: "#7dd3fc",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <Linkedin size={15} />
          {ui.linkedIn}
        </a>
      </div>
    </div>
  );
}

function getAgreementConfidence(ats, recruiter, fallback = 72) {
  const a = Number(ats?.ats_score ?? 50);
  const k = Number(ats?.keyword_match ?? 50);
  const f = Number(ats?.formatting_score ?? 50);
  const atsComposite = Math.round(0.45 * a + 0.35 * k + 0.2 * f);
  const rv = String(recruiter?.recruiter_verdict || "").toLowerCase();
  const recruiterScore = rv === "strong_yes" ? 85 : rv === "no" ? 42 : 63;
  const agreementGap = Math.abs(atsComposite - recruiterScore);
  const agreementBoost = Math.max(0, 16 - Math.round(agreementGap * 0.35));
  const blended = Math.round(0.55 * atsComposite + 0.45 * recruiterScore + agreementBoost);
  const safe = Number.isFinite(blended) ? blended : Number(fallback || 72);
  return Math.max(52, Math.min(96, safe));
}

function getMockJobsForRole(role, lang) {
  const r = String(role || "").toLowerCase();
  if (r.includes("product")) {
    return [
      { title: "Product Analyst", location: "Remote / EU", fit: 84 },
      { title: "Junior Product Manager", location: "Berlin Hybrid", fit: 79 },
      { title: "Growth Product Specialist", location: "Istanbul", fit: 76 },
    ];
  }
  if (r.includes("marketing")) {
    return [
      { title: "Performance Marketing Analyst", location: "Remote", fit: 83 },
      { title: "Growth Marketing Associate", location: "London Hybrid", fit: 78 },
      { title: "CRM Marketing Specialist", location: "Istanbul", fit: 75 },
    ];
  }
  if (r.includes("strategy")) {
    return [
      { title: "Strategy Analyst", location: "Remote / EU", fit: 82 },
      { title: "Business Analyst", location: "Amsterdam Hybrid", fit: 77 },
      { title: "Operations Strategy Associate", location: "Istanbul", fit: 74 },
    ];
  }
  if (r.includes("data")) {
    return [
      { title: "Data Analyst", location: "Remote", fit: 85 },
      { title: "BI Analyst", location: "Dublin Hybrid", fit: 80 },
      { title: "Analytics Specialist", location: "Istanbul", fit: 76 },
    ];
  }
  return [
    { title: lang === "TR" ? "Analist" : "Analyst", location: "Remote", fit: 78 },
    { title: lang === "TR" ? "Uzman" : "Specialist", location: "Hybrid", fit: 74 },
    { title: lang === "TR" ? "Koordinatör" : "Coordinator", location: "On-site", fit: 70 },
  ];
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
            <motion.div
              key={s.key}
              className={`hf-ai-pipeline-step${done ? " hf-ai-pipeline-step--done" : ""}${active ? " hf-ai-pipeline-step--active" : ""}${pending ? " hf-ai-pipeline-step--pending" : ""}`}
              initial={false}
              animate={active ? { scale: [1, 1.01, 1] } : {}}
              transition={{ duration: 0.6, repeat: active ? Infinity : 0 }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
            >
              <div style={{ width: 22, height: 22, display: "grid", placeItems: "center" }}>
                {done ? <CheckCircle2 size={16} color="#34d399" /> : active ? <Loader2 size={14} color="#a78bfa" style={{ animation: "spin 0.8s linear infinite" }} /> : <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(148,163,184,0.35)" }} />}
              </div>
              <div style={{ fontSize: 13, fontWeight: done || active ? 700 : 600, color: done ? "#a7f3d0" : active ? "#e9d5ff" : "#64748b" }}>{s.label}</div>
            </motion.div>
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
  const text = lang === "TR"
    ? `HireFit ile CV'mi test ettim.\n\nKarar: ${verdictLabel}\nEn büyük hata: ${biggestMistake || "Belirtilmedi"}\n\nAcımasızca dürüsttü.\n\n→ hirefit.ai`
    : `I tested my CV with HireFit.\n\nVerdict: ${verdictLabel}\nBiggest mistake: ${biggestMistake || "Not specified"}\n\nThat was brutally honest.\n\n→ hirefit.ai`;
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

function CareerEngineCard({ data, lang, isPro, onUpgrade, onFixCv, optimizing, onSharePrompt }) {
  if (!data) return null;
  const [showJobs, setShowJobs] = useState(false);
  const [openCard, setOpenCard] = useState("recruiter");
  const score = data["Final Alignment Score"];
  const fv = getScoreFinalVerdict(score, lang);
  const gaps = data.Gaps?.rejection_reasons || [];
  const roles = data.RoleFit?.role_fit || [];
  const best = data.RoleFit?.best_role;
  const locked = data.RoleFit?.locked;
  const one = (data.Decision?.what_to_fix_first || [])[0];
  const biggest =
    (data.Gaps?.biggest_gap && String(data.Gaps.biggest_gap).trim()) ||
    (gaps[0]?.issue ? String(gaps[0].issue) : "");

  const impactColor = (imp) =>
    imp === "high" ? { bg: "rgba(239,68,68,0.15)", c: "#f87171", b: "rgba(239,68,68,0.25)" } : imp === "low" ? { bg: "rgba(16,185,129,0.12)", c: "#6ee7b7", b: "rgba(16,185,129,0.25)" } : { bg: "rgba(245,158,11,0.12)", c: "#fbbf24", b: "rgba(245,158,11,0.25)" };
  const agreementConfidence = getAgreementConfidence(data.ATS, data.Recruiter, data.Decision?.confidence);
  const jobSuggestions = getMockJobsForRole(best || roles?.[0]?.role, lang);
  const oneLineSummary = String(data.Decision?.reasoning || data.Recruiter?.reasoning || "").split(/[.!?]/).find(Boolean)?.trim() || (lang === "TR" ? "Bu rol için kritik boşlukların var." : "There are critical gaps for this role.");

  return (
    <div style={{ marginBottom: 20, borderRadius: 20, overflow: "hidden", border: `1px solid ${fv.border}`, background: "linear-gradient(165deg, rgba(15,23,42,0.98), rgba(10,12,20,0.99))", boxShadow: "0 24px 64px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "22px 22px 20px", background: fv.bg, borderBottom: `1px solid ${fv.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: "#94a3b8", marginBottom: 8 }}>{lang === "TR" ? "FİNAL KARAR" : "FINAL VERDICT"}</div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: "1 1 220px" }}>
            <div style={{ fontSize: 36, marginBottom: 6, lineHeight: 1 }}>{fv.icon}</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(20px,4vw,28px)", fontWeight: 800, color: "#f8fafc", lineHeight: 1.2 }}>{fv.title}</div>
            <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.65, color: "#e2e8f0", fontWeight: 700 }}>{oneLineSummary}</p>
            {biggest ? (
              <div style={{ marginTop: 10, fontSize: 12, color: "#fca5a5", fontWeight: 700, lineHeight: 1.45 }}>
                {lang === "TR"
                  ? `Bu role özel risk: ${biggest}`
                  : `For this specific role, the biggest blocker is: ${biggest}`}
              </div>
            ) : null}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em" }}>{lang === "TR" ? "HİZALAMA SKORU" : "ALIGNMENT SCORE"}</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 44, fontWeight: 800, color: "#93c5fd" }}>{score ?? "—"}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              {(() => {
                const dc = data.Decision?.confidence;
                if (dc == null || dc === "") return lang === "TR" ? "Güven: N/A" : "Confidence: N/A";
                return lang === "TR" ? `Güven %${dc}` : `Confidence ${dc}%`;
              })()}
            </div>
            {score != null && Number.isFinite(Number(score)) ? (() => {
              const r = getRejectionRiskFromAlignmentScore(score, lang);
              return (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "right" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#64748b", marginBottom: 4 }}>{r.title}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: r.color, lineHeight: 1.35 }}>{r.mainLine}</div>
                </div>
              );
            })() : null}
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 20px 12px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(148,163,184,0.08)" }}>
            {lang === "TR" ? "Simüle recruiter paternlerine dayalı" : "Based on simulated recruiter patterns"}
          </div>
          <div style={{ fontSize: 11, color: "#7dd3fc", padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(34,211,238,0.28)", background: "rgba(34,211,238,0.1)" }}>
            {lang === "TR" ? "ATS-stili analiz" : "ATS-style analysis"}
          </div>
          <div style={{ fontSize: 11, color: "#86efac", padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(74,222,128,0.28)", background: "rgba(74,222,128,0.1)" }}>
            {lang === "TR" ? `Güven: %${agreementConfidence}` : `Confidence: ${agreementConfidence}%`}
          </div>
          {data.Context?.sector ? (
            <div className="hf-sector-lens-chip" style={{ fontSize: 11, color: "#e9d5ff", padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(233,213,255,0.35)", background: "rgba(139,92,246,0.12)" }}>
              {lang === "TR" ? "Sektör analizi: " : "Sector lens: "}
              <span style={{ fontWeight: 800 }}>{getSectorDisplayLabel(data.Context.sector, lang)}</span>
            </div>
          ) : null}
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", fontWeight: 700, marginBottom: 10 }}>
          {lang === "TR" ? "Daha fazla içgörü göster" : "Show more insights"}
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 12 }} />
        <div style={{ display: "grid", gap: 10 }}>
          <ExpandableInsightCard id="recruiter" title={lang === "TR" ? "Recruiter Görüşü" : "Recruiter View"} subtitle={lang === "TR" ? "Gerçekte ne düşündükleri" : "What they actually think"} icon={<Eye size={14} />} openId={openCard} onToggle={setOpenCard}>
            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{data.Recruiter?.reasoning || (lang === "TR" ? "Recruiter görüşü yok." : "No recruiter narrative.")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>{lang === "TR" ? "Güçlü sinyaller" : "Strong signals"}</div>
                {(data.Recruiter?.strengths || []).slice(0, 4).map((s, i) => <div key={i} style={{ fontSize: 12, color: "#a7f3d0", marginBottom: 4 }}>+ {s}</div>)}
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>{lang === "TR" ? "Zayıf sinyaller" : "Weak signals"}</div>
                {(data.Recruiter?.weaknesses || []).slice(0, 4).map((s, i) => <div key={i} style={{ fontSize: 12, color: "#fca5a5", marginBottom: 4 }}>- {s}</div>)}
              </div>
            </div>
          </ExpandableInsightCard>

          <ExpandableInsightCard id="deep" title={lang === "TR" ? "Derin Analiz" : "Deep Analysis"} subtitle={lang === "TR" ? "Neden eleniyorsun" : "Why you fail"} icon={<Layers size={14} />} openId={openCard} onToggle={setOpenCard}>
            {data.Decision?.reasoning ? (
              <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 6 }}>{lang === "TR" ? "KARAR GEREKÇESİ" : "DECISION REASONING"}</div>
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.65 }}>{data.Decision.reasoning}</div>
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {gaps.length === 0 ? (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{lang === "TR" ? "Gap verisi yok." : "No gap data."}</div>
              ) : gaps.map((g, i) => {
                const ic = impactColor(g.impact);
                return (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 700, flex: 1 }}>{g.issue}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: ic.bg, color: ic.c, border: `1px solid ${ic.b}` }}>{g.impact}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{g.explanation}</div>
                  </div>
                );
              })}
            </div>
          </ExpandableInsightCard>

          <ExpandableInsightCard id="plan" title={lang === "TR" ? "Aksiyon Planı" : "Action Plan"} subtitle={lang === "TR" ? "Sonraki adım" : "What to do next"} icon={<ListChecks size={14} />} openId={openCard} onToggle={setOpenCard}>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(129,140,248,0.25)" }}>
              <div style={{ fontSize: 15, color: "#f1f5f9", fontWeight: 800, lineHeight: 1.45 }}>
                {one || (lang === "TR" ? "Önce bu ilan için tek bir kritik boşluğu kapat." : "Close one critical gap for this job first.")}
              </div>
            </div>
            <ImpactProjectionPanel
              projection={computeImpactProjection(score, {
                gaps,
                missingKeywords: data.ATS?.missing_keywords || [],
                missingSkills: data.ATS?.missing_keywords || [],
                improvements: data.Decision?.what_to_fix_first || [],
                rejectionHigh: (gaps || []).filter((g) => String(g.impact || "").toLowerCase() === "high").map((g) => g.issue),
                rejectionMedium: (gaps || []).filter((g) => String(g.impact || "").toLowerCase() === "medium").map((g) => g.issue),
              }, lang)}
              lang={lang}
            />
          </ExpandableInsightCard>

          <ExpandableInsightCard id="skills" title={lang === "TR" ? "Beceriler & Anahtar Kelimeler" : "Skills & Keywords"} subtitle={lang === "TR" ? "Eksik sinyaller" : "Missing signals"} icon={<KeyRound size={14} />} openId={openCard} onToggle={setOpenCard}>
            {(data.ATS?.missing_keywords || []).length > 0 ? (
              <CriticalSkillsGapBlock skills={data.ATS?.missing_keywords} lang={lang} />
            ) : (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{lang === "TR" ? "Eksik anahtar kelime bulunamadı." : "No missing keywords found."}</div>
            )}
            {(data.ATS?.parsing_issues || []).length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>{lang === "TR" ? "Parsing sorunları" : "Parsing issues"}</div>
                {data.ATS.parsing_issues.map((p, i) => <div key={i} style={{ fontSize: 12, color: "#fbbf24", marginBottom: 4 }}>• {p}</div>)}
              </div>
            ) : null}
          </ExpandableInsightCard>

          <ExpandableInsightCard id="market" title={lang === "TR" ? "Pazar İçgörüleri" : "Market Insights"} subtitle={lang === "TR" ? "Kariyer yönü ve fırsatlar" : "Career lanes and opportunities"} icon={<LineChart size={14} />} openId={openCard} onToggle={setOpenCard}>
            {locked ? (
              <div style={{ position: "relative", padding: 16, borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>🔒 {lang === "TR" ? "Rol matrisi Pro'da" : "Role fit matrix on Pro"}</div>
                <button type="button" onClick={onUpgrade} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg,#d4af37,#f0d060)", border: "none", color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}><Crown size={14} /> Pro</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {roles.map((r, i) => {
                  const isBest = best && r.role === best;
                  return (
                    <motion.div key={i} className={`hf-role-tag ${isBest ? "hf-role-tag--best" : ""}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.28 }} whileHover={{ y: -3, scale: 1.01 }} style={{ padding: "12px 14px", borderRadius: 12, background: isBest ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${isBest ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.06)"}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isBest ? "#6ee7b7" : "#94a3b8", marginBottom: 6 }}>{r.role}{isBest ? " ★" : ""}</div>
                      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, r.score)}%` }} transition={{ delay: 0.15 + i * 0.06, duration: 0.55, ease: "easeOut" }} style={{ height: "100%", background: isBest ? "linear-gradient(90deg,#34d399,#22d3ee)" : "linear-gradient(90deg,#6366f1,#3b82f6)", borderRadius: 999 }} />
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#e2e8f0", marginTop: 6, fontFamily: "'Syne',sans-serif" }}>{r.score}</div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => onSharePrompt?.()} style={{ flex: 1, minWidth: 150, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(99,102,241,0.28)", background: "rgba(99,102,241,0.12)", color: "#c4b5fd", fontWeight: 700, cursor: "pointer" }}>
                {lang === "TR" ? "Sonucu paylaş" : "Share this result"}
              </button>
              <button type="button" onClick={() => setShowJobs((v) => !v)} style={{ flex: 1, minWidth: 150, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(16,185,129,0.28)", background: "rgba(16,185,129,0.12)", color: "#6ee7b7", fontWeight: 700, cursor: "pointer" }}>
                {lang === "TR" ? "Gerçek işlere başvur" : "Apply to Real Jobs"}
              </button>
            </div>
            {showJobs ? (
              <div style={{ marginTop: 10, padding: "12px 12px", borderRadius: 10, border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.08)" }}>
                <div style={{ fontSize: 12, color: "#a7f3d0", fontWeight: 700, marginBottom: 8 }}>{lang === "TR" ? "Bu boşlukları kapatırsan başvuruya hazırsın." : "You are ready to apply after fixing these gaps."}</div>
                <div style={{ display: "grid", gap: 7 }}>
                  {jobSuggestions.map((j, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "9px 10px", background: "rgba(15,23,42,0.5)" }}>
                      <div><div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 700 }}>{j.title}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{j.location}</div></div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#6ee7b7" }}>{j.fit}%</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </ExpandableInsightCard>
        </div>
        {!isPro && data.tier === "free" ? (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)", fontSize: 12, color: "#fcd34d" }}>
            {lang === "TR" ? "Pro: tüm red nedenleri, rol matrisi ve tam gerekçe." : "Pro: full rejection breakdown, role-fit matrix, and full reasoning."}{" "}
            <button type="button" onClick={onUpgrade} style={{ marginLeft: 8, background: "linear-gradient(135deg,#d4af37,#f0d060)", border: "none", borderRadius: 6, padding: "4px 10px", fontWeight: 700, fontSize: 11, cursor: "pointer", color: "#000" }}>Pro</button>
          </div>
        ) : null}
      </div>

      <div style={{ padding: "0 20px 22px" }}>
        <button
          type="button"
          onClick={() => {
            if (!isPro) {
              onUpgrade();
              return;
            }
            onFixCv();
          }}
          disabled={optimizing && isPro}
          style={{
            width: "100%",
            padding: "14px 20px",
            borderRadius: 12,
            border: "1px solid rgba(34,211,238,0.35)",
            background: "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(59,130,246,0.12))",
            color: "#22d3ee",
            fontSize: 15,
            fontWeight: 800,
            cursor: optimizing && isPro ? "wait" : "pointer",
            fontFamily: "'DM Sans',sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            opacity: optimizing && isPro ? 0.75 : 1,
          }}
        >
          {optimizing && isPro ? <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : <Wand2 size={18} />}
          {!isPro
            ? lang === "TR"
              ? "👉 Fix My CV — Pro ile aç"
              : "👉 Fix My CV — unlock with Pro"
            : lang === "TR"
              ? "👉 Fix My CV"
              : "👉 Fix My CV"}
        </button>
      </div>
    </div>
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
    optimizeCV: "👉 Fix My CV",
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
    applyFix: "Apply Fix",
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
    interviewEmpty: "No interview prompts in this report.",
    confidenceNA: "N/A",
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
    optimizeCV: "👉 CV'mi düzelt",
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
    applyFix: "Düzeltmeyi Uygula",
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
    interviewEmpty: "Bu raporda mülakat sorusu yok.",
    confidenceNA: "Yok",
  },
};

const T = {
  bg: "#060910",
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
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; font-family: 'DM Sans', sans-serif; color: ${T.text}; -webkit-font-smoothing: antialiased; }
  .hf-btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: ${T.blue}; border: none; border-radius: 10px; cursor: pointer; color: white; font-weight: 600; font-size: 15px; font-family: 'DM Sans', sans-serif; transition: all 0.2s ease; }
  .hf-btn-primary:hover { background: #2563eb; box-shadow: 0 0 30px ${T.blueGlow}; transform: translateY(-1px); }
  .hf-btn-ghost { display: inline-flex; align-items: center; gap: 8px; padding: 11px 20px; background: transparent; border: 1px solid ${T.border}; border-radius: 10px; cursor: pointer; color: ${T.textSub}; font-weight: 500; font-size: 14px; font-family: 'DM Sans', sans-serif; transition: all 0.2s ease; }
  .hf-btn-ghost:hover { border-color: rgba(255,255,255,0.2); color: white; background: rgba(255,255,255,0.04); }
  .hf-card { background: ${T.bgCard}; border: 1px solid ${T.border}; border-radius: 16px; transition: all 0.25s ease; }
  .hf-card:hover { background: ${T.bgCardHover}; border-color: rgba(255,255,255,0.12); }
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
  page: { minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif" },
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
  const [shareCopied, setShareCopied] = useState(false);

  if (loading) return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #3b82f6", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: "#475569" }}>{lang === "TR" ? "Karar analizi yapılıyor..." : "Analyzing your decision..."}</span>
    </div>
  );
  if (!data) return null;

  const isHigh = data.decision?.includes("High") || data.decision?.includes("Yüksek");
  const isMed = data.decision?.includes("Medium") || data.decision?.includes("Orta");
  const decisionColor = isHigh ? "#10b981" : isMed ? "#f59e0b" : "#f87171";
  const decisionBg = isHigh ? "rgba(16,185,129,0.08)" : isMed ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)";
  const decisionBorder = isHigh ? "rgba(16,185,129,0.2)" : isMed ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)";

  const riskScore = alignmentScore ?? data.fitScore;

  const scoreFv = alignmentScore != null ? getScoreFinalVerdict(alignmentScore, lang) : null;
  const impactProj =
    alignmentScore != null && impactContext ? computeImpactProjection(alignmentScore, impactContext, lang) : null;

  return (
    <div style={{ background: "#0a0a0a", border: `1px solid ${decisionBorder}`, borderRadius: 20, padding: 24, marginBottom: 16, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${decisionColor}, transparent)` }} />
      {scoreFv && (
        <div style={{ marginBottom: 20, padding: "18px 20px", borderRadius: 14, background: scoreFv.bg, border: `1px solid ${scoreFv.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#94a3b8", marginBottom: 8 }}>{lang === "TR" ? "FİNAL KARAR" : "FINAL VERDICT"}</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 14, justifyContent: "space-between" }}>
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 8 }}>{scoreFv.icon}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>{scoreFv.title}</div>
              <p style={{ margin: "10px 0 0", fontSize: 14, color: "#e2e8f0", lineHeight: 1.55, fontWeight: 600 }}>{scoreFv.explanation}</p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em" }}>{lang === "TR" ? "SKOR" : "SCORE"}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: "#93c5fd" }}>{alignmentScore}</div>
            </div>
          </div>
          <ImpactProjectionPanel projection={impactProj} lang={lang} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(148,163,184,0.08)" }}>
              {lang === "TR" ? "Simüle recruiter paternlerine dayalı" : "Based on simulated recruiter patterns"}
            </div>
            <div style={{ fontSize: 11, color: "#7dd3fc", padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(34,211,238,0.28)", background: "rgba(34,211,238,0.1)" }}>
              {lang === "TR" ? "ATS-stili analiz" : "ATS-style analysis"}
            </div>
          </div>
        </div>
      )}
      {/* 🧠 GUT FEELING */}
{data.gutFeeling && (
  <div style={{
    marginBottom: 16,
    padding: "14px 16px",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 12,
    textAlign: "center"
  }}>
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      color: "#f87171",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      marginBottom: 6
    }}>
      🧠 {lang === "TR" ? "Recruiter ilk tepkisi" : "Recruiter First Reaction"}
    </div>

    <div style={{
      fontSize: 16,
      fontWeight: 700,
      color: "#fca5a5"
    }}>
      "{data.gutFeeling}"
    </div>
  </div>
)}

{riskScore != null && <RejectionRiskPanel score={riskScore} lang={lang} />}

      {/* 1. DECISION */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ padding: "12px 20px", borderRadius: 12, background: decisionBg, border: `1px solid ${decisionBorder}`, flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: decisionColor, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>
            {lang === "TR" ? "Karar" : "Decision"}
          </div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: decisionColor }}>{data.decision}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {data.confidence !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${data.confidence}%`, height: "100%", background: `linear-gradient(90deg, ${decisionColor}, transparent)`, borderRadius: 999, transition: "width 0.8s ease" }} />
              </div>
              <span style={{ fontSize: 11, color: "#475569", fontWeight: 700, flexShrink: 0 }}>{data.confidence}%</span>
            </div>
          )}
          <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: "0.04em" }}>
            {lang === "TR" ? "Güven Skoru" : "Confidence"}
          </div>
        </div>
        {data.fitScore !== undefined && !impactProj && (
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
              {lang === "TR" ? "Şu an → Sonra" : "Now → After"}
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#f87171" }}>{data.fitScore}</div>
            <div style={{ fontSize: 14, color: "#334155", margin: "1px 0" }}>→</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: isPro ? "#10b981" : "#334155" }}>
              {isPro ? data.improvedScore : <span style={{ fontSize: 14 }}>🔒 Pro</span>}
            </div>
          </div>
        )}
      </div>

      {/* 2. SUMMARY */}
      {data.summary && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
            {lang === "TR" ? "Özet" : "Summary"}
          </div>
          <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6, fontWeight: 500 }}>{data.summary}</div>
        </div>
      )}

      {/* 3. BIGGEST MISTAKE */}
      {data.biggestMistake && (
        <div style={{ marginBottom: 16, padding: "14px 18px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#f87171", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            {lang === "TR" ? "ELENMENİN ANA NEDENİ" : "THE MAIN REASON YOU GET REJECTED"}
          </div>
          <div style={{ fontSize: 12, color: "#fca5a5", fontWeight: 600, marginBottom: 8, lineHeight: 1.5 }}>
            {lang === "TR"
              ? "Bunu düzeltmeden diğer her şey yarım kalır."
              : "This is the main reason you're being rejected."}
          </div>
          <div style={{ fontSize: 15, color: "#fef2f2", fontWeight: 700, lineHeight: 1.45 }}>{data.biggestMistake}</div>
        </div>
      )}

      {/* 5. TOP FIXES */}
      {(data.topFixes || data.top_fixes || []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#d4af37", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            ⚡ {lang === "TR" ? "Öncelikli düzeltmeler" : "Top fixes"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(data.topFixes || data.top_fixes || []).slice(0, 3).map((fix, i) => {
              const isLocked = !isPro && i > 0;
              const isApplying = applyingFix === i;
              const fixResult = fixResults?.[i];
              const problem = fix.problem;
              const fixText = fix.fix;
              const impact = fix.impact;

              return (
                <div key={i} style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, filter: isLocked ? "blur(3px)" : "none", userSelect: isLocked ? "none" : "auto" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, color: "rgba(212,175,55,0.5)", flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "#f87171", fontWeight: 600, marginBottom: 3 }}>⚠ {problem}</div>
                        <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600, marginBottom: fixResult ? 10 : 0 }}>→ {fixText}</div>
                        {fixResult && !isLocked && (
                          <div style={{ marginTop: 10, animation: "fadeIn 0.3s ease" }}>
                            <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, padding: "10px 12px" }}>
                              {fixResult.original_section && (
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 10, color: "#f87171", fontWeight: 700, marginBottom: 3 }}>{lang === "TR" ? "Önce:" : "Before:"}</div>
                                  <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", lineHeight: 1.5 }}>{fixResult.original_section}</div>
                                </div>
                              )}
                              {fixResult.rewritten_section && (
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 10, color: "#10b981", fontWeight: 700, marginBottom: 3 }}>{lang === "TR" ? "Sonra:" : "After:"}</div>
                                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{fixResult.rewritten_section}</div>
                                </div>
                              )}
                              {fixResult.explanation && (
                                <div style={{ fontSize: 11, color: "#a78bfa", fontStyle: "italic" }}>💡 {fixResult.explanation}</div>
                              )}
                            </div>
                            <button onClick={() => navigator.clipboard.writeText(fixResult.rewritten_section || "")} style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", fontSize: "11px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                              <Copy size={10} /> {t.copyFix}
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: impact === "High" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", color: impact === "High" ? "#f87171" : "#fbbf24", border: `1px solid ${impact === "High" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}` }}>
                          {impact}
                        </span>
                        {!isLocked && (
                          <button onClick={() => onApplyFix(fix, i)} disabled={isApplying || !!fixResult} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: fixResult ? "rgba(16,185,129,0.1)" : "rgba(99,102,241,0.15)", border: `1px solid ${fixResult ? "rgba(16,185,129,0.25)" : "rgba(99,102,241,0.3)"}`, color: fixResult ? "#10b981" : "#a78bfa", fontSize: "11px", fontWeight: 700, cursor: fixResult ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", opacity: isApplying ? 0.7 : 1 }}>
                            {isApplying ? <><div style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid #a78bfa", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />{t.applying}</> : fixResult ? t.fixApplied : <><Wand2 size={10} />{t.applyFix}</>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {isLocked && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(6,9,16,0.6)", borderRadius: 12 }}>
                      <button onClick={onUpgrade} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #d4af37, #f0d060)", border: "none", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                        <Crown size={12} /> {t.upgradeToSee}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. RECRUITER INSIGHT — Pro only */}
      {data.recruiterInsight && data.recruiterInsight.length > 0 && (
        <div style={{ marginBottom: 16, position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#d4af37", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            {lang === "TR" ? "İşe alım görüşü" : "Recruiter view"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, filter: isPro ? "none" : "blur(4px)", userSelect: isPro ? "auto" : "none" }}>
            {data.recruiterInsight.map((insight, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.1)", borderRadius: 8, fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
                💬 {insight}
              </div>
            ))}
          </div>
          {!isPro && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <button onClick={onUpgrade} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #d4af37, #f0d060)", border: "none", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                <Crown size={12} /> {lang === "TR" ? "Pro ile Gör" : "Unlock with Pro"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 7. ONE ACTION */}
      {data.oneAction && (
        <div style={{ marginBottom: 16, padding: "14px 16px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
            🎯 {lang === "TR" ? "Tek aksiyon — önce bu" : "One action — do this first"}
          </div>
          <div style={{ fontSize: 16, color: "#e2e8f0", fontWeight: 800, lineHeight: 1.45 }}>{data.oneAction}</div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#fbbf24", fontWeight: 600, lineHeight: 1.5 }}>
            {lang === "TR"
              ? "Bunu düzeltmeden yaptığın her başvuru, şansını düşürür."
              : "Every application without fixing this lowers your chances."}
          </div>
        </div>
      )}

      {/* 8. DEADLINE PLAN — Pro only */}
      {data.deadlinePlan?.steps?.length > 0 && (
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#d4af37", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            ⏰ {lang === "TR" ? "Aksiyon Planı" : "Action Plan"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", filter: isPro ? "none" : "blur(4px)", userSelect: isPro ? "auto" : "none" }}>
            {data.deadlinePlan.steps.map((step, i) => (
              <div key={i} style={{ flex: "1 1 160px", padding: "10px 14px", background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", marginBottom: 4, letterSpacing: "0.08em" }}>{step.day}</div>
                <div style={{ fontSize: 12, color: "#8a8a8a", lineHeight: 1.5 }}>{step.action}</div>
              </div>
            ))}
          </div>
          {!isPro && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <button onClick={onUpgrade} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #d4af37, #f0d060)", border: "none", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                <Crown size={12} /> {lang === "TR" ? "Pro ile Aç" : "Unlock with Pro"}
              </button>
            </div>
          )}
        </div>
      )}



      <p style={{ margin: "8px 0 16px", fontSize: 12, color: "#64748b", lineHeight: 1.55, textAlign: "center", fontStyle: "italic" }}>
        {lang === "TR"
          ? "Çoğu araç sana bir puan verir. HireFit, neden elendiğini söyler."
          : "Most tools give you a score. HireFit tells you why you're getting rejected."}
      </p>

      {/* 📤 SHARE — viral format */}
      {(() => {
        const shareScore = alignmentScore ?? data.fitScore ?? "—";
        const shareV = getScoreFinalVerdict(Number(shareScore), lang).shareLabel;
        const shareMistake = data.biggestMistake || (lang === "TR" ? "Belirtilmedi" : "Not specified");
        const shareText = buildShareResultText({
          score: shareScore,
          verdictLabel: shareV,
          biggestMistake: shareMistake,
          lang,
        });
        const shareUi = SHARE_RESULT_UI[lang] || SHARE_RESULT_UI.EN;
        const liUrl = buildLinkedInShareUrl(shareText);
        return (
          <div
            style={{
              marginTop: 8,
              padding: "16px 18px",
              borderRadius: 14,
              background: "linear-gradient(145deg, rgba(15,23,42,0.6), rgba(5,5,5,0.95))",
              border: "1px solid rgba(99,102,241,0.25)",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#a78bfa", marginBottom: 10 }}>{shareUi.title.toUpperCase()}</div>
            <pre
              style={{
                margin: "0 0 12px",
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.45)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 12,
                lineHeight: 1.55,
                color: "#cbd5e1",
                whiteSpace: "pre-wrap",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {shareText}
            </pre>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareText);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2200);
                  } catch {
                    setShareCopied(false);
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 130,
                  padding: "9px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#e2e8f0",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Copy size={14} />
                {shareCopied ? shareUi.copied : shareUi.copy}
              </button>
              <a
                href={liUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  minWidth: 130,
                  padding: "9px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(10,102,194,0.35)",
                  background: "rgba(10,102,194,0.12)",
                  color: "#7dd3fc",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  textDecoration: "none",
                }}
              >
                <Linkedin size={14} />
                {shareUi.linkedIn}
              </a>
            </div>
          </div>
        );
      })()}

    </div>
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
  const showInterviewProLock = !!useV2Engine && !isPro;

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
            {confidencePct != null ? (
              <>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 38, color: "#d4af37", lineHeight: 1 }}>{confidencePct}%</div>
                <div style={{ width: 110, height: 3, background: "#1c1c1c", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, confidencePct))}%`, borderRadius: 999, background: "linear-gradient(90deg, #d4af37, #f0d060)" }} />
                </div>
              </>
            ) : (
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: "#6a6a6a", lineHeight: 1 }}>{t.confidenceNA}</div>
            )}
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
            { label: statLabels[0], val: data.score_breakdown?.skills_match ?? score, color: "#60a5fa", ctx: data.score_breakdown?.skills_explanation || `${(data.matched_skills || []).length} of ${(data.matched_skills || []).length + (data.missing_skills || []).length} matched` },
            { label: statLabels[1], val: data.score_breakdown?.keyword_match ?? 100, color: "#10b981", ctx: `${(data.top_keywords || []).length} ${lang === "TR" ? "anahtar kelime" : "keywords detected"}` },
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
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 15, color: "#8a8a8a", lineHeight: 1.7, fontStyle: "italic" }}>"{data.recruiter_simulation?.internal_monologue || data.fit_summary || "Analysis complete."}"</div>
              <div style={{ fontSize: 11, color: "#d4af37", fontWeight: 700, marginTop: 8, letterSpacing: "0.04em" }}>— {data.recruiter_simulation?.sector || "Industry"} {lang === "TR" ? "İşe Alım Uzmanı" : "Recruiter"} · {data.seniority || "Junior"} {lang === "TR" ? "seviye işe alım" : "level hiring"}</div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 6, background: data.recruiter_simulation?.would_interview ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${data.recruiter_simulation?.would_interview ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`, color: data.recruiter_simulation?.would_interview ? "#10b981" : "#f87171", fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: data.recruiter_simulation?.would_interview ? "#10b981" : "#f87171", display: "inline-block", flexShrink: 0 }} />
              {data.recruiter_simulation?.decision || (data.recruiter_simulation?.would_interview ? (lang === "TR" ? "Listeye alır" : "Would shortlist") : (lang === "TR" ? "İlerlemez" : "Would not proceed"))}
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
              { name: lang === "TR" ? "Beceri eşleşmesi" : "Skills match", candidate_level: matchedSkills.length > 2 ? "Good" : "Basic", ideal_level: "Advanced" },
              { name: lang === "TR" ? "Etki kanıtı" : "Impact proof", candidate_level: "Missing", ideal_level: "Quantified" },
            ]).slice(0, 4).map((dim, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: i < 3 ? "1px solid #1c1c1c" : "none" }}>
                <span style={{ fontSize: 12, color: "#7a7a7a", width: 100, flexShrink: 0, fontWeight: 500 }}>{dim.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: ["Strong ✓","Good"].includes(dim.candidate_level) ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: ["Strong ✓","Good"].includes(dim.candidate_level) ? "#10b981" : "#f87171", border: `1px solid ${["Strong ✓","Good"].includes(dim.candidate_level) ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}` }}>{dim.candidate_level}</span>
                <span style={{ fontSize: 10, color: "#5a5a5a", fontWeight: 700 }}>vs</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.15)" }}>{dim.ideal_level}</span>
              </div>
            ))}
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
              <div style={{ fontSize: 13, color: "#6a6a6a", lineHeight: 1.5 }}>{isPro ? t.rolesEmptyPro : t.rolesEmptyGeneric}</div>
            )}
          </div>
        </div>

        <div style={DB.sectionHeader}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#d4af37", fontStyle: "italic" }}>03</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d4af37", textTransform: "uppercase", letterSpacing: "0.14em" }}>{lang === "TR" ? "Aksiyon Planı" : "Action Plan"}</div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.2), transparent)" }} />
        </div>
        <div style={DB.grid2}>
          <div style={DB.card}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "16px 16px 0 0", background: "linear-gradient(90deg, #d4af37, #7c3aed)" }} />
            <div style={DB.cardTag}>{lang === "TR" ? "Mülakat Hazırlığı" : "Interview Prep"}</div>
            {showInterviewProLock ? (
              proLockBox(t.proFeatureInterview)
            ) : interviewRows.length ? (
              interviewRows.slice(0, 2).map((q, i) => (
                <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i === 0 ? "1px solid #1c1c1c" : "none" }}>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 15, color: "#e8e8e8", lineHeight: 1.5, marginBottom: 5, fontStyle: "italic" }}>&quot;{q.question}&quot;</div>
                  <div style={{ fontSize: 11, color: "#7a7a7a", marginBottom: 4, fontWeight: 500 }}>{q.why_asked}</div>
                  <div style={{ fontSize: 12, color: "#d4af37", fontWeight: 700 }}>{q.personal_angle}</div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 13, color: "#6a6a6a", lineHeight: 1.5 }}>{t.interviewEmpty}</div>
            )}
          </div>
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
                {skills.length ? skills.map((s) => <span key={s} style={{ padding: "4px 10px", borderRadius: 999, background: bg, border: `1px solid ${border}`, color, fontSize: 11, fontWeight: 600 }}>{s}</span>) : <span style={{ color: "#5a5a5a", fontSize: 12 }}>{lang === "TR" ? "Tespit edilemedi" : "None detected"}</span>}
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

function NavBar({ view, user, logout, navigate, lang, setLang }) {
  const t = translations[lang];
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
    const idx = view === "landing" ? 0 : view === "roadmap" ? 1 : view === "dashboard" ? 2 : -1;
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
  }, [view, lang]);

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
    `;
    document.head.appendChild(el);
  }, []);

  return (
    <nav className="hf-nav-root" style={{ position: "sticky", top: 0, zIndex: 100, background: scrolled ? "rgba(6,9,16,0.94)" : "rgba(6,9,16,0.65)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent", transition: "all 0.4s ease" }}>
      <div style={{ ...styles.container, display: "flex", alignItems: "center", justifyContent: "space-between", height: "80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => navigate("/")}>
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
          style={{
            position: "relative",
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
            const isActive = view === viewKey;
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setLang(lang === "EN" ? "TR" : "EN")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 10, border: `1px solid ${lang === "TR" ? "rgba(220,38,38,0.3)" : "rgba(59,130,246,0.3)"}`, background: lang === "TR" ? "rgba(220,38,38,0.08)" : "rgba(59,130,246,0.08)", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.3s ease" }}
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
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: lang === "EN" ? "#f87171" : "#93c5fd" }}>
              {lang === "EN" ? "Türkçe" : "English"}
            </span>
          </button>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "grid", placeItems: "center", fontSize: "14px", fontWeight: 800, color: "white", boxShadow: "0 0 16px rgba(99,102,241,0.5)", fontFamily: "'Syne', sans-serif" }}>
                {user.email?.[0]?.toUpperCase()}
              </div>
              <button className="hf-btn-ghost" onClick={logout} style={{ padding: "9px 18px", fontSize: "13px" }}><LogOut size={13} /> {t.signOut}</button>
            </div>
          ) : (
            <button className="hf-btn-primary" onClick={() => navigate("/login")} style={{ padding: "11px 24px", fontSize: "14px", background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 0 24px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)", borderRadius: 12 }}>
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
const [score, setScore] = useState(0);
const [animating, setAnimating] = useState(false);
const [showResult, setShowResult] = useState(false);
const [demoStep, setDemoStep] = useState(0);
const t = translations[lang];
const demoSteps = lang === "TR"
  ? ["CV yükleniyor...", "Recruiter gibi analiz ediliyor...", "Karar veriliyor...", "Sonuç hazır."]
  : ["Loading CV...", "Analyzing like a recruiter...", "Reaching a verdict...", "Decision ready."];

  useEffect(() => {
    if (!document.getElementById("hero-styles")) {
      const el = document.createElement("style");
      el.id = "hero-styles";
      el.textContent = `
        @keyframes heroFadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes floatY { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-8px);} }
        @keyframes shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
        @keyframes orb1 { 0%,100%{transform:translate(0,0);} 33%{transform:translate(40px,-30px);} 66%{transform:translate(-20px,20px);} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0);} 33%{transform:translate(-30px,40px);} 66%{transform:translate(30px,-20px);} }
        @keyframes resultReveal { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
        .hero-fade { animation: heroFadeUp 0.6s ease both; }
        .shimmer-text { background: linear-gradient(90deg, #f87171 0%, #fb923c 25%, #f87171 50%, #fb923c 75%, #f87171 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 3s linear infinite; }
        .shimmer-blue { background: linear-gradient(90deg, #60a5fa 0%, #a78bfa 25%, #f472b6 50%, #a78bfa 75%, #60a5fa 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 4s linear infinite; }
      `;
      document.head.appendChild(el);
    }
  }, []);

  {/* REJECTED MOMENT */}
<div style={{
  textAlign: "center",
  padding: "20px 0 12px",
  animation: "rejectedPop 0.4s cubic-bezier(0.34,1.56,0.64,1)"
}}>
  <div style={{
    fontFamily: "'Syne', sans-serif",
    fontSize: 42,
    fontWeight: 900,
    color: "#f87171",
    letterSpacing: "-0.02em",
    textShadow: "0 0 40px rgba(239,68,68,0.6)",
    marginBottom: 4,
  }}>❌ {lang === "TR" ? "REDDEDİLDİ" : "REJECTED"}</div>
  <div style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>
    {lang === "TR" ? "Bu CV ilk elemeyi geçemez." : "This CV would not pass first screening."}
  </div>
</div>



  const handleDemo = () => {
  setAnimating(true);
  setShowResult(false);
  setDemoStep(0);
  setScore(0);

  let step = 0;
  const stepInterval = setInterval(() => {
    step++;
    setDemoStep(step);
    if (step >= demoSteps.length - 1) {
      clearInterval(stepInterval);
      let i = 0;
      const scoreInterval = setInterval(() => {
        i += 2;
        setScore(Math.min(i, 34));
        if (i >= 34) {
          clearInterval(scoreInterval);
          setAnimating(false);
          setShowResult(true);
        }
      }, 30);
    }
  }, 700);
};

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
    <section style={{ position: "relative", padding: "80px 0 60px", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-150px", left: "-100px", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(239,68,68,0.06), transparent 65%)", animation: "orb1 12s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-100px", right: "-100px", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.08), transparent 65%)", animation: "orb2 15s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />

      <div style={{ ...styles.container, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center", position: "relative", zIndex: 2 }}>

        {/* LEFT */}
        <div>
          <div className="hero-fade" style={{ animationDelay: "0.1s", display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "11px", fontWeight: 700, color: "#f87171", marginBottom: 24, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f87171", display: "inline-block", animation: "pulse 2s infinite" }} />
            {lang === "TR" ? "Kariyer Karar Motoru" : "Career Decision Engine"}
          </div>

          <div style={{
            color: "#3b82f6",
            marginBottom: 10,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase"
          }}>
            {t.slogan}
          </div>

          <h1 className="hero-fade" style={{ animationDelay: "0.2s", fontFamily: "'Syne', sans-serif", fontSize: "clamp(36px, 4.5vw, 62px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 20 }}>
            {lang === "TR" ? (
              <>CV'n neden reddediliyor?<br /><span className="shimmer-text">Artık bileceksin.</span></>
            ) : (
              <>Stop guessing why<br />your CV gets<br /><span className="shimmer-text">rejected.</span></>
            )}
          </h1>

          <p className="hero-fade" style={{ animationDelay: "0.3s", fontSize: "17px", lineHeight: 1.75, color: "#64748b", maxWidth: "440px", marginBottom: 16 }}>
            {lang === "TR"
              ? "CV'ni bir recruiter gibi analiz ediyoruz ve gerçeği söylüyoruz — başvurmadan önce."
              : "We analyze your CV like a recruiter and tell you the truth — before you waste your time applying."}
          </p>

          <div className="hero-fade" style={{ animationDelay: "0.28s", marginBottom: 16 }}>
  <span style={{ fontSize: 14, color: "#64748b", fontStyle: "italic" }}>
    {lang === "TR"
      ? "Fark etmeden reddediliyor olabilirsin. Çoğu insan habersizce başvurur — bu yüzden başarısız olur."
      : "You might be getting rejected without realizing why. Most people apply blindly. That's why they fail."}
  </span>
</div>

          

          <div className="hero-fade" style={{ animationDelay: "0.4s", display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
            <button
              onClick={() => navigate("/app")}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 36px", background: "linear-gradient(135deg, #3b82f6, #6366f1)", border: "none", borderRadius: 14, cursor: "pointer", color: "white", fontWeight: 700, fontSize: 16, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 0 40px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)", transition: "all 0.2s ease", width: "fit-content" }}
            >
              {lang === "TR" ? "Kararını öğren" : "Get your decision"} <ArrowRight size={16} />
            </button>
            <div style={{ display: "flex", gap: 16 }}>
              {(lang === "TR"
                ? ["⚡ 10 saniye sürer", "🎯 Gerçek recruiter mantığı", "🔓 Kayıt gerekmez"]
                : ["⚡ Takes 10 seconds", "🎯 Real recruiter logic", "🔓 No signup needed"]
              ).map(item => (
                <span key={item} style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>{item}</span>
              ))}
            </div>
          </div>

          <div className="hero-fade" style={{ animationDelay: "0.5s", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex" }}>
              {["#3b82f6","#8b5cf6","#ec4899","#10b981"].map((c,i) => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: "2px solid #060910", marginLeft: i===0?0:-8, display: "grid", placeItems: "center", fontSize: "10px", fontWeight: 700, color: "white" }}>{["A","B","C","D"][i]}</div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              <span style={{ color: "#f1f5f9", fontWeight: 600 }}>2,400+</span> {lang === "TR" ? "CV bu hafta analiz edildi" : "CVs analyzed this week"}
            </div>
          </div>
        </div>

        {/* RIGHT — Result Preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Mock Input */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent)" }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              {lang === "TR" ? "Canlı Önizleme" : "Live Preview"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: lang === "TR" ? "CV" : "CV", lines: [70, 90, 55, 80] },
                { label: lang === "TR" ? "İş İlanı" : "Job Description", lines: [85, 65, 75, 50] },
              ].map(({ label, lines }) => (
                <div key={label} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, marginBottom: 8 }}>{label}</div>
                  {lines.map((w, i) => (
                    <div key={i} style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", marginBottom: 6, width: `${w}%` }} />
                  ))}
                </div>
              ))}
            </div>

            <button
              onClick={handleDemo}
              disabled={animating}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: animating ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white", fontSize: 13, fontWeight: 700, cursor: animating ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {animating
              ? <><div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid white", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />{demoSteps[demoStep]}</>
              : <>{lang === "TR" ? "👁 Bir CV'nin nasıl reddedildiğini gör →" : "👁 Watch this CV get rejected →"}</>}

            </button>
          </div>

          {animating && (
  <div style={{ marginTop: 12, marginBottom: 4 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#334155", marginBottom: 6, fontWeight: 700 }}>
      <span>{demoSteps[demoStep]}</span>
      <span>{Math.round((demoStep / (demoSteps.length - 1)) * 100)}%</span>
    </div>
    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${Math.round((demoStep / (demoSteps.length - 1)) * 100)}%`,
        background: "linear-gradient(90deg, #3b82f6, #6366f1)",
        borderRadius: 999,
        transition: "width 0.6s ease"
      }} />
    </div>
  </div>
)}

          {/* Result Card */}
          {showResult && (
            <div style={{ background: "#0a0a0a", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 20, padding: 20, position: "relative", overflow: "hidden", animation: "resultReveal 0.4s ease" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #f87171, transparent)" }} />

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ padding: "8px 16px", borderRadius: 10, background: r.decisionBg, border: `1px solid ${r.decisionBorder}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: r.decisionColor, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>{lang === "TR" ? "Karar" : "Decision"}</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: r.decisionColor }}>{r.decision}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${score}%`, height: "100%", background: "linear-gradient(90deg, #f87171, transparent)", borderRadius: 999, transition: "width 0.3s ease" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>{score}%</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#334155", fontWeight: 600 }}>{lang === "TR" ? "Uyum Skoru" : "Fit Score"}</div>
                </div>
              </div>

              <div style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#f87171", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>⚡ {lang === "TR" ? "En Büyük Sorun" : "Biggest Mistake"}</div>
                <div style={{ fontSize: 12, color: "#fca5a5", fontWeight: 600 }}>{r.mistake}</div>
              </div>

              <div style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>→ {lang === "TR" ? "Düzeltme" : "Fix"}</div>
                <div style={{ fontSize: 12, color: "#6ee7b7", fontWeight: 600 }}>{r.fix}</div>
              </div>

              <div style={{ padding: "10px 12px", background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.1)", borderRadius: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#d4af37", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>💬 {lang === "TR" ? "Recruiter Görüşü" : "Recruiter Insight"}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>"{r.insight}"</div>
              </div>

              <button onClick={() => navigate("/app")} style={{ marginTop: 14, width: "100%", padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                {lang === "TR" ? "Kendi CV'ni analiz et →" : "Analyze your own CV →"}
              </button>
            </div>
          )}

          {!showResult && !animating && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: lang === "TR" ? "Ort. skor artışı" : "Avg. score boost", value: "+23pts", color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.15)" },
                { label: lang === "TR" ? "Analiz süresi" : "Analysis time", value: "~8sec", color: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.15)" },
                { label: lang === "TR" ? "Ücretsiz" : "Free to use", value: "100%", color: "#8b5cf6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.15)" },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
                  <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.3 }}>{label}</div>
                </div>
              ))}
            </div>
          )}
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
            <button className="hf-btn-primary" onClick={() => window.open("https://hirefit.lemonsqueezy.com/checkout/buy/19ee5972-0f76-4d2f-b2a0-9e08dc9a9a7d", "_blank")} style={{ width: "100%", justifyContent: "center", fontSize: "14px", background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 0 24px rgba(99,102,241,0.3)" }}>
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

function WaitlistSection({ lang }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    try { await supabase.from("waitlist").insert({ email }); setSubmitted(true); }
    catch { setSubmitted(true); }
    finally { setSubmitting(false); }
  };

  return (
    <section style={{ padding: "80px 0 100px" }}>
      <div style={styles.container}>
        <div style={{ borderRadius: 24, background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.05))", border: "1px solid rgba(59,130,246,0.18)", padding: "64px 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-80px", right: "-80px", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", fontSize: "12px", fontWeight: 700, color: "#93c5fd", letterSpacing: "0.06em", marginBottom: 20, textTransform: "uppercase" }}>
              <Zap size={12} /> {lang === "TR" ? "Pro Plan Çok Yakında" : "Pro Plan Coming Soon"}
            </div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "36px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 14, lineHeight: 1.15 }}>
              {lang === "TR" ? <>Pro'nun ne zaman<br />çıktığını ilk öğren</> : <>Be first to know<br />when Pro launches</>}
            </h2>
            <p style={{ color: T.textSub, fontSize: "15px", lineHeight: 1.7 }}>
              {lang === "TR" ? "Erken erişim, kurucu üye fiyatlandırması ve halka açılmadan önce özel özellikler edinin." : "Get early access, founding member pricing, and exclusive features before public launch."}
            </p>
          </div>
          <div style={{ position: "relative", zIndex: 2 }}>
            {submitted ? (
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: "36px 32px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{lang === "TR" ? "Listedesiniz!" : "You're on the list!"}</div>
                <div style={{ color: T.textSub, fontSize: 14 }}>{lang === "TR" ? "Pro yayına girdiğinde sizi bilgilendireceğiz." : "We'll notify you when Pro launches."}</div>
              </div>
            ) : (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "36px 32px" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{lang === "TR" ? "Bekleme listesine katılın" : "Join the waitlist"}</div>
                <div style={{ color: T.textSub, fontSize: 14, marginBottom: 24 }}>{lang === "TR" ? "Pro yayına girdiği anda haberdar olun." : "Be notified the moment Pro goes live."}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input className="hf-input" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
                  <button className="hf-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ justifyContent: "center", opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? <><Loader2 size={14} />{lang === "TR" ? "Katılınıyor..." : "Joining..."}</> : <>{lang === "TR" ? "Beni Haberdar Et" : "Notify Me"} <ArrowRight size={14} /></>}
                  </button>
                </div>
              </div>
            )}
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

function MainApp() {  
  const navigate = useNavigate();
  const location = useLocation();

  const getInitialView = () => {
    const path = window.location.pathname;
    if (path === "/app") return "app";
    if (path === "/roadmap") return "roadmap";
    if (path === "/dashboard") return "dashboard";
    if (path === "/login") return "login";
    if (path === "/terms") return "terms";
    if (path === "/privacy") return "privacy";

    return "landing";
  };

  const [view, setView] = useState(getInitialView);

  useEffect(() => {
    const path = location.pathname;
    if (path === "/app") setView("app");
    else if (path === "/roadmap") setView("roadmap");
    else if (path === "/dashboard") setView("dashboard");
    else if (path === "/login") setView("login");
    else if (path === "/terms") setView("terms");
    else if (path === "/privacy") setView("privacy");
    else setView("landing");
  }, [location.pathname]);

  useEffect(() => {
    if (view !== "app") return;
    if (location.hash !== "#hirefit-apply-focus") return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById("hirefit-apply-focus");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const ta = el.querySelector("textarea");
      if (ta && typeof ta.focus === "function") ta.focus({ preventScroll: true });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [view, location.hash, location.pathname]);

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
  const [roleType, setRoleType] = useState("");
  const [seniority, setSeniority] = useState("");
  const [matchedSkills, setMatchedSkills] = useState([]);
  const [missingSkills, setMissingSkills] = useState([]);
  const [topKeywords, setTopKeywords] = useState([]);
  const [history, setHistory] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [sector, setSector] = useState("Auto-detect");
  const [lang, setLang] = useState("EN");
  const [showPaywall, setShowPaywall] = useState(false);
  /** Logged-in users: row from user_plans (analysis_count, last_reset_at, plan). */
  const [userPlanRow, setUserPlanRow] = useState(null);
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
  const cvLoaded = cvText.trim().length > 24;
  const jdLoaded = jdText.trim().length > 40;
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
    } catch { setError(lang === "TR" ? "İş ilanı çıkarılamadı. Lütfen manuel yapıştırın." : "Could not extract job description. Please paste it manually."); }
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
      if (row.plan !== "pro" && (row.analysis_count ?? 0) >= 2) {
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
  ? ["CV'n analiz ediliyor...", "Recruiter gibi düşünülüyor...", "İş ilanıyla karşılaştırılıyor...", "Sonuçlar hazırlanıyor..."]
  : ["Analyzing your CV...", "Thinking like a recruiter...", "Checking job alignment...", "Preparing your results..."];
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

    let v2Ok = false;
    let creditConsumed = false;
    const jdDerivedTitle = extractJobTitleFromJd(jdText);
    try {
      const v2Res = await fetch(`${HF_API_BASE}/api/analyze-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText, jobDescription: jdText, sector, lang, isPro }),
      });
      if (v2Res.ok) {
        const v2 = await v2Res.json();
        v2Ok = true;
        setEngineV2(v2);
        const fs = Number(v2["Final Alignment Score"]) || 0;
        setAlignmentScore(fs);
        const modelRole =
          !v2.RoleFit?.locked && v2.RoleFit?.best_role
            ? v2.RoleFit.best_role
            : v2.RoleFit?.role_fit?.[0]?.role || "";
        const savedTitle = resolveSavedAnalysisRole(jdDerivedTitle, modelRole, lang);
        setRoleType(savedTitle);
        setSeniority("");
        setMatchedSkills([]);
        setMissingSkills(v2.ATS?.missing_keywords ?? []);
        setTopKeywords([]);
        const reasons = v2.Gaps?.rejection_reasons || [];
        const high = reasons.filter((r) => r.impact === "high").map((r) => r.issue);
        const med = reasons.filter((r) => r.impact === "medium").map((r) => r.issue);
        const low = reasons.filter((r) => r.impact === "low").map((r) => r.issue);
        const reportText = `HireFit Decision Engine\nVerdict: ${v2.Decision?.final_verdict}\nAlignment: ${fs}\n\n${v2.Decision?.reasoning || ""}`.trim();
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
          matched_skills: [],
          missing_skills: v2.ATS?.missing_keywords ?? [],
          top_keywords: (v2.ATS?.missing_keywords ?? []).slice(0, 12),
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
          },
          role_matches: roleMatchesFromV2,
          interview_prep: isPro ? buildInterviewPrepFromV2(v2, lang) : [],
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
          matched_skills: [],
          missing_skills: v2.ATS?.missing_keywords ?? [],
          top_keywords: [],
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
        setEngineV2(null);
        setAlignmentScore(data.alignment_score ?? null);
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
        setError(lang === "TR" ? "Analiz başarısız." : "Analysis failed. Check your API key or network.");
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
      setOptimizedCv(data.optimizedCv || "");
      setShowSharePrompt(true);
    } catch { setError(lang === "TR" ? "CV optimizasyonu başarısız." : "CV optimization failed."); }
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
    if (!missingSkills.length) { setError(lang === "TR" ? "Henüz eksik beceri tespit edilmedi." : "No missing skills detected yet."); return; }
    setRoadmapLoading(true); setError(""); setLearningPlan("");
    try {
      const res = await fetch(`${HF_API_BASE}/roadmap`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ missingSkills, roleType, seniority }) });
      const data = await res.json();
      setLearningPlan(data.roadmap || "");
    } catch { setError(lang === "TR" ? "Öğrenme yol haritası oluşturulamadı." : "Failed to generate learning roadmap."); }
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
      setError(lang === "TR" ? "PDF okunamadı." : "Failed to read PDF.");
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
      setError(lang === "TR" ? "Dosya okunamadı." : "Could not read file.");
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

  const openUpgrade = () => window.open("https://hirefit.lemonsqueezy.com/checkout/buy/19ee5972-0f76-4d2f-b2a0-9e08dc9a9a7d", "_blank");

  const sectorLabels = lang === "TR"
    ? ["Otomatik", "Teknoloji / Startup", "Danışmanlık", "Finans", "FMCG / Perakende", "Sağlık", "Kamu"]
    : ["Auto-detect", "Tech / Startup", "Consulting", "Finance", "FMCG / Retail", "Healthcare", "Government"];
  const sectorValues = HF_SECTOR_VALUES;

  return (
    <div style={styles.page}>
      <Navbar view={view} setView={setView} user={user} logout={logout} navigate={navigate} lang={lang} setLang={setLang} />

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

      {view === "terms" && (
        <div style={{ ...styles.container, padding: "60px 24px", maxWidth: 800 }}>
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
                ["7. Yapay Zekâ ile Üretilen İçerik", "HireFit, çıktıları üretmek için üçüncü taraf yapay zekâ modelleri (OpenRouter üzerinden GPT-4o-mini) kullanır. Bunlar yalnızca bilgilendirme amaçlıdır ve profesyonel kariyer danışmanlığının yerini tutmaz."],
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
                ["7. AI-Generated Content", "HireFit uses third-party AI models (GPT-4o-mini via OpenRouter) to generate outputs. These are for informational purposes only and are not a substitute for professional career advice."],
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
      )}

      {view === "privacy" && (
        <div style={{ ...styles.container, padding: "60px 24px", maxWidth: 800 }}>
          <button onClick={() => navigate("/")} style={{ marginBottom: 32, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{lang === "TR" ? "← Geri" : "← Back"}</button>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, marginBottom: 8 }}>{t.privacy}</h1>
          <p style={{ color: "#475569", marginBottom: 40, fontSize: 14 }}>{lang === "TR" ? "Son güncelleme: Nisan 2026" : "Last updated: April 2026"}</p>
          {(lang === "TR"
            ? [
                ["1. Biz Kimiz", "HireFit, Kıbrıs Lefkoşa'da ikamet eden bireysel geliştirici Muhammed Anıl Ceylan tarafından işletilmektedir. İletişim: support@hirefit.ai"],
                ["2. Topladığımız Veriler", "Hesap bilgileri (e-posta, Google OAuth ile ad), yüklediğiniz CV içeriği, iş ilanları, kullanım verileri ile cihaz ve oturum verileri. Ödeme ayrıntıları yalnızca Lemon Squeezy tarafından işlenir; kart bilgilerini hiçbir şekilde saklamıyoruz."],
                ["3. Verilerinizi Nasıl Kullanıyoruz", "Hizmeti sunmak, yapay zekâ analizini yürütmek, hesabınızı ve aboneliğinizi yönetmek, işlemsel e-postalar göndermek ve dolandırıcılığı tespit etmek için. Verilerinizi satmıyoruz ve CV içeriğinizi yapay zekâ modellerini eğitmek için kullanmıyoruz."],
                ["4. Veri Saklama", "Veritabanı: Supabase (AB'de barındırılmış). Kimlik doğrulama: Google OAuth ile Supabase Auth. Veriler hesabınız etkin olduğu sürece saklanır; dilediğiniz zaman silinmesini talep edebilirsiniz."],
                ["5. Üçüncü Taraf Hizmetleri", "Supabase (veritabanı ve kimlik doğrulama), OpenRouter/OpenAI (yapay zekâ analizi), Lemon Squeezy (ödemeler), Vercel (barındırma), Railway (arka uç). CV'niz işlenmek üzere API üzerinden OpenAI'a iletilir; varsayılan olarak modellerini eğitmek için kullanılmaz."],
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
                ["5. Third-Party Services", "Supabase (database/auth), OpenRouter/OpenAI (AI analysis), Lemon Squeezy (payments), Vercel (hosting), Railway (backend). Your CV is sent to OpenAI via API for processing — it is not used to train their models by default."],
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
      )}

      {view === "roadmap" && (
        <RoadmapPage navigate={navigate} lang={lang} t={t} learningPlan={learningPlan} roleType={roleType} seniority={seniority} />
      )}

      {view === "landing" && (
        <>
          <HeroSection navigate={navigate} lang={lang} />
          <FeatureCards lang={lang} />
          <PricingSection navigate={navigate} lang={lang} />
          <WaitlistSection lang={lang} />
          <Footer navigate={navigate} lang={lang} />
        </>
      )}

      {view === "login" && (
        <div style={{ ...styles.container, padding: "80px 24px" }}>
          <div style={{ maxWidth: 440, margin: "0 auto" }}>
            <div className="hf-card" style={{ padding: 40 }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, marginBottom: 8 }}>{t.welcomeBack}</h2>
              <p style={{ color: T.textSub, fontSize: "14px", marginBottom: 28 }}>{t.signInDesc}</p>
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
      )}

      {view === "dashboard" && (
        <div style={{ ...styles.container, padding: "48px 24px" }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "42px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>{t.dashboard}</h1>
            <p style={{ color: T.textSub, fontSize: "16px" }}>{t.dashboardDesc}</p>
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
                    <li key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: T.textSub }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.blue, flexShrink: 0 }} />{item}
                    </li>
                  ))}
                </ul>
                <button className="hf-btn-primary" onClick={() => navigate("/app")} style={{ marginTop: 24, fontSize: "14px" }}>{t.openProduct} <ArrowRight size={14} /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "app" && (
  <div style={{ maxWidth: 1320, margin: "0 auto", padding: "48px 24px", minHeight: "calc(100vh - 80px)" }}>

    {/* HEADER */}
    <div style={{ textAlign: "center", marginBottom: 40 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 999, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", fontSize: "11px", fontWeight: 700, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#8b5cf6", boxShadow: "0 0 6px #8b5cf6", display: "inline-block" }} />
        {lang === "TR" ? "AI Kariyer Analizi" : "AI Career Analysis"}
      </div>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 12 }}>
        {lang === "TR" ? "Başvurmadan önce gerçekten şansın var mı öğren." : "Know if you should apply - before you waste time."}
      </h1>
      <p style={{ color: "#475569", fontSize: 15, maxWidth: 480, margin: "0 auto" }}>
        {lang === "TR" ? "Recruiter'ların CV'ni saniyeler içinde nasıl değerlendirdiğini net gör." : "See exactly how recruiters evaluate your CV in seconds."}
      </p>
    </div>

    <div className="hf-app-workspace">
    <motion.div
      className={`hf-input-panel ${activeInput ? "hf-input-panel--active" : ""}`}
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
          className="hf-textarea hf-dropzone__textarea"
          placeholder={t.pasteCv}
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          onFocus={() => setActiveInput("cv")}
          onBlur={() => setActiveInput((v) => (v === "cv" ? null : v))}
          onClick={(e) => e.stopPropagation()}
          readOnly={uploadingPdf}
          style={{ minHeight: cvText.trim() ? 140 : 100, resize: "vertical", transition: "all 220ms ease" }}
        />
      </div>
    </motion.div>

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
        {lang === "TR" ? "Yapıştır, .txt bırak veya linkten çek — en doğru sonuç için tam metin." : "Paste, drop a .txt, or extract from a link — full text works best."}
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
          disabled={extractingJob}
          whileHover={{ scale: extractingJob ? 1 : 1.02 }}
          whileTap={{ scale: extractingJob ? 1 : 0.98 }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(34,211,238,0.45)", background: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(59,130,246,0.16))", color: "#67e8f9", fontWeight: 800, cursor: extractingJob ? "not-allowed" : "pointer", boxShadow: "0 0 18px rgba(34,211,238,0.2)" }}
        >
          <Link2 size={12} />
          {extractingJob ? (lang === "TR" ? "İlan detayları çekiliyor..." : "Extracting job details...") : (lang === "TR" ? "Linkten İlanı Analiz Et" : "Analyze Job from Link")}
        </motion.button>
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
        {lang === "TR"
          ? "Bazı siteler (LinkedIn, Indeed) çıkarmaya izin vermez; olmazsa yapıştırın."
          : "Some sites (LinkedIn, Indeed) block extraction — paste manually if needed."}
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
          className="hf-textarea hf-dropzone__textarea"
          placeholder={t.pasteJd}
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          onFocus={() => setActiveInput("jd")}
          onBlur={() => setActiveInput((v) => (v === "jd" ? null : v))}
          readOnly={extractingJob}
          style={{ minHeight: jdText.trim() ? 140 : 100, resize: "vertical", transition: "all 220ms ease" }}
        />
      </div>
    </motion.div>

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
        <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>{lang === "TR" ? "Sektör" : "Sector"}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sectorValues.map((s, idx) => {
            const th = SECTOR_CHIP_THEME[s] || SECTOR_CHIP_THEME["Auto-detect"];
            const active = sector === s;
            return (
              <button
                key={s}
                type="button"
                className={`hf-sector-chip${active ? " hf-sector-chip--active" : ""}`}
                onClick={() => setSector(s)}
                style={{
                  border: `1px solid ${active ? th.ring : "rgba(255,255,255,0.09)"}`,
                  background: active ? th.bg : "rgba(255,255,255,0.03)",
                  color: active ? th.dot : "#64748b",
                }}
              >
                <span
                  className="hf-sector-chip__dot"
                  style={{
                    background: active ? th.dot : "rgba(148,163,184,0.4)",
                    boxShadow: active ? `0 0 12px ${th.dot}66` : "none",
                  }}
                  aria-hidden
                />
                {sectorLabels[idx]}
              </button>
            );
          })}
        </div>
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
    <button
      onClick={analyze}
      disabled={loading}
      style={{
        width: "100%", padding: "16px", borderRadius: 14, border: "none",
        background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #3b82f6, #6366f1)",
        color: "white", fontSize: 16, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        boxShadow: loading ? "none" : "0 0 32px rgba(99,102,241,0.35)",
        transition: "all 0.2s ease", marginBottom: 32,
        opacity: loading ? 0.8 : 1,
      }}
    >
      {loading ? <><Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />{lang === "TR" ? "CV + İlan uyumu analiz ediliyor..." : "Analyzing CV + Job Match..."} {loadingMessage ? `• ${loadingMessage}` : ""}</> : <>{t.checkFit} <Sparkles size={16} /></>}
    </button>

    {/* ERROR */}
    {error && (
      <div style={{ display: "flex", gap: 10, padding: "14px 16px", borderRadius: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#fca5a5", fontSize: 14, marginBottom: 16 }}>
        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}
      </div>
    )}

    </motion.div>
    <div className={`hf-data-bridge${loading || (cvLoaded && jdLoaded) ? " hf-data-bridge--hot" : ""}`} aria-hidden>
      <div className="hf-data-bridge__line" />
      <motion.span
        className="hf-data-bridge__pulse"
        animate={{ x: ["0%", "98%"] }}
        transition={{ repeat: Infinity, duration: loading ? 1.35 : 2.3, ease: "linear" }}
      />
      {(loading || (cvLoaded && jdLoaded)) ? <span className="hf-data-bridge__pulse hf-data-bridge__pulse--trail" /> : null}
    </div>

    <motion.div
      className="hf-output-panel"
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
    <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0 12px" }} />
    <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <Workflow size={14} color="#a78bfa" />
      {lang === "TR" ? "Recruiter'ın 7 saniyede gördüğü ekran bu." : "This is what a recruiter sees in 7 seconds."}
    </div>
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
          onSharePrompt={handleSharePrompt}
        />
      </motion.div>
    )}
    {engineV2 && alignmentScore !== null && (
      <ShareYourResult
        score={alignmentScore}
        verdictLabel={getScoreFinalVerdict(alignmentScore, lang).shareLabel}
        biggestMistake={
          engineV2?.Gaps?.biggest_gap ||
          engineV2?.Gaps?.rejection_reasons?.[0]?.issue ||
          ""
        }
        lang={lang}
      />
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

    {alignmentScore !== null && analysisData && (
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
            onClick={optimizeCv}
            disabled={optimizing}
            style={{ flex: 1, minWidth: 160, padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(34,211,238,0.25)", background: "rgba(34,211,238,0.06)", color: "#22d3ee", fontSize: 14, fontWeight: 600, cursor: optimizing ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: optimizing ? 0.7 : 1 }}
          >
            {optimizing ? <><Loader2 size={14} />{t.optimizing}</> : <><Wand2 size={14} />{t.optimizeCV}</>}
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
    </div>

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
)}

</div>
  );
}

export default MainApp;
