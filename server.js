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
const passwordIterations = 120000;
const signupEnabled = process.env.SIGNUP_ENABLED === "true";

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
const IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(__dirname, "public"), { index: false }));

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
  response.setHeader("Set-Cookie", `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}

function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(8).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, passwordIterations, 20, "sha256").toString("hex");
  return `p2$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.startsWith("p2$")) return false;
  const [, salt, hash] = storedHash.split("$");
  if (!salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, passwordIterations, 20, "sha256").toString("hex");
  if (Buffer.byteLength(candidate) !== Buffer.byteLength(hash)) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

function parsePositiveNumber(value) {
  const number = Number(String(value ?? "").replace(/\./g, ""));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeRole(value) {
  return cleanText(value).toLowerCase() === "admin" || cleanText(value).toLowerCase() === "store_owner"
    ? "store_owner"
    : "customer";
}

function validatePhone(value) {
  const phone = cleanText(value);
  return /^\+?[0-9\s-]{7,15}$/.test(phone) ? phone : "";
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

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];

  return images
    .map((image) => ({
      name: cleanText(image.name),
      type: cleanText(image.type),
      data: cleanText(image.data)
    }))
    .filter((image) => image.data);
}

function normalizeOptionalImage(image) {
  if (!image || typeof image !== "object") return null;
  const normalized = {
    name: cleanText(image.name),
    type: cleanText(image.type),
    data: cleanText(image.data)
  };
  return normalized.data ? normalized : null;
}

async function saveImageFile(image) {
  if (!IMAGE_MIME_EXTENSIONS[image.type]) {
    throw new Error("Faqat JPG, PNG, WEBP va GIF rasmlarni yuklash mumkin.");
  }

  const prefix = `data:${image.type};base64,`;
  const base64 = image.data.startsWith(prefix) ? image.data.slice(prefix.length) : image.data;
  const buffer = Buffer.from(base64, "base64");

  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw new Error("Har bir rasm 5 MB yoki undan kichik bo'lishi kerak.");
  }

  const fileName = `${Date.now()}-${crypto.randomUUID()}${IMAGE_MIME_EXTENSIONS[image.type]}`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  await fs.promises.writeFile(filePath, buffer);
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
    const imagePath = await saveImageFile(image);

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
  if (stores.length) return defaultStoreId;

  const [owners] = await connection.execute("SELECT id FROM users WHERE phone_number = ? LIMIT 1", [defaultOwnerPhone]);
  let ownerId = owners[0]?.id;

  if (!ownerId) {
    const [ownerInsert] = await connection.execute(
      `INSERT INTO users (fname, lname, phone_number, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      ["Default", "Owner", defaultOwnerPhone, defaultPasswordHash, "store_owner"]
    );
    ownerId = ownerInsert.insertId;
  }

  await connection.execute(
    `INSERT INTO store (id, store_name, owner_id, is_active)
     VALUES (?, ?, ?, TRUE)`,
    [defaultStoreId, defaultStoreName, ownerId]
  );

  return defaultStoreId;
}

async function storeForUser(userId) {
  const [stores] = await pool.execute(
    "SELECT id, store_name AS storeName FROM store WHERE owner_id = ? AND is_active = TRUE ORDER BY id LIMIT 1",
    [userId]
  );
  return stores[0] || null;
}

async function requireAuth(request, response, next) {
  try {
    const session = readSession(request);
    if (!session) {
      response.status(401).json({ message: "Tizimga kiring." });
      return;
    }

    const [users] = await pool.execute(
      "SELECT id, fname, lname, phone_number AS phoneNumber, role FROM users WHERE id = ? LIMIT 1",
      [session.userId]
    );

    if (!users.length) {
      clearSessionCookie(response);
      response.status(401).json({ message: "Tizimga qayta kiring." });
      return;
    }

    request.user = users[0];
    request.store = request.user.role === "store_owner" || request.user.role === "admin" ? await storeForUser(request.user.id) : null;
    next();
  } catch (error) {
    next(error);
  }
}

function requireStoreOwner(request, response, next) {
  if (!request.user || !["store_owner", "admin"].includes(request.user.role)) {
    response.status(403).json({ message: "Bu sahifa faqat adminlar uchun." });
    return;
  }

  if (!request.store) {
    response.status(403).json({ message: "Avval do'kon ro'yxatdan o'tkazilishi kerak." });
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

async function fetchProduct(id, storeId = defaultStoreId) {
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
     GROUP BY
       p.id, p.art_no, p.name, st.type, p.landing_price, p.price, p.created_at, p.updated_at,
       pv.id, c.colour_name, m.material_type`,
    [storeId, id]
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
    inventory: inventoryRows,
    images: imageRows
  };
}

app.get("/", (request, response) => {
  const session = readSession(request);
  response.redirect(session ? "/inventory" : "/signin");
});

