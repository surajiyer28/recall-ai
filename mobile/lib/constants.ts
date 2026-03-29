export const API_BASE_URL = "https://recallai-api-225823353007.us-central1.run.app/api/v1";

export const DarkColors = {
  primary: "#3b82f6", // blue-500
  primaryDark: "#1d4ed8", // blue-700
  background: "#111827", // gray-900
  surface: "#1f2937", // gray-800
  surfaceLight: "#374151", // gray-700
  text: "#F8FAFC", // gray-50
  textSecondary: "#9ca3af", // gray-400
  textMuted: "#6b7280", // gray-500
  success: "#10b981", // emerald-500
  warning: "#f97316", // orange-500
  error: "#dc2626", // red-600
  border: "#374151", // gray-700
} as const;

export const LightColors = {
  primary: "#3b82f6", // blue-500
  primaryDark: "#1d4ed8", // blue-700
  background: "#f9fafb", // gray-50
  surface: "#ffffff", // white
  surfaceLight: "#e5e7eb", // gray-200
  text: "#111827", // gray-900
  textSecondary: "#4b5563", // gray-600
  textMuted: "#9ca3af", // gray-400
  success: "#10b981", // emerald-500
  warning: "#f97316", // orange-500
  error: "#dc2626", // red-600
  border: "#d1d5db", // gray-300
} as const;

/** @deprecated Use useTheme().colors instead */
export const Colors = DarkColors;

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
