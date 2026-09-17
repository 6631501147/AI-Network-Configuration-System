import sys, json
sys.path.append('scripts')
import gns3_service

p = '5db46dab-9ff5-4682-a2d0-3abe4c7ba48f'
gns3_nodes = gns3_service._get(f'projects/{p}/nodes')

with open('topology/scanned.gns3') as f:
    top = json.load(f)

ai_devs = top['_ai_topology']['devices']
r1_id = next(n['node_id'] for n in gns3_nodes if n['name'] == 'R1')
device_mapping = [{'ai_name': 'R1', 'gns3_id': r1_id}]

# Let's print the commands generated for R1 instead of applying them via telnet
ai_dev = next(d for d in ai_devs if d['id'] == 'R1')
gns3_node = next(n for n in gns3_nodes if n['node_id'] == r1_id)
connections = top.get('_ai_topology', {}).get('connections', [])

print("Connections passed:", len(connections))
cmds = gns3_service.generate_device_commands(ai_dev, gns3_node, ai_devs, connections)
print("Generated Commands:")
for c in cmds:
    print(c)
