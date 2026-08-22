import { useCallback, useId, useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import {
  CV_STATUS,
  CV_STATUS_OPTIONS,
  CV_FRESHNESS_OPTIONS,
  needsCvUpload,
} from "../../../lib/careerOnboarding/cvOptions.js";
import { uploadOnboardingCv } from "../../utils/careerOnboardingClient.js";

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 8 * 1024 * 1024;

function cvUploadStages(tr) {
  return [
    { id: "selected", label: tr ? "Dosya seçiliyor" : "Selecting file" },
    { id: "uploaded", label: tr ? "Dosya yüklendi" : "File received" },
    { id: "reading", label: tr ? "CV okunuyor" : "Reading CV" },
    { id: "extracting", label: tr ? "Deneyimler ve beceriler ayrıştırılıyor" : "Extracting experience and skills" },
    { id: "ready", label: tr ? "Kariyer kanıtları hazırlanıyor" : "Preparing career evidence" },
    { id: "complete", label: tr ? "Analize hazır" : "Ready for analysis" },
  ];
}

function Chip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hf-onboard-chip hf-onboard-chip--lg${active ? " hf-onboard-chip--active" : ""}`}
    >
      {label}
    </button>
  );
}

export default function HFCvSection({
  lang = "TR",
  cv,
  onCvChange,
  getApiAuthHeaders,
  onCvFileSelected,
}) {
  const tr = lang === "TR";
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadStage, setUploadStage] = useState("selected");
  const [uploadNotice, setUploadNotice] = useState("");

  const showUpload = needsCvUpload(cv?.cvStatus);
  const showFreshness = showUpload;
  const hasFileLabel = Boolean(cv?.cvFileName);

  const patchCv = useCallback(
    (patch) => onCvChange?.({ ...cv, ...patch }),
    [cv, onCvChange]
  );

  const setStatus = (cvStatus) => {
    setUploadNotice("");
    setUploadStatus("idle");
    setUploadStage("selected");
    if (cvStatus === CV_STATUS.NONE) {
      onCvFileSelected?.(null);
      onCvChange?.({
        cvStatus,
        cvExists: false,
        cvLastUpdated: "",
        cvLastUpdatedRange: "",
        cvFileUrl: null,
        cvFileName: null,
        cvUploaded: false,
        cvSignalCount: 0,
      });
      return;
    }
    onCvChange?.({
      ...cv,
      cvStatus,
      cvExists: true,
    });
  };

  const uploadFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setUploadNotice(
        tr ? "Dosya en fazla 8 MB olabilir." : "File must be 8 MB or smaller."
      );
      return;
    }
    const okType =
      /\.(pdf|docx)$/i.test(file.name) ||
      file.type === "application/pdf" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!okType) {
      setUploadNotice(tr ? "Yalnızca PDF veya DOCX yükleyebilirsin." : "Only PDF or DOCX files are supported.");
      return;
    }

    setUploadNotice("");
    setUploadStatus("uploading");
    setUploadStage("selected");
    onCvFileSelected?.(file);
    setUploadStage("uploaded");

    let result;
    try {
      setUploadStage("reading");
      result = await uploadOnboardingCv(null, getApiAuthHeaders, file);
      setUploadStage("extracting");
    } catch {
      result = { success: false };
    }

    if (result.success) {
      setUploadStage("ready");
      patchCv({
        cvFileUrl: result.fileUrl || null,
        cvFileName: result.fileName || file.name,
        cvUploaded: true,
      });
      setUploadStatus("done");
      setUploadStage("complete");
      if (result.mock || !result.fileUrl) {
        setUploadNotice(
          tr
        ? "CV yerel olarak yüklendi. Daha güvenilir analiz için CV’mi Analiz Et butonuyla işle."
            : "CV recorded. Full storage sync when the connection is ready."
        );
      }
      return;
    }

    patchCv({ cvFileUrl: null, cvFileName: file.name, cvUploaded: true });
    setUploadStatus("skipped");
    setUploadStage("complete");
    setUploadNotice(
      tr
        ? "CV yerel olarak yüklendi. Daha güvenilir analiz için CV’mi Analiz Et butonuyla işle."
        : "CV was saved locally. It needs to be processed again for analysis."
    );
  };

  const onFileInput = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    uploadFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFile(e.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    onCvFileSelected?.(null);
    patchCv({ cvFileUrl: null, cvFileName: null, cvUploaded: false, cvSignalCount: 0 });
    setUploadStatus("idle");
    setUploadStage("selected");
    setUploadNotice("");
  };

  const stages = cvUploadStages(tr);
  const stageIndex = stages.findIndex((stage) => stage.id === uploadStage);
  const visibleStages = uploadStatus === "uploading" || hasFileLabel;

  return (
    <div className="hf-cv-section">
      <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>
        {tr ? "CV Durumu" : "CV status"}
      </div>
      <div className="hf-onboard-looking-chips" style={{ marginBottom: 16 }}>
        {CV_STATUS_OPTIONS.map((o) => (
          <Chip
            key={o.id}
            active={cv?.cvStatus === o.id}
            label={tr ? o.labelTr : o.labelEn}
            onClick={() => setStatus(o.id)}
          />
        ))}
      </div>

      {showUpload ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
            {tr ? "AI kişiselleştirmesini güçlendirmek için CV ekle" : "Add your CV to significantly improve AI personalization"}
          </div>
          <p className="hf-onboard-helper" style={{ marginBottom: 8 }}>
            {tr
              ? "CV’ni yükleyerek çok daha kişisel bir Career Snapshot aç."
              : "Upload your CV to unlock a significantly more personalized Career Snapshot."}
          </p>
          <ul className="hf-cv-benefits">
            <li>{tr ? "Daha doğru Kariyer Kimliği" : "Better Career Identity"}</li>
            <li>{tr ? "Daha güçlü recruiter analizi" : "Better Recruiter Analysis"}</li>
            <li>{tr ? "Daha isabetli rol eşleşmesi" : "Better Role Match"}</li>
            <li>{tr ? "Daha net eksik analizi" : "Better Gap Detection"}</li>
            <li>{tr ? "Daha güvenilir Career Score" : "Better Career Score"}</li>
          </ul>

          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="hf-cv-section__file-input"
            onChange={onFileInput}
          />

          {!hasFileLabel ? (
            <div
              className={`hf-dropzone hf-cv-dropzone${dragOver ? " hf-dropzone--drag" : ""}${uploadStatus === "uploading" ? " hf-dropzone--loading" : ""}`}
              role="button"
              tabIndex={0}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onClick={() => uploadStatus !== "uploading" && inputRef.current?.click()}
            >
              {uploadStatus === "uploading" ? (
                <div className="hf-cv-dropzone__inner">
                  <Loader2 size={22} className="hf-cv-dropzone__spin" aria-hidden />
                  <span>{tr ? "Yükleniyor…" : "Uploading…"}</span>
                </div>
              ) : (
                <div className="hf-cv-dropzone__inner">
                  <Upload size={22} color="#60a5fa" aria-hidden />
                  <span className="hf-cv-dropzone__title">
                    {tr ? "PDF veya DOCX sürükle-bırak" : "Drag & drop PDF or DOCX"}
                  </span>
                  <span className="hf-cv-dropzone__hint">
                    {tr ? "veya dosya seç · en fazla 8 MB" : "or choose a file · max 8 MB"}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="hf-cv-file-card">
              <div className="hf-cv-file-card__row">
                <FileText size={18} color="#60a5fa" aria-hidden />
                <div className="hf-cv-file-card__meta">
                  <span className="hf-cv-file-card__name">{cv.cvFileName}</span>
                  <span className="hf-cv-file-card__status">
                    {uploadStatus === "uploading"
                      ? tr
                        ? "Yükleniyor…"
                        : "Uploading…"
                      : uploadStatus === "skipped"
                        ? tr
                          ? "CV yerel olarak yüklendi. Analiz bekliyor."
                          : "CV saved locally. Analysis pending."
                        : tr
                          ? "CV yüklendi"
                          : "CV uploaded"}
                  </span>
                </div>
              </div>
              <div className="hf-cv-file-card__actions">
                <button
                  type="button"
                  className="hf-cv-file-card__btn"
                  onClick={() => inputRef.current?.click()}
                >
                  {tr ? "Dosyayı değiştir" : "Replace file"}
                </button>
                <button type="button" className="hf-cv-file-card__btn hf-cv-file-card__btn--muted" onClick={clearFile}>
                  <X size={14} aria-hidden />
                  {tr ? "Kaldır" : "Remove"}
                </button>
              </div>
            </div>
          )}

          {uploadNotice ? (
            <p className="hf-onboard-helper hf-cv-section__notice" style={{ marginTop: 8 }}>
              {uploadNotice}
            </p>
          ) : null}

          {visibleStages ? (
            <ol className="hf-cv-upload-stages" role="status" aria-live="polite">
              {stages.map((stage, index) => (
                <li
                  key={stage.id}
                  className={
                    index < stageIndex || uploadStatus === "done" || uploadStatus === "skipped"
                      ? "is-complete"
                      : index === stageIndex
                        ? "is-active"
                        : ""
                  }
                >
                  <span aria-hidden="true" />
                  {stage.label}
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : null}

      {showFreshness ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
            {tr ? "CV'n ne kadar güncel? *" : "How current is your CV? *"}
          </div>
          <p className="hf-onboard-helper" style={{ marginBottom: 8 }}>
            {tr
              ? "Recruiter güveni ve analiz doğruluğunu etkiler."
              : "Affects recruiter confidence and analysis accuracy."}
          </p>
          <div className="hf-onboard-looking-chips">
            {CV_FRESHNESS_OPTIONS.map((o) => (
              <Chip
                key={o.id}
                active={(cv?.cvLastUpdatedRange || cv?.cvLastUpdated) === o.id}
                label={tr ? o.labelTr : o.labelEn}
                onClick={() => patchCv({ cvLastUpdatedRange: o.id, cvLastUpdated: o.id })}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

