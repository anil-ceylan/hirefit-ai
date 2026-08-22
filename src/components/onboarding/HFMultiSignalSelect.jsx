import { Check } from "lucide-react";

export default function HFMultiSignalSelect({
  label,
  helper,
  options,
  values,
  lang = "TR",
  onChange,
}) {
  const selected = new Set(values || []);
  return (
    <div className="hf-signal-select">
      <div className="hf-signal-select__head">
        <strong>{label}</strong>
        {helper ? <span>{helper}</span> : null}
      </div>
      <div className="hf-signal-select__grid">
        {options.map((option) => {
          const active = selected.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              className={`hf-signal-select__option${active ? " is-active" : ""}`}
              onClick={() => onChange(option.id)}
            >
              <span className="hf-signal-select__check" aria-hidden>
                {active ? <Check size={13} strokeWidth={3} /> : null}
              </span>
              <span>{lang === "TR" ? option.labelTr : option.labelEn}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

