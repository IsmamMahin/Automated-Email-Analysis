import { task } from "@trigger.dev/sdk";

export interface EmailPayload {
  uid: number;
  messageId: string;
  subject: string;
  from: string;
  date: string;
  textSnippet: string;
}

interface OllamaTriageResponse {
  isImportant: boolean;
  category: "work" | "school" | "subscription" | "promotional_or_spam";
  urgency: "high" | "medium" | "low";
  summary: string;
  actionRequired: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const processEmail = task({
  id: "process-email",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 15000,
  },
  run: async (payload: EmailPayload) => {
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!telegramBotToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set in environment variables");
    }

    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    if (!telegramChatId) {
      throw new Error("TELEGRAM_CHAT_ID is not set in environment variables");
    }

    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    const ollamaApiKey = process.env.OLLAMA_API_KEY;
    const ollamaModel = process.env.OLLAMA_MODEL || "deepseek-v4-flash:cloud";

    console.log(`Analyzing email "${payload.subject}" from "${payload.from}" using model ${ollamaModel}...`);

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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (ollamaApiKey) {
      headers["Authorization"] = `Bearer ${ollamaApiKey}`;
    }

    const userPrompt = `Email Details:
From: ${payload.from}
Subject: ${payload.subject}
Date: ${payload.date}

Email Body:
${payload.textSnippet || "(No body text found)"}`;

    const ollamaResponse = await fetch(`${ollamaBaseUrl}/api/chat`, {
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

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      throw new Error(`Ollama API error (${ollamaResponse.status}): ${errorText}`);
    }

    const ollamaData = (await ollamaResponse.json()) as {
      message?: { content?: string };
    };

    const rawContent = ollamaData.message?.content?.trim() || "{}";
    // Strip markdown code fences if the model wraps JSON in ```json ... ```
    const cleanedJson = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let triageResult: OllamaTriageResponse;
    try {
      triageResult = JSON.parse(cleanedJson);
    } catch {
      throw new Error(`Failed to parse JSON response from Ollama: ${rawContent}`);
    }

    console.log(`Triage result: category=${triageResult.category}, isImportant=${triageResult.isImportant}, urgency=${triageResult.urgency}`);

    // If classified as promotional or not important, ignore and exit cleanly
    if (!triageResult.isImportant || triageResult.category === "promotional_or_spam") {
      console.log(`Ignoring promotional/unimportant email: "${payload.subject}"`);
      return {
        messageId: payload.messageId,
        isImportant: false,
        category: triageResult.category,
        notifiedTelegram: false,
      };
    }

    // Map category to a friendly emoji and header
    const categoryLabels: Record<string, { label: string; icon: string }> = {
      work: { label: "Work", icon: "💼" },
      school: { label: "School", icon: "🎓" },
      subscription: { label: "Subscription Ending", icon: "💳" },
    };

    const catInfo = categoryLabels[triageResult.category] || {
      label: triageResult.category.toUpperCase(),
      icon: "📌",
    };

    const urgencyEmoji: Record<string, string> = {
      high: "🔴 High",
      medium: "🟡 Medium",
      low: "🟢 Low",
    };

    const urgencyText = urgencyEmoji[triageResult.urgency] || triageResult.urgency;

    const telegramMessage = `<b>${catInfo.icon} Important Email Alert: ${catInfo.label}</b>

<b>Urgency:</b> ${escapeHtml(urgencyText)}
<b>From:</b> ${escapeHtml(payload.from)}
<b>Subject:</b> ${escapeHtml(payload.subject)}
<b>Date:</b> ${escapeHtml(payload.date)}

<b>Summary:</b>
${escapeHtml(triageResult.summary)}

<b>Action Required:</b>
${escapeHtml(triageResult.actionRequired || "None")}`;

    const tgResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: telegramMessage,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!tgResponse.ok) {
      const tgError = await tgResponse.text();
      throw new Error(`Telegram API error (${tgResponse.status}): ${tgError}`);
    }

    console.log(`Successfully sent Telegram notification for email "${payload.subject}"`);

    return {
      messageId: payload.messageId,
      isImportant: true,
      category: triageResult.category,
      urgency: triageResult.urgency,
      notifiedTelegram: true,
    };
  },
});
