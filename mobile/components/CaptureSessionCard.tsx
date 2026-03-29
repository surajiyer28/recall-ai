import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { FontSize, Spacing } from "../lib/constants";
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
  const { colors } = useTheme();
  const icon = TRIGGER_ICON[session.trigger] ?? "document";
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={styles.info}>
        <Text style={[styles.time, { color: colors.text }]}>{formatTime(session.started_at)}</Text>
        <Text style={[styles.place, { color: colors.textSecondary }]} numberOfLines={1}>
          {session.place_name ?? "Unknown location"}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: colors.surfaceLight }]}>
        <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{session.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  info: { flex: 1 },
  time: { fontSize: FontSize.md, fontWeight: "600" },
  place: { fontSize: FontSize.sm, marginTop: 2 },
  badge: {
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  badgeText: { fontSize: FontSize.xs },
});
