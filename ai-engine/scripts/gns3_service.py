"""
gns3_service.py
───────────────
Clean service layer for communicating with a live GNS3 2.2.x server.

Architecture:
  Dashboard Backend (start_dashboard.py)
       ↓
  gns3_service.py  (this file)
       ↓  HTTP REST
  GNS3 Server  (localhost:3080/v2/)
       ↓  Telnet console
  Routers / Switches

All GNS3 credentials and URL are read from environment variables:
  GNS3_SERVER_URL   default: http://localhost:3080
  GNS3_USERNAME     default: (empty — GNS3 2.2 local auth optional)
  GNS3_PASSWORD     default: (empty)
"""

import os
import time
import socket
import threading
import json
import re
import ipaddress
from typing import Optional
from dotenv import load_dotenv

try:
    import telnetlib
    _HAS_TELNETLIB = True
except ImportError:
    _HAS_TELNETLIB = False   # Python 3.13+ removed telnetlib; we use raw sockets instead

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

def _get_config():
    # Bypass any local proxy settings for localhost connection
    os.environ["NO_PROXY"] = "*"
    load_dotenv(override=True)
    url  = os.environ.get("GNS3_SERVER_URL", "http://localhost:3080").rstrip("/")
    user = os.environ.get("GNS3_USERNAME", "").strip()
    pwd  = os.environ.get("GNS3_PASSWORD", "").strip()
    auth = (user, pwd) if user else None
    return url, auth

# ─────────────────────────────────────────────────────────────────────────────
# IN-MEMORY EXECUTION LOG
# ─────────────────────────────────────────────────────────────────────────────

_logs: list[dict] = []
_log_lock = threading.Lock()

def _log(level: str, message: str):
    """Append a structured log entry (thread-safe)."""
    entry = {
        "ts":      time.strftime("%H:%M:%S"),
        "level":   level.upper(),   # OK | INFO | ERROR | WARN
        "message": message,
    }
    with _log_lock:
        _logs.append(entry)
    print(f"[GNS3][{entry['level']}] {message}")

def get_logs() -> list[dict]:
    with _log_lock:
        return list(_logs)

def clear_logs():
    with _log_lock:
        _logs.clear()


# ─────────────────────────────────────────────────────────────────────────────
# GNS3 REST HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get(path: str, timeout: int = 10) -> dict:
    """GET /v2/{path} — returns parsed JSON or raises RuntimeError."""
    if not REQUESTS_AVAILABLE:
        raise RuntimeError("'requests' library not installed. Run: pip install requests")
    url, auth = _get_config()
    resp = requests.get(f"{url}/v2/{path.lstrip('/')}", auth=auth, timeout=timeout)
    resp.raise_for_status()
    return resp.json()

def _post(path: str, payload: Optional[dict] = None, timeout: int = 10) -> dict:
    """POST /v2/{path} — returns parsed JSON or raises RuntimeError."""
    if not REQUESTS_AVAILABLE:
        raise RuntimeError("'requests' library not installed. Run: pip install requests")
    url, auth = _get_config()
    resp = requests.post(
        f"{url}/v2/{path.lstrip('/')}",
        json=payload or {},
        auth=auth,
        timeout=timeout,
    )
    resp.raise_for_status()
    try:
        return resp.json()
    except Exception:
        return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API — CONNECTION
# ─────────────────────────────────────────────────────────────────────────────

def check_connection() -> dict:
    """
    Verify the GNS3 server is reachable.
    Returns {"ok": True/False, "version": "...", "url": "...", "error": "..."}
    """
    url, _ = _get_config()
    try:
        data = _get("version")
        version = data.get("version", "unknown")
        _log("OK", f"GNS3 server connected — version {version} at {url}")
        return {"ok": True, "version": version, "url": url}
    except Exception as e:
        msg = str(e)
        if "Connection refused" in msg or "Failed to establish" in msg:
            msg = f"GNS3 server is not running at {url}. Please start GNS3 and try again."
        elif "timeout" in msg.lower():
            msg = f"Connection to GNS3 server timed out. Check that {url} is reachable."
        else:
            msg = f"Unable to connect to GNS3 server at {url}: {msg}"
        _log("ERROR", msg)
        return {"ok": False, "url": url, "error": msg}


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API — PROJECTS
# ─────────────────────────────────────────────────────────────────────────────

