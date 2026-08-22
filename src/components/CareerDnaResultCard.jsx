import { motion } from "framer-motion";
import { getRoleLabel } from "../../lib/careerOnboarding/roleCatalog.js";

export default function CareerDnaResultCard({ dna, lang }) {
  const tr = lang === "TR";
  if (!dna?.typeLabel && !dna?.typeId) return null;

  const strengths = dna.strengths || dna.result?.strengths || [];
  const weaknesses = dna.weaknesses || dna.result?.weaknesses || [];
  const paths = dna.recommendedPaths || dna.result?.recommendedPaths || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="hf-dna-result-card"
    >
      <div className="hf-dna-result-card__hero">
        <span className="hf-dna-result-card__badge">{tr ? "Career Arketipi" : "Career Archetype"}</span>
        <h3 className="hf-dna-result-card__type">{dna.typeLabel || dna.typeId}</h3>
        {dna.summary || dna.result?.summary ? (
          <p className="hf-dna-result-card__summary">{dna.summary || dna.result?.summary}</p>
        ) : null}
      </div>
      <div className="hf-dna-result-card__grid">
        <div className="hf-dna-result-card__col">
          <h4>{tr ? "Güçlü yönler" : "Strengths"}</h4>
          <ul>
            {strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="hf-dna-result-card__col hf-dna-result-card__col--weak">
          <h4>{tr ? "Gelişim alanları" : "Growth areas"}</h4>
          <ul>
            {weaknesses.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
      {paths.length ? (
        <div className="hf-dna-result-card__paths">
          <h4>{tr ? "Önerilen kariyer yolları" : "Recommended career paths"}</h4>
          <div className="hf-dna-result-card__path-chips">
            {paths.map((p) => (
              <span key={p} className="hf-os-tag hf-os-tag--violet">{getRoleLabel(p, lang)}</span>
            ))}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}

