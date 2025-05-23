// vis_network.js

// --- CONFIG ---
const API_URL = window.location.hostname.includes('vnerd.nl')
  ? 'https://atlas-api.vnerd.nl/hosts'
  : 'http://192.168.2.81:8889/hosts';

let network, nodesDS, edgesDS;
let nodesArr = []; // For table/sidepanel
let allNodes = [];
let allEdges = [];

async function fetchData() {
  const response = await fetch(API_URL);
  const data = await response.json();
  // data[0] = normal hosts, data[1] = docker hosts
  return data;
}

function getSubnet(ip) {
  if(!ip || typeof ip !== "string") return "";
  const m = ip.match(/^([\d]+\.[\d]+\.[\d]+)\./);
  return m ? m[1]+'.0' : "other";
}

function subnetColor(subnet) {
  const palette = [
    "#f39c12", "#16a085", "#e67e22", "#c0392b", "#2980b9",
    "#8e44ad", "#27ae60", "#d35400", "#2c3e50", "#e84393"
  ];
  let sum = 0;
  for (let i = 0; i < subnet.length; ++i) sum += subnet.charCodeAt(i);
  return palette[sum % palette.length];
}

function buildNetworkData(data, filters={}) {
  nodesArr = [];
  allEdges = [];
  allNodes = [];
  let idCounter = 1, dockerCount = 0, normalCount = 0;
  let subnetMap = {};

  function addHost(host, i, type) {
    let ip = host[1], name = host[2], os = host[3], mac = host[4], ports = host[5];
    let subnet = getSubnet(ip);
    if(!subnetMap[subnet]) subnetMap[subnet] = [];
    const node = {
      id: idCounter++, label: name || ip, ip, name, os, mac, ports,
      group: type === 'docker' ? 'docker' : 'normal',
      color: type === 'docker' ? "#40a9ff" : "#ff6666",
      font: { color: "#fff" },
      subnet,
      _raw: host
    };
    // ─── Apply our filters ───
    if(filters.dockerOnly && type !== 'docker') return;
    if(filters.text && ![ip,name,os,mac,ports].join(' ').toLowerCase().includes(filters.text.toLowerCase())) return;
    if(filters.os && filters.os !== os) return;
    if(filters.subnet && filters.subnet !== subnet) return;

    nodesArr.push(node);
    subnetMap[subnet].push(node.id);
    allNodes.push(node);
    if(type === 'docker') dockerCount++; else normalCount++;
  }

  data[0].forEach((h,i)=>addHost(h,i,'normal'));
  data[1].forEach((h,i)=>addHost(h,i,'docker'));

  let subnetNodes = [];
  Object.entries(subnetMap).forEach(([subnet,ids]) => {
    subnetNodes.push({
      id: 'subnet-'+subnet,
      label: subnet,
      group: 'subnet',
      shape: 'ellipse',
      color: subnetColor(subnet),
      font: { color: "#fff", size: 14 },
      fixed: false,
      physics: false,
      subnet: subnet
    });
    ids.forEach(id => {
      allEdges.push({
        from: 'subnet-'+subnet, to: id,
        color: { color: subnetColor(subnet), opacity: 0.35 },
        width: 1,
        dashes: true
      });
    });
  });

  subnetNodes.forEach(sn => {
    allEdges.push({
      from: 0, to: sn.id, width: 2, color: { color:'#888', opacity:0.2 }, dashes:true
    });
  });

  allNodes.push({
    id: 0, label: 'Network Hub', group: 'hub',
    color: '#ffd600', shape: 'star', size: 36, font: { color: '#000', size: 17 }
  });
  allNodes = [...allNodes, ...subnetNodes];

  return { nodes: allNodes, edges: allEdges, dockerCount, normalCount };
}

