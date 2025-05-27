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

export function NetworkMap({ onNodeSelect }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
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

        const getSubnetHubId = (subnet) => `subnet-${subnet}`;

        const addHost = (id, ip, name, os, group, ports = "N/A") => {
          const subnet = getSubnet(ip);
          const nodeId = `${group[0]}-${id}`;
          const hubId = getSubnetHubId(subnet);

          if (!subnetMap.has(subnet)) {
            subnetMap.set(subnet, []);
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
          };
        };

        nonDockerHosts.forEach(([id, ip, name, os, _, ports]) => {
          addHost(id, ip, name, os, "normal", ports);
        });

        dockerHosts.forEach(([id, ip, name, os, _mac, ports]) => {
          addHost(id, ip, name, os, "docker", ports);
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
          groups: {
            docker: { color: { background: "#34d399" } },
            normal: { color: { background: "#60a5fa" } },
          },
        };

        if (containerRef.current) {
          const net = new Network(containerRef.current, data, options);
          net.on("click", (params) => {
            const nodeId = params.nodes[0];
            if (nodeId && infoMap[nodeId]) {
              const node = infoMap[nodeId];
              setSelectedNode(node);
              onNodeSelect?.(node);
            } else {
              setSelectedNode(null);
              onNodeSelect?.(null);
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
  }, [onNodeSelect]);

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
