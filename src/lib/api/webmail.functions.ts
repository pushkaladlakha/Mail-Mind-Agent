import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import tls from "tls";

export const verifyWebmailCredentials = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    email: z.string().email(),
    password: z.string().min(1),
    imapHost: z.string().default("mailstore.iitd.ac.in"),
    imapPort: z.number().default(993)
  }))
  .handler(async ({ data }) => {
    const { email, password, imapHost, imapPort } = data;
    
    // Extract Kerberos ID from email (e.g., abhas@cse.iitd.ac.in -> abhas)
    const username = email.split("@")[0];

    // Mock bypasses for error simulation accounts
    if (username === "error") {
      return { success: false, error: "Authentication failed" };
    }
    if (username === "offline") {
      return { success: false, error: "Connection to webmail timed out" };
    }

    // Admin Developer Bypass Account
    if (username === "admin" && password === "admin123") {
      return { success: true };
    }

    // Empty Test Account
    if (username === "newinbox" && password === "admin123") {
      return { success: true };
    }

    try {
      const success = await new Promise<boolean>((resolve, reject) => {
        const socket = tls.connect({
          host: imapHost,
          port: imapPort,
          rejectUnauthorized: false // Allow self-signed university certs typical of internal intranets
        });

        let authenticated = false;
        let buffer = "";
        let loginSent = false;
        let done = false;

        const finish = (result: boolean) => {
          if (done) return;
          done = true;
          authenticated = result;
          try {
            if (!socket.destroyed) {
              socket.write("a002 LOGOUT\r\n");
              socket.end();
            }
          } catch (_) {
            // Ignore write errors during cleanup
          }
        };

        socket.on("data", (chunk) => {
          if (done) return;
          buffer += chunk.toString();
          
          // IMAP servers greet with * OK on connection
          if (buffer.includes("* OK") && !loginSent) {
            loginSent = true;
            // Send LOGIN command: tag LOGIN "user" "password"
            socket.write(`a001 LOGIN "${username}" "${password}"\r\n`);
            buffer = ""; // clear buffer
          } else if (buffer.includes("a001 OK")) {
            finish(true);
          } else if (buffer.includes("a001 NO") || buffer.includes("a001 BAD")) {
            finish(false);
          }
        });

        socket.on("end", () => {
          resolve(authenticated);
        });

        socket.on("close", () => {
          resolve(authenticated);
        });

        socket.on("error", (err) => {
          if (!done) reject(err);
        });

        // Timeout connection after 5 seconds
        socket.setTimeout(5000);
        socket.on("timeout", () => {
          socket.destroy();
          if (!done) reject(new Error("Connection to college webmail server timed out."));
        });
      });

      return { success };
    } catch (error: any) {
      console.error("Webmail authentication check failed:", error);
      return { success: false, error: error.message || "Failed to connect to college webmail server." };
    }
  });

export const checkCalendarConnection = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      
      const tokenPath = path.join(process.cwd(), "mail-fetcher-backend", "token.json");
      
      if (fs.existsSync(tokenPath)) {
        const raw = fs.readFileSync(tokenPath, "utf-8");
        const data = JSON.parse(raw);
        // Look for the user's authenticated email account inside token.json (if stored)
        const email = data.account || "pushkaladlakha@gmail.com";
        return { connected: true, email };
      }
      return { connected: false };
    } catch (err) {
      console.error("Failed to check Google Calendar token.json:", err);
      return { connected: false };
    }
  });

