import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCapture } from "../../contexts/CaptureContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useApi } from "../../hooks/useApi";
import { CaptureSessionCard } from "../../components/CaptureSessionCard";
import * as api from "../../lib/api";
import { FontSize, Spacing } from "../../lib/constants";
import type { CaptureSession } from "../../lib/types";

export default function CaptureScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const capture = useCapture();
  const sessions = useApi<{ sessions: CaptureSession[]; total: number }>(
    () => api.getSessions(10),
    [],
    { pollingIntervalMs: 15_000 }
  );
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Live capture buttons */}
      <View style={styles.liveRow}>
        <Pressable
          style={styles.liveBtn}
          onPress={() => router.push("/live-audio")}
        >
          <View style={[styles.liveBtnIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="mic" size={28} color="#fff" />
          </View>
          <Text style={[styles.liveBtnLabel, { color: colors.text }]}>Live Audio</Text>
        </Pressable>

        <Pressable
          style={styles.liveBtn}
          onPress={() => router.push("/live-camera")}
        >
          <View style={[styles.liveBtnIcon, { backgroundColor: colors.success }]}>
            <Ionicons name="camera" size={28} color="#fff" />
          </View>
          <Text style={[styles.liveBtnLabel, { color: colors.text }]}>Camera</Text>
        </Pressable>
      </View>

      {/* Upload actions */}
      <Text style={[styles.uploadTitle, { color: colors.textMuted }]}>Upload from device</Text>
      <View style={styles.uploadRow}>
        <UploadBtn icon="image" label="Image" onPress={pickImage} disabled={busy} />
        <UploadBtn icon="musical-notes" label="Audio" onPress={pickAudioFile} disabled={busy} />
        <UploadBtn icon="videocam" label="Video" onPress={pickVideoFile} disabled={busy} />
      </View>

      {busy && (
        <View style={styles.busyRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.busyText, { color: colors.textSecondary }]}>Uploading...</Text>
        </View>
      )}

      {/* Recent sessions */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Captures</Text>
      <FlatList
        data={sessions.data?.sessions ?? []}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <CaptureSessionCard session={item} />}
        refreshControl={
          <RefreshControl refreshing={sessions.refreshing} onRefresh={sessions.refetch} />
        }
        contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xxl }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
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
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.uploadBtn, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={[styles.uploadLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Spacing.lg },
  liveRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xxl,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  liveBtn: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  liveBtnIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  liveBtnLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  uploadTitle: {
    fontSize: FontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  uploadRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  uploadBtn: { alignItems: "center", gap: Spacing.xs },
  uploadLabel: { fontSize: FontSize.xs },
  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  busyText: { fontSize: FontSize.sm },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  empty: {
    fontSize: FontSize.md,
    textAlign: "center",
    marginTop: Spacing.xl,
  },
});
