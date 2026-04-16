import { createClient } from "@supabase/supabase-js";

let authClient;

function requireSupabaseEnv() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are missing");
  }
  return { url, anonKey };
}

function getAuthClient() {
  if (!authClient) {
    const { url, anonKey } = requireSupabaseEnv();
    authClient = createClient(url, anonKey);
  }
  return authClient;
}

function readAuthorizationHeader(req) {
  const fromGet = typeof req?.get === "function" ? req.get("authorization") : "";
  const fromHeaders = req?.headers?.authorization;
  return String(fromGet || fromHeaders || "").trim();
}

export async function getUserFromRequest(req) {
  const authHeader = readAuthorizationHeader(req);
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const accessToken = tokenMatch?.[1]?.trim();
  if (!accessToken) {
    return { ok: false, status: 401, error: "Missing bearer token", user: null };
  }

  try {
    const client = getAuthClient();
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data?.user) {
      return { ok: false, status: 401, error: "Invalid session token", user: null };
    }
    return { ok: true, status: 200, error: null, user: data.user };
  } catch (err) {
    return { ok: false, status: 500, error: err?.message || "Auth check failed", user: null };
  }
}

export async function requireAuthExpress(req, res, next) {
  const auth = await getUserFromRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }
  req.authUser = auth.user;
  return next();
}

