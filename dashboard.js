// ==========================================
// GLOBAL STATE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    populateTopologies();
    fetchTopology();
    setupControls();
    setupScrollZoom();
    // After a brief delay let the base topology render, then overlay manual config
    setTimeout(loadManualConfig, 600);
});

let defaultViewBox = "";
let currentViewBox = { minX: 0, minY: 0, width: 600, height: 600 };

// Node positions (id -> {x, y}) — mutable for drag
let nodePositions = {};
// Stores all node metadata
let nodeRegistry = {};

// Parsed GNS3 links + custom added links
let allLinks = [];
let customLinks = [];
let customLinkCounter = 0;

// Spotlight: locked = click-locked, hover-only otherwise
let lockedNodeId = null;

// Drag state
let dragState = null; // { nodeId, startSVGx, startSVGy, origX, origY, hasMoved }

// Connect mode
let connectMode = false;
let connectPendingNode = null;

// ==========================================
// DATA FETCHING & PARSING
// ==========================================
async function fetchTopology() {
    try {
        const response = await fetch('topology/KOTHANT.gns3');
        if (!response.ok) throw new Error('Failed to load topology file');
        const data = await response.json();
        parseAndRender(data);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('global-status').innerHTML =
            '<span class="status-text" style="color:var(--accent-red)">Error loading topology</span>';
    }
}

function parseAndRender(data) {
    const rawNodes = data.topology.nodes || [];
    const rawLinks = data.topology.links || [];
    const drawings = data.topology.drawings || [];

    let pcs = [], routers = [];
    const nodeMap = {};

    rawNodes.sort((a, b) => {
        const an = parseInt(a.name.replace(/\D/g, '') || 0);
        const bn = parseInt(b.name.replace(/\D/g, '') || 0);
        return an - bn;
    });

    for (const node of rawNodes) {
        const isPC = node.name.startsWith('PC') || node.node_type === 'vpcs';
        const device = {
            id: node.node_id, name: node.name, status: 'SUCCESS',
            type: isPC ? 'PC' : 'Router',
            x: node.x, y: node.y,
            properties: node.properties || {}
        };
        nodeMap[node.node_id] = device;
        nodeRegistry[node.node_id] = device;
        // store original GNS3 coords so Reset Default can fully restore them
        device.origX = node.x;
        device.origY = node.y;
        nodePositions[node.node_id] = { x: node.x, y: node.y };
        if (isPC) pcs.push(device); else routers.push(device);
    }

    allLinks = [];
    for (const link of rawLinks) {
        const n1 = link.nodes[0], n2 = link.nodes[1];
        const src = nodeMap[n1.node_id], tgt = nodeMap[n2.node_id];
        if (src && tgt) {
            allLinks.push({
                id: link.link_id, source: src, target: tgt,
                sourcePort: n1.label?.text || '', targetPort: n2.label?.text || '',
                status: 'SUCCESS', custom: false
            });
        }
    }

    const pings = [
        { source: 'R1', dest: '192.168.20.10', status: 'SUCCESS', metrics: '32/252/916' },
        { source: 'R1', dest: '192.168.30.10', status: 'SUCCESS', metrics: '36/198/808' },
        { source: 'R1', dest: '192.168.40.10', status: 'SUCCESS', metrics: '32/141/564' },
        { source: 'R1', dest: '192.168.50.10', status: 'SUCCESS', metrics: '36/227/836' },
        { source: 'R2', dest: '192.168.50.10', status: 'SUCCESS', metrics: '76/120/216' },
        { source: 'R4', dest: '192.168.50.10', status: 'SUCCESS', metrics: '80/127/256' },
        { source: 'R8', dest: '192.168.50.10', status: 'SUCCESS', metrics: '88/156/280' },
        { source: 'R8', dest: '192.168.10.10', status: 'SUCCESS', metrics: '60/216/772' }
    ];

    // Cache base render args for Reset Default
    window._baseRenderArgs = { ts: "Topology Synced", pcs, routers, links: allLinks, drawings, pings };
    renderDashboard("Topology Synced", pcs, routers, allLinks, drawings, pings);
}

