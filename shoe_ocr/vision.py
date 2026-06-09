"""Image detection, OCR, and annotated-image generation."""

from __future__ import annotations

import difflib
import re
from pathlib import Path
from typing import Any

from .config import (
    BOX_PROMPT,
    GROUNDING_DINO_MODEL,
    MAX_IMAGE_DIMENSION,
    MAX_OCR_CROP_DIMENSION,
    NUMBER_RE,
)
from .text import (
    _declared_quantity,
    _format_clean_label,
    _is_quantity,
    _is_size,
    _result_score,
    _size_key,
    _size_table,
    _spatial_grid_is_valid,
    parse_product_text,
)

def _load_local_models() -> tuple[Any, Any, Any, str]:
    try:
        import easyocr
        import torch
        from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor
    except ImportError as exc:
        raise RuntimeError(
            "Missing dependency. Run: pip install -r requirements.txt"
        ) from exc

    device = "cuda" if torch.cuda.is_available() else "cpu"
    processor = AutoProcessor.from_pretrained(GROUNDING_DINO_MODEL)
    detector = AutoModelForZeroShotObjectDetection.from_pretrained(
        GROUNDING_DINO_MODEL
    ).to(device)
    detector.eval()
    reader = easyocr.Reader(["en"], gpu=device == "cuda")
    return processor, detector, reader, device


def _intersection_over_union(first: list[int], second: list[int]) -> float:
    x1 = max(first[0], second[0])
    y1 = max(first[1], second[1])
    x2 = min(first[2], second[2])
    y2 = min(first[3], second[3])
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    first_area = max(0, first[2] - first[0]) * max(0, first[3] - first[1])
    second_area = max(0, second[2] - second[0]) * max(0, second[3] - second[1])
    union = first_area + second_area - intersection
    return intersection / union if union else 0


