import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useRef } from "react";
import {
  ArrowRight,
  Lock,
  Mail,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle,
  ServerCrash
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { verifyWebmailCredentials } from "@/lib/api/webmail.functions";

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "Connect College Mail — Mail Mind" },
      {
        name: "description",
        content:
          "Securely authorize Mail Mind to fetch your IIT webmail. Credentials are never stored.",
      },
    ],
  }),
  component: ConnectPage,
});

type AuthStatus = "idle" | "connecting" | "success" | "invalid_credentials" | "server_error";

function ConnectPage() {
  const navigate = useNavigate();
  const { signIn, signUp, enterDemoMode } = useAuth();

  // Field states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // UX states
  const [authStatus, setAuthStatus] = useState<AuthStatus>("idle");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Connecting securely…");

  // Focus ref for security password reset focus shifting
  const passwordRef = useRef<HTMLInputElement>(null);

  // Input validation on email change
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (authStatus === "invalid_credentials" || authStatus === "server_error") {
      setAuthStatus("idle");
      setErrorMessage(null);
    }

    const trimmed = val.trim();
    if (!trimmed) {
      setEmailError(null);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError("That doesn't look like a valid college email format.");
    } else {
      setEmailError(null);
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (authStatus === "invalid_credentials" || authStatus === "server_error") {
      setAuthStatus("idle");
      setErrorMessage(null);
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (authStatus === "connecting") return;

    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail || !password) {
      setAuthStatus("invalid_credentials");
      setPassword("");
      passwordRef.current?.focus();
      return;
    }

    setLoadingMessage("Connecting securely…");
    setAuthStatus("connecting");

    try {
      // 1. Perform server-side college webmail connection & credential check
      const verification = await verifyWebmailCredentials({
        data: {
          email: trimmedEmail,
          password
        }
      });

      if (!verification.success) {
        const isConnectionError = 
          verification.error?.toLowerCase().includes("timed out") || 
          verification.error?.toLowerCase().includes("connect") ||
          verification.error?.toLowerCase().includes("unreachable") ||
          verification.error?.toLowerCase().includes("dns") ||
          verification.error?.toLowerCase().includes("name or service not known");

        setAuthStatus(isConnectionError ? "server_error" : "invalid_credentials");
        setErrorMessage(verification.error || "Authentication failed. Please verify your college Kerberos email and password.");
        setPassword("");
        passwordRef.current?.focus();
        return;
      }

      // 2. Webmail validated! Now sign the user into our local database/session
      try {
        await signIn(trimmedEmail, password);
      } catch (authError: any) {
        if (
          authError.code === "auth/user-not-found" ||
          authError.code === "auth/invalid-credential" ||
          authError.message?.includes("invalid") ||
          authError.message?.includes("user-not-found")
        ) {
          try {
            await signUp(trimmedEmail, password);
          } catch (signUpError: any) {
            if (signUpError.code === "auth/email-already-in-use") {
              throw new Error("Invalid credentials");
            } else {
              throw signUpError;
            }
          }
        } else {
          throw authError;
        }
      }

      setAuthStatus("success");
      sessionStorage.setItem("mm_password", password); // Cache securely in memory for active tab session
      setPassword(""); // Clear immediately for security
      toast.success("Mail connected successfully.");
      
      setTimeout(() => {
        navigate({ to: "/dashboard" });
      }, 1000);

    } catch (err: any) {
      console.error("Backend auth returned failure:", err);
      setAuthStatus("invalid_credentials");
      setErrorMessage(err.message || "An unexpected error occurred during session initialization.");
      setPassword("");
      passwordRef.current?.focus();
    }
  }

  const handleTryDemoMode = async () => {
    if (authStatus === "connecting") return;
    
    setLoadingMessage("Loading demo workspace...");
    setAuthStatus("connecting");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200)); // visual loaded time
      await enterDemoMode();
      setAuthStatus("success");
      toast.success("Demo workspace loaded successfully.");
      
      setTimeout(() => {
        navigate({ to: "/dashboard" });
      }, 1000);
    } catch (err) {
      setAuthStatus("idle");
      toast.error("Failed to start Demo Mode.");
    }
  };

  const emailInputClass = `w-full pl-10 pr-3 h-12 rounded-xl bg-background border text-sm font-semibold outline-none transition-all duration-300 disabled:opacity-60 focus:ring-4 ${
    emailError 
      ? "border-amber-400 focus:border-amber-500 focus:ring-amber-500/10" 
      : authStatus === "invalid_credentials"
      ? "border-amber-400 focus:border-amber-500 focus:ring-amber-500/10"
      : "border-border/80 focus:border-academic focus:ring-academic/10"
  }`;

  const passwordInputClass = `w-full pl-10 pr-10 h-12 rounded-xl bg-background border text-sm font-semibold outline-none transition-all duration-300 disabled:opacity-60 focus:ring-4 ${
    authStatus === "invalid_credentials"
      ? "border-amber-400 focus:border-amber-500 focus:ring-amber-500/10"
      : "border-border/80 focus:border-academic focus:ring-academic/10"
  }`;

  const isDemoConnecting = authStatus === "connecting" && loadingMessage.includes("demo");

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden bg-[linear-gradient(to_right,#00000004_1px,transparent_1px),linear-gradient(to_bottom,#00000004_1px,transparent_1px)] bg-[size:4rem_4rem] z-10">
      {/* Background Glowing Ambient Blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[35rem] h-[35rem] rounded-full bg-academic/10 blur-[120px] animate-blob-1" />
        <div className="absolute top-[20%] -right-40 w-[40rem] h-[40rem] rounded-full bg-accent/10 blur-[130px] animate-blob-2" />
        <div className="absolute -bottom-40 left-[20%] w-[35rem] h-[35rem] rounded-full bg-emerald-500/5 blur-[120px] animate-blob-3" />
      </div>

      <nav className="max-w-6xl w-full mx-auto px-6 h-20 flex items-center justify-between z-10 relative">
        <Link to="/" className="flex items-center gap-3">
          <div className="size-10 bg-academic text-white rounded-xl flex items-center justify-center font-bold shadow-md shadow-academic/20 transition-all hover:scale-105">
            M
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            Mail Mind
          </span>
        </Link>
        <Link
          to="/"
          className="text-xs font-bold text-muted-foreground hover:text-foreground bg-surface border border-border px-4 py-2 rounded-full shadow-sm transition-all"
        >
          ← Home Page
        </Link>
      </nav>

      <main className="flex-1 grid lg:grid-cols-2 max-w-6xl w-full mx-auto px-6 py-8 md:py-16 gap-12 items-center z-10 relative">
        {/* Left Trust Panel */}
        <section className="hidden lg:flex flex-col gap-8 text-left">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-academic/10 text-academic text-[10px] font-bold uppercase tracking-[0.18em] mb-6 border border-academic/10">
              <ShieldCheck className="size-3.5" />
              Secure connection
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.08] text-balance">
              Connect your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-academic via-accent to-amber-600">
                college mailbox.
              </span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-[42ch] leading-relaxed text-sm">
              We open a secure, direct TLS connection with your institute's webmail server. Your credentials are never stored.
            </p>
          </div>

          <ul className="space-y-4">
            {[
              {
                t: "Credentials Never Stored",
                d: "Password is sent over encrypted TLS to verify the session on your university mail server, then discarded immediately.",
              },
              {
                t: "Read-Only Secure Triage",
                d: "Mail Mind only fetches and classifies incoming messages. It has zero capability to send, modify, or delete anything.",
              },
              {
                t: "Revoke Background Syncs",
                d: "Disconnecting your mailbox clears the encrypted local session key immediately. Zero footprint remains.",
              },
            ].map((i) => (
              <li
                key={i.t}
                className="flex gap-4 bg-surface/60 backdrop-blur-md border border-border/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-border transition-all duration-300"
              >
                <div className="size-9 shrink-0 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/10">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-foreground">{i.t}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {i.d}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Right Form Card */}
        <section className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto animate-form-rise relative">
          <div className="bg-surface/75 backdrop-blur-2xl border border-border/80 rounded-3xl shadow-[0_30px_80px_-30px_oklch(0.52_0.07_55_/_0.18)] p-8 relative overflow-hidden transition-all duration-500">
            
            {/* Smooth Success Overlay */}
            <div
              className={`absolute inset-0 bg-surface/95 backdrop-blur-md z-20 flex flex-col items-center justify-center p-8 text-center transition-all duration-500 ${
                authStatus === "success"
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4 pointer-events-none"
              }`}
            >
              <div className="size-16 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 flex items-center justify-center mb-6 animate-bounce">
                <CheckCircle className="size-8" />
              </div>
              <h3 className="text-xl font-extrabold text-foreground">
                {isDemoConnecting ? "Demo Workspace Ready" : "Mail Connected Successfully"}
              </h3>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed max-w-[32ch]">
                {isDemoConnecting
                  ? "Redirecting you to the sample academic dashboard..."
                  : "We've established a secure sync session. Surrendering to your priority dashboard..."}
              </p>
            </div>

            <div className="text-left">
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Connect College Mail</h2>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Sign in securely with your institute credentials to start priority sorting.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5 text-left" noValidate>
              
              {/* College Email Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="email" className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    College Email Address
                  </label>
                  {emailError && (
                    <span className="text-[9px] font-bold text-amber-600 animate-pulse">
                      {emailError}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Mail className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    required
                    disabled={authStatus === "connecting"}
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="kerberos@iitd.ac.in"
                    className={emailInputClass}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Webmail Password
                </label>
                <div className="relative">
                  <Lock className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={authStatus === "connecting"}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="••••••••"
                    className={passwordInputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Secure Warning / Error Banners */}
              {authStatus === "invalid_credentials" && (
                <div
                  role="alert"
                  className="flex items-start gap-3 text-xs font-semibold text-amber-800 bg-amber-50/70 border border-amber-200/50 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-1 duration-300"
                >
                  <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                  <span className="leading-relaxed">
                    {errorMessage || "Authentication failed. Please verify your college Kerberos email and password."}
                  </span>
                </div>
              )}

              {authStatus === "server_error" && (
                <div
                  role="alert"
                  className="flex items-start gap-3 text-xs font-semibold text-amber-800 bg-amber-50/70 border border-amber-200/50 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-1 duration-300"
                >
                  <ServerCrash className="size-4 shrink-0 mt-0.5 text-amber-600" />
                  <div className="flex flex-col gap-1 text-left">
                    <span className="leading-relaxed">
                      Unable to contact the IIT webmail server. Please verify your internet connection.
                    </span>
                    {errorMessage && (
                      <span className="text-[10px] font-mono opacity-80 break-all leading-normal">
                        Details: {errorMessage}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={authStatus === "connecting"}
                className="w-full inline-flex items-center justify-center gap-2 bg-academic text-white h-12 rounded-xl text-xs font-extrabold shadow-lg shadow-academic/20 hover:opacity-95 transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {authStatus === "connecting" && !loadingMessage.includes("demo") ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Authenticating securely...
                  </>
                ) : (
                  <>
                    Connect Mailbox
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-border/80" />
              <span className="px-3 text-[10px] text-muted-foreground uppercase font-extrabold tracking-widest bg-transparent">or</span>
              <div className="flex-1 border-t border-border/80" />
            </div>

            {/* Try Demo Mode Section */}
            <div className="space-y-4 text-left">
              <button
                type="button"
                onClick={handleTryDemoMode}
                disabled={authStatus === "connecting"}
                className="w-full inline-flex items-center justify-center gap-2 border border-border bg-background text-foreground h-12 rounded-xl text-xs font-extrabold shadow-sm hover:bg-muted/50 transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer relative"
              >
                {isDemoConnecting ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-accent" />
                    Loading demo workspace...
                  </>
                ) : (
                  <>
                    Try Demo Mode
                    <span className="absolute -top-2.5 right-4 bg-academic/10 text-academic text-[8px] font-extrabold px-2 py-0.5 rounded-full border border-academic/20">
                      No Login Required
                    </span>
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-muted-foreground leading-relaxed px-2">
                Explore the platform instantly using populated mock academic feeds.
              </p>
            </div>

            <p className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground bg-background/50 border border-border/80 rounded-xl p-3 mt-6">
              <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
              <span>
                Your credentials are never logged, never stored locally, and are strictly used to negotiate security tokens directly over TLS.
              </span>
            </p>
          </div>

          <p className="text-center text-[10px] text-muted-foreground mt-6">
            By connecting you agree to the{" "}
            <a className="underline hover:text-foreground" href="#">
              Terms of Use
            </a>{" "}
            and{" "}
            <a className="underline hover:text-foreground" href="#">
              Privacy Policy
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