// ==========================================
// RENDER DASHBOARD UI
// ==========================================
function renderDashboard(ts, pcs, routers, links, drawings, pings) {
    document.getElementById('report-timestamp').innerHTML =
        `<i data-lucide="clock" class="inline-icon"></i> Status: ${ts}`;

    const badge = document.getElementById('global-status');
    badge.innerHTML = '<span class="pulse"></span><span class="status-text">All Systems Operational</span>';
    badge.style.cssText = 'background:rgba(16,185,129,0.1);color:var(--accent-green);border-color:rgba(16,185,129,0.2)';

    document.getElementById('total-pcs').textContent = pcs.length;
    document.getElementById('success-pcs').textContent = `${pcs.filter(p => p.status==='SUCCESS').length} Detected`;
    document.getElementById('total-routers').textContent = routers.length;
    document.getElementById('success-routers').textContent = `${routers.filter(r => r.status==='SUCCESS').length} Detected`;
    document.getElementById('total-pings').textContent = pings.length;
    document.getElementById('success-pings').textContent = `${pings.filter(p => p.status==='SUCCESS').length} Successful`;

    const mkCard = (dev, type) => `
        <div class="device-card" id="card-${dev.id}"
             onmouseenter="onCardHover('${dev.id}')"
             onmouseleave="onCardLeave('${dev.id}')"
             onclick="onCardClick('${dev.id}')">
            <div class="device-icon-wrapper ${type==='PC'?'pc-icon':'router-icon'}">
                <i data-lucide="${type==='PC'?'monitor':'router'}"></i>
            </div>
            <div class="device-details">
                <div class="device-name">${dev.name}</div>
                <div class="device-meta">Coord: (${dev.x}, ${dev.y})</div>
            </div>
            <div class="status-pill ${dev.status==='SUCCESS'?'status-success':'status-fail'}">
                <span class="status-dot-inner"></span>${dev.status}
            </div>
        </div>`;

    document.getElementById('pc-grid').innerHTML =
        pcs.length ? pcs.map(p => mkCard(p,'PC')).join('') : '<div class="loading">No PCs Found...</div>';
    document.getElementById('router-grid').innerHTML =
        routers.length ? routers.map(r => mkCard(r,'Router')).join('') : '<div class="loading">No Routers Found...</div>';

    const mkRow = p => `
        <tr>
            <td class="ping-source"><i data-lucide="arrow-right-left" class="table-icon"></i> ${p.source}</td>
            <td class="ping-dest">${p.dest}</td>
            <td><span class="status-pill ${p.status==='SUCCESS'?'status-success':'status-fail'}">
                <span class="status-dot-inner"></span>${p.status}</span></td>
            <td class="metrics">${p.metrics}</td>
        </tr>`;
    document.getElementById('ping-body').innerHTML =
        pings.length ? pings.map(mkRow).join('') : '<tr><td colspan="4" class="loading">No Ping Data...</td></tr>';

    renderTopologyGraph(pcs.concat(routers), links, drawings);
    lucide.createIcons();
}

// ==========================================
// SVG TOPOLOGY GRAPH
// ==========================================
function renderTopologyGraph(allNodes, links, drawings) {
    const svg = document.getElementById('topology-svg');
    svg.innerHTML = '';
    if (!allNodes.length) {
        svg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="var(--text-secondary)">No Nodes Found</text>';
        return;
    }

    const xs = allNodes.map(n => n.x), ys = allNodes.map(n => n.y);
    const pad = 140;
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    const w = maxX - minX || 600, h = maxY - minY || 600;
    currentViewBox = { minX, minY, width: w, height: h };
    defaultViewBox = `${minX} ${minY} ${w} ${h}`;
    applyViewBox();

    // Invisible backdrop for click-to-deselect
    const backdrop = mkSVG('rect');
    backdrop.setAttribute('x', minX - 9999); backdrop.setAttribute('y', minY - 9999);
    backdrop.setAttribute('width', '99999'); backdrop.setAttribute('height', '99999');
    backdrop.setAttribute('fill', 'transparent');
    backdrop.addEventListener('click', () => { if (!connectMode) unlockSelection(); });
    svg.appendChild(backdrop);

    // Layer groups (order matters: drawings < links < ports < nodes)
    const drawingsGrp = mkSVGGroup('drawings-group', svg);
    const linksGrp    = mkSVGGroup('links-group', svg);
    const portsGrp    = mkSVGGroup('ports-group', svg);
    const nodesGrp    = mkSVGGroup('nodes-group', svg);

    // Region zone labels
    drawings.forEach(dr => {
        const m = (dr.svg||'').match(/>([^<]+)<\/text>/);
        const label = m ? m[1] : '';
        if (!label) return;
        const g = mkSVGGroup('region-tag-group', drawingsGrp);
        g.setAttribute('transform', `translate(${dr.x}, ${dr.y})`);
        const rect = mkSVG('rect');
        rect.setAttribute('x','-10'); rect.setAttribute('y','-18');
        rect.setAttribute('rx','8'); rect.setAttribute('width', `${label.length*7.5+40}`);
        rect.setAttribute('height','32'); rect.setAttribute('class','region-tag-bg');
        const txt = mkSVG('text');
        txt.setAttribute('x','20'); txt.setAttribute('y','3');
        txt.setAttribute('class','region-tag-text'); txt.textContent = label;
        g.appendChild(rect); g.appendChild(txt);
    });

    // Links (GNS3 + custom)
    [...links, ...customLinks].forEach(link => renderLink(link, linksGrp, portsGrp));

    // Nodes
    allNodes.forEach(node => renderNode(node, nodesGrp));
}

