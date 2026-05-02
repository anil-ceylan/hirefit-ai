import { Fragment, useMemo } from "react";
import { motion } from "framer-motion";
import { parseActionPlan, enrichActionPlan, pickDoThisNextStep } from "../lib/analyze-v2/actionPlanNormalize.js";
import {
  ShieldCheck,
  Lock,
  Eye,
  Server,
  BadgeCheck,
  X,
  Sparkles,
  CheckCircle2,
  Cpu,
  Wand2,
  RotateCcw,
  Zap,
  Loader2,
  TrendingUp,
  FileText,
} from "lucide-react";

const container = {
  maxWidth: "1500px",
  margin: "0 auto",
  padding: "0 24px",
  width: "100%",
};

const pill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 16px",
  borderRadius: 999,
  background: "rgba(59,130,246,0.08)",
  border: "1px solid rgba(59,130,246,0.15)",
  fontSize: "11px",
  fontWeight: 700,
  color: "#60a5fa",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: 16,
};

const h2 = {
  fontFamily: "'Syne', sans-serif",
  fontSize: "clamp(32px, 4vw, 52px)",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  marginBottom: 14,
  lineHeight: 1.1,
  color: "#f8fafc",
};

const sub = {
  color: "#94a3b8",
  fontSize: "16px",
  maxWidth: 560,
  margin: "0 auto 48px",
  lineHeight: 1.65,
};

const RAW_PARSE_FAIL_RE = /\b(parsing failed|gpt parsing failed|parse failed|json parse)\b/i;

function softReason(text, lang) {
  const raw = String(text || "").trim();
  if (!raw) return raw;
  if (RAW_PARSE_FAIL_RE.test(raw)) {
    return lang === "TR" ? "Analiz çıktısı ayrıştırılamadı." : "We couldn't parse this insight cleanly.";
  }
  return raw;
}

function glassCardStyle(extra = {}) {
  return {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "linear-gradient(165deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
    boxShadow:
      "0 24px 64px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(0,0,0,0.35)",
    backdropFilter: "blur(20px) saturate(1.25)",
    WebkitBackdropFilter: "blur(20px) saturate(1.25)",
    ...extra,
  };
}

