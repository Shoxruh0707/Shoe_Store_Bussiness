-- Shoes Store Database DDL
-- MySQL 8+ compatible
-- Rewritten based on the updated DrawSQL schema
-- Main update: season moved from products table into product_seasons table
-- so one product can belong to multiple seasons.

CREATE DATABASE IF NOT EXISTS shoes_store_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE shoes_store_db;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS delivery;
DROP TABLE IF EXISTS payment_details;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS product_seasons;
DROP TABLE IF EXISTS product_variant;
DROP TABLE IF EXISTS products;
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
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    password_hash VARCHAR(60) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    role ENUM('customer', 'seller', 'store_owner', 'admin') NOT NULL DEFAULT 'customer'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_role ON users(role);

-- =========================
-- Store
-- =========================
CREATE TABLE store (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_name VARCHAR(50) NOT NULL,
    owner_id INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    store_image VARCHAR(500),
    phone_number VARCHAR(15),
    description TEXT,
    telegram_username VARCHAR(100),

    CONSTRAINT fk_store_owner
        FOREIGN KEY (owner_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_store_owner_id ON store(owner_id);
CREATE INDEX idx_store_is_active ON store(is_active);

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
    id INT AUTO_INCREMENT PRIMARY KEY UNIQUE,
    art_no VARCHAR(50) NOT NULL,
    name VARCHAR(50) NOT NULL,
    brand_id INT NOT NULL,
    type_id INT NOT NULL,
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

    CONSTRAINT chk_products_price
        CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_type_id ON products(type_id);
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

-- =========================
-- Orders
-- =========================
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'reserved', 'paid', 'processing', 'completed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_orders_total_amount
        CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    inventory_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    store_id INT NOT NULL,

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_order_items_inventory
        FOREIGN KEY (inventory_id) REFERENCES inventory(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_items_store
        FOREIGN KEY (store_id) REFERENCES store(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_items_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_order_items_unit_price
        CHECK (unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_inventory_id ON order_items(inventory_id);
CREATE INDEX idx_order_items_store_id ON order_items(store_id);
CREATE INDEX idx_order_items_order_store ON order_items(order_id, store_id);

-- =========================
-- Payments
-- =========================
CREATE TABLE payment_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    payment_type ENUM('cash', 'card', 'click', 'payme', 'uzum', 'other') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    transaction_id VARCHAR(100),
    paid_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_payment_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_payment_transaction_id
        UNIQUE (transaction_id),

    CONSTRAINT chk_payment_amount
        CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_payment_order_id ON payment_details(order_id);
CREATE INDEX idx_payment_status ON payment_details(payment_status);

-- =========================
-- Delivery
-- =========================
CREATE TABLE delivery (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    delivery_type ENUM('pickup', 'courier', 'taxi', 'other') NOT NULL,
    address VARCHAR(255),
    longitude DECIMAL(11,8),
    latitude DECIMAL(10,8),
    delivery_status ENUM('pending', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_delivery_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_delivery_order_id ON delivery(order_id);
CREATE INDEX idx_delivery_status ON delivery(delivery_status);
