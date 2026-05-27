// ==========================================
// GLOBAL STATE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    populateTopologies();
    fetchTopology();
    setupControls();
    setupScrollZoom();
    initChatbot();
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

// Helper to generate a predictable IP from a device name
function getIP(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return `192.168.${Math.abs(hash % 255)}.${Math.abs((hash >> 8) % 254) + 1}`;
}

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

    // Generate dynamic ping tests based on links
    const pings = allLinks.map((lk, i) => {
        const srcName = lk.source?.name || 'Unknown';
        const tgtName = lk.target?.name || 'Unknown';
        const tgtIP   = getIP(tgtName);
        const msBase  = 20 + Math.floor(Math.random() * 50);
        return {
            source: srcName,
            dest: `${tgtIP} (${tgtName})`,
            status: 'SUCCESS',
            metrics: `${msBase}/${msBase + 20}/${msBase + 80}`
        };
    });

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
        banner.innerHTML = '<i data-lucide="cable" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i> Connect Mode — Click SOURCE device';
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
        banner.innerHTML = `<i data-lucide="cable" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i> Source: <strong>${node.name}</strong> — Now click TARGET device`;
        banner.classList.add('source-selected');
        lucide.createIcons({ nodes: [banner] });
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
    const prevHTML = banner.innerHTML;
    banner.innerHTML = `<i data-lucide="alert-triangle" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i> ${msg}`;
    lucide.createIcons({ nodes: [banner] });
    banner.classList.add('flash-warn');
    setTimeout(() => { banner.innerHTML = prevHTML; lucide.createIcons({ nodes: [banner] }); banner.classList.remove('flash-warn'); }, 2000);
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

    // Use Lucide icon names instead of emoji
    const iconMap = {
        '':        'clock',
        'active':  'loader',
        'success': 'check-circle',
        'error':   'x-circle',
    };
    icon.innerHTML = `<i data-lucide="${iconMap[state] || 'clock'}"></i>`;
    lucide.createIcons({ nodes: [icon] });
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

// ==========================================
// CHATBOT FLOATING WIDGET
// ==========================================

let chatHistoryData = [];   // all messages
let chatThinkingEl  = null;
let chatBusy        = false;
let currentGns3     = null; // last generated/loaded .gns3 data for text modifications
let chatOpen        = false;

function initChatbot() {
    const fab        = document.getElementById('chatbot-fab');
    const closeBtn   = document.getElementById('chatbot-close');
    const attachBtn  = document.getElementById('btn-chat-attach');
    const fileInput  = document.getElementById('chat-file-input');
    const sendBtn    = document.getElementById('btn-chat-send');
    const textInput  = document.getElementById('chat-text-input');
    const clearBtn   = document.getElementById('btn-clear-chat');

    fab?.addEventListener('click',      toggleChatbot);
    closeBtn?.addEventListener('click', toggleChatbot);
    clearBtn?.addEventListener('click', clearChatHistory);

    attachBtn?.addEventListener('click', () => { if (!chatBusy) fileInput?.click(); });
    fileInput?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) handleChatImageUpload(file);
        e.target.value = '';
    });

    sendBtn?.addEventListener('click',  sendTextMessage);
    textInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextMessage(); }
    });

    // Init lucide icons inside widget
    const panel = document.getElementById('chatbot-panel');
    if (panel) lucide.createIcons({ nodes: [panel] });
}

// -- Toggle open / close ------------------
function toggleChatbot() {
    chatOpen = !chatOpen;
    const panel = document.getElementById('chatbot-panel');
    const fab   = document.getElementById('chatbot-fab');
    if (!panel || !fab) return;

    if (chatOpen) {
        panel.classList.add('open');
        fab.classList.add('open');
        fab.innerHTML = '<i data-lucide="x"></i>';
        lucide.createIcons({ nodes: [fab] });
        scrollChatToBottom();
    } else {
        panel.classList.remove('open');
        fab.classList.remove('open');
        fab.innerHTML = '<i data-lucide="bot"></i>';
        lucide.createIcons({ nodes: [fab] });
    }
}

// -- Send chip shortcut -------------------
function sendChip(text) {
    const input = document.getElementById('chat-text-input');
    if (input) { input.value = text; sendTextMessage(); }
}

