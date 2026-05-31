import { createFileRoute } from "@tanstack/react-router";
import { EmailCard } from "@/components/EmailCard";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { Inbox } from "lucide-react";

export const Route = createFileRoute("/_app/low-priority")({
  head: () => ({ meta: [{ title: "Low Priority — Mail Mind" }] }),
  component: LowPriorityPage,
});

function LowPriorityPage() {
  const { emails } = useAuth();
  const items = emails.filter((e) => e.category === "low_priority");

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Low Priority</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Newsletters, promos, and ambient updates. One-line summaries only.
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing to skim" description="Inbox is clean." />
      ) : (
        <div className="space-y-2">
          {items.map((e) => (
            <EmailCard key={e.id} email={e} />
          ))}
        </div>
      )}
    </div>
  );
}
