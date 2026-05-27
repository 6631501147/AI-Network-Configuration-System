import http.server
import socketserver
import webbrowser
import threading
import time
import json
import os
import sys

# Add scripts folder to path so we can import our ai_scanner modules
sys.path.append(os.path.join(os.path.dirname(__file__), 'scripts'))
try:
    from ai_scanner.gemini_vision import analyze_image, modify_topology
    from ai_scanner.gns3_builder import build_gns3
except ImportError as _ie:
    # Define fallback stubs so NameError never occurs at request time
    def analyze_image(*a, **kw):   raise RuntimeError(f"ai_scanner import failed: {_ie}")
    def build_gns3(*a, **kw):      raise RuntimeError(f"ai_scanner import failed: {_ie}")
    def modify_topology(*a, **kw): raise RuntimeError(f"ai_scanner import failed: {_ie}")

from email.parser import BytesParser
from email.policy import default

PORT = 8000
TOPOLOGY_DIR = 'topology'
MANUAL_FILE  = os.path.join(TOPOLOGY_DIR, 'manual.gns3')

class Handler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma",  "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/topologies':
            try:
                os.makedirs(TOPOLOGY_DIR, exist_ok=True)
                files = [f for f in os.listdir(TOPOLOGY_DIR) if f.endswith('.gns3')]
                # ensure KOTHANT is first if present
                if 'KOTHANT.gns3' in files:
                    files.remove('KOTHANT.gns3')
                    files.insert(0, 'KOTHANT.gns3')
                self._json(200, {"ok": True, "files": files})
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})
        else:
            super().do_GET()

    def do_POST(self):
        """Handle POST /api/save-manual  — saves manual.gns3"""
        if self.path == '/api/save-manual':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                data = json.loads(body)
                os.makedirs(TOPOLOGY_DIR, exist_ok=True)
                with open(MANUAL_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                self._json(200, {"ok": True,  "file": MANUAL_FILE})
                print(f"[SAVE] manual.gns3 written ({len(body)} bytes)")
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})
                print(f"[ERROR] save-manual: {e}")

        elif self.path == '/api/scan-image':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length)
                content_type = self.headers.get('Content-Type', '')
                
                # Parse multipart/form-data
                msg = BytesParser(policy=default).parsebytes(f"Content-Type: {content_type}\r\n\r\n".encode() + body)
                image_bytes = None
                mime_type = None
                for part in msg.iter_parts():
                    if part.get_filename():
                        image_bytes = part.get_payload(decode=True)
                        mime_type = part.get_content_type()
                        break
                
                if not image_bytes:
                    self._json(400, {"ok": False, "error": "No image uploaded"})
                    return
            except Exception as e:
                self._json(500, {"ok": False, "error": f"Failed to parse request: {str(e)}"})
                print(f"[ERROR] scan-image parsing: {e}")
                return
                
            try:
                # 1. Analyze image with Gemini
                topology_json = analyze_image(image_bytes, mime_type)
                
                # 2. Build GNS3 project structure
                gns3_project = build_gns3(topology_json)
                
                # 3. Save to scanned.gns3
                scanned_file = os.path.join(TOPOLOGY_DIR, 'scanned.gns3')
                os.makedirs(TOPOLOGY_DIR, exist_ok=True)
                with open(scanned_file, 'w', encoding='utf-8') as f:
                    json.dump(gns3_project, f, indent=2)
                
                self._json(200, {"ok": True, "file": "topology/scanned.gns3"})
                print(f"[AI SCAN] Successfully generated topology/scanned.gns3")
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})
                print(f"[ERROR] scan-image: {e}")

        elif self.path == '/api/delete-manual':
            try:
                if os.path.exists(MANUAL_FILE):
                    os.remove(MANUAL_FILE)
                    self._json(200, {"ok": True,  "deleted": True})
                    print("[RESET] manual.gns3 deleted")
                else:
                    self._json(200, {"ok": True,  "deleted": False})
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})

        elif self.path == '/api/modify-topology':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                data        = json.loads(body)
                instruction = data.get('instruction', '').strip()
                current_gns3 = data.get('current_gns3', {})

                if not instruction:
                    self._json(400, {"ok": False, "error": "No instruction provided"})
                    return
                if not current_gns3:
                    self._json(400, {"ok": False, "error": "No current topology provided. Upload an image first."})
                    return

                modified = modify_topology(instruction, current_gns3)

                # Save as modified.gns3
                modified_file = os.path.join(TOPOLOGY_DIR, 'modified.gns3')
                os.makedirs(TOPOLOGY_DIR, exist_ok=True)
                with open(modified_file, 'w', encoding='utf-8') as f:
                    json.dump(modified, f, indent=2)

                self._json(200, {"ok": True, "file": "topology/modified.gns3", "gns3": modified})
                print(f"[AI MODIFY] modified.gns3 written")
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})
                print(f"[ERROR] modify-topology: {e}")

        else:
            self._json(404, {"ok": False, "error": "Not found"})

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type',   'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Suppress clean 200/304 noise; log everything else
        if args and str(args[1]) not in ('200', '304'):
            super().log_message(fmt, *args)


def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"  NetConf AI Dashboard -> http://localhost:{PORT}/dashboard.html")
        print(f"  POST /api/save-manual   -> writes topology/manual.gns3")
        print(f"  POST /api/delete-manual -> removes topology/manual.gns3")
        httpd.serve_forever()


if __name__ == "__main__":
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(1)
    webbrowser.open(f"http://localhost:{PORT}/dashboard.html")
    print("Browser opened. Press Ctrl+C to stop.\n")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping server...")
