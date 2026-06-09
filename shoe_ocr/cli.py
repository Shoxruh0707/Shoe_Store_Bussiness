"""Command-line interface for shoe box OCR."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .reporting import format_report
from .vision import extract_from_image

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Extract shoe carton label data with local Grounding DINO and OCR."
    )
    parser.add_argument("image", type=Path, help="Path to an image containing shoe boxes")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Output .txt path (default: IMAGE_NAME.txt)",
    )
    parser.add_argument(
        "--no-rotation-retry",
        action="store_true",
        help="Do not retry OCR with rotated image copies",
    )
    parser.add_argument(
        "--annotated-output",
        type=Path,
        help="Highlighted output image path (default: OUTPUT_STEM_highlighted.png)",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    image_path = args.image.expanduser().resolve()
    output_path = (args.output or image_path.with_suffix(".txt")).expanduser().resolve()
    annotated_output_path = (
        args.annotated_output
        or output_path.with_name(f"{output_path.stem}_highlighted.png")
    ).expanduser().resolve()

    if not image_path.is_file():
        print(f"Error: image does not exist: {image_path}", file=sys.stderr)
        return 2
    if output_path.suffix.lower() != ".txt":
        print("Error: output path must end in .txt", file=sys.stderr)
        return 2

    try:
        result = extract_from_image(
            image_path,
            not args.no_rotation_retry,
            annotated_output_path,
        )
        report = format_report(result)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report, encoding="utf-8")
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(report, end="")
    print(f"\nSaved to: {output_path}", file=sys.stderr)
    print(f"Highlighted image saved to: {annotated_output_path}", file=sys.stderr)
    return 0
