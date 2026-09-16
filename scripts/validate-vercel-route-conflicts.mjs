import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { createRequire } from "node:module";

// Mirror the relevant generic (non-Next.js) fs-detectors path checks. In this
// routing mode [...rest] is a named segment, not a multi-segment catch-all.
export function findRouteConflict(files) {
  const absolute = (file) => {
    const { dir, name } = posix.parse(file);
    return `${dir}/${name}`.replace(/\[[^/]*\]/g, "1");
  };
  const param = (segment) => {
    const { name } = posix.parse(segment);
    return name.startsWith("[") && name.endsWith("]") ? name.slice(1, -1) : null;
  };
  for (let i = 0; i < files.length; i += 1) {
    for (const other of files.slice(i + 1)) {
      const file = files[i];
      if (absolute(file) === absolute(other)) return [file, other];
      const a = file.split("/");
      const b = other.split("/");
      for (let k = 0; k < Math.min(a.length, b.length); k += 1) {
        const x = param(a[k]);
        const y = param(b[k]);
        if (a[k] !== b[k] && (!x || !y)) break;
        if (x !== y) return [file, other];
      }
    }
  }
  return null;
}
const files = readdirSync("api", { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => `api/${f.replaceAll("\\", "/")}`);
assert.equal(findRouteConflict(files), null);
const bad = [...files, "api/career-actions/[actionId]/outcome.js"];
assert.deepEqual(new Set(findRouteConflict(bad)), new Set(["api/career-actions/[...rest].js", "api/career-actions/[actionId]/outcome.js"]));
assert.ok(findRouteConflict(["api/foo/[[...rest]].js", "api/foo/[id]/outcome.js"]));
assert.ok(findRouteConflict(["api/foo.js", "api/foo.ts"]));
assert.equal(findRouteConflict(["api/[...route].js", "api/career-actions/[...rest].js"]), null);
assert.equal(files.length, 10);
// Optional official detector installed outside the repository: reproduces the
// failed production tree and validates the repaired inventory with Vite settings.
if (process.env.HIREFIT_ROUTE_AUDIT_MODULE) {
  const { detectBuilders } = createRequire(import.meta.url)(process.env.HIREFIT_ROUTE_AUDIT_MODULE);
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const options = { projectSettings: { framework: "vite" } };
  const before = await detectBuilders(bad, pkg, options);
  assert.ok(before.errors?.some((e) => e.code === "conflicting_file_path"));
  const after = await detectBuilders(files, pkg, options);
  assert.equal(after.errors, null);
  const prefix = after.defaultRoutes.find((r) => r.dest?.startsWith("/api/career-actions/"));
  assert.ok(new RegExp(prefix.src).test("/api/career-actions/outcome"));
  assert.ok(!new RegExp(prefix.src).test("/api/career-actions/id/outcome"));
  process.stdout.write("Official Vercel detector: old conflict reproduced, repaired inventory and rewrite destination pass.\n");
}
process.stdout.write("Vercel route conflicts: inventory, conflicting dynamic/optional shapes, duplicate extensions and 10/12 count passed.\n");
