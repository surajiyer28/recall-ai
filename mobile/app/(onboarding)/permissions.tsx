import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage" ;
import { Colors, FontSize, Spacing } from "../../lib/constants";
import * as api from "../../lib/api";

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
  const [mic, setMic] = useState<Status>("pending");
  const [loc, setLoc] = useState<Status>("pending");

  useEffect(() => {
    (async () => {
      const { granted: micOk } = await Audio.getPermissionsAsync();
      if (micOk) setMic("granted");
      const { granted: locOk } = await Location.getForegroundPermissionsAsync();
      if (locOk) setLoc("granted");
    })();
  }, []);

  const requestMic = useCallback(async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    setMic(granted ? "granted" : "denied");
  }, []);

  const requestLoc = useCallback(async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    setLoc(granted ? "granted" : "denied");
  }, []);

  const proceed = useCallback(async () => {
    await storage.setItem("onboarding_complete", "1");
    // Seed demo data in background
    api.seedDemo().catch(() => {});
    router.replace("/(tabs)/capture");
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Permissions</Text>
      <Text style={styles.sub}>
        RecallAI needs access to capture your day. You control everything.
      </Text>

      <View style={styles.list}>
        <PermRow
          icon="mic"
          label="Microphone"
          status={mic}
          onRequest={requestMic}
        />
        <PermRow
          icon="location"
          label="Location"
          status={loc}
          onRequest={requestLoc}
        />
      </View>

      <Pressable style={styles.button} onPress={proceed}>
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

function PermRow({
  icon,
  label,
  status,
  onRequest,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  status: Status;
  onRequest: () => void;
}) {
  const color =
    status === "granted"
      ? Colors.success
      : status === "denied"
        ? Colors.error
        : Colors.textMuted;

  return (
    <Pressable style={styles.row} onPress={status !== "granted" ? onRequest : undefined}>
      <Ionicons name={icon} size={22} color={Colors.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowStatus, { color }]}>
        {status === "granted" ? "Granted" : status === "denied" ? "Denied" : "Tap to grant"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.xxl, justifyContent: "center" },
  heading: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: "700",
  },
  sub: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginTop: Spacing.md,
    lineHeight: 22,
  },
  list: { marginTop: Spacing.xxl, gap: Spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  rowLabel: { flex: 1, color: Colors.text, fontSize: FontSize.md, fontWeight: "600" },
  rowStatus: { fontSize: FontSize.sm },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.xxl * 2,
  },
  buttonText: { color: "#fff", fontSize: FontSize.lg, fontWeight: "700" },
});
