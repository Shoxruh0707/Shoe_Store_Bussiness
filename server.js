require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
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
const REMBG_UPLOAD_DIR = path.join(UPLOAD_DIR, "rembg");
const rembgEnabled = process.env.REMBG_ENABLED !== "false";
const defaultRembgPython = process.platform === "win32"
  ? path.join(".venv", "Scripts", "python.exe")
  : path.join(".venv", "bin", "python");
const rembgScript = cleanText(process.env.REMBG_SCRIPT || path.join("scripts", "remove_background.py"));
const rembgTimeoutMs = Number(process.env.REMBG_TIMEOUT_MS || 120000);
const rembgResolution = rembgEnabled ? resolveRembgPython() : { python: "", diagnostics: [] };
const rembgPython = rembgResolution.python;
const rembgScriptPath = rembgScript ? projectPath(rembgScript) : "";
const rembgScriptExists = Boolean(rembgScriptPath) && fs.existsSync(rembgScriptPath);
const rembgAvailable = rembgEnabled && Boolean(rembgPython) && rembgScriptExists;
const IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

if (rembgEnabled && !rembgAvailable) {
  const details = [
    `REMBG_PYTHON=${process.env.REMBG_PYTHON || "(auto)"}`,
    `resolved python=${rembgPython || "(none)"}`,
    `REMBG_SCRIPT=${rembgScript || "(empty)"}`,
    `resolved script=${rembgScriptPath || "(empty)"}`,
    `script exists=${rembgScriptExists ? "yes" : "no"}`,
    ...rembgResolution.diagnostics
  ];

  console.warn(
    `Background removal is enabled but unavailable. ${details.join("; ")}`
  );
}

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

function projectPath(value) {
  return path.isAbsolute(value) ? value : path.join(__dirname, value);
}

function isBareCommand(value) {
  return Boolean(value) && !path.isAbsolute(value) && !value.includes("/") && !value.includes("\\");
}

function executablePath(value) {
  return isBareCommand(value) ? value : projectPath(value);
}

function candidateExists(value) {
  return isBareCommand(value) || fs.existsSync(projectPath(value));
}

function canImportRembg(candidate) {
  const probe = spawnSync(executablePath(candidate), ["-c", "import rembg"], {
    encoding: "utf8",
    timeout: 15000,
    windowsHide: true
  });

  return {
    ok: !probe.error && probe.status === 0,
    error: probe.error?.message || cleanText(probe.stderr) || cleanText(probe.stdout) || (probe.status ? `exit code ${probe.status}` : "")
  };
}

function resolveRembgPython() {
  const configuredPython = cleanText(process.env.REMBG_PYTHON);
  const fallbackCandidates = process.platform === "win32" ? ["py", "python"] : ["python3", "python"];
  const candidates = [configuredPython, defaultRembgPython, ...fallbackCandidates]
    .filter(Boolean)
    .filter((candidate, index, list) => list.indexOf(candidate) === index);
  const diagnostics = [];

  for (const candidate of candidates) {
    if (!candidateExists(candidate)) {
      diagnostics.push(`${candidate}: executable not found`);
      continue;
    }

    const probe = canImportRembg(candidate);
    if (probe.ok) return { python: candidate, diagnostics };

    diagnostics.push(`${candidate}: cannot import rembg${probe.error ? ` (${probe.error})` : ""}`);
  }

  return { python: "", diagnostics };
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
fs.mkdirSync(REMBG_UPLOAD_DIR, { recursive: true });

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

function parseOptionalPrice(value) {
  const text = cleanText(value);
  if (!text) return undefined;
  return parsePositiveNumber(text);
}

function parseNonNegativeInteger(value) {
  const text = cleanText(value);
  if (!/^\d+$/.test(text)) return null;

  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
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

function sizeRangeFromInventory(inventory) {
  return inventory
    .filter((row) => row.quantity > 0)
    .map((row) => (row.quantity === 1 ? row.size : `${row.size}x${row.quantity}`))
    .join(",");
}

function inventoryFromSizeRange(sizeRange) {
  const quantitiesBySize = new Map(SIZES.map((size) => [size, 0]));

  for (const token of String(sizeRange || "").split(",")) {
    const part = cleanText(token);
    if (!part) continue;

    const match = part.match(/^(\d+)(?:x(\d+))?$/);
    const normalizedSize = match?.[1] || "";
    const quantity = match?.[2] === undefined ? 1 : Number(match[2]);

    if (!match || !SIZES.includes(normalizedSize) || !Number.isInteger(quantity) || quantity <= 0) {
      throw Object.assign(new Error("Box size range is invalid."), { statusCode: 400 });
    }

    quantitiesBySize.set(normalizedSize, (quantitiesBySize.get(normalizedSize) || 0) + quantity);
  }

  return SIZES.map((size) => ({
    size,
    quantity: quantitiesBySize.get(size) || 0
  })).filter((row) => row.quantity > 0);
}

function pairCountFromSizeRange(sizeRange) {
  return inventoryFromSizeRange(sizeRange).reduce((total, row) => total + row.quantity, 0);
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

function boxStockForClient(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      id: Number(row.id),
      sizeRange: cleanText(row.sizeRange),
      quantity: Number(row.quantity || 0)
    }))
    .filter((row) => row.id && row.sizeRange && row.quantity > 0);
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

function uploadLocalPathFromPublicPath(publicPath) {
  const normalizedPath = cleanText(publicPath).replace(/\\/g, "/");
  if (!normalizedPath.startsWith("/uploads/")) {
    throw new Error("Image path is not an upload path.");
  }

  const relativePath = normalizedPath.slice("/uploads/".length);
  const resolvedPath = path.resolve(UPLOAD_DIR, relativePath);
  const uploadRoot = path.resolve(UPLOAD_DIR);

  if (resolvedPath !== uploadRoot && !resolvedPath.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new Error("Image path is outside upload directory.");
  }

  return resolvedPath;
}

const backgroundRemovalQueue = [];
let isBackgroundRemovalRunning = false;
let productImageProcessedColumnPromise = null;

function projectPath(value) {
  return path.isAbsolute(value) ? value : path.join(__dirname, value);
}

async function productImageProcessedColumn() {
  if (!productImageProcessedColumnPromise) {
    productImageProcessedColumnPromise = (async () => {
      if (await columnExists("product_images", "isProcessed")) return "isProcessed";
      if (await columnExists("product_images", "isprocesed")) return "isprocesed";
      return "";
    })();
  }

  const columnName = await productImageProcessedColumnPromise;
  if (!columnName) {
    productImageProcessedColumnPromise = null;
  }

  return columnName;
}

function runRembg(sourcePath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(projectPath(rembgPython), [projectPath(rembgScript), sourcePath, outputPath], {
      windowsHide: true
    });
    let stderr = "";
    let stdout = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`rembg timed out after ${rembgTimeoutMs}ms`));
    }, rembgTimeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || stdout || `rembg exited with code ${code}`));
    });
  });
}

