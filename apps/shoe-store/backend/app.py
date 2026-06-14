import os
import re
import uuid
from decimal import Decimal
from datetime import date, datetime
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename


load_dotenv()

app = Flask(__name__)
CORS(app)

ROOT = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = ROOT / "frontend" / "public" / "uploads" / "products"
DEFAULT_COLOUR = "Unknown"
DEFAULT_MATERIAL = "Unknown"
AVAILABLE_SIZES = [str(size) for size in range(33, 46)]
SEASONS = {"Spring", "Summer", "Autumn", "Winter", "All Season"}


def db_config():
    return {
        "host": os.getenv("DB_HOST", "127.0.0.1"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", "909014851"),
        "database": os.getenv("DB_NAME", "shoe_store"),
    }


def get_connection():
    return mysql.connector.connect(**db_config())


def json_safe(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def product_table(cursor):
    configured = os.getenv("PRODUCT_TABLE", "Product_Variant")
    cursor.execute(
        """
        SELECT table_name AS name
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = %s
        """,
        (configured,),
    )
    row = cursor.fetchone()
    if row:
        return row["name"]

    cursor.execute(
        """
        SELECT table_name AS name
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND LOWER(table_name) IN ('product_variant', 'products', 'product')
        ORDER BY FIELD(LOWER(table_name), 'product_variant', 'products', 'product')
        LIMIT 1
        """
    )
    row = cursor.fetchone()
    if row:
        return row["name"]

    raise RuntimeError(
        f"Product table not found. Set PRODUCT_TABLE in backend/.env. Tried '{configured}'."
    )


def product_columns(cursor, table):
    cursor.execute(
        """
        SELECT
            column_name AS name,
            data_type AS data_type,
            is_nullable AS is_nullable,
            column_default AS column_default,
            extra AS extra,
            character_maximum_length AS max_length,
            numeric_precision AS numeric_precision,
            numeric_scale AS numeric_scale
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table,),
    )
    columns = []
    for row in cursor.fetchall():
        extra = (row["extra"] or "").lower()
        default = row["column_default"]
        is_auto = "auto_increment" in extra
        columns.append(
            {
                "name": row["name"],
                "type": row["data_type"],
                "required": row["is_nullable"] == "NO" and default is None and not is_auto,
                "auto": is_auto,
                "maxLength": row["max_length"],
                "precision": row["numeric_precision"],
                "scale": row["numeric_scale"],
            }
        )
    return columns


def lookup_label_column(cursor, table):
    cursor.execute(
        """
        SELECT column_name AS name
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = %s
          AND column_name <> 'id'
          AND data_type IN ('varchar', 'char', 'text')
        ORDER BY ordinal_position
        LIMIT 1
        """,
        (table,),
    )
    row = cursor.fetchone()
    return row["name"] if row else "id"


def foreign_key_options(cursor, table):
    cursor.execute(
        """
        SELECT
            column_name AS column_name,
            referenced_table_name AS referenced_table_name
        FROM information_schema.key_column_usage
        WHERE table_schema = DATABASE()
          AND table_name = %s
          AND referenced_table_name IS NOT NULL
        """,
        (table,),
    )
    references = cursor.fetchall()
    options_by_column = {}

    for reference in references:
        column_name = reference["column_name"]
        referenced_table = reference["referenced_table_name"]
        label_column = lookup_label_column(cursor, referenced_table)
        cursor.execute(
            f"SELECT `id`, `{label_column}` AS label FROM `{referenced_table}` ORDER BY `{label_column}` LIMIT 200"
        )
        options_by_column[column_name] = [
            {"value": row["id"], "label": str(row["label"])}
            for row in cursor.fetchall()
        ]

    return options_by_column


def editable_columns(columns):
    ignored_names = {"id", "created_at", "updated_at", "deleted_at"}
    return [
        column
        for column in columns
        if not column["auto"] and column["name"].lower() not in ignored_names
    ]


def coerce_value(column, raw):
    if raw is None or raw == "":
        return None

    data_type = column["type"].lower()
    if data_type in {"int", "integer", "bigint", "smallint", "mediumint", "tinyint"}:
        return int(raw)
    if data_type in {"decimal", "numeric", "float", "double", "real"}:
        return float(raw)
    if data_type in {"bool", "boolean"}:
        return bool(raw)
    return raw


def normalize_text(value):
    value = (value or "").strip()
    return re.sub(r"\s+", " ", value)


def get_lookup_options(cursor, table, id_column, label_column):
    cursor.execute(
        f"SELECT `{id_column}` AS value, `{label_column}` AS label FROM `{table}` ORDER BY `{label_column}`"
    )
    return [{"value": row["value"], "label": row["label"]} for row in cursor.fetchall()]


def get_or_create_lookup(cursor, table, label_column, value):
    value = normalize_text(value)
    if not value:
        raise ValueError(f"{label_column} is required")

    cursor.execute(
        f"SELECT id FROM `{table}` WHERE LOWER(`{label_column}`) = LOWER(%s) LIMIT 1",
        (value,),
    )
    row = cursor.fetchone()
    if row:
        return row["id"]

    cursor.execute(f"INSERT INTO `{table}` (`{label_column}`) VALUES (%s)", (value,))
    return cursor.lastrowid


def get_or_create_size(cursor, size_value):
    size = str(Decimal(str(size_value)).normalize())
    if size not in AVAILABLE_SIZES:
        raise ValueError(f"Size {size} is not allowed")
    return size


def find_product_variant(cursor, art_no, brand_id, type_id, colour_id, material_id, season):
    cursor.execute(
        """
        SELECT id
        FROM Product_Variant
        WHERE art_no = %s
          AND brand_id = %s
          AND type_id = %s
          AND colour_id = %s
          AND material_id = %s
          AND Season = %s
        LIMIT 1
        """,
        (art_no, brand_id, type_id, colour_id, material_id, season),
    )
    return cursor.fetchone()


def parse_size_expression(expression):
    quantities = {}
    expression = normalize_text(expression)
    if not expression:
        return quantities

    range_pattern = re.compile(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)")
    for start_raw, end_raw in range_pattern.findall(expression):
        start = int(float(start_raw))
        end = int(float(end_raw))
        if start > end:
            start, end = end, start
        for size in range(start, end + 1):
            quantities[Decimal(size)] = max(quantities.get(Decimal(size), 0), 1)

    expression_without_ranges = range_pattern.sub(" ", expression)
    token_pattern = re.compile(r"(\d+(?:\.\d+)?)(?:\s*[xX]\s*(\d+))?")
    for size_raw, qty_raw in token_pattern.findall(expression_without_ranges):
        size = Decimal(size_raw)
        qty = int(qty_raw or "1")
        quantities[size] = max(qty, 0)

    return {size: qty for size, qty in quantities.items() if qty > 0}


def parse_selected_sizes(values):
    quantities = {}
    for value in values:
        size = Decimal(str(value))
        quantities[size] = quantities.get(size, 0) + 1
    return quantities


def merge_quantities(*groups):
    merged = {}
    for group in groups:
        for size, qty in group.items():
            merged[size] = max(merged.get(size, 0), qty)
    return merged


def save_product_images(cursor, product_variant_id, files):
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    saved = []

    for index, image in enumerate(files, start=1):
        if not image or not image.filename:
            continue

        filename = secure_filename(image.filename)
        extension = Path(filename).suffix.lower()
        if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise ValueError("Images must be JPG, PNG, or WEBP files")

        unique_name = f"{product_variant_id}_{index}_{uuid.uuid4().hex}{extension}"
        file_path = UPLOAD_ROOT / unique_name
        image.save(file_path)

        public_path = f"/uploads/products/{unique_name}"
        cursor.execute(
            "INSERT INTO ProductImages (product_variant_id, image_path) VALUES (%s, %s)",
            (product_variant_id, public_path),
        )
        saved.append(public_path)

    return saved


def fetch_store_products(cursor, limit=None):
    limit_clause = "LIMIT %s" if limit else ""
    params = (limit,) if limit else ()
    cursor.execute(
        f"""
        SELECT
            pv.id,
            pv.art_no,
            pv.original_price,
            b.brand_name,
            st.`Type` AS type_name,
            c.Colours AS colour_name,
            m.Material_type AS material_type,
            pv.price,
            pv.Season AS season,
            NULL AS created_at,
            COALESCE(SUM(i.Quantity), 0) AS stock_quantity,
            GROUP_CONCAT(DISTINCT i.size ORDER BY CAST(i.size AS UNSIGNED) SEPARATOR ',') AS sizes,
            (
                SELECT pi.image_path
                FROM ProductImages pi
                WHERE pi.product_variant_id = pv.id
                ORDER BY pi.id
                LIMIT 1
            ) AS image_path
        FROM Product_Variant pv
        JOIN Brands b ON b.id = pv.brand_id
        JOIN shoe_type st ON st.id = pv.type_id
        JOIN Colours c ON c.id = pv.colour_id
        JOIN Materials m ON m.id = pv.material_id
        LEFT JOIN Inventory i ON i.product_variant_id = pv.id
        GROUP BY pv.id, pv.art_no, pv.original_price, b.brand_name, st.`Type`, c.Colours, m.Material_type, pv.price, pv.Season
        ORDER BY pv.id DESC
        {limit_clause}
        """,
        params,
    )
    return [store_product_from_row(row) for row in cursor.fetchall()]


def store_product_from_row(row):
    sizes = []
    if row.get("sizes"):
        sizes = [size.rstrip("0").rstrip(".") for size in str(row["sizes"]).split(",")]

    name = f"{row['brand_name']} {row['type_name']} {row['art_no']}"
    return {
        "id": str(row["id"]),
        "artNo": row["art_no"],
        "name": name,
        "originalPrice": json_safe(row.get("original_price")),
        "price": json_safe(row["price"]),
        "season": row.get("season"),
        "category": row["type_name"],
        "color": row["colour_name"],
        "colors": [row["colour_name"]],
        "sizes": sizes,
        "material": row["material_type"],
        "type": row["type_name"],
        "brand": row["brand_name"],
        "image": row.get("image_path"),
        "rating": 5,
        "reviews": 0,
        "description": f"{row['brand_name']} {row['type_name']} in {row['colour_name']} with {row['material_type']} material.",
        "inStock": int(row.get("stock_quantity") or 0) > 0,
        "stockQuantity": int(row.get("stock_quantity") or 0),
        "createdAt": json_safe(row.get("created_at")),
    }


def fetch_store_product(cursor, product_id):
    cursor.execute(
        """
        SELECT
            pv.id,
            pv.art_no,
            pv.original_price,
            b.brand_name,
            st.`Type` AS type_name,
            c.Colours AS colour_name,
            m.Material_type AS material_type,
            pv.price,
            pv.Season AS season,
            NULL AS created_at,
            COALESCE(SUM(i.Quantity), 0) AS stock_quantity,
            GROUP_CONCAT(DISTINCT i.size ORDER BY CAST(i.size AS UNSIGNED) SEPARATOR ',') AS sizes,
            (
                SELECT pi.image_path
                FROM ProductImages pi
                WHERE pi.product_variant_id = pv.id
                ORDER BY pi.id
                LIMIT 1
            ) AS image_path
        FROM Product_Variant pv
        JOIN Brands b ON b.id = pv.brand_id
        JOIN shoe_type st ON st.id = pv.type_id
        JOIN Colours c ON c.id = pv.colour_id
        JOIN Materials m ON m.id = pv.material_id
        LEFT JOIN Inventory i ON i.product_variant_id = pv.id
        WHERE pv.id = %s
        GROUP BY pv.id, pv.art_no, pv.original_price, b.brand_name, st.`Type`, c.Colours, m.Material_type, pv.price, pv.Season
        """,
        (product_id,),
    )
    row = cursor.fetchone()
    if not row:
        return None

    product = store_product_from_row(row)
    cursor.execute(
        """
        SELECT image_path
        FROM ProductImages
        WHERE product_variant_id = %s
        ORDER BY id
        """,
        (product_id,),
    )
    images = [image["image_path"] for image in cursor.fetchall()]
    product["images"] = images or ([product["image"]] if product["image"] else [])
    return product


@app.get("/api/health")
def health():
    try:
        with get_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT DATABASE() AS db")
            row = cursor.fetchone()
        return jsonify({"ok": True, "database": row["db"]})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.get("/api/products/schema")
def products_schema():
    try:
        with get_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            table = product_table(cursor)
            columns = product_columns(cursor, table)
            options_by_column = foreign_key_options(cursor, table)

        editable = editable_columns(columns)
        for column in editable:
            column["options"] = options_by_column.get(column["name"], [])

        return jsonify({"table": table, "columns": editable})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.get("/api/products/form-data")
def product_form_data():
    try:
        with get_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            return jsonify(
                {
                    "brands": get_lookup_options(cursor, "Brands", "id", "brand_name"),
                    "types": get_lookup_options(cursor, "shoe_type", "id", "Type"),
                    "colours": get_lookup_options(cursor, "Colours", "id", "Colours"),
                    "materials": get_lookup_options(cursor, "Materials", "id", "Material_type"),
                    "sizes": [{"value": size, "label": size} for size in AVAILABLE_SIZES],
                    "seasons": [{"value": season, "label": season} for season in sorted(SEASONS)],
                }
            )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.get("/uploads/products/<path:filename>")
def uploaded_product_image(filename):
    return send_from_directory(UPLOAD_ROOT, filename)


@app.get("/api/store/products")
def store_products():
    try:
        limit_raw = request.args.get("limit")
        limit = int(limit_raw) if limit_raw else None
        with get_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            products = fetch_store_products(cursor, limit)
        return jsonify({"products": products})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.get("/api/store/products/<int:product_id>")
def store_product(product_id):
    try:
        with get_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            product = fetch_store_product(cursor, product_id)
            if not product:
                return jsonify({"error": "Product not found"}), 404
            related = [
                item for item in fetch_store_products(cursor, 4) if item["id"] != str(product_id)
            ][:3]
        return jsonify({"product": product, "relatedProducts": related})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.get("/api/store/inventory")
def store_inventory():
    try:
        with get_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                """
                SELECT
                    i.id,
                    CONCAT(b.brand_name, ' ', st.`Type`, ' ', pv.art_no) AS product,
                    c.Colours AS color,
                    i.size AS size,
                    i.Quantity AS quantity,
                    NULL AS updated_at
                FROM Inventory i
                JOIN Product_Variant pv ON pv.id = i.product_variant_id
                JOIN Brands b ON b.id = pv.brand_id
                JOIN shoe_type st ON st.id = pv.type_id
                JOIN Colours c ON c.id = pv.colour_id
                ORDER BY i.id DESC
                """
            )
            inventory = [
                {
                    "id": str(row["id"]),
                    "product": row["product"],
                    "color": row["color"],
                    "size": str(row["size"]).rstrip("0").rstrip("."),
                    "quantity": int(row["quantity"]),
                    "reorderLevel": 5,
                    "lastRestocked": json_safe(row["updated_at"]),
                }
                for row in cursor.fetchall()
            ]
        return jsonify({"inventory": inventory})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.get("/api/products")
def list_products():
    try:
        with get_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                """
                SELECT
                    pv.id,
                    pv.art_no,
                    pv.original_price,
                    b.brand_name,
                    st.`Type` AS type_name,
                    c.Colours AS colour_name,
                    m.Material_type AS material_type,
                    pv.price,
                    pv.Season AS season,
                    NULL AS created_at,
                    GROUP_CONCAT(CONCAT(i.size, 'x', i.Quantity) ORDER BY CAST(i.size AS UNSIGNED) SEPARATOR ', ') AS inventory
                FROM Product_Variant pv
                JOIN Brands b ON b.id = pv.brand_id
                JOIN shoe_type st ON st.id = pv.type_id
                JOIN Colours c ON c.id = pv.colour_id
                JOIN Materials m ON m.id = pv.material_id
                LEFT JOIN Inventory i ON i.product_variant_id = pv.id
                GROUP BY pv.id, pv.art_no, pv.original_price, b.brand_name, st.`Type`, c.Colours, m.Material_type, pv.price, pv.Season
                ORDER BY pv.id DESC
                LIMIT 25
                """
            )
            rows = [
                {key: json_safe(value) for key, value in row.items()}
                for row in cursor.fetchall()
            ]
        return jsonify({"products": rows})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.post("/api/products")
def create_product():
    try:
        with get_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            art_no = normalize_text(request.form.get("art_no"))
            brand_name = normalize_text(request.form.get("brand_name"))
            type_name = normalize_text(request.form.get("type_name"))
            colour_name = normalize_text(request.form.get("colour_name")) or DEFAULT_COLOUR
            material_type = normalize_text(request.form.get("material_type")) or DEFAULT_MATERIAL
            price_raw = normalize_text(request.form.get("price"))
            original_price_raw = normalize_text(request.form.get("original_price")) or price_raw
            season = normalize_text(request.form.get("season")) or "All Season"
            size_expression = request.form.get("size_expression", "")
            selected_sizes = request.form.getlist("selected_sizes")

            if not art_no:
                return jsonify({"error": "Art no is required"}), 400
            if not brand_name:
                return jsonify({"error": "Brand name is required"}), 400
            if not type_name:
                return jsonify({"error": "Type is required"}), 400
            if not price_raw:
                return jsonify({"error": "Initial price is required"}), 400

            price = Decimal(price_raw)
            original_price = Decimal(original_price_raw)
            if price < 0:
                return jsonify({"error": "Initial price cannot be negative"}), 400
            if original_price < 0:
                return jsonify({"error": "Original price cannot be negative"}), 400
            if season not in SEASONS:
                return jsonify({"error": "Invalid season"}), 400

            inventory_quantities = merge_quantities(
                parse_selected_sizes(selected_sizes),
                parse_size_expression(size_expression),
            )
            if not inventory_quantities:
                return jsonify({"error": "Add at least one size"}), 400

            brand_id = get_or_create_lookup(cursor, "Brands", "brand_name", brand_name)
            type_id = get_or_create_lookup(cursor, "shoe_type", "Type", type_name)
            colour_id = get_or_create_lookup(cursor, "Colours", "Colours", colour_name)
            material_id = get_or_create_lookup(cursor, "Materials", "Material_type", material_type)

            existing_variant = find_product_variant(
                cursor,
                art_no,
                brand_id,
                type_id,
                colour_id,
                material_id,
                season,
            )
            created = existing_variant is None

            if existing_variant:
                product_variant_id = existing_variant["id"]
            else:
                cursor.execute(
                    """
                    INSERT INTO Product_Variant
                        (art_no, brand_id, type_id, colour_id, material_id, original_price, price, Season)
                    VALUES
                        (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        art_no,
                        brand_id,
                        type_id,
                        colour_id,
                        material_id,
                        original_price,
                        price,
                        season,
                    ),
                )
                product_variant_id = cursor.lastrowid

            for size, quantity in inventory_quantities.items():
                inventory_size = get_or_create_size(cursor, size)
                cursor.execute(
                    """
                    INSERT INTO Inventory (product_variant_id, size, Quantity)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE Quantity = Quantity + VALUES(Quantity)
                    """,
                    (product_variant_id, inventory_size, quantity),
                )

            images = save_product_images(
                cursor,
                product_variant_id,
                request.files.getlist("images"),
            )
            conn.commit()

        status_code = 201 if created else 200
        return jsonify(
            {
                "ok": True,
                "id": product_variant_id,
                "created": created,
                "images": images,
            }
        ), status_code
    except ValueError as exc:
        return jsonify({"error": f"Invalid field value: {exc}"}), 400
    except mysql.connector.IntegrityError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "5000"))
    app.run(host=host, port=port, debug=True)
