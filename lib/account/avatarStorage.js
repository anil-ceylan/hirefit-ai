import { createClient } from "@supabase/supabase-js";
import { rowToFullProfile } from "../careerOnboarding/persistence.js";

export const AVATAR_BUCKET = "profile-avatars";
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const ALLOWED_AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function safeTimestamp() {
  return new Date().toISOString();
}

function publicUrlWithVersion(publicUrl, version) {
  if (!publicUrl) return "";
  return `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}

function mimeFromFileName(fileName = "") {
  if (/\.jpe?g$/i.test(fileName)) return "image/jpeg";
  if (/\.png$/i.test(fileName)) return "image/png";
  if (/\.webp$/i.test(fileName)) return "image/webp";
  return "";
}

function extensionFor(mimeType, fileName = "") {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  if (/\.png$/i.test(fileName)) return "png";
  if (/\.webp$/i.test(fileName)) return "webp";
  return "jpg";
}

export function isAllowedAvatarMime(mimeType, fileName = "") {
  const mime = String(mimeType || mimeFromFileName(fileName)).toLowerCase();
  return ALLOWED_AVATAR_MIME.has(mime);
}

function normalizeAvatarFile({ buffer, originalName = "avatar", mimeType = "" } = {}) {
  const size = buffer?.length || 0;
  const resolvedMime = String(mimeType || mimeFromFileName(originalName)).toLowerCase();
  if (!buffer?.length) {
    const error = new Error("NO_AVATAR_FILE");
    error.status = 400;
    throw error;
  }
  if (size > MAX_AVATAR_BYTES) {
    const error = new Error("AVATAR_FILE_TOO_LARGE");
    error.status = 413;
    throw error;
  }
  if (!isAllowedAvatarMime(resolvedMime, originalName)) {
    const error = new Error("AVATAR_FILE_TYPE_UNSUPPORTED");
    error.status = 400;
    throw error;
  }
  return {
    buffer,
    fileName: String(originalName || "avatar").slice(0, 120),
    mimeType: resolvedMime,
    size,
    extension: extensionFor(resolvedMime, originalName),
  };
}

async function ensureAvatarBucket(supabase) {
  const { data: existing } = await supabase.storage.getBucket(AVATAR_BUCKET);
  if (existing?.id || existing?.name) return;

  const { error } = await supabase.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    allowedMimeTypes: [...ALLOWED_AVATAR_MIME],
    fileSizeLimit: MAX_AVATAR_BYTES,
  });
  if (error && !/already exists/i.test(String(error.message || ""))) throw error;
}

async function loadProfileRow(supabase, userId) {
  const { data, error } = await supabase.from("career_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function saveAvatarProfileRow(supabase, userId, existing, basicProfile) {
  const now = safeTimestamp();
  const row = {
    ...(existing || {}),
    user_id: userId,
    onboarding_completed: existing?.onboarding_completed ?? false,
    onboarding_draft: existing?.onboarding_draft ?? {},
    basic_profile: basicProfile,
    career_goals: existing?.career_goals ?? {},
    career_dna: existing?.career_dna ?? {},
    career_identity: existing?.career_identity ?? "",
    career_level: existing?.career_level ?? "",
    best_fit_roles: existing?.best_fit_roles ?? existing?.target_roles ?? [],
    target_roles: existing?.target_roles ?? [],
    recommended_next_move: existing?.recommended_next_move ?? "",
    growth_plan_30d: existing?.growth_plan_30d ?? "",
    career_gps: existing?.career_gps ?? {},
    university_intelligence: existing?.university_intelligence ?? {},
    city_intelligence: existing?.city_intelligence ?? {},
    career_readiness: existing?.career_readiness ?? {},
    updated_at: now,
  };
  if (!existing?.created_at) row.created_at = now;

  const { data, error } = await supabase.from("career_profiles").upsert(row, { onConflict: "user_id" }).select().single();
  if (error) throw error;
  return rowToFullProfile(data);
}

function avatarPathFromBasic(basic = {}) {
  return String(basic.avatarPath || basic.avatar_path || "").trim();
}

async function removeOwnedObject(supabase, userId, objectPath) {
  const path = String(objectPath || "").trim();
  if (!path || !path.startsWith(`${userId}/`)) return { removed: false };
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw error;
  return { removed: true };
}

export async function uploadUserAvatar(userId, fileInput) {
  const supabase = getServiceClient();
  if (!supabase || !userId) {
    const error = new Error("AVATAR_STORAGE_UNAVAILABLE");
    error.status = 503;
    throw error;
  }

  const file = normalizeAvatarFile(fileInput);
  await ensureAvatarBucket(supabase);

  const existing = await loadProfileRow(supabase, userId);
  const existingBasic = existing?.basic_profile || {};
  const previousPath = avatarPathFromBasic(existingBasic);
  const version = Date.now();
  const objectPath = `${userId}/avatar-${version}.${file.extension}`;

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(objectPath, file.buffer, {
    contentType: file.mimeType,
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath);
  const publicUrl = publicUrlWithVersion(publicData?.publicUrl || "", version);

  try {
    const profile = await saveAvatarProfileRow(supabase, userId, existing, {
      ...existingBasic,
      avatarUrl: publicUrl,
      avatar_url: publicUrl,
      avatarPath: objectPath,
      avatar_path: objectPath,
      avatarMimeType: file.mimeType,
      avatarSize: file.size,
      avatarUpdatedAt: safeTimestamp(),
    });

    if (previousPath && previousPath !== objectPath) {
      try {
        await removeOwnedObject(supabase, userId, previousPath);
      } catch (error) {
        console.error("[avatar-upload:old-remove]", error?.message || error);
      }
    }

    return {
      avatarUrl: publicUrl,
      avatarPath: objectPath,
      mimeType: file.mimeType,
      size: file.size,
      profile,
    };
  } catch (error) {
    try {
      await removeOwnedObject(supabase, userId, objectPath);
    } catch (cleanupError) {
      console.error("[avatar-upload:cleanup]", cleanupError?.message || cleanupError);
    }
    throw error;
  }
}

export async function removeUserAvatar(userId) {
  const supabase = getServiceClient();
  if (!supabase || !userId) {
    const error = new Error("AVATAR_STORAGE_UNAVAILABLE");
    error.status = 503;
    throw error;
  }

  await ensureAvatarBucket(supabase);
  const existing = await loadProfileRow(supabase, userId);
  if (!existing) {
    const error = new Error("CAREER_PROFILE_NOT_FOUND");
    error.status = 404;
    throw error;
  }

  const existingBasic = existing.basic_profile || {};
  const previousPath = avatarPathFromBasic(existingBasic);

  const profile = await saveAvatarProfileRow(supabase, userId, existing, {
    ...existingBasic,
    avatarUrl: null,
    avatar_url: null,
    avatarPath: null,
    avatar_path: null,
    avatarMimeType: null,
    avatarSize: null,
    avatarUpdatedAt: safeTimestamp(),
  });

  if (previousPath) {
    try {
      await removeOwnedObject(supabase, userId, previousPath);
    } catch (error) {
      console.error("[avatar-remove:storage]", error?.message || error);
    }
  }

  return { avatarUrl: null, avatarPath: null, profile };
}
