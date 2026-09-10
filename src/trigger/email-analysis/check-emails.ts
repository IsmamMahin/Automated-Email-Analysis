import { schedules, task } from "@trigger.dev/sdk";
import { ImapFlow } from "imapflow";
import PostalMime from "postal-mime";
import { processEmail } from "./process-email.js";

interface CheckEmailOptions {
  lookbackMinutes?: number;
}

async function performEmailCheck(options: CheckEmailOptions = {}) {
  const imapHost = process.env.IMAP_HOST;
  if (!imapHost) throw new Error("IMAP_HOST is not set in environment variables");

  const imapUser = process.env.IMAP_USER;
  if (!imapUser) throw new Error("IMAP_USER is not set in environment variables");

  const imapPass = process.env.IMAP_PASS;
  if (!imapPass) throw new Error("IMAP_PASS is not set in environment variables");

  const imapPort = Number(process.env.IMAP_PORT || "993");
  const imapSecure = process.env.IMAP_SECURE !== "false";

  // Default lookback: 150 minutes (2.5 hours) to cover the 2-hour interval without missing boundary emails
  const lookbackMinutes = options.lookbackMinutes ?? 150;
  const sinceDate = new Date(Date.now() - lookbackMinutes * 60 * 1000);

  console.log(`Connecting to IMAP server ${imapHost}:${imapPort} as ${imapUser}...`);
  console.log(`Searching for emails received since: ${sinceDate.toISOString()}`);

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: imapSecure,
    auth: {
      user: imapUser,
      pass: imapPass,
    },
    logger: false,
  });

  await client.connect();

  const dispatchedTasks: string[] = [];

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Search for messages since lookback date
      const messageGenerator = client.fetch(
        { since: sinceDate },
        { source: true, envelope: true, uid: true }
      );

      for await (const message of messageGenerator) {
        if (!message.source) continue;

        try {
          // Parse raw message stream using postal-mime
          const parsed = await PostalMime.parse(message.source);
          const rawText = (parsed.text || parsed.html || "").trim();
          // Extract plain text snippet up to 4000 characters
          const textSnippet = rawText.slice(0, 4000);

          const fromDisplay =
            parsed.from?.address
              ? parsed.from.name
                ? `${parsed.from.name} <${parsed.from.address}>`
                : parsed.from.address
              : "Unknown Sender";

          const messageId = parsed.messageId || `${message.uid}-${message.seq}`;
          const subject = parsed.subject || "(No Subject)";
          const date = parsed.date || new Date().toISOString();

          console.log(`Dispatched triage for email: [${messageId}] "${subject}" from "${fromDisplay}"`);

          // Dispatch to processor task with idempotencyKey to prevent duplicate Telegram alerts
          await processEmail.trigger(
            {
              uid: message.uid,
              messageId,
              subject,
              from: fromDisplay,
              date,
              textSnippet,
            },
            {
              idempotencyKey: `email-${messageId}`,
            }
          );

          dispatchedTasks.push(messageId);
        } catch (parseError) {
          console.error(`Error parsing message UID ${message.uid}:`, parseError);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  console.log(`Check complete. Dispatched ${dispatchedTasks.length} emails for analysis.`);
  return {
    dispatchedCount: dispatchedTasks.length,
    dispatchedMessageIds: dispatchedTasks,
    since: sinceDate.toISOString(),
  };
}

/**
 * Scheduled task that runs every 2 hours.
 * Cron expression: "0 * / 2 * * *" (runs at minute 0 past every 2nd hour)
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
