#!/usr/bin/env python3
"""Compatibility wrapper for the shoe box OCR CLI and public helpers."""

from __future__ import annotations

import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from shoe_ocr import (
    _apply_article_consensus,
    _declared_quantity,
    _detect_boxes,
    _draw_highlighted_boxes,
    _easyocr_text,
    _format_clean_label,
    _spatial_grid_is_valid,
    _spatial_size_grid,
    build_parser,
    clean_label_text,
    extract_art_no,
    extract_colour,
    extract_from_image,
    extract_size_grid,
    format_report,
    main,
    normalize_text,
    parse_product_text,
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


if __name__ == "__main__":
    raise SystemExit(main())
