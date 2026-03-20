import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import supabase from "../supabaseClient";

export default function ReportPage() {

  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {

    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setReport(data);
    setLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Report link copied!");
  };

  if (loading) {
    return <div style={{padding:40}}>Loading report...</div>;
  }

  const matchedSkills = report.matched_skills || [];
  const missingSkills = report.missing_skills || [];
  const learningPlan = report.learning_plan || [];

  return (
    <div style={{
      padding:40,
      maxWidth:900,
      margin:"0 auto",
      fontFamily:"Inter, sans-serif"
    }}>

      <h1>HireFit CV Analysis</h1>

      <p style={{color:"#64748b"}}>
        AI powered resume analysis
      </p>

      {/* Share buttons */}

      <div style={{display:"flex", gap:12, marginBottom:30}}>

        <button
          onClick={copyLink}
          style={{
            padding:"10px 16px",
            background:"#3b82f6",
            color:"white",
            border:"none",
            borderRadius:10,
            cursor:"pointer"
          }}
        >
          Copy Report Link
        </button>

        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding:"10px 16px",
            background:"#0a66c2",
            color:"white",
            borderRadius:10,
            textDecoration:"none"
          }}
        >
          Share on LinkedIn
        </a>

      </div>

      {/* Role */}

      <h2>Target Role</h2>
      <p>{report.role}</p>

      {/* Score */}

      <h2>ATS Score</h2>

      <p style={{
        fontSize:36,
        fontWeight:700,
        marginBottom:20
      }}>
        {report.alignment_score}/100
      </p>

      {/* Matched Skills */}

      <h2>Matched Skills</h2>

      <div style={{
        display:"flex",
        gap:8,
        flexWrap:"wrap",
        marginBottom:20
      }}>
        {matchedSkills.length > 0 ? (
          matchedSkills.map((skill, i) => (
            <span
              key={i}
              style={{
                background:"rgba(59,130,246,0.15)",
                border:"1px solid rgba(59,130,246,0.4)",
                padding:"6px 10px",
                borderRadius:999
              }}
            >
              {skill}
            </span>
          ))
        ) : (
          <p>No matched skills detected</p>
        )}
      </div>

      {/* Missing Skills */}

      <h2>Missing Skills</h2>

      <ul>
        {missingSkills.length > 0 ? (
          missingSkills.map((skill, i) => (
            <li key={i}>{skill}</li>
          ))
        ) : (
          <li>No missing skills detected</li>
        )}
      </ul>

      {/* Learning Plan */}

      <h2>Recommended Learning</h2>

      <ul>
        {learningPlan.length > 0 ? (
          learningPlan.map((item, i) => (
            <li key={i}>{item}</li>
          ))
        ) : (
          <li>No learning roadmap generated</li>
        )}
      </ul>

      {/* Full analysis */}

      <h2>Full Analysis</h2>

      <pre style={{
        background:"#0f172a",
        padding:20,
        borderRadius:12,
        marginTop:20,
        whiteSpace:"pre-wrap"
      }}>
        {report.report}
      </pre>

    </div>
  );
}