import { getServiceClient } from "../careerMemory/persistence.js";
export async function listCases(userId) { const s = getServiceClient(); if (!s) throw new Error("STORAGE_UNAVAILABLE"); const { data, error } = await s.from("career_companion_cases").select("*").eq("user_id", userId).eq("scenario_type", "promotion_raise").order("updated_at", { ascending: false }); if (error) throw error; return data || []; }
export async function getCase(userId, id) { const s = getServiceClient(); if (!s) throw new Error("STORAGE_UNAVAILABLE"); const { data, error } = await s.from("career_companion_cases").select("*").eq("id", id).eq("user_id", userId).maybeSingle(); if (error) throw error; return data; }
function ownershipError() { const error = new Error("CASE_NOT_FOUND_OR_NOT_OWNED"); error.code = "CASE_NOT_FOUND_OR_NOT_OWNED"; return error; }
export async function saveCase(userId, value) {
  const s = getServiceClient(); if (!s) throw new Error("STORAGE_UNAVAILABLE");
  if (value?.id) {
    const { data: existing, error: lookupError } = await s.from("career_companion_cases").select("id, user_id").eq("id", value.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing || existing.user_id !== userId) throw ownershipError();
  }
  const { data, error } = await s.from("career_companion_cases").upsert({ ...value, user_id: userId, scenario_type: "promotion_raise", updated_at: new Date().toISOString() }, { onConflict: "id" }).select().single();
  if (error) throw error; return data;
}
export async function saveOutcome(userId, caseId, outcome) {
  const s = getServiceClient(); if (!s) throw new Error("STORAGE_UNAVAILABLE");
  const { data: ownedCase, error: lookupError } = await s.from("career_companion_cases").select("id, user_id").eq("id", caseId).eq("user_id", userId).maybeSingle();
  if (lookupError) throw lookupError;
  if (!ownedCase) throw ownershipError();
  const { data, error } = await s.from("career_companion_outcomes").upsert({ ...outcome, case_id: caseId, user_id: userId }, { onConflict: "case_id" }).select().single();
  if (error) throw error;
  await s.from("career_companion_cases").update({ status: "outcome_recorded", updated_at: new Date().toISOString() }).eq("id", caseId).eq("user_id", userId);
  return data;
}
