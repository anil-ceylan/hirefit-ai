import { recommendJobs } from "../../lib/jobDiscovery/index.js";
import { parseLocalStorageJson } from "./safeJson.js";

const SKIPPED_KEY = "hirefit-skipped-jobs-v1";

export function loadSkippedJobIds() {
  const raw = parseLocalStorageJson(localStorage.getItem(SKIPPED_KEY), [], { label: "skipped-jobs" });
  return Array.isArray(raw) ? raw.map(String) : [];
}

export function skipJobId(id) {
  const next = [...new Set([...loadSkippedJobIds(), String(id)])].slice(0, 80);
  localStorage.setItem(SKIPPED_KEY, JSON.stringify(next));
  return next;
}

export async function fetchRecommendedJobs({
  apiBase,
  getHeaders,
  cvText,
  careerProfile,
  lang,
  limit = 5,
}) {
  const skippedIds = loadSkippedJobIds();
  const trimmed = String(cvText || "").trim();
  if (trimmed.length < 40) {
    return recommendJobs({ cvText: trimmed, careerProfile, lang, limit, skippedIds });
  }

  try {
    const res = await fetch(`${apiBase}/api/job-discovery/recommendations`, {
      method: "POST",
      headers: await getHeaders({ requireSession: false }),
      body: JSON.stringify({
        cvText: trimmed,
        careerProfile,
        lang,
        limit,
        skippedIds,
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    /* fallback local */
  }

  return recommendJobs({ cvText: trimmed, careerProfile, lang, limit, skippedIds });
}

