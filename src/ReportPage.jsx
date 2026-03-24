import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import supabase from "./supabaseClient";
import RejectionPanel from "./components/RejectionPanel";
import HireScore from "./components/HireScore";

export default function ReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchReport(); }, []);

  const fetchReport = async () => {
    const { data, error } = await supabase
      .from("analyses").select("*").eq("id", id).single();
    if (error) { console.error(error); return; }
    setReport(data);
    setLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Report link copied!");
  };

  if (loading) {
    return (
      <div style={{ minHeight:"100vh", background:"#0f172a", display:"flex",
        alignItems:"center", justifyContent:"center", color:"white", fontSize:18 }}>
        Loading report...
      </div>
    );
  }

  const matchedSkills = report.matched_skills || [];
  const missingSkills = report.missing_skills || [];
  const learningPlan = report.learning_plan || [];
  const score = report.alignment_score || 0;
  const scoreColor = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";

  const card = {
    background: "#1e293b",
    borderRadius: 16,
    padding: 28,
    marginBottom: 20,
    border: "1px solid #334155"
  };

  const sectionTitle = {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#94a3b8",
    marginBottom: 16,
    marginTop: 0
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", color:"white",
      fontFamily:"Inter, sans-serif", padding:"40px 20px" }}>
      <div style={{ maxWidth:860, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <h1 style={{ fontSize:32, fontWeight:800, margin:"0 0 8px 0" }}>
            {report.role || "CV Analysis"}
          </h1>
          <p style={{ color:"#64748b", margin:0 }}>AI-powered resume analysis by HireFit</p>
        </div>

        {/* 🔥 NEW: Hire Score */}
<HireScore 
  probability={report?.hireProbability || 62}
  confidence={report?.confidence || "Medium"}
/>

{/* 🔥 NEW: Rejection Reasons */}
<RejectionPanel 
  reasons={report?.rejectionReasons || {
    high: ["No measurable impact"],
    medium: ["Weak experience depth"],
    low: ["Formatting issues"]
  }}
/>

        {/* Share Buttons */}
        <div style={{ display:"flex", gap:12, marginBottom:28, flexWrap:"wrap" }}>
          <button onClick={copyLink} style={{
            padding:"10px 20px", background:"#1e293b", color:"white",
            border:"1px solid #334155", borderRadius:10, cursor:"pointer",
            fontSize:14, fontWeight:600
          }}>
            Copy Report Link
          </button>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              padding:"10px 20px", background:"#0a66c2", color:"white",
              borderRadius:10, textDecoration:"none", fontSize:14, fontWeight:600
            }}
          >
            Share on LinkedIn
          </a>
        </div>

        {/* Score Card */}
        <div style={{ ...card, display:"flex", alignItems:"center", gap:32, flexWrap:"wrap" }}>
          <div style={{
            width:110, height:110, borderRadius:"50%",
            border:`6px solid ${scoreColor}`,
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", flexShrink:0
          }}>
            <span style={{ fontSize:30, fontWeight:800, color:scoreColor }}>{score}</span>
            <span style={{ fontSize:12, color:"#94a3b8" }}>/100</span>
          </div>
          <div>
            <p style={sectionTitle}>ATS Alignment Score</p>
            <p style={{ fontSize:22, fontWeight:700, margin:"0 0 8px 0" }}>
              {score >= 80 ? "Strong Match" : score >= 60 ? "Moderate Match" : "Needs Work"}
            </p>
            <p style={{ color:"#94a3b8", margin:0, fontSize:14 }}>
              {score >= 80
                ? "Your CV is well-aligned with this role."
                : score >= 60
                ? "Your CV partially matches. Some improvements needed."
                : "Significant gaps detected. Review missing skills."}
            </p>
          </div>
        </div>

        {/* Skills Row */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
          <div style={card}>
            <p style={sectionTitle}>Matched Skills</p>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {matchedSkills.length > 0 ? matchedSkills.map((skill, i) => (
                <span key={i} style={{
                  background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.3)",
                  color:"#86efac", padding:"5px 12px", borderRadius:999, fontSize:13, fontWeight:500
                }}>{skill}</span>
              )) : <p style={{ color:"#64748b", fontSize:14 }}>None detected</p>}
            </div>
          </div>
          <div style={card}>
            <p style={sectionTitle}>Missing Skills</p>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {missingSkills.length > 0 ? missingSkills.map((skill, i) => (
                <span key={i} style={{
                  background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)",
                  color:"#fca5a5", padding:"5px 12px", borderRadius:999, fontSize:13, fontWeight:500
                }}>{skill}</span>
              )) : (
                <span style={{
                  background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.3)",
                  color:"#86efac", padding:"5px 12px", borderRadius:999, fontSize:13
                }}>None — perfect match!</span>
              )}
            </div>
          </div>
        </div>

        {/* Learning Plan */}
        {learningPlan.length > 0 && (
          <div style={card}>
            <p style={sectionTitle}>Recommended Learning Path</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {learningPlan.map((item, i) => (
                <div key={i} style={{
                  display:"flex", alignItems:"flex-start", gap:12,
                  padding:"12px 16px", background:"#0f172a",
                  borderRadius:10, border:"1px solid #1e293b"
                }}>
                  <span style={{
                    background:"rgba(59,130,246,0.2)", color:"#93c5fd",
                    borderRadius:"50%", width:24, height:24,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:12, fontWeight:700, flexShrink:0
                  }}>{i + 1}</span>
                  <span style={{ color:"#cbd5e1", fontSize:14, lineHeight:1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Analysis */}
        <div style={card}>
          <p style={sectionTitle}>Full Analysis</p>
          <p style={{ color:"#cbd5e1", fontSize:14, lineHeight:1.8, margin:0, whiteSpace:"pre-wrap" }}>
            {report.report}
          </p>
        </div>

        {/* Footer CTA */}
        <div style={{
          ...card, textAlign:"center",
          background:"linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.1))",
          border:"1px solid rgba(59,130,246,0.2)"
        }}>
          <p style={{ fontSize:18, fontWeight:700, margin:"0 0 8px 0" }}>Want to improve your score?</p>
          <p style={{ color:"#94a3b8", margin:"0 0 20px 0", fontSize:14 }}>
            Go back and generate an optimized CV version.
          </p>
          <a href="/" style={{
            display:"inline-block", padding:"12px 28px", background:"#3b82f6",
            color:"white", borderRadius:10, textDecoration:"none",
            fontWeight:700, fontSize:15
          }}>
            Analyze Another CV
          </a>
        </div>

      </div>
    </div>
  );
}