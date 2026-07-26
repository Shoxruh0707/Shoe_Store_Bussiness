"""Preload the configured background-removal model into the container cache."""

from __future__ import annotations

import os


def main() -> int:
    backend = os.getenv("REMBG_BACKEND", "bria")
    model = os.getenv("REMBG_MODEL") or ("briaai/RMBG-2.0" if backend == "bria" else "u2net")

    if backend == "bria":
        from transformers import AutoModelForImageSegmentation

        AutoModelForImageSegmentation.from_pretrained(model, trust_remote_code=True)
        print(f"preloaded BRIA background-removal model: {model}")
        return 0

    from rembg import new_session

    new_session(model)
    print(f"preloaded rembg background-removal model: {model}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
