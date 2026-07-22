CREATE DATABASE IF NOT EXISTS shoes_store_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE shoes_store_db;

-- =====================================================
-- BRANDS
-- =====================================================

CREATE TABLE brands (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    brand_name VARCHAR(50) NOT NULL UNIQUE
);

-- =====================================================
-- COLOURS
-- =====================================================

CREATE TABLE colours (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    colour_name VARCHAR(50) NOT NULL UNIQUE
);

-- =====================================================
-- MATERIALS
-- =====================================================

CREATE TABLE materials (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    material_type VARCHAR(50) NOT NULL UNIQUE
);

-- =====================================================
-- SHOE TYPES
-- =====================================================

CREATE TABLE shoe_type (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL UNIQUE
);

-- =====================================================
-- STORES
-- =====================================================

CREATE TABLE store (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    store_image VARCHAR(500),
    channel_name_telegram VARCHAR(100),

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- USERS
-- =====================================================

CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    fname VARCHAR(20) NOT NULL,
    lname VARCHAR(20) NOT NULL,

    telegram_id BIGINT UNIQUE,
    phone_number VARCHAR(15) NOT NULL UNIQUE,

    password_hash CHAR(60) NOT NULL,

    role ENUM(
        'customer',
        'seller',
        'admin'
    ) NOT NULL DEFAULT 'customer',

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PRODUCTS
-- =====================================================

CREATE TABLE products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    art_no VARCHAR(50) NOT NULL,
    name VARCHAR(50) NOT NULL,

    brand_id INT UNSIGNED NOT NULL,
    type_id INT UNSIGNED NOT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_products_brand_id (brand_id),
    INDEX idx_products_type_id (type_id),

    CONSTRAINT fk_products_brand
        FOREIGN KEY (brand_id)
        REFERENCES brands(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_products_type
        FOREIGN KEY (type_id)
        REFERENCES shoe_type(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- =====================================================
-- PRODUCT VARIANTS
-- =====================================================

CREATE TABLE product_variant (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    product_id INT UNSIGNED NOT NULL,
    store_id INT UNSIGNED NOT NULL,

    colour_id INT UNSIGNED NOT NULL,
    material_id INT UNSIGNED NOT NULL,

    price DECIMAL(10,2) NOT NULL,
    landing_price DECIMAL(10,2) NOT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_product_variant (
        product_id,
        colour_id,
        material_id,
        store_id
    ),

    INDEX idx_variant_product (product_id),
    INDEX idx_variant_store (store_id),
    INDEX idx_variant_colour (colour_id),
    INDEX idx_variant_material (material_id),

    CONSTRAINT fk_variant_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_variant_store
        FOREIGN KEY (store_id)
        REFERENCES store(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_variant_colour
        FOREIGN KEY (colour_id)
        REFERENCES colours(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_variant_material
        FOREIGN KEY (material_id)
        REFERENCES materials(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- =====================================================
-- PRODUCT IMAGES
-- =====================================================

CREATE TABLE product_images (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    product_variant_id INT UNSIGNED NOT NULL,
    image_path VARCHAR(500) NOT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    isProcessed BOOLEAN NOT NULL DEFAULT FALSE,

    INDEX idx_product_images_variant (product_variant_id),

    CONSTRAINT fk_product_images_variant
        FOREIGN KEY (product_variant_id)
        REFERENCES product_variant(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- =====================================================
-- PRODUCT SEASONS
-- =====================================================

CREATE TABLE product_seasons (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    product_id INT UNSIGNED NOT NULL,

    season ENUM(
        'spring',
        'summer',
        'autumn',
        'winter',
        'all_season'
    ) NOT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_product_season (
        product_id,
        season
    ),

    CONSTRAINT fk_product_seasons_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- =====================================================
-- INVENTORY
-- =====================================================

CREATE TABLE inventory (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    product_variant_id INT UNSIGNED NOT NULL,
    store_id INT UNSIGNED NOT NULL,

    size ENUM(
        '33','34','35','36',
        '37','38','39','40',
        '41','42','43','44'
    ) NOT NULL,

    quantity INT NOT NULL DEFAULT 0,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_inventory (
        product_variant_id,
        store_id,
        size
    ),

    INDEX fk_inventory_store (store_id),

    CONSTRAINT fk_inventory_variant
        FOREIGN KEY (product_variant_id)
        REFERENCES product_variant(id),

    CONSTRAINT fk_inventory_store
        FOREIGN KEY (store_id)
        REFERENCES store(id)
);

-- =====================================================
-- BOX STOCK
-- =====================================================

CREATE TABLE box_stock (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    product_variant_id INT UNSIGNED NOT NULL,
    store_id INT UNSIGNED NOT NULL,

    size_range VARCHAR(50) NOT NULL,

    quantity INT NOT NULL DEFAULT 0,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_box_stock_product_variant_id (product_variant_id),
    INDEX idx_box_stock_store_id (store_id),
    INDEX idx_box_stock_quantity (quantity),

    CONSTRAINT fk_box_stock_variant
        FOREIGN KEY (product_variant_id)
        REFERENCES product_variant(id),

    CONSTRAINT fk_box_stock_store
        FOREIGN KEY (store_id)
        REFERENCES store(id)
);

-- =====================================================
-- STORE USERS
-- =====================================================

CREATE TABLE store_users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNSIGNED NOT NULL,
    store_id INT UNSIGNED NOT NULL,

    role ENUM(
        'owner',
        'manager',
        'staff'
    ) NOT NULL DEFAULT 'owner',

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_store_user (
        user_id,
        store_id
    ),

    INDEX fk_store_users_store (store_id),

    CONSTRAINT fk_store_users_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_store_users_store
        FOREIGN KEY (store_id)
        REFERENCES store(id)
        ON DELETE CASCADE
);

-- =====================================================
-- SELLER STORE REQUESTS
-- =====================================================

CREATE TABLE seller_store_requests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    seller_user_id INT UNSIGNED NOT NULL,
    store_id INT UNSIGNED NOT NULL,

    status ENUM(
        'pending',
        'approved',
        'rejected'
    ) NOT NULL DEFAULT 'pending',

    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,

    resolved_by_user_id INT UNSIGNED NULL,

    INDEX idx_seller_store_requests_seller_user_id (seller_user_id),
    INDEX idx_seller_store_requests_store_id (store_id),
    INDEX idx_seller_store_requests_status (status),
    INDEX fk_request_resolver (resolved_by_user_id),

    CONSTRAINT fk_request_seller
        FOREIGN KEY (seller_user_id)
        REFERENCES users(id),

    CONSTRAINT fk_request_store
        FOREIGN KEY (store_id)
        REFERENCES store(id),

    CONSTRAINT fk_request_resolver
        FOREIGN KEY (resolved_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- =====================================================
-- SOLD PAIRS
-- =====================================================

CREATE TABLE sold_products_pair (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    store_id INT UNSIGNED NOT NULL,
    seller_user_id INT UNSIGNED NOT NULL,
    product_variant_id INT UNSIGNED NOT NULL,

    size ENUM(
        '33','34','35','36',
        '37','38','39','40',
        '41','42','43','44'
    ) NOT NULL,

    sold_price DECIMAL(10,2) NOT NULL,
    landing_price DECIMAL(10,2) NOT NULL,
    sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    isCancelled BOOLEAN NOT NULL DEFAULT FALSE,

    INDEX idx_sold_products_pair_store_id (store_id),
    INDEX idx_sold_products_pair_seller_user_id (seller_user_id),
    INDEX idx_sold_products_pair_product_variant_id (product_variant_id),
    INDEX idx_sold_products_pair_sold_at (sold_at),

    CONSTRAINT fk_pair_store
        FOREIGN KEY (store_id)
        REFERENCES store(id),

    CONSTRAINT fk_pair_seller
        FOREIGN KEY (seller_user_id)
        REFERENCES users(id),

    CONSTRAINT fk_pair_variant
        FOREIGN KEY (product_variant_id)
        REFERENCES product_variant(id)
);

-- =====================================================
-- SOLD BOXES
-- =====================================================

CREATE TABLE sold_products_box (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    store_id INT UNSIGNED NOT NULL,
    seller_user_id INT UNSIGNED NOT NULL,

    box_stock_id INT UNSIGNED NOT NULL,

    quantity INT NOT NULL DEFAULT 1,

    sold_price DECIMAL(10,2) NOT NULL,
    landing_price DECIMAL(10,2) NOT NULL,

    sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    isCancelled BOOLEAN NOT NULL DEFAULT FALSE,

    INDEX idx_sold_products_box_store_id (store_id),
    INDEX idx_sold_products_box_seller_user_id (seller_user_id),
    INDEX idx_sold_products_box_box_stock_id (box_stock_id),
    INDEX idx_sold_products_box_sold_at (sold_at),

    CONSTRAINT fk_box_sale_store
        FOREIGN KEY (store_id)
        REFERENCES store(id),

    CONSTRAINT fk_box_sale_seller
        FOREIGN KEY (seller_user_id)
        REFERENCES users(id),

    CONSTRAINT fk_box_sale_stock
        FOREIGN KEY (box_stock_id)
        REFERENCES box_stock(id)
);
