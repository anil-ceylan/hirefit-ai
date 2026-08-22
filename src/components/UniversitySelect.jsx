import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  getCountryLabel,
  getUniversitiesForLocation,
  resolveCountryCode,
  searchUniversitiesForCountry,
} from "../data/locationData.js";

export default function UniversitySelect({
  countryCode = "",
  city = "",
  value = "",
  manual = false,
  onChange,
  onManualChange,
  lang = "TR",
}) {
  const inputId = useId();
  const listId = `${inputId}-universities`;
  const tr = lang === "TR";
  const code = resolveCountryCode(countryCode);
  const cityName = String(city || "").trim();
  const hasCity = Boolean(code && cityName);
  const catalog = hasCity ? getUniversitiesForLocation(code, cityName) : [];
  const countryCatalog = code ? searchUniversitiesForCountry(code, "", cityName) : [];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open, manual, code, cityName]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = manual || !hasCity ? [] : searchUniversitiesForCountry(code, query, cityName);
  const showMissingOption = hasCity && !manual;
  const totalOptions = options.length + (showMissingOption ? 1 : 0);
  const isDisabled = !hasCity;
  const showChip = Boolean(value?.trim()) && !open && !manual;
  const countryLabel = code ? getCountryLabel(code, lang) : "";

  const commit = (next, source = "catalog") => {
    const v = String(next || "").trim();
    onManualChange?.(source === "manual");
    onChange?.(v, { source });
    setQuery(v);
    setOpen(false);
  };

  const clear = () => {
    onManualChange?.(false);
    onChange?.("", { source: "clear" });
    setQuery("");
    inputRef.current?.focus();
  };

  const chooseMissing = () => {
    onManualChange?.(true);
    onChange?.("", { source: "manual" });
    setQuery("");
    setOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKeyDown = (e) => {
    if (isDisabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (manual) return;
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, totalOptions - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (manual) return;
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (manual) {
        commit(query, "manual");
        return;
      }
      if (open && options[highlight]) commit(options[highlight].name, "catalog");
      else if (open && showMissingOption && highlight >= options.length) chooseMissing();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const placeholder = !code
    ? tr ? "Önce ülke seç" : "Select country first"
    : !cityName
      ? tr ? "Önce şehir seç" : "Select city first"
      : manual
        ? tr ? "Üniversite adını yaz" : "Type university name"
        : tr ? "Üniversite ara veya seç" : "Search or select university";

  return (
    <div ref={wrapRef} className={`hf-city-select${isDisabled ? " hf-city-select--disabled" : ""}`}>
      <div className="hf-city-select__chips">
        {countryLabel && (showChip || open) ? (
          <span className="hf-city-select__chip hf-city-select__chip--country">
            {countryLabel}
          </span>
        ) : null}
        {cityName && (showChip || open) ? (
          <span className="hf-city-select__chip hf-city-select__chip--country">
            {cityName}
          </span>
        ) : null}
        {showChip ? (
          <span className="hf-city-select__chip">
            {value}
            <button type="button" className="hf-city-select__chip-x" onClick={clear} aria-label={tr ? "Üniversiteyi kaldır" : "Remove university"}>
              <X size={12} />
            </button>
          </span>
        ) : null}
        {!showChip ? (
          <input
            ref={inputRef}
            id={inputId}
            className="hf-city-select__input"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            disabled={isDisabled}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              if (isDisabled) return;
              setQuery(e.target.value);
              if (manual) onChange?.(e.target.value, { source: "manual" });
              else setOpen(true);
            }}
            onFocus={() => !isDisabled && !manual && setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (manual && query.trim()) commit(query, "manual");
            }}
          />
        ) : null}
      </div>
      {open && !isDisabled && !manual ? (
        <ul id={listId} className="hf-city-select__list" role="listbox">
          {options.map((option, idx) => {
            const prev = options[idx - 1];
            const showCityHeader = !prev || prev.city !== option.city;
            return (
              <li key={`${option.city}-${option.name}`}>
                {showCityHeader ? (
                  <div className="hf-country-select__hint" aria-hidden style={{ paddingTop: idx === 0 ? 6 : 10 }}>
                    {option.city}
                  </div>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === highlight}
                  className={`hf-city-select__option${idx === highlight ? " hf-city-select__option--active" : ""}`}
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(option.name, "catalog")}
                >
                  {option.name}
                </button>
              </li>
            );
          })}
          {showMissingOption ? (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={highlight >= options.length}
                className={`hf-city-select__option${highlight >= options.length ? " hf-city-select__option--active" : ""}`}
                onMouseEnter={() => setHighlight(options.length)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={chooseMissing}
              >
                {tr ? "Üniversitem listede yok" : "My university is not listed"}
              </button>
            </li>
          ) : null}
          {!options.length && countryCatalog.length ? (
            <li className="hf-country-select__hint" aria-hidden>
              {tr ? "Sonuç yok — elle eklemek için aşağıdaki seçeneği kullan" : "No matches — use manual entry below"}
            </li>
          ) : null}
        </ul>
      ) : null}
      {manual ? (
        <p className="hf-city-select__custom-hint">
          {tr ? "Manuel üniversite adı kaydedilecek." : "Manual university name will be saved."}
        </p>
      ) : null}
    </div>
  );
}

