import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Shield, CheckCircle, AlertTriangle, Key } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Mail Mind" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { 
    preferences, 
    savePreferences, 
    firebaseConfigured, 
    user, 
    isDemoMode, 
    logOut, 
    connectGoogleCalendar, 
    disconnectGoogleCalendar 
  } = useAuth();

  const [length, setLength] = useState([preferences.summaryLength]);
  const [notify, setNotify] = useState(preferences.notifyImportant);
  const [digest, setDigest] = useState(preferences.notifyDigest);
  const [sync, setSync] = useState(preferences.autoSyncCalendar);

  // Keep state in sync with updated preferences from auth context
  useEffect(() => {
    setLength([preferences.summaryLength]);
    setNotify(preferences.notifyImportant);
    setDigest(preferences.notifyDigest);
    setSync(preferences.autoSyncCalendar);
  }, [preferences]);

  const lengthLabel = ["Short", "Medium", "Detailed"][length[0] - 1];

  const save = async () => {
    try {
      await savePreferences({
        summaryLength: length[0],
        notifyImportant: notify,
        notifyDigest: digest,
        autoSyncCalendar: sync,
      });
      toast.success("Settings saved", { description: "Your preferences are up to date in the database." });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save settings preferences.");
    }
  };

  const displayEmail = user?.email || "student.24@iit.ac.in";

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tune how Mail Mind summarizes, notifies, and syncs.
        </p>
      </div>

      {/* Demo Mode Configuration Panel */}
      {isDemoMode && (
        <section className="bg-surface rounded-2xl border border-border p-6 space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            Demo Mode Configuration
          </h3>
          <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-900">Current Status: Demo Mode Active</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                You are currently triaging sample IIT-style emails. Exit or log out to connect a real mailbox.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={async () => {
                  await logOut();
                  navigate({ to: "/connect" });
                }}
                className="bg-academic text-white px-4 py-2 rounded-lg text-xs font-bold shadow hover:opacity-90 active:scale-[0.98] cursor-pointer"
              >
                Connect Real Account
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="bg-surface rounded-2xl border border-border p-6 space-y-6">
        <div>
          <h3 className="font-bold">Summary length</h3>
          <p className="text-sm text-muted-foreground mt-1">
            How much detail the AI should include in summaries.
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-xs font-mono text-muted-foreground">
            <span>Short</span>
            <span>Medium</span>
            <span>Detailed</span>
          </div>
          <Slider value={length} onValueChange={setLength} min={1} max={3} step={1} />
          <div className="text-sm font-semibold text-accent">{lengthLabel}</div>
        </div>
      </section>

      <section className="bg-surface rounded-2xl border border-border p-6 space-y-5">
        <h3 className="font-bold">Notifications</h3>
        <Row
          title="Important email alerts"
          desc="Push a toast when something high-priority arrives."
          checked={notify}
          onChange={setNotify}
        />
        <Row
          title="Daily digest"
          desc="Get a 9 AM summary of overnight academic mail."
          checked={digest}
          onChange={setDigest}
        />
      </section>

      <section className="bg-surface rounded-2xl border border-border p-6 space-y-5">
        <h3 className="font-bold flex items-center justify-between">
          <span>Calendar sync</span>
          {preferences.calendarConnected && (
            <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-bold border border-success/20">
              Active Sync
            </span>
          )}
        </h3>
        <Row
          title="Auto-sync extracted dates"
          desc="Push deadlines and exam dates to your institute calendar."
          checked={sync}
          onChange={setSync}
        />
        
        {preferences.calendarConnected ? (
          <div className="bg-muted/50 border rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Connected Google Account</div>
              <div className="text-sm font-semibold text-foreground select-all">
                {preferences.calendarEmail}
              </div>
            </div>
            <button
              onClick={disconnectGoogleCalendar}
              className="text-xs text-destructive hover:underline font-bold"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="bg-muted/50 border border-dashed border-border rounded-xl p-4 flex flex-col items-center text-center space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
              Link your personal or institute Google Calendar to automatically schedule exam timetables, quiz submissions, and project deadlines directly to your agenda.
            </p>
            <button
              onClick={connectGoogleCalendar}
              className="bg-accent text-white px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 active:scale-[0.97] cursor-pointer inline-flex items-center gap-1.5 transition-all"
            >
              Connect Google Calendar
            </button>
          </div>
        )}
      </section>

      {/* Firebase Configuration Info Panel */}
      <section className="bg-surface rounded-2xl border border-border p-6 space-y-4">
        <h3 className="font-bold flex items-center gap-2">
          <Shield className="size-4 text-accent" />
          Firebase Integration Status
        </h3>

        {firebaseConfigured ? (
          <div className="bg-success/5 border border-success/20 rounded-xl p-4 flex gap-3">
            <CheckCircle className="size-5 text-success shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-success">Cloud Storage Connected</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Mail Mind is successfully connected to your Google Firebase project! All email summaries, category edits, and settings are securely saved in the cloud under your personal user profile.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-warning">Offline/Demo Mode</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  The application is running in fully-functional Offline/Demo Mode. Your data is successfully synced in real-time, but is preserved locally inside your browser's <code className="font-mono bg-muted px-1.5 py-0.5 rounded">localStorage</code>.
                </p>
              </div>
            </div>

            {!isDemoMode && (
              <div className="bg-muted rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <Key className="size-3.5" />
                  How to Connect Firebase Cloud
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  To connect to active cloud databases, simply open the <code className="font-mono bg-surface border px-1 rounded">.env</code> file in your project root and populate it with your Firebase console client keys:
                </p>
                <pre className="text-[10px] font-mono bg-background p-3 rounded-lg border border-border overflow-x-auto text-muted-foreground select-all">
{`VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-app
VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcd1234`}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <button
          onClick={save}
          className="bg-academic text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 active:scale-[0.98] cursor-pointer"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}

function Row({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
