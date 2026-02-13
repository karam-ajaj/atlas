import { useEffect, useState } from "react";
import { apiGet } from "../api";

function formatAgo(timestamp) {
  if (!timestamp) return "Never";
  const then = new Date(timestamp);
  const diff = Math.floor((Date.now() - then.getTime()) / 60000);
  if (diff < 1) return "Just now";
  return `${diff} minute${diff === 1 ? "" : "s"} ago`;
}

export function useScanStatus() {
  const [status, setStatus] = useState({ fast: null, deep: null, docker: null });

  useEffect(() => {
    apiGet("/scripts/last-scan-status")
      .then((data) => setStatus(data))
      .catch(() => setStatus({}));
  }, []);

  return {
    fast: formatAgo(status.fast),
    deep: formatAgo(status.deep),
    docker: formatAgo(status.docker),
  };
}
