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

        socket.on("data", (chunk) => {
          buffer += chunk.toString();
          
          // IMAP servers greet with * OK on connection
          if (buffer.includes("* OK") && !loginSent) {
            loginSent = true;
            // Send LOGIN command: tag LOGIN "user" "password"
            socket.write(`a001 LOGIN "${username}" "${password}"\r\n`);
            buffer = ""; // clear buffer
          } else if (buffer.includes("a001 OK")) {
            authenticated = true;
            socket.write("a002 LOGOUT\r\n");
            socket.end();
          } else if (buffer.includes("a001 NO") || buffer.includes("a001 BAD")) {
            authenticated = false;
            socket.write("a002 LOGOUT\r\n");
            socket.end();
          }
        });

        socket.on("end", () => {
          resolve(authenticated);
        });

        socket.on("error", (err) => {
          reject(err);
        });

        // Timeout connection after 5 seconds
        socket.setTimeout(5000);
        socket.on("timeout", () => {
          socket.destroy();
          reject(new Error("Connection to college webmail server timed out."));
        });
      });

      return { success };
    } catch (error: any) {
      console.error("Webmail authentication check failed:", error);
      return { success: false, error: error.message || "Failed to connect to college webmail server." };
    }
  });
