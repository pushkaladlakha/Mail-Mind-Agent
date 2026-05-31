import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Shield, CheckCircle, AlertTriangle, Key, CalendarRange, Eye, EyeOff } from "lucide-react";
import { UserPreferences } from "@/hooks/useAuth";

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
  const [darkMode, setDarkMode] = useState(preferences.darkMode || false);
  const [displayName, setDisplayName] = useState(preferences.displayName || "");

  // Keep state in sync with updated preferences from auth context
  useEffect(() => {
    setLength([preferences.summaryLength]);
    setNotify(preferences.notifyImportant);
    setDigest(preferences.notifyDigest);
    setSync(preferences.autoSyncCalendar);
    setDarkMode(preferences.darkMode || false);
    setDisplayName(preferences.displayName || "");
  }, [preferences]);

  const lengthLabel = ["Short", "Medium", "Detailed"][length[0] - 1];

  const save = async () => {
    try {
      await savePreferences({
        summaryLength: length[0],
        notifyImportant: notify,
        notifyDigest: digest,
        autoSyncCalendar: sync,
        darkMode: darkMode,
        displayName: displayName.trim(),
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

      <section className="bg-surface rounded-2xl border border-border p-6 space-y-4">
        <div>
          <h3 className="font-bold">Personal Profile</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how you are addressed throughout the workspace.
          </p>
        </div>
        <div className="space-y-2 max-w-md text-left">
          <label htmlFor="settings-display-name" className="text-xs font-semibold text-foreground">Your Display Name</label>
          <input
            id="settings-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Pushkal Adlakha"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all font-semibold"
          />
        </div>
      </section>

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
        <h3 className="font-bold">Appearance</h3>
        <Row
          title="Dark Mode Theme"
          desc="Swap to a futuristic deep space navy-black theme."
          checked={darkMode}
          onChange={setDarkMode}
        />
      </section>

      <CalendarSection
        preferences={preferences}
        sync={sync}
        setSync={setSync}
        connectGoogleCalendar={connectGoogleCalendar}
        disconnectGoogleCalendar={disconnectGoogleCalendar}
      />

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

function CalendarSection({
  preferences,
  sync,
  setSync,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
}: {
  preferences: UserPreferences;
  sync: boolean;
  setSync: (v: boolean) => void;
  connectGoogleCalendar: (apiKey: string, calendarId: string) => Promise<void>;
  disconnectGoogleCalendar: () => Promise<void>;
}) {
  const [apiKey, setApiKey] = useState(preferences.googleCalendarApiKey || "");
  const [calendarId, setCalendarId] = useState(preferences.googleCalendarId || "");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setApiKey(preferences.googleCalendarApiKey || "");
    setCalendarId(preferences.googleCalendarId || "");
  }, [preferences.googleCalendarApiKey, preferences.googleCalendarId]);

  const handleConnect = async () => {
    setSaving(true);
    await connectGoogleCalendar(apiKey, calendarId);
    setSaving(false);
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return key.substring(0, 4) + "••••••••" + key.substring(key.length - 4);
  };

  return (
    <section className="bg-surface rounded-2xl border border-border p-6 space-y-5">
      <h3 className="font-bold flex items-center justify-between">
        <span className="flex items-center gap-2">
          <CalendarRange className="size-4 text-accent" />
          Calendar Integration
        </span>
        {preferences.calendarConnected && (
          <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-bold border border-success/20">
            Connected
          </span>
        )}
      </h3>
      <Row
        title="Auto-sync extracted dates"
        desc="Push deadlines and exam dates to your Google Calendar."
        checked={sync}
        onChange={setSync}
      />

      {preferences.calendarConnected ? (
        <div className="space-y-3">
          <div className="bg-success/5 border border-success/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs text-muted-foreground">API Key</div>
                <div className="text-sm font-mono font-semibold text-foreground">
                  {showKey ? preferences.googleCalendarApiKey : maskKey(preferences.googleCalendarApiKey || "")}
                </div>
              </div>
              <button
                onClick={() => setShowKey(!showKey)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Calendar ID</div>
              <div className="text-sm font-semibold text-foreground select-all">
                {preferences.googleCalendarId}
              </div>
            </div>
          </div>
          <button
            onClick={disconnectGoogleCalendar}
            className="text-xs text-destructive hover:underline font-bold"
          >
            Disconnect Calendar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Paste your Google Calendar API key and Calendar ID below to automatically push exam dates, deadlines, and events to your calendar.
          </p>
          <a
            href="https://github.com/pushkaladlakha/Mail-Mind-Agent/blob/main/GOOGLE_CALENDAR_SETUP.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-accent hover:underline"
          >
            📖 How to get your API Key & Calendar ID →
          </a>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Google Calendar API Key</label>
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                {showKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                {showKey ? "Hide" : "Show"} key
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Calendar ID</label>
              <input
                type="text"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder="your-email@gmail.com or calendar ID"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
              />
              <p className="text-[10px] text-muted-foreground">Usually your Gmail address, or find it in Google Calendar → Settings → Calendar ID.</p>
            </div>
          </div>
          <button
            onClick={handleConnect}
            disabled={saving || !apiKey.trim() || !calendarId.trim()}
            className="bg-accent text-white px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 active:scale-[0.97] cursor-pointer inline-flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Connect Google Calendar"}
          </button>
        </div>
      )}
    </section>
  );
}
