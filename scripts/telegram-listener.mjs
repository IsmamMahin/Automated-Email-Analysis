import dotenv from "dotenv";
import { tasks, runs } from "@trigger.dev/sdk";
import { runInstantBriefing } from "./instant-check.mjs";

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const authorizedChatId = process.env.TELEGRAM_CHAT_ID;

if (!botToken || !authorizedChatId) {
  console.error("Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env!");
  process.exit(1);
}

const SCHEDULE_HOURS = 2;
const SCHEDULE_INTERVAL_MS = SCHEDULE_HOURS * 60 * 60 * 1000;
const DASHBOARD_PROJECT_URL = "https://cloud.trigger.dev/orgs/oriontech-3d4b/projects/email-sorting-agent-NfCy";

let offset = 0;
let isProcessing = false;
let lastRunTime = null;
let nextRunTime = new Date(Date.now() + SCHEDULE_INTERVAL_MS);

console.log("\n======================================================");
console.log("🤖 Telegram Bot & Trigger.dev Integrator Started");
console.log(`🔒 Listening exclusively for messages from chat ID: ${authorizedChatId}`);
console.log(`⚡ Connected to Trigger.dev project: proj_odgatqgpgafmaqaeswhs`);
console.log(`⏱️ Automatic schedule active: runs every ${SCHEDULE_HOURS} hours`);
console.log(`📅 Next scheduled run at: ${nextRunTime.toLocaleTimeString()}`);
console.log("💬 Send 'trigger' or '/trigger' in Telegram to run via Trigger.dev");
console.log("======================================================\n");

async function sendQuickReply(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error("Failed to send quick reply:", err.message);
  }
}

