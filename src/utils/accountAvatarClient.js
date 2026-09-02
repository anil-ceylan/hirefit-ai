import { friendlyApiMessage } from "./apiBase.js";

export const MAX_ACCOUNT_AVATAR_BYTES = 5 * 1024 * 1024;
export const ACCOUNT_AVATAR_MIME_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);

export function isSupportedAccountAvatarFile(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "");
  return ACCOUNT_AVATAR_MIME_TYPES.includes(type) || /\.(jpe?g|png|webp)$/i.test(name);
}

export function accountAvatarErrorMessage(error, lang = "TR") {
  const tr = lang === "TR";
  const code = String(error?.code || error?.message || error || "").toUpperCase();
  if (code.includes("TOO_LARGE")) {
    return tr ? "Fotoğraf 5 MB'dan küçük olmalı." : "Photo must be smaller than 5 MB.";
  }
  if (code.includes("UNSUPPORTED")) {
    return tr ? "Yalnızca JPG, PNG veya WebP yükleyebilirsin." : "Only JPG, PNG, or WebP files are supported.";
  }
  if (code.includes("NO_AVATAR_FILE")) {
    return tr ? "Lütfen önce bir fotoğraf seç." : "Please select a photo first.";
  }
  if (code.includes("AUTH") || code.includes("SESSION") || code.includes("TOKEN")) {
    return tr ? "Fotoğrafı güncellemek için tekrar giriş yap." : "Please sign in again to update your photo.";
  }
  return tr ? "Profil fotoğrafı güncellenemedi. Lütfen tekrar dene." : "Profile photo could not be updated. Please try again.";
}

function formDataHeaders(headers = {}) {
  const next = { ...(headers || {}) };
  delete next["Content-Type"];
  delete next["content-type"];
  return next;
}

async function responsePayload(response) {
  return response.json().catch(() => ({}));
}

export async function uploadAccountAvatar({ apiBase = "", getApiAuthHeaders, file, lang = "TR" }) {
  if (!file) throw new Error("NO_AVATAR_FILE");
  if (!isSupportedAccountAvatarFile(file)) throw new Error("AVATAR_FILE_TYPE_UNSUPPORTED");
  if (file.size > MAX_ACCOUNT_AVATAR_BYTES) throw new Error("AVATAR_FILE_TOO_LARGE");
  if (typeof getApiAuthHeaders !== "function") throw new Error("AUTH_SESSION_REQUIRED");

  const headers = formDataHeaders(await getApiAuthHeaders());
  const formData = new FormData();
  formData.append("avatar", file);
  const response = await fetch(`${apiBase}/api/account/avatar`, {
    method: "POST",
    headers,
    body: formData,
  });
  const payload = await responsePayload(response);
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error || friendlyApiMessage(response.status, payload?.error, lang));
    error.code = payload?.error;
    throw error;
  }
  return payload;
}

export async function deleteAccountAvatar({ apiBase = "", getApiAuthHeaders, lang = "TR" }) {
  if (typeof getApiAuthHeaders !== "function") throw new Error("AUTH_SESSION_REQUIRED");
  const headers = await getApiAuthHeaders();
  const response = await fetch(`${apiBase}/api/account/avatar`, {
    method: "DELETE",
    headers,
  });
  const payload = await responsePayload(response);
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error || friendlyApiMessage(response.status, payload?.error, lang));
    error.code = payload?.error;
    throw error;
  }
  return payload;
}
