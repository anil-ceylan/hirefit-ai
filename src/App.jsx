import { supabase } from "./supabaseClient"
import React, { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  FileText,
  Briefcase,
  AlertCircle,
  Loader2,
  Upload,
  Copy,
  Wand2,
  Target,
  Search,
  History,
  Trash2,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
  Crown,
  ArrowRight,
  LogIn,
  LogOut,
  Download,
  Mail,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const API_KEY = "YOUR_NEW_GEMINI_API_KEY";
const MODEL = "gemini-2.5-flash";

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #081227 0%, #0f172a 100%)",
    color: "white",
    fontFamily: "Inter, sans-serif",
  },
  container: {
    maxWidth: "1380px",
    margin: "0 auto",
    padding: "24px",
  },
  card: {
    background: "rgba(30, 41, 59, 0.88)",
    border: "1px solid #334155",
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
  },
  buttonPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 22px",
    background: "#3b82f6",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    color: "white",
    fontWeight: 800,
    fontSize: "15px",
  },
  buttonSecondary: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 22px",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "14px",
    cursor: "pointer",
    color: "white",
    fontWeight: 700,
    fontSize: "15px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #334155",
    background: "#111827",
    color: "white",
    outline: "none",
  },
  textarea: {
    width: "100%",
    height: "320px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #334155",
    background: "#1e293b",
    color: "white",
    resize: "none",
    outline: "none",
    fontSize: "15px",
  },
};