function renderLink(link, linksGrp, portsGrp) {
    const pos1 = nodePositions[link.source.id] || link.source;
    const pos2 = nodePositions[link.target.id] || link.target;
    const x1=pos1.x, y1=pos1.y, x2=pos2.x, y2=pos2.y;

    const g = mkSVGGroup('link-connection', linksGrp);
    g.setAttribute('id', `link-${link.id}`);
    g.setAttribute('data-source', link.source.id);
    g.setAttribute('data-target', link.target.id);
    g.setAttribute('data-link-id', link.id);
    if (link.custom) g.classList.add(link.status === 'SUCCESS' ? 'link-custom-success' : 'link-custom-fail');

    g.addEventListener('mouseenter', () => {
        if (lockedNodeId) return;
        showOverlay(`
            <div class="overlay-title"><i data-lucide="cable" class="overlay-icon"></i> Link</div>
            <div class="overlay-content">
                <strong>From:</strong> ${link.source.name} <span class="port-badge">${link.sourcePort||'—'}</span><br/>
                <strong>To:</strong> ${link.target.name} <span class="port-badge">${link.targetPort||'—'}</span><br/>
                <strong>Status:</strong>
                <span style="color:${link.status==='SUCCESS'?'var(--accent-green)':'var(--accent-red)'}">
                    ${link.status==='SUCCESS'?'✓ Active':'✗ Failed'}
                </span>
            </div>`);
        applyLinkHighlight(link.id, link.source.id, link.target.id);
    });
    g.addEventListener('mouseleave', () => { if (!lockedNodeId) clearHighlightState(); });

    const bg   = linkLine(x1,y1,x2,y2,'link-line-bg');
    const core = linkLine(x1,y1,x2,y2,'link-line-core'+(link.custom?(link.status==='SUCCESS'?' custom-success':' custom-fail'):''));
    const flow = linkLine(x1,y1,x2,y2,'link-line-flow');
    g.appendChild(bg); g.appendChild(core); g.appendChild(flow);

    // Port labels
    if (portsGrp) {
        const dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy);
        if (len > 50) {
            const r = 42/len;
            if (link.sourcePort) {
                const lbl = portLabel(x1+dx*r, y1+dy*r+4, link.sourcePort, link.id);
                portsGrp.appendChild(lbl);
            }
            if (link.targetPort) {
                const lbl = portLabel(x2-dx*r, y2-dy*r+4, link.targetPort, link.id);
                portsGrp.appendChild(lbl);
            }
        }
    }
}

function renderNode(node, nodesGrp) {
    const isPC = node.type === 'PC';
    const pos = nodePositions[node.id] || {x:node.x, y:node.y};
    const g = mkSVGGroup(`node-group ${isPC?'pc-node':'router-node'}`, nodesGrp);
    g.setAttribute('id', `node-${node.id}`);
    g.setAttribute('data-node-id', node.id);
    g.setAttribute('data-node-name', node.name);
    g.setAttribute('data-node-type', node.type);
    g.setAttribute('transform', `translate(${pos.x},${pos.y})`);

    // --- Hover (only if nothing is locked) ---
    g.addEventListener('mouseenter', () => {
        if (lockedNodeId && lockedNodeId !== node.id) return;
        updateNodeOverlay(node, isPC);
        if (!lockedNodeId) applyNodeHighlight(node.id);
    });
    g.addEventListener('mouseleave', () => {
        if (!lockedNodeId) clearHighlightState();
    });

    // --- Click: lock/unlock or connect ---
    g.addEventListener('click', e => {
        e.stopPropagation();
        if (dragState?.hasMoved) return; // ignore click after drag

        if (connectMode) {
            handleConnectClick(node);
            return;
        }
        if (lockedNodeId === node.id) unlockSelection();
        else lockSelection(node.id, node, isPC);
    });

    // --- Drag start ---
    g.addEventListener('mousedown', e => {
        if (e.button !== 0 || connectMode) return;
        e.stopPropagation();
        const pt = svgPoint(e);
        dragState = {
            nodeId: node.id, node,
            startSVGx: pt.x, startSVGy: pt.y,
            origX: nodePositions[node.id].x,
            origY: nodePositions[node.id].y,
            hasMoved: false
        };
        g.classList.add('dragging');
    });

    // Visual layers
    const pulse  = mkSVGElem('circle', {r:30, class:'node-pulse'});
    const base   = mkSVGElem('circle', {r:22, class:'node-circle-base'});
    const glow   = mkSVGElem('circle', {r:22, class:'node-circle-glow'});
    const fo = mkSVG('foreignObject');
    fo.setAttribute('x','-12'); fo.setAttribute('y','-12');
    fo.setAttribute('width','24'); fo.setAttribute('height','24');
    fo.innerHTML = `<div class="node-icon-inner ${isPC?'pc':'router'}"><i data-lucide="${isPC?'monitor':'router'}"></i></div>`;
    const label  = mkSVGElem('text', {y:38, class:'node-label-text', 'text-anchor':'middle'});
    label.textContent = node.name;
    const beacon = mkSVGElem('circle', {r:5.5, cx:16, cy:-16, class:'node-status-badge'});

    g.appendChild(pulse); g.appendChild(base); g.appendChild(glow);
    g.appendChild(fo);    g.appendChild(label); g.appendChild(beacon);
}

// ==========================================
// SVG HELPERS
// ==========================================
function mkSVG(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }
function mkSVGGroup(cls, parent) {
    const g = mkSVG('g'); g.setAttribute('class', cls);
    if (parent) parent.appendChild(g);
    return g;
}
function mkSVGElem(tag, attrs) {
    const el = mkSVG(tag);
    for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}
function linkLine(x1,y1,x2,y2,cls) {
    return mkSVGElem('line', {x1,y1,x2,y2,class:cls});
}
function portLabel(x, y, text, linkId) {
    const t = mkSVGElem('text', {x, y, class:'port-label', 'text-anchor':'middle', 'data-link-port': linkId});
    t.textContent = text;
    return t;
}
function svgPoint(e) {
    const svg = document.getElementById('topology-svg');
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}
function applyViewBox() {
    const { minX, minY, width, height } = currentViewBox;
    const svg = document.getElementById('topology-svg');
    if (svg) svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
}

