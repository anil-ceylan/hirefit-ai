const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Call only from server persistence after authenticated route identity verification.
// The operation is monotonic; profile fields cannot grant/reopen the benefit.
export async function transitionOnboarding(client, userId, action, reason = null) {
  if (!client || !uuid.test(userId || "") || !["snapshot", "prepare", "close"].includes(action) ||
      (action === "close" && !["completed", "skipped"].includes(reason))) throw new Error("ENTITLEMENT_UNAVAILABLE");
  const { data, error } = await client.rpc("hirefit_analysis_entitlement", {
    p_user_id: userId, p_action: action, p_request_id: null, p_is_admin: false,
    p_kind: "onboarding", p_input_hash: null, p_reason: reason,
  });
  if (error || !data || data.error || !["available", "reserved", "consumed", "closed"].includes(data.onboarding_state)) {
    throw new Error(data?.error === "ENTITLEMENT_REVIEW_REQUIRED" ? data.error : "ENTITLEMENT_UNAVAILABLE");
  }
}
