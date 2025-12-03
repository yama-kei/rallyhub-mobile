// src/components/PlayerSelectionModal.tsx

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { usePlayerSlotStore } from "@/lib/data/hooks/usePlayerSlotStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import type { RemoteProfile } from "@/lib/supabase/types";
import { getProfileStatus, getProfileStatusLabel } from "@/lib/utils/profileStatus";

interface PlayerSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPlayer: (profile: RemoteProfile) => void;
  onScanQR?: () => void;
  onAddGuest?: () => void;
}

export default function PlayerSelectionModal({
  visible,
  onClose,
  onSelectPlayer,
  onScanQR,
  onAddGuest,
}: PlayerSelectionModalProps) {
  const { profiles, loadProfiles } = useProfileStore();
  const { currentLink, loadLink } = useLocalProfileLinkStore();
  const { team1, team2 } = usePlayerSlotStore();

  const slide = useRef(new Animated.Value(0)).current;

  // Load profiles when modal opens
  useEffect(() => {
    if (visible) {
      loadProfiles();
      loadLink();
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

  // Get IDs of players already assigned to slots
  const assignedPlayerIds = new Set([
    team1[0].player?.profile.id,
    team1[1].player?.profile.id,
    team2[0].player?.profile.id,
    team2[1].player?.profile.id,
  ].filter(Boolean));

  // Filter out: already assigned players (including current user if already assigned)
  const localProfileId = currentLink?.profile_id;
  const isLocalUserAssigned = localProfileId ? assignedPlayerIds.has(localProfileId) : false;
  const availablePlayers = profiles.filter((p) => {
    // Only exclude current user if they are already assigned to a slot
    if (p.id === localProfileId && isLocalUserAssigned) return false;
    if (assignedPlayerIds.has(p.id)) return false; // exclude already assigned
    return true;
  });

  // Sort: real users first, then alphabetically
  availablePlayers.sort((a, b) => {
    if (a.is_placeholder !== b.is_placeholder) {
      return a.is_placeholder ? 1 : -1;
    }
    return a.display_name.localeCompare(b.display_name);
  });

  const renderItem = ({ item }: { item: RemoteProfile }) => {
    const status = getProfileStatus(item);
    const statusLabel = getProfileStatusLabel(status);
    return (
      <TouchableOpacity
        style={styles.playerRow}
        onPress={() => {
          onSelectPlayer(item);
          onClose();
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.playerName}>{item.display_name}</Text>
          <Text style={styles.statusTag}>{statusLabel}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      {/* Dim background */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={styles.overlay}
      />

      {/* Bottom Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <Text style={styles.title}>Choose Player</Text>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {onScanQR && (
            <TouchableOpacity style={styles.actionBtn} onPress={onScanQR}>
              <Text style={styles.actionBtnText}>Scan QR Code</Text>
            </TouchableOpacity>
          )}
          {onAddGuest && (
            <TouchableOpacity style={styles.actionBtn} onPress={onAddGuest}>
              <Text style={styles.actionBtnText}>Add Guest Player</Text>
            </TouchableOpacity>
          )}
        </View>

        {availablePlayers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No known players available</Text>
            <Text style={styles.emptySub}>
              Scan a player's QR code or add a guest player instead.
            </Text>
          </View>
        ) : (
          <FlatList
            data={availablePlayers}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
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
    maxHeight: "70%",
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
    marginBottom: 20,
  },

  actionsContainer: {
    marginBottom: 16,
  },

  actionBtn: {
    backgroundColor: "#0080ff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },

  actionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  list: {
    flex: 1,
  },

  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  playerName: {
    fontSize: 18,
    fontWeight: "600",
  },

  statusTag: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },

  chevron: {
    fontSize: 28,
    color: "#aaa",
    marginLeft: 8,
  },

  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#666",
  },

  emptySub: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
  },

  cancelBtn: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },

  cancelText: {
    fontSize: 16,
    color: "#666",
  },
});