// ==========================================
// DRAG AND DROP
// ==========================================
document.addEventListener('mousemove', e => {
    if (!dragState) return;
    const pt = svgPoint(e);
    const dx = pt.x - dragState.startSVGx;
    const dy = pt.y - dragState.startSVGy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.hasMoved = true;
    if (!dragState.hasMoved) return;

    const newX = dragState.origX + dx;
    const newY = dragState.origY + dy;
    nodePositions[dragState.nodeId] = { x: newX, y: newY };

    // Move node SVG element
    const nodeEl = document.getElementById(`node-${dragState.nodeId}`);
    if (nodeEl) nodeEl.setAttribute('transform', `translate(${newX},${newY})`);

    // Update every connected link's lines and port labels
    document.querySelectorAll('.link-connection').forEach(linkEl => {
        const src = linkEl.getAttribute('data-source');
        const tgt = linkEl.getAttribute('data-target');
        const lid = linkEl.getAttribute('data-link-id');
        if (src !== dragState.nodeId && tgt !== dragState.nodeId) return;

        const p1 = nodePositions[src], p2 = nodePositions[tgt];
        if (!p1 || !p2) return;

        linkEl.querySelectorAll('line').forEach(l => {
            l.setAttribute('x1',p1.x); l.setAttribute('y1',p1.y);
            l.setAttribute('x2',p2.x); l.setAttribute('y2',p2.y);
        });

        // Update port label positions
        const dx2=p2.x-p1.x, dy2=p2.y-p1.y, len=Math.hypot(dx2,dy2);
        const lbls = document.querySelectorAll(`[data-link-port="${lid}"]`);
        if (len > 50 && lbls.length >= 1) {
            const r = 42/len;
            if (lbls[0]) { lbls[0].setAttribute('x', p1.x+dx2*r); lbls[0].setAttribute('y', p1.y+dy2*r+4); }
            if (lbls[1]) { lbls[1].setAttribute('x', p2.x-dx2*r); lbls[1].setAttribute('y', p2.y-dy2*r+4); }
        }
    });

    // Update overlay if this node is locked
    if (lockedNodeId === dragState.nodeId) {
        updateNodeOverlay({...dragState.node, x: Math.round(newX), y: Math.round(newY)}, dragState.node.type==='PC');
    }
});

document.addEventListener('mouseup', () => {
    if (dragState) {
        const nodeEl = document.getElementById(`node-${dragState.nodeId}`);
        if (nodeEl) nodeEl.classList.remove('dragging');

        if (dragState.hasMoved) {
            const pos = nodePositions[dragState.nodeId];
            // Persist new coords back into node registry and link references
            if (nodeRegistry[dragState.nodeId]) {
                nodeRegistry[dragState.nodeId].x = pos.x;
                nodeRegistry[dragState.nodeId].y = pos.y;
            }
            [...allLinks, ...customLinks].forEach(link => {
                if (link.source.id === dragState.nodeId) { link.source.x = pos.x; link.source.y = pos.y; }
                if (link.target.id === dragState.nodeId) { link.target.x = pos.x; link.target.y = pos.y; }
            });
        }
        dragState = null;
    }
});

// ==========================================
// SPOTLIGHT / LOCK SELECTION
// ==========================================
function lockSelection(nodeId, node, isPC) {
    lockedNodeId = nodeId;
    updateNodeOverlay(node, isPC);
    applyNodeHighlight(nodeId);
    document.getElementById('topology-overlay').classList.add('locked');
}
function unlockSelection() {
    lockedNodeId = null;
    clearHighlightState();
    document.getElementById('topology-overlay').classList.remove('locked');
    document.getElementById('topology-overlay').innerHTML = 'Click or hover devices &amp; links to inspect';
}

function applyNodeHighlight(nodeId) {
    const svg = document.getElementById('topology-svg');
    svg.classList.add('spotlight-active');
    const n = document.getElementById(`node-${nodeId}`);
    if (n) n.classList.add('spotlight-focus');
    document.querySelectorAll('.link-connection').forEach(l => {
        const s = l.getAttribute('data-source'), t = l.getAttribute('data-target');
        if (s===nodeId || t===nodeId) {
            l.classList.add('spotlight-focus');
            const cid = s===nodeId ? t : s;
            const cn = document.getElementById(`node-${cid}`);
            if (cn) cn.classList.add('spotlight-focus');
        }
    });
}
function applyLinkHighlight(linkId, src, tgt) {
    document.getElementById('topology-svg')?.classList.add('spotlight-active');
    document.getElementById(`link-${linkId}`)?.classList.add('spotlight-focus');
    document.getElementById(`node-${src}`)?.classList.add('spotlight-focus');
    document.getElementById(`node-${tgt}`)?.classList.add('spotlight-focus');
}
function clearHighlightState() {
    document.querySelectorAll('.device-card').forEach(c => c.classList.remove('focused'));
    document.getElementById('topology-svg')?.classList.remove('spotlight-active');
    document.querySelectorAll('.node-group').forEach(n => n.classList.remove('spotlight-focus'));
    document.querySelectorAll('.link-connection').forEach(l => l.classList.remove('spotlight-focus'));
}

// ==========================================
// CARD HOVER/CLICK SYNC
// ==========================================
function onCardHover(nodeId) {
    if (lockedNodeId) return;
    applyNodeHighlight(nodeId);
    document.getElementById(`card-${nodeId}`)?.classList.add('focused');
}
function onCardLeave(nodeId) {
    if (lockedNodeId) return;
    clearHighlightState();
}
function onCardClick(nodeId) {
    if (lockedNodeId === nodeId) { unlockSelection(); return; }
    const node = nodeRegistry[nodeId];
    if (node) lockSelection(nodeId, node, node.type==='PC');
    document.getElementById(`card-${nodeId}`)?.classList.add('focused');
}

