import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, FontSize, Spacing } from "../lib/constants";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: Colors.success, label: "Capturing" },
  paused: { color: Colors.warning, label: "Paused" },
  privacy_zone: { color: Colors.error, label: "Privacy Zone" },
  quiet_hours: { color: Colors.textMuted, label: "Quiet Hours" },
  offline: { color: Colors.textMuted, label: "Offline" },
};

export function CaptureStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.offline;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
      <Text style={styles.label}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { color: Colors.text, fontSize: FontSize.md, fontWeight: "600" },
});
