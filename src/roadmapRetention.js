import { parseRoadmapStepDescription } from "./roadmapUtils";

export const LS_PROGRESS = "hirefit-progress";
export const LS_DAILY = "hirefit-daily";
export const LS_STREAK = "hirefit-streak";
export const LS_ROADMAP_XP = "hirefit-roadmap-xp";
export const LS_FOCUS_JOB = "hirefit-job";

export function loadRoadmapXp(planKey) {
  const pk = planKey || "";
  try {
    const raw = localStorage.getItem(LS_ROADMAP_XP);
    if (!raw) return { total: 0, planKey: pk };
    const j = JSON.parse(raw);
    if (typeof j.total !== "number") return { total: 0, planKey: pk };
    if (j.planKey !== pk) return { total: 0, planKey: pk };
    return { total: j.total, planKey: pk };
  } catch {
    return { total: 0, planKey: pk };
  }
}

export function bumpRoadmapXp(planKey, delta = 10) {
  const pk = planKey || "";
  const prev = loadRoadmapXp(pk);
  const next = { total: prev.planKey === pk ? prev.total + delta : delta, planKey: pk };
  try {
    localStorage.setItem(LS_ROADMAP_XP, JSON.stringify(next));
  } catch {}
  return next;
}

const ROADMAP_TITLE_HINT =
  /roadmap|yol haritası|learning path|learning plan|kariyer plan|30\s*-?\s*day|90\s*-?\s*day|haftalık|weekly|program|bootcamp|sprint/i;

export function looksLikeGenericRoadmapTitle(title) {
  const t = (title || "").trim();
  if (t.length < 4) return true;
  if (ROADMAP_TITLE_HINT.test(t)) return true;
  if (t.length > 72) return true;
  return false;
}

/** Strip "Resource:" / "Kaynak:" style prefixes for display. */
export function stripResourceLabelPrefix(s) {
  return String(s || "")
    .replace(/\*\*/g, "")
    .replace(/^(?:resource|kaynak|kurs|course|material|reading|okuma)\s*[:：]\s*/i, "")
    .trim();
}

function clipLen(s, max) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** Time suffix from parsed hours or default 30–45 min window. */
export function actionTimeSuffix(parsed, lang) {
  const h = (parsed.hours || "").trim();
  if (h && /min|dk|saat|hour|h\b|wk|week|hafta|dakika/i.test(h))
    return lang === "TR" ? ` (${h})` : ` (${h})`;
  return lang === "TR" ? " (30 dk)" : " (30 min)";
}

/** One specific, measurable learn line from step context (no vague “focus 30 min”). */
export function concreteLearnMicroLine(parsed, step, lang, timeSuffix) {
  const blob = `${step.title || ""} ${parsed.resource || ""} ${parsed.description || ""}`.toLowerCase();
  if (/excel|spreadsheet|sheet|tablo|xlsx/i.test(blob))
    return lang === "TR"
      ? `1–2 dersi bitir ve basit bir Excel çizelgesi oluştur${timeSuffix}`
      : `Complete lessons 1–2 and create one simple Excel sheet${timeSuffix}`;
  if (/sql|python|code|kod|sorgu/i.test(blob))
    return lang === "TR"
      ? `Ders 1–2'yi bitir ve tek küçük sorgu veya script teslim et${timeSuffix}`
      : `Finish lessons 1–2 and submit one short query or script${timeSuffix}`;
  if (/marketing|seo|content|içerik|pazarlama/i.test(blob))
    return lang === "TR"
      ? `İlk 2 modülü bitir ve tek bir taslak çıktı yaz${timeSuffix}`
      : `Finish modules 1–2 and write one draft deliverable${timeSuffix}`;
  return lang === "TR"
    ? `Ders 1–2'yi bitir ve tek somut mini çıktı teslim et${timeSuffix}`
    : `Complete lessons 1–2 and ship one tangible mini deliverable${timeSuffix}`;
}

