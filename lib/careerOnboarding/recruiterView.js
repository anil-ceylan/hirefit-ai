/**
 * Recruiter First Impression — derived from existing snapshot signals only.
 */

import {
  filterSignalsForFamily,
  recruiterConfidencePercent,
} from "./snapshotWow.js";

function isTr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

function buildConfidenceReason({ tr, roleName, strongSignals, missingEvidence, family }) {
  const strong = strongSignals.slice(0, 2).join(tr ? " ve " : " and ");
  const missing = missingEvidence.slice(0, 2).join(tr ? " ve " : " and ");

  if (family === "PRODUCT") {
    if (tr) {
      return missing
        ? strong
          ? `Recruiter ürün sahipliği kanıtını (${strong}) görüyor; ancak ${missing} henüz sınırlı.`
          : `Recruiter ürün yönünü görüyor; ancak ${missing} için somut kanıt bulamıyor.`
        : `Recruiter ${roleName} için sahiplenme ve ürün kanıtını (${strong}) hızlıca okuyabiliyor.`;
    }
    return missing
      ? strong
        ? `Recruiters can clearly see product ownership evidence (${strong}), but role-specific proof (${missing}) is still limited.`
        : `Recruiters can see the product direction, but cannot find concrete proof for ${missing}.`
      : `Recruiters can quickly read ownership and product signals (${strong}) for ${roleName}.`;
  }

  if (family === "HR") {
    if (tr) {
      return missing
        ? `Recruiter people/İK sinyallerini (${strong}) görüyor; ${missing} kanıtı güçlenince güven artar.`
        : `Recruiter aday ve people süreçlerine dair sinyalleri (${strong}) net okuyor.`;
    }
    return missing
      ? `Recruiters see people/HR signals (${strong}); confidence rises once ${missing} is documented.`
      : `Recruiters clearly read candidate and people-process signals (${strong}).`;
  }

  if (family === "FINANCE") {
    if (tr) {
      return missing
        ? `Recruiter analitik/finans sinyallerini (${strong}) görüyor; ${missing} eksikliği shortlist kararını yavaşlatıyor.`
        : `Recruiter finansal analiz sinyallerini (${strong}) net okuyor.`;
    }
    return missing
      ? `Recruiters see analytical/finance signals (${strong}); missing ${missing} slows shortlist decisions.`
      : `Recruiters clearly read financial analysis signals (${strong}).`;
  }

  if (tr) {
    return missing
      ? `Recruiter ${strong || "role yönünü"} net görüyor; ${missing} kanıtı sınırlı.`
      : `Recruiter ${roleName} hattında ${strong} sinyallerini hızlı okuyor.`;
  }
  return missing
    ? `Recruiters clearly see ${strong || "role direction"} but ${missing} proof is still limited.`
    : `Recruiters quickly read ${strong} signals aligned with ${roleName}.`;
}

export function buildRecruiterView({
  lang = "TR",
  primaryMatch = null,
  roleFamily = "BUSINESS",
  strongestSignal = "",
  gapDetails = null,
  targetRole = "",
} = {}) {
  const tr = isTr(lang);
  const match = primaryMatch || {};
  const family = roleFamily || "BUSINESS";
  const roleName = match.roleName || targetRole || (tr ? "Hedef rol" : "Target role");

  let strongSignals = filterSignalsForFamily(family, [...new Set(match.strongSignals || [])]).slice(0, 3);
  if (!Number.isFinite(Number(match.confidenceScore)) && strongestSignal && !strongSignals.includes(strongestSignal)) {
    strongSignals = filterSignalsForFamily(family, [strongestSignal, ...strongSignals]).slice(0, 3);
  }

  let missingEvidence = filterSignalsForFamily(family, [...new Set(match.missingSignals || [])]).slice(0, 3);
  if (gapDetails?.title && !missingEvidence.includes(gapDetails.title)) {
    missingEvidence = filterSignalsForFamily(family, [gapDetails.title, ...missingEvidence]).slice(0, 3);
  }
  if (gapDetails?.evidenceMissing) {
    const ev = gapDetails.evidenceMissing;
    if (!missingEvidence.includes(ev)) {
      missingEvidence = filterSignalsForFamily(family, [...missingEvidence, ev]).slice(0, 3);
    }
  }

  const percent = recruiterConfidencePercent(match);
  const reason = buildConfidenceReason({ tr, roleName, strongSignals, missingEvidence, family });

  return {
    headline: tr ? "Recruiter First Impression" : "Recruiter First Impression",
    description: tr
      ? "Bir recruiter'ın hızlı ilk incelemede bu profili nasıl değerlendirebileceği."
      : "How a recruiter would likely evaluate this profile during a quick initial review.",
    targetRole: roleName,
    strongSignals,
    missingEvidence,
    recruiterConfidence: {
      percent,
      level: match.confidence || "Low",
      reason,
    },
    roleFitBand: match.fitBand?.label || "",
  };
}

export function buildRecruiterViewFromSnapshot(snapshot = {}, lang = "TR") {
  if (snapshot.recruiterView?.recruiterConfidence?.percent != null) {
    return snapshot.recruiterView;
  }
  const primaryMatch = snapshot.topRoleMatches?.[0] || snapshot.roleMatches?.[0] || null;
  return buildRecruiterView({
    lang,
    primaryMatch,
    roleFamily: snapshot.roleFamily?.primary || "BUSINESS",
    strongestSignal: snapshot.strongestSignal,
    gapDetails: snapshot.gapDetails,
    targetRole: snapshot.targetRole,
  });
}
