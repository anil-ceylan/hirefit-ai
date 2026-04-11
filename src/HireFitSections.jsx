import { Fragment } from "react";
import { ShieldCheck, Lock, Eye, Server, BadgeCheck, X } from "lucide-react";

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
  color: "#64748b",
  fontSize: "16px",
  maxWidth: 560,
  margin: "0 auto 48px",
  lineHeight: 1.65,
};

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
    <section style={{ padding: "80px 0", background: "#0A0A0B" }}>
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
    <section style={{ padding: "80px 0", background: "#0A0A0B" }}>
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
