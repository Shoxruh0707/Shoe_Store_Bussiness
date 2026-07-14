require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const { pool, testConnection } = require("./src/db");

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const defaultStoreId = Number(process.env.DEFAULT_STORE_ID || 1);
const defaultBrandName = process.env.DEFAULT_BRAND_NAME || "Unbranded";
const defaultStoreName = process.env.DEFAULT_STORE_NAME || "Default Store";
const defaultOwnerPhone = process.env.DEFAULT_OWNER_PHONE || "+998000000001";
const defaultPasswordHash =
  process.env.DEFAULT_OWNER_PASSWORD_HASH || "$2b$10$0000000000000000000000000000000000000000000000000000";
const sessionSecret = process.env.SESSION_SECRET || "change-this-session-secret";
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || "";
const telegramAuthMaxAgeSeconds = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86400);
const apiAuthRequired = process.env.API_AUTH_REQUIRED !== "false";
const isProduction = process.env.NODE_ENV === "production";
const domain = cleanDomain(process.env.DOMAIN || "");
const publicUrl = normalizeUrl(
  process.env.PUBLIC_URL || process.env.FRONTEND_URL || (domain ? `https://${domain}` : "") || "http://localhost:3001"
);
const frontendUrl = publicUrl;
const sessionCookieSecure = process.env.SESSION_COOKIE_SECURE
  ? process.env.SESSION_COOKIE_SECURE === "true"
  : publicUrl.startsWith("https://");
const corsOrigins = buildCorsOrigins();

const SHOE_TYPES = [
  "Basanochka",
  "Tapochka",
  "Tufli",
  "Makasima",
  "Skechers",
  "Etik",
  "Krasovka",
  "Baletka"
];

const SEASONS = ["Summer", "Autumn", "Winter", "Spring"];
const SEASON_DB_VALUES = {
  Spring: "spring",
  Summer: "summer",
  Autumn: "autumn",
  Winter: "winter"
};
const SIZES = ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"];
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");
const TEMP_UPLOAD_DIR = path.join(UPLOAD_DIR, "temp");
const IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

function cleanDomain(value) {
  return String(value || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .trim();
}

function normalizeUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/$/, "");
}

function originFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch (_error) {
    return "";
  }
}

function originsFromDomains(value, includeHttp = false) {
  return String(value || "")
    .split(",")
    .map(cleanDomain)
    .filter(Boolean)
    .flatMap((hostName) => (includeHttp ? [`https://${hostName}`, `http://${hostName}`] : [`https://${hostName}`]));
}

