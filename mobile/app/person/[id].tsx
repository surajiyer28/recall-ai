import { FlatList, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "../../hooks/useApi";
import { useTheme } from "../../contexts/ThemeContext";
import * as api from "../../lib/api";
import { FontSize, Spacing } from "../../lib/constants";
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
  const { colors } = useTheme();

  const peopleQuery = useApi<PersonSummary[]>(() => api.getPeople(), []);
  const highlightsQuery = useApi<PersonHighlight[]>(
    () => api.getPersonHighlights(id),
    [id]
  );

  const person = (peopleQuery.data ?? []).find((p) => p.id === id);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: person?.name ?? "Person",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceLight }]}>
          <Ionicons name="person" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{person?.name ?? "Person"}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {highlightsQuery.data?.length ?? 0} highlight
          {(highlightsQuery.data?.length ?? 0) !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Highlights */}
      <FlatList
        data={highlightsQuery.data ?? []}
        keyExtractor={(h) => h.id}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.highlight, { color: colors.text }]}>{item.highlight}</Text>
            <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.xxl,
          gap: Spacing.sm,
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {highlightsQuery.loading ? "Loading..." : "No highlights yet"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: FontSize.sm,
  },
  card: {
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  highlight: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  date: {
    fontSize: FontSize.xs,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: Spacing.xxl * 2,
    gap: Spacing.md,
  },
  empty: {
    fontSize: FontSize.md,
    textAlign: "center",
  },
});
