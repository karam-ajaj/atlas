import { useEffect, useRef } from "react";

/**
 * Lightweight EventSource hook with auto-open/close and a controller.
 * options:
 *  - enabled: boolean
 *  - onOpen: () => void
 *  - onMessage: (line: string) => void
 *  - onError: (err?: any) => void
 *
 * Returns:
 *  { close: () => void, isOpen: () => boolean }
 */
export default function useEventSource(url, { enabled, onOpen, onMessage, onError } = {}) {
  const esRef = useRef(null);

  useEffect(() => {
    if (!enabled || !url) return;

    let es = null;
    try {
      es = new EventSource(url);
      esRef.current = es;
    } catch (e) {
      esRef.current = null;
      onError?.(e);
      return;
    }

    es.onopen = () => onOpen?.();
    es.onmessage = (e) => onMessage?.(e.data);
    es.onerror = (e) => onError?.(e);

    return () => {
      try { es?.close(); } catch {}
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  return {
    close: () => {
      try { esRef.current?.close(); } catch {}
      esRef.current = null;
    },
    isOpen: () => !!esRef.current,
  };
}