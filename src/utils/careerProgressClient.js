import {
  buildCareerGrowthView,
  recordSnapshotPayload,
  rowToSnapshot,
} from "../../lib/careerProgress/index.js";
import { apiUrl } from "./apiBase.js";
import { parseLocalStorageJson } from "./safeJson.js";

const LOCAL_KEY = "hirefit-career-progress-v1";

export function loadLocalCareerProgress() {
  return parseLocalStorageJson(localStorage.getItem(LOCAL_KEY), [], { label: "career-progress-local" });
}

export function saveLocalCareerProgress(snapshots) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify((snapshots || []).slice(0, 48)));
}

function localCareerProgressFallback(lang) {
  const snapshots = loadLocalCareerProgress();
  const current = snapshots[0] || null;
  return {
    snapshots,
    growth: current ? buildCareerGrowthView({ snapshots, current, lang }) : null,
    empty: !current,
    offline: true,
  };
}

export async function fetchCareerProgress(apiBase, getHeaders, lang, user = null) {
  if (!user?.id) return localCareerProgressFallback(lang);
  try {
    const res = await fetch(apiUrl(`/api/career-progress?limit=24&lang=${lang === "TR" ? "tr" : "en"}`), {
      headers: await getHeaders({ requireSession: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return localCareerProgressFallback(lang);
    }
    const snapshots = data.snapshots || data.items || [];
    if (snapshots.length) saveLocalCareerProgress(snapshots);
    return { snapshots, growth: data.growth || null, empty: snapshots.length === 0 };
  } catch {
    return localCareerProgressFallback(lang);
  }
}

function recordLocalCareerProgress({ engineV2, score, cvText, role, lang, analysisId = null }) {
  const existing = loadLocalCareerProgress();
  const previous = existing[0] || null;
  const payload = recordSnapshotPayload({
    engineV2,
    score,
    cvText,
    role,
    lang,
    previous,
    analysis_id: analysisId,
  });
  const snapshot = rowToSnapshot({ id: `local-${Date.now()}`, ...payload });
  const snapshots = [snapshot, ...existing].slice(0, 48);
  saveLocalCareerProgress(snapshots);
  const growth = buildCareerGrowthView({ snapshots, current: snapshot, lang });
  return { snapshots, growth, snapshot, offline: true };
}

export async function recordCareerProgressAfterAnalyze({
  apiBase,
  getHeaders,
  user,
  engineV2,
  score,
  cvText,
  role,
  lang,
  analysisId = null,
}) {
  if (user?.id) {
    try {
      const res = await fetch(`${apiBase}/api/career-progress/record`, {
        method: "POST",
        headers: await getHeaders({ requireSession: true }),
        body: JSON.stringify({
          engineV2,
          score,
          cvText,
          role,
          lang,
          analysis_id: analysisId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.storageUnavailable) {
          return recordLocalCareerProgress({
            engineV2,
            score,
            cvText,
            role,
            lang,
            analysisId,
          });
        }
        if (data.snapshots?.length) saveLocalCareerProgress(data.snapshots);
        return { snapshots: data.snapshots || [], growth: data.growth || null, snapshot: data.snapshot };
      }
    } catch {
      // Fall through to local progress recording.
    }
  }
  return recordLocalCareerProgress({
    engineV2,
    score,
    cvText,
    role,
    lang,
    analysisId,
  });
}

