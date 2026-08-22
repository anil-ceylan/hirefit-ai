import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import { buildOnboardingSummaryRows } from "../../../lib/careerOnboarding/careerSnapshot.js";
import { uploadOnboardingCv } from "../../utils/careerOnboardingClient.js";
import { extractCvTextFromFile } from "../../utils/extractCvText.js";
import {
  mergeFirstAnalysisIntoProfile,
  persistFirstAnalysisRemote,
  runFirstCareerAnalysis,
} from "../../utils/firstCareerAnalysis.js";
import { saveLocalCareerProfile } from "../../utils/careerMemoryClient.js";
import { trackActivationEvent } from "../../utils/activationEvents.js";
import { upsertRecommendedCareerAction } from "../../utils/careerActionLoopClient.js";
import {
  getWeekKey,
  userKey,
  weeklyActionId,
} from "../../utils/weeklyActionIdentity.js";
import { CareerSnapshotWow } from "../career-os/CareerSnapshotWow.jsx";
import { CareerProfileCompletion } from "../career-os/CareerProfileCompletion.jsx";
import {
  classifyAnalysisSources,
  getAnalysisSourceLabel,
} from "../../../lib/careerOnboarding/careerSignalSchema.js";

function SummaryRow({ label, value, chips }) {
  return (
    <div className="hf-first-analysis__row">
      <div className="hf-first-analysis__row-label">{label}</div>
      {chips?.length ? (
        <div className="hf-first-analysis__chips">
          {chips.map((c) => (
            <span key={c} className="hf-first-analysis__chip">
              {c}
            </span>
          ))}
        </div>
      ) : (
        <div className="hf-first-analysis__row-value">{value}</div>
      )}
    </div>
  );
}