app.get("/signin", (request, response) => {
  const session = readSession(request);
  if (session) {
    response.redirect(session.role === "customer" ? "/customer" : "/inventory");
    return;
  }

  response.sendFile(path.join(__dirname, "public", "signin.html"));
});

app.get("/signup", (request, response) => {
  const session = readSession(request);
  if (session) {
    response.redirect(session.role === "customer" ? "/customer" : "/inventory");
    return;
  }

  if (!signupEnabled) {
    response.redirect("/signin");
    return;
  }

  response.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/signup/store", (_request, response) => {
  if (!signupEnabled) {
    response.redirect("/signin");
    return;
  }

  response.sendFile(path.join(__dirname, "public", "signup-store.html"));
});

app.get("/customer", (_request, response) => {
  response.sendFile(path.join(__dirname, "public", "customer.html"));
});

app.get("/inventory", (request, response) => {
  const session = readSession(request);
  if (!session) {
    response.redirect("/signin");
    return;
  }
  response.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({
    user: request.user,
    store: request.store
  });
});

app.post("/api/auth/signin", async (request, response, next) => {
  try {
    const phoneNumber = validatePhone(request.body.phoneNumber);
    const password = String(request.body.password || "");

    if (!phoneNumber || !password) {
      response.status(400).json({ message: "Telefon raqam va parol kiritilishi kerak." });
      return;
    }

    const [users] = await pool.execute(
      "SELECT id, fname, lname, phone_number AS phoneNumber, password_hash AS passwordHash, role FROM users WHERE phone_number = ? LIMIT 1",
      [phoneNumber]
    );

    const user = users[0];
    if (!user || !verifyPassword(password, user.passwordHash)) {
      response.status(401).json({ message: "Telefon raqam yoki parol noto'g'ri." });
      return;
    }

    setSessionCookie(response, user);
    const store = user.role === "store_owner" || user.role === "admin" ? await storeForUser(user.id) : null;
    const needsStoreRegistration = user.role !== "customer" && !store;
    response.json({
      redirectTo: user.role === "customer" ? "/customer" : needsStoreRegistration && signupEnabled ? "/signup/store" : "/inventory",
      user: { id: user.id, fname: user.fname, lname: user.lname, phoneNumber: user.phoneNumber, role: user.role },
      store
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/signout", (_request, response) => {
  clearSessionCookie(response);
  response.status(204).end();
});

app.post("/api/auth/signup", async (request, response, next) => {
  if (!signupEnabled) {
    response.status(403).json({ message: "Ro'yxatdan o'tish hozircha o'chirilgan." });
    return;
  }

  const fname = cleanText(request.body.fname);
  const lname = cleanText(request.body.lname);
  const phoneNumber = validatePhone(request.body.phoneNumber);
  const password = String(request.body.password || "");
  const passwordConfirm = String(request.body.passwordConfirm || "");
  const role = normalizeRole(request.body.role);

  if (!fname || !lname || fname.length > 20 || lname.length > 20) {
    response.status(400).json({ message: "Ism va familiya 1-20 belgidan iborat bo'lishi kerak." });
    return;
  }

  if (!phoneNumber) {
    response.status(400).json({ message: "Telefon raqam noto'g'ri." });
    return;
  }

  if (password.length < 8 || password !== passwordConfirm) {
    response.status(400).json({ message: "Parol kamida 8 belgi bo'lishi va takroriy parol bilan mos kelishi kerak." });
    return;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userInsert] = await connection.execute(
      `INSERT INTO users (fname, lname, phone_number, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      [fname, lname, phoneNumber, hashPassword(password), role]
    );

    let store = null;
    if (role === "store_owner") {
      const storeName = cleanText(request.body.storeName);
      const storePhoneNumber = validatePhone(request.body.storePhoneNumber);
      const description = cleanText(request.body.description);
      const telegramUsername = validateTelegramUsername(request.body.telegramUsername);
      const storeImage = normalizeOptionalImage(request.body.storeImage);

      if (!storeName || storeName.length > 50) {
        throw Object.assign(new Error("Do'kon nomi 1-50 belgidan iborat bo'lishi kerak."), { statusCode: 400 });
      }

      if (!storePhoneNumber) {
        throw Object.assign(new Error("Do'kon telefon raqami noto'g'ri."), { statusCode: 400 });
      }

      if (!telegramUsername) {
        throw Object.assign(new Error("Telegram username 5-32 belgi, harf/raqam/_ bo'lishi kerak."), { statusCode: 400 });
      }

      const imagePath = storeImage ? await saveImageFile(storeImage) : null;
      const [storeInsert] = await connection.execute(
        `INSERT INTO store (store_name, owner_id, is_active, store_image, phone_number, description, telegram_username)
         VALUES (?, ?, TRUE, ?, ?, ?, ?)`,
        [storeName, userInsert.insertId, imagePath, storePhoneNumber, description || null, telegramUsername]
      );
      store = { id: storeInsert.insertId, storeName };
    }

    await connection.commit();

    const user = { id: userInsert.insertId, fname, lname, phoneNumber, role };
    setSessionCookie(response, user);
    response.status(201).json({
      redirectTo: role === "customer" ? "/customer" : "/inventory",
      user,
      store
    });
  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }
    next(error);
  } finally {
    connection.release();
  }
});

app.get("/api/telegram/check", async (request, response) => {
  const username = validateTelegramUsername(request.query.username);
  if (!username) {
    response.status(400).json({ exists: false, message: "Telegram username formati noto'g'ri." });
    return;
  }

  try {
    const telegramResponse = await fetch(`https://t.me/${encodeURIComponent(username)}`, {
      method: "GET",
      redirect: "manual"
    });
    response.json({
      exists: telegramResponse.status >= 200 && telegramResponse.status < 400,
      checked: true,
      reliable: false
    });
  } catch (_error) {
    response.json({
      exists: false,
      checked: false,
      reliable: false,
      message: "Telegram tekshiruvi hozircha ishlamadi."
    });
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

    response.json({
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

app.get("/api/products", requireAuth, requireStoreOwner, async (request, response, next) => {
  try {
    const storeId = currentStoreId(request);
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
         GROUP_CONCAT(DISTINCT c.colour_name ORDER BY c.colour_name SEPARATOR ', ') AS colours,
         GROUP_CONCAT(DISTINCT m.material_type ORDER BY m.material_type SEPARATOR ', ') AS materials,
         GROUP_CONCAT(
           DISTINCT CASE WHEN i.quantity > 0 THEN CONCAT(i.size, 'x', i.quantity) END
           ORDER BY CAST(i.size AS UNSIGNED)
           SEPARATOR ', '
         ) AS availableSizes,
         COALESCE(SUM(i.quantity), 0) AS quantity
       FROM products p
       LEFT JOIN shoe_type st ON st.id = p.type_id
       INNER JOIN product_variant pv ON pv.product_id = p.id
       LEFT JOIN colours c ON c.id = pv.colour_id
       LEFT JOIN materials m ON m.id = pv.material_id
       INNER JOIN inventory i ON i.product_variant_id = pv.id AND i.store_id = ?
       GROUP BY p.id, p.art_no, p.name, st.type, p.landing_price, p.price, p.created_at, p.updated_at
       ORDER BY p.updated_at DESC, p.created_at DESC`,
      [storeId]
    );

    response.json(
      rows.map((row) => ({
        ...row,
        seasons: seasonsForClient(row.seasonValues)
      }))
    );
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
      response.json({ match: null });
      return;
    }

    const match = await findMatchingProductByText(artNo, colour, material);
    if (!match) {
      response.json({ match: null });
      return;
    }

    response.json({ match: await fetchProduct(match.productId, currentStoreId(request)) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:id", requireAuth, requireStoreOwner, async (request, response, next) => {
  try {
    const product = await fetchProduct(request.params.id, currentStoreId(request));
    if (!product) {
      response.status(404).json({ message: "Mahsulot topilmadi." });
      return;
    }
    response.json(product);
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", requireAuth, requireStoreOwner, async (request, response, next) => {
  const validation = validateProductPayload(request.body);
  if (validation.error) {
    response.status(400).json({ message: validation.error });
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

      response.json(await fetchProduct(existing.productId, storeId));
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

    response.status(201).json(await fetchProduct(productInsert.insertId, storeId));
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
    response.status(400).json({ message: validation.error });
    return;
  }

  const data = validation.product;
  const productId = Number(request.params.id);
  const storeId = currentStoreId(request);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[existing]] = await connection.execute(
      "SELECT p.id, pv.id AS variantId FROM products p LEFT JOIN product_variant pv ON pv.product_id = p.id WHERE p.id = ? LIMIT 1",
      [productId]
    );

    if (!existing) {
      await connection.rollback();
      response.status(404).json({ message: "Mahsulot topilmadi." });
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

    response.json(await fetchProduct(productId, storeId));
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
      response.status(404).json({ message: "Bu do'konda mahsulot topilmadi." });
      return;
    }

    response.status(204).end();
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    message: readableDatabaseError(error),
    detail: error.message
  });
});

function readableDatabaseError(error) {
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
    console.log(`Inventory app running at http://localhost:${port}`);
    console.log(`Phone access is available on this computer's network IP at port ${port}.`);
  } catch (error) {
    console.log(`Inventory app running at http://localhost:${port}`);
    console.error(`Database connection failed: ${error.message}`);
  }
});
