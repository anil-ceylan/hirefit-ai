import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  filterCities,
  hasCityCatalog,
  resolveCountryCode,
} from "../data/locationData.js";

/**
 * Searchable city field — selected city shown as chip; catalog or free-text fallback.
 */
export default function CitySelect({
  countryCode = "",
  value = "",
  onChange,
  lang = "TR",
  disabled = false,
  placeholder,
  groupLabel,
}) {
  const inputId = useId();
  const listId = `${inputId}-cities`;
  const tr = lang === "TR";
  const code = resolveCountryCode(countryCode);
  const allowCustom = Boolean(code) && !hasCityCatalog(code);
  const isDisabled = disabled || !code;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const options = code && !allowCustom ? filterCities(code, query) : [];

  const commit = useCallback((city) => {
    const v = String(city || "").trim();
    setQuery(v);
    onChange?.(v);
    setOpen(false);
  }, [onChange]);

  const clear = () => {
    setQuery("");
    onChange?.("");
    inputRef.current?.focus();
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false);
        if (allowCustom && !isDisabled && query.trim() && query !== value) {
          commit(query.trim());
        }
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [query, value, allowCustom, isDisabled, commit]);

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
      if (open && options[highlight]) commit(options[highlight]);
      else if (allowCustom) commit(query);
    } else if (e.key === "Escape") setOpen(false);
  };

  const ph =
    placeholder ||
    (isDisabled
      ? tr
        ? "Önce ikamet ülkesini seç"
        : "Select country first"
      : allowCustom
        ? tr
          ? "Şehir adını yaz"
          : "Type city name"
        : tr
          ? "Şehir seç veya ara"
          : "Search or select city");

  const showChip = Boolean(value?.trim()) && !open;

  return (
    <div ref={wrapRef} className={`hf-city-select${isDisabled ? " hf-city-select--disabled" : ""}`}>
      {groupLabel ? <div className="hf-city-select__group-label">{groupLabel}</div> : null}
      <div className="hf-city-select__chips">
        {showChip ? (
          <span className="hf-city-select__chip">
            {value}
            {!isDisabled ? (
              <button type="button" className="hf-city-select__chip-x" onClick={clear} aria-label={tr ? "Şehri kaldır" : "Remove city"}>
                <X size={12} />
              </button>
            ) : null}
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
            placeholder={ph}
            value={query}
            onChange={(e) => {
              if (isDisabled) return;
              setQuery(e.target.value);
              setOpen(true);
              if (allowCustom) onChange?.(e.target.value);
            }}
            onFocus={() => !isDisabled && setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (allowCustom && !isDisabled && query.trim()) commit(query.trim());
            }}
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
                onClick={() => commit(city)}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!isDisabled && code && allowCustom ? (
        <p className="hf-city-select__custom-hint">
          {tr ? "Bu ülke için şehir listesi yok — yazarak ekleyebilirsin." : "No city list for this country — type your city."}
        </p>
      ) : null}
    </div>
  );
}

