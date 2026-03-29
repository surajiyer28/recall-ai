import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "../../hooks/useApi";
import { useTheme } from "../../contexts/ThemeContext";
import * as api from "../../lib/api";
import { FontSize, Spacing } from "../../lib/constants";
import type { TaskItem } from "../../lib/types";

type Filter = "pending" | "done" | "all";

function formatDeadline(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TasksScreen() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>("pending");

  const tasksQuery = useApi<TaskItem[]>(
    () => api.getTasks(filter === "all" ? undefined : filter),
    [filter],
    { pollingIntervalMs: 30_000 }
  );

  const toggleDone = useCallback(
    async (task: TaskItem) => {
      const newStatus = task.status === "done" ? "pending" : "done";
      await api.updateTask(task.id, { status: newStatus });
      tasksQuery.refetch();
    },
    [tasksQuery]
  );

  const dismiss = useCallback(
    async (taskId: string) => {
      await api.updateTask(taskId, { status: "dismissed" });
      tasksQuery.refetch();
    },
    [tasksQuery]
  );

  const deadlineColor = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (d < now) return colors.error;
    const diffMs = d.getTime() - now.getTime();
    if (diffMs < 86400000 * 2) return colors.warning;
    return colors.textSecondary;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["pending", "done", "all"] as Filter[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterBtn, { backgroundColor: colors.surface }, filter === f && { backgroundColor: colors.primary }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, { color: colors.textSecondary }, filter === f && styles.filterTextActive]}>
              {f === "pending" ? "To Do" : f === "done" ? "Done" : "All"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Task list */}
      <FlatList
        data={tasksQuery.data ?? []}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface }, item.status === "done" && styles.cardDone]}>
            <Pressable onPress={() => toggleDone(item)} style={styles.checkbox} hitSlop={8}>
              <Ionicons
                name={item.status === "done" ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={item.status === "done" ? colors.success : colors.textMuted}
              />
            </Pressable>

            <View style={styles.cardContent}>
              <Text style={[styles.taskTitle, { color: colors.text }, item.status === "done" && { textDecorationLine: "line-through", color: colors.textMuted }]} numberOfLines={2}>
                {item.title}
              </Text>

              {item.description ? (
                <Text style={[styles.taskDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}

              {item.deadline ? (
                <View style={styles.deadlineRow}>
                  <Ionicons name="calendar-outline" size={12} color={deadlineColor(item.deadline)} />
                  <Text style={[styles.deadlineText, { color: deadlineColor(item.deadline) }]}>
                    {formatDeadline(item.deadline)}
                  </Text>
                </View>
              ) : null}
            </View>

            {item.status !== "done" ? (
              <Pressable onPress={() => dismiss(item.id)} style={styles.dismissBtn} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={tasksQuery.refreshing} onRefresh={tasksQuery.refetch} />
        }
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.sm }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {tasksQuery.loading
                ? "Loading..."
                : filter === "pending"
                ? "No pending tasks"
                : filter === "done"
                ? "No completed tasks"
                : "No tasks yet"}
            </Text>
            {!tasksQuery.loading && filter === "pending" && (
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Tasks are automatically extracted from your memories
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
  filterRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  filterBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
  },
  filterText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#fff",
  },
  card: {
    borderRadius: 12,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  cardDone: {
    opacity: 0.6,
  },
  checkbox: {
    paddingTop: 2,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  taskTitle: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  taskDesc: {
    fontSize: FontSize.sm,
  },
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  deadlineText: {
    fontSize: FontSize.xs,
  },
  dismissBtn: {
    padding: Spacing.xs,
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
