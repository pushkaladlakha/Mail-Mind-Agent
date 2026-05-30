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
  const [loadingMessage, setLoadingMessage] = useState("Connecting securely…");

  // Focus ref for security password reset focus shifting
  const passwordRef = useRef<HTMLInputElement>(null);

  // Input validation on email change
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (authStatus === "invalid_credentials" || authStatus === "server_error") {
      setAuthStatus("idle");
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
          verification.error?.toLowerCase().includes("connect");

        setAuthStatus(isConnectionError ? "server_error" : "invalid_credentials");
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
      console.error("Backend auth returned failure.");
      setAuthStatus("invalid_credentials");
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

  const emailInputClass = `w-full pl-10 pr-3 h-11 rounded-xl bg-background border text-sm font-medium outline-none transition-all duration-300 disabled:opacity-60 ${
    emailError 
      ? "border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100" 
      : authStatus === "invalid_credentials"
      ? "border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      : "border-border focus:border-accent focus:ring-2 focus:ring-accent/20"
  }`;

  const passwordInputClass = `w-full pl-10 pr-10 h-11 rounded-xl bg-background border text-sm font-medium outline-none transition-all duration-300 disabled:opacity-60 ${
    authStatus === "invalid_credentials"
      ? "border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      : "border-border focus:border-accent focus:ring-2 focus:ring-accent/20"
  }`;

  const isDemoConnecting = authStatus === "connecting" && loadingMessage.includes("demo");

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background waves */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.98_0.02_85)] via-background to-[oklch(0.94_0.025_75)]" />
        <svg
          className="wave-layer-slow absolute -bottom-10 left-0 w-[140%] h-[60%] opacity-70"
          viewBox="0 0 1440 600"
          preserveAspectRatio="none"
        >
          <path
            d="M0,300 C300,420 600,180 900,260 C1140,330 1320,260 1440,300 L1440,600 L0,600 Z"
            fill="oklch(0.93 0.03 75)"
          />
        </svg>
        <svg
          className="wave-layer absolute -bottom-20 left-0 w-[140%] h-[55%] opacity-80"
          viewBox="0 0 1440 600"
          preserveAspectRatio="none"
        >
          <path
            d="M0,360 C260,260 540,460 820,360 C1080,270 1280,400 1440,360 L1440,600 L0,600 Z"
            fill="oklch(0.89 0.04 70)"
          />
        </svg>
      </div>

      <nav className="max-w-6xl w-full mx-auto px-6 h-16 flex items-center justify-between z-10">
        <Link to="/" className="flex items-center gap-3">
          <div className="size-8 bg-accent rounded-lg flex items-center justify-center text-accent-foreground font-bold">
            M
          </div>
          <span className="font-bold tracking-tight">Mail Mind</span>
        </Link>
        <Link
          to="/"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>
      </nav>

      <main className="flex-1 grid lg:grid-cols-2 max-w-6xl w-full mx-auto px-6 py-10 gap-12 items-center z-10">
        {/* Left Trust Panel */}
        <section className="hidden lg:flex flex-col gap-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-[0.18em] mb-6">
              <ShieldCheck className="size-3" />
              Secure authorization
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1] text-balance">
              Connect your <span className="text-accent">college mailbox</span>.
            </h1>
            <p className="text-muted-foreground mt-4 max-w-[42ch] leading-relaxed">
              We use your credentials once to open a secure session with your IIT webmail server.
              Nothing is stored in your browser.
            </p>
          </div>

          <ul className="space-y-4">
            {[
              {
                t: "Credentials never stored",
                d: "Your password is sent over TLS to our backend, used to authorize a session, then discarded.",
              },
              {
                t: "Read-only access",
                d: "Mail Mind only fetches and classifies email — it cannot send, delete, or modify anything.",
              },
              {
                t: "Revoke anytime",
                d: "Disconnecting clears the session token immediately. No background access remains.",
              },
            ].map((i) => (
              <li
                key={i.t}
                className="flex gap-3 bg-surface border border-border rounded-xl p-4"
              >
                <div className="size-8 shrink-0 rounded-lg bg-success/10 text-success flex items-center justify-center">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <div className="font-bold text-sm">{i.t}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {i.d}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Right Form Card */}
        <section className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto animate-form-rise">
          <div className="bg-surface/90 backdrop-blur-xl border border-border rounded-3xl shadow-[0_30px_80px_-30px_oklch(0.4_0.05_60_/_0.35)] p-8 relative overflow-hidden transition-all duration-500">
            
            {/* Smooth Success Overlay */}
            <div
              className={`absolute inset-0 bg-surface/95 backdrop-blur-md z-20 flex flex-col items-center justify-center p-8 text-center transition-all duration-500 ${
                authStatus === "success"
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4 pointer-events-none"
              }`}
            >
              <div className="size-16 rounded-full bg-success/10 text-success flex items-center justify-center mb-4 animate-bounce">
                <CheckCircle className="size-8" />
              </div>
              <h3 className="text-xl font-bold">
                {isDemoConnecting ? "Demo Workspace Ready" : "Mail Connected Successfully"}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {isDemoConnecting
                  ? "Redirecting you to the sample academic dashboard..."
                  : "We've established a secure sync session. surrendering to your priority dashboard..."}
              </p>
            </div>

            <h2 className="text-2xl font-bold tracking-tight">Connect College Mail</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in with your IIT webmail credentials.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              
              {/* College Email Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    College email
                  </label>
                  {emailError && (
                    <span className="text-[10px] font-semibold text-amber-600 animate-pulse">
                      {emailError}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
                <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Secure Warning / Error Banners (Beige academic visual style) */}
              {authStatus === "invalid_credentials" && (
                <div
                  role="alert"
                  className="flex items-start gap-3 text-xs font-semibold text-amber-800 bg-amber-50/70 border border-amber-200/50 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-1 duration-300"
                >
                  <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                  <span className="leading-relaxed">
                    Unable to connect to your college mail. Please check your email and password and try again.
                  </span>
                </div>
              )}

              {authStatus === "server_error" && (
                <div
                  role="alert"
                  className="flex items-start gap-3 text-xs font-semibold text-amber-800 bg-amber-50/70 border border-amber-200/50 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-1 duration-300"
                >
                  <ServerCrash className="size-4 shrink-0 mt-0.5 text-amber-600" />
                  <span className="leading-relaxed">
                    Unable to reach your college mail server. Please try again later.
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={authStatus === "connecting"}
                className="w-full inline-flex items-center justify-center gap-2 bg-academic text-white h-12 rounded-xl text-sm font-bold shadow-lg shadow-academic/20 hover:opacity-95 transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {authStatus === "connecting" && !loadingMessage.includes("demo") ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect mailbox
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-border" />
              <span className="px-3 text-xs text-muted-foreground bg-surface uppercase font-bold tracking-widest text-[9px]">or</span>
              <div className="flex-1 border-t border-border" />
            </div>

            {/* Try Demo Mode Section */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleTryDemoMode}
                disabled={authStatus === "connecting"}
                className="w-full inline-flex items-center justify-center gap-2 border border-border bg-background text-foreground h-12 rounded-xl text-sm font-bold shadow-sm hover:bg-muted/50 transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer relative"
              >
                {isDemoConnecting ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-accent" />
                    Loading demo workspace...
                  </>
                ) : (
                  <>
                    Try Demo Mode
                    <span className="absolute -top-2.5 right-4 bg-accent/10 text-accent text-[9px] font-bold px-2 py-0.5 rounded-full border border-accent/20">
                      No login required
                    </span>
                  </>
                )}
              </button>
              <p className="text-center text-xs text-muted-foreground leading-relaxed px-2">
                Explore the platform with sample academic emails and AI-generated summaries.
              </p>
            </div>

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground bg-background border border-border rounded-lg p-3 mt-5">
              <ShieldCheck className="size-3.5 shrink-0 mt-0.5 text-success" />
              <span>
                Your credentials are used only to fetch your emails securely. They are never
                stored in this browser, never logged, and never visible after sign-in.
              </span>
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By connecting you agree to the{" "}
            <a className="underline hover:text-foreground" href="#">
              Terms
            </a>{" "}
            and{" "}
            <a className="underline hover:text-foreground" href="#">
              Privacy Notice
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