// -- Status helpers -----------------------
function setChatBusy(busy) {
    chatBusy = busy;
    const attachBtn = document.getElementById('btn-chat-attach');
    const sendBtn   = document.getElementById('btn-chat-send');
    const dot       = document.getElementById('chatbot-status-dot');
    const statusTxt = document.getElementById('chatbot-status-text');
    if (attachBtn) attachBtn.disabled = busy;
    if (sendBtn)   sendBtn.disabled   = busy;
    if (dot) dot.classList.toggle('thinking', busy);
    if (statusTxt) statusTxt.textContent = busy ? 'Processing...' : 'Network Assistant';
}

function scrollChatToBottom() {
    const feed = document.getElementById('chat-feed');
    if (feed) feed.scrollTop = feed.scrollHeight;
}

function chatTimestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// -- Thinking indicator -------------------
function showChatThinking() {
    const feed = document.getElementById('chat-feed');
    if (!feed) return;
    const row = document.createElement('div');
    row.className = 'chat-row bot';
    row.id = 'chat-thinking-row';
    row.innerHTML = `
        <div class="chat-avatar"><i data-lucide="bot"></i></div>
        <div class="chat-thinking">
            <div class="chat-thinking-dots"><span></span><span></span><span></span></div>
            Analyzing...
        </div>`;
    feed.appendChild(row);
    lucide.createIcons({ nodes: [row] });
    chatThinkingEl = row;
    scrollChatToBottom();
}
function hideChatThinking() {
    chatThinkingEl?.remove();
    chatThinkingEl = null;
}

// -- Append bubble ------------------------
function appendChatMessage(role, type, content, gns3Data = null) {
    const feed = document.getElementById('chat-feed');
    if (!feed) return null;

    const row = document.createElement('div');
    row.className = `chat-row ${role}`;

    const avatarIcon = role === 'user' ? 'user' : 'bot';
    const label      = role === 'user' ? 'You'  : 'AI';

    let bodyHTML = '';
    if (type === 'image') {
        const { src, name } = content;
        bodyHTML = `
            <img class="chat-image-thumb" src="${src}" alt="${name}">
            <div class="chat-image-filename">
                <i data-lucide="file-image"></i> ${name}
            </div>`;
    } else if (type === 'code') {
        const fname = gns3Data?._chatLabel || 'scanned.gns3';
        const highlighted = syntaxHighlightJson(content);
        bodyHTML = `
            <div style="font-size:.82rem;color:var(--text-secondary);margin-bottom:.4rem;">
                Here is the generated .gns3 file:
            </div>
            <div class="chat-code-wrapper">
                <div class="chat-code-header">
                    <span class="chat-code-lang">
                        <i data-lucide="file-code"></i> ${fname}
                    </span>
                    <button class="chat-code-copy-btn" onclick="copyChatCode(this)">
                        <i data-lucide="copy"></i> Copy
                    </button>
                </div>
                <pre class="chat-code-block">${highlighted}</pre>
            </div>
            <button class="chat-run-btn" id="run-btn-${Date.now()}">
                <i data-lucide="play-circle"></i> Run in Topology Layout
            </button>`;
    } else if (type === 'error') {
        bodyHTML = `
            <div class="chat-error-msg">
                <i data-lucide="alert-circle"></i>
                <span>${content}</span>
            </div>`;
    } else {
        // plain text
        bodyHTML = `<span>${content}</span>`;
    }

    row.innerHTML = `
        <div class="chat-avatar"><i data-lucide="${avatarIcon}"></i></div>
        <div class="chat-bubble">
            <div class="chat-bubble-meta">
                <i data-lucide="${avatarIcon}" style="width:10px;height:10px;"></i>
                ${label} &mdash; ${chatTimestamp()}
            </div>
            <div class="chat-bubble-body">${bodyHTML}</div>
        </div>`;

    feed.appendChild(row);
    lucide.createIcons({ nodes: [row] });

    if (type === 'code' && gns3Data) {
        const runBtn = row.querySelector('.chat-run-btn');
        if (runBtn) runBtn.addEventListener('click', () => runTopologyFromChat(gns3Data, runBtn));
    }

    chatHistoryData.push({ role, type, content, gns3Data });
    scrollChatToBottom();
    return row;
}

