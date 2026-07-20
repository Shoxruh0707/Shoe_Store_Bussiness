"""Remove an image background with rembg.

The Node backend calls this script through the project's virtualenv Python,
so the server does not depend on an already-activated terminal session.
"""

from __future__ import annotations

import argparse
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remove an image background with rembg.")
    parser.add_argument("input", help="Source image path.")
    parser.add_argument("output", help="Destination PNG path.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.is_file():
        raise FileNotFoundError(f"Input image not found: {input_path}")

    from rembg import remove

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(remove(input_path.read_bytes()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