async function executeBriefing(source = "Telegram Command") {
  if (isProcessing) {
    console.log(`[Scheduler] Skipping briefing (${source}) - another run is already in progress.`);
    return false;
  }

  isProcessing = true;
  lastRunTime = new Date();
  nextRunTime = new Date(Date.now() + SCHEDULE_INTERVAL_MS);

  console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Dispatching briefing (${source})...`);

  // Check if TRIGGER_SECRET_KEY is configured to route through Trigger.dev
  if (process.env.TRIGGER_SECRET_KEY) {
    try {
      console.log("⚡ Dispatching task to Trigger.dev (email-briefing-manual)...");
      const handle = await tasks.trigger("email-briefing-manual", {
        lookbackMinutes: 135,
        limit: 30,
      });

      const runUrl = `${DASHBOARD_PROJECT_URL}/runs/${handle.id}`;
      console.log(`✓ Trigger.dev task dispatched! Run ID: ${handle.id}`);
      console.log(`🔗 Run URL: ${runUrl}`);

      await sendQuickReply(
        authorizedChatId,
        `⚡ <b>Trigger.dev Task Dispatched!</b>\n\n` +
          `🆔 <b>Run ID:</b> <code>${handle.id}</code>\n` +
          `📊 <b>Status:</b> Scheduled & Executing on Worker\n` +
          `🔗 <a href="${runUrl}">View Live Run on Trigger.dev</a>\n\n` +
          `⏳ <i>Your worker is now analyzing emails with Ollama and will deliver the briefing here shortly.</i>`
      );

      return handle;
    } catch (err) {
      console.warn("⚠️ Trigger.dev dispatch failed, falling back to local runner:", err.message);
      await sendQuickReply(
        authorizedChatId,
        `⚠️ <i>Trigger.dev dispatch failed (${err.message}). Falling back to direct local execution...</i>`
      );
    } finally {
      isProcessing = false;
    }
  }

  // Fallback to direct local execution if Trigger.dev is unavailable
  try {
    const result = await runInstantBriefing(2, 25);
    console.log(`✓ [${new Date().toLocaleTimeString()}] Local briefing (${source}) completed.`);
    return result;
  } catch (error) {
    console.error(`✗ [${new Date().toLocaleTimeString()}] Error during briefing (${source}):`, error.message);
    await sendQuickReply(
      authorizedChatId,
      `❌ <b>Error running briefing (${source}):</b> ${error.message}`
    );
    return false;
  } finally {
    isProcessing = false;
  }
}

function startScheduledTimer() {
  setInterval(async () => {
    console.log(`\n🔔 [${new Date().toLocaleTimeString()}] 2-Hour Timer Fired! Starting automated briefing...`);
    await executeBriefing("Automatic 2-Hour Schedule");
    nextRunTime = new Date(Date.now() + SCHEDULE_INTERVAL_MS);
    console.log(`⏱️ Next scheduled run at: ${nextRunTime.toLocaleTimeString()}`);
  }, SCHEDULE_INTERVAL_MS);
}

function formatMinutesRemaining(targetDate) {
  const diffMs = targetDate.getTime() - Date.now();
  if (diffMs <= 0) return "in moments";
  const mins = Math.round(diffMs / (60 * 1000));
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours > 0) {
    return `in ~${hours}h ${remainingMins}m (${targetDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  }
  return `in ~${mins} minutes (${targetDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
}

async function startPolling() {
  await sendQuickReply(
    authorizedChatId,
    `🤖 <b>Email Briefing Bot & Trigger.dev Connected!</b>\n\n` +
      `⚡ <b>Engine:</b> Trigger.dev Cloud Orchestrator\n` +
      `⏱️ <b>Schedule:</b> Automatic briefing every ${SCHEDULE_HOURS} hours\n` +
      `📅 <b>Next scheduled run:</b> ${formatMinutesRemaining(nextRunTime)}\n\n` +
      `💬 Send <code>trigger</code> to dispatch an instant run and get a live Trigger.dev link.`
  );

  while (true) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=25`,
        { method: "GET" }
      );

      if (!response.ok) {
        console.warn(`Telegram polling warning (${response.status}), retrying in 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      const data = await response.json();
      const updates = data.result || [];

      for (const update of updates) {
        offset = update.update_id + 1;

        const message = update.message;
        if (!message || !message.text) continue;

        const senderChatId = String(message.chat.id);
        const incomingText = message.text.trim().toLowerCase();
        const userName = message.from?.first_name || "User";

        console.log(`[Telegram Message] From ${userName} (${senderChatId}): "${message.text}"`);

        // Security check: Only respond to the authorized chat ID
        if (senderChatId !== String(authorizedChatId)) {
          console.warn(`Unauthorized attempt from chat ID: ${senderChatId}`);
          await sendQuickReply(
            senderChatId,
            "⛔ <b>Access Denied:</b> This bot is configured for a private user."
          );
          continue;
        }

        // Trigger command detection
        if (
          incomingText === "trigger" ||
          incomingText === "/trigger" ||
          incomingText.startsWith("trigger ") ||
          incomingText === "check"
        ) {
          if (isProcessing) {
            await sendQuickReply(
              senderChatId,
              "⏳ <i>A briefing is currently being processed. Please check back in a moment...</i>"
            );
            continue;
          }

          await executeBriefing(`Telegram Trigger by ${userName}`);
        } else if (
          incomingText === "/status" ||
          incomingText === "status" ||
          incomingText === "/next" ||
          incomingText === "next"
        ) {
          let latestRunInfo = "";
          try {
            if (process.env.TRIGGER_SECRET_KEY) {
              const runList = await runs.list({ limit: 1 });
              if (runList.data && runList.data.length > 0) {
                const latest = runList.data[0];
                const runUrl = `${DASHBOARD_PROJECT_URL}/runs/${latest.id}`;
                const createdTime = new Date(latest.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                latestRunInfo =
                  `\n\n📊 <b>Latest Trigger.dev Run:</b>\n` +
                  `• <b>Task:</b> <code>${latest.taskIdentifier}</code>\n` +
                  `• <b>Status:</b> <code>${latest.status}</code> (${createdTime})\n` +
                  `• <b>ID:</b> <code>${latest.id}</code>\n` +
                  `• <a href="${runUrl}">View in Trigger.dev Dashboard</a>`;
              }
            }
          } catch (e) {
            console.error("Failed to query Trigger.dev runs:", e.message);
          }

          await sendQuickReply(
            senderChatId,
            `🟢 <b>System Status: ACTIVE</b>\n\n` +
              `⚡ <b>Platform:</b> Trigger.dev connected\n` +
              `⏱️ <b>Schedule:</b> Every ${SCHEDULE_HOURS} hours\n` +
              `📅 <b>Next scheduled run:</b> ${formatMinutesRemaining(nextRunTime)}` +
              latestRunInfo +
              `\n\n💬 Send <code>trigger</code> to dispatch a new briefing.`
          );
        } else if (
          incomingText === "/start" ||
          incomingText === "help" ||
          incomingText === "/help" ||
          incomingText === "hi" ||
          incomingText === "hello"
        ) {
          await sendQuickReply(
            senderChatId,
            `👋 <b>Hello ${userName}!</b>\n\n` +
              `I am your <b>Email Briefing Assistant</b> connected to <b>Trigger.dev</b>.\n\n` +
              `⏱️ <b>Automated:</b> Delivering headlines every ${SCHEDULE_HOURS} hours\n` +
              `📅 <b>Next run:</b> ${formatMinutesRemaining(nextRunTime)}\n\n` +
              `<b>Available Commands:</b>\n` +
              `• <code>trigger</code> — Dispatch task to Trigger.dev & generate briefing\n` +
              `• <code>status</code> — View bot status, next run & latest Trigger.dev run\n` +
              `• <code>help</code> — Show this help message\n\n` +
              `🔗 <a href="${DASHBOARD_PROJECT_URL}">Open Trigger.dev Dashboard</a>`
          );
        } else {
          await sendQuickReply(
            senderChatId,
            `💡 <b>Command not recognized.</b>\n\n` +
              `• Send <code>trigger</code> to dispatch a briefing through Trigger.dev\n` +
              `• Send <code>status</code> to check bot and Trigger.dev run status`
          );
        }
      }
    } catch (err) {
      console.error("Polling error:", err.message);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

// Start recurring timer
startScheduledTimer();

// Start polling for Telegram commands
startPolling();
