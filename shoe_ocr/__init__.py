"""Shoe box/carton OCR package."""

from .cli import build_parser, main
from .reporting import format_report
from .text import (
    _declared_quantity,
    _format_clean_label,
    _spatial_grid_is_valid,
    clean_label_text,
    extract_art_no,
    extract_colour,
    extract_size_grid,
    normalize_text,
    parse_product_text,
)
from .vision import (
    _apply_article_consensus,
    _detect_boxes,
    _draw_highlighted_boxes,
    _easyocr_text,
    _spatial_size_grid,
    extract_from_image,
    save_highlighted_image,
)

__all__ = [
    "_apply_article_consensus",
    "_declared_quantity",
    "_detect_boxes",
    "_draw_highlighted_boxes",
    "_easyocr_text",
    "_format_clean_label",
    "_spatial_grid_is_valid",
    "_spatial_size_grid",
    "build_parser",
    "clean_label_text",
    "extract_art_no",
    "extract_colour",
    "extract_from_image",
    "extract_size_grid",
    "format_report",
    "main",
    "normalize_text",
    "parse_product_text",
    "save_highlighted_image",
]
