const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

const botToken = process.env.TELEGRAM_CHANNEL_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const publicAssetBaseUrl = String(process.env.TELEGRAM_PUBLIC_ASSET_BASE_URL || process.env.PUBLIC_URL || "")
  .trim()
  .replace(/\/$/, "");
const uploadDir = path.join(__dirname, "..", "public", "uploads");
const shoeSizes = ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"];

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatMoney(value) {
  const number = Math.round(Number(value || 0));
  return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uniquePositiveSizes(inventory) {
  return (inventory || [])
    .filter((row) => Number(row.quantity || 0) > 0)
    .map((row) => cleanText(row.size))
    .filter(Boolean);
}

function sizesFromBoxRange(sizeRange) {
  const sizes = new Set();

  for (const token of String(sizeRange || "").split(",")) {
    const part = cleanText(token);
    if (!part) continue;

    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)(?:x\d+)?$/);
    if (rangeMatch) {
      const startIndex = shoeSizes.indexOf(rangeMatch[1]);
      const endIndex = shoeSizes.indexOf(rangeMatch[2]);
      if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
        shoeSizes.slice(startIndex, endIndex + 1).forEach((size) => sizes.add(size));
      }
      continue;
    }

    const sizeMatch = part.match(/^(\d+)(?:x\d+)?$/);
    if (sizeMatch && shoeSizes.includes(sizeMatch[1])) {
      sizes.add(sizeMatch[1]);
    }
  }

  return [...sizes];
}

function uniqueProductSizes(product) {
  const sizes = new Set(uniquePositiveSizes(product.inventory));

  (product.boxStock || [])
    .filter((box) => Number(box.quantity || 0) > 0)
    .flatMap((box) => sizesFromBoxRange(box.sizeRange))
    .forEach((size) => sizes.add(size));

  return shoeSizes.filter((size) => sizes.has(size));
}

function contactLine(contacts) {
  const values = (contacts || [])
    .map((contact) => {
      const name = `${cleanText(contact.fname)} ${cleanText(contact.lname)}`.trim() || "Admin";
      const telegramId = Number(contact.telegramId || 0);

      if (telegramId > 0) {
        return `<a href="tg://user?id=${telegramId}">${escapeHtml(name)}</a>`;
      }

      return escapeHtml(name);
    })
    .filter(Boolean);

  return values.length ? values.join(", ") : "Admin bilan bog'laning";
}

function buildProductCaption(product, store, contacts) {
  const sizes = uniqueProductSizes(product).join(" ");
  const firm = cleanText(product.name || product.artNo);

  return [
    `Фирма: ${escapeHtml(firm)}`,
    `Размер ${escapeHtml(sizes || "-")}`,
    "Качества 👍💯",
    `Цена ${formatMoney(product.price)}✅`,
    `Заказ: ${contactLine(contacts)}`
  ].join("\n");
}

async function telegramJson(method, payload) {
  if (!botToken) {
    throw new Error("TELEGRAM_CHANNEL_BOT_TOKEN or TELEGRAM_BOT_TOKEN is required for channel publishing.");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
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

async function telegramMultipart(method, formData) {
  if (!botToken) {
    throw new Error("TELEGRAM_CHANNEL_BOT_TOKEN or TELEGRAM_BOT_TOKEN is required for channel publishing.");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    body: formData
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || `Telegram API ${method} failed.`);
  }
  return data.result;
}

function publicImageUrl(imagePath) {
  if (!publicAssetBaseUrl || !imagePath.startsWith("/")) return "";
  return `${publicAssetBaseUrl}${imagePath}`;
}

function localUploadPath(imagePath) {
  const cleanPath = cleanText(imagePath);
  if (!cleanPath.startsWith("/uploads/") || cleanPath.startsWith("/uploads/temp/")) return "";
  return path.join(uploadDir, path.basename(cleanPath));
}

async function appendLocalImage(formData, fieldName, imagePath) {
  const filePath = localUploadPath(imagePath);
  if (!filePath) return false;

  const buffer = await fs.promises.readFile(filePath);
  formData.append(fieldName, new Blob([buffer]), path.basename(filePath));
  return true;
}

async function sendProductMessage(channelId, caption, imagePaths) {
  const paths = (imagePaths || []).map(cleanText).filter(Boolean).slice(0, 10);
  if (!paths.length) {
    return telegramJson("sendMessage", {
      chat_id: channelId,
      text: caption,
      parse_mode: "HTML"
    });
  }

  if (paths.length === 1) {
    const url = publicImageUrl(paths[0]);
    if (url) {
      return telegramJson("sendPhoto", {
        chat_id: channelId,
        photo: url,
        caption,
        parse_mode: "HTML"
      });
    }

    const formData = new FormData();
    formData.append("chat_id", String(channelId));
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");
    await appendLocalImage(formData, "photo", paths[0]);
    return telegramMultipart("sendPhoto", formData);
  }

  const formData = new FormData();
  formData.append("chat_id", String(channelId));

  const media = [];
  for (const [index, imagePath] of paths.entries()) {
    const url = publicImageUrl(imagePath);
    const mediaItem = {
      type: "photo",
      media: url || `attach://photo${index}`
    };

    if (index === 0) {
      mediaItem.caption = caption;
      mediaItem.parse_mode = "HTML";
    }

    media.push(mediaItem);
    if (!url) {
      await appendLocalImage(formData, `photo${index}`, imagePath);
    }
  }

  formData.append("media", JSON.stringify(media));
  return telegramMultipart("sendMediaGroup", formData);
}

async function contactsForStore(storeId) {
  const [contacts] = await pool.execute(
    `SELECT u.fname, u.lname, u.telegram_id AS telegramId, su.role AS storeRole
     FROM store_users su
     INNER JOIN users u ON u.id = su.user_id
     WHERE su.store_id = ?
       AND su.role IN ('owner', 'manager')
     ORDER BY FIELD(su.role, 'owner', 'manager'), u.fname, u.lname`,
    [storeId]
  );

  return contacts;
}

async function storeForChannelAnnouncement(storeId) {
  const [stores] = await pool.execute(
    `SELECT
       id,
       store_name AS storeName,
       channel_id AS channelId,
       channel_name_telegram AS channelNameTelegram,
       channel_link_telegram AS channelLinkTelegram
     FROM store
     WHERE id = ?
       AND is_active = TRUE
     LIMIT 1`,
    [storeId]
  );

  return stores[0] || null;
}

async function publishProductToStoreChannel(storeId, product) {
  const store = await storeForChannelAnnouncement(storeId);
  if (!store?.channelId) {
    return { sent: false, reason: "channel_id_missing" };
  }

  const contacts = await contactsForStore(storeId);
  const caption = buildProductCaption(product, store, contacts);
  const imagePaths = (product.images || []).map((image) => image.path);
  await sendProductMessage(store.channelId, caption, imagePaths);

  return { sent: true, channelId: store.channelId };
}

module.exports = {
  buildProductCaption,
  publishProductToStoreChannel
};