def get_projects() -> dict:
    """
    Return all GNS3 projects.
    Returns {"ok": True, "projects": [{"id": ..., "name": ..., "status": ...}, ...]}
    """
    try:
        raw = _get("projects")
        projects = [
            {
                "id":     p["project_id"],
                "name":   p.get("name", "Unnamed"),
                "status": p.get("status", "unknown"),
            }
            for p in raw
        ]
        _log("OK", f"Loaded {len(projects)} GNS3 project(s)")
        return {"ok": True, "projects": projects}
    except Exception as e:
        msg = f"Failed to retrieve GNS3 projects: {e}"
        _log("ERROR", msg)
        return {"ok": False, "error": msg}


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API — NODES
# ─────────────────────────────────────────────────────────────────────────────

def get_project_nodes(project_id: str) -> dict:
    """
    Return all nodes in a GNS3 project.
    Returns {"ok": True, "nodes": [{id, name, status, type, console, console_host}, ...]}
    """
    try:
        raw = _get(f"projects/{project_id}/nodes")
        nodes = []
        for n in raw:
            nodes.append({
                "id":           n["node_id"],
                "name":         n.get("name", ""),
                "status":       n.get("status", "stopped"),
                "node_type":    n.get("node_type", ""),
                "console":      n.get("console"),
                "console_host": n.get("console_host", "127.0.0.1"),
                "console_type": n.get("console_type", "none"),
                "ports":        n.get("ports", []),
            })
        _log("INFO", f"Loaded {len(nodes)} node(s) from project {project_id}")
        return {"ok": True, "nodes": nodes}
    except Exception as e:
        msg = f"Failed to get nodes for project {project_id}: {e}"
        _log("ERROR", msg)
        return {"ok": False, "error": msg}


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API — NODE CONTROL
# ─────────────────────────────────────────────────────────────────────────────

def start_node(project_id: str, node_id: str) -> dict:
    """Start a GNS3 node. Returns {"ok": True/False, "error": ...}"""
    try:
        _post(f"projects/{project_id}/nodes/{node_id}/start")
        _log("OK", f"Node {node_id} started")
        return {"ok": True}
    except Exception as e:
        msg = f"Failed to start node {node_id}: {e}"
        _log("ERROR", msg)
        return {"ok": False, "error": msg}

def stop_node(project_id: str, node_id: str) -> dict:
    """Stop a GNS3 node. Returns {"ok": True/False, "error": ...}"""
    try:
        _post(f"projects/{project_id}/nodes/{node_id}/stop")
        _log("OK", f"Node {node_id} stopped")
        return {"ok": True}
    except Exception as e:
        msg = f"Failed to stop node {node_id}: {e}"
        _log("ERROR", msg)
        return {"ok": False, "error": msg}

def ensure_node_running(project_id: str, node_id: str, node_name: str) -> dict:
    """
    Check if a node is started; if not, start it automatically and wait up to
    30 s for it to come online. Returns {"ok": True/False, "error": ...}.
    """
    try:
        node_info = _get(f"projects/{project_id}/nodes/{node_id}")
        status = node_info.get("status", "stopped")

        if status == "started":
            _log("INFO", f"{node_name} is already running")
            return {"ok": True}

        _log("INFO", f"{node_name} is stopped — starting automatically…")
        result = start_node(project_id, node_id)
        if not result["ok"]:
            return result

        # Wait for node to become started (up to 30 s)
        for _ in range(15):
            time.sleep(2)
            info = _get(f"projects/{project_id}/nodes/{node_id}")
            if info.get("status") == "started":
                _log("OK", f"{node_name} is now running")
                return {"ok": True}

        _log("WARN", f"{node_name} did not confirm started within 30 s — continuing anyway")
        return {"ok": True}

    except Exception as e:
        msg = f"Could not ensure {node_name} is running: {e}"
        _log("ERROR", msg)
        return {"ok": False, "error": msg}


# ─────────────────────────────────────────────────────────────────────────────
# TELNET CONSOLE
# ─────────────────────────────────────────────────────────────────────────────

def _telnet_send_commands(host: str, port: int, commands: list[str],
                           timeout: int = 60) -> dict:
    """
    Open a Telnet session to a GNS3 node console, send IOS commands, and
    capture output. Works on Python 3.9-3.14 (telnetlib removed in 3.13).
    Returns {"ok": True, "output": "..."} or {"ok": False, ...}.
    """
    if _HAS_TELNETLIB:
        return _telnet_via_telnetlib(host, port, commands, timeout)
    else:
        return _telnet_via_socket(host, port, commands, timeout)


