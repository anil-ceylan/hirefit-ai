import { buildCareerProfileCompletion } from "../../../lib/careerOnboarding/careerProfileCompletion.js";
import { getCvProcessingLabel, resolveCvProcessingState } from "../../../lib/careerOnboarding/cvOptions.js";

export function CareerProfileCompletion({ profile, lang = "TR", className = "" }) {
  const tr = lang === "TR";
  const completion = buildCareerProfileCompletion(profile, lang);
  const incompleteByImpact = [...completion.incomplete].sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0));
  const cvState = resolveCvProcessingState(profile);
  const statusForItem = (item) => {
    if (item.id === "cv") return getCvProcessingLabel(cvState, lang);
    if (item.id === "recruiter_analysis" || item.id === "ats_analysis") return tr ? "Bekliyor" : "Pending";
    if (item.listGroup === "core") return tr ? "Kısmi" : "Partial";
    return tr ? "Tamamlandı" : "Completed";
  };

  return (
    <section className={`hf-profile-completion${className ? ` ${className}` : ""}`}>
      <div className="hf-profile-completion__head">
        <strong>{tr ? "Kariyer Profili Tamamlanma" : "Career Profile Completion"}</strong>
        <span>{completion.percent}%</span>
      </div>
      <div className="hf-profile-completion__bar" aria-hidden>
        <div className="hf-profile-completion__bar-fill" style={{ width: `${completion.percent}%` }} />
      </div>
      <p className="hf-profile-completion__copy">
        {tr ? "En yüksek getirili eksikleri önce tamamla." : "Complete the highest-return gaps first."}
      </p>
      <div className="hf-profile-completion__lists">
        {completion.completed.length ? (
          <div>
            <span className="hf-profile-completion__list-label">
              {tr ? "Tamamlanan alanlar" : "Completed sections"}
            </span>
            <ul className="hf-profile-completion__list hf-profile-completion__list--done">
              {completion.completed.map((item) => (
                <li key={item.id}>
                  <span>{item.label}</span>
                  <strong>{statusForItem(item)}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {completion.incomplete.length ? (
          <div>
            <span className="hf-profile-completion__list-label">
              {tr ? "Tahmini tamamlama etkisi" : "Estimated completion impact"}
            </span>
            <ul className="hf-profile-completion__list hf-profile-completion__list--todo">
              {incompleteByImpact.map((item) => (
                <li key={item.id}>
                  <span>{item.label}</span>
                  <strong>+{item.weight}%</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default CareerProfileCompletion;
