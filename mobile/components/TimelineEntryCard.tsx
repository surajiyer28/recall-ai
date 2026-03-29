import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontSize, Spacing } from "../lib/constants";
import type { TimelineEntry } from "../lib/types";

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  meeting: "people",
  conversation: "chatbubbles",
  thought: "bulb",
  image: "image",
  capture: "mic",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(sec?: number) {
  if (!sec) return "";
  return sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec}s`;
}

interface Props {
  entry: TimelineEntry;
  onPress?: () => void;
}

export function TimelineEntryCard({ entry, onPress }: Props) {
  const icon = TYPE_ICON[entry.memory_type] ?? "document";
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.time}>{formatTime(entry.created_at)}</Text>
      <View style={styles.iconCol}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={16} color={Colors.primary} />
        </View>
        <View style={styles.line} />
      </View>
      <View style={styles.content}>
        <Text style={styles.summary} numberOfLines={2}>
          {entry.summary ?? "Processing..."}
        </Text>
        <View style={styles.meta}>
          {entry.place_name && (
            <Text style={styles.metaText}>{entry.place_name}</Text>
          )}
          {entry.duration_sec != null && entry.duration_sec > 0 && (
            <Text style={styles.metaText}>{formatDuration(entry.duration_sec)}</Text>
          )}
          {entry.action_item_count > 0 && (
            <Text style={styles.metaText}>
              {entry.action_item_count} action{entry.action_item_count > 1 ? "s" : ""}
            </Text>
          )}
        </View>
        {entry.entity_tags.length > 0 && (
          <View style={styles.tags}>
            {entry.entity_tags.slice(0, 4).map((t, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", paddingHorizontal: Spacing.lg, gap: Spacing.md },
  time: { color: Colors.textSecondary, fontSize: FontSize.xs, width: 50, paddingTop: 2 },
  iconCol: { alignItems: "center", width: 28 },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  line: { flex: 1, width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  content: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  summary: { color: Colors.text, fontSize: FontSize.md, lineHeight: 20 },
  meta: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm },
  metaText: { color: Colors.textSecondary, fontSize: FontSize.xs },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.sm },
  tag: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  tagText: { color: Colors.primary, fontSize: FontSize.xs },
});