def _telnet_via_telnetlib(host, port, commands, timeout):
    """Telnet using the standard telnetlib (Python <= 3.12)."""
    output_lines = []
    try:
        _log("INFO", f"Opening Telnet (telnetlib) to {host}:{port} …")
        tn = telnetlib.Telnet(host, port, timeout=timeout)

        def read_prompt(wait=3.0):
            patterns = [b"#", b">", b"--More--", b"Press RETURN", b"$"]
            deadline = time.time() + wait
            buf = b""
            while time.time() < deadline:
                try:
                    chunk = tn.read_eager()
                    if chunk:
                        buf += chunk
                        for p in patterns:
                            # Avoid matching # inside a syslog message if possible
                            if p in buf and not buf.endswith(b"up\r\n"): 
                                return buf
                except EOFError:
                    break
                time.sleep(0.1)
            return buf

        # Wake up the console
        tn.write(b"\r\n\r\n")
        time.sleep(0.5)
        tn.read_very_eager() # Clear buffer
        tn.write(b"\r\n")
        read_prompt(wait=2.0)
        
        for cmd in commands:
            tn.write((cmd + "\r\n").encode("ascii"))
            # Wait longer for interface and no shutdown commands
            if cmd.startswith("interface") or cmd.startswith("no shut"):
                time.sleep(0.8)
            else:
                time.sleep(0.3)
            out = read_prompt(wait=3.0)
            output_lines.append(out.decode("ascii", errors="replace").strip())

        tn.close()
        _log("INFO", f"Telnet Output for {host}:{port}:\n{chr(10).join(output_lines)}")
        _log("OK", f"Commands sent via telnetlib to {host}:{port}")
        return {"ok": True, "output": "\n".join(output_lines)}
    except ConnectionRefusedError:
        msg = f"Telnet refused on {host}:{port}. Console may not be ready."
        _log("ERROR", msg); return {"ok": False, "error": msg}
    except socket.timeout:
        msg = f"Telnet to {host}:{port} timed out after {timeout}s."
        _log("ERROR", msg); return {"ok": False, "error": msg}
    except Exception as e:
        msg = f"Telnet error on {host}:{port}: {e}"
        _log("ERROR", msg); return {"ok": False, "error": msg}


# IAC codes for raw-socket Telnet negotiation
_IAC  = bytes([255])
_DONT = bytes([254])
_DO   = bytes([253])
_WONT = bytes([252])
_WILL = bytes([251])

def _telnet_via_socket(host, port, commands, timeout):
    """Telnet using raw sockets (Python 3.13+ where telnetlib was removed)."""
    output_lines = []
    try:
        _log("INFO", f"Opening Telnet (socket) to {host}:{port} …")
        sock = socket.create_connection((host, port), timeout=timeout)
        sock.settimeout(timeout)

        def recv_until_prompt(wait=3.0):
            """Read bytes until a common IOS prompt appears or wait expires."""
            buf = b""
            deadline = time.time() + wait
            while time.time() < deadline:
                try:
                    sock.settimeout(0.15)
                    chunk = sock.recv(4096)
                    if not chunk:
                        break
                    # Strip Telnet IAC sequences
                    i = 0
                    clean = bytearray()
                    while i < len(chunk):
                        if chunk[i:i+1] == _IAC and i + 2 < len(chunk):
                            cmd_byte = chunk[i+1:i+2]
                            # Respond to DO/WILL with WONT/DONT
                            if cmd_byte in (_DO, _WILL):
                                sock.sendall(_IAC + _WONT + chunk[i+2:i+3])
                            i += 3
                        else:
                            clean.append(chunk[i])
                            i += 1
                    buf += bytes(clean)
                    # Check for IOS prompt indicators
                    for p in [b"#", b">", b"$", b"--More--"]:
                        if p in buf:
                            return buf
                except socket.timeout:
                    pass
                except Exception:
                    break
            return buf

        # Wake up the console and wait for initial banner
        sock.sendall(b"\r\n\r\n")
        out = recv_until_prompt(wait=3.0)
        
        # If the router asks for initial configuration dialog, say no and wait for boot
        if b"yes/no" in out.lower() or b"initial configuration dialog" in out.lower():
            sock.sendall(b"no\r\n")
            _log("INFO", f"Answering 'no' to initial config dialog on {host}:{port} and waiting for boot...")
            time.sleep(5.0)  # Give it some time to decompress/boot
            recv_until_prompt(wait=10.0)
            sock.sendall(b"\r\n\r\n")
            out = recv_until_prompt(wait=3.0)

        for cmd in commands:
            sock.sendall((cmd + "\r\n").encode("ascii"))
            time.sleep(0.3)
            out = recv_until_prompt(wait=4.0)
            output_lines.append(out.decode("ascii", errors="replace").strip())

        sock.close()
        _log("OK", f"Commands sent via socket-telnet to {host}:{port}")
        return {"ok": True, "output": "\n".join(output_lines)}

    except ConnectionRefusedError:
        msg = f"Telnet refused on {host}:{port}. Console may not be ready."
        _log("ERROR", msg); return {"ok": False, "error": msg}
    except socket.timeout:
        msg = f"Telnet to {host}:{port} timed out after {timeout}s."
        _log("ERROR", msg); return {"ok": False, "error": msg}
    except Exception as e:
        msg = f"Telnet socket error on {host}:{port}: {e}"
        _log("ERROR", msg); return {"ok": False, "error": msg}


