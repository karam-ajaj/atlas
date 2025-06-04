import { useEffect, useRef, useState } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import { SelectedNodePanel } from "./SelectedNodePanel";
import { NetworkSettingsPanel } from "./NetworkSettingsPanel";


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
  const [selectedSubnet, setSelectedSubnet] = useState(null);
  const [layoutStyle, setLayoutStyle] = useState("default");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("https://atlas-api.vnerd.nl/hosts");
        const json = await res.json();
        const [nonDockerHosts, dockerHosts] = json;
        setRawData({ nonDockerHosts, dockerHosts });
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
    const hostMap = new Map();
    const networkMap = new Map();
    const nexthopLinks = new Set();

    const getSubnet = (ip) => ip.split(".").slice(0, 3).join(".");
    const getHubColor = (subnet) => {
      if (subnet.startsWith("192.168")) return "#60a5fa";
      if (subnet.startsWith("10.")) return "#34d399";
      if (subnet.startsWith("172.17")) return "#f97316";
      return "#9ca3af";
    };

    const ensureSubnetHub = (subnet) => {
      const id = `subnet-${subnet}`;
      if (!subnetMap.has(subnet)) {
        subnetMap.set(subnet, true);
        nodes.add({
          id,
          label: `${subnet}.x`,
          shape: "box",
          color: getHubColor(subnet),
          font: { size: 14, color: "#000" },
        });
      }
      return id;
    };

    const ensureHostNode = (ip) => {
      const id = `host-${ip}`;
      if (!hostMap.has(ip)) {
        hostMap.set(ip, true);
        const parent = ensureSubnetHub(getSubnet(ip));
        nodes.add({
          id,
          label: ip,
          shape: "box",
          color: "#fbbf24",
          font: { size: 13, color: "#000" },
        });
        edges.add({ from: parent, to: id });
      }
      return id;
    };

    const ensureNetworkNode = (networkName, hostIp) => {
      const id = `net-${hostIp}-${networkName}`;
      const key = `${hostIp}-${networkName}`;
      if (!networkMap.has(key)) {
        networkMap.set(key, true);
        const parent = ensureHostNode(hostIp);
        nodes.add({
          id,
          label: networkName,
          shape: "box",
          color: "#10b981",
          font: { size: 12, color: "#000" },
        });
        edges.add({ from: parent, to: id });
      }
      return id;
    };

    const addHost = (id, ip, name, os, group, ports, mac = "", nexthop, network_name, last_seen = "") => {
      const subnet = getSubnet(ip);
      const nodeId = `${group[0]}-${id}`;

      const matchFilters =
        (!filters.name || name.toLowerCase().includes(filters.name.toLowerCase())) &&
        (!filters.group || group === filters.group) &&
        (!filters.subnet || subnet.startsWith(filters.subnet));

      if (!matchFilters) return;

      let parentId;
      if (group === "docker" && nexthop && nexthop.includes(".")) {
        parentId = ensureNetworkNode(network_name, nexthop);
      } else {
        parentId = ensureSubnetHub(subnet);
      }

      nodes.add({
        id: nodeId,
        label: `${name.split(".").slice(0, 2).join(".")}`,
        title: `${os}\nPorts: ${ports}`,
        group,
      });

      edges.add({ from: parentId, to: nodeId });

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

      // Show routing
      if (group === "docker" && nexthop && nexthop !== "unknown" && nexthop.includes(".")) {
        const fromSubnet = getSubnet(ip);
        const toSubnet = getSubnet(nexthop);
        const fromHub = ensureSubnetHub(fromSubnet);
        const toHub = ensureSubnetHub(toSubnet);
        const key = `${fromHub}->${toHub}`;

        if (fromHub !== toHub && !nexthopLinks.has(key)) {
          edges.add({
            id: key,
            from: fromHub,
            to: toHub,
            dashes: true,
            color: { color: "#3b82f6" },
            arrows: { to: { enabled: true } },
            title: `Route: ${fromSubnet}.x → ${toSubnet}.x`,
          });
          nexthopLinks.add(key);
        }
      }
    };

    rawData.nonDockerHosts.forEach(([id, ip, name, os, mac, ports, nexthop, network_name, last_seen]) =>
      addHost(id, ip, name, os, "normal", ports, mac, nexthop, network_name, last_seen)
    );

    rawData.dockerHosts.forEach(([id, ip, name, os, mac, ports, nexthop, network_name, last_seen]) =>
      addHost(id, ip, name, os, "docker", ports, mac, nexthop, network_name, last_seen)
    );

    setNodeInfoMap(infoMap);

    const layoutConfig =
      layoutStyle === "hierarchical"
        ? { hierarchical: { direction: "UD", sortMethod: "hubsize" } }
        : layoutStyle === "circular"
        ? { randomSeed: 2 }
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
  }, [rawData, filters, layoutStyle]);

  return (
    <div className="relative w-full h-full bg-white border rounded p-4">
      <h2 className="text-lg font-semibold mb-2">Network Map</h2>
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
              <li><span className="inline-block w-3 h-3 bg-yellow-400 mr-2 rounded"></span>Docker Host IP</li>
              <li><span className="inline-block w-3 h-3 bg-orange-400 mr-2 rounded"></span>Subnet Hub</li>
              <li><span className="inline-block w-4 border-t-2 border-dashed border-blue-400 mr-2 align-middle"></span> Inter-subnet Route</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
