import { open } from "node:fs/promises";
import { validateSource } from "../lib/opportunityRadar/ingestion/registry.js";
import { greenhouseAdapter, parseSnapshot } from "../lib/opportunityRadar/ingestion/greenhouse.js";
import { buildPlan } from "../lib/opportunityRadar/ingestion/plan.js";

// Intentionally no dotenv, Supabase, database, write-file, or application imports.
// Reports go only to stdout. There is no --apply option.
async function json(path) {
  const file = await open(path, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 5000000) throw new Error("LOCAL_INPUT_TOO_LARGE");
    const buffer = Buffer.alloc(5000001);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > 5000000) throw new Error("LOCAL_INPUT_TOO_LARGE");
    return JSON.parse(buffer.subarray(0, size).toString("utf8"));
  } finally { await file.close(); }
}
try {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") throw new Error("DEVELOPMENT_ONLY_COMMAND");
  const args = process.argv.slice(2), options = {};
  const allowed = new Set(["--source", "--fixture", "--existing", "--live", "--now"]);
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!allowed.has(key) || Object.hasOwn(options, key)) throw new Error("INVALID_CLI_ARGUMENT");
    options[key] = key === "--live" ? true : args[++i];
    if (!options[key] || (typeof options[key] === "string" && options[key].startsWith("--"))) throw new Error("MISSING_CLI_VALUE");
  }
  if (!options["--source"] || Boolean(options["--fixture"]) === Boolean(options["--live"]) || (options["--live"] && options["--now"])) throw new Error("USE_SOURCE_AND_EXACTLY_ONE_OF_FIXTURE_OR_LIVE");
  const source = validateSource(await json(options["--source"]), { live: Boolean(options["--live"]) });
  const now = new Date(options["--now"] || Date.now()).toISOString();
  const snapshot = options["--live"] ? await greenhouseAdapter.fetchSnapshot(source) : parseSnapshot(await json(options["--fixture"]), source, now);
  const existing = options["--existing"] ? await json(options["--existing"]) : [];
  const plan = buildPlan(source, snapshot, { existing, mode: options["--live"] ? "live" : "fixture" });
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  if (!snapshot.complete) process.exitCode = 2;
} catch (error) {
  const safe = /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : "DRY_RUN_FAILED_CHECK_INPUT";
  process.stderr.write(`${JSON.stringify({ success: false, error: safe, write_capability: false })}\n`);
  process.exitCode = 1;
}
