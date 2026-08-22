import { useId, useState } from "react";
import { AlertTriangle, CheckCircle2, Compass, Target, TrendingUp, Zap } from "lucide-react";
import { buildRecruiterViewFromSnapshot } from "../../../lib/careerOnboarding/recruiterView.js";
import { getRoleDisplay } from "../../../lib/careerOnboarding/roleDisplay.js";

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function compactText(value, max = 96) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function firstDefined(...values) {
  return values.find((v) => v !== undefined && v !== null && String(v).trim() !== "");
}

function readinessStage(score, tr) {
  const n = clampPercent(score);
  if (n <= 45) return tr ? "Erken" : "Early";
  if (n <= 65) return tr ? "Gelişiyor" : "Developing";
  if (n <= 80) return tr ? "Rekabetçi" : "Competitive";
  return tr ? "Güçlü" : "Strong";
}

function consistentReadinessStage(score, confidencePercent, roleFit, tr) {
  const base = readinessStage(score, tr);
  const confidence = Number(confidencePercent);
  const fit = Number(roleFit);
  if (Number.isFinite(confidence) && confidence < 40 && Number.isFinite(fit) && fit < 65) return tr ? "Gelişiyor" : "Developing";
  if ((base === "Strong" || base === "Güçlü") && Number.isFinite(confidence) && confidence < 40) return tr ? "Gelişiyor" : "Developing";
  if ((base === "Strong" || base === "Güçlü") && Number.isFinite(fit) && fit < 65) return tr ? "Rekabetçi" : "Competitive";
  return base;
}

function practicalReadinessScore(potentialScore, confidencePercent, roleFit, snap = {}) {
  const potential = clampPercent(potentialScore);
  const confidence = Number.isFinite(Number(confidencePercent)) ? clampPercent(confidencePercent) : potential;
  const fit = Number.isFinite(Number(roleFit)) ? clampPercent(roleFit) : potential;
  const evidence = evidenceProfile(snap);
  let score = Math.round(potential * 0.45 + fit * 0.3 + confidence * 0.25);
  if (!evidence.hasVerified) score = Math.min(score, 72);
  if (confidence < 40 && fit < 65) score = Math.min(score, 72);
  if (confidence < 40) score = Math.min(score, 76);
  return clampPercent(score);
}

function levelFromScore(score, tr) {
  const n = clampPercent(score);
  if (n < 40) return tr ? "Zayıf" : "Low";
  if (n < 67) return tr ? "Orta" : "Medium";
  return tr ? "Güçlü" : "Strong";
}

