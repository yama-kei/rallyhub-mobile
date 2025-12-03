import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ICON_COLOR = "#007AFF";
const ICON_SIZE = 28;

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>RallyHub</Text>
        <Text style={styles.title}>Record your games.{"\n"}Connect your games.</Text>
      </View>

      {/* Feature Overview */}
      <View style={styles.featuresContainer}>
        <Text style={styles.featureBullet}>• Connect with players using QR codes</Text>
        <Text style={styles.featureBullet}>• Record match partners & opponents</Text>
        <Text style={styles.featureBullet}>• Track your matches and game history</Text>
      </View>

      {/* Quick Action Buttons - 2x2 Grid */}
      <View style={styles.actionsContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => router.push("../play")}
          >
            <Ionicons name="tennisball-outline" size={ICON_SIZE} color={ICON_COLOR} />
            <Text style={styles.gridButtonText}>Play</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => router.push("/show-qr")}
          >
            <Ionicons name="qr-code-outline" size={ICON_SIZE} color={ICON_COLOR} />
            <Text style={styles.gridButtonText}>Show QR</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => router.push("/known-players")}
          >
            <Ionicons name="people-outline" size={ICON_SIZE} color={ICON_COLOR} />
            <Text style={styles.gridButtonText}>Known Players</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => router.push("/claim-guest")}
          >
            <Ionicons name="search-outline" size={ICON_SIZE} color={ICON_COLOR} />
            <Text style={styles.gridButtonText}>Claim Guest</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footer}>Built for pickleball players everywhere.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 20,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },

  // Logo Section
  logoContainer: {
    alignItems: "center",
    marginTop: 4
  },
  logoText: {
    fontSize: 48,
    fontWeight: "800",
    color: "#007AFF",
  },
  title: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },

  // Feature Bullets
  featuresContainer: {
    marginTop: 4,
    paddingHorizontal: 6,
  },
  featureBullet: {
    fontSize: 16,
    marginBottom: 6,
  },

  // Action Buttons - Grid Layout
  actionsContainer: {
    marginTop: 12,
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  gridButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 6,
  },
  gridButtonText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },

  footer: {
    textAlign: "center",
    fontSize: 14,
    color: "#777",
    marginBottom: 20,
  },
});
