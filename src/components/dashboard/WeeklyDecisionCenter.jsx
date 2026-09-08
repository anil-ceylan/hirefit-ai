import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { loadLocalCareerProgress } from "../../utils/careerProgressClient.js";
import {
  buildDecisionCoherenceReport,
  evaluateEvidenceSet,
  evidenceFromCareerProfile,
  hasActionableEvidenceReport,
  selectPrimaryEvidenceGap,
} from "../../intelligence/evidence/index.js";
import { trackActivationEvent } from "../../utils/activationEvents.js";
import { buildDecisionMirrorViewModel } from "../../utils/decisionMirrorAdapter.js";
import {
  buildDurableWeeklyActionPayload,
  getWeekKey,
  userKey,
  weeklyActionId,
} from "../../utils/weeklyActionIdentity.js";
import {
  completeCareerAction,
  fetchCurrentCareerAction,
  fetchCareerActionOutcome,
  startCareerAction,
  upsertCareerActionOutcome,
  upsertRecommendedCareerAction,
} from "../../utils/careerActionLoopClient.js";
import "./weekly-decision-center.css";

// Device-local completion state for weekly actions.
// This is refresh-safe on this browser, but not a cross-device source of truth.
const COMPLETION_KEY = "hirefit-weekly-action-completions-v1";

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function compact(value, max = 130) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getCompletions() {
  if (typeof localStorage === "undefined") return {};
  return safeJson(localStorage.getItem(COMPLETION_KEY), {});
}

function saveCompletion(record) {
  if (typeof localStorage === "undefined") return;
  const current = getCompletions();
  localStorage.setItem(COMPLETION_KEY, JSON.stringify({ ...current, [record.id]: record }));
}

function findLocalCompletion(record, user) {
  const completions = getCompletions();
  const direct = completions[record.id];
  if (direct) return direct;
  return Object.values(completions).find((item) =>
    item?.week === record.week &&
    item?.action === record.action &&
    (!item.userId || item.userId === userKey(user))
  );
}

function normalizeProfileInput(careerProfile) {
  return careerProfile && typeof careerProfile === "object" ? careerProfile : {};
}

function reliableFirstName(careerProfile = {}, user = {}) {
  const profile = normalizeProfileInput(careerProfile);
  const safeUser = user && typeof user === "object" ? user : {};
  const sources = [
    profile.basic_profile?.fullName,
    profile.basic_profile?.name,
    profile.fullName,
    safeUser.user_metadata?.full_name,
    safeUser.user_metadata?.name,
  ];
  const name = sources.map((value) => String(value || "").trim()).find(Boolean);
  if (!name || /@|example|test|user/i.test(name)) return "";
  return name.split(/\s+/)[0] || "";
}

function actionId(user, action) {
  return weeklyActionId(user, action);
}

function snapshotFromProfile(careerProfile = {}) {
  return careerProfile?.career_snapshot || careerProfile?.career_gps?.snapshot || {};
}

function primaryRoleMatch(snapshot = {}) {
  return snapshot.primaryRoleMatch || snapshot.topRoleMatches?.[0] || snapshot.roleMatches?.[0] || null;
}

function roleNameFromSnapshot(snapshot = {}) {
  const match = primaryRoleMatch(snapshot);
  return match?.roleName || match?.name || snapshot.targetRole || snapshot.bestNearTermRole || "";
}

function roleFitFromSnapshot(snapshot = {}) {
  const match = primaryRoleMatch(snapshot);
  return clampPercent(match?.fitPercentage ?? match?.roleFitScore ?? match?.matchPercentage);
}

function roleReasonFromSnapshot(snapshot = {}, tr) {
  const match = primaryRoleMatch(snapshot);
  return compact(
    match?.whyItFits ||
      match?.reason ||
      match?.recruiterReasoning?.summary ||
      (tr
        ? "Mevcut Career DNA cevapların bu rolü en güçlü kısa vadeli yön olarak gösteriyor."
        : "Your current Career DNA answers make this the strongest near-term direction."),
    150
  );
}

function gapTitle(snapshot = {}, profile = {}, tr) {
  const raw =
    snapshot.gapDetails?.title ||
    snapshot.biggestGap?.title ||
    snapshot.biggestGap ||
    profile.weak_signals?.[0] ||
    "";
  return compact(raw || (tr ? "Eksik kanıt netleşmeli" : "Missing proof needs clarity"), 80);
}

function gapWhy(snapshot = {}, tr) {
  return compact(
    snapshot.gapDetails?.whyItMatters ||
      snapshot.biggestGap?.whyItMatters ||
      snapshot.biggestGapExplanation ||
      (tr
        ? "Recruiter bu kanıtı görmeden kısa liste kararını rahat savunamaz."
        : "Without this proof, a recruiter has a harder time defending the shortlist decision."),
    160
  );
}

function gapAction(snapshot = {}, profile = {}, tr) {
  const raw =
    snapshot.suggestedNextMove ||
    snapshot.recommendedNextMove ||
    snapshot.gapDetails?.action ||
    profile.recommended_next_move ||
    "";
  if (raw) return compact(raw, 105);
  const gap = gapTitle(snapshot, profile, tr);
  return tr ? `${gap} için tek somut örnek yaz.` : `Write one concrete example for ${gap}.`;
}

function qualitativeImpact(snapshot = {}, tr) {
  const supported = Number(snapshot.expectedScoreIncrease);
  if (Number.isFinite(supported) && supported > 0) {
    return tr
      ? `+${Math.round(supported)} hazırlık potansiyeli`
      : `+${Math.round(supported)} readiness potential`;
  }
  return tr ? "Recruiter güvenini güçlendirebilir." : "Can strengthen recruiter trust.";
}