export const fetchRealEmails = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    email: z.string().email(),
    password: z.string().min(1),
    imapHost: z.string().default("mailstore.iitd.ac.in"),
    imapPort: z.number().default(993),
    mode: z.enum(["since_last", "latest_count"]).default("latest_count"),
    lastUid: z.number().optional(),   // highest UID already fetched
    count: z.number().min(1).max(500).default(15),
    skipCount: z.number().min(0).default(0),
  }))
  .handler(async ({ data }) => {
    const { email, password, imapHost, imapPort, mode, lastUid, count, skipCount } = data;
    const username = email.split("@")[0];

    // Mock bypasses for error simulation accounts
    if (username === "error") {
      return { success: false, error: "Authentication failed" };
    }
    if (username === "offline") {
      return { success: false, error: "Connection to webmail timed out" };
    }

    // Empty Test Account
    if (username === "newinbox" && password === "admin123") {
      return {
        success: true,
        emails: [],
        highestUid: 0,
        totalInbox: 0,
      };
    }

    // Admin Developer Bypass Account
    if (username === "admin" && password === "admin123") {
      const adminEmails = [
        {
          id: "live-1001",
          uid: 1001,
          sender: "Office of Academic Affairs",
          senderEmail: "academics@iitd.ac.in",
          subject: "Course Registration Guidelines Autumn 2026",
          body: "Dear Students,\n\nPlease note that the course registration portal will open on June 1st. Make sure to clear all your dues before registering.\n\nBest regards,\nOffice of Academic Affairs.",
          receivedAt: new Date().toISOString()
        },
        {
          id: "live-1002",
          uid: 1002,
          sender: "CSC Helpdesk",
          senderEmail: "csc_help@iitd.ac.in",
          subject: "Scheduled Network Maintenance this Sunday",
          body: "Hello All,\n\nThere will be a scheduled network maintenance on Sunday between 2:00 AM and 6:00 AM. Intranet and internet services may be briefly interrupted.\n\nThanks,\nCSC Team.",
          receivedAt: new Date(Date.now() - 3600000).toISOString()
        }
      ];

      // Filter based on lastUid if in since_last mode
      const filtered = lastUid
        ? adminEmails.filter((e) => e.uid > lastUid)
        : adminEmails;

      return {
        success: true,
        emails: filtered,
        highestUid: adminEmails.length > 0 ? Math.max(...adminEmails.map((e) => e.uid)) : 0,
        totalInbox: 2,
      };
    }

    try {
      const { ImapFlow } = await import("imapflow");
      const { simpleParser } = await import("mailparser");

      const client = new ImapFlow({
        host: imapHost,
        port: imapPort,
        secure: true,
        auth: {
          user: username,
          pass: password
        },
        logger: false
      });

      // Wrap connection in a 12-second timeout to prevent hanging on unreachable servers
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Connection to college webmail server timed out.")), 12000)
        )
      ]);
      
      const lock = await client.getMailboxLock("INBOX");
      const emailsList: any[] = [];
      let highestUid = lastUid || 0;
      
      try {
        const totalInbox = client.mailbox.exists;
        
        if (totalInbox > 0) {
          if (mode === "since_last" && lastUid && lastUid > 0) {
            // MODE A: Fetch all emails with UID greater than lastUid
            const searchResults = await client.search({ uid: `${lastUid + 1}:*` });
            
            if (searchResults.length > 0) {
              const messages = client.fetch(searchResults, {
                source: true,
                envelope: true,
                uid: true,
              });
              
              for await (const msg of messages) {
                // Skip the lastUid itself (IMAP range is inclusive)
                if (msg.uid <= lastUid) continue;
                
                const parsed = await simpleParser(msg.source);
                if (msg.uid > highestUid) highestUid = msg.uid;
                
                emailsList.push({
                  id: `live-${msg.uid}`,
                  uid: msg.uid,
                  sender: parsed.from?.text || msg.envelope.from?.[0]?.name || "Unknown",
                  senderEmail: parsed.from?.value?.[0]?.address || msg.envelope.from?.[0]?.address || "unknown@iitd.ac.in",
                  subject: parsed.subject || "(No Subject)",
                  body: parsed.text || parsed.html || "(No content preview)",
                  receivedAt: parsed.date?.toISOString() || msg.envelope.date?.toISOString() || new Date().toISOString()
                });
              }
            }
          } else {
            // MODE B: Fetch latest N emails by sequence number (optionally skipping recent ones for historical bottom-sync)
            const remainingInbox = Math.max(0, totalInbox - (skipCount || 0));
            const fetchCount = Math.min(count, remainingInbox);
            
            if (fetchCount > 0) {
              const endSeq = remainingInbox;
              const startSeq = Math.max(1, remainingInbox - fetchCount + 1);
              
              const messages = client.fetch(`${startSeq}:${endSeq}`, {
                source: true,
                envelope: true,
                uid: true,
              });
              
              for await (const msg of messages) {
                const parsed = await simpleParser(msg.source);
                if (msg.uid > highestUid) highestUid = msg.uid;
                
                // Collision guard: if we have a lastUid, skip emails already fetched (only relevant if not offset-fetching)
                if (lastUid && msg.uid <= lastUid && !skipCount) continue;
                
                emailsList.push({
                  id: `live-${msg.uid}`,
                  uid: msg.uid,
                  sender: parsed.from?.text || msg.envelope.from?.[0]?.name || "Unknown",
                  senderEmail: parsed.from?.value?.[0]?.address || msg.envelope.from?.[0]?.address || "unknown@iitd.ac.in",
                  subject: parsed.subject || "(No Subject)",
                  body: parsed.text || parsed.html || "(No content preview)",
                  receivedAt: parsed.date?.toISOString() || msg.envelope.date?.toISOString() || new Date().toISOString()
                });
              }
            }
          }
        }
      } finally {
        lock.release();
      }
      
      await client.logout();
      
      // Sort descending (latest first)
      emailsList.sort((a: any, b: any) => b.uid - a.uid);
      
      return {
        success: true,
        emails: emailsList,
        highestUid,
        totalInbox: client.mailbox?.exists || 0,
      };
    } catch (err: any) {
      console.error("Failed to fetch real IMAP emails:", err);
      return { success: false, error: err.message || "Failed to fetch emails from webmail server." };
    }
  });