// -- JSON syntax highlighter --------------
function syntaxHighlightJson(obj) {
    const raw = JSON.stringify(obj, null, 2);
    return raw
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(
            /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            match => {
                let cls = 'json-num';
                if (/^"/.test(match))  cls = /:$/.test(match) ? 'json-key' : 'json-str';
                else if (/true|false/.test(match)) cls = 'json-bool';
                else if (/null/.test(match))       cls = 'json-null';
                return `<span class="${cls}">${match}</span>`;
            }
        );
}

// -- Copy code block ----------------------
function copyChatCode(btn) {
    const pre = btn.closest('.chat-code-wrapper')?.querySelector('.chat-code-block');
    if (!pre) return;
    navigator.clipboard.writeText(pre.innerText).then(() => {
        btn.innerHTML = '<i data-lucide="check"></i> Copied!';
        lucide.createIcons({ nodes: [btn] });
        setTimeout(() => {
            btn.innerHTML = '<i data-lucide="copy"></i> Copy';
            lucide.createIcons({ nodes: [btn] });
        }, 2000);
    });
}

// -- Run topology in canvas ---------------
function runTopologyFromChat(gns3Data, runBtn) {
    if (runBtn.classList.contains('running')) return;
    runBtn.classList.add('running');
    runBtn.innerHTML = '<i data-lucide="check-circle"></i> Loading...';
    lucide.createIcons({ nodes: [runBtn] });

    customLinks.length = 0;
    customLinkCounter  = 0;
    nodeRegistry       = {};
    nodePositions      = {};

    parseAndRender(gns3Data);
    populateTopologies(gns3Data._chatLabel || 'scanned.gns3');
    currentGns3 = gns3Data;

    const topoSection = document.querySelector('.topology-section');
    if (topoSection) topoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Show verification modal after canvas has settled
    setTimeout(() => {
        showTopoVerifyModal(gns3Data);
        runBtn.innerHTML = '<i data-lucide="play-circle"></i> Run in Topology Layout';
        runBtn.classList.remove('running');
        lucide.createIcons({ nodes: [runBtn] });
    }, 900);
}


// -- Image upload -------------------------
async function handleChatImageUpload(file) {
    if (chatBusy) return;
    if (file.size > 10 * 1024 * 1024) {
        showToast('fail', 'File too large', 'Max image size is 10MB.');
        return;
    }

    if (!chatOpen) toggleChatbot();
    setChatBusy(true);

    const reader = new FileReader();
    reader.onload = async ev => {
        appendChatMessage('user', 'image', { src: ev.target.result, name: file.name });
        showChatThinking();

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res  = await fetch('/api/scan-image', { method: 'POST', body: formData });
            const json = await res.json();
            hideChatThinking();

            if (json.ok) {
                const gns3Res = await fetch(json.file + '?t=' + Date.now());
                if (!gns3Res.ok) throw new Error('Could not load generated .gns3 file.');
                const gns3Data = await gns3Res.json();
                gns3Data._chatLabel = 'scanned.gns3';

                currentGns3 = gns3Data;
                appendChatMessage('bot', 'code', gns3Data, gns3Data);
                await populateTopologies('scanned.gns3');
            } else {
                appendChatMessage('bot', 'error', `Scan failed: ${json.error}`);
            }
        } catch (err) {
            hideChatThinking();
            appendChatMessage('bot', 'error', `Error: ${err.message}`);
        } finally {
            setChatBusy(false);
        }
    };
    reader.readAsDataURL(file);
}

// -- Text message (topology modification) -
async function sendTextMessage() {
    const input = document.getElementById('chat-text-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text || chatBusy) return;

    input.value = '';
    if (!chatOpen) toggleChatbot();

    appendChatMessage('user', 'text', text);

    if (!currentGns3) {
        appendChatMessage('bot', 'text', 'Please upload a topology image first so I have a base .gns3 to modify.');
        return;
    }

    setChatBusy(true);
    showChatThinking();

    try {
        const res  = await fetch('/api/modify-topology', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction: text, current_gns3: currentGns3 })
        });
        const json = await res.json();
        hideChatThinking();

        if (json.ok) {
            const gns3Data = json.gns3;
            gns3Data._chatLabel = 'modified.gns3';
            currentGns3 = gns3Data;  // update base for chained edits
            appendChatMessage('bot', 'code', gns3Data, gns3Data);
            await populateTopologies('modified.gns3');
        } else {
            appendChatMessage('bot', 'error', `Modification failed: ${json.error}`);
        }
    } catch (err) {
        hideChatThinking();
        appendChatMessage('bot', 'error', `Error: ${err.message}`);
    } finally {
        setChatBusy(false);
    }
}

// -- Clear history ------------------------
function clearChatHistory() {
    chatHistoryData = [];
    currentGns3     = null;
    const feed = document.getElementById('chat-feed');
    if (!feed) return;
    feed.innerHTML = `
        <div class="chat-row bot">
            <div class="chat-avatar"><i data-lucide="bot"></i></div>
            <div class="chat-bubble">
                <div class="chat-bubble-body">
                    Hi! I'm your Network AI Assistant.<br>
                    Upload a topology image to generate a .gns3 file, or type an instruction to modify an existing one.
                </div>
            </div>
        </div>`;
    lucide.createIcons({ nodes: [feed] });
}

