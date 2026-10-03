import { getRoleLabel } from "../../../lib/careerOnboarding/roleCatalog.js";
import { getIndustryLabel } from "../../../lib/careerOnboarding/industries.js";
import { getCountryLabel } from "../../data/locationData.js";

const dimensions = {
  target_role: ["Hedef rol", "Target role"], target_sector: ["Sektör", "Sector"], skills: ["Beceriler", "Skills"],
  location: ["Konum", "Location"], work_mode: ["Çalışma biçimi", "Work mode"], experience_level: ["Deneyim seviyesi", "Experience level"], career_direction: ["İş / staj tercihi", "Job / internship preference"],
};
const subtypes = { "full-time": ["Tam zamanlı", "Full-time"], "part-time": ["Yarı zamanlı", "Part-time"], freelance: ["Freelance", "Freelance"], internship: ["Staj", "Internship"] };
const modes = { remote: ["Uzaktan", "Remote"], onsite: ["Ofisten", "Onsite"], hybrid: ["Hibrit", "Hybrid"], flexible: ["Esnek", "Flexible"] };
const levels = { intern: ["Staj", "Intern"], new_graduate: ["Yeni mezun", "New graduate"], entry: ["Junior", "Junior"], mid: ["Orta seviye", "Mid level"], senior: ["Kıdemli", "Senior"], manager: ["Yönetici", "Manager"] };
const textList = value => Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
const signals = value => Array.isArray(value) ? value.filter(item => item && dimensions[item.dimension]) : [];
function dateLabel(value, lang) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleDateString(lang === "TR" ? "tr-TR" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;
}
function signalValues(signal, lang) {
  const index = lang === "TR" ? 0 : 1;
  return textList(signal.values).map(value => {
    if (signal.dimension === "target_role") return getRoleLabel(value, lang);
    if (signal.dimension === "target_sector") return getIndustryLabel(value, lang);
    if (signal.dimension === "career_direction") return subtypes[value]?.[index] || value;
    if (signal.dimension === "work_mode") return modes[value]?.[index] || value;
    if (signal.dimension === "experience_level") return levels[value]?.[index] || value;
    return value;
  }).join(", ");
}
function uncertainty(reason, tr) {
  if (reason === "profile_unknown") return tr ? "Profilinde henüz bu bilgi yok." : "This information is not yet in your profile.";
  if (reason === "opportunity_unknown") return tr ? "İlanda bu ayrıntı belirtilmemiş." : "The listing does not specify this detail.";
  if (reason === "not_aligned") return tr ? "Mevcut tercihinle farklılaşıyor; inceleyebilirsin." : "This differs from your current preference; you can still explore it.";
  return tr ? "Bu bilgi profilinde henüz doğrulanmadı." : "This information is not yet evidenced in your profile.";
}

