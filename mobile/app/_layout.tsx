import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CaptureProvider } from "../contexts/CaptureContext";
import { Colors } from "../lib/constants";

export default function RootLayout() {
  return (
    <CaptureProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{ headerShown: false, presentation: "modal" }}
        />
        <Stack.Screen
          name="memory/[id]"
          options={{ title: "Memory Detail", presentation: "modal" }}
        />
      </Stack>
    </CaptureProvider>
  );
}
