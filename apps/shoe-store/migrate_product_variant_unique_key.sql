USE shoe_store;

ALTER TABLE Product_Variant
    DROP INDEX art_no,
    ADD UNIQUE product_variant_identity (
        art_no,
        brand_id,
        type_id,
        colour_id,
        material_id,
        Season
    );
