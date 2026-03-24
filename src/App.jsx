import supabase from "./supabaseClient";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Sparkles, FileText, Briefcase, AlertCircle, Loader2,
  Upload, Copy, Wand2, Target, Search, History, Trash2,
  CheckCircle2, BarChart3, ShieldCheck, Crown, ArrowRight,
  LogIn, LogOut, Download, Mail, Zap, Star, TrendingUp,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

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
  .hf-feature-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent); opacity: 0; transition: opacity 0.3s ease; }
  .hf-feature-card:hover { background: ${T.bgCardHover}; border-color: rgba(59,130,246,0.2); transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${T.blueGlow}; }
  .hf-feature-card:hover::before { opacity: 1; }
  .hf-input { width: 100%; padding: 13px 16px; border-radius: 10px; border: 1px solid ${T.border}; background: rgba(255,255,255,0.03); color: white; outline: none; font-family: 'DM Sans', sans-serif; font-size: 14px; transition: border-color 0.2s; }
  .hf-input:focus { border-color: rgba(59,130,246,0.5); }
  .hf-input::placeholder { color: ${T.textMuted}; }
  .hf-textarea { width: 100%; height: 300px; padding: 16px; border-radius: 12px; border: 1px solid ${T.border}; background: rgba(255,255,255,0.02); color: white; resize: none; outline: none; font-family: 'DM Sans', sans-serif; font-size: 14px; line-height: 1.6; transition: border-color 0.2s; }
  .hf-textarea:focus { border-color: rgba(59,130,246,0.5); }
  .hf-textarea::placeholder { color<div style={{ ...styles.container, position: "relative", zIndex: 2, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", margin: "0 auto", padding "0 24px" }}>: ${T.textMuted}; }
  .pricing-card { border-radius: 20px; padding: 32px; transition: all 0.3s ease; }
  .pricing-card.free { background: rgba(255,255,255,0.02); border: 1px solid ${T.border}; }
  .pricing-card.pro { background: linear-gradient(145deg, rgba(59,130,246,0.12), rgba(139,92,246,0.08)); border: 1px solid rgba(99,102,241,0.35); position: relative; overflow: hidden; }
  .pricing-card.pro::after { content: 'POPULAR'; position: absolute; top: 16px; right: -28px; background: ${T.blue}; color: white; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; padding: 4px 36px; transform: rotate(45deg); }
  .pricing-card:hover { transform: translateY(-4px); }
  .nav-link { padding: 8px 14px; border-radius: 8px; color: ${T.textSub}; font-size: 14px; font-weight: 500; cursor: pointer; border: none; background: transparent; font-family: 'DM Sans', sans-serif; transition: all 0.15s ease; }
  .nav-link:hover { color: white; background: rgba(255,255,255,0.06); }
  .nav-link.active { color: white; }
  .grid-bg { background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 48px 48px; }
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

function Badge({ children, bg, color }) {
  return (
    <span style={{ padding: "6px 12px", borderRadius: 999, background: bg, color, fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: 6 }}>
      {children}
    </span>
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

function HistoryList({ history, onLoadItem, onClear, compact = false }) {
  return (
    <div className="hf-card" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: compact ? "15px" : "18px", fontWeight: 700 }}>
          <History size={16} color={T.blue} />
          {compact ? "Previous Analyses" : "Recent Analyses"}
        </h3>
        <button onClick={onClear} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 600, fontSize: "12px", fontFamily: "'DM Sans', sans-serif" }}>
          <Trash2 size={12} /> Clear
        </button>
      </div>
      {history.length === 0 ? (
        <div style={{ color: T.textMuted, fontSize: "13px", textAlign: "center", padding: "24px 0" }}>No saved analyses yet.</div>
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
                View Report →
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

function parseSingleLine(text, sectionName) {
  const match = text.match(new RegExp(`${sectionName}:\\s*(.+)`, "i"));
  return match ? match[1].trim() : "";
}

function NavBar({ view, setView, user, logout }) {
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(6,9,16,0.85)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ ...styles.container, display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setView("landing")}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #6366f1)", display: "grid", placeItems: "center", boxShadow: `0 0 20px ${T.blueGlow}` }}>
            <Sparkles size={16} color="white" />
          </div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "18px", letterSpacing: "-0.01em" }}>HireFit</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className={`nav-link ${view === "landing" ? "active" : ""}`} onClick={() => setView("landing")}>Home</button>
          <button className={`nav-link ${view === "app" ? "active" : ""}`} onClick={() => setView("app")}>Product</button>
          <button className={`nav-link ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>Dashboard</button>
        </div>
        <div>
          {user ? (
            <button className="hf-btn-ghost" onClick={logout}>
              <LogOut size={14} />
              <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
            </button>
          ) : (
            <button className="hf-btn-primary" onClick={() => setView("login")} style={{ padding: "9px 20px", fontSize: "14px" }}>
              <LogIn size={14} /> Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function HeroSection({ setView }) {
  const [step, setStep] = useState("idle");
  const [fakeLoading, setFakeLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [targetScore, setTargetScore] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    setTimeout(() => setFakeLoading(false), 2000);
  }, []); 
  
 useEffect(() => {
  if (targetScore > 0) {
    let i = 0;

    const interval = setInterval(() => {
      i += 2;
      setScore(i);

      if (i >= targetScore) {
        setScore(targetScore);
        clearInterval(interval);
      }
    }, 20);

    return () => clearInterval(interval);
  }
}, [targetScore]);
 

     const startFakeUpload = () => {
      setUploading(true);
      setUploadProgress(0);
      setStep ("analyzing");

      const fakeAIResult = {
        score: 82
      };

      setTargetScore(fakeAIResult.score);

      let progress = 0;

      const interval = setInterval (() => {

        progress += 10;
        setUploadProgress(progress);

        if (progress >= 30) setStep ("keywords");
        if (progress >= 60) setStep ("matching");
        if (progress >= 90) setStep ("finalizing");



        if (progress >= 100) {
          progress = 100;
          clearInterval (interval);

          setTimeout (() => {
            setUploading (false);
            setUploaded (true);
            }, 500);
           } 

           setUploadProgress (progress);
           
          }, 300);

          };

  return (
    <section
      className="grid-bg"
      style={{
        position: "relative",
        padding: "1O8O 0 80px",
        overflow: "hidden",
      }}
    >
      {/* Background Glow */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          left: "20%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)",
          pointerEvents: "none",
        }}

      ></div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: "10%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(34,211,238,0.08), transparent 70%)",
          pointerEvents: "none",
       }}
       />
       

      {/* CONTENT */}
      <div
        style={{
          ...styles.container,
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            background: "rgba(59,130,246,0.1)",
            border: "1px solid rgba(59,130,246,0.25)",
            fontSize: "13px",
            fontWeight: 600,
            color: "#93c5fd",
            margin: "0 auto 28px",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: T.blue,
              display: "inline-block",
            }}
          />
          AI Resume Intelligence — Free to Use
        </div>

        {/* HEADLINE */}
        <h1
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "clamp(48px, 6vw, 82px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            maxWidth: "900px",
            marginBottom: 24,
          }}
        >
          Land interviews
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #60a5fa, #22d3ee)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            with AI-powered
          </span>
          <br />
          CV alignment.
        </h1>

        <div style={{
  marginTop: 40,
  maxWidth: 420,
  padding: 20,
  borderRadius: 16,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(10px)"
}}>
  
  <div style={{
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
    fontSize: 14,
    color: "#94a3b8"
  }}>
    <span>ATS Score</span>
    <span style={{
      fontWeight: 700,
      color: score >= 80 ? "#10b981" : "#22d3ee"
    }}>
      {fakeLoading ? "Scanning..." : `${score}/100`}
    </span>
  </div>

  <div style={{
    width: "100%",
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  }}>
    <div style={{
      width: fakeLoading ? "30%" : `${score}%`,
      height: "100%",
      background: "linear-gradient(90deg, #3b82f6, #22d3ee)",
      transition: "all 1s ease"
    }} />
  </div>

</div>

        {/* DESCRIPTION */}
        <p
          style={{
            fontSize: "18px",
            lineHeight: 1.7,
            color: T.textSub,
            maxWidth: "600px",
            margin: "20px auto 40px",
            textAlign: "center"
          }}
        >
          Get your ATS score in seconds. Discover exactly what recruiters look for, fix your gaps, and turn your CV into an interview magnet.
        </p>

        {/* BUTTONS */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 48,
          }}
        >
          <button
            className="hf-btn-primary"
            onClick={() => setView("app")}
            style={{ padding: "14px 28px", fontSize: "15px" }}
          >
            Get Your ATS Score Now <ArrowRight size={16} />
          </button>

          <button
            className="hf-btn-ghost"
            onClick={() => setView("dashboard")}
            style={{ padding: "14px 24px", fontSize: "15px" }}
          >
            View Dashboard
          </button>
        </div>

        {/* UPLOAD BOX */}
<div
  style={{
    marginTop: "40px",
    border: "1px dashed rgba(255,255,255,0.2)",
    borderRadius: "16px",
    padding: "40px",
    textAlign: "center",
    maxWidth: "500px",
    marginInline: "auto",
    background: "rgba(255,255,255,0.02)",
  }}
>
  {!uploading && !uploaded && (
    <>
      <p style={{ marginBottom: "16px", color: "#aaa" }}>
        Upload your CV (PDF)
      </p>

      <button
        onClick={startFakeUpload}
        style={{
          padding: "12px 24px",
          borderRadius: "10px",
          background: "#3b82f6",
          border: "none",
          color: "white",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        TEST
      </button>
    </>
  )}



{uploading && (
  <div style={{ marginTop: 16, textAlign: "center" }}>
    
    <div
      style={{
        width: "200px",
        height: "8px",
        background: "#1f2937",
        borderRadius: "999px",
        overflow: "hidden",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: `${uploadProgress}%`,
          height: "100%",
          background: "#3b82f6",
          transition: "width 0.3s ease",
        }}
      />
    </div>

    <p style={{ marginTop: 8, color: "#aaa" }}>
      Analyzing... {uploadProgress}%
    </p>

    <p style={{ marginTop: 6, color: "#888", fontSize: "14px" }}> 
      {step === "analyzing" && "Analyzing your CV..."}
      {step === "keywords" && "Extracting keywords..."}
      {step === "matching" && "Matching skills..."}
      {step === "finalizing" && "Generating final score..."}
        
     </p> 

  </div>
)}

{uploaded && (
  <div style={{ marginTop: 20, textAlign: "center" }}>
    <h3 style={{ color: "#22c55e", fontSize: "24px" }}>
      ATS Score: 87/100
    </h3>
  </div>
)}

  {uploading && (
    <>
      <p style={{ marginBottom: "12px", color: "#aaa" }}>
        Analyzing your CV...
      </p>

      <div
        style={{
          height: "8px",
          background: "#222",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${uploadProgress}%`,
            height: "100%",
            background: "linear-gradient(90deg, #60a5fa, #22d3ee)",
            transition: "width 0.3s",
          }}
        />
      </div>

      <p style={{ marginTop: "10px", fontSize: "12px", color: "#888" }}>
        {Math.floor(uploadProgress)}%
      </p>
    </>
  )}

  {uploaded && (
  <div
    style={{
      marginTop: 24,
      textAlign: "center",
      padding: "20px",
      borderRadius: "16px",
      background: "rgba(34,197,94,0.08)",
      border: "1px solid rgba(34,197,94,0.2)"
    }}
  >
    <h2 style={{ color: "#22c55e", fontSize: "28px", marginBottom: "8px" }}>
      ATS Score: 87/100
    </h2>

    <p style={{ color: "#4ade80", marginBottom: "16px" }}>
      ✔ Analysis Complete
    </p>

    <div style={{ marginTop: "10px" }}>
      <div style={{ fontSize: "14px", color: "#aaa", marginBottom: "6px" }}>
        Overall Match
      </div>

      <div
        style={{
          width: "100%",
          height: "10px",
          background: "#1f2937",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "87%",
            height: "100%",
            background: "#22c55e",
          }}
        />
      </div>
    </div>

  </div>
)}

