import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  accent,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  accent?: "default" | "accent" | "warning" | "success";
  hint?: string;
  className?: string;
}) {
  const valueColor =
    accent === "accent"
      ? "text-accent"
      : accent === "warning"
        ? "text-warning"
        : accent === "success"
          ? "text-success"
          : "text-foreground";
  const borderL =
    accent === "warning" ? "border-l-4 border-l-warning" : "";

  return (
    <div
      className={cn(
        "bg-surface p-6 rounded-2xl border border-border shadow-sm",
        borderL,
        className,
      )}
    >
      <p className="text-xs text-low font-medium uppercase tracking-wider">{label}</p>
      <h3 className={cn("text-3xl font-bold mt-1 tracking-tight", valueColor)}>{value}</h3>
      {hint ? <p className="text-xs text-muted-foreground mt-2">{hint}</p> : null}
    </div>
  );
}
