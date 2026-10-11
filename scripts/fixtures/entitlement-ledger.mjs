// Independent, isolated acceptance model. This does NOT execute or prove PostgreSQL.
export const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const WINDOW_MS = 720 * 60 * 60 * 1000;
export const LEASE_MS = 15 * 60 * 1000;

export function ledger({ plan = "free", count = 0, historical = false, state = "available", prepared = true,
  failComplete = false } = {}) {
  let time = Date.parse("2026-10-11T00:00:00Z");
  const accounts = new Map(), requests = new Map(), calls = [];
  let serial = Promise.resolve();
  const client = { rpc(name, args) {
    const transaction = serial.then(() => {
      calls.push({ name, ...args });
      const user = args.p_user_id;
      let account = accounts.get(user);
      if (!account) {
        if (historical) return { data: { error: "ENTITLEMENT_REVIEW_REQUIRED" } };
        account = { plan, count, reset: time, state, prepared };
        accounts.set(user, account);
      }
      if (name === "hirefit_set_authoritative_plan") {
        if (args.p_source !== "admin") return { error: { message: "unsupported authority" } };
        account.plan = args.p_plan;
        return { data: { success: true } };
      }
      for (const r of requests.values()) {
        if (r.user === user && r.status === "pending" && r.expires <= time) {
          r.status = "expired";
          if (r.kind === "onboarding" && account.state === "reserved") account.state = "available";
        }
      }
      if (time - account.reset >= WINDOW_MS) { account.count = 0; account.reset = time; }
      const pending = () => [...requests.values()].filter(r => r.user === user && r.status === "pending" && r.charge).length;
      const pro = args.p_kind === "normal" && (account.plan === "pro" || args.p_is_admin);
      let allowed = args.p_kind === "onboarding" ? account.state === "available" && account.prepared : pro || account.count + pending() < 2;
      const key = args.p_request_id, action = args.p_action, kind = args.p_kind;
      if (action === "prepare") account.prepared = true;
      if (action === "close") {
        if (!["consumed", "closed"].includes(account.state)) account.state = "closed";
        for (const r of requests.values()) if (r.user === user && r.kind === "onboarding" && r.status === "pending") r.status = "released";
      }
      if (action === "reserve") {
        const previous = requests.get(key);
        if (previous) {
          if (previous.user !== user || previous.kind !== kind || previous.hash !== args.p_input_hash) return { data: { error: "IDEMPOTENCY_CONFLICT" } };
          return { data: { error: { pending: "ANALYSIS_IN_PROGRESS", completed: "ANALYSIS_ALREADY_COMPLETED",
            released: "ANALYSIS_REQUEST_RELEASED", expired: "ANALYSIS_REQUEST_EXPIRED" }[previous.status] } };
        }
        if (allowed) {
          requests.set(key, { user, kind, hash: args.p_input_hash, status: "pending", charge: kind === "normal" && account.plan !== "pro", expires: time + LEASE_MS });
          if (kind === "onboarding") account.state = "reserved";
        }
      }
      if (["complete", "release"].includes(action)) {
        if (failComplete && action === "complete") return { error: { message: "synthetic private SQL" } };
        const r = requests.get(key);
        if (!r || r.user !== user || r.kind !== kind) return { error: { message: "not owned" } };
        if (r.status === "expired") return { data: { error: "ANALYSIS_REQUEST_EXPIRED" } };
        const destination = action === "complete" ? "completed" : "released";
        if (r.status !== "pending" && r.status !== destination) return { error: { message: "settlement conflict" } };
        if (r.status === "pending") {
          r.status = destination;
          if (destination === "completed") {
            if (r.charge) account.count++;
            if (kind === "onboarding") account.state = "consumed";
          } else if (kind === "onboarding" && account.state === "reserved") account.state = "available";
        }
      }
      return { data: { plan: account.plan, is_pro: pro, analysis_count: account.count, pending_count: pending(),
        allowed, free_limit: 2, last_reset_at: new Date(account.reset).toISOString(), onboarding_state: account.state } };
    });
    serial = transaction.catch(() => {});
    return transaction;
  } };
  return { client, accounts, requests, calls, advance(ms) { time += ms; } };
}
