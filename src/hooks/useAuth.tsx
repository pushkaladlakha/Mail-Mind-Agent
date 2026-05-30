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

export interface UserPreferences {
  summaryLength: number; // 1: Short, 2: Medium, 3: Detailed
  notifyImportant: boolean;
  notifyDigest: boolean;
  autoSyncCalendar: boolean;
  calendarConnected?: boolean;
  calendarEmail?: string;
}

export type SyncStatusType = "idle" | "connecting" | "fetching" | "classifying" | "summarizing" | "complete" | "error";

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
  syncMail: () => Promise<void>;
  updateEmailCategory: (emailId: string, category: EmailCategory) => Promise<void>;
  updateEmailReadStatus: (emailId: string, unread: boolean) => Promise<void>;
  deleteEmail: (emailId: string) => Promise<void>;
  connectGoogleCalendar: () => Promise<void>;
  disconnectGoogleCalendar: () => Promise<void>;
  savePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_PREFS: UserPreferences = {
  summaryLength: 2,
  notifyImportant: true,
  notifyDigest: false,
  autoSyncCalendar: true,
  calendarConnected: false,
  calendarEmail: "",
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

      // Check standard offline fallback
      if (!firebaseConfigured) {
        const storedUser = sessionStorage.getItem("mm_user");
        const storedUid = sessionStorage.getItem("mm_uid");
        if (storedUser && storedUid) {
          setUser({ email: storedUser, uid: storedUid });
          const localEmails = localStorage.getItem(`mm_emails_${storedUid}`);
          if (localEmails) {
            setEmails(JSON.parse(localEmails));
          } else {
            localStorage.setItem(`mm_emails_${storedUid}`, JSON.stringify(defaultEmails));
            setEmails(defaultEmails);
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
    if (!firebaseConfigured || !user || !db) return;

    setLoading(true);
    const emailsRef = collection(db, "users", user.uid, "emails");
    const settingsRef = doc(db, "users", user.uid, "settings", "preferences");

    // Listen to real-time emails collection
    const unsubscribeEmails = onSnapshot(
      emailsRef,
      async (snapshot) => {
        if (snapshot.empty) {
          // New account: seed default emails database into Firestore
          try {
            const batch = writeBatch(db!);
            defaultEmails.forEach((email) => {
              const emailDoc = doc(db!, "users", user.uid, "emails", email.id);
              batch.set(emailDoc, email);
            });
            await batch.commit();
          } catch (err) {
            console.error("Failed to seed default emails to Firestore:", err);
          }
        } else {
          const list: Email[] = [];
          snapshot.forEach((doc) => {
            list.push(doc.data() as Email);
          });
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
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setPreferences(docSnap.data() as UserPreferences);
      } else {
        // Seed default preferences in Firestore
        setDoc(settingsRef, DEFAULT_PREFS).catch((err) =>
          console.error("Failed to seed default settings:", err)
        );
      }
    });

    return () => {
      unsubscribeEmails();
      unsubscribeSettings();
    };
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

  const signIn = async (email: string, password: string) => {
    // Exit demo mode cleanly if signing in
    sessionStorage.removeItem("mm_is_demo");
    setIsDemoMode(false);

    if (!firebaseConfigured) {
      const dummyUid = `uid_${email.replace(/[^a-zA-Z0-9]/g, "")}`;
      sessionStorage.setItem("mm_session", `sess_${crypto.randomUUID()}`);
      sessionStorage.setItem("mm_user", email);
      sessionStorage.setItem("mm_uid", dummyUid);
      setUser({ email, uid: dummyUid });
      
      const localEmails = localStorage.getItem(`mm_emails_${dummyUid}`);
      if (localEmails) {
        setEmails(JSON.parse(localEmails));
      } else {
        localStorage.setItem(`mm_emails_${dummyUid}`, JSON.stringify(defaultEmails));
        setEmails(defaultEmails);
      }
      
      const localPrefs = localStorage.getItem(`mm_prefs_${dummyUid}`);
      if (localPrefs) {
        setPreferences(JSON.parse(localPrefs));
      } else {
        localStorage.setItem(`mm_prefs_${dummyUid}`, JSON.stringify(DEFAULT_PREFS));
        setPreferences(DEFAULT_PREFS);
      }
      return;
    }

    if (!auth) throw new Error("Firebase Auth is uninitialized");
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    sessionStorage.removeItem("mm_is_demo");
    setIsDemoMode(false);

    if (!firebaseConfigured) {
      return signIn(email, password);
    }
    if (!auth) throw new Error("Firebase Auth is uninitialized");
    await createUserWithEmailAndPassword(auth, email, password);
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
  const syncMail = async () => {
    if (!user) return;
    if (syncStatus !== "idle") return;

    setSyncStatus("connecting");
    setSyncProgress({ total: 0, processed: 0 });

    try {
      // 1. Retrieve the last synced checkpoint
      let lastCheckpoint = 0;
      if (isDemoMode) {
        const stored = sessionStorage.getItem("mm_checkpoint_demo_user");
        lastCheckpoint = stored ? parseInt(stored, 10) : 0;
      } else if (!firebaseConfigured) {
        const stored = localStorage.getItem(`mm_checkpoint_${user.uid}`);
        lastCheckpoint = stored ? parseInt(stored, 10) : 0;
      } else {
        if (db) {
          try {
            const checkpointRef = doc(db, "users", user.uid, "settings", "checkpoint");
            const snap = await getDoc(checkpointRef);
            if (snap.exists()) {
              lastCheckpoint = snap.data().timestamp || 0;
            }
          } catch (err) {
            console.error("Failed to load Firebase checkpoint, defaulting to 0", err);
          }
        }
      }

      // 2. Fetch new emails since the checkpoint
      setSyncStatus("fetching");
      const newRawEmails = await fetchMailbox(user.uid, lastCheckpoint);

      if (newRawEmails.length === 0) {
        setSyncStatus("complete");
        toast.info("Sync complete. No new emails found.");
        setTimeout(() => setSyncStatus("idle"), 2000);
        return;
      }

      setSyncProgress({ total: newRawEmails.length, processed: 0 });

      // 3. Classify and summarize each fetched email
      const processedEmails: Email[] = [];
      let importantCount = 0;
      let lowPriorityCount = 0;
      let datesCount = 0;

      for (let i = 0; i < newRawEmails.length; i++) {
        const item = newRawEmails[i];
        
        setSyncStatus("classifying");
        const category = classifyEmail(item.subject, item.body);
        if (category === "important") importantCount++;
        else lowPriorityCount++;

        setSyncStatus("summarizing");
        await new Promise((r) => setTimeout(r, 250)); // smooth pipeline visual delay
        
        const cleanedBody = cleanEmailBody(item.body);
        const aiTriage = summarizeWithGemini(item.subject, item.sender, cleanedBody, category);
        datesCount += aiTriage.extractedDates.length;

        const completeEmail: Email = {
          id: item.id,
          sender: item.sender,
          senderEmail: item.senderEmail,
          subject: item.subject,
          bodySnippet: item.body, // Raw body preserved
          receivedAt: item.receivedAt,
          category,
          kind: aiTriage.kind,
          summary: aiTriage.summary,
          extractedDates: aiTriage.extractedDates,
          tags: aiTriage.tags,
          unread: true, // mark newly fetched emails unread
          priorityScore: aiTriage.priorityScore,
        };

        processedEmails.push(completeEmail);
        setSyncProgress((prev) => ({ ...prev, processed: i + 1 }));
      }

      // 4. Prepend and sort merged list
      const mergedList = [...processedEmails, ...emails];
      mergedList.sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
      setEmails(mergedList);

      const newCheckpointTime = +new Date();

      if (isDemoMode) {
        localStorage.setItem("mm_emails_demo_user", JSON.stringify(mergedList));
        sessionStorage.setItem("mm_checkpoint_demo_user", String(newCheckpointTime));
      } else if (!firebaseConfigured) {
        localStorage.setItem(`mm_emails_${user.uid}`, JSON.stringify(mergedList));
        localStorage.setItem(`mm_checkpoint_${user.uid}`, String(newCheckpointTime));
      } else {
        if (db) {
          const batch = writeBatch(db);
          processedEmails.forEach((email) => {
            const emailDoc = doc(db!, "users", user.uid, "emails", email.id);
            batch.set(emailDoc, email);
          });
          const checkpointDoc = doc(db!, "users", user.uid, "settings", "checkpoint");
          batch.set(checkpointDoc, { timestamp: newCheckpointTime });
          await batch.commit();
        }
      }

      setSyncStatus("complete");
      toast.success("Sync complete", {
        description: `${newRawEmails.length} new email${newRawEmails.length === 1 ? "" : "s"} triaged successfully (${importantCount} important, ${lowPriorityCount} low-priority, ${datesCount} dates extracted).`,
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

    if (!firebaseConfigured) {
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

    if (!firebaseConfigured) {
      localStorage.setItem(`mm_emails_${user.uid}`, JSON.stringify(updated));
      return;
    }

    if (!db) return;
    const emailRef = doc(db, "users", user.uid, "emails", emailId);
    await updateDoc(emailRef, { unread });
  };

  const deleteEmail = async (emailId: string) => {
    if (!user) return;

    const updated = emails.filter((e) => e.id !== emailId);
    setEmails(updated);

    if (isDemoMode) {
      localStorage.setItem(`mm_emails_demo_user`, JSON.stringify(updated));
      return;
    }

    if (!firebaseConfigured) {
      localStorage.setItem(`mm_emails_${user.uid}`, JSON.stringify(updated));
      return;
    }

    if (!db) return;
    const emailRef = doc(db, "users", user.uid, "emails", emailId);
    await deleteDoc(emailRef);
  };

  const connectGoogleCalendar = async () => {
    if (!user) return;
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: "Redirecting to Google secure authentication...",
        success: () => {
          savePreferences({
            calendarConnected: true,
            calendarEmail: `${user.email?.split("@")[0] || "student"}@gmail.com`
          });
          return "Google Calendar successfully connected!";
        },
        error: "Google Calendar authentication failed.",
      }
    );
  };

  const disconnectGoogleCalendar = async () => {
    if (!user) return;
    await savePreferences({
      calendarConnected: false,
      calendarEmail: ""
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

    if (!firebaseConfigured) {
      localStorage.setItem(`mm_prefs_${user.uid}`, JSON.stringify(updatedPrefs));
      return;
    }

    if (!db) return;
    const settingsRef = doc(db, "users", user.uid, "settings", "preferences");
    await setDoc(settingsRef, updatedPrefs, { merge: true });
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
        updateEmailCategory,
        updateEmailReadStatus,
        deleteEmail,
        connectGoogleCalendar,
        disconnectGoogleCalendar,
        savePreferences,
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
