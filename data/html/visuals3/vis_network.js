// vis_network.js

// --- CONFIG ---
const API_URL = 'http://192.168.2.81:8889/hosts'; // your backend

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
  // crude: use first 3 octets, works for /24 networks
  if(!ip || typeof ip !== "string") return "";
  const m = ip.match(/^(\d+\.\d+\.\d+)\./);
  return m ? m[1]+'.0' : "other";
}

function subnetColor(subnet) {
  // Assign some consistent color (expand as needed)
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
  let idCounter = 1, dockerCount=0, normalCount=0;
  let subnetMap = {};

  // --- flatten all hosts
  function addHost(host, i, type) {
    let ip = host[1], name = host[2], os = host[3], mac = host[4], ports = host[5];
    let subnet = getSubnet(ip);
    if(!subnetMap[subnet]) subnetMap[subnet] = [];
    const node = {
      id: idCounter++, label: name||ip, ip, name, os, mac, ports,
      group: type==='docker' ? 'docker' : 'normal',
      color: type==='docker' ? "#40a9ff" : "#ff6666",
      font: { color: "#fff" },
      subnet,
      // Store everything for search
      _raw: host
    };
    // Filtering logic
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

  // --- Subnet cluster nodes
  let subnetNodes = [];
  Object.entries(subnetMap).forEach(([subnet,ids],i)=>{
    subnetNodes.push({
      id:'subnet-'+subnet,
      label:subnet,
      group:'subnet',
      shape:'ellipse',
      color: subnetColor(subnet),
      font: { color: "#fff", size: 14 },
      fixed: false,
      physics: false,
      subnet: subnet
    });
    // connect subnet node to all hosts in it
    ids.forEach(id=>{
      allEdges.push({
        from: 'subnet-'+subnet, to: id,
        color: { color: subnetColor(subnet), opacity: 0.35 },
        width: 1,
        dashes: true
      });
    });
  });

  // Optionally, connect subnets to a root
  subnetNodes.forEach(sn=>{
    allEdges.push({
      from: 0, to: sn.id, width:2, color: {color:'#888',opacity:0.2}, dashes:true
    });
  });

  // Central root node
  allNodes.push({
    id: 0, label: 'Network Hub', group: 'hub',
    color: '#ffd600', shape:'star', size: 36, font:{color:'#000',size:17}
  });
  allNodes = [...allNodes, ...subnetNodes];

  return { nodes: allNodes, edges: allEdges, dockerCount, normalCount };
}

async function drawVisNetwork(filters={}) {
  const data = await fetchData();
  const { nodes, edges, dockerCount, normalCount } = buildNetworkData(data, filters);

  // DataSets for vis.js
  nodesDS = new vis.DataSet(nodes);
  edgesDS = new vis.DataSet(edges);

  // Clear previous
  const container = document.getElementById('mynetwork');
  container.innerHTML = '';
  const options = {
    interaction: { hover: true, tooltipDelay: 150 },
    nodes: {
      shape: "dot", size: 21, font: { size:12, color:"#fff" },
      borderWidth:2, shadow:true,
    },
    edges: {
      color: { color:'#ccc', highlight:'#40a9ff', hover:'#ff9800' },
      smooth: { type: 'dynamic' }, shadow:false,
    },
    groups: {
      docker: { shape:'square', color:'#40a9ff' },
      normal: { shape:'dot', color:'#ff6666' },
      subnet: { shape:'ellipse', color:'#222', font:{color:'#fff'} },
      hub: { shape:'star', color:'#ffd600', font:{color:'#000'} },
    },
    layout: {
      improvedLayout: true,
      hierarchical: false,
    },
    physics: { barnesHut: { gravitationalConstant: -5000 }, stabilization: false },
  };

  network = new vis.Network(container, {nodes:nodesDS,edges:edgesDS}, options);

  // Call dashboard hook on data ready!
  if(window.onNetworkDataReady) window.onNetworkDataReady(nodes.filter(n=>n.group!=='subnet' && n.group!=='hub'), dockerCount, normalCount);

  // --- NODE TOOLTIP + SIDEBAR INFO
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
  network.on("blurNode", ()=>{
    network.body.container.title = '';
  });

  // --- Click to show node info in sidebar
  network.on("selectNode", params => {
    const sel = params.nodes[0];
    const node = nodesDS.get(sel);
    if(node && window.onNetworkNodeSelect)
      window.onNetworkNodeSelect(node);
    // Optionally: highlight
    // nodesDS.forEach(n=>nodesDS.update({id:n.id, color:undefined}));
    // nodesDS.update({id:sel, color:{background:'#FFC107'}});
  });
  network.on("deselectNode", ()=>{
    if(window.onNetworkNodeSelect)
      window.onNetworkNodeSelect({});
  });

  // --- Filtering UI logic
  // (These can be called from HTML or programmatically)
  window.applyVisFilter = function({dockerOnly,text,os,subnet}){
    drawVisNetwork({dockerOnly,text,os,subnet});
  }
}

// ---- UI: FILTER HANDLERS ----
document.addEventListener('DOMContentLoaded', ()=>{
  drawVisNetwork();

  // Add event listeners for the sidebar/table/filters if you wish.
  // For example, to filter docker-only:
  // document.getElementById('dockerOnly').onchange = e=>{
  //   applyVisFilter({dockerOnly: e.target.checked});
  // }
  // And for text search, OS, subnet, etc.
});
