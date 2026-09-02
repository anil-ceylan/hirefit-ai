import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import {
  accountAvatarErrorMessage,
  deleteAccountAvatar,
  isSupportedAccountAvatarFile,
  MAX_ACCOUNT_AVATAR_BYTES,
  uploadAccountAvatar,
} from "../../utils/accountAvatarClient.js";
import {
  getAccountAvatarUrl,
  getAccountInitials,
} from "../../utils/accountAvatarModel.js";
import { isProfileAvatarUploadEnabled } from "../../utils/accountAvatarFeatureFlag.js";

export function AccountAvatar({ user, careerProfile, className = "", alt = "", size = 28 }) {
  const avatarUrl = getAccountAvatarUrl(user, careerProfile);
  const initials = getAccountInitials(user, careerProfile);
  const [failedUrl, setFailedUrl] = useState("");

  useEffect(() => {
    setFailedUrl("");
  }, [avatarUrl]);

  return (
    <span className={`hf-account-avatar ${className}`.trim()} style={{ "--hf-account-avatar-size": `${size}px` }} aria-hidden={!alt}>
      {avatarUrl && failedUrl !== avatarUrl ? (
        <img src={avatarUrl} alt={alt} onError={() => setFailedUrl(avatarUrl)} />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}

export function ProfilePhotoControl(props) {
  if (!isProfileAvatarUploadEnabled()) return null;
  return <ProfilePhotoControlInner {...props} />;
}

function ProfilePhotoControlInner({
  user,
  careerProfile,
  apiBase = "",
  getApiAuthHeaders,
  setCareerProfile,
  lang = "TR",
  compact = false,
}) {
  const tr = lang === "TR";
  const avatarUrl = getAccountAvatarUrl(user, careerProfile);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.setTimeout(() => closeRef.current?.focus?.(), 0);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const resetSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const close = () => {
    if (busy) return;
    resetSelection();
    setError("");
    setNotice("");
    setOpen(false);
  };

  const selectFile = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setError("");
    setNotice("");
    if (!nextFile) {
      resetSelection();
      return;
    }
    if (!isSupportedAccountAvatarFile(nextFile)) {
      resetSelection();
      setError(accountAvatarErrorMessage("AVATAR_FILE_TYPE_UNSUPPORTED", lang));
      return;
    }
    if (nextFile.size > MAX_ACCOUNT_AVATAR_BYTES) {
      resetSelection();
      setError(accountAvatarErrorMessage("AVATAR_FILE_TOO_LARGE", lang));
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const save = async () => {
    if (busy) return;
    if (!file) {
      setError(accountAvatarErrorMessage("NO_AVATAR_FILE", lang));
      return;
    }
    try {
      setBusy(true);
      setError("");
      setNotice("");
      const result = await uploadAccountAvatar({ apiBase, getApiAuthHeaders, file, lang });
      if (result?.profile) setCareerProfile?.(result.profile);
      resetSelection();
      setNotice(tr ? "Profil fotoğrafın güncellendi." : "Your profile photo was updated.");
      window.setTimeout(() => setOpen(false), 450);
    } catch (uploadError) {
      setError(accountAvatarErrorMessage(uploadError, lang));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !avatarUrl) return;
    try {
      setBusy(true);
      setError("");
      setNotice("");
      const result = await deleteAccountAvatar({ apiBase, getApiAuthHeaders, lang });
      if (result?.profile) setCareerProfile?.(result.profile);
      resetSelection();
      setNotice(tr ? "Profil fotoğrafı kaldırıldı." : "Profile photo removed.");
      window.setTimeout(() => setOpen(false), 450);
    } catch (deleteError) {
      setError(accountAvatarErrorMessage(deleteError, lang));
    } finally {
      setBusy(false);
    }
  };

  const preview = previewUrl || avatarUrl;

  return (
    <div className={`hf-profile-photo-control${compact ? " hf-profile-photo-control--compact" : ""}`}>
      <div className="hf-profile-photo-control__avatar">
        {preview ? (
          <img src={preview} alt={tr ? "Profil fotoğrafı önizlemesi" : "Profile photo preview"} />
        ) : (
          <AccountAvatar user={user} careerProfile={careerProfile} size={compact ? 42 : 56} />
        )}
        <button
          type="button"
          className="hf-profile-photo-control__edit"
          onClick={() => setOpen(true)}
          aria-label={tr ? "Profil fotoğrafını düzenle" : "Edit profile photo"}
        >
          <Camera size={14} />
        </button>
      </div>
      {!compact ? (
        <button type="button" className="hf-profile-photo-control__button" onClick={() => setOpen(true)}>
          <Camera size={14} />
          {tr ? "Profil Fotoğrafı" : "Profile Photo"}
        </button>
      ) : null}

      {open ? (
        <div
          className="hf-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="hf-card hf-profile-photo-modal" role="dialog" aria-modal="true" aria-labelledby="hf-profile-photo-title">
            <div className="hf-profile-photo-modal__header">
              <div>
                <p>{tr ? "Profil" : "Profile"}</p>
                <h2 id="hf-profile-photo-title">{tr ? "Profil Fotoğrafı" : "Profile Photo"}</h2>
              </div>
              <button ref={closeRef} type="button" onClick={close} disabled={busy} aria-label={tr ? "Kapat" : "Close"}>
                ×
              </button>
            </div>
            <div className="hf-profile-photo-modal__preview">
              {preview ? (
                <img src={preview} alt={tr ? "Seçilen profil fotoğrafı" : "Selected profile photo"} />
              ) : (
                <AccountAvatar user={user} careerProfile={careerProfile} size={96} />
              )}
            </div>
            <label className="hf-profile-photo-modal__upload">
              <span>
                <Upload size={15} />
                {tr ? "Fotoğraf Yükle" : "Upload Photo"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={selectFile}
                disabled={busy}
              />
            </label>
            <p className="hf-profile-photo-modal__helper">
              {tr ? "JPG, PNG veya WebP. En fazla 5 MB." : "JPG, PNG, or WebP. Maximum 5 MB."}
            </p>
            {error ? <div className="hf-settings-error" role="alert">{error}</div> : null}
            {notice ? <div className="hf-settings-notice" role="status">{notice}</div> : null}
            <div className="hf-profile-photo-modal__actions">
              <button type="button" className="hf-btn-ghost" onClick={remove} disabled={busy || !avatarUrl}>
                <Trash2 size={14} />
                {tr ? "Fotoğrafı Kaldır" : "Remove Photo"}
              </button>
              <div>
                <button type="button" className="hf-btn-ghost" onClick={close} disabled={busy}>
                  {tr ? "İptal" : "Cancel"}
                </button>
                <button type="button" className="hf-btn-primary" onClick={save} disabled={busy || !file}>
                  {busy ? (tr ? "Kaydediliyor..." : "Saving...") : (tr ? "Kaydet" : "Save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