async function processProductImageWithRembg(imageRecord) {
  if (!imageRecord.id) return;

  const processedColumn = await productImageProcessedColumn();
  const [imageRows] = await pool.execute(
    `SELECT image_path AS path${processedColumn ? `, \`${processedColumn}\` AS isProcessed` : ""}
     FROM product_images
     WHERE id = ?
     LIMIT 1`,
    [imageRecord.id]
  );

  if (!imageRows.length) return;

  const imageRow = imageRows[0];
  const originalPath = cleanText(imageRow.path);
  if (!originalPath) return;

  const isProcessed = Boolean(Number(imageRow.isProcessed || 0));
  if (isProcessed) return;

  if (originalPath.startsWith("/uploads/rembg/")) {
    if (processedColumn) {
      await pool.execute(`UPDATE product_images SET \`${processedColumn}\` = TRUE WHERE id = ?`, [imageRecord.id]);
    }
    return;
  }

  const sourcePath = uploadLocalPathFromPublicPath(originalPath);
  await fs.promises.access(sourcePath, fs.constants.R_OK);

  const fileName = `${Date.now()}-${crypto.randomUUID()}.png`;
  const processedPath = path.join(REMBG_UPLOAD_DIR, fileName);
  const publicProcessedPath = `/uploads/rembg/${fileName}`;

  await runRembg(sourcePath, processedPath);

  const stats = await fs.promises.stat(processedPath);
  if (!stats.size) {
    await fs.promises.unlink(processedPath).catch(() => {});
    throw new Error("rembg returned an empty image.");
  }

  const [updated] = processedColumn
    ? await pool.execute(
        `UPDATE product_images
         SET image_path = ?, \`${processedColumn}\` = TRUE
         WHERE id = ? AND image_path = ? AND \`${processedColumn}\` = FALSE`,
        [publicProcessedPath, imageRecord.id, originalPath]
      )
    : await pool.execute(
        "UPDATE product_images SET image_path = ? WHERE id = ? AND image_path = ?",
        [publicProcessedPath, imageRecord.id, originalPath]
      );

  if (!updated.affectedRows) {
    await fs.promises.unlink(processedPath).catch(() => {});
  }
}

async function runBackgroundRemovalQueue() {
  if (isBackgroundRemovalRunning) return;
  isBackgroundRemovalRunning = true;

  try {
    while (backgroundRemovalQueue.length) {
      const imageRecord = backgroundRemovalQueue.shift();
      try {
        await processProductImageWithRembg(imageRecord);
      } catch (error) {
        console.error(`rembg image processing failed for image ${imageRecord?.id}: ${error.message}`);
      }
    }
  } finally {
    isBackgroundRemovalRunning = false;
  }
}

function queueBackgroundRemovalProcessing(imageRecords) {
  if (!rembgAvailable || !imageRecords.length) return;

  const pendingImages = imageRecords.filter((imageRecord) => !imageRecord.isProcessed);
  if (!pendingImages.length) return;

  backgroundRemovalQueue.push(...pendingImages);
  setTimeout(() => {
    runBackgroundRemovalQueue().catch((error) => {
      console.error(`Background removal queue failed: ${error.message}`);
    });
  }, 0).unref();
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
  const boxQuantity = parseNonNegativeInteger(payload.box_quantity ?? payload.boxQuantity ?? 0);
  const images = normalizeImages(payload.images);

  if (!artNo) return { error: "Artno kiritilishi kerak." };
  if (!SHOE_TYPES.includes(type)) return { error: "To'g'ri oyoq kiyim turini tanlang." };
  if (!seasons.length) return { error: "Kamida bitta mavsum tanlang." };
  if (price === null) return { error: "Narx musbat son bo'lishi kerak." };
  if (landingPrice === null) return { error: "Kelish narxi musbat son bo'lishi kerak." };
  if (!colour) return { error: "Rang kiritilishi kerak." };
  if (!material) return { error: "Material kiritilishi kerak." };
  if (boxQuantity === null) return { error: "Box quantity must be a whole number greater than or equal to 0." };
  if (boxQuantity > 0 && !inventory.some((row) => row.quantity > 0)) {
    return { error: "At least one size quantity is required when adding boxes." };
  }

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
      boxQuantity,
      images
    }
  };
}

async function saveProductImages(connection, variantId, images) {
  const savedImages = [];
  const processedColumn = await productImageProcessedColumn();

  for (const image of images) {
    const imagePath = image.tempId ? await promoteTempImageFile(image.tempId) : await saveImageFile(image);

    const [insert] = processedColumn
      ? await connection.execute(
          `INSERT INTO product_images (product_variant_id, image_path, \`${processedColumn}\`) VALUES (?, ?, FALSE)`,
          [variantId, imagePath]
        )
      : await connection.execute("INSERT INTO product_images (product_variant_id, image_path) VALUES (?, ?)", [
          variantId,
          imagePath
        ]);

    savedImages.push({
      id: insert.insertId,
      path: imagePath,
      isProcessed: false
    });
  }

  return savedImages;
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
async function tableExists(tableName) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );

  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function ensureIndex(tableName, indexName, columnName) {
  const [existing] = await pool.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );

  if (!existing.length) {
    await pool.query(`CREATE INDEX \`${indexName}\` ON \`${tableName}\`(\`${columnName}\`)`);
  }
}

async function ensureBooleanColumn(tableName, columnName, defaultValue = false) {
  if (await columnExists(tableName, columnName)) return;

  await pool.query(
    `ALTER TABLE \`${tableName}\`
     ADD COLUMN \`${columnName}\` BOOLEAN NOT NULL DEFAULT ${defaultValue ? "TRUE" : "FALSE"}`
  );
}