# ─────────────────────────────────────────────────────────────────────────────
# CONFIG GENERATION FROM AI TOPOLOGY
# ─────────────────────────────────────────────────────────────────────────────

def _cidr_to_mask(cidr_or_ip: str) -> tuple[str, str]:
    """Convert '192.168.1.1/24' → ('192.168.1.1', '255.255.255.0')."""
    try:
        if "/" in cidr_or_ip:
            iface = ipaddress.IPv4Interface(cidr_or_ip)
            return str(iface.ip), str(iface.netmask)
        return cidr_or_ip, "255.255.255.0"
    except Exception:
        return cidr_or_ip, "255.255.255.0"


def _normalize_iface_name(raw: str) -> str:
    """
    Normalize short interface names to full IOS names.
    g0/0 → GigabitEthernet0/0, f0/0 → FastEthernet0/0, e0 → Ethernet0, etc.
    """
    raw = raw.strip()
    lraw = raw.lower()
    if lraw.startswith("gig") or lraw.startswith("g"):
        rest = re.sub(r"^g(?:iga)?(?:bit)?(?:ethernet)?", "", lraw)
        return f"GigabitEthernet{rest}"
    if lraw.startswith("fa") or lraw.startswith("f0"):
        rest = re.sub(r"^f(?:ast)?(?:ethernet)?", "", lraw)
        return f"FastEthernet{rest}"
    if lraw.startswith("eth"):
        rest = re.sub(r"^eth(?:ernet)?", "", lraw)
        return f"Ethernet{rest}"
    if lraw.startswith("e") and not lraw.startswith("eth"):
        rest = re.sub(r"^e", "", lraw)
        return f"Ethernet{rest}"
    if lraw.startswith("ser") or lraw.startswith("s"):
        rest = re.sub(r"^s(?:er(?:ial)?)?", "", lraw)
        return f"Serial{rest}"
    return raw  # unknown — keep as-is


def generate_device_commands(device: dict, gns3_node: dict = None) -> list[str]:
    """
    Given a device entry from the AI-scanned topology JSON, generate the
    ordered list of Cisco IOS configuration commands.

    Device dict shape (from gemini_vision.py PROMPT):
    {
      "id": "R1", "type": "router", "label": "R1",
      "interfaces": [{"name": "g0/0", "ip": "192.168.1.1/24"}, ...]
    }
    """
    name = device.get("label") or device.get("id") or "Device"
    device_type = device.get("type", "router").lower()
    interfaces = device.get("interfaces", [])

    # If we have the real GNS3 node, map the AI interfaces to the real GNS3 ports in order
    if gns3_node and "ports" in gns3_node:
        # Sort ports by adapter_number then port_number to match logical order
        gns3_ports = sorted(gns3_node["ports"], key=lambda p: (p.get("adapter_number", 0), p.get("port_number", 0)))
        
        # Override the AI guessed interface names with the real hardware names
        for i, iface in enumerate(interfaces):
            if i < len(gns3_ports):
                # We use the 'name' field from GNS3 (e.g., 'FastEthernet0/0')
                iface["name"] = gns3_ports[i].get("name", iface.get("name"))

    # VPCS / PC nodes — minimal config
    if device_type in ("pc", "vpcs"):
        cmds = []
        if interfaces:
            iface = interfaces[0]
            ip_str = iface.get("ip", "")
            gw_str = iface.get("gateway", "")
            if ip_str:
                if gw_str:
                    cmds.append(f"ip {ip_str} {gw_str}")
                else:
                    cmds.append(f"ip {ip_str}")
                cmds.append("save")
        return cmds

    # Switch — basic VLAN mode
    if device_type == "switch":
        cmds = ["end", "enable", "configure terminal", f"hostname {name}"]
        for iface in interfaces:
            iname = _normalize_iface_name(iface.get("name", ""))
            if iname:
                cmds += [
                    f"interface {iname}",
                    "switchport mode access",
                    "no shutdown",
                    "exit",
                ]
        cmds += ["end", "write memory"]
        return cmds

    # Router (default)
    cmds = ["end", "enable", "configure terminal", f"hostname {name}"]
    for iface in interfaces:
        ip_str = iface.get("ip", "")
        iname  = _normalize_iface_name(iface.get("name", ""))
        if not iname:
            continue
        cmds.append(f"interface {iname}")
        if ip_str:
            ip, mask = _cidr_to_mask(ip_str)
            cmds += [f"ip address {ip} {mask}", "no shutdown"]
        else:
            cmds.append("no shutdown")
        cmds.append("exit")
    cmds += ["end", "write memory"]
    return cmds


