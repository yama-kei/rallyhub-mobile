// src/components/ScoreEditorModal.tsx

import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface ScoreEditorModalProps {
  visible: boolean;
  initialTeam1?: number;
  initialTeam2?: number;
  onClose: () => void;
  onSave: (team1: number, team2: number) => void;
}

export default function ScoreEditorModal({
  visible,
  initialTeam1 = 0,
  initialTeam2 = 0,
  onClose,
  onSave,
}: ScoreEditorModalProps) {
  const [team1, setTeam1] = useState(initialTeam1);
  const [team2, setTeam2] = useState(initialTeam2);

  const slide = useRef(new Animated.Value(0)).current;

  // Animate modal slide-up
  useEffect(() => {
    if (visible) {
      // Reset state to latest props when opening
      setTeam1(initialTeam1);
      setTeam2(initialTeam2);
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
    setTeam1(initialTeam1);
    setTeam2(initialTeam2);
    onClose();
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
        <Text style={styles.title}>Enter Match Score</Text>

        <View style={styles.scoreRow}>
          {/* Side 1 */}
          <View style={styles.scoreColumn}>
            <TouchableOpacity onPress={() => setTeam1(team1 + 1)}>
              <Text style={styles.plus}>＋</Text>
            </TouchableOpacity>

            <Text style={styles.score}>{team1}</Text>

            <TouchableOpacity onPress={() => setTeam1(Math.max(0, team1 - 1))}>
              <Text style={styles.minus}>－</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Side 2 */}
          <View style={styles.scoreColumn}>
            <TouchableOpacity onPress={() => setTeam2(team2 + 1)}>
              <Text style={styles.plus}>＋</Text>
            </TouchableOpacity>

            <Text style={styles.score}>{team2}</Text>

            <TouchableOpacity onPress={() => setTeam2(Math.max(0, team2 - 1))}>
              <Text style={styles.minus}>－</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={resetAndClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => {
              onSave(team1, team2);
              resetAndClose();
            }}
          >
            <Text style={styles.saveText}>Save Score</Text>
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

  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 32,
  },

  scoreColumn: {
    alignItems: "center",
    flex: 1,
  },

  plus: {
    fontSize: 38,
    color: "#007aff",
  },

  minus: {
    fontSize: 38,
    color: "#007aff",
  },

  score: {
    fontSize: 38,
    fontWeight: "900",
    marginVertical: 6,
  },

  divider: {
    width: 1,
    backgroundColor: "#ddd",
    marginHorizontal: 16,
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
