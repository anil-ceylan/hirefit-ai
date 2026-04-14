import { useMemo } from "react";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toText(v) {
  return String(v || "").trim();
}

function uniqByRole(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const role = toText(r.role);
    if (!role) continue;
    const k = role.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function detectRoleCandidates({ engineV2, analysisData, cvText, lang }) {
  const fromV2 = Array.isArray(engineV2?.RoleFit?.role_fit)
    ? engineV2.RoleFit.role_fit.map((r) => ({
        role: toText(r.role),
        score: clamp(Number(r.score) || 0, 0, 100),
        why: toText(r.evidence),
      }))
    : [];
  const fromLegacy = Array.isArray(analysisData?.role_matches)
    ? analysisData.role_matches.map((r) => ({
        role: toText(r.role),
        score: clamp(Number(r.match_score) || 0, 0, 100),
        why: "",
      }))
    : [];
  let rows = uniqByRole([...fromV2, ...fromLegacy]).sort((a, b) => b.score - a.score);

  const cv = toText(cvText).toLowerCase();
  const inferred = [];
  const pushInf = (role, score, why) => inferred.push({ role, score, why });
  if (/sql|python|power bi|tableau|analytics|analysis|veri/i.test(cv)) {
    pushInf("Data Analyst", 72, lang === "TR"
      ? "CV'nde analitik düşünme ve veriyle çalışma sinyali var."
      : "Your CV already shows analytical thinking and data signal.");
  }
  if (/business|stakeholder|report|excel|process|iş/i.test(cv)) {
    pushInf("Business Analyst", 68, lang === "TR"
      ? "İş ve veri yorumlama arasında köprü kuran bir profilin var."
      : "Your background aligns with business plus data interpretation.");
  }
  if (/product|roadmap|feature|user|ux/i.test(cv)) {
    pushInf("Product Analyst", 64, lang === "TR"
      ? "Ürün ve karar desteği tarafında güçlü sinyallerin var."
      : "You show good signal for product-facing analytical work.");
  }
  if (/operations|operasyon|planning|forecast/i.test(cv)) {
    pushInf("Operations Analyst", 62, lang === "TR"
      ? "Operasyonel düşünme ve yapı kurma sinyalin net."
      : "You show operational structure and process thinking.");
  }

  rows = uniqByRole([...rows, ...inferred]).sort((a, b) => b.score - a.score);
  const fallback = lang === "TR"
    ? [
        { role: "Veri Analisti", score: 70, why: "Analitik düşünme ve yapılandırılmış problem çözme sinyalin güçlü." },
        { role: "İş Analisti", score: 66, why: "İş hedefi ve veri yorumlama tarafına doğal bir geçişin var." },
        { role: "Operasyon Analisti", score: 62, why: "Süreç, raporlama ve karar desteği tarafında güçlü temelin var." },
      ]
    : [
        { role: "Data Analyst", score: 70, why: "You already show analytical thinking and structured problem solving." },
        { role: "Business Analyst", score: 66, why: "Your background aligns with business plus data interpretation." },
        { role: "Operations Analyst", score: 62, why: "You show strong process and reporting foundations." },
      ];

  const finalRows = rows.slice(0, 3);
  if (finalRows.length < 3) {
    for (const f of fallback) {
      if (finalRows.length >= 3) break;
      if (!finalRows.some((x) => x.role.toLowerCase() === f.role.toLowerCase())) finalRows.push(f);
    }
  }
  return finalRows.slice(0, 3);
}

function bestPathForRole(role, lang) {
  const r = toText(role).toLowerCase();
  if (r.includes("data")) return lang === "TR" ? "Veri Analisti → Ürün Analisti → Ürün Yöneticisi" : "Data Analyst → Product Analyst → Product Manager";
  if (r.includes("business")) return lang === "TR" ? "İş Analisti → Strateji Analisti → Strateji Yöneticisi" : "Business Analyst → Strategy Analyst → Strategy Manager";
  if (r.includes("product")) return lang === "TR" ? "Ürün Analisti → Ürün Uzmanı → Ürün Yöneticisi" : "Product Analyst → Product Specialist → Product Manager";
  return lang === "TR" ? "Analist → Kıdemli Analist → Yönetici" : "Analyst → Senior Analyst → Manager";
}

function buildProjectIdea({ topRole, biggestGap, missingSkills, lang }) {
  const ms = (missingSkills || []).map((x) => toText(x)).filter(Boolean);
  const keySkill = ms[0] || (lang === "TR" ? "SQL ve dashboard" : "SQL and dashboarding");
  const gap = toText(biggestGap) || (lang === "TR" ? "saha kanıtı eksikliği" : "lack of real-world proof");
  const role = toText(topRole) || (lang === "TR" ? "Analist" : "Analyst");
  return {
    title: lang === "TR"
      ? `${role} için Gerçek Dünya Etki Dashboard'u`
      : `Real-World Impact Dashboard for ${role}`,
    context: lang === "TR"
      ? `Bu proje, ${gap} boşluğunu kapatırken mevcut analitik yönünü görünür hale getirir.`
      : `This project closes your ${gap} gap while making your existing analytical strength visible.`,
    dataSource: lang === "TR"
      ? `Kaggle veya World Bank verisi kullan; odağı ${keySkill} sinyaline bağla.`
      : `Use Kaggle or World Bank data and tie the output to ${keySkill} signal.`,
    outcome: lang === "TR"
      ? "Analitik + iş etkisi sinyalini aynı anda kanıtlar ve fit skorunu doğrudan güçlendirir."
      : "Proves analytical + business impact in one asset and directly strengthens your fit signal.",
  };
}

function roadmapPhases({ topRole, biggestGap, missingSkills, lang }) {
  const ms = (missingSkills || []).map((x) => toText(x)).filter(Boolean);
  const skillA = ms[0] || (lang === "TR" ? "SQL" : "SQL");
  const skillB = ms[1] || (lang === "TR" ? "Dashboard" : "dashboarding");
  const gap = toText(biggestGap) || (lang === "TR" ? "rol konumlanması" : "role positioning");
  const role = toText(topRole) || (lang === "TR" ? "Analist" : "Analyst");
  return {
    p1: [
      lang === "TR" ? `${role} odağını CV özetinin ilk 2 satırına taşı.` : `Rewrite your CV summary around ${role} in first 2 lines.`,
      lang === "TR" ? `${gap} ile ilgili bölümü net bir cümleyle düzelt.` : `Fix the ${gap} signal with one explicit positioning line.`,
      lang === "TR" ? "Deneyim kısmına 2 ölçülebilir sonuç (%, zaman, gelir) ekle." : "Add 2 measurable outcomes (%) to your experience bullets.",
    ],
    p2: [
      lang === "TR" ? "Kişisel proje dashboard'unu bitir ve tek linkte yayınla." : "Build and publish the personalized dashboard project.",
      lang === "TR" ? `${skillA} temelini role odaklı senaryolarla tamamla.` : `Learn ${skillA} basics on role-relevant scenarios.`,
      lang === "TR" ? `${skillB} çıktısını işe alım uzmanının okuyacağı formata çevir.` : `Convert ${skillB} output into recruiter-readable proof.`,
    ],
    p3: [
      lang === "TR" ? `${role} ve yakın rollere odaklan; alakasız ilanları ele.` : `Apply only to ${role} and adjacent tracks; cut mismatch roles.`,
      lang === "TR" ? `İlanlarda SQL/BI/analitik sinyali olan şirketleri hedefle.` : `Target companies with clear SQL/BI/analytics demand.`,
      lang === "TR" ? `Her başvuruda özeti ilana göre 3 dakikada mikro düzenle.` : `Do a 3-minute role-tailored summary tweak before each application.`,
    ],
  };
}

function blockStyle() {
  return {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    background: "rgba(255,255,255,0.02)",
    padding: "18px 20px",
    marginBottom: 14,
  };
}

function LockedHint({ lang, onUpgrade }) {
  return (
    <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(99,102,241,0.28)", background: "rgba(99,102,241,0.08)", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <div style={{ fontSize: 12, color: "#94a3b8" }}>
        {lang === "TR" ? "Detayları görmek için Pro’ya geç." : "Upgrade to Pro to unlock full details."}
      </div>
      <button type="button" onClick={onUpgrade} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
        {lang === "TR" ? "Pro'ya geç →" : "Upgrade to Pro →"}
      </button>
    </div>
  );
}

export default function PersonalizedRoadmapPage({ navigate, lang, t, isPro, openUpgrade, analysisData, engineV2, cvText, jdText, alignmentScore }) {
  const roleRows = useMemo(
    () => detectRoleCandidates({ engineV2, analysisData, cvText, lang }),
    [engineV2, analysisData, cvText, lang],
  );
  const topRole = roleRows[0]?.role || "";
  const biggestGap = toText(engineV2?.Gaps?.biggest_gap) || toText(analysisData?.rejection_reasons?.high?.[0]);
  const missingSkills = useMemo(
    () => (engineV2?.ATS?.missing_keywords || analysisData?.missing_skills || []).map((x) => toText(x)).filter(Boolean),
    [engineV2, analysisData],
  );
  const project = useMemo(
    () => buildProjectIdea({ topRole, biggestGap, missingSkills, lang }),
    [topRole, biggestGap, missingSkills, lang],
  );
  const phases = useMemo(
    () => roadmapPhases({ topRole, biggestGap, missingSkills, lang }),
    [topRole, biggestGap, missingSkills, lang],
  );
  const path = useMemo(() => bestPathForRole(topRole, lang), [topRole, lang]);
  const baseScore = Number.isFinite(Number(alignmentScore)) ? Number(alignmentScore) : Number(analysisData?.alignment_score || 45);
  const projected = clamp(Math.round(baseScore + 22), 0, 92);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 24px 48px" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate("/app")} style={{ marginBottom: 14, background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
          {lang === "TR" ? "← Analize dön" : "← Back to analysis"}
        </button>
        <h1 style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px,4vw,38px)", color: "#f8fafc", letterSpacing: "-0.02em" }}>
          {lang === "TR" ? "Your best path forward" : "Your best path forward"}
        </h1>
      </div>

      <div style={blockStyle()}>
        <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          {lang === "TR" ? "Role redirection" : "Role redirection"}
        </div>
        <div style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 10 }}>
          {lang === "TR"
            ? "Bu rol için güçlü bir eşleşme görünmüyor. Profiline göre daha güçlü olduğun roller:"
            : "You are not a strong fit for this role. Based on your profile, you are a stronger fit for:"}
        </div>
        {roleRows.map((r, i) => (
          <div key={`${r.role}-${i}`} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 8, background: "rgba(15,23,42,0.45)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{r.role} ({Math.round(r.score)}%)</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{r.why || (lang === "TR" ? "Mevcut CV sinyalin bu role daha yakın." : "Your current CV signal aligns better with this role.")}</div>
          </div>
        ))}
      </div>

      {isPro ? (
        <>
          <div style={blockStyle()}>
            <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              {lang === "TR" ? "Career path" : "Career path"}
            </div>
            <div style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 6 }}>
              {lang === "TR" ? "Senin için en iyi yol:" : "Best path for you:"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#a5b4fc", marginBottom: 8 }}>{path}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {lang === "TR"
                ? "Bu yol, mevcut güçlü yanlarını büyütürken kritik boşlukları kapatır."
                : "This path builds on your strengths while closing your critical gaps."}
            </div>
          </div>

          <div style={blockStyle()}>
            <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              {lang === "TR" ? "Best project for you" : "Best project for you"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", marginBottom: 10 }}>{project.title}</div>
            <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 6 }}>{project.context}</div>
            <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 6 }}>{project.dataSource}</div>
            <div style={{ fontSize: 13, color: "#a7f3d0" }}>{project.outcome}</div>
          </div>
        </>
      ) : (
        <div style={blockStyle()}>
          <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            {lang === "TR" ? "Best project for you" : "Best project for you"}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>{project.title}</div>
          <LockedHint lang={lang} onUpgrade={openUpgrade} />
        </div>
      )}

      <div style={blockStyle()}>
        <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          {lang === "TR" ? "Execution roadmap" : "Execution roadmap"}
        </div>
        <div style={{ fontSize: 13, color: "#a5b4fc", marginBottom: 6 }}>{lang === "TR" ? "PHASE 1 — Immediate Fix (0–7 gün)" : "PHASE 1 — Immediate Fix (0–7 days)"}</div>
        {phases.p1.map((x, i) => <div key={`p1-${i}`} style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 5 }}>→ {x}</div>)}

        {isPro ? (
          <>
            <div style={{ fontSize: 13, color: "#a5b4fc", marginTop: 12, marginBottom: 6 }}>{lang === "TR" ? "PHASE 2 — Skill + Proof (2–4 hafta)" : "PHASE 2 — Skill + Proof (2–4 weeks)"}</div>
            {phases.p2.map((x, i) => <div key={`p2-${i}`} style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 5 }}>→ {x}</div>)}

            <div style={{ fontSize: 13, color: "#a5b4fc", marginTop: 12, marginBottom: 6 }}>{lang === "TR" ? "PHASE 3 — Application Strategy" : "PHASE 3 — Application Strategy"}</div>
            {phases.p3.map((x, i) => <div key={`p3-${i}`} style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 5 }}>→ {x}</div>)}
          </>
        ) : (
          <LockedHint lang={lang} onUpgrade={openUpgrade} />
        )}
      </div>

      {isPro ? (
        <div style={blockStyle()}>
          <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            {lang === "TR" ? "Expected transformation" : "Expected transformation"}
          </div>
          <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 6 }}>
            {lang === "TR" ? "Bu yolu uygularsan:" : "If you follow this path:"}
          </div>
          <div style={{ fontSize: 13, color: "#a7f3d0", marginBottom: 4 }}>→ {lang === "TR" ? `Fit skoru: ${Math.round(baseScore)} → ${projected}+` : `Fit score: ${Math.round(baseScore)} → ${projected}+`}</div>
          <div style={{ fontSize: 13, color: "#a7f3d0" }}>→ {lang === "TR" ? "Mülakat olasılığı belirgin şekilde artar." : "Interview probability increases significantly."}</div>
        </div>
      ) : null}
    </div>
  );
}

