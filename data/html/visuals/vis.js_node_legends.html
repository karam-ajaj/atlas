// data/html/visuals/vis_network.js

// --- CONFIG ---
const API_URL = window.location.hostname.includes('vnerd.nl')
  ? 'https://atlas-api.vnerd.nl/hosts'
  : 'http://192.168.2.81:8889/hosts';

let network, nodesDS, edgesDS;
let nodesArr = [], allEdges = [], allNodes = [];

async function fetchData() {
  const resp = await fetch(API_URL);
  return resp.json(); // [ normalHosts, dockerHosts ]
}

function getSubnet(ip) {
  if (!ip) return '';
  const m = ip.match(/^([\d]+\.[\d]+\.[\d]+)\./);
  return m ? m[1] + '.0' : 'other';
}

function subnetColor(subnet) {
  const palette = ['#f39c12','#16a085','#e67e22','#c0392b','#2980b9','#8e44ad','#27ae60','#d35400','#2c3e50','#e84393'];
  let sum = 0; for (let c of subnet) sum += c.charCodeAt(0);
  return palette[sum % palette.length];
}

function buildNetworkData(data, filters = {}) {
  nodesArr = []; allEdges = []; allNodes = [];
  let idCtr = 1, dockerCount = 0, normalCount = 0;
  const subnetMap = {};

  function addHost(host, type) {
    const [ , ip, name, os, mac, ports ] = host;
    const subnet = getSubnet(ip);
    subnetMap[subnet] = subnetMap[subnet] || [];
    const node = {
      id: idCtr++, label: name||ip, ip, name, os, mac, ports,
      group: type==='docker'?'docker':'normal',
      subnet, color: type==='docker'?'#40a9ff':'#ff6666',
      font:{color:'#fff'}
    };
    // apply filters
    if (filters.dockerOnly && node.group!=='docker') return;
    if (filters.text && ![ip,name,os,mac,ports].join(' ').toLowerCase().includes(filters.text.toLowerCase())) return;
    if (filters.os && filters.os !== os) return;
    if (filters.subnet && filters.subnet !== subnet) return;

    nodesArr.push(node);
    subnetMap[subnet].push(node.id);
    allNodes.push(node);
    type==='docker'?dockerCount++:normalCount++;
  }

  data[0].forEach(h=>addHost(h,'normal'));
  data[1].forEach(h=>addHost(h,'docker'));

  // subnet grouping
  for (let [subnet, ids] of Object.entries(subnetMap)) {
    const sid = 'subnet-'+subnet;
    const color = subnetColor(subnet);
    allNodes.push({ id: sid, label: subnet, group:'subnet', shape:'ellipse', color, font:{color:'#fff'}, physics:false });
    ids.forEach(id => allEdges.push({ from:sid, to:id, color:{color,opacity:0.35}, dashes:true, width:1 }));
  }
  // hub
  allNodes.push({ id:0,label:'Network Hub',group:'hub',shape:'star',color:'#ffd600',size:36,font:{color:'#000',size:17} });
  for (let subnet of Object.keys(subnetMap)) {
    allEdges.push({ from:0, to:'subnet-'+subnet, color:{color:'#888',opacity:0.2}, dashes:true, width:2 });
  }

  return { nodes: allNodes, edges: allEdges, dockerCount, normalCount };
}

async function drawVisNetwork(filters={}) {
  const data = await fetchData();
  const { nodes, edges, dockerCount, normalCount } = buildNetworkData(data, filters);

  // init or update
  if (!nodesDS) {
    nodesDS = new vis.DataSet(nodes);
    edgesDS = new vis.DataSet(edges);
    network = new vis.Network(
      document.getElementById('mynetwork'),
      { nodes: nodesDS, edges: edgesDS },
      {
        interaction:{hover:true,tooltipDelay:150},
        nodes:{shape:'dot',size:21,font:{size:12,color:'#fff'},borderWidth:2,shadow:true},
        edges:{color:{color:'#ccc',highlight:'#40a9ff',hover:'#ff9800'},smooth:{type:'dynamic'}},
        groups:{
          docker:{shape:'square',color:'#40a9ff'},
          normal:{shape:'dot',color:'#ff6666'},
          subnet:{shape:'ellipse',color:'#222',font:{color:'#fff'}},
          hub:{shape:'star',color:'#ffd600',font:{color:'#000'}}
        },
        layout:{improvedLayout:true},
        physics:{barnesHut:{gravitationalConstant:-5000},stabilization:false}
      }
    );
  } else {
    nodesDS.clear(); edgesDS.clear();
    nodesDS.add(nodes); edgesDS.add(edges);
  }

  // sidebar & table update
  if (window.onNetworkDataReady) 
    window.onNetworkDataReady(nodes.filter(n=>n.group!=='subnet'&&n.group!=='hub'), dockerCount, normalCount);
}

// expose filter API
window.applyVisFilter = drawVisNetwork;

document.addEventListener('DOMContentLoaded', async () => {
  // initial render
  await drawVisNetwork();

  // gather unique OS & subnets for the dropdowns
  const raw = await fetchData();
  const all = buildNetworkData(raw, {});
  const hosts = all.nodes.filter(n=>n.group==='normal'||n.group==='docker');
  const uniqueOS = [...new Set(hosts.map(n=>n.os).filter(Boolean))].sort();
  const uniqueSubnets = [...new Set(hosts.map(n=>n.subnet).filter(Boolean))].sort();

  const osSel = document.getElementById('osFilter');
  uniqueOS.forEach(os=> osSel.innerHTML += `<option>${os}</option>`);

  const snSel = document.getElementById('subnetFilter');
  uniqueSubnets.forEach(s=> snSel.innerHTML += `<option value="${s}">${s}</option>`);

  // wire controls
  document.getElementById('filterDockerOnly').addEventListener('change', () => {
    window.applyVisFilter({
      dockerOnly: document.getElementById('filterDockerOnly').checked,
      text: document.getElementById('textFilter').value.trim(),
      os: document.getElementById('osFilter').value,
      subnet: document.getElementById('subnetFilter').value
    });
  });
  ['textFilter','osFilter','subnetFilter'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      window.applyVisFilter({
        dockerOnly: document.getElementById('filterDockerOnly').checked,
        text: document.getElementById('textFilter').value.trim(),
        os: document.getElementById('osFilter').value,
        subnet: document.getElementById('subnetFilter').value
      });
    });
  });
});
