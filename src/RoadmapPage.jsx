import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, ArrowRight, Download, Linkedin, Loader2, Share2 } from "lucide-react";
import { parseLearningRoadmapToSteps, parseRoadmapStepDescription } from "./roadmapUtils";
import { parseLocalStorageJson } from "./utils/safeJson";
import {
  applyJobToFocusMicroLine,
  buildRetentionSharePost,
  buildRoadmapTaskCatalog,
  buildTaskCompletionSharePost,
  bumpRoadmapXp,
  bumpStreakAfterDailyComplete,
  clearFocusJob,
  deriveJobTitleFromUrl,
  loadFocusJob,
  loadRoadmapDaily,
  loadRoadmapProgress,
  loadRoadmapStreak,
  mockCandidateAheadPercentile,
  normalizeCompletedForCatalog,
  normalizeJobUrlInput,
  pickDailyTask,
  planFingerprint,
  saveFocusJob,
  saveRoadmapDaily,
  saveRoadmapProgress,
  saveRoadmapStreak,
  splitFocusTaskLabel,
  todayYMD,
} from "./roadmapRetention";

const T = { green: "#10b981" };

const FOCUS_CONFETTI_SPEC = [
  { dx: "-72px", dy: "92px", rot: "220deg", c: "rgba(52,211,153,0.75)", del: 0 },
  { dx: "78px", dy: "88px", rot: "-200deg", c: "rgba(99,102,241,0.7)", del: 0.04 },
  { dx: "-42px", dy: "102px", rot: "140deg", c: "rgba(129,140,248,0.65)", del: 0.07 },
  { dx: "48px", dy: "98px", rot: "-160deg", c: "rgba(45,212,191,0.6)", del: 0.1 },
  { dx: "0px", dy: "108px", rot: "90deg", c: "rgba(148,163,184,0.55)", del: 0.02 },
  { dx: "-95px", dy: "72px", rot: "300deg", c: "rgba(96,165,250,0.55)", del: 0.06 },
];

function buildSmoothPathHorizontal(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const dx = p1.x - p0.x;
    const sag = Math.min(48, Math.max(16, Math.abs(dx) * 0.12)) * (i % 2 === 0 ? 1 : -1);
    const cx1 = p0.x + dx * 0.35;
    const cy1 = p0.y + sag;
    const cx2 = p0.x + dx * 0.65;
    const cy2 = p1.y + sag;
    d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
  }
  return d;
}

function buildSmoothPathVertical(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const dy = p1.y - p0.y;
    const sag = Math.min(36, Math.max(12, Math.abs(dy) * 0.1)) * (i % 2 === 0 ? 1 : -1);
    const cx1 = p0.x + sag;
    const cy1 = p0.y + dy * 0.35;
    const cx2 = p1.x + sag;
    const cy2 = p0.y + dy * 0.65;
    d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
  }
  return d;
}

function relCenter(el, container) {
  if (!el || !container) return { x: 0, y: 0 };
  const cr = container.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  return {
    x: er.left + er.width / 2 - cr.left,
    y: er.top + er.height / 2 - cr.top,
  };
}

const ROADMAP_DESC_CHAR_LIMIT = 280;
const ROADMAP_RAW_CHAR_LIMIT = 360;
function truncateChars(text, max) {
  const s = (text || "").trim();
  if (s.length <= max) return { shown: s, truncated: false };
  const cut = s.slice(0, max).trimEnd();
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return { shown: `${base}…`, truncated: true };
}

function computeJourneyStepIndex(roadmapSteps, taskCatalog, completedIds) {
  const done = new Set(completedIds);
  for (let si = 0; si < roadmapSteps.length; si++) {
    const ids = taskCatalog.filter((t) => t.stepIndex === si).map((t) => t.id);
    if (ids.some((id) => !done.has(id))) return si;
  }
  return Math.max(0, roadmapSteps.length - 1);
}

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

function emptyFixProofGrid(fixes) {
  return {
    completed: Array.from({ length: fixes.length }, () => false),
    fixProofs: Array.from({ length: fixes.length }, () => ""),
  };
}

function loadRoadmapFixExecutionState(fp, fixes) {
  if (!fp || !fixes.length) return emptyFixProofGrid(fixes);
  const parsed = parseLocalStorageJson(LS_FIX_PROGRESS + fp, null);
  if (!parsed || typeof parsed !== "object") return emptyFixProofGrid(fixes);
  return {
    completed:
      Array.isArray(parsed.completed) && parsed.completed.length === fixes.length
        ? parsed.completed.map(Boolean)
        : Array.from({ length: fixes.length }, () => false),
    fixProofs:
      Array.isArray(parsed.fixProofs) && parsed.fixProofs.length === fixes.length
        ? parsed.fixProofs.map((v) => String(v ?? ""))
        : Array.from({ length: fixes.length }, () => ""),
  };
}

function saveRoadmapFixExecutionState(fp, state) {
  if (!fp || !state) return;
  try {
    const prev = parseLocalStorageJson(LS_FIX_PROGRESS + fp, {});
    localStorage.setItem(
      LS_FIX_PROGRESS + fp,
      JSON.stringify({
        ...prev,
        completed: Array.isArray(state.completed) ? state.completed : [],
        fixProofs: Array.isArray(state.fixProofs) ? state.fixProofs : [],
        updatedAt: Date.now(),
      })
    );
  } catch {
    // ignore
  }
}