// ==========================================
// OVERLAY HUD
// ==========================================
function showOverlay(html) {
    const ov = document.getElementById('topology-overlay');
    ov.innerHTML = html;
    lucide.createIcons({ nodes: [ov] });
}
function updateNodeOverlay(node, isPC) {
    const pos = nodePositions[node.id] || node;
    const isLocked = lockedNodeId === node.id;
    showOverlay(`
        <div class="overlay-title">
            <i data-lucide="${isPC?'monitor':'router'}" class="overlay-icon"></i>
            ${node.name}
            ${isLocked ? '<span class="overlay-lock-badge"><i data-lucide="lock"></i> Locked</span>' : ''}
        </div>
        <div class="overlay-content">
            <strong>Type:</strong> ${isPC?'Virtual PC (vpcs)':'Router (dynamips)'}<br/>
            <strong>Position:</strong> X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}<br/>
            <strong>Platform:</strong> ${node.properties?.platform||'N/A'}<br/>
            <strong>Status:</strong> <span style="color:var(--accent-green)">Configured & Synced</span>
        </div>`);
    document.querySelectorAll('.device-card').forEach(c => c.classList.remove('focused'));
    document.getElementById(`card-${node.id}`)?.classList.add('focused');
}

// ==========================================
// CONNECT MODE (ROPE EDITOR)
// ==========================================
function toggleConnectMode() {
    connectMode = !connectMode;
    connectPendingNode = null;
    const btn = document.getElementById('btn-connect');
    const banner = document.getElementById('connect-banner');
    const svg = document.getElementById('topology-svg');

    // Remove lingering preview line
    document.getElementById('connect-preview-line')?.remove();
    svg.removeEventListener('mousemove', updatePreviewLine);

    if (connectMode) {
        btn.classList.add('active', 'connect-active');
        btn.innerHTML = '<i data-lucide="x-circle"></i> Cancel';
        banner.classList.add('visible');
        banner.textContent = '🔗 Connect Mode — Click SOURCE device';
        svg.classList.add('connect-mode-canvas');
        unlockSelection();
    } else {
        btn.classList.remove('active', 'connect-active');
        btn.innerHTML = '<i data-lucide="cable"></i> Connect';
        banner.classList.remove('visible', 'source-selected');
        svg.classList.remove('connect-mode-canvas');
        document.querySelectorAll('.connect-source-node').forEach(el => el.classList.remove('connect-source-node'));
        clearHighlightState();
    }
    lucide.createIcons({ nodes: [btn] });
}

function handleConnectClick(node) {
    const banner = document.getElementById('connect-banner');
    if (!connectPendingNode) {
        // First node — source
        connectPendingNode = node;
        banner.textContent = `🔗 Source: ${node.name} — Now click TARGET device`;
        banner.classList.add('source-selected');
        const svg = document.getElementById('topology-svg');
        svg.classList.add('spotlight-active');
        const nodeEl = document.getElementById(`node-${node.id}`);
        nodeEl?.classList.add('spotlight-focus','connect-source-node');
        drawPreviewLine(node);
    } else {
        // Second node — target
        if (connectPendingNode.id === node.id) {
            flashBanner(banner, '⚠️ Cannot connect a device to itself!');
            return;
        }
        const exists = [...allLinks,...customLinks].some(l =>
            (l.source.id===connectPendingNode.id && l.target.id===node.id) ||
            (l.source.id===node.id && l.target.id===connectPendingNode.id));
        if (exists) {
            flashBanner(banner, '⚠️ A link between these devices already exists!');
            return;
        }
        createNewConnection(connectPendingNode, node);
    }
}

function flashBanner(banner, msg) {
    const prev = banner.textContent;
    banner.textContent = msg;
    banner.classList.add('flash-warn');
    setTimeout(() => { banner.textContent = prev; banner.classList.remove('flash-warn'); }, 2000);
}

function drawPreviewLine(sourceNode) {
    const svg = document.getElementById('topology-svg');
    const pos = nodePositions[sourceNode.id];
    const preview = mkSVGElem('line', {
        id:'connect-preview-line', class:'preview-link-line',
        x1:pos.x, y1:pos.y, x2:pos.x, y2:pos.y
    });
    svg.appendChild(preview);
    svg.addEventListener('mousemove', updatePreviewLine);
}
function updatePreviewLine(e) {
    const preview = document.getElementById('connect-preview-line');
    if (!preview) return;
    const pt = svgPoint(e);
    preview.setAttribute('x2', pt.x);
    preview.setAttribute('y2', pt.y);
}