async function ensureSoldProductsTables() {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS sold_products_pair (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      store_id INT UNSIGNED NOT NULL,
      seller_user_id INT UNSIGNED NOT NULL,
      product_variant_id INT UNSIGNED NOT NULL,
      size ENUM('33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44') NOT NULL,
      sold_price DECIMAL(10,2) NOT NULL,
      landing_price DECIMAL(10,2) NOT NULL,
      sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      isCanceled BOOLEAN NOT NULL DEFAULT FALSE,

      CONSTRAINT fk_sold_products_pair_store
        FOREIGN KEY (store_id) REFERENCES store(id)
        ON UPDATE CASCADE,

      CONSTRAINT fk_sold_products_pair_user
        FOREIGN KEY (seller_user_id) REFERENCES users(id)
        ON UPDATE CASCADE,

      CONSTRAINT fk_sold_products_pair_variant
        FOREIGN KEY (product_variant_id) REFERENCES product_variant(id)
        ON UPDATE CASCADE,

      CONSTRAINT chk_sold_products_pair_price
        CHECK (sold_price >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS sold_products_box (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      store_id INT UNSIGNED NOT NULL,
      seller_user_id INT UNSIGNED NOT NULL,
      box_stock_id INT UNSIGNED NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      sold_price DECIMAL(10,2) NOT NULL,
      landing_price DECIMAL(10,2) NOT NULL,
      sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      isCancelled BOOLEAN NOT NULL DEFAULT FALSE,

      CONSTRAINT fk_sold_products_box_store
        FOREIGN KEY (store_id) REFERENCES store(id)
        ON UPDATE CASCADE,

      CONSTRAINT fk_sold_products_box_user
        FOREIGN KEY (seller_user_id) REFERENCES users(id)
        ON UPDATE CASCADE,

      CONSTRAINT fk_sold_products_box_stock
        FOREIGN KEY (box_stock_id) REFERENCES box_stock(id)
        ON UPDATE CASCADE,

      CONSTRAINT chk_sold_products_box_quantity
        CHECK (quantity > 0),

      CONSTRAINT chk_sold_products_box_price
        CHECK (sold_price >= 0),

      CONSTRAINT chk_sold_products_box_landing_price
        CHECK (landing_price >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  const pairIndexes = [
    ["idx_sold_products_pair_store_id", "store_id"],
    ["idx_sold_products_pair_seller_user_id", "seller_user_id"],
    ["idx_sold_products_pair_product_variant_id", "product_variant_id"],
    ["idx_sold_products_pair_sold_at", "sold_at"]
  ];

  for (const [indexName, columnName] of pairIndexes) {
    await ensureIndex("sold_products_pair", indexName, columnName);
  }

  const boxIndexes = [
    ["idx_sold_products_box_store_id", "store_id"],
    ["idx_sold_products_box_seller_user_id", "seller_user_id"],
    ["idx_sold_products_box_box_stock_id", "box_stock_id"],
    ["idx_sold_products_box_sold_at", "sold_at"]
  ];

  for (const [indexName, columnName] of boxIndexes) {
    await ensureIndex("sold_products_box", indexName, columnName);
  }

  await ensureBooleanColumn("sold_products_pair", "isCancelled", false);
  await ensureBooleanColumn("sold_products_box", "isCancelled", false);

  if (await tableExists("sold_products")) {
    const legacyLandingPrice = (await columnExists("sold_products", "landing_price"))
      ? "COALESCE(sp.landing_price, 0.00)"
      : "0.00";

    await pool.query(
      `INSERT INTO sold_products_pair
         (store_id, seller_user_id, product_variant_id, size, sold_price, landing_price, sold_at)
       SELECT
         sp.store_id,
         sp.user_id,
         sp.product_variant_id,
         sp.size,
         sp.sold_price,
         ${legacyLandingPrice},
         sp.sold_at
       FROM sold_products sp
       WHERE NOT EXISTS (
         SELECT 1
         FROM sold_products_pair spp
         WHERE spp.store_id = sp.store_id
           AND spp.seller_user_id = sp.user_id
           AND spp.product_variant_id = sp.product_variant_id
           AND spp.size = sp.size
           AND spp.sold_price = sp.sold_price
           AND spp.landing_price = ${legacyLandingPrice}
           AND spp.sold_at = sp.sold_at
       )`
    );
  }
}

function validateSoldProductPayload(payload) {
  const saleType = cleanText(payload?.sale_type || "pair").toLowerCase();
  const artNo = cleanText(payload?.art_no);
  const colourName = cleanText(payload?.colour_name);
  const materialType = cleanText(payload?.material_type);
  const size = cleanText(payload?.size);
  const soldPrice = parseNonNegativeDecimal(payload?.sold_price);
  const pairPrice = parseNonNegativeDecimal(payload?.pair_price);
  const boxPrice = parseNonNegativeDecimal(payload?.box_price ?? payload?.sold_price);
  const quantity = Number(payload?.quantity || 1);
  const boxStockId = Number(payload?.box_stock_id || 0);
  const openBoxIfNeeded = payload?.open_box_if_needed === true;

  if (!["pair", "box"].includes(saleType)) return { error: "Sotuv turi to'g'ri kiritilishi kerak." };
  if (!artNo) return { error: "Art no kiritilishi kerak." };
  if (!colourName) return { error: "Rang kiritilishi kerak." };
  if (!materialType) return { error: "Material turi kiritilishi kerak." };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Sotilgan son musbat butun son bo'lishi kerak." };

  if (saleType === "pair") {
    if (!SIZES.includes(size)) return { error: "To'g'ri razmer kiritilishi kerak." };
    if (soldPrice === null) return { error: "Sotilgan narx 0 yoki undan katta son bo'lishi kerak." };
  }

  if (saleType === "box") {
    if (pairPrice === null) return { error: "Bir juft narxi 0 yoki undan katta son bo'lishi kerak." };
    if (boxPrice === null) return { error: "Butun quti narxi 0 yoki undan katta son bo'lishi kerak." };
  }

  return {
    sale: {
      saleType,
      artNo,
      colourName,
      materialType,
      size,
      soldPrice,
      pairPrice,
      boxPrice,
      quantity,
      boxStockId,
      openBoxIfNeeded
    }
  };
}

function validatePriceUpdatePayload(payload) {
  const artNo = cleanText(payload?.artNo ?? payload?.art_no);
  const landingPrice = parseOptionalPrice(payload?.landingPriceUpdate ?? payload?.landing_price_update);
  const sellingPrice = parseOptionalPrice(payload?.sellingPrice ?? payload?.selling_price);

  if (!artNo) return { error: "Art no kiritilishi kerak." };
  if (landingPrice === null) return { error: "Kelish narxi 0 yoki undan katta son bo'lishi kerak." };
  if (sellingPrice === null) return { error: "Sotish narxi 0 yoki undan katta son bo'lishi kerak." };
  if (landingPrice === undefined && sellingPrice === undefined) {
    return { error: "Kamida bitta narx maydonini to'ldiring." };
  }

  return {
    priceUpdate: {
      artNo,
      landingPrice,
      sellingPrice
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

function canViewLandingPrice(request) {
  return request.user?.role === "admin" || ["owner", "manager"].includes(request.store?.storeRole);
}

function productForClient(request, product) {
  if (!product || canViewLandingPrice(request)) return product;

  return {
    ...product,
    landingPrice: null
  };
}

async function writeInventoryRows(connection, variantId, inventory, storeId) {
  await connection.execute("DELETE FROM inventory WHERE product_variant_id = ? AND store_id = ?", [variantId, storeId]);

  const rowsToInsert = inventory.filter((row) => row.quantity > 0);
  if (rowsToInsert.length && storeId === defaultStoreId) {
    await ensureDefaultStore(connection);
  }

  for (const row of rowsToInsert) {
    await connection.execute(
      "INSERT INTO inventory (product_variant_id, size, quantity, store_id) VALUES (?, ?, ?, ?)",
      [variantId, row.size, row.quantity, storeId]
    );
  }
}

async function writeProductSeasons(connection, productId, seasons) {
  await connection.execute("DELETE FROM product_seasons WHERE product_id = ?", [productId]);

  for (const season of seasonsForDatabase(seasons)) {
    await connection.execute("INSERT INTO product_seasons (product_id, season) VALUES (?, ?)", [productId, season]);
  }
}

async function addInventoryRows(connection, variantId, inventory, storeId) {
  const rowsToAdd = inventory.filter((row) => row.quantity > 0);
  if (!rowsToAdd.length) return;

  if (storeId === defaultStoreId) {
    await ensureDefaultStore(connection);
  }

  for (const row of rowsToAdd) {
    const [updated] = await connection.execute(
      `UPDATE inventory
       SET quantity = quantity + ?
       WHERE product_variant_id = ? AND store_id = ? AND size = ?`,
      [row.quantity, variantId, storeId, row.size]
    );

    if (!updated.affectedRows) {
      await connection.execute(
        "INSERT INTO inventory (product_variant_id, size, quantity, store_id) VALUES (?, ?, ?, ?)",
        [variantId, row.size, row.quantity, storeId]
      );
    }
  }
}

async function ensureBoxStockTable() {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS box_stock (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_variant_id INT NOT NULL,
      size_range VARCHAR(255) NOT NULL,
      quantity INT NOT NULL DEFAULT 0,
      store_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      CONSTRAINT fk_box_stock_variant
        FOREIGN KEY (product_variant_id) REFERENCES product_variant(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

      CONSTRAINT fk_box_stock_store
        FOREIGN KEY (store_id) REFERENCES store(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

      CONSTRAINT chk_box_stock_quantity
        CHECK (quantity >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  if (!(await columnExists("box_stock", "store_id"))) {
    await ensureDefaultStore(pool);
    await pool.query(`ALTER TABLE box_stock ADD COLUMN store_id INT NULL AFTER quantity`);
    await pool.query("UPDATE box_stock SET store_id = ? WHERE store_id IS NULL", [defaultStoreId]);
    await pool.query(`ALTER TABLE box_stock MODIFY store_id INT NOT NULL`);
  }

  const [storeForeignKeys] = await pool.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'box_stock'
       AND CONSTRAINT_NAME = 'fk_box_stock_store'
     LIMIT 1`
  );

  if (!storeForeignKeys.length) {
    await pool.query(
      `ALTER TABLE box_stock
       ADD CONSTRAINT fk_box_stock_store
         FOREIGN KEY (store_id) REFERENCES store(id)
         ON UPDATE CASCADE
         ON DELETE RESTRICT`
    );
  }

  const indexes = [
    ["idx_box_stock_product_variant_id", "product_variant_id"],
    ["idx_box_stock_store_id", "store_id"],
    ["idx_box_stock_quantity", "quantity"]
  ];

  for (const [indexName, columnName] of indexes) {
    await ensureIndex("box_stock", indexName, columnName);
  }
}

async function writeBoxStockRow(connection, variantId, inventory, boxQuantity, storeId) {
  if (boxQuantity <= 0) return;

  const sizeRange = sizeRangeFromInventory(inventory);
  if (!sizeRange) {
    throw Object.assign(new Error("At least one size quantity is required when adding boxes."), { statusCode: 400 });
  }

  await connection.execute(
    "INSERT INTO box_stock (product_variant_id, size_range, quantity, store_id) VALUES (?, ?, ?, ?)",
    [variantId, sizeRange, boxQuantity, storeId]
  );
}

async function writeStockRowsForProduct(connection, variantId, inventory, storeId, boxQuantity) {
  if (boxQuantity > 0) {
    await writeBoxStockRow(connection, variantId, inventory, boxQuantity, storeId);
    return;
  }

  await writeInventoryRows(connection, variantId, inventory, storeId);
}

async function addStockRowsForProduct(connection, variantId, inventory, storeId, boxQuantity) {
  if (boxQuantity > 0) {
    await writeBoxStockRow(connection, variantId, inventory, boxQuantity, storeId);
    return;
  }

  await addInventoryRows(connection, variantId, inventory, storeId);
}

function inventoryIncludesSize(inventory, size) {
  return inventory.some((row) => row.size === size && row.quantity > 0);
}

async function findSaleVariant(connection, sale, storeId) {
  const [matches] = await connection.execute(
    `SELECT
       p.id AS productId,
       pv.price,
       pv.landing_price AS landingPrice,
       pv.id AS productVariantId
     FROM products p
     INNER JOIN product_variant pv ON pv.product_id = p.id
     INNER JOIN colours c ON c.id = pv.colour_id
     INNER JOIN materials m ON m.id = pv.material_id
     WHERE p.art_no = ?
       AND pv.store_id = ?
       AND c.colour_name = ?
       AND m.material_type = ?
     ORDER BY p.updated_at DESC, p.created_at DESC
     LIMIT 1`,
    [sale.artNo, storeId, sale.colourName, sale.materialType]
  );

  return matches[0] || null;
}

async function findOpenableBoxStock(connection, variantId, size, storeId, lock = false) {
  const [boxes] = await connection.execute(
    `SELECT id, product_variant_id AS productVariantId, size_range AS sizeRange, quantity
     FROM box_stock
     WHERE product_variant_id = ?
       AND store_id = ?
       AND quantity > 0
     ORDER BY id
     ${lock ? "FOR UPDATE" : ""}`,
    [variantId, storeId]
  );

  return boxes.find((box) => inventoryIncludesSize(inventoryFromSizeRange(box.sizeRange), size)) || null;
}

async function openBoxStockInTransaction(connection, boxStock, storeId) {
  if (!boxStock || Number(boxStock.quantity) <= 0) {
    throw Object.assign(new Error("No unopened boxes are available."), { statusCode: 400 });
  }

  const inventory = inventoryFromSizeRange(boxStock.sizeRange);

  await connection.execute("UPDATE box_stock SET quantity = quantity - 1, updated_at = NOW() WHERE id = ?", [
    boxStock.id
  ]);
  await addInventoryRows(connection, boxStock.productVariantId, inventory, storeId);
  await connection.execute("UPDATE product_variant SET updated_at = NOW() WHERE id = ?", [boxStock.productVariantId]);

  return inventory;
}

async function openBoxStock(boxStockId, storeId = defaultStoreId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[boxStock]] = await connection.execute(
      `SELECT
         bs.id,
         bs.product_variant_id AS productVariantId,
         bs.size_range AS sizeRange,
         bs.quantity,
         pv.price
       FROM box_stock bs
       INNER JOIN product_variant pv ON pv.id = bs.product_variant_id
       INNER JOIN products p ON p.id = pv.product_id
       WHERE bs.id = ?
         AND bs.store_id = ?
       FOR UPDATE`,
      [boxStockId, storeId]
    );

    if (!boxStock) {
      throw Object.assign(new Error("Box stock record was not found."), { statusCode: 404 });
    }

    if (Number(boxStock.quantity) <= 0) {
      throw Object.assign(new Error("No unopened boxes are available."), { statusCode: 400 });
    }

    const inventory = inventoryFromSizeRange(boxStock.sizeRange);

    await connection.execute("UPDATE box_stock SET quantity = quantity - 1, updated_at = NOW() WHERE id = ?", [
      boxStock.id
    ]);
    await addInventoryRows(connection, boxStock.productVariantId, inventory, storeId);
    await connection.execute("UPDATE product_variant SET updated_at = NOW() WHERE id = ?", [boxStock.productVariantId]);

    await connection.commit();
    return {
      productVariantId: boxStock.productVariantId,
      remainingQuantity: Number(boxStock.quantity) - 1,
      inventory
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findBoxStockForSale(connection, sale, storeId) {
  const variant = await findSaleVariant(connection, sale, storeId);
  if (!variant) return null;

  const params = sale.boxStockId > 0 ? [sale.boxStockId, variant.productVariantId, storeId] : [variant.productVariantId, storeId];
  const idFilter = sale.boxStockId > 0 ? "bs.id = ? AND" : "";
  const [boxes] = await connection.execute(
     `SELECT
       bs.id,
       bs.product_variant_id AS productVariantId,
       bs.size_range AS sizeRange,
       bs.quantity,
       p.id AS productId,
       pv.price,
       pv.landing_price AS landingPrice
     FROM box_stock bs
     INNER JOIN product_variant pv ON pv.id = bs.product_variant_id
     INNER JOIN products p ON p.id = pv.product_id
     WHERE ${idFilter} bs.product_variant_id = ?
       AND bs.store_id = ?
       AND bs.quantity > 0
     ORDER BY bs.id
     LIMIT 1
     FOR UPDATE`,
    params
  );

  return boxes[0] || null;
}

async function findMatchingProductVariant(connection, data, colourId, materialId, storeId) {
  const [matches] = await connection.execute(
    `SELECT p.id AS productId, pv.id AS variantId
     FROM products p
     INNER JOIN product_variant pv ON pv.product_id = p.id
     WHERE p.art_no = ?
       AND pv.store_id = ?
       AND pv.colour_id = ?
       AND pv.material_id = ?
     ORDER BY p.updated_at DESC, p.created_at DESC
     LIMIT 1`,
    [data.artNo, storeId, colourId, materialId]
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

async function findMatchingProductByText(artNo, colour, material, storeId = defaultStoreId) {
  const [matches] = await pool.execute(
    `SELECT p.id AS productId, pv.id AS variantId
     FROM products p
     INNER JOIN product_variant pv ON pv.product_id = p.id
     INNER JOIN colours c ON c.id = pv.colour_id
     INNER JOIN materials m ON m.id = pv.material_id
     WHERE p.art_no = ?
       AND pv.store_id = ?
       AND c.colour_name = ?
       AND m.material_type = ?
     ORDER BY p.updated_at DESC, p.created_at DESC
     LIMIT 1`,
    [artNo, storeId, colour, material]
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
       pv.landing_price AS landingPrice,
       pv.price,
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
       AND pv.store_id = ?
     GROUP BY
       p.id, p.art_no, p.name, st.type, pv.landing_price, pv.price,
       pv.id, c.colour_name, m.material_type
     ORDER BY p.updated_at DESC, p.created_at DESC, pv.updated_at DESC, pv.created_at DESC`,
    [storeId, artNo, storeId]
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
  const [rows] = await pool.execute(
    `SELECT
       p.id,
       p.art_no AS artNo,
       p.name,
       st.type,
       (SELECT GROUP_CONCAT(ps.season ORDER BY ps.season SEPARATOR ',')
       FROM product_seasons ps
       WHERE ps.product_id = p.id) AS seasonValues,
       pv.landing_price AS landingPrice,
       pv.price,
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
       AND pv.store_id = ?
       ${variantFilter}
     GROUP BY
       p.id, p.art_no, p.name, st.type, pv.landing_price, pv.price, p.created_at, p.updated_at,
       pv.id, c.colour_name, m.material_type`,
    variantId ? [storeId, id, storeId, variantId] : [storeId, id, storeId]
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
  const [boxStockRows] = await pool.execute(
    "SELECT id, size_range AS sizeRange, quantity FROM box_stock WHERE product_variant_id = ? AND store_id = ? AND quantity > 0 ORDER BY id",
    [product.variantId, storeId]
  );

  return {
    ...product,
    seasons: seasonsForClient(product.seasonValues),
    inventory: inventoryForClient(inventoryRows),
    boxStock: boxStockForClient(boxStockRows),
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

app.get("/api/health", async (request, response) => {
  try {
    await testConnection();
    const payload = { ok: true };
    if (request.query?.debug === "rembg") {
      payload.rembg = {
        enabled: rembgEnabled,
        available: rembgAvailable,
        python: rembgPython || null,
        configuredPython: process.env.REMBG_PYTHON || null,
        script: rembgScriptPath || null,
        scriptExists: rembgScriptExists,
        diagnostics: rembgResolution.diagnostics
      };
    }
    response.json(payload);
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

    if (sale.saleType === "box") {
      const boxStock = await findBoxStockForSale(connection, sale, storeId);

      if (!boxStock) {
        await connection.rollback();
        apiMessage(response, "Mahsulot mavjud emas.", 404);
        return;
      }

      if (Number(boxStock.quantity || 0) < sale.quantity) {
        await connection.rollback();
        apiMessage(response, "Ochilmagan qutilar yetarli emas.", 400);
        return;
      }

      const saleUserId = await userIdForSale(connection, request);
      if (!saleUserId) {
        await connection.rollback();
        apiMessage(response, "Sotuv tarixi uchun sotuvchi topilmadi.", 403);
        return;
      }

      const pairCount = pairCountFromSizeRange(boxStock.sizeRange);
      const landingPrice = Number(boxStock.landingPrice || 0) * pairCount;
      const remainingQuantity = Number(boxStock.quantity) - sale.quantity;

      await connection.execute(
        `INSERT INTO sold_products_box
           (store_id, seller_user_id, box_stock_id, quantity, sold_price, landing_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [storeId, saleUserId, boxStock.id, sale.quantity, sale.boxPrice, landingPrice]
      );

      await connection.execute("UPDATE box_stock SET quantity = ?, updated_at = NOW() WHERE id = ?", [
        remainingQuantity,
        boxStock.id
      ]);
      await connection.execute("UPDATE product_variant SET updated_at = NOW() WHERE id = ?", [boxStock.productVariantId]);
      await connection.execute("UPDATE products SET updated_at = NOW() WHERE id = ?", [boxStock.productId]);
      await connection.commit();

      response.json({
        success: true,
        message: "Quti sotuv saqlandi",
        remaining_quantity: remainingQuantity,
        opened_box: false
      });
      return;
    }

    const [matches] = await connection.execute(
      `SELECT
         p.id AS productId,
         pv.landing_price AS landingPrice,
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
    let saleMatch = match;

    if (!saleMatch || Number(saleMatch.quantity || 0) < sale.quantity) {
      const variant = await findSaleVariant(connection, sale, storeId);

      if (!variant) {
        await connection.rollback();
        apiMessage(response, "Mahsulot mavjud emas.", 404);
        return;
      }

      const boxStock = await findOpenableBoxStock(
        connection,
        variant.productVariantId,
        sale.size,
        storeId,
        sale.openBoxIfNeeded
      );

      if (!boxStock) {
        await connection.rollback();
        apiMessage(response, "Mahsulot mavjud emas.", 404);
        return;
      }

      if (!sale.openBoxIfNeeded) {
        await connection.rollback();
        response.status(409).json({
          success: false,
          requiresBoxOpen: true,
          message: "Bu razmer ochilmagan quti zaxirasida bor. Bitta quti ochilsinmi?",
          boxStock: {
            id: boxStock.id,
            quantity: Number(boxStock.quantity || 0),
            sizeRange: boxStock.sizeRange
          }
        });
        return;
      }

      await openBoxStockInTransaction(connection, boxStock, storeId);

      const [openedMatches] = await connection.execute(
        `SELECT
           p.id AS productId,
           pv.landing_price AS landingPrice,
           pv.id AS productVariantId,
           i.id AS inventoryId,
           i.quantity
         FROM products p
         INNER JOIN product_variant pv ON pv.product_id = p.id
         INNER JOIN inventory i ON i.product_variant_id = pv.id
         WHERE pv.id = ?
           AND i.size = ?
           AND i.store_id = ?
         LIMIT 1
         FOR UPDATE`,
        [variant.productVariantId, sale.size, storeId]
      );

      saleMatch = openedMatches[0];
    }

    if (!saleMatch || Number(saleMatch.quantity || 0) < sale.quantity) {
      await connection.rollback();
      apiMessage(response, "Quti ochilgandan keyin ham omborda yetarli miqdor yo'q.", 400);
      return;
    }

    const saleUserId = await userIdForSale(connection, request);
    if (!saleUserId) {
      await connection.rollback();
      apiMessage(response, "Sotuv tarixi uchun sotuvchi topilmadi.", 403);
      return;
    }

    for (let index = 0; index < sale.quantity; index += 1) {
      await connection.execute(
        `INSERT INTO sold_products_pair
           (store_id, seller_user_id, product_variant_id, size, sold_price, landing_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [storeId, saleUserId, saleMatch.productVariantId, sale.size, sale.soldPrice, saleMatch.landingPrice]
      );
    }

    const remainingQuantity = Number(saleMatch.quantity) - sale.quantity;
    if (remainingQuantity > 0) {
      await connection.execute("UPDATE inventory SET quantity = ?, updated_at = NOW() WHERE id = ?", [
        remainingQuantity,
        saleMatch.inventoryId
      ]);
    } else {
      await connection.execute("DELETE FROM inventory WHERE id = ?", [saleMatch.inventoryId]);
    }

    await connection.execute("UPDATE product_variant SET updated_at = NOW() WHERE id = ?", [saleMatch.productVariantId]);
    await connection.execute("UPDATE products SET updated_at = NOW() WHERE id = ?", [saleMatch.productId]);
    await connection.commit();

    response.json({
      success: true,
      message: sale.openBoxIfNeeded ? "Quti ochildi va mahsulot sotilgan deb belgilandi" : "Mahsulot sotilgan deb belgilandi",
      remaining_quantity: remainingQuantity,
      opened_box: sale.openBoxIfNeeded
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
      apiMessage(response, "To'g'ri sana kiritilishi kerak.", 400);
      return;
    }

    const sellerOnly = !canViewLandingPrice(request);
    const storeId = currentStoreId(request);
    const queryParams = sellerOnly
      ? [storeId, saleDate, saleDate, request.user.id, storeId, saleDate, saleDate, request.user.id]
      : [storeId, saleDate, saleDate, storeId, saleDate, saleDate];
    const [rows] = await pool.execute(
      `SELECT *
       FROM (
         SELECT
           CONCAT('pair-', spp.id) AS id,
           'pair' AS saleType,
           spp.size,
           1 AS quantity,
           spp.sold_price AS soldPrice,
           spp.landing_price AS landingPrice,
           spp.sold_at AS soldAt,
           spp.isCancelled AS isCancelled,
           p.art_no AS artNo,
           p.name,
           st.type,
           c.colour_name AS colour,
           m.material_type AS material,
           CONCAT(u.fname, ' ', u.lname) AS soldBy,
           (
             SELECT pi.image_path
             FROM product_images pi
             WHERE pi.product_variant_id = pv.id
             ORDER BY pi.id
             LIMIT 1
           ) AS imagePath
         FROM sold_products_pair spp
         INNER JOIN product_variant pv ON pv.id = spp.product_variant_id
         INNER JOIN products p ON p.id = pv.product_id
         LEFT JOIN shoe_type st ON st.id = p.type_id
         INNER JOIN colours c ON c.id = pv.colour_id
         INNER JOIN materials m ON m.id = pv.material_id
         LEFT JOIN users u ON u.id = spp.seller_user_id
         WHERE spp.store_id = ?
           AND spp.sold_at >= ?
           AND spp.sold_at < DATE_ADD(?, INTERVAL 1 DAY)
           ${sellerOnly ? "AND spp.seller_user_id = ?" : ""}

         UNION ALL

         SELECT
           CONCAT('box-', spb.id) AS id,
           'box' AS saleType,
           bs.size_range AS size,
           spb.quantity,
           spb.sold_price AS soldPrice,
           spb.landing_price AS landingPrice,
           spb.sold_at AS soldAt,
           spb.isCancelled AS isCancelled,
           p.art_no AS artNo,
           p.name,
           st.type,
           c.colour_name AS colour,
           m.material_type AS material,
           CONCAT(u.fname, ' ', u.lname) AS soldBy,
           (
             SELECT pi.image_path
             FROM product_images pi
             WHERE pi.product_variant_id = pv.id
             ORDER BY pi.id
             LIMIT 1
           ) AS imagePath
         FROM sold_products_box spb
         INNER JOIN box_stock bs ON bs.id = spb.box_stock_id
         INNER JOIN product_variant pv ON pv.id = bs.product_variant_id
         INNER JOIN products p ON p.id = pv.product_id
         LEFT JOIN shoe_type st ON st.id = p.type_id
         INNER JOIN colours c ON c.id = pv.colour_id
         INNER JOIN materials m ON m.id = pv.material_id
         LEFT JOIN users u ON u.id = spb.seller_user_id
         WHERE spb.store_id = ?
           AND spb.sold_at >= ?
           AND spb.sold_at < DATE_ADD(?, INTERVAL 1 DAY)
           ${sellerOnly ? "AND spb.seller_user_id = ?" : ""}
       ) sales
       ORDER BY soldAt DESC, id DESC`,
      queryParams
    );

    apiData(response, {
      date: saleDate,
      viewer: {
        canViewLandingPrice: canViewLandingPrice(request)
      },
      items: rows.map((row) => ({
        ...row,
        quantity: Number(row.quantity || 0),
        soldPrice: Number(row.soldPrice || 0),
        landingPrice: canViewLandingPrice(request) ? Number(row.landingPrice || 0) : null,
        isCancelled: Boolean(row.isCancelled)
      }))
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sold-products/:id/cancel", requireAuth, requireStoreOwner, async (request, response, next) => {
  if (!canViewLandingPrice(request)) {
    apiMessage(response, "Sotuvni faqat do'kon egasi yoki menejer bekor qilishi mumkin.", 403);
    return;
  }

  const match = cleanText(request.params.id).match(/^(pair|box)-(\d+)$/);
  if (!match) {
    apiMessage(response, "Sotuv yozuvi noto'g'ri.", 400);
    return;
  }

  const [, saleType, saleIdText] = match;
  const saleId = Number(saleIdText);
  const storeId = currentStoreId(request);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (saleType === "pair") {
      const [[sale]] = await connection.execute(
        `SELECT
           spp.id,
           spp.product_variant_id AS productVariantId,
           spp.size,
           spp.isCancelled,
           p.id AS productId
         FROM sold_products_pair spp
         INNER JOIN product_variant pv ON pv.id = spp.product_variant_id
         INNER JOIN products p ON p.id = pv.product_id
         WHERE spp.id = ?
           AND spp.store_id = ?
         LIMIT 1
         FOR UPDATE`,
        [saleId, storeId]
      );

      if (!sale) {
        await connection.rollback();
        apiMessage(response, "Sotuv yozuvi topilmadi.", 404);
        return;
      }

      if (sale.isCancelled) {
        await connection.rollback();
        apiMessage(response, "Bu sotuv allaqachon bekor qilingan.", 409);
        return;
      }

      await addInventoryRows(connection, sale.productVariantId, [{ size: sale.size, quantity: 1 }], storeId);
      const pairCancelColumns = ["isCancelled"];
      if (await columnExists("sold_products_pair", "isCanceled")) {
        pairCancelColumns.push("isCanceled");
      }
      await connection.execute(
        `UPDATE sold_products_pair
         SET ${pairCancelColumns.map((columnName) => `\`${columnName}\` = TRUE`).join(", ")}
         WHERE id = ?`,
        [sale.id]
      );
      await connection.execute("UPDATE product_variant SET updated_at = NOW() WHERE id = ?", [sale.productVariantId]);
      await connection.execute("UPDATE products SET updated_at = NOW() WHERE id = ?", [sale.productId]);
      await connection.commit();

      apiData(response, { id: request.params.id, isCancelled: true, restoredQuantity: 1 });
      return;
    }

    const [[sale]] = await connection.execute(
      `SELECT
         spb.id,
         spb.box_stock_id AS boxStockId,
         spb.quantity,
         spb.isCancelled,
         bs.product_variant_id AS productVariantId,
         p.id AS productId
       FROM sold_products_box spb
       INNER JOIN box_stock bs ON bs.id = spb.box_stock_id
       INNER JOIN product_variant pv ON pv.id = bs.product_variant_id
       INNER JOIN products p ON p.id = pv.product_id
       WHERE spb.id = ?
         AND spb.store_id = ?
       LIMIT 1
       FOR UPDATE`,
      [saleId, storeId]
    );

    if (!sale) {
      await connection.rollback();
      apiMessage(response, "Sotuv yozuvi topilmadi.", 404);
      return;
    }

    if (sale.isCancelled) {
      await connection.rollback();
      apiMessage(response, "Bu sotuv allaqachon bekor qilingan.", 409);
      return;
    }

    await connection.execute("UPDATE box_stock SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?", [
      sale.quantity,
      sale.boxStockId
    ]);
    await connection.execute("UPDATE sold_products_box SET isCancelled = TRUE WHERE id = ?", [sale.id]);
    await connection.execute("UPDATE product_variant SET updated_at = NOW() WHERE id = ?", [sale.productVariantId]);
    await connection.execute("UPDATE products SET updated_at = NOW() WHERE id = ?", [sale.productId]);
    await connection.commit();

    apiData(response, { id: request.params.id, isCancelled: true, restoredQuantity: Number(sale.quantity || 0) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
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
       WHERE pv.store_id = ?
       GROUP BY p.id, pv.id
       ORDER BY p.updated_at DESC, p.created_at DESC, pv.updated_at DESC, pv.created_at DESC`,
      [storeId, storeId]
    );

    const products = (await Promise.all(rows.map((row) => fetchProduct(row.id, storeId, row.variantId))))
      .filter(Boolean)
      .map((product) => productForClient(request, product));
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

    const storeId = currentStoreId(request);
    const match = await findMatchingProductByText(artNo, colour, material, storeId);
    if (!match) {
      apiData(response, []);
      return;
    }

    apiData(response, [productForClient(request, await fetchProduct(match.productId, storeId, match.variantId))].filter(Boolean));
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

    const lookup = await fetchProductLookupByArtNo(artNo, currentStoreId(request));
    if (lookup?.product && !canViewLandingPrice(request)) {
      lookup.product.landingPrice = null;
    }
    apiData(response, lookup);
  } catch (error) {
    next(error);
  }
});

app.post("/api/products/prices", requireAuth, requireStoreOwner, async (request, response, next) => {
  const validation = validatePriceUpdatePayload(request.body);
  if (validation.error) {
    apiMessage(response, validation.error, 400);
    return;
  }

  if (!canViewLandingPrice(request)) {
    apiMessage(response, "Narxlarni faqat do'kon egasi yoki menejer yangilashi mumkin.", 403);
    return;
  }

  const data = validation.priceUpdate;
  const storeId = currentStoreId(request);
  const assignments = [];
  const values = [];

  if (data.landingPrice !== undefined) {
    assignments.push("pv.landing_price = ?");
    values.push(data.landingPrice);
  }

  if (data.sellingPrice !== undefined) {
    assignments.push("pv.price = ?");
    values.push(data.sellingPrice);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [updated] = await connection.execute(
      `UPDATE product_variant pv
       INNER JOIN products p ON p.id = pv.product_id
       SET ${assignments.join(", ")}, pv.updated_at = NOW(), p.updated_at = NOW()
       WHERE p.art_no = ?
         AND pv.store_id = ?`,
      [...values, data.artNo, storeId]
    );

    if (!updated.affectedRows) {
      await connection.rollback();
      apiMessage(response, "Bu art no bo'yicha mahsulot topilmadi.", 404);
      return;
    }

    await connection.commit();
    apiData(response, {
      artNo: data.artNo,
      updatedVariants: updated.affectedRows,
      lookup: await fetchProductLookupByArtNo(data.artNo, storeId)
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.get("/api/products/:id", requireAuth, requireStoreOwner, async (request, response, next) => {
  try {
    const product = await fetchProduct(request.params.id, currentStoreId(request));
    if (!product) {
      apiMessage(response, "Mahsulot topilmadi.", 404);
      return;
    }
    apiData(response, productForClient(request, product));
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
    const existing = await findMatchingProductVariant(connection, data, colourId, materialId, storeId);

    if (existing) {
      await connection.execute(
        "UPDATE product_variant SET price = ?, landing_price = ?, updated_at = NOW() WHERE id = ?",
        [data.price, data.landingPrice, existing.variantId]
      );
      await addStockRowsForProduct(connection, existing.variantId, data.inventory, storeId, data.boxQuantity);
      const savedImages = await saveProductImages(connection, existing.variantId, data.images);
      await connection.execute("UPDATE products SET updated_at = NOW() WHERE id = ?", [existing.productId]);
      await connection.commit();
      queueBackgroundRemovalProcessing(savedImages);

      apiData(response, {
        ...(await fetchProduct(existing.productId, storeId, existing.variantId)),
        inventoryIncremented: true
      });
      return;
    }

    const existingProduct = await findProductByArtNo(connection, data.artNo);
    if (existingProduct) {
      const [variantInsert] = await connection.execute(
        "INSERT INTO product_variant (product_id, store_id, colour_id, material_id, price, landing_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
        [existingProduct.productId, storeId, colourId, materialId, data.price, data.landingPrice]
      );

      await connection.execute(
        `UPDATE products
         SET name = ?, type_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [data.name || data.artNo, typeId, existingProduct.productId]
      );
      await writeProductSeasons(connection, existingProduct.productId, data.seasons);
      await writeStockRowsForProduct(connection, variantInsert.insertId, data.inventory, storeId, data.boxQuantity);
      const savedImages = await saveProductImages(connection, variantInsert.insertId, data.images);
      await connection.commit();
      queueBackgroundRemovalProcessing(savedImages);

      apiData(response, await fetchProduct(existingProduct.productId, storeId, variantInsert.insertId), 201);
      return;
    }

    const [productInsert] = await connection.execute(
      `INSERT INTO products (art_no, name, brand_id, type_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [data.artNo, data.name || data.artNo, brandId, typeId]
    );

    const [variantInsert] = await connection.execute(
      "INSERT INTO product_variant (product_id, store_id, colour_id, material_id, price, landing_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [productInsert.insertId, storeId, colourId, materialId, data.price, data.landingPrice]
    );

    await writeProductSeasons(connection, productInsert.insertId, data.seasons);
    await writeStockRowsForProduct(connection, variantInsert.insertId, data.inventory, storeId, data.boxQuantity);
    const savedImages = await saveProductImages(connection, variantInsert.insertId, data.images);
    await connection.commit();
    queueBackgroundRemovalProcessing(savedImages);

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
       SET art_no = ?, name = ?, brand_id = ?, type_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [data.artNo, data.name || data.artNo, brandId, typeId, productId]
    );

    let variantId = existing.variantId;
    if (variantId) {
      await connection.execute(
        "UPDATE product_variant SET store_id = ?, colour_id = ?, material_id = ?, price = ?, landing_price = ?, updated_at = NOW() WHERE id = ?",
        [storeId, colourId, materialId, data.price, data.landingPrice, variantId]
      );
    } else {
      const [variantInsert] = await connection.execute(
        "INSERT INTO product_variant (product_id, store_id, colour_id, material_id, price, landing_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
        [productId, storeId, colourId, materialId, data.price, data.landingPrice]
      );
      variantId = variantInsert.insertId;
    }

    await writeProductSeasons(connection, productId, data.seasons);
    await writeInventoryRows(connection, variantId, data.inventory, storeId);
    const savedImages = await saveProductImages(connection, variantId, data.images);
    await connection.commit();
    queueBackgroundRemovalProcessing(savedImages);

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
    await ensureBoxStockTable();
    await ensureSoldProductsTables();
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