export function SocialProofSection({ lang }) {
  const tr = lang === "TR";
  const logos = tr
    ? ["Teknoloji", "Finans", "Ürün", "Danışmanlık", "Startup"]
    : ["Technology", "Finance", "Product", "Consulting", "Startups"];
  return (
    <section className="hf-section hf-section--social" style={{ padding: "56px 0 32px" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <span className="hf-badge-soft">
              <Cpu size={12} strokeWidth={2.2} />
              {tr ? "Karar öncelikli" : "Decision-first"}
            </span>
            <span className="hf-badge-soft">
              <Sparkles size={12} strokeWidth={2.2} />
              AI-powered
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 10,
            opacity: 0.85,
          }}
        >
          {logos.map((name) => (
            <div
              key={name}
              className="hf-micro-lift"
              style={{
                ...glassCardStyle({ padding: "10px 18px", borderRadius: 999 }),
                fontSize: 12,
                fontWeight: 600,
                color: "#94a3b8",
              }}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection({ lang }) {
  const tr = lang === "TR";
  const steps = tr
    ? [
        { n: "1", title: "CV + ilanı yapıştır", body: "Gerçek ilan metniyle eşleştiririz — tahmin değil.", icon: FileText },
        { n: "2", title: "Kararı ve boşlukları gör", body: "Red riski, eksik anahtar kelimeler ve net boşluklar.", icon: Zap },
        { n: "3", title: "Düzelt → tekrar analiz et", body: "Aynı döngü: düzelt, tekrar çalıştır, ilerlemeyi gör.", icon: RotateCcw },
      ]
    : [
        { n: "1", title: "Paste CV + real JD", body: "We match against the actual posting — not guesses.", icon: FileText },
        { n: "2", title: "See the decision + gaps", body: "Rejection risk, missing keywords, and clear gaps.", icon: Zap },
        { n: "3", title: "Fix → re-run", body: "Same loop: fix, re-analyze, watch strength climb.", icon: RotateCcw },
      ];

  return (
    <section className="hf-section hf-section--how" style={{ padding: "72px 0" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div style={pill}>{tr ? "Nasıl çalışır" : "How it works"}</div>
          <h2 style={h2}>{tr ? "Üç adımda netlik" : "Clarity in three steps"}</h2>
          <p style={sub}>
            {tr
              ? "Skor için değil — başvurup başvurmama ve sıradaki hamle için buradasınız."
              : "Not for vanity scores — you’re here for apply / don’t apply and your next move."}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 18,
          }}
        >
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="hf-micro-lift hf-glass-card"
              style={{
                ...glassCardStyle({ padding: 26 }),
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: 14,
                }}
              >
                <s.icon size={18} color="#a5b4fc" />
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#64748b", marginBottom: 8 }}>STEP {s.n}</div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, margin: "0 0 10px", color: "#f1f5f9" }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.6, color: "#94a3b8" }}>{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DecisionEngineExplainedSection({ lang }) {
  const tr = lang === "TR";
  const blocks = tr
    ? [
        { k: "Sorun", tone: "#fb7185", body: "Tek cümlede neden eleniyorsun — spekülasyon değil, sinyal." },
        { k: "Boşluk", tone: "#fbbf24", body: "Eksik beceri, anahtar kelime ve deneyim sinyali yan yana." },
        { k: "Aksiyon", tone: "#4ade80", body: "Bugün yapılacak tek net hamle — sonra tekrar analiz." },
      ]
    : [
        { k: "Problem", tone: "#fb7185", body: "One line on why you’re filtered out — signal, not vibes." },
        { k: "Gap", tone: "#fbbf24", body: "Missing skills, keywords, and experience signal — side by side." },
        { k: "Action", tone: "#4ade80", body: "One finishable move today — then re-run the same analysis." },
      ];

  return (
    <section className="hf-section hf-section--decision" style={{ padding: "72px 0" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={pill}>{tr ? "Karar motoru" : "Decision engine"}</div>
          <h2 style={h2}>{tr ? "Skor değil — karar + aksiyon" : "Not a score — a decision + action"}</h2>
          <p style={sub}>
            {tr
              ? "HireFit bir ‘analiz aracı’ gibi değil; başvuru öncesi karar ve tekrar çalıştırma döngüsü gibi davranır."
              : "HireFit behaves less like a ‘smart analyzer’ and more like a pre-apply decision loop you can re-run."}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {blocks.map((b) => (
            <div key={b.k} className="hf-micro-lift hf-glass-card" style={glassCardStyle({ padding: 22 })}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: b.tone, marginBottom: 10 }}>{b.k}</div>
              <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.65, color: "#cbd5e1" }}>{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BeforeAfterSection({ lang }) {
  const tr = lang === "TR";
  return (
    <section className="hf-section hf-section--before-after" style={{ padding: "72px 0" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={pill}>{tr ? "Önce / Sonra" : "Before / After"}</div>
          <h2 style={h2}>{tr ? "Aynı başvuru — daha güçlü profil" : "Same application — stronger profile"}</h2>
          <p style={sub}>
            {tr
              ? "Örnek: ölçülebilir etki + doğru anahtar kelimeler → profil gücü yükselir."
              : "Example: measurable impact + the right keywords → profile strength climbs."}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
            maxWidth: 920,
            margin: "0 auto",
          }}
        >
          <div className="hf-micro-lift hf-glass-card" style={glassCardStyle({ padding: 24 })}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#fb7185", marginBottom: 12 }}>{tr ? "ÖNCE" : "BEFORE"}</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>
              {(tr
                ? ["Belirsiz madde başlıkları", "İlanda geçen kritik kelimeler eksik", "Etki ölçülebilir değil"]
                : ["Vague bullets", "Missing critical JD keywords", "No measurable impact"]).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{tr ? "Profil gücü" : "Profile strength"}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: "#f87171" }}>54</div>
            </div>
          </div>
          <div className="hf-micro-lift hf-glass-card" style={glassCardStyle({ padding: 24 })}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#4ade80", marginBottom: 12 }}>{tr ? "SONRA" : "AFTER"}</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>
              {(tr
                ? ["Madde başına metrik + sonuç", "İlan diliyle hizalı anahtar kelimeler", "7 saniyede okunur hikâye"]
                : ["Metrics + outcomes per bullet", "Keywords aligned to the posting", "A story recruiters scan in 7s"]).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{tr ? "Profil gücü" : "Profile strength"}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: "#4ade80" }}>81</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrustSection({ lang }) {
  const tr = lang === "TR";
  const items = tr
    ? [
        {
          icon: ShieldCheck,
          title: "Veriniz sizde kalır",
          body: "CV ve ilan metniniz yalnızca analiz için işlenir; üçüncü taraf model sağlayıcıları tarafından model eğitimi için kullanılmaz (varsayılan API politikaları).",
        },
        {
          icon: Lock,
          title: "Güvenli bağlantı",
          body: "Oturum ve ödeme akışlarında endüstri standardı şifreleme ve güvenilir barındırma kullanılır.",
        },
        {
          icon: Eye,
          title: "Şeffaflık",
          body: "Skorlar ve öneriler, hangi sinyallere dayandığını anlayabileceğiniz şekilde sunulur — kara kutu değil.",
        },
        {
          icon: Server,
          title: "Profesyonel danışmanlık değildir",
          body: "HireFit bilgilendirme amaçlıdır; işe alım veya hukuki tavsiye yerine geçmez.",
        },
      ]
    : [
        {
          icon: ShieldCheck,
          title: "Your data stays yours",
          body: "Your CV and job text are processed for analysis only — not used to train third-party models under default API policies.",
        },
        {
          icon: Lock,
          title: "Secure by design",
          body: "Industry-standard encryption for sessions and payments, hosted on reliable infrastructure.",
        },
        {
          icon: Eye,
          title: "Transparent outputs",
          body: "Scores and suggestions are structured so you can see what signals drove them — not a black box.",
        },
        {
          icon: Server,
          title: "Not career or legal advice",
          body: "HireFit is informational only and does not replace a recruiter, coach, or attorney.",
        },
      ];

  return (
    <section className="hf-section hf-section--trust" style={{ padding: "80px 0" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={pill}>{tr ? "Güven" : "Trust"}</div>
          <h2 style={h2}>{tr ? "Önce güven. Sonra netlik." : "Trust first. Then clarity."}</h2>
          <p style={sub}>
            {tr
              ? "Kariyer veriniz hassastır. HireFit’i bu yüzden şeffaf ve sorumlu bir şekilde tasarladık."
              : "Career data is sensitive. We built HireFit to be transparent and responsible about how it is used."}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {items.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 24,
                padding: 28,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Icon size={22} color="#60a5fa" strokeWidth={2} />
              </div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: 10, color: "#f1f5f9" }}>{title}</h3>
              <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.7, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HiringLogicQaSection({ lang }) {
  const tr = lang === "TR";
  const items = tr
    ? [
        {
          q: "HireFit CV’min eleneceğini nasıl biliyor?",
          a: "CV’ni ilandaki gerçek filtrelerle eşleştirir: araç, seviye, kapsam ve kanıt. Sonra recruiter ilk eleme davranışını simüle eder. Sinyal zayıfsa red riski yükselir.",
          insight: "→ Red çoğu zaman yetenek sorunu değil, sinyal uyumsuzluğudur.",
          share: "“Çoğu kişi yetersiz değil. Çoğu kişi yanlış sinyal veriyor.”",
        },
        {
          q: "Neden ölçülebilir sonuca bu kadar odaklanıyorsunuz?",
          a: "Çünkü recruiter emek değil, etki görür. “Responsible for” görünmez; “maliyeti %18 düşürdüm” görünür. İlk elemede potansiyelden çok kanıt kazanır.",
          insight: "→ Recruiter çabayı değil, sonucu işe alır.",
          share: "“CV bir hikaye değil. Kanıt dokümanıdır.”",
        },
        {
          q: "HireFit neden bazen başvurma diyor?",
          a: "Çünkü zamanlama stratejidir. Profil rol barının çok altındaysa hemen başvuru genelde sessiz red olur. Önce düzeltme, sonra başvuru daha yüksek dönüşüm verir.",
          insight: "→ Duygusal hız yerine stratejik gecikme daha çok dönüşüm getirir.",
          share: "“Bazen en iyi başvuru, henüz göndermediğindir.”",
        },
        {
          q: "Neden sadece beceri değil, proje öneriyorsunuz?",
          a: "CV’de beceri bir iddia, proje kanıttır. Hiring ekipleri repo, dashboard ve vaka çıktısı gibi görünür üretime güvenir. Kararı değiştiren “biliyorum” değil, “yaptım” sinyalidir.",
          insight: "→ Beceriler anlatır, projeler ispatlar.",
          share: "“‘SQL biliyorum’ zayıf. ‘SQL ile bunu ürettim’ güçlü.”",
        },
        {
          q: "Bu sadece ATS anahtar kelime aracı değil mi?",
          a: "Hayır. Anahtar kelime sadece ilk katman. HireFit rol uyumu, deneyim derinliği, etki kalitesi ve güvenilirlik sinyalini de okur. ATS’yi geçmek mülakat için tek başına yetmez.",
          insight: "→ ATS’yi geçmek giriş bileti; recruiter filtresini geçmek sonuçtur.",
          share: "“ATS görünürlük sağlar. Sinyal geri dönüşüm sağlar.”",
        },
        {
          q: "ChatGPT’den farkı ne?",
          a: "Genel sohbet yerine başvuru öncesi karar üretir. Çıktı net: risk, ana boşluk, ilk hamle. Daha az genel öneri, daha çok işe alım paterni.",
          insight: "→ Tavsiye ilginçtir, karar kullanışlıdır.",
          share: "“Genel AI kulağa iyi geleni söyler. HireFit görüşme getirebilecek sinyali söyler.”",
        },
        {
          q: "Bu gerçekten şansımı artırır mı?",
          a: "Evet, önerilen düzeltmeleri uygularsan. CV’lerin çoğu saniyeler içinde taranır ve zayıf sinyal hızla elenir. Kanıt, hedefleme ve alaka arttığında görüşme ihtimali yükselir.",
          insight: "→ Şans, sinyal kalitesi arttıkça artar.",
          share: "“Görüşme ihtimali şansla değil, sinyal kalitesiyle yükselir.”",
        },
        {
          q: "Recruiter neden bu kadar hızlı eliyor?",
          a: "Çünkü ilk turda okumuyor, tarıyor. Saniyeler içinde rol uyumu ve kanıt arıyor. Net sinyal yoksa sıradaki adaya geçiyor.",
          insight: "→ Çoğu CV yanlış okunmaz; hiç derin okunmaz.",
          share: "“CV’ler çoğu zaman reddedilmez. Sadece atlanır.”",
        },
      ]
    : [
        {
          q: "How does HireFit know if my CV will be rejected?",
          a: "It matches your CV to real hiring filters in the JD: tools, scope, level, and proof. Then it simulates first-screen recruiter behavior. If signal is weak, rejection risk rises.",
          insight: "→ Rejection is usually a signal mismatch, not a talent verdict.",
          share: "\"Most people aren’t underqualified. They’re under-signaled.\"",
        },
        {
          q: "Why do you focus on measurable results?",
          a: "Because recruiters evaluate impact, not effort. “Responsible for” gets ignored; “increased X by 30%” gets noticed. Proof beats potential in first-round screening.",
          insight: "→ Recruiters don’t hire effort. They hire evidence.",
          share: "\"Your CV isn’t a story. It’s a proof document.\"",
        },
        {
          q: "Why does HireFit sometimes tell me NOT to apply?",
          a: "Because timing is strategy. If your profile is far below the hiring bar, applying now usually means silent rejection. Fix first, then apply stronger.",
          insight: "→ Strategic delay beats emotional apply-now.",
          share: "\"Sometimes the smartest application is the one you don’t send yet.\"",
        },
        {
          q: "Why do you suggest projects instead of just skills?",
          a: "Skills on a CV are claims; projects are receipts. Hiring teams trust visible output: repos, dashboards, case work, shipped proof. Concrete evidence changes decisions.",
          insight: "→ Skills tell. Projects prove.",
          share: "\"‘I know SQL’ is weak. ‘Here’s what I built with SQL’ wins.\"",
        },
        {
          q: "Isn’t this just an ATS keyword tool?",
          a: "No. Keywords are one layer. HireFit also checks role fit, experience depth, impact quality, and credibility signals. Passing ATS alone does not secure interviews.",
          insight: "→ Beating ATS is entry. Beating recruiter logic is outcome.",
          share: "\"ATS gets you seen. Signal gets you called.\"",
        },
        {
          q: "How is this different from ChatGPT?",
          a: "ChatGPT gives broad advice. HireFit gives pre-apply decisions: risk, core gap, and first move. Less generic talk, more recruiter pattern logic.",
          insight: "→ Advice is interesting. Decisions are useful.",
          share: "\"General AI tells you what sounds good. Hiring AI tells you what gets through.\"",
        },
        {
          q: "Can this actually improve my chances?",
          a: "Yes, if you execute the fixes. Most CVs are filtered in seconds when signal quality is weak. Better proof, targeting, and relevance increase interview odds.",
          insight: "→ Better CV signal creates better recruiter behavior.",
          share: "\"Interview chances don’t jump by luck. They move by signal.\"",
        },
        {
          q: "Why do recruiters reject so fast?",
          a: "They don’t fully read in first pass — they scan. They look for role match and proof in seconds. No clear signal means next candidate.",
          insight: "→ Most CVs aren’t read wrong. They’re never read deeply.",
          share: "\"Most CVs don’t get rejected. They get skipped.\"",
        },
      ];

  return (
    <section className="hf-section hf-section--qa" style={{ padding: "80px 0" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 42 }}>
          <div style={pill}>{tr ? "Insight Engine" : "Insight Engine"}</div>
          <h2 style={h2}>{tr ? "Recruiter gerçeği, net karar" : "Recruiter truth, clear decisions"}</h2>
          <p style={sub}>
            {tr
              ? "Bu bir SSS değil. Ekran görüntüsü alınacak kadar net, paylaşılacak kadar güçlü işe alım içgörüleri."
              : "Not a FAQ. Screenshot-worthy hiring truths designed for trust, persuasion, and sharing."}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {items.map((item) => (
            <div key={item.q} className="hf-micro-lift hf-glass-card" style={glassCardStyle({ padding: 22, borderRadius: 16 })}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    minWidth: 22,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(99,102,241,0.18)",
                    border: "1px solid rgba(99,102,241,0.35)",
                    color: "#c7d2fe",
                    fontSize: 12,
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  ?
                </span>
                <h3 style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#f8fafc", lineHeight: 1.3 }}>
                  {item.q}
                </h3>
              </div>
              <div style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{item.a}</div>
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(16,185,129,0.22)",
                  background: "linear-gradient(180deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))",
                  padding: "10px 12px",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: "0.08em", fontWeight: 800, color: "#6ee7b7", marginBottom: 4 }}>INSIGHT</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#d1fae5", lineHeight: 1.45 }}>{item.insight}</div>
              </div>
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(99,102,241,0.24)",
                  background: "linear-gradient(180deg, rgba(99,102,241,0.09), rgba(99,102,241,0.03))",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: "0.08em", fontWeight: 800, color: "#c7d2fe", marginBottom: 4 }}>{tr ? "SHARE" : "SHARE"}</div>
                <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.45 }}>{item.share}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ComparisonSection({ lang }) {
  const tr = lang === "TR";
  const rows = tr
    ? [
        { label: "Net başvuru kararı (risk / güçlü)", hf: true, ats: false, chat: false },
        { label: "İlan metninden gerçek anahtar kelimeler", hf: true, ats: "kısmi", chat: false },
        { label: "Red nedenleri + düzeltme önceliği", hf: true, ats: false, chat: "kısmi" },
        { label: "Sektör / işe alım dili", hf: true, ats: false, chat: false },
        { label: "ATS + içerik + recruiter bakışı bir arada", hf: true, ats: "kısmi", chat: false },
      ]
    : [
        { label: "Clear apply / risky / don’t apply verdict", hf: true, ats: false, chat: false },
        { label: "Real JD keywords (not guesses)", hf: true, ats: "partial", chat: false },
        { label: "Rejection reasons + what to fix first", hf: true, ats: false, chat: "partial" },
        { label: "Sector-aware hiring bar", hf: true, ats: false, chat: false },
        { label: "ATS + narrative + recruiter in one flow", hf: true, ats: "partial", chat: false },
      ];

  const colHead = (text, accent) => (
    <div
      style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: "13px",
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: accent,
        padding: "12px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {text}
    </div>
  );

  const cell = (v) => {
    if (v === true) {
      return (
        <div style={{ display: "flex", justifyContent: "center", padding: "14px" }}>
          <BadgeCheck size={22} color="#34d399" strokeWidth={2.2} />
        </div>
      );
    }
    if (v === "partial") {
      return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "14px", color: "#fbbf24", fontSize: "12px", fontWeight: 700 }}>
          ~
        </div>
      );
    }
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "14px" }}>
        <X size={20} color="#64748b" strokeWidth={2} />
      </div>
    );
  };

  return (
    <section className="hf-section hf-section--compare" style={{ padding: "80px 0" }}>
      <div style={container}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={pill}>{tr ? "Karşılaştırma" : "Comparison"}</div>
          <h2 style={h2}>{tr ? "Genel ATS araçları veya sohbet değil" : "Not a generic ATS tool — or a chatbot"}</h2>
          <p style={sub}>
            {tr
              ? "HireFit, tek bir skorun ötesinde işe alım filtresini simüle eder. Aşağıda tipik farkları görebilirsiniz."
              : "HireFit simulates how hiring filters actually behave — beyond a single keyword score. Here’s how it typically compares."}
          </p>
        </div>

        <div
          style={{
            borderRadius: 24,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
              alignItems: "stretch",
              minWidth: 560,
            }}
          >
            <div>{colHead(tr ? "Özellik" : "Capability", "#94a3b8")}</div>
            <div style={{ background: "rgba(59,130,246,0.06)" }}>{colHead("HireFit", "#93c5fd")}</div>
            <div>{colHead(tr ? "Tipik ATS kontrolü" : "Typical ATS checker", "#64748b")}</div>
            <div>{colHead(tr ? "Genel sohbet AI" : "Generic chat AI", "#64748b")}</div>

            {rows.map((row) => (
              <Fragment key={row.label}>
                <div
                  style={{
                    padding: "14px 16px",
                    fontSize: "14px",
                    color: "#cbd5e1",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {row.label}
                </div>
                <div
                  style={{
                    background: "rgba(59,130,246,0.04)",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {cell(row.hf)}
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>{cell(row.ats)}</div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>{cell(row.chat)}</div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Post-analysis “decision → action” panel (analyzer). Complements CareerEngineCard without duplicating the full verdict UI.
 */
export function YourNextMovePanel({
  lang,
  engineV2,
  missingSkills = [],
  topKeywords = [],
  alignmentScore,
  reanalysisResult,
  optimizedCv = "",
  onFixCv,
  onReanalyze,
  optimizing,
  isPro,
  onUpgrade,
}) {
  const tr = lang === "TR";
  const data = engineV2;

  const { problemLine, oneAction, currentInt, targetInt, gainPts } = useMemo(() => {
    if (!data) {
      return {
        problemLine: "",
        oneAction: "",
        currentInt: null,
        targetInt: null,
        gainPts: 10,
      };
    }
    const rawScore = data["Final Alignment Score"];
    const scoreNum = rawScore != null && Number.isFinite(Number(rawScore)) ? Number(rawScore) : null;
    const current = scoreNum ?? (alignmentScore != null && Number.isFinite(Number(alignmentScore)) ? Math.round(Number(alignmentScore)) : null);

    const plan = enrichActionPlan(parseActionPlan(data.Decision?.action_plan), {
      lang: tr ? "tr" : "en",
      roleFit: data.RoleFit,
      gaps: data.Gaps,
      verdict: data.Decision?.final_verdict,
    });
    const planFixes = plan.fixes.filter((f) => f.issue || (f.steps && f.steps.length));
    const primaryFix = planFixes.find((f) => f.priority === "high") || planFixes[0] || null;
    const stepPick = pickDoThisNextStep(planFixes);
    const singleActionRaw =
      (stepPick && String(stepPick).trim()) ||
      (primaryFix?.issue ? String(primaryFix.issue).trim() : "") ||
      (plan.priority_callout ? String(plan.priority_callout).trim() : "");
    const oneActionText = singleActionRaw
      ? softReason(singleActionRaw, lang)
      : tr
        ? "Ölçülebilir etki içeren madde başlıkları yaz."
        : "Rewrite bullets with measurable impact.";

    const gaps = data.Gaps?.rejection_reasons || [];
    const biggestRaw =
      (data.Gaps?.biggest_gap && String(data.Gaps.biggest_gap).trim()) ||
      (gaps[0]?.issue ? String(gaps[0].issue) : "");
    const mainProblemFromGap = biggestRaw ? softReason(biggestRaw, lang) : "";
    const oneLineReasonRaw = String(data.Decision?.reasoning || data.Recruiter?.reasoning || "")
      .trim()
      .split(/[.!?]/)[0]
      ?.trim();
    const mainProblemFromReason = oneLineReasonRaw ? softReason(oneLineReasonRaw, lang) : "";
    const problem = mainProblemFromGap || mainProblemFromReason;

    const gain = primaryFix
      ? Math.max(1, Math.min(18, Math.round(Number(primaryFix.score_impact) || 6)))
      : current != null && current < 72
        ? Math.min(18, Math.max(5, Math.round((72 - current) / 2)))
        : 10;
    const target = current != null ? Math.min(100, Math.round(current + gain)) : null;

    return {
      problemLine: problem,
      oneAction: oneActionText,
      currentInt: current,
      targetInt: target,
      gainPts: gain,
    };
  }, [data, alignmentScore, lang, tr]);

  if (!data) return null;

  const skills = (Array.isArray(missingSkills) ? missingSkills : []).slice(0, 5).map((x) => String(x));
  const kws = (Array.isArray(topKeywords) ? topKeywords : []).slice(0, 6).map((x) => String(x));

  const loopSteps = tr
    ? [
        { t: "CV Optimizasyonu (ölçülebilir etki)", d: "Her maddeye sonuç + sayı ekle." },
        { t: "Eksik anahtar kelimeleri ekle", d: "İlan dilini birebir yansıt." },
        { t: "Tekrar analiz et", d: "Aynı CV + ilan ile yeniden çalıştır." },
      ]
    : [
        { t: "CV Optimization bullets", d: "Add outcomes + numbers per bullet." },
        { t: "Add missing keywords", d: "Mirror the JD language." },
        { t: "Re-analyze", d: "Re-run with the same CV + JD." },
      ];

  const fillPct = currentInt != null ? Math.min(100, Math.max(6, currentInt)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="hf-next-move-panel hf-micro-lift"
      style={{
        marginTop: 22,
        marginBottom: 8,
        ...glassCardStyle({ padding: "24px 22px 22px" }),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(56,189,248,0.12)",
              border: "1px solid rgba(56,189,248,0.22)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <TrendingUp size={20} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#64748b", textTransform: "uppercase" }}>
              {tr ? "Sıradaki hamle" : "Your next move"}
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#f8fafc", marginTop: 2 }}>
              {tr ? "Karar → aksiyon → tekrar analiz" : "Decision → action → re-run"}
            </div>
          </div>
        </div>
        {reanalysisResult ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#6ee7b7",
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(52,211,153,0.35)",
              background: "rgba(16,185,129,0.08)",
            }}
          >
            {tr ? "Son düzeltme: " : "Last fix: "}
            {reanalysisResult.before}→{reanalysisResult.after} ({reanalysisResult.delta >= 0 ? "+" : ""}
            {reanalysisResult.delta})
          </div>
        ) : null}
      </div>

      {currentInt != null && targetInt != null ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>
              {tr ? "Profil gücü" : "Profile strength"}
            </span>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#e2e8f0" }}>
              {currentInt} → {targetInt}
              <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 700, color: "#4ade80" }}>+{gainPts}</span>
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${fillPct}%`,
                borderRadius: 999,
                background: "linear-gradient(90deg, #6366f1, #22d3ee)",
                boxShadow: "0 0 24px rgba(99,102,241,0.45)",
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(251,113,133,0.25)",
            background: "rgba(244,63,94,0.06)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#fb7185", textTransform: "uppercase", marginBottom: 6 }}>
            {tr ? "Sorun" : "The problem"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fecdd3", lineHeight: 1.5 }}>
            {problemLine ||
              (tr ? "Profilin, ilanın beklediği sinyalleri net göstermiyor." : "Your profile isn’t showing the signals this posting expects.")}
          </div>
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(251,191,36,0.22)",
            background: "rgba(245,158,11,0.06)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#fbbf24", textTransform: "uppercase", marginBottom: 10 }}>
            {tr ? "Boşluk" : "The gap"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>{tr ? "Eksik beceriler" : "Missing skills"}</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.55 }}>
                {skills.length ? skills.join(" · ") : tr ? "— listelenmedi" : "— none listed"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>{tr ? "Anahtar kelimeler" : "Keywords"}</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.55 }}>
                {kws.length ? kws.join(" · ") : tr ? "— listelenmedi" : "— none listed"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>{tr ? "Deneyim sinyali" : "Experience signal"}</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.55 }}>
                {problemLine
                  ? tr
                    ? "Ölçülebilir sonuç ve rol uyumu eksik görünüyor."
                    : "Measurable outcomes + role fit read weak."
                  : tr
                    ? "İlanla hizalı kanıt satırı ekleyin."
                    : "Add proof lines aligned to the JD."}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(74,222,128,0.28)",
            background: "rgba(34,197,94,0.07)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#4ade80", textTransform: "uppercase", marginBottom: 6 }}>
            {tr ? "Tek net aksiyon" : "One clear action"}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#ecfccb", lineHeight: 1.45 }}>→ {oneAction}</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase", marginBottom: 10 }}>
          {tr ? "Döngü" : "Feedback loop"}
        </div>
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {loopSteps.map((s, idx) => (
            <li key={s.t} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <CheckCircle2 size={18} color="#64748b" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                  {idx + 1}. {s.t}
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button
          type="button"
          className="hf-cta-primary"
          onClick={() => {
            if (!isPro) {
              onUpgrade();
              return;
            }
            onFixCv();
          }}
          disabled={optimizing && isPro}
          style={{
            flex: "1 1 220px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            cursor: optimizing && isPro ? "wait" : "pointer",
            fontWeight: 700,
            fontSize: 15,
            fontFamily: "'DM Sans', sans-serif",
            color: "#0f172a",
            opacity: optimizing && isPro ? 0.85 : 1,
          }}
        >
          {optimizing && isPro ? <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : <Wand2 size={18} />}
          {!isPro ? (tr ? "CV Optimizasyonu — Pro" : "CV Optimization — Pro") : optimizing && isPro ? (tr ? "Optimize ediliyor..." : "Optimizing...") : tr ? "→ CV Optimizasyonunu şimdi başlat" : "→ Start CV Optimization now"}
        </button>
        <button
          type="button"
          onClick={onReanalyze}
          disabled={!String(optimizedCv || "").trim()}
          className="hf-btn-secondary-ghost"
          style={{
            flex: "1 1 200px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 18px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "#e2e8f0",
            fontWeight: 700,
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            cursor: !String(optimizedCv || "").trim() ? "not-allowed" : "pointer",
            opacity: !String(optimizedCv || "").trim() ? 0.45 : 1,
          }}
        >
          <RotateCcw size={16} />
          {tr ? "Tekrar analiz et" : "Re-analyze"}
        </button>
      </div>
    </motion.div>
  );
}
