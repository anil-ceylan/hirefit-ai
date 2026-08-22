import { Fragment, useMemo } from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { parseActionPlan, enrichActionPlan, pickDoThisNextStep } from "../lib/analyze-v2/actionPlanNormalize.js";
import { trackActivationEvent } from "./utils/activationEvents.js";
import {
  ShieldCheck,
  Eye,
  Server,
  Sparkles,
  CheckCircle2,
  Cpu,
  Wand2,
  RotateCcw,
  Zap,
  ArrowRight,
  ChevronDown,
  Loader2,
  TrendingUp,
  FileText,
} from "lucide-react";

const CLOSED_BETA_COHORT = "closed_beta_01";

const container = {
  maxWidth: "min(1500px, 100%)",
  margin: "0 auto",
  padding: "0 24px",
  width: "100%",
  boxSizing: "border-box",
};

const pill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 16px",
  borderRadius: 999,
  background: "rgba(59,130,246,0.08)",
  border: "1px solid rgba(59,130,246,0.15)",
  fontSize: "11px",
  fontWeight: 700,
  color: "#60a5fa",
  letterSpacing: "0.1em",
  marginBottom: 16,
};

const h2 = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-heading-xl)",
  fontWeight: 700,
  letterSpacing: "var(--tracking-heading)",
  marginBottom: 14,
  lineHeight: "var(--leading-heading)",
  color: "#f8fafc",
};

const sub = {
  color: "#94a3b8",
  fontSize: "var(--text-body-lg)",
  maxWidth: 560,
  margin: "0 auto 48px",
  lineHeight: "var(--leading-body)",
};

const RAW_PARSE_FAIL_RE = /\b(parsing failed|gpt parsing failed|parse failed|json parse)\b/i;

function softReason(text, lang) {
  const raw = String(text || "").trim();
  if (!raw) return raw;
  if (RAW_PARSE_FAIL_RE.test(raw)) {
    return lang === "TR" ? "Analiz çıktısı ayrıştırılamadı." : "We couldn't parse this insight cleanly.";
  }
  return raw;
}

function glassCardStyle(extra = {}) {
  return {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "linear-gradient(165deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
    boxShadow:
      "0 24px 64px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(0,0,0,0.35)",
    backdropFilter: "blur(20px) saturate(1.25)",
    WebkitBackdropFilter: "blur(20px) saturate(1.25)",
    ...extra,
  };
}

