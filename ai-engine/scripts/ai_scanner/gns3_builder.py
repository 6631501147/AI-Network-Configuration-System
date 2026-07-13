import uuid
import math
import json

# Minimal templates for GNS3 nodes
def get_node_props(device_type):
    if device_type == "router":
        return {
            "node_type": "dynamips",
            "symbol": ":/symbols/router.svg",
            "width": 66, "height": 45,
            "properties": {
                "platform": "c7200",
                "nvram": 512, "ram": 512,
                "slot0": "C7200-IO-FE",
                "slot1": "PA-FE-TX",
                "image": "c7200-adventerprisek9-mz.153-3.XB12.image"
            }
        }
    elif device_type in ("switch", "l3switch"):
        return {
            "node_type": "ethernet_switch",
            "symbol": ":/symbols/ethernet_switch.svg",
            "width": 70, "height": 50,
            "properties": {
                "ports": [{"ethertype": "", "name": f"Ethernet{i}", "port_number": i, "type": "access", "vlan": 1} for i in range(8)]
            }
        }
    elif device_type == "firewall":
        return {
            "node_type": "qemu",
            "symbol": ":/symbols/firewall.svg",
            "width": 70, "height": 50,
            "properties": {
                "hda_disk_image": "",
                "ram": 1024,
                "adapters": 4
            }
        }
    elif device_type == "server":
        return {
            "node_type": "qemu",
            "symbol": ":/symbols/server.svg",
            "width": 70, "height": 50,
            "properties": {
                "hda_disk_image": "",
                "ram": 512,
                "adapters": 2
            }
        }
    elif device_type == "cloud":
        return {
            "node_type": "cloud",
            "symbol": ":/symbols/cloud.svg",
            "width": 57, "height": 50,
            "properties": {
                "ports_mapping": [{"interface_name": "eth0", "name": "eth0", "port_number": 0, "type": "ethernet"}]
            }
        }
    else: # PC / unknown
        return {
            "node_type": "vpcs",
            "symbol": ":/symbols/vpcs_guest.svg",
            "width": 65, "height": 45,
            "properties": {}
        }

def parse_interface(name):
    import re
    if not name: return 0, 0
    name = name.lower()
    m = re.match(r'[a-z]+(\d+)/(\d+)', name)
    if m: return int(m.group(1)), int(m.group(2))
    m = re.match(r'[a-z]+(\d+)', name)
    if m: return 0, int(m.group(1))
    return 0, 0

def build_gns3(topology_json: dict) -> dict:
    nodes = []
    node_map = {}
    console_port = 5000
    
    # Generate nodes
    for idx, dev in enumerate(topology_json.get("devices", [])):
        x = dev.get("x")
        y = dev.get("y")
        if x is None or y is None:
            # Auto grid if missing
            cols = 4
            x = 100 + (idx % cols) * 160
            y = 100 + (idx // cols) * 140
            
        props = get_node_props(dev.get("type", "pc"))
        
        node = {
            "compute_id": "local",
            "console": console_port,
            "console_auto_start": False,
            "console_type": "telnet" if props["node_type"] == "dynamips" else "none",
            "name": dev.get("label", dev.get("id", f"Node{idx}")),
            "node_id": str(uuid.uuid4()),
            "node_type": props["node_type"],
            "properties": props["properties"],
            "symbol": props["symbol"],
            "width": props["width"],
            "height": props["height"],
            "x": int(x),
            "y": int(y),
            "z": 1,
            "label": {
                "rotation": 0,
                "style": "font-family: TypeWriter;font-size: 10.0;font-weight: bold;fill: #000000;fill-opacity: 1.0;",
                "text": dev.get("label", dev.get("id", f"Node{idx}")),
                "x": 0,
                "y": -25
            }
        }
        nodes.append(node)
        node_map[dev.get("id")] = node
        console_port += 1

    # Generate links
    links = []
    seen = set()
    for conn in topology_json.get("connections", []):
        src_id = conn.get("from_device")
        tgt_id = conn.get("to_device")
        if not src_id or not tgt_id: continue
        
        pair = frozenset([src_id, tgt_id])
        if pair in seen: continue
        seen.add(pair)
        
        src_node = node_map.get(src_id)
        tgt_node = node_map.get(tgt_id)
        if not src_node or not tgt_node: continue
        
        sa, sp = parse_interface(conn.get("from_interface"))
        ta, tp = parse_interface(conn.get("to_interface"))
        
        links.append({
            "filters": {},
            "link_id": str(uuid.uuid4()),
            "nodes": [
                {"adapter_number": sa, "node_id": src_node["node_id"], "port_number": sp, "label": {"text": conn.get("from_interface", f"e{sp}")}},
                {"adapter_number": ta, "node_id": tgt_node["node_id"], "port_number": tp, "label": {"text": conn.get("to_interface", f"e{tp}")}}
            ],
            "suspend": False
        })
        
    return {
        "auto_close": True,
        "name": "Scanned_Topology",
        "project_id": str(uuid.uuid4()),
        "revision": 9,
        "topology": {
            "computes": [],
            "drawings": [],
            "links": links,
            "nodes": nodes,
        },
        "type": "topology",
        "version": "2.2.0"
    }
