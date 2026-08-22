import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { filterCountries, getCountryLabel, resolveCountryCode } from "../data/locationData.js";

const MAX_VISIBLE = 120;

/**
 * Searchable country picker — value is ISO country codes; UI shows localized label.
 */
export default function CountryMultiSelect({
  value = [],
  onChange,
  placeholder,
  maxSelections,
  lang = "TR",
  id: idProp,
  disabled = false,
}) {
  const autoId = useId();
  const inputId = idProp || autoId;
  const listId = `${inputId}-listbox`;
  const tr = lang === "TR";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selected = (Array.isArray(value) ? value : [value])
    .map((c) => resolveCountryCode(c))
    .filter(Boolean);

  const allMatches = filterCountries(query, selected, lang);
  const options = allMatches.slice(0, MAX_VISIBLE);
  const truncated = allMatches.length > MAX_VISIBLE;

  const add = useCallback(
    (code) => {
      const resolved = resolveCountryCode(code);
      if (!resolved || selected.includes(resolved)) return;
      if (maxSelections === 1) {
        onChange?.([resolved]);
        setQuery("");
        setOpen(false);
        return;
      }
      if (maxSelections && selected.length >= maxSelections) return;
      onChange?.([...selected, resolved]);
      setQuery("");
      setHighlight(0);
      inputRef.current?.focus();
    },
    [selected, onChange, maxSelections]
  );

  const remove = (code) => onChange?.(selected.filter((c) => c !== code));

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const onKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, options.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && open && options[highlight]) {
      e.preventDefault();
      add(options[highlight].code);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && selected.length) {
      remove(selected[selected.length - 1]);
    }
  };

  const showInput = maxSelections !== 1 || selected.length === 0;

  return (
    <div ref={wrapRef} className={`hf-country-select${disabled ? " hf-country-select--disabled" : ""}`}>
      <div className="hf-country-select__chips">
        {selected.map((code) => (
          <span key={code} className="hf-country-select__chip">
            {getCountryLabel(code, lang)}
            {!disabled ? (
              <button
                type="button"
                className="hf-country-select__chip-x"
                onClick={() => remove(code)}
                aria-label={tr ? `${getCountryLabel(code, lang)} kaldır` : `Remove ${getCountryLabel(code, lang)}`}
              >
                <X size={12} />
              </button>
            ) : null}
          </span>
        ))}
        {showInput ? (
          <input
            ref={inputRef}
            id={inputId}
            className="hf-country-select__input"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            disabled={disabled}
            placeholder={selected.length ? "" : placeholder || (tr ? "Ülke ara veya seç" : "Search or select country")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => !disabled && setOpen(true)}
            onKeyDown={onKeyDown}
          />
        ) : null}
      </div>
      {open && !disabled && options.length > 0 ? (
        <ul id={listId} className="hf-country-select__list" role="listbox">
          {options.map((c, idx) => (
            <li key={c.code}>
              <button
                type="button"
                role="option"
                aria-selected={idx === highlight}
                className={`hf-country-select__option${idx === highlight ? " hf-country-select__option--active" : ""}`}
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(c.code)}
              >
                {getCountryLabel(c.code, lang)}
              </button>
            </li>
          ))}
          {truncated ? (
            <li className="hf-country-select__hint" aria-hidden>
              {tr ? `${allMatches.length} sonuç — aramayı daralt` : `${allMatches.length} results — refine search`}
            </li>
          ) : null}
        </ul>
      ) : null}
      {open && !disabled && query && options.length === 0 ? (
        <div className="hf-country-select__empty">{tr ? "Sonuç yok" : "No matches"}</div>
      ) : null}
    </div>
  );
}

