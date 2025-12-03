import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { QRPayloadBuilder } from "@/lib/qr/QRPayloadBuilder";

export default function ShowQRScreen() {
  //
  // Load identity + profiles
  //
  const { currentLink, loadLink } = useLocalProfileLinkStore();
  const { profiles, loadProfiles } = useProfileStore();

  //
  // Local state
  //
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [loading, setLoading] = useState(true);

  //
  // Load profile + link info from storage
  //
  useEffect(() => {
    loadLink();
    loadProfiles();
  }, []);

  //
  // Current device's profile
  //
  const profile =
    currentLink && profiles.length > 0
      ? profiles.find((p) => p.id === currentLink.profile_id)
      : null;

  //
  // Generate QR whenever profile becomes available
  //
  useEffect(() => {
    if (!profile) return;

    regenerateQR(profile);
    setLoading(false);
  }, [profile]);

  //
  // Countdown + auto-regeneration
  //
  useEffect(() => {
    if (!expiresAt || !profile) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remain = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setRemainingSec(remain);

      if (remain <= 0) {
        regenerateQR(profile);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, profile]);

  //
  // Build QR payload using the builder
  //
  function regenerateQR(profileObj: any) {
    const payload = QRPayloadBuilder.buildProfilePayload(profileObj);
    console.log("[ShowQR] Generated payload:", JSON.stringify(payload, null, 2));
    setQrValue(JSON.stringify(payload));
    setExpiresAt(payload.exp);
  }

  //
  // Render Loading
  //
  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.text}>Preparing your QR code…</Text>
      </SafeAreaView>
    );
  }

  //
  // Render Error
  //
  if (!qrValue) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>Unable to generate QR code.</Text>
      </SafeAreaView>
    );
  }

  //
  // Render UI
  //
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Your QR Code</Text>
        <Text style={styles.sub}>Share this to identify yourself on RallyHub.</Text>

        <View style={styles.qrBox}>
          <QRCode value={qrValue} size={240} />
        </View>

        <Text style={styles.nameLabel}>Display Name:</Text>
        <Text style={styles.name}>{profile.display_name}</Text>
        <Text style={styles.statusLabel}>
          {profile.user_id ? "Registered User" : "Local User"}
        </Text>

        <Text style={styles.expiration}>
          Expires in {formatTime(remainingSec)} (auto-refresh)
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

//
// Helpers
//
function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

//
// Styles
//
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  qrBox: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginVertical: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  sub: {
    fontSize: 16,
    opacity: 0.6,
    marginBottom: 20,
    maxWidth: 260,
    textAlign: "center",
  },
  nameLabel: {
    fontSize: 16,
    marginTop: 12,
    opacity: 0.6,
  },
  name: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 12,
  },
  expiration: {
    fontSize: 14,
    opacity: 0.5,
  },
  text: {
    marginTop: 10,
    fontSize: 16,
  },
  error: {
    color: "red",
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
