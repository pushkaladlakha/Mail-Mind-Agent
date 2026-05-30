import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { formatTime } from "@/lib/format";

export function DeadlineList({ limit }: { limit?: number }) {
  const { emails } = useAuth();

  const allDeadlines = emails
    .flatMap((e) =>
      e.extractedDates.map((d) => ({
        ...d,
        emailId: e.id,
        kind: e.kind,
        sender: e.sender,
        subject: e.subject,
      }))
    )
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const items = allDeadlines.slice(0, limit ?? 4);

  return (
    <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm">
      <h3 className="font-bold mb-4 flex items-center justify-between">
        Critical Deadlines
        <span className="text-[10px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-mono">
          {allDeadlines.length} found
        </span>
      </h3>
      <div className="space-y-4">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No upcoming deadlines detected.</p>
        ) : (
          items.map((d) => {
            const date = new Date(d.date);
            return (
              <Link
                key={`${d.emailId}-${d.label}`}
                to="/email/$id"
                params={{ id: d.emailId }}
                className="flex items-center gap-4 group"
              >
                <div className="size-12 bg-muted rounded-xl flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">
                    {date.toLocaleString(undefined, { month: "short" })}
                  </span>
                  <span className="text-sm font-bold leading-none">{date.getDate()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate group-hover:text-accent transition-colors">
                    {d.label}
                  </p>
                  <p className="text-[10px] text-low uppercase tracking-wider truncate">
                    {formatTime(d.date)} • {d.location ?? d.sender}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
      <Link
        to="/calendar"
        className="block w-full mt-6 py-2 text-xs font-bold text-muted-foreground border border-border rounded-xl hover:bg-surface-muted text-center transition-colors"
      >
        View Full Calendar
      </Link>
    </div>
  );
}
