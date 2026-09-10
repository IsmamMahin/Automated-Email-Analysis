import dotenv from "dotenv";
dotenv.config();

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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

async function triageWithOllama({ from, subject, date, textSnippet }) {
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2:1b";
  const ollamaApiKey = process.env.OLLAMA_API_KEY;

  const systemPrompt = `You are an expert email triage assistant. Your job is to classify incoming emails and filter out promotional emails, spam, newsletters, sales pitches, and social notifications.

Rules for Classification:
1. "school" (isImportant: true):
   - Emails from universities, colleges, professors, or academic portals (e.g. NSU, CSE, courses, homework, exam schedules, course feedback, grades, academic announcements).
2. "work" (isImportant: true):
   - Direct personal or business emails related to your job, clients, boss, colleagues, meeting invites, project deliverables, or business contracts.
3. "subscription" (isImportant: true):
   - Emails warning that a subscription or trial is ending, renewal notices, payment due, membership expirations, or recurring billing changes.
4. "promotional_or_spam" (isImportant: false):
   - ANY automated social media notifications (e.g. LinkedIn invitations, "people you may know", connections, Skool invites, Twitter/X, Instagram, YouTube).
   - Marketing campaigns, product ads, discounts, sales, app reminders (e.g. Duolingo), generic company newsletters.

Return ONLY a valid JSON object matching this schema:
{
  "isImportant": boolean,
  "category": "work" | "school" | "subscription" | "promotional_or_spam",
  "urgency": "high" | "medium" | "low",
  "summary": "1-2 concise sentences explaining what this email is about and why it matters",
  "actionRequired": "Concise next step or 'None'"
}`;

  const userPrompt = `Email Details:
From: ${from}
Subject: ${subject}
Date: ${date}

Email Body:
${textSnippet || "(No body text found)"}`;

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
        { role: "user", content: userPrompt },
      ],
      format: "json",
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error (${res.status}): ${await res.text()}`);
  }

  const resData = await res.json();
  const rawContent = resData.message?.content?.trim() || "{}";
  const cleaned = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("Malformed JSON from Ollama:", rawContent);
    return {
      isImportant: false,
      category: "promotional_or_spam",
      urgency: "low",
      summary: "Could not parse email",
      actionRequired: "None",
    };
  }
}

async function sendTelegramAlert({ category, urgency, from, subject, date, summary, actionRequired }) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in .env, skipping Telegram send.");
    return false;
  }

  const categoryLabels = {
    work: { label: "Work", icon: "💼" },
    school: { label: "School", icon: "🎓" },
    subscription: { label: "Subscription Ending", icon: "💳" },
  };

  const catInfo = categoryLabels[category] || { label: category.toUpperCase(), icon: "📌" };
  const urgencyEmoji = { high: "🔴 High", medium: "🟡 Medium", low: "🟢 Low" };
  const urgencyText = urgencyEmoji[urgency] || urgency;

  const text = `<b>${catInfo.icon} Important Email Alert: ${catInfo.label}</b>

<b>Urgency:</b> ${escapeHtml(urgencyText)}
<b>From:</b> ${escapeHtml(from)}
<b>Subject:</b> ${escapeHtml(subject)}
<b>Date:</b> ${escapeHtml(date)}

<b>Summary:</b>
${escapeHtml(summary)}

<b>Action Required:</b>
${escapeHtml(actionRequired || "None")}`;

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

async function runInstantCheck(count = 10) {
  console.log(`\n======================================================`);
  console.log(`🚀 Starting Instant Check for the last ${count} emails...`);
  console.log(`======================================================\n`);

  console.log("1. Authenticating with Gmail API...");
  const token = await getGmailAccessToken();
  console.log("✓ Gmail access token obtained.\n");

  console.log(`2. Fetching list of last ${count} messages...`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${count}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!listRes.ok) {
    throw new Error(`Gmail API list error: ${await listRes.text()}`);
  }

  const listData = await listRes.json();
  const messages = listData.messages || [];
  console.log(`✓ Retrieved ${messages.length} messages.\n`);

  console.log(`3. Analyzing messages with Ollama (${process.env.OLLAMA_MODEL || "qwen2.5:0.5b"})...\n`);

  const results = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!detailRes.ok) {
      console.warn(`[${i + 1}/${messages.length}] Failed to fetch message ${msg.id}`);
      continue;
    }

    const detail = await detailRes.json();
    const headers = detail.payload?.headers || [];
    const getHeader = (name) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const subject = getHeader("subject") || "(No Subject)";
    const from = getHeader("from") || "Unknown Sender";
    const date = getHeader("date") || new Date().toISOString();
    const bodyText = extractBodyText(detail.payload) || detail.snippet || "";
    const textSnippet = bodyText.slice(0, 3000);

    process.stdout.write(`[${i + 1}/${messages.length}] Triage: "${subject.slice(0, 45)}"... `);

    const triage = await triageWithOllama({ from, subject, date, textSnippet });

    let sent = false;
    if (triage.isImportant && triage.category !== "promotional_or_spam") {
      process.stdout.write(`=> 🚨 IMPORTANT [${triage.category}] (Sending Telegram alert)... `);
      sent = await sendTelegramAlert({
        category: triage.category,
        urgency: triage.urgency,
        from,
        subject,
        date,
        summary: triage.summary,
        actionRequired: triage.actionRequired,
      });
      console.log(sent ? "✓ Sent!" : "✗ Failed to send");
    } else {
      console.log(`=> 💤 IGNORED [${triage.category}]`);
    }

    results.push({
      subject: subject.slice(0, 40),
      from: from.slice(0, 30),
      category: triage.category,
      important: triage.isImportant,
      telegramSent: sent,
    });
  }

  console.log("\n======================================================");
  console.log("📊 Instant Check Summary Table:");
  console.log("======================================================");
  console.table(results);
}

runInstantCheck(10).catch((err) => {
  console.error("\n❌ Error during instant check:", err);
  process.exit(1);
});
