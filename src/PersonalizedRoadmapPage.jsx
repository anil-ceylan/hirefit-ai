import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toText(v) {
  return String(v || "").trim();
}

function uniqByRole(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const role = toText(r.role);
    if (!role) continue;
    const k = role.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function detectRoleCandidates({ engineV2, analysisData, cvText, lang }) {
  const fromV2 = Array.isArray(engineV2?.RoleFit?.role_fit)
    ? engineV2.RoleFit.role_fit.map((r) => ({
        role: toText(r.role),
        score: clamp(Number(r.score) || 0, 0, 100),
        why: toText(r.evidence),
      }))
    : [];
  const fromLegacy = Array.isArray(analysisData?.role_matches)
    ? analysisData.role_matches.map((r) => ({
        role: toText(r.role),
        score: clamp(Number(r.match_score) || 0, 0, 100),
        why: "",
      }))
    : [];
  let rows = uniqByRole([...fromV2, ...fromLegacy]).sort((a, b) => b.score - a.score);

  const cv = toText(cvText).toLowerCase();
  const inferred = [];
  const pushInf = (role, score, why) => inferred.push({ role, score, why });
  if (/sql|python|power bi|tableau|analytics|analysis|veri/i.test(cv)) {
    pushInf(lang === "TR" ? "Veri Analisti" : "Data Analyst", 72, lang === "TR"
      ? "CV'nde analitik düşünme ve veriyle çalışma sinyali var."
      : "Your CV already shows analytical thinking and data signal.");
  }
  if (/business|stakeholder|report|excel|process|iş/i.test(cv)) {
    pushInf(lang === "TR" ? "İş Analisti" : "Business Analyst", 68, lang === "TR"
      ? "İş ve veri yorumlama arasında köprü kuran bir profilin var."
      : "Your background aligns with business plus data interpretation.");
  }
  if (/product|roadmap|feature|user|ux/i.test(cv)) {
    pushInf(lang === "TR" ? "Ürün Analisti" : "Product Analyst", 64, lang === "TR"
      ? "Ürün ve karar desteği tarafında güçlü sinyallerin var."
      : "You show good signal for product-facing analytical work.");
  }
  if (/operations|operasyon|planning|forecast/i.test(cv)) {
    pushInf(lang === "TR" ? "Operasyon Analisti" : "Operations Analyst", 62, lang === "TR"
      ? "Operasyonel düşünme ve yapı kurma sinyalin net."
      : "You show operational structure and process thinking.");
  }

  rows = uniqByRole([...rows, ...inferred]).sort((a, b) => b.score - a.score);
  const fallback = lang === "TR"
    ? [
        { role: "Veri Analisti", score: 70, why: "Analitik düşünme ve yapılandırılmış problem çözme sinyalin güçlü." },
        { role: "İş Analisti", score: 66, why: "İş hedefi ve veri yorumlama tarafına doğal bir geçişin var." },
        { role: "Operasyon Analisti", score: 62, why: "Süreç, raporlama ve karar desteği tarafında güçlü temelin var." },
      ]
    : [
        { role: "Data Analyst", score: 70, why: "You already show analytical thinking and structured problem solving." },
        { role: "Business Analyst", score: 66, why: "Your background aligns with business plus data interpretation." },
        { role: "Operations Analyst", score: 62, why: "You show strong process and reporting foundations." },
      ];

  const finalRows = rows.slice(0, 3);
  if (finalRows.length < 3) {
    for (const f of fallback) {
      if (finalRows.length >= 3) break;
      if (!finalRows.some((x) => x.role.toLowerCase() === f.role.toLowerCase())) finalRows.push(f);
    }
  }
  return finalRows.slice(0, 3);
}

function bestPathForRole(role, lang) {
  const r = toText(role).toLowerCase();
  if (r.includes("data")) return lang === "TR" ? "Veri Analisti → Ürün Analisti → Ürün Yöneticisi" : "Data Analyst → Product Analyst → Product Manager";
  if (r.includes("business")) return lang === "TR" ? "İş Analisti → Strateji Analisti → Strateji Yöneticisi" : "Business Analyst → Strategy Analyst → Strategy Manager";
  if (r.includes("product")) return lang === "TR" ? "Ürün Analisti → Ürün Uzmanı → Ürün Yöneticisi" : "Product Analyst → Product Specialist → Product Manager";
  return lang === "TR" ? "Analist → Kıdemli Analist → Yönetici" : "Analyst → Senior Analyst → Manager";
}

function buildProjectIdea({ topRole, biggestGap, missingSkills, lang }) {
  const ms = (missingSkills || []).map((x) => toText(x)).filter(Boolean);
  const keySkill = ms[0] || (lang === "TR" ? "SQL ve dashboard" : "SQL and dashboarding");
  const gap = toText(biggestGap) || (lang === "TR" ? "saha kanıtı eksikliği" : "lack of real-world proof");
  const role = toText(topRole) || (lang === "TR" ? "Analist" : "Analyst");
  return {
    title: lang === "TR"
      ? `${role} için Gerçek Dünya Etki Dashboard'u`
      : `Real-World Impact Dashboard for ${role}`,
    context: lang === "TR"
      ? `Bu proje, ${gap} boşluğunu kapatırken mevcut analitik yönünü görünür hale getirir.`
      : `This project closes your ${gap} gap while making your existing analytical strength visible.`,
    dataSource: lang === "TR"
      ? `Kaggle veya World Bank verisi kullan; odağı ${keySkill} sinyaline bağla.`
      : `Use Kaggle or World Bank data and tie the output to ${keySkill} signal.`,
    outcome: lang === "TR"
      ? "Analitik + iş etkisi sinyalini aynı anda kanıtlar ve fit skorunu doğrudan güçlendirir."
      : "Proves analytical + business impact in one asset and directly strengthens your fit signal.",
  };
}

function roadmapPhases({ topRole, biggestGap, missingSkills, lang }) {
  const ms = (missingSkills || []).map((x) => toText(x)).filter(Boolean);
  const skillA = ms[0] || (lang === "TR" ? "SQL" : "SQL");
  const skillB = ms[1] || (lang === "TR" ? "Dashboard" : "dashboarding");
  const gap = toText(biggestGap) || (lang === "TR" ? "rol konumlanması" : "role positioning");
  const role = toText(topRole) || (lang === "TR" ? "Analist" : "Analyst");
  return {
    p1: [
      lang === "TR" ? `${role} odağını CV özetinin ilk 2 satırına taşı.` : `Rewrite your CV summary around ${role} in first 2 lines.`,
      lang === "TR" ? `${gap} ile ilgili bölümü net bir cümleyle düzelt.` : `Fix the ${gap} signal with one explicit positioning line.`,
      lang === "TR" ? "Deneyim kısmına 2 ölçülebilir sonuç (%, zaman, gelir) ekle." : "Add 2 measurable outcomes (%) to your experience bullets.",
    ],
    p2: [
      lang === "TR" ? "Kişisel proje dashboard'unu bitir ve tek linkte yayınla." : "Build and publish the personalized dashboard project.",
      lang === "TR" ? `${skillA} temelini role odaklı senaryolarla tamamla.` : `Learn ${skillA} basics on role-relevant scenarios.`,
      lang === "TR" ? `${skillB} çıktısını işe alım uzmanının okuyacağı formata çevir.` : `Convert ${skillB} output into recruiter-readable proof.`,
    ],
    p3: [
      lang === "TR" ? `${role} ve yakın rollere odaklan; alakasız ilanları ele.` : `Apply only to ${role} and adjacent tracks; cut mismatch roles.`,
      lang === "TR" ? `İlanlarda SQL/BI/analitik sinyali olan şirketleri hedefle.` : `Target companies with clear SQL/BI/analytics demand.`,
      lang === "TR" ? `Her başvuruda özeti ilana göre 3 dakikada mikro düzenle.` : `Do a 3-minute role-tailored summary tweak before each application.`,
    ],
  };
}

function blockStyle() {
  return {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    background: "rgba(255,255,255,0.02)",
    padding: "18px 20px",
    marginBottom: 14,
  };
}

function LockedHint({ lang, onUpgrade }) {
  return (
    <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(99,102,241,0.28)", background: "rgba(99,102,241,0.08)", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <div style={{ fontSize: 12, color: "#94a3b8" }}>
        {lang === "TR" ? "Detayları görmek için Pro’ya geç." : "Upgrade to Pro to unlock full details."}
      </div>
      <button type="button" onClick={onUpgrade} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
        {lang === "TR" ? "Pro'ya geç →" : "Upgrade to Pro →"}
      </button>
    </div>
  );
}

function CareerNavigationMap({
  lang,
  steps,
  completed,
  selectedStepId,
  currentStepIndex,
  onSelectStep,
  onToggleStep,
  pathLabel,
  onReanalyzeAnotherRole,
  compact = false,
}) {
  const tr = lang === "TR";
  const [rippleNodeId, setRippleNodeId] = useState(null);
  const [recentlyCompletedId, setRecentlyCompletedId] = useState(null);
  const [rewardToast, setRewardToast] = useState(null);
  const [buttonBoost, setButtonBoost] = useState(false);
  const nodeGap = 88;
  const topOffset = 24;
  const lineHeight = Math.max(0, (steps.length - 1) * nodeGap);
  const indicatorY = topOffset + Math.max(0, currentStepIndex) * nodeGap;
  const activeStep = steps.find((s) => s.id === selectedStepId) || steps[0];
  const completedCount = steps.reduce((acc, step) => acc + (completed[step.id] ? 1 : 0), 0);
  const totalSteps = steps.length || 1;
  const progressPct = Math.round((completedCount / totalSteps) * 100);
  const allComplete = completedCount >= totalSteps;
  const stepIndexLabel = Math.min(currentStepIndex + 1, totalSteps);
  const stepsCompletedText = tr
    ? `${completedCount} / ${totalSteps} adım tamamlandı`
    : `${completedCount} of ${totalSteps} steps completed`;
  const statusByStep = tr
    ? [
        "Temeli inşa ediyorsun...",
        "Çalışma kanıtını üretiyorsun...",
        "Başvuruları icraya alıyorsun...",
      ]
    : [
        "Building your foundation...",
        "Creating proof of work...",
        "Executing applications...",
      ];
  const liveStatus = allComplete
    ? tr
      ? "Artık güçlü bir profille başvurmaya hazırsın."
      : "You are now ready to apply with a strong profile."
    : statusByStep[Math.min(currentStepIndex, statusByStep.length - 1)];
  const isExecutionPhase = activeStep.id === "apply";

  const rewardMessage = (points) => {
    const n = Number(points) || 0;
    if (n >= 15) {
      return tr
        ? "Top-tier aday sinyaline yaklaştın."
        : "You're now showing top-tier candidate signal.";
    }
    if (n >= 10) {
      return tr
        ? "Bu seviyede çoğu adaydan daha güçlüsün."
        : "You're now stronger than most applicants at this level.";
    }
    return tr
      ? "Aday havuzunun ortalamasının üstüne çıktın."
      : "You're now stronger than average at this level.";
  };

  const triggerCompletionFeedback = (step) => {
    const points = step?.rewardPoints || 10;
    setButtonBoost(true);
    setTimeout(() => setButtonBoost(false), 220);
    setRecentlyCompletedId(step.id);
    setRewardToast({
      points,
      text: rewardMessage(points),
      done: tr ? "Adım tamamlandı ✔" : "Step completed ✔",
      momentum: tr ? "Momentum arttı" : "Momentum increased",
    });
    setTimeout(() => setRecentlyCompletedId(null), 700);
  };

  useEffect(() => {
    if (!rewardToast) return undefined;
    const t = setTimeout(() => setRewardToast(null), 2000);
    return () => clearTimeout(t);
  }, [rewardToast]);

  if (compact) {
    return (
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "linear-gradient(180deg, rgba(15,23,42,0.52), rgba(15,23,42,0.28))",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          padding: "14px 12px",
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 700 }}>
            {allComplete
              ? tr
                ? `Adımlar tamamlandı — ${totalSteps}/${totalSteps}`
                : `Steps complete — ${totalSteps}/${totalSteps}`
              : tr
                ? `Adım ${stepIndexLabel}/${totalSteps} — ${activeStep.label}`
                : `Step ${stepIndexLabel} of ${totalSteps} — ${activeStep.label}`}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            {tr ? `%${progressPct} tamamlandı` : `${progressPct}% complete`}
          </div>
          <div style={{ fontSize: 11, color: "#7dd3fc", marginTop: 2 }}>
            {stepsCompletedText}
          </div>
          <div
            style={{
              marginTop: 8,
              width: "100%",
              height: 8,
              borderRadius: 999,
              background: "rgba(148,163,184,0.2)",
              overflow: "hidden",
            }}
          >
            <motion.div
              style={{
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #38bdf8 0%, #6366f1 55%, #a855f7 100%)",
              }}
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
          {steps.map((step, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isDone = Boolean(completed[step.id]);
            const isActive = step.id === selectedStepId;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onSelectStep(step.id)}
                style={{
                  minWidth: 150,
                  textAlign: "left",
                  borderRadius: 12,
                  border: `1px solid ${isActive ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`,
                  background: isActive ? "rgba(99,102,241,0.16)" : "rgba(255,255,255,0.03)",
                  padding: "10px 10px",
                  color: "#e2e8f0",
                  opacity: idx > currentStepIndex ? 0.6 : 1,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
                  {isDone ? "✓ " : ""}{step.label}
                </div>
                <div style={{ fontSize: 11, color: isCurrent ? "#93c5fd" : "#94a3b8" }}>
                  {isCurrent ? (tr ? "Şu anki adım" : "Current step") : tr ? "Milestone" : "Milestone"}
                </div>
              </button>
            );
          })}
        </div>
        <motion.button
          type="button"
          onClick={() => {
            if (!completed[activeStep.id]) {
              triggerCompletionFeedback(activeStep);
            }
            onToggleStep(activeStep.id);
          }}
          style={{
            marginTop: 8,
            width: "100%",
            border: "none",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            fontWeight: 700,
            color: "#0f172a",
            background: completed[activeStep.id]
              ? "linear-gradient(135deg, #34d399, #22c55e)"
              : "linear-gradient(135deg, #38bdf8, #6366f1 55%, #a855f7)",
            boxShadow: buttonBoost ? "0 0 22px rgba(99,102,241,0.6)" : "0 6px 14px rgba(99,102,241,0.25)",
          }}
          whileTap={{ scale: 0.97 }}
        >
          {completed[activeStep.id]
            ? tr
              ? "Tamamlandı (geri al)"
              : "Completed (undo)"
            : tr
              ? "Adımı tamamla"
              : "Complete step"}
        </motion.button>

        <AnimatePresence>
          {rewardToast ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              style={{
                marginTop: 10,
                borderRadius: 12,
                border: "1px solid rgba(56,189,248,0.4)",
                background: "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(99,102,241,0.18))",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                padding: "10px 12px",
              }}
            >
              <div style={{ color: "#bfdbfe", fontSize: 13, fontWeight: 800 }}>
                +{rewardToast.points} {tr ? "Fit Skoru" : "Fit Score"} ↑
              </div>
              <div style={{ color: "#e2e8f0", fontSize: 12, marginTop: 3 }}>{rewardToast.text}</div>
              <div style={{ color: "#a5f3fc", fontSize: 11, marginTop: 5 }}>{rewardToast.done}</div>
              <div style={{ color: "#93c5fd", fontSize: 11 }}>{rewardToast.momentum}</div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.11)",
        background: "linear-gradient(180deg, rgba(15,23,42,0.55), rgba(15,23,42,0.3))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        padding: "22px 18px 18px",
        minHeight: 520,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        {tr ? "Career Navigator" : "Career Navigator"}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 700, marginBottom: 5 }}>
          {tr
            ? `Şu yol üzerindesin: ${pathLabel || "Veri Analisti → Ürün Yöneticisi"}`
            : `You're on your path to ${pathLabel || "Data Analyst → Product Manager"}`}
        </div>
        <div style={{ fontSize: 12, color: "#dbeafe", fontWeight: 700 }}>
          {allComplete
            ? tr
              ? `Adımlar tamamlandı — ${totalSteps}/${totalSteps}`
              : `Steps complete — ${totalSteps}/${totalSteps}`
            : tr
              ? `Adım ${stepIndexLabel}/${totalSteps} — ${activeStep.label}`
              : `Step ${stepIndexLabel} of ${totalSteps} — ${activeStep.label}`}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
          {tr ? `%${progressPct} tamamlandı` : `${progressPct}% complete`}
        </div>
        <div style={{ fontSize: 11, color: "#7dd3fc", marginTop: 2 }}>
          {stepsCompletedText}
        </div>
        <div
          style={{
            marginTop: 8,
            width: "100%",
            height: 8,
            borderRadius: 999,
            background: "rgba(148,163,184,0.2)",
            overflow: "hidden",
          }}
        >
          <motion.div
            style={{
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #38bdf8 0%, #6366f1 55%, #a855f7 100%)",
            }}
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={liveStatus}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ marginTop: 8, fontSize: 12, color: allComplete ? "#a7f3d0" : "#cbd5e1" }}
          >
            {liveStatus}
          </motion.div>
        </AnimatePresence>
      </div>

      {allComplete ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0.92, 1, 0.92], y: 0 }}
          transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
          style={{
            marginBottom: 14,
            borderRadius: 14,
            border: "1px solid rgba(74,222,128,0.45)",
            background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.12))",
            boxShadow: "0 0 18px rgba(34,197,94,0.25)",
            padding: "12px 13px",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: "#dcfce7" }}>
            {tr
              ? "Artık güçlü bir profille başvurmaya hazırsın."
              : "You are now ready to apply with a strong profile."}
          </div>
          <div style={{ fontSize: 12, color: "#bbf7d0", marginTop: 4 }}>
            {tr
              ? "Kanıt ürettin, sinyalini güçlendirdin ve hedef rolünle hizalandın."
              : "You’ve built proof, improved your signal, and aligned with your target role."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button
              type="button"
              onClick={() => onSelectStep("apply")}
              style={{
                border: "none",
                borderRadius: 9,
                padding: "8px 12px",
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "#052e16",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {tr ? "Başvurmaya başla →" : "Start applying →"}
            </button>
            <button
              type="button"
              onClick={onReanalyzeAnotherRole}
              style={{
                borderRadius: 9,
                padding: "8px 12px",
                background: "rgba(15,23,42,0.35)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#e2e8f0",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {tr ? "Başka rolü tekrar analiz et" : "Re-analyze another role"}
            </button>
          </div>
        </motion.div>
      ) : null}

      <div style={{ position: "relative", paddingLeft: 12, paddingRight: 6, minHeight: lineHeight + 80 }}>
        <svg
          aria-hidden
          style={{
            position: "absolute",
            left: 8,
            top: topOffset,
            width: 24,
            height: lineHeight + 2,
            overflow: "visible",
          }}
          viewBox={`0 0 24 ${lineHeight + 2}`}
        >
          <defs>
            <linearGradient id="hfRouteGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="55%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <motion.path
            d={`M 12 1 L 12 ${lineHeight + 1}`}
            stroke="url(#hfRouteGrad)"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.25, ease: "easeInOut" }}
          />
          <motion.path
            d={`M 12 1 L 12 ${lineHeight + 1}`}
            stroke="rgba(96,165,250,0.55)"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            style={{ filter: "blur(4px)" }}
            animate={{ opacity: [0.35, 0.8, 0.35] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>

        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            left: 13,
            top: topOffset - 6,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.95) 10%, rgba(56,189,248,0.95) 55%, rgba(59,130,246,0.45) 100%)",
            boxShadow: "0 0 18px rgba(56,189,248,0.9)",
            pointerEvents: "none",
          }}
          animate={{ y: [0, lineHeight, 0] }}
          transition={{ duration: 4.6, ease: "linear", repeat: Infinity }}
        />

        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            left: 8,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,1) 15%, rgba(129,140,248,0.9) 70%)",
            boxShadow: "0 0 24px rgba(129,140,248,0.9), 0 0 0 1px rgba(255,255,255,0.5)",
            pointerEvents: "none",
            zIndex: 3,
          }}
          animate={{ y: indicatorY }}
          transition={{ duration: 0.72, ease: "easeInOut" }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative", zIndex: 2 }}>
          {steps.map((step, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isFuture = idx > currentStepIndex;
            const isDone = Boolean(completed[step.id]);
            const isActive = step.id === selectedStepId;
            return (
              <motion.button
                key={step.id}
                type="button"
                onClick={() => {
                  setRippleNodeId(step.id);
                  onSelectStep(step.id);
                }}
                onAnimationComplete={() => {
                  if (rippleNodeId === step.id) setRippleNodeId(null);
                }}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.985 }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: `1px solid ${isActive ? "rgba(129,140,248,0.66)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 14,
                  background: isActive ? "rgba(99,102,241,0.16)" : "rgba(255,255,255,0.02)",
                  padding: "12px 12px 12px 44px",
                  cursor: "pointer",
                  opacity: isFuture ? 0.5 : isDone ? 0.72 : 1,
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: isActive ? "0 0 26px rgba(99,102,241,0.24)" : "none",
                }}
              >
                {rippleNodeId === step.id ? (
                  <motion.span
                    aria-hidden
                    initial={{ scale: 0.4, opacity: 0.45 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      left: 6,
                      top: "50%",
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      border: "1px solid rgba(129,140,248,0.55)",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  />
                ) : null}

                <motion.div
                  animate={isCurrent ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={{ duration: 1.4, repeat: isCurrent ? Infinity : 0, ease: "easeInOut" }}
                  style={{
                    position: "absolute",
                    left: 7,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: `2px solid ${isDone ? "#34d399" : isCurrent ? "#60a5fa" : "rgba(148,163,184,0.65)"}`,
                    color: isDone ? "#34d399" : isCurrent ? "#dbeafe" : "#94a3b8",
                    background: "rgba(15,23,42,0.96)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    boxShadow: isCurrent ? "0 0 0 6px rgba(56,189,248,0.14), 0 0 24px rgba(56,189,248,0.5)" : "none",
                  }}
                >
                  {isDone ? (
                    <motion.span
                      initial={recentlyCompletedId === step.id ? { scale: 1 } : false}
                      animate={recentlyCompletedId === step.id ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      style={{ display: "inline-block" }}
                    >
                      ✓
                    </motion.span>
                  ) : (
                    idx + 1
                  )}
                </motion.div>

                {isCurrent ? (
                  <motion.span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 1,
                      top: "50%",
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      border: "1px solid rgba(125,211,252,0.7)",
                      transform: "translateY(-50%)",
                    }}
                    animate={{ scale: [0.9, 1.25], opacity: [0.9, 0] }}
                    transition={{ duration: 1.45, ease: "easeOut", repeat: Infinity }}
                  />
                ) : null}
                {recentlyCompletedId === step.id ? (
                  <motion.span
                    aria-hidden
                    initial={{ scale: 0.4, opacity: 0.7 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: "1px solid rgba(52,211,153,0.75)",
                      transform: "translateY(-50%)",
                    }}
                  />
                ) : null}

                <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 3 }}>{step.label}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  {isDone
                    ? tr
                      ? "Tamamlandı"
                      : "Completed"
                    : isCurrent
                      ? tr
                        ? "Şu anki adım"
                        : "Current step"
                      : tr
                        ? "Milestone"
                        : "Milestone"}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <motion.button
        type="button"
        onClick={() => {
          if (!completed[activeStep.id]) {
            triggerCompletionFeedback(activeStep);
          }
          onToggleStep(activeStep.id);
        }}
        style={{
          marginTop: 14,
          width: "100%",
          border: "none",
          borderRadius: 12,
          padding: "12px 14px",
          fontSize: 13,
          fontWeight: 700,
          color: "#0f172a",
          background: completed[activeStep.id]
            ? "linear-gradient(135deg, #34d399, #22c55e)"
            : "linear-gradient(135deg, #38bdf8, #6366f1 55%, #a855f7)",
          boxShadow: buttonBoost ? "0 0 26px rgba(99,102,241,0.72)" : "0 8px 20px rgba(59,130,246,0.32)",
          cursor: "pointer",
        }}
        whileTap={{ scale: 0.97 }}
      >
        {completed[activeStep.id]
          ? tr
            ? "Tamamlandı olarak işaretli (geri al)"
            : "Marked as completed (undo)"
          : tr
            ? "Bu adımı tamamlandı olarak işaretle"
            : "Mark this step as completed"}
      </motion.button>

      {isExecutionPhase ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{
            marginTop: 10,
            borderRadius: 12,
            border: "1px solid rgba(99,102,241,0.35)",
            background: "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(99,102,241,0.14))",
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#c7d2fe", fontWeight: 800 }}>
            {tr ? "Execution phase" : "Execution phase"}
          </div>
          <div style={{ fontSize: 12, color: "#e2e8f0", marginTop: 4 }}>
            {tr ? "Dönüşümün olduğu yer burası." : "This is where conversion happens."}
          </div>
          <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 7, lineHeight: 1.6 }}>
            <div>• {tr ? "Sinyal uyumun olan rollere başvur" : "Apply only where you have signal fit"}</div>
            <div>• {tr ? "Kalite > adet" : "Quality > quantity"}</div>
            <div>• {tr ? "Her başvuru bilinçli olmalı" : "Each application should feel intentional"}</div>
          </div>
        </motion.div>
      ) : null}

      <AnimatePresence>
        {rewardToast ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
              position: "absolute",
              right: 18,
              bottom: 84,
              zIndex: 5,
              minWidth: 230,
              borderRadius: 12,
              border: "1px solid rgba(56,189,248,0.45)",
              background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(99,102,241,0.2))",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              padding: "10px 12px",
              boxShadow: "0 0 18px rgba(56,189,248,0.3)",
            }}
          >
            <div style={{ color: "#bfdbfe", fontSize: 14, fontWeight: 800 }}>
              +{rewardToast.points} {tr ? "Fit Skoru" : "Fit Score"} ↑
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 12, marginTop: 3 }}>{rewardToast.text}</div>
            <div style={{ color: "#a5f3fc", fontSize: 11, marginTop: 5 }}>{rewardToast.done}</div>
            <div style={{ color: "#93c5fd", fontSize: 11 }}>{rewardToast.momentum}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function PersonalizedRoadmapPage({ navigate, lang, t, isPro, openUpgrade, analysisData, engineV2, cvText, jdText, alignmentScore }) {
  const roleRows = useMemo(
    () => detectRoleCandidates({ engineV2, analysisData, cvText, lang }),
    [engineV2, analysisData, cvText, lang],
  );
  const topRole = roleRows[0]?.role || "";
  const biggestGap = toText(engineV2?.Gaps?.biggest_gap) || toText(analysisData?.rejection_reasons?.high?.[0]);
  const missingSkills = useMemo(
    () => (engineV2?.ATS?.missing_keywords || analysisData?.missing_skills || []).map((x) => toText(x)).filter(Boolean),
    [engineV2, analysisData],
  );
  const project = useMemo(
    () => buildProjectIdea({ topRole, biggestGap, missingSkills, lang }),
    [topRole, biggestGap, missingSkills, lang],
  );
  const phases = useMemo(
    () => roadmapPhases({ topRole, biggestGap, missingSkills, lang }),
    [topRole, biggestGap, missingSkills, lang],
  );
  const path = useMemo(() => bestPathForRole(topRole, lang), [topRole, lang]);
  const baseScore = Number.isFinite(Number(alignmentScore)) ? Number(alignmentScore) : Number(analysisData?.alignment_score || 45);
  const projected = clamp(Math.round(baseScore + 22), 0, 92);
  const tr = lang === "TR";
  const navSteps = useMemo(
    () => [
      {
        id: "fix-cv",
        label: "Fix CV",
        actions: phases.p1.slice(0, 3),
        timeRequired: tr ? "1-2 saat" : "1-2 hours",
        expectedImpact: tr ? "+8-12 fit puanı" : "+8-12 fit points",
        rewardPoints: 12,
      },
      {
        id: "build-project",
        label: "Build Project",
        actions: [project.title, project.context, ...phases.p2.slice(0, 2)],
        timeRequired: tr ? "1-2 hafta" : "1-2 weeks",
        expectedImpact: tr ? "+10-14 fit puanı" : "+10-14 fit points",
        rewardPoints: 14,
      },
      {
        id: "apply",
        label: "Apply",
        actions: phases.p3.slice(0, 3),
        timeRequired: tr ? "sürekli (haftalık sprint)" : "ongoing (weekly sprint)",
        expectedImpact: tr ? "Daha yüksek mülakat oranı" : "Higher interview rate",
        rewardPoints: 10,
      },
    ],
    [phases, project, tr],
  );
  const progressStorageKey = useMemo(
    () => `hirefit-career-nav-map-v1:${toText(topRole).toLowerCase() || "default"}:${lang}`,
    [topRole, lang],
  );
  const [completedSteps, setCompletedSteps] = useState(() => ({}));
  const [selectedStepId, setSelectedStepId] = useState("fix-cv");
  const detailsRef = useRef(null);
  const [isDesktop, setIsDesktop] = useState(() => (typeof window === "undefined" ? true : window.innerWidth >= 1024));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(progressStorageKey);
      if (!raw) {
        setCompletedSteps({});
        return;
      }
      const parsed = JSON.parse(raw);
      setCompletedSteps(typeof parsed === "object" && parsed ? parsed : {});
    } catch {
      setCompletedSteps({});
    }
  }, [progressStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(progressStorageKey, JSON.stringify(completedSteps));
    } catch {
      // ignore localStorage failures
    }
  }, [completedSteps, progressStorageKey]);

  const currentStepIndex = useMemo(() => {
    const i = navSteps.findIndex((s) => !completedSteps[s.id]);
    return i === -1 ? navSteps.length - 1 : i;
  }, [navSteps, completedSteps]);

  useEffect(() => {
    if (!navSteps.some((s) => s.id === selectedStepId)) {
      setSelectedStepId(navSteps[0]?.id || "fix-cv");
    }
  }, [navSteps, selectedStepId]);

  const handleSelectStep = (id) => {
    setSelectedStepId(id);
  };

  const handleToggleStep = (id) => {
    setCompletedSteps((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const nextCurrentIndex = navSteps.findIndex((s) => !next[s.id]);
      if (nextCurrentIndex >= 0) {
        setSelectedStepId(navSteps[nextCurrentIndex].id);
      }
      return next;
    });
    detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleReanalyzeAnotherRole = () => {
    navigate("/app");
  };

  const selectedStep = useMemo(
    () => navSteps.find((s) => s.id === selectedStepId) || navSteps[0],
    [navSteps, selectedStepId],
  );

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "40px 24px 48px" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate("/app")} style={{ marginBottom: 14, background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
          {lang === "TR" ? "← Analize dön" : "← Back to analysis"}
        </button>
        <h1 style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px,4vw,38px)", color: "#f8fafc", letterSpacing: "-0.02em" }}>
          {t.bestPathForward}
        </h1>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "minmax(0, 0.42fr) minmax(0, 0.58fr)" : "1fr",
          gap: isDesktop ? 32 : 20,
          alignItems: "start",
        }}
      >
        <div ref={detailsRef} style={{ minWidth: 0 }}>
          <div
            style={{
              ...blockStyle(),
              border: "1px solid rgba(129,140,248,0.32)",
              background: "linear-gradient(165deg, rgba(99,102,241,0.14), rgba(15,23,42,0.58))",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              padding: "22px",
            }}
          >
            <div style={{ fontSize: 11, color: "#a5b4fc", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              {t.bestPathForward}
            </div>
            <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 10 }}>
              {lang === "TR"
                ? "Sol panel içgörüleri, sağdaki rota düğümlerine göre canlı güncellenir."
                : "This insight panel updates live based on the route nodes on the right."}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedStep.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: "easeInOut" }}
              >
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, color: "#f8fafc", fontWeight: 800, marginBottom: 8 }}>
                  {selectedStep.label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,6,23,0.35)", padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                      {tr ? "Süre" : "Time"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{selectedStep.timeRequired}</div>
                  </div>
                  <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,6,23,0.35)", padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                      {tr ? "Beklenen etki" : "Expected impact"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#6ee7b7" }}>{selectedStep.expectedImpact}</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {tr ? "Ne yapmalı?" : "What to do"}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {selectedStep.actions.map((line, i) => (
                    <div
                      key={`${selectedStep.id}-act-${i}`}
                      style={{
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.07)",
                        background: "rgba(255,255,255,0.02)",
                        padding: "9px 10px",
                        fontSize: 13,
                        color: "#cbd5e1",
                        lineHeight: 1.55,
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div style={blockStyle()}>
            <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              {lang === "TR" ? "Rol yönlendirmesi" : "Role redirection"}
            </div>
            <div style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 10 }}>
              {lang === "TR"
                ? "Bu rol için güçlü bir eşleşme görünmüyor. Profiline göre daha güçlü olduğun roller:"
                : "You are not a strong fit for this role. Based on your profile, you are a stronger fit for:"}
            </div>
            {roleRows.map((r, i) => (
              <div key={`${r.role}-${i}`} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 8, background: "rgba(15,23,42,0.45)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{r.role} ({Math.round(r.score)}%)</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{r.why || (lang === "TR" ? "Mevcut CV sinyalin bu role daha yakın." : "Your current CV signal aligns better with this role.")}</div>
              </div>
            ))}
          </div>

          <div style={blockStyle()}>
            <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              {lang === "TR" ? "Kariyer yolu" : "Career path"}
            </div>
            <div style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 6 }}>
              {lang === "TR" ? "Senin için en iyi yol:" : "Best path for you:"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#a5b4fc", marginBottom: 8 }}>{path}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {lang === "TR"
                ? "Bu yol, mevcut güçlü yanlarını büyütürken kritik boşlukları kapatır."
                : "This path builds on your strengths while closing your critical gaps."}
            </div>
          </div>

          {isPro ? (
            <div style={blockStyle()}>
              <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                {t.bestProjectToFix}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", marginBottom: 10 }}>{project.title}</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 6 }}>{project.context}</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 6 }}>{project.dataSource}</div>
              <div style={{ fontSize: 13, color: "#a7f3d0" }}>{project.outcome}</div>
            </div>
          ) : (
            <div style={blockStyle()}>
              <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                {t.bestProjectToFix}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>{project.title}</div>
              <LockedHint lang={lang} onUpgrade={openUpgrade} />
            </div>
          )}

          {isPro ? (
            <div style={blockStyle()}>
              <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                {lang === "TR" ? "Beklenen dönüşüm" : "Expected transformation"}
              </div>
              <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 6 }}>
                {lang === "TR" ? "Bu yolu uygularsan:" : "If you follow this path:"}
              </div>
              <div style={{ fontSize: 13, color: "#a7f3d0", marginBottom: 4 }}>→ {lang === "TR" ? `Fit skoru: ${Math.round(baseScore)} → ${projected}+` : `Fit score: ${Math.round(baseScore)} → ${projected}+`}</div>
              <div style={{ fontSize: 13, color: "#a7f3d0" }}>→ {lang === "TR" ? "Mülakat olasılığı belirgin şekilde artar." : "Interview probability increases significantly."}</div>
            </div>
          ) : null}
        </div>

        <div style={{ minWidth: 0 }}>
          <CareerNavigationMap
            lang={lang}
            steps={navSteps}
            completed={completedSteps}
            selectedStepId={selectedStepId}
            currentStepIndex={currentStepIndex}
            onSelectStep={handleSelectStep}
            onToggleStep={handleToggleStep}
            pathLabel={path}
            onReanalyzeAnotherRole={handleReanalyzeAnotherRole}
            compact={!isDesktop}
          />
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 10, padding: "0 6px" }}>
            {tr
              ? "Düğüm seç: içgörü paneli güncellensin. Adımı tamamla: gösterge bir sonraki düğüme aksın."
              : "Select a node to refresh insight. Complete step to move the indicator to the next milestone."}
          </div>
        </div>
      </div>
    </div>
  );
}

