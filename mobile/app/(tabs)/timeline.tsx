import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "../../hooks/useApi";
import { TimelineEntryCard } from "../../components/TimelineEntryCard";
import * as api from "../../lib/api";
import { Colors, FontSize, Spacing } from "../../lib/constants";
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
  const [date, setDate] = useState(new Date());

  const timeline = useApi<TimelineResponse>(
    () => api.getTimeline(toDateStr(date)),
    [date]
  );
  const stats = useApi<MemoryStats>(() => api.getTimelineStats(), []);

  const shiftDate = useCallback(
    (days: number) => {
      setDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + days);
        if (d > new Date()) return prev; // don't go into future
        return d;
      });
    },
    []
  );

  return (
    <View style={styles.container}>
      {/* Date nav */}
      <View style={styles.dateRow}>
        <Pressable onPress={() => shiftDate(-1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
        <Pressable onPress={() => shiftDate(1)} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={Colors.textSecondary} />
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
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {timeline.loading ? "Loading..." : "No memories for this day"}
          </Text>
        }
        ListHeaderComponent={
          <Text style={styles.entryCount}>
            {timeline.data ? `${timeline.data.total} memories` : ""}
          </Text>
        }
      />
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  dateRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  dateLabel: { color: Colors.text, fontSize: FontSize.lg, fontWeight: "700", minWidth: 120, textAlign: "center" },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  statBox: { alignItems: "center" },
  statValue: { color: Colors.text, fontSize: FontSize.xl, fontWeight: "700" },
  statLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  entryCount: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  empty: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: "center",
    marginTop: Spacing.xxl,
  },
});
