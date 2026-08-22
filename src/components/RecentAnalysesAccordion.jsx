import { useState } from "react";
import "./career-os/career-os.css";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, History, Trash2, Clock, ChevronRight } from "lucide-react";

/**
 * Collapsible recent analyses — collapsed shows count, expanded lists all.
 */
export default function RecentAnalysesAccordion({
  history = [],
  lang,
  title,
  clearLabel,
  emptyLabel,
  onLoadItem,
  onClear,
  renderRow,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const tr = lang === "TR";
  const count = history.length;

  return (
    <section className={`hf-recent-analyses-accordion ${className}`.trim()} data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="hf-recent-analyses-accordion__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="hf-recent-analyses-accordion__left">
          <History size={14} aria-hidden />
          <span className="hf-recent-analyses-accordion__title">
            {title || (tr ? "Son Analizler" : "Recent Analyses")} ({count})
          </span>
        </span>
        <span className="hf-recent-analyses-accordion__right">
          {count > 0 && onClear ? (
            <span
              role="button"
              tabIndex={0}
              className="hf-recent-analyses-accordion__clear"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onClear();
                }
              }}
            >
              <Trash2 size={11} aria-hidden /> {clearLabel || (tr ? "Temizle" : "Clear")}
            </span>
          ) : null}
          <ChevronDown size={16} className="hf-recent-analyses-accordion__chevron" aria-hidden />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            className="hf-recent-analyses-accordion__body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            {count === 0 ? (
              <div className="hf-analyzer-history-empty">
                <Clock size={22} aria-hidden className="hf-analyzer-history-empty__icon" />
                <span>{emptyLabel || (tr ? "Henüz analiz yok" : "No analyses yet")}</span>
              </div>
            ) : (
              <div className="hf-analyzer-history-list">
                {history.map((item, idx) =>
                  renderRow ? (
                    renderRow(item, idx)
                  ) : (
                    <button
                      type="button"
                      key={item.id || idx}
                      className="hf-analyzer-history-item"
                      onClick={() => onLoadItem?.(item)}
                    >
                      <div className="hf-analyzer-history-item__left">
                        <div className="hf-analyzer-history-item__text">
                          <div className="hf-analyzer-history-item__job">{item.role || (tr ? "Analiz" : "Analysis")}</div>
                          <div className="hf-analyzer-history-item__date">{item.createdAt}</div>
                        </div>
                      </div>
                      <ChevronRight size={18} className="hf-analyzer-history-chevron" aria-hidden />
                    </button>
                  )
                )}
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

