import io
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

from PIL import Image, UnidentifiedImageError
from rembg import new_session, remove


HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "7000"))
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(5 * 1024 * 1024)))
MODEL_NAME = os.getenv("REMBG_MODEL", "u2net")

# Loading once at startup avoids rebuilding the ONNX session for every upload.
SESSION = new_session(MODEL_NAME)


class ImageProcessorHandler(BaseHTTPRequestHandler):
    server_version = "ShoeImageProcessor/1.0"

    def do_GET(self) -> None:
        if self.path != "/health":
            self._json_error(404, "Not found")
            return

        payload = json.dumps({"status": "ok", "model": MODEL_NAME}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self) -> None:
        if self.path != "/remove":
            self._json_error(404, "Not found")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json_error(400, "Invalid Content-Length")
            return

        if content_length <= 0:
            self._json_error(400, "An image body is required")
            return
        if content_length > MAX_IMAGE_BYTES:
            self._json_error(413, "Image is too large")
            return

        source = self.rfile.read(content_length)

        try:
            # Verify the input before sending it to the inference pipeline.
            with Image.open(io.BytesIO(source)) as image:
                image.verify()
            output = remove(source, session=SESSION, force_return_bytes=True)
            with Image.open(io.BytesIO(output)) as result:
                if result.format != "PNG":
                    raise ValueError("Processor did not produce a PNG")
                result.verify()
        except (UnidentifiedImageError, OSError, ValueError) as error:
            self._json_error(400, f"Invalid image: {error}")
            return
        except Exception as error:
            self.log_error("Background removal failed: %s", error)
            self._json_error(500, "Background removal failed")
            return

        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(output)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(output)

    def _json_error(self, status: int, message: str) -> None:
        payload = json.dumps({"error": message}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), ImageProcessorHandler)
    print(f"Image processor listening on http://{HOST}:{PORT} with model {MODEL_NAME}", flush=True)
    server.serve_forever()
