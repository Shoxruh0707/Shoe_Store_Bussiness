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
          text: "Inventarni ochish",
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
      [{ text: "Sotuvchi", callback_data: "account:seller" }],
      [{ text: "Do'kon egasi", callback_data: "account:store_owner" }]
    ]
  };
}

function sellerRequestKeyboard(requestId) {
  return {
    inline_keyboard: [
      [
        { text: "Tasdiqlash", callback_data: `seller_request:approve:${requestId}` },
        { text: "Rad etish", callback_data: `seller_request:reject:${requestId}` }
      ]
    ]
  };
}

function ownerHomeKeyboard() {
  return webAppKeyboard([
    [{ text: "Foydalanuvchilar ro'yxati", callback_data: "users:list" }],
    [{ text: "Profil", callback_data: "profile" }],
    [{ text: "Yordam", callback_data: "help" }]
  ]);
}

function userDeleteConfirmKeyboard(userId) {
  return {
    inline_keyboard: [
      [
        { text: "Ha, o'chirish", callback_data: `user_delete:delete:${userId}` },
        { text: "Bekor qilish", callback_data: "users:list" }
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
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      seller_user_id INT UNSIGNED NOT NULL,
      store_id INT UNSIGNED NOT NULL,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME NULL,
      resolved_by_user_id INT UNSIGNED NULL,

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

async function ownerStoreForTelegramId(telegramId) {
  const [stores] = await pool.execute(
    `SELECT s.id, s.store_name AS storeName, u.id AS ownerUserId
     FROM users u
     INNER JOIN store_users su ON su.user_id = u.id
     INNER JOIN store s ON s.id = su.store_id
     WHERE u.telegram_id = ?
       AND su.role = 'owner'
       AND s.is_active = TRUE
     ORDER BY s.id
     LIMIT 1`,
    [telegramId]
  );

  return stores[0] || null;
}

function storeRoleLabel(role) {
  if (role === "owner") return "Egasi";
  if (role === "manager") return "Menejer";
  return "Sotuvchi";
}

async function usersForStore(storeId) {
  const [users] = await pool.execute(
    `SELECT
       u.id,
       u.fname,
       u.lname,
       u.phone_number AS phoneNumber,
       su.role AS storeRole
     FROM store_users su
     INNER JOIN users u ON u.id = su.user_id
     WHERE su.store_id = ?
     ORDER BY FIELD(su.role, 'owner', 'manager', 'staff'), u.fname, u.lname`,
    [storeId]
  );

  return users;
}

async function showStoreUsers(chatId, from) {
  const ownerStore = await ownerStoreForTelegramId(from.id);
  if (!ownerStore) {
    await sendMessage(chatId, "Bu amal faqat do'kon egasi uchun mavjud. /start ni yuboring.");
    return;
  }

  const users = await usersForStore(ownerStore.id);
  const lines = users.map((user, index) => {
    const selfLabel = user.id === ownerStore.ownerUserId ? " (siz)" : "";
    return `${index + 1}. ${user.fname} ${user.lname}${selfLabel} - ${storeRoleLabel(user.storeRole)} - ${user.phoneNumber}`;
  });
  const deleteRows = users
    .filter((user) => user.id !== ownerStore.ownerUserId)
    .map((user) => [
      {
        text: `O'chirish: ${user.fname} ${user.lname}`.slice(0, 64),
        callback_data: `user_delete:confirm:${user.id}`
      }
    ]);

  await sendMessage(
    chatId,
    `${ownerStore.storeName} foydalanuvchilari:\n\n${lines.join("\n") || "Foydalanuvchilar yo'q."}`,
    {
      inline_keyboard: [
        ...deleteRows,
        [{ text: "Bosh sahifa", callback_data: "home" }]
      ]
    }
  );
}

async function confirmDeleteStoreUser(chatId, from, userId) {
  const ownerStore = await ownerStoreForTelegramId(from.id);
  if (!ownerStore) {
    await sendMessage(chatId, "Bu amal faqat do'kon egasi uchun mavjud. /start ni yuboring.");
    return;
  }

  const [users] = await pool.execute(
    `SELECT u.id, u.fname, u.lname, su.role AS storeRole
     FROM store_users su
     INNER JOIN users u ON u.id = su.user_id
     WHERE su.store_id = ?
       AND u.id = ?
     LIMIT 1`,
    [ownerStore.id, userId]
  );
  const user = users[0];

  if (!user || user.id === ownerStore.ownerUserId || user.storeRole === "owner") {
    await sendMessage(chatId, "Bu foydalanuvchini o'chirib bo'lmaydi.");
    await showStoreUsers(chatId, from);
    return;
  }

  await sendMessage(
    chatId,
    `${user.fname} ${user.lname} foydalanuvchisini inventar kirishidan va bazadan o'chirasizmi?`,
    userDeleteConfirmKeyboard(user.id)
  );
}

async function deleteStoreUser(chatId, from, userId) {
  const ownerStore = await ownerStoreForTelegramId(from.id);
  if (!ownerStore) {
    await sendMessage(chatId, "Bu amal faqat do'kon egasi uchun mavjud. /start ni yuboring.");
    return;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[user]] = await connection.execute(
      `SELECT u.id, u.fname, u.lname, su.role AS storeRole
       FROM store_users su
       INNER JOIN users u ON u.id = su.user_id
       WHERE su.store_id = ?
         AND u.id = ?
       LIMIT 1
       FOR UPDATE`,
      [ownerStore.id, userId]
    );

    if (!user || user.id === ownerStore.ownerUserId || user.storeRole === "owner") {
      await connection.rollback();
      await sendMessage(chatId, "Bu foydalanuvchini o'chirib bo'lmaydi.");
      await showStart(chatId, from);
      return;
    }

    await connection.execute("DELETE FROM seller_store_requests WHERE seller_user_id = ? OR resolved_by_user_id = ?", [
      userId,
      userId
    ]);
    await connection.execute("DELETE FROM store_users WHERE user_id = ? AND store_id = ?", [userId, ownerStore.id]);
    await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
    await connection.commit();

    await sendMessage(chatId, `${user.fname} ${user.lname} o'chirildi.`);
    await showStart(chatId, from);
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      await sendMessage(
        chatId,
        "Bu foydalanuvchida sotuv tarixi bor. Tarix jadvallari o'zgartirilmagani uchun bazadan to'liq o'chirish mumkin emas."
      );
      await showStart(chatId, from);
      return;
    }
    throw error;
  } finally {
    connection.release();
  }
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
        throw new Error("Bu telefon raqam boshqa Telegram akkauntiga ulangan.");
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
      `Sotuvchi kirish so'rovi\n\nDo'kon: ${store.storeName}\nSotuvchi: ${seller?.fname || ""} ${seller?.lname || ""}\nTelefon: ${seller?.phoneNumber || "N/A"}`,
      sellerRequestKeyboard(requestId)
    );
  }

  return owners.length;
}

