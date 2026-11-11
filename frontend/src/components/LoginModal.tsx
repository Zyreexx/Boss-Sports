"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  User,
  Shield,
  Key,
  X,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";

declare global {
  interface Window {
    google?: any;
  }
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: any) => void;
}

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<any | null>(null);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  // Initialize Google Identity Services if available in window
  useEffect(() => {
    if (!isOpen) return;

    if (typeof window !== "undefined" && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response.credential) {
              await handleGoogleCredential(response.credential);
            }
          },
        });
      } catch (e) {
        console.error("Google GIS init error:", e);
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, googleClientId, onClose]);

  if (!isOpen) return null;

  const handleGoogleCredential = async (credential: string) => {
    setGoogleLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        setSuccessInfo(data);
        localStorage.setItem("boss_current_user", JSON.stringify(data.user));

        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }

        setTimeout(() => {
          onClose();
          if (data.redirectUrl) {
            router.push(data.redirectUrl);
          }
        }, 800);
      } else {
        setErrorMsg(data.error || "Google sign-in failed.");
      }
    } catch (e) {
      setErrorMsg("Google sign-in network error.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleOAuthRedirect = () => {
    setGoogleLoading(true);
    // Redirects directly to the Google OAuth2 flow endpoint
    window.location.href = "/api/auth/google";
  };

  const handleLogin = async (idVal?: string, passVal?: string) => {
    const id = idVal || identifier;
    const pass = passVal || password;

    if (!id || !pass) {
      setErrorMsg("Please enter both email/phone and password.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: id, password: pass }),
      });

      const data = await res.json();

      if (data.success && data.user) {
        setSuccessInfo(data);
        localStorage.setItem("boss_current_user", JSON.stringify(data.user));

        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }

        setTimeout(() => {
          onClose();
          if (data.redirectUrl) {
            router.push(data.redirectUrl);
          }
        }, 800);
      } else {
        setErrorMsg(data.error || "Authentication failed");
      }
    } catch (e: any) {
      setErrorMsg("Network error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md antialiased animate-in fade-in duration-200"
    >
      <div className="bg-[#0d141f] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-white">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close login modal"
          className="absolute top-5 right-5 text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-[#c7f711]/20 border border-[#c7f711]/40 flex items-center justify-center text-[#c7f711]">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 id="login-modal-title" className="text-lg font-bold text-white tracking-tight">Portal Access Login</h3>
            <p className="text-xs text-white/50">Google Sign-in &amp; Role Verification</p>
          </div>
        </div>

        {/* Success Banner */}
        {successInfo && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <div>
              <span className="font-bold block">Assigned Role: {successInfo.role}</span>
              <span>Redirecting to {successInfo.redirectUrl || "dashboard"}...</span>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Official Google Sign-in Button */}
        <button
          type="button"
          onClick={handleGoogleOAuthRedirect}
          disabled={loading || googleLoading}
          className="w-full bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs py-3 px-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-md hover:shadow-lg disabled:opacity-60 mb-4 border border-neutral-200 cursor-pointer active:scale-[0.99]"
        >
          {googleLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-neutral-700" />
              <span>Connecting to Google...</span>
            </>
          ) : (
            <>
              <GoogleIcon className="w-4 h-4" />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
            or sign in with password
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Manual Credentials Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
          className="space-y-3.5"
        >
          <div>
            <label htmlFor="login-identifier" className="text-xs font-semibold text-white/70 block mb-1">
              Email or Mobile Phone
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
              <input
                id="login-identifier"
                type="text"
                required
                placeholder="Enter your account email or phone"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#c7f711]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="text-xs font-semibold text-white/70 block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
              <input
                id="login-password"
                type="password"
                required
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#c7f711]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-extrabold text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#c7f711]/20 disabled:opacity-50 mt-1 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In with Password</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center text-[10px] text-white/40 border-t border-white/10 pt-3">
          Automatic Role Routing: Owners navigate to Executive Suite, Employees to Staff Desk, Customers to Portal.
        </div>
      </div>
    </div>
  );
}
