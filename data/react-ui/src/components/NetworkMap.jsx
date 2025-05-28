
import { useEffect, useRef, useState } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import { SelectedNodePanel } from "./SelectedNodePanel";

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

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("https://atlas-api.vnerd.nl/hosts");
        const json = await res.json();

        const [nonDockerHosts, dockerHosts] = json;

        const nodes = new DataSet();
        const edges = new DataSet();
        const infoMap = {};
        const subnetMap = new Map();
        const nexthopLinks = new Set();

        const ensureSubnetHub = (subnet) => {
          const hubId = getHubId(subnet);
          if (!subnetMap.has(subnet)) {
            subnetMap.set(subnet, []);
            nodes.add({
              id: hubId,
              label: `Subnet ${subnet}.x`,
              shape: "box",
              color: getHubColor(subnet),
              font: { size: 14, color: "#000" },
            });
          }
          return hubId;
        };

        const addHost = (id, ip, name, os, group, ports = "N/A", nexthop = "unknown") => {
          const subnet = getSubnet(ip);
          const nodeId = `${group[0]}-${id}`;
          const hubId = ensureSubnetHub(subnet);

          nodes.add({
            id: nodeId,
            label: `${name}\n${ip}`,
            title: `${os}\nPorts: ${ports}`,
            group,
          });

          edges.add({ from: hubId, to: nodeId });

          infoMap[nodeId] = {
            name,
            ip,
            os,
            group,
            subnet,
            ports,
            nexthop,
          };

          if (nexthop && nexthop !== "unknown" && nexthop.includes(".")) {
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

        nonDockerHosts.forEach(([id, ip, name, os, _, ports, nexthop]) => {
          addHost(id, ip, name, os, "normal", ports, nexthop);
        });

        dockerHosts.forEach(([id, ip, name, os, _mac, ports, nexthop]) => {
          addHost(id, ip, name, os, "docker", ports, nexthop);
        });

        setNodeInfoMap(infoMap);

        const data = { nodes, edges };
        const options = {
          layout: { improvedLayout: true },
          physics: {
            stabilization: true,
            barnesHut: {
              gravitationalConstant: -3000,
              springLength: 140,
              springConstant: 0.05,
            },
          },
          nodes: {
            shape: "dot",
            size: 16,
            font: { size: 12 },
          },
          edges: {
            arrows: "to",
            smooth: true,
            color: { color: "#aaa" },
          },
          interaction: {
            hover: true,
          },
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
              } else {
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
      } catch (err) {
        console.error("Error loading host data:", err);
        setError("Failed to load network data.");
      }
    }

    fetchData();
    return () => {
      networkRef.current?.destroy();
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-white border rounded p-4">
      <h2 className="text-lg font-semibold mb-2">Network Map</h2>
      {error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <>
          <div ref={containerRef} className="w-full h-[80vh] bg-gray-200 rounded" />
          <SelectedNodePanel node={selectedNode} route={selectedRoute} />
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
