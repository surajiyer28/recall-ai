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
import { Colors, FontSize, Spacing } from "../../lib/constants";
import type { ChatMessage } from "../../lib/types";

const STARTERS = [
  "What did my professor say about the deadline?",
  "Where did I put my keys?",
  "What was that book someone recommended?",
  "Summarise today's meeting",
];

export default function ChatScreen() {
  const router = useRouter();
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.surfaceLight} />
          <Text style={styles.emptyTitle}>Ask RecallAI</Text>
          <Text style={styles.emptySubtitle}>
            Ask about anything from your day — conversations, places, people, ideas.
          </Text>
          <View style={styles.starters}>
            {STARTERS.map((s, i) => (
              <Pressable key={i} style={styles.starterPill} onPress={() => send(s)}>
                <Text style={styles.starterText}>{s}</Text>
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
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Searching memories...</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        {messages.length > 0 && (
          <Pressable onPress={reset} style={styles.resetBtn}>
            <Ionicons name="refresh" size={20} color={Colors.textMuted} />
          </Pressable>
        )}
        <TextInput
          style={styles.input}
          placeholder="Ask about your day..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          editable={!loading}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
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
  container: { flex: 1, backgroundColor: Colors.background },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xxl,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: "700",
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  starters: { marginTop: Spacing.xxl, gap: Spacing.sm, width: "100%" },
  starterPill: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
  },
  starterText: { color: Colors.primary, fontSize: FontSize.md },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  resetBtn: { padding: Spacing.xs },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
