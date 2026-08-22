import { createClient } from "@supabase/supabase-js";

const BUCKET = "career-cvs";
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 365 * 5; // 5 years

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function safeFileName(name) {
  return String(name || "cv")
    .replace(/[^\w.\-()+ ]/g, "_")
    .slice(0, 120);
}

export function isAllowedCvMime(mimeType, fileName = "") {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "application/pdf") return true;
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return true;
  return /\.(pdf|docx)$/i.test(fileName);
}

function mockUploadResult(userId, buffer, originalName, mimeType) {
  const fileName = safeFileName(originalName);
  return {
    path: `mock:${userId}/${Date.now()}-${fileName}`,
    url: null,
    fileName,
    mimeType: mimeType || "application/octet-stream",
    size: buffer?.length || 0,
    mock: true,
  };
}

/**
 * @param {string} userId
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} mimeType
 */
export async function uploadUserCv(userId, buffer, originalName, mimeType) {
  const fileName = safeFileName(originalName);
  const size = buffer?.length || 0;

  if (!userId || !buffer?.length) {
    throw new Error("No file uploaded");
  }

  const supabase = getServiceClient();
  if (!supabase) {
    console.warn("[cv-upload] Supabase unavailable — mock accept");
    return mockUploadResult(userId, buffer, originalName, mimeType);
  }

  const ext = /\.docx$/i.test(originalName)
    ? ".docx"
    : /\.pdf$/i.test(originalName)
      ? ".pdf"
      : mimeType?.includes("word")
        ? ".docx"
        : ".pdf";
  const objectPath = `${userId}/cv-${Date.now()}-${fileName.replace(/\.[^.]+$/, "")}${ext}`;

  try {
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (uploadError) {
      console.warn("[cv-upload] storage upload failed:", uploadError.message);
      return mockUploadResult(userId, buffer, originalName, mimeType);
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SEC);
    if (signError) {
      console.warn("[cv-upload] signed URL failed:", signError.message);
      return { ...mockUploadResult(userId, buffer, originalName, mimeType), path: objectPath };
    }

    return {
      path: objectPath,
      url: signed.signedUrl,
      fileName,
      mimeType: mimeType || "application/octet-stream",
      size,
      mock: false,
    };
  } catch (e) {
    console.warn("[cv-upload]", e?.message || e);
    return mockUploadResult(userId, buffer, originalName, mimeType);
  }
}
