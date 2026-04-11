import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const headPath = path.join(root, ".tmp-head-raw.jsx");
const appPath = path.join(root, "src", "App.jsx");

const lines = fs.readFileSync(headPath, "utf8").split(/\r?\n/);

/** file line numbers (1-based) inclusive start, exclusive end line after last included */
const sliceByFileLine = (startLine, endLineAfter) =>
  lines.slice(startLine - 1, endLineAfter - 1).join("\n");

const termsInner = sliceByFileLine(4048, 4086);
const privacyInner = sliceByFileLine(4089, 4127);
const landingInner = sliceByFileLine(4134, 4141);
const loginInner = sliceByFileLine(4144, 4163);
const dashboardInner = sliceByFileLine(4165, 4198);
const analyzerInner = sliceByFileLine(4200, 4738);

const destructure = `const {
    navigate, lang, t, T, activeInput, cvLoaded, uploadingPdf, cvPdfInputRef, cvDragOver, setCvDragOver,
    onCvDrop, cvText, setCvText, setActiveInput, cvSectionsOk, jdLoaded, jdDragOver, setJdDragOver, onJdDrop,
    jdText, setJdText, jobUrl, setJobUrl, extractingJob, extractJobFromUrl, jdTxtInputRef, handleJdTextFile,
    showAdvanced, setShowAdvanced, lastDetectedSector, sector, setSector, sectorLabels, sectorValues,
    deadline, setDeadline, isPro, user, userPlanRow, analyze, loading, loadingMessage, error, hasOutput,
    engineV2, alignmentScore, decisionData, decisionLoading, openUpgrade, optimizeCv, optimizing,
    handleSharePrompt, fixResults, applyingFix, applyFix, showAnonSavePrompt, setShowAnonSavePrompt,
    analysisData, matchedSkills, missingSkills, topKeywords, result, optimizedCv, learningPlan,
    downloadText, reanalyzeAfterFix, roadmapLoading, generateLearningPlan, decisionImpactContext,
    reanalysisResult, history, clearHistory, loadHistoryItem,
  } = useOutletContext();`;

const pages = `
export function LandingPage() {
  const { navigate, lang } = useOutletContext();
  return (
${landingInner}
  );
}

export function TermsPage() {
  const { navigate, lang, t } = useOutletContext();
  return (
${termsInner}
  );
}

export function PrivacyPage() {
  const { navigate, lang, t } = useOutletContext();
  return (
${privacyInner}
  );
}

export function RoadmapRoute() {
  const { navigate, lang, t, learningPlan, roleType, seniority } = useOutletContext();
  return <RoadmapPage navigate={navigate} lang={lang} t={t} learningPlan={learningPlan} roleType={roleType} seniority={seniority} />;
}

export function LoginPage() {
  const { t, T, lang, email, setEmail, password, setPassword, error, login, loginWithGoogle } = useOutletContext();
  return (
${loginInner}
  );
}

export function DashboardPage() {
  const {
    t, lang, T, history, loadHistoryItem, clearHistory, averageScore, isPro, plan, waitlist, scoreHistory, navigate,
  } = useOutletContext();
  return (
${dashboardInner}
  );
}

export function AnalyzerPage() {
  ${destructure}
  return (
${analyzerInner}
  );
}
`;

let app = fs.readFileSync(appPath, "utf8");
app = app.replace(/\nexport default MainApp;\s*$/, `\n${pages}\nexport default HireFitLayout;\n`);
if (!app.includes("export default HireFitLayout")) {
  console.error("replace failed");
  process.exit(1);
}
fs.writeFileSync(appPath, app);
console.log("injected pages");
