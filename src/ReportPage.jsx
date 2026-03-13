import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import supabase from "../supabaseClient";

export default function ReportPage() {

  const { id } = useParams();
  const [report, setReport] = useState(null);

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

  };

  if (!report) return <div>Loading report...</div>;

  return (
    <div style={{padding:40}}>
      <h1>HireFit Analysis</h1>

      <h2>Role</h2>
      <p>{report.role}</p>

      <h2>Score</h2>
      <p>{report.alignment_score}/100</p>

      <h2>Report</h2>
      <pre>{report.report}</pre>
    </div>
  );
}