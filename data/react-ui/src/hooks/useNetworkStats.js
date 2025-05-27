import { useEffect, useState } from "react";

function getSubnet(ip) {
  return ip.split(".").slice(0, 3).join(".");
}

export function useNetworkStats() {
  const [stats, setStats] = useState({
    total: 0,
    docker: 0,
    normal: 0,
    subnets: 0,
    duplicateIps: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("https://atlas-api.vnerd.nl/hosts");
        const json = await res.json();
        const [normalHosts, dockerHosts] = json;

        const all = [
          ...normalHosts.map(([_, ip]) => ({ ip, group: "normal" })),
          ...dockerHosts.map(([_, ip]) => ({ ip, group: "docker" })),
        ];

        const total = all.length;
        const docker = dockerHosts.length;
        const normal = normalHosts.length;

        const subnets = new Set(all.map((h) => getSubnet(h.ip)));
        const seen = new Set();
        const duplicates = new Set();

        all.forEach(({ ip }) => {
          if (seen.has(ip)) duplicates.add(ip);
          seen.add(ip);
        });

        setStats({
          total,
          docker,
          normal,
          subnets: subnets.size,
          duplicateIps: duplicates.size,
        });
      } catch (err) {
        console.error("Failed to fetch network stats", err);
      }
    }

    fetchStats();
  }, []);

  return stats;
}
