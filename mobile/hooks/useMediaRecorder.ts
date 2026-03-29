import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

function pickMimeType(kind: "audio" | "video"): string {
  if (Platform.OS !== "web") return "";
  const candidates =
    kind === "audio"
      ? ["audio/webm;codecs=opus", "audio/webm"]
      : [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4",
        ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

interface UseMediaRecorderOpts {
  kind: "audio" | "video";
  chunkIntervalMs?: number;
  onChunk: (blob: Blob, index: number) => void;
}

export function useMediaRecorder({
  kind,
  chunkIntervalMs = 30_000,
  onChunk,
}: UseMediaRecorderOpts) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkIndexRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(
    (stream: MediaStream) => {
      if (Platform.OS !== "web") return;
      streamRef.current = stream;
      const mimeType = pickMimeType(kind);

      const startRecorder = () => {
        const opts: MediaRecorderOptions = {};
        if (mimeType) opts.mimeType = mimeType;
        const recorder = new MediaRecorder(stream, opts);

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            const idx = chunkIndexRef.current;
            chunkIndexRef.current += 1;
            setChunkCount(chunkIndexRef.current);
            onChunk(e.data, idx);
          }
        };

        recorder.start();
        recorderRef.current = recorder;
      };

      startRecorder();
      setIsRecording(true);
      setElapsed(0);
      chunkIndexRef.current = 0;
      setChunkCount(0);

      // Cycle stop/start every chunkIntervalMs for self-contained blobs
      intervalRef.current = setInterval(() => {
        const prev = recorderRef.current;
        if (prev && prev.state === "recording") {
          prev.stop(); // fires ondataavailable with complete blob
        }
        // Start a new recorder for the next chunk
        startRecorder();
      }, chunkIntervalMs);

      // Elapsed timer
      const t0 = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - t0) / 1000));
      }, 1000);
    },
    [kind, chunkIntervalMs, onChunk]
  );

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop(); // fires final ondataavailable
    }
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  const mimeType = Platform.OS === "web" ? pickMimeType(kind) : "";

  return { start, stop, isRecording, elapsed, chunkCount, mimeType };
}
