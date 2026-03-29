import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontSize, Spacing } from "../lib/constants";
import type { CaptureSession } from "../lib/types";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const TRIGGER_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  vad: "mic",
  manual_upload: "cloud-upload",
};

export function CaptureSessionCard({ session }: { session: CaptureSession }) {
  const icon = TRIGGER_ICON[session.trigger] ?? "document";
  return (
    <View style={styles.card}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <View style={styles.info}>
        <Text style={styles.time}>{formatTime(session.started_at)}</Text>
        <Text style={styles.place} numberOfLines={1}>
          {session.place_name ?? "Unknown location"}
        </Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{session.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  info: { flex: 1 },
  time: { color: Colors.text, fontSize: FontSize.md, fontWeight: "600" },
  place: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  badge: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  badgeText: { color: Colors.textSecondary, fontSize: FontSize.xs },
});
