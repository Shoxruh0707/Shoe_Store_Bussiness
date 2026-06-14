# Shoe Box OCR

Detects shoe boxes/cartons in a photo, OCRs each detected label, cleans the OCR
text into a readable label, and writes both a text report and a highlighted
image for box-to-text comparison.

Grounding DINO locates each visible shoe box. EasyOCR reads every box crop
independently, trying four orientations per box by default. The output report is
plain text, not JSON.

## Project Structure

```text
apps/
  shoe-store/          Product-entry/store app, API, frontend, and SQL schema
data/
  images/              Local OCR input/output workspace
  samples/             Example OCR output files
src/
  shoe_ocr/
    __main__.py        Enables `python -m shoe_ocr` after install
    cli.py             Argument parsing and command-line flow
    config.py          Model names, limits, and regex constants
    reporting.py       Plain-text report formatting
    text.py            OCR cleanup and label parsing
    vision.py          Box detection, OCR, and highlighted image generation
tests/
  test_shoe_box_ocr.py Unit tests for parsing, OCR helpers, and annotation
shoe_box_ocr.py        Compatibility CLI wrapper for older commands/imports
pyproject.toml         Python package metadata
requirements.txt       Runtime dependencies with the PyTorch CUDA index
```

The root `shoe_box_ocr.py` re-exports the main helpers so older imports and
commands continue to work.

The shoe-store application has its own README at `apps/shoe-store/README.md`.

To run the shoe-store backend plus both frontends from the repository root:

```powershell
.\setup.ps1
```

Or with Bash:

```bash
./setup.sh
```

## Setup

```powershell
python -m pip install -r requirements.txt
python -m pip install -e .
```

The Grounding DINO and EasyOCR model files download automatically on the first
run. Later runs use the local model cache. A CUDA-capable GPU is used
automatically when available; CPU inference also works but is slower.

The requirements use the CUDA 13.0 PyTorch build. Verify GPU access with:

```powershell
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

## Usage

```powershell
python shoe_box_ocr.py C:\images\carton.jpg
python shoe_box_ocr.py C:\images\carton.jpg --output C:\results\carton.txt
python -m shoe_ocr C:\images\carton.jpg
shoe-box-ocr C:\images\carton.jpg
```

By default, an annotated image is saved next to the text report:

```text
carton.txt
carton_highlighted.png
```

Use `--annotated-output` to choose the highlighted image path:

```powershell
python shoe_box_ocr.py C:\images\carton.jpg --annotated-output C:\results\carton_boxes.png
```

Each detected box is read at 0, 90, 180, and 270 degrees. Disable the extra OCR
passes with:

```powershell
python shoe_box_ocr.py C:\images\carton.jpg --no-rotation-retry
```

## Text Output

The text report starts with the detected box counts, then lists each box using
the same numbering shown on the highlighted image:

```text
boxes_detected: 2
boxes_with_product_data: 1

[box 1]
raw_text:
ART NO: K3322
COLOUR: LGRAY

SIZE: 37 38 39 40
QTY: 1 2 2 1
has_product_data: true

[box 2]
raw_text:
NO_PRODUCT_DATA
has_product_data: false
```

## Tests

The parser and image-helper tests can run without loading the models:

```powershell
python -m unittest -v
```
