import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import RadialShader from "../../components/ui/radial-shader";
import { toast } from "../../store/toastStore";
import { useAuthStore } from "../../store/authStore";

export { LoginPage }
export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (!ok) {
      toast.error("Invalid email or password.");
      return;
    }
    toast.success("Welcome back to Solnest!");
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
          animation: "slideInFromRight 0.38s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* Logo — outside the card */}
        <img
          src="/logo.png"
          alt="Solnest Stays"
          style={{
            height: "280px",
            width: "auto",
            display: "block",
            filter: "invert(1) brightness(1.0)",
            marginBottom: "16px",
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
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
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
            Welcome back
          </h1>
          <p
            style={{
              margin: "7px 0 0",
              fontSize: "14px",
              color: "rgba(255,255,255,0.60)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Sign in to your Solnest dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email field */}
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.80)",
                marginBottom: "7px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Email
            </label>
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

          {/* Password field */}
          <div style={{ marginBottom: "28px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "7px",
              }}
            >
              <label
                htmlFor="password"
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.80)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Password
              </label>
              <span style={{ fontSize: "12px", color: "#F0C060", fontWeight: 500, cursor: "pointer" }}>
                Forgot password?
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
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
                  position: "absolute",
                  right: "13px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.50)",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: "46px",
              background: loading ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.95)",
              color: loading ? "rgba(255,255,255,0.6)" : "#0F0F0E",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.15s",
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "0.2px",
            }}
          >
            {loading ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ animation: "spin 0.75s linear infinite" }}
                >
                  <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                  <path d="M8 2a6 6 0 0 1 6 6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Logging in…
              </>
            ) : (
              "Log In"
            )}
          </button>
        </form>

        </div>{/* end card */}
      </div>{/* end outer wrapper */}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInFromRight {
          from { opacity: 0; transform: translateX(40px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)   scale(1);    }
        }
        @keyframes slideInFromLeft {
          from { opacity: 0; transform: translateX(-40px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)     scale(1);    }
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
