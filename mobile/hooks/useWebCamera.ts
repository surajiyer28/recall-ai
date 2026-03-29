import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

interface UseWebCameraOpts {
  video?: boolean;
  audio?: boolean;
}

export function useWebCamera({ video = true, audio = false }: UseWebCameraOpts = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(
    async (facing?: "environment" | "user") => {
      if (Platform.OS !== "web") {
        setError("Camera is only supported on web");
        return null;
      }
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      try {
        const mode = facing ?? facingMode;
        const constraints: MediaStreamConstraints = {
          audio,
          video: video ? { facingMode: { ideal: mode } } : false,
        };
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = s;
        setStream(s);
        setError(null);
        return s;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Camera access denied";
        setError(msg);
        return null;
      }
    },
    [video, audio, facingMode]
  );

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  const switchCamera = useCallback(async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    if (streamRef.current) {
      return start(next);
    }
    return null;
  }, [facingMode, start]);

  return { stream, error, start, stop, switchCamera, facingMode };
}
