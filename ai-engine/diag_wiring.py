import sys, json
sys.path.insert(0, 'scripts')
from gns3_service import get_projects, get_project_nodes, _get

proj = get_projects()
open_proj = next((p for p in proj.get('projects', []) if p['status'] == 'opened'), None)
if not open_proj:
    print("No open project")
    sys.exit(0)

pid = open_proj['id']
nodes_res = get_project_nodes(pid)
nodes_by_id = {n['id']: n for n in nodes_res.get('nodes', [])}

links_res = _get(f"projects/{pid}/links")
print('=== REAL GNS3 WIRING ===')
for lk in links_res:
    n1, n2 = lk['nodes'][0], lk['nodes'][1]
    node1 = nodes_by_id.get(n1['node_id'], {})
    node2 = nodes_by_id.get(n2['node_id'], {})
    
    # Get port names for node1
    port1_name = 'Unknown'
    for p in node1.get('ports', []):
        if p['adapter_number'] == n1['adapter_number'] and p['port_number'] == n1['port_number']:
            port1_name = p['name']
            
    # Get port names for node2
    port2_name = 'Unknown'
    for p in node2.get('ports', []):
        if p['adapter_number'] == n2['adapter_number'] and p['port_number'] == n2['port_number']:
            port2_name = p['name']
            
    print(f"{node1.get('name')} ({port1_name}) <---> {node2.get('name')} ({port2_name})")