function average(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function findBreakdownValue(rows, patterns) {
  const row = rows.find((item) => patterns.some((pattern) => pattern.test(String(item.label || item.key || ""))));
  if (!row) return null;
  const max = Number(row.max || 20);
  const points = Number(row.points || 0);
  if (!Number.isFinite(points) || !Number.isFinite(max) || max <= 0) return null;
  return clampPercent((points / max) * 100);
}

function buildReadinessSignals({ snap, primaryMatch, recruiter, readinessScore, tr }) {
  const rows = snap.scoreBreakdown?.rows || [];
  const projects = findBreakdownValue(rows, [/project/i, /proje/i]);
  const experience = findBreakdownValue(rows, [/experience/i, /deneyim/i]);
  const leadership = findBreakdownValue(rows, [/leadership/i, /lider/i]);
  const communication = findBreakdownValue(rows, [/communication/i, /ileti/i]);
  const networking = findBreakdownValue(rows, [/network/i]);
  const fit = primaryMatch?.fitPercentage ?? primaryMatch?.roleFitScore;
  const recruiterConfidence = recruiter?.recruiterConfidence?.percent;
  const evidence = evidenceProfile(snap);

  const signals = [
    {
      label: tr ? "Kimlik Netliği" : "Identity",
      value: clampPercent(firstDefined(fit, readinessScore)),
    },
    {
      label: tr ? "Kanıt Gücü" : "Evidence",
      value: evidence.hasVerified
        ? clampPercent(average([projects, experience, recruiterConfidence].filter((v) => v != null)))
        : Math.min(45, clampPercent(average([projects, experience, recruiterConfidence].filter((v) => v != null)))),
    },
    {
      label: tr ? "Piyasa Hazırlığı" : "Market",
      value: clampPercent(average([readinessScore, communication, networking].filter((v) => v != null))),
    },
    {
      label: tr ? "Uygulama" : "Execution",
      value: clampPercent(average([projects, experience, leadership].filter((v) => v != null))),
    },
  ];

  return signals.map((signal) => ({
    ...signal,
    level: (signal.label === "Evidence" || signal.label === "Kanıt Gücü") && !evidence.hasVerified
      ? (tr ? "Beyan güçlü, kanıt sınırlı" : "Self-reported, limited proof")
      : levelFromScore(signal.value, tr),
  }));
}

function evidenceProfile(snap = {}) {
  const sources = new Set((snap.analysisSources || []).map((source) => String(source).toLowerCase()));
  const verified = ["cv", "linkedin", "github", "portfolio", "website", "behance", "dribbble"].filter((source) => sources.has(source));
  return {
    hasVerified: verified.length > 0,
    verifiedCount: verified.length,
    sourceCount: sources.size,
  };
}

function calibratedRecruiterConfidence(rawPercent, snap = {}) {
  const raw = Number(rawPercent);
  if (!Number.isFinite(raw)) return null;
  const evidence = evidenceProfile(snap);
  if (!evidence.hasVerified) return Math.min(raw, 39);
  if (evidence.verifiedCount === 1) return Math.min(raw, 72);
  return clampPercent(raw);
}

function confidenceEvidenceLabel(percent, snap = {}, tr) {
  const evidence = evidenceProfile(snap);
  if (!evidence.hasVerified) {
    return tr ? "Çoğunlukla beyana dayalı" : "Mostly self-reported";
  }
  if (percent < 40) return tr ? "Doğrulanmış kanıt sınırlı" : "Verified proof limited";
  return tr ? "Doğrulanmış kanıta dayalı" : "Based on verified evidence";
}

function cleanTurkishCopy(value, tr) {
  if (!tr) return String(value || "");
  return String(value || "")
    .replace(/Paydaş kapsamı kanıtı/gi, "Paydaş etkisi")
    .replace(/paydaş kapsamı kanıtı/gi, "paydaş etkisi")
    .replace(/ödünleşimleri/gi, "önceliklendirme kararlarını")
    .replace(/ödünleşimi/gi, "önceliklendirme kararını")
    .replace(/ödünleşim/gi, "önceliklendirme kararı")
    .replace(/yön verdiğin kararı/gi, "karar gerekçeni")
    .replace(/yön verdiğin karar/gi, "karar gerekçen");
}

function humanizeIdentityTitle(value, tr) {
  const raw = String(value || "").trim();
  if (!tr || !raw) return raw;
  return raw
    .replace(/Product Builder \+ Executor/gi, "Ürün odaklı uygulayıcı")
    .replace(/Builder \+ Strategist/gi, "Stratejik kurucu")
    .replace(/Operator \+ Analyst/gi, "Analitik operatör")
    .replace(/Startup Builder \+ Operator/gi, "Startup odaklı operatör");
}

function isFounderRole(roleName) {
  return /founder|kurucu|co[-\s]?founder|girişimci|girisimci/i.test(String(roleName || ""));
}

function jobRoleForFamily(family, tr) {
  const key = String(family || "").toUpperCase();
  const map = {
    PRODUCT: tr ? "Product Management Intern" : "Product Management Intern",
    OPERATIONS: tr ? "Startup Operations Intern" : "Startup Operations Intern",
    BUSINESS: tr ? "Strategy & Operations Intern" : "Strategy & Operations Intern",
    DATA: tr ? "Data Analyst Intern" : "Data Analyst Intern",
    SOFTWARE: tr ? "Software Engineering Intern" : "Software Engineering Intern",
    MARKETING: tr ? "Growth/Product Strategy Intern" : "Growth/Product Strategy Intern",
    HR: tr ? "People Operations Intern" : "People Operations Intern",
    FINANCE: tr ? "Finance Analyst Intern" : "Finance Analyst Intern",
  };
  return map[key] || (tr ? "Strategy & Operations Intern" : "Strategy & Operations Intern");
}

function roleDisplay(role, tr) {
  const raw = typeof role === "string" ? role : role?.roleName || role?.name || "";
  const display = getRoleDisplay(raw, tr ? "TR" : "EN");
  return {
    primary: display.primary || raw,
    secondary: display.secondary || "",
    explanation: display.explanation || "",
  };
}

function normalizeRoleForDisplay(role, snap, tr) {
  if (!role) return null;
  if (!isFounderRole(role.roleName || role.name)) return role;
  return {
    ...role,
    roleName: jobRoleForFamily(snap.roleFamily?.primary, tr),
    recommendationType: tr ? "Founder sinyalinden türetildi" : "Derived from founder signal",
    whyItFits: tr
      ? "Kurucu sinyali rol değil, kimlik sinyali olarak okunur; en yakın işe dönük hat operasyon/ürün stratejisidir."
      : "Founder reads as an identity signal, not a job role; the closest employable lane is operations/product strategy.",
  };
}

function displayRoleMatches(snap, tr) {
  const raw = (snap.topRoleMatches || snap.roleMatches || []).filter(Boolean);
  const cleaned = raw.filter((role) => !isFounderRole(role.roleName || role.name));
  const base = cleaned.length ? cleaned : raw.slice(0, 1).map((role) => normalizeRoleForDisplay(role, snap, tr));
  const seen = new Set();
  return base
    .map((role) => normalizeRoleForDisplay(role, snap, tr))
    .filter(Boolean)
    .filter((role) => {
      const name = String(role.roleName || role.name || "").toLowerCase();
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .slice(0, 3);
}

function gapFrame(rawGap, tr) {
  const raw = String(rawGap || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) {
    return {
      title: tr ? "Kanıt açığı" : "Proof gap",
      specific: tr ? "role özel kanıt" : "role-specific proof",
    };
  }

  if (/communication|ileti|headline|summary|position|pozisyon|story|hikaye|clarity|netlik/.test(lower)) {
    return { title: tr ? "Pozisyonlama açığı" : "Positioning gap", specific: cleanTurkishCopy(raw, tr) };
  }
  if (/experience|internship|work exposure|business exposure|deneyim|staj|network|market/.test(lower)) {
    return { title: tr ? "Pazar kanıtı açığı" : "Market evidence gap", specific: cleanTurkishCopy(raw, tr) };
  }
  if (/execution|delivery|process|operation|workflow|deploy|launch|ship|consistency/.test(lower)) {
    return { title: tr ? "Uygulama kanıtı açığı" : "Execution consistency gap", specific: cleanTurkishCopy(raw, tr) };
  }
  if (/role|target|direction|hedef/.test(lower)) {
    return { title: tr ? "Rol netliği açığı" : "Role clarity gap", specific: cleanTurkishCopy(raw, tr) };
  }
  return { title: tr ? "Kanıt açığı" : "Proof gap", specific: cleanTurkishCopy(raw, tr) };
}

function gapDisplay(rawGap, tr) {
  const framed = gapFrame(rawGap, tr);
  if (!framed.specific || framed.title === framed.specific) return framed.title;
  return `${framed.title}: ${framed.specific}`;
}

function sharpenAction({ nextMove, gapDetails, primaryMatch, tr }) {
  const raw = cleanTurkishCopy(String(nextMove || gapDetails?.action || "").trim(), tr);
  const role = primaryMatch?.roleName || (tr ? "hedef rol" : "target role");
  const gap = gapFrame(gapDetails?.title || primaryMatch?.missingSignals?.[0], tr);
  const lower = raw.toLowerCase();

  if (tr && /paydaş|karar|önceliklendirme/.test(lower)) {
    return "Bir ürün/strateji kararını problem → seçenekler → karar → sonuç formatında tek örnekle kanıtla.";
  }

  if (!raw || /improve|optimize|enhance|geliştir|iyileştir|daha iyi|strengthen/.test(lower)) {
    if (/case|business/.test(gap.specific.toLowerCase())) {
      return tr ? "1 sayfalık business case çalışması hazırla." : "Create a one-page business case.";
    }
    if (/sql|dashboard|analytics|data|veri/.test(gap.specific.toLowerCase())) {
      return tr ? "Tek sayfalık SQL/dashboard portfolyo örneği çıkar." : "Create one SQL/dashboard portfolio proof.";
    }
    if (/linkedin|position|communication|headline|summary/.test(gap.specific.toLowerCase())) {
      return tr ? "LinkedIn başlığını hedef role göre yeniden yaz." : "Rewrite your LinkedIn headline for the target role.";
    }
    if (/metric|impact|ölç|olc|kpi|outcome/.test(gap.specific.toLowerCase())) {
      return tr ? "En güçlü projen için tek ölçülebilir çıktı yaz." : "Write one measurable outcome for your strongest project.";
    }
    return tr ? `${role} için tek somut kanıt örneği oluştur.` : `Create one concrete proof point for ${role}.`;
  }

  return compactText(raw, 96);
}

function buildExecutiveCareerSummary({ identityTitle, primaryMatch, readinessScore, readinessLabel, strongestSignal, gapTitle, nextMove, snap, tr }) {
  const roleName = primaryMatch?.roleName || (tr ? "hedef rol" : "target role");
  const signal = strongestSignal || primaryMatch?.strongSignals?.[0] || (tr ? "henüz netleşen sinyal" : "emerging signal");
  const evidence = evidenceProfile(snap);
  const caveat = evidence.hasVerified
    ? ""
    : tr
      ? " Bu tahmin, çoğunlukla beyan edilen bilgilere dayanıyor."
      : " This estimate is mostly based on self-reported inputs.";

  if (!identityTitle && !primaryMatch && readinessScore == null) {
    return tr
      ? "Career DNA verilerin eksik. Doğruluğu artırmak için Career DNA'yı tamamla."
      : "Your Career DNA is incomplete. Complete your Career DNA to improve accuracy.";
  }

  if (tr) {
    return `Şu anki verilere göre ${identityTitle || "kariyer yönün"} ${roleName} hattına yakın okunuyor; en güçlü sinyal ${signal}. Hazırlık seviyesi ${readinessLabel}. En yüksek kaldıraçlı hamle: ${nextMove || `bu ${gapTitle} alanını tek kanıtla kapatmak`}.${caveat}`;
  }

  return `Based on current data, ${identityTitle || "your profile"} reads closest to ${roleName}; the strongest signal is ${signal}. Readiness is ${readinessLabel}. Highest-leverage move: ${nextMove || `close the ${gapTitle} with one proof point`}.${caveat}`;
}

function roleReason(role, tr, idx = 0, usedReasons = new Set()) {
  const roleName = role?.roleName || role?.name || (tr ? "bu rol" : "this role");
  const strong = [...new Set(role?.strongSignals || [])].filter(Boolean);
  const missing = [...new Set(role?.missingSignals || [])].filter(Boolean);
  const roleLower = String(roleName).toLowerCase();

  if (tr) {
    if ((/strategy|strateji/.test(roleLower) && /operations|operasyon/.test(roleLower)) || /strategy & operations/.test(roleLower)) {
      return "Teknoloji, girişimcilik ve strateji tercihlerinin birleşimi bu rolü en uygun kısa vadeli başlangıç yapıyor.";
    }
    if (/strategy|strateji/.test(roleLower)) {
      return "Problem çözme ve karar verme yönün strateji rollerine uyuyor; ancak ölçülebilir iş etkisi kanıtı güçlenmeli.";
    }
    if (/product management|ürün|urun/.test(roleLower)) {
      return "Ürün yöneticiliği sinyali var; ancak ürün kararı, kullanıcı problemi ve ölçülebilir sonuç kanıtı güçlenmeli.";
    }
    if (/business analyst|iş analizi|is analizi|analyst/.test(roleLower)) {
      return "MIS zemini ve analitik düşünme bu role uyuyor; eksik taraf ölçülebilir iş etkisi kanıtı.";
    }
  }

  const lenses = tr
    ? [
        (s) => `${s || "Seçtiğin hedef rol"} bu rol için başlangıç sinyali veriyor; daha güçlü kanıt gerekiyor.`,
        (s) => `${roleName} için ${s || "mevcut yönün"} okunuyor; eksik taraf bunu somut çıktıya bağlamak.`,
        (s) => `Bu eşleşme ${s || "Career DNA yönün"} üzerinden kuruluyor; eksik taraf ${missing[0] || "role özel kanıt"}.`,
      ]
    : [
        (s) => `${roleName} reads more credible because of ${s || "your current direction"}.`,
        (s) => `${s || "Your selected direction"} gives this role a readable starting proof point.`,
        (s) => `This match is built on ${s || "your Career DNA direction"}; the open question is ${missing[0] || "role-specific proof"}.`,
      ];
  const candidate = lenses[idx % lenses.length](strong[idx % Math.max(1, strong.length)]);
  if (!usedReasons.has(candidate)) {
    usedReasons.add(candidate);
    return compactText(candidate, 112);
  }
  if (role?.strongSignals?.length) {
    const signals = role.strongSignals.slice(0, 2).join(tr ? " ve " : " and ");
    return tr ? `${signals} bu rol için okunabilir kanıt yaratıyor.` : `${signals} creates readable proof for this role.`;
  }
  if (role?.missingSignals?.length) {
    return tr
      ? `${role.missingSignals[0]} güçlenirse bu eşleşme daha güvenilir olur.`
      : `${role.missingSignals[0]} would make this match more defensible.`;
  }
  return tr ? "Bu rol mevcut Career DNA sinyallerinle en yakın hatlardan biri." : "This is one of the closest lanes in your Career DNA.";
}

function buildSevenDayMissions({ primaryMatch, gapDetails, nextMove, readinessScore, tr }) {
  const role = compactText(primaryMatch?.roleName || (tr ? "hedef rol" : "target role"), 32);
  const gap = compactText(gapDisplay(gapDetails.title, tr), 28);
  const action = nextMove || gapDetails.action || (tr ? "tek kanıt noktası oluştur" : "create one proof point");
  const lowReadiness = Number(readinessScore || 0) < 60;
  const missions = tr
    ? [
        `${role} için tek cümlelik hedef yaz.`,
        `${gap} için eksik kanıtı seç.`,
        "Bir kararını problem → karar → sonuç formatında yaz.",
        `3 ${role} ilanındaki ortak beklentileri çıkar.`,
        "En güçlü kanıtına tek ölçü veya çıktı ekle.",
        "Bu kanıtı LinkedIn/CV özetine ekle.",
        lowReadiness ? "Eksik profil alanını tamamla." : "CV analizini çalıştırıp varsayımları doğrula.",
      ]
    : [
      `Write one positioning line for ${role}.`,
      `Choose the missing proof behind ${gap}.`,
      compactText(action, 70),
      `Extract 3 repeated requirements from ${role} job posts.`,
      `Rewrite your strongest proof with one output or metric.`,
      `Add that proof to your LinkedIn/CV summary in one sentence.`,
      lowReadiness ? "Complete one missing profile field to improve accuracy." : "Run CV analysis to validate these assumptions.",
    ];
  return [...new Set(missions.filter(Boolean))].slice(0, 7);
}

function ExecutiveSummary({ snap, primaryMatch, recruiter, potentialScore, readinessLabel, gapDetails, nextMove, tr }) {
  const rawConfidence = recruiter?.recruiterConfidence?.percent ?? snap.careerOsHome?.confidence?.percent;
  const confidencePercent = calibratedRecruiterConfidence(rawConfidence, snap);
  const fit = primaryMatch?.fitPercentage ?? primaryMatch?.roleFitScore;
  const cards = [
    {
      label: tr ? "Kariyer Potansiyeli" : "Career Potential",
      value: potentialScore != null ? `${Math.round(potentialScore)} / 100` : "—",
      note: tr ? "Profil potansiyeli" : "Profile potential",
    },
    {
      label: tr ? "Recruiter Güven Skoru" : "Recruiter Confidence",
      value: confidencePercent != null ? `${Math.round(confidencePercent)}%` : "—",
      note: confidenceEvidenceLabel(confidencePercent ?? 0, snap, tr),
    },
    {
      label: tr ? "En Uygun Kısa Vadeli Rol" : "Best Near-Term Role",
      value: roleDisplay(primaryMatch?.roleName || snap.careerOsHome?.topRoleMatch?.value, tr).primary || "—",
      note: fit != null ? `${Math.round(fit)}% ${tr ? "rol uyumu" : "role fit"}` : "",
    },
    {
      label: tr ? "En Büyük Açık" : "Biggest Gap",
      value: gapDisplay(gapDetails.title || snap.biggestGap, tr),
      note: tr ? "En büyük eksik kanıt" : "Main missing proof",
    },
    {
      label: tr ? "Sonraki Kilit Hamle" : "Next Unlock",
      value: snap.expectedScoreIncrease ? `+${snap.expectedScoreIncrease} ${tr ? "Kariyer Potansiyeli" : "Career Potential"}` : compactText(nextMove, 34) || "—",
      note: readinessLabel,
    },
  ];

  return (
    <section className="hf-snap-wow__summary" aria-label="Executive summary">
      {cards.map((card) => (
        <article key={card.label} className="hf-snap-wow__summary-card">
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          {card.note ? <em>{card.note}</em> : null}
        </article>
      ))}
    </section>
  );
}

function SnapshotFirstView({ identityTitle, primaryMatch, displayedGap, nextMove, tr }) {
  const display = roleDisplay(primaryMatch, tr);
  const fit = primaryMatch?.fitPercentage ?? primaryMatch?.roleFitScore;
  const blocks = [
    {
      label: tr ? "Kariyer Kimliğin" : "Career Identity",
      value: identityTitle || (tr ? "Career DNA tamamlandıkça netleşir" : "Clarifies as Career DNA completes"),
      note: tr ? "Seni ilk okuduğumuz yön" : "How your profile first reads",
    },
    {
      label: tr ? "En Uygun Rol Yönün" : "Best Role Direction",
      value: display.primary || "—",
      note: fit != null ? `${Math.round(clampPercent(fit))}% ${tr ? "rol uyumu" : "role fit"}` : display.secondary,
    },
    {
      label: tr ? "Geliştirmen Gereken En Önemli Alan" : "Main Area To Improve",
      value: displayedGap || (tr ? "Kanıt netliği" : "Proof clarity"),
      note: tr ? "Şu an seni en çok yavaşlatan alan" : "Current highest-friction area",
    },
    {
      label: tr ? "Sonraki En İyi Hamle" : "Next Best Move",
      value: nextMove || (tr ? "Tek somut kanıt ekle" : "Add one concrete proof point"),
      note: tr ? "Bugün başlayabileceğin hamle" : "Action you can start today",
    },
  ];

  return (
    <section className="hf-snap-wow__first-view" aria-label={tr ? "Career Snapshot ilk özet" : "Career Snapshot first summary"}>
      {blocks.map((block) => (
        <article key={block.label} className="hf-snap-wow__first-card">
          <span>{block.label}</span>
          <strong>{block.value}</strong>
          <small>{block.note}</small>
        </article>
      ))}
    </section>
  );
}

function SnapshotTabs({ tabs, active, onChange, panelId, tr }) {
  return (
    <div className="hf-snap-wow__tabs" role="tablist" aria-label={tr ? "Snapshot detayları" : "Snapshot details"}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`${panelId}-${tab.id}`}
          className={`hf-snap-wow__tab${active === tab.id ? " is-active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function CareerSnapshotWow({ snapshot, lang = "TR", localCvPending = false }) {
  const tr = lang === "TR";
  const tabsId = useId();
  const [activeTab, setActiveTab] = useState("overview");
  const snap = snapshot || {};
  const identityWow = snap.identityWow || {};
  const recruiter = buildRecruiterViewFromSnapshot(snap, lang);
  const rawTopRoles = displayRoleMatches(snap, tr);
  const topRoles = rawTopRoles.length ? rawTopRoles : [];
  const primaryMatch = normalizeRoleForDisplay(snap.primaryRoleMatch || topRoles[0], snap, tr);
  if (primaryMatch && topRoles.length && primaryMatch.roleName !== topRoles[0].roleName && !isFounderRole(topRoles[0].roleName)) {
    topRoles.unshift(primaryMatch);
    topRoles.splice(3);
  }
  const potentialScore = snap.readinessScore ?? snap.currentReadiness;
  const rawConfidence = recruiter?.recruiterConfidence?.percent ?? snap.careerOsHome?.confidence?.percent;
  const confidencePercent = calibratedRecruiterConfidence(rawConfidence, snap);
  const roleFit = primaryMatch?.fitPercentage ?? primaryMatch?.roleFitScore;
  const readinessScore = practicalReadinessScore(potentialScore, confidencePercent, roleFit, snap);
  const readinessLabel = consistentReadinessStage(readinessScore, confidencePercent, roleFit, tr);
  const gapDetails = snap.gapDetails || {};
  const rawNextMove = snap.suggestedNextMove || snap.recommendedNextMove || gapDetails.action || "";
  const rawIdentityTitle = identityWow.title || snap.careerIdentityTitle || snap.careerIdentity;
  const identityTitle = humanizeIdentityTitle(rawIdentityTitle, tr);
  const secondarySignal = snap.strongestSignal || primaryMatch?.strongSignals?.[0] || (tr ? "Henüz net değil" : "Not clear yet");
  const displayedGap = gapDisplay(gapDetails.title || snap.biggestGap || primaryMatch?.missingSignals?.[0], tr);
  const positioningRisk = displayedGap || (tr ? "Doğruluk için daha fazla veri gerekli" : "More data needed for accuracy");
  const nextMove = sharpenAction({ nextMove: rawNextMove, gapDetails, primaryMatch, tr });
  const summary = buildExecutiveCareerSummary({
    identityTitle,
    primaryMatch,
    readinessScore,
    readinessLabel,
    strongestSignal: secondarySignal,
    gapTitle: displayedGap,
    nextMove,
    snap,
    tr,
  });
  const trustNote = localCvPending
    ? (tr
      ? "Bu Snapshot, Career DNA cevapların ve yerel CV durumuna göre oluşturuldu. CV analizi tamamlandığında recruiter güven skoru netleşir."
      : "This Snapshot is based on your Career DNA answers and local CV state. Recruiter confidence will become clearer after CV analysis.")
    : "";
  const readinessSignals = buildReadinessSignals({
    snap,
    primaryMatch,
    recruiter: {
      ...recruiter,
      recruiterConfidence: {
        ...(recruiter?.recruiterConfidence || {}),
        percent: confidencePercent,
      },
    },
    readinessScore,
    tr,
  });
  const missions = buildSevenDayMissions({ primaryMatch, gapDetails, nextMove, readinessScore, tr });
  const usedRoleReasons = new Set();
  const snapshotTabs = [
    { id: "overview", label: tr ? "Genel Bakış" : "Overview" },
    { id: "roles", label: tr ? "Rol Yönleri" : "Role Directions" },
    { id: "readiness", label: tr ? "Hazırlık" : "Readiness" },
    { id: "evidence", label: tr ? "Kanıtlar" : "Evidence" },
    { id: "details", label: tr ? "Detaylar" : "Details" },
  ];

  return (
    <div className="hf-snap-wow">
      <SnapshotFirstView
        identityTitle={identityTitle}
        primaryMatch={primaryMatch}
        displayedGap={displayedGap}
        nextMove={nextMove}
        tr={tr}
      />

      <SnapshotTabs
        tabs={snapshotTabs}
        active={activeTab}
        onChange={setActiveTab}
        panelId={tabsId}
        tr={tr}
      />

      <div
        id={`${tabsId}-${activeTab}`}
        className="hf-snap-wow__tab-panel"
        role="tabpanel"
      >
      {activeTab === "overview" ? (
      <>
        <ExecutiveSummary
          snap={snap}
          primaryMatch={primaryMatch}
          recruiter={recruiter}
          potentialScore={potentialScore}
          readinessLabel={readinessLabel}
          gapDetails={gapDetails}
          nextMove={nextMove}
          tr={tr}
        />

        <section className="hf-snap-wow__block hf-snap-wow__block--brief">
        <div className="hf-snap-wow__block-head">
          <Compass size={15} />
          <span className="hf-snap-wow__label">{tr ? "Yönetici Özeti" : "Executive Career Summary"}</span>
        </div>
        <p className="hf-snap-wow__summary-text">{summary}</p>
        {trustNote ? <p className="hf-snap-wow__trust-note">{trustNote}</p> : null}
      </section>

      <section className="hf-snap-wow__block hf-snap-wow__identity-card">
        <span className="hf-snap-wow__label">{tr ? "Kariyer Kimliği" : "Career Identity"}</span>
          <strong className="hf-snap-wow__title">{identityTitle || "Complete your Career DNA to improve accuracy."}</strong>
        <div className="hf-snap-wow__identity-grid">
          <span>
            <small>{tr ? "İkincil Sinyal" : "Secondary Signal"}</small>
            <b>{secondarySignal}</b>
          </span>
          <span>
            <small>{tr ? "Pozisyonlama Riski" : "Positioning Risk"}</small>
            <b>{positioningRisk}</b>
          </span>
        </div>
        {identityWow.narrative ? <p className="hf-snap-wow__prose">{compactText(identityWow.narrative, 170)}</p> : null}
      </section>
      </>
      ) : null}

      {activeTab === "roles" && topRoles.length ? (
        <section className="hf-snap-wow__block">
          <div className="hf-snap-wow__block-head">
            <Target size={15} />
            <span className="hf-snap-wow__label">{tr ? "En Uygun Kısa Vadeli Rol" : "Best Near-Term Role"}</span>
          </div>
          <div className="hf-snap-wow__role-list">
            {topRoles.map((role, idx) => {
              const pct = role.fitPercentage != null ? clampPercent(role.fitPercentage) : clampPercent(role.roleFitScore);
              const display = roleDisplay(role, tr);
              return (
                <article key={`${role.roleName || role.name}-${idx}`} className="hf-snap-wow__role-row">
                  <div>
                    <div className="hf-snap-wow__role-row-head">
                      <strong>{display.primary}</strong>
                      {idx === 0 ? <span>{tr ? "En güçlü eşleşme" : "Top match"}</span> : null}
                    </div>
                    {tr && display.secondary && display.secondary !== display.primary ? (
                      <small className="hf-snap-wow__role-secondary">{display.secondary}</small>
                    ) : null}
                    {display.explanation ? (
                      <p className="hf-snap-wow__role-explanation">{display.explanation}</p>
                    ) : null}
                    <p>{roleReason(role, tr, idx, usedRoleReasons)}</p>
                    <p className="hf-snap-wow__role-missing">
                      <b>{tr ? "Eksik:" : "Missing:"}</b>{" "}
                      {cleanTurkishCopy(role?.missingSignals?.[0] || (tr ? "Ölçülebilir iş etkisini daha görünür kılman gerekiyor." : "Make measurable business impact more visible."), tr)}
                    </p>
                  </div>
                  <b>{pct}%</b>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeTab === "readiness" && readinessScore != null ? (
        <section className="hf-snap-wow__block hf-snap-wow__readiness-card">
          <div className="hf-snap-wow__block-head">
            <TrendingUp size={15} />
            <span className="hf-snap-wow__label">{tr ? "Kariyer Hazırlığı" : "Career Readiness"}</span>
          </div>
          <div className="hf-snap-wow__readiness-hero">
            <strong>{Math.round(readinessScore)} / 100</strong>
            <span>{readinessLabel}</span>
          </div>
          <div className="hf-snap-wow__signal-grid">
            {readinessSignals.map((signal) => (
              <div key={signal.label} className="hf-snap-wow__signal">
                <div>
                  <span>{signal.label}</span>
                  <b>{signal.level}</b>
                </div>
                <i aria-hidden><em style={{ width: `${signal.value}%` }} /></i>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "evidence" && (gapDetails.title || snap.biggestGap) ? (
        <section className="hf-snap-wow__block hf-snap-wow__gap-card">
          <div className="hf-snap-wow__block-head">
            <AlertTriangle size={15} />
            <span className="hf-snap-wow__label">{tr ? "En Büyük Açık" : "Biggest Gap"}</span>
          </div>
          <strong>{displayedGap}</strong>
          <p>{compactText(cleanTurkishCopy(gapDetails.evidenceMissing || gapDetails.whyItMatters || (tr ? "Bu eksik, role özel güvenin hızlı oluşmasını yavaşlatıyor." : "This slows role-specific trust during the first read."), tr), 150)}</p>
        </section>
      ) : null}

      {activeTab === "evidence" && nextMove ? (
        <section className="hf-snap-wow__block hf-snap-wow__block--next">
          <div className="hf-snap-wow__block-head">
            <Zap size={15} />
            <span className="hf-snap-wow__label">{tr ? "Sonraki Kilit Hamle" : "Next Unlock"}</span>
          </div>
          <strong className="hf-snap-wow__unlock-title">{nextMove}</strong>
          <p className="hf-snap-wow__unlock-action">
            {compactText(cleanTurkishCopy(gapDetails.whyItMatters || (tr ? "Recruiter güvenini en hızlı artıracak eksik kanıt, kararlarının kimleri etkilediğini ve nasıl sonuç ürettiğini göstermendir." : "This targets the main limiter, so it should raise recruiter confidence fastest."), tr), 160)}
          </p>
        </section>
      ) : null}

      {activeTab === "details" && missions.length ? (
        <section className="hf-snap-wow__block">
          <div className="hf-snap-wow__block-head">
            <CheckCircle2 size={15} />
            <span className="hf-snap-wow__label">{tr ? "7 Günlük İlk Değer Planı" : "7-Day First Value Loop"}</span>
          </div>
          <div className="hf-snap-wow__mission-list">
            {missions.map((mission, idx) => (
              <article key={`${idx}-${mission}`} className="hf-snap-wow__mission">
                <span>{tr ? `Gün ${idx + 1}` : `Day ${idx + 1}`}</span>
                <strong>{mission}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      </div>
    </div>
  );
}

export default CareerSnapshotWow;