// ==========================================
// TOPOLOGY VERIFICATION MODAL
// ==========================================

function initTopoVerifyModal() {
    document.getElementById('topo-verify-close')?.addEventListener('click',   hideTopoVerifyModal);
    document.getElementById('topo-verify-dismiss')?.addEventListener('click', hideTopoVerifyModal);
    document.getElementById('topo-verify-modal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) hideTopoVerifyModal();
    });
}

function hideTopoVerifyModal() {
    const modal = document.getElementById('topo-verify-modal');
    if (modal) modal.style.display = 'none';
}

function showTopoVerifyModal(gns3Data) {
    const modal = document.getElementById('topo-verify-modal');
    if (!modal) return;

    // Collect nodes and links from the parsed topology
    // Use allLinks and nodeRegistry globals set by parseAndRender
    const nodes = Object.values(nodeRegistry || {});
    const links = allLinks || [];

    // Count types
    const pcNodes     = nodes.filter(n => (n.type||'').toLowerCase() === 'vpcs'     || (n.type||'').toLowerCase() === 'pc');
    const routerNodes = nodes.filter(n => (n.type||'').toLowerCase() === 'dynamips'  || (n.type||'').toLowerCase() === 'router' || (n.type||'').toLowerCase() === 'switch');
    const otherNodes  = nodes.filter(n => !pcNodes.includes(n) && !routerNodes.includes(n));

    // --- Summary stats ---
    document.getElementById('topo-verify-summary').innerHTML = `
        <div class="topo-verify-stat">
            <div class="topo-verify-stat-num green">${links.length}</div>
            <div class="topo-verify-stat-lbl">Links</div>
        </div>
        <div class="topo-verify-stat">
            <div class="topo-verify-stat-num blue">${nodes.length}</div>
            <div class="topo-verify-stat-lbl">Devices</div>
        </div>
        <div class="topo-verify-stat">
            <div class="topo-verify-stat-num purple">${links.length > 0 ? '100%' : '0%'}</div>
            <div class="topo-verify-stat-lbl">Connected</div>
        </div>`;

    // --- Links ---
    const linksEl = document.getElementById('topo-verify-links');
    if (links.length === 0) {
        linksEl.innerHTML = '<div style="padding:.5rem;color:var(--text-muted);font-size:.82rem;">No links found in topology.</div>';
    } else {
        linksEl.innerHTML = links.map((lk, i) => {
            const src  = lk.source?.name || lk.src  || 'Device';
            const tgt  = lk.target?.name || lk.dst  || 'Device';
            const delay = i * 60;
            return `
            <div class="topo-verify-link-row" style="animation-delay:${delay}ms;">
                <div class="link-check"><i data-lucide="check"></i></div>
                <div class="topo-verify-link-names">
                    <strong>${src}</strong>
                    <span class="link-sep">&#8660;</span>
                    <strong>${tgt}</strong>
                </div>
                <span class="topo-verify-link-badge">Connected</span>
            </div>`;
        }).join('');
    }

    // --- Devices ---
    const devicesEl = document.getElementById('topo-verify-devices');
    if (nodes.length === 0) {
        devicesEl.innerHTML = '<div style="padding:.5rem;color:var(--text-muted);font-size:.82rem;">No devices found.</div>';
    } else {
        devicesEl.innerHTML = nodes.map((n, i) => {
            const isRouter = routerNodes.includes(n);
            const icon     = isRouter ? 'server'    : 'monitor';
            const cls      = isRouter ? 'router-chip' : 'pc-chip';
            const delay    = i * 50;
            return `
            <div class="topo-verify-device-chip ${cls}" style="animation-delay:${delay}ms;">
                <i data-lucide="${icon}"></i>
                ${n.name || n.id || 'Device'}
            </div>`;
        }).join('');
    }

    modal.style.display = 'flex';
    lucide.createIcons({ nodes: [modal] });
}

// Wire verify modal on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initTopoVerifyModal, { once: false });

// ==========================================
// INTERACTIVE TERMINAL CLI
// ==========================================

let currentTerminalHost = 'R1';

