import http from "node:http";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Error: Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env first!");
  process.exit(1);
}

const REDIRECT_URI = "http://localhost:3000/oauth2callback";
const SCOPES = "https://www.googleapis.com/auth/gmail.readonly";

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
  clientId
)}&redirect_uri=${encodeURIComponent(
  REDIRECT_URI
)}&response_type=code&scope=${encodeURIComponent(
  SCOPES
)}&access_type=offline&prompt=consent`;

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, "http://localhost:3000");

  if (reqUrl.pathname === "/oauth2callback") {
    const code = reqUrl.searchParams.get("code");
    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Authorization failed or no code returned.");
      return;
    }

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.refresh_token) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`<h3>Error exchanging code:</h3><pre>${JSON.stringify(tokenData, null, 2)}</pre>`);
        return;
      }

      // Update .env file automatically
      const envPath = path.resolve(process.cwd(), ".env");
      let envContent = fs.readFileSync(envPath, "utf-8");

      if (envContent.includes("GMAIL_REFRESH_TOKEN=")) {
        envContent = envContent.replace(
          /GMAIL_REFRESH_TOKEN=.*/,
          `GMAIL_REFRESH_TOKEN=${tokenData.refresh_token}`
        );
      } else {
        envContent += `\nGMAIL_REFRESH_TOKEN=${tokenData.refresh_token}`;
      }

      fs.writeFileSync(envPath, envContent, "utf-8");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <h2 style="color: green;">Gmail Authorization Successful!</h2>
        <p>Your <b>GMAIL_REFRESH_TOKEN</b> has been saved to your <code>.env</code> file automatically.</p>
        <p>You can close this tab and return to your terminal.</p>
      `);

      console.log("\n[SUCCESS] Refresh token captured and saved to .env!");
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1500);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Exception: ${err.message}`);
    }
  }
});

server.listen(3000, () => {
  console.log("\n=== Gmail OAuth Authorization ===");
  console.log("1. Ensure 'http://localhost:3000/oauth2callback' is in your Google Cloud Authorized Redirect URIs.");
  console.log("2. Opening browser to authorize...");
  console.log(`\nIf it doesn't open automatically, visit:\n${authUrl}\n`);

  const startCmd = process.platform === "win32" ? "start" : "open";
  exec(`${startCmd} "${authUrl}"`);
});
