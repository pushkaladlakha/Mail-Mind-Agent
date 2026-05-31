import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center py-16 px-6 bg-surface rounded-2xl border border-dashed border-border">
      <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h3 className="font-bold text-base">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>}
    </div>
  );
}