/** NEW: LinkedIn-ready share copy from roadmap steps + role (growth). */
function escapeXmlText(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapePathD(d) {
  return String(d ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/**
 * Vector export: single self-contained SVG (inline defs, no external CSS).
 * NEW — replaces raster screenshot export.
 */
function serializeHirefitRoadmapSvg(p) {
  const {
    totalW,
    totalH,
    headerH,
    pathD,
    pathLength,
    pathRevealLength,
    nodes,
    cards,
    youAreHere: yah,
    youLabel,
    kicker,
    headline,
    progressLine,
    identityLine = "",
    mapWatermark = "",
    footerBrand,
    footerWatermark,
  } = p;

  const dashArr = pathLength > 0 ? `${pathLength} ${pathLength}` : "1 1";
  const dashOff = pathLength > 0 ? pathLength - pathRevealLength : 0;
  const dy = headerH;
  const dSafe = escapePathD(pathD);
  const hw = totalW / 2;

  const cardEls = cards
    .map((c) => {
      const t = escapeXmlText((c.title || "").slice(0, 72));
      const x = +c.x.toFixed(2);
      const y = +c.y.toFixed(2);
      const w = +c.w.toFixed(2);
      const h = +c.h.toFixed(2);
      const mid = +(x + w / 2).toFixed(2);
      const ty = +(y + Math.min(26, h * 0.22)).toFixed(2);
      const cfid = c.cardFilterId || "hirefit-card-shadow";
      return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" filter="url(#${cfid})"/><text x="${mid}" y="${ty}" text-anchor="middle" fill="#f1f5f9" font-family="DM Sans,system-ui,sans-serif" font-size="13" font-weight="700">${t}</text></g>`;
    })
    .join("");

  const nodeEls = nodes
    .map((n) => {
      const { cx, cy, r, fill, stroke, sw, nodeFilter } = n;
      const filt = nodeFilter ? ` filter="url(#${nodeFilter})"` : "";
      return `<circle cx="${+cx.toFixed(2)}" cy="${+cy.toFixed(2)}" r="${+r.toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw ?? 2}"${filt}/>`;
    })
    .join("");

  let youSvg = "";
  if (yah) {
    youSvg = `<g>
      <rect x="${+yah.pillX.toFixed(2)}" y="${+yah.pillY.toFixed(2)}" width="${+yah.pillW.toFixed(2)}" height="${+yah.pillH.toFixed(2)}" rx="12" fill="rgba(30,27,75,0.95)" stroke="rgba(186,198,255,0.55)" stroke-width="1.5" filter="url(#hirefit-pill-glow)"/>
      <text x="${+yah.tx.toFixed(2)}" y="${+yah.ty.toFixed(2)}" text-anchor="middle" fill="#eef2ff" font-family="DM Sans,system-ui,sans-serif" font-size="13" font-weight="800" letter-spacing="0.06em">${escapeXmlText(youLabel)}</text>
    </g>`;
  }

  const identity = identityLine
    ? `<text x="${hw}" y="68" text-anchor="middle" fill="#a5b4fc" font-family="DM Sans,system-ui,sans-serif" font-size="12" font-weight="700">${escapeXmlText(identityLine)}</text>`
    : "";
  const progY = progressLine ? (identityLine ? 94 : 84) : 0;
  const prog = progressLine
    ? `<text x="${hw}" y="${progY}" text-anchor="middle" fill="#94a3b8" font-family="DM Sans,system-ui,sans-serif" font-size="13" font-weight="600">${escapeXmlText(progressLine)}</text>`
    : "";
  const footerH = 46;
  const mapMidYrel = (totalH - headerH - footerH) / 2;
  const mw =
    mapWatermark && mapMidYrel > 40
      ? `<text x="${hw}" y="${(mapMidYrel + 18).toFixed(0)}" text-anchor="middle" fill="#e2e8f0" opacity="0.07" font-family="Syne,DM Sans,system-ui,sans-serif" font-size="38" font-weight="800" letter-spacing="0.2em">${escapeXmlText(mapWatermark)}</text>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
<defs>
  <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#3b82f6"/>
    <stop offset="100%" stop-color="#6366f1"/>
  </linearGradient>
  <linearGradient id="hirefit-node-current-fill" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#3b82f6"/>
    <stop offset="100%" stop-color="#6366f1"/>
  </linearGradient>
  <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="coloredBlur"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <filter id="hirefit-glow-green" x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="gb"/>
    <feFlood flood-color="#10b981" flood-opacity="0.6" result="fl"/>
    <feComposite in="fl" in2="gb" operator="in" result="sh"/>
    <feMerge>
      <feMergeNode in="sh"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <filter id="hirefit-glow-muted" x="-90%" y="-90%" width="280%" height="280%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="mb"/>
    <feFlood flood-color="#94a3b8" flood-opacity="0.4" result="mf"/>
    <feComposite in="mf" in2="mb" operator="in" result="ms"/>
    <feMerge>
      <feMergeNode in="ms"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <filter id="hirefit-glow-target" x="-120%" y="-120%" width="340%" height="340%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="tb"/>
    <feFlood flood-color="#fbbf24" flood-opacity="0.55" result="tf"/>
    <feComposite in="tf" in2="tb" operator="in" result="tg"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="11" result="tb2"/>
    <feFlood flood-color="#6366f1" flood-opacity="0.42" result="tf2"/>
    <feComposite in="tf2" in2="tb2" operator="in" result="tg2"/>
    <feMerge>
      <feMergeNode in="tg2"/>
      <feMergeNode in="tg"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <filter id="hirefit-card-shadow" x="-35%" y="-35%" width="170%" height="170%">
    <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000000" flood-opacity="0.45"/>
  </filter>
  <filter id="hirefit-card-glow-current" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000000" flood-opacity="0.38" result="drop"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="cb"/>
    <feFlood flood-color="#6366f1" flood-opacity="0.45" result="cf"/>
    <feComposite in="cf" in2="cb" operator="in" result="cg"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="24" result="cb2"/>
    <feFlood flood-color="#3b82f6" flood-opacity="0.22" result="cf2"/>
    <feComposite in="cf2" in2="cb2" operator="in" result="cg2"/>
    <feMerge>
      <feMergeNode in="cg2"/>
      <feMergeNode in="cg"/>
      <feMergeNode in="drop"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <filter id="hirefit-card-glow-done" x="-45%" y="-45%" width="190%" height="190%">
    <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#000000" flood-opacity="0.38" result="dd"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="eb"/>
    <feFlood flood-color="#10b981" flood-opacity="0.35" result="ef"/>
    <feComposite in="ef" in2="eb" operator="in" result="eg"/>
    <feMerge>
      <feMergeNode in="eg"/>
      <feMergeNode in="dd"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <filter id="hirefit-card-glow-target-card" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000000" flood-opacity="0.42" result="td"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="16" result="vb"/>
    <feFlood flood-color="#a855f7" flood-opacity="0.38" result="vf"/>
    <feComposite in="vf" in2="vb" operator="in" result="vg"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="28" result="vb2"/>
    <feFlood flood-color="#6366f1" flood-opacity="0.2" result="vf2"/>
    <feComposite in="vf2" in2="vb2" operator="in" result="vg2"/>
    <feMerge>
      <feMergeNode in="vg2"/>
      <feMergeNode in="vg"/>
      <feMergeNode in="td"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <filter id="hirefit-pill-glow" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.4" result="pd"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="pb"/>
    <feFlood flood-color="#818cf8" flood-opacity="0.5" result="pf"/>
    <feComposite in="pf" in2="pb" operator="in" result="pg"/>
    <feMerge>
      <feMergeNode in="pg"/>
      <feMergeNode in="pd"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <radialGradient id="hirefit-target-fill" cx="32%" cy="28%">
    <stop offset="0%" stop-color="#5b21b6"/><stop offset="100%" stop-color="#0f172a"/>
  </radialGradient>
</defs>
<rect width="${totalW}" height="${totalH}" fill="#070b12"/>
<text x="${hw}" y="22" text-anchor="middle" fill="#64748b" font-family="DM Sans,system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="0.18em">${escapeXmlText(kicker)}</text>
<text x="${hw}" y="54" text-anchor="middle" fill="#f1f5f9" font-family="Syne,DM Sans,system-ui,sans-serif" font-size="22" font-weight="800">${escapeXmlText(headline)}</text>
${identity}
${prog}
<g transform="translate(0,${dy})">
  ${mw}
  <path d="${dSafe}" fill="none" stroke="rgba(51,65,85,0.35)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${dSafe}" fill="none" stroke="url(#pathGradient)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)" stroke-dasharray="${dashArr}" stroke-dashoffset="${dashOff}"/>
  ${cardEls}
  ${nodeEls}
  ${youSvg}
</g>
<text x="${hw}" y="${totalH - 24}" text-anchor="middle" fill="#94a3b8" font-family="Syne,DM Sans,system-ui,sans-serif" font-size="12" font-weight="800" letter-spacing="0.14em">${escapeXmlText(footerBrand)}</text>
<text x="${hw}" y="${totalH - 8}" text-anchor="middle" fill="#64748b" font-family="DM Sans,system-ui,sans-serif" font-size="11" font-weight="600">${escapeXmlText(footerWatermark)}</text>
</svg>`;
}

async function rasterizeSvgStringToPngBlob(svgString, scale = 2) {
  const img = new Image();
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("svg raster load failed"));
    img.src = url;
  });
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context");
  ctx.fillStyle = "#070b12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export default function RoadmapPage({ navigate, lang, t, learningPlan, roleType, seniority, analysisData, cvText, jdText, alignmentScore }) {
  const uid = useId().replace(/:/g, "");
  const gradId = `roadmap-grad-${uid}`;
  const glowFilterId = `roadmap-glow-${uid}`;

  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 768 : false));
  const [roadmapFocusIndex, setRoadmapFocusIndex] = useState(0);
  const [roadmapHovered, setRoadmapHovered] = useState(null);
  const [roadmapSelection, setRoadmapSelection] = useState(null);

  const [storedPlan, setStoredPlan] = useState("");
  const [storedMeta, setStoredMeta] = useState({ roleType: "", seniority: "" });

  const mapCaptureRef = useRef(null);
  const mapInnerRef = useRef(null);
  const focusHeroRef = useRef(null);
  const scrollRef = useRef(null);
  const nodeRefs = useRef([]);
  const cardRefs = useRef([]);
  const targetCardRef = useRef(null);
  const pathRef = useRef(null);

  const [pathD, setPathD] = useState("");
  const [svgBox, setSvgBox] = useState({ w: 800, h: 280 });
  const [pathLength, setPathLength] = useState(0);
  const [youAreHere, setYouAreHere] = useState({ x: 0, y: 0, show: false });
  const [downloading, setDownloading] = useState(false);
  const [pathRedraw, setPathRedraw] = useState(0);
  const [pathRevealLength, setPathRevealLength] = useState(0);
  const [roadmapStepExpanded, setRoadmapStepExpanded] = useState(() => ({}));
  const [roadmapStepBodyExpanded, setRoadmapStepBodyExpanded] = useState(() => ({}));
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalMode, setShareModalMode] = useState("export");
  const [growthShareSnapshot, setGrowthShareSnapshot] = useState(null);
  const [shareFeedback, setShareFeedback] = useState(null);
  const [completedTaskIds, setCompletedTaskIds] = useState([]);
  const [dailyState, setDailyState] = useState(null);
  const [streak, setStreak] = useState({ count: 0, lastYmd: "" });
  const [dailyDoneBurst, setDailyDoneBurst] = useState(false);
  const [retentionToast, setRetentionToast] = useState(null);
  const [focusCompleteFlash, setFocusCompleteFlash] = useState(false);
  const [focusTaskSubmitting, setFocusTaskSubmitting] = useState(false);
  const [focusTaskSuccess, setFocusTaskSuccess] = useState(false);
  const [focusConfetti, setFocusConfetti] = useState(false);
  const [successMomentVisible, setSuccessMomentVisible] = useState(false);
  const [celebrationBar, setCelebrationBar] = useState(null);
  const [completionRipple, setCompletionRipple] = useState(false);
  const [streakBumpFlash, setStreakBumpFlash] = useState(false);
  const [focusJob, setFocusJob] = useState(null);
  const [focusJobUrlInput, setFocusJobUrlInput] = useState("");
  const [displaySocialPct, setDisplaySocialPct] = useState(0);
  const socialAnimFromRef = useRef(0);
  const [progressGlowNonce, setProgressGlowNonce] = useState(0);
  const [floatingProgressDelta, setFloatingProgressDelta] = useState(null);
  const [displayRetentionPct, setDisplayRetentionPct] = useState(0);
  const displayPctRef = useRef(0);
  const pctAnimRaf = useRef(null);
  const [pulseStepIndex, setPulseStepIndex] = useState(-1);
  const [fixExecState, setFixExecState] = useState({ completed: [], fixProofs: [] });
  const [proofDrafts, setProofDrafts] = useState({});
  const pulseClearRef = useRef(null);
  const prevJourneyStepRef = useRef(-1);

  useEffect(() => {
    const read = () => {
      try {
        setStoredPlan(localStorage.getItem("hirefit-learning-plan") || "");
        setStoredMeta(parseLocalStorageJson("hirefit-roadmap-meta", {}));
      } catch {
        setStoredPlan("");
        setStoredMeta({ roleType: "", seniority: "" });
      }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [learningPlan]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (document.getElementById("roadmap-map-styles")) return;
    const el = document.createElement("style");
    el.id = "roadmap-map-styles";
    el.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes roadmapCardEnter { from { opacity: 0; transform: translateY(22px) scale(0.94); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes roadmapNodeEnter { from { opacity: 0; transform: scale(0.72); } to { opacity: 1; transform: scale(1); } }
      @keyframes roadmapNextBadgePulse { 0%, 100% { box-shadow: 0 0 12px rgba(99,102,241,0.55), 0 0 24px rgba(59,130,246,0.35); } 50% { box-shadow: 0 0 18px rgba(139,92,246,0.65), 0 0 36px rgba(59,130,246,0.45); } }
      @keyframes roadmapYouFloat {
        0%, 100% { transform: translateY(-4px) scale(1); box-shadow: 0 0 32px rgba(99,102,241,0.7), 0 0 64px rgba(99,102,241,0.35), 0 0 100px rgba(129,140,248,0.2), 0 16px 40px rgba(0,0,0,0.55); }
        40% { transform: translateY(-12px) scale(1.04); box-shadow: 0 0 42px rgba(99,102,241,0.85), 0 0 84px rgba(129,140,248,0.42), 0 0 120px rgba(59,130,246,0.22), 0 18px 44px rgba(0,0,0,0.6); }
        58% { transform: translateY(-7px) scale(1.02); box-shadow: 0 0 34px rgba(99,102,241,0.72), 0 0 68px rgba(99,102,241,0.32), 0 16px 38px rgba(0,0,0,0.52); }
      }
      @keyframes roadmapActiveNodePulse {
        0%, 100% { transform: scale(1.08); box-shadow: 0 0 0 0 rgba(59,130,246,0.45), 0 0 22px rgba(99,102,241,0.55), 0 0 36px rgba(59,130,246,0.3); }
        50% { transform: scale(1.14); box-shadow: 0 0 0 12px rgba(59,130,246,0), 0 0 36px rgba(99,102,241,0.85), 0 0 52px rgba(129,140,248,0.45); }
      }
      @keyframes roadmapNodePulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5), 0 0 20px rgba(99,102,241,0.45); } 50% { box-shadow: 0 0 0 10px rgba(59,130,246,0), 0 0 32px rgba(99,102,241,0.6); } }
      .roadmap-scroll-hide { scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: smooth; }
      .roadmap-scroll-hide::-webkit-scrollbar { display: none; height: 0; width: 0; }
      .roadmap-action-row { transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease; }
      .roadmap-action-row:hover { background: rgba(99,102,241,0.12); transform: translateX(3px); border-color: rgba(129,140,248,0.35) !important; }
      @keyframes roadmapYouRippleExpand {
        0% { transform: scale(0.45); opacity: 0.55; }
        65% { opacity: 0.18; }
        100% { transform: scale(2.25); opacity: 0; }
      }
      @keyframes roadmapTargetGoalPulse {
        0%, 100% { box-shadow: 0 0 22px rgba(250,204,21,0.5), 0 0 48px rgba(99,102,241,0.4), 0 0 0 0 rgba(99,102,241,0.35); transform: scale(1); }
        50% { box-shadow: 0 0 36px rgba(250,204,21,0.7), 0 0 72px rgba(99,102,241,0.55), 0 0 0 10px rgba(99,102,241,0); transform: scale(1.07); }
      }
      .roadmap-you-here-anchor { pointer-events: none; }
      .roadmap-you-here-ripples { position: absolute; left: 50%; top: 100%; margin-top: 6px; width: 0; height: 0; pointer-events: none; z-index: 0; }
      .roadmap-you-here-ripples span {
        position: absolute; left: 0; top: 0; width: 96px; height: 96px; margin-left: -48px; margin-top: -48px;
        border-radius: 50%; border: 2px solid rgba(129,140,248,0.5);
        animation: roadmapYouRippleExpand 2.8s ease-out infinite;
        transform-origin: center center;
      }
      .roadmap-you-here-ripples span:nth-child(2) { animation-delay: 0.85s; border-color: rgba(99,102,241,0.38); }
      .roadmap-you-here-ripples span:nth-child(3) { animation-delay: 1.7s; border-color: rgba(59,130,246,0.32); }
      .roadmap-target-node-ring {
        width: 40px; height: 40px; border-radius: 50%;
        background: linear-gradient(135deg, #fbbf24, #3b82f6, #6366f1, #a855f7);
        padding: 3px; box-sizing: border-box;
        animation: roadmapTargetGoalPulse 2.5s ease-in-out infinite;
        display: grid; place-items: center;
      }
      .roadmap-target-node-core {
        width: 100%; height: 100%; border-radius: 50%;
        background: radial-gradient(circle at 32% 28%, #312e81, #0f172a 70%);
        border: 1px solid rgba(255,255,255,0.2);
        box-sizing: border-box;
      }
      .roadmap-cta-apply {
        transition: transform 0.24s cubic-bezier(0.22,1,0.36,1), box-shadow 0.24s ease, filter 0.24s ease !important;
        background: linear-gradient(135deg, #047857, #10b981 38%, #0d9488 72%, #2563eb) !important;
        border: none !important;
        box-shadow: 0 10px 36px rgba(16,185,129,0.38), 0 0 28px rgba(37,99,235,0.2) !important;
      }
      .roadmap-cta-apply:hover {
        transform: scale(1.055) translateY(-3px) !important;
        filter: brightness(1.08) !important;
        box-shadow: 0 16px 52px rgba(16,185,129,0.48), 0 0 48px rgba(59,130,246,0.32) !important;
      }
      .roadmap-cta-apply:active { transform: scale(1.02) translateY(-1px) !important; }
      @keyframes roadmapPercentPop { 0% { transform: scale(0.92); opacity: 0.6; } 55% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
      @keyframes roadmapCheckPop { 0% { transform: scale(0.85); } 45% { transform: scale(1.12); } 100% { transform: scale(1); } }
      @keyframes roadmapDailySuccess { 0% { transform: scale(1); filter: brightness(1); } 40% { transform: scale(1.03); filter: brightness(1.15); } 100% { transform: scale(1); filter: brightness(1); } }
      @keyframes roadmapToastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes roadmapProgressGlow {
        0%, 100% { text-shadow: none; filter: brightness(1); }
        35% { text-shadow: 0 0 16px rgba(147,197,253,0.95), 0 0 36px rgba(99,102,241,0.55); filter: brightness(1.14); }
        70% { text-shadow: 0 0 10px rgba(129,140,248,0.65); filter: brightness(1.06); }
      }
      @keyframes roadmapDeltaFloat {
        0% { opacity: 0; transform: translateY(8px) scale(0.92); }
        18% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(-22px) scale(1.02); }
      }
      @keyframes roadmapTaskRowPop {
        0% { transform: scale(1); }
        40% { transform: scale(1.02); }
        100% { transform: scale(1); }
      }
      @keyframes roadmapFocusCheckGlow {
        0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); transform: scale(1); }
        45% { box-shadow: 0 0 28px rgba(52,211,153,0.9); transform: scale(1.14); }
        100% { box-shadow: 0 0 12px rgba(16,185,129,0.45); transform: scale(1); }
      }
      .roadmap-focus-check-hit {
        animation: roadmapFocusCheckGlow 0.88s cubic-bezier(0.34,1.2,0.64,1) forwards !important;
      }
      @keyframes roadmapCheckSuccessHold {
        0%, 100% { box-shadow: 0 0 18px rgba(52,211,153,0.55), 0 0 32px rgba(16,185,129,0.35), inset 0 0 12px rgba(52,211,153,0.12); border-color: #34d399 !important; }
        50% { box-shadow: 0 0 26px rgba(52,211,153,0.85), 0 0 48px rgba(16,185,129,0.45), inset 0 0 16px rgba(52,211,153,0.2); }
      }
      .roadmap-focus-check-success {
        animation: roadmapCheckSuccessHold 1.1s ease-in-out infinite !important;
      }
      @keyframes roadmapSuccessScrimIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes roadmapSuccessMsgIn {
        from { opacity: 0; transform: translate(-50%, -46%) scale(0.94); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
      .roadmap-success-scrim {
        position: fixed;
        inset: 0;
        z-index: 1400;
        background: rgba(2, 6, 15, 0.48);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        animation: roadmapSuccessScrimIn 0.38s ease forwards;
        pointer-events: none;
      }
      .roadmap-success-float {
        position: fixed;
        left: 50%;
        top: 50%;
        z-index: 1410;
        transform: translate(-50%, -50%);
        max-width: min(420px, 92vw);
        padding: 20px 26px;
        border-radius: 18px;
        text-align: center;
        font-family: 'DM Sans', sans-serif;
        font-size: clamp(17px, 4vw, 20px);
        font-weight: 800;
        line-height: 1.45;
        color: #f8fafc;
        background: linear-gradient(145deg, rgba(16,185,129,0.22), rgba(59,130,246,0.18), rgba(99,102,241,0.12));
        border: 1px solid rgba(129,140,248,0.45);
        box-shadow: 0 0 60px rgba(99,102,241,0.35), 0 24px 64px rgba(0,0,0,0.45);
        animation: roadmapSuccessMsgIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
        pointer-events: none;
      }
      @keyframes roadmapFocusBlockComplete {
        0% { transform: scale(1) translateY(0); box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        42% { transform: scale(1.032) translateY(-8px); box-shadow: 0 20px 56px rgba(0,0,0,0.45), 0 0 48px rgba(99,102,241,0.35); }
        100% { transform: scale(1) translateY(0); box-shadow: 0 0 0 0 rgba(99,102,241,0); }
      }
      .roadmap-today-focus-complete {
        animation: roadmapFocusBlockComplete 0.72s cubic-bezier(0.34,1.2,0.64,1);
      }
      @keyframes roadmapScreenRippleRing {
        0% { transform: scale(0.2); opacity: 0.5; }
        100% { transform: scale(1); opacity: 0; }
      }
      .roadmap-screen-ripple {
        position: fixed;
        inset: 0;
        z-index: 1385;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .roadmap-screen-ripple span {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 140vmax;
        height: 140vmax;
        margin-left: -70vmax;
        margin-top: -70vmax;
        border-radius: 50%;
        border: 1px solid rgba(129,140,248,0.28);
        box-shadow: 0 0 60px rgba(52,211,153,0.12), inset 0 0 40px rgba(99,102,241,0.08);
        animation: roadmapScreenRippleRing 1.15s cubic-bezier(0.22, 0.85, 0.32, 1) forwards;
      }
      .roadmap-screen-ripple span:nth-child(2) {
        animation-delay: 0.14s;
        border-color: rgba(52,211,153,0.22);
      }
      @keyframes roadmapCelebrateBarIn {
        from { opacity: 0; transform: translateY(-14px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes roadmapCelebrateBarOut {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to { opacity: 0; transform: translateY(-8px) scale(0.98); }
      }
      .roadmap-celebrate-bar {
        position: fixed;
        top: max(16px, env(safe-area-inset-top, 0px));
        left: 50%;
        transform: translateX(-50%);
        z-index: 1450;
        max-width: min(420px, calc(100vw - 24px));
        padding: 12px 18px 14px;
        border-radius: 14px;
        background: linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,27,75,0.92));
        border: 1px solid rgba(129,140,248,0.38);
        box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 36px rgba(99,102,241,0.25);
        font-family: 'DM Sans', sans-serif;
        text-align: center;
        pointer-events: none;
        animation: roadmapCelebrateBarIn 0.42s cubic-bezier(0.22,1,0.36,1) forwards;
      }
      .roadmap-celebrate-bar.roadmap-celebrate-bar-exit {
        animation: roadmapCelebrateBarOut 0.55s ease forwards;
      }
      .roadmap-celebrate-bar-line1 {
        font-size: 13px;
        font-weight: 800;
        color: #fde68a;
        letter-spacing: 0.03em;
        text-shadow: 0 0 14px rgba(250,204,21,0.35);
        margin-bottom: 4px;
      }
      .roadmap-celebrate-bar-line2 {
        font-size: 12px;
        font-weight: 700;
        color: #86efac;
        line-height: 1.35;
      }
      @keyframes roadmapFocusXpPillIn {
        from { opacity: 0; transform: translateY(-8px) scale(0.94); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes roadmapFocusXpPillOut {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to { opacity: 0; transform: translateY(-4px) scale(0.96); }
      }
      .roadmap-focus-xp-pill {
        position: absolute;
        top: 14px;
        right: 14px;
        z-index: 4;
        max-width: min(210px, 46vw);
        padding: 8px 13px;
        border-radius: 999px;
        text-align: right;
        pointer-events: none;
        background: linear-gradient(135deg, rgba(16,185,129,0.38), rgba(59,130,246,0.3));
        border: 1px solid rgba(110,231,183,0.35);
        box-shadow: 0 0 22px rgba(52,211,153,0.22), 0 10px 28px rgba(0,0,0,0.4);
        animation: roadmapFocusXpPillIn 0.48s cubic-bezier(0.22,1,0.36,1) forwards;
      }
      .roadmap-focus-xp-pill.roadmap-focus-xp-pill-exit {
        animation: roadmapFocusXpPillOut 0.52s ease forwards;
      }
      .roadmap-focus-xp-pill-line1 {
        font-family: 'DM Sans', sans-serif;
        font-size: 11px;
        font-weight: 800;
        color: #ecfccb;
        letter-spacing: 0.02em;
        line-height: 1.25;
        text-shadow: 0 0 12px rgba(190,242,100,0.35);
      }
      .roadmap-focus-xp-pill-line2 {
        font-family: 'DM Sans', sans-serif;
        font-size: 10px;
        font-weight: 700;
        color: #a5f3fc;
        margin-top: 3px;
        line-height: 1.35;
        text-shadow: 0 0 10px rgba(34,211,238,0.25);
      }
      @keyframes roadmapProgressAlivePulse {
        0%, 100% { filter: brightness(1); text-shadow: 0 0 6px rgba(147,197,253,0.12); }
        50% { filter: brightness(1.1); text-shadow: 0 0 18px rgba(147,197,253,0.42), 0 0 28px rgba(99,102,241,0.2); }
      }
      @keyframes roadmapStreakPlusFloat {
        0% { opacity: 0; transform: translateY(6px) scale(0.85); }
        22% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(-14px) scale(1.02); }
      }
      .roadmap-streak-plus {
        position: absolute;
        left: 50%;
        bottom: 100%;
        margin-bottom: 2px;
        transform: translateX(-50%);
        font-size: 11px;
        font-weight: 900;
        color: #4ade80;
        white-space: nowrap;
        text-shadow: 0 0 12px rgba(74,222,128,0.55);
        animation: roadmapStreakPlusFloat 1.35s ease forwards;
        pointer-events: none;
      }
      .roadmap-progress-pct-wrap { position: relative; display: inline-block; }
      .roadmap-delta-float {
        position: absolute;
        left: 50%;
        bottom: 100%;
        margin-bottom: 4px;
        transform: translateX(-50%);
        font-size: 12px;
        font-weight: 800;
        color: #86efac;
        white-space: nowrap;
        pointer-events: none;
        animation: roadmapDeltaFloat 1.35s ease forwards;
        text-shadow: 0 0 14px rgba(16,185,129,0.55);
      }
      .roadmap-daily-done-btn {
        transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s ease, filter 0.2s ease !important;
      }
      .roadmap-daily-done-btn:hover {
        transform: scale(1.03) !important;
        box-shadow: 0 8px 28px rgba(99,102,241,0.35) !important;
        filter: brightness(1.05) !important;
      }
      .roadmap-celebrate-cta {
        transition: transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease !important;
      }
      .roadmap-celebrate-cta:hover {
        transform: scale(1.02) !important;
        filter: brightness(1.06) !important;
      }
      .roadmap-micro-cta-hover {
        transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), filter 0.2s ease, box-shadow 0.2s ease !important;
      }
      .roadmap-micro-cta-hover:hover {
        transform: scale(1.035) !important;
        filter: brightness(1.05) !important;
      }
      .roadmap-action-row {
        transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), border-color 0.2s ease, background 0.2s ease !important;
      }
      .roadmap-action-row:hover {
        transform: scale(1.012) !important;
      }
      @keyframes roadmapNodeCompleteBurst {
        0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.65), 0 0 24px rgba(99,102,241,0.5); transform: scale(1); }
        45% { box-shadow: 0 0 0 14px rgba(16,185,129,0), 0 0 48px rgba(52,211,153,0.85); transform: scale(1.18); }
        100% { box-shadow: 0 0 14px rgba(16,185,129,0.35); transform: scale(1); }
      }
      .roadmap-viz-backdrop {
        filter: brightness(0.72) saturate(0.82);
        opacity: 0.62;
        transition: filter 0.35s ease, opacity 0.35s ease;
      }
      @media (max-width: 767px) {
        .roadmap-viz-backdrop { opacity: 0.68; filter: brightness(0.78) saturate(0.88); }
      }
      @keyframes roadmapStatEdgePulse {
        0%, 100% { border-color: rgba(52,211,153,0.22); box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        50% { border-color: rgba(52,211,153,0.42); box-shadow: 0 0 22px rgba(52,211,153,0.12); }
      }
      @keyframes roadmapSocialProofGlow {
        0%, 100% { text-shadow: 0 0 10px rgba(74,222,128,0.25); filter: brightness(1); }
        40% { text-shadow: 0 0 20px rgba(74,222,128,0.65), 0 0 32px rgba(16,185,129,0.35); filter: brightness(1.08); }
      }
      .roadmap-social-proof-line {
        animation: roadmapSocialProofGlow 1.8s ease-in-out infinite;
      }
      .roadmap-stat-social-live {
        transition: border-color 0.4s ease, box-shadow 0.4s ease;
        animation: roadmapStatEdgePulse 2.9s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .roadmap-focus-forward-cta { animation: none !important; }
        .roadmap-social-proof-line { animation: none !important; }
        .roadmap-confetti-piece { animation: none !important; opacity: 0 !important; }
        .roadmap-success-scrim { animation: none !important; opacity: 1 !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
        .roadmap-success-float { animation: none !important; }
        .roadmap-focus-check-success { animation: none !important; }
        .roadmap-screen-ripple span { animation: none !important; opacity: 0 !important; }
        .roadmap-celebrate-bar { animation: none !important; }
        .roadmap-streak-plus { animation: none !important; opacity: 0 !important; }
        .roadmap-stat-social-live { animation: none !important; }
        .roadmap-focus-xp-pill { animation: none !important; opacity: 1 !important; transform: none !important; }
      }
      @keyframes roadmapFocusCtaPulse {
        0%, 100% { box-shadow: 0 0 28px rgba(99,102,241,0.45), 0 0 56px rgba(59,130,246,0.22), 0 4px 24px rgba(0,0,0,0.35); }
        50% { box-shadow: 0 0 40px rgba(129,140,248,0.55), 0 0 72px rgba(16,185,129,0.18), 0 8px 32px rgba(0,0,0,0.28); }
      }
      .roadmap-focus-forward-cta {
        position: relative;
        overflow: hidden;
        transition: transform 0.28s cubic-bezier(0.22,1,0.36,1), box-shadow 0.28s ease, filter 0.28s ease !important;
        animation: roadmapFocusCtaPulse 2.8s ease-in-out infinite !important;
      }
      .roadmap-focus-forward-cta:hover:not(:disabled) {
        transform: scale(1.03) translateY(-2px) !important;
        filter: brightness(1.1) saturate(1.05) !important;
      }
      .roadmap-focus-forward-cta:active:not(:disabled) { transform: scale(0.98) !important; }
      @keyframes roadmapConfettiFall {
        0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
        100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0.3); opacity: 0; }
      }
      .roadmap-focus-confetti-wrap .roadmap-confetti-piece {
        width: 5px;
        height: 7px;
        border-radius: 2px;
        opacity: 0.88;
        animation-duration: 2.05s;
      }
      .roadmap-confetti-piece {
        position: absolute;
        width: 7px;
        height: 11px;
        border-radius: 2px;
        left: 50%;
        top: 38%;
        margin-left: -3px;
        margin-top: -5px;
        pointer-events: none;
        animation: roadmapConfettiFall 1.85s cubic-bezier(0.22, 0.85, 0.32, 1) forwards;
      }
    `;
    document.head.appendChild(el);
  }, []);

  const effectivePlan = (learningPlan || storedPlan || "").trim();
  const effectiveRole = roleType || storedMeta.roleType || "";
  const effectiveSeniority = seniority || storedMeta.seniority || "";
  const actionPlanFixes = useMemo(() => {
    const fixes = analysisData?.ActionPlan?.fixes;
    return Array.isArray(fixes) ? fixes : [];
  }, [analysisData]);
  const progressEngineEnabled = actionPlanFixes.length > 0;
  const fixPlanKey = useMemo(
    () => (progressEngineEnabled ? analysisExecutionFingerprint(cvText, jdText, alignmentScore) : ""),
    [progressEngineEnabled, cvText, jdText, alignmentScore]
  );

  const roadmapSteps = useMemo(
    () =>
      progressEngineEnabled
        ? actionPlanFixes.map((fix, idx) => ({
            id: String(fix?.id || `fix-${idx + 1}`),
            title: String(fix?.issue || (lang === "TR" ? `Düzeltme ${idx + 1}` : `Fix ${idx + 1}`)),
            description: String(fix?.explanation || ""),
            score_impact: Math.max(1, Math.min(18, Math.round(Number(fix?.score_impact) || 0))),
            steps: Array.isArray(fix?.steps) ? fix.steps : [],
          }))
        : effectivePlan
          ? parseLearningRoadmapToSteps(effectivePlan, lang)
          : [],
    [progressEngineEnabled, actionPlanFixes, effectivePlan, lang]
  );

  const taskCatalog = useMemo(() => buildRoadmapTaskCatalog(roadmapSteps, lang), [roadmapSteps, lang]);
  const planKey = useMemo(
    () => planFingerprint(effectivePlan, roadmapSteps.length),
    [effectivePlan, roadmapSteps.length]
  );
  const catalogKey = useMemo(() => taskCatalog.map((x) => x.id).join("\0"), [taskCatalog]);
  const retentionTotal = progressEngineEnabled ? roadmapSteps.length : taskCatalog.length;
  const completedCount = progressEngineEnabled ? fixExecState.completed.filter(Boolean).length : completedTaskIds.length;
  const retentionProgressPercent =
    retentionTotal > 0 ? Math.min(100, Math.round((completedCount / retentionTotal) * 100)) : 0;
  const liveInterviewScore = useMemo(() => {
    const base = Math.max(0, Math.min(100, Math.round(Number(alignmentScore) || 0)));
    if (!progressEngineEnabled) return base;
    let score = base;
    roadmapSteps.forEach((step, idx) => {
      if (fixExecState.completed[idx]) score = Math.min(100, score + (step.score_impact || 0));
    });
    return score;
  }, [alignmentScore, progressEngineEnabled, roadmapSteps, fixExecState.completed]);

  useEffect(() => {
    if (!progressEngineEnabled) {
      setFixExecState({ completed: [], fixProofs: [] });
      return;
    }
    setFixExecState(loadRoadmapFixExecutionState(fixPlanKey, roadmapSteps));
    setProofDrafts({});
  }, [progressEngineEnabled, fixPlanKey, roadmapSteps]);

  const socialProofAheadPct = useMemo(
    () => mockCandidateAheadPercentile(retentionProgressPercent, completedCount),
    [retentionProgressPercent, completedCount]
  );

  useLayoutEffect(() => {
    socialAnimFromRef.current = socialProofAheadPct;
    setDisplaySocialPct(socialProofAheadPct);
  }, [planKey, socialProofAheadPct]);

  useEffect(() => {
    const from = socialAnimFromRef.current;
    const to = socialProofAheadPct;
    if (from === to) return;
    let raf = 0;
    const t0 = performance.now();
    const dur = 920;
    const tick = (now) => {
      const u = Math.min(1, (now - t0) / dur);
      const ease = 1 - (1 - u) ** 2;
      setDisplaySocialPct(Math.round(from + (to - from) * ease));
      if (u < 1) raf = requestAnimationFrame(tick);
      else socialAnimFromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [socialProofAheadPct]);

  useEffect(() => {
    displayPctRef.current = retentionProgressPercent;
    setDisplayRetentionPct(retentionProgressPercent);
  }, [planKey, catalogKey, retentionProgressPercent]);

  useEffect(() => {
    const target = retentionProgressPercent;
    const from = displayPctRef.current;
    if (from === target) return;
    if (pctAnimRaf.current) cancelAnimationFrame(pctAnimRaf.current);
    const t0 = performance.now();
    const dur = 480;
    const tick = (now) => {
      const u = Math.min(1, (now - t0) / dur);
      const ease = 1 - (1 - u) ** 2;
      const v = Math.round(from + (target - from) * ease);
      displayPctRef.current = v;
      setDisplayRetentionPct(v);
      if (u < 1) pctAnimRaf.current = requestAnimationFrame(tick);
      else pctAnimRaf.current = null;
    };
    pctAnimRaf.current = requestAnimationFrame(tick);
    return () => {
      if (pctAnimRaf.current) cancelAnimationFrame(pctAnimRaf.current);
    };
  }, [retentionProgressPercent]);

  const stepDoneByRetention = useMemo(() => {
    if (progressEngineEnabled) {
      const map = new Map();
      roadmapSteps.forEach((_, idx) => {
        map.set(idx, !!fixExecState.completed[idx]);
      });
      return map;
    }
    const done = new Set(completedTaskIds);
    const map = new Map();
    for (let si = 0; si < roadmapSteps.length; si++) {
      const ids = taskCatalog.filter((t) => t.stepIndex === si).map((t) => t.id);
      map.set(si, ids.length > 0 && ids.every((id) => done.has(id)));
    }
    return map;
  }, [progressEngineEnabled, roadmapSteps, fixExecState.completed, taskCatalog, completedTaskIds]);

  const journeyStepIndex = useMemo(() => {
    if (progressEngineEnabled) {
      const firstIncomplete = fixExecState.completed.findIndex((c) => !c);
      return firstIncomplete === -1 ? Math.max(0, roadmapSteps.length - 1) : firstIncomplete;
    }
    if (!roadmapSteps.length || !taskCatalog.length) return 0;
    const done = new Set(completedTaskIds);
    for (let si = 0; si < roadmapSteps.length; si++) {
      const ids = taskCatalog.filter((t) => t.stepIndex === si).map((t) => t.id);
      if (ids.some((id) => !done.has(id))) return si;
    }
    return Math.max(0, roadmapSteps.length - 1);
  }, [progressEngineEnabled, fixExecState.completed, roadmapSteps.length, taskCatalog, completedTaskIds]);

  useEffect(() => {
    if (roadmapSteps.length === 0) return;
    if (prevJourneyStepRef.current !== journeyStepIndex) {
      prevJourneyStepRef.current = journeyStepIndex;
      setRoadmapFocusIndex(journeyStepIndex);
    }
  }, [journeyStepIndex, roadmapSteps.length]);

  useEffect(() => {
    return () => {
      if (pulseClearRef.current) window.clearTimeout(pulseClearRef.current);
    };
  }, []);

  const totalNodes = roadmapSteps.length + 1;

  useEffect(() => {
    setRoadmapFocusIndex(0);
    setRoadmapSelection(null);
    setRoadmapStepExpanded({});
    setRoadmapStepBodyExpanded({});
  }, [effectivePlan]);

  useEffect(() => {
    setStreak(loadRoadmapStreak());
  }, []);

  useEffect(() => {
    if (!planKey || !taskCatalog.length) {
      setCompletedTaskIds([]);
      return;
    }
    const saved = loadRoadmapProgress();
    let ids =
      saved.planKey === planKey ? normalizeCompletedForCatalog(saved.completedTasks, taskCatalog) : [];
    setCompletedTaskIds(ids);
    const pct = taskCatalog.length > 0 ? Math.round((ids.length / taskCatalog.length) * 100) : 0;
    if (saved.planKey !== planKey || ids.join("|") !== saved.completedTasks.join("|")) {
      saveRoadmapProgress({ completedTasks: ids, progress: pct, planKey });
    }
  }, [planKey, catalogKey, taskCatalog]);

  const completedTasksSig = useMemo(() => completedTaskIds.join("|"), [completedTaskIds]);

  useEffect(() => {
    if (!taskCatalog.length) {
      setDailyState(null);
      return;
    }
    const today = todayYMD();
    const doneSet = new Set(completedTaskIds);
    let d = loadRoadmapDaily();
    const validCatalog = d.currentTaskId && taskCatalog.some((t) => t.id === d.currentTaskId);
    if (d.planKey !== planKey) {
      const nextId = pickDailyTask(taskCatalog, doneSet);
      d = { currentTaskId: nextId, date: today, planKey };
      saveRoadmapDaily(d);
    } else if (d.date !== today) {
      const nextId = pickDailyTask(taskCatalog, doneSet);
      d = { ...d, currentTaskId: nextId, date: today };
      saveRoadmapDaily(d);
    } else if (!validCatalog) {
      const nextId = pickDailyTask(taskCatalog, doneSet);
      d = { ...d, currentTaskId: nextId };
      saveRoadmapDaily(d);
    } else if (d.currentTaskId && doneSet.has(d.currentTaskId)) {
      const nextId = pickDailyTask(taskCatalog, doneSet);
      d = { ...d, currentTaskId: nextId };
      saveRoadmapDaily(d);
    }
    setDailyState(d);
  }, [planKey, catalogKey, taskCatalog, completedTaskIds, completedTasksSig]);

  useEffect(() => {
    if (!dailyState?.currentTaskId || !planKey) {
      setFocusJob(null);
      setFocusJobUrlInput("");
      return;
    }
    const j = loadFocusJob();
    if (j && j.planKey === planKey && j.taskId === dailyState.currentTaskId) {
      setFocusJob({ jobTitle: j.jobTitle, jobUrl: j.jobUrl });
      setFocusJobUrlInput(j.jobUrl);
    } else {
      setFocusJob(null);
      setFocusJobUrlInput("");
    }
  }, [planKey, dailyState?.currentTaskId]);

  useLayoutEffect(() => {
    nodeRefs.current = nodeRefs.current.slice(0, totalNodes);
    cardRefs.current = cardRefs.current.slice(0, roadmapSteps.length);
  }, [totalNodes, roadmapSteps.length]);

  const layout = isMobile ? "column" : "row";

  const updatePath = useCallback(() => {
    const inner = mapInnerRef.current;
    if (!inner || totalNodes < 2) {
      setPathD("");
      setYouAreHere((s) => ({ ...s, show: false }));
      return;
    }

    const pts = [];
    for (let i = 0; i < totalNodes; i++) {
      const el = nodeRefs.current[i];
      if (el) pts.push(relCenter(el, inner));
    }
    if (pts.length < 2) {
      setPathD("");
      return;
    }

    const w = inner.offsetWidth;
    const h = inner.offsetHeight;
    setSvgBox({ w: Math.max(w, 400), h: Math.max(h, 200) });

    const d = layout === "row" ? buildSmoothPathHorizontal(pts) : buildSmoothPathVertical(pts);
    setPathD(d);

    const cur = nodeRefs.current[roadmapFocusIndex];
    if (cur && inner) {
      const c = relCenter(cur, inner);
      setYouAreHere({ x: c.x, y: c.y - (layout === "row" ? 36 : 28), show: true });
    } else {
      setYouAreHere((s) => ({ ...s, show: false }));
    }

    setPathRedraw((k) => k + 1);
  }, [layout, totalNodes, roadmapFocusIndex]);

  useLayoutEffect(() => {
    const t0 = requestAnimationFrame(() => {
      requestAnimationFrame(updatePath);
    });
    return () => cancelAnimationFrame(t0);
  }, [updatePath, effectivePlan]);

  useEffect(() => {
    const inner = mapInnerRef.current;
    if (!inner || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => updatePath());
    ro.observe(inner);
    const sr = scrollRef.current;
    if (sr) sr.addEventListener("scroll", updatePath, { passive: true });
    window.addEventListener("resize", updatePath);
    return () => {
      ro.disconnect();
      if (sr) sr.removeEventListener("scroll", updatePath);
      window.removeEventListener("resize", updatePath);
    };
  }, [updatePath]);

  useEffect(() => {
    if (!pathD || !pathRef.current) {
      setPathLength(0);
      return;
    }
    const len = pathRef.current.getTotalLength();
    setPathLength(Number.isFinite(len) ? len : 0);
  }, [pathD, pathRedraw, svgBox.w, svgBox.h]);

  const roleLine = [effectiveRole, effectiveSeniority].filter(Boolean).join(" · ") || (lang === "TR" ? "Hedef rolünüzü üründe belirleyin" : "Set your target role in the product");

  const youLabel = lang === "TR" ? "Buradasınız" : "You are here";
  const nextStepLabel = lang === "TR" ? "SONRAKİ ADIM" : "NEXT STEP";

  const progressAlongPath =
    pathLength > 0 && retentionTotal > 0
      ? pathLength * Math.min(1, completedCount / retentionTotal)
      : pathLength > 0 && totalNodes >= 1
        ? pathLength * Math.min(1, (roadmapFocusIndex + 1) / totalNodes)
        : 0;

  useEffect(() => {
    if (!pathLength) {
      setPathRevealLength(0);
      return;
    }
    setPathRevealLength(0);
    const tid = window.setTimeout(() => {
      setPathRevealLength(progressAlongPath);
    }, 60);
    return () => window.clearTimeout(tid);
  }, [pathLength, progressAlongPath, pathRedraw, completedCount, retentionTotal]);

  const scrollCardIntoView = (el) => {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  const activateStepFromNode = (i) => {
    const key = `step-${i}`;
    setRoadmapFocusIndex(i);
    setRoadmapSelection(key);
    setRoadmapHovered(key);
    requestAnimationFrame(() => scrollCardIntoView(cardRefs.current[i]));
  };

  const activateTargetFromNode = () => {
    setRoadmapSelection("target");
    setRoadmapHovered("target");
    requestAnimationFrame(() => scrollCardIntoView(targetCardRef.current));
  };

  const focusJourneyPercent =
    roadmapSteps.length > 0
      ? Math.min(100, Math.round(((roadmapFocusIndex + 1) / roadmapSteps.length) * 100))
      : 0;
  const progressMilestoneLine =
    roadmapSteps.length > 0
      ? retentionTotal > 0
        ? retentionProgressPercent === 0
          ? lang === "TR"
            ? "Yolculuğuna yeni başladın 🚀"
            : "You just started your journey 🚀"
          : lang === "TR"
            ? `Hedef rolünüze %${retentionProgressPercent} daha yakınsınız.`
            : `You're ${retentionProgressPercent}% closer to your target role.`
        : lang === "TR"
          ? `Hedef rolünüze giden yolda yaklaşık %${focusJourneyPercent} ilerlediniz.`
          : `You're about ${focusJourneyPercent}% of the way to your target role.`
      : "";

  const bumpStepPulse = (stepIdx) => {
    if (stepIdx < 0) return;
    setPulseStepIndex(stepIdx);
    if (pulseClearRef.current) window.clearTimeout(pulseClearRef.current);
    pulseClearRef.current = window.setTimeout(() => setPulseStepIndex(-1), 2200);
  };

  const submitFixProof = (stepIndex) => {
    const proof = String(proofDrafts[stepIndex] ?? fixExecState.fixProofs[stepIndex] ?? "").trim();
    if (!proof) {
      window.alert(lang === "TR" ? "Tamamlamak için kanıt girin." : "Add proof before completing this node.");
      return;
    }
    setFixExecState((prev) => {
      const completed = Array.from({ length: roadmapSteps.length }, (_, i) => !!prev.completed[i]);
      const fixProofs = Array.from({ length: roadmapSteps.length }, (_, i) => String(prev.fixProofs[i] ?? ""));
      completed[stepIndex] = true;
      fixProofs[stepIndex] = proof;
      const next = { completed, fixProofs };
      saveRoadmapFixExecutionState(fixPlanKey, next);
      return next;
    });
    setProofDrafts((prev) => ({ ...prev, [stepIndex]: proof }));
    setRetentionToast(
      (lang === "TR" ? "🔥 +" : "🔥 +") +
        String(roadmapSteps[stepIndex]?.score_impact || 0) +
        (lang === "TR" ? " puan açıldı" : " points unlocked")
    );
    window.setTimeout(() => setRetentionToast(null), 2500);
  };

  const completeDailyTask = async () => {
    if (!dailyState?.currentTaskId || focusTaskSubmitting) return;
    const tid = dailyState.currentTaskId;
    setFocusTaskSubmitting(true);
    setFocusTaskSuccess(false);
    setFocusConfetti(false);
    await new Promise((r) => setTimeout(r, 520));

    const prevPct = retentionTotal > 0 ? Math.min(100, Math.round((completedTaskIds.length / retentionTotal) * 100)) : 0;
    const merged = completedTaskIds.includes(tid) ? completedTaskIds : [...completedTaskIds, tid];
    const pct = retentionTotal > 0 ? Math.min(100, Math.round((merged.length / retentionTotal) * 100)) : 0;
    const aheadNow = mockCandidateAheadPercentile(pct, merged.length);
    const nextStepIdx = computeJourneyStepIndex(roadmapSteps, taskCatalog, merged);
    const taskEntry = taskCatalog.find((x) => x.id === tid);
    const baseMicro = taskEntry?.microLabel || taskEntry?.label || "";
    const effectiveMicro =
      focusJob && taskEntry?.bucket === "apply"
        ? applyJobToFocusMicroLine(baseMicro, focusJob.jobTitle, lang, taskEntry.bucket)
        : baseMicro;
    const taskLineForShare = splitFocusTaskLabel(effectiveMicro).body;
    saveRoadmapProgress({ completedTasks: merged, progress: pct, planKey });
    setCompletedTaskIds(merged);
    const nextId = pickDailyTask(taskCatalog, new Set(merged));
    const today = todayYMD();
    const nextDaily = { currentTaskId: nextId, date: today, planKey };
    saveRoadmapDaily(nextDaily);
    setDailyState(nextDaily);
    const streakBefore = loadRoadmapStreak();
    const st = bumpStreakAfterDailyComplete(streakBefore, today);
    saveRoadmapStreak(st);
    setStreak(st);
    bumpRoadmapXp(planKey, 10);
    setFocusTaskSubmitting(false);
    setFocusTaskSuccess(true);
    setFocusConfetti(true);
    setCompletionRipple(true);
    setSuccessMomentVisible(true);
    setCelebrationBar({ aheadPct: aheadNow, exiting: false });
    window.setTimeout(() => setFocusConfetti(false), 2100);
    window.setTimeout(() => setCompletionRipple(false), 1200);
    window.setTimeout(() => setSuccessMomentVisible(false), 2700);
    window.setTimeout(() => setFocusTaskSuccess(false), 1200);
    window.setTimeout(() => setCelebrationBar((prev) => (prev && !prev.exiting ? { ...prev, exiting: true } : prev)), 3400);
    window.setTimeout(() => setCelebrationBar(null), 3980);
    setFocusCompleteFlash(true);
    window.setTimeout(() => setFocusCompleteFlash(false), 1000);
    setDailyDoneBurst(true);
    window.setTimeout(() => setDailyDoneBurst(false), 1900);
    if (st.count > streakBefore.count) {
      setStreakBumpFlash(true);
      window.setTimeout(() => setStreakBumpFlash(false), 1400);
    }
    if (retentionTotal > 0 && pct > prevPct) {
      setProgressGlowNonce((n) => n + 1);
      setFloatingProgressDelta(
        lang === "TR" ? `+%${pct - prevPct} ilerleme 🚀` : `+${pct - prevPct}% progress 🚀`
      );
      window.setTimeout(() => setFloatingProgressDelta(null), 1800);
    }
    bumpStepPulse(nextStepIdx >= 0 ? nextStepIdx : 0);
    window.setTimeout(() => {
      focusHeroRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 260);
    window.setTimeout(() => {
      if (nextStepIdx >= 0 && cardRefs.current[nextStepIdx]) {
        scrollCardIntoView(cardRefs.current[nextStepIdx]);
      }
    }, 620);
    window.setTimeout(() => {
      setGrowthShareSnapshot({
        taskLabel: taskLineForShare,
        progressPct: pct,
        streakDays: st.count,
      });
      setShareModalMode("growth");
      setShareModalOpen(true);
    }, 2750);
  };

  const buildShareBlurb = () =>
    buildRetentionSharePost({
      progressPct: retentionTotal > 0 ? retentionProgressPercent : focusJourneyPercent,
      role: effectiveRole,
      seniority: effectiveSeniority,
      steps: roadmapSteps,
      lang,
    });

  const handleCopyLinkedInPost = async () => {
    const text = buildShareBlurb();
    try {
      await navigator.clipboard.writeText(text);
      setShareFeedback("linkedin");
      window.setTimeout(() => setShareFeedback(null), 2600);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareRoadmapCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildShareBlurb());
      setShareFeedback("sharecopy");
      window.setTimeout(() => setShareFeedback(null), 2600);
    } catch (e) {
      console.error(e);
    }
  };

  const buildGrowthShareText = () => {
    if (!growthShareSnapshot) return "";
    return buildTaskCompletionSharePost({
      taskLabel: growthShareSnapshot.taskLabel,
      progressPct: growthShareSnapshot.progressPct,
      streakDays: growthShareSnapshot.streakDays,
      role: effectiveRole,
      seniority: effectiveSeniority,
      lang,
    });
  };

  const handleGrowthLinkedIn = async () => {
    try {
      await navigator.clipboard.writeText(buildGrowthShareText());
      openLinkedInShare();
      setShareFeedback("linkedin");
      window.setTimeout(() => setShareFeedback(null), 2600);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGrowthCopyPost = async () => {
    try {
      await navigator.clipboard.writeText(buildGrowthShareText());
      setRetentionToast(lang === "TR" ? "Kopyalandı 🚀 — şimdi paylaş" : "Copied 🚀 — share your progress now");
      window.setTimeout(() => setRetentionToast(null), 3200);
      setShareFeedback("growthcopy");
      window.setTimeout(() => setShareFeedback(null), 2600);
    } catch (e) {
      console.error(e);
    }
  };

  const closeShareModal = () => {
    setShareModalOpen(false);
    setShareModalMode("export");
    setGrowthShareSnapshot(null);
    setShareFeedback(null);
  };

  const openExportShareModal = () => {
    setShareModalMode("export");
    setGrowthShareSnapshot(null);
    setShareModalOpen(true);
  };

  useEffect(() => {
    if (!shareModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeShareModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareModalOpen]);

  const openLinkedInShare = () => {
    if (typeof window === "undefined") return;
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const renderNodeMarker = (i, stepKey, isDone, isJourneyCurrent, isFutureJourney, isHovered, pulseComplete) => {
    const dot = {
      width: 22,
      height: 22,
      borderRadius: "50%",
      flexShrink: 0,
      transition: "transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease",
      transform: isHovered ? "scale(1.1)" : "scale(1)",
      border: "2px solid rgba(255,255,255,0.25)",
    };
    if (isDone) {
      Object.assign(dot, {
        background: "linear-gradient(135deg, #10b981, #059669)",
        opacity: 0.78,
        boxShadow: isHovered ? "0 0 20px rgba(16,185,129,0.45), 0 0 32px rgba(16,185,129,0.22)" : "0 0 8px rgba(16,185,129,0.22)",
      });
    } else if (isJourneyCurrent) {
      Object.assign(dot, {
        background: "linear-gradient(135deg, #3b82f6, #6366f1)",
        animation: pulseComplete
          ? "roadmapNodeCompleteBurst 1.05s ease-out 1, roadmapActiveNodePulse 2.2s ease-in-out 1.1s infinite"
          : "roadmapActiveNodePulse 2.2s ease-in-out infinite",
      });
    } else {
      Object.assign(dot, {
        background: "rgba(71,85,105,0.6)",
        opacity: isFutureJourney && !isDone ? 0.42 : 1,
        boxShadow: isHovered ? "0 0 28px rgba(148,163,184,0.65), 0 0 40px rgba(100,116,139,0.3)" : "none",
      });
    }
    const stepTitle = roadmapSteps[i]?.title || (lang === "TR" ? `Adım ${i + 1}` : `Step ${i + 1}`);
    return (
      <button
        type="button"
        aria-label={lang === "TR" ? `${stepTitle} — karta git` : `${stepTitle} — go to card`}
        onClick={(e) => {
          e.stopPropagation();
          activateStepFromNode(i);
        }}
        onMouseEnter={() => setRoadmapHovered(stepKey)}
        onMouseLeave={() => setRoadmapHovered((h) => (h === stepKey ? null : h))}
        style={{
          width: 40,
          height: 40,
          display: "grid",
          placeItems: "center",
          padding: 0,
          margin: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          opacity: 0,
          animation: "roadmapNodeEnter 0.5s cubic-bezier(0.34,1.2,0.64,1) forwards",
          animationDelay: `${i * 0.06}s`,
          transform: isJourneyCurrent && isHovered ? "scale(1.08)" : "scale(1)",
          transition: "transform 0.22s ease",
          filter: isJourneyCurrent && isHovered ? "brightness(1.12) drop-shadow(0 0 16px rgba(99,102,241,0.85))" : "none",
        }}
      >
        <div
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          style={{ ...dot, position: "relative", display: "grid", placeItems: "center" }}
        >
          {isDone ? (
            <Check
              size={12}
              color="#ffffff"
              strokeWidth={3}
              aria-hidden
              style={{ pointerEvents: "none", opacity: 0.95 }}
            />
          ) : null}
        </div>
      </button>
    );
  };

  const renderStepCard = (step, i, rowLayout) => {
    const stepKey = `step-${i}`;
    const retDone = Boolean(stepDoneByRetention.get(i));
    const isDone = retDone;
    const isFocused = i === roadmapFocusIndex;
    const isJourneyCurrent = i === journeyStepIndex;
    const pastJourney = i < journeyStepIndex;
    const futureJourney = i > journeyStepIndex;
    const isHovered = roadmapHovered === stepKey || roadmapSelection === stepKey;
    const isExpanded = Boolean(roadmapStepExpanded[i]);
    const firstIncomplete = progressEngineEnabled ? fixExecState.completed.findIndex((c) => !c) : -1;
    const isCompletedNode = progressEngineEnabled ? !!fixExecState.completed[i] : isDone;
    const isActiveNode =
      progressEngineEnabled &&
      !isCompletedNode &&
      (i === firstIncomplete || (firstIncomplete >= 0 && i === firstIncomplete + 1));
    const isLockedNode = progressEngineEnabled && !isCompletedNode && !isActiveNode;
    const statusIcon = isCompletedNode ? "✅" : isActiveNode ? "🔓" : "🔒";
    const statusLabel = isCompletedNode
      ? lang === "TR"
        ? "Tamamlandı"
        : "Completed"
      : isActiveNode
        ? lang === "TR"
          ? "Aktif"
          : "Active"
        : lang === "TR"
          ? "Kilitli"
          : "Locked";
    const borderColor = isJourneyCurrent
      ? "rgba(199,210,254,0.98)"
      : isDone
        ? "rgba(16,185,129,0.45)"
        : "rgba(148,163,184,0.25)";
    const bg = isDone ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.03)";
    const glow = isJourneyCurrent
      ? "0 0 0 2px rgba(199,210,254,0.75), 0 0 60px rgba(99,102,241,0.62), 0 0 120px rgba(59,130,246,0.35), 0 16px 48px rgba(0,0,0,0.4)"
      : "none";
    const widthStyle = rowLayout ? { width: 268, maxWidth: 268 } : { width: "100%", maxWidth: "100%" };
    const parsed = parseRoadmapStepDescription(step.description);
    const sec = lang === "TR"
      ? { resource: "KAYNAK", time: "SÜRE", description: "AÇIKLAMA" }
      : { resource: "RESOURCE", time: "TIME", description: "DESCRIPTION" };
    const showMoreLabel = lang === "TR" ? "Daha fazla" : "Show more";
    const showLessLabel = lang === "TR" ? "Daha az" : "Show less";
    const stepBodyOpen =
      roadmapStepBodyExpanded[i] !== undefined ? roadmapStepBodyExpanded[i] : i === journeyStepIndex;
    const learnPreview =
      taskCatalog.find((c) => c.stepIndex === i && c.bucket === "learn")?.microLabel || "";
    const hasStructured = Boolean(
      parsed.resource || parsed.hours || parsed.description || parsed.tasks.length
    );

    const descTrunc = parsed.description
      ? truncateChars(parsed.description, ROADMAP_DESC_CHAR_LIMIT)
      : { shown: "", truncated: false };
    const descShown = isExpanded || !descTrunc.truncated ? parsed.description || "" : descTrunc.shown;
    const rawClean = (step.description || "").replace(/\*\*/g, "").trim();
    const rawTrunc = rawClean ? truncateChars(rawClean, ROADMAP_RAW_CHAR_LIMIT) : { shown: "", truncated: false };
    const rawShown = isExpanded || !rawTrunc.truncated ? rawClean : rawTrunc.shown;
    const canToggle =
      Boolean(step.description) && (hasStructured ? descTrunc.truncated : rawTrunc.truncated);

    const sectionGap = { marginBottom: 22 };
    const sectionLabel = {
      fontSize: 11,
      opacity: 0.55,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      fontWeight: 600,
      fontFamily: "'DM Sans', sans-serif",
      color: "#64748b",
      marginBottom: 8,
    };
    const sectionValue = {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.85,
      color: futureJourney && !isFocused ? "#94a3b8" : "#cbd5e1",
      fontFamily: "'DM Sans', sans-serif",
    };

    const lpaKindsMeta = [
      { kind: "learn", tag: lang === "TR" ? "Öğren" : "Learn" },
      { kind: "practice", tag: lang === "TR" ? "Pratik" : "Practice" },
      { kind: "apply", tag: lang === "TR" ? "Uygula" : "Apply" },
    ];
    const lpaReadonlyBlock = progressEngineEnabled ? (
      <div style={sectionGap} onClick={(e) => e.stopPropagation()}>
        <div style={sectionLabel}>{lang === "TR" ? "AKSİYON ADIMLARI" : "ACTION STEPS"}</div>
        {(Array.isArray(step.steps) ? step.steps : []).map((line, idx) => (
          <div
            key={`fix-step-${i}-${idx}`}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              marginBottom: idx === step.steps.length - 1 ? 0 : 8,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(99,102,241,0.14)",
              background: "rgba(255,255,255,0.02)",
              opacity: isLockedNode ? 0.45 : 1,
            }}
          >
            <span style={{ color: "#818cf8", fontWeight: 800, fontSize: 12 }}>{idx + 1}.</span>
            <span style={{ ...sectionValue, fontSize: 12 }}>{String(line || "").trim()}</span>
          </div>
        ))}
      </div>
    ) : (
      <div style={sectionGap} onClick={(e) => e.stopPropagation()}>
        <div style={sectionLabel}>{lang === "TR" ? "ÖĞREN · PRATİK · UYGULA" : "LEARN · PRACTICE · APPLY"}</div>
        {lpaKindsMeta.map(({ kind, tag }) => {
          const lid = `lpa-${i}-${kind}`;
          const ldone = completedTaskIds.includes(lid);
          const line = taskCatalog.find((c) => c.id === lid)?.microLabel || "";
          return (
            <div
              key={lid}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                marginBottom: kind === "apply" ? 0 : 8,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(99,102,241,0.14)",
                background: ldone ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.02)",
                opacity: ldone ? 0.45 : isJourneyCurrent ? 1 : 0.38,
                transition: "opacity 0.25s ease",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  flexShrink: 0,
                  marginTop: 2,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  border: ldone ? "2px solid #10b981" : "2px solid rgba(129,140,248,0.4)",
                  background: ldone ? "rgba(16,185,129,0.15)" : "transparent",
                  color: ldone ? "#34d399" : "transparent",
                }}
              >
                {ldone ? "✓" : ""}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    color: "#818cf8",
                    marginBottom: 4,
                  }}
                >
                  {tag}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: 1.45,
                    color: ldone ? "#86efac" : "#e2e8f0",
                    textDecoration: ldone ? "line-through" : "none",
                  }}
                >
                  {line}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );

    const focusDim = isJourneyCurrent
      ? { opacity: 1, filter: "none" }
      : {
          opacity: pastJourney ? 0.14 : futureJourney ? 0.15 : 0.17,
          filter: futureJourney ? "blur(1.05px)" : pastJourney ? "blur(0.55px)" : "blur(0.62px)",
        };

    return (
      <div
        key={`col-${i}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          flexShrink: 0,
          width: rowLayout ? 268 : "100%",
        }}
      >
        {renderNodeMarker(i, stepKey, isDone, isJourneyCurrent, futureJourney, isHovered, pulseStepIndex === i)}
        <div
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          style={{
            ...widthStyle,
            ...focusDim,
            transform: isJourneyCurrent ? "scale(1.09)" : "scale(1)",
            transformOrigin: "center top",
            transition:
              "opacity 0.3s ease, filter 0.3s ease, transform 0.32s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (isLockedNode) return;
              setRoadmapFocusIndex(i);
              setRoadmapSelection(stepKey);
              scrollCardIntoView(cardRefs.current[i]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (isLockedNode) return;
                setRoadmapFocusIndex(i);
                setRoadmapSelection(stepKey);
                scrollCardIntoView(cardRefs.current[i]);
              }
            }}
          onMouseEnter={() => setRoadmapHovered(stepKey)}
          onMouseLeave={() => setRoadmapHovered((h) => (h === stepKey ? null : h))}
            style={{
              position: "relative",
              opacity: 0,
              animation: `roadmapCardEnter 0.62s cubic-bezier(0.22,1,0.36,1) forwards`,
              animationDelay: `${i * 0.07 + 0.12}s`,
              transform: isHovered ? "translateY(-8px) scale(1.02)" : "translateY(0) scale(1)",
              transition: "transform 0.22s ease, box-shadow 0.25s ease, border-color 0.25s ease",
              width: "100%",
              padding: "24px 22px",
              borderRadius: 16,
              background: bg,
              border: `1px solid ${borderColor}`,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              cursor: isLockedNode ? "not-allowed" : "pointer",
              boxShadow: isHovered
                ? "0 12px 32px rgba(0,0,0,0.45)"
                : isJourneyCurrent
                  ? glow
                  : "0 4px 20px rgba(0,0,0,0.2)",
            }}
          >
          {isJourneyCurrent ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -11,
                transform: "translateX(-50%)",
                zIndex: 2,
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.12em",
                fontFamily: "'DM Sans', sans-serif",
                color: "#e0e7ff",
                background: "linear-gradient(135deg, rgba(79,70,229,0.95), rgba(59,130,246,0.92))",
                border: "1px solid rgba(165,180,252,0.55)",
                animation: "roadmapNextBadgePulse 2.4s ease-in-out infinite",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              {nextStepLabel}
            </div>
          ) : null}
          <div
            style={{
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              color: futureJourney && !isFocused ? "#94a3b8" : "#f1f5f9",
              marginBottom: 14,
              lineHeight: 1.45,
            }}
          >
            {step.title || (lang === "TR" ? "Adım" : "Step")}
          </div>
          {progressEngineEnabled ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: isCompletedNode ? "#86efac" : isActiveNode ? "#93c5fd" : "#94a3b8" }}>
                {statusIcon} {statusLabel}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#0f172a",
                  borderRadius: 999,
                  padding: "5px 10px",
                  background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                }}
              >
                +{step.score_impact || 0}
              </div>
            </div>
          ) : null}
          {!stepBodyOpen ? (
            <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 2 }}>
              <p
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  margin: "0 0 10px",
                  lineHeight: 1.45,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {learnPreview ||
                  (lang === "TR"
                    ? "Öğren · pratik · uygula görevlerini görmek için açın."
                    : "Open to see learn · practice · apply tasks.")}
              </p>
              <button
                type="button"
                className="hf-btn-ghost roadmap-micro-cta-hover"
                onClick={(e) => {
                  e.stopPropagation();
                  setRoadmapStepBodyExpanded((prev) => ({ ...prev, [i]: true }));
                }}
                style={{
                  fontSize: 11,
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <ChevronDown size={14} aria-hidden />
                {lang === "TR" ? "Görevleri göster" : "Show tasks"}
              </button>
            </div>
          ) : (
            <>
          {step.description ? (
            hasStructured ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {parsed.resource ? (
                  <div style={sectionGap}>
                    <div style={sectionLabel}>{sec.resource}</div>
                    <div style={sectionValue}>{parsed.resource}</div>
                  </div>
                ) : null}
                {parsed.hours ? (
                  <div style={sectionGap}>
                    <div style={sectionLabel}>{sec.time}</div>
                    <div style={sectionValue}>{parsed.hours}</div>
                  </div>
                ) : null}
                {parsed.description ? (
                  <div style={sectionGap}>
                    <div style={sectionLabel}>{sec.description}</div>
                    <div
                      style={{
                        ...sectionValue,
                        fontWeight: 500,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {descShown}
                    </div>
                  </div>
                ) : null}
                {lpaReadonlyBlock}
                {canToggle ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRoadmapStepExpanded((prev) => ({ ...prev, [i]: !prev[i] }));
                    }}
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 4,
                      marginBottom: 4,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(99,102,241,0.35)",
                      background: "rgba(99,102,241,0.12)",
                      color: "#c7d2fe",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {isExpanded ? showLessLabel : showMoreLabel}
                  </button>
                ) : null}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {lpaReadonlyBlock}
                <div style={sectionGap}>
                  <div style={sectionLabel}>{sec.description}</div>
                  <div
                    style={{
                      ...sectionValue,
                      fontWeight: 500,
                      whiteSpace: "pre-wrap",
                      textDecoration: retDone ? "line-through" : "none",
                      opacity: retDone ? 0.65 : 1,
                    }}
                  >
                    {rawShown}
                  </div>
                </div>
                {canToggle ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRoadmapStepExpanded((prev) => ({ ...prev, [i]: !prev[i] }));
                    }}
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 4,
                      marginBottom: 4,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(99,102,241,0.35)",
                      background: "rgba(99,102,241,0.12)",
                      color: "#c7d2fe",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {isExpanded ? showLessLabel : showMoreLabel}
                  </button>
                ) : null}
              </div>
            )
          ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {lpaReadonlyBlock}
              </div>
            )}
              <button
                type="button"
                className="hf-btn-ghost roadmap-micro-cta-hover"
                onClick={(e) => {
                  e.stopPropagation();
                  setRoadmapStepBodyExpanded((prev) => ({ ...prev, [i]: false }));
                }}
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  alignSelf: "flex-start",
                  fontFamily: "'DM Sans', sans-serif",
                  color: "#94a3b8",
                }}
              >
                <ChevronUp size={14} aria-hidden />
                {lang === "TR" ? "Adımı daralt" : "Hide step details"}
              </button>
              {progressEngineEnabled ? (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 14 }}>
                  <div style={{ ...sectionLabel, marginBottom: 6 }}>{lang === "TR" ? "KANIT" : "PROOF"}</div>
                  <input
                    type="text"
                    value={String(proofDrafts[i] ?? fixExecState.fixProofs[i] ?? "")}
                    disabled={isLockedNode || isCompletedNode}
                    onChange={(e) => setProofDrafts((prev) => ({ ...prev, [i]: e.target.value }))}
                    placeholder={lang === "TR" ? "Link veya kısa kanıt girin…" : "Paste link or proof…"}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(148,163,184,0.28)",
                      background: "rgba(15,23,42,0.62)",
                      color: "#e2e8f0",
                      fontSize: 12,
                      marginBottom: 10,
                      opacity: isLockedNode ? 0.55 : 1,
                    }}
                  />
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10, lineHeight: 1.45 }}>
                    {lang === "TR"
                      ? `Tamamlarsan skor: ${liveInterviewScore} → ${Math.min(100, liveInterviewScore + (step.score_impact || 0))} (+${step.score_impact || 0})`
                      : `Complete this → your score: ${liveInterviewScore} → ${Math.min(100, liveInterviewScore + (step.score_impact || 0))} (+${step.score_impact || 0})`}
                  </div>
                  <button
                    type="button"
                    disabled={isLockedNode || isCompletedNode}
                    onClick={() => submitFixProof(i)}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 8,
                      border: "none",
                      cursor: isLockedNode || isCompletedNode ? "not-allowed" : "pointer",
                      fontWeight: 800,
                      fontSize: 12,
                      color: "#0f172a",
                      background: isLockedNode || isCompletedNode ? "rgba(148,163,184,0.35)" : "linear-gradient(135deg, #34d399, #22c55e)",
                    }}
                  >
                    {isCompletedNode
                      ? lang === "TR"
                        ? "Tamamlandı"
                        : "Completed"
                      : lang === "TR"
                        ? "Kanıt Gönder"
                        : "Submit Proof"}
                  </button>
                </div>
              ) : null}
            </>
          )}
          </div>
        </div>
      </div>
    );
  };

  const renderTargetColumn = (rowLayout, animBase) => {
    const ti = roadmapSteps.length;
    const isHovered = roadmapHovered === "target" || roadmapSelection === "target";
    const targetNodeLabel = lang === "TR" ? "🎯 Hedef rol" : "🎯 Target Role";
    const targetMuted = retentionTotal > 0 && retentionProgressPercent < 100;
    return (
      <div
        key="target-col"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
          width: rowLayout ? 280 : "100%",
        }}
      >
        <button
          type="button"
          aria-label={lang === "TR" ? "Hedef role git" : "Go to target role card"}
          onClick={(e) => {
            e.stopPropagation();
            activateTargetFromNode();
          }}
          onMouseEnter={() => setRoadmapHovered("target")}
          onMouseLeave={() => setRoadmapHovered((h) => (h === "target" ? null : h))}
          style={{
            width: 64,
            minHeight: 72,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 8,
            padding: 0,
            margin: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            opacity: 0,
            animation: "roadmapNodeEnter 0.5s cubic-bezier(0.34,1.2,0.64,1) forwards",
            animationDelay: `${ti * 0.06}s`,
            transform: isHovered ? "scale(1.08)" : "scale(1)",
            transition: "transform 0.22s ease, opacity 0.35s ease, filter 0.35s ease",
            filter: isHovered ? "brightness(1.1) drop-shadow(0 0 14px rgba(250,204,21,0.45))" : targetMuted ? "blur(0.5px)" : "none",
          }}
        >
          <div
            ref={(el) => {
              nodeRefs.current[ti] = el;
            }}
            className="roadmap-target-node-ring"
            style={targetMuted ? { opacity: 0.35 } : undefined}
          >
            <div className="roadmap-target-node-core" />
          </div>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#fde68a",
              fontFamily: "'DM Sans', sans-serif",
              textAlign: "center",
              lineHeight: 1.25,
              maxWidth: 88,
              textShadow: "0 0 12px rgba(250,204,21,0.35)",
            }}
          >
            {targetNodeLabel}
          </span>
        </button>
        <div
          style={{
            width: rowLayout ? 280 : "100%",
            opacity: targetMuted ? 0.18 : 1,
            filter: targetMuted ? "blur(1px)" : "none",
            transition: "opacity 0.35s ease, filter 0.35s ease",
          }}
        >
        <div
          ref={targetCardRef}
          onMouseEnter={() => setRoadmapHovered("target")}
          onMouseLeave={() => setRoadmapHovered((h) => (h === "target" ? null : h))}
          style={{
            opacity: 0,
            animation: `roadmapCardEnter 0.62s cubic-bezier(0.22,1,0.36,1) forwards`,
            animationDelay: `${animBase + 0.12}s`,
            transform: isHovered ? "translateY(-8px)" : "translateY(0)",
            transition: "transform 0.22s ease, box-shadow 0.25s ease",
            width: "100%",
            padding: 22,
            borderRadius: 18,
            background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(59,130,246,0.26), rgba(99,102,241,0.16))",
            border: "1px solid rgba(129,140,248,0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: isHovered ? "0 14px 40px rgba(0,0,0,0.5), 0 0 48px rgba(99,102,241,0.3)" : "0 0 36px rgba(99,102,241,0.25), inset 0 0 14px rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 6, lineHeight: 1, filter: "drop-shadow(0 0 8px rgba(250,204,21,0.5))" }}>★</div>
          <div style={{ fontWeight: 800, fontFamily: "'DM Sans', sans-serif", fontSize: 17, color: "#f8fafc", marginBottom: 8, letterSpacing: "0.06em" }}>
            {lang === "TR" ? "HEDEF ROL" : "TARGET ROLE"}
          </div>
          <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
            {effectiveRole || (lang === "TR" ? "Hedeflediğiniz rol ve seviye" : "Your target role and seniority")}
            {effectiveSeniority ? ` · ${effectiveSeniority}` : ""}
          </div>
        </div>
        </div>
      </div>
    );
  };

  const downloadLabel = lang === "TR" ? "Yol Haritasını İndir" : "Download Roadmap";
  const exportKicker = lang === "TR" ? "Kariyer yol haritası" : "Career roadmap";
  const exportWatermark = lang === "TR" ? "HireFit AI tarafından oluşturuldu" : "Generated by HireFit AI";
  const exportRoleHeadline =
    [effectiveRole, effectiveSeniority].filter(Boolean).join(" · ") ||
    (lang === "TR" ? "Hedef rol" : "Target role");

  const bottomApplyLabel = useMemo(() => {
    if (!effectivePlan) {
      return lang === "TR" ? "Analiz ile başla →" : "Start with analysis →";
    }
    if (retentionProgressPercent < 20) {
      return lang === "TR" ? "Tutarlı kal → ivme kazan" : "Stay Consistent → Build Momentum";
    }
    return lang === "TR" ? "Özgüvenle başvurmaya başla →" : "Start Applying with Confidence →";
  }, [effectivePlan, retentionProgressPercent, lang]);

  const nextTaskPreview = useMemo(() => {
    if (!dailyState?.currentTaskId || !taskCatalog.length) return "";
    const nextId = pickDailyTask(taskCatalog, new Set([...completedTaskIds, dailyState.currentTaskId]));
    if (!nextId) return "";
    const e = taskCatalog.find((x) => x.id === nextId);
    const raw = e?.microLabel || e?.label || "";
    const { body } = splitFocusTaskLabel(raw);
    const t = body.trim();
    if (t.length > 76) return `${t.slice(0, 74)}…`;
    return t;
  }, [dailyState?.currentTaskId, completedTaskIds, taskCatalog]);

  const attachFocusJob = () => {
    const href = normalizeJobUrlInput(focusJobUrlInput);
    if (!href || !dailyState?.currentTaskId) return;
    const title = deriveJobTitleFromUrl(href);
    const payload = { jobTitle: title, jobUrl: href };
    setFocusJob(payload);
    saveFocusJob({
      planKey,
      taskId: dailyState.currentTaskId,
      jobTitle: title,
      jobUrl: href,
    });
  };

  const clearFocusJobAttach = () => {
    clearFocusJob();
    setFocusJob(null);
    setFocusJobUrlInput("");
  };

  const buildExportSvgString = () => {
    const inner = mapInnerRef.current;
    if (!inner || !pathD || pathLength <= 0 || totalNodes < 2) return "";

    const contentW = Math.max(1, Math.ceil(svgBox.w));
    const contentH = Math.max(1, Math.ceil(svgBox.h));
    const showExportIdentity = retentionTotal > 0;
    const headerH =
      78 + (showExportIdentity ? 24 : 0) + (progressMilestoneLine ? 28 : 0);
    const footerH = 46;
    const totalW = contentW;
    const totalH = headerH + contentH + footerH;

    const exportPathReveal =
      pathLength > 0 && retentionTotal > 0
        ? pathLength * Math.min(1, completedCount / retentionTotal)
        : pathRevealLength;

    const doneSet = new Set(completedTaskIds);
    const stepExportDone = (si) => {
      const ids = taskCatalog.filter((t) => t.stepIndex === si).map((t) => t.id);
      return ids.length > 0 && ids.every((id) => doneSet.has(id));
    };

    const relInner = (el) => {
      if (!el) return null;
      const ir = inner.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      return { x: er.left - ir.left, y: er.top - ir.top, w: er.width, h: er.height };
    };

    const nodes = [];
    for (let i = 0; i < totalNodes; i++) {
      const el = nodeRefs.current[i];
      if (!el) continue;
      const c = relCenter(el, inner);
      const isTarget = i === roadmapSteps.length;
      const isDone = stepExportDone(i);
      const isCurrent = i === roadmapFocusIndex;
      if (isTarget) {
        nodes.push({
          cx: c.x,
          cy: c.y,
          r: 18,
          fill: "url(#hirefit-target-fill)",
          stroke: "#fbbf24",
          sw: 2.5,
          nodeFilter: "hirefit-glow-target",
        });
      } else if (isDone) {
        nodes.push({
          cx: c.x,
          cy: c.y,
          r: 11,
          fill: "#10b981",
          stroke: "rgba(255,255,255,0.35)",
          sw: 2,
          nodeFilter: "hirefit-glow-green",
        });
      } else if (isCurrent) {
        nodes.push({
          cx: c.x,
          cy: c.y,
          r: 12,
          fill: "url(#hirefit-node-current-fill)",
          stroke: "#c4b5fd",
          sw: 2.5,
          nodeFilter: "glow",
        });
      } else {
        nodes.push({
          cx: c.x,
          cy: c.y,
          r: 10,
          fill: "#475569",
          stroke: "rgba(255,255,255,0.22)",
          sw: 2,
          nodeFilter: "hirefit-glow-muted",
        });
      }
    }

    const cards = [];
    roadmapSteps.forEach((step, i) => {
      const r = relInner(cardRefs.current[i]);
      if (!r) return;
      const isCurrent = i === roadmapFocusIndex;
      const isDone = stepExportDone(i);
      cards.push({
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        title: step.title || (lang === "TR" ? `Adım ${i + 1}` : `Step ${i + 1}`),
        fill: "rgba(15,23,42,0.94)",
        stroke: isCurrent
          ? "rgba(199,210,254,0.92)"
          : isDone
            ? "rgba(16,185,129,0.5)"
            : "rgba(100,116,139,0.5)",
        cardFilterId: isCurrent ? "hirefit-card-glow-current" : isDone ? "hirefit-card-glow-done" : "hirefit-card-shadow",
      });
    });
    const tr = relInner(targetCardRef.current);
    if (tr) {
      cards.push({
        x: tr.x,
        y: tr.y,
        w: tr.w,
        h: tr.h,
        title:
          [effectiveRole, effectiveSeniority].filter(Boolean).join(" · ") ||
          (lang === "TR" ? "Hedef rol" : "Target role"),
        fill: "rgba(30,27,64,0.94)",
        stroke: "rgba(167,139,250,0.75)",
        cardFilterId: "hirefit-card-glow-target-card",
      });
    }

    let youH = null;
    if (youAreHere.show) {
      const anchor = inner.querySelector(".roadmap-you-here-anchor");
      const pill = anchor?.children?.[1];
      if (pill instanceof HTMLElement) {
        const ir = inner.getBoundingClientRect();
        const pr = pill.getBoundingClientRect();
        youH = {
          pillX: pr.left - ir.left,
          pillY: pr.top - ir.top,
          pillW: pr.width,
          pillH: pr.height,
          tx: pr.left - ir.left + pr.width / 2,
          ty: pr.top - ir.top + Math.min(20, pr.height * 0.55),
        };
      }
    }

    return serializeHirefitRoadmapSvg({
      totalW,
      totalH,
      headerH,
      pathD,
      pathLength,
      pathRevealLength: exportPathReveal,
      nodes,
      cards,
      youAreHere: youH,
      youLabel,
      kicker: exportKicker,
      headline: exportRoleHeadline,
      progressLine: progressMilestoneLine || "",
      identityLine: showExportIdentity
        ? lang === "TR"
          ? `${exportRoleHeadline} · %${retentionProgressPercent}`
          : `${exportRoleHeadline} · ${retentionProgressPercent}%`
        : "",
      mapWatermark: "HireFit AI",
      footerBrand: "HireFit AI",
      footerWatermark: exportWatermark,
    });
  };

  const performSvgExport = async () => {
    setDownloading(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const source = buildExportSvgString();
      if (!source) return;
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "hirefit-roadmap.svg";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const performPngExportFromSvg = async () => {
    setDownloading(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const source = buildExportSvgString();
      if (!source) return;
      const blob = await rasterizeSvgStringToPngBlob(source, 4);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "hirefit-roadmap.png";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const handleModalDownloadSvg = async () => {
    await performSvgExport();
    setShareFeedback("svg");
    window.setTimeout(() => setShareFeedback(null), 2600);
  };

  const handleModalDownloadPng = async () => {
    await performPngExportFromSvg();
    setShareFeedback("png");
    window.setTimeout(() => setShareFeedback(null), 2600);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px 56px", minHeight: "calc(100vh - 80px)" }}>
      <header style={{ marginBottom: isMobile ? 22 : 28, textAlign: isMobile ? "left" : "center" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#f1f5f9", marginBottom: 8 }}>
          {t.careerJourneyTitle}
        </h1>
        <p style={{ fontSize: "clamp(15px, 2vw, 18px)", fontWeight: 600, color: "#93c5fd", marginBottom: isMobile ? 0 : 10, fontFamily: "'DM Sans', sans-serif" }}>{roleLine}</p>
        {!isMobile ? (
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65, maxWidth: 560, margin: "0 auto", fontFamily: "'DM Sans', sans-serif" }}>{t.careerJourneyBlurb}</p>
        ) : null}
      </header>

      {effectivePlan ? (
        <>
        <section
          ref={focusHeroRef}
          style={{
            maxWidth: 720,
            width: "100%",
            margin: "0 auto 32px",
            padding: isMobile ? "0 4px" : "0 16px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#64748b",
              fontFamily: "'DM Sans', sans-serif",
              margin: "0 0 16px",
            }}
          >
            {lang === "TR" ? "ŞİMDİ NE YAPMALISIN?" : "WHAT SHOULD YOU DO RIGHT NOW?"}
          </p>
          {taskCatalog.length && dailyState ? (
            dailyState.currentTaskId ? (
              <div
                className={dailyDoneBurst ? "roadmap-today-focus-complete" : undefined}
                style={{
                  position: "relative",
                  marginBottom: retentionTotal > 0 ? 20 : 0,
                  padding: celebrationBar
                    ? "clamp(48px, 7vw, 58px) clamp(22px, 4vw, 38px) clamp(28px, 5vw, 42px)"
                    : "clamp(28px, 5vw, 42px) clamp(22px, 4vw, 38px)",
                  borderRadius: 22,
                  background:
                    "radial-gradient(ellipse 120% 90% at 50% -30%, rgba(99,102,241,0.45), transparent 50%), linear-gradient(168deg, rgba(15,23,42,0.97), rgba(30,27,75,0.92))",
                  border: "1px solid rgba(186,198,255,0.45)",
                  boxShadow:
                    "0 0 0 1px rgba(99,102,241,0.2), 0 28px 90px rgba(0,0,0,0.55), 0 0 100px rgba(99,102,241,0.18)",
                  transition: "transform 0.28s ease, box-shadow 0.28s ease",
                }}
              >
                {celebrationBar ? (
                  <div
                    className={`roadmap-focus-xp-pill${celebrationBar.exiting ? " roadmap-focus-xp-pill-exit" : ""}`}
                    aria-hidden
                  >
                    <div className="roadmap-focus-xp-pill-line1">
                      {lang === "TR" ? "+10 XP kazandın" : "+10 XP earned"}
                    </div>
                    <div className="roadmap-focus-xp-pill-line2">
                      {lang === "TR"
                        ? `Artık adayların %${celebrationBar.aheadPct}'inden öndesin`
                        : `You're ahead of ${celebrationBar.aheadPct}% now`}
                    </div>
                  </div>
                ) : null}
                {focusConfetti ? (
                  <div
                    className="roadmap-focus-confetti-wrap"
                    style={{
                      position: "absolute",
                      inset: 0,
                      overflow: "hidden",
                      borderRadius: 22,
                      pointerEvents: "none",
                    }}
                  >
                    {FOCUS_CONFETTI_SPEC.map((ch, ci) => (
                      <span
                        key={ci}
                        className="roadmap-confetti-piece"
                        style={{
                          background: ch.c,
                          animationDelay: `${ch.del}s`,
                          "--dx": ch.dx,
                          "--dy": ch.dy,
                          "--rot": ch.rot,
                        }}
                      />
                    ))}
                  </div>
                ) : null}
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.2em",
                    color: "#e0e7ff",
                    marginBottom: 20,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {lang === "TR" ? "SIRADAKİ ZAFERİN" : "YOUR NEXT WIN"}
                </div>
                {(() => {
                  const entry = taskCatalog.find((x) => x.id === dailyState.currentTaskId);
                  const rawBase = entry?.microLabel || entry?.label || dailyState.currentTaskId;
                  const rawEffective =
                    focusJob && entry?.bucket === "apply"
                      ? applyJobToFocusMicroLine(rawBase, focusJob.jobTitle, lang, entry.bucket)
                      : rawBase;
                  const { body, timeLabel } = splitFocusTaskLabel(rawEffective);
                  return (
                    <div
                      key={dailyState.currentTaskId}
                      style={{
                        display: "flex",
                        gap: 16,
                        alignItems: "flex-start",
                        marginBottom: 22,
                        textAlign: "left",
                      }}
                    >
                      <div
                        className={[focusCompleteFlash ? "roadmap-focus-check-hit" : "", focusTaskSuccess ? "roadmap-focus-check-success" : ""]
                          .filter(Boolean)
                          .join(" ")}
                        aria-hidden
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          flexShrink: 0,
                          marginTop: 2,
                          display: "grid",
                          placeItems: "center",
                          border: focusTaskSuccess ? "2px solid #10b981" : "2px solid rgba(129,140,248,0.65)",
                          background: focusTaskSuccess ? "rgba(16,185,129,0.22)" : "rgba(99,102,241,0.2)",
                          transition: "all 0.28s ease",
                        }}
                      >
                        {focusTaskSuccess ? (
                          <Check size={20} color="#34d399" strokeWidth={3} />
                        ) : focusTaskSubmitting ? (
                          <Loader2 size={18} color="#a5b4fc" style={{ animation: "spin 0.75s linear infinite" }} />
                        ) : (
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(165,180,252,0.95)" }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "clamp(18px, 4.2vw, 24px)",
                            fontWeight: 800,
                            color: "#f8fafc",
                            lineHeight: 1.4,
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {body}
                        </p>
                        {focusJob && entry?.bucket === "apply" ? (
                          <div style={{ marginTop: 12 }}>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 10px",
                                borderRadius: 999,
                                background: "rgba(16,185,129,0.18)",
                                border: "1px solid rgba(52,211,153,0.45)",
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: "0.06em",
                                color: "#6ee7b7",
                                fontFamily: "'DM Sans', sans-serif",
                                marginBottom: 8,
                              }}
                            >
                              {lang === "TR" ? "İLAN BAĞLANDI" : "JOB CONNECTED"} ✅
                            </div>
                            <div>
                              <a
                                href={focusJob.jobUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: "#a5b4fc",
                                  textDecoration: "underline",
                                  textUnderlineOffset: 3,
                                  wordBreak: "break-word",
                                  fontFamily: "'DM Sans', sans-serif",
                                }}
                              >
                                {focusJob.jobTitle}
                              </a>
                            </div>
                          </div>
                        ) : null}
                        {!focusTaskSubmitting ? (
                          focusTaskSuccess ? (
                            <div style={{ marginTop: 10 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#86efac",
                                  lineHeight: 1.45,
                                  fontFamily: "'DM Sans', sans-serif",
                                  textShadow: "0 0 14px rgba(52,211,153,0.35)",
                                }}
                              >
                                {lang === "TR"
                                  ? "Rahatsız olanı yaptın."
                                  : "You did the uncomfortable part."}
                              </p>
                              <p
                                style={{
                                  margin: "6px 0 0",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "rgba(167,243,208,0.92)",
                                  lineHeight: 1.45,
                                  fontFamily: "'DM Sans', sans-serif",
                                }}
                              >
                                {lang === "TR"
                                  ? "Tam da çoğu kişinin bıraktığı yer."
                                  : "That’s exactly where most people stop."}
                              </p>
                            </div>
                          ) : (
                            <div style={{ marginTop: 10 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "rgba(251,191,36,0.92)",
                                  lineHeight: 1.45,
                                  fontFamily: "'DM Sans', sans-serif",
                                }}
                              >
                                {lang === "TR"
                                  ? "⚠️ Adayların ~%78’i burada takılır — öne çıkanlar takılmaz."
                                  : "⚠️ ~78% of candidates stall here — top performers don’t."}
                              </p>
                              <p
                                style={{
                                  margin: "6px 0 0",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: "rgba(245,158,11,0.78)",
                                  lineHeight: 1.45,
                                  fontFamily: "'DM Sans', sans-serif",
                                }}
                              >
                                {lang === "TR"
                                  ? "Ayrışmanın başladığı yer burası."
                                  : "This is where separation starts."}
                              </p>
                            </div>
                          )
                        ) : null}
                        {timeLabel ? (
                          <p
                            style={{
                              margin: "10px 0 0",
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#94a3b8",
                              fontFamily: "'DM Sans', sans-serif",
                            }}
                          >
                            {lang === "TR" ? `≈ ${timeLabel}` : `~ ${timeLabel}`}
                          </p>
                        ) : null}
                        {entry?.bucket === "apply" ? (
                          <div
                            style={{
                              marginTop: 14,
                              paddingTop: 14,
                              borderTop: "1px solid rgba(129,140,248,0.2)",
                            }}
                          >
                            <label
                              htmlFor="hirefit-focus-job-url"
                              style={{
                                display: "block",
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: "0.14em",
                                color: "#94a3b8",
                                marginBottom: 8,
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              {lang === "TR" ? "İLAN LİNKİNİ YAPIŞTIR" : "PASTE JOB LINK"}
                            </label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "stretch" }}>
                              <input
                                id="hirefit-focus-job-url"
                                type="url"
                                inputMode="url"
                                placeholder={lang === "TR" ? "https://…" : "https://…"}
                                value={focusJobUrlInput}
                                onChange={(e) => setFocusJobUrlInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    attachFocusJob();
                                  }
                                }}
                                style={{
                                  flex: "1 1 200px",
                                  minWidth: 0,
                                  padding: "12px 14px",
                                  borderRadius: 10,
                                  border: "1px solid rgba(129,140,248,0.35)",
                                  background: "rgba(15,23,42,0.75)",
                                  color: "#e2e8f0",
                                  fontSize: 14,
                                  fontFamily: "'DM Sans', sans-serif",
                                  outline: "none",
                                }}
                              />
                              <button
                                type="button"
                                className="hf-btn-primary"
                                onClick={attachFocusJob}
                                style={{
                                  padding: "12px 18px",
                                  borderRadius: 10,
                                  fontWeight: 800,
                                  fontSize: 13,
                                  fontFamily: "'DM Sans', sans-serif",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {lang === "TR" ? "Bağla" : "Connect"}
                              </button>
                            </div>
                            {focusJob ? (
                              <button
                                type="button"
                                onClick={clearFocusJobAttach}
                                style={{
                                  marginTop: 10,
                                  padding: 0,
                                  border: "none",
                                  background: "none",
                                  color: "#94a3b8",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontFamily: "'DM Sans', sans-serif",
                                  textDecoration: "underline",
                                }}
                              >
                                {lang === "TR" ? "İlan bağlantısını kaldır" : "Remove job link"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ position: "relative", width: "100%" }}>
                  <button
                    type="button"
                    disabled={focusTaskSubmitting}
                    className="hf-btn-primary roadmap-focus-forward-cta"
                    onClick={completeDailyTask}
                    style={{
                      width: "100%",
                      fontSize: "clamp(15px, 3.8vw, 18px)",
                      padding: "17px 24px",
                      borderRadius: 14,
                      fontWeight: 800,
                      cursor: focusTaskSubmitting ? "wait" : "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                      opacity: focusTaskSubmitting ? 0.9 : 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                    }}
                  >
                    {focusTaskSubmitting ? (
                      <>
                        <Loader2 size={20} style={{ animation: "spin 0.75s linear infinite" }} />
                        {lang === "TR" ? "Kaydediliyor…" : "Saving…"}
                      </>
                    ) : focusTaskSuccess ? (
                      <>
                        <Check size={22} strokeWidth={3} />
                        {lang === "TR" ? "Tamam!" : "Done!"}
                      </>
                    ) : lang === "TR" ? (
                      "Bu adımı bitir → ilerlemeyi aç"
                    ) : (
                      "Finish This Step → Unlock Progress"
                    )}
                  </button>
                </div>
                {nextTaskPreview ? (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "rgba(15,23,42,0.45)",
                      border: "1px solid rgba(99,102,241,0.22)",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.16em",
                        color: "#818cf8",
                        marginBottom: 6,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {lang === "TR" ? "SIRADA:" : "UP NEXT:"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.45, fontFamily: "'DM Sans', sans-serif" }}>
                      {nextTaskPreview}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                style={{
                  marginBottom: retentionTotal > 0 ? 20 : 0,
                  padding: "20px 22px",
                  borderRadius: 18,
                  background: "linear-gradient(145deg, rgba(16,185,129,0.14), rgba(59,130,246,0.08))",
                  border: "1px solid rgba(52,211,153,0.35)",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#a7f3d0",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {lang === "TR"
                  ? "Tüm mikro-görevler tamam — harika gidiyorsun! 🎉"
                  : "You cleared every micro-task on this roadmap — huge win! 🎉"}
              </div>
            )
          ) : null}
          {retentionTotal > 0 ? (
            <div
              style={{
                padding: "14px 14px 16px",
                borderRadius: 16,
                background: "linear-gradient(135deg, rgba(79,70,229,0.12), rgba(59,130,246,0.05))",
                border: "1px solid rgba(129,140,248,0.22)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: "10px 12px",
                  alignItems: "stretch",
                }}
              >
                <div
                  style={{
                    flex: "1 1 120px",
                    minWidth: 108,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.5)",
                    border: "1px solid rgba(99,102,241,0.22)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.14em",
                      color: "#64748b",
                      marginBottom: 6,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {lang === "TR" ? "İLERLEME" : "PROGRESS"}
                  </div>
                  <div
                    className="roadmap-progress-pct-wrap"
                    style={{ position: "relative", display: "inline-block", fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {floatingProgressDelta ? (
                      <span className="roadmap-delta-float" key={`hero-${progressGlowNonce}`}>
                        {floatingProgressDelta}
                      </span>
                    ) : null}
                    <span
                      key={`hero-stat-${displayRetentionPct}-${progressGlowNonce}`}
                      style={{
                        fontSize: "clamp(22px, 4vw, 28px)",
                        fontWeight: 800,
                        color: "#93c5fd",
                        display: "inline-block",
                        animation:
                          retentionProgressPercent > 0
                            ? "roadmapPercentPop 0.55s cubic-bezier(0.34,1.3,0.64,1), roadmapProgressGlow 0.95s ease 0.04s, roadmapProgressAlivePulse 2.6s ease-in-out 0.25s infinite"
                            : undefined,
                      }}
                    >
                      {lang === "TR" ? `%${displayRetentionPct}` : `${displayRetentionPct}%`}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(148,163,184,0.95)",
                      lineHeight: 1.35,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {lang === "TR" ? "İvme kazanıyorsun." : "You're building momentum."}
                  </p>
                </div>
                <div
                  style={{
                    flex: "1 1 120px",
                    minWidth: 108,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.5)",
                    border: "1px solid rgba(251,191,36,0.22)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.14em",
                      color: "#64748b",
                      marginBottom: 6,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {lang === "TR" ? "SERİ" : "STREAK"}
                  </div>
                  <div
                    key={`streak-${streak.count}`}
                    style={{
                      position: "relative",
                      display: "inline-block",
                      fontSize: "clamp(20px, 3.5vw, 26px)",
                      fontWeight: 800,
                      color: "#fdba74",
                      fontFamily: "'DM Sans', sans-serif",
                      animation: "roadmapPercentPop 0.5s cubic-bezier(0.34,1.3,0.64,1)",
                    }}
                  >
                    {streakBumpFlash ? <span className="roadmap-streak-plus">+1</span> : null}
                    🔥 {streak.count}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(253,224,200,0.75)",
                      marginTop: 4,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {lang === "TR" ? "gün" : streak.count === 1 ? "day" : "days"}
                  </div>
                </div>
                <div
                  className="roadmap-stat-social-live"
                  style={{
                    flex: "1 1 160px",
                    minWidth: 140,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.5)",
                    border: "1px solid rgba(52,211,153,0.25)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.14em",
                      color: "#64748b",
                      marginBottom: 6,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {lang === "TR" ? "KARŞILAŞTIRMA" : "VS OTHERS"}
                  </div>
                  <div
                    key={`sp-${socialProofAheadPct}-${completedCount}`}
                    className="roadmap-social-proof-line"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#86efac",
                      lineHeight: 1.35,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {lang === "TR"
                      ? `Adayların %${displaySocialPct}'inden öndesin`
                      : `You're ahead of ${displaySocialPct}% of candidates`}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
        <div
          ref={mapCaptureRef}
          style={{
            background: "linear-gradient(180deg, #0a0f18 0%, #070b12 45%, #060910 100%)",
            borderRadius: 24,
            padding: "40px 44px 44px",
            border: "1px solid rgba(148,163,184,0.12)",
            marginBottom: 36,
            marginLeft: "auto",
            marginRight: "auto",
            maxWidth: 1080,
            width: "100%",
            overflow: "hidden",
            boxSizing: "border-box",
            boxShadow: "0 24px 64px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: 18,
              paddingBottom: 12,
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              opacity: 0.42,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.2em",
                color: "#475569",
                marginBottom: 6,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {lang === "TR" ? "YOLCULUK HARİTASI" : "BACKGROUND JOURNEY"}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>{exportRoleHeadline}</div>
          </div>

          <div
            style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, marginBottom: 20, alignItems: "center" }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: "'DM Sans', sans-serif", marginRight: "auto" }}>{t.learningRoadmapTitle}</div>
            <button type="button" className="hf-btn-ghost" onClick={() => navigator.clipboard.writeText(effectivePlan)} style={{ fontSize: 12, padding: "8px 14px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Copy size={12} />
              {t.copy}
            </button>
            <button
              type="button"
              className="hf-btn-ghost"
              onClick={handleShareRoadmapCopy}
              style={{ fontSize: 12, padding: "8px 14px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Share2 size={12} />
              {lang === "TR" ? "Yol haritamı paylaş" : "Share my roadmap"}
            </button>
            <button
              type="button"
              className="hf-btn-primary"
              disabled={downloading}
              onClick={openExportShareModal}
              style={{ fontSize: 12, padding: "8px 16px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 8, opacity: downloading ? 0.7 : 1 }}
            >
              <Download size={14} />
              {downloadLabel}
            </button>
          </div>

          <div className="roadmap-viz-backdrop" style={{ borderRadius: 18, marginBottom: 4 }}>
            <div
              ref={scrollRef}
              className="roadmap-scroll-hide"
              style={{
                overflowX: layout === "row" ? "auto" : "visible",
                overflowY: "visible",
                paddingBottom: 28,
              }}
            >
              <div
                ref={mapInnerRef}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: layout === "row" ? "row" : "column",
                alignItems: layout === "row" ? "flex-start" : "center",
                justifyContent: layout === "row" ? "center" : "flex-start",
                gap: layout === "row" ? 36 : 8,
                minWidth: layout === "row" ? "min-content" : "100%",
                minHeight: layout === "row" ? 300 : undefined,
                padding: layout === "row" ? "48px 24px 32px" : "24px 12px 32px",
                margin: "0 auto",
              }}
            >
              {pathD && svgBox.w > 0 && (
                <svg
                  width={svgBox.w}
                  height={svgBox.h}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    pointerEvents: "none",
                    overflow: "visible",
                    zIndex: 0,
                  }}
                  aria-hidden
                >
                  <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="52%" stopColor="#4f46e5" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path
                    ref={pathRef}
                    d={pathD}
                    fill="none"
                    stroke="rgba(51,65,85,0.22)"
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: "translateZ(0)" }}
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke={`url(#${gradId})`}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={`url(#${glowFilterId})`}
                    style={{
                      transform: "translateZ(0)",
                      strokeDasharray: pathLength > 0 ? `${pathLength} ${pathLength}` : "1 1",
                      strokeDashoffset: pathLength > 0 ? pathLength - pathRevealLength : 0,
                      transition: "stroke-dashoffset 1.28s cubic-bezier(0.45, 0, 0.2, 1)",
                      opacity: 1,
                    }}
                  />
                </svg>
              )}

              {youAreHere.show && (
                <div
                  className="roadmap-you-here-anchor"
                  style={{
                    position: "absolute",
                    left: youAreHere.x,
                    top: youAreHere.y,
                    transform: "translate(-50%, -100%)",
                    zIndex: 3,
                  }}
                >
                  <div className="roadmap-you-here-ripples" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div
                    style={{
                      position: "relative",
                      zIndex: 1,
                      animation: "roadmapYouFloat 2.75s ease-in-out infinite",
                      padding: "12px 22px",
                      borderRadius: 14,
                      background: "linear-gradient(165deg, rgba(30,27,75,0.96), rgba(15,23,42,0.98))",
                      border: "1px solid rgba(186,198,255,0.55)",
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      color: "#eef2ff",
                      fontFamily: "'DM Sans', sans-serif",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {youLabel}
                  </div>
                </div>
              )}

              <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: layout === "row" ? "row" : "column", alignItems: layout === "row" ? "flex-start" : "center", gap: layout === "row" ? 40 : 10, width: layout === "column" ? "100%" : "auto", justifyContent: layout === "row" ? "center" : "flex-start" }}>
                {roadmapSteps.map((step, i) => renderStepCard(step, i, layout === "row"))}
                {renderTargetColumn(layout === "row", roadmapSteps.length * 0.07)}
              </div>
            </div>
          </div>
          </div>

          <div
            style={{
              textAlign: "center",
              marginTop: 28,
              paddingTop: 22,
              borderTop: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(148,163,184,0.75)",
                fontFamily: "'Syne', sans-serif",
                marginBottom: 6,
              }}
            >
              HireFit AI
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: "rgba(148,163,184,0.5)",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {exportWatermark}
            </div>
          </div>
        </div>
        </>
      ) : (
        <div
          style={{
            padding: "44px 32px",
            borderRadius: 22,
            background: "linear-gradient(165deg, rgba(15,23,42,0.6), rgba(15,23,42,0.25))",
            border: "1px solid rgba(99,102,241,0.15)",
            marginBottom: 36,
            textAlign: "center",
            maxWidth: 520,
            marginLeft: "auto",
            marginRight: "auto",
            boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          }}
        >
          <p
            style={{
              color: "#e2e8f0",
              fontSize: 20,
              fontWeight: 800,
              fontFamily: "'Syne', sans-serif",
              marginBottom: 12,
              lineHeight: 1.35,
            }}
          >
            {lang === "TR" ? "Kariyer yol haritanızı saniyeler içinde oluşturun" : "Generate your career roadmap in seconds"}
          </p>
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif", marginBottom: 24 }}>
            {t.roadmapPageEmpty}
          </p>
          <button
            type="button"
            className="hf-btn-primary roadmap-cta-apply"
            onClick={() => navigate("/app#hirefit-apply-focus")}
            style={{ padding: "14px 28px", fontSize: 15, fontWeight: 700, borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 10 }}
          >
            {lang === "TR" ? "Analize git" : "Go to analysis"}
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      <div style={{ textAlign: "center", paddingBottom: 32 }}>
        <button
          type="button"
          className="hf-btn-primary roadmap-cta-apply roadmap-micro-cta-hover"
          onClick={() => navigate("/app#hirefit-apply-focus")}
          style={{ padding: "16px 32px", fontSize: 17, fontWeight: 800, borderRadius: 14, display: "inline-flex", alignItems: "center", gap: 10 }}
        >
          {bottomApplyLabel}
          <ArrowRight size={18} />
        </button>
      </div>

      {completionRipple ? (
        <div className="roadmap-screen-ripple" aria-hidden>
          <span />
          <span />
        </div>
      ) : null}

      {successMomentVisible ? (
        <>
          <div className="roadmap-success-scrim" aria-hidden />
          <div className="roadmap-success-float" role="status">
            {lang === "TR" ? "Süper. İlerliyorsun 🚀" : "Nice. You're moving forward 🚀"}
          </div>
        </>
      ) : null}

      {celebrationBar ? (
        <div
          className={`roadmap-celebrate-bar${celebrationBar.exiting ? " roadmap-celebrate-bar-exit" : ""}`}
          role="status"
        >
          <div className="roadmap-celebrate-bar-line1">
            {lang === "TR" ? "+10 XP kazandın" : "+10 XP earned"}
          </div>
          <div className="roadmap-celebrate-bar-line2">
            {lang === "TR"
              ? `Artık adayların %${celebrationBar.aheadPct}'inden öndesin`
              : `You're ahead of ${celebrationBar.aheadPct}% now`}
          </div>
        </div>
      ) : null}

      {retentionToast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 3000,
            padding: "14px 22px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(16,185,129,0.95), rgba(59,130,246,0.88))",
            color: "#f8fafc",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
            animation: "roadmapToastIn 0.35s ease",
            maxWidth: "min(440px, 94vw)",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          {retentionToast}
        </div>
      ) : null}

      {shareModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="roadmap-share-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(2,6,15,0.72)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          onClick={closeShareModal}
          onKeyDown={(e) => e.key === "Escape" && closeShareModal()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              borderRadius: 20,
              padding: "28px 26px",
              background: "linear-gradient(165deg, #0f172a, #0c1222)",
              border: "1px solid rgba(129,140,248,0.35)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 48px rgba(99,102,241,0.15)",
            }}
          >
            {shareModalMode === "growth" && growthShareSnapshot ? (
              <>
                <h2
                  id="roadmap-share-title"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#f8fafc",
                    margin: "0 0 12px",
                    lineHeight: 1.25,
                  }}
                >
                  {lang === "TR" ? "🚀 Çoğu adayın önündesin" : "You're ahead of most candidates 🚀"}
                </h2>
                <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif", marginBottom: 22 }}>
                  {lang === "TR" ? "Kariyer yolunu inşa etmeye başladın." : "You've started building your career path."}
                </p>
                {shareFeedback ? (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#4ade80",
                      marginBottom: 14,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {shareFeedback === "linkedin"
                      ? lang === "TR"
                        ? "Metin kopyalandı — LinkedIn'de yapıştır."
                        : "Copied — paste into LinkedIn."
                      : shareFeedback === "growthcopy"
                        ? lang === "TR"
                          ? "Kopyalandı 🚀"
                          : "Copied 🚀"
                        : ""}
                  </div>
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    type="button"
                    className="hf-btn-primary roadmap-celebrate-cta"
                    onClick={handleGrowthLinkedIn}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <Linkedin size={18} />
                    {"LinkedIn'de paylaş"}
                  </button>
                  <button
                    type="button"
                    className="hf-btn-ghost roadmap-celebrate-cta"
                    onClick={handleGrowthCopyPost}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <Copy size={18} />
                    {lang === "TR" ? "Gönderiyi kopyala" : "Copy post"}
                  </button>
                  <button
                    type="button"
                    onClick={closeShareModal}
                    style={{
                      marginTop: 6,
                      padding: "10px",
                      border: "none",
                      background: "transparent",
                      color: "#64748b",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {lang === "TR" ? "Kapat" : "Close"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2
                  id="roadmap-share-title"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#f8fafc",
                    margin: "0 0 12px",
                    lineHeight: 1.25,
                  }}
                >
                  {lang === "TR" ? "🚀 Kariyer yolun hazır" : "🚀 Your Career Path is Ready"}
                </h2>
                <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif", marginBottom: 22 }}>
                  {lang === "TR"
                    ? "Yol haritanızı paylaşın ve gelişim yolculuğunuzu gösterin."
                    : "Share your roadmap and show your journey."}
                </p>
                {shareFeedback ? (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#4ade80",
                      marginBottom: 14,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {shareFeedback === "linkedin"
                      ? lang === "TR"
                        ? "LinkedIn metni panoya kopyalandı."
                        : "LinkedIn post copied to clipboard."
                      : shareFeedback === "sharecopy"
                        ? lang === "TR"
                          ? "Paylaşım metni panoya kopyalandı."
                          : "Share text copied to clipboard."
                        : shareFeedback === "svg"
                          ? lang === "TR"
                            ? "SVG indirildi."
                            : "SVG downloaded."
                          : shareFeedback === "png"
                            ? lang === "TR"
                              ? "PNG indirildi."
                              : "PNG downloaded."
                            : lang === "TR"
                              ? "İndirildi."
                              : "Downloaded."}
                  </div>
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    type="button"
                    className="hf-btn-primary"
                    onClick={handleShareRoadmapCopy}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <Share2 size={18} />
                    {lang === "TR" ? "Yol haritamı paylaş (kopyala)" : "Share my roadmap (copy)"}
                  </button>
                  <button
                    type="button"
                    className="hf-btn-ghost"
                    onClick={handleCopyLinkedInPost}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <Linkedin size={18} />
                    {lang === "TR" ? "Aynı metni LinkedIn için kopyala" : "Copy same text (LinkedIn)"}
                  </button>
                  <button
                    type="button"
                    className="hf-btn-ghost"
                    disabled={downloading}
                    onClick={handleModalDownloadSvg}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      opacity: downloading ? 0.65 : 1,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <Download size={18} />
                    {downloading ? (lang === "TR" ? "İndiriliyor…" : "Exporting…") : lang === "TR" ? "SVG indir (vektör)" : "Download SVG (vector)"}
                  </button>
                  <button
                    type="button"
                    className="hf-btn-ghost"
                    disabled={downloading}
                    onClick={handleModalDownloadPng}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      opacity: downloading ? 0.65 : 1,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <Download size={18} />
                    {downloading ? (lang === "TR" ? "İndiriliyor…" : "Exporting…") : lang === "TR" ? "PNG indir (4×)" : "Download PNG (4×)"}
                  </button>
                  <button
                    type="button"
                    onClick={closeShareModal}
                    style={{
                      marginTop: 6,
                      padding: "10px",
                      border: "none",
                      background: "transparent",
                      color: "#64748b",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {lang === "TR" ? "Kapat" : "Close"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
