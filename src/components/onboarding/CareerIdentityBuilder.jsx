import { Check, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function CareerIdentityBuilder({ state, lang = "TR" }) {
  const tr = lang === "TR";
  const completed = new Set(state?.completed || []);
  const steps = state?.steps || [];

  return (
    <motion.section
      className="hf-identity-builder"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      aria-live="polite"
    >
      <div className="hf-identity-builder__icon">
        <Sparkles size={22} />
      </div>
      <span className="hf-identity-builder__eyebrow">HireFit Career Intelligence</span>
      <h2>{tr ? "Career Snapshot hazırlanıyor..." : "Preparing your Career Snapshot..."}</h2>
      <p>
        {tr
          ? "Kaydettiğin profil bilgileri, Career DNA cevapların ve mevcut CV sinyallerin bir araya getiriliyor."
          : "Your saved profile details, Career DNA answers, and available CV signals are being combined."}
      </p>
      <div className="hf-identity-builder__steps">
        {steps.map((step) => {
          const done = completed.has(step.id);
          const active = state?.active === step.id;
          return (
            <div key={step.id} className={`hf-identity-builder__step${done ? " is-done" : ""}${active ? " is-active" : ""}`}>
              <span className="hf-identity-builder__step-icon">
                {done ? <Check size={14} strokeWidth={3} /> : active ? <Loader2 size={14} className="hf-spin" /> : null}
              </span>
              <span>{step.label}</span>
              {step.detail ? <small>{step.detail}</small> : null}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

