"""Remove an image background with a configurable local backend.

The Node backend calls this script through the project's virtualenv Python,
so the server does not depend on an already-activated terminal session.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import time
from pathlib import Path

try:
    import resource
except ImportError:  # Windows local development.
    resource = None


DEFAULT_BRIA_MODEL = "briaai/RMBG-2.0"
DEFAULT_REMBG_MODEL = "u2net"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remove an image background with a local CPU-capable backend.")
    parser.add_argument("input", help="Source image path.")
    parser.add_argument("output", help="Destination PNG path.")
    parser.add_argument(
        "--backend",
        choices=("rembg", "bria"),
        default=os.getenv("REMBG_BACKEND", "bria"),
        help="Background-removal backend. Defaults to REMBG_BACKEND or bria.",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("REMBG_MODEL"),
        help="Model name. Defaults to briaai/RMBG-2.0 for BRIA or u2net for rembg.",
    )
    parser.add_argument(
        "--device",
        default=os.getenv("REMBG_DEVICE", "cpu"),
        help="Torch device for BRIA. Defaults to REMBG_DEVICE or cpu.",
    )
    parser.add_argument(
        "--image-size",
        type=int,
        default=int(os.getenv("REMBG_BRIA_IMAGE_SIZE", "1024")),
        help="Square input size for BRIA inference. Defaults to 1024.",
    )
    parser.add_argument(
        "--metrics",
        action="store_true",
        default=os.getenv("REMBG_METRICS", "true").lower() != "false",
        help="Print a JSON metrics line to stdout. Enabled by default.",
    )
    return parser.parse_args()


def read_first_powercap_energy_uj() -> int | None:
    powercap_root = Path(os.getenv("REMBG_POWERCAP_ROOT", "/sys/class/powercap"))
    if not powercap_root.exists():
        return None

    for energy_file in sorted(powercap_root.glob("intel-rapl*/energy_uj")):
        try:
            return int(energy_file.read_text(encoding="utf-8").strip())
        except (OSError, ValueError):
            continue
    return None


def resource_usage_seconds() -> float:
    if resource is None:
        return time.process_time()
    usage = resource.getrusage(resource.RUSAGE_SELF)
    return float(usage.ru_utime + usage.ru_stime)


def max_rss_mb() -> float | None:
    if resource is None:
        return None
    usage = resource.getrusage(resource.RUSAGE_SELF)
    if platform.system() == "Darwin":
        return usage.ru_maxrss / (1024 * 1024)
    if usage.ru_maxrss:
        return usage.ru_maxrss / 1024
    return None


def power_metrics(start_wall: float, start_cpu: float, start_energy_uj: int | None) -> dict[str, object]:
    wall_seconds = max(time.perf_counter() - start_wall, 0.001)
    cpu_seconds = max(resource_usage_seconds() - start_cpu, 0.0)
    end_energy_uj = read_first_powercap_energy_uj() if start_energy_uj is not None else None
    energy_joules = None
    power_source = "estimate"

    if start_energy_uj is not None and end_energy_uj is not None and end_energy_uj >= start_energy_uj:
        energy_joules = (end_energy_uj - start_energy_uj) / 1_000_000
        power_source = "rapl"
    else:
        cpu_watts = float(os.getenv("REMBG_ESTIMATED_CPU_WATTS", "35"))
        energy_joules = cpu_seconds * cpu_watts

    rounded_energy = round(energy_joules, 3)
    return {
        "wallSeconds": round(wall_seconds, 3),
        "cpuSeconds": round(cpu_seconds, 3),
        "energyJoules": rounded_energy,
        "estimatedEnergyJoules": rounded_energy,
        "averageWatts": round(energy_joules / wall_seconds, 3),
        "powerSource": power_source,
        "maxRssMb": round(max_rss_mb(), 1) if max_rss_mb() is not None else None,
    }


def emit_metrics(payload: dict[str, object]) -> None:
    print(f"REMBG_METRICS {json.dumps(payload, sort_keys=True)}", flush=True)


def remove_with_rembg(input_path: Path, output_path: Path, model: str) -> None:
    from rembg import new_session, remove

    session = new_session(model)
    output_path.write_bytes(remove(input_path.read_bytes(), session=session))


def remove_with_bria(input_path: Path, output_path: Path, model_name: str, device: str, image_size: int) -> None:
    import torch
    from PIL import Image
    from torchvision import transforms
    from transformers import AutoModelForImageSegmentation

    if device == "cuda" and not torch.cuda.is_available():
        device = "cpu"

    cpu_threads = int(os.getenv("REMBG_CPU_THREADS", "0") or "0")
    if cpu_threads > 0:
        torch.set_num_threads(cpu_threads)

    model = AutoModelForImageSegmentation.from_pretrained(model_name, trust_remote_code=True)
    model.to(device)
    model.eval()

    transform_image = transforms.Compose(
        [
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )

    image = Image.open(input_path).convert("RGB")
    input_images = transform_image(image).unsqueeze(0).to(device)

    with torch.no_grad():
        prediction = model(input_images)[-1].sigmoid().cpu()

    mask = transforms.ToPILImage()(prediction[0].squeeze()).resize(image.size)
    output = image.convert("RGBA")
    output.putalpha(mask)
    output.save(output_path)


def default_model_for_backend(backend: str) -> str:
    return DEFAULT_BRIA_MODEL if backend == "bria" else DEFAULT_REMBG_MODEL


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    model = args.model or default_model_for_backend(args.backend)

    if not input_path.is_file():
        raise FileNotFoundError(f"Input image not found: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    start_wall = time.perf_counter()
    start_cpu = resource_usage_seconds()
    start_energy_uj = read_first_powercap_energy_uj()
    status = "ok"
    error = None

    try:
        if args.backend == "bria":
            remove_with_bria(input_path, output_path, model, args.device, args.image_size)
        else:
            remove_with_rembg(input_path, output_path, model)
    except Exception as exc:
        status = "error"
        error = str(exc)
        raise
    finally:
        if args.metrics:
            metrics = {
                "backend": args.backend,
                "model": model,
                "device": args.device,
                "status": status,
                **power_metrics(start_wall, start_cpu, start_energy_uj),
            }
            if error:
                metrics["error"] = error
            emit_metrics(metrics)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
