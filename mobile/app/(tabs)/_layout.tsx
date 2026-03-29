import { Tabs, useRouter } from "expo-router";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../lib/constants";
import { useCapture } from "../../contexts/CaptureContext";

export default function TabLayout() {
  const router = useRouter();
  const { capture_status } = useCapture();
  const isActive = capture_status === "active";

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: Colors.background, borderTopColor: Colors.border },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerRight: () => (
          <Pressable onPress={() => router.push("/settings")} style={{ marginRight: 16 }}>
            <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="capture"
        options={{
          title: "Capture",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={isActive ? "radio-button-on" : "radio-button-off"}
              size={size}
              color={isActive ? Colors.success : color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Ask",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: "Timeline",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