def validate_device_config(device: dict) -> list[str]:
    """
    Validate AI-generated device config before sending to GNS3.
    Returns a list of warning/error strings. Empty list = valid.
    """
    warnings = []
    name = device.get("label") or device.get("id") or ""
    if not name:
        warnings.append("Device has no name (id/label)")

    device_type = device.get("type", "").lower()
    valid_types = {"router", "switch", "pc", "vpcs", "firewall", "server",
                   "wireless", "cloud", "unknown"}
    if device_type not in valid_types:
        warnings.append(f"Unknown device type: '{device_type}'")

    for iface in device.get("interfaces", []):
        ip_str = iface.get("ip", "")
        if ip_str:
            try:
                ipaddress.IPv4Interface(ip_str)
            except ValueError:
                warnings.append(
                    f"{name}: Invalid IP/mask '{ip_str}' on interface "
                    f"'{iface.get('name', '?')}'"
                )

    return warnings


# ─────────────────────────────────────────────────────────────────────────────
# DEVICE MAPPING
# ─────────────────────────────────────────────────────────────────────────────

def _normalize_name(name: str) -> str:
    """Lower-case and strip common non-alphanumeric prefixes for fuzzy match."""
    n = name.lower().strip()
    n = re.sub(r"[^a-z0-9]", "", n)   # keep only alphanumeric
    return n


def auto_map_devices(ai_devices: list[dict], gns3_nodes: list[dict]) -> list[dict]:
    """
    Attempt to auto-map AI devices to GNS3 nodes by name similarity.
    Returns a mapping list:
    [
      {"ai_name": "R1", "gns3_id": "uuid...", "gns3_name": "R1", "confidence": "exact"},
      {"ai_name": "R2", "gns3_id": None,      "gns3_name": None, "confidence": "none"},
    ]
    """
    mapping = []
    gns3_by_norm = {_normalize_name(n["name"]): n for n in gns3_nodes}

    for dev in ai_devices:
        ai_name = dev.get("label") or dev.get("id") or ""
        norm_ai = _normalize_name(ai_name)

        # 1. Exact normalized match
        if norm_ai in gns3_by_norm:
            gn = gns3_by_norm[norm_ai]
            mapping.append({
                "ai_name":   ai_name,
                "gns3_id":   gn["id"],
                "gns3_name": gn["name"],
                "confidence": "exact",
            })
            continue

        # 2. Substring match (e.g., "Router_R1" → "R1")
        found = None
        for norm_gns3, gn in gns3_by_norm.items():
            if norm_ai in norm_gns3 or norm_gns3 in norm_ai:
                found = gn
                break

        if found:
            mapping.append({
                "ai_name":   ai_name,
                "gns3_id":   found["id"],
                "gns3_name": found["name"],
                "confidence": "fuzzy",
            })
        else:
            mapping.append({
                "ai_name":   ai_name,
                "gns3_id":   None,
                "gns3_name": None,
                "confidence": "none",
            })

    return mapping


# ─────────────────────────────────────────────────────────────────────────────
# MAIN APPLY WORKFLOW
# ─────────────────────────────────────────────────────────────────────────────

