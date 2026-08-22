import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import supabase, {
  cacheSupabaseSession,
  handleSupabaseAuthFailure,
  initializeSupabaseAuth,
  isSupabaseConfigured,
  isSupabaseSessionFailure,
} from "./supabaseClient";

export default function VerifyEmailPage() {
  const {
    location,
    navigate,
    user,
    email,
    lang,
    T: theme,
    isUserEmailVerified,
    resendSignupVerification,
  } = useOutletContext();
  const [authChecking, setAuthChecking] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);
  const [resendState, setResendState] = useState({ loading: false, message: "", isError: false });
  const [resendCooldown, setResendCooldown] = useState(0);
  const params = useMemo(() => new URLSearchParams(location?.search || ""), [location?.search]);
  const queryEmail = String(params.get("email") || "").trim();
  const verificationCode = String(params.get("code") || "").trim();
  const verifyEmail = String(sessionUser?.email || user?.email || queryEmail || email || "").trim();
  const tr = lang === "TR";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (verificationCode && isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(verificationCode);
          if (error) throw error;
          if (data?.session) cacheSupabaseSession(data.session);
        } catch (exchangeError) {
          if (isSupabaseSessionFailure(exchangeError)) await handleSupabaseAuthFailure(exchangeError);
        }
      }
      const { session, error: authInitError } = await initializeSupabaseAuth();
      if (cancelled) return;
      if (authInitError && !queryEmail) {
        navigate("/login?mode=signup", { replace: true });
        return;
      }
      const activeUser = session?.user || null;
      if (!activeUser) {
        if (queryEmail) {
          setSessionUser(null);
          setAuthChecking(false);
          return;
        }
        navigate("/login?mode=signup", { replace: true });
        return;
      }
      setSessionUser(activeUser);
      setAuthChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, queryEmail, verificationCode]);

  const openGmail = () => window.open("https://mail.google.com", "_blank", "noopener,noreferrer");

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || resendState.loading) return;
    if (!verifyEmail) {
      setResendState({
        loading: false,
        message: tr ? "Tekrar göndermek için e-posta adresini gir." : "Enter your email address to resend.",
        isError: true,
      });
      return;
    }
    setResendState({ loading: true, message: "", isError: false });
    try {
      await resendSignupVerification(verifyEmail);
      setResendCooldown(60);
      setResendState({
        loading: false,
        message: tr ? "Doğrulama bağlantısını tekrar gönderdik." : "We sent the verification link again.",
        isError: false,
      });
    } catch (e) {
      setResendState({
        loading: false,
        message: String(e?.message || "") || (tr ? "E-posta gönderilemedi." : "Could not resend email."),
        isError: true,
      });
    }
  };

  if (authChecking) return null;

  const copy = tr
    ? {
        title: "E-postanı Kontrol Et",
        description: "Doğrulama bağlantısını e-posta adresine gönderdik.",
        inbox: "Lütfen gelen kutunu kontrol et.",
        spam: "Spam klasörünü de kontrol etmeyi unutma.",
        openGmail: "Gmail'i Aç",
        resend: "Tekrar Gönder",
        resendIn: "Tekrar gönder",
        sending: "Gönderiliyor...",
        changeEmail: "E-postayı Değiştir",
        nextLabel: "Sıradaki adım",
        nextText: "E-postanı doğruladıktan sonra Career DNA başlar ve ilk Career Snapshot'unu oluşturursun.",
        successTitle: "Hoş geldin 👋",
        successSubtitle: "Şimdi kariyer yönünü birlikte keşfedelim.",
        successAction: "Career DNA'yı Başlat",
      }
    : {
        title: "Check Your Email",
        description: "We sent a verification link to your email address.",
        inbox: "Please check your inbox.",
        spam: "Do not forget to check your spam folder too.",
        openGmail: "Open Gmail",
        resend: "Resend",
        resendIn: "Resend in",
        sending: "Sending...",
        changeEmail: "Change Email",
        nextLabel: "Next step",
        nextText: "After verification, Career DNA starts and your first Career Snapshot is created.",
        successTitle: "Welcome 👋",
        successSubtitle: "Now let's discover your career direction together.",
        successAction: "Start Career DNA",
      };

  const verified = Boolean(sessionUser?.email_confirmed_at || isUserEmailVerified);

  if (verified) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, padding: "80px 24px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div className="hf-card" style={{ padding: 34, borderColor: "rgba(96,165,250,0.22)" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.22)", color: "#93c5fd", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 18 }}>
              HireFit · Career Intelligence OS
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 800, marginBottom: 10, color: "#e2e8f0", letterSpacing: "-0.03em" }}>
              {copy.successTitle}
            </h2>
            <p style={{ color: theme.textSub, fontSize: 15, lineHeight: 1.65, marginBottom: 22 }}>
              {copy.successSubtitle}
            </p>
            <button className="hf-btn-primary" onClick={() => navigate("/career-dna?welcome=1", { replace: true })} style={{ width: "100%", justifyContent: "center" }}>
              {copy.successAction}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, padding: "80px 24px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div className="hf-card" style={{ padding: 34, animation: "fadeIn .28s ease", borderColor: "rgba(96,165,250,0.22)" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.22)", color: "#93c5fd", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 18 }}>
            HireFit · Career Intelligence OS
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 800, marginBottom: 10, letterSpacing: "-0.03em" }}>
            {copy.title}
          </h2>
          <div style={{ color: theme.textSub, fontSize: 15, lineHeight: 1.65, marginBottom: 18 }}>
            <div>{copy.description}</div>
            <div>{copy.inbox}</div>
            <div>{copy.spam}</div>
          </div>
          {verifyEmail ? (
            <div
              style={{
                marginBottom: 16,
                fontSize: 13,
                color: "#dbeafe",
                background: "rgba(96,165,250,0.1)",
                border: "1px solid rgba(96,165,250,0.24)",
                borderRadius: 12,
                padding: "10px 12px",
                wordBreak: "break-word",
              }}
            >
              {verifyEmail}
            </div>
          ) : null}
          {resendState.message ? (
            <div
              style={{
                marginBottom: 12,
                color: resendState.isError ? "#fca5a5" : "#86efac",
                fontSize: 13,
                padding: "10px 12px",
                borderRadius: 10,
                background: resendState.isError ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                border: resendState.isError ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(34,197,94,0.25)",
              }}
            >
              {resendState.message}
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10 }}>
            <button className="hf-btn-primary" onClick={openGmail} style={{ justifyContent: "center" }}>
              {copy.openGmail}
            </button>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendState.loading || resendCooldown > 0}
              style={{
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid rgba(99,102,241,0.4)",
                background: "rgba(99,102,241,0.15)",
                color: "#e2e8f0",
                fontWeight: 700,
                cursor: resendState.loading || resendCooldown > 0 ? "wait" : "pointer",
                opacity: resendState.loading || resendCooldown > 0 ? 0.78 : 1,
              }}
            >
              {resendState.loading
                ? copy.sending
                : resendCooldown > 0
                  ? `${copy.resendIn} ${resendCooldown}s`
                  : copy.resend}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/login?mode=signup${verifyEmail ? `&email=${encodeURIComponent(verifyEmail)}` : ""}`)}
              style={{
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.3)",
                background: "transparent",
                color: "#cbd5e1",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {copy.changeEmail}
            </button>
          </div>
          <div
            style={{
              marginTop: 18,
              padding: "14px 15px",
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.18)",
              background: "rgba(15,23,42,0.42)",
            }}
          >
            <div style={{ color: "#93c5fd", fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
              {copy.nextLabel}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.55 }}>
              {copy.nextText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

