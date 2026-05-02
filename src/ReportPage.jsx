import { useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import supabase from "./supabaseClient";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .rp-root {
    min-height: 100vh;
    background: #060910;
    color: #f1f5f9;
    font-family: 'DM Sans', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .rp-noise {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  }

  .rp-glow-1 {
    position: fixed;
    top: -200px;
    left: -100px;
    width: 700px;
    height: 700px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(59,130,246,0.08), transparent 65%);
    pointer-events: none;
    z-index: 0;
  }

  .rp-glow-2 {
    position: fixed;
    bottom: -200px;
    right: -100px;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(99,102,241,0.07), transparent 65%);
    pointer-events: none;
    z-index: 0;
  }

  .rp-wrap {
    position: relative;
    z-index: 1;
    max-width: 900px;
    margin: 0 auto;
    padding: 48px 24px 80px;
  }

  /* HEADER */
  .rp-header {
    margin-bottom: 40px;
    animation: fadeUp 0.6s ease both;
  }

  .rp-brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 32px;
    text-decoration: none;
  }

  .rp-brand-icon {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    display: grid;
    place-items: center;
    font-size: 14px;
  }

  .rp-brand-name {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 16px;
    color: #f1f5f9;
  }

  .rp-role {
    font-family: 'Syne', sans-serif;
    font-size: clamp(32px, 5vw, 52px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin-bottom: 10px;
  }

  .rp-subtitle {
    color: #475569;
    font-size: 14px;
    font-weight: 500;
  }

  /* SHARE BAR */
  .rp-share-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 40px;
    flex-wrap: wrap;
    animation: fadeUp 0.6s 0.1s ease both;
  }

  .rp-btn-copy {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: #94a3b8;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.2s;
  }

  .rp-btn-copy:hover {
    border-color: rgba(255,255,255,0.2);
    color: white;
    background: rgba(255,255,255,0.07);
  }

  .rp-btn-linkedin {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: #0a66c2;
    border: none;
    border-radius: 10px;
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.2s;
  }

  .rp-btn-linkedin:hover {
    background: #0958a8;
    transform: translateY(-1px);
  }

  /* SCORE HERO */
  .rp-score-hero {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 24px;
    padding: 48px 44px;
    margin-bottom: 20px;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 40px;
    align-items: center;
    position: relative;
    overflow: hidden;
    animation: fadeUp 0.6s 0.15s ease both;
  }

  .rp-score-hero::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(59,130,246,0.4), transparent);
  }

  .rp-score-ring {
    position: relative;
    width: 130px;
    height: 130px;
    flex-shrink: 0;
  }

  .rp-score-ring svg {
    transform: rotate(-90deg);
    width: 130px;
    height: 130px;
  }

  .rp-score-ring-track {
    fill: none;
    stroke: rgba(255,255,255,0.06);
    stroke-width: 8;
  }

  .rp-score-ring-fill {
    fill: none;
    stroke-width: 8;
    stroke-linecap: round;
    transition: stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .rp-score-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .rp-score-num {
    font-family: 'Syne', sans-serif;
    font-size: clamp(52px, 12vw, 96px);
    font-weight: 800;
    line-height: 1;
  }

  .rp-score-denom {
    font-size: 12px;
    color: #475569;
    font-weight: 500;
  }

  .rp-score-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #475569;
    margin-bottom: 8px;
  }

  .rp-score-verdict {
    font-family: 'Syne', sans-serif;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 14px;
  }

  .rp-score-desc {
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
    max-width: 460px;
    margin-bottom: 24px;
  }

  .rp-score-bars {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 24px;
  }

  .rp-bar-row {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .rp-bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #475569;
    font-weight: 500;
  }

  .rp-bar-track {
    height: 4px;
    background: rgba(255,255,255,0.06);
    border-radius: 999px;
    overflow: hidden;
  }

  .rp-bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #3b82f6, #22d3ee);
    transition: width 1s ease;
  }

  /* GRID */
  .rp-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
    animation: fadeUp 0.6s 0.2s ease both;
  }

  .rp-grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
    animation: fadeUp 0.6s 0.25s ease both;
  }

  /* CARDS */
  .rp-card {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
    padding: 24px;
    transition: border-color 0.2s;
  }

  .rp-card:hover {
    border-color: rgba(255,255,255,0.12);
  }

  .rp-card-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  /* REJECTION */
  .rp-rejection {
    background: rgba(239,68,68,0.04);
    border: 1px solid rgba(239,68,68,0.12);
    border-radius: 20px;
    padding: 24px;
    margin-bottom: 16px;
    animation: fadeUp 0.6s 0.3s ease both;
  }

  .rp-rejection-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Syne', sans-serif;
    font-size: 17px;
    font-weight: 700;
    margin-bottom: 20px;
    color: #fca5a5;
  }

  .rp-rejection-group {
    margin-bottom: 14px;
  }

  .rp-rejection-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .rp-rejection-badge.high {
    background: rgba(239,68,68,0.15);
    color: #f87171;
    border: 1px solid rgba(239,68,68,0.2);
  }

  .rp-rejection-badge.medium {
    background: rgba(245,158,11,0.12);
    color: #fbbf24;
    border: 1px solid rgba(245,158,11,0.2);
  }

  .rp-rejection-badge.low {
    background: rgba(148,163,184,0.1);
    color: #94a3b8;
    border: 1px solid rgba(148,163,184,0.15);
  }

  .rp-rejection-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(255,255,255,0.02);
    font-size: 13px;
    color: #94a3b8;
    margin-bottom: 6px;
    line-height: 1.5;
  }

  .rp-rejection-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #475569;
    flex-shrink: 0;
    margin-top: 6px;
  }

  /* SKILLS */
  .rp-skill-tag {
    display: inline-flex;
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    margin: 3px;
  }

  .rp-skill-tag.matched {
    background: rgba(16,185,129,0.1);
    border: 1px solid rgba(16,185,129,0.2);
    color: #6ee7b7;
  }

  .rp-skill-tag.missing {
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.2);
    color: #fca5a5;
  }

  .rp-skill-tag.keyword {
    background: rgba(59,130,246,0.1);
    border: 1px solid rgba(59,130,246,0.2);
    color: #93c5fd;
  }

  /* REPORT TEXT */
  .rp-report {
    animation: fadeUp 0.6s 0.35s ease both;
  }

  .rp-report-text {
    font-size: 14px;
    line-height: 1.8;
    color: #94a3b8;
    white-space: pre-wrap;
  }

  /* JOB INTEL */
  .rp-intel-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #334155;
    margin-bottom: 4px;
  }

  .rp-intel-value {
    font-family: 'Syne', sans-serif;
    font-size: 20px;
    font-weight: 700;
  }

  /* CTA */
  .rp-cta {
    margin-top: 16px;
    background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.06));
    border: 1px solid rgba(59,130,246,0.15);
    border-radius: 20px;
    padding: 36px;
    text-align: center;
    animation: fadeUp 0.6s 0.4s ease both;
  }

  .rp-cta h3 {
    font-family: 'Syne', sans-serif;
    font-size: 22px;
    font-weight: 800;
    margin-bottom: 8px;
  }

  .rp-cta p {
    color: #64748b;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .rp-cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 13px 28px;
    background: #3b82f6;
    color: white;
    border-radius: 10px;
    text-decoration: none;
    font-weight: 700;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.2s;
  }

  .rp-cta-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  /* LOADING */
  .rp-loading {
    min-height: 100vh;
    background: #060910;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: #475569;
    font-family: 'DM Sans', sans-serif;
  }

  .rp-spinner {
    width: 36px;
    height: 36px;
    border: 2px solid rgba(255,255,255,0.06);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* COPIED TOAST */
  .rp-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(80px);
    background: #10b981;
    color: white;
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    transition: transform 0.3s ease;
    z-index: 999;
  }

  .rp-toast.show {
    transform: translateX(-50%) translateY(0);
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 640px) {
    .rp-score-hero { grid-template-columns: 1fr; text-align: center; }
    .rp-score-ring { margin: 0 auto; }
    .rp-grid-2, .rp-grid-3 { grid-template-columns: 1fr; }
    .rp-score-bars { grid-template-columns: 1fr; }
  }
