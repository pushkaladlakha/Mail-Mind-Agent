import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "@/lib/firebase";
import { emails as defaultEmails, Email, EmailCategory } from "@/lib/mock-data";
import {
  cleanEmailBody,
  classifyEmail,
  summarizeWithGemini,
  fetchMailbox,
} from "@/lib/email-service";
import { toast } from "sonner";
import { fetchRealEmails, classifyAndSummarizeEmailFn, classifyAndSummarizeEmailsBatchFn } from "@/lib/api/webmail.functions";

// Mock email ID patterns that should be auto-cleaned from real user databases
const MOCK_EMAIL_ID_PATTERN = /^(e\d+|incoming-\d+)$/;

export interface UserPreferences {
  summaryLength: number; // 1: Short, 2: Medium, 3: Detailed
  notifyImportant: boolean;
  notifyDigest: boolean;
  autoSyncCalendar: boolean;
  calendarConnected?: boolean;
  calendarEmail?: string;
  googleCalendarApiKey?: string;
  googleCalendarId?: string;
  darkMode?: boolean;
  displayName?: string;
  geminiApiKey?: string;
}

export type SyncStatusType = "idle" | "connecting" | "fetching" | "classifying" | "summarizing" | "complete" | "error";
export type SyncMode = "since_last" | "latest_count";

