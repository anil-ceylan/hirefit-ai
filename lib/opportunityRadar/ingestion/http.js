import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function canonicalUrl(value, hosts) {
  if (typeof value !== "string" || value.length > 2048 || /[\s\\]/u.test(value) || [...value].some(char => char.charCodeAt(0) < 32)) throw new Error("INVALID_URL");
  let url;
  try { url = new URL(value); } catch { throw new Error("INVALID_URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || isIP(url.hostname) || !hosts.includes(url.hostname)) throw new Error("UNSAFE_URL_HOST");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || ["gclid", "fbclid"].includes(key)) url.searchParams.delete(key);
  return url.href;
}

// Conservative IPv4-only egress; fail closed on IPv6-only or special-use networks.
// Pin the validated address in HTTPS lookup to prevent DNS rebinding.
export function publicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99) || (b === 2))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

export async function resolvePublic(host, resolver = lookup, timeoutMs = 8000) {
  let timer;
  try {
    const answers = await Promise.race([resolver(host, { all: true, family: 4 }), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("DNS_TIMEOUT")), timeoutMs);
    })]);
    if (!answers.length || answers.some(row => !publicIPv4(row.address))) throw new Error("UNSAFE_DNS_DESTINATION");
    return answers[0].address;
  } finally { clearTimeout(timer); }
}

export function requestOnce(url, address, limits, get = https.get) {
  return new Promise((resolve, reject) => {
    const req = get(url, { agent: false, headers: { Accept: "application/json", "Accept-Encoding": "identity", "User-Agent": "HireFit-Radar-Development-DryRun/1.0" },
      lookup: (_host, options, cb) => cb(null, ...(options.all ? [[{ address, family: 4 }]] : [address, 4])) }, res => {
      const status = res.statusCode;
      if (status >= 300 && status < 400) { resolve({ status, location: res.headers.location }); res.destroy(); return; }
      if (status !== 200) { resolve({ status, retryAfter: res.headers["retry-after"] }); res.destroy(); return; }
      if (!/^application\/(?:[\w.+-]*\+)?json(?:;|$)/i.test(res.headers["content-type"] || "") ||
          ![undefined, "identity"].includes(res.headers["content-encoding"])) { res.destroy(); reject(new Error("INVALID_CONTENT_TYPE")); return; }
      let size = 0;
      const chunks = [];
      res.on("data", chunk => {
        size += chunk.length;
        if (size > limits.maxBytes) { res.destroy(); reject(new Error("RESPONSE_TOO_LARGE")); } else chunks.push(chunk);
      });
      res.on("error", () => reject(new Error("RESPONSE_READ_FAILED")));
      res.on("end", () => {
        try { resolve({ status, data: JSON.parse(Buffer.concat(chunks).toString("utf8")) }); }
        catch { reject(new Error("INVALID_JSON")); }
      });
    });
    const timer = setTimeout(() => req.destroy(new Error("REQUEST_TIMEOUT")), limits.timeoutMs);
    req.on("close", () => clearTimeout(timer));
    req.on("error", error => reject(new Error(error.message === "REQUEST_TIMEOUT" ? "REQUEST_TIMEOUT" : "NETWORK_ERROR")));
  });
}

export async function readJson(input, source, { resolve = resolvePublic, request = requestOnce, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let url = canonicalUrl(input, source.permittedHosts);
  let redirects = 0, retries = 0;
  for (;;) {
    const address = await resolve(new URL(url).hostname, undefined, source.limits.timeoutMs);
    const response = await request(url, address, source.limits);
    if (response.status >= 300 && response.status < 400) {
      if (++redirects > source.limits.redirects || !response.location) throw new Error("REDIRECT_LIMIT");
      url = canonicalUrl(new URL(response.location, url).href, source.permittedHosts);
      continue;
    }
    if (response.status === 200) return response.data;
    if ((response.status === 429 || response.status >= 500) && retries++ < source.limits.retries) {
      const raw = response.retryAfter;
      const delay = raw ? (/^\d+$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw) - Date.now()) : 500 * retries;
      // Do not retry earlier than Retry-After; defer the run instead of sleeping unboundedly.
      if (!Number.isFinite(delay) || delay > 2000) throw new Error("UPSTREAM_RETRY_DEFERRED");
      await sleep(Math.max(0, delay));
      continue;
    }
    throw new Error(`UPSTREAM_HTTP_${response.status}`);
  }
}