function estimateTime(action, tr) {
  const text = String(action || "").toLowerCase();
  if (/cv|linkedin|özet|summary|headline/.test(text)) return tr ? "25 dakika" : "25 minutes";
  if (/case|vaka|portfolio|proje|project/.test(text)) return tr ? "60 dakika" : "60 minutes";
  if (/ilan|job description|beklenti|research|araştır/.test(text)) return tr ? "40 dakika" : "40 minutes";
  return tr ? "30 dakika" : "30 minutes";
}

function confidenceBand(score, tr) {
  const n = clampPercent(score);
  if (n == null) return tr ? "Sınırlı" : "Limited";
  if (n >= 70) return tr ? "Yüksek" : "High";
  if (n >= 45) return tr ? "Orta" : "Medium";
  return tr ? "Düşük" : "Low";
}

function confidenceWhy({ score, evidenceCount, strongestEvidence, roleFit }, tr) {
  const n = clampPercent(score);
  if (n == null) {
    return tr
      ? "Karar, şu an sınırlı profil verisiyle oluşturuldu."
      : "This decision is based on limited profile data right now.";
  }
  if (n >= 70) {
    return tr
      ? `${strongestEvidence || "Mevcut kanıt"} bu kararı destekliyor; ${evidenceCount} sinyal aynı yöne işaret ediyor.`
      : `${strongestEvidence || "Current proof"} supports this decision; ${evidenceCount} signals point in the same direction.`;
  }
  if (n >= 45) {
    return tr
      ? "Yön mantıklı görünüyor, ancak recruiter için kanıt hâlâ tamamlanmış değil."
      : "The direction makes sense, but the proof is not fully recruiter-ready yet.";
  }
  return tr
    ? `Rol ilgisi var; fakat kanıt ve rol yakınlığı ${roleFit ?? "henüz"} seviyesinde sınırlı görünüyor.`
    : "There is role interest, but proof and role proximity still look limited.";
}

function buildEvidenceInsight(careerProfile = {}, snapshot = {}, lang = "TR", decisionContext = {}) {
  const evidenceItems = evidenceFromCareerProfile(careerProfile, { lang });
  if (evidenceItems.length < 2) return null;
  const match = primaryRoleMatch(snapshot) || {};
  const roleContext = match.roleFamily || match.roleName || snapshot.targetRole || careerProfile.target_roles?.[0] || "";
  const report = evaluateEvidenceSet(evidenceItems, { roleContext, lang });
  if (!hasActionableEvidenceReport(report)) return null;
  const gap = selectPrimaryEvidenceGap(report);
  const strongest = report.strongestEvidence?.[0];
  const weakest = report.weakestEvidence?.[0];
  const tr = String(lang || "").toUpperCase() === "TR";
  const explicitGapTitle = decisionContext.blocker || snapshot.gapDetails?.title || snapshot.biggestGap?.title || "";
  const explicitGapAction = decisionContext.action || snapshot.gapDetails?.action || snapshot.suggestedNextMove || snapshot.recommendedNextMove || "";
  const title = explicitGapTitle || gap?.title || (tr ? "Eksik kanıt netleşmeli" : "Missing proof needs clarity");
  const why = strongest
    ? tr
      ? `${strongest.title} güven yaratıyor; ${weakest?.title || gap?.title} tarafı daha savunulabilir olmalı.`
      : `${strongest.title} builds trust; ${weakest?.title || gap?.title} needs to be easier to defend.`
    : report.explanationText;
  const debugReport = buildDecisionCoherenceReport({
    blocker: title,
    existingReason: decisionContext.existingReason || "",
    action: explicitGapAction || gap?.action || report.recommendedEvidenceImprovement,
    roleContext,
    evidenceReport: report,
    candidateReason: why,
    fallbackReason: decisionContext.existingReason || "",
  });
  return {
    title: compact(title, 80),
    why: compact(debugReport.finalReason || why || report.explanationText, 160),
    action: compact(explicitGapAction || gap?.action || report.recommendedEvidenceImprovement, 105),
    impact: tr ? "Recruiter güvenini daha savunulabilir hale getirir." : "Makes recruiter trust easier to defend.",
    strongestEvidence: strongest?.title || "",
    weakestEvidence: weakest?.title || gap?.title || "",
    confidenceScore: clampPercent(report.confidenceScore ?? report.roleSpecificEvidenceScore ?? report.overallEvidenceQuality),
    evidenceCount: evidenceItems.length,
    isCoherent: debugReport.coherenceResult === "evidence_used",
  };
}

function buildDecisionExplanation({ decision, tr }) {
  return [
    { label: tr ? "Kanıt" : "Evidence", value: decision.evidenceLine },
    { label: tr ? "Yorum" : "Reasoning", value: decision.reasoningLine },
    { label: tr ? "Güven" : "Confidence", value: decision.confidenceLine },
    { label: tr ? "Öneri" : "Recommendation", value: decision.recommendationLine || decision.action },
  ];
}

function buildDurableActionPayload(decision, user) {
  return buildDurableWeeklyActionPayload(decision, user);
}

