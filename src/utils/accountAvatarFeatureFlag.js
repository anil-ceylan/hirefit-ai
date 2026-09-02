export const PROFILE_AVATAR_UPLOAD_FLAG = "VITE_PROFILE_AVATAR_UPLOAD_ENABLED";

export function isProfileAvatarUploadEnabled(env = import.meta.env) {
  return String(env?.[PROFILE_AVATAR_UPLOAD_FLAG] || "").toLowerCase() === "true";
}
