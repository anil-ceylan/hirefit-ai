import supabase from "./supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, FileText, Briefcase, AlertCircle, Loader2,
  Upload, Copy, Wand2, Target, Search, History, Trash2,
  CheckCircle2, ArrowRight, LogIn, LogOut, Download, Mail,
  Zap, Star, TrendingUp, Crown,
} from "lucide-react";

import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const translations = {
  EN: {
    heroTitle: "Why does your CV keep getting rejected?",
    heroDesc: "HireFit analyzes your CV against any job description and tells you exactly what recruiters see — in seconds.",
    analyzeBtn: "Analyze My CV Free",
    viewDashboard: "View Dashboard",
    checkFit: "Check My Fit",
    optimizeCV: "Optimize CV",
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
  },
  TR: {
    heroTitle: "CV'niz neden sürekli reddediliyor?",
    heroDesc: "HireFit, CV'nizi iş ilanıyla karşılaştırır ve işe alım uzmanlarının tam olarak ne gördüğünü saniyeler içinde söyler.",
    analyzeBtn: "CV'mi Ücretsiz Analiz Et",
    viewDashboard: "Paneli Görüntüle",
    checkFit: "Uyumu Kontrol Et",
    optimizeCV: "CV'yi Optimize Et",
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
  }
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

function DecisionCard({ data, loading, lang }) {
  if (loading) return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #3b82f6", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: "#475569" }}>{lang === "TR" ? "Karar analizi yapılıyor..." : "Analyzing your decision..."}</span>
    </div>
  );
  if (!data) return null;

  const decisionColor = data.decision?.includes("High") || data.decision?.includes("Yüksek") ? "#10b981"
    : data.decision?.includes("Medium") || data.decision?.includes("Orta") ? "#f59e0b" : "#f87171";
  const decisionBg = data.decision?.includes("High") || data.decision?.includes("Yüksek") ? "rgba(16,185,129,0.08)"
    : data.decision?.includes("Medium") || data.decision?.includes("Orta") ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)";
  const decisionBorder = data.decision?.includes("High") || data.decision?.includes("Yüksek") ? "rgba(16,185,129,0.2)"
    : data.decision?.includes("Medium") || data.decision?.includes("Orta") ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)";

  return (
    <div style={{ background: "#0c0c0c", border: `1px solid ${decisionBorder}`, borderRadius: 20, padding: 24, marginBottom: 16, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${decisionColor}, transparent)` }} />
      
      {/* Decision */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div style={{ padding: "10px 20px", borderRadius: 12, background: decisionBg, border: `1px solid ${decisionBorder}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: decisionColor, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
            {lang === "TR" ? "Karar" : "Decision"}
          </div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: decisionColor }}>{data.decision}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "#8a8a8a", lineHeight: 1.6, marginBottom: 8 }}>{data.decision_reasoning}</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: "#d4af37", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 8, padding: "6px 12px", display: "inline-block" }}>
            💡 {data.one_liner}
          </div>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
            {lang === "TR" ? "Şu an → Sonra" : "Now → After"}
          </div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#f87171" }}>{data.fit_score}</div>
          <div style={{ fontSize: 16, color: "#475569", margin: "2px 0" }}>→</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#10b981" }}>{data.improved_score}</div>
        </div>
      </div>

      {/* Top 3 Fixes */}
      {(data.top_fixes || []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#d4af37", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            {lang === "TR" ? "Top 3 Kritik Düzeltme" : "Top 3 Critical Fixes"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.top_fixes.slice(0, 3).map((fix, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, color: "rgba(212,175,55,0.5)", flexShrink: 0 }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 12, color: "#f87171", fontWeight: 600, marginBottom: 3 }}>⚠ {fix.problem}</div>
                  <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>→ {fix.fix}</div>
                </div>
                <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: fix.impact === "High" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", color: fix.impact === "High" ? "#f87171" : "#fbbf24", border: `1px solid ${fix.impact === "High" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}` }}>
                    {fix.impact}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deadline Plan */}
      {data.deadline_plan?.steps?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#d4af37", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            {lang === "TR" ? "⏰ Aksiyon Planı" : "⏰ Action Plan"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {data.deadline_plan.steps.map((step, i) => (
              <div key={i} style={{ flex: "1 1 160px", padding: "10px 14px", background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", marginBottom: 4, letterSpacing: "0.08em" }}>{step.day}</div>
                <div style={{ fontSize: 12, color: "#8a8a8a", lineHeight: 1.5 }}>{step.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressStepper({ cvText, jdText, loading, analysisData, lang }) {
  const t = translations[lang];
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

function DashboardResults({ data, score, matchedSkills, missingSkills, topKeywords, result, optimizedCv, learningPlan, downloadText, lang }) {
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

  const verdict = score >= 80
    ? (lang === "TR" ? "Güçlü Eşleşme" : "Strong Match")
    : score >= 60
    ? (lang === "TR" ? "Orta Eşleşme" : "Moderate Match")
    : (lang === "TR" ? "Geliştirilmeli" : "Needs Work");

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

  return (
    <>
      <div style={DB.root}>
        {/* HERO */}
        <div style={DB.hero}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(180deg, #d4af37, #b8860b, #8b6914)", borderRadius: "3px 0 0 3px" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 76, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.03em", background: "linear-gradient(135deg, #f0d060, #d4af37, #b8860b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{displayScore}</div>
            <div style={{ fontSize: 11, color: "#7a7a7a", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{lang === "TR" ? "100 üzerinden" : "out of 100"}</div>
            <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 4, background: "rgba(212,175,55,0.08)", color: "#d4af37", border: "1px solid rgba(212,175,55,0.2)", marginTop: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>{verdict}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#d4af37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>{data.role_type || "Role"}</div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: "#e8e8e8", lineHeight: 1.3, marginBottom: 12, fontStyle: "italic" }}>
              {score >= 80
                ? (lang === "TR" ? "Güçlü bir eşleşme — detayları cilalayın ve güvenle başvurun." : "You're a strong match — polish the details and apply with confidence.")
                : score >= 60
                ? <span>{lang === "TR" ? <>Yakınsınız — ancak <span style={{ fontStyle: "normal", color: "#f87171" }}>{(data.missing_skills || []).length} eksiklik</span> sizi listeden çıkarıyor.</> : <>You're close — but <span style={{ fontStyle: "normal", color: "#f87171" }}>{(data.missing_skills || []).length} gaps</span> are keeping you out of the yes pile.</>}</span>
                : <span>{lang === "TR" ? <>Önemli eksiklikler tespit edildi — <span style={{ fontStyle: "normal", color: "#f87171" }}>hepsi düzeltilebilir.</span></> : <>Significant gaps detected — <span style={{ fontStyle: "normal", color: "#f87171" }}>but all fixable.</span></>}</span>}
            </div>
            <div style={{ fontSize: 13, color: "#7a7a7a", lineHeight: 1.65 }}>{data.fit_summary || ""}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <div style={{ fontSize: 10, color: "#7a7a7a", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>{lang === "TR" ? "AI Güveni" : "AI Confidence"}</div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 38, color: "#d4af37", lineHeight: 1 }}>{data.confidence_score || (data.confidence_level === "High" ? 78 : data.confidence_level === "Medium" ? 62 : 45)}%</div>
            <div style={{ width: 110, height: 3, background: "#1c1c1c", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${data.confidence_score || 70}%`, borderRadius: 999, background: "linear-gradient(90deg, #d4af37, #f0d060)" }} />
            </div>
            <div style={{ fontSize: 11, color: "#7a7a7a", textAlign: "right", lineHeight: 1.5 }}>{data.confidence_basis || (data.confidence_level + " confidence")}</div>
          </div>
        </div>

        {/* STAT CARDS */}
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

        {/* SECTION 01 */}
        <div style={DB.sectionHeader}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#d4af37", fontStyle: "italic" }}>01</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d4af37", textTransform: "uppercase", letterSpacing: "0.14em" }}>{lang === "TR" ? "İşe Alım Uzmanı Görüşü" : "Recruiter View"}</div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.2), transparent)" }} />
        </div>
        <div style={DB.grid2}>
          <div style={DB.card}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "16px 16px 0 0", background: "linear-gradient(90deg, #d4af37, #f0d060)" }} />
            <div style={DB.cardTag}>{lang === "TR" ? "İşe alım uzmanının gerçekte ne düşündüğü" : "What the recruiter actually thinks"}</div>
            <div style={{ borderLeft: "2px solid #d4af37", padding: "14px 16px", background: "rgba(212,175,55,0.03)", borderRadius: "0 10px 10px 0", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 15, color: "#8a8a8a", lineHeight: 1.7, fontStyle: "italic" }}>"{data.recruiter_simulation?.internal_monologue || data.fit_summary || "Analysis complete."}"</div>
              <div style={{ fontSize: 11, color: "#d4af37", fontWeight: 700, marginTop: 8, letterSpacing: "0.04em" }}>— {data.recruiter_simulation?.sector || "Industry"} {lang === "TR" ? "İşe Alım Uzmanı" : "Recruiter"} · {data.seniority || "Junior"} {lang === "TR" ? "seviye işe alım" : "level hiring"}</div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 6, background: data.recruiter_simulation?.would_interview ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${data.recruiter_simulation?.would_interview ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`, color: data.recruiter_simulation?.would_interview ? "#10b981" : "#f87171", fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: data.recruiter_simulation?.would_interview ? "#10b981" : "#f87171", display: "inline-block", flexShrink: 0 }} />
              {data.recruiter_simulation?.decision || (data.recruiter_simulation?.would_interview ? (lang === "TR" ? "Listeye alır" : "Would shortlist") : (lang === "TR" ? "İlerlemez" : "Would not proceed"))}
            </div>
            {(data.recruiter_simulation?.red_flags || []).length > 0 && (
              <div style={DB.moreLink}>+ {data.recruiter_simulation.red_flags.length} {lang === "TR" ? "kırmızı bayrak tespit edildi" : `red flag${data.recruiter_simulation.red_flags.length > 1 ? "s" : ""} detected`} →</div>
            )}
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

        {/* SECTION 02 */}
        <div style={DB.sectionHeader}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#d4af37", fontStyle: "italic" }}>02</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d4af37", textTransform: "uppercase", letterSpacing: "0.14em" }}>{lang === "TR" ? "Derin Analiz" : "Deep Analysis"}</div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.2), transparent)" }} />
        </div>
        <div style={DB.grid2}>
          <div style={DB.card}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "16px 16px 0 0", background: "linear-gradient(90deg, #d4af37, #10b981)" }} />
            <div style={DB.cardTag}>{lang === "TR" ? "Siz ve hayal ettikleri aday" : "You vs the candidate they're picturing"}</div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, fontWeight: 800, color: "#e8e8e8", marginBottom: 16, lineHeight: 1.25 }}>
              {lang === "TR" ? `Açık %${data.benchmark?.gap_percentage || 35}.` : `Gap is ${data.benchmark?.gap_percentage || 35}%.`} <em style={{ color: "#8a8a8a", fontSize: 16 }}>{lang === "TR" ? "Çoğu kapatılabilir." : "Most of it is closeable."}</em>
            </div>
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
            {(data.role_matches || []).slice(0, 4).map((r, i) => {
              const colors = ["#10b981", "#60a5fa", "#f59e0b", "#555555"];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: colors[i], width: 36, flexShrink: 0 }}>{r.match_score}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: i < 3 ? "#c8c8c8" : "#6a6a6a", flex: 1 }}>{r.role}</span>
                  <div style={{ width: `${r.match_score * 0.6}px`, height: 2, borderRadius: 999, background: i < 3 ? `linear-gradient(90deg, #d4af37, ${colors[i]})` : "#1c1c1c" }} />
                </div>
              );
            })}
            {(data.role_matches || []).length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#7a7a7a", lineHeight: 1.5 }}>{data.role_matches[0]?.reason || ""}</div>
            )}
          </div>
        </div>

        {/* SECTION 03 */}
        <div style={DB.sectionHeader}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#d4af37", fontStyle: "italic" }}>03</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d4af37", textTransform: "uppercase", letterSpacing: "0.14em" }}>{lang === "TR" ? "Aksiyon Planı" : "Action Plan"}</div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.2), transparent)" }} />
        </div>
        <div style={DB.grid2}>
          <div style={DB.card}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "16px 16px 0 0", background: "linear-gradient(90deg, #d4af37, #7c3aed)" }} />
            <div style={DB.cardTag}>{lang === "TR" ? "Mülakat Hazırlığı" : "Interview Prep"}</div>
            {(data.interview_prep || []).slice(0, 2).map((q, i) => (
              <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i === 0 ? "1px solid #1c1c1c" : "none" }}>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 15, color: "#e8e8e8", lineHeight: 1.5, marginBottom: 5, fontStyle: "italic" }}>"{q.question}"</div>
                <div style={{ fontSize: 11, color: "#7a7a7a", marginBottom: 4, fontWeight: 500 }}>{q.why_asked}</div>
                <div style={{ fontSize: 12, color: "#d4af37", fontWeight: 700 }}>{q.personal_angle}</div>
              </div>
            ))}
            {(data.interview_prep || []).length > 2 && (
              <div style={DB.moreLink}>+ {data.interview_prep.length - 2} {lang === "TR" ? "daha fazla soru →" : "more questions →"}</div>
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

        {/* SECTION 04 */}
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
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: 20, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: T.green }}>{t.learningRoadmapTitle}</div>
            <button className="hf-btn-ghost" onClick={() => navigator.clipboard.writeText(learningPlan)} style={{ fontSize: "12px", padding: "7px 14px", borderRadius: 8 }}><Copy size={12} />{t.copy}</button>
          </div>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", lineHeight: 1.8, color: "#94a3b8" }}>{learningPlan}</pre>
        </div>
      )}
    </>
  );
}

