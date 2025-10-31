import React, { useEffect, useState } from "react";

// Fallback build-info shipped with repository (used during dev when /build-info.json
// isn't served at root). This file exists at `data/html/build-info.json`.
import fallbackBuildInfo from "../../../html/build-info.json";

export default function BuildTag({ prefix = "v" }) {
  const [tag, setTag] = useState("");

  useEffect(() => {
    let aborted = false;

    // Try the expected public path first, then fall back to the repo copy.
    fetch("/build-info.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (aborted) return;
        const version = json?.version || fallbackBuildInfo?.version || "";
        setTag(version);
      })
      .catch(() => {
        if (!aborted) setTag(fallbackBuildInfo?.version || "");
      });

    return () => { aborted = true; };
  }, []);

  if (!tag) return null;
  return <span className="text-xs text-gray-400">{prefix}{tag}</span>;
}