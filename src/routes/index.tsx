import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, Filter, Sparkles, Shield, Bookmark, Eye } from "lucide-react";

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
    <div className="min-h-screen bg-background relative overflow-hidden bg-[linear-gradient(to_right,#00000004_1px,transparent_1px),linear-gradient(to_bottom,#00000004_1px,transparent_1px)] bg-[size:4rem_4rem]">
      {/* Background Glowing Ambient Blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[35rem] h-[35rem] rounded-full bg-academic/10 blur-[120px] animate-blob-1" />
        <div className="absolute top-[20%] -right-40 w-[40rem] h-[40rem] rounded-full bg-accent/10 blur-[130px] animate-blob-2" />
        <div className="absolute -bottom-40 left-[20%] w-[35rem] h-[35rem] rounded-full bg-emerald-500/5 blur-[120px] animate-blob-3" />
      </div>

      {/* Nav */}
      <nav className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-academic text-white rounded-xl flex items-center justify-center font-bold shadow-md shadow-academic/20 transition-all hover:scale-105">
            M
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            Mail Mind
          </span>
        </div>
        <Link
          to="/connect"
          className="text-sm font-bold text-academic border border-academic/20 bg-academic/5 px-5 py-2 rounded-full hover:bg-academic hover:text-white transition-all duration-300 shadow-sm cursor-pointer"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 md:pt-24 pb-20 relative z-10">
        <div className="max-w-3xl text-left">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-academic/10 text-academic text-xs font-bold uppercase tracking-[0.18em] mb-8 border border-academic/10 animate-fade-in shadow-sm">
            <Sparkles className="size-3.5" />
            IIT Webmail Intelligence
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.02] text-balance">
            Signal over noise. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-academic via-accent to-amber-600">
              Academic mail, triaged.
            </span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mt-8 max-w-[55ch] text-pretty leading-relaxed">
            An intelligent sorting layer for your college inbox. We extract deadlines, summarize announcements, and archive the noise so you can focus on what matters.
          </p>
          <div className="mt-12 flex flex-wrap items-center gap-5">
            <Link
              to="/connect"
              className="inline-flex items-center gap-2 bg-academic text-white px-7 py-4 rounded-xl text-sm font-extrabold shadow-lg shadow-academic/30 hover:opacity-95 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] cursor-pointer"
            >
              Connect IIT Mail
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/connect"
              className="inline-flex items-center gap-2 bg-surface border border-border text-foreground hover:bg-muted/50 px-7 py-4 rounded-xl text-sm font-extrabold shadow-sm transition-all active:scale-[0.99] cursor-pointer"
            >
              Explore Demo Mode
            </Link>
          </div>
        </div>

        {/* Feature Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24">
          {[
            {
              icon: Filter,
              title: "Auto-Triage Flow",
              body: "Every email scored and classified into academic priorities or low-priority feeds instantly.",
              color: "text-blue-600 bg-blue-500/10 border-blue-500/10",
            },
            {
              icon: Calendar,
              title: "Deadline Extraction",
              body: "Exams, submissions, and event details intelligently extracted and pushed to your Google Calendar.",
              color: "text-amber-600 bg-amber-500/10 border-amber-500/10",
            },
            {
              icon: Sparkles,
              title: "AI Snippet Summaries",
              body: "Saves hours with two-line summaries for rapid scanning, plus key action items highlighted.",
              color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/10",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-surface/80 backdrop-blur-md p-8 rounded-3xl border border-border/80 shadow-sm hover:shadow-[0_20px_40px_-15px_oklch(0.52_0.07_55_/_0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col items-start text-left"
            >
              <div className={`size-12 rounded-2xl flex items-center justify-center mb-6 border ${f.color}`}>
                <f.icon className="size-5" />
              </div>
              <h3 className="font-extrabold text-lg text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>

        {/* Premium Dashboard Preview Slab */}
        <div className="mt-28 rounded-3xl border border-border/80 bg-surface/60 backdrop-blur-xl shadow-2xl shadow-academic/10 overflow-hidden relative group">
          <div className="px-6 py-4 border-b border-border/80 bg-surface/80 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-red-400" />
              <span className="size-3 rounded-full bg-yellow-400" />
              <span className="size-3 rounded-full bg-green-400" />
              <span className="ml-3 text-xs font-semibold font-mono text-muted-foreground bg-background px-3 py-1 rounded-full border border-border/50">
                mailmind.iitd.ac.in/dashboard
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <Shield className="size-3.5 text-success" />
              Secure TLS Session Active
            </div>
          </div>
          
          <div className="grid grid-cols-12 gap-6 p-6 md:p-8 bg-background/50">
            {/* Mock Sidebar */}
            <div className="col-span-3 hidden md:flex flex-col gap-2 border-r border-border/60 pr-6">
              {[
                { name: "Dashboard", count: "12", active: true },
                { name: "Important", count: "4" },
                { name: "Low Priority", count: "8" },
                { name: "Google Calendar" },
                { name: "Deleted Trash" },
              ].map((l) => (
                <div
                  key={l.name}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex justify-between items-center transition-all ${
                    l.active
                      ? "bg-academic text-white shadow-md shadow-academic/10"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <span>{l.name}</span>
                  {l.count && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${l.active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground border border-border"}`}>
                      {l.count}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Mock Dashboard Stream */}
            <div className="col-span-12 md:col-span-9 space-y-5 text-left">
              {/* Mock Stat Panel */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { l: "Scanned Today", v: "142", border: "border-border" },
                  { l: "Important Streams", v: "04", a: true, border: "border-academic/30 shadow-sm" },
                  { l: "Deadlines Extracted", v: "02", border: "border-border" },
                ].map((s) => (
                  <div key={s.l} className={`bg-surface/90 backdrop-blur-md p-4 rounded-2xl border ${s.border}`}>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-extrabold">
                      {s.l}
                    </div>
                    <div className={`text-2xl md:text-3xl font-extrabold mt-1 tracking-tight ${s.a ? "text-academic" : "text-foreground"}`}>
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mock Email Items */}
              <div className="space-y-4">
                {/* Email 1 */}
                <div className="bg-surface/90 backdrop-blur-md p-5 rounded-2xl border border-academic/30 shadow-sm hover:scale-[1.005] transition-all relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-academic" />
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold text-academic bg-academic/10 px-2 py-0.5 rounded border border-academic/20 uppercase tracking-wider">
                          Important
                        </span>
                        <span className="text-[10px] font-extrabold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-wider">
                          Submissions
                        </span>
                        <span className="text-xs font-bold text-foreground">Prof. Anil K. (CSE)</span>
                      </div>
                      <h4 className="font-extrabold text-sm md:text-base text-foreground mt-2">
                        Mid-Semester Minor Examination Guidelines
                      </h4>
                      <p className="text-xs text-muted-foreground/80 mt-1.5 line-clamp-2 leading-relaxed">
                        Dear students, please find attached the syllabus and exam instructions for the course. Mid-sem will happen in LH-121 at 9:00 AM sharp on Monday.
                      </p>
                      <div className="flex gap-4 mt-3 flex-wrap">
                        <div className="text-[10px] font-bold text-amber-600 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 flex items-center gap-1">
                          <Calendar className="size-3" />
                          Exam: Oct 14 at 9:00 AM (LH-121)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email 2 */}
                <div className="bg-surface/60 backdrop-blur-md p-5 rounded-2xl border border-border shadow-sm opacity-85">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border uppercase tracking-wider">
                          Low Priority
                        </span>
                        <span className="text-xs font-bold text-foreground">IITD Robotics Club</span>
                      </div>
                      <h4 className="font-extrabold text-sm md:text-base text-foreground mt-2">
                        Weekly Robot Design Workshop & Meetup
                      </h4>
                      <p className="text-xs text-muted-foreground/80 mt-1.5 line-clamp-1 leading-relaxed">
                        Hey bots! We are hosting a hands-on session building simple motor drivers this Friday in the lab.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-border/80 text-xs text-muted-foreground flex justify-between items-center relative z-10">
        <div>© 2026 Mail Mind — IIT Webmail Intelligence</div>
        <div className="font-mono bg-surface border border-border px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">
          v0.2 · secure auth release
        </div>
      </footer>
    </div>
  );
}
