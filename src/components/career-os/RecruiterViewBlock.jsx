import { Eye } from "lucide-react";
import { buildRecruiterViewFromSnapshot } from "../../../lib/careerOnboarding/recruiterView.js";

function CheckList({ items, variant = "strong", emptyLabel, tr }) {
  if (!items?.length) return <p className="hf-recruiter-view__empty">{emptyLabel}</p>;
  return (
    <ul className={`hf-recruiter-view__checks hf-recruiter-view__checks--${variant}`}>
      {items.map((item) => (
        <li key={item}>
          <span aria-hidden>{variant === "strong" ? "✓" : "✗"}</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function RecruiterViewBlock({ snapshot, lang = "TR" }) {
  const tr = lang === "TR";
  const view = buildRecruiterViewFromSnapshot(snapshot || {}, lang);
  if (!view?.headline) return null;

  const confidence = view.recruiterConfidence || {};

  return (
    <section className="hf-recruiter-view" aria-label={view.headline}>
      <header className="hf-recruiter-view__head">
        <Eye size={16} />
        <div>
          <h3>{view.headline}</h3>
          {view.description ? <p>{view.description}</p> : null}
        </div>
      </header>

      <div className="hf-recruiter-view__grid">
        <div className="hf-recruiter-view__panel hf-recruiter-view__panel--strong">
          <span>{tr ? "Güçlü Sinyaller" : "Strong Signals"}</span>
          <CheckList
            items={view.strongSignals}
            variant="strong"
            emptyLabel={tr ? "Henüz belirgin kanıt yok." : "No dominant proof yet."}
            tr={tr}
          />
        </div>
        <div className="hf-recruiter-view__panel hf-recruiter-view__panel--missing">
          <span>{tr ? "Eksik Kanıt" : "Missing Proof"}</span>
          <CheckList
            items={view.missingEvidence}
            variant="missing"
            emptyLabel={tr ? "Kritik eksik yok." : "No critical gap flagged."}
            tr={tr}
          />
        </div>
      </div>

      <div className="hf-recruiter-view__confidence">
        <div className="hf-recruiter-view__confidence-head">
          <span>{tr ? "Recruiter Güven Skoru" : "Recruiter Confidence"}</span>
          <strong>{confidence.percent != null ? `${confidence.percent}%` : confidence.label}</strong>
        </div>
        {confidence.reason ? (
          <p>
            <b>{tr ? "Neden:" : "Reason:"}</b> {confidence.reason}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default RecruiterViewBlock;

