import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import PlayerSelectionModal from "@/components/PlayerSelectionModal";
import ScoreEditorModal from "@/components/ScoreEditorModal";
import VenueAutocomplete from "@/components/VenueAutocomplete";
import { PlayScreenController } from "@/lib/controllers/PlayScreenController";
import { useMatchStore } from "@/lib/data/hooks/useMatchStore";
import { usePlayerSlotStore } from "@/lib/data/hooks/usePlayerSlotStore";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { useVenueStore } from "@/lib/data/hooks/useVenueStore";
import type { RemoteProfile, RemoteVenue } from "@/lib/supabase/types";

export default function PlayScreen() {
  const router = useRouter();
  const controller = useMemo(() => new PlayScreenController(), []);

  const { team1, team2, activeSlot } = usePlayerSlotStore();
  const { setActiveSlot, clearActiveSlot } = usePlayerSlotStore();

  const updateMatchScore = useMatchStore((s) => s.updateMatchScore);
  const { currentLink, loadLink } = useLocalProfileLinkStore();
  const { profiles, loadProfiles } = useProfileStore();
  const { venues, loadVenues } = useVenueStore();

  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [selectedVenue, setSelectedVenue] = useState<RemoteVenue | null>(null);
  const [hasAutoPopulatedVenue, setHasAutoPopulatedVenue] = useState(false);

  // Score editor modal visibility
  const [scoreModalVisible, setScoreModalVisible] = useState(false);

  // Player selection modal visibility
  const [playerSelectionVisible, setPlayerSelectionVisible] = useState(false);

  // Store the created match temporarily
  const [createdMatch, setCreatedMatch] = useState<null | any>(null);

  //
  // INIT: auto-fill current user
  //
  useEffect(() => {
    controller.init();
    loadLink();
    loadProfiles();
    loadVenues();
  }, []);

  //
  // Auto-populate default venue from current profile (only once on initial load)
  //
  useEffect(() => {
    if (currentLink && profiles.length > 0 && venues.length > 0 && !hasAutoPopulatedVenue) {
      const currentProfile = profiles.find((p) => p.id === currentLink.profile_id);
      if (currentProfile?.default_venue_id) {
        const defaultVenue = venues.find((v) => v.id === currentProfile.default_venue_id);
        if (defaultVenue) {
          setSelectedVenue(defaultVenue);
          setHasAutoPopulatedVenue(true);
        }
      } else {
        setHasAutoPopulatedVenue(true);
      }
    }
  }, [currentLink, profiles, venues, hasAutoPopulatedVenue]);

  //
  // SLOT UI
  //
  const renderSlot = (team: 1 | 2, index: 0 | 1) => {
    const slot = team === 1 ? team1[index] : team2[index];
    const isActive = activeSlot?.team === team && activeSlot.index === index;

    return (
      <TouchableOpacity
        style={[styles.slot, isActive && styles.slotActive]}
        onPress={() => {
          setActiveSlot(team, index);
          setPlayerSelectionVisible(true);
        }}
      >
        <Text style={styles.slotLabel}>
          {slot.player
            ? `${slot.player.profile.display_name}${
                slot.player.isLocal ? " (You)" : ""
              }`
            : "Tap to assign"}
        </Text>
      </TouchableOpacity>
    );
  };

  //
  // QR Scan
  //
  const handleScanQR = () => {
    setPlayerSelectionVisible(false);
    router.push("/(tabs)/play/scan-qr");
  };

  //
  // Add guest with auto-generated name
  //
  const handleAddGuest = async () => {
    try {
      setPlayerSelectionVisible(false);
      await controller.handleAddPlaceholder();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to add guest.");
    }
  };

  //
  // Now: CREATE MATCH → OPEN MODAL (no navigation)
  //
  const handleSubmitMatch = async () => {
    try {
      const venueId = selectedVenue?.id ?? null;
      const match = await controller.createMatch(scores, venueId);

      // Store match for use when saving score
      setCreatedMatch(match);

      // Open modal immediately
      setScoreModalVisible(true);
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to create match.");
    }
  };

  //
  // Handle score save from modal - auto-verifies the creator's team
  //
  const handleSaveScore = async (t1: number, t2: number) => {
    if (!createdMatch || !currentLink?.profile_id) return;

    // Use updateMatchScore which auto-verifies the updater's team
    await updateMatchScore(createdMatch.id, t1, t2, currentLink.profile_id);

    // Cleanup
    setScoreModalVisible(false);
    controller.resetSlots();

    // Navigate to match detail
    router.push(`/match/${createdMatch.id}`);
  };

  const handlePlayerSelected = (profile: RemoteProfile) => {
    if (activeSlot) {
      const resolvedPlayer = {
        profile,
        isLocal: false,
        isPlaceholder: profile.is_placeholder,
      };
      const success = usePlayerSlotStore.getState().assignToSlot(activeSlot.team, activeSlot.index, resolvedPlayer);
      if (!success) {
        Alert.alert(
          "Duplicate Player",
          `${profile.display_name} is already added to this match. Each player can only be in one slot.`
        );
      }
      clearActiveSlot();
    }
  };

  //
  // RENDER
  //
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>New Match</Text>

      <View style={styles.teamsContainer}>
        {/* Players Side 1 */}
        <View style={styles.teamColumn}>
          <Text style={styles.sideLabel}>Side 1</Text>
          {renderSlot(1, 0)}
          {renderSlot(1, 1)}
        </View>

        {/* VS Indicator */}
        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        {/* Players Side 2 */}
        <View style={styles.teamColumn}>
          <Text style={styles.sideLabel}>Side 2</Text>
          {renderSlot(2, 0)}
          {renderSlot(2, 1)}
        </View>
      </View>

      {/* Venue Selection */}
      <View style={styles.venueSection}>
        <Text style={styles.sectionLabel}>Venue (Optional)</Text>
        <VenueAutocomplete
          onSelectVenue={setSelectedVenue}
          selectedVenue={selectedVenue}
          placeholder="Search for a venue..."
        />
      </View>

      {/* Create match */}
      <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmitMatch}>
        <Text style={styles.btnPrimaryText}>Create Match</Text>
      </TouchableOpacity>

      {/* Score Editor Modal */}
      <ScoreEditorModal
        visible={scoreModalVisible}
        onClose={() => setScoreModalVisible(false)}
        initialTeam1={0}
        initialTeam2={0}
        onSave={handleSaveScore}
      />

      {/* Player Selection Modal */}
      <PlayerSelectionModal
        visible={playerSelectionVisible}
        onClose={() => setPlayerSelectionVisible(false)}
        onSelectPlayer={handlePlayerSelected}
        onScanQR={handleScanQR}
        onAddGuest={handleAddGuest}
      />
      </ScrollView>
    </SafeAreaView>
  );
}

//
// ---------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },

  teamsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  venueSection: {
    marginTop: 20,
    marginBottom: 10,
  },

  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },

  teamColumn: {
    flex: 1,
    marginHorizontal: 4,
  },

  sideLabel: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: "#333",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  vsContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    marginTop: 24,
  },

  vsText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#666",
    letterSpacing: 1,
  },

  slot: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#aaa",
    marginVertical: 6,
  },

  slotActive: {
    borderColor: "#007aff",
    backgroundColor: "#e6f0ff",
  },

  slotLabel: {
    fontSize: 16,
  },

  btnPrimary: {
    backgroundColor: "#28a745",
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
  },

  btnPrimaryText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 18,
  },
});
