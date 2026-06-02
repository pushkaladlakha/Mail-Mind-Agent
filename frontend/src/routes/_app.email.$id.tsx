import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CategoryBadge } from "@/components/CategoryBadge";
import { formatDate, formatTime, timeAgo } from "@/lib/format";
import { Email } from "@/lib/mock-data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Calendar, CheckCircle2, Star, StickyNote, Trash2, Cpu, Flame } from "lucide-react";

export const Route = createFileRoute("/_app/email/$id")({
  head: () => ({ meta: [{ title: "Email — Mail Mind" }] }),
  component: EmailDetail,
});

function EmailDetail() {
  const { id } = Route.useParams();
  const { emails, updateEmailReadStatus } = useAuth();
  const navigate = useNavigate();

  const email = emails.find((e) => e.id === id);

  // Automatically mark email as read when opened
  useEffect(() => {
    if (email && email.unread) {
      updateEmailReadStatus(email.id, false).catch((err) =>
        console.error("Failed to update read status:", err)
      );
    }
  }, [email, updateEmailReadStatus]);

  if (!email) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-6">Email not found</h1>
      </div>
    );
  }

  const isLow = email.category === "low_priority";

  // ML stats calculations
  const confidence = email.mlConfidence !== undefined ? email.mlConfidence : 0;
  const confidenceColor = confidence >= 85 ? "bg-success" : (confidence >= 65 ? "bg-warning" : "bg-muted-foreground");

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <div className="bg-surface rounded-2xl border border-border p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CategoryBadge category={email.category} kind={email.kind} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-3 leading-tight text-balance">
              {email.subject}
            </h1>
            <div className="text-sm text-muted-foreground mt-2">
              From <span className="font-semibold text-foreground">{email.sender}</span> ·{" "}
              <span className="font-mono">{email.senderEmail}</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-mono shrink-0">
            {formatDate(email.receivedAt)} · {timeAgo(email.receivedAt)}
          </div>
        </div>

        <div
          className={
            isLow
              ? "bg-muted rounded-xl p-4 border border-border"
              : "bg-accent/5 border-2 border-accent/20 rounded-xl p-5"
          }
        >
          <div className="text-[10px] uppercase tracking-wider font-bold text-accent mb-2">
            AI Summary
          </div>
          <p
            className={
              isLow
                ? "text-sm text-foreground/80 leading-relaxed"
                : "text-base text-foreground leading-relaxed"
            }
          >
            {email.summary}
          </p>
        </div>

        {/* Local ML Classifier Engine Panel */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              <Cpu className="size-3.5 text-accent" />
              Local ML Classifier Verdict
            </div>
            {email.mlModelLoaded ? (
              <span className="text-[9px] bg-success/15 text-success border border-success/30 px-2 py-0.5 rounded-full font-bold">
                RandomForest Pipeline Active
              </span>
            ) : (
              <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                Keyword Fallback Mode
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Teammate Model Classification</span>
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold ${email.category === "important" ? "text-success" : "text-low"}`}>
                  {email.mlPrediction || (email.category === "important" ? "Not Spam" : "Spam")}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  (Maps to: {email.category === "important" ? "Important" : "Low Priority"})
                </span>
              </div>
            </div>

            {email.mlConfidence !== undefined && (
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground font-semibold">Prediction Confidence</span>
                  <span className="text-xs font-mono font-bold text-foreground">{confidence}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                  <div 
                    className={`h-full ${confidenceColor} transition-all duration-500`}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {!isLow && email.extractedDates.length > 0 && (
          <DateTimeline email={email} />
        )}

        {isLow && (
          <div className="text-sm text-muted-foreground">
            <p className="leading-relaxed">{email.bodySnippet}</p>
          </div>
        )}

        <Actions email={email} onDelete={() => navigate({ to: "/dashboard" })} />
      </div>

      {!isLow && (
        <details className="bg-surface rounded-2xl border border-border p-6">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
            Show original message
          </summary>
          <p className="text-sm mt-4 leading-relaxed text-foreground/80">{email.bodySnippet}</p>
        </details>
      )}
    </div>
  );
}

function DateTimeline({ email }: { email: Email }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-4">
        Extracted Dates & Actions
      </div>
      <div className="relative pl-6 space-y-5 border-l-2 border-dashed border-border">
        {email.extractedDates.map((d) => (
          <div key={d.label} className="relative">
            <div className="absolute -left-[28px] top-1.5 size-3 rounded-full bg-warning ring-4 ring-warning/20" />
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-bold">{d.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {d.location ?? "—"}
                </div>
              </div>
              <div className="text-xs font-mono font-semibold text-warning">
                {formatDate(d.date)} · {formatTime(d.date)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Actions({ email, onDelete }: { email: Email; onDelete: () => void }) {
  const { updateEmailCategory, deleteEmail } = useAuth();

  const addToCalendar = () =>
    toast.success("Added to calendar", {
      description: `${email.extractedDates.length || 1} date${email.extractedDates.length === 1 ? "" : "s"} synced.`,
    });
  const saveNote = () => toast.success("Saved to notes", { description: email.subject });

  const isImportant = email.category === "important";
  const isLowPriority = email.category === "low_priority";

  const handleMarkImportant = async () => {
    try {
      await updateEmailCategory(email.id, "important");
      toast.success("Marked as important");
    } catch (err) {
      toast.error("Failed to update email category");
    }
  };

  const handleMarkLowPriority = async () => {
    try {
      await updateEmailCategory(email.id, "low_priority");
      toast.success("Moved to low priority");
    } catch (err) {
      toast.error("Failed to update email category");
    }
  };

  const handleDelete = async () => {
    try {
      const wasDeleted = email.deleted;
      await deleteEmail(email.id);
      toast.success(wasDeleted ? "Email permanently deleted" : "Email moved to Deleted Trash");
      onDelete();
    } catch (err) {
      toast.error("Failed to delete email");
    }
  };

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {email.extractedDates.length > 0 && (
        <button
          onClick={addToCalendar}
          className="inline-flex items-center gap-2 bg-academic text-white text-sm font-bold px-4 py-2 rounded-lg hover:opacity-90 active:scale-[0.98] cursor-pointer"
        >
          <Calendar className="size-4" /> Add to Calendar
        </button>
      )}
      <button
        onClick={saveNote}
        className="inline-flex items-center gap-2 bg-surface border border-border text-sm font-bold px-4 py-2 rounded-lg hover:bg-muted cursor-pointer"
      >
        <StickyNote className="size-4" /> Save Note
      </button>
      <button
        onClick={handleMarkImportant}
        className={`inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg border cursor-pointer ${
          isImportant
            ? "bg-accent text-accent-foreground border-accent"
            : "bg-surface border-border hover:bg-muted"
        }`}
      >
        <Star className="size-4" /> Mark Important
      </button>
      <button
        onClick={handleMarkLowPriority}
        className={`inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg border cursor-pointer ${
          isLowPriority
            ? "bg-low text-white border-low"
            : "bg-surface border-border hover:bg-muted"
        }`}
      >
        <CheckCircle2 className="size-4" /> Mark Low Priority
      </button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button className="ml-auto inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer">
            <Trash2 className="size-4" /> {email.deleted ? "Delete Permanently" : "Delete"}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {email.deleted ? "Delete this email permanently?" : "Delete this email?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {email.deleted
                ? "This will permanently purge this email's summaries and metadata from your Mail Mind database. Original university webmail remains untouched."
                : "This moves the email out of active feeds into your Deleted Trash tab. You can recover it at any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className={email.deleted ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer" : "cursor-pointer"}
            >
              {email.deleted ? "Delete Permanently" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