def _detect_boxes(
    image: Any, processor: Any, detector: Any, device: str
) -> list[dict[str, Any]]:
    import torch

    inputs = processor(images=image, text=BOX_PROMPT, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = detector(**inputs)

    results = processor.post_process_grounded_object_detection(
        outputs,
        inputs["input_ids"],
        threshold=0.18,
        text_threshold=0.18,
        target_sizes=[image.size[::-1]],
    )[0]
    if len(results["boxes"]) == 0:
        return []

    labels = results.get("text_labels", results.get("labels", []))
    image_area = image.width * image.height
    candidates: list[dict[str, Any]] = []
    for box, score, label in zip(
        results["boxes"], results["scores"], labels
    ):
        x1, y1, x2, y2 = box.tolist()
        area = max(0, x2 - x1) * max(0, y2 - y1)
        if area < image_area * 0.025 or area > image_area * 0.8:
            continue
        padding = max(image.size) * 0.01
        crop_box = [
            max(0, int(x1 - padding)),
            max(0, int(y1 - padding)),
            min(image.width, int(x2 + padding)),
            min(image.height, int(y2 + padding)),
        ]
        candidates.append(
            {
                "label": str(label),
                "score": round(float(score), 4),
                "box": crop_box,
            }
        )

    kept: list[dict[str, Any]] = []
    for candidate in sorted(candidates, key=lambda item: item["score"], reverse=True):
        if all(
            _intersection_over_union(candidate["box"], item["box"]) < 0.45
            for item in kept
        ):
            kept.append(candidate)
    return sorted(kept, key=lambda item: (item["box"][1], item["box"][0]))


def _easyocr_text(reader: Any, image: Any) -> str:
    return _easyocr_analysis(reader, image)[0]


def _token_positions(text: str, box: Any, pattern: re.Pattern[str]) -> list[tuple[str, float]]:
    left = min(point[0] for point in box)
    right = max(point[0] for point in box)
    width = max(right - left, 1)
    length = max(len(text), 1)
    return [
        (
            match.group(1).replace(",", "."),
            left + width * ((match.start(1) + match.end(1)) / 2) / length,
        )
        for match in pattern.finditer(text.upper())
    ]


def _spatial_size_grid(detections: list[Any]) -> dict[str, int]:
    size_rows = []
    quantity_tokens = []
    for box, text, confidence in detections:
        if confidence < 0.15:
            continue
        y = sum(point[1] for point in box) / len(box)
        tokens = _token_positions(text, box, NUMBER_RE)
        sizes = [(value, x) for value, x in tokens if _is_size(value)]
        quantities = [(value, x) for value, x in tokens if _is_quantity(value)]
        if len(sizes) >= 3:
            size_rows.append((y, sizes))
        elif quantities and len(tokens) == len(quantities):
            quantity_tokens.extend((y, value, x) for value, x in quantities)

    candidates = []
    for size_y, sizes in size_rows:
        gaps = [
            sizes[index + 1][1] - sizes[index][1]
            for index in range(len(sizes) - 1)
        ]
        tolerance = (sum(gaps) / len(gaps)) * 0.45 if gaps else 20
        below = [
            (y, value, x)
            for y, value, x in quantity_tokens
            if size_y < y < size_y + 300
        ]
        if not below:
            continue
        first_y = min(item[0] for item in below)
        row = [item for item in below if abs(item[0] - first_y) < 80]
        grid = {_size_key(value): 0 for value, _ in sizes}
        matched = 0
        for _, quantity, x in row:
            nearest = min(sizes, key=lambda item: abs(item[1] - x))
            if abs(nearest[1] - x) <= tolerance:
                grid[_size_key(nearest[0])] = int(quantity)
                matched += 1
        if matched:
            candidates.append((matched, grid))
    return max(candidates, key=lambda item: item[0])[1] if candidates else {}


def _easyocr_analysis(reader: Any, image: Any) -> tuple[str, dict[str, int]]:
    import numpy as np
    from PIL import Image, ImageEnhance

    prepared = image.copy()
    if max(prepared.size) > MAX_OCR_CROP_DIMENSION:
        prepared.thumbnail(
            (MAX_OCR_CROP_DIMENSION, MAX_OCR_CROP_DIMENSION),
            Image.Resampling.LANCZOS,
        )
    enhanced = ImageEnhance.Contrast(prepared).enhance(1.8)
    enhanced = enhanced.resize(
        (enhanced.width * 2, enhanced.height * 2), Image.Resampling.LANCZOS
    )
    detections = reader.readtext(
        np.asarray(enhanced), detail=1, paragraph=False, canvas_size=3500
    )
    detections.sort(
        key=lambda item: (
            min(point[1] for point in item[0]),
            min(point[0] for point in item[0]),
        )
    )
    text = "\n".join(text for _, text, confidence in detections if confidence >= 0.15)
    return text, _spatial_size_grid(detections)


def _extract_box(
    image: Any, reader: Any, detection: dict[str, Any], retry_rotations: bool
) -> dict[str, Any]:
    crop = image.crop(detection["box"])
    angles = (0, 90, 180, 270) if retry_rotations else (0,)
    candidates = []
    for angle in angles:
        rotated = crop if angle == 0 else crop.rotate(angle, expand=True)
        raw_text, spatial_sizes = _easyocr_analysis(reader, rotated)
        candidate = parse_product_text(raw_text)
        declared_quantity = _declared_quantity(candidate["raw_text"])
        if spatial_sizes and (
            _spatial_grid_is_valid(spatial_sizes, declared_quantity)
            and (
                not candidate["sizes"]
                or sum(spatial_sizes.values()) == sum(candidate["sizes"].values())
            )
        ):
            candidate["sizes"] = spatial_sizes
            candidate["size_table"] = _size_table(spatial_sizes)
            candidate["available_sizes"] = [
                size for size, quantity in spatial_sizes.items() if quantity > 0
            ]
        candidate["rotation"] = angle
        candidates.append(candidate)

    best = max(candidates, key=_result_score)
    best["ocr_raw_text"] = best["raw_text"]
    best["has_product_data"] = bool(
        best["art_no"] or best["colour"] or best["sizes"]
    )
    best["detection"] = detection
    return best


def _apply_article_consensus(boxes: list[dict[str, Any]]) -> None:
    values = [box["art_no"] for box in boxes if box["art_no"]]
    counts = {value: values.count(value) for value in set(values)}
    for box in boxes:
        value = box["art_no"]
        if not value:
            continue
        matches = [
            candidate
            for candidate in counts
            if len(candidate) == len(value)
            and difflib.SequenceMatcher(None, value, candidate).ratio() >= 0.85
        ]
        if not matches:
            continue
        canonical = max(matches, key=lambda candidate: (counts[candidate], candidate == value))
        if counts[canonical] > counts[value]:
            box["art_no_raw"] = value
            box["art_no"] = canonical


def _draw_highlighted_boxes(image: Any, boxes: list[dict[str, Any]]) -> Any:
    from PIL import ImageDraw, ImageFont

    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)
    font_size = max(16, round(max(image.size) / 55))
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()
    line_width = max(3, round(max(image.size) / 250))

    for index, box in enumerate(boxes, start=1):
        x1, y1, x2, y2 = box["detection"]["box"]
        colour = "#22c55e" if box["has_product_data"] else "#f59e0b"
        draw.rectangle([x1, y1, x2, y2], outline=colour, width=line_width)

        label = f"[box {index}]"
        try:
            left, top, right, bottom = draw.textbbox((0, 0), label, font=font)
            text_width = right - left
            text_height = bottom - top
        except AttributeError:
            text_width, text_height = draw.textsize(label, font=font)
        pad = max(5, line_width + 1)
        label_x = min(max(0, x1 + line_width), max(0, image.width - text_width - pad * 2))
        label_y = min(max(0, y1 + line_width), max(0, image.height - text_height - pad * 2))
        draw.rectangle(
            [
                label_x,
                label_y,
                label_x + text_width + pad * 2,
                label_y + text_height + pad * 2,
            ],
            fill="#111827",
            outline=colour,
            width=max(1, line_width // 2),
        )
        draw.text((label_x + pad, label_y + pad), label, fill="white", font=font)

    return annotated


def save_highlighted_image(
    image: Any, boxes: list[dict[str, Any]], output_path: Path
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    _draw_highlighted_boxes(image, boxes).save(output_path)


def extract_from_image(
    image_path: Path,
    retry_rotations: bool = True,
    annotated_output_path: Path | None = None,
) -> dict[str, Any]:
    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError(
            "Missing dependency. Run: pip install -r requirements.txt"
        ) from exc

    Image.MAX_IMAGE_PIXELS = None
    processor, detector, reader, device = _load_local_models()
    with Image.open(image_path) as source:
        image = source.convert("RGB")
        detection_image = image.copy()
        if max(detection_image.size) > MAX_IMAGE_DIMENSION:
            detection_image.thumbnail(
                (MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS
            )
        detections = _detect_boxes(detection_image, processor, detector, device)
        if not detections:
            detections = [
                {
                    "label": "whole image fallback",
                    "score": 0.0,
                    "box": [0, 0, detection_image.width, detection_image.height],
                }
            ]
        scale_x = image.width / detection_image.width
        scale_y = image.height / detection_image.height
        for detection in detections:
            x1, y1, x2, y2 = detection["box"]
            detection["box"] = [
                round(x1 * scale_x),
                round(y1 * scale_y),
                round(x2 * scale_x),
                round(y2 * scale_y),
            ]
        boxes = [
            _extract_box(image, reader, detection, retry_rotations)
            for detection in detections
        ]
    _apply_article_consensus(boxes)
    for box in boxes:
        box["raw_text"] = _format_clean_label(box, box["ocr_raw_text"])
        box["has_product_data"] = box["raw_text"] != "NO_PRODUCT_DATA"
    if annotated_output_path is not None:
        save_highlighted_image(image, boxes, annotated_output_path)
    return {
        "box_count": len(boxes),
        "product_box_count": sum(box["has_product_data"] for box in boxes),
        "boxes": boxes,
        "annotated_image": str(annotated_output_path) if annotated_output_path else None,
    }
