"""Local persistent artist session. Background loop or Blender GUI timer."""

import argparse
import json
import pathlib
import secrets
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
import bpy

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from authoring.context import path
from artist.engine import Artist

parser = argparse.ArgumentParser()
parser.add_argument("workflow")
parser.add_argument("descriptor")
parser.add_argument("--size", type=int, default=768)
# Session-only preference; never save global Blender preferences.
bpy.context.preferences.view.show_splash = False
options = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
artist = Artist(options.workflow, options.size)
token = secrets.token_urlsafe(32)
running = True


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        global running
        if (
            self.path != "/tool"
            or self.headers.get("Authorization") != "Bearer " + token
        ):
            self.send_error(403)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 8 * 1024 * 1024:
                raise ValueError("Invalid tool request length")
            request = json.loads(
                self.rfile.read(length),
                parse_constant=lambda value: (_ for _ in ()).throw(
                    ValueError("Expected finite JSON numbers")
                ),
            )
            result = artist.execute(request)
            artist.history.data["viewport"] = dict(artist.observer.view)
            artist.history.flush()
            payload = {"ok": True, "result": result}
            if result.get("stop"):
                running = False
        except Exception as error:
            payload = {"ok": False, "error": str(error)}
        encoded = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


server = HTTPServer(("127.0.0.1", 0), Handler)
server.timeout = 0.025
descriptor = path(options.descriptor)
descriptor.parent.mkdir(parents=True, exist_ok=True)
descriptor.write_text(
    json.dumps(
        {
            "schemaVersion": 1,
            "port": server.server_port,
            "token": token,
            "workflow": options.workflow,
        }
    )
    + "\n"
)
descriptor.chmod(0o600)
print("TANGER ARTIST_MODE ready; persistent Blender session.", flush=True)


def poll():
    if not running:
        server.server_close()
        descriptor.unlink(missing_ok=True)
        if not bpy.app.background:
            bpy.ops.wm.quit_blender()
        return None
    server.handle_request()
    return 0.025


if bpy.app.background:
    while running:
        server.handle_request()
    server.server_close()
    descriptor.unlink(missing_ok=True)
else:
    bpy.app.timers.register(poll, persistent=True)
