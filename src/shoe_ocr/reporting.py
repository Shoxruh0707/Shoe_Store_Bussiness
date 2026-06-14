"""Plain-text report formatting."""

from __future__ import annotations

from typing import Any

def format_report(result: dict[str, Any]) -> str:
    lines = [
        f"boxes_detected: {result['box_count']}",
        f"boxes_with_product_data: {result['product_box_count']}",
        "",
    ]
    for index, box in enumerate(result["boxes"], start=1):
        lines.extend(
            [
                f"[box {index}]",
                "raw_text:",
                box["raw_text"],
                f"has_product_data: {str(box['has_product_data']).lower()}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"