export default function OpportunityCard({ item, lang = "TR", compact = false, busy = false, disabled = false, onUpdate }) {
  const tr = lang === "TR", index = tr ? 0 : 1;
  const score = typeof item.match_score === "number" && Number.isFinite(item.match_score) ? Math.max(0, Math.min(100, item.match_score)) : null;
  const coverage = typeof item.alignment_coverage === "number" ? Math.max(0, Math.min(100, item.alignment_coverage)) : 0;
  const deadline = dateLabel(item.deadline_at, lang);
  const matched = signals(item.matched_signals);
  const uncertain = signals(item.missing_or_uncertain_signals);
  const saved = item.current_user_state === "saved";
  const location = [item.city, item.country ? getCountryLabel(item.country, lang) : null, modes[item.work_mode]?.[index]].filter(Boolean).join(" · ");
  return <article className={`hf-card hf-radar-card${compact ? " hf-radar-card--compact" : ""}`} aria-labelledby={`radar-${item.id}`}>
    <div className="hf-radar-card-heading">
      <div><p className="hf-radar-eyebrow">{subtypes[item.subtype]?.[index] || (tr ? "İş fırsatı" : "Job opportunity")}</p>
        <h3 id={`radar-${item.id}`}>{item.title}</h3><p className="hf-radar-organization">{item.organization || (tr ? "Organizasyon belirtilmemiş" : "Organization not specified")}</p>
        <p className="hf-radar-muted">{location || (tr ? "Konum bilgisi belirtilmemiş" : "Location not specified")}</p></div>
      <div className="hf-radar-score"><span>{tr ? "Profil uyumu" : "Profile alignment"}</span><strong>{score === null ? "—" : `${score}%`}</strong>
        <small>{tr ? `Bilgi kapsamı: %${coverage}` : `Context coverage: ${coverage}%`}</small>{score === null && <small>{tr ? "Karşılaştırma için bilgi bekleniyor" : "Awaiting matching context"}</small>}</div>
    </div>
    {!compact && <>
      <p className="hf-radar-muted hf-radar-explanation">{tr ? "Uyum, işe alınma olasılığı değildir. Bilgi kapsamı, hangi ölçüde karşılaştırma yapılabildiğini gösterir; eksik bilgi uyumsuzluk sayılmaz." : "Alignment is not hiring probability. Coverage describes how much context could be compared; missing information is not a mismatch."}</p>
      <div className="hf-radar-detail-grid"><section><h4>{tr ? "Neden sana uygun?" : "Why this matches you"}</h4>
        {textList(item.why_this_matches_you).length ? <ul>{textList(item.why_this_matches_you).map((text, i) => <li key={i}>{text}</li>)}</ul> : <p>{tr ? "Henüz yeterli karşılaştırma bilgisi yok. Bu, fırsatın sana uygun olmadığı anlamına gelmez." : "There is not enough context yet. This does not mean the opportunity is unsuitable."}</p>}
        {matched.length > 0 && <><h4>{tr ? "Örtüşen bilgiler" : "Matched signals"}</h4><ul>{matched.map((signal, i) => <li key={i}>{dimensions[signal.dimension][index]}{signalValues(signal, lang) ? ` · ${signalValues(signal, lang)}` : ""}</li>)}</ul></>}
      </section><section><h4>{tr ? "Netleştirebileceğin bilgiler" : "Context to clarify"}</h4>
        {uncertain.length ? <ul>{uncertain.map((signal, i) => <li key={i}><span>{dimensions[signal.dimension][index]}: </span>{uncertainty(signal.reason, tr)}{textList(signal.uncertain_values).length ? ` (${textList(signal.uncertain_values).join(", ")})` : ""}</li>)}</ul> : <p>{tr ? "Karşılaştırılan bilgiler örtüşüyor. Başvuru koşullarını yine de kaynaktan kontrol et." : "The compared information aligns. Still check eligibility at the source."}</p>}
      </section></div>
      {typeof item.why_now?.text === "string" && item.why_now.text && <section className="hf-radar-next"><h4>{tr ? "Neden şimdi?" : "Why now"}</h4><p>{item.why_now.text}</p></section>}
      <section className="hf-radar-next"><h4>{tr ? "Önerilen sonraki adım" : "Recommended next action"}</h4><p>{typeof item.recommended_next_action?.text === "string" ? item.recommended_next_action.text : (tr ? "Kaynağı aç ve başvuru koşullarını incele." : "Open the source and review application requirements.")}</p></section>
    </>}
    <div className="hf-radar-source"><span>{tr ? "Kaynak" : "Source"}: {item.source}</span>{deadline && <span>{tr ? "Son başvuru" : "Deadline"}: <time dateTime={item.deadline_at}>{deadline}</time></span>}{saved && <span>{tr ? "Kaydedildi" : "Saved"}</span>}{item.current_user_state === "acted_on" && <span>{tr ? "Aksiyon alındı" : "Acted on"}</span>}</div>
    {!compact && <div className="hf-radar-actions"><a className="hf-btn-primary" href={item.url} target="_blank" rel="noopener noreferrer">{tr ? "Fırsatı görüntüle" : "View opportunity"}<span className="hf-radar-sr-only">{tr ? " (yeni sekme)" : " (new tab)"}</span></a>
      <button type="button" className="hf-btn-secondary" disabled={disabled || saved} onClick={() => onUpdate(item.id, "saved")}>{saved ? (tr ? "Kaydedildi" : "Saved") : (tr ? "Kaydet" : "Save")}</button>
      <button type="button" className="hf-btn-secondary" disabled={disabled} onClick={() => onUpdate(item.id, "dismissed")}>{tr ? "Gizle" : "Dismiss"}</button>
      {busy && <span role="status">{tr ? "Güncelleniyor…" : "Updating…"}</span>}</div>}
  </article>;
}
