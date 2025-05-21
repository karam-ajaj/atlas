document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing network...');
  initNetworkDashboard();
});

async function initNetworkDashboard() {
  const apiUrl = 'http://192.168.2.81:8889/hosts';
  let raw;
  try {
    const resp = await fetch(apiUrl);
    raw = await resp.json();
    console.log('Fetched data:', raw);
  } catch (e) {
    console.error('Failed to fetch', e);
    return;
  }

  const [normalHosts, dockerHosts] = raw;
  const nodesArr = [];
  const edgesArr = [];
  const subnetMap = new Map();
  let nextId = 1;

  // helper to get /24
  const getSubnet = ip => ip.split('.').slice(0,3).join('.') + '.0';

  function addHost(host, type) {
    const [ , ip, name, os='', mac='', ports='' ] = host;
    const subnet = getSubnet(ip);

    // add subnet node if new
    if (!subnetMap.has(subnet)) {
      const sid = `subnet-${subnet}`;
      subnetMap.set(subnet, sid);
      nodesArr.push({
        id: sid,
        label: subnet,
        group: 'subnet',
        shape: 'triangle',
      });
    }

    const nid = nextId++;
    nodesArr.push({
      id: nid,
      label: name || ip,
      title: `IP: ${ip}<br>OS: ${os}<br>MAC: ${mac}<br>Ports: ${ports}`,
      group: type === 'docker' ? 'docker' : 'normal',
      ip, os, mac, ports, subnet
    });
    edgesArr.push({ from: subnetMap.get(subnet), to: nid });
  }

  normalHosts.forEach(h => addHost(h, 'normal'));
  dockerHosts.forEach(h => addHost(h, 'docker'));

  // create DataSets
  const nodes = new vis.DataSet(nodesArr);
  const edges = new vis.DataSet(edgesArr);
  const allData = { nodes, edges };

  // render initial network
  const container = document.getElementById('mynetwork');
  const options = {
    interaction: { hover: true },
    physics: { stabilization: false },
    groups: {
      subnet: { shape: 'triangle', color: '#FF9900' },
      normal: { shape: 'dot', color: '#2B7CE9' },
      docker: { shape: 'square', color: '#C5000B' }
    },
    nodes: { size: 16 },
    edges: { smooth: false }
  };
  const network = new vis.Network(container, allData, options);

  // populate OS & Subnet filters
  populateFilterOptions(nodesArr);

  // wire up filter events
  ['filterType','filterOS','filterSubnet','searchBox'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => applyFilters(allData, network));
    if (id === 'searchBox')
      document.getElementById(id).addEventListener('input', () => applyFilters(allData, network));
  });

  // initial filter (show all)
  applyFilters(allData, network);
}

function populateFilterOptions(nodesArr) {
  const osSet = new Set();
  const subnetSet = new Set();

  nodesArr.forEach(n => {
    if (n.group !== 'subnet') {
      if (n.os) osSet.add(n.os);
      if (n.subnet) subnetSet.add(n.subnet);
    }
  });

  const osSelect = document.getElementById('filterOS');
  const subnetSelect = document.getElementById('filterSubnet');

  osSet.forEach(os => {
    const opt = document.createElement('option');
    opt.value = os;
    opt.textContent = os;
    osSelect.appendChild(opt);
  });

  subnetSet.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    subnetSelect.appendChild(opt);
  });
}

function applyFilters(allData, network) {
  const type = document.getElementById('filterType').value;
  const os   = document.getElementById('filterOS').value;
  const subnet = document.getElementById('filterSubnet').value;
  const search = document.getElementById('searchBox').value.trim().toLowerCase();

  // filter nodes
  const visible = allData.nodes.get().filter(n => {
    if (n.group === 'subnet') return true;    // always keep subnets
    if (type && n.group !== type) return false;
    if (os   && n.os !== os) return false;
    if (subnet && n.subnet !== subnet) return false;
    if (search) {
      const text = `${n.label} ${n.ip} ${n.os}`.toLowerCase();
      if (!text.includes(search)) return false;
    }
    return true;
  }).map(n => n.id);

  // filter edges
  const filteredEdges = allData.edges.get().filter(e => 
    visible.includes(e.from) && visible.includes(e.to)
  ).map(e => e.id);

  // apply
  network.setData({
    nodes: allData.nodes.get().filter(n => visible.includes(n.id)),
    edges: allData.edges.get().filter(e => filteredEdges.includes(e.id))
  });
}

function exportPNG() {
  const canvas = document.querySelector('#mynetwork canvas');
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'network.png';
    a.click();
  });
}
