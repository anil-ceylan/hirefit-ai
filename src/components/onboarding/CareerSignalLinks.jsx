const LINK_FIELDS = [
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/..." },
  { key: "github", label: "GitHub", placeholder: "github.com/..." },
  { key: "portfolio", label: "Portfolio", placeholder: "portfolio URL" },
  { key: "website", label: "Personal Website", placeholder: "yourname.com" },
  { key: "behance", label: "Behance", placeholder: "behance.net/...", creative: true },
  { key: "dribbble", label: "Dribbble", placeholder: "dribbble.com/...", creative: true },
];

export default function CareerSignalLinks({ value, onChange, lang = "TR", showCreative = false }) {
  const tr = lang === "TR";
  const visibleFields = LINK_FIELDS.filter((field) => !field.creative || showCreative);
  return (
    <section className="hf-career-links">
      <div className="hf-career-links__head">
        <div>
          <strong>{tr ? "Dijital Kariyer Kanıtları" : "Digital Career Evidence"}</strong>
          <span>{tr ? "Önerilir" : "Recommended"}</span>
        </div>
        <p>
          {tr
            ? "Recruiter'ın doğrulayabileceği çalışmalarını ekle; yalnızca paylaştığın bağlantıları kullanırız."
            : "Add work a recruiter can inspect; we only use links you choose to share."}
        </p>
      </div>
      <div className="hf-career-links__grid">
        {visibleFields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <input
              className="hf-input hf-ds-input"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder={field.placeholder}
              value={value?.[field.key] || ""}
              onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

