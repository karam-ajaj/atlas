// vis_network.js

// --- CONFIG ---
const API_URL = 'http://192.168.2.81:8889/hosts'; // your backend

let network, nodesDS, edgesDS;
let nodesArr = []; // Only host nodes for table and sidebar
let allNodes = [];
let allEdges = [];

// Fetch data from backend
async function fetchData() {
  const response = await fetch(API_URL);
  const data = await response.json();
  // data[0] = normal hosts, data[1] = docker hosts
  return data;
}

// Utility: get /24 subnet
function getSubnet(ip) {
  if (!ip || typeof ip !== "string") return "";
  const m = ip.match(/^(\d+\.\d+\.\d+)\./);
  return m ? m[1] + '.0' : "other";
}

// Utility: deterministic color by subnet
function subnetColor(subnet) {
  const palette = [
    "#f39c12", "#16a085", "#e67e22", "#c0392b", "#2980b9",
    "#8e44ad", "#27ae60", "#d35400", "#2c3e50", "#e84393"
  ];
  let sum = 0;
  for (let ch of subnet) sum += ch.charCodeAt(0);
  return palette[sum % palette.length];
}

// Build nodes and edges for vis network
function buildNetworkData(data, filters = {}) {
  nodesArr = [];    // reset host nodes list
  allEdges = [];
  allNodes = [];
  let idCounter = 1;
  let dockerCount = 0, normalCount = 0;
  let subnetMap = {};

  // Helper to add a host node
  function addHost(host, type) {
    const [_, ip, name, os, mac, ports] = host;
    const subnet = getSubnet(ip);

    // Filtering logic
    if (filters.dockerOnly && type !== 'docker') return;
    if (filters.text && ![ip, name, os, mac, ports].join(' ').toLowerCase().includes(filters.text.toLowerCase())) return;
    if (filters.os && filters.os !== os) return;
    if (filters.subnet && filters.subnet !== subnet) return;

    // Track subnet groups
    if (!subnetMap[subnet]) subnetMap[subnet] = [];
    const node = {
      id: idCounter++,
      label: name || ip,
      ip, name, os, mac, ports,
      group: type,
      color: type === 'docker' ? "#40a9ff" : "#ff6666",
      font: { color: "#fff" },
      subnet
    };

    nodesArr.push(node);
    subnetMap[subnet].push(node.id);

    // Count types
    if (type === 'docker') dockerCount++;
    else normalCount++;
  }

  // Add normal and docker hosts
  data[0].forEach(h => addHost(h, 'normal'));
  data[1].forEach(h => addHost(h, 'docker'));

  // Add all host nodes to allNodes
  allNodes = [...nodesArr];

  // Create subnet cluster nodes and edges
  for (const [subnet, ids] of Object.entries(subnetMap)) {
    const subnetNode = {
      id: 'subnet-' + subnet,
      label: subnet,
      group: 'subnet',
      shape: 'ellipse',
      color: subnetColor(subnet),
      font: { color: "#fff", size: 14 },
      fixed: false,
      physics: false
    };
    allNodes.push(subnetNode);

    // Connect subnet to each host
    ids.forEach(id => {
      allEdges.push({
        from: subnetNode.id,
        to: id,
        color: { color: subnetColor(subnet), opacity: 0.35 },
        width: 1,
        dashes: true
      });
    });

    // Optionally connect subnets to root
    allEdges.push({
      from: 0,
      to: subnetNode.id,
      color: { color: '#888', opacity: 0.2 },
      width: 2,
      dashes: true
    });
  }

  // Add central hub node
  allNodes.push({
    id: 0,
    label: 'Network Hub',
    group: 'hub',
    shape: 'star',
    color: '#ffd600',
    size: 36,
    font: { color: '#000', size: 17 }
  });

  return { nodes: allNodes, edges: allEdges, dockerCount, normalCount };
}

// Draw the vis network and bind events
async function drawVisNetwork(filters = {}) {
  const data = await fetchData();
  const { nodes, edges, dockerCount, normalCount } = buildNetworkData(data, filters);

  // Create vis DataSets
  nodesDS = new vis.DataSet(nodes);
  edgesDS = new vis.DataSet(edges);

  // Setup container
  const container = document.getElementById('mynetwork');
  container.innerHTML = '';

  const options = {
    interaction: { hover: true, tooltipDelay: 150 },
    nodes: { shape: 'dot', size: 21, borderWidth: 2, font: { color: '#fff', size: 12 }, shadow: true },
    edges: { color: { color: '#ccc', highlight: '#40a9ff', hover: '#ff9800' }, smooth: { type: 'dynamic' } },
    groups: {
      normal: { shape: 'dot', color: '#ff6666' },
      docker: { shape: 'square', color: '#40a9ff' },
      subnet: { shape: 'ellipse', color: '#222', font: { color: '#fff' } },
      hub: { shape: 'star', color: '#ffd600', font: { color: '#000' } }
    },
    layout: { improvedLayout: true, hierarchical: false },
    physics: { barnesHut: { gravitationalConstant: -5000 }, stabilization: false }
  };

  network = new vis.Network(container, { nodes: nodesDS, edges: edgesDS }, options);

  // Update dashboard: use nodesArr so only hosts update the table
  if (window.onNetworkDataReady) {
    window.onNetworkDataReady(nodesArr, dockerCount, normalCount);
  }

  // Tooltips on hover
  network.on('hoverNode', ({ node }) => {
    const n = nodesDS.get(node);
    network.body.container.title = `
${n.label}
${n.group === 'docker' ? 'Docker' : 'Normal'} Host
IP: ${n.ip}
OS: ${n.os}
MAC: ${n.mac}
Ports: ${n.ports}
Subnet: ${n.subnet}
    `;
  });
  network.on('blurNode', () => {
    network.body.container.title = '';
  });

  // Node selection for sidebar info
  network.on('selectNode', ({ nodes }) => {
    const n = nodesDS.get(nodes[0]);
    if (window.onNetworkNodeSelect) window.onNetworkNodeSelect(n);
  });
  network.on('deselectNode', () => {
    if (window.onNetworkNodeSelect) window.onNetworkNodeSelect({});
  });

  // Expose filter function
  window.applyVisFilter = function(filters) {
    drawVisNetwork(filters);
  };
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  drawVisNetwork();
});
