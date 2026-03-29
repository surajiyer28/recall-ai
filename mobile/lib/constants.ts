import { Platform } from "react-native";

// Android emulator uses 10.0.2.2 to reach host localhost
const LOCAL_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";
export const API_BASE_URL = `http://${LOCAL_HOST}:8080/api/v1`;

export const Colors = {
  primary: "#0EA5E9", // sky-500
  primaryDark: "#0284C7",
  background: "#0F172A", // slate-900
  surface: "#1E293B", // slate-800
  surfaceLight: "#334155", // slate-700
  text: "#F8FAFC", // slate-50
  textSecondary: "#94A3B8", // slate-400
  textMuted: "#64748B", // slate-500
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  border: "#334155",
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  title: 34,
} as const;
