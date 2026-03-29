import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCapture } from "../../contexts/CaptureContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useApi } from "../../hooks/useApi";
import * as api from "../../lib/api";
import { FontSize, Spacing } from "../../lib/constants";
import type { PrivacyZone, QuietHoursSettings, RetentionPolicy } from "../../lib/types";

export default function SettingsScreen() {
  const capture = useCapture();
  const { colors, isDark, toggle: toggleTheme } = useTheme();
  const zones = useApi<PrivacyZone[]>(() => api.getPrivacyZones(), []);
  const qh = useApi<QuietHoursSettings>(() => api.getQuietHours(), []);
  const ret = useApi<RetentionPolicy>(() => api.getRetention(), []);

  const isActive = capture.capture_status === "active";

  // --------------- Zone add ---------------
  const [zoneName, setZoneName] = useState("");
  const addZone = useCallback(async () => {
    if (!zoneName.trim()) return;
    try {
      await api.createPrivacyZone({
        name: zoneName.trim(),
        gps_lat: 0,
        gps_lng: 0,
        radius_metres: 50,
      });
      setZoneName("");
      zones.refetch();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create zone");
    }
  }, [zoneName, zones]);

  const deleteZone = useCallback(
    async (id: string) => {
      await api.deletePrivacyZone(id);
      zones.refetch();
    },
    [zones]
  );

  // --------------- Quiet hours toggle ---------------
  const toggleQH = useCallback(async () => {
    const current = qh.data;
    await api.setQuietHours({
      start_hour: current?.start_hour ?? 22,
      start_minute: current?.start_minute ?? 0,
      end_hour: current?.end_hour ?? 7,
      end_minute: current?.end_minute ?? 0,
      enabled: !current?.enabled,
    });
    qh.refetch();
  }, [qh]);

  // --------------- Retention ---------------
  const updateRetention = useCallback(
    async (days: number) => {
      await api.setRetention({ casual_days: days, important_indefinite: true });
      ret.refetch();
    },
    [ret]
  );

  // --------------- Seed demo ---------------
  const seedDemo = useCallback(async () => {
    try {
      await api.seedDemo();
      Alert.alert("Done", "Demo data loaded");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    }
  }, []);

  return (
    <FlatList
      data={[]}
      renderItem={null}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <Text style={[styles.heading, { color: colors.text }]}>Settings</Text>

          {/* Appearance */}
          <Section title="Appearance" colors={colors}>
            <View style={[styles.row, { borderBottomColor: colors.surfaceLight }]}>
              <Ionicons name={isDark ? "moon" : "sunny"} size={18} color={colors.primary} />
              <Text style={[styles.rowLabel, { color: colors.text, flex: 1 }]}>Dark Mode</Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ true: colors.primary, false: colors.surfaceLight }}
              />
            </View>
          </Section>

          {/* Capture toggle */}
          <Section title="Capture" colors={colors}>
            <View style={[styles.row, { borderBottomColor: colors.surfaceLight }]}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Audio Recording</Text>
              <Switch
                value={isActive}
                onValueChange={isActive ? capture.pause : capture.resume}
                trackColor={{ true: colors.primary, false: colors.surfaceLight }}
              />
            </View>
          </Section>

          {/* Privacy zones */}
          <Section title="Privacy Zones" colors={colors}>
            {(zones.data ?? []).map((z) => (
              <View key={z.id} style={[styles.row, { borderBottomColor: colors.surfaceLight }]}>
                <Ionicons name="location" size={18} color={colors.error} />
                <Text style={[styles.rowLabel, { flex: 1, color: colors.text }]}>{z.name}</Text>
                <Pressable onPress={() => deleteZone(z.id)}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            <View style={styles.addRow}>
              <TextInput
                style={[styles.addInput, { backgroundColor: colors.surfaceLight, color: colors.text }]}
                placeholder="Zone name"
                placeholderTextColor={colors.textMuted}
                value={zoneName}
                onChangeText={setZoneName}
              />
              <Pressable style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={addZone}>
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
          </Section>

          {/* Quiet hours */}
          <Section title="Quiet Hours" colors={colors}>
            <View style={[styles.row, { borderBottomColor: colors.surfaceLight }]}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                {qh.data
                  ? `${qh.data.start_hour}:${String(qh.data.start_minute).padStart(2, "0")} — ${qh.data.end_hour}:${String(qh.data.end_minute).padStart(2, "0")}`
                  : "10:00 PM — 7:00 AM"}
              </Text>
              <Switch
                value={qh.data?.enabled ?? false}
                onValueChange={toggleQH}
                trackColor={{ true: colors.primary, false: colors.surfaceLight }}
              />
            </View>
          </Section>

          {/* Retention */}
          <Section title="Data Retention" colors={colors}>
            <View style={[styles.row, { borderBottomColor: colors.surfaceLight }]}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Casual conversations</Text>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{ret.data?.casual_days ?? 30} days</Text>
            </View>
            <View style={styles.retButtons}>
              {[7, 30, 90].map((d) => (
                <Pressable
                  key={d}
                  style={[
                    styles.retBtn,
                    { borderColor: colors.border },
                    ret.data?.casual_days === d && { borderColor: colors.primary, backgroundColor: colors.primary + "20" },
                  ]}
                  onPress={() => updateRetention(d)}
                >
                  <Text
                    style={[
                      styles.retBtnText,
                      { color: colors.textSecondary },
                      ret.data?.casual_days === d && { color: colors.primary },
                    ]}
                  >
                    {d}d
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.row, { borderBottomColor: colors.surfaceLight }]}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Important memories</Text>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>Indefinite</Text>
            </View>
          </Section>

          {/* Demo */}
          <Section title="Demo" colors={colors}>
            <Pressable style={styles.demoBtn} onPress={seedDemo}>
              <Ionicons name="flask" size={18} color={colors.primary} />
              <Text style={[styles.demoBtnText, { color: colors.primary }]}>Load Demo Data</Text>
            </Pressable>
          </Section>
        </>
      }
    />
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: Record<string, string> }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.sectionBody, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxl * 2 },
  heading: { fontSize: FontSize.xxl, fontWeight: "700", marginBottom: Spacing.xl },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: "600", marginBottom: Spacing.sm, textTransform: "uppercase", letterSpacing: 1 },
  sectionBody: { borderRadius: 12, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: FontSize.md },
  rowValue: { fontSize: FontSize.sm },
  addRow: { flexDirection: "row", padding: Spacing.md, gap: Spacing.sm },
  addInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
  },
  addBtn: { borderRadius: 8, paddingHorizontal: Spacing.lg, justifyContent: "center" },
  addBtnText: { color: "#fff", fontSize: FontSize.sm, fontWeight: "600" },
  retButtons: { flexDirection: "row", gap: Spacing.sm, padding: Spacing.md },
  retBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retBtnText: { fontSize: FontSize.sm },
  demoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  demoBtnText: { fontSize: FontSize.md, fontWeight: "600" },
});
