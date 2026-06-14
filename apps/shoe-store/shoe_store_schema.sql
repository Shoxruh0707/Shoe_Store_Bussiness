CREATE DATABASE IF NOT EXISTS shoe_store;
USE shoe_store;

-- =====================================
-- Brands
-- =====================================
CREATE TABLE Brands (
    id INT AUTO_INCREMENT PRIMARY KEY,
    brand_name VARCHAR(10) NOT NULL
);

-- =====================================
-- Materials
-- =====================================
CREATE TABLE Materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Material_type VARCHAR(10) NOT NULL
);

-- =====================================
-- Colours
-- =====================================
CREATE TABLE Colours (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Colours VARCHAR(10) NOT NULL
);

-- =====================================
-- Shoe Types
-- =====================================
CREATE TABLE shoe_type (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Type VARCHAR(10) NOT NULL
);

-- =====================================
-- Product Variants
-- =====================================
CREATE TABLE Product_Variant (
    id INT AUTO_INCREMENT PRIMARY KEY,
    art_no VARCHAR(10) NOT NULL,
    brand_id INT NOT NULL,
    type_id INT NOT NULL,
    colour_id INT NOT NULL,
    material_id INT NOT NULL,

    original_price DECIMAL(10,2) NOT NULL,
    price DECIMAL(10,2) NOT NULL,

    Season ENUM(
        'Spring',
        'Summer',
        'Autumn',
        'Winter',
        'All Season'
    ) NOT NULL,

    FOREIGN KEY (brand_id) REFERENCES Brands(id),
    FOREIGN KEY (type_id) REFERENCES shoe_type(id),
    FOREIGN KEY (colour_id) REFERENCES Colours(id),
    FOREIGN KEY (material_id) REFERENCES Materials(id),

    UNIQUE (
        art_no,
        brand_id,
        type_id,
        colour_id,
        material_id,
        Season
    )
);

-- =====================================
-- Product Images
-- =====================================
CREATE TABLE ProductImages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_variant_id INT NOT NULL,
    image_path VARCHAR(500) NOT NULL,

    FOREIGN KEY (product_variant_id)
        REFERENCES Product_Variant(id)
        ON DELETE CASCADE
);

-- =====================================
-- Inventory
-- =====================================
CREATE TABLE Inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,

    product_variant_id INT NOT NULL,

    size ENUM(
        '33','34','35','36','37',
        '38','39','40','41','42',
        '43','44','45'
    ) NOT NULL,

    Quantity INT NOT NULL DEFAULT 0,

    UNIQUE(product_variant_id, size),

    FOREIGN KEY (product_variant_id)
        REFERENCES Product_Variant(id)
);

-- =====================================
-- Customer Details
-- =====================================
CREATE TABLE Customer_Details (
    id INT AUTO_INCREMENT PRIMARY KEY,

    fname VARCHAR(20) NOT NULL,
    lname VARCHAR(20) NOT NULL,

    phone_number VARCHAR(15) NOT NULL UNIQUE,

    password_hash CHAR(60) NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================
-- Orders
-- =====================================
CREATE TABLE Orders (
    id INT AUTO_INCREMENT PRIMARY KEY,

    Customer_id INT NOT NULL,

    Created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    Address VARCHAR(50),

    longitude DECIMAL(8,6),
    latitude DECIMAL(8,6),

    status ENUM(
        'Pending',
        'Confirmed',
        'Packed',
        'Shipped',
        'Delivered',
        'Cancelled'
    ) DEFAULT 'Pending',

    Total_amount DECIMAL(10,2) DEFAULT 0,

    FOREIGN KEY (Customer_id)
        REFERENCES Customer_Details(id)
);

-- =====================================
-- Order Items
-- =====================================
CREATE TABLE Order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,

    order_id INT NOT NULL,
    Inventory_id INT NOT NULL,

    Quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,

    FOREIGN KEY (order_id)
        REFERENCES Orders(id)
        ON DELETE CASCADE,

    FOREIGN KEY (Inventory_id)
        REFERENCES Inventory(id)
);

-- =====================================
-- Payment Details
-- =====================================
CREATE TABLE payment_details (
    id INT AUTO_INCREMENT PRIMARY KEY,

    order_id INT NOT NULL,

    payment_type ENUM(
        'Cash',
        'Card',
        'Click',
        'Payme'
    ) NOT NULL,

    amount DECIMAL(10,2) NOT NULL,

    payment_status ENUM(
        'Pending',
        'Paid',
        'Failed',
        'Refunded'
    ) DEFAULT 'Pending',

    transaction_id VARCHAR(100),

    paid_at DATETIME,

    FOREIGN KEY (order_id)
        REFERENCES Orders(id)
        ON DELETE CASCADE
);

-- =====================================
-- Sales History
-- =====================================
CREATE TABLE Sales_History (
    id INT AUTO_INCREMENT PRIMARY KEY,

    order_id INT NOT NULL,
    order_item_id INT NOT NULL,

    product_variant_id INT NOT NULL,
    inventory_id INT NOT NULL,

    size ENUM(
        '33','34','35','36','37',
        '38','39','40','41','42',
        '43','44','45'
    ) NOT NULL,

    unit_price DECIMAL(10,2) NOT NULL,

    sold_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id)
        REFERENCES Orders(id),

    FOREIGN KEY (order_item_id)
        REFERENCES Order_items(id),

    FOREIGN KEY (product_variant_id)
        REFERENCES Product_Variant(id),

    FOREIGN KEY (inventory_id)
        REFERENCES Inventory(id)
);
