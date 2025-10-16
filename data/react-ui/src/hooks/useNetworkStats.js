import { useEffect, useState } from "react";
import { apiGet } from "../api";

/*
  Improved stats:
  - Count docker containers as unique by container_id (fallback name/id)
  - For duplicate IPs, use one canonical IP per docker container (first found) + unique normal host IPs
  - Provide dockerRunning/dockerStopped/total counts
*/

function getSubnet(ip = "") {
  if (!ip || typeof ip !== "string") return "";
  const parts = ip.split(".");
  return parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : "";
}

function looksLikeIp(v) {
  if (!v || typeof v !== "string") return false;
  const parts = v.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d+$/.test(p));
}

function findIpInRow(row = []) {
  for (const cell of row) {
    if (looksLikeIp(String(cell || ""))) return String(cell || "");
  }
  return "";
}

function findOnlineStatusInRow(row = []) {
  // common positions: hosts: r[9], docker: r[10]; fallback scanning
  const candidates = [row[10], row[9], row[row.length - 1]];
  for (const c of candidates) {
    if (!c) continue;
    const s = String(c).toLowerCase();
    if (s === "online" || s === "running") return "online";
    if (s === "offline" || s === "stopped") return "offline";
  }
  for (const c of row) {
    if (!c) continue;
    const s = String(c).toLowerCase();
    if (s === "online" || s === "running") return "online";
    if (s === "offline" || s === "stopped") return "offline";
  }
  return "unknown";
}

export function useNetworkStats(pollIntervalMs = 5000) {
  const [stats, setStats] = useState({
    total: 0,
    docker: 0,
    dockerRunning: 0,
    dockerStopped: 0,
    normal: 0,
    subnets: 0,
    duplicateIps: 0,
    updatedAt: null,
  });

  useEffect(() => {
    let mounted = true;
    let timer = null;

    async function load() {
      try {
        const json = await apiGet("/hosts");
        if (!mounted) return;

        const normalRows = Array.isArray(json?.[0]) ? json[0] : [];
        const dockerRows = Array.isArray(json?.[1]) ? json[1] : [];

        // Normal unique IPs (hosts table)
        const normalIpsList = normalRows
          .map((r) => {
            const cand = r[1];
            if (looksLikeIp(String(cand || ""))) return String(cand || "");
            return findIpInRow(r);
          })
          .filter(Boolean);
        const normalUniqueIps = new Set(normalIpsList);

        // Build canonical container map: containerKey -> { ip, statuses: [] }
        // containerKey prefers container_id (r[1] in migrated schema) else name (r[3]) else id (r[0])
        const containerMap = new Map();
        dockerRows.forEach((r) => {
          const maybeContainerId = String(r[1] ?? "");
          let containerKey = "";
          if (maybeContainerId && !looksLikeIp(maybeContainerId)) containerKey = maybeContainerId;
          else if (r[3]) containerKey = String(r[3]);
          else containerKey = String(r[0] ?? "");
          if (!containerKey) return;

          // pick ip: prefer r[2] (migrated docker ip), fallback to r[1], then scan
          let ipCandidate = "";
          if (looksLikeIp(String(r[2] ?? ""))) ipCandidate = String(r[2]);
          else if (looksLikeIp(String(r[1] ?? ""))) ipCandidate = String(r[1]);
          else ipCandidate = findIpInRow(r);

          const status = findOnlineStatusInRow(r); // online|offline|unknown

          if (!containerMap.has(containerKey)) {
            containerMap.set(containerKey, { ip: ipCandidate || null, statuses: [] });
          }
          const entry = containerMap.get(containerKey);
          // Use first non-empty ip as canonical ip
          if (!entry.ip && ipCandidate) entry.ip = ipCandidate;
          entry.statuses.push(status);
        });

        // Now compute docker counts and canonical IP set per container
        const uniqueDockerContainers = Array.from(containerMap.keys());
        let running = 0;
        let stopped = 0;
        const dockerCanonicalIps = [];
        uniqueDockerContainers.forEach((k) => {
          const { ip, statuses } = containerMap.get(k) || { ip: null, statuses: [] };
          // decide status: if any online -> running, else if any offline -> stopped, else unknown->stopped by default
          if (statuses.some((s) => s === "online")) running += 1;
          else if (statuses.some((s) => s === "offline")) stopped += 1;
          else stopped += 1; // treat unknown as stopped (change if desired)
          if (ip) dockerCanonicalIps.push(ip);
        });

        // All IPs used for duplicate counting: normalUniqueIps + dockerCanonicalIps
        const allIpsForDup = [
          ...Array.from(normalUniqueIps),
          ...dockerCanonicalIps,
        ].filter(Boolean);

        const uniqueIps = new Set(allIpsForDup);
        const uniqueSubnets = new Set(Array.from(uniqueIps).map(getSubnet).filter(Boolean));
        const duplicateIps = Math.max(0, allIpsForDup.length - uniqueIps.size);

        const normalCount = normalUniqueIps.size;
        const dockerCount = uniqueDockerContainers.length;
        const total = normalCount + dockerCount;

        setStats({
          total,
          docker: dockerCount,
          dockerRunning: running,
          dockerStopped: stopped,
          normal: normalCount,
          subnets: uniqueSubnets.size,
          duplicateIps,
          updatedAt: new Date().toLocaleString(),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("useNetworkStats: failed to load hosts", err);
      }
    }

    load();
    timer = setInterval(load, pollIntervalMs);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [pollIntervalMs]);

  return stats;
}

export default useNetworkStats;