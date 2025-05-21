let network, allData = { nodes: new vis.DataSet(), edges: new vis.DataSet() };

async function fetchData() {
  const response = await fetch('http://192.168.2.81:8889/hosts');
  const data = await response.json();
  const nodes = [];
  const edges = [];
  const subnets = new Map();
  let idCounter = 1;

  const parseSubnet = ip => ip.split('.').slice(0, 3).join('.') + '.0';

  const addNode = (host, type) => {
    const id = idCounter++;
    const ip = host[1];
    const subnet = parseSubnet(ip);
    const node = {
      id, label: host[2], title: ip,
      group: type === 'docker' ? 'server' : 'desktop',
      ip, os: host[3], mac: host[4], ports: host[5], type, subnet
    };
    nodes.push(node);

    if (!subnets.has(subnet)) {
      const subnetId = 10000 + subnets.size;
      subnets.set(subnet, subnetId);
      nodes.push({
        id: subnetId, label: subnet, group: 'switch',
        shape: 'triangle', color: '#FF9900', subnet
      });
    }
    edges.push({ from: subnets.get(subnet), to: id });
  };

  data[0].forEach(host => addNode(host, 'normal'));
  data[1].forEach(host => addNode(host, 'docker'));

  allData = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
  populateFilters(nodes);
  renderNetwork();
}

function renderNetwork() {
  const container = document.getElementById('mynetwork');
  const selectedType = document.getElementById('filterType').value;
  const selectedOS = document.getElementById('filterOS').value;
  const selectedSubnet = document.getElementById('filterSubnet').value;

  const filteredNodes = allData.nodes.get().filter(node => {
    if (node.group === 'switch') return true;
    return (!selectedType || node.type === selectedType) &&
           (!selectedOS || node.os === selectedOS) &&
           (!selectedSubnet || node.subnet === selectedSubnet);
  });

  const filteredEdges = allData.edges.get().filter(edge =>
    filteredNodes.find(n => n.id === edge.from) &&
    filteredNodes.find(n => n.id === edge.to)
  );

  network = new vis.Network(container, {
    nodes: new vis.DataSet(filteredNodes),
    edges: new vis.DataSet(filteredEdges)
  }, {
    interaction: { hover: true },
    physics: { stabilization: false },
    groups: {
      switch: { shape:'triangle', color:'#FF9900' },
      desktop:{ shape:'dot', color:'#2B7CE9' },
      server:{ shape:'square', color:'#C5000B' },
    },
    nodes: { shape:'dot', size:16 },
    edges: { font:{ align:'middle' }, smooth:false }
  });

  network.on("hoverNode", params => {
    const node = allData.nodes.get(params.node);
    const title = `
      <b>${node.label}</b><br>
      Group: ${node.group}<br>
      IP: ${node.ip}<br>
      OS: ${node.os}<br>
      MAC: ${node.mac}<br>
      Ports: ${node.ports}
    `;
    network.canvas.body.container.setAttribute('title', title);
  });

  network.on("blurNode", () => {
    network.canvas.body.container.removeAttribute('title');
  });
}

function populateFilters(nodes) {
  const osSet = new Set();
  const subnetSet = new Set();
  nodes.forEach(n => {
    if (n.os) osSet.add(n.os);
    if (n.subnet) subnetSet.add(n.subnet);
  });

  const osSelect = document.getElementById('filterOS');
  const subnetSelect = document.getElementById('filterSubnet');
  osSelect.innerHTML = '<option value="">All OS</option>';
  subnetSelect.innerHTML = '<option value="">All Subnets</option>';

  [...osSet].sort().forEach(os => {
    osSelect.innerHTML += `<option value="${os}">${os}</option>`;
  });
  [...subnetSet].sort().forEach(subnet => {
    subnetSelect.innerHTML += `<option value="${subnet}">${subnet}</option>`;
  });

  osSelect.onchange = subnetSelect.onchange = document.getElementById('filterType').onchange = renderNetwork;
}

function exportPNG() {
  const canvas = document.querySelector('#mynetwork canvas');
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl; a.download = 'network.png'; a.click();
}

fetchData();
