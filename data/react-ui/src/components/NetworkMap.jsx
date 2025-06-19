import { useEffect, useRef, useState } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import { SelectedNodePanel } from "./SelectedNodePanel";
// import { NetworkSettingsPanel } from "./NetworkSettingsPanel";


function getSubnet(ip) {
  return ip.split(".").slice(0, 3).join(".");
}

function getHubColor(subnet) {
  if (subnet.startsWith("192.168")) return "#60a5fa";
  if (subnet.startsWith("10.")) return "#34d399";
  if (subnet.startsWith("172.17")) return "#f97316";
  return "#9ca3af";
}

function getHubId(subnet) {
  return `subnet-${subnet}`;
}

export function NetworkMap() {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [nodeInfoMap, setNodeInfoMap] = useState({});
  const [filters, setFilters] = useState({ subnet: "", group: "", name: "" });
  const [rawData, setRawData] = useState({ nonDockerHosts: [], dockerHosts: [] });
  const [externalNode, setExternalNode] = useState(null);
  const [selectedSubnet, setSelectedSubnet] = useState(null);
  const [layoutStyle, setLayoutStyle] = useState("default");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/hosts");
        const json = await res.json();
        const [nonDockerHosts, dockerHosts] = json;
        setRawData({ nonDockerHosts, dockerHosts });
        try {
  const extRes = await fetch("/api/external");
  const extJson = await extRes.json();
  if (extJson && extJson.length >= 2) {
    setExternalNode({ id: extJson[0], ip: extJson[1] }); // [id, public_ip]
  }
} catch (e) {
  console.warn("No external node detected.");
}

      } catch (err) {
        console.error("Error loading host data:", err);
        setError("Failed to load network data.");
      }
    }
    fetchData();
  }, []);

