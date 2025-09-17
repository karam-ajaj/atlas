import React, { useEffect, useState } from "react";

export default function BuildTag({ prefix = "v" }) {
  const [tag, setTag] = useState("");

  useEffect(() => {
    let aborted = false;
    fetch("/build-info.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!aborted) setTag(json?.version || "");
      })
      .catch(() => {
        if (!aborted) setTag("");
      });
    return () => { aborted = true; };
  }, []);

  if (!tag) return null;
  return <span className="text-xs text-gray-400">{prefix}{tag}</span>;
}