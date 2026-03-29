import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useWebCamera } from "../hooks/useWebCamera";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { WebVideoElement } from "../components/WebVideoElement";
import * as api from "../lib/api";
import { Colors, FontSize, Spacing } from "../lib/constants";

type Mode = "photo" | "video";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function LiveCameraScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("photo");
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [flashFeedback, setFlashFeedback] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const locationRef = useRef<{ gps_lat: number; gps_lng: number } | undefined>(undefined);

  // Fetch location once on mount
  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(({ coords }) => {
        locationRef.current = { gps_lat: coords.latitude, gps_lng: coords.longitude };
      })
      .catch(() => {});
  }, []);

  // Camera stream — include audio so video recording captures sound
  const camera = useWebCamera({ video: true, audio: true });

  // Video chunk recorder
  const onVideoChunk = useCallback((blob: Blob, index: number) => {
    const loc = locationRef.current;
    setPendingUploads((p) => p + 1);
    api
      .uploadVideoBlob(blob, index, loc)
      .catch(() => api.uploadVideoBlob(blob, index, loc).catch(() => {}))
      .finally(() => setPendingUploads((p) => Math.max(0, p - 1)));
  }, []);

  const recorder = useMediaRecorder({
    kind: "video",
    chunkIntervalMs: 60_000,
    onChunk: onVideoChunk,
  });

  // Start camera on mount
  useEffect(() => {
    camera.start();
    return () => {
      camera.stop();
      if (recorder.isRecording) recorder.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Photo capture ----
  const capturePhoto = useCallback(() => {
    if (Platform.OS !== "web" || !camera.stream) return;
    const videoTrack = camera.stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const settings = videoTrack.getSettings();
    const w = settings.width ?? 1280;
    const h = settings.height ?? 720;

    // Find the video element in the DOM
    const videoEls = Array.from(document.querySelectorAll("video"));
    let videoEl: HTMLVideoElement | null = null;
    for (let i = 0; i < videoEls.length; i++) {
      if (videoEls[i].srcObject === camera.stream) {
        videoEl = videoEls[i];
        break;
      }
    }
    if (!videoEl) return;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, w, h);

    // Flash feedback
    setFlashFeedback(true);
    setTimeout(() => setFlashFeedback(false), 200);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setPendingUploads((p) => p + 1);
          api
            .uploadPhotoBlob(blob, locationRef.current)
            .catch(() => {})
            .finally(() => setPendingUploads((p) => Math.max(0, p - 1)));
        }
      },
      "image/jpeg",
      0.85
    );
  }, [camera.stream]);

  // ---- Video recording ----
  const toggleVideoRecording = useCallback(() => {
    if (!camera.stream) return;
    if (isVideoRecording) {
      recorder.stop();
      setIsVideoRecording(false);
    } else {
      recorder.start(camera.stream);
      setIsVideoRecording(true);
    }
  }, [camera.stream, isVideoRecording, recorder]);

  // ---- Close ----
  const handleClose = useCallback(() => {
    if (isVideoRecording) {
      recorder.stop();
      setIsVideoRecording(false);
    }
    camera.stop();
    router.back();
  }, [isVideoRecording, recorder, camera, router]);

  // ---- Mode toggle ----
  const toggleMode = useCallback(() => {
    if (isVideoRecording) {
      recorder.stop();
      setIsVideoRecording(false);
    }
    setMode((m) => (m === "photo" ? "video" : "photo"));
  }, [isVideoRecording, recorder]);

  if (camera.error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="camera-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.errorText}>Camera access denied</Text>
        <Text style={styles.errorSub}>{camera.error}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera viewfinder */}
      <WebVideoElement stream={camera.stream} style={styles.viewfinder} muted />

      {/* Flash overlay for photo capture */}
      {flashFeedback && <View style={styles.flash} />}

      {/* Recording indicator */}
      {isVideoRecording && (
        <View style={styles.recordingBadge}>
          <View style={styles.redDot} />
          <Text style={styles.recordingTime}>{formatTime(recorder.elapsed)}</Text>
        </View>
      )}

      {/* Upload indicator */}
      {pendingUploads > 0 && (
        <View style={styles.uploadBadge}>
          <Text style={styles.uploadText}>Uploading...</Text>
        </View>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={handleClose} style={styles.iconBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeBtn, mode === "photo" && styles.modeBtnActive]}
            onPress={() => !isVideoRecording && setMode("photo")}
          >
            <Text style={[styles.modeText, mode === "photo" && styles.modeTextActive]}>
              Photo
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === "video" && styles.modeBtnActive]}
            onPress={() => !isVideoRecording && setMode("video")}
          >
            <Text style={[styles.modeText, mode === "video" && styles.modeTextActive]}>
              Video
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => camera.switchCamera()} style={styles.iconBtn}>
          <Ionicons name="camera-reverse" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {mode === "photo" ? (
          <Pressable style={styles.shutterBtn} onPress={capturePhoto}>
            <View style={styles.shutterInner} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.shutterBtn, isVideoRecording && styles.shutterRecording]}
            onPress={toggleVideoRecording}
          >
            {isVideoRecording ? (
              <View style={styles.stopSquare} />
            ) : (
              <View style={styles.recordDot} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  viewfinder: {
    ...StyleSheet.absoluteFillObject,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    opacity: 0.7,
    zIndex: 20,
  },
  // Top bar
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 3,
  },
  modeBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 17,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
  },
  modeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  modeTextActive: {
    color: "#fff",
  },
  // Recording badge
  recordingBadge: {
    position: "absolute",
    top: Spacing.xxl + 56,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    zIndex: 10,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  recordingTime: {
    color: "#fff",
    fontSize: FontSize.sm,
    fontVariant: ["tabular-nums"],
  },
  // Upload badge
  uploadBadge: {
    position: "absolute",
    top: Spacing.xxl + 56 + 36,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    zIndex: 10,
  },
  uploadText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: Spacing.xxl * 2,
    zIndex: 10,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterRecording: {
    borderColor: Colors.error,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
  recordDot: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.error,
  },
  stopSquare: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  // Error state
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.xxl,
  },
  errorText: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: "700",
  },
  errorSub: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: "center",
  },
  backBtn: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backBtnText: {
    color: "#fff",
    fontSize: FontSize.md,
    fontWeight: "600",
  },
});