/** Mock “ahead of X%” for social proof (replace with real stats later). */
export function mockCandidateAheadPercentile(progressPct, tasksCompleted) {
  const base = 54 + Math.min(36, Math.round(progressPct * 0.36));
  const bump = tasksCompleted > 0 ? Math.min(8, 2 + Math.floor(tasksCompleted / 3)) : 0;
  return Math.min(94, base + bump);
}

/** Short, verb-led micro-action for roadmap / daily (< ~45 min). */
export function microFromBulletLabel(raw, lang, parsed = {}) {
  let t = stripResourceLabelPrefix(raw).replace(/\*\*/g, "").trim();
  if (!t) return lang === "TR" ? "25 dk tek bir küçük görev yap" : "Do one focused task (25 min)";
  const time = actionTimeSuffix(parsed, lang);
  const dot = t.search(/[.!?]/);
  let sentence = (dot === -1 ? t : t.slice(0, dot + 1)).trim();
  sentence = clipLen(sentence, 88);
  if (/\(\s*\d/.test(sentence)) return sentence;
  if (/^(complete|watch|read|do|practice|build|write|schedule|finish|tamamla|izle|oku|yap|çalış|bitir|start|başla)/i.test(sentence)) {
    return /\(/.test(sentence) ? sentence : `${sentence.replace(/\.$/, "")}${time}`;
  }
  if (/excel|sheet|sql|python|tableau|power\s*bi|lesson|module|unit|ders|modül|bölüm/i.test(t)) {
    return lang === "TR"
      ? `${clipLen(sentence, 72)} — ilk bölümü bitir${time}`
      : `Watch / complete the first section: ${clipLen(sentence, 72)}${time}`;
  }
  return lang === "TR"
    ? `${clipLen(sentence, 80)} — bugün bitir${time}`
    : `Complete today: ${clipLen(sentence, 80)}${time}`;
}

const PRACTICE_HINT =
  /pratik|practice|exercise|exercises|drill|problem\s*set|alıştırma|quiz|test\b|repeat|reps/i;
const APPLY_HINT =
  /apply|bağla|ilan|job\s*post|posting|project|portfolio|interview|network|başvur|proje|örnek|real\s*world/i;
const LEARN_HINT = /watch|read|lesson|lessons|course|video|module|unit|ders|oku|izle|learn|study|tutorial|resource/i;

/** Classify a bullet into learn | practice | apply (no duplicates across buckets — first wins in builder). */
export function classifyBulletKind(raw) {
  const t = stripResourceLabelPrefix(raw).toLowerCase();
  if (APPLY_HINT.test(t)) return "apply";
  if (PRACTICE_HINT.test(t)) return "practice";
  if (LEARN_HINT.test(t)) return "learn";
  return "learn";
}

/**
 * One clean line per bucket for this step (max ~1 line each, deduped).
 * @returns {{ learn: string, practice: string, apply: string }}
 */
export function buildStepLearnPracticeApply(step, stepIndex, lang) {
  const parsed = parseRoadmapStepDescription(step.description);
  const time = actionTimeSuffix(parsed, lang);
  const defaults = {
    learn: concreteLearnMicroLine(parsed, step, lang, time),
    practice:
      lang === "TR"
        ? `5 tekrar bitir, kanıtı notlara kaydet (15–20 dk)${time}`
        : `Complete 5 practice reps and save proof in your notes (15–20 min)${time}`,
    apply:
      lang === "TR"
        ? `Gerçek bir ilana tek paragraflık bağlantı yaz (15 dk)`
        : `Write one paragraph linking this step to a real job post (15 min)`,
  };
  const buckets = { learn: "", practice: "", apply: "" };

  if (parsed.tasks.length > 0) {
    for (const bullet of parsed.tasks) {
      const kind = classifyBulletKind(bullet);
      if (buckets[kind]) continue;
      buckets[kind] = clipLen(microFromBulletLabel(bullet, lang, parsed), 76);
    }
  } else {
    buckets.learn = clipLen(microActionForStepWithoutTasks(step, parsed, stepIndex, lang), 76);
  }

  return {
    learn: buckets.learn || defaults.learn,
    practice: buckets.practice || defaults.practice,
    apply: buckets.apply || defaults.apply,
  };
}

const LPA_ORDER = ["learn", "practice", "apply"];

/** Merge legacy t-/s- task ids into lpa-* ids when catalog uses the LPA model. */
export function normalizeCompletedForCatalog(completedTasks, catalog) {
  const valid = new Set(catalog.map((c) => c.id));
  if (!catalog.length) return [];
  const isLpa = catalog.some((c) => c.id.startsWith("lpa-"));
  if (!isLpa) return completedTasks.filter((id) => valid.has(id));

  const merged = new Set(completedTasks.filter((id) => valid.has(id)));
  const hadLegacy = completedTasks.some((id) => /^[ts]-\d/.test(String(id)));
  if (hadLegacy) {
    for (const id of completedTasks) {
      const s = String(id);
      const sm = s.match(/^s-(\d+)$/);
      const tm = s.match(/^t-(\d+)-(\d+)$/);
      if (sm) {
        const i = sm[1];
        LPA_ORDER.forEach((k) => merged.add(`lpa-${i}-${k}`));
      } else if (tm) {
        const i = tm[1];
        const j = +tm[2];
        merged.add(`lpa-${i}-${LPA_ORDER[Math.min(j, 2)]}`);
      }
    }
  }
  return [...merged].filter((id) => valid.has(id));
}

/** One actionable micro-task when a step has no parsed bullet list. */
export function microActionForStepWithoutTasks(step, parsed, stepIndex, lang) {
  const resRaw = (parsed.resource || "").trim();
  const res = stripResourceLabelPrefix(resRaw) || resRaw;
  const time = actionTimeSuffix(parsed, lang);
  if (res) {
    const name = clipLen(res, 56);
    return lang === "TR"
      ? `${name} — 1–2 ders izle ve not al${time}`
      : `Watch lessons 1–2 of ${name}; take notes${time}`;
  }
  const descFirst = (parsed.description || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)[0];
  if (descFirst && descFirst.length >= 12 && descFirst.length <= 130) {
    const clip = clipLen(descFirst, 90);
    return lang === "TR"
      ? `İlk paragrafı uygula: ${clip}${time}`
      : `Do the first exercise from: ${clip}${time}`;
  }
  const rawLines = (step.description || "")
    .replace(/\*\*/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const first = rawLines.find((l) => l.length >= 12 && !/^#/.test(l));
  if (first && first.length <= 130) {
    const clip = clipLen(first, 90);
    return lang === "TR"
      ? `Bugün şunu bitir: ${clip}${time}`
      : `Finish today: ${clip}${time}`;
  }
  const title = (step.title || "").trim();
  if (title && !looksLikeGenericRoadmapTitle(title)) {
    return lang === "TR"
      ? `"${clipLen(title, 48)}" — ilk görevi tamamla${time}`
      : `Complete the first action for "${clipLen(title, 48)}"${time}`;
  }
  const t = actionTimeSuffix(parsed, lang);
  return concreteLearnMicroLine(parsed, step, lang, t);
}

/**
 * @returns {{ id: string, taskId: string, stepId: number, stepIndex: number, label: string, microLabel: string, bucket: 'learn'|'practice'|'apply' }[]}
 */
export function buildRoadmapTaskCatalog(roadmapSteps, lang) {
  const catalog = [];
  roadmapSteps.forEach((step, i) => {
    const tri = buildStepLearnPracticeApply(step, i, lang);
    for (const kind of LPA_ORDER) {
      const id = `lpa-${i}-${kind}`;
      const line = tri[kind];
      catalog.push({
        id,
        taskId: id,
        stepId: i,
        stepIndex: i,
        label: line,
        microLabel: line,
        bucket: kind,
      });
    }
  });
  return catalog;
}

export function planFingerprint(plan, stepCount) {
  let h = 2166136261;
  const s = `${stepCount}|${plan || ""}`.slice(0, 2400);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${stepCount}-${h >>> 0}`;
}

export function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

export function loadRoadmapProgress() {
  try {
    const raw = localStorage.getItem(LS_PROGRESS);
    if (!raw) return { completedTasks: [], progress: 0, planKey: "" };
    const j = JSON.parse(raw);
    return {
      completedTasks: Array.isArray(j.completedTasks) ? j.completedTasks : [],
      progress: typeof j.progress === "number" ? j.progress : 0,
      planKey: typeof j.planKey === "string" ? j.planKey : "",
    };
  } catch {
    return { completedTasks: [], progress: 0, planKey: "" };
  }
}

export function saveRoadmapProgress({ completedTasks, progress, planKey }) {
  localStorage.setItem(LS_PROGRESS, JSON.stringify({ completedTasks, progress, planKey }));
}

export function loadRoadmapDaily() {
  try {
    const raw = localStorage.getItem(LS_DAILY);
    if (!raw) return { currentTaskId: "", date: "", planKey: "" };
    const j = JSON.parse(raw);
    return {
      currentTaskId: j.currentTaskId || "",
      date: j.date || "",
      planKey: typeof j.planKey === "string" ? j.planKey : "",
    };
  } catch {
    return { currentTaskId: "", date: "", planKey: "" };
  }
}

export function saveRoadmapDaily(state) {
  localStorage.setItem(LS_DAILY, JSON.stringify(state));
}

export function loadRoadmapStreak() {
  try {
    const raw = localStorage.getItem(LS_STREAK);
    if (!raw) return { count: 0, lastYmd: "" };
    const j = JSON.parse(raw);
    return {
      count: typeof j.count === "number" ? j.count : 0,
      lastYmd: typeof j.lastYmd === "string" ? j.lastYmd : "",
    };
  } catch {
    return { count: 0, lastYmd: "" };
  }
}

export function saveRoadmapStreak(s) {
  localStorage.setItem(LS_STREAK, JSON.stringify(s));
}

/** First incomplete catalog task; empty string if all done. */
export function pickDailyTask(catalog, completedSet) {
  if (!catalog.length) return "";
  const next = catalog.find((t) => !completedSet.has(t.id));
  return next ? next.id : "";
}

/** Bump streak when user completes a daily focus action (once per calendar day). */
export function bumpStreakAfterDailyComplete(prev, todayYmd) {
  if (prev.lastYmd === todayYmd) return prev;
  if (!prev.lastYmd) return { count: 1, lastYmd: todayYmd };
  const a = new Date(`${prev.lastYmd}T12:00:00`);
  const b = new Date(`${todayYmd}T12:00:00`);
  const diff = Math.round((b - a) / 86400000);
  if (diff === 1) return { count: prev.count + 1, lastYmd: todayYmd };
  return { count: 1, lastYmd: todayYmd };
}

export function splitFocusTaskLabel(microLabel) {
  const s = String(microLabel || "").trim();
  const m = s.match(/^(.*)\(([^)]+)\)\s*$/);
  if (m) return { body: m[1].trim(), timeLabel: m[2].trim() };
  return { body: s, timeLabel: null };
}

export function isJobParagraphApplyTask(microLabel, lang) {
  const s = String(microLabel || "").toLowerCase();
  if (lang === "TR") return /gerçek bir ilana/.test(s);
  return /real job post/.test(s) || /linking this step/.test(s);
}

export function normalizeJobUrlInput(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  try {
    return new URL(t).href;
  } catch {
    try {
      return new URL(`https://${t}`).href;
    } catch {
      return null;
    }
  }
}

export function deriveJobTitleFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = u.pathname.split("/").filter(Boolean);
    let seg = parts.pop() || "";
    if (!seg || /^view$/i.test(seg) || /^jobs?$/i.test(seg) || /^\d+$/.test(seg)) {
      seg = parts.pop() || "";
    }
    if (!seg) {
      const h = host.split(".")[0] || "";
      if (h && h !== "www")
        return `${h.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 72)}`;
      return langNeutralJobPlaceholder();
    }
    let s = decodeURIComponent(seg.replace(/\+/g, " "));
    s = s.replace(/\.(html?|php)$/i, "");
    s = s.replace(/[-_]+/g, " ").trim();
    if (!s) return langNeutralJobPlaceholder();
    s = s.replace(/\b\w/g, (c) => c.toUpperCase());
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  } catch {
    return langNeutralJobPlaceholder();
  }
}

