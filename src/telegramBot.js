require("dotenv").config();

const { pool, testConnection } = require("./db");

const token = process.env.TELEGRAM_BOT_TOKEN;
const webAppUrl = process.env.TELEGRAM_WEBAPP_URL;
const pollTimeoutSeconds = Number(process.env.TELEGRAM_POLL_TIMEOUT_SECONDS || 25);
const defaultPasswordHash =
  process.env.DEFAULT_OWNER_PASSWORD_HASH || "$2b$10$0000000000000000000000000000000000000000000000000000";
const sessions = new Map();

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required.");
}

if (!webAppUrl) {
  throw new Error("TELEGRAM_WEBAPP_URL is required.");
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizePhone(value) {
  const phone = cleanText(value).replace(/\s+/g, "");
  return /^\+?[0-9-]{7,20}$/.test(phone) ? phone : "";
}

function profileFromTelegram(from) {
  return {
    telegramId: Number(from.id),
    telegramUsername: cleanText(from.username),
    telegramFirstName: cleanText(from.first_name),
    telegramLastName: cleanText(from.last_name)
  };
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

function webAppKeyboard(extraRows = []) {
  return {
    inline_keyboard: [
      [
        {
          text: "📦 Open Inventory",
          web_app: { url: webAppUrl }
        }
      ],
      ...extraRows
    ]
  };
}

function accountTypeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Seller", callback_data: "account:seller" }],
      [{ text: "Store Owner", callback_data: "account:store_owner" }]
    ]
  };
}

function sellerRequestKeyboard(requestId) {
  return {
    inline_keyboard: [
      [
        { text: "Approve", callback_data: `seller_request:approve:${requestId}` },
        { text: "Reject", callback_data: `seller_request:reject:${requestId}` }
      ]
    ]
  };
}

async function sendMessage(chatId, text, replyMarkup) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup
  });
}

