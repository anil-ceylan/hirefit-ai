import { getServiceClient } from "../careerMemory/persistence.js";
import { rowToSnapshot, snapshotToRow } from "./index.js";

export async function listCareerProgress(userId, limit = 24) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("career_progress_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[career-progress:list]", error?.message || error);
    return [];
  }
  return (data || []).map(rowToSnapshot);
}

export async function insertCareerProgress(userId, payload) {
  const supabase = getServiceClient();
  if (!supabase || !userId) throw new Error("Career progress storage unavailable");
  const row = snapshotToRow(userId, payload);
  const { data, error } = await supabase.from("career_progress_snapshots").insert(row).select().single();
  if (error) throw error;
  return rowToSnapshot(data);
}