function createNewConnection(srcNode, tgtNode) {
    // PC↔PC = FAIL (no layer-3 routing); anything else = SUCCESS
    const bothPC = srcNode.type==='PC' && tgtNode.type==='PC';
    const status = bothPC ? 'FAIL' : 'SUCCESS';
    const id = `custom-${++customLinkCounter}`;

    const newLink = {
        id, source: {...srcNode}, target: {...tgtNode},
        sourcePort: 'eth0', targetPort: 'eth0',
        status, custom: true
    };
    customLinks.push(newLink);

    // Draw new rope on SVG
    const linksGrp = document.querySelector('.links-group');
    const portsGrp = document.querySelector('.ports-group');
    if (linksGrp) renderLink(newLink, linksGrp, portsGrp);

    // Cleanup preview
    document.getElementById('connect-preview-line')?.remove();
    document.getElementById('topology-svg').removeEventListener('mousemove', updatePreviewLine);
    document.querySelectorAll('.connect-source-node').forEach(el => el.classList.remove('connect-source-node'));
    clearHighlightState();

    // Toast notification
    if (status === 'SUCCESS') {
        showToast('success', 'Connection Established!',
            `${srcNode.name} ↔ ${tgtNode.name} linked. Ping: 12/35/64 ms`);
    } else {
        showToast('fail', 'Ping Test Failed',
            `${srcNode.name} ↔ ${tgtNode.name}: PC-to-PC direct link has no IP routing. Configure static routes or add a router.`);
    }

    addPingRow(srcNode.name, tgtNode.name, status);
    toggleConnectMode();
}

function addPingRow(source, dest, status) {
    const tbody = document.getElementById('ping-body');
    if (!tbody) return;
    const metrics = status==='SUCCESS' ? '12/35/64' : '—/—/—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="ping-source"><i data-lucide="arrow-right-left" class="table-icon"></i> ${source}</td>
        <td class="ping-dest">${dest}</td>
        <td><span class="status-pill ${status==='SUCCESS'?'status-success':'status-fail'}">
            <span class="status-dot-inner"></span>${status}</span></td>
        <td class="metrics">${metrics}</td>`;
    tr.classList.add('new-row-highlight');
    tbody.appendChild(tr);
    lucide.createIcons({ nodes:[tr] });
    setTimeout(() => tr.classList.remove('new-row-highlight'), 2500);

    const tp = document.getElementById('total-pings');
    const sp = document.getElementById('success-pings');
    if (tp) tp.textContent = parseInt(tp.textContent) + 1;
    if (sp && status==='SUCCESS') {
        const cur = parseInt(sp.textContent);
        sp.textContent = `${cur+1} Successful`;
    }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(type, title, message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon-wrap">
            <i data-lucide="${type==='success'?'check-circle':'alert-circle'}"></i>
        </div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${message}</div>
        </div>
        <button class="toast-close" onclick="this.closest('.toast').remove()">
            <i data-lucide="x"></i>
        </button>`;
    container.appendChild(toast);
    lucide.createIcons({ nodes:[toast] });
    // Progress bar
    const bar = document.createElement('div');
    bar.className = 'toast-progress';
    toast.appendChild(bar);
    setTimeout(() => { toast.classList.add('toast-hide'); setTimeout(() => toast.remove(), 400); }, 5000);
}

// ==========================================
// ZOOM CONTROLS
// ==========================================
function zoomIn() {
    const f = 0.78;
    const cx = currentViewBox.minX + currentViewBox.width/2;
    const cy = currentViewBox.minY + currentViewBox.height/2;
    currentViewBox.width *= f; currentViewBox.height *= f;
    currentViewBox.minX = cx - currentViewBox.width/2;
    currentViewBox.minY = cy - currentViewBox.height/2;
    applyViewBox();
}
function zoomOut() {
    const f = 1.28;
    const cx = currentViewBox.minX + currentViewBox.width/2;
    const cy = currentViewBox.minY + currentViewBox.height/2;
    currentViewBox.width *= f; currentViewBox.height *= f;
    currentViewBox.minX = cx - currentViewBox.width/2;
    currentViewBox.minY = cy - currentViewBox.height/2;
    applyViewBox();
}
function setupScrollZoom() {
    const canvas = document.getElementById('canvas-container');
    if (!canvas) return;
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn(); else zoomOut();
    }, { passive: false });
}

// ==========================================
// CONTROL BUTTONS
// ==========================================
function setupControls() {
    document.getElementById('btn-reset-view')?.addEventListener('click', () => {
        if (!defaultViewBox) return;
        const [mx, my, w, h] = defaultViewBox.split(' ').map(Number);
        currentViewBox = { minX:mx, minY:my, width:w, height:h };
        applyViewBox();
    });
    document.getElementById('btn-zoom-in')?.addEventListener('click', zoomIn);
    document.getElementById('btn-zoom-out')?.addEventListener('click', zoomOut);
    document.getElementById('btn-connect')?.addEventListener('click', toggleConnectMode);

    document.getElementById('btn-labels')?.addEventListener('click', e => {
        const btn = e.currentTarget; btn.classList.toggle('active');
        const pg = document.querySelector('.ports-group');
        if (pg) pg.style.display = btn.classList.contains('active') ? '' : 'none';
    });
    document.getElementById('btn-regions')?.addEventListener('click', e => {
        const btn = e.currentTarget; btn.classList.toggle('active');
        const dg = document.querySelector('.drawings-group');
        if (dg) dg.style.display = btn.classList.contains('active') ? '' : 'none';
    });

    document.getElementById('btn-save')?.addEventListener('click', saveConfig);
    document.getElementById('btn-restore')?.addEventListener('click', restoreDefault);
    
    // AI Upload
    const fileInput = document.getElementById('file-upload');
    document.getElementById('btn-upload')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) scanImage(file);
        e.target.value = ''; // reset
    });

    // Topology Selector
    document.getElementById('topology-selector')?.addEventListener('change', async (e) => {
        const file = e.target.value;
        if (!file) return;
        try {
            const res = await fetch(`topology/${file}?t=${Date.now()}`);
            if (!res.ok) throw new Error(`Could not load ${file}`);
            const data = await res.json();
            
            // Wipe manual state
            customLinks.length = 0;
            customLinkCounter = 0;
            nodeRegistry = {};
            nodePositions = {};
            
            parseAndRender(data);
            showToast('success', 'Topology Loaded', `Loaded ${file}`);
        } catch (err) {
            showToast('fail', 'Load Error', err.message);
        }
    });

    // Download active .gns3
    document.getElementById('btn-download-gns3')?.addEventListener('click', () => {
        const sel = document.getElementById('topology-selector');
        const file = sel ? sel.value : 'KOTHANT.gns3';
        if (!file) return;
        
        const a = document.createElement('a');
        a.href = `topology/${file}`;
        a.download = file;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('success', 'Download Started', `Downloading ${file}`);
    });
}

