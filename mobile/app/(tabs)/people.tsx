import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "../../hooks/useApi";
import { useTheme } from "../../contexts/ThemeContext";
import * as api from "../../lib/api";
import { FontSize, Spacing } from "../../lib/constants";
import type { PersonSummary } from "../../lib/types";

export default function PeopleScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const peopleQuery = useApi<PersonSummary[]>(() => api.getPeople(), [], { pollingIntervalMs: 30_000 });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={peopleQuery.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={() => router.push(`/person/${item.id}`)}
          >
            <View style={[styles.avatar, { backgroundColor: colors.surfaceLight }]}>
              <Ionicons name="person" size={24} color={colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.count, { color: colors.textSecondary }]}>
                {item.highlight_count} highlight{item.highlight_count !== 1 ? "s" : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        refreshControl={
          <RefreshControl refreshing={peopleQuery.refreshing} onRefresh={peopleQuery.refetch} />
        }
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.md,
          paddingBottom: Spacing.xxl,
          gap: Spacing.sm,
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {peopleQuery.loading ? "Loading..." : "No people yet"}
            </Text>
            {!peopleQuery.loading && (
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                People mentioned in your memories will appear here
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderRadius: 12,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  count: {
    fontSize: FontSize.sm,
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
  emptySub: {
    fontSize: FontSize.sm,
    textAlign: "center",
    paddingHorizontal: Spacing.xxl,
  },
});