async function submitSellerStoreRequest(chatId, userId, storeName) {
  const store = await findStoreByName(storeName);
  if (!store) {
    await sendMessage(chatId, `"${storeName}" nomli faol do'kon topilmadi. Do'kon egasidan aniq nomni so'rang va /start ni qayta yuboring.`);
    return;
  }

  const request = await createSellerStoreRequest(userId, store.id);
  if (request.status === "already_member") {
    await sendMessage(chatId, "Endi inventar panelini ochishingiz mumkin.", webAppKeyboard());
    return;
  }

  const ownerCount = await notifyStoreOwnersAboutSellerRequest(request.requestId, userId, store);
  if (ownerCount > 0) {
    await sendMessage(chatId, `So'rovingiz ${store.storeName} do'koni egasiga yuborildi. Tasdiqlangandan keyin inventarni ochasiz.`);
    return;
  }

  await sendMessage(chatId, `${store.storeName} uchun so'rovingiz saqlandi, lekin Telegramda do'kon egasi topilmadi. Egasidan tasdiqlashni so'rang.`);
}

async function handleSellerRequestDecision(chatId, from, action, requestId) {
  const owner = await findUserByTelegramId(from.id);
  if (!owner?.id) {
    await sendMessage(chatId, "Do'kon egasi akkaunti topilmadi. /start ni yuboring.");
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
      await sendMessage(chatId, "So'rov topilmadi yoki siz bu do'kon egasi emassiz.");
      return;
    }

    if (request.status !== "pending") {
      await connection.rollback();
      await sendMessage(chatId, `Bu so'rov allaqachon ${request.status}.`);
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

  await sendMessage(chatId, `${sellerName} ${storeName} uchun ${action === "approve" ? "tasdiqlandi" : "rad etildi"}.`);
  if (sellerTelegramId) {
    await sendMessage(
      sellerTelegramId,
      action === "approve"
        ? `${storeName} do'koniga qo'shilish so'rovingiz tasdiqlandi. Endi inventarni ochishingiz mumkin.`
        : `${storeName} do'koniga qo'shilish so'rovingiz rad etildi.`
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
      await sendMessage(chatId, "Sotuvchi akkauntingiz hali do'konga ulanmagan. Iltimos, do'konning aniq nomini yuboring.");
      return;
    }

    await sendMessage(chatId, "Qaytganingiz bilan.", user.storeRole === "owner" ? ownerHomeKeyboard() : webAppKeyboard([
      [{ text: "Profil", callback_data: "profile" }],
      [{ text: "Yordam", callback_data: "help" }]
    ]));
    return;
  }

  sessions.set(chatId, {
    step: "first_name",
    profile,
    data: {}
  });

  await sendMessage(chatId, "Shoe Store Inventory botiga xush kelibsiz.\n\nDo'kon inventarini Telegram orqali boshqaring.", webAppKeyboard());
  await sendMessage(chatId, "Xush kelibsiz!\n\nAkkaunt yaratamiz.\n\nIltimos, ismingizni yuboring.");
}

async function handleContact(chatId, from, contact) {
  const session = sessions.get(chatId);
  if (!session || session.step !== "phone") return;

  if (Number(contact.user_id) !== Number(from.id)) {
    await sendMessage(chatId, "Iltimos, o'zingizning Telegram akkauntingiz uchun Telefon raqamni ulashish tugmasidan foydalaning.");
    return;
  }

  const phoneNumber = normalizePhone(contact.phone_number);
  if (!phoneNumber) {
    await sendMessage(chatId, "Telefon raqam formati noto'g'ri. Qayta urinib ko'ring.");
    return;
  }

  session.data.phoneNumber = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;
  session.step = "account_type";
  sessions.set(chatId, session);

  await sendMessage(chatId, "Akkaunt turini tanlang:", accountTypeKeyboard());
}

async function handleRegistrationText(chatId, text) {
  const session = sessions.get(chatId);
  if (!session) return false;

  if (session.step === "first_name") {
    const firstName = cleanText(text);
    if (!firstName || firstName.length > 20) {
      await sendMessage(chatId, "Iltimos, 20 ta belgigacha bo'lgan ism yuboring.");
      return true;
    }
    session.data.firstName = firstName;
    session.step = "last_name";
    sessions.set(chatId, session);
    await sendMessage(chatId, "Iltimos, familiyangizni yuboring.");
    return true;
  }

  if (session.step === "last_name") {
    const lastName = cleanText(text);
    if (!lastName || lastName.length > 20) {
      await sendMessage(chatId, "Iltimos, 20 ta belgigacha bo'lgan familiya yuboring.");
      return true;
    }
    session.data.lastName = lastName;
    session.step = "phone";
    sessions.set(chatId, session);
    await sendMessage(chatId, "Iltimos, telefon raqamingizni ulashing.", {
      keyboard: [[{ text: "Telefon raqamni ulashish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    });
    return true;
  }

  if (session.step === "owner_store_name" || session.step === "seller_store_name") {
    const storeName = cleanText(text);
    if (!storeName || storeName.length > 50) {
      await sendMessage(chatId, "Do'kon nomi 1-50 ta belgi bo'lishi kerak.");
      return true;
    }
    session.data.storeName = storeName;
    await finishRegistration(chatId, session);
    return true;
  }

  if (session.step === "existing_seller_store_name") {
    const storeName = cleanText(text);
    if (!storeName || storeName.length > 50) {
      await sendMessage(chatId, "Do'kon nomi 1-50 ta belgi bo'lishi kerak.");
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
    await sendMessage(chatId, "Akkaunt yaratildi. Endi inventar panelini ochishingiz mumkin.", ownerHomeKeyboard());
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
        ? `Profil\n\nIsm: ${user.fname} ${user.lname}\nRol: ${storeRoleLabel(user.storeRole || user.role)}\nDo'kon: ${user.storeName || "Biriktirilmagan"}`
        : "Profil topilmadi. /start ni yuboring."
    );
    return;
  }

  if (data === "help") {
    await sendMessage(chatId, "Telegram ichida web panelni ochish uchun Inventarni ochish tugmasini bosing.");
    return;
  }

  if (data === "home") {
    await showStart(chatId, callbackQuery.from);
    return;
  }

  if (data === "users:list") {
    await showStoreUsers(chatId, callbackQuery.from);
    return;
  }

  if (data.startsWith("user_delete:")) {
    const [, action, userIdText] = data.split(":");
    const userId = Number(userIdText);
    if (!["confirm", "delete"].includes(action) || !Number.isInteger(userId)) {
      await sendMessage(chatId, "Foydalanuvchini o'chirish amali noto'g'ri.");
      return;
    }

    if (action === "confirm") {
      await confirmDeleteStoreUser(chatId, callbackQuery.from, userId);
      return;
    }

    await deleteStoreUser(chatId, callbackQuery.from, userId);
    return;
  }

  if (data.startsWith("seller_request:")) {
    const [, action, requestIdText] = data.split(":");
    const requestId = Number(requestIdText);
    if (!["approve", "reject"].includes(action) || !Number.isInteger(requestId)) {
      await sendMessage(chatId, "Sotuvchi so'rovi amali noto'g'ri.");
      return;
    }

    await handleSellerRequestDecision(chatId, callbackQuery.from, action, requestId);
    return;
  }

  if (!data.startsWith("account:")) return;

  const session = sessions.get(chatId);
  if (!session || session.step !== "account_type") {
    await sendMessage(chatId, "Ro'yxatdan o'tishni boshlash uchun /start ni yuboring.");
    return;
  }

  const accountType = data.slice("account:".length);
  if (!["seller", "store_owner"].includes(accountType)) {
    await sendMessage(chatId, "Iltimos, Sotuvchi yoki Do'kon egasini tanlang.");
    return;
  }

  session.data.userRole = "seller";
  session.data.storeRole = accountType === "store_owner" ? "owner" : null;
  if (accountType === "store_owner") {
    session.step = "owner_store_name";
    sessions.set(chatId, session);
    await sendMessage(chatId, "Iltimos, do'kon nomini yuboring.");
    return;
  }

  session.step = "seller_store_name";
  sessions.set(chatId, session);
  await sendMessage(chatId, "Qaysi do'konda sotasiz? Iltimos, do'konning aniq nomini yuboring.");
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

  await sendMessage(chatId, "Inventar opsiyalarini ochish uchun /start ni yuboring.");
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
