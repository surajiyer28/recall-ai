import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { useCapture } from "../../contexts/CaptureContext";
import { useApi } from "../../hooks/useApi";
import { CaptureStatusBadge } from "../../components/CaptureStatusBadge";
import { CaptureSessionCard } from "../../components/CaptureSessionCard";
import * as api from "../../lib/api";
import { Colors, FontSize, Spacing } from "../../lib/constants";
import type { CaptureSession, MemoryStats } from "../../lib/types";

export default function CaptureScreen() {
  const capture = useCapture();
  const sessions = useApi<{ sessions: CaptureSession[]; total: number }>(
    () => api.getSessions(10),
    []
  );
  const stats = useApi<MemoryStats>(() => api.getTimelineStats(), []);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);

  // --------------- Location helper ---------------
  const getLocation = useCallback(async () => {
    try {
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { gps_lat: coords.latitude, gps_lng: coords.longitude };
    } catch {
      return {};
    }
  }, []);

  // --------------- Recording ---------------
  const startRecording = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      const loc = await getLocation();
      const res = await api.startRecording(loc);
      sessionIdRef.current = res.session_id;
      setRecording(rec);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not start recording");
    }
  }, [getLocation]);

  const stopRecording = useCallback(async () => {
    if (!recording || !sessionIdRef.current) return;
    setBusy(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        await api.stopRecording(sessionIdRef.current, uri);
      }
      setRecording(null);
      sessionIdRef.current = null;
      sessions.refetch();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not stop recording");
    } finally {
      setBusy(false);
    }
  }, [recording, sessions]);

  // --------------- Uploads ---------------
  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setBusy(true);
    try {
      const loc = await getLocation();
      await api.uploadImage(
        result.assets.map((a) => a.uri),
        loc
      );
      sessions.refetch();
    } catch (e: unknown) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [getLocation, sessions]);

  const pickAudioFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "audio/*" });
    if (result.canceled) return;
    setBusy(true);
    try {
      const loc = await getLocation();
      await api.uploadAudio(result.assets[0].uri, loc);
      sessions.refetch();
    } catch (e: unknown) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [getLocation, sessions]);

  const pickVideoFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "video/*" });
    if (result.canceled) return;
    setBusy(true);
    try {
      const loc = await getLocation();
      await api.uploadVideo(result.assets[0].uri, loc);
      sessions.refetch();
    } catch (e: unknown) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [getLocation, sessions]);

  // --------------- Render ---------------
  const isActive = capture.capture_status === "active";

  return (
    <View style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusRow}>
        <CaptureStatusBadge status={capture.capture_status} />
        <Pressable
          style={[styles.toggleBtn, !isActive && styles.toggleBtnResume]}
          onPress={isActive ? capture.pause : capture.resume}
        >
          <Text style={styles.toggleText}>{isActive ? "Pause" : "Resume"}</Text>
        </Pressable>
      </View>

      {/* Stats */}
      {stats.data && (
        <Text style={styles.statsText}>
          {stats.data.today_count} memories captured today ·{" "}
          {stats.data.total_count} total
        </Text>
      )}

      {/* Record button */}
      <View style={styles.recordRow}>
        <Pressable
          style={[styles.recordBtn, recording ? styles.recordBtnActive : null]}
          onPress={recording ? stopRecording : startRecording}
          disabled={busy || !isActive}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons
              name={recording ? "stop" : "mic"}
              size={28}
              color="#fff"
            />
          )}
        </Pressable>
        <Text style={styles.recordLabel}>
          {recording ? "Tap to stop" : "Tap to record"}
        </Text>
      </View>

      {/* Upload actions */}
      <View style={styles.uploadRow}>
        <UploadBtn icon="image" label="Image" onPress={pickImage} disabled={busy || !isActive} />
        <UploadBtn icon="musical-notes" label="Audio" onPress={pickAudioFile} disabled={busy || !isActive} />
        <UploadBtn icon="videocam" label="Video" onPress={pickVideoFile} disabled={busy || !isActive} />
      </View>

      {/* Recent sessions */}
      <Text style={styles.sectionTitle}>Recent Captures</Text>
      <FlatList
        data={sessions.data?.sessions ?? []}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <CaptureSessionCard session={item} />}
        contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xxl }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {sessions.loading ? "Loading..." : "No captures yet"}
          </Text>
        }
      />
    </View>
  );
}

function UploadBtn({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable style={[styles.uploadBtn, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <Text style={styles.uploadLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: Spacing.lg },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  toggleBtn: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  toggleBtnResume: { backgroundColor: Colors.primary },
  toggleText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: "600" },
  statsText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  recordRow: { alignItems: "center", marginVertical: Spacing.xl },
  recordBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  recordBtnActive: { backgroundColor: Colors.error },
  recordLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.sm },
  uploadRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  uploadBtn: { alignItems: "center", gap: Spacing.xs },
  uploadLabel: { color: Colors.textSecondary, fontSize: FontSize.xs },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: "700",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  empty: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: "center",
    marginTop: Spacing.xl,
  },
});