function buildWeeklyDecision({ careerProfile, user, lang = "TR" }) {
  const tr = lang === "TR";
  const profile = normalizeProfileInput(careerProfile);
  const completed = Boolean(profile.onboarding_completed);
  const snapshot = snapshotFromProfile(profile);
  const firstName = reliableFirstName(profile, user);

  if (!completed) {
    const action = tr ? "İlk kariyer kararın için profilini tamamla." : "Complete your profile for your first career decision.";
    const supportCopy = tr
      ? "Rol yönünü, kanıt açığını ve sonraki hamleni güvenilir şekilde oluşturabilmemiz için birkaç bilgiye daha ihtiyacımız var."
      : firstName
        ? `${firstName}, we need a few more details to build a reliable role direction, proof gap, and next move.`
        : "We need a few more details to build a reliable role direction, proof gap, and next move.";
    return {
      id: actionId(user, action),
      profileComplete: false,
      title: tr ? "Bu Haftanın En Önemli Kariyer Hamlesi" : "This Week's Most Important Career Move",
      action,
      why: supportCopy,
      impact: tr ? "Kişisel kariyer kararın oluşur." : "Your personal career decision becomes available.",
      impactTitle: tr ? "Tamamladığında ne kazanacaksın?" : "What you unlock",
      impactBenefits: tr
        ? [
            "En güçlü rol yönlerin netleşir.",
            "Kanıt eksiklerin belirlenir.",
            "İlk kişisel kariyer hamlen oluşturulur.",
          ]
        : [
            "Your strongest role directions become clear.",
            "Your missing proof becomes visible.",
            "Your first personal career move is created.",
          ],
      time: tr ? "3 dakika" : "3 minutes",
      confidenceLabel: tr ? "Sınırlı" : "Limited",
      confidenceWhy: tr
        ? "Profil verin henüz tamamlanmadığı için önerinin güven seviyesi sınırlı."
        : "Confidence is limited because your profile data is not complete yet.",
      opportunity: tr ? "Kariyer profilini oluştur." : "Build your career profile.",
      evidenceLine: tr ? "Career DNA profilinin henüz tamamlanmadığını görüyoruz." : "We can see that your Career DNA profile is not complete yet.",
      reasoningLine: tr
        ? "Yeterli profil kanıtı olmadan rol veya gelişim önerisi sunmak güvenilir olmaz."
        : "Without enough profile proof, giving role or growth recommendations would not be reliable.",
      confidenceLine: tr
        ? "Şu an sınırlı; profil tamamlandığında yeniden hesaplanacak."
        : "Limited for now; it will be recalculated after your profile is complete.",
      recommendationLine: tr
        ? "Kariyer profilini tamamla ve ilk kişisel kariyer kararını oluştur."
        : "Complete your career profile and create your first personal career decision.",
    };
  }

  const existingAction = gapAction(snapshot, profile, tr);
  const existingBlocker = gapTitle(snapshot, profile, tr);
  const existingReason = gapWhy(snapshot, tr);
  const evidenceInsight = buildEvidenceInsight(profile, snapshot, lang, {
    blocker: existingBlocker,
    action: existingAction,
    existingReason,
  });
  const role = roleNameFromSnapshot(snapshot) || profile.target_roles?.[0] || (tr ? "Hedef rol" : "Target role");
  const roleFit = roleFitFromSnapshot(snapshot);
  const confidenceScore =
    evidenceInsight?.confidenceScore ??
    clampPercent(snapshot.recruiterConfidenceScore ?? snapshot.recruiterTrust ?? snapshot.recruiterConfidence ?? roleFit);
  const confidenceLabel = confidenceBand(confidenceScore, tr);
  const confidenceReason = confidenceWhy({
    score: confidenceScore,
    evidenceCount: evidenceInsight?.evidenceCount || 1,
    strongestEvidence: evidenceInsight?.strongestEvidence,
    roleFit,
  }, tr);
  const evidenceLine = evidenceInsight?.strongestEvidence
    ? tr
      ? `${evidenceInsight.strongestEvidence} kararın en güçlü dayanağı.`
      : `${evidenceInsight.strongestEvidence} is the strongest support for this decision.`
    : tr
      ? "Career DNA ve mevcut profil sinyalleri kullanıldı."
      : "Career DNA and current profile signals were used.";

  return {
    id: actionId(user, existingAction),
    profileComplete: true,
    title: tr ? "Bu Haftanın Kariyer Kararı" : "This Week's Career Decision",
    action: existingAction,
    why: evidenceInsight?.why || existingReason,
    impact: evidenceInsight?.isCoherent ? evidenceInsight.impact : qualitativeImpact(snapshot, tr),
    time: estimateTime(existingAction, tr),
    confidenceLabel,
    confidenceWhy: confidenceReason,
    opportunity: existingAction,
    blocker: tr ? `Şu an seni durduran şey: ${existingBlocker}.` : `What is holding you back: ${existingBlocker}.`,
    blockerWhy: evidenceInsight?.why || existingReason,
    blockerImpact: evidenceInsight?.isCoherent ? evidenceInsight.impact : qualitativeImpact(snapshot, tr),
    role,
    roleConfidence: roleFit != null ? `${roleFit}%` : (tr ? "Kanıt sınırlı" : "Limited proof"),
    roleReason: roleReasonFromSnapshot(snapshot, tr),
    evidenceLine,
    reasoningLine: evidenceInsight?.why || existingReason,
    confidenceLine: `${confidenceLabel}: ${confidenceReason}`,
  };
}

