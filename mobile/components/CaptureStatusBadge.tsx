import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { FontSize, Spacing } from "../lib/constants";

export function CaptureStatusBadge({ status }: { status: string }) {
  const { colors } = useTheme();

  const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    active: { color: colors.success, label: "Capturing" },
    paused: { color: colors.warning, label: "Paused" },
    privacy_zone: { color: colors.error, label: "Privacy Zone" },
    quiet_hours: { color: colors.textMuted, label: "Quiet Hours" },
    offline: { color: colors.textMuted, label: "Offline" },
  };

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.offline;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.label, { color: colors.text }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: FontSize.md, fontWeight: "600" },
});
