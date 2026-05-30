import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { formatTime, monthLabel } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Mail Mind" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);
  const { emails } = useAuth();

  // Extract dates dynamically from active useAuth emails
  const dates = useMemo(() => {
    return emails
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
  }, [emails]);

  // Build month grid (Mon-start)
  const grid = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startDow = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells: Array<{ date: Date | null; key: string }> = [];
    for (let i = 0; i < startDow; i++) cells.push({ date: null, key: `pad-${i}` });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(view.getFullYear(), view.getMonth(), d), key: `d-${d}` });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, key: `endpad-${cells.length}` });
    return cells;
  }, [view]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, typeof dates>();
    for (const d of dates) {
      const k = new Date(d.date).toDateString();
      const arr = m.get(k) ?? [];
      arr.push(d);
      m.set(k, arr);
    }
    return m;
  }, [dates]);

  const selectedEvents = selected ? eventsByDay.get(selected) ?? [] : [];
  const upcoming = dates.filter((d) => new Date(d.date) >= new Date(today.toDateString()));

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dates extracted from your important academic mail.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Month grid */}
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-border p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">{monthLabel(view)}</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                className="size-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
                className="px-3 h-8 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
              >
                Today
              </button>
              <button
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                className="size-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center mb-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="text-[10px] font-bold text-low uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {grid.map((c) => {
              if (!c.date) return <div key={c.key} className="aspect-square" />;
              const k = c.date.toDateString();
              const events = eventsByDay.get(k);
              const isToday = k === today.toDateString();
              const isSelected = k === selected;
              return (
                <button
                  key={c.key}
                  onClick={() => setSelected(k)}
                  className={cn(
                    "aspect-square rounded-xl p-2 text-left border transition-all flex flex-col gap-1",
                    isSelected
                      ? "border-accent bg-accent/5"
                      : "border-transparent hover:border-border hover:bg-muted/50",
                    isToday && !isSelected && "bg-accent/5",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-bold",
                      isToday ? "text-accent" : "text-foreground",
                    )}
                  >
                    {c.date.getDate()}
                  </span>
                  <div className="flex flex-col gap-1 mt-auto">
                    {events?.slice(0, 2).map((e, i) => (
                      <div
                        key={i}
                        className="text-[9px] font-semibold bg-warning/10 text-warning rounded px-1 py-0.5 truncate"
                      >
                        {e.label}
                      </div>
                    ))}
                    {events && events.length > 2 && (
                      <div className="text-[9px] text-muted-foreground">+{events.length - 2}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="font-bold mb-4">
              {selected
                ? `On ${new Date(selected).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                : "Upcoming"}
            </h3>
            <div className="space-y-3">
              {(selected ? selectedEvents : upcoming.slice(0, 6)).map((d) => (
                <Link
                  key={`${d.emailId}-${d.label}`}
                  to="/email/$id"
                  params={{ id: d.emailId }}
                  className="block p-3 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all"
                >
                  <div className="text-[10px] font-bold uppercase text-accent tracking-wider">
                    {new Date(d.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    • {formatTime(d.date)}
                  </div>
                  <div className="text-sm font-bold mt-1">{d.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{d.subject}</div>
                </Link>
              ))}
              {selected && selectedEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">No events on this day.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
