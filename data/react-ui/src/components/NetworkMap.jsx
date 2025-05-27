import { useEffect, useRef, useState } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import { SelectedNodePanel } from "./SelectedNodePanel";

function getSubnet(ip) {
  return ip.split(".").slice(0, 3).join(".");
}

export function NetworkMap() {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [error, setError] = useState(null);
  const [nodesMap, setNodesMap] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("https://atlas-api.vnerd.nl/hosts");
        const json = await res.json();

        const [nonDockerHosts, dockerHosts] = json;
        const nodes = new DataSet();
        const edges = new DataSet();
        const subnetMap = new Map();
        const nodeInfoMap = {};

        const getSubnetHubId = (subnet) => `subnet-${subnet}`;

        const addHost = (id, ip, name, os, group) => {
          const subnet = getSubnet(ip);
          const nodeId = `${group[0]}-${id}`;
          const hubId = getSubnetHubId(subnet);

          if (!subnetMap.has(subnet)) {
            subnetMap.set(subnet, []);
            const getHubColor = (subnet) => {
  if (subnet.startsWith("192.168")) return "#60a5fa"; // blue
  if (subnet.startsWith("10.")) return "#34d399";     // green
  if (subnet.startsWith("172.17")) return "#f97316";  // orange
  return "#9ca3af"; // gray
};

nodes.add({
  id: hubId,
  label: `Subnet ${subnet}.x`,
  shape: "star",
  color: getHubColor(subnet),
  font: { size: 14, color: "#000" },
});

          }

          nodes.add({
            id: nodeId,
            label: `${name}\n${ip}`,
            title: os,
            group,
          });

          edges.add({ from: hubId, to: nodeId });

          nodeInfoMap[nodeId] = {
            id,
            name,
            ip,
            os,
            group,
            subnet,
          };
        };

        nonDockerHosts.forEach(([id, ip, name, os]) => {
          addHost(id, ip, name, os, "normal");
        });

        dockerHosts.forEach(([id, ip, name, os]) => {
          addHost(id, ip, name, os, "docker");
        });

        setNodesMap(nodeInfoMap);

        const data = { nodes, edges };
        const options = {
          layout: { improvedLayout: true },
          physics: {
            stabilization: true,
            barnesHut: {
              gravitationalConstant: -3000,
              springLength: 120,
              springConstant: 0.04,
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
          groups: {
            docker: { color: { background: "#34d399" } },
            normal: { color: { background: "#60a5fa" } },
          },
        };

        if (containerRef.current) {
          const net = new Network(containerRef.current, data, options);
          net.on("click", (params) => {
            const nodeId = params.nodes[0];
            if (nodeId && nodeInfoMap[nodeId]) {
              setSelectedNode(nodeInfoMap[nodeId]);
            } else {
              setSelectedNode(null);
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
          <SelectedNodePanel node={selectedNode} />
        </>
      )}
    </div>
  );
}
