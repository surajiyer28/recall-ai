import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { useTheme } from "../contexts/ThemeContext";
import * as api from "../lib/api";
import { FontSize, Spacing } from "../lib/constants";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function LiveAudioScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [pendingUploads, setPendingUploads] = useState(0);
  const [completedUploads, setCompletedUploads] = useState(0);
  const [stopping, setStopping] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const locationRef = useRef<{ gps_lat: number; gps_lng: number } | undefined>(undefined);

  // Fetch location once on mount
  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(({ coords }) => {
        locationRef.current = { gps_lat: coords.latitude, gps_lng: coords.longitude };
      })
      .catch(() => {});
  }, []);

  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const onChunk = useCallback((blob: Blob, index: number) => {
    const loc = locationRef.current;
    setPendingUploads((p) => p + 1);
    api
      .uploadAudioBlob(blob, index, loc)
      .then(() => setCompletedUploads((c) => c + 1))
      .catch(() => {
        // Retry once
        api
          .uploadAudioBlob(blob, index, loc)
          .then(() => setCompletedUploads((c) => c + 1))
          .catch(() => setCompletedUploads((c) => c + 1));
      })
      .finally(() => setPendingUploads((p) => Math.max(0, p - 1)));
  }, []);

  const recorder = useMediaRecorder({
    kind: "audio",
    chunkIntervalMs: 60_000,
    onChunk,
  });

  // Start recording on mount
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        recorder.start(stream);
      })
      .catch(() => {
        // Permission denied — go back
        router.back();
      });

    return () => {
      cancelled = true;
      recorder.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStop = useCallback(() => {
    setStopping(true);
    recorder.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    // Wait briefly for final chunk upload to start, then go back
    setTimeout(() => router.back(), 500);
  }, [recorder, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Close button */}
      <Pressable style={styles.closeBtn} onPress={handleStop}>
        <Ionicons name="close" size={28} color={colors.text} />
      </Pressable>

      {/* Center content */}
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.pulseRing,
            { borderColor: colors.primary + "40", transform: [{ scale: pulseAnim }] },
          ]}
        />
        <View style={[styles.micCircle, { backgroundColor: colors.primary }]}>
          <Ionicons name="mic" size={48} color="#fff" />
        </View>

        <Text style={[styles.listeningText, { color: colors.text }]}>Listening...</Text>
        <Text style={[styles.elapsed, { color: colors.textSecondary }]}>{formatTime(recorder.elapsed)}</Text>

        {recorder.chunkCount > 0 && (
          <Text style={[styles.chunkStatus, { color: colors.textMuted }]}>
            {pendingUploads > 0
              ? `Uploading chunk ${completedUploads + 1}...`
              : `${completedUploads} chunk${completedUploads !== 1 ? "s" : ""} processed`}
          </Text>
        )}
      </View>

      {/* Stop button */}
      <Pressable
        style={[styles.stopBtn, stopping && { opacity: 0.5 }]}
        onPress={handleStop}
        disabled={stopping}
      >
        <View style={[styles.stopSquare, { backgroundColor: colors.error }]} />
        <Text style={[styles.stopText, { color: colors.textSecondary }]}>Stop</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xxl * 2,
  },
  closeBtn: {
    position: "absolute",
    top: Spacing.xxl,
    right: Spacing.xl,
    zIndex: 10,
    padding: Spacing.sm,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
  },
  micCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  listeningText: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    marginTop: Spacing.xl,
  },
  elapsed: {
    fontSize: FontSize.xxl,
    fontWeight: "300",
    marginTop: Spacing.sm,
    fontVariant: ["tabular-nums"],
  },
  chunkStatus: {
    fontSize: FontSize.sm,
    marginTop: Spacing.lg,
  },
  stopBtn: {
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  stopSquare: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  stopText: {
    fontSize: FontSize.sm,
  },
});