def apply_configuration(project_id: str, device_mapping: list[dict],
                        ai_devices: list[dict], gns3_nodes: list[dict]) -> dict:
    """
    Full automated workflow:
      1. Validate all AI-generated configs
      2. For each mapped device:
         a. Ensure node is running (auto-start)
         b. Open Telnet console
         c. Send configuration commands
         d. Collect output
      3. Return per-device results

    Args:
        project_id:     GNS3 project UUID
        device_mapping: [{ai_name, gns3_id, gns3_name, confidence}, ...]
        ai_devices:     Full AI device list from scanned topology
        gns3_nodes:     Full GNS3 nodes list from get_project_nodes()

    Returns:
        {"ok": True/False, "results": [{device, status, output, error}, ...]}
    """
    clear_logs()
    _log("INFO", "Starting configuration apply workflow…")

    # Index for fast lookup
    ai_by_name  = {(d.get("label") or d.get("id", "")): d for d in ai_devices}
    gns3_by_id  = {n["id"]: n for n in gns3_nodes}

    results = []
    all_ok  = True

    # ── Phase 1: Validate ────────────────────────────────────────────────────
    _log("INFO", "Phase 1: Validating AI-generated configurations…")
    for mapping in device_mapping:
        ai_name  = mapping["ai_name"]
        gns3_id  = mapping.get("gns3_id")
        ai_dev   = ai_by_name.get(ai_name, {})

        if not gns3_id:
            msg = (f"AI device '{ai_name}' has no GNS3 mapping. "
                   "Please select a GNS3 device manually.")
            _log("ERROR", msg)
            results.append({
                "device": ai_name, "status": "error",
                "output": "", "error": msg,
            })
            all_ok = False
            continue

        warnings = validate_device_config(ai_dev)
        for w in warnings:
            _log("WARN", w)

        if not ai_dev.get("interfaces") and ai_dev.get("type", "").lower() not in ("switch", "pc", "vpcs"):
            _log("WARN", f"{ai_name}: No interfaces found — will only set hostname")

    # ── Phase 2: Apply per device ────────────────────────────────────────────
    _log("INFO", "Phase 2: Sending configurations to GNS3 devices…")
    for mapping in device_mapping:
        ai_name  = mapping["ai_name"]
        gns3_id  = mapping.get("gns3_id")
        if not gns3_id:
            continue   # already logged above

        gns3_node = gns3_by_id.get(gns3_id, {})
        gns3_name = gns3_node.get("name", gns3_id)
        ai_dev    = ai_by_name.get(ai_name, {})

        _log("INFO", f"Processing: AI '{ai_name}' -> GNS3 '{gns3_name}'")

        # 2a. Ensure node is running
        ensure_result = ensure_node_running(project_id, gns3_id, gns3_name)
        if not ensure_result["ok"]:
            results.append({
                "device": ai_name, "status": "error",
                "output": "", "error": ensure_result["error"],
            })
            all_ok = False
            continue

        # 2b. Build commands
        commands = generate_device_commands(ai_dev, gns3_node=gns3_node)
        if not commands:
            _log("WARN", f"{gns3_name}: No commands generated — skipping")
            results.append({
                "device": ai_name, "status": "skipped",
                "output": "No commands generated for this device type.",
                "error": "",
            })
            continue

        _log("INFO", f"{gns3_name}: Sending {len(commands)} command(s) via Telnet…")

        # 2c. Send via Telnet
        console_host = gns3_node.get("console_host", "127.0.0.1")
        console_port = gns3_node.get("console")
        console_type = gns3_node.get("console_type", "none")

        if not console_port or console_type == "none":
            msg = (f"{gns3_name}: No console port available "
                   f"(type={console_type}). Cannot send configuration.")
            _log("WARN", msg)
            results.append({
                "device": ai_name, "status": "skipped",
                "output": msg, "error": "",
            })
            continue

        telnet_result = _telnet_send_commands(
            console_host, console_port, commands, timeout=60
        )

        if telnet_result["ok"]:
            _log("OK", f"{gns3_name}: Configuration applied successfully")
            results.append({
                "device":  ai_name,
                "status":  "success",
                "output":  telnet_result.get("output", ""),
                "error":   "",
                "commands": commands,
            })
        else:
            all_ok = False
            results.append({
                "device":  ai_name,
                "status":  "error",
                "output":  "",
                "error":   telnet_result.get("error", "Unknown telnet error"),
                "commands": commands,
            })

    _log("INFO", "Configuration apply workflow complete.")
    return {"ok": all_ok, "results": results}


# ─────────────────────────────────────────────────────────────────────────────
# VERIFICATION
# ─────────────────────────────────────────────────────────────────────────────
# Commands to run to "verify" the config worked
_VERIFY_COMMANDS = {
    "router":   ["show ip interface brief", "show ip route"],
    "switch":   ["show ip interface brief", "show vlan brief"],
    "pc":       ["show ip"],
    "vpcs":     ["show ip"],
    "default":  ["show ip interface brief"],
}

