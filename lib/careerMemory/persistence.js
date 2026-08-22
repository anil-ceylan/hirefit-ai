import { createClient } from "@supabase/supabase-js";
import { profileRowToMemory, memoryToDbRow } from "./index.js";
import { rowToFullProfile } from "../careerOnboarding/persistence.js";

export function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function loadCareerProfile(userId) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return null;
  const { data, error } = await supabase.from("career_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    console.warn("[career-profile:load]", error?.message || error);
    return null;
  }
  return data ? rowToFullProfile(data) : null;
}

export async function saveCareerProfile(userId, merged) {
  const supabase = getServiceClient();
  if (!supabase || !userId) throw new Error("Career profile storage unavailable");
  const existing = await loadCareerProfile(userId);
  const row = {
    ...memoryToDbRow(userId, merged),
    onboarding_completed: existing?.onboarding_completed ?? false,
    onboarding_draft: existing?.onboarding_draft ?? {},
    basic_profile: existing?.basic_profile ?? {},
    career_goals: existing?.career_goals ?? {},
    career_dna: existing?.career_dna ?? {},
    best_fit_roles: existing?.best_fit_roles ?? merged.target_roles ?? [],
    recommended_next_move: existing?.recommended_next_move ?? "",
    growth_plan_30d: existing?.growth_plan_30d ?? "",
  };
  const { data, error } = await supabase.from("career_profiles").upsert(row, { onConflict: "user_id" }).select().single();
  if (error) throw error;
  return rowToFullProfile(data);
}
