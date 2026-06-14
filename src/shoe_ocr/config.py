"""Configuration constants and OCR regexes."""

from __future__ import annotations

import re

GROUNDING_DINO_MODEL = "IDEA-Research/grounding-dino-tiny"
BOX_PROMPT = "cardboard shoe box. shoe box. carton box."
MAX_IMAGE_DIMENSION = 3000
MAX_OCR_CROP_DIMENSION = 2400

ART_LABEL_RE = re.compile(
    r"\b(?:ART(?:ICLE)?|STYLE|MODEL)[ \t]*(?:NO|NC|NUMBER|#|N[O0C]\.?)?"
    r"[ \t]*[:\-]?[ \t]*"
    r"([A-Z0-9][A-Z0-9./_-]{2,})\b"
)
COLOUR_RE = re.compile(
    r"\b(?:COL(?:O|OU|LO)R|GOLOR)\s*[:;\-]*[ \t]*"
    r"([A-Z][A-Z0-9]*(?:[.\-/_ ][A-Z0-9]+)*)"
)
MODEL_CODE_RE = re.compile(
    r"\b(?=[A-Z0-9./_-]{4,20}\b)(?=[A-Z0-9./_-]*[A-Z])"
    r"(?=[A-Z0-9./_-]*\d)[A-Z0-9]+(?:[-/_][A-Z0-9]+)+\b"
)
COMPACT_MODEL_CODE_RE = re.compile(
    r"\b(?=[A-Z0-9]{4,20}\b)(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]+\b"
)
NUMBER_RE = re.compile(r"(?<![A-Z0-9])(\d{1,2}(?:[.,]5)?)(?![A-Z0-9])")
SIZE_LABEL_RE = re.compile(r"\bSIZES?\b")
QTY_LABEL_RE = re.compile(r"\b(?:QTY|QTYS|QUANTIT(?:Y|IES)|PRS?|PAIRS?)\b")
MEAS_LABEL_RE = re.compile(r"\b(?:MEAS|MEASUREMENTS?)\b")

COLOUR_STOP_WORDS = {
    "ART",
    "ARTICLE",
    "STYLE",
    "MODEL",
    "NO",
    "NUMBER",
    "SIZE",
    "SIZES",
    "QTY",
    "QUANTITY",
    "QUANTITIES",
    "PAIR",
    "PAIRS",
    "MADE",
    "IN",
}
KNOWN_COLOURS = {
    "BEIGE",
    "BLACK",
    "BLUE",
    "BROWN",
    "BURGUNDY",
    "CREAM",
    "GOLD",
    "GREEN",
    "GREY",
    "GRAY",
    "KHAKI",
    "NAVY",
    "ORANGE",
    "PINK",
    "PURPLE",
    "RED",
    "SILVER",
    "SILVERY",
    "TAN",
    "WHITE",
    "YELLOW",
}
