import { schedules, task } from "@trigger.dev/sdk";
import { processEmail } from "./process-email.js";

interface CheckEmailOptions {
  lookbackMinutes?: number;
}

interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType: string;
  body?: {
    size: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

interface GmailMessageDetail {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: GmailMessageHeader[];
    body?: {
      size: number;
      data?: string;
    };
    parts?: GmailMessagePart[];
  };
}

async function getGmailAccessToken(): Promise<string> {
  // If OAuth client ID, secret, and refresh token are provided, automatically refresh the access token
  if (
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET
  ) {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(`Failed to refresh Gmail access token (${tokenRes.status}): ${errorText}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    return tokenData.access_token;
  }

  // Otherwise use GMAIL_API_KEY directly
  const apiKey = process.env.GMAIL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GMAIL_API_KEY is not set in environment variables (or provide GMAIL_REFRESH_TOKEN, GMAIL_CLIENT_ID, and GMAIL_CLIENT_SECRET)"
    );
  }
  return apiKey;
}

function decodeBase64Url(data: string): string {
  try {
    return Buffer.from(data, "base64url").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBodyText(payload?: GmailMessageDetail["payload"]): string {
  if (!payload) return "";

  // If plain text body exists at top level
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Search nested parts for text/plain
  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        for (const subPart of part.parts) {
          if (subPart.mimeType === "text/plain" && subPart.body?.data) {
            return decodeBase64Url(subPart.body.data);
          }
        }
      }
    }
    // Fallback to text/html if text/plain was not found
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
  }

  return "";
}

async function performEmailCheck(options: CheckEmailOptions = {}) {
  const token = await getGmailAccessToken();

  // Default lookback: 150 minutes (2.5 hours) to cover the 2-hour interval without missing boundary emails
  const lookbackMinutes = options.lookbackMinutes ?? 150;
  const sinceEpochSeconds = Math.floor((Date.now() - lookbackMinutes * 60 * 1000) / 1000);

  console.log(`Querying Gmail API for messages received since timestamp ${sinceEpochSeconds}...`);

  // Query Gmail messages: after:${sinceEpochSeconds}
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after%3A${sinceEpochSeconds}&maxResults=50`;
  const listResponse = await fetch(listUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    throw new Error(`Gmail API error (${listResponse.status}): ${errorText}`);
  }

  const listData = (await listResponse.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
    resultSizeEstimate?: number;
  };

  const messages = listData.messages || [];
  console.log(`Found ${messages.length} messages in the lookback window.`);

  const dispatchedTasks: string[] = [];

  for (const item of messages) {
    try {
      const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`;
      const detailResponse = await fetch(detailUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!detailResponse.ok) {
        console.error(`Failed to fetch details for message ${item.id} (${detailResponse.status})`);
        continue;
      }

      const detail = (await detailResponse.json()) as GmailMessageDetail;
      const headers = detail.payload?.headers || [];

      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

      const subject = getHeader("subject") || "(No Subject)";
      const from = getHeader("from") || "Unknown Sender";
      const date =
        getHeader("date") ||
        (detail.internalDate
          ? new Date(Number(detail.internalDate)).toISOString()
          : new Date().toISOString());

      const rawText = extractBodyText(detail.payload) || detail.snippet || "";
      const textSnippet = rawText.slice(0, 4000);

      console.log(`Dispatched triage for Gmail message: [${detail.id}] "${subject}" from "${from}"`);

      // Dispatch to processor task with idempotencyKey to prevent duplicate Telegram alerts
      await processEmail.trigger(
        {
          uid: Number(detail.id) || 0,
          messageId: detail.id,
          subject,
          from,
          date,
          textSnippet,
        },
        {
          idempotencyKey: `gmail-${detail.id}`,
        }
      );

      dispatchedTasks.push(detail.id);
    } catch (msgErr) {
      console.error(`Error processing Gmail message ${item.id}:`, msgErr);
    }
  }

  console.log(`Gmail check complete. Dispatched ${dispatchedTasks.length} emails for analysis.`);
  return {
    dispatchedCount: dispatchedTasks.length,
    dispatchedMessageIds: dispatchedTasks,
    sinceTimestamp: sinceEpochSeconds,
  };
}

/**
 * Scheduled task that runs every 2 hours.
 * Cron expression: 0 star/2 star star star (runs at minute 0 past every 2nd hour)
 */
export const checkEmailsScheduled = schedules.task({
  id: "check-emails-scheduled",
  cron: "0 */2 * * *",
  run: async () => {
    return await performEmailCheck({ lookbackMinutes: 150 });
  },
});

/**
 * Manual task allowing immediate test triggers from the Trigger.dev dashboard or CLI.
 */
export const checkEmailsManual = task({
  id: "check-emails-manual",
  run: async (payload?: { lookbackMinutes?: number }) => {
    return await performEmailCheck({ lookbackMinutes: payload?.lookbackMinutes ?? 150 });
  },
});
