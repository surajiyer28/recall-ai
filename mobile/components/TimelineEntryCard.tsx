import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { FontSize, Spacing } from "../lib/constants";
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
  const { colors } = useTheme();
  const icon = TYPE_ICON[entry.memory_type] ?? "document";
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={[styles.time, { color: colors.textSecondary }]}>{formatTime(entry.created_at)}</Text>
      <View style={styles.iconCol}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>
      <View style={[styles.content, { backgroundColor: colors.surface }]}>
        <Text style={[styles.summary, { color: colors.text }]} numberOfLines={2}>
          {entry.summary ?? "Processing..."}
        </Text>
        <View style={styles.meta}>
          {entry.place_name && (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{entry.place_name}</Text>
          )}
          {entry.duration_sec != null && entry.duration_sec > 0 && (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatDuration(entry.duration_sec)}</Text>
          )}
          {entry.action_item_count > 0 && (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {entry.action_item_count} action{entry.action_item_count > 1 ? "s" : ""}
            </Text>
          )}
        </View>
        {entry.entity_tags.length > 0 && (
          <View style={styles.tags}>
            {entry.entity_tags.slice(0, 4).map((t, i) => (
              <View key={i} style={[styles.tag, { backgroundColor: colors.surfaceLight }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>{t}</Text>
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
  time: { fontSize: FontSize.xs, width: 50, paddingTop: 2 },
  iconCol: { alignItems: "center", width: 28 },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  line: { flex: 1, width: 1, marginVertical: 4 },
  content: {
    flex: 1,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  summary: { fontSize: FontSize.md, lineHeight: 20 },
  meta: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm },
  metaText: { fontSize: FontSize.xs },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.sm },
  tag: {
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  tagText: { fontSize: FontSize.xs },
});
