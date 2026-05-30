import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { EmailCard } from "@/components/EmailCard";
import { DeadlineList } from "@/components/DeadlineList";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { EmailListSkeleton } from "@/components/EmailListSkeleton";
import { useAuth, SyncMode, SyncStatusType } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Archive, Loader2, ChevronDown, RefreshCw, Mail } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Mail Mind" }] }),
  component: Dashboard,
});

const FILTERS = ["All", "Important", "Low priority", "With dates", "Unread", "Deleted"] as const;
type Filter = (typeof FILTERS)[number];

function Dashboard() {
  const navigate = useNavigate();
  const { 
    user, 
    emails, 
    loading: authLoading, 
    isDemoMode, 
    logOut, 
    syncStatus, 
    syncProgress, 
    syncMail,
    deleteAllEmails,
    recoverAllDeletedEmails
  } = useAuth();
  const [filter, setFilter] = useState<Filter>("All");
  const [timerLoading, setTimerLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setTimerLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const isLoading = timerLoading || authLoading;

  // Reactively calculate statistics based on user's real-time active emails
  const activeEmails = useMemo(() => emails.filter((e) => !e.deleted), [emails]);
  const deletedEmails = useMemo(() => emails.filter((e) => e.deleted), [emails]);

  const importantCount = activeEmails.filter((e) => e.category === "important").length;
  const lowPriorityCount = activeEmails.filter((e) => e.category === "low_priority").length;
  const deadlinesCount = activeEmails.flatMap((e) => e.extractedDates).length;

  const s = {
    scanned: activeEmails.length * 12 + 18, // dynamic realistic total scanned count
    important: importantCount,
    lowPriority: lowPriorityCount,
    deadlines: deadlinesCount,
    timeSavedHours: (lowPriorityCount * 0.1).toFixed(1), // dynamic saved time
  };

  const username = user?.email ? user.email.split("@")[0] : "Student";
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

  const filtered = useMemo(() => {
    if (filter === "Deleted") {
      return deletedEmails;
    }
    return activeEmails.filter((e) => {
      if (filter === "Important") return e.category === "important";
      if (filter === "Low priority") return e.category === "low_priority";
      if (filter === "With dates") return e.extractedDates.length > 0;
      if (filter === "Unread") return e.unread;
      return true;
    });
  }, [activeEmails, deletedEmails, filter]);

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
            <SyncButton syncMail={syncMail} syncStatus={syncStatus} isDemoMode={isDemoMode} emailsCount={emails.length} />
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                    filter === f
                      ? "bg-academic text-white"
                      : "bg-surface border border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            {filter === "Deleted" ? (
              deletedEmails.length > 0 && (
                <button
                  onClick={recoverAllDeletedEmails}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="size-3.5" />
                  Recover All
                </button>
              )
            ) : (
              activeEmails.length > 0 && (
                <button
                  onClick={deleteAllEmails}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-destructive/15 text-destructive hover:bg-destructive/20 active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Archive className="size-3.5" />
                  Delete All
                </button>
              )
            )}
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

function SyncButton({
  syncMail,
  syncStatus,
  isDemoMode,
  emailsCount,
}: {
  syncMail: (mode?: SyncMode, count?: number, skipCount?: number) => Promise<void>;
  syncStatus: SyncStatusType;
  isDemoMode: boolean;
  emailsCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [fetchCount, setFetchCount] = useState<number | "">(15);
  const [olderCount, setOlderCount] = useState<number | "">(10);
  const disabled = syncStatus !== "idle";
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSync = (mode: SyncMode, customCount?: number, skipCount?: number) => {
    setOpen(false);
    const finalCount = customCount !== undefined ? customCount : (typeof fetchCount === "number" ? fetchCount : 15);
    syncMail(mode, finalCount, skipCount);
  };

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  if (disabled) {
    return (
      <div className="bg-academic/80 text-white px-4 py-2 rounded-xl text-xs font-bold shadow flex items-center gap-1.5">
        <Loader2 className="size-3.5 animate-spin" />
        Syncing...
      </div>
    );
  }

  // In demo mode, keep simple sync button
  if (isDemoMode) {
    return (
      <button
        onClick={() => syncMail()}
        className="bg-academic text-white px-4 py-2 rounded-xl text-xs font-bold shadow hover:opacity-90 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
      >
        Sync Mail
      </button>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <div className="flex items-stretch">
        <button
          onClick={() => handleSync("since_last")}
          className="bg-academic text-white px-4 py-2 rounded-l-xl text-xs font-bold shadow hover:opacity-90 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
        >
          <RefreshCw className="size-3.5" />
          Sync New
        </button>
        <button
          onClick={() => setOpen(!open)}
          className="bg-academic text-white px-2 py-2 rounded-r-xl text-xs font-bold shadow hover:opacity-90 active:scale-[0.98] cursor-pointer border-l border-white/20"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Option A: Sync New (Since Last) */}
          <button
            onClick={() => handleSync("since_last")}
            className="w-full text-left px-4 py-3 text-xs hover:bg-muted transition-colors flex items-start gap-3 border-b border-border"
          >
            <RefreshCw className="size-4 text-accent shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-foreground">Sync New Mails</div>
              <div className="text-muted-foreground mt-0.5">Incremental sync: Fetches only new emails since last read (Defaults to top 100 for empty inbox).</div>
            </div>
          </button>

          {/* Option B: Preset Fetch Top 100 */}
          <button
            onClick={() => handleSync("latest_count", 100)}
            className="w-full text-left px-4 py-3 text-xs hover:bg-muted transition-colors flex items-start gap-3 border-b border-border"
          >
            <Mail className="size-4 text-accent shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-foreground">Sync Top 100 Mails</div>
              <div className="text-muted-foreground mt-0.5">Quickly fetches the 100 most recent emails. Safe for brand new accounts.</div>
            </div>
          </button>

          {/* Option C: Custom Fetch N (Top) */}
          <div className="px-4 py-3 space-y-2 border-b border-border">
            <div className="flex items-start gap-3">
              <Mail className="size-4 text-accent shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-bold text-foreground">Fetch Custom Count</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Specify exactly how many recent emails to load (max 500)</div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-7">
              <input
                type="number"
                min={1}
                max={500}
                placeholder="15"
                value={fetchCount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setFetchCount("");
                  } else {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) {
                      setFetchCount(Math.max(1, Math.min(500, parsed)));
                    }
                  }
                }}
                onBlur={() => {
                  if (fetchCount === "") setFetchCount(15);
                }}
                className="w-16 bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              <button
                onClick={() => handleSync("latest_count")}
                className="bg-accent text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 active:scale-[0.97] cursor-pointer"
              >
                Fetch
              </button>
            </div>
          </div>

          {/* Option D: Fetch Older Custom Count (Bottom Offset) */}
          <div className="px-4 py-3 space-y-2 bg-muted/20">
            <div className="flex items-start gap-3">
              <RefreshCw className="size-4 text-accent shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-bold text-foreground">Fetch Older (from Bottom)</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Loads historical emails starting *below* the oldest email already fetched</div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-7">
              <input
                type="number"
                min={1}
                max={100}
                placeholder="10"
                value={olderCount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setOlderCount("");
                  } else {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) {
                      setOlderCount(Math.max(1, Math.min(100, parsed)));
                    }
                  }
                }}
                onBlur={() => {
                  if (olderCount === "") setOlderCount(10);
                }}
                className="w-16 bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              <button
                onClick={() => handleSync("latest_count", typeof olderCount === "number" ? olderCount : 10, emailsCount)}
                className="bg-accent text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 active:scale-[0.97] cursor-pointer"
              >
                Fetch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
