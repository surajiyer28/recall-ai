import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, FontSize, Spacing } from "../lib/constants";
import type { ChatMessage } from "../lib/types";

interface Props {
  message: ChatMessage;
  onSourcePress?: (memoryId: string) => void;
  onFollowUp?: (text: string) => void;
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: Colors.success,
  medium: Colors.warning,
  low: Colors.error,
};

export function ChatBubble({ message, onSourcePress, onFollowUp }: Props) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.wrapper, isUser ? styles.userWrapper : styles.aiWrapper]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.text, isUser && styles.userText]}>{message.content}</Text>

        {message.confidence && (
          <View style={styles.confidenceRow}>
            <View
              style={[
                styles.confidenceDot,
                { backgroundColor: CONFIDENCE_COLOR[message.confidence] ?? Colors.textMuted },
              ]}
            />
            <Text style={styles.confidenceLabel}>{message.confidence} confidence</Text>
          </View>
        )}

        {message.sources && message.sources.length > 0 && (
          <View style={styles.sourcesRow}>
            {message.sources.map((s) => (
              <Pressable
                key={s.id}
                style={styles.sourceChip}
                onPress={() => onSourcePress?.(s.id)}
              >
                <Text style={styles.sourceText} numberOfLines={1}>
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
              style={styles.followUpPill}
              onPress={() => onFollowUp?.(f)}
            >
              <Text style={styles.followUpText}>{f}</Text>
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
  userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4 },
  text: { color: Colors.text, fontSize: FontSize.md, lineHeight: 22 },
  userText: { color: "#fff" },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  confidenceDot: { width: 6, height: 6, borderRadius: 3 },
  confidenceLabel: { color: Colors.textSecondary, fontSize: FontSize.xs },
  sourcesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  sourceChip: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  sourceText: { color: Colors.primary, fontSize: FontSize.xs },
  followUps: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    maxWidth: "85%",
  },
  followUpPill: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  followUpText: { color: Colors.primary, fontSize: FontSize.sm },
});
