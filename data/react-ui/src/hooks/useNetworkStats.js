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
    updatedAt: null,
  });

  useEffect(() => {
    let interval;

    async function fetchStats() {
      try {
        const res = await fetch("/api/hosts");
        const json = await res.json();

        const [normalHosts, dockerHosts] = json;

        const all = [
          ...normalHosts.map((host) => ({ ip: host[1], group: "normal" })),
          ...dockerHosts.map((host) => ({ ip: host[1], group: "docker" })),
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
          updatedAt: new Date().toLocaleTimeString(),
        });
      } catch (err) {
        console.error("❌ Failed to fetch /api/hosts", err);
      }
    }

    fetchStats(); // initial
    interval = setInterval(fetchStats, 5000); // every 5 sec

    return () => clearInterval(interval);
  }, []);

  return stats;
}
