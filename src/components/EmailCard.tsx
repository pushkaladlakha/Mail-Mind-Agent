import { Link } from "@tanstack/react-router";
import { Calendar, Paperclip } from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import type { Email } from "@/lib/mock-data";
import { timeAgo, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function EmailCard({ email }: { email: Email }) {
  const important = email.category === "important";
  const featured = important && email.priorityScore >= 90;

  if (!important) {
    return (
      <Link
        to="/email/$id"
        params={{ id: email.id }}
        className="block bg-surface/60 p-4 rounded-xl border border-border flex items-center gap-4 opacity-90 hover:opacity-100 hover:border-low transition-all"
      >
        <div className="size-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-bold shrink-0">
          {email.sender.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-foreground truncate">{email.subject}</h4>
            <CategoryBadge category={email.category} kind={email.kind} className="shrink-0" />
          </div>
          <p className="text-xs text-low truncate mt-0.5">{email.summary}</p>
        </div>
        <span className="text-[10px] text-low shrink-0 font-mono">{timeAgo(email.receivedAt)}</span>
      </Link>
    );
  }

  return (
    <Link
      to="/email/$id"
      params={{ id: email.id }}
      className={cn(
        "block bg-surface p-6 rounded-2xl shadow-sm relative group transition-all hover:border-accent",
        featured ? "border-2 border-accent/20 shadow-md" : "border border-border",
      )}
    >
      <div className="flex justify-between items-start mb-3 gap-4">
        <div className="min-w-0">
          <CategoryBadge category={email.category} kind={email.kind} />
          <h4 className="text-lg font-bold mt-2 leading-tight">{email.subject}</h4>
          <p className="text-sm text-low mt-1">
            From: <span className="text-academic font-medium">{email.sender}</span>
          </p>
        </div>
        <span className="text-xs text-low shrink-0 font-mono">{timeAgo(email.receivedAt)}</span>
      </div>

      <div className="bg-surface-muted p-4 rounded-xl mb-4 border border-border">
        <p className="text-sm leading-relaxed text-foreground/80 italic">
          <span className="font-bold text-accent not-italic">AI Summary: </span>
          {email.summary}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {email.extractedDates.slice(0, 2).map((d) => (
          <div
            key={d.label}
            className="flex items-center gap-1.5 px-3 py-1 bg-warning/10 text-warning text-xs font-semibold rounded-full"
          >
            <Calendar className="size-3" />
            {formatDate(d.date)} — {d.label}
          </div>
        ))}
        {email.tags.includes("Project") && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Paperclip className="size-3.5" />
            lab_manual.pdf
          </div>
        )}
        <span className="ml-auto text-xs font-bold text-accent group-hover:underline">Open →</span>
      </div>
    </Link>
  );
}
