import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CaptureProvider } from "../contexts/CaptureContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";

function InnerLayout() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
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
        <Stack.Screen
          name="live-audio"
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="live-camera"
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <CaptureProvider>
        <InnerLayout />
      </CaptureProvider>
    </ThemeProvider>
  );
}
