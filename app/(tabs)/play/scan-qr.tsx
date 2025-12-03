import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PlayScreenController } from "@/lib/controllers/PlayScreenController";
import { useDebugModeStore } from "@/lib/data/hooks/useDebugModeStore";
import { QRPayloadBuilder } from "@/lib/qr/QRPayloadBuilder";

export default function ScanQRScreen() {
  const router = useRouter();
  const controller = new PlayScreenController();
  const { isDebugMode } = useDebugModeStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const scanLockedRef = useRef(false);

  //
  // Request camera permission on mount
  //
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Checking camera permissions…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Camera permission is required.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btn}>
          <Text style={styles.btnText}>Enable Camera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  //
  // Handle QR detection
  //
  const handleBarcodeScanned = async (result: { data: string }) => {
    if (scanLockedRef.current) return;
    scanLockedRef.current = true;
    setScanning(false);

    try {
      const payload = QRPayloadBuilder.parse(result.data, isDebugMode);
      await controller.handleQRScan(payload);
      router.back();
    } catch (err: any) {
      Alert.alert("Invalid QR Code", err.message, [
        {
          text: "Try Again",
          onPress: () => {
            scanLockedRef.current = false;
            setScanning(true);
          },
        },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
      />

      {/* Overlay frame */}
      <View style={styles.overlay}>
        <Text style={styles.title}>Scan a RallyHub QR</Text>
      </View>

      {!scanning && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.processingText}>Processing…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

//
// Styles
//
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 20,
    width: "100%",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textShadowColor: "#000",
  },
  processingOverlay: {
    position: "absolute",
    bottom: 120,
    width: "100%",
    alignItems: "center",
  },
  processingText: {
    marginTop: 12,
    color: "#fff",
    fontSize: 18,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  errorText: {
    color: "red",
    fontSize: 18,
    marginBottom: 16,
  },
  btn: {
    padding: 12,
    backgroundColor: "#007aff",
    borderRadius: 10,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
