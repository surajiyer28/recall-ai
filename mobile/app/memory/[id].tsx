import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "../../hooks/useApi";
import * as api from "../../lib/api";
import { Colors, FontSize, Spacing } from "../../lib/constants";
import type { MemoryDetail } from "../../lib/types";

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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

  if (loading) return <Text style={styles.loading}>Loading...</Text>;
  if (error || !memory) return <Text style={styles.loading}>Memory not found</Text>;

  const dt = new Date(memory.created_at);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.date}>
        {dt.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
        {" · "}
        {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>

      {memory.duration_sec != null && memory.duration_sec > 0 && (
        <Text style={styles.meta}>
          Duration: {Math.round(memory.duration_sec / 60)} min
        </Text>
      )}

      {memory.confidence != null && (
        <Text style={styles.meta}>Confidence: {(memory.confidence * 100).toFixed(0)}%</Text>
      )}

      {/* Entities */}
      {memory.entities.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Key Entities</Text>
          <View style={styles.tags}>
            {memory.entities.map((e) => (
              <View key={e.id} style={styles.tag}>
                <Text style={styles.tagText}>
                  {e.value}
                </Text>
                <Text style={styles.tagType}>{e.type}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Summary */}
      {memory.summary && (
        <>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.body}>{memory.summary}</Text>
        </>
      )}

      {/* Transcript */}
      {memory.transcript && (
        <>
          <Text style={styles.sectionTitle}>Full Transcript</Text>
          <View style={styles.transcriptBox}>
            <Text style={styles.transcript}>{memory.transcript}</Text>
          </View>
        </>
      )}

      {/* Delete */}
      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Ionicons name="trash" size={18} color={Colors.error} />
        <Text style={styles.deleteText}>Delete Memory</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxl * 2 },
  loading: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: "center",
    marginTop: Spacing.xxl,
  },
  date: { color: Colors.text, fontSize: FontSize.lg, fontWeight: "700" },
  meta: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.xs },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: "700",
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  tag: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    gap: Spacing.xs,
    alignItems: "center",
  },
  tagText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: "600" },
  tagType: { color: Colors.textMuted, fontSize: FontSize.xs },
  body: { color: Colors.text, fontSize: FontSize.md, lineHeight: 24 },
  transcriptBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
  },
  transcript: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 22 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xxl,
    alignSelf: "center",
    padding: Spacing.md,
  },
  deleteText: { color: Colors.error, fontSize: FontSize.md },
});