async function drawVisNetwork(filters={}) {
  const data = await fetchData();
  const { nodes, edges, dockerCount, normalCount } = buildNetworkData(data, filters);

  nodesDS = new vis.DataSet(nodes);
  edgesDS = new vis.DataSet(edges);

  const container = document.getElementById('mynetwork');
  container.innerHTML = '';
  const options = {
    interaction: { hover: true, tooltipDelay: 150 },
    nodes: {
      shape: "dot", size: 21, font: { size: 12, color: "#fff" },
      borderWidth: 2, shadow: true
    },
    edges: {
      color: { color: '#ccc', highlight: '#40a9ff', hover: '#ff9800' },
      smooth: { type: 'dynamic' }, shadow: false
    },
    groups: {
      docker: { shape: 'square', color: '#40a9ff' },
      normal: { shape: 'dot', color: '#ff6666' },
      subnet: { shape: 'ellipse', color: '#222', font: { color: '#fff' } },
      hub: { shape: 'star', color: '#ffd600', font: { color: '#000' } }
    },
    layout: {
      improvedLayout: true,
      hierarchical: false
    },
    physics: { barnesHut: { gravitationalConstant: -5000 }, stabilization: false }
  };

  network = new vis.Network(container, { nodes: nodesDS, edges: edgesDS }, options);

  if(window.onNetworkDataReady)
    window.onNetworkDataReady(nodes.filter(n => n.group !== 'subnet' && n.group !== 'hub'), dockerCount, normalCount);

  network.on("hoverNode", params => {
    const node = nodesDS.get(params.node);
    if(!node) return;
    let html = `<b>${node.label||''}</b><br>
      <small>${node.group==='docker'?'Docker':'Normal'} Host</small><br>
      <b>IP:</b> ${node.ip||''}<br>
      <b>OS:</b> ${node.os||''}<br>
      <b>MAC:</b> ${node.mac||''}<br>
      <b>Ports:</b> ${node.ports||''}<br>
      <b>Subnet:</b> ${node.subnet||''}`;
    network.body.container.title = html.replace(/<br>/g,"\n").replace(/<[^>]*>/g,"");
  });
  network.on("blurNode", () => {
    network.body.container.title = '';
  });

  network.on("selectNode", params => {
    const sel = params.nodes[0];
    const node = nodesDS.get(sel);
    if(node && window.onNetworkNodeSelect)
      window.onNetworkNodeSelect(node);
  });
  network.on("deselectNode", () => {
    if(window.onNetworkNodeSelect)
      window.onNetworkNodeSelect({});
  });

  window.applyVisFilter = function({dockerOnly,text,os,subnet}){
    drawVisNetwork({dockerOnly,text,os,subnet});
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // initial draw
  drawVisNetwork();

  // ─── New filtering setup ───
  fetchData().then(data => {
    const { nodes } = buildNetworkData(data, {});
    const hosts = nodes.filter(n => n.group==='normal' || n.group==='docker');

    // populate OS
    const osSet = new Set(hosts.map(n=>n.os).filter(Boolean));
    const osSel = document.getElementById('osFilter');
    osSet.forEach(os => {
      const opt = document.createElement('option');
      opt.value = os; opt.textContent = os;
      osSel.appendChild(opt);
    });

    // populate subnets
    const snSet = new Set(hosts.map(n=>n.subnet).filter(Boolean));
    const snSel = document.getElementById('subnetFilter');
    snSet.forEach(sn => {
      const opt = document.createElement('option');
      opt.value = sn; opt.textContent = sn;
      snSel.appendChild(opt);
    });
  });

  function applyFilters() {
    window.applyVisFilter({
      dockerOnly: document.getElementById('filterDockerOnly').checked,
      text: document.getElementById('textFilter').value.trim(),
      os: document.getElementById('osFilter').value,
      subnet: document.getElementById('subnetFilter').value
    });
  }

  // wire events
  document.getElementById('filterDockerOnly').addEventListener('change', applyFilters);
  document.getElementById('textFilter').addEventListener('input', applyFilters);
  document.getElementById('osFilter').addEventListener('change', applyFilters);
  document.getElementById('subnetFilter').addEventListener('change', applyFilters);
});