function buildProgressDeltas(lang) {
  const tr = lang === "TR";
  const snapshots = loadLocalCareerProgress();
  const current = snapshots?.[0];
  const previous = snapshots?.[1];
  if (!current || !previous) return [];
  const rows = [
    { key: "recruiter_confidence", label: "Recruiter Trust", before: previous.recruiter_confidence, after: current.recruiter_confidence },
    { key: "career_score", label: tr ? "Hazırlık" : "Readiness", before: previous.career_score, after: current.career_score },
    { key: "interview_readiness", label: tr ? "Rol Yakınlığı" : "Role Fit", before: previous.interview_readiness, after: current.interview_readiness },
  ];
  return rows
    .map((row) => {
      const before = clampPercent(row.before);
      const after = clampPercent(row.after);
      if (before == null || after == null) return null;
      const delta = after - before;
      if (!delta) return null;
      return { ...row, before, after, delta };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function WeeklyDecisionHero({ decision, completed, loading, onComplete, onPrimary }) {
  return (
    <section className="hf-weekly-hero">
      <div className="hf-weekly-hero__copy">
        <span className="hf-weekly-eyebrow">{decision.title}</span>
        <h1>{decision.action}</h1>
        <p>{decision.why}</p>
      </div>
      <div className="hf-weekly-hero__panel">
        <div>
          <span>{decision.impactTitle || decision.impactLabel}</span>
          {decision.impactBenefits?.length ? (
            <ul className="hf-weekly-benefits">
              {decision.impactBenefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
          ) : (
            <strong>{decision.impact}</strong>
          )}
        </div>
        <div>
          <span>{decision.timeLabel}</span>
          <strong>{decision.time}</strong>
        </div>
        <button
          type="button"
          className={completed ? "hf-weekly-btn is-complete" : "hf-weekly-btn"}
          onClick={completed ? onPrimary : onComplete}
          disabled={loading}
        >
          {completed ? (
            <>
              <CheckCircle2 size={16} /> {decision.doneLabel}
            </>
          ) : loading ? (
            <>{decision.loadingLabel}</>
          ) : (
            <>
              {decision.completeLabel} <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </section>
  );
}

function DecisionConfidenceCard({ decision, tr }) {
  return (
    <section className="hf-weekly-card hf-confidence-card">
      <div className="hf-weekly-section-head">
        <ShieldCheck size={16} />
        <span>{tr ? "Karar Güveni" : "Decision Confidence"}</span>
      </div>
      <div className={`hf-confidence-pill is-${decision.confidenceLabel.toLowerCase()}`}>
        {decision.confidenceLabel}
      </div>
      <p>{decision.confidenceWhy}</p>
    </section>
  );
}

function OpportunityCard({ decision, tr }) {
  return (
    <section className="hf-weekly-card hf-opportunity-card">
      <div className="hf-weekly-section-head">
        <Target size={16} />
        <span>{tr ? "En Yüksek Etkili Fırsat" : "Highest Impact Opportunity"}</span>
      </div>
      <strong>{decision.opportunity}</strong>
      <p>{tr ? "Bu, şu anki karar zincirinde en çok etki yaratacak tek hamle." : "This is the one move most likely to change the current decision path."}</p>
    </section>
  );
}

function ExplainDecision({ decision, tr }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => buildDecisionExplanation({ decision, tr }), [decision, tr]);
  return (
    <section className="hf-weekly-card hf-explain-card">
      <button type="button" className="hf-explain-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>{tr ? "Bu karar neden verildi?" : "Why this decision?"}</span>
        <ChevronDown size={17} className={open ? "is-open" : ""} />
      </button>
      {open ? (
        <div className="hf-explain-flow">
          {rows.map((row, index) => (
            <div className="hf-explain-step" key={row.label}>
              <span>{index + 1}</span>
              <div>
                <strong>{row.label}</strong>
                <p>{row.value}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DecisionMirror({ decision, lang }) {
  const tr = lang === "TR";
  const [open, setOpen] = useState(false);
  const mirror = useMemo(() => buildDecisionMirrorViewModel({ decision, lang }), [decision, lang]);
  const panelId = "hf-decision-mirror-panel";

  useEffect(() => {
    if (!mirror.available) return;
    trackActivationEvent("decision_mirror_viewed", {
      route: "/dashboard",
      surface: "weekly_decision_center",
      lang,
      questionCount: mirror.questions.length,
    });
  }, [mirror.available, mirror.questions?.length, lang]);

  useEffect(() => {
    if (!open || !mirror.available) return;
    trackActivationEvent("reflection_question_viewed", {
      route: "/dashboard",
      surface: "weekly_decision_center",
      lang,
      questionCount: mirror.questions.length,
    });
  }, [open, mirror.available, mirror.questions?.length, lang]);

  if (!mirror.available) return null;

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      trackActivationEvent("decision_mirror_opened", {
        route: "/dashboard",
        surface: "weekly_decision_center",
        lang,
        questionCount: mirror.questions.length,
      });
    }
  };

  return (
    <section className="hf-weekly-card hf-decision-mirror">
      <button
        type="button"
        className="hf-decision-mirror__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
      >
        <span>
          <strong>{tr ? "Karar Aynası" : "Decision Mirror"}</strong>
          <small>
            {tr
              ? "Bu bölüm kararını değiştirmez. Kendi motivasyonlarını ve önceliklerini daha net görmene yardımcı olur."
              : "This does not change your decision. It helps you see your motivations and priorities more clearly."}
          </small>
        </span>
        <span className="hf-decision-mirror__cta">
          {tr ? "Kararımı biraz daha derin düşün" : "Reflect a little deeper"}
          <ChevronDown size={17} className={open ? "is-open" : ""} />
        </span>
      </button>
      {open ? (
        <div id={panelId} className="hf-decision-mirror__body">
          <p>{mirror.summary}</p>
          <div className="hf-decision-mirror__block">
            <strong>{tr ? "Düşünme soruları" : "Reflection questions"}</strong>
            <ul>
              {mirror.questions.slice(0, 3).map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
          {mirror.valueTension ? (
            <div className="hf-decision-mirror__note">
              <strong>{tr ? "Olası değer gerilimi" : "Possible value tension"}</strong>
              <span>{mirror.valueTension}</span>
            </div>
          ) : null}
          <div className="hf-decision-mirror__journal">
            <strong>{tr ? "Journal sorusu" : "Journal prompt"}</strong>
            <p>{mirror.journalPrompt}</p>
            <button
              type="button"
              onClick={() =>
                trackActivationEvent("reflection_journal_started", {
                  route: "/dashboard",
                  surface: "weekly_decision_center",
                  lang,
                })
              }
            >
              {tr ? "Bu soruyla düşünmeye başla" : "Start with this prompt"}
            </button>
          </div>
          <small className="hf-decision-mirror__safety">{mirror.safetyNote}</small>
        </div>
      ) : null}
    </section>
  );
}

function ProgressRow({ deltas, tr }) {
  return (
    <section className="hf-weekly-card hf-weekly-progress">
      <div className="hf-weekly-section-head">
        <TrendingUp size={16} />
        <span>{tr ? "Son Ziyaretten Beri" : "Since Last Visit"}</span>
      </div>
      {deltas.length ? (
        <div className="hf-weekly-deltas">
          {deltas.map((delta) => (
            <div key={delta.key} className="hf-weekly-delta">
              <span>{delta.label}</span>
              <strong className={delta.delta > 0 ? "is-up" : "is-down"}>
                {delta.delta > 0 ? "+" : ""}
                {delta.delta}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="hf-weekly-muted">
          {tr
            ? "Henüz karşılaştırılacak önceki ölçüm yok. İlk ilerleme, bir sonraki doğrulamadan sonra görünür."
            : "No previous measurement yet. Progress appears after your next validation."}
        </p>
      )}
    </section>
  );
}

function BlockerCard({ decision, tr }) {
  return (
    <section className="hf-weekly-card hf-weekly-blocker">
      <div className="hf-weekly-section-head">
        <Target size={16} />
        <span>{tr ? "En Büyük Blokaj" : "Biggest Blocker"}</span>
      </div>
      <strong>{decision.blocker}</strong>
      <p>{decision.blockerWhy}</p>
      <em>{decision.blockerImpact}</em>
    </section>
  );
}

function RoleCard({ decision, tr }) {
  return (
    <section className="hf-weekly-card">
      <div className="hf-weekly-section-head">
        <Target size={16} />
        <span>{tr ? "En Güçlü Mevcut Rol" : "Best Current Role"}</span>
      </div>
      <div className="hf-weekly-role">
        <strong>{decision.role}</strong>
        <span>{decision.roleConfidence}</span>
      </div>
      <p className="hf-weekly-muted">{decision.roleReason}</p>
    </section>
  );
}

function ShortcutCard({ title, copy, cta, onClick, icon }) {
  return (
    <section className="hf-weekly-card hf-weekly-shortcut">
      <div>
        <div className="hf-weekly-section-head">
          {icon}
          <span>{title}</span>
        </div>
        <p>{copy}</p>
      </div>
      <button type="button" onClick={onClick}>
        {cta}
      </button>
    </section>
  );
}

function countCandidateSignals(signals = {}) {
  return Object.values(signals || {}).filter((value) => value === true).length;
}

function OutcomeCaptureCard({ actionId, decision, getApiAuthHeaders, lang, user }) {
  const tr = lang === "TR";
  const [outcome, setOutcome] = useState(null);
  const [outcomeType, setOutcomeType] = useState("COMPLETED_WITH_RESULT");
  const [summary, setSummary] = useState("");
  const [measurableResult, setMeasurableResult] = useState("");
  const [proofReference, setProofReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    trackActivationEvent("weekly_action_outcome_prompt_viewed", {
      route: "/dashboard",
      lang,
      action_type: "weekly_career_move",
    });
  }, [lang, actionId]);

  useEffect(() => {
    if (!actionId || !user?.id || !getApiAuthHeaders) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchCareerActionOutcome({ getHeaders: getApiAuthHeaders, actionId });
        if (cancelled || !result?.outcome) return;
        setOutcome(result.outcome);
        setOutcomeType(result.outcome.outcome_type || "COMPLETED_WITH_RESULT");
        setSummary(result.outcome.summary || "");
        setMeasurableResult(result.outcome.measurable_result || "");
        setProofReference(result.outcome.proof_reference || "");
      } catch {
        if (!cancelled) setError("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actionId, getApiAuthHeaders, user?.id]);

  const saveOutcome = async () => {
    if (!summary.trim()) {
      setError(tr ? "Kısa bir sonuç açıklaması ekle." : "Add a short outcome summary.");
      return;
    }
    if (!actionId || !user?.id || !getApiAuthHeaders) {
      setError(tr ? "Sonuç şu anda kaydedilemedi. Lütfen tekrar dene." : "Outcome could not be saved right now. Please try again.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const hadOutcome = Boolean(outcome?.outcome_id);
    try {
      const result = await upsertCareerActionOutcome({
        getHeaders: getApiAuthHeaders,
        actionId,
        outcome: {
          outcome_type: outcomeType,
          summary,
          measurable_result: measurableResult,
          proof_reference: proofReference,
          source: "weekly_decision_center",
        },
      });
      if (result?.outcome) {
        setOutcome(result.outcome);
        const candidateCreated = result.candidateStatus === "candidate_created";
        setNotice(
          candidateCreated
            ? tr
              ? "Sonucun kaydedildi ve değerlendirilmek üzere bir kanıt adayı oluşturuldu."
              : "Your outcome was saved and an evidence candidate was created for later review."
            : tr
              ? "Sonucun kaydedildi."
              : "Your outcome was saved."
        );
        trackActivationEvent(hadOutcome ? "weekly_action_outcome_updated" : "weekly_action_outcome_submitted", {
          route: "/dashboard",
          lang,
          action_type: "weekly_career_move",
          outcome_type: outcomeType,
          has_summary: Boolean(summary.trim()),
          has_measurable_result: Boolean(measurableResult.trim()),
          has_proof_reference: Boolean(proofReference.trim()),
        });
        trackActivationEvent(
          candidateCreated
            ? hadOutcome
              ? "evidence_candidate_updated"
              : "evidence_candidate_created"
            : "evidence_candidate_insufficient",
          {
            route: "/dashboard",
            lang,
            candidate_type: result.evidenceCandidate?.candidate_type || "",
            outcome_type: outcomeType,
            has_metric: Boolean(measurableResult.trim()),
            has_proof_reference: Boolean(proofReference.trim()),
            quality_signal_count: countCandidateSignals(result.candidateSignals),
          }
        );
        if (result.shadowLearning?.attempted) {
          const shadowPayload = {
            route: "/dashboard",
            lang,
            candidate_type: result.evidenceCandidate?.candidate_type || "",
            outcome_type: outcomeType,
            evaluation_status: result.shadowLearning.evaluationStatus || result.evaluationStatus || "",
            usable_for_shadow: Boolean(result.shadowLearning.usableForShadow || result.usableForShadow),
            material_change: Boolean(result.shadowLearning.materialChange),
            recommendation_changed: Boolean(result.shadowLearning.recommendationChanged),
            gap_changed: Boolean(result.shadowLearning.gapChanged),
            confidence_direction: result.shadowLearning.confidenceDirection || "unknown",
          };
          trackActivationEvent("evidence_candidate_evaluated", shadowPayload);
          trackActivationEvent(
            result.shadowLearning.failed
              ? "shadow_learning_failed"
              : "shadow_learning_run_completed",
            shadowPayload
          );
          if (!result.shadowLearning.failed && shadowPayload.usable_for_shadow) {
            trackActivationEvent(
              shadowPayload.material_change ? "shadow_learning_material_change" : "shadow_learning_no_change",
              shadowPayload
            );
          }
          if (result.shadowLearning.readinessClassification) {
            trackActivationEvent("shadow_promotion_readiness_evaluated", {
              ...shadowPayload,
              production_shadow_alignment: result.shadowLearning.productionShadowAlignment || "",
              readiness_classification: result.shadowLearning.readinessClassification,
              failure_flag_count: Array.isArray(result.shadowLearning.failureFlags)
                ? result.shadowLearning.failureFlags.length
                : 0,
            });
          }
          if (result.shadowLearning.validationStatus) {
            const validationPayload = {
              ...shadowPayload,
              validation_status: result.shadowLearning.validationStatus,
              review_classification: result.shadowLearning.reviewClassification || "",
              review_priority: result.shadowLearning.reviewPriority || 0,
              gap_comparison: result.shadowLearning.gapComparison || "",
              gap_relationship: result.shadowLearning.gapRelationship || "",
              shadow_gap_change_reason: result.shadowLearning.shadowGapChangeReason || "",
              gap_outcome_signal: result.shadowLearning.gapOutcomeSignal || "",
              gap_winner_classification: result.shadowLearning.gapWinnerClassification || "",
              real_user_cohort_state: result.shadowLearning.realUserCohortState || "",
            };
            trackActivationEvent(
              result.shadowLearning.validationStatus === "complete"
                ? "real_shadow_validation_completed"
                : "real_shadow_validation_insufficient",
              validationPayload
            );
            if (result.shadowLearning.reviewClassification === "REVIEW_REQUIRED") {
              trackActivationEvent("real_shadow_review_required", validationPayload);
            }
            if (result.shadowLearning.gapComparison === "changed_due_to_usable_evidence" ||
              result.shadowLearning.gapComparison === "changed_unexpectedly") {
              trackActivationEvent("gap_prioritization_shadow_changed", validationPayload);
            }
          }
        }
      } else {
        setError(tr ? "Sonuç şu anda kaydedilemedi. Lütfen tekrar dene." : "Outcome could not be saved right now. Please try again.");
      }
    } catch {
      setError(tr ? "Sonuç şu anda kaydedilemedi. Lütfen tekrar dene." : "Outcome could not be saved right now. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="hf-weekly-card hf-outcome-card">
      <div className="hf-weekly-section-head">
        <CheckCircle2 size={16} />
        <span>{tr ? "Bu hamleden sonra ne oldu?" : "What happened after this action?"}</span>
      </div>
      <p className="hf-weekly-muted">
        {tr
          ? "Bu sadece sonuç kaydıdır; kanıt doğrulaması ve skor değişimi yapılmaz."
          : "This only records the outcome; proof validation and score changes do not happen here."}
      </p>
      <label className="hf-outcome-field">
        <span>{tr ? "Sonuç türü" : "Outcome type"}</span>
        <select value={outcomeType} onChange={(event) => setOutcomeType(event.target.value)}>
          <option value="COMPLETED_WITH_RESULT">{tr ? "Sonuç oluştu" : "Completed with result"}</option>
          <option value="COMPLETED_NO_RESULT">{tr ? "Henüz sonuç yok" : "Completed, no result yet"}</option>
          <option value="PARTIAL_RESULT">{tr ? "Kısmi sonuç" : "Partial result"}</option>
          <option value="EXTERNAL_RESPONSE">{tr ? "Dış yanıt geldi" : "External response"}</option>
          <option value="INTERVIEW">{tr ? "Mülakat geldi" : "Interview"}</option>
          <option value="REJECTION">{tr ? "Red geldi" : "Rejection"}</option>
          <option value="OFFER">{tr ? "Teklif geldi" : "Offer"}</option>
        </select>
      </label>
      <label className="hf-outcome-field">
        <span>{tr ? "Kısa sonuç" : "Short outcome"}</span>
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder={tr ? "Örn. LinkedIn özetine karar örneğini ekledim." : "Example: I added the decision example to my LinkedIn summary."}
          rows={3}
        />
      </label>
      <div className="hf-outcome-grid">
        <label className="hf-outcome-field">
          <span>{tr ? "Ölçülebilir sonuç var mı?" : "Any measurable result?"}</span>
          <input
            value={measurableResult}
            onChange={(event) => setMeasurableResult(event.target.value)}
            placeholder={tr ? "Opsiyonel" : "Optional"}
          />
        </label>
        <label className="hf-outcome-field">
          <span>{tr ? "Bağlantı veya referans" : "Link or reference"}</span>
          <input
            value={proofReference}
            onChange={(event) => setProofReference(event.target.value)}
            placeholder={tr ? "Opsiyonel, doğrulanmış kanıt değildir" : "Optional, not verified evidence"}
          />
        </label>
      </div>
      <button type="button" className="hf-outcome-save" onClick={saveOutcome} disabled={saving}>
        {saving ? (tr ? "Kaydediliyor..." : "Saving...") : outcome ? (tr ? "Sonucu Güncelle" : "Update Outcome") : (tr ? "Sonucu Kaydet" : "Save Outcome")}
      </button>
      {notice ? <p className="hf-outcome-notice">{notice}</p> : null}
      {error ? <p className="hf-outcome-error">{error}</p> : null}
      {decision?.action ? <small>{tr ? "İlgili hamle:" : "Related action:"} {decision.action}</small> : null}
    </section>
  );
}

export default function WeeklyDecisionCenter({
  careerProfile,
  user,
  lang = "TR",
  navigate,
  getApiAuthHeaders,
}) {
  const tr = lang === "TR";
  const [completedActions, setCompletedActions] = useState(() => getCompletions());
  const [durableAction, setDurableAction] = useState(null);
  const [actionLoadState, setActionLoadState] = useState("idle");
  const [actionLoadError, setActionLoadError] = useState("");
  const [actionRetryNonce, setActionRetryNonce] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionSaveError, setActionSaveError] = useState("");
  const decision = useMemo(() => {
    const base = buildWeeklyDecision({ careerProfile, user, lang });
    return {
      ...base,
      impactLabel: tr ? "Beklenen Kariyer Etkisi" : "Expected Career Impact",
      timeLabel: tr ? "Tahmini Süre" : "Estimated Time",
      beginLabel: tr ? "Başla" : "Start",
      completeLabel: tr ? "Tamamladım" : "Mark Complete",
      startLabel: tr ? "Kariyer Profilini Tamamla" : "Complete Career Profile",
      doneLabel: tr ? "Bu hafta tamamlandı" : "Completed this week",
      loadingLabel: tr ? "Hamle hazırlanıyor..." : "Preparing move...",
    };
  }, [careerProfile, user, lang, tr]);
  const visibleDecision = useMemo(() => {
    if (!durableAction?.action_id) return decision;
    return {
      ...decision,
      id: durableAction.action_id,
      action: durableAction.title || decision.action,
      why: durableAction.reason || decision.why,
      blocker: durableAction.blocker || decision.blocker,
      opportunity: durableAction.expected_evidence || durableAction.target_dimension || decision.opportunity,
    };
  }, [decision, durableAction]);
  const localRecord = completedActions[visibleDecision.id] || completedActions[decision.id];
  const actionStatus = durableAction?.status || localRecord?.status || (localRecord ? "completed" : "recommended");
  const completed = actionStatus === "completed";
  const actionLoading = actionLoadState === "loading" || actionBusy;
  const deltas = useMemo(() => buildProgressDeltas(lang), [lang]);

  useEffect(() => {
    trackActivationEvent("dashboard_first_view", {
      route: "/dashboard",
      lang,
      profileComplete: decision.profileComplete,
    });
    trackActivationEvent("weekly_action_viewed", {
      route: "/dashboard",
      lang,
      profileComplete: decision.profileComplete,
    });
  }, [lang, decision.profileComplete, decision.id]);

  useEffect(() => {
    if (!decision.profileComplete || !user?.id || !getApiAuthHeaders) return undefined;
    let cancelled = false;
    const payload = buildDurableActionPayload(decision, user);
    (async () => {
      setActionLoadState("loading");
      setActionLoadError("");
      try {
        const current = await fetchCurrentCareerAction({
          getHeaders: getApiAuthHeaders,
          weekKey: payload.week_key || getWeekKey(),
        });
        if (cancelled) return;
        if (current?.storageUnavailable) throw new Error("current_action_unavailable");
        let ensured = current?.action || null;
        if (!ensured) {
          const upserted = await upsertRecommendedCareerAction({ getHeaders: getApiAuthHeaders, action: payload });
          if (cancelled) return;
          if (upserted?.storageUnavailable || !upserted?.action) throw new Error("action_generation_unavailable");
          ensured = upserted.action;
        }
        setDurableAction(ensured);
        const localCompleted = findLocalCompletion({
          id: ensured?.action_id || decision.id,
          week: getWeekKey(),
          action: ensured?.title || decision.action,
        }, user);
        if (localCompleted && ensured && ensured.status !== "completed") {
          const started = await startCareerAction({ getHeaders: getApiAuthHeaders, actionId: ensured.action_id });
          const completedResult = await completeCareerAction({
            getHeaders: getApiAuthHeaders,
            actionId: started?.action?.action_id || ensured.action_id,
          });
          if (!cancelled && completedResult?.action) setDurableAction(completedResult.action);
        }
        if (!cancelled) setActionLoadState("ready");
      } catch {
        // Durable action persistence is the source of truth when available.
        // Local storage remains a non-authoritative fallback for offline or unavailable backend cases.
        if (!cancelled) {
          setActionLoadState("error");
          setActionLoadError(
            tr
              ? "Haftalık hamle sunucudan alınamadı. Sayfayı yenilemeden tekrar deneyebilirsin."
              : "Your weekly move could not be loaded from the server. You can retry without refreshing."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [decision, decision.id, decision.action, decision.profileComplete, getApiAuthHeaders, user, tr, actionRetryNonce]);

  const persistLocalAction = (status) => {
    const now = new Date().toISOString();
    saveCompletion({
      id: visibleDecision.id,
      userId: userKey(user),
      week: getWeekKey(),
      action: visibleDecision.action,
      status,
      startedAt: status === "started" ? now : localRecord?.startedAt || now,
      completedAt: status === "completed" ? now : localRecord?.completedAt || null,
    });
    setCompletedActions(getCompletions());
  };

  const handleActionButton = async () => {
    if (!decision.profileComplete) {
      navigate?.("/career-dna");
      return;
    }
    if (completed || actionBusy) return;
    setActionBusy(true);
    setActionSaveError("");
    try {
      if (user?.id) {
        if (!getApiAuthHeaders) throw new Error("action_save_unavailable");
        const ensured = durableAction || (await upsertRecommendedCareerAction({
          getHeaders: getApiAuthHeaders,
          action: buildDurableActionPayload(visibleDecision, user),
        }))?.action;
        if (ensured && actionStatus === "recommended") {
          const result = await startCareerAction({ getHeaders: getApiAuthHeaders, actionId: ensured.action_id });
          if (!result?.storageUnavailable && result?.success !== false && ["started", "completed"].includes(result?.action?.status)) {
            setDurableAction(result.action);
            trackActivationEvent("weekly_action_started", { route: "/dashboard", lang, actionStatus: "started", storage: "durable" });
            return;
          }
        }
        if (ensured && actionStatus === "started") {
          const result = await completeCareerAction({ getHeaders: getApiAuthHeaders, actionId: ensured.action_id });
          if (!result?.storageUnavailable && result?.success !== false && result?.action?.status === "completed") {
            setDurableAction(result.action);
            persistLocalAction("completed");
            trackActivationEvent("weekly_action_completed", { route: "/dashboard", lang, actionStatus: "completed", storage: "durable" });
            return;
          }
        }
        throw new Error("action_save_unavailable");
      }
      const nextStatus = actionStatus === "started" ? "completed" : "started";
      persistLocalAction(nextStatus);
      trackActivationEvent(
        nextStatus === "completed" ? "weekly_action_completed" : "weekly_action_started",
        { route: "/dashboard", lang, actionStatus: nextStatus, storage: "local_fallback" }
      );
    } catch {
      setActionSaveError(tr
        ? "Hamlen kaydedilemedi. Son kaydedilen durum korundu. Lütfen tekrar dene."
        : "Your move could not be saved. Your last saved status was preserved. Please retry.");
    } finally {
      setActionBusy(false);
    }
  };

  const heroCompleteLabel = !decision.profileComplete
    ? decision.startLabel
    : actionStatus === "started"
      ? decision.completeLabel
      : decision.beginLabel;

  return (
    <div className="hf-weekly-center">
      <WeeklyDecisionHero
        decision={{
          ...visibleDecision,
          completeLabel: heroCompleteLabel,
        }}
        completed={completed}
        loading={actionLoading}
        onComplete={handleActionButton}
        onPrimary={() => navigate?.("/dashboard")}
      />
      {decision.profileComplete && actionLoadState === "loading" ? (
        <div className="hf-weekly-card hf-weekly-status" role="status" aria-live="polite">
          <strong>{tr ? "Haftalık hamlen hazırlanıyor" : "Preparing your weekly move"}</strong>
          <p>{tr ? "Mevcut profilinden bu haftanın aksiyonunu getiriyoruz." : "We are loading this week's action from your current profile."}</p>
        </div>
      ) : null}
      {actionSaveError ? (
        <div className="hf-weekly-card hf-weekly-status hf-weekly-status--error" role="alert">
          <p>{actionSaveError}</p>
          <button type="button" className="hf-weekly-retry" disabled={actionBusy} onClick={handleActionButton}>
            {tr ? "Tekrar Dene" : "Retry"}
          </button>
        </div>
      ) : null}
      {decision.profileComplete && actionLoadError ? (
        <div className="hf-weekly-card hf-weekly-status hf-weekly-status--error" role="alert">
          <strong>{tr ? "Haftalık hamle yüklenemedi" : "Weekly move could not load"}</strong>
          <p>{actionLoadError}</p>
          <button type="button" className="hf-weekly-retry" onClick={() => setActionRetryNonce((n) => n + 1)}>
            {tr ? "Tekrar Dene" : "Retry"}
          </button>
        </div>
      ) : null}
      {decision.profileComplete && completed ? (
        <OutcomeCaptureCard
          actionId={durableAction?.action_id || visibleDecision.id}
          decision={visibleDecision}
          getApiAuthHeaders={getApiAuthHeaders}
          lang={lang}
          user={user}
        />
      ) : null}
      {decision.profileComplete ? (
        <div className="hf-weekly-decision-grid">
          <DecisionConfidenceCard decision={visibleDecision} tr={tr} />
          <OpportunityCard decision={visibleDecision} tr={tr} />
        </div>
      ) : (
        <DecisionConfidenceCard decision={visibleDecision} tr={tr} />
      )}
      <ExplainDecision decision={visibleDecision} tr={tr} />
      {decision.profileComplete ? <DecisionMirror decision={visibleDecision} lang={lang} /> : null}
      {decision.profileComplete ? (
        <>
          <ProgressRow deltas={deltas} tr={tr} />
          <BlockerCard decision={visibleDecision} tr={tr} />
          <RoleCard decision={visibleDecision} tr={tr} />
          <div className="hf-weekly-shortcuts">
            <ShortcutCard
              title="Career Snapshot"
              copy={tr ? "Tam raporu aç; dashboard’da tekrar etmiyoruz." : "Open the full report; the dashboard does not repeat it."}
              cta={tr ? "Tam Snapshot’ı Gör" : "View Full Snapshot"}
              icon={<FileText size={16} />}
              onClick={() => navigate?.("/career-dna?snapshot=1")}
            />
            <ShortcutCard
              title={tr ? "CV ile Doğrula" : "Validate With CV"}
              copy={tr ? "Career DNA varsayımlarını CV kanıtıyla kontrol et." : "Validate Career DNA assumptions with CV proof."}
              cta={tr ? "CV ile Doğrula" : "Validate With CV"}
              icon={<Clock size={16} />}
              onClick={() => navigate?.("/app")}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}



