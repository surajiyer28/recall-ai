import { FlatList, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "../../hooks/useApi";
import * as api from "../../lib/api";
import { Colors, FontSize, Spacing } from "../../lib/constants";
import type { PersonHighlight, PersonSummary } from "../../lib/types";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const peopleQuery = useApi<PersonSummary[]>(() => api.getPeople(), []);
  const highlightsQuery = useApi<PersonHighlight[]>(
    () => api.getPersonHighlights(id),
    [id]
  );

  const person = (peopleQuery.data ?? []).find((p) => p.id === id);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: person?.name ?? "Person",
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
        }}
      />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.name}>{person?.name ?? "Person"}</Text>
        <Text style={styles.subtitle}>
          {highlightsQuery.data?.length ?? 0} highlight
          {(highlightsQuery.data?.length ?? 0) !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Highlights */}
      <FlatList
        data={highlightsQuery.data ?? []}
        keyExtractor={(h) => h.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.highlight}>{item.highlight}</Text>
            <Text style={styles.date}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.xxl,
          gap: Spacing.sm,
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.empty}>
              {highlightsQuery.loading ? "Loading..." : "No highlights yet"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: "700",
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  highlight: {
    color: Colors.text,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  date: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: Spacing.xxl * 2,
    gap: Spacing.md,
  },
  empty: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: "center",
  },
});
