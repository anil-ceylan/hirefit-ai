/**
 * When the JD explicitly enumerates accepted departments/majors and the CV's stated
 * field of study does not match any listed option, prepend a high-severity gap.
 * If the JD only says "relevant departments" (or similar) without an explicit list, no-op.
 */

const EN_PROGRAMS = [
  "electrical engineering",
  "electronics engineering",
  "computer engineering",
  "computer science",
  "software engineering",
  "mechanical engineering",
  "industrial engineering",
  "chemical engineering",
  "civil engineering",
  "aerospace engineering",
  "biomedical engineering",
];

const TR_PROGRAMS = [
  "bilgisayar mühendisliği",
  "elektrik mühendisliği",
  "elektronik mühendisliği",
  "yazılım mühendisliği",
  "endüstri mühendisliği",
  "makine mühendisliği",
  "kimya mühendisliği",
  "inşaat mühendisliği",
  "elektrik-elektronik mühendisliği",
];

function normalizeToken(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]/g, "")
    .trim();
}

/** JD says "relevant departments" (or similar) but never lists concrete majors — do not flag */
function isJdWithoutExplicitDepartmentList(jd) {
  const t = String(jd || "");
  const vague = /\b(relevant|related|appropriate|suitable|uygun|ilişkili)\s+(departments?|majors?|programs?|bölüm|alanlar?)\b/i.test(t);
  if (!vague) return false;
  return !hasEnumeratedDepartmentLine(t);
}

function hasEnumeratedDepartmentLine(t) {
  const lines = t.split(/\n|;/);
  for (const line of lines) {
    const commaCount = (line.match(/,/g) || []).length;
    if (commaCount < 1) continue;
    const hits = countDepartmentKeywords(line);
    if (hits >= 2) return true;
  }
  if (/\b(?:departments?|majors?|bölüm(?:ler)?|programs?)\s*[:.\-–—]\s*[^.\n]{15,}/i.test(t)) {
    const seg = t.match(/\b(?:departments?|majors?|bölüm(?:ler)?|programs?)\s*[:.\-–—]\s*([^\n.]+)/i);
    if (seg && seg[1]) {
      const parts = seg[1].split(/,|\/|\||\s+and\s+|\s+or\s+|\s+veya\s+/i).map((x) => x.trim()).filter(Boolean);
      const deptHits = parts.filter((p) => countDepartmentKeywords(p) >= 1);
      return deptHits.length >= 2;
    }
  }
  return false;
}

function countDepartmentKeywords(line) {
  const low = line.toLowerCase();
  let n = 0;
  for (const p of [...EN_PROGRAMS, ...TR_PROGRAMS]) {
    if (low.includes(p)) n++;
  }
  return Math.min(n, 4);
}

function extractEnumeratedDepartments(jd) {
  const t = String(jd || "");
  const out = new Set();

  const labeled = t.match(
    /\b(?:departments?|majors?|programs?|bölüm(?:ler)?|üniversite\s+bölüm(?:ler)?)\s*[:.\-–—]\s*([^\n]+?)(?:\n\n|\.(?:\s|$)|$)/i
  );
  const segment = labeled ? labeled[1] : t;

  const parts = segment.split(/,|\/|\||;|(?:\s+and\s+)|(?:\s+or\s+)|(?:\s+veya\s+)/i);
  for (let p of parts) {
    p = p.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, "").trim();
    if (p.length < 8 || p.length > 120) continue;
    if (countDepartmentKeywords(p) < 1) continue;
    if (/\b(relevant|related|appropriate|other)\b/i.test(p) && !/\b(engineering|mühendis|science)\b/i.test(p)) continue;
    out.add(normalizeToken(p));
  }

  const arr = [...out].filter(Boolean);
  return arr.length >= 2 ? arr : [];
}

function extractDegreeContext(cv) {
  const c = String(cv || "");
  const eduIdx = c.search(/\b(Education|Eğitim|Academic|Akademik)\b/i);
  const slice = eduIdx >= 0 ? c.slice(eduIdx, eduIdx + 1200) : c.slice(0, 2000);
  const lines = slice.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const hit = lines.find((l) =>
    /\b(Bachelor|B\.?Sc|BSc|Master|MSc|M\.?Sc|PhD|Doctor|Lisans|Yüksek\s+Lisans|Önlisans|Associate|Degree|Diploma|Mühendisliği|University|Üniversite|Faculty|Fakülte)\b/i.test(l)
  );
  return hit || (lines.length ? lines.slice(0, 5).join(" ") : "");
}

function degreeMatchesListedPrograms(cvContextNorm, listed) {
  const cv = normalizeToken(cvContextNorm);
  if (!cv) return true;
  for (const prog of [...EN_PROGRAMS, ...TR_PROGRAMS]) {
    if (!listed.some((l) => l.includes(prog))) continue;
    if (cv.includes(prog)) return true;
  }
  for (const item of listed) {
    const words = item.split(/\s+/).filter((w) => w.length > 3);
    if (words.length && words.every((w) => cv.includes(w.toLowerCase()))) return true;
  }
  return false;
}

function shortenDegreeLabel(ctx) {
  const oneLine = String(ctx || "").replace(/\s+/g, " ").trim();
  return oneLine.length > 90 ? `${oneLine.slice(0, 87)}…` : oneLine || "stated education";
}

export function applyDegreeDepartmentCheck(cvText, jobDescription, gapResult, langNorm = "en") {
  const jd = String(jobDescription || "");
  const cv = String(cvText || "");
  const base = gapResult && typeof gapResult === "object" ? { ...gapResult } : { rejection_reasons: [], biggest_gap: "" };

  if (isJdWithoutExplicitDepartmentList(jd)) {
    return base;
  }

  const departments = extractEnumeratedDepartments(jd);
  if (departments.length < 2) {
    return base;
  }

  const degreeCtx = extractDegreeContext(cv);
  if (!degreeCtx) {
    return base;
  }

  if (degreeMatchesListedPrograms(degreeCtx, departments)) {
    return base;
  }

  const label = shortenDegreeLabel(degreeCtx);
  const issueEn = `This role requires an engineering degree from specific departments. Your ${label} may not meet this requirement — verify before applying.`;
  const issueTr = `Bu rol belirli bölümlerden diploma/mezuniyet şartı koyuyor. CV'nizde görünen eğitim (${label}) bu kapsamda olmayabilir — başvurmadan önce ilan şartlarını doğrulayın.`;

  const issue = {
    issue: langNorm === "tr" ? issueTr : issueEn,
    impact: "high",
    explanation: langNorm === "tr" ? issueTr : issueEn,
  };

  const reasons = Array.isArray(base.rejection_reasons) ? [...base.rejection_reasons] : [];
  const dup = reasons.some((r) => String(r?.issue || "").includes("specific departments") || String(r?.issue || "").includes("belirli bölüm"));
  if (!dup) {
    reasons.unshift(issue);
  }

  return {
    ...base,
    rejection_reasons: reasons.slice(0, 12),
    biggest_gap: base.biggest_gap || issue.issue,
  };
}
