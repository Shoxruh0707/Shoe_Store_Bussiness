-- Shoes Store Database DDL
-- MySQL 8+ compatible
-- Updated schema:
-- - users/store relationship is handled by store_users bridge table.
-- - store can have multiple users, and one user can manage multiple stores.
-- - payment_details, delivery, orders, and order_items are removed for now.
-- - products table includes landing_price column.
-- - product seasons are stored in product_seasons table so one product can belong to multiple seasons.
-- - sold_products stores manually marked sales with sold prices.

CREATE DATABASE IF NOT EXISTS shoes_store_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE shoes_store_db;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS sold_products;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS product_seasons;
DROP TABLE IF EXISTS product_variant;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS inventory_access_requests;
DROP TABLE IF EXISTS store_users;
DROP TABLE IF EXISTS store;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS colours;
DROP TABLE IF EXISTS shoe_type;
DROP TABLE IF EXISTS materials;
DROP TABLE IF EXISTS brands;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================
-- Users
-- =========================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fname VARCHAR(20) NOT NULL,
    lname VARCHAR(20) NOT NULL,
    telegram_id BIGINT NULL,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    password_hash CHAR(60) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    role ENUM('customer', 'seller', 'admin') NOT NULL DEFAULT 'customer',

    CONSTRAINT uq_users_telegram_id
        UNIQUE (telegram_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_phone_number ON users(phone_number);

-- =========================
-- Store
-- =========================
CREATE TABLE store (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    store_image VARCHAR(500),
    channel_name_telegram VARCHAR(100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_store_is_active ON store(is_active);
CREATE INDEX idx_store_channel_name_telegram ON store(channel_name_telegram);

-- =========================
-- Store Users
-- =========================
CREATE TABLE store_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    store_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    role ENUM('owner', 'manager', 'staff') NOT NULL DEFAULT 'owner',

    CONSTRAINT uq_store_users_user_store
        UNIQUE (user_id, store_id),

    CONSTRAINT fk_store_users_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_store_users_store
        FOREIGN KEY (store_id) REFERENCES store(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_store_users_user_id ON store_users(user_id);
CREATE INDEX idx_store_users_store_id ON store_users(store_id);
CREATE INDEX idx_store_users_role ON store_users(role);

-- =========================
-- Inventory Access Requests
-- =========================
CREATE TABLE inventory_access_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seller_user_id INT NOT NULL,
    store_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME NULL,
    responded_by_user_id INT NULL,

    CONSTRAINT fk_inventory_access_requests_seller
        FOREIGN KEY (seller_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_inventory_access_requests_store
        FOREIGN KEY (store_id) REFERENCES store(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_inventory_access_requests_responder
        FOREIGN KEY (responded_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_inventory_access_requests_seller ON inventory_access_requests(seller_user_id);
CREATE INDEX idx_inventory_access_requests_store ON inventory_access_requests(store_id);
CREATE INDEX idx_inventory_access_requests_status ON inventory_access_requests(status);

-- =========================
-- Lookup Tables
-- =========================
CREATE TABLE brands (
    id INT AUTO_INCREMENT PRIMARY KEY,
    brand_name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_type VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE shoe_type (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE colours (
    id INT AUTO_INCREMENT PRIMARY KEY,
    colour_name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- Products
-- =========================
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    art_no VARCHAR(50) NOT NULL,
    name VARCHAR(50) NOT NULL,
    brand_id INT NOT NULL,
    type_id INT NOT NULL,
    landing_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price DECIMAL(10,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_products_brand
        FOREIGN KEY (brand_id) REFERENCES brands(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_products_type
        FOREIGN KEY (type_id) REFERENCES shoe_type(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_products_landing_price
        CHECK (landing_price >= 0),

    CONSTRAINT chk_products_price
        CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_type_id ON products(type_id);
CREATE INDEX idx_products_art_no ON products(art_no);
CREATE INDEX idx_products_name ON products(name);

-- One product can belong to multiple seasons.
CREATE TABLE product_seasons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    season ENUM('spring', 'summer', 'autumn', 'winter', 'all_season') NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_seasons_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_product_season
        UNIQUE (product_id, season)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_product_seasons_product_id ON product_seasons(product_id);
CREATE INDEX idx_product_seasons_season ON product_seasons(season);

CREATE TABLE product_variant (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    colour_id INT NOT NULL,
    material_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_variant_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_product_variant_colour
        FOREIGN KEY (colour_id) REFERENCES colours(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_product_variant_material
        FOREIGN KEY (material_id) REFERENCES materials(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_product_variant
        UNIQUE (product_id, colour_id, material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_product_variant_product_id ON product_variant(product_id);
CREATE INDEX idx_product_variant_colour_id ON product_variant(colour_id);
CREATE INDEX idx_product_variant_material_id ON product_variant(material_id);

CREATE TABLE product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_variant_id INT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_images_variant
        FOREIGN KEY (product_variant_id) REFERENCES product_variant(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_product_images_variant_id ON product_images(product_variant_id);

-- =========================
-- Inventory
-- =========================
CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_variant_id INT NOT NULL,
    size ENUM('33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44') NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    store_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_variant
        FOREIGN KEY (product_variant_id) REFERENCES product_variant(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_store
        FOREIGN KEY (store_id) REFERENCES store(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_inventory_variant_size_store
        UNIQUE (product_variant_id, size, store_id),

    CONSTRAINT chk_inventory_quantity
        CHECK (quantity >= 0),

    CONSTRAINT chk_inventory_price
        CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_inventory_product_variant_id ON inventory(product_variant_id);
CREATE INDEX idx_inventory_store_id ON inventory(store_id);
CREATE INDEX idx_inventory_size ON inventory(size);

-- New sold-product feature code starts.
-- =========================
-- Sold Products
-- =========================
CREATE TABLE sold_products (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_sold_products_store_id ON sold_products(store_id);
CREATE INDEX idx_sold_products_user_id ON sold_products(user_id);
CREATE INDEX idx_sold_products_product_variant_id ON sold_products(product_variant_id);
CREATE INDEX idx_sold_products_sold_at ON sold_products(sold_at);
-- New sold-product feature code ends.
