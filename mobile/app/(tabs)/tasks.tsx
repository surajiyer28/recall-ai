import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "../../hooks/useApi";
import * as api from "../../lib/api";
import { Colors, FontSize, Spacing } from "../../lib/constants";
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

function deadlineColor(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d < now) return Colors.error;
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 86400000 * 2) return Colors.warning;
  return Colors.textSecondary;
}

export default function TasksScreen() {
  const [filter, setFilter] = useState<Filter>("pending");

  const tasksQuery = useApi<TaskItem[]>(
    () => api.getTasks(filter === "all" ? undefined : filter),
    [filter]
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

  const pendingCount = (tasksQuery.data ?? []).filter((t) => t.status === "pending").length;

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["pending", "done", "all"] as Filter[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
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
          <TaskCard
            task={item}
            onToggle={() => toggleDone(item)}
            onDismiss={() => dismiss(item.id)}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.sm }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.empty}>
              {tasksQuery.loading
                ? "Loading..."
                : filter === "pending"
                ? "No pending tasks"
                : filter === "done"
                ? "No completed tasks"
                : "No tasks yet"}
            </Text>
            {!tasksQuery.loading && filter === "pending" && (
              <Text style={styles.emptySub}>
                Tasks are automatically extracted from your memories
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
}

function TaskCard({
  task,
  onToggle,
  onDismiss,
}: {
  task: TaskItem;
  onToggle: () => void;
  onDismiss: () => void;
}) {
  const isDone = task.status === "done";

  return (
    <View style={[styles.card, isDone && styles.cardDone]}>
      <Pressable onPress={onToggle} style={styles.checkbox} hitSlop={8}>
        <Ionicons
          name={isDone ? "checkmark-circle" : "ellipse-outline"}
          size={24}
          color={isDone ? Colors.success : Colors.textMuted}
        />
      </Pressable>

      <View style={styles.cardContent}>
        <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]} numberOfLines={2}>
          {task.title}
        </Text>

        {task.description ? (
          <Text style={styles.taskDesc} numberOfLines={1}>
            {task.description}
          </Text>
        ) : null}

        {task.deadline ? (
          <View style={styles.deadlineRow}>
            <Ionicons name="calendar-outline" size={12} color={deadlineColor(task.deadline)} />
            <Text style={[styles.deadlineText, { color: deadlineColor(task.deadline) }]}>
              {formatDeadline(task.deadline)}
            </Text>
          </View>
        ) : null}
      </View>

      {!isDone ? (
        <Pressable onPress={onDismiss} style={styles.dismissBtn} hitSlop={8}>
          <Ionicons name="close" size={18} color={Colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
    backgroundColor: Colors.surface,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#fff",
  },
  // Card
  card: {
    backgroundColor: Colors.surface,
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
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  taskTitleDone: {
    textDecorationLine: "line-through",
    color: Colors.textMuted,
  },
  taskDesc: {
    color: Colors.textSecondary,
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
  // Empty
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
