import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, Filter, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mail Mind — IIT Webmail Intelligence" },
      {
        name: "description",
        content:
          "An intelligent triage layer for your college inbox. Extract deadlines, summarize lectures, archive the noise.",
      },
      { property: "og:title", content: "Mail Mind — IIT Webmail Intelligence" },
      {
        property: "og:description",
        content: "Signal over noise. Academic mail, triaged.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-accent rounded-lg flex items-center justify-center text-accent-foreground font-bold">
            M
          </div>
          <span className="font-bold tracking-tight">Mail Mind</span>
        </div>
        <Link
          to="/connect"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in →
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 md:pt-24 pb-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-[0.18em] mb-6">
            <Sparkles className="size-3" />
            IIT Webmail Intelligence
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05] text-balance">
            Signal over noise. <br />
            <span className="text-accent">Academic mail, triaged.</span>
          </h1>
          <p className="text-lg text-muted-foreground mt-6 max-w-[55ch] text-pretty leading-relaxed">
            An intelligent sorting layer for your college inbox. We extract deadlines, summarize
            announcements, and archive the fluff so you can focus on the grade.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/connect"
              className="inline-flex items-center gap-2 bg-academic text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg shadow-academic/20 hover:opacity-90 transition-all active:scale-[0.98]"
            >
              Sign in with college account
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/dashboard"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Explore demo →
            </Link>
          </div>
        </div>

        {/* Feature row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20">
          {[
            {
              icon: Filter,
              title: "Auto-triage",
              body: "Every email scored and sorted into important or low priority — instantly.",
            },
            {
              icon: Calendar,
              title: "Date extraction",
              body: "Exams, deadlines, and event timings pulled out and dropped into your calendar.",
            },
            {
              icon: Sparkles,
              title: "Concise summaries",
              body: "Two-line summaries for noise. Detail with action items for what matters.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-surface p-6 rounded-2xl border border-border shadow-sm"
            >
              <div className="size-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-4">
                <f.icon className="size-4" />
              </div>
              <h3 className="font-bold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>

        {/* Preview slab */}
        <div className="mt-20 rounded-3xl border border-border bg-surface shadow-2xl shadow-academic/5 overflow-hidden">
          <div className="px-6 py-3 border-b border-border flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-destructive/60" />
            <span className="size-2.5 rounded-full bg-warning/60" />
            <span className="size-2.5 rounded-full bg-success/60" />
            <span className="ml-3 text-xs font-mono text-muted-foreground">
              mailmind.app/dashboard
            </span>
          </div>
          <div className="grid grid-cols-12 gap-6 p-6 bg-background">
            <div className="col-span-3 hidden md:flex flex-col gap-2">
              {["Dashboard", "Important", "Low priority", "Calendar", "Archive"].map((l, i) => (
                <div
                  key={l}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    i === 0 ? "bg-accent/10 text-accent font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {l}
                </div>
              ))}
            </div>
            <div className="col-span-12 md:col-span-9 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: "Scanned", v: "142" },
                  { l: "Important", v: "12", a: true },
                  { l: "Deadlines", v: "04" },
                ].map((s) => (
                  <div key={s.l} className="bg-surface p-4 rounded-xl border border-border">
                    <div className="text-[10px] uppercase tracking-wider text-low font-bold">
                      {s.l}
                    </div>
                    <div className={`text-2xl font-bold mt-1 ${s.a ? "text-accent" : ""}`}>
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-surface p-4 rounded-xl border-2 border-accent/20">
                <div className="text-[10px] font-bold text-accent uppercase">Important • Exam</div>
                <div className="font-bold mt-1">Mid-Semester Examination Schedule</div>
                <div className="text-xs text-muted-foreground mt-1">
                  AI Summary: Exams Oct 14 & 16. Bring institute ID, reach 15 min early.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-10 border-t border-border text-xs text-muted-foreground flex justify-between">
        <div>© 2025 Mail Mind — IIT Webmail Intelligence</div>
        <div className="font-mono">v0.1 · demo build</div>
      </footer>
    </div>
  );
}
