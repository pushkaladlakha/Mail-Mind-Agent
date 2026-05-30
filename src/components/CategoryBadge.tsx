import { cn } from "@/lib/utils";
import type { EmailCategory, EmailKind } from "@/lib/mock-data";

const kindLabel: Record<EmailKind, string> = {
  exam: "Exam",
  lab: "Lab",
  academic: "Academic",
  event: "Event",
  admin: "Admin",
  promo: "Promo",
  newsletter: "Newsletter",
};

export function CategoryBadge({
  category,
  kind,
  className,
}: {
  category: EmailCategory;
  kind?: EmailKind;
  className?: string;
}) {
  const important = category === "important";
  const isExam = kind === "exam";
  const isLab = kind === "lab";

  const styles = important
    ? isExam
      ? "bg-accent/10 text-accent"
      : isLab
        ? "bg-success/10 text-success"
        : "bg-accent/10 text-accent"
    : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
        styles,
        className,
      )}
    >
      {important ? "Important" : "Less relevant"}
      {kind ? <span className="opacity-70">• {kindLabel[kind]}</span> : null}
    </span>
  );
}
