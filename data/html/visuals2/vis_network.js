
let network, allData = { nodes: [], edges: [] };
const apiUrl = "http://192.168.2.81:8889/hosts";

async function fetchAndBuildNetwork() {
  const res = await fetch(apiUrl);
  const data = await res.json();
  const [normalHosts, dockerHosts] = data;

  const nodes = [];
  const edges = [];
  let idCounter = 1;

  const subnetMap = {};

  function addNode(host, type) {
    const ip = host[1];
    const name = host[2];
    const os = host[3];
    const mac = host[4];
    const ports = host[5];
    const subnet = ip.split('.').slice(0, 3).join('.') + '.0';

    if (!subnetMap[subnet]) {
      subnetMap[subnet] = `subnet-${subnet}`;
      nodes.push({
        id: subnetMap[subnet],
        label: subnet,
        group: "subnet",
        value: 1
      });
    }

    const nodeId = idCounter++;
    nodes.push({
      id: nodeId,
      label: ip,
      group: type === "docker" ? "server" : "desktop",
      title: `
        <b>${name}</b><br>
        IP: ${ip}<br>
        OS: ${os}<br>
        MAC: ${mac}<br>
        Ports: ${ports}<br>
        Type: ${type}
      `,
      os, mac, ports, name, type, subnet, ip
    });

    edges.push({ from: subnetMap[subnet], to: nodeId });
  }

  normalHosts.forEach(h => addNode(h, "normal"));
  dockerHosts.forEach(h => addNode(h, "docker"));

  allData.nodes = new vis.DataSet(nodes);
  allData.edges = new vis.DataSet(edges);

  renderNetwork();
  populateFilters();
}

function renderNetwork() {
  const container = document.getElementById("mynetwork");
  const options = {
    interaction: { hover: true },
    nodes: {
      shape: "dot",
      size: 12
    },
    groups: {
      desktop: { shape: "dot", color: "#2B7CE9" },
      server: { shape: "square", color: "#C5000B" },
      subnet: { shape: "box", color: "#888" }
    },
    edges: {
      smooth: false
    },
    physics: {
      stabilization: false,
      barnesHut: { gravitationalConstant: -20000 }
    }
  };

  network = new vis.Network(container, allData, options);

  network.on("hoverNode", params => {
    const node = allData.nodes.get(params.node);
    document.getElementById("mynetwork").title = node.title;
  });
  network.on("blurNode", () => {
    document.getElementById("mynetwork").title = "";
  });
}

function populateFilters() {
  const osSet = new Set();
  const subnetSet = new Set();
  const typeSet = new Set();

  allData.nodes.get().forEach(n => {
    if (n.os) osSet.add(n.os);
    if (n.subnet) subnetSet.add(n.subnet);
    if (n.type) typeSet.add(n.type);
  });

  const osSelect = document.getElementById("filter-os");
  const subnetSelect = document.getElementById("filter-subnet");
  const typeSelect = document.getElementById("filter-type");

  function populate(select, values) {
    select.innerHTML = '<option value="">All</option>';
    values.forEach(val => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      select.appendChild(opt);
    });
  }

  populate(osSelect, Array.from(osSet));
  populate(subnetSelect, Array.from(subnetSet));
  populate(typeSelect, Array.from(typeSet));
}

function applyFilters() {
  const os = document.getElementById("filter-os").value;
  const subnet = document.getElementById("filter-subnet").value;
  const type = document.getElementById("filter-type").value;

  const visibleNodeIds = allData.nodes.get().filter(n => {
    return (!os || n.os === os) &&
           (!subnet || n.subnet === subnet) &&
           (!type || n.type === type);
  }).map(n => n.id);

  const edgeIds = allData.edges.get().filter(e => {
    return visibleNodeIds.includes(e.from) && visibleNodeIds.includes(e.to);
  }).map(e => e.id);

  network.setData({
    nodes: new vis.DataSet(allData.nodes.get().filter(n => visibleNodeIds.includes(n.id))),
    edges: new vis.DataSet(allData.edges.get().filter(e => edgeIds.includes(e.id)))
  });
}

document.getElementById("filter-os").addEventListener("change", applyFilters);
document.getElementById("filter-subnet").addEventListener("change", applyFilters);
document.getElementById("filter-type").addEventListener("change", applyFilters);

fetchAndBuildNetwork();
