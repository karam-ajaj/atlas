// data/html/visuals/vis_network.js
// vis_network.js

// --- CONFIG ---
const API_URL = window.location.hostname.includes('vnerd.nl')
  ? 'https://atlas-api.vnerd.nl/hosts'
  : 'http://192.168.2.81:8889/hosts';

let network, nodesDS, edgesDS;
let nodesArr = [], allNodes = [], allEdges = [];

async function fetchData() {
  const response = await fetch(API_URL);
  return response.json();
}

function getSubnet(ip) {
  if (!ip) return '';
  const m = ip.match(/^([\d]+\.[\d]+\.[\d]+)\./);
  return m ? m[1] + '.0' : 'other';
}

function subnetColor(subnet) {
  const palette = ['#f39c12','#16a085','#e67e22','#c0392b','#2980b9','#8e44ad','#27ae60','#d35400','#2c3e50','#e84393'];
  let sum = 0;
  for (let c of subnet) sum += c.charCodeAt(0);
  return palette[sum % palette.length];
}

function buildNetworkData(data, filters = {}) {
  nodesArr = []; allEdges = []; allNodes = [];
  let idCtr = 1, dockerCount = 0, normalCount = 0;
  const subnetMap = {};

  function addHost(host, type) {
    const [, ip, name, os, mac, ports] = host;
    const sn = getSubnet(ip);
    subnetMap[sn] = subnetMap[sn] || [];
    // Label now shows name only (fallback to ip if no name)
    const labelText = name || ip;
    const node = {
      id: idCtr++,
      label: labelText,
      ip, name, os, mac, ports,
      group: type === 'docker' ? 'docker' : 'normal',
      color: type === 'docker' ? '#40a9ff' : '#ff6666',
      font: { color: '#fff' },
      subnet: sn
    };
    if (filters.dockerOnly && node.group !== 'docker') return;
    if (filters.text && ![ip,name,os,mac,ports].join(' ').toLowerCase().includes(filters.text.toLowerCase())) return;
    if (filters.os && filters.os !== os) return;
    if (filters.subnet && filters.subnet !== sn) return;

    nodesArr.push(node);
    subnetMap[sn].push(node.id);
    allNodes.push(node);
    type === 'docker' ? dockerCount++ : normalCount++;
  }

  data[0].forEach(h => addHost(h, 'normal'));
  data[1].forEach(h => addHost(h, 'docker'));

  Object.entries(subnetMap).forEach(([sn, ids]) => {
    const sid = 'subnet-' + sn;
    const col = subnetColor(sn);
    allNodes.push({ id: sid, label: sn, group: 'subnet', shape: 'ellipse', color: col, font: { color: '#fff', size: 14 }, physics: false });
    ids.forEach(i => allEdges.push({ from: sid, to: i, color: { color: col, opacity: 0.35 }, width: 1, dashes: true }));
  });

  allNodes.push({ id: 0, label: 'Network Hub', group: 'hub', shape: 'star', color: '#ffd600', size: 36, font: { color: '#000', size: 17 } });
  Object.keys(subnetMap).forEach(sn => {
    allEdges.push({ from: 0, to: 'subnet-' + sn, width: 2, color: { color: '#888', opacity: 0.2 }, dashes: true });
  });

  return { nodes: allNodes, edges: allEdges, dockerCount, normalCount };
}

async function drawVisNetwork(filters = {}) {
  const data = await fetchData();
  const { nodes, edges, dockerCount, normalCount } = buildNetworkData(data, filters);

  if (!nodesDS) {
    nodesDS = new vis.DataSet(nodes);
    edgesDS = new vis.DataSet(edges);
    network = new vis.Network(
      document.getElementById('mynetwork'),
      { nodes: nodesDS, edges: edgesDS },
      {
        interaction: { hover: true, tooltipDelay: 150 },
        nodes: { shape: 'dot', size: 21, font: { size: 12, color: '#fff' }, borderWidth: 2, shadow: true },
        edges: { color: { color: '#ccc', highlight: '#40a9ff', hover: '#ff9800' }, smooth: { type: 'dynamic' }, shadow: false },
        groups: {
          docker: { shape: 'square', color: '#40a9ff' },
          normal: { shape: 'dot', color: '#ff6666' },
          subnet: { shape: 'ellipse', color: '#222', font: { color: '#fff' } },
          hub: { shape: 'star', color: '#ffd600', font: { color: '#000' } }
        },
        layout: { improvedLayout: true },
        physics: { barnesHut: { gravitationalConstant: -5000 }, stabilization: false }
      }
    );
  } else {
    nodesDS.clear();
    edgesDS.clear();
    nodesDS.add(nodes);
    edgesDS.add(edges);
  }

  network.on('selectNode', params => {
    const n = nodesDS.get(params.nodes[0]);
    window.onNetworkNodeSelect?.(n || {});
  });
  network.on('deselectNode', () => window.onNetworkNodeSelect?.({}));
  network.on('hoverNode', params => {
    const n = nodesDS.get(params.node);
    if (!n) return;
    let tt = `<b>${n.label}</b><br>
      <small>${n.group === 'docker' ? 'Docker' : 'Normal'} Host</small><br>
      <b>IP:</b> ${n.ip || ''}<br>
      <b>OS:</b> ${n.os || ''}<br>
      <b>MAC:</b> ${n.mac || ''}<br>
      <b>Ports:</b> ${n.ports || ''}<br>
      <b>Subnet:</b> ${n.subnet || ''}`;
    network.body.container.title = tt.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '');
  });
  network.on('blurNode', () => (network.body.container.title = ''));

  if (window.onNetworkDataReady) {
    window.onNetworkDataReady(
      nodes.filter(x => x.group !== 'subnet' && x.group !== 'hub'),
      dockerCount,
      normalCount
    );
  }
}

window.applyVisFilter = drawVisNetwork;

document.addEventListener('DOMContentLoaded', async () => {
  await drawVisNetwork();

  const raw = await fetchData();
  const { nodes } = buildNetworkData(raw, {});
  const hosts = nodes.filter(n => n.group === 'normal' || n.group === 'docker');

  const osSel = document.getElementById('osFilter');
  [...new Set(hosts.map(n => n.os).filter(Boolean))].sort().forEach(os => {
    osSel.innerHTML += `<option>${os}</option>`;
  });

  const snSel = document.getElementById('subnetFilter');
  [...new Set(hosts.map(n => n.subnet).filter(Boolean))].sort().forEach(sn => {
    snSel.innerHTML += `<option value="${sn}">${sn}</option>`;
  });

  const apply = () =>
    drawVisNetwork({
      dockerOnly: document.getElementById('filterDockerOnly').checked,
      text: document.getElementById('textFilter').value.trim(),
      os: document.getElementById('osFilter').value,
      subnet: document.getElementById('subnetFilter').value
    });

  document.getElementById('filterDockerOnly').addEventListener('change', apply);
  document.getElementById('textFilter').addEventListener('input', apply);
  document.getElementById('osFilter').addEventListener('change', apply);
  document.getElementById('subnetFilter').addEventListener('change', apply);
});