// ==========================================
// TOPOLOGY SELECTOR
// ==========================================
async function populateTopologies(autoSelect = null) {
    try {
        const res = await fetch('/api/topologies');
        const json = await res.json();
        if (!json.ok) return;
        
        const sel = document.getElementById('topology-selector');
        if (!sel) return;
        sel.innerHTML = '';
        
        json.files.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f; opt.textContent = f;
            sel.appendChild(opt);
        });
        
        if (autoSelect) sel.value = autoSelect;
    } catch(err) {
        console.error('Failed to load topologies list', err);
    }
}

// ==========================================
// AI IMAGE SCANNING
// ==========================================
function setAiStep(stepNum, state, text) {
    const el = document.getElementById(`ai-step-${stepNum}`);
    if (!el) return;
    el.className = state;
    const icon = el.querySelector('.step-icon');
    const txt = el.querySelector('span:last-child');
    if (text) txt.textContent = text;
    
    if (state === 'active') icon.textContent = '🔄';
    else if (state === 'success') icon.textContent = '✅';
    else if (state === 'error') icon.textContent = '❌';
    else icon.textContent = '⏳';
}

async function scanImage(file) {
    if (file.size > 10 * 1024 * 1024) {
        showToast('fail', 'File too large', 'Max image size is 10MB.');
        return;
    }
    
    // Open Modal
    const modal = document.getElementById('ai-modal');
    modal.style.display = 'flex';
    setAiStep(1, 'active', 'Step 1: Scanning Image with Gemini AI...');
    setAiStep(2, '', 'Step 2: Generating & Loading .gns3');
    setAiStep(3, '', 'Step 3: Setup Success');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await fetch('/api/scan-image', {
            method: 'POST',
            body: formData
        });
        const json = await res.json();
        
        if (json.ok) {
            setAiStep(1, 'success', 'Step 1: Scanned Successfully');
            setAiStep(2, 'active', 'Step 2: Generating & Loading scanned.gns3...');
            
            // Load the new scanned topology
            const topoRes = await fetch(json.file + '?t=' + Date.now()); // cache bust
            if (!topoRes.ok) throw new Error('Failed to load scanned.gns3');
            
            const data = await topoRes.json();
            
            // Wipe manual state
            customLinks.length = 0;
            customLinkCounter = 0;
            nodeRegistry = {};
            nodePositions = {};
            
            setAiStep(2, 'success', 'Step 2: .gns3 Loaded');
            setAiStep(3, 'active', 'Step 3: Rendering Topology...');
            
            parseAndRender(data);
            
            setAiStep(3, 'success', 'Step 3: Setup Success!');
            
            // Refresh dropdown
            await populateTopologies('scanned.gns3');
            
            setTimeout(() => { modal.style.display = 'none'; }, 2000);
            
        } else {
            setAiStep(1, 'error', `Step 1 Failed: ${json.error}`);
            setTimeout(() => { modal.style.display = 'none'; }, 3000);
        }
    } catch (err) {
        setAiStep(1, 'error', `Step 1 Failed: ${err.message}`);
        setTimeout(() => { modal.style.display = 'none'; }, 3000);
    }
}

// ==========================================
// SAVE / LOAD / RESTORE MANUAL CONFIG
// ==========================================

/**
 * Serialise current manual state → POST to server → writes topology/manual.gns3
 */
async function saveConfig() {
    const payload = {
        version: 1,
        saved_at: new Date().toISOString(),
        source_topology: 'topology/KOTHANT.gns3',
        // Dragged node positions (all nodes, not just moved ones)
        node_positions: { ...nodePositions },
        // Only custom-added links
        custom_links: customLinks.map(l => ({
            id:           l.id,
            source_id:    l.source.id,
            source_name:  l.source.name,
            source_type:  l.source.type,
            target_id:    l.target.id,
            target_name:  l.target.name,
            target_type:  l.target.type,
            source_port:  l.sourcePort,
            target_port:  l.targetPort,
            status:       l.status
        }))
    };

    try {
        showSaveStatus('saving');
        const res = await fetch('/api/save-manual', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.ok) {
            showSaveStatus('saved', `Saved ${customLinks.length} custom link(s) → topology/manual.gns3`);
            showToast('success', 'Config Saved',
                `topology/manual.gns3 written with ${customLinks.length} manual link(s) and ${Object.keys(nodePositions).length} node positions.`);
        } else {
            showSaveStatus('error', json.error);
            showToast('fail', 'Save Failed', json.error);
        }
    } catch (err) {
        showSaveStatus('error', err.message);
        showToast('fail', 'Save Failed', err.message);
    }
}

