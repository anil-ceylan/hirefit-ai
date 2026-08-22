import { includesLookingFor, getRoleLabel, normalizeRoleList } from "./industries.js";

/**
 * Personalized analysis lines from onboarding profile (not used for scoring).
 * Gender is never read here.
 */

function tr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

function norm(s) {
  return String(s || "").toLowerCase();
}

function jdMentionsRole(jd, role) {
  const j = norm(jd);
  const r = norm(role);
  if (!j || !r) return false;
  if (r.includes("product") && /product|ürün|urun|pm\b/i.test(j)) return true;
  if (r.includes("data") && /data|veri|analyst|analiz/i.test(j)) return true;
  if (r.includes("growth") && /growth|büyüme|buyume/i.test(j)) return true;
  if (r.includes("business") && /business analyst|iş analiz|is analiz/i.test(j)) return true;
  if (r.includes("software") && /software|engineer|developer|yazılım/i.test(j)) return true;
  return j.includes(r.split(" ")[0]);
}

export function buildPersonalizedOnboardingInsights({
  profile = null,
  roleType = "",
  jdText = "",
  engineV2 = null,
  lang = "TR",
}) {
  if (!profile?.onboarding_completed) return null;
  const isTr = tr(lang);
  const goals = profile.career_goals || {};
  const basic = profile.basic_profile || {};
  const targetRoles = normalizeRoleList(goals.targetRoles || profile.target_roles || []);
  const jd = String(jdText || "");
  const posting = String(roleType || engineV2?.RoleFit?.best_role || "");

  const lines = [];
  const roleLine = targetRoles
    .slice(0, 2)
    .map((r) => getRoleLabel(r, lang))
    .join(" / ");
  if (roleLine && (jdMentionsRole(jd, targetRoles[0]) || jdMentionsRole(posting, targetRoles[0]))) {
    lines.push(
      isTr
        ? `Bu ilan senin hedeflediğin ${roleLine} hattına yakın.`
        : `This posting is close to your target lane: ${roleLine}.`
    );
  }

  const lookingFor = goals.lookingFor;
  const prefLoc = goals.preferredLocation || goals.workMode || [];
  const city = basic.city || "";
  if (includesLookingFor(goals, "internship") && city && (prefLoc.includes("local") || prefLoc.includes("country"))) {
    lines.push(
      isTr
        ? `Sen ${city}'de yaz stajı aradığın için bu rol konum açısından uygun görünüyor.`
        : `You are looking for a summer internship in ${city}, so location fit looks reasonable.`
    );
  } else if (prefLoc.includes("remote") && /remote|uzaktan|hybrid/i.test(jd)) {
    lines.push(isTr ? "Uzaktan çalışma tercihinle bu ilan örtüşüyor." : "Remote preference aligns with this posting.");
  }

  const strong = profile.strong_signals || [];
  const weak = profile.weak_signals || [];
  const missingKw = (engineV2?.ATS?.missing_keywords || []).slice(0, 2);
  if (strong.length) {
    const s0 = strong[0];
  if (/product|ürün|founder|ownership/i.test(s0) && missingKw.some((k) => /user research|prd|roadmap/i.test(k))) {
      lines.push(
        isTr
          ? `CV'n Product tarafına güçlü ama ${missingKw.find((k) => /user research|prd|roadmap/i.test(k)) || "User Research"} kanıtın zayıf.`
          : `Your CV reads strong on product, but evidence for ${missingKw.find((k) => /user research|prd|roadmap/i.test(k)) || "User Research"} is thin.`
      );
    } else if (weak[0]) {
      lines.push(
        isTr
          ? `Profiline göre güçlü yan: ${s0}. Gelişim alanı: ${weak[0].replace(/ gelişim alanı/i, "")}.`
          : `Profile strength: ${s0}. Growth area: ${weak[0].replace(/ growth area/i, "")}.`
      );
    }
  }

  if (!lines.length) return null;

  return {
    title: isTr ? "KİŞİSEL KARİYER UYUMU" : "PERSONALIZED CAREER FIT",
    subtitle: isTr
      ? "Hedeflerin ve Career Profile'ın bu analize göre yorumlandı."
      : "Your goals and Career Profile shaped this read.",
    lines: lines.slice(0, 4),
    identity: profile.career_identity || "",
    nextMove: profile.recommended_next_move || "",
  };
}

export function buildOnboardingPromptBlock(profile) {
  if (!profile?.onboarding_completed) return "";
  const goals = profile.career_goals || {};
  const basic = profile.basic_profile || {};
  return `
USER CAREER PROFILE (personalization only — do not use gender for scoring or hiring decisions):
- Identity: ${profile.career_identity || "—"}
- Goals: ${(goals.targetRoles || []).join(", ")} | ${goals.seniority || "—"} | ${goals.lookingFor || "—"}
- Location: ${basic.city || ""}, ${basic.country || ""} | Pref: ${(goals.preferredLocation || []).join(", ")}
- Industries: ${(goals.industries || profile.industries || []).join(", ")}
- Strong: ${(profile.strong_signals || []).join(", ")}
- Weak: ${(profile.weak_signals || []).join(", ")}
Align recommendations with stated goals; never discriminate.`;
}