def _parse_router_output(raw_output):
    parsed = {}
    for line in raw_output.strip().split('\n'):
        match = re.search(r'^(\S+)\s+(\S+)\s+\w+\s+\w+\s+(administratively down|up|down)\s+(up|down)', line.strip())
        if match:
            parsed[match.group(1)] = {
                "ip": match.group(2),
                "status": match.group(3),
                "protocol": match.group(4)
            }
    return parsed

def _parse_pc_output(raw_output):
    parsed = {}
    ip_match = re.search(r'IP/MASK\s+:\s+(\S+)', raw_output)
    gw_match = re.search(r'GATEWAY\s+:\s+(\S+)', raw_output)
    if ip_match:
        parsed["ip"] = ip_match.group(1)
    if gw_match:
        parsed["gateway"] = gw_match.group(1)
    return parsed

def verify_configuration(project_id: str, device_mapping: list[dict],
                          ai_devices: list[dict], gns3_nodes: list[dict]) -> dict:
    """
    Run verification commands on each mapped GNS3 device and return output.
    Returns {"ok": True, "results": [{device, status, output}, ...]}
    """
    _log("INFO", "Starting post-apply verification…")
    ai_by_name = {(d.get("label") or d.get("id", "")): d for d in ai_devices}
    gns3_by_id = {n["id"]: n for n in gns3_nodes}
    results    = []

    for mapping in device_mapping:
        ai_name  = mapping["ai_name"]
        gns3_id  = mapping.get("gns3_id")
        if not gns3_id:
            results.append({"device": ai_name, "status": "skipped",
                             "output": "No GNS3 mapping", "error": ""})
            continue

        gns3_node = gns3_by_id.get(gns3_id, {})
        gns3_name = gns3_node.get("name", gns3_id)
        ai_dev    = ai_by_name.get(ai_name, {})
        dev_type  = ai_dev.get("type", "default").lower()

        verify_cmds = _VERIFY_COMMANDS.get(dev_type, _VERIFY_COMMANDS["default"])
        _log("INFO", f"Verifying {gns3_name} with: {verify_cmds}")

        console_host = gns3_node.get("console_host", "127.0.0.1")
        console_port = gns3_node.get("console")
        console_type = gns3_node.get("console_type", "none")

        if not console_port or console_type == "none":
            results.append({"device": ai_name, "status": "skipped",
                             "output": f"No console port on {gns3_name}", "error": ""})
            continue

        # Need to enter enable first for verification
        cmds = ["enable"] + verify_cmds
        r = _telnet_send_commands(console_host, console_port, cmds, timeout=60)
        
        parsed_summary = []
        error_msg = ""
        
        if r["ok"]:
            raw_output = r.get("output", "")
            
            if dev_type in ["router", "switch"]:
                parsed = _parse_router_output(raw_output)
                needs_fix = [iface for iface, d in parsed.items() if d["status"] == "administratively down"]
                if needs_fix:
                    _log("INFO", f"Auto-correcting administratively down interfaces on {gns3_name}: {needs_fix}")
                    fix_cmds = ["configure terminal"]
                    for iface in needs_fix:
                        fix_cmds.extend([f"interface {iface}", "no shutdown", "exit"])
                    fix_cmds.extend(["end", "write memory"] + verify_cmds)
                    fix_r = _telnet_send_commands(console_host, console_port, fix_cmds, timeout=60)
                    if fix_r["ok"]:
                        raw_output = fix_r.get("output", "")
                        parsed = _parse_router_output(raw_output)
                
                # Hardware to AI mapping for validation
                hardware_to_ai = {}
                gns3_ports = sorted(gns3_node.get("ports", []), key=lambda p: (p.get("adapter_number", 0), p.get("port_number", 0)))
                for i, ai_iface in enumerate(ai_dev.get("interfaces", [])):
                    if i < len(gns3_ports):
                        hw_name = gns3_ports[i].get("name", "")
                        hardware_to_ai[hw_name] = ai_iface
                        hardware_to_ai[_normalize_iface_name(hw_name)] = ai_iface
                
                all_ok = True
                for iface, data in parsed.items():
                    # Only report interfaces that are mapped or have IPs
                    ai_iface = hardware_to_ai.get(iface)
                    if ai_iface:
                        expected_ip_cidr = ai_iface.get("ip", "")
                        expected_ip = expected_ip_cidr.split("/")[0] if expected_ip_cidr else ""
                        
                        if expected_ip and data["ip"] != expected_ip:
                            error_msg += f"{ai_name} {iface} configuration failed.\nExpected IP: {expected_ip}\nActual IP: {data['ip']}\n"
                            all_ok = False
                        elif expected_ip and data["protocol"] == "down":
                            error_msg += f"{ai_name} {iface} configured successfully, but interface protocol is down.\nCheck the GNS3 link connection.\n"
                            all_ok = False
                            
                        parsed_summary.append(f"{iface} → {expected_ip_cidr or data['ip']}     {data['status'].upper()}/{data['protocol'].upper()}")
                    elif data["ip"] != "unassigned":
                        # Always show configured IPs even if not in the AI plan
                        parsed_summary.append(f"{iface} → {data['ip']}     {data['status'].upper()}/{data['protocol'].upper()} (Unmapped)")
                
                if not all_ok:
                    results.append({"device": ai_name, "status": "error", "output": raw_output, "error": error_msg, "parsed_summary": parsed_summary})
                    continue
                    
            elif dev_type in ["pc", "vpcs"]:
                parsed = _parse_pc_output(raw_output)
                if "ip" in parsed:
                    parsed_summary.append(f"{parsed['ip']}")
                if "gateway" in parsed:
                    parsed_summary.append(f"Gateway: {parsed['gateway']}")

            _log("OK", f"{gns3_name}: Verification complete")
            results.append({"device": ai_name, "status": "success",
                             "output": raw_output, "error": "", "parsed_summary": parsed_summary})
        else:
            results.append({"device": ai_name, "status": "error",
                             "output": "", "error": r.get("error", "")})

    return {"ok": True, "results": results}