function langNeutralJobPlaceholder() {
  return "Job posting";
}

export function applyJobToFocusMicroLine(microLabel, jobTitle, lang, bucket) {
  if (bucket !== "apply" || !String(jobTitle || "").trim()) return microLabel;
  if (!isJobParagraphApplyTask(microLabel, lang)) return microLabel;
  const t = String(jobTitle).trim();
  if (lang === "TR") {
    return `Şu ilana özel tek paragraflık yaz: ${t} (15 dk)`;
  }
  return `Write one paragraph tailored to this job: ${t} (15 min)`;
}

export function loadFocusJob() {
  try {
    const raw = localStorage.getItem(LS_FOCUS_JOB);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || typeof j.jobUrl !== "string" || !String(j.jobUrl).trim()) return null;
    return {
      planKey: String(j.planKey || ""),
      taskId: String(j.taskId || ""),
      jobTitle: String(j.jobTitle || "").trim(),
      jobUrl: String(j.jobUrl || "").trim(),
    };
  } catch {
    return null;
  }
}

export function saveFocusJob({ planKey, taskId, jobTitle, jobUrl }) {
  try {
    localStorage.setItem(
      LS_FOCUS_JOB,
      JSON.stringify({
        planKey: String(planKey || ""),
        taskId: String(taskId || ""),
        jobTitle: String(jobTitle || "").trim(),
        jobUrl: String(jobUrl || "").trim(),
      })
    );
  } catch {}
}

