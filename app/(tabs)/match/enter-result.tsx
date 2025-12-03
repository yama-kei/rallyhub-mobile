// app/(tabs)/match/enter-result.tsx

import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Button,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useMatchStore } from "@/lib/data/hooks/useMatchStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";

export default function EnterMatchResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { matches, loadMatches, updateMatchScore } = useMatchStore();
  const { profiles, loadProfiles } = useProfileStore();
  const { currentLink, loadLink } = useLocalProfileLinkStore();

  const [scoreT1, setScoreT1] = useState(0);
  const [scoreT2, setScoreT2] = useState(0);

  useEffect(() => {
    loadMatches();
    loadProfiles();
    loadLink();
  }, []);

  const match = matches.find((m) => m.id === id) ?? null;

  const getName = (pid: string | null) =>
    pid ? profiles.find((p) => p.id === pid)?.display_name || "Unknown" : "—";

  //
  // Initialize score fields when match loads
  //
  useEffect(() => {
    if (match) {
      setScoreT1(match.score_team1 ?? 0);
      setScoreT2(match.score_team2 ?? 0);
    }
  }, [match]);

  //
  // Save updates - auto-verifies the updater's team
  //
  async function handleSave() {
    if (!match || !currentLink?.profile_id) return;

    // Use updateMatchScore which auto-verifies the updater's team
    await updateMatchScore(match.id, scoreT1, scoreT2, currentLink.profile_id);

    router.push(`/match/${match.id}`);
  }

  //
  // Loading State
  //
  if (!match) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading match…</Text>
      </SafeAreaView>
    );
  }

  //
  // UI
  //
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Text style={styles.title}>Enter Match Result</Text>

      {/* Players */}
      <View style={styles.teamsBox}>
        <View style={styles.team}>
          <Text style={styles.player}>{getName(match.team1_player1)}</Text>
          <Text style={styles.player}>{getName(match.team1_player2)}</Text>
        </View>

        <View style={styles.team}>
          <Text style={styles.player}>{getName(match.team2_player1)}</Text>
          <Text style={styles.player}>{getName(match.team2_player2)}</Text>
        </View>
      </View>

      {/* Score Controls */}
      <View style={styles.scoreEntryBox}>
        <View style={styles.scoreCol}>
          <TouchableOpacity onPress={() => setScoreT1(scoreT1 + 1)}>
            <Text style={styles.plus}>＋</Text>
          </TouchableOpacity>
          <Text style={styles.score}>{scoreT1}</Text>
          <TouchableOpacity
            onPress={() => setScoreT1(Math.max(0, scoreT1 - 1))}
          >
            <Text style={styles.minus}>－</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.scoreCol}>
          <TouchableOpacity onPress={() => setScoreT2(scoreT2 + 1)}>
            <Text style={styles.plus}>＋</Text>
          </TouchableOpacity>
          <Text style={styles.score}>{scoreT2}</Text>
          <TouchableOpacity
            onPress={() => setScoreT2(Math.max(0, scoreT2 - 1))}
          >
            <Text style={styles.minus}>－</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginTop: 32 }}>
        <Button title="Save Result" onPress={handleSave} />
      </View>
    </SafeAreaView>
  );
}

//
// Styles
//
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },

  center: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 30,
    textAlign: "center",
  },

  teamsBox: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 40,
  },

  team: {
    alignItems: "center",
  },
  player: {
    fontSize: 15,
    marginBottom: 2,
  },

  scoreEntryBox: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 20,
    paddingVertical: 20,
  },

  scoreCol: {
    alignItems: "center",
  },

  plus: {
    fontSize: 40,
    color: "#007aff",
    marginBottom: 8,
  },
  minus: {
    fontSize: 40,
    color: "#007aff",
    marginTop: 8,
  },

  score: {
    fontSize: 40,
    fontWeight: "900",
  },
});
