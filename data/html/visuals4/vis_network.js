// vis_network.js
let network, allNodes = [], allEdges = [], allData, nodeIdMap = {};
let selectedNode = null;
let allOS = new Set(), allSubnets = new Set();

async function fetchHostsData() {
  // CHANGE API ENDPOINT HERE if needed!
  const resp = await fetch("http://192.168.2.81:8889/hosts");
  const data = await resp.json();
  return data;
}

function parseSubnet(ip) {
  if (!ip) return '';
  let m = ip.match(/^(\d+\.\d+\.\d+)\./);
  return m ? m[1]+'.x' : ip;
}

// Format JSON pretty for sidebar
function formatJSON(obj) {
  if(!obj) return "";
  let str = JSON.stringify(obj, null, 2);
  // Add colors
  str = str.replace(/\"(\w+)\":/g, '<span class="json-key">"$1"</span>:')
    .replace(/: \"(.*?)\"/g, ': <span class="json-string">"$1"</span>')
    .replace(/: ([\d.]+)/g, ': <span class="json-value">$1</span>');
  return str;
}

function updateNodeInfoPanel(data) {
  const infoBox = document.getElementById("nodeinfo-content");
  if (!data) {
    infoBox.innerHTML = "No node selected.";
    return;
  }
  // Hide passwords/env if present
  let filtered = { ...data };
  if(filtered.env) delete filtered.env;
  infoBox.innerHTML = '<div class="json-pretty">'+formatJSON(filtered)+'</div>';
}

function buildTable(hosts) {
  const tbody = document.querySelector("#host-table tbody");
  tbody.innerHTML = "";
  hosts.forEach((host, idx) => {
    let tr = document.createElement("tr");
    tr.onclick = () => {
      highlightNode(host._visId);
      showTab('nodeinfo');
      updateNodeInfoPanel(host);
    };
    if (selectedNode && selectedNode._visId === host._visId)
      tr.classList.add("selected");
    tr.innerHTML = `<td>${idx+1}</td>
      <td>${host.ip}</td>
      <td>${host.name}</td>
      <td>${host.os}</td>
      <td>${host.mac}</td>
      <td style="max-width:120px;overflow:auto">${host.ports}</td>`;
    tbody.appendChild(tr);
  });
}

function highlightNode(id) {
  if (!network) return;
  network.selectNodes([id]);
  network.focus(id, { scale: 1.2, animation: true });
  selectedNode = allNodes.find(n => n.id === id);
  updateNodeInfoPanel(selectedNode);
}

function fillDropdown(sel, values, selected) {
  sel.innerHTML = `<option value="all">All</option>`;
  Array.from(values).sort().forEach(v=>{
    let opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    if(v === selected) opt.selected = true;
    sel.appendChild(opt);
  });
}

function applyFilters() {
  let tval = document.getElementById('type-filter').value;
  let osval = document.getElementById('os-filter').value;
  let subnetval = document.getElementById('subnet-filter').value;
  let search = document.getElementById('searchBox').value.trim().toLowerCase();

  return allNodes.filter(n => {
    if(tval!=='all' && n.type !== tval) return false;
    if(osval!=='all' && n.os !== osval) return false;
    if(subnetval!=='all' && n.subnet !== subnetval) return false;
    if(search) {
      let txt = (n.name||"") + (n.ip||"") + (n.mac||"") + (n.ports||"");
      if(!txt.toLowerCase().includes(search)) return false;
    }
    return true;
  });
}

function updateTableAndMap() {
  const filtered = applyFilters();
  buildTable(filtered);

  // hide non-filtered nodes from the network
  let shownIds = new Set(filtered.map(n=>n.id));
  let nodesToShow = allNodes.filter(n=>shownIds.has(n.id));
  let edgesToShow = allEdges.filter(e=>shownIds.has(e.from) && shownIds.has(e.to));
  network.setData({
    nodes: new vis.DataSet(nodesToShow),
    edges: new vis.DataSet(edgesToShow)
  });
}

window.initVisNetwork = async function() {
  // Fetch and parse host data
  const hostsData = await fetchHostsData();
  // hostsData: [ [normal hosts...], [docker hosts...] ]
  allNodes = []; allEdges = []; nodeIdMap = {}; allOS.clear(); allSubnets.clear();

  // Layout: create one subnet node per subnet, connect hosts to it
  let subnetNodes = {}, nextId = 1, subnetColor = {};
  const colors = ["#B2DFDB", "#FFECB3", "#FFE6E6", "#E1BEE7", "#C8E6C9", "#CFD8DC", "#FFF9C4"];
  function getSubnetColor(sn) {
    if(!subnetColor[sn]) subnetColor[sn] = colors[Object.keys(subnetColor).length % colors.length];
    return subnetColor[sn];
  }

  function addHost(hostArr, type) {
    let [ _id, ip, name, os, mac, ports ] = hostArr;
    let subnet = parseSubnet(ip);
    allOS.add(os);
    allSubnets.add(subnet);

    let id = "h"+(++nextId);
    let node = {
      id, label: name||ip, ip, name, os, mac, ports, type, subnet,
      group: type==="docker" ? "server" : "desktop", // you can tune group!
      color: type==="docker" ? "#276ef1" : "#ffe6e6",
      _visId: id
    };
    allNodes.push(node);
    nodeIdMap[id]=node;

    // Create subnet node if not present
    if(!subnetNodes[subnet]) {
      let sid = "s"+(++nextId);
      subnetNodes[subnet] = { id:sid, label:subnet, group:"switch", color:getSubnetColor(subnet), physics:false, font:{size:13}, shape:"triangle" };
      allNodes.push(subnetNodes[subnet]);
    }
    // Add edge from subnet to host
    allEdges.push({ from: subnetNodes[subnet].id, to: id, color: { color: "#bdbdbd" } });
  }

  // Add hosts from both sets
  hostsData[0]?.forEach(h=>addHost(h,"normal"));
  hostsData[1]?.forEach(h=>addHost(h,"docker"));

  // Connect subnet nodes to a "core"
  let coreId = "core0";
  allNodes.push({ id: coreId, label: "Network Core", group: "internet", color: "#109618", shape: "star", size: 36, font:{size:16}});
  Object.values(subnetNodes).forEach(s=>{
    allEdges.push({ from: coreId, to: s.id, color:{color:'#FF9900'} });
  });

  allData = { nodes: new vis.DataSet(allNodes), edges: new vis.DataSet(allEdges) };

  // Vis.js create network
  const container = document.getElementById('mynetwork');
  network = new vis.Network(container, allData, {
    interaction: { hover: true, navigationButtons:true, multiselect: true },
    nodes: { shape:'dot', size:18, font:{color:'#222'}, borderWidth:1.5 },
    edges: { font:{ align:'middle', size:12 }, smooth:false, color: { color:'#bfbfbf' } },
    physics: { stabilization: false, barnesHut:{ gravitationalConstant:-22000, springLength:190 } },
    groups: {
      switch: { shape:'triangle', color:'#FF9900', font:{color:'#222'} },
      desktop:{ shape:'dot', color:'#2B7CE9' },
      server:{ shape:'square', color:'#276ef1' },
      internet:{ shape:'star', color:'#109618', font:{color:'#1a2'} }
    }
  });

  // Tooltips
  network.on("hoverNode", params => {
    const node = allNodes.find(n=>n.id===params.node);
    if(!node) return;
    let html = `<b>${node.label}</b><br>IP: ${node.ip || ''}<br>OS: ${node.os || ''}<br>MAC: ${node.mac || ''}<br>Ports: ${node.ports||''}<br>Subnet: ${node.subnet||''}<br>Type: ${node.type||''}`;
    network.canvas.body.container.setAttribute('title', html.replace(/<br>/g, '\n').replace(/<b>|<\/b>/g,''));
  });
  network.on("blurNode", ()=> network.canvas.body.container.removeAttribute('title'));

  // Node click: update sidebar, table
  network.on("selectNode", params => {
    let node = allNodes.find(n=>n.id===params.nodes[0]);
    if(node) {
      selectedNode = node;
      showTab('nodeinfo');
      updateNodeInfoPanel(node);
      // highlight table row
      document.querySelectorAll("#host-table tbody tr").forEach(tr=>tr.classList.remove("selected"));
      let idx = allNodes.findIndex(n=>n.id===node.id);
      let tr = document.querySelector(`#host-table tbody tr:nth-child(${idx+1})`);
      tr?.classList.add("selected");
    }
  });
  network.on("deselectNode", ()=>{
    selectedNode = null;
    updateNodeInfoPanel(null);
    document.querySelectorAll("#host-table tbody tr").forEach(tr=>tr.classList.remove("selected"));
  });

  // Fill filter dropdowns
  fillDropdown(document.getElementById("os-filter"), allOS);
  fillDropdown(document.getElementById("subnet-filter"), allSubnets);

  // Wire up filter UI
  ["type-filter", "os-filter", "subnet-filter"].forEach(id=>{
    document.getElementById(id).onchange = updateTableAndMap;
  });
  document.getElementById('searchBox').oninput = updateTableAndMap;

  // Initial display
  updateTableAndMap();
};

// END