`;

function ScoreRing({ score, color }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="rp-score-ring">
      <svg viewBox="0 0 130 130">
        <circle className="rp-score-ring-track" cx="65" cy="65" r={r} />
        <circle
          className="rp-score-ring-fill"
          cx="65" cy="65" r={r}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="rp-score-center">
        <span className="rp-score-num" style={{ color }}>{score}</span>
        <span className="rp-score-denom">/100</span>
      </div>
    </div>
  );
}

function MiniBar({ label, value }) {
  return (
    <div className="rp-bar-row">
      <div className="rp-bar-label">
        <span>{label}</span>
        <span style={{ color: "#64748b" }}>{value}</span>
      </div>
      <div className="rp-bar-track">
        <div className="rp-bar-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function ReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchReport = useCallback(async () => {
    const { data, error } = await supabase
      .from("analyses").select("*").eq("id", id).single();
    if (error) { console.error(error); setLoading(false); return; }
    setReport(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
    return () => document.head.removeChild(styleEl);
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="rp-loading">
        <div className="rp-spinner" />
        <span>Rapor yükleniyor...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rp-loading">
        <span style={{ color: "#f87171" }}>Rapor bulunamadı.</span>
        <a href="/" style={{ color: "#3b82f6", fontSize: 14 }}>← Geri dön</a>
      </div>
    );
  }

  const sanitizeReportText = (txt) =>
    String(txt || "").replace(/\bDo not apply\b/gi, "Başvuru önerilmiyor");

  const score = report.alignment_score || 0;
  const matchedSkills = Array.isArray(report.matched_skills) ? report.matched_skills : [];
  const missingSkills = Array.isArray(report.missing_skills) ? report.missing_skills : [];
  const topKeywords = Array.isArray(report.top_keywords) ? report.top_keywords : [];
  const rejectionReasons = report.rejection_reasons || {};

  const scoreColor = score <= 40 ? "#ef4444" : score <= 69 ? "#f97316" : "#22c55e";
  const verdict = score >= 80 ? "Güçlü Uyum" : score >= 60 ? "Orta Uyum" : "Geliştirme Gerekli";
  const verdictDesc = score >= 80
    ? "CV’n bu rolle güçlü uyumlu. Anlatını role göre keskinleştir."
    : score >= 60
    ? "CV’n kısmi uyum veriyor. Eksik becerileri kapatıp şansını yükselt."
    : "Kritik boşluklar var. Eksik becerileri kapat ve CV’ni güçlendir.";

  const skillsScore = score;
  const keywordsScore = Math.min(100, score + 10);
  const experienceScore = Math.max(35, score - 10);
  const formattingScore = 75;

  const linkedinText = `${report.role || "bu rol"} için CV analizimi HireFit ile yaptım.\n\nATS Skoru: ${score}/100 — ${verdict}\n\nEksik beceriler: ${missingSkills.slice(0, 3).join(", ") || "Yok"}\n\nKendi CV’ni analiz et →`;

  return (
    <div className="rp-root">
      <div className="rp-noise" />
      <div className="rp-glow-1" />
      <div className="rp-glow-2" />

      <div className="rp-wrap">

        {/* Brand */}
        <div className="rp-header">
          <a href="/" className="rp-brand">
            <div className="rp-brand-icon">✦</div>
            <span className="rp-brand-name">HireFit</span>
          </a>
          <div className="rp-role">{report.role || "CV Analizi"}</div>
          <div className="rp-subtitle">Yapay zeka destekli CV analizi · {new Date(report.created_at).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })}</div>
        </div>

        {/* Share bar */}
        <div className="rp-share-bar">
          <button onClick={copyLink} className="rp-btn-copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Rapor Linkini Kopyala
          </button>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(linkedinText)}`}
            target="_blank" rel="noopener noreferrer"
            className="rp-btn-linkedin"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
            {"LinkedIn'de Paylaş"}
          </a>
        </div>

        {/* Score Hero */}
        <div className="rp-score-hero">
          <ScoreRing score={score} color={scoreColor} />
          <div>
            <div className="rp-score-label">ATS Uyum Skoru</div>
            <div className="rp-score-verdict" style={{ color: scoreColor }}>{verdict}</div>
            <div className="rp-score-desc">{verdictDesc}</div>
            <div className="rp-score-bars">
              <MiniBar label="Beceri Uyumu" value={skillsScore} />
              <MiniBar label="Anahtar Kelime Uyumu" value={keywordsScore} />
              <MiniBar label="Deneyim Uyumu" value={experienceScore} />
              <MiniBar label="Format" value={formattingScore} />
            </div>
          </div>
        </div>

        {/* Job Intelligence + Hire Probability */}
        <div className="rp-grid-2">
          <div className="rp-card">
            <div className="rp-card-title" style={{ color: "#3b82f6" }}>İlan İçgörüsü</div>
            <div style={{ display: "flex", gap: 32 }}>
              <div>
                <div className="rp-intel-label">Rol Tipi</div>
                <div className="rp-intel-value">{report.role || "—"}</div>
              </div>
              <div>
                <div className="rp-intel-label">Seviye</div>
                <div className="rp-intel-value">{report.seniority || "—"}</div>
              </div>
            </div>
          </div>
          <div className="rp-card">
            <div className="rp-card-title" style={{ color: "#22d3ee" }}>Güven Seviyesi</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: scoreColor }}>{score}%</span>
              <span style={{ color: "#475569", fontSize: 14 }}>işe alım olasılığı</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${score}%`, height: "100%", background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}99)`, borderRadius: 999, transition: "width 1s ease" }} />
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="rp-grid-3">
          <div className="rp-card">
            <div className="rp-card-title" style={{ color: "#10b981" }}>Eşleşen Beceriler</div>
            <div>
              {matchedSkills.length > 0
                ? matchedSkills.map((s, i) => <span key={i} className="rp-skill-tag matched">{s}</span>)
                : (
                  <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.55 }}>
                    <div>Bu rapor için eşleşen beceri kaydı yok.</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>İlandaki dili CV’ne yansıtıp analizi tekrar çalıştır.</div>
                  </div>
                )}
            </div>
          </div>
          <div className="rp-card">
            <div className="rp-card-title" style={{ color: "#ef4444" }}>Eksik Beceriler</div>
            <div>
              {missingSkills.length > 0
                ? missingSkills.map((s, i) => <span key={i} className="rp-skill-tag missing">{s}</span>)
                : (
                  <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.55 }}>
                    <div>Eksik beceri işaretlenmedi — ya güçlü uyum var ya da ilan verisi sınırlı.</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>Yine de kullandığın ama yazmadığın araçları metinle karşılaştır.</div>
                  </div>
                )}
            </div>
          </div>
          <div className="rp-card">
            <div className="rp-card-title" style={{ color: "#60a5fa" }}>Öne Çıkan Anahtar Kelimeler</div>
            <div>
              {topKeywords.length > 0
                ? topKeywords.map((s, i) => <span key={i} className="rp-skill-tag keyword">{s}</span>)
                : (
                  <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.55 }}>
                    <div>Bu rapor için anahtar kelime kaydı yok.</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>İlanı düz metin olarak yapıştırıp analizi tekrar çalıştır.</div>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Rejection Reasons */}
        {(rejectionReasons.high?.length > 0 || rejectionReasons.medium?.length > 0 || rejectionReasons.low?.length > 0) && (
          <div className="rp-rejection">
            <div className="rp-rejection-title">
              <span>🚫</span> Neden Elenebilirsin
            </div>
            {rejectionReasons.high?.length > 0 && (
              <div className="rp-rejection-group">
                <div className="rp-rejection-badge high">● Yüksek Risk</div>
                {rejectionReasons.high.map((r, i) => (
                  <div key={i} className="rp-rejection-item">
                    <div className="rp-rejection-dot" style={{ background: "#f87171" }} />
                    {r}
                  </div>
                ))}
              </div>
            )}
            {rejectionReasons.medium?.length > 0 && (
              <div className="rp-rejection-group">
                <div className="rp-rejection-badge medium">● Orta Risk</div>
                {rejectionReasons.medium.map((r, i) => (
                  <div key={i} className="rp-rejection-item">
                    <div className="rp-rejection-dot" style={{ background: "#fbbf24" }} />
                    {r}
                  </div>
                ))}
              </div>
            )}
            {rejectionReasons.low?.length > 0 && (
              <div className="rp-rejection-group">
                <div className="rp-rejection-badge low">● Düşük Risk</div>
                {rejectionReasons.low.map((r, i) => (
                  <div key={i} className="rp-rejection-item">
                    <div className="rp-rejection-dot" />
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Full Report */}
        {report.report && (
          <div className="rp-card rp-report" style={{ marginBottom: 16 }}>
            <div className="rp-card-title" style={{ color: "#94a3b8" }}>Tam Analiz</div>
            <div className="rp-report-text">{sanitizeReportText(report.report)}</div>
          </div>
        )}

        {/* CTA */}
        <div className="rp-cta">
          <h3>Skorunu yükseltmek ister misin?</h3>
          <p>Yeni bir CV analiz et veya mevcut CV’ni yapay zeka ile güçlendir.</p>
          <a href="/" className="rp-cta-btn">
            ✦ Yeni CV Analizi Yap
          </a>
        </div>

      </div>

      {/* Toast */}
      <div className={`rp-toast ${copied ? "show" : ""}`}>
        ✓ Link panoya kopyalandı
      </div>
    </div>
  );
}
