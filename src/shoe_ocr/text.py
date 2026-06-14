"""OCR text cleanup and shoe-label parsing."""

from __future__ import annotations

import difflib
import re
from typing import Any

from .config import (
    ART_LABEL_RE,
    COLOUR_RE,
    COLOUR_STOP_WORDS,
    COMPACT_MODEL_CODE_RE,
    KNOWN_COLOURS,
    MODEL_CODE_RE,
    NUMBER_RE,
    QTY_LABEL_RE,
    SIZE_LABEL_RE,
)

def _preclean_ocr_text(text: str) -> str:
    text = text.upper().replace("\r", "\n")
    replacements = {
        "OTY": "QTY",
        "ATY": "QTY",
        "QIY": "QTY",
        "ART NO.": "ART NO:",
        "ART NO,": "ART NO:",
        "ARTNO;": "ART NO:",
        "ARTNO:": "ART NO:",
        "ARTNO": "ART NO:",
        "L.GRAY": "LGRAY",
        "L GRAY": "LGRAY",
        "LIGHT GRAY": "LGRAY",
    }
    for source, replacement in replacements.items():
        text = text.replace(source, replacement)
    text = re.sub(r"\b(COLOU?R|COLLOR|GOLOR|OLOUR)\s*[;.,:-]*", "COLOUR:", text)
    text = re.sub(r"\b(?:SIZES?)\s*[;.,:-]*", "SIZE:", text)
    text = re.sub(r"\b(?:QTY|QTYS)\s*[;.,:-]*", "QTY:", text)
    text = re.sub(r"\b(?:PRS?|PAIRS?)\s*[;.,:-]*", "PRS:", text)
    text = re.sub(r"\b(?:MEAS|MEASUREMENTS?)\s*[;.,:-]*", "MEAS:", text)
    return text


