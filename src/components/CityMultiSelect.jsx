import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  filterCities,
  hasCityCatalog,
  resolveCountryCode,
} from "../data/locationData.js";

/**
 * Searchable multi-city picker for a single country.
 */
export default function CityMultiSelect({
  countryCode = "",
  value = [],
  onChange,
  lang = "TR",
  disabled = false,
  placeholder,
  maxSelections,
}) {
  const inputId = useId();
  const listId = `${inputId}-cities`;
  const tr = lang === "TR";
  const code = resolveCountryCode(countryCode);
  const allowCustom = Boolean(code) && !hasCityCatalog(code);
  const isDisabled = disabled || !code;

  const selected = useMemo(
    () => [...new Set((Array.isArray(value) ? value : value ? [value] : []).map((c) => String(c || "").trim()).filter(Boolean))],
    [value]
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const options = code && !allowCustom
    ? filterCities(code, query).filter((city) => !selected.includes(city))
    : [];

  const add = useCallback(
    (city) => {
      const v = String(city || "").trim();
      if (!v || selected.includes(v)) return;
      if (maxSelections && selected.length >= maxSelections) return;
      onChange?.([...selected, v]);
      setQuery("");
      setHighlight(0);
      inputRef.current?.focus();
    },
    [selected, onChange, maxSelections]
  );

  const remove = (city) => onChange?.(selected.filter((c) => c !== city));

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false);
        if (allowCustom && !isDisabled && query.trim() && !selected.includes(query.trim())) {
          add(query.trim());
        }
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [query, allowCustom, isDisabled, selected, add]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const onKeyDown = (e) => {
    if (isDisabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, options.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && options[highlight]) add(options[highlight]);
      else if (allowCustom && query.trim()) add(query.trim());
    } else if (e.key === "Escape") setOpen(false);
  };

  const ph =
    placeholder ||
    (isDisabled
      ? tr
        ? "Önce ülke seç"
        : "Select country first"
      : allowCustom
        ? tr
          ? "Şehir ekle"
          : "Add a city"
        : tr
          ? "Şehir seç veya ara"
          : "Search or select city");

  return (
    <div ref={wrapRef} className={`hf-city-select hf-city-multi-select${isDisabled ? " hf-city-select--disabled" : ""}`}>
      <div className="hf-city-select__chips">
        {selected.map((city) => (
          <span key={city} className="hf-city-select__chip">
            {city}
            {!isDisabled ? (
              <button type="button" className="hf-city-select__chip-x" onClick={() => remove(city)} aria-label={tr ? `${city} kaldır` : `Remove ${city}`}>
                <X size={12} />
              </button>
            ) : null}
          </span>
        ))}
        {(!maxSelections || selected.length < maxSelections) ? (
          <input
            ref={inputRef}
            id={inputId}
            className="hf-city-select__input"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            disabled={isDisabled}
            placeholder={selected.length ? (tr ? "Başka şehir ekle" : "Add another city") : ph}
            value={query}
            onChange={(e) => {
              if (isDisabled) return;
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => !isDisabled && setOpen(true)}
            onKeyDown={onKeyDown}
          />
        ) : null}
      </div>
      {open && !isDisabled && options.length > 0 ? (
        <ul id={listId} className="hf-city-select__list" role="listbox">
          {options.slice(0, 80).map((city, idx) => (
            <li key={city}>
              <button
                type="button"
                role="option"
                className={`hf-city-select__option${idx === highlight ? " hf-city-select__option--active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(city)}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!isDisabled && code && allowCustom ? (
        <p className="hf-city-select__custom-hint">
          {tr ? "Bu ülke için şehir listesi yok — yazarak ekleyebilirsin." : "No city list for this country — type to add."}
        </p>
      ) : null}
    </div>
  );
}

