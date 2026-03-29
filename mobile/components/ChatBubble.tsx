import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { FontSize, Spacing } from "../lib/constants";
import type { ChatMessage } from "../lib/types";

interface Props {
  message: ChatMessage;
  onSourcePress?: (memoryId: string) => void;
  onFollowUp?: (text: string) => void;
}

export function ChatBubble({ message, onSourcePress, onFollowUp }: Props) {
  const { colors } = useTheme();
  const isUser = message.role === "user";

  const CONFIDENCE_COLOR: Record<string, string> = {
    high: colors.success,
    medium: colors.warning,
    low: colors.error,
  };

  return (
    <View style={[styles.wrapper, isUser ? styles.userWrapper : styles.aiWrapper]}>
      <View style={[styles.bubble, isUser ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 } : { backgroundColor: colors.surface, borderBottomLeftRadius: 4 }]}>
        <Text style={[styles.text, { color: colors.text }, isUser && { color: "#fff" }]}>{message.content}</Text>

        {message.confidence && (
          <View style={styles.confidenceRow}>
            <View
              style={[
                styles.confidenceDot,
                { backgroundColor: CONFIDENCE_COLOR[message.confidence] ?? colors.textMuted },
              ]}
            />
            <Text style={[styles.confidenceLabel, { color: colors.textSecondary }]}>{message.confidence} confidence</Text>
          </View>
        )}

        {message.sources && message.sources.length > 0 && (
          <View style={styles.sourcesRow}>
            {message.sources.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.sourceChip, { backgroundColor: colors.surfaceLight }]}
                onPress={() => onSourcePress?.(s.id)}
              >
                <Text style={[styles.sourceText, { color: colors.primary }]} numberOfLines={1}>
                  {s.place_name ?? s.summary?.slice(0, 30) ?? "Source"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {message.follow_ups && message.follow_ups.length > 0 && (
        <View style={styles.followUps}>
          {message.follow_ups.map((f, i) => (
            <Pressable
              key={i}
              style={[styles.followUpPill, { borderColor: colors.primary }]}
              onPress={() => onFollowUp?.(f)}
            >
              <Text style={[styles.followUpText, { color: colors.primary }]}>{f}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: Spacing.xs, paddingHorizontal: Spacing.lg },
  userWrapper: { alignItems: "flex-end" },
  aiWrapper: { alignItems: "flex-start" },
  bubble: { maxWidth: "85%", borderRadius: 16, padding: Spacing.md },
  text: { fontSize: FontSize.md, lineHeight: 22 },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  confidenceDot: { width: 6, height: 6, borderRadius: 3 },
  confidenceLabel: { fontSize: FontSize.xs },
  sourcesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  sourceChip: {
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  sourceText: { fontSize: FontSize.xs },
  followUps: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    maxWidth: "85%",
  },
  followUpPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  followUpText: { fontSize: FontSize.sm },
});