function LandingScrollSection({ className, style, children }) {
  return (
    <motion.section
      className={className}
      style={style}
      initial={{ opacity: 0, y: 42 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.14, margin: "0px 0px -7% 0px" }}
      transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

export function SocialProofSection({ lang }) {
  const tr = lang === "TR";
  const logos = tr
    ? ["Teknoloji", "Finans", "Ürün", "Danışmanlık", "Startup"]
    : ["Technology", "Finance", "Product", "Consulting", "Startups"];
  return (
    <LandingScrollSection className="hf-section hf-section--social" style={{ padding: "56px 0 32px" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <span className="hf-badge-soft">
              <Cpu size={12} strokeWidth={2.2} />
              {tr ? "Karar öncelikli" : "Decision-first"}
            </span>
            <span className="hf-badge-soft">
              <Sparkles size={12} strokeWidth={2.2} />
              {tr ? "AI destekli" : "AI-supported"}
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 10,
            opacity: 0.85,
          }}
        >
          {logos.map((name) => (
            <div
              key={name}
              className="hf-micro-lift"
              style={{
                ...glassCardStyle({ padding: "10px 18px", borderRadius: 999 }),
                fontSize: 12,
                fontWeight: 600,
                color: "#94a3b8",
              }}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </LandingScrollSection>
  );
}

export function ProductPreviewSection({ lang, navigate }) {
  const tr = lang === "TR";
  const [explanationOpen, setExplanationOpen] = useState(false);

  const preview = tr
    ? {
        label: "ÜRÜN ÖNİZLEMESİ",
        headline: "HireFit sana yalnızca skor göstermez.",
        copy: "Rol yönünü, karar güvenini, en önemli kanıt açığını ve sıradaki en yüksek etkili hamleni tek ekranda gör.",
        sample: "Örnek profil",
        chromeTitle: "Career Snapshot",
        profilePlaceholder: "Profil",
        identityLabel: "Kariyer Kimliği",
        identity: "Analytical Product Builder",
        identityText: "Ürün, analiz ve iş sistemleri arasında güçlü bir geçiş profili.",
        confidenceLabel: "Karar Güveni",
        confidence: "Orta",
        confidenceText: "Ürün ve analiz sinyalleri güçlü; paydaş etkisi kanıtı henüz sınırlı.",
        roleLabel: "En Güçlü Rol Yönü",
        role: "Strategy & Operations Intern",
        roleText: "Mevcut kanıtların bu role daha yakın.",
        gapLabel: "En Büyük Kanıt Açığı",
        gap: "Paydaş etkisi",
        gapText: "Projelerinde kararlarının kimleri ve nasıl etkilediğini görünür kıl.",
        moveLabel: "Bu Haftaki En Yüksek Etkili Hamle",
        move: "Bir projene ölçülebilir paydaş etkisi ekle.",
        explainCta: "Bu öneri neden?",
        primaryCta: "Kariyer Profilini Oluştur",
        secondaryCta: "Örnek Akışı İncele",
        explanationTitle: "Açıklanabilir Karar Desteği",
        explanation: [
          { label: "Kanıt", text: "Ürün, analiz ve proje üretimi kanıtların mevcut." },
          { label: "Yorum", text: "Profilin operasyon ve ürün odaklı rollerde daha güçlü okunuyor." },
          { label: "Güven", text: "Orta; paydaş etkisi kanıtı sınırlı." },
          { label: "Öneri", text: "Bir projede karar etkini ölçülebilir sonuçla görünür kıl." },
        ],
        chips: ["Sahiplenme", "Ürün düşüncesi", "Teknoloji odağı", "AI ilgisi", "Builder yönü"],
      }
    : {
        label: "PRODUCT PREVIEW",
        headline: "HireFit shows more than a score.",
        copy: "See your role direction, decision confidence, biggest proof gap, and highest-impact next move in one screen.",
        sample: "Sample profile",
        chromeTitle: "Career Snapshot",
        profilePlaceholder: "Profile",
        identityLabel: "Career Identity",
        identity: "Analytical Product Builder",
        identityText: "A bridge profile across product, analysis, and business systems.",
        confidenceLabel: "Decision Confidence",
        confidence: "Medium",
        confidenceText: "Product and analysis signals are strong; stakeholder impact proof is still limited.",
        roleLabel: "Strongest Role Direction",
        role: "Strategy & Operations Intern",
        roleText: "Your current proof reads closer to this role.",
        gapLabel: "Biggest Proof Gap",
        gap: "Stakeholder impact",
        gapText: "Make it visible who your decisions affected and how.",
        moveLabel: "This Week's Highest-Impact Move",
        move: "Add measurable stakeholder impact to one project.",
        explainCta: "Why this recommendation?",
        primaryCta: "Build Career Profile",
        secondaryCta: "Review Example Flow",
        explanationTitle: "Explainable Decision Support",
        explanation: [
          { label: "Evidence", text: "Product, analysis, and project-building proof is visible." },
          { label: "Reasoning", text: "Your profile reads stronger for operations and product-oriented roles." },
          { label: "Confidence", text: "Medium; stakeholder impact proof is limited." },
          { label: "Recommendation", text: "Make decision impact visible with a measurable project outcome." },
        ],
        chips: ["Ownership mindset", "Product thinking", "Technology driven", "AI interest", "Builder mentality"],
      };

  const metricBlocks = [
    { label: preview.identityLabel, value: preview.identity, text: preview.identityText, tone: "blue" },
    { label: preview.confidenceLabel, value: preview.confidence, text: preview.confidenceText, tone: "amber" },
    { label: preview.roleLabel, value: preview.role, text: preview.roleText, tone: "green" },
    { label: preview.gapLabel, value: preview.gap, text: preview.gapText, tone: "rose" },
  ];

  const openExplanation = () => {
    setExplanationOpen(true);
    window.requestAnimationFrame(() => {
      const el = document.getElementById("product-preview-explanation");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector("button")?.focus({ preventScroll: true });
    });
  };

  const toggleExplanation = () => setExplanationOpen((open) => !open);

  return (
    <LandingScrollSection className="hf-section hf-section--product-preview" style={{ padding: "var(--hf-product-preview-pt, 120px) 0 var(--hf-flow-tight, 48px)" }}>
      <div style={container}>
        <div className="hf-product-preview-heading">
          <div style={{ ...pill, marginBottom: 26 }}>{preview.label}</div>
          <h2
            style={{
              ...h2,
              maxWidth: 980,
              margin: "0 auto 20px",
              fontSize: "clamp(30px, 3.35vw, 46px)",
            }}
          >
            {preview.headline}
          </h2>
          <p style={{ ...sub, maxWidth: 740, margin: "0 auto 52px" }}>{preview.copy}</p>
        </div>

        <div className="hf-product-preview-shell" aria-label={tr ? "HireFit ürün önizlemesi" : "HireFit product preview"}>
          <div className="hf-product-preview-topbar">
            <div className="hf-product-preview-brand">
              <span className="hf-product-preview-logo" aria-hidden>
                H
              </span>
              <span>HireFit</span>
            </div>
            <div className="hf-product-preview-title">{preview.chromeTitle}</div>
            <div className="hf-product-preview-account" aria-label={preview.profilePlaceholder}>
              <span aria-hidden />
              {preview.profilePlaceholder}
            </div>
          </div>

          <div className="hf-product-preview-sample-row">
            <span className="hf-product-preview-sample">{preview.sample}</span>
            <span className="hf-product-preview-muted">
              {tr ? "Demo içerik; canlı kullanıcı verisi değildir." : "Demo content; not live user data."}
            </span>
          </div>

          <div className="hf-product-preview-main">
            <div className="hf-product-preview-left">
              <div className="hf-product-preview-hero-card">
                <div className="hf-product-preview-kicker">{preview.moveLabel}</div>
                <h3>{preview.move}</h3>
                <p>{tr ? "Önce en yüksek güven etkisi olan kanıtı görünür yap." : "Start by making the proof with the highest trust impact visible."}</p>
                <button type="button" className="hf-product-preview-explain-cta" onClick={openExplanation}>
                  {preview.explainCta}
                  <ArrowRight size={15} aria-hidden />
                </button>
              </div>

              <div id="product-preview-explanation" className="hf-product-preview-explanation">
                <button
                  type="button"
                  className="hf-product-preview-explanation-toggle"
                  aria-expanded={explanationOpen}
                  aria-controls="product-preview-explanation-panel"
                  onClick={toggleExplanation}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleExplanation();
                    }
                  }}
                >
                  <span>{preview.explanationTitle}</span>
                  <ChevronDown size={16} aria-hidden />
                </button>
                <div
                  id="product-preview-explanation-panel"
                  className="hf-product-preview-explanation-panel"
                  hidden={!explanationOpen}
                >
                  {preview.explanation.map((item) => (
                    <div key={item.label} className="hf-product-preview-explanation-step">
                      <div>{item.label}</div>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hf-product-preview-grid">
              {metricBlocks.map((item) => (
                <article key={item.label} className={`hf-product-preview-card hf-product-preview-card--${item.tone}`}>
                  <div>{item.label}</div>
                  <h3>{item.value}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="hf-product-preview-evidence">
            {preview.chips.slice(0, 5).map((chip) => (
              <span key={chip}>
                <CheckCircle2 size={13} aria-hidden />
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="hf-product-preview-actions">
          <button
            type="button"
            className="hf-cta-primary"
            onClick={() => {
              trackActivationEvent("landing_cta_clicked", {
                source: "product_preview",
                route: "/analyze",
                lang,
                beta_cohort: CLOSED_BETA_COHORT,
              });
              navigate("/analyze");
            }}
          >
            {preview.primaryCta}
            <ArrowRight size={16} aria-hidden />
          </button>
          <button type="button" className="hf-btn-ghost hf-product-preview-secondary" onClick={openExplanation}>
            {preview.secondaryCta}
          </button>
        </div>
      </div>
    </LandingScrollSection>
  );
}

export function HowItWorksSection({ lang }) {
  const tr = lang === "TR";
  const steps = tr
    ? [
        { n: "1", title: "Kariyer profilini oluştur", body: "Kariyer Keşfi, deneyimlerin, projelerin ve CV kanıtların bir araya geldiği ilk analizdir.", icon: FileText },
        { n: "2", title: "Rol yönünü ve kanıt açıklarını gör", body: "En güçlü rol yönlerin, mevcut kanıtların ve kritik eksiklerin netleşir.", icon: Zap },
        { n: "3", title: "Sonraki en iyi hamleni uygula", body: "Tek bir yüksek etkili aksiyonla profilini ve başvuru hazırlığını güçlendir.", icon: RotateCcw },
      ]
    : [
        { n: "1", title: "Build your career profile", body: "Career Discovery brings together your experience, projects, and CV proof in one first analysis.", icon: FileText },
        { n: "2", title: "See role direction and proof gaps", body: "Your strongest role directions, current evidence, and critical gaps become clear.", icon: Zap },
        { n: "3", title: "Act on the next best move", body: "Use one high-impact action to strengthen your profile and application readiness.", icon: RotateCcw },
      ];

  return (
    <LandingScrollSection className="hf-section hf-section--how" style={{ padding: "var(--hf-flow-standard, 56px) 0 var(--hf-flow-tight, 48px)" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div style={pill}>{tr ? "Nasıl çalışır" : "How it works"}</div>
          <h2 style={h2}>{tr ? "Üç adımda netlik" : "Clarity in three steps"}</h2>
          <p style={sub}>
            {tr
              ? "Önce kariyer yönünü netleştir; CV analizini daha sonra bu varsayımları doğrulamak için kullan."
              : "Clarify career direction first; use CV analysis later to validate those assumptions."}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 18,
          }}
        >
          {steps.map((s) => (
            <div
              key={s.n}
              className="hf-micro-lift hf-glass-card"
              style={{
                ...glassCardStyle({ padding: 26 }),
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: 14,
                }}
              >
                <s.icon size={18} color="#a5b4fc" />
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#64748b", marginBottom: 8 }}>{tr ? `ADIM ${s.n}` : `STEP ${s.n}`}</div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-heading-md)", fontWeight: 700, lineHeight: "var(--leading-heading)", margin: "0 0 10px", color: "#f1f5f9" }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.6, color: "#94a3b8" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </LandingScrollSection>
  );
}

export function DecisionEngineExplainedSection({ lang }) {
  const tr = lang === "TR";
  const verdictCards = tr
    ? [
        { token: "strong", title: "Güçlü başvuru sinyali", body: "Mevcut kanıtlar role yakın görünüyor; başvuru öncesi anlatımı net tutmak önemli.", kicker: "Kanıt güçlü" },
        { token: "risk", title: "Riskli başvuru", body: "Rol ilgisi var; ancak ilk elemede aranan kritik kanıtlar henüz yeterince görünür değil.", kicker: "Kanıt eksik" },
        { token: "bad", title: "Şimdilik bekle", body: "Mevcut kanıtlarla elenme riski yüksek olabilir; önce en büyük kanıt açığını kapatmak daha doğru olur.", kicker: "Önce güçlendir" },
      ]
    : [
        { token: "strong", title: "Strong application signal", body: "Current proof looks close to the role; keep the story clear before applying.", kicker: "Strong proof" },
        { token: "risk", title: "Risky application", body: "There is role interest, but critical proof is not visible enough for a first-pass screen.", kicker: "Proof gap" },
        { token: "bad", title: "Pause for now", body: "With current evidence, rejection risk may be high; close the biggest proof gap first.", kicker: "Strengthen first" },
      ];

  return (
    <LandingScrollSection className="hf-section hf-section--decision" style={{ padding: "var(--hf-flow-tight, 48px) 0" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={pill}>{tr ? "Karar motoru" : "Decision engine"}</div>
          <h2 style={h2}>{tr ? "Skor değil — açıklanabilir karar desteği" : "Not a score — explainable decision support"}</h2>
          <p style={sub}>
            {tr
              ? "HireFit, mevcut kanıtlara göre başvuru hazırlığını ve sıradaki hamleyi netleştirmene yardımcı olur."
              : "HireFit helps clarify application readiness and the next move based on available evidence."}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {verdictCards.map((v) => (
            <div
              key={v.token}
              className={`hf-micro-lift hf-glass-card hf-verdict-outcome-card hf-verdict-outcome-card--${v.token}`}
              style={{
                ...glassCardStyle({
                  padding: 24,
                  boxShadow:
                    v.token === "strong"
                      ? "0 26px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(52,211,153,0.08)"
                      : v.token === "risk"
                        ? "0 26px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(251,191,36,0.06)"
                        : "0 26px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(251,113,133,0.07)",
                  border:
                    v.token === "strong"
                      ? "1px solid rgba(52,211,153,0.38)"
                      : v.token === "risk"
                        ? "1px solid rgba(251,191,36,0.42)"
                        : "1px solid rgba(248,113,113,0.42)",
                  background:
                    v.token === "strong"
                      ? "linear-gradient(165deg, rgba(16,185,129,0.09) 0%, rgba(255,255,255,0.04) 100%)"
                      : v.token === "risk"
                        ? "linear-gradient(165deg, rgba(245,158,11,0.08) 0%, rgba(255,255,255,0.03) 100%)"
                        : "linear-gradient(165deg, rgba(244,63,94,0.08) 0%, rgba(255,255,255,0.03) 100%)",
                }),
                position: "relative",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  color:
                    v.token === "strong" ? "#6ee7b7" : v.token === "risk" ? "#fcd34d" : "#fca5a5",
                  marginBottom: 10,
                }}
              >
                {v.kicker}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px, 2.6vw, 22px)", fontWeight: 700, lineHeight: "var(--leading-heading)", marginBottom: 12, color: "#f8fafc" }}>
                {v.title}
              </div>
              <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.65, color: "#cbd5e1" }}>{v.body}</p>
            </div>
          ))}
        </div>
      </div>
    </LandingScrollSection>
  );
}

export function BeforeAfterSection({ lang }) {
  const tr = lang === "TR";
  return (
    <LandingScrollSection className="hf-section hf-section--before-after" style={{ padding: "var(--hf-flow-tight, 48px) 0" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={pill}>{tr ? "Önce / Sonra" : "Before / After"}</div>
          <h2 style={h2}>{tr ? "Aynı başvuru — daha güçlü profil" : "Same application — stronger profile"}</h2>
          <p style={sub}>
            {tr
              ? "Örnek: ölçülebilir etki ve role uygun kanıtlar, profilin daha net okunmasına yardımcı olur."
              : "Example: measurable impact and role-relevant proof help the profile read more clearly."}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
            maxWidth: 920,
            margin: "0 auto",
          }}
        >
          <div className="hf-micro-lift hf-glass-card" style={glassCardStyle({ padding: 24 })}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#fb7185", marginBottom: 12 }}>{tr ? "ÖNCE" : "BEFORE"}</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>
              {(tr
                ? ["Belirsiz madde başlıkları", "İlanda geçen kritik kelimeler eksik", "Etki ölçülebilir değil"]
                : ["Vague bullets", "Missing critical JD keywords", "No measurable impact"]).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{tr ? "Okunabilirlik" : "Readability"}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "#f87171" }}>{tr ? "Belirsiz" : "Unclear"}</div>
            </div>
          </div>
          <div className="hf-micro-lift hf-glass-card" style={glassCardStyle({ padding: 24 })}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#4ade80", marginBottom: 12 }}>{tr ? "SONRA" : "AFTER"}</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>
              {(tr
                ? ["Madde başına metrik + sonuç", "İlan diliyle uyumlu kanıtlar", "Daha hızlı anlaşılır rol hikâyesi"]
                : ["Metrics + outcomes per bullet", "Proof aligned to the posting", "A role story that reads faster"]).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{tr ? "Okunabilirlik" : "Readability"}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "#4ade80" }}>{tr ? "Daha net" : "Clearer"}</div>
            </div>
          </div>
        </div>
      </div>
    </LandingScrollSection>
  );
}

export function TrustSection({ lang }) {
  const tr = lang === "TR";
  const items = tr
    ? [
        {
          icon: ShieldCheck,
          title: "Veriniz üzerinde kontrol sizde",
          body: "Profil ve CV verileriniz yalnızca HireFit deneyimini sunmak için işlenir.",
        },
        {
          icon: Eye,
          title: "Önerilerin nedenini görebilirsiniz",
          body: "HireFit, önerilerini mümkün olduğunca kanıt ve açıklamalarla sunar.",
        },
        {
          icon: Server,
          title: "Karar desteği sunar",
          body: "HireFit bilgilendirme ve karar desteği sağlar; işe alım, hukuk veya profesyonel danışmanlık garantisi vermez.",
        },
      ]
    : [
        {
          icon: ShieldCheck,
          title: "You stay in control of your data",
          body: "Profile and CV data are processed to provide the HireFit experience.",
        },
        {
          icon: Eye,
          title: "You can see why",
          body: "HireFit presents recommendations with evidence and explanations wherever possible.",
        },
        {
          icon: Server,
          title: "Decision support, not guarantees",
          body: "HireFit provides informational decision support and does not guarantee hiring, legal, or professional advice outcomes.",
        },
      ];

  return (
    <LandingScrollSection className="hf-section hf-section--trust" style={{ padding: "var(--hf-flow-standard, 56px) 0 var(--hf-flow-tight, 48px)" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={pill}>{tr ? "Güven" : "Trust"}</div>
          <h2 style={h2}>{tr ? "Önce güven. Sonra netlik." : "Trust first. Then clarity."}</h2>
          <p style={sub}>
            {tr
              ? "Kariyer verisi hassastır. Bu yüzden önerileri kanıta dayalı, açıklanabilir ve temkinli sunuyoruz."
              : "Career data is sensitive. We built HireFit to be transparent and responsible about how it is used."}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {items.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 24,
                padding: 28,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Icon size={22} color="#60a5fa" strokeWidth={2} />
              </div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, marginBottom: 10, color: "#f1f5f9" }}>{title}</h3>
              <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.7, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </LandingScrollSection>
  );
}

export function HiringLogicQaSection({ lang }) {
  const tr = lang === "TR";
  const items = tr
    ? [
        {
          q: "HireFit ChatGPT’den nasıl farklı?",
          a: "Genel sohbet yerine kariyer kararına odaklanır: rol yönü, kanıt açığı ve sıradaki hamle tek akışta görünür.",
        },
        {
          q: "HireFit yalnızca ATS anahtar kelimelerine mi bakıyor?",
          a: "Hayır. Anahtar kelimeler sadece bir katmandır; rol yönü, kanıt kalitesi ve recruiter okuması birlikte değerlendirilir.",
        },
        {
          q: "Öneriler neye dayanıyor?",
          a: "Kariyer Keşfi cevapların, varsa CV kanıtların, hedef rollerin ve profilinde görünen somut sinyaller kullanılır.",
        },
        {
          q: "Kariyer verilerim nasıl kullanılıyor?",
          a: "Verileriniz HireFit deneyimini sunmak, profilinizi oluşturmak ve önerileri kişiselleştirmek için işlenir.",
        },
        {
          q: "Sonuçlar işe girme garantisi verir mi?",
          a: "Hayır. HireFit karar desteği sağlar; işe alım sonucu, mülakat veya teklif garantisi vermez.",
        },
        {
          q: "Ücretsiz sürümde ne alırım?",
          a: "İlk Career Snapshot, temel rol yönleri, en büyük kanıt açığı ve ilk sonraki hamle görünür.",
        },
      ]
    : [
        {
          q: "How is HireFit different from ChatGPT?",
          a: "It focuses on career decisions: role direction, proof gaps, and the next move in one structured flow.",
        },
        {
          q: "Is HireFit only an ATS keyword tool?",
          a: "No. Keywords are one layer; role direction, proof quality, and recruiter-style reading are considered together.",
        },
        {
          q: "What are recommendations based on?",
          a: "Career Discovery answers, available CV proof, target roles, and concrete signals visible in your profile.",
        },
        {
          q: "How is my career data used?",
          a: "Your data is processed to provide the HireFit experience, build your profile, and personalize recommendations.",
        },
        {
          q: "Do results guarantee a job?",
          a: "No. HireFit provides decision support; it does not guarantee interviews, offers, or hiring outcomes.",
        },
        {
          q: "What do I get for free?",
          a: "Your first Career Snapshot, basic role directions, biggest proof gap, and first next move.",
        },
      ];

  return (
    <LandingScrollSection className="hf-section hf-section--qa" style={{ padding: "var(--hf-flow-standard, 56px) 0" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 42 }}>
          <div style={pill}>{tr ? "SSS" : "FAQ"}</div>
          <h2 style={h2}>{tr ? "Kısa cevaplarla güven" : "Trust, answered simply"}</h2>
          <p style={sub}>
            {tr
              ? "HireFit’in ne yaptığı, neye dayandığı ve neyi garanti etmediği net olmalı."
              : "What HireFit does, what it is based on, and what it does not guarantee should be clear."}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {items.map((item) => (
            <div key={item.q} className="hf-micro-lift hf-glass-card" style={glassCardStyle({ padding: 22, borderRadius: 16 })}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    minWidth: 22,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(99,102,241,0.18)",
                    border: "1px solid rgba(99,102,241,0.35)",
                    color: "#c7d2fe",
                    fontSize: 12,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  ?
                </span>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "#f8fafc", lineHeight: "var(--leading-heading)" }}>
                  {item.q}
                </h3>
              </div>
              <div style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </div>
    </LandingScrollSection>
  );
}

export function ComparisonSection({ lang }) {
  const tr = lang === "TR";
  const rows = tr
    ? [
        { label: "Kariyer profili ve rol yönü", hf: "Odaklı", ats: "Sınırlı", chat: "Bağlama göre" },
        { label: "İlan bazlı CV analizi", hf: "Odaklı", ats: "Temel", chat: "Bağlama göre" },
        { label: "Kanıt açıklarını önceliklendirme", hf: "Odaklı", ats: "Sınırlı", chat: "Bağlama göre" },
        { label: "Açıklanabilir öneri", hf: "Kanıt odaklı", ats: "Temel", chat: "Bağlama göre" },
        { label: "Zaman içindeki kariyer gelişimini takip etme", hf: "Gelişiyor", ats: "Sınırlı", chat: "Sınırlı" },
      ]
    : [
        { label: "Career profile and role direction", hf: "Focused", ats: "Limited", chat: "Context-dependent" },
        { label: "Job-specific CV analysis", hf: "Focused", ats: "Basic", chat: "Context-dependent" },
        { label: "Proof-gap prioritization", hf: "Focused", ats: "Limited", chat: "Context-dependent" },
        { label: "Explainable recommendation", hf: "Evidence-led", ats: "Basic", chat: "Context-dependent" },
        { label: "Career progress over time", hf: "Developing", ats: "Limited", chat: "Limited" },
      ];

  const colHead = (text, accent) => (
    <div
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "13px",
        fontWeight: 800,
        letterSpacing: "0.06em",
        color: accent,
        padding: "12px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {text}
    </div>
  );

  const cell = (v, highlighted = false) => (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "14px",
        color: highlighted ? "#bfdbfe" : "#94a3b8",
        fontSize: "12px",
        fontWeight: 800,
        textAlign: "center",
        lineHeight: 1.35,
      }}
    >
      {v}
    </div>
  );

  return (
    <LandingScrollSection className="hf-section hf-section--compare" style={{ padding: "80px 0" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={pill}>{tr ? "Karşılaştırma" : "Comparison"}</div>
          <h2 style={h2}>{tr ? "CV analizinden daha geniş bir karar akışı" : "A broader decision flow than CV analysis"}</h2>
          <p style={sub}>
            {tr
              ? "Bu karşılaştırma genel ürün odaklarını gösterir; her aracın sonucu kullanım bağlamına göre değişebilir."
              : "This comparison shows general product focus; results can vary by use case and context."}
          </p>
        </div>

        <div
          style={{
            borderRadius: 24,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
              alignItems: "stretch",
              minWidth: 560,
            }}
          >
            <div>{colHead(tr ? "Özellik" : "Capability", "#94a3b8")}</div>
            <div className="hf-verdict-column-cell" style={{ background: "rgba(59,130,246,0.06)" }}>
              {colHead("HireFit", "#93c5fd")}
            </div>
            <div>{colHead(tr ? "Genel ATS kontrolü" : "Generic ATS checker", "#64748b")}</div>
            <div>{colHead(tr ? "Genel sohbet asistanı" : "General chat assistant", "#64748b")}</div>

            {rows.map((row) => (
              <Fragment key={row.label}>
                <div
                  style={{
                    padding: "14px 16px",
                    fontSize: "14px",
                    color: "#cbd5e1",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {row.label}
                </div>
                <div
                  className="hf-verdict-column-cell"
                  style={{
                    background: "rgba(59,130,246,0.04)",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {cell(row.hf, true)}
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>{cell(row.ats)}</div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>{cell(row.chat)}</div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </LandingScrollSection>
  );
}

/**
 * Post-analysis “decision → action” panel (analyzer). Complements CareerEngineCard without duplicating the full verdict UI.
 */
export function YourNextMovePanel({
  lang,
  engineV2,
  missingSkills = [],
  topKeywords = [],
  alignmentScore,
  reanalysisResult,
  optimizedCv = "",
  onFixCv,
  onReanalyze,
  optimizing,
  isPro,
  onUpgrade,
}) {
  const tr = lang === "TR";
  const data = engineV2;

  const { problemLine, oneAction, currentInt } = useMemo(() => {
    if (!data) {
      return {
        problemLine: "",
        oneAction: "",
        currentInt: null,
        targetInt: null,
        gainPts: 10,
      };
    }
    const rawScore = data["Final Alignment Score"];
    const scoreNum = rawScore != null && Number.isFinite(Number(rawScore)) ? Number(rawScore) : null;
    const current = scoreNum ?? (alignmentScore != null && Number.isFinite(Number(alignmentScore)) ? Math.round(Number(alignmentScore)) : null);

    const plan = enrichActionPlan(parseActionPlan(data.Decision?.action_plan), {
      lang: tr ? "tr" : "en",
      roleFit: data.RoleFit,
      gaps: data.Gaps,
      verdict: data.Decision?.final_verdict,
    });
    const planFixes = plan.fixes.filter((f) => f.issue || (f.steps && f.steps.length));
    const primaryFix = planFixes.find((f) => f.priority === "high") || planFixes[0] || null;
    const stepPick = pickDoThisNextStep(planFixes);
    const singleActionRaw =
      (stepPick && String(stepPick).trim()) ||
      (primaryFix?.issue ? String(primaryFix.issue).trim() : "") ||
      (plan.priority_callout ? String(plan.priority_callout).trim() : "");
    const oneActionText = singleActionRaw
      ? softReason(singleActionRaw, lang)
      : tr
        ? "Ölçülebilir etki içeren madde başlıkları yaz."
        : "Rewrite bullets with measurable impact.";

    const gaps = data.Gaps?.rejection_reasons || [];
    const biggestRaw =
      (data.Gaps?.biggest_gap && String(data.Gaps.biggest_gap).trim()) ||
      (gaps[0]?.issue ? String(gaps[0].issue) : "");
    const mainProblemFromGap = biggestRaw ? softReason(biggestRaw, lang) : "";
    const oneLineReasonRaw = String(data.Decision?.reasoning || data.Recruiter?.reasoning || "")
      .trim()
      .split(/[.!?]/)[0]
      ?.trim();
    const mainProblemFromReason = oneLineReasonRaw ? softReason(oneLineReasonRaw, lang) : "";
    const problem = mainProblemFromGap || mainProblemFromReason;

    const gain = primaryFix
      ? Math.max(1, Math.min(18, Math.round(Number(primaryFix.score_impact) || 6)))
      : current != null && current < 72
        ? Math.min(18, Math.max(5, Math.round((72 - current) / 2)))
        : 10;
    const target = current != null ? Math.min(100, Math.round(current + gain)) : null;

    return {
      problemLine: problem,
      oneAction: oneActionText,
      currentInt: current,
      targetInt: target,
      gainPts: gain,
    };
  }, [data, alignmentScore, lang, tr]);

  if (!data) return null;

  const skills = (Array.isArray(missingSkills) ? missingSkills : []).slice(0, 5).map((x) => String(x));
  const kws = (Array.isArray(topKeywords) ? topKeywords : []).slice(0, 6).map((x) => String(x));

  const loopSteps = tr
    ? [
        { t: "CV Optimizasyonu (ölçülebilir etki)", d: "Her maddeye sonuç + sayı ekle." },
        { t: "Eksik anahtar kelimeleri ekle", d: "İlan dilini birebir yansıt." },
        { t: "Tekrar analiz et", d: "Aynı CV + ilan ile yeniden çalıştır." },
      ]
    : [
        { t: "CV Optimization bullets", d: "Add outcomes + numbers per bullet." },
        { t: "Add missing keywords", d: "Mirror the JD language." },
        { t: "Re-analyze", d: "Re-run with the same CV + JD." },
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="hf-next-move-panel hf-micro-lift"
      style={{
        marginTop: 22,
        marginBottom: 8,
        ...glassCardStyle({ padding: "24px 22px 22px" }),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(56,189,248,0.12)",
              border: "1px solid rgba(56,189,248,0.22)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <TrendingUp size={20} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#64748b", textTransform: "uppercase" }}>
              {tr ? "Sıradaki hamle" : "Your next move"}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 800, color: "#f8fafc", marginTop: 2 }}>
              {tr ? "Karar → aksiyon → tekrar analiz" : "Decision → action → re-run"}
            </div>
          </div>
        </div>
        {reanalysisResult ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#6ee7b7",
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(52,211,153,0.35)",
              background: "rgba(16,185,129,0.08)",
            }}
          >
            {tr ? "Okuma güçlendi" : "Read strengthened"}
          </div>
        ) : null}
      </div>

      {currentInt != null ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>
              {tr ? "Profil gücü" : "Profile strength"}
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "#e2e8f0" }}>
              {tr
                ? currentInt >= 78
                  ? "Güçlü ihtimal"
                  : currentInt >= 60
                    ? "Orta ihtimal"
                    : currentInt >= 50
                      ? "Riskli başvuru"
                      : "Düşük olasılık"
                : currentInt >= 78
                  ? "Strong potential"
                  : currentInt >= 60
                    ? "Medium potential"
                    : currentInt >= 50
                      ? "Risky application"
                      : "Low probability"}
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "100%",
                opacity: 0.35,
                borderRadius: 999,
                background: "linear-gradient(90deg, #6366f1, #22d3ee)",
                boxShadow: "0 0 24px rgba(99,102,241,0.45)",
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(251,113,133,0.25)",
            background: "rgba(244,63,94,0.06)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#fb7185", textTransform: "uppercase", marginBottom: 6 }}>
            {tr ? "Sorun" : "The problem"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fecdd3", lineHeight: 1.5 }}>
            {problemLine ||
              (tr ? "Profilin, ilanın beklediği kanıtları net göstermiyor." : "Your profile isn’t showing the proof this posting expects.")}
          </div>
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(251,191,36,0.22)",
            background: "rgba(245,158,11,0.06)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#fbbf24", textTransform: "uppercase", marginBottom: 10 }}>
            {tr ? "Boşluk" : "The gap"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>{tr ? "Eksik beceriler" : "Missing skills"}</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.55 }}>
                {skills.length ? skills.join(" · ") : tr ? "— listelenmedi" : "— none listed"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>{tr ? "Anahtar kelimeler" : "Keywords"}</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.55 }}>
                {kws.length ? kws.join(" · ") : tr ? "— listelenmedi" : "— none listed"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>{tr ? "Deneyim okuması" : "Experience read"}</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.55 }}>
                {problemLine
                  ? tr
                    ? "Ölçülebilir sonuç ve rol uyumu eksik görünüyor."
                    : "Measurable outcomes + role fit read weak."
                  : tr
                    ? "İlanla hizalı kanıt satırı ekleyin."
                    : "Add proof lines aligned to the JD."}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(74,222,128,0.28)",
            background: "rgba(34,197,94,0.07)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#4ade80", textTransform: "uppercase", marginBottom: 6 }}>
            {tr ? "Tek net aksiyon" : "One clear action"}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#ecfccb", lineHeight: 1.45 }}>→ {oneAction}</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase", marginBottom: 10 }}>
          {tr ? "Döngü" : "Feedback loop"}
        </div>
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {loopSteps.map((s, idx) => (
            <li key={s.t} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <CheckCircle2 size={18} color="#64748b" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                  {idx + 1}. {s.t}
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button
          type="button"
          className="hf-cta-primary"
          onClick={() => {
            if (!isPro) {
              onUpgrade();
              return;
            }
            onFixCv();
          }}
          disabled={optimizing && isPro}
          style={{
            flex: "1 1 220px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            cursor: optimizing && isPro ? "wait" : "pointer",
            fontWeight: 700,
            fontSize: 15,
            fontFamily: "var(--font-sans)",
            color: "#0f172a",
            opacity: optimizing && isPro ? 0.85 : 1,
          }}
        >
          {optimizing && isPro ? <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : <Wand2 size={18} />}
          {!isPro ? (tr ? "CV Optimizasyonu — Pro" : "CV Optimization — Pro") : optimizing && isPro ? (tr ? "Optimize ediliyor..." : "Optimizing...") : tr ? "→ CV Optimizasyonunu şimdi başlat" : "→ Start CV Optimization now"}
        </button>
        <button
          type="button"
          onClick={onReanalyze}
          disabled={!String(optimizedCv || "").trim()}
          className="hf-btn-secondary-ghost"
          style={{
            flex: "1 1 200px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 18px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "#e2e8f0",
            fontWeight: 700,
            fontSize: 14,
            fontFamily: "var(--font-sans)",
            cursor: !String(optimizedCv || "").trim() ? "not-allowed" : "pointer",
            opacity: !String(optimizedCv || "").trim() ? 0.45 : 1,
          }}
        >
          <RotateCcw size={16} />
          {tr ? "Tekrar analiz et" : "Re-analyze"}
        </button>
      </div>
    </motion.div>
  );
}



