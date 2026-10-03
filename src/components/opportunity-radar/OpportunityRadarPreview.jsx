import { Link } from "react-router-dom";
import OpportunityCard from "./OpportunityCard.jsx";
import RadarFeedback from "./RadarFeedback.jsx";
import { useOpportunityRadar } from "./useOpportunityRadar.js";
import "../../opportunity-radar.css";

export default function OpportunityRadarPreview({ getApiAuthHeaders, lang }) {
  const feed = useOpportunityRadar({ getApiAuthHeaders, lang, limit: 2 });
  const tr = lang === "TR";
  return <section className="hf-card hf-radar-preview" aria-labelledby="radar-preview-title"><div className="hf-radar-preview-heading"><div><p className="hf-radar-eyebrow">{tr ? "İş / Staj" : "Jobs / Internships"}</p><h2 id="radar-preview-title">Opportunity Radar</h2><p className="hf-radar-muted">{tr ? "Profiline göre bir sonraki adımını keşfet. Uyum, işe alınma olasılığı değildir." : "Explore your next step. Alignment is not hiring probability."}</p></div><Link className="hf-btn-secondary" to="/opportunity-radar">{tr ? "Tüm fırsatları gör" : "View all opportunities"} →</Link></div>
    {feed.status !== "ready" || !feed.items.length ? <RadarFeedback compact status={feed.status} error={feed.error} lang={lang} reload={feed.reload} /> : <div className="hf-radar-preview-grid">{feed.items.map(item => <OpportunityCard compact key={item.id} item={item} lang={lang} />)}</div>}
  </section>;
}
