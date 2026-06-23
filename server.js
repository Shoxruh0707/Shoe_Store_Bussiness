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
app.use(express.static(path.join(__dirname, "public")));

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parsePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeSeasons(seasons) {
  const source = Array.isArray(seasons) ? seasons : String(seasons || "").split(",");
  return [...new Set(source.map(cleanText).filter((season) => SEASONS.includes(season)))];
}

function seasonForDatabase(seasons) {
  const normalized = normalizeSeasons(seasons);
  if (normalized.length !== 1) return "all_season";
  return SEASON_DB_VALUES[normalized[0]];
}

function seasonForClient(value) {
  const season = cleanText(value);
  if (!season) return [];
  if (season.toLowerCase() === "all_season") return [...SEASONS];
  const found = Object.entries(SEASON_DB_VALUES).find(([, dbValue]) => dbValue === season.toLowerCase());
  return found ? [found[0]] : [];
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

function validateProductPayload(payload) {
  const artNo = cleanText(payload.artNo);
  const name = cleanText(payload.name);
  const type = cleanText(payload.type);
  const seasons = normalizeSeasons(payload.seasons);
  const price = parsePositiveNumber(payload.price);
  const colour = cleanText(payload.colour);
  const material = cleanText(payload.material);
  const inventory = normalizeInventoryRows(payload.inventory);
  const images = normalizeImages(payload.images);

  if (!artNo) return { error: "Artno kiritilishi kerak." };
  if (!SHOE_TYPES.includes(type)) return { error: "To'g'ri oyoq kiyim turini tanlang." };
  if (!seasons.length) return { error: "Kamida bitta mavsum tanlang." };
  if (price === null) return { error: "Narx musbat son bo'lishi kerak." };
  if (!colour) return { error: "Rang kiritilishi kerak." };
  if (!material) return { error: "Material kiritilishi kerak." };

  return {
    product: {
      artNo,
      name,
      type,
      seasons,
      price,
      colour,
      material,
      inventory,
      images
    }
  };
}

async function saveProductImages(connection, variantId, images) {
  for (const image of images) {
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

    await connection.execute("INSERT INTO product_images (product_variant_id, image_path) VALUES (?, ?)", [
      variantId,
      `/uploads/${fileName}`
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

async function writeInventoryRows(connection, variantId, price, inventory) {
  await connection.execute("DELETE FROM inventory WHERE product_variant_id = ? AND store_id = ?", [
    variantId,
    defaultStoreId
  ]);

  const rowsToInsert = inventory.filter((row) => row.quantity > 0);
  if (rowsToInsert.length) {
    await ensureDefaultStore(connection);
  }

  for (const row of rowsToInsert) {
    await connection.execute(
      "INSERT INTO inventory (product_variant_id, size, quantity, store_id, price) VALUES (?, ?, ?, ?, ?)",
      [variantId, row.size, row.quantity, defaultStoreId, price]
    );
  }
}

async function addInventoryRows(connection, variantId, price, inventory) {
  const rowsToAdd = inventory.filter((row) => row.quantity > 0);
  if (!rowsToAdd.length) return;

  await ensureDefaultStore(connection);

  for (const row of rowsToAdd) {
    const [updated] = await connection.execute(
      `UPDATE inventory
       SET quantity = quantity + ?, price = ?
       WHERE product_variant_id = ? AND store_id = ? AND size = ?`,
      [row.quantity, price, variantId, defaultStoreId, row.size]
    );

    if (!updated.affectedRows) {
      await connection.execute(
        "INSERT INTO inventory (product_variant_id, size, quantity, store_id, price) VALUES (?, ?, ?, ?, ?)",
        [variantId, row.size, row.quantity, defaultStoreId, price]
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

async function fetchProduct(id) {
  const [rows] = await pool.execute(
    `SELECT
       p.id,
       p.art_no AS artNo,
       p.name,
       st.type,
       p.season,
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
     LEFT JOIN inventory i ON i.product_variant_id = pv.id
     WHERE p.id = ?
     GROUP BY
       p.id, p.art_no, p.name, st.type, p.season, p.price, p.created_at, p.updated_at,
       pv.id, c.colour_name, m.material_type`,
    [id]
  );

  if (!rows.length) return null;

  const product = rows[0];
  const [inventoryRows] = await pool.execute(
    "SELECT size, quantity FROM inventory WHERE product_variant_id = ? AND store_id = ? ORDER BY size",
    [product.variantId, defaultStoreId]
  );
  const [imageRows] = await pool.execute(
    "SELECT id, image_path AS path FROM product_images WHERE product_variant_id = ? ORDER BY id",
    [product.variantId]
  );

  return {
    ...product,
    seasons: seasonForClient(product.season),
    inventory: inventoryRows,
    images: imageRows
  };
}

app.get("/api/health", async (_request, response) => {
  try {
    await testConnection();
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message });
  }
});

app.get("/api/meta", async (_request, response, next) => {
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

app.get("/api/products", async (_request, response, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         p.id,
         p.art_no AS artNo,
         p.name,
         st.type,
         p.season,
         p.price,
         p.created_at AS createdAt,
         p.updated_at AS updatedAt,
         GROUP_CONCAT(DISTINCT c.colour_name ORDER BY c.colour_name SEPARATOR ', ') AS colours,
         GROUP_CONCAT(DISTINCT m.material_type ORDER BY m.material_type SEPARATOR ', ') AS materials,
         GROUP_CONCAT(DISTINCT CASE WHEN i.quantity > 0 THEN i.size END ORDER BY CAST(i.size AS UNSIGNED) SEPARATOR ', ') AS availableSizes,
         COALESCE(SUM(i.quantity), 0) AS quantity
       FROM products p
       LEFT JOIN shoe_type st ON st.id = p.type_id
       LEFT JOIN product_variant pv ON pv.product_id = p.id
       LEFT JOIN colours c ON c.id = pv.colour_id
       LEFT JOIN materials m ON m.id = pv.material_id
       LEFT JOIN inventory i ON i.product_variant_id = pv.id
       GROUP BY p.id, p.art_no, p.name, st.type, p.season, p.price, p.created_at, p.updated_at
       ORDER BY p.updated_at DESC, p.created_at DESC`
    );

    response.json(
      rows.map((row) => ({
        ...row,
        seasons: seasonForClient(row.season)
      }))
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/match", async (request, response, next) => {
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

    response.json({ match: await fetchProduct(match.productId) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:id", async (request, response, next) => {
  try {
    const product = await fetchProduct(request.params.id);
    if (!product) {
      response.status(404).json({ message: "Mahsulot topilmadi." });
      return;
    }
    response.json(product);
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", async (request, response, next) => {
  const validation = validateProductPayload(request.body);
  if (validation.error) {
    response.status(400).json({ message: validation.error });
    return;
  }

  const data = validation.product;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const brandId = await getOrCreateLookup(connection, "brands", "id", "brand_name", defaultBrandName);
    const typeId = await getOrCreateLookup(connection, "shoe_type", "id", "type", data.type);
    const colourId = await getOrCreateLookup(connection, "colours", "id", "colour_name", data.colour);
    const materialId = await getOrCreateLookup(connection, "materials", "id", "material_type", data.material);
    const existing = await findMatchingProductVariant(connection, data, colourId, materialId);

    if (existing) {
      await addInventoryRows(connection, existing.variantId, data.price, data.inventory);
      await saveProductImages(connection, existing.variantId, data.images);
      await connection.execute("UPDATE products SET updated_at = NOW() WHERE id = ?", [existing.productId]);
      await connection.execute("UPDATE product_variant SET updated_at = NOW() WHERE id = ?", [existing.variantId]);
      await connection.commit();

      response.json(await fetchProduct(existing.productId));
      return;
    }

    const [productInsert] = await connection.execute(
      `INSERT INTO products (art_no, name, brand_id, type_id, season, price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [data.artNo, data.name || data.artNo, brandId, typeId, seasonForDatabase(data.seasons), data.price]
    );

    const [variantInsert] = await connection.execute(
      "INSERT INTO product_variant (product_id, colour_id, material_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
      [productInsert.insertId, colourId, materialId]
    );

    await writeInventoryRows(connection, variantInsert.insertId, data.price, data.inventory);
    await saveProductImages(connection, variantInsert.insertId, data.images);
    await connection.commit();

    response.status(201).json(await fetchProduct(productInsert.insertId));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.put("/api/products/:id", async (request, response, next) => {
  const validation = validateProductPayload(request.body);
  if (validation.error) {
    response.status(400).json({ message: validation.error });
    return;
  }

  const data = validation.product;
  const productId = Number(request.params.id);
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
       SET art_no = ?, name = ?, brand_id = ?, type_id = ?, season = ?, price = ?, updated_at = NOW()
       WHERE id = ?`,
      [data.artNo, data.name || data.artNo, brandId, typeId, seasonForDatabase(data.seasons), data.price, productId]
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

    await writeInventoryRows(connection, variantId, data.price, data.inventory);
    await saveProductImages(connection, variantId, data.images);
    await connection.commit();

    response.json(await fetchProduct(productId));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.delete("/api/products/:id", async (request, response, next) => {
  const productId = Number(request.params.id);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [variants] = await connection.execute("SELECT id FROM product_variant WHERE product_id = ?", [productId]);
    const variantIds = variants.map((row) => row.id);

    for (const variantId of variantIds) {
      await connection.execute("DELETE FROM inventory WHERE product_variant_id = ?", [variantId]);
      await connection.execute("DELETE FROM product_images WHERE product_variant_id = ?", [variantId]);
    }

    await connection.execute("DELETE FROM product_variant WHERE product_id = ?", [productId]);
    const [deleted] = await connection.execute("DELETE FROM products WHERE id = ?", [productId]);

    await connection.commit();

    if (!deleted.affectedRows) {
      response.status(404).json({ message: "Mahsulot topilmadi." });
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