</div>
        {/* FEATURES */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[
            {
              icon: <CheckCircle2 size={13} />,
              label: "ATS Scoring",
              color: T.green,
              bg: "rgba(16,185,129,0.1)",
              border: "rgba(16,185,129,0.2)",
            },
            {
              icon: <Target size={13} />,
              label: "Skill Gap Detection",
              color: "#60a5fa",
              bg: "rgba(59,130,246,0.1)",
              border: "rgba(59,130,246,0.2)",
            },
            {
              icon: <Wand2 size={13} />,
              label: "CV Optimizer",
              color: T.cyan,
              bg: "rgba(34,211,238,0.1)",
              border: "rgba(34,211,238,0.2)",
            },
          ].map(({ icon, label, color, bg, border }) => (
            <span
              key={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                background: bg,
                border: `1px solid ${border}`,
                color,
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {icon} {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCards() {
  const features = [
    { icon: <BarChart3 size={24} />, iconColor: "#60a5fa", iconBg: "rgba(59,130,246,0.12)", title: "ATS Score Engine", desc: "Quantifies your CV alignment with skills, keywords, experience, and formatting using a multi-factor scoring model.", tag: "Core" },
    { icon: <Search size={24} />, iconColor: T.cyan, iconBg: "rgba(34,211,238,0.12)", title: "Keyword Intelligence", desc: "Extracts the top keywords from any job description and pinpoints exactly what's missing from your CV.", tag: "AI-Powered" },
    { icon: <Wand2 size={24} />, iconColor: "#a78bfa", iconBg: "rgba(167,139,250,0.12)", title: "CV Optimizer", desc: "Rewrites your resume to be stronger, more relevant, and fully ATS-optimized for the specific role.", tag: "Premium" },
  ];
  return (
    <section style={{ padding: "80px 0" }}>
      <div style={styles.container}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", color: T.blue, textTransform: "uppercase", marginBottom: 12 }}>What HireFit Does</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "40px", fontWeight: 800, letterSpacing: "-0.02em" }}>Every tool you need to get hired</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {features.map(({ icon, iconColor, iconBg, title, desc, tag }) => (
            <div key={title} className="hf-feature-card">
              <div style={{ position: "absolute", top: 20, right: 20, fontSize: "11px", fontWeight: 700, color: iconColor, background: iconBg, padding: "3px 10px", borderRadius: 999, letterSpacing: "0.04em" }}>{tag}</div>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: iconColor, marginBottom: 20 }}>{icon}</div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 700, marginBottom: 10, letterSpacing: "-0.01em" }}>{title}</h3>
              <p style={{ color: T.textSub, fontSize: "14px", lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section style={{ padding: "80px 0" }}>
      <div style={styles.container}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", color: T.blue, textTransform: "uppercase", marginBottom: 12 }}>Pricing</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "40px", fontWeight: 800, letterSpacing: "-0.02em" }}>Simple, transparent pricing</h2>
          <p style={{ color: T.textSub, marginTop: 12, fontSize: "16px" }}>Start free. Upgrade when you're ready.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 760, margin: "0 auto" }}>
          <div className="pricing-card free">
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: T.textSub, marginBottom: 8 }}>Free</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "48px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>$0</div>
              <div style={{ color: T.textMuted, fontSize: "13px", marginTop: 6 }}>Forever free for students</div>
            </div>
            <div style={{ height: "1px", background: T.border, marginBottom: 24 }} />
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              {["CV vs JD analysis", "ATS score", "Skill gap detection", "Learning roadmap", "Local history"].map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: T.textSub }}>
                  <CheckCircle2 size={15} color={T.green} style={{ flexShrink: 0 }} />{f}
                </li>
              ))}
            </ul>
          </div>
          <div className="pricing-card pro">
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#93c5fd", marginBottom: 8 }}>Pro</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "48px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>$12</div>
              <div style={{ color: "#93c5fd", fontSize: "13px", marginTop: 6 }}>per month</div>
            </div>
            <div style={{ height: "1px", background: "rgba(99,102,241,0.25)", marginBottom: 24 }} />
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              {["Everything in Free", "Unlimited analyses", "Saved CV versions", "Shareable reports", "Team / recruiter mode"].map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: "#cbd5e1" }}>
                  <Star size={14} color="#818cf8" style={{ flexShrink: 0 }} />{f}
                </li>
              ))}
            </ul>
            <button className="hf-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 28, fontSize: "14px" }}>
              Join Waitlist <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function WaitlistSection() {
  return (
    <section style={{ padding: "80px 0 100px" }}>
      <div style={styles.container}>
        <div style={{ borderRadius: 24, background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.05))", border: "1px solid rgba(59,130,246,0.18)", padding: "56px 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-80px", right: "-80px", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", fontSize: "12px", fontWeight: 700, color: "#93c5fd", letterSpacing: "0.06em", marginBottom: 20, textTransform: "uppercase" }}>
              <Zap size={12} /> Pro Plan Coming Soon
            </div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "36px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 14, lineHeight: 1.15 }}>
              Be first to know<br />when Pro launches
            </h2>
            <p style={{ color: T.textSub, fontSize: "15px", lineHeight: 1.7 }}>
              Get early access, founding member pricing, and exclusive features before public launch.
            </p>
          </div>
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ background: "rgba(6,9,16,0.6)", borderRadius: 16, padding: 4, border: `1px solid ${T.border}` }}>
              <iframe
                width="100%" height="220"
                src="https://e2447a81.sibforms.com/serve/MUIFAJ45UwJ9NCi1s-BbG6gVUzLJ8Yvgp_B-f-eIKIPViV08D7HPKspDmKZIOj-3hgukEmXeUTXS1cAm5UFcwJuDFTizz4hpqDJ_ZpbjA5Bh3_uvwOdRKgXAoTPvBwLvlGfzXyM8fxSAoEHQhFaCTL1pSHILWQJIHH-qaO7HI4_4-pGQpSC6qjGNB6xWovBBaJtX9Q5n4JqQ64uRCA=="
                frameBorder="0" scrolling="auto" allowFullScreen
                style={{ display: "block", width: "100%", borderRadius: 12 }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MainApp() {
  const [view, setView] = useState("landing");
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
      const { data, error: fetchError } = await supabase.from("analyses").select("*").order("created_at", { ascending: false }).limit(10);
      if (fetchError) return;
      setHistory((data || []).map((item) => ({ id: item.id, createdAt: new Date(item.created_at).toLocaleString(), role: item.role, score: item.alignment_score, cvText: item.cv_text, jdText: item.job_description, report: item.report })));
    } catch (err) { console.error(err); }
  };

  const callGemini = async (systemPrompt, userQuery) => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: userQuery }] }], systemInstruction: { parts: [{ text: systemPrompt }] } }) });
    if (!res.ok) { const e = await res.text(); throw new Error(`API ${res.status}: ${e}`); }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No response from Gemini.");
    return text;
  };

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
    if (!jobUrl.trim()) { setError("Please paste a job URL first."); return; }
    setExtractingJob(true); setError("");
    try {
      const res = await fetch("/api/extract-job", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: jobUrl }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setJdText(data.text);
    } catch { setError("Could not extract job description. Paste JD manually."); }
    finally { setExtractingJob(false); }
  };

  const analyze = async () => {
    if (!cvText.trim() || !jdText.trim()) { setError("Please paste both the CV and the Job Description."); return; }
    setLoading(true); setError(""); setResult(""); setOptimizedCv(""); setLearningPlan("");
    setAlignmentScore(null); setMatchedSkills([]); setMissingSkills([]); setTopKeywords([]); setRoleType(""); setSeniority("");
    const systemPrompt = `You are an expert recruiter and ATS analyst. Analyze the CV against the job description and return EXACTLY this structure:\n\nFit Summary:\n[paragraph]\n\nRole Type:\n[role only]\n\nSeniority:\n[level only]\n\nFinal Alignment Score:\n[number 0-100]\n\nMatched Skills:\n- [skill]\n\nMissing Skills:\n- [skill]\n\nTop Keywords:\n- [keyword]\n\nStrengths:\n- [bullet]\n\nImprovement Suggestions:\n- [bullet]`;
    try {
      const text = await callGemini(systemPrompt, `JOB DESCRIPTION:\n${jdText}\n\nCANDIDATE CV:\n${cvText}`);
      setResult(text);
      extractDataFromReport(text);
      const scoreMatch = text.match(/Final Alignment Score:\s*(\d+)/i);
      const score = scoreMatch ? Number(scoreMatch[1]) : null;
      const role = parseSingleLine(text, "Role Type") || "Untitled Analysis";
      try {
        const { error: saveError } = await supabase.from("analyses").insert([{ user_email: user?.email || null, role, alignment_score: score, cv_text: cvText, job_description: jdText, report: text, created_at: new Date().toISOString() }]).select();
        if (!saveError) await fetchAnalyses();
      } catch {}
      setHistory((prev) => [{ id: Date.now(), createdAt: new Date().toLocaleString(), role, score: score || "N/A", cvText, jdText, report: text }, ...prev].slice(0, 10));
      setView("app");
    } catch { setError("Analysis failed. Check your API key or network."); }
    finally { setLoading(false); }
  };

  const optimizeCv = async () => {
    if (!cvText.trim() || !jdText.trim()) { setError("Please paste both the CV and JD first."); return; }
    setOptimizing(true); setError(""); setOptimizedCv("");
    try {
      const text = await callGemini("You are an expert resume writer. Rewrite the CV to better match the job description. Keep it concise, stronger, and ATS-friendly.", `JOB DESCRIPTION:\n${jdText}\n\nCURRENT CV:\n${cvText}`);
      setOptimizedCv(text);
    } catch { setError("CV optimization failed."); }
    finally { setOptimizing(false); }
  };

  const generateLearningPlan = async () => {
    if (!missingSkills.length) { setError("No missing skills detected yet."); return; }
    setRoadmapLoading(true); setError(""); setLearningPlan("");
    try {
      const text = await callGemini("You are an expert career coach. Create a practical learning roadmap for the missing skills.", `Missing skills:\n${missingSkills.join(", ")}\n\nTarget role:\n${roleType || "Not specified"}\n\nSeniority:\n${seniority || "Not specified"}`);
      setLearningPlan(text);
    } catch { setError("Failed to generate learning roadmap."); }
    finally { setRoadmapLoading(false); }
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setUploadingPdf(true); setError("");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += `\n${content.items.map((item) => item.str).join(" ")}`;
      }
      setCvText(fullText.trim());
    } catch { setError("Failed to read PDF."); }
    finally { setUploadingPdf(false); }
  };

  const clearHistory = () => { setHistory([]); localStorage.removeItem("hirefit-history"); };
  const loadHistoryItem = (item) => { setCvText(item.cvText || ""); setJdText(item.jdText || ""); setResult(item.report || ""); extractDataFromReport(item.report || ""); setOptimizedCv(""); setLearningPlan(""); setError(""); setView("app"); };
  const login = async () => {
    if (!email.trim() || !password.trim()) { setError("Please enter both email and password."); return; }
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); return; }
      setUser(data.user); setEmail(""); setPassword(""); setError(""); setView("dashboard");
    } catch { setError("Login failed."); }
  };
  const logout = () => { setUser(null); setView("landing"); };
  const downloadText = (content, filename) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.page}>
      <NavBar view={view} setView={setView} user={user} logout={logout} />

      {view === "landing" && (
        <>
          <HeroSection setView={setView} />
          <FeatureCards />
          <PricingSection />
          <WaitlistSection />
        </>
      )}

      {view === "login" && (
        <div style={{ ...styles.container, padding: "80px 24px" }}>
          <div style={{ maxWidth: 440, margin: "0 auto" }}>
            <div className="hf-card" style={{ padding: 40 }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, marginBottom: 8 }}>Welcome back</h2>
              <p style={{ color: T.textSub, fontSize: "14px", marginBottom: 28 }}>Sign in to your HireFit account</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input className="hf-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
                <input type="password" className="hf-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
                {error && <div style={{ color: "#f87171", fontSize: "13px", padding: "10px 14px", background: "rgba(239,68,68,0.1)", borderRadius: 8 }}>{error}</div>}
                <button className="hf-btn-primary" onClick={login} style={{ justifyContent: "center", marginTop: 4 }}><LogIn size={15} />Continue</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "dashboard" && (
        <div style={{ ...styles.container, padding: "48px 24px" }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "42px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>Dashboard</h1>
            <p style={{ color: T.textSub, fontSize: "16px" }}>Your analysis history and performance overview.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            <StatCard title="Total Analyses" value={history.length} icon={<History size={16} color={T.blue} />} />
            <StatCard title="Average Score" value={`${averageScore}/100`} icon={<TrendingUp size={16} color={T.cyan} />} />
            <StatCard title="Current Plan" value={plan} icon={<Crown size={16} color="#fbbf24" />} />
            <StatCard title="Waitlist Leads" value={waitlist.length} icon={<Mail size={16} color={T.green} />} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <HistoryList history={history} onLoadItem={loadHistoryItem} onClear={clearHistory} />
            <div className="hf-card" style={{ padding: 28 }}>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 700, marginBottom: 20 }}>Product Roadmap</h3>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                {["Real authentication (Supabase / Clerk)", "Database-backed saved reports", "Shareable public report URLs", "Stripe checkout for Pro plan", "Recruiter dashboard mode"].map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: T.textSub }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.blue, flexShrink: 0 }} />{item}
                  </li>
                ))}
              </ul>
              <button className="hf-btn-primary" onClick={() => setView("app")} style={{ marginTop: 24, fontSize: "14px" }}>Open Product <ArrowRight size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {view === "app" && (
        <div style={{ ...styles.container, padding: "40px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
            <div>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(32px,5vw,56px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 8 }}>AI CV Alignment Analyzer</h1>
                <p style={{ color: T.textSub, fontSize: "15px" }}>Check how well your CV matches any job description</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontWeight: 600, fontSize: "14px" }}><FileText size={15} color={T.blue} /> Candidate CV</label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, cursor: "pointer", fontWeight: 600, fontSize: "13px", color: T.textSub, marginBottom: 10 }}>
                    <Upload size={14} />{uploadingPdf ? "Reading PDF..." : "Upload CV PDF"}
                    <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: "none" }} />
                  </label>
                  <textarea className="hf-textarea" placeholder="Or paste your CV here..." value={cvText} onChange={(e) => setCvText(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontWeight: 600, fontSize: "14px" }}><Briefcase size={15} color={T.cyan} /> Job Description</label>
                  <textarea className="hf-textarea" style={{ height: "calc(300px + 52px)" }} placeholder="Paste the job description here..." value={jdText} onChange={(e) => setJdText(e.target.value)} />
                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                    <input className="hf-input" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="Or paste a job URL..." style={{ flex: 1 }} />
                    <button className="hf-btn-ghost" onClick={extractJobFromUrl} disabled={extractingJob} style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                      {extractingJob ? <><Loader2 size={13} />Extracting...</> : "Extract"}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                <button className="hf-btn-primary" onClick={analyze} disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
                  {loading ? <><Loader2 size={15} />Analyzing...</> : <>Check My Fit <Sparkles size={15} /></>}
                </button>
                <button className="hf-btn-ghost" onClick={optimizeCv} disabled={optimizing} style={{ color: optimizing ? T.textMuted : T.cyan, borderColor: optimizing ? T.border : "rgba(34,211,238,0.25)" }}>
                  {optimizing ? <><Loader2 size={15} />Optimizing...</> : <><Wand2 size={15} />Generate Optimized CV</>}
                </button>
                <button className="hf-btn-ghost" onClick={generateLearningPlan} disabled={roadmapLoading} style={{ color: roadmapLoading ? T.textMuted : T.green, borderColor: roadmapLoading ? T.border : "rgba(16,185,129,0.25)" }}>
                  {roadmapLoading ? <><Loader2 size={15} />Building...</> : <><Target size={15} />Learning Roadmap</>}
                </button>
              </div>

              {error && <div style={{ display: "flex", gap: 10, padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: "14px", marginBottom: 20 }}><AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}</div>}

              {alignmentScore !== null && (
                <>
                  <div className="hf-card" style={{ padding: 24, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: T.textSub }}>Alignment Score</span>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "24px", fontWeight: 800, color: alignmentScore >= 80 ? T.green : alignmentScore >= 60 ? "#fbbf24" : "#f87171" }}>{alignmentScore}/100</span>
                    </div>
                    <ProgressBar value={alignmentScore} color={alignmentScore >= 80 ? T.green : alignmentScore >= 60 ? "#fbbf24" : "#f87171"} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div className="hf-card" style={{ padding: 24 }}>
                      <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: 16 }}>ATS Score</h3>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <ProgressBar value={atsBreakdown.finalAts} color={T.cyan} />
                        <span style={{ fontWeight: 700, fontSize: "16px", color: T.cyan, whiteSpace: "nowrap" }}>{atsBreakdown.finalAts}/100</span>
                      </div>
                      {[["Skills Match", atsBreakdown.skillsScore], ["Keyword Match", atsBreakdown.keywordsScore], ["Experience Match", atsBreakdown.experienceScore], ["Formatting", atsBreakdown.formattingScore]].map(([label, value]) => (
                        <div key={label} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: T.textSub, marginBottom: 5 }}><span>{label}</span><span>{value}</span></div>
                          <ProgressBar value={value} color="rgba(34,211,238,0.6)" />
                        </div>
                      ))}
                    </div>
                    <div className="hf-card" style={{ padding: 24 }}>
                      <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: 20 }}>Job Intelligence</h3>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Role Type</div>
                        <div style={{ fontSize: "18px", fontWeight: 700 }}>{roleType || "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Seniority</div>
                        <div style={{ fontSize: "18px", fontWeight: 700 }}>{seniority || "—"}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                    {[
                      { title: "Matched Skills", skills: matchedSkills, bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)", color: "#6ee7b7", titleColor: "#10b981" },
                      { title: "Missing Skills", skills: missingSkills, bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)", color: "#fca5a5", titleColor: "#f87171" },
                      { title: "Top Keywords", skills: topKeywords, bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)", color: "#93c5fd", titleColor: "#60a5fa" },
                    ].map(({ title, skills, bg, border, color, titleColor }) => (
                      <div key={title} className="hf-card" style={{ padding: 20 }}>
                        <h3 style={{ fontSize: "13px", fontWeight: 700, marginBottom: 14, color: titleColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</h3>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {skills.length ? skills.map((s) => <span key={s} style={{ padding: "4px 10px", borderRadius: 999, background: bg, border: `1px solid ${border}`, color, fontSize: "12px", fontWeight: 600 }}>{s}</span>) : <span style={{ color: T.textMuted, fontSize: "12px" }}>None detected</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {result && (
                <div style={{ marginBottom: 16 }}>
                  <div className="hf-card" style={{ padding: 24 }}>
                    <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: 16 }}>Alignment Report</h2>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.7, color: "#cbd5e1" }}>{result}</pre>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button className="hf-btn-primary" onClick={() => navigator.clipboard.writeText(result)} style={{ fontSize: "13px", padding: "10px 18px", background: T.green }}><Copy size={13} />Copy Report</button>
                    <button className="hf-btn-ghost" onClick={() => downloadText(result, "hirefit-report.txt")} style={{ fontSize: "13px", padding: "10px 18px" }}><Download size={13} />Download</button>
                  </div>
                </div>
              )}

              {optimizedCv && (
                <div className="hf-card" style={{ padding: 24, marginBottom: 16 }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: 16 }}>Optimized CV Version</h2>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.7, color: "#cbd5e1" }}>{optimizedCv}</pre>
                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button className="hf-btn-primary" onClick={() => navigator.clipboard.writeText(optimizedCv)} style={{ fontSize: "13px", padding: "10px 18px" }}><Copy size={13} />Copy</button>
                    <button className="hf-btn-ghost" onClick={() => downloadText(optimizedCv, "hirefit-optimized-cv.txt")} style={{ fontSize: "13px", padding: "10px 18px" }}><Download size={13} />Download</button>
                  </div>
                </div>
              )}

              {learningPlan && (
                <div className="hf-card" style={{ padding: 24 }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: 16 }}>Learning Roadmap</h2>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.7, color: "#cbd5e1" }}>{learningPlan}</pre>
                  <button className="hf-btn-primary" onClick={() => navigator.clipboard.writeText(learningPlan)} style={{ marginTop: 16, fontSize: "13px", padding: "10px 18px", background: T.green }}><Copy size={13} />Copy Roadmap</button>
                </div>
              )}
            </div>

            <aside>
              <div style={{ position: "sticky", top: 80 }}>
                <HistoryList history={history} onLoadItem={loadHistoryItem} onClear={clearHistory} compact />
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainApp;
