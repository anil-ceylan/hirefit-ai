import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ADDITIONAL_LEVEL_OPTIONS,
  ENGLISH_LEVEL_OPTIONS,
  buildLanguagesProfile,
  filterCommonLanguages,
  getEnglishLevelLabel,
  languageNamesEqual,
  parseLanguagesProfile,
  validateLanguageUiState,
} from "../../../lib/careerOnboarding/languageProfile.js";

function LevelChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hf-onboard-chip hf-onboard-chip--lg${active ? " hf-onboard-chip--active" : ""}`}
    >
      {label}
    </button>
  );
}

function LanguageAutocomplete({
  lang,
  value,
  onChange,
  placeholder,
  exclude = [],
  ariaLabel,
}) {
  const inputId = useId();
  const listId = `${inputId}-langs`;
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const options = useMemo(() => {
    const filtered = filterCommonLanguages(query, lang).filter(
      (name) => !exclude.some((x) => languageNamesEqual(x, name))
    );
    const custom = String(query || "").trim();
    if (custom && !filtered.some((n) => languageNamesEqual(n, custom))) {
      return [custom, ...filtered];
    }
    return filtered;
  }, [query, lang, exclude]);

  const commit = (name) => {
    const v = String(name || "").trim();
    setQuery(v);
    onChange?.(v);
    setOpen(false);
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false);
        if (query.trim() && !languageNamesEqual(query, value)) {
          commit(query.trim());
        }
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [query, value]);

  return (
    <div className="hf-language-autocomplete" ref={wrapRef}>
      <input
        ref={inputRef}
        id={inputId}
        className="hf-input hf-ds-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, Math.max(0, options.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && options[highlight]) {
            e.preventDefault();
            commit(options[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && options.length ? (
        <ul id={listId} className="hf-language-autocomplete__list" role="listbox">
          {options.slice(0, 8).map((name, idx) => (
            <li key={name}>
              <button
                type="button"
                role="option"
                aria-selected={idx === highlight}
                className={`hf-language-autocomplete__option${idx === highlight ? " is-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function HFLanguageSection({ lang = "TR", languages = [], onLanguagesChange }) {
  const tr = lang === "TR";
  const parsed = useMemo(() => parseLanguagesProfile(languages, lang), [languages, lang]);
  const [draftAdditional, setDraftAdditional] = useState(null);
  const [localError, setLocalError] = useState("");

  const englishLevels = ENGLISH_LEVEL_OPTIONS.map((o) => ({
    value: o.value,
    label: getEnglishLevelLabel(o.value, lang),
  }));

  const additionalLevels = ADDITIONAL_LEVEL_OPTIONS.map((o) => ({
    value: o.value,
    label: getEnglishLevelLabel(o.value, lang),
  }));

  const excludedForAdditional = useMemo(() => {
    const names = [parsed.nativeLanguage, tr ? "İngilizce" : "English"];
    return [...names, ...parsed.additional.map((r) => r.name)];
  }, [parsed, tr]);

  const emit = (patch) => {
    const next = { ...parsed, ...patch };
    const validation = validateLanguageUiState(next, lang);
    if (!validation.ok) {
      setLocalError(validation.error || "");
      return false;
    }
    setLocalError("");
    onLanguagesChange?.(buildLanguagesProfile(next, lang));
    return true;
  };

  const tryCommitDraft = () => {
    if (!draftAdditional) return;
    const name = String(draftAdditional.name || "").trim();
    const level = String(draftAdditional.level || "").trim();
    if (!name && !level) {
      setDraftAdditional(null);
      setLocalError("");
      return;
    }
    if (!name || !level) {
      setLocalError(tr ? "Ek dil için hem dil hem seviye seç." : "Select both language and level.");
      return;
    }
    const ok = emit({
      additional: [...parsed.additional, { name, level }],
    });
    if (ok) setDraftAdditional(null);
  };

  return (
    <div className="hf-language-section hf-language-section--compact">
      <div className="hf-language-section__heading">{tr ? "Diller" : "Languages"}</div>
      <p className="hf-language-section__hint">
        {tr
          ? "Kariyer önerileri ve global fırsatlar için dil seviyeni kullanıyoruz."
          : "We use your language levels for career recommendations and global opportunities."}
      </p>

      {localError ? (
        <div className="hf-language-section__error" role="alert">
          {localError}
        </div>
      ) : null}

      <div className="hf-language-block">
        <div className="hf-language-block__label">{tr ? "Ana dil" : "Native language"}</div>
        <p className="hf-language-block__desc">{tr ? "En rahat kullandığın dil." : "The language you use most comfortably."}</p>
        <LanguageAutocomplete
          lang={lang}
          value={parsed.nativeLanguage}
          onChange={(nativeLanguage) => emit({ nativeLanguage })}
          placeholder={tr ? "Dil ara veya yaz…" : "Search or type a language…"}
          ariaLabel={tr ? "Ana dil" : "Native language"}
        />
      </div>

      <div className="hf-language-block">
        <div className="hf-language-block__label">{tr ? "İngilizce seviyesi" : "English level"}</div>
        <p className="hf-language-block__desc">
          {tr ? "İş, staj ve global fırsatlar için önemlidir." : "Important for jobs, internships, and global roles."}
        </p>
        <div className="hf-onboard-looking-chips hf-language-row__chips">
          {englishLevels.map((opt) => (
            <LevelChip
              key={opt.value}
              active={parsed.englishLevel === opt.value}
              label={opt.label}
              onClick={() => emit({ englishLevel: opt.value === parsed.englishLevel ? "" : opt.value })}
            />
          ))}
        </div>
      </div>

      {parsed.additional.length ? (
        <div className="hf-language-block">
          <div className="hf-language-block__label">{tr ? "Ek diller" : "Additional languages"}</div>
          <p className="hf-language-block__desc">
            {tr ? "CV'de gösterebileceğin diğer diller." : "Other languages you can show on your CV."}
          </p>
          <ul className="hf-language-extra-list">
            {parsed.additional.map((row) => (
              <li key={row.name} className="hf-language-extra-row">
                <span>
                  {row.name} — {getEnglishLevelLabel(row.level, lang)}
                </span>
                <button
                  type="button"
                  className="hf-language-extra-row__remove"
                  onClick={() =>
                    emit({
                      additional: parsed.additional.filter((r) => !languageNamesEqual(r.name, row.name)),
                    })
                  }
                >
                  {tr ? "Kaldır" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {draftAdditional ? (
        <div className="hf-language-draft">
          <div className="hf-language-block__label">{tr ? "Ek dil" : "Additional language"}</div>
          <LanguageAutocomplete
            lang={lang}
            value={draftAdditional.name}
            onChange={(name) => setDraftAdditional((d) => ({ ...d, name }))}
            placeholder={tr ? "Dil seç" : "Select language"}
            exclude={excludedForAdditional}
            ariaLabel={tr ? "Ek dil" : "Additional language"}
          />
          <div className="hf-onboard-looking-chips hf-language-row__chips">
            {additionalLevels.map((opt) => (
              <LevelChip
                key={opt.value}
                active={draftAdditional.level === opt.value}
                label={opt.label}
                onClick={() => setDraftAdditional((d) => ({ ...d, level: opt.value }))}
              />
            ))}
          </div>
          <div className="hf-language-draft__actions">
            <button type="button" className="hf-language-section__add" onClick={tryCommitDraft}>
              {tr ? "Ekle" : "Add"}
            </button>
            <button
              type="button"
              className="hf-language-extra-row__remove"
              onClick={() => {
                setDraftAdditional(null);
                setLocalError("");
              }}
            >
              {tr ? "İptal" : "Cancel"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="hf-language-section__add"
          onClick={() => setDraftAdditional({ name: "", level: "" })}
        >
          + {tr ? "Ek Dil Ekle" : "Add Language"}
        </button>
      )}
    </div>
  );
}

