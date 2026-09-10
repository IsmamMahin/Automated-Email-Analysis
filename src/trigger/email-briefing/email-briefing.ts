import { schedules, task } from "@trigger.dev/sdk";

interface BriefingOptions {
  lookbackMinutes?: number;
  limit?: number;
}

interface EmailItem {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

function escapeHtml(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeBase64Url(data: string): string {
  try {
    return Buffer.from(data, "base64url").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBodyText(payload: any): string {
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

async function getGmailAccessToken(): Promise<string> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Failed to refresh Gmail access token (${tokenRes.status}): ${err}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    return tokenData.access_token;
  }

  const apiKey = process.env.GMAIL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing Gmail credentials in environment variables (GMAIL_REFRESH_TOKEN or GMAIL_API_KEY)");
  }
  return apiKey;
}

async function fetchRecentEmails(lookbackMinutes: number, limit: number): Promise<EmailItem[]> {
  const token = await getGmailAccessToken();
  const sinceEpochSeconds = Math.floor((Date.now() - lookbackMinutes * 60 * 1000) / 1000);

  console.log(`Fetching emails received in the last ${lookbackMinutes} minutes (since timestamp ${sinceEpochSeconds})...`);

  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after%3A${sinceEpochSeconds}&maxResults=${limit}`;
  const listResponse = await fetch(listUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!listResponse.ok) {
    throw new Error(`Gmail API list error (${listResponse.status}): ${await listResponse.text()}`);
  }

  const listData = (await listResponse.json()) as {
    messages?: Array<{ id: string }>;
  };

  const messages = listData.messages || [];
  console.log(`Found ${messages.length} emails in the last ${lookbackMinutes} minutes.`);

  const emailItems: EmailItem[] = [];

  for (const item of messages) {
    try {
      const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`;
      const detailRes = await fetch(detailUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!detailRes.ok) continue;

      const detail = (await detailRes.json()) as any;
      const headers = detail.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

      const subject = getHeader("subject") || "(No Subject)";
      const from = getHeader("from") || "Unknown Sender";
      const date =
        getHeader("date") ||
        (detail.internalDate ? new Date(Number(detail.internalDate)).toISOString() : new Date().toISOString());

      const rawText = extractBodyText(detail.payload) || detail.snippet || "";
      const snippet = rawText.slice(0, 1500);

      emailItems.push({
        id: detail.id,
        from,
        subject,
        date,
        snippet,
      });
    } catch (err) {
      console.error(`Error fetching message ${item.id}:`, err);
    }
  }

  return emailItems;
}

async function generateHeadlineBriefing(emails: EmailItem[], lookbackMinutes: number): Promise<string> {
  if (emails.length === 0) {
    const hours = Math.round(lookbackMinutes / 60);
    return `📭 <b>${hours}-Hour Email Briefing</b>\n\nNo new emails received in the last ${hours} hours. Your inbox is clean!`;
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

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ollamaApiKey) {
      headers["Authorization"] = `Bearer ${ollamaApiKey}`;
    }

    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here are the ${emails.length} emails received:\n\n${emailsText}` },
        ],
        stream: false,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as any;
      const content = data.message?.content?.trim();
      if (content) {
        return content;
      }
    }
  } catch (err) {
    console.error("Ollama briefing generation failed, using structured fallback:", err);
  }

  // Fallback if LLM is unavailable: Clean structured headline list
  const hours = Math.round(lookbackMinutes / 60);
  let fallbackMsg = `📰 <b>${hours}-Hour Email Briefing</b>\n<i>${emails.length} emails received</i>\n\n`;
  for (const e of emails) {
    fallbackMsg += `• <b>${escapeHtml(e.subject)}</b>\n  <i>From: ${escapeHtml(e.from)}</i>\n\n`;
  }
  return fallbackMsg.trim();
}

async function sendTelegramBriefing(messageHtml: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not set in environment variables");

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID is not set in environment variables");

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: messageHtml,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram API error (${res.status}): ${errText}`);
  }

  console.log("✓ Successfully sent headline briefing to Telegram!");
}

async function runEmailBriefing(options: BriefingOptions = {}) {
  const lookbackMinutes = options.lookbackMinutes ?? 135; // default 2 hours + 15 min buffer
  const limit = options.limit ?? 25;

  console.log(`Starting email briefing workflow (lookback: ${lookbackMinutes}m, limit: ${limit})...`);

  const emails = await fetchRecentEmails(lookbackMinutes, limit);
  const briefingHtml = await generateHeadlineBriefing(emails, lookbackMinutes);

  await sendTelegramBriefing(briefingHtml);

  return {
    success: true,
    emailCount: emails.length,
    lookbackMinutes,
    briefingSummary: briefingHtml,
  };
}

/**
 * Task 1: Scheduled task that runs every 2 hours.
 * Cron expression: "0 star/2 star star star" (runs every 2nd hour)
 */
export const emailBriefingScheduled = schedules.task({
  id: "email-briefing-scheduled",
  cron: "0 */2 * * *",
  run: async () => {
    return await runEmailBriefing({ lookbackMinutes: 135, limit: 30 });
  },
});

/**
 * Task 2: Manual trigger task to generate an instant headline briefing on demand.
 */
export const emailBriefingManual = task({
  id: "email-briefing-manual",
  run: async (payload?: { lookbackMinutes?: number; limit?: number }) => {
    return await runEmailBriefing({
      lookbackMinutes: payload?.lookbackMinutes ?? 135,
      limit: payload?.limit ?? 30,
    });
  },
});
