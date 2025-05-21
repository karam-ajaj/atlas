// This is the updated vis_network.js for your visuals3 with filters, clear button, export, and grouping toggle
const API_URL = 'http://192.168.2.81:8889/hosts';

let network, nodesDS, edgesDS;
let nodesArr = [], allNodes = [], allEdges = [];
let allSubnets = new Set(), allOSes = new Set();

async function fetchData() {
  const res = await fetch(API_URL);
  return res.json();
}

function getSubnet(ip) {
  const m = ip?.match(/^([\d.]+)\./);
  return m ? `${m[1]}.0` : 'unknown';
}

function subnetColor(subnet) {
  const palette = ["#f39c12","#16a085","#e67e22","#c0392b","#2980b9","#8e44ad","#27ae60","#d35400","#2c3e50","#e84393"];
  return palette[[...subnet].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
}

function buildNetworkData(data, filters = {}, groupSubnets = true) {
  nodesArr = []; allEdges = []; allNodes = [];
  allSubnets.clear(); allOSes.clear();

  let idCounter = 1, dockerCount = 0, normalCount = 0;
  const subnetMap = {};

  function addHost(h, _, type) {
    const [id, ip, name, os, mac, ports] = h;
    const subnet = getSubnet(ip);
    if (!subnetMap[subnet]) subnetMap[subnet] = [];
    allSubnets.add(subnet);
    allOSes.add(os);

    const node = {
      id: idCounter++, label: name || ip, ip, name, os, mac, ports,
      group: type, subnet,
      color: type === 'docker' ? '#40a9ff' : '#ff6666',
      font: { color: '#fff' }
    };

    if (filters.dockerOnly && type !== 'docker') return;
    if (filters.text && ![ip,name,os,mac,ports].join(' ').toLowerCase().includes(filters.text.toLowerCase())) return;
    if (filters.subnet && filters.subnet !== subnet) return;
    if (filters.os && filters.os !== os) return;

    subnetMap[subnet].push(node.id);
    allNodes.push(node);
    nodesArr.push(node);
    if (type === 'docker') dockerCount++; else normalCount++;
  }

  data[0].forEach(h => addHost(h, 0, 'normal'));
  data[1].forEach(h => addHost(h, 0, 'docker'));

  const subnetNodes = [];
  if (groupSubnets) {
    for (const [subnet, ids] of Object.entries(subnetMap)) {
      subnetNodes.push({
        id: `subnet-${subnet}`,
        label: subnet,
        group: 'subnet',
        shape: 'ellipse',
        color: subnetColor(subnet),
        font: { color: '#fff', size: 14 },
        physics: false
      });
      ids.forEach(id => allEdges.push({
        from: `subnet-${subnet}`, to: id,
        color: { color: subnetColor(subnet), opacity: 0.35 }, dashes: true, width: 1
      }));
    }
    subnetNodes.forEach(sn => allEdges.push({
      from: 0, to: sn.id, color: { color: '#888', opacity: 0.2 }, width: 2, dashes: true
    }));
    allNodes.push(...subnetNodes);
  }

  allNodes.push({
    id: 0, label: 'Network Hub', group: 'hub', shape: 'star',
    color: '#ffd600', font: { color: '#000', size: 16 }, size: 36
  });

  return { nodes: allNodes, edges: allEdges, dockerCount, normalCount };
}

async function drawVisNetwork(filters = {}) {
  const data = await fetchData();
  const groupSubnets = filters.groupSubnets ?? true;
  const { nodes, edges, dockerCount, normalCount } = buildNetworkData(data, filters, groupSubnets);

  nodesDS = new vis.DataSet(nodes);
  edgesDS = new vis.DataSet(edges);

  const container = document.getElementById('mynetwork');
  container.innerHTML = '';

  const options = {
    interaction: { hover: true },
    nodes: { shape: 'dot', size: 20, borderWidth: 2, shadow: true, font: { color: '#fff' } },
    edges: { color: { color: '#ccc' }, smooth: { type: 'dynamic' } },
    groups: {
      normal: { shape: 'dot', color: '#ff6666' },
      docker: { shape: 'square', color: '#40a9ff' },
      subnet: { shape: 'ellipse', color: '#222', font: { color: '#fff' } },
      hub: { shape: 'star', color: '#ffd600', font: { color: '#000' } }
    },
    physics: { barnesHut: { gravitationalConstant: -5000 }, stabilization: false }
  };

  network = new vis.Network(container, { nodes: nodesDS, edges: edgesDS }, options);

  if (window.onNetworkDataReady)
    window.onNetworkDataReady(nodesArr, dockerCount, normalCount);

  // TOOLTIP
  network.on('hoverNode', ({ node }) => {
    const n = nodesDS.get(node);
    network.body.container.title = `${n.name}\nIP: ${n.ip}\nOS: ${n.os}\nMAC: ${n.mac}\nPorts: ${n.ports}`;
  });
  network.on('blurNode', () => network.body.container.title = '');

  network.on('selectNode', ({ nodes }) => {
    const node = nodesDS.get(nodes[0]);
    if (window.onNetworkNodeSelect) window.onNetworkNodeSelect(node);
  });
  network.on('deselectNode', () => {
    if (window.onNetworkNodeSelect) window.onNetworkNodeSelect({});
  });

  // Populate dropdowns
  const sub = document.getElementById('subnetFilter'), os = document.getElementById('osFilter');
  if (sub && os) {
    sub.innerHTML = '<option value="">All Subnets</option>' + Array.from(allSubnets).sort().map(s => `<option>${s}</option>`).join('');
    os.innerHTML = '<option value="">All OS</option>' + Array.from(allOSes).sort().map(o => `<option>${o}</option>`).join('');
    sub.value = filters.subnet || '';
    os.value = filters.os || '';
  }
}

window.applyVisFilter = function(filters) {
  drawVisNetwork(filters);
};

document.addEventListener('DOMContentLoaded', () => drawVisNetwork());