function initTerminal() {
    const termInput = document.getElementById('terminal-input');
    if (!termInput) return;

    // Set initial prompt
    const promptEl = document.getElementById('term-prompt-active');
    if (promptEl) promptEl.textContent = `${currentTerminalHost}>`;

    termInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const cmd = termInput.value.trim();
            if (!cmd) return;
            
            termInput.value = '';
            termInput.disabled = true;
            
            // Print command
            appendTermLine(`<span class="term-prompt">${currentTerminalHost}&gt;</span> ${cmd}`);
            
            // Process command
            await processTerminalCommand(cmd);
            
            termInput.disabled = false;
            termInput.focus();
        }
    });
}

function appendTermLine(html) {
    const out = document.getElementById('terminal-output');
    if (!out) return;
    const div = document.createElement('div');
    div.className = 'term-line';
    div.innerHTML = html;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function processTerminalCommand(cmd) {
    const parts = cmd.split(' ').filter(Boolean);
    const baseCmd = parts[0].toLowerCase();
    
    if (baseCmd === 'ping') {
        const target = parts[1];
        if (!target) {
            appendTermLine('Usage: ping &lt;ip-address or hostname&gt;');
            return;
        }
        
        // Find if target matches any node or generated IP
        const nodes = Object.values(nodeRegistry || {});
        let foundNode = nodes.find(n => n.name.toLowerCase() === target.toLowerCase());
        
        // Check if user typed an IP from the getIP helper
        if (!foundNode && typeof getIP === 'function') {
            foundNode = nodes.find(n => getIP(n.name) === target);
        }
        
        if (!foundNode) {
            appendTermLine(`Pinging ${target} with 32 bytes of data:`);
            await sleep(500);
            appendTermLine(`<span class="term-error">Request timed out.</span>`);
            await sleep(500);
            appendTermLine(`<span class="term-error">Request timed out.</span>`);
            await sleep(500);
            appendTermLine(`<span class="term-error">Request timed out.</span>`);
            await sleep(500);
            appendTermLine(`<span class="term-error">Request timed out.</span>`);
            appendTermLine('<br>Ping statistics for ' + target + ':');
            appendTermLine('    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)');
            return;
        }

        const ip = typeof getIP === 'function' ? getIP(foundNode.name) : target;
        const name = foundNode.name;
        
        appendTermLine(`Pinging ${name} [${ip}] with 32 bytes of data:`);
        
        let sent = 4, rec = 4;
        let totalTime = 0, minTime = 999, maxTime = 0;
        
        for(let i=0; i<4; i++) {
            await sleep(600);
            const time = 2 + Math.floor(Math.random() * 20);
            totalTime += time;
            if(time < minTime) minTime = time;
            if(time > maxTime) maxTime = time;
            appendTermLine(`Reply from ${ip}: bytes=32 time=${time}ms TTL=64`);
        }
        
        await sleep(400);
        appendTermLine(`<br>Ping statistics for ${ip}:`);
        appendTermLine(`    Packets: Sent = ${sent}, Received = ${rec}, Lost = 0 (0% loss),`);
        appendTermLine(`Approximate round trip times in milli-seconds:`);
        appendTermLine(`    Minimum = ${minTime}ms, Maximum = ${maxTime}ms, Average = ${Math.round(totalTime/4)}ms`);
        
    } else if (baseCmd === 'clear' || baseCmd === 'cls') {
        const out = document.getElementById('terminal-output');
        if (out) out.innerHTML = '';
    } else if (baseCmd === 'ssh' || baseCmd === 'connect') {
        const target = parts[1];
        if (!target) {
            appendTermLine(`Usage: ${baseCmd} &lt;hostname&gt;`);
            return;
        }
        currentTerminalHost = target.toUpperCase();
        const promptEl = document.getElementById('term-prompt-active');
        if (promptEl) promptEl.textContent = `${currentTerminalHost}>`;
        appendTermLine(`Connected to ${currentTerminalHost}. Console is now active.`);
    } else if (baseCmd === 'help') {
        appendTermLine('Available commands:');
        appendTermLine('  <span class="term-highlight">ping &lt;target&gt;</span> - Send ICMP ECHO_REQUEST to network hosts');
        appendTermLine('  <span class="term-highlight">connect &lt;hostname&gt;</span> - Change active terminal session');
        appendTermLine('  <span class="term-highlight">clear</span> - Clear the terminal screen');
        appendTermLine('  <span class="term-highlight">help</span> - Show this message');
    } else {
        appendTermLine(`<span class="term-error">% Unknown command: ${baseCmd}</span>`);
    }
}

// Wire up terminal on load
document.addEventListener('DOMContentLoaded', initTerminal, { once: false });

