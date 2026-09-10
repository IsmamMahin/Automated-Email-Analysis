import dotenv from "dotenv";
import { runInstantBriefing, sendTelegramMessage } from "./instant-check.mjs";

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const authorizedChatId = process.env.TELEGRAM_CHAT_ID;

if (!botToken || !authorizedChatId) {
  console.error("Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env!");
  process.exit(1);
}

console.log("\n======================================================");
console.log("🤖 Telegram Bot Listener Started for @rimuru_gbot");
console.log(`🔒 Listening exclusively for messages from chat ID: ${authorizedChatId}`);
console.log("💬 Type 'trigger' or '/trigger' in Telegram to initiate an instant email briefing!");
console.log("======================================================\n");

let offset = 0;
let isProcessing = false;

async function sendQuickReply(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("Failed to send quick reply:", err);
  }
}

async function startPolling() {
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
              "⏳ <i>An email briefing is already currently generating. Please wait a moment...</i>"
            );
            continue;
          }

          isProcessing = true;
          await sendQuickReply(
            senderChatId,
            "⚡ <b>Trigger received!</b> Fetching your inbox and analyzing the last 2 hours of emails..."
          );

          try {
            console.log("Executing email briefing triggered from Telegram...");
            await runInstantBriefing(2, 25);
            console.log("✓ Telegram-triggered briefing completed successfully.");
          } catch (briefingError) {
            console.error("Error executing briefing from Telegram:", briefingError);
            await sendQuickReply(
              senderChatId,
              `❌ <b>Error running briefing:</b> ${briefingError.message}`
            );
          } finally {
            isProcessing = false;
          }
        } else if (
          incomingText === "/start" ||
          incomingText === "help" ||
          incomingText === "hi" ||
          incomingText === "hello"
        ) {
          await sendQuickReply(
            senderChatId,
            `👋 <b>Hello ${userName}!</b>\n\nI am your <b>Email Briefing Bot</b>.\n\n💬 Send <code>trigger</code> anytime to immediately fetch, summarize, and deliver your 2-hour email headlines!`
          );
        } else {
          await sendQuickReply(
            senderChatId,
            `💡 <b>Command not recognized.</b>\n\nSend <code>trigger</code> to initiate an instant 2-hour email briefing.`
          );
        }
      }
    } catch (err) {
      console.error("Polling error:", err.message);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

startPolling();
