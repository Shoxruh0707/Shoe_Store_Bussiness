require("dotenv").config();

const { pool, testConnection } = require("./db");
const { ensureStoreTelegramColumns } = require("./storeTelegramColumns");

const token = process.env.TELEGRAM_CHANNEL_BOT_TOKEN;
const pollTimeoutSeconds = Number(process.env.TELEGRAM_CHANNEL_POLL_TIMEOUT_SECONDS || process.env.TELEGRAM_POLL_TIMEOUT_SECONDS || 25);

if (!token) {
  throw new Error("TELEGRAM_CHANNEL_BOT_TOKEN is required.");
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function usernameFromChannelLink(value) {
  const text = cleanText(value);
  if (!text) return "";
  if (text.startsWith("@")) return text.slice(1).toLowerCase();

  const match = text.match(/^https:\/\/(?:t|telegram)\.me\/([A-Za-z0-9_]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

async function telegram(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || `Telegram API ${method} failed.`);
  }
  return data.result;
}

async function findStoreForChat(chat) {
  const username = cleanText(chat.username).toLowerCase();
  if (!username) return null;

  const [stores] = await pool.execute(
    `SELECT id, store_name AS storeName, channel_link_telegram AS channelLinkTelegram
     FROM store
     WHERE is_active = TRUE
       AND channel_link_telegram IS NOT NULL
       AND channel_link_telegram <> ''`
  );

  return stores.find((store) => usernameFromChannelLink(store.channelLinkTelegram) === username) || null;
}

function isBotAdded(update) {
  const chatMember = update.my_chat_member;
  if (!chatMember?.chat || !chatMember.new_chat_member) return false;

  const status = chatMember.new_chat_member.status;
  return ["member", "administrator"].includes(status);
}

async function rememberChannelId(update) {
  const chat = update.my_chat_member.chat;
  if (!["channel", "supergroup", "group"].includes(chat.type)) return;

  const store = await findStoreForChat(chat);
  if (!store) {
    console.log(`Channel ${chat.title || chat.username || chat.id} did not match any saved channel_link_telegram.`);
    return;
  }

  await pool.execute(
    `UPDATE store
     SET channel_id = ?,
         channel_name_telegram = ?
     WHERE id = ?`,
    [String(chat.id), chat.username ? `@${chat.username}` : cleanText(chat.title), store.id]
  );

  console.log(`Saved channel_id ${chat.id} for store ${store.storeName}.`);
}

async function handleUpdate(update) {
  if (isBotAdded(update)) {
    await rememberChannelId(update);
  }
}

async function startBot() {
  await testConnection();
  await ensureStoreTelegramColumns(pool);

  let offset = 0;
  console.log("Telegram channel registration bot is running.");

  while (true) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: pollTimeoutSeconds,
        allowed_updates: ["my_chat_member"]
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (error) {
      console.error(`Telegram channel bot error: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

startBot().catch((error) => {
  console.error(error);
  process.exit(1);
});
