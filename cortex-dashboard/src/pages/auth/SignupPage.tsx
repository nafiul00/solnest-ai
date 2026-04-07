import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import RadialShader from "../../components/ui/radial-shader";
import { toast } from "../../store/toastStore";

function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

const strengthColors = ["transparent", "#ef4444", "#f59e0b", "#60a5fa", "#4ade80"];
const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

export { SignupPage }
export default function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!agreeTerms) {
      toast.error("Please agree to the Terms of Service to continue.");
      return;
    }
    setLoading(true);
    await new Promise((res) => setTimeout(res, 1200));
    setLoading(false);
    toast.success("Account created — welcome to Solnest!");
    navigate("/");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "46px",
    padding: "0 14px",
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: "10px",
    fontSize: "14px",
    color: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s, background 0.15s",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  };

  const focusedInputStyle: React.CSSProperties = {
    ...inputStyle,
    border: "1px solid rgba(255,255,255,0.75)",
    background: "rgba(255,255,255,0.24)",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "rgba(255,255,255,0.80)",
    marginBottom: "7px",
    fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        overflow: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        boxSizing: "border-box",
      }}
    >
      {/* Shader background */}
      <RadialShader />

      {/* Outer wrapper — logo + card stacked */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: "420px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "slideInFromLeft 0.38s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* Logo — outside the card */}
        <img
          src="/logo.png"
          alt="Solnest Stays"
          style={{
            height: "260px",
            width: "auto",
            display: "block",
            filter: "invert(1) brightness(1.0)",
            marginBottom: "16px",
            flexShrink: 0,
          }}
        />

        {/* Frosted glass card */}
        <div
          style={{
            width: "100%",
            backdropFilter: "blur(32px) saturate(180%)",
            WebkitBackdropFilter: "blur(32px) saturate(180%)",
            background: "rgba(15,15,14,0.55)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: "20px",
            padding: "36px 40px 32px",
            boxSizing: "border-box",
            boxShadow: "0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              color: "#ffffff",
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "-0.4px",
            }}
          >
            Create your account
          </h1>
          <p
            style={{
              margin: "7px 0 0",
              fontSize: "14px",
              color: "rgba(255,255,255,0.60)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Start managing your properties with AI
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="fullName" style={labelStyle}>Full Name</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              autoComplete="name"
              onFocus={() => setFocusedField("fullName")}
              onBlur={() => setFocusedField(null)}
              style={focusedField === "fullName" ? focusedInputStyle : inputStyle}
            />
          </div>

          {/* Email */}
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="email" style={labelStyle}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              style={focusedField === "email" ? focusedInputStyle : inputStyle}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: password.length > 0 ? "8px" : "14px" }}>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                style={{
                  ...(focusedField === "password" ? focusedInputStyle : inputStyle),
                  paddingRight: "46px",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute", right: "13px", top: "50%",
                  transform: "translateY(-50%)", background: "none", border: "none",
                  padding: 0, cursor: "pointer", color: "rgba(255,255,255,0.50)",
                  display: "flex", alignItems: "center",
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Password strength */}
          {password.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    style={{
                      flex: 1, height: "3px", borderRadius: "2px",
                      background: strength >= level ? strengthColors[strength] : "rgba(255,255,255,0.15)",
                      transition: "background 0.2s",
                    }}
                  />
                ))}
              </div>
              <p style={{ margin: 0, fontSize: "11px", color: strengthColors[strength], fontWeight: 500 }}>
                {strengthLabels[strength]}
              </p>
            </div>
          )}

          {/* Confirm Password */}
          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="confirmPassword" style={labelStyle}>Confirm Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                onFocus={() => setFocusedField("confirmPassword")}
                onBlur={() => setFocusedField(null)}
                style={{
                  ...(focusedField === "confirmPassword" ? focusedInputStyle : inputStyle),
                  paddingRight: "46px",
                  borderColor: confirmPassword.length > 0 && confirmPassword !== password
                    ? "rgba(239,68,68,0.7)"
                    : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                style={{
                  position: "absolute", right: "13px", top: "50%",
                  transform: "translateY(-50%)", background: "none", border: "none",
                  padding: 0, cursor: "pointer", color: "rgba(255,255,255,0.50)",
                  display: "flex", alignItems: "center",
                }}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword.length > 0 && confirmPassword !== password && (
              <p style={{ margin: "5px 0 0", fontSize: "11px", color: "#f87171" }}>
                Passwords do not match
              </p>
            )}
          </div>

          {/* Terms checkbox */}
          <label
            style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              marginBottom: "24px", cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              style={{
                marginTop: "2px", width: "16px", height: "16px",
                flexShrink: 0, accentColor: "#F0C060", cursor: "pointer",
              }}
            />
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.60)", lineHeight: "1.5" }}>
              I agree to the{" "}
              <a href="/terms" style={{ color: "#F0C060", textDecoration: "none", fontWeight: 500 }}>
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" style={{ color: "#F0C060", textDecoration: "none", fontWeight: 500 }}>
                Privacy Policy
              </a>
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", height: "46px",
              background: loading ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.95)",
              color: loading ? "rgba(255,255,255,0.6)" : "#0F0F0E",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "10px", fontSize: "14px", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.2px",
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                  style={{ animation: "spin 0.75s linear infinite" }}>
                  <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                  <path d="M8 2a6 6 0 0 1 6 6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Creating account…
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div style={{ margin: "24px 0 0", borderTop: "1px solid rgba(255,255,255,0.10)" }} />

        <p
          style={{
            marginTop: "18px", textAlign: "center", fontSize: "13px",
            color: "rgba(255,255,255,0.50)", fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Already have an account?{" "}
          <NavLink to="/login" style={{ color: "#F0C060", fontWeight: 600, textDecoration: "none" }}>
            Log in
          </NavLink>
        </p>

        </div>{/* end card */}
      </div>{/* end outer wrapper */}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInFromLeft {
          from { opacity: 0; transform: translateX(-40px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)     scale(1);    }
        }
        @keyframes slideInFromRight {
          from { opacity: 0; transform: translateX(40px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
        input::placeholder { color: rgba(255,255,255,0.35) !important; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px rgba(255,255,255,0.12) inset !important;
          -webkit-text-fill-color: #ffffff !important;
        }
      `}</style>
    </div>
  );
}