async function ensureSellerStoreRequestsTable() {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS seller_store_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      seller_user_id INT NOT NULL,
      store_id INT NOT NULL,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME NULL,
      resolved_by_user_id INT NULL,

      CONSTRAINT fk_seller_store_requests_seller
        FOREIGN KEY (seller_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

      CONSTRAINT fk_seller_store_requests_store
        FOREIGN KEY (store_id) REFERENCES store(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

      CONSTRAINT fk_seller_store_requests_resolver
        FOREIGN KEY (resolved_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  const indexes = [
    ["idx_seller_store_requests_seller_user_id", "seller_user_id"],
    ["idx_seller_store_requests_store_id", "store_id"],
    ["idx_seller_store_requests_status", "status"]
  ];

  for (const [indexName, columnName] of indexes) {
    const [existing] = await pool.execute(
      `SELECT 1
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'seller_store_requests'
         AND INDEX_NAME = ?
       LIMIT 1`,
      [indexName]
    );

    if (!existing.length) {
      await pool.query(`CREATE INDEX \`${indexName}\` ON seller_store_requests(\`${columnName}\`)`);
    }
  }
}

async function answerCallbackQuery(callbackQueryId) {
  return telegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId
  });
}

async function findStoreByName(storeName) {
  const [stores] = await pool.execute(
    `SELECT id, store_name AS storeName
     FROM store
     WHERE LOWER(store_name) = LOWER(?)
       AND is_active = TRUE
     ORDER BY id
     LIMIT 1`,
    [storeName]
  );
  return stores[0] || null;
}

async function ownersForStore(storeId) {
  const [owners] = await pool.execute(
    `SELECT u.id, u.telegram_id AS telegramId, u.fname, u.lname
     FROM store_users su
     INNER JOIN users u ON u.id = su.user_id
     WHERE su.store_id = ?
       AND su.role = 'owner'
       AND u.telegram_id IS NOT NULL`,
    [storeId]
  );
  return owners;
}

async function findUserByTelegramId(telegramId) {
  const [users] = await pool.execute(
    `SELECT
       u.id,
       u.fname,
      u.lname,
      u.phone_number AS phoneNumber,
      u.role,
       s.store_name AS storeName,
       su.role AS storeRole
     FROM users u
     LEFT JOIN store_users su ON su.user_id = u.id
     LEFT JOIN store s ON s.id = su.store_id AND s.is_active = TRUE
     WHERE u.telegram_id = ?
     ORDER BY FIELD(su.role, 'owner', 'manager', 'staff'), s.id
     LIMIT 1`,
    [telegramId]
  );
  return users[0] || null;
}

async function createTelegramUser(profile, data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingByPhone] = await connection.execute(
      "SELECT id, telegram_id AS telegramId FROM users WHERE phone_number = ? LIMIT 1",
      [data.phoneNumber]
    );

    if (existingByPhone.length) {
      const existingUser = existingByPhone[0];
      if (existingUser.telegramId && Number(existingUser.telegramId) !== profile.telegramId) {
        throw new Error("This phone number is already linked to another Telegram account.");
      }

      await connection.execute(
        `UPDATE users
         SET telegram_id = ?,
             role = CASE WHEN role IN ('customer', 'seller') THEN ? ELSE role END
         WHERE id = ?`,
        [
          profile.telegramId,
          data.userRole,
          existingUser.id
        ]
      );

      let storeId = null;
      if (data.storeRole === "owner") {
        const [stores] = await connection.execute(
          `SELECT s.id
           FROM store_users su
           INNER JOIN store s ON s.id = su.store_id
           WHERE su.user_id = ? AND su.role = 'owner'
           ORDER BY s.id
           LIMIT 1`,
          [existingUser.id]
        );
        storeId = stores[0]?.id || null;

        if (!storeId) {
          const [storeInsert] = await connection.execute(
            `INSERT INTO store (store_name, is_active, channel_name_telegram)
             VALUES (?, TRUE, ?)`,
            [data.storeName, profile.telegramUsername || null]
          );
          storeId = storeInsert.insertId;
        }

        await connection.execute(
          `INSERT IGNORE INTO store_users (user_id, store_id, role)
           VALUES (?, ?, 'owner')`,
          [existingUser.id, storeId]
        );
      }

      await connection.commit();
      return { userId: existingUser.id, storeId };
    }

    const [userInsert] = await connection.execute(
      `INSERT INTO users (
         fname,
         lname,
         phone_number,
         password_hash,
         telegram_id,
         role
       )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.firstName,
        data.lastName,
        data.phoneNumber,
        defaultPasswordHash,
        profile.telegramId,
        data.userRole
      ]
    );

    let storeId = null;
    if (data.storeRole === "owner") {
      const [storeInsert] = await connection.execute(
        `INSERT INTO store (store_name, is_active, channel_name_telegram)
         VALUES (?, TRUE, ?)`,
        [data.storeName, profile.telegramUsername || null]
      );
      storeId = storeInsert.insertId;

      await connection.execute(
        `INSERT INTO store_users (user_id, store_id, role)
         VALUES (?, ?, 'owner')`,
        [userInsert.insertId, storeId]
      );
    }

    await connection.commit();
    return { userId: userInsert.insertId, storeId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createSellerStoreRequest(userId, storeId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [memberships] = await connection.execute(
      "SELECT id FROM store_users WHERE user_id = ? AND store_id = ? LIMIT 1",
      [userId, storeId]
    );
    if (memberships.length) {
      await connection.commit();
      return { status: "already_member" };
    }

    const [pending] = await connection.execute(
      `SELECT id
       FROM seller_store_requests
       WHERE seller_user_id = ?
         AND store_id = ?
         AND status = 'pending'
       ORDER BY id DESC
       LIMIT 1`,
      [userId, storeId]
    );
    if (pending.length) {
      await connection.commit();
      return { status: "pending", requestId: pending[0].id };
    }

    const [insert] = await connection.execute(
      `INSERT INTO seller_store_requests (seller_user_id, store_id, status)
       VALUES (?, ?, 'pending')`,
      [userId, storeId]
    );

    await connection.commit();
    return { status: "created", requestId: insert.insertId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function notifyStoreOwnersAboutSellerRequest(requestId, sellerUserId, store) {
  const [sellers] = await pool.execute(
    "SELECT fname, lname, phone_number AS phoneNumber FROM users WHERE id = ? LIMIT 1",
    [sellerUserId]
  );
  const seller = sellers[0];
  const owners = await ownersForStore(store.id);

  for (const owner of owners) {
    await sendMessage(
      owner.telegramId,
      `Seller access request\n\nStore: ${store.storeName}\nSeller: ${seller?.fname || ""} ${seller?.lname || ""}\nPhone: ${seller?.phoneNumber || "N/A"}`,
      sellerRequestKeyboard(requestId)
    );
  }

  return owners.length;
}

async function submitSellerStoreRequest(chatId, userId, storeName) {
  const store = await findStoreByName(storeName);
  if (!store) {
    await sendMessage(chatId, `No active store named "${storeName}" was found. Ask the owner for the exact store name, then send /start again.`);
    return;
  }

  const request = await createSellerStoreRequest(userId, store.id);
  if (request.status === "already_member") {
    await sendMessage(chatId, "You can now open the inventory dashboard.", webAppKeyboard());
    return;
  }

  const ownerCount = await notifyStoreOwnersAboutSellerRequest(request.requestId, userId, store);
  if (ownerCount > 0) {
    await sendMessage(chatId, `Your request was sent to the owner of ${store.storeName}. You can open inventory after approval.`);
    return;
  }

  await sendMessage(chatId, `Your request was saved for ${store.storeName}, but no Telegram owner was found to notify. Ask the owner to approve it.`);
}

async function handleSellerRequestDecision(chatId, from, action, requestId) {
  const owner = await findUserByTelegramId(from.id);
  if (!owner?.id) {
    await sendMessage(chatId, "Owner account was not found. Please send /start.");
    return;
  }

  const connection = await pool.getConnection();
  let sellerTelegramId = null;
  let storeName = "";
  let sellerName = "";

  try {
    await connection.beginTransaction();

    const [[request]] = await connection.execute(
      `SELECT
         ssr.id,
         ssr.seller_user_id AS sellerUserId,
         ssr.store_id AS storeId,
         ssr.status,
         s.store_name AS storeName,
         u.telegram_id AS sellerTelegramId,
         CONCAT(u.fname, ' ', u.lname) AS sellerName
       FROM seller_store_requests ssr
       INNER JOIN store s ON s.id = ssr.store_id
       INNER JOIN users u ON u.id = ssr.seller_user_id
       INNER JOIN store_users su ON su.store_id = ssr.store_id
       WHERE ssr.id = ?
         AND su.user_id = ?
         AND su.role = 'owner'
       LIMIT 1
       FOR UPDATE`,
      [requestId, owner.id]
    );

    if (!request) {
      await connection.rollback();
      await sendMessage(chatId, "Request not found or you are not the owner of this store.");
      return;
    }

    if (request.status !== "pending") {
      await connection.rollback();
      await sendMessage(chatId, `This request is already ${request.status}.`);
      return;
    }

    sellerTelegramId = request.sellerTelegramId;
    storeName = request.storeName;
    sellerName = request.sellerName;

    if (action === "approve") {
      await connection.execute(
        `INSERT IGNORE INTO store_users (user_id, store_id, role)
         VALUES (?, ?, 'staff')`,
        [request.sellerUserId, request.storeId]
      );
    }

    await connection.execute(
      `UPDATE seller_store_requests
       SET status = ?, resolved_at = NOW(), resolved_by_user_id = ?
       WHERE id = ?`,
      [action === "approve" ? "approved" : "rejected", owner.id, requestId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await sendMessage(chatId, `${sellerName} was ${action === "approve" ? "approved for" : "rejected from"} ${storeName}.`);
  if (sellerTelegramId) {
    await sendMessage(
      sellerTelegramId,
      action === "approve"
        ? `Your request to join ${storeName} was approved. You can now open the inventory dashboard.`
        : `Your request to join ${storeName} was rejected.`
      ,
      action === "approve" ? webAppKeyboard() : undefined
    );
  }
}

async function showStart(chatId, from) {
  const profile = profileFromTelegram(from);
  const user = await findUserByTelegramId(profile.telegramId);

  if (user) {
    if (user.role === "seller" && !user.storeName) {
      sessions.set(chatId, {
        step: "existing_seller_store_name",
        profile,
        existingUserId: user.id,
        data: {}
      });
      await sendMessage(chatId, "Your seller account is not connected to a store yet. Please send the exact store name.");
      return;
    }

    await sendMessage(chatId, "Welcome back.", webAppKeyboard([
      [{ text: "👤 Profile", callback_data: "profile" }],
      [{ text: "❓ Help", callback_data: "help" }]
    ]));
    return;
  }

  sessions.set(chatId, {
    step: "first_name",
    profile,
    data: {}
  });

  await sendMessage(chatId, "👋 Welcome to Shoe Store Inventory\n\nManage your store inventory directly from Telegram.", webAppKeyboard());
  await sendMessage(chatId, "Welcome!\n\nLet's create your account.\n\nPlease send your first name.");
}

async function handleContact(chatId, from, contact) {
  const session = sessions.get(chatId);
  if (!session || session.step !== "phone") return;

  if (Number(contact.user_id) !== Number(from.id)) {
    await sendMessage(chatId, "Please use the Share Phone Number button for your own Telegram account.");
    return;
  }

  const phoneNumber = normalizePhone(contact.phone_number);
  if (!phoneNumber) {
    await sendMessage(chatId, "That phone number format is not valid. Please try again.");
    return;
  }

  session.data.phoneNumber = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;
  session.step = "account_type";
  sessions.set(chatId, session);

  await sendMessage(chatId, "Choose account type:", accountTypeKeyboard());
}

async function handleRegistrationText(chatId, text) {
  const session = sessions.get(chatId);
  if (!session) return false;

  if (session.step === "first_name") {
    const firstName = cleanText(text);
    if (!firstName || firstName.length > 20) {
      await sendMessage(chatId, "Please send a first name up to 20 characters.");
      return true;
    }
    session.data.firstName = firstName;
    session.step = "last_name";
    sessions.set(chatId, session);
    await sendMessage(chatId, "Please send your last name.");
    return true;
  }

  if (session.step === "last_name") {
    const lastName = cleanText(text);
    if (!lastName || lastName.length > 20) {
      await sendMessage(chatId, "Please send a last name up to 20 characters.");
      return true;
    }
    session.data.lastName = lastName;
    session.step = "phone";
    sessions.set(chatId, session);
    await sendMessage(chatId, "Please share your phone number.", {
      keyboard: [[{ text: "📱 Share Phone Number", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    });
    return true;
  }

  if (session.step === "owner_store_name" || session.step === "seller_store_name") {
    const storeName = cleanText(text);
    if (!storeName || storeName.length > 50) {
      await sendMessage(chatId, "Store name must be 1-50 characters.");
      return true;
    }
    session.data.storeName = storeName;
    await finishRegistration(chatId, session);
    return true;
  }

  if (session.step === "existing_seller_store_name") {
    const storeName = cleanText(text);
    if (!storeName || storeName.length > 50) {
      await sendMessage(chatId, "Store name must be 1-50 characters.");
      return true;
    }

    sessions.delete(chatId);
    await submitSellerStoreRequest(chatId, session.existingUserId, storeName);
    return true;
  }

  return true;
}

async function finishRegistration(chatId, session) {
  const result = await createTelegramUser(session.profile, session.data);
  sessions.delete(chatId);

  if (session.data.storeRole === "owner") {
    await sendMessage(chatId, "Account created. You can now open the inventory dashboard.", webAppKeyboard());
    return;
  }

  await submitSellerStoreRequest(chatId, result.userId, session.data.storeName);
}

async function handleCallback(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  await answerCallbackQuery(callbackQuery.id);

  if (data === "profile") {
    const user = await findUserByTelegramId(callbackQuery.from.id);
    await sendMessage(
      chatId,
      user
        ? `👤 Profile\n\nName: ${user.fname} ${user.lname}\nRole: ${user.role}\nStore: ${user.storeName || "Not assigned"}`
        : "Profile not found. Please send /start."
    );
    return;
  }

  if (data === "help") {
    await sendMessage(chatId, "Press 📦 Open Inventory to launch the web dashboard inside Telegram.");
    return;
  }

  if (data.startsWith("seller_request:")) {
    const [, action, requestIdText] = data.split(":");
    const requestId = Number(requestIdText);
    if (!["approve", "reject"].includes(action) || !Number.isInteger(requestId)) {
      await sendMessage(chatId, "This seller request action is invalid.");
      return;
    }

    await handleSellerRequestDecision(chatId, callbackQuery.from, action, requestId);
    return;
  }

  if (!data.startsWith("account:")) return;

  const session = sessions.get(chatId);
  if (!session || session.step !== "account_type") {
    await sendMessage(chatId, "Please send /start to begin registration.");
    return;
  }

  const accountType = data.slice("account:".length);
  if (!["seller", "store_owner"].includes(accountType)) {
    await sendMessage(chatId, "Please choose Seller or Store Owner.");
    return;
  }

  session.data.userRole = "seller";
  session.data.storeRole = accountType === "store_owner" ? "owner" : null;
  if (accountType === "store_owner") {
    session.step = "owner_store_name";
    sessions.set(chatId, session);
    await sendMessage(chatId, "Please send your store name.");
    return;
  }

  session.step = "seller_store_name";
  sessions.set(chatId, session);
  await sendMessage(chatId, "Which store do you sell for? Please send the exact store name.");
}

async function handleUpdate(update) {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }

  const message = update.message;
  if (!message?.chat || !message.from) return;

  const chatId = message.chat.id;
  if (message.text === "/start") {
    await showStart(chatId, message.from);
    return;
  }

  if (message.contact) {
    await handleContact(chatId, message.from, message.contact);
    return;
  }

  if (message.text && (await handleRegistrationText(chatId, message.text))) {
    return;
  }

  await sendMessage(chatId, "Send /start to open your inventory options.");
}

async function startBot() {
  await testConnection();
  await ensureSellerStoreRequestsTable();
  let offset = 0;
  console.log("Telegram inventory bot is running.");

  while (true) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: pollTimeoutSeconds,
        allowed_updates: ["message", "callback_query"]
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (error) {
      console.error(`Telegram bot error: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

startBot().catch((error) => {
  console.error(error);
  process.exit(1);
});
