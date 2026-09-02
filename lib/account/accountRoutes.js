import multer from "multer";
import { requireAuthExpress } from "../auth/verifySupabaseJwt.js";
import { isAllowedAvatarMime, MAX_AVATAR_BYTES, removeUserAvatar, uploadUserAvatar } from "./avatarStorage.js";

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAvatarMime(file.mimetype, file.originalname)) cb(null, true);
    else cb(new Error("AVATAR_FILE_TYPE_UNSUPPORTED"));
  },
});

function avatarErrorMessage(error) {
  const code = String(error?.message || error?.code || "").toUpperCase();
  if (error?.code === "LIMIT_FILE_SIZE" || code.includes("TOO_LARGE")) return "AVATAR_FILE_TOO_LARGE";
  if (code.includes("UNSUPPORTED")) return "AVATAR_FILE_TYPE_UNSUPPORTED";
  if (code.includes("NO_AVATAR_FILE")) return "NO_AVATAR_FILE";
  return "AVATAR_UPLOAD_FAILED";
}

function avatarUploadMiddleware(req, res, next) {
  avatarUpload.single("avatar")(req, res, (error) => {
    if (error) {
      return res.status(error?.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        success: false,
        error: avatarErrorMessage(error),
      });
    }
    next();
  });
}

export function registerAccountRoutes(app) {
  app.post("/api/account/avatar", requireAuthExpress, avatarUploadMiddleware, async (req, res) => {
    try {
      const file = req.file;
      const result = await uploadUserAvatar(req.authUser.id, {
        buffer: file?.buffer,
        originalName: file?.originalname,
        mimeType: file?.mimetype,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error("[account-avatar:upload]", error?.message || error);
      return res.status(error?.status || 500).json({
        success: false,
        error: avatarErrorMessage(error),
      });
    }
  });

  app.delete("/api/account/avatar", requireAuthExpress, async (req, res) => {
    try {
      const result = await removeUserAvatar(req.authUser.id);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error("[account-avatar:delete]", error?.message || error);
      return res.status(error?.status || 500).json({
        success: false,
        error: "AVATAR_DELETE_FAILED",
      });
    }
  });
}
