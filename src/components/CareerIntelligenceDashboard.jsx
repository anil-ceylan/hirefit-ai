import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Wand2 } from "lucide-react";
import {
  RecruiterVerdictMeter,
  ShortlistChanceCard,
  RecommendedJobsSection,
  PersonalizedProfileInsights,
} from "./HireFitPremiumReport.jsx";
import { CareerOSProfileStack } from "./career-os/CareerOSModules.jsx";
import "./career-os/career-os.css";

const TABS = [
  { id: "decision", labelTr: "Karar", labelEn: "Decision" },
  { id: "fix", labelTr: "Düzeltme", labelEn: "Fix Plan" },
  { id: "recruiter", labelTr: "Recruiter", labelEn: "Recruiter" },
  { id: "opportunities", labelTr: "Fırsatlar", labelEn: "Opportunities" },
  { id: "profile", labelTr: "Career OS", labelEn: "Career OS" },
];

function TabBar({ active, onChange, lang }) {
  const tr = lang === "TR";
  return (
    <nav className="hf-career-os__tabs" aria-label={tr ? "Analiz sekmeleri" : "Analysis tabs"}>
      {TABS.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`hf-career-os__tab${on ? " hf-career-os__tab--active" : ""}`}
            onClick={() => onChange(tab.id)}
          >
            {tr ? tab.labelTr : tab.labelEn}
          </button>
        );
      })}
    </nav>
  );
}

function DecisionTab({ vm, lang, onImproveCv }) {
  const tr = lang === "TR";
  const pulse = vm.firstScreenPulse;
  const interviewPct = vm.recruiterVerdictMeter?.afterPercent ?? vm.recruiterVerdictMeter?.beforePercent;
  return (
    <div className="hf-career-os__panel">
      <p className="hf-career-os__hint">{tr ? "Başvurmalı mıyım?" : "Should I apply?"}</p>
      <RecruiterVerdictMeter meter={vm.recruiterVerdictMeter} lang={lang} />
      <div className="hf-ci-metric-grid">
        <div className="hf-ci-metric">
          <div className="hf-ci-metric__label">{tr ? "Mülakat şansı" : "Interview chance"}</div>
          <div className="hf-ci-metric__value">{interviewPct}%</div>
        </div>
        <ShortlistChanceCard data={vm.shortlistChance} lang={lang} />
      </div>
      <div className="hf-ci-card hf-ci-card--danger">
        <div className="hf-ci-metric__label" style={{ color: "#fca5a5", marginBottom: 4 }}>
          {pulse?.blockingTitle || vm.blockerTitle}
        </div>
        <div style={{ fontSize: 13, color: "#fecaca", fontWeight: 700, lineHeight: 1.45 }}>
          {pulse?.blockingText || vm.eliminatingBlockerSentence || vm.mainBlocker}
        </div>
      </div>
      <div className="hf-ci-card hf-ci-card--success">
        <div className="hf-ci-metric__label" style={{ color: "#86efac", marginBottom: 4 }}>
          {pulse?.afterFixTitle || (tr ? "Düzeltirsen" : "If you fix it")}
        </div>
        <div style={{ fontSize: 13, color: "#bbf7d0", fontWeight: 800, lineHeight: 1.45 }}>
          {pulse?.afterFixText || vm.outcomeProjection?.headline}
        </div>
      </div>
      {(vm.finalVerdict || vm.applicationDecision) ? (
        <span
          className="hf-chip hf-chip--active"
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "4px 10px",
            width: "fit-content",
          }}
        >
          {(vm.finalVerdict || vm.applicationDecision).label}
        </span>
      ) : null}
      <button type="button" className="hf-btn-primary" onClick={onImproveCv} style={{ width: "100%", justifyContent: "center", padding: "10px 14px", fontSize: 13 }}>
        {tr ? "CV'yi İyileştir" : "Improve CV"}
      </button>
    </div>
  );
}

