import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

function useCountUp(target, duration = 1100, delay = 0) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion ? target : 0);
  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      return undefined;
    }
    let frame;
    const startAt = performance.now() + delay;
    const tick = (now) => {
      if (now < startAt) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, (now - startAt) / duration);
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(target * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
      else setValue(target);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, delay, reduceMotion]);
  return value;
}

export function AnimatedPercent({ value, delay = 0, style = {} }) {
  const n = useCountUp(Number(value) || 0, 1100, delay);
  return <span style={style}>{n}%</span>;
}

function GlowBar({ percent, delay = 0, color = "#6366f1" }) {
  const reduceMotion = useReducedMotion();
  const width = useCountUp(Math.min(100, Math.max(0, percent)), 900, delay);
  return (
    <div style={{ height: 6, borderRadius: 999, background: "rgba(148,163,184,0.15)", overflow: "hidden" }}>
      <motion.div
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${reduceMotion ? percent : width}%` }}
        transition={{ duration: 0.9, delay: delay / 1000, ease: [0.22, 1, 0.36, 1] }}
        style={{
          height: "100%",
          borderRadius: 999,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          boxShadow: `0 0 12px ${color}55`,
        }}
      />
    </div>
  );
}

export function RecruiterVerdictMeter({ meter, lang }) {
  if (!meter) return null;
  const tr = lang === "TR";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        borderRadius: 16,
        border: "1px solid rgba(99,102,241,0.45)",
        background: "linear-gradient(160deg, rgba(49,46,129,0.55), rgba(15,23,42,0.98))",
        padding: "14px 12px",
        boxShadow: "0 20px 48px rgba(99,102,241,0.22)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#c4b5fd", marginBottom: 12, textTransform: "uppercase" }}>
        {meter.title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 4 }}>{tr ? "Şu an" : "Now"}</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#fca5a5", fontFamily: "var(--font-display)", lineHeight: 1 }}>
            <AnimatedPercent value={meter.beforePercent} />
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>{meter.beforeLabel}</div>
        </div>
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          style={{ fontSize: 22, color: "#64748b" }}
        >
          →
        </motion.div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 4 }}>{tr ? "Fix sonrası" : "After fix"}</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#86efac", fontFamily: "var(--font-display)", lineHeight: 1 }}>
            <AnimatedPercent value={meter.afterPercent} delay={400} />
          </div>
          <div style={{ fontSize: 11, color: "#86efac", marginTop: 4, fontWeight: 700 }}>
            +{meter.gainPercent}%
          </div>
        </div>
      </div>
      <GlowBar percent={meter.afterPercent} delay={300} color="#6366f1" />
    </motion.div>
  );
}

export function ShortlistChanceCard({ data, lang }) {
  if (!data) return null;
  const tr = lang === "TR";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      whileHover={{ boxShadow: "0 12px 32px rgba(16,185,129,0.18)" }}
      style={{
        borderRadius: 14,
        border: "1px solid rgba(16,185,129,0.4)",
        background: "linear-gradient(135deg, rgba(6,78,59,0.35), rgba(15,23,42,0.92))",
        padding: "12px 11px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#6ee7b7", marginBottom: 10, textTransform: "uppercase" }}>
        {data.title}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800 }}>{tr ? "Şu an" : "Now"}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fde68a", fontFamily: "var(--font-display)" }}>
            <AnimatedPercent value={data.currentPercent} delay={200} />
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          style={{ textAlign: "right" }}
        >
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800 }}>{tr ? "Fix sonrası" : "After fix"}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#86efac", fontFamily: "var(--font-display)" }}>
            <AnimatedPercent value={data.afterPercent} delay={500} />
          </div>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7 }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 999,
          background: "rgba(16,185,129,0.25)",
          border: "1px solid rgba(16,185,129,0.45)",
          fontSize: 13,
          fontWeight: 800,
          color: "#bbf7d0",
        }}
      >
        <motion.span animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>
          ↑
        </motion.span>
        {tr ? "Artış" : "Gain"}: +{data.gainPercent}%
      </motion.div>
      <div style={{ marginTop: 10 }}>
        <GlowBar percent={data.afterPercent} delay={450} color="#10b981" />
      </div>
    </motion.div>
  );
}

export function FirstScreenPulse({ pulse, onFixClick }) {
  if (!pulse) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.12 }}
      style={{
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,0.2)",
        background: "rgba(15,23,42,0.65)",
        padding: "10px 10px",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(127,29,29,0.2)" }}>
          <div style={{ fontSize: 10, color: "#fca5a5", fontWeight: 800, marginBottom: 3, textTransform: "uppercase" }}>
            {pulse.blockingTitle}
          </div>
          <div style={{ fontSize: 13, color: "#fecaca", fontWeight: 700, lineHeight: 1.35 }}>{pulse.blockingText}</div>
        </div>
        <div style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(6,78,59,0.2)" }}>
          <div style={{ fontSize: 10, color: "#6ee7b7", fontWeight: 800, marginBottom: 3, textTransform: "uppercase" }}>
            {pulse.afterFixTitle}
          </div>
          <div style={{ fontSize: 15, color: "#f8fafc", fontWeight: 800, fontFamily: "var(--font-display)" }}>{pulse.afterFixText}</div>
        </div>
        <div style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(251,191,36,0.28)", background: "rgba(120,53,15,0.15)" }}>
          <div style={{ fontSize: 10, color: "#fbbf24", fontWeight: 800, marginBottom: 3, textTransform: "uppercase" }}>
            {pulse.recruiterCallTitle}
          </div>
          <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 700, lineHeight: 1.35 }}>{pulse.recruiterCallText}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={onFixClick}
        style={{
          width: "100%",
          padding: "11px 12px",
          borderRadius: 10,
          border: "none",
          background: "linear-gradient(135deg, #6366f1, #3b82f6)",
          color: "#fff",
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          boxShadow: "0 10px 28px rgba(99,102,241,0.35)",
        }}
      >
        {pulse.ctaLabel}
      </button>
    </motion.div>
  );
}

export function CareerMomentumBlock({ momentum }) {
  const total = useCountUp(momentum?.total || 0, 1000, 200);
  if (!momentum) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        borderRadius: 14,
        border: "1px solid rgba(99,102,241,0.35)",
        background: "linear-gradient(180deg, rgba(67,56,202,0.25), rgba(15,23,42,0.95))",
        padding: "11px 10px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#c4b5fd", textTransform: "uppercase" }}>
          {momentum.title}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#a5b4fc", fontFamily: "var(--font-display)" }}>+{total}</div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {momentum.pillars.map((p, idx) => (
          <div key={p.key}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "#cbd5e1", fontWeight: 700 }}>{p.label}</span>
              <span style={{ color: "#86efac", fontWeight: 800 }}>+{p.gain}</span>
            </div>
            <GlowBar percent={p.percent} delay={300 + idx * 120} color={p.color || "#818cf8"} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function CvHeatmapBlock({ heatmap }) {
  if (!heatmap?.sections?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,0.18)",
        background: "rgba(15,23,42,0.5)",
        padding: "10px 10px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 10, textTransform: "uppercase" }}>
        {heatmap.title}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {heatmap.sections.map((s, idx) => (
          <motion.div
            key={s.key}
            whileHover={{ boxShadow: "0 0 16px rgba(99,102,241,0.2)" }}
            style={{ borderRadius: 8, padding: "4px 2px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{s.label}</span>
              <span style={{ color: s.score >= 65 ? "#86efac" : s.score >= 45 ? "#fde68a" : "#fca5a5", fontWeight: 800 }}>
                {s.score}
              </span>
            </div>
            <GlowBar percent={s.score} delay={100 + idx * 80} color={s.score >= 65 ? "#22c55e" : s.score >= 45 ? "#eab308" : "#ef4444"} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function MemoryColumn({ column, accent }) {
  if (!column?.items?.length) return null;
  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${accent.border}`,
        background: accent.bg,
        padding: "8px 9px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: accent.label, marginBottom: 6, textTransform: "uppercase" }}>
        {column.label}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4 }}>
        {column.items.map((item) => (
          <li key={item} style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 650, lineHeight: 1.35 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CareerMemoryBlock({ memory, lang }) {
  if (!memory) return null;
  const chips = [
    memory.identity,
    memory.level,
    memory.analysisCount > 0 ? `${memory.analysisCount} ${lang === "TR" ? "analiz" : "analyses"}` : "",
  ].filter(Boolean);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        borderRadius: 14,
        border: "1px solid rgba(56,189,248,0.35)",
        background: "linear-gradient(180deg, rgba(8,47,73,0.35), rgba(15,23,42,0.95))",
        padding: "11px 10px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#7dd3fc", textTransform: "uppercase", marginBottom: 4 }}>
        {memory.title}
      </div>
      {memory.subtitle ? (
        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 650, marginBottom: 10, lineHeight: 1.4 }}>{memory.subtitle}</div>
      ) : null}
      {chips.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {chips.map((chip) => (
            <span
              key={chip}
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid rgba(56,189,248,0.35)",
                background: "rgba(14,116,144,0.2)",
                color: "#bae6fd",
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
      {(memory.strongSignals?.length || memory.weakSignals?.length) && memory.isFirstProfile ? (
        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          {memory.strongSignals?.length ? (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#86efac", marginBottom: 4, letterSpacing: "0.06em" }}>
                {lang === "TR" ? "Güçlü sinyaller" : "Strong signals"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {memory.strongSignals.map((s) => (
                  <span key={s} style={{ fontSize: 11, color: "#bbf7d0", fontWeight: 700 }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {memory.weakSignals?.length ? (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#fca5a5", marginBottom: 4, letterSpacing: "0.06em" }}>
                {lang === "TR" ? "Zayıf sinyaller" : "Weak signals"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {memory.weakSignals.map((s) => (
                  <span key={s} style={{ fontSize: 11, color: "#fecaca", fontWeight: 700 }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 8 }}>
        <MemoryColumn
          column={memory.improved}
          accent={{ border: "rgba(34,197,94,0.35)", bg: "rgba(20,83,45,0.2)", label: "#86efac" }}
        />
        <MemoryColumn
          column={memory.worse}
          accent={{ border: "rgba(239,68,68,0.35)", bg: "rgba(127,29,29,0.18)", label: "#fca5a5" }}
        />
        <MemoryColumn
          column={memory.stayedStrong}
          accent={{ border: "rgba(99,102,241,0.35)", bg: "rgba(49,46,129,0.2)", label: "#c4b5fd" }}
        />
      </div>
    </motion.div>
  );
}

function interviewChanceColor(key) {
  if (key === "high") return "#86efac";
  if (key === "medium") return "#fde68a";
  return "#fca5a5";
}

export function PersonalizedProfileInsights({ insights }) {
  if (!insights?.lines?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        borderRadius: 14,
        border: "1px solid rgba(167,139,250,0.35)",
        background: "linear-gradient(160deg, rgba(76,29,149,0.22), rgba(15,23,42,0.92))",
        padding: "11px 10px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#e9d5ff", textTransform: "uppercase", marginBottom: 4 }}>
        {insights.title}
      </div>
      {insights.subtitle ? (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10, lineHeight: 1.4 }}>{insights.subtitle}</div>
      ) : null}
      {insights.identity ? (
        <div style={{ fontSize: 12, fontWeight: 800, color: "#c4b5fd", marginBottom: 8 }}>{insights.identity}</div>
      ) : null}
      <div style={{ display: "grid", gap: 6 }}>
        {insights.lines.map((line) => (
          <div key={line} style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 650, lineHeight: 1.45, paddingLeft: 8, borderLeft: "2px solid rgba(167,139,250,0.5)" }}>
            {line}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function RecommendedJobsSection({ data, lang, loading, onApply, onRisky, onSkip }) {
  if (!data?.jobs?.length && !loading) return null;
  const tr = lang === "TR";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        borderRadius: 16,
        border: "1px solid rgba(129,140,248,0.4)",
        background: "linear-gradient(160deg, rgba(67,56,202,0.28), rgba(15,23,42,0.97))",
        padding: "12px 11px",
        boxShadow: "0 14px 36px rgba(99,102,241,0.18)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#c4b5fd", textTransform: "uppercase" }}>
            {data?.title || (tr ? "ÖNERİLEN İLANLAR" : "RECOMMENDED JOBS")}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 650, marginTop: 4, lineHeight: 1.4, maxWidth: 320 }}>
            {data?.subtitle ||
              (tr
                ? "HireFit senin için fırsat tarıyor — sadece yüklediğin ilanlarla sınırlı değilsin."
                : "HireFit actively finds opportunities — you are not limited to jobs you upload.")}
          </div>
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: "4px 8px",
            borderRadius: 999,
            border: "1px solid rgba(167,139,250,0.35)",
            background: "rgba(99,102,241,0.2)",
            color: "#ddd6fe",
            whiteSpace: "nowrap",
          }}
        >
          {tr ? "Aktif keşif" : "Active discovery"}
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, padding: "8px 4px" }}>
          {tr ? "İlanlar eşleştiriliyor…" : "Matching opportunities…"}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {data.jobs.map((job, idx) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 * idx }}
              style={{
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.2)",
                background: "rgba(15,23,42,0.55)",
                padding: "10px 10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc", lineHeight: 1.25 }}>{job.displayTitle}</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginTop: 2 }}>{job.level}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "#a5b4fc", lineHeight: 1 }}>
                    {job.matchPercent}%
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{tr ? "beklenen uyum" : "expected match"}</div>
                </div>
              </div>

              {job.reasons?.length ? (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>
                    {tr ? "Neden uyuyor" : "Why it matches"}
                  </div>
                  {job.reasons.map((r) => (
                    <div key={r} style={{ fontSize: 12, color: "#bbf7d0", fontWeight: 700, lineHeight: 1.35 }}>
                      · {r}
                    </div>
                  ))}
                </div>
              ) : null}

              {job.missing?.length ? (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>
                    {tr ? "Eksik" : "Missing"}
                  </div>
                  <div style={{ fontSize: 12, color: "#fde68a", fontWeight: 700 }}>{job.missing.join(" · ")}</div>
                </div>
              ) : null}

              <div style={{ marginBottom: 10, fontSize: 12 }}>
                <span style={{ color: "#64748b", fontWeight: 800 }}>{tr ? "Mülakat şansı: " : "Expected interview chance: "}</span>
                <span style={{ color: interviewChanceColor(job.interviewChanceKey), fontWeight: 800 }}>{job.interviewChance}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => onApply?.(job)}
                  style={{
                    padding: "8px 6px",
                    borderRadius: 8,
                    border: "1px solid rgba(34,197,94,0.45)",
                    background: "rgba(22,163,74,0.25)",
                    color: "#bbf7d0",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {tr ? "Başvur" : "Apply"}
                </button>
                <button
                  type="button"
                  onClick={() => onRisky?.(job)}
                  style={{
                    padding: "8px 6px",
                    borderRadius: 8,
                    border: "1px solid rgba(251,191,36,0.45)",
                    background: "rgba(120,53,15,0.35)",
                    color: "#fde68a",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {tr ? "Riskli" : "Risky"}
                </button>
                <button
                  type="button"
                  onClick={() => onSkip?.(job)}
                  style={{
                    padding: "8px 6px",
                    borderRadius: 8,
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(30,41,59,0.6)",
                    color: "#94a3b8",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {tr ? "Geç" : "Skip"}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function CareerGrowthCard({ growth, lang }) {
  const score = useCountUp(growth?.careerScore || 0, 1200, 100);
  if (!growth) return null;
  const maxTimeline = Math.max(...(growth.timeline || []).map((t) => t.score), growth.careerScore || 1, 1);
  const delta = Number(growth.scoreDelta) || 0;
  const deltaUp = delta > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      style={{
        borderRadius: 16,
        border: "1px solid rgba(16,185,129,0.35)",
        background: "linear-gradient(145deg, rgba(6,78,59,0.35), rgba(15,23,42,0.96) 55%, rgba(49,46,129,0.2))",
        padding: "12px 11px",
        boxShadow: "0 12px 40px rgba(16,185,129,0.12)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#6ee7b7", textTransform: "uppercase" }}>
            {growth.title}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 650, marginTop: 4, lineHeight: 1.4, maxWidth: 220 }}>
            {growth.subtitle}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {lang === "TR" ? "Career Score" : "Career Score"}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 800, color: "#a7f3d0", lineHeight: 1 }}>
            {score}
          </div>
          {delta !== 0 ? (
            <div style={{ fontSize: 12, fontWeight: 800, color: deltaUp ? "#86efac" : "#fca5a5", marginTop: 2 }}>
              {deltaUp ? "+" : ""}
              {delta}
            </div>
          ) : null}
        </div>
      </div>

      {growth.timeline?.length ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>
            {lang === "TR" ? "Zaman çizelgesi" : "Timeline"}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minHeight: 88, padding: "4px 2px 0" }}>
            {growth.timeline.map((point, idx) => {
              const h = Math.max(12, Math.round((point.score / maxTimeline) * 72));
              const isLast = idx === growth.timeline.length - 1;
              return (
                <motion.div
                  key={point.monthKey || point.month}
                  initial={{ opacity: 0, scaleY: 0.3 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ delay: 0.08 * idx, duration: 0.35 }}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transformOrigin: "bottom" }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: isLast ? "#bbf7d0" : "#cbd5e1" }}>{point.score}</div>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 44,
                      height: h,
                      borderRadius: "8px 8px 4px 4px",
                      background: isLast
                        ? "linear-gradient(180deg, #34d399, #059669)"
                        : "linear-gradient(180deg, rgba(99,102,241,0.7), rgba(99,102,241,0.25))",
                      boxShadow: isLast ? "0 0 16px rgba(52,211,153,0.45)" : "none",
                    }}
                  />
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "capitalize" }}>{point.month}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : null}

      {growth.pillars?.length ? (
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {growth.pillars.map((p, idx) => (
            <div key={p.key}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: "#cbd5e1", fontWeight: 700 }}>{p.label}</span>
                <span style={{ color: p.color, fontWeight: 800 }}>{p.value}</span>
              </div>
              <GlowBar percent={p.value} delay={200 + idx * 90} color={p.color} />
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div
          style={{
            borderRadius: 10,
            border: "1px solid rgba(34,197,94,0.35)",
            background: "rgba(20,83,45,0.22)",
            padding: "8px 9px",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, color: "#86efac", letterSpacing: "0.06em", marginBottom: 6, textTransform: "uppercase" }}>
            {growth.biggestImprovement?.title}
          </div>
          {(growth.biggestImprovement?.items || []).map((item) => (
            <div key={item} style={{ fontSize: 13, color: "#bbf7d0", fontWeight: 800, lineHeight: 1.35, marginBottom: 4 }}>
              {item}
            </div>
          ))}
        </div>
        <div
          style={{
            borderRadius: 10,
            border: "1px solid rgba(251,113,133,0.35)",
            background: "rgba(127,29,29,0.18)",
            padding: "8px 9px",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, color: "#fda4af", letterSpacing: "0.06em", marginBottom: 6, textTransform: "uppercase" }}>
            {growth.biggestWeakness?.title}
          </div>
          <div style={{ fontSize: 14, color: "#fecdd3", fontWeight: 800, lineHeight: 1.3 }}>{growth.biggestWeakness?.label}</div>
        </div>
      </div>
    </motion.div>
  );
}

export function RecruiterReactionPanel({ panel, lang }) {
  if (!panel?.rows?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      style={{
        borderRadius: 14,
        border: "1px solid rgba(251,191,36,0.3)",
        background: "linear-gradient(180deg, rgba(120,53,15,0.18), rgba(15,23,42,0.92))",
        padding: "10px 10px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#fbbf24", marginBottom: 10, textTransform: "uppercase" }}>
        {panel.title}
      </div>
      <div style={{ display: "grid", gap: 7 }}>
        {panel.rows.map((row, idx) => (
          <motion.div
            key={row.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * idx }}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
            style={{ borderRadius: 8, padding: "6px 7px" }}
          >
            <div style={{ fontSize: 12, color: "#fde68a", fontWeight: 800, marginBottom: 2 }}>
              {row.emoji} {row.label}
            </div>
            <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 650, lineHeight: 1.4 }}>{row.value}</div>
          </motion.div>
        ))}
      </div>
      {panel.trustBand ? (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(148,163,184,0.12)", fontSize: 12 }}>
          <span style={{ color: "#64748b", fontWeight: 800 }}>{lang === "TR" ? "Güven" : "Trust"}: </span>
          <span style={{ color: "#f8fafc", fontWeight: 800 }}>{panel.trustBand}</span>
        </div>
      ) : null}
    </motion.div>
  );
}