def normalize_text(text: str) -> str:
    """Normalize OCR text while retaining line boundaries."""
    lines = []
    for line in _preclean_ocr_text(text).splitlines():
        line = re.sub(r"[ \t]+", " ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def _clean_value(value: str) -> str:
    return value.strip(" .,:;|[](){}")


def extract_art_no(text: str) -> str | None:
    match = ART_LABEL_RE.search(text)
    if match:
        value = _clean_value(match.group(1))
        if value not in {"NO", "NO_", "NUMBER", "SIZE", "COLOR", "COLOUR"}:
            return value

    lines = text.splitlines()
    for index, line in enumerate(lines[:-1]):
        if re.search(r"\b(?:ART(?:ICLE)?|STYLE|MODEL)\b", line):
            for candidate in lines[index + 1 : index + 4]:
                if re.fullmatch(r"\s*(?:NO|NC|N[O0C][.:;_-]?)\s*", candidate):
                    continue
                if re.search(
                    r"\b(?:ART|NO|COLOU?R|GOLOR|SIZE|QTY|PRS|KGS|MEAS)\b",
                    candidate,
                ):
                    break
                tokens = re.findall(r"[A-Z0-9./_-]+", candidate)
                for value in tokens:
                    if (
                        len(value) >= 3
                        and re.search(r"\d", value)
                        and (re.search(r"[A-Z]", value) or len(value) >= 4)
                    ):
                        return value
                joined = "".join(tokens)
                if (
                    len(joined) >= 3
                    and re.search(r"\d", joined)
                    and (re.search(r"[A-Z]", joined) or len(joined) >= 4)
                ):
                    return joined

    for match in MODEL_CODE_RE.finditer(text):
        value = _clean_value(match.group(0))
        if (
            not value.startswith(("COL", "COI"))
            and value.count("X") < 2
            and not any(word in value for word in ("COLOR", "COLOUR"))
        ):
            return value
    for match in COMPACT_MODEL_CODE_RE.finditer(text):
        value = match.group(0)
        if (
            not value.endswith("CM")
            and not value.startswith(("NO", "SIZE", "QTY"))
            and not value.startswith(("COL", "COI"))
            and value.count("X") < 2
            and not re.fullmatch(r"\d+X\d+(?:X\d+)?(?:CM)?", value)
            and not value.isdigit()
        ):
            return value
    return None


def extract_colour(text: str) -> str | None:
    lines = text.splitlines()
    for line in lines:
        value = _clean_value(line)
        for word in re.findall(r"[A-Z][A-Z._/-]+", value):
            normalised = _normalise_known_colour(word)
            if _is_colour_value(normalised):
                return normalised
        if not re.search(r"\d", value):
            normalised = _normalise_known_colour(value)
            if _is_colour_value(normalised):
                return normalised

    match = COLOUR_RE.search(text)
    if match:
        words = match.group(1).split()
        kept: list[str] = []
        for word in words:
            if word in COLOUR_STOP_WORDS or re.fullmatch(r"\d+(?:[.,]\d+)?", word):
                break
            kept.append(word)
        value = _clean_value(" ".join(kept))
        if value and not MODEL_CODE_RE.fullmatch(value):
            return value

    for index, line in enumerate(lines):
        if not re.search(r"\b(?:COL(?:O|OU|LO)R|GOLOR|OLOUR)\b", line):
            continue
        for candidate in lines[index + 1 : index + 4]:
            value = _clean_value(candidate)
            normalised = _normalise_known_colour(value)
            if (
                value
                and value not in COLOUR_STOP_WORDS
                and value not in {"PRS", "KGS", "EAC"}
                and not MODEL_CODE_RE.fullmatch(value)
                and not COMPACT_MODEL_CODE_RE.fullmatch(value)
                and not re.search(r"\d", value)
                and (
                    _is_colour_value(normalised)
                    or re.search(r"[._/-]", value)
                    or value.startswith(("L", "D"))
                )
            ):
                return normalised
    return None


def _normalise_known_colour(value: str) -> str:
    if re.search(r"[._/-]", value):
        return value
    compact = re.sub(r"[^A-Z]", "", value)
    if compact in KNOWN_COLOURS:
        return compact
    if (
        len(compact) > 2
        and compact[0] in {"L", "D"}
        and compact[1:] in KNOWN_COLOURS
    ):
        return value
    similar_length = {
        colour for colour in KNOWN_COLOURS if abs(len(colour) - len(compact)) <= 1
    }
    match = difflib.get_close_matches(compact, similar_length, n=1, cutoff=0.78)
    return match[0] if match else value


def _is_colour_value(value: str) -> bool:
    compact = re.sub(r"[^A-Z]", "", value)
    return compact in KNOWN_COLOURS or (
        len(compact) > 2
        and compact[0] in {"L", "D"}
        and compact[1:] in KNOWN_COLOURS
    )


def _numbers(line: str) -> list[str]:
    line = re.sub(r"(?<![A-Z0-9])[I|](?![A-Z0-9])", "1", line.upper())
    return [match.group(1).replace(",", ".") for match in NUMBER_RE.finditer(line)]


def _size_numbers(line: str) -> list[str]:
    values = _numbers(line)
    if len(values) >= 2:
        corrected = values.copy()
        for index in range(1, len(corrected) - 1):
            if _is_size(corrected[index]):
                continue
            previous = float(corrected[index - 1])
            following = float(corrected[index + 1])
            if _is_size(corrected[index - 1]) and _is_size(corrected[index + 1]):
                if following - previous == 2:
                    corrected[index] = _size_key(str(previous + 1))
        if all(_is_size(value) for value in corrected):
            return corrected

    compact = re.sub(r"[^0-9]", "", line)
    if len(compact) >= 6 and len(compact) % 2 == 0:
        values = [compact[index : index + 2] for index in range(0, len(compact), 2)]
        if len(values) >= 3:
            corrected = _repair_size_sequence(values)
            if all(_is_size(value) for value in corrected):
                return corrected
    return values


def _repair_size_sequence(values: list[str]) -> list[str]:
    corrected = values.copy()
    for index in range(1, len(corrected) - 1):
        previous = corrected[index - 1]
        following = corrected[index + 1]
        if not (_is_size(previous) and _is_size(following)):
            continue
        previous_number = float(previous)
        following_number = float(following)
        if following_number - previous_number == 2 and corrected[index] != _size_key(
            str(previous_number + 1)
        ):
            corrected[index] = _size_key(str(previous_number + 1))
    return corrected


def _is_size(value: str) -> bool:
    number = float(value)
    return 15 <= number <= 55


def _is_quantity(value: str) -> bool:
    return "." not in value and 0 <= int(value) <= 20


def _size_key(value: str) -> str:
    return value[:-2] if value.endswith(".0") else value


def _map_grid(sizes: list[str], quantities: list[str]) -> dict[str, int]:
    if not sizes or len(sizes) != len(quantities):
        return {}
    if not all(_is_size(value) for value in sizes):
        return {}
    if not all(_is_quantity(value) for value in quantities):
        return {}
    if len(set(sizes)) != len(sizes):
        return {}
    return {_size_key(size): int(quantity) for size, quantity in zip(sizes, quantities)}


def _declared_quantity(text: str) -> int | None:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if not QTY_LABEL_RE.search(line):
            continue
        for nearby in lines[index : index + 4]:
            values = _numbers(nearby)
            if len(values) == 1 and _is_quantity(values[0]):
                return int(values[0])
    return None


def extract_size_grid(text: str) -> dict[str, int]:
    """Extract the strongest nearby size and quantity rows."""
    lines = text.splitlines()
    candidates: list[tuple[int, dict[str, int]]] = []

    size_rows = [
        (index, _size_numbers(line))
        for index, line in enumerate(lines)
        if SIZE_LABEL_RE.search(line)
    ]
    qty_rows = [
        (index, _numbers(line))
        for index, line in enumerate(lines)
        if QTY_LABEL_RE.search(line)
    ]

    for size_index, sizes in size_rows:
        for qty_index, quantities in qty_rows:
            if abs(size_index - qty_index) <= 5:
                grid = _map_grid(sizes, quantities)
                if grid:
                    score = len(grid) * 10 - abs(size_index - qty_index)
                    candidates.append((score, grid))

    # OCR sometimes places the labels on their own lines and the values below.
    for index, line in enumerate(lines):
        if not SIZE_LABEL_RE.search(line):
            continue
        for size_offset in range(0, 3):
            size_index = index + size_offset
            if size_index >= len(lines):
                continue
            sizes = _size_numbers(lines[size_index])
            for qty_index in range(size_index + 1, min(len(lines), size_index + 6)):
                quantities = _numbers(lines[qty_index])
                grid = _map_grid(sizes, quantities)
                if grid:
                    label_bonus = 5 if QTY_LABEL_RE.search(lines[qty_index]) else 0
                    candidates.append((len(grid) * 10 + label_bonus, grid))

    # Final fallback for two adjacent numeric rows.
    for index in range(len(lines) - 1):
        grid = _map_grid(_size_numbers(lines[index]), _numbers(lines[index + 1]))
        if grid and len(grid) >= 3:
            candidates.append((len(grid) * 10, grid))

    # EasyOCR often reads the size row horizontally but each quantity vertically.
    for index, line in enumerate(lines):
        sizes = _size_numbers(line)
        if len(sizes) < 3 or not all(_is_size(value) for value in sizes):
            continue
        quantities = []
        for following in lines[index + 1 : index + len(sizes) + 3]:
            values = _numbers(following)
            if len(values) == 1 and _is_quantity(values[0]):
                quantities.append(values[0])
                if len(quantities) == len(sizes):
                    break
            elif quantities:
                break
        grid = _map_grid(sizes, quantities)
        if grid:
            candidates.append((len(grid) * 10 + 3, grid))

    declared_quantity = _declared_quantity(text)

    if declared_quantity is not None:
        matching = [
            candidate
            for candidate in candidates
            if sum(candidate[1].values()) == declared_quantity
        ]
        if matching:
            candidates = matching
        elif candidates:
            return {}

    return max(candidates, key=lambda item: item[0])[1] if candidates else {}


def _size_table(sizes: dict[str, int]) -> dict[str, list[Any]]:
    return {
        "sizes": list(sizes.keys()),
        "quantities": list(sizes.values()),
    }


def _spatial_grid_is_valid(
    spatial_sizes: dict[str, int], declared_quantity: int | None
) -> bool:
    if not spatial_sizes or sum(spatial_sizes.values()) <= 0:
        return False
    if declared_quantity is not None:
        return sum(spatial_sizes.values()) == declared_quantity
    return all(quantity > 0 for quantity in spatial_sizes.values())


def parse_product_text(raw_text: str) -> dict[str, Any]:
    normalized = normalize_text(raw_text)
    sizes = extract_size_grid(normalized)
    return {
        "art_no": extract_art_no(normalized),
        "colour": extract_colour(normalized),
        "sizes": sizes,
        "size_table": _size_table(sizes),
        "available_sizes": [
            size for size, quantity in sizes.items() if quantity > 0
        ],
        "raw_text": normalized,
    }


def _format_colour(value: str | None) -> str | None:
    if not value:
        return None
    value = value.replace(".", "").replace(" ", "")
    if value == "LIGHTGRAY":
        return "LGRAY"
    return value


def _normalise_measurement_text(text: str) -> str | None:
    text = _preclean_ocr_text(text)
    text = re.sub(r"\b(\d{1,3})[,.;]S\b", r"\1.5", text)
    text = re.sub(r"\b(\d{1,3})[,.;S](5)\b", r"\1.5", text)
    text = re.sub(r"\b([38])O([.,]5)\b", "30.5", text)
    text = re.sub(r"\b(\d)O([.,]5)\b", r"\g<1>0.5", text)
    text = re.sub(r"\bXT7\b", "X17", text)
    text = text.replace(",", ".")
    text = re.sub(r"\s+", " ", text)

    meas_match = re.search(r"MEAS:\s*(.+)", text)
    search_area = meas_match.group(1) if meas_match else text
    match = re.search(
        r"(\d{1,3}(?:\.5)?)\s*X\s*(\d{1,3}(?:\.5)?)\s*X\s*"
        r"(\d{1,3}(?:\.5)?)(?:\s*CM)?",
        search_area,
    )
    if not match:
        match = re.search(
            r"(\d{1,3}(?:\.5)?)\s*X\s*(\d{1,3}(?:\.5)?)\s+"
            r"(\d{1,3}(?:\.5)?)(?:\s*CM)?",
            search_area,
        )
    if not match:
        return None
    return f"{match.group(1)} X {match.group(2)} X {match.group(3)} CM"


def _format_clean_label(parsed: dict[str, Any], source_text: str) -> str:
    declared_quantity = _declared_quantity(parsed["raw_text"])
    measurement = _normalise_measurement_text(source_text)
    has_product_data = bool(
        parsed["art_no"] or parsed["colour"] or parsed["sizes"] or declared_quantity or measurement
    )
    if not has_product_data:
        return "NO_PRODUCT_DATA"

    lines: list[str] = []
    if parsed["art_no"]:
        lines.append(f"ART NO: {parsed['art_no']}")
    colour = _format_colour(parsed["colour"])
    if colour:
        lines.append(f"COLOUR: {colour}")
    if parsed["sizes"]:
        if lines:
            lines.append("")
        lines.append("SIZE: " + " ".join(parsed["sizes"].keys()))
        lines.append("QTY: " + " ".join(str(value) for value in parsed["sizes"].values()))
    if declared_quantity is not None:
        if lines and lines[-1] != "":
            lines.append("")
        lines.append(f"PRS: {declared_quantity}")
    if measurement:
        if lines and lines[-1] != "":
            lines.append("")
        lines.append(f"MEAS: {measurement}")
    return "\n".join(lines) if lines else "NO_PRODUCT_DATA"


def clean_label_text(raw_text: str) -> str:
    return _format_clean_label(parse_product_text(raw_text), raw_text)


def _result_score(result: dict[str, Any]) -> int:
    keyword_count = sum(
        keyword in result["raw_text"]
        for keyword in ("ART", "COLOR", "COLLOR", "COLOUR", "QTY", "PRS", "KGS")
    )
    return (
        (30 if result["art_no"] else 0)
        + (20 if result["colour"] else 0)
        + min(len(result["sizes"]) * 10, 50)
        + min(keyword_count * 2, 10)
        + min(len(result["raw_text"]) // 30, 5)
    )
