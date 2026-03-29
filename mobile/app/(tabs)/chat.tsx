import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useChat } from "../../hooks/useChat";
import { ChatBubble } from "../../components/ChatBubble";
import { useTheme } from "../../contexts/ThemeContext";
import { FontSize, Spacing } from "../../lib/constants";
import type { ChatMessage } from "../../lib/types";

const STARTERS = [
  "What did my professor say about the deadline?",
  "Where did I put my keys?",
  "What was that book someone recommended?",
  "Summarise today's meeting",
];

export default function ChatScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { messages, loading, sendMessage, reset } = useChat();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const send = useCallback(
    (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || loading) return;
      setInput("");
      sendMessage(msg);
    },
    [input, loading, sendMessage]
  );

  const handleSourcePress = useCallback(
    (memoryId: string) => {
      router.push(`/memory/${memoryId}`);
    },
    [router]
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.surfaceLight} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Ask RecallAI</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Ask about anything from your day — conversations, places, people, ideas.
          </Text>
          <View style={styles.starters}>
            {STARTERS.map((s, i) => (
              <Pressable key={i} style={[styles.starterPill, { borderColor: colors.border }]} onPress={() => send(s)}>
                <Text style={[styles.starterText, { color: colors.primary }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              onSourcePress={handleSourcePress}
              onFollowUp={(text) => send(text)}
            />
          )}
          contentContainerStyle={{ paddingVertical: Spacing.lg }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Searching memories...</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        {messages.length > 0 && (
          <Pressable onPress={reset} style={styles.resetBtn}>
            <Ionicons name="refresh" size={20} color={colors.textMuted} />
          </Pressable>
        )}
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
          placeholder="Ask about your day..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          editable={!loading}
        />
        <Pressable
          style={[styles.sendBtn, { backgroundColor: colors.primary }, (!input.trim() || loading) && { opacity: 0.4 }]}
          onPress={() => send()}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  starters: { marginTop: Spacing.xxl, gap: Spacing.sm, width: "100%" },
  starterPill: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
  },
  starterText: { fontSize: FontSize.md },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  loadingText: { fontSize: FontSize.sm },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
  },
  resetBtn: { padding: Spacing.xs },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
