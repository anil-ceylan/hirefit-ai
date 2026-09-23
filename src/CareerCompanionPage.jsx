import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { createCareerCompanionCase, generateCareerCompanionGuidance, listCareerCompanionCases, saveCareerCompanionOutcome } from "./utils/careerCompanionClient.js";
import "./career-companion.css";

const initialCase = { title: "", what_happened: "", desired_outcome: "", role_context: "", achievements: "", urgency: "medium", manager_context: "" };
const initialOutcome = { manager_response: "", measurable_effect: "", proof_reference: "", outcome_date: "" };
const fields = [
  { key: "what_happened", tr: "Ne oldu?", en: "What happened?", required: true, kind: "textarea", rows: 4, placeholderTr: "Örn. Son değerlendirmeden beri sorumluluklarım genişledi.", placeholderEn: "E.g. My responsibilities have grown since the last review." },
  { key: "desired_outcome", tr: "Hedefin ne?", en: "What outcome do you want?", required: true, kind: "textarea", rows: 3, placeholderTr: "Örn. Bir sonraki seviye ve ücret beklentimi netleştirmek.", placeholderEn: "E.g. Clarify the next level and my compensation expectations." },
  { key: "role_context", tr: "Mevcut rol ve seviye", en: "Current role and level", required: true, kind: "textarea", rows: 3, placeholderTr: "Örn. Kıdemli analist; iki yıldır mevcut roldeyim.", placeholderEn: "E.g. Senior analyst; two years in my current role." },
  { key: "achievements", tr: "Başarılar veya kanıtlar", en: "Achievements or evidence", required: true, kind: "textarea", rows: 4, placeholderTr: "Örn. Sonuçlarını, ölçümleri ve varsa bağlantıları yaz.", placeholderEn: "E.g. Add results, metrics, and links if available." },
  { key: "manager_context", tr: "Yönetici/şirket bağlamı", en: "Manager/company context", required: false, kind: "textarea", rows: 3, placeholderTr: "Opsiyonel: değerlendirme döngüsü, bütçe veya yönetici yaklaşımı.", placeholderEn: "Optional: review cycle, budget, or manager context." },
];
const outcomeFields = [
  { key: "manager_response", tr: "Yönetici yanıtı / sonuç", en: "Manager response / result", required: true, kind: "textarea", rows: 4, placeholderTr: "Örn. Görüşmede bir sonraki adım ve tarih belirlendi.", placeholderEn: "E.g. The next step and date were agreed in the conversation." },
  { key: "measurable_effect", tr: "Ölçülebilir etki", en: "Measurable effect", required: false, kind: "input", placeholderTr: "Opsiyonel: zam oranı, tarih veya yeni sorumluluk.", placeholderEn: "Optional: raise amount, date, or new responsibility." },
  { key: "proof_reference", tr: "Kanıt / referans", en: "Proof / reference", required: false, kind: "input", placeholderTr: "Opsiyonel: doküman, bağlantı veya not.", placeholderEn: "Optional: document, link, or note." },
  { key: "outcome_date", tr: "Sonuç tarihi", en: "Outcome date", required: false, kind: "input", type: "date", placeholderTr: "", placeholderEn: "" },
];
function listValue(value) { return Array.isArray(value) ? value : [value]; }
function Field({ definition, value, onChange, tr, error }) {
  const id = "companion-" + definition.key;
  const label = tr ? definition.tr : definition.en;
  const placeholder = tr ? definition.placeholderTr : definition.placeholderEn;
  return <div className="hf-companion-field">
    <label className="hf-label" htmlFor={id}>{label} <span className={definition.required ? "hf-companion-required" : "hf-companion-optional"}>{definition.required ? (tr ? "(zorunlu)" : "(required)") : (tr ? "(opsiyonel)" : "(optional)")}</span></label>
    {definition.kind === "textarea" ? <textarea id={id} className="hf-input hf-ds-input hf-companion-textarea" rows={definition.rows} value={value} onChange={onChange} placeholder={placeholder} aria-invalid={error ? "true" : undefined} aria-describedby={error ? id + "-error" : undefined} /> : <input id={id} className="hf-input hf-ds-input" type={definition.type || "text"} value={value} onChange={onChange} placeholder={placeholder} aria-invalid={error ? "true" : undefined} aria-describedby={error ? id + "-error" : undefined} />}
    {error ? <p id={id + "-error"} className="hf-companion-field-error">{error}</p> : null}
  </div>;
}
export default function CareerCompanionPage() {
  const { lang, getApiAuthHeaders, user } = useOutletContext();
  const navigate = useNavigate();
  const tr = lang === "TR";
  const [cases, setCases] = useState([]);
  const [form, setForm] = useState(initialCase);
  const [selected, setSelected] = useState(null);
  const [outcome, setOutcome] = useState(initialOutcome);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [outcomeErrors, setOutcomeErrors] = useState({});
  const load = useCallback(async () => { try { const data = await listCareerCompanionCases(getApiAuthHeaders); setCases(data.cases || []); } catch (e) { setError(e.message); } }, [getApiAuthHeaders]);
  useEffect(() => { if (user) load(); }, [user, load]);
  const updateForm = (key) => (event) => { setForm((current) => ({ ...current, [key]: event.target.value })); setFormErrors((current) => ({ ...current, [key]: "" })); };
  const updateOutcome = (key) => (event) => { setOutcome((current) => ({ ...current, [key]: event.target.value })); setOutcomeErrors((current) => ({ ...current, [key]: "" })); };
  const validateCase = () => { const next = {}; fields.filter((field) => field.required).forEach((field) => { if (!form[field.key].trim()) next[field.key] = tr ? "Bu alanı doldur." : "This field is required."; }); if (!form.title.trim()) next.title = tr ? "Başlık ekle." : "Add a title."; setFormErrors(next); if (Object.keys(next).length) window.requestAnimationFrame(() => document.getElementById("companion-title")?.focus()); return Object.keys(next).length === 0; };
  const create = async (event) => { event.preventDefault(); setError(""); if (!validateCase()) return; setBusy(true); try { const data = await createCareerCompanionCase(getApiAuthHeaders, form); const guided = await generateCareerCompanionGuidance(getApiAuthHeaders, data.case.id, lang); setSelected(guided.case); setCases((current) => [guided.case, ...current.filter((item) => item.id !== guided.case.id)]); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const reopen = (item) => { setSelected(item); setForm({ title: item.title || "", what_happened: item.what_happened || "", desired_outcome: item.desired_outcome || "", role_context: item.role_context || "", achievements: item.achievements || "", urgency: item.urgency || "medium", manager_context: item.manager_context || "" }); setFormErrors({}); setError(""); };
  const record = async (event) => { event.preventDefault(); const next = {}; if (!outcome.manager_response.trim()) next.manager_response = tr ? "Bu alanı doldur." : "This field is required."; setOutcomeErrors(next); if (Object.keys(next).length) return; setBusy(true); setError(""); try { await saveCareerCompanionOutcome(getApiAuthHeaders, selected.id, outcome); await load(); setSelected((current) => ({ ...current, status: "outcome_recorded" })); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  return <main className="hf-companion-page"><div className="hf-companion-shell">
    <button type="button" onClick={() => navigate("/dashboard")} className="hf-btn-secondary">← Dashboard</button>
    <header className="hf-companion-header"><p className="hf-companion-eyebrow">Career Companion</p><h1>{tr ? "Terfi veya zam görüşmesine hazırlan" : "Prepare for a promotion or raise conversation"}</h1><p>{tr ? "Durumu netleştir, kanıtlarını toparla ve bir sonraki konuşma için plan oluştur." : "Clarify the situation, gather evidence, and plan your next conversation."}</p></header>
    {error ? <div className="hf-companion-alert" role="alert"><span>{error}</span><button type="button" className="hf-btn-secondary" onClick={load}>{tr ? "Tekrar dene" : "Retry"}</button></div> : null}
    <section className="hf-card hf-companion-card"><div className="hf-companion-section-heading"><div><p className="hf-companion-eyebrow">{tr ? "İlk adım" : "First step"}</p><h2>{tr ? "Terfi / Zam" : "Promotion / Raise"}</h2></div><span className="hf-companion-status">{tr ? "6 kısa alan" : "6 short fields"}</span></div>
      <form onSubmit={create} noValidate className="hf-companion-form">
        <Field definition={{ key: "title", tr: "Başlık", en: "Title", required: true, kind: "input", placeholderTr: "Örn. Yıllık değerlendirme görüşmesi", placeholderEn: "E.g. Annual review conversation" }} value={form.title} onChange={updateForm("title")} tr={tr} error={formErrors.title} />
        {fields.map((field) => <Field key={field.key} definition={field} value={form[field.key]} onChange={updateForm(field.key)} tr={tr} error={formErrors[field.key]} />)}
        <div className="hf-companion-field"><label className="hf-label" htmlFor="companion-urgency">{tr ? "Aciliyet" : "Urgency"} <span className="hf-companion-required">{tr ? "(zorunlu)" : "(required)"}</span></label><select id="companion-urgency" className="hf-input hf-ds-input" value={form.urgency} onChange={updateForm("urgency")}><option value="low">{tr ? "Düşük — zaman var" : "Low — there is time"}</option><option value="medium">{tr ? "Orta — yakında konuşacağım" : "Medium — conversation is coming up"}</option><option value="high">{tr ? "Yüksek — yakında karar vermeliyim" : "High — I need to decide soon"}</option></select></div>
        <div className="hf-companion-form-actions"><button type="submit" disabled={busy} className="hf-btn-primary">{busy ? (tr ? "Hazırlanıyor..." : "Preparing...") : (tr ? "Kaydet ve rehberlik oluştur" : "Save and create guidance")}</button></div>
      </form>
    </section>
    {selected?.guidance ? <section className="hf-card hf-companion-card hf-companion-guidance"><div className="hf-companion-section-heading"><div><p className="hf-companion-eyebrow">{tr ? "Kişisel rehberlik" : "Personal guidance"}</p><h2>{tr ? "Bir sonraki konuşmana hazırlan" : "Prepare for your next conversation"}</h2></div></div>{Object.entries(selected.guidance).map(([key, value]) => <div key={key} className="hf-companion-guidance-block"><h3>{key.replaceAll("_", " ")}</h3><ul>{listValue(value).map((item, index) => <li key={key + "-" + index}>{item}</li>)}</ul></div>)}<form onSubmit={record} noValidate className="hf-companion-form hf-companion-outcome-form"><h2>{tr ? "Yönetici yanıtını kaydet" : "Record manager response"}</h2>{outcomeFields.map((field) => <Field key={field.key} definition={field} value={outcome[field.key]} onChange={updateOutcome(field.key)} tr={tr} error={outcomeErrors[field.key]} />)}<div className="hf-companion-form-actions"><button type="submit" disabled={busy} className="hf-btn-primary">{tr ? "Sonucu kaydet" : "Save outcome"}</button></div></form></section> : null}
    <section className="hf-companion-saved"><div className="hf-companion-section-heading"><h2>{tr ? "Kayıtlı vakalar" : "Saved cases"}</h2></div>{cases.length ? <div className="hf-companion-case-list">{cases.map((item) => <button type="button" className="hf-companion-case" key={item.id} onClick={() => reopen(item)}><span>{item.title || (tr ? "Terfi / Zam vakası" : "Promotion / Raise case")}</span><span>{item.status}</span></button>)}</div> : <p className="hf-companion-empty">{tr ? "Henüz kayıt yok. İlk görüşmeni yukarıdaki formdan planla." : "No saved cases yet. Plan your first conversation above."}</p>}</section>
  </div></main>;
}