function FixPlanTab({ vm, lang, onFix, onOptimize, applyingFix, optimizing, loading }) {
  const tr = lang === "TR";
  const fixes = (vm.fixEngine?.fixes || []).slice(0, 3);
  const [copiedKey, setCopiedKey] = useState(null);
  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="hf-career-os__panel">
      <p className="hf-career-os__hint">{tr ? "Ne değiştirmeliyim?" : "What should I change?"}</p>
      {fixes.map((fix) => (
        <div key={fix.id} className="hf-ci-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{fix.rankLabel} · {fix.categoryLabel || fix.category}</span>
            <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>+{fix.pointsGain}</span>
          </div>
          <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 700, marginBottom: 6 }}>{fix.problem}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{tr ? "Önerilen" : "Suggested"}</div>
          <div style={{ fontSize: 12, color: "#ddd6fe", fontStyle: "italic", lineHeight: 1.4, marginBottom: 8 }}>{fix.suggestedRewrite || fix.exampleLine}</div>
          {(fix.beforeSnippet || fix.afterSnippet) ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8, fontSize: 11 }}>
              <div>
                <span style={{ color: "#64748b", fontWeight: 800 }}>{tr ? "Önce" : "Before"}</span>
                <div style={{ color: "#94a3b8", marginTop: 2 }}>{fix.beforeSnippet}</div>
              </div>
              <div>
                <span style={{ color: "#64748b", fontWeight: 800 }}>{tr ? "Sonra" : "After"}</span>
                <div style={{ color: "#86efac", fontWeight: 700, marginTop: 2 }}>{fix.afterSnippet}</div>
              </div>
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button
              type="button"
              onClick={() => copyText(fix.suggestedRewrite || fix.exampleLine || "", fix.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.5)", color: "#cbd5e1", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
            >
              <Copy size={12} /> {copiedKey === fix.id ? (tr ? "Kopyalandı" : "Copied") : (tr ? "Kopyala" : "Copy")}
            </button>
            <button
              type="button"
              disabled={loading || applyingFix || optimizing}
              onClick={() => onFix?.(fix)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.2)", color: "#e0e7ff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
            >
              <Wand2 size={12} /> {tr ? "Düzelt" : "Fix"}
            </button>
          </div>
        </div>
      ))}
      {vm.atsKeywordRemedies?.length ? (
        <div className="hf-ci-card">
          <div className="hf-ci-metric__label" style={{ color: "#7dd3fc", marginBottom: 6 }}>ATS</div>
          {vm.atsKeywordRemedies.slice(0, 3).map((kw) => (
            <div key={kw.keyword} style={{ marginBottom: 6, fontSize: 12, color: "#e2e8f0" }}>
              <strong>{kw.keyword}</strong> — {kw.exampleLine}
            </div>
          ))}
        </div>
      ) : null}
      <button type="button" className="hf-btn-primary" disabled={optimizing || loading} onClick={onOptimize} style={{ width: "100%", justifyContent: "center", padding: "10px", fontSize: 13 }}>
        {optimizing ? (tr ? "Optimize ediliyor…" : "Optimizing…") : tr ? "Tüm CV'yi optimize et" : "Optimize full CV"}
      </button>
    </div>
  );
}

function RecruiterTab({ vm, lang }) {
  const tr = lang === "TR";
  const panel = vm.recruiterReaction;
  const rows = panel?.rows || [];
  const blocks = [
    { title: tr ? "İlk izlenim" : "First impression", value: rows.find((r) => r.key === "firstLook")?.value, color: "#fde68a" },
    { title: tr ? "En güçlü sinyal" : "Strongest signal", value: vm.recruiterView?.strength, color: "#86efac" },
    { title: tr ? "En büyük endişe" : "Biggest concern", value: vm.recruiterView?.gap, color: "#fca5a5" },
    { title: tr ? "İlk mülakat sorusu" : "First interview question", value: rows.find((r) => r.key === "firstQuestion")?.value, color: "#c4b5fd" },
  ];
  const confidence = vm.recruiterTrust?.band || panel?.trustBand;
  return (
    <div className="hf-career-os__panel">
      <p className="hf-career-os__hint">{tr ? "Nasıl algılanıyorum?" : "How am I perceived?"}</p>
      {blocks.map(
        (block) =>
          block.value ? (
            <div key={block.title} className="hf-ci-card">
              <div className="hf-ci-metric__label" style={{ marginBottom: 4 }}>{block.title}</div>
              <div style={{ fontSize: 13, color: block.color, fontWeight: 700, lineHeight: 1.45 }}>{block.value}</div>
            </div>
          ) : null
      )}
      <div className="hf-ci-card">
        <div className="hf-ci-metric__label" style={{ color: "#fbbf24", marginBottom: 4 }}>{tr ? "Recruiter güveni" : "Recruiter confidence"}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fde68a" }}>{confidence}</div>
      </div>
    </div>
  );
}

