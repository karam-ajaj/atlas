import { useEffect, useState } from "react";

export function useBuildInfo() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let aborted = false;
    fetch("/build-info.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!aborted) setInfo(json);
      })
      .catch(() => {
        if (!aborted) setInfo(null);
      });
    return () => { aborted = true; };
  }, []);

  // sensible defaults in dev
  return info || { version: "dev", commit: "", builtAt: "" };
}