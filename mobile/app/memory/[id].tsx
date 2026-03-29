import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "../../hooks/useApi";
import { useTheme } from "../../contexts/ThemeContext";
import * as api from "../../lib/api";
import { FontSize, Spacing } from "../../lib/constants";
import type { MemoryDetail } from "../../lib/types";

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { data: memory, loading, error } = useApi<MemoryDetail>(
    () => api.getMemory(id!),
    [id]
  );

  const handleDelete = () => {
    Alert.alert("Delete Memory", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.deleteMemory(id!);
          router.back();
        },
      },
    ]);
  };

  if (loading) return <Text style={[styles.loading, { color: colors.textMuted }]}>Loading...</Text>;
  if (error || !memory) return <Text style={[styles.loading, { color: colors.textMuted }]}>Memory not found</Text>;

  const dt = new Date(memory.created_at);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={[styles.date, { color: colors.text }]}>
        {dt.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
        {" · "}
        {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>

      {memory.duration_sec != null && memory.duration_sec > 0 ? (
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          Duration: {Math.round(memory.duration_sec / 60)} min
        </Text>
      ) : null}

      {memory.confidence != null ? (
        <Text style={[styles.meta, { color: colors.textSecondary }]}>Confidence: {(memory.confidence * 100).toFixed(0)}%</Text>
      ) : null}

      {/* Entities */}
      {memory.entities.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Key Entities</Text>
          <View style={styles.tags}>
            {memory.entities.map((e) => (
              <View key={e.id} style={[styles.tag, { backgroundColor: colors.surface }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>
                  {e.value}
                </Text>
                <Text style={[styles.tagType, { color: colors.textMuted }]}>{e.type}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Summary */}
      {memory.summary && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Summary</Text>
          <Text style={[styles.body, { color: colors.text }]}>{memory.summary}</Text>
        </>
      )}

      {/* Transcript */}
      {memory.transcript && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Full Transcript</Text>
          <View style={[styles.transcriptBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.transcript, { color: colors.textSecondary }]}>{memory.transcript}</Text>
          </View>
        </>
      )}

      {/* Delete */}
      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Ionicons name="trash" size={18} color={colors.error} />
        <Text style={[styles.deleteText, { color: colors.error }]}>Delete Memory</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxl * 2 },
  loading: {
    fontSize: FontSize.md,
    textAlign: "center",
    marginTop: Spacing.xxl,
  },
  date: { fontSize: FontSize.lg, fontWeight: "700" },
  meta: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  tag: {
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    gap: Spacing.xs,
    alignItems: "center",
  },
  tagText: { fontSize: FontSize.sm, fontWeight: "600" },
  tagType: { fontSize: FontSize.xs },
  body: { fontSize: FontSize.md, lineHeight: 24 },
  transcriptBox: {
    borderRadius: 12,
    padding: Spacing.lg,
  },
  transcript: { fontSize: FontSize.sm, lineHeight: 22 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xxl,
    alignSelf: "center",
    padding: Spacing.md,
  },
  deleteText: { fontSize: FontSize.md },
});
