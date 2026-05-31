import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_app/archive")({
  head: () => ({ meta: [{ title: "Archive — Mail Mind" }] }),
  component: ArchivePage,
});

function ArchivePage() {
  const { emails } = useAuth();
  const items = useMemo(() => emails.filter((e) => e.category === "low_priority"), [emails]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const tags = useMemo(() => Array.from(new Set(items.flatMap((i) => i.tags))), [items]);
  const filtered = items.filter((e) => {
    const matchesQ =
      !q ||
      e.subject.toLowerCase().includes(q.toLowerCase()) ||
      e.sender.toLowerCase().includes(q.toLowerCase());
    const matchesTag = !tag || e.tags.includes(tag);
    return matchesQ && matchesTag;
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Archive & Notes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Filtered low-priority mail kept around as searchable notes.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search archive..."
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-full text-sm outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTag(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              tag === null ? "bg-academic text-white" : "bg-surface border border-border"
            }`}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t === tag ? null : t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                tag === t ? "bg-academic text-white" : "bg-surface border border-border"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-surface p-12 rounded-2xl border border-border text-center">
            <p className="text-muted-foreground text-sm font-semibold">No archived notes found.</p>
          </div>
        ) : (
          filtered.map((e) => (
            <Link
              to="/email/$id"
              params={{ id: e.id }}
              key={e.id}
              className="bg-surface rounded-2xl border border-border p-5 hover:border-accent hover:shadow-md transition-all flex flex-col"
            >
              <div className="text-[10px] uppercase tracking-wider text-low font-bold mb-2">
                {e.sender} • {timeAgo(e.receivedAt)}
              </div>
              <h3 className="font-bold leading-tight mb-2">{e.subject}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">{e.summary}</p>
              <div className="flex gap-1.5 mt-4 flex-wrap">
                {e.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
