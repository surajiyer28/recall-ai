import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCapture } from "../../contexts/CaptureContext";
import { useApi } from "../../hooks/useApi";
import * as api from "../../lib/api";
import { Colors, FontSize, Spacing } from "../../lib/constants";
import type { PrivacyZone, QuietHoursSettings, RetentionPolicy } from "../../lib/types";

export default function SettingsScreen() {
  const capture = useCapture();
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
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <Text style={styles.heading}>Privacy Settings</Text>

          {/* Capture toggle */}
          <Section title="Capture">
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Audio Recording</Text>
              <Switch
                value={isActive}
                onValueChange={isActive ? capture.pause : capture.resume}
                trackColor={{ true: Colors.primary }}
              />
            </View>
          </Section>

          {/* Privacy zones */}
          <Section title="Privacy Zones">
            {(zones.data ?? []).map((z) => (
              <View key={z.id} style={styles.row}>
                <Ionicons name="location" size={18} color={Colors.error} />
                <Text style={[styles.rowLabel, { flex: 1 }]}>{z.name}</Text>
                <Pressable onPress={() => deleteZone(z.id)}>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </Pressable>
              </View>
            ))}
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                placeholder="Zone name"
                placeholderTextColor={Colors.textMuted}
                value={zoneName}
                onChangeText={setZoneName}
              />
              <Pressable style={styles.addBtn} onPress={addZone}>
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
          </Section>

          {/* Quiet hours */}
          <Section title="Quiet Hours">
            <View style={styles.row}>
              <Text style={styles.rowLabel}>
                {qh.data
                  ? `${qh.data.start_hour}:${String(qh.data.start_minute).padStart(2, "0")} — ${qh.data.end_hour}:${String(qh.data.end_minute).padStart(2, "0")}`
                  : "10:00 PM — 7:00 AM"}
              </Text>
              <Switch
                value={qh.data?.enabled ?? false}
                onValueChange={toggleQH}
                trackColor={{ true: Colors.primary }}
              />
            </View>
          </Section>

          {/* Retention */}
          <Section title="Data Retention">
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Casual conversations</Text>
              <Text style={styles.rowValue}>{ret.data?.casual_days ?? 30} days</Text>
            </View>
            <View style={styles.retButtons}>
              {[7, 30, 90].map((d) => (
                <Pressable
                  key={d}
                  style={[
                    styles.retBtn,
                    ret.data?.casual_days === d && styles.retBtnActive,
                  ]}
                  onPress={() => updateRetention(d)}
                >
                  <Text
                    style={[
                      styles.retBtnText,
                      ret.data?.casual_days === d && styles.retBtnTextActive,
                    ]}
                  >
                    {d}d
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Important memories</Text>
              <Text style={styles.rowValue}>Indefinite</Text>
            </View>
          </Section>

          {/* Demo */}
          <Section title="Demo">
            <Pressable style={styles.demoBtn} onPress={seedDemo}>
              <Ionicons name="flask" size={18} color={Colors.primary} />
              <Text style={styles.demoBtnText}>Load Demo Data</Text>
            </Pressable>
          </Section>
        </>
      }
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxl * 2 },
  heading: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: "700", marginBottom: Spacing.xl },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: "600", marginBottom: Spacing.sm, textTransform: "uppercase", letterSpacing: 1 },
  sectionBody: { backgroundColor: Colors.surface, borderRadius: 12, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceLight,
  },
  rowLabel: { color: Colors.text, fontSize: FontSize.md },
  rowValue: { color: Colors.textSecondary, fontSize: FontSize.sm },
  addRow: { flexDirection: "row", padding: Spacing.md, gap: Spacing.sm },
  addInput: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: Spacing.lg, justifyContent: "center" },
  addBtnText: { color: "#fff", fontSize: FontSize.sm, fontWeight: "600" },
  retButtons: { flexDirection: "row", gap: Spacing.sm, padding: Spacing.md },
  retBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "20" },
  retBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  retBtnTextActive: { color: Colors.primary },
  demoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  demoBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: "600" },
});
