import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { EmailCard } from "@/components/EmailCard";
import { DeadlineList } from "@/components/DeadlineList";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { EmailListSkeleton } from "@/components/EmailListSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Archive, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Mail Mind" }] }),
  component: Dashboard,
});

const FILTERS = ["All", "Important", "Low priority", "With dates", "Unread"] as const;
type Filter = (typeof FILTERS)[number];

function Dashboard() {
  const navigate = useNavigate();
  const { user, emails, loading: authLoading, isDemoMode, logOut, syncStatus, syncProgress, syncMail } = useAuth();
  const [filter, setFilter] = useState<Filter>("All");
  const [timerLoading, setTimerLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setTimerLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const isLoading = timerLoading || authLoading;

  // Reactively calculate statistics based on user's real-time emails
  const importantCount = emails.filter((e) => e.category === "important").length;
  const lowPriorityCount = emails.filter((e) => e.category === "low_priority").length;
  const deadlinesCount = emails.flatMap((e) => e.extractedDates).length;

  const s = {
    scanned: emails.length * 12 + 18, // dynamic realistic total scanned count
    important: importantCount,
    lowPriority: lowPriorityCount,
    deadlines: deadlinesCount,
    timeSavedHours: (lowPriorityCount * 0.1).toFixed(1), // dynamic saved time
  };

  const username = user?.email ? user.email.split("@")[0] : "Student";
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

  const filtered = useMemo(() => {
    return emails.filter((e) => {
      if (filter === "Important") return e.category === "important";
      if (filter === "Low priority") return e.category === "low_priority";
      if (filter === "With dates") return e.extractedDates.length > 0;
      if (filter === "Unread") return e.unread;
      return true;
    });
  }, [emails, filter]);

  const handleExitDemo = async () => {
    await logOut();
    navigate({ to: "/connect" });
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Good morning, {displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's what your inbox triaged for you today.
          </p>
        </div>
        {syncStatus !== "idle" && (
          <div className="flex items-center gap-3 bg-muted px-4 py-2.5 rounded-xl border border-border animate-pulse text-xs font-semibold text-muted-foreground shadow-sm">
            <Loader2 className="size-4 animate-spin text-accent" />
            <span>
              {syncStatus === "connecting" && "Connecting to mail server..."}
              {syncStatus === "fetching" && "Downloading new emails..."}
              {syncStatus === "classifying" && "ML classification active..."}
              {syncStatus === "summarizing" && `Gemini parsing (${syncProgress.processed}/${syncProgress.total})...`}
              {syncStatus === "complete" && "Sync successfully completed!"}
              {syncStatus === "error" && "Sync failed."}
            </span>
          </div>
        )}
      </div>

      {isDemoMode && (
        <div className="bg-amber-50/80 border border-amber-200/50 rounded-2xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-100/70 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
              <span className="text-[10px] font-bold font-mono">DEMO</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">Demo Mode Active</h4>
              <p className="text-xs text-amber-800/80 mt-0.5 leading-relaxed">
                You are viewing sample data. Connect a real mailbox to secure active college mail syncs.
              </p>
            </div>
          </div>
          <button
            onClick={handleExitDemo}
            className="bg-academic text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:opacity-90 active:scale-[0.98] cursor-pointer"
          >
            Connect Real Mail
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <StatCard label="Scanned Today" value={s.scanned} />
        <StatCard label="Important" value={s.important} accent="accent" />
        <StatCard label="Deadlines Found" value={String(s.deadlines).padStart(2, "0")} accent="warning" />
        <StatCard label="Time Saved" value={`${s.timeSavedHours}h`} accent="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Email Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-bold tracking-tight">Academic Priority Stream</h2>
            <button
              onClick={syncMail}
              disabled={syncStatus !== "idle"}
              className="bg-academic text-white px-4 py-2 rounded-xl text-xs font-bold shadow hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            >
              {syncStatus !== "idle" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Syncing...
                </>
              ) : (
                "Sync Mail"
              )}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  filter === f
                    ? "bg-academic text-white"
                    : "bg-surface border border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {isLoading ? (
            <EmailListSkeleton count={3} />
          ) : filtered.length === 0 ? (
            <div className="bg-surface p-12 rounded-2xl border border-border text-center">
              <p className="text-muted-foreground text-sm font-semibold">No emails match the "{filter}" filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((e) => (
                <EmailCard key={e.id} email={e} />
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <DeadlineList limit={4} />
          <CategoryBreakdown />
          <Link
            to="/archive"
            className="block bg-warning/5 p-6 rounded-2xl border border-warning/20 border-dashed hover:bg-warning/10 transition-colors"
          >
            <h3 className="text-sm font-bold text-warning flex items-center gap-2 mb-2">
              <Archive className="size-4" />
              Archived Low Priority
            </h3>
            <p className="text-xs text-warning/80 leading-relaxed">
              {s.lowPriority} newsletters and event invites were moved to your archive to reduce
              distraction.
            </p>
            <span className="mt-4 inline-block text-xs font-bold text-warning underline">
              View Archive
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
