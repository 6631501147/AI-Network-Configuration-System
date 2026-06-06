import http.server
import socketserver
import webbrowser
import threading
import time
import json
import os
import sys
import hashlib
import hmac
import secrets
import re
from datetime import datetime, timedelta, timezone

# Add scripts folder to path so we can import our ai_scanner modules
sys.path.append(os.path.join(os.path.dirname(__file__), 'scripts'))
try:
    from ai_scanner.gemini_vision import analyze_image, modify_topology
    from ai_scanner.gns3_builder import build_gns3
except ImportError as _ie:
    def analyze_image(*a, **kw):   raise RuntimeError(f"ai_scanner import failed: {_ie}")
    def build_gns3(*a, **kw):      raise RuntimeError(f"ai_scanner import failed: {_ie}")
    def modify_topology(*a, **kw): raise RuntimeError(f"ai_scanner import failed: {_ie}")

# ── Optional MySQL + bcrypt (graceful fallback if not installed) ──────────────
try:
    import pymysql
    import pymysql.cursors
    MYSQL_OK = True
except ImportError:
    MYSQL_OK = False
    print("[WARN] PyMySQL not installed. Auth API disabled. Run: pip install PyMySQL bcrypt")

try:
    import bcrypt as _bcrypt
    BCRYPT_OK = True
except ImportError:
    BCRYPT_OK = False
    print("[WARN] bcrypt not installed. Auth API disabled. Run: pip install PyMySQL bcrypt")

AUTH_OK = MYSQL_OK and BCRYPT_OK

from email.parser import BytesParser
from email.policy import default

PORT         = 8000
TOPOLOGY_DIR = 'topology'
MANUAL_FILE  = os.path.join(TOPOLOGY_DIR, 'manual.gns3')

# ── MySQL connection settings (matches XAMPP phpMyAdmin defaults) ─────────────
DB_CONFIG = {
    'host':     '127.0.0.1',
    'port':     3306,
    'user':     'root',
    'password': '',           # XAMPP default — empty password
    'database': 'netconfig_ai',
    'charset':  'utf8mb4',
    # cursorclass added in get_db() to avoid module-load-time errors
}

# ── Simple in-memory session store {session_id: {user data, expires}} ─────────
_sessions: dict = {}
SESSION_TTL_DAYS = 30


def get_db():
    """Return a new PyMySQL connection."""
    cfg = dict(DB_CONFIG)                          # copy so we don't mutate
    cfg['cursorclass'] = pymysql.cursors.DictCursor
    return pymysql.connect(**cfg)


def new_session(user_row: dict, remember: bool) -> str:
    sid = secrets.token_hex(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS if remember else 1)
    _sessions[sid] = {
        'user_id':   user_row['id'],
        'firstname': user_row['firstname'],
        'lastname':  user_row['lastname'],
        'email':     user_row['email'],
        'student_id': user_row['student_id'],
        'role':      user_row['role'],
        'expires':   expires.isoformat(),
    }
    return sid


def get_session(sid: str) -> dict | None:
    if not sid or sid not in _sessions:
        return None
    data = _sessions[sid]
    if datetime.now(timezone.utc) > datetime.fromisoformat(data['expires']):
        del _sessions[sid]
        return None
    return data


def delete_session(sid: str):
    _sessions.pop(sid, None)


