import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Accessible custom select — closed state matches `.hf-input`; panel uses HireFit dark dropdown tokens.
 *
 * @param {object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {{ value: string, label: string, disabled?: boolean }[]} props.options
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 * @param {string} [props.id]
 * @param {string} [props["aria-label"]]
 */
export default function HFSelect({
  value = "",
  onChange,
  options = [],
  placeholder = "",
  disabled = false,
  className = "",
  id: idProp,
  "aria-label": ariaLabel,
}) {
  const autoId = useId();
  const id = idProp || autoId;
  const listId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  const selectable = options.filter((o) => !o.disabled);
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? "";

  const close = useCallback(() => setOpen(false), []);

  const selectValue = useCallback(
    (next) => {
      onChange?.(next);
      close();
      triggerRef.current?.focus();
    },
    [onChange, close]
  );

  useEffect(() => {
    if (!open) return;
    const selectedIdx = selectable.findIndex((o) => o.value === value);
    setHighlight(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open, value, selectable]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [close]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const onTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight((h) => Math.min(h + 1, selectable.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      const opt = selectable[highlight];
      if (opt) selectValue(opt.value);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const onListKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, selectable.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = selectable[highlight];
      if (opt) selectValue(opt.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      triggerRef.current?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(Math.max(0, selectable.length - 1));
    }
  };

  return (
    <div
      ref={wrapRef}
      className={`hf-select${open ? " hf-select--open" : ""}${disabled ? " hf-select--disabled" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        className="hf-select__trigger hf-input hf-ds-input"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`hf-select__value${!displayLabel ? " hf-select__value--placeholder" : ""}`}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown className="hf-select__chevron" size={16} aria-hidden />
      </button>
      {open && !disabled ? (
        <ul
          ref={listRef}
          id={listId}
          className="hf-select__panel hf-dropdown-panel"
          role="listbox"
          aria-labelledby={id}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
        >
          {options.map((opt) => {
            const idx = selectable.indexOf(opt);
            if (idx < 0) {
              return (
                <li key={opt.value || "__empty"} className="hf-select__item" role="presentation">
                  <span className="hf-select__option hf-select__option--disabled">{opt.label}</span>
                </li>
              );
            }
            const isSelected = value === opt.value;
            const isFocused = idx === highlight;
            return (
              <li key={opt.value || "__empty"} className="hf-select__item" role="presentation">
                <button
                  type="button"
                  role="option"
                  data-idx={idx}
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  className={[
                    "hf-select__option",
                    "hf-dropdown-option",
                    isSelected ? "hf-select__option--selected hf-dropdown-option--selected" : "",
                    isFocused && !isSelected ? "hf-select__option--focus hf-dropdown-option--focus" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectValue(opt.value)}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

