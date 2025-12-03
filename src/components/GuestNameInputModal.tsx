// src/components/GuestNameInputModal.tsx

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface GuestNameInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

export default function GuestNameInputModal({
  visible,
  onClose,
  onSave,
}: GuestNameInputModalProps) {
  const [guestName, setGuestName] = useState("");

  const slide = useRef(new Animated.Value(0)).current;

  // Animate modal slide-up
  useEffect(() => {
    if (visible) {
      // Reset name when opening
      setGuestName("");
      slide.setValue(0);
      Animated.timing(slide, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  function resetAndClose() {
    setGuestName("");
    onClose();
  }

  function handleSave() {
    const trimmedName = guestName.trim();
    // If empty, use default "Guest"
    const finalName = trimmedName || "Guest";
    onSave(finalName);
    resetAndClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      {/* Dim background */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={resetAndClose}
        style={styles.overlay}
      />

      {/* Bottom Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <Text style={styles.title}>Add Guest Player</Text>

        <Text style={styles.label}>Guest Name (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter guest name"
          value={guestName}
          onChangeText={setGuestName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={resetAndClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>Add Guest</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

//
// Styles
//
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  sheet: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 30,
  },

  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },

  input: {
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    backgroundColor: "#fff",
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },

  cancelText: {
    fontSize: 16,
    color: "#666",
  },

  saveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#007aff",
    borderRadius: 8,
  },

  saveText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
