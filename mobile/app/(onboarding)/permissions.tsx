import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage" ;
import { useTheme } from "../../contexts/ThemeContext";
import { FontSize, Spacing } from "../../lib/constants";

type Status = "pending" | "granted" | "denied";

// Fallback if AsyncStorage isn't installed — store in memory
const storage = {
  setItem: async (k: string, v: string) => {
    try {
      await AsyncStorage.setItem(k, v);
    } catch {
      // @ts-expect-error fallback
      globalThis.__recall_storage = { ...(globalThis.__recall_storage ?? {}), [k]: v };
    }
  },
};

export default function Permissions() {
  const router = useRouter();
  const { colors } = useTheme();
  const [mic, setMic] = useState<Status>("pending");
  const [cam, setCam] = useState<Status>("pending");
  const [loc, setLoc] = useState<Status>("pending");

  useEffect(() => {
    (async () => {
      const { granted: micOk } = await Audio.getPermissionsAsync();
      if (micOk) setMic("granted");
      const { granted: locOk } = await Location.getForegroundPermissionsAsync();
      if (locOk) setLoc("granted");
      // Check camera on web
      if (Platform.OS === "web") {
        try {
          const result = await navigator.permissions.query({ name: "camera" as PermissionName });
          if (result.state === "granted") setCam("granted");
        } catch {
          // permissions API not supported
        }
      }
    })();
  }, []);

  const requestMic = useCallback(async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    setMic(granted ? "granted" : "denied");
  }, []);

  const requestCam = useCallback(async () => {
    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        setCam("granted");
      } catch {
        setCam("denied");
      }
    }
  }, []);

  const requestLoc = useCallback(async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    setLoc(granted ? "granted" : "denied");
  }, []);

  const proceed = useCallback(async () => {
    await storage.setItem("onboarding_complete", "1");
    router.replace("/(tabs)/capture");
  }, [router]);

  const statusColor = (status: Status) =>
    status === "granted" ? colors.success : status === "denied" ? colors.error : colors.textMuted;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.text }]}>Permissions</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        RecallAI needs access to capture your day. You control everything.
      </Text>

      <View style={styles.list}>
        {([
          { icon: "mic" as const, label: "Microphone", status: mic, onRequest: requestMic },
          { icon: "camera" as const, label: "Camera", status: cam, onRequest: requestCam },
          { icon: "location" as const, label: "Location", status: loc, onRequest: requestLoc },
        ]).map((perm) => (
          <Pressable
            key={perm.label}
            style={[styles.row, { backgroundColor: colors.surface }]}
            onPress={perm.status !== "granted" ? perm.onRequest : undefined}
          >
            <Ionicons name={perm.icon} size={22} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>{perm.label}</Text>
            <Text style={[styles.rowStatus, { color: statusColor(perm.status) }]}>
              {perm.status === "granted" ? "Granted" : perm.status === "denied" ? "Denied" : "Tap to grant"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={proceed}>
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.xxl, justifyContent: "center" },
  heading: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
  },
  sub: {
    fontSize: FontSize.md,
    marginTop: Spacing.md,
    lineHeight: 22,
  },
  list: { marginTop: Spacing.xxl, gap: Spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  rowLabel: { flex: 1, fontSize: FontSize.md, fontWeight: "600" },
  rowStatus: { fontSize: FontSize.sm },
  button: {
    borderRadius: 14,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.xxl * 2,
  },
  buttonText: { color: "#fff", fontSize: FontSize.lg, fontWeight: "700" },
});
