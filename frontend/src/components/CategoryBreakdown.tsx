import { useAuth } from "@/hooks/useAuth";

export function CategoryBreakdown() {
  const { emails } = useAuth();

  const total = emails.length || 1;
  const academic = emails.filter((e) => ["academic", "exam", "lab"].includes(e.kind)).length;
  const events = emails.filter((e) => ["event", "admin"].includes(e.kind)).length;
  const promo = emails.filter((e) => ["promo", "newsletter"].includes(e.kind)).length;

  const b = {
    academic: Math.round((academic / total) * 100),
    events: Math.round((events / total) * 100),
    promo: Math.round((promo / total) * 100),
  };

  const rows = [
    { label: "Academic", pct: b.academic, color: "bg-accent" },
    { label: "Events / Social", pct: b.events, color: "bg-success" },
    { label: "Promotional", pct: b.promo, color: "bg-low" },
  ];

  return (
    <div className="bg-academic p-6 rounded-2xl text-white">
      <h3 className="font-bold mb-4">Intelligence Summary</h3>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">{r.label}</span>
              <span className="font-mono">{r.pct}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className={`${r.color} h-full`} style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