interface AuthContextType {
  user: { email: string | null; uid: string } | null;
  loading: boolean;
  emails: Email[];
  preferences: UserPreferences;
  firebaseConfigured: boolean;
  isDemoMode: boolean;
  syncStatus: SyncStatusType;
  syncProgress: { total: number; processed: number };
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  enterDemoMode: () => Promise<void>;
  syncMail: (mode?: SyncMode, count?: number, skipCount?: number) => Promise<void>;
  lastFetchedUid: number;
  updateEmailCategory: (emailId: string, category: EmailCategory) => Promise<void>;
  updateEmailReadStatus: (emailId: string, unread: boolean) => Promise<void>;
  deleteEmail: (emailId: string) => Promise<void>;
  deleteAllEmails: () => Promise<void>;
  recoverAllDeletedEmails: () => Promise<void>;
  connectGoogleCalendar: (apiKey: string, calendarId: string) => Promise<void>;
  disconnectGoogleCalendar: () => Promise<void>;
  savePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  resetEmailSync: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_PREFS: UserPreferences = {
  summaryLength: 2,
  notifyImportant: true,
  notifyDigest: false,
  autoSyncCalendar: true,
  calendarConnected: false,
  calendarEmail: "",
  googleCalendarApiKey: "",
  googleCalendarId: "",
  darkMode: false,
  displayName: "",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ email: string | null; uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [emails, setEmails] = useState<Email[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFS);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Sync state tracking
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>("idle");
  const [syncProgress, setSyncProgress] = useState({ total: 0, processed: 0 });
  const [lastFetchedUid, setLastFetchedUid] = useState(0);

  // Synchronize darkMode class on document element
  useEffect(() => {
    if (preferences.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [preferences.darkMode]);

  // Initialize and check local storage sessions (offline fallback)
  useEffect(() => {
    try {
      const isDemo = sessionStorage.getItem("mm_is_demo") === "true";
      if (isDemo) {
        setIsDemoMode(true);
        setUser({ email: "demo.student@iit.ac.in", uid: "demo_user" });
        const localEmails = localStorage.getItem("mm_emails_demo_user");
        if (localEmails) {
          setEmails(JSON.parse(localEmails));
        } else {
          localStorage.setItem("mm_emails_demo_user", JSON.stringify(defaultEmails));
          setEmails(defaultEmails);
        }
        const localPrefs = localStorage.getItem("mm_prefs_demo_user");
        if (localPrefs) {
          setPreferences(JSON.parse(localPrefs));
        } else {
          setPreferences(DEFAULT_PREFS);
        }
        setLoading(false);
        return;
      }

      // Check standard offline fallback OR mock bypass accounts (starts with uid_)
      const storedUser = sessionStorage.getItem("mm_user");
      const storedUid = sessionStorage.getItem("mm_uid");
      const isMockBypassUid = storedUid?.startsWith("uid_");

      if (!firebaseConfigured || isMockBypassUid) {
        if (storedUser && storedUid) {
          setUser({ email: storedUser, uid: storedUid });
          const localEmails = localStorage.getItem(`mm_emails_${storedUid}`);
          if (localEmails) {
            const parsed: Email[] = JSON.parse(localEmails);
            // Auto-clean mock emails from localStorage
            const cleaned = parsed.filter((e) => !MOCK_EMAIL_ID_PATTERN.test(e.id));
            if (cleaned.length !== parsed.length) {
              localStorage.setItem(`mm_emails_${storedUid}`, JSON.stringify(cleaned));
            }
            setEmails(cleaned);
          } else {
            localStorage.setItem(`mm_emails_${storedUid}`, JSON.stringify([]));
            setEmails([]);
          }
          const localPrefs = localStorage.getItem(`mm_prefs_${storedUid}`);
          if (localPrefs) {
            setPreferences(JSON.parse(localPrefs));
          } else {
            localStorage.setItem(`mm_prefs_${storedUid}`, JSON.stringify(DEFAULT_PREFS));
            setPreferences(DEFAULT_PREFS);
          }
        }
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("Session restoration failed:", err);
      setLoading(false);
      return;
    }

    // Real Firebase listener
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Prioritize active demo sessions
      if (sessionStorage.getItem("mm_is_demo") === "true") {
        setLoading(false);
        return;
      }

      // Prioritize bypass mock sessions
      const storedUid = sessionStorage.getItem("mm_uid");
      if (storedUid?.startsWith("uid_")) {
        setLoading(false);
        return;
      }

      if (firebaseUser) {
        setUser({ email: firebaseUser.email, uid: firebaseUser.uid });
        setIsDemoMode(false);
      } else {
        setUser(null);
        setEmails([]);
        setPreferences(DEFAULT_PREFS);
        setIsDemoMode(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync real-time Firestore database when a real Firebase user logs in
  useEffect(() => {
    if (isDemoMode) return; // Skip Firestore syncing in demo mode
    if (!firebaseConfigured || !user || !db || user.uid.startsWith("uid_")) return;

    setLoading(true);
    const emailsRef = collection(db, "users", user.uid, "emails");
    const settingsRef = doc(db, "users", user.uid, "settings", "preferences");

    // Listen to real-time emails collection
    const unsubscribeEmails = onSnapshot(
      emailsRef,
      async (snapshot) => {
        if (snapshot.empty) {
          // New account: start with a clean, empty inbox!
          setEmails([]);
        } else {
          const list: Email[] = [];
          const mockIdsToDelete: string[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as Email;
            // Auto-clean any leftover pre-seeded mock emails
            if (MOCK_EMAIL_ID_PATTERN.test(data.id)) {
              mockIdsToDelete.push(data.id);
            } else {
              list.push(data);
            }
          });
          // Background cleanup: delete mock emails from Firestore
          if (mockIdsToDelete.length > 0 && db) {
            const cleanBatch = writeBatch(db);
            mockIdsToDelete.forEach((id) => {
              cleanBatch.delete(doc(db!, "users", user.uid, "emails", id));
            });
            cleanBatch.commit().catch((err) =>
              console.error("Failed to clean mock emails from Firestore:", err)
            );
          }
          // Sort items by date received descending
          list.sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
          setEmails(list);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore emails snapshot error:", err);
        setLoading(false);
      }
    );

    // Listen to real-time settings doc
    const unsubscribeSettings = onSnapshot(
      settingsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setPreferences(docSnap.data() as UserPreferences);
        } else {
          // Seed default preferences in Firestore
          setDoc(settingsRef, DEFAULT_PREFS).catch((err) =>
            console.error("Failed to seed default settings:", err)
          );
        }
      },
      (err) => {
        console.error("Firestore settings snapshot error:", err);
      }
    );

    return () => {
      unsubscribeEmails();
      unsubscribeSettings();
    };
  }, [user, isDemoMode]);

  // Synchronize Google Calendar connection state from saved preferences
  useEffect(() => {
    if (!user || isDemoMode) return;
    // Calendar connection state is driven by the saved API key in preferences
    // No server-side check needed — user inputs their key directly via Settings
  }, [user, isDemoMode]);

  // Auth Operations
  const enterDemoMode = async () => {
    try {
      sessionStorage.setItem("mm_is_demo", "true");
      sessionStorage.setItem("mm_user", "demo.student@iit.ac.in");
      sessionStorage.setItem("mm_uid", "demo_user");
      
      setIsDemoMode(true);
      setUser({ email: "demo.student@iit.ac.in", uid: "demo_user" });

      const localEmails = localStorage.getItem("mm_emails_demo_user");
      if (localEmails) {
        setEmails(JSON.parse(localEmails));
      } else {
        localStorage.setItem("mm_emails_demo_user", JSON.stringify(defaultEmails));
        setEmails(defaultEmails);
      }
      
      const localPrefs = localStorage.getItem("mm_prefs_demo_user");
      if (localPrefs) {
        setPreferences(JSON.parse(localPrefs));
      } else {
        localStorage.setItem("mm_prefs_demo_user", JSON.stringify(DEFAULT_PREFS));
        setPreferences(DEFAULT_PREFS);
      }
    } catch (err) {
      console.error("Failed to enter demo mode:", err);
    }
  };

  const triggerLocalFallback = (email: string) => {
    const dummyUid = `uid_${email.replace(/[^a-zA-Z0-9]/g, "")}`;
    sessionStorage.setItem("mm_session", `sess_${crypto.randomUUID()}`);
    sessionStorage.setItem("mm_user", email);
    sessionStorage.setItem("mm_uid", dummyUid);
    setUser({ email, uid: dummyUid });
    
    const localEmails = localStorage.getItem(`mm_emails_${dummyUid}`);
    if (localEmails) {
      const parsed: Email[] = JSON.parse(localEmails);
      const cleaned = parsed.filter((e) => !MOCK_EMAIL_ID_PATTERN.test(e.id));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(`mm_emails_${dummyUid}`, JSON.stringify(cleaned));
      }
      setEmails(cleaned);
    } else {
      localStorage.setItem(`mm_emails_${dummyUid}`, JSON.stringify([]));
      setEmails([]);
    }
    
    const localPrefs = localStorage.getItem(`mm_prefs_${dummyUid}`);
    if (localPrefs) {
      setPreferences(JSON.parse(localPrefs));
    } else {
      localStorage.setItem(`mm_prefs_${dummyUid}`, JSON.stringify(DEFAULT_PREFS));
      setPreferences(DEFAULT_PREFS);
    }
  };

  const signIn = async (email: string, password: string) => {
    // Exit demo mode cleanly if signing in
    sessionStorage.removeItem("mm_is_demo");
    setIsDemoMode(false);

    const username = email.split("@")[0];
    const isMockBypass = username === "admin" || username === "newinbox";

    if (!firebaseConfigured || isMockBypass) {
      triggerLocalFallback(email);
      return;
    }

    try {
      if (!auth) throw new Error("Firebase Auth is uninitialized");
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      // Fallback if email/password is disabled or user not found
      if (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential") {
        throw error; // Let signUp handle creation
      }
      console.warn("Firebase Auth signin failed. Falling back to local offline session.", error);
      triggerLocalFallback(email);
    }
  };

  const signUp = async (email: string, password: string) => {
    sessionStorage.removeItem("mm_is_demo");
    setIsDemoMode(false);

    const username = email.split("@")[0];
    const isMockBypass = username === "admin" || username === "newinbox";

    if (!firebaseConfigured || isMockBypass) {
      triggerLocalFallback(email);
      return;
    }

    try {
      if (!auth) throw new Error("Firebase Auth is uninitialized");
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.warn("Firebase Auth signup failed. Falling back to local offline session.", error);
      triggerLocalFallback(email);
    }
  };

  const logOut = async () => {
    try {
      sessionStorage.removeItem("mm_session");
      sessionStorage.removeItem("mm_user");
      sessionStorage.removeItem("mm_uid");
      sessionStorage.removeItem("mm_is_demo");
      sessionStorage.removeItem("mm_checkpoint_demo_user");
      setIsDemoMode(false);
      setUser(null);
      setEmails([]);
      setPreferences(DEFAULT_PREFS);

      if (firebaseConfigured && auth) {
        await signOut(auth);
      }
    } catch (err) {
      console.error("Failed to sign out cleanly:", err);
    }
  };

  // Sync Mailbox Pipeline (incremental sync)
  const syncMail = async (mode: SyncMode = "since_last", count: number = 15, skipCount: number = 0) => {
    if (!user) return;
    if (syncStatus !== "idle") return;

    setSyncStatus("connecting");
    setSyncProgress({ total: 0, processed: 0 });

    try {
      // ── DEMO MODE: Use mock fetchMailbox pipeline ──
      if (isDemoMode) {
        let lastCheckpoint = 0;
        const stored = sessionStorage.getItem("mm_checkpoint_demo_user");
        lastCheckpoint = stored ? parseInt(stored, 10) : 0;

        setSyncStatus("fetching");
        const newRawEmails = await fetchMailbox(user.uid, lastCheckpoint);

        if (newRawEmails.length === 0) {
          setSyncStatus("complete");
          toast.info("Sync complete. No new emails found.");
          setTimeout(() => setSyncStatus("idle"), 2000);
          return;
        }

        setSyncProgress({ total: newRawEmails.length, processed: 0 });
        const processedEmails: Email[] = [];
        let importantCount = 0;
        let lowPriorityCount = 0;

        for (let i = 0; i < newRawEmails.length; i++) {
          const item = newRawEmails[i];
          setSyncStatus("classifying");
          const category = classifyEmail(item.subject, item.body);
          if (category === "important") importantCount++;
          else lowPriorityCount++;

          setSyncStatus("summarizing");
          await new Promise((r) => setTimeout(r, 250));
          const cleanedBody = cleanEmailBody(item.body);
          const aiTriage = summarizeWithGemini(item.subject, item.sender, cleanedBody, category);

          processedEmails.push({
            id: item.id,
            sender: item.sender,
            senderEmail: item.senderEmail,
            subject: item.subject,
            bodySnippet: item.body,
            receivedAt: item.receivedAt,
            category,
            kind: aiTriage.kind,
            summary: aiTriage.summary,
            extractedDates: aiTriage.extractedDates,
            tags: aiTriage.tags,
            unread: true,
            priorityScore: aiTriage.priorityScore,
          });
          setSyncProgress((prev) => ({ ...prev, processed: i + 1 }));
        }

        const mergedList = [...processedEmails, ...emails];
        mergedList.sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
        setEmails(mergedList);
        const newCheckpointTime = +new Date();
        localStorage.setItem("mm_emails_demo_user", JSON.stringify(mergedList));
        sessionStorage.setItem("mm_checkpoint_demo_user", String(newCheckpointTime));

        setSyncStatus("complete");
        toast.success("Sync complete", {
          description: `${newRawEmails.length} demo email${newRawEmails.length === 1 ? "" : "s"} triaged (${importantCount} important, ${lowPriorityCount} low-priority).`,
        });
        setTimeout(() => setSyncStatus("idle"), 2500);
        return;
      }

      // ── REAL USER: Live IMAP Fetch (ML & Gemini BYPASSED) ──
      const cachedPassword = sessionStorage.getItem("mm_password");
      if (!cachedPassword) {
        setSyncStatus("error");
        toast.error("Session expired", {
          description: "Please log out and reconnect your webmail credentials to sync.",
        });
        setTimeout(() => setSyncStatus("idle"), 3000);
        return;
      }

      // Load lastFetchedUid from storage if not already set
      // Reset UID tracker to 0 if the local inbox is empty to allow clean re-sync recoveries
      let currentLastUid = lastFetchedUid;
      if (emails.length === 0) {
        currentLastUid = 0;
        setLastFetchedUid(0);
        if (!firebaseConfigured || user.uid.startsWith("uid_")) {
          localStorage.removeItem(`mm_lastuid_${user.uid}`);
        } else if (db) {
          setDoc(doc(db, "users", user.uid, "settings", "lastuid"), { uid: 0 }).catch(() => {});
        }
      } else if (currentLastUid === 0) {
        if (!firebaseConfigured || user.uid.startsWith("uid_")) {
          const storedUid = localStorage.getItem(`mm_lastuid_${user.uid}`);
          if (storedUid) currentLastUid = parseInt(storedUid, 10) || 0;
        } else if (db) {
          try {
            const uidDoc = await getDoc(doc(db, "users", user.uid, "settings", "lastuid"));
            if (uidDoc.exists()) currentLastUid = uidDoc.data().uid || 0;
          } catch (_) {}
        }
        if (currentLastUid > 0) setLastFetchedUid(currentLastUid);
      }

      setSyncStatus("fetching");
      const result = await fetchRealEmails({
        data: {
          email: user.email!,
          password: cachedPassword,
          mode,
          lastUid: currentLastUid > 0 ? currentLastUid : undefined,
          count: currentLastUid === 0 && mode === "since_last" ? 100 : count,
          skipCount,
        }
      });

      if (!result.success || !result.emails) {
        setSyncStatus("error");
        toast.error("Sync failed", {
          description: result.error || "Unable to fetch emails from your webmail server.",
        });
        setTimeout(() => setSyncStatus("idle"), 3000);
        return;
      }

      const liveEmails = result.emails;
      const serverHighestUid = (result as any).highestUid || 0;

      if (liveEmails.length === 0) {
        // Still update the UID tracker even if no new emails
        if (serverHighestUid > currentLastUid) {
          setLastFetchedUid(serverHighestUid);
          if (!firebaseConfigured || user.uid.startsWith("uid_")) {
            localStorage.setItem(`mm_lastuid_${user.uid}`, String(serverHighestUid));
          } else if (db) {
            setDoc(doc(db, "users", user.uid, "settings", "lastuid"), { uid: serverHighestUid }).catch(() => {});
          }
        }
        setSyncStatus("complete");
        toast.info("Sync complete. No new emails found.");
        setTimeout(() => setSyncStatus("idle"), 2000);
        return;
      }

      const existingIds = new Set(emails.map((e) => e.id));
      const newLiveEmails = liveEmails.filter((item) => !existingIds.has(item.id));
      let importantCount = 0;
      let lowPriorityCount = 0;
      let totalProcessed = 0;

      if (newLiveEmails.length > 0) {
        setSyncStatus("classifying");
        setSyncProgress({ total: newLiveEmails.length, processed: 0 });

        // Process in chunks of 5 to show real-time dashboard updates without bottlenecking
        const chunkSize = 5;
        
        for (let offset = 0; offset < newLiveEmails.length; offset += chunkSize) {
          const chunk = newLiveEmails.slice(offset, offset + chunkSize);
          const chunkProcessedEmails: Email[] = [];

          try {
            const batchInput = chunk.map((item) => ({
              id: item.id,
              subject: item.subject,
              sender: item.sender,
              body: item.body,
              studentName: preferences.displayName || "",
              studentEntryNo: preferences.googleCalendarId || "",
            }));

            const batchResult = await classifyAndSummarizeEmailsBatchFn({
              data: { 
                emails: batchInput,
                geminiApiKey: preferences.geminiApiKey || ""
              }
            });

            if (batchResult.success && batchResult.results) {
              const resultsMap = new Map<string, any>();
              batchResult.results.forEach((res: any) => {
                if (res && res.id) {
                  resultsMap.set(res.id, res);
                }
              });

              for (let i = 0; i < chunk.length; i++) {
                const item = chunk[i];
                const aiResult = resultsMap.get(item.id);

                let category: EmailCategory = "low_priority";
                let summary = "";
                let kind: EmailKind = "academic";
                let priorityScore = 25;
                let extractedDates: any[] = [];
                let tags: string[] = ["Live Inbox"];
                let mlPrediction = "Unknown";
                let mlConfidence = undefined;
                let mlModelLoaded = false;

                if (aiResult) {
                  category = aiResult.category as EmailCategory;
                  summary = aiResult.summary || "";
                  kind = aiResult.kind as EmailKind;
                  priorityScore = aiResult.priorityScore || 25;
                  extractedDates = aiResult.extracted_dates || [];
                  tags = aiResult.tags || ["Live Inbox"];
                  mlPrediction = aiResult.ml_prediction || "Unknown";
                  mlConfidence = aiResult.ml_confidence !== undefined ? aiResult.ml_confidence : undefined;
                  mlModelLoaded = !!aiResult.ml_model_loaded;
                } else {
                  category = classifyEmail(item.subject, item.body);
                  const bodyText = (item.body || "").replace(/<[^>]*>/g, "").trim();
                  summary = bodyText.length > 180
                    ? bodyText.substring(0, 180) + "..."
                    : bodyText || "(No content preview)";
                  kind = "academic";
                  priorityScore = category === "important" ? 75 : 25;
                  extractedDates = [];
                  tags = ["Fallback Keyword"];
                }

                if (category === "important") importantCount++;
                else lowPriorityCount++;

                const completeEmail: Email = {
                  id: item.id,
                  sender: item.sender,
                  senderEmail: item.senderEmail,
                  subject: item.subject,
                  bodySnippet: item.body,
                  receivedAt: item.receivedAt,
                  category,
                  kind,
                  summary,
                  extractedDates,
                  tags,
                  unread: true,
                  priorityScore,
                  mlPrediction,
                  mlConfidence,
                  mlModelLoaded,
                };

                chunkProcessedEmails.push(completeEmail);
              }
            } else {
              throw new Error(batchResult.error || "Batch subprocess returned failure status");
            }
          } catch (err) {
            console.warn("Chunk processing failed, using keyword fallbacks:", err);
            for (let i = 0; i < chunk.length; i++) {
              const item = chunk[i];
              const category = classifyEmail(item.subject, item.body);
              const bodyText = (item.body || "").replace(/<[^>]*>/g, "").trim();
              const summary = bodyText.length > 180
                ? bodyText.substring(0, 180) + "..."
                : bodyText || "(No content preview)";

              if (category === "important") importantCount++;
              else lowPriorityCount++;

              const completeEmail: Email = {
                id: item.id,
                sender: item.sender,
                senderEmail: item.senderEmail,
                subject: item.subject,
                bodySnippet: item.body,
                receivedAt: item.receivedAt,
                category,
                kind: "academic",
                summary,
                extractedDates: [],
                tags: ["Fallback Keyword"],
                unread: true,
                priorityScore: category === "important" ? 75 : 25,
              };

              chunkProcessedEmails.push(completeEmail);
            }
          }

          // Merge chunk results into the active state immediately so they display live!
          setEmails((prevEmails) => {
            const merged = [...chunkProcessedEmails, ...prevEmails];
            merged.sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
            
            // Persist locally for immediate safety
            if (!firebaseConfigured || user.uid.startsWith("uid_")) {
              localStorage.setItem(`mm_emails_${user.uid}`, JSON.stringify(merged));
            }
            return merged;
          });

          // Also save this chunk directly to cloud Firestore if enabled!
          if (firebaseConfigured && !user.uid.startsWith("uid_") && db) {
            try {
              const batch = writeBatch(db);
              chunkProcessedEmails.forEach((email) => {
                const emailDoc = doc(db!, "users", user.uid, "emails", email.id);
                batch.set(emailDoc, email);
              });
              await batch.commit();
            } catch (fsErr) {
              console.error("Failed to commit chunk to Firestore:", fsErr);
            }
          }

          totalProcessed += chunk.length;
          setSyncProgress((prev) => ({ ...prev, processed: totalProcessed }));
        }

        // Save last fetched checkpoints
        const newCheckpointTime = +new Date();
        if (!firebaseConfigured || user.uid.startsWith("uid_")) {
          localStorage.setItem(`mm_checkpoint_${user.uid}`, String(newCheckpointTime));
        } else if (db) {
          const checkpointDoc = doc(db!, "users", user.uid, "settings", "checkpoint");
          setDoc(checkpointDoc, { timestamp: newCheckpointTime }).catch(() => {});
        }
      }

      // Save the highest UID for next sync
      if (serverHighestUid > currentLastUid) {
        setLastFetchedUid(serverHighestUid);
        if (!firebaseConfigured || user.uid.startsWith("uid_")) {
          localStorage.setItem(`mm_lastuid_${user.uid}`, String(serverHighestUid));
        } else if (db) {
          setDoc(doc(db, "users", user.uid, "settings", "lastuid"), { uid: serverHighestUid }).catch(() => {});
        }
      }

      if (totalProcessed === 0) {
        setSyncStatus("complete");
        toast.info("Sync complete. No new emails found.");
        setTimeout(() => setSyncStatus("idle"), 2000);
        return;
      }

      setSyncStatus("complete");
      toast.success("Sync complete", {
        description: `${totalProcessed} live email${totalProcessed === 1 ? "" : "s"} fetched (${importantCount} important, ${lowPriorityCount} low-priority).`,
      });

      setTimeout(() => setSyncStatus("idle"), 2500);

    } catch (err) {
      console.error("Sync pipeline failed:", err);
      setSyncStatus("error");
      toast.error("Sync failed", {
        description: "Unable to sync mailbox. Please try again later.",
      });
      setTimeout(() => setSyncStatus("idle"), 3000);
    }
  };

  // Data Operations
  const updateEmailCategory = async (emailId: string, category: EmailCategory) => {
    if (!user) return;
    
    const updated = emails.map((e) => (e.id === emailId ? { ...e, category } : e));
    setEmails(updated);

    if (isDemoMode) {
      localStorage.setItem(`mm_emails_demo_user`, JSON.stringify(updated));
      return;
    }

    if (!firebaseConfigured || user.uid.startsWith("uid_")) {
      localStorage.setItem(`mm_emails_${user.uid}`, JSON.stringify(updated));
      return;
    }

    if (!db) return;
    const emailRef = doc(db, "users", user.uid, "emails", emailId);
    await updateDoc(emailRef, { category });
  };

  const updateEmailReadStatus = async (emailId: string, unread: boolean) => {
    if (!user) return;

    const updated = emails.map((e) => (e.id === emailId ? { ...e, unread } : e));
    setEmails(updated);

    if (isDemoMode) {
      localStorage.setItem(`mm_emails_demo_user`, JSON.stringify(updated));
      return;
    }

    if (!firebaseConfigured || user.uid.startsWith("uid_")) {
      localStorage.setItem(`mm_emails_${user.uid}`, JSON.stringify(updated));
      return;
    }

    if (!db) return;
    const emailRef = doc(db, "users", user.uid, "emails", emailId);
    await updateDoc(emailRef, { unread });
  };

  const deleteEmail = async (emailId: string) => {
    if (!user) return;

    const targetEmail = emails.find((e) => e.id === emailId);
    const isAlreadySoftDeleted = targetEmail?.deleted === true;

    let updated: Email[];
    if (isAlreadySoftDeleted) {
      // 1. Permanent Delete: Remove completely from local state
      updated = emails.filter((e) => e.id !== emailId);
    } else {
      // 2. Soft Delete: Flag as deleted
      updated = emails.map((e) => e.id === emailId ? { ...e, deleted: true } : e);
    }
    setEmails(updated);

    if (isDemoMode) {
      localStorage.setItem(`mm_emails_demo_user`, JSON.stringify(updated));
      if (isAlreadySoftDeleted) toast.success("Email permanently deleted (Demo Mode)");
      return;
    }

    if (!firebaseConfigured || user.uid.startsWith("uid_")) {
      localStorage.setItem(`mm_emails_${user.uid}`, JSON.stringify(updated));
      if (isAlreadySoftDeleted) toast.success("Email permanently deleted");
      return;
    }

    if (!db) return;
    const emailRef = doc(db, "users", user.uid, "emails", emailId);

    if (isAlreadySoftDeleted) {
      // Permanent Delete in Firestore
      await deleteDoc(emailRef);
      toast.success("Email permanently deleted from cloud");
    } else {
      // Soft Delete in Firestore
      await updateDoc(emailRef, { deleted: true });
    }
  };

  const deleteAllEmails = async () => {
    if (!user) return;

    const updated = emails.map((e) => ({ ...e, deleted: true }));
    setEmails(updated);

    if (isDemoMode) {
      localStorage.setItem(`mm_emails_demo_user`, JSON.stringify(updated));
      toast.success("All emails marked as deleted (Demo Mode)");
      return;
    }

    if (!firebaseConfigured || user.uid.startsWith("uid_")) {
      localStorage.setItem(`mm_emails_${user.uid}`, JSON.stringify(updated));
      toast.success("All emails marked as deleted");
      return;
    }

    if (!db) return;
    try {
      const batch = writeBatch(db);
      emails.forEach((email) => {
        if (!email.deleted) {
          const ref = doc(db!, "users", user.uid, "emails", email.id);
          batch.update(ref, { deleted: true });
        }
      });
      await batch.commit();
      toast.success("All emails successfully deleted");
    } catch (error) {
      console.error("Failed to delete all emails:", error);
      toast.error("Failed to delete all emails");
    }
  };

  const recoverAllDeletedEmails = async () => {
    if (!user) return;

    const updated = emails.map((e) => ({ ...e, deleted: false }));
    setEmails(updated);

    if (isDemoMode) {
      localStorage.setItem(`mm_emails_demo_user`, JSON.stringify(updated));
      toast.success("All deleted emails recovered (Demo Mode)");
      return;
    }

    if (!firebaseConfigured || user.uid.startsWith("uid_")) {
      localStorage.setItem(`mm_emails_${user.uid}`, JSON.stringify(updated));
      toast.success("All deleted emails recovered");
      return;
    }

    if (!db) return;
    try {
      const batch = writeBatch(db);
      emails.forEach((email) => {
        if (email.deleted) {
          const ref = doc(db!, "users", user.uid, "emails", email.id);
          batch.update(ref, { deleted: false });
        }
      });
      await batch.commit();
      toast.success("All deleted emails successfully recovered");
    } catch (error) {
      console.error("Failed to recover deleted emails:", error);
      toast.error("Failed to recover deleted emails");
    }
  };

  const connectGoogleCalendar = async (apiKey: string, calendarId: string) => {
    if (!user) return;
    
    if (!apiKey.trim() || !calendarId.trim()) {
      toast.error("Missing fields", {
        description: "Please enter both your Google Calendar API Key and Calendar ID.",
      });
      return;
    }

    await savePreferences({
      calendarConnected: true,
      calendarEmail: calendarId.trim(),
      googleCalendarApiKey: apiKey.trim(),
      googleCalendarId: calendarId.trim(),
    });
    toast.success("Google Calendar connected!", {
      description: `API key saved. Calendar ID: ${calendarId.trim()}`,
    });
  };

  const disconnectGoogleCalendar = async () => {
    if (!user) return;
    await savePreferences({
      calendarConnected: false,
      calendarEmail: "",
      googleCalendarApiKey: "",
      googleCalendarId: "",
    });
    toast.info("Google Calendar disconnected.");
  };

  const savePreferences = async (prefs: Partial<UserPreferences>) => {
    if (!user) return;

    const updatedPrefs = { ...preferences, ...prefs };
    setPreferences(updatedPrefs);

    if (isDemoMode) {
      localStorage.setItem(`mm_prefs_demo_user`, JSON.stringify(updatedPrefs));
      return;
    }

    if (!firebaseConfigured || user.uid.startsWith("uid_")) {
      localStorage.setItem(`mm_prefs_${user.uid}`, JSON.stringify(updatedPrefs));
      return;
    }

    if (!db) return;
    const settingsRef = doc(db, "users", user.uid, "settings", "preferences");
    await setDoc(settingsRef, updatedPrefs, { merge: true });
  };

  const resetEmailSync = async () => {
    if (!user) return;
    
    // Clear list of emails from local state
    setEmails([]);
    
    // Remove last UID and cached emails from local storage
    if (isDemoMode) {
      localStorage.removeItem("mm_lastuid_demo_user");
      localStorage.setItem("mm_emails_demo_user", JSON.stringify([]));
    } else {
      localStorage.removeItem(`mm_lastuid_${user.uid}`);
      localStorage.setItem(`mm_emails_${user.uid}`, JSON.stringify([]));
    }
    
    // Also clear from Firestore if cloud DB is active!
    if (!isDemoMode && firebaseConfigured && !user.uid.startsWith("uid_") && db) {
      try {
        const { getDocs } = await import("firebase/firestore");
        const emailsCollection = collection(db, "users", user.uid, "emails");
        const snapshot = await getDocs(emailsCollection);
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      } catch (err) {
        console.error("Failed to clear cloud emails:", err);
      }
    }
    
    toast.success("Sync database cleared! Click 'Sync Mail' on the dashboard to fetch and summarize your emails again.");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        emails,
        preferences,
        firebaseConfigured,
        isDemoMode,
        syncStatus,
        syncProgress,
        signIn,
        signUp,
        logOut,
        enterDemoMode,
        syncMail,
        lastFetchedUid,
        updateEmailCategory,
        updateEmailReadStatus,
        deleteEmail,
        deleteAllEmails,
        recoverAllDeletedEmails,
        connectGoogleCalendar,
        disconnectGoogleCalendar,
        savePreferences,
        resetEmailSync,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
