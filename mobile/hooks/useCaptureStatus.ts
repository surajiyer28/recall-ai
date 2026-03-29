import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import type { CaptureStatus } from "../lib/types";

const POLL_INTERVAL = 5_000;

export function useCaptureStatus() {
  const [status, setStatus] = useState<CaptureStatus>({
    capture_status: "active",
    active_session_id: null,
  });
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      setStatus(await api.getCaptureStatus());
    } catch {
      // keep last known status
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch]);

  const pause = useCallback(async () => {
    const s = await api.pauseCapture();
    setStatus(s);
  }, []);

  const resume = useCallback(async () => {
    const s = await api.resumeCapture();
    setStatus(s);
  }, []);

  return { ...status, loading, pause, resume, refetch: fetch };
}
