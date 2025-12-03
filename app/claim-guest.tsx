// app/claim-guest.tsx

import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { dataEnvironment } from "@/lib/data/DataEnvironment";
import { useDebugModeStore } from "@/lib/data/hooks/useDebugModeStore";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { QRPayloadBuilder, type RallyHubQRPayload } from "@/lib/qr/QRPayloadBuilder";
import type { RemoteProfile } from "@/lib/supabase/types";

type ClaimStep = "select-guest" | "scan-qr" | "confirm" | "processing";

export default function ClaimGuestScreen() {
  const router = useRouter();
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const claimService = dataEnvironment.claimProfileService;
  const { isDebugMode } = useDebugModeStore();
  const { currentLink, loadLink } = useLocalProfileLinkStore();

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Flow state
  const [step, setStep] = useState<ClaimStep>("select-guest");
  const [placeholders, setPlaceholders] = useState<RemoteProfile[]>([]);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<RemoteProfile | null>(null);
  const [scannedPayload, setScannedPayload] = useState<RallyHubQRPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // QR scanning state
  const [scanning, setScanning] = useState(true);
  const scanLockedRef = useRef(false);

  // Load current user's profile link on mount
  // Note: loadLink from Zustand store is stable, so empty deps is safe
  useEffect(() => {
    loadLink();
  }, []);

  // Load unclaimed placeholders when currentLink is available
  useEffect(() => {
    const loadPlaceholders = async () => {
      setLoading(true);
      try {
        // Exclude the current user's profile from the list of unclaimed placeholders
        const currentProfileId = currentLink?.profile_id;
        const unclaimed = await claimService.getUnclaimedPlaceholders(currentProfileId);
        setPlaceholders(unclaimed);
      } catch (err) {
        console.error("[ClaimGuestScreen] Failed to load placeholders:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPlaceholders();
  }, [currentLink, claimService]);

  // Pre-select placeholder if profileId is provided
  useEffect(() => {
    if (profileId && placeholders.length > 0 && !selectedPlaceholder) {
      const matchingPlaceholder = placeholders.find((p) => p.id === profileId);
      if (matchingPlaceholder) {
        handleSelectPlaceholder(matchingPlaceholder);
      }
    }
  }, [profileId, placeholders]);

  // Reload placeholders (used for refresh after claiming)
  const reloadPlaceholders = async () => {
    setLoading(true);
    try {
      const currentProfileId = currentLink?.profile_id;
      const unclaimed = await claimService.getUnclaimedPlaceholders(currentProfileId);
      setPlaceholders(unclaimed);
    } catch (err) {
      console.error("[ClaimGuestScreen] Failed to load placeholders:", err);
    } finally {
      setLoading(false);
    }
  };

  // Request camera permission when moving to scan step
  useEffect(() => {
    if (step === "scan-qr" && !permission?.granted) {
      requestPermission();
    }
  }, [step, permission]);

  // Handle selecting a placeholder to claim
  const handleSelectPlaceholder = (profile: RemoteProfile) => {
    setSelectedPlaceholder(profile);
    setStep("scan-qr");
    setScanning(true);
    scanLockedRef.current = false;
  };

  // Handle QR scan
  const handleBarcodeScanned = async (result: { data: string }) => {
    if (scanLockedRef.current) return;
    scanLockedRef.current = true;
    setScanning(false);

    try {
      console.log("[ClaimGuest] Barcode scanned, raw data:", result.data);
      const payload = QRPayloadBuilder.parse(result.data, isDebugMode);
      console.log("[ClaimGuest] Parsed payload:", JSON.stringify(payload, null, 2));

      // Validate this is a real profile QR (not a placeholder)
      if (!QRPayloadBuilder.isRealProfile(payload)) {
        console.log("[ClaimGuest] Invalid QR: Not a real profile payload");
        Alert.alert(
          "Invalid QR Code",
          "This QR code belongs to a guest/placeholder profile. You need to scan the QR code of a registered user to claim this guest profile.",
          [
            {
              text: "Try Again",
              onPress: () => {
                scanLockedRef.current = false;
                setScanning(true);
              },
            },
          ]
        );
        return;
      }

      setScannedPayload(payload);
      setStep("confirm");
    } catch (err: any) {
      console.error("[ClaimGuest] Error processing QR:", err);
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

  // Handle confirm claim
  const handleConfirmClaim = async () => {
    if (!selectedPlaceholder || !scannedPayload) return;

    setStep("processing");

    try {
      const result = await claimService.claimPlaceholder(
        selectedPlaceholder.id,
        scannedPayload
      );

      if (result.success) {
        Alert.alert(
          "Success!",
          `Guest profile "${selectedPlaceholder.display_name}" has been claimed by ${scannedPayload.display_name}. All match records have been updated.`,
          [
            {
              text: "Done",
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert("Claim Failed", result.error ?? "Unknown error occurred.", [
          {
            text: "OK",
            onPress: () => {
              setStep("select-guest");
              setSelectedPlaceholder(null);
              setScannedPayload(null);
              reloadPlaceholders();
            },
          },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to claim profile.", [
        {
          text: "OK",
          onPress: () => {
            setStep("select-guest");
            setSelectedPlaceholder(null);
            setScannedPayload(null);
          },
        },
      ]);
    }
  };

  // Render step 1: Select guest to claim
  const renderSelectGuest = () => {
    if (loading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading guest profiles...</Text>
        </View>
      );
    }

    if (placeholders.length === 0) {
      return (
        <View style={styles.centerContent}>
          <Text style={styles.emptyTitle}>No Guest Profiles</Text>
          <Text style={styles.emptySubtitle}>
            There are no unclaimed guest profiles to claim. Guest profiles are
            created when you add players without scanning their QR code.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <Text style={styles.stepTitle}>Step 1: Select Guest Profile</Text>
        <Text style={styles.stepDescription}>
          Choose the guest profile that you want to claim. This will be
          replaced with the real user's profile after they scan their QR code.
        </Text>

        <FlatList
          data={placeholders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.placeholderRow}
              onPress={() => handleSelectPlaceholder(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.placeholderName}>{item.display_name}</Text>
                <Text style={styles.placeholderCode}>
                  Code: {item.placeholder_code ?? "N/A"}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>
    );
  };

  // Render step 2: Scan real user's QR
  const renderScanQR = () => {
    if (!permission) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Checking camera permissions…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Camera permission is required.</Text>
          <TouchableOpacity onPress={requestPermission} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Enable Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setStep("select-guest");
              setSelectedPlaceholder(null);
            }}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
        />

        {/* Overlay */}
        <View style={styles.cameraOverlay}>
          <Text style={styles.cameraTitle}>Step 2: Scan Real User's QR</Text>
          <Text style={styles.cameraSubtitle}>
            Ask {selectedPlaceholder?.display_name} to show their registered
            account QR code.
          </Text>
        </View>

        {!scanning && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.processingText}>Processing…</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.cancelScanButton}
          onPress={() => {
            setStep("select-guest");
            setSelectedPlaceholder(null);
          }}
        >
          <Text style={styles.cancelScanText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render step 3: Confirm claim
  const renderConfirm = () => {
    return (
      <View style={styles.content}>
        <Text style={styles.stepTitle}>Step 3: Confirm Claim</Text>

        <View style={styles.confirmBox}>
          <Text style={styles.confirmLabel}>Guest Profile:</Text>
          <Text style={styles.confirmValue}>
            {selectedPlaceholder?.display_name}
          </Text>

          <View style={styles.arrowContainer}>
            <Text style={styles.arrow}>↓</Text>
            <Text style={styles.arrowLabel}>will be claimed by</Text>
            <Text style={styles.arrow}>↓</Text>
          </View>

          <Text style={styles.confirmLabel}>Real User:</Text>
          <Text style={styles.confirmValue}>{scannedPayload?.display_name}</Text>
        </View>

        <Text style={styles.warningText}>
          This action will update all match records that reference the guest
          profile. This cannot be undone.
        </Text>

        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmClaim}>
          <Text style={styles.confirmButtonText}>Confirm Claim</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setStep("scan-qr");
            setScannedPayload(null);
            setScanning(true);
            scanLockedRef.current = false;
          }}
        >
          <Text style={styles.backButtonText}>Scan Different QR</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render step 4: Processing
  const renderProcessing = () => {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Claiming profile...</Text>
        <Text style={styles.loadingSubtext}>
          Updating profile and match records...
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {step === "select-guest" && renderSelectGuest()}
      {step === "scan-qr" && renderScanQR()}
      {step === "confirm" && renderConfirm()}
      {step === "processing" && renderProcessing()}
    </SafeAreaView>
  );
}

//
// Styles
//
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  headerBack: {
    fontSize: 16,
    color: "#007aff",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  content: {
    flex: 1,
    padding: 20,
  },

  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  stepTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },

  stepDescription: {
    fontSize: 15,
    color: "#666",
    marginBottom: 20,
    lineHeight: 22,
  },

  list: {
    flex: 1,
  },

  placeholderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  placeholderName: {
    fontSize: 18,
    fontWeight: "600",
  },

  placeholderCode: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },

  chevron: {
    fontSize: 28,
    color: "#aaa",
    marginLeft: 8,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },

  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#888",
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },

  emptySubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },

  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },

  camera: {
    flex: 1,
  },

  cameraOverlay: {
    position: "absolute",
    top: 20,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  cameraTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textShadowColor: "#000",
    textShadowRadius: 4,
  },

  cameraSubtitle: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    textShadowColor: "#000",
    textShadowRadius: 4,
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

  cancelScanButton: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },

  cancelScanText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  // Confirm styles
  confirmBox: {
    backgroundColor: "#f5f5f5",
    padding: 20,
    borderRadius: 12,
    marginVertical: 20,
  },

  confirmLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },

  confirmValue: {
    fontSize: 20,
    fontWeight: "700",
  },

  arrowContainer: {
    alignItems: "center",
    marginVertical: 16,
  },

  arrow: {
    fontSize: 24,
    color: "#007aff",
  },

  arrowLabel: {
    fontSize: 14,
    color: "#666",
    marginVertical: 4,
  },

  warningText: {
    fontSize: 14,
    color: "#ff6b00",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },

  // Buttons
  primaryButton: {
    backgroundColor: "#007aff",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 12,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  confirmButton: {
    backgroundColor: "#28a745",
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },

  confirmButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  backButton: {
    paddingVertical: 12,
    alignItems: "center",
  },

  backButtonText: {
    fontSize: 16,
    color: "#666",
  },

  errorText: {
    color: "red",
    fontSize: 18,
    marginBottom: 16,
    textAlign: "center",
  },
});
