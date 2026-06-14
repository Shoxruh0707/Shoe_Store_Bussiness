import argparse
import sys
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from rembg import remove


SUPPORTED_FORMATS = {"BMP", "GIF", "JPEG", "PNG", "TIFF", "WEBP"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Remove an image background and save the result as a transparent PNG."
    )
    parser.add_argument("input", type=Path, help="Path to the input image")
    parser.add_argument("output", type=Path, help="Path for the output PNG")
    return parser.parse_args()


def remove_background(input_path: Path, output_path: Path) -> Path:
    if not input_path.is_file():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if output_path.suffix.lower() != ".png":
        raise ValueError("Output path must use the .png extension.")

    try:
        with Image.open(input_path) as image:
            if image.format not in SUPPORTED_FORMATS:
                raise ValueError(
                    f"Unsupported image format: {image.format or 'unknown'}"
                )

            # Work on a detached RGBA copy so the source file can close safely.
            source = image.convert("RGBA")
    except UnidentifiedImageError as exc:
        raise ValueError("Unsupported image format or invalid image file.") from exc

    result = remove(source, alpha_matting=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, format="PNG")
    return output_path.resolve()


def main() -> int:
    args = parse_args()

    try:
        saved_path = remove_background(args.input, args.output)
    except (FileNotFoundError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Processing error: {exc}", file=sys.stderr)
        return 1

    print(f"Saved transparent PNG: {saved_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