function NavBar({ view, user, logout, navigate, lang, setLang }) {
  const t = translations[lang];
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(null);

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
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", lineHeight: 1, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI Resume</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "6px", boxShadow: "0 4px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
          {[{ label: t.home, path: "/", viewKey: "landing" }, { label: t.product, path: "/app", viewKey: "app" }, { label: t.dashboard, path: "/dashboard", viewKey: "dashboard" }].map(({ label, path, viewKey }) => (
            <button key={viewKey} onClick={() => navigate(path)} className={`hf-nav-pill ${view === viewKey ? "active" : ""}`}>{label}</button>
          ))}
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

function HeroSection({ navigate, lang }) {
  const t = translations[lang];
  const [score, setScore] = useState(0);
  const [animating, setAnimating] = useState(false);

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
        .hero-badge { animation: heroFadeUp 0.6s 0.1s ease both; }
        .hero-h1 { animation: heroFadeUp 0.6s 0.2s ease both; }
        .hero-desc { animation: heroFadeUp 0.6s 0.3s ease both; }
        .hero-btns { animation: heroFadeUp 0.6s 0.4s ease both; }
        .hero-card { animation: heroFadeUp 0.6s 0.5s ease both, floatY 5s 1s ease-in-out infinite; }
        .hero-stat { transition: all 0.3s ease; }
        .hero-stat:hover { transform: translateY(-2px); }
        .score-ring-fill { transition: stroke-dashoffset 1.5s cubic-bezier(0.34,1.2,0.64,1); }
        .shimmer-text { background: linear-gradient(90deg, #60a5fa 0%, #a78bfa 25%, #f472b6 50%, #a78bfa 75%, #60a5fa 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 4s linear infinite; }
      `;
      document.head.appendChild(el);
    }
  }, []);

  const handleDemoClick = () => {
    setAnimating(true);
    let i = 0;
    const target = 78;
    const interval = setInterval(() => {
      i += 2;
      setScore(Math.min(i, target));
      if (i >= target) { clearInterval(interval); setAnimating(false); }
    }, 20);
  };

  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#3b82f6";

  return (
    <section style={{ position: "relative", padding: "100px 0 80px", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-150px", left: "-100px", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12), transparent 65%)", animation: "orb1 12s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-100px", right: "-100px", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.08), transparent 65%)", animation: "orb2 15s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />
      <div style={{ ...styles.container, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center", position: "relative", zIndex: 2 }}>
        <div>
          <div className="hero-badge" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 999, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", fontSize: "12px", fontWeight: 700, color: "#a78bfa", marginBottom: 28, letterSpacing: "0.04em" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6", display: "inline-block", boxShadow: "0 0 8px #8b5cf6" }} />
            {lang === "TR" ? "AI Destekli Özgeçmiş Analizi" : "AI-Powered Resume Intelligence"}
          </div>
          <h1 className="hero-h1" style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(42px, 4.5vw, 68px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 20 }}>
            {lang === "TR" ? (
              <>CV'niz neden sürekli<br />reddediliyor?</>
            ) : (
              <>Why does your<br />CV keep getting<br /><span className="shimmer-text">rejected?</span></>
            )}
          </h1>
          <p className="hero-desc" style={{ fontSize: "17px", lineHeight: 1.7, color: "#94a3b8", maxWidth: "480px", marginBottom: 36 }}>
            {t.heroDesc}
          </p>
          <div className="hero-btns" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 48 }}>
            <button className="hf-btn-primary" onClick={() => navigate("/app")} style={{ padding: "14px 32px", fontSize: "15px", background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 0 32px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)", borderRadius: 12 }}>
              {t.analyzeBtn} <ArrowRight size={16} />
            </button>
            <button className="hf-btn-ghost" onClick={() => navigate("/dashboard")} style={{ padding: "14px 24px", fontSize: "15px", borderRadius: 12 }}>{t.viewDashboard}</button>
          </div>
          <div className="hero-desc" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex" }}>
              {["#3b82f6", "#8b5cf6", "#ec4899", "#10b981"].map((c, i) => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: "2px solid #060910", marginLeft: i === 0 ? 0 : -8, display: "grid", placeItems: "center", fontSize: "10px", fontWeight: 700, color: "white" }}>{["A","B","C","D"][i]}</div>
              ))}
            </div>
            <div style={{ fontSize: "13px", color: "#64748b" }}><span style={{ color: "#f1f5f9", fontWeight: 600 }}>2,400+</span> {lang === "TR" ? "CV bu hafta analiz edildi" : "CVs analyzed this week"}</div>
          </div>
        </div>
        <div className="hero-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "32px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)" }} />
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: 20 }}>{lang === "TR" ? "Canlı Analiz Önizlemesi" : "Live Analysis Preview"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 24 }}>
              <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
                <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                  <circle className="score-ring-fill" cx="60" cy="60" r={r} fill="none" stroke={scoreColor} strokeWidth="7" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</span>
                  <span style={{ fontSize: "11px", color: "#475569" }}>/100</span>
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 700, marginBottom: 6, color: score > 0 ? scoreColor : "#f1f5f9" }}>
                  {score === 0
                    ? (lang === "TR" ? "Demo için Tıklayın" : "Click to Demo")
                    : score >= 80
                    ? (lang === "TR" ? "Güçlü Eşleşme" : "Strong Match")
                    : score >= 60
                    ? (lang === "TR" ? "Orta Eşleşme" : "Moderate Match")
                    : (lang === "TR" ? "Geliştirilmeli" : "Needs Work")}
                </div>
                <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5, marginBottom: 12 }}>
                  {score === 0
                    ? (lang === "TR" ? "HireFit'in CV'nizi gerçek zamanlı analiz ettiğini görün" : "See how HireFit analyzes your CV in real time")
                    : (lang === "TR" ? "Beceriler, anahtar kelimeler, deneyim ve biçimlendirmeye göre" : "Based on skills, keywords, experience & formatting")}
                </div>
                <button onClick={handleDemoClick} disabled={animating} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#a78bfa", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  {animating ? (lang === "TR" ? "Analiz ediliyor..." : "Analyzing...") : "▶ Run Demo"}
                </button>
              </div>
            </div>
            {score > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
                {[[lang === "TR" ? "Beceri Eşleşmesi" : "Skills Match", score], [lang === "TR" ? "Anahtar Kelimeler" : "Keywords", Math.min(100, score + 8)], [lang === "TR" ? "Deneyim" : "Experience", Math.max(30, score - 12)], [lang === "TR" ? "Biçimlendirme" : "Formatting", 75]].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", marginBottom: 4 }}><span>{label}</span><span>{val}</span></div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${val}%`, height: "100%", background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", borderRadius: 999, transition: "width 1.2s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: lang === "TR" ? "Ort. skor artışı" : "Avg. score boost", value: "+23pts", color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.15)" },
              { label: lang === "TR" ? "Analiz süresi" : "Analysis time", value: "~8sec", color: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.15)" },
              { label: lang === "TR" ? "Ücretsiz kullanım" : "Free to use", value: "100%", color: "#8b5cf6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.15)" },
            ].map(({ label, value, color, bg, border }) => (
              <div key={label} className="hero-stat" style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: 1.3 }}>{label}</div>
              </div>
            ))}
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
    { icon: "📊", tag: "Core", tagColor: "#60a5fa", tagBg: "rgba(59,130,246,0.1)", title: "ATS Score Engine", desc: "Multi-factor scoring across skills, keywords, experience, and formatting — the same way real ATS software evaluates you.", accent: "#3b82f6", glow: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.15)", stat: "87% accuracy" },
    { icon: "🚫", tag: "Differentiator", tagColor: "#f87171", tagBg: "rgba(239,68,68,0.1)", title: "Rejection Engine", desc: "We don't just score you — we tell you the exact reasons a recruiter would pass on your CV and how to fix each one.", accent: "#ef4444", glow: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.15)", stat: "Top differentiator" },
    { icon: "🔍", tag: "AI-Powered", tagColor: "#22d3ee", tagBg: "rgba(34,211,238,0.1)", title: "Keyword Intelligence", desc: "Extracts the exact keywords recruiters are scanning for, then shows you which ones are missing from your CV.", accent: "#22d3ee", glow: "rgba(34,211,238,0.08)", border: "rgba(34,211,238,0.15)", stat: "50+ keywords extracted" },
    { icon: "✨", tag: "Premium", tagColor: "#a78bfa", tagBg: "rgba(139,92,246,0.1)", title: "CV Rewriter", desc: "AI rewrites your entire CV to be stronger, more relevant, and fully optimized for the specific role you're targeting.", accent: "#8b5cf6", glow: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.15)", stat: "+23pts avg. boost" },
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
    ? ["Ayda 2 analiz", "ATS skoru", "Beceri açığı tespiti", "Paylaşılabilir rapor"]
    : ["2 analyses/month", "ATS score", "Skill gap detection", "Shareable report"];
  const proFeatures = lang === "TR"
    ? ["Sınırsız analiz", "Red Motoru", "CV Yeniden Yazıcı", "Gelişmiş içgörüler", "Paylaşılabilir raporlar", "Öncelikli destek"]
    : ["Unlimited analyses", "Rejection Engine", "CV Rewriter", "Advanced insights", "Shareable reports", "Priority support"];
  const coachFeatures = lang === "TR"
    ? ["Pro'daki her şey", "Beyaz etiketli raporlar", "10 müşteri daveti", "Koç paneli", "Müşteri yönetimi"]
    : ["Everything in Pro", "White-label reports", "10 client invites", "Coach dashboard", "Client management"];

  return (
    <section style={{ padding: "80px 0" }}>
      <div style={styles.container}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 999, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", fontSize: "11px", fontWeight: 700, color: "#60a5fa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
            {lang === "TR" ? "Fiyatlandırma" : "Pricing"}
          </div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(32px,4vw,52px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12, lineHeight: 1.1 }}>
            {lang === "TR" ? "Sade ve şeffaf fiyatlandırma" : "Simple, transparent pricing"}
          </h2>
          <p style={{ color: "#64748b", fontSize: "16px" }}>{lang === "TR" ? "Ücretsiz başla. Hazır olduğunda yükselt." : "Start free. Upgrade when you're ready."}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, maxWidth: 960, margin: "0 auto" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, padding: 32 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Free</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "48px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4 }}>$0</div>
            <div style={{ color: "#475569", fontSize: "13px", marginBottom: 24 }}>{lang === "TR" ? "Sonsuza kadar ücretsiz" : "Forever free"}</div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 24 }} />
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
              {freeFeatures.map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: "#94a3b8" }}><CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0 }} />{f}</li>
              ))}
            </ul>
            <button onClick={() => navigate("/app")} className="hf-btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: "14px" }}>
              {lang === "TR" ? "Başla" : "Get Started"}
            </button>
          </div>
          <div style={{ background: "linear-gradient(145deg, rgba(59,130,246,0.1), rgba(99,102,241,0.07))", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 24, padding: 32, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent)" }} />
            <div style={{ position: "absolute", top: 16, right: -30, background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", padding: "4px 40px", transform: "rotate(45deg)" }}>POPULAR</div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#93c5fd", marginBottom: 8 }}>Pro</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "48px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4 }}>$9.99</div>
            <div style={{ color: "#93c5fd", fontSize: "13px", marginBottom: 24 }}>{lang === "TR" ? "aylık" : "per month"}</div>
            <div style={{ height: 1, background: "rgba(99,102,241,0.2)", marginBottom: 24 }} />
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
              {proFeatures.map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: "#cbd5e1" }}><Star size={13} color="#818cf8" style={{ flexShrink: 0 }} />{f}</li>
              ))}
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
              {coachFeatures.map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: "#94a3b8" }}><CheckCircle2 size={14} color="#8b5cf6" style={{ flexShrink: 0 }} />{f}</li>
              ))}
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
    try {
      await supabase.from("waitlist").insert({ email });
      setSubmitted(true);
    } catch { setSubmitted(true); }
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
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                  {lang === "TR" ? "Listedesiniz!" : "You're on the list!"}
                </div>
                <div style={{ color: T.textSub, fontSize: 14 }}>
                  {lang === "TR" ? "Pro yayına girdiğinde sizi bilgilendireceğiz." : "We'll notify you when Pro launches."}
                </div>
              </div>
            ) : (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "36px 32px" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                  {lang === "TR" ? "Bekleme listesine katılın" : "Join the waitlist"}
                </div>
                <div style={{ color: T.textSub, fontSize: 14, marginBottom: 24 }}>
                  {lang === "TR" ? "Pro yayına girdiği anda haberdar olun." : "Be notified the moment Pro goes live."}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input className="hf-input" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
                  <button className="hf-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ justifyContent: "center", opacity: submitting ? 0.7 : 1 }}>
                    {submitting
                      ? <><Loader2 size={14} />{lang === "TR" ? "Katılınıyor..." : "Joining..."}</>
                      : <>{lang === "TR" ? "Beni Haberdar Et" : "Notify Me"} <ArrowRight size={14} /></>}
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
  const productLinks = lang === "TR"
    ? [["CV Analiz Et", "/app"], ["Panel", "/dashboard"], ["Fiyatlandırma", "/"]]
    : [["Analyze CV", "/app"], ["Dashboard", "/dashboard"], ["Pricing", "/"]];
  const legalLinks = lang === "TR"
    ? ["Gizlilik Politikası", "Kullanım Şartları", "Çerez Politikası"]
    : ["Privacy Policy", "Terms of Service", "Cookie Policy"];

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
              {lang === "TR"
                ? "AI destekli CV analizi — neden reddedildiğinizi ve nasıl düzelteceğinizi tam olarak söyler."
                : "AI-powered CV analysis that tells you exactly why you're getting rejected — and how to fix it."}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {["LinkedIn", "Twitter"].map(s => (<div key={s} style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: "12px", fontWeight: 600, color: "#64748b", cursor: "pointer" }}>{s}</div>))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#334155", marginBottom: 16 }}>
              {lang === "TR" ? "Ürün" : "Product"}
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {productLinks.map(([label, path]) => (
                <li key={label}><button onClick={() => navigate(path)} style={{ background: "none", border: "none", color: "#64748b", fontSize: "14px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }} onMouseEnter={e => e.currentTarget.style.color = "#f1f5f9"} onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>{label}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#334155", marginBottom: 16 }}>
              {lang === "TR" ? "Hukuki" : "Legal"}
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {legalLinks.map(label => (<li key={label}><span style={{ color: "#64748b", fontSize: "14px", cursor: "pointer" }}>{label}</span></li>))}
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
    if (path === "/dashboard") return "dashboard";
    if (path === "/login") return "login";
    return "landing";
  };

  const [view, setView] = useState(getInitialView);

  useEffect(() => {
    const path = location.pathname;
    if (path === "/app") setView("app");
    else if (path === "/dashboard") setView("dashboard");
    else if (path === "/login") setView("login");
    else setView("landing");
  }, [location.pathname]);

  const [user, setUser] = useState(null);
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
  const [learningPlan, setLearningPlan] = useState("");
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
  const [analysisCount, setAnalysisCount] = useState(0);
  const [deadline, setDeadline] = useState("1_week");
  const [targetRole, setTargetRole] = useState("");
  const [decisionData, setDecisionData] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);

  const t = translations[lang];

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
      const filtered = (data || []).filter(item =>
        !clearedAt || new Date(item.created_at) > new Date(clearedAt)
      );
      setHistory(filtered.map((item) => ({ id: item.id, createdAt: new Date(item.created_at).toLocaleString(), role: item.role, score: item.alignment_score, cvText: item.cv_text, jdText: item.job_description, report: item.report })));
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        if (event === "SIGNED_IN" && window.location.pathname === "/login") navigate("/dashboard");
      } else {
        setUser(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem("hirefit-user");
    const savedWaitlist = localStorage.getItem("hirefit-waitlist");
    if (savedUser) { try { setUser(JSON.parse(savedUser)); } catch {} }
    if (savedWaitlist) { try { setWaitlist(JSON.parse(savedWaitlist)); } catch {} }
    fetchAnalyses();
  }, []);

  useEffect(() => { localStorage.setItem("hirefit-history", JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem("hirefit-waitlist", JSON.stringify(waitlist)); }, [waitlist]);
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
      const res = await fetch("/api/extract-job", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: jobUrl }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setJdText(data.text);
    } catch { setError(lang === "TR" ? "İş ilanı çıkarılamadı. Manuel olarak yapıştırın." : "Could not extract job description. Paste JD manually."); }
    finally { setExtractingJob(false); }
  };

  const analyze = async () => {
    if (!cvText.trim() || !jdText.trim()) { setError(lang === "TR" ? "Lütfen hem CV'yi hem de iş ilanını yapıştırın." : "Please paste both the CV and the Job Description."); return; }

    if (!user) {
      const anonCount = Number(localStorage.getItem("hirefit-anon-count") || 0);
      if (anonCount >= 2) { setShowPaywall(true); return; }
      localStorage.setItem("hirefit-anon-count", String(anonCount + 1));
      setAnalysisCount(anonCount + 1);
    } else {
      const userCount = Number(localStorage.getItem(`hirefit-count-${user.id}`) || 0);
      if (userCount >= 2) { setShowPaywall(true); return; }
      localStorage.setItem(`hirefit-count-${user.id}`, String(userCount + 1));
      setAnalysisCount(userCount + 1);
    }

    setLoading(true); setError("");
    try {
      const res = await fetch("https://hirefit-ai-production.up.railway.app/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cvText, jobDescription: jdText, sector, lang }) });
      const data = await res.json();
      setAlignmentScore(data.alignment_score ?? null);
      setRoleType(data.role_type ?? "");
      setSeniority(data.seniority ?? "");
      setMatchedSkills(data.matched_skills ?? []);
      setMissingSkills(data.missing_skills ?? []);
      setTopKeywords(data.top_keywords ?? []);
      const reportText = `Fit Summary:\n${data.fit_summary ?? ""}\n\nStrengths:\n${(data.strengths ?? []).map(s => `- ${s}`).join("\n")}\n\nImprovement Suggestions:\n${(data.improvements ?? []).map(s => `- ${s}`).join("\n")}\n\nWhy You Might Get Rejected:\nHIGH: ${(data.rejection_reasons?.high ?? []).join(", ") || "None"}\nMEDIUM: ${(data.rejection_reasons?.medium ?? []).join(", ") || "None"}`.trim();
      setResult(reportText);
      setAnalysisData(data);
      await supabase.from("analyses").insert({ role: data.role_type ?? "Unknown", alignment_score: data.alignment_score ?? 0, cv_text: cvText, job_description: jdText, report: reportText, matched_skills: data.matched_skills ?? [], missing_skills: data.missing_skills ?? [], top_keywords: data.top_keywords ?? [], rejection_reasons: data.rejection_reasons ?? {}, seniority: data.seniority ?? "", user_id: user?.id ?? null });
      await fetchAnalyses();
      } catch (err) { 
      console.error(err); 
      setError(lang === "TR" ? "Analiz başarısız." : "Analysis failed. Check your API key or network."); 
    } finally { 
      setLoading(false);
      // Auto-trigger decision engine
      setDecisionLoading(true);
      try {
        console.log("DECISION REQUEST:", { lang, deadline, targetRole });
        const decisionRes = await fetch("https://hirefit-ai-production.up.railway.app/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cvText, jobDescription: jdText, sector, lang, deadline, targetRole })
        });
        const decisionResult = await decisionRes.json();
        setDecisionData(decisionResult);
      } catch (err) {
        console.error("Decision engine failed:", err);
      } finally {
        setDecisionLoading(false);
      }
    }
  };
    
  const optimizeCv = async () => {
    if (!cvText.trim() || !jdText.trim()) { setError(lang === "TR" ? "Lütfen önce hem CV'yi hem de iş ilanını yapıştırın." : "Please paste both the CV and JD first."); return; }
    setOptimizing(true); setError(""); setOptimizedCv("");
    try {
      const res = await fetch("https://hirefit-ai-production.up.railway.app/optimize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cvText, jobDescription: jdText, sector, lang }) });
      const data = await res.json();
      setOptimizedCv(data.optimizedCv || "");
    } catch { setError(lang === "TR" ? "CV optimizasyonu başarısız." : "CV optimization failed."); }
    finally { setOptimizing(false); }
  };

  const generateLearningPlan = async () => {
    if (!missingSkills.length) { setError(lang === "TR" ? "Henüz eksik beceri tespit edilmedi." : "No missing skills detected yet."); return; }
    setRoadmapLoading(true); setError(""); setLearningPlan("");
    try {
      const res = await fetch("https://hirefit-ai-production.up.railway.app/roadmap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ missingSkills, roleType, seniority }) });
      const data = await res.json();
      setLearningPlan(data.roadmap || "");
    } catch { setError(lang === "TR" ? "Öğrenme yol haritası oluşturulamadı." : "Failed to generate learning roadmap."); }
    finally { setRoadmapLoading(false); }
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setError(lang === "TR" ? "Lütfen bir PDF dosyası yükleyin." : "Please upload a PDF file."); return; }
    setUploadingPdf(true); setError("");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item, i) => {
          const nextItem = content.items[i + 1];
          const hasLineBreak = nextItem && Math.abs(nextItem.transform[5] - item.transform[5]) > 5;
          return item.str + (hasLineBreak ? "\n" : " ");
        }).join("");
        fullText += "\n" + pageText;
      }
      setCvText(fullText.trim());
    } catch { setError(lang === "TR" ? "PDF okunamadı." : "Failed to read PDF."); }
    finally { setUploadingPdf(false); }
  };

  const clearHistory = async () => {
    setHistory([]);
    localStorage.removeItem("hirefit-history");
    localStorage.setItem("hirefit-cleared-at", new Date().toISOString());
  };
  const loadHistoryItem = (item) => { setCvText(item.cvText || ""); setJdText(item.jdText || ""); setResult(item.report || ""); extractDataFromReport(item.report || ""); setOptimizedCv(""); setLearningPlan(""); setError(""); navigate("/app"); };
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
    setCvText("");
    setJdText("");
    setResult("");
    setAnalysisData(null);
    setAlignmentScore(null);
    setHistory([]);
    setOptimizedCv("");
    setLearningPlan("");
    navigate("/");
  };

  const downloadText = (content, filename) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const sectorLabels = lang === "TR"
    ? ["Otomatik", "Teknoloji / Startup", "Danışmanlık", "Finans", "FMCG / Perakende", "Sağlık", "Kamu"]
    : ["Auto-detect", "Tech / Startup", "Consulting", "Finance", "FMCG / Retail", "Healthcare", "Government"];
  const sectorValues = ["Auto-detect", "Tech / Startup", "Consulting", "Finance", "FMCG / Retail", "Healthcare", "Government"];

  return (
    <div style={styles.page}>
      <NavBar view={view} setView={setView} user={user} logout={logout} navigate={navigate} lang={lang} setLang={setLang} />

      {showPaywall && (
        <PaywallModal
          lang={lang}
          onClose={() => setShowPaywall(false)}
          onUpgrade={() => {
            setShowPaywall(false);
            window.open("https://hirefit.lemonsqueezy.com/checkout/buy/19ee5972-0f76-4d2f-b2a0-9e08dc9a9a7d", "_blank");
          }}
        />
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
            <StatCard title={t.currentPlan} value={plan} icon={<Crown size={16} color="#fbbf24" />} />
            <StatCard title={t.waitlistLeads} value={waitlist.length} icon={<Mail size={16} color={T.green} />} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <HistoryList history={history} onLoadItem={loadHistoryItem} onClear={clearHistory} lang={lang} />
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
      )}

      {view === "app" && (
        <div style={{ ...styles.container, padding: "40px 24px", minHeight: "calc(100vh - 80px)" }}>
          <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", fontSize: "11px", fontWeight: 700, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#8b5cf6", boxShadow: "0 0 6px #8b5cf6", display: "inline-block" }} />
                {lang === "TR" ? "AI Analizi" : "AI Analysis"}
              </div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px,3vw,42px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 6 }}>{t.cvAnalyzer}</h1>
              <p style={{ color: "#64748b", fontSize: "14px" }}>{t.cvAnalyzerDesc}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981", display: "inline-block" }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#10b981" }}>{t.freeToUse}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 20, alignItems: "start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 16, marginBottom: 16, width: "100%" }}>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 12, height: "480px", flex: "0 0 calc(50% - 8px)", width: "calc(50% - 8px)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "13px", color: "#f1f5f9" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <FileText size={13} color="#60a5fa" />
                      </div>
                      {t.candidateCV}
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontWeight: 600, fontSize: "11px", color: "#94a3b8", flexShrink: 0 }}>
                      <Upload size={11} />
                      {uploadingPdf ? t.reading : t.uploadPdf}
                      <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: "none" }} />
                    </label>
                  </div>
                  <textarea className="hf-textarea" placeholder={t.pasteCv} value={cvText} onChange={(e) => setCvText(e.target.value)} />
                  {cvText && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", color: "#10b981", flexShrink: 0 }}>
                      <CheckCircle2 size={11} />
                      {cvText.split(" ").length} {t.wordsLoaded}
                    </div>
                  )}
                </div>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 12, height: "480px", flex: "0 0 calc(50% - 8px)", width: "calc(50% - 8px)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Briefcase size={13} color="#22d3ee" />
                    </div>
                    <label style={{ fontWeight: 700, fontSize: "13px", color: "#f1f5f9" }}>{t.jobDesc}</label>
                  </div>
                  <textarea className="hf-textarea" placeholder={t.pasteJd} value={jdText} onChange={(e) => setJdText(e.target.value)} />
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <input className="hf-input" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder={lang === "TR" ? "Veya bir iş URL'si yapıştırın..." : "Or paste a job URL..."} style={{ flex: 1, fontSize: "12px", padding: "9px 12px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }} />
                    <button className="hf-btn-ghost" onClick={extractJobFromUrl} disabled={extractingJob} style={{ whiteSpace: "nowrap", fontSize: "12px", padding: "9px 14px", borderRadius: 8 }}>
                      {extractingJob ? <Loader2 size={12} /> : <Search size={12} />}
                      {extractingJob ? t.extracting : t.extract}
                    </button>
                  </div>
                </div>
              </div>

              {(() => {
                const count = user
                  ? Number(localStorage.getItem(`hirefit-count-${user.id}`) || 0)
                  : Number(localStorage.getItem("hirefit-anon-count") || 0);
                const remaining = Math.max(0, 2 - count);
                return remaining < 2 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, background: remaining === 0 ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${remaining === 0 ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)"}`, marginBottom: 8, fontSize: 13, color: remaining === 0 ? "#f87171" : "#fbbf24", fontWeight: 600 }}>
                    {remaining === 0
                      ? t.noFreeLeft
                      : `⚡ ${remaining} ${t.freeLimitWarning}`}
                  </div>
                ) : null;
              })()}

              <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
  <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
    {lang === "TR" ? "⏰ Başvuru zamanın:" : "⏰ Application deadline:"}
  </span>
  {[
    { value: "urgent", label: lang === "TR" ? "🔴 Acil (bugün)" : "🔴 Urgent (today)" },
    { value: "1_week", label: lang === "TR" ? "🟡 1 Hafta" : "🟡 1 Week" },
    { value: "1_month", label: lang === "TR" ? "🟢 1 Ay+" : "🟢 1 Month+" },
  ].map(({ value, label }) => (
    <button key={value} onClick={() => setDeadline(value)} style={{
      padding: "6px 14px", borderRadius: 999, fontSize: "12px", fontWeight: 600,
      cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
      background: deadline === value ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${deadline === value ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.07)"}`,
      color: deadline === value ? "#a78bfa" : "#475569",
    }}>{label}</button>
  ))}
</div>

              <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                {sectorValues.map((s, idx) => (
                  <button
                    key={s}
                    onClick={() => setSector(s)}
                    style={{
                      padding: "6px 14px", borderRadius: 999, fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                      background: sector === s ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${sector === s ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.07)"}`,
                      color: sector === s ? "#a78bfa" : "#475569",
                    }}
                  >
                    {sectorLabels[idx]}
                  </button>
                ))}
              </div>

              <ProgressStepper cvText={cvText} jdText={jdText} loading={loading} analysisData={analysisData} lang={lang} />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, padding: "16px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16 }}>
                <button className="hf-btn-primary" onClick={analyze} disabled={loading} style={{ opacity: loading ? 0.7 : 1, padding: "12px 24px", fontSize: "14px", background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: loading ? "none" : "0 0 24px rgba(99,102,241,0.3)", borderRadius: 10 }}>
                  {loading ? <><Loader2 size={14} />{t.analyzing}</> : <>{t.checkFit} <Sparkles size={14} /></>}
                </button>
                <button className="hf-btn-ghost" onClick={optimizeCv} disabled={optimizing} style={{ color: optimizing ? T.textMuted : T.cyan, borderColor: optimizing ? T.border : "rgba(34,211,238,0.2)", padding: "12px 20px", fontSize: "14px", borderRadius: 10 }}>
                  {optimizing ? <><Loader2 size={14} />{t.optimizing}</> : <><Wand2 size={14} />{t.optimizeCV}</>}
                </button>
                <button className="hf-btn-ghost" onClick={generateLearningPlan} disabled={roadmapLoading} style={{ color: roadmapLoading ? T.textMuted : T.green, borderColor: roadmapLoading ? T.border : "rgba(16,185,129,0.2)", padding: "12px 20px", fontSize: "14px", borderRadius: 10 }}>
                  {roadmapLoading ? <><Loader2 size={14} />{t.building}</> : <><Target size={14} />{t.learningRoadmap}</>}
                </button>
              </div>

              {error && (
                <div style={{ display: "flex", gap: 10, padding: "14px 16px", borderRadius: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#fca5a5", fontSize: "14px", marginBottom: 16 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}
                </div>
              )}

              {(decisionData || decisionLoading) && (
  <DecisionCard data={decisionData} loading={decisionLoading} lang={lang} />
)}

              {alignmentScore !== null && analysisData && (
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
                />
              )}
            </div>

            <aside>
              <div style={{ position: "sticky", top: 88 }}>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13px", fontWeight: 700 }}>
                      <History size={14} color={T.blue} />{t.previousAnalyses}
                    </div>
                    <button onClick={clearHistory} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontWeight: 600, fontSize: "11px", fontFamily: "'DM Sans', sans-serif" }}>
                      <Trash2 size={10} /> {t.clear}
                    </button>
                  </div>
                  {history.length === 0 ? (
                    <div style={{ color: "#334155", fontSize: "12px", textAlign: "center", padding: "24px 0" }}>{t.noAnalyses}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {history.map((item) => (
                        <div key={item.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, cursor: "pointer", transition: "all 0.2s" }} onClick={() => loadHistoryItem(item)}>
                          <div style={{ fontWeight: 700, marginBottom: 3, fontSize: "13px", color: "#f1f5f9" }}>{item.role}</div>
                          <div style={{ fontSize: "11px", color: item.score >= 80 ? T.green : item.score >= 60 ? "#f59e0b" : "#f87171", marginBottom: 2, fontWeight: 600 }}>{item.score}/100</div>
                          <div style={{ fontSize: "10px", color: "#334155" }}>{item.createdAt}</div>
                          <a href={`/report/${item.id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: "11px", color: T.cyan, textDecoration: "none", display: "block", marginTop: 6, fontWeight: 600 }}>{t.viewReport}</a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainApp;