/**
 * Remove manual.gns3 from server and re-render the base KOTHANT topology.
 */
async function restoreDefault() {
    if (!confirm('Reset to KOTHANT.gns3 default?\nThis will clear all manual connections and dragged positions.')) return;
    try {
        await fetch('/api/delete-manual', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    } catch (_) { /* server may not have the file */ }

    // Wipe manual state
    customLinks.length = 0;
    customLinkCounter = 0;

    // Restore node positions from nodeRegistry (original GNS3 coords)
    for (const [id, node] of Object.entries(nodeRegistry)) {
        nodePositions[id] = { x: node.origX ?? node.x, y: node.origY ?? node.y };
    }

    // Full re-render from stored base data
    if (window._baseRenderArgs) {
        const { ts, pcs, routers, links, drawings, pings } = window._baseRenderArgs;
        renderDashboard(ts, pcs, routers, links, drawings, pings);
        lucide.createIcons();
    } else {
        fetchTopology(); // fallback: re-fetch
    }

    showSaveStatus('restored', 'Restored to KOTHANT.gns3 default');
    showToast('success', 'Restored Default', 'All manual connections cleared. Loaded original KOTHANT.gns3 topology.');
}

/**
 * On startup — try to fetch topology/manual.gns3.
 * If it exists: restore saved node positions and custom links on top of the base topology.
 */
async function loadManualConfig() {
    try {
        const res = await fetch('topology/manual.gns3');
        if (!res.ok) return; // file doesn't exist yet — that's fine
        const manual = await res.json();

        let restoredLinks = 0;
        let restoredPositions = 0;

        // 1. Restore node positions
        if (manual.node_positions) {
            for (const [id, pos] of Object.entries(manual.node_positions)) {
                if (nodePositions[id]) {
                    nodePositions[id] = { x: pos.x, y: pos.y };
                    const nodeEl = document.getElementById(`node-${id}`);
                    if (nodeEl) nodeEl.setAttribute('transform', `translate(${pos.x},${pos.y})`);
                    restoredPositions++;
                }
            }
            // Update connected links after restoring all positions
            document.querySelectorAll('.link-connection').forEach(linkEl => {
                const src = linkEl.getAttribute('data-source');
                const tgt = linkEl.getAttribute('data-target');
                const lid = linkEl.getAttribute('data-link-id');
                const p1 = nodePositions[src], p2 = nodePositions[tgt];
                if (!p1 || !p2) return;
                linkEl.querySelectorAll('line').forEach(l => {
                    l.setAttribute('x1',p1.x); l.setAttribute('y1',p1.y);
                    l.setAttribute('x2',p2.x); l.setAttribute('y2',p2.y);
                });
                const dx=p2.x-p1.x, dy=p2.y-p1.y, len=Math.hypot(dx,dy);
                const lbls = document.querySelectorAll(`[data-link-port="${lid}"]`);
                if (len > 50) {
                    const r = 42/len;
                    if (lbls[0]) { lbls[0].setAttribute('x',p1.x+dx*r); lbls[0].setAttribute('y',p1.y+dy*r+4); }
                    if (lbls[1]) { lbls[1].setAttribute('x',p2.x-dx*r); lbls[1].setAttribute('y',p2.y-dy*r+4); }
                }
            });
        }

        // 2. Restore custom links
        if (manual.custom_links && manual.custom_links.length > 0) {
            const linksGrp = document.querySelector('.links-group');
            const portsGrp = document.querySelector('.ports-group');

            for (const saved of manual.custom_links) {
                const srcNode = nodeRegistry[saved.source_id];
                const tgtNode = nodeRegistry[saved.target_id];
                if (!srcNode || !tgtNode) continue;

                const link = {
                    id:         saved.id || `custom-${++customLinkCounter}`,
                    source:     { ...srcNode },
                    target:     { ...tgtNode },
                    sourcePort: saved.source_port || 'eth0',
                    targetPort: saved.target_port || 'eth0',
                    status:     saved.status || 'SUCCESS',
                    custom:     true
                };
                customLinks.push(link);
                if (linksGrp) renderLink(link, linksGrp, portsGrp);
                restoredLinks++;
            }
            // Re-render Lucide icons for any new foreignObjects
            lucide.createIcons();
        }

        if (restoredLinks > 0 || restoredPositions > 0) {
            showSaveStatus('loaded',
                `Loaded manual.gns3 — ${restoredLinks} custom link(s), ${restoredPositions} positions restored`);
            showToast('success', 'Manual Config Loaded',
                `Restored from topology/manual.gns3: ${restoredLinks} manual link(s).`);
        }
    } catch (err) {
        // manual.gns3 missing or malformed — silently ignore
        console.info('No manual.gns3 found (that is okay):', err.message);
    }
}

/**
 * Show a small status badge next to the save button.
 */
function showSaveStatus(type, message) {
    const badge = document.getElementById('save-status');
    if (!badge) return;
    badge.style.display = 'inline-flex';
    badge.className = `save-status-badge save-status-${type}`;
    badge.textContent = message || type;
    if (type === 'saved' || type === 'loaded' || type === 'restored') {
        setTimeout(() => { badge.style.display = 'none'; }, 5000);
    }
}