useEffect(() => {
  if (!rawData.nonDockerHosts.length && !rawData.dockerHosts.length) return;

  const nodes = new DataSet();
  const edges = new DataSet();
  const infoMap = {};
  const subnetMap = new Map();
  const nexthopLinks = new Set();
  const hostIpToNodeId = new Map();
  const seenNetworks = new Set();

  const matchingNodeIds = new Set();


  const ensureSubnetHub = (subnet, networkName = null) => {
    const hubId = getHubId(subnet);
    if (!subnetMap.has(subnet)) {
      subnetMap.set(subnet, []);
      nodes.add({
        id: hubId,
        label: networkName ? `${networkName}` : `${subnet}.x`,
        shape: "box",
        color: getHubColor(subnet),
        font: { size: 14, color: "#000" },
        level: 1, // 👈 Keep it below Internet
      });
    }
    return hubId;
  };

const ensureNetworkNode = (networkName, hostIp) => {
  const networkId = `network-${networkName}`;
  if (seenNetworks.has(networkId)) return networkId;

  // Infer subnet from nexthop if available
  let inferredSubnet = hostIp ? getSubnet(hostIp) : "unknown";

  // const networkId = `network-${networkName}`;
if (!seenNetworks.has(networkId) && !nodes.get(networkId)) {
  nodes.add({
    id: networkId,
    label: networkName,
    shape: "box",
    color: "#10b981", // Tailwind green
    font: { size: 12, color: "#000" },
    level: 3,
  });}

  // Attach to host if known
  if (hostIp && hostIpToNodeId.has(hostIp)) {
    const hostNodeId = hostIpToNodeId.get(hostIp);
    edges.add({ from: hostNodeId, to: networkId });
  }

  // 👉 Save subnet info for this network node
  nodeInfoMap[networkId] = {
    name: networkName,
    subnet: inferredSubnet,
    group: "network",
  };

  seenNetworks.add(networkId);
  return networkId;
};



const addHost = (id, ip, name, os, group, ports, mac = "", nexthop, network_name, last_seen = "") => {
  // Guard invalid IPs
  if (!ip || ip === "Unknown" || !ip.includes(".")) return;

  const subnet = getSubnet(ip);
  const nodeId = `${group[0]}-${id}-${ip}`;
  const level = group === "docker" ? 4 : 2;

  // Avoid duplicates
  if (!nodes.get(nodeId)) {
    nodes.add({
      id: nodeId,
      label: `${name.split(".").slice(0, 2).join(".")}`,
      title: `${os}\nPorts: ${ports}`,
      group,
      level,
    });
  }

const nameMatch = !filters.name || name.toLowerCase().includes(filters.name.toLowerCase());
const groupMatch = !filters.group || group === filters.group;
const subnetMatch = !filters.subnet || subnet.startsWith(filters.subnet);

const visible = groupMatch && subnetMatch;
if (!visible) return;

if (filters.name && nameMatch) {
  matchingNodeIds.add(`${group[0]}-${id}-${ip}`);
}


  const hubId = group === "normal" ? ensureSubnetHub(subnet) : null;

  if (group === "normal") {
    edges.add({ from: hubId, to: nodeId });
    hostIpToNodeId.set(ip, nodeId);
  } else if (group === "docker") {
    const networkId = ensureNetworkNode(network_name, nexthop);
    if (networkId) {
      edges.add({ from: networkId, to: nodeId });
    }
  }

  infoMap[nodeId] = {
    name,
    ip,
    os,
    group,
    subnet,
    ports,
    mac,
    nexthop,
    network_name,
    last_seen,
  };

  // Inter-subnet links
  if (group === "normal" && nexthop && nexthop !== "unknown" && nexthop.includes(".")) {
    const hopSubnet = getSubnet(nexthop);
    const toHub = ensureSubnetHub(hopSubnet);
    const fromHub = hubId;
    const edgeKey = `${fromHub}->${toHub}`;

    if (fromHub !== toHub && !nexthopLinks.has(edgeKey)) {
      edges.add({
        id: edgeKey,
        from: fromHub,
        to: toHub,
        dashes: true,
        color: { color: "#3b82f6" },
        arrows: { to: { enabled: true } },
        title: `Route: ${subnet}.x → ${hopSubnet}.x`,
      });
      nexthopLinks.add(edgeKey);
    }
  }
};


  rawData.nonDockerHosts.forEach(([id, ip, name, os, mac, ports, nexthop, network_name, last_seen]) =>
    addHost(id, ip, name, os, "normal", ports, mac, nexthop, network_name, last_seen)
  );

  rawData.dockerHosts.forEach(([id, ip, name, os, mac, ports, nexthop, network_name, last_seen]) =>
    addHost(id, ip, name, os, "docker", ports, mac, nexthop, network_name, last_seen)
  );

  // Add Internet node if external IP is known
if (externalNode?.ip) {
  const extId = "internet-node";
  nodes.add({
    id: extId,
    label: `Internet\n(${externalNode.ip})`,
    shape: "box",
    color: "#f43f5e",
    font: { size: 12, color: "#000" },
    level: 0,
  });

  const allHosts = [...rawData.nonDockerHosts, ...rawData.dockerHosts];
  const gatewayCandidates = allHosts
    .map(h => h[6])
    .filter(ip => ip && ip.includes(".") && ip !== "unknown");

  if (gatewayCandidates.length > 0) {
    const detectedSubnet = getSubnet(gatewayCandidates[0]);
    const hubId = getHubId(detectedSubnet);

    if (nodes.get(hubId)) {
      edges.add({
        from: hubId,
        to: extId,
        arrows: "to",
        dashes: true,
        color: { color: "#f43f5e" },
        title: `Internet access via ${externalNode.ip}`,
      });
    }
  }

  nodeInfoMap[extId] = {
    name: "Internet",
    ip: externalNode.ip,
    os: "Public Gateway",
    group: "external",
    subnet: "external",
    ports: "N/A",
    mac: "",
    nexthop: "",
    network_name: "Internet",
    last_seen: "",
  };
}



for (const nodeId of matchingNodeIds) {
  if (nodes.get(nodeId)) {
    nodes.update({
      id: nodeId,
      color: { background: "#facc15", border: "#f59e0b" }, // yellow highlight
      borderWidth: 3,
    });
  }
}
  setNodeInfoMap(infoMap);

  const layoutConfig =
    layoutStyle === "hierarchical"
      ? {
          hierarchical: {
            direction: "UD",
            sortMethod: "hubsize",
          },
        }
      : layoutStyle === "circular"
      ? {
          randomSeed: 2,
        }
      : { improvedLayout: true };

  const data = { nodes, edges };
  const options = {
    layout: layoutConfig,
    physics: {
      stabilization: true,
      barnesHut: {
        gravitationalConstant: -3000,
        springLength: 140,
        springConstant: 0.05,
      },
    },
    nodes: { shape: "dot", size: 16, font: { size: 12 } },
    edges: {
      arrows: "to",
      smooth: true,
      color: { color: "#aaa" },
    },
    interaction: { hover: true },
    groups: {
      docker: { color: { background: "#34d399" } },
      normal: { color: { background: "#60a5fa" } },
    },
  };

  if (containerRef.current) {
    const net = new Network(containerRef.current, data, options);
    net.on("click", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        if (infoMap[nodeId]) {
          setSelectedNode(infoMap[nodeId]);
          setSelectedRoute(null);
          setSelectedSubnet(null);
        } else if (nodeId?.startsWith("subnet-")) {
          setSelectedSubnet({
            subnet: nodeId.replace("subnet-", ""),
            label: nodes.get(nodeId)?.label,
          });
          setSelectedNode(null);
          setSelectedRoute(null);
        }
      } else if (params.edges.length > 0) {
        const edgeId = params.edges[0];
        if (edgeId.includes("->")) {
          const [fromHub, toHub] = edgeId.replace("subnet-", "").split("->");
          setSelectedRoute({ from: `${fromHub}.x`, to: `${toHub}.x` });
          setSelectedNode(null);
        }
      } else {
        setSelectedNode(null);
        setSelectedRoute(null);
      }
    });
    networkRef.current = net;
  }
}, [rawData, filters, layoutStyle, externalNode]);



  return (
    <div className="relative w-full h-full bg-white border rounded p-4">
      <h2 className="text-lg font-semibold mb-2">Network Map</h2>

      {/* Layout Selector */}
      <div className="flex space-x-4 mb-4">
        <select
          value={layoutStyle}
          onChange={(e) => setLayoutStyle(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="default">Default Layout</option>
          <option value="hierarchical">Hierarchical</option>
          <option value="circular">Circular</option>
        </select>

        {/* Existing filters */}
        <input
          type="text"
          placeholder="Filter by name"
          value={filters.name}
          onChange={(e) => setFilters({ ...filters, name: e.target.value })}
          className="border p-1 rounded"
        />
        <select
          value={filters.group}
          onChange={(e) => setFilters({ ...filters, group: e.target.value })}
          className="border p-1 rounded"
        >
          <option value="">All Groups</option>
          <option value="docker">Docker</option>
          <option value="normal">Normal</option>
        </select>
        <input
          type="text"
          placeholder="Filter by subnet (e.g. 10.0.1)"
          value={filters.subnet}
          onChange={(e) => setFilters({ ...filters, subnet: e.target.value })}
          className="border p-1 rounded"
        />
      </div>

      {error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <>
          <div ref={containerRef} className="w-full h-[80vh] bg-gray-200 rounded" />
          <SelectedNodePanel node={selectedNode} route={selectedRoute} subnet={selectedSubnet} />
          <div className="absolute bottom-4 right-4 bg-white border shadow rounded p-3 text-sm z-10 w-64">
            <h3 className="font-semibold mb-2">Legend</h3>
            <ul className="space-y-1">
              <li><span className="inline-block w-3 h-3 bg-blue-400 mr-2 rounded-full"></span>Normal Host</li>
              <li><span className="inline-block w-3 h-3 bg-green-400 mr-2 rounded-full"></span>Docker Host</li>
              <li><span className="inline-block w-3 h-3 bg-orange-400 mr-2 rounded"></span>Subnet Hub</li>
              <li><span className="inline-block w-4 border-t-2 border-dashed border-blue-400 mr-2 align-middle"></span> Inter-subnet Route</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}