# ─────────────────────────────────────────────────────────────────────────────
# CONFIG PREVIEW (for UI display before applying)
# ─────────────────────────────────────────────────────────────────────────────

def build_config_preview(ai_devices: list[dict]) -> dict:
    """
    Generate a human-readable configuration preview for all AI devices.
    Returns {"ok": True, "preview": {"R1": ["cmd1", ...], ...}, "warnings": [...]}
    """
    preview  = {}
    warnings = []
    for dev in ai_devices:
        name  = dev.get("label") or dev.get("id") or "Unknown"
        cmds  = generate_device_commands(dev)
        warns = validate_device_config(dev)
        preview[name] = cmds
        if warns:
            warnings.extend(warns)
    return {"ok": True, "preview": preview, "warnings": warnings}


# ─────────────────────────────────────────────────────────────────────────────
# LIVE IP SYNCHRONIZATION
# ─────────────────────────────────────────────────────────────────────────────

import concurrent.futures

def get_live_ips(project_id: str) -> dict:
    """
    Connect to all running nodes in the project and extract their live IP addresses.
    Returns {"ok": True, "live_ips": {"R1": "192.168.10.1", ...}}
    """
    _log("INFO", f"Fetching live IPs for project {project_id}...")
    nodes_res = get_project_nodes(project_id)
    if not nodes_res.get("ok"):
        return nodes_res
        
    nodes = nodes_res.get("nodes", [])
    live_ips = {}
    
    def fetch_ip_for_node(node):
        if node.get("status") != "started":
            return None, None
            
        name = node.get("name")
        console_host = node.get("console_host", "127.0.0.1")
        console_port = node.get("console")
        if not console_port:
            return None, None
            
        node_type = node.get("node_type", "dynamips").lower()
        if node_type == "vpcs" or name.startswith("PC"):
            # PC Node
            r = _telnet_send_commands(console_host, console_port, ["show ip"], timeout=15)
            if r["ok"]:
                parsed = _parse_pc_output(r["output"])
                if "ip" in parsed:
                    return name, parsed["ip"]
                return name, "unassigned"
        else:
            # Router/Switch Node
            r = _telnet_send_commands(console_host, console_port, ["show ip interface brief"], timeout=15)
            if r["ok"]:
                parsed = _parse_router_output(r["output"])
                ips = [data["ip"] for iface, data in parsed.items() if data["ip"] != "unassigned"]
                if ips:
                    return name, ips[0]
                return name, "unassigned"
        return None, None

    # Fetch concurrently to save time
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_node = {executor.submit(fetch_ip_for_node, n): n for n in nodes}
        for future in concurrent.futures.as_completed(future_to_node):
            try:
                name, ip = future.result()
                if name and ip:
                    live_ips[name] = ip
            except Exception as e:
                _log("ERROR", f"Error fetching IP: {e}")

    _log("OK", f"Live IPs fetched: {live_ips}")
    return {"ok": True, "live_ips": live_ips}