function OpportunitiesTab({ data, loading, lang, onApply, onRisky, onSkip }) {
  const tr = lang === "TR";
  const [filters, setFilters] = useState({ internship: false, junior: false, mid: false, remote: false, global: false });
  const toggle = (key) => setFilters((f) => ({ ...f, [key]: !f[key] }));

  const filtered = (() => {
    const jobs = data?.jobs || [];
    const any = Object.values(filters).some(Boolean);
    if (!any) return jobs;
    return jobs.filter((job) => {
      if (filters.internship && !job.isIntern) return false;
      if (filters.junior && job.level !== "Junior") return false;
      if (filters.mid && job.level !== "Mid") return false;
      if (filters.remote && !job.remote) return false;
      if (filters.global && !job.global) return false;
      return true;
    });
  })();

  const filterChips = [
    ["internship", tr ? "Staj" : "Internship"],
    ["junior", "Junior"],
    ["mid", "Mid"],
    ["remote", "Remote"],
    ["global", tr ? "Global" : "Global"],
  ];

  return (
    <div className="hf-career-os__panel">
      <p className="hf-career-os__hint">{tr ? "Önerilen roller" : "Recommended roles"}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {filterChips.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            style={{
              padding: "5px 9px",
              borderRadius: 999,
              border: filters[key] ? "1px solid rgba(99,102,241,0.55)" : "1px solid rgba(148,163,184,0.2)",
              background: filters[key] ? "rgba(99,102,241,0.25)" : "transparent",
              color: filters[key] ? "#e0e7ff" : "#94a3b8",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <RecommendedJobsSection data={{ ...data, jobs: filtered }} lang={lang} loading={loading} onApply={onApply} onRisky={onRisky} onSkip={onSkip} />
    </div>
  );
}

function ProfileTab({ vm, careerProfile, careerGrowth, history, lang }) {
  const tr = lang === "TR";
  return (
    <div className="hf-career-os__panel">
      <p className="hf-career-os__hint">{tr ? "Üniversiteden istihdama — DNA, GPS, üniversite, şehir ve hazırlık." : "University to employment — DNA, GPS, university, city, and readiness."}</p>
      <CareerOSProfileStack vm={vm} careerProfile={careerProfile} careerGrowth={careerGrowth} history={history} lang={lang} />
      {vm.personalizedProfile ? <PersonalizedProfileInsights insights={vm.personalizedProfile} lang={lang} /> : null}
    </div>
  );
}

export default function CareerIntelligenceDashboard({
  vm,
  lang,
  recommendedJobs,
  recommendedJobsLoading,
  careerProfile,
  careerGrowth,
  history,
  onApplyJob,
  onRiskyJob,
  onSkipJob,
  onImproveCv,
  onFix,
  onOptimize,
  applyingFix,
  optimizing,
  loading,
}) {
  const [tab, setTab] = useState("decision");
  const tr = lang === "TR";

  if (!vm) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="hf-career-os hf-career-intelligence-dashboard"
    >
      <div className="hf-career-os__shell">
        <header className="hf-career-os__head">
          <h2 className="hf-career-os__headline">{tr ? "Career Intelligence" : "Career Intelligence"}</h2>
          <p className="hf-career-os__sub">{tr ? "Odaklı karar — tek sekme görünür." : "Focused decisions — one tab at a time."}</p>
          <TabBar active={tab} onChange={setTab} lang={lang} />
        </header>
        <div className="hf-career-os__body">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              {tab === "decision" ? <DecisionTab vm={vm} lang={lang} onImproveCv={() => { setTab("fix"); onImproveCv?.(); }} /> : null}
              {tab === "fix" ? (
                <FixPlanTab vm={vm} lang={lang} onFix={onFix} onOptimize={onOptimize} applyingFix={applyingFix} optimizing={optimizing} loading={loading} />
              ) : null}
              {tab === "recruiter" ? <RecruiterTab vm={vm} lang={lang} /> : null}
              {tab === "opportunities" ? (
                <OpportunitiesTab data={recommendedJobs} loading={recommendedJobsLoading} lang={lang} onApply={onApplyJob} onRisky={onRiskyJob} onSkip={onSkipJob} />
              ) : null}
              {tab === "profile" ? (
                <ProfileTab vm={vm} careerProfile={careerProfile} careerGrowth={careerGrowth} history={history} lang={lang} />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