export function clearFocusJob() {
  try {
    localStorage.removeItem(LS_FOCUS_JOB);
  } catch {}
}

/** LinkedIn-style post after completing a focus task (dynamic). */
export function buildTaskCompletionSharePost({ taskLabel, progressPct, streakDays, role, seniority, lang }) {
  const roleStr =
    [role, seniority].filter(Boolean).join(" · ") || (lang === "TR" ? "hedef rolüm" : "my target role");
  const task = String(taskLabel || "").trim() || (lang === "TR" ? "bir görev" : "a task");
  const p = Math.min(100, Math.max(0, Math.round(Number(progressPct) || 0)));
  const s = Math.max(0, Math.round(Number(streakDays) || 0));
  if (lang === "TR") {
    return `HireFit ile adım adım kariyer yolumu inşa ediyorum.

Bugün tamamladım: ${task}

İlerleme: %${p}
Seri: ${s} gün

Bu benim yolculuğum 🚀`;
  }
  return `I'm building my career path step by step with HireFit.

Today I completed: ${task}

Progress: ${p}%
Streak: ${s} days

This is my journey 🚀`;
}

export function buildRetentionSharePost({ progressPct, role, seniority, steps, lang }) {
  const roleStr =
    [role, seniority].filter(Boolean).join(" · ") || (lang === "TR" ? "hedef rolüm" : "my target role");
  if (lang === "TR") {
    return `${roleStr} olma yolundayım.

Zaten gerçek ilerleme kaydediyor ve beceriler inşa ediyorum.

Hadi gidelim 🚀

HireFit AI ile oluşturuldu`;
  }
  return `I'm on my way to becoming a ${roleStr}.

I'm already making real progress and building skills.

Let's go 🚀

Built with HireFit AI`;
}
