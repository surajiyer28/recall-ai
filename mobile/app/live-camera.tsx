import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useTheme } from "../contexts/ThemeContext";
import * as api from "../lib/api";
import { FontSize, Spacing } from "../lib/constants";

// Conditional imports — web-only hooks/components
import { useWebCamera } from "../hooks/useWebCamera";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { WebVideoElement } from "../components/WebVideoElement";

// Native camera (expo-camera)
import { CameraView, useCameraPermissions } from "expo-camera";

type Mode = "photo" | "video";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ==========================================================================
// Native Camera Screen (iOS / Android)
// ==========================================================================

function NativeCameraScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("photo");
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [flashFeedback, setFlashFeedback] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [elapsed, setElapsed] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkIndexRef = useRef(0);
  const locationRef = useRef<{ gps_lat: number; gps_lng: number } | undefined>(undefined);

  const [permission, requestPermission] = useCameraPermissions();

  // Fetch location on mount
  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(({ coords }) => {
        locationRef.current = { gps_lat: coords.latitude, gps_lng: coords.longitude };
      })
      .catch(() => {});
  }, []);

  // Request camera permission
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // ---- Photo capture ----
  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current) return;

    setFlashFeedback(true);
    setTimeout(() => setFlashFeedback(false), 200);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        setPendingUploads((p) => p + 1);
        api
          .uploadPhotoFile(photo.uri, locationRef.current)
          .catch(() => {})
          .finally(() => setPendingUploads((p) => Math.max(0, p - 1)));
      }
    } catch (e) {
      // Camera may not be ready
    }
  }, []);

  // ---- Video recording ----
  const toggleVideoRecording = useCallback(async () => {
    if (!cameraRef.current) return;

    if (isVideoRecording) {
      // Stop
      cameraRef.current.stopRecording();
      setIsVideoRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else {
      // Start
      setIsVideoRecording(true);
      setElapsed(0);
      chunkIndexRef.current = 0;
      const t0 = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - t0) / 1000));
      }, 1000);

      try {
        const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
        if (video?.uri) {
          const idx = chunkIndexRef.current;
          chunkIndexRef.current += 1;
          setPendingUploads((p) => p + 1);
          api
            .uploadVideoFile(video.uri, idx, locationRef.current)
            .catch(() => api.uploadVideoFile(video.uri, idx, locationRef.current).catch(() => {}))
            .finally(() => setPendingUploads((p) => Math.max(0, p - 1)));
        }
      } catch (e) {
        // Recording may have been interrupted
      }

      setIsVideoRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isVideoRecording]);

  // ---- Close ----
  const handleClose = useCallback(() => {
    if (isVideoRecording && cameraRef.current) {
      cameraRef.current.stopRecording();
      setIsVideoRecording(false);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    router.back();
  }, [isVideoRecording, router]);

  if (!permission?.granted) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.errorText, { color: colors.text }]}>Camera permission required</Text>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
          <Text style={styles.backBtnText}>Grant Permission</Text>
        </Pressable>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, { color: colors.text }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.viewfinder}
        facing={facing}
        mode={mode === "video" ? "video" : "picture"}
      />

      {/* Flash overlay */}
      {flashFeedback && <View style={styles.flash} />}

      {/* Recording indicator */}
      {isVideoRecording && (
        <View style={styles.recordingBadge}>
          <View style={[styles.redDot, { backgroundColor: colors.error }]} />
          <Text style={styles.recordingTime}>{formatTime(elapsed)}</Text>
        </View>
      )}

      {/* Upload indicator */}
      {pendingUploads > 0 && (
        <View style={styles.uploadBadge}>
          <Text style={[styles.uploadText, { color: colors.textSecondary }]}>Uploading...</Text>
        </View>
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={handleClose} style={styles.iconBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeBtn, mode === "photo" && { backgroundColor: colors.primary }]}
            onPress={() => !isVideoRecording && setMode("photo")}
          >
            <Text style={[styles.modeText, mode === "photo" && styles.modeTextActive]}>
              Photo
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === "video" && { backgroundColor: colors.primary }]}
            onPress={() => !isVideoRecording && setMode("video")}
          >
            <Text style={[styles.modeText, mode === "video" && styles.modeTextActive]}>
              Video
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))} style={styles.iconBtn}>
          <Ionicons name="camera-reverse" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.xxl }]}>
        {mode === "photo" ? (
          <Pressable style={styles.shutterBtn} onPress={capturePhoto}>
            <View style={styles.shutterInner} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.shutterBtn, isVideoRecording && { borderColor: colors.error }]}
            onPress={toggleVideoRecording}
          >
            {isVideoRecording ? (
              <View style={[styles.stopSquare, { backgroundColor: colors.error }]} />
            ) : (
              <View style={[styles.recordDot, { backgroundColor: colors.error }]} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ==========================================================================
// Web Camera Screen (browser)
// ==========================================================================

function WebCameraScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>("photo");
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [flashFeedback, setFlashFeedback] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const locationRef = useRef<{ gps_lat: number; gps_lng: number } | undefined>(undefined);

  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(({ coords }) => {
        locationRef.current = { gps_lat: coords.latitude, gps_lng: coords.longitude };
      })
      .catch(() => {});
  }, []);

  const camera = useWebCamera({ video: true, audio: true });

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

  useEffect(() => {
    camera.start();
    return () => {
      camera.stop();
      if (recorder.isRecording) recorder.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capturePhoto = useCallback(() => {
    if (!camera.stream) return;
    const videoTrack = camera.stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const settings = videoTrack.getSettings();
    const w = settings.width ?? 1280;
    const h = settings.height ?? 720;

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

  const handleClose = useCallback(() => {
    if (isVideoRecording) {
      recorder.stop();
      setIsVideoRecording(false);
    }
    camera.stop();
    router.back();
  }, [isVideoRecording, recorder, camera, router]);

  if (camera.error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.errorText, { color: colors.text }]}>Camera access denied</Text>
        <Text style={[styles.errorSub, { color: colors.textMuted }]}>{camera.error}</Text>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebVideoElement stream={camera.stream} style={styles.viewfinder} muted />

      {flashFeedback && <View style={styles.flash} />}

      {isVideoRecording && (
        <View style={styles.recordingBadge}>
          <View style={[styles.redDot, { backgroundColor: colors.error }]} />
          <Text style={styles.recordingTime}>{formatTime(recorder.elapsed)}</Text>
        </View>
      )}

      {pendingUploads > 0 && (
        <View style={styles.uploadBadge}>
          <Text style={[styles.uploadText, { color: colors.textSecondary }]}>Uploading...</Text>
        </View>
      )}

      <View style={styles.topBar}>
        <Pressable onPress={handleClose} style={styles.iconBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeBtn, mode === "photo" && { backgroundColor: colors.primary }]}
            onPress={() => !isVideoRecording && setMode("photo")}
          >
            <Text style={[styles.modeText, mode === "photo" && styles.modeTextActive]}>
              Photo
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === "video" && { backgroundColor: colors.primary }]}
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

      <View style={styles.bottomBar}>
        {mode === "photo" ? (
          <Pressable style={styles.shutterBtn} onPress={capturePhoto}>
            <View style={styles.shutterInner} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.shutterBtn, isVideoRecording && { borderColor: colors.error }]}
            onPress={toggleVideoRecording}
          >
            {isVideoRecording ? (
              <View style={[styles.stopSquare, { backgroundColor: colors.error }]} />
            ) : (
              <View style={[styles.recordDot, { backgroundColor: colors.error }]} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ==========================================================================
// Entry point — pick the right implementation
// ==========================================================================

export default function LiveCameraScreen() {
  if (Platform.OS === "web") {
    return <WebCameraScreen />;
  }
  return <NativeCameraScreen />;
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
  modeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  modeTextActive: {
    color: "#fff",
  },
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
  },
  recordingTime: {
    color: "#fff",
    fontSize: FontSize.sm,
    fontVariant: ["tabular-nums"],
  },
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
    fontSize: FontSize.xs,
  },
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
  },
  stopSquare: {
    width: 28,
    height: 28,
    borderRadius: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.xxl,
  },
  errorText: {
    fontSize: FontSize.lg,
    fontWeight: "700",
  },
  errorSub: {
    fontSize: FontSize.sm,
    textAlign: "center",
  },
  backBtn: {
    marginTop: Spacing.xl,
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
