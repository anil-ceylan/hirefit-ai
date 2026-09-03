import multer from "multer";
import { requireAuthExpress } from "../auth/verifySupabaseJwt.js";
import { loadFullCareerProfile, upsertOnboardingDraft, completeOnboarding, saveFirstAnalysis } from "./persistence.js";
import { getCareerDnaQuestions } from "./careerDna.js";
import { uploadUserCv, isAllowedCvMime } from "./cvStorage.js";

const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedCvMime(file.mimetype, file.originalname)) cb(null, true);
    else cb(new Error("Only PDF and DOCX files are allowed (max 8MB)"));
  },
});

async function handleCvUpload(req, res) {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }
    const result = await uploadUserCv(
      req.authUser.id,
      file.buffer,
      file.originalname,
      file.mimetype
    );
    return res.status(200).json({
      success: true,
      fileName: result.fileName,
      fileUrl: result.url,
      mimeType: result.mimeType || file.mimetype,
      size: result.size ?? file.size,
      mock: Boolean(result.mock),
    });
  } catch (e) {
    console.error("[career-onboarding:upload-cv]", e?.message || e);
    return res.status(200).json({ success: false, error: "CV upload unavailable" });
  }
}

function cvUploadMiddleware(req, res, next) {
  cvUpload.single("cvFile")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "File too large (max 8MB)" : err.message || "Upload failed";
      return res.status(400).json({ success: false, error: msg });
    }
    next();
  });
}

/** Legacy field name `file` */
function cvUploadLegacyMiddleware(req, res, next) {
  cvUpload.single("file")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "File too large (max 8MB)" : err.message || "Upload failed";
      return res.status(400).json({ success: false, error: msg });
    }
    next();
  });
}

export function registerOnboardingRoutes(app) {
  app.post(
    "/api/career-onboarding/upload-cv",
    requireAuthExpress,
    cvUploadMiddleware,
    handleCvUpload
  );

  app.post(
    "/api/career-onboarding/cv",
    requireAuthExpress,
    cvUploadLegacyMiddleware,
    handleCvUpload
  );

  app.get("/api/career-onboarding", requireAuthExpress, async (req, res) => {
    try {
      const profile = await loadFullCareerProfile(req.authUser.id);
      const lang = req.query?.lang === "en" ? "EN" : "TR";
      return res.status(200).json({
        success: true,
        profile: profile || null,
        exists: Boolean(profile),
        questions: getCareerDnaQuestions(lang),
        onboarding_completed: Boolean(profile?.onboarding_completed),
      });
    } catch (e) {
      console.error("[career-onboarding:get]", e?.message || e);
      return res.status(200).json({
        success: true,
        profile: null,
        exists: null,
        questions: getCareerDnaQuestions(req.query?.lang === "en" ? "EN" : "TR"),
        onboarding_completed: false,
        profileFetchFailed: true,
      });
    }
  });

  app.patch("/api/career-onboarding/draft", requireAuthExpress, async (req, res) => {
    try {
      const { step, draft, lang, clearFields } = req.body || {};
      const result = await upsertOnboardingDraft(req.authUser.id, { step, draft, lang, clearFields });
      if (result.storageUnavailable) {
        return res.status(200).json({
          success: true,
          profile: null,
          draftAccepted: true,
          storageUnavailable: true,
        });
      }
      return res.status(200).json({ success: true, profile: result.profile });
    } catch (e) {
      console.error("[career-onboarding:draft]", e?.message || e);
      return res.status(200).json({
        success: true,
        profile: null,
        draftAccepted: true,
        storageUnavailable: true,
        warning: e?.message || "Draft saved locally only",
      });
    }
  });

  app.post("/api/career-onboarding/complete", requireAuthExpress, async (req, res) => {
    try {
      const {
        basic,
        goals,
        dnaAnswers,
        readinessAnswers,
        cv,
        hasCv,
        experienceSignals,
        leadershipSignals,
        linkedin,
        github,
        portfolio,
        website,
        behance,
        dribbble,
        cvUploaded,
        cvSignalCount,
        analysisSources,
        clearFields,
        lang,
      } = req.body || {};
      const result = await completeOnboarding(req.authUser.id, {
        basic,
        goals,
        dnaAnswers,
        readinessAnswers,
        cv,
        hasCv,
        experienceSignals,
        leadershipSignals,
        linkedin,
        github,
        portfolio,
        website,
        behance,
        dribbble,
        cvUploaded,
        cvSignalCount,
        analysisSources,
        clearFields,
        lang,
      });
      if (result.storageUnavailable) {
        return res.status(200).json({
          success: true,
          mode: "local",
          profile: null,
          storageUnavailable: true,
        });
      }
      return res.status(200).json({
        success: true,
        mode: result.mode || "created",
        profile: result.profile,
      });
    } catch (e) {
      console.error("[career-onboarding:complete]", e?.message || e);
      return res.status(200).json({
        success: true,
        mode: "local",
        profile: null,
        storageUnavailable: true,
      });
    }
  });

  app.patch("/api/career-onboarding/first-analysis", requireAuthExpress, async (req, res) => {
    try {
      const { snapshot, firstAnalysis, basicProfile, analysisSources } = req.body || {};
      const result = await saveFirstAnalysis(req.authUser.id, {
        snapshot,
        firstAnalysis,
        basicProfile,
        analysisSources,
      });
      if (result.storageUnavailable) {
        return res.status(200).json({ success: true, profile: null, storageUnavailable: true });
      }
      return res.status(200).json({ success: true, profile: result.profile });
    } catch (e) {
      console.error("[career-onboarding:first-analysis]", e?.message || e);
      return res.status(200).json({ success: true, profile: null, storageUnavailable: true });
    }
  });
}
