import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontSize, Spacing } from "../../lib/constants";

export default function Welcome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Ionicons name="bulb" size={64} color={Colors.primary} />
        <Text style={styles.title}>RecallAI</Text>
        <Text style={styles.subtitle}>Your memory, always on</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.description}>
          We capture what you hear and see — so you can ask about it later.
        </Text>
        <Text style={styles.tagline}>Zero effort. Total privacy.</Text>
      </View>

      <Pressable
        style={styles.button}
        onPress={() => router.push("/(onboarding)/permissions")}
      >
        <Text style={styles.buttonText}>Get started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xxl,
  },
  hero: { alignItems: "center", gap: Spacing.md },
  title: {
    color: Colors.text,
    fontSize: FontSize.title,
    fontWeight: "800",
    marginTop: Spacing.lg,
  },
  subtitle: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: "500",
  },
  body: { alignItems: "center", marginTop: Spacing.xxl * 2, gap: Spacing.lg },
  description: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    textAlign: "center",
    lineHeight: 26,
  },
  tagline: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl * 2,
    marginTop: Spacing.xxl * 2,
  },
  buttonText: {
    color: "#fff",
    fontSize: FontSize.lg,
    fontWeight: "700",
  },
});
