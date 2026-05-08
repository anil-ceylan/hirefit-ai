import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import supabase from "./supabaseClient";

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
  const verifyEmail = String(sessionUser?.email || user?.email || queryEmail || email || "").trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      const activeUser = session?.user || null;
      if (!activeUser) {
        if (queryEmail) {
          setSessionUser(null);
          setAuthChecking(false);
          return;
        }
        navigate("/login", { replace: true });
        return;
      }
      setSessionUser(activeUser);
      setAuthChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, queryEmail]);

  const openGmail = () => window.open("https://mail.google.com", "_blank");

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || resendState.loading) return;
    setResendState({ loading: true, message: "", isError: false });
    try {
      await resendSignupVerification(verifyEmail);
      setResendCooldown(60);
      setResendState({
        loading: false,
        message: lang === "TR" ? "Doğrulama e-postası tekrar gönderildi." : "Verification email resent.",
        isError: false,
      });
    } catch (e) {
      setResendState({
        loading: false,
        message: String(e?.message || "") || (lang === "TR" ? "E-posta gönderilemedi." : "Could not resend email."),
        isError: true,
      });
    }
  };

  if (authChecking) {
    return null;
  }

  const copy = lang === "TR"
    ? {
        title: "E-postanı doğrula",
        subtitle: "Doğrulama linkini e-posta adresine gönderdik.",
        small: "Doğruladıktan sonra HireFit profilin aktif olacak.",
        openGmail: "Gmail'i Aç",
        resend: "E-postayı Tekrar Gönder",
        resendIn: "Tekrar gönder",
        sending: "Gönderiliyor...",
        changeEmail: "E-postayı Değiştir",
        successTitle: "HireFit profilin artık aktif.",
        successSubtitle: "Hangi rollerin gerçekten sana uygun olduğunu görelim.",
        successAction: "Panele Git",
      }
    : {
        title: "Verify your email",
        subtitle: "We sent a verification link to your email address.",
        small: "After verification, your HireFit profile will be activated.",
        openGmail: "Open Gmail",
        resend: "Resend Email",
        resendIn: "Resend in",
        sending: "Sending...",
        changeEmail: "Change Email",
        successTitle: "Your HireFit profile is now active.",
        successSubtitle: "Let's see which roles are really for you.",
        successAction: "Go to Dashboard",
      };

  if (sessionUser?.email_confirmed_at || isUserEmailVerified) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, padding: "80px 24px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div className="hf-card" style={{ padding: 32 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800, marginBottom: 8, color: "#e2e8f0" }}>
              {copy.successTitle}
            </h2>
            <p style={{ color: theme.textSub, fontSize: 14, marginBottom: 20 }}>
              {copy.successSubtitle}
            </p>
            <button className="hf-btn-primary" onClick={() => navigate("/dashboard")} style={{ width: "100%", justifyContent: "center" }}>
              {copy.successAction}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, padding: "80px 24px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="hf-card" style={{ padding: 32, animation: "fadeIn .28s ease" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
            {copy.title}
          </h2>
          <p style={{ color: theme.textSub, fontSize: 14, marginBottom: 8 }}>
            {copy.subtitle}
          </p>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 18 }}>
            {copy.small}
          </p>
          {verifyEmail ? (
            <div
              style={{
                marginBottom: 14,
                fontSize: 13,
                color: "#cbd5e1",
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.22)",
                borderRadius: 10,
                padding: "8px 10px",
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
                padding: "9px 11px",
                borderRadius: 10,
                background: resendState.isError ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                border: resendState.isError ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(34,197,94,0.25)",
              }}
            >
              {resendState.message}
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            <button className="hf-btn-primary" onClick={openGmail} style={{ width: "100%", justifyContent: "center" }}>
              {copy.openGmail}
            </button>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendState.loading || resendCooldown > 0}
              style={{
                width: "100%",
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
              onClick={() => navigate("/login")}
              style={{
                width: "100%",
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
        </div>
      </div>
    </div>
  );
}