function ProgressBar({ value, color = "#3b82f6" }) {
  return (
    <div
      style={{
        flex: 1,
        height: "14px",
        background: "#334155",
        borderRadius: "999px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: "100%",
          background: color,
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

function Badge({ children, bg, color }) {
  return (
    <span
      style={{
        padding: "8px 12px",
        borderRadius: "999px",
        background: bg,
        color,
        fontWeight: 700,
        fontSize: "14px",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      {children}
    </span>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div style={styles.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <div style={{ color: "#94a3b8", fontSize: "14px" }}>{title}</div>
        {icon}
      </div>
      <div style={{ fontSize: "30px", fontWeight: 900 }}>{value}</div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("landing");
  const [user, setUser] = useState(null);
  const [plan] = useState("Free");

  const [email, setEmail] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");

  const [cvText, setCvText] = useState("");
  const [jdText, setJdText] = useState("");

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
  const [waitlist, setWaitlist] = useState([]);

  useEffect(() => {
    const savedUser = localStorage.getItem("hirefit-user");
    const savedHistory = localStorage.getItem("hirefit-history");
    const savedWaitlist = localStorage.getItem("hirefit-waitlist");

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {}
    }

    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {}
    }

    if (savedWaitlist) {
      try {
        setWaitlist(JSON.parse(savedWaitlist));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("hirefit-history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("hirefit-waitlist", JSON.stringify(waitlist));
  }, [waitlist]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("hirefit-user", JSON.stringify(user));
    } else {
      localStorage.removeItem("hirefit-user");
    }
  }, [user]);

  const parseBullets = (text, sectionName) => {
    const regex = new RegExp(
      `${sectionName}:([\\s\\S]*?)(\\n[A-Z][A-Za-z ]+:|$)`,
      "i"
    );
    const match = text.match(regex);
    if (!match) return [];

    return match[1]
      .split("\n")
      .map((line) => line.replace(/^[-•\s*]+/, "").trim())
      .filter(Boolean);
  };

  const parseSingleLine = (text, sectionName) => {
    const regex = new RegExp(`${sectionName}:\\s*(.+)`, "i");
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  };

  const extractDataFromReport = (text) => {
    const scoreMatch = text.match(/Final Alignment Score:\s*(\d+)/i);
    const parsedScore = scoreMatch ? Number(scoreMatch[1]) : null;
    setAlignmentScore(parsedScore);

    setRoleType(parseSingleLine(text, "Role Type"));
    setSeniority(parseSingleLine(text, "Seniority"));

    setMatchedSkills(parseBullets(text, "Matched Skills"));
    setMissingSkills(parseBullets(text, "Missing Skills"));
    setTopKeywords(parseBullets(text, "Top Keywords"));
  };

  const atsBreakdown = useMemo(() => {
    const keywordCoverage =
      topKeywords.length > 0
        ? Math.round((matchedSkills.length / topKeywords.length) * 100)
        : 0;

    const skillsScore =
      alignmentScore !== null ? Math.min(100, Math.max(0, alignmentScore)) : 0;
    const keywordsScore = Math.min(100, Math.max(0, keywordCoverage));
    const experienceScore =
      alignmentScore !== null ? Math.max(35, alignmentScore - 10) : 0;
    const formattingScore = cvText.trim().length > 200 ? 75 : 45;

    const finalAts = Math.round(
      skillsScore * 0.4 +
        keywordsScore * 0.3 +
        experienceScore * 0.2 +
        formattingScore * 0.1
    );

    return {
      skillsScore,
      keywordsScore,
      experienceScore,
      formattingScore,
      finalAts,
    };
  }, [alignmentScore, matchedSkills, topKeywords, cvText]);

  const averageScore = useMemo(() => {
    if (!history.length) return 0;
    const nums = history
      .map((item) => Number(item.score))
      .filter((n) => !Number.isNaN(n));
    if (!nums.length) return 0;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  }, [history]);

  const callGemini = async (systemPrompt, userQuery) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: userQuery }],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.log("API error response:", errorText);
      throw new Error(`API request failed with status ${res.status}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No response returned from Gemini.");
    return text;
  };

  const analyze = async () => {
    if (!cvText.trim() || !jdText.trim()) {
      setError("Please paste both the CV and the Job Description.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");
    setOptimizedCv("");
    setLearningPlan("");
    setAlignmentScore(null);
    setMatchedSkills([]);
    setMissingSkills([]);
    setTopKeywords([]);
    setRoleType("");
    setSeniority("");

    const systemPrompt = `
You are an expert recruiter, ATS analyst, and resume evaluator.

Analyze the candidate CV against the job description.

Return the output in EXACTLY this structure:

Fit Summary:
[short paragraph]

Role Type:
[role name only]

Seniority:
[level only]

Final Alignment Score:
[number only out of 100]

Matched Skills:
- [skill]
- [skill]

Missing Skills:
- [skill]
- [skill]

Top Keywords:
- [keyword]
- [keyword]

Strengths:
- [bullet]
- [bullet]

Improvement Suggestions:
- [bullet]
- [bullet]
`;

    const query = `
JOB DESCRIPTION:
${jdText}

CANDIDATE CV:
${cvText}
`;

    try {
      const text = await callGemini(systemPrompt, query);
      setResult(text);
      extractDataFromReport(text);

      const newHistoryItem = {
        id: Date.now(),
        createdAt: new Date().toLocaleString(),
        role: parseSingleLine(text, "Role Type") || "Untitled Analysis",
        score: text.match(/Final Alignment Score:\s*(\d+)/i)?.[1] || "N/A",
        cvText,
        jdText,
        report: text,
      };

      setHistory((prev) => [newHistoryItem, ...prev].slice(0, 10));
      setView("app");
    } catch (err) {
      console.error(err);
      setError("Analysis failed. Check your API key, model name, or network.");
    } finally {
      setLoading(false);
    }
  };

  const optimizeCv = async () => {
    if (!cvText.trim() || !jdText.trim()) {
      setError("Please paste both the CV and the Job Description first.");
      return;
    }

    setOptimizing(true);
    setError("");
    setOptimizedCv("");

    const systemPrompt = `
You are an expert recruiter and resume writer.

Rewrite the candidate CV to better match the job description.
Keep it concise, stronger, and ATS-friendly.
Return only the improved CV text in bullet-oriented professional style.
`;

    const query = `
JOB DESCRIPTION:
${jdText}

CURRENT CV:
${cvText}
`;

    try {
      const text = await callGemini(systemPrompt, query);
      setOptimizedCv(text);
    } catch (err) {
      console.error(err);
      setError("CV optimization failed.");
    } finally {
      setOptimizing(false);
    }
  };

  const generateLearningPlan = async () => {
    if (!missingSkills.length) {
      setError("No missing skills detected yet.");
      return;
    }

    setRoadmapLoading(true);
    setError("");
    setLearningPlan("");

    const systemPrompt = `
You are an expert career coach.

Create a practical learning roadmap for the missing skills.
Make it concise, structured, and realistic.

Return in this exact structure:

Learning Plan:

Skill:
[skill name]

Week 1:
- topic
- topic

Week 2:
- topic
- topic

Resources:
- [resource suggestion]
- [resource suggestion]
`;

    const query = `
Missing skills:
${missingSkills.join(", ")}

Target role:
${roleType || "Not specified"}

Seniority:
${seniority || "Not specified"}
`;

    try {
      const text = await callGemini(systemPrompt, query);
      setLearningPlan(text);
    } catch (err) {
      console.error(err);
      setError("Failed to generate learning roadmap.");
    } finally {
      setRoadmapLoading(false);
    }
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }

    setUploadingPdf(true);
    setError("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(" ");
        fullText += `\n${pageText}`;
      }

      setCvText(fullText.trim());
    } catch (err) {
      console.error(err);
      setError("Failed to read PDF.");
    } finally {
      setUploadingPdf(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("hirefit-history");
  };

  const loadHistoryItem = (item) => {
    setCvText(item.cvText);
    setJdText(item.jdText);
    setResult(item.report);
    extractDataFromReport(item.report);
    setOptimizedCv("");
    setLearningPlan("");
    setError("");
    setView("app");
  };

  const login = () => {
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setUser({ email });
    setEmail("");
    setError("");
    setView("dashboard");
  };

  const logout = () => {
    setUser(null);
    setView("landing");
  };

  const joinWaitlist = () => {
    if (!waitlistEmail.trim()) return;
    const entry = {
      id: Date.now(),
      email: waitlistEmail,
      createdAt: new Date().toLocaleString(),
    };
    setWaitlist((prev) => [entry, ...prev]);
    setWaitlistEmail("");
  };

  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hirefit-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadOptimizedCv = () => {
    if (!optimizedCv) return;
    const blob = new Blob([optimizedCv], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hirefit-optimized-cv.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div
          style={{
            ...styles.card,
            padding: "16px 20px",
            marginBottom: "22px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: "14px",
            zIndex: 50,
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontWeight: 900,
              fontSize: "20px",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                background: "#2563eb",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Sparkles size={20} />
            </div>
            HireFit
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button style={styles.buttonSecondary} onClick={() => setView("landing")}>
              Home
            </button>
            <button style={styles.buttonSecondary} onClick={() => setView("app")}>
              Product
            </button>
            <button style={styles.buttonSecondary} onClick={() => setView("dashboard")}>
              Dashboard
            </button>

            {user ? (
              <button style={styles.buttonPrimary} onClick={logout}>
                <LogOut size={16} />
                {user.email}
              </button>
            ) : (
              <button style={styles.buttonPrimary} onClick={handleLogin}>
                <LogIn size={16} />
                Login
              </button>
            )}
          </div>
        </div>

        {view === "landing" && (
          <>
            <section
              style={{
                ...styles.card,
                padding: "42px",
                marginBottom: "22px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(circle at top left, rgba(59,130,246,0.25), transparent 35%), radial-gradient(circle at bottom right, rgba(20,184,166,0.18), transparent 35%)",
                  pointerEvents: "none",
                }}
              />

              <div style={{ position: "relative", zIndex: 2, maxWidth: "920px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    borderRadius: "999px",
                    background: "#172554",
                    color: "#dbeafe",
                    fontWeight: 700,
                    marginBottom: "18px",
                  }}
                >
                  <Crown size={16} />
                  AI Resume Intelligence for job seekers
                </div>

                <h1
                  style={{
                    fontSize: "76px",
                    lineHeight: 1,
                    margin: "0 0 16px 0",
                    fontWeight: 900,
                  }}
                >
                  Land interviews
                  <br />
                  with AI-powered CV
                  <br />
                  alignment.
                </h1>

                <p
                  style={{
                    fontSize: "22px",
                    lineHeight: 1.5,
                    color: "#cbd5e1",
                    marginBottom: "26px",
                    maxWidth: "760px",
                  }}
                >
                  HireFit analyzes your resume against real job descriptions,
                  scores your alignment, detects missing skills, extracts
                  keywords, generates an optimized CV version, and builds a
                  learning roadmap in seconds.
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "14px",
                    flexWrap: "wrap",
                    marginBottom: "22px",
                  }}
                >
                  <button style={styles.buttonPrimary} onClick={() => setView("app")}>
                    Try HireFit
                    <ArrowRight size={16} />
                  </button>

                  <button style={styles.buttonSecondary} onClick={() => setView("dashboard")}>
                    View Dashboard
                  </button>
                </div>

                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                  <Badge bg="#14532d" color="#dcfce7">
                    <CheckCircle2 size={14} />
                    ATS Scoring
                  </Badge>
                  <Badge bg="#172554" color="#dbeafe">
                    <Target size={14} />
                    Skill Gap Detection
                  </Badge>
                  <Badge bg="#164e63" color="#cffafe">
                    <Wand2 size={14} />
                    CV Optimizer
                  </Badge>
                </div>
              </div>
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "18px",
                marginBottom: "22px",
              }}
            >
              <div style={styles.card}>
                <BarChart3 size={22} style={{ marginBottom: "12px", color: "#60a5fa" }} />
                <h3 style={{ marginTop: 0, fontSize: "22px" }}>ATS Score Engine</h3>
                <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                  Quantifies CV alignment with skills, keywords, experience, and formatting.
                </p>
              </div>

              <div style={styles.card}>
                <Search size={22} style={{ marginBottom: "12px", color: "#2dd4bf" }} />
                <h3 style={{ marginTop: 0, fontSize: "22px" }}>Keyword Intelligence</h3>
                <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                  Extracts top JD keywords and highlights what is missing from the CV.
                </p>
              </div>

              <div style={styles.card}>
                <ShieldCheck size={22} style={{ marginBottom: "12px", color: "#4ade80" }} />
                <h3 style={{ marginTop: 0, fontSize: "22px" }}>AI Optimization</h3>
                <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                  Generates a stronger, more ATS-friendly CV version tailored to the role.
                </p>
              </div>
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.8fr",
                gap: "18px",
                marginBottom: "22px",
              }}
            >
              <div style={styles.card}>
                <h2 style={{ marginTop: 0, fontSize: "28px" }}>Pricing</h2>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div
                    style={{
                      border: "1px solid #334155",
                      borderRadius: "16px",
                      padding: "18px",
                      background: "#111827",
                    }}
                  >
                    <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "8px" }}>
                      Free
                    </div>
                    <div style={{ fontSize: "34px", fontWeight: 900, marginBottom: "10px" }}>
                      $0
                    </div>
                    <div style={{ color: "#cbd5e1", marginBottom: "14px" }}>
                      For students and first-time users.
                    </div>
                    <ul style={{ paddingLeft: "18px", color: "#e2e8f0", lineHeight: 1.8 }}>
                      <li>CV vs JD analysis</li>
                      <li>ATS score</li>
                      <li>Skill gap detection</li>
                      <li>History storage (local)</li>
                    </ul>
                  </div>

                  <div
                    style={{
                      border: "1px solid #2563eb",
                      borderRadius: "16px",
                      padding: "18px",
                      background: "#172554",
                    }}
                  >
                    <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "8px" }}>
                      Pro
                    </div>
                    <div style={{ fontSize: "34px", fontWeight: 900, marginBottom: "10px" }}>
                      $12/mo
                    </div>
                    <div style={{ color: "#dbeafe", marginBottom: "14px" }}>
                      Future SaaS plan for serious job seekers.
                    </div>
                    <ul style={{ paddingLeft: "18px", color: "white", lineHeight: 1.8 }}>
                      <li>Unlimited analyses</li>
                      <li>Saved CV versions</li>
                      <li>Shareable reports</li>
                      <li>Team / recruiter mode</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={{ marginTop: 0, fontSize: "28px" }}>Join the waitlist</h2>
                <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                  Capture leads like a real SaaS. This stores emails locally for now.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <input
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    placeholder="Enter your email"
                    style={styles.input}
                  />
                  <button style={styles.buttonPrimary} onClick={joinWaitlist}>
                    <Mail size={16} />
                    Join Waitlist
                  </button>
                </div>

                <div style={{ marginTop: "18px", color: "#94a3b8", fontSize: "14px" }}>
                  Waitlist size: <strong style={{ color: "white" }}>{waitlist.length}</strong>
                </div>
              </div>
            </section>
          </>
        )}

        {view === "login" && (
          <section style={{ ...styles.card, maxWidth: "560px", margin: "40px auto" }}>
            <h2 style={{ marginTop: 0, fontSize: "32px" }}>Login to HireFit</h2>
            <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
              This is a lightweight local login state for MVP purposes. Real auth comes next with Supabase or Clerk.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "18px" }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                style={styles.input}
              />
              <button style={styles.buttonPrimary} onClick={login}>
                <LogIn size={16} />
                Continue
              </button>
            </div>
          </section>
        )}

        {view === "dashboard" && (
          <>
            <section style={{ marginBottom: "20px" }}>
              <h1 style={{ fontSize: "52px", marginBottom: "8px", fontWeight: 900 }}>
                HireFit Dashboard
              </h1>
              <p style={{ color: "#cbd5e1", fontSize: "18px" }}>
                Your SaaS-style control panel for analyses, performance, and activity.
              </p>
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <StatCard
                title="Total analyses"
                value={history.length}
                icon={<History size={18} color="#60a5fa" />}
              />
              <StatCard
                title="Average score"
                value={`${averageScore}/100`}
                icon={<BarChart3 size={18} color="#2dd4bf" />}
              />
              <StatCard
                title="Current plan"
                value={plan}
                icon={<Crown size={18} color="#fbbf24" />}
              />
              <StatCard
                title="Waitlist leads"
                value={waitlist.length}
                icon={<Mail size={18} color="#4ade80" />}
              />
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "18px",
              }}
            >
              <div style={styles.card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "14px",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "24px" }}>Recent analyses</h3>
                  <button
                    onClick={clearHistory}
                    style={{
                      background: "#7f1d1d",
                      color: "#fee2e2",
                      border: "none",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Clear
                  </button>
                </div>

                {history.length === 0 ? (
                  <div style={{ color: "#94a3b8" }}>No analyses yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {history.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => loadHistoryItem(item)}
                        style={{
                          textAlign: "left",
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: "14px",
                          padding: "14px",
                          cursor: "pointer",
                          color: "white",
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: "6px", fontSize: "18px" }}>
                          {item.role}
                        </div>
                        <div style={{ color: "#cbd5e1", marginBottom: "4px" }}>
                          Score: {item.score}/100
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                          {item.createdAt}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <h3 style={{ marginTop: 0, fontSize: "24px" }}>SaaS roadmap</h3>
                <ul style={{ paddingLeft: "18px", lineHeight: 1.9, color: "#e2e8f0" }}>
                  <li>Real authentication with Supabase / Clerk</li>
                  <li>Database-backed saved reports</li>
                  <li>Shareable public report URLs</li>
                  <li>Stripe checkout for Pro plan</li>
                  <li>Recruiter dashboard mode</li>
                  <li>Email onboarding + lead capture</li>
                </ul>

                <button
                  style={{ ...styles.buttonPrimary, marginTop: "10px" }}
                  onClick={() => setView("app")}
                >
                  Open Product
                  <ArrowRight size={16} />
                </button>
              </div>
            </section>
          </>
        )}

        {view === "app" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 320px",
              gap: "24px",
              alignItems: "start",
            }}
          >
            <div>
              <section style={{ marginBottom: "20px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "12px",
                    borderRadius: "14px",
                    background: "#2563eb",
                    marginBottom: "16px",
                  }}
                >
                  <Sparkles size={24} />
                </div>

                <h1
                  style={{
                    fontSize: "72px",
                    margin: "0 0 10px 0",
                    fontWeight: 900,
                    lineHeight: 1.02,
                  }}
                >
                  HireFit – AI CV Alignment Analyzer
                </h1>

                <p style={{ margin: 0, fontSize: "18px", color: "#cbd5e1" }}>
                  Check how well your CV matches job descriptions
                </p>
              </section>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                  marginBottom: "24px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "10px",
                      fontWeight: 800,
                      fontSize: "18px",
                    }}
                  >
                    <FileText size={18} />
                    Candidate CV
                  </label>

                  <div style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        borderRadius: "12px",
                        background: "#1e293b",
                        border: "1px solid #334155",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      <Upload size={16} />
                      {uploadingPdf ? "Reading PDF..." : "Upload CV PDF"}
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handlePdfUpload}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>

                  <textarea
                    placeholder="Paste CV here"
                    style={styles.textarea}
                    value={cvText}
                    onChange={(e) => setCvText(e.target.value)}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "10px",
                      fontWeight: 800,
                      fontSize: "18px",
                    }}
                  >
                    <Briefcase size={18} />
                    Job Description
                  </label>

                  <textarea
                    placeholder="Paste Job Description"
                    style={{ ...styles.textarea, height: "368px" }}
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "14px", marginBottom: "24px", flexWrap: "wrap" }}>
                <button
                  onClick={analyze}
                  disabled={loading}
                  style={{
                    ...styles.buttonPrimary,
                    background: loading ? "#475569" : "#3b82f6",
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Check My Fit
                      <Sparkles size={18} />
                    </>
                  )}
                </button>

                <button
                  onClick={optimizeCv}
                  disabled={optimizing}
                  style={{
                    ...styles.buttonPrimary,
                    background: optimizing ? "#475569" : "#14b8a6",
                  }}
                >
                  {optimizing ? (
                    <>
                      <Loader2 size={18} />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      Generate Optimized CV
                      <Wand2 size={18} />
                    </>
                  )}
                </button>

                <button
                  onClick={generateLearningPlan}
                  disabled={roadmapLoading}
                  style={{
                    ...styles.buttonPrimary,
                    background: roadmapLoading ? "#475569" : "#22c55e",
                  }}
                >
                  {roadmapLoading ? (
                    <>
                      <Loader2 size={18} />
                      Building Roadmap...
                    </>
                  ) : (
                    <>
                      Generate Learning Roadmap
                      <Target size={18} />
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    marginBottom: "20px",
                    padding: "16px",
                    borderRadius: "14px",
                    background: "#7f1d1d",
                    color: "#fecaca",
                    border: "1px solid #ef4444",
                  }}
                >
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              {alignmentScore !== null && (
                <>
                  <div style={{ ...styles.card, marginBottom: "18px" }}>
                    <h2 style={{ marginTop: 0, marginBottom: "14px", fontSize: "20px" }}>
                      Alignment Score
                    </h2>

                    <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                      <ProgressBar value={alignmentScore} />
                      <span style={{ fontWeight: 900, fontSize: "20px" }}>
                        {alignmentScore}/100
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "18px",
                      marginBottom: "18px",
                    }}
                  >
                    <div style={styles.card}>
                      <h3 style={{ marginTop: 0, marginBottom: "16px" }}>ATS Score</h3>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "16px",
                          marginBottom: "18px",
                        }}
                      >
                        <ProgressBar value={atsBreakdown.finalAts} color="#22c55e" />
                        <span style={{ fontWeight: 900, fontSize: "20px" }}>
                          {atsBreakdown.finalAts}/100
                        </span>
                      </div>

                      {[
                        ["Skills Match", atsBreakdown.skillsScore],
                        ["Keyword Match", atsBreakdown.keywordsScore],
                        ["Experience Match", atsBreakdown.experienceScore],
                        ["Formatting", atsBreakdown.formattingScore],
                      ].map(([label, value]) => (
                        <div key={label} style={{ marginBottom: "12px" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "6px",
                              fontSize: "14px",
                              color: "#cbd5e1",
                            }}
                          >
                            <span>{label}</span>
                            <span>{value}</span>
                          </div>
                          <ProgressBar value={value} color="#14b8a6" />
                        </div>
                      ))}
                    </div>

                    <div style={styles.card}>
                      <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Job Intelligence</h3>

                      <div style={{ marginBottom: "12px" }}>
                        <div style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "4px" }}>
                          ROLE TYPE
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "18px" }}>{roleType || "—"}</div>
                      </div>

                      <div>
                        <div style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "4px" }}>
                          SENIORITY
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "18px" }}>
                          {seniority || "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "18px",
                      marginBottom: "18px",
                    }}
                  >
                    <div style={styles.card}>
                      <h3 style={{ marginTop: 0, marginBottom: "14px", color: "#86efac" }}>
                        Matched Skills
                      </h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {matchedSkills.length ? (
                          matchedSkills.map((skill) => (
                            <Badge key={skill} bg="#14532d" color="#dcfce7">
                              🟢 {skill}
                            </Badge>
                          ))
                        ) : (
                          <span style={{ color: "#94a3b8" }}>No matched skills detected.</span>
                        )}
                      </div>
                    </div>

                    <div style={styles.card}>
                      <h3 style={{ marginTop: 0, marginBottom: "14px", color: "#fca5a5" }}>
                        Missing Skills
                      </h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {missingSkills.length ? (
                          missingSkills.map((skill) => (
                            <Badge key={skill} bg="#7f1d1d" color="#fee2e2">
                              🔴 {skill}
                            </Badge>
                          ))
                        ) : (
                          <span style={{ color: "#94a3b8" }}>No missing skills detected.</span>
                        )}
                      </div>
                    </div>

                    <div style={styles.card}>
                      <h3 style={{ marginTop: 0, marginBottom: "14px" }}>Top Keywords</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {topKeywords.length ? (
                          topKeywords.map((keyword) => (
                            <Badge key={keyword} bg="#172554" color="#dbeafe">
                              🔍 {keyword}
                            </Badge>
                          ))
                        ) : (
                          <span style={{ color: "#94a3b8" }}>No keywords extracted yet.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {result && (
                <div style={{ marginTop: "20px", marginBottom: "18px" }}>
                  <div style={styles.card}>
                    <h2 style={{ fontSize: "22px", marginTop: 0, marginBottom: "12px" }}>
                      Alignment Report
                    </h2>

                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        lineHeight: 1.6,
                        color: "#e2e8f0",
                        margin: 0,
                      }}
                    >
                      {result}
                    </pre>
                  </div>

                  <div style={{ display: "flex", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => navigator.clipboard.writeText(result)}
                      style={{
                        ...styles.buttonPrimary,
                        background: "#22c55e",
                      }}
                    >
                      <Copy size={16} />
                      Copy Report
                    </button>

                    <button onClick={downloadReport} style={styles.buttonSecondary}>
                      <Download size={16} />
                      Download Report
                    </button>
                  </div>
                </div>
              )}

              {optimizedCv && (
                <div style={{ ...styles.card, marginTop: "18px", marginBottom: "18px" }}>
                  <h2 style={{ fontSize: "22px", marginTop: 0, marginBottom: "12px" }}>
                    Optimized CV Version
                  </h2>

                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontFamily: "monospace",
                      lineHeight: 1.6,
                      color: "#e2e8f0",
                      margin: 0,
                    }}
                  >
                    {optimizedCv}
                  </pre>

                  <div style={{ display: "flex", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => navigator.clipboard.writeText(optimizedCv)}
                      style={{
                        ...styles.buttonPrimary,
                        background: "#3b82f6",
                      }}
                    >
                      <Copy size={16} />
                      Copy Optimized CV
                    </button>

                    <button onClick={downloadOptimizedCv} style={styles.buttonSecondary}>
                      <Download size={16} />
                      Download Optimized CV
                    </button>
                  </div>
                </div>
              )}

              {learningPlan && (
                <div style={{ ...styles.card, marginTop: "18px" }}>
                  <h2 style={{ fontSize: "22px", marginTop: 0, marginBottom: "12px" }}>
                    Skill Learning Roadmap
                  </h2>

                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontFamily: "monospace",
                      lineHeight: 1.6,
                      color: "#e2e8f0",
                      margin: 0,
                    }}
                  >
                    {learningPlan}
                  </pre>

                  <div style={{ display: "flex", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => navigator.clipboard.writeText(learningPlan)}
                      style={{
                        ...styles.buttonPrimary,
                        background: "#22c55e",
                      }}
                    >
                      <Copy size={16} />
                      Copy Roadmap
                    </button>
                  </div>
                </div>
              )}
            </div>

            <aside>
              <div
                style={{
                  ...styles.card,
                  position: "sticky",
                  top: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "14px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "18px",
                    }}
                  >
                    <History size={18} />
                    Previous Analyses
                  </h3>

                  <button
                    onClick={clearHistory}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "#7f1d1d",
                      color: "#fee2e2",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 10px",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: "12px",
                    }}
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                </div>

                {history.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: "14px" }}>
                    No saved analyses yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {history.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => loadHistoryItem(item)}
                        style={{
                          textAlign: "left",
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: "12px",
                          padding: "12px",
                          cursor: "pointer",
                          color: "white",
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: "4px", fontSize: "18px" }}>
                          {item.role}
                        </div>
                        <div style={{ fontSize: "13px", color: "#cbd5e1", marginBottom: "4px" }}>
                          Score: {item.score}/100
                        </div>
                        <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                          {item.createdAt}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

const [email, setEmail] = useState("")
const [password, setPassword] = useState("")

async function handleLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: "password123"
  })

  if (error) {
    alert(error.message)
  } else {
    alert("Login successful")
    console.log(data)
    setUser(data.user)
    setView("dashboard")
  }
}