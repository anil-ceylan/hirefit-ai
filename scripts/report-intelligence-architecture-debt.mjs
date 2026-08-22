import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = [
  "lib/careerIntelligence/coreIntelligenceEngine.js",
  "lib/careerIntelligence/cvEvidenceLayer.js",
  "src/utils/normalizeAnalysisForUI.js",
  "lib/careerIntelligence/evidence",
  "lib/careerIntelligence/reasoning",
  "lib/careerIntelligence/calibration",
  "lib/careerIntelligence/observatory",
];
const concepts = [
  ["trust", /trust|recruiterTrust|confidenceFromEvidence/gi],
  ["gap", /gap|missingEvidence|blocker/gi],
  ["role", /roleFit|topRole|recommendation|rankRecommendations/gi],
  ["evidence", /evidence|proof|kan[ıi]t/gi],
  ["decision", /decision|verdict|recommendation/gi],
];

function filesUnder(target) {
  const full = path.join(root, target);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(full, entry.name);
    if (entry.isDirectory()) return filesUnder(path.relative(root, child));
    return child.endsWith(".js") || child.endsWith(".jsx") || child.endsWith(".mjs") ? [child] : [];
  });
}

const rows = targets.map((target) => {
  const files = filesUnder(target);
  const text = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  return {
    target,
    files: files.length,
    lines: text.split(/\r?\n/).length,
    concepts: Object.fromEntries(concepts.map(([name, re]) => [name, (text.match(re) || []).length])),
  };
});

const recommendations = [
  "Keep observatory shadow-only until real-flow drift summaries are reviewed.",
  "Gradually migrate one consumer at a time from normalizeAnalysisForUI.js to the DecisionOption contract.",
  "Treat Recruiter Trust and Decision Confidence as related but not equivalent.",
  "Move duplicated role/gap/trust thresholds into versioned domain configuration before production activation.",
  "Do not delete legacy engines until shadow drift is low on real user-shaped samples.",
];

console.error("HireFit Intelligence Architecture Debt Report");
console.error(JSON.stringify({ rows, recommendations }, null, 2));