def parse_cookies(cookie_header: str) -> dict:
    cookies = {}
    if not cookie_header:
        return cookies
    for part in cookie_header.split(';'):
        part = part.strip()
        if '=' in part:
            k, v = part.split('=', 1)
            cookies[k.strip()] = v.strip()
    return cookies


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
        """Handle CORS preflight — must return 200 with CORS headers."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', '0')
        self.end_headers()

    # ── GET ───────────────────────────────────────────────────────────────────
    def do_GET(self):
        # Redirect root to login
        if self.path in ('/', ''):
            self.send_response(302)
            self.send_header('Location', '/login.html')
            self.end_headers()
            return

        if self.path == '/api/topologies':
            try:
                os.makedirs(TOPOLOGY_DIR, exist_ok=True)
                files = [f for f in os.listdir(TOPOLOGY_DIR) if f.endswith('.gns3')]
                if 'KOTHANT.gns3' in files:
                    files.remove('KOTHANT.gns3')
                    files.insert(0, 'KOTHANT.gns3')
                self._json(200, {"ok": True, "files": files})
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})

        elif self.path == '/api/session':
            self._handle_get_session()

        else:
            super().do_GET()

    # ── POST ──────────────────────────────────────────────────────────────────
    def do_POST(self):
        path = self.path.split('?')[0]
        print(f"[POST] {path}")

        if path == '/api/register':
            self._handle_register()
        elif path == '/api/login':
            self._handle_login()
        elif path == '/api/logout':
            self._handle_logout()
        elif path == '/api/save-manual':
            self._handle_save_manual()
        elif path == '/api/scan-image':
            self._handle_scan_image()
        elif path == '/api/delete-manual':
            self._handle_delete_manual()
        elif path == '/api/modify-topology':
            self._handle_modify_topology()
        else:
            print(f"[404] Unknown POST path: {path}")
            self._json(404, {"ok": False, "error": f"No route for POST {path}"})

    # ── Auth: GET /api/session ────────────────────────────────────────────────
    def _handle_get_session(self):
        sid  = parse_cookies(self.headers.get('Cookie', '')).get('netconf_sid')
        data = get_session(sid)
        if data:
            user = {k: v for k, v in data.items() if k != 'expires'}
            self._json(200, {'ok': True, 'loggedIn': True, 'user': user})
        else:
            self._json(200, {'ok': True, 'loggedIn': False})

    # ── Auth: POST /api/register ──────────────────────────────────────────────
    def _handle_register(self):
        if not AUTH_OK:
            self._json(503, {'ok': False, 'error': 'Auth unavailable. Run: pip install PyMySQL bcrypt'})
            return

        body = self._read_json()
        if body is None:
            return

        firstname  = (body.get('firstname')  or '').strip()
        lastname   = (body.get('lastname')   or '').strip()
        student_id = (body.get('studentId')  or '').strip()
        email      = (body.get('email')      or '').strip().lower()
        role       = (body.get('role')       or '').strip()
        password   = body.get('password')    or ''
        confirm    = body.get('confirmPassword') or ''

        # Validate
        if not all([firstname, lastname, student_id, email, role, password, confirm]):
            self._json(400, {'ok': False, 'error': 'All fields are required.'}); return
        if not re.fullmatch(r'\d{10}', student_id):
            self._json(400, {'ok': False, 'error': 'Student ID must be exactly 10 digits.'}); return
        if not email.endswith('@lamduan.mfu.ac.th'):
            self._json(400, {'ok': False, 'error': 'Email must be your official @lamduan.mfu.ac.th address.'}); return
        if len(password) < 8:
            self._json(400, {'ok': False, 'error': 'Password must be at least 8 characters.'}); return
        if password != confirm:
            self._json(400, {'ok': False, 'error': 'Passwords do not match.'}); return
        if role not in ('student', 'ta', 'instructor', 'admin'):
            self._json(400, {'ok': False, 'error': 'Invalid role.'}); return

        pw_hash = _bcrypt.hashpw(password.encode(), _bcrypt.gensalt(rounds=12)).decode()

        try:
            conn = get_db()
            with conn:
                with conn.cursor() as cur:
                    cur.execute('SELECT id FROM users WHERE email = %s', (email,))
                    if cur.fetchone():
                        self._json(409, {'ok': False, 'error': 'An account with this email already exists.'}); return
                    cur.execute('SELECT id FROM users WHERE student_id = %s', (student_id,))
                    if cur.fetchone():
                        self._json(409, {'ok': False, 'error': 'An account with this student ID already exists.'}); return

                    cur.execute(
                        'INSERT INTO users (firstname, lastname, student_id, email, role, password_hash) '
                        'VALUES (%s, %s, %s, %s, %s, %s)',
                        (firstname, lastname, student_id, email, role, pw_hash)
                    )
                    new_id = cur.lastrowid
                conn.commit()

            print(f"[REGISTER] New user: {email} (id={new_id})")
            self._json(201, {'ok': True, 'message': 'Account created successfully.', 'userId': new_id})

        except pymysql.MySQLError as e:
            print(f"[ERROR] register DB: {e}")
            self._json(500, {'ok': False, 'error': 'Database error. Is MySQL running in XAMPP?'})

    # ── Auth: POST /api/login ─────────────────────────────────────────────────
    def _handle_login(self):
        if not AUTH_OK:
            self._json(503, {'ok': False, 'error': 'Auth unavailable. Run: pip install PyMySQL bcrypt'})
            return

        body = self._read_json()
        if body is None:
            return

        identifier = (body.get('email') or '').strip()
        password   = body.get('password') or ''
        remember   = bool(body.get('remember', False))

        if not identifier or not password:
            self._json(400, {'ok': False, 'error': 'Email / student ID and password are required.'}); return

        try:
            conn = get_db()
            with conn:
                with conn.cursor() as cur:
                    if re.fullmatch(r'\d{10}', identifier):
                        cur.execute('SELECT * FROM users WHERE student_id = %s LIMIT 1', (identifier,))
                    else:
                        cur.execute('SELECT * FROM users WHERE email = %s LIMIT 1', (identifier.lower(),))
                    user = cur.fetchone()

            if not user or not _bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
                self._json(401, {'ok': False, 'error': 'Invalid credentials. Please try again.'}); return

            # Update last_login (best-effort)
            try:
                conn2 = get_db()
                with conn2:
                    with conn2.cursor() as cur:
                        cur.execute('UPDATE users SET last_login = NOW() WHERE id = %s', (user['id'],))
                    conn2.commit()
            except Exception:
                pass

            sid = new_session(user, remember)
            max_age = 60 * 60 * 24 * (30 if remember else 1)
            cookie  = f"netconf_sid={sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}"

            user_out = {
                'id':        user['id'],
                'firstname': user['firstname'],
                'lastname':  user['lastname'],
                'email':     user['email'],
                'studentId': user['student_id'],
                'role':      user['role'],
            }
            print(f"[LOGIN] {user['email']} (role={user['role']})")
            self._json(200, {'ok': True, 'message': 'Sign in successful.', 'user': user_out},
                       extra_headers=[('Set-Cookie', cookie)])

        except pymysql.MySQLError as e:
            print(f"[ERROR] login DB: {e}")
            self._json(500, {'ok': False, 'error': 'Database error. Is MySQL running in XAMPP?'})

    # ── Auth: POST /api/logout ────────────────────────────────────────────────
    def _handle_logout(self):
        sid = parse_cookies(self.headers.get('Cookie', '')).get('netconf_sid')
        delete_session(sid)
        clear_cookie = "netconf_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
        self._json(200, {'ok': True, 'message': 'Logged out.'},
                   extra_headers=[('Set-Cookie', clear_cookie)])

    # ── Topology endpoints ────────────────────────────────────────────────────
    def _handle_save_manual(self):
        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length)
        try:
            data = json.loads(body)
            os.makedirs(TOPOLOGY_DIR, exist_ok=True)
            with open(MANUAL_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            self._json(200, {"ok": True, "file": MANUAL_FILE})
            print(f"[SAVE] manual.gns3 written ({len(body)} bytes)")
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
            print(f"[ERROR] save-manual: {e}")

    def _handle_scan_image(self):
        try:
            length       = int(self.headers.get('Content-Length', 0))
            body         = self.rfile.read(length)
            content_type = self.headers.get('Content-Type', '')
            msg          = BytesParser(policy=default).parsebytes(
                f"Content-Type: {content_type}\r\n\r\n".encode() + body
            )
            image_bytes = mime_type = None
            for part in msg.iter_parts():
                if part.get_filename():
                    image_bytes = part.get_payload(decode=True)
                    mime_type   = part.get_content_type()
                    break
            if not image_bytes:
                self._json(400, {"ok": False, "error": "No image uploaded"}); return
        except Exception as e:
            self._json(500, {"ok": False, "error": f"Failed to parse request: {e}"}); return

        try:
            topology_json = analyze_image(image_bytes, mime_type)
            gns3_project  = build_gns3(topology_json)
            scanned_file  = os.path.join(TOPOLOGY_DIR, 'scanned.gns3')
            os.makedirs(TOPOLOGY_DIR, exist_ok=True)
            with open(scanned_file, 'w', encoding='utf-8') as f:
                json.dump(gns3_project, f, indent=2)
            self._json(200, {"ok": True, "file": "topology/scanned.gns3"})
            print("[AI SCAN] Successfully generated topology/scanned.gns3")
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
            print(f"[ERROR] scan-image: {e}")

    def _handle_delete_manual(self):
        try:
            if os.path.exists(MANUAL_FILE):
                os.remove(MANUAL_FILE)
                self._json(200, {"ok": True, "deleted": True})
                print("[RESET] manual.gns3 deleted")
            else:
                self._json(200, {"ok": True, "deleted": False})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def _handle_modify_topology(self):
        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length)
        try:
            data         = json.loads(body)
            instruction  = data.get('instruction', '').strip()
            current_gns3 = data.get('current_gns3', {})
            if not instruction:
                self._json(400, {"ok": False, "error": "No instruction provided"}); return
            if not current_gns3:
                self._json(400, {"ok": False, "error": "No current topology provided."}); return
            modified      = modify_topology(instruction, current_gns3)
            modified_file = os.path.join(TOPOLOGY_DIR, 'modified.gns3')
            os.makedirs(TOPOLOGY_DIR, exist_ok=True)
            with open(modified_file, 'w', encoding='utf-8') as f:
                json.dump(modified, f, indent=2)
            self._json(200, {"ok": True, "file": "topology/modified.gns3", "gns3": modified})
            print("[AI MODIFY] modified.gns3 written")
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
            print(f"[ERROR] modify-topology: {e}")

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _read_json(self) -> dict | None:
        try:
            length = int(self.headers.get('Content-Length', 0))
            raw    = self.rfile.read(length)
            return json.loads(raw)
        except Exception:
            self._json(400, {'ok': False, 'error': 'Invalid or missing JSON body'})
            return None

    def _json(self, code: int, obj: dict, extra_headers: list = None):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type',   'application/json')
        self.send_header('Content-Length', str(len(body)))
        if extra_headers:
            for name, value in extra_headers:
                self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        if args and str(args[1]) not in ('200', '304'):
            super().log_message(fmt, *args)


def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"\n  NetConf AI Login     -> http://localhost:{PORT}/login.html")
        print(f"  NetConf AI Dashboard -> http://localhost:{PORT}/dashboard.html")
        print(f"  Auth API (register)  -> POST http://localhost:{PORT}/api/register")
        print(f"  Auth API (login)     -> POST http://localhost:{PORT}/api/login")
        print(f"  Auth API (session)   -> GET  http://localhost:{PORT}/api/session")
        if not AUTH_OK:
            print(f"\n  [!] Auth API DISABLED — install dependencies:")
            print(f"      pip install PyMySQL bcrypt\n")
        httpd.serve_forever()


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(1)
    webbrowser.open(f"http://localhost:{PORT}/login.html")
    print("Browser opened. Press Ctrl+C to stop.\n")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping server...")