function buildCorsOrigins() {
  const configuredOrigins = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map(normalizeUrl)
    .filter(Boolean);
  const defaultOrigins = [
    originFromUrl(publicUrl),
    ...originsFromDomains(process.env.DOMAIN, !isProduction),
    ...originsFromDomains(process.env.ADDITIONAL_DOMAINS, !isProduction)
  ];
  const localOrigins = isProduction
    ? []
    : ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"];

  return [...new Set([...configuredOrigins, ...defaultOrigins, ...localOrigins].filter(Boolean))];
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

const PAGE_PATHS = new Set(["/", "/inventory"]);

function decodePathSafely(value) {
  let decoded = value;

  for (let index = 0; index < 2; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch (_error) {
      break;
    }
  }

  return decoded;
}

function normalizePagePath(value) {
  const decodedPath = decodePathSafely(value);
  const normalizedPath = decodedPath.replace(/[\\\/\s]+$/g, "") || "/";
  return PAGE_PATHS.has(normalizedPath) ? normalizedPath : "";
}

app.use((request, response, next) => {
  const queryIndex = request.originalUrl.indexOf("?");
  const rawPath = queryIndex === -1 ? request.originalUrl : request.originalUrl.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : request.originalUrl.slice(queryIndex);
  const normalizedPath = normalizePagePath(rawPath);

  if (normalizedPath !== rawPath && PAGE_PATHS.has(normalizedPath)) {
    response.redirect(302, `${normalizedPath}${query}`);
    return;
  }

  next();
});

app.use(express.json({ limit: "25mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));

app.use((request, response, next) => {
  const origin = request.get("Origin");
  if (origin && corsOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Telegram-Init-Data");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  }

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
});

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseCookies(header = "") {
  return String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return cookies;
      const key = decodeURIComponent(part.slice(0, separatorIndex));
      const value = decodeURIComponent(part.slice(separatorIndex + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function signSession(payload) {
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", sessionSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function readSession(request) {
  const token = parseCookies(request.headers.cookie).session;
  if (!token || !token.includes(".")) return null;

  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", sessionSecret).update(body).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.userId || !payload.role) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

function setSessionCookie(response, user) {
  const token = signSession({
    userId: user.id,
    role: user.role,
    issuedAt: Date.now()
  });
  const secure = sessionCookieSecure ? "; Secure" : "";
  response.setHeader("Set-Cookie", `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`);
}

function clearSessionCookie(response) {
  const secure = sessionCookieSecure ? "; Secure" : "";
  response.setHeader("Set-Cookie", `session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

function parsePositiveNumber(value) {
  const number = Number(String(value ?? "").replace(/\./g, ""));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

// New sold-product feature code starts.
function parseNonNegativeDecimal(value) {
  const text = cleanText(value).replace(/,/g, ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;

  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
// New sold-product feature code ends.

function validatePhone(value) {
  const phone = cleanText(value);
  return /^\+?[0-9\s-]{7,20}$/.test(phone) ? phone : "";
}

function validateTelegramUsername(value) {
  const username = cleanText(value).replace(/^@/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(username) ? username : "";
}

function normalizeSeasons(seasons) {
  const source = Array.isArray(seasons) ? seasons : String(seasons || "").split(",");
  return [...new Set(source.map(cleanText).filter((season) => SEASONS.includes(season)))];
}

function seasonsForDatabase(seasons) {
  return normalizeSeasons(seasons).map((season) => SEASON_DB_VALUES[season]);
}

function seasonsForClient(value) {
  const seasons = String(value || "")
    .split(",")
    .map(cleanText)
    .filter(Boolean);

  if (seasons.some((season) => season.toLowerCase() === "all_season")) return [...SEASONS];

  return seasons
    .map((season) => Object.entries(SEASON_DB_VALUES).find(([, dbValue]) => dbValue === season.toLowerCase())?.[0])
    .filter(Boolean);
}

function normalizeInventoryRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      size: cleanText(row.size),
      quantity: Number(row.quantity || 0)
    }))
    .filter((row) => SIZES.includes(row.size) && Number.isInteger(row.quantity) && row.quantity >= 0);
}

function inventoryForClient(rows) {
  const quantitiesBySize = new Map(
    (Array.isArray(rows) ? rows : []).map((row) => [cleanText(row.size), Number(row.quantity || 0)])
  );

  return SIZES.map((size) => ({
    size: Number(size),
    quantity: quantitiesBySize.get(size) || 0
  }));
}

function apiData(response, data, statusCode = 200) {
  response.status(statusCode).json({ success: true, data });
}

function apiMessage(response, message, statusCode = 400) {
  response.status(statusCode).json({ success: false, error: message, message });
}

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];

  return images
    .map((image) => ({
      name: cleanText(image.name),
      type: cleanText(image.type),
      data: cleanText(image.data),
      tempId: cleanText(image.tempId),
      path: cleanText(image.path)
    }))
    .filter((image) => image.data || image.tempId);
}

function imageExtensionForType(type) {
  if (!IMAGE_MIME_EXTENSIONS[type]) {
    throw Object.assign(new Error("Faqat JPG, PNG, WEBP va GIF rasmlarni yuklash mumkin."), { statusCode: 400 });
  }
  return IMAGE_MIME_EXTENSIONS[type];
}

function imageBufferFromData(image) {
  const extension = imageExtensionForType(image.type);
  const prefix = `data:${image.type};base64,`;
  const base64 = image.data.startsWith(prefix) ? image.data.slice(prefix.length) : image.data;
  const buffer = Buffer.from(base64, "base64");

  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw Object.assign(new Error("Har bir rasm 5 MB yoki undan kichik bo'lishi kerak."), { statusCode: 413 });
  }

  return { buffer, extension };
}

async function saveImageFile(image) {
  const { buffer, extension } = imageBufferFromData(image);

  const fileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  await fs.promises.writeFile(filePath, buffer);
  return `/uploads/${fileName}`;
}

function tempUploadFilePath(tempId) {
  const safeTempId = cleanText(tempId);
  if (!/^[0-9]+-[0-9a-f-]+\.(jpg|png|webp|gif)$/i.test(safeTempId)) {
    throw Object.assign(new Error("Vaqtinchalik rasm topilmadi."), { statusCode: 400 });
  }
  return path.join(TEMP_UPLOAD_DIR, safeTempId);
}

async function saveTempImageFile(image) {
  const { buffer, extension } = imageBufferFromData(image);
  const tempId = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const filePath = path.join(TEMP_UPLOAD_DIR, tempId);
  await fs.promises.writeFile(filePath, buffer);
  return {
    tempId,
    path: `/uploads/temp/${tempId}`
  };
}

async function deleteTempImageFile(tempId) {
  try {
    await fs.promises.unlink(tempUploadFilePath(tempId));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function cleanupStaleTempUploads(maxAgeMs = 6 * 60 * 60 * 1000) {
  const now = Date.now();
  let entries = [];
  try {
    entries = await fs.promises.readdir(TEMP_UPLOAD_DIR, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(TEMP_UPLOAD_DIR, entry.name);
        try {
          const stats = await fs.promises.stat(filePath);
          if (now - stats.mtimeMs > maxAgeMs) {
            await fs.promises.unlink(filePath);
          }
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      })
  );
}

async function promoteTempImageFile(tempId) {
  const sourcePath = tempUploadFilePath(tempId);
  const extension = path.extname(sourcePath).toLowerCase();
  const fileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const destinationPath = path.join(UPLOAD_DIR, fileName);
  await fs.promises.rename(sourcePath, destinationPath);
  return `/uploads/${fileName}`;
}

function validateProductPayload(payload) {
  const artNo = cleanText(payload.artNo);
  const name = cleanText(payload.name);
  const type = cleanText(payload.type);
  const seasons = normalizeSeasons(payload.seasons);
  const price = parsePositiveNumber(payload.price);
  const landingPrice = parsePositiveNumber(payload.landingPrice);
  const colour = cleanText(payload.colour);
  const material = cleanText(payload.material);
  const inventory = normalizeInventoryRows(payload.inventory);
  const images = normalizeImages(payload.images);

  if (!artNo) return { error: "Artno kiritilishi kerak." };
  if (!SHOE_TYPES.includes(type)) return { error: "To'g'ri oyoq kiyim turini tanlang." };
  if (!seasons.length) return { error: "Kamida bitta mavsum tanlang." };
  if (price === null) return { error: "Narx musbat son bo'lishi kerak." };
  if (landingPrice === null) return { error: "Kelish narxi musbat son bo'lishi kerak." };
  if (!colour) return { error: "Rang kiritilishi kerak." };
  if (!material) return { error: "Material kiritilishi kerak." };

  return {
    product: {
      artNo,
      name,
      type,
      seasons,
      price,
      landingPrice,
      colour,
      material,
      inventory,
      images
    }
  };
}

async function saveProductImages(connection, variantId, images) {
  for (const image of images) {
    const imagePath = image.tempId ? await promoteTempImageFile(image.tempId) : await saveImageFile(image);

    await connection.execute("INSERT INTO product_images (product_variant_id, image_path) VALUES (?, ?)", [
      variantId,
      imagePath
    ]);
  }
}

async function removeArtNoUniqueIndexes() {
  const [indexes] = await pool.execute(
    `SELECT INDEX_NAME AS indexName
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'products'
       AND INDEX_NAME <> 'PRIMARY'
     GROUP BY INDEX_NAME
     HAVING MAX(NON_UNIQUE) = 0
        AND GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) = 'art_no'`
  );

  for (const index of indexes) {
    await pool.query(`ALTER TABLE products DROP INDEX \`${index.indexName.replace(/`/g, "``")}\``);
  }
}

// New sold-product feature code starts.
async function ensureSoldProductsTable() {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS sold_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL,
      user_id INT NOT NULL,
      product_variant_id INT NOT NULL,
      size ENUM('33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44') NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      sold_price DECIMAL(10,2) NOT NULL,
      landing_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT fk_sold_products_store
        FOREIGN KEY (store_id) REFERENCES store(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

      CONSTRAINT fk_sold_products_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

      CONSTRAINT fk_sold_products_variant
        FOREIGN KEY (product_variant_id) REFERENCES product_variant(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

      CONSTRAINT chk_sold_products_quantity
        CHECK (quantity > 0),

      CONSTRAINT chk_sold_products_price
        CHECK (sold_price >= 0),

      CONSTRAINT chk_sold_products_landing_price
        CHECK (landing_price >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  const [landingPriceColumns] = await pool.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'sold_products'
       AND COLUMN_NAME = 'landing_price'
     LIMIT 1`
  );

  if (!landingPriceColumns.length) {
    await pool.query(
      "ALTER TABLE sold_products ADD COLUMN landing_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER sold_price"
    );
  }

  const [landingPriceChecks] = await pool.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND CONSTRAINT_NAME = 'chk_sold_products_landing_price'
     LIMIT 1`
  );

  if (!landingPriceChecks.length) {
    await pool.query(
      "ALTER TABLE sold_products ADD CONSTRAINT chk_sold_products_landing_price CHECK (landing_price >= 0)"
    );
  }

  const indexes = [
    ["idx_sold_products_store_id", "store_id"],
    ["idx_sold_products_user_id", "user_id"],
    ["idx_sold_products_product_variant_id", "product_variant_id"],
    ["idx_sold_products_sold_at", "sold_at"]
  ];

  for (const [indexName, columnName] of indexes) {
    const [existing] = await pool.execute(
      `SELECT 1
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'sold_products'
         AND INDEX_NAME = ?
       LIMIT 1`,
      [indexName]
    );

    if (!existing.length) {
      await pool.query(`CREATE INDEX \`${indexName}\` ON sold_products(\`${columnName}\`)`);
    }
  }
}

function validateSoldProductPayload(payload) {
  const artNo = cleanText(payload?.art_no);
  const colourName = cleanText(payload?.colour_name);
  const materialType = cleanText(payload?.material_type);
  const size = cleanText(payload?.size);
  const soldPrice = parseNonNegativeDecimal(payload?.sold_price);
  const quantity = Number(payload?.quantity || 1);

  if (!artNo) return { error: "Art number is required." };
  if (!colourName) return { error: "Color is required." };
  if (!materialType) return { error: "Material type is required." };
  if (!SIZES.includes(size)) return { error: "Valid size is required." };
  if (soldPrice === null) return { error: "Sold price must be a valid number greater than or equal to 0." };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Quantity sold must be a positive whole number." };

  return {
    sale: {
      artNo,
      colourName,
      materialType,
      size,
      soldPrice,
      quantity
    }
  };
}

function normalizeSoldProductsDate(value) {
  const date = cleanText(value);
  if (!date) return new Date().toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

async function userIdForSale(connection, request) {
  if (request.user?.id) return request.user.id;

  const [owners] = await connection.execute("SELECT id FROM users WHERE phone_number = ? LIMIT 1", [defaultOwnerPhone]);
  if (owners.length) return owners[0].id;

  await ensureDefaultStore(connection);
  const [createdOwners] = await connection.execute("SELECT id FROM users WHERE phone_number = ? LIMIT 1", [
    defaultOwnerPhone
  ]);
  return createdOwners[0]?.id || request.user?.id;
}
// New sold-product feature code ends.

async function getOrCreateLookup(connection, table, idColumn, valueColumn, value) {
  const [existing] = await connection.execute(
    `SELECT ${idColumn} AS id FROM ${table} WHERE ${valueColumn} = ? LIMIT 1`,
    [value]
  );

  if (existing.length) return existing[0].id;

  const [inserted] = await connection.execute(`INSERT INTO ${table} (${valueColumn}) VALUES (?)`, [value]);
  return inserted.insertId;
}

async function ensureDefaultStore(connection) {
  const [stores] = await connection.execute("SELECT id FROM store WHERE id = ? LIMIT 1", [defaultStoreId]);
  if (!stores.length) {
    await connection.execute(
      `INSERT INTO store (id, store_name, is_active)
       VALUES (?, ?, TRUE)`,
      [defaultStoreId, defaultStoreName]
    );
  }

  const [owners] = await connection.execute("SELECT id FROM users WHERE phone_number = ? LIMIT 1", [defaultOwnerPhone]);
  let ownerId = owners[0]?.id;

  if (!ownerId) {
    const [ownerInsert] = await connection.execute(
      `INSERT INTO users (fname, lname, phone_number, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      ["Default", "Owner", defaultOwnerPhone, defaultPasswordHash, "seller"]
    );
    ownerId = ownerInsert.insertId;
  }

  await connection.execute(
    `INSERT IGNORE INTO store_users (user_id, store_id, role)
     VALUES (?, ?, 'owner')`,
    [ownerId, defaultStoreId]
  );

  return defaultStoreId;
}

async function storeForUser(userId) {
  const [stores] = await pool.execute(
    `SELECT
       s.id,
       s.store_name AS storeName,
       su.role AS storeRole
     FROM store_users su
     INNER JOIN store s ON s.id = su.store_id
     WHERE su.user_id = ?
       AND s.is_active = TRUE
     ORDER BY FIELD(su.role, 'owner', 'manager', 'staff'), s.id
     LIMIT 1`,
    [userId]
  );
  return stores[0] || null;
}

function verifyTelegramInitData(initData) {
  if (!telegramBotToken) {
    throw Object.assign(new Error("TELEGRAM_BOT_TOKEN sozlanmagan."), { statusCode: 500 });
  }

  const params = new URLSearchParams(String(initData || ""));
  const receivedHash = params.get("hash");
  if (!receivedHash) {
    throw Object.assign(new Error("Telegram initData hash topilmadi."), { statusCode: 401 });
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(telegramBotToken).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (
    Buffer.byteLength(receivedHash) !== Buffer.byteLength(calculatedHash) ||
    !crypto.timingSafeEqual(Buffer.from(receivedHash), Buffer.from(calculatedHash))
  ) {
    throw Object.assign(new Error("Telegram imzosi noto'g'ri."), { statusCode: 401 });
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > telegramAuthMaxAgeSeconds) {
    throw Object.assign(new Error("Telegram sessiyasi eskirgan. Botdan qayta oching."), { statusCode: 401 });
  }

  let telegramUser = {};
  try {
    telegramUser = JSON.parse(params.get("user") || "{}");
  } catch (_error) {
    throw Object.assign(new Error("Telegram foydalanuvchi ma'lumoti noto'g'ri."), { statusCode: 401 });
  }
  if (!telegramUser.id) {
    throw Object.assign(new Error("Telegram foydalanuvchi ma'lumoti topilmadi."), { statusCode: 401 });
  }

  return {
    id: Number(telegramUser.id),
    username: cleanText(telegramUser.username),
    firstName: cleanText(telegramUser.first_name),
    lastName: cleanText(telegramUser.last_name),
    photoUrl: cleanText(telegramUser.photo_url)
  };
}

async function userForTelegramId(telegramId) {
  const [users] = await pool.execute(
    `SELECT
       id,
       fname,
       lname,
       phone_number AS phoneNumber,
       role,
       telegram_id AS telegramId
     FROM users
     WHERE telegram_id = ?
     LIMIT 1`,
    [telegramId]
  );
  return users[0] || null;
}

async function hydrateAuthenticatedUser(user, response) {
  if (response) setSessionCookie(response, user);
  return {
    user,
    store: ["admin", "seller"].includes(user.role) ? await storeForUser(user.id) : null
  };
}

async function requireAuth(request, response, next) {
  try {
    if (!apiAuthRequired) {
      request.user = {
        id: 0,
        fname: "Development",
        lname: "User",
        phoneNumber: defaultOwnerPhone,
        role: "admin"
      };
      request.store = { id: defaultStoreId, storeName: defaultStoreName };
      next();
      return;
    }

    const session = readSession(request);
    let userId = session?.userId;

    if (!userId) {
      const initData = request.get("X-Telegram-Init-Data");
      if (initData) {
        const telegramUser = verifyTelegramInitData(initData);
        const telegramAccount = await userForTelegramId(telegramUser.id);
        userId = telegramAccount?.id;
      }
    }

    if (!userId) {
      apiMessage(response, "Telegram orqali botdan qayta kiring.", 401);
      return;
    }

    const [users] = await pool.execute(
      "SELECT id, fname, lname, phone_number AS phoneNumber, role FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (!users.length) {
      clearSessionCookie(response);
      apiMessage(response, "Tizimga qayta kiring.", 401);
      return;
    }

    request.user = users[0];
    request.store = ["admin", "seller"].includes(request.user.role) ? await storeForUser(request.user.id) : null;
    next();
  } catch (error) {
    next(error);
  }
}

function requireStoreOwner(request, response, next) {
  if (!request.user || !["admin", "seller"].includes(request.user.role)) {
    apiMessage(response, "Bu sahifa faqat adminlar uchun.", 403);
    return;
  }

  if (!request.store) {
    apiMessage(response, "Avval do'kon ro'yxatdan o'tkazilishi kerak.", 403);
    return;
  }

  next();
}

function currentStoreId(request) {
  return request.store?.id || defaultStoreId;
}

async function writeInventoryRows(connection, variantId, price, inventory, storeId) {
  await connection.execute("DELETE FROM inventory WHERE product_variant_id = ? AND store_id = ?", [variantId, storeId]);

  const rowsToInsert = inventory.filter((row) => row.quantity > 0);
  if (rowsToInsert.length && storeId === defaultStoreId) {
    await ensureDefaultStore(connection);
  }

  for (const row of rowsToInsert) {
    await connection.execute(
      "INSERT INTO inventory (product_variant_id, size, quantity, store_id, price) VALUES (?, ?, ?, ?, ?)",
      [variantId, row.size, row.quantity, storeId, price]
    );
  }
}

async function writeProductSeasons(connection, productId, seasons) {
  await connection.execute("DELETE FROM product_seasons WHERE product_id = ?", [productId]);

  for (const season of seasonsForDatabase(seasons)) {
    await connection.execute("INSERT INTO product_seasons (product_id, season) VALUES (?, ?)", [productId, season]);
  }
}

async function addInventoryRows(connection, variantId, price, inventory, storeId) {
  const rowsToAdd = inventory.filter((row) => row.quantity > 0);
  if (!rowsToAdd.length) return;

  if (storeId === defaultStoreId) {
    await ensureDefaultStore(connection);
  }

  for (const row of rowsToAdd) {
    const [updated] = await connection.execute(
      `UPDATE inventory
       SET quantity = quantity + ?, price = ?
       WHERE product_variant_id = ? AND store_id = ? AND size = ?`,
      [row.quantity, price, variantId, storeId, row.size]
    );

    if (!updated.affectedRows) {
      await connection.execute(
        "INSERT INTO inventory (product_variant_id, size, quantity, store_id, price) VALUES (?, ?, ?, ?, ?)",
        [variantId, row.size, row.quantity, storeId, price]
      );
    }
  }
}

async function findMatchingProductVariant(connection, data, colourId, materialId) {
  const [matches] = await connection.execute(
    `SELECT p.id AS productId, pv.id AS variantId
     FROM products p
     INNER JOIN product_variant pv ON pv.product_id = p.id
     WHERE p.art_no = ?
       AND pv.colour_id = ?
       AND pv.material_id = ?
     ORDER BY p.updated_at DESC, p.created_at DESC
     LIMIT 1`,
    [data.artNo, colourId, materialId]
  );

  return matches[0] || null;
}

async function findProductByArtNo(connection, artNo) {
  const [matches] = await connection.execute(
    `SELECT p.id AS productId
     FROM products p
     WHERE p.art_no = ?
     ORDER BY p.updated_at DESC, p.created_at DESC
     LIMIT 1`,
    [artNo]
  );

  return matches[0] || null;
}

async function findMatchingProductByText(artNo, colour, material) {
  const [matches] = await pool.execute(
    `SELECT p.id AS productId
     FROM products p
     INNER JOIN product_variant pv ON pv.product_id = p.id
     INNER JOIN colours c ON c.id = pv.colour_id
     INNER JOIN materials m ON m.id = pv.material_id
     WHERE p.art_no = ?
       AND c.colour_name = ?
       AND m.material_type = ?
     ORDER BY p.updated_at DESC, p.created_at DESC
     LIMIT 1`,
    [artNo, colour, material]
  );

  return matches[0] || null;
}

async function fetchProductLookupByArtNo(artNo, storeId = defaultStoreId) {
  const [rows] = await pool.execute(
    `SELECT
       p.id,
       p.art_no AS artNo,
       p.name,
       st.type,
       (SELECT GROUP_CONCAT(ps.season ORDER BY ps.season SEPARATOR ',')
        FROM product_seasons ps
        WHERE ps.product_id = p.id) AS seasonValues,
       p.landing_price AS landingPrice,
       p.price,
       pv.id AS variantId,
       c.colour_name AS colour,
       m.material_type AS material,
       COALESCE(SUM(i.quantity), 0) AS quantity
     FROM products p
     LEFT JOIN shoe_type st ON st.id = p.type_id
     LEFT JOIN product_variant pv ON pv.product_id = p.id
     LEFT JOIN colours c ON c.id = pv.colour_id
     LEFT JOIN materials m ON m.id = pv.material_id
     LEFT JOIN inventory i ON i.product_variant_id = pv.id AND i.store_id = ?
     WHERE p.art_no = ?
     GROUP BY
       p.id, p.art_no, p.name, st.type, p.landing_price, p.price,
       pv.id, c.colour_name, m.material_type
     ORDER BY p.updated_at DESC, p.created_at DESC, pv.updated_at DESC, pv.created_at DESC`,
    [storeId, artNo]
  );

  if (!rows.length) return null;

  const product = rows[0];
  const variants = rows
    .filter((row) => row.variantId)
    .map((row) => ({
      productId: row.id,
      variantId: row.variantId,
      colour: row.colour,
      material: row.material,
      quantity: Number(row.quantity || 0)
    }));

  return {
    product: {
      id: product.id,
      artNo: product.artNo,
      name: product.name,
      type: product.type,
      seasons: seasonsForClient(product.seasonValues),
      landingPrice: product.landingPrice,
      price: product.price
    },
    colours: [...new Set(variants.map((variant) => variant.colour).filter(Boolean))],
    materials: [...new Set(variants.map((variant) => variant.material).filter(Boolean))],
    variants
  };
}

async function fetchProduct(id, storeId = defaultStoreId, variantId = null) {
  const variantFilter = variantId ? "AND pv.id = ?" : "";
  const params = variantId ? [storeId, id, variantId] : [storeId, id];
  const [rows] = await pool.execute(
    `SELECT
       p.id,
       p.art_no AS artNo,
       p.name,
       st.type,
       (SELECT GROUP_CONCAT(ps.season ORDER BY ps.season SEPARATOR ',')
        FROM product_seasons ps
       WHERE ps.product_id = p.id) AS seasonValues,
       p.landing_price AS landingPrice,
       p.price,
       p.created_at AS createdAt,
       p.updated_at AS updatedAt,
       pv.id AS variantId,
       c.colour_name AS colour,
       m.material_type AS material,
       COALESCE(SUM(i.quantity), 0) AS quantity
     FROM products p
     LEFT JOIN shoe_type st ON st.id = p.type_id
     LEFT JOIN product_variant pv ON pv.product_id = p.id
     LEFT JOIN colours c ON c.id = pv.colour_id
     LEFT JOIN materials m ON m.id = pv.material_id
     LEFT JOIN inventory i ON i.product_variant_id = pv.id AND i.store_id = ?
     WHERE p.id = ?
       ${variantFilter}
     GROUP BY
       p.id, p.art_no, p.name, st.type, p.landing_price, p.price, p.created_at, p.updated_at,
       pv.id, c.colour_name, m.material_type`,
    params
  );

  if (!rows.length) return null;

  const product = rows[0];
  const [inventoryRows] = await pool.execute(
    "SELECT size, quantity FROM inventory WHERE product_variant_id = ? AND store_id = ? ORDER BY size",
    [product.variantId, storeId]
  );
  const [imageRows] = await pool.execute(
    "SELECT id, image_path AS path FROM product_images WHERE product_variant_id = ? ORDER BY id",
    [product.variantId]
  );

  return {
    ...product,
    seasons: seasonsForClient(product.seasonValues),
    inventory: inventoryForClient(inventoryRows),
    images: imageRows
  };
}

app.get("/", (_request, response) => {
  response.redirect(`${frontendUrl}/inventory`);
});

app.get("/inventory", (_request, response) => {
  response.redirect(`${frontendUrl}/inventory`);
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({
    user: request.user,
    store: request.store
  });
});

app.post("/api/auth/signout", (_request, response) => {
  clearSessionCookie(response);
  response.status(204).end();
});

app.post("/api/telegram/auth", async (request, response, next) => {
  try {
    const telegramUser = verifyTelegramInitData(request.body.initData);
    const user = await userForTelegramId(telegramUser.id);

    if (!user) {
      response.status(403).json({
        registered: false,
        message: "Avval Telegram bot orqali ro'yxatdan o'ting."
      });
      return;
    }

    const auth = await hydrateAuthenticatedUser(user, response);
    response.json({ registered: true, ...auth });
  } catch (error) {
    if (error.statusCode) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }
    next(error);
  }
});

app.get("/api/health", async (_request, response) => {
  try {
    await testConnection();
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message });
  }
});

app.get("/api/meta", requireAuth, requireStoreOwner, async (_request, response, next) => {
  try {
    const [colours] = await pool.execute("SELECT colour_name AS colour FROM colours ORDER BY colour_name");
    const [materials] = await pool.execute("SELECT material_type AS material FROM materials ORDER BY material_type");

    apiData(response, {
      types: SHOE_TYPES,
      shoeTypes: SHOE_TYPES,
      seasons: SEASONS,
      sizes: SIZES,
      colours: colours.map((row) => row.colour),
      materials: materials.map((row) => row.material)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/uploads/temp", requireAuth, requireStoreOwner, async (request, response, next) => {
  try {
    const image = normalizeImages([request.body?.image])[0];
    if (!image?.data) {
      apiMessage(response, "Rasm yuklash uchun fayl tanlang.", 400);
      return;
    }

    apiData(response, await saveTempImageFile(image), 201);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/uploads/temp/:tempId", requireAuth, requireStoreOwner, async (request, response, next) => {
  try {
    await deleteTempImageFile(request.params.tempId);
    apiData(response, { deleted: true });
  } catch (error) {
    next(error);
  }
});

// New sold-product feature code starts.
app.post("/api/inventory/sold", requireAuth, requireStoreOwner, async (request, response, next) => {
  const validation = validateSoldProductPayload(request.body);
  if (validation.error) {
    apiMessage(response, validation.error, 400);
    return;
  }

  const sale = validation.sale;
  const storeId = currentStoreId(request);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [matches] = await connection.execute(
      `SELECT
         p.id AS productId,
         p.landing_price AS landingPrice,
         pv.id AS productVariantId,
         i.id AS inventoryId,
         i.quantity
       FROM products p
       INNER JOIN product_variant pv ON pv.product_id = p.id
       INNER JOIN colours c ON c.id = pv.colour_id
       INNER JOIN materials m ON m.id = pv.material_id
       INNER JOIN inventory i ON i.product_variant_id = pv.id
       WHERE p.art_no = ?
         AND c.colour_name = ?
         AND m.material_type = ?
         AND i.size = ?
         AND i.store_id = ?
       ORDER BY p.updated_at DESC, p.created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [sale.artNo, sale.colourName, sale.materialType, sale.size, storeId]
    );

    const match = matches[0];
    if (!match) {
      await connection.rollback();
      apiMessage(response, "Product not found in inventory", 404);
      return;
    }

    if (Number(match.quantity || 0) < sale.quantity) {
      await connection.rollback();
      apiMessage(response, "Not enough quantity in inventory", 400);
      return;
    }

    const saleUserId = await userIdForSale(connection, request);
    if (!saleUserId) {
      await connection.rollback();
      apiMessage(response, "Valid seller user was not found for sale history", 403);
      return;
    }

    await connection.execute(
      `INSERT INTO sold_products
         (store_id, user_id, product_variant_id, size, quantity, sold_price, landing_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [storeId, saleUserId, match.productVariantId, sale.size, sale.quantity, sale.soldPrice, match.landingPrice]
    );

    const remainingQuantity = Number(match.quantity) - sale.quantity;
    if (remainingQuantity > 0) {
      await connection.execute("UPDATE inventory SET quantity = ?, updated_at = NOW() WHERE id = ?", [
        remainingQuantity,
        match.inventoryId
      ]);
    } else {
      await connection.execute("DELETE FROM inventory WHERE id = ?", [match.inventoryId]);
    }

    await connection.execute("UPDATE product_variant SET updated_at = NOW() WHERE id = ?", [match.productVariantId]);
    await connection.execute("UPDATE products SET updated_at = NOW() WHERE id = ?", [match.productId]);
    await connection.commit();

    response.json({
      success: true,
      message: "Product marked as sold successfully",
      remaining_quantity: remainingQuantity
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.get("/api/sold-products", requireAuth, requireStoreOwner, async (request, response, next) => {
  try {
    const saleDate = normalizeSoldProductsDate(request.query.date);
    if (!saleDate) {
      apiMessage(response, "Valid date is required.", 400);
      return;
    }

    const [rows] = await pool.execute(
      `SELECT
         sp.id,
         sp.size,
         sp.quantity,
         sp.sold_price AS soldPrice,
         sp.landing_price AS landingPrice,
         sp.sold_at AS soldAt,
         p.art_no AS artNo,
         p.name,
         c.colour_name AS colour,
         m.material_type AS material,
         (
           SELECT pi.image_path
           FROM product_images pi
           WHERE pi.product_variant_id = pv.id
           ORDER BY pi.id
           LIMIT 1
         ) AS imagePath
       FROM sold_products sp
       INNER JOIN product_variant pv ON pv.id = sp.product_variant_id
       INNER JOIN products p ON p.id = pv.product_id
       INNER JOIN colours c ON c.id = pv.colour_id
       INNER JOIN materials m ON m.id = pv.material_id
       WHERE sp.store_id = ?
         AND sp.sold_at >= ?
         AND sp.sold_at < DATE_ADD(?, INTERVAL 1 DAY)
       ORDER BY sp.sold_at DESC, sp.id DESC`,
      [currentStoreId(request), saleDate, saleDate]
    );

    apiData(response, {
      date: saleDate,
      items: rows.map((row) => ({
        ...row,
        quantity: Number(row.quantity || 0),
        soldPrice: Number(row.soldPrice || 0),
        landingPrice: Number(row.landingPrice || 0)
      }))
    });
  } catch (error) {
    next(error);
  }
});
// New sold-product feature code ends.

app.get("/api/products", requireAuth, requireStoreOwner, async (request, response, next) => {
  try {
    const storeId = currentStoreId(request);
    const [rows] = await pool.execute(
      `SELECT
         p.id,
         pv.id AS variantId
       FROM products p
       INNER JOIN product_variant pv ON pv.product_id = p.id
       LEFT JOIN inventory i ON i.product_variant_id = pv.id AND i.store_id = ?
       GROUP BY p.id, pv.id
       ORDER BY p.updated_at DESC, p.created_at DESC, pv.updated_at DESC, pv.created_at DESC`,
      [storeId]
    );

    const products = (await Promise.all(rows.map((row) => fetchProduct(row.id, storeId, row.variantId)))).filter(Boolean);
    apiData(response, products);
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/match", requireAuth, requireStoreOwner, async (request, response, next) => {
  try {
    const artNo = cleanText(request.query.artNo);
    const colour = cleanText(request.query.colour);
    const material = cleanText(request.query.material);

    if (!artNo || !colour || !material) {
      apiData(response, []);
      return;
    }

    const match = await findMatchingProductByText(artNo, colour, material);
    if (!match) {
      apiData(response, []);
      return;
    }

    apiData(response, [await fetchProduct(match.productId, currentStoreId(request))].filter(Boolean));
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/lookup", requireAuth, requireStoreOwner, async (request, response, next) => {
  try {
    const artNo = cleanText(request.query.artNo);

    if (!artNo) {
      apiData(response, null);
      return;
    }

    apiData(response, await fetchProductLookupByArtNo(artNo, currentStoreId(request)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:id", requireAuth, requireStoreOwner, async (request, response, next) => {
  try {
    const product = await fetchProduct(request.params.id, currentStoreId(request));
    if (!product) {
      apiMessage(response, "Mahsulot topilmadi.", 404);
      return;
    }
    apiData(response, product);
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", requireAuth, requireStoreOwner, async (request, response, next) => {
  const validation = validateProductPayload(request.body);
  if (validation.error) {
    apiMessage(response, validation.error, 400);
    return;
  }

  const data = validation.product;
  const storeId = currentStoreId(request);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const brandId = await getOrCreateLookup(connection, "brands", "id", "brand_name", defaultBrandName);
    const typeId = await getOrCreateLookup(connection, "shoe_type", "id", "type", data.type);
    const colourId = await getOrCreateLookup(connection, "colours", "id", "colour_name", data.colour);
    const materialId = await getOrCreateLookup(connection, "materials", "id", "material_type", data.material);
    const existing = await findMatchingProductVariant(connection, data, colourId, materialId);

    if (existing) {
      await addInventoryRows(connection, existing.variantId, data.price, data.inventory, storeId);
      await saveProductImages(connection, existing.variantId, data.images);
      await connection.execute("UPDATE products SET updated_at = NOW() WHERE id = ?", [existing.productId]);
      await connection.execute("UPDATE product_variant SET updated_at = NOW() WHERE id = ?", [existing.variantId]);
      await connection.commit();

      apiData(response, {
        ...(await fetchProduct(existing.productId, storeId, existing.variantId)),
        inventoryIncremented: true
      });
      return;
    }

    const existingProduct = await findProductByArtNo(connection, data.artNo);
    if (existingProduct) {
      const [variantInsert] = await connection.execute(
        "INSERT INTO product_variant (product_id, colour_id, material_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
        [existingProduct.productId, colourId, materialId]
      );

      await connection.execute(
        `UPDATE products
         SET name = ?, type_id = ?, landing_price = ?, price = ?, updated_at = NOW()
         WHERE id = ?`,
        [data.name || data.artNo, typeId, data.landingPrice, data.price, existingProduct.productId]
      );
      await writeProductSeasons(connection, existingProduct.productId, data.seasons);
      await writeInventoryRows(connection, variantInsert.insertId, data.price, data.inventory, storeId);
      await saveProductImages(connection, variantInsert.insertId, data.images);
      await connection.commit();

      apiData(response, await fetchProduct(existingProduct.productId, storeId, variantInsert.insertId), 201);
      return;
    }

    const [productInsert] = await connection.execute(
      `INSERT INTO products (art_no, name, brand_id, type_id, landing_price, price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [data.artNo, data.name || data.artNo, brandId, typeId, data.landingPrice, data.price]
    );

    const [variantInsert] = await connection.execute(
      "INSERT INTO product_variant (product_id, colour_id, material_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
      [productInsert.insertId, colourId, materialId]
    );

    await writeProductSeasons(connection, productInsert.insertId, data.seasons);
    await writeInventoryRows(connection, variantInsert.insertId, data.price, data.inventory, storeId);
    await saveProductImages(connection, variantInsert.insertId, data.images);
    await connection.commit();

    apiData(response, await fetchProduct(productInsert.insertId, storeId), 201);
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.put("/api/products/:id", requireAuth, requireStoreOwner, async (request, response, next) => {
  const validation = validateProductPayload(request.body);
  if (validation.error) {
    apiMessage(response, validation.error, 400);
    return;
  }

  const data = validation.product;
  const productId = Number(request.params.id);
  const storeId = currentStoreId(request);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const requestedVariantId = Number(request.body?.variantId || 0);
    const existingParams = requestedVariantId ? [productId, requestedVariantId] : [productId];
    const [[existing]] = await connection.execute(
      `SELECT p.id, pv.id AS variantId
       FROM products p
       LEFT JOIN product_variant pv ON pv.product_id = p.id
       WHERE p.id = ?
         ${requestedVariantId ? "AND pv.id = ?" : ""}
       ORDER BY pv.updated_at DESC, pv.created_at DESC
       LIMIT 1`,
      existingParams
    );

    if (!existing) {
      await connection.rollback();
      apiMessage(response, "Mahsulot topilmadi.", 404);
      return;
    }

    const brandId = await getOrCreateLookup(connection, "brands", "id", "brand_name", defaultBrandName);
    const typeId = await getOrCreateLookup(connection, "shoe_type", "id", "type", data.type);
    const colourId = await getOrCreateLookup(connection, "colours", "id", "colour_name", data.colour);
    const materialId = await getOrCreateLookup(connection, "materials", "id", "material_type", data.material);

    await connection.execute(
      `UPDATE products
       SET art_no = ?, name = ?, brand_id = ?, type_id = ?, landing_price = ?, price = ?, updated_at = NOW()
       WHERE id = ?`,
      [data.artNo, data.name || data.artNo, brandId, typeId, data.landingPrice, data.price, productId]
    );

    let variantId = existing.variantId;
    if (variantId) {
      await connection.execute(
        "UPDATE product_variant SET colour_id = ?, material_id = ?, updated_at = NOW() WHERE id = ?",
        [colourId, materialId, variantId]
      );
    } else {
      const [variantInsert] = await connection.execute(
        "INSERT INTO product_variant (product_id, colour_id, material_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
        [productId, colourId, materialId]
      );
      variantId = variantInsert.insertId;
    }

    await writeProductSeasons(connection, productId, data.seasons);
    await writeInventoryRows(connection, variantId, data.price, data.inventory, storeId);
    await saveProductImages(connection, variantId, data.images);
    await connection.commit();

    apiData(response, await fetchProduct(productId, storeId, variantId));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.delete("/api/products/:id", requireAuth, requireStoreOwner, async (request, response, next) => {
  const productId = Number(request.params.id);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [variants] = await connection.execute("SELECT id FROM product_variant WHERE product_id = ?", [productId]);
    const variantIds = variants.map((row) => row.id);
    let deletedRows = 0;

    for (const variantId of variantIds) {
      const [deleted] = await connection.execute(
        "DELETE FROM inventory WHERE product_variant_id = ? AND store_id = ?",
        [variantId, currentStoreId(request)]
      );
      deletedRows += deleted.affectedRows;
    }

    await connection.commit();

    if (!deletedRows) {
      apiMessage(response, "Bu do'konda mahsulot topilmadi.", 404);
      return;
    }

    apiData(response, { id: productId });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  const statusCode = error.statusCode || (error.type === "entity.too.large" ? 413 : 500);
  response.status(statusCode).json({
    success: false,
    error: readableDatabaseError(error),
    message: readableDatabaseError(error),
    detail: error.message
  });
});

function readableDatabaseError(error) {
  if (error.statusCode && error.message) {
    return error.message;
  }

  if (error.type === "entity.too.large") {
    return "Yuklangan rasmlar juda katta. Rasmlarni bittalab yuklang yoki hajmini kamaytiring.";
  }

  if (error.code === "ER_DUP_ENTRY") {
    return "Bu qiymat allaqachon mavjud. Artno takrorlanishi mumkin, lekin bazada eski unique index qolgan bo'lishi mumkin.";
  }

  if (error.code === "ER_NO_REFERENCED_ROW_2" && String(error.message).includes("fk_inventory_store")) {
    return "Ombor uchun to'g'ri do'kon kerak. Ilova DEFAULT_STORE_ID ni topa yoki yarata olmadi.";
  }

  if (error.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD" || error.code === "WARN_DATA_TRUNCATED") {
    return "Maydonlardan biri baza turi yoki enum qiymatiga mos emas.";
  }

  return "Server xatosi. Baza ulanishi va jadval tuzilishini tekshiring.";
}

app.listen(port, host, async () => {
  try {
    await testConnection();
    await removeArtNoUniqueIndexes();
    await ensureSoldProductsTable();
    await cleanupStaleTempUploads();
    setInterval(() => {
      cleanupStaleTempUploads().catch((error) => {
        console.error(`Temporary upload cleanup failed: ${error.message}`);
      });
    }, 60 * 60 * 1000).unref();
    console.log(`Inventory app running at http://localhost:${port}`);
    console.log(`Phone access is available on this computer's network IP at port ${port}.`);
  } catch (error) {
    console.log(`Inventory app running at http://localhost:${port}`);
    console.error(`Database connection failed: ${error.message}`);
  }
});
