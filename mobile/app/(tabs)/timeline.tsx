import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "../../hooks/useApi";
import { useTheme } from "../../contexts/ThemeContext";
import { TimelineEntryCard } from "../../components/TimelineEntryCard";
import * as api from "../../lib/api";
import { FontSize, Spacing } from "../../lib/constants";
import type { MemoryStats, TimelineResponse } from "../../lib/types";

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(d: Date) {
  const today = toDateStr(new Date());
  const ds = toDateStr(d);
  if (ds === today) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (ds === toDateStr(yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function TimelineScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [date, setDate] = useState(new Date());

  const timeline = useApi<TimelineResponse>(
    () => api.getTimeline(toDateStr(date)),
    [date],
    { pollingIntervalMs: 30_000 }
  );
  const stats = useApi<MemoryStats>(() => api.getTimelineStats(), [], { pollingIntervalMs: 30_000 });

  const shiftDate = useCallback(
    (days: number) => {
      setDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + days);
        if (d > new Date()) return prev;
        return d;
      });
    },
    []
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Date nav */}
      <View style={styles.dateRow}>
        <Pressable onPress={() => shiftDate(-1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.dateLabel, { color: colors.text }]}>{formatDateLabel(date)}</Text>
        <Pressable onPress={() => shiftDate(1)} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Stats */}
      {stats.data && (
        <View style={styles.statsRow}>
          <StatBox label="Today" value={stats.data.today_count} />
          <StatBox label="Total" value={stats.data.total_count} />
          {Object.entries(stats.data.by_type)
            .slice(0, 2)
            .map(([k, v]) => (
              <StatBox key={k} label={k} value={v} />
            ))}
        </View>
      )}

      {/* Timeline entries */}
      <FlatList
        data={timeline.data?.entries ?? []}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <TimelineEntryCard
            entry={item}
            onPress={() => router.push(`/memory/${item.id}`)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={timeline.refreshing} onRefresh={timeline.refetch} />
        }
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {timeline.loading ? "Loading..." : "No memories for this day"}
          </Text>
        }
        ListHeaderComponent={
          <Text style={[styles.entryCount, { color: colors.textSecondary }]}>
            {timeline.data ? `${timeline.data.total} memories` : ""}
          </Text>
        }
      />
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dateRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  dateLabel: { fontSize: FontSize.lg, fontWeight: "700", minWidth: 120, textAlign: "center" },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  statBox: { alignItems: "center" },
  statValue: { fontSize: FontSize.xl, fontWeight: "700" },
  statLabel: { fontSize: FontSize.xs, marginTop: 2 },
  entryCount: {
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  empty: {
    fontSize: FontSize.md,
    textAlign: "center",
    marginTop: Spacing.xxl,
  },
});
