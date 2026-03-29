import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "../../hooks/useApi";
import * as api from "../../lib/api";
import { Colors, FontSize, Spacing } from "../../lib/constants";
import type { PersonSummary } from "../../lib/types";

export default function PeopleScreen() {
  const router = useRouter();
  const peopleQuery = useApi<PersonSummary[]>(() => api.getPeople(), []);

  return (
    <View style={styles.container}>
      <FlatList
        data={peopleQuery.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/person/${item.id}`)}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.count}>
                {item.highlight_count} highlight{item.highlight_count !== 1 ? "s" : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
        )}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.md,
          paddingBottom: Spacing.xxl,
          gap: Spacing.sm,
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.empty}>
              {peopleQuery.loading ? "Loading..." : "No people yet"}
            </Text>
            {!peopleQuery.loading && (
              <Text style={styles.emptySub}>
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
  container: { flex: 1, backgroundColor: Colors.background },
  card: {
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  count: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
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
  emptySub: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: "center",
    paddingHorizontal: Spacing.xxl,
  },
});
