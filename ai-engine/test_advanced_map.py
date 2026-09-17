import sys, json
sys.path.insert(0, 'scripts')
from gns3_service import get_projects, get_project_nodes, _get

def _advanced_map_ifaces(ai_device, gns3_node, all_ai_devices, ai_connections, gns3_links, gns3_nodes_by_id):
    if not gns3_node:
        return []

    ai_label = ai_device.get('label') or ai_device.get('id', '')
    
    ai_iface_to_target = {}
    for conn in ai_connections:
        if conn.get('from_device') == ai_label:
            ai_iface_to_target[conn.get('from_interface')] = conn.get('to_device')
        elif conn.get('to_device') == ai_label:
            ai_iface_to_target[conn.get('to_interface')] = conn.get('from_device')

    gns3_port_to_target = {}
    my_gns3_id = gns3_node.get('id')
    for lk in gns3_links:
        n1, n2 = lk['nodes'][0], lk['nodes'][1]
        if n1['node_id'] == my_gns3_id:
            my_port_idx = (n1['adapter_number'], n1['port_number'])
            target_id = n2['node_id']
        elif n2['node_id'] == my_gns3_id:
            my_port_idx = (n2['adapter_number'], n2['port_number'])
            target_id = n1['node_id']
        else:
            continue
            
        my_port_name = None
        for p in gns3_node.get('ports', []):
            if (p['adapter_number'], p['port_number']) == my_port_idx:
                my_port_name = p['name']
                break
                
        target_node = gns3_nodes_by_id.get(target_id, {})
        target_name = target_node.get('name')
        if my_port_name and target_name:
            gns3_port_to_target[my_port_name] = target_name

    target_to_gns3_port = {v: k for k, v in gns3_port_to_target.items()}
    
    result = []
    hw_ports_sorted = sorted(
        gns3_node.get("ports", []),
        key=lambda p: (p.get("adapter_number", 0), p.get("port_number", 0))
    )
    
    for idx, ai_iface in enumerate(ai_device.get('interfaces', [])):
        ai_iname = ai_iface.get('name')
        target = ai_iface_to_target.get(ai_iname)
        
        hw_name = None
        if target and target in target_to_gns3_port:
            hw_name = target_to_gns3_port[target]
        else:
            if idx < len(hw_ports_sorted):
                hw_name = hw_ports_sorted[idx].get("name")
                
        result.append({
            "hw_name": hw_name,
            "ip": ai_iface.get("ip", ""),
            "gateway": ai_iface.get("gateway", "")
        })
        
    return result

proj = get_projects()
open_proj = next((p for p in proj.get('projects', []) if p['status'] == 'opened'), None)
pid = open_proj['id']
nodes_res = get_project_nodes(pid)
gns3_nodes_by_id = {n['id']: n for n in nodes_res.get('nodes', [])}
gns3_links = _get(f"projects/{pid}/links")

with open('topology/scanned.gns3') as f:
    data = json.load(f)
ai_topo = data.get('_ai_topology', {})
ai_devices = ai_topo.get('devices', [])
ai_connections = ai_topo.get('connections', [])

for dev in ai_devices:
    if dev.get('type') == 'router':
        label = dev.get('label')
        gns3_node = next((n for n in nodes_res.get('nodes', []) if n['name'] == label), None)
        res = _advanced_map_ifaces(dev, gns3_node, ai_devices, ai_connections, gns3_links, gns3_nodes_by_id)
        print(f"--- {label} ---")
        for r in res:
            print(f"  IP {r['ip']} -> {r['hw_name']}")
