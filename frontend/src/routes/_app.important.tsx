import { createFileRoute } from "@tanstack/react-router";
import { EmailCard } from "@/components/EmailCard";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { Star } from "lucide-react";

export const Route = createFileRoute("/_app/important")({
  head: () => ({ meta: [{ title: "Important — Mail Mind" }] }),
  component: ImportantPage,
});

function ImportantPage() {
  const { emails } = useAuth();
  const items = emails.filter((e) => e.category === "important");

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Important</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Academic, actionable, and time-sensitive mail — surfaced with summaries.
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No important emails yet"
          description="When the triage agent finds something actionable, it'll show up here."
        />
      ) : (
        <div className="space-y-4">
          {items.map((e) => (
            <EmailCard key={e.id} email={e} />
          ))}
        </div>
      )}
    </div>
  );
}