function BulletList({ items, variant = "gap" }) {
  if (!items?.length) return null;
  return (
    <ul className={`hf-first-analysis__list hf-first-analysis__list--${variant}`}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function SnapshotRoleMatch({ role }) {
  if (!role) return null;
  const strongSignals = Array.isArray(role.strongSignals) ? role.strongSignals.slice(0, 3) : [];
  const missingSignals = Array.isArray(role.missingSignals) ? role.missingSignals.slice(0, 3) : [];
  return (
    <div className="hf-first-analysis__role-match">
      <div className="hf-first-analysis__role-match-head">
        <div>
          {role.recommendationType ? <small>{role.recommendationType}</small> : null}
          <strong>{role.roleName || role.name}</strong>
        </div>
        {role.fitPercentage != null ? <span>{Math.round(role.fitPercentage)}%</span> : null}
      </div>
      <div className="hf-first-analysis__role-match-meta">
        {role.confidence ? <span>Confidence: {role.confidence}</span> : null}
        {role.distanceToRole != null ? <span>Distance: {Math.round(role.distanceToRole)} pts</span> : null}
      </div>
      {role.whyItFits ? (
        <p>
          <b>Why:</b> {role.whyItFits}
        </p>
      ) : null}
      {strongSignals.length ? (
        <p>
          <b>Strong:</b> {strongSignals.join(" · ")}
        </p>
      ) : null}
      {missingSignals.length ? (
        <p>
          <b>Missing:</b> {missingSignals.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function ScoreBreakdown({ breakdown, tr }) {
  const rows = breakdown?.rows || [];
  if (!rows.length) return null;
  return (
    <div className="hf-first-analysis__score-breakdown">
      <div className="hf-first-analysis__row-label">{tr ? "Kariyer Potansiyeli Dağılımı" : "Career Potential Breakdown"}</div>
      {rows.map((row) => (
        <div key={row.key || row.label} className="hf-first-analysis__score-row">
          <div>
            <span>{row.label}</span>
            <div className="hf-first-analysis__score-track" aria-hidden>
              <i style={{ width: `${Math.min(100, Math.round((Number(row.points || 0) / Math.max(1, Number(row.max || 20))) * 100))}%` }} />
            </div>
          </div>
          <strong>{Math.round(row.points)}/{row.max || 20}</strong>
        </div>
      ))}
      <div className="hf-first-analysis__score-row hf-first-analysis__score-row--total">
        <span>Total</span>
        <strong>{Math.round(breakdown.total)}/{breakdown.max || 100}</strong>
      </div>
    </div>
  );
}

function isFounderDirection(value) {
  return /founder|kurucu|co[-\s]?founder|girişimci|girisimci/i.test(String(value || ""));
}

function compact(value, max = 130) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function snapshotFromProfile(profile = {}) {
  return profile?.career_snapshot || profile?.career_gps?.snapshot || {};
}

function buildSnapshotWeeklyActionPayload(profile, user, lang = "TR") {
  const tr = lang === "TR";
  const snapshot = snapshotFromProfile(profile);
  const gapTitle =
    snapshot.gapDetails?.title ||
    snapshot.biggestGap?.title ||
    snapshot.biggestGap ||
    profile?.weak_signals?.[0] ||
    (tr ? "Eksik kanıt netleşmeli" : "Missing proof needs clarity");
  const action = compact(
    snapshot.suggestedNextMove ||
      snapshot.recommendedNextMove ||
      snapshot.gapDetails?.action ||
      profile?.recommended_next_move ||
      (tr ? `${gapTitle} için tek somut örnek yaz.` : `Write one concrete example for ${gapTitle}.`),
    105
  );
  const weekKey = getWeekKey();
  const actionId = weeklyActionId(user, action, weekKey);
  return {
    action_id: actionId,
    decision_id: actionId,
    week_key: weekKey,
    action_type: "weekly_career_move",
    title: action,
    reason: compact(snapshot.gapDetails?.whyItMatters || snapshot.biggestGap?.whyItMatters || snapshot.biggestGapExplanation, 160),
    blocker: compact(gapTitle, 80),
    target_dimension: action,
    expected_evidence: action,
    source: "weekly_decision_center",
    production_snapshot_ref: {
      week_key: weekKey,
      user_key: userKey(user),
    },
    confidence: "",
  };
}

function nearestRoleFromSnapshot(snapshot) {
  const role = snapshot?.primaryRoleMatch || snapshot?.topRoleMatches?.[0] || snapshot?.roleMatches?.[0];
  const name = role?.roleName || role?.name || "";
  if (!name || isFounderDirection(name)) return "Strategy & Operations Intern";
  return name;
}

function FastestPathCard({ path, snapshot, tr }) {
  if (!path) return null;
  const targetIsFounder = isFounderDirection(path.targetRole);
  const rows = [
    [tr ? "En Uygun Kısa Vadeli Rol" : "Best Near-Term Role", targetIsFounder ? nearestRoleFromSnapshot(snapshot) : path.targetRole],
    ...(targetIsFounder ? [[tr ? "Uzun Vadeli Yön" : "Long-Term Direction", path.targetRole]] : []),
    [tr ? "Güçlü Yanlar" : "Strengths", path.strengths],
    [tr ? "Eksikler" : "Gaps", path.gaps],
    [tr ? "Sonraki Hamle" : "Next Move", path.nextMove],
  ].filter(([, value]) => value);
  return (
    <div className="hf-first-analysis__fastest-path">
      <div className="hf-first-analysis__row-label">Fastest Path</div>
      {rows.map(([label, value]) => (
        <div key={label} className="hf-first-analysis__path-row">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function Next30Days({ actions, tr }) {
  if (!actions?.length) return null;
  return (
    <div className="hf-first-analysis__next-30">
      <div className="hf-first-analysis__row-label">{tr ? "Önündeki 30 Gün" : "Next 30 Days"}</div>
      <div className="hf-first-analysis__milestones">
        {actions.slice(0, 4).map((action, idx) => (
          <article key={action} className="hf-first-analysis__milestone">
            <span className="hf-first-analysis__milestone-icon" aria-hidden>{idx + 1}</span>
            <div>
              <small>{tr ? `Hafta ${idx + 1}` : `Week ${idx + 1}`}</small>
              <strong>{action}</strong>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AnalysisSources({ sources, signalCount, lang }) {
  const uniqueSources = [...new Set(sources || [])];
  if (!uniqueSources.length) return null;
  const tr = lang === "TR";
  const sourceLabel = (source) => {
    if (source === "cv") {
      if (Number(signalCount || 0) > 0) return tr ? "CV — Analiz edildi" : "CV — Analyzed";
      return tr ? "CV — Yüklendi, analiz bekliyor" : "CV — Uploaded, analysis pending";
    }
    return getAnalysisSourceLabel(source, lang);
  };
  const groups = classifyAnalysisSources(uniqueSources, { cvSignalCount: signalCount });
  const sections = [
    {
      id: "verifiable",
      title: tr ? "Doğrulanabilir Kanıtlar" : "Verifiable Evidence",
      items: groups.verifiable,
    },
    {
      id: "selfReported",
      title: tr ? "Kullanıcı Beyanı" : "Self Reported",
      items: groups.selfReported,
    },
  ].filter((section) => section.items.length);
  return (
    <section className="hf-analysis-sources">
      <div className="hf-first-analysis__row-label">
        {tr ? "Analiz Kaynakları" : "Analysis Sources"}
      </div>
      <p>
        {tr
          ? "Doğrulanabilir kanıtlar ile kendi bildirdiğin sinyalleri ayrı gösteriyoruz."
          : "We separate verifiable evidence from self-reported signals."}
      </p>
      <div className="hf-analysis-sources__groups">
        {sections.map((section) => (
          <div key={section.id} className="hf-analysis-sources__group">
            <strong>{section.title}</strong>
            {section.note ? <small>{section.note}</small> : null}
            <div className="hf-analysis-sources__list">
              {section.items.map((source) => (
                <span key={source} className={section.id === "verifiable" ? "is-verified" : "is-statement"}>
                  <CheckCircle2 size={14} />
                  {sourceLabel(source)}
                  {source === "cv" && signalCount > 0 ? <small>{signalCount} signal</small> : null}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HireFitNoticed({ intro, paragraphs, lang, snapshot }) {
  const tr = lang === "TR";
  const snap = snapshot || {};
  const legacyParagraphs = intro?.paragraphs || paragraphs || [];
  const primaryMatch = snap.primaryRoleMatch || snap.topRoleMatches?.[0] || snap.roleMatches?.[0];
  const gapDetails = snap.gapDetails || {};
  const strongestSignal = snap.strongestSignal || primaryMatch?.strongSignals?.[0] || "";

  const blocks = [
    {
      id: "signal",
      label: tr ? "En güçlü sinyal" : "Strongest signal",
      text:
        legacyParagraphs[0] ||
        (strongestSignal
          ? strongestSignal
          : primaryMatch?.strongSignals?.length
            ? primaryMatch.strongSignals.slice(0, 2).join(" · ")
            : ""),
      tone: "signal",
    },
    {
      id: "opportunity",
      label: tr ? "En büyük fırsat" : "Biggest opportunity",
      text:
        legacyParagraphs[2] ||
        (gapDetails.title
          ? `${gapDetails.title}${gapDetails.whyItMatters ? `. ${gapDetails.whyItMatters}` : ""}`
          : snap.biggestGap || ""),
      tone: "opportunity",
    },
    {
      id: "recruiter",
      label: tr ? "Recruiter'ın ilk izlenimi" : "Recruiter's first impression",
      text:
        legacyParagraphs[1] ||
        (primaryMatch?.roleName && primaryMatch?.strongSignals?.length
          ? tr
            ? `${primaryMatch.roleName} yönünde ${primaryMatch.strongSignals.slice(0, 2).join(" ve ")} kanıtları recruiter'ın ilk okumasında öne çıkar.`
            : `Toward ${primaryMatch.roleName}, proof in ${primaryMatch.strongSignals.slice(0, 2).join(" and ")} should stand out in a recruiter's first read.`
          : ""),
      tone: "recruiter",
    },
  ].filter((block) => block.text?.trim());

  if (!blocks.length) return null;

  return (
    <section className="hf-snapshot-insights" aria-label={intro?.title || (tr ? "HireFit'in fark ettiği" : "What HireFit noticed")}>
      <div className="hf-snapshot-insights__head">
        <Sparkles size={16} />
        <strong>{intro?.title || (tr ? "HireFit'in fark ettiği" : "What HireFit noticed")}</strong>
      </div>
      <div className="hf-snapshot-insights__grid">
        {blocks.map((block) => (
          <article key={block.id} className={`hf-snapshot-insights__block hf-snapshot-insights__block--${block.tone}`}>
            <span className="hf-snapshot-insights__label">{block.label}</span>
            <p>{block.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function FirstCareerAnalysisFlow({
  profile,
  user = null,
  lang = "TR",
  navigate,
  getApiAuthHeaders,
  initialCvFile = null,
  onProfileUpdate,
}) {
  const tr = lang === "TR";
  const inputId = useId();
  const fileRef = useRef(null);
  const snapshotEventRef = useRef(false);
  const [phase, setPhase] = useState("snapshot");
  const [snapshot, setSnapshot] = useState(profile?.career_snapshot || null);
  const [cvMatch, setCvMatch] = useState(profile?.first_analysis?.cvMatch || null);
  const [, setTeaser] = useState(profile?.first_analysis?.teaser || null);
  const [flowError, setFlowError] = useState("");
  const [weeklyMoveBusy, setWeeklyMoveBusy] = useState(false);

  const summaryRows = buildOnboardingSummaryRows(profile, lang);
  const snapshotForEvent = snapshot || profile?.career_snapshot || null;

  useEffect(() => {
    if (!snapshotForEvent || snapshotEventRef.current) return;
    snapshotEventRef.current = true;
    trackActivationEvent("career_snapshot_generated", {
      source: "career_dna",
      lang,
      profileComplete: Boolean(profile?.onboarding_completed),
    });
  }, [snapshotForEvent, lang, profile?.onboarding_completed]);

  const persist = useCallback(
    async (result) => {
      let merged = mergeFirstAnalysisIntoProfile(profile, result);
      saveLocalCareerProfile(merged);
      const remote = await persistFirstAnalysisRemote(getApiAuthHeaders, merged);
      if (remote) merged = remote;
      saveLocalCareerProfile(merged);
      onProfileUpdate?.(merged);
      setSnapshot(result.snapshot);
      setCvMatch(result.cvMatch);
      setTeaser(result.teaser);
      return merged;
    },
    [profile, onProfileUpdate, getApiAuthHeaders]
  );

  const runAnalysis = useCallback(
    async (file) => {
      setFlowError("");
      setPhase("analyzing");

      if (file) {
        await uploadOnboardingCv(null, getApiAuthHeaders, file);
      }

      const { text, error: extractErr } = file
        ? await extractCvTextFromFile(file)
        : { text: "", error: null };

      if (file && extractErr && !text) {
        const msg = tr
          ? "CV metni okunamadı. PDF deneyebilir veya şimdilik DNA özetiyle devam edebilirsin."
          : "Could not read CV text. Try PDF or continue with your DNA snapshot.";
        setFlowError(msg);
        const result = await runFirstCareerAnalysis({
          cvText: "",
          profile,
          lang,
          getApiAuthHeaders,
        });
        await persist(result);
        setPhase("snapshot");
        return;
      }

      try {
        const result = await runFirstCareerAnalysis({
          cvText: text,
          profile,
          lang,
          getApiAuthHeaders,
        });
        await persist(result);
        setPhase("snapshot");
      } catch {
        setFlowError(
          tr
            ? "Analiz tamamlanamadı — Career Snapshot hazır."
            : "Analysis could not finish — your Career Snapshot is ready."
        );
        const result = await runFirstCareerAnalysis({
          cvText: text || "",
          profile,
          lang,
          getApiAuthHeaders,
        });
        await persist(result);
        setPhase("snapshot");
      }
    },
    [getApiAuthHeaders, lang, persist, profile, tr]
  );

  const onChooseCv = () => {
    if (initialCvFile) {
      runAnalysis(initialCvFile);
      return;
    }
    fileRef.current?.click();
  };

  const onFilePicked = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) runAnalysis(file);
  };

  const onSkip = async () => {
    setFlowError("");
    setPhase("analyzing");
    const result = await runFirstCareerAnalysis({
      cvText: "",
      profile,
      lang,
      getApiAuthHeaders,
    });
    await persist(result);
    setPhase("snapshot");
  };

  const openWeeklyMove = async () => {
    if (weeklyMoveBusy) return;
    setWeeklyMoveBusy(true);
    try {
      if (profile?.onboarding_completed && getApiAuthHeaders) {
        await upsertRecommendedCareerAction({
          getHeaders: getApiAuthHeaders,
          action: buildSnapshotWeeklyActionPayload(profile, user, lang),
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[weekly-action:handoff]", error?.message || error);
      }
    } finally {
      setWeeklyMoveBusy(false);
      navigate("/dashboard");
    }
  };

  if (phase === "analyzing") {
    return (
      <motion.div
        key="analyzing"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="hf-first-analysis hf-first-analysis--loading"
      >
        <div className="hf-first-analysis__loader-ring">
          <Loader2 size={36} className="hf-spin" color="#60a5fa" />
        </div>
        <h2 className="hf-first-analysis__title">
          {tr ? "İlk kariyer analizini oluşturuyoruz..." : "Building your first career analysis..."}
        </h2>
        <p className="hf-first-analysis__subtitle">
          {tr
            ? "Career DNA verilerin ve hedef rolün birleştiriliyor."
            : "Combining your Career DNA and target role."}
        </p>
        <div className="hf-first-analysis__progress-bar">
          <div className="hf-first-analysis__progress-fill" />
        </div>
      </motion.div>
    );
  }

  if (phase === "success") {
    return (
      <motion.div
        key="success"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="hf-first-analysis"
      >
        <div className="hf-first-analysis__success-icon">
          <CheckCircle2 size={48} strokeWidth={1.75} />
        </div>
        <h2 className="hf-first-analysis__title">
          Career Snapshot
        </h2>
        <p className="hf-first-analysis__subtitle">
          {tr
            ? "İlk kariyer yönünü ve hazır olduğun noktayı hemen gör."
            : "See your first career direction and readiness point immediately."}
        </p>

        <div className="hf-first-analysis__card">
          <SummaryRow
            label={tr ? "Hedef sektörler" : "Target sectors"}
            chips={summaryRows.targetIndustries}
          />
          <SummaryRow
            label={tr ? "Hedef roller" : "Target roles"}
            chips={summaryRows.targetRoles}
          />
          <SummaryRow
            label={tr ? "Deneyim seviyesi" : "Experience level"}
            value={summaryRows.experienceLevel}
          />
          <SummaryRow
            label={tr ? "Deneyim sinyalleri" : "Experience signals"}
            chips={summaryRows.experienceSignals}
          />
          <SummaryRow
            label={tr ? "Liderlik sinyalleri" : "Leadership signals"}
            chips={summaryRows.leadershipSignals}
          />
          <SummaryRow
            label={tr ? "Çalışma tercihleri" : "Work preferences"}
            value={summaryRows.workPreferences}
          />
        </div>

        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: "none" }}
          onChange={onFilePicked}
        />

        <div className="hf-first-analysis__actions">
          <button type="button" className="hf-btn-primary hf-first-analysis__cta" onClick={onChooseCv}>
            <Upload size={16} />
            {tr ? "CV Yükle ve İlk Analizi Al" : "Upload CV & Get First Analysis"}
          </button>
          <button type="button" className="hf-first-analysis__ghost-btn" onClick={onSkip}>
            {tr ? "Şimdilik Geç" : "Skip for now"}
          </button>
        </div>
      </motion.div>
    );
  }

  const snap = snapshotForEvent;
  const fastestPath = snap?.fastestPath || null;
  const analysisSources =
    snap?.analysisSources ||
    profile?.analysis_sources ||
    profile?.basic_profile?.analysisSources ||
    [];
  const cvSignalCount = Number(
    profile?.basic_profile?.cvSignalCount ||
    profile?.first_analysis?.cvSignalCount ||
    0
  );

  return (
    <motion.div
      key="snapshot"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="hf-first-analysis"
    >
      {flowError ? (
        <div className="hf-info-banner" style={{ marginBottom: 14 }}>
          {flowError}
        </div>
      ) : null}

      <div className="hf-first-analysis__section-head">
        <Sparkles size={18} color="#60a5fa" />
        <h2 className="hf-first-analysis__title hf-first-analysis__title--sm">
          Career Snapshot
        </h2>
      </div>

      <div className="hf-first-analysis__card hf-first-analysis__card--snapshot">
        <CareerSnapshotWow
          snapshot={snap}
          lang={lang}
          localCvPending={Boolean(profile?.basic_profile?.cvUploaded || profile?.cv?.cvUploaded) && cvSignalCount <= 0}
        />
      </div>

      <details className="hf-first-analysis__details">
        <summary>
          <span>{tr ? "Analiz detayları" : "Analysis details"}</span>
          <small>{tr ? "Kanıtlar, kaynaklar ve hesaplama dökümü" : "Evidence, sources, and score breakdown"}</small>
        </summary>
        <div className="hf-first-analysis__details-body">
          <HireFitNoticed intro={snap?.whatHireFitNoticed} paragraphs={snap?.hireFitNoticed} snapshot={snap} lang={lang} />

          <ScoreBreakdown breakdown={snap?.scoreBreakdown} tr={tr} />

          <FastestPathCard path={fastestPath} snapshot={snap} tr={tr} />
          <Next30Days actions={snap?.next30Days} tr={tr} />

          <CareerProfileCompletion profile={profile} lang={lang} className="hf-first-analysis__card" />

          <AnalysisSources sources={analysisSources} signalCount={cvSignalCount} lang={lang} />

          {cvMatch ? (
            <div className="hf-first-analysis__card hf-first-analysis__card--match">
              <div className="hf-first-analysis__section-head">
                <Target size={16} color="#34d399" />
                <h3 className="hf-first-analysis__card-title">
                  {tr ? "Career DNA → CV Eşleşmesi" : "Career DNA → CV Match"}
                </h3>
              </div>
              <div className="hf-first-analysis__match-row">
                <span>{tr ? "Hedef Rol" : "Target role"}</span>
                <strong>{cvMatch.targetRole}</strong>
              </div>
              <div className="hf-first-analysis__match-row">
                <span>{tr ? "CV Uyum Skoru" : "CV fit score"}</span>
                <strong className="hf-first-analysis__score-pill">{cvMatch.compatibilityScore}%</strong>
              </div>
              <div className="hf-first-analysis__match-block">
                <div className="hf-first-analysis__row-label">
                  {tr ? "Eksik Noktalar" : "Gaps"}
                </div>
                <BulletList items={cvMatch.gaps} variant="gap" />
              </div>
              <div className="hf-first-analysis__match-block">
                <div className="hf-first-analysis__row-label">
                  {tr ? "En güçlü alanlar" : "Strongest areas"}
                </div>
                <BulletList items={cvMatch.strengths} variant="strength" />
              </div>
            </div>
          ) : null}
        </div>
      </details>

      <section className="hf-first-analysis__ready hf-first-analysis__card">
        <div className="hf-first-analysis__ready-head">
          <CheckCircle2 size={18} color="#34d399" />
          <strong>{tr ? "Career DNA Hazır" : "Career DNA Ready"}</strong>
        </div>
        <p className="hf-first-analysis__ready-copy">
          {tr
            ? "İlk kariyer kararını haftalık aksiyona dönüştür. CV’ni analiz ederek Snapshot varsayımlarını daha sonra doğrulayabilirsin."
            : "Turn your first career decision into a weekly action. You can validate the Snapshot assumptions with your CV next."}
        </p>
        <div className="hf-first-analysis__ready-badges">
          {(tr ? ["ATS İncelemesi", "Recruiter İncelemesi", "Eksik Analizi", "Başvuru Düzeltmesi"] : ["ATS Review", "Recruiter Review", "Gap Analysis", "Apply Fix"]).map((badge) => (
            <span key={badge} className="hf-first-analysis__ready-badge">
              {badge}
            </span>
          ))}
        </div>
      </section>

      <div className="hf-first-analysis__footer-actions">
        <button type="button" className="hf-btn-primary" onClick={openWeeklyMove} disabled={weeklyMoveBusy}>
          {weeklyMoveBusy ? (tr ? "Hamle hazırlanıyor..." : "Preparing move...") : (tr ? "Haftalık Hamlemi Gör" : "See My Weekly Move")}
          {weeklyMoveBusy ? <Loader2 size={14} className="hf-spin" /> : <ArrowRight size={14} />}
        </button>
        <button type="button" className="hf-first-analysis__ghost-btn" onClick={() => navigate("/app")}>
          {tr ? "CV ile Doğrula" : "Validate with CV"}
        </button>
      </div>
    </motion.div>
  );
}



