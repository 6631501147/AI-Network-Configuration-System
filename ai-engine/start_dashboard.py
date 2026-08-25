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

PORT = 8001
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

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/ai-api/topologies':
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

        # ── GNS3 API: Status ──────────────────────────────────────────────────
        elif self.path == '/gns3-api/status':
            self._handle_gns3_status()

        # ── GNS3 API: Projects ────────────────────────────────────────────────
        elif self.path == '/gns3-api/projects':
            self._handle_gns3_projects()

        # ── GNS3 API: Nodes for a project ─────────────────────────────────────
        elif self.path.startswith('/gns3-api/projects/') and self.path.endswith('/nodes'):
            # /gns3-api/projects/{project_id}/nodes
            parts = self.path.split('/')
            # parts: ['', 'gns3-api', 'projects', '{pid}', 'nodes']
            if len(parts) == 5:
                project_id = parts[3]
                self._handle_gns3_nodes(project_id)
            else:
                self._json(400, {"ok": False, "error": "Invalid path"})

        # ── GNS3 API: Live IPs for a project ──────────────────────────────────
        elif self.path.startswith('/gns3-api/projects/') and self.path.endswith('/live-ips'):
            parts = self.path.split('/')
            if len(parts) == 5:
                project_id = parts[3]
                self._handle_gns3_live_ips(project_id)
            else:
                self._json(400, {"ok": False, "error": "Invalid path"})

        # ── GNS3 API: Execution logs ──────────────────────────────────────────
        elif self.path == '/gns3-api/logs':
            self._handle_gns3_logs()

        else:
            super().do_GET()

    def do_POST(self):
        """Handle POST requests — existing AI endpoints + new GNS3 endpoints."""
        if self.path == '/ai-api/save-manual':
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

        elif self.path == '/ai-api/scan-image':
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
                
                # 3. Attach raw AI topology so frontend can use it for GNS3 apply
                gns3_project['_ai_topology'] = topology_json
                
                # 4. Save to scanned.gns3
                scanned_file = os.path.join(TOPOLOGY_DIR, 'scanned.gns3')
                os.makedirs(TOPOLOGY_DIR, exist_ok=True)
                with open(scanned_file, 'w', encoding='utf-8') as f:
                    json.dump(gns3_project, f, indent=2)
                
                self._json(200, {"ok": True, "file": "topology/scanned.gns3"})
                print(f"[AI SCAN] Successfully generated topology/scanned.gns3")
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})
                print(f"[ERROR] scan-image: {e}")

        elif self.path == '/ai-api/delete-manual':
            try:
                if os.path.exists(MANUAL_FILE):
                    os.remove(MANUAL_FILE)
                    self._json(200, {"ok": True,  "deleted": True})
                    print("[RESET] manual.gns3 deleted")
                else:
                    self._json(200, {"ok": True,  "deleted": False})
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})

        elif self.path == '/ai-api/modify-topology':
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

        # ── GNS3 API: Start a node ────────────────────────────────────────────
        elif self.path.startswith('/gns3-api/projects/') and '/nodes/' in self.path and self.path.endswith('/start'):
            # /gns3-api/projects/{pid}/nodes/{nid}/start
            parts = self.path.split('/')
            if len(parts) == 7:
                project_id = parts[3]
                node_id    = parts[5]
                self._handle_gns3_start_node(project_id, node_id)
            else:
                self._json(400, {"ok": False, "error": "Invalid path"})

        # ── GNS3 API: Config preview ──────────────────────────────────────────
        elif self.path == '/gns3-api/config-preview':
            self._handle_gns3_config_preview()

        # ── GNS3 API: Apply config ────────────────────────────────────────────
        elif self.path == '/gns3-api/apply-config':
            self._handle_gns3_apply_config()

        # ── GNS3 API: Verify config ───────────────────────────────────────────
        elif self.path == '/gns3-api/verify':
            self._handle_gns3_verify()

        else:
            self._json(404, {"ok": False, "error": "Not found"})

    # ══════════════════════════════════════════════════════════════════════════
    # GNS3 ROUTE HANDLERS
    # ══════════════════════════════════════════════════════════════════════════

    def _handle_gns3_status(self):
        try:
            from gns3_service import check_connection
            result = check_connection()
            self._json(200, result)
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def _handle_gns3_projects(self):
        try:
            from gns3_service import get_projects
            result = get_projects()
            self._json(200, result)
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def _handle_gns3_nodes(self, project_id: str):
        try:
            from gns3_service import get_project_nodes
            result = get_project_nodes(project_id)
            self._json(200, result)
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def _handle_gns3_live_ips(self, project_id: str):
        try:
            from gns3_service import get_live_ips
            result = get_live_ips(project_id)
            self._json(200, result)
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def _handle_gns3_start_node(self, project_id: str, node_id: str):
        try:
            from gns3_service import start_node
            result = start_node(project_id, node_id)
            self._json(200, result)
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def _handle_gns3_config_preview(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            data   = json.loads(body)
            ai_devices = data.get('ai_devices', [])
            if not ai_devices:
                self._json(400, {"ok": False, "error": "No AI devices provided"})
                return
            from gns3_service import build_config_preview
            result = build_config_preview(ai_devices)
            self._json(200, result)
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def _handle_gns3_apply_config(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            data   = json.loads(body)

            project_id     = data.get('project_id', '')
            device_mapping = data.get('device_mapping', [])
            ai_devices     = data.get('ai_devices', [])
            gns3_nodes     = data.get('gns3_nodes', [])

            if not project_id:
                self._json(400, {"ok": False, "error": "No GNS3 project_id provided"})
                return
            if not device_mapping:
                self._json(400, {"ok": False, "error": "No device mapping provided"})
                return
            if not ai_devices:
                self._json(400, {"ok": False, "error": "No AI devices provided"})
                return
            if not gns3_nodes:
                self._json(400, {"ok": False, "error": "No GNS3 nodes provided"})
                return

            from gns3_service import apply_configuration
            result = apply_configuration(project_id, device_mapping, ai_devices, gns3_nodes)
            self._json(200, result)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self._json(500, {"ok": False, "error": str(e)})

    def _handle_gns3_verify(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            data   = json.loads(body)

            project_id     = data.get('project_id', '')
            device_mapping = data.get('device_mapping', [])
            ai_devices     = data.get('ai_devices', [])
            gns3_nodes     = data.get('gns3_nodes', [])

            if not project_id:
                self._json(400, {"ok": False, "error": "No GNS3 project_id provided"})
                return

            from gns3_service import verify_configuration
            result = verify_configuration(project_id, device_mapping, ai_devices, gns3_nodes)
            self._json(200, result)
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def _handle_gns3_logs(self):
        try:
            from gns3_service import get_logs
            logs = get_logs()
            self._json(200, {"ok": True, "logs": logs})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    # ══════════════════════════════════════════════════════════════════════════
    # SHARED HELPERS
    # ══════════════════════════════════════════════════════════════════════════

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


class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    pass

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with ThreadingTCPServer(("", PORT), Handler) as httpd:
        print(f"  NetConf AI Dashboard -> http://localhost:{PORT}/dashboard.html")
        print(f"  -- AI Endpoints ------------------------------------------")
        print(f"  POST /ai-api/scan-image        -> Gemini vision scan")
        print(f"  POST /ai-api/modify-topology   -> Gemini text modify")
        print(f"  POST /ai-api/save-manual        -> write topology/manual.gns3")
        print(f"  POST /ai-api/delete-manual      -> remove topology/manual.gns3")
        print(f"  -- GNS3 Endpoints ----------------------------------------")
        print(f"  GET  /gns3-api/status           -> GNS3 server connection check")
        print(f"  GET  /gns3-api/projects         -> list GNS3 projects")
        print(f"  GET  /gns3-api/projects/{{id}}/nodes -> list nodes")
        print(f"  POST /gns3-api/config-preview   -> generate config preview")
        print(f"  POST /gns3-api/apply-config     -> apply config to GNS3 devices")
        print(f"  POST /gns3-api/verify           -> verify applied config")
        print(f"  GET  /gns3-api/logs             -> execution logs")
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
