import { useState } from "react";
import { Link, Navigate, useOutletContext } from "react-router-dom";
import { resolveDashboardRouteState, DASHBOARD_ROUTE_STATES } from "./utils/activationFlow.js";
import { radarErrorMessage } from "./utils/opportunityRadarClient.js";
import OpportunityCard from "./components/opportunity-radar/OpportunityCard.jsx";
import RadarFeedback from "./components/opportunity-radar/RadarFeedback.jsx";
import { useOpportunityRadar } from "./components/opportunity-radar/useOpportunityRadar.js";
import "./opportunity-radar.css";

function RadarFeed({ getApiAuthHeaders, lang }) {
  const [filter, setFilter] = useState("all");
  const feed = useOpportunityRadar({ getApiAuthHeaders, lang, filter });
  const tr = lang === "TR";
  return <>
    <div className="hf-radar-toolbar"><div role="group" aria-label={tr ? "Fırsat görünümü" : "Opportunity view"}>{[["all", tr ? "Tümü" : "All"], ["saved", tr ? "Kaydedilenler" : "Saved"]].map(([value, label]) => <button key={value} type="button" className="hf-btn-secondary" aria-pressed={filter === value} disabled={Boolean(feed.busy)} onClick={() => setFilter(value)}>{label}</button>)}</div><button type="button" className="hf-btn-secondary" disabled={Boolean(feed.busy) || feed.status === "loading"} onClick={feed.reload}>{tr ? "Yenile" : "Refresh"}</button></div>
    {feed.notice && <div className="hf-radar-notice" role={feed.notice.error ? "alert" : "status"}>{feed.notice.error ? <><span>{radarErrorMessage(feed.notice.error, lang, true)}</span><button type="button" className="hf-btn-secondary" onClick={feed.reload}>{tr ? "Listeyi yenile" : "Refresh list"}</button></> : (feed.notice.state === "saved" ? (tr ? "Fırsat kaydedildi." : "Opportunity saved.") : (tr ? "Fırsat gizlendi. Artık bu listede gösterilmeyecek." : "Opportunity dismissed. It will no longer appear in this list."))}</div>}
    {feed.status !== "ready" || !feed.items.length ? <RadarFeedback status={feed.status} error={feed.error} lang={lang} filter={filter} reload={feed.reload} /> : <div className="hf-radar-list">{feed.items.map(item => <OpportunityCard key={item.id} item={item} lang={lang} onUpdate={feed.update} busy={feed.busy === item.id} disabled={Boolean(feed.busy)} />)}</div>}
    {feed.meta?.candidates_truncated && <p className="hf-radar-muted">{tr ? "Bu görünüm, en güncel fırsatların sınırlı bir seçimini kapsar; tüm kayıtlarının arşivi değildir." : "This view covers a limited selection of recent opportunities, not a complete saved archive."}</p>}
  </>;
}

export default function OpportunityRadarPage() {
  const context = useOutletContext();
  const { lang, user, getApiAuthHeaders, retryCareerProfileLoad } = context;
  const route = resolveDashboardRouteState(context);
  if (route.state === DASHBOARD_ROUTE_STATES.REDIRECT_LOGIN) return <Navigate to="/login?next=%2Fopportunity-radar" replace />;
  if (route.state === DASHBOARD_ROUTE_STATES.REDIRECT_VERIFY_EMAIL) return <Navigate to={`/verify-email?email=${encodeURIComponent(user?.email || "")}`} replace />;
  const tr = lang === "TR";
  return <main className="hf-radar-page"><div className="hf-radar-shell"><Link className="hf-btn-secondary" to="/dashboard">← {tr ? "Bugünkü Hamle" : "Today's Move"}</Link>
    <header className="hf-radar-header"><p className="hf-radar-eyebrow">Opportunity Radar · {tr ? "İş / Staj" : "Jobs / Internships"}</p><h1>{tr ? "Bir sonraki fırsatını keşfet" : "Explore your next opportunity"}</h1><p>{tr ? "Kariyer hafızandan yola çıkan, kaynağı belli iş ve staj fırsatları. Kararı sen verirsin." : "Source-backed jobs and internships informed by your Career Memory. You decide the next step."}</p><p className="hf-radar-muted">{tr ? "Profil uyumu, işe alınma olasılığı değildir. Bilinmeyen bilgiler uyumsuzluk sayılmaz." : "Profile alignment is not hiring probability. Unknown information is not a mismatch."}</p></header>
    {route.state === DASHBOARD_ROUTE_STATES.LOADING ? <RadarFeedback status="loading" lang={lang} /> : route.state === DASHBOARD_ROUTE_STATES.REDIRECT_PROFILE ? <RadarFeedback status="profile_required" lang={lang} /> : route.state === DASHBOARD_ROUTE_STATES.ERROR ? <RadarFeedback status="error" lang={lang} reload={retryCareerProfileLoad} /> : <RadarFeed key={`${user.id}:${lang}`} getApiAuthHeaders={getApiAuthHeaders} lang={lang} />}
  </div></main>;
}
