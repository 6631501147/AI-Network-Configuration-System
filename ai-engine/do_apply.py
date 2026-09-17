import sys, json
sys.path.append('scripts')
import gns3_service

p = '5db46dab-9ff5-4682-a2d0-3abe4c7ba48f'
gns3_nodes = gns3_service._get(f'projects/{p}/nodes')

with open('topology/scanned.gns3') as f:
    top = json.load(f)

ai_devs = top['_ai_topology']['devices']
device_mapping = []
for n in gns3_nodes:
    if n['node_type'] == 'dynamips':
        device_mapping.append({'ai_name': n['name'], 'gns3_id': n['node_id']})

print("Applying configuration...")
result = gns3_service.apply_configuration(p, device_mapping, ai_devs, gns3_nodes, top)
print(json.dumps(result, indent=2))
