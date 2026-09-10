import dotenv from "dotenv";
dotenv.config();

function decodeBase64Url(data) {
  try {
    return Buffer.from(data, "base64url").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBodyText(payload) {
  if (!payload) return "";
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        for (const sub of part.parts) {
          if (sub.mimeType === "text/plain" && sub.body?.data) {
            return decodeBase64Url(sub.body.data);
          }
        }
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
  }
  return "";
}

async function getGmailAccessToken() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN in .env");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Failed to refresh Gmail access token: ${await tokenRes.text()}`);
  }

  const data = await tokenRes.json();
  return data.access_token;
}

async function generateHeadlineBriefing(emails, lookbackHours) {
  if (emails.length === 0) {
    return `📭 <b>${lookbackHours}-Hour Email Briefing</b>\n\nNo new emails received in the last ${lookbackHours} hours. Your inbox is clean!`;
  }

  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const ollamaModel = process.env.OLLAMA_MODEL || "gemma4:31b-cloud";
  const ollamaApiKey = process.env.OLLAMA_API_KEY;

  const emailsText = emails
    .map(
      (e, idx) =>
        `${idx + 1}. From: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nSnippet: ${e.snippet}\n`
    )
    .join("\n---\n");

  const systemPrompt = `You are an executive email briefing assistant. Given a list of emails received in the last two hours, generate a punchy, headline-style summary for Telegram.

Guidelines:
1. Identify and highlight important emails:
   - School (university announcements, courses, homework, professors, feedback)
   - Work (clients, boss, job updates, project deadlines, contracts)
   - Subscriptions ending (billing renewals, expiring trials, card charges)
   Provide a crisp 1-line headline bullet for each important item with sender/subject and any required action.
2. Group all promotional, marketing, newsletters, and automated social notifications (e.g. LinkedIn invitations, Duolingo, promotional sales) into a single concise summary line noting they are low priority / safe to ignore.
3. Use clean HTML formatting: <b>bold</b>, <i>italic</i>, and bullet points (•). Do NOT use Markdown asterisks or backticks.

Example format:
📰 <b>2-Hour Email Briefing</b>
<i>4 emails received</i>

📌 <b>Key Headlines:</b>
• 🎓 <b>[School] CSE311L:</b> Feedback survey request from lab instructor (Action: Optional survey)
• 💼 <b>[Work] Project Alpha:</b> Meeting rescheduled to 4 PM today

💤 <b>Low Priority & Promotional:</b>
• 2 promotional/social emails (LinkedIn invitation, Duolingo reminder) - safe to ignore.

⚡ <b>Action Items:</b> Complete CSE311L feedback if interested.`;

  const headers = { "Content-Type": "application/json" };
  if (ollamaApiKey) {
    headers["Authorization"] = `Bearer ${ollamaApiKey}`;
  }

  const res = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: ollamaModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here are the ${emails.length} emails received in the last ${lookbackHours} hours:\n\n${emailsText}` },
      ],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  return data.message?.content?.trim();
}

async function sendTelegramMessage(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  return res.ok;
}

async function runInstantBriefing(hours = 2, maxResults = 20) {
  console.log(`\n======================================================`);
  console.log(`📰 Generating Headline Email Briefing (Last ${hours} Hours)...`);
  console.log(`======================================================\n`);

  console.log("1. Authenticating with Gmail API...");
  const token = await getGmailAccessToken();
  console.log("✓ Gmail access token obtained.\n");

  const sinceEpochSeconds = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
  console.log(`2. Fetching emails received in the last ${hours} hours...`);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after%3A${sinceEpochSeconds}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!listRes.ok) {
    throw new Error(`Gmail API error: ${await listRes.text()}`);
  }

  const listData = await listRes.json();
  const messages = listData.messages || [];
  console.log(`✓ Found ${messages.length} emails.\n`);

  const emails = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!detailRes.ok) continue;

    const detail = await detailRes.json();
    const headers = detail.payload?.headers || [];
    const getHeader = (name) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    emails.push({
      id: detail.id,
      from: getHeader("from") || "Unknown",
      subject: getHeader("subject") || "(No Subject)",
      date: getHeader("date") || new Date().toISOString(),
      snippet: (extractBodyText(detail.payload) || detail.snippet || "").slice(0, 1500),
    });
  }

  console.log(`3. Generating headline brief with Ollama (${process.env.OLLAMA_MODEL || "llama3.2:1b"})...\n`);
  const briefingHtml = await generateHeadlineBriefing(emails, hours);

  console.log("Generated Headline Briefing:\n------------------------------------------------------");
  console.log(briefingHtml);
  console.log("------------------------------------------------------\n");

  console.log("4. Sending briefing to Telegram...");
  const sent = await sendTelegramMessage(briefingHtml);
  if (sent) {
    console.log("✓ Headline briefing sent to Telegram successfully!");
  } else {
    console.error("✗ Failed to send message to Telegram");
  }
  return { success: sent, emailCount: emails.length, briefingHtml };
}

export { runInstantBriefing, sendTelegramMessage };

import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runInstantBriefing(2, 20).catch(console.error);
}
