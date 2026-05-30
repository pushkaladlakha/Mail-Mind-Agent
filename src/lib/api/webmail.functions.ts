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
    imapPort: z.number().default(993)
  }))
  .handler(async ({ data }) => {
    const { email, password, imapHost, imapPort } = data;
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
      return {
        success: true,
        emails: [
          {
            id: "admin-1",
            sender: "Office of Academic Affairs",
            senderEmail: "academics@iitd.ac.in",
            subject: "Course Registration Guidelines Autumn 2026",
            body: "Dear Students,\n\nPlease note that the course registration portal will open on June 1st. Make sure to clear all your dues before registering.\n\nBest regards,\nOffice of Academic Affairs.",
            receivedAt: new Date().toISOString()
          },
          {
            id: "admin-2",
            sender: "CSC Helpdesk",
            senderEmail: "csc_help@iitd.ac.in",
            subject: "Scheduled Network Maintenance this Sunday",
            body: "Hello All,\n\nThere will be a scheduled network maintenance on Sunday between 2:00 AM and 6:00 AM. Intranet and internet services may be briefly interrupted.\n\nThanks,\nCSC Team.",
            receivedAt: new Date(Date.now() - 3600000).toISOString()
          }
        ]
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

      await client.connect();
      
      const lock = await client.getMailboxLock("INBOX");
      const emailsList: any[] = [];
      
      try {
        const exists = client.mailbox.exists;
        
        if (exists > 0) {
          // Fetch the latest 15 emails from their inbox
          const startSeq = Math.max(1, exists - 14);
          const endSeq = exists;
          
          const messages = client.fetch(`${startSeq}:${endSeq}`, {
            source: true,
            envelope: true
          });
          
          for await (const msg of messages) {
            const parsed = await simpleParser(msg.source);
            
            emailsList.push({
              id: `live-${msg.uid}`,
              sender: parsed.from?.text || msg.envelope.from?.[0]?.name || "Unknown",
              senderEmail: parsed.from?.value?.[0]?.address || msg.envelope.from?.[0]?.address || "unknown@iitd.ac.in",
              subject: parsed.subject || "(No Subject)",
              body: parsed.text || parsed.html || "(No content preview)",
              receivedAt: parsed.date?.toISOString() || msg.envelope.date?.toISOString() || new Date().toISOString()
            });
          }
        }
      } finally {
        lock.release();
      }
      
      await client.logout();
      
      // Sort descending (latest first)
      emailsList.reverse();
      
      return { success: true, emails: emailsList };
    } catch (err: any) {
      console.error("Failed to fetch real IMAP emails:", err);
      return { success: false, error: err.message || "Failed to fetch emails from webmail server." };
    }
  });
