import json

d = json.load(open('topology/KOTHANT.gns3', encoding='utf-8'))
nodes = d['topology']['nodes']
links = d['topology']['links']

print('=== NODES ===')
for n in nodes:
    print(f"  {n['name']} ({n['node_type']}) id={n['node_id']} x={n['x']} y={n['y']}")

print()
print('=== LINKS ===')
node_map = {n['node_id']: n['name'] for n in nodes}
for l in links:
    ns = l['nodes']
    n0 = node_map.get(ns[0]['node_id'], '?')
    n1 = node_map.get(ns[1]['node_id'], '?')
    lbl0 = ns[0].get('label', {}).get('text', '?')
    lbl1 = ns[1].get('label', {}).get('text', '?')
    print(f"  {n0} ({lbl0}) --- {n1} ({lbl1})")

print()
print('=== DRAWINGS ===')
for dr in d['topology']['drawings']:
    svg = dr.get('svg', '')
    import re
    text_match = re.search(r'>([^<]+)</text>', svg)
    label = text_match.group(1) if text_match else ''
    print(f"  label='{label}' x={dr['x']} y={dr['y']}")
